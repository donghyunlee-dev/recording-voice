# 로컬 음성 녹음 스튜디오 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Vercel 정적 웹 UI와 사용자가 설치한 WSL2 로컬 런타임을 연결해 엄마 목소리 녹음, 한국어 동화 음성 합성, 장면 이미지·자막·음성을 묶은 동화 플레이어를 제공한다.

**Architecture:** Vite/React/TypeScript UI는 Vercel CDN에서만 제공하고 Vercel server-side functions, 사용자 파일 업로드, 계정/DB는 추가하지 않는다. WSL2의 Python 로컬 서비스는 `127.0.0.1`에만 바인딩하며 모델·음성·결과 파일을 PC에 보관한다. HTTPS 웹 UI는 사용자 동작과 Chrome Local Network Access 허가 후 안전한 loopback API를 호출한다.

**Tech Stack:** Vite, React, TypeScript, `@windsoft/ui`, Tailwind CSS 4, Python 3.12, FastAPI/uvicorn, 기존 `qwen-tts` 설치, 단계별 선택/검증된 모델 adapter.

**Spec:** `docs/product/LOCAL_VOICE_STUDIO_DESIGN.md`

## Global Constraints

- 모든 웹 배포물은 가벼운 정적 프런트엔드와 읽기 쉬운 설치 자료만 포함한다. 모델 가중치와 사용자 데이터는 배포물에 넣지 않는다.
- 모델 추론 및 음성/텍스트 보관은 사용자 PC 로컬에서만 한다. 외부 추론 API로 fallback하지 않는다.
- 첫 지원 PC는 Windows 10/11 64-bit + WSL2 Ubuntu이며 개발/브라우저 검증은 Linux에서 한다.
- 로컬 서비스는 `127.0.0.1`에만 바인딩한다. `0.0.0.0`, 공개 터널, 원격 로그/분석, 공개 공유 링크를 만들지 않는다.
- Vercel 정적 UI에서 localhost 호출은 HTTPS, 명시적 사용자 동작, Local Network Access 허가, exact Origin CORS와 세션 페어링을 거친다.
- 한국어·실제 마이크·출력 청취는 각 acceptance가 수동으로 확인되어야 한다. 가짜 장치/fixture를 실제 음질·장치 proof로 대체하지 않는다.
- 각 기능 코드 변경은 동작 계약 테스트를 먼저 추가하고, 구현 후 해당 테스트를 실행한다. 개인 음성 데이터는 테스트 fixture나 Git에 넣지 않는다.
- 세션 간 사용자가 수정한 파일/개인 로그는 보존한다. 현재 저장소에는 `.git`이 없으므로 Git commit/배포 상태를 가정하지 않는다.

## Review Focus

- 브라우저 권한 거부/Chrome Local Network Access 차단 — 안전한 연결 오류와 설치 안내를 보이는 API/웹 통합 테스트.
- 끊김/WSL 재시작/모델 다운로드 중단 — 재연결·중단·재개 상태를 보이는 로컬 job 저장 테스트.
- 잘못된/큰/경로 조작 오디오 업로드 — 크기, WAV 헤더, duration, 내부 ID allowlist 검증 테스트.
- 참조 녹음 여러 개와 transcript가 다른 경우 — 합성에 명시된 take만 전달하는 provider contract 테스트.
- 모델이 없거나 CPU/RAM 부족/라이선스 고지 미확인 — 합성을 시작하지 않고 이유와 복구 행동을 보이는 모델 gate 테스트.

---

## Phase 0 — 제품 설계 확인

**Files:**
- Review: `docs/product/LOCAL_VOICE_STUDIO_DESIGN.md`
- Review: `docs/superpowers/plans/2026-11-03-local-voice-studio.md`
- Modify if accepted: `docs/product/PRD_LOCAL_VOICE_BOOK_POC.md` (new superseding-design notice only)

- [x] 현재 PoC PRD, 실행 로그, Linux 스크립트, README 확인.
- [x] WindSoft MCP `get_setup_guide`, `list_components`, `get_component`, `get_tokens` 조회.
- [x] 새 UI/로컬 런타임 범위와 단계 계획 작성.
- [x] 사용자가 Vercel UI + PC 로컬 모델/런타임 방향으로 제품 설계와 단계별 실행을 요청.

**Gate:** 사용자 요청이 승인한 범위 내에서 단계 구현을 진행한다. Production 배포는 마지막 검토 이후 별도 gate로 유지한다.

## Phase 1 — Vercel 정적 UI 기반

