/* Agency: how much the person (or the room) is acting, as opposed to the music merely playing.
   Built from off-beat onsets, speech-likeness, energy surprise and gesture rate. Not an emotion. */
const clamp01 = v => v < 0 ? 0 : v > 1 ? 1 : v;

export class Agency {
  constructor({ attack = 0.5, release = 5, beatGate = 0.15,
                weights = { onset: 0.6, speech: 0.7, gesture: 0.5, energy: 0.4 } } = {}) {
    this.attack = attack; this.release = release; this.beatGate = beatGate; this.weights = weights;
    this.A = 0; this.As = 0; this.g = 0;
  }
  gesture(n = 1) { this.g += n; }
  update(dt, { roomOnset = 0, speech = 0, beatDistance = 0.5, C = 0, actualE = 0, predictedE = null } = {}) {
    if (!(dt > 0)) return this;
    const w = this.weights;
    const onBeat = C > 0.4 && beatDistance < this.beatGate;
    const onsetTerm = onBeat ? 0 : clamp01(roomOnset);
    const energyTerm = predictedE == null ? 0 : clamp01((Math.abs(actualE - predictedE) - 0.25) / 0.75);
    this.g *= Math.exp(-dt);
    const gestureTerm = Math.min(1, this.g / 3);
    this.A = clamp01(w.onset * onsetTerm + w.speech * clamp01(speech) + w.gesture * gestureTerm + w.energy * energyTerm);
    const tau = this.A > this.As ? this.attack : this.release;
    this.As += (this.A - this.As) * (1 - Math.exp(-dt / tau));
    return this;
  }
}
