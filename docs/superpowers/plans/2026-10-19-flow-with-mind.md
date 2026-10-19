# Flow with Mind Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give the Living Worlds prototype a director that can lead the viewer (anticipatory beat phase, preset arcs, forward flight, kaleidoscope) or follow them (reactive phase, gesture attraction, novelty on surprise), with one continuous lockable Initiative between the two, running offline from sound and steered online by JEV within bounds.

**Architecture:** Pure ES-module engine (`immersive/engine/*.mjs`) with no DOM or WebGL: audio features per stream, a music beat clock plus a coupled world clock, Agency → Initiative, arc playback with its own time, and a Director that blends targets and gates transitions. `immersive/app.mjs` owns the browser: a dual-stream audio graph, Three.js r180 rendering of the existing simulations, a post-process pass (fold + feedback), HUD and controls. `scripts/serve-worlds.py` asks JEV eight bounded questions and returns a validated decision; the client re-validates and drops stale answers.

**Tech Stack:** Vanilla ES modules, Three.js r180 (vendored, no CDN), Web Audio AnalyserNode, WebGL2 render targets with GLSL post shaders, `node:test` on Node 24 (no package.json), Python 3 stdlib server (`http.server`, `urllib.request`, `unittest`).

**Spec:** `docs/superpowers/specs/2026-10-19-flow-with-mind-design.md`

## Global Constraints

- Offline core first: no runtime CDN; all modules and vendored Three.js served from this repo and listed in `sw.js` (`CACHE='extra-worlds-v4'`).
- Engine modules under `immersive/engine/` import nothing from the DOM, Three.js or `window`; every one is exercised by `node --test`.
- Run the whole suite with `node --test tests/*.test.mjs tests/*.test.cjs` (a bare `tests/` path does not work on Node 24). Existing tests in `tests/emergence.test.mjs` and `tests/extra-dynamics.test.cjs` keep passing **unchanged**.
- Fixed-capacity typed arrays; no per-frame allocation in `step()`/`update()`; GPU resources disposed on scene change.
- Spec constants, verbatim: φ_max 0.12 cycle; κ 0.3; Agency attack 0.5 s; novelty refill 1/40 per s, cost 0.5, fire when surprise > 0.5 and N ≥ 0.5 and (1 − λ) > 0.3; phrase = 16 beats when C > 0.4 else 20 s; scene dwell 60 s; gate `I > 0.2 && A_s < 0.25`; flow channel `w = 0.15 + 0.25·C`; confidence floor 0.45; JEV min gap 15 s, cadence 24 s, max age 10 s; I₀ default +0.3, clamp ±0.6.
- Tuned so the spec's behavioural tests hold (spec §11 says constants are tuning targets): Agency release time constant **5 s** (the spec's "15 s" is the settling time), Initiative τ_yield **1 s** / τ_resume **3 s**, tempo window **4 s** with fast re-blend on a >15 % tempo change.
- English UI copy. Synthetic sound and Life's perturbation are labelled on screen as such. No emotion words in HUD or code names (use energy, coherence, agency).
- API key read server-side only, from `TYPESAFE_API_KEY` or the existing `.env` referenced by the current server; never sent to the client, never logged.
- Every commit message ends with the line `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>`. Commit on branch `flow-with-mind`; do not touch `main`.

## Review Focus

1. A quiet room for minutes (bins ≈ 10/255, constant): the adaptive normaliser must not amplify the noise floor into E ≈ 1 and make the world rage at silence. → Task 1 test `constant low bins never normalise loud`.
2. Analyser returns all zeros or `null` (track change, mic denied, context suspended): no NaN anywhere, C → 0, world free-runs. → Task 1 test `null frames decay to zero without NaN`; Task 2 test `free-runs when C is 0`.
3. A frame gap of several seconds (tab hidden, debugger): the arc and dwell timers must not leap. → Task 5 test `dt is clamped to 0.1 s`; Task 6 test `dt spike does not open the gate`.
4. JEV server down or rate-limited: the client must back off, not hammer. → Task 7 test `backoff doubles after 429/502`.
5. Browser autoplay policy keeps the AudioContext suspended until a gesture: the app must resume on first pointer/key and say so on the HUD. → Task 11 manual check `tap to start sound`.

---

### Task 1: Audio features per stream

**Files:**
- Create: `immersive/engine/features.mjs`
- Test: `tests/features.test.mjs`

**Interfaces:**
- Produces:
  ```js
  export const BANDS = { bass:[20,250], mid:[250,2000], high:[2000,12000], voice:[300,3000] };
  export class AudioFeatures {
    constructor({ sampleRate = 48000, fftSize = 2048, frameRate = 60 } = {})
    update(bins /* Uint8Array | null */, dt /* seconds */) → this
    // fields valid after update(): E, onset, B, speech, C, bpm, flux, bands:{bass,mid,high,high,voice}
    reset()
  }
  ```
  All fields finite numbers in [0,1] except `bpm` ∈ [60,180]. `onset` is 0 on frames without a detected onset.

Algorithm decisions the signature does not fix: loudness `L = 0.6·bass + 0.3·mid + 0.1·high` (band = mean bin/255 × 1.5, clamped, as the prototype does). Adaptive range: `floor` tracks the minimum with upward drift 0.02/s, `ceil` tracks the maximum with downward drift 0.05/s, span never below 0.15; `E = clamp((L − floor)/(ceil − floor))` smoothed with attack 80 ms / release 600 ms. Onset: spectral flux `Σ max(0, bins[i] − prev[i]) / (bins.length·255)`; threshold = mean + 1.5·std of flux over the last 1 s (ring buffer, fixed size); fire when flux > threshold and ≥ 100 ms since the last onset; `onset = min(1, (flux − thr)/thr)`. Tempo: ring buffer of flux at `frameRate` over **4 s**; every 0.5 s compute the autocorrelation for lags corresponding to 60–180 BPM in 1 BPM steps (interpolate fractional lags), multiply by a Gaussian prior centred 110 BPM, σ 40, floor 0.5; `C_raw = acf(lag*)/acf(0)`; blend `bpm` toward the estimate over 4 s, or over 1 s when the estimate differs by more than 15 %; blend `C` over 3 s; when the mean flux over the window is below 0.002, decay `C` toward 0 instead. Speech-likeness: voice-band energy `v` through two one-pole low-passes (8 Hz and 2 Hz), `mod = lp8 − lp2`; `speech = clamp(4 · rms_1s(mod) / (mean_1s(v) + 1e-3))`.

- [ ] **Step 1: Write the failing tests**

