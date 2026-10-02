"""Verify imported track channel placement from Logic's own AAF readback."""
from fractions import Fraction
import json
from pathlib import Path
import sys
import aaf2
from proToolsAAF import require
from logicCapture import plain_clip


def verify(bundle, readback):
    with aaf2.open(str(readback), "r") as project:
        compositions = list(project.content.compositionmobs())
        require(len(compositions) == 1, "Ambiguous Logic readback.")
        slots = [s for s in compositions[0].slots if s.segment.media_kind in ("Sound", "LegacySound")]
        for track in bundle["tracks"]:
            regions = sorted((r for r in bundle["regions"] if r["trackId"] == track["id"]),
                             key=lambda r: Fraction(r["start"]["samples"], r["start"]["sampleRate"]))
            suffixes = [""] if track["channels"] == 1 else [" -L", " -R"]
            for suffix in suffixes:
                matches = [s for s in slots if s.name == track["name"] + suffix]
                require(len(matches) == 1, "Missing or duplicate imported Logic track.")
                slot = matches[0]
                require(slot.origin == 0 and isinstance(slot.segment, aaf2.components.Sequence), "Unsupported Logic readback sequence.")
                events = []
                for _, position, segment in slot.segment.positions():
                    if isinstance(segment, aaf2.components.Filler):
                        continue
                    clip = plain_clip(segment)
                    events.append((position, clip.start, segment.length))
                expected = [(Fraction(r["start"]["samples"] * slot.edit_rate, r["start"]["sampleRate"]),
                             r["offsetFrames"], r["lengthFrames"]) for r in regions]
                require(events == expected, "Logic imported regions at different positions or trims. Inspect the session; do not retry automatically.")
    return {"status": "complete", "tracks": len(bundle["tracks"]), "regions": len(bundle["regions"])}


if __name__ == "__main__":
    print(json.dumps(verify(json.loads(Path(sys.argv[1]).read_text())["bundle"], sys.argv[2])))
