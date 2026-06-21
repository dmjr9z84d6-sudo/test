import React, { useState, useRef, useEffect, useContext, createContext, Fragment } from "react";
import {
  ACCENT, DEFAULT_GEWERKE_LISTE, DEFAULT_KATEGORIEN, DEFAULT_LEISTUNGEN,
  DEFAULT_ROLLEN, DEFAULT_VERWENDUNGEN, FIRMEN_FARBE, FS, FW, KONTAKTE_FARBE,
  RAD, formatKontaktName
} from "./constants.js";
import {
  isoHeute, istDatumGueltig, istEmailGueltig, istIbanGueltig, istPlzGueltig,
  istSteuerNrGueltig, istTelefonGueltig, istUrlGueltig, joinPlzOrt, matchScore,
  parseDatumWert
} from "./utils-basis.js";
import {
  DEFAULT_SETTINGS, ausgehendeBefugnisse, belegPhaseZuStatus, belegungsPhase,
  bewohnerRecht, istSelbstnutzerInEinheit, istVertragspartei,
  migriereKontaktZuweisungen, objektInGruppe, teileVon
} from "./datenmodell.js";

// ╔═════════════════════════════════════════════════════════════════════════╗
// ║ SEKTION 3 · UTILS & ICONS — ausgelagertes Modul                         ║
// ║ Heroicons (ICON_PATHS, I-Komponente) · Contexts · genRechnungsadresse   ║
// ╚═════════════════════════════════════════════════════════════════════════╝

// ── Heroicons SVG-Pfade ─────────────────────────────────────────────────────
// ── scrollToCard: scrollt eine Karte (per id) so, dass sie unter dem sticky
//    Header sichtbar wird. Verhalten ist konsistent: die Karte landet IMMER
//    direkt unter dem Header, egal wo sie vorher war. Skip nur wenn die
//    Karte schon exakt an dieser Position sitzt (vermeidet flackerndes
//    Re-Scrollen bei wiederholten Klicks). ──────────────────────────────────
// ── StickySectionHeader: Header eines Screens (Objekte, Kontakte,
//    Einstellungen) der unterhalb des App-Headers sticky bleibt. Misst seine
//    eigene Höhe und exponiert sie als CSS-Variable --ad-section-h, damit
//    Master-Detail-Spalten passend positioniert werden können. ──────────────
// ── useCardWidth: misst die Container-Breite und berechnet die Karten-Breite
//    nach der gleichen Logik wie `repeat(auto-fill, minmax(minCard, 1fr))`,
//    damit Master-Detail-Layouts dieselbe Karten-Breite verwenden können wie
//    die Grid-Übersicht (kein Sprung beim Aufklappen). ──────────────────────
function useCardWidth(minCard = 280, gap = 10) {
  const ref = useRef(null);
  const [w, setW] = useState(minCard);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const messen = () => {
      const cw = el.offsetWidth;
      if (cw <= 0) return;
      const cols = Math.max(1, Math.floor((cw + gap) / (minCard + gap)));
      const cardW = Math.floor((cw - (cols - 1) * gap) / cols);
      if (cardW > 0) setW(cardW);
    };
    messen();
    if (typeof ResizeObserver !== "undefined") {
      const ro = new ResizeObserver(messen);
      ro.observe(el);
      return () => ro.disconnect();
    }
    window.addEventListener("resize", messen);
    return () => window.removeEventListener("resize", messen);
  }, [minCard, gap]);
  return [ref, w];
}

// useMasterDetailLayout: entscheidet je nach verfügbarer Breite, wie viele
// Master-Spalten passen. Detail muss mindestens minDetailFactor × cardWidth
// breit sein. Es werden so viele Master-Spalten gewählt wie passen (bis maxCols),
// sonst runter bis 1, dann 0 (kein Master, nur Detail).
function useMasterDetailLayout(cardWidth, minDetailFactor = 1.1, gap = 10, maxCols = 5, detailFest = false, detailPx = null, maxAnteil = 0.6) {
  const ref = useRef(null);
  const [layout, setLayout] = useState({ masterCols: 2, masterWidth: cardWidth * 2 + gap,
    detailBreite: detailPx != null ? detailPx : Math.round(cardWidth * minDetailFactor), detailFest: detailFest });
  useEffect(() => {
    if (!ref.current) return;
    const messen = () => {
      const cw = ref.current.offsetWidth;
      if (cw <= 0) return;
      // Bei detailFest ist die Detailbreite eine px-Vorgabe (detailPx) — aber als
      // WUNSCH/MAXIMUM, nicht starr: Das Detail darf bis detailPx wachsen, wird
      // aber auf maxAnteil der Gesamtbreite gedeckelt und schrumpft mit, wenn der
      // Platz knapp wird. So entsteht nie ein quetschendes Verhältnis (z. B.
      // Detail 1200 neben einer 280px-Karte auf einem kleinen Schirm).
      if (detailFest && detailPx != null) {
        // Mindest-Kartenspalte, die daneben stehen bleiben muss; sonst Vollbild.
        const minSpalte = 280;
        // 1) Wunsch auf Anteil der Gesamtbreite deckeln (proportionale Obergrenze).
        const anteilMax = Math.round(cw * maxAnteil);
        let wunsch = Math.min(detailPx, anteilMax);
        // 2) Reicht der Rest für eine Mindestspalte? Wenn nicht → Detail weiter
        //    schrumpfen, bis genau minSpalte daneben passt …
        let masterRest = cw - gap - wunsch;
        if (masterRest < minSpalte) {
          wunsch = cw - gap - minSpalte;
          masterRest = minSpalte;
        }
        // 3) … aber wenn das Detail dadurch unter eine vernünftige Mindestbreite
        //    fiele, lieber Vollbild-Detail (Liste weicht ganz).
        const detailMin = Math.min(detailPx, 400);
        if (wunsch < detailMin) {
          setLayout({ masterCols: 0, masterWidth: 0, detailBreite: cw, detailFest: true });
          return;
        }
        // Spaltenzahl im verbleibenden Master-Bereich (mind. 1).
        let cols = Math.floor((masterRest + gap) / (cardWidth + gap));
        if (cols < 1) cols = 1;
        if (cols > maxCols) cols = maxCols;
        setLayout({ masterCols: cols, masterWidth: masterRest, detailBreite: wunsch, detailFest: true });
        return;
      }
      const wunschDetail = Math.round(cardWidth * minDetailFactor);
      // Klassisch (Einstellungen): Master in festen Spalten, Detail = Rest.
      const minDetail = wunschDetail;
      for (let cols = maxCols; cols >= 1; cols--) {
        const masterW = cardWidth * cols + (cols - 1) * gap;
        if (cw - masterW - gap >= minDetail) {
          setLayout({ masterCols: cols, masterWidth: masterW, detailBreite: 0, detailFest: false });
          return;
        }
      }
      setLayout({ masterCols: 0, masterWidth: 0, detailBreite: 0, detailFest: false });
    };
    messen();
    if (typeof ResizeObserver !== "undefined") {
      const ro = new ResizeObserver(messen);
      ro.observe(ref.current);
      return () => ro.disconnect();
    }
    window.addEventListener("resize", messen);
    return () => window.removeEventListener("resize", messen);
  }, [cardWidth, minDetailFactor, gap, maxCols, detailFest, detailPx, maxAnteil]);
  return [ref, layout];
}

function StickySectionHeader({ children, t, accent }) {
  const ref = useRef(null);
  const istDesktop = useWindowWidth() >= DESKTOP_MIN_WIDTH;
  useEffect(() => {
    if (!ref.current) return;
    const el = ref.current;
    const check = () => {
      document.documentElement.style.setProperty(
        "--ad-section-h", el.offsetHeight + "px");
    };
    check();
    if (typeof ResizeObserver !== "undefined") {
      const ro = new ResizeObserver(check);
      ro.observe(el);
      return () => {
        ro.disconnect();
        document.documentElement.style.setProperty("--ad-section-h", "0px");
      };
    }
    return () => {
      document.documentElement.style.setProperty("--ad-section-h", "0px");
    };
  }, []);
  return (
    <div ref={ref} style={{
      position: "sticky",
      // Der Content-Wrapper hat overflow:auto, daher klebt sticky am Content-Top
      // (= direkt unterhalb des App-Headers). Keine zusätzliche header-h nötig.
      top: 0,
      background: t.bg,
      zIndex: 5,
      // Oben/unten symmetrisch. Mobil deutlich schlanker als Desktop.
      paddingTop: istDesktop ? 8 : 4,
      paddingBottom: istDesktop ? 8 : 4,
      // Kein marginBottom: padding oben/unten allein hält den Abstand
      // symmetrisch. (Früher 8 unten → wirkte unten doppelt so groß.)
      marginBottom: 0,
      // Inhalt in einer Zeile halten — kein Wrap, der die Höhe ändern würde
      whiteSpace: "nowrap",
    }}>
      {children}
    </div>
  );
}

// ── SortierPfeile ────────────────────────────────────────────────────────────
// Systemweites Bauteil zum Umsortieren von Listen-Einträgen per Hoch-/Runter-
// Pfeil (ersetzt Drag&Drop). Pfeil ist deaktiviert (ausgegraut, nicht klickbar)
// am jeweiligen Rand (erster Eintrag: hoch aus; letzter: runter aus).
// onMove(richtung) wird mit -1 (hoch) bzw. +1 (runter) aufgerufen.
function SortierPfeile({ canUp, canDown, onUp, onDown, t, accent, size = 26, horizontal = false }) {
  const farbe = accent || t.text;
  const btn = (aktiv, onClick, icon, titel) => (
    <button type="button" disabled={!aktiv}
      onClick={(e) => { e.stopPropagation(); if (aktiv && onClick) onClick(); }}
      title={titel} aria-label={titel}
      style={{
        width: size, height: size, flexShrink: 0,
        display: "flex", alignItems: "center", justifyContent: "center",
        background: aktiv ? farbe + "18" : t.border + "18",
        border: "1px solid " + (aktiv ? farbe + "40" : t.border + "30"),
        borderRadius: RAD.sm, padding: 0,
        cursor: aktiv ? "pointer" : "default",
        opacity: aktiv ? 1 : 0.4,
        boxShadow: "none",
        fontFamily: "inherit", transition: "all 0.12s",
      }}>
      <I name={icon} size={Math.round(size * 0.55)} color={aktiv ? farbe : t.muted}/>
    </button>
  );
  return (
    <div style={{ display: "flex", flexDirection: horizontal ? "row" : "column", gap: 4, flexShrink: 0 }}>
      {btn(canUp, onUp, "chevU", "Nach oben")}
      {btn(canDown, onDown, "chevD", "Nach unten")}
    </div>
  );
}


function scrollToCard(elementId) {
  if (typeof window === "undefined" || typeof document === "undefined") return;
  const el = document.getElementById(elementId);
  if (!el) return;
  const rect = el.getBoundingClientRect();
  // Interner Scroll-Container (Desktop)? Dann DEN scrollen — window.scrollTo
  // läuft dort ins Leere (html/body overflow:hidden). Ziel: knapp unter die
  // Container-Oberkante (= oberes Drittel, §33; Auslauf via data-ad-auslauf).
  const scroller = findScrollParent(el);
  if (scroller) {
    const sRect = scroller.getBoundingClientRect();
    const delta = rect.top - sRect.top - 16;
    if (Math.abs(delta) < 5) return;
    const ziel = Math.max(0, scroller.scrollTop + delta);
    try { scroller.scrollTo({ top: ziel, behavior: "smooth" }); }
    catch (e) { scroller.scrollTop = ziel; }
    return;
  }
  // Body-Scroll (Mobile): unter den Sticky-Header.
  const headerEl = document.querySelector("[data-app-fixed-header]");
  const headerH = headerEl ? headerEl.offsetHeight + 16 : 200;
  if (Math.abs(rect.top - headerH) < 5) return;
  const targetY = window.scrollY + rect.top - headerH;
  window.scrollTo({ top: targetY, behavior: "smooth" });
}

// Findet den tatsächlich scrollenden Vorfahren eines Elements (oder null, wenn
// das Dokument selbst scrollt). Robuster als ein globales querySelector, da im
// Master-Detail-Layout mehrere Scroll-Container existieren.
function findScrollParent(el) {
  if (typeof window === "undefined" || !el) return null;
  let node = el.parentElement;
  while (node) {
    const oy = window.getComputedStyle(node).overflowY;
    if ((oy === "auto" || oy === "scroll") && node.scrollHeight > node.clientHeight + 2) {
      return node;
    }
    node = node.parentElement;
  }
  return null;
}

