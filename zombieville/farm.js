// Zombieville website, tab "Farm" (Thomas 26.10.2026): the game's world as a 3D map to turn and zoom - only a view, no game.
// The world comes from daten/zombieville_farm.json, written before every publish by Webseite/zombieville_farm_export.mjs from the
// game's own level code, so this map always follows the game ("alles immer in einem Zug"). It uses the same glb models
// (zombieville/spiel/modelle/*.glb), the same ground textures and shader, and the game's signs as labels. No game code is loaded.
import * as THREE from "three";
import { OrbitControls } from "../lib/OrbitControls.js";
import { GLTFLoader } from "./spiel/lib/GLTFLoader.js";

const START = new THREE.Vector3(30, 30, 44);
const ZIEL = new THREE.Vector3(0, 0, 0);
// Thomas 27.10.2026: drag the map freely (right mouse button / two fingers), it stays where you leave it - only the map's
// edge stops it; zoom out far enough to see the whole map; "Zum Camp" jumps back

const ausB64 = (s, T) => { const b = atob(s), u = new Uint8Array(b.length); for (let i = 0; i < b.length; i++) u[i] = b.charCodeAt(i); return new T(u.buffer); };

// start(container, status) -> {zeigen(an), zuruecksetzen(), namen(an)}
export async function start(box, status) {
  const mobil = matchMedia("(pointer: coarse)").matches;
  const basis = new URL("../", import.meta.url).href;   // the site root
  status("Lade die Farm …");
  const D = await fetch(basis + "daten/zombieville_farm.json", { cache: "no-store" }).then((r) => { if (!r.ok) throw new Error(r.status); return r.json(); });
  const MATERIAL = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true });
  const loader = new GLTFLoader();
  let geladen = 0;
  const glbs = await Promise.all(D.dateien.map((f) => loader.loadAsync(basis + f).then((g) => { status("Lade die Farm … " + Math.round(++geladen / D.dateien.length * 100) + " %"); return g.scene; })));
  // "file:mesh name" -> geometry, numbered like the export when a name repeats
  const geos = new Map();
  D.dateien.forEach((f, i) => {
    const datei = f.split("/").pop().replace(".glb", ""), namen = new Map();
    glbs[i].traverse((o) => { if (o.isMesh) { const n = o.name || "mesh"; const k = namen.has(n) ? n + "#" + (namen.get(n) + 1) : n; namen.set(n, (namen.get(n) || 0) + 1); geos.set(datei + ":" + k, o.geometry); } });
  });

  const renderer = new THREE.WebGLRenderer({ antialias: (devicePixelRatio || 1) < 2, powerPreference: "high-performance" });
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, mobil ? 1.6 : 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  box.prepend(renderer.domElement);
  const scene = new THREE.Scene();
  const HIMMEL = new THREE.Color("#c3cfc9");   // sky, fog and light like the game
  scene.background = HIMMEL;
  scene.fog = new THREE.Fog(HIMMEL, 120, 330);
  scene.add(new THREE.HemisphereLight("#fff8e8", "#58613f", 1.9));
  const sonne = new THREE.DirectionalLight("#fff0d6", 1.6); sonne.position.set(-40, 80, 30); scene.add(sonne);
  const kamera = new THREE.PerspectiveCamera(45, 1, 0.5, 3000);
  kamera.position.copy(START);

  // placements: 10 numbers each (position, quaternion, scale) -> one instanced mesh per model
  const m4 = new THREE.Matrix4(), p = new THREE.Vector3(), q = new THREE.Quaternion(), s = new THREE.Vector3();
  const setzen = (geo, mat, f) => {
    const n = f.length / 10, im = new THREE.InstancedMesh(geo, mat, n);
    for (let i = 0; i < n; i++) { const o = i * 10; im.setMatrixAt(i, m4.compose(p.set(f[o], f[o + 1], f[o + 2]), q.set(f[o + 3], f[o + 4], f[o + 5], f[o + 6]), s.set(f[o + 7], f[o + 8], f[o + 9]))); }
    im.computeBoundingSphere(); im.matrixAutoUpdate = false; scene.add(im);
  };
  // phones (Thomas 27.10.2026, bigger map): trees far from the camera are drawn as two blocks (trunk + crown in the model's own
  // colours), grass and flowers far away not at all; near the camera everything stays the real model
  const LOD = [[/^natur:(Tanne|Laub|Tot)_/, 150, true], [/^natur:(Gras|Blume)_/, 110, false]];
  const blockBaum = (geo) => {
    geo.computeBoundingBox();
    const bb = geo.boundingBox, H = bb.max.y - bb.min.y, cut = bb.min.y + H * 0.3, pos = geo.getAttribute("position"), col = geo.getAttribute("color");
    const mittel = [[0, 0, 0, 0], [0, 0, 0, 0]];
    for (let i = 0; col && i < pos.count; i++) { const m = mittel[pos.getY(i) > cut ? 1 : 0]; m[0] += col.getX(i); m[1] += col.getY(i); m[2] += col.getZ(i); m[3]++; }
    const farbe = (m, f) => (m[3] ? [m[0] / m[3], m[1] / m[3], m[2] / m[3]] : f);
    const box = (w, h, d, y, c, ohne) => { const g = new THREE.BoxGeometry(w, h, d); g.translate((bb.min.x + bb.max.x) / 2, y, (bb.min.z + bb.max.z) / 2); g.deleteAttribute("uv");
      if (ohne) g.setIndex(Array.from(g.index.array).filter((_, i) => !ohne.includes(Math.floor(i / 6))));   // faces never seen (2 = top, 3 = bottom)
      const f = new Float32Array(g.getAttribute("position").count * 3); for (let i = 0; i < f.length; i += 3) f.set(c, i); g.setAttribute("color", new THREE.BufferAttribute(f, 3)); return g; };
    const bx = bb.max.x - bb.min.x, bz = bb.max.z - bb.min.z, kh = bb.max.y - cut, krone = farbe(mittel[1], [0.3, 0.45, 0.25]);
    const teile = [box(bx * 0.12, H * 0.3, bz * 0.12, bb.min.y + H * 0.15, farbe(mittel[0], [0.35, 0.25, 0.15]), [2, 3]),
      box(bx * 0.85, kh * 0.6, bz * 0.85, cut + kh * 0.3, krone, [3]), box(bx * 0.5, kh * 0.4, bz * 0.5, cut + kh * 0.8, krone, [3])];   // crown in two steps
    const g = new THREE.BufferGeometry(), idx = [];
    for (const n of ["position", "normal", "color"]) { const a = teile.map((t) => t.getAttribute(n).array), f = new Float32Array(a.reduce((x, y) => x + y.length, 0)); let o = 0; for (const x of a) { f.set(x, o); o += x.length; } g.setAttribute(n, new THREE.BufferAttribute(f, 3)); }
    let n0 = 0; for (const t of teile) { for (const i of t.index.array) idx.push(i + n0); n0 += t.getAttribute("position").count; }
    g.setIndex(idx);
    return g;
  };
  const stufen = [];   // {voll, fern, f (placements), xz, r2}
  for (const [k, b] of Object.entries(D.modelle)) {
    const g = geos.get(k); if (!g) continue;
    const f = ausB64(b, Float32Array), regel = LOD.find(([re]) => re.test(k));
    if (!regel) { setzen(g, MATERIAL, f); continue; }
    const n = f.length / 10, mk = (geo) => { const im = new THREE.InstancedMesh(geo, MATERIAL, n); im.count = 0; im.frustumCulled = false; im.matrixAutoUpdate = false; scene.add(im); return im; };
    const mats = new Float32Array(n * 16);
    for (let i = 0; i < n; i++) { const o = i * 10; m4.compose(p.set(f[o], f[o + 1], f[o + 2]), q.set(f[o + 3], f[o + 4], f[o + 5], f[o + 6]), s.set(f[o + 7], f[o + 8], f[o + 9])); m4.toArray(mats, i * 16); }
    stufen.push({ voll: mk(g), fern: regel[2] ? mk(blockBaum(g)) : null, f, n, mats, r2: regel[1] * regel[1] });
  }
  let lodX = 1e9, lodY = 1e9, lodZ = 1e9, lodT = 0;
  const lodAuffrischen = (cam) => {   // only when the camera moved 4 m, at most ~8 times a second
    const jetzt = performance.now();
    if ((cam.x - lodX) ** 2 + (cam.y - lodY) ** 2 + (cam.z - lodZ) ** 2 < 16 || jetzt - lodT < 120) return;
    lodX = cam.x; lodY = cam.y; lodZ = cam.z; lodT = jetzt;
    for (const st of stufen) {
      let a = 0, b = 0;
      const va = st.voll.instanceMatrix.array, vb = st.fern && st.fern.instanceMatrix.array;
      for (let i = 0; i < st.n; i++) {
        const o = i * 10, d2 = (st.f[o] - cam.x) ** 2 + (st.f[o + 1] - cam.y) ** 2 + (st.f[o + 2] - cam.z) ** 2;
        if (d2 < st.r2) va.set(st.mats.subarray(i * 16, i * 16 + 16), 16 * a++);
        else if (vb) vb.set(st.mats.subarray(i * 16, i * 16 + 16), 16 * b++);
      }
      st.voll.count = a; st.voll.instanceMatrix.needsUpdate = true;
      if (st.fern) { st.fern.count = b; st.fern.instanceMatrix.needsUpdate = true; }
    }
  };

  // the ground shader of the game (its own code, taken over as it is) + its textures
  let boden = MATERIAL;
  if (D.bodenShader) {
    const tl = new THREE.TextureLoader(), uni = {};
    for (const [n, u] of Object.entries(D.bodenShader.uniforms)) {
      const t = tl.load(basis + "daten/zombieville_farm/" + u.datei);
      if (u.wiederholen) t.wrapS = t.wrapT = THREE.RepeatWrapping;
      t.colorSpace = u.srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace; t.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
      uni[n] = { value: t };
    }
    boden = new THREE.MeshLambertMaterial({ vertexColors: true });
    boden.onBeforeCompile = (sh) => {
      Object.assign(sh.uniforms, uni);
      for (const [k, w] of Object.entries(D.bodenShader.ersetzen.vertex)) sh.vertexShader = sh.vertexShader.replace(k, w);
      for (const [k, w] of Object.entries(D.bodenShader.ersetzen.fragment)) sh.fragmentShader = sh.fragmentShader.replace(k, w);
    };
  }
  // the ground grids: heights (cm), tint and dirt as bytes; positions and triangles are rebuilt here
  const gitterGeo = (G) => {
    const n = (G.nx + 1) * (G.nz + 1), y = ausB64(G.y, Int16Array), fb = ausB64(G.farbe, Uint8Array), eb = ausB64(G.erde, Uint8Array);
    const pos = new Float32Array(n * 3), col = new Float32Array(n * 3), erd = new Float32Array(n), idx = [];
    for (let i = 0, k = 0; i <= G.nx; i++) for (let j = 0; j <= G.nz; j++, k++) { pos[k * 3] = G.x0 + i * G.c; pos[k * 3 + 1] = y[k] / 100; pos[k * 3 + 2] = G.z0 + j * G.c; erd[k] = eb[k] / 255; }
    for (let i = 0; i < n * 3; i++) col[i] = fb[i] / 100;
    const L = G.loch;
    for (let i = 0; i < G.nx; i++) for (let j = 0; j < G.nz; j++) { if (L && i >= L[0] && i < L[1] && j >= L[2] && j < L[3]) continue; const a = i * (G.nz + 1) + j, b = a + G.nz + 1; idx.push(a, a + 1, b, b, a + 1, b + 1); }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(pos, 3)); g.setAttribute("color", new THREE.BufferAttribute(col, 3)); g.setAttribute("erde", new THREE.BufferAttribute(erd, 1));
    g.setIndex(n > 65535 ? new THREE.BufferAttribute(new Uint32Array(idx), 1) : new THREE.BufferAttribute(new Uint16Array(idx), 1));
    return g;
  };
  const wasserZeit = { value: 0 };   // time for the lake's moving surface
  // meshes the game builds in code (ground, roads, block buildings)
  for (const e of D.eigene) {
    let g;
    if (e.gitter) g = gitterGeo(e.gitter);
    else if (e.kompakt) {   // block meshes: positions in cm, colours as bytes
      const K = e.kompakt, P = ausB64(K.pos, Int16Array), F = ausB64(K.farbe, Uint8Array), pos = new Float32Array(P.length), col = new Float32Array(F.length);
      for (let i = 0; i < P.length; i++) pos[i] = P[i] / 100;
      for (let i = 0; i < F.length; i++) col[i] = F[i] / 255;
      g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.BufferAttribute(pos, 3)); g.setAttribute("color", new THREE.BufferAttribute(col, 3));
      if (K.index) g.setIndex(new THREE.BufferAttribute(K.i32 ? ausB64(K.index, Uint32Array) : ausB64(K.index, Uint16Array), 1));
    } else {
      g = new THREE.BufferGeometry();
      for (const [n, w] of Object.entries(e.attr)) if (n !== "index") g.setAttribute(n, new THREE.BufferAttribute(ausB64(w[1], Float32Array), w[0]));
      if (e.attr.index) g.setIndex(new THREE.BufferAttribute(ausB64(e.attr.index, Uint32Array), 1));
    }
    g.computeVertexNormals();
    if (e.art === "wasser" && e.wasser) {   // the lake: the game's water shader, gently moving
      const W = e.wasser, mat = new THREE.MeshPhongMaterial({ color: e.farbe, specular: W.specular, shininess: W.shininess, transparent: true, opacity: W.opacity });
      mat.onBeforeCompile = (sh) => {
        sh.uniforms.uZeit = wasserZeit;
        for (const [k, w] of Object.entries(W.ersetzen.vertex)) sh.vertexShader = sh.vertexShader.replace(k, w);
        for (const [k, w] of Object.entries(W.ersetzen.fragment)) sh.fragmentShader = sh.fragmentShader.replace(k, w);
      };
      const f = ausB64(e.platz, Float32Array);
      for (let i = 0; i < f.length; i += 10) {
        const m = new THREE.Mesh(g, mat); m.matrixAutoUpdate = false; m.renderOrder = 1;
        m.matrix.compose(p.set(f[i], f[i + 1], f[i + 2]), q.set(f[i + 3], f[i + 4], f[i + 5], f[i + 6]), s.set(f[i + 7], f[i + 8], f[i + 9])); scene.add(m);
      }
      continue;
    }
    const mat = e.art === "boden" ? boden : e.art === "vc" ? MATERIAL : new THREE.MeshLambertMaterial({ color: e.farbe || "#888888", flatShading: e.flach });
    setzen(g, mat, ausB64(e.platz, Float32Array));
  }
  const glut = new THREE.PointLight("#ff8a3a", 6, 9, 1.6);
  const feuer = D.schilder.find((x) => /Lagerfeuer/.test(x.text)); if (feuer) { glut.position.set(feuer.x, feuer.y - 0.9, feuer.z); scene.add(glut); }

  // labels: the game's signs as small HTML tags (tents and beds only once each)
  const ebene = document.createElement("div"); ebene.className = "zv-farm-namen"; box.append(ebene);
  const schilder = [], schon = {};
  for (const x of D.schilder) {
    const t = x.text.replace(/^\S+\s/, "");   // without the emoji (looks different on every device)
    if (/Zelt|Beet/.test(t) && schon[t]) continue; schon[t] = 1;
    const el = document.createElement("span"); el.className = "zv-farm-name"; el.textContent = t; ebene.append(el);
    schilder.push({ el, p: new THREE.Vector3(x.x, x.y, x.z) });
  }

  // ground height (every few metres, from the export) so the centre of the view sits on the hills and the mountain
  const HG = D.hoehen, hDm = HG ? ausB64(HG.dm, Int16Array) : null;
  const bodenHoehe = (x, z) => {
    if (!hDm) return 0;
    const fx = Math.max(0, Math.min(HG.nx - 1.001, (x - HG.x0) / HG.schritt)), fz = Math.max(0, Math.min(HG.nz - 1.001, (z - HG.z0) / HG.schritt));
    const i = Math.floor(fx), j = Math.floor(fz), u = fx - i, v = fz - j, h = (a, b) => hDm[b * HG.nx + a] / 10;
    return (h(i, j) * (1 - u) + h(i + 1, j) * u) * (1 - v) + (h(i, j + 1) * (1 - u) + h(i + 1, j + 1) * u) * v;
  };
  const RAND = D.boden || { x0: -165, x1: 165, z0: -160, z1: 284 };
  const groesseKarte = Math.max(RAND.x1 - RAND.x0, RAND.z1 - RAND.z0);

  const steuerung = new OrbitControls(kamera, renderer.domElement);
  steuerung.target.copy(ZIEL);
  steuerung.enableDamping = true; steuerung.dampingFactor = 0.08;
  steuerung.minDistance = 8; steuerung.maxDistance = groesseKarte * 1.05; steuerung.maxPolarAngle = 1.38;
  steuerung.screenSpacePanning = false;   // dragging moves along the ground
  // the mouse wheel zooms towards the pointer; pinching on a phone zooms towards the middle (towards the fingers it drifts)
  renderer.domElement.addEventListener("pointerdown", (e) => { steuerung.zoomToCursor = e.pointerType === "mouse"; });
  renderer.domElement.addEventListener("wheel", () => { steuerung.zoomToCursor = true; }, { capture: true, passive: true });
  steuerung.autoRotate = true; steuerung.autoRotateSpeed = 0.6;   // turns slowly until someone touches it
  steuerung.mouseButtons = { LEFT: THREE.MOUSE.ROTATE, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: THREE.MOUSE.PAN };
  steuerung.touches = { ONE: THREE.TOUCH.ROTATE, TWO: THREE.TOUCH.DOLLY_PAN };
  renderer.domElement.addEventListener("contextmenu", (e) => e.preventDefault());
  steuerung.addEventListener("start", () => { steuerung.autoRotate = false; });
  steuerung.update();

  let sichtbar = true, laeuft = false, breit = 0, hoch = 0, start0 = false;
  const startPos = () => START.clone().multiplyScalar(breit && breit < hoch ? Math.min(1.8, Math.sqrt(hoch / breit) * 1.15) : 1);
  const pp = new THREE.Vector3();
  function groesse() {
    const w = box.clientWidth, h = box.clientHeight;
    if (!w || !h || (w === breit && h === hoch)) return;
    breit = w; hoch = h; renderer.setSize(w, h); kamera.aspect = w / h; kamera.updateProjectionMatrix();
    // far enough out that the whole map fits, also on a narrow phone screen
    const halb = Math.atan(Math.tan(THREE.MathUtils.degToRad(kamera.fov / 2)) * Math.min(1, kamera.aspect));
    steuerung.maxDistance = Math.max(groesseKarte * 1.05, groesseKarte * 0.55 / Math.tan(halb));
    if (!start0) { start0 = true; if (w < h) { kamera.position.copy(startPos()); steuerung.update(); } }   // narrow phone: step back so the camp fits
  }
  function bild() {
    if (!sichtbar) { laeuft = false; return; }
    requestAnimationFrame(bild);
    groesse();
    // only the edge of the map stops the centre (moving the camera with it, so nothing jumps); otherwise it stays where it was left
    const t = steuerung.target;
    steuerung.update();
    const rx = Math.max(RAND.x0, Math.min(RAND.x1, t.x)), rz = Math.max(RAND.z0, Math.min(RAND.z1, t.z));
    if (rx !== t.x || rz !== t.z) { kamera.position.x += rx - t.x; kamera.position.z += rz - t.z; t.x = rx; t.z = rz; }
    const hy = test && test.festhalten ? t.y : bodenHoehe(t.x, t.z), dy = hy - t.y;   // the centre follows the ground (smoothly, the camera with it)
    if (Math.abs(dy) > 0.01) { const k = Math.abs(dy) > 40 ? dy : dy * 0.15; t.y += k; kamera.position.y += k; }
    const abst = kamera.position.distanceTo(t);
    scene.fog.near = 120 + abst * 0.9; scene.fog.far = 330 + abst * 2.2;   // zoomed out you see the whole map
    const nah = Math.max(0.5, abst / 120);
    if (Math.abs(kamera.near - nah) > nah * 0.2) { kamera.near = nah; kamera.updateProjectionMatrix(); }
    lodAuffrischen(kamera.position);
    wasserZeit.value = performance.now() / 1000;
    renderer.render(scene, kamera);
    // labels in the order of the game's signs; one that would cover an earlier one stays hidden (zoom in to see it)
    const belegt = [];
    for (const x of schilder) {
      pp.copy(x.p).project(kamera);
      const sx = (pp.x + 1) / 2 * breit, sy = (1 - pp.y) / 2 * hoch, w = x.w || (x.w = x.el.offsetWidth || 80), h = 22;
      let weg = pp.z > 1 || Math.abs(pp.x) > 1.05 || Math.abs(pp.y) > 1.05;
      if (!weg) weg = belegt.some((b) => Math.abs(b[0] - sx) < (b[2] + w) / 2 + 2 && Math.abs(b[1] - sy) < h + 2);
      x.el.style.display = weg ? "none" : "";
      if (!weg) { belegt.push([sx, sy, w]); x.el.style.transform = `translate(${sx.toFixed(1)}px, ${sy.toFixed(1)}px) translate(-50%, -100%)`; }
    }
  }
  let test = null;   // headless screenshots only (?test): camera access, and "festhalten" keeps the centre's height
  try { if (new URLSearchParams(location.search).has("test")) test = window.zvFarmTest = { kamera, steuerung, scene, festhalten: false }; } catch (e) {}
  function zeigen(an) { sichtbar = an; if (an && !laeuft) { laeuft = true; requestAnimationFrame(bild); } }
  zeigen(true);
  return {
    zeigen,
    zuruecksetzen() { kamera.position.copy(startPos()); steuerung.target.copy(ZIEL); steuerung.autoRotate = true; steuerung.update(); },
    namen(an) { ebene.hidden = !an; },
  };
}
