/* Music beat clock (phase-locked to onsets, latency-compensated), the coupled world clock,
   and a per-phase energy predictor. Phases are in cycles, [0,1). Pure and deterministic. */
const TAU = Math.PI * 2;
const wrap = x => ((x % 1) + 1) % 1;

export class BeatClock {
  constructor({ latency = 0, kappa = 0.3 } = {}) {
    this.latency = latency; this.kappa = kappa;
    this.cycles = 0;          // unwrapped internal phase, cycles
    this.phase = 0; this.bpm = 120;
    this.beatIndex = 0; this.wrapped = false; this.lastBeat = 0;
    this.recent = new Float32Array(8); this.recentPos = 0; this.recentCount = 0;   // beat distance of the last 8 onsets
  }
  // Lock quality: the share of recent onsets that landed near the beat. Once at least half do, the clock is
  // tracking and onsets far from the beat are treated as accents rather than corrections (a gated PLL);
  // until then every onset corrects it (acquisition).
  lockQuality() {
    if (!this.recentCount) return 0;
    let near = 0;
    for (let i = 0; i < this.recentCount; i++) if (this.recent[i] < 0.15) near++;
    return near / this.recentCount;
  }
  get internal() { return wrap(this.cycles); }
  setLatency(seconds) { this.latency = Number.isFinite(seconds) ? Math.max(0, seconds) : 0; }
  update(dt, { onset = 0, bpm = this.bpm, C = 0 } = {}) {
    if (Number.isFinite(bpm) && bpm > 0) this.bpm = bpm;
    let c = this.cycles + dt * this.bpm / 60;
    // PLL kick toward the nearest beat: at most kappa/(2π) ≈ 0.05 cycle per onset, so off-beat
    // hats nudge rather than yank, and onsets on the beat barely move it.
    if (onset > 0) {
      const p = wrap(c), dist = p > 0.5 ? 1 - p : p;
      const gate = this.lockQuality() >= 0.5 ? Math.max(0, 1 - dist / 0.3) : 1;
      c += this.kappa * Math.min(1, onset) * Math.sin(-TAU * p) / TAU * gate;
      this.recent[this.recentPos] = dist; this.recentPos = (this.recentPos + 1) % this.recent.length;
      if (this.recentCount < this.recent.length) this.recentCount++;
    }
    this.cycles = c;
    const reported = c + this.latency * this.bpm / 60;
    this.phase = wrap(reported);
    // Beats are counted from the unwrapped phase, so a backward correction across a beat un-counts it
    // instead of counting the same beat twice.
    const beat = Math.floor(reported);
    this.wrapped = beat > this.lastBeat;
    this.beatIndex += beat - this.lastBeat;
    this.lastBeat = beat;
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
    // Frequency entrainment: in a groove the world's own tempo locks to the beat's (fully once C ≥ 0.6);
    // free-running it keeps omega.
    const lock = Math.min(1, C / 0.6);
    const effective = Number.isFinite(musicHz) && musicHz > 0 ? this.omega + (musicHz - this.omega) * lock : this.omega;
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
