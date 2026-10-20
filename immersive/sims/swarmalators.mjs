/* Swarmalators: position and internal phase couple both ways (O'Keeffe, Hong & Strogatz), extended to 3D.
   Director axis H selects the coupling regime: K = 0.6 − H, so low H gives synchronised rings and high H
   the active phase wave (perpetual motion). T scales phase speed, D sets the active fraction.
   kick() nudges a third of the phases on a beat; inject() flips the coupling sign for two beats;
   travel wraps agents that pass the ship (z > 6) back to z = −30 so the cloud streams past for ever. */
import { seeded } from './physarum.mjs';
const TAU = Math.PI * 2;

export class Swarmalators {
  constructor(count = 260, seed = 31) {
    this.count = count;
    this.p = new Float32Array(count * 3); this.phase = new Float32Array(count);
    this.delta = new Float32Array(count * 3); this.dp = new Float32Array(count); this.omega = new Float32Array(count);
    this.kScale = 1; this.kOffset = 0; this.K = 0.7;        // without setParams the step() coupling argument rules
    this.phaseNoise = 0; this.phaseSpeed = 1;
    this.active = count; this.flipUntil = 0; this.clock = 0;
    this.travel = false; this.activity = 0;
    this.reset(seed);
  }
  reset(seed = 31) {
    const r = seeded(seed); this.random = r;
    for (let i = 0; i < this.count; i++) {
      this.p.set([(r() - 0.5) * 10, (r() - 0.5) * 10, (r() - 0.5) * 10], i * 3);
      this.phase[i] = r() * TAU; this.omega[i] = (r() - 0.5) * 0.08;
    }
  }
  setParams({ H, T, D } = {}) {
    if (H !== undefined) { this.kScale = 0; this.kOffset = 0.6 - 1.0 * H; this.phaseNoise = 0.3 * Math.max(0, H - 0.5); }
    if (T !== undefined) this.phaseSpeed = 0.6 + 0.8 * T;
    if (D !== undefined) this.active = Math.max(2, Math.round(this.count * (0.3 + 0.7 * D)));
  }
  kick(amount = 0.3, fraction = 1 / 3, random = Math.random) {
    for (let i = 0; i < this.active; i++) if (random() < fraction) this.phase[i] = (this.phase[i] + amount) % TAU;
  }
  inject(random = Math.random, beatSeconds = 0.5) { this.flipUntil = this.clock + 2 * beatSeconds; }
  state() { return [this.p, this.phase]; }
  step(dt, energy = 0, coupling = 0.7, attractor = null) {
    this.clock += dt;
    let K = coupling * this.kScale + this.kOffset;
    if (this.clock < this.flipUntil) K = -K;
    this.K = K;
    const n = this.active, p = this.p;
    this.delta.fill(0); this.dp.fill(0);
    for (let i = 0; i < n; i++) {
      let sx = 0, sy = 0, sz = 0, phase = 0;
      for (let j = 0; j < n; j++) {
        if (i === j) continue;
        const dx = p[j * 3] - p[i * 3], dy = p[j * 3 + 1] - p[i * 3 + 1], dz = p[j * 3 + 2] - p[i * 3 + 2];
        const d = Math.max(0.14, Math.hypot(dx, dy, dz)), q = this.phase[j] - this.phase[i];
        const f = (1 + 0.8 * Math.cos(q)) / d - 3 / (d * d);
        sx += dx * f; sy += dy * f; sz += dz * f; phase += Math.sin(q) / d;
      }
      this.delta[i * 3] = sx / n; this.delta[i * 3 + 1] = sy / n; this.delta[i * 3 + 2] = sz / n;
      this.dp[i] = K * phase / n + this.omega[i];
    }
    let sumCos = 0, sumSin = 0, speed = 0;
    for (let i = 0; i < n; i++) {
      for (let k = 0; k < 3; k++) {
        const id = i * 3 + k;
        const pull = attractor ? ((k === 0 ? attractor.x * 8 - 4 : k === 1 ? 4 - attractor.y * 8 : 0) - p[id]) * 0.04 : 0;
        p[id] += dt * (this.delta[id] * 2 + pull);
        if (k === 2 && this.travel) { if (p[id] > 6) p[id] -= 36; else if (p[id] < -30) p[id] = -30; }
        else p[id] = Math.max(-12, Math.min(12, p[id]));
      }
      const noise = this.phaseNoise ? (this.random() - 0.5) * this.phaseNoise : 0;
      this.phase[i] = (this.phase[i] + dt * ((this.dp[i] + 0.1 + energy * 0.15) * this.phaseSpeed + noise) + TAU) % TAU;
      sumCos += Math.cos(this.phase[i]); sumSin += Math.sin(this.phase[i]);
      speed += Math.hypot(this.delta[i * 3], this.delta[i * 3 + 1], this.delta[i * 3 + 2]);
    }
    const r = Math.hypot(sumCos, sumSin) / n;
    this.activity = 0.5 * (1 - r) + 0.5 * Math.min(1, (speed / n) / 0.1);
  }
}
