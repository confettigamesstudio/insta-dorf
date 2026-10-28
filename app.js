// Das Instagram-Dorf: tabs Story / Dorfbewohner / Lager / Eure Wünsche / Karte / Unterstuetzen (the old "Dorf" tab lives on the map since 26.10.2026), a profile per name. Data: daten/dorf.json (built by Webseite/bauen.py).
(function () {
  "use strict";
  var D = null, byName = {}, nameRe = null, filter = "alle", shown = 120, tag = null, komplett = false;
  var $ = function (id) { return document.getElementById(id); };
  var SCHILDER = { dorfplatz: "Marktplatz", kirche: "Kirche", theater: "Theater", lager: "Lager", lagerfeuer: "Lagerfeuer", schule: "Schule",
    krankenhaus: "Krankenhaus", muehle: "Wassermühle", militaer: "Militärbasis", forschung: "Forschung", schwimmbad: "Heiße Quellen", acker: "Acker",
    gemuesegarten: "Gemüsegarten", restaurant: "Restaurant", leberkaese: "Leberkäse", doenerladen: "Döner",
    bauernhof: "Bauernhof", koppel: "Koppel", windmuehle: "Windmühle", fischer: "Fischer", wald: "Wald" };
  var TABS = ["story", "bewohner", "lager", "wuensche", "karte", "unterstuetzen"];
  var WERTE = [["saettigung", "Satt"], ["durst", "Getrunken"], ["waerme", "Warm"], ["energie", "Energie"], ["gesundheit", "Gesundheit"], ["glaube", "Glaube"]];
  var GRUPPEN = [
    ["Essen", ["Brot", "Fisch", "Fleisch", "Beeren", "Pilze", "Gemüse", "Milch", "Käse", "Eier", "Honig", "Obst", "Suppe", "Leberkäse"]],
    ["Zutaten", ["Weizen", "Mehl", "Kräuter", "Hanfsamen", "Salz", "Zucker"]],
    ["Brennstoff", ["Feuerholz", "Kohle", "Torf", "Reisig"]],
    ["Rohstoffe", ["Holz", "Stein", "Erz", "Eisen", "Wolle", "Fell", "Leder", "Hanffaser", "Gummi", "Lehm", "Ton"]],
  ];

  // click statistics (Umami, cookieless; only on instadorf.de, where the script is loaded)
  var suchTimer = null;
  function zaehlen(name, daten) { try { if (window.umami && window.umami.track) window.umami.track(name, daten || {}); } catch (e) { /* never break the page */ } }

  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  function link(n) { return '<button type="button" class="name-link" data-name="' + esc(n) + '">' + esc(n) + "</button>"; }
  function verlinken(text) {
    var t = esc(text).replace(/@([\w.]+)/g, function (m, n) { return byName[n] ? "\u0000" + n + "\u0001" : esc(n); });
    if (nameRe) t = t.replace(nameRe, function (m, pre, n) { return pre + "\u0000" + n + "\u0001"; });
    return t.replace(/\u0000([^\u0001]+)\u0001/g, function (m, n) { return link(n); });
  }
  // a figure from the portrait atlas; px = shown tile size, ox/oy = extra shift (to zoom on the head in the list)
  function figur(b, px, ox, oy) {
    var A = D.atlas;
    if (!A || b.bild == null || b.bild < 0) return "";
    var col = b.bild % A.spalten, row = Math.floor(b.bild / A.spalten), rows = Math.ceil(D.bewohner.length / A.spalten);
    return 'background-image:url(' + A.datei + ');background-size:' + (A.spalten * px) + "px auto;background-position:-" + (col * px + (ox || 0)) + "px -" + (row * px + (oy || 0)) + "px";
  }
  function tagName(t) { return t === 0 ? "Der Anfang" : "Tag " + t; }
  function supKlasse(b, pre) { var t = b.patreon || (b.krone ? 2 : 0); return t ? " " + pre + (t >= 3 ? " " + pre + "3" : "") : ""; }   // b.krone: the wedding couple on its wedding day

  function laden() {
    fetch("daten/dorf.json", { cache: "no-store" }).then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); }).then(function (d) {
      D = d;
      d.bewohner.forEach(function (b) { byName[b.name] = b; });
      var names = d.bewohner.map(function (b) { return b.name; }).filter(function (n) { return n.length > 3; })
        .sort(function (a, b) { return b.length - a.length; }).map(function (n) { return n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); });
      nameRe = names.length ? new RegExp("(^|[^\\w.\\u0000])(" + names.join("|") + ")(?![\\w])", "g") : null;
      tag = d.geschichte.tag;
      kopf(); tage(); story(); liste(); lager(); karteBauen(); vonHash();
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

  // ---------------------------------------------------------------- villagers
  function passt(b, q) {
    if (filter === "supporter" && !b.patreon) return false;
    if (filter === "krank" && !(b.krank && b.lebt)) return false;
    if (!q) return true;
    return b.name.toLowerCase().indexOf(q) >= 0 || (b.beruf || "").toLowerCase().indexOf(q) >= 0;
  }
  function liste() {
    var nk = D.bewohner.filter(function (b) { return b.krank && b.lebt; }).length;
    $("f-krank").textContent = "🤒 Krank · " + nk; $("f-krank").hidden = !nk && filter !== "krank";
    var q = $("suche").value.trim().toLowerCase().replace(/^@/, "");
    var treffer = D.bewohner.filter(function (b) { return passt(b, q); });
    if (q) treffer.sort(function (a, b) { return (b.name.toLowerCase().indexOf(q) === 0) - (a.name.toLowerCase().indexOf(q) === 0); });
    $("treffer").textContent = treffer.length === 0
      ? (filter === "krank" ? "Gerade ist niemand krank." : filter === "supporter" ? "Noch keine Supporter. Wer das Dorf unterstützt, bekommt eine Krone und erscheint hier." : "Niemand gefunden. Noch nicht eingezogen? Schreib deinen Beruf unter das neueste Video.")
      : treffer.length + " Bewohner";
    if (filter === "beruf") { $("liste").innerHTML = nachBeruf(treffer, q); return; }
    var html = treffer.slice(0, shown).map(function (b) {
      var neu = b.einzug === D.tag && !b.wartet;
      var cls = "eintrag" + (neu ? " neu" : "") + (b.wartet ? " warte" : "") + supKlasse(b, "sup");
      var marke = b.patreon ? '<span class="marke sup' + (b.patreon >= 3 ? " sup3" : "") + '">Supporter</span>'
        : b.krone ? '<span class="marke sup">Hochzeit</span>' : b.wartet ? '<span class="marke warte">zieht bald ein</span>' : !b.lebt ? '<span class="marke tot">verstorben</span>' : neu ? '<span class="marke neu">neu</span>' : "";
      return '<li><button type="button" class="' + cls + '" data-name="' + esc(b.name) + '"><span class="avatar" style="' + figur(b, 80, 16, 2) + '"></span>'
        + '<span class="txt"><span class="n">' + esc(b.name) + marke + krankMarke(b) + '</span><span class="b">' + esc(b.beruf) + "</span></span></button></li>";
    }).join("");
    if (treffer.length > shown) html += '<li class="mehr"><button type="button" class="chip" id="mehr">Weitere ' + (treffer.length - shown) + " anzeigen</button></li>";
    $("liste").innerHTML = html;
  }

  // by profession (Thomas 24.10.2026): the groups (Gesundheit, Sicherheit ...) fold open, inside each profession with its people
  function kurz(b) {
    return '<li><button type="button" class="eintrag' + supKlasse(b, "sup") + '" data-name="' + esc(b.name) + '"><span class="avatar" style="' + figur(b, 80, 16, 2) + '"></span>'
      + '<span class="txt"><span class="n">' + esc(b.name) + (b.patreon ? '<span class="marke sup' + (b.patreon >= 3 ? " sup3" : "") + '">Supporter</span>' : b.krone ? '<span class="marke sup">Hochzeit</span>' : "") + krankMarke(b) + '</span><span class="b">' + esc(b.beruf) + "</span></span></button></li>";
  }
  // sick villagers (Thomas 27.10.2026): small red tag with the illness, only the name of it, no cause
  function krankMarke(b) { return b.krank && b.lebt ? '<span class="marke krank">🤒 ' + esc(b.krank === true ? "krank" : b.krank) + "</span>" : ""; }
  function nachBeruf(treffer, q) {
    return (D.kategorien || ["Sonstige"]).map(function (k) {
      var leute = treffer.filter(function (b) { return (b.kategorie || "Sonstige") === k; });
      if (!leute.length) return "";
      var berufe = {};
      leute.forEach(function (b) { (berufe[b.beruf || "ohne Beruf"] = berufe[b.beruf || "ohne Beruf"] || []).push(b); });
      var namen = Object.keys(berufe).sort(function (a, b) { return berufe[b].length - berufe[a].length || a.localeCompare(b, "de"); });
      return '<li style="grid-column:1/-1"><details class="gruppe"' + (q ? " open" : "") + "><summary>" + esc(k) + "<small>" + leute.length + (leute.length === 1 ? " Bewohner" : " Bewohner") + "</small></summary>"
        + '<div class="gruppe-innen">' + namen.map(function (n) {
          return "<div><h4>" + esc(n) + " (" + berufe[n].length + ')</h4><ul class="liste">' + berufe[n].sort(function (a, b) { return a.name.localeCompare(b.name, "de"); }).map(kurz).join("") + "</ul></div>";
        }).join("") + "</div></details></li>";
    }).join("");
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
        if (hit.villager && D.karte.namen && D.karte.namen[hit.villager] && byName[D.karte.namen[hit.villager]]) profil(D.karte.namen[hit.villager]);
        else if (hit.house) { var i = D.karte.haeuser.findIndex(function (h) { return h.id === hit.house; }); if (i >= 0) kHaus(i); }
        else if (hit.gebaeude) kGebaeude(hit);
      }, function (t) { $("dorf3d-status").textContent = t; }, {
        verlauf: !!D.karte.verlauf,
        tag: tag || (/[?&]tag=(\d+)/.test(location.search) ? +RegExp.$1 : null),
        onTag: function (n) { dreiD.then(function (v) { if (v) v.ende(); starte3D(n); }); },
        wer: function (id) { var n = D.karte.namen && D.karte.namen[id], b = n && byName[n]; return n ? n + (b && b.beruf ? " (" + b.beruf + ")" : "") : "Jemand"; },
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
    var leute = o.wer.map(function (n) { return byName[n]; }).filter(Boolean);
    var h = "<h3>" + (info ? esc(info.name) : leute.length ? "Haus von " + esc(leute.map(function (b) { return b.name; }).join(", ")) : "Leeres Haus") + "</h3>";
    if (info) h += "<p>" + verlinken(info.text) + "</p>";
    if (leute.length) h += '<p class="hinweis-klein">' + (info ? "Hier wohnt und arbeitet:" : "Hier wohnt:") + '</p><div class="karte-leute">' + leute.map(function (b) {
      return '<button type="button" class="eintrag" data-name="' + esc(b.name) + '"><span class="avatar" style="' + figur(b, 80, 16, 2) + '"></span><span class="txt"><span class="n">' + esc(b.name) + '</span><span class="b">' + esc(b.beruf) + "</span></span></button>";
    }).join("") + "</div>";
    kInfo(h);
    zaehlen("Karte Haus", { art: info ? info.name : "Wohnhaus" });
  }
  // the people of a place by profession, each with a heading (Thomas 24.10.2026: in the school teachers and pupils apart)
  function nachGruppen(leute, zuerst) {
    var g = {};
    leute.forEach(function (b) { (g[b.beruf] = g[b.beruf] || []).push(b); });
    var namen = Object.keys(g).sort(function (a, b) {
      var ia = zuerst.indexOf(a), ib = zuerst.indexOf(b);
      return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib) || a.localeCompare(b, "de");
    });
    return namen.map(function (n) {
      return '<h4 class="pop-gruppe">' + esc(n) + " (" + g[n].length + ')</h4><div class="karte-leute">' + g[n].map(function (b) {
        return '<button type="button" class="eintrag" data-name="' + esc(b.name) + '"><span class="avatar" style="' + figur(b, 80, 16, 2) + '"></span><span class="txt"><span class="n">' + esc(b.name) + '</span><span class="b">' + esc(b.beruf) + "</span></span></button>";
      }).join("") + "</div>";
    }).join("");
  }
  // a building in the 3D village without a house: its place card if there is one, else everybody whose work spot is there
  function kGebaeude(hit) {
    var ort = (D.karte.orte || []).filter(function (o) { return Math.hypot(o.x - hit.x, o.z - hit.z) < (o.r || 10) + 4; })[0];
    if (ort && (D.dorf || []).some(function (d) { return d.id === ort.dorf; })) { kOrt(ort.dorf); return; }
    var leute = (D.karte.arbeit || []).filter(function (a) { return Math.hypot(a[1] - hit.x, a[2] - hit.z) < hit.r; })
      .map(function (a) { return byName[a[0]]; }).filter(Boolean);
    // during the day replay: who works inside right now (hidden figures at the building)
    var drin = hit.drinnen ? (hit.drinnen(hit.x, hit.z, hit.r) || []).map(function (n) { return byName[n]; }).filter(Boolean) : [];
    kInfo("<h3>" + esc(hit.gebaeude) + "</h3>"
      + (drin.length ? '<p class="hinweis-klein">Arbeitet gerade hier (drinnen) ' + drin.length + ":</p>" + nachGruppen(drin, []) : "")
      + (leute.length ? '<p class="hinweis-klein">Hier arbeiten ' + leute.length + ":</p>" + nachGruppen(leute, []) : (drin.length ? "" : "<p>Hier arbeitet gerade niemand.</p>")));
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
    var leute = (ort.wer || []).map(function (n) { return byName[n]; }).filter(Boolean);
    kInfo("<h3>" + esc(info.name) + '</h3><img src="' + esc(info.bild) + '" alt="" style="width:100%;border-radius:12px;aspect-ratio:16/10;object-fit:cover"><p>' + verlinken(info.text) + "</p>"
      + (leute.length ? '<p class="hinweis-klein">' + (id === "schule" ? "In der Schule sind " : "Hier arbeiten ") + leute.length + ":</p>" + nachGruppen(leute, id === "schule" ? ["Lehrer", "Schüler"] : []) : ""));
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

  // ---------------------------------------------------------------- profile
  function stufe(v) { return v >= 60 ? "" : v >= 35 ? "mittel" : "niedrig"; }
  function profil(name) {
    var b = byName[name];
    if (!b) return;
    var h = '<div class="p-bild' + supKlasse(b, "sup") + '" role="img" aria-label="So sieht ' + esc(b.name) + ' im Dorf aus" style="' + figur(b, 160, 0, 0) + '"></div>';
    h += '<div class="p-kopf"><h2 id="p-name">' + esc(b.name) + '</h2><span class="beruf">' + esc(b.beruf) + "</span>";
    if (b.patreon) h += '<span class="sup-zeile">♛ Supporter · ' + esc(b.supporter) + "</span>";
    if (b.krone) h += '<span class="sup-zeile">♛ ' + esc(b.krone) + "</span>";
    h += '<span class="ort">' + (b.wartet ? "Zieht beim nächsten Tag ein" : "Eingezogen an Tag " + b.einzug + (b.viertel ? ", wohnt " + esc(b.viertel) : "")) + "</span></div>";
    var mehr = [["Arbeit", b.taetigkeit], ["Wohnt in", b.haus], ["Abends meist", b.abend], ["Hilft auch bei", b.nebenrolle]].filter(function (x) { return x[1]; });
    if (mehr.length) h += '<dl class="p-mehr">' + mehr.map(function (x) { return "<div><dt>" + x[0] + "</dt><dd>" + esc(x[1]) + "</dd></div>"; }).join("") + "</dl>";
    if (b.wartet) {
      h += '<div class="block"><p class="hinweis">Dein Kommentar ist angekommen. Du ziehst im nächsten Video ein, dann siehst du hier, was du im Dorf erlebst.</p></div>';
    } else if (!b.lebt) {
      h += '<div class="block"><p class="hinweis">' + esc(b.name) + " lebt nicht mehr im Dorf.</p></div>";
    } else {
      if (b.werte) {
        h += '<div class="block"><h3>So geht es ' + esc(b.name) + ' gerade</h3><p>Stimmung: <span class="laune">' + esc(b.laune) + "</span>"
          + (b.krank ? " · krank: " + esc(b.krank) : "") + '</p><div class="werte">';
        WERTE.forEach(function (w) {
          var v = b.werte[w[0]];
          if (v == null) return;
          v = Math.round(v);
          h += '<div class="wert"><span>' + w[1] + '</span><span class="balken"><i class="' + stufe(v) + '" style="width:' + Math.max(3, v) + '%"></i></span><span class="zahl">' + v + "</span></div>";
        });
        h += "</div></div>";
      }
      if (b.tagLauf && b.tagLauf.length) {
        h += '<div class="block"><h3>Tag ' + D.tag + " von " + esc(b.name) + '</h3><ol class="zeitleiste">';
        b.tagLauf.forEach(function (e) {
          var cls = e.art === "gefahr" ? "gefahr" : e.art === "neu" ? "neu" : e.art === "freund" ? "freund-z" : "";
          var text = e.art === "ereignis" || e.art === "gefahr" ? e.text : b.name + " " + e.text;
          h += '<li class="' + cls + '"><time>' + esc(e.zeit) + "</time><p>" + verlinken(text) + "</p></li>";
        });
        h += "</ol></div>";
      }
      if (b.freunde && b.freunde.length) {
        h += '<div class="block"><h3>Freunde im Dorf</h3><div class="freunde">' + b.freunde.map(function (f) {
          return '<button type="button" class="freund" data-name="' + esc(f.name) + '">' + esc(f.name) + "<small>" + esc(f.stufe) + "</small></button>";
        }).join("") + "</div></div>";
      }
    }
    $("profil-inhalt").innerHTML = h;
    $("profil").hidden = false; $("profil-hg").hidden = false;
    $("profil").scrollTop = 0;
    $("profil-zu").focus();
    if (/^[\w.~-]+$/.test(name)) { try { history.replaceState(null, "", "#" + name); } catch (e) { /* preview frame */ } }
  }
  function schliessen() {
    $("profil").hidden = true; $("profil-hg").hidden = true;
    var tab = TABS.filter(function (t) { return !$("panel-" + t).hidden; })[0] || "story";
    try { history.replaceState(null, "", "#" + tab); } catch (e) { /* ignore */ }
  }
  function vonHash() {
    var n = decodeURIComponent(location.hash.slice(1));
    if (n === "dorf") n = "karte";   // the old "Dorf" tab is on the map now
    if (TABS.indexOf(n) >= 0) { zeigeTab(n); return; }
    if (n && byName[n]) { zeigeTab("bewohner"); profil(n); }
  }

  document.addEventListener("click", function (ev) {
    var t = ev.target.closest("[data-name]");
    if (t && !$("pop").hidden) popZu();   // a name in the map window: the profile instead
    if (t) { zaehlen("Profil geöffnet", { von: t.classList.contains("eintrag") ? "Liste" : t.classList.contains("freund") ? "Freunde" : "Text" }); profil(t.getAttribute("data-name")); return; }
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
    if (ev.target.closest("#mehr")) { zaehlen("Mehr Bewohner"); shown += 240; liste(); return; }
    var md = ev.target.closest("[data-modus]");
    if (md) { modus(md.getAttribute("data-modus")); return; }
    var f = ev.target.closest("[data-filter]");
    if (f) {
      filter = f.getAttribute("data-filter"); shown = 120; zaehlen("Filter", { filter: filter });
      document.querySelectorAll("[data-filter]").forEach(function (x) { x.classList.toggle("aktiv", x === f); });
      liste();
    }
  });
  $("profil-zu").addEventListener("click", schliessen);
  $("pop-zu").addEventListener("click", popZu);
  $("pop-hg").addEventListener("click", popZu);
  $("profil-hg").addEventListener("click", schliessen);
  document.addEventListener("keydown", function (e) { if (e.key === "Escape" && !$("profil").hidden) schliessen(); else if (e.key === "Escape" && !$("pop").hidden) popZu(); });
  $("suche").addEventListener("input", function () {
    shown = 120; liste();
    clearTimeout(suchTimer);   // one event per search, not per letter
    suchTimer = setTimeout(function () { if ($("suche").value.trim()) zaehlen("Suche", { gefunden: $("liste").children.length > 0 ? "ja" : "nein" }); }, 1200);
  });
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

  // Zombieville tabs (Thomas 26.10.2026): Übersicht (default), Story + Bewohner (28.10.), Farm (3D map, only a view), Lager (stock); the tab is kept in the hash (#zv-farm)
  // Crafting is hidden since 28.10.2026 (comes into the game later): panel + code stay, add "crafting" here and its button in index.html to show it again
  var ZV_TABS = ["uebersicht", "story", "bewohner", "farm", "lager"], tabStart = null, farm = null;
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
  // buttons that jump to a tab (story teaser on the overview) + names in the story (open the resident list with that name)
  document.addEventListener("click", function (ev) {
    var g = ev.target.closest("[data-zvgehe]");
    if (g) { zvTab(g.getAttribute("data-zvgehe"), true); window.scrollTo(0, 0); return; }
    var n = ev.target.closest("[data-zvname]");
    if (n) { $("zv-suche").value = n.getAttribute("data-zvname"); zvGruppe = "alle"; zvTagF = "alle"; zvListe(); zvTab("bewohner", true); window.scrollTo(0, 0); }
  });

  // ---- Story (Thomas 28.10.2026): one told section per POSTED day, text + pictures (zombieville.py: geschichten_oeffentlich)
  var ZV = null, zvTagW = null, zvKomplett = false, zvNamen = {};
  function zvTagName(t) { return "Tag " + t; }
  // @name -> a link to the resident list when that person lives in the camp, else just bold
  function zvVerlinken(t) {
    return esc(t).replace(/@([A-Za-z0-9._]+[A-Za-z0-9_])/g, function (m, n) {
      return zvNamen[n.toLowerCase()] ? '<button type="button" class="zv-name" data-zvname="' + n + '">' + n + "</button>" : "<strong>" + n + "</strong>";
    });
  }
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

  // ---- Bewohner (Thomas 28.10.2026): Insta name + role + move-in day ONLY (no comment text, no ideas), grouped by role, search, day filter
  var zvGruppe = "alle", zvTagF = "alle", zvZeigen = 240;
  var ZV_FARBE = { "Führung": "#c99a1a", "Schutz": "#9a3b2a", "Versorgung": "#4f8a32", "Bauen & Technik": "#5e6b78", "Medizin & Forschung": "#2f7f8a", "Sonstige": "#7a5c8f" };
  function zvChip(attr, wert, text, aktiv) { return '<button type="button" class="chip' + (aktiv ? " aktiv" : "") + '" ' + attr + '="' + esc(wert) + '" aria-pressed="' + aktiv + '">' + text + "</button>"; }
  function zvListe() {
    if (!ZV) return;
    var alle = ZV.bewohner || [], q = $("zv-suche").value.trim().toLowerCase().replace(/^@/, "");
    var imTag = alle.filter(function (b) { return zvTagF === "alle" || b.tag === +zvTagF; });
    var gruppen = (ZV.gruppen || []).filter(function (g) { return alle.some(function (b) { return b.gruppe === g; }); });
    $("zv-gruppen").innerHTML = zvChip("data-zvgruppe", "alle", "Alle · " + imTag.length, zvGruppe === "alle") + gruppen.map(function (g) {
      return zvChip("data-zvgruppe", g, '<span class="zv-punkt" style="background:' + (ZV_FARBE[g] || "#777") + '"></span>' + esc(g) + " · " + imTag.filter(function (b) { return b.gruppe === g; }).length, zvGruppe === g);
    }).join("");
    var tage = []; alle.forEach(function (b) { if (tage.indexOf(b.tag) < 0) tage.push(b.tag); }); tage.sort(function (a, b) { return a - b; });
    $("zv-einzugstage").innerHTML = '<span class="zv-filter-titel">Eingezogen:</span>' + zvChip("data-zvtagf", "alle", "Alle Tage", zvTagF === "alle")
      + tage.map(function (t) { return zvChip("data-zvtagf", t, "Tag " + t, String(zvTagF) === String(t)); }).join("");
    var treffer = imTag.filter(function (b) {
      return (zvGruppe === "alle" || b.gruppe === zvGruppe) && (!q || b.name.toLowerCase().indexOf(q) >= 0 || b.rolle.toLowerCase().indexOf(q) >= 0);
    });
    $("zv-treffer").textContent = treffer.length ? treffer.length + (treffer.length === 1 ? " Überlebender" : " Überlebende")
      : "Niemand gefunden. Noch nicht eingezogen? Schreib unter das neueste Video, wie du hilfst.";
    // grouped: group heading, inside sorted by role (biggest roles first), then name
    var anzahl = {}; treffer.forEach(function (b) { anzahl[b.rolle] = (anzahl[b.rolle] || 0) + 1; });
    var rest = zvZeigen, html = "";
    gruppen.forEach(function (g) {
      var leute = treffer.filter(function (b) { return b.gruppe === g; });
      if (!leute.length || rest <= 0) return;
      leute.sort(function (a, b) { return (anzahl[b.rolle] - anzahl[a.rolle]) || a.rolle.localeCompare(b.rolle, "de") || a.name.localeCompare(b.name, "de"); });
      var teil = leute.slice(0, rest); rest -= teil.length;
      html += '<section class="zv-gruppe" style="--zv-farbe:' + (ZV_FARBE[g] || "#777") + '"><h3>' + esc(g) + " <small>" + leute.length + "</small></h3>"
        + '<ul class="zv-leute">' + teil.map(function (b) {
          return '<li class="zv-person' + (q && b.name.toLowerCase() === q ? " zv-person-treffer" : "") + '"><span class="zv-initiale" aria-hidden="true">' + esc(b.name.replace(/^[^A-Za-z0-9]+/, "").charAt(0).toUpperCase() || "?") + "</span>"
            + '<span class="zv-person-txt"><span class="zv-person-name">' + esc(b.name) + '</span><span class="zv-person-rolle">' + esc(b.rolle) + "</span></span>"
            + '<span class="zv-person-tag">Tag ' + b.tag + "</span></li>";
        }).join("") + "</ul></section>";
    });
    if (treffer.length > zvZeigen) html += '<p class="zv-mehr"><button type="button" class="chip" id="zv-mehr">Weitere ' + (treffer.length - zvZeigen) + " anzeigen</button></p>";
    $("zv-bewohner").innerHTML = html;
  }
  document.addEventListener("click", function (ev) {
    var c = ev.target.closest("[data-zvgruppe]");
    if (c) { zvGruppe = c.getAttribute("data-zvgruppe"); zvZeigen = 240; zvListe(); return; }
    c = ev.target.closest("[data-zvtagf]");
    if (c) { zvTagF = c.getAttribute("data-zvtagf"); zvZeigen = 240; zvListe(); return; }
    if (ev.target.closest("#zv-mehr")) { zvZeigen += 400; zvListe(); }
  });
  var zvSuchTimer = null;
  $("zv-suche").addEventListener("input", function () { clearTimeout(zvSuchTimer); zvSuchTimer = setTimeout(function () { zvZeigen = 240; zvListe(); }, 120); });
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
      // no Instagram video blocks any more (Thomas 28.10.2026); the story + residents instead (names allowed there, comments never)
      ZV = d; zvNamen = {};
      (d.bewohner || []).forEach(function (b) { zvNamen[b.name.toLowerCase()] = true; });
      zvStory(); zvListe();
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
