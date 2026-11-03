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

Vercel 프로젝트는 Root Directory를 `web`로 지정하면 정적 Vite 빌드만 배포합니다. Windows 브라우저에서 배포 URL을 사용할 때는 WSL 런타임 허용 목록에 해당 사이트의 정확한 origin을 넣어 실행합니다.

```bash
LOCAL_VOICE_ALLOWED_ORIGINS=https://your-site.vercel.app ./scripts/start-local-runtime-linux.sh
```

Preview origin을 사용할 때도 해당 Preview URL을 정확히 허용 목록에 지정해야 합니다. Origin 전체 허용이나 wildcard는 지원하지 않습니다.

## Windows PC에서 WSL2로 실행

먼저 Windows 기능에서 WSL2와 Ubuntu를 설치하고 Ubuntu를 한 번 실행해 사용자 계정을 만듭니다. 설치 스크립트는 WSL 배포판을 자동 설치하거나 관리자 권한을 요청하지 않습니다. 저장소를 Windows에 내려받은 뒤 PowerShell에서 아래 명령을 실행하면 Linux 의존성을 준비합니다.

```powershell
Set-ExecutionPolicy -Scope Process Bypass
./scripts/windows/install-local-voice.ps1
./scripts/windows/start-local-voice.ps1 -AllowedOrigin "https://your-site.vercel.app"
```

Vercel 배포 전 로컬 웹을 개발할 때는 기본 허용 출처인 `http://localhost:5173`으로 시작할 수 있습니다. Vercel을 쓸 때는 `AllowedOrigin`에 실제 배포 origin 하나를 정확히 지정합니다. Preview와 Production 도메인이 다르면 각 도메인을 사용할 때 해당 주소로 런타임을 다시 시작합니다.

PowerShell 창은 로컬 런타임이 실행되는 동안 열어 둡니다. 표시된 1회성 코드를 브라우저의 **로컬 앱 연결**에 입력합니다. 브라우저가 로컬 네트워크/Loopback 접근을 물으면 허용합니다. 설치 중 Python, PyTorch CPU, Qwen 라이브러리가 WSL에 설치되고, 모델 가중치는 브라우저의 **음성 생성** 화면에서 사용자가 설치를 확인한 뒤 로컬 Hugging Face 캐시로 내려받습니다.

Windows 경로에 있는 저장소로도 시작할 수 있지만, 더 나은 파일 처리 속도를 위해 저장소와 `.venv`를 WSL Ubuntu의 Linux 홈 디렉터리에 두고 PowerShell 스크립트에 `-WslProjectPath "/home/<사용자>/<저장소>"`를 지정하는 구성을 권장합니다. WSL 메모리 한도는 Windows 전체 RAM과 다를 수 있으므로 화면의 자원 표시는 모델을 실제 실행하는 WSL 기준입니다.

## 내 음성 녹음 및 생성

1. 녹음 스튜디오에서 마이크를 선택하고 입력 레벨을 확인합니다. 사용할 수 있는 마이크가 없으면 오디오 파일 가져오기에서 WAV, WebM 또는 OGG를 불러올 수 있습니다.
2. 정확한 대본을 입력하고 녹음·재생한 뒤 **이 PC에 저장**을 누릅니다.
3. 음성 생성에서 저장한 take와 짧은 한국어 문장을 선택합니다.
4. 모델이 없다면 Qwen3-TTS 0.6B Base의 공개 저장소와 라이선스를 확인하고 설치 동의를 선택합니다.
5. 생성이 끝나면 결과를 재생하고 WAV로 다운로드하거나 로컬 보관 파일을 삭제합니다.

첫 실행의 모델 로드와 생성에는 시간이 걸릴 수 있습니다. 현재 12코어 Linux 환경에서 29자 문장을 합성한 개발 검증은 모델 로드 약 7초, 생성 약 49초, 최대 RSS 약 5.5 GiB였습니다. 이는 사용자 PC에서의 속도를 보장하지 않습니다.

모델 저장소는 [Qwen/Qwen3-TTS-12Hz-0.6B-Base](https://huggingface.co/Qwen/Qwen3-TTS-12Hz-0.6B-Base)이며 Apache-2.0 라이선스와 고정된 공개 revision을 사용합니다. 본인 또는 명시적으로 사용 권한을 받은 음성만 이용하세요. Qwen Base 모델의 감정 제어를 보장하지 않습니다.

## 로컬 데이터 및 실행 경계

- 음성, 대본, 생성 결과, 작업 상태는 기본 `~/.local/share/voice-studio` 아래에 저장합니다.
- 모델은 Hugging Face 로컬 캐시에 보관합니다.
- 브라우저와 로컬 런타임은 `127.0.0.1`로 통신합니다. 마이크 음성이나 생성 입력을 Vercel 또는 외부 추론 API로 보내지 않습니다.
- 공개 모델을 처음 설치할 때만 모델 저장소에서 파일을 받습니다.
- `logs/`, `inputs/`, `outputs/`, 개인 WAV와 모델 체크포인트는 Git 대상에서 제외합니다.

기존 공식 Gradio 데모를 별도로 실행하려면 `./scripts/start-demo-linux.sh`를 사용할 수 있습니다. 새 웹 스튜디오 경로는 로컬 런타임과 `web/` 화면을 사용합니다.

## 문서와 실행 기록

- 제품 설계: [docs/product/LOCAL_VOICE_STUDIO_DESIGN.md](docs/product/LOCAL_VOICE_STUDIO_DESIGN.md)
- 기존 PoC 기준 및 원래 검증 조건: [docs/product/PRD_LOCAL_VOICE_BOOK_POC.md](docs/product/PRD_LOCAL_VOICE_BOOK_POC.md)
- 단계별 계획: [docs/superpowers/plans/2026-11-03-local-voice-studio.md](docs/superpowers/plans/2026-11-03-local-voice-studio.md)
- 실행·테스트 기록: [RUN_LOG.md](RUN_LOG.md)
