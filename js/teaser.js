// The HARNAS mark in steel: five plates drift in and fit together once, then the fitted mark
// breathes while two blue rim lights sweep round it, on a field of brushed steel.
import * as THREE from '../vendor/three.module.min.js';
import { GLTFLoader } from '../vendor/GLTFLoader.js';

const v3 = (x, y, z) => new THREE.Vector3(x, y, z);
const TAU = Math.PI * 2;
const UP = v3(0, 1, 0);
const FIT_MS = 2400;
const LIGHT_DEG = 18;
const NIGHT = [7 / 255, 8 / 255, 11 / 255];

// where each plate starts (off to the right at about its own height, so it never crosses the
// words on the left or the links at the foot),
// and its share of the fitting time
const APART = {
  l: { d: v3(1.7, 0.45, -0.3), r: [0.25, 0.6, 0.3], w: [0.0, 0.55] },
  r: { d: v3(2.4, 0.2, 0.1), r: [-0.15, -0.5, -0.2], w: [0.05, 0.6] },
  b1: { d: v3(2.3, 0.1, 0.6), r: [0.6, 0.35, -0.3], w: [0.42, 0.78] },
  b2: { d: v3(2.6, 0.15, 0.9), r: [-0.5, -0.3, 0.25], w: [0.52, 0.88] },
  b3: { d: v3(2.2, 0.2, 0.4), r: [0.55, 0.25, 0.4], w: [0.62, 1.0] },
};

// light positions from the Blender studio (Z up, camera at -Y) in three's frame (Y up, camera at +Z)
const fromBlender = (x, y, z) => v3(x, z, -y);
const LIGHTS = [
  { at: fromBlender(-4.5, -5.5, 4), c: 0xf2f4f8, i: 0.5, rim: false },
  { at: fromBlender(5.5, -6, -1), c: 0xc9d2e2, i: 0.2, rim: false },
  { at: fromBlender(0.35, -10, -0.35), c: 0xffffff, i: 0.1, rim: false },
  { at: fromBlender(0.8, -3.5, 4.8), c: 0xffffff, i: 0.3, rim: false },
  { at: fromBlender(4, 6, 1), c: 0x2b50e0, i: 9.0, rim: true },
  { at: fromBlender(-4, 5.5, -1.5), c: 0x6f8bff, i: 5.0, rim: true },
];

const clamp01 = (x) => Math.min(1, Math.max(0, x));
const smooth = (x) => x * x * (3 - 2 * x);
const outCubic = (x) => 1 - Math.pow(1 - x, 3);

// a dark studio for the reflections
function studio(renderer) {
  const room = new THREE.Scene();
  const panel = (w, h, color, strength, pos) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(strength), side: THREE.DoubleSide }));
    m.position.copy(pos); m.lookAt(0, 0, 0); room.add(m);
  };
  room.add(new THREE.Mesh(new THREE.BoxGeometry(30, 30, 30), new THREE.MeshBasicMaterial({ color: new THREE.Color().setRGB(0.03, 0.033, 0.04, THREE.LinearSRGBColorSpace), side: THREE.BackSide })));
  panel(9, 2.2, 0xffffff, 2.2, v3(-4, 7, 6));
  panel(1.2, 10, 0xffffff, 1.6, v3(7, 0, 5));
  panel(6, 1, 0xdfe5ef, 1.0, v3(0, -6, 7));
  panel(12, 3, 0x9aa3b3, 0.7, v3(-2, 5.5, 11));
  panel(8, 3, 0x9aa3b3, 0.25, v3(3, 1.5, 12));
  panel(2.5, 9, 0x2b50e0, 3.0, v3(6, 1, -7));
  panel(2.5, 9, 0x6f8bff, 1.6, v3(-7, -1, -6));
  const pm = new THREE.PMREMGenerator(renderer);
  const env = pm.fromScene(room, 0.035).texture;
  pm.dispose();
  room.traverse((n) => { n.geometry?.dispose(); n.material?.dispose(); });
  return env;
}

