/* EXTRA / Living Worlds · Flow with Mind — browser app.
   Owns the renderer, the audio graph, the HUD and the controls. All decisions come from the pure engine. */
import * as THREE from '../vendor/three.module.js';
import { Physarum } from './sims/physarum.mjs';
import { Swarmalators } from './sims/swarmalators.mjs';
import { Boids } from './sims/boids.mjs';
import { Life } from './sims/life.mjs';
import { AudioFeatures } from './engine/features.mjs';
import { Director } from './engine/director.mjs';
import { ARC_ORDER } from './engine/arcs.mjs';
import { AudioGraph } from './audio.mjs';
import { Playlist } from './engine/playlist.mjs';
import { paletteHSL } from './engine/palettes.mjs';

const $ = id => document.getElementById(id), TAU = Math.PI * 2;
const WORLDS = {
  physarum: ['01 / MYCELIAL INTELLIGENCE', 'The world<br>weaves itself.', 'Every path remembers another path.', 'sense trail → turn → deposit → diffuse and decay'],
  swarm: ['02 / COLLECTIVE RESONANCE', 'A thousand lights.<br>One becoming.', 'Each light keeps its own rhythm, until it does not.', 'position ↔ phase coupling · synchrony, anti-synchrony, rings'],
  boids: ['03 / OCEAN OF MOTION', 'You are part<br>of the current.', 'You are inside the flock, not in front of a screen.', 'local neighbours: separation + alignment + cohesion'],
  life: ['04 / CELLULAR COSMOS', 'Small rules.<br>Living worlds.', 'A universe grows from three rules.', 'B3/S23 · toroidal · synchronous · mapped onto a sphere'],
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
const dummy = new THREE.Object3D(), color = new THREE.Color(), direction = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0);
const starPos = new Float32Array(1800); for (let i = 0; i < starPos.length; i++) starPos[i] = (Math.random() - 0.5) * 100;
const starsG = new THREE.BufferGeometry(); starsG.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
scene.add(new THREE.Points(starsG, new THREE.PointsMaterial({ color: 0x6c8aab, size: 0.045, transparent: true, opacity: 0.45 })));

// ---------- simulations ----------
const sims = { physarum: new Physarum(), swarm: new Swarmalators(), boids: new Boids(), life: new Life(64, 1) };
let world = 'physarum', seed = 100;
const textureCanvas = document.createElement('canvas'); textureCanvas.width = textureCanvas.height = sims.physarum.size;
const tx = textureCanvas.getContext('2d'), pixels = tx.createImageData(sims.physarum.size, sims.physarum.size);
const texture = new THREE.CanvasTexture(textureCanvas); texture.colorSpace = THREE.SRGBColorSpace; texture.minFilter = THREE.LinearFilter; texture.magFilter = THREE.LinearFilter;
const haloCanvas = document.createElement('canvas'); haloCanvas.width = haloCanvas.height = 64;
const hc = haloCanvas.getContext('2d'), hg = hc.createRadialGradient(32, 32, 0, 32, 32, 32);
hg.addColorStop(0, 'rgba(255,255,255,1)'); hg.addColorStop(0.15, 'rgba(255,255,255,.7)'); hg.addColorStop(0.5, 'rgba(255,255,255,.12)'); hg.addColorStop(1, 'rgba(255,255,255,0)');
hc.fillStyle = hg; hc.fillRect(0, 0, 64, 64); const haloTexture = new THREE.CanvasTexture(haloCanvas);
let visual = null;

