/* Per-stream audio features from AnalyserNode byte frequency data.
   Pure: no DOM, no WebGL. Fixed buffers, no per-frame allocation.
   These are features of sound, not states of mind. */
export const BANDS = { bass:[20,250], mid:[250,2000], high:[2000,12000], voice:[300,3000] };

const TAU = Math.PI*2;
const clamp01 = v => v < 0 ? 0 : v > 1 ? 1 : v;
const blend = (cur, target, dt, tau) => cur + (target - cur) * (1 - Math.exp(-dt / tau));

export class AudioFeatures {
  constructor({ sampleRate = 48000, fftSize = 2048, frameRate = 60 } = {}) {
    this.sampleRate = sampleRate; this.fftSize = fftSize; this.frameRate = frameRate;
    this.binCount = fftSize / 2;
    const hzPerBin = sampleRate / fftSize;
    this.range = {};
    for (const k in BANDS) {
      const [lo, hi] = BANDS[k];
      this.range[k] = [Math.max(1, Math.ceil(lo / hzPerBin)), Math.min(this.binCount, Math.floor(hi / hzPerBin))];
    }
    this.fluxEnd = this.range.high[1];
    this.hzPerBin = hzPerBin;
    this.prev = new Float32Array(this.binCount);
    // Flux is resampled onto fixed ticks of 1/frameRate so a 120 Hz or 30 Hz display measures the same tempo.
    this.tick = 1 / frameRate;
    this.fluxRing = new Float32Array(Math.max(8, Math.round(frameRate)));
    this.tempoRing = new Float32Array(Math.max(32, Math.round(frameRate * 4)));
    this.minLag = Math.floor(frameRate * 60 / 180);
    this.maxLag = Math.ceil(frameRate * 60 / 60);
    this.acf = new Float32Array(this.maxLag + 1);
    this.bands = { bass:0, mid:0, high:0, voice:0 };
    this.reset();
  }

  reset() {
    this.E = 0; this.onset = 0; this.B = 0; this.speech = 0; this.C = 0; this.bpm = 120; this.flux = 0;
    this.bands.bass = this.bands.mid = this.bands.high = this.bands.voice = 0;
    this.prev.fill(0);
    this.fluxRing.fill(0); this.fluxPos = 0; this.fluxFilled = 0;
    this.tempoRing.fill(0); this.tempoPos = 0; this.tempoFilled = 0;
    this.tickAcc = 0; this.pendingFlux = 0;
    this.floor = 0; this.ceil = 0.15;
    this.sinceOnset = 1;
    this.acfTimer = 0; this.cRaw = 0; this.windowMean = 0;
    this.candidate = 0; this.candidateCount = 0;
    this.lp8 = 0; this.lp2 = 0; this.modAbs = 0; this.vMean = 0;
    this.quiet = true;
  }

  band(bins, name) {
    const [lo, hi] = this.range[name];
    let sum = 0;
    for (let i = lo; i < hi; i++) sum += bins[i];
    const n = Math.max(1, hi - lo);
    return Math.min(1, sum / n / 255 * 1.5);
  }

  update(bins, dt) {
    if (!(dt > 0)) return this;
    this.sinceOnset += dt;
    if (!bins) return this.updateSilent(dt);

    const b = this.bands;
    b.bass = this.band(bins, 'bass'); b.mid = this.band(bins, 'mid'); b.high = this.band(bins, 'high'); b.voice = this.band(bins, 'voice');
    const L = 0.6 * b.bass + 0.3 * b.mid + 0.1 * b.high;

    // Adaptive loudness range: floor tracks the minimum, ceiling the maximum, span never below 0.15.
    if (L < this.floor) this.floor = L; else this.floor += 0.02 * dt;
    if (L > this.ceil) this.ceil = L; else this.ceil -= 0.05 * dt;
    if (this.ceil < this.floor + 0.15) this.ceil = this.floor + 0.15;
    if (this.floor > this.ceil - 0.15) this.floor = this.ceil - 0.15;
    const eRaw = clamp01((L - this.floor) / (this.ceil - this.floor));
    this.E = blend(this.E, eRaw, dt, eRaw > this.E ? 0.08 : 0.6);
    if (this.E < 1e-3 && eRaw === 0) this.E = 0;

    // Spectral flux over 20 Hz .. 12 kHz, normalised to 0..1.
    let flux = 0, centroid = 0, mass = 0;
    const end = this.fluxEnd, prev = this.prev;
    for (let i = 1; i < end; i++) {
      const v = bins[i], d = v - prev[i];
      if (d > 0) flux += d;
      centroid += i * v; mass += v;
      prev[i] = v;
    }
    flux /= (end - 1) * 255;
    this.flux = flux;
    this.B = blend(this.B, mass > 0 ? clamp01(centroid / mass * this.hzPerBin / 6000) : 0, dt, 1);

    // Onset: flux above mean + 1.5 std of the last second, 100 ms refractory.
    const ring = this.fluxRing, n = ring.length;
    let mean = 0, sq = 0;
    const filled = Math.max(1, this.fluxFilled);
    for (let i = 0; i < filled; i++) { mean += ring[i]; sq += ring[i] * ring[i]; }
    mean /= filled; const variance = Math.max(0, sq / filled - mean * mean);
    const thr = mean + 1.5 * Math.sqrt(variance);
    if (this.fluxFilled >= 8 && flux > thr && thr > 0 && this.sinceOnset >= 0.1) {
      this.onset = Math.min(1, (flux - thr) / thr); this.sinceOnset = 0;
    } else this.onset = 0;
    this.pushFlux(flux, dt);

    // Periodic autocorrelation over the 4 s tempo ring.
    this.acfTimer += dt;
    if (this.acfTimer >= 0.5 && this.tempoFilled >= this.tempoRing.length) { this.acfTimer = 0; this.estimateTempo(); }
    this.quiet = this.windowMean < 0.001;
    this.C = this.quiet ? blend(this.C, 0, dt, 3) : blend(this.C, this.cRaw, dt, 3);

    // Speech-likeness: 2–8 Hz modulation of the voice band relative to its mean.
    const v = b.voice;
    this.lp8 = blend(this.lp8, v, dt, 1 / (TAU * 8));
    this.lp2 = blend(this.lp2, v, dt, 1 / (TAU * 2));
    // Numerator and denominator share one time constant and the denominator has a noise floor,
    // so speech-likeness falls within ~2 s of the voice stopping instead of lingering as the band fades.
    const mod = this.lp8 - this.lp2;
    this.modAbs = blend(this.modAbs, Math.abs(mod), dt, 0.4);
    this.vMean = blend(this.vMean, v, dt, 0.4);
    this.speech = blend(this.speech, clamp01(5 * this.modAbs / (this.vMean + 0.08)), dt, 0.3);
    return this;
  }

