# White Storybook Voice Studio UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix Voice Studio to a light theme and make recording, story reading, voice selection, and generated transcripts feel like a simple picture-book activity shared by a child and parent.

**Architecture:** Keep the existing React/Vite app and WindSoft semantic tokens. Add one accessible card-selection pattern for short and long option lists, then apply a shared picture-book reading treatment to story text without changing local audio/runtime data flows. Deliver each screen group separately, deploy it, and inspect the deployed Windows Chrome screen before starting the next group.

**Tech Stack:** React 19, TypeScript, Vite, `@windsoft/ui` 0.9.0, semantic CSS tokens, Vitest, Testing Library, Windows Chrome Agent Desktop.

**Spec:** `docs/superpowers/specs/2026-11-05-visual-first-screen-improvement-map.md`, sections “추가 요청: 고정 화이트 테마와 함께 읽는 동화 경험” and “RV-01–RV-09”.

## Global Constraints

- Force `data-theme="light"` and `color-scheme: light` regardless of Windows/macOS/browser color preference.
- Use existing WindSoft semantic tokens and add no package dependencies.
- Convert choices with up to 3 items to visible card choices; render 4 or more items in a horizontal, snap-aligned card rail.
- Hide the card rail’s horizontal scrollbar while retaining touch, keyboard, focus scrolling, and named previous/next controls; do not hide page-level scrolling.
- Keep actual story text, selected work names, recording state, errors, legal consent, and screen-reader names available. Remove explanatory interface copy only when the state or action remains clear.
- Use a calm white app canvas with a warm paper accent and a small parent-child reading illustration; keep settings and runtime status visually quiet and operational.
- Preserve local runtime, recording, saved audio, model installation, and generation behavior.
- After each screen group, run its focused tests and `npm run build`, push the scoped change to `master`, wait for the Production deployment to become `READY`, and verify the same content in Windows Chrome at wide and narrow sizes before continuing.

## Review Focus

- Dark operating-system preference still forces a dark surface — Task 1 verifies the deployed computed canvas and form-control scheme.
- A short option group has no selection or visually ambiguous selected state — Task 2 tests selected radio state and keyboard changes.
- A long option rail hides its scrollbar but cannot be discovered or operated by touch/keyboard — Task 2 tests named controls and focusable options; deployed visual review checks the rail edge cue and no bottom track.
- Narration ends with a one-word line such as `지요.` or `요.` — Tasks 3, 5, and 6 add exact content assertions; Task 7 checks real browser wrapping at each target width.
- Parent-child visual details crowd the story or reduce readability — Task 5 checks the picture-book hierarchy and contrast at mobile and desktop sizes.

---

### Task 1: Fix the theme and simplify the shared shell

**Files:**
- Modify: `web/index.html`
- Modify: `web/src/styles.css`
- Test: Windows Chrome Production browser review at 1920×1020 and 650×930.

**Interfaces:**
- Consumes: WindSoft semantic CSS tokens from `@windsoft/ui/global.css`.
- Produces: A permanently light `documentElement` and a shared light shell for all routes.

- [x] Set `data-theme="light"` on `<html>` and declare `color-scheme: light` so the library’s `prefers-color-scheme: dark` rule cannot darken the application or native controls.
- [x] Update shared navigation and header styling to the white canvas, warm neutral surfaces, readable contrast, and one visible active-route cue; remove the repeated mobile route label when the active navigation item already identifies the page.
- [x] Build with `cd web && npm run build` and check `git diff --check`.
- [x] Deploy to Production; on a Windows system set to dark appearance, confirm the application canvas, settings, browser-native controls, and top navigation remain light at 1920×1020 and 650×930.

