# Voice Studio release readiness

Scope: reusable personal voice recording, text-to-speech creation, repeated revision and comparison, and launch preparation. Storybooks are sample inputs, not the product domain.

Measurement: each of the 20 equally weighted acceptance items earns 5 points only after all evidence for that item passes. The current 90% target requires 18/20 fully evidenced items, including physical recording, voice likeness, and expressive-delivery acceptance. A score is not a claim of market parity. Mandatory physical recording, voice likeness and expressive delivery cannot be substituted with fixtures.

| # | Acceptance item | Required evidence | Status |
|---|---|---|---|
| 1 | Consistent typography, color, spacing and components | Rendered populated and empty screens at desktop/mobile sizes | Partial |
| 2 | Keyboard and screen reader access | Focus order, names, dialog and live-status checks | Pending |
| 3 | Microphone connection and permission recovery | Browser permission rejection, retry and device selection | Partial |
| 4 | Recording lifecycle | Record, pause, resume, stop, disconnect and unmount regression tests | Partial |
| 5 | Recording quality feedback | Silence, clipping and actual input visualization | Partial; see verification sections below |
| 6 | Real Windows recording | Physical mic → save → reopen → playback | Pending |
| 7 | Voice library | Persistent names, preview, rename and deletion confirmation | Partial |
| 8 | Durable workspace | Named work, text, selected voice and settings survive restart | Partial; see verification sections below |
| 9 | Generation submission | Input validation and duplicate prevention | Partial |
| 10 | Job continuity | Navigate/reload while generating, reconnect and recover | Partial; see verification sections below |
| 11 | Version comparison | Work-associated results, input snapshots, A/B playback | Partial; see verification sections below |
| 12 | Final selection | Persist selection and preserve previous versions | Partial; see verification sections below |
| 13 | Playback and export | First play, seeking, repeated playback, real WAV download | Partial |
| 14 | Failure recovery | Storage, network, model and memory failures preserve work | Partial; see verification sections below |
| 15 | Actual Korean generation | User voice likeness, pronunciation and measured latency | Pending |
| 16 | Expressive delivery | Explicit listening evaluation and honest UI capability boundary | Pending |
| 17 | Automated regression suite | All frontend/backend checks pass with behavior coverage | Partial: latest frontend 72/72 and build passed; latest Linux backend 52/52 passed. See dated evidence below; physical and subjective coverage remains incomplete |
| 18 | End-to-end browser suite | Record/import → save → generate → select → reopen | Partial; see verification sections below |
| 19 | Installation and local data | Windows installer startup, update compatibility, backup/restore | Partial; see verification sections below |
| 20 | Release verification | Staged deployment, exact artifact check, production routing and rollback reference | Partial; 0.3.1 deployed, see latest evidence |

Current score: not yet established; partial checks receive no completion credit. Do not infer production readiness from build or mock screenshots.

## 2026-11-13 result playback resource regression

- Reproduced a leaked object URL when a pending audio response completed after the result card unmounted. The response now checks that the player still exists before allocating a URL.
- Regression failed before the fix and passed afterward. Full frontend suite: 70 tests passed; production build passed. This addresses navigation during pending playback loading, not complete browser memory profiling.
- The isolated expressive-engine trial produced two real Korean WAV files; see `EXPRESSIVE_ENGINE_EVALUATION.md` for measured latency, forced-EOS warnings and unresolved listening/offline-packaging acceptance. No engine switch or deployment is implied.

## 2026-11-13 generation announcement scope

- Moved the generation live region to the status text, leaving the ticking elapsed time outside it. The timer remains readable on demand without marking each tick as a new status announcement.
- Regression failed with the timer inside the live region and passed after the change; completed-job recovery remains covered. Full frontend 70 tests and production build passed. Actual screen-reader speech output remains unverified.
- Installer inspection identified a follow-up risk: install/uninstall stop only the stored Python process ID, whereas native Windows venv launches observed during engine trials have a wrapper and child process. Reproduce with an isolated dummy process tree before changing production stop behavior; do not stop the user's running backend for this test.

## 2026-11-13 Windows process termination acceptance

