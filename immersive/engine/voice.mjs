/* Your voice as a signal for the picture: the room's speech-likeness (or a clap's onset) becomes a 0..1 envelope
   that rises within a few frames and falls over about a second. Features of sound only — no words, nothing
   recorded or sent. Pure. */
export class VoiceEnvelope {
  constructor({ attack = 0.04, release = 0.5 } = {}) { this.attack = attack; this.release = release; this.value = 0; }
  update(dt, { speech = 0, onset = 0 } = {}) {
    if (!(dt > 0)) return this.value;
    const s = Number.isFinite(speech) ? speech : 0, o = Number.isFinite(onset) ? onset : 0;
    const target = Math.max(0, Math.min(1, Math.max(s, o)));
    const tau = target > this.value ? this.attack : this.release;
    this.value += (target - this.value) * (1 - Math.exp(-dt / tau));
    return this.value;
  }
}
