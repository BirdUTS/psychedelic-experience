/* The ship: the viewer's motion through a world (v2 §4.1). Hover by default (speed 0); launch() starts
   forward motion with a 2 s ramp. Dives engage on a sustained build with coherence and release on the drop.
   Every angle moves at most maxTurnRate degrees per second; roll banks into turns. Pure. */
import { seeded } from '../sims/physarum.mjs';
const clamp = (v, lo, hi) => v < lo ? lo : v > hi ? hi : v;
const approach = (cur, target, maxStep) => { const d = target - cur; return Math.abs(d) <= maxStep ? target : cur + Math.sign(d) * maxStep; };

export class Ship {
  constructor({ base = 2, perT = 4, ramp = 2, maxTurnRate = 20, maxRoll = 12, diveSpeed = 2.5, divePitch = 25, seed = 7 } = {}) {
    this.base = base; this.perT = perT; this.ramp = ramp; this.maxTurnRate = maxTurnRate; this.maxRoll = maxRoll;
    this.diveSpeed = diveSpeed; this.divePitch = divePitch; this.random = seeded(seed);
    this.mode = 'hover'; this.speed = 0; this.yaw = 0; this.pitch = 0; this.roll = 0; this.heading = 0;
    this.diving = false; this.trimValue = 1; this.steerYaw = 0; this.steerPitch = 0;
    this.headingTarget = 0; this.buildFor = 0; this.dropFor = 0; this.clock = 0;
  }
  launch() { this.mode = 'ship'; }
  hover() { this.mode = 'hover'; this.diving = false; this.buildFor = 0; }
  toggle() { if (this.mode === 'ship') this.hover(); else this.launch(); }
  trim(delta) { this.trimValue = clamp(this.trimValue + (Number.isFinite(delta) ? delta : 0), 0.5, 1.5); }
  steer(dyaw, dpitch) { this.steerYaw += dyaw || 0; this.steerPitch += dpitch || 0; }
  get maxSpeed() { return 3 * (this.base + this.perT); }
  update(dt, { T = 0.5, pulse = 0, intensity = 0.8, phraseBoundary = false, energyTrend = 0, C = 0, drop = false } = {}) {
    if (!(dt > 0)) return this;
    this.clock += dt;
    const flying = this.mode === 'ship';
    // The dive: a sustained build with coherence pitches the ship down and speeds it up; the drop releases.
    if (flying) {
      if (energyTrend > 0 && C > 0.5) this.buildFor += dt; else this.buildFor = 0;
      if (!this.diving && this.buildFor >= 8) { this.diving = true; this.dropFor = 0; }
      if (this.diving) {
        if (energyTrend <= 0) this.dropFor += dt; else this.dropFor = 0;
        if (drop || this.dropFor >= 2) { this.diving = false; this.buildFor = 0; }
      }
    }
    // Speed with a 2 s ramp, bounded.
    const t = clamp(T, 0, 1), target = flying
      ? clamp((this.base + this.perT * t) * (1 + 0.6 * clamp(pulse, 0, 1) * clamp(intensity, 0, 1.5)) * this.trimValue * (this.diving ? this.diveSpeed : 1), 0, this.maxSpeed)
      : 0;
    this.speed += (target - this.speed) * (1 - Math.exp(-dt * 3 / this.ramp));
    if (Math.abs(this.speed - target) < 1e-3) this.speed = target;
    // Heading wanders slowly and turns 20–40° on a phrase boundary.
    if (phraseBoundary && flying) this.headingTarget += (this.random() < 0.5 ? -1 : 1) * (20 + this.random() * 20);
    const wander = flying ? 4 * Math.sin(2 * Math.PI * 0.05 * this.clock) : 0;
    // User steering offsets decay back over ~6 s.
    const decay = Math.exp(-dt / 2);
    this.steerYaw *= decay; this.steerPitch *= decay;
    const step = this.maxTurnRate * dt, prevYaw = this.yaw;
    this.yaw = approach(this.yaw, this.steerYaw, step);
    this.pitch = approach(this.pitch, this.steerPitch + (this.diving ? -this.divePitch : 0), step);
    this.heading = approach(this.heading, this.headingTarget + wander, step);
    const rollTarget = flying ? clamp(-((this.yaw - prevYaw) / dt) * 0.6, -this.maxRoll, this.maxRoll) : 0;
    this.roll = approach(this.roll, rollTarget, step);
    return this;
  }
}
