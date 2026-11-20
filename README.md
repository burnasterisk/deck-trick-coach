# DeckCoach

A camera-based fingerboard trainer. Choose a trick, calibrate your board in the camera view, and get technique feedback from locally tracked finger motion, board rotation and landing behaviour.

## What this build does

- Runs as a static React app. No application server, account system, paid API or API key is required.
- Uses the browser camera (`getUserMedia`) and local MediaPipe `HandLandmarker` tracking. Hand inference runs in the browser; the pinned MediaPipe WASM bundle and model are downloaded from public static hosts when tracking starts. The camera frames are not uploaded for inference.
- Keeps hand tracking running while fingertip dots can be hidden independently.
- Includes 25 defined trick profiles across basics, flips, spins and grinds/slides. It analyses the selected trick, estimates board rotation, previews a ghost-deck movement and generates directional corrections. This is not yet an exhaustive catalogue of every fingerboard trick.
- Captures a short pre-roll in memory and keeps a clip only after a trick-like pop/flick attempt is detected. Clips can be replayed in slow motion and exported/shared from the browser.
- Offers daily practice, tutorials, trick-of-the-day and a weekly challenge draft.
- Stores sessions, challenge drafts and board profiles in browser storage. Board profile photos are processed locally.

## Board profiles

Press **Skate** to choose an existing board profile or create one. A profile records its name, plastic/wood material, grip, approximate width band, shape and optional board/truck photo. The material is the property currently connected to the trick analyser's different sensitivity/technique profiles. Grip, width and shape are saved as reference metadata; they do not yet change the physics model.

The photo tool includes a simple edge-connected, plain-background cutout. It works best when the board is photographed against a single-colour background. It is not object recognition or AI segmentation, and it cannot identify a manufacturer/model or infer exact dimensions, weight or concave from a photo. Width, shape and grip are stored as profile notes only; at present, only plastic vs wood changes the analyser profile.

## Important client-only limitations

A static, zero-server app cannot receive remote clip uploads, send challenge entries to an organiser, email winners or grant online premium access. MediaPipe's published privacy notice also says the Tasks library may send usage/performance metrics even though the image/video input stays on device; a strict no-outbound-requests build would need locally vendored model/WASM assets and a tracking implementation with no remote telemetry. The weekly challenge in this build saves an entry draft locally; it is **not** an official submission. The app now labels this clearly. A real competition/submission pipeline would require a destination service or an external form that the user intentionally opens.

Saved video clips currently remain in the active browser session. Download or share clips from the Clips drawer to keep them outside the session; automatic cross-refresh clip persistence is not implemented yet. Board profiles and training history use local browser storage and do not sync between devices. The board tracker analyses a small image region beneath the fingertips to estimate motion/rotation; it is not robust full-deck segmentation. Obstacle detection, obstacle dimension mapping and trick adaptation to obstacle geometry are not implemented in this build.

## Stack

React 19, Vite, TypeScript, Tailwind CSS v4 and `@mediapipe/tasks-vision`.

## Develop

```sh
npm install
npm run dev      # http://localhost:3000
npm test
npm run build
```

Camera access requires a secure context. `localhost` works on desktop; for a phone, deploy over HTTPS or use an HTTPS development tunnel.

## Deploy to Vercel

Import the repository into Vercel and use the Vite defaults:

- Build command: `npm run build`
- Output directory: `dist`
- Install command: `npm install`

`vercel.json` includes the SPA rewrite. No environment variables are required.

## Source map

- `src/App.tsx` – app shell, camera lifecycle and session logic
- `src/components/deckcoach/` – home, board-profile flow, overlays and drawers
- `src/lib/board-profiles.ts` – local board-profile model/storage
- `src/lib/tricks.ts` – trick data, motion signatures and cue text
- `src/lib/trick-analyzer.ts` – attempt scoring, matching and corrections
- `src/lib/board-tracker.ts` – board motion/rotation tracking
- `src/lib/camera.ts` and `src/hooks/use-camera.ts` – camera selection and lifecycle
- `src/hooks/use-hand-tracking.ts` – local MediaPipe hand tracking
- `src/hooks/use-clip-recorder.ts` and `src/lib/clips.ts` – event-triggered clip capture and replay/export
