/* Worlds as volumes (v2 §4.2): meshes and per-frame rendering for the four simulations, in two camera
   states. Hover: the v1 spheres and clouds. Ship: physarum and Life become tunnels the viewer flies through,
   swarm and boids stream past and re-enter ahead. Browser module (imports Three.js); rules stay in the sims. */
import * as THREE from '../vendor/three.module.js';
import { paletteHSL, paletteLUT } from './engine/palettes.mjs';

const TAU = Math.PI * 2;
const dummy = new THREE.Object3D(), color = new THREE.Color(), direction = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0);

export class Worlds {
  constructor(group, sims, scene) {
    this.group = group; this.sims = sims; this.visual = null; this.world = null; this.mode = 'hover'; this.skin = 'fish';
    // Physarum trail texture shared by the sphere and the tunnel (own repeat/offset for the tunnel).
    const size = sims.physarum.size;
    this.canvas = document.createElement('canvas'); this.canvas.width = this.canvas.height = size;
    this.ctx = this.canvas.getContext('2d'); this.pixels = this.ctx.createImageData(size, size);
    this.texture = new THREE.CanvasTexture(this.canvas); this.texture.colorSpace = THREE.SRGBColorSpace;
    this.texture.minFilter = this.texture.magFilter = THREE.LinearFilter;
    this.tunnelTexture = this.texture.clone(); this.tunnelTexture.wrapS = this.tunnelTexture.wrapT = THREE.RepeatWrapping; this.tunnelTexture.repeat.set(1, 3);
    const haloCanvas = document.createElement('canvas'); haloCanvas.width = haloCanvas.height = 64;
    const hc = haloCanvas.getContext('2d'), hg = hc.createRadialGradient(32, 32, 0, 32, 32, 32);
    hg.addColorStop(0, 'rgba(255,255,255,1)'); hg.addColorStop(0.15, 'rgba(255,255,255,.7)'); hg.addColorStop(0.5, 'rgba(255,255,255,.12)'); hg.addColorStop(1, 'rgba(255,255,255,0)');
    hc.fillStyle = hg; hc.fillRect(0, 0, 64, 64); this.haloTexture = new THREE.CanvasTexture(haloCanvas);
    // Stars as streakable line segments.
    this.starCount = 700; this.starPos = new Float32Array(this.starCount * 3); this.starLines = new Float32Array(this.starCount * 6);
    for (let i = 0; i < this.starCount; i++) { this.starPos[i * 3] = (Math.random() - 0.5) * 100; this.starPos[i * 3 + 1] = (Math.random() - 0.5) * 100; this.starPos[i * 3 + 2] = (Math.random() - 0.5) * 100; }
    const starG = new THREE.BufferGeometry(); starG.setAttribute('position', new THREE.BufferAttribute(this.starLines, 3));
    this.stars = new THREE.LineSegments(starG, new THREE.LineBasicMaterial({ color: 0x6c8aab, transparent: true, opacity: 0.5 }));
    this.stars.frustumCulled = false; scene.add(this.stars);
    this.updateStars(0, 2, 0);
    this.lifeScroll = 0;
  }

  clean() {
    while (this.group.children.length) {
      const obj = this.group.children[0]; this.group.remove(obj);
      obj.traverse(o => { o.geometry?.dispose(); if (o.material) for (const m of (Array.isArray(o.material) ? o.material : [o.material])) m.dispose(); });
    }
    this.visual = null;
  }

