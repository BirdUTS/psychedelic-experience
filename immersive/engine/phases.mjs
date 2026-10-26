/* Phase integrators for the shader stack (v3 review C2). A phase must be the integral of its rate, not
   rate × absolute time: with rate × time, any change of the rate jumps the phase by Δrate × elapsed time,
   which after minutes of play is a full-frame strobe. Pure; advanced only while the world is not paused. */
const TAU = Math.PI * 2;
const clamp = (v, lo, hi) => (v = Number(v) || 0) < lo ? lo : v > hi ? hi : v;
export const RATES = { warp: 2.3, tunnel: 1.2, form: 1.5, hue: 0.3 };   // the fastest each phase may move per second

export class Phases {
  constructor() { this.warp = 0; this.tunnel = 0; this.form = 0; this.hue = 0; }
  advance(dt, p = {}) {
    if (!(dt > 0)) return this.value();
    this.warp += (0.3 + 2 * clamp(p.warpRate, 0, 1)) * dt;
    this.tunnel += RATES.tunnel * clamp(p.tunnelSpeed, 0, 1) * dt;
    this.form += RATES.form * clamp(p.formDrift, -1, 1) * dt;
    this.hue += RATES.hue * clamp(p.chromaCycle, 0, 1) * dt;
    return this.value();
  }
  value() { return { warp: this.warp, tunnel: this.tunnel, form: this.form, hue: this.hue }; }
  // Wrapped onto each function's own period for the shader's float32 (sin / cos: 2π; the tunnel's triangle wave: 2).
  wrapped() { return { warp: this.warp % TAU, tunnel: this.tunnel % 2, form: this.form % TAU, hue: this.hue % TAU }; }
}
