import io
from pathlib import Path
import sys
import tempfile
import unittest
import wave

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))
import aaf2
from proToolsAAF import GAIN, LEVEL, LINEAR, authorized_media_path, integer, read_pcm, source_clip


def wav(samples, channels=1, width=2):
    output = io.BytesIO()
    with wave.open(output, "wb") as audio:
        audio.setnchannels(channels)
        audio.setsampwidth(width)
        audio.setframerate(48000)
        audio.writeframes(samples)
    return output.getvalue()


class AudioCaptureTests(unittest.TestCase):
    def test_mono_pcm_is_unchanged(self):
        data = wav(bytes([1, 2, 3, 4]))
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "original.wav"
            path.write_bytes(data)
            parsed = read_pcm(path)
            self.assertEqual(parsed["channels"], 1)
            self.assertEqual(parsed["bytes"], data)

    def test_stereo_24bit_channel_order(self):
        data = wav(bytes(range(12)), channels=2, width=3)
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "stereo.wav"
            path.write_bytes(data)
            parsed = read_pcm(path)
            self.assertEqual(parsed["channels"], 2)
            self.assertEqual(parsed["frames"], 2)
            self.assertEqual(parsed["bytes"], data)

    def test_unlisted_and_ambiguous_media_refused(self):
        item = {"path": "/some/audio.wav", "file_id": "id", "info": {"is_online": True}}
        for locator, allowed in [("/unrelated/audio.wav", [item]), (item["path"], [item, item])]:
            with self.assertRaisesRegex(ValueError, "uniquely authorized"):
                authorized_media_path(locator, allowed)

    def test_volume_prefixed_authorized_path(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "media.wav"
            path.write_bytes(wav(bytes(4)))
            item = {"path": str(path), "file_id": "id", "info": {"is_online": True}}
            self.assertEqual(authorized_media_path("/Macintosh HD" + str(path), [item]), path)

    def test_fractional_negative_and_unsafe_positions_refused(self):
        for value in [-1, 1.5, 2**53]:
            with self.subTest(value=value), self.assertRaises(ValueError):
                integer(value)
        self.assertEqual(integer(137), 137)

    def test_truncated_wave_refused(self):
        data = wav(bytes(4))
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "truncated.wav"
            path.write_bytes(data[:-2])
            with self.assertRaisesRegex(ValueError, "Truncated"):
                read_pcm(path)

    def test_only_unity_gain_can_be_unwrapped(self):
        with aaf2.open() as project:
            parameter = project.create.ParameterDef(LEVEL, "Amplitude", typedef="Rational")
            operation = project.create.OperationDef(GAIN, "MonoAudioGain")
            operation.media_kind = "Sound"
            operation.number_inputs = 1
            operation.parameters.append(parameter)
            interpolation = project.create.InterpolationDef(LINEAR, "Linear")
            for definition in [parameter, operation, interpolation]:
                project.dictionary.register_def(definition)
            gain = project.create.VaryingValue(parameter, interpolation)
            gain.add_keyframe(0, 1)
            gain.add_keyframe(1, 1)
            clip = project.create.SourceClip(media_kind="Sound", length=16000)
            group = project.create.OperationGroup(operation, media_kind="Sound", length=16000)
            group.segments.append(clip)
            group.parameters.append(gain)
            self.assertIs(source_clip(group), clip)
            gain.add_keyframe(1, 0)
            with self.assertRaisesRegex(ValueError, "gain/fades"):
                source_clip(group)

    def test_nested_sequence_refused(self):
        with aaf2.open() as project:
            with self.assertRaisesRegex(ValueError, "Unsupported region"):
                source_clip(project.create.Sequence(media_kind="Sound", length=1))


if __name__ == "__main__":
    unittest.main()
