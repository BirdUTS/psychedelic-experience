/* Conway's Life (B3/S23, toroidal, synchronous) from extra-dynamics.js, wrapped for the director.
   H adds random births per generation and inject() seeds a glider: both are a LABELLED CREATIVE VARIANT,
   disabled entirely while `pure` is true. T sets generations per beat; D is kept for rendering. */
import '../../extra-dynamics.js';
import { seeded } from './physarum.mjs';
const { LifeGrid } = globalThis.ExtraDynamics;
const GLIDER = [[1, 0], [2, 1], [0, 2], [1, 2], [2, 2]];

export class Life {
  constructor(size = 64, seed = 1) {
    this.size = size; this.grid = new LifeGrid(size);
    this.pure = false; this.perturbations = 0; this.births = 0; this.generationsPerBeat = 4; this.density = 1;
    this.activity = 0;
    this.seed(seed);
  }
  state() { return [this.grid.cells, this.grid.age]; }
  get generation() { return this.grid.generation; }
  seed(seed = 1) { this.random = seeded(seed); this.grid.seed(this.random); this.perturbations = 0; }
  setParams({ H, T, D } = {}) {
    if (H !== undefined) this.births = Math.round(H * this.size * this.size / 400);
    if (T !== undefined) this.generationsPerBeat = 1 + Math.round(T * 6);
    if (D !== undefined) this.density = D;
  }
  step() {
    this.grid.step();
    // After a step the grid's spare buffer still holds the previous generation.
    const cells = this.grid.cells, previous = this.grid.next;
    let changed = 0, population = 0;
    for (let i = 0; i < cells.length; i++) { if (cells[i] !== previous[i]) changed++; population += cells[i]; }
    this.activity = changed / Math.max(1, population);
    if (this.pure || !this.births) return;
    const n = cells.length;
    for (let b = 0; b < this.births; b++) {
      const i = Math.floor(this.random() * n);
      if (!cells[i]) { cells[i] = 1; this.grid.age[i] = 1; this.perturbations++; }
    }
  }
  inject(random = Math.random) {
    if (this.pure) return false;
    const n = this.size, cells = this.grid.cells;
    for (let attempt = 0; attempt < 24; attempt++) {
      const ox = Math.floor(random() * (n - 4)), oy = Math.floor(random() * (n - 4));
      let empty = true;
      for (let y = 0; y < 4 && empty; y++) for (let x = 0; x < 4; x++) if (cells[(oy + y) * n + ox + x]) { empty = false; break; }
      if (!empty) continue;
      for (const [x, y] of GLIDER) { const i = (oy + y) * n + ox + x; cells[i] = 1; this.grid.age[i] = 1; }
      this.perturbations += GLIDER.length;
      return true;
    }
    return false;
  }
}
