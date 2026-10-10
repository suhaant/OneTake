// 3D viewer for TRIBE v2 predictions on the fsaverage5 cortical surface.
//
//   import { createBrainViewer } from './brain_viewer.js';
//   const viewer = createBrainViewer(element, mesh);   // mesh = parsed fsaverage5_mesh.json
//   viewer.setBrain(result.brain);                     // "brain" object from the neuro API
//
// Accuracy: value i from the API colours vertex i of the mesh, with no smoothing or resampling.
// Both use fsaverage5 order (10,242 left-hemisphere vertices, then 10,242 right). The display
// threshold only hides weak values; it never changes them.

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

const WARM = [[0.86, 0.10, 0.05], [1.0, 0.93, 0.22]];   // weak -> strong, above baseline (sRGB)
const COOL = [[0.08, 0.22, 0.85], [0.30, 0.90, 1.0]];   // weak -> strong, below baseline (sRGB)
const toLinear = (c) => Math.pow(c, 2.2);                // three.js expects linear vertex colours
const VIEWS = {                                           // camera direction in brain axes (x right, y front, z up)
  left: [-1, 0, 0], right: [1, 0, 0], top: [0, 0, 1], front: [0, 1, 0], back: [0, -1, 0],
};

function bytes(b64) {
  const s = atob(b64), out = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
  return out;
}

function percentileAbs(values, p) {
  const step = Math.max(1, Math.floor(values.length / 20000));  // subsample long time courses
  const a = [];
  for (let i = 0; i < values.length; i += step) a.push(Math.abs(values[i]));
  a.sort((x, y) => x - y);
  return a[Math.min(a.length - 1, Math.floor(p * a.length))] || 1e-6;
}