function addHalos(sim) {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(sim.p, 3));
  g.setAttribute('color', new THREE.BufferAttribute(new Float32Array(sim.count * 3), 3));
  const dots = new THREE.Points(g, new THREE.PointsMaterial({ map: haloTexture, size: 0.65, transparent: true, opacity: 0.65, vertexColors: true, blending: THREE.AdditiveBlending, depthWrite: false }));
  dots.frustumCulled = false; group.add(dots); visual.userData.halo = dots;
}
function clean() {
  while (group.children.length) {
    const obj = group.children[0]; group.remove(obj);
    obj.traverse(o => { o.geometry?.dispose(); if (o.material) for (const m of (Array.isArray(o.material) ? o.material : [o.material])) m.dispose(); });
  }
  visual = null;
}
function build() {
  clean();
  if (world === 'physarum') {
    const mat = new THREE.MeshBasicMaterial({ map: texture, side: THREE.DoubleSide, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false });
    visual = new THREE.Mesh(new THREE.SphereGeometry(8.5, 64, 40), mat); group.add(visual);
    group.add(new THREE.Mesh(new THREE.SphereGeometry(9, 40, 24), new THREE.MeshBasicMaterial({ color: 0x5a7990, wireframe: true, transparent: true, opacity: 0.025 })));
  } else if (world === 'swarm') {
    visual = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(0.065, 1), new THREE.MeshBasicMaterial({ color: 0xffffff }), sims.swarm.count);
    visual.instanceMatrix.setUsage(THREE.DynamicDrawUsage); group.add(visual);
    const trailG = new THREE.BufferGeometry(); trailG.setAttribute('position', new THREE.BufferAttribute(new Float32Array(sims.swarm.count * 6), 3));
    const trail = new THREE.LineSegments(trailG, new THREE.LineBasicMaterial({ color: 0x81c6ed, transparent: true, opacity: 0.16 }));
    group.add(trail); visual.userData.trail = trail;
  } else if (world === 'boids') {
    const shape = $('skin').value;
    const geo = shape === 'lights' ? new THREE.IcosahedronGeometry(0.065, 0) : new THREE.ConeGeometry(shape === 'birds' ? 0.17 : 0.09, 0.45, shape === 'birds' ? 3 : 5);
    visual = new THREE.InstancedMesh(geo, new THREE.MeshBasicMaterial({ color: 0xffffff }), sims.boids.count);
    visual.instanceMatrix.setUsage(THREE.DynamicDrawUsage); group.add(visual);
  } else {
    visual = new THREE.InstancedMesh(new THREE.BoxGeometry(0.12, 0.12, 0.12), new THREE.MeshBasicMaterial({ color: 0xffffff }), sims.life.grid.cells.length);
    visual.instanceMatrix.setUsage(THREE.DynamicDrawUsage); group.add(visual);
  }
  visual.frustumCulled = false;
  if (world === 'swarm') addHalos(sims.swarm);
  if (world === 'boids') addHalos(sims.boids);
}

// ---------- engine ----------
const audio = new AudioGraph($('player'));
const playlist = new Playlist();
const director = new Director({ scene: world });
let musicF = null, roomF = null;
function ensureFeatures(sampleRate) {
  if (!musicF || musicF.sampleRate !== sampleRate) { musicF = new AudioFeatures({ sampleRate, frameRate: 60 }); roomF = new AudioFeatures({ sampleRate, frameRate: 60 }); }
}
ensureFeatures(48000);
const timing = { step: 0, steps: 0, render: 0, dt: 0 };
window.__flow = {
  director, audio, sims, timing,
  get musicF() { return musicF; }, get roomF() { return roomF; },
  frame: dt => frame(dt),
  advance(seconds, dt = 1 / 60) { for (let t = 0; t < seconds; t += dt) frame(dt); return seconds; },
};

let paused = matchMedia('(prefers-reduced-motion: reduce)').matches, simTime = 0, acc = 0, lifeAcc = 0, fade = 1;
let orbit = 0, pitch = 0.12, zoom = 19, attractor = null, xrSession = null, cameraMode = 'orbit';
let autoInitiative = true, sceneLocked = false, gestureCount = 0, lastGesture = 0, lastOut = null, lastFrames = null;
let requestVersion = 0; const bump = () => { requestVersion++; };
let jevEnabled = false;   // the online director is wired in a later step

// ---------- scene selection ----------
function choose(id, { auto = false } = {}) {
  if (!WORLDS[id]) return;
  world = id; fade = 0; build();
  const a = WORLDS[id];
  $('chapter').textContent = a[0]; $('worldTitle').innerHTML = a[1]; $('worldHint').textContent = a[2]; $('rule').textContent = a[3];
  document.querySelectorAll('[data-world]').forEach(b => { const on = b.dataset.world === id; b.classList.toggle('selected', on); b.setAttribute('aria-pressed', String(on)); });
  director.acknowledgeScene(id);
  if (!auto) bump();
}
document.querySelectorAll('[data-world]').forEach(b => b.onclick = () => choose(b.dataset.world));
$('reset').onclick = () => { seed++; const s = sims[world]; if (world === 'life') s.seed(seed); else s.reset(seed); bump(); };
$('skin').onchange = () => { if (world === 'boids') build(); };

