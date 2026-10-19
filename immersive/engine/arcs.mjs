/* Preset arcs (what leading has to say) and the ArcPlayer that walks them on its own clock.
   An arc is a path, not a schedule: it pauses while the person acts and resumes where it stopped. */
export const SCENES   = ['physarum', 'swarm', 'boids', 'life'];
export const PALETTES = ['ink', 'silk', 'ember', 'neon'];
export const CAMERAS  = ['orbit', 'inside', 'close', 'flight'];
export const FOLDS    = [0, 2, 4, 6, 8];
export const ARC_ORDER = ['tidal', 'firefly', 'mycelium'];

const FULL = Object.freeze({ H: 1, T: 1, D: 1, S: 1, F: 1, P: 1, Cam: 1 });
const SOFT = Object.freeze({ H: 1, T: 0.6, D: 0.6, S: 1, F: 1, P: 1, Cam: 1 });   // music keeps a say in tempo and density
const wp = (t, o) => ({ t, weight: FULL, ...o });

export const ARCS = {
  tidal: { name: 'tidal', duration: 285, waypoints: [
    wp(0,   { scene: 'physarum', H: 0.15, T: 0.35, D: 0.45, S: 0, F: 0.25, palette: 'silk', camera: 'orbit',  omega: 0.35, weight: SOFT }),
    wp(45,  { H: 0.25, T: 0.40, D: 0.55, S: 0, F: 0.35, palette: 'silk', camera: 'orbit',  omega: 0.40, I0: 0.3, weight: SOFT }),
    wp(95,  { H: 0.40, T: 0.50, D: 0.70, S: 2, F: 0.45, palette: 'silk', camera: 'inside', omega: 0.50 }),
    wp(140, { scene: 'swarm', H: 0.45, T: 0.55, D: 0.75, S: 4, F: 0.50, palette: 'ink', camera: 'inside', omega: 0.60 }),
    wp(190, { H: 0.55, T: 0.60, D: 0.80, S: 6, F: 0.55, palette: 'ink', camera: 'inside', omega: 0.70 }),
    wp(240, { H: 0.35, T: 0.40, D: 0.50, S: 6, F: 0.40, palette: 'ink', camera: 'inside', omega: 0.45, I0: 0.4, weight: SOFT }),
  ] },
  firefly: { name: 'firefly', duration: 290, waypoints: [
    wp(0,   { scene: 'swarm', H: 0.50, T: 0.55, D: 0.60, S: 4, F: 0.35, palette: 'neon', camera: 'inside', omega: 0.90 }),
    wp(45,  { H: 0.40, T: 0.60, D: 0.70, S: 4, F: 0.40, palette: 'neon', camera: 'inside', omega: 1.00 }),
    wp(90,  { H: 0.35, T: 0.65, D: 0.80, S: 6, F: 0.45, palette: 'neon', camera: 'inside', omega: 1.10 }),
    wp(140, { scene: 'boids', H: 0.50, T: 0.70, D: 0.85, S: 6, F: 0.50, palette: 'neon', camera: 'flight', omega: 1.20 }),
    wp(190, { H: 0.60, T: 0.75, D: 0.90, S: 8, F: 0.55, palette: 'neon', camera: 'flight', omega: 1.30 }),
    wp(240, { scene: 'swarm', H: 0.45, T: 0.60, D: 0.75, S: 8, F: 0.45, palette: 'neon', camera: 'inside', omega: 1.00 }),
    wp(275, { H: 0.30, T: 0.50, D: 0.60, S: 8, F: 0.35, palette: 'neon', camera: 'inside', omega: 0.90, weight: SOFT }),
  ] },
  mycelium: { name: 'mycelium', duration: 295, waypoints: [
    wp(0,   { scene: 'boids', H: 0.50, T: 0.70, D: 0.80, S: 8, F: 0.50, palette: 'ember', camera: 'flight', omega: 1.10, I0: 0.5 }),
    wp(45,  { H: 0.60, T: 0.80, D: 0.90, S: 8, F: 0.55, palette: 'ember', camera: 'flight', omega: 1.20 }),
    wp(90,  { scene: 'physarum', H: 0.70, T: 0.85, D: 0.90, S: 6, F: 0.60, palette: 'neon', camera: 'flight', omega: 1.30 }),
    wp(135, { H: 0.85, T: 0.90, D: 1.00, S: 4, F: 0.65, palette: 'neon', camera: 'flight', omega: 1.40 }),
    wp(185, { scene: 'life', H: 0.60, T: 0.80, D: 0.80, S: 2, F: 0.50, palette: 'neon', camera: 'flight', omega: 1.20 }),
    wp(235, { scene: 'boids', H: 0.35, T: 0.60, D: 0.60, S: 0, F: 0.40, palette: 'ink', camera: 'flight', omega: 1.00 }),
    wp(270, { H: 0.20, T: 0.45, D: 0.50, S: 0, F: 0.30, palette: 'ink', camera: 'orbit', omega: 0.80, I0: 0.2, weight: SOFT }),
  ] },
};

