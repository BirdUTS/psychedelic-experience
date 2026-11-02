/* EXTRA / Living Worlds · Flow with Mind v2 — browser app.
   Owns the renderer, audio graph, ship camera, play surface and drawer. All decisions come from the pure engine:
   Director (lead/follow, metabolism, events), Ship (motion), Liveliness, SnapshotRing (rewind), Gestures. */
import * as THREE from '../vendor/three.module.js';
import { Physarum } from './sims/physarum.mjs';
import { Swarmalators } from './sims/swarmalators.mjs';
import { Boids } from './sims/boids.mjs';
import { Life } from './sims/life.mjs';
import { AudioFeatures } from './engine/features.mjs';
import { Director } from './engine/director.mjs';
import { SCENES, FOLDS } from './engine/arcs.mjs';
import { AudioGraph } from './audio.mjs';
import { Playlist } from './engine/playlist.mjs';
import { PostFX } from './engine/post.mjs';
import { defaultProgram, programFor, applyMood, capProgram, CONTINUOUS, DISCRETE } from './engine/grammar.mjs';
import { Phases } from './engine/phases.mjs';
import { Passages } from './engine/passages.mjs';
import { ShotDirector, shotPose, shotForWords, SHOTS } from './engine/shots.mjs';
import { VisualGestures } from './engine/visual-gestures.mjs';
import { JevClient, buildState, shouldAutoEnable } from './engine/jev-client.mjs';
import { directorInput } from './engine/streams.mjs';
import { requestActions, spokenMood } from './engine/requests.mjs';
import { VoiceEnvelope } from './engine/voice.mjs';
import { Liveliness } from './engine/liveliness.mjs';
import { SnapshotRing } from './engine/snapshots.mjs';
import { Ship } from './engine/ship.mjs';
import { depthToAxes } from './engine/depth.mjs';
import { Gestures } from './engine/gestures.mjs';
import { FrameMeter, frameLine } from './engine/frame-meter.mjs';
import { headsetLine, triggerAction, nextWorld, GripHold } from './engine/headset.mjs';
import { Worlds } from './worlds.mjs';
import { talkLanguage, captionLanguage, line as captionLine, worldName, decisionCaption } from './engine/captions.mjs';

const $ = id => document.getElementById(id), RAD = Math.PI / 180;
// The quiet glass (v4 step 1): a guest sees the picture, one line to begin, and captions; nothing to set. ?dev keeps
// the old dashboard, the ring, the HUD and the keyboard for checking the engine.
const PARAMS = new URLSearchParams(location.search), DEV = PARAMS.has('dev'), QUIET = !DEV;
document.body.classList.toggle('quiet', QUIET);
let capLang = captionLanguage(navigator.language), captionsMode = 'all', grounded = false, started = !QUIET, soundSource = 'mic', lastSpoken = -Infinity, hintAt = Infinity, hintIndex = 0;
const WORLDS = {
  physarum: ['01 / MYCELIAL INTELLIGENCE', 'The world<br>weaves itself.', 'Every path remembers another path. The network chases the food the music drops.', 'sense trail → turn → deposit → diffuse and decay · food jumps on accents'],
  swarm: ['02 / COLLECTIVE RESONANCE', 'A thousand lights.<br>One becoming.', 'Each light keeps its own rhythm, until it does not.', 'position ↔ phase coupling · active phase wave ↔ rings by entropy · kicks on the beat'],
  boids: ['03 / OCEAN OF MOTION', 'You are part<br>of the current.', 'The flock streams past you and re-forms ahead.', 'local neighbours: separation + alignment + cohesion · wind turns on the phrase'],
  life: ['04 / CELLULAR COSMOS', 'Small rules.<br>Living worlds.', 'A universe grows from three rules.', 'B3/S23 · toroidal · synchronous · a tunnel of cells in flight'],
};

// ---------- renderer ----------
let renderer;
try { renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' }); }
catch (e) { $('error').hidden = false; $('error').textContent = 'WebGL could not start. Use a browser with 3D support, or open the original math lab.'; throw e; }
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.7)); renderer.setSize(innerWidth, innerHeight); renderer.setClearColor(0x04070d); renderer.xr.enabled = true;
$('stage').append(renderer.domElement);
const scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera(65, innerWidth / innerHeight, 0.08, 120);
scene.fog = new THREE.FogExp2(0x04070d, 0.022);
const group = new THREE.Group(); scene.add(group);
const clock = new THREE.Clock();
const drawSize = renderer.getDrawingBufferSize(new THREE.Vector2());
const post = new PostFX(renderer, { width: drawSize.x, height: drawSize.y });
const program = defaultProgram(), target = defaultProgram(), current = defaultProgram();   // rendered / grammar target / time-blended
const visualGestures = new VisualGestures(), phases = new Phases(), passages = new Passages(), voiceEnv = new VoiceEnvelope();
let heard = '', heardUntil = -Infinity;
const shots = new ShotDirector('physarum'), camPos = new THREE.Vector3(0, 2, 19), camLook = new THREE.Vector3(), poseV = new THREE.Vector3();
let shotStarted = 0, chaseIndex = 0, shotGlide = 0;
// JEV, made visible: its connection on the HUD, its answer spoken on the HUD for a few seconds, and a ripple when it acts.
let jevStatus = 'off', jevSaid = '', jevSaidUntil = -Infinity, jevPulse = 0;
const WORLD_NAMES = { physarum: 'mycelium', swarm: 'fireflies', boids: 'fish', life: 'Life planet' };   // the last words Talk heard, shown on the HUD for a few seconds

// ---------- engine ----------
const sims = { physarum: new Physarum(), swarm: new Swarmalators(), boids: new Boids(), life: new Life(64, 1) };
const worlds = new Worlds(group, sims, scene);
const audio = new AudioGraph($('player'));
const playlist = new Playlist();
let world = 'physarum', seed = 100;
const director = new Director({ scene: world });
const ship = new Ship();
const liveliness = new Liveliness();
const rings = Object.fromEntries(Object.entries(sims).map(([k, s]) => [k, new SnapshotRing(s.state())]));
const gestures = new Gestures(QUIET ? { longPressMs: 1000 } : {});
const jev = new JevClient({ now: () => performance.now() / 1000 });
const bump = () => { jev.bump(); };
let musicF = null, roomF = null;
function ensureFeatures(sampleRate) {
  if (!musicF || musicF.sampleRate !== sampleRate) { musicF = new AudioFeatures({ sampleRate, frameRate: 60 }); roomF = new AudioFeatures({ sampleRate, frameRate: 60 }); }
}
ensureFeatures(48000);

let paused = matchMedia('(prefers-reduced-motion: reduce)').matches, simTime = 0, acc = 0, lifeAcc = 0, simClock = 0;
let depth = 0.5, sceneLocked = false, autoInitiative = true, gestureCount = 0, lastGesture = 0, lastInteraction = Infinity;   // no idle fade before the first touch
let orbit = 0, pitch = 0.12, zoom = 19, attractor = null, attractorUntil = 0, xrSession = null;
let dissolving = null, jump = null, snapshotTimer = 0, rewindNote = '', fps = 60;
const summary = { E30: 0, E5: 0, C30: 0, B30: 0, A30: 0 }, recentDecisions = [];
let lastJevAsk = -Infinity;
const timing = { step: 0, steps: 0, render: 0, post: 0, dt: 0 };
let calm = false, quality = 1, lowFpsFor = 0, highFpsFor = 0, programStarted = false, lastGestureEnd = -Infinity, prevGesture = null, rewindFired = false, jumpFired = false, lastJump = false, depthTouched = false, leavingByGlyph = false, landedFired = false;
window.__flow = {
  director, audio, sims, worlds, ship, liveliness, rings, timing, jev, gestures, post, program, target, current, visualGestures, phases, passages, voiceEnv, shots, get jevStatus() { return jevStatus; }, get jevSaid() { return jevSaid; }, nextShot: () => nextShot(), pickShot: n => pickShot(n), forceVoice: null, hear: text => hearText(text),
  forceProgram: null,   // a partial program merged over the computed one (checks)
  get calm() { return calm; }, set calm(v) { calm = !!v; $('calm').checked = calm; }, get quality() { return quality; }, immerse,
  get musicF() { return musicF; }, get roomF() { return roomF; }, get depth() { return depth; }, set depth(v) { setDepth(v); },
  forceLiveliness: null, skipRender: false,
  get jump() { return jump; }, get world() { return world; }, get dissolving() { return dissolving; },
  frame: dt => frame(dt), advance(seconds, dt = 1 / 60) { for (let t = 0; t < seconds; t += dt) frame(dt); return seconds; },
  rewind: () => rewind('manual'), launch: () => setShipMode('ship'), hover: () => setShipMode('hover'),
  begin: () => begin(), ground: on => setGround(on), caption: (t, s) => caption(t, s), get grounded() { return grounded; }, get started() { return started; },
};

