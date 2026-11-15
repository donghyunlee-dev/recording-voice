# Expressive voice engine evaluation

Date: 2026-11-12. Product requirement: reuse a personal recorded voice to produce Korean speech with audible expression. Existing Qwen output remains the baseline. This is evaluation, not engine adoption or release approval.

## Evidence and candidates

| Candidate | Verified interface evidence | Limitation / next proof |
|---|---|---|
| Qwen 0.6B Base | Current application uses reference audio/text cloning | No explicit emotion instruction input in the current path; user likeness and expressive quality still require listening |
| Chatterbox Multilingual 0.1.7 | Published wheel declares Korean and exposes reference audio plus `exaggeration` | Expression intensity is not categorical happy/sad control. Windows CPU latency, likeness and audible contrast remain untested |
| CosyVoice 2/3 | Official examples combine reference audio and `inference_instruct2` | Korean instruction fidelity and Windows packaging still need empirical proof; examples alone are insufficient |

Sources: [Qwen model matrix](https://github.com/QwenLM/Qwen3-TTS#released-models-description-and-download), [Chatterbox multilingual source](https://github.com/resemble-ai/chatterbox/blob/master/src/chatterbox/mtl_tts.py), [CosyVoice examples](https://github.com/QwenAudio/CosyVoice/blob/main/example.py).

## Verified dependency boundary

The published Chatterbox 0.1.7 wheel was downloaded without installing or executing it and inspected. On Python 3.12 it requires Torch/Torchaudio 2.6.0 and Transformers 5.2.0. Installed Qwen 0.1.1 requires Transformers 4.57.3. Installing both into the existing runtime would violate one dependency contract. Use an isolated environment for the experiment.

PyPI metadata lists Windows Python 3.12 wheels for spacy-pkuseg 1.0.2 and universal wheels for resemble-perth 1.0.1 and s3tokenizer 0.3.0. This is availability evidence, not an installation or import result.

Primary metadata: [Chatterbox release](https://pypi.org/project/chatterbox-tts/0.1.7/), [spacy-pkuseg](https://pypi.org/project/spacy-pkuseg/1.0.2/), [resemble-perth](https://pypi.org/project/resemble-perth/1.0.1/), [s3tokenizer](https://pypi.org/project/s3tokenizer/0.3.0/).

## Experiment and acceptance

1. Install the candidate in an isolated Windows environment; run dependency and import checks without model download.
2. Pin exact model/source revisions before a model trial. Keep all audio local; preserve original files and write candidate output separately.
3. Use the same existing reference voice, Korean text, and hardware for baseline/candidate comparison. Record cold load, warm generation, peak memory, output duration and failures.
4. Compare at least two expression intensities on the same text. User listening must establish voice likeness, complete pronunciation, naturalness and audible expression differences. Waveform metrics cannot replace this.
5. Adopt only after the measured result meets the product need. Persist actual engine/revision/settings in result snapshots; expose only controls verified to affect output. Do not label intensity as named emotions.

Current experiment environment: Windows temporary directory `VoiceStudio-expression-5bf09b4e-4b6c-4657-bb43-d09b518717f4`. Existing application environment, model cache and user recordings are unchanged. Chatterbox trial results are recorded below; CosyVoice has not been run.

### Windows dependency and import result

Installation completed after an initial file-lock failure and retry once the previous installer processes had exited. Native Windows `pip check` passed. `scripts/verification/expression-import.py` exited successfully with offline Hugging Face settings and verified:

- Chatterbox 0.1.7, Torch/Torchaudio 2.6.0+cpu, Transformers 5.2.0.
- Multilingual class imports successfully and lists Korean support.
- Generation signature accepts text, language, reference audio and expression intensity.
- CPU-only Torch; no model loaded and no inference executed.

This import check clears dependency/import feasibility only. Subsequent model loading and generation evidence is recorded below; listening acceptance remains open.

### Reproducible model trial preparation

The download script `scripts/verification/expression-download.py` pins repository revision `5bb1f6ee58e50c3b8d408bc82a6d3740c2db6e18` and verifies the three weight files against Hugging Face's published LFS SHA-256 values. Required files total approximately 3.21 GB. The installed 0.1.7 package loads V2; this trial must not be reported as V3 despite the current model card advertising V3.

`scripts/verification/expression-trial.py` verifies the downloaded manifest, loads from the explicit local folder with Hugging Face offline settings, uses the same Korean script/reference/seed and CFG weight for intensities 0.5 and 0.8, and writes a new experiment directory. It records loading/generation times, output duration, clipping and whether the reference hash is unchanged. It refuses an existing output directory. Syntax checks passed; the first execution result is recorded below. Neither script uploads reference audio.

## Existing baseline selected for comparison

Read-only inspection confirmed two recordings and three generated outputs in the installed Windows application's data directory. Use output `b93aa3cc-1d54-46cf-945d-cf557e4bb2b4` and its reference recording `8af1464c-97f8-4379-b01f-36413fe4de71` for the first short comparison. Its text is “안녕하세요. 오늘은 제가 좋아하는 책을 읽어보겠습니다.”

The existing manifest reports Qwen 0.6B Base, 4.08 seconds of output, 32.01 seconds model load and 115.78 seconds generation. These are historical measurements, not a fresh benchmark; peak memory was not recorded. Keep the original audio and manifest unchanged. Voice likeness, pronunciation and expression have not been accepted through listening.

## Completed first Windows CPU trial

`trial-01/trial.json` in the isolated experiment directory reports successful generation of two 24 kHz WAV files with the original reference hash unchanged. Model loading took 14.343 seconds. Intensity 0.5 took 47.669 seconds for 3.72 seconds of audio; intensity 0.8 took 28.518 seconds for 3.52 seconds. Neither output had samples outside the PCM amplitude range. A process sample observed peak working set 7,075,799,040 bytes; this is not a complete system-memory trace. Both files and the original/baseline WAV files were reopened and validated as nonempty mono PCM audio.

Both generations logged repeated-token detection and forced EOS. Full pronunciation, likeness and expression remain unaccepted; shorter generation time does not establish quality or a controlled speed improvement over the historical baseline. `trial-01/comparison.html` embeds the reference, baseline and both candidate WAV files for local listening with exclusive playback.

The first load also downloaded a 34.6 MB pkuseg asset from GitHub into the user's `.pkuseg` cache, despite Hugging Face offline settings. It logged a missing Cangjie mapping in the Hugging Face cache. Therefore this is **not a verified offline-installation result**. Packaging must account for these eager Chinese-tokenizer dependencies before adoption. The original recording was read locally; no voice-upload operation was used. The candidate remains outside the application.

## Isolated worker implementation, 2026-11-15

- Added `expression_worker.py` for the engine interpreter and `expression_generation.py` for API-side subprocess execution. No engine dependencies are imported into the Qwen API interpreter. The wrapper bounds execution time, preserves worker diagnostics, reports phases and returns audio/settings metadata. UI/installer integration is still pending; endpoint integration is recorded below.
- Worker validates script/intensity, exact model revision and checksums, local segmenter files and pinned segmenter ZIP. The first worker run correctly failed with `expression_network_access_blocked`: pkuseg checks the ZIP even when extracted files exist. Added ZIP requirement/checksum regression and supplied the verified archive (`b216e7f92de7ae285aeab8feba2faa8ea8216e5995ff6fb3d391cc8356db1bfe`).
- `worker-02/status.json` in the existing Windows experiment directory reports completed generation at intensity 0.8: loading 8.118 seconds, generation 33.152 seconds, model revision preserved. Python socket connection/DNS audit hooks blocked network access during this run; this is not an OS-firewall proof. Memory metric returned null and is not a measured value.
- The upstream forced-EOS/repeated-token warning remains; the generated WAV is not yet accepted for pronunciation/likeness. User has deferred listening until implementation is finished.
- Linux full backend suite: 46 passed. Native Windows worker/wrapper tests: 5 passed, covering validation, asset integrity, subprocess result, timeout and failure. Wrapper tests use a small worker fixture; direct real worker generation is separate evidence. Existing production API and UI are unchanged by these new modules.

## API routing and settings persistence, 2026-11-15

The generation endpoint now routes the explicitly selected Chatterbox model to the isolated subprocess wrapper. It validates finite numeric expression intensity between 0 and 1 (default 0.5), rejects expression settings on Qwen, and records the selected model revision and intensity with the output. Missing installations and insufficient available memory reject admission; the candidate uses a conservative 7.0 GiB available-memory threshold, based on the observed roughly 6.59 GiB trial peak plus margin, not a measured minimum. Qwen remains the default and is not silently substituted for the expressive engine.

The isolated interpreter and model paths can be supplied with `LOCAL_VOICE_EXPRESSION_PYTHON` and `LOCAL_VOICE_EXPRESSION_MODEL_DIR`. Automatic installation, model catalog/UI selection, workspace settings, and real endpoint inference remain pending. This source change has not been deployed or included in the published installer.

Verification: Linux backend suite 49 passed; native Windows expression API/worker/wrapper suite 8 passed. API tests use a mocked engine to verify routing, job transitions and output metadata; they do not prove real inference through the endpoint or subjective audio quality.

## Live API admission and workspace settings, 2026-11-15

Added `scripts/verification/expression-api.py` to start a native Windows loopback API against a new data directory, copy the existing reference without changing its source, pair, request real expression generation, poll the job, download/validate the resulting WAV and verify the original reference hash. No engine, memory or HTTP mocks are used.

`api-02` in the existing experiment directory reached the real endpoint but received HTTP 409 `memory_insufficient`; it did not generate an output. The admission threshold was not bypassed. Real API inference remains unverified. `api-01` also received 409 but its initial harness did not retain the response body; do not infer its reason from that run alone.

Workspace updates now persist typed generation settings (model and expression intensity), preserve those settings when older clients omit them, and allow explicit replacement when switching engines. Invalid model/intensity combinations are rejected at the request boundary. Tests cover restart persistence and legacy updates. Linux backend suite: 51 passed. UI restoration/selection and installer integration remain pending.

## Studio settings connection, 2026-11-15

The model catalog advertises the expressive engine when its isolated interpreter and manifest are present. Studio now offers engine selection when multiple engines are available, restores model/intensity from the saved work or session draft, submits the intensity with generation, and shows the intensity on expressive results. An unavailable saved engine remains selected and blocks generation rather than silently selecting Qwen; saving preserves its intensity. A single baseline engine keeps the existing compact layout.

Installer support and rendered visual verification of these new controls remain pending. Catalog availability checks interpreter/manifest presence; full asset integrity is verified by the worker, not the catalog. New frontend tests exercise restored settings, changed-intensity submission and unavailable-engine preservation. No deployment of this UI change has been performed.

## Rendered controls and installer preparation, 2026-11-15

The real local browser/API harness passed with expressive settings enabled: keyboard ArrowRight adjusted intensity to 0.55, save/reload preserved model and intensity, recording/result lifecycle checks passed, and rendered 1440px/390px screenshots had no horizontal overflow. Screenshots were visually inspected at `/tmp/voice-browser-data-S5VduJ/results-{1440,390}.png`; evidence is in that directory. This Linux browser run used the existing candidate manifest for catalog availability, performed no inference, and does not prove native Windows generation.

Added an installer task for the isolated expressive engine, a PowerShell installer with pinned torch/torchaudio 2.6.0, chatterbox-tts 0.1.7 and transformers 5.2.0, dependency/import checks, and the asset installation module. Asset installation pins all five model hashes plus the segmenter ZIP hash, extracts only the two expected segmenter members, and publishes the availability manifest last. Failed checksum verification removes the installation marker. The regression test checks verified extraction, ignored ZIP path traversal entries and failed-repair availability. Backend suite: 52 passed. Both PowerShell scripts parsed successfully. Full installation and real generation through this installer are pending; the published installer and production frontend have not been changed.

## One-off Windows CPU thread comparison, 2026-11-15

The released four-thread production sample required 61.429 seconds of generation for 7.16 seconds of audio. A separate eight-thread worker run with the same reference, text, intensity and seed completed in 56.288 seconds (model load 7.484 seconds). This is one noncontrolled run in a separate environment; it does not prove a repeatable improvement or equal listening quality. The released setting remains four threads. The eight-thread audio is only in the local experiment directory and was not added to user data.
