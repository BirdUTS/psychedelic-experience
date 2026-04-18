# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project shape

Single-file interactive art piece. The entire application — HTML, CSS, and ~1800 lines of JavaScript — lives in `index.html`. There is no `package.json`, no build step, no bundler, no linter config, no test framework. Editing the file *is* editing the app.

## Running and iterating

- **Run locally**: open `index.html` directly in a browser, or serve the directory over HTTP (e.g. `python3 -m http.server`, `npx serve`). A static server is preferable because microphone access via `getUserMedia` requires a secure context — localhost counts, `file://` sometimes does not.
- **No tests, no lint, no typecheck.** Verify changes by loading the page, picking Observe or Journey, and watching scene transitions (the director rotates every 15–30 s, or forces a cut on a bass hit > 0.7). Toggle individual layers via the bottom HUD to isolate a class during debugging.
- **Mobile verification matters**: the app auto-requests fullscreen on mobile UAs, duplicates every mouse event handler for `touchstart`/`touchmove`/`touchend`, and must call `AudioContext.resume()` on the first touch because iOS suspends it. When changing input or audio code, test a touch device or device-emulation mode.

## Architecture

Everything is defined inside one `<script>` block in load order. `window._app = new App()` at the bottom kicks it off. There is no module system — classes reference each other by hoisted name.

### Frame loop (`App._loop`)

`App._loop` is the single `requestAnimationFrame` driver. Every system has an `update(dt, …)` method called in a fixed order, then `App._renderMain` draws layers in a fixed z-order. The whole loop body is wrapped in `try/catch` so a throw in one visualizer won't freeze the page — check the console, don't assume silence means success. `dt` is clamped to `[0, 0.05]` to survive tab backgrounding.

### Scene system (the core abstraction)

- `SCENES` (top of script) is an array of seven named palettes — `Collatz Forest`, `Cellular Genesis`, `Sacred Geometry`, `Neural Web`, `Chemical Dreams`, `Wormhole`, `Cosmic Dance`. Each entry lists per-layer weights (0–1), hue/saturation/lightness ranges, a background hue/lightness, and a speed multiplier.
- `SceneDirector` owns `weights` (currently displayed) and `targetWeights` (set by the active scene). Each frame it lerps `weights` toward `targetWeights` with a slightly faster fade-out than fade-in. Transitions crossfade palettes for `fadeDur` (~4.5 s) via `blendedScene()`.
- Layers are **not** booleans at render time. `App._layerActive(name)` returns the director's current weight (0–1), which the renderer uses as `globalAlpha`. This is how scenes smoothly dissolve in and out.
- The bottom HUD lets the user manually toggle layers. When they do, the layer name is added to `App.userOverrides`, and `_layerActive` starts honoring the boolean in `App.layers` instead of the director weight. Preserve this override behavior when touching layer activation.

### Modes

Two entry modes chosen on the splash screen (`ModeSelectScreen`):

- **Stationary ("Observe")** — `App.camera` is `null`; everything renders in screen space.
- **Journey ("Journey")** — `App.camera` is a `JourneyCamera` that advances along +z, runs an aggressive "maneuver" state machine (banking turns, dives, barrel rolls, zoom rushes) with targets re-rolled every few seconds or on a bass hit, and applies a 2D transform (translate + rotate by `roll` + scale by `zoom` + pitch/yaw as translate) to the canvas for all non-particle content. Particles instead use `camera.project(x,y,z)` for true 3D perspective and get respawned ahead of the camera in `_respawnJourneyParticles`.

### Systems

