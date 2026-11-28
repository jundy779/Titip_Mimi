// Kamar Mimi 3D · gaya anime cel-shaded (toon + outline + rim light + bloom).
// Kontrak sama dengan versi lama: makeScene(canvas) -> {render(t, s), world(event, z)}.
// Satuan ruang: x kanan, y atas (lantai ~0.1, kepala Mimi ~1.45), z ke arah pemain.
// Semua model dan tekstur dibuat prosedural di sini; tidak ada aset game lain yang dipakai.
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

const C = {
  cream: 0xfff3e8, chest: 0xfffbf6, inner: 0xf5b2b6, pad: 0xf29fb0, nose: 0xe88a99,
  bow: 0xee6d8b, bowDark: 0xcf4c6c, outline: 0x6a3a4e, whisker: 0xa27f78,
  bowl: 0xd77f97, milk: 0xfbe9d7, fish: 0xeeb064, yarn: 0xc78ab0,
};

function canvasTexture(size, draw, srgb = true) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  draw(c.getContext('2d'), size);
  const tex = new THREE.CanvasTexture(c);
  if (srgb) tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

function heartPath(g, x, y, s) {
  g.beginPath();
  g.moveTo(x, y + s * .9);
  g.bezierCurveTo(x - s * 1.15, y + s * .15, x - s * 1.05, y - s * .9, x, y - s * .35);
  g.bezierCurveTo(x + s * 1.05, y - s * .9, x + s * 1.15, y + s * .15, x, y + s * .9);
  g.closePath();
}