export function createBrainViewer(container, mesh, options = {}) {
  // theme: 'dark' | 'light' (cortex shade and tooltip). legend: false hides the built-in colour bar;
  // onScale(vmax) then reports the scale so the host page can draw its own.
  const opts = { threshold: 0.25, autoRotate: false, background: null, onHover: null, theme: 'dark', legend: true, onScale: null, ...options };
  const light = opts.theme === 'light';
  const n = mesh.n_vertices;
  const pial = new Float32Array(bytes(mesh.pial_f32).buffer);
  const inflated = new Float32Array(bytes(mesh.inflated_f32).buffer);
  const faces = new Uint16Array(bytes(mesh.faces_u16).buffer);
  const sulc = new Int8Array(bytes(mesh.sulc_i8).buffer);
  const regionIndex = bytes(mesh.region_index_u8);

  // ---- scene ----
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  container.style.position = container.style.position || 'relative';
  container.appendChild(renderer.domElement);
  const scene = new THREE.Scene();
  if (opts.background) scene.background = new THREE.Color(opts.background);
  const camera = new THREE.PerspectiveCamera(32, 1, 1, 2000);
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enablePan = false;
  controls.enableDamping = true;
  controls.autoRotate = opts.autoRotate;
  controls.autoRotateSpeed = 1.2;
  scene.add(new THREE.HemisphereLight(0xffffff, light ? 0x8fa3b5 : 0x3a3f4a, light ? 1.9 : 1.6));
  const headlight = new THREE.DirectionalLight(0xffffff, 1.9);
  camera.add(headlight);
  scene.add(camera);

  const geometry = new THREE.BufferGeometry();
  const positions = new Float32Array(pial);
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(new Float32Array(n * 3), 3));
  geometry.setIndex(new THREE.BufferAttribute(faces, 1));
  geometry.computeVertexNormals();
  const material = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.72, metalness: 0.0 });
  const brain = new THREE.Mesh(geometry, material);
  // brain axes are z-up; three.js is y-up. A pure rotation, so left stays left.
  brain.rotation.x = -Math.PI / 2;
  scene.add(brain);

  // ---- state ----
  let mean = null, frames = null, frameScale = 1, nFrames = 0, frameT = [], frameSeconds = 1;
  let current = new Float32Array(n), frame = null, vmax = 1, threshold = opts.threshold;
  let surface = 'pial', morph = null, playing = null, disposed = false;

  function paint() {
    const col = geometry.attributes.color.array;
    for (let i = 0; i < n; i++) {
      const base = light ? 0.80 : 0.56;
      const shade = base - (light ? 0.17 : 0.20) * (sulc[i] / 127);   // sulci darker than gyri
      let r = shade, g = shade, b = shade * 1.03;
      const v = current[i], a = Math.abs(v) / vmax;
      if (a > threshold) {
        const t = Math.min(1, (a - threshold) / Math.max(1e-6, 1 - threshold));
        const ramp = v > 0 ? WARM : COOL;
        const mix = 0.80 + 0.20 * t;
        const cr = ramp[0][0] + (ramp[1][0] - ramp[0][0]) * t;
        const cg = ramp[0][1] + (ramp[1][1] - ramp[0][1]) * t;
        const cb = ramp[0][2] + (ramp[1][2] - ramp[0][2]) * t;
        const k = 0.80 + 0.20 * (shade / base);              // keep a hint of the folds under the colour
        r = r + (cr * k - r) * mix; g = g + (cg * k - g) * mix; b = b + (cb * k - b) * mix;
      }
      col[3 * i] = toLinear(r); col[3 * i + 1] = toLinear(g); col[3 * i + 2] = toLinear(b);
    }
    geometry.attributes.color.needsUpdate = true;
    drawLegend();
  }

  function show(index) {
    frame = index;
    if (index === null || !frames) current.set(mean || current);
    else for (let i = 0, o = index * n; i < n; i++) current[i] = frames[o + i] / 127 * frameScale;
    paint();
  }

  // ---- legend ----
  const legend = document.createElement('div');
  legend.style.cssText = 'position:absolute;left:12px;bottom:10px;font:11px/1.3 system-ui,sans-serif;color:inherit;opacity:.9;pointer-events:none';
  if (opts.legend) container.appendChild(legend);
  function drawLegend() {
    opts.onScale && opts.onScale(vmax);
    if (!opts.legend) return;
    const stop = (c) => `rgb(${c.map((x) => Math.round(x * 255)).join(',')})`;
    const th = Math.round(threshold * 50);
    legend.innerHTML =
      `<div style="width:190px;height:9px;border-radius:5px;background:linear-gradient(90deg,${stop(COOL[1])},${stop(COOL[0])} ${50 - th}%,#8a8d93 ${50 - th}%,#8a8d93 ${50 + th}%,${stop(WARM[0])} ${50 + th}%,${stop(WARM[1])})"></div>` +
      `<div style="display:flex;justify-content:space-between;width:190px"><span>−${vmax.toFixed(2)}</span><span>0</span><span>+${vmax.toFixed(2)}</span></div>` +
      `<div style="opacity:.75">predicted fMRI response (model units)</div>`;
  }

  // ---- hover: region name and exact value under the pointer ----
  const tip = document.createElement('div');
  tip.style.cssText = `position:absolute;display:none;padding:4px 8px;border-radius:6px;background:${light ? 'rgba(255,255,255,.94)' : 'rgba(15,17,22,.88)'};color:${light ? '#0B3D5C' : '#fff'};box-shadow:0 2px 10px rgba(0,60,120,.18);font:12px system-ui,sans-serif;pointer-events:none;white-space:nowrap;z-index:2`;
  container.appendChild(tip);
  const raycaster = new THREE.Raycaster(), pointer = new THREE.Vector2();
  function onMove(e) {
    const rect = renderer.domElement.getBoundingClientRect();
    pointer.set(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1);
    raycaster.setFromCamera(pointer, camera);
    const hit = raycaster.intersectObject(brain)[0];
    if (!hit) { tip.style.display = 'none'; opts.onHover && opts.onHover(null); return; }
    // nearest of the triangle's three vertices to the hit point
    const local = brain.worldToLocal(hit.point.clone());
    let best = hit.face.a, bestD = Infinity;
    for (const v of [hit.face.a, hit.face.b, hit.face.c]) {
      const d = (positions[3 * v] - local.x) ** 2 + (positions[3 * v + 1] - local.y) ** 2 + (positions[3 * v + 2] - local.z) ** 2;
      if (d < bestD) { bestD = d; best = v; }
    }
    const info = {
      vertex: best, hemisphere: best < mesh.vertices_per_hemisphere ? 'left' : 'right',
      region: mesh.region_names[regionIndex[best]] || '', value: current[best],
    };
    tip.textContent = `${info.region || 'unlabelled'} · ${info.hemisphere} · ${info.value >= 0 ? '+' : ''}${info.value.toFixed(3)}`;
    tip.style.left = `${e.clientX - rect.left + 14}px`;
    tip.style.top = `${e.clientY - rect.top + 10}px`;
    tip.style.display = 'block';
    opts.onHover && opts.onHover(info);
  }
  renderer.domElement.addEventListener('pointermove', onMove);
  renderer.domElement.addEventListener('pointerleave', () => { tip.style.display = 'none'; });

  // ---- camera ----
  // In a tall, narrow container the brain is wider than the view, so the camera backs away.
  const narrow = () => Math.max(1, 1.3 / camera.aspect);
  let fitted = 1;
  function setView(name, distance = 430) {
    const d = VIEWS[name] || VIEWS.left;
    fitted = narrow();
    distance *= fitted;
    // brain (x, y, z) -> three (x, z, -y) under the mesh rotation above
    camera.position.set(d[0] * distance, d[2] * distance, -d[1] * distance);
    camera.up.set(0, 1, 0);
    if (name === 'top') camera.up.set(0, 0, -1);            // front of the brain at the top of the screen
    controls.target.set(0, 0, 0);
    controls.update();
  }
  function centre() {
    geometry.computeBoundingBox();
    const c = geometry.boundingBox.getCenter(new THREE.Vector3());
    brain.position.set(-c.x, -c.z, c.y);                     // rotated centre moved to the origin
  }
  function resize() {
    const w = container.clientWidth || 600, h = container.clientHeight || 420;
    renderer.setSize(w, h, false);
    // out of flow, so the canvas never props its container open and blocks it from shrinking
    renderer.domElement.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;display:block';
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    const fit = narrow();
    camera.position.multiplyScalar(fit / fitted);   // keeps the user's rotation, changes only the distance
    fitted = fit;
  }
  const observer = new ResizeObserver(resize);
  observer.observe(container);

  function tick(now) {
    if (disposed) return;
    if (morph) {
      const t = Math.min(1, (now - morph.start) / 700), e = t * t * (3 - 2 * t);
      for (let i = 0; i < positions.length; i++) positions[i] = morph.from[i] + (morph.to[i] - morph.from[i]) * e;
      geometry.attributes.position.needsUpdate = true;
      geometry.computeVertexNormals();
      centre();
      if (t === 1) { geometry.computeBoundingSphere(); morph = null; }
    }
    controls.update();
    renderer.render(scene, camera);
    requestAnimationFrame(tick);
  }

  centre(); resize(); setView('left'); paint();
  requestAnimationFrame(tick);

  return {
    /** brain = the "brain" object returned by the API. Shows the clip average until a frame is chosen. */
    setBrain(data) {
      if (data.n_vertices !== n) throw new Error(`Brain data has ${data.n_vertices} vertices, mesh has ${n}`);
      mean = Float32Array.from(data.mean);
      frames = data.frames_int8_b64 ? new Int8Array(bytes(data.frames_int8_b64).buffer) : null;
      frameScale = data.frame_scale || 1;
      nFrames = frames ? frames.length / n : 0;
      frameT = data.frame_t || [];
      frameSeconds = data.frame_seconds || 1;
      vmax = percentileAbs(mean, 0.99);
      show(null);
      return { frames: nFrames, frameT, frameSeconds, vmax };
    },
    /** index = a frame number, or null for the clip average. The colour scale stays fixed per mode. */
    setFrame(index) {
      if (index !== null && frames && frame === null) vmax = percentileAbs(frames, 0.99) / 127 * frameScale;
      if (index === null && mean) vmax = percentileAbs(mean, 0.99);
      show(index);
    },
    play(onFrame, fps = 4) {
      if (!frames || playing) return;
      let i = frame === null ? 0 : frame;
      this.setFrame(i);
      playing = setInterval(() => { i = (i + 1) % nFrames; show(i); onFrame && onFrame(i); }, 1000 / fps);
    },
    pause() { clearInterval(playing); playing = null; },
    get playing() { return playing !== null; },
    setThreshold(t) { threshold = Math.max(0, Math.min(0.95, t)); paint(); },
    setSurface(name) {
      if (name === surface) return;
      surface = name;
      morph = { from: Float32Array.from(positions), to: name === 'inflated' ? inflated : pial, start: performance.now() };
    },
    setView,
    setAutoRotate(on) { controls.autoRotate = on; },
    /** exact value and region at a vertex, for tests */
    valueAt(i) { return { value: current[i], region: mesh.region_names[regionIndex[i]] }; },
    screenshot() { renderer.render(scene, camera); return renderer.domElement.toDataURL('image/png'); },
    dispose() {
      disposed = true; this.pause(); observer.disconnect();
      geometry.dispose(); material.dispose(); renderer.dispose();
      container.removeChild(renderer.domElement); legend.remove(); tip.remove();
    },
  };
}
