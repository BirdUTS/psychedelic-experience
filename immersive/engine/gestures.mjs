/* Gesture mapper (v2 §5.3): pointer samples in, one of tap / drag / swipe / longpress / twofinger / pinch out.
   Times are milliseconds supplied by the caller. Pure; no DOM. */
export class Gestures {
  constructor({ tapMs = 250, longPressMs = 600, swipeDistance = 80, swipeVelocity = 600, swipeMs = 300, dragThreshold = 8 } = {}) {
    this.tapMs = tapMs; this.longPressMs = longPressMs; this.swipeDistance = swipeDistance; this.swipeVelocity = swipeVelocity; this.swipeMs = swipeMs; this.dragThreshold = dragThreshold;
    this.pointers = new Map(); this.multi = false; this.multiFired = false; this.longFired = false; this.pinchStart = 0;
  }
  down(id, x, y, t) {
    this.pointers.set(id, { x0: x, y0: y, x, y, t0: t, moved: false });
    if (this.pointers.size === 1) { this.multi = false; this.multiFired = false; this.longFired = false; }
    else if (this.pointers.size === 2) { this.multi = true; this.pinchStart = this.spread(); }
    return null;
  }
  spread() {
    const [a, b] = [...this.pointers.values()];
    return a && b ? Math.hypot(a.x - b.x, a.y - b.y) : 0;
  }
  move(id, x, y, t) {
    const p = this.pointers.get(id);
    if (!p) return null;
    const dx = x - p.x, dy = y - p.y;
    p.x = x; p.y = y;
    if (Math.hypot(x - p.x0, y - p.y0) > this.dragThreshold) p.moved = true;
    if (this.multi) {
      const s = this.spread();
      if (this.pinchStart > 0 && Math.abs(s - this.pinchStart) > this.dragThreshold) { this.multiFired = true; return { type: 'pinch', scale: s / this.pinchStart }; }
      return null;
    }
    if (!p.moved || this.longFired) return null;
    return { type: 'drag', dx, dy };
  }
  up(id, x, y, t) {
    const p = this.pointers.get(id);
    this.pointers.delete(id);
    if (!p) return null;
    if (this.multi) {
      if (!this.multiFired) { this.multiFired = true; return { type: 'twofinger' }; }
      if (this.pointers.size === 0) this.multi = false;
      return null;
    }
    if (this.longFired) return null;
    const duration = t - p.t0, dist = Math.hypot(x - p.x0, y - p.y0), velocity = duration > 0 ? dist / (duration / 1000) : Infinity;
    if (dist <= this.dragThreshold && duration <= this.tapMs) return { type: 'tap', x, y };
    // A swipe is a flick: far, fast AND short. A long fast drag is steering, however quick.
    if (dist >= this.swipeDistance && velocity >= this.swipeVelocity && duration <= this.swipeMs) {
      const dx = x - p.x0, dy = y - p.y0;
      return { type: 'swipe', dir: Math.abs(dx) >= Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up') };
    }
    return null;
  }
  tick(t) {
    if (this.pointers.size !== 1 || this.multi || this.longFired) return null;
    const [p] = this.pointers.values();
    if (!p.moved && t - p.t0 >= this.longPressMs) { this.longFired = true; return { type: 'longpress', x: p.x0, y: p.y0 }; }
    return null;
  }
}