// ---------- initiative controls ----------
const initiativeEl = $('initiative');
function setAuto(on) {
  autoInitiative = on;
  if (on) director.initiative.unlock(); else director.initiative.lock(+initiativeEl.value);
  $('initiativeAuto').textContent = 'Auto: ' + (on ? 'on' : 'off'); $('initiativeAuto').setAttribute('aria-pressed', String(on));
}
initiativeEl.addEventListener('input', () => { director.initiative.lock(+initiativeEl.value); autoInitiative = false; $('initiativeAuto').textContent = 'Auto: off'; $('initiativeAuto').setAttribute('aria-pressed', 'false'); bump(); });
$('initiativeAuto').onclick = () => { setAuto(!autoInitiative); bump(); };
$('passLead').onclick = () => { director.initiative.setBaseline(director.initiative.I0 > 0 ? -0.6 : 0.6); setAuto(true); bump(); $('decision').textContent = director.initiative.I0 > 0 ? 'The world takes the lead.' : 'The world follows you.'; };
$('lockScene').onclick = () => { sceneLocked = !sceneLocked; $('lockScene').textContent = 'Lock scene: ' + (sceneLocked ? 'on' : 'off'); $('lockScene').setAttribute('aria-pressed', String(sceneLocked)); bump(); };
$('arc').onchange = () => { const v = $('arc').value; if (v === 'auto') { director.arcs.pin(false); $('pinArc').textContent = 'Pin arc: off'; $('pinArc').setAttribute('aria-pressed', 'false'); } else director.arcs.select(v, { pin: $('pinArc').getAttribute('aria-pressed') === 'true' }); bump(); };
$('pinArc').onclick = () => { const on = $('pinArc').getAttribute('aria-pressed') !== 'true'; director.arcs.pin(on); $('pinArc').textContent = 'Pin arc: ' + (on ? 'on' : 'off'); $('pinArc').setAttribute('aria-pressed', String(on)); };
$('lifePure').onchange = () => { sims.life.pure = $('lifePure').checked; };
for (const id of ['intensity', 'speed', 'feedback']) $(id).oninput = () => { $(id + 'Out').textContent = Number($(id).value).toFixed(2) + (id === 'speed' ? '×' : ''); bump(); };
$('symmetry').onchange = bump; $('hue').oninput = bump;
function setPause(v) { paused = v; $('pause').textContent = v ? 'Resume' : 'Pause'; $('pause').setAttribute('aria-pressed', String(v)); }
setPause(paused); $('pause').onclick = () => setPause(!paused);
$('hide').onclick = () => { document.body.classList.toggle('immersed'); $('hide').textContent = document.body.classList.contains('immersed') ? 'Show controls' : 'Immerse'; };
$('explainToggle').onclick = () => { const on = $('explain').hidden; $('explain').hidden = !on; $('explainToggle').setAttribute('aria-pressed', String(on)); };
addEventListener('keydown', e => { if (e.key === 'Escape') { document.body.classList.remove('immersed'); $('hide').textContent = 'Immerse'; } });
$('view').onchange = () => { applyCamera($('view').value, true); bump(); };
function applyCamera(mode, force = false) {
  if (mode === cameraMode && !force) return;
  cameraMode = mode;
  zoom = mode === 'inside' || mode === 'flight' ? 0.01 : mode === 'close' ? 11 : 19;
}

