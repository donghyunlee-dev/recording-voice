from __future__ import annotations

import re


_DIGITS = ('영', '일', '이', '삼', '사', '오', '육', '칠', '팔', '구')
_SMALL_UNITS = ('', '십', '백', '천')
_LARGE_UNITS = ('', '만', '억', '조')
_NATIVE = {
    1: '한', 2: '두', 3: '세', 4: '네', 5: '다섯', 6: '여섯', 7: '일곱', 8: '여덟', 9: '아홉',
    10: '열', 11: '열한', 12: '열두', 13: '열세', 14: '열네', 15: '열다섯', 16: '열여섯',
    17: '열일곱', 18: '열여덟', 19: '열아홉', 20: '스무',
}
_NATIVE_TENS = {20: '스물', 30: '서른', 40: '마흔', 50: '쉰', 60: '예순', 70: '일흔', 80: '여든', 90: '아흔'}
_NATIVE_ONES = {1: '한', 2: '두', 3: '세', 4: '네', 5: '다섯', 6: '여섯', 7: '일곱', 8: '여덟', 9: '아홉'}
_COUNTERS = re.compile(r'(개|명|마리|권|잔|병|대|장|살|번|가지|곳|줄|켤레|그루|송이|시)')
_SINO_UNITS = re.compile(r'(초|분|월|년|일|원|퍼센트|도|층|호|회|주|시간|킬로그램|킬로미터|미터|센티미터|그램|kg|km|cm|mm|m|g|%)', re.IGNORECASE)
_ARITHMETIC = re.compile(r'^\s*(\d+)\s*([*×x+−\-/÷])\s*(\d+)\s*=\s*(\d+)\s*([.!?。]?)\s*$')
_NUMBER_WITH_UNIT = re.compile(r'(?<![\w.])(\d[\d,]*(?:\.\d+)?)(\s*)(%|[가-힣]+|[a-zA-Z]+)?')


def _sino_group(value: int) -> str:
    if value == 0:
        return ''
    digits = str(value)
    spoken = []
    for index, digit in enumerate(digits):
        number = int(digit)
        unit = len(digits) - index - 1
        if number:
            if number != 1 or unit == 0:
                spoken.append(_DIGITS[number])
            spoken.append(_SMALL_UNITS[unit])
    return ''.join(spoken)


def sino_number(value: int) -> str:
    if value == 0:
        return '영'
    if value < 0 or value >= 10**16:
        return str(value)
    groups = []
    while value:
        groups.append(value % 10_000)
        value //= 10_000
    parts = []
    for index in range(len(groups) - 1, -1, -1):
        group = groups[index]
        if group:
            group_text = '' if index == 1 and group == 1 else _sino_group(group)
            parts.append(group_text + _LARGE_UNITS[index])
    return ''.join(parts)


def native_counter_number(value: int) -> str | None:
    if value in _NATIVE:
        return _NATIVE[value]
    if value < 21 or value > 99:
        return None
    tens = value // 10 * 10
    ones = value % 10
    return _NATIVE_TENS[tens] + (_NATIVE_ONES[ones] if ones else '')


def _spoken_number(number: str, following: str) -> str:
    compact = number.replace(',', '')
    if '.' in compact:
        integer, fraction = compact.split('.', 1)
        return sino_number(int(integer)) + '점' + ''.join(_DIGITS[int(digit)] for digit in fraction)
    value = int(compact)
    if _COUNTERS.match(following):
        native = native_counter_number(value)
        if native:
            return native
    return sino_number(value)


def normalize_for_speech(text: str) -> str:
    """Expand common Korean numerals and simple equations for TTS input."""
    def equation(match: re.Match[str]) -> str:
        left, operator, right, result, punctuation = match.groups()
        operator_text = {'*': '곱하기', '×': '곱하기', 'x': '곱하기', '+': '더하기', '-': '빼기', '−': '빼기', '/': '나누기', '÷': '나누기'}[operator]
        return f'{sino_number(int(left))} {operator_text} {sino_number(int(right))}는 {sino_number(int(result))}{punctuation}'

    match = _ARITHMETIC.fullmatch(text)
    if match:
        return equation(match)

    def expand(match: re.Match[str]) -> str:
        number, spacing, following = match.groups()
        following = following or ''
        # Preserve numeric identifiers and versions instead of guessing their reading.
        if following and following[0].isascii() and following[0].isalpha():
            return match.group(0)
        unit = '퍼센트' if following == '%' else following
        word_gap = ' ' if not spacing and _COUNTERS.match(following) else ''
        return _spoken_number(number, following) + (spacing or word_gap) + unit

    return _NUMBER_WITH_UNIT.sub(expand, text)
