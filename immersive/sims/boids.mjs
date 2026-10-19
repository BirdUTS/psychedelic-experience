/* Boids: separation, alignment, cohesion with bounded speed, in 3D.
   Director axes: H trades alignment for separation and adds wander, T scales speed, D sets the active fraction.
   inject() sweeps a transient repeller through the flock. */
import { seeded } from './physarum.mjs';

export class Boids {
  constructor(count = 360, seed = 42) {
    this.count = count;
    this.p = new Float32Array(count * 3); this.v = new Float32Array(count * 3); this.next = new Float32Array(count * 3);
    this.alignWeight = 0.8; this.separationWeight = 1.4; this.wander = 0; this.speedScale = 1;
    this.active = count; this.repeller = null; this.clock = 0;
    this.reset(seed);
  }
  reset(seed = 42) {
    const r = seeded(seed); this.random = r;
    for (let i = 0; i < this.p.length; i++) { this.p[i] = (r() - 0.5) * 22; this.v[i] = (r() - 0.5) * 2; }
  }
  setParams({ H, T, D } = {}) {
    if (H !== undefined) { this.alignWeight = 0.8 * (1.5 - H); this.separationWeight = 1.4 * (0.5 + H); this.wander = Math.max(0, 2 * (H - 0.5)); }
    if (T !== undefined) this.speedScale = 0.6 + 0.8 * T;
    if (D !== undefined) this.active = Math.max(2, Math.round(this.count * (0.3 + 0.7 * D)));
  }
  inject(random = Math.random) {
    this.repeller = { x: (random() - 0.5) * 16, y: (random() - 0.5) * 16, z: (random() - 0.5) * 16, until: this.clock + 3 };
  }
  step(dt, energy = 0, attractor = null) {
    this.clock += dt;
    if (this.repeller && this.clock > this.repeller.until) this.repeller = null;
    const p = this.p, v = this.v, n = this.active, rep = this.repeller;
    for (let i = 0; i < n; i++) {
      let count = 0, cx = 0, cy = 0, cz = 0, ax = 0, ay = 0, az = 0, sx = 0, sy = 0, sz = 0;
      const b = i * 3;
      for (let j = 0; j < n; j++) {
        if (i === j) continue;
        const a = j * 3, dx = p[a] - p[b], dy = p[a + 1] - p[b + 1], dz = p[a + 2] - p[b + 2], d2 = dx * dx + dy * dy + dz * dz;
        if (d2 < 16) {
          count++; cx += dx; cy += dy; cz += dz; ax += v[a]; ay += v[a + 1]; az += v[a + 2];
          if (d2 < 1.4) { const d = Math.max(0.02, d2); sx -= dx / d; sy -= dy / d; sz -= dz / d; }
        }
      }
      const separation = [sx, sy, sz], cohesion = [cx, cy, cz], align = [ax, ay, az];
      for (let k = 0; k < 3; k++) {
        let f = separation[k] * this.separationWeight + (count ? cohesion[k] / count * 0.3 + (align[k] / count - v[b + k]) * this.alignWeight : 0);
        f -= p[b + k] * Math.max(0, (Math.hypot(p[b], p[b + 1], p[b + 2]) - 9)) * 0.025;
        if (attractor) f += ((k === 0 ? attractor.x * 16 - 8 : k === 1 ? 8 - attractor.y * 16 : 0) - p[b + k]) * 0.1;
        if (rep) { const r = [rep.x, rep.y, rep.z]; const dd = Math.hypot(p[b] - rep.x, p[b + 1] - rep.y, p[b + 2] - rep.z); if (dd < 6) f += (p[b + k] - r[k]) / Math.max(0.3, dd) * 4; }
        if (this.wander) f += (this.random() - 0.5) * this.wander;
        const near = Math.hypot(p[b], p[b + 1], p[b + 2]);
        if (near < 2) f += p[b + k] / Math.max(0.1, near) * 3;
        this.next[b + k] = v[b + k] + f * dt;
      }
      const speed = (1.6 + energy * 3) * this.speedScale, len = Math.hypot(this.next[b], this.next[b + 1], this.next[b + 2]) || 1;
      for (let k = 0; k < 3; k++) this.next[b + k] *= speed / len;
    }
    const end = n * 3;
    for (let i = 0; i < end; i++) { v[i] = this.next[i]; p[i] += v[i] * dt; }
  }
}
