/* Snapshot ring and rewind dissolve ("the snow globe").
   Holds the last `keep` copies of a world's state arrays with the liveliness at capture time; a rewind
   dissolves the live arrays toward a chosen snapshot over a few seconds: continuous arrays lerp, arrays
   named in `discrete` switch element by element at random moments. Preallocated; pure. */
export class SnapshotRing {
  constructor(arrays, { keep = 4 } = {}) {
    this.live = arrays; this.keep = keep;
    this.slots = Array.from({ length: keep }, () => ({ arrays: arrays.map(a => new a.constructor(a.length)), L: 0, time: 0, used: false }));
    this.from = arrays.map(a => new a.constructor(a.length));
    this.next = 0; this.count = 0;
    this.target = null; this.progress = 0; this.seconds = 2; this.dissolving = false; this.switchAt = null;
  }
  capture(L, time = 0) {
    const slot = this.slots[this.next];
    for (let i = 0; i < this.live.length; i++) slot.arrays[i].set(this.live[i]);
    slot.L = L; slot.time = time; slot.used = true;
    this.next = (this.next + 1) % this.keep; this.count = Math.min(this.keep, this.count + 1);
    return this;
  }
  best() {
    let out = null;
    this.slots.forEach((s, index) => { if (s.used && (!out || s.L > out.L)) out = { index, L: s.L, time: s.time }; });
    return out;
  }
  rewindTo(index, { seconds = 2 } = {}) {
    const slot = this.slots[index];
    if (!slot || !slot.used) return false;
    for (let i = 0; i < this.live.length; i++) this.from[i].set(this.live[i]);
    this.target = slot; this.seconds = Math.max(0.05, seconds); this.progress = 0; this.dissolving = true; this.switchAt = null;
    return true;
  }
  update(dt, live = this.live, { discrete = [], random = Math.random } = {}) {
    if (!this.dissolving) return 1;
    this.progress = Math.min(1, this.progress + dt / this.seconds);
    const u = this.progress, done = u >= 1 - 1e-9;
    if (!this.switchAt) this.switchAt = live.map((a, i) => discrete.includes(i) ? Float32Array.from({ length: a.length }, () => random()) : null);
    for (let i = 0; i < live.length; i++) {
      const to = this.target.arrays[i], from = this.from[i], out = live[i], sw = this.switchAt[i];
      if (done) { out.set(to); continue; }
      if (sw) for (let j = 0; j < out.length; j++) out[j] = u >= sw[j] ? to[j] : from[j];
      else for (let j = 0; j < out.length; j++) out[j] = from[j] + (to[j] - from[j]) * u;
    }
    if (done) { this.dissolving = false; this.target = null; this.switchAt = null; }
    return done ? 1 : u;
  }
}
