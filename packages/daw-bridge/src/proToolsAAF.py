"""Convert a qualified Pro Tools capture into an Orb archive, without flattening regions.

Requires pyaaf2 from requirements.txt. Only host-identified PCM media and unity-gain
mono/stereo clips are accepted. This is not an arbitrary AAF import adapter.
"""
import hashlib
import io
import json
from pathlib import Path
import sys
from urllib.parse import unquote, urlparse
import uuid
import wave
import zipfile

import aaf2

MAX_BYTES = 500 * 1024 * 1024
GAIN = "9d2ea894-0968-11d3-8a38-0050040ef7d2"
LEVEL = "e4962321-2267-11d3-8a4c-0050040ef7d2"
LINEAR = "5b6c85a4-0ede-11d3-80a9-006008143e6f"


def require(condition, message):
    if not condition:
        raise ValueError(message)


def integer(value):
    number = int(value)
    require(number == value and 0 <= number <= 2**53 - 1, "Nonintegral or negative AAF time.")
    return number


def source_clip(segment):
    if isinstance(segment, aaf2.components.OperationGroup):
        require(str(segment.operation.auid) == GAIN, "Unsupported clip processing.")
        require(len(segment.parameters) == 1, "Unsupported clip parameters.")
        parameter = list(segment.parameters)[0]
        require(isinstance(parameter, aaf2.misc.VaryingValue)
                and str(parameter.parameterdef.auid) == LEVEL
                and str(parameter.interpolationdef.auid) == LINEAR,
                "Unsupported clip gain curve.")
        points = list(parameter.pointlist)
        require(len(points) == 2 and points[0].time == 0 and points[1].time == 1
                and all(point.value == 1 for point in points),
                "Clip gain/fades must be rendered before transfer.")
        inputs = list(segment.segments)
        require(len(inputs) == 1 and inputs[0].length == segment.length,
                "Unsupported clip input mapping.")
        segment = inputs[0]
    require(isinstance(segment, aaf2.components.SourceClip), "Unsupported region, fade or nested sequence.")
    return segment


def resolve_source(clip, allowed_media, rate):
    master = clip.mob
    require(isinstance(master, aaf2.mobs.MasterMob), "Missing audio master.")
    slot = master.slot_at(clip.slot_id)
    require(integer(slot.origin) == 0 and slot.edit_rate == rate, "Unsupported master timebase.")
    source = slot.segment
    require(isinstance(source, aaf2.components.SourceClip), "Unsupported master mapping.")
    media = source.mob
    require(isinstance(media, aaf2.mobs.SourceMob)
            and isinstance(media.descriptor, aaf2.essence.WAVEDescriptor), "Only copied PCM WAV media is supported.")
    require(media.descriptor["SampleRate"].value == rate, "AAF media rate mismatch.")
    locators = list(media.descriptor["Locator"].value)
    require(len(locators) == 1, "Ambiguous media locator.")
    locator = urlparse(locators[0]["URLString"].value)
    require(locator.scheme == "file" and not locator.netloc and not locator.query and not locator.fragment,
            "Only local copied media is supported.")
    path = authorized_media_path(locator.path, allowed_media)
    return path, integer(clip.start) + integer(source.start)


def authorized_media_path(locator_path, allowed_media):
    # The AAF cannot grant arbitrary filesystem access. Match its locator against
    # the host's selected-media allowlist, including Pro Tools' volume prefix.
    decoded = unquote(locator_path)
    matches = []
    for item in allowed_media:
        path = Path(item["path"])
        if item.get("info", {}).get("is_online") is not True or not item.get("file_id") or not path.is_absolute():
            continue
        if decoded == str(path) or (decoded.startswith("/") and decoded.split("/", 2)[-1] == str(path).lstrip("/")):
            matches.append(path)
    require(len(matches) == 1, "AAF media is not uniquely authorized by the captured selection.")
    path = matches[0]
    require(path.suffix.lower() == ".wav" and not path.is_symlink() and path.is_file(), "Missing original PCM media.")
    return path


def read_pcm(path):
    require(path.stat().st_size <= MAX_BYTES, "Audio file is too large.")
    data = path.read_bytes()
    with wave.open(io.BytesIO(data), "rb") as audio:
        require(audio.getnchannels() in (1, 2) and audio.getsampwidth() in (2, 3)
                and audio.getcomptype() == "NONE", "Expected 16/24-bit mono/stereo PCM WAV.")
        frames, width = audio.getnframes(), audio.getsampwidth()
        channels = audio.getnchannels()
        require(frames * width * channels <= MAX_BYTES, "Audio payload is too large.")
        samples = audio.readframes(frames)
        require(len(samples) == frames * width * channels, "Truncated PCM media.")
        return {"rate": audio.getframerate(), "frames": frames, "channels": channels, "bytes": data}


