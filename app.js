// Das Instagram-Dorf: tabs Story / Lager / Eure Wünsche / Karte / Unterstuetzen (the old "Dorf" tab lives on the map since 26.10.2026).
// No resident list, no profiles (Thomas 28.10.2026, privacy): the tab, search, filters and profile cards are gone, names are never links. Data: daten/dorf.json (built by Webseite/bauen.py).
(function () {
  "use strict";
  var D = null, tag = null, komplett = false;
  var $ = function (id) { return document.getElementById(id); };
  var SCHILDER = { dorfplatz: "Marktplatz", kirche: "Kirche", theater: "Theater", lager: "Lager", lagerfeuer: "Lagerfeuer", schule: "Schule",
    krankenhaus: "Krankenhaus", muehle: "Wassermühle", militaer: "Militärbasis", forschung: "Forschung", schwimmbad: "Heiße Quellen", acker: "Acker",
    gemuesegarten: "Gemüsegarten", restaurant: "Restaurant", leberkaese: "Leberkäse", doenerladen: "Döner",
    bauernhof: "Bauernhof", koppel: "Koppel", windmuehle: "Windmühle", fischer: "Fischer", wald: "Wald" };
  var TABS = ["story", "lager", "wuensche", "karte", "unterstuetzen"];
  var GRUPPEN = [
    ["Essen", ["Brot", "Fisch", "Fleisch", "Beeren", "Pilze", "Gemüse", "Milch", "Käse", "Eier", "Honig", "Obst", "Suppe", "Leberkäse"]],
    ["Zutaten", ["Weizen", "Mehl", "Kräuter", "Hanfsamen", "Salz", "Zucker"]],
    ["Brennstoff", ["Feuerholz", "Kohle", "Torf", "Reisig"]],
    ["Rohstoffe", ["Holz", "Stein", "Erz", "Eisen", "Wolle", "Fell", "Leder", "Hanffaser", "Gummi", "Lehm", "Ton"]],
  ];

  // click statistics (Umami, cookieless; only on instadorf.de, where the script is loaded)
  function zaehlen(name, daten) { try { if (window.umami && window.umami.track) window.umami.track(name, daten || {}); } catch (e) { /* never break the page */ } }

  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  // names in texts stay plain text (no profiles since 28.10.2026): "@name" -> "name", nothing clickable
  function verlinken(text) { return esc(text).replace(/@([\w.]+)/g, "$1"); }
  function tagName(t) { return t === 0 ? "Der Anfang" : "Tag " + t; }

  function laden() {
    fetch("daten/dorf.json", { cache: "no-store" }).then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); }).then(function (d) {
      D = d;
      tag = d.geschichte.tag;
      kopf(); tage(); story(); lager(); karteBauen(); vonHash();
    }).catch(function () { $("story-inhalt").innerHTML = '<p class="hinweis">Die Dorfdaten konnten gerade nicht geladen werden. Lade die Seite bitte neu.</p>'; });
  }

  function kopf() {
    $("kicker").textContent = "Das Instagram-Dorf";
    $("z-einwohner").textContent = D.einwohner;
    $("z-berufe").textContent = D.berufe;
    $("z-warte").textContent = D.warteliste;
  }

  // ---------------------------------------------------------------- tabs
  function zeigeTab(name, push) {
    TABS.forEach(function (t) {
      $("panel-" + t).hidden = t !== name;
      $("tab-" + t).setAttribute("aria-selected", t === name ? "true" : "false");
    });
    if (name === "karte" && D && D.karte) requestAnimationFrame(kAnpassen);
    if (name === "wuensche") wuenscheLaden();
    $("supporter-leiste").hidden = name === "unterstuetzen";   // the support tab already says it all
    if (push) { try { history.replaceState(null, "", "#" + name); } catch (e) { /* preview frame */ } }
  }

  // ---------------------------------------------------------------- story
  function tage() {
    $("tage").innerHTML = D.geschichten.map(function (g) {
      return '<button type="button" class="tag-knopf" data-tag="' + g.tag + '" aria-pressed="' + (!komplett && g.tag === tag) + '">' + tagName(g.tag) + "</button>";
    }).join("");
  }
  function karte(g) {
    var bilder = g.bilder || [];
    return '<article class="geschichte"><p class="etikett">' + tagName(g.tag) + "</p><h2>" + esc(g.titel) + '</h2><div class="g-text">'
      + g.absaetze.map(function (p, i) {
        return "<p>" + verlinken(p) + "</p>" + bilder.filter(function (b) { return b.nach === i; }).map(function (b) {
          return '<figure class="bild"><img src="' + esc(b.datei) + '" alt="' + esc(b.text) + '" loading="lazy" width="1200" height="900"><figcaption>' + verlinken(b.text) + "</figcaption></figure>";
        }).join("");
      }).join("") + "</div></article>";
  }

  function story() {
    if (komplett) {
      $("story-inhalt").innerHTML = '<div class="komplett">' + D.geschichten.map(karte).join("") + "</div>";
      $("komplett").textContent = "Nur einen Tag zeigen";
    } else {
      var g = D.geschichten.filter(function (x) { return x.tag === tag; })[0] || D.geschichte;
      $("story-inhalt").innerHTML = karte(g);
      $("komplett").textContent = "Komplette Geschichte lesen";
    }
    tage();
  }

  // ---------------------------------------------------------------- the map: tap a house, see who lives there
  var K = { s: 1, x: 0, y: 0, min: 1, w: 0, h: 0 }, kZeiger = {}, kStart = null, kBewegt = false;
  function karteBauen() {
    var M = D.karte;
    if (!M) { $("tab-karte").hidden = true; return; }
    var spanX = M.x1 - M.x0, spanZ = M.z1 - M.z0;
    function pos(x, z) { return "left:" + ((x - M.x0) / spanX * 100) + "%;top:" + ((M.z1 - z) / spanZ * 100) + "%;"; }
    var h = '<img src="' + esc(M.bild) + '" alt="Das Dorf von oben">';
    var hw = 8.5 / spanX * 100, hh = 8.5 / spanZ * 100;
    M.haeuser.forEach(function (o, i) {
      h += '<button type="button" class="karte-punkt" data-haus="' + i + '" style="' + pos(o.x, o.z) + "width:" + hw + "%;height:" + hh + '%" aria-label="Haus von ' + esc(o.wer.join(", ") || "niemandem") + '"></button>';
    });
    (M.orte || []).forEach(function (o) {
      var info = (D.dorf || []).filter(function (d) { return d.id === o.dorf; })[0];
      if (!info) return;
      h += '<button type="button" class="karte-punkt ort" data-ort="' + esc(o.dorf) + '" style="' + pos(o.x, o.z) + "width:" + (o.r * 2 / spanX * 100) + "%;height:" + (o.r * 2 / spanZ * 100) + '%" aria-label="' + esc(info.name) + '"></button>';
    });
    // names on the important places (Thomas 24.10.2026); the small shops only when zoomed in
    var schon = {};
    function schild(id, x, z, klein) {
      var t = SCHILDER[id]; if (!t || schon[id + (klein ? x : "")]) return;
      schon[id + (klein ? x : "")] = 1;
      h += '<span class="karte-schild' + (klein ? " klein" : "") + '" style="' + pos(x, z) + '">' + esc(t) + "</span>";
    }
    (M.orte || []).forEach(function (o) { schild(o.dorf, o.x, o.z + (o.r || 0) * 0.55, ["lagerfeuer", "muehle", "koppel", "windmuehle", "fischer"].indexOf(o.dorf) >= 0); });
    M.haeuser.forEach(function (o) { if (o.dorf) schild(o.dorf, o.x, o.z + 6, o.dorf !== "kirche"); });
    $("karte-innen").innerHTML = h;
    $("karte-modus").hidden = !M.dreiD;
    var aufKarte = {};
    (M.orte || []).forEach(function (o) { aufKarte[o.dorf] = 1; });
    M.haeuser.forEach(function (o) { if (o.dorf) aufKarte[o.dorf] = 1; });
    ohneOrt = (D.dorf || []).filter(function (d) { return !aufKarte[d.id]; });
    K.w = M.breite; K.h = M.hoehe;
    $("karte-innen").style.width = K.w + "px"; $("karte-innen").style.height = K.h + "px";
  }
  // the 3D village (Thomas 24.10.2026): loaded on the first tap on "3D-Dorf", the map stays the default
  var dreiD = null;
  function modus(m) {
    document.querySelectorAll("[data-modus]").forEach(function (b) { b.classList.toggle("aktiv", b.getAttribute("data-modus") === m); });
    $("karte").hidden = m === "3d"; $("dorf3d").hidden = m !== "3d";
    if (m === "2d") { requestAnimationFrame(kAnpassen); return; }
    zaehlen("3D-Dorf");
    if (dreiD) return;
    starte3D(null);
  }
  // the 3D village, for a chosen day of the replay (Tag 1 ... the newest posted day; null = the newest)
  function starte3D(tag) {
    $("dorf3d-status").hidden = false;
    dreiD = import("./lib/dorf3d.js").then(function (mod) {
      return mod.start($("dorf3d"), D.karte, function (hit) {
        if (hit.villager) return;   // a figure: no profile any more (28.10.2026)
        if (hit.house) { var i = D.karte.haeuser.findIndex(function (h) { return h.id === hit.house; }); if (i >= 0) kHaus(i); }
        else if (hit.gebaeude) kGebaeude(hit);
      }, function (t) { $("dorf3d-status").textContent = t; }, {
        verlauf: !!D.karte.verlauf,
        tag: tag || (/[?&]tag=(\d+)/.test(location.search) ? +RegExp.$1 : null),
        onTag: function (n) { dreiD.then(function (v) { if (v) v.ende(); starte3D(n); }); },
        verlaufStart: /[?&]um=(\d\d)(\d\d)/.test(location.search) ? +RegExp.$1 * 60 + +RegExp.$2 : null,
        verlaufFolge: /[?&]folge=(\d+)/.test(location.search) ? +RegExp.$1 : null,
        verlaufPlay: /[?&]play=1/.test(location.search),
        verlaufOrt: /[?&]ort=(-?[\d.]+),(-?[\d.]+)/.test(location.search) ? [+RegExp.$1, +RegExp.$2] : null
      });
    }).then(function (v) { $("dorf3d-status").hidden = true; return v; })
      .catch(function () { $("dorf3d-status").textContent = "Das 3D-Dorf läuft auf diesem Gerät leider nicht. Die Karte von oben geht immer."; });
  }
  function kAnpassen() {   // whole map visible, at most as wide as the box
    var box = $("karte").getBoundingClientRect();
    if (!box.width) return;
    K.min = Math.min(box.width / K.w, box.height / K.h);
    K.s = K.min; K.x = (box.width - K.w * K.s) / 2; K.y = (box.height - K.h * K.s) / 2; kZeigen();
  }
  function kBegrenzen() {
    var box = $("karte").getBoundingClientRect();
    K.s = Math.max(K.min, Math.min(K.s, K.min * 8));
    var bw = K.w * K.s, bh = K.h * K.s;
    K.x = bw <= box.width ? (box.width - bw) / 2 : Math.min(0, Math.max(box.width - bw, K.x));
    K.y = bh <= box.height ? (box.height - bh) / 2 : Math.min(0, Math.max(box.height - bh, K.y));
  }
  function kZeigen() {
    kBegrenzen(); $("karte-innen").style.transform = "translate(" + K.x + "px," + K.y + "px) scale(" + K.s + ")";
    $("karte-innen").style.setProperty("--ks", 1 / K.s);                  // the names keep their size on screen
    $("karte").classList.toggle("nah", K.s >= K.min * 2.2);              // the small shops get their names when zoomed in
  }
  function kZoom(f, cx, cy) {
    var box = $("karte").getBoundingClientRect();
    if (cx == null) { cx = box.width / 2; cy = box.height / 2; }
    var ns = Math.max(K.min, Math.min(K.s * f, K.min * 8)), k = ns / K.s;
    K.x = cx - (cx - K.x) * k; K.y = cy - (cy - K.y) * k; K.s = ns; kZeigen();
  }
  function kInfo(html) { $("pop-inhalt").innerHTML = html; $("pop").hidden = false; $("pop-hg").hidden = false; $("pop").scrollTop = 0; $("pop-zu").focus(); }
  function popZu() {
    $("pop").hidden = true; $("pop-hg").hidden = true;
    document.querySelectorAll(".karte-punkt.aktiv").forEach(function (b) { b.classList.remove("aktiv"); });
  }
  function kHaus(i) {
    var o = D.karte.haeuser[i];
    document.querySelectorAll(".karte-punkt.aktiv").forEach(function (b) { b.classList.remove("aktiv"); });
    var b = document.querySelector('[data-haus="' + i + '"]'); if (b) b.classList.add("aktiv");
    var info = o.dorf ? (D.dorf || []).filter(function (d) { return d.id === o.dorf; })[0] : null;
    var leute = o.wer || [];
    var h = "<h3>" + (info ? esc(info.name) : leute.length ? "Haus von " + esc(leute.join(", ")) : "Leeres Haus") + "</h3>";
    if (info) h += "<p>" + verlinken(info.text) + "</p>";
    if (leute.length) h += '<p class="hinweis-klein">' + (info ? "Hier wohnt und arbeitet:" : "Hier wohnt:") + "</p>" + namenListe(leute);
    kInfo(h);
    zaehlen("Karte Haus", { art: info ? info.name : "Wohnhaus" });
  }
  // the names at a place, plain text only (Thomas 28.10.2026: no profiles, no professions, no portraits)
  function namenListe(namen) { return '<div class="karte-leute">' + namen.map(function (n) { return '<span class="karte-name">' + esc(n) + "</span>"; }).join("") + "</div>"; }
  // a building in the 3D village without a house: its place card if there is one, else everybody whose work spot is there
  function kGebaeude(hit) {
    var ort = (D.karte.orte || []).filter(function (o) { return Math.hypot(o.x - hit.x, o.z - hit.z) < (o.r || 10) + 4; })[0];
    if (ort && (D.dorf || []).some(function (d) { return d.id === ort.dorf; })) { kOrt(ort.dorf); return; }
    var leute = (D.karte.arbeit || []).filter(function (a) { return Math.hypot(a[1] - hit.x, a[2] - hit.z) < hit.r; })
      .map(function (a) { return a[0]; });
    // during the day replay: who works inside right now (hidden figures at the building)
    var drin = hit.drinnen ? (hit.drinnen(hit.x, hit.z, hit.r) || []) : [];
    kInfo("<h3>" + esc(hit.gebaeude) + "</h3>"
      + (drin.length ? '<p class="hinweis-klein">Arbeitet gerade hier (drinnen) ' + drin.length + ":</p>" + namenListe(drin) : "")
      + (leute.length ? '<p class="hinweis-klein">Hier arbeiten ' + leute.length + ":</p>" + namenListe(leute) : (drin.length ? "" : "<p>Hier arbeitet gerade niemand.</p>")));
    zaehlen("3D Gebäude", { ort: hit.gebaeude });
  }
  var ohneOrt = [];
  function dorfMehr() {
    kInfo("<h3>Mehr über das Dorf</h3>" + ohneOrt.map(function (d) {
      return '<h4 class="pop-gruppe">' + esc(d.name) + '</h4><img src="' + esc(d.bild) + '" alt="" loading="lazy" style="width:100%;border-radius:12px;aspect-ratio:16/10;object-fit:cover"><p>' + verlinken(d.text) + "</p>";
    }).join(""));
    zaehlen("Karte mehr");
  }
  function kOrt(id) {
    var info = (D.dorf || []).filter(function (d) { return d.id === id; })[0];
    if (!info) return;
    var ort = (D.karte.orte || []).filter(function (o) { return o.dorf === id; })[0] || {};
    var leute = ort.wer || [];
    kInfo("<h3>" + esc(info.name) + '</h3><img src="' + esc(info.bild) + '" alt="" style="width:100%;border-radius:12px;aspect-ratio:16/10;object-fit:cover"><p>' + verlinken(info.text) + "</p>"
      + (leute.length ? '<p class="hinweis-klein">' + (id === "schule" ? "In der Schule sind " : "Hier arbeiten ") + leute.length + ":</p>" + namenListe(leute) : ""));
    zaehlen("Karte Ort", { ort: info.name });
  }
  (function () {
    var el = $("karte");
    el.addEventListener("wheel", function (e) { e.preventDefault(); var r = el.getBoundingClientRect(); kZoom(e.deltaY < 0 ? 1.2 : 1 / 1.2, e.clientX - r.left, e.clientY - r.top); }, { passive: false });
    el.addEventListener("pointerdown", function (e) {
      kZeiger[e.pointerId] = { x: e.clientX, y: e.clientY };
      kStart = { x: e.clientX, y: e.clientY, kx: K.x, ky: K.y }; kBewegt = false;
      el.classList.add("zieht");
    });
    el.addEventListener("pointermove", function (e) {
      if (!kZeiger[e.pointerId]) return;
      var ids = Object.keys(kZeiger);
      if (ids.length === 2) {   // pinch
        var a = kZeiger[ids[0]], b = kZeiger[ids[1]], d0 = Math.hypot(a.x - b.x, a.y - b.y);
        kZeiger[e.pointerId] = { x: e.clientX, y: e.clientY };
        a = kZeiger[ids[0]]; b = kZeiger[ids[1]];
        var d1 = Math.hypot(a.x - b.x, a.y - b.y), r = el.getBoundingClientRect();
        if (d0 > 0) kZoom(d1 / d0, (a.x + b.x) / 2 - r.left, (a.y + b.y) / 2 - r.top);
        kBewegt = true; return;
      }
      kZeiger[e.pointerId] = { x: e.clientX, y: e.clientY };
      var dx = e.clientX - kStart.x, dy = e.clientY - kStart.y;
      if (Math.abs(dx) + Math.abs(dy) > 6) kBewegt = true;
      if (kBewegt) { K.x = kStart.kx + dx; K.y = kStart.ky + dy; kZeigen(); }
    });
    function ende(e) { delete kZeiger[e.pointerId]; if (!Object.keys(kZeiger).length) el.classList.remove("zieht"); var rest = Object.keys(kZeiger); if (rest.length === 1) { var p = kZeiger[rest[0]]; kStart = { x: p.x, y: p.y, kx: K.x, ky: K.y }; } }
    el.addEventListener("pointerup", ende); el.addEventListener("pointercancel", ende); el.addEventListener("pointerleave", ende);
    el.addEventListener("click", function (e) {
      if (kBewegt) { kBewegt = false; return; }
      var hb = e.target.closest("[data-haus]"); if (hb) { kHaus(+hb.getAttribute("data-haus")); return; }
      var ob = e.target.closest("[data-ort]"); if (ob) kOrt(ob.getAttribute("data-ort"));
    });
    $("karte-plus").addEventListener("click", function (e) { e.stopPropagation(); kZoom(1.5); });
    $("karte-minus").addEventListener("click", function (e) { e.stopPropagation(); kZoom(1 / 1.5); });
    $("karte-reset").addEventListener("click", function (e) { e.stopPropagation(); kAnpassen(); });
    // Thomas 26.10.2026: no "Mehr über das Dorf" button on the map any more (dorfMehr stays unused)
    window.addEventListener("resize", function () { if (!$("panel-karte").hidden) kAnpassen(); });
  })();

  // ---------------------------------------------------------------- wishes (Thomas 26.10.2026): summarised, neutral, with a count; no names, no quotes
  var wGeladen = false;
  function wuenscheLaden() {
    if (wGeladen) return; wGeladen = true;
    fetch("daten/wuensche.json", { cache: "no-store" }).then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); }).then(function (w) {
      $("wunsch-stand").textContent = "Aus euren Kommentaren · Stand " + w.stand;
      $("wuensche").innerHTML = (w.wuensche || []).map(function (x) {
        return '<li class="' + (x.umgesetzt ? "wunsch-da" : "") + '"><span class="zv-idee-text">' + esc(x.wunsch) + (x.umgesetzt ? '<span class="marke neu">' + esc(x.umgesetzt) + "</span>" : "") + '</span><span class="zv-anzahl">' + x.anzahl + "×</span></li>";
      }).join("");
    }).catch(function () { wGeladen = false; $("wuensche").innerHTML = '<li>Die Wünsche konnten gerade nicht geladen werden.</li>'; });
  }

  // ---------------------------------------------------------------- storehouse
  function lager() {
    var L = D.lager || {}, rest = (L.bestand || []).slice(), h = "";
    if (L.reicht) h += '<div class="lager-reicht"><span class="etikett">Stand nach ' + tagName(L.tag) + "</span><strong>Reicht noch: " + esc(L.reicht.replace(/(\d+)\.(\d)/g, "$1,$2")) + "</strong></div>";
    var max = Math.max.apply(null, rest.map(function (w) { return w.menge; }).concat([1]));
    function kachel(w) {
      var pct = Math.max(3, Math.round(100 * Math.sqrt(w.menge / max)));
      var bild = w.icon ? '<img class="wi" src="' + esc(w.icon) + '" alt="" width="64" height="64" loading="lazy">' : '<span class="wi wi-leer">' + esc(w.ware.charAt(0)) + "</span>";
      return '<li class="ware">' + bild + '<span class="wn">' + esc(w.ware) + '</span><span class="wm">' + w.menge + '</span><span class="balken"><i style="width:' + pct + '%"></i></span></li>';
    }
    GRUPPEN.forEach(function (g) {
      var drin = rest.filter(function (w) { return g[1].indexOf(w.ware) >= 0; });
      rest = rest.filter(function (w) { return g[1].indexOf(w.ware) < 0; });
      if (drin.length) h += '<div class="lager-gruppe"><h2>' + g[0] + '</h2><ul class="waren">' + drin.map(kachel).join("") + "</ul></div>";
    });
    if (rest.length) h += '<div class="lager-gruppe"><h2>Waren und Sonstiges</h2><ul class="waren">' + rest.map(kachel).join("") + "</ul></div>";
    if ((L.hergestellt || []).length) h += '<div class="lager-gruppe"><h2>An ' + tagName(L.tag) + ' hergestellt</h2><p class="hinweis-klein">'
      + L.hergestellt.map(function (w) { return (w.icon ? '<img class="wi-klein" src="' + esc(w.icon) + '" alt="" width="22" height="22">' : "") + esc(w.ware) + " " + w.menge; }).join(" · ") + "</p></div>";
    $("lager-inhalt").innerHTML = h || '<p class="hinweis">Das Lager ist noch leer.</p>';
  }

  function vonHash() {
    var n = decodeURIComponent(location.hash.slice(1));
    if (n === "dorf") n = "karte";   // the old "Dorf" tab is on the map now
    if (TABS.indexOf(n) >= 0) zeigeTab(n);   // old links to the resident list or a profile (#bewohner, #name) just open the story
  }

  document.addEventListener("click", function (ev) {
    var tab = ev.target.closest("[data-tab]");
    if (tab) {
      zaehlen("Reiter", { reiter: tab.getAttribute("data-tab"), von: tab.classList.contains("knopf") ? "Leiste" : "Reiter" });
      zeigeTab(tab.getAttribute("data-tab"), true);
      if (tab.classList.contains("knopf")) $("panel-" + tab.getAttribute("data-tab")).scrollIntoView({ block: "start" });
      return;
    }
    var tg = ev.target.closest("[data-tag]");
    if (tg) { tag = +tg.getAttribute("data-tag"); zaehlen("Tag gewählt", { tag: tag }); komplett = false; story(); return; }
    if (ev.target.closest("#komplett")) { if (!komplett) zaehlen("Komplette Geschichte"); komplett = !komplett; story(); $("panel-story").scrollIntoView({ block: "start" }); return; }
    var md = ev.target.closest("[data-modus]");
    if (md) modus(md.getAttribute("data-modus"));
  });
  $("pop-zu").addEventListener("click", popZu);
  $("pop-hg").addEventListener("click", popZu);
  document.addEventListener("keydown", function (e) { if (e.key === "Escape" && !$("pop").hidden) popZu(); });
  window.addEventListener("hashchange", vonHash);
  laden();
})();

