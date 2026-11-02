// A frame meter for the headset: how fast the loop really ran while presenting, read after leaving VR.
// Pure; the app feeds it raw frame deltas and shows the line in the drawer and as a caption.
const SLOW = 1 / 45;   // slower than 45 Hz is a visible judder on a 72 Hz headset

export class FrameMeter {
  constructor() { this.reset(); }
  reset() { this.frames = 0; this.seconds = 0; this.slow = 0; this.worst = 0; }
  record(dt) {
    if (!(dt > 0) || dt > 1) return;   // a pause (tab hidden, headset doffed) is not a frame
    this.frames++; this.seconds += dt;
    if (dt > this.worst) this.worst = dt;
    if (dt > SLOW) this.slow++;
  }
  summary() {
    if (!this.frames || !(this.seconds > 0)) return null;
    return { fps: Math.round(this.frames / this.seconds), worstMs: Math.round(this.worst * 1000),
             slowShare: this.slow / this.frames, seconds: Math.round(this.seconds) };
  }
}

export function frameLine(s, lang = 'zh') {
  if (!s) return '';
  const slow = Math.round(s.slowShare * 100);
  return lang === 'en' ? `VR ${s.fps} fps · worst ${s.worstMs} ms · ${slow}% slow · ${s.seconds} s`
                       : `VR ${s.fps} fps · 最慢 ${s.worstMs} ms · ${slow}% 慢格 · ${s.seconds} 秒`;
}