- Added `scripts/verification/windows-stop-tree.ps1`, which creates a temporary venv and isolated application-data directory, starts a sleeping Python wrapper/child pair, and invokes the actual uninstall script.
- Native Windows execution passed: an unrelated installation root preserved both processes; the matching root stopped both processes and cleared the PID file. All process IDs inspected and cleaned up belonged to this test.
- The suspected orphan-child defect was not reproduced. Production stop code was left unchanged. This verifies the observed Python 3.12 venv process tree, not full installer update/uninstall or model inference interruption.

## 2026-11-13 keyboard and mobile editor acceptance

- Browser harness now verifies Tab order from brand through studio/record navigation, a visible keyboard focus outline and Enter activation of recording navigation.
- Rendered 390px comparison exposed excess nested editor padding and a tall viewport-derived textarea. Mobile generation sections now use 12px padding and a 220–300px initial editor height; desktop sizing remains intact.
- Final browser run passed at `/tmp/voice-browser-data-eUYPqv/evidence.json`, including real API recording/work/result persistence and recovery. Both 1440px/390px overflow checks passed; the 390px result screenshot was visually inspected after the change. Production build and whitespace check passed.
- This is scoped keyboard navigation evidence, not full keyboard/screen-reader acceptance. Input remains synthetic and result files are fixtures; perceptual quality is covered separately by the pending local listening trial.

## 2026-11-13 generation admission regression

- Added an asynchronous route-handler test submitting ten generation requests together: exactly one persisted job and executor submission, nine explicit 409 conflicts. After marking that job failed, a fresh request receives a new job ID and one active job remains.
- The current async handler contains no await between active-job inspection and creation, so the suspected admission race was not reproduced in the application's single-event-loop configuration. No production locking change was added.
- Full runtime suite: 41 tests passed on Linux and native Windows. Authentication, model and executor are substituted in the new test; it verifies route admission/storage behavior, not network load, multi-worker deployments or actual model concurrency.

## 2026-11-13 preview delivery

- Rebuilt Windows installer 0.2.0 from current source and replaced the outdated public 0.1.0 installer. SHA-256: `083c1459321eb11a2c66daa62ae6892141d4e79313e0538514218143dae143f5`; identical to the prior review artifact. It was compiled, not installed over the user's app.
- Final Preview deployment `dpl_3U2shgRXmdSiSLqnqAevMMBX9gDm` is READY at `https://recording-voice-lrmcqqc91-donghyunlees-projects-e43b52b1.vercel.app`. It is an uncommitted source snapshot based on `1e4c20d`, not an exact Git commit release.
- Authenticated retrieval verified the final HTML and downloaded installer SHA-256. Meta description now describes creation/comparison/storage rather than a test service; browser theme color matches the dark studio.
- Vercel connector returned project-not-found for the known team/project; explicitly scoped CLI confirmed the intended project and performed deployment/access. No protection settings were changed.
- Production was not promoted. Preview-origin local-app connection, deployed browser acceptance, clean installation/update, physical recording and voice-quality acceptance remain open. READY and successful file download do not establish those flows.

## 2026-11-14 protected preview browser acceptance

- `scripts/verification/browser-preview.cjs` passed against the final preview with fresh development OIDC injected from a temporary linked directory, scoped only to the deployment origin. The run from the repository directory loaded `.env.local` and redirected to Vercel login; that failed run was not accepted as application evidence.
- Evidence `/tmp/voice-preview-browser-yVaj0W/evidence.json`: deployed HTML/assets render, missing-runtime state opens installation guidance, 1440px/390px layouts do not overflow, and an explicitly authenticated installer response matches the release SHA-256. Mobile installation screenshot was visually inspected in the preceding run at `/tmp/voice-preview-browser-wC2AUB/install-390.png`.
- Native download click did not retain the injected OIDC header and redirected to login. This check is explicitly excluded, not silently counted as passed. No deployment-protection setting was changed. Signed-in browser download, connected local runtime, installation and physical recording remain unverified.

## 2026-11-14 deployed frontend to native Windows runtime

