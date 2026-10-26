/* JEV client: bounded state out, schema-checked decision in. Stale, slow or malformed answers are dropped.
   JEV sets targets in a fixed vocabulary; nothing here touches a frame. */
import { SCENES, PALETTES, FOLDS } from './arcs.mjs';
import { MOODS } from './grammar.mjs';

export const REQUEST_ACTIONS = ['none', 'slower', 'faster', 'warmer', 'cooler', 'surround', 'calm_down', 'hold_scene', 'change_scene', 'more_symmetry', 'less_symmetry'];
export const INITIATIVES = ['follow', 'mutual', 'lead'];
const STATE_KEYS = ['scene', 'sceneAge', 'arc', 'features', 'initiative', 'locks', 'userText', 'recentDecisions', 'online'];
const round2 = x => Number.isFinite(x) ? Math.round(x * 100 + 1e-9) / 100 : 0;
const unit = v => typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= 1;

export function buildState(parts = {}) {
  const f = parts.features || {}, init = parts.initiative || {}, arc = parts.arc || {};
  const features = {};
  for (const k of ['E_mean30', 'E_trend', 'C_mean30', 'B_mean30', 'A_mean30', 'bpm']) features[k] = round2(f[k]);
  const state = {
    scene: String(parts.scene ?? ''),
    sceneAge: round2(parts.sceneAge),
    arc: { name: String(arc.name ?? ''), waypoint: Number.isInteger(arc.waypoint) ? arc.waypoint : 0 },
    features,
    initiative: { I: round2(init.I), locked: !!init.locked, I0: round2(init.I0) },
    locks: { scene: !!(parts.locks && parts.locks.scene) },
    userText: String(parts.userText ?? '').slice(0, 180),
    recentDecisions: Array.isArray(parts.recentDecisions) ? parts.recentDecisions.slice(-3) : [],
    online: !!parts.online,
  };
  for (const k of Object.keys(state)) if (!STATE_KEYS.includes(k)) delete state[k];
  return state;
}

export function validateDecision(raw, { sentVersion, sentAt, now, maxAge = 10, floor = 0.45 } = {}) {
  if (!raw || typeof raw !== 'object') return null;
  if (raw.version !== sentVersion) return null;
  if (typeof sentAt === 'number' && typeof now === 'number' && now - sentAt > maxAge) return null;
  const conf = raw.confidence && typeof raw.confidence === 'object' ? raw.confidence : {};
  const out = { version: raw.version, confidence: { ...conf } };
  if (raw.hold !== undefined) { if (!unit(raw.hold)) return null; out.hold = raw.hold; }
  const checks = {
    scene: v => v && typeof v === 'object' && SCENES.includes(v.choice) && unit(v.p),
    energy: unit, entropy: unit,
    symmetry: v => FOLDS.includes(v),
    palette: v => PALETTES.includes(v),
    initiative: v => INITIATIVES.includes(v),
    request: v => REQUEST_ACTIONS.includes(v),
    mood: v => MOODS.includes(v),
  };
  for (const k in checks) {
    if (raw[k] === undefined || raw[k] === null) continue;
    if (!checks[k](raw[k])) return null;
    const c = conf[k];
    if (typeof c !== 'number' || !Number.isFinite(c) || c < floor) continue;
    out[k] = k === 'scene' ? { choice: raw[k].choice, p: raw[k].p } : raw[k];
  }
  return out;
}

export class JevClient {
  // fetch must be called on its global (an unbound reference throws "Illegal invocation" in browsers).
  constructor({ fetchFn = (...args) => globalThis.fetch(...args), now = () => performance.now() / 1000, minGap = 15, maxAge = 10, url = '/api/decide', floor = 0.45 } = {}) {
    this.fetchFn = fetchFn; this.now = now; this.minGap = minGap; this.maxAge = maxAge; this.url = url; this.floor = floor;
    this.enabled = false; this.version = 0; this.inFlight = false; this.backoff = 0;
    this.lastSent = -Infinity; this.blockedUntil = -Infinity; this.lastError = null;
  }
  bump() { this.version++; }
  penalise() { this.backoff = Math.min(240, Math.max(15, this.backoff * 2)); this.blockedUntil = this.now() + this.backoff; }
  async maybeRequest(stateFn, { force = false } = {}) {
    const t = this.now();
    if (!this.enabled || this.inFlight) return null;
    if (!force && t - this.lastSent < this.minGap) return null;
    if (t < this.blockedUntil) return null;
    this.inFlight = true;
    const version = this.version, sentAt = t;
    this.lastSent = t;
    try {
      const response = await this.fetchFn(this.url, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ version, state: stateFn() }),
      });
      if (!response.ok) {
        this.lastError = response.status;
        if (response.status === 429 || response.status >= 500) this.penalise();
        return null;
      }
      this.backoff = 0; this.lastError = null;
      const raw = await response.json();
      return validateDecision(raw, { sentVersion: version, sentAt, now: this.now(), maxAge: this.maxAge, floor: this.floor });
    } catch (e) {
      this.lastError = 'network'; this.penalise(); return null;
    } finally { this.inFlight = false; }
  }
}
