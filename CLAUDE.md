# CLAUDE.md — Psychedelic Experience

This file provides guidance for AI assistants (Claude and others) working in this repository.

---

## Project Overview

**Psychedelic Experience** is a zero-dependency, single-file interactive art installation built entirely with native browser APIs. The entire application lives in `index.html` (~1,300 lines, ~43 KB). Opening that file in any modern browser is sufficient to run the experience — no build step, no server, no dependencies.

The application synthesizes real-time generative visuals (Canvas 2D) and generative music (Web Audio API) into an immersive, cursor-driven psychedelic experience.

---

## Repository Structure

```
psychedelic-experience/
├── index.html      ← entire application (HTML + CSS + JS)
└── CLAUDE.md       ← this file
```

There are no configuration files, no package manager, no build tooling, and no CI/CD pipeline. If you need to add assets, place them alongside `index.html` and reference them with relative paths.

---

## Technology Stack

| Layer       | Technology                          |
|-------------|-------------------------------------|
| Rendering   | Canvas 2D API                       |
| Audio       | Web Audio API                       |
| Language    | Vanilla JavaScript (ES6+, strict)   |
| Styling     | Inline CSS (inside `<style>` tag)   |
| Animation   | `requestAnimationFrame`             |
| Input       | Mouse events + Touch events         |
| Fullscreen  | Fullscreen API (with webkit prefix) |

**No external libraries. No frameworks. No transpilers.**

---

## Architecture: The 9 Core Systems

All code lives inside `index.html` within a `<script>` tag. It is structured as a set of ES6 classes, each responsible for a single concern, coordinated by the main `App` class.

### Constants (top of `<script>`)

```js
TAU         = Math.PI * 2    // full-circle shorthand used throughout
TRAIL_LENGTH = 100           // ring-buffer size for cursor trail
MAX_PARTICLES = 2000         // hard cap on live particles
MAX_RIPPLES  = 20            // max simultaneous ripple rings
AMBIENT_COUNT = 300          // always-on background particles
BREATH_PERIOD = 5.0          // seconds for one breathing cycle
PENTATONIC   = [0,2,4,7,9]  // semitone offsets for pitch quantization
```

Utility: `lerp(a, b, t)` — linear interpolation used everywhere.

---

### 1. `BreathingSystem`
Drives a 5-second sinusoidal "breath" that modulates opacity, scale, and color across every other system. Query via `breathing.value` (0–1) and `breathing.scale` (near 1.0).

### 2. `ColorSystem`
Manages 5 named palettes (`rainbow`, `aurora`, `sunset`, `ocean`, `ethereal`). Auto-advances every 45–90 seconds. HSL generation with smooth inter-mode blending (0.3 s transition). Primary interface: `color.getColor(hueOffset, saturation, lightness)`.

### 3. `ParticlePool`
Object pool backed by `Float32Array` / `Uint8Array` for GC-free particle management (max 2,000). Five particle types: `ambient`, `trail`, `explosion`, `vortex`, `spirit`. Handles cursor attraction physics internally. Oldest particles are recycled when the pool is full.

### 4. `RippleSystem`
Up to 20 expanding circle rings rendered via `arc` + `stroke`. Triggered on every click and significant mouse movement.

### 5. `TrailSystem`
100-slot ring buffer recording cursor positions. Rendered as a smooth quadratic Bézier curve with `lighter` composite mode for a glow effect.

### 6. `GeometryEngine`
Draws one of four sacred geometry patterns, each implemented as a pure mathematical construction:
- **Flower of Life** — 19 overlapping circles
- **Metatron's Cube** — 13 nodes with all-pairs line network
- **Sri Yantra** — 9 interlocking triangles + 3 concentric circles
- **Mandala** — 12-fold radial symmetry, 5 layers, alternating rotation

Patterns auto-cycle every 30–60 seconds. All patterns breathe and pulse on interaction.

### 7. `SoundEngine`
Web Audio API synthesizer. Audio graph:

```
3× detuned sine oscillators → DroneGain → LowpassFilter ─┐
Triangle oscillator          → MoveGain  → BandpassFilter ─┤→ Convolver → MasterGain → output
Sine oscillator (hold)       → HoldGain  ─────────────────┘
```

- Drone root cycles through A2 → B2 → C#3 → E3 → F#3 every 45 s.
- All movement tones are quantized to C major pentatonic.
- Clicks fire 4-harmonic burst + white-noise transient.
- Lowpass cutoff modulated by cursor Y position (200–2,000 Hz).
- 3-second convolver reverb synthesized at runtime (no audio file needed).

### 8. `SpiritLights`
Up to 5 sinusoidal "spirit" lights drift across the screen after 10 seconds of cursor idle time. Fades immediately when the cursor moves.

### 9. `RareEvents`
After ≥ 30 seconds of total experience time, one of three events fires randomly:
- `colorWash` — full-screen gradient overlay (3 s)
- `galaxySpiral` — 3-arm spiral with 150 dots/arm (5 s)
- `constellation` — connects particles with translucent lines (5 s)