```js
import {test} from 'node:test'; import assert from 'node:assert/strict';
import {AudioFeatures, BANDS} from '../immersive/engine/features.mjs';
const SR=48000, N=1024, FPS=60;
function rng(seed){return()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296}}
function bins(fill, r){const b=new Uint8Array(N);for(let i=0;i<N;i++)b[i]=Math.min(255,Math.max(0,fill(i)+(r?Math.floor(r()*6):0)));return b}
const bassIdx=i=>i*SR/2048>=20&&i*SR/2048<250;
function clickTrain(f,bpm,seconds,seed=1){const r=rng(seed),period=Math.round(FPS*60/bpm);let onsets=0;for(let k=0;k<seconds*FPS;k++){const hit=k%period<2;f.update(bins(i=>hit&&bassIdx(i)?200:10,r),1/FPS);if(f.onset>0)onsets++}return onsets}
test('click train at 120 BPM: bpm within 3, C above .7, roughly one onset per click',()=>{const f=new AudioFeatures({sampleRate:SR,frameRate:FPS});clickTrain(f,120,6);const onsets=clickTrain(f,120,10);assert(Math.abs(f.bpm-120)<=3,`bpm ${f.bpm}`);assert(f.C>.7,`C ${f.C}`);assert(onsets>=17&&onsets<=22,`onsets ${onsets}`)});
test('tempo jump 76 to 108 re-locks within 4 s',()=>{const f=new AudioFeatures({sampleRate:SR,frameRate:FPS});clickTrain(f,76,10);clickTrain(f,108,4);assert(Math.abs(f.bpm-108)<=4,`bpm ${f.bpm}`)});
test('random bins: C below .3, everything finite',()=>{const f=new AudioFeatures({sampleRate:SR,frameRate:FPS});const r=rng(7);for(let k=0;k<10*FPS;k++)f.update(bins(()=>Math.floor(r()*255)),1/FPS);assert(f.C<.3,`C ${f.C}`);for(const v of [f.E,f.onset,f.B,f.speech,f.C,f.bpm,f.flux])assert(Number.isFinite(v))});
test('constant low bins never normalise loud',()=>{const f=new AudioFeatures({sampleRate:SR,frameRate:FPS});for(let k=0;k<20*FPS;k++)f.update(bins(()=>12),1/FPS);assert(f.E<.2,`E ${f.E}`)});
test('null frames decay to zero without NaN',()=>{const f=new AudioFeatures({sampleRate:SR,frameRate:FPS});clickTrain(f,120,4);for(let k=0;k<5*FPS;k++)f.update(null,1/FPS);assert.equal(f.E,0);assert.equal(f.onset,0);assert(f.C<.05);assert(Number.isFinite(f.bpm))});
test('4 Hz modulated voice band reads as speech, steady band does not',()=>{const voice=i=>{const hz=i*SR/2048;return hz>=300&&hz<3000};const a=new AudioFeatures({sampleRate:SR,frameRate:FPS}),b=new AudioFeatures({sampleRate:SR,frameRate:FPS});for(let k=0;k<6*FPS;k++){const t=k/FPS,m=.5+.5*Math.sin(2*Math.PI*4*t);a.update(bins(i=>voice(i)?40+160*m:10),1/FPS);b.update(bins(i=>voice(i)?120:10),1/FPS)}assert(a.speech>.5,`speech ${a.speech}`);assert(b.speech<.2,`speech ${b.speech}`)});
test('BANDS are the spec ranges',()=>{assert.deepEqual(BANDS,{bass:[20,250],mid:[250,2000],high:[2000,12000],voice:[300,3000]})});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `node --test tests/features.test.mjs`
Expected: FAIL, `Cannot find module '.../immersive/engine/features.mjs'`

- [ ] **Step 3: Implement `AudioFeatures` in `immersive/engine/features.mjs`**

Ring buffers are `Float32Array` allocated in the constructor; `update(null, dt)` runs the same smoothing with zero input.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `node --test tests/features.test.mjs`
Expected: PASS, 7 tests. Tune the Gaussian prior floor and the fast re-blend threshold if the tempo tests miss; do not loosen the assertions.

- [ ] **Step 5: Commit**

```bash
git add immersive/engine/features.mjs tests/features.test.mjs
git commit -m "feat(engine): per-stream audio features with adaptive loudness, onsets, tempo, coherence, speech-likeness"
```

---

### Task 2: Beat clock, world clock, beat predictor

**Files:**
- Create: `immersive/engine/beat-clock.mjs`
- Test: `tests/beat-clock.test.mjs`

**Interfaces:**
- Produces:
  ```js
  export class BeatClock {
    constructor({ latency = 0, kappa = 0.3 } = {})
    phase        // audible-compensated music phase, cycles in [0,1)
    bpm          // current tempo
    beatIndex    // integer, +1 each wrap of the compensated phase
    wrapped      // true only on the frame the phase wrapped
    setLatency(seconds)
    update(dt, { onset = 0, bpm = this.bpm, C = 0 }) → this
    distanceToBeat() → cycles in [0, 0.5]
  }
  export class WorldClock {
    constructor({ Kmax = 6, phiMax = 0.12, gamma = 3 } = {})
    phase        // cycles in [0,1)
    omega        // natural frequency, Hz
    update(dt, { musicPhase, C, I, omega = this.omega }) → this
    pulse() → number in [0,1]
  }
  export class BeatPredictor {
    constructor(bins = 8)
    observe(phase, E)      // EMA per phase bin, α = 0.3
    predict(phase) → number | null   // null until that bin has been observed
  }
  ```

Decisions: internal phase advances `dt·bpm/60`; on an onset with strength `s`, internal phase += `kappa·s·sin(−2π·internal)/(2π)`; `bpm` follows the supplied estimate directly (features already smooth it). Reported `phase = frac(internal + latency·bpm/60)`. WorldClock: `dθ/dt = omega + Kmax·C·sin(2π(musicPhase + I·phiMax − θ))/(2π)`; `pulse = max(0, cos 2πθ)^gamma`.

- [ ] **Step 1: Write the failing tests**

```js
import {test} from 'node:test'; import assert from 'node:assert/strict';
import {BeatClock, WorldClock, BeatPredictor} from '../immersive/engine/beat-clock.mjs';
const FPS=60, dt=1/FPS, wrap=x=>((x%1)+1)%1, circ=(a,b)=>{const d=wrap(a-b);return d>.5?d-1:d};
function drive(clock,bpm,seconds,{C=.9,offset=0,extra}={}){const period=Math.round(FPS*60/bpm);for(let k=0;k<seconds*FPS;k++){clock.update(dt,{onset:(k+offset)%period===0?1:0,bpm,C});extra?.(k)}}
test('locks to a 120 BPM click train within 4 s with phase error under 10 %',()=>{const c=new BeatClock();drive(c,120,4,{offset:11});let worst=0;drive(c,120,4,{offset:11,extra:k=>{if((k+11)%30===0)worst=Math.max(worst,c.distanceToBeat())}});assert(worst<.1,`worst ${worst}`)});
test('latency advances the reported phase by exactly latency·bpm/60',()=>{const a=new BeatClock(),b=new BeatClock({latency:.04});drive(a,120,3);drive(b,120,3);assert(Math.abs(circ(b.phase,a.phase)-.08)<1e-6)});
test('beatIndex counts wraps and wrapped is a one-frame flag',()=>{const c=new BeatClock();let flags=0;drive(c,120,10,{extra:()=>{if(c.wrapped)flags++}});assert.equal(c.beatIndex,flags);assert(c.beatIndex>=19&&c.beatIndex<=21,`beats ${c.beatIndex}`)});
test('world clock leads by +phiMax when I=+1 and lags by −phiMax when I=−1',()=>{for(const I of [1,-1]){const w=new WorldClock();let m=0;for(let k=0;k<20*FPS;k++){m=wrap(m+dt*2);w.update(dt,{musicPhase:m,C:1,I,omega:2})}const off=circ(w.phase,m);assert(Math.abs(off-I*.12)<.024,`I ${I} offset ${off}`)}});
test('free-runs at omega when C is 0',()=>{const w=new WorldClock();w.omega=.5;for(let k=0;k<2*FPS;k++)w.update(dt,{musicPhase:Math.random(),C:0,I:1});assert(Math.abs(circ(w.phase,0))<2e-3)});
test('pulse is 1 on the beat and 0 half a cycle away',()=>{const w=new WorldClock();w.phase=0;assert(Math.abs(w.pulse()-1)<1e-9);w.phase=.5;assert.equal(w.pulse(),0)});
test('predictor remembers energy per phase bin',()=>{const p=new BeatPredictor(8);assert.equal(p.predict(.1),null);for(let i=0;i<20;i++){p.observe(.01,1);p.observe(.51,.2)}assert(p.predict(.02)>.9);assert(Math.abs(p.predict(.5)-.2)<.05)});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `node --test tests/beat-clock.test.mjs`
Expected: FAIL, module not found.

- [ ] **Step 3: Implement `BeatClock`, `WorldClock`, `BeatPredictor` in `immersive/engine/beat-clock.mjs`**

- [ ] **Step 4: Run the tests to verify they pass**

Run: `node --test tests/beat-clock.test.mjs`
Expected: PASS, 7 tests.

- [ ] **Step 5: Commit**

```bash
git add immersive/engine/beat-clock.mjs tests/beat-clock.test.mjs
git commit -m "feat(engine): music beat clock with latency compensation, coupled world clock, beat predictor"
```

---

### Task 3: Agency

**Files:**
- Create: `immersive/engine/agency.mjs`
- Test: `tests/agency.test.mjs`

**Interfaces:**
- Produces:
  ```js
  export class Agency {
    constructor({ attack = 0.5, release = 5, beatGate = 0.15,
                  weights = { onset: 0.6, speech: 0.7, gesture: 0.5, energy: 0.4 } } = {})
    A      // raw this frame, [0,1]
    As     // smoothed, [0,1]
    gesture(n = 1)                     // register n gesture events
    update(dt, { roomOnset = 0, speech = 0, beatDistance = 0.5, C = 0, actualE = 0, predictedE = null }) → this
  }
  ```

Decisions: `onsetTerm = (C > 0.4 && beatDistance < beatGate) ? 0 : roomOnset`; `energyTerm = predictedE == null ? 0 : max(0, |actualE − predictedE| − 0.25)/0.75`; gesture rate is a leaky integrator with 1 s time constant, `gestureTerm = min(1, g/3)`; `A = clamp(Σ weight·term)`; `As` rises with `attack`, falls with `release`.

- [ ] **Step 1: Write the failing tests**

```js
import {test} from 'node:test'; import assert from 'node:assert/strict';
import {Agency} from '../immersive/engine/agency.mjs';
const dt=1/60;
test('an onset on the predicted beat is not agency; the same onset off-beat is',()=>{const on=new Agency().update(dt,{roomOnset:1,beatDistance:.05,C:.8}),off=new Agency().update(dt,{roomOnset:1,beatDistance:.5,C:.8});assert.equal(on.A,0);assert(off.A>.3)});
test('with no beat (C low) every onset counts',()=>{const a=new Agency().update(dt,{roomOnset:1,beatDistance:.05,C:.1});assert(a.A>.3)});
test('speech raises agency regardless of beat',()=>{assert(new Agency().update(dt,{speech:.9,beatDistance:.0,C:.9}).A>.5)});
test('energy surprise counts only beyond the 0.25 dead band',()=>{const a=new Agency().update(dt,{actualE:.9,predictedE:.7}),b=new Agency().update(dt,{actualE:.9,predictedE:.1});assert.equal(a.A,0);assert(b.A>.2)});
test('gestures integrate and leak',()=>{const a=new Agency();a.gesture(3);a.update(dt,{});assert(a.A>.4);for(let i=0;i<5*60;i++)a.update(dt,{});assert(a.A<.05)});
test('As attacks within 2 s and releases to under 2 % within 20 s',()=>{const a=new Agency();for(let i=0;i<2*60;i++)a.update(dt,{speech:1,roomOnset:1});assert(a.As>.9,`As ${a.As}`);for(let i=0;i<20*60;i++)a.update(dt,{});assert(a.As<.02,`As ${a.As}`)});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `node --test tests/agency.test.mjs` — Expected: FAIL, module not found.

- [ ] **Step 3: Implement `Agency` in `immersive/engine/agency.mjs`**

- [ ] **Step 4: Run the tests to verify they pass**

Run: `node --test tests/agency.test.mjs` — Expected: PASS, 6 tests.

- [ ] **Step 5: Commit**

```bash
git add immersive/engine/agency.mjs tests/agency.test.mjs
git commit -m "feat(engine): agency from off-beat onsets, speech-likeness, surprise and gestures"
```

---

### Task 4: Initiative

**Files:**
- Create: `immersive/engine/initiative.mjs`
- Test: `tests/initiative.test.mjs`

**Interfaces:**
- Consumes: `Agency` (Task 3) in the combined test only.
- Produces:
  ```js
  export class Initiative {
    constructor({ I0 = 0.3, tauYield = 1, tauResume = 3 } = {})
    I, I0, locked        // I in [-1,1]; I0 clamped to [-0.6, 0.6]
    lock(value)          // Auto off; I = clamp(value, -1, 1)
    unlock()
    setBaseline(v)       // clamp ±0.6; ignored while locked? No: stored, applied when unlocked
    update(dt, As) → this
    get lambda()         // (I + 1)/2
  }
  ```

Decision: `Iauto = clamp(I0 − (1 + I0)·As, −1, 1)`; when unlocked `I` relaxes toward `Iauto` with `tauYield` if `Iauto < I` else `tauResume`.

- [ ] **Step 1: Write the failing tests**

```js
import {test} from 'node:test'; import assert from 'node:assert/strict';
import {Initiative} from '../immersive/engine/initiative.mjs';
import {Agency} from '../immersive/engine/agency.mjs';
const dt=1/60;
test('yields below −0.5 within 2 s of full agency',()=>{const s=new Initiative();for(let i=0;i<2*60;i++)s.update(dt,1);assert(s.I<-.5,`I ${s.I}`)});
test('resumes to within 10 % of I0 between 15 and 25 s after agency stops, and never exceeds I0',()=>{const s=new Initiative(),a=new Agency();for(let i=0;i<3*60;i++){a.update(dt,{speech:1});s.update(dt,a.As)}let at=null;for(let i=0;i<30*60;i++){a.update(dt,{});s.update(dt,a.As);assert(s.I<=s.I0+1e-9);if(at===null&&Math.abs(s.I-s.I0)<=.03)at=i/60}assert(at!==null&&at>=15&&at<=25,`settled at ${at}`)});
test('locked value is untouched by agency for 10 minutes',()=>{const s=new Initiative();s.lock(.73);for(let i=0;i<600*60;i++)s.update(dt,(i%7)/6);assert.equal(s.I,.73);assert.equal(s.locked,true)});
test('baseline and lock values are clamped',()=>{const s=new Initiative();s.setBaseline(2);assert.equal(s.I0,.6);s.lock(-9);assert.equal(s.I,-1);s.unlock();assert.equal(s.locked,false)});
test('lambda maps I to [0,1]',()=>{const s=new Initiative();s.lock(-1);assert.equal(s.lambda,0);s.lock(1);assert.equal(s.lambda,1)});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `node --test tests/initiative.test.mjs` — Expected: FAIL, module not found.

