"""Read-only probe; requires pyaaf2==1.7.1 in a separate test environment."""
import json
import sys
import aaf2

with aaf2.open(sys.argv[1], "r") as project:
    tracks = []
    for mob in project.content.compositionmobs():
        for slot in mob.slots:
            if not isinstance(slot.segment, aaf2.components.Sequence):
                continue
            events = []
            for _, position, segment in slot.segment.positions():
                if isinstance(segment, aaf2.components.Filler):
                    continue
                events.append({"start": position, "length": segment.length,
                               "kind": type(segment).__name__})
            tracks.append({"name": slot.name, "rate": str(slot.edit_rate),
                           "origin": slot.origin, "events": events})
    result = {"tracks": tracks}
    if len(sys.argv) > 2:
        with open(sys.argv[2], encoding="utf-8") as selection_file:
            selection = json.load(selection_file)
        start, end = int(selection["edit"]["in_time"]), int(selection["edit"]["out_time"])
        outside = [event for track in tracks for event in track["events"]
                   if event["start"] < start or event["start"] + event["length"] > end]
        result["selectedRange"] = {"start": start, "end": end}
        result["eventsOutsideSelection"] = outside
        result["exactSelection"] = not outside
    print(json.dumps(result, indent=2))
