/* Post-process: kaleidoscope fold and tone-mapped frame feedback over the live world.
   Appearance layers only; the simulations' rules are untouched. Browser module (imports Three.js).
   The feedback mix mirrors engine/feedback-math.mjs exactly: out = 1 - exp(-(cur + prev * min(decay, 0.96))). */
import * as THREE from '../../vendor/three.module.js';

const VERTEX = `varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`;
const FRAGMENT = `
precision highp float;
uniform sampler2D tScene; uniform sampler2D tPrev;
uniform float fold; uniform float foldPrev; uniform float foldMix;
uniform float zoom; uniform float rot; uniform float decay; uniform float gain; uniform float aspect;
varying vec2 vUv;
vec2 foldUv(vec2 uv, float n){
  if (n < 1.5) return uv;
  vec2 c = (uv - 0.5) * vec2(aspect, 1.0);
  float r = length(c); float a = atan(c.y, c.x);
  float sector = 6.28318530718 / n;
  a = mod(a, sector); if (a > sector * 0.5) a = sector - a;
  vec2 p = vec2(cos(a), sin(a)) * r;
  return p / vec2(aspect, 1.0) + 0.5;
}
vec3 sceneAt(vec2 uv){ return texture2D(tScene, clamp(uv, 0.0, 1.0)).rgb; }
void main(){
  vec3 a = sceneAt(foldUv(vUv, fold));
  vec3 b = sceneAt(foldUv(vUv, foldPrev));
  vec3 cur = mix(b, a, foldMix) * gain;
  vec2 c = vUv - 0.5; float cs = cos(rot), sn = sin(rot);
  c = vec2(c.x * cs - c.y * sn, c.x * sn + c.y * cs) / zoom;
  vec2 puv = c + 0.5;
  vec3 prev = (puv.x < 0.0 || puv.x > 1.0 || puv.y < 0.0 || puv.y > 1.0) ? vec3(0.0) : texture2D(tPrev, puv).rgb;
  vec3 outc = 1.0 - exp(-(cur + prev * min(decay, 0.96)));
  gl_FragColor = vec4(outc, 1.0);
}`;

export class PostFX {
  constructor(renderer, { width, height } = {}) {
    this.renderer = renderer;
    const w = Math.max(2, width || 2), h = Math.max(2, height || 2);
    this.sceneTarget = new THREE.WebGLRenderTarget(w, h, { depthBuffer: true, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter });
    const fb = { depthBuffer: false, type: THREE.HalfFloatType, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter };
    this.ping = new THREE.WebGLRenderTarget(w, h, fb); this.pong = new THREE.WebGLRenderTarget(w, h, fb);
    this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    this.uniforms = {
      tScene: { value: this.sceneTarget.texture }, tPrev: { value: this.ping.texture },
      fold: { value: 0 }, foldPrev: { value: 0 }, foldMix: { value: 1 },
      zoom: { value: 1 }, rot: { value: 0 }, decay: { value: 0.8 }, gain: { value: 1.25 }, aspect: { value: w / h },
    };
    this.material = new THREE.ShaderMaterial({ uniforms: this.uniforms, vertexShader: VERTEX, fragmentShader: FRAGMENT, depthTest: false, depthWrite: false });
    this.quad = new THREE.Scene(); this.quad.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.material));
    this.copyMaterial = new THREE.MeshBasicMaterial({ map: this.pong.texture, depthTest: false, depthWrite: false });
    this.blit = new THREE.Scene(); this.blit.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.copyMaterial));
    this.fold = 0; this.foldPrev = 0; this.foldMix = 1;
  }
  setSize(width, height) {
    const w = Math.max(2, width | 0), h = Math.max(2, height | 0);
    this.sceneTarget.setSize(w, h); this.ping.setSize(w, h); this.pong.setSize(w, h);
    this.uniforms.aspect.value = w / h;
  }
  render(scene, camera, { fold = 0, feedback = 0, pulse = 0, dt = 1 / 60, fadeSeconds = 2 } = {}) {
    const r = this.renderer, u = this.uniforms;
    if (fold !== this.fold) {
      // Start a cross-fade from whatever is on screen now toward the new fold count.
      this.foldPrev = this.foldMix >= 1 ? this.fold : this.foldPrev; this.fold = fold; this.foldMix = 0;
    }
    this.foldMix = Math.min(1, this.foldMix + dt / Math.max(0.1, fadeSeconds));
    const previousTarget = r.getRenderTarget();
    r.setRenderTarget(this.sceneTarget); r.clear(); r.render(scene, camera);
    u.tScene.value = this.sceneTarget.texture; u.tPrev.value = this.ping.texture;
    u.fold.value = this.fold; u.foldPrev.value = this.foldPrev; u.foldMix.value = this.foldMix;
    u.zoom.value = 1 + 0.015 * feedback * (1 + pulse); u.rot.value = 0.004 * feedback;
    u.decay.value = 0.80 + 0.16 * feedback;
    r.setRenderTarget(this.pong); r.render(this.quad, this.camera);
    this.copyMaterial.map = this.pong.texture;
    r.setRenderTarget(previousTarget); r.render(this.blit, this.camera);
    [this.ping, this.pong] = [this.pong, this.ping];
  }
  dispose() {
    for (const t of [this.sceneTarget, this.ping, this.pong]) t.dispose();
    this.material.dispose(); this.copyMaterial.dispose();
    for (const s of [this.quad, this.blit]) s.traverse(o => o.geometry?.dispose());
  }
}
