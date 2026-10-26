/* The visual grammar (v3 §4.1): the director's state becomes a program for the shader stack.
   A fixed, learnable mapping — leading pulls inward (tunnel/spiral, fold), following opens toward you
   (cobweb/lattice, mirror, warp that follows your voice); entropy trades contour for warp; heat and low
   liveliness melt and lean into droste. Depth caps everything. Pure; the caller may pass `into` to reuse. */
import { FOLDS } from './arcs.mjs';

export const FORM_KINDS = ['tunnel', 'spiral', 'cobweb', 'lattice'];
export const MIRRORS = ['none', 'h', 'v', 'quad'];
export const MOODS = ['clear', 'dream', 'melt', 'electric', 'holy'];
export const CONTINUOUS = ['echoDecay', 'echoZoom', 'echoSpin', 'droste', 'tunnel', 'tunnelSpeed', 'formDensity', 'formDrift', 'formContrast',
  'warp', 'warpScale', 'warpRate', 'breath', 'contour', 'contourLine', 'chromaSplit', 'chromaCycle', 'gain'];
export const DISCRETE = ['fold', 'mirror', 'formKind'];

const clamp = (v, lo, hi) => v < lo ? lo : v > hi ? hi : v;
const clamp01 = v => clamp(v, 0, 1);

export function defaultProgram() {
  return {
    fold: 0, mirror: 'none', formKind: 'tunnel',
    echoDecay: 0, echoZoom: 0, echoSpin: 0, droste: 0, tunnel: 0, tunnelSpeed: 0,
    formDensity: 0, formDrift: 0, formContrast: 0,
    warp: 0, warpScale: 0.5, warpRate: 0.3, breath: 0, contour: 0, contourLine: 0.5,
    chromaSplit: 0, chromaCycle: 0, gain: 0.6,
  };
}

export function programFor(state, depth, into = defaultProgram()) {
  const s = state || {}, d = clamp01(Number.isFinite(depth) ? depth : 0.5), p = into;
  const I = clamp(s.I ?? 0, -1, 1), A = clamp01(s.A ?? 0), E = clamp01(s.E ?? 0), C = clamp01(s.C ?? 0), H = clamp01(s.H ?? 0.5);
  const L = clamp01(s.L ?? 1), heat = clamp01(s.heat ?? 0), calm = !!s.calm, jump = !!s.jump, diving = !!s.diving, hover = s.ship === 'hover';
  const lead = (I + 1) / 2, leading = lead > 0.5, foldCap = FOLDS[Math.round(d * 4)];
  p.formKind = jump ? 'lattice' : leading ? (C > 0.5 ? 'spiral' : 'tunnel') : (A > 0.3 ? 'cobweb' : 'lattice');
  p.formDrift = jump ? 1 : clamp(leading ? (0.3 + 0.7 * C) * (diving ? 2.5 : 1) : -(0.2 + 0.3 * C), -1, 1);   // low coherence drifts slowly either way
  p.formDensity = clamp01((0.3 + 0.6 * E) * d * (1 - 0.5 * A));
  p.formContrast = Math.min(0.6, 0.6 * d);
  // The arc carries the fold (v1/v2 waypoints: Tidal opens at 0 and builds); Depth is only its ceiling.
  const arcS = Number.isFinite(s.arcS) ? s.arcS : foldCap;
  p.fold = leading ? FOLDS.filter(f => f <= Math.min(foldCap, arcS)).pop() : 0;
  p.mirror = jump ? 'quad' : leading ? 'none' : (A > 0.5 ? 'h' : 'quad');
  const warpBase = (leading ? 0.2 + 0.5 * H : 0.2 + 0.6 * A + 0.3 * H) + 0.5 * heat;
  p.warp = clamp01(Math.min(Math.max(d, 0.1), warpBase));
  p.warpScale = 0.5; p.warpRate = clamp01(0.2 + 0.4 * E);
  p.contour = clamp01(0.8 * (1 - H) * d); p.contourLine = 0.5;
  p.echoDecay = clamp01(0.5 + 0.4 * H + 0.3 * heat); p.echoZoom = clamp01(0.3 + 0.4 * lead); p.echoSpin = clamp01(0.5 * lead);
  p.droste = L < 0.3 ? clamp01((0.3 - L) / 0.3) : 0;
  p.breath = C < 0.5 ? clamp01(1.2 * (0.5 - C)) : 0;
  p.chromaSplit = calm ? 0 : clamp01((jump ? 0.6 : 0.3 * H) * d);
  p.chromaCycle = clamp01(0.2 + 0.3 * E);
  p.tunnel = jump ? 1 : hover ? 0 : diving ? 0.7 : 0.3;
  p.tunnelSpeed = jump ? 1 : diving ? 1 : 0.4;
  p.gain = calm ? Math.min(0.5, 0.3 + 0.7 * d) : clamp01(0.3 + 0.7 * d);
  if (p.fold === 0) p.formContrast *= 0.5;   // with no kaleidoscope the forms step back too
  applySignature(p, s.world, d, leading);
  if (s.raw && !jump) {
    // A raw passage: the world itself and its echo, nothing folded or laid over it.
    p.fold = 0; p.mirror = 'none'; p.formContrast = 0; p.tunnel = 0; p.droste = 0;
    p.warp = Math.min(p.warp, 0.15); p.chromaSplit = Math.min(p.chromaSplit, 0.1);
  }
  return p;
}

