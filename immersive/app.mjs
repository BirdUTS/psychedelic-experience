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
import { VisualGestures } from './engine/visual-gestures.mjs';
import { JevClient, buildState } from './engine/jev-client.mjs';
import { directorInput } from './engine/streams.mjs';
import { requestActions } from './engine/requests.mjs';
import { Liveliness } from './engine/liveliness.mjs';
import { SnapshotRing } from './engine/snapshots.mjs';
import { Ship } from './engine/ship.mjs';
import { depthToAxes } from './engine/depth.mjs';
import { Gestures } from './engine/gestures.mjs';
import { Worlds } from './worlds.mjs';

const $ = id => document.getElementById(id), RAD = Math.PI / 180;
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
const visualGestures = new VisualGestures(), phases = new Phases();

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
const gestures = new Gestures();
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
let calm = false, quality = 1, lowFpsFor = 0, highFpsFor = 0, programStarted = false, lastGestureEnd = -Infinity, prevGesture = null, rewindFired = false, jumpFired = false, lastJump = false, depthTouched = false, leavingByGlyph = false;
window.__flow = {
  director, audio, sims, worlds, ship, liveliness, rings, timing, jev, gestures, post, program, target, current, visualGestures, phases,
  forceProgram: null,   // a partial program merged over the computed one (checks)
  get calm() { return calm; }, set calm(v) { calm = !!v; $('calm').checked = calm; }, get quality() { return quality; }, immerse,
  get musicF() { return musicF; }, get roomF() { return roomF; }, get depth() { return depth; }, set depth(v) { setDepth(v); },
  forceLiveliness: null, skipRender: false,
  get jump() { return jump; }, get world() { return world; }, get dissolving() { return dissolving; },
  frame: dt => frame(dt), advance(seconds, dt = 1 / 60) { for (let t = 0; t < seconds; t += dt) frame(dt); return seconds; },
  rewind: () => rewind('manual'), launch: () => setShipMode('ship'), hover: () => setShipMode('hover'),
};

// ---------- worlds, scenes, snapshots ----------
function choose(id, { auto = false } = {}) {
  if (!WORLDS[id]) return;
  world = id; worlds.build(id, ship.mode, $('skin').value);
  const a = WORLDS[id];
  $('chapter').textContent = a[0]; $('worldTitle').innerHTML = a[1]; $('worldHint').textContent = a[2]; $('rule').textContent = a[3];
  document.querySelectorAll('[data-world]').forEach(b => { const on = b.dataset.world === id; b.classList.toggle('selected', on); b.setAttribute('aria-pressed', String(on)); });
  director.acknowledgeScene(id);
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
  jump = { t: 0, to: next, switched: false, rewindOnLand: false }; jumpFired = true;
}
function updateJump(dt) {
  jump.t += dt;
  if (!jump.switched && jump.t >= 2) { jump.switched = true; choose(jump.to, { auto: true }); }
  const u = jump.t < 2 ? jump.t / 2 : (jump.t - 2) / 2;
  group.scale.set(1, 1, jump.t < 2 ? 1 - 0.9 * u : 0.6 + 0.4 * Math.min(1, u));
  if (jump.t >= 4 || (jump.switched && world !== jump.to)) {   // never leave a jump hanging
    const land = jump.rewindOnLand; jump = null; group.scale.set(1, 1, 1);
    if (land) rewind('return');
  }
}
function setShipMode(mode) {
  if (mode === 'ship') ship.launch(); else ship.hover();
  worlds.build(world, ship.mode, $('skin').value);
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
      if (ship.mode === 'hover') { setShipMode('ship'); $('decision').textContent = 'Launched. Tap again to pulse; long-press the ring to hover.'; }
      else { director.agency.gesture(2); attractor = { x: action.x / innerWidth, y: action.y / innerHeight }; attractorUntil = simClock + 0.6; }
      break;
    case 'swipe': {
      if (action.dir === 'left' || action.dir === 'right') {
        const i = SCENES.indexOf(world), next = SCENES[(i + (action.dir === 'left' ? 1 : SCENES.length - 1)) % SCENES.length];
        director.requestScene(next); $('decision').textContent = `requested: ${next}` + (director.initiative.I > -0.5 ? ' · at the next phrase' : '');
      } else setDepth(depth + (action.dir === 'up' ? 0.1 : -0.1));
      break;
    }
    case 'longpress': toggleLock(); break;
    case 'twofinger': rewind('gesture'); break;
    case 'pinch': ship.trim((action.scale - 1) * 0.05); break;
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
  touch();
  switch (e.key) {
    case ' ': e.preventDefault(); act({ type: 'tap', x: innerWidth / 2, y: innerHeight / 2 }); break;
    case 'ArrowLeft': ship.steer(-8, 0); break; case 'ArrowRight': ship.steer(8, 0); break; case 'ArrowUp': ship.steer(0, -6); break; case 'ArrowDown': ship.steer(0, 6); break;
    case '[': act({ type: 'swipe', dir: 'right' }); break; case ']': act({ type: 'swipe', dir: 'left' }); break;
    case '+': case '=': setDepth(depth + 0.1); break; case '-': setDepth(depth - 0.1); break;
    case 'h': case 'H': toggleLock(); break; case 'r': case 'R': rewind('key'); break;
    case 'v': case 'V': setShipMode(ship.mode === 'ship' ? 'hover' : 'ship'); break;
    case 'p': case 'P': setPause(!paused); break;
    case 'Escape': if (!document.fullscreenElement) toggleDrawer(); break;   // in fullscreen the browser's Esc leaves it first
  }
});
const wake = () => { audio.resume(); };
addEventListener('pointerdown', wake); addEventListener('keydown', wake);

