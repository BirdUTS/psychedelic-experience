/* Post-process (v3 §4): one fragment pass turns a *program* (engine/grammar.mjs) into the picture.
   On the sampling coordinate: breath → warp → tunnel (log-polar) → fold / mirror → sample (chroma split along the radius).
   On colour: contour → echo (previous frame; droste) → hue cycle; then, on the way to the screen only, forms (Klüver
   stripes in log-polar space) — never into the feedback buffer.
   Appearance layers only; the simulations' rules are untouched. Browser module (imports Three.js).
   The echo mix mirrors engine/feedback-math.mjs exactly: out = 1 - exp(-(cur·gain + prev·min(decay, 0.96))). */
import * as THREE from '../../vendor/three.module.js';
import { MIRRORS, FORM_KINDS, defaultProgram } from './grammar.mjs';

const VERTEX = `varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`;
const FRAGMENT = `
precision highp float;
uniform sampler2D tScene; uniform sampler2D tPrev;
uniform vec2 resolution; uniform float aspect; uniform float pixelRatio;
uniform float time; uniform float beatPhase; uniform float pulse; uniform float quality;
uniform float fold; uniform float foldPrev; uniform float foldMix; uniform int mirror; uniform int formKind;
uniform float droste; uniform float tunnel; uniform float tunnelSpeed;
uniform float formDensity; uniform float formDrift; uniform float formContrast;
uniform float warp; uniform float warpScale; uniform float warpRate; uniform float breath;
uniform float contour; uniform float contourLine; uniform float chromaSplit; uniform float chromaCycle;
uniform float uZoom; uniform float uRot; uniform float uDecay; uniform float uGain;
varying vec2 vUv;
const float PI = 3.14159265; const float TAU = 6.28318531;
float tri(float x){ return abs(fract(x * 0.5) * 2.0 - 1.0); }
vec2 rot2(vec2 v, float a){ float cs = cos(a), sn = sin(a); return vec2(v.x * cs - v.y * sn, v.x * sn + v.y * cs); }
bool inside(vec2 uv){ return uv.x >= 0.0 && uv.x <= 1.0 && uv.y >= 0.0 && uv.y <= 1.0; }
float ang(vec2 c){ return dot(c, c) > 1e-10 ? atan(c.y, c.x) : 0.0; }   // atan(0, 0) is undefined on some GPUs
vec2 foldUv(vec2 uv, float n){
  if (n < 1.5) return uv;
  vec2 c = (uv - 0.5) * vec2(aspect, 1.0);
  float r = length(c); float a = ang(c);
  float sector = TAU / n;
  a = mod(a, sector); if (a > sector * 0.5) a = sector - a;
  vec2 p = vec2(cos(a), sin(a)) * r;
  return p / vec2(aspect, 1.0) + 0.5;
}
vec2 mirrorUv(vec2 uv){
  if (mirror == 1 || mirror == 3) uv.x = 0.5 + abs(uv.x - 0.5);
  if (mirror == 2 || mirror == 3) uv.y = 0.5 + abs(uv.y - 0.5);
  return uv;
}
vec3 sceneAt(vec2 uv){ return texture2D(tScene, clamp(uv, 0.0, 1.0)).rgb; }
vec3 split(vec2 uv, vec2 off){
  if (chromaSplit <= 0.0) return sceneAt(uv);
  return vec3(sceneAt(uv + off).r, sceneAt(uv).g, sceneAt(uv - off).b);
}
vec3 sampleScene(vec2 uv, vec2 off){
  vec3 a = split(mirrorUv(foldUv(uv, fold)), off);
  if (foldMix >= 1.0) return a;
  return mix(split(mirrorUv(foldUv(uv, foldPrev)), off), a, foldMix);
}
vec3 hueRotate(vec3 c, float a){
  const vec3 k = vec3(0.57735027);
  float cs = cos(a), sn = sin(a);
  return c * cs + cross(k, c) * sn + k * dot(k, c) * (1.0 - cs);
}
void main(){
  vec2 c = (vUv - 0.5) * vec2(aspect, 1.0);
  // breath: a barrel factor locked to the world clock (the frame inhales and exhales)
  float b = 0.08 * breath * sin(TAU * beatPhase);
  c *= 1.0 + b * (0.5 + 2.0 * dot(c, c));
  // warp: iterated sine domain warping (melting)
  vec2 p = c;
  if (warp > 0.0) {
    float k = 2.0 + 10.0 * warpScale, t = time * (0.3 + 2.0 * warpRate), amp = 0.04 * warp;
    for (int i = 0; i < 6; i++) { if (float(i) >= 6.0 * quality) break; p += amp * sin(p.yx * k + t + float(i) * 1.7); }
  }
  // tunnel: the frame becomes a tube (log-polar remap), mixed by amount; speed scrolls down it
  vec2 uv = p / vec2(aspect, 1.0) + 0.5;
  if (tunnel > 0.0) {
    float r = max(length(p), 1e-4), th = ang(p);
    vec2 tuv = vec2(tri(th / PI + 1.0), tri(log(r) * 1.2 - tunnelSpeed * time * 1.2));
    uv = mix(uv, tuv, tunnel);
  }
  // sample the world through fold and mirror, with the chroma split along the radius
  vec2 dir = dot(c, c) > 1e-8 ? normalize(c) : vec2(1.0, 0.0);
  vec2 off = dir * (chromaSplit * 8.0 * pixelRatio) / resolution;
  vec3 col = sampleScene(uv, off);
  // contour: luminance posterised into bands with thin dark iso-lines (never inverts)
  if (contour > 0.0) {
    float lum = dot(col, vec3(0.299, 0.587, 0.114));
    float bands = 2.0 + 10.0 * contour;
    float x = lum * bands, f = fract(x);
    float lw = 0.04 + 0.25 * contourLine;
    float line = 1.0 - 0.85 * (1.0 - smoothstep(0.0, lw, min(f, 1.0 - f)));
    float ratio = min(1.5, ((floor(x) + 0.5) / bands) / max(lum, 1e-3));
    col = mix(col, col * ratio * line, contour);
  }
  // echo: the previous frame, zoomed and spun; droste pulls it into its own centre along a spiral
  vec2 q = vUv - 0.5;
  vec2 e = rot2(q, uRot) / uZoom + 0.5;
  vec3 prev = inside(e) ? texture2D(tPrev, e).rgb : vec3(0.0);
  if (droste > 0.0) {
    vec2 d = rot2(q * vec2(aspect, 1.0), 0.6 * droste) * (1.0 + 0.4 * droste);
    d = d / vec2(aspect, 1.0) + 0.5;
    float edge = smoothstep(0.0, 0.12, min(min(d.x, 1.0 - d.x), min(d.y, 1.0 - d.y)));   // soft rim, not a hard rectangle
    vec3 pd = inside(d) ? texture2D(tPrev, d).rgb * edge : vec3(0.0);
    prev = mix(prev, pd, droste);
  }
  // The echo must only ever see non-negative, finite colour: 1 - exp(-x) amplifies negatives, and a NaN
  // in the feedback buffer would spread through every later frame (NaN compares false, so the guard resets it).
  prev = max(prev, 0.0); if (!(prev.r + prev.g + prev.b >= 0.0)) prev = vec3(0.0);
  vec3 outc = 1.0 - exp(-(max(col, 0.0) * uGain + prev * min(uDecay, 0.96)));
  if (chromaCycle > 0.0) outc = hueRotate(outc, chromaCycle * time * 0.3);
  gl_FragColor = vec4(max(outc, 0.0), 1.0);
}`;