// ---------- worlds, scenes, snapshots ----------
function choose(id, { auto = false, keepMood = false, say = false } = {}) {
  if (!WORLDS[id]) return;
  if (say) caption(worldName(id, capLang), 3);
  world = id; shots.update({ world: id }); worlds.build(id, ship.mode, $('skin').value, shots.shot.layout || 'sphere'); startShot();
  const a = WORLDS[id];
  $('chapter').textContent = a[0]; $('worldTitle').innerHTML = a[1]; $('worldHint').textContent = a[2]; $('rule').textContent = a[3];
  document.querySelectorAll('[data-world]').forEach(b => { const on = b.dataset.world === id; b.classList.toggle('selected', on); b.setAttribute('aria-pressed', String(on)); });
  director.acknowledgeScene(id, { keepMood });
  if (!auto) bump();
  // A world that was frozen when we left it comes back from its best snapshot (after the jump lands).
  if (liveliness.value(id) < 0.35 && rings[id].count) { if (jump) jump.rewindOnLand = true; else rewind('return'); }
}
function finishDissolve() {
  if (!dissolving) return;
  dissolving.ring.update(60, sims[dissolving.id].state(), { discrete: dissolving.id === 'life' ? [0, 1] : [] });
  sims[dissolving.id].resync?.(); dissolving = null;
}
function rewind(reason = 'manual') {
  if (dissolving || (jump && reason !== 'return')) return false;
  const sim = sims[world], ring = rings[world];
  if (world === 'life' && sim.pure) { sim.seed(++seed); rewindNote = 'reseeded (pure rules)'; }
  else {
    const best = ring.best();
    if (!best) { if (world === 'life') sim.seed(++seed); else sim.reset(++seed); rewindNote = 'reseeded (no snapshot yet)'; }
    else { ring.rewindTo(best.index, { seconds: 2 }); dissolving = { ring, id: world }; rewindNote = `rewind → ${Math.round(simClock - best.time)} s ago (${reason})`; }
  }
  liveliness.reset(world); snapshotTimer = 0; rewindFired = true;
  $('decision').textContent = rewindNote;
  return true;
}
function startJump(next, { manual = false } = {}) {
  if (jump || !WORLDS[next] || next === world) return;
  finishDissolve();   // a jump over a half-finished rewind would leave the arriving world frozen
  if (manual) bump();
  jump = { t: 0, to: next, switched: false, rewindOnLand: false, manual }; jumpFired = true;
}
function updateJump(dt) {
  jump.t += dt;
  if (!jump.switched && jump.t >= 2) { jump.switched = true; choose(jump.to, { auto: true, keepMood: jump.manual, say: !jump.manual }); }
  const u = jump.t < 2 ? jump.t / 2 : (jump.t - 2) / 2;
  group.scale.set(1, 1, jump.t < 2 ? 1 - 0.9 * u : 0.6 + 0.4 * Math.min(1, u));
  if (jump.t >= 4 || (jump.switched && world !== jump.to)) {   // never leave a jump hanging
    const land = jump.rewindOnLand; jump = null; group.scale.set(1, 1, 1); landedFired = true;
    if (land) rewind('return');
  }
}
function setShipMode(mode) {
  if (mode === 'ship') ship.launch(); else ship.hover();
  worlds.build(world, ship.mode, $('skin').value, shots.shot.layout || 'sphere');
  $('hoverToggle').textContent = 'Hover: ' + (ship.mode === 'hover' ? 'on' : 'off'); $('hoverToggle').setAttribute('aria-pressed', String(ship.mode === 'hover'));
  $('ringMode').textContent = (autoInitiative ? 'auto' : 'locked') + ' · ' + (ship.mode === 'ship' ? 'ship' : 'hover');
  touch();
}
function setDepth(v) {
  depth = Math.max(0, Math.min(1, Number.isFinite(v) ? v : depth)); $('depth').value = depth.toFixed(2); depthTouched = true;   // the user's hand: discrete parameters follow at once
  const hint = $('depthHint'); hint.classList.add('show'); hint.querySelector('i').style.bottom = (depth * 100) + '%';
  clearTimeout(setDepth.timer); setDepth.timer = setTimeout(() => hint.classList.remove('show'), 1500);
  bump();
}
function touch() { lastInteraction = simClock; document.body.classList.remove('idle'); }