// Hält die Bildschirmposition einer Anker-Karte über einen React-State-Update
// hinweg stabil. Misst VOR dem Update die Viewport-Top der obersten sichtbaren
// Karte, ruft dann `commit()` (den State-Update) auf und korrigiert über einige
// Frames den richtigen Scroll-Container, sodass die Anker-Karte optisch
// stehenbleibt (kein Sprung nach oben). idPrefix z. B. "vwkarte-".
function haltePositionUeberUpdate(kartenIds, idPrefix, commit) {
  if (typeof window === "undefined" || typeof document === "undefined") { commit(); return; }
  const headerEl = document.querySelector("[data-app-fixed-header]");
  const headerH = headerEl ? headerEl.offsetHeight : 0;
  let ankerId = null, ankerTop = 0, ankerEl = null;
  let best = Infinity;
  (kartenIds || []).forEach(id => {
    const el = document.getElementById(idPrefix + id);
    if (!el) return;
    const top = el.getBoundingClientRect().top;
    // Anker = oberste Karte, die noch (knapp) unter dem Header sichtbar ist.
    const dist = Math.abs(top - headerH);
    if (top > headerH - 80 && dist < best) { best = dist; ankerId = id; ankerTop = top; ankerEl = el; }
  });
  // Fallback: irgendeine sichtbare Karte
  if (ankerId == null) {
    (kartenIds || []).some(id => {
      const el = document.getElementById(idPrefix + id);
      if (el) { ankerId = id; ankerTop = el.getBoundingClientRect().top; ankerEl = el; return true; }
      return false;
    });
  }
  const scroller = ankerEl ? findScrollParent(ankerEl) : null;
  commit();
  if (ankerId == null) return;
  let n = 0;
  const tick = () => {
    const el = document.getElementById(idPrefix + ankerId);
    if (el) {
      const delta = el.getBoundingClientRect().top - ankerTop;
      if (Math.abs(delta) >= 1) {
        if (scroller) scroller.scrollTop += delta;
        else window.scrollTo({ top: (window.scrollY || 0) + delta, behavior: "auto" });
      }
    }
    if (++n < 6) window.requestAnimationFrame(tick);
  };
  window.requestAnimationFrame(tick);
}

// ── stabilisiereScroll: GENERISCHE Scroll-Stabilisierung ───────────────────
// Hält die sichtbare Position über einen beliebigen DOM-/State-Update hinweg,
// OHNE dass der Aufrufer Karten-IDs oder ein Präfix kennen muss. Vorgehen:
//   1) Aktiven Scroll-Container finden (data-ad-scroll, sonst window).
//   2) Anker = oberstes Kind-Element, dessen Oberkante knapp unter der
//      Container-Oberkante liegt (das, worauf der Nutzer gerade schaut).
//      Es wird der DOM-Knoten selbst gemerkt (überlebt React-Reconciliation),
//      kein id nötig. Wird der Knoten entfernt, weicht die Korrektur auf das
//      erste noch vorhandene Kind aus.
//   3) commit() ausführen, dann über einige Frames scrollTop nachziehen, bis
//      die Anker-Oberkante wieder an alter Stelle sitzt.
// Damit lässt sich JEDE Listen-/Karten-Mutation (Hinzufügen, Löschen, Auf-/
// Zuklappen, Umsortieren) ohne Sprung umsetzen: einfach den State-Update in
// stabilisiereScroll(() => setX(...)) wickeln.
// stabilisiereScroll(commit): hält die sichtbare Position über einen beliebigen
// State-/DOM-Update. Anker wird per elementFromPoint an einer Referenzlinie
// erfasst — dadurch unabhängig von der DOM-Verschachtelung (egal wie tief die
// Karten unter dem Scroll-Container liegen).
function stabilisiereScroll(commit) {
  if (typeof window === "undefined" || typeof document === "undefined") { commit(); return; }
  const wurzel = findeAnkerWurzel();
  const wurzelScrollt = wurzel && wurzel.scrollHeight > wurzel.clientHeight + 2
    && (function () { const oy = window.getComputedStyle(wurzel).overflowY; return oy === "auto" || oy === "scroll"; })();
  const scroller = wurzelScrollt ? wurzel : null;
  // Referenzlinie: knapp unter dem App-Header (bzw. Wurzel-Top). Dort wird das
  // tatsächlich sichtbare Element abgegriffen.
  const headerEl = document.querySelector("[data-app-fixed-header]");
  const headerBottom = headerEl ? headerEl.getBoundingClientRect().bottom : 0;
  const wurzelTop = wurzel ? wurzel.getBoundingClientRect().top : 0;
  const refTop = Math.max(headerBottom, wurzelTop) + 2;
  const mitteX = wurzel
    ? (function () { const r = wurzel.getBoundingClientRect(); return Math.round((r.left + r.right) / 2); })()
    : Math.round(window.innerWidth / 2);
  // Anker = das Element an (mitteX, refTop), das im Scroll-Inhalt liegt. Wir
  // steigen vom Treffer so weit auf, dass wir ein DIREKTES, langlebiges Kind
  // unterhalb der Wurzel als Anker nehmen (überlebt React-Reconciliation besser
  // als ein tiefes Text-Leaf). Fällt elementFromPoint aus (alte Engines/Tests),
  // weichen wir auf das oberste direkte Kind knapp unter refTop aus.
  const kannPunkt = typeof document.elementFromPoint === "function";
  let ankerEl = null;
  if (kannPunkt) {
    const treffer = document.elementFromPoint(mitteX, refTop);
    if (treffer && wurzel && wurzel.contains(treffer)) {
      let node = treffer;
      while (node && node.parentElement && node.parentElement !== wurzel) {
        node = node.parentElement;
      }
      ankerEl = node;
    } else if (treffer) {
      ankerEl = treffer;
    }
  }
  if (!ankerEl && wurzel) {
    let best = Infinity;
    Array.prototype.slice.call(wurzel.children).forEach(el => {
      const top = el.getBoundingClientRect().top;
      const dist = Math.abs(top - refTop);
      if (top > refTop - 40 && dist < best) { best = dist; ankerEl = el; }
    });
  }
  const ankerTop = ankerEl ? ankerEl.getBoundingClientRect().top : refTop;

  commit();

  let n = 0;
  const tick = () => {
    // Anker noch im DOM? Sonst erneut per Punkt abgreifen (falls verfügbar).
    let ziel = ankerEl;
    if ((!ziel || !ziel.isConnected) && kannPunkt) {
      ziel = document.elementFromPoint(mitteX, refTop);
    }
    if (ziel && ziel.isConnected) {
      const delta = ziel.getBoundingClientRect().top - ankerTop;
      if (Math.abs(delta) >= 1) {
        if (scroller) scroller.scrollTop += delta;
        else window.scrollTo({ top: (window.scrollY || 0) + delta, behavior: "auto" });
      }
    }
    if (++n < 8) window.requestAnimationFrame(tick);
  };
  window.requestAnimationFrame(tick);
}

// Sichtbare Anker-Wurzel: der data-ad-scroll-Container mit der größten sicht-
// baren Fläche (im Master-Detail können mehrere existieren). Dient als Suchraum
// für das Anker-Element — unabhängig davon, ob er selbst oder der Body scrollt.
function findeAnkerWurzel() {
  if (typeof document === "undefined") return null;
  const kandidaten = Array.prototype.slice.call(document.querySelectorAll('[data-ad-scroll="y"]'));
  let best = null, bestFlaeche = -1;
  kandidaten.forEach(el => {
    const r = el.getBoundingClientRect();
    const sichtbar = Math.max(0, Math.min(r.bottom, window.innerHeight) - Math.max(r.top, 0));
    if (sichtbar > bestFlaeche) { bestFlaeche = sichtbar; best = el; }
  });
  return best;
}


const IC = {
  plus:    "M12 4.5v15m7.5-7.5h-15",
  link:    "M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m13.35-.622l1.757-1.757a4.5 4.5 0 00-6.364-6.364l-4.5 4.5a4.5 4.5 0 001.242 7.244",
  x:       "M6 18L18 6M6 6l12 12",
  check:   "M4.5 12.75l6 6 9-13.5",
  chevD:   "M19.5 8.25l-7.5 7.5-7.5-7.5",
  chevU:   "M4.5 15.75l7.5-7.5 7.5 7.5",
  chevR:   "M8.25 4.5l7.5 7.5-7.5 7.5",
  chevL:   "M15.75 19.5L8.25 12l7.5-7.5",
  sort:    "M3 7h12M3 12h9M3 17h6",
  search:  "M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z",
  building:"M3.75 21h16.5M4.5 3h15M5.25 3v18m13.5-18v18M9 6.75h1.5m-1.5 3h1.5m-1.5 3h1.5m3-6H15m-1.5 3H15m-1.5 3H15M9 21v-3.375c0-.621.504-1.125 1.125-1.125h3.75c.621 0 1.125.504 1.125 1.125V21",
  users:   "M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z",
  user:    "M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z",
  calendar:"M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5",
  document:"M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z",
  wrench:  "M11.42 15.17L17.25 21A2.652 2.652 0 0021 17.25l-5.877-5.877M11.42 15.17l2.496-3.03c.317-.384.74-.626 1.208-.766M11.42 15.17l-4.655 5.653a2.548 2.548 0 11-3.586-3.586l6.837-5.63m5.108-.233c.55-.164 1.163-.188 1.743-.14a4.5 4.5 0 004.486-6.336l-3.276 3.277a3.004 3.004 0 01-2.25-2.25l3.276-3.276a4.5 4.5 0 00-6.336 4.486c.091 1.076-.071 2.264-.904 2.95l-.102.085m-1.745 1.437L5.909 7.5H4.5L2.25 3.75l1.5-1.5L7.5 4.5v1.409l4.26 4.26m-1.745 1.437l1.745-1.437m6.615 8.206L15.75 15.75M4.867 19.125h.008v.008h-.008v-.008z",
  pencil:  "M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125",
  trash:   "M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0",
  drag:    "M3.75 9h16.5m-16.5 6.75h16.5",
  copy:    "M15.666 3.888A2.25 2.25 0 0013.5 2.25h-3c-1.03 0-1.9.693-2.166 1.638m7.332 0c.055.194.084.4.084.612v0a.75.75 0 01-.75.75H9a.75.75 0 01-.75-.75v0c0-.212.03-.418.084-.612m7.332 0c.646.049 1.288.11 1.927.184 1.1.128 1.907 1.077 1.907 2.185V19.5a2.25 2.25 0 01-2.25 2.25H6.75A2.25 2.25 0 014.5 19.5V6.257c0-1.108.806-2.057 1.907-2.185a48.208 48.208 0 011.927-.184",
  home:    "M2.25 12l8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25",
  arrow:   "M19.5 12L4.5 12m0 0l5.625-5.625M4.5 12l5.625 5.625",
  bell:    "M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0",
  calc:    "M15.75 15.75V18m-7.5-6.75h.008v.008H8.25v-.008zm0 2.25h.008v.008H8.25V13.5zm0 2.25h.008v.008H8.25v-.008zm0 2.25h.008v.008H8.25V18zm2.498-6.75h.007v.008h-.007v-.008zm0 2.25h.007v.008h-.007V13.5zm0 2.25h.007v.008h-.007v-.008zm0 2.25h.007v.008h-.007V18zm2.504-6.75h.008v.008h-.008v-.008zm0 2.25h.008v.008h-.008V13.5zm0 2.25h.008v.008h-.008v-.008zm0 2.25h.008v.008h-.008V18zm2.498-6.75h.008v.008h-.008v-.008zm0 2.25h.008v.008h-.008V13.5zM8.25 6h7.5v2.25h-7.5V6zM12 2.25c-1.892 0-3.758.11-5.593.322C5.307 2.7 4.5 3.65 4.5 4.757V19.5a2.25 2.25 0 002.25 2.25h10.5a2.25 2.25 0 002.25-2.25V4.757c0-1.108-.806-2.057-1.907-2.185A48.507 48.507 0 0012 2.25z",
  sparkles:"M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.455z",
  clock:   "M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z",
  lock:    "M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z",
  lockOpen:"M13.5 10.5V6.75a4.5 4.5 0 119 0v3.75M3.75 21.75h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H3.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z",
  settings:"M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.325.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.241-.438.613-.43.992a6.759 6.759 0 010 .255c-.008.378.137.75.43.991l1.004.827c.424.35.534.955.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.991a6.932 6.932 0 010-.255c.007-.38-.138-.751-.43-.992l-1.004-.827a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.213-1.281zM15 12a3 3 0 11-6 0 3 3 0 016 0z",
  paint:   "M9.53 16.122a3 3 0 00-5.78 1.128 2.25 2.25 0 01-2.4 2.245 4.5 4.5 0 008.4-2.245c0-.399-.078-.78-.22-1.128zm0 0a15.998 15.998 0 003.388-1.62m-5.043-.025a15.994 15.994 0 011.622-3.395m3.42 3.42a15.995 15.995 0 004.764-4.648l3.876-5.814a1.151 1.151 0 00-1.597-1.597L14.146 6.32a15.996 15.996 0 00-4.649 4.763m3.42 3.42a6.776 6.776 0 00-3.42-3.42",
  eye:     "M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178zM15 12a3 3 0 11-6 0 3 3 0 016 0z",
  eyeOff:  "M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.451 10.451 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.522 10.522 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88",
  badge:   "M9 12.75L11.25 15 15 9.75M21 12c0 1.268-.63 2.39-1.593 3.068a3.745 3.745 0 01-1.043 3.296 3.745 3.745 0 01-3.296 1.043A3.745 3.745 0 0112 21c-1.268 0-2.39-.63-3.068-1.593a3.746 3.746 0 01-3.296-1.043 3.745 3.745 0 01-1.043-3.296A3.745 3.745 0 013 12c0-1.268.63-2.39 1.593-3.068a3.745 3.745 0 011.043-3.296 3.746 3.746 0 013.296-1.043A3.746 3.746 0 0112 3c1.268 0 2.39.63 3.068 1.593a3.746 3.746 0 013.296 1.043 3.746 3.746 0 011.043 3.296A3.745 3.745 0 0121 12z",
  mail:    "M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75",
  chart:   "M2.25 18L9 11.25l4.306 4.306a11.95 11.95 0 015.814-5.518l2.74-1.22m0 0l-5.94-2.28m5.94 2.28l-2.28 5.941",
  ticket:  "M16.5 6v.75c0 .621-.504 1.125-1.125 1.125h-2.25c-.621 0-1.125.504-1.125 1.125v.75m4.5-3.75H6c-.621 0-1.125.504-1.125 1.125v10.5c0 .621.504 1.125 1.125 1.125h11.25c.621 0 1.125-.504 1.125-1.125V7.125c0-.621-.504-1.125-1.125-1.125zM9 12h7.5",
  sun:     "M12 3v2.25m6.364.386l-1.591 1.591M21 12h-2.25m-.386 6.364l-1.591-1.591M12 18.75V21m-4.773-4.227l-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0z",
  moon:    "M21.752 15.002A9.72 9.72 0 0118 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 003 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 009.002-5.998z",
  swap:    "M7.5 21L3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5",
  drop:    "M12 2.25c2.4 3 6 6.6 6 10.5a6 6 0 11-12 0c0-3.9 3.6-7.5 6-10.5z",
};

