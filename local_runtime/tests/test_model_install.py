import threading
import unittest

from local_runtime.app.model_install import ModelInstallCancelled, ModelInstaller


class ModelInstallerTests(unittest.TestCase):
    def test_cancelled_download_does_not_start_network_transfer(self):
        cancelled = threading.Event()
        cancelled.set()
        with self.assertRaises(ModelInstallCancelled):
            ModelInstaller().download(cancel_event=cancelled, on_progress=lambda _downloaded, _total: None)


if __name__ == "__main__":
    unittest.main()
