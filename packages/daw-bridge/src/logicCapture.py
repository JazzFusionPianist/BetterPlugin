"""Join a stopped Logic AX selection with a fresh, private AAF export.

AX musical positions are used only to establish unambiguous region order.
All transferred sample positions, lengths and offsets come from the AAF.
Only plain nonoverlapping mono/stereo PCM regions are qualified here.
"""
import hashlib
import io
import json
from pathlib import Path
import re
import sys
from urllib.parse import unquote, urlparse
import uuid
import wave
import zipfile

import aaf2
from proToolsAAF import require, integer, read_pcm, GAIN, LEVEL, LINEAR

MAX_BYTES = 280 * 1024 * 1024


def musical_position(text):
    result = [1, 1, 1, 1]
    tokens = list(re.finditer(r"(\d+) (bars?|beats?|divisions?|ticks?)\b", text))
    require(tokens and not re.sub(r"(\d+) (bars?|beats?|divisions?|ticks?)\b", "", text).strip(),
            "Unsupported Logic position display. Use English Logic with bars/beats.")
    found = set()
    for token in tokens:
        unit = token[2].rstrip("s")
        index = ["bar", "beat", "division", "tick"].index(unit)
        require(index not in found and int(token[1]) > 0, "Ambiguous Logic position display.")
        found.add(index)
        result[index] = int(token[1])
    return tuple(result)


def selection_tracks(snapshot):
    require(snapshot.get("version") == 1 and snapshot.get("projectId"), "Missing Logic selection snapshot.")
    tracks = []
    for track in snapshot["tracks"]:
        # Logic exposes the empty new-track drop area as an unnamed track background.
        if not track["regions"]:
            continue
        match = re.fullmatch(r"Track (\d+) [\u201c\"](.+)[\u201d\"]", track.get("AXDescription", ""))
        require(match is not None, "Unsupported Logic track identity.")
        regions = []
        for region in track["regions"]:
            match_position = re.search(r"Region starts at (.*?) and ends at (.*?), Audio region\.", region.get("AXHelp", ""))
            # Unselected MIDI tracks need not be exported; mixed/selected MIDI fails.
            if match_position is None:
                require(not any(r.get("AXSelected") for r in track["regions"]), "Only ordinary audio regions can be captured.")
                continue
            start, end = (musical_position(s.strip()) for s in match_position.groups())
            regions.append({"name": region.get("AXDescription", ""), "start": start, "end": end,
                            "selected": bool(region.get("AXSelected"))})
        regions.sort(key=lambda r: r["start"])
        if not any(r["selected"] for r in regions):
            continue
        for index, region in enumerate(regions):
            require(region["name"] and region["start"] < region["end"], "Ambiguous or sub-tick region.")
            if index:
                require(regions[index - 1]["start"] < region["start"]
                        and regions[index - 1]["end"] <= region["start"], "Overlapping or ambiguous source region order.")
        tracks.append({"order": int(match[1]) - 1, "name": match[2], "regions": regions})
    require(tracks and sum(sum(r["selected"] for r in t["regions"]) for t in tracks) <= 512,
            "Select between 1 and 512 audio regions in Logic.")
    require(len({t["name"] for t in tracks}) == len(tracks), "Selected track names must be unique.")
    return tracks


def plain_clip(segment):
    if isinstance(segment, aaf2.components.OperationGroup):
        require(str(segment.operation.auid) == GAIN, "Render region processing before capture.")
        parameters = list(segment.parameters)
        require(len(parameters) == 1, "Unsupported Logic region parameters.")
        parameter = parameters[0]
        require(isinstance(parameter, aaf2.misc.VaryingValue)
                and str(parameter.parameterdef.auid) == LEVEL and str(parameter.interpolationdef.auid) == LINEAR,
                "Unsupported Logic region gain.")
        points = list(parameter.pointlist)
        # Logic emits an empty gain curve for an unprocessed region.
        require(not points or all(point.value == 1 for point in points), "Render gain/fades before capture.")
        require(len(segment.segments) == 1 and segment.segments[0].length == segment.length,
                "Unsupported Logic processing graph.")
        segment = segment.segments[0]
    require(isinstance(segment, aaf2.components.SourceClip), "Unsupported Logic region type.")
    return segment


