/* The headset entry on the quiet glass (2026-11-03). The glass has no buttons, but a Quest has no other way in:
   where the browser can run immersive VR a second line, 進入 VR, sits under 輕觸開始 and stays at the foot of the
   glass between sessions; it is gone while a session runs. In VR there is no glass to touch, so the two triggers
   do the glass's work: the left hand changes the world, the right hand flies or hovers. Pure; no DOM, no WebXR. */
export function headsetLine({ supported = false, presenting = false } = {}) { return !!supported && !presenting; }
export function triggerAction(hand) { return hand === 0 ? 'world' : 'flight'; }
export function nextWorld(worlds, current) { return worlds[(worlds.indexOf(current) + 1) % worlds.length]; }
