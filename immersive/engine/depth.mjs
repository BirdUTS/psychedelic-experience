/* Depth: one value 0..1 that bundles kaleidoscope fold, feedback, palette saturation and speed (v2 §5.2). Pure. */
import { FOLDS } from './arcs.mjs';
const clamp01 = v => v < 0 ? 0 : v > 1 ? 1 : v;
export function depthToAxes(d) {
  const x = clamp01(Number.isFinite(d) ? d : 0);
  return { fold: FOLDS[Math.round(x * 4)], feedback: 0.1 + 0.8 * x, saturation: 0.6 + 0.8 * x, speed: 0.6 + x };
}
