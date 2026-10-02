---
name: demo-video-recording
description: Record a real application workflow as a watchable demo video, with a timestamped visual overview when useful. Use when asked to capture a product or feature demonstration.
---

# Demo Video Recording

Intent: show the requested workflow from its starting context through a visible result in one coherent recording.

## Record

1. Identify the audience, the actions to show, and the final state that proves the workflow worked. Use the environment and accounts appropriate to the request; check project-specific browser or data guidance before a live run.
2. Prepare the app and recording area so the UI is readable at the chosen resolution. Keep credentials, private data, and setup steps that do not belong in the demo out of view.
3. Start recording before the first meaningful action. Perform the workflow in the real application, at a pace that makes state changes readable. Add chapter markers at major transitions if the recorder supports them.
4. Stop after the outcome is visible. Save the video under a descriptive name in the requested output location, or a local output directory when none is given.
5. Play or inspect the saved video. Confirm the important steps, final state, legible UI, and audio when relevant. Check any backend or external claims against their source before reporting them. State clearly when a requested stage did not occur.

Use a browser recorder for browser workflows and a screen recorder for other apps. Prefer the project's existing recording tools and instructions. For a browser app with Playwright CLI available, its `video-start`, `video-chapter`, and `video-stop` commands can capture one continuous WebM.

## Visual Overview

When the user requests a contact sheet or the video is long enough that an overview helps, create a timestamped PNG from the finished video. Choose frames that cover the key transitions and final result; keep each tile large enough to read. `ffmpeg` can sample or select frames, label them with video time, and tile them. Inspect the PNG at original resolution and adjust the selected frames if it misses a key stage.

Deliver links to the video and any overview, with a short account of what the recording actually shows.
