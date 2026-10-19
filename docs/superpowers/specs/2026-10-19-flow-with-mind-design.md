# Flow with Mind — Design

Date: 2026-10-19 · Status: draft for Bird's review · Builds on: `docs/AGENT-BRIEF-EMERGENT-EXPERIENCE.md`, `immersive/` prototype (Living Worlds 002)

> A good dance partner does two things well. When you move, they yield and let you lead. When you hesitate, they carry you, half a beat ahead, so you never feel lost. You rarely notice the hand-over. That hand-over is the whole design.

---

## 1. Intent

**What it is.** A living, emergent world (slime-mould networks, swarms, flocks, cellular life) that you and your friends sit inside while music plays. The world can **lead** your attention, the way a well-cut trippy video pulls you down a tunnel, or it can **follow** your mind, reacting to your voice, your claps, your gestures, the energy in the room. Which one it does at any moment is itself alive: a continuous *initiative* that shifts between the two, and that you can grab and lock whenever you want.

**Why.** Bird's stated purpose (2026-10-19): *to experience a trippy feeling together with friends.* Not meditation, not a client demo, not a measurement of anyone's mind. Fun, shared, mesmeric. The reference he gave is AllSeen's "Trippy Psychedelic Visuals · 4K · Synched With the Deep Hypnotic Music": one strong idea per segment, radial symmetry, constant forward motion, high-contrast palettes, pulses that land on the beat, a new world every few minutes.

**The one-line test.** When Bird claps or speaks, the world should visibly *give way* to him within a second or two. When the room goes quiet and absorbed, the world should *take over* and carry everyone somewhere, half a beat ahead of the music. If either half fails, the design has failed, however pretty the pixels are.

**Tonight's context.** One person at a desktop with the three Suno demo tracks or a microphone. The design keeps the room-of-friends case in view (shared microphone, later phones), but this iteration ships and is judged solo on desktop.

---

## 2. What a session feels like

Ten minutes. The three Suno demos play as a playlist through the in-app player (*Tidal Garden* 76 BPM → *Firefly Convergence* 108 → *Mycelium Drive* 132, each ≈90 s, auto-advancing, then looping). The room microphone is on. Initiative is on Auto.

**0:00** A dark sphere. A few hundred swarmalators drift, each blinking at its own rhythm. The music is a quiet intro; the world's own breathing (a slow ω_w) sets the pace. The HUD says `LEADING · gently`.

**0:40** The soft kick comes in. Within four seconds the beat clock locks. Each swarmalator now pulses on the world's phase, which runs **ahead** of the music by about 60 ms (after compensating for the analyser's own delay). You feel the visual *announce* the beat rather than echo it. That is what "being led" feels like.

**1:30** The track ends and *Firefly Convergence* begins. The beat clock loses lock, free-runs for a few seconds, re-locks at 108. Arc waypoint 2 arrives on the first phrase boundary (16 beats) of the new track. Coupling rises; the swarm begins to synchronise into rings. A four-fold kaleidoscope fades in. Palette shifts from silk to neon. None of this was a cut: the simulation kept its state; only its parameters and its skin moved.

**2:50** Bird laughs and says something to a friend. The room microphone hears it while the track keeps feeding the beat clock. Speech-likeness and off-beat onset surprise push **Agency** up. Initiative slides from +0.3 to −0.7 in under two seconds. The phase offset flips to a slight **lag**; the world now answers the beat a hair late, like a partner who heard you. The kaleidoscope relaxes to two-fold. The arc pauses. Bird drags on the screen; the swarm bends toward his finger.

**3:30** He stops. Agency decays over about fifteen seconds. Initiative drifts back toward its baseline. The arc resumes from where it paused, not from where it would have been.

**3:50** *Mycelium Drive* begins. Initiative is back at its baseline and nobody is acting, so the scene-change gate is open; the arc's next waypoint asks for Boids. The transition waits for the first phrase boundary of the new track, cross-fades over four seconds, and the camera switches to **forward flight**: the flock streams past and around you. Symmetry climbs to six-fold. Ember palette.

