# 로컬 개인 목소리 오디오북 PoC — 개발 PRD

> 문서 상태: 개발 착수용 / 기준일: 2026-11-02
> 대상: Windows PC, RAM 16GB, 내장 그래픽(GPU 가속 없음), 로컬 개발
> 구현 담당: Codex / 사용자 검증: 실제 본인 녹음과 한국어 문장
> 핵심 원칙: **가입·API Key·유료 API·클라우드 GPU 없이, 작은 성공을 먼저 검증한다.**
>
> 실행 환경 변경(2026-11-02): 사용자가 Linux 개발 및 Linux 브라우저 테스트를 지시했다. 아래 Windows 설치 명령은 현재 실행 절차에 적용하지 않으며, 저장소 `README.md`의 Linux 명령을 사용한다.
>
> 제품 범위 변경(2026-11-03): 사용자가 한국어 전문 녹음 UI를 Vercel 정적 사이트로 제공하고, 각 PC에 설치한 로컬 런타임/모델로 녹음과 합성을 처리하도록 요청했다. 기존의 공식 Gradio UI 우선, 커스텀 UI 제외, API 제외 및 Vercel 미사용 조건은 이 변경에서 대체된다. 상세 기준과 단계별 게이트는 [로컬 음성 녹음 스튜디오 설계](./LOCAL_VOICE_STUDIO_DESIGN.md) 및 [구현 계획](../superpowers/plans/2026-11-03-local-voice-studio.md)을 따른다. 본 PRD의 개인 데이터 로컬 보관, 외부 추론 API 금지, Qwen CPU PoC 결과와 미검증 품질 기준은 기준/제약으로 계속 보존한다.

## 프로젝트 목표

사용자가 본인 목소리 샘플(WAV 등)과 해당 녹음의 정확한 텍스트를 제공하고, 별도로 책의 한국어 문장을 입력하면 PC에서 오픈소스 모델로 음성을 생성하여 재생·저장할 수 있는 로컬 PoC를 만든다.

최초 목표는 **책 전체 생성이 아니라 본인 목소리로 한국어 2~3문장을 읽는 WAV 파일 1개 생성**이다. 이것이 성공하면 문단 분리, 여러 파일 순차 생성, 책 단위 저장으로 확장한다.

### 성공 판정

- 사용자는 외부 서비스 가입, API Key 발급, 결제 없이 설치할 수 있다(공개 파일 다운로드가 가능한 일반 네트워크 전제).
- 로컬 `127.0.0.1` 주소에서 UI를 열 수 있다. 별도 React/Spring Boot는 만들지 않는다.
- 본인 음성 파일과 그 녹음의 정확한 발화 텍스트를 지정할 수 있다.
- 한국어 텍스트를 입력해 실제로 생성된 파일을 재생하고 로컬에 보존할 수 있다.
- 실패하면 에러 원인(메모리 부족, 다운로드 문제, 미지원 연산 등)을 로그에서 확인한다.
- **성능/음질은 검증 전 합격으로 간주하지 않는다.** 특히 Windows CPU/16GB의 구동은 공식 GPU 예제와 달라 보장되지 않는다.

## 범위와 제외 항목

| 구분 | 이번 PoC | 추후 |
|---|---|---|
| 본인 목소리 복제 | 포함 | 다중 프로필 |
| 한국어 짧은 문장 합성 | 포함 | 장편 오디오북 |
| Gradio 기반 로컬 UI | 공식 데모 우선 | 커스텀 UI |
| 음성 파일 저장 | 포함 | 사용자별 라이브러리 |
| 텍스트 파일 입력 | 기본 합성 성공 후 선택 | EPUB/PDF 파서 |
| 문단별 일괄 생성 | 기본 합성 성공 후 선택 | Job Queue/재시도 |
| 자동 감정 해석 | 제외 | 별도 모델/규칙 검증 |
| DB, REST API, 인증, Docker | 제외 | 서비스 전환 시 |
| 외부 음성 API, 계정/Key | 사용 금지 | 별도 결정 필요 |

