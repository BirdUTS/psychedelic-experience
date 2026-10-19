/* Swarmalators: position and internal phase couple both ways (O'Keeffe, Hong & Strogatz), extended to 3D.
   Director axes: H flips coupling from synchrony (H 0) through neutral (H 0.5) to anti-synchrony (H 1) and adds phase noise,
   T scales phase speed, D sets the active fraction. inject() flips the coupling sign for two beats. */
import { seeded } from './physarum.mjs';

export class Swarmalators {
  constructor(count = 260, seed = 31) {
    this.count = count;
    this.p = new Float32Array(count * 3); this.phase = new Float32Array(count);
    this.delta = new Float32Array(count * 3); this.dp = new Float32Array(count); this.omega = new Float32Array(count);
    this.couplingScale = 1; this.antiCoupling = 0; this.phaseNoise = 0; this.phaseSpeed = 1;
    this.active = count; this.flipUntil = 0; this.clock = 0;
    this.reset(seed);
  }
  reset(seed = 31) {
    const r = seeded(seed); this.random = r;
    for (let i = 0; i < this.count; i++) {
      this.p.set([(r() - 0.5) * 10, (r() - 0.5) * 10, (r() - 0.5) * 10], i * 3);
      this.phase[i] = r() * Math.PI * 2; this.omega[i] = (r() - 0.5) * 0.08;
    }
  }
  setParams({ H, T, D } = {}) {
    if (H !== undefined) { this.couplingScale = 2 * (1 - H); this.antiCoupling = 2 * Math.max(0, H - 0.5); this.phaseNoise = 0.3 * Math.max(0, H - 0.5); }
    if (T !== undefined) this.phaseSpeed = 0.6 + 0.8 * T;
    if (D !== undefined) this.active = Math.max(2, Math.round(this.count * (0.3 + 0.7 * D)));
  }
  inject(random = Math.random, beatSeconds = 0.5) { this.flipUntil = this.clock + 2 * beatSeconds; }
  step(dt, energy = 0, coupling = 0.7, attractor = null) {
    this.clock += dt;
    let K = coupling * this.couplingScale - this.antiCoupling * Math.abs(coupling);
    if (this.clock < this.flipUntil) K = -K;
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
    for (let i = 0; i < n; i++) {
      for (let k = 0; k < 3; k++) {
        const id = i * 3 + k;
        const pull = attractor ? ((k === 0 ? attractor.x * 8 - 4 : k === 1 ? 4 - attractor.y * 8 : 0) - p[id]) * 0.04 : 0;
        p[id] += dt * (this.delta[id] * 2 + pull);
        p[id] = Math.max(-12, Math.min(12, p[id]));
      }
      const noise = this.phaseNoise ? (this.random() - 0.5) * this.phaseNoise : 0;
      this.phase[i] = (this.phase[i] + dt * ((this.dp[i] + 0.1 + energy * 0.15) * this.phaseSpeed + noise) + Math.PI * 2) % (Math.PI * 2);
    }
  }
}
