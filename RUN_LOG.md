# 실행 및 검증 로그

실제 실행 결과만 기록합니다. 모델 다운로드 성공은 모델 로드나 음성 생성 성공을 뜻하지 않습니다.

## 2026-11-03 — 첫 사용 흐름과 동화책 최종 화면 설계

- 첫 진입에서 PC 런타임 연결과 음성 모델 준비만 안내하고, 준비 완료 후 녹음 화면을 열도록 UI 흐름을 정리. 저장된 take가 있으면 동화 문장 TTS 화면으로 가는 CTA를 표시.
- Vite/React 웹 테스트: `npm test -- --run --testTimeout=20000 --maxWorkers=1` 통과 (5개 파일, 17개 테스트). `npm run build` 통과.
- 브라우저 렌더링: Linux Chromium, 1440px viewport에서 설정 화면 콘텐츠가 가용 너비를 사용함(화면 1440px, 내부 콘텐츠 1324.8px), 가로 overflow 없음. 캡처: `logs/voice-studio-setup-w-full.png`.
- 최종 제품 목표를 장면 이미지·대본 자막·저장 음성이 동기화되는 동화 플레이어로 설계. 백설공주, 아기 돼지 삼형제, 빨간 모자 각각 3장면 이미지 설명과 6줄의 새 한국어 낭독 대본을 문서화.
- 제한: 장면 이미지 업로드, 스토리 저장, 장면별 TTS 및 동화 플레이어는 아직 구현하지 않음. 현재 앱은 음성 take 저장과 짧은 텍스트 음성 생성 단계이며, 앞서 기록한 사용자 실제 발화/출력 미검증 상태는 동일함.

## 2026-11-03 — 동화 미리보기와 녹음 대사 연결

- 동화책 메뉴에 백설공주, 아기 돼지 삼형제, 빨간 모자 샘플을 추가. 각 동화는 3장면 그림과 한국어 6줄 대본으로 구성되며, 장면 이동/자막 오버레이/그림 출처 링크를 제공.
- Wikimedia Commons에서 공개 도메인으로 표시된 역사 삽화 9장을 받아 정적 웹 자산으로 포함. 파일 및 출처는 `web/public/storybook/SOURCES.md`; 자산 합계 약 3.6 MB.
- 동화 플레이어의 `이 이야기로 음성 만들기`를 누르면 전체 대본이 생성 화면에 미리 입력됨. 마이크 녹음 저장 직후에도 생성 화면으로 이동해 새 take와 녹음 대본을 선택 상태로 채움.
- 녹음 화면은 동화 연습 대사를 고르면 저장 대본 입력칸을 채우고, 읽을 내용을 녹음 전에 보여줌. 반복 녹음은 별도 take로 보관하고 생성 요청마다 한 개 take를 선택함. 브라우저 자동 음성 인식은 구현하지 않았으며 대본은 직접 확인/수정해야 함.
- 검증: 웹 전체 테스트 7개 파일/21개 테스트 통과, `npm run build` 통과. Playwright Linux Chromium에서 9개 삽화 로드, 동화 선택/장면 이동/대본 생성 화면 전달, 연습 대본 자동 입력을 확인. 1440px에서 가로 overflow 없음. 캡처: `logs/voice-studio-story-library.png`, `logs/voice-studio-story-preview.png`, `logs/voice-studio-recording-script.png`.
- 미검증: 실제 사용자 녹음 take로 TTS 합성을 완료해 소리를 청취하지 않음. 예시 동화의 음성 생성은 기존 로컬 모델의 실제 생성 및 사용자 목소리 확인을 필요로 함.

## 2026-11-02 — 최초 Windows 실행 경로 사전 확인 (사용자 지시로 대체됨)

- 명령: `python --version`, `python -m pip --version`, `command -v py`, `command -v qwen-tts-demo`, `command -v pytest`, `free -h`, `df -h .`
- 환경: Linux x86_64 컨테이너, Python 3.14.4, RAM 7.6 GiB(가용 4.4 GiB 관측), 작업 디스크 여유 933 GiB
- 결과: 실패/미실행. `python` 별칭, pip, Windows Python Launcher, Qwen CLI, pytest가 없어 Windows 목표 환경과 공식 데모를 설치·실행하지 못함. `python3`는 존재하지만 3.14.4이며 pip/ensurepip가 없음.
- 화면/모델/마이크/WAV 검증: 수행하지 않음. 사용자 음성 파일과 Windows 16GB PC는 이 실행 환경에 제공되지 않음.
- 오류 로그: 해당 없음. CLI 또는 모델을 실행하지 않음.
- 다음 명령(대상 Windows PC): `py --list-paths` 후 `.\scripts\install.ps1`; 설치 검증이 통과하면 `.\scripts\start-demo.ps1` 실행.