// ---------- initiative ring ----------
const ringEl = $('ring'), ringDot = $('ringDot');
function ringValueFromEvent(e) {
  const r = ringEl.getBoundingClientRect(), frac = Math.max(0, Math.min(1, (e.clientX - r.left) / r.width));
  return 1 - 2 * frac;   // left end = Lead me (+1), right end = Follow me (−1)
}
function setAuto(on) {
  autoInitiative = on;
  if (on) director.initiative.unlock(); else director.initiative.lock(director.initiative.I);
  document.body.classList.toggle('locked', !on);
  $('ringMode').textContent = (on ? 'auto' : 'locked') + ' · ' + (ship.mode === 'ship' ? 'ship' : 'hover');
}
function placeDot(I) {
  const frac = (1 - I) / 2, theta = Math.PI - frac * Math.PI;
  ringDot.setAttribute('cx', (200 + 170 * Math.cos(theta)).toFixed(1)); ringDot.setAttribute('cy', (100 - 170 * Math.sin(theta)).toFixed(1));
  ringEl.setAttribute('aria-valuenow', I.toFixed(2));
}
// Ring touches: a tap or drag locks Initiative where you touch; a still long-press toggles hover without
// locking; a double-tap passes the lead. Nothing locks until the finger moves or lifts.
let ringDrag = null, ringLastTap = 0, ringPressTimer = null;
ringEl.addEventListener('pointerdown', e => {
  e.stopPropagation(); try { ringEl.setPointerCapture(e.pointerId); } catch { /* pointer already gone */ } touch();
  const now = performance.now();
  if (now - ringLastTap < 300) { director.initiative.setBaseline(director.initiative.I0 > 0 ? -0.6 : 0.6); setAuto(true); $('decision').textContent = director.initiative.I0 > 0 ? 'The world takes the lead.' : 'The world follows you.'; ringLastTap = 0; return; }
  ringLastTap = now;
  ringDrag = { x: e.clientX, y: e.clientY, moved: false, pressed: false };
  ringPressTimer = setTimeout(() => { if (ringDrag && !ringDrag.moved) { ringDrag.pressed = true; setShipMode(ship.mode === 'ship' ? 'hover' : 'ship'); } }, 600);
});
ringEl.addEventListener('pointermove', e => {
  if (!ringDrag || ringDrag.pressed) return;
  if (!ringDrag.moved && Math.hypot(e.clientX - ringDrag.x, e.clientY - ringDrag.y) < 8) return;
  ringDrag.moved = true; clearTimeout(ringPressTimer);
  director.initiative.lock(ringValueFromEvent(e)); setAuto(false); bump();
});
for (const ev of ['pointerup', 'pointercancel']) ringEl.addEventListener(ev, e => {
  clearTimeout(ringPressTimer);
  if (ringDrag && !ringDrag.moved && !ringDrag.pressed) { director.initiative.lock(ringValueFromEvent(e)); setAuto(false); bump(); }
  ringDrag = null;
});
ringEl.addEventListener('keydown', e => { if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') { director.initiative.lock(Math.max(-1, Math.min(1, director.initiative.I + (e.key === 'ArrowLeft' ? 0.1 : -0.1)))); setAuto(false); e.preventDefault(); } });

// ---------- gestures on the glass ----------
const canvas = renderer.domElement;
let dragging = false, swallowed = null;   // the first touch after the idle fade only wakes the surface
function act(action) {
  if (!action) return;
  touch();
  switch (action.type) {
    case 'tap':
      if (QUIET) { if (!started) break; if (!talking || (soundSource === 'mic' && !audio.micOn)) openEar(); nextShot(); director.agency.gesture(2); attractor = { x: action.x / innerWidth, y: action.y / innerHeight }; attractorUntil = simClock + 0.6; break; }
      if (ship.mode === 'hover') { setShipMode('ship'); $('decision').textContent = 'Launched. Tap again to pulse; long-press the ring to hover.'; }
      else { director.agency.gesture(2); attractor = { x: action.x / innerWidth, y: action.y / innerHeight }; attractorUntil = simClock + 0.6; }
      break;
    case 'swipe': {
      if (QUIET) break;
      if (action.dir === 'left' || action.dir === 'right') {
        const i = SCENES.indexOf(world), next = SCENES[(i + (action.dir === 'left' ? 1 : SCENES.length - 1)) % SCENES.length];
        director.requestScene(next); $('decision').textContent = `requested: ${next}` + (director.initiative.I > -0.5 ? ' · at the next phrase' : '');
      } else setDepth(depth + (action.dir === 'up' ? 0.1 : -0.1));
      break;
    }
    case 'longpress': if (QUIET) setGround(!grounded); else toggleLock(); break;
    case 'twofinger': if (!QUIET) rewind('gesture'); break;
    case 'pinch': if (!QUIET) ship.trim((action.scale - 1) * 0.05); break;
  }
}
canvas.addEventListener('pointerdown', e => {
  if (document.body.classList.contains('idle')) { swallowed = e.pointerId; touch(); return; }
  try { canvas.setPointerCapture(e.pointerId); } catch { /* pointer already gone */ } dragging = true; touch();
  act(gestures.down(e.pointerId, e.clientX, e.clientY, performance.now()));
  gestureCount++;
});
canvas.addEventListener('pointermove', e => {
  if (e.pointerId === swallowed) return;
  if (!dragging) { if (document.body.classList.contains('idle')) touch(); return; }   // a mouse move wakes the surface
  const a = gestures.move(e.pointerId, e.clientX, e.clientY, performance.now());
  if (a?.type === 'drag') {
    if (ship.mode === 'ship') ship.steer(-a.dx * 0.25, -a.dy * 0.2);
    else { orbit -= a.dx * 0.004; pitch = Math.max(-1.2, Math.min(1.2, pitch + a.dy * 0.003)); }
    attractor = { x: e.clientX / innerWidth, y: e.clientY / innerHeight }; attractorUntil = simClock + 0.3;
    const now = clock.elapsedTime; if (now - lastGesture > 0.1) { gestureCount++; lastGesture = now; }
  } else if (a?.type === 'pinch') act(a);
});
for (const ev of ['pointerup', 'pointercancel']) canvas.addEventListener(ev, e => {
  if (e.pointerId === swallowed) { swallowed = null; return; }
  dragging = false; act(gestures.up(e.pointerId, e.clientX, e.clientY, performance.now()));
});
canvas.addEventListener('wheel', e => { e.preventDefault(); touch(); if (ship.mode === 'ship') ship.trim(-e.deltaY * 0.0008); else zoom = Math.max(0.01, Math.min(35, zoom + e.deltaY * 0.008)); }, { passive: false });
// Shake to rewind (phones): two strong accelerations within 600 ms.
let shakeAt = 0;
addEventListener('devicemotion', e => {
  const a = e.accelerationIncludingGravity; if (!a) return;
  const g = Math.hypot(a.x || 0, a.y || 0, a.z || 0);
  if (g > 18) { const now = performance.now(); if (now - shakeAt < 600 && now - shakeAt > 80) rewind('shake'); shakeAt = now; }
});
addEventListener('keydown', e => {
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT' || e.target.tagName === 'TEXTAREA') return;
  if (QUIET) { if (e.key === 'Escape' && !document.fullscreenElement) openHost(); return; }
  touch();
  switch (e.key) {
    case ' ': e.preventDefault(); act({ type: 'tap', x: innerWidth / 2, y: innerHeight / 2 }); break;
    case 'ArrowLeft': ship.steer(-8, 0); break; case 'ArrowRight': ship.steer(8, 0); break; case 'ArrowUp': ship.steer(0, -6); break; case 'ArrowDown': ship.steer(0, 6); break;
    case '[': act({ type: 'swipe', dir: 'right' }); break; case ']': act({ type: 'swipe', dir: 'left' }); break;
    case '+': case '=': setDepth(depth + 0.1); break; case '-': setDepth(depth - 0.1); break;
    case 'h': case 'H': toggleLock(); break; case 'r': case 'R': rewind('key'); break;
    case 'v': case 'V': setShipMode(ship.mode === 'ship' ? 'hover' : 'ship'); break;
    case 'c': case 'C': nextShot(); break;
    case 'p': case 'P': setPause(!paused); break;
    case 'Escape': if (!document.fullscreenElement) toggleDrawer(); break;   // in fullscreen the browser's Esc leaves it first
  }
});
const wake = () => { audio.resume(); };
addEventListener('pointerdown', wake); addEventListener('keydown', wake);

// ---------- drawer and setup controls ----------
function toggleDrawer(force) {
  if (QUIET) { openHost(force); return; }
  const open = force ?? $('drawer').hidden;
  $('drawer').hidden = !open; touch();
}
$('gear').onclick = () => toggleDrawer(true); $('closeDrawer').onclick = () => toggleDrawer(false);
$('hoverToggle').onclick = () => setShipMode(ship.mode === 'ship' ? 'hover' : 'ship');
document.querySelectorAll('[data-world]').forEach(b => b.onclick = () => { if (!jump) startJump(b.dataset.world, { manual: true }); });
function toggleLock(force) {
  sceneLocked = force ?? !sceneLocked;
  $('lockScene').textContent = 'Lock scene: ' + (sceneLocked ? 'on' : 'off'); $('lockScene').setAttribute('aria-pressed', String(sceneLocked));
  $('decision').textContent = sceneLocked ? 'Holding this world.' : 'The world may move on.'; bump();
}
$('lockScene').onclick = () => toggleLock();
$('rewind').onclick = () => rewind('button');
$('reset').onclick = () => { const s = sims[world]; if (world === 'life') s.seed(++seed); else s.reset(++seed); s.resync?.(); liveliness.reset(world); bump(); };
$('arc').onchange = () => { const v = $('arc').value; if (v === 'auto') { director.arcs.pin(false); $('pinArc').textContent = 'Pin arc: off'; $('pinArc').setAttribute('aria-pressed', 'false'); } else director.arcs.select(v, { pin: $('pinArc').getAttribute('aria-pressed') === 'true' }); bump(); };
$('pinArc').onclick = () => { const on = $('pinArc').getAttribute('aria-pressed') !== 'true'; director.arcs.pin(on); $('pinArc').textContent = 'Pin arc: ' + (on ? 'on' : 'off'); $('pinArc').setAttribute('aria-pressed', String(on)); };
$('skin').onchange = () => { if (world === 'boids') worlds.build(world, ship.mode, $('skin').value, shots.shot.layout || 'sphere'); };
// The observer: shots change every two phrases in hover; C, the View button or words like 衛星 / 跟住 / 換角度 step or pick.
function startShot() {
  shotStarted = simTime; shotGlide = 2.5;
  const sim = sims[world]; chaseIndex = sim && sim.active ? Math.floor(Math.random() * sim.active) : 0;
  if (world === 'physarum' && ship.mode === 'hover' && (shots.shot.layout || 'sphere') !== worlds.layout) worlds.build(world, ship.mode, $('skin').value, shots.shot.layout || 'sphere');
  viewLabel();
}
function viewLabel() { $('viewBtn').textContent = 'View: ' + shots.shot.label; }
function nextShot() { if (ship.mode === 'ship') setShipMode('hover'); shots.next(); startShot(); touch(); }
function pickShot(name) { if (ship.mode === 'ship') setShipMode('hover'); if (name === 'next' || !shots.pick(name)) shots.next(); startShot(); touch(); }
$('viewBtn').onclick = () => nextShot();
$('lifePure').onchange = () => { sims.life.pure = $('lifePure').checked; };
function setPause(v) { paused = v; $('pause').textContent = v ? 'Resume' : 'Pause'; $('pause').setAttribute('aria-pressed', String(v)); }
setPause(paused); $('pause').onclick = () => setPause(!paused);
// Immerse: the one obvious control (v3 §6). First use asks for fullscreen, hides titles and meters, and turns the
// pill into a corner glyph; the glyph toggles. Browser Esc leaves fullscreen; fullscreenchange keeps the body in step.
async function immerse(on) {
  const b = $('immerse');
  if (!b.classList.contains('used')) { b.classList.add('used'); document.body.classList.add('immerseUsed'); b.textContent = '▣'; b.setAttribute('aria-label', 'Immerse'); }
  document.body.classList.toggle('immersed', on); b.setAttribute('aria-pressed', String(on));
  try {
    if (on && !document.fullscreenElement) await document.documentElement.requestFullscreen({ navigationUI: 'hide' });
    else if (!on && document.fullscreenElement) { leavingByGlyph = true; await document.exitFullscreen(); }
  } catch { /* fullscreen refused (embedded page, policy): titles still hide, the glyph still toggles */ }
  touch();
}
$('immerse').onclick = () => immerse(!document.body.classList.contains('immersed'));
document.addEventListener('fullscreenchange', () => {
  if (document.fullscreenElement) return;
  // Browser Esc (not the glyph) leaves fullscreen: titles come back and the drawer opens (spec §6).
  const byEsc = document.body.classList.contains('immersed') && !leavingByGlyph;
  document.body.classList.remove('immersed'); $('immerse').setAttribute('aria-pressed', 'false'); leavingByGlyph = false;
  if (byEsc) toggleDrawer(true);
});
$('calm').onchange = () => { calm = $('calm').checked; bump(); touch(); };
$('explainToggle').onclick = () => { const on = $('explain').hidden; $('explain').hidden = !on; $('explainToggle').setAttribute('aria-pressed', String(on)); };
addEventListener('resize', () => { camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); renderer.setSize(innerWidth, innerHeight); renderer.getDrawingBufferSize(drawSize); post.setSize(drawSize.x, drawSize.y); });

// ---------- the quiet glass: begin, captions, bring me back, host panel ----------
// One touch starts everything the browser needs a gesture for: fullscreen, sound, the ear (room mic + speech), and
// the first caption. JEV switched itself on at load when a decision server answered the probe.
function begin({ fullscreen = true } = {}) {
  if (started) return;
  started = true; $('start').classList.add('gone'); document.body.classList.add('immersed'); touch();
  audio.resume();
  openEar();   // the words to say come only once the ear is really open (setTalk)
  // Fullscreen may be refused (an embedded page); nothing waits on it. A headset is already full.
  if (fullscreen && !document.fullscreenElement) { try { document.documentElement.requestFullscreen({ navigationUI: 'hide' })?.catch?.(() => {}); } catch { /* no fullscreen here */ } }
}
// The ear opens in order: the room mic first (one permission prompt), Talk once that is granted — asking Chrome for
// both at once leaves Talk refused. While the ear is shut, every tap asks again and the glass says so now and then.
let earOpening = false, noMicSaid = -Infinity;
async function openEar() {
  if (earOpening) return;
  earOpening = true;
  try {
    const ok = soundSource !== 'mic' || audio.micOn || await audio.startMic();
    micLabel();
    if (!ok) { if (simClock - noMicSaid > 30) { noMicSaid = simClock; caption(captionLine('noMic', capLang), 4); } return; }
    if (Recognition && !talking) setTalk(true);
  } finally { earOpening = false; }
}
$('start').addEventListener('pointerup', e => { e.preventDefault(); begin(); });
$('start').addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); begin(); } });
// Captions: the only words on the glass. Short, one at a time, a few seconds each; "bring me back" jumps the queue.
const capQueue = []; let capUntil = -Infinity, capShowing = false;
function caption(text, seconds = 3, { essential = false } = {}) {
  if (!QUIET || !started || !text) return;
  if (captionsMode === 'none' || (captionsMode === 'ground' && !essential)) return;
  if (essential) { capQueue.length = 0; capUntil = -Infinity; }
  if (capQueue.length >= 3) capQueue.shift();
  capQueue.push({ text, seconds });
}
function stepCaptions() {
  if (simClock < capUntil) return;
  const next = capQueue.shift();
  if (!next) { if (capShowing) { capShowing = false; $('caption').classList.remove('show'); } return; }
  capShowing = true; $('caption').textContent = next.text; $('caption').classList.add('show'); capUntil = simClock + next.seconds;
}
const HINTS = ['hintHold', 'hintWorld', 'hintCalm'];
function stepHints() {
  if (!QUIET || !started || !talking || simClock < hintAt) return;
  if (simClock - lastInteraction > 60 && simClock - lastSpoken > 60) caption(captionLine(HINTS[hintIndex++ % HINTS.length], capLang), 4);
  hintAt = simClock + 240;
}
// Bring me back: hover, shallow, gentle, held on this world, clear. Never lifted by the app; a second hold or 繼續 lifts it.
let groundSaved = null;
function setGround(on) {
  if (on === grounded) { if (on) caption(captionLine('ground', capLang), 4, { essential: true }); return; }
  grounded = on;
  if (on) {
    groundSaved = { depth, calm, sceneLocked };
    setShipMode('hover'); setDepth(0.15); calm = true; $('calm').checked = true; toggleLock(true); director.setMood('clear');
    caption(captionLine('ground', capLang), 6, { essential: true });
  } else {
    const g = groundSaved || {}; setDepth(g.depth ?? 0.5); calm = !!g.calm; $('calm').checked = calm; toggleLock(!!g.sceneLocked); director.clearMood();
    caption(captionLine('groundOff', capLang), 3, { essential: true });
  }
  bump();
}
// The host panel: four rows, reached by Esc or a two-second hold in the bottom-right corner.
function openHost(on) { const open = on ?? $('host').hidden; $('host').hidden = !open; touch(); }
$('hostClose').onclick = () => openHost(false);
let cornerTimer = null;
$('hostCorner').addEventListener('pointerdown', () => { clearTimeout(cornerTimer); cornerTimer = setTimeout(() => openHost(true), 2000); });
for (const ev of ['pointerup', 'pointercancel', 'pointerleave']) $('hostCorner').addEventListener(ev, () => clearTimeout(cornerTimer));
function pressSeg(attr, value) { document.querySelectorAll(`[${attr}]`).forEach(b => b.setAttribute('aria-pressed', String(b.getAttribute(attr) === value))); }
document.querySelectorAll('[data-sound]').forEach(b => b.onclick = () => setSoundSource(b.dataset.sound));
document.querySelectorAll('[data-captions]').forEach(b => b.onclick = () => { captionsMode = b.dataset.captions; pressSeg('data-captions', captionsMode); });
document.querySelectorAll('[data-comfort]').forEach(b => b.onclick = () => { calm = b.dataset.comfort === 'on'; $('calm').checked = calm; pressSeg('data-comfort', b.dataset.comfort); bump(); });
document.querySelectorAll('[data-lang]').forEach(b => b.onclick = () => setLanguage(b.dataset.lang));
async function setSoundSource(src) {
  soundSource = src; pressSeg('data-sound', src);
  if (src === 'mic') { audio.stopSystem(); systemLabel(); player.pause(); if (!audio.micOn) { await audio.startMic(); micLabel(); } }
  else if (src === 'computer') { const r = await audio.startSystem(); systemLabel(); if (r.ok) player.pause(); else { soundSource = 'mic'; pressSeg('data-sound', 'mic'); } }
  else if (src === 'demo') { audio.stopSystem(); systemLabel(); const t = playlist.current() || playlist.tracks[0]; if (t) loadTrack(t, true); }
  bump();
}
function setLanguage(lang) {
  $('talkLang').value = lang; capLang = captionLanguage(lang); pressSeg('data-lang', lang);
  document.querySelectorAll('[data-line]').forEach(el => { const t = captionLine(el.dataset.line, capLang); if (t) el.textContent = t; });
  $('startLine').textContent = captionLine('start', capLang);
  if (talking) recognition?.stop();   // onend starts again in the new language
}

