/* The observer (v3.3): where you stand and what you look at. Each world has several viewpoints; the director
   moves to the next one every two phrases and starts again when the world changes. Most shots are clean (no
   kaleidoscope); one per world is dressed, so the kaleidoscope is a climax, not the ground. Poses are pure math:
   the app eases the real camera toward them. */
export const SHOTS = {
  life: [
    { name: 'satellite', clean: true, label: 'satellite orbit' },
    { name: 'lowOrbit', clean: true, label: 'low orbit over the horizon' },
    { name: 'distant', clean: true, label: 'the planet from far away' },
    { name: 'orbit', clean: false, label: 'kaleidoscope orbit' },
  ],
  physarum: [
    { name: 'satellite', clean: true, layout: 'sphere', label: 'satellite orbit' },
    { name: 'dish', clean: true, layout: 'dish', label: 'petri dish from above' },
    { name: 'inside', clean: true, layout: 'sphere', label: 'inside the network' },
    { name: 'orbit', clean: false, layout: 'sphere', label: 'kaleidoscope orbit' },
  ],
  swarm: [
    { name: 'far', clean: true, label: 'a galaxy far away' },
    { name: 'inside', clean: true, label: 'inside the swarm' },
    { name: 'chase', clean: true, label: 'following one firefly' },
    { name: 'orbit', clean: false, label: 'kaleidoscope orbit' },
  ],
  boids: [
    { name: 'side', clean: true, label: 'the tank from the side' },
    { name: 'chase', clean: true, label: 'following one fish' },
    { name: 'below', clean: true, label: 'looking up from below' },
    { name: 'orbit', clean: false, label: 'kaleidoscope orbit' },
  ],
};

export class ShotDirector {
  constructor(world = 'physarum', { phrasesPerShot = 2 } = {}) {
    this.phrasesPerShot = phrasesPerShot; this.world = world; this.index = 0; this.count = 0; this.changed = true;
  }
  get list() { return SHOTS[this.world] || SHOTS.physarum; }
  get shot() { return this.list[this.index % this.list.length]; }
  update({ phrase = false, world = this.world } = {}) {
    this.changed = false;
    if (world !== this.world) { this.world = world; this.index = 0; this.count = 0; this.changed = true; return this.shot; }
    if (phrase && ++this.count >= this.phrasesPerShot) this.next();
    return this.shot;
  }
  next() { this.index = (this.index + 1) % this.list.length; this.count = 0; this.changed = true; return this.shot; }
  pick(name) {
    const i = this.list.findIndex(s => s.name === name);
    if (i < 0) return false;
    this.index = i; this.count = 0; this.changed = true; return true;
  }
}

const add = (a, b, k = 1) => [a[0] + b[0] * k, a[1] + b[1] * k, a[2] + b[2] * k];
const norm = v => { const l = Math.hypot(v[0], v[1], v[2]); return l > 1e-6 ? [v[0] / l, v[1] / l, v[2] / l] : [0, 0, 1]; };

export function shotPose(name, { t = 0, target = [0, 0, 0], vel = [0, 0, 1], yaw = 0, zoom = 1 } = {}) {
  const z = Math.max(0.3, Math.min(2.5, Number.isFinite(zoom) ? zoom : 1));
  switch (name) {
    case 'satellite': {   // an inclined orbit; the planet fills most of the frame
      const r = 22 * Math.min(1.15, z), a = yaw + t * 0.05, inc = 0.45;
      return { pos: [r * Math.cos(a), r * Math.sin(a) * Math.sin(inc), r * Math.sin(a) * Math.cos(inc)], look: [0, 0, 0], fov: 50 };
    }
    case 'lowOrbit': {    // skimming the surface, looking ahead at the curved horizon
      const r = 9.2, a = yaw + t * 0.08, inc = 0.3, at = (ang, rad) => [rad * Math.cos(ang), rad * Math.sin(ang) * Math.sin(inc), rad * Math.sin(ang) * Math.cos(inc)];
      return { pos: at(a, r), look: at(a + 0.75, 7.2), fov: 70 };
    }
    case 'distant': {     // a telephoto from far away: the whole planet, small and flat
      const r = 34 * z, a = yaw + t * 0.015;
      return { pos: [Math.sin(a) * r, r * 0.25, Math.cos(a) * r], look: [0, 0, 0], fov: 24 };
    }
    case 'dish': {        // a microscope over a petri dish, drifting slowly
      return { pos: [Math.sin(t * 0.03) * 2.5, 17 * z, 3 + Math.cos(t * 0.03) * 2.5], look: [0, 0, 0], fov: 55 };
    }
    case 'inside': {      // standing in the middle, turning slowly
      const a = yaw + t * 0.06;
      return { pos: [...target], look: add(target, [Math.sin(a), 0.4 * Math.sin(t * 0.04), Math.cos(a)]), fov: 80 };
    }
    case 'far': {         // a galaxy: the swarm as one shape, seen at a tilt
      const r = 30 * z, a = yaw + t * 0.02;
      return { pos: add(target, [Math.sin(a) * r, r * 0.35, Math.cos(a) * r]), look: [...target], fov: 35 };
    }
    case 'chase': {       // behind one of them, looking where it goes
      const v = norm(vel);
      return { pos: add(add(target, v, -4.5), [0, 1.2, 0]), look: add(target, v, 4), fov: 68 };
    }
    case 'below': {       // underneath, looking up at the silhouettes
      return { pos: [target[0] + Math.sin(t * 0.05) * 2, target[1] - 7 * z, target[2] + Math.cos(t * 0.05) * 2], look: [...target], fov: 70 };
    }
    case 'side': {        // the tank from the side, a long lens
      return { pos: add(target, [16 * z * Math.sin(yaw + Math.PI / 2), 1, 16 * z * Math.cos(yaw + Math.PI / 2)]), look: [...target], fov: 38 };
    }
    default: {            // 'orbit': the v1 view, used for the dressed (kaleidoscope) shot
      const r = 19 * z, a = yaw + t * 0.025;
      return { pos: [Math.sin(a) * r, Math.sin(0.12) * r, Math.cos(a) * r], look: [0, 0, 0], fov: 65 };
    }
  }
}

// A view named in words (English or Cantonese). 'next' means "another angle".
const VIEW_WORDS = [['satellite', /satellite|衛星|衞星/], ['inside', /inside|入去|裏面|裡面|入面/], ['chase', /chase|跟住|追/], ['below', /below|下面|底下/], ['next', /換角度|換鏡頭|another view|next view|change view|other angle/]];
export function shotForWords(text) {
  const t = String(text || '').toLowerCase();
  for (const [name, re] of VIEW_WORDS) if (re.test(t)) return name;
  return null;
}