// ── I = Icon-Komponente ─────────────────────────────────────────────────────
function I({ name, size = 16, color = "currentColor", strokeWidth = 1.6 }) {
  const path = IC[name];
  if (!path) return null;
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke={color} strokeWidth={strokeWidth}
      strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink:0 }}>
      <path d={path}/>
    </svg>
  );
}

// ── ZurueckButton — EINHEITLICHER „Zurück"-Button für ALLE Master-Detail-Pfade
// (Objekte, Kontakte, Einstellungen, alle ObjektListeMitDetail-Bereiche).
// Vorher: 7 handkopierte Buttons, davon 5 mit kaputtem Icon-Namen
// "chevron-left" (nicht in IC → I rendert null → gar kein Pfeil). Jetzt EIN
// Bauplan, immer mit definiertem chevL. Siehe DESIGN §57 (Master-Detail).
//   variante="body"   → eigene Zeile über dem Detail (gap6, marginBottom8,
//                        alignSelf flex-start), Text „Zurück zur Liste".
//   variante="header" → kompakt rechts im Sticky-Header (marginLeft auto, gap4,
//                        flexShrink0), Text „Zurück".
function ZurueckButton({ onClick, variante = "body", t, label, kbZurueck = false }) {
  const istHeader = variante === "header";
  const text = label || (istHeader ? "Zur\u00fcck" : "Zur\u00fcck zur Liste");
  const style = istHeader
    ? { marginLeft: "auto", display: "flex", alignItems: "center", gap: 4,
        background: "none", border: `1px solid ${t.border}`, color: t.text,
        borderRadius: RAD.ms, padding: "0 12px", height: 36, boxSizing: "border-box",
        cursor: "pointer",
        fontFamily: "inherit", fontSize: FS.m, fontWeight: FW.medium, flexShrink: 0 }
    : { display: "flex", alignItems: "center", gap: 6,
        background: "none", border: `1px solid ${t.border}`, color: t.text,
        borderRadius: RAD.ms, padding: "6px 12px", cursor: "pointer",
        fontFamily: "inherit", fontSize: FS.m, fontWeight: FW.medium,
        marginBottom: 8, alignSelf: "flex-start" };
  const extra = kbZurueck ? { "data-kb-zurueck": "1" } : {};
  return (
    <button onClick={onClick} {...extra}
      title="Zur\u00fcck zur Liste" aria-label="Zur\u00fcck zur Liste" style={style}>
      <I name="chevL" size={12} color={t.text}/>
      {text}
    </button>
  );
}

// ── Hilfsfunktionen ─────────────────────────────────────────────────────────
const HV_ADRESSE = { name: "Muster Hausverwaltung GmbH", strasse: "Musterstr. 99", plzOrt: "80333 München" };

function genRechnungsadresse(fields) {
  const get = (n) => { const f = fields.find(x => x.name === n); return f ? f.value : ""; };
  const str = get("Straße");
  const plzOrt = joinPlzOrt(get("PLZ"), get("Ort")) || get("PLZ / Ort");
  if (!str && !plzOrt) return "—";
  return `${HV_ADRESSE.name}\nc/o ${str || "—"}\n${plzOrt || "—"}`;
}

// ── Storage-Layer ───────────────────────────────────────────────────────────
// Persistente Speicherung mit zwei Modi:
//
//   1) "lokal" — localStorage (überall verfügbar, auch in Safari)
//   2) "datei" — File System Access API (Chrome/Edge): ein vom User
//                gewählter Ordner wird Single Source of Truth
//
// WICHTIG zur API-Kompatibilität:
//   · storage.ladeDaten() / speichereDaten()  bleiben synchron
//   · localStorage läuft IMMER als Spiegel weiter, auch im Datei-Modus
//   · Datei-Schreibvorgänge laufen DEBOUNCED im Hintergrund
//   · Beim Start wird async aus der Datei nachgeladen — kommt evtl. erst
//     ein paar hundert ms nach dem Erst-Render an (storage.aufHydration(cb))
//
// So bricht die App nicht, wenn die Datei mal nicht erreichbar ist
// (Permission abgelaufen, Ordner verschoben, Browser ohne FSA-Support).

const STORAGE_KEYS = {
  settings: "allesda:settings",       // Settings pro User
  daten:    "allesda:daten",          // Kontakte, VEs (Arbeitsdaten)
  schema:   "allesda:schema",         // Schema-Version für Migrationen
  fsModus:  "allesda:fs:aktiv",       // "1" wenn Datei-Modus zuletzt aktiv war
};
const STORAGE_SCHEMA_VERSION = 1;

// FSA-Support einmal beim Modul-Laden prüfen
const FSA_VERFUEGBAR = typeof window !== "undefined"
  && typeof window.showDirectoryPicker === "function";

// ── Mini-Wrapper für IndexedDB (zum Persistieren des Ordner-Handles) ────────
const IDB_NAME = "allesda";
const IDB_STORE = "handles";

function idbOpen() {
  return new Promise(function(resolve, reject) {
    if (typeof indexedDB === "undefined") return reject(new Error("kein indexedDB"));
    const req = indexedDB.open(IDB_NAME, 1);
    req.onupgradeneeded = function(e) {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(IDB_STORE)) db.createObjectStore(IDB_STORE);
    };
    req.onsuccess = function() { resolve(req.result); };
    req.onerror = function() { reject(req.error); };
  });
}
function idbGet(key) {
  return idbOpen().then(function(db) {
    return new Promise(function(resolve, reject) {
      const tx = db.transaction(IDB_STORE, "readonly");
      const req = tx.objectStore(IDB_STORE).get(key);
      req.onsuccess = function() { resolve(req.result); };
      req.onerror = function() { reject(req.error); };
    });
  });
}
function idbSet(key, value) {
  return idbOpen().then(function(db) {
    return new Promise(function(resolve, reject) {
      const tx = db.transaction(IDB_STORE, "readwrite");
      tx.objectStore(IDB_STORE).put(value, key);
      tx.oncomplete = function() { resolve(true); };
      tx.onerror = function() { reject(tx.error); };
    });
  });
}
function idbDel(key) {
  return idbOpen().then(function(db) {
    return new Promise(function(resolve, reject) {
      const tx = db.transaction(IDB_STORE, "readwrite");
      tx.objectStore(IDB_STORE).delete(key);
      tx.oncomplete = function() { resolve(true); };
      tx.onerror = function() { reject(tx.error); };
    });
  });
}

// ── Globaler Status (Listener-Pattern für React-Komponenten) ────────────────
// Statuswerte für storageStatus.modus:
//   "lokal"          → nur localStorage (Standard, läuft überall)
//   "datei"          → File System Access aktiv, Auto-Save in Datei läuft
//   "datei-pause"    → Handle vorhanden, aber Permission fehlt / Fehler
//   "nicht-verf"     → localStorage ist blockiert (Sandbox / privat)
const storageStatus = {
  modus: "lokal",
  ordnerName: null,           // z. B. "AllesDa"
  letzteSpeicherung: null,    // Date-Objekt der letzten erfolgreichen Datei-Speicherung
  fehler: null,               // letzte Fehlermeldung (String) oder null
  fsaVerfuegbar: FSA_VERFUEGBAR,
};

const STATUS_EVT = "allesda:storage-status";
function statusUpdate(patch) {
  for (const k in patch) storageStatus[k] = patch[k];
  if (typeof window !== "undefined") {
    try {
      window.dispatchEvent(new CustomEvent(STATUS_EVT, { detail: { ...storageStatus } }));
    } catch (e) { /* IE-Edge-Fall: ignorieren */ }
  }
}

// ── FSA-Hilfsfunktionen ─────────────────────────────────────────────────────
let DIR_HANDLE = null;            // FileSystemDirectoryHandle (gewählter Ordner)
let DATEN_FILE_HANDLE = null;     // aktiv/daten.json
let SETTINGS_FILE_HANDLE = null;  // aktiv/einstellungen.json
// Cache: was wurde zuletzt erfolgreich in Datei geschrieben (verhindert
// unnötige Schreibvorgänge bei reinen Re-Renders)
let LETZTER_FLUSH = { daten: null, settings: null };

async function pruefePermission(handle, modus) {
  if (!handle || typeof handle.queryPermission !== "function") return true;
  const opts = { mode: modus || "readwrite" };
  let p = await handle.queryPermission(opts);
  if (p === "granted") return true;
  // requestPermission braucht eine User-Geste, sonst wirft es
  try {
    p = await handle.requestPermission(opts);
    return p === "granted";
  } catch (e) {
    return false;
  }
}

async function holeUnterordner(dirHandle, name) {
  return dirHandle.getDirectoryHandle(name, { create: true });
}
async function holeDateiHandle(dirHandle, dateiname) {
  return dirHandle.getFileHandle(dateiname, { create: true });
}
async function leseDateiAlsJson(fileHandle) {
  const file = await fileHandle.getFile();
  const text = await file.text();
  if (!text || !text.trim()) return null;
  return JSON.parse(text);
}
async function schreibeDateiAlsJson(fileHandle, obj) {
  const w = await fileHandle.createWritable();
  await w.write(JSON.stringify(obj, null, 2));
  await w.close();
}

// ── Debounced Flush in Datei ───────────────────────────────────────────────
// Sammelt aufeinanderfolgende speichereDaten/Settings-Aufrufe und schreibt
// erst nach FLUSH_DELAY ms in die Datei. So entstehen aus 20 Tipp-Aktionen
// nicht 20 Datei-Writes.
const FLUSH_DELAY = 600;
let flushTimer = null;
const flushQueue = { daten: null, settings: null };

function planeFlush(was, daten) {
  flushQueue[was] = daten;
  if (flushTimer) clearTimeout(flushTimer);
  flushTimer = setTimeout(fuehreFlushAus, FLUSH_DELAY);
}

async function fuehreFlushAus() {
  flushTimer = null;
  if (!DIR_HANDLE) return;
  // Permission noch da?
  const ok = await pruefePermission(DIR_HANDLE, "readwrite");
  if (!ok) {
    statusUpdate({ modus: "datei-pause",
      fehler: "Berechtigung für Ordner ist nicht mehr aktiv. Bitte erneut wählen." });
    return;
  }
  try {
    const aktivDir = await holeUnterordner(DIR_HANDLE, "aktiv");
    if (flushQueue.daten) {
      if (!DATEN_FILE_HANDLE) DATEN_FILE_HANDLE = await holeDateiHandle(aktivDir, "daten.json");
      await schreibeDateiAlsJson(DATEN_FILE_HANDLE, {
        typ: "allesda-daten",
        schema: STORAGE_SCHEMA_VERSION,
        gespeichertAm: new Date().toISOString(),
        ...flushQueue.daten,
      });
      LETZTER_FLUSH.daten = flushQueue.daten;
      flushQueue.daten = null;
    }
    if (flushQueue.settings) {
      if (!SETTINGS_FILE_HANDLE) SETTINGS_FILE_HANDLE = await holeDateiHandle(aktivDir, "einstellungen.json");
      await schreibeDateiAlsJson(SETTINGS_FILE_HANDLE, {
        typ: "allesda-settings",
        schema: STORAGE_SCHEMA_VERSION,
        gespeichertAm: new Date().toISOString(),
        ...flushQueue.settings,
      });
      LETZTER_FLUSH.settings = flushQueue.settings;
      flushQueue.settings = null;
    }
    statusUpdate({ modus: "datei", fehler: null, letzteSpeicherung: new Date() });
    // Komponenten informieren, dass die Datei aktuell ist (Dirty-Flag löschen)
    try {
      window.dispatchEvent(new CustomEvent("allesda:datei-saved",
        { detail: { quelle: "fsa-flush" } }));
    } catch (e) {}
  } catch (e) {
    console.warn("Datei-Flush fehlgeschlagen:", e);
    statusUpdate({ modus: "datei-pause", fehler: e.message || String(e) });
  }
}