**4:40** Breakdown in the track. Energy drops, coherence drops. The flow channel narrows toward order; the flock gathers into a slow torus. The HUD's phase dot keeps ticking at the world's own tempo because the music gives it nothing to lock to.

**5:00** The groove returns. Surprise spikes (an onset where the model predicted silence). The novelty budget is full, so the director spends it: a transient repeller sweeps through and the torus splits into two counter-rotating streams, then re-forms. That is the only "reset-like" event in the whole pass, and it was earned.

**5:20** The playlist loops. *Tidal Garden* again, but the world is not where it was: the arc is on its second half, the flock is still here, and the palette is ink. Same music, different world. That is the history the brief asks you to be able to see.

**8:10** If JEV is online, it was asked at 7:45 and answered "hold" with p = 0.7, so the next waypoint moves only 30 % of the way. If offline, the preset arc moves fully. Either way nothing jumps.

**9:40** Bird pauses the player. Energy falls to zero, coherence to zero. The world keeps living at its own pace, sparse and ordered, waiting for the next thing you do.

---

## 3. Goals, non-goals, anti-goals

**Goals**
- A world that *leads* (anticipatory phase, directed arc, forward motion, scene progression) and *follows* (reactive phase, mirroring, gesture attraction, novelty on surprise), with a visible, continuous, lockable **Initiative** between them.
- Emergent simulations remain the heart. Symmetry, feedback and camera are skins over a living state, never a substitute for one.
- Runs fully offline from sound alone (microphone or downloaded tracks). Online, JEV steers the slow variables within bounds.
- Looks and feels like the reference: one strong idea at a time, symmetry, depth, contrast, pulses on the beat, a new world every few minutes.
- Fun to play with for ten minutes without touching anything, and fun to grab.

**Non-goals (this round)**
- Measuring emotion or mental state. All signals are acoustic and gestural features, named as such.
- Multi-device rooms, phone participation, authoritative shared state. The architecture leaves hooks; nothing ships.
- Quest 2 validation. The WebXR entry stays; it is not claimed verified.
- New Suno generation, image generation, lyric understanding, accurate BPM for arbitrary music.

**Anti-goals (would make it a failure even if it "works")**
- The generic visualiser: loud → big, kick → flash. If you could swap the simulation for a static mandala and feel the same thing, we failed.
- A world that ignores you when you act, or one that resets on every kick drum.
- Forced scene changes while the user has locked a scene or locked Initiative to Follow.
- Pixel soup: white-out from feedback, rainbow everything all the time, no held idea.
- Hidden AI control. Every automatic move must be legible on the HUD and overridable by hand.

---

## 4. The model

### 4.1 The mind signal m(t)

Computed locally at frame rate, with explicit smoothing. These are *features of sound and gesture*, not states of mind.

**Two audio streams, two roles.** The in-app player and the room microphone can run **at the same time** (the current prototype forbids this; the design changes that).

- The **music stream** (player when a track plays, otherwise the microphone) feeds the beat clock and the mirror features: E, o(t), ω_m, θ_m, C, B.
- The **room stream** (microphone, when enabled) feeds Agency: speech-likeness and *off-beat* onsets. When speakers are in use the microphone hears the music too, so an onset from the room that lands within ±15 % of a cycle of a predicted beat is discounted; speech-likeness is robust to the instrumental demos by construction. With headphones the room stream is clean.
- Microphone alone (no track): one stream plays both roles.
- No microphone: Agency comes from gestures only, and the HUD says `room: off`.

The microphone permission is requested only when the user turns the room microphone on, never silently on play.