- `BreathingSystem` — ~12 BPM sine driving scale/alpha throughout.
- `TimeSystem` — time-of-day → hue shift, speed modifier, chaos. Don't remove the `timeSys` argument from update signatures; several visualizers read `minutePhase` and `hueShift`.
- `ColorSystem` — single source of HSL truth. Always route color through `colors.hsl(hueOffset, alpha)` / `colors.hslValues(offset)` so palette transitions stay consistent across layers.
- `AudioSource` — owns the shared `AnalyserNode`. `set(kind, opts)` routes one of four inputs (`mic`, `demo:drift`, `demo:pulse`, `file`) into that analyser; demo and file sources are also wired to `ctx.destination` so you actually hear them. `stop()` tears everything down. Only the selected source is alive at a time.
- `DEMO_TRACKS` — procedural WebAudio compositions (`drift` ambient pad, `pulse` 98 BPM groove). Each entry's `build(ctx)` returns `{ output, stop() }`. These exist so the app has something musical to react to even without a mic or a file.
- `AudioAnalyser` (the `App.mic` field, legacy name) — generic FFT consumer. `attach(analyser)` binds it to whatever analyser `AudioSource` is driving; downstream visualizers keep reading `bass` / `mid` / `treble` / `volume` (all 0–1, smoothed) unchanged. When detached, `mic.fallback(t)` synthesizes plausible values so the loop never stalls. Treat `audio` as always-valid in the loop.
- `VisualAnalyser` (`App.visual`) — Phase 2 driver. Reads a user-uploaded photo (`Image`) or looping video (`<video>`) into a 64×64 offscreen canvas every frame and emits the **same** `bass` / `mid` / `treble` / `volume` shape as `AudioAnalyser` (plus `flowX` / `flowY` for future subject-mode work). Mapping: `volume` = mean luminance, `bass` = large-scale block std-dev + frame-to-frame flow, `mid` = overall contrast, `treble` = edge/gradient energy. Still photos add slow LFO modulation so signal isn't flat. When `visual.active`, the frame loop copies its four signal fields into `this.mic` so every downstream visualizer keeps reading `this.mic.xxx` unchanged — only one driver writes per frame.
- `SoundEngine` — WebAudio drone + move/hold/ambient layers + click "ping". Quantizes to a pentatonic scale via `_q(freq)`. Must be `init()`-ed only after a user gesture; `ctx.resume()` is called defensively on entry and on every `touchstart`.
- `ParticlePool` — fixed-size typed-array pool with `spawn/update/draw`. Type codes in `type[]` drive different behaviors: 0/4 are mouse-attracted, and journey particles are type 4 with a z-coordinate.
- Visualizer classes (`ReactionDiffusion`, `StrangeAttractor`, `LissajousSystem`, `FourierMandala`, `GeometryEngine`, `TunnelEffect`, `SpiritLights`, `CollatzTree`, `GameOfLife`) each own their state and expose `update(dt, …)` and `draw(ctx, W, H, colors, …)`.

## Conventions that are easy to miss

- **Additive blending is the default look.** Layers draw with `ctx.globalCompositeOperation = 'screen'` inside a `save/restore`. New visuals that don't do this will look muddy against the rest.
- **Names are aggressively shortened** inside classes (`tp`, `td`, `ps`, `pv`, `cx`, `cy`, `_fol`, `_mc`, `_sy`). This is deliberate; match the surrounding style rather than expanding. Top-level class names and public methods stay readable.
- **Section headers** use `// ═══…` box-drawing banners with the system name between them. Keep this when adding new top-level systems — the file is navigated by scrolling.
- **Adding a new visual layer** requires four coordinated edits: instantiate it in `App` constructor, call `update` in `_loop`, draw it (gated by `_layerActive('name')` and its weight as `globalAlpha`) in `_renderMain`, and add its name as a key in every `SCENES` entry's `layers` object plus the `allLayers` array in `SceneDirector._applyScene`. Also add a HUD `<button data-layer="name">` in the markup and an entry in `App.layers`.
- **Every new `SCENES` entry** must set a weight (including 0) for every known layer, because `_applyScene` zeroes known layers then copies the scene's entries over — a missing key silently keeps the previous weight.
- Journey-mode code paths and stationary paths diverge at `const cam = this.camera && this.camera.active ? this.camera : null;` in `_renderMain`. When touching rendering, think through both.
- **Audio source is picked on the splash screen**, not inside the experience. `App.selectedSource` (`'demo:drift'` default) and `App.selectedFile` are set by the `#source-pills` click handlers and the `#file-input` change handler in `_setupEvents`. `_startExperience` is `async` — it waits on `audioSrc.set(kind, opts)` and falls back to `demo:drift` if mic permission is denied or a file fails to decode. The HTML `#source-indicator` top-left is shown/hidden by `_startExperience` / `_goHome`; there is no in-canvas mic indicator any more.
- **Visual input is an optional driver, not a separate source.** The splash `#visual-pills` sets `App.selectedVisual` (`'none'` / `'photo'` / `'video'`) and `App.selectedVisualFile`. When non-`none`, `_startExperience` calls `visual.init(kind, file)` and the frame loop prefers `visual` over `mic` as the signal writer. Audio continues to play as picked (Drift / Pulse / etc.) — the visual only takes over as the *driver*. The indicator picks up the `.visual` class and shows the file name when visual is driving.