- [ ] **Step 3: Implement `Initiative` in `immersive/engine/initiative.mjs`**

- [ ] **Step 4: Run the tests to verify they pass**

Run: `node --test tests/initiative.test.mjs` — Expected: PASS, 5 tests. If the settle test misses the 15–25 s window, adjust `tauResume` or the Agency release (Task 3) together; both numbers are tuning targets.

- [ ] **Step 5: Commit**

```bash
git add immersive/engine/initiative.mjs tests/initiative.test.mjs
git commit -m "feat(engine): initiative with fast yield, slow resume and hard lock"
```

---

### Task 5: Arcs and arc player

**Files:**
- Create: `immersive/engine/arcs.mjs`
- Test: `tests/arcs.test.mjs`

**Interfaces:**
- Produces:
  ```js
  export const SCENES   = ['physarum','swarm','boids','life'];
  export const PALETTES = ['ink','silk','ember','neon'];
  export const CAMERAS  = ['orbit','inside','close','flight'];
  export const FOLDS    = [0,2,4,6,8];
  export const ARC_ORDER = ['tidal','firefly','mycelium'];
  export const ARCS = { tidal: Arc, firefly: Arc, mycelium: Arc };
  // Arc = { name, duration /* 270–300 s */, waypoints: Waypoint[] }
  // Waypoint = { t, scene?, I0?, H, T, D, S, F, palette, camera, omega, weight:{H,T,D,S,F,P,Cam} }
  export class ArcPlayer {
    constructor(arcs = ARCS, order = ARC_ORDER)
    time, arcName, index /* current waypoint index */, pinned, rate /* 1 */
    select(name, { pin = false } = {})
    pin(bool)
    holdUntilNextWaypoint(p)          // rate = 1 − p until index changes
    override(partial)                 // {H?,T?,D?,S?,palette?,camera?,I0?,weight?} until index changes
    update(dt, { running = true, currentScene }) → this   // dt clamped to 0.1; running=false pauses
    current() → { scene, I0, H, T, D, S, F, palette, camera, omega, weight, index, arcName, progress }
    sceneRequest    // scene of the latest passed waypoint when ≠ currentScene, else null
  }
  ```

Decisions: continuous axes (H, T, D, F, omega) interpolate linearly between waypoints; discrete ones (scene, S, palette, camera, I0, weight) take the value of the latest passed waypoint. Past `duration`, advance to the next arc in `order` (wrap) unless pinned, in which case restart the same arc. Waypoint values are the builder's, within the spec's shapes:
- tidal: scenes physarum → swarm; H low → mid; S 0 → 6; palette silk → ink; camera orbit → inside.
- firefly: swarm → boids → swarm; H mid; S 4 → 8; neon; inside → flight.
- mycelium: boids → physarum → life → boids; H mid → high → low; S 8 → 0; ember → neon → ink; flight.
Six or seven waypoints each, `waypoints[0].t === 0`, roughly 45 s apart.

- [ ] **Step 1: Write the failing tests**

