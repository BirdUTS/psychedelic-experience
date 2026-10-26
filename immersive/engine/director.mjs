/* The Director: blends follow targets (mirroring the music) with lead targets (the arc) by Initiative,
   keeps entropy inside the flow channel, spends a novelty budget on surprise, and gates scene changes
   on phrase boundaries. Pure: no DOM, no WebGL. JEV only moves targets through applyDecision(). */
import { BeatClock, WorldClock, BeatPredictor } from './beat-clock.mjs';
import { Agency } from './agency.mjs';
import { Initiative } from './initiative.mjs';
import { ArcPlayer } from './arcs.mjs';
import { MOODS } from './grammar.mjs';

const clamp = (v, lo, hi) => v < lo ? lo : v > hi ? hi : v;
const blend = (cur, target, dt, tau) => cur + (target - cur) * (1 - Math.exp(-dt / tau));
const I0_FOR = { follow: -0.6, mutual: 0, lead: 0.6 };

export class Director {
  constructor({ initiative = new Initiative(), arcs = new ArcPlayer(), beat = new BeatClock(),
                world = new WorldClock(), agency = new Agency(), predictor = new BeatPredictor(),
                scene = 'physarum', dwell = 60, noveltyRefill = 1 / 40 } = {}) {
    this.initiative = initiative; this.arcs = arcs; this.beat = beat; this.world = world;
    this.agency = agency; this.predictor = predictor;
    this.scene = scene; this.dwell = dwell; this.noveltyRefill = noveltyRefill;
    this.sceneAge = 0; this.wall = 0; this.clock = 0;
    this.N = 0.5;                    // novelty budget starts half full: one injection available at once, never two in the first second
    this.eAvg = 0; this.hadMusic = false;
    this.palette = null; this.committedS = null;   // lead palette and fold commit only on phrase boundaries
    this.mood = null; this.pendingMood = null;      // JEV mood (v3): pending until a phrase boundary; a scene change drops the pending one
    this.lastOut = null;
    this.jevSceneRequest = null; this.pendingRequest = null; this.jevAxes = new Set();
    this.appliedArcIndex = -1; this.appliedArcName = null;
    // Metabolism (v2 §3.2): heat the entropy target when liveliness sinks; rewind when heat is not enough.
    this.heat = 0; this.heating = false; this.belowSince = null; this.deepSince = null; this.cooldownUntil = 0; this.forceInject = false;
    this.prevWorldPhase = 0;
  }

  // A person's own request (swipe, key): honoured at the next phrase boundary when the world leads,
  // at once when it follows (I ≤ −0.5), never while the scene is locked. Bypasses dwell and agency gates.
  requestScene(name) { this.userSceneRequest = name && name !== this.scene ? name : null; }

  acknowledgeScene(name) {
    if (name) this.scene = name;
    this.sceneAge = 0;
    if (this.jevSceneRequest === this.scene) this.jevSceneRequest = null;
    if (this.userSceneRequest === this.scene) this.userSceneRequest = null;
    this.pendingMood = null;
    this.heat = 0; this.heating = false; this.belowSince = null; this.deepSince = null;   // a new world starts with a clean metabolism
  }

  metabolism(L, dt) {
    if (typeof L !== 'number' || !Number.isFinite(L)) return false;
    if (this.clock < this.cooldownUntil) { this.belowSince = null; this.deepSince = null; this.heating = false; this.heat = Math.max(0, this.heat - dt * 0.1); return false; }
    if (L < 0.35) { if (this.belowSince === null) this.belowSince = this.clock; }
    else { this.belowSince = null; this.deepSince = null; this.heating = false; this.heat = Math.max(0, this.heat - dt * 0.1); return false; }
    if (this.clock - this.belowSince < 5) return false;
    if (!this.heating) { this.heating = true; this.N = Math.max(this.N, 0.5); this.forceInject = true; }
    this.heat = Math.min(0.4, this.heat + dt * (0.15 / 5));
    if (L < 0.2) { if (this.deepSince === null) this.deepSince = this.clock; } else this.deepSince = null;
    if (this.deepSince !== null && this.clock - this.deepSince >= 15) {
      this.cooldownUntil = this.clock + 30; this.heat = 0; this.heating = false; this.belowSince = null; this.deepSince = null;
      return true;
    }
    return false;
  }

