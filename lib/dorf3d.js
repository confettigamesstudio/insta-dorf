// The village in 3D (Thomas 24.10.2026): the models Unity exported (Webseite/dorf3d_export.py -> daten/3d/), each one once and
// placed many times (instancing), on the top-down map picture as ground; the villagers as small figures in their shirt colour.
// Drag to turn, two fingers / right mouse to move, pinch / wheel to zoom; a tap on a house or a figure calls back into app.js.
import * as THREE from "./three.module.min.js";
import { OrbitControls } from "./OrbitControls.js";

export async function start(box, karte, onPick, onProgress) {
  const base = "daten/3d/";
  const info = await (await fetch(base + "dorf3d.json", { cache: "no-cache" })).json();
  onProgress && onProgress("Lade Modelle …");
  const gz = await fetch(base + "dorf3d.bin.gz", { cache: "no-cache" });
  const bin = await new Response(gz.body.pipeThrough(new DecompressionStream("gzip"))).arrayBuffer();

  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  box.appendChild(renderer.domElement);
  const scene = new THREE.Scene();
  const sky = new THREE.Color("#bfe3f2");
  scene.background = sky;
  scene.fog = new THREE.Fog(sky, 380, 900);
  scene.add(new THREE.HemisphereLight("#ffffff", "#7a8f5a", 1.6));
  const sun = new THREE.DirectionalLight("#fff3dc", 1.6);
  sun.position.set(-120, 200, 90);
  scene.add(sun);

  // ground: the map picture, top of the picture = north (largest z in the game = most negative z here)
  const W = karte.x1 - karte.x0, D = karte.z1 - karte.z0;
  let dirty = true;
  const manager = new THREE.LoadingManager(() => (dirty = true));   // every texture that arrives shows up at once
  manager.onProgress = () => (dirty = true);
  const loader = new THREE.TextureLoader(manager);
  const groundTex = loader.load(karte.bild);
  groundTex.colorSpace = THREE.SRGBColorSpace;
  groundTex.anisotropy = renderer.capabilities.getMaxAnisotropy();
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(W, D), new THREE.MeshLambertMaterial({ map: groundTex }));
  ground.rotation.x = -Math.PI / 2;
  ground.position.set((karte.x0 + karte.x1) / 2, -0.05, -(karte.z0 + karte.z1) / 2);
  scene.add(ground);

  // materials: the palette texture (pixel colours, no blur)
  const mats = info.mats.map((m) => {
    const o = { color: new THREE.Color(m.c[0], m.c[1], m.c[2]), flatShading: true };
    if (m.tex) { const t = loader.load(base + m.tex); t.colorSpace = THREE.SRGBColorSpace; t.magFilter = THREE.NearestFilter; t.minFilter = THREE.NearestFilter; t.generateMipmaps = false; o.map = t; }
    if (m.e && (m.e[0] + m.e[1] + m.e[2]) > 0) o.emissive = new THREE.Color(m.e[0], m.e[1], m.e[2]);
    if (m.t) { o.transparent = true; o.opacity = m.c[3]; }
    return new THREE.MeshLambertMaterial(o);
  });

  const pickables = [], m4 = new THREE.Matrix4();
  for (const m of info.meshes) {
    const q = new Uint16Array(bin, m.pos, m.n * 3), uq = new Uint16Array(bin, m.uv, m.n * 2);
    const p = new Float32Array(m.n * 3), uv = new Float32Array(m.n * 2);
    for (let k = 0; k < m.n; k++) {
      p[k * 3] = m.lo[0] + q[k * 3] / 65535 * m.size[0];
      p[k * 3 + 1] = m.lo[1] + q[k * 3 + 1] / 65535 * m.size[1];
      p[k * 3 + 2] = -(m.lo[2] + q[k * 3 + 2] / 65535 * m.size[2]);   // right-handed
      uv[k * 2] = uq[k * 2] / 65535; uv[k * 2 + 1] = uq[k * 2 + 1] / 65535;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(p, 3));
    g.setAttribute("uv", new THREE.BufferAttribute(uv, 2));
    g.setIndex(new THREE.BufferAttribute(m.wide ? new Uint32Array(bin, m.idx, m.i) : new Uint16Array(bin, m.idx, m.i), 1));
    for (const [s, c, mi] of m.groups) g.addGroup(s, c, mi);
    g.computeVertexNormals();
    const im = new THREE.InstancedMesh(g, m.groups.length > 1 ? m.groups.map((x) => mats[x[2]]) : mats[m.groups[0][2]], m.inst.length);
    if (m.groups.length > 1) g.groups.forEach((gr, i) => (gr.materialIndex = i));
    m.inst.forEach((a, i) => { m4.fromArray([a[0], a[1], a[2], 0, a[3], a[4], a[5], 0, a[6], a[7], a[8], 0, a[9], a[10], a[11], 1]); im.setMatrixAt(i, m4); });
    im.userData.houses = m.inst.map((a) => a[12]);
    im.computeBoundingSphere();
    scene.add(im);
    if (m.inst.some((a) => a[12])) pickables.push(im);
  }

  // the villagers: a capsule each in the shirt colour, a skin-coloured head on top
  const F = info.figuren || [];
  if (F.length) {
    const body = new THREE.InstancedMesh(new THREE.CapsuleGeometry(0.34, 0.75, 3, 8), new THREE.MeshLambertMaterial({ flatShading: true }), F.length);
    const head = new THREE.InstancedMesh(new THREE.SphereGeometry(0.3, 10, 8), new THREE.MeshLambertMaterial({ color: "#f2c7a5", flatShading: true }), F.length);
    const c = new THREE.Color();
    F.forEach((f, i) => {
      m4.makeTranslation(f[1], f[2] + 0.72, f[3]); body.setMatrixAt(i, m4); body.setColorAt(i, c.set(f[5]));
      m4.makeTranslation(f[1], f[2] + 1.55, f[3]); head.setMatrixAt(i, m4);
    });
    body.userData.figures = F.map((f) => f[0]);
    head.userData.figures = body.userData.figures;
    scene.add(body, head);
    pickables.push(body, head);
  }

  const camera = new THREE.PerspectiveCamera(45, 1, 0.5, 2000);
  const cx = (karte.x0 + karte.x1) / 2, cz = -(karte.z0 + karte.z1) / 2;
  camera.position.set(cx + 60, Math.max(W, D) * 0.55, cz + Math.max(W, D) * 0.55);
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.target.set(cx, 0, cz);
  controls.enableDamping = true;
  controls.maxPolarAngle = Math.PI * 0.46;
  controls.minDistance = 12;
  controls.maxDistance = Math.max(W, D) * 1.3;
  controls.screenSpacePanning = false;

  function size() {
    const w = box.clientWidth, h = box.clientHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / Math.max(1, h);
    camera.updateProjectionMatrix();
    dirty = true;   // a resized canvas is empty until the next frame is drawn
  }
  size();
  new ResizeObserver(size).observe(box);

  // render only while something moves (battery on phones)
  controls.addEventListener("change", () => (dirty = true));
  (function loop() {
    requestAnimationFrame(loop);
    const moving = controls.update();
    if (dirty || moving) { renderer.render(scene, camera); dirty = false; }
  })();
  setTimeout(() => (dirty = true), 400);

  // tap: a figure opens the profile, a house its residents (only a real tap, not the end of a drag)
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
  let down = null;
  renderer.domElement.addEventListener("pointerdown", (e) => (down = { x: e.clientX, y: e.clientY }));
  renderer.domElement.addEventListener("pointerup", (e) => {
    if (!down || Math.hypot(e.clientX - down.x, e.clientY - down.y) > 6) return;
    const r = renderer.domElement.getBoundingClientRect();
    ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    for (const hit of ray.intersectObjects(pickables, false)) {
      const o = hit.object, i = hit.instanceId;
      if (o.userData.figures) { onPick({ villager: o.userData.figures[i] }); return; }
      if (o.userData.houses && o.userData.houses[i]) { onPick({ house: o.userData.houses[i] }); return; }
    }
  });
  return { reset() { camera.position.set(cx + 60, Math.max(W, D) * 0.55, cz + Math.max(W, D) * 0.55); controls.target.set(cx, 0, cz); dirty = true; } };
}
