# Flow with Mind v3 — Visual Language, Computer Music, Immersion

Date: 2026-10-25 · Status: draft for Bird's review · Amends v1 (2026-10-19) and v2 (2026-10-20); they stay binding where v3 is silent.

> v2 made the worlds live and put you in a ship. Bird's next ask: play without headphones on whatever his computer is already playing; put Immersion where the hand lands; and give the picture a vocabulary beyond the kaleidoscope, programmable enough that the world can speak to him "not in language, in mind". v3 is that vocabulary and the grammar that speaks it.

---

## 1. What Bird asked (2026-10-25)

1. "直接連現時電腦音樂，總之戴無 headphone 都玩到" — drive the worlds from whatever the computer is playing (Spotify, YouTube, anything), with speakers.
2. "Immersion 要放在最當眼的位置" — the immersive mode must be the most visible control.
3. "睇多啲 trippy video 再決定點調而家個畫面，包括到萬花筒以外的效果，加多啲 programmable 的 trippy video，令你可以同我心靈溝通，不只語言，是心靈" — a bigger, programmable visual vocabulary, and a way for the world to communicate through it.

## 2. What the research found

Sources: AllSeen's kaleidoscope journeys (v1 reference), Electric Armadillo's AI infinite-zoom pieces ([Vortex](https://www.youtube.com/watch?v=DZWq7Er1aGc), [Open Your Mind](https://www.youtube.com/watch?v=rgjmKW3u_e8)), Maths Town's Mandelbrot deep zooms ([Internal Memories](https://www.youtube.com/watch?v=rYAO0NtsoOg), [Heat Flow](https://www.youtube.com/watch?v=s9YjeyvDKSU)), [Neural Frames' survey of trippy video techniques](https://www.neuralframes.com/post/trippy-videos), and [Klüver's form constants](https://en.wikipedia.org/wiki/Form_constant).

The genre's vocabulary, as seen:

| Device | Where it appears | What it does to the viewer |
|---|---|---|
| **Infinite zoom / tunnel** | every reference | pulls you forward for ever; the "hole" |
| **Symmetry** (radial kaleidoscope, bilateral mirror) | AllSeen, Maths Town | order, mandala, held attention |
| **Feedback echoes / colour trails** | AllSeen, VJ loops | motion leaves history; melting |
| **Domain warping / morphing** | Armadillo, "oil-slick" shaders | things become other things |
| **Contour bands** (iso-lines, posterised colour) | Maths Town | the hypnotic map-like reading of depth |
| **Form constants**: lattice, cobweb, tunnel, spiral | Klüver 1926; AllSeen's woven tunnels | the shapes the visual cortex makes on its own |
| **Breathing textures**, slow scale pulsing | all | the picture is alive |
| **Chromatic split, hue cycling** | AllSeen, VJ | intensity, edge, "the colours are moving" |
| **One strong idea per passage**, changing every few minutes | AllSeen, Armadillo | a journey, not a screensaver |
| **Beat-triggered change; continuous slow motion between** | all audio-reactive work | sync without jitter |

Bressloff and Cowan's explanation matters for us: circles on the retina map to parallel lines in the primary visual cortex, so tunnels, spirals, cobwebs and lattices are all **straight stripes in log-polar space** with different orientations. One shader with an orientation parameter produces the whole family. Rendering it in log-polar coordinates also gives the infinite-zoom pull for free: drifting the stripes along log r is falling down the tunnel.

## 3. The visual stack (what the picture can do)

All effects are screen-space passes over the live world render (v1 §6: appearance layers, rules untouched). Each has a few parameters in 0..1 and a cost budget; the stack is one fragment shader with uniforms, so adding an effect adds no passes.

| Effect | Parameters | Notes |
|---|---|---|
| **fold** (exists) | n ∈ {0,2,4,6,8} | radial kaleidoscope |
| **mirror** | mode ∈ {none, h, v, quad} | bilateral symmetry, cheaper and calmer than fold |
| **echo** (exists, extended) | decay, zoom, spin, **droste** | feedback; droste = log-polar spiral feedback, the frame falls into itself |
| **tunnel** | amount, speed | log-polar remap of the whole frame: the screen becomes a tube you slide down |
| **forms** | kind ∈ {tunnel, spiral, cobweb, lattice}, density, drift, contrast | Klüver stripes in log-polar space, blended over the world (screen blend); drift along log r = infinite zoom |
| **warp** | amount, scale, rate | iterated sin domain warping of the sampling coordinates (6 iterations) |
| **breath** | amount | barrel/pincushion breathing locked to the world clock |
| **contour** | bands, line | posterise luminance into bands with thin dark iso-lines (Maths Town) |
| **chroma** | split, cycle | RGB split in pixels; hue rotation rate |
| **gain** (exists) | depth | overall intensity; Bird's Depth dial |

Order: world → warp → tunnel → fold/mirror → forms → contour → echo → chroma → out. A **program** is the vector of all parameters. Programs crossfade over a phrase (v1 §4.8) or over one beat for gestures (§5).

Budget: the whole stack stays under 3 ms per frame at 1440p on this Mac (v2 measured 2 ms with fold+echo). Warp at 6 iterations and forms are the expensive two; both have a `quality` uniform the app lowers when fps drops below 50 for two seconds.

Photosensitivity: nothing in the stack flashes the full frame faster than 3 Hz; chroma flashes last one beat and are capped at 1 per 2 s; contour and forms never invert the frame. A "calm" switch in Setup caps gain at 0.5 and disables chroma.

## 4. The grammar (how the world speaks)

The world has an inner state the HUD already prints: Initiative I, Agency A, Energy E, Coherence C, Entropy H, Liveliness L, heat, surprise, the beat phase, the ship (hover/ship/dive), jumps and rewinds. v3 makes that state *visible without the HUD*: a fixed mapping from state to the program, plus a small set of **gestures** — short visual sentences the world says at moments of change. Consistency over novelty: a person should be able to learn, within a session, what the world is saying.

### 4.1 Continuous mapping (state → program)

| State | Program |
|---|---|
| **I → +1 (leading)** | forms kind drifts toward *tunnel/spiral*, drift inward with the beat (pull); fold ≥ 4; echo spin with the arc |
| **I → −1 (following)** | forms kind *cobweb/lattice* (open, facing you), drift outward slowly (release); mirror instead of fold; warp amount tracks the room (speech/onsets) so the picture visibly answers your voice |
| **Agency A rising** | mirror opens (quad → h), forms density down: the world turns to face you |
| **Entropy H** | low: contour bands up, warp down (crisp); high: warp up, chroma split up, echo decay up (melting) |
| **Coherence C** | high: forms drift locked to bpm, breath off; low: forms drift slow, breath on |
| **Energy E** | gain and forms density |
| **Liveliness L / heat** | heat raises warp and echo (the world sweats); L near the rewind band makes the picture lean into droste |
| **Ship: hover** | tunnel 0, forms drift 0 | 
| **Ship: flight** | tunnel amount 0.3, forms drift with speed |
| **Ship: dive** | tunnel 0.7, spiral forms, drift ×2.5, chroma split up |
| **Jump** | tunnel 1, forms lattice at full drift, chroma, mirror quad, for the 4 s |
| **Depth (user)** | gain, and a ceiling on fold/forms/warp: Depth 0 is a quiet mirror world, Depth 1 is everything |

JEV (v1 §5) gains one more `choice` question, **mood** ∈ {clear, dream, melt, electric, holy}, each a preset program bias blended at the next phrase boundary with the same confidence floor; low confidence leaves the mapping alone.

### 4.2 Gestures (sentences)

A gesture is a 1–4 beat envelope over a few parameters, triggered by an event; at most one gesture at a time; gestures never change the scene.

| Gesture | Trigger | What you see |
|---|---|---|
| **Take** | Initiative crosses +0.2 upward (the world takes the lead) | spiral forms sweep inward over 2 beats, fold snaps from mirror to 6 and settles |
| **Yield** | Initiative crosses −0.2 downward (the world yields to you) | the picture exhales: breath out, mirror opens to h, forms fade for 2 beats |
| **Listen** | Agency rises above 0.5 while following | warp pulses with each of your onsets for up to 4 beats (the world nods) |
| **Carry** | leading for 16 beats without a gesture | one slow tunnel pull over 4 beats (a breath in) |
| **Surprise** | director surprise > 0.7 | one-beat chroma flash + contour bands double, then recover |
| **Rebirth** | rewind | droste collapse: the frame falls into its own centre over the 2 s dissolve and the younger world grows out of it |
| **Jump** | scene change | hyperspace program (§4.1) |

### 4.3 What this does not claim

The mapping is a *language the system speaks about its own state*, not a reading of anyone's mind (v1 §1, §9). "心靈溝通" here means: Bird can feel what the world is doing without reading a line of text, and the world responds to what he does without him naming it.

## 5. Computer music (play without headphones)

- New sound source **Computer music**: `getDisplayMedia({ video: true, audio: { suppressLocalAudioPlayback: false } })`, keep the audio track, stop the video track at once. Chrome on macOS 14.2+ (Chrome ≥ 141) offers "share system audio" in the picker ([Addpipe's test](https://blog.addpipe.com/getdisplaymedia-allows-capturing-the-screen-with-system-sounds-on-chrome-on-macos/)); any Chrome can share a *tab's* audio (Spotify Web, YouTube). The stream is analysed only, never played back (no doubling), so **speakers are fine**: the music stream is clean and the room mic stays the room.
- Falls back honestly: if the picker is cancelled or the track has no audio, the source stays off and the status says what to tick ("choose a Chrome tab and tick Share tab audio" / "choose Entire screen and tick Share system audio").
- HUD source reads `SYSTEM` or `TAB`; the room mic may run alongside as in v2. Nothing is recorded or uploaded.
- Not in scope: capturing native apps on browsers without system-audio sharing; the notes mention BlackHole/Loopback as the OS-level alternative.

## 6. Immersion first

- A single **Immerse** control sits where the hand lands: large, centred under the HUD line above the ring on first load (`▣ Immerse`), and after the first use it becomes a corner glyph. It requests browser fullscreen, hides titles/meters, keeps the ring and the HUD line (which still fades after 3 s). Esc leaves fullscreen and shows the drawer.
- The first tap still launches the ship; Immerse is a separate, obvious button rather than a hidden gesture (Bird's ask: most visible, not most clever).
- In Setup the drawer's "Immerse" entry goes; Setup keeps hover/pause/explain.

## 7. Constraints carried

Offline core; labelled variants; locks never moved by anything automatic; no emotion claims (the grammar describes the system's state); fixed buffers; engine modules import no DOM/Three; `node --test` and the Python tests stay green; English UI; commit trailer.

## 8. Acceptance

**node:test**
1. `grammar.mjs`: `programFor(state, depth)` is pure and bounded: every parameter in 0..1 (fold in FOLDS, forms kind in the set); leading state → forms tunnel/spiral with inward drift; following → cobweb/lattice with outward drift and mirror; Depth 0 caps fold 0 / forms 0 / warp ≤ 0.1; Depth 1 allows all; H low → contour > warp; H high → warp > contour.
2. Gestures: `GestureEngine.update(dt, state, events)` triggers Take/Yield exactly once per crossing (hysteresis), Listen only while following with A > 0.5, Carry after 16 beats of uninterrupted lead, Surprise at most once per 2 s, Rebirth on rewind; at most one active; envelopes return to 0 within their length.
3. Program blending: `blendPrograms(a, b, u)` is linear for continuous parameters and steps discrete ones at u ≥ 0.5; a phrase crossfade reaches the target within one phrase.
4. Photosensitivity: over any 60 s of synthetic events the number of chroma flashes ≤ 30 and no two within 2 s.
5. JEV `mood` maps to the five bias programs; low confidence → no change (extends the server tests).
6. Existing 122 tests unchanged.

**Browser (via `__flow.advance`)**: each effect visible alone at amount 1 (screenshots); the stack under 3 ms at 1440p; dive raises tunnel and spiral; rewind shows the droste collapse; Immerse enters fullscreen (manual, needs a real gesture); Computer music: picker appears on click (manual), cancelled picker leaves the source off with the right message.

## 9. Decisions in this document (Bird can overturn)

- One shader stack, not many passes; forms rendered as Klüver stripes in log-polar space (the research's one principled generator).
- Consistency over novelty: seven gestures, one continuous mapping, learnable in a session. More vocabulary later, not more randomness.
- Computer music via `getDisplayMedia` (tab or system audio), analysed only; mic unchanged.
- Immerse is a visible button, not a gesture.
- JEV gets one new question (`mood`) rather than control of individual effects.
- Photosensitivity caps are hard limits, not tuning targets.

**Open question for Bird:** when the world speaks, should the HUD line disappear entirely in Play (the picture is the only channel), or stay as a faint caption for the first sessions? Default: stays until Bird says it reads.
