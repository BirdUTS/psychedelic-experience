# Flow with Mind — how to start, what to try, what was tested

## v3.1 (2026-10-26): not one kaleidoscope

Bird after the first v3 look: the mycelium sphere and the fish had disappeared under one constant kaleidoscope. Cause: v3 set the fold to Depth's ceiling whenever the world led (almost always, from the +0.3 baseline), so Depth 0.5 meant 4-fold all the time, with Klüver rings and the flight tunnel on top; the review pass then removed the arc's fold bias, so nothing varied it. Three changes:

- **The arc carries the fold again.** Tidal opens at 0 (the raw sphere), builds to 2, 4, 6; Firefly and Mycelium have their own curves. Depth is only the ceiling (Depth 0.5 = at most 4-fold). With no fold, the form rings step back to half strength.
- **Raw passages.** The session opens on the world itself for one phrase; after that, three dressed phrases for every raw one; a jump lands on the new world clean for its first phrase. Raw = no fold, no mirror, no form rings, no tunnel, soft warp; the echo and the world stay. The HUD shows `· RAW`; Explain shows the passage count.
- **World signatures.** Mycelium draws its veins as contour lines (cobweb forms while following); fireflies leave long spinning trails that fall gently inward (echo, droste, breath); the flock is mirrored like water while following, with a broad flowing warp; Life is a lattice grid, crisp and slightly split. All scaled by Depth and capped like everything else.