  applyDecision(decision) {
    if (!decision || typeof decision !== 'object') return;
    const conf = decision.confidence || {};
    const ok = k => decision[k] !== undefined && decision[k] !== null && (conf[k] ?? 0) >= 0.45;
    const ov = {};
    if (ok('entropy')) { ov.H = decision.entropy; this.jevAxes.add('H'); }
    if (ok('energy')) { ov.T = decision.energy; ov.D = decision.energy; this.jevAxes.add('T'); this.jevAxes.add('D'); }
    if (ok('symmetry')) { ov.S = decision.symmetry; this.jevAxes.add('S'); }
    if (ok('palette')) { ov.palette = decision.palette; this.jevAxes.add('P'); }
    if (ok('initiative') && decision.initiative in I0_FOR) this.initiative.setBaseline(I0_FOR[decision.initiative]);
    if (Object.keys(ov).length) this.arcs.override(ov);
    if (typeof decision.hold === 'number') this.arcs.holdUntilNextWaypoint(decision.hold);
    if (ok('scene') && decision.scene.p >= 0.6 && decision.scene.choice !== this.scene) this.jevSceneRequest = decision.scene.choice;
    if (ok('request') && decision.request !== 'none') this.pendingRequest = decision.request;
    if (ok('mood') && MOODS.includes(decision.mood)) this.pendingMood = decision.mood;
  }