```js
import {test} from 'node:test'; import assert from 'node:assert/strict';
import {ARCS, ARC_ORDER, SCENES, PALETTES, CAMERAS, FOLDS, ArcPlayer} from '../immersive/engine/arcs.mjs';
const sceneSeq=a=>a.waypoints.filter(w=>w.scene).map(w=>w.scene).filter((s,i,arr)=>i===0||s!==arr[i-1]);
test('three presets with the spec shapes',()=>{assert.deepEqual(ARC_ORDER,['tidal','firefly','mycelium']);for(const name of ARC_ORDER){const a=ARCS[name];assert(a.duration>=270&&a.duration<=300,name);assert(a.waypoints.length>=6&&a.waypoints.length<=7,name);assert.equal(a.waypoints[0].t,0);for(const w of a.waypoints){for(const k of ['H','T','D','F'])assert(w[k]>=0&&w[k]<=1,`${name} ${k}`);assert(FOLDS.includes(w.S));assert(PALETTES.includes(w.palette));assert(CAMERAS.includes(w.camera));if(w.scene)assert(SCENES.includes(w.scene));if(w.I0!==undefined)assert(Math.abs(w.I0)<=.6);for(const k of ['H','T','D','S','F','P','Cam'])assert(w.weight[k]>=0&&w.weight[k]<=1)}}assert.deepEqual(sceneSeq(ARCS.tidal),['physarum','swarm']);assert.deepEqual(sceneSeq(ARCS.firefly),['swarm','boids','swarm']);assert.deepEqual(sceneSeq(ARCS.mycelium),['boids','physarum','life','boids'])});
test('continuous axes interpolate, discrete axes step',()=>{const p=new ArcPlayer({x:{name:'x',duration:280,waypoints:[{t:0,scene:'swarm',H:0,T:.5,D:.5,S:0,F:0,palette:'ink',camera:'orbit',omega:.5,weight:{H:1,T:1,D:1,S:1,F:1,P:1,Cam:1}},{t:100,scene:'boids',H:1,T:.5,D:.5,S:8,F:0,palette:'neon',camera:'flight',omega:.5,weight:{H:1,T:1,D:1,S:1,F:1,P:1,Cam:1}}]}},['x']);for(let i=0;i<50*10;i++)p.update(.1,{currentScene:'swarm'});const c=p.current();assert(Math.abs(c.H-.5)<.02);assert.equal(c.S,0);assert.equal(c.palette,'ink');assert.equal(p.sceneRequest,null);for(let i=0;i<51*10;i++)p.update(.1,{currentScene:'swarm'});assert.equal(p.current().S,8);assert.equal(p.sceneRequest,'boids');p.update(.1,{currentScene:'boids'});assert.equal(p.sceneRequest,null)});
test('pauses while not running and dt is clamped to 0.1 s',()=>{const p=new ArcPlayer();p.update(5,{running:true,currentScene:'physarum'});assert(Math.abs(p.time-.1)<1e-9);p.update(1,{running:false,currentScene:'physarum'});assert(Math.abs(p.time-.1)<1e-9)});
test('hold scales rate until the next waypoint; override lasts until the next waypoint',()=>{const p=new ArcPlayer();p.holdUntilNextWaypoint(.7);p.update(.1,{currentScene:'physarum'});assert(Math.abs(p.time-.03)<1e-9);p.override({H:.9});assert.equal(p.current().H,.9);const idx=p.index;while(p.index===idx)p.update(.1,{currentScene:'physarum'});assert.equal(p.rate,1);assert.notEqual(p.current().H,.9)});
test('chains arcs in order and loops when pinned',()=>{const p=new ArcPlayer();for(let i=0;i<ARCS.tidal.duration*10+5;i++)p.update(.1,{currentScene:'physarum'});assert.equal(p.arcName,'firefly');const q=new ArcPlayer();q.select('mycelium',{pin:true});for(let i=0;i<ARCS.mycelium.duration*10+5;i++)q.update(.1,{currentScene:'boids'});assert.equal(q.arcName,'mycelium');assert(q.time<1)});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `node --test tests/arcs.test.mjs` — Expected: FAIL, module not found.

- [ ] **Step 3: Implement `arcs.mjs`: constants, the three presets, `ArcPlayer`**

- [ ] **Step 4: Run the tests to verify they pass**

Run: `node --test tests/arcs.test.mjs` — Expected: PASS, 5 tests.

- [ ] **Step 5: Commit**

```bash
git add immersive/engine/arcs.mjs tests/arcs.test.mjs
git commit -m "feat(engine): three preset arcs and an arc player with its own clock"
```

---

### Task 6: Director

**Files:**
- Create: `immersive/engine/director.mjs`
- Test: `tests/director.test.mjs`

**Interfaces:**
- Consumes: `BeatClock`, `WorldClock`, `BeatPredictor` (Task 2); `Agency` (Task 3); `Initiative` (Task 4); `ArcPlayer`, `SCENES`, `FOLDS` (Task 5); feature fields from Task 1 are passed in as plain numbers.
- Produces:
  ```js
  export class Director {
    constructor({ initiative = new Initiative(), arcs = new ArcPlayer(), beat = new BeatClock(),
                  world = new WorldClock(), agency = new Agency(), predictor = new BeatPredictor(),
                  scene = 'physarum', dwell = 60, noveltyRefill = 1/40 } = {})
    scene                        // authoritative current scene name
    update(dt, input) → Output
    acknowledgeScene(name)       // app calls after ANY scene change (manual or granted): sets scene, resets sceneAge, clears a matching request
    applyDecision(decision)      // validated JEV decision (Task 7 shape); may set I0, overrides, hold, scene request
    // Input = {
    //   music: { E, onset, B, C, bpm, latency } | null,
    //   room:  { onset, speech } | null,
    //   gestures: number,
    //   user:  { H, T, D, S, F, hue, camera, sceneLocked },
    //   online: boolean }
    // Output = {
    //   I, lambda, As, phase, worldPhase, pulse, phraseBoundary, surprise,
    //   targets: { H, T, D, S, F, palette, hue, camera, omega },
    //   hTarget, hWidth,                 // flow channel centre and half-width (H already clamped)
    //   sceneChange: string | null,     // set on the frame a change is granted
    //   injection: boolean,
    //   hud: { leading: 'LEADING'|'FOLLOWING'|'MUTUAL', bpm, C, E, source: 'you'|'arc'|'jev'|'music' per axis } }
  }
  ```

Decisions: `dt` clamped to 0.1 s. Order per frame: beat clock ← music; surprise = `|E − predict(phase)|`, falling back to `|E − E_avg2s|` (2 s exponential average) while the predictor has nothing for that bin, plus 1 when `onset > 0.5` and `distanceToBeat() > 0.3` while `C > 0.4`; then predictor observe; agency ← room + gestures + surprise terms; initiative ← As; arcs.update with `running = I ≥ 0`; world clock ← I; follow targets per spec §4.5 (`H_follow = 0.35 + 0.5(1−C)`, `T_follow = 0.6 + 0.9E`, `D_follow = 0.3 + 0.7E`, S/F from user, hue from B: `hue = user.hue + (0.5 − B)·60` degrees, camera = user.camera); lead targets from `arcs.current()`; per axis `target = (1 − λ·w)·follow + λ·w·lead` where `w` is that axis's arc weight; flow channel: `hWidth = 0.15 + 0.25C`, clamp H to `[hTarget − hWidth, hTarget + hWidth]` where `hTarget` is the blended value (so H is the clamp of the *user-modulated* value `hTarget + (user.H − 0.5)·0.3`). Phrase boundary: `beat.wrapped && beat.beatIndex % 16 === 0` when `C > 0.4`, else every 20 s of clamped time. Scene gate: `sceneRequest` standing (arc or JEV), `I > 0.2`, `As < 0.25`, `!user.sceneLocked`, `phraseBoundary`, `sceneAge ≥ dwell`; on grant set `sceneChange`, reset `sceneAge`. Novelty: `N` refills at `noveltyRefill·dt` to 1; inject when `surprise > 0.5 && N ≥ 0.5 && (1 − λ) > 0.3`, cost 0.5. HUD `leading` = `I > 0.2 ? 'LEADING' : I < −0.2 ? 'FOLLOWING' : 'MUTUAL'`.

- [ ] **Step 1: Write the failing tests**

```js
import {test} from 'node:test'; import assert from 'node:assert/strict';
import {Director} from '../immersive/engine/director.mjs';
import {Initiative} from '../immersive/engine/initiative.mjs';
import {ArcPlayer} from '../immersive/engine/arcs.mjs';
const dt=1/60, user=(o={})=>({H:.5,T:.5,D:.5,S:0,F:.3,hue:0,camera:'orbit',sceneLocked:false,...o});
const groove=(k,bpm=120)=>({E:.6,onset:k%Math.round(3600/bpm)===0?1:0,B:.5,C:.8,bpm,latency:0});
const twoWaypoints=(scene2)=>new ArcPlayer({x:{name:'x',duration:280,waypoints:[{t:0,scene:'swarm',H:.2,T:.5,D:.5,S:0,F:.2,palette:'ink',camera:'orbit',omega:.5,weight:{H:1,T:1,D:1,S:1,F:1,P:1,Cam:1}},{t:30,scene:scene2,H:.8,T:.5,D:.5,S:4,F:.2,palette:'neon',camera:'orbit',omega:.5,weight:{H:1,T:1,D:1,S:1,F:1,P:1,Cam:1}}]}},['x']);
function run(d,seconds,input,onFrame){const out=[];for(let k=0;k<seconds*60;k++){const o=d.update(dt,typeof input==='function'?input(k):input);onFrame?.(o,k);out.push(o)}return out}
test('scene change waits for dwell, then lands on a phrase boundary with the gate open',()=>{const d=new Director({arcs:twoWaypoints('boids'),scene:'swarm'});let granted=[];run(d,120,k=>({music:groove(k),room:null,gestures:0,user:user(),online:false}),(o,k)=>{if(o.sceneChange){granted.push([k/60,o.phraseBoundary]);d.acknowledgeScene('boids')}});assert.equal(granted.length,1);assert(granted[0][0]>=60,`t ${granted[0][0]}`);assert.equal(granted[0][1],true)});
test('agency, scene lock and a follow lock each keep the gate closed',()=>{for(const variant of ['agency','lock','follow']){const init=new Initiative();if(variant==='follow')init.lock(-1);const d=new Director({arcs:twoWaypoints('boids'),initiative:init,scene:'swarm'});let changes=0;run(d,150,k=>({music:groove(k),room:variant==='agency'?{onset:0,speech:1}:null,gestures:0,user:user({sceneLocked:variant==='lock'}),online:false}),o=>{if(o.sceneChange)changes++});assert.equal(changes,0,variant)}});
test('a blocked scene request does not stall the other axes',()=>{const d=new Director({arcs:twoWaypoints('boids'),scene:'swarm'});const out=run(d,40,k=>({music:groove(k),room:null,gestures:0,user:user({sceneLocked:true}),online:false}));assert(out.at(-1).targets.H>out[60].targets.H+.2)});
test('novelty budget caps injections at three per minute',()=>{const init=new Initiative();init.lock(-1);const d=new Director({initiative:init});let n=0;run(d,60,k=>({music:{E:k%30===0?1:0,onset:k%30===0?1:0,B:.5,C:.2,bpm:120,latency:0},room:null,gestures:0,user:user(),online:false}),o=>{if(o.injection)n++});assert(n>=1&&n<=3,`injections ${n}`)});
test('H never leaves the flow channel',()=>{const d=new Director();let seed=3;const r=()=>(seed=(seed*1664525+1013904223)>>>0)/4294967296;run(d,300,()=>({music:{E:r(),onset:r()>.9?1:0,B:r(),C:r(),bpm:100,latency:0},room:null,gestures:0,user:user({H:r()}),online:false}),o=>{assert(o.targets.H>=o.hTarget-o.hWidth-1e-9&&o.targets.H<=o.hTarget+o.hWidth+1e-9);assert(o.hWidth>=.15&&o.hWidth<=.4)})});
test('phrase boundaries: every 16 beats in a groove, every 20 s without one',()=>{const d=new Director();const beats=[];run(d,40,k=>({music:groove(k),room:null,gestures:0,user:user(),online:false}),(o,k)=>{if(o.phraseBoundary)beats.push(k)});assert(beats.length>=4&&beats.length<=5,`groove ${beats.length}`);for(let i=1;i<beats.length;i++)assert(Math.abs(beats[i]-beats[i-1]-480)<=2);const e=new Director();const walls=[];run(e,61,()=>({music:{E:0,onset:0,B:0,C:0,bpm:120,latency:0},room:null,gestures:0,user:user(),online:false}),(o,k)=>{if(o.phraseBoundary)walls.push(k/60)});assert.equal(walls.length,3);assert(Math.abs(walls[1]-walls[0]-20)<.05)});
test('dt spike does not open the gate early',()=>{const d=new Director({arcs:twoWaypoints('boids')});let changes=0;for(let i=0;i<20;i++){const o=d.update(5,{music:groove(0),room:null,gestures:0,user:user(),online:false});if(o.sceneChange)changes++}assert.equal(changes,0)});
test('a low-confidence JEV entropy leaves the preset value; a confident one overrides it; hold slows the arc',()=>{const init=new Initiative();init.lock(1);const a=new Director({arcs:twoWaypoints('boids'),initiative:init,scene:'swarm'}),b=new Director({arcs:twoWaypoints('boids'),initiative:new Initiative(),scene:'swarm'});b.initiative.lock(1);a.applyDecision({version:1,confidence:{entropy:.3},entropy:.95});b.applyDecision({version:1,confidence:{entropy:.9},entropy:.95});const oa=a.update(dt,{music:groove(0),room:null,gestures:0,user:user(),online:true}),ob=b.update(dt,{music:groove(0),room:null,gestures:0,user:user(),online:true});assert(Math.abs(oa.hTarget-.2)<.05,`a ${oa.hTarget}`);assert(Math.abs(ob.hTarget-.95)<.05,`b ${ob.hTarget}`);const c=new Director();c.applyDecision({version:1,confidence:{},hold:.7});c.update(.1,{music:groove(0),room:null,gestures:0,user:user(),online:true});assert(Math.abs(c.arcs.time-.03)<1e-6)});
test('hud names who is leading',()=>{const lead=new Initiative();lead.lock(.9);const follow=new Initiative();follow.lock(-.9);assert.equal(new Director({initiative:lead}).update(dt,{music:null,room:null,gestures:0,user:user(),online:false}).hud.leading,'LEADING');assert.equal(new Director({initiative:follow}).update(dt,{music:null,room:null,gestures:0,user:user(),online:false}).hud.leading,'FOLLOWING')});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `node --test tests/director.test.mjs` — Expected: FAIL, module not found.

