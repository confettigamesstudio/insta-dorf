// Zombieville website, tab "Farm" (Thomas 26.10.2026): the farm camp as a 3D map to turn and zoom - only a view, no game.
// Reuses the browser game's models (zombieville/spiel/modelle/camp|natur|dinge.glb, same files, no copies) but NOT its code:
// the game is still switched off, so this is a lean own view. Layout = the game's level (spiel/js/welt.js, state 26.10.2026):
// 44 x 32 m fence ring, barn gate to the south (+z), road to the south, forest ring around the meadow.
// Missing models are skipped, so a newer camp.glb from the game never breaks this page.
import * as THREE from "three";
import { OrbitControls } from "../lib/OrbitControls.js";
import { GLTFLoader } from "./spiel/lib/GLTFLoader.js";

const W2 = 22, D2 = 16, SEG = 2.5, WALD_A = 52, WALD_B = 46;
const ROAD = [[0, 16], [0.3, 24], [0.4, 32], [-2.5, 44], [-8, 56], [-14, 68], [-17, 84], [-18, 110]];
const PFADE = [[[0, 16], [0, -4]], [[-10, -3.5], [2, -3.5]], [[0, -1], [16, -1]]];
// labels on the map (x, z of the model); "Lagerhaus" only shows once the game's camp.glb has one
const NAMEN = [["Farmhaus", "Farmhaus"], ["Scheune", "Scheune"], ["Lagerhaus", "Lagerhaus"], ["Werkbank", "Werkbank"], ["Brunnen", "Brunnen"],
  ["Lagerfeuer", "Lagerfeuer"], ["Scheunentor", "Tor"], ["Wachturm", "Wachturm"]];
const START = new THREE.Vector3(30, 30, 44);

const lin = (r, g, b) => new THREE.Color().setRGB(r, g, b);
const FARBE = { wiese: lin(0.46, 0.52, 0.24), wieseHell: lin(0.55, 0.62, 0.28), wieseDunkel: lin(0.36, 0.45, 0.20), wieseGelb: lin(0.62, 0.60, 0.30),
  erde: lin(0.42, 0.32, 0.20), erdeHell: lin(0.52, 0.41, 0.27), erdeDunkel: lin(0.36, 0.28, 0.19), weg: lin(0.50, 0.40, 0.27), wegHell: lin(0.62, 0.50, 0.34) };

function rng(seed) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
function distPoly(x, z, poly) {
  let best = 1e9;
  for (let i = 0; i < poly.length - 1; i++) {
    const [ax, az] = poly[i], [bx, bz] = poly[i + 1], vx = bx - ax, vz = bz - az;
    const t = Math.max(0, Math.min(1, ((x - ax) * vx + (z - az) * vz) / (vx * vx + vz * vz)));
    best = Math.min(best, Math.hypot(x - ax - vx * t, z - az - vz * t));
  }
  return best;
}
const imCamp = (x, z, rand) => Math.abs(x) < W2 + rand && Math.abs(z) < D2 + rand;
const wald = (x, z) => (x / WALD_A) ** 2 + (z / WALD_B) ** 2;