**Files:**
- Create: `web/package.json`, `web/vite.config.ts`, `web/tsconfig*.json`, `web/index.html`.
- Create: `web/src/main.tsx`, `web/src/App.tsx`, `web/src/styles/*`.
- Create: `web/src/components/AppShell.tsx`, `ConnectionStatus.tsx`, `Onboarding/*`.
- Create: `web/src/**/*.test.ts(x)` for routes, states and onboarding behavior.
- Create: static Vercel configuration only; no API routes.

- [x] Build Korean-first app shell/routes: 시작하기, 녹음 스튜디오, 내 음성, 생성 결과, 설정.
- [x] Apply WindSoft global CSS and semantic tokens; use available UI components for forms, cards, buttons, status and steps.
- [x] Design disconnected, loading, permission-denied and local-service-error states before backend integration.
- [x] Add responsive layout/keyboard and focus behavior; run component tests and production build.
- [x] Verify build artifact contains no model checkpoints or user audio; inspect a rendered Linux browser screenshot at desktop and mobile widths.

**Gate:** local static build and browser preview load in Korean without any API/model dependency; core pages are visible and navigable. Actual Vercel Preview and localhost permission are deferred to Phase 6.

**Phase 1 evidence:** `npm test` passed (2 files, 4 tests); `npm run build` passed (286.80 kB JS / 87.97 kB gzip, 89.49 kB CSS / 17.04 kB gzip); Playwright Chromium rendered desktop/mobile, recording navigation worked, and browser page errors were empty. Screenshots: `logs/voice-studio-phase1-desktop.png`, `logs/voice-studio-phase1-mobile.png`. Recording and model actions remain disabled placeholders until later phases.

## Phase 2 — 로컬 API 계약, 페어링, WSL 서비스

**Files:**
- Create: `local_runtime/pyproject.toml` and Python package `local_runtime/app/*`.
- Create: `local_runtime/tests/test_health.py`, `test_pairing.py`, `test_origin_security.py`, `test_jobs.py`.
- Modify/Create: `scripts/start-local-runtime-linux.sh`, `scripts/install-local-runtime-linux.sh`.
- Create: `web/src/api/localRuntime.ts`, `web/src/features/connection/*`.

- [x] Define typed `/api/v1` health, pairing and system contracts; FastAPI exposes their OpenAPI schema. Remaining model/profile/recording/job/output contracts are deferred to their feature phases.
- [x] Implement health/system reporting without returning private paths or tokens; bind server explicitly to `127.0.0.1`.
- [x] Implement short-lived one-time pairing code, in-memory bearer token, expiry/attempt limit, exact Origin and Host validation, custom request header, and no cookie auth.
- [x] Write security tests for unapproved Origin/Host, missing token, expired session, pairing expiry/attempt limit and valid loopback request. Invalid content-length coverage remains open for upload endpoints.
- [x] Implement persisted local job storage/status transitions and verify tests before connecting model code.
- [ ] Start runtime under WSL2 from Windows localhost forwarding and call health from a separate local browser page.
- [x] Connect Phase 1 UI with user-initiated health/pair flow and specific recoverable errors.

**Phase 2 progress:** loopback runtime, health/pair/system endpoints, exact-origin and one-time pairing security, typed client, persisted jobs, upload validation, and browser connection are implemented. Full Python suite passed (21 tests), web suite passed (4 files, 10 tests), and production build passed. Linux browser paired successfully. Windows-to-WSL forwarding, HTTPS Local Network Access prompt, and OpenAPI contract snapshot remain open.

**Gate:** web UI pairs with local runtime only after user action; API is unreachable from LAN and no request sends audio to Vercel.

## Phase 3 — 설치 프로그램과 로컬 모델 관리자

**Files:**
- Create: `scripts/windows/install-local-voice.ps1`, `scripts/windows/start-local-voice.ps1`.
- Create: `scripts/install-local-runtime-linux.sh`, `scripts/start-local-runtime-linux.sh` if not created in Phase 2.
- Create: `web/public/install/*` with transparent install instructions/scripts.
- Create: `local_runtime/app/system_check.py`, `model_catalog.py`, `model_download.py` and focused tests.
- Create: `web/src/features/install/*`, `web/src/features/models/*`.