Tested by machine: 150 tests (arc fold under the Depth cap, raw passages for every world, four distinct signatures bounded and quiet at Depth 0, the passage schedule, the director's arc symmetry without the user floor). Cache `extra-worlds-v10`.

---

## v3 (2026-10-26): the picture speaks — visual language, computer music, Immerse

Design: `docs/superpowers/specs/2026-10-25-flow-v3-visual-language-design.md`. Plan: `docs/superpowers/plans/2026-10-26-flow-v3.md`. What changed after Bird's ask (computer music without headphones, Immerse where the hand lands, more of the trippy-video vocabulary, a picture that says what the system is doing without words):

- **One shader stack, programmable.** The world is now drawn through a single fragment pass with a vocabulary from the trippy-video research: a **tunnel** (the whole frame remapped in log-polar space so you slide down a tube), **Klüver form constants** (tunnel rings, spiral, cobweb, lattice — the shapes the visual cortex makes on its own, all straight stripes in log-polar space, drawn on the way to the screen), **warp** (iterated sine domain warping: melting), **contour** (luminance bands with dark iso-lines), **chroma** (RGB split along the radius, slow hue cycle), **mirror** (h / v / quad, calmer than fold), **droste** (the echo pulls the frame into its own centre along a spiral), **breath** (barrel breathing on the world clock), on top of the v2 fold and echo. A *program* is the vector of all of these; `engine/grammar.mjs` computes one from the director's state every frame.
- **A fixed grammar you can learn.** Leading pulls inward: tunnel or spiral forms drifting in, fold ≥ 4, echo spin. Following opens toward you: cobweb or lattice drifting out, mirror instead of fold, warp that tracks your voice and claps. Entropy trades contour (crisp) for warp (melting); low coherence breathes; heat (metabolism) raises warp and echo; liveliness near the rewind band leans into droste; a dive raises the tunnel and doubles the drift; a jump is hyperspace (tunnel 1, lattice at full drift, quad mirror); **Depth** caps everything (0 is a quiet mirror world, 1 is all of it). Continuous parameters blend over ~2 s, discrete ones (fold, mirror, form kind) step on phrase boundaries. The arc's old S / F axes now only bias fold (one step) and echo decay (±0.2).
- **Seven gestures.** Short sentences the picture says at moments of change, one at a time, each with its own envelope: **take** (Initiative crosses +0.2: spiral pulls in, 6-fold for two beats), **yield** (crosses −0.2: the frame exhales, mirror opens, forms fade), **listen** (following with agency above 0.5: the warp nods with each of your onsets for up to four beats), **carry** (16 beats of leading without a gesture: one slow tunnel pull), **surprise** (director surprise > 0.7: a one-beat chroma flash and doubled contour, at most one per 2 s), **rebirth** (any rewind: the droste collapse, the frame falls into its own centre over the 2 s dissolve), **jump** (a scene change). Take / yield interrupt listen / carry; rebirth and jump interrupt everything. The HUD line names the active gesture (`· TAKE`); Explain shows the program headline, the gesture and its envelope. None of this is a reading of anyone's mind: it is the system saying what *it* is doing (spec §4.3).
- **JEV mood.** One more bounded question online: mood ∈ {clear, dream, melt, electric, holy}, a bias over the grammar committed at the next phrase boundary with the same confidence floor; low confidence leaves the mapping alone. `holy` with amount ≥ 0.5 forces 8-fold and tunnel forms.
- **Computer music, no headphones.** Drawer → **Computer music**: Chrome's share picker opens. Pick a Chrome tab (YouTube, Spotify web…) and tick *Share tab audio*, or choose *Entire screen* and tick *Share system audio* (Chrome 141+ on macOS 14.2+). The shared audio is analysed only — never played back, recorded or uploaded; the picture is dropped at once (its tracks stop). Precedence: computer music > player > room mic; the mic alongside is still the room. HUD source reads `SYSTEM`. Ending the share from Chrome's bar turns the source off with a note.
- **Immerse where the hand lands.** A big `▣ Immerse` pill under the HUD line: it asks for fullscreen, hides titles and meters, and becomes a corner glyph next to the gear, which then toggles. Browser Esc leaves fullscreen; our Esc opens the drawer outside it. The drawer's old Immerse entry is gone.
- **Calm.** Drawer → Picture → *Calm*: caps gain at 0.5 and removes colour fringing, even against gestures and moods. Photosensitivity: nothing in the stack flashes the full frame faster than 3 Hz; chroma flashes last one beat, at most one per 2 s; contour and forms never invert the frame.
- Quality halves (warp iterations) after two seconds under 50 fps and returns after five good seconds (`quality` in Explain). Every moving phase (warp, tunnel scroll, form drift, hue) is integrated per frame in `engine/phases.mjs` and freezes while paused.

Tested by machine: `node --test tests/*.test.mjs tests/*.test.cjs` → 144 tests (grammar bounded over a grid of states and depths, the Depth cap over moods and overrides, the phase integrators, leading/following mapping, depth caps, entropy/heat/droste, ship/jump/calm, blend and moods; the seven gestures with hysteresis, listen pulses, carry count, surprise rate limit ≤ 30 per 60 s and never two within 2 s, pre-emption and priorities; director mood commit on a phrase boundary; JEV client mood validation; computer-music stream routing). `python3 -m unittest scripts/test_serve_worlds.py` → 4 tests (mood question and mapping; the 404 log crash). Tested by hand through `window.__flow.advance()` / `__flow.forceProgram` in the app's browser pane (Chrome 152, 1740×1305 buffer): each effect alone at 1 (screenshots: tube, four form kinds, melting sphere, bands, fringes, mirrors, spiral collapse); everything at 1 for 20 s with no NaN in the feedback buffer; CPU + `gl.finish` ≈ 0.5 ms per frame all at 1; grammar: lock +1 → tunnel forms, fold 4, inward drift; lock −1 → lattice, quad mirror, outward drift; the +0.2 crossing shows `take` (spiral, 6-fold), −0.2 shows `yield`; forced liveliness 0.1 → droste 0.67, rewind at 20 s → `rebirth` at droste 1; a jump → `jump`, hyperspace within 1.2 s, back after landing; Computer music in the pane (capture blocked): cancelled path, source stays off with the share hint; Immerse: pill → glyph, titles off, toggles back, fullscreen refused by the embedded pane as expected; Calm on → chroma 0, gain 0.5; offline assets re-cached as `extra-worlds-v9` (+ grammar, visual-gestures, phases) and a reopen with the server stopped; no console errors. **Not tested:** real fullscreen, the real share picker and system audio on this Mac, GPU time and fps at the desk (the pane hides the page), the feel of any of it.

A fresh whole-range review (2026-10-26) found two critical, six important and sixteen minor issues; nineteen fixes landed, with a failing test first wherever the code is pure. Critical: the hue cycle ran *inside* the feedback loop with an absolute angle, so the echo's colour rotated by a growing amount every frame — a full-frame hue strobe after ~30 s of play; and every moving phase was `rate × absolute time`, so any change of a rate (a gesture, a dive, a jump) jumped the phase in proportion to how long the session had run. Both are gone: `engine/phases.mjs` integrates the warp, tunnel, form and hue phases per frame (a test pins that a rate change changes the velocity, never the phase, after an hour), and the hue cycle moved to the display pass. Important: moods and gesture overrides now stay under the Depth ceiling (`capProgram`, tested at Depth 0 — `holy` can no longer put an 8-fold tunnel on a quiet world); a committed mood clears on scene change and when JEV is switched off; `listen` nods to *your* onsets (the room), not the music's; a paused picture holds still (phases, blend and gestures) and a rewind or jump pressed while paused still gets its gesture on resume; the arc's S → fold bias was dead code (Depth is both the fold's floor and ceiling) and is dropped with its Explain claim. Minor fixes: surprise can interrupt listen and carry; listen rests four beats between nods and needs real following (I < −0.2); the frame a gesture ends carries no overrides; a jump outranks a rebirth (as the app finishes any dissolve first); low coherence drifts slowly when following too; Calm also stops the hue cycle and holds against the debug hook; the HUD reads `TAB` or `SYSTEM` by what was shared; the share picker opens before the audio context resumes; browser Esc out of fullscreen opens the drawer; the Immerse glyph exposes `aria-pressed`; a Depth change adopts fold / mirror / form kind at once; a duplicate `.check` style is gone.

