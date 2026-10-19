/* The Director: blends follow targets (mirroring the music) with lead targets (the arc) by Initiative,
   keeps entropy inside the flow channel, spends a novelty budget on surprise, and gates scene changes
   on phrase boundaries. Pure: no DOM, no WebGL. JEV only moves targets through applyDecision(). */
import { BeatClock, WorldClock, BeatPredictor } from './beat-clock.mjs';
import { Agency } from './agency.mjs';
import { Initiative } from './initiative.mjs';
import { ArcPlayer } from './arcs.mjs';

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
    this.eAvg = 0;
    this.palette = 'ink';
    this.jevSceneRequest = null; this.pendingRequest = null; this.jevAxes = new Set();
    this.appliedArcIndex = -1; this.appliedArcName = null;
  }

  acknowledgeScene(name) {
    if (name) this.scene = name;
    this.sceneAge = 0;
    if (this.jevSceneRequest === this.scene) this.jevSceneRequest = null;
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
  }

  update(dt, input) {
    dt = clamp(dt || 0, 0, 0.1);
    this.clock += dt;
    const music = input.music, room = input.room, user = input.user;
    const E = music ? music.E : 0, C = music ? music.C : 0, onset = music ? music.onset : 0, B = music ? music.B : 0.5;

    // 1. Music clock and surprise (prediction error against the beat-phase model).
    this.beat.setLatency(music ? music.latency || 0 : 0);
    this.beat.update(dt, { onset, bpm: music && music.bpm ? music.bpm : this.beat.bpm, C });
    const predicted = this.predictor.predict(this.beat.phase);
    this.eAvg = blend(this.eAvg, E, dt, 2);
    let surprise = Math.abs(E - (predicted == null ? this.eAvg : predicted));
    if (onset > 0.5 && this.beat.distanceToBeat() > 0.3 && C > 0.4) surprise += 1;
    surprise = Math.min(1, surprise);
    if (music) this.predictor.observe(this.beat.phase, E);

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
    this.world.update(dt, { musicPhase: this.beat.phase, C, I, omega: lead.omega });
    const pulse = this.world.pulse();

    // 5. Phrase boundaries: 16 beats in a groove, 20 s of wall time otherwise.
    let phraseBoundary = false;
    if (C > 0.4) { phraseBoundary = this.beat.wrapped && this.beat.beatIndex % 16 === 0; this.wall = 0; }
    else { this.wall += dt; if (this.wall >= 20) { this.wall -= 20; phraseBoundary = true; } }

    // 6. Targets: follow (mirror) blended with lead (arc) per axis by λ·weight.
    const w = lead.weight;
    const mix = (follow, leadValue, wk) => { const a = lambda * wk; return follow * (1 - a) + leadValue * a; };
    const Hf = 0.35 + 0.5 * (1 - C), Tf = 0.6 + 0.9 * E, Df = 0.3 + 0.7 * E;
    const hTarget = mix(Hf, lead.H, w.H);
    const T = clamp(mix(Tf, lead.T, w.T), 0, 1.5), D = clamp(mix(Df, lead.D, w.D), 0, 1);
    const F = clamp(mix(user.F, lead.F, w.F), 0, 1);
    const leadS = lambda * w.S > 0.5, leadP = lambda * w.P > 0.5, leadCam = lambda * w.Cam > 0.5;
    const S = leadS ? lead.S : user.S;
    if (leadP) this.palette = lead.palette;
    const camera = leadCam ? lead.camera : user.camera;
    const hue = ((user.hue + (0.5 - B) * 60) % 360 + 360) % 360;
    const hWidth = 0.15 + 0.25 * C;
    const H = clamp(hTarget + (user.H - 0.5) * 0.3, hTarget - hWidth, hTarget + hWidth);

    // 7. Scene gate: leading, nobody acting, unlocked, on a phrase boundary, after the dwell.
    this.sceneAge += dt;
    const request = this.jevSceneRequest && this.jevSceneRequest !== this.scene ? this.jevSceneRequest : this.arcs.sceneRequest;
    let sceneChange = null;
    if (request && request !== this.scene && I > 0.2 && As < 0.25 && !user.sceneLocked && phraseBoundary && this.sceneAge >= this.dwell) {
      sceneChange = request; this.sceneAge = 0;
    }

    // 8. Novelty budget.
    this.N = Math.min(1, this.N + this.noveltyRefill * dt);
    let injection = false;
    if (surprise > 0.5 && this.N >= 0.5 && (1 - lambda) > 0.3) { injection = true; this.N -= 0.5; }

    const request1 = this.pendingRequest; this.pendingRequest = null;
    const src = (axis, leadActive, userTouched) => leadActive ? (this.jevAxes.has(axis) ? 'jev' : 'arc') : (userTouched ? 'you' : 'music');
    return {
      I, lambda, As, phase: this.beat.phase, worldPhase: this.world.phase, pulse, phraseBoundary, surprise,
      targets: { H, T, D, S, F, palette: this.palette, hue, camera, omega: lead.omega },
      hTarget, hWidth, sceneChange, injection, request: request1,
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