- [ ] Preflight Windows/WSL2, Python, disk, RAM/WSL limit and CPU; distinguish host RAM from WSL-visible RAM.
- [x] Provide a readable PowerShell install/start path that uses an existing WSL distro and does not delete/reset WSL or request administrator elevation.
- [ ] Download the allowlisted public model revision and license metadata; verify expected files/checksum when published; store model cache outside `web/`.
- [x] Add model statuses `not installed`, `installing`, `installed`, `failed`; support cancel/retry safely.
- [ ] Add Qwen3-TTS 0.6B Base as the baseline and a tested resource recommendation; present observed data separately from estimates.
- [x] Add coverage for explicit license acknowledgement, insufficient disk/memory gating, interrupted jobs, unknown model IDs and cancellation. Published checksum verification and model removal remain open.
- [ ] Validate installer and model download in a clean WSL2 profile or a documented clean environment; preserve current model cache.

**Gate:** a clean target PC can follow the guide, start localhost runtime and install the baseline model without manual source edits.

**Phase 3 progress:** local model inventory/install job, disk and memory preflight, license link/acknowledgement, cancel/resume, Linux instructions, and downloadable PowerShell WSL install/start scripts plus an in-product guide are implemented. PowerShell scripts and a clean Windows/WSL install have not been executed in a Windows environment.

## Phase 4 — 전문 녹음 및 로컬 takes

**Files:**
- Create: `web/src/features/recorder/*`, audio capture/worklet and WAV encoder modules.
- Create: `web/src/features/voices/*`.
- Create: `local_runtime/app/recordings/*` and tests for WAV parsing/storage/manifest.
- Tests: browser unit tests for state transitions, validation, encoding and take selection.

- [x] Implement input device list, permission/error handling, track settings display, input meter and accessible announcements.
- [x] Implement count-in, record, pause/resume/stop, timer, playback, discard/re-record and transcript-linked save.
- [x] Add local WAV/WebM/OGG import, 5-minute/24 MB bounds, and conversion to 24 kHz mono WAV for machines without a usable microphone.
- [x] Save a valid WAV to local API and atomically persist take/transcript JSON manifest. Never send it to a remote API.
- [ ] Enforce configured maximum duration/bytes, stable sample rate metadata, WAV header validation, and safe stored IDs.
- [x] Add multiple takes, take playback, active-reference selection, and delete/download behaviors. Named profile management and transcript editing remain open.
- [x] Provide short fairy-tale narration prompts for recording; saving a take opens generation with that take's transcript selected. Each request uses one chosen take and can be repeated with another take.
- [x] Verify browser tests using synthetic audio in Linux Chromium; record local WAV and verify sample rate, channels and duration.
- [x] Verify WSLg's `RDPSource` through Linux Chromium and record a live 48 kHz mono capture stream.
- [ ] Record the user's actual voice, save/reload/play the take with its exact transcript, then test synthesis and listening criteria.

**Gate:** a physical microphone take saves locally, reloads in the UI, replays, and its transcript/reference selection is explicit.

**Phase 4 progress:** Chromium synthetic microphone completed the countdown/record/convert/save/list/playback flow. Repeated in the live app: one-time pairing and a 1.080-second WAV (24 kHz mono PCM16) saved with transcript. The local audio-file import, conversion, and save path was also exercised with a 4.32-second WAV fixture. Follow-up found WSLg's `RDPSource`; Chromium now opens it as a live 48 kHz mono stream. The user's actual speech has not been recorded, saved, or replayed yet, so the take gate and listening criteria remain open.

## Phase 5 — 한국어 합성 및 모델 비교

**Files:**
- Create: `local_runtime/app/models/base.py`, `qwen_provider.py`, `cosyvoice_provider.py` as each model passes isolated checks.
- Create: `local_runtime/app/generation/*` plus provider contract and generation job tests.
- Modify: model catalog and model-manager UI.
- Create: `web/src/features/generation/*`, `web/src/features/results/*`.

- [x] Wrap Qwen3-TTS 0.6B Base and validate it using a locally saved synthetic reference take plus Korean text.
- [ ] Provide a fixed Korean benchmark text/reference and capture cold load, warm generation, audio duration, RTF, peak RSS, hardware and failure status.
- [ ] In a separate environment, validate CosyVoice3 CPU install, Korean reference cloning, license, memory and output before marking it installable; if it fails, show evidence and retain it as unsupported.
- [ ] Evaluate Qwen3-TTS 1.7B only when measured free RAM/WSL limit is sufficient; require opt-in, never auto-switch.
- [ ] Implement model-specific provider flags/capabilities; do not claim emotion-control or multi-reference fusion where the provider contract doesn't support it.
- [x] Implement generation jobs, progress/error, local output persistence, play/download/delete.
- [ ] Tests verify wrong/missing reference/transcript/model, empty/overlong text, concurrent job rejection or serial queueing, provider failure and output cleanup.
- [ ] Run the same saved reference and text through at least two models on real PC hardware when available; label the exact hardware and allow user listening comparison.

