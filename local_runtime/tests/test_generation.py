import unittest

from pathlib import Path

from local_runtime.app.generation import QwenGenerator, token_budget_for_text


class GenerationBudgetTests(unittest.TestCase):
    def test_short_korean_text_gets_a_bounded_codec_token_budget(self):
        self.assertEqual(token_budget_for_text("안녕하세요."), 128)
        self.assertEqual(token_budget_for_text("안녕하세요. 오늘은 제가 좋아하는 책을 읽어보겠습니다."), 128)

    def test_long_text_budget_is_capped_at_the_model_limit(self):
        self.assertEqual(token_budget_for_text("가" * 2_000), 4_096)

    def test_short_text_budget_is_passed_to_the_loaded_qwen_model(self):
        class ModelStub:
            kwargs = None

            def generate_voice_clone(self, **kwargs):
                self.kwargs = kwargs
                return ([[0.0] * 240], 24_000)

        model = ModelStub()
        generator = QwenGenerator()
        generator._model = model
        phases = []

        audio, _metrics = generator.generate(
            audio_path=Path("reference.wav"),
            transcript="참조 대본",
            text="안녕하세요. 오늘은 제가 좋아하는 책을 읽어보겠습니다.",
            on_phase=phases.append,
        )

        self.assertTrue(audio.startswith(b"RIFF"))
        self.assertEqual(phases, ["loading_model", "generating"])
        self.assertEqual(model.kwargs["max_new_tokens"], 128)


if __name__ == "__main__":
    unittest.main()
