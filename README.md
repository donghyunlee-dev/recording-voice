# 보이스 스튜디오

한국어 웹 화면에서 본인 목소리를 녹음하고, 사용자 PC에 설치된 Qwen3-TTS 0.6B Base로 짧은 문장을 생성하는 로컬 음성 스튜디오입니다. 웹은 정적 프런트엔드이며 음성 파일, 대본, 모델 추론, WAV 결과는 PC에 보관합니다.

## Linux 개발 환경

Python 3.12, CPU 전용 PyTorch, `qwen-tts`, 로컬 API 의존성을 설치합니다. 모델 가중치는 별도로 약 2.52 GB를 내려받습니다.

```bash
./scripts/install-linux.sh
```

설치 스크립트는 기존 `.venv`를 재사용하며 삭제하거나 초기화하지 않습니다. `pip check` 및 Qwen CLI 확인이 완료되면 로컬 런타임과 웹 화면을 각각 실행합니다.

터미널 1:

```bash
./scripts/start-local-runtime-linux.sh
```

터미널 2:

```bash
cd web
npm ci
npm run dev -- --host 127.0.0.1
```

Linux Chromium에서 `http://127.0.0.1:5173`을 엽니다. 화면에서 **로컬 앱 연결**을 눌러 터미널에 표시된 1회성 페어링 코드를 입력합니다. 처음 연결 때 브라우저의 로컬 네트워크 권한과 녹음 시작 때 마이크 권한을 허용합니다.

WSL2의 Linux 브라우저에서 마이크 장치가 보이지 않으면 WSLg PulseAudio 클라이언트가 설치됐는지 확인합니다.

```bash
sudo apt-get update
sudo apt-get install libpulse0 pulseaudio-utils
pactl list sources short
```

WSLg가 Windows 오디오 입력을 전달하면 목록에 `RDPSource`가 표시됩니다. Windows 개인정보 설정에서 마이크를 허용해야 하며, 조직 정책이나 오디오 드라이버가 입력 전달을 막을 수 있습니다. WSLg 마이크 경로가 없으면 같은 PC의 Windows 브라우저에서 페이지를 열거나 오디오 파일 가져오기를 사용합니다.

Vercel 프로젝트는 Root Directory를 `web`로 지정하면 정적 Vite 빌드만 배포합니다. Windows 사용자는 설치 프로그램을 사용합니다. 아래 Linux 런타임 명령은 개발자가 배포 UI와 Linux backend를 점검할 때만 사용합니다.

```bash
LOCAL_VOICE_ALLOWED_ORIGINS=https://your-site.vercel.app ./scripts/start-local-runtime-linux.sh
```

Preview origin을 사용할 때도 해당 Preview URL을 정확히 허용 목록에 지정해야 합니다. Origin 전체 허용이나 wildcard는 지원하지 않습니다.

## Windows 설치 프로그램

일반 사용자는 웹 화면에서 `VoiceStudioSetup.exe`를 내려받아 설치 마법사를 실행합니다. 설치 파일을 연 뒤 웹 화면에서 **설치했어요, PC 앱 찾기**를 누르면 로컬 백엔드를 자동 감지하고 연결합니다. 모델은 라이선스 동의와 다운로드 진행률을 표시하는 웹 설정 단계에서 받으며, 준비가 끝나야 녹음 화면에 들어갑니다.

설치는 WSL, Docker, Java 또는 관리자 권한을 요구하지 않습니다. Python과 CPU용 음성 처리 라이브러리는 최초 설치 때 내려받고, 모델 가중치는 별도로 약 2.52 GB를 받습니다. 앱과 모델 설치 파일은 별개로 업데이트됩니다. Windows 설치 프로그램 빌드 방법은 [installer/windows/README.md](installer/windows/README.md)를 참고하세요.

이 저장소의 Linux 개발 흐름은 개발·검증용으로 유지됩니다. Windows 사용자용 설치 흐름과 Linux 개발 환경은 서로 다른 실행 경로입니다.

## 내 음성 녹음 및 생성

1. 녹음 스튜디오에서 마이크를 선택하고 입력 레벨을 확인합니다. 사용할 수 있는 마이크가 없으면 오디오 파일 가져오기에서 WAV, WebM 또는 OGG를 불러올 수 있습니다.
2. 정확한 대본을 입력하고 녹음·재생한 뒤 **이 PC에 저장**을 누릅니다.
3. 음성 생성에서 저장한 take와 짧은 한국어 문장을 선택합니다.
4. 모델이 없다면 Qwen3-TTS 0.6B Base의 공개 저장소와 라이선스를 확인하고 설치 동의를 선택합니다.
5. 생성이 끝나면 결과를 재생하고 WAV로 다운로드하거나 로컬 보관 파일을 삭제합니다.

첫 실행의 모델 로드와 생성에는 시간이 걸릴 수 있습니다. 현재 12코어 Linux 환경에서 29자 문장을 합성한 개발 검증은 모델 로드 약 7초, 생성 약 49초, 최대 RSS 약 5.5 GiB였습니다. 이는 사용자 PC에서의 속도를 보장하지 않습니다.

모델 저장소는 [Qwen/Qwen3-TTS-12Hz-0.6B-Base](https://huggingface.co/Qwen/Qwen3-TTS-12Hz-0.6B-Base)이며 Apache-2.0 라이선스와 고정된 공개 revision을 사용합니다. 본인 또는 명시적으로 사용 권한을 받은 음성만 이용하세요. Qwen Base 모델의 감정 제어를 보장하지 않습니다.

## 로컬 데이터 및 실행 경계

- Windows 설치에서는 음성, 대본, 생성 결과와 모델을 `%LOCALAPPDATA%\VoiceStudio` 아래에 저장합니다. Linux 개발 실행에서는 기본 `~/.local/share/voice-studio`와 Hugging Face 캐시를 사용합니다.
- 브라우저와 로컬 런타임은 `127.0.0.1`로 통신합니다. 마이크 음성이나 생성 입력을 Vercel 또는 외부 추론 API로 보내지 않습니다.
- 공개 모델을 처음 설치할 때만 모델 저장소에서 파일을 받습니다.
- `logs/`, `inputs/`, `outputs/`, 개인 WAV와 모델 체크포인트는 Git 대상에서 제외합니다.

기존 공식 Gradio 데모를 별도로 실행하려면 `./scripts/start-demo-linux.sh`를 사용할 수 있습니다. 새 웹 스튜디오 경로는 로컬 런타임과 `web/` 화면을 사용합니다.

## 문서와 실행 기록

- 제품 설계: [docs/product/LOCAL_VOICE_STUDIO_DESIGN.md](docs/product/LOCAL_VOICE_STUDIO_DESIGN.md)
- 기존 PoC 기준 및 원래 검증 조건: [docs/product/PRD_LOCAL_VOICE_BOOK_POC.md](docs/product/PRD_LOCAL_VOICE_BOOK_POC.md)
- 단계별 계획: [docs/superpowers/plans/2026-11-03-local-voice-studio.md](docs/superpowers/plans/2026-11-03-local-voice-studio.md)
- 개발 완료 절차: [docs/development/DEVELOPMENT_COMPLETE.md](docs/development/DEVELOPMENT_COMPLETE.md)
- 실행·테스트 기록: [RUN_LOG.md](RUN_LOG.md)