**주의:** Qwen3-TTS **Base** 모델은 음성 복제용이다. `VoiceDesign` / `CustomVoice`의 지시형 감정 제어를 Base 모델에 있다고 가정해서 구현하지 않는다. 참고 음성의 표현과 합성 결과를 비교하는 선에서 평가한다.

## 검증된 공식 자료

- 공식 소스/실행 가이드: https://github.com/QwenLM/Qwen3-TTS
- 0.6B Base 체크포인트: https://huggingface.co/Qwen/Qwen3-TTS-12Hz-0.6B-Base
- 공식 패키지: `qwen-tts`, CLI: `qwen-tts-demo`
- 모델 라이선스: Apache-2.0(재배포·상용화 시 원문 준수)

공식 문서는 Python 3.12 독립 환경을 권장하고, 웹 데모 실행 예시에 **1.7B Base**를 사용한다. 본 PRD의 **0.6B Base + Windows CPU** 실행 방식은 동일 인터페이스를 적용한 **검증 과제**이지 공식 성능 보장 조합이 아니다. 설치가 되어도 CPU 추론 실패·장시간 대기·RAM 부족이 발생할 수 있다. 공식 예제의 `cuda:0`, `bfloat16`, `flash_attention_2` 설정을 CPU에 복사하지 않는다.

## 목표 개발 환경

- OS: Windows 10/11 64비트
- RAM: 16GB / GPU: 내장 그래픽
- Python: **3.12 64비트 우선**(버전 충돌 시 실제 공식 요구사항 확인)
- 터미널: PowerShell / IDE: IntelliJ 또는 VS Code 등 무관
- 모델: `Qwen/Qwen3-TTS-12Hz-0.6B-Base`
- 실행 엔진: PyTorch CPU, `float32` 우선
- UI: 공식 Gradio 데모(`qwen-tts-demo`) 우선
- 저장: 프로젝트 디렉터리의 `inputs/`, `outputs/` (개인 데이터는 Git 제외)
- 디스크: 모델·의존성 캐시용 충분한 여유 공간 확보(우선 15GB 이상 여유 권장, 보장된 최소치 아님)
- 외부 연결: 최초 Python 패키지와 공개 모델 다운로드시에만 필요; 다운로드 후 로컬 추론 단계에서는 별도 외부 API를 호출하지 않아야 함

## Codex 실행 규칙

1. 이 PRD를 먼저 읽고, 사용자의 PC 정보 또는 실행 결과가 제공되지 않은 부분은 임의로 성공 처리하지 않는다.
2. **TDD:** 기능 구현 전 파일 처리·문단 분할·경로 검증 등의 단위 테스트부터 작성한다. 실제 모델 품질은 자동 테스트로 성공을 꾸미지 않고 사용자 음성으로 수동 검증한다.
3. SOLID/단순한 구조를 지키고 필요 없는 추상화, DB, 서버, 프런트 프레임워크를 추가하지 않는다.
4. 먼저 **공식 데모 실행 성공 여부**를 확인한다. 공식 UI가 목적을 충족하면 맞춤 UI를 구현하지 않는다.
5. 공식 데모가 CPU 실행에 실패하면 원인과 로그를 분석하고, CPU용 최소 Python 스크립트를 검증한다. 그래도 실패하면 성공한 척하거나 무단으로 클라우드/유료 서비스를 전환하지 않는다.
6. 사용자의 음성 파일을 인터넷에 업로드하지 않는다. 공개 모델 다운로드만 허용한다.
7. 기능 추가와 리팩토링을 구분하고, 리팩토링이 필요하면 계획과 근거를 사용자에게 먼저 제시한다.
8. 각 단계 결과를 `RUN_LOG.md`에 실행 명령, 환경 버전, 걸린 시간, 실제 성공/실패와 로그 경로로 기록한다.
9. 설치 버전과 코드가 공식 문서와 다르면 문서를 재검증한 뒤 차이를 명시한다.
10. 라이선스/음성 사용 권한을 준수한다. 본인 또는 명시적으로 허가받은 목소리만 사용한다.

## 실행 계획 — 가장 먼저 공식 데모 검증

### 작업 환경 확인

PowerShell에서 실행한다.

```powershell
Get-ComputerInfo | Select-Object WindowsProductName, OsArchitecture, CsTotalPhysicalMemory
py --list-paths
Get-Command python -ErrorAction SilentlyContinue
Get-PSDrive C
```

