/* The headset entry on the quiet glass (2026-11-03). The glass has no buttons, but a Quest has no other way in:
   where the browser can run immersive VR a second line, 進入 VR, sits under 輕觸開始 and stays at the foot of the
   glass between sessions; it is gone while a session runs. In VR there is no glass to touch, so the two triggers
   do the glass's work: the left hand changes the world, the right hand flies or hovers. Pure; no DOM, no WebXR.
   By handedness (2026-11-03, Bird's third Quest run, "cannot change world"): three.js fills controller slot 0 with
   whichever input source arrived first, and with hand tracking that is often the right hand, so the slot said
   nothing about the hand. The input source's handedness decides; the slot only when it reports none. */
export function headsetLine({ supported = false, presenting = false } = {}) { return !!supported && !presenting; }
export function triggerAction(handedness, slot = 0) {
  if (handedness === 'left') return 'world';
  if (handedness === 'right') return 'flight';
  return slot === 0 ? 'world' : 'flight';
}
export function nextWorld(worlds, current) { return worlds[(worlds.indexOf(current) + 1) % worlds.length]; }

/* Grips in VR (same day): a short squeeze is music (start or stop the built-in playlist); a squeeze held holdMs,
   either hand, is leave: the glass's 帶我回來 for a headset, back to the flat picture. Fires once per hold; reset()
   when a session starts, because the release that ends a session may never arrive. Times in ms from the caller. */
export class GripHold {
  constructor({ holdMs = 1000 } = {}) { this.holdMs = holdMs; this.holds = new Map(); this.fired = false; }
  reset() { this.holds.clear(); this.fired = false; }
  down(hand, t) { this.holds.set(hand, t); return null; }
  up(hand, t) {
    const t0 = this.holds.get(hand); this.holds.delete(hand);
    const short = t0 !== undefined && !this.fired && t - t0 < this.holdMs;
    if (this.holds.size === 0) this.fired = false;
    return short ? 'music' : null;
  }
  tick(t) {
    if (this.fired) return null;
    for (const t0 of this.holds.values()) if (t - t0 >= this.holdMs) { this.fired = true; return 'leave'; }
    return null;
  }
}

/* ?folds=K (2026-11-03, a load test before any VR kaleidoscope is built): in VR the world is drawn K times, each copy
   turned 1/K around the viewer, so the frame line after leaving says what the headset can carry. Whole, 1..8. */
export function foldCount(value) { const n = Math.floor(Number(value)); return Number.isFinite(n) && n > 1 ? Math.min(8, n) : 1; }

/* 帶我回來 in a headset without a button (Bird, 2026-11-03: "find a place, the sky or the ground, to walk back out"):
   look down at your feet. A ring appears there and closes over two seconds; keep looking and the session ends,
   back to the glass. Works with hands, controllers or neither. The ground, not the sky: people look up to enjoy
   a world, and nobody stares at an empty floor unless they want out. Pure: the y of the view direction
   (-1 is straight down; -0.75 is about 49° below the horizon) and a clock in ms. */
export class LookDown {
  constructor({ dwellMs = 2000, downY = -0.75 } = {}) { this.dwellMs = dwellMs; this.downY = downY; this.reset(); }
  reset() { this.since = null; this.fired = false; }
  tick(dirY, t) {
    if (!(dirY <= this.downY)) { this.since = null; this.fired = false; return { progress: 0, leave: false }; }
    if (this.since === null) this.since = t;
    const progress = Math.min(1, (t - this.since) / this.dwellMs);
    const leave = progress >= 1 && !this.fired;
    if (leave) this.fired = true;
    return { progress, leave };
  }
}

/* The in-world kaleidoscope (v3.11, 2026-11-05). The flat picture folds the screen; a headset has no screen, so the
   world is folded instead. A textured world (the mycelium sphere, tunnel or dish) mirrors its texture K/2 times
   around the viewer, which costs nothing; a particle world (fireflies, fish, the planet's cells) is drawn K times
   around the viewer, every second copy mirrored, so the copies meet on mirror planes the way the wedges of a
   kaleidoscope do. Copies cost one render each, so they stop at the count the Quest has been measured to carry:
   ?folds=4 held 82 fps on 2026-11-03. ?folds=K forces K, past the Director and the cap, as the load test. Pure. */
export const VR_COPY_CAP = 4;
export function foldPlan(fold, { world = 'physarum', forced = 0, cap = VR_COPY_CAP } = {}) {
  const K = forced > 1 ? Math.floor(forced) : Math.floor(Number(fold) || 0);
  if (K < 2) return { repeat: 1, copies: [] };
  if (world === 'physarum') return { repeat: K / 2, copies: [] };
  const n = forced > 1 ? K : Math.min(K, cap), copies = [];
  for (let k = 1; k < n; k++) copies.push({ rotY: k * 2 * Math.PI / n, mirror: k % 2 === 1 });
  return { repeat: 1, copies };
}
