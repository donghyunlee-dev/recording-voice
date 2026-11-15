import asyncio
import os
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from fastapi import HTTPException
from local_runtime.app.jobs import JobStore
from local_runtime.app.main import GenerationRequest, create_app
from local_runtime.app.storage import LocalRecordingStore
from local_runtime.tests.test_recording_store import wav_bytes


class GenerationAdmissionTests(unittest.IsolatedAsyncioTestCase):
    async def test_overlapping_requests_admit_one_job_and_accept_again_after_failure(self):
        with tempfile.TemporaryDirectory() as directory, patch.dict(os.environ, {'LOCAL_VOICE_DATA_DIR': directory}), \
                patch('local_runtime.app.main.PairingManager') as pairing, \
                patch('local_runtime.app.main.QwenGenerator') as generator, \
                patch('local_runtime.app.main.ThreadPoolExecutor') as executor:
            pairing.return_value.is_authorized.return_value = True
            generator.return_value.is_installed.return_value = True
            generator.return_value.is_loaded = True
            recording = LocalRecordingStore(Path(directory)).save(wav_bytes(), '참조 녹음')
            app = create_app()
            endpoint = next(route.endpoint for route in app.routes if getattr(route, 'path', '') == '/api/v1/generations')
            payload = GenerationRequest(recording_id=recording['id'], text='반복 제작 대본')

            async def submit():
                try:
                    return await endpoint(payload, authorization='Bearer test', x_local_request='1')
                except HTTPException as error:
                    return error

            results = await asyncio.gather(*(submit() for _ in range(10)))
            accepted = [result for result in results if isinstance(result, dict)]
            rejected = [result for result in results if isinstance(result, HTTPException)]
            self.assertEqual(len(accepted), 1)
            self.assertEqual(len(rejected), 9)
            self.assertTrue(all(error.status_code == 409 and error.detail['code'] == 'generation_already_running' for error in rejected))
            executor.return_value.submit.assert_called_once()
            store = JobStore(Path(directory))
            self.assertEqual(len(store.list()), 1)
            store.update(accepted[0]['id'], status='failed', error_code='generation_failed')
            retry = await submit()
            self.assertIsInstance(retry, dict)
            self.assertNotEqual(retry['id'], accepted[0]['id'])
            self.assertEqual(executor.return_value.submit.call_count, 2)
            self.assertEqual(store.active_count(), 1)