Deferred minor findings (Bird's call): a reseed (no snapshot yet, or pure Life) also plays the 2 s rebirth collapse · the forms have no `quality` step (one cosine per pixel) · the fold cross-fade is one beat while any gesture runs · on some Chrome builds stopping the video track of a display capture may end the whole share (then the status says so at once; test on the real Chrome) · the listen test only requires the warp pulse to exceed 0.2.

Found while checking: anything additive drawn inside the feedback shader is fed back — the Klüver forms washed the frame to grey within seconds (mean 0.33 vs 0.10 without); they now render only on the way to the screen. The hue cycle can push a colour outside the RGB cube and `1 − exp(−x)` amplifies negatives: at full chroma + echo the feedback buffer diverged to NaN in ~20 s; the echo input is now clamped with a NaN guard.

Tuning notes for the first play: while flying the tunnel sits at 0.3 (0.7 in a dive) and mixes the frame with its log-polar image — if the swarm reads as an "eye" rather than a tube, lower `tunnel` for `ship` in `programFor`; form contrast is capped at 0.6·Depth; the base chroma split is 0.3·H·Depth; a `take` fires on the first frame of a session (the baseline +0.3 is above the hysteresis) — intended, the world announces it leads; `carry` recurs every 16 beats of uninterrupted leading; computer-music latency compensation is the analyser's delay only — if the beat feels late, add a constant in `audio.mjs` `latency()`.

---

## v2 (2026-10-20): metabolism, travel, play surface

Design: `docs/superpowers/specs/2026-10-20-flow-v2-metabolism-travel-play-design.md`. What changed after Bird's first play:

- **The worlds stay alive.** Each world reports a liveliness L (shown on the HUD as `life 0.xx`). Below 0.35 for 5 s the director heats the entropy target (`heat +0.xx` on the HUD) and kicks a structural event; below 0.2 for 15 s more it **rewinds**: the world melts back over 2 s to its most alive snapshot of the last ~80 s (`REWIND` on the HUD, note in the drawer). Music now changes structure: physarum deposits burst on the beat and chase a food point that jumps on accents; swarmalators live in the active phase-wave regime at high entropy and get phase kicks on the beat; boids get gusts and a wind that turns on the phrase; Life seeds edge gliders on accents and stripes on phrases (labelled variants, off under pure rules).
- **You travel.** The app opens in **hover** (the v1 spheres). **Tap the glass or press Space to launch the ship**: physarum and Life become tunnels, the swarm and the flock stream past you and re-form ahead, stars streak with speed. A sustained musical build with a clear beat pitches the ship into a **dive**; the drop levels it. A scene change is a 4 s **jump** (speed ×3, 8-fold, the old world falls away behind). Long-press the ring, press V, or use the drawer to hover again.
- **One ring.** The arc at the bottom is Initiative: left *Lead me*, right *Follow me*. On auto the dot drifts by itself; touch it to lock; double-tap it to pass the lead. **Depth** (swipe up/down, + / −) bundles fold, feedback, saturation and speed. Everything else is in the drawer (⚙ or Esc). The HUD and ring fade after 3 s without a touch.

Gestures: tap launch / pulse · drag steer · swipe ← → next / previous world (honoured at the next phrase when the world leads, at once when it follows, never when the scene is locked) · swipe ↑ ↓ depth · long-press hold the world · two-finger tap or shake rewind · pinch or wheel speed trim · long-press the ring hover · double-tap the ring pass the lead. Keys: Space, arrows, [ ], + −, H, R, V, P, Esc.

Tested by machine: `node --test tests/*.test.mjs tests/*.test.cjs` → 117 tests (liveliness, swarm regimes/kicks/wrap, physarum food/burst/breathe, boids wind/wrap, Life variants, snapshot ring and dissolve, metabolism controller, event flags, user scene requests, ship model, depth bundle, gestures). Tested by hand through `window.__flow.advance()` in the app's browser pane: hover default and launch, tunnel build, 4 s jump, swarm wrap bounds in flight, forced low liveliness → heat → rewind → reference reset, drawer and Esc, depth 0/1, ring tap lock, canvas tap launch, swipe → requested world → jump, HUD idle fade; the swarm in flight re-centred on the ship's axis and filled the view; offline assets (33 core files + demos, cache `extra-worlds-v7`) and a reopen with the server stopped (ship launched, demos listed); no console errors; render ≈ 2 ms. **Not tested:** real motion-sickness feel of the ship and dive, shake on a phone, pinch on a touch screen, VR with the ship (VR stays in hover), long runs.

A fresh whole-range review (2026-10-20) found no critical issues, six important ones and eighteen minor; ten fixes landed with tests where the code is pure: a frozen world now really comes back from its best snapshot after a jump lands; a jump finishes any dissolve first; a swipe must be a flick (≤ 300 ms) so a fast steering drag never changes world; no fold pop at the end of a jump; physarum and boids re-sync their drift baselines after rewind or reseed; liveliness builds its reference from the first observation (it had been stuck at 1 in the app); the first touch after the idle fade only wakes the surface and nothing fades before you touch; ring presses lock only on move or lift and a still long-press toggles hover; paused frames replay no beats, jumps or requests; ship pitch is clamped to ±60°; a dive adds a fold step.

Deferred minor findings (Bird's call): hover-mode orbit drag has no 20°/s cap · Mycelium's mid-arc entropy is flattened at 0.75 by the clamp · shake fires on one jolt and iOS needs a motion permission · Escape is ignored while typing in the command box, and arrow keys on the focused ring also steer · the hidden Depth range has no keyboard handler and the HUD's aria-live chatters · warmer/cooler requests are dropped but acknowledged · a swipe during the first 2 s of a jump is dropped · the snapshot ring allocates its switch times per dissolve and captures physarum one step stale · jump speed steps in and out without a ramp · boids' liveliness is nearly binary · the dive's drop is an energy heuristic, not a phrase boundary.

Tuning notes: the dive thresholds (8 s build, C > 0.5), the rewind band (0.35 / 0.2), the arcs' entropy range (0.35–0.75) and the swarm regime mapping (K = 0.6 − H) are the knobs most likely to need Bird's ear.

---

## v1 (2026-10-19)

Branch `flow-with-mind`. Design: `docs/superpowers/specs/2026-10-19-flow-with-mind-design.md`. Plan: `docs/superpowers/plans/2026-10-19-flow-with-mind.md`.

## Start

```bash
python3 scripts/serve_worlds.py --port 8766
```

Open http://127.0.0.1:8766/immersive/ in Chrome (if 8766 is already taken by an older server, pass another port such as `--port 8767`). The first click or key press starts sound (browser autoplay policy); the HUD says `tap to start sound` until then. To use the music already playing on the computer, open the drawer (⚙) and press **Computer music** (v3 section above).

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