def source(clip, directory, rate):
    require(isinstance(clip.mob, aaf2.mobs.MasterMob), "Missing Logic media master.")
    master_slot = clip.mob.slot_at(clip.slot_id)
    require(master_slot.edit_rate == rate and master_slot.origin == 0, "Unsupported master timebase.")
    segment = master_slot.segment
    if isinstance(segment, aaf2.components.Sequence):
        segments = [(p, s) for _, p, s in segment.positions() if not isinstance(s, aaf2.components.Filler)]
        require(len(segments) == 1 and segments[0][0] == 0, "Unsupported Logic master sequence.")
        segment = segments[0][1]
    require(isinstance(segment, aaf2.components.SourceClip), "Unsupported Logic media mapping.")
    media = segment.mob
    require(isinstance(media, aaf2.mobs.SourceMob) and isinstance(media.descriptor, aaf2.essence.WAVEDescriptor),
            "Expected exported PCM WAV media.")
    require(media.descriptor["SampleRate"].value == rate, "Logic export sample rates differ.")
    locators = list(media.descriptor["Locator"].value)
    require(len(locators) == 1, "Ambiguous Logic media locator.")
    locator = urlparse(locators[0]["URLString"].value)
    require(locator.scheme == "file" and not locator.netloc and not locator.query and not locator.fragment,
            "Only private local AAF media can be read.")
    path = Path(unquote(locator.path))
    root = Path(directory).resolve()
    require(path.is_absolute() and path.resolve().is_relative_to(root) and not path.is_symlink(),
            "AAF media is outside the private export directory.")
    return path, integer(clip.start) + integer(segment.start)


def read_track(slot, directory):
    require(slot.origin == 0 and isinstance(slot.segment, aaf2.components.Sequence), "Unsupported Logic track sequence.")
    rate = integer(slot.edit_rate)
    require(8000 <= rate <= 384000, "Unsupported Logic export sample rate.")
    events = []
    for _, position, segment in slot.segment.positions():
        if isinstance(segment, aaf2.components.Filler):
            continue
        clip = plain_clip(segment)
        path, offset = source(clip, directory, rate)
        events.append({"start": integer(position), "length": integer(segment.length), "offset": offset, "path": path, "rate": rate})
    return events


def joined_pcm(parts):
    pcm = [read_pcm(p["path"]) for p in parts]
    require(sum(len(p["bytes"]) for p in pcm) <= MAX_BYTES, "Source channel media exceeds 280 MB.")
    require(all(p["channels"] == 1 for p in pcm), "Expected mono AAF channel media.")
    require(len({(p["rate"], p["frames"]) for p in pcm}) == 1, "Stereo PCM channels differ.")
    if len(parts) == 1:
        return pcm[0]
    samples, widths = [], []
    for item in pcm:
        with wave.open(io.BytesIO(item["bytes"]), "rb") as audio:
            widths.append(audio.getsampwidth())
            samples.append(audio.readframes(item["frames"]))
    require(len(set(widths)) == 1, "Stereo PCM bit depths differ.")
    width = widths[0]
    data = bytearray(len(samples[0]) * 2)
    for channel in range(2):
        for byte in range(width):
            data[channel * width + byte::width * 2] = samples[channel][byte::width]
    output = io.BytesIO()
    with wave.open(output, "wb") as audio:
        audio.setnchannels(2)
        audio.setsampwidth(width)
        audio.setframerate(pcm[0]["rate"])
        audio.writeframes(data)
    return {**pcm[0], "bytes": output.getvalue(), "channels": 2}


def selected_pcm(pcm, offset, length):
    require(length > 0 and offset + length <= pcm["frames"], "Invalid Logic source trim.")
    output = io.BytesIO()
    with wave.open(io.BytesIO(pcm["bytes"]), "rb") as source_audio, wave.open(output, "wb") as selected:
        source_audio.setpos(offset)
        selected.setnchannels(source_audio.getnchannels())
        selected.setsampwidth(source_audio.getsampwidth())
        selected.setframerate(source_audio.getframerate())
        selected.writeframes(source_audio.readframes(length))
    return {**pcm, "frames": length, "bytes": output.getvalue()}