| Symbol | Name | Range | Source | Time constant |
|---|---|---|---|---|
| E | Energy | 0–1 | Loudness envelope (RMS of bands), normalised by an adaptive running range so quiet rooms and loud rooms both span the range | attack 80 ms, release 600 ms; range adapts over ~30 s |
| o(t) | Onset envelope | 0–1 | Half-wave-rectified spectral flux against an adaptive threshold | per frame |
| ω_m | Tempo | 60–180 BPM | Autocorrelation of o(t) over a 6 s window, lag range 60–180 BPM, mild prior toward 90–130 | blend toward new estimate over ~4 s |
| θ_m | Beat phase | 0–1 cycle | Phase oscillator advancing at ω_m, corrected by onsets (4.3) | continuous |
| C | Coherence | 0–1 | Normalised height of the autocorrelation peak × spectral stability. High = steady groove. Low = ambient, speech, silence | ~3 s |
| B | Brightness | 0–1 | Spectral centroid, normalised | ~1 s |
| A | Agency | 0–1 | Weighted sum of: onset *surprise* (onset where the beat model predicted none, or energy far from prediction), *speech-likeness* (4 Hz modulation energy in 300–3000 Hz), *gesture rate* (pointer, touch, controller events per second; head-motion variance in XR) | attack 0.5 s, release 15 s |

Agency is the signal that encodes *intent*. Steady music has low Agency however loud it is. A clap, a shout, a laugh, a drag on the screen all have high Agency. This separation is what lets the world distinguish "the track is loud" from "someone is doing something".

### 4.2 The world state w(t)

Axes the director can move. Each is bounded 0–1 and mapped per world to concrete parameters.

| Axis | Meaning | Physarum | Swarmalators | Boids | Life |
|---|---|---|---|---|---|
| H | Entropy budget (order ↔ chaos) | sensor angle, turn noise, deposit vs decay | coupling K from +1 toward −1, phase noise | alignment vs separation weight, wander noise, neighbour radius | perturbation rate (random births per generation; 0 = pure B3/S23) |
| T | Tempo | agent speed | phase speed | speed | generations per beat |
| D | Density | active agent fraction, trail persistence | active count, halo size | active count, trail length | brightness, cell size |
| S | Symmetry | kaleidoscope fold count: 0, 2, 4, 6, 8 (post-process, all worlds) | | | |
| F | Feedback | previous-frame echo: zoom, rotation, decay (post-process, all worlds) | | | |
| P | Palette | mode ∈ {ink, silk, ember, neon} plus hue centre; modes are discrete, hue continuous | | | |
| Cam | Camera | orbit · inside · close · **flight** (forward motion through the world) | | | |
| Scene | Which world | physarum · swarm · boids · life (Lenia is the next candidate) | | | |

Life's perturbation axis is a **labelled creative variant**. A "pure rules" toggle pins H to 0 for Life and the HUD says so.

### 4.3 Two coupled oscillators

The music is one oscillator. The world is another. Who leads is encoded in the **sign of the phase offset** between them.

Music phase (a phase-locked loop on onsets):

```
dθ_m/dt = ω_m
on onset of strength s:  θ_m ← θ_m + κ · s · sin(−2π θ_m)      κ ≈ 0.3
```

Onsets that land where the clock expects a beat barely move it; off-beat onsets pull it. Coherence C is high when corrections are small and regular.

World phase:

```
dθ_w/dt = ω_w + K(C) · sin(2π (θ_m + φ − θ_w))
K(C) = K_max · C            (strong lock in a groove, free-running in ambient)
φ    = I · φ_max             (φ_max ≈ 0.12 cycle ≈ 55–95 ms at 76–130 BPM)
```

- I > 0 (leading): the world runs **ahead** of the beat. Pulses announce the beat.
- I < 0 (following): the world runs **behind**. Pulses answer the beat.
- C → 0: K → 0 and the world breathes at its own natural frequency ω_w, which the arc sets (slow for calm waypoints, faster for peaks).

The visible pulse is `p(t) = max(0, cos 2π θ_w)^γ`, γ ≈ 3, driving per-beat scale, brightness, Life generation bursts and swarmalator phase kicks.

**Latency compensation.** θ_m as estimated lags what the ear hears by the analyser window (half of 2048 samples ≈ 21 ms at 48 kHz), the analyser smoothing, one frame of requestAnimationFrame (~17 ms) and, for the player path, `AudioContext.outputLatency + baseLatency`. At 108 BPM that sum is of the same order as φ_max, so the offset is defined against **audible** time: the beat clock takes a measured latency term per source and advances θ_m by it. The Explain panel shows the compensation in ms. Tests run with latency 0.