// ── Rollen-Settings-Bereinigung (v11.81) ────────────────────────────────────
// Räumt die gespeicherte Rollen-DEFINITIONSLISTE (settings.rollen) auf:
//   · "Ansprechpartner (Objekt)" / "Ansprechpartner (Firma)" / "Ansprechpartner"
//     → eine einzige Rolle "Ansprechpartner" (Slot firma). Anzeige-Flags
//     (eckSichtbar/eckPosition/badgeSichtbar) des ZUERST gesehenen Eintrags
//     gewinnen; spätere Dubletten entfallen.
//   · "Wohnberechtigt" → "Wohnberechtigter" (nur Name; übrige Felder bleiben).
//   · "Bewohner" → entfernt (durch konkrete Wohnrechte ersetzt).
//   · "Eigennutzer" → entfernt (v11.92: keine Rolle mehr, nur Bewohner-Recht;
//     Selbstnutzung zeigt sich über goldenen Ring + „selbst bewohnt").
// Idempotent: bei bereits sauberer Liste wird die Original-Referenz zurückgegeben.
function bereinigeRollenSettings(rollen) {
  if (!Array.isArray(rollen)) return rollen;
  const UMBENENNEN = {
    "Ansprechpartner (Objekt)": "Ansprechpartner",
    "Ansprechpartner (Firma)":  "Ansprechpartner",
    "Wohnberechtigt":           "Wohnberechtigter",
  };
  const ENTFERNEN = { "Bewohner": true, "Sondereigentumsverwaltung": true, "Eigennutzer": true };
  let geaendert = false;
  const out = [];
  const gesehen = {}; // Name → Index in out (für Dedup nach Umbenennung)
  rollen.forEach(r => {
    if (!r || typeof r !== "object") { out.push(r); return; }
    if (ENTFERNEN[r.name]) { geaendert = true; return; }
    const neuName = UMBENENNEN[r.name];
    let eintrag = r;
    if (neuName && neuName !== r.name) {
      geaendert = true;
      // Slot auf "firma" zwingen, falls AP-Objekt (war "gremium") zusammengeführt wird.
      eintrag = (neuName === "Ansprechpartner")
        ? { ...r, name: neuName, slot: "firma" }
        : { ...r, name: neuName };
    }
    if (Object.prototype.hasOwnProperty.call(gesehen, eintrag.name)) {
      geaendert = true; // Dubletten-Eintrag (z. B. zweite AP-Variante) entfällt
      return;
    }
    gesehen[eintrag.name] = out.length;
    out.push(eintrag);
  });
  return geaendert ? out : rollen;
}

// ── Storage-Objekt (öffentliche API — bleibt kompatibel) ────────────────────
const storage = {
  // ── Settings ─────────────────────────────────────────────────────────────
  ladeSettings() {
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.settings);
      if (!raw) return null;
      // Gespeicherte Werte über die Defaults legen: fehlende Felder werden
      // generisch mit ihrem Default ergänzt (kein handgepflegtes Migrations-
      // Wirrwarr nötig). Gespeicherte Werte gewinnen.
      const geladen = Object.assign({}, DEFAULT_SETTINGS, JSON.parse(raw));
      // Einmal-Migration (v11.82): Rollen-Liste in den Settings aufräumen
      // (AP-Varianten → "Ansprechpartner", "Wohnberechtigt" → "Wohnberechtigter",
      // "Bewohner" + "Sondereigentumsverwaltung" raus). Idempotent.
      if (Array.isArray(geladen.rollen)) {
        geladen.rollen = bereinigeRollenSettings(geladen.rollen);
      }
      return geladen;
    } catch (e) {
      console.warn("Settings konnten nicht geladen werden:", e);
      return null;
    }
  },
  speichereSettings(settings) {
    let ok = true;
    try {
      localStorage.setItem(STORAGE_KEYS.settings, JSON.stringify(settings));
      localStorage.setItem(STORAGE_KEYS.schema, String(STORAGE_SCHEMA_VERSION));
    } catch (e) {
      console.warn("Settings konnten nicht in localStorage gespeichert werden:", e);
      ok = false;
    }
    // Wenn Datei-Modus aktiv: zusätzlich in Datei flushen (debounced)
    if (DIR_HANDLE) planeFlush("settings", { settings });
    return ok;
  },
  // ── Arbeitsdaten ─────────────────────────────────────────────────────────
  ladeDaten() {
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.daten);
      if (!raw) return null;
      return migriereZuweisungen(JSON.parse(raw));
    } catch (e) {
      console.warn("Daten konnten nicht geladen werden:", e);
      return null;
    }
  },
  speichereDaten(daten) {
    let ok = true;
    try {
      localStorage.setItem(STORAGE_KEYS.daten, JSON.stringify(daten));
      localStorage.setItem(STORAGE_KEYS.schema, String(STORAGE_SCHEMA_VERSION));
    } catch (e) {
      console.warn("Daten konnten nicht in localStorage gespeichert werden:", e);
      ok = false;
    }
    if (DIR_HANDLE) planeFlush("daten", daten);
    return ok;
  },
  // ── Reset ────────────────────────────────────────────────────────────────
  setzeZurueck(was) {
    try {
      if (was === "settings" || was === "alles") localStorage.removeItem(STORAGE_KEYS.settings);
      if (was === "daten"    || was === "alles") localStorage.removeItem(STORAGE_KEYS.daten);
      return true;
    } catch (e) { return false; }
  },
  speicherGroesse() {
    try {
      const s = localStorage.getItem(STORAGE_KEYS.settings) || "";
      const d = localStorage.getItem(STORAGE_KEYS.daten) || "";
      return { settings: s.length, daten: d.length, gesamt: s.length + d.length };
    } catch { return { settings: 0, daten: 0, gesamt: 0 }; }
  },
  istVerfuegbar() {
    try {
      const k = "allesda:probe";
      localStorage.setItem(k, "1");
      localStorage.removeItem(k);
      return true;
    } catch (e) {
      return false;
    }
  },

  // ── NEU: File System Access ──────────────────────────────────────────────
  fsaVerfuegbar() { return FSA_VERFUEGBAR; },

  status() { return { ...storageStatus }; },

  // Ordner wählen (User-Geste!). Speichert Handle in IndexedDB für
  // spätere Sessions.
  async waehleOrdner() {
    if (!FSA_VERFUEGBAR) {
      statusUpdate({ fehler: "Dieser Browser unterstützt keinen direkten Ordnerzugriff. Bitte Chrome oder Edge nutzen." });
      return false;
    }
    try {
      const handle = await window.showDirectoryPicker({
        id: "allesda-root",
        mode: "readwrite",
        startIn: "documents",
      });
      DIR_HANDLE = handle;
      DATEN_FILE_HANDLE = null;
      SETTINGS_FILE_HANDLE = null;
      try { await idbSet("dirHandle", handle); } catch (e) { /* persistieren optional */ }
      try { localStorage.setItem(STORAGE_KEYS.fsModus, "1"); } catch (e) {}
      statusUpdate({ modus: "datei", ordnerName: handle.name, fehler: null });
      return true;
    } catch (e) {
      // User-Abbruch ist kein Fehler
      if (e && e.name === "AbortError") return false;
      console.warn("Ordnerwahl fehlgeschlagen:", e);
      statusUpdate({ fehler: e.message || String(e) });
      return false;
    }
  },

  // Versucht, ein zuvor gespeichertes Handle aus IndexedDB wieder zu nutzen.
  // KEIN Re-Prompt — Permission wird nur abgefragt, nicht aktiv angefordert
  // (das geht erst nach einer User-Geste).
  async versucheOrdnerWiederherstellen() {
    if (!FSA_VERFUEGBAR) return false;
    try {
      const handle = await idbGet("dirHandle");
      if (!handle) return false;
      DIR_HANDLE = handle;
      // Permission nur queryen, nicht requesten
      let perm = "prompt";
      if (typeof handle.queryPermission === "function") {
        perm = await handle.queryPermission({ mode: "readwrite" });
      }
      if (perm === "granted") {
        statusUpdate({ modus: "datei", ordnerName: handle.name, fehler: null });
        return true;
      } else {
        statusUpdate({ modus: "datei-pause", ordnerName: handle.name,
          fehler: "Berechtigung muss erneut erteilt werden (einmal klicken)." });
        return false;
      }
    } catch (e) {
      console.warn("Handle-Wiederherstellung fehlgeschlagen:", e);
      return false;
    }
  },

  // Permission nach „pause"-Zustand erneut anfordern (braucht User-Geste).
  async aktiviereOrdnerErneut() {
    if (!DIR_HANDLE) return false;
    const ok = await pruefePermission(DIR_HANDLE, "readwrite");
    if (ok) {
      statusUpdate({ modus: "datei", fehler: null });
      return true;
    }
    return false;
  },

  // Aktuellen Datenstand aus Datei laden (für initiale Hydration und für
  // Re-Sync nach Fokus-Wechsel, wenn der User die Datei extern getauscht hat).
  async ladeDatenAusDatei() {
    if (!DIR_HANDLE) return null;
    const ok = await pruefePermission(DIR_HANDLE, "read");
    if (!ok) return null;
    try {
      const aktivDir = await holeUnterordner(DIR_HANDLE, "aktiv");
      if (!DATEN_FILE_HANDLE) {
        try { DATEN_FILE_HANDLE = await aktivDir.getFileHandle("daten.json"); }
        catch (e) { return null; /* Datei existiert noch nicht */ }
      }
      return await leseDateiAlsJson(DATEN_FILE_HANDLE);
    } catch (e) {
      console.warn("Lesen aus Datei fehlgeschlagen:", e);
      return null;
    }
  },
  async ladeSettingsAusDatei() {
    if (!DIR_HANDLE) return null;
    const ok = await pruefePermission(DIR_HANDLE, "read");
    if (!ok) return null;
    try {
      const aktivDir = await holeUnterordner(DIR_HANDLE, "aktiv");
      if (!SETTINGS_FILE_HANDLE) {
        try { SETTINGS_FILE_HANDLE = await aktivDir.getFileHandle("einstellungen.json"); }
        catch (e) { return null; }
      }
      return await leseDateiAlsJson(SETTINGS_FILE_HANDLE);
    } catch (e) {
      console.warn("Lesen Settings aus Datei fehlgeschlagen:", e);
      return null;
    }
  },

  // Trennt die Ordner-Anbindung. localStorage bleibt unberührt — App läuft
  // ab sofort wieder im lokalen Modus weiter.
  async trenneOrdner() {
    DIR_HANDLE = null;
    DATEN_FILE_HANDLE = null;
    SETTINGS_FILE_HANDLE = null;
    LETZTER_FLUSH = { daten: null, settings: null };
    if (flushTimer) { clearTimeout(flushTimer); flushTimer = null; }
    try { await idbDel("dirHandle"); } catch (e) {}
    try { localStorage.removeItem(STORAGE_KEYS.fsModus); } catch (e) {}
    statusUpdate({ modus: "lokal", ordnerName: null, fehler: null, letzteSpeicherung: null });
    return true;
  },

  // Statusänderungen abonnieren (für React-Komponenten via useEffect)
  abonniereStatus(callback) {
    if (typeof window === "undefined") return function() {};
    const handler = function(e) { callback(e.detail); };
    window.addEventListener(STATUS_EVT, handler);
    // Initial-Push, damit Komponenten den aktuellen Stand sofort haben
    setTimeout(function() { callback({ ...storageStatus }); }, 0);
    return function() { window.removeEventListener(STATUS_EVT, handler); };
  },
};

// ── Datei-Export / Import (manuelle Backups) ────────────────────────────────
function exportiereJSON(daten, dateiname) {
  try {
    const json = JSON.stringify(daten, null, 2);
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = dateiname;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 100);
    return true;
  } catch (e) {
    console.warn("Export fehlgeschlagen:", e);
    return false;
  }
}

// Prüft die Schema-Version einer importierten Datei. Gibt einen WARNTEXT
// zurück (String), wenn die Datei aus einem NEUEREN Schema stammt als die App
// kennt — sonst null. Der Text wird in der Inline-Bestätigungsbox angezeigt
// (kein window.confirm mehr: in iOS-Standalone-PWAs stumm kaputt, DESIGN
// §25.2). obj.appVersion fließt in die Meldung ein.
function schemaWarnung(obj) {
  const s = obj && typeof obj.schema === "number" ? obj.schema : null;
  if (s !== null && s > STORAGE_SCHEMA_VERSION) {
    const vTxt = obj.appVersion ? " (App-Version " + obj.appVersion + ")" : "";
    return "Diese Datei" + vTxt + " stammt aus einer neueren AllesDa-Version "
      + "(Format " + s + ", diese App kennt Format " + STORAGE_SCHEMA_VERSION + "). "
      + "Der Import kann unvollständig sein oder fehlschlagen.";
  }
  return null;
}