- Initial remote run against Linux correctly failed with `windows_runtime_required`; production web intentionally disallows WSL/Linux runtime identity. Failure evidence: `/tmp/voice-browser-data-9Fke1w/connection-failure.json`.
- Extended the same browser harness to use a protected Preview origin and a native Windows interpreter/browser. Remote mode now rejects non-Windows execution early. Deployment credentials are attached only to the preview origin.
- Native Node + Chrome + Python execution passed against Preview `dpl_3U2shgRXmdSiSLqnqAevMMBX9gDm`. Evidence: `%LOCALAPPDATA%\Temp\voice-browser-data-VNbZoZ\evidence.json`. Synthetic recording duration: 3.48 seconds.
- Verified real deployed frontend → loopback API → temporary Windows files: permission rejection/retry, capture/pause/resume/save, rename/playback, durable work reload, fixture result selection/export/exclusive playback, runtime restart recovery and missing-source protection. No page errors or 1440px/390px document overflow.
- Existing user runtime on 8766 was blocked only inside the test browser; isolated runtime used 8765. Local-network permission was granted by automation. This proves the connected workflow under those explicit conditions, not manual permission prompts, normal installer startup on 8766, physical microphone or model inference. Original user data was not used or modified.

## 2026-11-14 installed Windows upgrade and data preservation

- Confirmed no active persisted generation/install jobs before upgrading. Copied existing application sources/scripts and all 20 data files to `%LOCALAPPDATA%\VoiceStudio\backups\pre-0.2.0-20261114-081323`; each copied data file matched its SHA-256 manifest.
- Executed the verified 0.2.0 Inno installer against the existing installation. `%LOCALAPPDATA%\VoiceStudio\logs\upgrade-0.2.0.log` reports successful installation, no Windows restart required and bootstrap process exit code 0.
- Actual installed runtime on port 8766 now reports Windows, version 0.2.0 and workspaces/voice_names/job_history capabilities. Authenticated API read returned both existing recordings and all three outputs; workspace list is empty as expected for this legacy data.
- All 20 original data file hashes still match the pre-upgrade manifest; native installed-environment `pip check` passed. This establishes upgrade/data-preservation/startup evidence on this PC, not a clean-machine install, backup restoration, physical recording or listening acceptance.

## 2026-11-14 production UI delivery

- Staged production deployment `dpl_A49CiT29kvLpNLPdvik5WVwLWGBg` without alias assignment; READY. JavaScript and CSS bytes matched the locally verified build; installer matched SHA-256 `083c1459321eb11a2c66daa62ae6892141d4e79313e0538514218143dae143f5`. HTML contained the corrected service description.
- Promoted that exact deployment. `recording-voice-web.vercel.app` now resolves to it; authenticated live HTML is byte-identical to the staged HTML. Production URL: `https://recording-voice-web.vercel.app`.
- Rollback reference: `dpl_HoLX4AJaH8dayvroXaJm9H4xFSFk`. Source is an uncommitted snapshot based on `1e4c20d5412a95b7aa839fe79eca89b58641e715`; snapshot file hashes saved at `/tmp/voice-production-source-manifest.json`.
- This delivers the verified studio UI, persistence and 0.2.0 installer. It does not adopt the experimental expressive engine or certify full service readiness. Production browser + installed user-runtime acceptance, clean installation, physical mic and listening acceptance remain outstanding.

## 2026-11-14 production browser with installed user runtime

- Native Windows Chrome opened the public production alias without injected Vercel credentials and auto-paired with the installed 0.2.0 runtime on its normal port 8766.
- Read-only verifier `scripts/verification/browser-installed.cjs` confirmed both existing voice cards and three generated-result cards; clicking playback advanced the actual reference and output audio timelines. Non-read API operations other than pairing were blocked by the verifier.
- Evidence: `%LOCALAPPDATA%\Temp\voice-installed-browser-GGUECi\evidence.json`. All 20 user data files remained byte-identical after the run; no browser page errors occurred.
- Local-network permission was granted through automation. This clears the production/installed-runtime listing and playback path, not physical microphone capture, auditory quality, new inference or manual permission-dialog usability.

## 2026-11-14 backup restoration rehearsal and user acceptance timing

- Copied the pre-upgrade backup into a separate temporary restore directory, verified all 20 manifest checksums and reopened all five WAV files with matching duration metadata. The installed native Windows 0.2.0 runtime read the restored two recordings, three outputs and ten jobs successfully.
- Restore directory: `/tmp/voice-backup-restore-8iiww39_/data`. Existing live data was not overwritten. This is a verified restoration rehearsal, not a user-facing backup/restore UI.
- User explicitly deferred physical recording and listening evaluation until implementation is finished ("완료되면 내가 진행함", "완료되면 확인함"). Continue independent implementation/verification without repeatedly requesting those evaluations. Final handoff must distinguish implementation/automated acceptance from the remaining user acceptance; do not count deferred perception checks as passed.

