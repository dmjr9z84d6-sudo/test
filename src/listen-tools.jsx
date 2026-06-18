import React, { useState } from "react";
import { FS, FW, RAD, getContrastColor } from "./constants.js";
import { joinPlzOrt, parseDatumWert } from "./utils-basis.js";
import {
  VERWALTUNGSARTEN, aktiveBelegung, aktiverTeil, belegungsTyp, bewohnerRecht,
  eigStatus, extractNachname, flaecheVon, isStellplatzTyp, objektOrt,
  parseFlaeche, teileVon
} from "./datenmodell.js";
import {
  DESKTOP_MIN_WIDTH, I, StickySectionHeader, useWindowWidth, veKartenFeldWert
} from "./utils-icons.jsx";
import {
  VerteilerSchluesselBlock, buildInitialKarten,
  buildInitialVerwaltungsKarten, ergaenzeTechnikGeraetFelder, gemeinschaftName,
  gemeinschaftVertreter, gemeinschaftZustellAdresse, istEigentuemergemeinschaft,
  quoteAnteil, quoteLabel
} from "./liegenschaft.jsx";
import { KALENDER_TYPEN, sammleTermine } from "./kalender.jsx";
import { STAT_WOHN_TYPEN, StatBalkenZeile, StatKpi, StatPanel, alleEinheitenVonVe } from "./objektansicht.jsx";

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
      { id: "auchBewohnerRollen", label: "Auch Eigentümer/Mieter/Bewohner", default: false },
    ],
    zeilen: (ctx) => {
      const WOHN_ROLLEN = ["Eigentümer", "Mieter", "Bewohner", "Nießbraucher", "Wohnberechtigter"];
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

function SchnelleingabeScreen({ ves, setVes, t, accent }) {
  const istDesktop = useWindowWidth() >= DESKTOP_MIN_WIDTH;
  const [objektId, setObjektId] = useState(ves && ves[0] ? ves[0].id : null);
  const [schema, setSchema] = useState("fortlaufend"); // fortlaufend | etagen | stellplatz
  const [praefix, setPraefix] = useState("WE");
  const [start, setStart] = useState("1");
  const [anzahl, setAnzahl] = useState("4");
  const [breite, setBreite] = useState("2");
  const [etagen, setEtagen] = useState(SE_ETAGEN_VORLAGE.slice(0, 3));
  const [seiten, setSeiten] = useState(SE_SEITEN_VORLAGE.slice());
  const [rows, setRows] = useState([]);
  const [erfolg, setErfolg] = useState(0); // Anzahl zuletzt angelegter Einheiten

  // ── Ziel im Neu-Modus: neues Objekt (Standard) oder bestehendes ──
  const [zielArt, setZielArt] = useState("neuesObjekt"); // "neuesObjekt" | "bestehend"
  const [neuNr, setNeuNr] = useState("");
  const [neuStrasse, setNeuStrasse] = useState("");
  const [neuPlz, setNeuPlz] = useState("");
  const [neuOrt, setNeuOrt] = useState("");
  const [neuVerwArt, setNeuVerwArt] = useState("weg");

  // ── Modus & Bearbeiten-State ──
  const [modus, setModus] = useState("neu"); // "neu" | "bearbeiten"
  const [ebene, setEbene] = useState("einheiten"); // "einheiten" | "objekte"
  const [filterObjektId, setFilterObjektId] = useState(""); // "" = alle Objekte
  const [filterTyp, setFilterTyp] = useState(""); // "" = alle Typen
  const [auswahl, setAuswahl] = useState({}); // { "<veId>::<einheitId>": true } bzw { "<veId>": true }
  const [bulkFeld, setBulkFeld] = useState("typ");
  const [bulkAktion, setBulkAktion] = useState("setzen"); // setzen | leeren | wennLeer
  const [bulkWert, setBulkWert] = useState("");
  const [vorschauAuf, setVorschauAuf] = useState(false);
  const [undoSnap, setUndoSnap] = useState(null); // { betroffen:[{veId,einheitId?,vorher}], anzahl }
  const [bulkErfolg, setBulkErfolg] = useState(0);

  const ve = (ves || []).find(v => v && v.id === objektId) || (ves && ves[0]) || null;
  const bestand = (ve && Array.isArray(ve.einheiten)) ? ve.einheiten.length : 0;

  const toggleEtage = (et) => {
    setEtagen(prev => prev.indexOf(et) >= 0 ? prev.filter(x => x !== et) : [...prev, et]);
  };
  const toggleSeite = (se) => {
    setSeiten(prev => prev.indexOf(se) >= 0 ? prev.filter(x => x !== se) : [...prev, se]);
  };

  const generieren = () => {
    const params = { praefix: praefix, start: start, anzahl: anzahl, breite: breite,
      etagen: etagen, seiten: seiten };
    setRows(seBaueZeilen(schema, params));
    setErfolg(0);
  };

  const setRowFeld = (idx, feld, wert) => {
    setRows(prev => prev.map((r, i) => i === idx ? { ...r, [feld]: wert } : r));
  };
  const removeRow = (idx) => setRows(prev => prev.filter((_, i) => i !== idx));
  const addRow = () => setRows(prev => [...prev, { nr: "", typ: "Wohneigentum",
    lage: "", flaeche: "", zimmer: "", mea: "" }]);

  const gueltigeRows = rows.filter(r => r.nr && r.nr.trim());
  const neuesObjektValid = neuNr.trim().length > 0 && neuStrasse.trim().length > 0;
  const kannAnlegen = zielArt === "neuesObjekt"
    ? neuesObjektValid && gueltigeRows.length > 0
    : !!ve && gueltigeRows.length > 0;

  const anlegen = () => {
    if (!setVes || !kannAnlegen) return;
    const ts = Date.now();
    const neueEinheiten = gueltigeRows.map((r, i) => {
      const fl = (r.flaeche || "").trim();
      const flaeche = fl ? (fl.endsWith("²") ? fl : `${fl} m²`) : "";
      const ein = {
        id: `e-${ts}-${i}`,
        nr: r.nr.trim(),
        verwNr: "",
        typ: r.typ || "Wohneigentum",
        flaeche: flaeche,
        mea: (r.mea || "").trim(),
        lage: (r.lage || "").trim(),
        zimmer: (r.zimmer || "").trim(),
        eigentuemer: [], mieter: [],
      };
      if (isStellplatzTyp(ein.typ)) { ein.spStellung = "eigenstaendig"; ein.spEinheitId = null; }
      return ein;
    });
    if (zielArt === "neuesObjekt") {
      // Neues Objekt mit Einheiten in einem Rutsch — Schema identisch zum
      // regulären Objekt-Anlegen-Dialog (ObjektAnlegen, ve-<ts>).
      const plzOrt = joinPlzOrt(neuPlz, neuOrt);
      const adresse = plzOrt ? `${neuStrasse.trim()}, ${plzOrt}` : neuStrasse.trim();
      const neuesVe = {
        id: "ve-" + ts,
        nr: neuNr.trim(),
        adresse: adresse,
        verwaltungsart: neuVerwArt,
        einheiten: neueEinheiten,
        verwaltung: {
          beginn: "", bestelltBis: "",
          verwalter: null, buchhalter: null, uebernommenVon: null,
          verwZustimmung: false,
          naechsteETV: "", naechsteWahl: "",
        },
        vertraege: [],
        etvHistorie: [],
      };
      setVes(prev => [...prev, neuesVe]);
      setErfolg(neueEinheiten.length);
      setRows([]);
      return;
    }
    setVes(prev => prev.map(v => v.id === ve.id
      ? { ...v, einheiten: [...(Array.isArray(v.einheiten) ? v.einheiten : []), ...neueEinheiten] }
      : v));
    setErfolg(neueEinheiten.length);
    setRows([]);
  };

  // ── BEARBEITEN: gefilterte Kandidatenliste ──
  // Einheiten objektübergreifend: [{ veId, veName, einheit }]
  const einheitenKandidaten = [];
  (ves || []).forEach(v => {
    if (filterObjektId && v.id !== filterObjektId) return;
    (Array.isArray(v.einheiten) ? v.einheiten : []).forEach(e => {
      if (filterTyp && e.typ !== filterTyp) return;
      einheitenKandidaten.push({ veId: v.id, veName: v.name || v.nr || v.id, einheit: e });
    });
  });
  // Objekte: [{ ve }]
  const objektKandidaten = (ves || []).filter(v => !filterObjektId || v.id === filterObjektId);

  const auswahlKey = (veId, einheitId) => einheitId ? `${veId}::${einheitId}` : `${veId}`;
  const toggleAuswahl = (key) => setAuswahl(prev => {
    const next = { ...prev };
    if (next[key]) delete next[key]; else next[key] = true;
    return next;
  });
  const alleKeys = ebene === "einheiten"
    ? einheitenKandidaten.map(k => auswahlKey(k.veId, k.einheit.id))
    : objektKandidaten.map(v => auswahlKey(v.id, null));
  const anzahlGewaehlt = alleKeys.filter(k => auswahl[k]).length;
  const alleGewaehlt = alleKeys.length > 0 && anzahlGewaehlt === alleKeys.length;
  const setzeAlle = (an) => {
    const next = {};
    if (an) alleKeys.forEach(k => { next[k] = true; });
    setAuswahl(next);
  };

  // Feld-Definitionen je Ebene
  const EINHEIT_FELDER = [
    { id: "typ", label: "Typ", typ: "select", optionen: SE_TYP_OPTIONEN },
    { id: "lage", label: "Lage", typ: "text" },
    { id: "flaeche", label: "Fläche", typ: "flaeche" },
    { id: "zimmer", label: "Zimmer", typ: "text" },
    { id: "mea", label: "MEA", typ: "text" },
  ];
  const OBJEKT_FELDER = [
    { id: "verwaltungsart", label: "Verwaltungsart", typ: "select",
      optionen: VERWALTUNGSARTEN.map(a => a.id), optionLabel: (id) => {
        const a = VERWALTUNGSARTEN.find(x => x.id === id); return a ? a.label : id; } },
  ];
  const aktuelleFelder = ebene === "einheiten" ? EINHEIT_FELDER : OBJEKT_FELDER;
  const feldDef = aktuelleFelder.find(f => f.id === bulkFeld) || aktuelleFelder[0];

  // Wert-Normalisierung (Fläche bekommt m²-Suffix wie sonst)
  const normWert = (feld, roh) => {
    const w = (roh || "").trim();
    if (!w) return "";
    if (feld === "flaeche") return w.endsWith("²") ? w : `${w} m²`;
    return w;
  };

  // Anzeigewert für Vorschau (Verwaltungsart als Label)
  const zeigeWert = (feld, roh) => {
    if (feld === "verwaltungsart") {
      const a = VERWALTUNGSARTEN.find(x => x.id === roh); return a ? a.label : (roh || "—");
    }
    return (roh && String(roh).trim()) ? roh : "—";
  };

  // Liefert das aktuelle Feld-Rohwert eines Datensatzes
  const leseFeld = (obj, feld) => (obj && obj[feld] != null) ? obj[feld] : "";

  // Berechnet die konkreten Änderungen (Vorschau-Daten)
  const berechneAenderungen = () => {
    const neuRoh = bulkAktion === "leeren" ? "" : normWert(feldDef.id, bulkWert);
    const liste = [];
    if (ebene === "einheiten") {
      einheitenKandidaten.forEach(k => {
        if (!auswahl[auswahlKey(k.veId, k.einheit.id)]) return;
        const alt = leseFeld(k.einheit, feldDef.id);
        if (bulkAktion === "wennLeer" && String(alt).trim()) return; // nur leere füllen
        if (String(alt) === String(neuRoh)) return; // keine echte Änderung
        liste.push({ veId: k.veId, einheitId: k.einheit.id,
          label: `${k.veName} · ${k.einheit.nr || k.einheit.id}`, alt: alt, neu: neuRoh });
      });
    } else {
      objektKandidaten.forEach(v => {
        if (!auswahl[auswahlKey(v.id, null)]) return;
        const alt = leseFeld(v, feldDef.id);
        if (bulkAktion === "wennLeer" && String(alt).trim()) return;
        if (String(alt) === String(neuRoh)) return;
        liste.push({ veId: v.id, einheitId: null,
          label: v.name || v.nr || v.id, alt: alt, neu: neuRoh });
      });
    }
    return liste;
  };

  const aenderungen = vorschauAuf ? berechneAenderungen() : [];
  const bulkWertNoetig = bulkAktion !== "leeren";
  const kannVorschau = anzahlGewaehlt > 0 && (!bulkWertNoetig || bulkWert.trim());

  // Anwenden: schreibt Änderungen + legt Undo-Snapshot an
  const wendeAn = () => {
    if (!setVes) return;
    const changes = berechneAenderungen();
    if (!changes.length) { setVorschauAuf(false); return; }
    const feld = feldDef.id;
    const snapBetroffen = changes.map(c => ({ veId: c.veId, einheitId: c.einheitId, vorher: c.alt }));
    setVes(prev => prev.map(v => {
      const relevant = changes.filter(c => c.veId === v.id);
      if (!relevant.length) return v;
      if (ebene === "objekte") {
        const c = relevant[0];
        return { ...v, [feld]: c.neu };
      }
      const idMap = {};
      relevant.forEach(c => { idMap[c.einheitId] = c.neu; });
      return { ...v, einheiten: (Array.isArray(v.einheiten) ? v.einheiten : []).map(e =>
        (e.id in idMap) ? { ...e, [feld]: idMap[e.id] } : e) };
    }));
    setUndoSnap({ feld: feld, ebene: ebene, betroffen: snapBetroffen, anzahl: changes.length });
    setBulkErfolg(changes.length);
    setVorschauAuf(false);
    setAuswahl({});
  };

  // Undo: spielt Snapshot zurück
  const macheUndo = () => {
    if (!undoSnap || !setVes) return;
    const feld = undoSnap.feld;
    const snapEbene = undoSnap.ebene;
    setVes(prev => prev.map(v => {
      const relevant = undoSnap.betroffen.filter(b => b.veId === v.id);
      if (!relevant.length) return v;
      if (snapEbene === "objekte") {
        return { ...v, [feld]: relevant[0].vorher };
      }
      const idMap = {};
      relevant.forEach(b => { idMap[b.einheitId] = b.vorher; });
      return { ...v, einheiten: (Array.isArray(v.einheiten) ? v.einheiten : []).map(e =>
        (e.id in idMap) ? { ...e, [feld]: idMap[e.id] } : e) };
    }));
    setUndoSnap(null);
    setBulkErfolg(0);
  };

  // Modus-/Ebenenwechsel räumt transienten Zustand auf
  const wechsleModus = (m) => { setModus(m); setVorschauAuf(false); };
  const wechsleEbene = (e) => {
    setEbene(e); setAuswahl({}); setVorschauAuf(false);
    setBulkFeld(e === "einheiten" ? "typ" : "verwaltungsart");
    setBulkWert("");
  };

  // ── Styles (lokal, an Token-System angelehnt) ──
  const inputStil = { background: t.surface, border: `1px solid ${t.border}`,
    borderRadius: RAD.sm, padding: "6px 8px", fontSize: FS.input, color: t.text,
    outline: "none", fontFamily: "inherit", width: "100%", boxSizing: "border-box" };
  const labelStil = { fontSize: FS.xs, fontWeight: FW.semibold, color: t.sub,
    marginBottom: 4, display: "block" };
  const segBtn = (aktiv) => ({ flex: 1, padding: "8px 10px", borderRadius: RAD.sm,
    border: `1px solid ${aktiv ? accent : t.border}`,
    background: aktiv ? accent + "18" : "transparent",
    color: aktiv ? accent : t.sub, fontSize: FS.s,
    fontWeight: aktiv ? FW.semibold : FW.medium, cursor: "pointer",
    fontFamily: "inherit" });
  const pill = (aktiv) => ({ padding: "5px 10px", borderRadius: RAD.ms,
    border: `1px solid ${aktiv ? accent : t.border}`,
    background: aktiv ? accent + "18" : "transparent",
    color: aktiv ? accent : t.sub, fontSize: FS.xs,
    fontWeight: aktiv ? FW.semibold : FW.medium, cursor: "pointer",
    fontFamily: "inherit" });

  return (
    <div data-ad-auslauf="1" style={istDesktop
      ? { flex: 1, minHeight: 0, overflowY: "auto", WebkitOverflowScrolling: "touch",
          width: "100%", boxSizing: "border-box", padding: "8px 12px 96px" }
      : { width: "100%", alignSelf: "stretch", boxSizing: "border-box",
          padding: "8px 12px 96px" }}>
    <div style={{ maxWidth: 760, margin: "0 auto", width: "100%", boxSizing: "border-box" }}>
      <div style={{ fontSize: FS.xxl, fontWeight: FW.heavy, color: t.text, marginBottom: 4 }}>
        Schnelleingabe
      </div>
      <div style={{ fontSize: FS.s, color: t.sub, marginBottom: 12 }}>
        {modus === "neu"
          ? "Mehrere Einheiten in einem Rutsch anlegen — Muster wählen, im Raster anpassen, anlegen."
          : modus === "schluessel"
          ? "Verteilerschlüssel je Objekt pflegen — Standards einsehen, Anteile eintragen, eigene anlegen."
          : "Mehrere Datensätze auf einmal ändern — auswählen, Feld setzen, Vorschau bestätigen."}
      </div>

      {/* Modus-Umschalter */}
      <div style={{ display: "flex", gap: 6, marginBottom: 16,
        background: t.surface, borderRadius: RAD.sm, padding: 4 }}>
        <button onClick={() => wechsleModus("neu")} style={segBtn(modus === "neu")}>Neu anlegen</button>
        <button onClick={() => wechsleModus("bearbeiten")} style={segBtn(modus === "bearbeiten")}>Bearbeiten</button>
        <button onClick={() => wechsleModus("schluessel")} style={segBtn(modus === "schluessel")}>Schlüssel</button>
      </div>

      {modus === "neu" ? (
      <>
      {/* Ziel: neues Objekt (Standard) oder bestehendes */}
      <div style={{ marginBottom: 14 }}>
        <label style={labelStil}>Ziel</label>
        <div style={{ display: "flex", gap: 6 }}>
          <button onClick={() => { setZielArt("neuesObjekt"); setErfolg(0); }}
            style={segBtn(zielArt === "neuesObjekt")}>Neues Objekt</button>
          <button onClick={() => { setZielArt("bestehend"); setErfolg(0); }}
            style={segBtn(zielArt === "bestehend")}>Bestehendes Objekt</button>
        </div>
      </div>

      {zielArt === "neuesObjekt" ? (
        <div style={{ background: t.card, border: `1px solid ${t.border}`,
          borderRadius: RAD.md, padding: 12, marginBottom: 16 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <div style={{ gridColumn: "1 / -1" }}>
              <label style={labelStil}>Bezeichnung / Nr. *</label>
              <input value={neuNr} onChange={e => setNeuNr(e.target.value)}
                placeholder="z. B. WEG Musterstraße 12" style={inputStil}/>
            </div>
            <div style={{ gridColumn: "1 / -1" }}>
              <label style={labelStil}>Straße + Hausnummer *</label>
              <input value={neuStrasse} onChange={e => setNeuStrasse(e.target.value)}
                placeholder="Musterstraße 12" style={inputStil}/>
            </div>
            <div>
              <label style={labelStil}>PLZ</label>
              <input value={neuPlz} onChange={e => setNeuPlz(e.target.value)}
                inputMode="numeric" placeholder="69115" style={inputStil}/>
            </div>
            <div>
              <label style={labelStil}>Ort</label>
              <input value={neuOrt} onChange={e => setNeuOrt(e.target.value)}
                placeholder="Heidelberg" style={inputStil}/>
            </div>
            <div style={{ gridColumn: "1 / -1" }}>
              <label style={labelStil}>Verwaltungsart</label>
              <select value={neuVerwArt} onChange={e => setNeuVerwArt(e.target.value)}
                style={{ ...inputStil, cursor: "pointer" }}>
                {VERWALTUNGSARTEN.map(a => (
                  <option key={a.id} value={a.id}>{a.label}</option>
                ))}
              </select>
            </div>
          </div>
        </div>
      ) : (
        <div style={{ marginBottom: 16 }}>
          <label style={labelStil}>Ziel-Objekt</label>
          <select value={objektId || ""} onChange={e => { setObjektId(e.target.value); setErfolg(0); }}
            style={{ ...inputStil, cursor: "pointer" }}>
            {(ves || []).map(v => (
              <option key={v.id} value={v.id}>{v.name || v.nr || v.id}</option>
            ))}
          </select>
          {ve ? (
            <div style={{ fontSize: FS.xs, color: t.muted, marginTop: 4 }}>
              Aktueller Bestand: {bestand} {bestand === 1 ? "Einheit" : "Einheiten"}
            </div>
          ) : null}
        </div>
      )}

      {/* Muster-Schema */}
      <div style={{ marginBottom: 12 }}>
        <label style={labelStil}>Muster</label>
        <div style={{ display: "flex", gap: 6 }}>
          <button onClick={() => setSchema("fortlaufend")} style={segBtn(schema === "fortlaufend")}>Fortlaufend</button>
          <button onClick={() => setSchema("etagen")} style={segBtn(schema === "etagen")}>Etagen × Seite</button>
          <button onClick={() => setSchema("stellplatz")} style={segBtn(schema === "stellplatz")}>Stellplätze</button>
        </div>
      </div>

      {/* Muster-Parameter */}
      <div style={{ background: t.card, border: `1px solid ${t.border}`,
        borderRadius: RAD.md, padding: 12, marginBottom: 12 }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <div>
            <label style={labelStil}>Präfix</label>
            <input value={praefix} onChange={e => setPraefix(e.target.value)} style={inputStil}/>
          </div>
          <div>
            <label style={labelStil}>Startnummer</label>
            <input value={start} onChange={e => setStart(e.target.value)} inputMode="numeric" style={inputStil}/>
          </div>
          {schema !== "etagen" ? (
            <div>
              <label style={labelStil}>Anzahl</label>
              <input value={anzahl} onChange={e => setAnzahl(e.target.value)} inputMode="numeric" style={inputStil}/>
            </div>
          ) : null}
          <div>
            <label style={labelStil}>Stellen (z. B. 01)</label>
            <input value={breite} onChange={e => setBreite(e.target.value)} inputMode="numeric" style={inputStil}/>
          </div>
        </div>
        {schema === "etagen" ? (
          <div style={{ marginTop: 12 }}>
            <label style={labelStil}>Etagen</label>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 10 }}>
              {SE_ETAGEN_VORLAGE.map(et => (
                <button key={et} onClick={() => toggleEtage(et)} style={pill(etagen.indexOf(et) >= 0)}>{et}</button>
              ))}
            </div>
            <label style={labelStil}>Seiten</label>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {SE_SEITEN_VORLAGE.map(se => (
                <button key={se} onClick={() => toggleSeite(se)} style={pill(seiten.indexOf(se) >= 0)}>{se}</button>
              ))}
            </div>
          </div>
        ) : null}
        <button onClick={generieren}
          style={{ marginTop: 12, width: "100%", padding: "9px 12px", borderRadius: RAD.sm,
            border: `1px solid ${accent}`, background: accent, color: "#fff",
            fontSize: FS.s, fontWeight: FW.semibold, cursor: "pointer", fontFamily: "inherit" }}>
          Raster erzeugen
        </button>
      </div>

      {/* Grid */}
      {rows.length > 0 ? (
        <div style={{ background: t.card, border: `1px solid ${t.border}`,
          borderRadius: RAD.md, padding: 12, marginBottom: 12 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
            <div style={{ fontSize: FS.s, fontWeight: FW.semibold, color: t.text }}>
              {rows.length} {rows.length === 1 ? "Zeile" : "Zeilen"}
            </div>
            <button onClick={() => setRows([])}
              style={{ background: "none", border: "none", color: t.muted,
                fontSize: FS.xs, cursor: "pointer", fontFamily: "inherit" }}>
              Leeren
            </button>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {rows.map((r, idx) => (
              <div key={idx} style={{ border: `1px solid ${t.border}`, borderRadius: RAD.sm, padding: 8 }}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
                  <input value={r.nr} onChange={e => setRowFeld(idx, "nr", e.target.value)}
                    placeholder="Bezeichnung" style={inputStil}/>
                  <select value={r.typ} onChange={e => setRowFeld(idx, "typ", e.target.value)}
                    style={{ ...inputStil, cursor: "pointer" }}>
                    {SE_TYP_OPTIONEN.map(tp => <option key={tp} value={tp}>{tp}</option>)}
                  </select>
                  <input value={r.lage} onChange={e => setRowFeld(idx, "lage", e.target.value)}
                    placeholder="Lage" style={inputStil}/>
                  <input value={r.flaeche} onChange={e => setRowFeld(idx, "flaeche", e.target.value)}
                    placeholder="Fläche (m²)" inputMode="decimal" style={inputStil}/>
                  <input value={r.zimmer} onChange={e => setRowFeld(idx, "zimmer", e.target.value)}
                    placeholder="Zimmer" style={inputStil}/>
                  <input value={r.mea} onChange={e => setRowFeld(idx, "mea", e.target.value)}
                    placeholder="MEA" style={inputStil}/>
                </div>
                <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 6 }}>
                  <button onClick={() => removeRow(idx)}
                    style={{ background: "none", border: "none", color: "#EF4444",
                      fontSize: FS.xs, cursor: "pointer", fontFamily: "inherit" }}>
                    Zeile entfernen
                  </button>
                </div>
              </div>
            ))}
          </div>
          <button onClick={addRow}
            style={{ marginTop: 8, background: "none", border: `1px dashed ${t.border}`,
              borderRadius: RAD.sm, padding: "7px 12px", color: t.sub,
              fontSize: FS.s, cursor: "pointer", fontFamily: "inherit", width: "100%" }}>
            + Zeile hinzufügen
          </button>
        </div>
      ) : null}

      {/* Anlegen */}
      {rows.length > 0 ? (
        <button onClick={anlegen} disabled={!kannAnlegen}
          style={{ width: "100%", padding: "11px 12px", borderRadius: RAD.sm,
            border: `1px solid ${kannAnlegen ? accent : t.border}`,
            background: kannAnlegen ? accent : "transparent",
            color: kannAnlegen ? "#fff" : t.muted,
            fontSize: FS.m, fontWeight: FW.semibold,
            cursor: kannAnlegen ? "pointer" : "not-allowed", fontFamily: "inherit" }}>
          {zielArt === "neuesObjekt"
            ? `Objekt mit ${gueltigeRows.length} ${gueltigeRows.length === 1 ? "Einheit" : "Einheiten"} anlegen`
            : `${gueltigeRows.length} ${gueltigeRows.length === 1 ? "Einheit" : "Einheiten"} anlegen`}
        </button>
      ) : null}

      {erfolg > 0 ? (
        <div style={{ marginTop: 12, padding: "10px 12px", borderRadius: RAD.sm,
          background: "#22C55E18", border: "1px solid #22C55E55",
          color: t.text, fontSize: FS.s }}>
          {zielArt === "neuesObjekt"
            ? `Objekt „${neuNr.trim()}" mit ${erfolg} ${erfolg === 1 ? "Einheit" : "Einheiten"} angelegt.`
            : `${erfolg} ${erfolg === 1 ? "Einheit wurde" : "Einheiten wurden"} bei „${ve ? (ve.name || ve.nr || ve.id) : ""}" angelegt.`}
        </div>
      ) : null}
      </>
      ) : modus === "schluessel" ? (
      <>
      {/* ── SCHLÜSSEL — Verteilerschlüssel je Objekt pflegen ─────────── */}
      <div style={{ marginBottom: 16 }}>
        <label style={labelStil}>Objekt</label>
        <select value={objektId || ""} onChange={e => setObjektId(e.target.value)}
          style={{ ...inputStil, cursor: "pointer" }}>
          {(ves || []).map(v => (
            <option key={v.id} value={v.id}>{v.name || v.nr || v.id}</option>
          ))}
        </select>
      </div>
      {ve ? (
        <VerteilerSchluesselBlock ve={ve} setVes={setVes} t={t} accent={accent}
          editierbar={true}/>
      ) : (
        <div style={{ fontSize: FS.s, color: t.muted }}>Kein Objekt vorhanden.</div>
      )}
      </>
      ) : (
      <>
      {/* ── BEARBEITEN ───────────────────────────────────────────── */}
      {/* Ebenen-Umschalter */}
      <div style={{ display: "flex", gap: 6, marginBottom: 14 }}>
        <button onClick={() => wechsleEbene("einheiten")} style={segBtn(ebene === "einheiten")}>Einheiten</button>
        <button onClick={() => wechsleEbene("objekte")} style={segBtn(ebene === "objekte")}>Objekte</button>
      </div>

      {/* Filter */}
      <div style={{ background: t.card, border: `1px solid ${t.border}`,
        borderRadius: RAD.md, padding: 12, marginBottom: 12 }}>
        <label style={labelStil}>Objekt-Filter</label>
        <select value={filterObjektId} onChange={e => { setFilterObjektId(e.target.value); setAuswahl({}); }}
          style={{ ...inputStil, cursor: "pointer", marginBottom: ebene === "einheiten" ? 10 : 0 }}>
          <option value="">Alle Objekte</option>
          {(ves || []).map(v => <option key={v.id} value={v.id}>{v.name || v.nr || v.id}</option>)}
        </select>
        {ebene === "einheiten" ? (
          <>
            <label style={labelStil}>Typ-Filter</label>
            <select value={filterTyp} onChange={e => { setFilterTyp(e.target.value); setAuswahl({}); }}
              style={{ ...inputStil, cursor: "pointer" }}>
              <option value="">Alle Typen</option>
              {SE_TYP_OPTIONEN.map(tp => <option key={tp} value={tp}>{tp}</option>)}
            </select>
          </>
        ) : null}
      </div>

      {/* Auswahl-Liste */}
      <div style={{ background: t.card, border: `1px solid ${t.border}`,
        borderRadius: RAD.md, padding: 12, marginBottom: 12 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
          <div style={{ fontSize: FS.s, fontWeight: FW.semibold, color: t.text }}>
            {anzahlGewaehlt} von {alleKeys.length} gewählt
          </div>
          <button onClick={() => setzeAlle(!alleGewaehlt)}
            style={{ background: "none", border: "none", color: accent,
              fontSize: FS.xs, fontWeight: FW.semibold, cursor: "pointer", fontFamily: "inherit" }}>
            {alleGewaehlt ? "Keine" : "Alle"}
          </button>
        </div>
        <div style={{ maxHeight: 280, overflowY: "auto", display: "flex", flexDirection: "column", gap: 2 }}>
          {(ebene === "einheiten" ? einheitenKandidaten : objektKandidaten).map((k, i) => {
            const veId = ebene === "einheiten" ? k.veId : k.id;
            const eId = ebene === "einheiten" ? k.einheit.id : null;
            const key = auswahlKey(veId, eId);
            const an = !!auswahl[key];
            const titel = ebene === "einheiten"
              ? (k.einheit.nr || k.einheit.id)
              : (k.name || k.nr || k.id);
            const sub = ebene === "einheiten"
              ? `${k.veName}${k.einheit.lage ? " · " + k.einheit.lage : ""} · ${k.einheit.typ}`
              : `${(Array.isArray(k.einheiten) ? k.einheiten.length : 0)} Einheiten`;
            return (
              <div key={key + i} onClick={() => toggleAuswahl(key)}
                style={{ display: "flex", alignItems: "center", gap: 10, padding: "7px 6px",
                  borderRadius: RAD.sm, cursor: "pointer",
                  background: an ? accent + "12" : "transparent" }}>
                <input type="checkbox" checked={an} readOnly
                  style={{ width: 17, height: 17, accentColor: accent, flexShrink: 0, pointerEvents: "none" }}/>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: FS.s, fontWeight: FW.medium, color: t.text,
                    overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{titel}</div>
                  <div style={{ fontSize: FS.xs, color: t.muted,
                    overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{sub}</div>
                </div>
              </div>
            );
          })}
          {alleKeys.length === 0 ? (
            <div style={{ fontSize: FS.s, color: t.muted, padding: "8px 4px" }}>
              Keine Datensätze für diesen Filter.
            </div>
          ) : null}
        </div>
      </div>

      {/* Feld + Aktion + Wert */}
      <div style={{ background: t.card, border: `1px solid ${t.border}`,
        borderRadius: RAD.md, padding: 12, marginBottom: 12 }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <div>
            <label style={labelStil}>Feld</label>
            <select value={bulkFeld} onChange={e => { setBulkFeld(e.target.value); setBulkWert(""); }}
              style={{ ...inputStil, cursor: "pointer" }}>
              {aktuelleFelder.map(f => <option key={f.id} value={f.id}>{f.label}</option>)}
            </select>
          </div>
          <div>
            <label style={labelStil}>Aktion</label>
            <select value={bulkAktion} onChange={e => setBulkAktion(e.target.value)}
              style={{ ...inputStil, cursor: "pointer" }}>
              <option value="setzen">Setzen (überschreiben)</option>
              <option value="wennLeer">Nur wenn leer</option>
              <option value="leeren">Leeren</option>
            </select>
          </div>
        </div>
        {bulkWertNoetig ? (
          <div style={{ marginTop: 10 }}>
            <label style={labelStil}>Wert</label>
            {feldDef.typ === "select" ? (
              <select value={bulkWert} onChange={e => setBulkWert(e.target.value)}
                style={{ ...inputStil, cursor: "pointer" }}>
                <option value="">— wählen —</option>
                {feldDef.optionen.map(o => (
                  <option key={o} value={o}>{feldDef.optionLabel ? feldDef.optionLabel(o) : o}</option>
                ))}
              </select>
            ) : (
              <input value={bulkWert} onChange={e => setBulkWert(e.target.value)}
                placeholder={feldDef.typ === "flaeche" ? "z. B. 72 (→ 72 m²)" : feldDef.label}
                inputMode={feldDef.typ === "flaeche" ? "decimal" : "text"} style={inputStil}/>
            )}
          </div>
        ) : null}
      </div>

      {/* Vorschau-Button */}
      <button onClick={() => setVorschauAuf(true)} disabled={!kannVorschau}
        style={{ width: "100%", padding: "11px 12px", borderRadius: RAD.sm,
          border: `1px solid ${kannVorschau ? accent : t.border}`,
          background: kannVorschau ? accent : "transparent",
          color: kannVorschau ? "#fff" : t.muted,
          fontSize: FS.m, fontWeight: FW.semibold,
          cursor: kannVorschau ? "pointer" : "not-allowed", fontFamily: "inherit" }}>
        Vorschau ({anzahlGewaehlt} gewählt)
      </button>

      {/* Erfolg + Undo */}
      {bulkErfolg > 0 && undoSnap ? (
        <div style={{ marginTop: 12, padding: "10px 12px", borderRadius: RAD.sm,
          background: "#22C55E18", border: "1px solid #22C55E55",
          display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
          <div style={{ color: t.text, fontSize: FS.s }}>
            {bulkErfolg} {bulkErfolg === 1 ? "Datensatz" : "Datensätze"} geändert.
          </div>
          <button onClick={macheUndo}
            style={{ background: "none", border: `1px solid ${accent}`, color: accent,
              borderRadius: RAD.sm, padding: "5px 12px", fontSize: FS.xs,
              fontWeight: FW.semibold, cursor: "pointer", fontFamily: "inherit", flexShrink: 0 }}>
            Rückgängig
          </button>
        </div>
      ) : null}

      {/* Vorschau-Modal */}
      {vorschauAuf ? (
        <div onClick={() => setVorschauAuf(false)}
          style={{ position: "fixed", top: 0, right: 0, bottom: 0, left: 0,
            background: "rgba(0,0,0,0.45)", display: "flex", alignItems: "center",
            justifyContent: "center", padding: 16, zIndex: 9999 }}>
          <div onClick={e => e.stopPropagation()}
            style={{ background: t.card, borderRadius: RAD.lg, maxWidth: 520, width: "100%",
              maxHeight: "85dvh", overflowY: "auto", padding: 16,
              border: `1px solid ${t.border}`, boxSizing: "border-box" }}>
            <div style={{ fontSize: FS.l, fontWeight: FW.heavy, color: t.text, marginBottom: 4 }}>
              Vorschau
            </div>
            <div style={{ fontSize: FS.s, color: t.sub, marginBottom: 12 }}>
              Feld „{feldDef.label}" · {bulkAktion === "leeren" ? "leeren"
                : bulkAktion === "wennLeer" ? "nur wenn leer setzen" : "setzen"}
            </div>
            {aenderungen.length === 0 ? (
              <div style={{ fontSize: FS.s, color: t.muted, padding: "8px 0" }}>
                Keine Änderungen — bei den gewählten Datensätzen steht der Wert bereits so
                (oder „nur wenn leer" trifft auf keinen leeren zu).
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 12 }}>
                {aenderungen.map((c, i) => (
                  <div key={i} style={{ display: "flex", alignItems: "center", gap: 8,
                    fontSize: FS.s, padding: "6px 8px", borderRadius: RAD.sm,
                    background: t.surface }}>
                    <div style={{ flex: 1, minWidth: 0, color: t.text,
                      overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.label}</div>
                    <div style={{ color: t.muted, flexShrink: 0 }}>{zeigeWert(feldDef.id, c.alt)}</div>
                    <div style={{ color: t.muted, flexShrink: 0 }}>→</div>
                    <div style={{ color: accent, fontWeight: FW.semibold, flexShrink: 0 }}>{zeigeWert(feldDef.id, c.neu)}</div>
                  </div>
                ))}
              </div>
            )}
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button onClick={() => setVorschauAuf(false)}
                style={{ background: "none", border: `1px solid ${t.border}`, color: t.sub,
                  borderRadius: RAD.sm, padding: "8px 14px", fontSize: FS.s,
                  cursor: "pointer", fontFamily: "inherit" }}>
                Abbrechen
              </button>
              <button onClick={wendeAn} disabled={aenderungen.length === 0}
                style={{ background: aenderungen.length ? accent : "transparent",
                  border: `1px solid ${aenderungen.length ? accent : t.border}`,
                  color: aenderungen.length ? "#fff" : t.muted,
                  borderRadius: RAD.sm, padding: "8px 14px", fontSize: FS.s,
                  fontWeight: FW.semibold,
                  cursor: aenderungen.length ? "pointer" : "not-allowed", fontFamily: "inherit" }}>
                {aenderungen.length} anwenden
              </button>
            </div>
          </div>
        </div>
      ) : null}
      </>
      )}
    </div>
    </div>
  );
}

// ── ListenGeneratorScreen — Vorlage wählen → konfigurieren → Blatt-Vorschau →
//    Druck. Schriftgröße/Zeilenabstand wirken auf Vorschau UND Druck identisch.
const LG_FONT = { s: 9.5, m: 11, l: 13 };          // Druck-pt ≈ Vorschau-px
const LG_PAD  = { kompakt: 2, normal: 4, weit: 8 }; // vertikales Zellen-Padding
function ListenGeneratorScreen({ ves, kontakte, t, accent, settings }) {
  const [vorlageId, setVorlageId] = useState(null);
  const [objektId, setObjektId] = useState(ves && ves[0] ? ves[0].id : null);
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

  const vorlage = LISTEN_KATALOG.find(v => v.id === vorlageId) || null;
  const ve = (ves || []).find(v => v && v.id === objektId) || (ves && ves[0]) || null;
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

  // ── Blatt-Vorschau (fest hell wie Papier, unabhängig vom App-Theme) ──
  const blattVorschau = vorlage && (
    <div style={{ background: "#FFFFFF", color: "#111111", borderRadius: 6,
      boxShadow: "0 2px 14px rgba(0,0,0,0.25)", padding: "22px 24px",
      maxWidth: quer ? 980 : 760, overflowX: "auto" }}>
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
  );

  return (
    <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column" }}>
      <StickySectionHeader t={t} accent={accent}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap",
          padding: "2px 0 10px 0" }}>
          <div style={{ fontSize: FS.xxl, fontWeight: FW.heavy, color: t.text }}>Listengenerator</div>
          {vorlage && (
            <button onClick={() => setVorlageId(null)} data-kb-zurueck="1" style={{ marginLeft: "auto",
              display: "flex", alignItems: "center", gap: 6, background: "none",
              border: `1px solid ${t.border}`, color: t.text, borderRadius: RAD.ms,
              padding: "6px 12px", cursor: "pointer", fontFamily: "inherit",
              fontSize: FS.m, fontWeight: FW.medium }}>
              Andere Liste
            </button>
          )}
        </div>
      </StickySectionHeader>
      <div data-ad-scroll="y" style={{ flex: 1, minHeight: 0, overflowY: "auto",
        paddingBottom: "max(env(safe-area-inset-bottom, 0px), 80px)" }}>

        {/* Schritt 1: Vorlagen-Katalog */}
        {!vorlage && (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <div style={{ fontSize: FS.s, color: t.muted, marginBottom: 2 }}>
              Welche Liste möchtest du erstellen?
            </div>
            {LISTEN_KATALOG.map(v => (
              <div key={v.id} onClick={() => { setVorlageId(v.id); setHausId(null); }} data-kb-item="1"
                style={{ display: "flex", alignItems: "center", gap: 12, cursor: "pointer",
                  background: t.surface, border: `1px solid ${t.border}`,
                  borderRadius: RAD.md, padding: "12px 14px" }}>
                <span style={{ fontSize: 22, flexShrink: 0 }}>{v.icon}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: FS.m, fontWeight: FW.bold, color: t.text }}>{v.label}</div>
                  <div style={{ fontSize: FS.s, color: t.sub }}>{v.sub}</div>
                </div>
                <span style={{ fontSize: FS.xxs, padding: "2px 8px", borderRadius: RAD.pill,
                  background: accent + "15", color: accent, fontWeight: FW.medium, flexShrink: 0 }}>
                  {v.bereich === "objekt" ? "je Objekt" : "alle Objekte"}
                </span>
              </div>
            ))}
          </div>
        )}

        {/* Schritt 2: Konfiguration + Blatt-Vorschau */}
        {vorlage && (
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ fontSize: 22 }}>{vorlage.icon}</span>
              <div>
                <div style={{ fontSize: FS.l, fontWeight: FW.bold, color: t.text }}>{vorlage.label}</div>
                <div style={{ fontSize: FS.s, color: t.sub }}>{vorlage.sub}</div>
              </div>
            </div>

            {/* Objektwahl + Hauswahl */}
            {vorlage.bereich === "objekt" && (
              <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
                <div>
                  <div style={labelStyle}>Objekt</div>
                  <select value={objektId == null ? "" : String(objektId)}
                    onChange={e => { setObjektId(e.target.value === "" ? null : Number(e.target.value)); setHausId(null); }}
                    style={selectStyle}>
                    {(ves || []).map(v => (
                      <option key={v.id} value={String(v.id)}>
                        {(v.nr || "Objekt") + (v.adresse ? " · " + v.adresse : "")}
                      </option>
                    ))}
                  </select>
                </div>
                {hausWaehlbar && (
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
                )}
              </div>
            )}

            {/* Rollen-Filter (nur Kontaktliste) */}
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

            {/* Spaltenauswahl */}
            <div>
              <div style={labelStyle}>Spalten</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {vorlage.spalten.map(s => pill(spaltenState[s.id], s.label, () => toggleSpalte(s.id), s.id))}
              </div>
            </div>

            {/* Filter */}
            {vorlage.filter.length > 0 && (
              <div>
                <div style={labelStyle}>Filter</div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {vorlage.filter.map(fd => pill(filterState[fd.id], fd.label, () => toggleFilter(fd.id), fd.id))}
                </div>
              </div>
            )}

            {/* Darstellung: Format, Schrift, Abstand, Kopf */}
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

            {/* Blatt-Vorschau */}
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

            {/* Druck-Button */}
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
      </div>
    </div>
  );
}

function StatistikScreen({ ves, kontakte, t, accent }) {
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
    <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column" }}>
      <StickySectionHeader t={t} accent={accent}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap",
          padding: "2px 0 10px 0" }}>
          <div style={{ fontSize: FS.xxl, fontWeight: FW.heavy, color: t.text }}>Statistik</div>
          <span style={{ fontSize: FS.s, color: t.muted }}>Live aus dem Bestand berechnet</span>
        </div>
      </StickySectionHeader>
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
    </div>
  );
}


export { druckeHtml, SchnelleingabeScreen, ListenGeneratorScreen, StatistikScreen };
