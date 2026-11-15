import tempfile
import unittest
from pathlib import Path
from local_runtime.app.workspaces import WorkspaceStore, WorkspaceError


class WorkspaceTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.store = WorkspaceStore(Path(self.temp.name))

    def test_work_survives_store_restart_and_updates_preserve_identity(self):
        work = self.store.create('광고 내레이션')
        saved = self.store.update(work['id'], title='새 제목', text='안녕하세요', recording_id=None)
        reopened = WorkspaceStore(Path(self.temp.name)).get(work['id'])
        self.assertEqual(reopened, saved)
        self.assertEqual(reopened['created_at'], work['created_at'])
        self.assertEqual(reopened['text'], '안녕하세요')

    def test_final_selection_only_accepts_an_output_from_this_work(self):
        work = self.store.create('작업')
        with self.assertRaises(WorkspaceError):
            self.store.select_output(work['id'], {'id': 'other', 'workspace_id': 'wrong'})
        selected = self.store.select_output(work['id'], {'id': 'result', 'workspace_id': work['id']})
        self.assertEqual(selected['selected_output_id'], 'result')
        self.assertEqual(self.store.update(work['id'], title='수정', text='다음 버전', recording_id=None)['selected_output_id'], 'result')

    def test_invalid_ids_and_blank_titles_are_rejected(self):
        with self.assertRaises(WorkspaceError):
            self.store.get('../../escape')
        with self.assertRaises(WorkspaceError):
            self.store.create('  ')

    def test_generation_settings_survive_restart_and_legacy_updates(self):
        work = self.store.create('표현 작업')
        self.store.update(work['id'], title='표현 작업', text='대본', recording_id=None,
                          generation_settings={'model_id': 'chatterbox-multilingual-v2', 'expression_intensity': 0.8})
        reopened = WorkspaceStore(Path(self.temp.name))
        saved = reopened.update(work['id'], title='제목 변경', text='새 대본', recording_id=None)
        self.assertEqual(saved['generation_settings'], {'model_id': 'chatterbox-multilingual-v2', 'expression_intensity': 0.8})
        replaced = reopened.update(work['id'], title='제목 변경', text='새 대본', recording_id=None,
                                   generation_settings={'model_id': 'qwen3-tts-0.6b-base'})
        self.assertEqual(replaced['generation_settings'], {'model_id': 'qwen3-tts-0.6b-base'})