/* World chooser (Thomas 26.10.2026): ALWAYS shown when the page opens; the world bar switches between the worlds and back */
(function () {
  var w = document.getElementById("welten"); if (!w) return;
  var zv = document.getElementById("zombieville"), geladen = false;
  var $ = function (id) { return document.getElementById(id); };
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  function zeigen(an) { w.hidden = !an; document.documentElement.style.overflow = an ? "hidden" : ""; if (an) w.scrollTop = 0; }
  function welt(name) {
    var z = name === "zombieville";
    if (zv) zv.hidden = !z;
    document.documentElement.classList.toggle("welt-zv", z);
    [["welt-wechseln-dorf", !z], ["welt-wechseln-zombie", z]].forEach(function (p) {
      var b = $(p[0]); if (!b) return;
      b.classList.toggle("aktiv", p[1]); b.classList.toggle("weltknopf-zv", p[1] && z);
      if (p[1]) b.setAttribute("aria-current", "true"); else b.removeAttribute("aria-current");
    });
    document.title = z ? "Zombieville" : "Insta-Dorf";
    if (z && !geladen) zvLaden();
    if (!z) { zvFarmZeigen(false); if (/^#zv-/.test(location.hash)) hashSetzen(""); }
    else zvTab(tabStart || "uebersicht", false);
    tabStart = null;
    zeigen(false); window.scrollTo(0, 0);
  }
  function hashSetzen(h) { try { history.replaceState(null, "", h ? "#" + h : location.pathname + location.search); } catch (e) { /* preview frame */ } }

  // Zombieville tabs (Thomas 26.10.2026): Übersicht (default), Story (28.10.), Farm (3D map, only a view), Lager (stock); the tab is kept in the hash (#zv-farm)
  // no "Bewohner" tab (Thomas 28.10.2026, privacy: removed before it went online)
  // Crafting is hidden since 28.10.2026 (comes into the game later): panel + code stay, add "crafting" here and its button in index.html to show it again
  var ZV_TABS = ["uebersicht", "story", "farm", "lager"], tabStart = null, farm = null;
  function zvTab(name, merken) {
    if (ZV_TABS.indexOf(name) < 0) name = "uebersicht";
    ZV_TABS.forEach(function (t) {
      $("zv-panel-" + t).hidden = t !== name;
      $("zv-tab-" + t).setAttribute("aria-selected", t === name ? "true" : "false");
    });
    zvFarmZeigen(name === "farm");
    if (name === "crafting") zvCraftingLaden();
    if (merken) hashSetzen("zv-" + name);
  }
  // buttons that jump to a tab (story teaser on the overview)
  document.addEventListener("click", function (ev) {
    var g = ev.target.closest("[data-zvgehe]");
    if (g) { zvTab(g.getAttribute("data-zvgehe"), true); window.scrollTo(0, 0); }
  });

  // ---- Story (Thomas 28.10.2026): one told section per POSTED day, text + pictures (zombieville.py: geschichten_oeffentlich)
  var ZV = null, zvTagW = null, zvKomplett = false;
  function zvTagName(t) { return "Tag " + t; }
  // @name -> the name in bold, plain text, never a link (no resident list, Thomas 28.10.2026)
  function zvVerlinken(t) { return esc(t).replace(/@([A-Za-z0-9._]+[A-Za-z0-9_])/g, "<strong>$1</strong>"); }
  function zvGeschichte(g) {
    var bilder = g.bilder || [];
    return '<article class="geschichte zv-geschichte"><p class="etikett">' + zvTagName(g.tag) + "</p><h2>" + esc(g.titel) + '</h2><div class="g-text">'
      + g.absaetze.map(function (p, i) {
        var hier = bilder.filter(function (b) { return b.nach === i; });
        return "<p>" + zvVerlinken(p) + "</p>" + (hier.length ? '<div class="zv-bilder' + (hier.length > 1 ? " zv-bilder-2" : "") + '">' + hier.map(function (b) {
          return '<figure class="bild zv-bild"><img src="' + esc(b.datei) + '" alt="' + esc(b.text.replace(/@/g, "")) + '" loading="lazy" width="720" height="900"><figcaption>' + zvVerlinken(b.text) + "</figcaption></figure>";
        }).join("") + "</div>" : "");
      }).join("") + "</div></article>";
  }
  function zvStory() {
    var gs = (ZV && ZV.geschichten) || [];
    if (!gs.length) { $("zv-story-inhalt").innerHTML = '<p class="hinweis-klein">Die Story beginnt mit dem ersten Video.</p>'; return; }
    if (zvTagW == null) zvTagW = gs[gs.length - 1].tag;
    $("zv-tage").innerHTML = gs.map(function (g) {
      return '<button type="button" class="tag-knopf" data-zvstorytag="' + g.tag + '" aria-pressed="' + (!zvKomplett && g.tag === zvTagW) + '">' + zvTagName(g.tag) + "</button>";
    }).join("");
    $("zv-story-inhalt").innerHTML = zvKomplett ? '<div class="komplett">' + gs.map(zvGeschichte).join("") + "</div>"
      : zvGeschichte(gs.filter(function (g) { return g.tag === zvTagW; })[0] || gs[gs.length - 1]);
    $("zv-komplett").hidden = gs.length < 2;
    $("zv-komplett").textContent = zvKomplett ? "Nur einen Tag zeigen" : "Ganze Geschichte lesen";
    // teaser on the overview: newest day
    var n = gs[gs.length - 1], b = (n.bilder || [])[0];
    $("zv-neu-etikett").textContent = "Neu in der Story · " + zvTagName(n.tag);
    $("zv-neu-titel").textContent = n.titel;
    $("zv-neu-anfang").innerHTML = zvVerlinken(n.absaetze[0] || "");
    $("zv-neu-bild").innerHTML = b ? '<img src="' + esc(b.datei) + '" alt="" width="720" height="900" loading="lazy">' : "";
    $("zv-neu").hidden = false;
  }
  document.addEventListener("click", function (ev) {
    var t = ev.target.closest("[data-zvstorytag]");
    if (t) { zvTagW = +t.getAttribute("data-zvstorytag"); zvKomplett = false; zvStory(); return; }
    if (ev.target.closest("#zv-komplett")) { zvKomplett = !zvKomplett; zvStory(); $("zv-panel-story").scrollIntoView({ block: "start" }); }
  });

  function zvFarmZeigen(an) {
    if (!an) { if (farm) farm.then(function (f) { if (f) f.zeigen(false); }); return; }
    if (farm) { farm.then(function (f) { if (f) f.zeigen(true); }); return; }
    var st = $("zv-farm-status");
    st.hidden = false;
    farm = import("./zombieville/farm.js").then(function (mod) {
      return mod.start($("zv-farm"), function (t) { st.textContent = t; });
    }).then(function (f) { st.hidden = true; if ($("zv-panel-farm").hidden) f.zeigen(false); return f; })
      .catch(function () { st.textContent = "Die 3D-Farm läuft auf diesem Gerät leider nicht."; return null; });
  }
  // "Spielen" (Thomas 26.10.2026): greyed out, Coming Soon - no link to the game yet, a tap only shows a short note
  var spHinweis = null;
  $("zv-tab-spielen").addEventListener("click", function () {
    $("zv-spielen-hinweis").hidden = false; clearTimeout(spHinweis);
    spHinweis = setTimeout(function () { $("zv-spielen-hinweis").hidden = true; }, 3500);
  });
  document.querySelectorAll("[data-zvtab]").forEach(function (b) {
    b.addEventListener("click", function () { zvTab(b.getAttribute("data-zvtab"), true); });
  });
  $("zv-farm-zurueck").addEventListener("click", function () { if (farm) farm.then(function (f) { if (f) f.zuruecksetzen(); }); });
  $("zv-farm-namen").addEventListener("click", function () {
    var an = this.getAttribute("aria-pressed") !== "true";
    this.setAttribute("aria-pressed", an ? "true" : "false");
    if (farm) farm.then(function (f) { if (f) f.namen(an); });
  });
  // stock: numbers only (Regie.json lager.stand via zombieville.py); icons from the village set where one fits
  // all stock keys of the game (spiel/js/zustand.js INVENTAR, 26.10.2026) + Regie.json; [name, emoji if there is no icon]
  // icons: bilder_zombie/icons/<key>.webp (block style, Webseite/zombieville_icons.mjs), the emoji only if the picture is missing
  var LAGER = { holz: ["Holz", "🪵"], steine: ["Steine", "🪨"], feuerstein: ["Feuersteine", "◆"], fasern: ["Fasern", "🌿"], essen: ["Essen", "🥫"], pilze: ["Pilze", "🍄"],
    beeren: ["Beeren", "🍒"], aepfel: ["Äpfel", "🍎"], gemuese: ["Gemüse", "🥕"], mais: ["Maiskolben", "🌽"], kraeuter: ["Heilkräuter", "☘️"], heilkraut: ["Heilkräuter", "☘️"],
    eintopf: ["Eintöpfe", "🍲"], grillmais: ["Gegrillte Maiskolben", "🔥"], boegen: ["Bögen", "🏹"], pfeile: ["Pfeile", "➶"], gemuesesamen: ["Gemüsesamen", "🌱"], maiskoerner: ["Maiskörner", "🌾"] };
  function ikone(key, emoji, px) {
    return '<span class="zv-ikone" style="width:' + px + "px;height:" + px + 'px"><img src="bilder_zombie/icons/' + esc(key) + '.webp" alt="" width="' + px + '" height="' + px + '" loading="lazy" onerror="this.replaceWith(document.createTextNode(this.parentNode.getAttribute(\'data-e\')))"></span>';
  }
  // unknown keys are shown too, with a readable name ("neuer_posten" -> "Neuer posten")
  function lagerName(k) { var n = k.replace(/_/g, " "); return n.charAt(0).toUpperCase() + n.slice(1); }
  var ZAHLWORT = { holz: "Holz", essen: "Essen" };
  // crafting (Thomas 26.10.2026): sections with cards; found = icon + name (tap: how to make it), not found = "?"
  var craftGeladen = false, craft = null;
  function zvCraftingLaden() {
    if (craftGeladen) return; craftGeladen = true;
    fetch("daten/zombieville_crafting.json", { cache: "no-store" }).then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); }).then(function (c) {
      craft = c;
      $("zv-crafting-stand").textContent = c.gefunden + " von " + c.gesamt + " Rezepten gefunden";
      $("zv-crafting").innerHTML = c.rubriken.map(function (ru) {
        var n = ru.rezepte.length + ru.verborgen;
        return '<div class="zv-rubrik"><h3>' + esc(ru.name) + (n ? " <small>" + ru.rezepte.length + "/" + n + "</small>" : "") + "</h3>"
          + (n ? '<ul class="zv-karten">' + ru.rezepte.map(function (r) {
            var e = r.ergebnis[0] ? r.ergebnis[0].key : (r.zutaten[0] ? r.zutaten[0].key : "");
            return '<li><button type="button" class="zv-karte" data-rezept="' + esc(r.id) + '">' + ikone(e, "📦", 64).replace('class="zv-ikone"', 'class="zv-ikone" data-e="📦"')
              + '<span class="zv-karte-name">' + esc(r.name) + "</span>" + (r.geheim ? '<span class="zv-karte-geheim">entdeckt</span>' : "") + "</button></li>";
          }).join("") + new Array(ru.verborgen + 1).join('<li><div class="zv-karte zv-karte-zu" aria-label="Noch nicht gefunden"><span class="zv-fragezeichen">?</span><span class="zv-karte-name">Noch nicht gefunden</span></div></li>') + "</ul>"
          : '<p class="hinweis-klein">Kommt bald.</p>') + "</div>";
      }).join("");
    }).catch(function () { craftGeladen = false; $("zv-crafting").innerHTML = "<p>Die Rezepte konnten gerade nicht geladen werden.</p>"; });
  }
  function teil(t) { return '<li>' + ikone(t.key, "📦", 44).replace('class="zv-ikone"', 'class="zv-ikone" data-e="📦"') + '<span class="zv-teil-zahl">' + t.anzahl + "×</span><span>" + esc(t.name) + "</span></li>"; }
  function zvRezept(id) {
    var r = null; (craft ? craft.rubriken : []).forEach(function (ru) { ru.rezepte.forEach(function (x) { if (x.id === id) r = x; }); });
    if (!r) return;
    var e = r.ergebnis[0] ? r.ergebnis[0].key : (r.zutaten[0] ? r.zutaten[0].key : "");
    var h = '<div class="zv-rezept-kopf">' + ikone(e, "📦", 72).replace('class="zv-ikone"', 'class="zv-ikone" data-e="📦"') + "<h3>" + esc(r.name) + "</h3></div>";
    h += r.zutaten.length ? '<p class="hinweis-klein">Du brauchst</p><ul class="zv-teile">' + r.zutaten.map(teil).join("") + "</ul>" : '<p class="hinweis-klein">Ohne Zutaten</p>';
    if (r.ergebnis.length) h += '<p class="zv-pfeil" aria-hidden="true">↓</p><p class="hinweis-klein">Ergebnis</p><ul class="zv-teile">' + r.ergebnis.map(teil).join("") + "</ul>";
    h += '<dl class="zv-rezept-info">' + (r.station ? "<div><dt>Wo</dt><dd>" + esc(r.station) + "</dd></div>" : "") + (r.fertigkeit ? "<div><dt>Fertigkeit</dt><dd>" + esc(r.fertigkeit) + (r.xp ? " · " + r.xp + " Erfahrung" : "") + "</dd></div>" : "") + "</dl>";
    if (r.hinweis) h += '<p class="hinweis-klein">' + esc(r.hinweis) + "</p>";
    $("pop-inhalt").innerHTML = h; $("pop").hidden = false; $("pop-hg").hidden = false; $("pop").scrollTop = 0; $("pop-zu").focus();
  }
  document.addEventListener("click", function (ev) { var k = ev.target.closest("[data-rezept]"); if (k) zvRezept(k.getAttribute("data-rezept")); });
  function zvLager(l) {
    if (!l) { $("zv-lager-stand").textContent = "Noch kein Lagerbestand"; return; }
    $("zv-lager-stand").textContent = "Stand Tag " + l.tag + " · " + l.bewohner + " Bewohner";
    var html = (l.bestand || []).map(function (b) {
      var i = LAGER[b.id] || [lagerName(b.id), "📦"];
      return '<li class="zv-ware' + (b.anzahl ? "" : " zv-ware-leer") + '">' + ikone(b.id, i[1], 56).replace('class="zv-ikone"', 'class="zv-ikone zv-ware-ohne" data-e="' + esc(i[1]) + '"') +
        '<span class="zv-ware-zahl">' + b.anzahl + '</span><span class="zv-ware-name">' + esc(i[0]) + "</span></li>";
    }).join("");
    if (l.wasser) html += '<li class="zv-ware zv-ware-wasser">' + ikone("wasser", "💧", 56).replace('class="zv-ikone"', 'class="zv-ikone zv-ware-ohne" data-e="💧"') + '<span class="zv-ware-zahl">∞</span><span class="zv-ware-name">Wasser <small>aus dem ' + esc(String(l.wasser).replace(/\s*\(.*\)/, "")) + "</small></span></li>";
    $("zv-lager").innerHTML = html;
    var m = l.mitbringen || {}, teile = Object.keys(m).filter(function (k) { return m[k]; }).map(function (k) { return m[k] + " " + (ZAHLWORT[k] || (LAGER[k] || [lagerName(k)])[0]); });
    if (teile.length) { $("zv-lager-regel").innerHTML = "<strong>Jeder neue Bewohner bringt " + esc(teile.join(" und ")) + " mit.</strong> Das kommt direkt ins Lager."; $("zv-lager-regel").hidden = false; }
  }
  // Zombieville data: daten/zombieville.json (Tools/Kommentare/zombieville.py) - only what the posted videos and comments show
  function zvLaden() {
    geladen = true;
    fetch("daten/zombieville.json", { cache: "no-store" }).then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); }).then(function (d) {
      $("zv-tag").textContent = d.tag;
      $("zv-ueberlebende").textContent = d.ueberlebende;
      $("zv-einzug-titel").textContent = "Ziehen an " + d.einzugTag + " ein";
      $("zv-einzug").textContent = d.einzug;
      // no Instagram video blocks any more (Thomas 28.10.2026); the story instead (comments never)
      ZV = d;
      zvStory();
      // only summarised, neutral ideas and roles with a count - no names, no comment text (Thomas 26.10.2026)
      if (d.ideen && d.ideen.length) {
        $("zv-ideen").innerHTML = d.ideen.map(function (i) { return '<li><span class="zv-idee-text">' + esc(i.idee) + '</span><span class="zv-anzahl">' + i.anzahl + "×</span></li>"; }).join("");
        $("zv-ideen-block").hidden = false;
      }
      zvLager(d.lager);
      if (d.rollen && d.rollen.length) {
        $("zv-rollen").innerHTML = d.rollen.map(function (r) { return "<li>" + esc(r.rolle) + '<span class="zv-anzahl">' + r.anzahl + "</span></li>"; }).join("");
        $("zv-rollen-block").hidden = false;
      }
    }).catch(function () { $("zv-einzug").textContent = "–"; geladen = false; $("zv-story-inhalt").innerHTML = '<p class="hinweis-klein">Die Story konnte gerade nicht geladen werden. Lade die Seite bitte neu.</p>'; });
  }
  // a link straight to a Zombieville tab (#zv-farm) opens it without the world chooser
  var h = decodeURIComponent(location.hash.slice(1));
  if (/^zv-/.test(h)) { tabStart = h.slice(3); welt("zombieville"); } else zeigen(true);
  $("welt-dorf").addEventListener("click", function () { welt("dorf"); });
  var wz = $("welt-zombie"); if (wz) wz.addEventListener("click", function () { welt("zombieville"); });
  var bd = $("welt-wechseln-dorf"); if (bd) bd.addEventListener("click", function () { welt("dorf"); });
  var bz = $("welt-wechseln-zombie"); if (bz) bz.addEventListener("click", function () { welt("zombieville"); });
  var bz2 = $("welten-zurueck"); if (bz2) bz2.addEventListener("click", function () { zeigen(true); });
})();