export function makeScene(canvas) {
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: false, powerPreference: 'high-performance' });
  } catch (error) {
    console.warn('Kamar Mimi: WebGL2 tidak tersedia', error);
    return null;
  }
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const coarse = matchMedia('(pointer: coarse)').matches;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.NoToneMapping;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  canvas.parentElement?.classList.add('has-3d');

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(32, 1, .1, 60);
  const lookTarget = new THREE.Vector3(0, 1.15, .2);

  // ---------- Latar lukisan teras (sedikit diburamkan untuk kesan kedalaman) ----------
  const backdrop = new Image();
  let bgTex = null, bgAspect = 1672 / 941;
  backdrop.onload = () => {
    bgAspect = backdrop.naturalWidth / backdrop.naturalHeight;
    const c = document.createElement('canvas');
    c.width = 1280; c.height = Math.round(1280 / bgAspect);
    const g = c.getContext('2d');
    g.filter = 'blur(1.6px) saturate(1.08)';
    g.drawImage(backdrop, -4, -4, c.width + 8, c.height + 8);
    bgTex = new THREE.CanvasTexture(c);
    bgTex.colorSpace = THREE.SRGBColorSpace;
    scene.background = bgTex;
    lastSize = '';
  };
  backdrop.src = 'mimi-terrace.webp';
  scene.background = new THREE.Color(0xf3d6c8);

  // ---------- Cahaya: matahari hangat dari kiri atas, isi langit merah muda ----------
  const sun = new THREE.DirectionalLight(0xfff3e4, 2.05);
  sun.position.set(-3.2, 6.5, 4.5);
  sun.castShadow = true;
  sun.shadow.mapSize.set(coarse ? 1024 : 2048, coarse ? 1024 : 2048);
  Object.assign(sun.shadow.camera, { left: -3, right: 3, top: 4, bottom: -1.5, near: 1, far: 16 });
  sun.shadow.radius = 5;
  sun.shadow.bias = -.0008;
  sun.target.position.set(0, .8, 0);
  scene.add(sun, sun.target);
  scene.add(new THREE.HemisphereLight(0xfff6fa, 0xe3a9bb, 1.12));

  const floor = new THREE.Mesh(new THREE.PlaneGeometry(14, 10), new THREE.ShadowMaterial({ color: 0x7c3d5b, opacity: .26 }));
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = .1;
  floor.receiveShadow = true;
  scene.add(floor);

  // ---------- Material toon dengan rim light dan outline inverted hull ----------
  const grad = new THREE.DataTexture(new Uint8Array([150, 215, 255]), 3, 1, THREE.RedFormat);
  grad.minFilter = grad.magFilter = THREE.NearestFilter;
  grad.needsUpdate = true;

  function toon(color, { rim = .55, ...opts } = {}) {
    const m = new THREE.MeshToonMaterial({ color, gradientMap: grad, ...opts });
    m.onBeforeCompile = sh => {
      sh.uniforms.rimStrength = { value: rim };
      sh.fragmentShader = sh.fragmentShader
        .replace('#include <common>', '#include <common>\nuniform float rimStrength;')
        .replace('#include <dithering_fragment>', `#include <dithering_fragment>
          {
            vec3 nv = normalize(normal);
            float f = 1.0 - abs(dot(nv, normalize(vViewPosition)));
            float side = 0.35 + 0.65 * smoothstep(-0.3, 0.5, -nv.x + nv.y * 0.4);
            gl_FragColor.rgb += vec3(1.0, 0.95, 0.9) * smoothstep(0.6, 0.7, f) * rimStrength * side;
          }`);
    };
    return m;
  }
  const outlineCache = new Map();
  function outlineMat(width) {
    if (outlineCache.has(width)) return outlineCache.get(width);
    const m = new THREE.MeshBasicMaterial({ color: C.outline, side: THREE.BackSide });
    m.onBeforeCompile = sh => {
      sh.uniforms.ow = { value: width };
      sh.vertexShader = sh.vertexShader
        .replace('#include <common>', '#include <common>\nuniform float ow;')
        .replace('#include <begin_vertex>', 'vec3 transformed = position + normal * ow;');
    };
    outlineCache.set(width, m);
    return m;
  }
  const noRay = () => {};
  function part(geo, material, { outline = .016, cast = true } = {}) {
    const mesh = new THREE.Mesh(geo, material);
    mesh.castShadow = cast;
    if (outline) {
      const o = new THREE.Mesh(geo, outlineMat(outline));
      o.raycast = noRay;
      mesh.add(o);
    }
    return mesh;
  }
  const ellipsoid = (a, b, c, ws = 40, hs = 28) => new THREE.SphereGeometry(1, ws, hs).scale(a, b, c);

  const mat = {
    cream: toon(C.cream), chest: toon(C.chest, { rim: .4 }), inner: toon(C.inner, { rim: .2 }),
    pad: toon(C.pad, { rim: .2 }), nose: toon(C.nose, { rim: .3 }),
  };

  // ---------- Mimi ----------
  const cat = new THREE.Group();
  scene.add(cat);
  const bodyPivot = new THREE.Group();
  cat.add(bodyPivot);
  const body = part(ellipsoid(.52, .64, .48), mat.cream, { outline: .018 });
  const chest = part(ellipsoid(.36, .38, .2), mat.chest, { outline: .012 });
  chest.position.set(0, .12, .33);
  body.add(chest);
  bodyPivot.add(body);
  const haunch = [], feet = [], legs = [], paws = [];
  for (const side of [-1, 1]) {
    const h = part(ellipsoid(.25, .32, .26), mat.cream);
    h.position.set(side * .37, .34, -.09);
    bodyPivot.add(h); haunch.push(h);
    const f = part(ellipsoid(.21, .13, .26), mat.cream);
    f.position.set(side * .39, .14, .18);
    const toes = part(ellipsoid(.12, .05, .06), mat.pad, { outline: 0, cast: false });
    toes.position.set(0, -.07, .2);
    f.add(toes);
    bodyPivot.add(f); feet.push(f);
    const leg = part(new THREE.CapsuleGeometry(.135, .5, 6, 18), mat.cream);
    bodyPivot.add(leg); legs.push(leg);
    const paw = part(ellipsoid(.155, .14, .17), mat.cream);
    const bean = part(ellipsoid(.075, .062, .03), mat.pad, { outline: 0, cast: false });
    bean.position.set(0, -.02, .155);
    paw.add(bean);
    for (let j = -1; j <= 1; j++) {
      const toe = part(ellipsoid(.034, .03, .016), mat.pad, { outline: 0, cast: false });
      toe.position.set(j * .055, .065, .145);
      paw.add(toe);
    }
    bodyPivot.add(paw); paws.push(paw);
  }

  // Ekor: tabung meruncing dengan ujung mengembang, dibangun ulang tiap frame di buffer yang sama.
  const TS = 28, TR = 12;
  const tailGeo = new THREE.BufferGeometry();
  tailGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array((TS + 1) * (TR + 1) * 3), 3));
  tailGeo.setAttribute('normal', new THREE.BufferAttribute(new Float32Array((TS + 1) * (TR + 1) * 3), 3));
  {
    const idx = [];
    for (let i = 0; i < TS; i++) for (let j = 0; j < TR; j++) {
      const a = i * (TR + 1) + j, b = a + TR + 1;
      idx.push(a, a + 1, b, b, a + 1, b + 1);
    }
    tailGeo.setIndex(idx);
  }
  const tail = part(tailGeo, mat.cream, { outline: .015 });
  tail.frustumCulled = false;
  tail.children[0].frustumCulled = false;
  bodyPivot.add(tail);
  const tailCurve = new THREE.CatmullRomCurve3(Array.from({ length: 9 }, () => new THREE.Vector3()));
  function updateTail(phase, gait) {
    for (let i = 0; i < 9; i++) {
      const f = i / 8, swing = Math.sin(phase - f * 1.6) * (1 + gait * .4);
      tailCurve.points[i].set(-.36 - .46 * Math.sin(f * 1.8) + .13 * f * swing, .3 + .78 * f, -.28 + .18 * f * swing - .05 * f);
    }
    const frames = tailCurve.computeFrenetFrames(TS, false);
    const pos = tailGeo.attributes.position.array, nor = tailGeo.attributes.normal.array;
    const p = new THREE.Vector3(), n = new THREE.Vector3();
    for (let i = 0; i <= TS; i++) {
      const f = i / TS;
      tailCurve.getPointAt(f, p);
      let r = .15 - .055 * f + .05 * Math.exp(-(((f - .88) / .09) ** 2));
      r *= Math.sqrt(Math.max(0, 1 - f ** 10));
      for (let j = 0; j <= TR; j++) {
        const a = j / TR * Math.PI * 2;
        n.copy(frames.normals[i]).multiplyScalar(Math.cos(a)).addScaledVector(frames.binormals[i], Math.sin(a));
        const k = (i * (TR + 1) + j) * 3;
        pos[k] = p.x + n.x * r; pos[k + 1] = p.y + n.y * r; pos[k + 2] = p.z + n.z * r;
        nor[k] = n.x; nor[k + 1] = n.y; nor[k + 2] = n.z;
      }
    }
    tailGeo.attributes.position.needsUpdate = true;
    tailGeo.attributes.normal.needsUpdate = true;
    tailGeo.computeBoundingSphere();
  }

  // Kepala
  const head = new THREE.Group();
  cat.add(head);
  const skull = part(ellipsoid(.8, .68, .56, 56, 40), mat.cream, { outline: .02 });
  head.add(skull);
  for (const side of [-1, 1]) {
    const cheek = part(ellipsoid(.26, .2, .24), mat.cream, { outline: .016 });
    cheek.position.set(side * .62, -.17, .06);
    cheek.rotation.z = side * .5;
    head.add(cheek);
    for (let j = 0; j < 2; j++) {
      const tuft = part(new THREE.ConeGeometry(.08, .2, 10), mat.cream, { outline: .012 });
      tuft.position.set(side * (.82 - j * .02), -.2 - j * .1, .02);
      tuft.rotation.z = -side * (1.9 + j * .35);
      head.add(tuft);
    }
  }
  const earProfile = Array.from({ length: 12 }, (_, i) => {
    const f = i / 11;
    return new THREE.Vector2(.26 * Math.pow(1 - f, .8) * (1 + .15 * Math.sin(f * Math.PI)), f * .5);
  });
  const ears = [];
  for (const side of [-1, 1]) {
    const pivot = new THREE.Group();
    pivot.position.set(side * .47, .42, -.02);
    pivot.rotation.z = -side * .38;
    const outer = part(new THREE.LatheGeometry(earProfile, 24).scale(1, 1, .55), mat.cream, { outline: .016 });
    const innerEar = part(new THREE.LatheGeometry(earProfile, 20).scale(.66, .78, .3), mat.inner, { outline: 0, cast: false });
    innerEar.position.set(0, .03, .07);
    outer.add(innerEar);
    pivot.add(outer);
    head.add(pivot);
    ears.push(pivot);
  }
  const muzzle = part(ellipsoid(.21, .13, .1), mat.chest, { outline: 0, cast: false });
  muzzle.position.set(0, -.13, .5);
  head.add(muzzle);
  const nose = part(ellipsoid(.055, .038, .035), mat.nose, { outline: .006, cast: false });
  nose.position.set(0, -.065, .565);
  head.add(nose);
  {
    const pts = [];
    for (const side of [-1, 1]) for (let j = 0; j < 3; j++) {
      pts.push(new THREE.Vector3(side * .42, -.1 - j * .045, .45), new THREE.Vector3(side * (.92 + j * .02), -.02 - j * .09, .3));
    }
    const whiskers = new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color: C.whisker, transparent: true, opacity: .8 }));
    head.add(whiskers);
  }

  // Pita stroberi di telinga kanan (sudut pandang pemain).
  const seeds = canvasTexture(128, (g, s) => {
    g.fillStyle = '#ffffff'; g.fillRect(0, 0, s, s);
    g.fillStyle = 'rgba(255,240,200,.95)';
    for (let i = 0; i < 18; i++) {
      const x = (i * 37 % 128), y = (i * 61 % 128);
      g.beginPath(); g.ellipse(x, y, 3, 5, .4, 0, Math.PI * 2); g.fill();
    }
  });
  const bowMat = toon(C.bow, { map: seeds, rim: .4 });
  const bow = new THREE.Group();
  bow.position.set(.5, .53, .26);
  bow.rotation.z = -.25;
  for (const side of [-1, 1]) {
    const lobe = part(ellipsoid(.2, .14, .1), bowMat, { outline: .012 });
    lobe.position.set(side * .16, 0, 0);
    lobe.rotation.z = side * .42;
    bow.add(lobe);
    const ribbon = part(new THREE.BoxGeometry(.07, .2, .03), toon(C.bowDark, { rim: .3 }), { outline: .01 });
    ribbon.position.set(side * .06, -.15, .02);
    ribbon.rotation.z = side * .35;
    bow.add(ribbon);
  }
  const knot = part(ellipsoid(.085, .088, .075), toon(C.bowDark, { rim: .4 }), { outline: .012 });
  knot.position.z = .04;
  const leaf = part(new THREE.ConeGeometry(.06, .12, 5), toon(0x7fbf86, { rim: .3 }), { outline: .008, cast: false });
  leaf.position.set(0, .1, .02);
  bow.add(knot, leaf);
  head.add(bow);

  // Wajah anime digambar di kanvas dan ditempel pada sisi depan kepala.
  const faceCanvas = document.createElement('canvas');
  faceCanvas.width = faceCanvas.height = 768;
  const fg = faceCanvas.getContext('2d');
  const faceTex = new THREE.CanvasTexture(faceCanvas);
  faceTex.colorSpace = THREE.SRGBColorSpace;
  faceTex.anisotropy = 8;
  const faceGeo = new THREE.SphereGeometry(1, 72, 54, Math.PI / 2 - 1.05, 2.1, Math.PI / 2 - .9, 1.75).scale(.803, .683, .563);
  {
    const p = faceGeo.attributes.position, uv = faceGeo.attributes.uv;
    for (let i = 0; i < p.count; i++) uv.setXY(i, p.getX(i) / 1.6 + .5, p.getY(i) / 1.36 + .5);
  }
  const face = new THREE.Mesh(faceGeo, toon(0xffffff, { map: faceTex, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, rim: 0 }));
  face.renderOrder = 2;
  head.add(face);
  const P = (x, y) => [(x / 1.6 + .5) * 768, (.5 - y / 1.36) * 768];
  let faceKey = '';
  function drawEye(side, open, gx, gy, happy) {
    const [cx, cy] = P(side * .3, .03);
    const rx = 58, ry = 80;
    fg.save();
    if (happy || open < .28) {
      fg.strokeStyle = '#4a2438'; fg.lineWidth = 11; fg.lineCap = 'round';
      fg.beginPath();
      if (happy) fg.arc(cx, cy + 26, 46, Math.PI * 1.12, Math.PI * 1.88);
      else { fg.moveTo(cx - 52, cy + 6); fg.quadraticCurveTo(cx, cy + 24, cx + 52, cy + 6); }
      fg.stroke();
      fg.restore();
      return;
    }
    fg.translate(cx, cy);
    fg.scale(1, open);
    fg.beginPath(); fg.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2);
    fg.fillStyle = '#3b1d30'; fg.fill();
    fg.save(); fg.clip();
    const ix = gx * 14, iy = -gy * 10;
    const iris = fg.createLinearGradient(0, -ry, 0, ry);
    iris.addColorStop(0, '#2c1325'); iris.addColorStop(.45, '#7d3f5e'); iris.addColorStop(.85, '#d68aa8'); iris.addColorStop(1, '#f5c0d2');
    fg.fillStyle = iris;
    fg.beginPath(); fg.ellipse(ix, iy + 4, rx - 9, ry - 8, 0, 0, Math.PI * 2); fg.fill();
    fg.fillStyle = 'rgba(40,12,30,.9)';
    fg.beginPath(); fg.ellipse(ix, iy + 2, 22, 40, 0, 0, Math.PI * 2); fg.fill();
    const glow = fg.createRadialGradient(ix, iy + 50, 4, ix, iy + 50, 50);
    glow.addColorStop(0, 'rgba(255,210,230,.75)'); glow.addColorStop(1, 'rgba(255,210,230,0)');
    fg.fillStyle = glow; fg.fillRect(-rx, -ry, rx * 2, ry * 2);
    fg.fillStyle = '#ffffff';
    fg.beginPath(); fg.ellipse(ix - 20, iy - 32, 21, 26, -.4, 0, Math.PI * 2); fg.fill();
    fg.beginPath(); fg.arc(ix + 24, iy + 30, 9, 0, Math.PI * 2); fg.fill();
    fg.globalAlpha = .9;
    fg.beginPath();
    const sx = ix + 22, sy = iy - 18;
    for (let k = 0; k < 8; k++) { const a = k * Math.PI / 4, r = k % 2 ? 3 : 10; fg.lineTo(sx + Math.cos(a) * r, sy + Math.sin(a) * r); }
    fg.fill();
    fg.restore();
    fg.restore();
    // Kelopak atas tebal dengan bulu mata kecil di ujung luar.
    fg.save();
    fg.translate(cx, cy);
    fg.strokeStyle = '#3b1d30'; fg.lineCap = 'round'; fg.lineWidth = 12;
    fg.beginPath(); fg.ellipse(0, (1 - open) * ry * .9, rx + 4, ry * open + 3, 0, Math.PI * 1.08, Math.PI * 1.92); fg.stroke();
    fg.lineWidth = 8;
    fg.beginPath(); fg.moveTo(side * (rx - 4), -ry * open * .55); fg.lineTo(side * (rx + 22), -ry * open * .78 - 6); fg.stroke();
    fg.restore();
  }
  function drawFace(open, gx, gy, happy, mouthOpen) {
    const key = [Math.round(open * 8), Math.round(gx * 6), Math.round(gy * 6), happy, mouthOpen].join();
    if (key === faceKey) return;
    faceKey = key;
    fg.clearRect(0, 0, 768, 768);
    // Tanda hati merah muda di sekitar mata kiri (sudut pandang pemain).
    const [hx, hy] = P(-.38, .1);
    fg.save(); fg.translate(hx, hy); fg.rotate(-.2);
    heartPath(fg, 0, 0, 118);
    const hg = fg.createRadialGradient(0, 10, 20, 0, 10, 150);
    hg.addColorStop(0, 'rgba(247,170,182,.95)'); hg.addColorStop(.8, 'rgba(244,163,178,.85)'); hg.addColorStop(1, 'rgba(244,163,178,0)');
    fg.fillStyle = hg; fg.fill(); fg.restore();
    for (const side of [-1, 1]) {
      const [bx, by] = P(side * .47, -.15);
      const blush = fg.createRadialGradient(bx, by, 4, bx, by, 64);
      blush.addColorStop(0, 'rgba(242,128,150,.6)'); blush.addColorStop(1, 'rgba(242,128,150,0)');
      fg.fillStyle = blush; fg.beginPath(); fg.ellipse(bx, by, 70, 42, 0, 0, Math.PI * 2); fg.fill();
      fg.strokeStyle = 'rgba(214,90,120,.55)'; fg.lineWidth = 4; fg.lineCap = 'round';
      for (let k = -1; k <= 1; k++) { fg.beginPath(); fg.moveTo(bx + k * 18 - 6, by + 8); fg.lineTo(bx + k * 18 + 6, by - 8); fg.stroke(); }
      drawEye(side, open, gx, gy, happy);
    }
    const [mx, my] = P(0, -.17);
    fg.strokeStyle = '#6a3a4e'; fg.lineWidth = 6; fg.lineCap = 'round'; fg.lineJoin = 'round';
    if (mouthOpen) {
      fg.fillStyle = '#b9475f';
      fg.beginPath(); fg.moveTo(mx - 24, my); fg.quadraticCurveTo(mx, my + 44, mx + 24, my); fg.closePath(); fg.fill(); fg.stroke();
      fg.fillStyle = '#f39aaa'; fg.beginPath(); fg.ellipse(mx, my + 20, 12, 9, 0, 0, Math.PI * 2); fg.fill();
    } else {
      fg.beginPath(); fg.moveTo(mx - 26, my - 4); fg.quadraticCurveTo(mx - 13, my + 14, mx, my); fg.quadraticCurveTo(mx + 13, my + 14, mx + 26, my - 4); fg.stroke();
    }
    faceTex.needsUpdate = true;
  }

  // ---------- Mainan ----------
  const toys = new THREE.Group();
  scene.add(toys);
  const yarnTex = canvasTexture(256, (g, s) => {
    g.fillStyle = '#c98bb2'; g.fillRect(0, 0, s, s);
    g.lineWidth = 5;
    for (let i = 0; i < 46; i++) {
      g.strokeStyle = i % 3 ? 'rgba(255,215,232,.55)' : 'rgba(120,55,95,.35)';
      g.beginPath();
      const y = (i * 23) % s, tilt = (i % 7) * 9 - 27;
      g.moveTo(-10, y); g.bezierCurveTo(s * .3, y + tilt, s * .7, y - tilt, s + 10, y + tilt * .5); g.stroke();
    }
  });
  const yarn = part(new THREE.SphereGeometry(.2, 36, 24), toon(0xffffff, { map: yarnTex, rim: .5 }), { outline: .012 });
  toys.add(yarn);
  const threadMat = toon(0xe2a9c6, { rim: .2 });
  let thread = null;
  function updateThread(x, y, t) {
    const pts = [new THREE.Vector3(x + .12, y - .12, 1.08)];
    for (let i = 1; i <= 6; i++) {
      const f = i / 6;
      pts.push(new THREE.Vector3(x + .12 + f * .55 + Math.sin(t * 2 + i) * .03, Math.max(.115, y - .12 - f * (y - .1) * 1.4), 1.1 + f * .3 + Math.sin(f * 7) * .06));
    }
    thread?.geometry.dispose();
    const geo = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 24, .014, 6, false);
    if (!thread) { thread = new THREE.Mesh(geo, threadMat); thread.castShadow = true; toys.add(thread); }
    else thread.geometry = geo;
  }
  const bowl = new THREE.Group();
  {
    const profile = [[.0, .0], [.34, .0], [.4, .06], [.42, .2], [.38, .22], [.33, .1], [.0, .1]].map(([x, y]) => new THREE.Vector2(x, y));
    const dish = part(new THREE.LatheGeometry(profile, 40), toon(C.bowl, { rim: .45, side: THREE.DoubleSide }), { outline: .012 });
    const milk = part(new THREE.CircleGeometry(.36, 32).rotateX(-Math.PI / 2), toon(C.milk, { rim: 0 }), { outline: 0, cast: false });
    milk.position.y = .14;
    bowl.add(dish, milk);
    for (let i = 0; i < 3; i++) {
      const bite = part(ellipsoid(.09, .045, .05), toon(C.fish, { rim: .3 }), { outline: .008, cast: false });
      bite.position.set(-.12 + i * .12, .17, (i % 2) * .08 - .04);
      bite.rotation.y = i;
      bowl.add(bite);
    }
  }
  bowl.position.set(.82, .1, 1.15);
  bowl.scale.set(.95, .95, .8);
  toys.add(bowl);
  const fish = new THREE.Group();
  {
    const fbody = part(ellipsoid(.17, .09, .08), toon(C.fish, { rim: .45 }), { outline: .01 });
    const ftail = part(new THREE.ConeGeometry(.09, .14, 3).rotateZ(Math.PI / 2), toon(0xdd9858, { rim: .3 }), { outline: .01 });
    ftail.position.x = -.2;
    const feye = new THREE.Mesh(new THREE.SphereGeometry(.018, 10, 8), new THREE.MeshBasicMaterial({ color: 0x3b1d30 }));
    feye.position.set(.1, .025, .07);
    fish.add(fbody, ftail, feye);
  }
  toys.add(fish);
  // Gelembung busa: sprite bergambar (tepi pelangi + kilau), selalu menghadap kamera.
  const bubbleTex = canvasTexture(256, (g, n) => {
    const c = n / 2, r = n * .46;
    const fill = g.createRadialGradient(c, c, r * .2, c, c, r);
    fill.addColorStop(0, 'rgba(230,246,255,.10)'); fill.addColorStop(.72, 'rgba(210,236,255,.22)'); fill.addColorStop(1, 'rgba(200,230,255,.55)');
    g.fillStyle = fill; g.beginPath(); g.arc(c, c, r, 0, Math.PI * 2); g.fill();
    for (let k = 0; k < 36; k++) {
      g.strokeStyle = `hsla(${k * 10 + 180},85%,72%,.75)`; g.lineWidth = 7;
      g.beginPath(); g.arc(c, c, r - 4, k / 36 * Math.PI * 2, (k + 1.2) / 36 * Math.PI * 2); g.stroke();
    }
    g.strokeStyle = 'rgba(255,255,255,.85)'; g.lineWidth = 3;
    g.beginPath(); g.arc(c, c, r - 1, 0, Math.PI * 2); g.stroke();
    g.fillStyle = 'rgba(255,255,255,.95)';
    g.beginPath(); g.ellipse(c - r * .42, c - r * .45, r * .2, r * .11, -.7, 0, Math.PI * 2); g.fill();
    g.beginPath(); g.arc(c + r * .4, c + r * .38, r * .06, 0, Math.PI * 2); g.fill();
  });
  const bubbleMat = new THREE.SpriteMaterial({ map: bubbleTex, transparent: true, depthWrite: false });
  const bubbles = Array.from({ length: 6 }, () => {
    const b = new THREE.Sprite(bubbleMat);
    b.renderOrder = 3;
    toys.add(b);
    return b;
  });

  // ---------- Suasana: kelopak 3D, kilau, berkas cahaya, hati ----------
  const petalCount = reduced.matches ? 0 : coarse ? 40 : 70;
  const petalShape = new THREE.Shape();
  petalShape.moveTo(0, -.05); petalShape.bezierCurveTo(.05, -.03, .045, .04, 0, .05); petalShape.bezierCurveTo(-.045, .04, -.05, -.03, 0, -.05);
  const petals = new THREE.InstancedMesh(new THREE.ShapeGeometry(petalShape, 6), new THREE.MeshBasicMaterial({ color: 0xffc3d3, side: THREE.DoubleSide, transparent: true, opacity: .92 }), Math.max(1, petalCount));
  petals.count = petalCount;
  petals.frustumCulled = false;
  const petalSeeds = Array.from({ length: petalCount }, (_, i) => ({
    x: (Math.random() - .5) * 7, y: Math.random() * 4.5, z: -2.5 + Math.random() * 6.5,
    v: .18 + Math.random() * .25, s: .7 + Math.random() * .9, p: Math.random() * 6.28, i,
  }));
  scene.add(petals);
  const sparkleTex = canvasTexture(64, (g, s) => {
    const r = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
    r.addColorStop(0, 'rgba(255,255,255,1)'); r.addColorStop(.25, 'rgba(255,240,220,.7)'); r.addColorStop(1, 'rgba(255,240,220,0)');
    g.fillStyle = r; g.fillRect(0, 0, s, s);
  });
  const sparkleGeo = new THREE.BufferGeometry();
  const sparkleN = reduced.matches ? 0 : 36;
  const sparklePos = new Float32Array(sparkleN * 3);
  for (let i = 0; i < sparkleN; i++) sparklePos.set([(Math.random() - .5) * 6, .2 + Math.random() * 3, -1.5 + Math.random() * 3.5], i * 3);
  sparkleGeo.setAttribute('position', new THREE.BufferAttribute(sparklePos, 3));
  const sparkles = new THREE.Points(sparkleGeo, new THREE.PointsMaterial({ map: sparkleTex, size: .09, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, color: 0xfff1d6 }));
  scene.add(sparkles);
  const rayTex = canvasTexture(64, (g, s) => {
    const r = g.createLinearGradient(0, 0, 0, s);
    r.addColorStop(0, 'rgba(255,248,230,.9)'); r.addColorStop(1, 'rgba(255,248,230,0)');
    g.fillStyle = r; g.fillRect(0, 0, s, s);
    const h = g.createLinearGradient(0, 0, s, 0);
    h.addColorStop(0, 'rgba(0,0,0,1)'); h.addColorStop(.5, 'rgba(0,0,0,0)'); h.addColorStop(1, 'rgba(0,0,0,1)');
    g.globalCompositeOperation = 'destination-out'; g.fillStyle = h; g.fillRect(0, 0, s, s);
  });
  const rays = [];
  for (let i = 0; i < 3; i++) {
    const ray = new THREE.Mesh(new THREE.PlaneGeometry(.9 + i * .3, 6), new THREE.MeshBasicMaterial({ map: rayTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: .1 }));
    ray.position.set(-2.4 + i * 1.1, 2.4, -2.2 + i * .2);
    ray.rotation.z = -.42;
    scene.add(ray); rays.push(ray);
  }
  const heartTex = canvasTexture(128, (g, s) => {
    heartPath(g, s / 2, s / 2, s * .36);
    const r = g.createLinearGradient(0, 0, 0, s);
    r.addColorStop(0, '#ffb3c7'); r.addColorStop(1, '#ee5f86');
    g.fillStyle = r; g.fill();
    g.lineWidth = 6; g.strokeStyle = '#ffffff'; g.stroke();
  });
  const hearts = [];
  function burst(n, x, y) {
    if (reduced.matches) return;
    for (let i = 0; i < n; i++) {
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: heartTex, transparent: true, depthWrite: false }));
      sp.scale.setScalar(.22);
      sp.position.set(x + (Math.random() - .5) * .8, y + Math.random() * .3, .7);
      sp.userData = { born: clock, vx: (Math.random() - .5) * .4, life: 1.1 + Math.random() * .5 };
      scene.add(sp); hearts.push(sp);
    }
  }

  // ---------- Pascaproses: bloom lembut, gradasi warna, vinyet ----------
  const target = new THREE.WebGLRenderTarget(2, 2, { type: THREE.HalfFloatType, samples: 4 });
  const composer = new EffectComposer(renderer, target);
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), .22, .5, .93);
  composer.addPass(bloom);
  composer.addPass(new ShaderPass({
    uniforms: { tDiffuse: { value: null } },
    vertexShader: 'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
    fragmentShader: `uniform sampler2D tDiffuse;varying vec2 vUv;
      void main(){vec4 c=texture2D(tDiffuse,vUv);vec2 d=(vUv-.5)*vec2(1.,.85);
      float v=smoothstep(.9,.28,length(d));c.rgb*=mix(.8,1.,v);
      float l=dot(c.rgb,vec3(.299,.587,.114));c.rgb=mix(vec3(l),c.rgb,1.07);
      c.rgb*=vec3(1.02,.995,1.01);gl_FragColor=c;}`,
  }));
  composer.addPass(new OutputPass());

  // ---------- Kamera, ukuran, kualitas adaptif ----------
  let lastSize = '', quality = coarse ? 1.5 : 2, aspect = 1;
  const pointer = { x: 0, y: 0 }, sway = { x: 0, y: 0 };
  canvas.addEventListener('pointermove', e => {
    const r = canvas.getBoundingClientRect();
    pointer.x = (e.clientX - r.left) / r.width * 2 - 1;
    pointer.y = (e.clientY - r.top) / r.height * 2 - 1;
  });
  canvas.addEventListener('pointerleave', () => { pointer.x = pointer.y = 0; });
  function resize() {
    const ratio = Math.min(devicePixelRatio || 1, quality);
    const w = canvas.clientWidth, h = canvas.clientHeight;
    const key = [w, h, ratio].join();
    if (key === lastSize || !w || !h) return;
    lastSize = key;
    renderer.setPixelRatio(ratio);
    renderer.setSize(w, h, false);
    composer.setPixelRatio(ratio);
    composer.setSize(w, h);
    bloom.resolution.set(w * ratio / 2, h * ratio / 2);
    aspect = w / h;
    const dist = 6.4, V = Math.max(3.3, 3.8 / aspect);
    camera.fov = 2 * Math.atan(V / 2 / dist) * 180 / Math.PI;
    camera.aspect = aspect;
    camera.updateProjectionMatrix();
    if (bgTex) {
      const rx = Math.min(1, aspect / bgAspect), ry = Math.min(1, bgAspect / aspect);
      bgTex.repeat.set(rx * .94, ry * .94);
      bgTex.offset.set((1 - rx * .94) / 2, (1 - ry * .94) / 2 - .02);
    }
  }
  let frames = 0, slowSince = 0, clock = 0;
  function adapt(dt) {
    if (dt > .034) { frames++; if (!slowSince) slowSince = clock; } else if (frames > 0) frames--;
    if (frames > 90 && quality > 1) {
      quality = Math.max(1, quality - .5);
      if (quality <= 1) { bloom.enabled = false; sun.shadow.mapSize.set(1024, 1024); sun.shadow.map?.dispose(); sun.shadow.map = null; }
      frames = 0; lastSize = '';
    }
  }

  // ---------- Animasi per frame ----------
  const v1 = new THREE.Vector3(), v2 = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0);
  let prev = { petted: false, motion: 'rest', biting: false, highfive: false, reveal: false };
  let lastT = 0;
  function render(t, s) {
    const dt = Math.min(.1, Math.max(0, t - lastT)); lastT = t; clock = t;
    resize();
    adapt(dt);
    const still = reduced.matches;

    // Kamera bergeser pelan mengikuti pointer: kesan parallax 3D.
    const ease = 1 - Math.exp(-3 * dt);
    sway.x += ((still ? 0 : pointer.x * .32 + Math.sin(t * .23) * .06) - sway.x) * ease;
    sway.y += ((still ? 0 : -pointer.y * .14 + Math.sin(t * .31) * .03) - sway.y) * ease;
    camera.position.set(sway.x, 1.82 + sway.y, 6.6);
    camera.lookAt(lookTarget);
    if (bgTex) {
      const rx = bgTex.repeat.x;
      bgTex.offset.x = (1 - rx) / 2 + sway.x * .012;
    }

    // Mimi: posisi, jongkok, lompat, dan napas.
    const step = Math.sin(s.stridePhase) * s.gait;
    const breath = Math.sin(t * 2.35) * .019;
    const compress = (s.crouch || 0) * .11 + (s.impact || 0) * .15;
    const base = .11 + (s.lift || 0) + (s.hop || 0) + Math.abs(step) * .036;
    cat.position.set(s.catX, base, 0);
    cat.rotation.y = s.face || 0;
    bodyPivot.rotation.z = -(s.lookX * .02 + step * .03) - (s.petted ? .05 : 0);
    body.position.set(0, .64 - compress, -.06);
    body.scale.set(1 + compress * .4, 1 - compress * .7 + breath * .4, 1 + breath * .3);
    for (let i = 0; i < 2; i++) {
      const side = i ? 1 : -1, stride = step * side;
      haunch[i].position.y = .34 - compress * .5;
      feet[i].position.set(side * .39, .14 + Math.max(0, stride) * .09, .18 + stride * .07);
      const raise = Math.max(s.cover || 0, side === 1 ? (s.wave || 0) : 0);
      const pawY = .16 + raise * 1.3 + Math.max(0, -stride) * .12 + (s.reach || 0) * .45;
      const pawX = side * (.245 + (s.reach || 0) * .06 + (side === 1 ? .32 * (s.wave || 0) : 0));
      const pawZ = .43 + (s.reach || 0) * .18 + raise * .22;
      paws[i].position.set(pawX, pawY, pawZ);
      paws[i].rotation.x = -raise * 1.1;
      v1.set(side * .26, .72 - compress, .3);
      v2.set(pawX, pawY + .04, pawZ - .03);
      const len = v1.distanceTo(v2);
      legs[i].position.copy(v1).add(v2).multiplyScalar(.5);
      legs[i].scale.set(1, Math.max(.2, len / .75), 1);
      legs[i].quaternion.setFromUnitVectors(up, v2.sub(v1).normalize());
    }
    updateTail(s.tailPhase || t * 1.7, s.gait || 0);

    // Kepala: menoleh, mengangguk, miring manja saat dielus.
    const nod = breath - compress + (s.biting ? -.085 * Math.abs(Math.sin(t * 12)) : 0);
    head.position.set(.035 * s.lookX + .12 * (s.nuzzle || 0), 1.45 + nod, 0);
    head.rotation.set(-s.lookY * .14 + (s.biting ? .1 : 0), s.lookX * .21 + .28 * (s.nuzzle || 0), -(s.nuzzle || 0) * .22 + (s.petted ? .12 : 0) + Math.sin(t * .9) * .02);
    const twitch = !still && t % 6.3 < .18 ? Math.sin(t * 60) * .12 : 0;
    ears[0].rotation.z = .38 + (s.petted ? .22 : 0) + twitch;
    ears[1].rotation.z = -.38 - (s.petted ? .22 : 0) - (s.mode === 'play' && s.motion !== 'rest' ? .08 : 0);
    ears[0].rotation.x = ears[1].rotation.x = s.mode === 'play' && s.motion === 'stalk' ? -.25 : 0;

    const cycle = t % 4.9;
    const blink = Math.min(1, Math.abs(cycle - 4.6) / .13);
    const happy = Boolean(s.petted || (s.cover || 0) > .5 || s.gesture === 'highfive' || s.motion === 'hug');
    drawFace(blink, s.lookX, s.lookY, happy, Boolean(s.biting || s.mode === 'chat' || s.gesture === 'reveal' || s.motion === 'pounce'));

    // Mainan sesuai mode.
    yarn.visible = s.mode === 'play';
    if (thread) thread.visible = yarn.visible;
    if (yarn.visible) {
      yarn.position.set(s.ballX, s.ballY, 1);
      yarn.rotation.z -= dt * (s.ballX - (yarn.userData.px ?? s.ballX)) / Math.max(dt, .001) * 2.5;
      yarn.userData.px = s.ballX;
      updateThread(s.ballX, s.ballY, t);
    }
    bowl.visible = fish.visible = s.mode === 'feed';
    if (fish.visible) {
      const x = s.drag?.x ?? .82, y = s.drag?.y ?? .44;
      fish.position.set(x, y, 1.21);
      fish.rotation.z = Math.sin(t * 3) * .12;
    }
    const foam = s.mode === 'wash' && s.foam ? [...s.foam] : [];
    bubbles.forEach((b, i) => {
      const id = foam[i];
      b.visible = id !== undefined;
      if (!b.visible) return;
      const a = id * 2.4;
      b.position.set(s.catX + Math.cos(a) * .61, 1.3 + Math.sin(a) * .39 + Math.sin(t * 2 + id) * .02, .64);
      b.scale.setScalar(.27 * (1 + Math.sin(t * 3 + id) * .05));
      b.material.rotation = Math.sin(t + id) * .3;
    });

    // Hati beterbangan saat dielus, menangkap benang, atau makan.
    const highfive = s.gesture === 'highfive', reveal = s.gesture === 'reveal';
    if (s.petted && !prev.petted) burst(4, s.catX, 2.2);
    if (s.motion === 'hug' && prev.motion !== 'hug') burst(6, s.catX, 1.9 + (s.lift || 0));
    if (s.biting && !prev.biting) burst(3, s.catX, 1.8);
    if (highfive && !prev.highfive) burst(5, s.catX + .4, 1.9);
    if (reveal && !prev.reveal) burst(3, s.catX, 2.1);
    prev = { petted: Boolean(s.petted), motion: s.motion, biting: Boolean(s.biting), highfive, reveal };
    for (let i = hearts.length - 1; i >= 0; i--) {
      const h = hearts[i], age = (clock - h.userData.born) / h.userData.life;
      if (age >= 1) { scene.remove(h); h.material.dispose(); hearts.splice(i, 1); continue; }
      h.position.y += dt * .9;
      h.position.x += h.userData.vx * dt;
      h.material.opacity = 1 - age * age;
      h.scale.setScalar(.16 + .1 * Math.sin(Math.min(1, age * 3) * Math.PI / 2));
    }

    // Kelopak berguguran, kilau, dan berkas cahaya bernapas.
    if (petalCount) {
      const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), sc = new THREE.Vector3(), p = new THREE.Vector3();
      for (const seed of petalSeeds) {
        seed.y -= seed.v * dt;
        if (seed.y < 0) { seed.y = 4.3 + Math.random() * .6; seed.x = (Math.random() - .5) * 7; }
        p.set(seed.x + Math.sin(t * .8 + seed.p) * .35 - (4.3 - seed.y) * .12, seed.y, seed.z);
        e.set(t * 1.3 + seed.p, t * .9 + seed.p * 2, t * .7);
        q.setFromEuler(e);
        sc.setScalar(seed.s);
        petals.setMatrixAt(seed.i, m.compose(p, q, sc));
      }
      petals.instanceMatrix.needsUpdate = true;
    }
    if (sparkleN) sparkles.material.opacity = .55 + .35 * Math.sin(t * 2.1);
    rays.forEach((r, i) => { r.material.opacity = still ? .09 : .07 + .045 * Math.sin(t * .6 + i * 1.7); });

    composer.render(dt);
  }

  const raycaster = new THREE.Raycaster(), ndc = new THREE.Vector2(), plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0), hit = new THREE.Vector3();
  function world(event, z = 0) {
    const r = canvas.getBoundingClientRect();
    ndc.set((event.clientX - r.left) / r.width * 2 - 1, -((event.clientY - r.top) / r.height * 2 - 1));
    raycaster.setFromCamera(ndc, camera);
    plane.constant = -z;
    return raycaster.ray.intersectPlane(plane, hit) ? { x: hit.x, y: hit.y } : { x: 0, y: 0 };
  }

  if (location.search.includes('mimi-debug')) globalThis.__mimi = {
    bloom, scene, renderer,
    project(x, y, z) {
      const v = new THREE.Vector3(x, y, z).project(camera), r = canvas.getBoundingClientRect();
      return { x: r.left + (v.x + 1) / 2 * r.width, y: r.top + (1 - v.y) / 2 * r.height };
    },
  };
  canvas.addEventListener('webglcontextlost', e => e.preventDefault());
  return { render, world };
}