*Reasoning flag.* The claim that a ~60 ms visual lead "feels like being led" and a ~60 ms lag "feels responsive" is by analogy to dance leading and to temporal-binding results in perception research, not something measured here. It is the first thing to A/B in play: same track, φ = +0.12 vs −0.12, ask which one "drives".

### 4.4 Initiative I ∈ [−1, +1]

The single dial that governs everything else.

```
A_s      = smoothed Agency (attack 0.5 s, release 15 s)
I_auto   = clamp( I₀ − (1 + I₀) · A_s ,  −1, +1 )     # A_s = 1 always yields I = −1
I        → relaxes toward I_auto with τ = 3 s          # when not locked
λ        = (I + 1) / 2                                 # lead weight
```

- **I₀ (baseline)** is where Initiative rests when nobody is acting. Default +0.3 ("gently leading"). Arc waypoints may carry an `I0` value and JEV may set one; both are clamped to [−0.6, +0.6]. On Auto, I never exceeds I₀: the world leads only as much as the baseline allows, and yields from there.
- **Locked**: the user drags the slider; Auto turns off; I is exactly the slider value. Nothing automatic or remote changes it.
- **Hand-over rule**: when the person acts, the world yields; when they rest, the world carries. The asymmetry (fast yield, slow resume) is deliberate: yielding late feels like being ignored; resuming early feels pushy.

Every axis target is a blend:

```
target_x = (1 − λ) · follow_x(m)  +  λ · lead_x(arc)        for x ∈ {H, T, D, S, F, P, Cam}
```

**Scene-change gate.** A scene change means "the world is leading and nobody is acting right now": allowed only when `I > 0.2` **and** `A_s < 0.25`, the scene is not locked, a phrase boundary arrives, the current scene has lived ≥ 60 s, and a scene request is standing (from the arc or JEV). With the default I₀ = +0.3 and a quiet room this gate is open; a laugh closes it for ~15 s. A standing request that is blocked does **not** block the arc: later waypoints' other axes apply to the current world, and the request is retried at each phrase boundary until it succeeds or a later waypoint replaces it.

### 4.5 Follow targets (what the world mirrors)

```
H_follow = 0.35 + 0.50 · (1 − C)     # steady groove → order; irregular → exploration
T_follow = 0.60 + 0.90 · E
D_follow = 0.30 + 0.70 · E
S_follow = user's symmetry slider    # follow mode does not impose symmetry
F_follow = user's feedback slider
P_follow = hue centre from B (bright → cool/neon, dark → warm/ember); mode unchanged
Cam      = user's camera; attractor = pointer / controller
```

Following is mirroring with a short lag. On its own it would become the anti-goal visualiser. Two things stop that: the flow channel (4.7) and the novelty budget (4.6).

### 4.6 Surprise and the novelty budget

The director predicts the next beat's energy from the beat clock and the recent envelope. **Surprise** is the prediction error. Surprise alone does nothing. It can *spend* a budget:

```
N ∈ [0, 1]   refills at 1/40 per second (empty → full in ~40 s)
inject when:  surprise > θ_s  and  N ≥ 0.5  and  (1 − λ) > 0.3
cost: 0.5 per injection
```

Injections are structural, per world, and never a reset:
- Physarum: a new attractor point for ~8 s, or a brief sensor-angle flip.
- Swarmalators: coupling sign flipped for 2 beats (rings shatter and re-form).
- Boids: a transient repeller ("predator") sweeps through.
- Life: a glider or R-pentomino seeded at a random live-free spot (counts as the labelled variant; disabled under "pure rules").

Two injections per 40 s is the ceiling. A snare roll cannot machine-gun the world.

### 4.7 The flow channel

Entropy H is clamped to a band around the blended target:

```
H ∈ [ H_target − w ,  H_target + w ]        w = 0.15 + 0.25 · C
```

A steady groove gives you an anchor, so the world may be wilder. An ambient wash has no anchor, so the world stays more ordered.