## Linux 화면 및 음성 수동 검증 기록

아래 표는 실제 테스트 전 상태입니다. 합성하거나 청취하지 않은 항목은 결과를 추정해 채우지 않습니다.

| 항목 | 결과 |
|---|---|
| Linux 버전 / 아키텍처 / RAM | Python 호스트: Linux x86_64, RAM 7.6 GiB; 모델 실행 검증 전 |
| Python / PyTorch / `pip check` / `qwen-tts-demo --help` | Python 3.12.16 / torch 2.15.0+cpu / pip check 통과 / help 통과 |
| 모델 다운로드 및 로드 시간 | 미실행 |
| `http://127.0.0.1:8000` 화면 접속 | 미실행 |
| 브라우저 마이크 녹음 또는 WAV 업로드 | 미실행 |
| 녹음 원문과 일치하는 Reference Text 입력 | 미실행 |
| 한국어 합성 및 출력 오디오 재생 | 미실행 |
| 출력 WAV를 `outputs/`에 저장 후 일반 플레이어 재생 | 미실행 |
| 합성 시간 / 최대 RAM | 미실행 |
| 발음 정확성 / 유사도 / 자연스러움 (각 1~5점) | 미실행 |
| 실행 로그 경로 및 오류 | 미실행 |

## Linux 로컬 설치 검증

- 명령: `uv python install 3.12`, `.venv` 생성, `./scripts/install-linux.sh`
- 환경: Linux x86_64 컨테이너, Python 3.12.16, PyTorch 2.15.0+cpu, `qwen-tts` 0.1.1
- 결과: 통과. `pip check`에서 충돌 없음, `torch.cuda.is_available()`은 `False`, `qwen-tts-demo --help` 종료 코드 0.
- 주의: `sox` 시스템 실행 파일이 없어 Python `sox` 패키지가 경고를 출력했지만 공식 CLI help는 성공. 추론에서 필요한지 아직 미검증.
- 브라우저: Playwright Chromium 캐시 발견. Playwright 자동화 패키지/브라우저 연결은 아직 미검증.
- 모델 UI/실제 생성: 아직 미실행. 다음 단계는 `./scripts/start-demo-linux.sh`로 0.6B Base CPU 로드.

## 2026-11-02~03 — 공식 UI 및 브라우저 점검

- 명령: `./scripts/start-demo-linux.sh`; `curl http://127.0.0.1:8000`; Playwright 1.64.1 Chromium에서 화면 캡처 및 필수 입력 검증.
- 모델/환경: `Qwen/Qwen3-TTS-12Hz-0.6B-Base`, Python 3.12.16, PyTorch 2.15.0+cpu, qwen-tts 0.1.1, Gradio 6.17.3, Linux x86_64, 호스트 RAM 7.6 GiB.
- 설치: 성공. `pip check` 통과, CUDA `False`, 공식 CLI help 종료 코드 0.
- 모델 로드/UI: 성공. 체크포인트 파일 약 2.4 GiB 다운로드, 첫 서버 준비까지 약 2분 47초. `127.0.0.1:8000`에서 HTTP 200 (75,091 bytes). 모델 프로세스 최대 관측 RSS 약 4.55 GiB.
- 브라우저 렌더링: 성공. Reference Audio, Reference Text, Target Text, Language, Generate, Output Audio 컴포넌트 확인. 캡처: `logs/qwen-demo-screen.png` (1365x1000).
- 필수 입력 검증: 빈 Target Text로 Generate 클릭, 상태 상자에 `Target text is required` 표시. Queue 응답 HTTP 200, 브라우저 pageerror 없음. 캡처: `logs/qwen-demo-empty-text-validation.png` (1280x720).
- 마이크: 실제 장치 미검증. Chromium `enumerateDevices()`에서 물리 `audioinput` 0개, `/dev/snd`에는 `timer`만 있음. 마이크 버튼은 화면에 렌더링됨.
- 브라우저 녹음 컨트롤 보조 점검: 가짜 Chromium 입력 장치는 3개 노출됐으나 Record audio 클릭 뒤 10초 안에 Stop Recording 상태를 확인하지 못함. 이를 실제 마이크 녹음 성공으로 취급하지 않으며 음성 파일도 생성/저장하지 않음.
- 합성 및 WAV: 아직 미검증. 사용자 목소리 녹음이 없고 현재 호스트 가용 RAM이 약 1 GiB, swap 여유가 약 32 MiB라 CPU 추론은 실행하지 않음. 결과 파일 없음.
- 경고: SoX 실행 파일 미설치 경고와 Gradio 6 Blocks 생성자 deprecation 경고가 있었으나 모델 로드 및 UI에는 영향 없음. FlashAttention 미설치로 PyTorch 수동 경로 사용.
- 서버: 이 기록 시점 PID 68261이 계속 실행 중. 같은 Linux 실행 환경에서 `http://127.0.0.1:8000` 접속 가능.

