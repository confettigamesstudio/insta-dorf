// The village in 3D (Thomas 24.10.2026): the models Unity exported (Webseite/dorf3d_export.py -> daten/3d/), each one once and
// placed many times (instancing), on the top-down map picture as ground; the villagers as small figures in their shirt colour.
// Drag to turn, two fingers / right mouse to move, pinch / wheel to zoom; a tap on a house or a figure calls back into app.js.
import * as THREE from "./three.module.min.js";
import { OrbitControls } from "./OrbitControls.js";

// buildings without a house of their own: a tap lists who works there (the model names from the Unity export)
const GEBAEUDE = { Baeckerei: "Bäckerei", Konditorei: "Konditorei", Metzgerei: "Metzgerei", Brauerei: "Brauerei", Gasthaus: "Gasthaus", Schmiede: "Schmiede",
  Werkstatt: "Werkstatt", Schreinerei: "Schreinerei", Schneiderei: "Schneiderei", Gefaengnis: "Gefängnis", Militaer: "Militärbasis", Schwimmbad: "Heiße Quellen",
  Forschung: "Forschungskomplex", Bergwerk: "Bergwerk", Mine: "Mine", Krankenhaus: "Krankenhaus", Schule: "Schule", Festplatz: "Theater", Lagerplatz: "Lager",
  Lagererweiterung: "Lager", Wassermuehle: "Wassermühle", Turm: "Windmühle", Fluegel: "Windmühle", Bauernhof: "Bauernhof", Koppel: "Pferdekoppel",
  Gemuesegarten: "Gemüsegarten", Marktstaende: "Markt", Brunnen: "Brunnen", Lagerfeuer: "Lagerfeuer", Baustelle: "Baustelle", Rathaus: "Rathaus" };