function importiereJSON(callback, onFehler) {
  // Lesefehler gehen an onFehler (Inline-Box beim Aufrufer) — alert() ist in
  // iOS-Standalone-PWAs unzuverlässig (DESIGN §25.2). Fallback bleibt alert.
  const fehler = (msg) => { if (onFehler) onFehler(msg); else alert(msg); };
  const input = document.createElement("input");
  input.type = "file";
  input.accept = ".json,application/json";
  input.style.display = "none";
  input.onchange = (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const obj = JSON.parse(ev.target.result);
        callback(obj, file.name);
      } catch (err) {
        fehler("Datei konnte nicht gelesen werden: " + err.message);
      }
    };
    reader.onerror = () => fehler("Datei konnte nicht gelesen werden.");
    reader.readAsText(file);
  };
  document.body.appendChild(input);
  input.click();
  setTimeout(() => { try { document.body.removeChild(input); } catch {} }, 1000);
}

// ── Excel-Import (AllesDa-Vorlage) ──────────────────────────────────────────
// Liest eine xlsx-Datei mit den fünf Tabellenblättern Objekte, Einheiten,
// Personen, Firmen, Zuordnungen und mappt sie in das App-interne Schema
// (kontakte[] + ves[] mit objektZuweisungen).
//
// SheetJS (XLSX) wird on demand von einem CDN nachgeladen, damit der Start
// der App nicht durch die ~600 KB große Bibliothek verlangsamt wird.

const SHEETJS_URL = "https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js";

function xlsxBereit() {
  return typeof window !== "undefined" && typeof window.XLSX !== "undefined";
}

function ladeXlsxLib() {
  if (xlsxBereit()) return Promise.resolve();
  return new Promise(function(resolve, reject) {
    const s = document.createElement("script");
    s.src = SHEETJS_URL;
    s.onload = function() { resolve(); };
    s.onerror = function() {
      reject(new Error("SheetJS-Bibliothek konnte nicht geladen werden. "
        + "Bitte Internetverbindung pr\u00fcfen."));
    };
    document.head.appendChild(s);
  });
}

// Verwaltungsart aus Excel-String ableiten (heuristisch, vorlagen-tolerant)
function mappeVerwaltungsart(str) {
  if (!str) return "weg";
  const s = String(str).toLowerCase();
  if (s.indexOf("weg") >= 0) return "weg";
  if (s.indexOf("miet") >= 0) return "miet";
  if (s.indexOf("sev") >= 0 || s.indexOf("se-") >= 0 || s.indexOf("sondereigentum") >= 0) return "sev";
  if (s.indexOf("gewerbe") >= 0) return "gewerbe";
  return "weg";
}



// ── Feld-Validatoren ────────────────────────────────────────────────────────
// Grundsatz: leeres Feld ist immer gültig (Pflicht-Charakter wird separat
// gehandhabt). Geprüft wird nur, ob eine VORHANDENE Eingabe plausibel ist.
// Bewusst tolerant — kein RFC-Pedantismus, nur offensichtlicher Unsinn fällt
// durch. Jede Funktion gibt true (gültig) / false (ungültig) zurück.








// Eigene Felder: Validierung primär über den Typ (date), ergänzend über
// Schlüsselwörter im Feldnamen (IBAN, Steuer-Nr., URL/Link/Homepage), da diese
// im Datenmodell als type:"text" gespeichert werden. Gibt true/false zurück;
// unbekannte Kombinationen gelten als gültig (keine Über-Validierung).
function feldWertGueltig(name, type, wert) {
  const w = String(wert == null ? "" : wert).trim();
  if (!w) return true;
  if (type === "date") return istDatumGueltig(w);
  const n = String(name || "").toLowerCase();
  if (/\biban\b/.test(n)) return istIbanGueltig(w);
  if (/steuer|ust|umsatzsteuer/.test(n)) return istSteuerNrGueltig(w);
  if (/url|link|homepage|webseite|website/.test(n)) return istUrlGueltig(w);
  return true;
}

// Gesamtvalidität eines Kontakt-Edit-Objekts: true, wenn ALLE vorhandenen
// Eingaben plausibel sind. Leere Felder sind gültig. Wird zum Blockieren des
// Speicherns genutzt (markieren + blockieren).
function kontaktAllesGueltig(edit) {
  if (!edit) return true;
  // Telefone (Personen: tels[]; Firmen: einzelnes tel)
  const tels = edit.tels || [];
  for (let i = 0; i < tels.length; i++) {
    if (!istTelefonGueltig(tels[i] && tels[i].nr)) return false;
  }
  if (edit.tel && !istTelefonGueltig(edit.tel)) return false;
  // E-Mails (Personen: emails[]; Firmen: einzelnes email)
  const emails = edit.emails || [];
  for (let i = 0; i < emails.length; i++) {
    if (!istEmailGueltig(emails[i] && emails[i].email)) return false;
  }
  if (edit.email && !istEmailGueltig(edit.email)) return false;
  // Homepage (Firma)
  if (edit.homepage && !istUrlGueltig(edit.homepage)) return false;
  // PLZ
  if (!istPlzGueltig(edit.plz)) return false;
  // Eigene Felder (Datum, IBAN, Steuer-Nr., URL …)
  const cf = edit.customFelder || [];
  for (let i = 0; i < cf.length; i++) {
    const f = cf[i] || {};
    if (f.typ === "address") continue; // Adress-Unterfelder nicht hart prüfen
    if (!feldWertGueltig(f.name, f.typ, f.wert)) return false;
  }
  return true;
}

// ── Zuweisungs-System (Schritt 1a: Datenschicht) ────────────────────────────

function migriereZuweisungen(daten) {
  if (!daten || typeof daten !== "object") return daten;
  const neu = { ...daten };
  if (Array.isArray(neu.kontakte)) neu.kontakte = neu.kontakte.map(migriereKontaktZuweisungen);
  return neu;
}

// Vereinheitlichte Badge-Liste für den Avatar aus den drei neuen Listen.
// Liefert flache Einträge { rolle, status, vorsitz } — der Avatar bestimmt die
// Eck-Position selbst aus der Rollendefinition (Slot). Fallback: objektZuweisungen.
// Optional auf ein Objekt gefiltert (objektId) — für Objekt-bezogene Ansichten.
// `ves` (optional): wird es übergeben, ergänzt die Funktion die LIVE aus den
// Belegungen abgeleiteten Rollen (Mieter/Pächter/… aus haushalt.mitglieder) —
// damit der Avatar dieselben Rollen zeigt wie die ROLLEN-Liste (die ohnehin aus
// belegungsRollenFuerKontakt liest). Ohne `ves` bleibt das Verhalten exakt wie
// zuvor (z. B. kompakte Picker ohne Belegungs-Badge). Der objektId-Filter gilt
// auch hier: im Objekt-Kontext nur die Belegung DIESES Objekts.
function belegungsZuweisungen(k, objektId, ves) {
  if (!Array.isArray(ves)) return [];
  return belegungsRollenFuerKontakt(k, ves)
    .filter(z => !objektId || z.objektId === objektId)
    .map(z => ({ rolle: z.rolle, status: z.status || "aktiv", vorsitz: false }));
}

function zuweisungenFuerAvatar(k, objektId, alleKontakte, ves) {
  if (!k) return [];
  const belegung = belegungsZuweisungen(k, objektId, ves);
  const hatNeu = Array.isArray(k.besitz) || Array.isArray(k.zustaendigkeiten) || Array.isArray(k.firmenRollen);
  if (!hatNeu) {
    const alt = Array.isArray(k.objektZuweisungen) ? k.objektZuweisungen : [];
    const altGefiltert = objektId ? alt.filter(z => z.objektId === objektId) : alt;
    return [...altGefiltert, ...belegung];
  }
  const out = [...belegung];
  (k.besitz || []).forEach(b => {
    if (objektId && b.objektId !== objektId) return;
    // Goldener Ring am Eck-Avatar bei Eigentümer-Selbstnutzung — analog zum Ring
    // an der Eigentümer-Rollenkarte (DESIGN §69.1). Quelle ist die Belegung der
    // zugehörigen Einheit (istSelbstnutzerInEinheit), nicht ein Flag.
    let selbstnutzend = false;
    if (!b.bis && Array.isArray(ves)) {
      const ve = ves.find(v => v && v.id === b.objektId);
      const einheit = ve && Array.isArray(ve.einheiten)
        ? ve.einheiten.find(e => e && e.id === b.einheitId) : null;
      if (einheit) selbstnutzend = istSelbstnutzerInEinheit(einheit, k.id);
    }
    out.push({ rolle: b.rolle || "Eigentümer", status: b.status || "aktiv", vorsitz: false, selbstnutzend });
  });
  (k.zustaendigkeiten || []).forEach(z => {
    const ziel = z.ziel || {};
    // Personen-/Firmen-Vertretung (ziel.art "kontakt") gehört als Rolle dem
    // VERTRETENEN nicht zu — sie löst beim Geber KEIN Badge aus. Das Badge des
    // Bevollmächtigten wird separat über eingehendeVertretungen abgeleitet.
    if (ziel.art === "kontakt") return;
    if (objektId && ziel.objektId !== objektId) return;
    out.push({ rolle: z.leistung, status: z.status || "aktiv", vorsitz: !!z.vorsitz, vertrag: !!z.vertrag });
  });
  // Firmen-Rollen (Anstellung) haben keinen Objektbezug — nur ohne objektId-Filter zeigen.
  if (!objektId) {
    (k.firmenRollen || []).forEach(f => {
      out.push({ rolle: f.rolle, status: f.status || "aktiv", vorsitz: false });
    });
    // Gewerke der Firma als Badge-Quelle (Sanitär=SN, …). Das Gewerk beschreibt,
    // was die Firma IST/KANN — unabhängig vom Objekt. Siehe Konzept Gewerke vs.
    // Leistungen. Die Eck-Logik im Avatar verteilt mehrere Gewerke auf die Ecken.
    (k.gewerke || []).forEach(g => {
      const name = typeof g === "string" ? g : (g && g.name);
      if (name) out.push({ rolle: name, status: "aktiv", vorsitz: false });
    });
  }
  // BEFUGNIS-Badge (Umbau-Spec §4): Trägt dieser Kontakt eine Befugnis (Vollmacht/
  // Betreuung) für jemanden aus, bekommt ER das Badge — nicht der Vollmachtgeber.
  // Neue Achse: k.verknuepfungen[].befugnis liegt direkt am Inhaber.
  // Legacy-Fallback: eingehendeVertretungen (alte zielKontaktId-Zuständigkeiten),
  // doppelte werden über ein Set vermieden.
  const befugnisGesehen = new Set();
  ausgehendeBefugnisse(k).forEach(b => {
    const rolle = b.art === "betreuung" ? "Betreuer" : "Bevollmächtigter";
    const key = String(b.zielKontaktId) + "|" + rolle;
    if (befugnisGesehen.has(key)) return;
    befugnisGesehen.add(key);
    out.push({ rolle, status: b.status || "aktiv", vorsitz: false });
  });
  if (!objektId && Array.isArray(alleKontakte)) {
    eingehendeVertretungen(k, alleKontakte).forEach(v => {
      // v.rolle = der Rollenname, den ein anderer Kontakt diesem hier zugewiesen hat.
      // Nur ergänzen, wenn nicht schon über die neue Achse erfasst.
      if (!v.rolle) return;
      const key = String((v.quelle && v.quelle.id)) + "|" + v.rolle;
      if (befugnisGesehen.has(key)) return;
      befugnisGesehen.add(key);
      out.push({ rolle: v.rolle, status: v.status || "aktiv", vorsitz: false });
    });
  }
  return out;
}

// Vollständige flache Zuweisungs-Liste aus den drei neuen Feldern rekonstruiert
// — in der Form, die der Kontakt-Detail-Block erwartet (rolle/status/objektId/
// einheitId/vorsitz/firmaId). Quelle für Anzeige (1c-1). Fallback: objektZuweisungen.
// Jeder Eintrag trägt _quelle ("besitz"|"zustaendigkeit"|"firmenrolle") und _idx,
// damit Schreib-Handler (1c-2) den Ursprung kennen.
// Eingehende Vertretungen: gegeben ein Kontakt (Ziel) und die volle Kontaktliste,
// liefert alle Zuweisungen anderer Kontakte, die diesen als zielKontaktId führen —
// also "wer hat DIESEN Kontakt als Bevollmächtigten/Betreuer benannt". Read-only
// abgeleitet (eine Quelle der Wahrheit beim Geber, keine Doppelspeicherung).
// Rückgabe: [{ quelle, rolle, status }]
function eingehendeVertretungen(zielKontakt, alleKontakte) {
  if (!zielKontakt || !Array.isArray(alleKontakte)) return [];
  const zid = String(zielKontakt.id);
  const out = [];
  alleKontakte.forEach(c => {
    if (String(c.id) === zid) return;
    (Array.isArray(c.zustaendigkeiten) ? c.zustaendigkeiten : []).forEach(z => {
      const ziel = z.ziel || {};
      if (ziel.art === "kontakt" && String(ziel.kontaktId) === zid) {
        out.push({ quelle: c, rolle: z.leistung || "", status: z.status || "aktiv" });
      }
    });
  });
  return out;
}

