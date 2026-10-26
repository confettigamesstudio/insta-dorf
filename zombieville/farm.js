// Zombieville website, tab "Farm" (Thomas 26.10.2026): the game's world as a 3D map to turn and zoom - only a view, no game.
// The world comes from daten/zombieville_farm.json, written before every publish by Webseite/zombieville_farm_export.mjs from the
// game's own level code, so this map always follows the game ("alles immer in einem Zug"). It uses the same glb models
// (zombieville/spiel/modelle/*.glb), the same ground textures and shader, and the game's signs as labels. No game code is loaded.
import * as THREE from "three";
import { OrbitControls } from "../lib/OrbitControls.js";
import { GLTFLoader } from "./spiel/lib/GLTFLoader.js";

const START = new THREE.Vector3(30, 30, 44);
const ZIEL = new THREE.Vector3(0, 0, 0);
const MAX_WEG = 120;   // how far the centre may move (the road leads ~240 m south to the petrol station)

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
  const kamera = new THREE.PerspectiveCamera(45, 1, 0.5, 900);
  kamera.position.copy(START);

  // placements: 10 numbers each (position, quaternion, scale) -> one instanced mesh per model
  const m4 = new THREE.Matrix4(), p = new THREE.Vector3(), q = new THREE.Quaternion(), s = new THREE.Vector3();
  const setzen = (geo, mat, f) => {
    const n = f.length / 10, im = new THREE.InstancedMesh(geo, mat, n);
    for (let i = 0; i < n; i++) { const o = i * 10; im.setMatrixAt(i, m4.compose(p.set(f[o], f[o + 1], f[o + 2]), q.set(f[o + 3], f[o + 4], f[o + 5], f[o + 6]), s.set(f[o + 7], f[o + 8], f[o + 9]))); }
    im.computeBoundingSphere(); im.matrixAutoUpdate = false; scene.add(im);
  };
  for (const [k, b] of Object.entries(D.modelle)) { const g = geos.get(k); if (g) setzen(g, MATERIAL, ausB64(b, Float32Array)); }

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
  // meshes the game builds in code (ground, roads, block buildings)
  for (const e of D.eigene) {
    const g = new THREE.BufferGeometry();
    for (const [n, w] of Object.entries(e.attr)) if (n !== "index") g.setAttribute(n, new THREE.BufferAttribute(ausB64(w[1], Float32Array), w[0]));
    if (e.attr.index) g.setIndex(new THREE.BufferAttribute(ausB64(e.attr.index, Uint32Array), 1));
    g.computeVertexNormals();
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

  const steuerung = new OrbitControls(kamera, renderer.domElement);
  steuerung.target.copy(ZIEL);
  steuerung.enableDamping = true; steuerung.dampingFactor = 0.08;
  steuerung.minDistance = 10; steuerung.maxDistance = 260; steuerung.maxPolarAngle = 1.38;
  steuerung.screenSpacePanning = false;
  steuerung.autoRotate = true; steuerung.autoRotateSpeed = 0.6;   // turns slowly until someone touches it
  steuerung.touches = { ONE: THREE.TOUCH.ROTATE, TWO: THREE.TOUCH.DOLLY_PAN };
  steuerung.addEventListener("start", () => { steuerung.autoRotate = false; });
  steuerung.update();

  let sichtbar = true, laeuft = false, breit = 0, hoch = 0, start0 = false;
  const startPos = () => START.clone().multiplyScalar(breit && breit < hoch ? Math.min(1.8, Math.sqrt(hoch / breit) * 1.15) : 1);
  const pp = new THREE.Vector3();
  function groesse() {
    const w = box.clientWidth, h = box.clientHeight;
    if (!w || !h || (w === breit && h === hoch)) return;
    breit = w; hoch = h; renderer.setSize(w, h); kamera.aspect = w / h; kamera.updateProjectionMatrix();
    if (!start0) { start0 = true; if (w < h) { kamera.position.copy(startPos()); steuerung.update(); } }   // narrow phone: step back so the camp fits
  }
  function bild() {
    if (!sichtbar) { laeuft = false; return; }
    requestAnimationFrame(bild);
    groesse();
    steuerung.update();
    const t = steuerung.target, d = Math.hypot(t.x, t.z);
    if (d > MAX_WEG) { t.x *= MAX_WEG / d; t.z *= MAX_WEG / d; }
    t.y = 0;
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
  function zeigen(an) { sichtbar = an; if (an && !laeuft) { laeuft = true; requestAnimationFrame(bild); } }
  zeigen(true);
  return {
    zeigen,
    zuruecksetzen() { kamera.position.copy(startPos()); steuerung.target.copy(ZIEL); steuerung.autoRotate = true; steuerung.update(); },
    namen(an) { ebene.hidden = !an; },
  };
}