// ---------- sound sources ----------
const player = $('player');
player.addEventListener('play', async () => {
  try { await audio.startPlayer(); audio.setSynthetic(false); syntheticLabel(); $('audioStatus').textContent = 'Suno demo playing → analysed live' + (audio.micOn ? ' · room mic listening alongside' : '.'); }
  catch { player.pause(); $('audioStatus').textContent = 'The audio engine could not start. Press play again.'; }
});
player.addEventListener('ended', () => { if (!playlist.auto) return; const t = playlist.next(); if (t) loadTrack(t, true); });
player.addEventListener('error', () => { $('audioStatus').textContent = 'That track could not load. Check the download or pick another.'; });
function loadTrack(track, play) {
  if (!track) return;
  player.src = '../' + track.src; $('track').value = track.src;
  if (play) Promise.all([audio.startPlayer(), player.play()]).catch(() => { $('audioStatus').textContent = 'Track selected. Press play.'; });
}
async function tracks() {
  try {
    let r = null;
    try { r = await fetch('../music/manifest.json', { cache: 'no-store' }); if (!r.ok) r = null; } catch { /* offline */ }
    if (!r && 'caches' in window) r = await caches.match(new URL('../music/manifest.json', location.href).href);
    if (!r) throw Error();
    const list = await r.json(); playlist.setTracks(list);
    $('track').replaceChildren(new Option('Pick a Suno demo', ''));
    for (const t of list) $('track').add(new Option(t.title + (t.duration ? ` · ${Math.round(t.duration)} s` : ''), t.src));
    if (!list.length) $('track').options[0].text = 'Suno demos are still generating. Reload later.';
  } catch { $('track').replaceChildren(new Option('Demo tracks not available yet', '')); }
}
$('track').onchange = () => { const i = playlist.tracks.findIndex(t => t.src === $('track').value); if (i >= 0) loadTrack(playlist.select(i), true); };
$('playSong').onclick = () => {
  if (!player.src) { const t = playlist.current(); if (!t) { $('audioStatus').textContent = 'No demo loaded yet.'; return; } loadTrack(t, true); return; }
  if (player.paused) Promise.all([audio.startPlayer(), player.play()]).catch(() => { $('audioStatus').textContent = 'Use the player controls to start.'; }); else player.pause();
};
$('playlistAuto').onclick = () => { playlist.auto = !playlist.auto; $('playlistAuto').textContent = 'Auto-advance: ' + (playlist.auto ? 'on' : 'off'); $('playlistAuto').setAttribute('aria-pressed', String(playlist.auto)); };
$('playlistLoop').onclick = () => { playlist.loop = !playlist.loop; $('playlistLoop').textContent = 'Loop: ' + (playlist.loop ? 'on' : 'off'); $('playlistLoop').setAttribute('aria-pressed', String(playlist.loop)); };
tracks();
const SHARE_HINT = "Pick a Chrome tab and tick 'Share tab audio', or 'Entire screen' with 'Share system audio' (Chrome 141+ on macOS 14.2+).";
let systemBusy = false;
$('systemAudio').onclick = async () => {
  if (systemBusy) return;
  if (audio.systemOn) { audio.stopSystem(); systemLabel(); bump(); $('audioStatus').textContent = 'Computer music off.'; return; }
  systemBusy = true; $('systemAudio').disabled = true; $('audioStatus').textContent = 'Choose what to share…';
  const r = await audio.startSystem();
  systemBusy = false; $('systemAudio').disabled = false; systemLabel(); bump();
  if (r.ok) { player.pause(); $('audioStatus').textContent = 'Computer music → analysed live, never recorded or uploaded' + (audio.micOn ? ' · room mic listening alongside.' : '.'); }
  else if (r.reason === 'unsupported') $('audioStatus').textContent = 'Computer music needs Chrome (a shared tab on any version; system audio on 141+ with macOS 14.2+). ' + SHARE_HINT;
  else if (r.reason === 'no-audio') $('audioStatus').textContent = 'Nothing shared audio. ' + SHARE_HINT;
  else $('audioStatus').textContent = 'Sharing cancelled. ' + SHARE_HINT;
};
function systemLabel() { $('systemAudio').textContent = 'Computer music: ' + (audio.systemOn ? 'on' : 'off'); $('systemAudio').setAttribute('aria-pressed', String(audio.systemOn)); }
audio.onSystemEnded = () => { systemLabel(); bump(); $('audioStatus').textContent = 'Computer music stopped: sharing ended. ' + SHARE_HINT; };
let micBusy = false;
$('roomMic').onclick = async () => {
  if (micBusy) return;
  if (audio.micOn) { audio.stopMic(); micLabel(); $('audioStatus').textContent = 'Room mic off.'; return; }
  micBusy = true; $('roomMic').disabled = true;
  const ok = await audio.startMic();
  micBusy = false; $('roomMic').disabled = false; micLabel();
  $('audioStatus').textContent = ok ? 'Room mic listening · analysed locally, never recorded or uploaded.' : 'Room mic unavailable; agency from gestures only. Check permission and localhost/HTTPS.';
};
function micLabel() { $('roomMic').textContent = 'Room mic: ' + (audio.micOn ? 'on' : 'off'); $('roomMic').setAttribute('aria-pressed', String(audio.micOn)); }
$('synthetic').onclick = () => { audio.setSynthetic(!audio.synthetic); syntheticLabel(); $('audioStatus').textContent = audio.synthetic ? 'Synthetic beat · not real audio, for testing the engine.' : 'Synthetic beat off.'; };
function syntheticLabel() { $('synthetic').textContent = 'Synthetic beat: ' + (audio.synthetic ? 'on' : 'off'); $('synthetic').setAttribute('aria-pressed', String(audio.synthetic)); }