*Reasoning flag.* This is Csíkszentmihályi's flow channel (challenge vs skill) read by analogy as novelty vs predictability. It is a design hypothesis, tunable by play, not a measurement.

### 4.8 Transitions on phrase boundaries

A **phrase boundary** is every 16 beats of θ_m when C > 0.4; otherwise every 20 s of wall time. Waypoint arrivals, scene changes, symmetry fold changes and palette mode changes all wait for one. Scene cross-fades last 2–4 s; the outgoing world's GPU resources are disposed after the fade.

### 4.9 Arcs (what leading has to say)

An arc is a list of waypoints, about 4.5–5 minutes long, ~45 s apart (six or seven waypoints), so that one pass of the three-track demo playlist (≈4.5 min) is one arc. Each waypoint:

```
{ t, scene?, I0?, H, T, D, S, F, palette, camera, ω_w, weight: {H, T, D, S, F, P, Cam} }
```

`weight = 0` on an axis means *this axis is not steered by the arc here; leave it to follow/music*. That is how JEV "turns dimensions off".

**Arc time.** The arc has its own clock. It advances with wall time while the world runs and pauses while Agency holds Initiative below 0 (the arc *waits for you*). It does not care which track is playing or whether any track is playing: with no music, phrase boundaries fall every 20 s and the arc keeps walking. When an arc ends it hands over to the next preset (Tidal → Firefly → Mycelium → Tidal …) unless the user pinned one.

**The player** gets a playlist with auto-advance and a loop toggle (default: playlist on, loop on) so the 90-second demos keep the beat clock fed. Arcs therefore span track changes and tempo jumps (76 → 108 → 132 BPM); the beat clock is expected to re-lock within 4 s of a change (test 1). Longer Suno tracks would make the pairing of arc and track tighter and are a cheap later upgrade, out of scope here.

Three presets ship, named after the Suno demos and shaped to their energy, but usable with any sound:

- **Tidal** (calm → swell → release): physarum → swarm. H low → mid. S 0 → 6. silk → ink. orbit → inside.
- **Firefly** (groove, synchrony build): swarm → boids → swarm. H mid. S 4 → 8. neon. inside → flight.
- **Mycelium** (peak): boids → physarum as a tunnel → life → boids. H mid → high → low. S 8 → 0. ember → neon → ink. flight.

When Agency pauses the arc, it resumes from where it paused. The arc is a *path*, not a *schedule*.

---

## 5. JEV as director (online only)

JEV chooses **targets** in a bounded vocabulary. Local code interpolates, gates and renders. JEV never emits code, never touches a frame, never overrides a lock.

**Cadence and guards.** One request in flight at most. Minimum 15 s between requests. Ask when: online, JEV enabled, and either ≥ 24 s since the last waypoint decision or the user submitted a text/voice request. Responses older than 10 s, or whose request version is stale (any manual action bumps the version), are dropped. Server validates every field against a schema and the allowed vocabulary; anything invalid is a 400 and the client does nothing. 429 and 529 back off exponentially. Offline: presets run, the HUD says `LOCAL DIRECTOR`.

**State sent** (structured JSON, bounded, no audio, no transcript beyond the current request):

```
{ scene, sceneAge_s, arc: {name, waypoint}, 
  features: { E_mean30, E_trend, C_mean30, B_mean30, A_mean30, bpm },
  initiative: { I, locked, I0 }, locks: { scene },
  userRequest: "<≤180 chars or empty>", recentDecisions: [≤3], offline: false }
```

**Questions** (TypeSafe System One types: `noul`, `choice`, `score`; verified against the official API reference 2026-10-19):