## 2026-11-03 07:13 — 사용자 화면 생성 요청 확인

- 확인 명령: `tail -n 100 logs/demo-20261102-230951.log`, `ps -p 68261`, `/proc/meminfo`, Gradio 임시 파일 metadata와 `soundfile.info()`.
- 로그 결과: `Setting pad_token_id...` 뒤 Gradio의 float32→16-bit 변환 경고가 발생. 치명적 traceback은 없었고, 서버 프로세스와 127.0.0.1:8000 listener는 계속 살아 있음.
- 산출 결과: Gradio 임시 저장소에 WAV 1개 확인. 207,404 bytes, PCM_16, mono, 24,000 Hz, 4.32초. 음성 내용은 열거나 청취하지 않음.
- 리소스: 작업 중 프로세스 RSS 약 5.4 GiB까지 관측, 확인 후 약 4.6 GiB. 시스템 가용 RAM 약 1.0 GiB, swap 약 0.47 GiB.
- 미완료: 재생/발음·유사도 청취 평가는 하지 않음. 프로젝트 `outputs/`에는 파일이 없어 브라우저 플레이어에서 다운로드하여 보존해야 함.

## 2026-11-03 — 로컬 음성 스튜디오 Phase 1 정적 웹 UI

- 환경: Linux x86_64, Node.js 24.18.0, npm 11.18.0, React 19.3.1, Vite 8.3.5, TypeScript 7.0.2.
- 디자인 시스템: `@windsoft/ui` 0.9.0, Tailwind CSS 4.3.3. WindSoft MCP 가이드에 따라 `@windsoft/ui/global.css`와 semantic token을 적용.
- RED/GREEN: UI 구현 전 `npm test -- --reporter=verbose` 실행 시 아직 생성하지 않은 `App`/`ConnectionStatus` 파일 resolve 실패. UI 구현 후 단위 테스트 2개 파일/4개 테스트 통과.
- 빌드: `npm run build` 통과. JS 286.80 kB (gzip 87.97 kB), CSS 89.49 kB (gzip 17.04 kB). 모델 가중치/사용자 오디오 없음.
- 브라우저: Vite dev server `127.0.0.1:5173`; Playwright Chromium에서 한국어 기본 화면, 녹음 화면 내비게이션, 데스크톱 1440px 및 모바일 390px 렌더링 확인. pageerror 0건.
- 캡처: `logs/voice-studio-phase1-desktop.png`, `logs/voice-studio-phase1-mobile.png`.
- 범위: Vercel용 정적 페이지와 화면 skeleton만 구현. 마이크 캡처, 로컬 API, 실제 모델 설치/합성, Vercel Preview는 미완료.
- 주의: npm install 중 상위 `.profile`의 누락된 `/tmp/recording-voice-tools/env` 참조 경고 및 WindSoft 패키지 종속성 `recharts@2.15.4` deprecation 경고가 있었음. 설치/테스트/빌드에는 영향 없음. `npm audit` 취약점 0개.

## 2026-11-03 — 로컬 API Phase 2 기반