// start(container, status) -> {zeigen(an), zuruecksetzen(), namen(an)}
export async function start(box, status) {
  const mobil = matchMedia("(pointer: coarse)").matches;
  const MATERIAL = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true });
  const loader = new GLTFLoader();
  const basis = new URL("./spiel/modelle/", import.meta.url).href;
  let geladen = 0;
  const lade = (n) => loader.loadAsync(basis + n + ".glb").then((g) => {
    g.scene.traverse((o) => { if (o.isMesh) { o.material = MATERIAL; o.geometry.computeBoundingBox(); } });
    status("Lade die Farm … " + Math.round(++geladen / 3 * 100) + " %");
    return g.scene;
  });
  const [camp, natur, dinge] = await Promise.all([lade("camp"), lade("natur"), lade("dinge")]);
  const vorlage = (g, n) => g.getObjectByName(n);

  const renderer = new THREE.WebGLRenderer({ antialias: (devicePixelRatio || 1) < 2, powerPreference: "high-performance" });
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, mobil ? 1.6 : 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  box.prepend(renderer.domElement);
  const scene = new THREE.Scene();
  const HIMMEL = new THREE.Color("#c3cfc9");
  scene.background = HIMMEL;
  scene.fog = new THREE.Fog(HIMMEL, 70, 170);
  scene.add(new THREE.HemisphereLight("#fff8e8", "#58613f", 1.9));
  const sonne = new THREE.DirectionalLight("#fff0d6", 1.6); sonne.position.set(-40, 80, 30); scene.add(sonne);
  const glut = new THREE.PointLight("#ff8a3a", 6, 9, 1.6); glut.position.set(-8, 1.0, 4.5); scene.add(glut);
  const kamera = new THREE.PerspectiveCamera(45, 1, 0.5, 400);
  kamera.position.copy(START);

  const R = rng(26102026), m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), v = new THREE.Vector3(), s3 = new THREE.Vector3(), yAchse = new THREE.Vector3(0, 1, 0);

  // ground: soft meadow patches, earth inside the camp, darker under the forest
  {
    const G = 260, N = 80, c = G / N, pos = [], col = [], idx = [], f = new THREE.Color(), e = new THREE.Color();
    const rausch = (x, z) => Math.sin(x * 0.09 + Math.sin(z * 0.06) * 2.2) * 0.6 + Math.cos(z * 0.11 - x * 0.04) * 0.5 + Math.sin((x + z) * 0.23) * 0.25;
    for (let i = 0; i <= N; i++) for (let j = 0; j <= N; j++) {
      const x = -G / 2 + i * c, z = -G / 2 + j * c, n = rausch(x, z);
      if (n > 0.55) f.copy(FARBE.wiese).lerp(FARBE.wieseGelb, Math.min(1, (n - 0.55) * 1.6));
      else if (n < -0.35) f.copy(FARBE.wiese).lerp(FARBE.wieseDunkel, Math.min(1, (-0.35 - n) * 1.8));
      else f.copy(FARBE.wiese).lerp(FARBE.wieseHell, Math.max(0, 0.3 - Math.abs(n - 0.1)) * 2);
      const w = wald(x, z);
      if (w > 1.05) f.lerp(FARBE.wieseDunkel, Math.min(1, (w - 1.05) * 2.5) * 0.8);
      const lager = Math.max(0, Math.min(1, Math.min(W2 + 0.6 - Math.abs(x), D2 + 0.6 - Math.abs(z)) / 1.2));
      if (lager > 0) { e.copy(FARBE.erde).lerp(n > 0.2 ? FARBE.erdeHell : FARBE.erdeDunkel, Math.min(1, Math.abs(n - 0.2)) * 0.6); f.lerp(e, lager); }
      pos.push(x, 0, z); col.push(f.r, f.g, f.b);
    }
    for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) { const a = i * (N + 1) + j, b = a + N + 1; idx.push(a, a + 1, b, b, a + 1, b + 1); }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute("color", new THREE.Float32BufferAttribute(col, 3));
    g.setIndex(idx); g.computeVertexNormals();
    scene.add(new THREE.Mesh(g, MATERIAL));
  }
  // road + camp paths as flat ribbons
  {
    const pos = [], col = [];
    const band = (poly, breite, y, f) => {
      for (let i = 0; i < poly.length - 1; i++) {
        const [ax, az] = poly[i], [bx, bz] = poly[i + 1], l = Math.hypot(bx - ax, bz - az), nx = -(bz - az) / l * breite / 2, nz = (bx - ax) / l * breite / 2;
        const ex = (bx - ax) / l * breite * 0.25, ez = (bz - az) / l * breite * 0.25;
        const p = [ax - nx - ex, az - nz - ez, ax + nx - ex, az + nz - ez, bx - nx + ex, bz - nz + ez, bx + nx + ex, bz + nz + ez];
        pos.push(p[0], y, p[1], p[2], y, p[3], p[4], y, p[5], p[4], y, p[5], p[2], y, p[3], p[6], y, p[7]);
        for (let k = 0; k < 6; k++) col.push(f.r, f.g, f.b);
      }
    };
    band(ROAD, 4.6, 0.03, FARBE.weg);
    for (const p of PFADE) band(p, 3.0, 0.035, FARBE.wegHell);
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute("color", new THREE.Float32BufferAttribute(col, 3));
    g.computeVertexNormals();
    scene.add(new THREE.Mesh(g, MATERIAL));
  }

  // camp buildings (positions as in the game)
  const orte = {};
  const stelle = (name, x, z, grad) => {
    const t = vorlage(camp, name); if (!t) return null;
    const o = t.clone(true);
    o.position.set(x, 0, z); o.rotation.set(0, grad * Math.PI / 180, 0);
    scene.add(o);
    if (!orte[name]) orte[name] = o;
    return o;
  };
  {
    const teile = { Zaun_A: [], Zaun_B: [], Zaun_C: [], Zaun_Ecke: [] };
    const linie = (a, b, tor) => { const n = Math.round((b - a) / SEG), r = []; for (let i = 0; i < n; i++) { const c = a + (i + 0.5) * SEG; if (tor && Math.abs(c) < 2.4) continue; r.push(c); } return r; };
    const variante = () => (R() < 0.25 ? "Zaun_B" : R() < 0.2 ? "Zaun_C" : "Zaun_A");
    for (const c of linie(-W2, W2, true)) teile[variante()].push([c, D2, 0]);
    for (const c of linie(-W2, W2)) teile[variante()].push([c, -D2, 180]);
    for (const c of linie(-D2, D2)) { teile[variante()].push([-W2, -c, 90]); teile[R() < 0.66 ? "Zaun_A" : "Zaun_B"].push([W2, -c, -90]); }
    for (const x of [-W2, W2]) for (const z of [-D2, D2]) teile.Zaun_Ecke.push([x, z, z > 0 ? 0 : 180]);
    for (const [n, l] of Object.entries(teile)) {
      const t = vorlage(camp, n); if (!t || !t.geometry || !l.length) continue;
      const im = new THREE.InstancedMesh(t.geometry, MATERIAL, l.length);
      l.forEach(([x, z, g], i) => { q.setFromAxisAngle(yAchse, g * Math.PI / 180); im.setMatrixAt(i, m4.compose(v.set(x, 0, z), q, s3.set(1, 1, 1))); });
      im.computeBoundingSphere(); scene.add(im);
    }
  }
  stelle("Scheunentor", 0, D2, 0);
  for (const x of [-5.5, 5.5]) stelle("Spitzpfaehle", x, D2 + 2.8, 0);
  stelle("Wachturm", -W2 + 2.2, D2 - 2.2, 20); stelle("Wachturm", W2 - 2.2, -D2 + 2.2, 200);
  stelle("Farmhaus", -9.5, -9, 0); stelle("Scheune", 12, -10, 0); stelle("Windrad", 19, -2, 0);
  stelle("Brunnen", 1.5, -5.5, 0); stelle("Traktor", 4.5, -12.5, 160); stelle("Strohballen", 6.5, -7, 20);
  for (const [x, z, g, n] of [[-15, 4, 70, "Zelt_Gruen"], [-14.5, 9, 100, "Zelt_Orange"], [-10.5, 11.5, 140, "Zelt_Gruen"], [-17, -1, 40, "Zelt_Orange"]]) stelle(n, x, z, g);
  stelle("Lagerfeuer", -8, 4.5, 0); stelle("Holzstapel", -2.5, -0.5, 0); stelle("Vorraete", -3, -7, 0);
  stelle("Werkbank", -2, -11.5, 0); stelle("Generator", -4.2, -12.5, 30);
  for (let i = 0; i < 3; i++) stelle("Beet", 9, 4 + i * 2.4, 0);
  stelle("Maisfeld", 16, 8.5, 0); stelle("Vogelscheuche", 16, 12, 15);
  stelle("Ortsschild", 3.6, 40, -15); stelle("Autowrack", -5.5, 50, 35);
  { const z = vorlage(dinge, "Zielscheibe"); if (z) { const o = z.clone(); o.position.set(20, 0, 3.6); o.rotation.y = -Math.PI / 2; o.scale.setScalar(1.3); scene.add(o); } }

  // vegetation: forest ring around the meadow, a few trees, bushes and rocks on the fields, grass tufts
  const sorten = {};
  const setze = (art, x, z, sk) => {
    const n = { Tanne: 3, Laub: 4, Tot: 2, Busch: 3, Gras: 3, Blume: 3, Stein: 3 }[art];
    const name = art + "_" + Math.floor(R() * n);
    (sorten[name] = sorten[name] || []).push([x, z, R() * Math.PI * 2, sk]);
  };
  const frei = (x, z, rand) => !imCamp(x, z, rand) && distPoly(x, z, ROAD) > rand + 2.2;
  for (let i = 0; i < (mobil ? 1100 : 1500); i++) {
    const x = (R() * 2 - 1) * 112, z = (R() * 2 - 1) * 104, e = wald(x, z);
    if (e < 1 || e > 2.25 || !frei(x, z, 3) || (e < 1.4 && R() < 0.5)) continue;
    setze(R() < 0.62 ? "Tanne" : R() < 0.92 ? "Laub" : "Tot", x, z, 0.85 + R() * 0.5);
  }
  for (let i = 0; i < 90; i++) {
    const x = (R() * 2 - 1) * 50, z = (R() * 2 - 1) * 45;
    if (wald(x, z) > 1 || !frei(x, z, 5)) continue;
    const r = R(), sk = 0.8 + R() * 0.4;
    setze(r < 0.35 ? "Laub" : r < 0.5 ? "Tanne" : r < 0.6 ? "Tot" : r < 0.85 ? "Busch" : "Stein", x, z, sk);
  }
  for (let i = 0; i < 26; i++) { const a = R() * Math.PI * 2, e = 0.82 + R() * 0.16; setze("Busch", Math.cos(a) * WALD_A * e, Math.sin(a) * WALD_B * e, 0.8 + R() * 0.4); }
  for (let i = 0; i < (mobil ? 600 : 1000); i++) {
    const x = (R() * 2 - 1) * 60, z = (R() * 2 - 1) * 56;
    if (wald(x, z) > 1.25 || imCamp(x, z, -0.5) || distPoly(x, z, ROAD) < 2.0) continue;
    setze(R() < 0.08 ? "Blume" : "Gras", x, z, 0.8 + R() * 0.7);
  }
  for (const [name, liste] of Object.entries(sorten)) {
    const t = vorlage(natur, name); if (!t || !t.geometry) continue;
    const im = new THREE.InstancedMesh(t.geometry, MATERIAL, liste.length);
    liste.forEach(([x, z, rot, sk], i) => { q.setFromAxisAngle(yAchse, rot); im.setMatrixAt(i, m4.compose(v.set(x, 0, z), q, s3.set(sk, sk * (0.9 + R() * 0.25), sk))); });
    im.computeBoundingSphere(); scene.add(im);
  }
  scene.updateMatrixWorld(true);
  scene.traverse((o) => { o.matrixAutoUpdate = false; });

  // labels: small HTML signs above the buildings
  const ebene = document.createElement("div"); ebene.className = "zv-farm-namen"; box.append(ebene);
  const schilder = [];
  for (const [modell, text] of NAMEN) {
    const o = orte[modell]; if (!o) continue;
    const bb = new THREE.Box3().setFromObject(o);
    const el = document.createElement("span"); el.className = "zv-farm-name"; el.textContent = text; ebene.append(el);
    schilder.push({ el, p: new THREE.Vector3((bb.min.x + bb.max.x) / 2, bb.max.y + 0.4, (bb.min.z + bb.max.z) / 2) });
  }

  const steuerung = new OrbitControls(kamera, renderer.domElement);
  steuerung.target.set(0, 0, -1);
  steuerung.enableDamping = true; steuerung.dampingFactor = 0.08;
  steuerung.minDistance = 10; steuerung.maxDistance = 120; steuerung.maxPolarAngle = 1.38;
  steuerung.screenSpacePanning = false;
  steuerung.autoRotate = true; steuerung.autoRotateSpeed = 0.6;   // turns slowly until someone touches it
  steuerung.touches = { ONE: THREE.TOUCH.ROTATE, TWO: THREE.TOUCH.DOLLY_PAN };
  steuerung.addEventListener("start", () => { steuerung.autoRotate = false; });
  steuerung.update();

  let sichtbar = true, laeuft = false, breit = 0, hoch = 0;
  const p = new THREE.Vector3();
  function groesse() {
    const w = box.clientWidth, h = box.clientHeight;
    if (!w || !h || (w === breit && h === hoch)) return;
    breit = w; hoch = h; renderer.setSize(w, h); kamera.aspect = w / h; kamera.updateProjectionMatrix();
  }
  function bild() {
    if (!sichtbar) { laeuft = false; return; }
    requestAnimationFrame(bild);
    groesse();
    steuerung.update();
    // keep the view on the farm: the centre may move a bit, but not away into the forest
    const t = steuerung.target, d = Math.hypot(t.x, t.z);
    if (d > 40) { t.x *= 40 / d; t.z *= 40 / d; }
    t.y = 0;
    renderer.render(scene, kamera);
    for (const s of schilder) {
      p.copy(s.p).project(kamera);
      const weg = p.z > 1 || Math.abs(p.x) > 1.05 || Math.abs(p.y) > 1.05;
      s.el.style.display = weg ? "none" : "";
      if (!weg) s.el.style.transform = `translate(${((p.x + 1) / 2 * breit).toFixed(1)}px, ${((1 - p.y) / 2 * hoch).toFixed(1)}px) translate(-50%, -100%)`;
    }
  }
  function zeigen(an) { sichtbar = an; if (an && !laeuft) { laeuft = true; requestAnimationFrame(bild); } }
  zeigen(true);
  return {
    zeigen,
    zuruecksetzen() { kamera.position.copy(START); steuerung.target.set(0, 0, -1); steuerung.autoRotate = true; steuerung.update(); },
    namen(an) { ebene.hidden = !an; },
  };
}
