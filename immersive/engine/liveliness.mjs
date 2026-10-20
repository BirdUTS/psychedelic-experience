/* Liveliness: how alive a world still is, 0..1, normalised against its own early vigour.
   Each sim reports a raw `activity` per step; this smooths it and divides by the maximum seen
   during the reference window after the last reset. Pure. */
const clamp01 = v => v < 0 ? 0 : v > 1 ? 1 : v;

export class Liveliness {
  // The reference is the peak smoothed activity between referenceFrom and referenceSeconds after a reset:
  // the first moments after seeding are a birth burst, not a vigour the world can sustain.
  constructor({ referenceSeconds = 10, referenceFrom = 3, smoothing = 2 } = {}) {
    this.referenceSeconds = referenceSeconds; this.referenceFrom = Math.min(referenceFrom, referenceSeconds); this.smoothing = smoothing;
    this.worlds = new Map();
  }
  state(world) {
    let s = this.worlds.get(world);
    if (!s) { s = { smoothed: 0, ref: 0, age: 0, has: false }; this.worlds.set(world, s); }   // first observation starts the reference window
    return s;
  }
  reset(world) { const s = this.state(world); s.smoothed = 0; s.ref = 0; s.age = 0; s.has = false; }
  observe(world, raw, dt) {
    if (!(dt > 0) || !Number.isFinite(raw)) return this;
    const s = this.state(world);
    s.smoothed += (Math.max(0, raw) - s.smoothed) * (1 - Math.exp(-dt / this.smoothing));
    s.age += dt;
    if (s.age >= this.referenceFrom && s.age <= this.referenceSeconds) { s.ref = Math.max(s.ref, s.smoothed); s.has = s.ref > 0; }
    return this;
  }
  value(world) {
    const s = this.worlds.get(world);
    if (!s || !s.has) return 1;
    return clamp01(s.smoothed / Math.max(s.ref, 1e-6));
  }
  reference(world) { return this.worlds.get(world)?.ref ?? 0; }
}