Execution order: stabilize regression baseline; durable work/voice metadata and versions; recording lifecycle and quality; browser acceptance; physical PC/real generation acceptance; release preparation and verification.

## 2026-11-11 regression baseline

- Frontend: `cd web && npm test -- --reporter=json --outputFile=/tmp/voice-tests.json`: 50 passed, 0 failed.
- Runtime: `.venv/bin/python -m unittest discover -s local_runtime/tests -q`: 33 passed.
- Build: `npm run build --prefix web`: passed after removing unsupported test query options.
- Updated obsolete book-first expectations to studio navigation, retained recording save handoff, saved audio playback, sample generation and output access assertions. Fetch fixtures now dispatch by endpoint rather than incidental request order.
- No real microphone, voice likeness or Windows installer acceptance is implied.
- Next: persistent local workspace/voice metadata, generation versions and final selection; preserve existing files and API compatibility.

## Persistent workspace foundation

- Added atomic local workspace storage with title, script, voice ID and final selection. Existing recording/output storage remains intact.
- Authenticated workspace list/create/update/select endpoints added; generation accepts optional workspace ID and carries it into jobs/results.
- Store restart, identity preservation, wrong-work selection and authenticated API round-trip verified. Runtime suite: 37 passed.
- Frontend workspace selection and result-version controls are not connected yet; items 8/11/12 remain incomplete.

## Workspace UI integration

- Workspace selector and explicit save now call local runtime endpoints. Generation first saves the current work and carries workspace ID.
- Results are filtered by workspace; each result retains its original script. Final selection calls the authenticated selection endpoint.
- Failed saves retain input and prevent generation. Restored workspace identity is retained across component remounts, and submission waits for workspace loading.
- Frontend: 53 tests passed before the final loading guard; rerun results follow. Work selection, save failure, generation binding, result isolation and final selection covered.
- Remaining: live browser/API round trip, active-job restoration, voice metadata persistence, physical recording and quality acceptance.

## Active generation recovery

- Added authenticated `GET /api/v1/jobs` over persisted job manifests.
- Generation workspace queries pending generations on entry and resumes polling; submission stays disabled until jobs and workspaces are loaded.
- Pending requests are serialized within each polling effect. Completed recovered output is inserted in result history and reported to the application.
- Frontend suite: 54 passed. After the polling guard, targeted generation suite: 8 passed, build passed. Runtime suite: 38 passed.
- This proves mocked UI restoration and real HTTP job-list authorization, not physical voice generation or a browser/runtime restart E2E. Job continuity remains partial until those checks pass.

## Persistent voice names

- New recordings submit a name in multipart data; manifests persist it beside the transcript and WAV metadata.
- Protected rename endpoint updates only name metadata and preserves audio/transcript. Legacy unnamed manifests remain readable.
- Voice library exposes name editing; successful changes update application recordings, studio list and generation voice options. Browser-local legacy names remain fallback display values until explicitly saved.
- Store restart/name validation/audio preservation regression passed. Client multipart name and authenticated rename requests covered.
- Frontend 55 passed; runtime 39 passed; production build passed. Full real-browser rename/reconnect acceptance remains to run.

## Recording input feedback and resource safety

- Input meter now reports measured RMS dBFS and digital-silence/quiet/input/near-clipping states. Values derive from analyser samples, not a synthetic waveform; these are signal levels, not voice-quality guarantees.
- Microphone selector remains visible with a single device. Device end events stop capture and expose a reconnect error.
- Failed connection initialization releases the newly acquired stream/context. Late microphone responses after unmount are discarded; suspended AudioContext is resumed during connection.
- Regression verifies silent/quiet/normal/near-clipping signal classification and releases acquired microphone on initialization failure.
- Full frontend suite: 58 passed; build passed. Physical microphone and disconnect acceptance remain outstanding.

## Real local API browser acceptance

Reproducible harness: `scripts/verification/browser-local.cjs` (requires an available Playwright module and Chromium executable, configured through PLAYWRIGHT_MODULE / CHROMIUM_PATH).

