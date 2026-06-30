import React, { useState, useRef } from "react";
import { FS, FW, RAD, KACHEL_W, kartenGridStyle, getContrastColor } from "./constants.js";
import { joinPlzOrt, parseDatumWert } from "./utils-basis.js";
import {
  VERWALTUNGSARTEN, aktiveBelegung, aktiverTeil, belegungsTyp, bewohnerRecht,
  eigStatus, extractNachname, flaecheVon, heizflaecheVon, setzeEinheitHeizflaeche,
  effVerteilerschluessel, vsWertVon,
  heuteLaufendeBelegung, isStellplatzTyp, neueBelegung,
  neuesHhMitglied, objektInGruppe, objektOrt, parseFlaeche, personenTageWert, personenTageFolgejahr, setzePersonenTageManuell, setzeEinheitFlaeche, setzeEinheitMea, teileVon, wirtschaftsjahrZeitraum
} from "./datenmodell.js";
import {
  DESKTOP_MIN_WIDTH, I, useWindowWidth, veKartenFeldWert
} from "./utils-icons.jsx";
import { DetailKopf, ObjektDetailKopf, DetailRahmen, KopfPille, MasterDetailRahmen, ScreenKopf, HeaderZurueck } from "./components.jsx";
import {
  VerteilerSchluesselBlock, buildInitialKarten,
  buildInitialVerwaltungsKarten, ergaenzeTechnikGeraetFelder, gemeinschaftName,
  gemeinschaftVertreter, gemeinschaftZustellAdresse, istEigentuemergemeinschaft,
  quoteAnteil, quoteLabel, PersonenTageUebersicht
} from "./liegenschaft.jsx";
import { KALENDER_TYPEN, sammleTermine } from "./kalender.jsx";
import { STAT_WOHN_TYPEN, StatBalkenZeile, StatKpi, StatPanel, VEKachel, VEListenZeile, alleEinheitenVonVe } from "./objektansicht.jsx";

// ╔═════════════════════════════════════════════════════════════════════════╗
// ║ LISTENGENERATOR — Vorlagen-Katalog + generischer Screen + Druck          ║
// ║ (Dashboard-Kachel „listen"). Druck synchron via window.print (§26.3).   ║
// ╚═════════════════════════════════════════════════════════════════════════╝

// druckeHtml — gemeinsamer Druck-Baustein (DSGVO-Auskunft, Listengenerator,
// Tastatur-Übersicht). iOS-Safari-Regeln (DESIGN §26.3):
//   1. window.print() MUSS synchron in der User-Geste laufen — jeder
//      setTimeout/onload-Umweg gilt als „automatisches Drucken" und wird mit
//      „Diese Seite wurde für das automatische Drucken gesperrt" blockiert.
//   2. NIEMALS print() doppelt aufrufen (gleiche Sperre).
//   3. Kein window.open (Popups in Standalone blockiert), kein iframe-print
//      (iOS druckt daraus unzuverlässig bzw. wertet es als automatisch).
// Lösung: Print-Only-Container im HAUPTdokument + @media print-CSS, das die
// App ausblendet; dann genau EIN synchroner window.print(). Aufgeräumt wird
// per afterprint und spätestens beim nächsten Druck.
function druckeHtml(titel, bodyHtml, quer, extraCss) {
  const ALT = ["allesda-print-bereich", "allesda-print-style"];
  ALT.forEach(id => {
    try {
      const el = document.getElementById(id);
      if (el && el.parentNode) el.parentNode.removeChild(el);
    } catch (e) {}
  });

  const cont = document.createElement("div");
  cont.id = "allesda-print-bereich";
  cont.setAttribute("aria-hidden", "true");
  cont.innerHTML = bodyHtml; // bodyHtml wird von den Aufrufern escaped aufgebaut

  // Aufrufer-CSS auf den Container scopen, damit es die gescopten Basis-Regeln
  // überschreiben kann (gleiche Spezifitätsbasis). Unsere extraCss-Strings sind
  // einfache "selektor{...}"-Ketten ohne Kommas/Verschachtelung.
  const scopedExtra = (extraCss || "").replace(/(^|\})\s*([^{}]+)\{/g,
    (m, p1, sel) => p1 + "#allesda-print-bereich " + sel.trim() + "{");

  const style = document.createElement("style");
  style.id = "allesda-print-style";
  style.textContent =
    "#allesda-print-bereich{display:none;}"
    + "@media print{"
    + "@page{size:A4 " + (quer ? "landscape" : "portrait") + ";margin:14mm;}"
    + "body>*:not(#allesda-print-bereich){display:none !important;}"
    + "html,body{background:#fff !important;height:auto !important;overflow:visible !important;}"
    + "#allesda-print-bereich{display:block !important;"
    + "font-family:-apple-system,system-ui,sans-serif;color:#111;line-height:1.45;}"
    + "#allesda-print-bereich h1{font-size:17px;margin:0 0 2px;}"
    + "#allesda-print-bereich .meta{color:#666;font-size:11px;margin:0 0 12px;}"
    + "#allesda-print-bereich table{width:100%;border-collapse:collapse;font-size:11px;}"
    + "#allesda-print-bereich th{text-align:left;border-bottom:1.5px solid #333;padding:4px 6px;font-weight:700;}"
    + "#allesda-print-bereich td{border-bottom:1px solid #ddd;padding:4px 6px;vertical-align:top;}"
    + "#allesda-print-bereich tr{page-break-inside:avoid;}"
    + "#allesda-print-bereich .fuss{margin-top:10px;font-size:11px;font-weight:600;}"
    + scopedExtra
    + "}";

  document.body.appendChild(cont);
  document.head.appendChild(style);

  // Dokument-Titel temporär setzen → wird Dateiname beim „Als PDF sichern".
  const altTitel = document.title;
  try { document.title = titel || altTitel; } catch (e) {}

  const aufraeumen = () => {
    try { document.title = altTitel; } catch (e) {}
    ALT.forEach(id => {
      try {
        const el = document.getElementById(id);
        if (el && el.parentNode) el.parentNode.removeChild(el);
      } catch (e) {}
    });
  };
  try { window.addEventListener("afterprint", aufraeumen, { once: true }); } catch (e) {}

  // Genau EIN synchroner Aufruf — noch innerhalb der Klick-Geste.
  try { window.print(); } catch (e) { aufraeumen(); return false; }
  return true;
}

// ── Kleine Kontakt-Helfer für Listen-Spalten ────────────────────────────────
function lgKontaktVonId(kontakte, id) {
  if (id == null) return null;
  return (kontakte || []).find(k => k && k.id === id) || null;
}
function lgTel(k) {
  if (!k) return "";
  const tels = Array.isArray(k.tels) ? k.tels : [];
  const t0 = tels.find(x => x && x.nr);
  return (t0 && t0.nr) || k.telefon || k.mobil || "";
}
function lgMail(k) {
  if (!k) return "";
  const emails = Array.isArray(k.emails) ? k.emails : [];
  const e0 = emails.find(x => x && x.email);
  return (e0 && e0.email) || k.email || "";
}
function lgAdresse(k) {
  if (!k) return "";
  const plzOrt = k.plzOrt || [k.plz, k.ort].filter(Boolean).join(" ");
  return k.adresse || [k.strasse, plzOrt].filter(Boolean).join(", ");
}
function lgGeraetFeld(g, name) {
  const f = (g && Array.isArray(g.felder) ? g.felder : []).find(x => x && x.name === name);
  return (f && f.value) || "";
}
// Karten eines Objekts — persistierte bevorzugt, sonst Initial-Karten bauen
// (verteilt ve.einheiten auf Haus-/Tiefgaragen-Karten).
function lgKartenVon(ve) {
  if (!ve) return [];
  if (Array.isArray(ve.karten) && ve.karten.length > 0) return ve.karten;
  return buildInitialKarten(ve);
}
// Gebäude-Karten eines Objekts (Häuser + Tiefgaragen) → [{id, name}].
function lgHaeuserVon(ve) {
  const aus = [];
  lgKartenVon(ve).forEach(k => {
    if (k && (k.kategorie === "gebaeude" || k.kategorie === "tiefgarage"))
      aus.push({ id: k.id, name: k.name || "Gebäude" });
  });
  return aus;
}
// Einheiten eines Objekts — optional auf EIN Haus (Gebäude-Karte) gefiltert.
function lgEinheitenVon(ve, hausId) {
  if (hausId == null) return alleEinheitenVonVe(ve);
  const karte = lgKartenVon(ve).find(k => k && k.id === hausId);
  return (karte && karte.einheiten) || [];
}
// Bewohner-Zeilen einer Einheit über ALLE Teile (nicht nur den aktiven).
// Fallback: Hat die Einheit keine gepflegten Bewohner, aber Eigennutzung
// (belegungsTyp oder selbstnutzer-Flag), erscheinen die aktiven Eigentümer
// automatisch als „Eigennutzer".
function lgBewohnerZeilen(einheit) {
  const aus = [];
  teileVon(einheit).forEach(teil => {
    const beleg = aktiveBelegung(teil);
    if (!beleg || !beleg.haushalt) return;
    (beleg.haushalt.mitglieder || []).forEach(m => {
      if (!m) return;
      const anon = m.kontaktId == null && !m.name;
      aus.push({
        name: anon ? "+" + (m.anzahl || 1) + ((m.anzahl || 1) === 1 ? " Person" : " Personen") : (m.name || ""),
        recht: bewohnerRecht(m.recht).label,
        einzug: beleg.von || "",
        kontaktId: m.kontaktId,
        anzahl: m.anzahl || 1,
      });
    });
  });
  if (aus.length === 0) {
    const selbst = belegungsTyp(einheit) === "selbstnutzung"
      || (einheit.eigentuemer || []).some(p => p && p.selbstnutzer && eigStatus(p) === "aktiv");
    if (selbst) {
      (einheit.eigentuemer || []).forEach(p => {
        if (!p || eigStatus(p) !== "aktiv") return;
        aus.push({ name: p.name || "", recht: "Eigennutzer", einzug: p.von || "",
          kontaktId: p.kontaktId, anzahl: 1 });
      });
    }
  }
  return aus;
}
// Bewohnernamen einer Einheit (für Klingelschild) — inkl. Eigennutzer-Fallback.
function lgBewohnerNamen(einheit) {
  const zeilen = lgBewohnerZeilen(einheit);
  return zeilen.map(z => z.name).filter(Boolean);
}
// Personenzahl einer Einheit: Summe aller Bewohner (anzahl), inkl. Fallback.
function lgPersonenZahl(einheit) {
  return lgBewohnerZeilen(einheit).reduce((s, z) => s + (z.anzahl || 1), 0);
}
// MEA-Summe (nur wenn alle Werte numerisch parsebar — sonst null).
function lgMeaSumme(rows) {
  let summe = 0;
  for (let i = 0; i < rows.length; i++) {
    const v = String(rows[i].mea || "").replace(",", ".").trim();
    if (v === "") continue;
    const n = parseFloat(v);
    if (isNaN(n)) return null;
    summe += n;
  }
  return Math.round(summe * 1000) / 1000;
}
// Hausverwaltung für den Listenkopf: Verwalter-Kontakt aus der Verwaltungs-
// Stammkarte des Objekts; Fallback auf settings.hvName (nur Name).
function lgHvKontakt(ve, kontakte, hvNameFallback) {
  let feld = null;
  if (ve) {
    const karten = (Array.isArray(ve.verwaltungsKarten) && ve.verwaltungsKarten.length > 0)
      ? ve.verwaltungsKarten : buildInitialVerwaltungsKarten(ve);
    (karten || []).forEach(k => {
      if (!k || k.kategorie !== "verwaltung_stamm" || feld) return;
      (k.stamm || []).forEach(f => {
        if (f && f.name === "Verwalter (Firma)" && !feld) feld = f;
      });
    });
  }
  const kontakt = feld ? lgKontaktVonId(kontakte, feld.kontaktId) : null;
  const name = (kontakt && kontakt.name) || (feld && feld.value) || hvNameFallback || "";
  if (!name) return null;
  return { name: name, tel: lgTel(kontakt), mail: lgMail(kontakt), adresse: lgAdresse(kontakt) };
}

