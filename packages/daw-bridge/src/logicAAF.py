"""Create self-contained, sample-timed AAF media for Logic's File > Import > AAF.

Input is a manifest and media paths validated by archive.mjs. This writes an
interchange file only; it must not report that a running project was modified.
"""
from fractions import Fraction
import hashlib
import json
from pathlib import Path
import sys

import aaf2
from proToolsAAF import read_pcm, require


def write_logic_aaf(bundle, paths, destination):
    require(bundle.get("source") and bundle.get("timebase") == "song-samples",
            "Verified source layout is required for Logic export.")
    tracks = sorted(bundle["tracks"], key=lambda item: item["order"])
    require(tracks, "No source tracks.")
    media = {}
    for asset in bundle["assets"]:
        pcm = read_pcm(Path(paths[asset["id"]]))
        require(hashlib.sha256(pcm["bytes"]).hexdigest() == asset["sha256"], "Audio hash mismatch.")
        require((pcm["rate"], pcm["channels"], pcm["frames"], len(pcm["bytes"])) ==
                (asset["sampleRate"], asset["channels"], asset["frames"], asset["bytes"]),
                "Audio metadata differs from the manifest.")
        media[asset["id"]] = pcm
    rates = {pcm["rate"] for pcm in media.values()}
    require(len(rates) == 1, "Logic AAF export currently requires one audio sample rate.")
    rate = next(iter(rates))
    require(sum(len(media[r["assetId"]]["bytes"]) for r in bundle["regions"]) <= 280 * 1024 * 1024,
            "Expanded Logic AAF media exceeds the 280 MB limit.")
    plan = []
    for track in tracks:
        regions = []
        for region in bundle["regions"]:
            if region["trackId"] != track["id"]:
                continue
            require(region["start"] is not None and region["offsetFrames"] is not None
                    and region["lengthFrames"] is not None, "Incomplete region placement.")
            start = Fraction(region["start"]["samples"] * rate, region["start"]["sampleRate"])
            require(start.denominator == 1 and start >= 0, "Position cannot be represented exactly.")
            pcm = media[region["assetId"]]
            require(pcm["channels"] == track["channels"], "Track channel count differs from its audio.")
            require(0 <= region["offsetFrames"] < pcm["frames"] and region["lengthFrames"] > 0
                    and region["offsetFrames"] + region["lengthFrames"] <= pcm["frames"], "Invalid source trim.")
            regions.append((int(start), region))
        require(regions, "Empty source track.")
        regions.sort(key=lambda item: item[0])
        end = 0
        for start, region in regions:
            require(start >= end, "Overlapping regions require a qualified layering adapter.")
            end = start + region["lengthFrames"]
        plan.append((track, regions))

    destination = Path(destination)
    require(not destination.exists(), "Destination already exists.")
    try:
        with aaf2.open(str(destination), "w") as project:
            composition = project.create.CompositionMob("Orb Regions")
            composition.usage = "Usage_TopLevel"
            project.content.mobs.append(composition)
            for track, regions in plan:
                slot = composition.create_sound_slot(rate)
                slot.name = track["name"]
                cursor = 0
                for start, region in regions:
                    if start > cursor:
                        slot.segment.components.append(project.create.Filler(media_kind="sound", length=start - cursor))
                    # Logic drops repeated master references sharing one essence.
                    # Give each occurrence its own media identity and keep its trim.
                    named = project.create.MasterMob(region["name"])
                    project.content.mobs.append(named)
                    named_slot = named.import_audio_essence(paths[region["assetId"]], edit_rate=rate)
                    clip = named.create_source_clip(named_slot.slot_id, start=region["offsetFrames"], length=region["lengthFrames"])
                    slot.segment.components.append(clip)
                    cursor = start + region["lengthFrames"]
                slot.segment.length = cursor
    except Exception:
        destination.unlink(missing_ok=True)
        raise
    return {"status": "exported", "tracks": len(plan), "regions": len(bundle["regions"]), "sampleRate": rate}


if __name__ == "__main__":
    job = json.loads(Path(sys.argv[1]).read_text())
    print(json.dumps(write_logic_aaf(job["bundle"], job["paths"], sys.argv[2])))
