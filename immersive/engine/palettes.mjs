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
export function hslToRgb(h, s, l) {
  if (s === 0) return [l, l, l];
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s, p = 2 * l - q;
  const f = t => { t = wrap(t); if (t < 1 / 6) return p + (q - p) * 6 * t; if (t < 0.5) return q; if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6; return p; };
  return [f(h + 1 / 3), f(h), f(h - 1 / 3)];
}
// Lookup table for per-pixel colouring: index = round(v·(size−1)) with t = v, one table per (mode, hue degree).
const lutCache = new Map();
export function paletteLUT(mode, hueCenter, size = 256) {
  const key = `${mode}:${Math.round(wrap(hueCenter) * 360) % 360}:${size}`;
  let lut = lutCache.get(key);
  if (lut) return lut;
  lut = new Uint8Array(size * 3);
  for (let i = 0; i < size; i++) {
    const v = i / (size - 1), [h, s, l] = paletteHSL(mode, hueCenter, v, v), [r, g, b] = hslToRgb(h, s, l);
    lut[i * 3] = Math.round(r * 255); lut[i * 3 + 1] = Math.round(g * 255); lut[i * 3 + 2] = Math.round(b * 255);
  }
  if (lutCache.size > 64) lutCache.clear();
  lutCache.set(key, lut);
  return lut;
}
