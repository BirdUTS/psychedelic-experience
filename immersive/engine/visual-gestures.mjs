/* Visual gestures (v3 §4.2): short sentences the world says at moments of change — take, yield, listen,
   carry, surprise, rebirth, jump. One at a time; a stronger one may interrupt a weaker one. Envelopes rise over the first
   20 % of their length and fall to zero at the end. Pure. */
export const GESTURES = ['take', 'yield', 'listen', 'carry', 'surprise', 'rebirth', 'jump'];
// A stronger sentence may interrupt a weaker one: take / yield (who leads) over surprise over the ambient listen / carry.
const PRIORITY = { jump: 7, rebirth: 6, take: 4, yield: 4, surprise: 3, listen: 1, carry: 1 };   // a jump finishes any dissolve (app), so it outranks rebirth
const clamp01 = v => v < 0 ? 0 : v > 1 ? 1 : v;

export class VisualGestures {
  constructor({ hysteresis = 0.05, surpriseGap = 2 } = {}) {
    this.h = hysteresis; this.gap = surpriseGap;
    this.active = null; this.t = 0; this.length = 0; this.env = 0;
    this.takeZone = 'below'; this.yieldZone = 'above';
    this.leadFor = 0; this.lastSurprise = -Infinity; this.clock = 0; this.pulse = 0; this.listenRestUntil = -Infinity;
    this.overrides = {};
  }
  start(name, length) { this.end(); this.active = name; this.t = 0; this.length = Math.max(0.05, length); this.leadFor = 0; this.env = 0; }
  end() { if (this.active === 'listen') this.listenRestUntil = this.clock + 4 * this.beat; this.active = null; this.env = 0; this.t = 0; }
  update(dt, state = {}, events = {}) {
    if (!(dt > 0)) return { active: this.active, env: this.env, overrides: this.overrides };
    this.clock += dt;
    const I = state.I ?? 0, A = state.A ?? 0, surprise = state.surprise ?? 0, bs = this.beat = state.beatSeconds > 0 ? state.beatSeconds : 0.5;
    // Threshold crossings with hysteresis.
    let take = false, yieldNow = false;
    if (I > 0.2 + this.h) { if (this.takeZone === 'below') take = true; this.takeZone = 'above'; } else if (I < 0.2 - this.h) this.takeZone = 'below';
    if (I < -0.2 - this.h) { if (this.yieldZone === 'above') yieldNow = true; this.yieldZone = 'below'; } else if (I > -0.2 + this.h) this.yieldZone = 'above';
    // Leading time since the last gesture (for carry).
    if (I > 0.2) this.leadFor += dt; else this.leadFor = 0;
    // Pre-empting events, then idle triggers in priority order.
    const can = name => !this.active || PRIORITY[name] > PRIORITY[this.active];
    if (events.jump && can('jump')) this.start('jump', 4);
    else if (events.rewind && can('rebirth')) this.start('rebirth', 2);
    else if (take && can('take')) this.start('take', 2 * bs);
    else if (yieldNow && can('yield')) this.start('yield', 2 * bs);
    else if (surprise > 0.7 && this.clock - this.lastSurprise >= this.gap && can('surprise')) { this.start('surprise', bs); this.lastSurprise = this.clock; }
    else if (!this.active) {
      if (I < -0.2 && A > 0.5 && this.clock >= this.listenRestUntil) this.start('listen', 4 * bs);   // following, with agency; rests four beats between nods
      else if (this.leadFor + 1e-9 >= 16 * bs) this.start('carry', 4 * bs);
    }
    // Listen pulses on onsets, decaying over a beat.
    this.pulse = Math.max(0, this.pulse - dt / bs * 0.4);
    if (this.active === 'listen' && events.onset > 0) this.pulse = Math.min(1, this.pulse + 0.4);
    // Envelope and overrides.
    const o = this.overrides = {};
    if (this.active) this.t += dt;
    if (this.active && this.t / this.length >= 1) this.end();   // the frame a gesture ends carries no overrides
    if (this.active) {
      const u = this.t / this.length;
      this.env = u < 0.2 ? u / 0.2 : 1 - (u - 0.2) / 0.8;
      const e = clamp01(this.env);
      switch (this.active) {
        case 'take': o.formKind = 'spiral'; o.formDrift = e; o.fold = 6; break;
        case 'yield': o.breath = 0.6 * e; o.mirror = 'h'; o.formDensity = 0; break;
        case 'listen': o.warp = this.pulse * e; break;
        case 'carry': o.tunnel = 0.4 * e; break;
        case 'surprise': o.chromaSplit = 0.8 * e; o.contour = 0.5 * e; break;
        case 'rebirth': o.droste = e; break;
        case 'jump': o.chromaSplit = 0.6 * e; break;
      }
    } else this.env = 0;
    return { active: this.active, env: this.env, overrides: o };
  }
}