**Task 1 verification:** `npm run build` passed; `git diff --check` passed. Commit `f807142` is on `master`; Vercel Production deployment `dpl_7fk7RTMvRuDcNyZVaeQxqe8XDwtb` is `READY` at `https://recording-voice-web.vercel.app`. Windows Chrome was set to 1920×1020 and 650×930 while the OS/browser chrome used a dark appearance. Captures `rv01-task1-wide-connected.png`, `rv01-task1-settings-wide.png`, `rv01-task1-narrow.png`, and `rv01-task1-settings-narrow.png` show light app surfaces and light native selects; the active route remains visible in navigation. The initial connection page still requires one explicit “이 PC에 연결” gesture and then opens the recorder as connected; retain the gesture and review its first-run layout in Task 7. The production screenshot also confirms the recorder still has native selects and plain script editing, which remain scheduled for Tasks 2–3.

### Task 2: Add accessible card selection for short and long lists

**Files:**
- Create: `web/src/components/ChoiceCardGroup.tsx`
- Create: `web/src/components/ChoiceCardGroup.test.tsx`
- Modify: `web/src/styles.css`

**Interfaces:**
- Consumes: Option `value`, title, optional short detail/icon/status/disabled flag, and the selected value from recorder/generation screens.
- Produces: `ChoiceCardOption { value: string; title: string; detail?: string; icon?: ReactNode; status?: ReactNode; disabled?: boolean }` and `ChoiceCardGroup({ name, legend, options, value, onChange })`, rendered as a labeled fieldset of native radios. Up to 3 options use a static grid; 4 or more use a horizontal rail.

- [x] Add tests `marks only the chosen card as selected` and `supports arrow-key selection across options` using three options.
- [x] Run `cd web && npm test -- --run src/components/ChoiceCardGroup.test.tsx` and confirm the selection/keyboard expectations fail before implementation.
- [x] Implement the card group with a visually hidden legend, native radio semantics, selected/disabled states, `scroll-snap-type: x mandatory` for long lists, partial next-card visibility, and named previous/next controls.
- [x] Add `scrollbar-width: none` and the WebKit equivalent only to the card rail; keep focused options in view and preserve horizontal touch/keyboard scrolling.
- [x] Add test `uses a horizontal rail for four or more options` and confirm its scroll controls have accessible names.
- [x] Run the focused test file, then build. Deploy this component with its first use in Task 3, rather than shipping an unused component by itself.

**Task 2 verification:** `ChoiceCardGroup.test.tsx` passes 3/3 assertions for selected state, native arrow-key selection, and the four-option rail/control names. The component shipped with the recorder in commits `8805d3d` and `4661fe1`.

### Task 3: Rework the recording screen and script editor

**Files:**
- Modify: `web/src/features/recorder/Recorder.tsx`
- Modify: `web/src/features/recorder/Recorder.test.tsx`
- Modify: `web/src/styles.css`

**Interfaces:**
- Consumes: `ChoiceCardGroup` from Task 2, `narrationPrompts`, existing microphone enumeration, and existing recording callbacks.
- Produces: Card-based story/device selection and an editable book-page script surface before recording controls.

- [x] Replace the story-prompt `<select>` with a three-card group; selecting a card must put the same exact prompt text into the editable script.
- [x] Replace the microphone `<select>` with the card group; use the grid for 1–3 devices and the horizontal rail for 4 or more. Preserve default-device and permission/error states.
- [x] Style the script editor as a warm white reading page with a clear edit affordance, 19–20px text, comfortable line height, and a readable line length; retain its accessible label.
- [x] Keep input level, timer, recording state, start/pause/stop controls, and import behavior. Reduce redundant field explanation while keeping accessible labels.
- [x] Update `keeps the script, microphone and record controls in a compact visual workflow` to select a story card instead of a combobox; add `selects a microphone card and locks choices while recording`.
- [x] Run `cd web && npm test -- --run src/features/recorder/Recorder.test.tsx src/components/ChoiceCardGroup.test.tsx`, then build and deploy.
- [x] In Production Windows Chrome, verify 1920×1020 and 650×930: story options, script, microphone state, level, timer, and recording controls fit the intended reading order; the card rail has no bottom scrollbar.