// ---------- requests (local phrases, then JEV) ----------
function handleRequest(action) {
  const actions = requestActions(action, { sceneLocked, symmetry: depthToAxes(depth).fold });
  for (const a of actions) {
    if (a.type === 'slider') { if (a.id === 'speed') setDepth(depth + (a.value < 1 ? -0.25 : 0.25)); else if (a.id === 'intensity') setDepth(depth - 0.2); }
    else if (a.type === 'camera') setShipMode('hover');
    else if (a.type === 'lockScene') toggleLock(a.value);
    else if (a.type === 'symmetry') setDepth(a.value / 8);
    else if (a.type === 'note') $('decision').textContent = a.text;
  }
  if (actions.length && !actions.some(a => a.type === 'note')) $('decision').textContent = 'request → ' + action.replace('_', ' ');
}
function localCommand(text) {
  const t = text.toLowerCase(), is = re => re.test(t); let handled = false; const said = [];
  if (is(/帶我返嚟|帶我回來|返嚟|回來|bring me back|take me back|ground me/)) { setGround(true); return true; }
  if (grounded && is(/繼續|continue|onward|go on|冇事|沒事/)) { setGround(false); return true; }
  if (is(/pause|stop|暫停|停/)) { setPause(true); caption(captionLine('pause', capLang)); return true; }
  if (is(/resume|continue|繼續/)) { setPause(false); caption(captionLine('resume', capLang)); return true; }
  // A world you name in words: go now (unless the scene is locked). A planet, the Earth or space means Life's planet.
  for (const [re, scene] of [[/fish|bird|flock|魚|鳥|海/, 'boids'], [/mycel|network|菌|網/, 'physarum'], [/firefl|sync|螢|同步|星系|galaxy/, 'swarm'], [/\blife\b|cell|生命|planet|earth|星球|地球|太空|space/, 'life']]) if (is(re)) {
    if (sceneLocked) $('decision').textContent = 'The scene is locked; unlock it to travel.';
    else if (scene !== world) { startJump(scene, { manual: true }); said.push(worldName(scene, capLang)); }
    handled = true; break;
  }
  // 太快 is a complaint, not a wish for more: "too fast" asks for slower, "too slow" for faster.
  if (is(/太快|too fast|快過頭|快得滯/)) { handleRequest('slower'); said.push(captionLine('slower', capLang)); handled = true; }
  else if (is(/太慢|too slow|慢過頭|慢得滯/)) { handleRequest('faster'); said.push(captionLine('faster', capLang)); handled = true; }
  else {
    if (is(/slow|慢/)) { handleRequest('slower'); said.push(captionLine('slower', capLang)); handled = true; }
    if (is(/fast|快/)) { handleRequest('faster'); said.push(captionLine('faster', capLang)); handled = true; }
  }
  if (is(/surround|inside|around me|包圍|hover|stop moving/)) { setShipMode('hover'); said.push(captionLine('hover', capLang)); handled = true; }
  if (is(/fly|launch|take off|飛|出發/)) { setShipMode('ship'); said.push(captionLine('fly', capLang)); handled = true; }
  if (is(/lead me|take over|帶/)) { director.initiative.setBaseline(0.6); setAuto(true); handled = true; }
  if (is(/follow me|跟我|跟住我/)) { director.initiative.setBaseline(-0.6); setAuto(true); handled = true; }
  const view = shotForWords(t);
  if (view) { pickShot(view); handled = true; }
  if (is(/hold|stay|don.t change|唔好轉|keep/)) { toggleLock(true); said.push(captionLine('hold', capLang)); handled = true; }
  if (is(/deeper|more symmetry|kaleid|對稱/)) { setDepth(depth + 0.2); said.push(captionLine('deeper', capLang)); handled = true; }
  if (is(/shallower|less symmetry|no symmetry|calm|gentle|靜|冷靜/)) { setDepth(depth - 0.2); said.push(captionLine('calmer', capLang)); handled = true; }
  if (is(/rewind|reset|again|snow|雪|重來/)) { rewind('voice'); said.push(captionLine('rewind', capLang)); handled = true; }
  const mood = spokenMood(t);
  if (mood) { director.setMood(mood); said.push(decisionCaption({ mood }, { world, lang: capLang })); handled = true; }
  if (handled) { bump(); caption(said.filter(Boolean).slice(0, 2).join(' · ')); }
  return handled;
}
function jevState(text = '') {
  return buildState({
    scene: world, sceneAge: director.sceneAge, arc: { name: director.arcs.arcName, waypoint: director.arcs.index },
    features: { E_mean30: summary.E30, E_trend: summary.E5 - summary.E30, C_mean30: summary.C30, B_mean30: summary.B30, A_mean30: summary.A30, bpm: musicF ? musicF.bpm : 0 },
    initiative: { I: director.initiative.I, locked: director.initiative.locked, I0: director.initiative.I0 },
    locks: { scene: sceneLocked }, userText: text, recentDecisions, online: navigator.onLine,
  });
}
async function askJev(text = '', force = false) {
  lastJevAsk = simClock;
  const decision = await jev.maybeRequest(() => jevState(text), { force });
  if (!decision) {
    if (jev.lastError) { jevStatus = 'offline'; $('decision').textContent = `JEV unavailable (${jev.lastError}); local rules continue. ${location.protocol === 'https:' ? 'JEV tries again shortly.' : 'JEV needs the local server: run scripts/start-flow.sh (or double-click start-flow.command).'}`; }
    return;
  }
  jevStatus = 'ok';
  director.applyDecision(decision);
  if (text) {
    // You asked in words: what JEV chose happens now, not at the next phrase, and talking does not block it.
    if (decision.scene && decision.scene.choice !== world && decision.scene.p >= 0.5) startJump(decision.scene.choice, { manual: true });
    if (decision.palette) director.setPalette(decision.palette);
    if (decision.mood) director.setMood(decision.mood);
    if (decision.view) pickShot(decision.view);
  } else if (decision.view) shots.queue(decision.view);   // on its own, JEV picks the next view when the shot changes
  const said = [];
  if (decision.scene && decision.scene.choice !== world && (text ? decision.scene.p >= 0.5 : decision.scene.p >= 0.6)) said.push(WORLD_NAMES[decision.scene.choice] || decision.scene.choice);
  if (decision.view) said.push((Object.values(SHOTS).flat().find(s => s.name === decision.view) || {}).label || decision.view);
  if (decision.mood) said.push(decision.mood);
  if (decision.palette) said.push(decision.palette);
  if (typeof decision.energy === 'number') said.push(decision.energy > 0.6 ? 'more energy' : decision.energy < 0.35 ? 'calmer' : 'steady');
  jevSaid = 'JEV → ' + (said.join(' · ') || 'keep going'); jevSaidUntil = simClock + 6; jevPulse = 1;
  caption(decisionCaption(decision, { world, lang: capLang, asked: !!text }));
  const applied = Object.keys(decision).filter(k => !['version', 'confidence', 'hold'].includes(k));
  const left = Object.keys(decision.confidence || {}).filter(k => !applied.includes(k));
  const line = `JEV: ${applied.map(k => k === 'scene' ? `scene→${decision.scene.choice} (${Math.round(decision.scene.p * 100)}%)` : `${k}=${typeof decision[k] === 'number' ? decision[k].toFixed(2) : decision[k]}`).join(' · ') || 'no change'}` +
    (decision.hold !== undefined ? ` · hold ${Math.round(decision.hold * 100)}%` : '') + (left.length ? ` · left local: ${left.join(', ')}` : '');
  recentDecisions.push(line.slice(0, 120)); while (recentDecisions.length > 3) recentDecisions.shift();
  $('decision').textContent = line;
}
$('jev').onclick = () => { jev.enabled = !jev.enabled; jevStatus = jev.enabled ? 'connecting' : 'off'; jev.bump(); if (!jev.enabled) director.clearMood(); $('jev').textContent = 'JEV: ' + (jev.enabled ? 'on' : 'off'); $('jev').setAttribute('aria-pressed', String(jev.enabled)); if (jev.enabled) askJev('', true); else $('decision').textContent = 'Local director running.'; };
// Hosted: a guest never has to find the switch. The probe is the empty POST start-flow.sh also uses to recognise the server.
if (location.protocol === 'https:' || QUIET) fetch('/api/decide', { method: 'POST' }).then(r => r.status, () => null).then(status => { if (shouldAutoEnable({ protocol: location.protocol, probeStatus: status, quiet: QUIET }) && !jev.enabled) $('jev').onclick(); });
function decide(text = '') {
  // A short command is handled here; a longer sentence also goes to JEV (when on), so a stray word like 慢 inside it
  // does not swallow the rest of what you said.
  const sentence = text && (text.trim().split(/\s+/).length > 3 || /[\u3400-\u9fff]/.test(text) && text.replace(/\s/g, '').length > 6);
  if (text && localCommand(text)) {
    $('decision').textContent = 'Applied locally: ' + text;
    if (sentence && jev.enabled && navigator.onLine) { $('decision').textContent += ' · asking JEV for the rest…'; askJev(text, true); }
    return;
  }
  if (!text) { $('decision').textContent = 'Local director running.'; return; }
  if (jev.enabled && navigator.onLine) { $('decision').textContent = 'Asking JEV…'; askJev(text, true); return; }
  $('decision').textContent = 'Not a local phrase. Try: dream, melt, electric, clear, holy (夢 溶 勁 清 神聖), slower, faster, fish, mycelium, fireflies, life, hover, fly, lead me, follow me, hold, deeper, calm, rewind. Turn JEV on for free-form requests.';
}
$('commandForm').onsubmit = e => { e.preventDefault(); const text = $('command').value.trim(); $('command').value = ''; if (text) { hearText(text); decide(text); } };
window.__flow.askJev = askJev; window.__flow.jevState = jevState;
const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition; let recognition = null;
if (!Recognition) { $('listen').disabled = true; $('listen').textContent = 'Type a request'; }
else $('listen').onclick = () => setTalk(!talking);
// Talk: keep listening for words until switched off. Each finished sentence goes to the local phrases, then to JEV.
// Chrome's speech recognition sends the audio to Google while Talk is on; the room-mic analysis never leaves this machine.
let talking = false;
function setTalk(on) {
  talking = on; $('listen').textContent = 'Talk: ' + (on ? 'on' : 'off'); $('listen').setAttribute('aria-pressed', String(on));
  document.body.classList.toggle('listening', on);
  if (!on) { recognition?.stop(); recognition = null; $('decision').textContent = 'Talk off.'; return; }
  caption(captionLine('listening', capLang), 2); caption(captionLine('hint', capLang), 5); hintAt = simClock + 90;   // now it is true
  $('decision').textContent = 'Talk on · speak freely. Chrome sends your speech to Google to turn it into words while Talk is on.' + (jev.enabled ? '' : ' Turn JEV on for free-form requests.');
  startRecognition();
}
function startRecognition() {
  if (!talking) return;
  const r = recognition = new Recognition(); r.lang = $('talkLang').value; r.continuous = true; r.interimResults = false;
  r.onresult = e => { for (let i = e.resultIndex; i < e.results.length; i++) if (e.results[i].isFinal) { const text = e.results[i][0].transcript.trim(); if (text) { hearText(text); decide(text); } } };
  r.onerror = e => { if (e.error === 'not-allowed' || e.error === 'service-not-allowed' || e.error === 'audio-capture') { setTalk(false); $('decision').textContent = 'Talk needs microphone permission (and Chrome online). Type the request instead.'; if (simClock - noMicSaid > 30) { noMicSaid = simClock; caption(captionLine('noMic', capLang), 4); } } };
  r.onend = () => { if (talking && recognition === r) setTimeout(startRecognition, 300); };   // Chrome stops after a silence: listen again
  try { r.start(); } catch { /* already started */ }
}
$('talkLang').onchange = () => { if (talking) { recognition?.stop(); } };
function hearText(text) { heard = String(text).slice(0, 40); heardUntil = simClock + 4; lastSpoken = simClock; touch(); }
setLanguage(talkLanguage(navigator.language));   // after Talk's state exists: the ear's dialect and the captions' script follow the browser
window.__flow.decide = decide;

