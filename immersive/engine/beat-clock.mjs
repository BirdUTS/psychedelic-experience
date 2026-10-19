/* Music beat clock (phase-locked to onsets, latency-compensated), the coupled world clock,
   and a per-phase energy predictor. Phases are in cycles, [0,1). Pure and deterministic. */
const TAU = Math.PI * 2;
const wrap = x => ((x % 1) + 1) % 1;

export class BeatClock {
  constructor({ latency = 0, kappa = 0.3 } = {}) {
    this.latency = latency; this.kappa = kappa;
    this.internal = 0; this.phase = 0; this.bpm = 120;
    this.beatIndex = 0; this.wrapped = false;
  }
  setLatency(seconds) { this.latency = Number.isFinite(seconds) ? Math.max(0, seconds) : 0; }
  update(dt, { onset = 0, bpm = this.bpm, C = 0 } = {}) {
    if (Number.isFinite(bpm) && bpm > 0) this.bpm = bpm;
    let p = this.internal + dt * this.bpm / 60;
    if (onset > 0) p += this.kappa * Math.min(1, onset) * Math.sin(-TAU * wrap(p));
    this.internal = wrap(p);
    const previous = this.phase;
    this.phase = wrap(this.internal + this.latency * this.bpm / 60);
    this.wrapped = this.phase < previous && previous - this.phase > 0.5;
    if (this.wrapped) this.beatIndex++;
    return this;
  }
  distanceToBeat() { const d = this.phase; return d > 0.5 ? 1 - d : d; }
}

export class WorldClock {
  constructor({ Kmax = 6, phiMax = 0.12, gamma = 3 } = {}) {
    this.Kmax = Kmax; this.phiMax = phiMax; this.gamma = gamma;
    this.phase = 0; this.omega = 1;
  }
  update(dt, { musicPhase = 0, C = 0, I = 0, omega = this.omega, musicHz = null } = {}) {
    if (Number.isFinite(omega)) this.omega = omega;
    // Frequency entrainment: in a groove the world's own tempo relaxes to the beat's; free-running it keeps omega.
    const effective = Number.isFinite(musicHz) && musicHz > 0 ? this.omega + (musicHz - this.omega) * C : this.omega;
    // Advance by the natural frequency first so the pull compares phases at the same instant
    // as the musicPhase supplied for this frame (otherwise a dt·omega bias appears in the offset).
    const predicted = this.phase + dt * effective;
    const target = musicPhase + I * this.phiMax;
    const pull = this.Kmax * C * Math.sin(TAU * (target - predicted)) / TAU;
    this.phase = wrap(predicted + dt * pull);
    return this;
  }
  pulse() { return Math.pow(Math.max(0, Math.cos(TAU * this.phase)), this.gamma); }
}

export class BeatPredictor {
  constructor(bins = 8) {
    this.bins = bins; this.values = new Float32Array(bins); this.seen = new Uint8Array(bins);
  }
  index(phase) { return Math.min(this.bins - 1, Math.floor(wrap(phase) * this.bins)); }
  observe(phase, E) {
    const i = this.index(phase);
    if (this.seen[i]) this.values[i] += (E - this.values[i]) * 0.3; else { this.values[i] = E; this.seen[i] = 1; }
  }
  predict(phase) { const i = this.index(phase); return this.seen[i] ? this.values[i] : null; }
  reset() { this.values.fill(0); this.seen.fill(0); }
}
