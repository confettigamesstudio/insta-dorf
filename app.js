// Das Instagram-Dorf: tabs Story / Dorfbewohner / Lager, a profile per name. Data: daten/dorf.json (built by Webseite/bauen.py).
(function () {
  "use strict";
  var D = null, byName = {}, nameRe = null, filter = "alle", shown = 120, tag = null, komplett = false;
  var $ = function (id) { return document.getElementById(id); };
  var TABS = ["story", "bewohner", "dorf", "lager"];
  var WERTE = [["saettigung", "Satt"], ["durst", "Getrunken"], ["waerme", "Warm"], ["energie", "Energie"], ["gesundheit", "Gesundheit"], ["glaube", "Glaube"]];
  var GRUPPEN = [
    ["Essen", ["Brot", "Fisch", "Fleisch", "Beeren", "Pilze", "Gemüse", "Milch", "Käse", "Eier", "Honig", "Obst", "Suppe", "Leberkäse"]],
    ["Zutaten", ["Weizen", "Mehl", "Kräuter", "Hanfsamen", "Salz", "Zucker"]],
    ["Brennstoff", ["Feuerholz", "Kohle", "Torf", "Reisig"]],
    ["Rohstoffe", ["Holz", "Stein", "Erz", "Eisen", "Wolle", "Fell", "Leder", "Hanffaser", "Gummi", "Lehm", "Ton"]],
  ];

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
      kopf(); tage(); story(); liste(); dorf(); lager(); vonHash();
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
    if (t) { profil(t.getAttribute("data-name")); return; }
    var tab = ev.target.closest("[data-tab]");
    if (tab) { zeigeTab(tab.getAttribute("data-tab"), true); return; }
    var tg = ev.target.closest("[data-tag]");
    if (tg) { tag = +tg.getAttribute("data-tag"); komplett = false; story(); return; }
    if (ev.target.closest("#komplett")) { komplett = !komplett; story(); $("panel-story").scrollIntoView({ block: "start" }); return; }
    if (ev.target.closest("#mehr")) { shown += 240; liste(); return; }
    var f = ev.target.closest("[data-filter]");
    if (f) {
      filter = f.getAttribute("data-filter"); shown = 120;
      document.querySelectorAll("[data-filter]").forEach(function (x) { x.classList.toggle("aktiv", x === f); });
      liste();
    }
  });
  $("profil-zu").addEventListener("click", schliessen);
  $("profil-hg").addEventListener("click", schliessen);
  document.addEventListener("keydown", function (e) { if (e.key === "Escape" && !$("profil").hidden) schliessen(); });
  $("suche").addEventListener("input", function () { shown = 120; liste(); });
  window.addEventListener("hashchange", vonHash);
  laden();
})();