// ── LISTEN_KATALOG — alle Vorlagen als Daten (neue Liste = neuer Eintrag) ───
// bereich: "objekt" (ein Objekt wählen) | "alle" (objektübergreifend).
// hausFilter: true → bei mehreren Gebäuden ist ein Haus einzeln wählbar.
// spalten: { id, label, default } — Werte kommen aus zeilen() als row[id].
// zeilen(ctx): ctx = { ve, ves, kontakte, f (filterState), hausId, rolleFilter }.
// filter: Checkbox-Toggles. fussnote(rows): optionale Summen-/Hinweiszeile.
const LISTEN_WOHN_TYPEN = ["Wohneigentum", "Teileigentum", "Gewerbe"];
function lgEinheitErlaubt(e, f) {
  if (!e) return false;
  const istWohn = LISTEN_WOHN_TYPEN.indexOf(e.typ) >= 0;
  return istWohn || !!f.auchStellplaetze;
}
const LISTEN_KATALOG = [
  {
    id: "eigentuemer", icon: "🏠", label: "Eigentümerliste",
    sub: "Einheit, Eigentümer, MEA, Kontaktdaten — Basis für die ETV",
    bereich: "objekt", hausFilter: true,
    spalten: [
      { id: "einheit", label: "Einheit", default: true },
      { id: "name", label: "Eigentümer", default: true },
      { id: "mea", label: "MEA", default: true },
      { id: "telefon", label: "Telefon", default: true },
      { id: "email", label: "E-Mail", default: true },
      { id: "adresse", label: "Anschrift", default: false },
      { id: "grundbuch", label: "Grundbuch", default: false },
      { id: "seit", label: "Eigentümer seit", default: false },
    ],
    filter: [
      { id: "auchStellplaetze", label: "Auch Stellplätze", default: false },
      { id: "auchWerdende", label: "Auch werdende Eigentümer", default: false },
      { id: "auchEhemalige", label: "Auch ehemalige", default: false },
      { id: "gemeinschaftKompakt", label: "Eigentümergemeinschaften zusammenfassen", default: false },
    ],
    zeilen: (ctx) => {
      const rows = [];
      lgEinheitenVon(ctx.ve, ctx.hausId).forEach(e => {
        if (!lgEinheitErlaubt(e, ctx.f)) return;
        // L2b: Gemeinschaft kompakt? Eine Zeile (z. H. Vertreter), eine Adresse.
        if (ctx.f.gemeinschaftKompakt && istEigentuemergemeinschaft(e)) {
          const vertreter = gemeinschaftVertreter(e);
          const vk = vertreter ? lgKontaktVonId(ctx.kontakte, vertreter.kontaktId) : null;
          const eigeneAdr = gemeinschaftZustellAdresse(e);
          const adresse = eigeneAdr || lgAdresse(vk);
          const vn = vertreter ? extractNachname(vertreter.name || "") : "";
          rows.push({ einheit: e.nr || "",
            name: gemeinschaftName(e) + (vn ? " (z. H. " + vn + ")" : ""),
            mea: e.mea || "", telefon: lgTel(vk), email: lgMail(vk), adresse: adresse,
            grundbuch: "Ja", seit: "" });
          return;
        }
        (e.eigentuemer || []).forEach(p => {
          if (!p) return;
          const s = eigStatus(p);
          const nimm = s === "aktiv"
            || ((s === "werdend" || s === "interessent") && ctx.f.auchWerdende)
            || (s === "ehemalig" && ctx.f.auchEhemalige);
          if (!nimm) return;
          const k = lgKontaktVonId(ctx.kontakte, p.kontaktId);
          rows.push({ einheit: e.nr || "", name: (p.name || "") + (s !== "aktiv" ? " (" + s + ")" : ""),
            mea: e.mea || "", telefon: lgTel(k), email: lgMail(k), adresse: lgAdresse(k),
            grundbuch: p.grundbuch ? "Ja" : "—", seit: p.von || "" });
        });
      });
      return rows;
    },
    fussnote: (rows) => {
      const s = lgMeaSumme(rows);
      return s != null ? "Summe MEA (gelistete Einträge): " + String(s).replace(".", ",") : null;
    },
  },
  {
    id: "etv", icon: "🗳", label: "ETV-Anwesenheitsliste",
    sub: "Eigentümer mit MEA-, Objekt- und Kopfstimmen + Unterschriften-Spalte",
    bereich: "objekt", hausFilter: true,
    spalten: [
      { id: "einheit", label: "Einheit", default: true },
      { id: "name", label: "Eigentümer", default: true },
      { id: "mea", label: "MEA", default: true },
      { id: "anteil", label: "Anteil", default: false },
      { id: "stimmeObjekt", label: "Stimme (Objekt)", default: false },
      { id: "stimmeKopf", label: "Stimme (Kopf)", default: false },
      { id: "vollmacht", label: "Vollmacht für", default: true },
      { id: "unterschrift", label: "Unterschrift", default: true },
    ],
    filter: [
      { id: "auchStellplaetze", label: "Auch Stellplätze", default: false },
    ],
    zeilen: (ctx) => {
      const rows = [];
      const einheitGesehen = {};
      const kopfGesehen = {};
      lgEinheitenVon(ctx.ve, ctx.hausId).forEach(e => {
        if (!lgEinheitErlaubt(e, ctx.f)) return;
        // Aktive Eigentümer dieser Einheit (für Quoten-Aufteilung des MEA).
        const aktiveEig = (e.eigentuemer || []).filter(p => p && eigStatus(p) === "aktiv");
        const meaRoh = parseFlaeche(e.mea);
        const eKey = String(e.id != null ? e.id : e.nr);

        // L2a: Bildet die Einheit eine Eigentümergemeinschaft, tritt sie als EIN
        // Subjekt auf — eine Zeile, volles MEA, eine Objekt-/MEA-Stimme. Die
        // Mitglieder werden NICHT als Einzelstimmen gewertet (sonst falsch: eine
        // Erbengemeinschaft hat zusammen eine Stimme).
        if (istEigentuemergemeinschaft(e)) {
          const vertreter = gemeinschaftVertreter(e);
          const gName = gemeinschaftName(e);
          const kKey = "g" + eKey;
          const objStimme = einheitGesehen[eKey] ? "" : "1";
          einheitGesehen[eKey] = true;
          const kopfStimme = kopfGesehen[kKey] ? "" : "1";
          kopfGesehen[kKey] = true;
          const meaStr = (meaRoh > 0) ? String(meaRoh).replace(".", ",") : (e.mea || "");
          const vertreterName = vertreter ? extractNachname(vertreter.name || "") : "";
          rows.push({ einheit: e.nr || "", name: gName, mea: meaStr,
            anteil: vertreterName ? "vertr. d. " + vertreterName : "Gemeinschaft",
            stimmeObjekt: objStimme, stimmeKopf: kopfStimme,
            vollmacht: "", unterschrift: "" });
          return;
        }

        aktiveEig.forEach(p => {
          // Objektprinzip: 1 Stimme je Einheit (erste Eigentümer-Zeile zählt).
          const objStimme = einheitGesehen[eKey] ? "" : "1";
          einheitGesehen[eKey] = true;
          // Kopfprinzip: 1 Stimme je Person (über alle Einheiten dedupliziert).
          const kKey = p.kontaktId != null ? "k" + p.kontaktId : "n" + (p.name || "");
          const kopfStimme = kopfGesehen[kKey] ? "" : "1";
          kopfGesehen[kKey] = true;
          // MEA-Stimme quotengewichtet: MEA der Einheit × Anteil dieses
          // Miteigentümers. Bei 1 Eigentümer = volles MEA (Anteil 1). So bleibt
          // die MEA-Summe über die Einheit korrekt, auch bei Miteigentum.
          const anteil = quoteAnteil(p, e.eigentuemer);
          const meaWert = (meaRoh > 0 && aktiveEig.length > 0)
            ? Math.round(meaRoh * anteil * 1000) / 1000
            : (e.mea || "");
          const meaStr = (meaRoh > 0)
            ? String(meaWert).replace(".", ",")
            : (e.mea || "");
          const anteilStr = aktiveEig.length > 1 ? quoteLabel(p, e.eigentuemer) : "";
          rows.push({ einheit: e.nr || "", name: p.name || "", mea: meaStr,
            anteil: anteilStr, stimmeObjekt: objStimme, stimmeKopf: kopfStimme,
            vollmacht: "", unterschrift: "" });
        });
      });
      return rows;
    },
    fussnote: (rows) => {
      const teile = [];
      const s = lgMeaSumme(rows);
      if (s != null) teile.push("Summe MEA: " + String(s).replace(".", ","));
      const obj = rows.filter(r => r.stimmeObjekt === "1").length;
      const kopf = rows.filter(r => r.stimmeKopf === "1").length;
      teile.push("Einheiten (Objektprinzip): " + obj);
      teile.push("Köpfe (Kopfprinzip): " + kopf);
      return teile.join(" · ");
    },
  },
  {
    id: "bewohner", icon: "👥", label: "Bewohner-/Mieterliste",
    sub: "Alle Bewohner inkl. Eigennutzer, mit Rechtsgrundlage und Einzug",
    bereich: "objekt", hausFilter: true,
    spalten: [
      { id: "einheit", label: "Einheit", default: true },
      { id: "name", label: "Bewohner", default: true },
      { id: "recht", label: "Rechtsgrundlage", default: true },
      { id: "einzug", label: "Einzug", default: true },
      { id: "telefon", label: "Telefon", default: true },
      { id: "email", label: "E-Mail", default: true },
    ],
    filter: [
      { id: "auchStellplaetze", label: "Auch Stellplätze", default: false },
    ],
    zeilen: (ctx) => {
      const rows = [];
      lgEinheitenVon(ctx.ve, ctx.hausId).forEach(e => {
        if (!lgEinheitErlaubt(e, ctx.f)) return;
        lgBewohnerZeilen(e).forEach(z => {
          const k = lgKontaktVonId(ctx.kontakte, z.kontaktId);
          rows.push({ einheit: e.nr || "", name: z.name, recht: z.recht,
            einzug: z.einzug, telefon: lgTel(k), email: lgMail(k) });
        });
      });
      return rows;
    },
  },
  {
    id: "personen", icon: "🔢", label: "Personenzahl-Liste",
    sub: "Wie viele Personen je Einheit wohnen — z. B. für die Abrechnung",
    bereich: "objekt", hausFilter: true,
    spalten: [
      { id: "einheit", label: "Einheit", default: true },
      { id: "lage", label: "Lage", default: false },
      { id: "bewohner", label: "Bewohner", default: false },
      { id: "personen", label: "Personen", default: true },
    ],
    filter: [],
    zeilen: (ctx) => {
      const rows = [];
      lgEinheitenVon(ctx.ve, ctx.hausId).forEach(e => {
        if (!e || LISTEN_WOHN_TYPEN.indexOf(e.typ) < 0) return;
        const teil = aktiverTeil(e);
        const namen = lgBewohnerNamen(e);
        rows.push({ einheit: e.nr || "", lage: (teil && teil.lage) || e.lage || "",
          bewohner: namen.join(" / "), personen: String(lgPersonenZahl(e)) });
      });
      return rows;
    },
    fussnote: (rows) => {
      const summe = rows.reduce((s, r) => s + (parseInt(r.personen, 10) || 0), 0);
      return "Gesamt: " + summe + " Personen in " + rows.length + " Einheiten";
    },
  },
  {
    id: "klingelschild", icon: "🔔", label: "Klingelschild-Liste",
    sub: "Einheit und Namen — als Tabelle oder Schilder zum Ausschneiden",
    bereich: "objekt", hausFilter: true, sonder: "klingelschild",
    spalten: [
      { id: "einheit", label: "Einheit", default: true },
      { id: "namen", label: "Name(n)", default: true },
      { id: "lage", label: "Lage", default: false },
    ],
    filter: [
      { id: "auchStellplaetze", label: "Auch Stellplätze", default: false },
    ],
    zeilen: (ctx) => {
      const rows = [];
      lgEinheitenVon(ctx.ve, ctx.hausId).forEach(e => {
        if (!lgEinheitErlaubt(e, ctx.f)) return;
        const namen = lgBewohnerNamen(e);
        const teil = aktiverTeil(e);
        rows.push({ einheit: e.nr || "", namen: namen.length ? namen.join(" / ") : "—",
          lage: (teil && teil.lage) || e.lage || "" });
      });
      return rows;
    },
  },
  {
    id: "einheiten", icon: "🏢", label: "Einheitenliste",
    sub: "Stammdaten aller Einheiten: Typ, Lage, Fläche, MEA, Status",
    bereich: "objekt", hausFilter: true,
    spalten: [
      { id: "einheit", label: "Einheit", default: true },
      { id: "typ", label: "Typ", default: true },
      { id: "lage", label: "Lage", default: true },
      { id: "flaeche", label: "Fläche", default: true },
      { id: "zimmer", label: "Zimmer", default: false },
      { id: "mea", label: "MEA", default: true },
      { id: "status", label: "Belegung", default: true },
    ],
    filter: [
      { id: "auchStellplaetze", label: "Auch Stellplätze", default: true },
    ],
    zeilen: (ctx) => {
      const BELEG_LABEL = { vermietung: "Vermietet", selbstnutzung: "Eigennutzung", leerstand: "Leerstand" };
      const rows = [];
      lgEinheitenVon(ctx.ve, ctx.hausId).forEach(e => {
        if (!lgEinheitErlaubt(e, ctx.f)) return;
        const fl = flaecheVon(e);
        const teil = aktiverTeil(e);
        const bt = belegungsTyp(e);
        rows.push({ einheit: e.nr || "", typ: e.typ || "", lage: (teil && teil.lage) || e.lage || "",
          flaeche: fl ? String(fl).replace(".", ",") + " m²" : "",
          zimmer: (teil && teil.zimmer) || e.zimmer || "", mea: e.mea || "",
          status: bt ? (BELEG_LABEL[bt] || bt) : "" });
      });
      return rows;
    },
  },
  {
    id: "telefon", icon: "📞", label: "Telefon-/Notfallliste",
    sub: "Verwalter, Hausmeister, Wartung & Co. mit Nummern — zum Aushängen",
    bereich: "objekt",
    spalten: [
      { id: "rolle", label: "Funktion", default: true },
      { id: "name", label: "Name", default: true },
      { id: "telefon", label: "Telefon", default: true },
      { id: "email", label: "E-Mail", default: true },
    ],
    filter: [
      { id: "auchBewohnerRollen", label: "Auch Eigentümer/Mieter/Bewohner-Rollen", default: false },
    ],
    zeilen: (ctx) => {
      const WOHN_ROLLEN = ["Eigentümer", "Mieter", "Pächter", "Eigennutzer", "Nießbraucher", "Wohnberechtigt", "Angehöriger", "Sonstige"];
      const rows = [];
      (ctx.kontakte || []).forEach(k => {
        if (!k) return;
        (k.objektZuweisungen || []).forEach(z => {
          if (!z || z.objektId !== ctx.ve.id) return;
          if ((z.status || "aktiv") !== "aktiv") return;
          const rolle = z.rolle || "";
          if (!ctx.f.auchBewohnerRollen && WOHN_ROLLEN.indexOf(rolle) >= 0) return;
          rows.push({ rolle: rolle, name: k.typ === "firma" ? (k.name || "")
              : [k.vorname, k.nachname].filter(Boolean).join(" "),
            telefon: lgTel(k), email: lgMail(k) });
        });
      });
      rows.sort((a, b) => (a.rolle + a.name).localeCompare(b.rolle + b.name, "de"));
      return rows.filter((r, i) => i === 0 || r.rolle + r.name !== rows[i - 1].rolle + rows[i - 1].name);
    },
  },
  {
    id: "technik", icon: "⚙️", label: "Technik-/Wartungsliste",
    sub: "Geräte mit Wartungsfirma und Wartungsterminen",
    bereich: "objekt", hausFilter: true,
    spalten: [
      { id: "geraet", label: "Gerät", default: true },
      { id: "system", label: "System", default: false },
      { id: "hersteller", label: "Hersteller", default: false },
      { id: "nummer", label: "Nummer", default: false },
      { id: "wartungsfirma", label: "Wartungsfirma", default: true },
      { id: "letzte", label: "Letzte Wartung", default: true },
      { id: "naechste", label: "Nächste Wartung", default: true },
    ],
    filter: [],
    zeilen: (ctx) => {
      const rows = [];
      lgKartenVon(ctx.ve).forEach(karte => {
        if (!karte || karte.kategorie !== "technik") return;
        (karte.technikGeraete || []).map(ergaenzeTechnikGeraetFelder).forEach(g => {
          if (!g) return;
          if (ctx.hausId != null && String(g.hausId || "") !== String(ctx.hausId)) return;
          rows.push({ geraet: g.typLabel || "Gerät",
            system: lgGeraetFeld(g, "System"),
            hersteller: lgGeraetFeld(g, "Hersteller"),
            nummer: lgGeraetFeld(g, "Nummer"),
            wartungsfirma: lgGeraetFeld(g, "Wartungsfirma"),
            letzte: lgGeraetFeld(g, "Letzte Wartung"),
            naechste: lgGeraetFeld(g, "Nächste Wartung") });
        });
      });
      return rows;
    },
  },
  {
    id: "vertraege", icon: "📄", label: "Vertragsliste",
    sub: "Verträge, Versicherungen, Versorger mit Laufzeiten",
    bereich: "objekt",
    spalten: [
      { id: "art", label: "Art", default: true },
      { id: "leistung", label: "Leistung", default: true },
      { id: "firma", label: "Firma", default: true },
      { id: "ab", label: "Beginn", default: true },
      { id: "bis", label: "Ende", default: false },
      { id: "kuendigung", label: "Kündigungsfrist", default: true },
      { id: "nr", label: "Vertrags-Nr.", default: false },
    ],
    filter: [],
    zeilen: (ctx) => {
      const ART = { versicherungen: "Versicherung", versicherung: "Versicherung",
        versorger: "Versorger", messdienst: "Messdienst",
        vertraege: "Vertrag", vertrag: "Vertrag" };
      const rows = [];
      const karten = (Array.isArray(ctx.ve.verwaltungsKarten) && ctx.ve.verwaltungsKarten.length > 0)
        ? ctx.ve.verwaltungsKarten : buildInitialVerwaltungsKarten(ctx.ve);
      (karten || []).forEach(karte => {
        if (!karte || !Array.isArray(karte.vertraege)) return;
        const art = ART[karte.kategorie] || karte.name || "Vertrag";
        karte.vertraege.forEach(v => {
          if (!v) return;
          const firma = lgKontaktVonId(ctx.kontakte, v.firmaId);
          rows.push({ art: art, leistung: v.leistung || v.typ || "",
            firma: (firma && firma.name) || "", ab: v.ab || "", bis: v.bis || "",
            kuendigung: v.kuendigungsfrist || "", nr: v.vertragsnr || "" });
        });
      });
      return rows;
    },
  },
  {
    id: "leerstand", icon: "🚪", label: "Leerstandsliste",
    sub: "Alle leeren Einheiten — über alle Objekte",
    bereich: "alle",
    spalten: [
      { id: "objekt", label: "Objekt", default: true },
      { id: "adresse", label: "Adresse", default: true },
      { id: "einheit", label: "Einheit", default: true },
      { id: "typ", label: "Typ", default: true },
      { id: "flaeche", label: "Fläche", default: true },
      { id: "lage", label: "Lage", default: false },
    ],
    filter: [
      { id: "auchStellplaetze", label: "Auch Stellplätze", default: false },
    ],
    zeilen: (ctx) => {
      const rows = [];
      (ctx.ves || []).forEach(ve => {
        alleEinheitenVonVe(ve).forEach(e => {
          if (!lgEinheitErlaubt(e, ctx.f)) return;
          if (belegungsTyp(e) !== "leerstand") return;
          const fl = flaecheVon(e);
          const teil = aktiverTeil(e);
          rows.push({ objekt: ve.nr || "", adresse: ve.adresse || "", einheit: e.nr || "",
            typ: e.typ || "", flaeche: fl ? String(fl).replace(".", ",") + " m²" : "",
            lage: (teil && teil.lage) || e.lage || "" });
        });
      });
      return rows;
    },
  },
  {
    id: "kontakte", icon: "📇", label: "Kontaktliste nach Rolle",
    sub: "Alle Kontakte, filterbar nach Rolle oder Gewerk",
    bereich: "alle", hatRollenFilter: true,
    spalten: [
      { id: "name", label: "Name", default: true },
      { id: "typ", label: "Typ", default: false },
      { id: "rollen", label: "Rollen", default: true },
      { id: "telefon", label: "Telefon", default: true },
      { id: "email", label: "E-Mail", default: true },
      { id: "adresse", label: "Anschrift", default: false },
    ],
    filter: [
      { id: "nurPersonen", label: "Nur Personen", default: false },
      { id: "nurFirmen", label: "Nur Firmen", default: false },
    ],
    zeilen: (ctx) => {
      const rows = [];
      (ctx.kontakte || []).forEach(k => {
        if (!k) return;
        if (ctx.f.nurPersonen && k.typ === "firma") return;
        if (ctx.f.nurFirmen && k.typ !== "firma") return;
        const rollenSet = [];
        (k.objektZuweisungen || []).forEach(z => {
          if (z && z.rolle && (z.status || "aktiv") === "aktiv" && rollenSet.indexOf(z.rolle) < 0) rollenSet.push(z.rolle);
        });
        (k.gewerke || []).forEach(g => {
          const n = typeof g === "string" ? g : (g && g.name);
          if (n && rollenSet.indexOf(n) < 0) rollenSet.push(n);
        });
        if (ctx.rolleFilter && rollenSet.indexOf(ctx.rolleFilter) < 0) return;
        rows.push({ name: k.typ === "firma" ? (k.name || "")
            : [k.vorname, k.nachname].filter(Boolean).join(" ") || (k.name || ""),
          typ: k.typ === "firma" ? "Firma" : "Person",
          rollen: rollenSet.join(", "), telefon: lgTel(k), email: lgMail(k),
          adresse: lgAdresse(k) });
      });
      rows.sort((a, b) => a.name.localeCompare(b.name, "de"));
      return rows;
    },
  },
];