// Each world's own accent, so four worlds read as four pictures (scaled by Depth, capped like everything else).
function applySignature(p, world, d, leading) {
  if (world === 'physarum') {          // mycelium: its veins drawn as contour lines
    p.contour = clamp01(p.contour + 0.35 * d); p.contourLine = 0.7;
    if (!leading) p.formKind = 'cobweb';
  } else if (world === 'swarm') {      // fireflies: long trails that spin and fall inward
    p.echoDecay = clamp01(p.echoDecay + 0.15); p.echoSpin = clamp01(p.echoSpin + 0.2);
    p.droste = Math.max(p.droste, 0.25 * d); p.breath = clamp01(p.breath + 0.2);
  } else if (world === 'boids') {      // the flock: mirrored like water, broad flowing warp
    if (!leading) p.mirror = 'h';
    p.warp = clamp01(p.warp + 0.25 * d); p.warpScale = 0.25;
  } else if (world === 'life') {       // Life: a grid, crisp and slightly split
    p.formKind = 'lattice'; p.contour = clamp01(p.contour + 0.15 * d);
    p.chromaSplit = clamp01(p.chromaSplit + 0.1 * d);
  }
}

// Depth is the user's dial and a ceiling on everything (§4.1): applied again after moods and gesture overrides.
export function capProgram(p, depth) {
  const d = clamp01(Number.isFinite(depth) ? depth : 0.5), foldCap = FOLDS[Math.round(d * 4)];
  let f = Number(p.fold) || 0;
  if (!FOLDS.includes(f)) f = FOLDS.filter(x => x <= f).pop() ?? 0;
  p.fold = Math.min(f, foldCap);
  if (!MIRRORS.includes(p.mirror)) p.mirror = 'none';
  if (!FORM_KINDS.includes(p.formKind)) p.formKind = 'tunnel';
  for (const k of CONTINUOUS) p[k] = clamp(p[k], k === 'formDrift' ? -1 : 0, 1);
  p.warp = Math.min(p.warp, Math.max(d, 0.1));
  p.formDensity = Math.min(p.formDensity, d);
  p.formContrast = Math.min(p.formContrast, 0.6 * d);
  p.chromaSplit = Math.min(p.chromaSplit, 0.6 * d);
  p.gain = Math.min(p.gain, 0.3 + 0.7 * d);
  return p;
}

export function blendPrograms(a, b, u, into = defaultProgram()) {
  const t = clamp01(u), p = into;
  for (const k of CONTINUOUS) p[k] = a[k] + (b[k] - a[k]) * t;
  for (const k of DISCRETE) p[k] = t >= 0.5 ? b[k] : a[k];
  return p;
}

const MOOD_BIAS = {
  clear: { contour: 0.3, warp: -0.2, chromaSplit: -0.2 },
  dream: { breath: 0.3, echoDecay: 0.2, warp: 0.1 },
  melt: { warp: 0.4, echoDecay: 0.3 },
  electric: { chromaSplit: 0.3, formDensity: 0.2, chromaCycle: 0.3 },
  holy: { gain: 0.1, contour: 0.2 },
};
export function applyMood(program, mood, amount = 1) {
  const bias = MOOD_BIAS[mood];
  if (!bias) return program;
  const a = clamp01(amount);
  for (const k in bias) program[k] = clamp(program[k] + bias[k] * a, k === 'formDrift' ? -1 : 0, 1);
  if (mood === 'holy' && a >= 0.5) { program.fold = 8; program.formKind = 'tunnel'; }
  return program;
}