  updateSilent(dt) {
    const b = this.bands;
    b.bass = b.mid = b.high = b.voice = 0;
    this.E = blend(this.E, 0, dt, 0.6); if (this.E < 1e-3) this.E = 0;
    this.onset = 0; this.flux = 0;
    this.B = blend(this.B, 0, dt, 1);
    this.C = blend(this.C, 0, dt, 0.5); if (this.C < 1e-4) this.C = 0;
    this.speech = blend(this.speech, 0, dt, 0.3);
    this.modAbs = blend(this.modAbs, 0, dt, 0.4); this.vMean = blend(this.vMean, 0, dt, 0.4);
    this.lp8 = blend(this.lp8, 0, dt, 1 / (TAU * 8)); this.lp2 = blend(this.lp2, 0, dt, 1 / (TAU * 2));
    this.pushFlux(0, dt);
    this.windowMean = blend(this.windowMean, 0, dt, 1);
    this.quiet = true;
    return this;
  }

  // Resample flux onto fixed ticks: the peak since the last tick goes in, extra ticks (slow frames) get zeros.
  pushFlux(flux, dt) {
    this.pendingFlux = Math.max(this.pendingFlux, flux);
    this.tickAcc += dt;
    let first = true;
    while (this.tickAcc >= this.tick - 1e-9) {
      this.tickAcc -= this.tick;
      const v = first ? this.pendingFlux : 0;
      const ring = this.fluxRing; ring[this.fluxPos] = v; this.fluxPos = (this.fluxPos + 1) % ring.length; if (this.fluxFilled < ring.length) this.fluxFilled++;
      const tr = this.tempoRing; tr[this.tempoPos] = v; this.tempoPos = (this.tempoPos + 1) % tr.length; if (this.tempoFilled < tr.length) this.tempoFilled++;
      first = false;
    }
    if (!first) this.pendingFlux = 0;
  }

  estimateTempo() {
    const x = this.tempoRing, n = x.length, acf = this.acf;
    let mean = 0; for (let i = 0; i < n; i++) mean += x[i]; mean /= n;
    this.windowMean = mean;
    let norm = 0; for (let i = 0; i < n; i++) { const d = x[i] - mean; norm += d * d; }
    if (norm <= 0) { this.cRaw = 0; return; }
    for (let lag = this.minLag; lag <= this.maxLag; lag++) {
      let s = 0;
      for (let i = 0; i + lag < n; i++) s += (x[i] - mean) * (x[i + lag] - mean);
      acf[lag] = s / norm * n / (n - lag);
    }
    let bestBpm = this.bpm, bestScore = -Infinity, bestC = 0;
    for (let bpm = 60; bpm <= 180; bpm++) {
      const lag = this.frameRate * 60 / bpm;
      const l0 = Math.floor(lag), l1 = Math.min(this.maxLag, l0 + 1), t = lag - l0;
      if (l0 < this.minLag || l0 > this.maxLag) continue;
      const a = acf[l0] * (1 - t) + acf[l1] * t;
      const z = (bpm - 110) / 40;
      const prior = Math.max(0.5, Math.exp(-0.5 * z * z));
      const score = a * prior;
      if (score > bestScore) { bestScore = score; bestBpm = bpm; bestC = a; }
    }
    this.cRaw = clamp01(bestC);
    const change = Math.abs(bestBpm - this.bpm) / this.bpm;
    if (change > 0.15) {
      // A big change must be seen twice in a row before the clock snaps to it.
      if (Math.abs(bestBpm - this.candidate) / bestBpm < 0.05) this.candidateCount++; else this.candidateCount = 1;
      this.candidate = bestBpm;
      if (this.candidateCount >= 2 && this.cRaw > 0.4) { this.bpm = bestBpm; this.candidateCount = 0; }
    } else {
      this.candidateCount = 0;
      this.bpm = blend(this.bpm, bestBpm, 0.5, 4);
    }
  }
}