export async function start(box, karte, onPick, onProgress, opts = {}) {
  // every replayable day has its own village (houses, map picture, replay); the newest posted day lies directly in daten/3d/
  const tage = karte.verlaufTage || [], neuester = tage.length ? tage[tage.length - 1] : null;
  const tag = opts.tag && opts.tag !== neuester && tage.includes(opts.tag) ? opts.tag : neuester;
  const base = tag && tag !== neuester ? "daten/3d/tag" + tag + "/" : "daten/3d/";
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
  const groundTex = loader.load(base === "daten/3d/" ? karte.bild : base + "karte.webp");
  groundTex.colorSpace = THREE.SRGBColorSpace;
  groundTex.anisotropy = renderer.capabilities.getMaxAnisotropy();
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(W, D), new THREE.MeshLambertMaterial({ map: groundTex }));
  ground.rotation.x = -Math.PI / 2;
  ground.position.set((karte.x0 + karte.x1) / 2, -0.05, -(karte.z0 + karte.z1) / 2);
  scene.add(ground);

  // the river on top of the map picture: a shiny water surface whose ripples flow downstream (fluss.json: the wet span every 5 m)
  let wasser = null;
  try {
    const fl = await (await fetch("daten/3d/fluss.json", { cache: "no-cache" })).json();
    const pos = [], uv = [], idx = [];
    fl.forEach(([gz, lo, hi], k) => {
      pos.push(lo - 0.6, 0.06, -gz, hi + 0.6, 0.06, -gz); uv.push(0, gz / 9, 1, gz / 9);
      if (k > 0 && Math.abs(fl[k - 1][0] - gz) <= 5.01) { const a = (k - 1) * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
    });
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3)); geo.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2)); geo.setIndex(idx);
    geo.computeVertexNormals();
    const cv = document.createElement("canvas"); cv.width = cv.height = 128; const k2 = cv.getContext("2d");
    k2.fillStyle = "#3f9fe0"; k2.fillRect(0, 0, 128, 128);
    for (let i = 0; i < 70; i++) {   // light ripples
      k2.strokeStyle = `rgba(255,255,255,${0.15 + Math.random() * 0.35})`; k2.lineWidth = 1 + Math.random() * 2;
      const x = Math.random() * 128, y = Math.random() * 128, w = 8 + Math.random() * 22;
      k2.beginPath(); k2.moveTo(x, y); k2.quadraticCurveTo(x + w / 2, y - 3, x + w, y); k2.stroke();
    }
    const tex = new THREE.CanvasTexture(cv); tex.wrapS = tex.wrapT = THREE.RepeatWrapping; tex.colorSpace = THREE.SRGBColorSpace;
    wasser = new THREE.Mesh(geo, new THREE.MeshPhongMaterial({ map: tex, color: "#ffffff", specular: "#e8f6ff", shininess: 90, transparent: true, opacity: 0.9 }));
    wasser.renderOrder = 1; scene.add(wasser);
  } catch (e) { /* no river data: the map picture shows it */ }

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
    else if (GEBAEUDE[m.name]) { im.userData.gebaeude = GEBAEUDE[m.name]; g.computeBoundingBox(); pickables.push(im); }   // workshops, prison, mine ...
  }

  // the villagers: a capsule each in the shirt colour, a skin-coloured head on top
  const F = info.figuren || [];
  let body = null, head = null;
  if (F.length) {
    body = new THREE.InstancedMesh(new THREE.CapsuleGeometry(0.34, 0.75, 3, 8), new THREE.MeshLambertMaterial({ flatShading: true }), F.length);
    head = new THREE.InstancedMesh(new THREE.SphereGeometry(0.3, 10, 8), new THREE.MeshLambertMaterial({ color: "#f2c7a5", flatShading: true }), F.length);
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

  // ---------------------------------------------------------------- the day replay (verlauf_export.py, Thomas 25.10.2026):
  // Unity played the posted day and wrote down every figure once per game minute: where it walks on the ways, where it faces,
  // what it does (animation code) and a line of text. Play runs 06:00-24:00 in about two and a half minutes; the figures are the
  // game's capsule figures in the look of their profession (looks.json), with name tags close to the camera; a tap follows one.
  let V = null, folge = null;
  if (opts.verlauf) {
    try {
      const vj = await (await fetch(base + "verlauf.json", { cache: "no-cache" })).json();
      const vgz = await fetch(base + "verlauf.bin.gz", { cache: "no-cache" });
      const vb = new DataView(await new Response(vgz.body.pipeThrough(new DecompressionStream("gzip"))).arrayBuffer());
      let looks = {};
      try { looks = await (await fetch(base + "looks.json", { cache: "no-cache" })).json(); } catch (e) { /* plain figures */ }
      V = { j: vj, b: vb, n: vj.ids.length, t: 0, play: false, looks };
    } catch (e) { V = null; }
  }
  const uhr = (k) => { const m = V.j.t0 + k * V.j.dt; return String(Math.floor(m / 60) % 24).padStart(2, "0") + ":" + String(Math.floor(m % 60)).padStart(2, "0"); };
  let ui = null, ring = null, leute = null, namenBox = null;
  if (V) {
    if (body) { scene.remove(body, head); pickables.splice(pickables.indexOf(body), 2); }   // the still figures make way for the walking ones
    ui = document.createElement("div"); ui.className = "verlauf";
    ui.innerHTML = '<button type="button" class="verlauf-play" aria-label="Abspielen">▶</button>'
      + (tage.length > 1 ? '<select class="verlauf-tag" aria-label="Tag">' + tage.map((t) => '<option value="' + t + '"' + (t === tag ? " selected" : "") + ">Tag " + t + "</option>").join("") + "</select>" : "")
      + '<input type="range" min="0" max="' + (V.j.proben - 1) + '" step="0.01" value="0" aria-label="Uhrzeit"><span class="verlauf-uhr">06:00</span>';
    ui.insertAdjacentHTML("beforeend", '<button type="button" class="verlauf-ereignisse-knopf">Ereignisse</button>');
    const liste = document.createElement("div"); liste.className = "verlauf-liste"; liste.hidden = true;
    const ticker = document.createElement("div"); ticker.className = "verlauf-ticker";
    box.append(liste, ticker); ui.liste = liste; ui.ticker = ticker;
    // several lines of the same kind in the same minute (eight bears at 10:00) become one entry
    const evs = [];
    for (const e of (V.j.ereignisse || []).filter((x) => x.m >= V.j.t0)) {
      const vorher = evs[evs.length - 1];
      if (vorher && vorher.m === e.m && !e.k && !vorher.k && vorher.t.slice(0, 14) === e.t.slice(0, 14)) { vorher.mehr = (vorher.mehr || 0) + 1; continue; }
      evs.push({ ...e });
    }
    for (const e of evs) if (e.mehr) e.t += " (und " + e.mehr + " weitere)";
    const zeitText = (m) => String(Math.floor(m / 60) % 24).padStart(2, "0") + ":" + String(m % 60).padStart(2, "0");
    liste.innerHTML = evs.length ? "" : "<p>An diesem Tag gab es keine besonderen Ereignisse.</p>";
    for (const e of evs) {
      const b = document.createElement("button"); b.type = "button"; b.className = e.k ? "kopf" : "";
      b.innerHTML = "<b>" + zeitText(e.m) + "</b> "; b.append(document.createTextNode(e.t));
      b.onclick = () => {   // jump to the time, fly to the place
        V.t = Math.max(0, Math.min(V.j.proben - 1, (e.m - V.j.t0) / V.j.dt - 2)); V.gezeigt = new Set(evs.filter((x) => x.m < e.m));
        folge = null; ui.info.hidden = true; liste.hidden = true;
        if (e.x != null) { controls.target.set(e.x, 0, e.z); camera.position.set(e.x + 22, 38, e.z + 34); }
        dirty = true;
      };
      liste.append(b);
    }
    ui.querySelector(".verlauf-ereignisse-knopf").onclick = () => { liste.hidden = !liste.hidden; };
    V.evs = evs; V.gezeigt = new Set();
    const wahl = ui.querySelector("select");
    if (wahl) wahl.onchange = () => opts.onTag && opts.onTag(+wahl.value);
    const info = document.createElement("div"); info.className = "verlauf-info"; info.hidden = true;
    namenBox = document.createElement("div"); namenBox.className = "verlauf-namen";
    box.append(namenBox, ui, info); ui.info = info;
    const knopf = ui.querySelector("button"), regler = ui.querySelector("input");
    knopf.onclick = () => { V.play = !V.play; knopf.textContent = V.play ? "❚❚" : "▶"; if (V.t >= V.j.proben - 1.01) V.t = 0; dirty = true; };
    regler.oninput = () => { V.t = +regler.value; dirty = true; };
    ui.regler = regler;
    if (opts.verlaufStart != null) V.t = Math.max(0, Math.min(V.j.proben - 1, (opts.verlaufStart - V.j.t0) / V.j.dt));
    if (opts.verlaufFolge != null) folge = opts.verlaufFolge;
    if (opts.verlaufOrt) { const [ox, oz] = opts.verlaufOrt; V.ortStart = [ox, oz]; }   // ?ort=x,z (three.js coordinates): look there, like a click in the event list
    if (opts.verlaufPlay) { V.play = true; knopf.textContent = "❚❚"; }
    ring = new THREE.Mesh(new THREE.RingGeometry(0.9, 1.3, 24), new THREE.MeshBasicMaterial({ color: "#e7b64a", side: THREE.DoubleSide, depthTest: false }));
    ring.rotation.x = -Math.PI / 2; ring.renderOrder = 6; ring.visible = false; scene.add(ring);
    leute = figurenBauen(V);
    // start close on the middle of the village: market, store and theatre in view
    controls.target.set(-95, 0, -25); camera.position.set(-70, 70, 45);
    if (V.ortStart) { controls.target.set(V.ortStart[0], 0, V.ortStart[1]); camera.position.set(V.ortStart[0] + 22, 38, V.ortStart[1] + 34); }
  }

  // the capsule figures: one instanced mesh per part (body, head, eyes, hands, every hat part, the tools)
  function figurenBauen(V) {
    const n = V.n, mat = (c) => new THREE.MeshLambertMaterial({ color: c, flatShading: true });
    const teil = (geo, farbe, eigen) => { const m = new THREE.InstancedMesh(geo, mat(eigen ? "#ffffff" : farbe), n); m.frustumCulled = false; m.count = n; scene.add(m); return m; };
    const T = {
      body: teil(new THREE.CapsuleGeometry(0.42, 0.9, 4, 10), null, true),
      head: teil(new THREE.SphereGeometry(0.34, 12, 10), null, true),
      eye: teil(new THREE.SphereGeometry(0.055, 6, 4), "#1b1b1b"), eye2: teil(new THREE.SphereGeometry(0.055, 6, 4), "#1b1b1b"),
      hand: teil(new THREE.SphereGeometry(0.13, 8, 6), null, true), hand2: teil(new THREE.SphereGeometry(0.13, 8, 6), null, true),
      stiel: teil(new THREE.CylinderGeometry(0.045, 0.045, 1.1, 6), "#7a5230"), axt: teil(new THREE.BoxGeometry(0.08, 0.28, 0.34), "#9aa3ad"),
      hammer: teil(new THREE.BoxGeometry(0.16, 0.16, 0.36), "#6f6a64"), angel: teil(new THREE.CylinderGeometry(0.025, 0.03, 2.4, 5), "#7a5230"),
      topf: teil(new THREE.CylinderGeometry(0.32, 0.26, 0.38, 10), "#55524e"), gitarre: teil(new THREE.BoxGeometry(0.42, 0.62, 0.12), "#b5733a"),
      kolben: teil(new THREE.SphereGeometry(0.13, 8, 6), "#7fd3f0"), kiste: teil(new THREE.BoxGeometry(0.6, 0.45, 0.45), "#c69a63"),
    };
    T.body.userData.figures = V.j.ids; T.head.userData.figures = V.j.ids; pickables.push(T.body, T.head);
    // hats as in the walkable test page (HUT_VON maps the Blender hat names)
    const HUT_VON = { straw: "stroh", sombrero: "stroh", beanie: "muetze", chef: "koch", nurse: "koch", top: "zylinder", helmet: "helm", crown: "krone",
      cap: "kappe", police: "kappe", leather: "filz", green: "filz", witch: "hexe", wreath: "kranz" };
    const HUETE = {   // [geometry, own colour or null = the look's hat colour, default colour, y, extra transform]
      stroh: [[new THREE.CylinderGeometry(0.55, 0.55, 0.05, 14), null, "#e8c86a", 2.18], [new THREE.CylinderGeometry(0.26, 0.3, 0.22, 12), null, "#e8c86a", 2.3], [new THREE.CylinderGeometry(0.305, 0.305, 0.06, 12), "#d7403b", null, 2.22]],
      muetze: [[new THREE.SphereGeometry(0.36, 12, 8, 0, 6.3, 0, 1.6), null, "#3b82c4", 2.02], [new THREE.SphereGeometry(0.1, 8, 6), "#ffffff", null, 2.42]],
      zylinder: [[new THREE.CylinderGeometry(0.42, 0.42, 0.04, 14), null, "#222222", 2.18], [new THREE.CylinderGeometry(0.26, 0.26, 0.5, 14), null, "#222222", 2.44], [new THREE.CylinderGeometry(0.265, 0.265, 0.08, 14), "#d7403b", null, 2.25]],
      helm: [[new THREE.SphereGeometry(0.38, 12, 8, 0, 6.3, 0, 1.5), null, "#e7b64a", 2.0], [new THREE.CylinderGeometry(0.46, 0.46, 0.04, 14), null, "#e7b64a", 2.03]],
      koch: [[new THREE.CylinderGeometry(0.27, 0.25, 0.3, 12), null, "#ffffff", 2.28], [new THREE.SphereGeometry(0.33, 12, 8), null, "#ffffff", 2.5]],
      krone: [[new THREE.CylinderGeometry(0.3, 0.27, 0.22, 10), null, "#e7b64a", 2.24], ...[0, 1, 2, 3, 4].map((i) => [new THREE.ConeGeometry(0.07, 0.18, 4).translate(Math.cos(i * 1.256) * 0.24, 0, Math.sin(i * 1.256) * 0.24), null, "#e7b64a", 2.43])],
      kappe: [[new THREE.SphereGeometry(0.36, 12, 8, 0, 6.3, 0, 1.4), null, "#3b82c4", 2.02], [new THREE.BoxGeometry(0.4, 0.04, 0.3).translate(0, 0, 0.35), null, "#3b82c4", 2.12]],
      filz: [[new THREE.CylinderGeometry(0.5, 0.5, 0.04, 14), null, "#6b4a2e", 2.18], [new THREE.CylinderGeometry(0.24, 0.3, 0.26, 12), null, "#6b4a2e", 2.32]],
      hexe: [[new THREE.CylinderGeometry(0.52, 0.52, 0.04, 14), null, "#2b2320", 2.18], [new THREE.ConeGeometry(0.3, 0.8, 12), null, "#2b2320", 2.6]],
      kranz: [[new THREE.TorusGeometry(0.3, 0.07, 6, 14).rotateX(Math.PI / 2), null, "#3f8a3a", 2.15]],
    };
    const hutTeile = {};
    for (const [art, teile] of Object.entries(HUETE)) hutTeile[art] = teile.map(([geo, eigen, std, y]) => ({ m: teil(geo, eigen, !eigen), y, eigen, std }));
    // per figure: look, hat, colours
    const c = new THREE.Color(), F = [];
    for (let i = 0; i < n; i++) {
      const l = V.looks[V.j.berufe[i]] || {}, art = HUT_VON[l.h] || "";
      T.body.setColorAt(i, c.set(l.b || "#8a8f98")); T.head.setColorAt(i, c.set(l.s || "#f2c7a5"));
      T.hand.setColorAt(i, c.set(l.s || "#f2c7a5")); T.hand2.setColorAt(i, c.set(l.s || "#f2c7a5"));
      for (const [a2, teile] of Object.entries(hutTeile)) for (const tt of teile) if (!tt.eigen) tt.m.setColorAt(i, c.set(a2 === art ? (l.hc || tt.std) : "#ffffff"));
      F.push({ art, phase: (V.j.ids[i] * 0.618) % 1 * 6.28 });
    }
    for (const m of Object.values(T)) if (m.instanceColor) m.instanceColor.needsUpdate = true;
    for (const teile of Object.values(hutTeile)) for (const tt of teile) if (tt.m.instanceColor) tt.m.instanceColor.needsUpdate = true;
    return { T, hutTeile, F };
  }

  const R = 10;   // bytes per figure and sample: int16 x*10, int16 y*100, int16 z*10, int8 yaw, uint8 animation, uint16 text
  const lese = (k, i) => { const o = (k * V.n + i) * R; return [V.b.getInt16(o, true) / 10, V.b.getInt16(o + 2, true) / 100, V.b.getInt16(o + 4, true) / 10, V.b.getInt8(o + 6) / 127 * Math.PI, V.b.getUint8(o + 7), V.b.getUint16(o + 8, true)]; };
  const M = new THREE.Matrix4(), L = new THREE.Matrix4(), Q = new THREE.Quaternion(), E = new THREE.Euler(), P = new THREE.Vector3(), S = new THREE.Vector3(), NULL = new THREE.Matrix4().makeScale(0, 0, 0);
  const pos = new THREE.Vector3(), proj = new THREE.Vector3();
  const schilder = [];
  // place one part: figure matrix * local offset (+ local rotation)
  function setze(m, i, x, y, z, rx = 0, ry = 0, rz = 0, s = 1) {
    E.set(rx, ry, rz); Q.setFromEuler(E); P.set(x, y, z); S.set(s, s, s); L.compose(P, Q, S);
    m.setMatrixAt(i, L.premultiply(M));
  }
  function verlaufZeigen(jetzt) {
    const k0 = Math.floor(V.t), k1 = Math.min(V.j.proben - 1, k0 + 1), u = V.t - k0;
    const abstand = camera.position.distanceTo(controls.target);
    const gross = Math.min(2.4, Math.max(1, abstand / 70));   // far away: a bit bigger, still figures
    const { T, hutTeile, F } = leute;
    const zeit = jetzt / 1000, kandidaten = [];
    let gefunden = false;
    for (let i = 0; i < V.n; i++) {
      const a = lese(k0, i), b = lese(k1, i);
      let anim = u < 0.5 ? a[4] : b[4];
      const weg = !a[4] && !b[4] ? true : (anim === 0);
      const nehm = (all) => { for (const m of all) m.setMatrixAt(i, NULL); };
      if (weg) {   // indoors / asleep: gone
        nehm(Object.values(T)); for (const teile of Object.values(hutTeile)) for (const tt of teile) tt.m.setMatrixAt(i, NULL);
        continue;
      }
      const x = a[0] + (b[0] - a[0]) * u, y = a[1] + (b[1] - a[1]) * u, z = a[2] + (b[2] - a[2]) * u;
      let dy = b[3] - a[3]; if (dy > Math.PI) dy -= 2 * Math.PI; if (dy < -Math.PI) dy += 2 * Math.PI;
      const geht = (a[0] - b[0]) ** 2 + (a[2] - b[2]) ** 2 > 0.0025;   // 5 cm per minute: walking, less is jitter
      if (geht) anim = 2;
      const f = F[i], ph = zeit * 6 + f.phase;
      let yaw = a[3] + dy * u, hop = 0, lean = 0, roll = 0, liegt = false;
      let hl = [0.5, 0.92, 0.05], hr = [-0.5, 0.92, 0.05], tool = null, swing = 0, prop = null;
      switch (anim) {
        case 2: hop = Math.abs(Math.sin(ph * 1.6)) * 0.12; hl = [0.5, 0.92, Math.sin(ph * 1.6) * 0.25]; hr = [-0.5, 0.92, -Math.sin(ph * 1.6) * 0.25]; break;
        case 4: swing = Math.sin(ph * 1.2); lean = 0.18 * Math.max(0, swing); tool = "axt"; hr = [-0.3, 1.15 + swing * 0.2, 0.45]; hl = [0.15, 1.05 + swing * 0.2, 0.45]; break;
        case 5: swing = Math.sin(ph * 2.2); lean = 0.1 * Math.max(0, swing); tool = "hammer"; hr = [-0.35, 1.05 + swing * 0.15, 0.4]; break;
        case 3: hl = [0.35, 1.0 + Math.sin(ph * 2) * 0.1, 0.4]; hr = [-0.35, 1.0 - Math.sin(ph * 2) * 0.1, 0.4]; hop = Math.abs(Math.sin(ph)) * 0.03; break;
        case 6: tool = "angel"; hr = [-0.3, 1.1, 0.4]; hl = [0.1, 1.05, 0.45]; swing = Math.sin(ph * 0.5) * 0.06; break;
        case 7: lean = 0.35 + Math.sin(ph * 0.9) * 0.15; hl = [0.3, 0.75, 0.45]; hr = [-0.3, 0.75, 0.45]; break;
        case 8: { const m = Math.max(0, Math.sin(ph * 0.9)); hr = [-0.3, 0.95 + m * 0.75, 0.25 + m * 0.1]; break; }
        case 9: hop = Math.abs(Math.sin(ph * 2.4)) * 0.35; yaw += Math.sin(ph * 0.7) * 1.2; hl = [0.5, 1.9 + Math.sin(ph * 2.4) * 0.15, 0]; hr = [-0.5, 1.9 - Math.sin(ph * 2.4) * 0.15, 0]; break;
        case 10: liegt = true; break;
        case 12: { const g = Math.sin(ph * 1.4); lean = 0.65 + g * 0.08; hl = [0.3, 0.55 + Math.max(0, g) * 0.25, 0.5]; hr = [-0.3, 0.55 + Math.max(0, -g) * 0.25, 0.5]; break; }   // gathering: bent down, picking
        case 14: hr = [-0.4, 1.55 + Math.sin(ph * 1.5) * 0.15, 0.4]; hl = [0.45, 0.95, 0.1]; yaw += Math.sin(ph * 0.3) * 0.4; break;   // teacher: points at the board
        case 15: hop = -0.32; hl = [0.3, 0.8, 0.3]; hr = [-0.3, 0.8 + Math.max(0, Math.sin(ph * 0.4)) * 0.5, 0.3]; break;   // pupil: sits, puts the hand up now and then
        case 16: prop = "topf"; hr = [-0.15 + Math.cos(ph * 2) * 0.12, 1.0, 0.55 + Math.sin(ph * 2) * 0.12]; hl = [0.3, 0.95, 0.4]; break;   // cook: stirs the pot
        case 17: { const k = Math.abs(Math.sin(ph * 2)); lean = 0.15 + k * 0.08; hl = [0.22, 0.85 + k * 0.15, 0.5]; hr = [-0.22, 0.85 + k * 0.15, 0.5]; break; }   // baker: kneads
        case 18: lean = 0.45; hl = [0.25, 0.75 + Math.sin(ph * 1.2) * 0.08, 0.55]; hr = [-0.25, 0.75 - Math.sin(ph * 1.2) * 0.08, 0.55]; break;   // doctor, nurse: bends over a patient
        case 19: { const sal = Math.sin(ph * 0.25) > 0.85; yaw += Math.sin(ph * 0.35) * 0.5; if (sal) hr = [-0.25, 1.95, 0.25]; break; }   // guard: on watch, looks around, salutes
        case 20: prop = "gitarre"; hl = [0.35, 1.15, 0.35]; hr = [-0.1, 0.95 + Math.sin(ph * 5) * 0.08, 0.35]; hop = Math.abs(Math.sin(ph * 1.5)) * 0.05; break;   // musician
        case 21: hl = [0.5, 1.7 + Math.sin(ph) * 0.2, 0.2]; hr = [-0.5, 1.7 - Math.sin(ph) * 0.2, 0.2]; break;   // priest preaches
        case 22: { const g = Math.max(0, Math.sin(ph * 0.9)); hr = [-0.3, 1.05, 0.3 + g * 0.35]; prop = g > 0.5 ? "kiste" : null; break; }   // shopkeeper hands something over
        case 23: prop = "kolben"; hr = [-0.2, 1.45 + Math.sin(ph * 0.8) * 0.1, 0.4]; hl = [0.3, 1.0, 0.35]; lean = -0.08; break;   // scientist holds up a flask
        case 24: prop = "kiste"; hl = [0.3, 1.05, 0.42]; hr = [-0.3, 1.05, 0.42]; hop = Math.abs(Math.sin(ph * 1.4)) * 0.05; break;   // carries a crate
        case 26: tool = "stab"; hr = [-0.42, 1.2, 0.2]; hl = [0.45, 0.92, 0.05]; roll = 0.06; break;   // shepherd leans on the staff
        case 27: lean = 0.18; hl = [0.2, 1.0 + Math.sin(ph * 3) * 0.04, 0.5]; hr = [-0.2, 1.0, 0.5 + Math.sin(ph * 4) * 0.06]; break;   // writing
        case 29: hr = [-0.45, 1.5 + Math.sin(ph * 1.3) * 0.25, 0.3]; yaw += Math.sin(ph * 0.4) * 0.3; break;   // speech
        case 30: { const j = Math.abs(Math.sin(ph * 2.2)); hop = j * 0.3; hl = [0.5 + j * 0.2, 0.9 + j * 1.0, 0]; hr = [-0.5 - j * 0.2, 0.9 + j * 1.0, 0]; break; }   // jumping jacks
        case 31: tool = "besen"; swing = Math.sin(ph * 1.6); hr = [-0.25 + swing * 0.2, 1.0, 0.35]; hl = [0.1 + swing * 0.2, 0.75, 0.4]; lean = 0.12; break;   // sweeping
        case 32: prop = "kolben"; hr = [-0.25 + Math.cos(ph * 2) * 0.3, 1.6 + Math.sin(ph * 2) * 0.3, 0.4]; break;   // magician waves
        case 13: tool = "bogen"; swing = Math.max(0, Math.sin(ph * 0.6)); hl = [0.12, 1.35, 0.62]; hr = [-0.05, 1.35, 0.18 - swing * 0.15]; lean = -0.05; break;   // hunting: bow drawn
        case 11: roll = Math.sin(ph * 0.8) * 0.06; hr = [-0.42, 1.1 + Math.max(0, Math.sin(ph * 1.3)) * 0.35, 0.25]; break;
        default: hop = Math.sin(ph * 0.6) * 0.015;
      }
      // the figure: position, facing, size; lying figures tip onto their back
      E.set(liegt ? -Math.PI / 2 : lean, yaw, roll); Q.setFromEuler(E); P.set(x, y + hop + (liegt ? 0.4 * gross : 0), z); S.set(gross, gross, gross);
      M.compose(P, Q, S);
      setze(T.body, i, 0, 0.87, 0); setze(T.head, i, 0, 1.9, 0);
      setze(T.eye, i, 0.13, 1.95, 0.3); setze(T.eye2, i, -0.13, 1.95, 0.3);
      setze(T.hand, i, ...hl); setze(T.hand2, i, ...hr);
      for (const [art, teile] of Object.entries(hutTeile)) for (const tt of teile) if (art === f.art) setze(tt.m, i, 0, tt.y, 0); else tt.m.setMatrixAt(i, NULL);
      // the tool in the right hand
      if (tool === "axt" || tool === "hammer") {
        const r = -0.9 + swing * 1.1;
        setze(T.stiel, i, hr[0], hr[1] + 0.25, hr[2] + 0.1, r, 0, 0);
        E.set(r, 0, 0); Q.setFromEuler(E); const o = new THREE.Vector3(0, 0.5, 0).applyQuaternion(Q);
        setze(tool === "axt" ? T.axt : T.hammer, i, hr[0] + o.x, hr[1] + 0.25 + o.y, hr[2] + 0.1 + o.z, r, 0, 0);
        (tool === "axt" ? T.hammer : T.axt).setMatrixAt(i, NULL); T.angel.setMatrixAt(i, NULL);
      } else if (tool === "stab") {   // the shepherd's staff upright in the right hand
        setze(T.stiel, i, hr[0], hr[1] - 0.25, hr[2], 0, 0, 0.05, 1.7);
        T.axt.setMatrixAt(i, NULL); T.hammer.setMatrixAt(i, NULL); T.angel.setMatrixAt(i, NULL);
      } else if (tool === "besen") {   // broom handle slanting down to the ground
        setze(T.stiel, i, (hr[0] + hl[0]) / 2, 0.75, 0.45, 0.5, 0, swing * 0.3, 1.3);
        T.axt.setMatrixAt(i, NULL); T.hammer.setMatrixAt(i, NULL); T.angel.setMatrixAt(i, NULL);
      } else if (tool === "bogen") {   // the bow upright in the left hand, pointing ahead
        setze(T.stiel, i, hl[0], hl[1], hl[2] + 0.05, 0, 0, 0, 1.2);
        T.axt.setMatrixAt(i, NULL); T.hammer.setMatrixAt(i, NULL); T.angel.setMatrixAt(i, NULL);
      } else if (tool === "angel") {
        setze(T.angel, i, hr[0], hr[1] + 0.55, hr[2] + 0.9, 1.05 + swing, 0, 0);
        T.stiel.setMatrixAt(i, NULL); T.axt.setMatrixAt(i, NULL); T.hammer.setMatrixAt(i, NULL);
      } else { T.stiel.setMatrixAt(i, NULL); T.axt.setMatrixAt(i, NULL); T.hammer.setMatrixAt(i, NULL); T.angel.setMatrixAt(i, NULL); }
      // things in front of or in the hands: pot, guitar, flask, crate
      for (const n of ["topf", "gitarre", "kolben", "kiste"]) if (n !== prop) T[n].setMatrixAt(i, NULL);
      if (prop === "topf") setze(T.topf, i, 0, 0.85, 0.6);
      else if (prop === "gitarre") setze(T.gitarre, i, 0.05, 1.0, 0.42, 0, 0, 0.6);
      else if (prop === "kolben") setze(T.kolben, i, hr[0], hr[1] + 0.12, hr[2]);
      else if (prop === "kiste") setze(T.kiste, i, (hr[0] + hl[0]) / 2, (hr[1] + hl[1]) / 2 + 0.05, (hr[2] + hl[2]) / 2 + 0.1);
      const kopf = y + (2.6 + hop) * gross;
      if (folge === V.j.ids[i]) {
        pos.set(x, 1, z); gefunden = true;
        // steep from above, close, the figure always in the middle (roofs stay out of the way)
        if (V.zuletzt !== folge) { V.zuletzt = folge; controls.target.copy(pos); camera.position.set(x + 1, 12, z + 13); }
        const ziel = pos.clone().sub(controls.target); controls.target.add(ziel); camera.position.add(ziel);
        ring.position.set(x, y + 0.08, z); ring.scale.setScalar(gross); ring.visible = true;
        ui.info.hidden = false; ui.info.textContent = (opts.wer ? opts.wer(folge) : V.j.namen[i]) + ": " + V.j.texte[(u < 0.5 ? a : b)[5]];
        kandidaten.push([-1, i, x, kopf, z]);
      } else {
        const d = camera.position.distanceToSquared(P.set(x, y, z));
        if (d < 140 * 140) kandidaten.push([d, i, x, kopf, z]);
      }
    }
    for (const m of Object.values(T)) m.instanceMatrix.needsUpdate = true;
    for (const teile of Object.values(hutTeile)) for (const tt of teile) tt.m.instanceMatrix.needsUpdate = true;
    if (!gefunden) ring.visible = false;
    // name tags: the followed one and the nearest ones in view, at most 60
    kandidaten.sort((p, q) => p[0] - q[0]);
    const r = renderer.domElement.getBoundingClientRect();
    let k = 0;
    const belegt = [];   // tags must not lie on top of each other: the nearer figure wins
    for (const [, i, x, kopf, z] of kandidaten) {
      if (k >= 40) break;
      proj.set(x, kopf, z).project(camera);
      if (proj.z > 1 || Math.abs(proj.x) > 1.05 || Math.abs(proj.y) > 1.05) continue;
      const sx = (proj.x + 1) / 2 * r.width, sy = (1 - proj.y) / 2 * r.height;
      if (folge !== V.j.ids[i] && belegt.some(([bx, by]) => Math.abs(bx - sx) < 90 && Math.abs(by - sy) < 20)) continue;
      belegt.push([sx, sy]);
      let el = schilder[k];
      if (!el) { el = document.createElement("span"); el.className = "verlauf-name"; namenBox.append(el); schilder[k] = el; }
      if (el.textContent !== V.j.namen[i]) el.textContent = V.j.namen[i];
      el.classList.toggle("ich", folge === V.j.ids[i]);
      el.style.transform = "translate(" + sx.toFixed(1) + "px," + sy.toFixed(1) + "px) translate(-50%,-100%)";
      el.hidden = false; k++;
    }
    for (; k < schilder.length; k++) schilder[k].hidden = true;
    objekteZeigen(k0, k1, u, zeit);
    // the ticker: every event whose minute just passed pops up for a few seconds
    const jetztMin = V.j.t0 + V.t * V.j.dt;
    for (const e of V.evs) {
      if (V.gezeigt.has(e) || e.m > jetztMin) continue;
      V.gezeigt.add(e);
      if (jetztMin - e.m > 20) continue;   // jumped far ahead: no flood of old messages
      const el = document.createElement("div"); el.className = "verlauf-toast" + (e.k ? " kopf" : "");
      el.textContent = uhr((e.m - V.j.t0) / V.j.dt) + "  " + e.t; ui.ticker.prepend(el);
      while (ui.ticker.children.length > 3) ui.ticker.lastChild.remove();
      setTimeout(() => el.remove(), 5000);
    }
    ui.querySelector(".verlauf-uhr").textContent = uhr(V.t);
    if (document.activeElement !== ui.regler) ui.regler.value = V.t;
  }

  // the event objects Unity showed that day: flames and smoke on the burning houses, the robbers and their camp fire, the
  // prisoners in the yard, bears, wolves, confetti over the party, the burst pipe, a fallen tree
  const OB = [];
  if (V) {
    const mb = (c, extra = {}) => new THREE.MeshBasicMaterial({ color: c, ...extra }), ml = (c) => new THREE.MeshLambertMaterial({ color: c, flatShading: true });
    for (const o of V.j.objekte || []) {
      const g = new THREE.Group(); g.visible = false; scene.add(g);
      const add = (geo, m, x = 0, y = 0, z = 0) => { const k = new THREE.Mesh(geo, m); k.position.set(x, y, z); g.add(k); return k; };
      const teile = [];
      if (o.t === "feuer") {
        for (let i = 0; i < 4; i++) teile.push(add(new THREE.ConeGeometry(1.6 - i * 0.2, 5.4 - i * 0.6, 7), mb(i % 2 ? "#ffd23f" : "#ff7a1a", { transparent: true, opacity: 0.92 }), (i - 1.5) * 1.6, 0, (i % 2) * 0.8));
        for (let i = 0; i < 6; i++) teile.push(add(new THREE.SphereGeometry(1, 8, 6), mb("#5a5552", { transparent: true, opacity: 0.45 }), 0, 0, 0));
      } else if (o.t === "raeuber" || o.t === "gefangener") {
        add(new THREE.CapsuleGeometry(0.42, 0.9, 4, 10), ml("#2c2f3a"), 0, 0.87, 0); add(new THREE.SphereGeometry(0.34, 10, 8), ml("#e0b48a"), 0, 1.9, 0);
        add(new THREE.ConeGeometry(0.42, 0.7, 10), ml("#1d1f27"), 0, 2.2, 0);
      } else if (o.t === "lagerfeuer") {
        for (let i = 0; i < 4; i++) { const l = add(new THREE.CylinderGeometry(0.12, 0.12, 1.4, 6), ml("#6b4a2e"), 0, 0.15, 0); l.rotation.z = Math.PI / 2; l.rotation.y = i * 0.8; }
        teile.push(add(new THREE.ConeGeometry(0.45, 1.3, 7), mb("#ff8a1f"), 0, 0.75, 0));
      } else if (o.t === "baer" || o.t === "wolf") {
        const c = o.t === "baer" ? "#6b4a2e" : "#8b8f96", s = o.t === "baer" ? 1 : 0.7;
        add(new THREE.SphereGeometry(0.9 * s, 10, 8), ml(c), 0, 0.9 * s, 0).scale.set(0.8, 0.75, 1.3);
        add(new THREE.SphereGeometry(0.5 * s, 10, 8), ml(c), 0, 1.3 * s, 1.1 * s);
      } else if (o.t === "konfetti") {
        const n = 220, pp = new Float32Array(n * 3), pc = new Float32Array(n * 3), c2 = new THREE.Color();
        for (let i = 0; i < n; i++) { pp.set([(Math.random() - 0.5) * 26, Math.random() * 9, (Math.random() - 0.5) * 18], i * 3); c2.setHSL(Math.random(), 0.9, 0.6); pc.set([c2.r, c2.g, c2.b], i * 3); }
        const geo = new THREE.BufferGeometry(); geo.setAttribute("position", new THREE.BufferAttribute(pp, 3)); geo.setAttribute("color", new THREE.BufferAttribute(pc, 3));
        const pts = new THREE.Points(geo, new THREE.PointsMaterial({ size: 0.35, vertexColors: true })); g.add(pts); teile.push(pts);
      } else if (o.t === "wasser") {
        add(new THREE.CylinderGeometry(3.5, 3.5, 0.04, 20), mb("#5aa7ee", { transparent: true, opacity: 0.8 }), 0, 0.05, 0);
      } else if (o.t === "baum") {
        add(new THREE.CylinderGeometry(0.3, 0.4, 8, 8), ml("#6b4a2e"), 0, 0.4, 0).rotation.z = Math.PI / 2;
        add(new THREE.SphereGeometry(2, 8, 6), ml("#3f8a3a"), 4.5, 1.2, 0);
      } else continue;
      OB.push({ o, g, teile });
    }
  }
  function objekteZeigen(k0, k1, u, zeit) {
    for (const { o, g, teile } of OB) {
      const a = o.p[k0 - o.von], b = o.p[k1 - o.von] || a;
      if (k0 < o.von || !a) { g.visible = false; continue; }
      g.visible = true;
      g.position.set(a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u, a[2] + (b[2] - a[2]) * u);
      if (o.t === "feuer") {
        teile.forEach((m, i) => {
          if (i < 4) { const f = 1 + Math.sin(zeit * 9 + i * 1.7) * 0.15; m.scale.set(f, f * (1 + Math.sin(zeit * 13 + i) * 0.12), f); m.position.y = (5.4 - i * 0.6) / 2 * f; }
          else { const r = ((zeit * 0.35 + (i - 4) / 6) % 1); m.position.set(Math.sin(i * 2) * (1 + r), 3 + r * 9, Math.cos(i * 2) * r); m.scale.setScalar(0.8 + r * 2.2); m.material.opacity = 0.5 * (1 - r); }
        });
      } else if (o.t === "lagerfeuer") { const f = 1 + Math.sin(zeit * 10) * 0.18; teile[0].scale.set(f, f, f); }
      else if (o.t === "konfetti") {
        const pa = teile[0].geometry.attributes.position;
        for (let i = 0; i < pa.count; i++) { let y = pa.getY(i) - 0.05; if (y < 0) y = 9; pa.setY(i, y); }
        pa.needsUpdate = true;
      }
    }
  }

  // render only while something moves (battery on phones)
  controls.addEventListener("change", () => (dirty = true));
  let vorher = performance.now(), lebt = true;
  (function loop() {
    if (!lebt) return;
    requestAnimationFrame(loop);
    const jetzt = performance.now(), dt = Math.min(0.1, (jetzt - vorher) / 1000); vorher = jetzt;
    if (V && V.play) { V.t = Math.min(V.j.proben - 1, V.t + dt * 7.2); if (V.t >= V.j.proben - 1) { V.play = false; ui.querySelector("button").textContent = "▶"; } }
    if (V) { verlaufZeigen(jetzt); dirty = true; if (wasser) wasser.material.map.offset.y -= dt * 0.12; }   // the river flows (south)   // the figures keep moving (chopping, chatting) even while paused
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
    if (V) { leute.T.body.computeBoundingSphere(); leute.T.head.computeBoundingSphere(); }
    for (const hit of ray.intersectObjects(pickables, false)) {
      const o = hit.object, i = hit.instanceId;
      if (o.userData.figures) { if (V) { folge = o.userData.figures[i]; dirty = true; return; } onPick({ villager: o.userData.figures[i] }); return; }
      if (o.userData.houses && o.userData.houses[i]) { onPick({ house: o.userData.houses[i] }); return; }
      if (o.userData.gebaeude) {   // where it stands and how big it is (game coordinates: z mirrored)
        o.getMatrixAt(i, m4); const bb = o.geometry.boundingBox.clone().applyMatrix4(m4), c = bb.getCenter(new THREE.Vector3()), sz = bb.getSize(new THREE.Vector3());
        onPick({ gebaeude: o.userData.gebaeude, x: c.x, z: -c.z, r: Math.max(8, Math.max(sz.x, sz.z) * 0.6 + 4), drinnen }); return;
      }
    }
    if (V && folge != null) { folge = null; ui.info.hidden = true; dirty = true; }   // tap on the ground: stop following
  });
  // who is out of sight right now (working inside / at home) near a place in game coordinates - for a tap on a building during the replay
  function drinnen(x, z, r) {
    if (!V) return null;
    const k = Math.min(V.j.proben - 1, Math.max(0, Math.round(V.t))), out = [];
    for (let i = 0; i < V.n; i++) { const s = lese(k, i); if (s[4] === 0 && Math.hypot(s[0] - x, -s[2] - z) < r) out.push(V.j.namen[i]); }
    return out;
  }
  return { tag, drinnen, ende() { lebt = false; renderer.dispose(); for (const el of [renderer.domElement, ui, ui && ui.info, ui && ui.liste, ui && ui.ticker, namenBox]) if (el) el.remove(); }, reset() { camera.position.set(cx + 60, Math.max(W, D) * 0.55, cz + Math.max(W, D) * 0.55); controls.target.set(cx, 0, cz); dirty = true; } };
}