- 로컬 런타임: `local_runtime/` Python package, FastAPI `/api/v1/health`, `/pair`, `/system`, Linux loopback 시작 스크립트를 추가. 앱은 `127.0.0.1`에만 bind.
- 보안: 환경변수 exact Origin 허용 목록, Host 검사, 10분 유효 1회성 페어링 코드, 5회 시도 제한, 12시간 메모리 bearer token, `X-Local-Request` 요구를 추가. health 응답에 개인 경로나 토큰은 포함하지 않음.
- 웹 계약: health/pair/system TypeScript 클라이언트와 Chrome loopback `targetAddressSpace` 선언을 추가. UI 연결 폼/실제 브라우저 연결은 아직 미완료.
- 검증: Python `unittest` 6개 통과. 웹 Vitest 3개 파일/6개 테스트 통과. `npm run build` 통과 (JS 286.87 kB / gzip 87.99 kB, CSS 89.43 kB / gzip 17.00 kB).
- 한계: HTTPS 배포 페이지의 Chrome Local Network Access 승인과 Windows→WSL localhost forwarding을 실제로 확인하지 않음. 업로드 콘텐츠 길이 제한 및 job 저장도 이후 단계.

## 2026-11-03 — 로컬 음성 스튜디오 통합 프로토타입

- Python 검증: `.venv/bin/python -m unittest discover -s local_runtime/tests -v` 통과 (21 tests).
- 웹 검증: `cd web && npm test -- --run` 통과 (4 files, 10 tests); `npm run build` 통과 (JS 310.20 kB / gzip 94.86 kB, CSS 93.52 kB / gzip 17.91 kB).
- 브라우저: Linux Chromium에서 one-time pairing, 연결, 설정의 CPU/RAM/디스크 정보, 내 음성 목록, 생성 화면, 결과 목록을 확인. 페이지 오류 0건. 관측한 요청 host는 `127.0.0.1:5173`과 `127.0.0.1:8765`만 포함.
- 합성 reference: Chromium fake microphone로 만든 take라 사용자 목소리가 아님. 4.32초, WAV PCM16 mono 24 kHz, 207,404 bytes; 대본과 함께 임시 테스트 데이터 경로에 저장.
- 모델 합성: Qwen3-TTS 0.6B Base, CPU, Linux x86_64, 12 logical CPUs, RAM 7.6 GiB. 29자 한국어 문장, model load 7.24초, generation 49.05초, peak RSS 5,529.5 MiB. 출력 9.04초, WAV PCM16 mono 24 kHz, 433,964 bytes; 브라우저 결과 재생 확인.
- 제한: 생성은 synthetic reference로 파이프라인만 검증. 사용자 음성 유사도/품질은 청취 검증하지 않음. 물리 마이크 0개, 실제 Windows/WSL 연결, HTTPS Local Network Access 허가, Vercel Preview 배포는 미검증.
- 테스트 데이터는 `/tmp/voice-studio-browser-smoke-2` 및 `/tmp/voice-studio-final-smoke` 아래에만 두었으며 기본 사용자 저장 폴더를 변경하지 않음.
- 설치 안내: 설정 화면에 Windows+WSL 설치 가이드 및 PowerShell 설치/실행 스크립트를 정적 다운로드 링크로 추가. `npm test` 4 files/11 tests와 Vite build 통과. PowerShell 실행 자체와 Windows WSL 설치는 PowerShell/Windows 환경이 없어 미검증이며 WSL 안에 프로젝트 소스가 있어야 함.
- 오디오 파일 대체 경로: WAV/WebM/OGG를 브라우저에서 24 kHz mono PCM WAV로 변환해 로컬 API에 저장하도록 추가. Chromium에서 기존 4.32초 WAV fixture를 가져와 저장되고 `recordings/`에 새 ID로 생성되는 것 확인. 입력 장치 조회는 audioinput 0개였고, **마이크 연결 및 확인**은 `사용 가능한 마이크를 찾지 못했습니다.`를 정확히 표시함. 가져오기 fixture도 synthetic 데이터이며 사용자 음성은 아님.
- WAV 경계 테스트: 빈 파일, 24 MB 초과 파일, 5분 초과 오디오를 변환 전에 거절하는 로직을 추가. 관련 웹 테스트를 개별 실행해 통과.

## 2026-11-03 — 파일 가져오기 및 제한 생성 예산 검증

