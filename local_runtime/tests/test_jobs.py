import tempfile
import unittest
from pathlib import Path

from local_runtime.app.jobs import JobStore


class JobStoreTests(unittest.TestCase):
    def setUp(self):
        self.temp_dir = tempfile.TemporaryDirectory()
        self.store = JobStore(Path(self.temp_dir.name))

    def tearDown(self):
        self.temp_dir.cleanup()

    def test_job_transitions_are_persisted_and_reject_invalid_transition(self):
        job = self.store.create("generation")
        self.store.update(job["id"], status="loading_model")
        self.store.update(job["id"], status="generating")
        self.assertEqual(JobStore(Path(self.temp_dir.name)).get(job["id"])["status"], "generating")
        with self.assertRaises(ValueError):
            self.store.update(job["id"], status="queued")

    def test_job_ids_cannot_be_used_for_path_traversal(self):
        self.assertIsNone(self.store.get("../../etc/passwd"))
        with self.assertRaises(ValueError):
            self.store.update("../../etc/passwd", status="failed")

    def test_download_jobs_can_report_progress_and_finish_or_cancel(self):
        job = self.store.create("model_install")
        self.store.update(job["id"], status="downloading", progress_percent=2.5)
        self.store.update(job["id"], status="downloading", progress_percent=9.0)
        self.assertEqual(self.store.get(job["id"])["progress_percent"], 9.0)
        self.store.update(job["id"], status="cancelled")
        self.assertEqual(self.store.active_count(), 0)

    def test_interrupted_work_is_marked_failed_when_runtime_restarts(self):
        job = self.store.create("generation")
        self.store.update(job["id"], status="loading_model")
        self.store.recover_interrupted()
        recovered = self.store.get(job["id"])
        self.assertEqual(recovered["status"], "failed")
        self.assertEqual(recovered["error_code"], "runtime_restarted")


if __name__ == "__main__":
    unittest.main()