// ── SchnelleingabeScreen — Massen-Neuanlage von Einheiten (Stufe 1) ──────────
//   Muster-Generator (Fortlaufend / Etagen×Seite / Stellplätze) erzeugt einen
//   Zeilenvorschlag, der im Grid (nr, Typ, Lage, Fläche, Zimmer, MEA) frei
//   nachjustiert wird. „Anlegen" schreibt die Zeilen als neue Einheiten in
//   ve.einheiten (über setVes). IDs garantiert eindeutig: e-<ts>-<index>.
//   Spätere Stufen: Modus „Bearbeiten" (Mehrfachauswahl + Bulk-Edit).
const SE_TYP_OPTIONEN = ["Wohneigentum", "Teileigentum", "Stellplatz", "Garage"];
const SE_ETAGEN_VORLAGE = ["EG", "1. OG", "2. OG", "3. OG", "DG"];
const SE_SEITEN_VORLAGE = ["links", "rechts"];

// Erzeugt aus den Muster-Parametern eine Liste von Zeilen-Objekten.
function seBaueZeilen(schema, params) {
  const rows = [];
  if (schema === "fortlaufend") {
    const praefix = params.praefix || "WE";
    const start = parseInt(params.start, 10) || 1;
    const anzahl = Math.max(0, Math.min(200, parseInt(params.anzahl, 10) || 0));
    const breite = Math.max(1, Math.min(4, parseInt(params.breite, 10) || 2));
    for (let i = 0; i < anzahl; i++) {
      const num = String(start + i).padStart(breite, "0");
      rows.push({ nr: `${praefix} ${num}`.trim(), typ: "Wohneigentum",
        lage: "", flaeche: "", zimmer: "", mea: "" });
    }
  } else if (schema === "etagen") {
    const praefix = params.praefix || "WE";
    const etagen = (params.etagen && params.etagen.length) ? params.etagen : SE_ETAGEN_VORLAGE;
    const seiten = (params.seiten && params.seiten.length) ? params.seiten : SE_SEITEN_VORLAGE;
    let lauf = parseInt(params.start, 10) || 1;
    const breite = Math.max(1, Math.min(4, parseInt(params.breite, 10) || 2));
    for (let e = 0; e < etagen.length; e++) {
      for (let s = 0; s < seiten.length; s++) {
        const lage = `${etagen[e]} ${seiten[s]}`.trim();
        const num = String(lauf).padStart(breite, "0");
        rows.push({ nr: `${praefix} ${num}`.trim(), typ: "Wohneigentum",
          lage: lage, flaeche: "", zimmer: "", mea: "" });
        lauf++;
      }
    }
  } else if (schema === "stellplatz") {
    const praefix = params.praefix || "SP";
    const start = parseInt(params.start, 10) || 1;
    const anzahl = Math.max(0, Math.min(200, parseInt(params.anzahl, 10) || 0));
    const breite = Math.max(1, Math.min(4, parseInt(params.breite, 10) || 2));
    for (let i = 0; i < anzahl; i++) {
      const num = String(start + i).padStart(breite, "-").replace(/-/g, "0");
      const num2 = String(start + i).padStart(breite, "0");
      rows.push({ nr: `${praefix}-${num2}`.trim(), typ: "Stellplatz",
        lage: "", flaeche: "", zimmer: "", mea: "" });
    }
  }
  return rows;
}