// the brushing, computed once as a small repeating tile of value noise stretched along x
function grain() {
  const TW = 32, TH = 512;
  const layer = (gx, gy, oct) => {
    const out = new Float32Array(TW * TH);
    let amp = 0.5, norm = 0;
    for (let o = 0; o < oct; o++, gx *= 2, gy *= 2, amp *= 0.5) {
      const g = new Float32Array(gx * gy).map(() => Math.random());
      for (let y = 0; y < TH; y++) {
        const fy = (y / TH) * gy, y0 = Math.floor(fy), ty = fy - y0, sy = ty * ty * (3 - 2 * ty);
        const r0 = (y0 % gy) * gx, r1 = ((y0 + 1) % gy) * gx;
        for (let x = 0; x < TW; x++) {
          const fx = (x / TW) * gx, x0 = Math.floor(fx), tx = fx - x0, sx = tx * tx * (3 - 2 * tx);
          const c0 = x0 % gx, c1 = (x0 + 1) % gx;
          const a = g[r0 + c0] + (g[r0 + c1] - g[r0 + c0]) * sx;
          const b = g[r1 + c0] + (g[r1 + c1] - g[r1 + c0]) * sx;
          out[y * TW + x] += amp * (a + (b - a) * sy);
        }
      }
      norm += amp;
    }
    for (let k = 0; k < out.length; k++) out[k] /= norm;
    return out;
  };
  const fine = layer(4, 192, 3), coarse = layer(2, 24, 2);
  const data = new Uint8Array(TW * TH * 4);
  for (let k = 0; k < TW * TH; k++) { data[k * 4] = fine[k] * 255; data[k * 4 + 1] = coarse[k] * 255; data[k * 4 + 3] = 255; }
  const tex = new THREE.DataTexture(data, TW, TH);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.magFilter = tex.minFilter = THREE.LinearFilter;
  tex.needsUpdate = true;
  return tex;
}

const VS = 'varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }';
const FS = `
precision highp float;
varying vec2 vUv;
uniform vec2 uRes; uniform vec3 uBase; uniform vec2 uLight; uniform vec2 uDir;
uniform vec3 uSteel; uniform vec3 uBlue; uniform sampler2D uGrain;
void main() {
  vec2 p = (vUv - 0.5) * vec2(uRes.x / uRes.y, 1.0);
  vec2 gr = texture2D(uGrain, p).rg;
  float g = mix(gr.r, gr.g, 0.35) - 0.5;
  float x = dot(p - uLight, uDir);
  float band = exp(-x * x * 3.5);
  float core = exp(-x * x * 70.0);
  vec3 col = uBase * (1.0 + 0.05 * g);
  col += uSteel * (0.032 * band * (1.0 + 1.6 * g) + 0.010 * g);
  col += uBlue * core * (0.045 + 0.05 * g);
  gl_FragColor = vec4(col, 1.0);
}`;
const BLIT = 'precision highp float; varying vec2 vUv; uniform sampler2D uTex; void main() { gl_FragColor = texture2D(uTex, vUv); }';