- [ ] **Step 3: Implement `Director` in `immersive/engine/director.mjs`**

Expose the composed parts as public fields (`initiative`, `arcs`, `beat`, `world`, `agency`, `predictor`) so the app and tests can read them.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `node --test tests/director.test.mjs` — Expected: PASS, 9 tests.

- [ ] **Step 5: Run the whole suite**

Run: `node --test tests/*.test.mjs tests/*.test.cjs` — Expected: all pass, including the 11 pre-existing tests.

- [ ] **Step 6: Commit**

```bash
git add immersive/engine/director.mjs tests/director.test.mjs
git commit -m "feat(engine): director blending follow and lead targets with gates, flow channel and novelty budget"
```

---

### Task 7: JEV client

**Files:**
- Create: `immersive/engine/jev-client.mjs`
- Test: `tests/jev-client.test.mjs`

**Interfaces:**
- Produces:
  ```js
  export const REQUEST_ACTIONS = ['none','slower','faster','warmer','cooler','surround','calm_down','hold_scene','change_scene','more_symmetry','less_symmetry'];
  export function buildState(parts) → object
  //   parts = { scene, sceneAge, arc:{name, waypoint}, features:{E_mean30,E_trend,C_mean30,B_mean30,A_mean30,bpm},
  //             initiative:{I, locked, I0}, locks:{scene}, userText, recentDecisions, online }
  //   numbers rounded to 2 dp, userText sliced to 180 chars, recentDecisions sliced to 3, no other keys
  export function validateDecision(raw, { sentVersion, sentAt, now, maxAge = 10, floor = 0.45 }) → Decision | null
  //   Decision = { version, hold?, scene?:{choice,p}, energy?, entropy?, symmetry?, palette?, initiative?:'follow'|'mutual'|'lead', request?, confidence:{...} }
  //   null when version ≠ sentVersion, now − sentAt > maxAge, or any present field is malformed/out of vocabulary;
  //   a field whose confidence < floor is removed (not fatal). hold is kept without confidence.
  export class JevClient {
    constructor({ fetchFn = globalThis.fetch, now = () => performance.now()/1000, minGap = 15, maxAge = 10, url = '/api/decide' } = {})
    enabled, version, inFlight, backoff /* seconds, 0 when healthy */
    bump()                           // any manual action: version++
    async maybeRequest(stateFn, { force = false } = {}) → Decision | null
    //   returns null without fetching when disabled, inFlight, within minGap (unless force), or within backoff
    //   POST { version, state: stateFn() }; 429/5xx → backoff = max(15, backoff·2) capped 240; ok → backoff 0
  }
  ```

- [ ] **Step 1: Write the failing tests**

