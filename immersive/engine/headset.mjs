/* The headset entry on the quiet glass (2026-11-03). The glass has no buttons, but a Quest has no other way in:
   where the browser can run immersive VR a second line, 進入 VR, sits under 輕觸開始 and stays at the foot of the
   glass between sessions; it is gone while a session runs. In VR there is no glass to touch, so the two triggers
   do the glass's work: the left hand changes the world, the right hand flies or hovers. Pure; no DOM, no WebXR. */
export function headsetLine({ supported = false, presenting = false } = {}) { return !!supported && !presenting; }
export function triggerAction(hand) { return hand === 0 ? 'world' : 'flight'; }
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