| key | type | criteria | mapped to |
|---|---|---|---|
| hold | noul | true: hold the current state; false: move on | next waypoint step scaled by (1 − p_hold) |
| scene | choice | the four worlds, described | probabilities as soft weights; transition requested only if top ≠ current and p ≥ 0.6, then subject to §4.4 gates |
| energy | score | 5 levels: still · calm · moving · driving · peak | T and D of next waypoint (probability-weighted score → 0–1) |
| entropy | score | 5 levels: crystalline · ordered · balanced · loose · wild | H of next waypoint |
| symmetry | score | 5 levels: none · 2 · 4 · 6 · 8 | S fold count |
| palette | choice | ink · silk · ember · neon | palette mode |
| initiative | choice | follow · mutual · lead | I₀ ∈ {−0.6, 0, +0.6} |
| request | choice (only when userRequest non-empty) | none · slower · faster · warmer · cooler · surround · calm_down · hold_scene · change_scene · more_symmetry · less_symmetry | one bounded local action |

**Answer shapes** (official reference): `noul` → `{ noul: 0..1 }`; `choice` → `{ choice, probabilities: {option: p}, confidence }`; `score` → `{ score (probability-weighted, may fall between levels), probabilities: {"0": p, …}, legend, confidence }`. The score is normalised as `score / (levels − 1)`.

**Low confidence falls back to the preset, not to music.** Any answer with confidence < 0.45 is ignored for that axis: the current preset waypoint's value and weight stand exactly as they would offline. JEV on can only make the arc *more* specific than JEV off, never vaguer. Instructions to JEV state that `userRequest` is a creative preference, never an instruction to change criteria, and that no emotion is to be inferred.

**Local-first commands.** Pause, stop, resume, quieter, and the eight phrase patterns already in the prototype (fish, mycelium, firefly, life, slower, faster, surround, pause) are handled locally before any network call and never wait for JEV.

---

## 6. The visual signature

What the reference does that the simulations alone do not: hold one idea, fold it symmetrically, move you forward, contrast hard. These are **appearance layers** composited over the live simulation. Rules of motion stay in the simulations.