const CONTINUOUS = ['H', 'T', 'D', 'F', 'omega'];
const DISCRETE = ['S', 'palette', 'camera'];
const clamp01 = v => v < 0 ? 0 : v > 1 ? 1 : v;

export class ArcPlayer {
  constructor(arcs = ARCS, order = ARC_ORDER) {
    this.arcs = arcs; this.order = order;
    this.pinned = false; this.rate = 1; this.overrides = null;
    this.time = 0; this.index = 0; this.sceneRequest = null;
    this.out = { scene: null, I0: null, H: 0, T: 0, D: 0, S: 0, F: 0, palette: 'ink', camera: 'orbit', omega: 1, weight: FULL, index: 0, arcName: '', progress: 0 };
    this.select(order[0]);
  }
  select(name, { pin = false } = {}) {
    if (!this.arcs[name]) return;
    this.arcName = name; this.arc = this.arcs[name];
    this.time = 0; this.index = 0; this.rate = 1; this.overrides = null; this.pinned = pin;
  }
  pin(value) { this.pinned = !!value; }
  holdUntilNextWaypoint(p) { this.rate = 1 - clamp01(p); }
  override(partial) { this.overrides = Object.assign(this.overrides || {}, partial); }
  nextArcName() { const i = this.order.indexOf(this.arcName); return this.order[(i + 1) % this.order.length]; }
  latestScene(idx) {
    const wps = this.arc.waypoints;
    for (let i = idx; i >= 0; i--) if (wps[i].scene) return wps[i].scene;
    return null;
  }
  latestI0(idx) {
    const wps = this.arc.waypoints;
    for (let i = idx; i >= 0; i--) if (wps[i].I0 !== undefined) return wps[i].I0;
    return null;
  }
  update(dt, { running = true, currentScene = null } = {}) {
    dt = Math.min(Math.max(0, dt || 0), 0.1);
    if (running) this.time += dt * this.rate;
    while (this.time >= this.arc.duration) {
      this.time -= this.arc.duration;
      if (!this.pinned) { this.arcName = this.nextArcName(); this.arc = this.arcs[this.arcName]; }
      this.index = 0; this.rate = 1; this.overrides = null;
    }
    const wps = this.arc.waypoints;
    let idx = 0;
    while (idx + 1 < wps.length && wps[idx + 1].t <= this.time) idx++;
    if (idx !== this.index) { this.index = idx; this.rate = 1; this.overrides = null; }
    const scene = this.overrides?.scene ?? this.latestScene(idx);
    this.sceneRequest = scene && scene !== currentScene ? scene : null;
    return this;
  }
  current() {
    const wps = this.arc.waypoints, idx = this.index, a = wps[idx], b = wps[idx + 1], o = this.out;
    const span = b ? b.t - a.t : 0;
    const u = b && span > 0 ? clamp01((this.time - a.t) / span) : 0;
    for (const k of CONTINUOUS) o[k] = b ? a[k] + (b[k] - a[k]) * u : a[k];
    for (const k of DISCRETE) o[k] = a[k];
    o.scene = this.latestScene(idx); o.I0 = this.latestI0(idx); o.weight = a.weight;
    if (this.overrides) for (const k in this.overrides) if (k !== 'weight') o[k] = this.overrides[k];
    if (this.overrides?.weight) o.weight = { ...a.weight, ...this.overrides.weight };
    o.index = idx; o.arcName = this.arcName; o.progress = this.time / this.arc.duration;
    return o;
  }
}