```js
import {test} from 'node:test'; import assert from 'node:assert/strict';
import {buildState, validateDecision, JevClient, REQUEST_ACTIONS} from '../immersive/engine/jev-client.mjs';
const good=()=>({version:4,hold:.7,scene:{choice:'boids',p:.62},energy:.75,entropy:.5,symmetry:6,palette:'ember',initiative:'lead',request:'slower',confidence:{scene:.62,energy:.8,entropy:.3,symmetry:.9,palette:.7,initiative:.5,request:.9}});
const ctx={sentVersion:4,sentAt:100,now:103};
test('valid decision passes and low-confidence fields are dropped',()=>{const d=validateDecision(good(),ctx);assert.equal(d.hold,.7);assert.equal(d.scene.choice,'boids');assert.equal(d.entropy,undefined);assert.equal(d.energy,.75);assert.equal(d.symmetry,6)});
test('stale version or old age is dropped entirely',()=>{assert.equal(validateDecision(good(),{...ctx,sentVersion:3}),null);assert.equal(validateDecision(good(),{...ctx,now:111}),null)});
test('out-of-vocabulary values are fatal',()=>{for(const bad of [{palette:'puce'},{symmetry:5},{energy:1.2},{scene:{choice:'lenia',p:.9}},{initiative:'maybe'},{request:'explode'},{hold:2}])assert.equal(validateDecision({...good(),...bad},ctx),null,JSON.stringify(bad))});
test('buildState bounds text, history and keys',()=>{const s=buildState({scene:'swarm',sceneAge:12.345,arc:{name:'tidal',waypoint:2},features:{E_mean30:.5,E_trend:.1,C_mean30:.7,B_mean30:.4,A_mean30:.2,bpm:108.6},initiative:{I:.3,locked:false,I0:.3},locks:{scene:false},userText:'x'.repeat(500),recentDecisions:[1,2,3,4,5],online:true,secret:'no'});assert.equal(s.userText.length,180);assert.equal(s.recentDecisions.length,3);assert.equal(s.sceneAge,12.35);assert.equal('secret' in s,false);assert.deepEqual(Object.keys(s).sort(),['arc','features','initiative','locks','online','recentDecisions','scene','sceneAge','userText'])});
test('client respects minGap, inFlight, disabled, and backs off on 429/502',async()=>{let t=0,calls=0,status=200;const fetchFn=async()=>{calls++;return {ok:status<400,status,json:async()=>({...good(),version:c.version})}};const c=new JevClient({fetchFn,now:()=>t});assert.equal(await c.maybeRequest(()=>({})),null);c.enabled=true;assert.notEqual(await c.maybeRequest(()=>({})),null);assert.equal(await c.maybeRequest(()=>({})),null);t=16;status=429;assert.equal(await c.maybeRequest(()=>({})),null);assert.equal(c.backoff,15);t=32;assert.equal(await c.maybeRequest(()=>({})),null);assert.equal(c.backoff,30);t=100;status=502;await c.maybeRequest(()=>({}));assert.equal(c.backoff,60);t=200;status=200;assert.notEqual(await c.maybeRequest(()=>({})),null);assert.equal(c.backoff,0);assert.equal(calls,5)});
test('a bumped version invalidates an in-flight answer',async()=>{let resolve;const fetchFn=()=>new Promise(r=>resolve=r);const c=new JevClient({fetchFn,now:()=>0});c.enabled=true;const p=c.maybeRequest(()=>({}));c.bump();resolve({ok:true,status:200,json:async()=>({...good(),version:1})});assert.equal(await p,null)});
test('request vocabulary is the spec list',()=>{assert.equal(REQUEST_ACTIONS.length,11);assert(REQUEST_ACTIONS.includes('surround'))});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `node --test tests/jev-client.test.mjs` — Expected: FAIL, module not found.

- [ ] **Step 3: Implement `jev-client.mjs`**

- [ ] **Step 4: Run the tests to verify they pass**

Run: `node --test tests/jev-client.test.mjs` — Expected: PASS, 7 tests.

- [ ] **Step 5: Commit**

```bash
git add immersive/engine/jev-client.mjs tests/jev-client.test.mjs
git commit -m "feat(engine): JEV client with bounded state, schema validation, staleness and backoff"
```

---

### Task 8: Feedback math and palettes

**Files:**
- Create: `immersive/engine/feedback-math.mjs`, `immersive/engine/palettes.mjs`
- Test: `tests/post-math.test.mjs`

**Interfaces:**
- Produces:
  ```js
  // feedback-math.mjs — mirrored verbatim in the GLSL of Task 12
  export const MAX_DECAY = 0.96;
  export function mixFeedback(prev, cur, decay) → 1 − Math.exp(−(cur + prev · Math.min(decay, MAX_DECAY)))
  // palettes.mjs
  export const PALETTE_MODES = ['ink','silk','ember','neon'];
  export const PALETTES = { ink:{sat:0.08, light:[0.05,0.95], spread:0.02, center:null},
                            silk:{sat:0.45, light:[0.35,0.85], spread:0.12, center:null},
                            ember:{sat:0.85, light:[0.20,0.70], spread:0.08, center:0.06},
                            neon:{sat:1.00, light:[0.45,0.65], spread:0.50, center:null} };
  export function paletteHSL(mode, hueCenter /* 0..1 */, t /* 0..1 position in population */, v /* 0..1 value */) → [h, s, l]
  //   h = (center ?? hueCenter) + (t − 0.5)·spread, wrapped; s = sat; l = light[0] + v·(light[1] − light[0])
  ```

- [ ] **Step 1: Write the failing tests**

```js
import {test} from 'node:test'; import assert from 'node:assert/strict';
import {mixFeedback, MAX_DECAY} from '../immersive/engine/feedback-math.mjs';
import {paletteHSL, PALETTES, PALETTE_MODES} from '../immersive/engine/palettes.mjs';
test('ten thousand frames of maximum feedback never reach white',()=>{let prev=0,maxv=0;for(let i=0;i<10000;i++){prev=mixFeedback(prev,1,1);maxv=Math.max(maxv,prev);assert(prev<=maxv+1e-12)}assert(maxv<.999,`max ${maxv}`);assert.equal(MAX_DECAY,.96)});
test('no previous frame reproduces the tone-mapped current frame',()=>{assert(Math.abs(mixFeedback(0,.5,.9)-(1-Math.exp(-.5)))<1e-12)});
test('palette modes order saturation and respect lightness ranges',()=>{assert.deepEqual(PALETTE_MODES,['ink','silk','ember','neon']);const s=m=>paletteHSL(m,.3,.5,.5)[1];assert(s('ink')<s('silk')&&s('silk')<s('ember')&&s('ember')<=s('neon'));for(const m of PALETTE_MODES)for(const v of [0,.5,1]){const [h,,l]=paletteHSL(m,.3,.2,v);assert(h>=0&&h<1);assert(l>=PALETTES[m].light[0]-1e-9&&l<=PALETTES[m].light[1]+1e-9)}assert(Math.abs(paletteHSL('ember',.9,.5,.5)[0]-.06)<1e-9)});
```

- [ ] **Step 2: Run the tests to verify they fail** — Run: `node --test tests/post-math.test.mjs`. Expected: FAIL, module not found.

- [ ] **Step 3: Implement both modules**

- [ ] **Step 4: Run the tests to verify they pass** — Run: `node --test tests/post-math.test.mjs`. Expected: PASS, 3 tests.

- [ ] **Step 5: Commit**

```bash
git add immersive/engine/feedback-math.mjs immersive/engine/palettes.mjs tests/post-math.test.mjs
git commit -m "feat(engine): tone-mapped feedback mix and four palette modes"
```

---

### Task 9: Simulations take director axes and injections

**Files:**
- Create: `immersive/sims/physarum.mjs`, `immersive/sims/swarmalators.mjs`, `immersive/sims/boids.mjs`, `immersive/sims/life.mjs`
- Modify: `immersive/simulations.mjs` → becomes a re-export shim: `export {seeded} from './sims/physarum.mjs'; export {Physarum} ...; export {Swarmalators} ...; export {Boids} ...;`
- Test: `tests/sims-params.test.mjs`; existing `tests/emergence.test.mjs` and `tests/extra-dynamics.test.cjs` unchanged

**Interfaces:**
- Consumes: `LifeGrid` from `extra-dynamics.js` via side-effect import (`import '../../extra-dynamics.js'; const {LifeGrid} = globalThis.ExtraDynamics;`), which works in Node (CJS loaded as a script) and in the browser (module import of the IIFE).
- Produces, on every sim: existing constructors and `step(...)` signatures unchanged; plus
  ```js
  setParams({ H, T, D })      // each optional, 0..1; defaults reproduce current behaviour: H 0.5, T 0.5, D 1
  inject(random = Math.random) // one structural novelty event, never a reset
  active                      // integer ≤ count: agents/cells currently simulated and drawn (from D)
  ```
  and for Life:
  ```js
  export class Life {
    constructor(size = 64, seed = 1)
    grid /* LifeGrid */, pure /* boolean, default false */, generation
    setParams({H,T,D}); step(); inject(random); seed(seed)
    perturbations   // count of random births so far (0 forever while pure)
  }
  ```

Mappings (H=0.5, T=0.5, D=1 must equal today's constants): Physarum sensor angle `0.55·(0.4 + 1.2H)`, sensor distance `7·(0.6 + 0.8T)`, speed multiplier `0.6 + 0.8T`, decay `1.4·(0.6 + 0.8H)`, `active = round(count·(0.3 + 0.7D))`; `inject` sets a transient attractor at a random field point for 8 s (store `this.injected = {x,y,until}` consulted by `step`). Swarmalators effective coupling `coupling·2(1 − H) − 2·max(0, H − 0.5)·|coupling|` (H 0.5 → unchanged, H 0 → doubled, H 1 → sign flipped: anti-synchrony), phase noise `0.3·max(0, H − 0.5)` using the sim's seeded RNG, phase speed `0.6 + 0.8T`; `inject` flips the coupling sign for 2 beats (`this.flipUntil`). Boids alignment weight `0.8·(1.5 − H)`, separation `1.4·(0.5 + H)`, wander noise `2(H − 0.5)` clamped ≥ 0, speed multiplier `0.6 + 0.8T`; `inject` adds a repeller at a random point for 3 s. Life: `H` → births per generation `round(H·size·size/400)` (0 when `pure`), `T` → `generationsPerBeat = 1 + round(T·6)` (read by the app), `D` → stored for rendering; `inject` writes a glider at a random empty 4×4 window (0 when `pure`).

- [ ] **Step 1: Write the failing tests**

```js
import {test} from 'node:test'; import assert from 'node:assert/strict';
import {Physarum, Swarmalators, Boids} from '../immersive/simulations.mjs';
import {Life} from '../immersive/sims/life.mjs';
test('entropy changes physarum structure deterministically',()=>{const a=new Physarum(32,120,9),b=new Physarum(32,120,9),c=new Physarum(32,120,9);b.setParams({H:1});c.setParams({H:1});for(let i=0;i<120;i++){a.step(1/30,.4);b.step(1/30,.4);c.step(1/30,.4)}assert.notDeepEqual(a.field,b.field);assert.deepEqual(b.field,c.field)});
test('density limits active agents and inject never resets',()=>{const b=new Boids(60,4);b.setParams({D:.5});assert.equal(b.active,Math.round(60*(0.3+0.7*.5)));const before=b.p.slice();b.step(1/30,.6);assert.notDeepEqual(b.p.subarray(0,b.active*3),before.subarray(0,b.active*3));assert.deepEqual(b.p.subarray(b.active*3),before.subarray(b.active*3));const snap=b.p.slice();b.inject(()=>.5);assert.deepEqual(b.p,snap)});
test('high entropy desynchronises swarmalators compared with low entropy',()=>{const r=s=>{const sw=new Swarmalators(30,5);sw.setParams({H:s});for(let i=0;i<300;i++)sw.step(1/30,.2,1);const ph=Array.from(sw.phase);const x=ph.reduce((a,p)=>a+Math.cos(p),0)/30,y=ph.reduce((a,p)=>a+Math.sin(p),0)/30;return Math.hypot(x,y)};assert(r(0)>r(1),'order parameter should fall with entropy')});
test('pure Life equals the raw B3/S23 grid; impure Life perturbs; inject adds a glider',()=>{const pure=new Life(24,7);pure.pure=true;pure.setParams({H:1});const raw=pure.grid.cells.slice();const ref=new Life(24,7);ref.pure=true;for(let i=0;i<10;i++){pure.step();ref.step()}assert.deepEqual(pure.grid.cells,ref.grid.cells);assert.equal(pure.perturbations,0);const wild=new Life(24,7);wild.setParams({H:1});for(let i=0;i<10;i++)wild.step();assert(wild.perturbations>0);const empty=new Life(24,7);empty.grid.cells.fill(0);empty.inject(()=>.5);assert.equal(empty.grid.cells.reduce((a,b)=>a+b,0),5);assert.equal(raw.length,24*24)});
test('defaults reproduce the pre-existing behaviour',()=>{const a=new Boids(60,4),b=new Boids(60,4);b.setParams({});for(let i=0;i<50;i++){a.step(1/30,.6);b.step(1/30,.6)}assert.deepEqual(a.p,b.p)});
```

- [ ] **Step 2: Run the tests to verify they fail** — Run: `node --test tests/sims-params.test.mjs`. Expected: FAIL, `Life` module not found / `setParams is not a function`.

- [ ] **Step 3: Split `simulations.mjs` into `immersive/sims/*.mjs`, add `setParams`, `inject`, `active`; write `Life`; leave the shim**

- [ ] **Step 4: Run the whole suite** — Run: `node --test tests/*.test.mjs tests/*.test.cjs`. Expected: all pass; `tests/emergence.test.mjs` unchanged and green.

- [ ] **Step 5: Commit**

```bash
git add immersive/sims immersive/simulations.mjs tests/sims-params.test.mjs
git commit -m "feat(sims): entropy/tempo/density parameters, structural injections, Life wrapper with pure-rules mode"
```

---

### Task 10: Dual-stream audio graph and playlist

**Files:**
- Create: `immersive/audio.mjs` (browser), `immersive/engine/playlist.mjs` (pure)
- Test: `tests/playlist.test.mjs`; manual check for the graph

**Interfaces:**
- Produces:
  ```js
  // engine/playlist.mjs
  export class Playlist {
    constructor(tracks = [])             // [{id,title,src,duration}]
    index, loop = true, auto = true
    setTracks(tracks); current() → track | null; select(i) → track | null
    next() → track | null                // null at the end when !loop; wraps when loop
  }
  // audio.mjs
  export class AudioGraph {
    constructor(playerEl)
    context                             // created lazily, resumed on demand
    async resume() → boolean            // true when context.state === 'running'
    async startPlayer()                 // MediaElementSource → analyser(fftSize 2048, smoothing 0.55) → destination, once
    async startMic() → boolean          // getUserMedia with echoCancellation/noiseSuppression/autoGainControl false; analyser not routed to destination
    stopMic()
    setSynthetic(on)
    frames(time) → { music: Uint8Array|null, room: Uint8Array|null, source: 'player'|'mic'|'synthetic'|'none', sampleRate }
    //   music = player bins while the player is playing, else mic bins (if on), else synthetic envelope bins, else null
    //   room  = mic bins when the mic is on and the player is playing; null otherwise (the mic is then the music stream)
    latency() → { music: seconds, room: seconds }   // player: baseLatency + outputLatency + 1024/sampleRate + 1/60; mic: 1024/sampleRate + 1/60
    close()
  }
  ```
  Bins buffers are two fixed `Uint8Array(1024)`; synthetic bins are generated into a third fixed buffer.

- [ ] **Step 1: Write the failing playlist test**

```js
import {test} from 'node:test'; import assert from 'node:assert/strict';
import {Playlist} from '../immersive/engine/playlist.mjs';
const tracks=[{id:'a',src:'a.mp3'},{id:'b',src:'b.mp3'},{id:'c',src:'c.mp3'}];
test('advances, wraps when looping, stops when not',()=>{const p=new Playlist(tracks);assert.equal(p.current().id,'a');assert.equal(p.next().id,'b');assert.equal(p.next().id,'c');assert.equal(p.next().id,'a');p.loop=false;p.select(2);assert.equal(p.next(),null);assert.equal(p.current().id,'c')});
test('empty playlist is safe',()=>{const p=new Playlist();assert.equal(p.current(),null);assert.equal(p.next(),null);assert.equal(p.select(3),null)});
```

- [ ] **Step 2: Run it to verify it fails** — Run: `node --test tests/playlist.test.mjs`. Expected: FAIL, module not found.

- [ ] **Step 3: Implement `Playlist`, then `AudioGraph`**

`AudioGraph` replaces the player/mic code in `app.mjs` (`context()`, `playerGraph()`, `stopMic()`, `analyse()`); keep the prototype's analyser settings and the "never route the mic to speakers" rule.

- [ ] **Step 4: Run the playlist test** — Run: `node --test tests/playlist.test.mjs`. Expected: PASS, 2 tests.

- [ ] **Step 5: Commit**

```bash
git add immersive/audio.mjs immersive/engine/playlist.mjs tests/playlist.test.mjs
git commit -m "feat(audio): dual-stream audio graph with latency estimate; playlist"
```

---

### Task 11: App wiring, HUD and controls

**Files:**
- Modify: `immersive/index.html` (controls, English copy), `immersive/style.css` (new ids), `immersive/app.mjs` (replace `ReactiveDirector` use and the audio code with Tasks 1–10)
- Remove from `index.html`: `<script src="../extra-dynamics.js">` (Life now imports it as a module)

**Interfaces:**
- Consumes: `AudioFeatures` ×2 (music, room), `Director`, `Initiative`, `ArcPlayer`, `AudioGraph`, `Playlist`, sims `setParams/inject/active`, `Life`.
- Produces DOM ids the later tasks and the playtest rely on:
  `#initiative` (range −1..1 step .01), `#initiativeAuto` (button, aria-pressed), `#passLead`, `#lockScene` (button, aria-pressed), `#arc` (select tidal/firefly/mycelium + "auto chain"), `#pinArc`, `#roomMic` (button), `#playlistAuto`, `#playlistLoop`, `#track`, `#playSong`, `#player`, `#synthetic`, `#intensity`, `#speed`, `#symmetry` (select 0/2/4/6/8), `#feedback`, `#hue`, `#view`, `#skin`, `#lifePure`, `#jev`, `#listen`, `#commandForm/#command`, `#offline`, `#pause`, `#hide`, `#vr`, `#reset`, `#hud` (one line), `#explain` (panel, toggled by `#explainToggle`), `#audioStatus`, `#decision`, `#network`, `#meters`, `#phaseDot`, `#roomDot`.

Decisions: UI copy in English; header stays `E X T R A · LIVING WORLDS / 003 · FLOW`. HUD line format: `LEADING +0.40 · 108 BPM · C 0.72 · E 0.51 · room on` / `FOLLOWING −0.70 · listening`. The Initiative slider thumb is driven from `output.I` every frame while Auto is on; any `input` event on it calls `initiative.lock(value)` and turns Auto off; `#initiativeAuto` calls `unlock()`. `#passLead` toggles `I0` between +0.6 and −0.6 via `setBaseline`. Gestures: every `pointerdown`/`pointermove` (throttled to 10/s) and XR `selectstart` calls `director.agency.gesture(1)`. The frame loop: `audio.frames(t)` → `features.music.update(bins.music, dt)`, `features.room.update(bins.room, dt)` → `director.update(dt, input)` → apply `targets` to the current sim via `setParams({H,T,D})`, tempo multiplies the fixed-step accumulator, `pulse` scales instance size by `1 + 0.25·pulse·intensity`; `sceneChange` → `choose(name)`; every `choose(name)` (granted or manual) ends with `director.acknowledgeScene(name)`; `injection` → `sim.inject()`. Any manual control calls `jev.bump()`. On first `pointerdown`/`keydown` call `audio.resume()`; until it returns true the HUD shows `tap to start sound`. Mic permission denied → `#audioStatus` "Room mic unavailable; agency from gestures only", `room: off` in HUD. Explain panel lists each axis with its source (`you` when the user's slider dominates, `arc`, `jev`, `music`) from `output.hud.source`, the current world's rule text, and the latency compensation in ms.

- [ ] **Step 1: Rewrite `index.html` controls and `style.css` for the ids above**

- [ ] **Step 2: Rewrite `app.mjs` wiring (keep rendering code for the four worlds, stars, halos, XR, SW, offline button)**

- [ ] **Step 3: Start the server and check the page loads clean**

Run (background): `python3 scripts/serve-worlds.py --port 8766`
Open `http://127.0.0.1:8766/immersive/` in the built-in browser. Expected: no console errors; HUD reads `tap to start sound`; after a click it reads `LEADING +0.30 · listening`.

- [ ] **Step 4: Manual checks**

- Click `#synthetic`: within 5 s the HUD shows a BPM and `C` above 0.6; the phase dot ticks; swarmalators pulse.
- Drag `#initiative` to −1: HUD says `FOLLOWING −1.00`, Auto is off; wait 60 s on the synthetic beat: no scene change, no symmetry change.
- Press `#initiativeAuto`: the thumb drifts back toward +0.30 over ~20 s.
- Rapidly move the pointer for 3 s: the thumb visibly drops toward Follow within 2 s, then recovers.
- Press `#lockScene`, set Initiative +1: parameters keep changing, the scene never does.
- Press `#roomMic` on a machine with a mic: permission prompt appears now and not before; deny it: status text names the fallback and the page keeps running.

- [ ] **Step 5: Run the suite and commit**

Run: `node --test tests/*.test.mjs tests/*.test.cjs` — Expected: all pass.

```bash
git add immersive/index.html immersive/style.css immersive/app.mjs
git commit -m "feat(app): wire features, director, initiative slider, HUD, explain panel and dual-stream audio"
```

---

### Task 12: Post-process: kaleidoscope fold and feedback

**Files:**
- Create: `immersive/engine/post.mjs` (browser; imports Three.js)
- Modify: `immersive/app.mjs` (render through `PostFX`; colour sims through `paletteHSL`)

**Interfaces:**
- Consumes: `mixFeedback` formula and `MAX_DECAY` (Task 8), `paletteHSL` (Task 8), `targets.S/F/palette/hue` and `pulse` (Task 6).
- Produces:
  ```js
  export class PostFX {
    constructor(renderer, { width, height })
    setSize(width, height)
    render(scene, camera, { fold /* 0|2|4|6|8 */, feedback /* 0..1 */, pulse /* 0..1 */, dt })
    dispose()
  }
  ```
  Internals: two `WebGLRenderTarget`s for ping-pong feedback plus one scene target; a full-screen quad with a fragment shader that (1) samples the scene target through a polar fold into a `2π/fold` sector with mirroring when `fold > 0`, (2) samples the previous composite with zoom `1 + 0.015·feedback·(1 + pulse)` and rotation `0.004·feedback` radians, (3) combines with `1.0 − exp(−(cur + prev * min(decay, 0.96)))` where `decay = 0.80 + 0.16·feedback`, matching `mixFeedback` exactly. Fold changes cross-fade over one phrase: the app passes the previous fold and a `mix` 0..1; the shader renders both folds and lerps.

- [ ] **Step 1: Implement `PostFX` and route `renderer.render` through it; colour each world's instances with `paletteHSL(targets.palette, targets.hue/360, i/count, v)`**

- [ ] **Step 2: Manual checks** (server from Task 11)

- `#symmetry` 0 → 8: the view folds into mirrored sectors; changing it mid-groove fades rather than cuts.
- `#feedback` at maximum on the brightest scene (life, neon) for 60 s: trails, no white-out; frame rate stays above 50 fps on this Mac (`stats` line shows it).
- `#view` orbit and drag: feedback trails rotate with the scene, no smearing artefacts at the fold seams at fold 2.
- `#hue` and palette changes from the arc: ink is near-monochrome, neon spans the hue wheel.