Python 3.12 64비트가 없다면 공식 python.org 설치 파일로 설치한다. 설치 자체에는 회원가입이 필요하지 않다. CPU 모델 추론이 느릴 수 있으니 다른 고용량 앱을 종료한다.

### 프로젝트 생성

```powershell
mkdir C:\local-voice-book
cd C:\local-voice-book
py -3.12 -m venv .venv
.\.venv\Scripts\Activate.ps1
python --version
python -m pip install --upgrade pip
```

PowerShell 실행 정책 오류가 난다면 정책을 전역 변경하지 말고 아래 명령으로 venv의 Python을 직접 사용한다.

```powershell
.\.venv\Scripts\python.exe -m pip --version
```

아래 명령의 `python`은 활성화된 venv를 전제한다. 활성화하지 않았다면 `.\.venv\Scripts\python.exe`로 대체한다.

### CPU 전용 PyTorch 설치

```powershell
python -m pip install torch torchaudio --index-url https://download.pytorch.org/whl/cpu
python -c "import torch; print('torch=',torch.__version__); print('CUDA=',torch.cuda.is_available())"
```

기대: `CUDA=False`. **`flash-attn`은 설치하지 않는다.**

### 공식 Qwen3-TTS 패키지 설치

```powershell
python -m pip install -U qwen-tts soundfile
python -m pip check
qwen-tts-demo --help
```

의존성 설치 과정에서 PyTorch가 CPU 아닌 빌드로 재설치되는지 확인한다. 문제가 생기면 설치 로그를 남기고 CPU 빌드를 재설치한 다음 `pip check`를 다시 실행한다. **의존성을 무작정 강제 다운그레이드하지 않는다.**

### 공식 로컬 웹 데모 시작

```powershell
qwen-tts-demo Qwen/Qwen3-TTS-12Hz-0.6B-Base --ip 127.0.0.1 --port 8000
```

브라우저에서 `http://127.0.0.1:8000`에 접속한다. 최초 실행은 공개 모델 체크포인트 다운로드가 필요하며 용량과 네트워크 상황에 따라 오래 걸릴 수 있다. 모델 다운로드가 성공했다고 추론까지 성공한 것은 아니다. `--ip 0.0.0.0`으로 외부 공개하지 않는다.

**CPU 경로 실패 시:** CLI의 실제 옵션(`--help`), Python stack trace, PyTorch 버전, 프로세스 RAM 사용량을 확인한다. 공식 데모가 CUDA를 강제하거나 CPU 메모리가 부족하면 아래 백업 경로를 진행한다. 브라우저 마이크 녹음이 문제면 별도 WAV 파일을 먼저 녹음해 업로드한다.

## 백업 경로 — CPU 최소 스크립트

공식 데모가 실행되지 않을 때만 진행한다. 아래 예제는 **CPU 실행 가능성을 확인하기 위한 시도**이며, 특정 라이브러리 버전에서 추가 수정이 필요할 수 있다.

프로젝트의 `smoke_cpu.py` 예제:

```python
from pathlib import Path
import time
import torch
import soundfile as sf
from qwen_tts import Qwen3TTSModel

MODEL_ID = "Qwen/Qwen3-TTS-12Hz-0.6B-Base"
ref_audio = Path("inputs/my_voice.wav")
ref_text_path = Path("inputs/my_voice.txt")
out_path = Path("outputs/smoke.wav")

assert ref_audio.is_file(), f"Missing audio: {ref_audio}"
assert ref_text_path.is_file(), f"Missing transcript: {ref_text_path}"
ref_text = ref_text_path.read_text(encoding="utf-8").strip()
assert ref_text, "Empty reference transcript"
out_path.parent.mkdir(parents=True, exist_ok=True)

start = time.perf_counter()
model = Qwen3TTSModel.from_pretrained(
    MODEL_ID,
    device_map="cpu",
    dtype=torch.float32,
    attn_implementation="sdpa",
)
print(f"model load seconds: {time.perf_counter() - start:.1f}")
start = time.perf_counter()
wavs, sr = model.generate_voice_clone(
    text="안녕하세요. 오늘은 제가 좋아하는 책을 읽어보겠습니다.",
    language="Korean",
    ref_audio=str(ref_audio),
    ref_text=ref_text,
)
sf.write(str(out_path), wavs[0], sr)
print(f"generated: {out_path}, sample_rate={sr}, seconds={time.perf_counter()-start:.1f}")
```