**Task 3 verification:** Full Vitest suite passes 39/39; `npm run build` and `git diff --check` pass. Production deployment `dpl_DYW2Vw18FBf3BM9cgb1YwJEHKDzQ` was reviewed in Windows Chrome at 1920×1020 and 650×930. Captures `rv01-task3-wide-story-final.png`, `rv01-task3-narrow-final-story.png`, and `rv01-task3-narrow-scroll.png` show three story cards in a grid, selected story text on a warm page, Korean words kept intact, and the meter/timer/recording actions available after scrolling. Follow-up commit `718449f` removes the redundant recorder card title and is deployed as `dpl_5vWaXFvQ6Yojs6ENYnGhTxp6kN89` (`READY`); its exact post-title-removal screenshot is deferred to the full-screen final review because Windows Chrome was covered by the Codex Terminal during the attempted recapture.

### Task 4: Rework voice/model selection and generated script editing

**Files:**
- Modify: `web/src/features/generation/GenerationWorkspace.tsx`
- Create: `web/src/features/generation/GenerationWorkspace.test.tsx`
- Modify: `web/src/styles.css`

**Interfaces:**
- Consumes: `ChoiceCardGroup`, current saved recordings, `listModels`, and `generationDraft`.
- Produces: Card selection for reference voices and models, with the same book-page style for editable narration.

- [x] Add failing tests `selects a saved voice from a card` and `shows installed model state on the selected model card` using existing recording/model fixtures.
- [x] Replace both native `<select>` elements. Up to 3 saved takes/models use cards; larger lists use the horizontal rail. Cards show only distinguishing metadata, waveform/model icon, and a visual selected/installed state.
- [x] Apply the script reading/editing surface to the generation textarea and preserve the existing generation, download, model installation, license, memory, error, and cancellation behavior.
- [x] Run `cd web && npm test -- --run src/features/generation/GenerationWorkspace.test.tsx src/components/ChoiceCardGroup.test.tsx`, then build and deploy.
- [ ] Verify a saved voice, installed model, and `storybook` draft in Production Windows Chrome at wide/narrow sizes. Confirm no native select remains in the two selection areas and the rail track is hidden.

**Task 4 implementation status (screen verification pending):** The two card-selection tests failed against the old selects, then the focused suite passed 5/5 after the change. `npm run build` passed. Commits `305d74e` and `0360166` are on `master`; Production deployment `dpl_8JJ9WMP3nMzzsFcAWeMKiFQWWvCu` for `0360166` is `READY`. The voice card shows date/duration, the model card shows its localized language and visible install state, and the draft editor uses the warm book-page surface. Windows Chrome was pointed at the deployed `?rv=305d74e` URL, but the captured page body was entirely black (`rv01-task4-reload.png`); the desktop capture showed only the wallpaper, Chrome foregrounding returned `ACTION_FAILED`, and `snapshot --surface focused` returned `WINDOW_NOT_FOUND`. These are automation/session conditions, so no visual layout result is claimed. Resume this exact browser check when Windows has a foreground interactive Chrome surface; do not proceed to Task 5 first.

### Task 5: Give story choice and narration a shared picture-book identity

**Files:**
- Modify: `web/src/features/storybook/StorybookPage.tsx`
- Modify: `web/src/features/storybook/StorybookPage.test.tsx`
- Modify: `web/src/features/storybook/storybookData.ts` only if the chosen small illustration requires local content metadata.
- Modify: `web/src/styles.css`
- Create: `web/public/storybook/reading-together.svg` only if a suitable existing parent-child illustration is not already in the asset set.

**Interfaces:**
- Consumes: Existing story cards, scene image/narration/source data, and `storyScript`.
- Produces: A warm story-choice cover and an open-book scene view that keeps narration readable and actions secondary.