function SchnelleingabeScreen({ ves, setVes, kontakte, t, accent, settings = null,
  listenAnsicht = "karten", kartenSpalten = 2, kartenMaxBreite = 340, kartenMin = 272,
  detailMinBreite = 540, detailMin = null, listeOpt = null, festeGridSpec = null, legendeEl = null }) {
  const istDesktop = useWindowWidth() >= DESKTOP_MIN_WIDTH;
  const [objektId, setObjektId] = useState(null); // null = Raster (Objektauswahl)
  const [seNurDetail, setSeNurDetail] = useState(false);
  const istListeSE = listenAnsicht === "liste";

  // Welche Spalten sind aktiv — in KLICK-Reihenfolge (links→rechts). Die fixe
  // Spalte „Einheit" steht immer ganz links und ist NICHT in dieser Liste.
  const [spalten, setSpalten] = useState([]); // z.B. ["nr","typ","mea"]

  const ve = (ves || []).find(v => v && v.id === objektId) || null;
  const einheiten = (ve && Array.isArray(ve.einheiten)) ? ve.einheiten : [];

  // Gemeinsames Bezugsjahr für die Personen-Tage-Ansicht (alle Einheiten zugleich).
  const wjDefault = wirtschaftsjahrZeitraum((ve && ve.etvStamm && ve.etvStamm.wirtschaftsjahr) || "");
  const ptDefaultJahr = (wjDefault && wjDefault.von)
    ? Number(String(wjDefault.von).slice(0, 4)) : (new Date().getFullYear() - 1);
  const [ptJahr, setPtJahr] = useState(ptDefaultJahr);
  // Stift im Kopf: schaltet ALLE Einheiten der Personen-Tage-Ansicht zugleich
  // auf Bearbeiten (Felder editierbar). Aus = reine Anzeige.
  const [ptEdit, setPtEdit] = useState(false);
  // Snapshot für „Abbrechen" (X): beim Start des Bearbeitens wird der aktuelle
  // ves-Stand gesichert; X stellt ihn wieder her (Eingaben zurücksetzen),
  // Haken behält die Änderungen. Muster wie im Objekte-Detail (§86.6).
  const ptSnapshotRef = useRef(null);
  const ptEditStart = () => {
    try { ptSnapshotRef.current = JSON.parse(JSON.stringify(ves || [])); }
    catch (e) { ptSnapshotRef.current = null; }
    setPtEdit(true);
  };
  const ptEditAbbrechen = () => {
    if (ptSnapshotRef.current && setVes) setVes(ptSnapshotRef.current);
    ptSnapshotRef.current = null;
    setPtEdit(false);
  };
  const ptEditFertig = () => { ptSnapshotRef.current = null; setPtEdit(false); };

  // Personen-Tage-Berechnungs-Fenster (Modal): welche Einheit ist offen?
  const [ptModalEinheitId, setPtModalEinheitId] = useState(null);
  // Manuellen Personen-Tage-Wert (Override fürs aktuelle Jahr) setzen/löschen.
  const setzePtManuell = (einheitId, wert) => {
    patchEinheit(einheitId, (e) => setzePersonenTageManuell(e, ptJahr, wert));
  };

  // ── Verfügbare Spalten (Pillen), gruppiert nach Kategorie (kat). Reihenfolge
  //    der Kategorien siehe SPALTEN_KATEGORIEN. Schritt A: vorhandene Felder
  //    einsortiert, Einzug/Auszug entfernt. Heizfläche (B), Eigentümer-/Mieter-
  //    Kontaktdaten (C) und Verteilerschlüssel (D) folgen.
  const SPALTEN_KATALOG_STATISCH = [
    { id: "nr",      label: "Nr.",     breite: 120, art: "text",    kat: "einheit" },
    { id: "typ",     label: "Typ",     breite: 170, art: "typ",     kat: "einheit" },
    { id: "lage",    label: "Lage",    breite: 160, art: "text",    kat: "einheit" },
    { id: "flaeche", label: "Fläche",  breite: 110, art: "num",     kat: "einheit" },
    { id: "heizflaeche", label: "Heizfläche", breite: 120, art: "num", kat: "einheit" },
    { id: "mea",     label: "MEA",     breite: 110, art: "num",     kat: "einheit" },
    // Eigentümer-Kontaktdaten (alle Eigentümer kommagetrennt) — Anzeige-only.
    { id: "eig_name", label: "Eigentümer",  breite: 200, art: "ablesen", kat: "eigentuemer" },
    { id: "eig_tel",  label: "Telefon",     breite: 160, art: "ablesen", kat: "eigentuemer" },
    { id: "eig_mail", label: "E-Mail",      breite: 220, art: "ablesen", kat: "eigentuemer" },
    { id: "eig_adr",  label: "Adresse",     breite: 240, art: "ablesen", kat: "eigentuemer" },
    // Mieter/Pächter — Name editierbar (kontakt), Kontaktdaten abgeleitet.
    { id: "mieter",  label: "Mieter",  breite: 200, art: "kontakt", kat: "mieter" },
    { id: "telefon", label: "Telefon", breite: 160, art: "ablesen", kat: "mieter" },
    { id: "mie_mail", label: "E-Mail", breite: 220, art: "ablesen", kat: "mieter" },
    { id: "mie_adr",  label: "Adresse", breite: 240, art: "ablesen", kat: "mieter" },
    { id: "ptage",   label: "Personen-Tage", breite: 200, art: "ptage", kat: "ptage" },
  ];
  // Dynamische Verteilerschlüssel-Spalten — nur die SELBST angelegten (eigenen)
  // Schlüssel dieses Objekts (Standard-Schlüssel wie MEA/Fläche sind schon als
  // eigene Spalten da). Wert = vsWertVon, Anzeige-only.
  const eigeneVS = ve ? effVerteilerschluessel(ve).filter(s => s && !s.fix) : [];
  const vsSpalten = eigeneVS.map(s => ({
    id: "vs_" + s.id, label: s.name || "Schlüssel", breite: 130, art: "vs",
    kat: "vs", vsId: s.id,
  }));
  const SPALTEN_KATALOG = [...SPALTEN_KATALOG_STATISCH, ...vsSpalten];
  // Kategorie-Reihenfolge + Überschriften für die Pillen-Gruppierung.
  const SPALTEN_KATEGORIEN = [
    { id: "einheit",  label: "Einheit" },
    { id: "eigentuemer", label: "Eigentümer" },
    { id: "mieter",   label: "Mieter / Pächter" },
    { id: "vs",       label: "Verteilerschlüssel" },
    { id: "ptage",    label: "Personen-Tage" },
  ];
  const kontakteListe = Array.isArray(kontakte) ? kontakte : [];
  const kontaktById = (id) => kontakteListe.find(k => k && String(k.id) === String(id)) || null;
  const kontaktName = (k) => k ? (k.name || [k.vorname, k.nachname].filter(Boolean).join(" ") || "Kontakt") : "";
  const kontaktTelefon = (k) => k ? (k.telefon || k.mobil || k.tel || "") : "";
  const kontaktEmail = (k) => {
    if (!k) return "";
    if (k.email) return k.email;
    const liste = Array.isArray(k.emails) ? k.emails : [];
    const erste = liste[0];
    return erste ? (erste.email || erste) : "";
  };
  const kontaktAdresse = (k) => {
    if (!k) return "";
    if (k.adresse) return k.adresse;
    const plzOrt = k.plzOrt || [k.plz, k.ort].filter(Boolean).join(" ");
    return [k.strasse, plzOrt].filter(Boolean).join(", ");
  };
  // Eigentümer-Kontakte einer Einheit (alle, in Reihenfolge). Aus einheit.eigentuemer[].
  const eigentuemerKontakteVon = (einheit) => {
    const liste = (einheit && Array.isArray(einheit.eigentuemer)) ? einheit.eigentuemer : [];
    return liste.map(e => (e && e.kontaktId != null) ? kontaktById(e.kontaktId) : null).filter(Boolean);
  };
  // Mieter-Kontakte einer Einheit (alle benannten Mieter der aktiven Belegung).
  const mieterKontakteVon = (einheit) => {
    const teil = aktiverTeil(einheit);
    const beleg = teil ? (heuteLaufendeBelegung(teil) || aktiveBelegung(teil)) : null;
    const mitglieder = (beleg && beleg.haushalt && Array.isArray(beleg.haushalt.mitglieder))
      ? beleg.haushalt.mitglieder : [];
    return mitglieder.filter(m => m && m.kontaktId != null)
      .map(m => kontaktById(m.kontaktId)).filter(Boolean);
  };
  // Kommagetrennte Liste eines Feldes über mehrere Kontakte (leere weglassen).
  const kontaktFeldListe = (kontakte, fn) =>
    kontakte.map(fn).filter(Boolean).join(", ");
  const spalteDef = (id) => SPALTEN_KATALOG.find(s => s.id === id) || null;

  const toggleSpalte = (id) => {
    setSpalten(prev => prev.indexOf(id) >= 0
      ? prev.filter(x => x !== id)        // abwählen
      : [...prev, id]);                   // anhängen (rechts)
  };

  // ── Eine Einheit im Objekt patchen (immutabel zurückschreiben). ──
  const patchEinheit = (einheitId, mut) => {
    setVes(prev => (prev || []).map(v => {
      if (!v || v.id !== objektId) return v;
      const neueEinheiten = (v.einheiten || []).map(e =>
        (e && e.id === einheitId) ? mut(e) : e);
      return { ...v, einheiten: neueEinheiten };
    }));
  };

  // ── Mieter (kontakt-verknüpft) lesen: aktiver Teil → aktive Belegung →
  //    erstes benanntes Mitglied mit recht "mieter" (sonst erstes mit kontaktId). ──
  const mieterMitgliedVon = (einheit) => {
    const teil = aktiverTeil(einheit);
    const beleg = teil ? (heuteLaufendeBelegung(teil) || aktiveBelegung(teil)) : null;
    const mitglieder = (beleg && beleg.haushalt && Array.isArray(beleg.haushalt.mitglieder))
      ? beleg.haushalt.mitglieder : [];
    const benannt = mitglieder.filter(m => m && m.kontaktId != null);
    const mieter = benannt.find(m => m.recht === "mieter");
    return mieter || benannt[0] || null;
  };
  const mieterKontaktIdVon = (einheit) => {
    const m = mieterMitgliedVon(einheit);
    return m ? m.kontaktId : null;
  };

  // ── Mieter setzen: aktiven Teil holen; aktive (Vermietungs-)Belegung finden
  //    oder eine anlegen; im Haushalt das benannte Mieter-Mitglied auf die
  //    gewählte kontaktId setzen (vorhandenes ersetzen, sonst hinzufügen). Leere
  //    Auswahl entfernt das benannte Mieter-Mitglied wieder. ──
  const schreibeMieter = (einheitId, kontaktId) => {
    patchEinheit(einheitId, (e) => {
      const teile = teileVon(e);
      if (!Array.isArray(teile) || teile.length === 0) return e;
      const aktiv = aktiverTeil(e) || teile[0];
      let beleg = heuteLaufendeBelegung(aktiv) || aktiveBelegung(aktiv);
      const istStellplatz = isStellplatzTyp(e.typ);
      if (istStellplatz) return e; // Stellplätze haben keinen Mieter-Haushalt
      // Belegung sicherstellen (Vermietung, wenn keine passende existiert).
      let belegungen = Array.isArray(aktiv.belegungen) ? aktiv.belegungen.slice() : [];
      if (!beleg) {
        beleg = neueBelegung("vermietung", "");
        belegungen = belegungen.concat([beleg]);
      }
      const neueBelegungen = belegungen.map(b => {
        if (b.id !== beleg.id) return b;
        const hh = (b.haushalt && Array.isArray(b.haushalt.mitglieder))
          ? { ...b.haushalt, mitglieder: b.haushalt.mitglieder.slice() }
          : { mitglieder: [] };
        // Vorhandenes benanntes Mieter-Mitglied finden.
        const idx = hh.mitglieder.findIndex(m => m && m.kontaktId != null && m.recht === "mieter");
        if (kontaktId == null || kontaktId === "") {
          // Auswahl geleert → benanntes Mieter-Mitglied entfernen.
          if (idx >= 0) hh.mitglieder.splice(idx, 1);
        } else {
          const k = kontaktById(kontaktId);
          const nm = neuesHhMitglied(kontaktId, kontaktName(k), "mieter");
          if (idx >= 0) hh.mitglieder[idx] = { ...hh.mitglieder[idx], kontaktId: kontaktId, name: kontaktName(k), recht: "mieter" };
          else hh.mitglieder.push(nm);
        }
        return { ...b, haushalt: hh };
      });
      const neueTeile = e.teile.map(teil => teil === aktiv ? { ...aktiv, belegungen: neueBelegungen } : teil);
      return { ...e, teile: neueTeile };
    });
  };

  // ── Wert einer Zelle lesen ──
  const leseWert = (einheit, sid) => {
    if (sid === "nr")      return einheit.nr || "";
    if (sid === "typ")     return einheit.typ || "";
    if (sid === "lage")    return einheit.lage || "";
    if (sid === "mea")     return einheit.mea || "";
    if (sid === "flaeche") return flaecheVon(einheit) ? String(flaecheVon(einheit)) : (einheit.flaeche || "");
    if (sid === "heizflaeche") return heizflaecheVon(einheit);
    if (sid === "mieter")  { const id = mieterKontaktIdVon(einheit); return id == null ? "" : String(id); }
    if (sid === "telefon") { const id = mieterKontaktIdVon(einheit); return kontaktTelefon(kontaktById(id)); }
    // Eigentümer-Kontaktdaten (alle Eigentümer, kommagetrennt).
    if (sid === "eig_name") return kontaktFeldListe(eigentuemerKontakteVon(einheit), kontaktName);
    if (sid === "eig_tel")  return kontaktFeldListe(eigentuemerKontakteVon(einheit), kontaktTelefon);
    if (sid === "eig_mail") return kontaktFeldListe(eigentuemerKontakteVon(einheit), kontaktEmail);
    if (sid === "eig_adr")  return kontaktFeldListe(eigentuemerKontakteVon(einheit), kontaktAdresse);
    // Mieter-Kontaktdaten (alle Mieter, kommagetrennt).
    if (sid === "mie_mail") return kontaktFeldListe(mieterKontakteVon(einheit), kontaktEmail);
    if (sid === "mie_adr")  return kontaktFeldListe(mieterKontakteVon(einheit), kontaktAdresse);
    // Verteilerschlüssel (dynamisch): vs_<id> → Wert für die Einheit.
    if (sid.indexOf("vs_") === 0) {
      const sdef = spalteDef(sid);
      const schluessel = (sdef && ve) ? effVerteilerschluessel(ve).find(s => s.id === sdef.vsId) : null;
      if (!schluessel) return "";
      const wj = { von: `${ptJahr}-01-01`, bis: `${ptJahr}-12-31` };
      const wert = vsWertVon(schluessel, einheit, wj);
      return (wert != null && wert !== 0) ? String(wert) : (wert === 0 ? "0" : "");
    }
    return "";
  };

  // ── Wert einer Zelle schreiben ──
  const schreibeWert = (einheitId, sid, wert) => {
    if (sid === "mieter") { schreibeMieter(einheitId, wert === "" ? null : wert); return; }
    patchEinheit(einheitId, (e) => {
      if (sid === "nr")      return { ...e, nr: wert };
      if (sid === "typ")     return { ...e, typ: wert };
      if (sid === "lage")    return { ...e, lage: wert };
      if (sid === "mea")     return setzeEinheitMea(e, wert);
      if (sid === "flaeche") return setzeEinheitFlaeche(e, wert);
      if (sid === "heizflaeche") return setzeEinheitHeizflaeche(e, wert);
      return e;
    });
  };

  // Zell-Eingabe — je nach Spalten-Art Text/Zahl/Dropdown.
  const zellInput = (einheit, sdef) => {
    const wert = leseWert(einheit, sdef.id);
    // Personen-Tage: Zahl-Eingabe = manueller Override fürs aktuelle Jahr; der
    // Platzhalter zeigt den berechneten Wert. Button daneben öffnet das
    // Berechnungs-Fenster (Belegungs-Aufschlüsselung).
    if (sdef.art === "ptage") {
      if (isStellplatzTyp(einheit.typ)) {
        return <span style={{ fontSize: FS.s, color: t.muted, fontStyle: "italic" }}>—</span>;
      }
      const pt = personenTageWert(einheit, ptJahr);
      const fj = personenTageFolgejahr(einheit, ptJahr);
      const rot = fj.entscheidungNoetig;
      return (
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <input
              inputMode="numeric"
              value={pt.manuell != null ? String(pt.manuell) : ""}
              placeholder={`${pt.berechnet} (ber.)`}
              onChange={e => setzePtManuell(einheit.id, e.target.value.replace(/[^0-9]/g, ""))}
              style={{ width: "100%", minWidth: 0, boxSizing: "border-box", background: t.card,
                border: `1px solid ${rot ? "#EF4444" : (pt.istManuell ? accent : t.border)}`, borderRadius: RAD.sm,
                padding: "6px 8px", fontSize: FS.input, color: t.text,
                outline: "none", fontFamily: "inherit" }}/>
            <button onClick={() => setPtModalEinheitId(einheit.id)}
              title="Personen-Tage berechnen" aria-label="Personen-Tage berechnen"
              style={{ display: "flex", alignItems: "center", justifyContent: "center",
                width: 32, height: 32, flexShrink: 0, background: "none",
                border: `1px solid ${t.border}`, borderRadius: RAD.sm, cursor: "pointer",
                color: t.sub }}>
              <I name="calc" size={15} color={t.sub}/>
            </button>
          </div>
          {rot && (
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <span style={{ fontSize: FS.xxs, color: "#EF4444" }}>
                Vorjahr {fj.vorjahr}: {fj.vorjahrWert} — entscheiden
              </span>
              <button onClick={() => setzePtManuell(einheit.id, fj.vorjahrWert)}
                title="Vorjahreswert übernehmen"
                style={{ display: "inline-flex", alignItems: "center", gap: 4,
                  background: "none", border: `1px solid ${accent}`, borderRadius: RAD.sm,
                  color: accent, cursor: "pointer", fontFamily: "inherit",
                  fontSize: FS.xxs, padding: "2px 8px" }}>
                <I name="check" size={11} color={accent}/> übernehmen
              </button>
            </div>
          )}
        </div>
      );
    }
    if (sdef.art === "typ") {
      const isTG = isStellplatzTyp(einheit.typ);
      return (
        <select value={wert}
          onChange={e => schreibeWert(einheit.id, "typ", e.target.value)}
          style={{ width: "100%", boxSizing: "border-box", background: t.card,
            border: `1px solid ${t.border}`, borderRadius: RAD.sm,
            padding: "6px 8px", fontSize: FS.input, color: t.text,
            outline: "none", fontFamily: "inherit", appearance: "auto" }}>
          <option value="">—</option>
          <option value="Wohneigentum">Wohneigentum</option>
          <option value="Teileigentum">Teileigentum</option>
          <option value="Gewerbe">Gewerbe</option>
          <option value="Stellplatz">Stellplatz</option>
          <option value="Garage">Garage</option>
          <option value="Carport">Carport</option>
          <option value="Doppelparker">Doppelparker</option>
        </select>
      );
    }
    // Mieter — Kontakt-Auswahl. Bei Stellplätzen kein Mieter-Haushalt.
    if (sdef.art === "kontakt") {
      if (isStellplatzTyp(einheit.typ)) {
        return <span style={{ fontSize: FS.s, color: t.muted, fontStyle: "italic" }}>—</span>;
      }
      return (
        <select value={wert}
          onChange={e => schreibeWert(einheit.id, "mieter", e.target.value)}
          style={{ width: "100%", boxSizing: "border-box", background: t.card,
            border: `1px solid ${t.border}`, borderRadius: RAD.sm,
            padding: "6px 8px", fontSize: FS.input, color: t.text,
            outline: "none", fontFamily: "inherit", appearance: "auto" }}>
          <option value="">— kein Mieter —</option>
          {kontakteListe.map(k => (
            <option key={k.id} value={String(k.id)}>{kontaktName(k)}</option>
          ))}
        </select>
      );
    }
    // Abgeleitete Werte (Kontaktdaten, Verteilerschlüssel) — nur Anzeige.
    if (sdef.art === "ablesen" || sdef.art === "vs") {
      return (
        <div style={{ fontSize: FS.m, color: wert ? t.text : t.muted,
          padding: "6px 2px", whiteSpace: "nowrap", overflow: "hidden",
          textOverflow: "ellipsis" }}>
          {wert || "—"}
        </div>
      );
    }
    return (
      <input value={wert}
        inputMode={sdef.art === "num" ? "decimal" : "text"}
        onChange={e => schreibeWert(einheit.id, sdef.id, e.target.value)}
        style={{ width: "100%", boxSizing: "border-box", background: t.card,
          border: `1px solid ${t.border}`, borderRadius: RAD.sm,
          padding: "6px 8px", fontSize: FS.input, color: t.text,
          outline: "none", fontFamily: "inherit" }}/>
    );
  };

  // Lese-Darstellung einer Tabellen-Zelle (Anzeige-Modus, ptEdit=false): zeigt
  // den reinen Wert ohne Eingabefeld.
  const zellText = (einheit, sdef) => {
    const wert = leseWert(einheit, sdef.id);
    if (sdef.art === "ptage") {
      if (isStellplatzTyp(einheit.typ)) {
        return <span style={{ fontSize: FS.s, color: t.muted, fontStyle: "italic" }}>—</span>;
      }
      const pt = personenTageWert(einheit, ptJahr);
      const fj = personenTageFolgejahr(einheit, ptJahr);
      const rot = fj.entscheidungNoetig;
      return (
        <span style={{ fontSize: FS.m, color: rot ? "#EF4444" : t.text, whiteSpace: "nowrap" }}>
          <b>{pt.wert}</b>
          <span style={{ fontSize: FS.xxs, color: rot ? "#EF4444" : (pt.istManuell ? accent : t.muted), marginLeft: 6 }}>
            {rot ? `Vorjahr ${fj.vorjahrWert} — prüfen` : (pt.istManuell ? "manuell" : "berechnet")}
          </span>
        </span>
      );
    }
    if (sdef.art === "kontakt") {
      if (isStellplatzTyp(einheit.typ)) {
        return <span style={{ fontSize: FS.s, color: t.muted, fontStyle: "italic" }}>—</span>;
      }
      const k = wert ? kontaktById(wert) : null;
      return <span style={{ fontSize: FS.m, color: k ? t.text : t.muted }}>{k ? kontaktName(k) : "—"}</span>;
    }
    return (
      <span style={{ fontSize: FS.m, color: wert ? t.text : t.muted, whiteSpace: "nowrap",
        overflow: "hidden", textOverflow: "ellipsis", display: "block" }}>{wert || "—"}</span>
    );
  };

  // ── MASTER-DETAIL (Benny v12.35): links Objektauswahl (Karte/Liste, festes
  //    Schema), rechts die Schnelleingabe-Maske an gleicher x-Position. Mobil:
  //    Vollbild-Wechsel mit „Zurück". ──
  const seMasterInhalt = (layout) => (
    (ves || []).length === 0 ? (
      <div style={{ fontSize: FS.m, color: t.muted, fontStyle: "italic", marginTop: 16 }}>
        Noch keine Objekte vorhanden.
      </div>
    ) : (
      <div style={istListeSE
        ? { display: "flex", flexDirection: "column", gap: 6 }
        : kartenGridStyle(layout)}>
        {(ves || []).map(v => istListeSE ? (
          <VEListenZeile key={v.id} ve={v} t={t} accent={accent}
            aktiv={objektId === v.id} kbItem id={"se-" + v.id}
            auswahlAccentOverride={accent}
            onClick={() => setObjektId(objektId === v.id ? null : v.id)}/>
        ) : (
          <VEKachel key={v.id} ve={v} t={t} accent={accent} kbItem
            aktiv={objektId === v.id} id={"se-" + v.id}
            auswahlAccentOverride={accent}
            onClick={() => setObjektId(objektId === v.id ? null : v.id)}/>
        ))}
      </div>
    )
  );

  const seHeader = (
    <ScreenKopf t={t} accent={accent} titel="Schnelleingabe"
      rechts={(ve && seNurDetail) ? (
        <HeaderZurueck onClick={() => setObjektId(null)} t={t}/>
      ) : null}/>
  );

  // MOBIL: kein Objekt → nur Auswahl; Objekt gewählt → Maske (mit Zurück).
  if (!istDesktop && !ve) {
    return (
      <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column" }}>
        {seHeader}
        <div data-ad-scroll="y" style={{ flex: 1, minHeight: 0, overflowY: "auto",
          paddingBottom: "max(env(safe-area-inset-bottom, 0px), 80px)" }}>
          {legendeEl}
          {seMasterInhalt({ einspaltig: true, nurMaster: true, cols: 1, kartenMaxBreite: kartenMaxBreite })}
        </div>
      </div>
    );
  }

  // Header-Aktion rechts (§86.6): Anzeige-Modus = runder Stift; Bearbeiten-Modus
  // = X (Abbrechen, setzt Eingaben zurück) + Haken (Fertig, behält). Rund 36×36,
  // accent-Hintergrund — identisch zum Objekte-Detail. Auf BEIDEN Modi (Tabelle
  // + Personen-Tage) sichtbar, sobald ein Objekt gewählt ist.
  const rundBtnStyle = {
    display: "flex", alignItems: "center", justifyContent: "center",
    width: 36, height: 36, flexShrink: 0, background: accent, border: "none",
    borderRadius: RAD.pill, cursor: "pointer", boxShadow: `0 1px 2px ${accent}40`,
  };
  const editAktion = ve ? (
    ptEdit ? (
      <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
        <button onClick={ptEditAbbrechen}
          title="Abbrechen — Eingaben zurücksetzen" aria-label="Abbrechen"
          style={rundBtnStyle}>
          <I name="x" size={16} color="#EF4444"/>
        </button>
        <button onClick={ptEditFertig}
          title="Fertig — Änderungen behalten" aria-label="Fertig"
          style={rundBtnStyle}>
          <I name="check" size={14} color="#FFFFFF"/>
        </button>
      </div>
    ) : (
      <button onClick={ptEditStart}
        title="Bearbeiten" aria-label="Bearbeiten"
        style={rundBtnStyle}>
        <I name="pencil" size={14} color={getContrastColor(accent)}/>
      </button>
    )
  ) : null;

  // Personen-Tage-Berechnungs-Fenster (Modal) — als const vorab (keine IIFE in
  // JSX). Öffnet die Belegungs-Aufschlüsselung der gewählten Einheit. Pflegt man
  // hier die Belegung, kann der manuelle Override fürs Jahr entfernt werden.
  const ptModalEinheit = ptModalEinheitId != null
    ? einheiten.find(e => e.id === ptModalEinheitId) : null;
  const ptModalPt = ptModalEinheit ? personenTageWert(ptModalEinheit, ptJahr) : null;
  const ptModalNode = ptModalEinheit ? (
    <div onClick={() => setPtModalEinheitId(null)}
      style={{ position: "fixed", inset: 0, zIndex: 300, background: "rgba(0,0,0,0.6)",
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: 16, paddingTop: "max(env(safe-area-inset-top, 0px), 16px)",
        paddingBottom: "max(env(safe-area-inset-bottom, 0px), 16px)" }}>
      <div onClick={ev => ev.stopPropagation()}
        style={{ background: t.surface || t.card, borderRadius: RAD.xl,
          border: `1px solid ${t.border}`, width: "100%", maxWidth: 560,
          maxHeight: "90dvh", display: "flex", flexDirection: "column", overflow: "hidden" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10,
          padding: "12px 14px", borderBottom: `1px solid ${t.border}`, flexShrink: 0 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: FS.l, fontWeight: FW.bold, color: t.text }}>
              Personen-Tage berechnen
            </div>
            <div style={{ fontSize: FS.xs, color: t.muted }}>
              {(ptModalEinheit.nr || "Einheit") + (ptModalEinheit.lage ? ` · ${ptModalEinheit.lage}` : "")} · Jahr {ptJahr}
            </div>
          </div>
          <button onClick={() => setPtModalEinheitId(null)}
            title="Schließen" aria-label="Schließen"
            style={{ display: "flex", alignItems: "center", justifyContent: "center",
              width: 36, height: 36, flexShrink: 0, background: accent, border: "none",
              borderRadius: RAD.pill, cursor: "pointer" }}>
            <I name="x" size={16} color={getContrastColor(accent)}/>
          </button>
        </div>
        <div data-ad-scroll="y" style={{ flex: 1, minHeight: 0, overflowY: "auto", padding: "12px 14px" }}>
          {ptModalPt.istManuell && (
            <div style={{ fontSize: FS.s, color: accent, background: accent + "12",
              border: `1px solid ${accent}55`, borderRadius: RAD.sm,
              padding: "8px 10px", marginBottom: 12 }}>
              Aktuell manuell gesetzt: <b>{ptModalPt.manuell}</b>.
              Wenn du hier die Belegung pflegst, gilt wieder die Berechnung.
              <div style={{ marginTop: 8 }}>
                <button onClick={() => setzePtManuell(ptModalEinheit.id, "")}
                  style={{ background: "none", border: `1px solid ${accent}`,
                    borderRadius: RAD.sm, color: accent, cursor: "pointer",
                    fontFamily: "inherit", fontSize: FS.s, padding: "5px 10px" }}>
                  Manuellen Wert entfernen
                </button>
              </div>
            </div>
          )}
          <PersonenTageUebersicht einheit={ptModalEinheit} t={t} accent={accent}
            jahrExtern={ptJahr} immerOffen titel={`Personen-Tage ${ptJahr}`}
            einheitLabel={`${ptModalEinheit.nr || ptModalEinheit.lage || "Einheit"}${ptModalEinheit.nr && ptModalEinheit.lage ? ` · ${ptModalEinheit.lage}` : ""}`}
            bearbeiten={true}
            onUpdate={(neuE) => patchEinheit(ptModalEinheit.id, () => neuE)}/>
        </div>
      </div>
    </div>
  ) : null;

  // Maske-Inhalt (Detail) — gemeinsam für Desktop-Detail und Mobil-Vollbild.
  // Spalten-Pillen, gruppiert nach Kategorie (§-Konzept Schnelleingabe-Spalten).
  // Jede Kategorie mit eigener kleiner Überschrift; nur Kategorien mit Spalten
  // werden gezeigt. Eine Pille = eine Spalte zuschalten (Nummer = Position in der
  // Tabelle). Als const vorab gebaut (keine IIFE in JSX, §14).
  const pilleNode = (s) => {
    const an = spalten.indexOf(s.id) >= 0;
    const pos = spalten.indexOf(s.id) + 1;
    return (
      <button key={s.id} onClick={() => toggleSpalte(s.id)}
        style={{ display: "inline-flex", alignItems: "center", gap: 6,
          padding: "6px 12px", borderRadius: RAD.pill, cursor: "pointer",
          fontFamily: "inherit", fontSize: FS.m, fontWeight: FW.medium,
          border: `1px solid ${an ? accent : t.border}`,
          background: an ? accent : "none",
          color: an ? getContrastColor(accent) : t.sub }}>
        {an && (
          <span style={{ fontSize: FS.xxs, fontWeight: FW.bold,
            background: getContrastColor(accent) + "33", borderRadius: RAD.pill,
            padding: "0 5px" }}>{pos}</span>
        )}
        {s.label}
      </button>
    );
  };
  const pillenGruppenNode = (
    <div style={{ marginBottom: 8 }}>
      <div style={{ fontSize: FS.xs, fontWeight: FW.bold, color: t.muted,
        textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 8 }}>
        Spalten wählen
      </div>
      {SPALTEN_KATEGORIEN.map(kat => {
        const spaltenDerKat = SPALTEN_KATALOG.filter(s => s.kat === kat.id);
        if (spaltenDerKat.length === 0) return null;
        return (
          <div key={kat.id} style={{ marginBottom: 10 }}>
            <div style={{ fontSize: FS.xxs, fontWeight: FW.bold, color: t.sub,
              marginBottom: 5 }}>{kat.label}</div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {spaltenDerKat.map(s => pilleNode(s))}
            </div>
          </div>
        );
      })}
    </div>
  );

  const seMaske = (
      <>
        {/* Detail-Titelzeile aus dem zentralen DetailKopf-Baustein (§76) — exakt
            wie Objekt-Detail: VE-Nr + Adresse links, Bearbeiten-Stift (bzw. X+Haken)
            rechts in DERSELBEN Zeile. */}
        {ve && (
          <ObjektDetailKopf t={t} accent={accent} ve={ve}
            aktion={editAktion}/>
        )}

        {/* Wirtschaftsjahr-Umschalter — steuert die Personen-Tage-Spalte. Bleibt
            immer sichtbar (der Tabelle/Personen-Tage-Umschalter entfällt; Personen-
            Tage sind jetzt eine Spalte in der Tabelle). */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center",
          gap: 10, marginBottom: 14 }}>
          <button onClick={() => setPtJahr(j => j - 1)}
            title="Jahr zurück" aria-label="Jahr zurück"
            style={{ background: "none", border: `1px solid ${t.border}`, borderRadius: RAD.sm,
              color: t.sub, fontSize: 18, cursor: "pointer", width: 38, height: 34 }}>‹</button>
          <div style={{ textAlign: "center", minWidth: 84 }}>
            <div style={{ fontSize: FS.m, fontWeight: FW.bold, color: t.text }}>Jahr {ptJahr}</div>
            <div style={{ fontSize: FS.xxs, color: t.muted }}>Wirtschaftsjahr</div>
          </div>
          <button onClick={() => setPtJahr(j => j + 1)}
            title="Jahr vor" aria-label="Jahr vor"
            style={{ background: "none", border: `1px solid ${t.border}`, borderRadius: RAD.sm,
              color: t.sub, fontSize: 18, cursor: "pointer", width: 38, height: 34 }}>›</button>
        </div>

        <>
        {/* Pillen: Spalten zuschalten — IMMER sichtbar (auch im Lese-Modus), nach
            Kategorie gruppiert. Das Eintippen der Zellwerte bleibt dem Bearbeiten-
            Modus vorbehalten (zellInput vs zellText). */}
        {pillenGruppenNode}

        {/* Tabelle: Zeilen = Einheiten, Spalte 1 fix = Einheit, dann gewählte Spalten */}
        {einheiten.length === 0 ? (
          <div style={{ fontSize: FS.m, color: t.muted, fontStyle: "italic", marginTop: 16 }}>
            Dieses Objekt hat noch keine Einheiten.
          </div>
        ) : (
          <div style={{ overflowX: "auto", border: `1px solid ${t.border}`,
            borderRadius: RAD.lg, marginTop: 10 }}>
            <table style={{ borderCollapse: "collapse", width: "100%",
              fontSize: FS.m, color: t.text }}>
              <thead>
                <tr style={{ background: t.surface }}>
                  <th style={{ textAlign: "left", padding: "10px 12px",
                    borderBottom: `1px solid ${t.border}`, position: "sticky", left: 0,
                    background: t.surface, fontWeight: FW.bold, color: t.sub,
                    minWidth: 130, whiteSpace: "nowrap" }}>Einheit</th>
                  {spalten.map(sid => {
                    const sd = spalteDef(sid);
                    return sd ? (
                      <th key={sid} style={{ textAlign: "left", padding: "10px 12px",
                        borderBottom: `1px solid ${t.border}`, fontWeight: FW.bold,
                        color: t.sub, minWidth: sd.breite, whiteSpace: "nowrap" }}>{sd.label}</th>
                    ) : null;
                  })}
                  {spalten.length === 0 && (
                    <th style={{ textAlign: "left", padding: "10px 12px",
                      borderBottom: `1px solid ${t.border}`, fontWeight: FW.regular,
                      color: t.muted, fontStyle: "italic" }}>
                      Oben Spalten wählen …
                    </th>
                  )}
                </tr>
              </thead>
              <tbody>
                {einheiten.map((e, ri) => (
                  <tr key={e.id} style={{ background: ri % 2 ? t.card : "transparent" }}>
                    <td style={{ padding: "6px 12px", borderBottom: `1px solid ${t.border}40`,
                      position: "sticky", left: 0, background: ri % 2 ? t.card : t.bg || t.card,
                      fontWeight: FW.bold, color: accent, whiteSpace: "nowrap" }}>
                      {e.nr || ("Einheit " + (ri + 1))}
                    </td>
                    {spalten.map(sid => {
                      const sd = spalteDef(sid);
                      return sd ? (
                        <td key={sid} style={{ padding: "6px 8px",
                          borderBottom: `1px solid ${t.border}40`, verticalAlign: "middle" }}>
                          {ptEdit ? zellInput(e, sd) : zellText(e, sd)}
                        </td>
                      ) : null;
                    })}
                    {spalten.length === 0 && (
                      <td style={{ padding: "6px 12px", borderBottom: `1px solid ${t.border}40`,
                        color: t.muted }}>—</td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        </>

        {/* Personen-Tage-Berechnungs-Fenster (Modal) — öffnet die Belegungs-
            Aufschlüsselung der gewählten Einheit. Wer hier die Belegung pflegt,
            dessen manueller Override fürs Jahr wird entfernt (zurück zur
            Berechnung). Muster: überlagerter Dialog (Modal-Baustein §76.2). */}
        {ptModalNode}
      </>
  );

  // MOBIL: Objekt gewählt → Maske im Vollbild mit „Zurück".
  if (!istDesktop) {
    return (
      <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column" }}>
        <ScreenKopf t={t} accent={accent} titel="Schnelleingabe"
          rechts={
            <HeaderZurueck onClick={() => setObjektId(null)} t={t}/>
          }/>
        <div data-ad-scroll="y" style={{ flex: 1, minHeight: 0, overflowY: "auto",
          paddingBottom: "max(env(safe-area-inset-bottom, 0px), 80px)" }}>
          {legendeEl ? (
            <div style={{ flexShrink: 0, padding: "0 2px", marginBottom: 10 }}>{legendeEl}</div>
          ) : null}
          {ve ? <DetailRahmen t={t} accent={accent}>{seMaske}</DetailRahmen> : seMaske}
        </div>
      </div>
    );
  }

  // DESKTOP: Master-Detail über den kanonischen Baustein (§75).
  return (
    <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column" }}>
      {seHeader}
      {legendeEl ? (
        <div style={{ flexShrink: 0, padding: "0 2px" }}>{legendeEl}</div>
      ) : null}
      <MasterDetailRahmen
        master={seMasterInhalt}
        detail={ve ? <DetailRahmen t={t} accent={accent}>{seMaske}</DetailRahmen> : null}
        istDesktop={true}
        listenAnsicht={listenAnsicht} listeOpt={listeOpt}
        kartenSpalten={kartenSpalten} kartenMaxBreite={kartenMaxBreite}
        kartenMin={kartenMin} detailMinBreite={detailMinBreite} detailMin={detailMin}
        t={t} onNurDetail={setSeNurDetail}/>
    </div>
  );
}
//    Druck. Schriftgröße/Zeilenabstand wirken auf Vorschau UND Druck identisch.
const LG_FONT = { s: 9.5, m: 11, l: 13 };          // Druck-pt ≈ Vorschau-px
const LG_PAD  = { kompakt: 2, normal: 4, weit: 8 }; // vertikales Zellen-Padding
function ListenGeneratorScreen({ ves, kontakte, t, accent, settings,
  listenAnsicht = "karten", kartenSpalten = 2, kartenMaxBreite = 340, kartenMin = 272,
  detailMinBreite = 540, detailMin = null, listeOpt = null, festeGridSpec = null, legendeEl = null }) {
  const [vorlageId, setVorlageId] = useState(null);
  const [lgNurDetail, setLgNurDetail] = useState(false);
  // AUSWAHL-EBENE (Benny v12.35, Statistik-Modell): Pille Objekte/Gruppen.
  // Objekte → einzelnes Objekt (objektId), Detail zeigt "je Objekt"-Listen.
  // Gruppen → Alle/Verwaltungsart/eigene Gruppe, Detail zeigt "alle"-Listen.
  const [lgView, setLgView] = useState("objekte"); // "objekte" | "gruppen"
  const [objektId, setObjektId] = useState(null);
  const [aktGruppe, setAktGruppe] = useState(null); // "kind:id" | null
  const [hausId, setHausId] = useState(null);
  const [spaltenAn, setSpaltenAn] = useState({});   // { vorlageId: { spaltenId: bool } }
  const [filterAn, setFilterAn] = useState({});     // { vorlageId: { filterId: bool } }
  const [quer, setQuer] = useState(false);
  const [schildLayout, setSchildLayout] = useState("tabelle"); // "tabelle" | "schilder"
  const [rolleFilter, setRolleFilter] = useState("");
  const [fontGr, setFontGr] = useState("m");        // s | m | l
  const [abstand, setAbstand] = useState("normal"); // kompakt | normal | weit
  const [mitHv, setMitHv] = useState(true);
  const [mitLogo, setMitLogo] = useState(true);

  // Master-Detail-Gerüst wie Statistik: links Objekt-/Gruppenauswahl, rechts
  // Vorlagenauswahl + Aufbau-Bereich. Detail an gleicher x-Position.
  const istDesktopLG = useWindowWidth() >= DESKTOP_MIN_WIDTH;
  const istListeLG = listenAnsicht === "liste";

  // Gruppen-Auswahlliste: Alle Objekte → Verwaltungsarten → eigene Gruppen.
  const lgGruppen = [];
  lgGruppen.push({ kind: "alle", id: "alle", label: "Alle Objekte",
    sub: ves.length + (ves.length === 1 ? " Objekt" : " Objekte"), filter: () => true });
  VERWALTUNGSARTEN.forEach(a => {
    const n = (ves || []).filter(v => (v.verwaltungsart || "weg") === a.id).length;
    if (n > 0) lgGruppen.push({ kind: "art", id: a.id, label: a.label,
      sub: n + (n === 1 ? " Objekt" : " Objekte"), filter: v => (v.verwaltungsart || "weg") === a.id });
  });
  ((settings && settings.objektGruppen) || []).forEach(g => {
    if (!g) return;
    const n = (ves || []).filter(v => objektInGruppe(v, g)).length;
    lgGruppen.push({ kind: "gruppe", id: g.id, label: g.name || g.kurz || "Gruppe",
      sub: n + (n === 1 ? " Objekt" : " Objekte"), filter: v => objektInGruppe(v, g) });
  });
  const lgHatAuswahl = (lgView === "objekte" && objektId) || (lgView === "gruppen" && aktGruppe);
  // Welche Vorlagen darf das Detail zeigen? Objekte-Pille → nur "objekt"-Listen,
  // Gruppen-Pille → nur "alle"-Listen.
  const erlaubterBereich = lgView === "objekte" ? "objekt" : "alle";
  const sichtbareVorlagen = LISTEN_KATALOG.filter(v => v.bereich === erlaubterBereich);

  const vorlage = LISTEN_KATALOG.find(v => v.id === vorlageId) || null;
  // ve = das in der Objekte-Pille gewählte Objekt (kein Fallback mehr aufs erste,
  // sonst würde bei Gruppen-Auswahl fälschlich ein Objekt mitlaufen).
  const ve = (ves || []).find(v => v && v.id === objektId) || null;
  const haeuser = (vorlage && vorlage.hausFilter && ve) ? lgHaeuserVon(ve) : [];
  const hausWaehlbar = haeuser.length > 1;
  const effHausId = hausWaehlbar ? hausId : null;

  // Spalten-/Filter-State mit Defaults der Vorlage zusammenführen.
  const spaltenState = {};
  if (vorlage) vorlage.spalten.forEach(s => {
    const ueber = spaltenAn[vorlage.id];
    spaltenState[s.id] = ueber && (s.id in ueber) ? ueber[s.id] : s.default;
  });
  const filterState = {};
  if (vorlage) vorlage.filter.forEach(fd => {
    const ueber = filterAn[vorlage.id];
    filterState[fd.id] = ueber && (fd.id in ueber) ? ueber[fd.id] : fd.default;
  });
  const toggleSpalte = (sid) => setSpaltenAn(prev => ({ ...prev,
    [vorlage.id]: { ...(prev[vorlage.id] || {}), [sid]: !spaltenState[sid] } }));
  const toggleFilter = (fid) => setFilterAn(prev => ({ ...prev,
    [vorlage.id]: { ...(prev[vorlage.id] || {}), [fid]: !filterState[fid] } }));

  // Zeilen berechnen (Vorlage + Bereich + Haus + Filter).
  let rows = [];
  if (vorlage && (vorlage.bereich === "alle" || ve)) {
    rows = vorlage.zeilen({ ve: ve, ves: ves, kontakte: kontakte, f: filterState,
      hausId: effHausId, rolleFilter: rolleFilter });
  }
  const aktiveSpalten = vorlage ? vorlage.spalten.filter(s => spaltenState[s.id]) : [];
  const fussnote = vorlage && vorlage.fussnote ? vorlage.fussnote(rows) : null;

  // Hausverwaltung + Logo für den Listenkopf.
  const hvFallback = (settings && settings.hvName) || "";
  const hv = vorlage ? lgHvKontakt(vorlage.bereich === "objekt" ? ve : null, kontakte, hvFallback) : null;
  const logoSrc = (settings && (settings.hvLogo || settings.hvLogoUrl)) || "";
  const zeigeHv = mitHv && !!hv;
  const zeigeLogo = mitLogo && !!logoSrc;

  // Rollen-Auswahl für die Kontaktliste (alle vorkommenden Rollen + Gewerke).
  const alleRollen = [];
  if (vorlage && vorlage.hatRollenFilter) {
    (kontakte || []).forEach(k => {
      if (!k) return;
      (k.objektZuweisungen || []).forEach(z => {
        if (z && z.rolle && alleRollen.indexOf(z.rolle) < 0) alleRollen.push(z.rolle);
      });
      (k.gewerke || []).forEach(g => {
        const n = typeof g === "string" ? g : (g && g.name);
        if (n && alleRollen.indexOf(n) < 0) alleRollen.push(n);
      });
    });
    alleRollen.sort((a, b) => a.localeCompare(b, "de"));
  }

  const hausName = effHausId != null
    ? ((haeuser.find(h => h.id === effHausId) || {}).name || "") : "";
  const druckTitel = vorlage ? vorlage.label + (vorlage.bereich === "objekt" && ve
    ? " – " + (ve.nr || "") + (ve.adresse ? " · " + ve.adresse : "")
      + (hausName ? " · " + hausName : "") : "") : "";
  const fontPx = LG_FONT[fontGr];
  const padPx = LG_PAD[abstand];
  const heute = new Date().toLocaleDateString("de-DE");
  const istSchilder = vorlage && vorlage.sonder === "klingelschild" && schildLayout === "schilder";

  // ── Druck ──
  const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const hvBlockHtml = () => {
    if (!zeigeHv) return "";
    const teile = [hv.tel, hv.mail].filter(Boolean).join(" · ");
    return '<div class="hv"><div class="hvtitel">Hausverwaltung</div>'
      + '<div class="hvname">' + esc(hv.name) + "</div>"
      + (teile ? '<div class="hvkontakt">' + esc(teile) + "</div>" : "") + "</div>";
  };
  const kopfHtml = () => {
    let h = '<div class="kopf"><div class="kopftext"><h1>' + esc(druckTitel) + "</h1>"
      + '<p class="meta">Stand: ' + esc(heute) + " · " + rows.length + " Einträge</p></div>";
    if (zeigeLogo) h += '<img class="logo" src="' + logoSrc + '" alt=""/>';
    h += "</div>" + hvBlockHtml();
    return h;
  };
  const drucken = () => {
    if (!vorlage) return;
    const basisCss =
      ".kopf{display:flex;align-items:flex-start;justify-content:space-between;gap:8mm;}"
      + ".logo{max-height:16mm;max-width:55mm;object-fit:contain;}"
      + ".hv{background:#f3f4f6;border:1px solid #d1d5db;border-radius:2mm;padding:3mm 4mm;margin:0 0 5mm;}"
      + ".hvtitel{font-size:8.5px;text-transform:uppercase;letter-spacing:0.08em;color:#666;}"
      + ".hvname{font-size:" + (fontPx + 3) + "px;font-weight:700;}"
      + ".hvkontakt{font-size:" + (fontPx + 1) + "px;margin-top:1mm;}"
      + "table{font-size:" + fontPx + "px;}"
      + "th{padding:" + padPx + "px 6px;}td{padding:" + padPx + "px 6px;}"
      + ".fuss{font-size:" + fontPx + "px;}";
    let body = kopfHtml();
    if (istSchilder) {
      body += '<div class="schilder">' + rows.map(r =>
        '<div class="schild"><div class="sname">' + esc(r.namen || "") + "</div>"
        + '<div class="seinheit">' + esc(r.einheit || "") + "</div></div>").join("") + "</div>";
      druckeHtml(druckTitel, body, quer, basisCss
        + ".schilder{display:grid;grid-template-columns:1fr 1fr;gap:" + (padPx + 3) + "mm;}"
        + ".schild{border:1px dashed #999;border-radius:2mm;min-height:" + (16 + padPx * 2) + "mm;display:flex;"
        + "flex-direction:column;align-items:center;justify-content:center;padding:4mm;}"
        + ".sname{font-size:" + (fontPx + 5) + "px;font-weight:700;text-align:center;}"
        + ".seinheit{font-size:" + (fontPx - 1) + "px;color:#666;margin-top:2mm;}");
      return;
    }
    body += "<table><thead><tr>" + aktiveSpalten.map(s =>
        "<th" + (s.id === "unterschrift" ? ' style="width:30%"' : "") + ">" + esc(s.label) + "</th>").join("")
      + "</tr></thead><tbody>"
      + rows.map(r => "<tr>" + aktiveSpalten.map(s => "<td>" + esc(r[s.id] != null ? r[s.id] : "") + "</td>").join("") + "</tr>").join("")
      + "</tbody></table>";
    if (fussnote) body += '<div class="fuss">' + esc(fussnote) + "</div>";
    druckeHtml(druckTitel, body, quer, basisCss);
  };

  // ── Stile ──
  const pill = (an, label, onClick, key) => (
    <button key={key} onClick={onClick} style={{ padding: "5px 11px", borderRadius: RAD.pill,
      cursor: "pointer", fontFamily: "inherit", fontSize: FS.xs, fontWeight: FW.medium,
      background: an ? accent + "22" : "transparent",
      border: `1px solid ${an ? accent : t.border}`, color: an ? accent : t.sub }}>
      {label}
    </button>
  );
  const selectStyle = { background: t.surface, border: `1px solid ${t.border}`,
    borderRadius: RAD.sm, padding: "8px 10px", fontSize: 16, color: t.text,
    outline: "none", fontFamily: "inherit", maxWidth: "100%" };
  const labelStyle = { fontSize: FS.xs, fontWeight: FW.bold, color: t.sub,
    textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6 };

  // ── Blatt-Vorschau: echtes A4-Blatt (Seitenverhältnis 1:√2), volle Seite
  //    skaliert eingepasst. Läuft der Inhalt über, wachsen weitere A4-Seiten
  //    untereinander; Seitenumbrüche werden als gestrichelte Marker gezeigt. ──
  // A4 bei 96dpi: 210mm=794px, 297mm=1123px.  Quer = gedreht.
  const a4Breite = quer ? 1123 : 794;       // px Roh-Blattbreite
  const a4Hoehe  = quer ? 794 : 1123;       // px Roh-Blatthöhe (eine Seite)
  const a4Pad    = quer ? 36 : 40;          // Innenrand px (≈10mm)
  // Sichtbare Breite der Bühne; Blatt wird per scale eingepasst.
  const buehneBreite = quer ? 940 : 720;
  const a4Scale = buehneBreite / a4Breite;
  const blattVorschau = vorlage && (
    <div style={{ background: "#e9eaec", borderRadius: 8, padding: "18px 0",
      overflowX: "auto", display: "flex", justifyContent: "center" }}>
    <div style={{ width: buehneBreite, transform: "scale(1)" }}>
    <div style={{ width: a4Breite, transformOrigin: "top left",
      transform: "scale(" + a4Scale + ")",
      marginBottom: a4Hoehe * a4Scale - a4Hoehe }}>
    <div style={{ background: "#FFFFFF", color: "#111111",
      boxShadow: "0 3px 18px rgba(0,0,0,0.28)",
      width: a4Breite, minHeight: a4Hoehe, boxSizing: "border-box",
      padding: a4Pad,
      backgroundImage: "repeating-linear-gradient(transparent 0," +
        "transparent " + (a4Hoehe - 1) + "px,#c9ccd1 " + (a4Hoehe - 1) + "px," +
        "#c9ccd1 " + a4Hoehe + "px)",
      backgroundSize: "100% " + a4Hoehe + "px" }}>
      <div style={{ display: "flex", alignItems: "flex-start",
        justifyContent: "space-between", gap: 16 }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 17, fontWeight: 700, lineHeight: 1.3 }}>{druckTitel}</div>
          <div style={{ fontSize: 11, color: "#666", marginTop: 2 }}>
            Stand: {heute} · {rows.length} Einträge
          </div>
        </div>
        {zeigeLogo && (
          <img src={logoSrc} alt="" style={{ maxHeight: 44, maxWidth: 150,
            objectFit: "contain", flexShrink: 0 }}/>
        )}
      </div>
      {zeigeHv && (
        <div style={{ background: "#f3f4f6", border: "1px solid #d1d5db",
          borderRadius: 6, padding: "8px 12px", margin: "12px 0 4px" }}>
          <div style={{ fontSize: 9, textTransform: "uppercase",
            letterSpacing: "0.08em", color: "#666" }}>Hausverwaltung</div>
          <div style={{ fontSize: fontPx + 4, fontWeight: 700 }}>{hv.name}</div>
          {(hv.tel || hv.mail) && (
            <div style={{ fontSize: fontPx + 1, marginTop: 2 }}>
              {[hv.tel, hv.mail].filter(Boolean).join(" · ")}
            </div>
          )}
        </div>
      )}
      {istSchilder ? (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr",
          gap: padPx + 8, marginTop: 14 }}>
          {rows.map((r, i) => (
            <div key={i} style={{ border: "1px dashed #999", borderRadius: 6,
              minHeight: 58 + padPx * 4, display: "flex", flexDirection: "column",
              alignItems: "center", justifyContent: "center", padding: 12 }}>
              <div style={{ fontSize: fontPx + 5, fontWeight: 700, textAlign: "center" }}>{r.namen}</div>
              <div style={{ fontSize: Math.max(8, fontPx - 1), color: "#666", marginTop: 4 }}>{r.einheit}</div>
            </div>
          ))}
        </div>
      ) : (
        <>
          <table style={{ width: "100%", borderCollapse: "collapse",
            fontSize: fontPx + 1, marginTop: 12 }}>
            <thead>
              <tr>
                {aktiveSpalten.map(s => (
                  <th key={s.id} style={{ textAlign: "left",
                    padding: `${padPx}px 6px`, borderBottom: "1.5px solid #333",
                    fontWeight: 700, whiteSpace: "nowrap",
                    width: s.id === "unterschrift" ? "30%" : undefined }}>{s.label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={i}>
                  {aktiveSpalten.map(s => (
                    <td key={s.id} style={{ padding: `${padPx}px 6px`,
                      borderBottom: "1px solid #ddd", verticalAlign: "top" }}>
                      {r[s.id] != null ? r[s.id] : ""}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          {fussnote && (
            <div style={{ marginTop: 10, fontSize: fontPx + 1, fontWeight: 600 }}>{fussnote}</div>
          )}
        </>
      )}
    </div>
    </div>
    </div>
    </div>
  );

  const lgMasterInhalt = (layout) => (
    lgView === "objekte" ? (
      <div style={istListeLG
        ? { display: "flex", flexDirection: "column", gap: 6 }
        : kartenGridStyle(layout)}>
        {(ves || []).map(v => istListeLG ? (
          <VEListenZeile key={v.id} ve={v} t={t} accent={accent}
            aktiv={objektId === v.id} kbItem id={"lg-" + v.id}
            auswahlAccentOverride={accent}
            onClick={() => { setObjektId(objektId === v.id ? null : v.id); setVorlageId(null); setHausId(null); }}/>
        ) : (
          <VEKachel key={v.id} ve={v} t={t} accent={accent}
            aktiv={objektId === v.id} kbItem id={"lg-" + v.id}
            auswahlAccentOverride={accent}
            onClick={() => { setObjektId(objektId === v.id ? null : v.id); setVorlageId(null); setHausId(null); }}/>
        ))}
      </div>
    ) : (
      <div style={{ display: "flex", flexDirection: "column", gap: 6,
        maxWidth: layout.nurMaster ? (layout.kartenMaxBreite || kartenMaxBreite) : "100%",
        width: "100%" }}>
        {lgGruppen.map(g => {
          const key = g.kind + ":" + g.id;
          const aktiv = aktGruppe === key;
          return (
            <button key={key} onClick={() => { setAktGruppe(aktiv ? null : key); setVorlageId(null); }}
              style={{ textAlign: "left", padding: "12px 14px", borderRadius: RAD.ms, cursor: "pointer",
                border: `1px solid ${aktiv ? accent : t.border}`,
                background: aktiv ? accent + "12" : t.card, width: "100%" }}>
              <div style={{ fontSize: FS.m, fontWeight: FW.bold, color: aktiv ? accent : t.text }}>{g.label}</div>
              <div style={{ fontSize: FS.s, color: t.muted, marginTop: 2 }}>{g.sub}</div>
            </button>
          );
        })}
      </div>
    )
  );

  // Detail: nur bei Auswahl (lgHatAuswahl). Mobil bekommt zusätzlich den
  // Zurück-Button. Rahmen-Dekoration nur, wenn etwas ausgewählt ist.
  const lgDetailKern = lgHatAuswahl ? (
    <>
      {/* Vorlagenauswahl (bereichsgefiltert) — solange keine Vorlage gewählt. */}
      {!vorlage && (
        <div>
          <div style={labelStyle}>Welche Liste?</div>
          <select value=""
            onChange={e => { const id = e.target.value; if (id) { setVorlageId(id); setHausId(null); } }}
            style={selectStyle}>
            <option value="">Liste wählen …</option>
            {sichtbareVorlagen.map(v => (
              <option key={v.id} value={v.id}>{v.label}</option>
            ))}
          </select>
        </div>
      )}

      {/* Schritt 2: Konfiguration + Blatt-Vorschau */}
      {vorlage && (
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: 22 }}>{vorlage.icon}</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: FS.l, fontWeight: FW.bold, color: t.text }}>{vorlage.label}</div>
              <div style={{ fontSize: FS.s, color: t.sub }}>
                {vorlage.bereich === "objekt" && ve ? (ve.nr || "Objekt") + (ve.adresse ? " · " + ve.adresse : "") : vorlage.sub}
              </div>
            </div>
          </div>

          {vorlage.bereich === "objekt" && hausWaehlbar && (
            <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
              <div>
                <div style={labelStyle}>Haus</div>
                <select value={hausId == null ? "" : String(hausId)}
                  onChange={e => {
                    const val = e.target.value;
                    if (val === "") { setHausId(null); return; }
                    const h = haeuser.find(x => String(x.id) === val);
                    setHausId(h ? h.id : null);
                  }}
                  style={selectStyle}>
                  <option value="">Alle Häuser</option>
                  {haeuser.map(h => <option key={String(h.id)} value={String(h.id)}>{h.name}</option>)}
                </select>
              </div>
            </div>
          )}

          {vorlage.hatRollenFilter && (
            <div>
              <div style={labelStyle}>Rolle / Gewerk</div>
              <select value={rolleFilter} onChange={e => setRolleFilter(e.target.value)}
                style={selectStyle}>
                <option value="">Alle Rollen</option>
                {alleRollen.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
          )}

          <div>
            <div style={labelStyle}>Spalten</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {vorlage.spalten.map(s => pill(spaltenState[s.id], s.label, () => toggleSpalte(s.id), s.id))}
            </div>
          </div>

          {vorlage.filter.length > 0 && (
            <div>
              <div style={labelStyle}>Filter</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {vorlage.filter.map(fd => pill(filterState[fd.id], fd.label, () => toggleFilter(fd.id), fd.id))}
              </div>
            </div>
          )}

          <div style={{ display: "flex", gap: 18, flexWrap: "wrap" }}>
            <div>
              <div style={labelStyle}>Druckformat</div>
              <div style={{ display: "flex", gap: 6 }}>
                {pill(!quer, "Hochformat", () => setQuer(false), "hoch")}
                {pill(quer, "Querformat", () => setQuer(true), "quer")}
              </div>
            </div>
            <div>
              <div style={labelStyle}>Schriftgröße</div>
              <div style={{ display: "flex", gap: 6 }}>
                {pill(fontGr === "s", "Klein", () => setFontGr("s"), "fs")}
                {pill(fontGr === "m", "Normal", () => setFontGr("m"), "fm")}
                {pill(fontGr === "l", "Groß", () => setFontGr("l"), "fl")}
              </div>
            </div>
            <div>
              <div style={labelStyle}>Zeilenabstand</div>
              <div style={{ display: "flex", gap: 6 }}>
                {pill(abstand === "kompakt", "Kompakt", () => setAbstand("kompakt"), "ak")}
                {pill(abstand === "normal", "Normal", () => setAbstand("normal"), "an")}
                {pill(abstand === "weit", "Weit", () => setAbstand("weit"), "aw")}
              </div>
            </div>
            <div>
              <div style={labelStyle}>Listenkopf</div>
              <div style={{ display: "flex", gap: 6 }}>
                {hv && pill(mitHv, "Hausverwaltung", () => setMitHv(!mitHv), "khv")}
                {logoSrc ? pill(mitLogo, "Logo", () => setMitLogo(!mitLogo), "klogo")
                  : pill(false, "Logo (in Einstellungen → Hausverwaltung hinterlegen)", () => {}, "klogo0")}
              </div>
            </div>
            {vorlage.sonder === "klingelschild" && (
              <div>
                <div style={labelStyle}>Layout</div>
                <div style={{ display: "flex", gap: 6 }}>
                  {pill(schildLayout === "tabelle", "Tabelle", () => setSchildLayout("tabelle"), "tab")}
                  {pill(schildLayout === "schilder", "Schilder zum Ausschneiden", () => setSchildLayout("schilder"), "sch")}
                </div>
              </div>
            )}
          </div>

          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
              <div style={labelStyle}>Vorschau</div>
            </div>
            {rows.length === 0 ? (
              <div style={{ padding: "14px 16px", fontSize: FS.s, color: t.muted,
                fontStyle: "italic", background: t.surface, border: `1px solid ${t.border}`,
                borderRadius: RAD.md }}>
                Keine Einträge — Auswahl oder Filter prüfen.
              </div>
            ) : blattVorschau}
          </div>

          <div>
            <button onClick={drucken} disabled={rows.length === 0}
              style={{ display: "inline-flex", alignItems: "center", gap: 8,
                background: rows.length === 0 ? t.border : accent,
                color: rows.length === 0 ? t.muted : getContrastColor(accent),
                border: "none", borderRadius: RAD.ms, padding: "11px 20px",
                cursor: rows.length === 0 ? "default" : "pointer",
                fontFamily: "inherit", fontSize: FS.m, fontWeight: FW.bold }}>
              <I name="document" size={14} color={rows.length === 0 ? t.muted : getContrastColor(accent)}/>
              Drucken / Als PDF sichern
            </button>
            <div style={{ fontSize: FS.xs, color: t.muted, marginTop: 6 }}>
              Im Druckdialog „Als PDF sichern" wählen, um eine PDF-Datei zu erhalten.
            </div>
          </div>
        </div>
      )}
    </>
  ) : null;
  // Detail-Hülle: bei Auswahl mit Akzent-Rahmen (DetailRahmen), sonst null.
  // Kopf: bei Objekt-Auswahl der kanonische ObjektDetailKopf (§76 — VE-Nr +
  // Anschrift wie überall), bei Gruppen-Auswahl der Gruppen-Titel via DetailKopf.
  const lgGruppeAkt = (lgView === "gruppen" && aktGruppe)
    ? lgGruppen.find(g => g.kind + ":" + g.id === aktGruppe) || null : null;
  const lgKopf = (lgView === "objekte" && ve)
    ? <ObjektDetailKopf t={t} accent={accent} ve={ve}/>
    : (lgGruppeAkt ? <DetailKopf t={t} accent={accent} titel={lgGruppeAkt.label} sub={lgGruppeAkt.sub || null}/> : null);
  const lgDetailInhalt = lgHatAuswahl ? (
    <DetailRahmen t={t} accent={accent}>
      {lgKopf}
      {lgDetailKern}
    </DetailRahmen>
  ) : null;

  return (
    <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column" }}>
      <ScreenKopf t={t} accent={accent} titel="Listengenerator"
        mitte={
          <KopfPille t={t} accent={accent}
            optionen={[{ id: "objekte", label: "Objekte" }, { id: "gruppen", label: "Gruppen" }]}
            aktiv={lgView} onWaehle={(id) => { setLgView(id); setVorlageId(null); }}/>
        }
        rechts={lgHatAuswahl ? (
          <HeaderZurueck onClick={() => {
            if (vorlage) { setVorlageId(null); }
            else { setObjektId(null); setAktGruppe(null); setVorlageId(null); }
          }} t={t}/>
        ) : null}/>

      {lgView === "objekte" && legendeEl ? (
        <div style={{ flexShrink: 0, padding: "0 2px" }}>{legendeEl}</div>
      ) : null}
      <MasterDetailRahmen
        master={lgMasterInhalt}
        detail={lgDetailInhalt}
        mobilDetail={lgDetailInhalt}
        istDesktop={istDesktopLG}
        listenAnsicht={listenAnsicht} listeOpt={listeOpt}
        kartenSpalten={kartenSpalten} kartenMaxBreite={kartenMaxBreite}
        kartenMin={kartenMin} detailMinBreite={detailMinBreite} detailMin={detailMin}
        t={t} onNurDetail={setLgNurDetail}/>
    </div>
  );
}

// StatistikScreen: Rahmen wie Kalender — Pille „Objekte / Gruppen" oben, darunter
// Master-Detail. Objekte-Pille = einzelne Objekte (Karte/Liste → Statistik dieses
// Objekts). Gruppen-Pille = Alle Objekte / Verwaltungsarten / eigene Gruppen →
// Statistik über die Objekte der Auswahl. Detail an gleicher x-Position (feste
// Master-Breite = Spalten × Karten-Maxbreite). (Benny v12.34)
function StatistikScreen({ ves, kontakte, t, accent, settings = null, listenAnsicht = "karten",
  kartenSpalten = 2, kartenMaxBreite = 340, kartenMin = 272, detailMinBreite = 540, detailMin = null, listeOpt = null, festeGridSpec = null, legendeEl = null }) {
  const istDesktop = useWindowWidth() >= DESKTOP_MIN_WIDTH;
  const [statView, setStatView] = useState("objekte"); // "objekte" | "gruppen"
  const [aktVEId, setAktVEId] = useState(null);
  const [aktGruppe, setAktGruppe] = useState(null); // {kind,id} | null
  const [statNurDetail, setStatNurDetail] = useState(false);
  const istListe = listenAnsicht === "liste";

  // Gruppen-Auswahlliste: Alle Objekte → Verwaltungsarten → eigene Gruppen.
  const gruppenOptionen = [];
  gruppenOptionen.push({ kind: "alle", id: "alle", label: "Alle Objekte",
    sub: ves.length + (ves.length === 1 ? " Objekt" : " Objekte"), filter: () => true });
  VERWALTUNGSARTEN.forEach(a => {
    const n = ves.filter(v => (v.verwaltungsart || "weg") === a.id).length;
    if (n > 0) gruppenOptionen.push({ kind: "art", id: a.id, label: a.label,
      sub: n + (n === 1 ? " Objekt" : " Objekte"), filter: v => (v.verwaltungsart || "weg") === a.id });
  });
  ((settings && settings.objektGruppen) || []).forEach(g => {
    if (!g) return;
    const n = ves.filter(v => objektInGruppe(v, g)).length;
    gruppenOptionen.push({ kind: "gruppe", id: g.id, label: g.name || g.kurz || "Gruppe",
      sub: n + (n === 1 ? " Objekt" : " Objekte"), filter: v => objektInGruppe(v, g) });
  });

  // Aktuelle Auswahl → ves-Teilmenge für StatistikInhalt.
  let auswahlVes = ves;
  let auswahlTitel = "";
  let auswahlVe = null;   // gewähltes Objekt (für ObjektDetailKopf §76)
  if (statView === "objekte") {
    const vo = ves.find(v => v.id === aktVEId) || null;
    auswahlVes = vo ? [vo] : [];
    auswahlTitel = vo ? (vo.nr || "Objekt") : "";
    auswahlVe = vo;
  } else {
    const g = gruppenOptionen.find(x => x.kind + ":" + x.id === aktGruppe) || null;
    auswahlVes = g ? ves.filter(g.filter) : [];
    auswahlTitel = g ? g.label : "";
  }
  const hatAuswahl = (statView === "objekte" && aktVEId) || (statView === "gruppen" && aktGruppe);

  // Master-Spalte: Objektauswahl (Karte/Liste) oder Gruppenauswahl (Liste).
  const masterInhalt = (layout) => {
    const masterGridStyle = istListe
      ? { display: "flex", flexDirection: "column", gap: 6 }
      : kartenGridStyle(layout);
    return statView === "objekte" ? (
    <div style={masterGridStyle}>
      {ves.map(ve => istListe ? (
        <VEListenZeile key={ve.id} ve={ve} t={t} accent={accent}
          aktiv={aktVEId === ve.id} kbItem id={"stat-" + ve.id}
          auswahlAccentOverride={accent}
          onClick={() => setAktVEId(aktVEId === ve.id ? null : ve.id)}/>
      ) : (
        <VEKachel key={ve.id} ve={ve} t={t} accent={accent}
          aktiv={aktVEId === ve.id} kbItem id={"stat-" + ve.id}
          auswahlAccentOverride={accent}
          onClick={() => setAktVEId(aktVEId === ve.id ? null : ve.id)}/>
      ))}
    </div>
  ) : (
    <div style={{ display: "flex", flexDirection: "column", gap: 6,
      maxWidth: layout.nurMaster ? (layout.kartenMaxBreite || kartenMaxBreite) : "100%",
      width: "100%" }}>
      {gruppenOptionen.map(g => {
        const key = g.kind + ":" + g.id;
        const aktiv = aktGruppe === key;
        return (
          <button key={key} onClick={() => setAktGruppe(aktiv ? null : key)}
            style={{ textAlign: "left", padding: "12px 14px", borderRadius: RAD.ms, cursor: "pointer",
              border: `1px solid ${aktiv ? accent : t.border}`,
              background: aktiv ? accent + "12" : t.card, width: "100%" }}>
            <div style={{ fontSize: FS.m, fontWeight: FW.bold, color: aktiv ? accent : t.text }}>{g.label}</div>
            <div style={{ fontSize: FS.s, color: t.muted, marginTop: 2 }}>{g.sub}</div>
          </button>
        );
      })}
    </div>
    );
  };

  const detailInhalt = hatAuswahl && auswahlVes.length > 0 ? (
    <DetailRahmen t={t} accent={accent}>
      {auswahlVe
        ? <ObjektDetailKopf t={t} accent={accent} ve={auswahlVe}/>
        : <DetailKopf t={t} accent={accent} titel={auswahlTitel}/>}
      <StatistikInhalt ves={auswahlVes} kontakte={kontakte} t={t} accent={accent}/>
    </DetailRahmen>
  ) : null;

  const header = (
    <ScreenKopf t={t} accent={accent} titel="Statistik"
      mitte={
        <KopfPille t={t} accent={accent}
          optionen={[{ id: "objekte", label: "Objekte" }, { id: "gruppen", label: "Gruppen" }]}
          aktiv={statView} onWaehle={setStatView}/>
      }
      rechts={(hatAuswahl && statNurDetail) ? (
        <HeaderZurueck onClick={() => { setAktVEId(null); setAktGruppe(null); }} t={t}/>
      ) : null}/>
  );

  // MOBIL: Auswahl ODER Detail (mit Zurück).
  if (!istDesktop) {
    return (
      <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column" }}>
        {header}
        {hatAuswahl ? (
          <div data-ad-scroll="y" style={{ flex: 1, minHeight: 0, overflowY: "auto", padding: "8px 2px" }}>
            <div style={{ marginBottom: 12 }}>
              <HeaderZurueck onClick={() => { setAktVEId(null); setAktGruppe(null); }} t={t}/>
            </div>
            {detailInhalt}
          </div>
        ) : (
          <div data-ad-scroll="y" style={{ flex: 1, minHeight: 0, overflowY: "auto", padding: "8px 2px" }}>
            {statView === "objekte" ? legendeEl : null}
            {masterInhalt({ cols: 1, kartenBreite: kartenMaxBreite })}
          </div>
        )}
      </div>
    );
  }

  // DESKTOP: Master-Detail über den kanonischen Baustein (§75).
  return (
    <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column" }}>
      {header}
      {statView === "objekte" && legendeEl ? (
        <div style={{ flexShrink: 0, padding: "0 2px" }}>{legendeEl}</div>
      ) : null}
      <MasterDetailRahmen
        master={masterInhalt}
        detail={detailInhalt}
        istDesktop={true}
        listenAnsicht={listenAnsicht} listeOpt={listeOpt}
        kartenSpalten={kartenSpalten} kartenMaxBreite={kartenMaxBreite}
        kartenMin={kartenMin} detailMinBreite={detailMinBreite} detailMin={detailMin}
        t={t} onNurDetail={setStatNurDetail}/>
    </div>
  );
}

// StatistikInhalt: rechnet + rendert die komplette Auswertung für die ÜBERGEBENE
// ves-Auswahl (ein Objekt, eine Gruppe oder alle). Die Berechnung war früher fix
// auf das ganze Portfolio — jetzt einfach auf das, was reinkommt. (Benny v12.34)
function StatistikInhalt({ ves, kontakte, t, accent }) {
  const fmt = (n) => Number(n || 0).toLocaleString("de-DE");
  // ── Einheiten + Flächen ─
  let wohnAnzahl = 0, spAnzahl = 0, flaecheGesamt = 0;
  const belegung = { vermietung: 0, selbstnutzung: 0, leerstand: 0 };
  ves.forEach(ve => {
    alleEinheitenVonVe(ve).forEach(e => {
      if (!e) return;
      if (isStellplatzTyp(e.typ)) { spAnzahl += 1; return; }
      if (STAT_WOHN_TYPEN.indexOf(e.typ) < 0 && e.typ) return;
      wohnAnzahl += 1;
      // Fläche: Summe der Teil-Flächen, Fallback Einheiten-Fläche.
      let f = 0;
      (teileVon(e) || []).forEach(teil => { f += Number(teil && teil.flaeche) || 0; });
      if (f === 0) f = Number(e.flaeche) || 0;
      flaecheGesamt += f;
      const bt = belegungsTyp(e) || "leerstand";
      if (belegung[bt] === undefined) belegung.leerstand += 1; else belegung[bt] += 1;
    });
  });
  const leerQuote = wohnAnzahl > 0 ? Math.round((belegung.leerstand / wohnAnzahl) * 100) : 0;
  // ── Kontakte + Rollen ─
  const personen = kontakte.filter(k => k && k.typ !== "firma").length;
  const firmen = kontakte.length - personen;
  const rollenCounts = {};
  kontakte.forEach(k => (k && k.objektZuweisungen || []).forEach(z => {
    if (!z || (z.status || "aktiv") !== "aktiv" || !z.rolle) return;
    rollenCounts[z.rolle] = (rollenCounts[z.rolle] || 0) + 1;
  }));
  const topRollen = Object.entries(rollenCounts).sort((a, b) => b[1] - a[1]).slice(0, 6);
  // ── Verteilungen ─
  const artCounts = {};
  VERWALTUNGSARTEN.forEach(a => { artCounts[a.id] = 0; });
  ves.forEach(v => { const a = v.verwaltungsart || "weg"; if (artCounts[a] !== undefined) artCounts[a] += 1; });
  const ortCounts = {};
  ves.forEach(v => { const o = objektOrt(v) || "Ohne Ort"; ortCounts[o] = (ortCounts[o] || 0) + 1; });
  const topOrte = Object.entries(ortCounts).sort((a, b) => b[1] - a[1]).slice(0, 8);
  // ── Fristen + Termine ─
  const heute = new Date(); heute.setHours(0, 0, 0, 0);
  const tageBis = (wert) => {
    const d = parseDatumWert(wert);
    return d ? Math.round((d.getTime() - heute.getTime()) / 86400000) : null;
  };
  let bestAbgelaufen = 0, bestEndetBald = 0;
  ves.forEach(v => {
    const bb = veKartenFeldWert(v, "verwaltung_stamm", "Bestellt bis")
      || (v.verwaltung && v.verwaltung.bestelltBis);
    const tg = tageBis(bb);
    if (tg === null) return;
    if (tg < 0) bestAbgelaufen += 1;
    else if (tg < 90) bestEndetBald += 1;
  });
  const termine30 = sammleTermine(ves, kontakte, 12).filter(x => x.diff >= 0 && x.diff <= 30);
  const termineJeTyp = {};
  termine30.forEach(x => { termineJeTyp[x.typ] = (termineJeTyp[x.typ] || 0) + 1; });
  // ── Technik & Ausstattung: zeigt NUR, was an Daten gepflegt ist ─
  // Heizsysteme: Technik-Geräte (typId "heizung", Feld "System"); hat ein
  // Objekt keine Heizungs-Geräte mit System, zählt das Stammfeld "Heizart".
  // Glasfaser: Gebäude-Feld "Glasfaser – Stand". Messdienste: Verträge der
  // Messdienst-Karte (firmaId → Kontaktname). Je Objekt einfach gezählt.
  const heizCounts = {}, glasCounts = {}, messCounts = {};
  ves.forEach(ve => {
    const systeme = [];
    let heizart = "";
    let glasWert = "";
    (ve.karten || []).forEach(k => {
      if (!k) return;
      if (k.kategorie === "technik") {
        (k.technikGeraete || []).forEach(g => {
          if (!g || g.typId !== "heizung") return;
          const f = (g.felder || []).find(x => x && x.name === "System");
          if (f && f.value && systeme.indexOf(f.value) < 0) systeme.push(f.value);
        });
      }
      if (k.kategorie === "gebaeude" || k.kategorie === "haus" || k.kategorie === "tiefgarage") {
        (k.stamm || []).forEach(f => {
          if (f && f.name === "Heizart" && f.value && !heizart) heizart = f.value;
        });
        (k.felder || []).forEach(f => {
          if (f && f.name === "Glasfaser – Stand" && f.value && !glasWert) glasWert = f.value;
        });
      }
    });
    if (systeme.length === 0 && heizart) systeme.push(heizart);
    systeme.forEach(s => { heizCounts[s] = (heizCounts[s] || 0) + 1; });
    if (glasWert) glasCounts[glasWert] = (glasCounts[glasWert] || 0) + 1;
    const mdFirmen = [];
    (ve.verwaltungsKarten || []).forEach(k => {
      if (!k || k.kategorie !== "messdienst") return;
      (k.vertraege || []).forEach(v => {
        if (!v) return;
        const firma = v.firmaId != null
          ? ((kontakte.find(x => x && x.id === v.firmaId) || {}).name || "")
          : (v.firma || "");
        if (firma && mdFirmen.indexOf(firma) < 0) mdFirmen.push(firma);
      });
    });
    mdFirmen.forEach(f => { messCounts[f] = (messCounts[f] || 0) + 1; });
  });
  const heizListe = Object.entries(heizCounts).sort((a, b) => b[1] - a[1]);
  const glasListe = Object.entries(glasCounts).sort((a, b) => b[1] - a[1]);
  const messListe = Object.entries(messCounts).sort((a, b) => b[1] - a[1]);
  const technikLeer = heizListe.length === 0 && glasListe.length === 0 && messListe.length === 0;
  const maxHeiz = Math.max(1, ...heizListe.map(x => x[1]), 1);
  const maxGlas = Math.max(1, ...glasListe.map(x => x[1]), 1);
  const maxMess = Math.max(1, ...messListe.map(x => x[1]), 1);
  const BELEG_FARBEN = { vermietung: "#22C55E", selbstnutzung: "#0080FF", leerstand: "#F59E0B" };
  const BELEG_LABEL = { vermietung: "Vermietet", selbstnutzung: "Eigennutzung", leerstand: "Leerstand" };
  const maxArt = Math.max(1, ...Object.values(artCounts));
  const maxOrt = Math.max(1, ...topOrte.map(x => x[1]));
  const maxRolle = Math.max(1, ...topRollen.map(x => x[1]), 1);
  return (
    <div data-ad-scroll="y" style={{ flex: 1, minHeight: 0, overflowY: "auto",
      paddingBottom: "max(env(safe-area-inset-bottom, 0px), 80px)" }}>
        {/* KPI-Kacheln */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))",
          gap: 10, marginBottom: 12 }}>
          <StatKpi wert={fmt(ves.length)} label="Objekte"
            sub={Object.entries(artCounts).filter(x => x[1] > 0)
              .map(x => x[1] + " " + ((VERWALTUNGSARTEN.find(a => a.id === x[0]) || {}).label || x[0])).join(" · ")}
            farbe={accent} t={t}/>
          <StatKpi wert={fmt(wohnAnzahl + spAnzahl)} label="Einheiten"
            sub={fmt(wohnAnzahl) + " WE · " + fmt(spAnzahl) + " SP"} farbe={accent} t={t}/>
          <StatKpi wert={fmt(Math.round(flaecheGesamt)) + " m²"} label="Wohn-/Nutzfläche"
            sub={wohnAnzahl > 0 ? "⌀ " + fmt(Math.round(flaecheGesamt / wohnAnzahl)) + " m² je Einheit" : ""}
            farbe={accent} t={t}/>
          <StatKpi wert={fmt(kontakte.length)} label="Kontakte"
            sub={fmt(personen) + " Personen · " + fmt(firmen) + " Firmen"} farbe={accent} t={t}/>
          <StatKpi wert={leerQuote + " %"} label="Leerstandsquote"
            sub={fmt(belegung.leerstand) + " von " + fmt(wohnAnzahl) + " Einheiten"}
            farbe={leerQuote > 10 ? "#F59E0B" : "#22C55E"} t={t}/>
          <StatKpi wert={fmt(termine30.length)} label="Termine (30 Tage)"
            sub={Object.entries(termineJeTyp).map(x =>
              x[1] + " " + ((KALENDER_TYPEN.find(ty => ty.id === x[0]) || {}).kurz || x[0])).join(" · ")}
            farbe={accent} t={t}/>
        </div>
        {/* Belegung: gestapelter Balken + Legende */}
        <StatPanel titel="Belegung der Wohneinheiten" t={t}>
          <div style={{ display: "flex", height: 14, borderRadius: RAD.pill, overflow: "hidden",
            background: t.border, marginBottom: 9 }}>
            {["vermietung", "selbstnutzung", "leerstand"].map(typ => (
              belegung[typ] > 0 && wohnAnzahl > 0
                ? <div key={typ} style={{ width: (belegung[typ] / wohnAnzahl * 100) + "%",
                    background: BELEG_FARBEN[typ] }}/>
                : null
            ))}
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 14 }}>
            {["vermietung", "selbstnutzung", "leerstand"].map(typ => (
              <span key={typ} style={{ display: "flex", alignItems: "center", gap: 6,
                fontSize: FS.s, color: t.sub }}>
                <span style={{ width: 9, height: 9, borderRadius: "50%", background: BELEG_FARBEN[typ] }}/>
                {BELEG_LABEL[typ]}: <strong style={{ color: t.text }}>{fmt(belegung[typ])}</strong>
              </span>
            ))}
          </div>
        </StatPanel>
        {/* Verteilungen */}
        <StatPanel titel="Objekte nach Verwaltungsart" t={t}>
          {VERWALTUNGSARTEN.filter(a => artCounts[a.id] > 0).map(a => (
            <StatBalkenZeile key={a.id} label={a.label} wert={artCounts[a.id]}
              max={maxArt} farbe={accent} t={t}/>
          ))}
        </StatPanel>
        <StatPanel titel="Objekte nach Ort" t={t}>
          {topOrte.map(([ort, n]) => (
            <StatBalkenZeile key={ort} label={ort} wert={n} max={maxOrt} farbe={accent} t={t}/>
          ))}
        </StatPanel>
        {topRollen.length > 0 && (
          <StatPanel titel="Aktive Rollen im Bestand" t={t}>
            {topRollen.map(([rolle, n]) => (
              <StatBalkenZeile key={rolle} label={rolle} wert={n} max={maxRolle} farbe={accent} t={t}/>
            ))}
          </StatPanel>
        )}
        {/* Technik & Ausstattung — wächst mit den gepflegten Daten */}
        {heizListe.length > 0 && (
          <StatPanel titel="Heizsysteme (Objekte)" t={t}>
            {heizListe.map(([sys, n]) => (
              <StatBalkenZeile key={sys} label={sys} wert={n} max={maxHeiz} farbe="#EF6C30" t={t}/>
            ))}
          </StatPanel>
        )}
        {glasListe.length > 0 && (
          <StatPanel titel="Glasfaser-Ausbau (Objekte)" t={t}>
            {glasListe.map(([st, n]) => (
              <StatBalkenZeile key={st} label={st} wert={n} max={maxGlas} farbe="#0EA5E9" t={t}/>
            ))}
          </StatPanel>
        )}
        {messListe.length > 0 && (
          <StatPanel titel="Messdienste (Objekte)" t={t}>
            {messListe.map(([firma, n]) => (
              <StatBalkenZeile key={firma} label={firma} wert={n} max={maxMess} farbe="#8B5CF6" t={t}/>
            ))}
          </StatPanel>
        )}
        {technikLeer && (
          <StatPanel titel="Technik & Ausstattung" t={t}>
            <div style={{ fontSize: FS.s, color: t.muted }}>
              Noch keine auswertbaren Technik-Daten. Sobald gepflegt, erscheinen hier automatisch:
              Heizsysteme (Technik-Geräte bzw. Stammfeld „Heizart"), Glasfaser-Ausbau
              (Gebäude-Feld „Glasfaser – Stand") und Messdienst-Verbreitung (Messdienst-Verträge).
            </div>
          </StatPanel>
        )}
        {/* Fristen */}
        <StatPanel titel="Fristen" t={t}>
          <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: FS.s }}>
              <span style={{ width: 9, height: 9, borderRadius: "50%", background: "#EF4444" }}/>
              <span style={{ flex: 1, color: t.text }}>Verwalterbestellung abgelaufen</span>
              <strong style={{ color: bestAbgelaufen > 0 ? "#EF4444" : t.text }}>{fmt(bestAbgelaufen)}</strong>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: FS.s }}>
              <span style={{ width: 9, height: 9, borderRadius: "50%", background: "#F59E0B" }}/>
              <span style={{ flex: 1, color: t.text }}>Bestellung endet in unter 90 Tagen</span>
              <strong style={{ color: bestEndetBald > 0 ? "#F59E0B" : t.text }}>{fmt(bestEndetBald)}</strong>
            </div>
          </div>
        </StatPanel>
    </div>
  );
}


export { druckeHtml, SchnelleingabeScreen, ListenGeneratorScreen, StatistikScreen };