실행:

```powershell
mkdir inputs, outputs -ErrorAction SilentlyContinue
python smoke_cpu.py
```

주의: 실제 `from_pretrained`가 사용 중인 패키지에서 `dtype` 또는 `attn_implementation="sdpa"`를 수용하지 않는다면 **해당 설치 버전의 메서드 시그니처/공식 예제에 맞춰 수정**하고 변경 이유를 로그에 적는다. CPU가 정상 동작하지 않는 경우 기술적 한계를 명시하고 중단한다. 무리하게 모델 가중치를 수정하거나 임의의 외부 API로 대체하지 않는다.

## 실제 음성 파일 준비

- 본인 목소리를 조용한 장소에서 **10~20초 정도** 선명하게 녹음한다.
- 기계음, 배경 음악, 타인 음성, 과도한 에코를 피한다.
- 가능한 WAV 파일 사용. 휴대폰 M4A만 있으면 로컬 변환 후 입력한다.
- 말한 내용과 **정확히 일치하는 텍스트**를 UTF-8로 `inputs/my_voice.txt`에 저장한다.
- 음성 파일 이름은 `inputs/my_voice.wav`로 한다.
- `ref_text`를 임의의 다른 문장으로 작성하지 않는다.
- 최초 합성 문장은 40~70자 정도의 평이한 한국어로 시작한다.

예시 낭독 텍스트(사용자가 직접 테스트에 활용 가능):

> 안녕하세요. 오늘은 제가 좋아하는 책을 읽어보겠습니다. 조용한 밤, 작은 창문 너머로 바람이 불어왔습니다.

샘플 녹음은 개인 정보이므로 Git에 커밋하거나 공개 저장소로 전송하지 않는다.

## 사용자 경험 및 기능 요구

### 필수 흐름

1. 로컬 UI 실행.
2. 본인 목소리 업로드(또는 브라우저 녹음이 작동하면 직접 녹음).
3. 녹음 원문 텍스트 입력.
4. 낭독할 한국어 문장 입력.
5. Voice Clone 실행.
6. 생성된 음성을 플레이어에서 재생하고 WAV로 저장.
7. 작업 실패 시 사용자에게 에러를 보여주며 파일이나 설정을 잃지 않음.

### 확장 기능(필수 흐름 성공 후에만)

- 텍스트 파일(.txt) 등록; UTF-8 인코딩 우선, 입력 글자 수 확인.
- 빈 줄 기준 문단 분리 및 너무 긴 문단은 문장 경계에서 나누기.
- 같은 음성 샘플 재사용; 지원하면 `create_voice_clone_prompt`로 특성 재추출 방지.
- 문단별 WAV 출력 및 파일명 순서 보장(`0001.wav` 형식).
- 문단 처리 진행 상태 및 실패 문단 식별.
- WAV 이어붙이기 전에 샘플레이트/채널 수 일치 확인, 다른 경우 안전하게 리샘플링하거나 명확히 실패.
- 책 전체 생성을 한 번에 시작하지 말고 사용자가 문단 1~3개를 먼저 검증하도록 안내.
- 결과가 불만족스러운 문단만 재생성.

### 감정 연기 제한

이번 버전에서는 감정 분석이나 낭독 톤 자동 지정 기능을 **구현하지 않는다**. Base 모델에 감정 프롬프트 API가 있다고 가정하지 않는다. 참고 음성 자체의 분위기·발화 방식과 출력 결과를 사용자가 평가한다. 정교한 슬픔/기쁨/긴장 연기 및 장문 감정 일관성은 후속 연구 항목으로 유지한다.

## 권장 프로젝트 구조