  update(dt, input) {
    if (input.paused && this.lastOut) {
      // A paused world advances nothing and repeats no one-shot flags: the copy is built once per pause.
      if (!this.pausedOut || this.pausedOut.source !== this.lastOut) {
        const o = this.lastOut;
        this.pausedOut = { ...o, request: null, sceneChange: null, rewind: false, injection: false, phraseBoundary: false, events: { beat: false, accent: false, phrase: false }, source: o };
      }
      return this.pausedOut;
    }
    dt = clamp(dt || 0, 0, 0.1);
    this.clock += dt;
    const music = input.music, room = input.room, user = input.user;
    const E = music ? music.E : 0, C = music ? music.C : 0, onset = music ? music.onset : 0, B = music ? music.B : 0.5;

    // 1. Music clock and surprise (prediction error against the beat-phase model).
    //    With no music there is nothing to be surprised by: the predictor is cleared so a stale groove
    //    cannot make the director act in silence.
    this.beat.setLatency(music ? music.latency || 0 : 0);
    this.beat.update(dt, { onset, bpm: music && music.bpm ? music.bpm : this.beat.bpm, C });
    if (!music && this.hadMusic) { this.predictor.reset(); this.eAvg = 0; }
    this.hadMusic = !!music;
    const predicted = music ? this.predictor.predict(this.beat.phase) : null;
    let surprise = 0;
    if (music) {
      this.eAvg = blend(this.eAvg, E, dt, 2);
      surprise = Math.abs(E - (predicted == null ? this.eAvg : predicted));
      if (onset > 0.5 && this.beat.distanceToBeat() > 0.3 && C > 0.4) surprise += 1;
      surprise = Math.min(1, surprise);
      this.predictor.observe(this.beat.phase, E);
    }

    // 2. Agency → Initiative.
    if (input.gestures) this.agency.gesture(input.gestures);
    this.agency.update(dt, {
      roomOnset: room ? room.onset : 0, speech: room ? room.speech : 0,
      beatDistance: this.beat.distanceToBeat(), C, actualE: E, predictedE: predicted,
    });
    this.initiative.update(dt, this.agency.As);
    const I = this.initiative.I, lambda = this.initiative.lambda, As = this.agency.As;

    // 3. The arc walks while the world is not yielding.
    this.arcs.update(dt, { running: I >= 0, currentScene: this.scene });
    const lead = this.arcs.current();
    if (lead.index !== this.appliedArcIndex || lead.arcName !== this.appliedArcName) {
      this.appliedArcIndex = lead.index; this.appliedArcName = lead.arcName; this.jevAxes.clear();
      if (lead.I0 != null) this.initiative.setBaseline(lead.I0);
    }

    // 4. World clock: ahead of the beat when leading, behind when following.
    this.world.update(dt, { musicPhase: this.beat.phase, C, I, omega: lead.omega, musicHz: this.beat.bpm / 60 });
    const pulse = this.world.pulse();
    const beat = this.world.phase < this.prevWorldPhase && this.prevWorldPhase - this.world.phase > 0.5;
    this.prevWorldPhase = this.world.phase;
    const accent = (onset > 0.6 && this.beat.distanceToBeat() > 0.3 && C > 0.4) || surprise > 0.7;
    const rewind = this.metabolism(input.liveliness, dt);

    // 5. Phrase boundaries: 16 beats in a groove, 20 s of wall time otherwise.
    let phraseBoundary = false;
    if (C > 0.4) { phraseBoundary = this.beat.wrapped && this.beat.beatIndex % 16 === 0; this.wall = 0; }
    else { this.wall += dt; if (this.wall >= 20) { this.wall -= 20; phraseBoundary = true; } }

    // 6. Targets: follow (mirror) blended with lead (arc) per axis by λ·weight.
    const w = lead.weight;
    const mix = (follow, leadValue, wk) => { const a = lambda * wk; return follow * (1 - a) + leadValue * a; };
    const Hf = 0.45 + 0.35 * (1 - C), Tf = 0.6 + 0.9 * E, Df = 0.3 + 0.7 * E;
    const hTarget = Math.min(1, mix(Hf, lead.H, w.H) + this.heat);
    const T = clamp(mix(Tf, lead.T, w.T), 0, 1.5), D = clamp(mix(Df, lead.D, w.D), 0, 1);
    // Feedback: the user's slider is the baseline; the arc moves around it (0.3 is the arcs' neutral value).
    const F = clamp(user.F + lambda * w.F * (lead.F - 0.3), 0, 1);
    const leadS = lambda * w.S > 0.5, leadP = lambda * w.P > 0.5, leadCam = lambda * w.Cam > 0.5;
    // Palette mode and fold count from the arc commit on phrase boundaries (the first one immediately).
    if (this.committedS === null) this.committedS = lead.S;
    else if (lead.S !== this.committedS && phraseBoundary) this.committedS = lead.S;
    if (leadP && (this.palette === null || (lead.palette !== this.palette && phraseBoundary))) this.palette = lead.palette;
    const S = leadS ? Math.max(user.S, this.committedS) : user.S;   // the user's symmetry is a floor, never ignored
    const palette = this.palette ?? 'ink';
    if (this.pendingMood && phraseBoundary) { this.mood = this.pendingMood; this.pendingMood = null; }
    const camera = leadCam ? lead.camera : user.camera;
    const hue = ((user.hue + (0.5 - B) * 60) % 360 + 360) % 360;
    const hWidth = 0.15 + 0.25 * C;
    const H = clamp(hTarget + (user.H - 0.5) * 0.3, hTarget - hWidth, hTarget + hWidth);

    // 7. Scene gate: leading, nobody acting, unlocked, on a phrase boundary, after the dwell.
    this.sceneAge += dt;
    const request = this.jevSceneRequest && this.jevSceneRequest !== this.scene ? this.jevSceneRequest : this.arcs.sceneRequest;
    let sceneChange = null;
    if (this.userSceneRequest && this.userSceneRequest !== this.scene && !user.sceneLocked && (phraseBoundary || I <= -0.5)) {
      sceneChange = this.userSceneRequest; this.userSceneRequest = null; this.sceneAge = 0;
    } else if (request && request !== this.scene && I > 0.2 && As < 0.25 && !user.sceneLocked && phraseBoundary && this.sceneAge >= this.dwell) {
      sceneChange = request; this.sceneAge = 0;
    }

    // 8. Novelty budget.
    this.N = Math.min(1, this.N + this.noveltyRefill * dt);
    let injection = false;
    if (surprise > 0.5 && this.N >= 0.5 && (1 - lambda) > 0.3) { injection = true; this.N -= 0.5; }
    if (this.forceInject && this.N >= 0.5) { injection = true; this.N -= 0.5; }   // the metabolism's own kick when heating begins
    this.forceInject = false;

    const request1 = this.pendingRequest; this.pendingRequest = null;
    const src = (axis, leadActive, userTouched) => leadActive ? (this.jevAxes.has(axis) ? 'jev' : 'arc') : (userTouched ? 'you' : 'music');
    return this.lastOut = {
      I, lambda, As, phase: this.beat.phase, worldPhase: this.world.phase, pulse, phraseBoundary, surprise,
      targets: { H, T, D, S, F, palette, hue, camera, omega: lead.omega }, mood: this.mood,
      hTarget, hWidth, sceneChange, injection, request: request1,
      heat: this.heat, rewind, events: { beat, accent, phrase: phraseBoundary },
      liveliness: typeof input.liveliness === 'number' ? input.liveliness : null,
      hud: {
        leading: I > 0.2 ? 'LEADING' : I < -0.2 ? 'FOLLOWING' : 'MUTUAL',
        bpm: this.beat.bpm, C, E, As, arc: lead.arcName, waypoint: lead.index,
        source: {
          H: src('H', lambda * w.H > 0.5, Math.abs(user.H - 0.5) > 0.1),
          T: src('T', lambda * w.T > 0.5, false), D: src('D', lambda * w.D > 0.5, false),
          S: src('S', leadS, user.S > 0), F: src('F', lambda * w.F > 0.5, true),
          P: src('P', leadP, false), Cam: src('Cam', leadCam, true),
        },
      },
    };
  }
}
