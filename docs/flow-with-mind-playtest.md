# Flow with Mind — how to start, what to try, what was tested

## v2 (2026-10-20): metabolism, travel, play surface

Design: `docs/superpowers/specs/2026-10-20-flow-v2-metabolism-travel-play-design.md`. What changed after Bird's first play:

- **The worlds stay alive.** Each world reports a liveliness L (shown on the HUD as `life 0.xx`). Below 0.35 for 5 s the director heats the entropy target (`heat +0.xx` on the HUD) and kicks a structural event; below 0.2 for 15 s more it **rewinds**: the world melts back over 2 s to its most alive snapshot of the last ~80 s (`REWIND` on the HUD, note in the drawer). Music now changes structure: physarum deposits burst on the beat and chase a food point that jumps on accents; swarmalators live in the active phase-wave regime at high entropy and get phase kicks on the beat; boids get gusts and a wind that turns on the phrase; Life seeds edge gliders on accents and stripes on phrases (labelled variants, off under pure rules).
- **You travel.** The app opens in **hover** (the v1 spheres). **Tap the glass or press Space to launch the ship**: physarum and Life become tunnels, the swarm and the flock stream past you and re-form ahead, stars streak with speed. A sustained musical build with a clear beat pitches the ship into a **dive**; the drop levels it. A scene change is a 4 s **jump** (speed ×3, 8-fold, the old world falls away behind). Long-press the ring, press V, or use the drawer to hover again.
- **One ring.** The arc at the bottom is Initiative: left *Lead me*, right *Follow me*. On auto the dot drifts by itself; touch it to lock; double-tap it to pass the lead. **Depth** (swipe up/down, + / −) bundles fold, feedback, saturation and speed. Everything else is in the drawer (⚙ or Esc). The HUD and ring fade after 3 s without a touch.

Gestures: tap launch / pulse · drag steer · swipe ← → next / previous world (honoured at the next phrase when the world leads, at once when it follows, never when the scene is locked) · swipe ↑ ↓ depth · long-press hold the world · two-finger tap or shake rewind · pinch or wheel speed trim · long-press the ring hover · double-tap the ring pass the lead. Keys: Space, arrows, [ ], + −, H, R, V, P, Esc.

Tested by machine: `node --test tests/*.test.mjs tests/*.test.cjs` → 117 tests (liveliness, swarm regimes/kicks/wrap, physarum food/burst/breathe, boids wind/wrap, Life variants, snapshot ring and dissolve, metabolism controller, event flags, user scene requests, ship model, depth bundle, gestures). Tested by hand through `window.__flow.advance()` in the app's browser pane: hover default and launch, tunnel build, 4 s jump, swarm wrap bounds in flight, forced low liveliness → heat → rewind → reference reset, drawer and Esc, depth 0/1, ring tap lock, canvas tap launch, swipe → requested world → jump, HUD idle fade; the swarm in flight re-centred on the ship's axis and filled the view; offline assets (33 core files + demos, cache `extra-worlds-v7`) and a reopen with the server stopped (ship launched, demos listed); no console errors; render ≈ 2 ms. **Not tested:** real motion-sickness feel of the ship and dive, shake on a phone, pinch on a touch screen, VR with the ship (VR stays in hover), long runs.

Tuning notes: the dive thresholds (8 s build, C > 0.5), the rewind band (0.35 / 0.2), the arcs' entropy range (0.35–0.75) and the swarm regime mapping (K = 0.6 − H) are the knobs most likely to need Bird's ear.

---

## v1 (2026-10-19)

Branch `flow-with-mind`. Design: `docs/superpowers/specs/2026-10-19-flow-with-mind-design.md`. Plan: `docs/superpowers/plans/2026-10-19-flow-with-mind.md`.

## Start

```bash
python3 scripts/serve_worlds.py --port 8766
```

Open http://127.0.0.1:8766/immersive/ in Chrome (if 8766 is already taken by an older server, pass another port such as `--port 8767`). The first click or key press starts sound (browser autoplay policy); the HUD says `tap to start sound` until then.