- 오디오 가져오기 UI 테스트와 WAV 경계 테스트를 포함한 웹 전체: 기본 5초 테스트 제한에서는 `App` 테스트 2개가 느린 Linux 테스트 환경에서 timeout. `npm test -- --run --maxWorkers=1 --testTimeout=20000` 재실행 결과 5개 파일/16개 테스트 통과 (135초).
- Vercel 정적 빌드: `npm run build` 통과. JS 312.54 kB (gzip 95.50 kB), CSS 94.34 kB (gzip 18.07 kB).
- 로컬 API 전체: `.venv/bin/python -m unittest discover -s local_runtime/tests -v` 통과 (24 tests). 짧은 한국어 문장 예산이 Qwen `generate_voice_clone(max_new_tokens=128)`까지 전달됨을 단위 테스트로 확인.
- 실모델 제한 측정: 같은 Linux CPU 런타임에서 30자 한국어 문장을 240 토큰 상한으로 실행했으나 21분 동안 상태가 `generating`이고 출력 파일이 없어서 임시 테스트 프로세스를 중단. 이는 사용자 데이터 디렉터리가 아닌 `/tmp/voice-studio-final-smoke`의 합성 reference 테스트였음. 이후 짧은 문장 상한을 128로 낮추고 단위 테스트는 통과했으나, 변경된 상한의 새 실모델 출력은 아직 측정하지 않음.
- 따라서 앞 기록의 49.05초/9.04초 실제 합성 결과는 기존 무제한 호출에 대한 결과이며 현재 상한 정책의 속도나 완결성을 보증하지 않음. 새 상한 실모델 검증, 물리 마이크, 사용자 목소리 청취 평가는 남아 있음.
- 후속 검증: 저장된 합성 reference와 동일한 한국어 문장으로 새 128토큰 상한을 실모델에 적용. 모델은 로드되었고 Qwen generation 단계 진입은 확인했으나, 12분 21초 동안 CPU 사용 상태로 끝나지 않아 임시 프로세스를 종료. `/tmp/voice-studio-128-smoke/`에는 WAV가 생성되지 않음. 실행 당시 RSS 약 4.57 GiB, Linux 컨테이너 가용 메모리는 약 2.9 GiB. 원인 미확정이며 로직 단위 테스트 통과만으로 실제 생성 성공을 주장하지 않음.
- 실시간 화면 통합 재검증: Vite `http://127.0.0.1:5173` + Linux Chromium 1248 / Playwright 1.64.1, 임시 API 저장 경로 `/tmp/voice-studio-live-smoke-20261103-2`. 1회용 페어링, Chromium 가상 입력 장치 녹음, WAV 변환, 대본 저장을 실제 페이지에서 끝까지 실행. 저장 산출물 `e415126a-661c-4dc7-afd1-f8c77a26054d.wav`: WAV PCM16 mono 24 kHz, 1.080초, 51,884 bytes. 저장된 대본은 `테스트용 합성 마이크 입력입니다.`이며 실제 사용자 음성이 아님. 브라우저 오류 0건, 요청 host는 페이지와 로컬 API(`127.0.0.1:5173`, `127.0.0.1:8765`)만 관측; `data:`/`blob:` 로컬 미디어 URL도 발생.
- 화면 캡처: `logs/voice-studio-live-smoke.png` (한국어 연결 상태, 마이크 장치, 저장 완료 UI). 이 환경은 `/dev/snd`에 `timer`만 있고 `arecord`가 없어 물리 마이크 입력은 여전히 확인할 수 없음.
- 사용자가 실제 테스트를 이어갈 수 있도록 Vite와 기본 저장 경로의 로컬 API를 재기동. Health 응답은 HTTP 200 JSON `status=ok`; 현재 페어링 코드는 터미널 세션에만 표시되며 실행 시각 기준 10분 유효. 기본 사용자 저장 경로는 시작 시 비어 있었음.
- 사용자 수동 테스트 준비: Linux GUI Chromium을 headful로 띄워 현재 기본 로컬 런타임과 1회 페어링하고 `녹음 스튜디오` 화면에 둠. 브라우저 프로세스는 유지 중이고, 테스트 페이지는 `http://127.0.0.1:5173`에서 열려 있음. 물리 입력 장치가 없어 실제 목소리 저장/합성은 사용자의 마이크 환경에서 이어서 확인해야 함.

## 2026-11-03 — WSLg 마이크 경로 재확인