2026-11-11 run passed with isolated temporary storage `/tmp/voice-browser-data-dscUDf/evidence.json`:
- Chromium synthetic microphone → real MediaRecorder → pause/resume → 3.42-second WAV conversion → multipart API → filesystem manifest/audio.
- Name edit persisted into recording manifest; saved audio first playback advanced currentTime.
- Named workspace saved through the real authenticated API; page reload restored script and workspace ID without creating a duplicate workspace.
- No browser page errors.

No API requests were mocked. Microphone input was synthetic and inference was not requested. Physical Windows mic, installer, voice likeness and emotion quality remain unverified. The harness launches only its own servers and retains generated evidence in a temporary directory.

## Result selection, export and responsive acceptance

2026-11-11: extended `scripts/verification/browser-local.cjs`; passed against real local API and isolated storage at `/tmp/voice-browser-data-8wy7be/evidence.json`.

- Two result fixtures use the browser-recorded WAV, explicitly without inference. Final selection persists across page reload.
- Download is available before playback; downloaded bytes equal the stored WAV and the player remains paused.
- Deleting the final-selected result clears the workspace selection. Reopening the workspace shows the remaining result without a stale final marker.
- Desktop 1440px and mobile 390px populated screens captured and inspected; no document horizontal overflow. Inspection found an empty mobile download button (text hidden by responsive CSS); added the missing icon and repeated browser acceptance successfully. Replaced heart decoration with an audio waveform icon.
- Runtime regression suite: 40 passed in preceding change. Result card tests: 4 passed; production build passed after icon correction.
- This does not establish physical Windows capture, generated voice likeness/emotion, installation/update, or production parity. Overall release readiness remains incomplete.

## Unsaved recording navigation protection

- Recorder reports unsaved state during countdown/capture/pause/conversion/save and while an unsaved WAV exists. App navigation asks before discarding it; successful save retains the existing forward navigation.
- Browser `beforeunload` protection is registered only while a take is pending and removed on unmount. A browser confirmation is not crash recovery or durable backup.
- Regression checks active-take notification, unload cancellation and cleanup. Full frontend suite: 59 passed; final recorder suite: 3 passed; build passed.
- Real-browser harness passed at `/tmp/voice-browser-data-xHiefv/evidence.json`: dismissing navigation confirmation while paused and after capture preserves the take; subsequent save/playback/workspace/result flows complete successfully. Physical microphone and Windows acceptance remain outstanding.

## Runtime compatibility before studio entry

- Health advertises `workspaces`, `voice_names`, and `job_history`. Client checks the API contract and required capabilities before pairing/opening the studio.
- Older runtimes now show an explicit update-required screen with existing installer navigation rather than failing later on workspace APIs.
- Legacy-runtime rejection and update-screen behavior covered; frontend 61 tests and build passed, runtime 40 tests passed.
- Real local API/browser acceptance repeated successfully: `/tmp/voice-browser-data-feMyty/evidence.json`.
- Release dependency: rebuild and verify the Windows installer with this runtime before publishing the new frontend. Current downloadable installer has not been proven to contain these capabilities. This gate is not proof of installer/update success.

## Windows 0.2.0 package build

- Reproduced a packaging defect: the previous wheel contained only dist-info metadata, no runtime modules. Windows launcher working-directory source imports could mask this.
- Explicit package mapping now includes `local_runtime` and `local_runtime.app`. Built wheel contains entrypoint, main and workspace modules and imports successfully from an isolated directory outside the repository.
- Runtime/package/installer version is 0.2.0. Installer excludes build, dist and egg-info artifacts.
- Windows Inno Setup 6.7.3 compile succeeded; review artifact is `C:\Users\donghyunlee\AppData\Local\Temp\VoiceStudio-0.2.0-review\VoiceStudioSetup.exe` (2,109,452 bytes, product version 0.2.0).
- Runtime 40 tests passed. Existing installed app and published download were not replaced. A compiled installer does not prove clean install, upgrade, startup, or uninstall behavior; those remain release gates.

## Native Windows runtime and wheel acceptance