// ---------- pointer: orbit, attractor, gestures ----------
let drag = null;
const canvas = renderer.domElement;
canvas.addEventListener('pointerdown', e => { drag = { x: e.clientX, y: e.clientY }; canvas.setPointerCapture(e.pointerId); attractor = { x: e.clientX / innerWidth, y: e.clientY / innerHeight }; gestureCount++; });
canvas.addEventListener('pointermove', e => {
  if (!drag) return;
  orbit -= (e.clientX - drag.x) * 0.004; pitch = Math.max(-1.2, Math.min(1.2, pitch + (e.clientY - drag.y) * 0.003));
  drag = { x: e.clientX, y: e.clientY }; attractor = { x: e.clientX / innerWidth, y: e.clientY / innerHeight };
  const now = clock.elapsedTime; if (now - lastGesture > 0.1) { gestureCount++; lastGesture = now; }
});
for (const ev of ['pointerup', 'pointercancel']) canvas.addEventListener(ev, () => { drag = null; attractor = null; });
canvas.addEventListener('wheel', e => { e.preventDefault(); zoom = Math.max(0.01, Math.min(35, zoom + e.deltaY * 0.008)); }, { passive: false });
addEventListener('resize', () => { camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); renderer.setSize(innerWidth, innerHeight); });
const wake = () => { audio.resume(); };
addEventListener('pointerdown', wake); addEventListener('keydown', wake);

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

// ---------- rendering ----------
function paletteColor(mode, hue, t, v) { const [h, s, l] = paletteHSL(mode, hue / 360, t, v); color.setHSL(h, s, l); return color; }
function renderWorld(out) {
  const { palette, hue } = out.targets, pulse = 1 + 0.25 * out.pulse * +$('intensity').value;
  if (world === 'physarum') {
    const field = sims.physarum.field;
    for (let i = 0; i < field.length; i++) {
      const v = Math.pow(1 - Math.exp(-field[i] * 1.3), 1.4);
      const [h, s, l] = paletteHSL(palette, (hue / 360 + 0.48) % 1, v, Math.min(1, v * 0.6 + 0.02));
      color.setHSL(h, s, l * (v > 0.02 ? 1 : 0.05)); color.convertLinearToSRGB();
      pixels.data[i * 4] = color.r * 255; pixels.data[i * 4 + 1] = color.g * 255; pixels.data[i * 4 + 2] = color.b * 255; pixels.data[i * 4 + 3] = 255;
    }
    tx.putImageData(pixels, 0, 0); texture.needsUpdate = true;
    visual.rotation.y = simTime * 0.025; visual.scale.setScalar(0.96 + 0.04 * pulse);
  } else if (world === 'swarm') {
    const s = sims.swarm, p = s.p, lines = visual.userData.trail.geometry.attributes.position;
    for (let i = 0; i < s.active; i++) {
      const phase = s.phase[i], glow = 0.8 + 0.55 * (0.5 + 0.5 * Math.sin(phase));
      dummy.position.set(p[i * 3], p[i * 3 + 1], p[i * 3 + 2]); dummy.quaternion.identity(); dummy.scale.setScalar(glow * pulse); dummy.updateMatrix();
      visual.setMatrixAt(i, dummy.matrix); visual.setColorAt(i, paletteColor(palette, hue, phase / TAU, 0.5 + 0.5 * Math.sin(phase)));
      for (let k = 0; k < 3; k++) { lines.array[i * 6 + k] = p[i * 3 + k]; lines.array[i * 6 + 3 + k] = p[i * 3 + k] - s.delta[i * 3 + k] * 1.2; }
    }
    visual.count = s.active; lines.needsUpdate = true; visual.userData.trail.geometry.setDrawRange(0, s.active * 2);
    visual.instanceMatrix.needsUpdate = true; visual.instanceColor.needsUpdate = true;
  } else if (world === 'boids') {
    const s = sims.boids, birds = $('skin').value === 'birds';
    for (let i = 0; i < s.active; i++) {
      const b = i * 3;
      dummy.position.fromArray(s.p, b); direction.fromArray(s.v, b).normalize(); dummy.quaternion.setFromUnitVectors(up, direction);
      dummy.scale.set(birds ? 1 + Math.sin(simTime * 8 + i) * 0.2 : 1, pulse, 1); dummy.updateMatrix();
      visual.setMatrixAt(i, dummy.matrix); visual.setColorAt(i, paletteColor(palette, hue, i / s.count, 0.65));
    }
    visual.count = s.active; visual.instanceMatrix.needsUpdate = true; visual.instanceColor.needsUpdate = true;
  } else {
    const life = sims.life, cells = life.grid.cells, age = life.grid.age, n = life.size; let count = 0;
    for (let i = 0; i < cells.length; i++) {
      if (!cells[i]) continue;
      const a = (i % n) / n * TAU, b = (Math.floor(i / n) + 0.5) / n * Math.PI, r = 7 + Math.min(age[i], 40) * 0.012;
      dummy.position.set(r * Math.sin(b) * Math.cos(a), r * Math.cos(b), r * Math.sin(b) * Math.sin(a));
      dummy.quaternion.identity(); dummy.scale.setScalar((0.6 + 0.6 * life.density) * pulse); dummy.updateMatrix();
      visual.setMatrixAt(count, dummy.matrix); visual.setColorAt(count++, paletteColor(palette, hue, Math.min(age[i], 60) / 60, 0.65));
    }
    visual.count = count; visual.instanceMatrix.needsUpdate = true; if (visual.instanceColor) visual.instanceColor.needsUpdate = true;
  }
  if (visual?.userData.halo) {
    const attrs = visual.userData.halo.geometry.attributes, s = sims[world];
    attrs.position.needsUpdate = true; attrs.color.array.set(visual.instanceColor.array); attrs.color.needsUpdate = true;
    visual.userData.halo.geometry.setDrawRange(0, s.active);
  }
}