**Gate:** short Korean sentence creates a playable local WAV with two-model comparison evidence or a specific documented compatibility failure for the candidate.

**Phase 5 progress:** one CPU model previously generated a playable 9.04-second WAV from a synthetic reference; load 7.24 seconds, generation 49.05 seconds, peak RSS 5,529.5 MiB. Later capped runs (240 tokens, then 128 tokens) did not finish within 21 and 12 minutes respectively and were stopped. The 128-token cap is covered by unit tests, but current real-model completion is unverified. A second model, real-user voice similarity, and subjective quality review remain open.

## Phase 6 — 동화 장면 구성 및 플레이어

**Files:**
- Create: `web/src/features/storybook/*` for story and scene authoring/player UI.
- Create: local runtime scene/story manifest and image storage API with size/type/path validation and focused tests.
- Modify: generation/output flows so each scene stores its text, selected voice take, model and generated audio reference.
- Tests: scene ordering, image association, subtitle/audio synchronization, playback navigation, local-only data path.

- [ ] Create a story from a Korean script and split/reorder it into scenes.
- [x] Provide starter scenarios for Snow White, The Three Little Pigs, and Little Red Riding Hood; each has three illustration scenes and fewer than 20 narration lines.
- [x] Bundle public-domain sample illustrations and show the active image's Commons source link.
- [ ] Attach a PC image to each scene and store it in the local data directory.
- [ ] Generate scene audio using the selected saved voice take; persist the link among scene text, image and audio.
- [ ] Build a full-width story player with large illustration, readable text overlay, synchronized playback, pause, previous/next and scene selection.
- [ ] Validate desktop and mobile reading layouts, keyboard access, long text and missing-image/audio recovery.
- [ ] Keep image generation and MP4 export outside the MVP; document those as future work until local resource requirements are validated.

**Gate:** a multi-scene Korean story plays from beginning to end with each illustration, displayed sentence and saved-voice audio in sync, using only local files and local inference.

**Phase 6 progress:** implemented three preset stories with 3 locally bundled public-domain illustrations and 6 short narration lines each, a responsive scene preview, and a handoff to TTS with the full story prefilled. Saving a recording now opens TTS with that take's saved transcript prefilled. Actual speech synthesis from the sample stories still requires a saved reference take and a user click; scene-by-scene audio synchronization and persistent user-authored stories remain open.

## Phase 7 — 보안·전체 흐름 및 배포 검증

**Files:**
- Modify: `README.md`, `docs/product/PRD_LOCAL_VOICE_BOOK_POC.md`, `RUN_LOG.md`.
- Create: `web` Vercel static configuration and deployment-check scripts only if needed.
- Tests: API integration and browser end-to-end flows, privacy/network assertion.

- [x] Verify local development browser activity: API calls go to loopback only; no audio or text request went to another host.
- [ ] Test Chrome Local Network Access grant/deny, reconnect, wrong pairing code, service stopped, WSL restarted, canceled downloads, disk full and unsupported mic.
- [ ] Verify no LAN listener, no unapproved origin, no token in logs/localStorage, and all user data deletions work.
- [x] Test Korean UI navigation and responsive states; inspect Linux desktop/mobile browser screenshots.
- [ ] Validate installation on target Windows/WSL2 PC and manually test real microphone and listening criteria; record versions, timings and resource observations in `RUN_LOG.md`.
- [ ] Deploy Vercel Preview and verify actual deployed URL's HTTPS microphone permission and loopback permission flow.
- [ ] Review Preview artifact/source and user data flow. Production promotion is a separate final delivery gate; do not claim it from a successful Preview.

**Gate:** all required local and browser paths have evidence, privacy boundary is verified, and Preview works on the target PC. Any unverified physical-PC/manual step remains explicit.

**Phase 7 progress:** Linux browser connection, local API hosts, route rendering, and generated result playback were checked. Vercel Preview, HTTPS localhost permission, Windows/WSL forwarding, physical microphone, and target-PC install remain unverified.

## Plan Self-Review

- PRD success conditions map to Phases 1–7: Korean UI/static deployment, local-only storage, user-recorded Korean voice clone, illustrated story playback, diagnostics, actual user-device verification.
- Existing local PoC remains the Qwen baseline; this plan adds only the architecture and UI the user requested.
- Microphone and browser localhost authorization are manual/platform-dependent gates; synthetic tests don't count as device proof.
- Model compatibility is empirical. Candidate failure is a recorded result, not an automatic model fallback.
- No production Vercel promotion or irreversible local-data deletion is assumed.