- 앞서 `/dev/snd`의 ALSA 카드가 없고 `arecord`도 없어서 물리 입력이 없다고 판단했으나, 이는 WSLg PulseAudio 입력 경로를 확인하지 않은 결론이었음.
- `PULSE_SERVER=unix:/mnt/wslg/PulseServer`, `/mnt/wslg/PulseAudioRDPSource` 존재 확인. Ubuntu에는 `pactl`과 `libpulse0`가 없었음. `sudo apt-get install`은 이 계정에서 비대화형 인증이 필요해 실행할 수 없었음.
- 공식 Ubuntu 패키지 `pulseaudio-utils`, `libpulse0`, `libasyncns0`를 `/tmp/voice-audio-check`에 내려받아 임시로 압축 해제하고 `LD_LIBRARY_PATH`만 해당 Chromium 프로세스에 설정. 임시 `pactl`이 WSLg PulseAudio Server에 접속해 `Default Source: RDPSource`, 44.1 kHz mono를 확인.
- 이 임시 PulseAudio client 경로를 상속한 Linux Chromium에서 `getUserMedia({audio:true})` 성공. 브라우저는 `Default`와 `RDP Source` 입력 장치를 표시했고, 실제 track은 48 kHz mono였음. 측정 RMS 0.0056은 조용한 시점의 관측값이며 사용자가 발화한 음성 콘텐츠로 취급하지 않음.
- 마이크가 열린 상태인 headful Linux Chromium은 현재 `녹음 스튜디오` 페이지에 남겨 둠. 사용자의 실제 발화, take 저장/재생, 그 take를 이용한 모델 생성은 아직 수행되지 않음. 영구 패키지 설치나 system config 변경은 하지 않았음.
- 후속 상태 점검: `~/.local/share/voice-studio`에는 새 recording/job/output 파일이 없고, Vite 및 API 프로세스는 살아 있음. 모델은 고정 revision `5d83992436eae1d760afd27aff78a71d676296fc`으로 설치됨. 페어링 API의 system 응답은 Linux x86_64, 12 논리 CPU, RAM 7.62 GiB / 가용 6.37 GiB / 모델 캐시 디스크 여유 927.5 GiB. 사용자 녹음이 저장되면 다음 단계 생성 preflight의 5.7 GiB 권고를 통과할 관측값임.

## 2026-11-04 — WindSoft 화면 정리 및 배포 완료 게이트

- WindSoft Design System MCP에서 semantic 토큰과 `WizardForm`, `ProductGrid`, `SettingsPage` 템플릿을 확인하고 설치 안내, 동화 선택, 설정 화면에 적용. 앱 화면의 색상, 글자 역할, 테두리 반경, 카드 그림자를 WindSoft semantic 토큰에 연결.
- Windows 10/11 사용자가 HTTPS 배포 화면에서 프로젝트 ZIP과 안내를 받고, PowerShell 설치 및 현재 페이지 origin에 허용된 로컬 런타임을 실행하는 절차를 추가. 개발 완료 판정은 실제 Windows PC의 연결, 물리 마이크 녹음, 저장 후 재조회·재생과 로컬 전송 경계 검토까지 요구하도록 `docs/development/DEVELOPMENT_COMPLETE.md`에 기록.
- 웹 검증: `npm test -- --run --maxWorkers=1 --testTimeout=20000` 통과 (7 files, 22 tests). `npm run build` 통과. `git diff --check` 통과. WindSoft 템플릿 화면의 데스크톱/모바일 렌더 확인 및 모바일 가로 넘침 없음.
- 배포: Vercel `recording-voice-web`, deployment `dpl_Gnsq59APdayLPvSRSFbJoHoGzjiC`, URL `https://recording-voice-web.vercel.app`, 상태 Ready, target Production. 공유 링크를 발급해 `curl`에서 HTTP 200 및 앱 HTML 응답 확인; 링크 만료 2026-11-11. 보호 설정은 유지.
- 배포 상태 유의: Preview를 의도했으나 CLI 결과는 Production target이었음. 이 프로젝트의 첫 배포이며, Preview 검증이나 Production 승격을 완료한 것으로 기록하지 않음. 배포는 `d9f8567317970cc8b90aa8532104586924ddd27f` 기반의 dirty 작업 트리에서 생성되어 commit 고정이 아니며, 화면의 GitHub `master` ZIP과 전체 소스 정합성은 미확인. Windows 수동 설치/녹음 acceptance는 아직 미완료.
