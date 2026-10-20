# Flow with Mind v2 — Metabolism, Travel, Play Surface

Date: 2026-10-20 · Status: draft for Bird's review · Amends `2026-10-19-flow-with-mind-design.md` (v1 stays binding where this document is silent)

> v1 built a partner that can lead or follow. Bird's first play found three things: the worlds settle into furniture, the viewer stands still on a balcony, and the balcony has thirty switches. v2 gives the worlds a metabolism, puts the viewer in a ship, and leaves one ring on the glass.

---

## 1. What Bird found (2026-10-20)

- Every world stabilises: "it tends to be stabilized at some point… didn't show the initial colorful vivid dynamic change", "especially the mycelial network… a very sturdy stable pattern… not reactive to the room music".
- Firefly resonance (swarmalators) was the best experience "as it keeps changing and is very stimulating".
- All worlds are spheres observed from a fixed point: "make it feel more like falling in the hole… move me around like I'm taking a spaceship and travel between different worlds".
- The UX is too complicated: "too many buttons to toggle around… especially when you are, say, trippy".

Measured (node, 3 min, music energy 0.4, H 0.3): physarum field change per step fell 16 → 4.4; swarmalator order parameter 0.07 → 1.00 with velocity → 0 by 60 s (a frozen ball); Life population 740 → ~300 of still-lifes; boids kept turning but only circled the origin.

**Causes.** (1) Arc entropy H sat at 0.15–0.5, instructing the worlds to crystallise. (2) Music changed scalars (speed, density) but never structure. (3) The follow-mode formula pushed H down in steady grooves. (4) Swarmalators ran in the static-sync regime; the model's perpetual-motion regimes went unused. (5) A world kept its frozen state across scene changes. (6) Nothing measured whether a world was still alive.

---

## 2. What a session feels like now

You are in a ship. It is always moving, slowly, through a cloud of fireflies that stream past and re-form ahead. The music builds; the ship pitches down and the cloud becomes a tunnel; speed ramps like gravity; the kaleidoscope folds the tunnel walls. On the drop the ship levels out and the fireflies scatter and re-sync in rings around you. Minutes later the network ahead begins to look like furniture; the director notices, raises the heat, and when that is not enough the world melts back to how it looked a minute ago and starts to grow again. The arc wants the next world: speed triples, stars streak, the old world dissolves behind you and the cellular tunnel opens ahead. The only thing on the glass is a faint ring at the bottom, drifting between *Lead me* and *Follow me*. You drag it, it stays. You swipe left, you are in the next world. You shake the phone, the snow globe resets. Nothing else is there unless you long-press.

---

## 3. Metabolism

### 3.1 Liveliness L (per world, 0–1)

