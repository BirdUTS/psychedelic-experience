/* Initiative: the one dial between the world leading (+1) and following (−1).
   On Auto it rests at a baseline I0 and yields quickly when Agency rises, resuming slowly.
   Locked, nothing automatic or remote may move it. */
const clamp = (v, lo, hi) => v < lo ? lo : v > hi ? hi : v;

export class Initiative {
  constructor({ I0 = 0.3, tauYield = 1, tauResume = 3 } = {}) {
    this.I0 = clamp(I0, -0.6, 0.6); this.tauYield = tauYield; this.tauResume = tauResume;
    this.I = this.I0; this.locked = false;
  }
  lock(value) { this.locked = true; this.I = clamp(Number.isFinite(value) ? value : this.I, -1, 1); }
  unlock() { this.locked = false; }
  setBaseline(v) { if (Number.isFinite(v)) this.I0 = clamp(v, -0.6, 0.6); }
  update(dt, As = 0) {
    if (this.locked || !(dt > 0)) return this;
    const auto = clamp(this.I0 - (1 + this.I0) * clamp(As, 0, 1), -1, 1);
    const tau = auto < this.I ? this.tauYield : this.tauResume;
    this.I += (auto - this.I) * (1 - Math.exp(-dt / tau));
    return this;
  }
  get lambda() { return (this.I + 1) / 2; }
}