- [ ] Add test `renders story choices as picture-book covers without summary copy` and update existing title/card assertions.
- [ ] Use a restrained parent-and-child-reading illustration as a small welcome motif; keep each story’s own illustration and title as the choice. Do not add explanatory paragraphs.
- [ ] On desktop, lay the scene illustration and narration as two facing book pages with a subtle central binding. On narrow screens, stack the illustration above a warm paper text page and place scene navigation directly beside/under the page.
- [ ] Use the existing scene sentences as paragraphs rather than inserting viewport-specific hard breaks. Set narrative measure, line height, Korean word wrapping, and page padding to avoid isolated final words. Keep image alt text and source details accessible.
- [ ] Keep previous/next, progress, and “이 이야기로 음성 만들기” available; simplify secondary copy into icons with accessible names.
- [ ] Update/add test `keeps narration text and actions in the reading-page hierarchy` and verify story-script transfer still contains every sentence.
- [ ] Run `cd web && npm test -- --run src/features/storybook/StorybookPage.test.tsx`, then build and deploy.
- [ ] Verify all three story covers and at least the longest scene at 1920×1020, 650×930, and 390×844 in Production Windows Chrome. Confirm no one-word widow, image/text collision, or visible card rail scrollbar.

### Task 6: Use book typography for saved and generated transcripts

**Files:**
- Modify: `web/src/App.tsx`
- Modify: `web/src/features/results/AudioOutputCard.tsx`
- Modify: `web/src/features/results/AudioOutputCard.test.tsx`
- Modify: `web/src/App.test.tsx`
- Modify: `web/src/styles.css`

**Interfaces:**
- Consumes: The existing saved recording and output text strings.
- Produces: A consistent read-only story page for transcripts with recording/result controls outside the text measure.

- [ ] Add test `renders saved transcript as readable story content` in `App.test.tsx` and extend the output-card test to assert the transcript reading container while preserving the exact supplied text.
- [ ] Apply the shared book-page surface to saved recording and generated-result text. Keep date/duration/play/delete/file details in a separate compact toolbar.
- [ ] Do not insert or delete transcript content, alter stored line breaks, or change save/delete/audio flows.
- [ ] Run `cd web && npm test -- --run src/App.test.tsx src/features/results/AudioOutputCard.test.tsx`, then build and deploy.
- [ ] Verify a transcript ending in `요.` at 1920×1020, 650×930, and 390×844. Adjust measure/font size until no last line consists of one short word and controls remain visually separate.

### Task 7: Typography, viewport, and screen-wide acceptance

**Files:**
- Modify as needed: `web/src/styles.css`, `web/src/components/AppShell.tsx`, and screen files from Tasks 3–6.
- Update: `docs/superpowers/specs/2026-11-05-visual-first-screen-improvement-map.md` with deployed evidence for each screen ID.

**Interfaces:**
- Consumes: The deployed groups from Tasks 1–6.
- Produces: A final matrix of verified text flow, responsive proportions, and hidden-scrollbar behavior for RV-01–RV-09.

- [ ] Use `text-wrap: balance` on headings and `text-wrap: pretty`, `word-break: keep-all`, and appropriate `widows`/`orphans` values on story text; tune actual line measure rather than relying on CSS declarations alone.
- [ ] Inspect title/body font size, line height, paragraph width, punctuation placement, final line, control wrapping, and horizontal overflow at 320, 375, 390, 650, 1024, and 1920px.
- [ ] Check the first connection state, recording, saved recordings, story choice, story viewer, generation, results, and settings. Preserve necessary status/error/legal text and screen-reader labels while removing redundant interface explanations.
- [ ] Run `cd web && npm test -- --run`, `cd web && npm run build`, and `git diff --check`.
- [ ] For the last Production build, capture Windows Chrome wide/narrow screenshots and record the deployment ID, commit SHA, viewport/content dimensions, and any remaining scroll requirements in the existing screen map.
