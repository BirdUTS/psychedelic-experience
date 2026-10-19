/* Playlist: which demo track plays, auto-advance and loop. Pure. */
export class Playlist {
  constructor(tracks = []) { this.loop = true; this.auto = true; this.setTracks(tracks); }
  setTracks(tracks = []) { this.tracks = Array.isArray(tracks) ? [...tracks] : []; this.index = this.tracks.length ? 0 : -1; }
  current() { return this.tracks[this.index] ?? null; }
  select(i) {
    if (!Number.isInteger(i) || i < 0 || i >= this.tracks.length) return null;
    this.index = i; return this.current();
  }
  next() {
    if (!this.tracks.length) return null;
    if (this.index + 1 < this.tracks.length) { this.index++; return this.current(); }
    if (this.loop) { this.index = 0; return this.current(); }
    return null;
  }
}
