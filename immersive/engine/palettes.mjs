/* Four palette modes held one at a time: ink (stark monochrome), silk (pastel flow),
   ember (warm), neon (saturated multi-hue). Hue, saturation and lightness in 0..1. */
export const PALETTE_MODES = ['ink', 'silk', 'ember', 'neon'];
export const PALETTES = {
  ink:   { sat: 0.08, light: [0.05, 0.95], spread: 0.02, center: null },
  silk:  { sat: 0.45, light: [0.35, 0.85], spread: 0.12, center: null },
  ember: { sat: 0.85, light: [0.20, 0.70], spread: 0.08, center: 0.06 },
  neon:  { sat: 1.00, light: [0.45, 0.65], spread: 0.50, center: null },
};
const wrap = x => ((x % 1) + 1) % 1;
const clamp01 = v => v < 0 ? 0 : v > 1 ? 1 : v;
export function paletteHSL(mode, hueCenter, t, v) {
  const p = PALETTES[mode] || PALETTES.neon;
  const h = wrap((p.center ?? hueCenter) + (clamp01(t) - 0.5) * p.spread);
  const l = p.light[0] + clamp01(v) * (p.light[1] - p.light[0]);
  return [h, p.sat, l];
}