function stepSims(h, out) {
  const energy = (musicF ? musicF.E : 0) * +$('intensity').value, sim = sims[world];
  if (world === 'physarum') sim.step(h, energy, attractor);
  else if (world === 'swarm') sim.step(h, energy, 0.7, attractor);
  else if (world === 'boids') sim.step(h, energy, attractor);
  else { lifeAcc += h * (out.hud.bpm / 60) * sims.life.generationsPerBeat; while (lifeAcc >= 1) { sims.life.step(); lifeAcc--; } }
}

function userState() {
  return { H: 0.5, T: +$('speed').value / 2, D: +$('intensity').value, S: +$('symmetry').value, F: +$('feedback').value, hue: +$('hue').value, camera: $('view').value, sceneLocked };
}

let lastHUD = 0, lastExplain = 0, simClock = 0;
function animate() {
  const dt = Math.min(clock.getDelta(), 0.1);
  if (document.hidden && !renderer.xr.isPresenting) return;
  frame(dt);
}
// One frame of the whole app for a given dt. The animation loop calls it with the real clock;
// window.__flow.advance(seconds) drives it deterministically for headless checks.
function frame(dt) {
  simClock += dt;
  const now = simClock;
  const frames = audio.frames(now); lastFrames = frames;
  ensureFeatures(frames.sampleRate);
  musicF.update(frames.music, dt); roomF.update(frames.room, dt);
  const latency = audio.latency();
  const out = director.update(dt, {
    music: frames.music ? { E: musicF.E, onset: musicF.onset, B: musicF.B, C: musicF.C, bpm: musicF.bpm, latency: latency.music } : null,
    room: frames.room ? { onset: roomF.onset, speech: roomF.speech } : null,
    gestures: gestureCount, user: userState(), online: navigator.onLine,
  });
  gestureCount = 0; lastOut = out;
  const sim = sims[world];
  sim.setParams({ H: out.targets.H, T: Math.min(1, out.targets.T), D: out.targets.D });
  if (out.injection) sim.inject(Math.random, 60 / out.hud.bpm);
  if (out.sceneChange) choose(out.sceneChange, { auto: true });
  applyCamera(out.targets.camera);
  if (!paused) {
    const step = dt * +$('speed').value * (0.5 + out.targets.T);
    simTime += step; acc += step; fade = Math.min(1, fade + dt * 0.5);
    const t0 = performance.now(); let steps = 0;
    while (acc >= 1 / 30) { stepSims(1 / 30, out); acc -= 1 / 30; steps++; }
    const t1 = performance.now();
    if (!window.__flow.skipRender) renderWorld(out);
    timing.step = t1 - t0; timing.steps = steps; timing.render = performance.now() - t1; timing.dt = dt;
  }
  if (window.__flow.skipRender) { if (now - lastHUD > 0.15) { lastHUD = now; updateHUD(out, frames); } return; }
  if (!renderer.xr.isPresenting) {
    if (zoom < 0.1) { camera.position.set(0, 0, 0); camera.rotation.set(pitch, orbit, 0, 'YXZ'); }
    else { const a = orbit + simTime * 0.025; camera.position.set(Math.sin(a) * zoom, Math.sin(pitch) * zoom, Math.cos(a) * zoom); camera.lookAt(0, 0, 0); }
  }
  group.scale.setScalar(0.95 + fade * 0.05);
  renderer.render(scene, camera);
  if (now - lastHUD > 0.15) { lastHUD = now; updateHUD(out, frames); }
  if (!$('explain').hidden && now - lastExplain > 0.5) { lastExplain = now; updateExplain(out, latency); }
}

