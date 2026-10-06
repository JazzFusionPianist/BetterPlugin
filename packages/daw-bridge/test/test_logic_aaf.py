import copy
import hashlib
import io
from pathlib import Path
import sys
import tempfile
import unittest
import wave

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))
import aaf2
from logicAAF import write_logic_aaf


class LogicAAFTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.folder = Path(self.temp.name)
        self.bundle = {"source": {"daw": "fixture"}, "timebase": "song-samples", "tracks": [], "assets": [], "regions": []}
        self.paths = {}
        for channels in (1, 2):
            output = io.BytesIO()
            with wave.open(output, "wb") as audio:
                audio.setnchannels(channels)
                audio.setsampwidth(2)
                audio.setframerate(48000)
                audio.writeframes(bytes(range(256)) * channels * 20)
            data = output.getvalue()
            key = hashlib.sha256(data).hexdigest()
            path = self.folder / f"{channels}.wav"
            path.write_bytes(data)
            self.paths[key] = str(path)
            self.bundle["assets"].append(dict(id=key, sha256=key, bytes=len(data), frames=2560,
                sampleRate=48000, channels=channels, name=path.name))
            self.bundle["tracks"].append(dict(id=str(channels), name=f"Track {channels}", channels=channels, order=channels))
            for i in (0, 1):
                self.bundle["regions"].append(dict(id=f"{channels}-{i}", assetId=key, trackId=str(channels),
                    name=f"Region {channels}-{i}", start=dict(samples=48137 + i * 48000, sampleRate=48000),
                    offsetFrames=13 + i * 1000, lengthFrames=1000))

    def export(self):
        target = self.folder / "regions.aaf"
        write_logic_aaf(self.bundle, self.paths, target)
        return target

    def test_repeated_regions_keep_names_trims_and_independent_media(self):
        with aaf2.open(str(self.export()), "r") as project:
            composition, = list(project.content.compositionmobs())
            self.assertEqual([slot.name for slot in composition.slots], ["Track 1", "Track 2"])
            seen = []
            for slot in composition.slots:
                self.assertEqual(slot.edit_rate, 48000)
                cursor = 0
                for part in slot.segment.components:
                    if isinstance(part, aaf2.components.SourceClip):
                        seen.append((slot.name, part.mob.name, cursor, part.start, part.length))
                    cursor += part.length
            self.assertEqual(seen, [(f"Track {c}", f"Region {c}-{i}", 48137+i*48000, 13+i*1000, 1000)
                                    for c in (1, 2) for i in (0, 1)])
            sources = list(project.content.sourcemobs())
            self.assertEqual(len(sources), 4)
            for source in sources:
                pcm = source.essence.open("r").read()
                channels = source.descriptor["Channels"].value
                self.assertEqual(pcm, bytes(range(256)) * channels * 20)

    def test_bad_hash_does_not_write_output(self):
        self.bundle["assets"][0]["sha256"] = "0" * 64
        with self.assertRaisesRegex(ValueError, "hash"):
            self.export()
        self.assertFalse((self.folder / "regions.aaf").exists())

    def test_24_bit_pcm_is_unchanged(self):
        for asset in self.bundle["assets"]:
            with wave.open(self.paths[asset["id"]], "wb") as audio:
                audio.setnchannels(asset["channels"])
                audio.setsampwidth(3)
                audio.setframerate(48000)
                audio.writeframes(bytes(range(256)) * asset["channels"] * 30)
            data = Path(self.paths[asset["id"]]).read_bytes()
            asset.update(bytes=len(data), sha256=hashlib.sha256(data).hexdigest())
        with aaf2.open(str(self.export()), "r") as project:
            for source in project.content.sourcemobs():
                self.assertEqual(source.descriptor["QuantizationBits"].value, 24)
                self.assertEqual(source.essence.open("r").read(),
                                 bytes(range(256)) * source.descriptor["Channels"].value * 30)

    def test_mixed_sample_rates_rejected(self):
        asset = self.bundle["assets"][0]
        with wave.open(self.paths[asset["id"]], "wb") as audio:
            audio.setnchannels(1)
            audio.setsampwidth(2)
            audio.setframerate(44100)
            audio.writeframes(bytes(range(256)) * 20)
        data = Path(self.paths[asset["id"]]).read_bytes()
        asset.update(sampleRate=44100, bytes=len(data), sha256=hashlib.sha256(data).hexdigest())
        with self.assertRaisesRegex(ValueError, "one audio sample rate"):
            self.export()

    def test_unknown_source_rejected(self):
        self.bundle["source"] = None
        with self.assertRaisesRegex(ValueError, "Verified source"):
            self.export()

    def test_unsupported_placements_rejected(self):
        original = copy.deepcopy(self.bundle)
        for start in (None, dict(samples=-1, sampleRate=48000), dict(samples=1, sampleRate=44100)):
            self.bundle = copy.deepcopy(original)
            self.bundle["regions"][0]["start"] = start
            with self.subTest(start=start), self.assertRaises(ValueError):
                self.export()

    def test_overlap_rejected(self):
        self.bundle["regions"][1]["start"]["samples"] = 48138
        with self.assertRaisesRegex(ValueError, "Overlapping"):
            self.export()

    def test_channel_mismatch_rejected(self):
        self.bundle["tracks"][0]["channels"] = 2
        with self.assertRaisesRegex(ValueError, "channel"):
            self.export()

    def test_existing_export_is_preserved(self):
        target = self.export()
        before = target.read_bytes()
        with self.assertRaisesRegex(ValueError, "already exists"):
            self.export()
        self.assertEqual(before, target.read_bytes())


if __name__ == "__main__":
    unittest.main()
