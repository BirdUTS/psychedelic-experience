// A frame meter for the headset: how fast the loop really ran while presenting, read after leaving VR.
// Pure; the app feeds it raw frame deltas and shows the line in the drawer and as a caption.
// The first second of a session is warm-up (shader compile, the first frames) and is not counted: Bird's 3 s run
// on 2026-11-03 read 64 fps on a 90 Hz headset for that reason alone.
const SLOW = 1 / 45;   // slower than 45 Hz is a visible judder on a 72 Hz headset

export class FrameMeter {
  constructor({ warmupSeconds = 1 } = {}) { this.warmupSeconds = warmupSeconds; this.reset(); }
  reset() { this.frames = 0; this.seconds = 0; this.slow = 0; this.worst = 0; this.warm = 0; }
  record(dt) {
    if (!(dt > 0) || dt > 1) return;   // a pause (tab hidden, headset doffed) is not a frame
    if (this.warm < this.warmupSeconds) { this.warm += dt; return; }
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

// rate: the session's own refresh rate (XRSession.frameRate) when the browser reports it, so 82 reads as 82 of 90.
export function frameLine(s, lang = 'zh', { rate } = {}) {
  if (!s) return '';
  const slow = Math.round(s.slowShare * 100), fps = Number.isFinite(rate) && rate > 0 ? `${s.fps}/${Math.round(rate)}` : `${s.fps}`;
  const short = s.seconds < 10;
  return lang === 'en' ? `VR ${fps} fps · worst ${s.worstMs} ms · ${slow}% slow · ${s.seconds} s${short ? ' (too short)' : ''}`
                       : `VR ${fps} fps · 最慢 ${s.worstMs} ms · ${slow}% 慢格 · ${s.seconds} 秒${short ? '（太短）' : ''}`;
}