function flacheZuweisungen(k) {
  if (!k) return [];
  const hatNeu = Array.isArray(k.besitz) || Array.isArray(k.zustaendigkeiten) || Array.isArray(k.firmenRollen);
  if (!hatNeu) {
    return (Array.isArray(k.objektZuweisungen) ? k.objektZuweisungen : [])
      .map((z, i) => ({ ...z, _quelle: "alt", _idx: i }));
  }
  const out = [];
  (k.besitz || []).forEach((b, i) => {
    out.push({ rolle: b.rolle, status: b.status || "aktiv",
      objektId: b.objektId || null, einheitId: b.einheitId || null,
      _quelle: "besitz", _idx: i });
  });
  (k.zustaendigkeiten || []).forEach((z, i) => {
    const ziel = z.ziel || {};
    const e = { rolle: z.leistung, status: z.status || "aktiv",
      objektId: ziel.objektId || null, einheitId: ziel.einheitId || null,
      _quelle: "zustaendigkeit", _idx: i };
    if (ziel.art === "kontakt" && ziel.kontaktId != null) e.zielKontaktId = ziel.kontaktId;
    if (z.vorsitz) e.vorsitz = true;
    if (z.vertrag) e.vertrag = true;
    if (ziel.anlageId) e.anlageId = ziel.anlageId;
    if (z.vertragId) e.vertragId = z.vertragId;
    if (z.ansprechpartnerId) e.ansprechpartnerId = z.ansprechpartnerId;
    out.push(e);
  });
  (k.firmenRollen || []).forEach((f, i) => {
    out.push({ rolle: f.rolle, status: f.status || "aktiv",
      firmaId: f.firmaId, _quelle: "firmenrolle", _idx: i });
  });
  return out;
}

// Mieter-/Bewohner-/Pächter-Rollen eines Kontakts LIVE aus den Belegungen ALLER
// Objekte ableiten. Quelle der Wahrheit = Belegung-Tab (haushalt.mitglieder),
// nicht die gespeicherten Felder. Gibt READ-ONLY-Zeilen zurück (_quelle
// "belegung", _readonly), exakt nach dem Vorbild der eingehenden Vertretungen —
// damit der Kontakt-Detail-Block Belegungs-Rollen ohne Doppelpflege zeigt und
// die Zeilen NICHT editierbar/löschbar macht (Edit passiert am Belegung-Tab).
// Liefert []  wenn ves fehlt (z. B. Objekt-Filter-Kontext liefert ves separat).
function belegungsRollenFuerKontakt(k, ves) {
  if (!k || !Array.isArray(ves)) return [];
  const heute = isoHeute();
  const kid = String(k.id);
  const out = [];
  const gesehen = new Set(); // objektId|einheitId|rolle → Dedup
  ves.forEach(ve => {
    if (!ve || !Array.isArray(ve.einheiten)) return;
    ve.einheiten.forEach(einheit => {
      if (!einheit) return;
      teileVon(einheit).forEach(teil => {
        (teil.belegungen || []).forEach(b => {
          const status = belegPhaseZuStatus(belegungsPhase(b, heute));
          const hh = b.haushalt || { mitglieder: [] };
          // „Eigennutzer" ist KEINE Rolle (v11.92): das Recht "eigennutzer" erzeugt
          // generell keine abgeleitete Rolle/kein Badge. Selbstnutzung zeigt sich allein
          // über den goldenen Ring an der Eigentümer-Karte + „selbst bewohnt" an der
          // Einheit. Das Recht selbst bleibt unangetastet (Quelle für Ring/„selbst bewohnt").
          (hh.mitglieder || []).forEach(m => {
            if (!m || m.kontaktId == null || String(m.kontaktId) !== kid) return;
            if (m.recht === "eigennutzer") return;
            const rolle = bewohnerRecht(m.recht).label;
            const key = ve.id + "|" + einheit.id + "|" + rolle;
            if (gesehen.has(key)) return;
            gesehen.add(key);
            out.push({ rolle, status, objektId: ve.id, einheitId: einheit.id,
              _quelle: "belegung", _readonly: true });
          });
        });
      });
    });
  });
  return out;
}



// Liest ein Tabellenblatt als Array von Objekten (Header = Spaltennamen)
function parseSheetAlsObjekte(sheet) {
  if (!sheet) return [];
  return window.XLSX.utils.sheet_to_json(sheet, { defval: null, raw: false });
}

// Status einer Zuweisung aus Bis-Datum ableiten
function ableiteStatus(bisRoh) {
  const bis = parseDatumWert(bisRoh);
  if (bis && bis < new Date()) return "ehemalig";
  return "aktiv";
}

// Status aus Von/Bis-Datum + „beabsichtigt"-Flag ableiten (für die Beziehungs-Anlage).
//   beabsichtigt = true            → werdend (Wechsel schwebt, Datum oft noch offen)
//   Von in der Zukunft             → werdend
//   Bis gesetzt und in Vergangenheit → ehemalig
//   sonst                          → aktiv
function ableiteStatusVonBis(vonRoh, bisRoh, beabsichtigt) {
  if (beabsichtigt) return "werdend";
  const jetzt = new Date();
  const bis = parseDatumWert(bisRoh);
  if (bis && bis < jetzt) return "ehemalig";
  const von = parseDatumWert(vonRoh);
  if (von && von > jetzt) return "werdend";
  return "aktiv";
}

// Mapping Objekte → VEs (ohne Einheiten — die kommen separat)
function mappeObjekte(rows) {
  return rows
    .filter(function(r) { return r["Objekt-Nr."]; })
    .map(function(r) {
      const strasse = r["Stra\u00dfe + Hausnr."] || "";
      const plzOrt = ((r["PLZ"] || "") + " " + (r["Ort"] || "")).trim();
      const adresse = [strasse, plzOrt].filter(Boolean).join(", ");
      return {
        id: String(r["Objekt-Nr."]),
        nr: String(r["Objekt-Nr."]),
        verwaltungsart: mappeVerwaltungsart(r["Verwaltungsart"]),
        adresse: adresse,
        baujahr: r["Baujahr"] || null,
        verwaltung: {
          verwalter: r["Verwalter (Person)"] || null,
          buchhalter: r["Buchhalter (Person)"] || null,
          bestelltAb: r["Verwaltung ab"] || null,
          bestelltBis: r["Bestellt bis"] || null,
        },
        einheiten: [],
        haeuser: [],
        karten: [],
        notizen: r["Notiz"] || "",
      };
    });
}

// Verteilt Einheiten in ihre jeweiligen VEs.
// Gibt eine Map einheitId → veId zurück (für späteres Zuordnungen-Mapping).
function mappeEinheiten(rows, vesMap) {
  const einheitToVe = {};
  let verwaist = 0;
  rows
    .filter(function(r) { return r["Einheit-ID"] && r["Objekt-Nr."]; })
    .forEach(function(r) {
      const veId = String(r["Objekt-Nr."]);
      const ve = vesMap[veId];
      if (!ve) { verwaist++; return; }
      const einheitId = String(r["Einheit-ID"]);
      ve.einheiten.push({
        id: einheitId,
        typ: r["Typ"] || "Wohneigentum",
        bez: r["Einheit-Bez."] || "",
        flaeche: r["Fl\u00e4che m\u00b2"] || null,
        mea: r["MEA"] || "",
        etage: r["Lage"] || "",
        verwaltungsnr: r["Verwaltungsnr."] || null,
        zimmer: r["Zimmer"] || null,
        notizen: r["Notiz"] || "",
      });
      einheitToVe[einheitId] = veId;
    });
  return { einheitToVe: einheitToVe, verwaist: verwaist };
}

// Mapping Personen → Kontakte (typ="person")
function mappePersonen(rows) {
  return rows
    .filter(function(r) { return r["Person-ID"]; })
    .map(function(r) {
      const tels = [];
      if (r["Telefon Mobil"])    tels.push({ nr: String(r["Telefon Mobil"]),    typ: "mobil" });
      if (r["Telefon Festnetz"]) tels.push({ nr: String(r["Telefon Festnetz"]), typ: "festnetz" });
      const emails = [];
      if (r["E-Mail"]) emails.push({ email: String(r["E-Mail"]), typ: "privat" });
      const strasse = r["Stra\u00dfe + Hausnr."] || "";
      const plz = String(r["PLZ"] || "").trim();
      const ort = String(r["Ort"] || "").trim();
      return {
        id: String(r["Person-ID"]),
        typ: "person",
        anrede: r["Anrede"] || "",
        titel: r["Titel"] || "",
        vorname: r["Vorname"] || "",
        nachname: r["Nachname"] || "",
        tels: tels,
        emails: emails,
        strasse: strasse,
        plz: plz,
        ort: ort,
        adresseFavorit: true,
        objektZuweisungen: [],
        notizen: r["Notiz"] || "",
        customFelder: [],
      };
    });
}

// Mapping Firmen → Kontakte (typ="firma")
function mappeFirmen(rows) {
  return rows
    .filter(function(r) { return r["Firma-ID"]; })
    .map(function(r) {
      const strasse = r["Stra\u00dfe + Hausnr."] || "";
      const plz = String(r["PLZ"] || "").trim();
      const ort = String(r["Ort"] || "").trim();
      return {
        id: String(r["Firma-ID"]),
        typ: "firma",
        name: r["Firmenname"] || "",
        rechtsform: r["Rechtsform"] || "",
        gewerk: r["Gewerk"] || "",
        tel: r["Telefon"] || "",
        email: r["E-Mail"] || "",
        web: r["Web"] || "",
        strasse: strasse,
        plz: plz,
        ort: ort,
        ansprechpartner: r["Ansprechpartner"] || "",
        objektZuweisungen: [],
        mitarbeiter: [],
        notizen: r["Notiz"] || "",
        customFelder: [],
      };
    });
}

// Verteilt Zuordnungen (Einheit ↔ Person mit Rolle) auf die richtigen Kontakte.
// Spezialfall: "Beiratsvorsitz" → Rolle "Verwaltungsbeirat" + vorsitz: true.
function mappeZuordnungen(rows, kontakteMap, einheitToVe) {
  let zugewiesen = 0;
  let verwaist = 0;
  rows
    .filter(function(r) { return r["Einheit-ID"] && r["Person-ID"] && r["Rolle"]; })
    .forEach(function(r) {
      const kontakt = kontakteMap[String(r["Person-ID"])];
      const einheitId = String(r["Einheit-ID"]);
      const veId = einheitToVe[einheitId];
      if (!kontakt || !veId) { verwaist++; return; }
      let rolle = String(r["Rolle"]);
      let vorsitz = false;
      if (rolle.toLowerCase().indexOf("vorsitz") >= 0) {
        rolle = "Verwaltungsbeirat";
        vorsitz = true;
      }
      const zuweisung = {
        veId: veId,
        einheitId: einheitId,
        rolle: rolle,
        status: ableiteStatus(r["Bis (Datum)"]),
        von: r["Von (Datum)"] || null,
        bis: r["Bis (Datum)"] || null,
      };
      if (vorsitz) zuweisung.vorsitz = true;
      kontakt.objektZuweisungen.push(zuweisung);
      zugewiesen++;
    });
  return { zugewiesen: zugewiesen, verwaist: verwaist };
}

// Haupt-Funktion: liest eine xlsx-Datei und mappt sie in das App-Schema.
// Wirft bei harten Fehlern (Sheet fehlt, Datei korrupt). Sammelt weiche
// Warnungen (verwaiste Verweise) im Ergebnis.
async function importiereExcel(file) {
  await ladeXlsxLib();
  if (!xlsxBereit()) throw new Error("Excel-Bibliothek nicht verf\u00fcgbar.");

  const buffer = await file.arrayBuffer();
  let wb;
  try {
    wb = window.XLSX.read(buffer, { type: "array" });
  } catch (e) {
    throw new Error("Datei konnte nicht gelesen werden: " + (e.message || e));
  }

  const sheets = {
    objekte:     parseSheetAlsObjekte(wb.Sheets["Objekte"]),
    einheiten:   parseSheetAlsObjekte(wb.Sheets["Einheiten"]),
    personen:    parseSheetAlsObjekte(wb.Sheets["Personen"]),
    firmen:      parseSheetAlsObjekte(wb.Sheets["Firmen"]),
    zuordnungen: parseSheetAlsObjekte(wb.Sheets["Zuordnungen"]),
  };

  const fehler = [];
  const warnungen = [];

  if (!wb.Sheets["Objekte"]) {
    throw new Error("Das Tabellenblatt \u201EObjekte\u201C fehlt. "
      + "Stimmt das Format mit der AllesDa-Vorlage \u00fcberein?");
  }
  if (sheets.objekte.length === 0) {
    fehler.push("Tabellenblatt \u201EObjekte\u201C ist leer \u2014 ohne Objekte kann nichts importiert werden.");
  }

  // ID-Eindeutigkeit prüfen
  const veIds = sheets.objekte.map(function(r) { return String(r["Objekt-Nr."]); });
  const veDoppelt = veIds.filter(function(id, i) { return veIds.indexOf(id) !== i; });
  if (veDoppelt.length > 0) {
    warnungen.push("Doppelte Objekt-Nr.: " + Array.from(new Set(veDoppelt)).join(", "));
  }

  // Mapping
  const ves = mappeObjekte(sheets.objekte);
  const vesMap = {};
  ves.forEach(function(v) { vesMap[v.id] = v; });

  const einheitenInfo = mappeEinheiten(sheets.einheiten, vesMap);
  if (einheitenInfo.verwaist > 0) {
    warnungen.push(einheitenInfo.verwaist + " Einheit(en) verweisen auf ein unbekanntes Objekt");
  }

  const personen = mappePersonen(sheets.personen);
  const firmen   = mappeFirmen(sheets.firmen);
  const kontakte = personen.concat(firmen);
  const kontakteMap = {};
  kontakte.forEach(function(k) { kontakteMap[k.id] = k; });

  const zuordnungenInfo = mappeZuordnungen(sheets.zuordnungen, kontakteMap, einheitenInfo.einheitToVe);
  if (zuordnungenInfo.verwaist > 0) {
    warnungen.push(zuordnungenInfo.verwaist + " Zuordnung(en) verweisen auf unbekannte Einheit- oder Person-IDs");
  }

  const einheitenGesamt = ves.reduce(function(sum, v) { return sum + v.einheiten.length; }, 0);

  return {
    ves: ves,
    kontakte: kontakte.map(migriereKontaktZuweisungen),
    statistik: {
      objekte: ves.length,
      einheiten: einheitenGesamt,
      personen: personen.length,
      firmen: firmen.length,
      zuordnungen: zuordnungenInfo.zugewiesen,
    },
    warnungen: warnungen,
    fehler: fehler,
  };
}


