import os
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from fastapi import HTTPException
from pydantic import ValidationError
from local_runtime.app.main import GenerationRequest, create_app
from local_runtime.app.expression_worker import MODEL_ID, MODEL_REVISION
from local_runtime.app.jobs import JobStore
from local_runtime.app.storage import LocalRecordingStore, LocalOutputStore
from local_runtime.tests.test_recording_store import wav_bytes


class ExpressionApiTests(unittest.IsolatedAsyncioTestCase):
    async def test_routes_expression_to_isolated_engine_and_persists_settings(self):
        with tempfile.TemporaryDirectory() as directory, patch.dict(os.environ, {'LOCAL_VOICE_DATA_DIR': directory}), \
                patch('local_runtime.app.main.PairingManager') as pairing, \
                patch('local_runtime.app.main.QwenGenerator') as qwen, \
                patch('local_runtime.app.main.ExpressionGenerator') as expression, \
                patch('local_runtime.app.main.memory_available_gib', return_value=16), \
                patch('local_runtime.app.main.ThreadPoolExecutor') as executor:
            pairing.return_value.is_authorized.return_value = True
            expression.return_value.is_installed.return_value = True
            voice = LocalRecordingStore(Path(directory)).save(wav_bytes(), '참조 대본')
            app = create_app()
            endpoint = next(route.endpoint for route in app.routes if getattr(route, 'path', '') == '/api/v1/generations')
            catalog_endpoint = next(route.endpoint for route in app.routes if getattr(route, 'path', '') == '/api/v1/models')
            catalog = await catalog_endpoint(authorization='Bearer test', x_local_request='1')
            candidate = next(item for item in catalog['items'] if item['id'] == MODEL_ID)
            self.assertTrue(candidate['supports_expression'])
            self.assertEqual(candidate['status'], 'installed')
            request = GenerationRequest(recording_id=voice['id'], text='표현이 있는 새 대본', model_id=MODEL_ID, expression_intensity=0.8)
            job = await endpoint(request, authorization='Bearer test', x_local_request='1')
            self.assertEqual(job['expression_intensity'], 0.8)

            def generate(**kwargs):
                kwargs['on_phase']('loading_model')
                kwargs['on_phase']('generating')
                return wav_bytes(), {'model_load_seconds': 1, 'generation_seconds': 2, 'peak_rss_mib': 100}

            expression.return_value.generate.side_effect = generate
            runner, *args = executor.return_value.submit.call_args.args
            runner(*args)
            expression.return_value.generate.assert_called_once()
            self.assertEqual(expression.return_value.generate.call_args.kwargs['intensity'], 0.8)
            qwen.return_value.generate.assert_not_called()
            output = LocalOutputStore(Path(directory)).list()[0]
            self.assertEqual(output['model_id'], MODEL_ID)
            self.assertEqual(output['model_revision'], MODEL_REVISION)
            self.assertEqual(output['expression_intensity'], 0.8)
            self.assertEqual(JobStore(Path(directory)).get(job['id'])['status'], 'completed')

    async def test_qwen_rejects_expression_instead_of_ignoring_it(self):
        with tempfile.TemporaryDirectory() as directory, patch.dict(os.environ, {'LOCAL_VOICE_DATA_DIR': directory}), patch('local_runtime.app.main.PairingManager') as pairing:
            pairing.return_value.is_authorized.return_value = True
            app = create_app()
            endpoint = next(route.endpoint for route in app.routes if getattr(route, 'path', '') == '/api/v1/generations')
            with self.assertRaises(HTTPException) as raised:
                await endpoint(GenerationRequest(recording_id='00000000-0000-4000-8000-000000000001', text='대본', expression_intensity=0.8), authorization='Bearer test', x_local_request='1')
            self.assertEqual(raised.exception.detail['code'], 'expression_not_supported')

    def test_rejects_invalid_intensity_at_request_boundary(self):
        for value in [-0.1, 1.1, True, float('nan')]:
            with self.subTest(value=value), self.assertRaises(ValidationError):
                GenerationRequest(recording_id='00000000-0000-4000-8000-000000000001', text='대본', model_id=MODEL_ID, expression_intensity=value)

    def test_workspace_settings_reject_unsupported_or_ignored_controls(self):
        from local_runtime.app.main import WorkspaceRequest
        for settings in [
            {'model_id': 'unknown'},
            {'model_id': 'qwen3-tts-0.6b-base', 'expression_intensity': .8},
            {'model_id': MODEL_ID, 'expression_intensity': True},
            {'model_id': MODEL_ID, 'expression_intensity': 2},
        ]:
            with self.subTest(settings=settings), self.assertRaises(ValidationError):
                WorkspaceRequest(title='작업', generation_settings=settings)
        request = WorkspaceRequest(title='작업', generation_settings={'model_id': MODEL_ID})
        self.assertEqual(request.generation_settings.expression_intensity, .5)