```text
local-voice-book/
├── PRD_LOCAL_VOICE_BOOK_POC.md
├── README.md
├── RUN_LOG.md
├── .gitignore
├── requirements.txt                # 설치 후 검증된 버전을 기록
├── smoke_cpu.py                    # 데모 실패 시에만 추가
├── inputs/                         # 비공개 음성/참고 텍스트
│   ├── .gitkeep
│   ├── my_voice.wav
│   └── my_voice.txt
├── outputs/                        # 생성된 음성
│   └── smoke.wav
├── src/                            # 확장 기능이 필요할 때만 생성
│   ├── text_splitter.py
│   └── audio_export.py
└── tests/                          # 확장 기능의 단위 테스트
    ├── test_text_splitter.py
    └── test_audio_export.py
```

`.gitignore` 예시:

```gitignore
.venv/
__pycache__/
.pytest_cache/
inputs/*
!inputs/.gitkeep
outputs/*
!outputs/.gitkeep
*.wav
*.mp3
*.flac
*.m4a
.env
```

## 테스트 계획

### 환경 테스트 (자동)

- Python이 64비트인지, 버전은 무엇인지 기록.
- `import torch`, `import qwen_tts`, `import soundfile` 성공.
- `torch.cuda.is_available() == False` 확인.
- `pip check` 오류 여부 확인.
- 모델 다운로드/로드 시 실패하면 오류와 메모리 점유를 기록.

### 기능 단위 테스트 (확장 단계에서 TDD)

먼저 실패하는 테스트를 작성하고 최소 구현을 추가한다.

| 테스트 | 기대 결과 |
|---|---|
| 빈 텍스트 | 유효성 검사 오류 |
| 여러 빈 줄 | 빈 문단 제거 |
| 한국어 문장 구분 | 글자 유실 없이 순서 보존 |
| 과도하게 긴 문단 | 문장 경계 우선 분할 |
| 입력 파일 없음 | 명확한 오류 |
| 출력 디렉터리 없음 | 안전하게 생성 |
| 음성 샘플레이트 상이 | 올바른 처리 또는 명시적 오류 |
| 중복 생성 | 이전 파일 조용히 덮어쓰지 않음 |

테스트 실행(확장 기능 도입 시):

```powershell
python -m pip install pytest
python -m pytest -q
```

외부 모델과 GPU를 가짜로 흉내 내서 실제 음성 성공을 보증하지 않는다. 모델 추론 테스트는 실제 모델이 로드된 환경에서만 실시한다.

### 음질/사용성 수동 합격 기준

- 입력한 한국어 문장이 누락·반복·임의 변경 없이 낭독되었는지 사용자가 청취한다.
- 원본 목소리의 음색이 인지 가능한 수준으로 재현되었는지 본인이 평가한다.
- 2~3회 동일 조건으로 출력하여 결과의 변동을 확인한다.
- 출력 파일을 일반 플레이어로 열 수 있다.
- 1개 문장 생성에 걸린 총 시간(모델 최초 로딩 시간 제외/포함 모두)을 기록한다.
- Windows 작업 관리자에서 최대 RAM 점유를 확인한다.
- **주관적 음질 평가:** 1~5점(발음 정확성/목소리 유사도/자연스러움 각 별도). 기준 예: 4점 이상이면 다음 단계 진행을 검토한다. 이것은 사용자 목표치이지 현재 모델의 보장 성능이 아니다.

## 단계별 게이트

| 단계 | 작업 | 통과 조건 | 실패 시 |
|---|---|---|---|
| 환경 | Python 및 CPU PyTorch 설치 | 패키지 import, `pip check` | 오류 로그 수집 후 호환성 검토 |
| 데모 | Qwen3-TTS Gradio 시작 | 로컬 UI 접근 | CPU 미지원/메모리 문제 구분 |
| 최소 합성 | 본인 음성 + 짧은 한국어 | 실제 WAV 생성/청취 | CPU 스크립트로 재검증 |
| 품질 | 재생·유사도·발음 평가 | 사용자 확인 | 모델 변경 여부 판단 |
| 확장 | `.txt` 문단 처리 | 모든 문단 순서 보존 및 파일 출력 | 해당 단계 기능만 수정 |