- [ ] **Step 3: Run the suite and commit**

```bash
git add immersive/engine/post.mjs immersive/app.mjs
git commit -m "feat(post): kaleidoscope fold and tone-mapped feedback over the live worlds"
```

---

### Task 13: Forward flight camera and director-driven world parameters

**Files:**
- Modify: `immersive/app.mjs` (camera modes, physarum tunnel mesh, boids re-spawn, Life generation clock)

**Interfaces:**
- Consumes: `targets.camera` (`orbit|inside|close|flight`), `targets.omega`, `pulse`, `Life.generationsPerBeat`, sims `active`.
- Produces: camera mode `flight`: camera at `(0, 0, z)` moving at `−(2 + 4·T)` units/s along −z through the group, looking down −z with the user's orbit/pitch as a gentle yaw/pitch offset. Boids: any boid with `z > camera.z + 4` is re-spawned at `camera.z − 24` with its lateral position kept (done in app, not in the sim, so the sim stays frame-independent). Physarum in flight: the trail texture is applied to the inside of an open `CylinderGeometry(6, 6, 60, 48, 1, true)` with `repeat.set(1, 3)` and the camera inside; the sphere is used in the other modes. Life in flight: the sphere's radius breathes with the pulse and the camera passes through its centre. Life stepping: `lifeAcc += dt·bpm/60·generationsPerBeat`, one `step()` per whole unit, so T sets generations per beat as the spec says; the instance `count` equals live cells.

- [ ] **Step 1: Implement the camera modes and the three flight adaptations; drive `generationsPerBeat`**

- [ ] **Step 2: Manual checks**