### `App` (orchestrator)
- Owns all system instances.
- Drives the `requestAnimationFrame` loop (delta-time capped at 50 ms).
- Handles mouse/touch input → dispatches to systems.
- Manages entry screen → click to begin → fade out.
- Double-click toggles fullscreen.

**Render layer order** (back to front):
1. Background radial gradient
2. Sacred geometry
3. Rare event overlay
4. Cursor trail
5. Ripple rings
6. Particles
7. Spirit lights
8. Screen flash (on click)
9. Vignette

---

## Development Workflow

### Running the App

```bash
# Option 1: just open the file
open index.html                  # macOS
xdg-open index.html              # Linux

# Option 2: serve with any static server to avoid CORS (Web Audio may need it)
npx serve .                      # Node
python3 -m http.server 8080      # Python
```

Web Audio requires a user gesture before the context can start. The app handles this: clicking the entry screen initialises the audio context.

### Editing

The entire application is in one file. Use section comments (e.g., `// ===== COLOR SYSTEM =====`) to navigate. All major class boundaries are marked.

There is no linter, formatter, or pre-commit hook. Follow the existing style (see below).

### Testing

There is no automated test suite. Verify changes by:
1. Opening `index.html` in a browser.
2. Clicking the entry screen to start.
3. Moving the cursor / tapping (mobile).
4. Waiting ≥ 10 s idle (spirit lights).
5. Waiting ≥ 30 s total (rare events).
6. Checking the browser console for errors.

---

## Code Style Conventions

| Convention       | Rule                                           |
|------------------|------------------------------------------------|
| Indentation      | 2 spaces (no tabs)                             |
| Strings          | Single quotes `'`                              |
| Classes          | `PascalCase`                                   |
| Methods/vars     | `camelCase`                                    |
| Global constants | `UPPER_SNAKE_CASE`                             |
| Mode             | `'use strict'`                                 |
| Section headers  | `// ===== SECTION NAME =====` dividers         |
| Comments         | Minimal — only where logic is non-obvious      |

Do **not** add docstrings, JSDoc, or TypeScript types. Do **not** introduce a build system or external dependencies unless the feature explicitly requires one.

---

## Key Invariants to Preserve

1. **Zero dependencies** — the file must remain openable with no network access and no build step.
2. **Single file** — keep all HTML, CSS, and JS in `index.html` unless a feature genuinely requires additional assets.
3. **60 FPS budget** — all new rendering code must be measurably efficient. Prefer pre-computation and typed arrays over per-frame allocation.
4. **No GC pressure in the hot path** — reuse objects; do not create new arrays or objects inside the animation loop.
5. **Audio requires user gesture** — never auto-start the `AudioContext`; always gate behind the entry-screen click.
6. **Graceful degradation** — wrap risky operations in try/catch so a single error cannot kill the animation loop.
7. **Mobile-friendly** — every mouse interaction must have a touch equivalent.

---

## Common Tasks

### Add a new particle type
1. Add the type string to the docstring comment in `ParticlePool`.
2. Add spawn logic in `ParticlePool.spawn()`.
3. Add update logic in `ParticlePool.update()`.
4. Add render logic in `ParticlePool.render()`.
5. Respect `MAX_PARTICLES` — the pool size never grows.

### Add a new sacred geometry pattern
1. Add an entry to the `GeometryEngine.patterns` array (name string).
2. Implement a `draw<Name>(ctx, cx, cy, r, breathScale, pulse)` method on `GeometryEngine`.
3. Route it in `GeometryEngine.render()`.

### Add a new color mode
1. Add a key to `ColorSystem.modes`.
2. Implement the `getColor(offset, s, l)` logic for that mode.
3. The auto-cycle picks modes randomly, so no other wiring is needed.

### Add a new rare event
1. Add a method `rareEvent<Name>()` on `RareEvents`.
2. Add the method name to the `RareEvents.trigger()` selection list.

### Add audio synthesis
1. All synthesis happens inside `SoundEngine`. Create new nodes in the constructor; connect them into the existing graph before `masterGain`.
2. Do not create `AudioContext` instances outside `SoundEngine`.

---

## Git Conventions

- The main working branch for the initial documentation task is `claude/add-claude-documentation-Be8tj`.
- Commit messages: imperative mood, concise (e.g., `Add constellation rare event`).
- Push with: `git push -u origin <branch-name>`.

---

## Browser Compatibility Notes

The app targets **modern evergreen browsers** (Chrome 90+, Firefox 88+, Safari 14+, Edge 90+). The following fallbacks are already in place:

- `window.AudioContext || window.webkitAudioContext` for Safari.
- `element.requestFullscreen || element.webkitRequestFullscreen` for fullscreen.
- Touch events run alongside mouse events with no conflicts.

Do not add polyfills for APIs that are universally supported (e.g., `requestAnimationFrame`, `canvas`).