JEV (optional, online): the server reads `TYPESAFE_API_KEY` from the environment, else from the existing AI Lab `.env`. Without a key the JEV button reports "not configured" and the local director carries on.

Offline: press **Download offline assets** once (≈13 MB: engine + three demos). After that the page opens and runs with the server stopped or the network off.

## What you are looking at

- **Initiative slider** `Lead me ◀━▶ Follow me`. On **Auto** the thumb moves by itself: the world yields when you act (clap, speak, drag) and resumes leading when you rest. Touch it to lock. **Pass the lead** flips the baseline between leading and following.
- **HUD** (bottom): `LEADING +0.30 · 120 BPM · C 0.82 · E 0.45 · room on · LOCAL DIRECTOR`. C is beat coherence, E is energy. The dot beside the meters pulses on the *world's* beat, which runs ahead of the music when leading and behind when following.
- **Explain** (top right): which of you / arc / JEV / music is steering each axis, the entropy target and channel, the phase offset in ms, latency compensation, the novelty budget, and Life's pure/variant state.
- **Arc**: Tidal → Firefly → Mycelium chain by default (each ~4.5–5 min, with its own clock that pauses while you act). Pin one to loop it.
- **Room mic** runs alongside the music player; it is analysed locally and never recorded or routed to the speakers.

## Playtest script (spec §10)

1. Start the demo playlist (auto-advance and loop are on) with the room mic on. Do nothing for three minutes. Can you *see* the world leading: pulses just ahead of the beat, the arc moving, a scene change landing on a phrase after a track change?
2. Clap twice; say a sentence. Does the slider drop toward Follow within two seconds, then drift back over ~20 s? Try with headphones and with speakers: with speakers the music itself must not count as you.
3. Drag the slider to Follow and lock it. For a minute the world must never change scene or symmetry on its own.
4. Lock a scene, set Lead. The arc should keep moving everything except the scene.
5. Toggle JEV on with network, then turn Wi-Fi off. The HUD should switch to `LOCAL DIRECTOR` within two seconds with no jump.
6. Download offline assets, quit the server, reopen the page. It should run with the demo tracks.
7. A/B: in the Explain panel the phase offset is shown in ms. Lock Initiative at +1 and then at −1 on the same track: which one feels like it is driving?

## Tested by machine (node:test + unittest, all green)

`node --test tests/*.test.mjs tests/*.test.cjs` → 83 tests. `python3 -m unittest scripts/test_serve_worlds.py` → 3 tests.