function field(renderer) {
  const quad = new THREE.PlaneGeometry(2, 2);
  const cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const a = (LIGHT_DEG * Math.PI) / 180;
  const u = {
    uRes: { value: new THREE.Vector2(1, 1) }, uBase: { value: new THREE.Vector3(...NIGHT) },
    uLight: { value: new THREE.Vector2(0, 0) }, uDir: { value: new THREE.Vector2(Math.cos(-a), Math.sin(-a)) },
    uSteel: { value: new THREE.Vector3(200 / 255, 206 / 255, 216 / 255) }, uBlue: { value: new THREE.Vector3(111 / 255, 139 / 255, 1) },
    uGrain: { value: new THREE.DataTexture(new Uint8Array([128, 128, 0, 255]), 1, 1) },
  };
  const s1 = new THREE.Scene();
  s1.add(new THREE.Mesh(quad, new THREE.ShaderMaterial({ vertexShader: VS, fragmentShader: FS, uniforms: u, depthTest: false, depthWrite: false })));
  const rt = new THREE.WebGLRenderTarget(2, 2, { depthBuffer: false });
  const s2 = new THREE.Scene();
  s2.add(new THREE.Mesh(quad, new THREE.ShaderMaterial({ vertexShader: VS, fragmentShader: BLIT, uniforms: { uTex: { value: rt.texture } }, depthTest: false, depthWrite: false })));
  return {
    grain() { const old = u.uGrain.value; u.uGrain.value = grain(); old.dispose(); },
    size(w, h, dpr) { rt.setSize(Math.max(2, Math.round((w * dpr) / 2)), Math.max(2, Math.round((h * dpr) / 2))); u.uRes.value.set(w, h); },
    draw(now) {
      const asp = u.uRes.value.x / u.uRes.value.y;
      u.uLight.value.set(Math.sin((now * TAU) / 46000) * 0.42 * asp, 0);
      renderer.setRenderTarget(rt); renderer.render(s1, cam);
      renderer.setRenderTarget(null); renderer.render(s2, cam);
    },
  };
}