// ---------- the frame ----------
function stepSims(h, out) {
  const energy = (musicF ? musicF.E : 0) * 0.8, sim = sims[world], pull = attractor && simClock < attractorUntil ? attractor : null;
  if (world === 'physarum') sim.step(h, energy, pull);
  else if (world === 'swarm') sim.step(h, energy, 0.7, pull);
  else if (world === 'boids') sim.step(h, energy, pull);
  else { lifeAcc += h * (out.hud.bpm / 60) * sims.life.generationsPerBeat; while (lifeAcc >= 1) { sims.life.step(); lifeAcc--; } }
  liveliness.observe(world, sim.activity, h);
}
function dispatchEvents(out) {
  const sim = sims[world], beatSeconds = 60 / Math.max(60, out.hud.bpm);
  if (out.events.beat) {
    if (world === 'physarum') sim.burst(3);
    else if (world === 'swarm') sim.kick(0.3 * Math.max(0.3, out.pulse), 1 / 3, Math.random);
    else if (world === 'boids') sim.gust(15, Math.random);
  }
  if (out.events.accent) {
    if (world === 'physarum') sim.food(Math.random(), Math.random(), 12);
    else if (world === 'swarm') sim.inject(Math.random, beatSeconds);
    else if (world === 'boids') sim.inject(Math.random);
    else sim.seedEdgeGlider(Math.random);
  }
  if (out.events.phrase) {
    if (world === 'physarum') sim.breathe(0.3, 4, beatSeconds);
    else if (world === 'boids') { sim.turnWind(90); sim.targetHeight((0.5 - summary.B30) * 6); }
    else if (world === 'life') sim.stripe(Math.random() < 0.5 ? 'x' : 'y', Math.random);
  }
  if (out.injection) sim.inject(Math.random, beatSeconds);
}
function userState() {
  const axes = depthToAxes(depth);
  return { H: 0.5, T: 0.5, D: 0.5, S: axes.fold, F: axes.feedback, hue: 0, camera: ship.mode === 'ship' ? 'flight' : 'orbit', sceneLocked };
}
let lastHUD = 0, lastExplain = 0;
function animate() {
  const raw = clock.getDelta(), dt = Math.min(raw, 0.1);
  if (renderer.xr.isPresenting) { vrMeter.record(raw); if (grips.tick(performance.now()) === 'leave') xrSession?.end(); }
  if (raw > 0) fps += (1 / raw - fps) * 0.05;
  if (document.hidden && !renderer.xr.isPresenting) return;
  frame(dt);
}
function frame(dt) {
  simClock += dt; const now = simClock;
  if (!QUIET && now - lastInteraction > 3 && !document.body.classList.contains('idle') && $('drawer').hidden) document.body.classList.add('idle');
  stepCaptions(); stepHints();
  act(gestures.tick(performance.now()));
  const frames = audio.frames(now);
  ensureFeatures(frames.sampleRate);
  musicF.update(frames.music, dt); roomF.update(frames.room, dt);
  const L = window.__flow.forceLiveliness ?? liveliness.value(world);
  const input = directorInput({ frames, musicF, roomF, latency: audio.latency(), gestures: gestureCount, user: userState(), online: navigator.onLine, paused });
  input.liveliness = L;
  const out = director.update(dt, input);
  gestureCount = 0;
  const k30 = 1 - Math.exp(-dt / 30), k5 = 1 - Math.exp(-dt / 5);
  summary.E30 += (out.hud.E - summary.E30) * k30; summary.E5 += (out.hud.E - summary.E5) * k5;
  summary.C30 += (out.hud.C - summary.C30) * k30; summary.B30 += ((musicF ? musicF.B : 0) - summary.B30) * k30; summary.A30 += (out.As - summary.A30) * k30;
  if (out.request) handleRequest(out.request);
  if (jev.enabled && navigator.onLine && !paused && now - lastJevAsk >= 24) askJev('');
  const sim = sims[world];
  sim.setParams({ H: out.targets.H, T: Math.min(1, out.targets.T), D: out.targets.D });
  if (!paused && !dissolving) dispatchEvents(out);
  if (out.rewind) rewind('metabolism');
  if (out.sceneChange) startJump(out.sceneChange);
  const energyTrend = summary.E5 - summary.E30;
  if (!paused) ship.update(dt, { T: out.targets.T, pulse: out.pulse, intensity: 0.8, phraseBoundary: out.phraseBoundary, energyTrend, C: out.hud.C, drop: energyTrend < -0.12 });
  if (jump && !paused) updateJump(dt);
  const axes = depthToAxes(depth);
  if (!paused) {
    const step = dt * axes.speed * (0.5 + out.targets.T);
    simTime += step; acc += step;
    const t0 = performance.now(); let steps = 0;
    if (dissolving) { if (dissolving.ring.update(dt, sims[dissolving.id].state(), { discrete: dissolving.id === 'life' ? [0, 1] : [] }) >= 1) { sims[dissolving.id].resync?.(); dissolving = null; } acc = 0; }
    else while (acc >= 1 / 30) { stepSims(1 / 30, out); acc -= 1 / 30; steps++; }
    const t1 = performance.now();
    const speed = ship.speed * (jump ? 3 : 1), dz = speed * dt;
    worlds.stream(dz); worlds.updateStars(speed, 2, ship.mode === 'ship' ? dz : 0);
    snapshotTimer += dt; if (snapshotTimer >= 20 && !dissolving) { snapshotTimer = 0; rings[world].capture(L, simClock); }
    if (!window.__flow.skipRender) worlds.render({ palette: out.targets.palette, hue: out.targets.hue, sat: axes.saturation, pulse: out.pulse, simTime, intensity: 0.8, dt });
    timing.step = t1 - t0; timing.steps = steps; timing.render = performance.now() - t1; timing.dt = dt;
  }
  if (window.__flow.skipRender) { if (now - lastHUD > 0.15) { lastHUD = now; updateHUD(out, frames, L); } return; }
  if (!renderer.xr.isPresenting) {
    if (ship.mode === 'ship') { camera.position.set(0, 0, 0); camera.rotation.set(ship.pitch * RAD, ship.yaw * RAD, ship.roll * RAD, 'YXZ'); camPos.set(0, 0, 0); if (camera.fov !== 65) { camera.fov = 65; camera.updateProjectionMatrix(); } scene.fog.density = 0.022; }
    else {
      // Hover: the shot's pose, eased so a change of shot is a glide, not a cut; a chase keeps up more tightly.
      const sim = sims[world], name = shots.shot.name; let target = [0, 0, 0], vel = [0, 0, 1];
      if ((world === 'swarm' || world === 'boids') && sim.active) {
        if (name === 'chase') { const i = Math.min(chaseIndex, sim.active - 1) * 3, v = world === 'boids' ? sim.v : sim.delta; target = [sim.p[i], sim.p[i + 1], sim.p[i + 2]]; vel = [v[i], v[i + 1], v[i + 2]]; }
        else { let cx = 0, cy = 0, cz = 0; for (let i = 0; i < sim.active; i++) { cx += sim.p[i * 3]; cy += sim.p[i * 3 + 1]; cz += sim.p[i * 3 + 2]; } target = [cx / sim.active, cy / sim.active, cz / sim.active]; }
      }
      const pose = shotPose(name, { t: simTime - shotStarted + 20, target, vel, yaw: orbit, zoom: zoom / 19 });
      shotGlide = Math.max(0, shotGlide - dt);
      const tau = name === 'chase' && shotGlide <= 0 ? 0.35 : shotGlide > 0 ? 1.4 : 0.6, k = 1 - Math.exp(-dt / tau);
      camPos.lerp(poseV.fromArray(pose.pos), k); camLook.lerp(poseV.fromArray(pose.look), k);
      camera.position.copy(camPos); camera.lookAt(camLook);
      const fogTo = name === 'distant' || name === 'far' || name === 'side' ? 0.005 : 0.022; scene.fog.density += (fogTo - scene.fog.density) * k;   // long shots see through the haze
      if (Math.abs(camera.fov - pose.fov) > 0.05) { camera.fov += (pose.fov - camera.fov) * k; camera.updateProjectionMatrix(); }
    }
  }
  if (renderer.xr.isPresenting) renderer.render(scene, camera);
  else {
    // v3: the director's state becomes a program (grammar), blended over time; gestures speak on top of it.
    const beatSeconds = 60 / Math.max(60, out.hud.bpm);
    if (!paused) {
      passages.update({ phrase: out.phraseBoundary, landed: landedFired }); landedFired = false;
      if (ship.mode === 'hover' && !jump) { shots.update({ phrase: out.phraseBoundary, world }); if (shots.changed) startShot(); }
    }
    const cleanShot = ship.mode === 'hover' && !jump && shots.shot.clean, rawNow = passages.raw || cleanShot;
    // Your voice (room speech or a clap; the mic alone plays both roles): analysed here, never recorded or sent.
    const roomSpeech = frames.room ? roomF.speech : frames.source === 'mic' ? musicF.speech : 0;
    const roomClap = frames.room ? roomF.onset : frames.source === 'mic' ? musicF.onset : 0;
    jevPulse = Math.max(0, jevPulse - dt / 1.5);
    const voice = Math.max(window.__flow.forceVoice ?? (paused ? voiceEnv.value : voiceEnv.update(dt, { speech: roomSpeech, onset: roomClap })), 0.8 * jevPulse);   // you, or JEV answering
    programFor({ I: out.I, A: out.As, E: out.hud.E, C: out.hud.C, H: out.targets.H, L, heat: out.heat, ship: ship.mode, diving: ship.diving, jump: !!jump, calm, arcS: out.arcS, world, raw: rawNow, voice }, depth, target);
    // The arc's F axis biases the echo decay by ±0.2 around the arcs' neutral 0.3. (Its S axis has no room: Depth is
    // both the fold's floor (v2) and its ceiling (v3), so the fold is Depth's whenever the world leads.)
    target.echoDecay = Math.max(0, Math.min(1, target.echoDecay + 0.2 * Math.max(-1, Math.min(1, (out.targets.F - 0.3) / 0.7))));
    if (out.mood) applyMood(target, out.mood, 0.6);
    capProgram(target, depth);
    // Gestures listen to *your* onsets (the room), never the music's (spec §4.2).
    const roomOnset = frames.room ? roomF.onset : frames.source === 'mic' ? musicF.onset : 0;
    const g = paused ? visualGestures : visualGestures.update(dt, { I: out.I, A: out.As, surprise: out.surprise, beatSeconds }, { onset: roomOnset, rewind: rewindFired, jump: jumpFired });
    if (!paused) { rewindFired = false; jumpFired = false; }   // one-shot flags wait for a frame that can deliver them
    if (prevGesture && !g.active) lastGestureEnd = now;
    prevGesture = g.active;
    // Continuous parameters approach the target over ~2 s; discrete ones step on phrase boundaries, when a gesture
    // overrides them, and when a jump starts or lands.
    const kb = !programStarted ? 1 : paused ? 0 : jump ? 1 - Math.exp(-dt / 0.3) : 1 - Math.exp(-dt / 2);   // hyperspace arrives fast; everything else over ~2 s; paused holds
    for (const k of CONTINUOUS) current[k] += (target[k] - current[k]) * kb;
    const discreteOverride = !!g.active && DISCRETE.some(k => k in g.overrides);
    if (!programStarted || out.phraseBoundary || discreteOverride || !!jump !== lastJump || depthTouched) for (const k of DISCRETE) current[k] = target[k];
    programStarted = true; lastJump = !!jump; depthTouched = false;
    current.ripple = target.ripple;   // the voice answers at once, not over the 2 s blend
    Object.assign(program, current);
    for (const k in g.overrides) {
      const v = g.overrides[k];
      if (k === 'formDensity') program.formDensity = current.formDensity * (1 - g.env);
      else if (typeof v !== 'number' || DISCRETE.includes(k)) program[k] = v;
      else program[k] = Math.max(k === 'formDrift' ? -1 : 0, Math.min(1, current[k] + v));
    }
    Object.assign(program, window.__flow.forceProgram);
    capProgram(program, depth);   // Depth caps gestures too
    if (rawNow && !jump) { program.fold = 0; program.mirror = 'none'; program.formContrast = 0; program.tunnel = 0; }   // a raw passage stays raw under gestures
    if (calm) { program.chromaSplit = 0; program.chromaCycle = 0; program.gain = Math.min(program.gain, 0.5); }   // calm holds against gestures, moods and the debug hook
    if (!paused) phases.advance(dt, program);   // a paused picture holds still
    // Quality drops to half after two seconds under 50 fps and returns after five good seconds.
    if (fps < 50) { lowFpsFor += dt; highFpsFor = 0; } else { lowFpsFor = 0; if (fps > 57) highFpsFor += dt; }
    if (lowFpsFor > 2 && quality > 0.5) { quality = 0.5; lowFpsFor = 0; } else if (highFpsFor > 5 && quality < 1) { quality = 1; highFpsFor = 0; }
    // Fold cross-fades: one beat around a gesture, 1 s for jumps and dives, otherwise a phrase (16 beats, at most 8 s).
    const fadeSeconds = g.active || now - lastGestureEnd < 2 * beatSeconds ? Math.min(1, beatSeconds) : jump || ship.diving ? 1 : Math.min(8, 16 * beatSeconds);
    const tPost = performance.now();
    post.render(scene, camera, program, { pulse: out.pulse, beatPhase: out.phase, phases: phases.wrapped(), dt, quality, fadeSeconds });
    timing.post = performance.now() - tPost;
  }
  if (now - lastHUD > 0.15) { lastHUD = now; updateHUD(out, frames, L); }
  if (!$('explain').hidden && now - lastExplain > 0.5) { lastExplain = now; updateExplain(out, L); }
}
function updateHUD(out, frames, L) {
  const bars = $('meters').querySelectorAll('i');
  [musicF.bands.bass, musicF.bands.mid, musicF.bands.high].forEach((v, i) => bars[i].style.height = (2 + v * 38) + 'px');
  $('phaseDot').style.opacity = (0.15 + 0.85 * out.pulse).toFixed(2);
  $('roomDot').style.opacity = frames.room ? (0.15 + 0.85 * Math.max(roomF.speech, roomF.onset)).toFixed(2) : '0.05';
  $('stats').textContent = (frames.music ? `${frames.source.toUpperCase()} · B ${musicF.bands.bass.toFixed(2)} M ${musicF.bands.mid.toFixed(2)} H ${musicF.bands.high.toFixed(2)}` : '') + ` · ${Math.round(fps)} fps`;
  if (autoInitiative) placeDot(out.I); else placeDot(director.initiative.I);
  const sound = audio.context && audio.context.state === 'running';
  const sign = out.I >= 0 ? '+' : '';
  let line = `${out.hud.leading} ${sign}${out.I.toFixed(2)}`;
  if (ship.mode === 'hover') line += ' · ' + shots.shot.label;
  if (!sound && !audio.synthetic) line += ' · tap to start sound';
  else if (frames.music) line += ` · ${Math.round(out.hud.bpm)} BPM · C ${out.hud.C.toFixed(2)}`;
  line += ` · life ${L.toFixed(2)}` + (out.heat > 0 ? ` · heat +${out.heat.toFixed(2)}` : '') + (dissolving ? ' · REWIND' : '') + (jump ? ' · JUMP' : '') + (ship.diving ? ' · DIVE' : '') + (passages.raw && !jump ? ' · RAW' : '') + (visualGestures.active ? ' · ' + visualGestures.active.toUpperCase() : '') + (paused ? ' · PAUSED' : '');
  if (out.mood) line += ' · ' + out.mood.toUpperCase();
  if (simClock < heardUntil) line += ` · “${heard}”`;
  if (simClock < jevSaidUntil) line += ' · ' + jevSaid;
  line += !jev.enabled ? ' · LOCAL' : !navigator.onLine || jevStatus === 'offline' ? ' · JEV OFFLINE' : jevStatus === 'ok' ? ' · JEV' : ' · JEV…';
  $('hud').textContent = line;
}
function updateExplain(out, L) {
  const src = out.hud.source, cls = s => `<dd class="${s}">${s}</dd>`, axes = depthToAxes(depth);
  const life = world === 'life' ? `<p>Life: ${sims.life.pure ? 'pure B3/S23, no perturbation' : `creative variant · ${sims.life.perturbations} random births so far`}</p>` : '';
  $('explain').innerHTML = `<h3>WHO IS STEERING</h3><dl>
<dt>H entropy</dt>${cls(src.H)}<dt>T tempo</dt>${cls(src.T)}<dt>D density</dt>${cls(src.D)}<dt>S fold</dt>${cls(src.S)}<dt>F feedback</dt>${cls(src.F)}<dt>P palette</dt>${cls(src.P)}</dl>
<p>Initiative ${out.I.toFixed(2)} (${autoInitiative ? 'auto, baseline ' + director.initiative.I0.toFixed(1) : 'locked'}) · agency ${out.As.toFixed(2)}<br>Arc ${out.hud.arc} · waypoint ${out.hud.waypoint + 1}${director.arcs.pinned ? ' · pinned' : ''}<br>Entropy target ${out.hTarget.toFixed(2)} ± ${out.hWidth.toFixed(2)} → ${out.targets.H.toFixed(2)} · heat +${out.heat.toFixed(2)}<br>Liveliness ${L.toFixed(2)} (ref ${liveliness.reference(world).toFixed(3)}) · snapshots ${rings[world].count} · ${rewindNote || 'no rewind yet'}<br>Ship ${ship.mode} · ${ship.speed.toFixed(1)} u/s · ${ship.diving ? 'DIVING' : 'level'} · yaw ${ship.yaw.toFixed(0)}° pitch ${ship.pitch.toFixed(0)}° roll ${ship.roll.toFixed(0)}°${jump ? ' · jump ' + jump.t.toFixed(1) + ' s' : ''}<br>Depth ${depth.toFixed(2)} → fold ${axes.fold} · feedback ${axes.feedback.toFixed(2)} · sat ×${axes.saturation.toFixed(2)} · speed ×${axes.speed.toFixed(2)}<br>Beat ${Math.round(out.hud.bpm)} BPM · coherence ${out.hud.C.toFixed(2)} · world phase ${out.I >= 0 ? 'ahead' : 'behind'} by ${Math.round(Math.abs(out.I) * 0.12 * 60000 / Math.max(60, out.hud.bpm))} ms<br>Novelty budget ${director.N.toFixed(2)}<br>Program: forms ${program.formKind} ${program.formDrift >= 0 ? 'in' : 'out'} ${Math.abs(program.formDrift).toFixed(2)} · fold ${program.fold} · mirror ${program.mirror} · warp ${program.warp.toFixed(2)} · tunnel ${program.tunnel.toFixed(2)} · echo ${program.echoDecay.toFixed(2)} · droste ${program.droste.toFixed(2)} · contour ${program.contour.toFixed(2)} · chroma ${program.chromaSplit.toFixed(2)} · quality ${quality}<br>Gesture ${visualGestures.active ? `${visualGestures.active} (${visualGestures.env.toFixed(2)})` : 'none'} · mood ${out.mood ? out.mood + ' (jev)' : 'none'} · passage ${passages.raw ? 'raw (the world itself)' : `dressed ${passages.count + 1}/${passages.dressed}`} · signature ${world} · arc S ${out.arcS} → fold (Depth cap ${FOLDS[Math.round(depth * 4)]}) · arc F ${out.targets.F.toFixed(2)} → echo ±0.2${calm ? ' · CALM' : ''}</p>
<p>${WORLDS[world][3]}</p>${life}`;
}