function updateHUD(out, frames) {
  const bars = $('meters').querySelectorAll('i');
  [musicF.bands.bass, musicF.bands.mid, musicF.bands.high].forEach((v, i) => bars[i].style.height = (2 + v * 38) + 'px');
  $('phaseDot').style.opacity = (0.15 + 0.85 * out.pulse).toFixed(2);
  $('roomDot').style.opacity = frames.room ? (0.15 + 0.85 * Math.max(roomF.speech, roomF.onset)).toFixed(2) : '0.05';
  $('stats').textContent = frames.music ? `${frames.source.toUpperCase()} · B ${musicF.bands.bass.toFixed(2)} M ${musicF.bands.mid.toFixed(2)} H ${musicF.bands.high.toFixed(2)}` : 'BASS / MID / HIGH';
  if (autoInitiative) initiativeEl.value = out.I.toFixed(2);
  const sound = audio.context && audio.context.state === 'running';
  const sign = out.I >= 0 ? '+' : '';
  let line = `${out.hud.leading} ${sign}${out.I.toFixed(2)}`;
  if (!sound && !audio.synthetic) line += ' · tap to start sound';
  else if (frames.music) line += ` · ${Math.round(out.hud.bpm)} BPM · C ${out.hud.C.toFixed(2)} · E ${out.hud.E.toFixed(2)} · room ${frames.room ? 'on' : 'off'}`;
  else line += ' · listening';
  line += navigator.onLine && jevEnabled ? ' · JEV' : ' · LOCAL DIRECTOR';
  $('hud').textContent = line;
}
function updateExplain(out, latency) {
  const src = out.hud.source, cls = s => `<dd class="${s}">${s}</dd>`;
  const life = world === 'life' ? `<p>Life: ${sims.life.pure ? 'pure B3/S23, no perturbation' : `creative variant · ${sims.life.perturbations} random births so far`}</p>` : '';
  $('explain').innerHTML = `<h3>WHO IS STEERING</h3><dl>
<dt>H entropy</dt>${cls(src.H)}<dt>T tempo</dt>${cls(src.T)}<dt>D density</dt>${cls(src.D)}<dt>S symmetry</dt>${cls(src.S)}<dt>F feedback</dt>${cls(src.F)}<dt>P palette</dt>${cls(src.P)}<dt>camera</dt>${cls(src.Cam)}</dl>
<p>Initiative ${out.I.toFixed(2)} (${autoInitiative ? 'auto, baseline ' + director.initiative.I0.toFixed(1) : 'locked'}) · agency ${out.As.toFixed(2)}<br>Arc ${out.hud.arc} · waypoint ${out.hud.waypoint + 1}${director.arcs.pinned ? ' · pinned' : ''}<br>Entropy target ${out.hTarget.toFixed(2)} ± ${out.hWidth.toFixed(2)} → ${out.targets.H.toFixed(2)}<br>Beat ${Math.round(out.hud.bpm)} BPM · coherence ${out.hud.C.toFixed(2)} · world phase ${out.I >= 0 ? 'ahead' : 'behind'} by ${Math.round(Math.abs(out.I) * 0.12 * 60000 / Math.max(60, out.hud.bpm))} ms<br>Latency compensation ${Math.round(latency.music * 1000)} ms (music) · ${Math.round(latency.room * 1000)} ms (room)<br>Novelty budget ${director.N.toFixed(2)}</p>
<p>${WORLDS[world][3]}</p>${life}`;
}