// el: the canvas; stage: an empty element the fitted mark is framed in; still: no motion
export function teaser(el, stage, { still = false, strength = () => 1 } = {}) {
  const small = matchMedia('(max-width: 900px), (pointer: coarse)').matches;
  const renderer = new THREE.WebGLRenderer({ canvas: el, antialias: true, alpha: false, powerPreference: 'high-performance' });
  renderer.setClearColor(0x07080b, 1);
  renderer.autoClear = false;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, small ? 1.5 : 2));
  const ground = field(renderer);
  const scene = new THREE.Scene();
  scene.environmentIntensity = 1.1;
  const camera = new THREE.PerspectiveCamera(30, 1, 0.05, 60);
  const lights = LIGHTS.map((L) => { const l = new THREE.DirectionalLight(L.c, L.i); l.position.copy(L.at); scene.add(l); return { l, ...L }; });
  const rims = lights.filter((x) => x.rim);
  const brushed = new THREE.MeshPhysicalMaterial({ color: 0x8f949c, metalness: 0.9, roughness: 0.3, clearcoat: 0.12, clearcoatRoughness: 0.32, side: THREE.DoubleSide, transparent: true });
  const polished = new THREE.MeshPhysicalMaterial({ color: 0xb4bac4, metalness: 1.0, roughness: 0.16, clearcoat: 0.2, clearcoatRoughness: 0.1, side: THREE.DoubleSide, transparent: true });
  const mark = new THREE.Group();
  scene.add(mark);
  const parts = [];
  const fit = { size: v3(1.6, 2.1, 0.3), centre: v3(0, -0.05, 0) };
  let ready = false, fitMs = 0, last = 0, seen = false, W = 0, H = 0, raf = 0;
  // the fitting runs on its own clock: it only advances while the stage is on screen, and never by
  // more than two frames at once, so a slow first frame (a phone compiling shaders) cannot skip it
  new IntersectionObserver((es) => { seen = es[0].intersectionRatio >= 0.35; }, { threshold: [0, 0.35, 0.6] }).observe(stage);

  function resize() {
    const w = el.clientWidth, h = el.clientHeight;
    if (!w || !h || (w === W && h === H)) return false;
    W = w; H = h;
    renderer.setSize(w, h, false);
    ground.size(w, h, renderer.getPixelRatio());
    camera.aspect = w / h; camera.fov = w / h < 0.85 ? 34 : 30; camera.updateProjectionMatrix();
    return true;
  }

  // frame the fitted mark inside the stage element, straight on
  function frame() {
    const r = stage.getBoundingClientRect();
    if (r.width < 8 || r.height < 8) return;
    const tanH = Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2);
    const ppu = Math.min(r.height / (fit.size.y * 1.06), r.width / (fit.size.x * 1.06));
    const d = H / (2 * tanH * ppu) + fit.size.z / 2;
    camera.position.set(fit.centre.x, fit.centre.y, d);
    camera.lookAt(fit.centre);
    camera.setViewOffset(W, H, -((r.left + r.width / 2) / W - 0.5) * W, -((r.top + r.height / 2) / H - 0.5) * H, W, H);
  }

  function pose(now) {
    if (!still && last && seen) fitMs += Math.min(34, now - last);
    last = now;
    const a = still ? 1 : outCubic(clamp01(fitMs / FIT_MS));
    const loose = still ? 0 : 1 - clamp01(fitMs / FIT_MS);
    for (const p of parts) {
      const k = smooth(clamp01((a - p.w[0]) / (p.w[1] - p.w[0])));
      p.n.position.lerpVectors(p.pos1, p.pos0, k);
      p.n.quaternion.slerpQuaternions(p.q1, p.q0, k);
      if (loose > 0) {
        const s = p.pos0.x * 3 + p.pos0.y * 5;
        p.n.position.y += Math.sin(now * 0.0011 + s) * 0.03 * loose;
      }
    }
    const t = still ? 0 : now;
    mark.rotation.x = Math.sin((t * TAU) / 6000) * 0.035;
    mark.rotation.y = Math.sin((t * TAU) / 11000) * 0.07;
    const sweep = Math.sin((t * TAU) / 8000) * 0.55;
    for (const r of rims) r.l.position.copy(r.at).applyAxisAngle(UP, sweep);
    const op = strength();
    brushed.opacity = polished.opacity = op;
  }

  function draw(now) {
    resize();
    renderer.clear();
    ground.draw(still ? 12000 : now);
    if (ready) { frame(); pose(now); renderer.clearDepth(); renderer.render(scene, camera); }
  }
  // one clock for everything: performance.now(), never the rAF timestamp, which an embedded or
  // throttled view can hand out stale and so keep the fitting at its first frame
  function tick() { raf = requestAnimationFrame(tick); draw(performance.now()); }
  function start() { if (!raf && !still) raf = requestAnimationFrame(tick); }
  function stop() { cancelAnimationFrame(raf); raf = 0; }

  const idle = (fn) => (window.requestIdleCallback ? requestIdleCallback(fn, { timeout: 1200 }) : setTimeout(fn, 60));
  // the heavy steps each get an idle moment of their own: the grain, the studio, the model
  idle(() => { ground.grain(); if (still) draw(0); idle(() => {
    scene.environment = studio(renderer);
    idle(() => new GLTFLoader().load('models/harnas.glb', (gltf) => {
      gltf.scene.updateMatrixWorld(true);
      const found = [];
      gltf.scene.traverse((n) => { if (APART[n.name]) found.push(n); });
      for (const n of found) {
        mark.attach(n);
        n.traverse((m) => { if (m.isMesh) m.material = /polish/i.test(m.material?.name || '') ? polished : brushed; });
        const p = APART[n.name];
        parts.push({
          n, w: p.w, pos0: n.position.clone(), q0: n.quaternion.clone(),
          pos1: n.position.clone().add(p.d),
          q1: n.quaternion.clone().premultiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(...p.r))),
        });
      }
      mark.updateMatrixWorld(true);
      const box = new THREE.Box3().setFromObject(mark);
      box.getSize(fit.size); box.getCenter(fit.centre);
      const go = () => { ready = true; last = 0; draw(performance.now()); };
      (renderer.compileAsync ? renderer.compileAsync(scene, camera) : Promise.resolve()).then(go, go);
    }));
  }); });

  document.addEventListener('visibilitychange', () => (document.hidden ? stop() : start()));
  addEventListener('resize', () => { W = 0; if (still) draw(0); }, { passive: true });
  if (still) { draw(0); } else start();
  return { stop };
}