- Select arc `mycelium` and pin it, Initiative +1: within ~2 min the camera is in `flight` through boids that stream past and re-spawn ahead without pops at the edge of view.
- Switch to physarum while in flight: the trails read as a tunnel wall; no visible seam at the cylinder's wrap.
- Life: with `#speed` at maximum the generation rate rises audibly with the synthetic beat; `#lifePure` on shows "pure B3/S23" on the HUD and `perturbations` stops increasing (visible in the Explain panel).

- [ ] **Step 3: Run the suite and commit**

```bash
git add immersive/app.mjs
git commit -m "feat(app): forward flight camera, tunnel mapping and beat-locked Life generations"
```

---

### Task 14: JEV server questions, validation and client wiring

**Files:**
- Modify: `scripts/serve-worlds.py` (replace `requests` with `urllib.request`; load key from `TYPESAFE_API_KEY` or the existing `.env` the current code points at; new `/api/decide` contract)
- Create: `scripts/test_serve_worlds.py`
- Modify: `immersive/app.mjs` (use `JevClient`; `director.applyDecision`; HUD `LOCAL DIRECTOR` / `JEV`)

**Interfaces:**
- Produces (Python, importable without a server):
  ```python
  SCENES = ['physarum','swarm','boids','life']; PALETTES = [...]; INITIATIVES = ['follow','mutual','lead']; REQUESTS = [...11 actions...]
  def validate_state(data: dict) -> dict        # raises ValueError; enforces types, 0..1 ranges, userText ≤ 180, ≤ 4096 bytes total
  def build_questions(state: dict) -> dict      # 7 questions, plus 'request' when state['userText']; types noul/choice/score with the spec's criteria
  def map_answers(answers: dict, version: int) -> dict   # the Task 7 Decision shape, raising ValueError on anything outside vocabulary/range
  def load_key() -> str | None
  ```
  HTTP: `POST /api/decide` body `{version:int, state:{...}}` → 200 with the Decision JSON; 400 invalid; 503 when no key; 502 when JEV fails; 429/529 from JEV passed through as 429 with `Retry-After: 15`.
  Score normalisation: `score / (len(levels) − 1)`; symmetry score levels map to `[0,2,4,6,8]`; `hold` from `answers['hold']['noul']`; choice confidence from `answers[k]['confidence']`; `scene.p = probabilities[choice]`.

- [ ] **Step 1: Write the failing Python tests**

```python
import unittest, json, sys, pathlib
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
import serve_worlds as sw

GOOD_STATE = {'scene':'swarm','sceneAge':12.3,'arc':{'name':'tidal','waypoint':2},
  'features':{'E_mean30':.5,'E_trend':.1,'C_mean30':.7,'B_mean30':.4,'A_mean30':.2,'bpm':108},
  'initiative':{'I':.3,'locked':False,'I0':.3},'locks':{'scene':False},'userText':'','recentDecisions':[],'online':True}

class ServeWorlds(unittest.TestCase):
    def test_questions_cover_the_spec(self):
        q = sw.build_questions(GOOD_STATE)
        self.assertEqual(set(q), {'hold','scene','energy','entropy','symmetry','palette','initiative'})
        self.assertEqual(q['hold']['type'], 'noul'); self.assertEqual(q['scene']['type'], 'choice')
        self.assertEqual(len(q['energy']['criteria']), 5); self.assertEqual(len(q['symmetry']['criteria']), 5)
        self.assertEqual(set(q['scene']['criteria']), set(sw.SCENES))
        q2 = sw.build_questions({**GOOD_STATE, 'userText': 'slower please'})
        self.assertIn('request', q2); self.assertEqual(set(q2['request']['criteria']), set(sw.REQUESTS))
    def test_state_validation(self):
        sw.validate_state(GOOD_STATE)
        for bad in [{'scene':'lenia'}, {'userText':'x'*181}, {'features':{**GOOD_STATE['features'],'E_mean30':1.5}}, {'initiative':{'I':2,'locked':False,'I0':.3}}]:
            with self.assertRaises(ValueError): sw.validate_state({**GOOD_STATE, **bad})
    def test_map_answers(self):
        answers = {'hold':{'type':'noul','noul':.7},
                   'scene':{'type':'choice','choice':'boids','probabilities':{'physarum':.1,'swarm':.2,'boids':.62,'life':.08},'confidence':.62},
                   'energy':{'type':'score','score':3.0,'probabilities':{},'legend':{},'confidence':.8},
                   'entropy':{'type':'score','score':2.0,'probabilities':{},'legend':{},'confidence':.3},
                   'symmetry':{'type':'score','score':3,'probabilities':{},'legend':{},'confidence':.9},
                   'palette':{'type':'choice','choice':'ember','probabilities':{'ember':1},'confidence':.7},
                   'initiative':{'type':'choice','choice':'lead','probabilities':{'lead':.5},'confidence':.5}}
        d = sw.map_answers(answers, 4)
        self.assertEqual(d['version'], 4); self.assertAlmostEqual(d['hold'], .7)
        self.assertEqual(d['scene'], {'choice':'boids','p':.62}); self.assertAlmostEqual(d['energy'], .75)
        self.assertEqual(d['symmetry'], 6); self.assertEqual(d['palette'], 'ember'); self.assertEqual(d['initiative'], 'lead')
        self.assertAlmostEqual(d['confidence']['entropy'], .3)
        for bad in [('palette', {'type':'choice','choice':'puce','probabilities':{},'confidence':.9}),
                    ('symmetry', {'type':'score','score':7,'probabilities':{},'legend':{},'confidence':.9}),
                    ('hold', {'type':'noul','noul':2})]:
            with self.assertRaises(ValueError): sw.map_answers({**answers, bad[0]: bad[1]}, 4)

if __name__ == '__main__': unittest.main()
```

- [ ] **Step 2: Run to verify failure** — Run: `python3 -m unittest scripts/test_serve_worlds.py`. Expected: FAIL (`AttributeError: build_questions`) or ImportError on `requests`.

- [ ] **Step 3: Rewrite `serve_worlds.py` functions and handler** (rename the file to `serve_worlds.py` for importability and keep a one-line `serve-worlds.py` shim that `exec`s it, or update the README command; pick the rename)

- [ ] **Step 4: Run the Python tests** — Run: `python3 -m unittest scripts/test_serve_worlds.py`. Expected: OK, 3 tests.

- [ ] **Step 5: Wire the client in `app.mjs`**

Every 24 s while `jev.enabled && navigator.onLine && !paused`: `jev.maybeRequest(() => buildState(...))`, and on `#commandForm` submit with `force: true` after `localCommand(text)` returned false. A non-null decision → `director.applyDecision(d)`; `#decision` text names the fields applied and the ones left to local. HUD tail: `· JEV` when enabled and online, `· LOCAL DIRECTOR` otherwise. `online`/`offline` events update `#network` and drop any in-flight answer by `jev.bump()`.

- [ ] **Step 6: Manual checks**

- With a key configured and network: toggle `#jev`; within ~10 s `#decision` shows applied fields; no visible jump in the world.
- Pull the network (toggle Wi-Fi): HUD switches to `LOCAL DIRECTOR` within 2 s; nothing resets.
- Submit `slower` with JEV off: applied locally at once. Submit `make it dreamier` with JEV on: a request fires immediately; the answer names an action from the vocabulary or none.

- [ ] **Step 7: Run both suites and commit**

```bash
node --test tests/*.test.mjs tests/*.test.cjs && python3 -m unittest scripts/test_serve_worlds.py
git add scripts/serve_worlds.py scripts/test_serve_worlds.py immersive/app.mjs
git commit -m "feat(jev): eight bounded questions, server-side validation, stale-safe client wiring"
```

---

### Task 15: Offline cache, playtest notes, final verification

**Files:**
- Modify: `sw.js` (`CACHE='extra-worlds-v4'`; add every `immersive/engine/*.mjs`, `immersive/sims/*.mjs`, `immersive/audio.mjs`)
- Create: `docs/flow-with-mind-playtest.md` (how to start, the spec §10 playtest script, what was tested by machine, what was tested by hand on this Mac, what remains untested: Quest 2, real room microphone with speakers, speech recognition, long runs)

- [ ] **Step 1: Update `sw.js` and verify the offline flow**

Serve, open the page, press `#offline`, wait for "ready", stop the server, reload: the page runs with the demo tracks; HUD shows `LOCAL DIRECTOR`.

- [ ] **Step 2: Write `docs/flow-with-mind-playtest.md`**

- [ ] **Step 3: Full verification**

Run: `node --test tests/*.test.mjs tests/*.test.cjs` — Expected: all pass (11 pre-existing + new).
Run: `python3 -m unittest scripts/test_serve_worlds.py` — Expected: OK.
Walk the spec §10 playtest script on this Mac with the synthetic beat and with *Firefly Convergence*; record outcomes in the playtest doc, including anything that failed.

- [ ] **Step 4: Commit**

```bash
git add sw.js docs/flow-with-mind-playtest.md
git commit -m "chore: offline cache for the flow engine; playtest notes with tested and untested items"
```

---

## Self-review notes

- Spec coverage: §4.1 → T1, T10 (two streams); §4.3 → T2; §4.4 → T4, T6; §4.5–4.8 → T6; §4.9 → T5; §5 → T7, T14; §6 → T8, T12, T13; §7 → T11; §8 → file map above; §9 → Global Constraints; §10 tests 1–12 → T1, T2, T4, T6, T7, T8, T9 (test 10), T3 (test 12); playtest → T15.
- Known adjustments to spec constants are listed under Global Constraints with the reason (the spec's own behavioural tests force them).
- Names used across tasks: `setParams/inject/active` (T9 ↔ T11/T13), `applyDecision/acknowledgeScene` (T6 ↔ T11/T14), `Decision` shape (T7 ↔ T6 ↔ T14), `mixFeedback`/`MAX_DECAY` (T8 ↔ T12), `paletteHSL` (T8 ↔ T12), `frames()/latency()` (T10 ↔ T11).