  addHalos(sim) {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(sim.p, 3));
    g.setAttribute('color', new THREE.BufferAttribute(new Float32Array(sim.count * 3), 3));
    const dots = new THREE.Points(g, new THREE.PointsMaterial({ map: this.haloTexture, size: 0.65, transparent: true, opacity: 0.65, vertexColors: true, blending: THREE.AdditiveBlending, depthWrite: false }));
    dots.frustumCulled = false; this.group.add(dots); this.visual.userData.halo = dots;
  }

  build(world, mode, skin = this.skin) {
    this.clean(); this.world = world; this.mode = mode; this.skin = skin;
    const s = this.sims, ship = mode === 'ship';
    s.swarm.travel = ship; s.boids.travel = ship;
    if (world === 'physarum') {
      if (ship) {
        const mat = new THREE.MeshBasicMaterial({ map: this.tunnelTexture, side: THREE.BackSide, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false });
        this.visual = new THREE.Mesh(new THREE.CylinderGeometry(6, 6, 60, 48, 1, true), mat);
        this.visual.rotation.x = Math.PI / 2; this.visual.userData.tunnel = true;
      } else {
        this.visual = new THREE.Mesh(new THREE.SphereGeometry(8.5, 64, 40), new THREE.MeshBasicMaterial({ map: this.texture, side: THREE.DoubleSide, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
        this.group.add(new THREE.Mesh(new THREE.SphereGeometry(9, 40, 24), new THREE.MeshBasicMaterial({ color: 0x5a7990, wireframe: true, transparent: true, opacity: 0.025 })));
      }
      this.group.add(this.visual);
    } else if (world === 'swarm') {
      this.visual = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(0.065, 1), new THREE.MeshBasicMaterial({ color: 0xffffff }), s.swarm.count);
      this.visual.instanceMatrix.setUsage(THREE.DynamicDrawUsage); this.group.add(this.visual);
      const trailG = new THREE.BufferGeometry(); trailG.setAttribute('position', new THREE.BufferAttribute(new Float32Array(s.swarm.count * 6), 3));
      const trail = new THREE.LineSegments(trailG, new THREE.LineBasicMaterial({ color: 0x81c6ed, transparent: true, opacity: 0.16 }));
      trail.frustumCulled = false; this.group.add(trail); this.visual.userData.trail = trail;
    } else if (world === 'boids') {
      const geo = skin === 'lights' ? new THREE.IcosahedronGeometry(0.065, 0) : new THREE.ConeGeometry(skin === 'birds' ? 0.17 : 0.09, 0.45, skin === 'birds' ? 3 : 5);
      this.visual = new THREE.InstancedMesh(geo, new THREE.MeshBasicMaterial({ color: 0xffffff }), s.boids.count);
      this.visual.instanceMatrix.setUsage(THREE.DynamicDrawUsage); this.group.add(this.visual);
    } else {
      this.visual = new THREE.InstancedMesh(new THREE.BoxGeometry(0.12, 0.12, 0.12), new THREE.MeshBasicMaterial({ color: 0xffffff }), s.life.grid.cells.length);
      this.visual.instanceMatrix.setUsage(THREE.DynamicDrawUsage); this.group.add(this.visual);
    }
    this.visual.frustumCulled = false;
    if (world === 'swarm') this.addHalos(s.swarm);
    if (world === 'boids') this.addHalos(s.boids);
  }

  // Translate agents toward the viewer so a travelling world streams past (the sims re-enter them ahead).
  stream(dz) {
    if (!dz) return;
    const s = this.sims;
    if (this.world === 'boids') { const p = s.boids.p, n = s.boids.active; for (let i = 0; i < n; i++) p[i * 3 + 2] += dz * 0.8; }
    else if (this.world === 'swarm') { const p = s.swarm.p, n = s.swarm.active; for (let i = 0; i < n; i++) p[i * 3 + 2] += dz * 0.5; }
    else if (this.world === 'physarum' && this.visual?.userData.tunnel) this.tunnelTexture.offset.y -= dz / 20;
    else if (this.world === 'life') this.lifeScroll = (this.lifeScroll + dz) % 60;
  }

  updateStars(speed, base, dz) {
    const len = 0.02 + 0.3 * (speed / base), p = this.starPos, l = this.starLines;
    for (let i = 0; i < this.starCount; i++) {
      if (dz) { p[i * 3 + 2] += dz * 1.2; if (p[i * 3 + 2] > 10) p[i * 3 + 2] -= 70; }
      const x = p[i * 3], y = p[i * 3 + 1], z = p[i * 3 + 2];
      l[i * 6] = x; l[i * 6 + 1] = y; l[i * 6 + 2] = z; l[i * 6 + 3] = x; l[i * 6 + 4] = y; l[i * 6 + 5] = z + len;
    }
    this.stars.geometry.attributes.position.needsUpdate = true;
  }

  paletteColor(palette, hue, sat, t, v) { const [h, s, l] = paletteHSL(palette, hue / 360, t, v, sat); color.setHSL(h, s, l); return color; }

  render({ palette, hue, sat = 1, pulse, simTime, intensity = 0.8 }) {
    if (!this.visual) return;
    const s = this.sims, scale = 1 + 0.5 * pulse * intensity, visual = this.visual;
    if (this.world === 'physarum') {
      const field = s.physarum.field, lut = paletteLUT(palette, (hue / 360 + 0.48) % 1, 256, sat), data = this.pixels.data;
      for (let i = 0; i < field.length; i++) {
        const v = Math.pow(1 - Math.exp(-field[i] * 1.3), 1.4), k = Math.min(1, v * 3), idx = ((v * 255) | 0) * 3, o = i * 4;
        data[o] = lut[idx] * k; data[o + 1] = lut[idx + 1] * k; data[o + 2] = lut[idx + 2] * k; data[o + 3] = 255;
      }
      this.ctx.putImageData(this.pixels, 0, 0);
      if (visual.userData.tunnel) { this.tunnelTexture.needsUpdate = true; visual.scale.set(0.96 + 0.04 * scale, 1, 0.96 + 0.04 * scale); visual.rotation.y += 0.0005; }
      else { this.texture.needsUpdate = true; visual.rotation.y = simTime * 0.025; visual.scale.setScalar(0.96 + 0.04 * scale); }
    } else if (this.world === 'swarm') {
      const sw = s.swarm, p = sw.p, lines = visual.userData.trail.geometry.attributes.position;
      for (let i = 0; i < sw.active; i++) {
        const phase = sw.phase[i], glow = 0.8 + 0.55 * (0.5 + 0.5 * Math.sin(phase));
        dummy.position.set(p[i * 3], p[i * 3 + 1], p[i * 3 + 2]); dummy.quaternion.identity(); dummy.scale.setScalar(glow * scale); dummy.updateMatrix();
        visual.setMatrixAt(i, dummy.matrix); visual.setColorAt(i, this.paletteColor(palette, hue, sat, phase / TAU, 0.5 + 0.5 * Math.sin(phase)));
        for (let k = 0; k < 3; k++) { lines.array[i * 6 + k] = p[i * 3 + k]; lines.array[i * 6 + 3 + k] = p[i * 3 + k] - sw.delta[i * 3 + k] * 1.2; }
      }
      visual.count = sw.active; lines.needsUpdate = true; visual.userData.trail.geometry.setDrawRange(0, sw.active * 2);
      visual.instanceMatrix.needsUpdate = true; visual.instanceColor.needsUpdate = true;
    } else if (this.world === 'boids') {
      const b = s.boids, birds = this.skin === 'birds';
      for (let i = 0; i < b.active; i++) {
        const o = i * 3;
        dummy.position.fromArray(b.p, o); direction.fromArray(b.v, o).normalize(); dummy.quaternion.setFromUnitVectors(up, direction);
        dummy.scale.set(birds ? 1 + Math.sin(simTime * 8 + i) * 0.2 : 1, scale, 1); dummy.updateMatrix();
        visual.setMatrixAt(i, dummy.matrix); visual.setColorAt(i, this.paletteColor(palette, hue, sat, i / b.count, 0.65));
      }
      visual.count = b.active; visual.instanceMatrix.needsUpdate = true; visual.instanceColor.needsUpdate = true;
    } else {
      const life = s.life, cells = life.grid.cells, age = life.grid.age, n = life.size, tunnel = this.mode === 'ship'; let count = 0;
      for (let i = 0; i < cells.length; i++) {
        if (!cells[i]) continue;
        const ix = i % n, iy = Math.floor(i / n);
        if (tunnel) {
          const a = ix / n * TAU, z = ((iy / n * 60 + this.lifeScroll) % 60 + 60) % 60 - 54;   // tunnel from z −54 to +6 around the viewer
          dummy.position.set(6 * Math.cos(a), 6 * Math.sin(a), z);
        } else {
          const a = ix / n * TAU, bb = (iy + 0.5) / n * Math.PI, r = 7 + Math.min(age[i], 40) * 0.012;
          dummy.position.set(r * Math.sin(bb) * Math.cos(a), r * Math.cos(bb), r * Math.sin(bb) * Math.sin(a));
        }
        dummy.quaternion.identity(); dummy.scale.setScalar((0.6 + 0.6 * life.density) * scale * (tunnel ? 1.6 : 1)); dummy.updateMatrix();
        visual.setMatrixAt(count, dummy.matrix); visual.setColorAt(count++, this.paletteColor(palette, hue, sat, Math.min(age[i], 60) / 60, 0.65));
      }
      visual.count = count; visual.instanceMatrix.needsUpdate = true; if (visual.instanceColor) visual.instanceColor.needsUpdate = true;
    }
    if (visual.userData.halo) {
      const attrs = visual.userData.halo.geometry.attributes, sim = s[this.world];
      attrs.position.needsUpdate = true; attrs.color.array.set(visual.instanceColor.array); attrs.color.needsUpdate = true;
      visual.userData.halo.geometry.setDrawRange(0, sim.active);
    }
  }

  dispose() { this.clean(); this.texture.dispose(); this.tunnelTexture.dispose(); this.haloTexture.dispose(); this.stars.geometry.dispose(); this.stars.material.dispose(); }
}