- Windows Python 3.12.10 from the existing installation reports no broken requirements (`pip check`). No dependency or existing app update was performed.
- Native Windows execution initially exposed three Linux-specific test assumptions: mocked Linux meminfo tests did not select Linux, and a Linux sysconf mock assumed the attribute exists on Windows. Corrected test OS setup without changing runtime behavior.
- Entire runtime suite now passes on both Windows and Linux: 40 tests on each. API tests launch actual isolated local servers with temporary storage.
- Added `scripts/verification/runtime-package.py`: extracts a wheel outside the repository, starts a subprocess on an available loopback port, verifies version/capabilities through HTTP, and terminates its own process.
- 0.2.0 wheel verification passed on both native Windows and Linux, reporting the matching OS and all required studio capabilities.
- These checks use existing Python dependencies. Clean-machine dependency installation, upgrade/rollback/uninstall, physical microphone and model quality are still not proven.

## Existing user output audit and generation wait

- User confirmed existing generated audio. Read-only audit found 2 recordings and 3 outputs in the Windows app data directory; all outputs reference the latest recording.
- All five WAVs are 24 kHz mono PCM16, with duration and byte count matching manifests; sampled digital clipping ratio is 0%. These checks do not establish likeness, pronunciation or emotional delivery.
- Existing outputs: 4.08 s audio / 115.78 s generation; 5.68 s / 141.78 s; 32.88 s / 712.74 s. Generation is approximately 21.7–28.4 times output duration. This is historical manifest timing, not a fresh benchmark of the changed release.
- Added actual elapsed time based on persisted job creation timestamp; reopening an active job preserves elapsed duration. No invented ETA or percentage is shown.
- Official model matrix at https://github.com/QwenLM/Qwen3-TTS lists Base voice cloning separately from instruction-controlled VoiceDesign/1.7B-CustomVoice. Current 0.6B-Base clone path has no explicit emotion instruction input. Expressive delivery remains an unmet product requirement; a cosmetic emotion selector would not satisfy it.
- Signal audit evidence: `/tmp/voice-existing-audio-audit.json`. Original audio and metadata were not changed or uploaded.

## Exclusive comparison playback

- Studio audio now pauses any previous active audio element when another starts. This covers reference preview, recordings and generated results through native captured play events.
- Unit behavior verifies previous playback stops and idle/current players are not paused. Frontend suite: 62 passed; production build passed.
- Browser acceptance `/tmp/voice-browser-data-b3lNBJ/evidence.json` verifies actual WAV playback: start A, start B, A pauses while B advances; then reopens and checks download before playback and final-result deletion.
- This provides sequential listening without overlapping audio, not a dedicated synchronized A/B comparison editor or perceptual voice-quality acceptance.

## 2026-11-12 workspace restoration and new-work isolation

- Reproduced two defects: an identity-only browser draft reopened saved work with blank fields; explicitly starting another script retained the previous workspace ID.
- Saved workspace fields now hydrate missing draft fields. Explicit initial text starts a new work; leaving generation clears the one-time application launch draft so normal return restores editing state.
- Editing waits for workspace loading, and session draft writes wait for restoration to finish, preventing a failed/late read from replacing the stored draft with empty defaults.
- Regression tests reproduce and cover both cases. Full frontend 64 passed; final focused generation 10 passed; build passed.
- Real API browser flow passed at `/tmp/voice-browser-data-Eq8W2u/evidence.json` before the final draft-write loading guard. Guard has focused test/build coverage; no new physical recording or inference claim.

## Interrupted generation recovery acceptance

- Latest failed generation for the restored/selected workspace is surfaced, including `runtime_restarted`, while active jobs retain priority. Historical failure from another workspace is not attached to the current draft.
- Retry action uses the preserved editable script and existing workspace identity. Frontend regression verifies the retry request; full frontend suite 65 passed and build passed.
- Real-browser harness now seeds an in-progress job manifest, stops its own local runtime, restarts it, reconnects the page, and verifies persisted failure state, visible interruption message and unchanged script.
- Passed evidence: `/tmp/voice-browser-data-jPeJcS/evidence.json`. The restarted job was a fixture; no model inference was running, so this proves storage/startup/UI recovery, not interruption safety inside the model engine.

## Missing source voice protection

- Removed silent substitution of the first available recording when a saved draft references a deleted voice.
- Missing source is visibly reported, preview is unavailable, and generation is disabled until the user explicitly selects an available voice. Work script and existing output versions are retained.
- Regression covers a missing saved voice alongside another available voice and explicit reselection. Frontend 66 passed; build passed.
- Real API browser acceptance `/tmp/voice-browser-data-Ej07FZ/evidence.json`: deletes its synthetic recording, reopens the associated work, verifies missing-voice feedback/disabled retry, preserved script and previous output. User recordings were not touched.

