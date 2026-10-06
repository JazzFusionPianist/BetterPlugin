import copy
from pathlib import Path
import sys
import unittest

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))
import test_logic_capture as fixtures
from logicCapture import convert
from logicAAF import write_logic_aaf
from logicVerify import verify


class LogicReadbackTests(unittest.TestCase):
    def setUp(self):
        self.fixture = fixtures.LogicCaptureTests()
        self.fixture.setUp()
        self.addCleanup(self.fixture.doCleanups)
        fixture = self.fixture
        self.bundle, asset_paths, audio = convert(fixture.path, fixture.snapshot, fixture.snapshot, fixture.directory)
        self.paths = {}
        for asset_id, name in asset_paths.items():
            destination = fixture.directory / name
            destination.parent.mkdir(exist_ok=True)
            destination.write_bytes(audio[name])
            self.paths[asset_id] = str(destination)

    def readback(self, bundle):
        path = self.fixture.directory / "readback.aaf"
        write_logic_aaf(bundle, self.paths, path)
        return path

    def test_exact_readback_completes(self):
        self.assertEqual(verify(self.bundle, self.readback(self.bundle))["status"], "complete")

    def test_one_sample_error_is_not_success(self):
        changed = copy.deepcopy(self.bundle)
        changed["regions"][0]["start"]["samples"] += 1
        with self.assertRaisesRegex(ValueError, "different positions"):
            verify(self.bundle, self.readback(changed))

    def test_source_trim_error_is_not_success(self):
        changed = copy.deepcopy(self.bundle)
        changed["regions"][0]["offsetFrames"] += 1
        changed["regions"][0]["lengthFrames"] -= 1
        with self.assertRaisesRegex(ValueError, "different positions"):
            verify(self.bundle, self.readback(changed))

    def test_wrong_track_is_not_success(self):
        changed = copy.deepcopy(self.bundle)
        changed["tracks"][0]["name"] += " wrong"
        with self.assertRaisesRegex(ValueError, "Missing"):
            verify(self.bundle, self.readback(changed))


if __name__ == "__main__":
    unittest.main()