const DISPLAY = `
precision highp float;
uniform sampler2D tInput; uniform float aspect; uniform float time; uniform float beatPhase;
uniform int formKind; uniform float formDensity; uniform float formDrift; uniform float formContrast;
varying vec2 vUv;
const float TAU = 6.28318531;
float ang(vec2 c){ return dot(c, c) > 1e-10 ? atan(c.y, c.x) : 0.0; }
void main(){
  vec3 col = texture2D(tInput, vUv).rgb;
  vec2 c = (vUv - 0.5) * vec2(aspect, 1.0);
  // forms: Klüver stripes in log-polar space, screen-blended in the picture's own colour. Drawn here, on the way
  // to the screen, never into the feedback buffer: an additive pattern fed back through the echo washes to white.
  if (formContrast > 0.0) {
    float r = max(length(c), 1e-4), th = ang(c), lr = log(r);
    float D = 4.0 + 20.0 * formDensity, m = max(1.0, floor(D + 0.5));
    float ph = formDrift * (1.5 * time + 0.3 * sin(TAU * beatPhase));
    float s;
    if (formKind == 0) s = cos(lr * D - ph);                                   // tunnel: rings along log r
    else if (formKind == 1) s = cos(lr * D + th * m - ph);                     // spiral: 45° in log-polar
    else if (formKind == 2) s = 0.8 * cos(th * m) + 0.2 * cos(lr * D - ph);    // cobweb: spokes, faint rings
    else s = cos(lr * D - ph) * cos(th * m);                                   // lattice: both
    float v = smoothstep(0.15, 0.85, 0.5 + 0.5 * s) * smoothstep(0.0, 0.06, r);
    float mx = max(col.r, max(col.g, col.b));
    vec3 tint = mix(vec3(0.4), col / max(mx, 0.05), 0.6);
    float keep = 0.25 + 0.75 * smoothstep(0.0, 0.5, mx);   // dark space stays mostly dark under the stripes
    col = 1.0 - (1.0 - col) * (1.0 - v * formContrast * keep * tint);
  }
  gl_FragColor = vec4(col, 1.0);
}`;