## Product direction

This file started as a single-screen generative audio visualizer. The product is evolving into an **interpretation engine** — one that wears an artistic taste (vibrant HSL, additive blending, breathing scenes, director-driven crossfades) and applies it to any input signal, eventually serving as a benchmarking platform for different AI models' grasp of human aesthetic taste.

### Roadmap (keep in order; each phase gates the next)

1. **Audio source abstraction + demo tracks** — introduce an `AudioSource` wrapper so the `AnalyserNode` pipeline can be fed by mic, bundled CC0 tracks, or a user-chosen local file. Downstream visualizers don't change. Ship both a curated bundle *and* a file picker.
2. **Visual input — driver mode only** *(shipped)* — `VisualAnalyser` reads an uploaded photo or video and emits the same shape as `AudioAnalyser` (`bass`/`mid`/`treble`/`volume`, plus `flowX`/`flowY` stubs for future use). Visualizers consume it unchanged. Subject-mode effects (photo dissolution, kaleido echo, flow-field particles) remain out of scope.
3. **Multi-phone mirror mode** — room code + small backend (Cloudflare Worker + KV on free tier) relaying `{sceneIndex, sceneTimer, audioBuckets, cameraState, seed}` over WebSocket. Every phone renders deterministically from the broadcast state. ~1 KB/s bandwidth. Tiled mosaic is future work, not this phase.
4. **Visualization contract (lightweight refactor)** — wrap the current `App` as a first implementation of an interface: `{meta, init(ctx, w, h), update(signals, dt), draw(ctx, w, h)}`. Keep everything in `index.html`. This is purely preparatory for Phase 5.
5. **Benchmarking gallery v0** — load multiple `Visualization` submissions in sandboxed `<iframe>`s against a shared reference source, A/B vote UI, store votes in localStorage first and sync to the Worker + KV. ELO per model per category per reference track. Audio submissions and visual-input submissions are **separate categories** — don't unify into a multi-modal score.
6. **Tiled mosaic** (long-term) — many phones → one larger canvas. Alignment UX is the hard part; defer until the platform has real use.

### Standing constraints

- **Single file for as long as possible.** Keep everything in `index.html`. Only break into ES modules when truly forced to. Double-click-to-run is part of the product.
- **All user media stays client-side.** Mic, chosen audio files, uploaded photos/videos — none of it uploads. The backend (Phase 3+) only sees room sync state and votes. Never media.
- **No webcam for now.** Photo/video file input only in Phase 2. Webcam re-introduces permission prompts we're trying to move away from.
- **Driver mode only for visual input.** Subject-mode scenes are future work and must not land until explicitly scoped.
- **Backend is optional at runtime.** The app must keep working fully offline / fully static when the Worker is unreachable; multiplayer and voting degrade to single-device gracefully.
- **Benchmark categories stay separate.** Audio-driven submissions and visual-input-driven submissions are rated in parallel tracks, not a combined leaderboard.

## Git workflow

Development branch for this task is `claude/add-claude-documentation-0K2ON`. Commit there, push with `-u origin <branch>`, don't open PRs unless asked.