choose(world); renderWorld(director.update(0.016, { music: null, room: null, gestures: 0, user: userState(), online: navigator.onLine })); renderer.setAnimationLoop(animate);

// ---------- requests: local phrases first; the online director arrives in a later step ----------
function setSlider(id, value) { $(id).value = value; $(id).dispatchEvent(new Event('input')); }
function localCommand(text) {
  const t = text.toLowerCase(); let handled = false;
  const is = re => re.test(t);
  if (is(/pause|stop|暫停|停/)) { setPause(true); return true; }
  if (is(/resume|continue|繼續/)) { setPause(false); return true; }
  if (is(/fish|bird|flock|魚|鳥/)) { choose('boids'); handled = true; }
  if (is(/mycel|network|菌|網/)) { choose('physarum'); handled = true; }
  if (is(/firefl|sync|螢|同步/)) { choose('swarm'); handled = true; }
  if (is(/\blife\b|cell|生命/)) { choose('life'); handled = true; }
  if (is(/slow|慢/)) { setSlider('speed', 0.45); handled = true; }
  if (is(/fast|快/)) { setSlider('speed', 1.5); handled = true; }
  if (is(/surround|inside|around me|包圍/)) { $('view').value = 'inside'; applyCamera('inside', true); handled = true; }
  if (is(/lead me|take over|帶/)) { director.initiative.setBaseline(0.6); setAuto(true); handled = true; }
  if (is(/follow me|跟/)) { director.initiative.setBaseline(-0.6); setAuto(true); handled = true; }
  if (is(/hold|stay|don.t change|唔好轉|keep/)) { if (!sceneLocked) $('lockScene').click(); handled = true; }
  if (is(/warm|暖/)) { setSlider('hue', 20); handled = true; }
  if (is(/cool|cold|冷/)) { setSlider('hue', 200); handled = true; }
  if (is(/more symmetry|kaleid|對稱/)) { $('symmetry').value = String(Math.min(8, +$('symmetry').value + 2 || 2)); handled = true; }
  if (is(/less symmetry|no symmetry/)) { $('symmetry').value = String(Math.max(0, +$('symmetry').value - 2)); handled = true; }
  if (is(/calm|gentle|靜|冷靜/)) { setSlider('intensity', 0.4); handled = true; }
  if (handled) bump();
  return handled;
}
function decide(text = '') {
  if (text && localCommand(text)) { $('decision').textContent = 'Applied locally: ' + text; return; }
  $('decision').textContent = text ? 'Not a local phrase. Try: slower, faster, fish, mycelium, fireflies, life, surround me, lead me, follow me, hold, warmer, cooler, calm.' : 'Local director running.';
}
$('commandForm').onsubmit = e => { e.preventDefault(); const text = $('command').value.trim(); $('command').value = ''; if (text) decide(text); };
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

// ---------- network, offline, XR, cleanup ----------
function network() { $('network').textContent = navigator.onLine ? 'LOCAL ENGINE · ONLINE AVAILABLE' : 'OFFLINE · LOCAL DIRECTOR'; }
network(); addEventListener('online', () => { network(); bump(); }); addEventListener('offline', () => { network(); bump(); });
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
        camera.position.set(0, 1.6, 0); camera.rotation.set(0, 0, 0); await renderer.xr.setSession(xrSession); $('vr').textContent = 'Leave VR';
        xrSession.addEventListener('end', () => { xrSession = null; $('vr').textContent = 'Enter Quest VR'; camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); });
      } catch { xrSession = null; $('vr').textContent = 'VR did not start, retry'; }
    };
  } catch { $('vr').textContent = 'VR unavailable'; }
}
setupXR();
for (let i = 0; i < 2; i++) {
  const controller = renderer.xr.getController(i); scene.add(controller);
  controller.addEventListener('selectstart', () => { gestureCount++; if (i === 0) { const ids = Object.keys(WORLDS); choose(ids[(ids.indexOf(world) + 1) % ids.length]); } else setPause(!paused); });
}
addEventListener('pagehide', () => { recognition?.stop(); player.pause(); audio.close(); renderer.setAnimationLoop(null); clean(); texture.dispose(); haloTexture.dispose(); starsG.dispose(); renderer.dispose(); });