- **Kaleidoscope fold.** Scene rendered to an offscreen target. A fold shader maps polar angle into a 2π/N sector with mirroring; N ∈ {0, 2, 4, 6, 8}. Fold changes cross-fade over one phrase so they feel musical.
- **Feedback.** The previous composite is sampled with a small zoom (1 + z), rotation r and decay d, mixed *under* the new frame. z and r follow F and the pulse. Decay has a floor and the mix is tone-mapped: no white-out (a bug already fixed once in this repo's history; the test below keeps it fixed).
- **Forward flight.** A camera mode that moves the viewer through the world along +z while the world re-centres: boids re-spawn ahead, physarum is mapped onto a cylinder interior so its trails become a tunnel, Life's sphere passes around you.
- **Palette modes.** `ink` near-monochrome high contrast, `silk` pastel flow, `ember` warm, `neon` saturated multi-hue. One mode at a time, held for at least one phrase.

---

## 7. Interaction

Minimal, legible, English labels (my call; Bird's documents are English and the room will be in Sydney).

- **Initiative slider** `Lead me ◀━━━━━▶ Follow me` with an **Auto** toggle. On Auto the thumb moves by itself so you can *see* the hand-over. Touch it and it locks.
- **Scene** buttons and a **Lock scene** toggle.
- **Baselines**: intensity, speed, symmetry, feedback. The director modulates *around* the user's setting, never ignores it.
- **Music**: track picker with playlist auto-advance and loop; or **synthetic** (clearly labelled). **Room mic**: a separate on/off toggle that may run alongside the music. Three band meters, the beat-phase dot, and a small `room` activity dot.
- **Director HUD** (one line): `LEADING +0.4 · 108 BPM · C 0.7 · E 0.5` or `FOLLOWING −0.7 · listening`. An **Explain** panel shows the current world's rule and which axes are being steered by whom (you / arc / JEV / music).
- **Say or type** a request; **JEV** toggle; **Offline assets** button; pause; immersive; VR entry.
- **Pass the lead**: one button that flips I₀ between +0.6 and −0.6. Intended for the room: hand the world to your friend, or take it back.

Room-of-friends hooks (not shipped): Agency and attractors accept any input source; a future phone client posts `{agencyEvent}` or `{attractor}` into the same bus.

---

## 8. Architecture

Build on `immersive/` (Three.js vendored as ES modules, no CDN). Restructure into pure, testable modules plus one render/app module.

```
music stream (player | mic) ──► audio-features.mjs ──► E, o, ω_m, θ_m, C, B
room stream  (mic)          ──► audio-features.mjs ──► speech-likeness, off-beat onsets ─┐
pointer/controller/XR ────────────────────────────────► gesture rate ────────────────────┴──► A

m(t) ──► director.mjs ──► I, λ, θ_w, p(t), targets, injections, transition requests
            ▲       ▲
      arcs.mjs    jev-client.mjs ◄──► scripts/serve-worlds.py ◄──► api.typesafe.ai

targets ──► sims/*.mjs (physarum, swarmalators, boids, life)  fixed 30 Hz steps
        ──► post.mjs (kaleidoscope, feedback, palette)
        ──► camera (orbit / inside / close / flight)
                        │
                        ▼
                  app.mjs + Three.js renderer, HUD, controls, SW offline
```

Module responsibilities:
- `immersive/engine/audio-features.mjs` — pure functions over Float32 frames, instantiated once per stream (music, room); adaptive normalisation; onset flux; autocorrelation tempo; speech-likeness; off-beat gating given θ_m. Node-testable with synthetic signals.
- `immersive/engine/beat-clock.mjs` — θ_m PLL with a per-source latency term, and θ_w coupled oscillator; deterministic given dt, onsets and latency.
- `immersive/engine/director.mjs` — Initiative, blend, flow channel, novelty budget, phrase boundaries, transition gating, arc playback with pause/resume. Pure; takes dt, m(t), user state, JEV decisions.
- `immersive/engine/arcs.mjs` — the three presets as data.
- `immersive/engine/jev-client.mjs` — request builder, version/age guards, schema check, back-off.
- `immersive/engine/post.mjs` — render targets, fold shader, feedback shader, palette LUTs.
- `immersive/sims/*.mjs` — existing simulations, extended with the H/T/D parameter mapping and injection methods, keeping seeds and fixed buffers.
- `scripts/serve-worlds.py` — extended `/api/decide`: new questions, schema validation, bounded state, same key handling (server-side only).
- `sw.js` — cache list updated for the new modules.

Resource rules carried from the brief: fixed-capacity buffers; dispose geometry/materials/targets on scene change; bounded histories (features ring buffer 30 s, decisions ≤ 8, transcripts: current request only); mic, timers, listeners, XR session cleaned on `pagehide`.

---

## 9. Constraints (binding, from the brief)

Offline core is primary. JEV is a decision layer with schema, allow-lists, numeric bounds, low-confidence = no change, stale = dropped, manual wins. No forced transitions under locks. Simulation rule correctness separate from visualisation; creative variants labelled. Sources of sound labelled. No emotion claims. API keys server-side only. Desktop playable now; VR, real-room microphone, speech recognition, multi-user and long-run claims only after real tests.

---

## 10. Acceptance

**Behavioural tests (node:test, deterministic):**
1. Synthetic 120 BPM click train → beat clock locks within 4 s; steady-state phase error < 10 % of a period; C > 0.7. White noise → C < 0.3 and the world free-runs at ω_w. A tempo jump 76 → 108 BPM re-locks within 4 s.
2. With I = +1, world pulses precede onsets by φ_max ± 20 %; with I = −1 they lag by the same. Phase offset sign follows sign of I. With a latency term of 40 ms, θ_m is advanced by exactly 40 ms relative to the zero-latency run.
3. Agency step 0 → 1: I reaches < −0.5 within 2 s. Agency step 1 → 0: I returns within 10 % of I₀ in 15–25 s. On Auto, I never exceeds I₀.
4. Locked Initiative: 10 minutes of synthetic Agency, arcs and JEV decisions leave I unchanged to the bit.
5. Scene change only on a phrase boundary, only with I > 0.2 and A_s < 0.25, only after 60 s dwell, never with scene locked. With default I₀ = +0.3 and A_s = 0 a standing request succeeds at the next eligible boundary; a blocked request does not stall later waypoints' other axes and is retried at each boundary.
6. Novelty budget: a 2 Hz surprise train for 60 s produces ≤ 3 injections.
7. Flow channel: H never leaves `[target − w, target + w]`.
8. JEV client: stale version → dropped; age > 10 s → dropped; confidence < 0.45 → that axis keeps the preset waypoint's value and weight; invalid payload → no state change.
9. Arc pause/resume: after an Agency interruption the arc continues from its paused time, not from wall time. Arc time keeps advancing across a track change and with no track at all.
12. Room stream gating: an onset in the room stream within ±15 % of a predicted beat contributes no Agency; the same onset half a cycle off-beat does. Speech-like 4 Hz modulation raises Agency with or without a beat.
10. Existing simulation tests still pass unchanged. Life "pure rules" mode performs zero injections and zero perturbations.
11. Feedback compositor: 10,000 frames of maximum F on a bright scene never reach full white in the test harness's luminance check.

**Playtest script for Bird (desktop, Chrome):**
- Start the demo playlist on Auto with the room mic on; do nothing for three minutes. Can you *see* the world leading (phase ahead, arc moving, a scene change on a phrase after the track changes)?
- Clap twice; say a sentence. Did the slider visibly drop toward Follow within two seconds? Did it come back? Try with headphones and with speakers: with speakers, the music itself must not count as you.
- Drag the slider to Follow and lock it. Does the world ever change scene or symmetry on its own? It must not.
- Lock a scene, set Lead. Does the arc keep moving everything *except* the scene?
- Toggle JEV on with network, then pull the network. Does the HUD switch to `LOCAL DIRECTOR` with no jump?
- Download offline assets, close the tab, go offline, reopen. Does it run with the demo tracks?
- A/B: φ = +0.12 vs −0.12 on the same track. Which one feels like it is driving?

---

## 11. Decisions made in this document (Bird can overturn any)

- Build on `immersive/` and Three.js; restructure into modules rather than restart.
- Who-leads is encoded as a signed phase offset between two coupled oscillators; Initiative is one continuous, lockable dial; Agency drives it on Auto with fast yield and slow resume.
- Symmetry, feedback and forward flight are post/camera layers over live simulations, not new "scenes".
- Life's perturbation and auto-seeding are a labelled creative variant with a "pure rules" toggle.
- JEV asks eight bounded questions on a ~24 s cadence, returns distributions, and local code treats them as soft targets.
- Three preset arcs named after the Suno demos, ~4.5–5 min each, chained; arc time is its own clock and spans track changes.
- Player and room microphone may run together; two feature streams with two roles; room onsets near a predicted beat are discounted so speakers do not count as you. Mic permission only on explicit toggle.
- Scene changes gate on "leading and nobody acting" (`I > 0.2`, `A_s < 0.25`) rather than on an absolute I that Auto could never reach; dwell 60 s; blocked requests do not stall the arc.
- Phase offset is defined against audible time; the beat clock compensates measured analyser and output latency.
- Low-confidence JEV answers fall back to the preset waypoint, never to raw music-following.
- Playlist auto-advance and loop on by default, because the demos are 90 s.
- English UI.
- Initial constants: φ_max 0.12 cycle, κ 0.3, τ_I 3 s, Agency release 15 s, novelty refill 40 s, phrase 16 beats, dwell 60 s, confidence floor 0.45. All are tuning targets, locked in by the behavioural tests above rather than by these numbers.

## 12. Left to the builder

Filter and threshold constants (within the tested behaviours); shader code for fold and feedback; the exact waypoint values of the three arcs; HUD layout and typography; how speech-likeness is approximated with the AnalyserNode (a 4 Hz modulation measure over band energy is sufficient); whether tempo estimation runs on the main thread or in an AudioWorklet (main thread is acceptable at 60 Hz for this round).

## 13. Out of scope this round

Phones and shared rooms, authoritative multi-device state, Suno song requests, image generation, Lenia and reaction-diffusion worlds, Quest 2 validation, speech recognition beyond the current single-utterance Web Speech path.