A fresh whole-branch review (2026-10-20) found one critical and seven important issues; all nine fixes (including pause) landed with a failing test first: microphone-only input now feeds speech and claps into Agency; the director does nothing in silence; speech-likeness drops within 2 s of the voice stopping; off-beat hats no longer double-count beats; palette and fold changes wait for a phrase boundary; physarum colouring uses a palette lookup table (8 ms → 2 ms per frame); a JEV `change_scene` never removes your scene lock; the feedback slider is a baseline the arc moves around; pause freezes the director. Deferred minor findings from that review (not fixed, Bird's call):

- `sims/boids.mjs` allocates three small arrays per boid per step (~32k/s); use scalars or a preallocated `Float32Array(3)`.
- Hue follows brightness with the sign inverted versus spec §4.5 (bright → warmer instead of cooler); one sign in `director.mjs`.
- `#view` and `#symmetry` show the user's value while the effective camera/fold may differ when the arc leads; the Explain panel shows the truth.
- `serve_worlds.py` path checks are case-sensitive; on macOS `/Scripts/x.PY` would be served (source only, bound to 127.0.0.1).
- The director re-applies the latest arc `I0` at every waypoint change, so a JEV `initiative` baseline can be overwritten within ≤ 45 s.
- OS revocation of the mic stops capture but the Room mic button keeps saying "on" (the HUD does say `room off`).
- `index.html` ships `#jev` disabled with a stale title; the app enables it at runtime.
- A fold change mid-fade keeps the old `foldPrev` (small pop); the fade is capped at 4 s rather than one phrase.
- `serve_worlds.py` hard-codes the AI Lab `.env` path; `.gitignore` lists `__pycache__/` twice.
- `map_answers` uses banker's rounding for symmetry (2.5 → 4-fold); the Python tests cover the pure functions, not the HTTP handler.

Covered: adaptive loudness never amplifies a quiet room; onsets, tempo and coherence on click trains at 60 and 120 Hz display rates and across a 76→108 BPM jump; null frames decay without NaN; speech-likeness; beat clock lock within 4 s, latency compensation, world clock lead/lag by ±0.12 cycle and frequency entrainment; agency from off-beat onsets / speech / surprise / gestures with on-beat onsets discounted; initiative yield < 2 s and resume in 15–25 s, hard lock; the three arcs' shapes, interpolation, pause, hold, override, chaining; director scene gate (dwell, phrase boundary, agency, locks), blocked requests not stalling the arc, novelty budget ≤ 3/min, flow channel, phrase boundaries (16 beats / 20 s), dt spikes, JEV low-confidence fallback to the preset, user symmetry as a floor, steady grooves not counted as agency; JEV client validation, staleness, backoff; feedback mix never reaching white; palettes; simulation parameters, injections, Life pure mode and glider seeding; playlist; server questions, state validation and answer mapping.

## Tested by hand on this Mac (2026-10-20)

The Claude desktop app's browser pane throttles animation to ~0–1 fps while hidden, so the live checks drove the app deterministically through `window.__flow.advance(seconds)` (the same frame function the animation loop calls) and read the HUD and engine state:

- Page loads with no console errors; HUD reads `tap to start sound` before the first gesture.
- Synthetic beat: coherence 0.77–0.95 at 120 BPM within 8 s; phase dot pulses.
- Initiative locked at −1 for 60 s: no scene change, no symmetry change, HUD `FOLLOWING −1.00`. Auto on: back to +0.30 in ~25 s. A gesture burst dropped it to −0.19 within 2 s and it recovered.
- Auto scene change physarum → swarm granted exactly once, on a phrase boundary, after the dwell. Lock scene + Lead: scene held 70 s while parameters kept moving.
- Room mic denied (the pane blocks capture): status names the fallback, HUD `room off`, page keeps running.
- Kaleidoscope 8-fold visible; 60 s of swarm at maximum feedback left trails without white-out.
- Forward flight: boids stayed within z ∈ [−24, 4] (re-spawn ahead works); physarum tunnel built with the arc's 8-fold; Life pure mode shows zero perturbations and 5 generations/beat.
- JEV: a real decision came back in 3.9 s and was applied (energy/symmetry/palette targets, hold 58 % slowed the arc to 0.42×, low-confidence entropy/initiative left local). Invalid state → 400. A free-form request ("make it dreamier") was classified `none`; "make it dreamier and slower" → `slower`.
- Offline: after downloading assets, with the server stopped, the page reopened from the service worker with the engine running and the three demos listed.
- After the review fixes: physarum render 1.9 ms per frame (was 8.2); pause froze arc time and scene dwell, resume continued them; palette `silk` committed at the first frame; no console errors.

## Not tested (needs a person or a device)

- Real playback on screen at 60/120 fps and the *feel* of the ±60 ms phase offset (script item 7).
- A real room microphone with speakers: whether the on-beat discount keeps the music from counting as agency.
- Wi-Fi off while JEV is on (the pane cannot force `navigator.onLine`).
- Quest 2: the WebXR entry is unchanged and unverified. Post-processing is skipped while presenting in XR.
- Speech recognition (Web Speech, single utterance) in a real browser.
- Long runs (an hour or more) for drift, memory and heat.

## Tuning notes for the first play

- Physarum on the sphere reads bright with the silk palette; the tunnel in flight reads well. Gain is in `engine/post.mjs` (`gain`), trail lightness in `app.mjs` (`renderWorld`).
- Swarmalators at low entropy collapse into a tight ball; the Tidal arc's second half and Firefly loosen it. If it bores, raise the arcs' early `H`.
- Agency weights (`engine/agency.mjs`): gestures alone yield to about −0.35, speech or claps to about −0.7.
