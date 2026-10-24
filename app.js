// Das Instagram-Dorf: tabs Story / Dorfbewohner / Lager, a profile per name. Data: daten/dorf.json (built by Webseite/bauen.py).
(function () {
  "use strict";
  var D = null, byName = {}, nameRe = null, filter = "alle", shown = 120, tag = null, komplett = false;
  var $ = function (id) { return document.getElementById(id); };
  var TABS = ["story", "karte", "bewohner", "dorf", "lager"];
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
  function supKlasse(b, pre) { return b.patreon ? " " + pre + (b.patreon >= 3 ? " " + pre + "3" : "") : ""; }

  function laden() {
    fetch("daten/dorf.json", { cache: "no-store" }).then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); }).then(function (d) {
      D = d;
      d.bewohner.forEach(function (b) { byName[b.name] = b; });
      var names = d.bewohner.map(function (b) { return b.name; }).filter(function (n) { return n.length > 3; })
        .sort(function (a, b) { return b.length - a.length; }).map(function (n) { return n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); });
      nameRe = names.length ? new RegExp("(^|[^\\w.\\u0000])(" + names.join("|") + ")(?![\\w])", "g") : null;
      tag = d.geschichte.tag;
      kopf(); tage(); story(); liste(); dorf(); lager(); karte(); vonHash();
    }).catch(function () { $("story-inhalt").innerHTML = '<p class="hinweis">Die Dorfdaten konnten gerade nicht geladen werden. Lade die Seite bitte neu.</p>'; });
  }

  function kopf() {
    $("kicker").textContent = "Tag " + D.tag;
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

  // ---------------------------------------------------------------- the village: its buildings
  function dorf() {
    $("dorf-inhalt").innerHTML = (D.dorf || []).map(function (h) {
      return '<article class="haus"><img src="' + esc(h.bild) + '" alt="' + esc(h.name) + '" loading="lazy" width="1000" height="625"><div class="htxt"><h3>' + esc(h.name)
        + (h.neu ? '<span class="marke neu">neu</span>' : "") + '</h3><span class="seit">' + (h.seit === 0 ? "Seit dem Anfang" : "Seit Tag " + h.seit) + "</span><p>" + verlinken(h.text) + "</p></div></article>";
    }).join("");
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
    if (filter === "neu" && !(b.einzug === D.tag && !b.wartet)) return false;
    if (filter === "warte" && !b.wartet) return false;
    if (filter === "supporter" && !b.patreon) return false;
    if (!q) return true;
    return b.name.toLowerCase().indexOf(q) >= 0 || (b.beruf || "").toLowerCase().indexOf(q) >= 0;
  }
  function liste() {
    var q = $("suche").value.trim().toLowerCase().replace(/^@/, "");
    var treffer = D.bewohner.filter(function (b) { return passt(b, q); });
    if (q) treffer.sort(function (a, b) { return (b.name.toLowerCase().indexOf(q) === 0) - (a.name.toLowerCase().indexOf(q) === 0); });
    $("treffer").textContent = treffer.length === 0
      ? (filter === "supporter" ? "Noch keine Supporter. Wer das Dorf unterstützt, bekommt eine Krone und erscheint hier." : "Niemand gefunden. Noch nicht eingezogen? Schreib deinen Beruf unter das neueste Video.")
      : treffer.length + " Bewohner";
    var html = treffer.slice(0, shown).map(function (b) {
      var neu = b.einzug === D.tag && !b.wartet;
      var cls = "eintrag" + (neu ? " neu" : "") + (b.wartet ? " warte" : "") + supKlasse(b, "sup");
      var marke = b.patreon ? '<span class="marke sup' + (b.patreon >= 3 ? " sup3" : "") + '">Supporter</span>'
        : b.wartet ? '<span class="marke warte">zieht bald ein</span>' : !b.lebt ? '<span class="marke tot">verstorben</span>' : neu ? '<span class="marke neu">neu</span>' : "";
      return '<li><button type="button" class="' + cls + '" data-name="' + esc(b.name) + '"><span class="avatar" style="' + figur(b, 80, 16, 2) + '"></span>'
        + '<span class="txt"><span class="n">' + esc(b.name) + marke + '</span><span class="b">' + esc(b.beruf) + "</span></span></button></li>";
    }).join("");
    if (treffer.length > shown) html += '<li class="mehr"><button type="button" class="chip" id="mehr">Weitere ' + (treffer.length - shown) + " anzeigen</button></li>";
    $("liste").innerHTML = html;
  }

  // ---------------------------------------------------------------- the map: tap a house, see who lives there
  var K = { s: 1, x: 0, y: 0, min: 1, w: 0, h: 0 }, kZeiger = {}, kStart = null, kBewegt = false;
  function karte() {
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
    $("karte-innen").innerHTML = h;
    K.w = M.breite; K.h = M.hoehe;
    $("karte-innen").style.width = K.w + "px"; $("karte-innen").style.height = K.h + "px";
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
  function kZeigen() { kBegrenzen(); $("karte-innen").style.transform = "translate(" + K.x + "px," + K.y + "px) scale(" + K.s + ")"; }
  function kZoom(f, cx, cy) {
    var box = $("karte").getBoundingClientRect();
    if (cx == null) { cx = box.width / 2; cy = box.height / 2; }
    var ns = Math.max(K.min, Math.min(K.s * f, K.min * 8)), k = ns / K.s;
    K.x = cx - (cx - K.x) * k; K.y = cy - (cy - K.y) * k; K.s = ns; kZeigen();
  }
  function kInfo(html) { $("karte-info").innerHTML = html; $("karte-info").hidden = false; }
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
  function kOrt(id) {
    var info = (D.dorf || []).filter(function (d) { return d.id === id; })[0];
    if (!info) return;
    kInfo("<h3>" + esc(info.name) + '</h3><img src="' + esc(info.bild) + '" alt="" style="width:100%;border-radius:12px;aspect-ratio:16/10;object-fit:cover"><p>' + verlinken(info.text) + "</p>");
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
    window.addEventListener("resize", function () { if (!$("panel-karte").hidden) kAnpassen(); });
  })();

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
    h += '<span class="ort">' + (b.wartet ? "Zieht beim nächsten Tag ein" : "Eingezogen an Tag " + b.einzug + (b.viertel ? ", wohnt " + esc(b.viertel) : "")) + "</span></div>";
    if (b.kommentar) h += '<p class="zitat">' + esc(b.kommentar) + "</p>";
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
    if (TABS.indexOf(n) >= 0) { zeigeTab(n); return; }
    if (n && byName[n]) { zeigeTab("bewohner"); profil(n); }
  }

  document.addEventListener("click", function (ev) {
    var t = ev.target.closest("[data-name]");
    if (t) { zaehlen("Profil geöffnet", { von: t.classList.contains("eintrag") ? "Liste" : t.classList.contains("freund") ? "Freunde" : "Text" }); profil(t.getAttribute("data-name")); return; }
    var tab = ev.target.closest("[data-tab]");
    if (tab) { zaehlen("Reiter", { reiter: tab.getAttribute("data-tab") }); zeigeTab(tab.getAttribute("data-tab"), true); return; }
    var tg = ev.target.closest("[data-tag]");
    if (tg) { tag = +tg.getAttribute("data-tag"); zaehlen("Tag gewählt", { tag: tag }); komplett = false; story(); return; }
    if (ev.target.closest("#komplett")) { if (!komplett) zaehlen("Komplette Geschichte"); komplett = !komplett; story(); $("panel-story").scrollIntoView({ block: "start" }); return; }
    if (ev.target.closest("#mehr")) { zaehlen("Mehr Bewohner"); shown += 240; liste(); return; }
    var f = ev.target.closest("[data-filter]");
    if (f) {
      filter = f.getAttribute("data-filter"); shown = 120; zaehlen("Filter", { filter: filter });
      document.querySelectorAll("[data-filter]").forEach(function (x) { x.classList.toggle("aktiv", x === f); });
      liste();
    }
  });
  $("profil-zu").addEventListener("click", schliessen);
  $("profil-hg").addEventListener("click", schliessen);
  document.addEventListener("keydown", function (e) { if (e.key === "Escape" && !$("profil").hidden) schliessen(); });
  $("suche").addEventListener("input", function () {
    shown = 120; liste();
    clearTimeout(suchTimer);   // one event per search, not per letter
    suchTimer = setTimeout(function () { if ($("suche").value.trim()) zaehlen("Suche", { gefunden: $("liste").children.length > 0 ? "ja" : "nein" }); }, 1200);
  });
  window.addEventListener("hashchange", vonHash);
  laden();
})();
