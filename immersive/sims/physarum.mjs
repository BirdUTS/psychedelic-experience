/* Physarum (slime mould) agents on a toroidal trail field: sense → turn → move → deposit → diffuse/decay.
   Director axes: H widens the sensor angle and speeds decay, T scales speed and sensing distance, D sets the active fraction. */
export function seeded(seed = 1) {
  return () => {
    seed |= 0; seed = seed + 0x6D2B79F5 | 0;
    let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

export class Physarum {
  constructor(size = 256, count = 7000, seed = 12) {
    this.size = size; this.count = count;
    this.field = new Float32Array(size * size); this.next = new Float32Array(size * size);
    this.agents = new Float32Array(count * 3);
    this.sensorAngle = 0.55; this.sensorScale = 1; this.speedScale = 1; this.decayRate = 1.4;
    this.active = count; this.injected = null; this.clock = 0;
    this.activity = 0; this.driftSnap = new Float32Array(size * size); this.driftSteps = 0;
    this.burstMul = 1; this.breath = null; this.effectiveSensorAngle = this.sensorAngle;
    this.reset(seed);
  }
  // Structural events driven by the music (v2 §3.4).
  food(x, y, seconds = 12) { this.injected = { x, y, until: this.clock + seconds }; }
  get foodPoint() { return this.injected; }
  burst(multiplier = 3) { this.burstMul = multiplier; }
  breathe(delta, beats, beatSeconds = 0.5) { this.breath = { delta, start: this.clock, until: this.clock + beats * beatSeconds }; }
  state() { return [this.field, this.agents]; }
  reset(seed = 12) {
    this.random = seeded(seed); this.field.fill(0); this.next.fill(0);
    for (let i = 0; i < this.count; i++) {
      const a = this.random() * Math.PI * 2;
      this.agents.set([this.random() * this.size, this.random() * this.size, a], i * 3);
    }
    this.resync();
  }
  // After the field is rewritten from outside (rewind, reseed) the drift baseline must follow,
  // or the next activity sample compares two unrelated maps and inflates the liveliness reference.
  resync() { if (this.driftSnap) this.driftSnap.set(this.field); }
  setParams({ H, T, D } = {}) {
    if (H !== undefined) { this.sensorAngle = 0.55 * (0.4 + 1.2 * H); this.decayRate = 1.4 * (0.6 + 0.8 * H); }
    if (T !== undefined) { this.sensorScale = 0.6 + 0.8 * T; this.speedScale = 0.6 + 0.8 * T; }
    if (D !== undefined) this.active = Math.max(1, Math.round(this.count * (0.3 + 0.7 * D)));
  }
  inject(random = Math.random) { this.food(random(), random(), 8); }
  sense(x, y, a, d) {
    const n = this.size;
    return this.field[((Math.floor(y + Math.sin(a) * d) % n + n) % n) * n + (Math.floor(x + Math.cos(a) * d) % n + n) % n];
  }
  step(dt, energy = 0, attractor = null) {
    this.clock += dt;
    if (this.injected && this.clock > this.injected.until) this.injected = null;
    if (this.breath && this.clock > this.breath.until) this.breath = null;
    const breath = this.breath ? this.breath.delta * (this.breath.until - this.clock) / Math.max(1e-6, this.breath.until - this.breath.start) : 0;
    this.effectiveSensorAngle = this.sensorAngle + breath;
    const deposit = 0.25 * this.burstMul; this.burstMul = 1;
    const pull = attractor || this.injected;
    const n = this.size, p = this.agents, step = dt * 30, d = (7 + energy * 4) * this.sensorScale;
    const turn = this.effectiveSensorAngle, speed = (1.15 + energy * 0.6) * this.speedScale, end = this.active * 3;
    for (let i = 0; i < end; i += 3) {
      let x = p[i], y = p[i + 1], a = p[i + 2];
      const f = this.sense(x, y, a, d), l = this.sense(x, y, a - turn, d), r = this.sense(x, y, a + turn, d);
      if (f < l || f < r) a += (l > r ? -0.36 : l < r ? 0.36 : (this.random() - 0.5) * 0.7) * step;
      if (pull) { const target = Math.atan2(pull.y * n - y, pull.x * n - x); a += Math.atan2(Math.sin(target - a), Math.cos(target - a)) * 0.06 * step; }   // strong enough to see the chase
      x = (x + Math.cos(a) * speed * step + n) % n; y = (y + Math.sin(a) * speed * step + n) % n;
      p[i] = x; p[i + 1] = y; p[i + 2] = a;
      const k = Math.floor(y) * n + Math.floor(x);
      this.field[k] = Math.min(16, this.field[k] + deposit * step);
    }
    const decay = Math.exp(-dt * this.decayRate);
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
      let sum = 0;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) sum += this.field[((y + dy + n) % n) * n + (x + dx + n) % n];
      this.next[y * n + x] = (this.field[y * n + x] * 0.25 + sum / 9 * 0.75) * decay;
    }
    [this.field, this.next] = [this.next, this.field];
    // Activity is structural drift: how much the trail map differs from two seconds ago, relative to its mass.
    // Per-step churn along fixed trails does not count; a network that stopped re-forming reads near zero.
    if (++this.driftSteps % 60 === 0) {
      let d = 0, m = 0;
      for (let i = 0; i < this.field.length; i++) { d += Math.abs(this.field[i] - this.driftSnap[i]); m += this.field[i]; }
      this.activity = m > 0 ? d / m : 0;
      this.driftSnap.set(this.field);
    }
  }
}
