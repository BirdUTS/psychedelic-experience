/* Raw passages: the kaleidoscope is a climax, not the ground. The session opens on the world itself for one
   phrase; after that, three dressed phrases for every raw one; a landing jump shows the new world clean for its
   first phrase and restarts the count. Changes only on phrase boundaries or a landing. Pure. */
export class Passages {
  constructor({ dressed = 3 } = {}) { this.dressed = dressed; this.raw = true; this.count = 0; }
  update({ phrase = false, landed = false } = {}) {
    if (landed) { this.raw = true; this.count = 0; return this.raw; }
    if (!phrase) return this.raw;
    if (this.raw) { this.raw = false; this.count = 0; }
    else if (++this.count >= this.dressed) this.raw = true;
    return this.raw;
  }
}