## Voice deletion failure recovery

- Voice deletion now exposes request failures instead of leaving an unhandled rejected promise. The voice stays visible until the API confirms deletion.
- Pending deletion disables repeated delete and rename actions; failure restores controls for retry.
- Regression holds the DELETE request open, verifies one request despite repeated clicks, returns an error, checks preserved transcript and visible error, then retries successfully.
- Frontend suite: 67 passed; production build and diff whitespace check passed. Error injection is a mocked UI/API boundary check, not proof of a real disk failure.

## Legacy name-cache validation after resume

- Previously reproduced non-string legacy cache values crashing name/title rendering (`trim is not a function`). Cache loading now accepts only string-valued entries while preserving valid names.
- Regression verifies invalid numbers/null/objects and denied/full browser storage. Existing runtime audio and manifest data remain untouched.
- Full frontend suite: 69 passed across 16 files; production build and whitespace check passed. This resolves the failing test left at the user-requested pause.

## Real browser permission denial and retry

- Browser harness now sets microphone permission to denied for the actual page browser context, verifies the denied message and disabled record action, grants permission, then reconnects and completes recording/save.
- Removed fake permission auto-accept; synthetic input device remains. The initial CDP descriptor/context attempts did not reach denial; corrected to `microphone` with the page target's browserContextId before accepting evidence.
- Full browser acceptance passed at `/tmp/voice-browser-data-GW56Lk/evidence.json`, including restart recovery, output comparison/export and missing source protection. No API mocking or product code change was needed for permission recovery.
- This proves Chromium permission state recovery with synthetic input, not Windows microphone hardware or manual browser permission-dialog usability.

## 2026-11-15 usable 0.3.1 production release

- Production: `https://recording-voice-web.vercel.app`, deployment `dpl_51segppi9nUo1PHCjRjvC7rtRfrV`. Staged deployment reached Ready, was promoted, and the public installer SHA-256 matched the compiled 0.3.1 file: `16d969aa9014d65198c3a1b5e27b1eb0e0a85796787c2b0b737dbf2a4c887f4a`. Previous deployment `dpl_9Mffbb1SL8ZpgQz8U2cqVbhACSwj` is the immediate rollback reference.
- Native Windows installer rerun finished with process exit code 0. Installed health reports 0.3.1. A pre-upgrade backup of 20 user-data files was made under `%LOCALAPPDATA%\VoiceStudio\backups\pre-0.3.0-20261115`; hashes matched after upgrade.
- Production Chrome with the installed runtime showed the expressive engine, two saved voices and four results. Existing voice and result playback advanced. Read-only browser acceptance left 25 user-data files unchanged.
- Production Chrome used the first saved voice and a work named `표현 음성 샘플` to generate new text with Chatterbox multilingual v2 at intensity 0.8. Job `5cbb2b7b-dcea-416a-9f43-fdd2d08b563c` completed; output `9c10a0e7-9598-46ee-a8ce-831eecbbe453` is a 7.16-second WAV. It played in the browser and remains in the work for user listening. Evidence: `%LOCALAPPDATA%\Temp\voice-production-generate-sBRo0r`. This proves browser to API to isolated worker to saved file to browser playback, but not subjective voice likeness or emotion quality.
- Backend suite 52 passed, frontend suite 72 passed and production build passed. Physical microphone, pronunciation/likeness and expressive delivery listening remain pending user verification. The formal 90% score is unestablished.

- Follow-up production mobile check: 390px expression screen rendered without horizontal overflow, with engine, intensity, voice choices, and result cards visible. Evidence: `%LOCALAPPDATA%\Temp\voice-installed-browser-egVGDz`.
- Reopened `표현 음성 샘플` in production Chrome and downloaded output `9c10a0e7-9598-46ee-a8ce-831eecbbe453`. Its 343,724 bytes matched the installed Windows data file byte for byte (SHA-256 `11c9193b7bd9ee6884fefb5efe4635016e48845d463155a46f652eaf9f741907`). This confirms persistent work and WAV export for the expressive result.