Measured on the simulation state every fixed step and smoothed over 2 s; normalised against a reference recorded during the first 10 s after seeding (so each world's own early vigour is "1").

| World | Raw measure |
|---|---|
| Physarum | mean |Δfield| per step |
| Swarmalators | 0.5·(1 − r) + 0.5·min(1, mean speed / 0.1), r = Kuramoto order parameter |
| Boids | mean |Δvelocity| per step (turning), plus 0.3 if the centroid moved > 1 unit in the last 5 s |
| Life | cells changed per generation / live population |

`L` is exposed on the HUD/Explain and to the director.

### 3.2 Controller

- Target band [0.35, 1.0]. Below 0.35 for 5 s: entropy target rises by +0.15 (ramping over 5 s, up to +0.4) and the novelty budget is refilled to 0.5 so an injection can fire at once.
- Below 0.2 for 15 s (after the heat): **rewind** (3.3). Then a 30 s cooldown before the controller may fire again.
- The controller moves the *target*; the flow channel (v1 §4.7) still bounds the result; the user's Depth dial and locks are untouched.

### 3.3 Rewind (the snow globe)

- Every 20 s each world stores a snapshot of its state arrays (positions, velocities, phases, field, cells, age) with its L at the time; keep the last 4. Cheap: all are small typed arrays.
- Rewind picks the stored snapshot with the highest L and dissolves the world into it over 2 s: continuous arrays lerp; Life cells switch per cell at random moments across the 2 s (a labelled creative variant; disabled under pure rules, where rewind reseeds instead with a visible "reseed" note).
- Also triggered by: a gesture (shake, two-finger tap, keyboard R); returning to a world whose last L was below 0.35.
- Rewind is never a reset: history stays visible as the world melts backward.

### 3.4 Music changes structure

Fast (per beat/onset), medium (per phrase), slow (arc): v1 §4 stands; the mappings below are added.

| World | On beat (world pulse) | On strong onset / off-beat accent | On phrase boundary |
|---|---|---|---|
| Physarum | deposit burst ×3 for one step | the **food** attractor jumps to a new position (bass → radius, treble → angle); agents chase it | sensor angle breathes: ±0.3 rad for 4 beats |
| Swarmalators | phase kick +0.3·pulse rad to a random third | coupling sign flips for 2 beats (exists) | move within the **active phase-wave regime** (K ∈ [−0.4, −0.1], J = 1) ↔ ring regime (K ∈ [0.2, 0.6]) by H |
| Boids | gust: wind vector rotates 15° | predator sweep (exists) | wind direction turns 90°; flock target height follows brightness B |
| Life | generations burst (exists) | glider seeded at a random edge | a stripe of cells re-seeded along the beat axis (variant) |

Default H ranges in all arcs move to 0.35–0.75; the follow formula becomes `H_follow = 0.45 + 0.35·(1 − C)`; the visible beat pulse scale doubles (0.25 → 0.5).

---

## 4. Travel: the ship

### 4.1 Motion model

- The camera is a ship at the origin facing −z; the world streams toward it (v1's flight), always. Speed `v = 2 + 4·T` units/s, scaled by `(1 + 0.6·pulse·intensity)`, with a 2 s ramp on changes.
- Heading drifts with a slow noise (0.05 Hz) and banks into turns (roll ≤ 12°). On a phrase boundary the heading turns 20–40°. User drag adds a yaw/pitch offset that decays back over 6 s. Wheel or pinch trims speed ±50 %.
- **The dive.** When energy trend is positive for ≥ 8 s with C > 0.5, the ship pitches down 25° toward the tunnel axis, speed ramps to ×2.5 over the build, fold rises by one step and feedback zoom doubles; on the drop (energy step down or phrase boundary after the peak) it levels out over 2 s. Gravity, then release.
- **Hover is the default** (Bird, 2026-10-20): the app opens at rest, speed 0, slow orbit, no roll; a tap on the glass (or Space) launches the ship, and long-press on the ring (or Setup) returns to hover. Angular rate is capped at 20°/s in all modes; VR stays in hover unless the controller trigger launches.

### 4.2 Worlds as volumes

| World | v1 | v2 |
|---|---|---|
| Physarum | texture on a sphere | field on an endless **tunnel** (cylinder interior, radius 6 breathing with pulse, scroll with ship speed, slow twist with H); the sphere remains in hover |
| Swarmalators | bounded cloud | cloud **wraps** around the ship: an agent passing z > +6 re-enters at z = −30 keeping x, y and phase; coupling computed in the wrapped frame |
| Boids | wind + re-spawn | same, plus the curved heading and gusts |
| Life | cells on a sphere | cells on a **cellular tunnel**: the toroidal grid's x wraps around the cylinder, y runs along it and scrolls with speed; the sphere remains in hover |

### 4.3 Jumps between worlds

A scene change is a 4 s **jump**: speed ×3, star streaks (line length ∝ speed), fold to 8, feedback up, the old world dissolves behind (its group scales down along −z) while the new one fades in ahead. Director gates are unchanged (phrase boundary, dwell, locks, Initiative). The new world starts from its best recent snapshot or a fresh seed if it was frozen.

---

## 5. Play surface

### 5.1 Two states

**Play** (default): the world full-screen, no chrome. The HUD line fades 3 s after the last interaction and returns on touch. **Setup**: a drawer opened by long-press (or Esc / ⚙): music, room mic, offline, JEV, arc, hover, Explain, the four world buttons, reseed, Life pure rules. Sensible defaults so most people never open it: auto arc chain, playlist on, mic asked once.

### 5.2 Two controls

- **The ring**: an arc at the bottom of the glass, *Lead me* at the left end, *Follow me* at the right. On Auto the dot drifts by itself (you watch the hand-over). Drag the dot to lock; double-tap it to pass the lead (flips the baseline); long-press it for hover.
- **Depth**: vertical swipe (or a second, smaller ring on the right edge). One value 0–1 that bundles symmetry fold (0 → 8), feedback (0.1 → 0.9), saturation (palette mode silk → neon) and speed (0.6× → 1.6×). The arc still moves around it (v1's "baseline" rule).

### 5.3 Gestures (touch and mouse) and keys

| Gesture | Action | Key |
|---|---|---|
| tap | in hover: launch the ship; in flight: pulse + attractor at the point | Space |
| drag | steer the ship (decays back) | arrows |
| swipe ← / → | next / previous world (asks the director: honoured at the next phrase boundary, immediately if Initiative is locked to Follow) | [ ] |
| swipe ↑ / ↓ | depth ± | + − |
| long-press (not on the ring) | hold this world (lock scene) | H |
| two-finger tap / shake | rewind (snow globe) | R |
| pinch / wheel | speed trim | |
| long-press the ring | hover on/off | V |
| Esc / ⚙ | setup drawer | Esc |

### 5.4 Removed or merged

Skin, view, pin arc, loop, auto-advance → automatic. Synthetic beat → setup (dev). Explain → setup. Intensity, speed, symmetry, feedback, hue → Depth (+ palette from the arc). Lock scene → long-press. Reseed → shake. The command box and "Say a request" stay in setup; voice still works from Play via a key.

---

## 6. Constraints carried from v1

Offline core first; JEV sets targets only; manual wins; locks never moved by anything automatic; labelled variants (Life rewind/stripes); no emotion claims; fixed buffers (snapshots are preallocated: 4 × state size per world); dispose on scene change; English UI; commit trailer; `node --test tests/*.test.mjs tests/*.test.cjs` and the Python tests stay green.

---

## 7. Acceptance (behavioural, node:test unless noted)

1. Liveliness: a frozen swarmalator ball reads L < 0.1; the same model in the active phase-wave regime reads L > 0.5; a fresh physarum reads ≈ 1 and after 3 min at H 0.3 reads < 0.4.
2. Controller: with L pinned at 0.1, the entropy target rises within 5 s and an injection fires; rewind fires at 15 s; nothing fires again for 30 s; locked H bounds and the user's Depth are untouched.
3. Rewind: after 60 s a world's state is within tolerance of its best snapshot 2 s after rewind; the dissolve is monotonic; pure-rules Life reseeds instead and sets the note.
4. Music → structure: a 120 BPM groove produces exactly one physarum deposit burst per beat and food jumps only on accents; swarmalator phase kicks hit a third of agents per beat; events per beat are bounded.
5. Ship: speed stays within [0, 3× base]; angular rate ≤ 20°/s under a drag spike; hover sets speed 0; the dive engages only with energy trend > 0 for 8 s and C > 0.5, and releases within 2 s of the drop.
6. Wrap: a swarmalator or boid passing z > +6 re-enters at z = −30 with x, y (and phase) kept; no agent is ever outside [−30, 6] after a step.
7. Jump: a granted scene change sets a 4 s jump state; gates unchanged (existing director tests still pass).
8. Depth: 0 → fold 0, feedback 0.1, silk, 0.6×; 1 → fold 8, feedback 0.9, neon, 1.6×; the arc moves around the user's Depth, never replaces it.
9. Gestures (pure mapper): the table above maps to the listed actions; swipe → world change goes through the director's gate; two-finger tap → rewind.
10. Browser (manual, `__flow.advance`): HUD fades after 3 s; the drawer opens on long-press; the swarm cloud streams past with no visible pops at the wrap; the physarum tunnel reads as a tunnel at all speeds.

---

## 8. Decisions in this document (Bird can overturn)

- Once launched the ship always moves slowly, with dives on builds, rather than periodic flights. The app opens in **hover** and a tap launches (Bird's decision, 2026-10-20).
- Rewind dissolves to the *best recent* snapshot (highest L), not simply the oldest.
- Swarmalators default to the active phase-wave regime; rings are an arc choice.
- Depth is one dial bundling four axes; hue is no longer a user control (palette from the arc, warmth via voice/JEV).
- The ring replaces the slider; everything else lives in the drawer.
- Camera modes collapse to ship/hover; v1's orbit/inside/close remain reachable only through hover's orbit.
