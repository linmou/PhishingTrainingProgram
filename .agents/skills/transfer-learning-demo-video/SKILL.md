---
name: transfer-learning-demo-video
description: Record a real browser video of the transfer-learning room workflow and create a high-resolution, timestamped PNG contact sheet. Use when asked to demonstrate room setup, learner progress, assessment, answer, and the following tutor turn.
---

# Transfer Learning Demo Video

Intent: produce a watchable WebM and a readable PNG overview from one staging-backed browser run.

## Browser Run

1. Confirm the local app points to the intended staging project and its transfer migrations and Edge Function are deployed. Use existing tutor and learner application accounts. Keep credentials out of the recording.
2. Start recording on the tutor dashboard, before room creation. Create a fresh room with a relevant image, enable AI Assistant and Transfer Learning, and have the learner join through the Student Dashboard so a session exists.
3. Have the tutor approve a learner-scoped target in Learning Progress. Record the learner demonstrating it. The tutor clicks AI to generate an assessment, reviews the draft, and explicitly sends it.
4. Record the learner answering and the resulting progress. For the next turn, send a learner follow-up, complete any required response rating, then have the tutor click AI again. Show the tutoring suggestion and its sent chat message; confirm no new assessment draft appears.
5. Stop after the final message is visible. Verify the WebM plays, the PNG shows the key stages, and the hosted records show the expected progress plus tutor message modes `assessment` followed by `tutoring`. Report any stage that did not occur instead of presenting it as completed.

Playwright CLI can record the browser directly. Use a descriptive filename under `output/playwright/`; add on-screen chapter markers at meaningful transitions.

```bash
rtk proxy mkdir -p output/playwright
rtk proxy "$HOME/.agents/skills/playwright/scripts/playwright_cli.sh" video-start output/playwright/transfer-learning-demo.webm --size 1280x800 --cursor
rtk proxy "$HOME/.agents/skills/playwright/scripts/playwright_cli.sh" video-chapter 'Learner demonstrates the target'
rtk proxy "$HOME/.agents/skills/playwright/scripts/playwright_cli.sh" video-stop
```

## Timestamped Contact Sheet

Choose a sampling interval and tile grid that cover the whole video and include the final outcome. Keep each tile large enough to read. For a roughly ten-minute video, this command makes twelve 960x600 frames in a 1920x3600 PNG, with each frame labeled by its video time:

```bash
rtk proxy ffmpeg -y -i output/playwright/transfer-learning-demo.webm -vf "fps=1/50,scale=960:600,drawtext=text='%{pts\:hms}':x=18:y=18:fontsize=34:fontcolor=white:box=1:boxcolor=black@0.85:boxborderw=10,tile=2x6" -frames:v 1 output/playwright/transfer-learning-demo-timestamped.png -loglevel error
rtk proxy ffprobe -v error -show_entries format=duration,size -show_entries stream=width,height,codec_name -of json output/playwright/transfer-learning-demo.webm
```

Open the PNG at original resolution and check that timestamps, room setup, progress, assessment, answer, and next tutor response are visible. If sampling misses a stage, adjust the interval or select specific frames before sharing it.
