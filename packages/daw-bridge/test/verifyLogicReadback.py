"""Opt-in read-only verification of Logic's exported AAF against a bundle.

Usage: python verifyLogicReadback.py logic-export.json Logic-readback.AAF
Uses exact samples, not rounded bars/beats displayed in Logic's UI.
"""
import json
from fractions import Fraction
from pathlib import Path
import sys
import aaf2


def verify(job_path, readback_path):
    bundle = json.loads(Path(job_path).read_text())["bundle"]
    actual = []
    with aaf2.open(readback_path, "r") as project:
        for mob in project.content.compositionmobs():
            for slot in mob.slots:
                if not isinstance(slot.segment, aaf2.components.Sequence):
                    continue
                events = []
                for _, position, segment in slot.segment.positions():
                    if isinstance(segment, aaf2.components.Filler):
                        continue
                    clip = segment
                    if isinstance(clip, aaf2.components.OperationGroup):
                        assert len(clip.segments) == 1, "Ambiguous operation inputs"
                        clip = clip.segments[0]
                    assert isinstance(clip, aaf2.components.SourceClip), "Unexpected timeline component"
                    events.append((position + slot.origin, clip.start, segment.length))
                actual.append((slot.name, Fraction(slot.edit_rate), events))

    matched = []
    for track in bundle["tracks"]:
        regions = sorted((r for r in bundle["regions"] if r["trackId"] == track["id"]),
                         key=lambda r: Fraction(r["start"]["samples"], r["start"]["sampleRate"]))
        channels = [""] if track["channels"] == 1 else [" -L", " -R"]
        for suffix in channels:
            candidates = []
            for name, rate, events in actual:
                expected = [(Fraction(r["start"]["samples"] * rate, r["start"]["sampleRate"]),
                             r["offsetFrames"], r["lengthFrames"]) for r in regions]
                if name == track["name"] + suffix and events == expected:
                    candidates.append(name)
            assert len(candidates) == 1, f"Missing or ambiguous exact readback: {track['name']}{suffix}"
            matched.extend(candidates)
    return {"verified": True, "channelTracks": matched, "regions": len(bundle["regions"]),
            "checks": ["track names", "channel mapping", "sample positions", "source trims", "lengths"]}


if __name__ == "__main__":
    print(json.dumps(verify(*sys.argv[1:]), indent=2))