const DIRECT = ['droste', 'tunnel', 'tunnelSpeed', 'formDensity', 'formDrift', 'formContrast', 'warp', 'warpScale', 'warpRate', 'breath', 'contour', 'contourLine', 'chromaSplit', 'chromaCycle'];
const clamp = (v, lo, hi) => (v = Number(v) || 0) < lo ? lo : v > hi ? hi : v;

export class PostFX {
  constructor(renderer, { width, height } = {}) {
    this.renderer = renderer;
    const w = Math.max(2, width || 2), h = Math.max(2, height || 2);
    this.sceneTarget = new THREE.WebGLRenderTarget(w, h, { depthBuffer: true, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter });
    const fb = { depthBuffer: false, type: THREE.HalfFloatType, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter };
    this.ping = new THREE.WebGLRenderTarget(w, h, fb); this.pong = new THREE.WebGLRenderTarget(w, h, fb);
    this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    const u = this.uniforms = {
      tScene: { value: this.sceneTarget.texture }, tPrev: { value: this.ping.texture },
      resolution: { value: new THREE.Vector2(w, h) }, aspect: { value: w / h }, pixelRatio: { value: 1 },
      time: { value: 0 }, beatPhase: { value: 0 }, pulse: { value: 0 }, quality: { value: 1 },
      fold: { value: 0 }, foldPrev: { value: 0 }, foldMix: { value: 1 }, mirror: { value: 0 }, formKind: { value: 0 },
      uZoom: { value: 1 }, uRot: { value: 0 }, uDecay: { value: 0.8 }, uGain: { value: 1.25 },
    };
    for (const k of DIRECT) u[k] = { value: 0 };
    this.material = new THREE.ShaderMaterial({ uniforms: u, vertexShader: VERTEX, fragmentShader: FRAGMENT, depthTest: false, depthWrite: false });
    this.quad = new THREE.Scene(); this.quad.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.material));
    const d = this.display = { tInput: { value: this.pong.texture }, aspect: { value: w / h }, time: { value: 0 }, beatPhase: { value: 0 }, formKind: { value: 0 }, formDensity: { value: 0 }, formDrift: { value: 0 }, formContrast: { value: 0 } };
    this.copyMaterial = new THREE.ShaderMaterial({ uniforms: d, vertexShader: VERTEX, fragmentShader: DISPLAY, depthTest: false, depthWrite: false });
    this.blit = new THREE.Scene(); this.blit.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.copyMaterial));
    this.fold = 0; this.foldPrev = 0; this.foldMix = 1;
    this.program = defaultProgram();   // the last program rendered (for Explain and checks)
  }
  setSize(width, height) {
    const w = Math.max(2, width | 0), h = Math.max(2, height | 0);
    this.sceneTarget.setSize(w, h); this.ping.setSize(w, h); this.pong.setSize(w, h);
    this.uniforms.aspect.value = w / h; this.uniforms.resolution.value.set(w, h); this.display.aspect.value = w / h;
  }
  render(scene, camera, program = defaultProgram(), { pulse = 0, beatPhase = 0, time = 0, dt = 1 / 60, quality = 1, fadeSeconds = 2 } = {}) {
    const r = this.renderer, u = this.uniforms, p = program;
    const fold = Number(p.fold) || 0;
    if (fold !== this.fold) {
      // Cross-fade from the fold we were heading to toward the new one; a mid-fade change promotes the
      // current target so a half-visible fold never vanishes in one frame (v2).
      this.foldPrev = this.fold; this.fold = fold; this.foldMix = 0;
    }
    this.foldMix = Math.min(1, this.foldMix + dt / Math.max(0.1, fadeSeconds));
    Object.assign(this.program, p);
    u.fold.value = this.fold; u.foldPrev.value = this.foldPrev; u.foldMix.value = this.foldMix;
    u.mirror.value = Math.max(0, MIRRORS.indexOf(p.mirror)); u.formKind.value = Math.max(0, FORM_KINDS.indexOf(p.formKind));
    for (const k of DIRECT) u[k].value = clamp(p[k], k === 'formDrift' ? -1 : 0, 1);
    u.uZoom.value = 1 + 0.015 * clamp(p.echoZoom, 0, 1) * (1 + pulse);
    u.uRot.value = 0.004 * clamp(p.echoSpin, 0, 1);
    u.uDecay.value = 0.80 + 0.16 * clamp(p.echoDecay, 0, 1);
    u.uGain.value = 0.5 + 1.25 * clamp(p.gain, 0, 1);
    u.time.value = time; u.beatPhase.value = beatPhase; u.pulse.value = pulse; u.quality.value = clamp(quality, 0, 1);
    u.pixelRatio.value = r.getPixelRatio();
    const previousTarget = r.getRenderTarget();
    r.setRenderTarget(this.sceneTarget); r.clear(); r.render(scene, camera);
    u.tScene.value = this.sceneTarget.texture; u.tPrev.value = this.ping.texture;
    r.setRenderTarget(this.pong); r.render(this.quad, this.camera);
    const d = this.display;
    d.tInput.value = this.pong.texture; d.time.value = time; d.beatPhase.value = beatPhase; d.formKind.value = u.formKind.value;
    d.formDensity.value = u.formDensity.value; d.formDrift.value = u.formDrift.value; d.formContrast.value = u.formContrast.value;
    r.setRenderTarget(previousTarget); r.render(this.blit, this.camera);
    [this.ping, this.pong] = [this.pong, this.ping];
  }
  dispose() {
    for (const t of [this.sceneTarget, this.ping, this.pong]) t.dispose();
    this.material.dispose(); this.copyMaterial.dispose();
    for (const s of [this.quad, this.blit]) s.traverse(o => o.geometry?.dispose());
  }
}
