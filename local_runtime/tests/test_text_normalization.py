import unittest

from local_runtime.app.text_normalization import normalize_for_speech, sino_number


class KoreanSpeechTextNormalizationTests(unittest.TestCase):
    def test_normalizes_arithmetic_expression(self):
        self.assertEqual(normalize_for_speech('12 * 4 = 48'), '십이 곱하기 사는 사십팔')
        self.assertEqual(normalize_for_speech('12 × 4 = 48.'), '십이 곱하기 사는 사십팔.')

    def test_uses_native_numbers_for_common_counters_and_sino_numbers_for_units(self):
        self.assertEqual(normalize_for_speech('사과 4개와 4명, 4월 4일에 만나요.'), '사과 네 개와 네 명, 사월 사일에 만나요.')
        self.assertEqual(normalize_for_speech('숫자 4를 읽어 주세요.'), '숫자 사를 읽어 주세요.')

    def test_expands_large_and_decimal_numbers(self):
        self.assertEqual(sino_number(48), '사십팔')
        self.assertEqual(normalize_for_speech('3.14'), '삼점일사')

    def test_preserves_versions_and_ascii_identifiers(self):
        self.assertEqual(normalize_for_speech('Qwen3-TTS v0.6B'), 'Qwen3-TTS v0.6B')


if __name__ == '__main__':
    unittest.main()
