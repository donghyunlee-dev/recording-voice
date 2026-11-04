import threading
import unittest
from types import ModuleType
from unittest.mock import patch

from local_runtime.app.model_install import ModelInstallCancelled, ModelInstaller


class ModelInstallerTests(unittest.TestCase):
    def test_download_progress_reports_without_missing_clock_module(self):
        progress = []

        class FakeProgressBar:
            def __init__(self, *args, total=None, **kwargs):
                self.n = 0
                self.total = total

            def update(self, amount):
                self.n += amount
                return True

        def snapshot_download(**kwargs):
            bar = kwargs["tqdm_class"](total=100)
            bar.update(25)
            return "model-cache-path"

        huggingface_hub = ModuleType("huggingface_hub")
        huggingface_hub.snapshot_download = snapshot_download
        tqdm = ModuleType("tqdm")
        tqdm_auto = ModuleType("tqdm.auto")
        tqdm_auto.tqdm = FakeProgressBar
        tqdm.auto = tqdm_auto

        with patch.dict("sys.modules", {"huggingface_hub": huggingface_hub, "tqdm": tqdm, "tqdm.auto": tqdm_auto}):
            result = ModelInstaller().download(
                cancel_event=threading.Event(),
                on_progress=lambda downloaded, total: progress.append((downloaded, total)),
            )

        self.assertEqual(result, "model-cache-path")
        self.assertEqual(progress[0], (0, 100))

    def test_cancelled_download_does_not_start_network_transfer(self):
        cancelled = threading.Event()
        cancelled.set()
        with self.assertRaises(ModelInstallCancelled):
            ModelInstaller().download(cancel_event=cancelled, on_progress=lambda _downloaded, _total: None)


if __name__ == "__main__":
    unittest.main()