// Stufe 1: exakter Substring (case-insensitive)
// Stufe 2: Diakritika-insensitive (Umlaute & Akzente ignorieren)
// Stufe 3: mehrere Such-Wörter (alle müssen vorkommen)
// Stufe 4: Kölner Phonetik (für deutsche Namen — Meier=Meyer=Mayer)
// Stufe 5: Levenshtein-Distance (Tippfehler-Toleranz)





// ── Header-Filter (globaler Grob-Filter im App-Header, DESIGN §32) ──────────
// Mehrfachauswahl über drei Sektionen: Verwalter/Buchhalter, Verwaltungsarten,
// Objekt-Gruppen. UND zwischen Sektionen, ODER innerhalb einer Sektion.
// Wirkt app-weit (Objekte, Kontakte, Kalender, Statistik, Listen, Schnelleingabe).
// Personen/Firmen-Mitfilterung ist je Sektion abschaltbar (settings.filterSektionen).
const HEADER_FILTER_LEER = { verwalter: [], arten: [], gruppen: [] };

function headerFilterIstAktiv(hf) {
  if (!hf) return false;
  return ((hf.verwalter || []).length > 0)
    || ((hf.arten || []).length > 0)
    || ((hf.gruppen || []).length > 0);
}

// Wirkungs-Konfiguration eines einzelnen Filter-Eintrags (z. B. eines
// Verwalters, einer Verwaltungsart, einer Objekt-Gruppe). Defaults: alles an.
//   anzeigen — Eintrag erscheint im Dropdown
//   personen — gesetzter Filter dieses Eintrags blendet unverbundene Personen aus
//   firmen   — dito für Firmen
//   termine  — gesetzter Filter beschränkt auch Kalender-Termine auf die Objekte
// settings.filterEintraege = { [sektion]: { [optionId]: { anzeigen, personen, firmen } } }
// Rückwärtskompatibel: settings.filterAktive[id] === false (alte Verwalter-
// Sichtbarkeit) gilt weiterhin als anzeigen=false.
function filterEintragConf(settings, sektion, id) {
  const alle = (settings && settings.filterEintraege) || {};
  const sek = alle[sektion] || {};
  const c = sek[id] || {};
  let anzeigen = c.anzeigen !== false;
  if (sektion === "verwalter" && anzeigen) {
    const alt = (settings && settings.filterAktive) || {};
    if (alt[id] === false) anzeigen = false;
  }
  return {
    anzeigen,
    personen: c.personen !== false,
    firmen:   c.firmen   !== false,
    termine:  c.termine  !== false,
  };
}

// Reduziert die gewählten Eintrags-IDs einer Sektion auf die, die für den
// scope wirken ("personen"/"firmen"/"termine": Eintrags-Flag an; "objekte": alle).
function reduziereAuswahl(ausw, settings, sektion, scope) {
  if (!scope || scope === "objekte") return ausw;
  return (ausw || []).filter(id => filterEintragConf(settings, sektion, id)[scope]);
}

// Passt ein Objekt zum Header-Filter? scope: "objekte" | "personen" | "firmen".
// Für personen/firmen wird die Auswahl je Sektion auf wirkende Einträge
// reduziert; eine leer reduzierte Sektion wirkt nicht.
function vePasstHeaderFilter(ve, hf, settings, objektGruppen, scope) {
  if (!headerFilterIstAktiv(hf)) return true;
  const vAusw = reduziereAuswahl(hf.verwalter || [], settings, "verwalter", scope);
  if (vAusw.length > 0) {
    const feld = ((settings && settings.filterTyp) || "verwalter") === "buchhalter" ? "buchhalter" : "verwalter";
    const wer = ve.verwaltung && ve.verwaltung[feld];
    if (vAusw.indexOf(wer) < 0) return false;
  }
  const aAusw = reduziereAuswahl(hf.arten || [], settings, "arten", scope);
  if (aAusw.length > 0) {
    if (aAusw.indexOf(ve.verwaltungsart || "weg") < 0) return false;
  }
  const gAusw = reduziereAuswahl(hf.gruppen || [], settings, "gruppen", scope);
  if (gAusw.length > 0) {
    const gruppen = (objektGruppen || []).filter(g => g && gAusw.indexOf(g.id) >= 0);
    let drin = false;
    for (let i = 0; i < gruppen.length; i++) {
      if (objektInGruppe(ve, gruppen[i])) { drin = true; break; }
    }
    if (!drin) return false;
  }
  return true;
}

// Wirkt der Filter überhaupt auf den Scope ("personen"/"firmen"/"termine")?
// Mind. ein gewählter Eintrag, dessen Flag an ist — sonst bleibt der Bereich
// ungefiltert (Personen/Firmen auch ohne Objektbezug, Kalender komplett).
function headerFilterWirktAufScope(hf, settings, scope) {
  if (!headerFilterIstAktiv(hf)) return false;
  return reduziereAuswahl(hf.verwalter || [], settings, "verwalter", scope).length > 0
    || reduziereAuswahl(hf.arten     || [], settings, "arten",     scope).length > 0
    || reduziereAuswahl(hf.gruppen   || [], settings, "gruppen",   scope).length > 0;
}

// Kontakte auf die mit den erlaubten Objekten verbundenen reduzieren.
// Personen: direkte Zuweisung (flacheZuweisungen → objektId) ODER Anstellung
// (firmenRollen) bei einer verbundenen Firma. Firmen: Zuweisung ODER Vertrag
// (ve.vertraege[].firmaId) an einem erlaubten Objekt.
function filtereKontakteNachHeaderFilter(kontakte, ves, hf, settings, objektGruppen, scopeP, scopeF) {
  if (!headerFilterIstAktiv(hf)) return kontakte;
  const sp = scopeP || "personen";
  const sf = scopeF || "firmen";
  const wirktP = headerFilterWirktAufScope(hf, settings, sp);
  const wirktF = headerFilterWirktAufScope(hf, settings, sf);
  if (!wirktP && !wirktF) return kontakte;
  const erlaubtP = {};
  const erlaubtF = {};
  ves.forEach(ve => {
    if (wirktP && vePasstHeaderFilter(ve, hf, settings, objektGruppen, sp)) erlaubtP[ve.id] = true;
    if (wirktF && vePasstHeaderFilter(ve, hf, settings, objektGruppen, sf)) erlaubtF[ve.id] = true;
  });
  // 1. Pass: verbundene Firmen bestimmen (für die Ansprechpartner-Kette).
  const firmaOk = {};
  kontakte.forEach(k => {
    if (!k || k.typ !== "firma") return;
    if (!wirktF) { firmaOk[k.id] = true; return; }
    const direkt = flacheZuweisungen(k).some(z => z.objektId != null && erlaubtF[z.objektId]);
    const vertrag = !direkt && ves.some(ve => erlaubtF[ve.id]
      && (ve.vertraege || []).some(v => v && v.firmaId === k.id));
    firmaOk[k.id] = direkt || vertrag;
  });
  return kontakte.filter(k => {
    if (!k) return false;
    if (k.typ === "firma") return firmaOk[k.id] !== false && (!wirktF || firmaOk[k.id] === true);
    if (!wirktP) return true;
    const direkt = flacheZuweisungen(k).some(z => z.objektId != null && erlaubtP[z.objektId]);
    if (direkt) return true;
    // Ansprechpartner/Mitarbeiter einer verbundenen Firma bleiben sichtbar.
    return (k.firmenRollen || []).some(f => f && firmaOk[f.firmaId] === true);
  });
}

function sucheAlles(query, settings, kontakte, ves) {
  const q = (query || "").trim();
  if (!q) return { vorschlaege: [], ergebnisse: {} };
  const aktiveKats = settings.suchKategorien.filter(k => k.aktiv).map(k => k.id);

  // Welche Stufen sind aktiv (Defaults: alle an)
  const opts = {
    diakritika:           settings.sucheDiakritika           !== false,
    woerter:              settings.sucheWoerter              !== false,
    phonetik:             settings.suchePhonetik             !== false,
    tippfehler:           settings.sucheTippfehler           !== false,
    tippfehlerSchwelle:   settings.sucheTippfehlerSchwelle   || 2,
  };
  // Wenn alles aus: nur Stufe 1 (exakt)
  const istNurExakt = !opts.diakritika && !opts.woerter && !opts.phonetik && !opts.tippfehler;

  const vorschlaege = [];
  const ergebnisse = {};

  // Hilfsfunktion: Score gegen mehrere Felder eines Items, bestes zählt
  const bestScore = (felder) => {
    let best = 0;
    for (let i = 0; i < felder.length; i++) {
      if (!felder[i]) continue;
      const s = istNurExakt
        ? (felder[i].toLowerCase().indexOf(q.toLowerCase()) >= 0 ? 100 : 0)
        : matchScore(q, felder[i], opts);
      if (s > best) best = s;
    }
    return best;
  };

  if (aktiveKats.indexOf("objekte") >= 0) {
    const scored = ves
      .map(ve => ({ ve, score: bestScore([ve.nr, ve.adresse]) }))
      .filter(x => x.score > 0)
      .sort((a, b) => b.score - a.score);
    if (scored.length > 0) ergebnisse.objekte = scored.map(x => x.ve);
    scored.forEach(x => {
      vorschlaege.push({ text: x.ve.nr, sub: x.ve.adresse, typ: "ve", id: x.ve.id, score: x.score });
      if (x.ve.adresse && bestScore([x.ve.adresse]) > 0) {
        vorschlaege.push({ text: x.ve.adresse.split(",")[0], sub: x.ve.nr,
          typ: "adresse", id: x.ve.id, score: x.score - 1 });
      }
    });
  }

  if (aktiveKats.indexOf("kontakte") >= 0) {
    const scored = kontakte
      .map(k => {
        // Felder je nach Typ: Personen → Vor/Nachname/Name, Firmen → Name
        const felder = k.typ === "firma"
          ? [k.name]
          : [k.name, k.vorname, k.nachname];
        return { k, score: bestScore(felder) };
      })
      .filter(x => x.score > 0)
      .sort((a, b) => b.score - a.score);
    if (scored.length > 0) {
      ergebnisse.kontakte = scored.map(x => x.k);
      scored.forEach(x => vorschlaege.push({
        text: x.k.name, sub: x.k.sub || x.k.typ, typ: "kontakt", id: x.k.id, score: x.score
      }));
    }
    // Objekte des ersten Kontakts (wie bisher)
    const erstK = scored[0] && scored[0].k;
    if (erstK) {
      const vesMitK = ves.filter(ve =>
        ve.einheiten.some(e =>
          [...(e.eigentuemer||[]).map(et => et.kontaktId), ...(e.mieter||[]).map(m => m.kontaktId)].includes(erstK.id)
        ) || (ve.verwaltung && ve.verwaltung.verwalter === erstK.id)
      );
      if (vesMitK.length > 0) ergebnisse.objekte_von_kontakt = { kontakt: erstK, ves: vesMitK };
    }
  }

  // Vorschläge: nach Score sortieren, dedup nach Text, dann auf 8 begrenzen
  vorschlaege.sort((a, b) => b.score - a.score);
  return {
    vorschlaege: [...new Map(vorschlaege.map(v => [v.text, v])).values()].slice(0, 8),
    ergebnisse,
  };
}

// ── useWindowWidth (Hook für responsives Verhalten) ─────────────────────────
function useWindowWidth() {
  const [w, setW] = useState(typeof window !== "undefined" ? window.innerWidth : 1200);
  useEffect(() => {
    const handler = () => setW(window.innerWidth);
    window.addEventListener("resize", handler);
    return () => window.removeEventListener("resize", handler);
  }, []);
  return w;
}