CPU 추론 시간이 너무 길거나 메모리 부족으로 실패하면 **현재 PC에서 불가/비실용적**이라는 결과를 인정한다. 사양 업그레이드를 강요하거나 유료 클라우드로 자동 전환하지 않는다. 이 경우 모델 변경 후보(예: 더 가벼운 로컬 TTS)를 근거와 함께 비교하고 별도 승인 후 진행한다. 대체 모델이 동일한 한국어 목소리 복제 품질을 제공한다고 가정하지 않는다.

## 문제 해결 가이드

| 증상 | 진단 순서 | 대응 |
|---|---|---|
| `py -3.12` 실패 | 설치된 Python 목록 확인 | 64비트 Python 3.12 설치 |
| PowerShell venv 활성화 차단 | 실행 정책 메시지 확인 | venv Python 직접 호출 |
| 패키지 의존성 충돌 | `pip check`, `pip show` | 깨끗한 venv 재생성, 공식 요구 버전 확인 |
| 모델 다운로드 실패 | 네트워크, 디스크, 방화벽, SSL | 공개 모델 주소 접근 확인, 재시도 |
| CUDA 관련 오류 | 코드 내 `cuda`/`flash_attention_2` 설정 | CPU `device_map`, `float32`, `sdpa` 검토 |
| 메모리 부족/프로세스 종료 | RAM/페이지 파일/동시 앱 확인 | 짧은 문장, 작업 종료 후 재시도, 실패 기록 |
| UI 열리지 않음 | 콘솔 오류/포트 확인 | 다른 localhost 포트 사용, 방화벽/실행 실패 확인 |
| 마이크 권한 문제 | 브라우저 권한/보안 문맥 확인 | WAV 파일 업로드 방식 사용 |
| 목소리 유사도 낮음 | 음성 품질/원문 정확성 확인 | 깨끗한 샘플 재녹음 및 재시험 |
| 긴 문장이 끊김 | 문장 길이·입력 텍스트 확인 | 작은 단위 분할(확장 단계) |

## 보안·저작권·데이터 보존

- 녹음 원본과 생성된 목소리는 민감한 개인 콘텐츠로 간주해 로컬에서만 저장한다.
- 본인 또는 명시적으로 사용 허락받은 목소리만 복제한다.
- 책은 본인이 저작권을 보유했거나 낭독·저장 권한이 있는 콘텐츠만 사용한다.
- 라이선스 확인 없이 모델 체크포인트나 음성 파일을 재배포하지 않는다.
- 사용자 요청으로 입력/출력 음성을 안전하게 삭제할 수 있도록 파일 위치를 분리한다.
- 데모는 `127.0.0.1`에만 바인딩하고 공개 공유 링크를 생성하지 않는다.

## Codex에게 전달할 첫 작업 지시

> 이 저장소의 `PRD_LOCAL_VOICE_BOOK_POC.md`를 먼저 읽고 그대로 구현해 줘. Windows CPU-only, RAM 16GB이며 외부 GPU·유료 API·계정·키는 사용하지 않는다. **처음에는 공식 `qwen-tts-demo` 설치/실행만 검증**하고, 필요 없는 UI나 서버를 만들지 않는다. 내 PC에서 직접 실행해야 하는 명령은 PowerShell 기준으로 제시한다. 코드를 구현해야 한다면 먼저 단위 테스트를 작성한다. 공식 Gradio 데모가 CPU에서 실패한 경우에는 원인 분석과 `smoke_cpu.py` 경로로 진행하되, 미검증을 성공이라고 말하지 않는다. `README.md`에 실행 절차, `RUN_LOG.md`에 실제 검증 상태를 기록한다. 마지막에는 현재 성공한 단계, 사용자에게 필요한 실제 목소리 파일 준비사항, 다음 검증 명령만 간단히 보고해 줘.

## 참고 및 결정 사항

- 공식 GitHub: https://github.com/QwenLM/Qwen3-TTS
- 모델 카드: https://huggingface.co/Qwen/Qwen3-TTS-12Hz-0.6B-Base
- **성능 판정:** 실제 Windows CPU 환경 미검증 상태에서 시작.
- **첫 마일스톤:** "본인 목소리 + 한국어 짧은 문장 → WAV 생성".
- **비범위:** 자동 감정 연기, 책 전체 일괄 합성, 서비스 운영 환경.