// ---------- drawer and setup controls ----------
function toggleDrawer(force) {
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
$('skin').onchange = () => { if (world === 'boids') worlds.build(world, ship.mode, $('skin').value); };
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
  const t = text.toLowerCase(), is = re => re.test(t); let handled = false;
  if (is(/pause|stop|暫停|停/)) { setPause(true); return true; }
  if (is(/resume|continue|繼續/)) { setPause(false); return true; }
  for (const [re, scene] of [[/fish|bird|flock|魚|鳥/, 'boids'], [/mycel|network|菌|網/, 'physarum'], [/firefl|sync|螢|同步/, 'swarm'], [/\blife\b|cell|生命/, 'life']]) if (is(re)) { director.requestScene(scene); handled = true; }
  if (is(/slow|慢/)) { handleRequest('slower'); handled = true; }
  if (is(/fast|快/)) { handleRequest('faster'); handled = true; }
  if (is(/surround|inside|around me|包圍|hover|stop moving/)) { setShipMode('hover'); handled = true; }
  if (is(/fly|launch|take off|飛|出發/)) { setShipMode('ship'); handled = true; }
  if (is(/lead me|take over|帶/)) { director.initiative.setBaseline(0.6); setAuto(true); handled = true; }
  if (is(/follow me|跟/)) { director.initiative.setBaseline(-0.6); setAuto(true); handled = true; }
  if (is(/hold|stay|don.t change|唔好轉|keep/)) { toggleLock(true); handled = true; }
  if (is(/deeper|more symmetry|kaleid|對稱/)) { setDepth(depth + 0.2); handled = true; }
  if (is(/shallower|less symmetry|no symmetry|calm|gentle|靜|冷靜/)) { setDepth(depth - 0.2); handled = true; }
  if (is(/rewind|reset|again|snow|雪|重來/)) { rewind('voice'); handled = true; }
  if (handled) bump();
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
  if (!decision) { if (jev.lastError) $('decision').textContent = `JEV unavailable (${jev.lastError}); local rules continue.`; return; }
  director.applyDecision(decision);
  const applied = Object.keys(decision).filter(k => !['version', 'confidence', 'hold'].includes(k));
  const left = Object.keys(decision.confidence || {}).filter(k => !applied.includes(k));
  const line = `JEV: ${applied.map(k => k === 'scene' ? `scene→${decision.scene.choice} (${Math.round(decision.scene.p * 100)}%)` : `${k}=${typeof decision[k] === 'number' ? decision[k].toFixed(2) : decision[k]}`).join(' · ') || 'no change'}` +
    (decision.hold !== undefined ? ` · hold ${Math.round(decision.hold * 100)}%` : '') + (left.length ? ` · left local: ${left.join(', ')}` : '');
  recentDecisions.push(line.slice(0, 120)); while (recentDecisions.length > 3) recentDecisions.shift();
  $('decision').textContent = line;
}
$('jev').onclick = () => { jev.enabled = !jev.enabled; jev.bump(); if (!jev.enabled) director.clearMood(); $('jev').textContent = 'JEV: ' + (jev.enabled ? 'on' : 'off'); $('jev').setAttribute('aria-pressed', String(jev.enabled)); if (jev.enabled) askJev('', true); else $('decision').textContent = 'Local director running.'; };
function decide(text = '') {
  if (text && localCommand(text)) { $('decision').textContent = 'Applied locally: ' + text; return; }
  if (!text) { $('decision').textContent = 'Local director running.'; return; }
  if (jev.enabled && navigator.onLine) { $('decision').textContent = 'Asking JEV…'; askJev(text, true); return; }
  $('decision').textContent = 'Not a local phrase. Try: slower, faster, fish, mycelium, fireflies, life, hover, fly, lead me, follow me, hold, deeper, calm, rewind. Turn JEV on for free-form requests.';
}
$('commandForm').onsubmit = e => { e.preventDefault(); const text = $('command').value.trim(); $('command').value = ''; if (text) decide(text); };
window.__flow.askJev = askJev; window.__flow.jevState = jevState;
const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition; let recognition = null;
if (!Recognition) { $('listen').disabled = true; $('listen').textContent = 'Type a request'; }
else $('listen').onclick = () => {
  if (recognition) { recognition.stop(); return; }
  recognition = new Recognition(); recognition.lang = navigator.language || 'en-US'; recognition.continuous = false; recognition.interimResults = false;
  recognition.onresult = e => decide(e.results[0][0].transcript);
  recognition.onend = () => { recognition = null; $('listen').textContent = 'Say a request'; };
  recognition.onerror = () => { $('decision').textContent = 'Speech recognition unavailable; type the request instead.'; };
  try { recognition.start(); $('listen').textContent = 'Listening…'; $('decision').textContent = 'Browser speech recognition may use a network service. Only this one request is sent.'; } catch { recognition = null; }
};

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
  if (raw > 0) fps += (1 / raw - fps) * 0.05;
  if (document.hidden && !renderer.xr.isPresenting) return;
  frame(dt);
}
function frame(dt) {
  simClock += dt; const now = simClock;
  if (now - lastInteraction > 3 && !document.body.classList.contains('idle') && $('drawer').hidden) document.body.classList.add('idle');
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
    if (ship.mode === 'ship') { camera.position.set(0, 0, 0); camera.rotation.set(ship.pitch * RAD, ship.yaw * RAD, ship.roll * RAD, 'YXZ'); }
    else if (zoom < 0.1) { camera.position.set(0, 0, 0); camera.rotation.set(pitch, orbit, 0, 'YXZ'); }
    else { const a = orbit + simTime * 0.025; camera.position.set(Math.sin(a) * zoom, Math.sin(pitch) * zoom, Math.cos(a) * zoom); camera.lookAt(0, 0, 0); }
  }
  if (renderer.xr.isPresenting) renderer.render(scene, camera);
  else {
    // v3: the director's state becomes a program (grammar), blended over time; gestures speak on top of it.
    const beatSeconds = 60 / Math.max(60, out.hud.bpm);
    programFor({ I: out.I, A: out.As, E: out.hud.E, C: out.hud.C, H: out.targets.H, L, heat: out.heat, ship: ship.mode, diving: ship.diving, jump: !!jump, calm }, depth, target);
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
    Object.assign(program, current);
    for (const k in g.overrides) {
      const v = g.overrides[k];
      if (k === 'formDensity') program.formDensity = current.formDensity * (1 - g.env);
      else if (typeof v !== 'number' || DISCRETE.includes(k)) program[k] = v;
      else program[k] = Math.max(k === 'formDrift' ? -1 : 0, Math.min(1, current[k] + v));
    }
    Object.assign(program, window.__flow.forceProgram);
    capProgram(program, depth);   // Depth caps gestures too
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
  if (ship.mode === 'hover') line += ' · tap to launch';
  if (!sound && !audio.synthetic) line += ' · tap to start sound';
  else if (frames.music) line += ` · ${Math.round(out.hud.bpm)} BPM · C ${out.hud.C.toFixed(2)}`;
  line += ` · life ${L.toFixed(2)}` + (out.heat > 0 ? ` · heat +${out.heat.toFixed(2)}` : '') + (dissolving ? ' · REWIND' : '') + (jump ? ' · JUMP' : '') + (ship.diving ? ' · DIVE' : '') + (visualGestures.active ? ' · ' + visualGestures.active.toUpperCase() : '') + (paused ? ' · PAUSED' : '');
  line += navigator.onLine && jev.enabled ? ' · JEV' : ' · LOCAL';
  $('hud').textContent = line;
}
function updateExplain(out, L) {
  const src = out.hud.source, cls = s => `<dd class="${s}">${s}</dd>`, axes = depthToAxes(depth);
  const life = world === 'life' ? `<p>Life: ${sims.life.pure ? 'pure B3/S23, no perturbation' : `creative variant · ${sims.life.perturbations} random births so far`}</p>` : '';
  $('explain').innerHTML = `<h3>WHO IS STEERING</h3><dl>
<dt>H entropy</dt>${cls(src.H)}<dt>T tempo</dt>${cls(src.T)}<dt>D density</dt>${cls(src.D)}<dt>S fold</dt>${cls(src.S)}<dt>F feedback</dt>${cls(src.F)}<dt>P palette</dt>${cls(src.P)}</dl>
<p>Initiative ${out.I.toFixed(2)} (${autoInitiative ? 'auto, baseline ' + director.initiative.I0.toFixed(1) : 'locked'}) · agency ${out.As.toFixed(2)}<br>Arc ${out.hud.arc} · waypoint ${out.hud.waypoint + 1}${director.arcs.pinned ? ' · pinned' : ''}<br>Entropy target ${out.hTarget.toFixed(2)} ± ${out.hWidth.toFixed(2)} → ${out.targets.H.toFixed(2)} · heat +${out.heat.toFixed(2)}<br>Liveliness ${L.toFixed(2)} (ref ${liveliness.reference(world).toFixed(3)}) · snapshots ${rings[world].count} · ${rewindNote || 'no rewind yet'}<br>Ship ${ship.mode} · ${ship.speed.toFixed(1)} u/s · ${ship.diving ? 'DIVING' : 'level'} · yaw ${ship.yaw.toFixed(0)}° pitch ${ship.pitch.toFixed(0)}° roll ${ship.roll.toFixed(0)}°${jump ? ' · jump ' + jump.t.toFixed(1) + ' s' : ''}<br>Depth ${depth.toFixed(2)} → fold ${axes.fold} · feedback ${axes.feedback.toFixed(2)} · sat ×${axes.saturation.toFixed(2)} · speed ×${axes.speed.toFixed(2)}<br>Beat ${Math.round(out.hud.bpm)} BPM · coherence ${out.hud.C.toFixed(2)} · world phase ${out.I >= 0 ? 'ahead' : 'behind'} by ${Math.round(Math.abs(out.I) * 0.12 * 60000 / Math.max(60, out.hud.bpm))} ms<br>Novelty budget ${director.N.toFixed(2)}<br>Program: forms ${program.formKind} ${program.formDrift >= 0 ? 'in' : 'out'} ${Math.abs(program.formDrift).toFixed(2)} · fold ${program.fold} · mirror ${program.mirror} · warp ${program.warp.toFixed(2)} · tunnel ${program.tunnel.toFixed(2)} · echo ${program.echoDecay.toFixed(2)} · droste ${program.droste.toFixed(2)} · contour ${program.contour.toFixed(2)} · chroma ${program.chromaSplit.toFixed(2)} · quality ${quality}<br>Gesture ${visualGestures.active ? `${visualGestures.active} (${visualGestures.env.toFixed(2)})` : 'none'} · mood ${out.mood ? out.mood + ' (jev)' : 'none'} · arc F ${out.targets.F.toFixed(2)} → echo ±0.2 (fold is Depth's: cap ${FOLDS[Math.round(depth * 4)]})${calm ? ' · CALM' : ''}</p>
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
async function setupXR() {
  try {
    if (!navigator.xr || !await navigator.xr.isSessionSupported('immersive-vr')) { $('vr').textContent = 'VR: needs a headset'; return; }
    $('vr').disabled = false; $('vr').textContent = 'Enter Quest VR';
    $('vr').onclick = async () => {
      if (xrSession) { await xrSession.end(); return; }
      try {
        xrSession = await navigator.xr.requestSession('immersive-vr', { optionalFeatures: ['local-floor'] });
        setShipMode('hover'); camera.position.set(0, 1.6, 0); camera.rotation.set(0, 0, 0); await renderer.xr.setSession(xrSession); $('vr').textContent = 'Leave VR';
        xrSession.addEventListener('end', () => { xrSession = null; $('vr').textContent = 'Enter Quest VR'; camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); });
      } catch { xrSession = null; $('vr').textContent = 'VR did not start, retry'; }
    };
  } catch { $('vr').textContent = 'VR unavailable'; }
}
setupXR();
for (let i = 0; i < 2; i++) {
  const controller = renderer.xr.getController(i); scene.add(controller);
  controller.addEventListener('selectstart', () => { gestureCount++; if (i === 0) act({ type: 'swipe', dir: 'left' }); else setShipMode(ship.mode === 'ship' ? 'hover' : 'ship'); });
}
addEventListener('pagehide', () => { recognition?.stop(); player.pause(); audio.close(); renderer.setAnimationLoop(null); worlds.dispose(); post.dispose(); renderer.dispose(); });

// ---------- start ----------
choose(world); setAuto(true); setShipMode('hover'); placeDot(director.initiative.I); setDepth(depth);
lastInteraction = Infinity; document.body.classList.remove('idle');   // nothing fades before the first real touch
renderer.setAnimationLoop(animate);