// ── useOutsideClick (SSoT für ALLE Popover/Dropdowns, DESIGN §2.7) ──────────
// Regel: Jedes schwebende Popover (Dropdown, Picker, Menü) MUSS bei Klick
// außerhalb schließen. ref umfasst Trigger-Button UND Popover (contains-Check
// verhindert Schließen+Sofort-Wiederöffnen beim Toggle). mousedown in der
// Capture-Phase — iOS synthetisiert mousedown nach Tap zuverlässig; Scrollen
// schließt NICHT versehentlich (kein touchstart). Callback via Ref gegen
// stale closures. Kein optional chaining (Safari-Regel §14).
function useOutsideClick(ref, onOutside, aktiv) {
  const cbRef = useRef(onOutside);
  cbRef.current = onOutside;
  useEffect(() => {
    if (!aktiv) return;
    const handler = (e) => {
      if (ref.current && ref.current.contains(e.target)) return;
      if (cbRef.current) cbRef.current();
    };
    document.addEventListener("mousedown", handler, true);
    return () => document.removeEventListener("mousedown", handler, true);
  }, [aktiv]);
}

// ── Sidebar-Breakpoints (siehe SeitenleisteKacheln) ─────────────────────────
const DESKTOP_MIN_WIDTH      = 900;  // ab hier Sidebar statt horizontaler Leiste
const SIDEBAR_MIN_WIDTH      = 56;   // Minimum Sidebar-Breite
const SIDEBAR_MAX_WIDTH      = 280;  // Maximum Sidebar-Breite
const SIDEBAR_SCHWELLE_2BUCH = 75;   // ab dieser Breite: Icon + 2 Buchstaben
const SIDEBAR_SCHWELLE_VOLL  = 145;  // ab dieser Breite: Icon + voller Text

function sidebarModus(breite) {
  if (breite < SIDEBAR_SCHWELLE_2BUCH) return "icon";
  if (breite < SIDEBAR_SCHWELLE_VOLL)  return "kurz";
  return "voll";
}

// ── RollenContext (für RolleBadge, KontaktPicker, KontaktKarte usw.) ────────
// Default ist DEFAULT_ROLLEN; App überschreibt mit settings.rollen.
const RollenContext = createContext(DEFAULT_ROLLEN);
// Volle Kontaktliste als Context — nötig, um abgeleitete eingehende Vertretungen
// (z. B. das "S"-Badge des Bevollmächtigten) ohne Prop-Threading zu berechnen.
const KontakteContext = createContext([]);
function useAlleKontakte() { return useContext(KontakteContext); }

// Volle Objektliste als Context — nötig, um die LIVE aus Belegungen abgeleiteten
// Avatar-Badges (Mieter/Pächter/…) ohne Prop-Threading zu berechnen. Analog zu
// KontakteContext. Wird im App-Rumpf mit `ves` befüllt.
const VesContext = createContext([]);
function useAlleVes() { return useContext(VesContext); }

// Helfer: aktuelle Rollen-Liste aus dem Context holen
function useRollen() {
  return useContext(RollenContext);
}
// Helfer: eine Rolle nach Namen finden (z. B. "Eigentümer")
// ── FirmenRollenContext (analog für Dienstleister-Rollen einer Firma) ───────
const FirmenRollenContext = createContext(DEFAULT_GEWERKE_LISTE);
function useFirmenRollen() { return useContext(FirmenRollenContext); }

// ── LeistungenContext (Leistungen/Zuständigkeiten am Objekt) ────────────────
const LeistungenContext = createContext(DEFAULT_LEISTUNGEN);
function useLeistungen() { return useContext(LeistungenContext); }

// ── VerwendungenContext (Objekt-Einheiten-Verwendungen) ─────────────────────
const VerwendungenContext = createContext(DEFAULT_VERWENDUNGEN);
function useVerwendungen() { return useContext(VerwendungenContext); }

// ── KategorienContext (gemeinsame Kürzel/Farben für Verwendung↔Rolle-Paare) ──
const KategorienContext = createContext(DEFAULT_KATEGORIEN);
function useKategorien() { return useContext(KategorienContext); }

// ── EinheitOffenContext: meldet, ob gerade eine Einheit aufgeklappt ist, damit
//    sich der obere Struktur-Stift und die Einheit-Bearbeitung gegenseitig
//    ausschließen (nicht beide gleichzeitig bearbeitbar). Default-Setter ist
//    eine No-Op, damit Komponenten ohne Provider nicht crashen.
const EinheitOffenContext = createContext({ offen: false, setOffen: () => {} });
function useEinheitOffen() { return useContext(EinheitOffenContext); }

// ── AvatarIconsContext: Eck-Badges für Personen / Firmen getrennt schaltbar ──
const AvatarIconsContext = createContext({ person: true, firma: true });
function useAvatarIcons() { return useContext(AvatarIconsContext); }

// ── KartenBadgesContext: Rollen-Badges rechts auf der Kontaktkarte schaltbar ─
const KartenBadgesContext = createContext({ person: true, firma: true });
function useKartenBadges() { return useContext(KartenBadgesContext); }

// Kanonischer Wert eines Verwaltungs-Karten-Feldes (persistierte Karten haben
// Vorrang vor ve.verwaltung-Initialwerten — gleiche Logik wie im Kalender).
function veKartenFeldWert(ve, kategorie, feldName) {
  var vk = Array.isArray(ve && ve.verwaltungsKarten) ? ve.verwaltungsKarten : [];
  var karte = null;
  vk.forEach(function(k) { if (k && k.kategorie === kategorie && !karte) karte = k; });
  if (!karte || !Array.isArray(karte.stamm)) return "";
  var f = null;
  karte.stamm.forEach(function(x) { if (x && x.name === feldName && !f) f = x; });
  return (f && f.value) || "";
}

// ── StatusLeisteContext: Status-Leiste unter Karten pro Typ schaltbar ───────
const StatusLeisteContext = createContext({ objekt: true, kontakt: true });
function useStatusLeiste() { return useContext(StatusLeisteContext); }

// ── TerminBezeichnungenContext: frei pflegbare Dropdown-Liste fürs Anlegen ──
const TerminBezeichnungenContext = createContext([]);
function useTerminBezeichnungen() { return useContext(TerminBezeichnungenContext); }

// ── ZeitPickerContext: Konfiguration des Uhrzeit-Pickers ────────────────────
// minutenschritt (5|15), stundenModus ("24h"|"arbeit"), puffer, arbeitVon/Bis.
const ZeitPickerContext = createContext({
  minutenschritt: 15, stundenModus: "arbeit", puffer: 1, arbeitVon: 8, arbeitBis: 17,
  dauerOptionen: [15, 30, 45, 60, 90, 120]
});
function useZeitPicker() { return useContext(ZeitPickerContext); }


// ── HandlungsbedarfContext: Config für den Objekt-Status-Punkt ──────────────
// Liefert { quellen: {typId:bool}, vorlauf: {typId:tage} }. Leeres Objekt =
// Defaults aus HANDLUNGSBEDARF_QUELLEN greifen (siehe objektHandlungsbedarf).
const HandlungsbedarfContext = createContext({ quellen: {}, vorlauf: {} });
function useHandlungsbedarf() { return useContext(HandlungsbedarfContext); }

// ── ObjektTabsContext: Reihenfolge + Sichtbarkeit der Objekt-Detail-Tabs
//    (global aus den Einstellungen). null = Default. Liegenschaft+Verwaltung fix.
const ObjektTabsContext = createContext(null);
function useObjektTabs() { return useContext(ObjektTabsContext); }

// ── RechnungsadresseContext: Rechnungsadresse-Sektion in Stammdaten an/aus ─
const RechnungsadresseContext = createContext(false);

// ── LoeschenErlaubtContext: Sicherheits-Schalter — Löschen-Button getrennt für
//    Objekte und Kontakte nur sichtbar, wenn true (aus den Einstellungen).
//    Default beide false.
const LoeschenErlaubtContext = createContext({ objekte: false, kontakte: false });
function useLoeschenErlaubt() { return useContext(LoeschenErlaubtContext); }

// ── KontaktFarbeContext: aktuelle Akzentfarben für alle App-Bereiche ────────
// Liefert { person, firma, objekt, system }. Wird in der App aus den Dashboard-
// Kachel-Farben gespeist (kontaktAccent für person+firma, objektAccent für
// objekt, systemAccent für Logo/Zahnrad/Profil/Stift). Im "Weniger Farbe"-Modus
// mappt die App alle auf neutrales Grau, sodass alle Stellen (Avatar, Namen,
// Karten-Rand, Modal-Akzente, System-UI) automatisch eingegraut sind, ohne
// dass jede Komponente einzeln Bescheid wissen muss.
const KontaktFarbeContext = createContext({ person: KONTAKTE_FARBE, firma: FIRMEN_FARBE, objekt: ACCENT, system: ACCENT, auswahlObjekt: ACCENT, auswahlKontakt: KONTAKTE_FARBE });
function useKontaktFarbe() { return useContext(KontaktFarbeContext); }

function useRechnungsadresseAn() { return useContext(RechnungsadresseContext); }

// ── EinheitAnzeigeContext: welche Felder in der Einheit-Übersichts-Zeile ─────
// (im Liegenschaft-Tab) angezeigt werden. Alles default an.
const DEFAULT_EINHEIT_ANZEIGE = { flaeche: true, mea: true, eigentuemer: true, mieter: true };
const EinheitAnzeigeContext = createContext(DEFAULT_EINHEIT_ANZEIGE);

// Kontakt-Anzeige: Name-Format ("vorname-nachname" | "nachname-vorname") und
// Sortier-Feld. Über den ganzen Baum verfügbar, damit Komponenten die Namen
// rendern (KontaktKarte, KontaktPicker, KontaktDetailKarte, …) ohne extra
// Props an die Settings rankommen.
const KontaktAnzeigeContext = createContext({ nameFormat: "vorname-nachname", alphaTrenner: true });
function useKontaktAnzeige() { return useContext(KontaktAnzeigeContext); }
function formatNameMitCtx(k, ctx) {
  return formatKontaktName(k, { kontakteNameFormat: ctx ? ctx.nameFormat : "vorname-nachname" });
}
function useEinheitAnzeige() { return useContext(EinheitAnzeigeContext); }


export {
  useCardWidth,
  useMasterDetailLayout,
  StickySectionHeader,
  SortierPfeile,
  scrollToCard,
  findScrollParent,
  haltePositionUeberUpdate,
  stabilisiereScroll,
  findeAnkerWurzel,
  IC,
  I,
  ZurueckButton,
  HV_ADRESSE,
  genRechnungsadresse,
  STORAGE_KEYS,
  STORAGE_SCHEMA_VERSION,
  FSA_VERFUEGBAR,
  IDB_NAME,
  IDB_STORE,
  idbOpen,
  idbGet,
  idbSet,
  idbDel,
  storageStatus,
  STATUS_EVT,
  statusUpdate,
  DIR_HANDLE,
  DATEN_FILE_HANDLE,
  SETTINGS_FILE_HANDLE,
  LETZTER_FLUSH,
  FLUSH_DELAY,
  flushTimer,
  flushQueue,
  planeFlush,
  storage,
  exportiereJSON,
  schemaWarnung,
  importiereJSON,
  SHEETJS_URL,
  xlsxBereit,
  ladeXlsxLib,
  mappeVerwaltungsart,
  feldWertGueltig,
  kontaktAllesGueltig,
  migriereZuweisungen,
  zuweisungenFuerAvatar,
  eingehendeVertretungen,
  flacheZuweisungen,
  belegungsRollenFuerKontakt,
  parseSheetAlsObjekte,
  ableiteStatus,
  ableiteStatusVonBis,
  mappeObjekte,
  mappeEinheiten,
  mappePersonen,
  mappeFirmen,
  mappeZuordnungen,
  HEADER_FILTER_LEER,
  headerFilterIstAktiv,
  filterEintragConf,
  reduziereAuswahl,
  vePasstHeaderFilter,
  headerFilterWirktAufScope,
  filtereKontakteNachHeaderFilter,
  sucheAlles,
  useWindowWidth,
  useOutsideClick,
  DESKTOP_MIN_WIDTH,
  SIDEBAR_MIN_WIDTH,
  SIDEBAR_MAX_WIDTH,
  SIDEBAR_SCHWELLE_2BUCH,
  SIDEBAR_SCHWELLE_VOLL,
  sidebarModus,
  RollenContext,
  KontakteContext,
  useAlleKontakte,
  VesContext,
  useAlleVes,
  useRollen,
  FirmenRollenContext,
  useFirmenRollen,
  LeistungenContext,
  useLeistungen,
  VerwendungenContext,
  useVerwendungen,
  KategorienContext,
  useKategorien,
  EinheitOffenContext,
  useEinheitOffen,
  AvatarIconsContext,
  useAvatarIcons,
  KartenBadgesContext,
  useKartenBadges,
  veKartenFeldWert,
  StatusLeisteContext,
  useStatusLeiste,
  TerminBezeichnungenContext,
  useTerminBezeichnungen,
  ZeitPickerContext,
  useZeitPicker,
  HandlungsbedarfContext,
  useHandlungsbedarf,
  ObjektTabsContext,
  useObjektTabs,
  RechnungsadresseContext,
  LoeschenErlaubtContext,
  useLoeschenErlaubt,
  KontaktFarbeContext,
  useKontaktFarbe,
  useRechnungsadresseAn,
  DEFAULT_EINHEIT_ANZEIGE,
  EinheitAnzeigeContext,
  KontaktAnzeigeContext,
  useKontaktAnzeige,
  formatNameMitCtx,
  useEinheitAnzeige
};
