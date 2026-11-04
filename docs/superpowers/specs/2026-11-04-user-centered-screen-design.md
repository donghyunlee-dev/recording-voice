# User-Centered Voice Studio Screens

## Intent

Make every existing screen answer three questions at a glance: what can I do here, what should I do next, and where does my recording or story go? The target user is a parent recording their own voice and turning a short children's story into narrated scenes.

## Goals

- Present one clear primary action per screen and explain prerequisites beside that action.
- Use Korean task language. Avoid implementation terms such as `take`, model IDs, and technical file names as primary labels.
- Apply WindSoft semantic typography: page title 24px, section title 18px, body 14px, with labels and captions raised to at least 14px for this interface, using a 16px root size.
- Use WindSoft components and typography where they fit. Keep custom controls only for audio capture, waveform/level feedback, and the story scene viewer.
- Make the route flow clear: install and connect → record a voice → preview a story or generate speech → listen to and save the result.
- Preserve local-only audio/model processing and existing functionality.

## Non-goals

- Add voice recognition, audio editing, model choices, story content, or new persistence behavior.
- Rebuild the local runtime or change the Vercel deployment architecture.
- Treat multiple recordings as a merged voice profile; recordings remain separate selectable samples.

## Approaches

1. Keep the bespoke layout and patch small font sizes screen by screen. This is quick but leaves typography and component behavior inconsistent.
2. Replace the app with a new component library. This creates unnecessary migration work and risks changing working audio controls.
3. Use WindSoft typography tokens and components for common text, forms, cards, and actions, while retaining purpose-built audio/story visuals. **Selected:** it fixes the shared scale and keeps the specialized workflows intact.

## Screen decisions

- First use: show the active installation action only; reveal the next setup action after the user advances.
- Recording: prioritize the reading script, microphone readiness, record/pause/stop, preview, and save in that order.
- Saved voices: describe the existing data as saved recordings, with playback and deletion actions.
- Generation: make the selected recording, story text, model readiness, and generate action easy to review before starting.
- Results: lead with replay and WAV download; keep diagnostics secondary.
- Storybook: lead with story choice, scene navigation, and the action that sends the selected story to narration.
- Settings: group install/connection, PC resources, and local-data/privacy information by the user's reason for visiting.

## Constraints

- The Vercel page cannot install software directly. Installation requires a user-run local step.
- Audio and model data stay on the user's PC.
- Keep the UI responsive at desktop and mobile widths.