def convert(aaf_path, before, after, directory):
    stable = lambda s: {key: s[key] for key in ["version", "pid", "projectId", "tracks"]}
    require(stable(before) == stable(after), "Logic selection or timeline changed during capture.")
    selected = selection_tracks(before)
    require(Path(aaf_path).stat().st_size <= 64 * 1024 * 1024, "AAF metadata exceeds the capture limit.")
    bundle = {"format": "orb-region-bundle", "version": 1, "id": str(uuid.uuid4()), "timebase": "song-samples",
              "source": {"daw": "Logic Pro", "projectId": hashlib.sha256(before["projectId"].encode()).hexdigest(),
                         "captureId": str(uuid.uuid4())},
              "tracks": [], "regions": [], "assets": []}
    paths, audio, cache = {}, {}, {}
    with aaf2.open(str(aaf_path), "r") as project:
        compositions = list(project.content.compositionmobs())
        require(len(compositions) == 1, "Ambiguous Logic AAF composition.")
        slots = [s for s in compositions[0].slots if s.segment.media_kind in ("Sound", "LegacySound")]
        for track in selected:
            mono = [s for s in slots if s.name == track["name"]]
            left = [s for s in slots if s.name == track["name"] + " -L"]
            right = [s for s in slots if s.name == track["name"] + " -R"]
            require((len(mono), len(left), len(right)) in [(1, 0, 0), (0, 1, 1)],
                    "Missing or duplicate source track name in the Logic export.")
            channels = [read_track(s, directory) for s in (mono or left + right)]
            require(all(len(c) == len(track["regions"]) for c in channels), "Logic AX and AAF region counts differ; capture refused.")
            track_id = str(uuid.uuid4())
            bundle["tracks"].append({"id": track_id, "name": track["name"], "order": track["order"], "channels": len(channels)})
            for index, selected_region in enumerate(track["regions"]):
                if not selected_region["selected"]:
                    continue
                parts = [c[index] for c in channels]
                event = parts[0]
                require(all(tuple(p[k] for k in ["start", "length", "offset", "rate"]) ==
                            tuple(event[k] for k in ["start", "length", "offset", "rate"]) for p in parts),
                        "Stereo region timing differs.")
                key = (tuple(p["path"] for p in parts), event["offset"], event["length"])
                if key not in cache:
                    # Do not transmit the unselected portions of a backing WAV.
                    pcm = selected_pcm(joined_pcm(parts), event["offset"], event["length"])
                    require(pcm["rate"] == event["rate"], "PCM and timeline rates differ.")
                    data = pcm["bytes"]
                    digest = hashlib.sha256(data).hexdigest()
                    existing = next((a for a in bundle["assets"] if a["sha256"] == digest), None)
                    if existing is None:
                        require(sum(a["bytes"] for a in bundle["assets"]) + len(data) <= MAX_BYTES, "Captured media exceeds 280 MB.")
                        existing = {"id": str(uuid.uuid4()), "sha256": digest, "name": selected_region["name"] + ".wav",
                                    "bytes": len(data), "sampleRate": pcm["rate"], "frames": pcm["frames"], "channels": len(channels)}
                        bundle["assets"].append(existing)
                        path = "audio/" + digest + ".wav"
                        paths[existing["id"]], audio[path] = path, data
                    cache[key] = existing
                asset = cache[key]
                bundle["regions"].append({"id": str(uuid.uuid4()), "trackId": track_id, "assetId": asset["id"],
                                          "name": selected_region["name"], "start": {"samples": event["start"], "sampleRate": event["rate"]},
                                          "offsetFrames": 0, "lengthFrames": event["length"]})
    return bundle, paths, audio


def main():
    if sys.argv[1] == "--validate":
        print(json.dumps(selection_tracks(json.loads(Path(sys.argv[2]).read_text()))))
        return
    aaf_path, before_path, after_path, destination = sys.argv[1:]
    bundle, paths, audio = convert(aaf_path, json.loads(Path(before_path).read_text()),
                                   json.loads(Path(after_path).read_text()), Path(aaf_path).parent)
    with zipfile.ZipFile(destination, "x", compression=zipfile.ZIP_STORED) as archive:
        archive.writestr("orb-regions.json", json.dumps({**bundle, "assetPaths": paths}, ensure_ascii=False))
        for path, data in audio.items():
            archive.writestr(path, data)


if __name__ == "__main__":
    try:
        main()
    except ValueError as error:
        print(json.dumps({"error": str(error)}), file=sys.stderr)
        sys.exit(1)