def convert_capture(aaf_path, capture, timeline):
    require(Path(aaf_path).stat().st_size <= 64 * 1024 * 1024, "AAF is too large.")
    rate = integer(timeline["sampleRate"])
    require(rate > 0 and isinstance(capture.get("sessionId"), str) and capture["sessionId"], "Missing capture session.")
    targets = capture["temporary"]
    require(0 < len(targets) <= 128 and len({t["name"] for t in targets}) == len(targets), "Invalid captured tracks.")
    allowed_media = capture["media"]["file_locations"]
    require(len(allowed_media) == capture["media"]["pagination_response"]["total"], "Incomplete selected-media list.")
    bundle = {"format": "orb-region-bundle", "version": 1, "id": str(uuid.uuid4()),
              "source": {"daw": "Pro Tools", "projectId": capture["sessionId"], "captureId": str(uuid.uuid4())},
              "timebase": "song-samples", "tracks": [], "assets": [], "regions": []}
    audio_entries, asset_paths, cache = {}, {}, {}
    with aaf2.open(str(aaf_path), "r") as project:
        compositions = list(project.content.compositionmobs())
        require(len(compositions) == 1, "Ambiguous AAF composition.")
        slots = [s for s in compositions[0].slots if s.segment.media_kind == "Sound"]
        require(all(s.name in {t["name"] for t in targets} for s in slots), "AAF contains an unrequested track.")
        for order, target in enumerate(targets):
            channels = target["channels"]
            require(channels in (1, 2), "Only mono/stereo tracks are supported.")
            track_slots = sorted((s for s in slots if s.name == target["name"]), key=lambda s: s["PhysicalTrackNumber"].value)
            require(len(track_slots) == channels, "AAF channel count differs from the capture.")
            reports = [t for t in timeline["tracks"] if t["name"] == target["name"] + (" (Stereo)" if channels == 2 else "")]
            require(len(reports) == 1, "Missing or ambiguous captured timeline.")
            by_channel = []
            for channel, slot in enumerate(track_slots):
                require(slot.edit_rate == rate and integer(slot.origin) == 0, "Unsupported AAF track timebase.")
                require(isinstance(slot.segment, aaf2.components.Sequence), "Unsupported track sequence.")
                events = []
                for _, position, segment in slot.segment.positions():
                    if isinstance(segment, aaf2.components.Filler):
                        continue
                    clip = source_clip(segment)
                    path, offset = resolve_source(clip, allowed_media, rate)
                    events.append({"start": integer(position), "length": integer(segment.length), "offset": offset, "path": path})
                expected = [e for e in reports[0]["events"] if e["channel"] == channel + 1]
                require(len(events) == len(expected), "AAF region count differs from the captured timeline.")
                for event, actual in zip(events, expected):
                    require((event["start"], event["length"]) == (actual["start"], actual["duration"])
                            and actual["state"] == "Unmuted", "AAF region does not match the captured timeline.")
                    event["name"] = actual["name"]
                by_channel.append(events)
            require(len(by_channel[0]) > 0, "Empty selected track.")
            source = target["source"]
            source_order = source.get("index", order)
            require(type(source_order) is int and 0 <= source_order <= 2**53 - 1, "Invalid source track order.")
            bundle["tracks"].append({"id": source["id"], "name": source["name"], "order": source_order, "channels": channels})
            require(all(len(c) == len(by_channel[0]) for c in by_channel), "Stereo region counts differ.")
            for index, left in enumerate(by_channel[0]):
                parts = [c[index] for c in by_channel]
                require(all((p["start"], p["length"], p["offset"]) == (left["start"], left["length"], left["offset"])
                            for p in parts), "Stereo edits are not aligned.")
                name = left["name"]
                if channels == 2:
                    require(name.endswith(".L") and parts[1]["name"] == name[:-2] + ".R", "Unverified stereo channel order.")
                    name = name[:-2]
                require(all(p["path"] == left["path"] for p in parts), "Split-mono source media is not qualified.")
                key = left["path"]
                if key not in cache:
                    pcm = read_pcm(key)
                    require(pcm["rate"] == rate and pcm["channels"] == channels, "PCM format differs from AAF.")
                    data = pcm["bytes"]
                    digest = hashlib.sha256(data).hexdigest()
                    asset = next((a for a in bundle["assets"] if a["sha256"] == digest), None)
                    if asset is None:
                        require(sum(a["bytes"] for a in bundle["assets"]) + len(data) <= MAX_BYTES, "Bundle is too large.")
                        asset = {"id": str(uuid.uuid4()), "sha256": digest, "name": source["name"] + ".wav",
                                 "bytes": len(data), "sampleRate": rate, "channels": channels, "frames": pcm["frames"]}
                        bundle["assets"].append(asset)
                        path = "audio/" + digest + ".wav"
                        audio_entries[path], asset_paths[asset["id"]] = data, path
                    cache[key] = asset
                asset = cache[key]
                require(asset["channels"] == channels, "One source file has conflicting track channel mappings.")
                require(left["length"] > 0 and left["offset"] + left["length"] <= asset["frames"], "Invalid source trim.")
                bundle["regions"].append({"id": str(uuid.uuid4()), "assetId": asset["id"], "trackId": source["id"],
                                          "name": name, "start": {"samples": left["start"], "sampleRate": rate},
                                          "offsetFrames": left["offset"], "lengthFrames": left["length"]})
                require(len(bundle["regions"]) <= 512, "Too many regions.")
    return bundle, asset_paths, audio_entries


def main():
    aaf_path, capture_path, timeline_path, destination = sys.argv[1:]
    with open(capture_path, encoding="utf-8") as file:
        capture = json.load(file)
    with open(timeline_path, encoding="utf-8") as file:
        timeline = json.load(file)
    bundle, paths, audio = convert_capture(aaf_path, capture, timeline)
    manifest = json.dumps({**bundle, "assetPaths": paths}, ensure_ascii=False).encode("utf-8")
    require(len(manifest) <= 1024 * 1024, "Manifest is too large.")
    with zipfile.ZipFile(destination, "x", compression=zipfile.ZIP_STORED) as archive:
        archive.writestr("orb-regions.json", manifest)
        for path, data in audio.items():
            archive.writestr(path, data)
    print(json.dumps({"archive": destination, "tracks": len(bundle["tracks"]), "regions": len(bundle["regions"])}))


if __name__ == "__main__":
    main()
