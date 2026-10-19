/* Dual-stream audio graph. The in-app player and the room microphone may run at the same time:
   the player (or the mic when nothing plays) is the MUSIC stream; the mic alongside a playing track is the ROOM stream.
   The microphone is analysed only, never routed to the speakers. One AudioContext for the page. */
const FFT = 2048, SMOOTHING = 0.55;

export class AudioGraph {
  constructor(playerEl) {
    this.player = playerEl;
    this.context = null;
    this.playerSource = null; this.playerAnalyser = null;
    this.micStream = null; this.micSource = null; this.micAnalyser = null; this.micOn = false;
    this.synthetic = false;
    this.musicBins = new Uint8Array(FFT / 2); this.roomBins = new Uint8Array(FFT / 2); this.synthBins = new Uint8Array(FFT / 2);
  }
  ensureContext() {
    if (!this.context) this.context = new (window.AudioContext || window.webkitAudioContext)();
    return this.context;
  }
  async resume() {
    const c = this.ensureContext();
    try { if (c.state !== 'running') await c.resume(); } catch { /* needs a user gesture */ }
    return c.state === 'running';
  }
  analyser() { const a = this.ensureContext().createAnalyser(); a.fftSize = FFT; a.smoothingTimeConstant = SMOOTHING; return a; }
  async startPlayer() {
    const c = this.ensureContext();
    if (!this.playerSource) {
      this.playerSource = c.createMediaElementSource(this.player);
      this.playerAnalyser = this.analyser();
      this.playerSource.connect(this.playerAnalyser);
      this.playerAnalyser.connect(c.destination);
    }
    return this.resume();
  }
  async startMic() {
    try {
      const c = this.ensureContext(); await this.resume();
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false } });
      this.stopMic();
      this.micStream = stream;
      this.micSource = c.createMediaStreamSource(stream);
      this.micAnalyser = this.analyser();
      this.micSource.connect(this.micAnalyser);
      for (const track of stream.getTracks()) track.addEventListener('ended', () => this.stopMic());
      this.micOn = true;
      return true;
    } catch { this.micOn = false; return false; }
  }
  stopMic() {
    this.micStream?.getTracks().forEach(t => t.stop());
    this.micSource?.disconnect();
    this.micStream = null; this.micSource = null; this.micAnalyser = null; this.micOn = false;
  }
  setSynthetic(on) { this.synthetic = !!on; }
  get playing() { return !!this.playerSource && !this.player.paused && !this.player.ended && this.player.readyState >= 2; }
  frames(time = 0) {
    let music = null, room = null, source = 'none';
    if (this.playing) {
      this.playerAnalyser.getByteFrequencyData(this.musicBins); music = this.musicBins; source = 'player';
      if (this.micOn) { this.micAnalyser.getByteFrequencyData(this.roomBins); room = this.roomBins; }
    } else if (this.micOn) {
      this.micAnalyser.getByteFrequencyData(this.musicBins); music = this.musicBins; source = 'mic';
    } else if (this.synthetic) {
      this.fillSynthetic(time); music = this.synthBins; source = 'synthetic';
    }
    return { music, room, source, sampleRate: this.context ? this.context.sampleRate : 48000 };
  }
  // Clearly labelled synthetic beat (120 BPM kick, off-beat hats, slow pad). Not a recording, not a microphone.
  fillSynthetic(time) {
    const sr = this.context ? this.context.sampleRate : 48000, hz = i => i * sr / FFT, bins = this.synthBins;
    const beat = (time % 0.5) / 0.5, kick = Math.exp(-beat * 9), hat = Math.exp(-(((time + 0.25) % 0.5) / 0.5) * 14);
    const pad = 0.55 + 0.35 * Math.sin(time * 0.7), bar = (time % 8) / 8, build = bar < 0.75 ? bar / 0.75 : 0;
    for (let i = 0; i < bins.length; i++) {
      const f = hz(i); let v = 10;
      if (f >= 40 && f < 180) v += 220 * kick;
      else if (f >= 250 && f < 2000) v += 70 * pad * (0.6 + 0.4 * build);
      else if (f >= 4000 && f < 11000) v += 120 * hat * (0.3 + 0.7 * build);
      bins[i] = Math.min(255, Math.max(0, Math.round(v)));
    }
  }
  latency() {
    const c = this.context, sr = c ? c.sampleRate : 48000;
    const analyser = (FFT / 2) / sr + 1 / 60;
    const output = c ? (c.baseLatency || 0) + (c.outputLatency || 0) : 0;
    return { music: analyser + (this.playing ? output : 0), room: analyser };
  }
  close() { this.stopMic(); try { this.context?.close(); } catch { /* already closed */ } }
}
