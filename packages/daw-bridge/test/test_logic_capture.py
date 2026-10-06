import copy
import io
from pathlib import Path
import sys
import tempfile
import unittest
import wave

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))
import aaf2
from logicCapture import convert, selection_tracks, joined_pcm, musical_position


def region(name, selected, start, end):
    return {"AXDescription": name, "AXSelected": selected,
            "AXHelp": f"Region starts at {start}  and ends at {end} , Audio region. An editable object."}


class LogicCaptureTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.directory = Path(self.temp.name)
        self.snapshot = {"version": 1, "pid": 42, "projectId": "file:///private/song.logicx", "tracks": [
            {"AXDescription": "Track 1 \u201cVoice\u201d", "regions": [
                region("First take", False, "1 bar 3 beats 6 ticks", "1 bar 3 beats 3 divisions 166 ticks"),
                region("Second take", True, "2 bars 6 ticks", "2 bars 3 divisions 166 ticks")]}]}
        self.path = self.directory / "capture.aaf"
        self.media = self.directory / "voice.wav"
        with wave.open(str(self.media), "wb") as audio:
            audio.setnchannels(1)
            audio.setsampwidth(3)
            audio.setframerate(48000)
            audio.writeframes(bytes(range(240)) * 1200)
        with aaf2.open(str(self.path), "w") as f:
            source = f.create.SourceMob("Source")
            f.content.mobs.append(source)
            source_slot = source.create_timeline_slot(48000)
            source_slot.segment = f.create.SourceClip(media_kind="Sound", length=96000)
            descriptor = f.create.WAVEDescriptor()
            descriptor["SampleRate"].value = 48000
            descriptor["Length"].value = 96000
            descriptor["Summary"].value = bytearray(self.media.read_bytes()[:44])
            locator = f.create.NetworkLocator()
            locator["URLString"].value = self.media.as_uri()
            descriptor["Locator"].append(locator)
            source.descriptor = descriptor
            master = f.create.MasterMob("Different source filename")
            f.content.mobs.append(master)
            master_slot = master.create_timeline_slot(48000)
            master_slot.segment = source.create_source_clip(source_slot.slot_id, length=96000)
            composition = f.create.CompositionMob("Song")
            f.content.mobs.append(composition)
            slot = composition.create_sound_slot(48000)
            slot.name = "Voice"
            for gap, offset in [(48137, 13), (32000, 24013)]:
                slot.segment.components.append(f.create.Filler(media_kind="Sound", length=gap))
                slot.segment.components.append(master.create_source_clip(master_slot.slot_id, start=offset, length=16000))

    def test_only_selected_occurrences_with_exact_aaf_samples(self):
        bundle, paths, audio = convert(self.path, self.snapshot, self.snapshot, self.directory)
        self.assertEqual(len(bundle["regions"]), 1)
        result = bundle["regions"][0]
        self.assertEqual((result["name"], result["start"]["samples"], result["offsetFrames"], result["lengthFrames"]),
                         ("Second take", 96137, 0, 16000))
        self.assertEqual(bundle["tracks"][0]["name"], "Voice")
        self.assertNotIn("private", bundle["source"]["projectId"])
        with wave.open(str(self.media), "rb") as original, wave.open(io.BytesIO(next(iter(audio.values()))), "rb") as received:
            original.setpos(24013)
            self.assertEqual(received.getnframes(), 16000)
            self.assertEqual(received.readframes(16000), original.readframes(16000))
        self.assertEqual(set(paths.values()), set(audio))

    def test_repeated_region_names_keep_distinct_instances(self):
        for r in self.snapshot["tracks"][0]["regions"]:
            r.update(AXDescription="same take", AXSelected=True)
        bundle, _, _ = convert(self.path, self.snapshot, self.snapshot, self.directory)
        self.assertEqual([r["start"]["samples"] for r in bundle["regions"]], [48137, 96137])
        self.assertEqual(len(bundle["assets"]), 1)

    def test_selection_change_refused(self):
        after = copy.deepcopy(self.snapshot)
        after["tracks"][0]["regions"][0]["AXSelected"] = True
        with self.assertRaisesRegex(ValueError, "changed"):
            convert(self.path, self.snapshot, after, self.directory)

    def test_incomplete_ax_tree_refused(self):
        self.snapshot["tracks"][0]["regions"].pop(0)
        with self.assertRaisesRegex(ValueError, "counts differ"):
            convert(self.path, self.snapshot, self.snapshot, self.directory)

    def test_external_aaf_paths_refused(self):
        with tempfile.TemporaryDirectory() as other:
            with self.assertRaisesRegex(ValueError, "outside"):
                convert(self.path, self.snapshot, self.snapshot, other)

    def test_duplicate_track_names_refused(self):
        self.snapshot["tracks"].append(copy.deepcopy(self.snapshot["tracks"][0]))
        with self.assertRaisesRegex(ValueError, "unique"):
            selection_tracks(self.snapshot)

    def test_empty_new_track_drop_area_is_ignored(self):
        self.snapshot["tracks"].append({"AXRoleDescription": "Track Background", "regions": []})
        self.assertEqual(len(selection_tracks(self.snapshot)), 1)
        bundle, _, _ = convert(self.path, self.snapshot, self.snapshot, self.directory)
        self.assertEqual(len(bundle["regions"]), 1)

    def test_unnamed_populated_track_is_still_refused(self):
        self.snapshot["tracks"][0].pop("AXDescription")
        with self.assertRaisesRegex(ValueError, "track identity"):
            selection_tracks(self.snapshot)

    def test_ambiguous_order_and_overlap_refused(self):
        regions = self.snapshot["tracks"][0]["regions"]
        regions[1]["AXHelp"] = regions[0]["AXHelp"]
        with self.assertRaisesRegex(ValueError, "ambiguous"):
            selection_tracks(self.snapshot)

    def test_midi_not_falsely_treated_as_audio(self):
        self.snapshot["tracks"][0]["regions"][1]["AXHelp"] = "MIDI region."
        with self.assertRaisesRegex(ValueError, "ordinary audio"):
            selection_tracks(self.snapshot)

    def test_stereo_24bit_is_interleaved_in_left_right_order(self):
        right = self.directory / "right.wav"
        with wave.open(str(right), "wb") as audio:
            audio.setnchannels(1)
            audio.setsampwidth(3)
            audio.setframerate(48000)
            audio.writeframes(b"\x10\x20\x30" * 96000)
        result = joined_pcm([{"path": self.media}, {"path": right}])
        with wave.open(io.BytesIO(result["bytes"]), "rb") as audio:
            self.assertEqual(audio.getnchannels(), 2)
            self.assertEqual(audio.readframes(2), b"\x00\x01\x02\x10\x20\x30\x03\x04\x05\x10\x20\x30")

    def test_position_parser_never_guesses_unrecognized_units(self):
        self.assertEqual(musical_position("2 bars 6 ticks"), (2, 1, 1, 6))
        for invalid in ["2.1.1", "2 seconds", "1 bar 2 bars", "0 bars"]:
            with self.assertRaises(ValueError):
                musical_position(invalid)


if __name__ == "__main__":
    unittest.main()
