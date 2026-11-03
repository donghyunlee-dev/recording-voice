# Windows + WSL2 설치 가이드

웹 화면은 Vercel에서 제공하고, 녹음 파일·모델·합성 결과는 PC의 Ubuntu WSL2에 저장합니다. 브라우저에서 설치를 자동으로 실행하지 않습니다. 사용자가 스크립트를 내려받아 내용을 확인한 뒤 PowerShell에서 실행합니다.

## 1. 준비

- Windows 10/11 x64와 WSL2 Ubuntu 배포판을 준비합니다. 아직 설치하지 않았다면 Windows 안내에 따라 WSL2와 Ubuntu를 먼저 설치하고 Ubuntu를 열어 Linux 사용자 계정을 만듭니다.
- 프로젝트 소스가 Ubuntu 안에 있어야 합니다. 저장소를 Ubuntu의 Linux 홈 폴더에 받아 두는 구성을 권장합니다. 이 가이드의 `<프로젝트 경로>`를 실제 Linux 절대 경로로 바꿉니다. 예: `/home/alex/recording-voice`.
- Python 3.12 또는 `uv`가 Ubuntu에 필요합니다. 설치 스크립트는 시스템을 초기화하거나 WSL 배포판을 설치하지 않습니다.

## 2. 설치 스크립트 받기

이 페이지에서 [PowerShell 설치 스크립트](./windows/install-local-voice.ps1)와 [PowerShell 실행 스크립트](./windows/start-local-voice.ps1)를 다운로드합니다. 다운로드한 파일을 Windows PowerShell에서 실행할 수 있는 폴더에 둡니다.

PowerShell 실행 정책은 현재 창에만 적용합니다.

```powershell
Set-ExecutionPolicy -Scope Process Bypass
```

## 3. 로컬 런타임 설치

`Ubuntu` 대신 실제 WSL 배포판 이름을 넣고, 프로젝트의 Linux 경로를 지정합니다.

```powershell
./install-local-voice.ps1 -Distro Ubuntu -WslProjectPath "/home/<사용자>/<프로젝트>"
```

설치 과정은 Python 가상환경, CPU용 PyTorch, Qwen 라이브러리, 로컬 API를 준비하고 의존성을 확인합니다. 첫 설치에는 시간이 걸리고 인터넷 연결이 필요합니다. 음성 모델 가중치는 아직 받지 않습니다.

## 4. 로컬 런타임 시작

Vercel에서 사이트를 열 경우 `AllowedOrigin`에 주소창의 사이트 origin 하나를 입력합니다. 경로가 아니라 `https://도메인`까지만 넣습니다.

```powershell
./start-local-voice.ps1 `
  -Distro Ubuntu `
  -WslProjectPath "/home/<사용자>/<프로젝트>" `
  -AllowedOrigin "https://your-site.vercel.app"
```

로컬 Vite 개발 화면에서는 기본값 `http://localhost:5173`을 사용합니다. Preview와 Production 주소가 다르면 현재 접속할 주소를 지정해 런타임을 다시 시작합니다. 실행 중인 PowerShell 창은 닫지 않습니다. 런타임은 `127.0.0.1:8765`에만 열립니다.

## 5. 브라우저 연결과 모델 설치

1. Vercel 사이트를 Windows 브라우저에서 엽니다.
2. 위쪽의 **로컬 앱 연결**을 누르고 PowerShell에 출력된 1회성 페어링 코드를 입력합니다.
3. 브라우저가 로컬 네트워크 또는 Loopback 접근을 요청하면 허용합니다. 녹음 시작 때 마이크 권한도 허용합니다.
4. **음성 생성**으로 이동해 모델 저장소와 라이선스를 확인하고 동의한 다음 **이 PC에 모델 설치**를 누릅니다.
5. 다운로드가 끝나면 본인의 녹음을 선택해 짧은 문장을 생성합니다.

모델 다운로드는 Hugging Face에서 WSL의 로컬 모델 캐시로 직접 진행합니다. 브라우저는 로컬 런타임과 통신하며 음성·대본·결과를 Vercel로 보내지 않습니다. 현재 지원 모델은 Qwen3-TTS 0.6B Base입니다.

## 문제 해결

- 페어링 코드가 만료되거나 이미 사용됐다면 PowerShell을 다시 실행해 새 코드를 받습니다.
- 연결이 거부되면 `AllowedOrigin`이 브라우저 주소의 scheme, host, port와 정확히 같은지 확인하고 런타임을 다시 시작합니다.
- WSL 경로 오류가 나면 Ubuntu 터미널에서 `test -f /home/<사용자>/<프로젝트>/scripts/start-local-runtime-linux.sh`로 경로를 확인합니다.
- 모델 설치 전 모델 캐시에 8 GiB 이상의 여유 공간이 필요합니다. CPU 추론은 Windows의 전체 RAM이 아니라 WSL에서 사용 가능한 메모리의 영향을 받습니다.

Windows/WSL 실기기 설치와 HTTPS 로컬 네트워크 권한 동작은 아직 이 개발 환경에서 검증되지 않았습니다. 현재 사이트에는 Linux 브라우저와 합성 마이크를 사용한 개발 검증 결과가 반영되어 있습니다.