// ---------- network, offline, XR, cleanup ----------
function network() { $('network').textContent = navigator.onLine ? 'LOCAL ENGINE · ONLINE AVAILABLE' : 'OFFLINE · LOCAL DIRECTOR'; }
network(); addEventListener('online', () => { network(); bump(); }); addEventListener('offline', () => { network(); bump(); $('decision').textContent = 'Offline: local director continues; JEV answers are dropped.'; });
addEventListener('pageshow', e => { if (e.persisted) location.reload(); });
if ('serviceWorker' in navigator) navigator.serviceWorker.register('../sw.js').catch(() => { $('offlineStatus').textContent = 'Offline cache unavailable; use localhost or HTTPS.'; });
$('offline').onclick = async () => {
  let timer, port;
  try {
    if (!('serviceWorker' in navigator)) throw Error();
    $('offline').disabled = true; $('offlineStatus').textContent = 'Downloading core and music assets…';
    await new Promise(async (resolve, reject) => {
      timer = setTimeout(() => reject(Error('timeout')), 60000);
      try { const ready = await navigator.serviceWorker.ready; const channel = new MessageChannel(); port = channel.port1; port.onmessage = e => e.data.ok ? resolve() : reject(Error('cache failed')); ready.active.postMessage({ type: 'CACHE_OFFLINE' }, [channel.port2]); }
      catch (e) { reject(e); }
    });
    $('offlineStatus').textContent = 'Offline assets ready: worlds, engine and the finished demos.';
  } catch { $('offlineStatus').textContent = 'Download did not finish. Check the connection and browser support, then retry.'; }
  finally { clearTimeout(timer); port?.close(); $('offline').disabled = false; }
};
const vrMeter = new FrameMeter();
let vrSupported = false;
// The headset line on the glass (2026-11-03): shown where immersive VR runs, hidden while a session runs.
function showVrLine() { $('vrEntry').hidden = !QUIET || !headsetLine({ supported: vrSupported, presenting: !!xrSession }); }
async function enterVR() {
  if (xrSession) { await xrSession.end(); return false; }
  try { xrSession = await navigator.xr.requestSession('immersive-vr', { optionalFeatures: ['local-floor'] }); }
  catch { xrSession = null; $('vr').textContent = 'VR did not start, retry'; return false; }
  vrMeter.reset(); grips.reset();
  setShipMode('hover'); camera.position.set(0, 1.6, 0); camera.rotation.set(0, 0, 0); await renderer.xr.setSession(xrSession); $('vr').textContent = 'Leave VR'; showVrLine();
  xrSession.addEventListener('end', () => { xrSession = null; const ran = frameLine(vrMeter.summary(), capLang); $('vr').textContent = ran ? 'Enter Quest VR · ' + ran : 'Enter Quest VR'; if (ran) { $('decision').textContent = ran; caption(ran, 8, { essential: true }); } camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); showVrLine(); });
  return true;
}
async function setupXR() {
  try {
    if (!navigator.xr || !await navigator.xr.isSessionSupported('immersive-vr')) { $('vr').textContent = 'VR: needs a headset'; return; }
    vrSupported = true; $('vr').disabled = false; $('vr').textContent = 'Enter Quest VR'; $('vr').onclick = () => enterVR(); showVrLine();
  } catch { $('vr').textContent = 'VR unavailable'; }
}
setupXR();
// 進入 VR on the glass: the session first (it needs the touch), then the same beginning as 輕觸開始 minus fullscreen,
// and the built-in music unless a source was already chosen; the room mic stays open alongside (Bird, 2026-11-03).
$('vrLine').addEventListener('click', async () => {
  if (!await enterVR()) return;
  if (!started) begin({ fullscreen: false });
  if (soundSource === 'mic') setSoundSource('demo');
});
// In VR there is no glass to touch: the left trigger jumps to the next world at once, the right one flies or hovers;
// a short squeeze of either grip starts or stops the built-in music; a grip held one second leaves VR (帶我回來).
const grips = new GripHold();
function toggleMusic() {
  if (!player.paused) { player.pause(); return; }
  if (player.src) audio.startPlayer().then(() => player.play()).catch(() => {}); else setSoundSource('demo');
}
for (let i = 0; i < 2; i++) {
  const controller = renderer.xr.getController(i); scene.add(controller);
  controller.addEventListener('selectstart', () => {
    gestureCount++; touch();
    if (triggerAction(i) === 'world') { if (!jump) startJump(nextWorld(SCENES, world), { manual: true }); }
    else setShipMode(ship.mode === 'ship' ? 'hover' : 'ship');
  });
  controller.addEventListener('squeezestart', () => grips.down(i, performance.now()));
  controller.addEventListener('squeezeend', () => { if (grips.up(i, performance.now()) === 'music') toggleMusic(); });
}
addEventListener('pagehide', () => { recognition?.stop(); player.pause(); audio.close(); renderer.setAnimationLoop(null); worlds.dispose(); post.dispose(); renderer.dispose(); });

// ---------- start ----------
choose(world); setAuto(true); setShipMode('hover'); placeDot(director.initiative.I); setDepth(depth);
lastInteraction = Infinity; document.body.classList.remove('idle');   // nothing fades before the first real touch
renderer.setAnimationLoop(animate);
