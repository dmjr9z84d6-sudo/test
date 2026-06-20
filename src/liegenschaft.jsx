import React, { useState, useRef, useEffect, createContext, useContext, Fragment } from "react";
import {
  FS, FW, KONTAKTE_FARBE, RAD, feldInput, feldLabel, getContrastColor
} from "./constants.js";
import { datumDe, isoHeute, joinPlzOrt, splitPlzOrt, zuIsoDatum } from "./utils-basis.js";
import {
  BELEGUNG_LABEL, BELEGUNG_VERWENDUNGEN, BEWOHNER_RECHTE, RAUM_ART_OPTIONEN, VS_BASEN,
  ZAEHLER_ARTEN, abgeleiteterBelegungstyp, aktiveBelegung, belegungsPhase, belegungsVerwendungen,
  bewohnerMitKontakt, bewohnerRecht, brecheSevWechselAb, effVerteilerschluessel, eigStatus,
  extractNachname, flaecheVon, haushaltKopfzahl, heuteLaufendeBelegung, isStellplatzTyp,
  istAnonymesMitglied, istVermietet, istVertragspartei, laufenderEigWechsel, laufenderSevWechsel,
  leererHaushalt, neueBelegung, neuerRaum, neuerTeil, neuerZaehler, neuesHhMitglied, parseFlaeche,
  sevStatus, starteSevWechsel, summeRaumFlaechen, teileVon, verwendungenVon, vsBasisLabel,
  vsIstManuell, vsWertVon, wendeKontaktZuweisungenAn, zaehlerArtLabel
} from "./datenmodell.js";
import {
  DESKTOP_MIN_WIDTH, HEADER_FILTER_LEER, HV_ADRESSE, I, SIDEBAR_MAX_WIDTH, SIDEBAR_MIN_WIDTH,
  SortierPfeile, ableiteStatusVonBis, genRechnungsadresse, haltePositionUeberUpdate,
  headerFilterIstAktiv, scrollToCard, sidebarModus, useEinheitAnzeige, useEinheitOffen,
  useKontaktFarbe, useOutsideClick, useRechnungsadresseAn, useVerwendungen, useWindowWidth
} from "./utils-icons.jsx";
import {
  Avatar, BelegungswechselVorgang, CopyBtn, DatumFeld, EckPille, EigentumBlock, EigentumHistorie,
  EigentumswechselVorgang, FeldKontaktKarte, FieldList, KontaktPicker, PersonCard, Toggle,
  VerwendungBadge, datumAnzeige, parseAnteile
} from "./components.jsx";
import { StatusLeiste, VEDetail, VEKachel } from "./objektansicht.jsx";
// Kontakt-Komponenten (S7) — Laufzeit-Refs in JSX (Zyklus liegenschaft⇄kontakte-modul).
import {
  AktionsButton, BeziehungEditor, KontaktDetailKarte, KontaktKarte, getFirmaMitarbeiter
} from "./kontakte-modul.jsx";
// ╔═════════════════════════════════════════════════════════════════════════╗
// ║ SEKTION 5a · LIEGENSCHAFT-KERN — ausgelagertes Modul                    ║
// ║ EinheitDetail · EinheitZeile · GebaeudeKarte · KartenList ·             ║
// ║ NeueKarteMenu · LiegenschaftAnsicht · VerwaltungAnsicht ·               ║
// ║ DokumenteAnsicht · VertragForm/Zeile/FirmaKarte · buildInitialKarten    ║
// ╚═════════════════════════════════════════════════════════════════════════╝

// ── EinheitDetail (clean Top-Level, nutzt bausteine PersonCard) ─────────────

// Schreibhilfe: ersetzt die aktive Belegung des aktiven Teils einer Einheit
// durch eine neue Belegung (mutationsfrei). Gibt eine neue Einheit zurück.
function setzeAktiveBelegung(einheit, neueBel, teilIndex) {
  const ti0 = (typeof teilIndex === "number" && teilIndex >= 0) ? teilIndex : 0;
  const teile = teileVon(einheit).map((teil, ti) => {
    if (ti !== ti0) return teil;
    // Die heute gültige Belegung treffen (datumsbewusst); fällt auf die
    // klassische aktive zurück, falls keine heute-laufende existiert.
    const ziel = heuteLaufendeBelegung(teil) || aktiveBelegung(teil);
    const belegungen = (teil.belegungen || []).map(b => (ziel && b.id === ziel.id) ? neueBel : b);
    // Falls es noch gar keine Belegung gab: anlegen.
    if (!ziel) belegungen.push(neueBel);
    return { ...teil, belegungen };
  });
  return { ...einheit, teile };
}




// ── Eigentümer-Wechsel: Stufen-Modell ───────────────────────────────────────
// Ein Eigentümer-Eintrag trägt einen status, der den realen Verkaufsablauf
// abbildet (Spec §22.5). Datum-Felder sind ISO (isoHeute-konform):
//   · kaufabsichtAb — Stufe 1: Käufer tritt erstmals auf (rechtlich unverbindlich)
//   · kostenAb      — Stufe 2: Kosten-/Nutzen-/Lastenübergang (abrechnungsrelevant)

// ── Eigentumsquoten (Anteil eines Miteigentümers an EINER Einheit) ──────────
// Konzept_Eigentumsquoten.md. Quote als Bruch { zaehler, nenner } am Eigentümer-
// Eintrag (optional). Wirkt im Stimmrecht (MEA × Quotenanteil), NICHT in der
// Abrechnung (die bleibt einheitenbasiert). Grundsatz: Normalfall (1 Eigentümer
// oder gleiche Teile) braucht KEINE Eingabe — quote bleibt null.

// Roh-Anteil eines Eintrags als Dezimalwert (zaehler/nenner) oder null, wenn
// keine gültige Quote gesetzt ist. Tolerant: nenner ≤ 0 → null.
function quoteRoh(p) {
  if (!p || !p.quote) return null;
  if (p.quote.zaehler === "" || p.quote.nenner === "") return null; // Teil-Eingabe
  const z = Number(p.quote.zaehler);
  const n = Number(p.quote.nenner);
  if (!isFinite(z) || !isFinite(n) || n <= 0 || z < 0) return null;
  return z / n;
}

// Normierter Anteil (0..1) eines Eintrags innerhalb der aktiven Eigentümer.
// Logik:
//   • 0 oder 1 aktiver Eigentümer        → 1 (alleiniger Anteil)
//   • mehrere, KEINER mit Quote          → gleiche Teile (1/n)
//   • mehrere, mind. einer mit Quote     → eigener Rohanteil / Summe aller
//     Rohanteile; Einträge ohne Quote zählen mit Rohanteil 0 (= explizit gesetzte
//     Quoten dominieren; wer keine hat, bekommt den Rest nicht automatisch — das
//     ist Absicht: gemischt gepflegte Daten sollen sichtbar unsauber sein, nicht
//     stillschweigend „aufgefüllt").
function quoteAnteil(p, alleEig) {
  const aktive = (alleEig || []).filter(e => eigStatus(e) === "aktiv");
  if (aktive.length <= 1) return 1;
  const mitQuote = aktive.some(e => quoteRoh(e) != null);
  if (!mitQuote) return 1 / aktive.length;
  const summe = aktive.reduce((s, e) => s + (quoteRoh(e) || 0), 0);
  if (summe <= 0) return 0;
  return (quoteRoh(p) || 0) / summe;
}

// Anzeige-Text der Quote eines Eintrags: „5/12 (41,7 %)" oder „" (kein Badge).
// Bei genau einem aktiven Eigentümer und ohne explizite Quote → leer (100 % ist
// selbstverständlich und soll die UI nicht zumüllen).
function quoteLabel(p, alleEig) {
  const aktive = (alleEig || []).filter(e => eigStatus(e) === "aktiv");
  if (aktive.length <= 1) return "";
  const roh = quoteRoh(p);
  const anteil = quoteAnteil(p, alleEig);
  const proz = (anteil * 100).toLocaleString("de-DE", { maximumFractionDigits: 1 });
  if (roh != null) return p.quote.zaehler + "/" + p.quote.nenner + " (" + proz + " %)";
  // mehrere Eigentümer, dieser ohne Quote: nur Prozent (gleiche Teile) zeigen.
  return proz + " %";
}

// Prüft, ob die gesetzten Quoten einer Einheit eine saubere Verteilung ergeben
// (Summe der Rohanteile ≈ 1). Liefert { gepflegt, summeProz, vollstaendig } für
// einen dezenten Hinweis im Edit-Modus. Bewusst tolerant (kein harter Fehler).
function quotenStatus(alleEig) {
  const aktive = (alleEig || []).filter(e => eigStatus(e) === "aktiv");
  const mitQuote = aktive.filter(e => quoteRoh(e) != null);
  if (mitQuote.length === 0) return { gepflegt: false, summeProz: 0, vollstaendig: aktive.length <= 1 };
  const summe = aktive.reduce((s, e) => s + (quoteRoh(e) || 0), 0);
  return {
    gepflegt: true,
    summeProz: Math.round(summe * 1000) / 10,
    vollstaendig: mitQuote.length === aktive.length && Math.abs(summe - 1) < 0.001,
  };
}

// Intelligente Quoten-Verteilung. Regeln (Benny 16.06.2026):
//  • Gemeinsamer Nenner für alle aktiven Eigentümer (Teiler der Einheit).
//  • Manuell gesetzte Zähler (quoteFix:true) bleiben fix; der verbleibende Rest
//    verteilt sich gleichmäßig auf die NICHT fixierten.
//  • Rest nicht ganzzahlig → möglichst gleich, Differenz auf den letzten
//    nicht-fixierten (7 auf 2 → 3 + 4).
//  • Nenner-Änderung → fixierte Zähler proportional mitskalieren (1/5 → 2/10).
// `eig` = komplette Eigentümerliste; nur AKTIVE bekommen Quoten. Liefert eine
// neue Liste (immutabel). `aktion` beschreibt die Nutzer-Eingabe:
//   { typ:"zaehler", kontaktId, wert } | { typ:"nenner", wert } | { typ:"reset", kontaktId }
function verteileQuoten(eig, aktion) {
  const liste = eig || [];
  const aktivIdx = [];
  liste.forEach((p, i) => { if (eigStatus(p) === "aktiv") aktivIdx.push(i); });
  if (aktivIdx.length < 2) return liste;

  // Gemeinsamen Nenner bestimmen: aus Aktion, sonst aus vorhandener Quote, sonst
  // Default = Anzahl aktiver Eigentümer (ergibt 1/n je Person).
  let nenner = null;
  if (aktion && aktion.typ === "nenner") {
    const n = parseInt(aktion.wert, 10);
    nenner = (isFinite(n) && n > 0) ? n : null;
  }
  if (nenner == null) {
    for (const idx of aktivIdx) {
      const q = liste[idx].quote;
      if (q && q.nenner !== "" && q.nenner != null) {
        const n = parseInt(q.nenner, 10);
        if (isFinite(n) && n > 0) { nenner = n; break; }
      }
    }
  }
  if (nenner == null) nenner = aktivIdx.length;

  // Alter Nenner (für proportionale Skalierung bei Nenner-Änderung).
  let alterNenner = null;
  for (const idx of aktivIdx) {
    const q = liste[idx].quote;
    if (q && q.nenner !== "" && q.nenner != null) {
      const n = parseInt(q.nenner, 10);
      if (isFinite(n) && n > 0) { alterNenner = n; break; }
    }
  }

  // Aktuelle Zähler + Fix-Flags je aktivem Eigentümer einsammeln.
  const arr = aktivIdx.map(idx => {
    const q = liste[idx].quote || {};
    let z = (q.zaehler === "" || q.zaehler == null) ? null : parseInt(q.zaehler, 10);
    if (z != null && !isFinite(z)) z = null;
    return { idx, zaehler: z, fix: !!liste[idx].quoteFix };
  });

  // Nenner-Änderung: fixierte Zähler proportional mitskalieren.
  if (aktion && aktion.typ === "nenner" && alterNenner && alterNenner !== nenner) {
    arr.forEach(a => {
      if (a.fix && a.zaehler != null) {
        a.zaehler = Math.round(a.zaehler * nenner / alterNenner);
      }
    });
  }

  // Zähler-Eingabe: betroffenen Eintrag setzen + fixieren.
  if (aktion && aktion.typ === "zaehler") {
    const ziel = arr.find(a => String(liste[a.idx].kontaktId) === String(aktion.kontaktId));
    if (ziel) {
      const z = parseInt(aktion.wert, 10);
      if (aktion.wert === "" || !isFinite(z)) { ziel.zaehler = null; ziel.fix = false; }
      else { ziel.zaehler = Math.max(0, Math.min(z, nenner)); ziel.fix = true; }
    }
  }
  // Reset eines Eintrags (Zähler geleert → wird wieder automatisch verteilt).
  if (aktion && aktion.typ === "reset") {
    const ziel = arr.find(a => String(liste[a.idx].kontaktId) === String(aktion.kontaktId));
    if (ziel) { ziel.zaehler = null; ziel.fix = false; }
  }

  // Rest auf die nicht-fixierten gleichmäßig verteilen.
  const fixSumme = arr.filter(a => a.fix && a.zaehler != null)
    .reduce((s, a) => s + a.zaehler, 0);
  const offene = arr.filter(a => !a.fix);
  let rest = nenner - fixSumme;
  if (rest < 0) rest = 0;
  if (offene.length > 0) {
    const basis = Math.floor(rest / offene.length);
    let uebrig = rest - basis * offene.length; // Differenz (0..offene.length-1)
    offene.forEach((a, k) => {
      // Differenz auf die LETZTEN verteilen (3+4 statt 4+3 → letzter bekommt mehr).
      const extra = (k >= offene.length - uebrig) ? 1 : 0;
      a.zaehler = basis + extra;
    });
  }

  // Zurückschreiben in eine neue Liste.
  const neu = liste.slice();
  arr.forEach(a => {
    neu[a.idx] = { ...neu[a.idx],
      quote: { zaehler: a.zaehler == null ? "" : a.zaehler, nenner: nenner },
      quoteFix: a.fix };
  });
  return neu;
}
// Die drei Stufen eines Käufer-Eintrags als Checkliste. „erledigt" ist jetzt
// DATUMSGESTEUERT: eine Stufe gilt erst als abgehakt, wenn ihr Datum gesetzt UND
// erreicht ist (≤ heute). Ein gesetztes Datum in der Zukunft → terminiert
// (Datum am Kreis sichtbar, aber noch kein Haken). „terminiert" markiert genau
// diesen Zwischenzustand.
function eigStufen(kaeufer) {
  const k = kaeufer || {};
  const heute = isoHeute();
  const erreicht = (d) => !!d && zuIsoDatum(d) <= heute;
  return [
    { key: "kaufabsicht", label: "Kaufabsicht",    datum: k.kaufabsichtAb,
      erledigt: erreicht(k.kaufabsichtAb), terminiert: !!k.kaufabsichtAb && !erreicht(k.kaufabsichtAb) },
    { key: "kosten",      label: "Lastenübergang", datum: k.kostenAb,
      erledigt: erreicht(k.kostenAb),      terminiert: !!k.kostenAb && !erreicht(k.kostenAb) },
    { key: "grundbuch",   label: "Grundbuch",      datum: k.von,
      erledigt: erreicht(k.von),           terminiert: !!k.von && !erreicht(k.von) },
  ];
}

// ── Eigentümergemeinschaft als Subjekt (L2a) ────────────────────────────────
// Konzept_Eigentuemergemeinschaft_L2.md, Weg A (Mittelweg). Mehrere Eigentümer
// einer Einheit können als EIN Rechtssubjekt auftreten (Erbengemeinschaft, GbR …)
// — mit einer Stimme und einem Vertreter. Additives Flag an der Einheit, die
// vorhandenen eigentuemer[]-Einträge bleiben die Mitglieder; ihre Quoten (L1)
// = Anteile innerhalb der Gemeinschaft.
const GEMEINSCHAFT_TYPEN = [
  { id: "erbengemeinschaft", label: "Erbengemeinschaft" },
  { id: "gbr",               label: "GbR" },
  { id: "bruchteil",         label: "Bruchteilsgemeinschaft" },
  { id: "guetergemeinschaft",label: "Eheliche Gütergemeinschaft" },
  { id: "sonstige",          label: "Sonstige Gemeinschaft" },
];
function gemeinschaftTypLabel(id) {
  const g = GEMEINSCHAFT_TYPEN.find(x => x.id === id);
  return g ? g.label : "Eigentümergemeinschaft";
}
// Bildet diese Einheit eine Eigentümergemeinschaft? (Flag gesetzt UND ≥2 aktive
// Eigentümer — eine „Gemeinschaft" aus einer Person ergibt keinen Sinn.)
function istEigentuemergemeinschaft(einheit) {
  if (!einheit || !einheit.eigentuemerGemeinschaft || !einheit.eigentuemerGemeinschaft.ist) return false;
  const aktive = (einheit.eigentuemer || []).filter(p => eigStatus(p) === "aktiv");
  return aktive.length >= 2;
}
// Anzeigename der Gemeinschaft: expliziter Name, sonst aus Typ + erstem Mitglied
// („Erbengemeinschaft Müller").
function gemeinschaftName(einheit) {
  const g = (einheit && einheit.eigentuemerGemeinschaft) || {};
  if (g.name && String(g.name).trim()) return String(g.name).trim();
  const aktive = (einheit.eigentuemer || []).filter(p => eigStatus(p) === "aktiv");
  const erster = aktive[0];
  const nach = erster ? extractNachname(erster.name || "") : "";
  return gemeinschaftTypLabel(g.typ) + (nach ? " " + nach : "");
}
// Der Vertreter-Eintrag der Gemeinschaft (handelt/unterschreibt) — per
// vertreterKontaktId, sonst der erste aktive Eigentümer als Fallback.
function gemeinschaftVertreter(einheit) {
  const g = (einheit && einheit.eigentuemerGemeinschaft) || {};
  const aktive = (einheit.eigentuemer || []).filter(p => eigStatus(p) === "aktiv");
  if (g.vertreterKontaktId != null) {
    const v = aktive.find(p => String(p.kontaktId) === String(g.vertreterKontaktId));
    if (v) return v;
  }
  return aktive[0] || null;
}
// Zustellanschrift der Gemeinschaft (L2b): explizite abweichende Adresse, sonst
// "" (Aufrufer fällt dann auf die Adresse des Vertreters zurück). Liefert die
// fertige Zeile inkl. „z. H."-Zusatz, wenn eine eigene Adresse gepflegt ist.
function gemeinschaftZustellAdresse(einheit) {
  const g = (einheit && einheit.eigentuemerGemeinschaft) || {};
  const z = g.zustellAdresse;
  if (z && String(z).trim()) return String(z).trim();
  return "";
}


// Alle Belegungen eines Teils für die Verlaufs-Anzeige, gruppiert nach Phase
// bezogen auf heute: zuerst das aktuell laufende Kapitel, dann geplante
// (aufsteigend nach Beginn), dann beendete (neueste zuerst). So steht oben
// immer „was jetzt gilt", darunter „was kommt", darunter „was war".
function belegungsHistorie(teil) {
  if (!teil || !Array.isArray(teil.belegungen)) return [];
  const rang = { aktuell: 0, geplant: 1, beendet: 2 };
  return teil.belegungen.slice().sort((a, b) => {
    const pa = rang[belegungsPhase(a)] ?? 3;
    const pb = rang[belegungsPhase(b)] ?? 3;
    if (pa !== pb) return pa - pb;
    // Innerhalb derselben Phase: geplant aufsteigend (nächstes zuerst),
    // aktuell/beendet absteigend (jüngstes zuerst).
    const ai = zuIsoDatum(a.von), bi = zuIsoDatum(b.von);
    return pa === 1 ? ai.localeCompare(bi) : bi.localeCompare(ai);
  });
}

// ── Belegungswechsel als VORGANG (2-Stufen-Stepper, analog Eigentümerwechsel) ─
// Stufe 1 (starten): legt eine GEPLANTE Folgebelegung an (geplant:true, noch
// ohne von). Der bisherige Bewohner bleibt unangetastet aktiv. Erscheint als
// werdende Karte. Stufe 2 (vollziehen): setzt das Auszugsdatum (und optional ein
// abweichendes Einzugsdatum → Leerstand dazwischen), beendet die alte Belegung
// und aktiviert die neue. Bricht man ab, wird die geplante Belegung entfernt.

// Die geplante (werdende, noch nicht vollzogene) Belegung eines Teils.
// „geplant" bedeutet: Teil eines laufenden Wechsel-Vorgangs. Solange das
// Übergangsdatum (von) noch nicht erreicht ist, bleibt der Vorgang sichtbar;
// ab Erreichen gilt die Belegung als normal aktiv (Flag wird ignoriert).
function geplanteBelegung(teil) {
  if (!teil || !Array.isArray(teil.belegungen)) return null;
  const heute = isoHeute();
  // Nur als „laufender Vorgang" zählen, wenn entweder noch kein Datum gesetzt
  // ist ODER das gesetzte Übergangsdatum noch in der Zukunft liegt.
  return teil.belegungen.find(b => b.geplant && (!b.von || zuIsoDatum(b.von) > heute)) || null;
}

// Stufe 1: Vorgang starten — geplante Belegung anlegen (kein Auszug des alten).
function starteBelegungswechsel(einheit, opts, teilIndex) {
  const ti0 = (typeof teilIndex === "number" && teilIndex >= 0) ? teilIndex : 0;
  const folgeTyp = opts.folgeTyp === "selbstnutzung" ? "selbstnutzung" : "vermietung";
  const folgeRecht = folgeTyp === "selbstnutzung" ? "eigennutzer" : "mieter";
  const nachfolger = opts.nachmieter || null;
  const teile = teileVon(einheit).map((teil, ti) => {
    if (ti !== ti0) return teil;
    const neu = neueBelegung(folgeTyp, ""); // noch kein von → geplant
    neu.geplant = true;
    if (nachfolger) {
      neu.haushalt = { mitglieder: [
        neuesHhMitglied(nachfolger.kontaktId != null ? nachfolger.kontaktId : null,
                        nachfolger.name || "", folgeRecht),
      ] };
    }
    return { ...teil, belegungen: [...(teil.belegungen || []), neu] };
  });
  return { ...einheit, teile };
}

// Stufe 2: Übergang TERMINIEREN — Auszugs-/Einzugsdatum setzen. Der Vorgang
// bleibt sichtbar (geplant-Flag bleibt), bis das Einzugsdatum erreicht ist; dann
// gilt die Belegung automatisch als aktiv (datumsgesteuert). Optional ein
// abweichendes (früheres) Auszugsdatum → Leerstand zwischen Auszug und Einzug.
function terminiereBelegungswechsel(einheit, opts, teilIndex) {
  const ti0 = (typeof teilIndex === "number" && teilIndex >= 0) ? teilIndex : 0;
  const einzug = opts.einzug || isoHeute();
  let auszug = opts.auszug || einzug;
  if (auszug > einzug) auszug = einzug; // Auszug nie nach Einzug
  const mitLeerstand = einzug > auszug;
  const teile = teileVon(einheit).map((teil, ti) => {
    if (ti !== ti0) return teil;
    const geplant = (teil.belegungen || []).find(b => b.geplant);
    if (!geplant) return teil;
    // Laufende (nicht-geplante, offene) Belegung zum Auszug beenden.
    const aktBel = aktiveBelegung({ belegungen: (teil.belegungen || []).filter(b => !b.geplant) });
    let belegungen = (teil.belegungen || []).map(b => {
      if (aktBel && b.id === aktBel.id && !b.bis) return { ...b, bis: auszug };
      return b;
    });
    // Geplante Belegung terminieren: von = Einzug setzen, geplant-Flag BLEIBT
    // (Vorgang läuft sichtbar weiter, bis das Datum erreicht ist).
    belegungen = belegungen.map(b => {
      if (b.id !== geplant.id) return b;
      const akt = { ...b, von: einzug };
      if (akt.mietvertrag) akt.mietvertrag = { ...akt.mietvertrag, von: einzug };
      return akt;
    });
    // Bei abweichendem Auszug: Leerstand-Kapitel für die Lücke einfügen.
    if (mitLeerstand) {
      belegungen.push(neueBelegung("leerstand", auszug, einzug));
    }
    return { ...teil, belegungen };
  });
  return { ...einheit, teile };
}

// Vorgang abbrechen: geplante Belegung entfernen und ein evtl. schon gesetztes
// Auszugsdatum am alten Bewohner zurücknehmen (alter bleibt aktiv).
function brecheBelegungswechselAb(einheit, teilIndex) {
  const ti0 = (typeof teilIndex === "number" && teilIndex >= 0) ? teilIndex : 0;
  const teile = teileVon(einheit).map((teil, ti) => {
    if (ti !== ti0) return teil;
    const g = (teil.belegungen || []).find(b => b.geplant);
    // Nicht-geplante Belegungen behalten; falls der Vorgang schon terminiert war
    // (alter hat bis = Einzug der geplanten), dieses bis zurücknehmen.
    const auszugWar = g && g.von ? zuIsoDatum(g.von) : null;
    let belegungen = (teil.belegungen || []).filter(b => !b.geplant);
    // Auch ein evtl. eingefügtes Leerstand-Kapitel des Vorgangs entfernen
    // (Leerstand, das exakt am terminierten Einzug endet).
    if (auszugWar) {
      belegungen = belegungen.filter(b => !(b.typ === "leerstand" && zuIsoDatum(b.bis) === auszugWar));
      belegungen = belegungen.map(b => {
        if (b.bis && zuIsoDatum(b.bis) === auszugWar) return { ...b, bis: "" };
        return b;
      });
    }
    return { ...teil, belegungen };
  });
  return { ...einheit, teile };
}

// Das Auszugsdatum eines laufenden (terminierten) Wechsel-Vorgangs, FALLS ein
// abweichender Auszug mit Leerstand-Lücke existiert. Erkennt das Leerstand-
// Kapitel, das genau am Einzug (von der geplanten Belegung) endet; dessen von
// ist der Auszug. Ohne Lücke (nahtlos) → null.
function vorgangAuszugsdatum(teil) {
  const g = geplanteBelegung(teil);
  if (!g || !g.von) return null;
  const einzugIso = zuIsoDatum(g.von);
  const lueck = (teil.belegungen || []).find(b =>
    b.typ === "leerstand" && !b.geplant && b.bis && zuIsoDatum(b.bis) === einzugIso);
  if (lueck && lueck.von && zuIsoDatum(lueck.von) < einzugIso) return lueck.von;
  return null;
}

// Eine Einheit kann in mehrere physische Teile zerfallen (z. B. Vorder-/Hinterhaus,
// aufgeteilte Wohnung). Jeder Teil trägt seine eigene Belegungs-Chronik.
// Diese Helfer arbeiten mutationsfrei und garantieren ≥1 Teil (Variante A).

// Neuen Teil hinzufügen (mit Default-Leerstand-Belegung). Gibt aktualisierte Einheit zurück.
// Beim ERSTEN Unterteilen (1 → 2 Teile) erbt Teil 1 die physischen Stammdaten der
// Einheit (Fläche, Zimmer, Lage, Räume), sofern er sie noch nicht trägt. So bleibt
// die bisherige Wohnung als „Teil 1" erhalten; der neue Teil startet leer.
function fuegeTeilHinzu(einheit, name) {
  let teile = teileVon(einheit).slice();
  if (teile.length === 1) {
    const t0 = teile[0];
    const leer = (v) => v == null || v === "";
    teile[0] = {
      ...t0,
      flaeche: !leer(t0.flaeche) ? t0.flaeche : (einheit.flaeche || ""),
      zimmer:  !leer(t0.zimmer)  ? t0.zimmer  : (einheit.zimmer  || ""),
      lage:    !leer(t0.lage)    ? t0.lage    : (einheit.lage    || ""),
      raeume:  (Array.isArray(t0.raeume) && t0.raeume.length > 0)
                 ? t0.raeume : (Array.isArray(einheit.raeume) ? einheit.raeume : []),
    };
  }
  teile.push(neuerTeil(name || ""));
  return { ...einheit, teile };
}

// Teil an Index entfernen. Der letzte verbleibende Teil wird NIE entfernt
// (Variante A: immer ≥1 Teil). Gibt aktualisierte Einheit zurück.
function entferneTeil(einheit, teilIndex) {
  const teile = teileVon(einheit);
  if (teile.length <= 1) return einheit;
  const neu = teile.filter((_, i) => i !== teilIndex);
  return { ...einheit, teile: neu.length > 0 ? neu : teile };
}

// ── Räume innerhalb eines Teils (Sondereigentum) ───────────────────────────
// Alle drei sind mutationsfrei und geben das aktualisierte teile-Array zurück.
function teilRaeume(teil) {
  return (teil && Array.isArray(teil.raeume)) ? teil.raeume : [];
}
function fuegeTeilRaum(teile, teilIndex, name, flaeche) {
  return teile.map((teil, i) => i === teilIndex
    ? { ...teil, raeume: [...teilRaeume(teil), neuerRaum(name || "", "")].map((r, j, arr) =>
        j === arr.length - 1 ? { ...r, flaeche: flaeche || "" } : r) }
    : teil);
}
function aendereTeilRaum(teile, teilIndex, raumId, daten) {
  return teile.map((teil, i) => i === teilIndex
    ? { ...teil, raeume: teilRaeume(teil).map(r =>
        String(r.id) === String(raumId) ? { ...r, ...daten } : r) }
    : teil);
}
function entferneTeilRaum(teile, teilIndex, raumId) {
  return teile.map((teil, i) => i === teilIndex
    ? { ...teil, raeume: teilRaeume(teil).filter(r => String(r.id) !== String(raumId)) }
    : teil);
}

// Zähler innerhalb eines Raums eines Teils. Alle mutationsfrei → neues teile-Array.
function fuegeRaumZaehler(teile, teilIndex, raumId) {
  return teile.map((teil, i) => i === teilIndex
    ? { ...teil, raeume: teilRaeume(teil).map(r =>
        String(r.id) === String(raumId)
          ? { ...r, zaehler: [...((r && Array.isArray(r.zaehler)) ? r.zaehler : []), neuerZaehler("")] }
          : r) }
    : teil);
}
function aendereRaumZaehler(teile, teilIndex, raumId, zaehlerId, daten) {
  return teile.map((teil, i) => i === teilIndex
    ? { ...teil, raeume: teilRaeume(teil).map(r =>
        String(r.id) === String(raumId)
          ? { ...r, zaehler: ((r && Array.isArray(r.zaehler)) ? r.zaehler : []).map(z =>
              String(z.id) === String(zaehlerId) ? { ...z, ...daten } : z) }
          : r) }
    : teil);
}
function entferneRaumZaehler(teile, teilIndex, raumId, zaehlerId) {
  return teile.map((teil, i) => i === teilIndex
    ? { ...teil, raeume: teilRaeume(teil).map(r =>
        String(r.id) === String(raumId)
          ? { ...r, zaehler: ((r && Array.isArray(r.zaehler)) ? r.zaehler : []).filter(z => String(z.id) !== String(zaehlerId)) }
          : r) }
    : teil);
}

// ── BewohnerEditKarte — ein Kontakt-Bewohner als aufklappbare Karte ─────────
// Eingeklappt: kompakte KontaktKarte (Avatar + Name + Rollen-Badges). Klick
// klappt auf und zeigt die BELEGUNGS-Felder (Recht + Vermerk) — diese gehören
// zur Belegung, nicht zum Kontakt-Profil — plus „Bewohner entfernen". Nur für
// Mitglieder MIT Kontakt; anonyme/namenlose Bewohner nutzen die Inline-Form.
function BewohnerEditKarte({ m, kontakt, t, farbe, isStellplatz, onUpdate, onRemove, onKontaktClick, kontakte = [], setKontakte = null }) {
  const [offen, setOffen] = useState(false);
  const rl = bewohnerRecht(m.recht);
  // Die Karte trägt die ROLLENFARBE der Person (Mieter grün, Eigennutzer blau …)
  // statt der Belegungs-Bereichsfarbe — konsistent mit Recht-Pille und Eck-Badge.
  farbe = rl.farbe;
  if (!offen) {
    return (
      <div style={{ position: "relative", marginBottom: 6, border: `1px solid ${farbe}30`,
        borderRadius: RAD.md, background: farbe + "08", overflow: "hidden" }}>
        <EckPille label={rl.label} farbe={rl.farbe} t={t}/>
        <KontaktKarte k={kontakt} t={t} aktiv={false} onClick={() => setOffen(true)} kompakt ohneRahmen/>
      </div>
    );
  }
  return (
    <div style={{ position: "relative", marginBottom: 6 }}>
      <EckPille label={rl.label} farbe={rl.farbe} t={t}/>
      <KontaktDetailKarte k={kontakt} t={t} accent={farbe}
        ves={[]} kontakte={kontakte || []} setKontakte={setKontakte}
        onUpdate={(updated) => setKontakte && setKontakte(prev =>
          prev.map(x => x.id === kontakt.id ? updated : x))}
        onGotoKontakt={(id) => onKontaktClick && onKontaktClick(id)}
        onKontaktClick={onKontaktClick}
        onKopfClick={() => setOffen(false)}
        embedded/>
      {/* Belegungs-spezifische Felder (gehören zur Belegung, nicht zum Kontakt) */}
      <div style={{ marginTop: 8, padding: "10px 12px", border: `1px solid ${farbe}30`,
        borderRadius: RAD.md, background: farbe + "08",
        display: "flex", flexDirection: "column", gap: 8 }}>
        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
          <span style={{ fontSize: FS.xs, color: t.sub, width: 64, flexShrink: 0 }}>
            {isStellplatz ? "Nutzung" : "Recht"}
          </span>
          <select value={m.recht || "mieter"} onChange={e => onUpdate(m.id, { recht: e.target.value })}
            style={{ flex: 1, background: t.surface, border: `1px solid ${t.border}`,
              borderRadius: RAD.sm, padding: "6px 8px", fontSize: 16,
              fontFamily: "inherit", color: t.text, minWidth: 0 }}>
            {BEWOHNER_RECHTE.map(r => <option key={r.id} value={r.id}>{r.label}</option>)}
          </select>
        </div>
        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
          <span style={{ fontSize: FS.xs, color: t.sub, width: 64, flexShrink: 0 }}>Vermerk</span>
          <input value={m.vermerk || ""} placeholder="optional"
            onChange={e => onUpdate(m.id, { vermerk: e.target.value })}
            style={{ flex: 1, background: t.surface, border: `1px solid ${t.border}`,
              borderRadius: RAD.sm, padding: "6px 8px", fontSize: 16,
              fontFamily: "inherit", color: t.text, minWidth: 0 }}/>
        </div>
        <button onClick={() => onRemove(m.id)}
          style={{ alignSelf: "flex-start", display: "flex", alignItems: "center", gap: 6,
            background: "transparent", border: "none", cursor: "pointer", color: "#EF4444",
            fontFamily: "inherit", fontSize: FS.s, fontWeight: FW.medium, padding: "2px 0" }}>
          <I name="x" size={15} color="#EF4444"/> {isStellplatz ? "Nutzer entfernen" : "Bewohner entfernen"}
        </button>
      </div>
    </div>
  );
}

// HaushaltEditor — bearbeitet die laufende Belegung + ihren Haushalt (Spec §3.3/§3.4).
// Belegungstyp umschaltbar (Vermietung/Selbstnutzung/Leerstand). Bewohner mit oder
// ohne Kontakt, Vermerk, anonyme Kopfzahl. Bei Vermietung: Vertragspartei + Konditionen.
// Bei Stellplatz: Belegung ja (kann vermietet sein), aber kein Bewohner-Haushalt.
function HaushaltEditor({ einheit, t, accent, kontakte = [], setKontakte, onChange, teilIndex = 0, onKontaktClick = null }) {
  const farbe = "#0080FF";
  const isStellplatz = isStellplatzTyp(einheit.typ);
  const teile = teileVon(einheit);
  const ti = (teilIndex >= 0 && teilIndex < teile.length) ? teilIndex : 0;
  const aktTeil = teile[ti];
  // Die HEUTE gültige Belegung (datumsbewusst): vor einem terminierten Auszug
  // bleibt der bisherige Bewohner aktiv, nicht das künftige Leerstand-Kapitel.
  const beleg = heuteLaufendeBelegung(aktTeil) || aktiveBelegung(aktTeil) || neueBelegung("leerstand");
  const typ = beleg.typ || "leerstand";
  const hh = beleg.haushalt || leererHaushalt();
  const [picker, setPicker] = useState(false); // Bewohner-Hinzufügen-Picker offen?
  // Belegungswechsel als VORGANG: Stufe 1 legt eine geplante Belegung an (Start-
  // Formular), Stufe 2 (Stepper) vollzieht den Übergang. startForm = Formular zum
  // Anlegen des Nachfolgers; null = geschlossen.
  const [startForm, setStartForm] = useState(null); // { nachId, nachName, folgeTyp } | null
  const geplant = geplanteBelegung(aktTeil);

  // Eine geänderte Belegung nach außen geben (am aktiven Teil ti).
  const commit = (neueBel) => { if (onChange) onChange(setzeAktiveBelegung(einheit, neueBel, ti)); };

  // Vorgang Stufe 1: geplante Folgebelegung anlegen (bisheriger bleibt aktiv).
  // Ist beim Start schon ein Übergangsdatum angegeben, wird der Vorgang gleich
  // mit-terminiert (einzug/auszug), sonst läuft er zunächst ohne Termin.
  const starteVorgang = (opts) => {
    let next = starteBelegungswechsel(einheit, opts, ti);
    if (opts.einzug) {
      next = terminiereBelegungswechsel(next, { einzug: opts.einzug, auszug: opts.auszug || opts.einzug }, ti);
    }
    if (onChange) onChange(next);
    setStartForm(null);
  };
  // Vorgang Stufe 2: Übergang vollziehen (Auszug alt, Einzug neu, ggf. Leerstand).
  const terminiereVorgang = (opts) => {
    if (onChange) onChange(terminiereBelegungswechsel(einheit, opts, ti));
  };
  // Vorgang abbrechen: geplante Belegung verwerfen.
  const abbrechenVorgang = () => {
    if (onChange) onChange(brecheBelegungswechselAb(einheit, ti));
  };

  const setzeTyp = (neuerTyp) => {
    if (neuerTyp === typ) return;
    // Bei Wechsel zu Leerstand bleibt kein Haushalt; sonst Haushalt erhalten.
    const basis = neueBelegung(neuerTyp, beleg.von || "");
    if (neuerTyp !== "leerstand") basis.haushalt = { ...hh, mitglieder: hh.mitglieder || [] };
    if (neuerTyp === "vermietung") {
      basis.vertragsparteiId = beleg.vertragsparteiId != null ? beleg.vertragsparteiId : null;
      basis.mietvertrag = beleg.mietvertrag || { von: beleg.von || "", kaution: "", hoehe: "", kuendigung: "" };
    }
    basis.id = beleg.id; // ID der laufenden Belegung behalten
    commit(basis);
  };

  // Standard-Recht je Belegungstyp (für neue & anonyme Bewohner).
  const standardRecht = typ === "vermietung" ? "mieter"
    : (typ === "selbstnutzung" ? "eigennutzer" : "mieter");

  const addMitglied = (kontaktId) => {
    const k = (kontakte || []).find(x => x.id === kontaktId);
    const neu = neuesHhMitglied(kontaktId, (k && k.name) || "", standardRecht);
    commit({ ...beleg, haushalt: { ...hh, mitglieder: [...(hh.mitglieder || []), neu] } });
    setPicker(false);
  };
  const addOhneKontakt = () => {
    // Zusätzliche Personen ohne Kontakt sind i. d. R. Angehörige (Kinder etc.).
    const neu = neuesHhMitglied(null, "", "angehoeriger", 1);
    commit({ ...beleg, haushalt: { ...hh, mitglieder: [...(hh.mitglieder || []), neu] } });
    setPicker(false);
  };
  const updateMitglied = (id, patch) => {
    commit({ ...beleg, haushalt: { ...hh,
      mitglieder: (hh.mitglieder || []).map(m => m.id === id ? { ...m, ...patch } : m) } });
  };
  const removeMitglied = (id) => {
    commit({ ...beleg, haushalt: { ...hh,
      mitglieder: (hh.mitglieder || []).filter(m => m.id !== id) } });
  };
  const setMitgliedAnzahl = (id, n) => {
    const m0 = (hh.mitglieder || []).find(x => x.id === id);
    const neu = Math.max(0, (Number(m0 && m0.anzahl) || 1) + n);
    if (neu <= 0) { removeMitglied(id); return; } // Anzahl 0 → Karte entfernen
    commit({ ...beleg, haushalt: { ...hh,
      mitglieder: (hh.mitglieder || []).map(m =>
        m.id === id ? { ...m, anzahl: neu } : m) } });
  };

  // Persistente anonyme Personen-Karte: ein REINES anonymes Mitglied (kontaktId
  // null, kein Name) trägt die „weitere Personen"-Zahl. Im Bearbeiten-Modus ist
  // die Karte immer sichtbar (Start 0); „+" legt das Mitglied bei Bedarf an, „−"
  // auf 0 entfernt es wieder — die Karte bleibt aber stehen.
  const anonMitglied = (hh.mitglieder || []).find(m => istAnonymesMitglied(m)) || null;
  const anonAnzahl = anonMitglied ? Math.max(1, Number(anonMitglied.anzahl) || 1) : 0;
  const setAnonAnzahl = (delta) => {
    if (!anonMitglied) {
      if (delta > 0) {
        const neu = neuesHhMitglied(null, "", "angehoeriger", delta);
        commit({ ...beleg, haushalt: { ...hh, mitglieder: [...(hh.mitglieder || []), neu] } });
      }
      return;
    }
    setMitgliedAnzahl(anonMitglied.id, delta);
  };


  const TYP_OPTS = [
    { id: "vermietung",    l: "Vermietung" },
    { id: "selbstnutzung", l: "Selbstnutzung" },
    { id: "leerstand",     l: "Leerstand" },
  ];

  // Weg 2: Status wird abgeleitet. „Bewohnt", sobald Bewohner existieren; sonst Leerstand.
  const hatBewohner = (hh.mitglieder || []).length > 0;
  const abgeleitet = abgeleiteterBelegungstyp(beleg);

  return (
    <div>
      {/* Status (abgeleitet aus den Parteien) + Belegungswechsel-Kapitel */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
        <span style={{ fontSize: FS.s, fontWeight: FW.bold, color: t.text }}>
          {isStellplatz ? "Nutzer" : "Bewohner"}
        </span>
        <span style={{ fontSize: FS.xxs, padding: "1px 8px", borderRadius: RAD.ms,
          background: farbe + "18", color: farbe, fontWeight: FW.medium }}>
          {abgeleitet === "vermietung" ? "Vermietet"
            : (abgeleitet === "selbstnutzung" ? (isStellplatz ? "Genutzt" : "Bewohnt") : "Leerstand")}
        </span>
      </div>

      {/* Belegungswechsel als Vorgang: läuft einer → Stepper; sonst, wenn das
          Start-Formular offen ist → Nachfolger anlegen (Stufe 1). */}
      {geplant ? (
        <BelegungswechselVorgang geplant={geplant}
          auszugDatum={vorgangAuszugsdatum(aktTeil)}
          alterBewohner={(() => {
            // Bisheriger Bewohner = die offene oder zuletzt beendete echte
            // (nicht-geplante, nicht-Leerstand) Belegung mit benanntem Mitglied.
            const echte = (aktTeil.belegungen || []).filter(b => !b.geplant && b.typ !== "leerstand");
            const ab = echte.filter(b => !b.bis).sort((a,b)=>zuIsoDatum(b.von).localeCompare(zuIsoDatum(a.von)))[0]
              || echte.slice().sort((a,b)=>zuIsoDatum(b.bis||b.von).localeCompare(zuIsoDatum(a.bis||a.von)))[0];
            const m = ab && (ab.haushalt && ab.haushalt.mitglieder || []).find(x => !istAnonymesMitglied(x));
            return m ? m.name : "";
          })()}
          neuerBewohner={(() => {
            const m = (geplant.haushalt && geplant.haushalt.mitglieder || []).find(x => !istAnonymesMitglied(x));
            return m ? m.name : "";
          })()}
          farbe={farbe} t={t} editierbar={true}
          onTerminieren={terminiereVorgang} onAbbrechen={abbrechenVorgang}/>
      ) : startForm ? (() => {
        const folgeTyp = startForm.folgeTyp === "selbstnutzung" ? "selbstnutzung" : "vermietung";
        const istSelbst = folgeTyp === "selbstnutzung";
        // Bei Selbstnutzung ist der Nutzer per Definition der aktuelle Eigentümer
        // der Einheit — keine Auswahl nötig. Bei Vermietung wird ein Nachmieter
        // ausgewählt.
        const aktEig = (Array.isArray(einheit.eigentuemer) ? einheit.eigentuemer : [])
          .find(e => !e.bis && (e.status ? e.status === "aktiv" : true))
          || (einheit.eigentuemer || []).find(e => !e.bis) || null;
        const eigKontakt = aktEig && aktEig.kontaktId != null
          ? (kontakte || []).find(k => k.id === aktEig.kontaktId) : null;
        const eigName = (eigKontakt && eigKontakt.name) || (aktEig && aktEig.name) || "";
        const hatNach = istSelbst ? !!aktEig : (startForm.nachId != null || !!startForm.nachName);
        return (
        <div style={{ border: `1px solid ${farbe}40`, background: farbe + "08",
          borderRadius: RAD.md, padding: 10, marginBottom: 12 }}>
          <div style={{ fontSize: FS.s, fontWeight: FW.bold, color: t.text, marginBottom: 8 }}>
            Belegungswechsel starten
          </div>
          {/* Typ-Schalter */}
          <div style={{ fontSize: FS.xs, color: t.sub, marginBottom: 4 }}>Neue Belegung als</div>
          <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
            {[{ id: "vermietung", l: "Vermietung" }, { id: "selbstnutzung", l: "Selbstnutzung" }].map(o => {
              const aktiv = folgeTyp === o.id;
              return (
                <button key={o.id} onClick={() => setStartForm(f => ({ ...f, folgeTyp: o.id }))}
                  style={{ flex: 1, padding: "7px 0", borderRadius: RAD.sm, cursor: "pointer",
                    fontFamily: "inherit", fontSize: FS.s, fontWeight: FW.medium,
                    background: aktiv ? farbe + "22" : t.surface,
                    border: `1px solid ${aktiv ? farbe + "80" : t.border}`,
                    color: aktiv ? farbe : t.sub }}>{o.l}</button>
              );
            })}
          </div>
          {/* Bei Vermietung: Picker. Bei Selbstnutzung: Eigentümer-Hinweis. */}
          {istSelbst ? (
            <div style={{ fontSize: FS.s, color: t.sub, marginBottom: 8,
              padding: "8px 10px", background: t.surface, borderRadius: RAD.sm,
              border: `1px solid ${t.border}` }}>
              {eigName
                ? <>Nutzer: <b style={{ color: t.text }}>{eigName}</b> <span style={{ color: t.muted }}>(Eigentümer)</span></>
                : <span style={{ color: "#EF4444" }}>Kein aktiver Eigentümer hinterlegt — bitte erst im Eigentümer-Tab anlegen.</span>}
            </div>
          ) : (
            <>
              <div style={{ fontSize: FS.xs, color: t.sub, marginBottom: 2 }}>Neuer Nutzer</div>
              <div style={{ marginBottom: 10 }}>
                <KontaktPicker value={startForm.nachId || null}
                  onChange={(id) => { const k = (kontakte || []).find(x => x.id === id);
                    setStartForm(f => ({ ...f, nachId: id, nachName: (k && k.name) || "" })); }}
                  label="" t={t} accent={farbe} editMode={true}
                  kontakte={kontakte || []} setKontakte={setKontakte}/>
              </div>
            </>
          )}

          {/* Übergangsdatum — optional. Bekannt → gleich eintragen; sonst leer
              lassen (Vorgang läuft ohne Termin, Datum später nachtragen). */}
          <div style={{ fontSize: FS.xs, color: t.sub, marginBottom: 2 }}>
            {startForm.getrennt ? "Einzug am" : "Übergangsdatum (optional)"}
          </div>
          <div style={{ marginBottom: startForm.getrennt ? 8 : 4 }}>
            <DatumFeld value={startForm.einzug || null}
              onChange={d => setStartForm(f => ({ ...f, einzug: d }))}
              t={t} accent={farbe} iso defaultHeute={false}/>
          </div>
          {startForm.getrennt && (
            <>
              <div style={{ fontSize: FS.xs, color: t.sub, marginBottom: 2 }}>Auszug bisheriger Bewohner am</div>
              <div style={{ marginBottom: 4 }}>
                <DatumFeld value={startForm.auszug || null}
                  onChange={d => setStartForm(f => ({ ...f, auszug: d }))}
                  t={t} accent={farbe} iso defaultHeute={false}/>
              </div>
              {startForm.auszug && startForm.einzug && startForm.auszug > startForm.einzug && (
                <div style={{ fontSize: FS.xxs, color: "#EF4444", marginBottom: 4 }}>
                  Auszug darf nicht nach dem Einzug liegen.
                </div>
              )}
            </>
          )}
          {/* Toggle nur sinnvoll, wenn ein Einzugsdatum gesetzt ist */}
          {startForm.einzug && (
            <button onClick={() => setStartForm(f => ({ ...f, getrennt: !f.getrennt,
              auszug: f.getrennt ? null : f.einzug }))}
              style={{ background: "transparent", border: "none", cursor: "pointer",
                color: farbe, fontSize: FS.xs, fontWeight: FW.medium, fontFamily: "inherit",
                padding: "2px 0", marginBottom: 6 }}>
              {startForm.getrennt ? "− Gleiches Datum für Auszug und Einzug" : "+ Abweichendes Auszugsdatum (Leerstand)"}
            </button>
          )}

          <div style={{ fontSize: FS.xs, color: t.sub, margin: "4px 0 8px", lineHeight: 1.4 }}>
            {startForm.einzug
              ? <>Legt {istSelbst ? "die Selbstnutzung" : "den neuen Nutzer"} an und terminiert den Übergang. Wird automatisch wirksam am gewählten Datum.</>
              : <>Legt {istSelbst ? "die Selbstnutzung" : "den neuen Nutzer"} als „werdend" an. Der bisherige Bewohner bleibt aktiv. Das Übergangsdatum kannst du auch später eintragen.</>}
          </div>
          <div style={{ display: "flex", gap: 6 }}>
            <AktionsButton variante="breit" rolle="abbrechen" onClick={() => setStartForm(null)}
              text="Abbrechen" icon={false} flex={1} t={t} accent={farbe}/>
            <AktionsButton variante="breit" rolle="bestaetigen"
              disabled={!hatNach || !!(startForm.getrennt && startForm.auszug && startForm.einzug && startForm.auszug > startForm.einzug)}
              onClick={() => starteVorgang({ folgeTyp,
                nachmieter: istSelbst
                  ? { kontaktId: aktEig && aktEig.kontaktId != null ? aktEig.kontaktId : null, name: eigName }
                  : { kontaktId: startForm.nachId != null ? startForm.nachId : null,
                      name: startForm.nachName || "" },
                einzug: startForm.einzug || null,
                auszug: startForm.getrennt ? (startForm.auszug || startForm.einzug) : startForm.einzug })}
              text={startForm.einzug ? "Vorgang starten & terminieren" : "Vorgang starten"}
              icon={false} flex={2} t={t} accent={farbe}/>
          </div>
        </div>
        );
      })() : null}

      {/* Leerstand-Hinweis: wenn aktuell kein benannter Bewohner mit Kontakt da
          ist (Leerstand), das auch im Bearbeiten-Modus deutlich machen. */}
      {(hh.mitglieder || []).filter(m => !istAnonymesMitglied(m)).length === 0 && (
        <div style={{ fontSize: FS.s, color: t.muted, textAlign: "center",
          padding: "12px 0", fontStyle: "italic" }}>
          Leerstand · {isStellplatz ? "kein Nutzer" : "keine Bewohner"}
        </div>
      )}

      {/* Partei-Liste. Mitglieder MIT Kontakt → aufklappbare BewohnerEditKarte.
          Anonyme/namenlose (ohne Kontakt) → Inline-Form (Anzahl-Stepper bzw. Name).
          Die Vertragspartei wird aus dem Mieter-Bewohner abgeleitet (kein separater
          Picker mehr) — die Kontaktkarte selbst ist die Quelle. */}
      {(hh.mitglieder || []).filter(m => !istAnonymesMitglied(m)).map(m => {
        const anonymKarte = istAnonymesMitglied(m);
        const az = Math.max(1, Number(m.anzahl) || 1);
        const kontakt = (m.kontaktId != null) ? (kontakte || []).find(k => k.id === m.kontaktId) : null;
        // Kontakt-Bewohner: kompakte, aufklappbare Karte.
        if (kontakt) {
          return (
            <BewohnerEditKarte key={m.id} m={m} kontakt={kontakt} t={t} farbe={farbe}
              isStellplatz={isStellplatz} onUpdate={updateMitglied} onRemove={removeMitglied}
              onKontaktClick={onKontaktClick} kontakte={kontakte} setKontakte={setKontakte}/>
          );
        }
        return (
        <div key={m.id} style={{ display: "flex", alignItems: "flex-start", gap: 8,
          background: farbe + "08", border: `1px solid ${farbe}30`,
          borderRadius: RAD.md, marginBottom: 6, padding: "8px 10px" }}>
          <div style={{ width: 28, height: 28, borderRadius: RAD.full, flexShrink: 0,
            background: anonymKarte ? t.bg : "transparent",
            border: anonymKarte ? `1px solid ${t.border}` : "none",
            display: "flex", alignItems: "center", justifyContent: "center" }}>
            {anonymKarte
              ? <span style={{ fontSize: FS.s, fontWeight: FW.bold, color: t.sub }}>+{az}</span>
              : <Avatar name={m.name || "?"} size={28} accent={bewohnerRecht(m.recht).farbe}/>}
          </div>
          <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 4 }}>
            {anonymKarte ? (
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ flex: 1, fontSize: FS.s, color: t.sub }}>
                  Personen ohne Kontakt (z. B. Kinder)
                </span>
                <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
                  <button onClick={() => setMitgliedAnzahl(m.id, -1)} style={{ width: 28, height: 28,
                    borderRadius: RAD.sm, border: `1px solid ${t.border}`, background: t.surface,
                    cursor: "pointer", fontSize: 18, color: t.sub, fontFamily: "inherit", lineHeight: 1 }}>−</button>
                  <span style={{ minWidth: 22, textAlign: "center", fontSize: FS.m, fontWeight: FW.bold, color: t.text }}>{az}</span>
                  <button onClick={() => setMitgliedAnzahl(m.id, 1)} style={{ width: 28, height: 28,
                    borderRadius: RAD.sm, border: `1px solid ${t.border}`, background: t.surface,
                    cursor: "pointer", fontSize: 18, color: t.sub, fontFamily: "inherit", lineHeight: 1 }}>+</button>
                </div>
              </div>
            ) : (
              <input value={m.name || ""} placeholder="Name"
                onChange={e => updateMitglied(m.id, { name: e.target.value })}
                style={{ background: t.surface, border: `1px solid ${t.border}`,
                  borderRadius: RAD.sm, padding: "5px 8px", fontSize: 16,
                  fontFamily: "inherit", color: t.text, minWidth: 0 }}/>
            )}
            <div style={{ display: "flex", gap: 6 }}>
              <input value={m.vermerk || ""} placeholder="Vermerk (optional)"
                onChange={e => updateMitglied(m.id, { vermerk: e.target.value })}
                style={{ flex: 1, background: t.surface, border: `1px solid ${t.border}`,
                  borderRadius: RAD.sm, padding: "5px 8px", fontSize: 16,
                  fontFamily: "inherit", color: t.sub, minWidth: 0 }}/>
            </div>
          </div>
          {!anonymKarte && (
            <button onClick={() => removeMitglied(m.id)}
              title={isStellplatz ? "Nutzer entfernen" : "Bewohner entfernen"}
              style={{ flexShrink: 0, width: 30, height: 30, display: "flex",
                alignItems: "center", justifyContent: "center", background: "transparent",
                border: "none", cursor: "pointer", color: "#EF4444", fontFamily: "inherit",
                padding: 0 }}>
              <I name="x" size={16} color="#EF4444"/>
            </button>
          )}
        </div>
        );
      })}

      {/* Persistente „weitere Personen"-Karte (anonym, ohne Kontakt). Im
          Bearbeiten-Modus immer sichtbar (auch bei 0), damit man jederzeit
          Angehörige ohne eigene Kontaktkarte (z. B. Kinder) hochzählen kann.
          Layout 1:1 wie KontaktKarte: 48er-Avatar-Slot, Name in KONTAKTE_FARBE,
          „ohne Kontakt" als Detail-Zeile. Stepper rechts (statt Rollen-Badges). */}
      <div style={{ border: `1px solid ${t.border}`, borderRadius: RAD.lg,
        overflow: "hidden", marginBottom: 6 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12,
          padding: "10px 12px", boxSizing: "border-box", background: t.card }}>
          <div style={{ width: 48, flexShrink: 0, display: "flex",
            alignItems: "center", justifyContent: "center" }}>
            <div style={{ width: 38, height: 38, borderRadius: "50%", flexShrink: 0,
              boxSizing: "border-box", background: KONTAKTE_FARBE + "22",
              border: `1.5px solid ${KONTAKTE_FARBE}40`, display: "flex",
              alignItems: "center", justifyContent: "center",
              fontSize: 38 * 0.36, fontWeight: FW.bold, color: KONTAKTE_FARBE }}>
              +{anonAnzahl}
            </div>
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: FS.l, fontWeight: FW.heavy, color: KONTAKTE_FARBE,
              overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {anonAnzahl} {anonAnzahl === 1 ? "Person" : "Personen"}
            </div>
            <div style={{ fontSize: FS.s, color: t.sub, marginTop: 1 }}>ohne Kontakt</div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
            <button onClick={() => setAnonAnzahl(-1)} disabled={anonAnzahl === 0}
              style={{ width: 28, height: 28, borderRadius: RAD.sm,
                border: `1px solid ${t.border}`, background: t.surface,
                cursor: anonAnzahl === 0 ? "default" : "pointer", opacity: anonAnzahl === 0 ? 0.4 : 1,
                fontSize: 18, color: t.sub, fontFamily: "inherit", lineHeight: 1 }}>−</button>
            <span style={{ minWidth: 22, textAlign: "center", fontSize: FS.m, fontWeight: FW.bold, color: t.text }}>{anonAnzahl}</span>
            <button onClick={() => setAnonAnzahl(1)}
              style={{ width: 28, height: 28, borderRadius: RAD.sm,
                border: `1px solid ${t.border}`, background: t.surface,
                cursor: "pointer", fontSize: 18, color: t.sub, fontFamily: "inherit", lineHeight: 1 }}>+</button>
          </div>
        </div>
      </div>

      {/* Werdende (geplante) Bewohner — auch im Bearbeiten-Modus als eigene
          (leicht ausgegraute, klickbare) Karten, damit der kommende Mieter/Nutzer
          mit Kontaktdaten erreichbar ist (konsistent zur Lese-Ansicht). */}
      {geplant && geplant.haushalt && (geplant.haushalt.mitglieder || []).length > 0 && (
        <div style={{ marginTop: 4, marginBottom: 6 }}>
          <div style={{ fontSize: FS.xxs, fontWeight: FW.bold, color: t.muted,
            textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>
            Werdend{geplant.von ? ` · ab ${datumDe(geplant.von) || geplant.von}` : ""}
          </div>
          {(geplant.haushalt.mitglieder || []).map((wm, wi) => {
            const wanon = istAnonymesMitglied(wm);
            const wkontakt = (!wanon && wm.kontaktId != null) ? (kontakte || []).find(k => k.id === wm.kontaktId) : null;
            return (
              <WerdendKarte key={(wm.id || wi) + "-we"} m={wm} kontakt={wkontakt} t={t}
                kontakte={kontakte} setKontakte={setKontakte} onKontaktClick={onKontaktClick}/>
            );
          })}
        </div>
      )}

      {/* Partei hinzufügen */}
      {picker ? (
        <div style={{ border: `1px solid ${farbe}30`, borderRadius: RAD.md, padding: 8, marginBottom: 6 }}>
          <KontaktPicker value={null} onChange={addMitglied}
            label={isStellplatz ? "Nutzer aus Kontakten wählen" : "Bewohner aus Kontakten wählen"} t={t} accent={farbe}
            kontakte={kontakte} setKontakte={setKontakte}/>
          <div style={{ display: "flex", gap: 6, marginTop: 6 }}>
            <AktionsButton variante="breit" rolle="abbrechen" onClick={() => setPicker(false)}
              text="Abbrechen" icon={false} flex={1} t={t} accent={farbe}/>
            <AktionsButton variante="breit" rolle="bestaetigen" onClick={addOhneKontakt}
              text="Mit Namen (ohne Kontakt)" icon={false} flex={2} t={t} accent={farbe}/>
          </div>
        </div>
      ) : (
        <div style={{ display: "flex", gap: 8, marginTop: 2, marginBottom: 6 }}>
          <button onClick={() => setPicker(true)} style={{
            flex: 1, display: "flex", alignItems: "center", gap: 6, justifyContent: "center",
            background: farbe + "10", border: `1px solid ${farbe}30`,
            borderRadius: RAD.md, padding: "8px 0", cursor: "pointer",
            color: farbe, fontSize: FS.s, fontWeight: FW.medium, fontFamily: "inherit" }}>
            <I name="plus" size={14} color={farbe}/> {isStellplatz ? "Nutzer hinzufügen" : "Bewohner hinzufügen"}
          </button>
          {/* „Belegungswechsel" startet den Vorgang — nur wenn keiner läuft und
              das Start-Formular nicht schon offen ist. */}
          {!geplant && !startForm && (
            <button onClick={() => setStartForm({ folgeTyp: "vermietung" })} style={{
              flex: 1, display: "flex", alignItems: "center", gap: 6, justifyContent: "center",
              background: farbe + "10", border: `1px solid ${farbe}30`,
              borderRadius: RAD.md, padding: "8px 0", cursor: "pointer",
              color: farbe, fontSize: FS.s, fontWeight: FW.medium, fontFamily: "inherit" }}>
              <I name="swap" size={14} color={farbe}/> Belegungswechsel
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ── BewohnerLeseKarte — Kontakt-Bewohner read-only, aufklappbar ─────────────
// Eingeklappt: kompakte KontaktKarte. Aufgeklappt: Recht-Badge + Vermerk (ohne
// Bearbeiten). Pendant zu BewohnerEditKarte für die Anzeige.
function BewohnerLeseKarte({ m, kontakt, t, farbe, onKontaktClick, kontakte = [], setKontakte = null }) {
  const [offen, setOffen] = useState(false);
  const rl = bewohnerRecht(m.recht);
  // Karte in der ROLLENFARBE der Person (s. BewohnerEditKarte).
  farbe = rl.farbe;
  if (!offen) {
    return (
      <div style={{ position: "relative", marginBottom: 6, border: `1px solid ${farbe}30`,
        borderRadius: RAD.md, background: farbe + "08", overflow: "hidden" }}>
        <EckPille label={rl.label} farbe={rl.farbe} t={t}/>
        <KontaktKarte k={kontakt} t={t} aktiv={false} onClick={() => setOffen(true)} kompakt ohneRahmen/>
      </div>
    );
  }
  return (
    <div style={{ position: "relative", marginBottom: 6 }}>
      <EckPille label={rl.label} farbe={rl.farbe} t={t}/>
      <KontaktDetailKarte k={kontakt} t={t} accent={farbe}
        ves={[]} kontakte={kontakte || []} setKontakte={setKontakte}
        onUpdate={(updated) => setKontakte && setKontakte(prev =>
          prev.map(x => x.id === kontakt.id ? updated : x))}
        onGotoKontakt={(id) => onKontaktClick && onKontaktClick(id)}
        onKontaktClick={onKontaktClick}
        onKopfClick={() => setOffen(false)}
        embedded/>
      {m.vermerk && (
        <div style={{ display: "flex", gap: 6, padding: "6px 12px 0" }}>
          <span style={{ fontSize: FS.xs, color: t.sub, width: 64, flexShrink: 0 }}>Vermerk</span>
          <span style={{ fontSize: FS.s, color: t.text }}>{m.vermerk}</span>
        </div>
      )}
    </div>
  );
}

// HaushaltAnzeige — zeigt die Bewohner der aktuell laufenden Belegung (Spec §6).
// Rollen-blind: jedes Mitglied ist „wer hier lebt", mit optionalem Vermerk
// (z. B. „Mieter", „Partnerin"). Anonyme Kopfzahl als „+N". Bei Leerstand:
// Hinweis statt Liste. Bei laufender Vermietung wird zusätzlich der Mietvertrag
// (Vertragspartei/Konditionen) gezeigt — automatisch, weil Belegung.typ es trägt.
// Reine Anzeige (read-only); das Editieren folgt im nächsten Teilstück.
// Eine werdende (geplante) Bewohner-Karte: eingeklappt leicht ausgegraut mit
// „werdend"-Pille; beim Anklicken klappt der Kontakt normal (nicht ausgegraut)
// über die eingebettete KontaktDetailKarte auf.
function WerdendKarte({ m, kontakt, t, kontakte = [], setKontakte = null, onKontaktClick = null }) {
  const [offen, setOffen] = useState(false);
  const anon = istAnonymesMitglied(m);
  const az = Math.max(1, Number(m.anzahl) || 1);
  const rl = bewohnerRecht(m.recht);
  // Aufgeklappt: voller Kontakt (nicht ausgegraut), wie bei BewohnerLeseKarte.
  if (offen && kontakt) {
    return (
      <div style={{ position: "relative", marginBottom: 6 }}>
        <EckPille label="werdend" farbe="#3B82F6" t={t}/>
        <KontaktDetailKarte k={kontakt} t={t} accent={rl.farbe}
          ves={[]} kontakte={kontakte || []} setKontakte={setKontakte}
          onUpdate={(u) => setKontakte && setKontakte(prev => prev.map(x => x.id === kontakt.id ? u : x))}
          onGotoKontakt={(id) => onKontaktClick && onKontaktClick(id)}
          onKontaktClick={onKontaktClick}
          onKopfClick={() => setOffen(false)}
          embedded/>
      </div>
    );
  }
  // Eingeklappt mit Kontakt: identisches Layout wie BewohnerLeseKarte
  // (KontaktKarte kompakt + Rollenfarb-Rahmen), nur leicht ausgegraut.
  if (kontakt) {
    return (
      <div style={{ position: "relative", marginBottom: 6, border: `1px solid ${rl.farbe}30`,
        borderRadius: RAD.md, background: rl.farbe + "08", overflow: "hidden",
        opacity: 0.7 }}>
        <EckPille label="werdend" farbe="#3B82F6" t={t}/>
        <KontaktKarte k={kontakt} t={t} aktiv={false} onClick={() => setOffen(true)} kompakt ohneRahmen/>
      </div>
    );
  }
  // Anonyme werdende Person (kein Kontakt): kompakte Zeile, leicht ausgegraut.
  return (
    <div style={{ border: `1px solid ${t.border}`, borderRadius: RAD.md, marginBottom: 6,
      display: "flex", alignItems: "center", gap: 10, padding: "8px 12px",
      background: t.surface, opacity: 0.7 }}>
      <div style={{ width: 30, height: 30, borderRadius: "50%", flexShrink: 0,
        boxSizing: "border-box", background: KONTAKTE_FARBE + "22",
        border: `1.5px solid ${KONTAKTE_FARBE}40`, display: "flex",
        alignItems: "center", justifyContent: "center", fontSize: 30 * 0.36,
        fontWeight: FW.bold, color: KONTAKTE_FARBE }}>+{az}</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: FS.m, fontWeight: FW.bold, color: t.sub,
          display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
          {`${az} ${az === 1 ? "Person" : "Personen"}`}
          <span style={{ fontSize: FS.xxs, padding: "1px 7px", borderRadius: RAD.ms,
            background: "#3B82F618", color: "#3B82F6", fontWeight: FW.medium }}>werdend</span>
        </div>
      </div>
    </div>
  );
}

function HaushaltAnzeige({ einheit, t, accent, kontakte = [], teilIndex = 0, onKontaktClick = null, setKontakte = null }) {
  const farbe = "#0080FF"; // Bewohner-Akzent (wie bisher der Mieter-Bereich)
  const kontaktFarben = useKontaktFarbe(); // konfigurierbare Personen-/Firmen-Akzentfarbe
  const personFarbe = kontaktFarben.person; // wie echte KontaktKarte (Avatar + Name)
  const teile = teileVon(einheit);
  const ti = (teilIndex >= 0 && teilIndex < teile.length) ? teilIndex : 0;
  // Hauptanzeige zeigt den HEUTE laufenden Zustand (nicht eine erst künftig
  // beginnende Belegung). Eine geplante Folgebelegung wird separat als Hinweis
  // angekündigt, damit der kommende Mieter/Nutzer trotzdem sichtbar ist.
  const beleg = heuteLaufendeBelegung(teile[ti]);
  const typ = beleg ? abgeleiteterBelegungstyp(beleg) : "leerstand";
  const hh = (beleg && beleg.haushalt) || leererHaushalt();
  const mitglieder = (hh.mitglieder || []);
  const anzahl = haushaltKopfzahl(hh);
  const hatMieter = mitglieder.some(m => m && istVertragspartei(m.recht));
  const istSP = isStellplatzTyp(einheit.typ);

  // Laufender Belegungswechsel-Vorgang (datumsgesteuert erkannt): im Lese-Modus
  // als read-only Stepper anzeigen (statt des kompakten Banners). Zeigt Parteien,
  // Fortschritt, Datum und ggf. Leerstand-Stufe — ohne Aktions-Buttons.
  const vorgangBeleg = geplanteBelegung(teile[ti]);
  const vorgangAuszug = vorgangBeleg ? vorgangAuszugsdatum(teile[ti]) : null;
  const VorgangAnzeige = vorgangBeleg ? (
    <BelegungswechselVorgang geplant={vorgangBeleg} auszugDatum={vorgangAuszug}
      alterBewohner={(() => {
        const echte = (teile[ti].belegungen || []).filter(b => !b.geplant && b.typ !== "leerstand");
        const ab = echte.filter(b => !b.bis).sort((a,b)=>zuIsoDatum(b.von).localeCompare(zuIsoDatum(a.von)))[0]
          || echte.slice().sort((a,b)=>zuIsoDatum(b.bis||b.von).localeCompare(zuIsoDatum(a.bis||a.von)))[0];
        const m = ab && (ab.haushalt && ab.haushalt.mitglieder || []).find(x => !istAnonymesMitglied(x));
        return m ? m.name : "";
      })()}
      neuerBewohner={(() => {
        const m = (vorgangBeleg.haushalt && vorgangBeleg.haushalt.mitglieder || []).find(x => !istAnonymesMitglied(x));
        return m ? m.name : "";
      })()}
      farbe={farbe} t={t} editierbar={false}/>
  ) : null;

  // Geplante Folgebelegung (Phase "geplant", frühester Beginn) für den Banner.
  const geplant = (teile[ti] && Array.isArray(teile[ti].belegungen))
    ? teile[ti].belegungen
        .filter(b => belegungsPhase(b) === "geplant" && b.typ !== "leerstand")
        .sort((a, b) => zuIsoDatum(a.von).localeCompare(zuIsoDatum(b.von)))[0] || null
    : null;
  const geplantInfo = (() => {
    if (!geplant) return null;
    const ghh = geplant.haushalt || leererHaushalt();
    const namen = (ghh.mitglieder || []).filter(m => !istAnonymesMitglied(m)).map(m => m.name).filter(Boolean);
    const wort = geplant.typ === "vermietung" ? "vermietet an" : "Selbstnutzung durch";
    return { ab: datumAnzeige(geplant.von), wort, namen: namen.join(", "),
             leer: geplant.typ === "vermietung" ? "vermietet" : "Selbstnutzung" };
  })();
  // Banner nur zeigen, wenn KEIN voller Vorgang-Stepper angezeigt wird (sonst doppelt).
  const GeplantBanner = (geplantInfo && !VorgangAnzeige) ? (
    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8,
      padding: "8px 10px", background: "#3B82F60F", border: "1px solid #3B82F633",
      borderRadius: RAD.md }}>
      <I name="swap" size={14} color="#3B82F6"/>
      <div style={{ fontSize: FS.xs, color: t.sub, lineHeight: 1.4 }}>
        <b style={{ color: "#3B82F6" }}>Ab {geplantInfo.ab}</b>{" "}
        {geplantInfo.namen ? `${geplantInfo.wort} ${geplantInfo.namen}` : geplantInfo.leer}
      </div>
    </div>
  ) : null;

  // Werdende Bewohner-Liste nur, wenn KEIN voller Vorgang-Stepper läuft (der
  // zeigt den werdenden Nutzer bereits in den Parteien). Bei rein geplanter
  // Belegung ohne laufenden Vorgang (Altdaten) weiterhin als Karten.
  // Werdende Bewohner als eigene (ausgegraute, klickbare) Karten — auch während
  // der Vorgang-Stepper läuft. So ist der werdende Mieter/Nutzer schon mit vollen
  // Kontaktdaten erreichbar (Vorab-Fragen), nicht nur als Name im Stepper.
  const werdendeMitglieder = (geplant && geplant.haushalt && geplant.haushalt.mitglieder) || [];
  const WerdendListe = werdendeMitglieder.length > 0 ? (
    <div style={{ marginTop: 6 }}>
      <div style={{ fontSize: FS.xs, fontWeight: FW.bold, color: t.muted,
        textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>
        Werdend{geplant.von ? ` · ab ${datumAnzeige(geplant.von)}` : ""}
      </div>
      {werdendeMitglieder.map((m, i) => {
        const anon = istAnonymesMitglied(m);
        const kontakt = (!anon && m.kontaktId != null) ? (kontakte || []).find(k => k.id === m.kontaktId) : null;
        return (
          <WerdendKarte key={(m.id || i) + "-w"} m={m} kontakt={kontakt} t={t}
            kontakte={kontakte} setKontakte={setKontakte} onKontaktClick={onKontaktClick}/>
        );
      })}
    </div>
  ) : null;

  if (typ === "leerstand") {
    const leerSeit = beleg && beleg.von ? (datumDe(beleg.von) || beleg.von) : null;
    return (
      <div>
        {VorgangAnzeige}
        {GeplantBanner}
        <div style={{ marginBottom: 8, padding: "10px 12px", background: t.bg,
          border: `1px solid ${t.border}`, borderRadius: RAD.md }}>
          <div style={{ fontSize: FS.s, fontWeight: FW.bold, color: t.text, marginBottom: leerSeit ? 6 : 0 }}>
            Leerstand
          </div>
          {leerSeit ? (
            <div style={{ display: "flex", gap: 8, fontSize: FS.s, padding: "2px 0" }}>
              <span style={{ width: 110, color: t.sub, flexShrink: 0 }}>Leer seit</span>
              <span style={{ color: t.text, fontWeight: FW.medium }}>{leerSeit}</span>
            </div>
          ) : (
            <div style={{ fontSize: FS.s, color: t.muted, fontStyle: "italic" }}>
              {istSP ? "Kein Nutzer" : "Keine Bewohner"}
            </div>
          )}
        </div>
        {WerdendListe}
      </div>
    );
  }

  return (
    <div>
      {VorgangAnzeige}
      {GeplantBanner}
      {/* Kopfzeile: Belegungstyp + Personenzahl (für BKA/Anrechnung) */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
        <span style={{ fontSize: FS.s, fontWeight: FW.bold, color: t.text }}>
          {typ === "vermietung" ? "Vermietet" : (typ === "selbstnutzung" ? (istSP ? "Genutzt" : "Bewohnt") : "Leerstand")}
        </span>
        <span style={{ fontSize: FS.xxs, padding: "1px 7px", borderRadius: RAD.ms,
          background: farbe + "18", color: farbe, fontWeight: FW.medium }}>
          {anzahl} {anzahl === 1 ? "Person" : "Personen"}
        </span>
      </div>

      {/* Mietvertrag — oben, wenn ein Bewohner Mieter ist (abgeleitet) */}
      {hatMieter && beleg && (
        <div style={{ marginBottom: 8, padding: "10px 12px", background: t.bg,
          border: `1px solid ${t.border}`, borderRadius: RAD.md }}>
          <div style={{ fontSize: FS.s, fontWeight: FW.bold, color: t.text, marginBottom: 6 }}>
            Mietvertrag
          </div>
          <HaushaltMietvertrag beleg={beleg} t={t} kontakte={kontakte} personenAnzahl={anzahl}
            nachfolge={vorgangBeleg ? (() => {
              const nm = (vorgangBeleg.haushalt && vorgangBeleg.haushalt.mitglieder || [])
                .find(x => !istAnonymesMitglied(x));
              const typWort = vorgangBeleg.typ === "selbstnutzung" ? "Selbstnutzung" : "Vermietung";
              return { auszug: beleg.bis || vorgangBeleg.von, einzug: vorgangBeleg.von,
                       name: nm ? nm.name : "", typWort };
            })() : null}/>
        </div>
      )}

      {/* Nutzung-Info — bei Eigennutzung/sonstigen Bewohnern (kein Mietvertrag).
          Gleichwertiger Info-Block wie der Mietvertrag, immer vorhanden. */}
      {!hatMieter && beleg && (
        <div style={{ marginBottom: 8, padding: "10px 12px", background: t.bg,
          border: `1px solid ${t.border}`, borderRadius: RAD.md }}>
          <div style={{ fontSize: FS.s, fontWeight: FW.bold, color: t.text, marginBottom: 6 }}>
            {istSP ? "Nutzung" : (typ === "selbstnutzung" ? "Eigennutzung" : "Belegung")}
          </div>
          <HaushaltNutzungInfo beleg={beleg} typ={typ} t={t} kontakte={kontakte}
            personenAnzahl={anzahl} istSP={istSP}
            nachfolge={vorgangBeleg ? (() => {
              const nm = (vorgangBeleg.haushalt && vorgangBeleg.haushalt.mitglieder || [])
                .find(x => !istAnonymesMitglied(x));
              const typWort = vorgangBeleg.typ === "selbstnutzung" ? "Selbstnutzung" : "Vermietung";
              return { auszug: beleg.bis || vorgangBeleg.von, einzug: vorgangBeleg.von,
                       name: nm ? nm.name : "", typWort };
            })() : null}/>
        </div>
      )}

      {/* Benannte + anonyme Mitglieder */}
      {mitglieder.length === 0 ? (
        <div style={{ fontSize: FS.s, color: t.muted, fontStyle: "italic", padding: "8px 0" }}>
          Noch keine Bewohner hinterlegt
        </div>
      ) : (
        // Reihenfolge: echte Kontakte zuerst (zusammen), anonyme „+N"-Karten danach.
        mitglieder.slice().sort((a, b) => (istAnonymesMitglied(a) ? 1 : 0) - (istAnonymesMitglied(b) ? 1 : 0)).map((m, i) => {
          const anonymKarte = istAnonymesMitglied(m);
          const az = Math.max(1, Number(m.anzahl) || 1);
          if (anonymKarte) {
            // Optik wie die echte KontaktKarte: t.card-Hintergrund, Avatar + Name
            // in der Personen-Akzentfarbe. Rahmen jedoch in der Rollenfarbe (wie
            // BewohnerLeseKarte), damit der Haushalt einheitlich umrandet wirkt.
            // Rahmen in der Rollenfarbe des Haushalts: bevorzugt die Rolle der
            // ersten benannten Person (meist der Mieter), damit die anonyme Karte
            // denselben Rahmen wie die echten Karten daneben trägt — nicht ihre
            // eigene (oft graue „Angehöriger") Rolle.
            const leitMitglied = mitglieder.find(x => !istAnonymesMitglied(x));
            const rahmenFarbe = bewohnerRecht((leitMitglied && leitMitglied.recht) || m.recht).farbe || farbe;
            return (
              <div key={m.id || i} style={{ border: `1px solid ${rahmenFarbe}30`,
                borderRadius: RAD.lg, overflow: "hidden", marginBottom: 6,
                background: rahmenFarbe + "08" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12,
                  padding: "10px 12px", boxSizing: "border-box", background: t.card }}>
                  <div style={{ width: 48, flexShrink: 0, display: "flex",
                    alignItems: "center", justifyContent: "center" }}>
                    <div style={{ width: 38, height: 38, borderRadius: "50%", flexShrink: 0,
                      boxSizing: "border-box", background: personFarbe + "22",
                      border: `1.5px solid ${personFarbe}40`, display: "flex",
                      alignItems: "center", justifyContent: "center",
                      fontSize: 38 * 0.36, fontWeight: FW.bold, color: personFarbe }}>
                      +{az}
                    </div>
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: FS.l, fontWeight: FW.heavy, color: personFarbe,
                      overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {az} {az === 1 ? "Person" : "Personen"}
                    </div>
                    <div style={{ fontSize: FS.s, color: t.sub, marginTop: 1 }}>
                      ohne Kontakt
                    </div>
                    {m.vermerk && (
                      <div style={{ fontSize: FS.s, color: t.sub, marginTop: 1 }}>{m.vermerk}</div>
                    )}
                  </div>
                </div>
              </div>
            );
          }
          const kontakt = (m.kontaktId != null) ? (kontakte || []).find(k => k.id === m.kontaktId) : null;
          // Kontakt-Bewohner: aufklappbare Lese-Karte (gleiche Optik wie Edit).
          if (kontakt) {
            return <BewohnerLeseKarte key={m.id || i} m={m} kontakt={kontakt} t={t} farbe={farbe} onKontaktClick={onKontaktClick} kontakte={kontakte} setKontakte={setKontakte}/>;
          }
          const ohneKontakt = m.kontaktId == null;
          return (
            <div key={m.id || i} style={{ background: farbe + "08",
              border: `1px solid ${farbe}30`, borderRadius: RAD.md,
              marginBottom: 6, display: "flex", alignItems: "center", gap: 10,
              padding: "8px 12px" }}>
              <Avatar name={m.name || "?"} size={30} accent={bewohnerRecht(m.recht).farbe}/>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: FS.m, fontWeight: FW.bold, color: t.text,
                  display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                  {m.name || "Unbenannt"}
                  <span style={{ fontSize: FS.xxs, padding: "1px 7px", borderRadius: RAD.ms,
                    background: bewohnerRecht(m.recht).farbe + "18",
                    color: bewohnerRecht(m.recht).farbe, fontWeight: FW.medium }}>
                    {bewohnerRecht(m.recht).label}
                  </span>
                  {ohneKontakt && (
                    <span style={{ fontSize: FS.xxs, color: t.muted, fontWeight: FW.regular }}>
                      ohne Kontakt
                    </span>
                  )}
                </div>
                {m.vermerk && (
                  <div style={{ fontSize: FS.xs, color: t.sub }}>{m.vermerk}</div>
                )}
              </div>
            </div>
          );
        })
      )}

      {WerdendListe}
    </div>
  );
}

// Kleine read-only Darstellung der Mietvertrags-Konditionen einer Belegung.
function HaushaltMietvertrag({ beleg, t, kontakte = [], personenAnzahl = null, nachfolge = null }) {
  const mv = (beleg && beleg.mietvertrag) || {};
  // Vertragspartei: explizit gesetzt (Altdaten) ODER abgeleitet aus dem/den
  // Mieter-Bewohner(n) des Haushalts. Letzteres ist der Normalfall, seit der
  // separate Picker entfällt und die Kontaktkarte die Quelle ist.
  let parteiName = "";
  if (beleg && beleg.vertragsparteiId != null) {
    const k = (kontakte || []).find(x => x.id === beleg.vertragsparteiId);
    parteiName = (k && k.name) || "";
  } else {
    const hh = (beleg && beleg.haushalt) || { mitglieder: [] };
    const mieterNamen = (hh.mitglieder || [])
      .filter(m => m && istVertragspartei(m.recht))
      .map(m => {
        const k = (m.kontaktId != null) ? (kontakte || []).find(x => x.id === m.kontaktId) : null;
        return (k && k.name) || m.name || "";
      })
      .filter(Boolean);
    parteiName = mieterNamen.join(", ");
  }
  const zeilen = [];
  if (parteiName) zeilen.push(["Vertragspartei", parteiName]);
  if (beleg.von) zeilen.push(["Mietbeginn", datumDe(beleg.von) || beleg.von]);
  if (personenAnzahl != null) zeilen.push(["Bewohner", `${personenAnzahl} ${personenAnzahl === 1 ? "Person" : "Personen"}`]);
  if (mv.hoehe) zeilen.push(["Miete", mv.hoehe]);
  if (mv.kaution) zeilen.push(["Kaution", mv.kaution]);
  if (mv.kuendigung) zeilen.push(["Kündigung", mv.kuendigung]);
  // Auszug ist bekannt (laufender Wechsel terminiert): als hervorgehobene Zeilen.
  const auszugZeilen = [];
  if (nachfolge && nachfolge.auszug) {
    auszugZeilen.push(["Auszug zum", datumDe(nachfolge.auszug) || nachfolge.auszug]);
    if (nachfolge.name || nachfolge.typWort) {
      const wer = [nachfolge.name, nachfolge.typWort].filter(Boolean).join(" · ");
      const abDatum = nachfolge.einzug ? (datumDe(nachfolge.einzug) || nachfolge.einzug) : "";
      auszugZeilen.push(["Nachfolge", abDatum ? `${wer} · ab ${abDatum}` : wer]);
    }
  }
  if (zeilen.length === 0 && auszugZeilen.length === 0) {
    return <div style={{ fontSize: FS.s, color: t.muted, fontStyle: "italic" }}>Keine Konditionen hinterlegt</div>;
  }
  return (
    <div>
      {zeilen.map(([label, wert], i) => (
        <div key={i} style={{ display: "flex", gap: 8, fontSize: FS.s, padding: "2px 0" }}>
          <span style={{ width: 110, color: t.sub, flexShrink: 0 }}>{label}</span>
          <span style={{ color: t.text }}>{wert}</span>
        </div>
      ))}
      {auszugZeilen.length > 0 && (
        <div style={{ marginTop: 6, paddingTop: 6, borderTop: `1px solid ${t.border}` }}>
          {auszugZeilen.map(([label, wert], i) => (
            <div key={"a"+i} style={{ display: "flex", gap: 8, fontSize: FS.s, padding: "2px 0" }}>
              <span style={{ width: 110, color: "#3B82F6", flexShrink: 0 }}>{label}</span>
              <span style={{ color: t.text, fontWeight: i === 0 ? FW.medium : FW.regular }}>{wert}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// HaushaltNutzungInfo — Info-Block analog HaushaltMietvertrag, aber für
// Belegungen OHNE Mietvertrag (Eigennutzung, sonstige Bewohner) und für
// Leerstand. Zeigt „seit"-Datum, Nutzer/Bewohner-Namen, Anzahl Bewohner und
// einen laufenden Wechsel (Nachfolge). So gibt es bei JEDEM Belegungstyp einen
// gleichwertigen Info-Block, nicht nur bei Vermietung.
function HaushaltNutzungInfo({ beleg, typ, t, kontakte = [], personenAnzahl = null, nachfolge = null, istSP = false }) {
  const zeilen = [];
  if (typ === "leerstand") {
    if (beleg && beleg.von) zeilen.push(["Leer seit", datumDe(beleg.von) || beleg.von]);
  } else {
    // Eigennutzung / sonstige Bewohner: Nutzer-Namen aus dem Haushalt ableiten.
    const hh = (beleg && beleg.haushalt) || { mitglieder: [] };
    const namen = (hh.mitglieder || [])
      .filter(m => m && !istAnonymesMitglied(m))
      .map(m => {
        const k = (m.kontaktId != null) ? (kontakte || []).find(x => x.id === m.kontaktId) : null;
        return (k && k.name) || m.name || "";
      })
      .filter(Boolean);
    const nutzerLabel = istSP ? "Nutzer" : (typ === "selbstnutzung" ? "Eigennutzer" : "Bewohner");
    if (namen.length > 0) zeilen.push([nutzerLabel, namen.join(", ")]);
    if (beleg && beleg.von) {
      const seitLabel = typ === "selbstnutzung" ? "Genutzt seit" : "Bewohnt seit";
      zeilen.push([seitLabel, datumDe(beleg.von) || beleg.von]);
    }
    if (personenAnzahl != null) {
      zeilen.push(["Bewohner", `${personenAnzahl} ${personenAnzahl === 1 ? "Person" : "Personen"}`]);
    }
  }
  // Laufender Wechsel (Nachfolge) — wie beim Mietvertrag hervorgehoben.
  const auszugZeilen = [];
  if (nachfolge && nachfolge.auszug) {
    auszugZeilen.push(["Ende zum", datumDe(nachfolge.auszug) || nachfolge.auszug]);
    if (nachfolge.name || nachfolge.typWort) {
      const wer = [nachfolge.name, nachfolge.typWort].filter(Boolean).join(" · ");
      const abDatum = nachfolge.einzug ? (datumDe(nachfolge.einzug) || nachfolge.einzug) : "";
      auszugZeilen.push(["Nachfolge", abDatum ? `${wer} · ab ${abDatum}` : wer]);
    }
  }
  if (zeilen.length === 0 && auszugZeilen.length === 0) {
    return <div style={{ fontSize: FS.s, color: t.muted, fontStyle: "italic" }}>Keine Angaben hinterlegt</div>;
  }
  return (
    <div>
      {zeilen.map(([label, wert], i) => (
        <div key={i} style={{ display: "flex", gap: 8, fontSize: FS.s, padding: "2px 0" }}>
          <span style={{ width: 110, color: t.sub, flexShrink: 0 }}>{label}</span>
          <span style={{ color: t.text, fontWeight: FW.medium }}>{wert}</span>
        </div>
      ))}
      {auszugZeilen.length > 0 && (
        <div style={{ marginTop: 6, paddingTop: 6, borderTop: `1px solid ${t.border}` }}>
          {auszugZeilen.map(([label, wert], i) => (
            <div key={i} style={{ display: "flex", gap: 8, fontSize: FS.s, padding: "2px 0" }}>
              <span style={{ width: 110, color: "#3B82F6", flexShrink: 0 }}>{label}</span>
              <span style={{ color: t.text, fontWeight: FW.medium }}>{wert}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// BelegungsHistorie — read-only Chronik aller Belegungs-Kapitel eines Teils
// (Baustein 2). Neueste zuerst. Das offene Kapitel (kein Bis) ist „aktuell".
// Zeigt je Kapitel: Typ-Punkt + Label, Zeitraum (von → bis / „seit …"), und —
// falls vorhanden — eine kurze Bewohner-/Personen-Zeile. Erscheint nur, wenn es
// mehr als ein Kapitel gibt (sonst redundant zur aktiven Anzeige).
function BelegungsHistorie({ teil, t, kontakte = [] }) {
  // Schlichter Verlauf im Stil von EigentumHistorie: nur BEENDETE Kapitel
  // (Vergangenheit). Aktuelle und werdende Bewohner stehen als eigene Karten
  // oberhalb. Kein umrandeter Kasten, kleine graue Punkte, Name + Zeitraum.
  const personenInfo = (bel) => {
    if (!bel || bel.typ === "leerstand") return "";
    const hh = bel.haushalt || leererHaushalt();
    const alle = (hh.mitglieder || []);
    const namen = alle.filter(m => !istAnonymesMitglied(m)).map(m => m.name || "").filter(Boolean);
    const anonym = alle.filter(istAnonymesMitglied).reduce((s, m) => s + Math.max(1, Number(m.anzahl) || 1), 0);
    const teile = [];
    if (namen.length > 0) teile.push(namen.join(", "));
    if (anonym > 0) teile.push("+" + anonym);
    return teile.join(" · ");
  };
  const beendete = belegungsHistorie(teil).filter(b => belegungsPhase(b) === "beendet");
  if (beendete.length === 0) return null;
  return (
    <div style={{ marginTop: 12 }}>
      <div style={{ fontSize: FS.xs, fontWeight: FW.bold, color: t.muted,
        textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8 }}>
        Frühere Belegungen
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
        {beendete.map((bel, i) => {
          const letzter = i === beendete.length - 1;
          const vonStr = bel.von ? datumAnzeige(bel.von) : "?";
          const bisStr = bel.bis ? datumAnzeige(bel.bis) : "";
          const info = personenInfo(bel);
          const label = BELEGUNG_LABEL[bel.typ] || bel.typ;
          return (
            <div key={bel.id || i} style={{ display: "flex", gap: 10, position: "relative",
              paddingBottom: letzter ? 0 : 12 }}>
              {/* Zeitstrahl-Punkt + Linie (wie EigentumHistorie) */}
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", flexShrink: 0 }}>
                <div style={{ width: 9, height: 9, borderRadius: RAD.full, marginTop: 4,
                  background: t.muted, flexShrink: 0 }}/>
                {!letzter && <div style={{ width: 2, flex: 1, background: t.border, marginTop: 2 }}/>}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: FS.s, fontWeight: FW.medium, color: t.sub }}>
                  {label}{info ? ` · ${info}` : ""}
                </div>
                <div style={{ fontSize: FS.xs, color: t.muted }}>
                  {vonStr} – {bisStr}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// RaumZaehler — Zähler & Heizkostenverteiler eines Raums (Geräte-Stammdaten, kein
// Ablesungs-Verlauf). Felder: Art (Dropdown), Gerätenummer, Standort, Eichdatum;
// Bewertungsfaktor nur bei HKV. zaehler kommt aus raum.zaehler; Callbacks liefern
// Mutationen zurück. Eine Komponente für SE- und Gemeinschaftsräume.
function RaumZaehler({ zaehler, t, accent, editMode, onAdd, onChange, onRemove }) {
  const liste = Array.isArray(zaehler) ? zaehler : [];
  if (liste.length === 0 && !editMode) return null;
  const feldStyle = {
    flex: 1, minWidth: 0, background: t.card, border: `1px solid ${t.border}`,
    borderRadius: RAD.sm, padding: "5px 8px", fontSize: FS.input, color: t.text,
    outline: "none", fontFamily: "inherit",
  };
  return (
    <div style={{ marginTop: 8, paddingTop: 8, borderTop: `1px solid ${t.border}40` }}>
      <div style={{ fontSize: FS.xs, fontWeight: FW.bold, color: t.muted,
        textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>
        Zähler & HKV ({liste.length})
      </div>

      {liste.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: editMode ? 8 : 0 }}>
          {liste.map(z => {
            const istHKV = z.art === "hkv";
            return (
            <div key={z.id} style={{ background: t.surface, border: `1px solid ${t.border}`,
              borderRadius: RAD.ms, padding: "8px 10px" }}>
              {editMode ? (
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <select value={z.art || ""} onChange={e => onChange(z.id, { art: e.target.value })}
                      style={{ ...feldStyle, flex: "0 0 auto", width: 140 }}>
                      <option value="">Art wählen…</option>
                      {ZAEHLER_ARTEN.map(a => <option key={a.id} value={a.id}>{a.label}</option>)}
                    </select>
                    <input value={z.nummer || ""} onChange={e => onChange(z.id, { nummer: e.target.value })}
                      placeholder="Gerätenummer" style={feldStyle}/>
                    <button onClick={() => onRemove(z.id)} style={{
                      background: "none", border: `1px solid ${t.border}`,
                      borderRadius: RAD.sm, width: 26, height: 26, flexShrink: 0, cursor: "pointer",
                      display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <I name="x" size={11} color={"#EF4444"}/>
                    </button>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <input value={z.eichDatum || ""} onChange={e => onChange(z.id, { eichDatum: e.target.value })}
                      type="date" title="Eichdatum / Eichfrist"
                      style={{ ...feldStyle, color: z.eichDatum ? t.text : t.muted }}/>
                  </div>
                  {istHKV && (
                    <input value={z.bewertungsfaktor || ""} onChange={e => onChange(z.id, { bewertungsfaktor: e.target.value })}
                      placeholder="Bewertungsfaktor (HKV)" type="number" style={feldStyle}/>
                  )}
                </div>
              ) : (
                <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                  <span style={{ fontSize: FS.xs, fontWeight: FW.bold, color: accent,
                    background: accent + "14", border: `1px solid ${accent}40`,
                    borderRadius: RAD.sm, padding: "1px 7px", whiteSpace: "nowrap" }}>
                    {zaehlerArtLabel(z.art)}
                  </span>
                  {z.nummer && <span style={{ fontSize: FS.s, color: t.text, fontWeight: FW.semi }}>Nr. {z.nummer}</span>}
                  {istHKV && z.bewertungsfaktor && <span style={{ fontSize: FS.xs, color: t.muted }}>· BF {z.bewertungsfaktor}</span>}
                  {z.eichDatum && <span style={{ fontSize: FS.xs, color: t.muted }}>· Eichung {z.eichDatum}</span>}
                </div>
              )}
            </div>
            );
          })}
        </div>
      )}

      {editMode && (
        <button onClick={() => onAdd()} style={{
          display: "inline-flex", alignItems: "center", gap: 4,
          background: accent + "14", border: `1px solid ${accent}40`, color: accent,
          borderRadius: RAD.pill, padding: "5px 12px", cursor: "pointer",
          fontSize: FS.s, fontWeight: FW.medium, fontFamily: "inherit", whiteSpace: "nowrap" }}>
          <I name="plus" size={12} color={accent}/> Zähler
        </button>
      )}
    </div>
  );
}

// TeilRaeume — Räume eines Teils (Sondereigentum).
function TeilRaeume({ raeume, t, accent, editMode, onAdd, onChange, onRemove,
    onZaehlerAdd, onZaehlerChange, onZaehlerRemove,
    teilFlaeche = "", onUebernehmeFlaeche = null }) {
  const [neuName, setNeuName] = useState("");
  const liste = Array.isArray(raeume) ? raeume : [];
  const add = () => {
    const n = neuName.trim();
    if (!n) return;
    onAdd(n);
    setNeuName("");
  };
  // Weiche Flächen-Summe: Vorschlag aus den Raumflächen. Nie automatisch
  // überschrieben — der Nutzer übernimmt aktiv per Button. Button nur, wenn
  // die Summe > 0 ist und vom aktuell gesetzten Teilflächen-Wert abweicht.
  const summeRaeume = summeRaumFlaechen(liste);
  const summeRund = Math.round(summeRaeume * 10) / 10;
  const teilFlNum = parseFlaeche(teilFlaeche);
  const summeZeigen = editMode && summeRaeume > 0;
  const uebernehmenMoeglich = summeZeigen && onUebernehmeFlaeche
    && Math.abs(summeRund - teilFlNum) > 0.05;
  return (
    <div style={{ marginTop: 10 }}>
      <div style={{ fontSize: FS.xs, fontWeight: FW.bold, color: t.muted,
        textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>
        Räume ({liste.length})
      </div>

      {liste.length === 0 && !editMode && (
        <div style={{ fontSize: FS.s, color: t.muted, fontStyle: "italic", marginBottom: 6 }}>
          Keine Räume hinterlegt.
        </div>
      )}

      {liste.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: editMode ? 8 : 0 }}>
          {liste.map(r => {
            const anzZaehler = (r && Array.isArray(r.zaehler)) ? r.zaehler.length : 0;
            return (
            <div key={r.id} style={{ background: t.surface, border: `1px solid ${t.border}`,
              borderRadius: RAD.ms, padding: "8px 10px" }}>
              {editMode ? (
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                    <input value={r.name} onChange={e => onChange(r.id, { name: e.target.value })}
                      placeholder="Raum-Name (z. B. Bad)"
                      style={{ flex: 2, minWidth: 0, background: t.card, border: `1px solid ${t.border}`,
                        borderRadius: RAD.sm, padding: "5px 8px", fontSize: FS.input, color: t.text,
                        outline: "none", fontFamily: "inherit", fontWeight: FW.semi }}/>
                    <input value={r.flaeche || ""} onChange={e => onChange(r.id, { flaeche: e.target.value })}
                      type="number" placeholder="m²"
                      style={{ width: 70, flexShrink: 0, background: t.card, border: `1px solid ${t.border}`,
                        borderRadius: RAD.sm, padding: "5px 8px", fontSize: FS.input, color: t.text,
                        outline: "none", fontFamily: "inherit" }}/>
                    <button onClick={() => onRemove(r.id)} style={{
                      background: "none", border: `1px solid ${t.border}`,
                      borderRadius: RAD.sm, width: 26, height: 26, flexShrink: 0, cursor: "pointer",
                      display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <I name="x" size={11} color={"#EF4444"}/>
                    </button>
                  </div>
                  <label style={{ display: "flex", alignItems: "center", gap: 7, cursor: "pointer",
                    fontSize: FS.s, color: t.sub }}>
                    <input type="checkbox" checked={r.abrechnungsrelevant !== false}
                      onChange={e => onChange(r.id, { abrechnungsrelevant: e.target.checked })}
                      style={{ width: 16, height: 16, accentColor: accent, cursor: "pointer" }}/>
                    Abrechnungsrelevant
                  </label>
                </div>
              ) : (
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ flex: 1, fontSize: FS.m, color: t.text, fontWeight: FW.semi }}>{r.name}</span>
                  {r.flaeche && <span style={{ fontSize: FS.s, color: t.sub }}>{r.flaeche} m²</span>}
                  {r.abrechnungsrelevant === false && (
                    <span style={{ fontSize: FS.xs, color: t.muted, fontStyle: "italic" }}>nicht abrechenbar</span>
                  )}
                  {anzZaehler > 0 && (
                    <span style={{ fontSize: FS.xs, color: accent }}>{anzZaehler} Zähler</span>
                  )}
                </div>
              )}
              <RaumZaehler zaehler={r.zaehler} t={t} accent={accent} editMode={editMode}
                onAdd={() => onZaehlerAdd(r.id)}
                onChange={(zId, daten) => onZaehlerChange(r.id, zId, daten)}
                onRemove={(zId) => onZaehlerRemove(r.id, zId)}/>
            </div>
            );
          })}
        </div>
      )}

      {summeZeigen && (
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap",
          marginBottom: 8, padding: "6px 9px", background: accent + "0D",
          border: `1px solid ${accent}26`, borderRadius: RAD.sm }}>
          <span style={{ fontSize: FS.s, color: t.sub }}>
            Σ Räume: <strong style={{ color: t.text, fontVariantNumeric: "tabular-nums" }}>{summeRund} m²</strong>
          </span>
          {uebernehmenMoeglich && (
            <button onClick={() => onUebernehmeFlaeche(summeRund)} style={{
              marginLeft: "auto", display: "inline-flex", alignItems: "center", gap: 4,
              background: accent + "14", border: `1px solid ${accent}40`, color: accent,
              borderRadius: RAD.pill, padding: "4px 10px", cursor: "pointer",
              fontSize: FS.s, fontWeight: FW.medium, fontFamily: "inherit", whiteSpace: "nowrap" }}>
              Als Teilfläche übernehmen
            </button>
          )}
        </div>
      )}

      {editMode && (
        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
          <input value={neuName} onChange={e => setNeuName(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter") add(); }}
            placeholder="Raum-Name (z. B. Wohnzimmer)"
            style={{ flex: 1, minWidth: 0, background: t.surface, border: `1px solid ${t.border}`,
              borderRadius: RAD.sm, padding: "6px 9px", fontSize: 16, color: t.text,
              outline: "none", fontFamily: "inherit" }}/>
          <button onClick={add} disabled={!neuName.trim()} style={{
            display: "inline-flex", alignItems: "center", gap: 4,
            background: neuName.trim() ? accent + "14" : "transparent",
            border: `1px solid ${neuName.trim() ? accent + "40" : t.border}`,
            color: neuName.trim() ? accent : t.muted,
            borderRadius: RAD.pill, padding: "6px 12px", cursor: neuName.trim() ? "pointer" : "not-allowed",
            fontSize: FS.s, fontWeight: FW.medium, fontFamily: "inherit", whiteSpace: "nowrap" }}>
            <I name="plus" size={12} color={neuName.trim() ? accent : t.muted}/> Raum
          </button>
        </div>
      )}
    </div>
  );
}

function EinheitDetail({ einheit, t, accent, editMode, belegungEdit = false, onClose, kontakte, setKontakte, onUpdate, geschwisterEinheiten = [], onKontaktClick = null }) {
  const isStellplatz = isStellplatzTyp(einheit.typ);
  // Der runde Einheit-Stift (belegungEdit) macht jetzt ALLES der Einheit
  // editierbar — auch die Stammdaten. Im Stammdaten-Tab greift daher der
  // kombinierte Modus (globaler editMode ODER Einheit-Stift).
  const strukturEdit = editMode || belegungEdit;
  const alleVerwendungen = useVerwendungen();
  const initialEig = einheit.eigentuemer || [];
  const initialMie = einheit.mieter || [];
  const [tab, setTab] = useState(initialEig.length === 0 ? "eig" : "info");
  const [eigStartForm, setEigStartForm] = useState(null); // inline Eigentümerwechsel-Start: { kaeuferId } | null
  const [eigAddForm, setEigAddForm] = useState(null); // inline Mit-Eigentümer hinzufügen: { kontaktId } | null
  const [eig, setEig] = useState(initialEig);
  const [mie, setMie] = useState(initialMie);
  // Eigentümergemeinschaft (L2a): Flag + Typ + Vertreter an der Einheit.
  const [eigGemeinschaft, setEigGemeinschaft] = useState(
    (einheit.eigentuemerGemeinschaft && typeof einheit.eigentuemerGemeinschaft === "object")
      ? einheit.eigentuemerGemeinschaft : null);
  // Sondereigentumsverwaltung (SEV) der Einheit — Liste analog eig, Chronik-fähig.
  const [sev, setSev] = useState(Array.isArray(einheit.sev) ? einheit.sev : []);
  const [sevWechselForm, setSevWechselForm] = useState(null); // inline SEV-Wechsel/-Ende: { kontaktId, datum } | null
  // Stellplatz: rechtliche Stellung + ggf. verknüpfte Einheit (SE-Bestandteil / GE+SNR
  // verweisen auf eine WE im selben Objekt; eigenständig = eigenes Teileigentum).
  const [spStellung, setSpStellung] = useState(einheit.spStellung || "eigenstaendig");
  const [spEinheitId, setSpEinheitId] = useState(einheit.spEinheitId != null ? einheit.spEinheitId : null);
  // Verwendungen der Einheit — Liste. Hier werden NUR die frei wählbaren
  // (rechtlichen) Verwendungen gehalten/gespeichert (SNR, Verpachtet, Nießbrauch,
  // Wohnberechtigt). Die Belegungs-Verwendungen (Vermietet/Eigennutzung/Leerstand)
  // werden live aus der Belegung abgeleitet und nicht in diesem State geführt.
  const [verwendungen, setVerwendungen] = useState(() =>
    verwendungenVon(einheit).filter(v => BELEGUNG_VERWENDUNGEN.indexOf(v.name) < 0));
  // Schichtmodell: Teil/Belegung/Haushalt. Wird über HaushaltEditor bearbeitet.
  const [teile, setTeile] = useState(() => teileVon(einheit));
  // Welcher Teil ist im Haushalt-Tab aktiv (bei Unterteilung). Gegen Out-of-Range
  // abgesichert, falls der aktive Teil entfernt wird.
  const [aktTeilIdx, setAktTeilIdx] = useState(0);
  const teilIdxSicher = (aktTeilIdx >= 0 && aktTeilIdx < teile.length) ? aktTeilIdx : 0;
  // Unterteilt = ≥2 Teile. Dann wandern die physischen Stammdaten (Fläche/Lage/
  // Zimmer) in einen Pro-Teil-Block; oben bleiben nur die gemeinsamen Felder
  // (Nr./VerwNr/Typ/MEA). Bei genau 1 Teil bleibt alles wie gehabt (flache Felder).
  const unterteilt = teile.length > 1;
  // Verknüpfte Einheit eines Stellplatzes (für Anzeige/Eigentümer-Übernahme).
  const spVerknuepfteEinheit = (spEinheitId != null)
    ? geschwisterEinheiten.find(x => x && String(x.id) === String(spEinheitId)) || null
    : null;
  // Verknüpft = Stellplatz mit Stellung SE-Bestandteil oder GE+SNR (Eigentümer
  // ergibt sich dann aus der verknüpften Einheit, keine eigene Pflege).
  const spVerknuepft = isStellplatz && (spStellung === "se_bestandteil" || spStellung === "ge_snr");
  const spVerknEigentuemer = (spVerknuepfteEinheit && Array.isArray(spVerknuepfteEinheit.eigentuemer))
    ? spVerknuepfteEinheit.eigentuemer : [];
  // SEV-Ableitungen (vor dem JSX berechnet — keine IIFE in JSX).
  const sevAktiv = (sev || []).filter(s => sevStatus(s) === "aktiv");
  const sevWerdend = (sev || []).filter(s => sevStatus(s) === "werdend");
  const sevWechselLaeuft = laufenderSevWechsel(sev);
  const sevVorhanden = (sev || []).length > 0;
  // Verwendungen ohne SEV — SEV hat einen eigenen Abschnitt, daher im
  // Verwendungs-Block (wählbar wie Lese-Anzeige) ausgeblendet.
  const verwendungenOhneSev = (verwendungen || []).filter(v => v.name !== "Sondereigentumsverwaltung");
  // Belegungs-Verwendungen LIVE aus dem aktuellen teile-State ableiten (nur
  // Anzeige, nicht editierbar). Quelle der Wahrheit ist der Belegung-Tab.
  const belegungVerw = isStellplatz ? [] : belegungsVerwendungen({ ...einheit, teile });
  const setTeilFeld = (idx, feld, wert) => setTeile(prev =>
    prev.map((teil, i) => i === idx ? { ...teil, [feld]: wert } : teil));

  const [fields, setFields] = useState(
    isStellplatz ? [
      { id: 0, name: "Nr.",            value: einheit.nr || "",      type: "text", required: true },
      { id: 1, name: "Verwaltungsnr.", value: einheit.verwNr, type: "text" },
      { id: 2, name: "Typ",            value: einheit.typ,    type: "text", required: true },
      { id: 3, name: "Lage",           value: einheit.lage || "", type: "text" },
    ] : [
      { id: 0, name: "Nr.",            value: einheit.nr || "",      type: "text", required: true },
      { id: 1, name: "Verwaltungsnr.", value: einheit.verwNr, type: "text" },
      { id: 2, name: "Typ",            value: einheit.typ,    type: "text", required: true },
      { id: 3, name: "Fläche",         value: einheit.flaeche || "", type: "number" },
      { id: 4, name: "MEA",            value: einheit.mea || "",     type: "number" },
      { id: 5, name: "Lage",           value: einheit.lage || "",    type: "text" },
      { id: 6, name: "Zimmer",         value: einheit.zimmer || "",  type: "number" },
    ]
  );

  // Änderungen an Feldern / Eigentümern / Mietern / Rechtsstatus nach außen
  // propagieren. firstRender verhindert ein direktes Re-Triggern beim Mount.
  const firstRender = useRef(true);
  useEffect(() => {
    if (firstRender.current) { firstRender.current = false; return; }
    if (!onUpdate) return;
    const updated = { ...einheit };
    fields.forEach(f => {
      if (f.name === "Nr.")            updated.nr = f.value;
      else if (f.name === "Verwaltungsnr.") updated.verwNr = f.value;
      else if (f.name === "Typ")       updated.typ = f.value;
      else if (f.name === "MEA")       updated.mea = f.value;
      // Fläche/Lage/Zimmer nur bei NICHT-Unterteilung flach spiegeln. Bei
      // Unterteilung tragen die Teile diese Werte (siehe teile-Block unten).
      else if (f.name === "Fläche" && !unterteilt) updated.flaeche = f.value;
      else if (f.name === "Lage"   && !unterteilt) updated.lage = f.value;
      else if (f.name === "Zimmer" && !unterteilt) updated.zimmer = f.value;
    });
    updated.eigentuemer = eig;
    updated.eigentuemerGemeinschaft = eigGemeinschaft;
    updated.mieter = mie;
    updated.sev = sev;
    updated.spStellung = spStellung;
    updated.spEinheitId = spEinheitId;
    updated.verwendungen = verwendungen;
    // Legacy-Feld spiegeln (erste Verwendung), damit alte Lesestellen nicht leerlaufen.
    updated.verwendung = verwendungen.length > 0 ? verwendungen[0] : null;
    updated.teile = teile;
    onUpdate(updated);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fields, eig, mie, sev, spStellung, spEinheitId, verwendungen, teile, eigGemeinschaft]);

  // Mit-Eigentümer hinzufügen (paralleler Eigentümer, sofort aktiv im Grundbuch —
  // z. B. Ehepaar, Erbengemeinschaft). Inline statt Modal.
  const eigHinzufuegen = (kontaktId) => {
    const kontakt = (kontakte || []).find(k => k.id === kontaktId);
    if (!kontakt) return;
    const neu = { name: kontakt.name || "", kontaktId: kontakt.id, status: "aktiv",
      von: isoHeute(), bis: null, grundbuch: true, selbstnutzer: false };
    setEig(v => [...(v || []), neu]);
    setEigAddForm(null);
  };

  // ── SEV-Handler ───────────────────────────────────────────────────────────
  // Hält die Verwendung „Sondereigentumsverwaltung" synchron zur SEV-Liste:
  // gibt es (nach der Änderung) mind. eine aktive/werdende SEV → Verwendung
  // sicherstellen; sonst entfernen. So greift das violette SEV-Eck-Badge
  // automatisch, ohne separaten objektZuweisungen-Sync.
  const syncSevVerwendung = (sevListe) => {
    const SEV_NAME = "Sondereigentumsverwaltung";
    const hatSev = (sevListe || []).some(s => { const st = sevStatus(s); return st === "aktiv" || st === "werdend"; });
    setVerwendungen(prev => {
      const ohne = (prev || []).filter(v => v.name !== SEV_NAME);
      return hatSev ? [...ohne, { name: SEV_NAME, status: "aktiv" }] : ohne;
    });
  };
  // Erste SEV anlegen (sofort aktiv, ohne Wechsel). seit = heute.
  // (Der Wechsel-Flow deckt auch den Erstfall ab; eigener Handler hier nicht nötig.)
  // SEV-Wechsel starten: laufende SEV endet zum Datum, neue beginnt ab demselben.
  const sevWechselStarten = (kontaktId, datum) => {
    const kontakt = (kontakte || []).find(k => k.id === kontaktId);
    if (!kontakt) return;
    const neu = starteSevWechsel(sev, kontakt.id, kontakt.name || "", datum || isoHeute());
    setSev(neu);
    syncSevVerwendung(neu);
    setSevWechselForm(null);
  };
  const sevWechselAbbrechen = () => {
    const neu = brecheSevWechselAb(sev);
    setSev(neu);
    syncSevVerwendung(neu);
    setSevWechselForm(null);
  };
  // Vollmacht eines SEV-Eintrags pflegen (Flag + Datum).
  const sevVollmachtSetzen = (sevId, erteilt, datum) => {
    setSev(v => (v || []).map(s => s.id === sevId
      ? { ...s, vollmacht: { erteilt: !!erteilt, datum: datum != null ? datum : ((s.vollmacht && s.vollmacht.datum) || "") } }
      : s));
  };
  // SEV-Eintrag entfernen (z. B. versehentlich angelegt).
  const sevEntfernen = (sevId) => {
    const neu = (sev || []).filter(s => s.id !== sevId);
    setSev(neu);
    syncSevVerwendung(neu);
  };
  // SEV beenden (ohne Nachfolger): setzt das Enddatum (bis). Sobald das Datum
  // erreicht ist, wird die SEV „ehemalig" und das SEV-Verwendungs-Badge entfällt.
  const sevBeenden = (sevId, datum) => {
    const neu = (sev || []).map(s => s.id === sevId ? { ...s, bis: datum || isoHeute() } : s);
    setSev(neu);
    syncSevVerwendung(neu);
  };

  // Inline-Eigentümerwechsel starten: Käufer als Interessent (Stufe 1) voran-
  // stellen; bisheriger Eigentümer bleibt aktiv/stimmberechtigt bis Grundbuch.
  const starteEigVorgang = (kaeuferId) => {
    const kontakt = (kontakte || []).find(k => k.id === kaeuferId);
    if (!kontakt) return;
    const neu = {
      name: kontakt.name || "", kontaktId: kontakt.id,
      status: "interessent", kaufabsichtAb: isoHeute(),
      kostenAb: null, von: null, bis: null, grundbuch: false, selbstnutzer: false,
    };
    setEig(v => [neu, ...(v || [])]);
    setEigStartForm(null);
  };

  // Eine Stufe des Eigentümer-Vorgangs abhaken (Spec §22.5). kaeuferKontaktId
  // identifiziert den werdenden Eigentümer; stufe ∈ {kosten, grundbuch}.
  // Stufe 1 (Kaufabsicht) ist beim Anlegen bereits gesetzt.
  const eigStufeAbhaken = (kaeuferKontaktId, stufe, datum) => {
    const d = datum || isoHeute();
    setEig(liste => (liste || []).map(p => {
      if (String(p.kontaktId) !== String(kaeuferKontaktId)) {
        // Beim Grundbuch-Schritt: bisherige AKTIVE Eigentümer bekommen das
        // Umschreibedatum als bis. Ob sie damit „ehemalig" sind, entscheidet
        // eigStatus datumsgesteuert (erst ab Erreichen des Datums).
        if (stufe === "grundbuch" && eigStatus(p) === "aktiv" && !p.bis) {
          return { ...p, bis: d };
        }
        return p;
      }
      // Der werdende Käufer: nur das Datum der Stufe setzen. Der Status-Sprung
      // (interessent → werdend → aktiv) ergibt sich datumsgesteuert aus eigStatus.
      if (stufe === "kosten")    return { ...p, kostenAb: d, status: undefined };
      if (stufe === "grundbuch") return { ...p, von: d, grundbuch: true, status: undefined };
      return p;
    }));
  };

  // Vorgang abbrechen: den werdenden Käufer-Eintrag wieder entfernen, der
  // bisherige Eigentümer bleibt unangetastet aktiv.
  const eigVorgangAbbrechen = (kaeuferKontaktId) => {
    setEig(liste => (liste || []).filter(p => String(p.kontaktId) !== String(kaeuferKontaktId)));
  };

  // Einen Eigentümer-Eintrag von DIESER Einheit entfernen (z. B. versehentlich
  // angelegter Miteigentümer). Identifiziert über kontaktId, sonst Referenz.
  // Der Kontakt selbst bleibt bestehen — nur die Zuordnung hier verschwindet.
  const eigEntfernen = (eintrag) => {
    setEig(liste => (liste || []).filter(p =>
      eintrag.kontaktId != null
        ? String(p.kontaktId) !== String(eintrag.kontaktId)
        : p !== eintrag));
  };

  // Quoten-Handler nutzen die intelligente Verteilung (verteileQuoten):
  // Zähler-Eingabe fixiert den Eintrag, Rest verteilt sich auf die offenen;
  // Nenner-Eingabe gilt gemeinsam für alle und skaliert fixierte proportional.
  const eigQuoteZaehler = (eintrag, wert) => {
    setEig(liste => verteileQuoten(liste, { typ: "zaehler", kontaktId: eintrag.kontaktId, wert }));
  };
  const eigQuoteNenner = (wert) => {
    setEig(liste => verteileQuoten(liste, { typ: "nenner", wert }));
  };
  // Quoten ganz zurücksetzen (alle Anteile löschen → zurück zu „gleiche Teile").
  const eigQuotenReset = () => {
    setEig(liste => (liste || []).map(p => {
      if (eigStatus(p) !== "aktiv") return p;
      const kopie = { ...p }; delete kopie.quote; delete kopie.quoteFix; return kopie;
    }));
  };

  const TABS = [
    { id: "info", l: "Stammdaten", icon: "document" },
    { id: "eig", l: "Eigentümer", icon: "user" },
    { id: "mie", l: "Belegung", icon: "users" },
  ];

  return (
    <div style={{ background: "transparent", padding: "12px 14px" }}>
      {/* Zwei getrennte Bearbeitungs-Ebenen:
          · editMode (oberer Stift) = STRUKTUR: Stammdaten, Rechtsstatus,
            Verwendung, Einheit aufteilen (Teile). KEIN Eigentümer-/Mieterwechsel.
          · belegungEdit (runder Stift in der EinheitZeile) = BELEGUNG/ZUWEISUNG:
            Eigentümer-/Mieterwechsel, Haushalt, Belegungswechsel. */}

      {/* Tabs */}
      <div style={{ display: "flex", gap: 4, background: t.bg, border: `1px solid ${t.border}`,
        borderRadius: RAD.md, padding: 3, marginBottom: 12 }}>
        {TABS.map(tb => (
          <button key={tb.id} onClick={() => setTab(tb.id)} style={{
            flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 5,
            padding: "6px 0", background: tab === tb.id ? accent + "20" : "none",
            border: "none", borderRadius: RAD.sm, cursor: "pointer",
            fontSize: FS.s, fontWeight: tab === tb.id ? 700 : 500,
            color: tab === tb.id ? accent : t.sub, fontFamily: "inherit" }}>
            <I name={tb.icon} size={12} color={tab === tb.id ? accent : t.sub}/>{tb.l}
          </button>
        ))}
      </div>

      {/* Stammdaten-Tab */}
      {tab === "info" && (
        <div>
          <FieldList fields={unterteilt
              ? fields.filter(f => !["Fläche","Lage","Zimmer"].includes(f.name))
              : fields}
            setFields={setFields} t={t} accent={accent}
            editMode={strukturEdit} kategorie="einheit"/>

          {/* Aufteilen-Steuerung im Stammdaten-Tab (nur Struktur-strukturEdit).
              Erlaubt das Unterteilen auch von hier (zweite Stelle neben Haushalt). */}
          {strukturEdit && !isStellplatz && !unterteilt && (
            <div style={{ marginTop: 12, padding: "10px 12px", background: t.bg,
              border: `1px solid ${t.border}`, borderRadius: RAD.md }}>
              <div style={{ fontSize: FS.s, fontWeight: FW.bold, color: t.text, marginBottom: 3 }}>
                Einheit aufteilen
              </div>
              <div style={{ fontSize: FS.xs, color: t.sub, marginBottom: 8, lineHeight: 1.4 }}>
                Eine Grundbuch-Einheit kann physisch aus mehreren Wohnungen bestehen
                (z. B. Vorder-/Hinterhaus). Jeder Teil hat eigene Fläche, Räume und Zähler;
                Eigentümer und MEA bleiben gemeinsam.
              </div>
              <button onClick={() => {
                  const updated = fuegeTeilHinzu({ ...einheit, teile }, "");
                  setTeile(updated.teile);
                  setAktTeilIdx(updated.teile.length - 1);
                }}
                style={{ display: "flex", alignItems: "center", justifyContent: "center",
                  gap: 5, padding: "7px 14px", borderRadius: RAD.pill, cursor: "pointer",
                  background: "#0080FF14", border: `1px solid #0080FF40`,
                  color: "#0080FF", fontSize: FS.s, fontWeight: FW.medium, fontFamily: "inherit",
                  whiteSpace: "nowrap", width: "100%" }}>
                <I name="plus" size={13} color="#0080FF"/> Einheit aufteilen
              </button>
            </div>
          )}

          {/* Pro-Teil-Stammdaten — nur bei Unterteilung. Pill-Zeile (Teile wählen)
              + runder „+" rechts; darunter nur die aktive Teil-Karte. Fläche/Zimmer/
              Lage je Teil; Eigentümer/MEA/VerwNr bleiben gemeinsam (oben). */}
          {unterteilt && (
            <div style={{ marginTop: 12 }}>
              <div style={{ fontSize: FS.xs, fontWeight: FW.bold, color: t.muted,
                textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 7 }}>
                Aufteilung ({teile.length} Teile · Σ {flaecheVon(einheit) > 0 ? (Math.round(flaecheVon(einheit) * 10) / 10) + " m²" : "—"})
              </div>

              {/* Pill-Selektor: Teile füllen die Zeile bis zum runden + */}
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
                <div style={{ display: "flex", gap: 5, flex: 1, minWidth: 0 }}>
                  {teile.map((teil, i) => {
                    const aktiv = teilIdxSicher === i;
                    return (
                      <button key={teil.id || i} onClick={() => setAktTeilIdx(i)} style={{
                        display: "inline-flex", alignItems: "center", justifyContent: "center",
                        gap: 5, flex: 1, minWidth: 0,
                        padding: "5px 10px", borderRadius: RAD.pill, cursor: "pointer",
                        fontSize: FS.s, fontWeight: aktiv ? 700 : 500, fontFamily: "inherit",
                        background: aktiv ? "#0080FF22" : t.surface,
                        border: `1px solid ${aktiv ? "#0080FF80" : t.border}`,
                        color: aktiv ? "#0080FF" : t.sub, whiteSpace: "nowrap",
                        overflow: "hidden", textOverflow: "ellipsis" }}>
                        {teil.name || ("Teil " + (i + 1))}
                      </button>
                    );
                  })}
                </div>
                {strukturEdit && (
                  <button onClick={() => {
                      const updated = fuegeTeilHinzu({ ...einheit, teile }, "");
                      setTeile(updated.teile);
                      setAktTeilIdx(updated.teile.length - 1);
                    }}
                    title="Weiteren Teil hinzufügen"
                    style={{ display: "inline-flex", alignItems: "center", justifyContent: "center",
                      width: 32, height: 32, flexShrink: 0, borderRadius: "50%", cursor: "pointer",
                      background: "#0080FF14", border: `1px solid #0080FF40`, color: "#0080FF",
                      fontFamily: "inherit" }}>
                    <I name="plus" size={15} color="#0080FF"/>
                  </button>
                )}
              </div>

              {/* Nur die aktive Teil-Karte */}
              {teile[teilIdxSicher] && (
                <div style={{ marginBottom: 8, padding: "10px 12px",
                  background: t.bg, border: `1px solid ${t.border}`, borderRadius: RAD.md }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                    {strukturEdit ? (
                      <input value={teile[teilIdxSicher].name || ""}
                        placeholder={`Teil ${teilIdxSicher + 1} (z. B. Hinterhaus)`}
                        onChange={e => setTeilFeld(teilIdxSicher, "name", e.target.value)}
                        style={{ flex: 1, minWidth: 0, background: t.surface,
                          border: `1px solid #0080FF60`, borderRadius: RAD.sm,
                          padding: "4px 8px", fontSize: FS.input, color: t.text,
                          outline: "none", fontFamily: "inherit", fontWeight: FW.bold }}/>
                    ) : (
                      <div style={{ flex: 1, fontSize: FS.s, fontWeight: FW.bold, color: "#0080FF" }}>
                        {teile[teilIdxSicher].name || `Teil ${teilIdxSicher + 1}`}
                      </div>
                    )}
                    {strukturEdit && teile.length > 1 && (
                      <AktionsButton rolle="loeschen" size={28} t={t} accent="#0080FF"
                        title="Diesen Teil entfernen (Belegungs-Verlauf des Teils geht verloren)"
                        onClick={() => {
                          const updated = entferneTeil({ ...einheit, teile }, teilIdxSicher);
                          setTeile(updated.teile);
                          setAktTeilIdx(0);
                        }}/>
                    )}
                  </div>
                  {[
                    { feld: "flaeche", label: "Fläche", typ: "number", suffix: " m²" },
                    { feld: "zimmer",  label: "Zimmer", typ: "number", suffix: "" },
                    { feld: "lage",    label: "Lage",   typ: "text",   suffix: "" },
                  ].map(({ feld, label, typ, suffix }) => (
                    <div key={feld} style={{ display: "flex", alignItems: "center", gap: 8,
                      padding: "6px 0", borderBottom: `1px solid ${t.border}40` }}>
                      <span style={{ width: 90, fontSize: FS.s, color: t.sub, flexShrink: 0 }}>{label}</span>
                      {strukturEdit ? (
                        <input value={teile[teilIdxSicher][feld] || ""}
                          onChange={e => setTeilFeld(teilIdxSicher, feld, e.target.value)}
                          type={typ === "number" ? "number" : "text"}
                          style={{ flex: 1, minWidth: 0, background: t.surface,
                            border: `1px solid ${accent}60`, borderRadius: RAD.sm,
                            padding: "3px 8px", fontSize: FS.input, color: t.text,
                            outline: "none", fontFamily: "inherit" }}/>
                      ) : (
                        <span style={{ flex: 1, fontSize: FS.s, textAlign: "right",
                          color: teile[teilIdxSicher][feld] ? t.text : t.muted, fontWeight: teile[teilIdxSicher][feld] ? 500 : 400 }}>
                          {teile[teilIdxSicher][feld] ? teile[teilIdxSicher][feld] + suffix : "—"}
                        </span>
                      )}
                    </div>
                  ))}
                  <TeilRaeume raeume={teile[teilIdxSicher].raeume} t={t} accent="#0080FF" editMode={strukturEdit}
                    teilFlaeche={teile[teilIdxSicher].flaeche}
                    onUebernehmeFlaeche={(summe) => setTeilFeld(teilIdxSicher, "flaeche", String(summe))}
                    onAdd={(name) => setTeile(fuegeTeilRaum(teile, teilIdxSicher, name, ""))}
                    onChange={(raumId, daten) => setTeile(aendereTeilRaum(teile, teilIdxSicher, raumId, daten))}
                    onRemove={(raumId) => setTeile(entferneTeilRaum(teile, teilIdxSicher, raumId))}
                    onZaehlerAdd={(raumId) => setTeile(fuegeRaumZaehler(teile, teilIdxSicher, raumId))}
                    onZaehlerChange={(raumId, zId, daten) => setTeile(aendereRaumZaehler(teile, teilIdxSicher, raumId, zId, daten))}
                    onZaehlerRemove={(raumId, zId) => setTeile(entferneRaumZaehler(teile, teilIdxSicher, raumId, zId))}/>
                </div>
              )}
            </div>
          )}
          {isStellplatz && (
            <div style={{ marginTop: 12, padding: "10px 12px", background: t.bg,
              border: `1px solid ${t.border}`, borderRadius: RAD.md }}>
              <div style={{ fontSize: FS.s, fontWeight: FW.bold, color: t.text, marginBottom: 7 }}>Rechtliche Stellung</div>
              {strukturEdit ? (
                <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                  {[{id:"se_bestandteil",l:"SE-Bestandteil einer Einheit"},
                    {id:"ge_snr",l:"Gemeinschaft + Sondernutzungsrecht"},
                    {id:"eigenstaendig",l:"Eigenständiges Teileigentum"}].map(o => (
                    <button key={o.id} onClick={() => { setSpStellung(o.id); if (o.id === "eigenstaendig") setSpEinheitId(null); }}
                      style={{ textAlign: "left", padding: "7px 10px",
                        background: spStellung === o.id ? accent + "20" : t.surface,
                        border: `1px solid ${spStellung === o.id ? accent : t.border}`,
                        borderRadius: RAD.sm, cursor: "pointer", fontSize: FS.s, fontWeight: FW.medium,
                        color: spStellung === o.id ? accent : t.sub, fontFamily: "inherit" }}>
                      {o.l}
                    </button>
                  ))}
                </div>
              ) : (
                <div style={{ fontSize: FS.m, color: t.text }}>
                  {spStellung === "se_bestandteil" ? "SE-Bestandteil einer Einheit"
                    : (spStellung === "ge_snr" ? "Gemeinschaft + Sondernutzungsrecht"
                    : "Eigenständiges Teileigentum")}
                </div>
              )}
              {/* Verknüpfte Einheit — nur bei SE-Bestandteil / GE+SNR */}
              {(spStellung === "se_bestandteil" || spStellung === "ge_snr") && (
                <div style={{ marginTop: 10 }}>
                  <div style={{ fontSize: FS.xs, color: t.sub, marginBottom: 4 }}>
                    {spStellung === "se_bestandteil" ? "Gehört zu Einheit" : "Sondernutzungsrecht der Einheit"}
                  </div>
                  {strukturEdit ? (
                    <select value={spEinheitId != null ? String(spEinheitId) : ""}
                      onChange={e => setSpEinheitId(e.target.value === "" ? null : (isNaN(Number(e.target.value)) ? e.target.value : Number(e.target.value)))}
                      style={{ width: "100%", background: t.surface, border: `1px solid ${t.border}`,
                        borderRadius: RAD.sm, padding: "7px 9px", fontSize: 16,
                        fontFamily: "inherit", color: t.text }}>
                      <option value="">— Einheit wählen —</option>
                      {geschwisterEinheiten.filter(g => g && g.id !== einheit.id && !isStellplatzTyp(g.typ))
                        .map(g => <option key={g.id} value={String(g.id)}>{g.nr}{g.lage ? " · " + g.lage : ""}</option>)}
                    </select>
                  ) : (
                    <div style={{ fontSize: FS.m, color: t.text }}>
                      {spVerknuepfteEinheit ? (spVerknuepfteEinheit.nr + (spVerknuepfteEinheit.lage ? " · " + spVerknuepfteEinheit.lage : "")) : "— nicht zugeordnet —"}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Verwendung(en) der Einheit + SEV-Info gebündelt. Die SEV kümmert
              sich um die Verwendung, daher gemeinsam in EINEM Rahmen. SEV hier
              nur Anzeige (read-only) — gepflegt wird sie im Eigentümer-Tab. */}
          <div style={{ marginTop: 12, padding: "10px 12px", background: t.bg,
            border: `1px solid ${t.border}`, borderRadius: RAD.md }}>
            {/* SEV-Info oben (kompakt, ohne Kontaktkarte) */}
            {!isStellplatz && (sevAktiv.length > 0 || sevWerdend.length > 0) && (
              <div style={{ marginBottom: 12, paddingBottom: 10, borderBottom: `1px solid ${t.border}` }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
                  <span style={{ width: 9, height: 9, borderRadius: RAD.pill, background: "#7C3AED", flexShrink: 0 }}/>
                  <span style={{ fontSize: FS.s, fontWeight: FW.bold, color: t.text }}>Sondereigentumsverwaltung</span>
                </div>
                {sevAktiv.concat(sevWerdend).map(s => {
                  const st = sevStatus(s);
                  const vm = s.vollmacht || { erteilt: false, datum: "" };
                  return (
                    <div key={s.id} style={{ marginTop: 4 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span style={{ fontSize: FS.m, fontWeight: FW.semi, color: t.text,
                          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.name || "—"}</span>
                        <span style={{ fontSize: FS.xxs, padding: "2px 8px", borderRadius: RAD.ms, flexShrink: 0,
                          background: st === "werdend" ? "#3B82F6" : "#7C3AED", color: "#fff", fontWeight: FW.medium }}>{st}</span>
                        {s.bis && (
                          <div style={{ display: "inline-flex", alignItems: "center", gap: 5, marginLeft: "auto",
                            padding: "3px 9px", background: "#7C3AED14", border: "1px solid #7C3AED55",
                            borderRadius: RAD.sm, flexShrink: 0 }}>
                            <I name="calendar" size={12} color="#7C3AED"/>
                            <span style={{ fontSize: FS.xs, color: "#7C3AED", fontWeight: FW.bold, whiteSpace: "nowrap" }}>
                              Endet am {datumDe(s.bis)}
                            </span>
                          </div>
                        )}
                      </div>
                      <div style={{ fontSize: FS.xs, color: t.muted, marginTop: 2 }}>
                        {s.seit ? (st === "werdend" ? "Beauftragt ab " : "SEV seit ") + datumDe(s.seit) : ""}
                        {vm.erteilt ? (s.seit ? " · " : "") + "mit Vollmacht" : ""}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
            <div style={{ fontSize: FS.s, fontWeight: FW.bold, color: t.text, marginBottom: 7 }}>Verwendung</div>
            {strukturEdit ? (
              <>
                {/* Belegungs-Verwendungen: abgeleitet aus der Belegung, hier nur
                    Anzeige (gepflegt im Belegung-Tab). */}
                {belegungVerw.length > 0 && (
                  <div style={{ marginBottom: 10 }}>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 4 }}>
                      {belegungVerw.map(vw => (
                        <div key={vw.name} style={{ display: "inline-flex", alignItems: "center", gap: 6,
                          fontSize: FS.m, color: t.text }}>
                          <VerwendungBadge verwendung={vw.name} size={18} status={vw.status}/>
                          {vw.name}
                        </div>
                      ))}
                    </div>
                    <div style={{ fontSize: FS.xs, color: t.muted, fontStyle: "italic" }}>
                      Ergibt sich aus der Belegung
                    </div>
                  </div>
                )}
                <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
                  {alleVerwendungen
                    .filter(v => v.name !== "Sondereigentumsverwaltung")
                    .filter(v => BELEGUNG_VERWENDUNGEN.indexOf(v.name) < 0)
                    .map(v => {
                    const gewaehlt = verwendungen.some(x => x.name === v.name);
                    return (
                      <button key={v.name}
                        onClick={() => setVerwendungen(prev => gewaehlt
                          ? prev.filter(x => x.name !== v.name)
                          : [...prev, { name: v.name, status: "aktiv" }])}
                        title={v.name}
                        style={{ display: "inline-flex", alignItems: "center", gap: 5,
                          padding: "5px 9px", borderRadius: RAD.sm, cursor: "pointer", fontFamily: "inherit",
                          fontSize: FS.s, fontWeight: FW.medium,
                          background: gewaehlt ? v.color + "26" : t.surface,
                          border: `1px solid ${gewaehlt ? v.color : t.border}`,
                          color: gewaehlt ? v.color : t.sub }}>
                        <span style={{ width: 8, height: 8, borderRadius: RAD.pill, background: v.color, flexShrink: 0 }}/>
                        {v.kuerzel} · {v.name}
                      </button>
                    );
                  })}
                </div>
                {/* Von/Bis je gewählter Verwendung — Status leitet sich daraus ab.
                    SEV ausgenommen: wird über den eigenen SEV-Abschnitt datiert. */}
                {verwendungenOhneSev.map((vw, idx) => {
                  const vwStatus = ableiteStatusVonBis(vw.von || "", vw.bis || "", false);
                  const vwFarbe = vwStatus === "aktiv" ? "#22C55E"
                    : vwStatus === "werdend" ? "#F59E0B" : "#94A3B8";
                  const setVwFeld = (feld, wert) => setVerwendungen(prev =>
                    prev.map(x => x.name === vw.name ? { ...x, [feld]: wert,
                      status: ableiteStatusVonBis(
                        feld === "von" ? wert : (x.von || ""),
                        feld === "bis" ? wert : (x.bis || ""), false) } : x));
                  return (
                    <div key={vw.name} style={{ marginTop: 8 }}>
                      <div style={{ fontSize: FS.xs, color: t.sub, marginBottom: 3 }}>{vw.name}</div>
                      <div style={{ display: "flex", gap: 6 }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: FS.xxs, color: t.muted, marginBottom: 2 }}>Ab</div>
                          <DatumFeld value={vw.von || ""} onChange={v => setVwFeld("von", v)}
                            t={t} accent={accent} iso defaultHeute={false}/>
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: FS.xxs, color: t.muted, marginBottom: 2 }}>Bis</div>
                          <DatumFeld value={vw.bis || ""} onChange={v => setVwFeld("bis", v)}
                            t={t} accent={accent} iso defaultHeute={false}/>
                        </div>
                      </div>
                      <div style={{ fontSize: FS.xs, color: t.sub, marginTop: 3,
                        display: "flex", alignItems: "center", gap: 5 }}>
                        Status: <span style={{ color: vwFarbe, fontWeight: FW.bold }}>{vwStatus}</span>
                      </div>
                    </div>
                  );
                })}
              </>
            ) : (
              (belegungVerw.length + verwendungenOhneSev.length) > 0 ? (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                  {belegungVerw.concat(verwendungenOhneSev).map(vw => (
                    <div key={vw.name} style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: FS.m, color: t.text }}>
                      <VerwendungBadge verwendung={vw.name} size={18} status={vw.status}/>
                      {vw.name}
                      {vw.status && vw.status !== "aktiv" && (
                        <span style={{ fontSize: FS.xs, color: t.muted }}>({vw.status})</span>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ fontSize: FS.s, color: t.muted, fontStyle: "italic" }}>Keine Verwendung</div>
              )
            )}
          </div>
        </div>
      )}

      {/* Eigentümer-Tab */}
      {tab === "eig" && (
        <div>
          {spVerknuepft ? (
            <div style={{ padding: "12px 14px", background: accent + "0A",
              border: `1px solid ${accent}30`, borderRadius: RAD.md }}>
              <div style={{ fontSize: FS.s, color: t.sub, marginBottom: 6 }}>
                {spStellung === "se_bestandteil"
                  ? "Sondereigentum-Bestandteil — Eigentümer ergibt sich aus der verknüpften Einheit:"
                  : "Sondernutzungsrecht — der Stellplatz gehört der Gemeinschaft, genutzt von der verknüpften Einheit:"}
              </div>
              {spVerknuepfteEinheit ? (
                <>
                  <div style={{ fontSize: FS.m, fontWeight: FW.bold, color: t.text, marginBottom: 6 }}>
                    {spVerknuepfteEinheit.nr}{spVerknuepfteEinheit.lage ? " · " + spVerknuepfteEinheit.lage : ""}
                  </div>
                  {spVerknEigentuemer.length === 0 ? (
                    <div style={{ fontSize: FS.s, color: t.muted, fontStyle: "italic" }}>
                      Kein Eigentümer an der verknüpften Einheit hinterlegt
                    </div>
                  ) : (
                    spVerknEigentuemer.map((p, i) => (
                      <PersonCard key={i} p={p} pIndex={i} farbe={accent} isAktuell={!p.bis} t={t} kontakte={kontakte} onKontaktClick={onKontaktClick} setKontakte={setKontakte}/>
                    ))
                  )}
                </>
              ) : (
                <div style={{ fontSize: FS.s, color: t.muted, fontStyle: "italic" }}>
                  Noch keine Einheit verknüpft — bitte in den Stammdaten zuordnen.
                </div>
              )}
            </div>
          ) : (
            <>
              {eig.length === 0 ? (
                <div style={{ fontSize: FS.s, color: t.muted, textAlign: "center",
                  padding: "16px 0", fontStyle: "italic" }}>
                  Noch kein Eigentümer hinterlegt
                </div>
              ) : (
                <>
                  {/* Eigentum-Block oben (analog Mietvertrag): aktueller Eigentümer,
                      seit wann, Grundbuch/Stimmrecht. */}
                  <EigentumBlock eig={eig} t={t} accent={accent} einheit={einheit}/>

                  {/* Sondereigentumsverwaltung — anlegen & pflegen im Eigentümer-Tab
                      (SEV handelt im Auftrag des Eigentümers). Nur echte WE. */}
                  {!isStellplatz && (belegungEdit || sevVorhanden) && (
                    <div style={{ marginBottom: 10, padding: "11px 13px", background: "#7C3AED0A",
                      border: `1px solid #7C3AED30`, borderRadius: RAD.md }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
                        <span style={{ width: 9, height: 9, borderRadius: RAD.pill, background: "#7C3AED", flexShrink: 0 }}/>
                        <span style={{ fontSize: FS.s, fontWeight: FW.bold, color: t.text }}>Sondereigentumsverwaltung</span>
                      </div>
                      {(sevAktiv.length > 0 || sevWerdend.length > 0) && (
                        <div style={{ fontSize: FS.xs, color: t.sub, marginBottom: 8, lineHeight: 1.5 }}>
                          Die Kommunikation läuft im Normalfall über die SEV.
                        </div>
                      )}

                      {/* Aktive + werdende SEV-Einträge mit Kontaktkarte + Vollmacht */}
                      {sevAktiv.concat(sevWerdend).map(s => {
                        const st = sevStatus(s);
                        const vm = s.vollmacht || { erteilt: false, datum: "" };
                        const sevKontakt = (s.kontaktId != null) ? (kontakte || []).find(k => k.id === s.kontaktId) : null;
                        return (
                          <div key={s.id} style={{ marginBottom: 8 }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                              <span style={{ fontSize: FS.xxs, padding: "2px 8px", borderRadius: RAD.ms,
                                background: st === "werdend" ? "#3B82F6" : "#7C3AED", color: "#fff", fontWeight: FW.medium }}>{st}</span>
                              {s.seit && (
                                <span style={{ fontSize: FS.xs, color: t.muted, minWidth: 0,
                                  overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                  {st === "werdend" ? "Beauftragt ab " : "SEV seit "}{datumDe(s.seit)}
                                  {vm.erteilt ? " · mit Vollmacht" : ""}
                                </span>
                              )}
                              {s.bis && (
                                <div style={{ display: "inline-flex", alignItems: "center", gap: 5,
                                  marginLeft: "auto", padding: "3px 9px", background: "#7C3AED14",
                                  border: "1px solid #7C3AED55", borderRadius: RAD.sm, flexShrink: 0 }}>
                                  <I name="calendar" size={12} color="#7C3AED"/>
                                  <span style={{ fontSize: FS.xs, color: "#7C3AED", fontWeight: FW.bold, whiteSpace: "nowrap" }}>
                                    Endet am {datumDe(s.bis)}
                                  </span>
                                </div>
                              )}
                              {belegungEdit && (
                                <button onClick={() => sevEntfernen(s.id)} style={{
                                  background: "none", border: `1px solid ${t.border}`, borderRadius: RAD.sm,
                                  width: 26, height: 26, flexShrink: 0, cursor: "pointer",
                                  marginLeft: s.bis ? 0 : "auto",
                                  display: "flex", alignItems: "center", justifyContent: "center" }}>
                                  <I name="x" size={11} color={"#EF4444"}/>
                                </button>
                              )}
                            </div>
                            {sevKontakt ? (
                              <FeldKontaktKarte k={sevKontakt} t={t} accent="#7C3AED"
                                onKontaktClick={onKontaktClick} kontakte={kontakte} setKontakte={setKontakte}/>
                            ) : (
                              <div style={{ fontSize: FS.s, color: t.muted, fontStyle: "italic", padding: "4px 0" }}>{s.name || "—"}</div>
                            )}
                            {belegungEdit ? (
                              <div style={{ marginTop: 7 }}>
                                <label style={{ display: "flex", alignItems: "center", gap: 7, cursor: "pointer",
                                  fontSize: FS.s, color: t.sub }}>
                                  <input type="checkbox" checked={vm.erteilt}
                                    onChange={e => sevVollmachtSetzen(s.id, e.target.checked, s.seit || "")}
                                    style={{ width: 16, height: 16, accentColor: "#7C3AED", cursor: "pointer" }}/>
                                  Vollmacht des Eigentümers erteilt
                                </label>
                                {vm.erteilt && s.seit && (
                                  <div style={{ fontSize: FS.xs, color: t.muted, marginTop: 4, marginLeft: 23 }}>
                                    ab Beauftragung ({datumDe(s.seit)})
                                  </div>
                                )}
                              </div>
                            ) : null}
                          </div>
                        );
                      })}

                      {/* Edit-Aktionen: EIN Formular für Wechsel ODER Ende.
                          Neue SEV gewählt → Wechsel; leer (bei vorhandener SEV)
                          → die SEV endet zum Datum. */}
                      {belegungEdit && sevWechselForm && (() => {
                        const aktiverSev = sevAktiv[0] || null;
                        const hatNeue = !!sevWechselForm.kontaktId;
                        // Endet-Variante nur möglich, wenn es eine aktive SEV gibt.
                        const endeMoeglich = sevVorhanden && !!aktiverSev;
                        let btnText, btnAktion, btnDisabled;
                        if (hatNeue) {
                          btnText = sevVorhanden ? "Wechsel starten" : "SEV festlegen";
                          btnAktion = () => sevWechselStarten(sevWechselForm.kontaktId, sevWechselForm.datum);
                          btnDisabled = false;
                        } else if (endeMoeglich) {
                          btnText = "SEV beenden";
                          btnAktion = () => { sevBeenden(aktiverSev.id, sevWechselForm.datum); setSevWechselForm(null); };
                          btnDisabled = false;
                        } else {
                          btnText = "SEV festlegen";
                          btnAktion = () => {};
                          btnDisabled = true; // ohne vorhandene SEV und ohne Auswahl nichts zu tun
                        }
                        return (
                        <div style={{ padding: "10px 11px", background: t.surface,
                          border: `1px solid #7C3AED40`, borderRadius: RAD.ms }}>
                          <div style={{ fontSize: FS.xs, color: t.sub, marginBottom: 7 }}>
                            {sevVorhanden
                              ? "Neue SEV wählen (bisherige endet zum Datum) — oder leer lassen, um die SEV zu beenden:"
                              : "SEV auswählen:"}
                          </div>
                          <KontaktPicker value={sevWechselForm.kontaktId || null}
                            onChange={(id) => setSevWechselForm(f => ({ ...f, kontaktId: id }))}
                            t={t} accent="#7C3AED" nurFirmen kontakte={kontakte} setKontakte={setKontakte}/>
                          <div style={{ marginTop: 8 }}>
                            <div style={{ fontSize: FS.xs, color: t.muted, marginBottom: 3 }}>
                              {hatNeue ? "Übergabe ab" : (endeMoeglich ? "Beenden zum" : "Ab")}
                            </div>
                            <DatumFeld value={sevWechselForm.datum || ""} onChange={v => setSevWechselForm(f => ({ ...f, datum: v }))}
                              t={t} accent="#7C3AED" iso defaultHeute={true}/>
                          </div>
                          <div style={{ display: "flex", gap: 7, marginTop: 10 }}>
                            <AktionsButton variante="breit" rolle="abbrechen"
                              onClick={() => setSevWechselForm(null)} text="Abbrechen" icon={false} flex={1}
                              t={t} accent="#7C3AED"/>
                            <AktionsButton variante="breit" rolle="bestaetigen" disabled={btnDisabled}
                              onClick={btnAktion}
                              text={btnText} icon={false} flex={2}
                              farbe="#7C3AED" t={t} accent="#7C3AED"/>
                          </div>
                        </div>
                        );
                      })()}

                      {belegungEdit && !sevWechselForm && sevWechselLaeuft && (
                        <AktionsButton variante="breit" rolle="abbrechen"
                          onClick={sevWechselAbbrechen} text="Laufenden SEV-Wechsel abbrechen" icon={false}
                          t={t} accent={t.muted}/>
                      )}

                      {belegungEdit && !sevWechselForm && !sevWechselLaeuft && (
                        <button onClick={() => setSevWechselForm({ kontaktId: null, datum: isoHeute() })}
                          style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 5,
                            background: "#7C3AED14", border: `1px solid #7C3AED40`, color: "#7C3AED",
                            borderRadius: RAD.pill, padding: "7px 14px", cursor: "pointer",
                            fontSize: FS.s, fontWeight: FW.medium, fontFamily: "inherit",
                            whiteSpace: "nowrap", width: "100%" }}>
                          <I name="plus" size={13} color="#7C3AED"/> {sevVorhanden ? "SEV wechseln oder beenden" : "SEV hinzufügen"}
                        </button>
                      )}
                    </div>
                  )}

                  {/* Laufender Eigentümerwechsel → Vorgangs-Karte mit Stepper. */}
                  {(() => {
                    const kaeufer = eig.find(p => { const s = eigStatus(p); return s === "interessent" || s === "werdend"; });
                    if (!kaeufer) return null;
                    const verkaeufer = eig.find(p => eigStatus(p) === "aktiv") || null;
                    return (
                      <EigentumswechselVorgang kaeufer={kaeufer} verkaeufer={verkaeufer}
                        farbe={accent} t={t} editierbar={belegungEdit}
                        onStufe={eigStufeAbhaken} onAbbrechen={eigVorgangAbbrechen}/>
                    );
                  })()}

                  {/* Aktive Eigentümer zuerst, dann werdende Käufer als eigene
                      Kontaktkarte (gekennzeichnet via Status-Pille). Ehemalige
                      laufen über die Historie. So ist der Käufer mit vollen
                      Kontaktdaten erreichbar, nicht nur als Name im Stepper.
                      Entfernen-Button (Bearbeiten-Modus): bei aktiven nur wenn
                      mehr als einer existiert (Einheit nie ohne Eigentümer);
                      werdende Käufer immer entfernbar. */}
                  {(() => {
                    const aktive = eig.filter(p => eigStatus(p) === "aktiv");
                    return aktive.map((p, i) =>
                      <PersonCard key={p.kontaktId != null ? "k" + p.kontaktId : "a" + i}
                        p={p} pIndex={i} farbe={accent} isAktuell={true} t={t}
                        kontakte={kontakte} onKontaktClick={onKontaktClick} setKontakte={setKontakte}
                        editierbar={belegungEdit && aktive.length > 1} onRemove={eigEntfernen}/>);
                  })()}

                  {/* Quoten-Editor: nur im Belegung-Edit UND bei mehreren aktiven
                      Eigentümern. Anteil als Bruch (zaehler/nenner), wie im
                      Grundbuch. Normalfall (1 Eigentümer / gleiche Teile) zeigt
                      hier nichts. */}
                  {belegungEdit && (() => {
                    const aktive = eig.filter(p => eigStatus(p) === "aktiv");
                    if (aktive.length < 2) return null;
                    const qs = quotenStatus(eig);
                    // Gemeinsamer Nenner (Teiler der Einheit): aus erster gesetzter
                    // Quote, sonst leer. Wird gemeinsam für alle gepflegt.
                    let gemNenner = "";
                    for (const p of aktive) {
                      if (p.quote && p.quote.nenner !== "" && p.quote.nenner != null) {
                        gemNenner = String(p.quote.nenner); break;
                      }
                    }
                    const gepflegt = qs.gepflegt;
                    const hinweis = !gepflegt
                      ? "Ohne Angabe: zu gleichen Teilen. Gesamt-Teiler eingeben, dann verteilt sich automatisch."
                      : (qs.vollstaendig
                          ? "Anteile vollständig (Summe 100 %)."
                          : "Summe der Anteile: " + qs.summeProz.toLocaleString("de-DE") + " %");
                    const hinweisFarbe = (!gepflegt || qs.vollstaendig) ? t.sub : "#CA8A04";
                    const feldStyle = { width: 56, fontSize: 16, textAlign: "center",
                      padding: "6px 4px", border: `1px solid ${t.border}`,
                      borderRadius: RAD.sm, background: t.cardBg || t.bg, color: t.text };
                    // L2a: Gemeinschafts-Status aus dem State.
                    const gemAktiv = !!(eigGemeinschaft && eigGemeinschaft.ist);
                    const gemTyp = (eigGemeinschaft && eigGemeinschaft.typ) || "erbengemeinschaft";
                    const vertreterId = (eigGemeinschaft && eigGemeinschaft.vertreterKontaktId != null)
                      ? String(eigGemeinschaft.vertreterKontaktId) : "";
                    const toggleGemeinschaft = () => {
                      setEigGemeinschaft(gemAktiv
                        ? { ...(eigGemeinschaft || {}), ist: false }
                        : { ist: true, typ: gemTyp, name: (eigGemeinschaft && eigGemeinschaft.name) || "",
                            vertreterKontaktId: (eigGemeinschaft && eigGemeinschaft.vertreterKontaktId) || null });
                    };
                    const setGemTyp = (typ) => setEigGemeinschaft({ ...(eigGemeinschaft || { ist: true }), ist: true, typ });
                    const setVertreter = (kid) => setEigGemeinschaft({ ...(eigGemeinschaft || { ist: true }), ist: true,
                      vertreterKontaktId: kid === "" ? null : kid });
                    const zustellAdr = (eigGemeinschaft && eigGemeinschaft.zustellAdresse) || "";
                    const setZustellAdr = (wert) => setEigGemeinschaft({ ...(eigGemeinschaft || { ist: true }), ist: true,
                      zustellAdresse: wert });
                    return (
                      <div style={{ marginTop: 6, marginBottom: 8, padding: "10px 12px",
                        background: t.bg, border: `1px solid ${t.border}`, borderRadius: RAD.md }}>
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                          <span style={{ fontSize: FS.s, fontWeight: FW.bold, color: t.text }}>
                            Eigentumsanteile (Grundbuch)
                          </span>
                          {gepflegt && (
                            <span onClick={eigQuotenReset}
                              style={{ fontSize: FS.xs, color: accent, cursor: "pointer",
                                padding: "2px 8px", borderRadius: RAD.sm, border: `1px solid ${accent}40` }}>
                              Zurücksetzen
                            </span>
                          )}
                        </div>
                        {/* L2a: Eigentümergemeinschaft (Erbengem./GbR …) — eine Stimme. */}
                        <div style={{ marginBottom: 8, paddingBottom: 8, borderBottom: `1px solid ${t.border}` }}>
                          <div onClick={toggleGemeinschaft}
                            style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
                            <span style={{ width: 38, height: 22, borderRadius: RAD.pill,
                              background: gemAktiv ? accent : t.border, position: "relative",
                              transition: "background .15s", flexShrink: 0 }}>
                              <span style={{ position: "absolute", top: 2, left: gemAktiv ? 18 : 2,
                                width: 18, height: 18, borderRadius: "50%", background: "#fff",
                                transition: "left .15s" }}/>
                            </span>
                            <span style={{ fontSize: FS.s, color: t.text }}>Bilden eine Eigentümergemeinschaft</span>
                          </div>
                          {gemAktiv && (
                            <div style={{ marginTop: 8, paddingLeft: 2 }}>
                              <div style={{ fontSize: FS.xs, color: t.sub, marginBottom: 4 }}>
                                Tritt nach außen als ein Eigentümer auf (eine Stimme in der ETV).
                              </div>
                              <select value={gemTyp} onChange={e => setGemTyp(e.target.value)}
                                style={{ fontSize: 16, padding: "6px 8px", borderRadius: RAD.sm,
                                  border: `1px solid ${t.border}`, background: t.cardBg || t.bg,
                                  color: t.text, width: "100%", marginBottom: 6 }}>
                                {GEMEINSCHAFT_TYPEN.map(g =>
                                  <option key={g.id} value={g.id}>{g.label}</option>)}
                              </select>
                              <div style={{ fontSize: FS.xs, color: t.sub, marginBottom: 4 }}>Vertreter (handelt/unterschreibt)</div>
                              <select value={vertreterId} onChange={e => setVertreter(e.target.value)}
                                style={{ fontSize: 16, padding: "6px 8px", borderRadius: RAD.sm,
                                  border: `1px solid ${t.border}`, background: t.cardBg || t.bg,
                                  color: t.text, width: "100%" }}>
                                <option value="">— erster Eigentümer —</option>
                                {aktive.map((p, i) =>
                                  <option key={p.kontaktId != null ? "v" + p.kontaktId : "vi" + i}
                                    value={p.kontaktId != null ? String(p.kontaktId) : ""}>{p.name}</option>)}
                              </select>
                              <div style={{ fontSize: FS.xs, color: t.sub, margin: "6px 0 4px" }}>
                                Abweichende Zustellanschrift (optional)
                              </div>
                              <input type="text" value={zustellAdr}
                                placeholder="leer = Anschrift des Vertreters"
                                onChange={e => setZustellAdr(e.target.value)}
                                style={{ fontSize: 16, padding: "6px 8px", borderRadius: RAD.sm,
                                  border: `1px solid ${t.border}`, background: t.cardBg || t.bg,
                                  color: t.text, width: "100%", boxSizing: "border-box" }}/>
                            </div>
                          )}
                        </div>
                        {/* Gemeinsamer Nenner (Gesamt-Teiler der Einheit). */}
                        <div style={{ display: "flex", alignItems: "center", gap: 8,
                          padding: "4px 0 8px", borderBottom: `1px solid ${t.border}`, marginBottom: 6 }}>
                          <span style={{ flex: 1, fontSize: FS.s, color: t.sub }}>Gesamt-Teiler (Nenner)</span>
                          <input type="number" inputMode="numeric"
                            value={gemNenner} placeholder="z. B. 12"
                            onChange={e => eigQuoteNenner(e.target.value)}
                            style={{ ...feldStyle, width: 72 }}/>
                        </div>
                        {aktive.map((p, i) => {
                          const z = (p.quote && p.quote.zaehler != null && p.quote.zaehler !== "")
                            ? String(p.quote.zaehler) : "";
                          const fix = !!p.quoteFix;
                          const label = quoteLabel(p, eig);
                          return (
                            <div key={p.kontaktId != null ? "q" + p.kontaktId : "qa" + i}
                              style={{ display: "flex", alignItems: "center", gap: 8,
                                padding: "4px 0", fontSize: FS.s }}>
                              <span style={{ flex: 1, color: t.text, overflow: "hidden",
                                textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                {p.name}
                                {label && <span style={{ color: t.sub, fontSize: FS.xs, marginLeft: 6 }}>
                                  {label.replace(/^[0-9]+\/[0-9]+ /, "")}
                                </span>}
                                {!fix && gepflegt && <span style={{ color: t.sub, fontSize: FS.xs, marginLeft: 6 }}>(autom.)</span>}
                              </span>
                              <input type="number" inputMode="numeric" value={z} placeholder="–"
                                onChange={e => eigQuoteZaehler(p, e.target.value)}
                                style={{ ...feldStyle,
                                  fontWeight: fix ? FW.bold : FW.regular,
                                  color: fix ? t.text : t.sub }}/>
                              <span style={{ color: t.sub, minWidth: 28 }}>/ {gemNenner || "–"}</span>
                            </div>
                          );
                        })}
                        <div style={{ fontSize: FS.xs, color: hinweisFarbe, marginTop: 6 }}>
                          {hinweis}
                        </div>
                      </div>
                    );
                  })()}
                  {eig.filter(p => { const s = eigStatus(p); return s === "interessent" || s === "werdend"; }).map((p, i) =>
                    <PersonCard key={p.kontaktId != null ? "w" + p.kontaktId : "w" + i}
                      p={p} pIndex={i} farbe={accent} isAktuell={false} t={t}
                      kontakte={kontakte} onKontaktClick={onKontaktClick} setKontakte={setKontakte}
                      editierbar={belegungEdit} onRemove={eigEntfernen}/>)}

                  {/* Frühere Eigentümer als Zeitstrahl. */}
                  <EigentumHistorie eig={eig} t={t} accent={accent}/>
                </>
              )}

              {/* Inline-Eigentümerwechsel-Start (analog Belegungswechsel) */}
              {belegungEdit && eigStartForm && (() => {
                const verkaeufer = eig.find(p => eigStatus(p) === "aktiv") || null;
                return (
                <div style={{ border: `1px solid ${accent}40`, background: accent + "08",
                  borderRadius: RAD.md, padding: 10, marginTop: 8, marginBottom: 4 }}>
                  <div style={{ fontSize: FS.s, fontWeight: FW.bold, color: t.text, marginBottom: 8 }}>
                    Eigentümerwechsel starten
                  </div>
                  {verkaeufer && (
                    <div style={{ fontSize: FS.xs, color: t.sub, marginBottom: 8 }}>
                      Bisher: <b style={{ color: t.text }}>{verkaeufer.name}</b>
                      {verkaeufer.von ? <span style={{ color: t.muted }}> · seit {datumDe(verkaeufer.von) || verkaeufer.von}</span> : null}
                    </div>
                  )}
                  <div style={{ fontSize: FS.xs, color: t.sub, marginBottom: 2 }}>Käufer / neuer Eigentümer</div>
                  <div style={{ marginBottom: 8 }}>
                    <KontaktPicker value={eigStartForm.kaeuferId || null}
                      onChange={(id) => setEigStartForm(f => ({ ...f, kaeuferId: id }))}
                      label="" t={t} accent={accent} editMode={true}
                      kontakte={kontakte || []} setKontakte={setKontakte}/>
                  </div>
                  <div style={{ fontSize: FS.xs, color: t.sub, marginBottom: 8, lineHeight: 1.4 }}>
                    Legt den Käufer als Kaufabsicht an. Die weiteren Schritte (Lastenübergang,
                    Grundbuch) hakst du anschließend im Vorgang ab. Der bisherige Eigentümer bleibt
                    bis zur Grundbuch-Umschreibung stimmberechtigt.
                  </div>
                  <div style={{ display: "flex", gap: 6 }}>
                    <AktionsButton variante="breit" rolle="abbrechen" onClick={() => setEigStartForm(null)}
                      text="Abbrechen" icon={false} flex={1} t={t} accent={accent}/>
                    <AktionsButton variante="breit" rolle="bestaetigen" disabled={!eigStartForm.kaeuferId}
                      onClick={() => starteEigVorgang(eigStartForm.kaeuferId)}
                      text="Wechsel starten" icon={false} flex={2} t={t} accent={accent}/>
                  </div>
                </div>
                );
              })()}

              {/* Inline „Eigentümer hinzufügen" (Mit-Eigentümer, analog Wechsel-Start) */}
              {belegungEdit && eigAddForm && (
                <div style={{ border: `1px solid ${accent}40`, background: accent + "08",
                  borderRadius: RAD.md, padding: 10, marginTop: 8, marginBottom: 4 }}>
                  <div style={{ fontSize: FS.s, fontWeight: FW.bold, color: t.text, marginBottom: 8 }}>
                    Eigentümer hinzufügen
                  </div>
                  <div style={{ fontSize: FS.xs, color: t.sub, marginBottom: 2 }}>Weiterer Eigentümer</div>
                  <div style={{ marginBottom: 8 }}>
                    <KontaktPicker value={eigAddForm.kontaktId || null}
                      onChange={(id) => setEigAddForm(f => ({ ...f, kontaktId: id }))}
                      label="" t={t} accent={accent} editMode={true}
                      kontakte={kontakte || []} setKontakte={setKontakte}/>
                  </div>
                  <div style={{ fontSize: FS.xs, color: t.sub, marginBottom: 8, lineHeight: 1.4 }}>
                    Legt einen parallelen Mit-Eigentümer an (z. B. Ehepaar, Erbengemeinschaft) —
                    sofort aktiv und im Grundbuch stimmberechtigt.
                  </div>
                  <div style={{ display: "flex", gap: 6 }}>
                    <AktionsButton variante="breit" rolle="abbrechen" onClick={() => setEigAddForm(null)}
                      text="Abbrechen" icon={false} flex={1} t={t} accent={accent}/>
                    <AktionsButton variante="breit" rolle="bestaetigen" disabled={!eigAddForm.kontaktId}
                      onClick={() => eigHinzufuegen(eigAddForm.kontaktId)}
                      text="Hinzufügen" icon={false} flex={2} t={t} accent={accent}/>
                  </div>
                </div>
              )}

              {belegungEdit && !eigStartForm && !eigAddForm && (
                <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                  <button onClick={() => setEigAddForm({ kontaktId: null })} style={{
                    flex: 1, display: "flex", alignItems: "center", gap: 6,
                    background: accent + "10", border: `1px solid ${accent}30`,
                    borderRadius: RAD.md, padding: "8px 0", cursor: "pointer",
                    justifyContent: "center", color: accent, fontSize: FS.s, fontWeight: FW.medium,
                    fontFamily: "inherit" }}>
                    <I name="plus" size={13} color={accent}/> Eigentümer hinzufügen
                  </button>
                  {/* „Eigentümerwechsel" startet einen Vorgang inline — nur wenn keiner
                      läuft und es einen aktiven Eigentümer zum Ablösen gibt. */}
                  {!laufenderEigWechsel(eig) && eig.some(p => eigStatus(p) === "aktiv") && (
                    <button onClick={() => setEigStartForm({ kaeuferId: null })} style={{
                      flex: 1, display: "flex", alignItems: "center", gap: 6,
                      background: accent + "10", border: `1px solid ${accent}30`,
                      borderRadius: RAD.md, padding: "8px 0", cursor: "pointer",
                      justifyContent: "center", color: accent, fontSize: FS.s, fontWeight: FW.medium,
                      fontFamily: "inherit" }}>
                      <I name="swap" size={13} color={accent}/> Eigentümerwechsel
                    </button>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* Haushalt-Tab (Bewohner der laufenden Belegung, Spec §6) */}
      {tab === "mie" && (
        <div>
          {/* Teil-Selektor + Verwaltung — konsistent zum Stammdaten-Tab.
              1 Teil + editMode: volle-Breite-Pille „+ Einheit aufteilen".
              Geteilt: Pills (flex, füllen Zeile) + runder „+" rechts. */}
          {!isStellplatz && (teile.length > 1 || editMode) && (
            <div style={{ marginBottom: 12 }}>
              {teile.length === 1 && editMode && (
                <button onClick={() => {
                    const updated = fuegeTeilHinzu({ ...einheit, teile }, "");
                    setTeile(updated.teile);
                    setAktTeilIdx(updated.teile.length - 1);
                  }}
                  style={{ display: "flex", alignItems: "center", justifyContent: "center",
                    gap: 5, padding: "7px 14px", borderRadius: RAD.pill, cursor: "pointer",
                    background: "#0080FF14", border: `1px solid #0080FF40`,
                    color: "#0080FF", fontSize: FS.s, fontWeight: FW.medium, fontFamily: "inherit",
                    whiteSpace: "nowrap", width: "100%" }}>
                  <I name="plus" size={13} color="#0080FF"/> Einheit aufteilen
                </button>
              )}
              {teile.length > 1 && (
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <div style={{ display: "flex", gap: 5, flex: 1, minWidth: 0 }}>
                    {teile.map((teil, i) => {
                      const aktiv = teilIdxSicher === i;
                      const label = teil.name || ("Teil " + (i + 1));
                      return (
                        <button key={teil.id || i} onClick={() => setAktTeilIdx(i)} style={{
                          display: "inline-flex", alignItems: "center", justifyContent: "center",
                          gap: 5, flex: 1, minWidth: 0,
                          padding: "5px 10px", borderRadius: RAD.pill, cursor: "pointer",
                          fontSize: FS.s, fontWeight: aktiv ? 700 : 500, fontFamily: "inherit",
                          background: aktiv ? "#0080FF22" : t.surface,
                          border: `1px solid ${aktiv ? "#0080FF80" : t.border}`,
                          color: aktiv ? "#0080FF" : t.sub, whiteSpace: "nowrap",
                          overflow: "hidden", textOverflow: "ellipsis" }}>
                          {label}
                        </button>
                      );
                    })}
                  </div>
                  {editMode && (
                    <button onClick={() => {
                        const updated = fuegeTeilHinzu({ ...einheit, teile }, "");
                        setTeile(updated.teile);
                        setAktTeilIdx(updated.teile.length - 1);
                      }}
                      title="Weiteren Teil hinzufügen"
                      style={{ display: "inline-flex", alignItems: "center", justifyContent: "center",
                        width: 32, height: 32, flexShrink: 0, borderRadius: "50%", cursor: "pointer",
                        background: "#0080FF14", border: `1px solid #0080FF40`, color: "#0080FF",
                        fontFamily: "inherit" }}>
                      <I name="plus" size={15} color="#0080FF"/>
                    </button>
                  )}
                </div>
              )}
              {editMode && teile.length > 1 && (
                <div style={{ display: "flex", gap: 6, alignItems: "center", marginTop: 8 }}>
                  <input value={teile[teilIdxSicher].name || ""}
                    placeholder={"Name (z. B. Hinterhaus)"}
                    onChange={e => setTeile(t2 => t2.map((teil, i) =>
                      i === teilIdxSicher ? { ...teil, name: e.target.value } : teil))}
                    style={{ flex: 1, minWidth: 0, background: t.surface,
                      border: `1px solid ${t.border}`, borderRadius: RAD.sm,
                      padding: "6px 9px", fontSize: 16, fontFamily: "inherit", color: t.text }}/>
                  <AktionsButton rolle="loeschen" size={32} t={t} accent="#0080FF"
                    title="Diesen Teil entfernen (Belegungs-Verlauf des Teils geht verloren)"
                    onClick={() => {
                      const updated = entferneTeil({ ...einheit, teile }, teilIdxSicher);
                      setTeile(updated.teile);
                      setAktTeilIdx(0);
                    }}/>
                </div>
              )}
            </div>
          )}

          {belegungEdit ? (
            <HaushaltEditor einheit={{ ...einheit, teile }} t={t} accent={accent}
              kontakte={kontakte} setKontakte={setKontakte} teilIndex={teilIdxSicher}
              onKontaktClick={onKontaktClick}
              onChange={(updated) => setTeile(updated.teile)}/>
          ) : (
            <HaushaltAnzeige einheit={{ ...einheit, teile }} t={t} accent={accent}
              kontakte={kontakte} teilIndex={teilIdxSicher} onKontaktClick={onKontaktClick} setKontakte={setKontakte}/>
          )}
          <BelegungsHistorie teil={teile[teilIdxSicher]} t={t} kontakte={kontakte}/>
        </div>
      )}

    </div>
  );
}

// ── EinheitZeile (klickbar in GebaeudeKarte) ────────────────────────────────
function EinheitZeile({ einheit, t, accent, editMode, isActive, onToggle,
    belegungEdit = false, onToggleBelegung = null,
    onBelegungBestaetigen = null, onBelegungAbbrechen = null, gesperrt = false }) {
  const anzeige = useEinheitAnzeige();
  const aktiverEig = (einheit.eigentuemer || []).find(e => !e.bis);
  // Mieter ergibt sich jetzt aus dem Haushalt der laufenden Belegung (Typ Vermietung):
  // erstes benanntes Haushaltsmitglied mit Kontakt. Fallback auf das Legacy-Feld
  // einheit.mieter, solange Daten noch nicht auf das Schichtmodell überführt sind.
  let aktiverMieter = null;
  if (istVermietet(einheit)) {
    const bew = bewohnerMitKontakt(einheit);
    if (bew.length > 0) aktiverMieter = { name: bew[0].name, kontaktId: bew[0].kontaktId };
  }
  if (!aktiverMieter) aktiverMieter = (einheit.mieter || []).find(m => !m.bis) || null;
  const keinEigentuemer = !aktiverEig;
  // Fläche: bei Unterteilung Summe der Teile, sonst Legacy-Wert. flaecheVon gibt
  // eine Zahl; 0 → nichts anzeigen. Einheitliche Darstellung mit „m²".
  const flaecheNum = flaecheVon(einheit);
  const flaecheText = flaecheNum > 0 ? (Number.isInteger(flaecheNum) ? flaecheNum : flaecheNum.toFixed(1)) + " m²" : null;

  return (
    <div
      style={isActive ? {
        background: "transparent",
        transition: "all 0.1s", overflow: "hidden" } : {
        background: t.bg,
        border: `1px solid ${t.border}`, borderRadius: RAD.ms,
        marginBottom: 5, transition: "all 0.1s", overflow: "hidden" }}>
      <div onClick={onToggle} data-kb-item="1" style={{
        display: "flex", alignItems: "center", gap: 8, padding: "9px 12px",
        cursor: "pointer" }}>
        <Avatar size={32} accent={accent}
          text={(einheit.nr||"").replace(/^(WE|TE|SP|GE)[\s\-_]*/, "")}
          verwendungsZuweisungen={verwendungenVon(einheit)
            .map(v => ({ verwendung: v.name, status: v.status || "aktiv" }))}/>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: FS.m, fontWeight: FW.bold, color: t.text }}>
            {einheit.nr}
            {einheit.lage && <span style={{ fontWeight: FW.regular, color: t.sub, marginLeft: 5 }}>· {einheit.lage}</span>}
          </div>
          <div style={{ fontSize: FS.xs, color: t.sub, display: "flex", alignItems: "center", gap: 5, flexWrap: "wrap" }}>
            {anzeige.flaeche && flaecheText && <span>{flaecheText}</span>}
            {anzeige.mea && einheit.mea && <span>· MEA {einheit.mea}</span>}
            {anzeige.eigentuemer && aktiverEig && <span> · ET {extractNachname(aktiverEig.name)}</span>}
            {anzeige.mieter && aktiverMieter && <span style={{ color: bewohnerRecht("mieter").farbe }}> · MT {extractNachname(aktiverMieter.name)}</span>}
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
          {/* Hybrid: Verwendung (Vermietet/Eigennutzung/Leerstand) zeigt das
              Eck-Badge am Avatar. Hier bleibt nur die Warnung als Handlungssignal. */}
          {keinEigentuemer && <span style={{ fontSize: FS.xxs, padding: "1px 5px", borderRadius: RAD.sm,
            background: accent + "15", color: accent, border: `1px solid ${accent}30` }}>Eigentümer fehlt</span>}
          {/* Runder Belegungs-Stift — nur wenn Einheit offen und NICHT im Struktur-
              Modus. Steuert den Belegungs-/Zuweisungs-Modus (Eigentümer-/Mieter-
              wechsel, Haushalt). Bewohner-Akzent blau, analog zum Objekt-Stift. */}
          {isActive && !editMode && !gesperrt && onToggleBelegung && (
            belegungEdit ? (
              <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                <button onClick={(e) => { e.stopPropagation(); if (onBelegungAbbrechen) onBelegungAbbrechen(); }}
                  title="Abbrechen — Änderungen verwerfen" aria-label="Abbrechen"
                  style={{ display: "flex", alignItems: "center", justifyContent: "center",
                    width: 32, height: 32, flexShrink: 0, cursor: "pointer",
                    background: accent, border: "none", borderRadius: RAD.pill,
                    boxShadow: `0 1px 2px ${accent}40` }}>
                  <I name="x" size={14} color="#EF4444"/>
                </button>
                <button onClick={(e) => { e.stopPropagation(); if (onBelegungBestaetigen) onBelegungBestaetigen(); }}
                  title="Fertig — Änderungen behalten" aria-label="Fertig"
                  style={{ display: "flex", alignItems: "center", justifyContent: "center",
                    width: 32, height: 32, flexShrink: 0, cursor: "pointer",
                    background: accent, border: "none", borderRadius: RAD.pill,
                    boxShadow: `0 1px 2px ${accent}40` }}>
                  <I name="check" size={13} color={getContrastColor(accent)}/>
                </button>
              </div>
            ) : (
              <button onClick={(e) => { e.stopPropagation(); onToggleBelegung(); }}
                title="Belegung bearbeiten" aria-label="Belegung bearbeiten"
                style={{ display: "flex", alignItems: "center", justifyContent: "center",
                  width: 32, height: 32, flexShrink: 0, cursor: "pointer",
                  background: accent, border: "none", borderRadius: RAD.pill,
                  boxShadow: `0 1px 2px ${accent}40` }}>
                <I name="pencil" size={13} color={getContrastColor(accent)}/>
              </button>
            )
          )}
        </div>
      </div>
    </div>
  );
}


// ── KontaktZuweisungForm (Modal-Inhalt: bestehende Person/Firma wählen + Rolle) ─
function KontaktZuweisungForm({ t, accent, ves, kontakte, typ, onSave, onCancel }) {
  const [kontaktId, setKontaktId] = useState("");

  const passendeKontakte = (kontakte || []).filter(k => k.typ === typ);
  const inputStyle = feldInput(t, { fontSize: FS.m });

  return (
    <div style={{ background: accent + "0A", border: `1px dashed ${accent}55`,
      borderRadius: RAD.md, padding: 10, marginTop: 6 }}>
      <div style={{ fontSize: FS.s, fontWeight: FW.bold, color: accent, marginBottom: 8 }}>
        {typ === "person" ? "Person zuweisen" : "Firma zuweisen"}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 8 }}>
        <select value={kontaktId} onChange={e => setKontaktId(e.target.value)} style={inputStyle}>
          <option value="">{typ === "person" ? "Person wählen…" : "Firma wählen…"}</option>
          {passendeKontakte.map(k => <option key={k.id} value={k.id}>{k.name}</option>)}
        </select>
      </div>
      {kontaktId && (
        <BeziehungEditor initial={{ objektId: ves[0] ? ves[0].id : "" }} ves={ves} kontakte={kontakte}
          t={t} accent={accent} typ={typ}
          onCancel={onCancel}
          onSave={(eintrag) => onSave(Number(kontaktId), eintrag)}/>
      )}
      {!kontaktId && (
        <div style={{ display: "flex", justifyContent: "flex-end" }}>
          <AktionsButton variante="breit" rolle="abbrechen" onClick={onCancel}
            text="Abbrechen" icon={false} t={t} accent={accent}/>
        </div>
      )}
    </div>
  );
}


// ── Vertrags-Bausteine (Konstanten + VertragForm) ───────────────────────────
const VERTRAG_TYPEN = [
  "Wartungsvertrag", "Hausmeistervertrag", "Reinigungsvertrag", "Winterdienst",
  "Grünpflege", "Müllabfuhr", "Brandschutz", "Sonstiges"
];

const VERTRAG_INTERVALLE = [
  "monatlich", "quartalsweise", "halbjährlich", "jährlich",
  "alle 2 Jahre", "nach Bedarf"
];

// Versicherungsarten für das Versicherungs-Formular (statt der allgemeinen
// Vertragstypen). Reihenfolge nach Häufigkeit in der WEG-Praxis.
const VERSICHERUNG_ARTEN = [
  "Gebäudeversicherung", "Haus- und Grundbesitzerhaftpflicht", "Glasversicherung",
  "Elementarschaden", "Gewässerschaden (Öltank)", "Technische Versicherung",
  "Rechtsschutz", "Verwaltungsbeiratshaftpflicht", "Sonstige"
];
// Eingeschlossene Risiken (Mehrfach-Auswahl) für die Versicherungs-Karte.
const VERSICHERUNG_RISIKEN = [
  "Feuer", "Leitungswasser", "Sturm/Hagel", "Elementar", "Glas", "Überspannung"
];
// Gängige Optionen für die Versicherungs-Dropdowns (jeweils mit „Andere…" als
// Freitext-Option am Ende der Auswahl).
const SELBSTBEHALT_OPTIONEN = ["0 €", "150 €", "250 €", "500 €", "1.000 €"];
const VERS_SUMME_OPTIONEN = ["gleitender Neuwert", "Wert 1914", "fester Betrag"];
const KUENDIGUNG_OPTIONEN = ["3 Monate zum Jahresende", "1 Monat", "3 Monate"];
const ANDERE_OPTION = "Andere…";
// Versorger-Sparten + Messdienst-Optionen.
const VERSORGER_SPARTEN = ["Strom", "Gas", "Wasser", "Abwasser", "Fernwärme", "Kabel/Internet"];
const MESSDIENST_MEDIEN = ["Heizung", "Warmwasser", "Kaltwasser", "RWM"];
const MESSDIENST_GERAETEART = ["Funk", "manuell"];
const MESSDIENST_GERAETEMODELL = ["Kauf", "Miete"];
const MESSDIENST_LAUFZEIT = ["6 Jahre", "8 Jahre", "10 Jahre"];


function VertragForm({ t, accent, kontakte, onSave, onCancel, initial = null, kontext = "vertrag", setKontakte = null, wjWert = "" }) {
  const istVersicherung = kontext === "versicherung";
  const istVersorger = kontext === "versorger";
  const istMessdienst = kontext === "messdienst";
  const formRef = useRef(null);
  const istDesktop = useWindowWidth() >= DESKTOP_MIN_WIDTH;
  // Beim Öffnen das Formular vollständig in den sichtbaren Bereich scrollen —
  // sonst läuft es (besonders auf Mobile) unten aus dem Display und der
  // „Hinzufügen"-Button ist nicht erreichbar.
  useEffect(() => {
    const el = formRef.current;
    if (!el || !el.scrollIntoView) return;
    const id = setTimeout(() => {
      if (formRef.current) formRef.current.scrollIntoView({ block: "end", behavior: "smooth" });
    }, 60);
    return () => clearTimeout(id);
  }, []);
  const [typ, setTyp] = useState(initial ? (initial.typ || "") : "");
  const [leistung, setLeistung] = useState(initial ? (initial.leistung || "") : "");
  const [intervall, setIntervall] = useState(initial ? (initial.intervall || "") : "");
  const [firmaId, setFirmaId] = useState(initial && initial.firmaId != null ? String(initial.firmaId) : "");
  const [vertragsnr, setVertragsnr] = useState(initial ? (initial.vertragsnr || "") : "");
  const [ab, setAb] = useState(initial ? (initial.ab || "") : "");
  const [bis, setBis] = useState(initial ? (initial.bis || "") : "");
  // Versicherungsmakler (Firma) — optional verknüpft, nur im Versicherungs-Kontext.
  const [maklerId, setMaklerId] = useState(initial && initial.maklerId != null ? initial.maklerId : null);
  // Versicherungs-spezifische Felder (nur im Versicherungs-Kontext).
  const [selbstbeteiligung, setSelbstbeteiligung] = useState(initial ? (initial.selbstbeteiligung || "") : "");
  const [versSumme, setVersSumme] = useState(initial ? (initial.versSumme || "") : "");
  const [kuendigungsfrist, setKuendigungsfrist] = useState(initial ? (initial.kuendigungsfrist || "") : ((kontext === "versicherung" || kontext === "versorger") ? "3 Monate zum Jahresende" : ""));
  const [schadenmeldung, setSchadenmeldung] = useState(initial ? (initial.schadenmeldung || "") : "");
  const [risiken, setRisiken] = useState(initial && Array.isArray(initial.risiken) ? initial.risiken.slice() : []);
  const toggleRisiko = (r) => setRisiken(prev => prev.indexOf(r) >= 0 ? prev.filter(x => x !== r) : prev.concat([r]));
  // Versorger-Felder.
  const [zaehlernr, setZaehlernr] = useState(initial ? (initial.zaehlernr || "") : "");
  // Messdienst-Felder. (abrechnungszeitraum entfernt v9.64 — nie als Eingabe
  // gerendert/angezeigt, durch das aus dem ETV-Stamm abgeleitete wirtschaftsjahr ersetzt.)
  const [kundennr, setKundennr] = useState(initial ? (initial.kundennr || "") : "");
  const [geraeteart, setGeraeteart] = useState(initial ? (initial.geraeteart || "") : "");
  const [geraetemodell, setGeraetemodell] = useState(initial ? (initial.geraetemodell || "") : "");
  const [geraetelaufzeit, setGeraetelaufzeit] = useState(initial ? (initial.geraetelaufzeit || "") : "");
  const [medien, setMedien] = useState(initial && Array.isArray(initial.medien) ? initial.medien.slice() : []);
  const toggleMedium = (m) => setMedien(prev => prev.indexOf(m) >= 0 ? prev.filter(x => x !== m) : prev.concat([m]));
  // Gewählte Mitarbeiter: { personId, funktion } — mehrere möglich, freie
  // Funktionsbezeichnung (z. B. „Büro/Rechnung", „Ausführend").
  const [mitarbeiter, setMitarbeiter] = useState(initial && Array.isArray(initial.mitarbeiter)
    ? initial.mitarbeiter.map(m => ({ personId: m.personId, funktion: m.funktion || "" }))
    : []);
  const inputStyle = feldInput(t, { fontSize: FS.m });
  // Messdienst hat keinen Typ; dort genügt Firma oder Eingabe. Sonst Typ Pflicht.
  const valid = istMessdienst ? true : !!typ;

  // Dropdown mit festen Optionen + „Andere…"-Freitext. Der Freitext-Modus wird
  // aus dem Wert abgeleitet: nicht leer und nicht in den Optionen → Freitext.
  // Kein eigener Hook — als reine Render-Funktion gebaut (Regel: keine Hooks in
  // verschachtelten Funktionen).
  const renderAuswahl = (wert, setWert, optionen, platzhalter, freitextPlatzhalter, extraStyle) => {
    const istAndere = wert && optionen.indexOf(wert) < 0;
    return (
      <div style={extraStyle || { display: "flex", flexDirection: "column", gap: 6 }}>
        <select value={istAndere ? ANDERE_OPTION : wert}
          onChange={e => { const v = e.target.value; setWert(v === ANDERE_OPTION ? " " : (v === "" ? "" : v)); }}
          style={{ ...inputStyle, color: wert ? t.text : t.muted, appearance: "auto" }}>
          <option value="">{platzhalter}</option>
          {optionen.map(o => <option key={o} value={o}>{o}</option>)}
          <option value={ANDERE_OPTION}>{ANDERE_OPTION}</option>
        </select>
        {istAndere && (
          <input type="text" autoFocus placeholder={freitextPlatzhalter || "Wert eingeben…"}
            value={wert === " " ? "" : wert} onChange={e => setWert(e.target.value)} style={inputStyle}/>
        )}
      </div>
    );
  };

  // Mitarbeiter der gewählten Firma (Personen mit firmaId === gewählte Firma).
  const firmaIdNum = firmaId ? Number(firmaId) : null;
  const verfuegbareMa = firmaIdNum ? getFirmaMitarbeiter(firmaIdNum, kontakte) : [];

  const toggleMa = (personId) => {
    setMitarbeiter(prev => prev.some(m => m.personId === personId)
      ? prev.filter(m => m.personId !== personId)
      : [...prev, { personId, funktion: "" }]);
  };
  const setMaFunktion = (personId, funktion) => {
    setMitarbeiter(prev => prev.map(m => m.personId === personId ? { ...m, funktion } : m));
  };

  return (
    <div ref={formRef} style={{ background: accent + "0A", border: `1px dashed ${accent}55`,
      borderRadius: RAD.md, padding: 10, marginTop: 6 }}>
      <div style={{ fontSize: FS.s, fontWeight: FW.bold, color: accent, marginBottom: 8 }}>
        {initial
          ? (istVersorger ? "Versorger bearbeiten" : istMessdienst ? "Messdienst bearbeiten" : "Vertrag bearbeiten")
          : (istVersorger ? "Neuer Versorger" : istMessdienst ? "Neuer Messdienst" : "Neuer Vertrag")}
      </div>
      <div style={istDesktop
        ? { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }
        : { display: "flex", flexDirection: "column", gap: 6 }}>
        {/* Typ/Sparte: Versorger = Sparte-Dropdown; Messdienst = kein Typfeld;
            sonst Versicherungsart/Vertragstyp. */}
        {istVersorger ? (
          <select value={typ} onChange={e => setTyp(e.target.value)} style={{ ...inputStyle, color: typ ? t.text : t.muted }}>
            <option value="">Sparte wählen…</option>
            {VERSORGER_SPARTEN.map(x => <option key={x} value={x}>{x}</option>)}
          </select>
        ) : !istMessdienst ? (
          <select value={typ} onChange={e => setTyp(e.target.value)} style={{ ...inputStyle, color: typ ? t.text : t.muted }}>
            <option value="">{istVersicherung ? "Versicherungsart wählen…" : "Vertragstyp wählen…"}</option>
            {(istVersicherung ? VERSICHERUNG_ARTEN : VERTRAG_TYPEN).map(x => <option key={x} value={x}>{x}</option>)}
          </select>
        ) : null}
        {/* Leistung nur bei allgemeinem Vertrag. */}
        {!istVersicherung && !istVersorger && !istMessdienst && (
          <input type="text" placeholder="Leistung (z. B. Heizung, Aufzug)" value={leistung}
            onChange={e => setLeistung(e.target.value)} style={inputStyle}/>
        )}
        {/* Intervall nur bei allgemeinem Vertrag. */}
        {!istVersicherung && !istVersorger && !istMessdienst && (
          <select value={intervall} onChange={e => setIntervall(e.target.value)} style={inputStyle}>
            <option value="">Intervall wählen…</option>
            {VERTRAG_INTERVALLE.map(x => <option key={x} value={x}>{x}</option>)}
          </select>
        )}
        {/* Vertrags-/Kundennummer — Label je Kontext. */}
        <input type="text" value={vertragsnr} onChange={e => setVertragsnr(e.target.value)} style={inputStyle}
          placeholder={istVersorger ? "Vertrags-/Kundennummer" : istMessdienst ? "Vertrags-Nr. (optional)" : "Vertrags-Nr."}/>
        {/* Zählernummer — nur Versorger. */}
        {istVersorger && (
          <input type="text" placeholder="Zählernummer" value={zaehlernr}
            onChange={e => setZaehlernr(e.target.value)} style={inputStyle}/>
        )}
        {/* Kundennummer/Liegenschaftsnummer — nur Messdienst. */}
        {istMessdienst && (
          <input type="text" placeholder="Kundennummer / Liegenschaftsnr." value={kundennr}
            onChange={e => setKundennr(e.target.value)} style={inputStyle}/>
        )}
        <select value={firmaId} onChange={e => { setFirmaId(e.target.value); setMitarbeiter([]); }}
          style={istDesktop ? { ...inputStyle, gridColumn: "1 / -1" } : inputStyle}>
          <option value="">{istVersicherung ? "Versicherer wählen (optional)…"
            : istVersorger ? "Versorger wählen (optional)…"
            : istMessdienst ? "Messdienstleister wählen (optional)…"
            : "Firma wählen (optional)…"}</option>
          {(kontakte || []).filter(k => k.typ === "firma").map(f =>
            <option key={f.id} value={f.id}>{f.name}</option>
          )}
        </select>
      </div>
      {/* Laufzeit als echte Datumsfelder — Desktop 2 Spalten, Mobile
          untereinander, damit auf schmalen Screens nichts rechts rausläuft. */}
      <div style={(istDesktop && !istMessdienst)
        ? { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, marginTop: 6 }
        : { display: "flex", flexDirection: "column", gap: 6, marginTop: 6 }}>
        <DatumFeld label="Laufzeit ab" value={ab} onChange={setAb}
          t={t} accent={accent} defaultHeute={false}/>
        {!istMessdienst && (
          <DatumFeld label="Laufzeit bis (optional)" value={bis} onChange={setBis}
            t={t} accent={accent} defaultHeute={false}/>
        )}
      </div>

      {/* Versicherungsmakler — Firma verknüpfen (optional). Nutzt den überall
          verwendeten KontaktPicker (Suche, „+ Neu anlegen", rotes x). */}
      {istVersicherung && (
        <div style={{ marginTop: 10 }}>
          <div style={{ fontSize: FS.xs, fontWeight: FW.semi, color: t.sub, marginBottom: 6,
            letterSpacing: "0.04em", textTransform: "uppercase" }}>Makler (optional)</div>
          <KontaktPicker value={maklerId} onChange={(kid) => setMaklerId(kid || null)}
            label="" t={t} accent={accent} editMode={true} nurFirmen
            kontakte={kontakte} setKontakte={setKontakte}/>
        </div>
      )}

      {/* Versicherungs-spezifische Felder: Selbstbeteiligung, Versicherungssumme,
          eingeschlossene Risiken, Kündigungsfrist, Schadenmeldung. */}
      {istVersicherung && (
        <div style={{ marginTop: 10 }}>
          <div style={istDesktop
            ? { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }
            : { display: "flex", flexDirection: "column", gap: 6 }}>
            {renderAuswahl(selbstbeteiligung, setSelbstbeteiligung, SELBSTBEHALT_OPTIONEN,
              "Selbstbeteiligung wählen…", "Selbstbeteiligung (€)")}
            {renderAuswahl(kuendigungsfrist, setKuendigungsfrist, KUENDIGUNG_OPTIONEN,
              "Kündigungsfrist wählen…", "Kündigungsfrist")}
            {renderAuswahl(versSumme, setVersSumme, VERS_SUMME_OPTIONEN,
              "Versicherungssumme wählen…", "Versicherungssumme",
              istDesktop ? { gridColumn: "1 / -1", display: "flex", flexDirection: "column", gap: 6 } : { display: "flex", flexDirection: "column", gap: 6 })}
            <input type="text" placeholder="Schadenmeldung / Hotline (Tel. oder Portal)" value={schadenmeldung}
              onChange={e => setSchadenmeldung(e.target.value)}
              style={istDesktop ? { ...inputStyle, gridColumn: "1 / -1" } : inputStyle}/>
          </div>
          {/* Eingeschlossene Risiken — Mehrfach-Auswahl als Chips */}
          <div style={{ fontSize: FS.xs, fontWeight: FW.semi, color: t.sub, margin: "10px 0 6px",
            letterSpacing: "0.04em", textTransform: "uppercase" }}>Mitversichert</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
            {VERSICHERUNG_RISIKEN.map(r => {
              const aktiv = risiken.indexOf(r) >= 0;
              return (
                <button key={r} onClick={() => toggleRisiko(r)} style={{
                  background: aktiv ? accent + "20" : t.surface,
                  border: `1px solid ${aktiv ? accent + "60" : t.border}`,
                  borderRadius: RAD.ms, padding: "4px 9px", cursor: "pointer", fontSize: FS.s,
                  color: aktiv ? accent : t.sub, fontFamily: "inherit",
                  display: "flex", alignItems: "center", gap: 4 }}>
                  {aktiv && <I name="check" size={10} color={accent}/>}{r}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Versorger: Kündigungsfrist (Dropdown + Andere…). */}
      {istVersorger && (
        <div style={{ marginTop: 10 }}>
          {renderAuswahl(kuendigungsfrist, setKuendigungsfrist, KUENDIGUNG_OPTIONEN,
            "Kündigungsfrist wählen…", "Kündigungsfrist")}
        </div>
      )}

      {/* Messdienst: Wirtschaftsjahr (synchron, read-only), Geräte-Kauf/Miete,
          Gerätelaufzeit, Geräteart, erfasste Medien. */}
      {istMessdienst && (
        <div style={{ marginTop: 10 }}>
          <div style={istDesktop
            ? { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }
            : { display: "flex", flexDirection: "column", gap: 6 }}>
            {/* Wirtschaftsjahr — read-only, kommt aus den ETV-Stammdaten. */}
            <div style={{ ...inputStyle, color: wjWert ? t.text : t.muted,
              display: "flex", alignItems: "center", gap: 6, cursor: "default" }}>
              <span style={{ fontSize: FS.xs, color: t.muted }}>Wirtschaftsjahr:</span>
              <span>{wjWert || "—"}</span>
            </div>
            <select value={geraetemodell} onChange={e => setGeraetemodell(e.target.value)}
              style={{ ...inputStyle, color: geraetemodell ? t.text : t.muted }}>
              <option value="">Geräte: Kauf / Miete…</option>
              {MESSDIENST_GERAETEMODELL.map(x => <option key={x} value={x}>{x}</option>)}
            </select>
            <select value={geraetelaufzeit} onChange={e => setGeraetelaufzeit(e.target.value)}
              style={{ ...inputStyle, color: geraetelaufzeit ? t.text : t.muted }}>
              <option value="">Laufzeit wählen…</option>
              {MESSDIENST_LAUFZEIT.map(x => <option key={x} value={x}>{x}</option>)}
            </select>
            <select value={geraeteart} onChange={e => setGeraeteart(e.target.value)}
              style={{ ...inputStyle, color: geraeteart ? t.text : t.muted }}>
              <option value="">Geräteart wählen…</option>
              {MESSDIENST_GERAETEART.map(x => <option key={x} value={x}>{x}</option>)}
            </select>
          </div>
          {/* Erfasste Medien — Mehrfach-Auswahl als Chips */}
          <div style={{ fontSize: FS.xs, fontWeight: FW.semi, color: t.sub, margin: "10px 0 6px",
            letterSpacing: "0.04em", textTransform: "uppercase" }}>Erfasste Medien</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
            {MESSDIENST_MEDIEN.map(m => {
              const aktiv = medien.indexOf(m) >= 0;
              return (
                <button key={m} onClick={() => toggleMedium(m)} style={{
                  background: aktiv ? accent + "20" : t.surface,
                  border: `1px solid ${aktiv ? accent + "60" : t.border}`,
                  borderRadius: RAD.ms, padding: "4px 9px", cursor: "pointer", fontSize: FS.s,
                  color: aktiv ? accent : t.sub, fontFamily: "inherit",
                  display: "flex", alignItems: "center", gap: 4 }}>
                  {aktiv && <I name="check" size={10} color={accent}/>}{m}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Mitarbeiter der gewählten Firma — Mehrfachauswahl + freie Funktion */}
      {firmaIdNum && (
        <div style={{ marginTop: 10 }}>
          <div style={{ fontSize: FS.xs, fontWeight: FW.semi, color: t.sub, marginBottom: 6,
            letterSpacing: "0.04em", textTransform: "uppercase" }}>Ansprechpartner</div>
          {verfuegbareMa.length === 0 ? (
            <div style={{ fontSize: FS.s, color: t.muted, fontStyle: "italic" }}>
              Keine Mitarbeiter bei dieser Firma hinterlegt.
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
              {verfuegbareMa.map(({ person, rolle }) => {
                const gewaehlt = mitarbeiter.find(m => m.personId === person.id);
                return (
                  <div key={person.id} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <button onClick={() => toggleMa(person.id)} type="button"
                      style={{ display: "flex", alignItems: "center", gap: 6, flex: "0 0 auto",
                        minWidth: 0, maxWidth: "48%",
                        background: gewaehlt ? accent + "18" : t.surface,
                        border: `1px solid ${gewaehlt ? accent + "60" : t.border}`,
                        borderRadius: RAD.sm, padding: "5px 8px", cursor: "pointer",
                        fontSize: FS.s, color: gewaehlt ? accent : t.sub, fontFamily: "inherit" }}>
                      <I name={gewaehlt ? "check" : "plus"} size={11} color={gewaehlt ? accent : t.muted}/>
                      <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {person.name || ((person.vorname || "") + " " + (person.nachname || "")).trim() || "—"}
                        {rolle && <span style={{ color: t.muted, fontWeight: FW.regular }}> · {rolle}</span>}
                      </span>
                    </button>
                    {gewaehlt && (
                      <input type="text"
                        placeholder={rolle ? "Abweichende Funktion (optional)" : "Funktion (z. B. Büro/Rechnung)"}
                        value={gewaehlt.funktion}
                        onChange={e => setMaFunktion(person.id, e.target.value)}
                        style={{ ...inputStyle, flex: 1, minWidth: 0 }}/>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      <div style={{ display: "flex", gap: 6, justifyContent: "flex-end", marginTop: 8 }}>
        <AktionsButton variante="breit" rolle="abbrechen" onClick={onCancel}
          text="Abbrechen" icon={false} t={t} accent={accent}/>
        <AktionsButton variante="breit" rolle="bestaetigen" disabled={!valid}
          onClick={() => onSave({ typ: (istMessdienst && !typ) ? "Messdienst" : typ, leistung, intervall, firmaId: firmaIdNum, vertragsnr, ab, bis,
            maklerId: maklerId || null,
            selbstbeteiligung: (selbstbeteiligung || "").trim(), versSumme: (versSumme || "").trim(),
            kuendigungsfrist: (kuendigungsfrist || "").trim(), schadenmeldung,
            risiken: risiken.slice(),
            zaehlernr: (zaehlernr || "").trim(), kundennr: (kundennr || "").trim(),
            geraeteart,
            geraetemodell, geraetelaufzeit, wirtschaftsjahr: wjWert || "",
            medien: medien.slice(),
            mitarbeiter: mitarbeiter.filter(m => m.personId) })}
          text={initial ? "Speichern" : "Hinzufügen"} icon={false} t={t} accent={accent}/>
      </div>
    </div>
  );
}

// ── TechnikKarte (Geräte: Aufzug, Heizung, Lüftung, …) ──────────────────────
// Zweistufige Auswahl: erst Kategorie, dann konkreter Anlagentyp.
const TECHNIK_KATEGORIEN = [
  { id: "energie", label: "Energie & Heizung", icon: "🔥", typen: [
    { id: "heizung",       label: "Heizungsanlage",            icon: "🔥" },
    { id: "bhkw",          label: "Blockheizkraftwerk (BHKW)", icon: "⚙" },
    { id: "pv",            label: "Solar / Photovoltaik",      icon: "☀" },
    { id: "warmwasser",    label: "Warmwasserspeicher / Boiler", icon: "♨" },
    { id: "fbh_verteiler", label: "Fußbodenheizungs-Verteiler", icon: "🔧" },
    { id: "oeltank",       label: "Öltankanlage",              icon: "🛢" },
  ]},
  { id: "sanitaer", label: "Sanitär & Wasser", icon: "🚰", typen: [
    { id: "enthaertung",   label: "Wasserenthärtung / Entkalkung", icon: "💧" },
    { id: "hebeanlage",    label: "Hebeanlage (Abwasser)",     icon: "⬆" },
    { id: "fettabscheider",label: "Fettabscheider",            icon: "🛢" },
    { id: "druckerhoehung",label: "Druckerhöhungsanlage",      icon: "🔧" },
    { id: "trinkwasserfilter", label: "Trinkwasser-Filterstation", icon: "💧" },
    { id: "zirkulationspumpe", label: "Zirkulationspumpen",    icon: "🔧" },
  ]},
  { id: "lueftung", label: "Lüftung & Klima", icon: "💨", typen: [
    { id: "lueftung",      label: "Zentrale Lüftung / Wohnraumlüftung", icon: "💨" },
    { id: "klima",         label: "Klimaanlage / Split-Gerät", icon: "❄" },
    { id: "tg_lueftung",   label: "Tiefgaragenlüftung",        icon: "💨" },
    { id: "rwa",           label: "RWA (Rauch-/Wärmeabzug)",   icon: "🌫" },
  ]},
  { id: "elektro", label: "Elektro & Kommunikation", icon: "🔌", typen: [
    { id: "hauptverteiler",label: "Hauptverteiler / Zähleranlage", icon: "🔢" },
    { id: "notstrom",      label: "Notstromaggregat",          icon: "🔋" },
    { id: "blitzschutz",   label: "Blitzschutzanlage",         icon: "⚡" },
    { id: "medienverteiler", label: "Medienverteiler (SAT/Kabel/Glasfaser)", icon: "📡" },
    { id: "sprechanlage",  label: "Sprech- / Klingelanlage",   icon: "🔔" },
    { id: "wallbox",       label: "Wallbox / E-Ladestation",   icon: "🔌" },
  ]},
  { id: "sicherheit", label: "Sicherheit & Brandschutz", icon: "🛡", typen: [
    { id: "bma",           label: "Brandmeldeanlage (BMA)",    icon: "🚨" },
    { id: "rwm",           label: "Rauchwarnmelder (vernetzt)", icon: "🔥" },
    { id: "sprinkler",     label: "Sprinkleranlage",           icon: "💦" },
    { id: "ema",           label: "Einbruchmeldeanlage (EMA)", icon: "🚨" },
    { id: "cctv",          label: "Videoüberwachung (CCTV)",   icon: "📹" },
    { id: "feststellanlage", label: "Feststellanlage Brandschutztür", icon: "🚪" },
  ]},
  { id: "foerder", label: "Förder & Zugänge", icon: "🛗", typen: [
    { id: "aufzug",        label: "Personen- / Lastenaufzug",  icon: "🛗" },
    { id: "doppelparker",  label: "Doppelparker",              icon: "🅿️" },
    { id: "garagentor",    label: "Tiefgaragentor (elektr.)",  icon: "🚪" },
    { id: "schranke",      label: "Schrankenanlage",           icon: "🚧" },
    { id: "automatiktuer", label: "Automatik- / Schiebetür",   icon: "🚪" },
    { id: "zaehler",       label: "Zähler",                    icon: "🔢" },
  ]},
];
// Flache Liste aller Typen (für Form-Auflösung & Bestandsdaten-Lookup).
const TECHNIK_GERAET_TYPEN = TECHNIK_KATEGORIEN.reduce((acc, k) => acc.concat(k.typen), []);

// System-/Bauart-Optionen je Anlagentyp. Wird als select-Feld mit Freitext
// („Andere…") ins Geräteschema gelegt — nur für Typen, die hier Optionen haben.
const TECHNIK_SYSTEM_OPTIONEN = {
  heizung:        ["Gas-Brennwert", "Gas-Niedertemperatur", "Öl-Brennwert", "Öl-Niedertemperatur",
                   "Wärmepumpe (Luft)", "Wärmepumpe (Sole/Erdwärme)", "Wärmepumpe (Wasser)",
                   "Fernwärme", "Pelletheizung", "Holzvergaser", "Elektroheizung", "Hybridheizung"],
  bhkw:           ["Erdgas", "Flüssiggas", "Heizöl", "Pflanzenöl", "Brennstoffzelle"],
  pv:             ["Aufdach", "Indach", "Flachdach", "Fassade", "Balkonkraftwerk", "mit Speicher", "ohne Speicher"],
  warmwasser:     ["Zentralspeicher", "Durchlauferhitzer", "Frischwasserstation", "Boiler dezentral", "Solarthermie"],
  oeltank:        ["Stahltank (oberirdisch)", "Stahltank (erdverlegt)", "GFK-Tank", "Batterietank (Kunststoff)", "Erdtank"],
  enthaertung:    ["Ionenaustauscher", "Umkehrosmose", "Dosieranlage", "Magnetisch/physikalisch"],
  hebeanlage:     ["Schmutzwasser", "Fäkalienhebeanlage", "Regenwasser", "Doppelanlage"],
  druckerhoehung: ["Einzelpumpe", "Doppelpumpe", "Druckbehälteranlage", "drehzahlgeregelt"],
  lueftung:       ["Zentrale Lüftung mit WRG", "Zentrale Lüftung ohne WRG", "Dezentral", "Abluftanlage"],
  klima:          ["Split-Gerät", "Multisplit", "VRF/VRV", "Kaltwassersatz", "Monoblock"],
  hauptverteiler: ["Zählerschrank", "Hauptverteilung (NSHV)", "Unterverteilung", "Wandlermessung"],
  notstrom:       ["Diesel-Aggregat", "Gas-Aggregat", "USV / Batterie", "Netzersatzanlage"],
  bma:            ["Konventionell", "Adressierbar", "Funk", "mit Aufschaltung Feuerwehr"],
  rwm:            ["Funkvernetzt", "Drahtvernetzt", "Einzelmelder", "mit Ferninspektion"],
  aufzug:         ["Seilaufzug", "Hydraulikaufzug", "Maschinenraumlos (MRL)", "Treppenlift", "Plattformlift"],
  doppelparker:   ["Abhängige Parker (2-fach)", "Unabhängige Parker", "Verschiebeparker", "Parkpalette"],
  garagentor:     ["Sektionaltor", "Rolltor", "Schwingtor", "Kipptor", "Schiebetor"],
  schranke:       ["Knickarmschranke", "Geradschranke", "Poller (versenkbar)"],
  wallbox:        ["AC 11 kW", "AC 22 kW", "DC-Schnelllader", "mit Lastmanagement", "Plug & Charge"],
  garagentor_tg:  ["Sektionaltor", "Rolltor", "Gittertor"],
};

// Vordefiniertes Feld-Schema für ein neues Gerät (neues System: eine FieldList
// pro Gerät). Alle Felder sind löschbar (kein _stamm) — der Nutzer kann das
// Schema je Gerät frei anpassen und beliebige eigene Felder ergänzen.
//   System              → select (je Anlagentyp; nur wenn Optionen existieren)
//   Hersteller          → text
//   Baujahr             → number
//   Nummer / Serien-Nr. → text
//   Wartungsfirma       → kontakt (ersetzt das frühere Freitext-„Notruf")
//   Letzte Wartung      → date
//   Nächste Wartung     → date
//   Zugang / Ansprechp. → kontakt (Hausmeister/Ansprechpartner; ersetzt Freitext)
// Hinweis: Standort entfällt — die Verortung läuft über den Zuordnungs-Block
// (Haus → Raum/Einheit/Tiefgarage) direkt am Gerät, nicht über ein Feld.
function technikStandardfelder(typId) {
  const t0 = Date.now();
  const felder = [];
  const sysOpt = typId && TECHNIK_SYSTEM_OPTIONEN[typId];
  if (sysOpt && sysOpt.length > 0) {
    felder.push({ id: t0 + 1, name: "System", type: "select", value: "",
      optionen: sysOpt.slice(), freitextBei: "Andere…" });
  }
  felder.push(
    { id: t0 + 2, name: "Hersteller",          type: "text",    value: "" },
    { id: t0 + 3, name: "Baujahr",             type: "number",  value: "" },
    { id: t0 + 4, name: "Nummer / Serien-Nr.", type: "text",    value: "" },
    { id: t0 + 5, name: "Wartungsfirma",       type: "kontakt", value: "", kontaktId: null },
    { id: t0 + 6, name: "Letzte Wartung",      type: "date",    value: "" },
    { id: t0 + 7, name: "Nächste Wartung",     type: "date",    value: "" },
    { id: t0 + 8, name: "Zugang / Ansprechpartner", type: "kontakt", value: "", kontaktId: null }
  );
  return felder;
}

// Migration: Bestandsgeräte mit alten festen Properties (hersteller, baujahr,
// nummer, notruf, standort, zugang + untypisierte felder[]) auf das neue
// FieldList-Schema heben. Vorhandene felder[] bleiben (als text), die alten
// Properties werden vorangestellt — nur sofern sie noch nicht als Feld
// existieren. „notruf" wird, falls befüllt, als Text-Feld „Notruf (alt)"
// erhalten (kein Datenverlust); neue Geräte bekommen kein Notruf-Feld.
function ergaenzeTechnikGeraetFelder(g) {
  if (!g || typeof g !== "object") return g;
  const hatAlteProps = ("hersteller" in g) || ("baujahr" in g) || ("nummer" in g)
    || ("notruf" in g) || ("standort" in g) || ("zugang" in g);
  // Schon migriert: hat felder[] und keine alten Top-Level-Properties mehr.
  if (Array.isArray(g.felder) && !hatAlteProps) return g;
  const bestehende = Array.isArray(g.felder) ? g.felder.slice() : [];
  const hatFeld = (nm) => bestehende.some(f => f && f.name === nm);
  const neu = [];
  let seq = (g.id ? Number(g.id) : Date.now()) % 100000;
  const mk = (name, type, value, extra) => {
    seq += 1;
    return Object.assign({ id: Date.now() + seq, name: name, type: type, value: value || "" }, extra || {});
  };
  if (("hersteller" in g) && g.hersteller && !hatFeld("Hersteller"))
    neu.push(mk("Hersteller", "text", g.hersteller));
  if (("baujahr" in g) && (g.baujahr || g.baujahr === 0) && !hatFeld("Baujahr"))
    neu.push(mk("Baujahr", "number", String(g.baujahr)));
  if (("nummer" in g) && g.nummer && !hatFeld("Nummer / Serien-Nr."))
    neu.push(mk("Nummer / Serien-Nr.", "text", g.nummer));
  if (("notruf" in g) && g.notruf && !hatFeld("Notruf (alt)"))
    neu.push(mk("Notruf (alt)", "text", g.notruf));
  if (("standort" in g) && g.standort && !hatFeld("Standort (alt)"))
    neu.push(mk("Standort (alt)", "text", g.standort));
  if (("zugang" in g) && g.zugang && !hatFeld("Zugang (alt)"))
    neu.push(mk("Zugang (alt)", "text", g.zugang));
  const felder = neu.concat(bestehende);
  // Alte Top-Level-Properties entfernen, Rest (id, typ, typLabel, icon, hausId,
  // raumId) behalten.
  const aus = {};
  Object.keys(g).forEach(k => {
    if (["hersteller", "baujahr", "nummer", "notruf", "standort", "zugang"].indexOf(k) >= 0) return;
    aus[k] = g[k];
  });
  aus.felder = felder;
  return aus;
}

// Zuordnungs-Zeile eines Geräts: Haus/Tiefgarage · Raum ODER Einheit, plus
// Zuständigkeit (WEG / Sondereigentümer). standorte = Gebäude- + TG-Karten.
function GeraetStandort({ g, haeuser, t }) {
  const haus = g.hausId ? (haeuser || []).find(h => String(h.id) === String(g.hausId)) : null;
  const raum = haus && g.raumId ? (haus.raeume || []).find(r => String(r.id) === String(g.raumId)) : null;
  const einheit = haus && g.einheitId
    ? ((haus.einheiten || []).find(e => String(e.id) === String(g.einheitId)) || null) : null;
  if (!haus) return null;
  const parts = [];
  parts.push(haus.name);
  if (raum) parts.push(raum.name + (raum.lage ? ` (${raum.lage})` : ""));
  if (einheit) parts.push((einheit.typ ? einheit.typ + " " : "") + (einheit.nr || "") + (einheit.lage ? ` (${einheit.lage})` : ""));
  const seVerantwortlich = g.zustaendigkeit === "se";
  return (
    <span style={{ fontSize: FS.s, color: t.sub }}>
      <strong style={{ color: t.muted, fontWeight: FW.medium }}>📍</strong>{" "}
      {parts.join(" · ")}
      {seVerantwortlich && (
        <span style={{ marginLeft: 6, color: t.muted }}>· Sondereigentum</span>
      )}
    </span>
  );
}

// ── TechnikGeraetAuswahl: zwei Dropdowns (Kategorie → Anlagentyp) zum Anlegen
// eines neuen Geräts. Die Form öffnet sich direkt nach Typ-Wahl (über die
// Eltern-Komponente). „Eigene Anlage" ist ein eigener Eintrag im Kategorie-
// Dropdown. Eigene Komponente, um IIFE in JSX zu vermeiden (iOS/Safari-Regel).
function TechnikGeraetAuswahl({ t, accent, offeneKategorie, setOffeneKategorie, onTypGewaehlt, onCustomGewaehlt }) {
  const istCustomKat = offeneKategorie === "custom";
  const aktKat = TECHNIK_KATEGORIEN.find(k => k.id === offeneKategorie) || null;
  const selectStyle = {
    width: "100%", boxSizing: "border-box", background: t.surface,
    border: `1px solid ${t.border}`, borderRadius: RAD.sm, padding: "7px 8px",
    fontSize: FS.m, color: t.text, outline: "none", fontFamily: "inherit",
  };
  return (
    <div>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {/* Dropdown 1 — Kategorie */}
        <div>
          <div style={{ fontSize: FS.xs, fontWeight: FW.bold, color: t.muted,
            textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 3 }}>
            Kategorie
          </div>
          <select value={istCustomKat ? "custom" : (offeneKategorie || "")} style={selectStyle}
            onChange={e => {
              const v = e.target.value;
              if (v === "custom") { onCustomGewaehlt(); }
              else { setOffeneKategorie(v || null); }
            }}>
            <option value="">— Kategorie wählen —</option>
            {TECHNIK_KATEGORIEN.map(kat => (
              <option key={kat.id} value={kat.id}>{kat.icon} {kat.label}</option>
            ))}
            <option value="custom">＋ Eigene Anlage</option>
          </select>
        </div>
        {/* Dropdown 2 — Anlagentyp (nur bei gewählter echter Kategorie) */}
        {aktKat && !istCustomKat && (
          <div>
            <div style={{ fontSize: FS.xs, fontWeight: FW.bold, color: t.muted,
              textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 3 }}>
              Anlagentyp
            </div>
            <select value="" style={selectStyle}
              onChange={e => { const v = e.target.value; if (v) onTypGewaehlt(v); }}>
              <option value="">— Typ wählen —</option>
              {(aktKat.typen || []).map(typ => (
                <option key={typ.id} value={typ.id}>{typ.icon} {typ.label}</option>
              ))}
            </select>
          </div>
        )}
      </div>
    </div>
  );
}

// ── GeraetKarte: aufklappbares Gerät innerhalb der Technik-Karte (Optik wie
// RaumKarte). Eingeklappt: Icon-Tile + Name (typLabel) + Standort-Zeile.
// Aufgeklappt im Lese-Modus: Felder (FieldList read-only). Im Edit-Modus liefert
// die Eltern-Komponente per renderForm den bestehenden TechnikGeraetForm
// (Übernehmen/Abbrechen); der Kopf dient dann nur zum Auf-/Zuklappen.
function GeraetKarte({ g, t, accent, editMode, haeuser, kontakte, setKontakte,
  onKontaktClick, ves, onEdit, onRemove, formOffen, renderForm }) {
  const [offen, setOffen] = useState(false);
  // Im Edit-Modus zeigt die aufgeklappte Karte die Form; sonst die Lese-Felder.
  const auf = editMode ? formOffen : offen;
  const icon = g.icon || "⚙";
  return (
    <div style={{ background: t.bg, border: `1px solid ${t.border}`,
      borderRadius: RAD.ms, marginBottom: 5, overflow: "hidden" }}>
      {/* Kopf — Klick klappt auf/zu (im Edit: öffnet/schließt die Form) */}
      <div onClick={() => { if (editMode) { onEdit(!formOffen); } else { setOffen(o => !o); } }}
        style={{ display: "flex", alignItems: "center", gap: 8, padding: "9px 12px", cursor: "pointer" }}>
        <div style={{ flexShrink: 0, width: 32, height: 32, borderRadius: RAD.sm,
          background: accent + "18", display: "flex", alignItems: "center",
          justifyContent: "center", fontSize: FS.icon }}>
          {icon}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: FS.m, fontWeight: FW.bold, color: t.text,
            overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {g.typLabel || "Gerät"}
          </div>
          <GeraetStandort g={g} haeuser={haeuser} t={t}/>
        </div>
        {editMode && (
          <button onClick={(e) => { e.stopPropagation(); onRemove(); }} title="Entfernen" style={{
            background: "none", border: `1px solid ${t.border}`, borderRadius: RAD.sm,
            width: 26, height: 26, cursor: "pointer", padding: 0, flexShrink: 0,
            display: "flex", alignItems: "center", justifyContent: "center" }}>
            <I name="trash" size={12} color={t.sub}/>
          </button>
        )}
      </div>

      {auf && (
        editMode ? (
          <div style={{ padding: "0 12px 12px" }}>{renderForm()}</div>
        ) : (
          <div style={{ padding: "0 12px 12px" }}>
            <FieldList fields={Array.isArray(g.felder) ? g.felder : []}
              setFields={() => {}} t={t} accent={accent} editMode={false}
              kategorie="technik" ohneVorschlaege={true}
              kontakte={kontakte} setKontakte={setKontakte}
              onKontaktClick={onKontaktClick} ves={ves}/>
          </div>
        )
      )}
    </div>
  );
}

function TechnikKarte({ karte, t, accent, editMode, onRename, onRemove, onUpdateKarte, haeuser = [], sort = null, akkordeonOffen = null, onAkkordeonToggle = null, lokalEditGesperrt = false, onLokalEditChange = null, kontakte = [], setKontakte = null, onKontaktClick = null, ves = [] }) {
  const immerOffen = !!karte.fixed;
  const [expanded, setExpanded] = useState(immerOffen ? true : false);
  // Akkordeon: zentral gesteuerter Offen-Zustand (immer nur eine Karte offen).
  const akkordeonAktiv = !!onAkkordeonToggle && !immerOffen;
  const effExpanded = immerOffen ? true : (akkordeonAktiv ? (akkordeonOffen === karte.id) : expanded);
  const toggleExpanded = (val) => {
    const neu = typeof val === "function" ? val(effExpanded) : (val === undefined ? !effExpanded : val);
    if (akkordeonAktiv) { onAkkordeonToggle(karte.id, neu); }
    else { setExpanded(neu); }
  };
  // Karten-eigener Bearbeiten-Modus (lokaler Stift) — schaltet die Geräte-
  // Bearbeitung frei, unabhängig vom globalen editMode.
  const lokalEditErlaubt = !karte.fixed;
  const [lokalEdit, setLokalEdit] = useState(false);
  useEffect(() => {
    if (onLokalEditChange) onLokalEditChange(lokalEdit);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lokalEdit]);
  // Effektiver Edit-Modus für die Geräte: globaler editMode ODER lokaler Stift.
  const effEdit = editMode || (lokalEditErlaubt && lokalEdit);
  // Aufgeklappte Karte meldet „offen", damit der obere globale Stift verschwindet.
  const einheitOffenCtx = useEinheitOffen();
  const meldetOffen = !immerOffen && effExpanded;
  useEffect(() => {
    if (meldetOffen) einheitOffenCtx.setOffen(true);
    return () => { if (meldetOffen) einheitOffenCtx.setOffen(false); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [meldetOffen]);
  const [renaming, setRenaming] = useState(false);
  const [name, setName] = useState(karte.name);
  const [neuesGeraet, setNeuesGeraet] = useState(null); // { typ }  (typ kann ID aus TECHNIK_GERAET_TYPEN oder "custom" sein)
  const [editGeraetId, setEditGeraetId] = useState(null); // ID des Geräts, das gerade bearbeitet wird
  const [offeneKategorie, setOffeneKategorie] = useState(null); // gewählte Technik-Kategorie (zweistufige Auswahl)
  const [auswahlOffen, setAuswahlOffen] = useState(false); // Auswahl (Kategorie/Typ) aufgeklappt? — Muster wie „+ Einheit"
  const lokalSnapshot = useRef(null);
  // Bestandsgeräte beim Lesen auf das neue FieldList-Schema heben (Migration).
  const geraete = (karte.technikGeraete || []).map(ergaenzeTechnikGeraetFelder);

  // Warmwasserversorgung (Zentral/Dezentral) — immer sichtbarer Schalter; steuert
  // die Legionellen-Prüfpflicht (TrinkwV) und damit den Legionellen-Tab. Liegt im
  // stamm-Array der Technik-Karte.
  const wwFeldWert = (() => {
    const stamm = Array.isArray(karte.stamm) ? karte.stamm : [];
    const f = stamm.find(x => x && x.name === "Warmwasserversorgung");
    return f ? (f.value || "") : "";
  })();
  const setWwVersorgung = (wert) => {
    if (!onUpdateKarte) return;
    const stamm = Array.isArray(karte.stamm) ? karte.stamm.slice() : [];
    const idx = stamm.findIndex(x => x && x.name === "Warmwasserversorgung");
    if (idx >= 0) {
      stamm[idx] = { ...stamm[idx], value: stamm[idx].value === wert ? "" : wert };
    } else {
      const maxId = stamm.reduce((m, f) => Math.max(m, (f && f.id) || 0), 0);
      stamm.push({ id: maxId + 1, name: "Warmwasserversorgung", value: wert,
        type: "select", optionen: ["Zentral", "Dezentral"], immerSichtbar: true });
    }
    onUpdateKarte({ ...karte, stamm });
  };

  // Wenn der globale Edit-Modus aus geht (z. B. „Übernehmen" oben), auch
  // offene Bearbeitungs-/Neu-Forms in dieser Karte schließen.
  useEffect(() => {
    if (!effEdit) {
      setNeuesGeraet(null);
      setEditGeraetId(null);
      setRenaming(false);
      setAuswahlOffen(false);
      setOffeneKategorie(null);
    }
  }, [effEdit]);

  const addGeraet = (typId, daten) => {
    const def = TECHNIK_GERAET_TYPEN.find(x => x.id === typId);
    const eintrag = {
      id: Date.now(),
      typ: typId,
      typLabel: daten.typLabel || (def ? def.label : "Gerät"),
      icon:     daten.icon     || (def ? def.icon  : "⚙"),
      hausId:   daten.hausId || null,
      raumId:   daten.raumId || null,
      felder:   Array.isArray(daten.felder) ? daten.felder : [],
    };
    onUpdateKarte({ ...karte, technikGeraete: [...geraete, eintrag] });
    setNeuesGeraet(null);
  };

  const updateGeraet = (id, daten) => {
    onUpdateKarte({ ...karte, technikGeraete: geraete.map(g => g.id === id ? { ...g, ...daten } : g) });
    setEditGeraetId(null);
  };

  const removeGeraet = (id) => {
    onUpdateKarte({ ...karte, technikGeraete: geraete.filter(g => g.id !== id) });
    if (editGeraetId === id) setEditGeraetId(null);
  };

  // Technik-Karte wird immer angezeigt — auch ohne Geräte (zeigt Handlungsbedarf
  // und den „+ Gerät"-Bereich). Frühere Lese-Modus-Ausblendung entfernt.

  const [iconPickerAuf, setIconPickerAuf] = useState(false);
  return (
    <div style={{ background: t.card, border: `1px solid ${t.border}`,
      borderRadius: RAD.lg, marginBottom: 12, overflow: iconPickerAuf ? "visible" : "hidden" }}>
      {/* Gemeinsamer Karten-Kopf — Technik erbt so automatisch alle künftigen
          Kopf-Änderungen (Name direkt editierbar, roter Lösch-Button mit
          Bestätigung, Klick-zum-Klappen usw.). Geräte-Anzahl als (N)-Badge
          über zeigtVertraege/anzahlVertraege wiederverwendet. */}
      <GebaeudeKopf karte={karte} t={t} accent={accent} editMode={editMode}
        renaming={renaming} name={name} setName={setName}
        onRename={onRename} setRenaming={setRenaming} onRemove={onRemove}
        onSetIcon={(ic) => onUpdateKarte && onUpdateKarte({ ...karte, icon: ic })}
        onPickerOpenChange={setIconPickerAuf}
        expanded={effExpanded} setExpanded={toggleExpanded} sort={sort}
        lokalEditErlaubt={lokalEditErlaubt && !editMode && effExpanded && (!lokalEditGesperrt || lokalEdit)} lokalEdit={lokalEdit}
        onLokalEditStart={() => {
          if (!effExpanded) toggleExpanded(true);
          try { lokalSnapshot.current = JSON.parse(JSON.stringify(geraete)); }
          catch (e) { lokalSnapshot.current = null; }
          setLokalEdit(true);
        }}
        onLokalEditFertig={() => {
          lokalSnapshot.current = null;
          setLokalEdit(false); setNeuesGeraet(null); setEditGeraetId(null); setOffeneKategorie(null);
        }}
        onLokalEditAbbrechen={() => {
          // Geräte aus Snapshot wiederherstellen (Verwerfen).
          if (lokalSnapshot.current) onUpdateKarte({ ...karte, technikGeraete: lokalSnapshot.current });
          lokalSnapshot.current = null;
          setLokalEdit(false); setNeuesGeraet(null); setEditGeraetId(null); setOffeneKategorie(null);
        }}
        anzahlVertraege={geraete.length} zeigtVertraege={true}/>

      {effExpanded && (
        <div style={{ padding: "12px 14px" }}>
          {/* Warmwasserversorgung — steuert Legionellen-Prüfpflicht */}
          <div style={{ marginBottom: 14, padding: "12px 14px", background: t.surface,
            border: `1px solid ${t.border}`, borderRadius: RAD.sm }}>
            <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 8 }}>
              <I name="drop" size={15} color={accent}/>
              <span style={{ fontSize: FS.m, fontWeight: FW.bold, color: t.text }}>
                Warmwasserversorgung
              </span>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              {["Zentral", "Dezentral"].map(opt => (
                <button key={opt}
                  onClick={() => { if (effEdit) setWwVersorgung(opt); }}
                  disabled={!effEdit}
                  style={{ flex: 1, padding: "9px 0", borderRadius: RAD.sm,
                    border: `1px solid ${wwFeldWert === opt ? accent : t.border}`,
                    background: wwFeldWert === opt ? accent + "18" : "none",
                    color: wwFeldWert === opt ? accent : t.sub,
                    fontSize: FS.m, fontWeight: wwFeldWert === opt ? 700 : 500,
                    cursor: effEdit ? "pointer" : "default", fontFamily: "inherit" }}>
                  {opt}
                </button>
              ))}
            </div>
            <div style={{ marginTop: 8, fontSize: FS.xs, color: t.muted, lineHeight: 1.45 }}>
              {wwFeldWert === "Zentral"
                ? "Zentrale Warmwasserversorgung — Legionellen-Prüfpflicht nach TrinkwV. Der Legionellen-Tab ist am Objekt aktiv."
                : wwFeldWert === "Dezentral"
                ? "Dezentrale Versorgung (z. B. Durchlauferhitzer) — keine Legionellen-Prüfpflicht."
                : "Bei zentraler Versorgung gilt die Legionellen-Prüfpflicht (TrinkwV); der Legionellen-Tab erscheint dann am Objekt."}
            </div>
          </div>

          {/* Liste der Geräte */}
          {geraete.length === 0 && !neuesGeraet && (
            <div style={{ fontSize: FS.m, color: t.muted, fontStyle: "italic",
              padding: "10px 0", textAlign: "center" }}>
              Noch keine technischen Anlagen hinterlegt.
              {effEdit && <><br/>Mit „+ Gerät hinzufügen" anlegen.</>}
            </div>
          )}
          {geraete.map(g => (
            <GeraetKarte key={g.id} g={g} t={t} accent={accent} editMode={effEdit}
              haeuser={haeuser} kontakte={kontakte} setKontakte={setKontakte}
              onKontaktClick={onKontaktClick} ves={ves}
              formOffen={effEdit && editGeraetId === g.id}
              onEdit={(willOpen) => setEditGeraetId(willOpen ? g.id : null)}
              onRemove={() => removeGeraet(g.id)}
              renderForm={() => (
                <TechnikGeraetForm
                  typ={g.typ || "custom"} initial={g}
                  t={t} accent={accent} haeuser={haeuser}
                  kontakte={kontakte} setKontakte={setKontakte}
                  onKontaktClick={onKontaktClick} ves={ves}
                  onCancel={() => setEditGeraetId(null)}
                  onSave={(daten) => updateGeraet(g.id, daten)}/>
              )}/>
          ))}

          {/* Neues Gerät hinzufügen — Form */}
          {effEdit && neuesGeraet && (
            <TechnikGeraetForm typ={neuesGeraet.typ} t={t} accent={accent} haeuser={haeuser}
              kontakte={kontakte} setKontakte={setKontakte}
              onKontaktClick={onKontaktClick} ves={ves}
              onCancel={() => setNeuesGeraet(null)}
              onSave={(daten) => addGeraet(neuesGeraet.typ, daten)}/>
          )}

          {/* Gerät hinzufügen — Muster wie „+ Einheit": erst ein getönter
              Button; Klick klappt die Kategorie/Typ-Auswahl auf. */}
          {effEdit && !neuesGeraet && editGeraetId === null && (
            <div style={{ marginTop: geraete.length > 0 ? 10 : 14 }}>
              {!auswahlOffen ? (
                <button onClick={() => setAuswahlOffen(true)} style={{
                  width: "100%", display: "flex", alignItems: "center", gap: 8,
                  justifyContent: "center",
                  background: "none", border: `1px dashed ${accent}55`,
                  borderRadius: RAD.ms, padding: "8px 12px", cursor: "pointer",
                  color: accent, fontSize: FS.m, fontWeight: FW.medium, fontFamily: "inherit" }}>
                  <I name="plus" size={13} color={accent}/>
                  Gerät hinzufügen
                </button>
              ) : (
                <div style={{ background: accent + "0A", border: `1px dashed ${accent}55`,
                  borderRadius: RAD.md, padding: 10 }}>
                  <TechnikGeraetAuswahl t={t} accent={accent}
                    offeneKategorie={offeneKategorie} setOffeneKategorie={setOffeneKategorie}
                    onTypGewaehlt={(typId) => { setNeuesGeraet({ typ: typId }); setOffeneKategorie(null); setAuswahlOffen(false); }}
                    onCustomGewaehlt={() => { setOffeneKategorie(null); setNeuesGeraet({ typ: "custom" }); setAuswahlOffen(false); }}/>
                  <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 8 }}>
                    <AktionsButton variante="breit" rolle="abbrechen"
                      onClick={() => { setAuswahlOffen(false); setOffeneKategorie(null); }}
                      text="Abbrechen" icon={false} t={t} accent={accent}/>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── TechnikGeraetForm (Mini-Formular zum Anlegen oder Bearbeiten eines Geräts) ─
// Props:
//   typ      — TyperID aus TECHNIK_GERAET_TYPEN oder "custom" für eigene Anlage
//   initial  — optional, das bestehende Gerät zum Bearbeiten
//   onSave   — wird mit allen Daten aufgerufen
//   onCancel — bricht ab
// Gerätefelder laufen über die generische FieldList (typisierte Felder:
// text/number/date/kontakt + beliebige eigene). Neue Geräte starten mit dem
// vordefinierten Standardschema (technikStandardfelder), alle Felder löschbar.
function TechnikGeraetForm({ typ, initial = null, t, accent, onSave, onCancel, haeuser = [],
  kontakte = [], setKontakte = null, onKontaktClick = null, ves = [] }) {
  const istDesktop = useWindowWidth() >= DESKTOP_MIN_WIDTH;
  const istEdit  = !!initial;
  const istCustom = typ === "custom" || (initial && initial.typ === "custom");
  const def = TECHNIK_GERAET_TYPEN.find(x => x.id === typ);

  // Bei "Eigene Anlage": frei wählbarer Name + Icon
  const [typLabel, setTypLabel] = useState(initial ? initial.typLabel : (def ? def.label : ""));
  const [icon, setIcon]         = useState(initial ? initial.icon     : (def ? def.icon  : "⚙"));

  // Zuordnung: Haus/Tiefgarage (Pflicht) → dann Raum ODER Einheit (optional).
  // standorte = Gebäude- + Tiefgaragen-Karten (vom Aufrufer über haeuser geliefert).
  const [hausId, setHausId] = useState(initial ? (initial.hausId || "") : "");
  const [raumId, setRaumId] = useState(initial ? (initial.raumId || "") : "");
  const [einheitId, setEinheitId] = useState(initial ? (initial.einheitId || "") : "");
  // Zuständigkeit: Standard "weg"; "se" = Sondereigentümer verantwortlich
  // (nur sinnvoll, wenn eine Einheit zugewiesen ist).
  const [zustaendigkeit, setZustaendigkeit] = useState(initial ? (initial.zustaendigkeit || "weg") : "weg");
  const aktHaus = haeuser.find(h => String(h.id) === String(hausId));
  const verfRaeume = aktHaus ? (aktHaus.raeume || []) : [];
  const verfEinheiten = aktHaus ? (aktHaus.einheiten || []) : [];

  // Gerätefelder (FieldList). Beim Bearbeiten: bestehende (ggf. migrierte)
  // Felder; bei neuem Gerät: vordefiniertes Standardschema (typabhängig).
  const [felder, setFelder] = useState(() => {
    if (initial) {
      const mig = ergaenzeTechnikGeraetFelder(initial);
      return Array.isArray(mig.felder) ? mig.felder : [];
    }
    return technikStandardfelder(typ);
  });

  const inputStyle = feldInput(t, { fontSize: FS.m });

  // Icon-Vorschläge bei eigener Anlage
  const ICON_VORSCHLAEGE = ["⚙","🔧","🔌","💡","💧","🚿","🚰","🧯","📡","🔋","🛢","🌡","🎛","🔔"];

  const valid = istCustom ? typLabel.trim().length > 0 : true;

  // Aktiver Eigentümer einer Einheit (für die automatische Verknüpfung bei
  // Zuständigkeit "Sondereigentümer").
  const aktiverEigentuemerId = (einheit) => {
    const liste = (einheit && Array.isArray(einheit.eigentuemer)) ? einheit.eigentuemer : [];
    const akt = liste.find(e => !e.bis) || liste[0] || null;
    return akt ? (akt.kontaktId || null) : null;
  };

  const handleSave = () => {
    if (!valid) return;
    // Felder mit (auch nach Trim) leerem Namen verwerfen.
    let saubereFelder = felder.filter(f => f && f.name && f.name.trim());
    // Zuständigkeit nur "se", wenn eine Einheit zugewiesen ist (sonst immer WEG).
    const effZust = (einheitId && zustaendigkeit === "se") ? "se" : "weg";
    // Bei SE-Verantwortung: Eigentümer der Einheit automatisch als Kontaktfeld
    // „Zuständig (Sondereigentümer)" verknüpfen/aktualisieren. Bei WEG: ein
    // evtl. vorhandenes automatisches Feld wieder entfernen.
    const SE_FELD = "Zuständig (Sondereigentümer)";
    saubereFelder = saubereFelder.filter(f => !(f.name === SE_FELD && f._autoSe));
    if (effZust === "se") {
      const eh = verfEinheiten.find(e => String(e.id) === String(einheitId)) || null;
      const eigId = aktiverEigentuemerId(eh);
      if (eigId) {
        saubereFelder.push({ id: Date.now() + 99, name: SE_FELD, type: "kontakt",
          value: "", kontaktId: eigId, _autoSe: true });
      }
    }
    onSave({
      typLabel: typLabel.trim() || (def ? def.label : "Gerät"),
      icon,
      hausId: hausId || null,
      raumId: (raumId && !einheitId) ? raumId : null,
      einheitId: einheitId || null,
      zustaendigkeit: effZust,
      felder: saubereFelder,
    });
  };

  return (
    <div style={{ background: accent + "0A", border: `1px dashed ${accent}55`,
      borderRadius: RAD.md, padding: 10, marginTop: 6, marginBottom: 6 }}>
      <div style={{ fontSize: FS.s, fontWeight: FW.bold, color: accent,
        marginBottom: 8, display: "flex", alignItems: "center", gap: 6 }}>
        <span style={{ fontSize: FS.xl }}>{icon}</span>
        {istEdit ? "Bearbeiten" : "Neu"}: {istCustom ? (typLabel || "Eigene Anlage") : (def ? def.label : "Gerät")}
      </div>

      {/* Bei eigener Anlage: Name + Icon-Auswahl */}
      {istCustom && (
        <div style={{ marginBottom: 8, padding: "8px 10px", background: t.surface,
          borderRadius: RAD.ms, border: `1px solid ${t.border}` }}>
          <div style={{ fontSize: FS.xs, fontWeight: FW.bold, color: t.muted,
            textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 6 }}>
            Anlagen-Typ
          </div>
          <input type="text" placeholder="Bezeichnung (z. B. Druckerhöhungsanlage)"
            value={typLabel} onChange={e => setTypLabel(e.target.value)}
            style={{ ...inputStyle, marginBottom: 6 }}/>
          <div style={{ fontSize: FS.xs, color: t.muted, marginBottom: 4 }}>Icon wählen:</div>
          <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
            {ICON_VORSCHLAEGE.map(em => (
              <button key={em} onClick={() => setIcon(em)} style={{
                width: 28, height: 28, borderRadius: RAD.sm, cursor: "pointer",
                background: icon === em ? accent + "22" : t.card,
                border: `1px solid ${icon === em ? accent : t.border}`,
                fontSize: FS.xl, padding: 0, fontFamily: "inherit" }}>{em}</button>
            ))}
          </div>
        </div>
      )}

      {/* Zuordnung: Haus/Tiefgarage (Pflicht) → dann Raum ODER Einheit.
          standorte = Gebäude- + Tiefgaragen-Karten (gruppiert). Bei Einheit-
          Zuweisung erscheint die Zuständigkeits-Wahl (WEG / Sondereigentümer). */}
      {haeuser.length > 0 && (
        <div style={{ marginTop: 10, padding: "8px 10px", background: t.surface,
          borderRadius: RAD.ms, border: `1px solid ${t.border}` }}>
          <div style={{ fontSize: FS.xs, fontWeight: FW.bold, color: t.muted,
            textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 6 }}>
            Zuordnung
          </div>
          <div style={istDesktop
            ? { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }
            : { display: "flex", flexDirection: "column", gap: 6 }}>
            {/* Haus / Tiefgarage */}
            <div>
              <div style={{ fontSize: FS.xs, color: t.muted, marginBottom: 3 }}>Haus / Tiefgarage</div>
              <select value={hausId}
                onChange={e => { setHausId(e.target.value); setRaumId(""); setEinheitId(""); }}
                style={inputStyle}>
                <option value="">— ohne Zuordnung —</option>
                {haeuser.filter(h => h.kategorie !== "tiefgarage").length > 0 && (
                  <optgroup label="Gebäude">
                    {haeuser.filter(h => h.kategorie !== "tiefgarage").map(h => (
                      <option key={h.id} value={h.id}>{h.name}</option>
                    ))}
                  </optgroup>
                )}
                {haeuser.filter(h => h.kategorie === "tiefgarage").length > 0 && (
                  <optgroup label="Tiefgaragen">
                    {haeuser.filter(h => h.kategorie === "tiefgarage").map(h => (
                      <option key={h.id} value={h.id}>{h.name}</option>
                    ))}
                  </optgroup>
                )}
              </select>
            </div>
            {/* Raum (deaktiviert, sobald eine Einheit gewählt ist) */}
            <div>
              <div style={{ fontSize: FS.xs, color: t.muted, marginBottom: 3 }}>Raum</div>
              <select value={raumId}
                onChange={e => { setRaumId(e.target.value); if (e.target.value) setEinheitId(""); }}
                disabled={!hausId || verfRaeume.length === 0 || !!einheitId}
                style={{ ...inputStyle,
                  opacity: (!hausId || verfRaeume.length === 0 || !!einheitId) ? 0.5 : 1 }}>
                <option value="">
                  {!hausId ? "— erst Haus wählen —" :
                    einheitId ? "— (Einheit gewählt) —" :
                    verfRaeume.length === 0 ? "— keine Räume —" : "— ohne Raum —"}
                </option>
                {verfRaeume.map(r => (
                  <option key={r.id} value={r.id}>{r.name}{r.lage ? ` (${r.lage})` : ""}</option>
                ))}
              </select>
            </div>
          </div>
          {/* Einheit (deaktiviert, sobald ein Raum gewählt ist) */}
          <div style={{ marginTop: 6 }}>
            <div style={{ fontSize: FS.xs, color: t.muted, marginBottom: 3 }}>
              Einheit (Sondereigentum, z. B. Wallbox / Balkonkraftwerk)
            </div>
            <select value={einheitId}
              onChange={e => {
                const v = e.target.value;
                setEinheitId(v);
                if (v) setRaumId("");
                if (!v) setZustaendigkeit("weg");
              }}
              disabled={!hausId || verfEinheiten.length === 0 || !!raumId}
              style={{ ...inputStyle,
                opacity: (!hausId || verfEinheiten.length === 0 || !!raumId) ? 0.5 : 1 }}>
              <option value="">
                {!hausId ? "— erst Haus wählen —" :
                  raumId ? "— (Raum gewählt) —" :
                  verfEinheiten.length === 0 ? "— keine Einheiten —" : "— keine Einheit —"}
              </option>
              {verfEinheiten.map(eh => (
                <option key={eh.id} value={eh.id}>
                  {(eh.typ ? eh.typ + " " : "") + (eh.nr || "")}{eh.lage ? ` (${eh.lage})` : ""}
                </option>
              ))}
            </select>
          </div>
          {/* Zuständigkeit — nur bei zugewiesener Einheit. Standard WEG; Häkchen
              setzt Sondereigentümer-Verantwortung → Eigentümer wird beim Speichern
              automatisch als Kontakt verknüpft. */}
          {einheitId && (
            <div onClick={() => setZustaendigkeit(z => z === "se" ? "weg" : "se")}
              style={{ marginTop: 8, display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
              <div style={{ width: 18, height: 18, borderRadius: RAD.sm, flexShrink: 0,
                border: `1px solid ${zustaendigkeit === "se" ? accent : t.border}`,
                background: zustaendigkeit === "se" ? accent : "transparent",
                display: "flex", alignItems: "center", justifyContent: "center" }}>
                {zustaendigkeit === "se" && <I name="check" size={12} color="#fff"/>}
              </div>
              <span style={{ fontSize: FS.s, color: t.text }}>
                Sondereigentümer verantwortlich
                <span style={{ color: t.muted }}> (Eigentümer der Einheit wird als Kontakt verknüpft)</span>
              </span>
            </div>
          )}
        </div>
      )}

      {/* Gerätefelder über die generische FieldList (Edit-Modus): typisierte
          Felder (text/number/date/kontakt) + „Eigenes Feld hinzufügen".
          Standardfelder sind vorbelegt und löschbar. */}
      <div style={{ marginTop: 10 }}>
        <FieldList fields={felder} setFields={setFelder}
          t={t} accent={accent} editMode={true} kategorie="technik"
          ohneVorschlaege={true}
          kontakte={kontakte} setKontakte={setKontakte}
          onKontaktClick={onKontaktClick} ves={ves}/>
      </div>

      {/* Aktionen */}
      <div style={{ display: "flex", gap: 6, justifyContent: "flex-end", marginTop: 10 }}>
        <AktionsButton variante="breit" rolle="abbrechen" onClick={onCancel}
          text="Abbrechen" icon={false} t={t} accent={accent}/>
        <AktionsButton variante="breit" rolle="bestaetigen" disabled={!valid} onClick={handleSave}
          text={istEdit ? "Übernehmen" : "Hinzufügen"} icon={false} t={t} accent={accent}/>
      </div>
    </div>
  );
}
// ── GebaeudeKarte-Subkomponenten (extrahiert aus dem Monolithen, v4.95) ──────
// Reine Präsentation. State + Handler bleiben im Orchestrator GebaeudeKarte.

// Block 1: Karten-Kopf — Icon, Name/Rename, Stats, Edit/Trash/Collapse
// Kuratierte Symbol-Auswahl für Verwaltungs-Karten (Immobilienverwaltung).
const KARTEN_ICONS = [
  // Dokumente & Verwaltung
  "📋", "📄", "📑", "📝", "🗂", "📁", "📂", "🗄", "📌", "🗒",
  // Recht, Schutz, Finanzen
  "🛡", "⚖", "🔒", "🔑", "💰", "💶", "🧾", "📊", "📈", "🏦",
  // Technik & Gebäude
  "🔧", "⚙", "🔥", "🛗", "💨", "💡", "⚡", "🔌", "🚿", "🚰",
  "🏢", "🏠", "🏗", "🧱", "🚪", "🪟", "🅿️", "🚧", "📡", "🔋",
  // Pflege, Garten, Umwelt
  "🧹", "🧯", "🌳", "🌿", "❄", "☀", "♻", "🗑",
  // Kommunikation & Termine
  "📞", "✉", "📅", "🕐", "🔔", "⚠", "✅", "ℹ", "⭐", "📍",
];

function GebaeudeKopf({ karte, t, accent, editMode, renaming, name, setName,
    onRename, setRenaming, onRemove, onSetIcon, expanded, setExpanded,
    immerOffen = false, wohnM2, nutzM2, anzahlEinheiten, anzahlVertraege = 0, zeigtVertraege = false, sort = null,
    lokalEditErlaubt = false, lokalEdit = false, onLokalEditStart = null, onLokalEditFertig = null, onLokalEditAbbrechen = null,
    onPickerOpenChange = null }) {
  const [iconPickerOffen, setIconPickerOffen] = useState(false);
  const [loeschConfirm, setLoeschConfirm] = useState(false);
  // Container über offenen Icon-Picker informieren, damit er overflow:visible
  // setzt (sonst clippt das overflow:hidden der Karte das Popover).
  useEffect(() => { if (onPickerOpenChange) onPickerOpenChange(iconPickerOffen); }, [iconPickerOffen]);
  // Symbol ist im Edit-Modus wählbar (nicht nur beim Umbenennen) — sonst schließt
  // das Blur des Umbenennen-Feldes den Icon-Picker, bevor man wählen kann.
  const iconAenderbar = editMode && !karte.fixed && !!onSetIcon;
  useEffect(() => { if (!iconAenderbar && iconPickerOffen) setIconPickerOffen(false); }, [iconAenderbar]);
  // Lösch-Bestätigung zurücksetzen, wenn der Edit-Modus endet.
  useEffect(() => { if (!editMode && loeschConfirm) setLoeschConfirm(false); }, [editMode]);
  // Lösch-Bestätigung zurücksetzen, sobald irgendwo außerhalb des Lösch-Buttons
  // geklickt wird (nicht nur beim zweiten Klick auf den Button selbst).
  const loeschBtnRef = useRef(null);
  useOutsideClick(loeschBtnRef, () => setLoeschConfirm(false), loeschConfirm);
  // Icon-Picker schließt bei Klick außerhalb des Kopfes (§2.7).
  const kopfRef = useRef(null);
  useOutsideClick(kopfRef, () => setIconPickerOffen(false), iconPickerOffen);
  // Name direkt im Edit-Modus bearbeitbar (Input statt Titel) — kein separater
  // Stift mehr nötig. Nur für nicht-fixe Karten.
  const nameEditierbar = editMode && !karte.fixed;
  const klappbar = !immerOffen && !nameEditierbar;
  return (
    <div ref={kopfRef} onClick={klappbar && setExpanded ? (() => setExpanded(v => !v)) : undefined}
      style={{ padding: "11px 14px", background: accent + "08",
      borderBottom: (immerOffen || expanded) ? `1px solid ${t.border}` : "none",
      display: "flex", alignItems: "center", gap: 10, position: "relative",
      cursor: klappbar ? "pointer" : "default" }}>
      {iconAenderbar ? (
        <button onClick={(e) => e.stopPropagation()}
          onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); setIconPickerOffen(o => !o); }} title="Symbol ändern"
          style={{ flexShrink: 0, width: 32, height: 32, borderRadius: RAD.sm,
            background: t.surface, border: `1px ${karte.icon ? "solid" : "dashed"} ${accent}`, cursor: "pointer",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: FS.icon, padding: 0 }}>
          {karte.icon ? karte.icon : <I name="plus" size={13} color={accent}/>}
        </button>
      ) : (
        karte.icon ? <span style={{ fontSize: FS.icon }}>{karte.icon}</span> : null
      )}
      {/* Icon-Auswahl-Popover */}
      {iconAenderbar && iconPickerOffen && (
        <div style={{ position: "absolute", top: 46, left: 14, zIndex: 100,
          background: t.card, border: `1px solid ${t.border}`, borderRadius: RAD.md,
          padding: 8, boxShadow: "0 8px 24px rgba(0,0,0,0.35)",
          display: "grid", gridTemplateColumns: "repeat(8, 1fr)", gap: 4,
          maxWidth: 320, maxHeight: 260, overflowY: "auto" }}>
          {/* „Kein Symbol" — leeres Feld; entfernt das Icon (Name rückt nach links). */}
          <button onClick={(e) => e.stopPropagation()}
            onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); onSetIcon(""); setIconPickerOffen(false); }}
            title="Kein Symbol" aria-label="Kein Symbol"
            style={{ width: 32, height: 32, borderRadius: RAD.sm, cursor: "pointer",
              background: !karte.icon ? accent + "25" : "transparent",
              border: `1px dashed ${!karte.icon ? accent : t.border}`,
              display: "flex", alignItems: "center", justifyContent: "center", padding: 0 }}>
            <I name="x" size={12} color={!karte.icon ? accent : t.muted}/>
          </button>
          {KARTEN_ICONS.map(ic => (
            <button key={ic} onClick={(e) => e.stopPropagation()}
              onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); onSetIcon(ic); setIconPickerOffen(false); }}
              style={{ width: 32, height: 32, borderRadius: RAD.sm, cursor: "pointer",
                background: ic === karte.icon ? accent + "25" : "transparent",
                border: `1px solid ${ic === karte.icon ? accent : "transparent"}`,
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: FS.icon, padding: 0 }}>
              {ic}
            </button>
          ))}
        </div>
      )}
      {nameEditierbar ? (
        <input value={name}
          onChange={e => { setName(e.target.value); onRename && onRename(e.target.value); }}
          onClick={(e) => e.stopPropagation()}
          onMouseDown={(e) => e.stopPropagation()}
          placeholder="Kartenname"
          style={{ flex: 1, minWidth: 0, background: t.surface, border: `1px solid ${accent}`,
            borderRadius: RAD.sm, padding: "4px 8px", fontSize: FS.input, fontWeight: FW.bold,
            color: t.text, outline: "none", fontFamily: "inherit" }}/>
      ) : (
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: FS.l, fontWeight: FW.bold, color: t.text }}>
            {karte.name}
            {zeigtVertraege && (
              <span style={{ fontWeight: FW.semi, color: t.sub, marginLeft: 6 }}>
                ({anzahlVertraege})
              </span>
            )}
          </div>
          {(wohnM2 > 0 || nutzM2 > 0 || anzahlEinheiten > 0) && (
            <div style={{ fontSize: FS.s, color: t.sub, display: "flex", gap: 5, flexWrap: "wrap", marginTop: 2 }}>
              {wohnM2 > 0 && <span>{wohnM2.toFixed(0)} m² Wohnfl.</span>}
              {nutzM2 > 0 && <span>· {nutzM2.toFixed(0)} m² Nutzfl.</span>}
              {anzahlEinheiten > 0 && <span>· {anzahlEinheiten} Einheiten</span>}
            </div>
          )}
        </div>
      )}
      <div onClick={(e) => e.stopPropagation()}
        style={{ display: "flex", gap: 4, flexShrink: 0, alignItems: "center" }}>
        {/* Karten-eigener Bearbeiten-Einstieg (Versicherungen/Verträge/eigene
            Karten). Ruhe = runder Stift; im Edit = X (abbrechen) + ✓ (fertig),
            Anordnung/Optik wie der Belegungs-Edit in der Liegenschaft. */}
        {lokalEditErlaubt && (
          lokalEdit ? (
            <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
              <button onClick={onLokalEditAbbrechen}
                title="Abbrechen — Änderungen verwerfen" aria-label="Abbrechen"
                style={{ display: "flex", alignItems: "center", justifyContent: "center",
                  width: 32, height: 32, flexShrink: 0, cursor: "pointer",
                  background: accent, border: "none", borderRadius: RAD.pill,
                  boxShadow: `0 1px 2px ${accent}40` }}>
                <I name="x" size={14} color="#EF4444"/>
              </button>
              <button onClick={onLokalEditFertig}
                title="Fertig — Änderungen behalten" aria-label="Fertig"
                style={{ display: "flex", alignItems: "center", justifyContent: "center",
                  width: 32, height: 32, flexShrink: 0, cursor: "pointer",
                  background: accent, border: "none", borderRadius: RAD.pill,
                  boxShadow: `0 1px 2px ${accent}40` }}>
                <I name="check" size={13} color={getContrastColor(accent)}/>
              </button>
            </div>
          ) : (
            <button onClick={onLokalEditStart}
              title="Bearbeiten — Felder & Verträge" aria-label="Bearbeiten"
              style={{ display: "flex", alignItems: "center", justifyContent: "center",
                width: 32, height: 32, flexShrink: 0, cursor: "pointer",
                background: accent, border: "none", borderRadius: RAD.pill,
                boxShadow: `0 1px 2px ${accent}40` }}>
              <I name="pencil" size={13} color={getContrastColor(accent)}/>
            </button>
          )
        )}
        {editMode && !karte.fixed && sort && (
          <SortierPfeile horizontal size={24}
            canUp={sort.canUp} canDown={sort.canDown}
            onUp={sort.onUp} onDown={sort.onDown}
            t={t} accent={accent}/>
        )}
        {editMode && !karte.fixed && (
          <>
            {onRemove && (
              <button ref={loeschBtnRef} onClick={() => {
                  if (loeschConfirm) { onRemove(); setLoeschConfirm(false); }
                  else setLoeschConfirm(true);
                }}
                title={loeschConfirm ? "Nochmal klicken zum Löschen (alle Daten dieser Karte)" : "Karte löschen"}
                style={{ display: "flex", alignItems: "center", gap: 5,
                  background: loeschConfirm ? "#EF4444" : "#EF444418",
                  border: `1px solid ${loeschConfirm ? "#EF4444" : "#EF444440"}`,
                  borderRadius: RAD.sm, height: 24, width: loeschConfirm ? "auto" : 24,
                  padding: loeschConfirm ? "0 10px" : 0, cursor: "pointer",
                  justifyContent: "center", fontFamily: "inherit" }}>
                <I name="trash" size={11} color={loeschConfirm ? "#FFFFFF" : "#EF4444"}/>
                {loeschConfirm && <span style={{ fontSize: FS.xs, fontWeight: FW.bold, color: "#FFFFFF" }}>Wirklich löschen?</span>}
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}

// Block 4: Rechnungsadresse — auto-generierte Adress-Box (nur Stammdaten-Karte)
function GebaeudeRechnungsadresse({ t, accent, allFields }) {
  return (
    <div style={{ marginTop: 12, background: t.surface,
      border: `1px solid ${t.border}`, borderRadius: RAD.md, padding: "10px 13px" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ fontSize: FS.l }}>📬</span>
          <span style={{ fontSize: FS.s, fontWeight: FW.bold, color: t.text }}>Rechnungsadresse</span>
          <span style={{ fontSize: FS.xxs, color: t.muted, background: t.card,
            border: `1px solid ${t.border}`, padding: "1px 6px", borderRadius: RAD.sm }}>auto</span>
        </div>
        <CopyBtn text={genRechnungsadresse(allFields)} label="Kopieren" t={t} accent={accent}/>
      </div>
      <pre style={{ margin: 0, fontSize: FS.s, color: t.sub, lineHeight: 1.7,
        fontFamily: "inherit", whiteSpace: "pre-wrap" }}>{genRechnungsadresse(allFields)}</pre>
      <div style={{ marginTop: 6, fontSize: FS.xxs, color: t.muted }}>
        c/o {HV_ADRESSE.name} · wird in <strong>Einstellungen</strong> hinterlegt
      </div>
    </div>
  );
}

// Block 5: Einheiten-Liste (numerisch sortiert) + Inline-Add-Form
function GebaeudeEinheiten({ t, accent, editMode, karte, isTG,
    localEinheiten, setLocalEinheiten, persistEinheiten,
    activeEinheit, setActiveEinheit, kontakte, setKontakte,
    neueEinheitOffen, setNeueEinheitOffen, neueEinheit, setNeueEinheit,
    defaultTyp, addEinheit, belegungEdit = false, setBelegungEdit = null, editGesperrt = false, onKontaktClick = null }) {
  const istDesktop = useWindowWidth() >= DESKTOP_MIN_WIDTH;
  // Snapshot der gerade bearbeiteten Einheit beim Eintritt in belegungEdit —
  // erlaubt echtes Abbrechen (Verwerfen). Beim Bestätigen wird er nur verworfen.
  const belegSnapshot = useRef(null);
  const vorherBelegEdit = useRef(belegungEdit);
  // Reset-Key: erzwingt beim Abbrechen ein Remount von EinheitDetail, damit
  // dessen lokaler State (eig/mie/teile/offene Formulare) aus dem
  // zurückgesetzten Stand neu initialisiert wird — sonst bliebe die UI auf den
  // verworfenen Änderungen stehen.
  const [belegResetKey, setBelegResetKey] = useState(0);
  useEffect(() => {
    if (belegungEdit && !vorherBelegEdit.current && activeEinheit != null) {
      const e = localEinheiten.find(x => x.id === activeEinheit);
      try { belegSnapshot.current = e ? JSON.parse(JSON.stringify(e)) : null; }
      catch (err) { belegSnapshot.current = null; }
    }
    vorherBelegEdit.current = belegungEdit;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [belegungEdit]);
  const belegBestaetigen = () => {
    belegSnapshot.current = null;
    if (setBelegungEdit) setBelegungEdit(false);
  };
  const belegAbbrechen = () => {
    const snap = belegSnapshot.current;
    if (snap) persistEinheiten(localEinheiten.map(x => x.id === snap.id ? snap : x));
    belegSnapshot.current = null;
    setBelegResetKey(k => k + 1); // EinheitDetail neu mounten → State aus Snapshot
    if (setBelegungEdit) setBelegungEdit(false);
  };
  // Render-time-Sortierung: aufsteigend nach der Nummer in der Einheit-Nr
  // (z. B. "WE 03" → 3). Ohne Zahl alphabetisch ans Ende. Stored data bleibt
  // unverändert (nur Anzeige-Reihenfolge).
  const einheitNummer = (e) => {
    const m = String((e && e.nr) || "").match(/(\d+)/);
    return m ? parseInt(m[1], 10) : Number.MAX_SAFE_INTEGER;
  };
  const sortierteEinheiten = [...localEinheiten].sort((a, b) => {
    const na = einheitNummer(a), nb = einheitNummer(b);
    if (na !== nb) return na - nb;
    return String((a && a.nr) || "").localeCompare(String((b && b.nr) || ""), "de");
  });
  return (
    <>
      {sortierteEinheiten.length > 0 && (
        <div>
          <div style={{ fontSize: FS.xs, fontWeight: FW.bold, color: t.muted,
            textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 7 }}>
            Einheiten ({sortierteEinheiten.length})
          </div>
          {sortierteEinheiten.map((e) => {
            const offen = activeEinheit === e.id;
            return (
            <div key={e.id} style={offen ? {
              border: `1px solid ${accent}`, borderRadius: RAD.ms,
              background: accent + "08", marginBottom: 5, overflow: "hidden" } : null}>
              <EinheitZeile einheit={e} t={t} accent={accent} editMode={editMode}
                isActive={activeEinheit === e.id}
                gesperrt={editGesperrt}
                belegungEdit={activeEinheit === e.id && belegungEdit}
                onToggleBelegung={() => setBelegungEdit && setBelegungEdit(v => !v)}
                onBelegungBestaetigen={belegBestaetigen}
                onBelegungAbbrechen={belegAbbrechen}
                onToggle={() => {
                  const wirdGeoeffnet = activeEinheit !== e.id;
                  setActiveEinheit(wirdGeoeffnet ? e.id : null);
                  if (setBelegungEdit) setBelegungEdit(false); // beim Öffnen/Schließen/Wechseln Belegungs-Modus zurücksetzen
                }}/>
              {activeEinheit === e.id && (
                <EinheitDetail key={e.id + "-" + belegResetKey} einheit={e} t={t} accent={accent} editMode={editMode}
                  geschwisterEinheiten={localEinheiten} onKontaktClick={onKontaktClick}
                  belegungEdit={belegungEdit}
                  kontakte={kontakte} setKontakte={setKontakte}
                  onUpdate={(neuE) => persistEinheiten(localEinheiten.map(x => x.id === e.id ? neuE : x))}
                  onClose={() => { setActiveEinheit(null); if (setBelegungEdit) setBelegungEdit(false); }}/>
              )}
            </div>
            );
          })}
        </div>
      )}

      {editMode && !karte.fixed && !editGesperrt && (
        <div style={{ marginTop: localEinheiten.length > 0 ? 10 : 14 }}>
          {!neueEinheitOffen ? (
            <button onClick={() => setNeueEinheitOffen(true)} style={{
              width: "100%", display: "flex", alignItems: "center", gap: 8,
              justifyContent: "center",
              background: "none", border: `1px dashed ${accent}55`,
              borderRadius: RAD.ms, padding: "8px 12px", cursor: "pointer",
              color: accent, fontSize: FS.m, fontWeight: FW.medium, fontFamily: "inherit" }}>
              <I name="plus" size={13} color={accent}/>
              {isTG ? "Stellplatz hinzufügen" : "Einheit hinzufügen"}
            </button>
          ) : (
            <div style={{ background: accent + "0A", border: `1px dashed ${accent}55`,
              borderRadius: RAD.md, padding: 10 }}>
              <div style={{ fontSize: FS.s, fontWeight: FW.bold, color: accent,
                marginBottom: 8 }}>
                {isTG ? "Neuer Stellplatz" : "Neue Einheit"}
              </div>
              <div style={istDesktop
                ? { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }
                : { display: "flex", flexDirection: "column", gap: 6 }}>
                <select value={neueEinheit.typ}
                  onChange={e => setNeueEinheit({ ...neueEinheit, typ: e.target.value })}
                  style={{ background: t.surface, border: `1px solid ${t.border}`,
                    borderRadius: RAD.sm, padding: "5px 8px", fontSize: FS.m, color: t.text,
                    outline: "none", fontFamily: "inherit", gridColumn: "1 / -1" }}>
                  {isTG ? (
                    <>
                      <option value="Stellplatz">Stellplatz</option>
                      <option value="Garage">Garage</option>
                      <option value="Carport">Carport</option>
                      <option value="Doppelparker">Doppelparker</option>
                    </>
                  ) : (
                    <>
                      <option value="Wohneigentum">Wohneigentum</option>
                      <option value="Teileigentum">Teileigentum (Gewerbe etc.)</option>
                    </>
                  )}
                </select>
                <input value={neueEinheit.nr} autoFocus
                  onChange={e => setNeueEinheit({ ...neueEinheit, nr: e.target.value })}
                  placeholder={isTG ? "Nr. (z. B. SP-07)" : "Nr. (z. B. WE 08)"}
                  style={{ background: t.surface, border: `1px solid ${t.border}`,
                    borderRadius: RAD.sm, padding: "5px 8px", fontSize: FS.input, color: t.text,
                    outline: "none", fontFamily: "inherit" }}/>
                <input value={neueEinheit.lage}
                  onChange={e => setNeueEinheit({ ...neueEinheit, lage: e.target.value })}
                  placeholder={isTG ? "Lage (z. B. TG UG)" : "Lage (z. B. 2. OG rechts)"}
                  style={{ background: t.surface, border: `1px solid ${t.border}`,
                    borderRadius: RAD.sm, padding: "5px 8px", fontSize: FS.input, color: t.text,
                    outline: "none", fontFamily: "inherit" }}/>
                {!isTG && (
                  <>
                    <input value={neueEinheit.flaeche}
                      onChange={e => setNeueEinheit({ ...neueEinheit, flaeche: e.target.value })}
                      placeholder="Fläche (z. B. 78)"
                      style={{ background: t.surface, border: `1px solid ${t.border}`,
                        borderRadius: RAD.sm, padding: "5px 8px", fontSize: FS.input, color: t.text,
                        outline: "none", fontFamily: "inherit" }}/>
                    <input value={neueEinheit.zimmer}
                      onChange={e => setNeueEinheit({ ...neueEinheit, zimmer: e.target.value })}
                      placeholder="Zimmer (z. B. 3)"
                      style={{ background: t.surface, border: `1px solid ${t.border}`,
                        borderRadius: RAD.sm, padding: "5px 8px", fontSize: FS.input, color: t.text,
                        outline: "none", fontFamily: "inherit" }}/>
                    <input value={neueEinheit.mea}
                      onChange={e => setNeueEinheit({ ...neueEinheit, mea: e.target.value })}
                      placeholder="MEA (z. B. 125 oder 146,678)"
                      style={{ background: t.surface, border: `1px solid ${t.border}`,
                        borderRadius: RAD.sm, padding: "5px 8px", fontSize: FS.input, color: t.text,
                        outline: "none", fontFamily: "inherit", gridColumn: "1 / -1" }}/>
                  </>
                )}
              </div>
              <div style={{ display: "flex", gap: 6, marginTop: 8, justifyContent: "flex-end" }}>
                <button onClick={() => { setNeueEinheitOffen(false);
                  setNeueEinheit({ typ: defaultTyp, nr: "", lage: "", flaeche: "", zimmer: "", mea: "" }); }}
                  style={{ background: "none", border: `1px solid ${t.border}`,
                    color: t.sub, borderRadius: RAD.sm, padding: "5px 12px",
                    cursor: "pointer", fontSize: FS.s, fontFamily: "inherit" }}>
                  Abbrechen
                </button>
                <button onClick={addEinheit} disabled={!neueEinheit.nr.trim()}
                  style={{ background: neueEinheit.nr.trim() ? accent : "transparent",
                    border: `1px solid ${accent}`,
                    color: neueEinheit.nr.trim() ? "#fff" : accent,
                    borderRadius: RAD.sm, padding: "5px 12px",
                    cursor: neueEinheit.nr.trim() ? "pointer" : "not-allowed",
                    fontSize: FS.s, fontWeight: FW.medium, fontFamily: "inherit" }}>
                  Speichern
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </>
  );
}

// Block 6: Räume — Liste + Add-Form (nur Gebäude-Karten). State bleibt im Orchestrator.
// ── RaumKarte: aufklappbare Karte für einen Raum (Stil wie GebaeudeKarte) ────
// Kopf: Icon + Name (Lage als Untertitel). Aufgeklappt: Beschriftungsfelder
// (Name, Lage, Fläche, Art/Nutzung als Dropdown+Freitext, Notizen) und die
// Liste der zugewiesenen Technik-Geräte (Icon + Name, Klick → Details inline).
function RaumKarte({ raum, t, accent, editMode, onUpdate, onRemove, geraete = [],
  kontakte = [], setKontakte = null, onKontaktClick = null, ves = [] }) {
  const [offen, setOffen] = useState(false);
  const [offenesGeraet, setOffenesGeraet] = useState(null);
  const [iconPickerOffen, setIconPickerOffen] = useState(false);
  // Art-Dropdown: Freitext aktiv, wenn art gesetzt, aber nicht in den Vorschlägen.
  const artInOptionen = !raum.art || RAUM_ART_OPTIONEN.indexOf(raum.art) >= 0;
  const [artFreitext, setArtFreitext] = useState(!artInOptionen);
  // Icon-Picker schließen, wenn Edit-Modus endet.
  useEffect(() => { if (!editMode && iconPickerOffen) setIconPickerOffen(false); }, [editMode]);
  // Icon-Picker schließt bei Klick außerhalb der Raum-Karte (§2.7).
  const raumRef = useRef(null);
  useOutsideClick(raumRef, () => setIconPickerOffen(false), iconPickerOffen);

  const inputStyle = feldInput(t, { padding: "6px 8px" });
  const labelStyle = feldLabel(t);

  const icon = raum.icon || "🚪";
  const titel = raum.name || raum.art || "Raum";
  // Detailzeile (Untertitel) wie bei Einheiten: Lage · Art · Fläche.
  const untertitelTeile = [];
  if (raum.lage) untertitelTeile.push(raum.lage);
  if (raum.art && raum.art !== titel) untertitelTeile.push(raum.art);
  if (raum.flaeche) untertitelTeile.push(raum.flaeche + (("" + raum.flaeche).indexOf("²") >= 0 ? "" : " m²"));
  const untertitel = untertitelTeile.join(" · ");
  const nameEditierbar = editMode;

  return (
    <div ref={raumRef} style={{ background: t.bg, border: `1px solid ${t.border}`,
      borderRadius: RAD.ms, marginBottom: 5,
      overflow: iconPickerOffen ? "visible" : "hidden", position: "relative" }}>
      {/* Kopf — Klick klappt auf/zu (außer beim Name-Editieren). Optik an die
          Einheiten-Zeile angelehnt: Icon-Tile + Name + Detailzeile. */}
      <div onClick={nameEditierbar ? undefined : () => setOffen(o => !o)} style={{
        display: "flex", alignItems: "center", gap: 8, padding: "9px 12px",
        cursor: nameEditierbar ? "default" : "pointer" }}>
        {/* Icon-Tile (Avatar-Stil). Im Edit klickbar → Icon-Picker. */}
        {nameEditierbar ? (
          <button onClick={(e) => e.stopPropagation()}
            onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); setIconPickerOffen(o => !o); }}
            title="Symbol ändern"
            style={{ flexShrink: 0, width: 32, height: 32, borderRadius: RAD.sm,
              background: t.surface, border: `1px ${raum.icon ? "solid" : "dashed"} ${accent}`,
              cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: FS.icon, padding: 0 }}>
            {raum.icon ? raum.icon : <I name="plus" size={13} color={accent}/>}
          </button>
        ) : (
          <div style={{ flexShrink: 0, width: 32, height: 32, borderRadius: RAD.sm,
            background: accent + "18", display: "flex", alignItems: "center",
            justifyContent: "center", fontSize: FS.icon }}>
            {icon}
          </div>
        )}
        {/* Icon-Auswahl-Popover */}
        {nameEditierbar && iconPickerOffen && (
          <div style={{ position: "absolute", top: 46, left: 12, zIndex: 100,
            background: t.card, border: `1px solid ${t.border}`, borderRadius: RAD.md,
            padding: 8, boxShadow: "0 8px 24px rgba(0,0,0,0.35)",
            display: "grid", gridTemplateColumns: "repeat(8, 1fr)", gap: 4,
            maxWidth: 320, maxHeight: 260, overflowY: "auto" }}>
            <button onClick={(e) => e.stopPropagation()}
              onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); onUpdate({ icon: "" }); setIconPickerOffen(false); }}
              title="Kein Symbol" aria-label="Kein Symbol"
              style={{ width: 32, height: 32, borderRadius: RAD.sm, cursor: "pointer",
                background: !raum.icon ? accent + "25" : "transparent",
                border: `1px dashed ${!raum.icon ? accent : t.border}`,
                display: "flex", alignItems: "center", justifyContent: "center", padding: 0 }}>
              <I name="x" size={12} color={!raum.icon ? accent : t.muted}/>
            </button>
            {KARTEN_ICONS.map(ic => (
              <button key={ic} onClick={(e) => e.stopPropagation()}
                onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); onUpdate({ icon: ic }); setIconPickerOffen(false); }}
                style={{ width: 32, height: 32, borderRadius: RAD.sm, cursor: "pointer",
                  background: ic === raum.icon ? accent + "25" : "transparent",
                  border: `1px solid ${ic === raum.icon ? accent : "transparent"}`,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: FS.icon, padding: 0 }}>
                {ic}
              </button>
            ))}
          </div>
        )}
        {/* Name + Detailzeile */}
        {nameEditierbar ? (
          <input value={raum.name || ""} placeholder="Raum-Name"
            onClick={(e) => e.stopPropagation()} onMouseDown={(e) => e.stopPropagation()}
            onChange={e => onUpdate({ name: e.target.value })}
            style={{ flex: 1, minWidth: 0, background: t.surface, border: `1px solid ${accent}`,
              borderRadius: RAD.sm, padding: "4px 8px", fontSize: FS.input, fontWeight: FW.bold,
              color: t.text, outline: "none", fontFamily: "inherit" }}/>
        ) : (
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: FS.m, fontWeight: FW.bold, color: t.text,
              overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {titel}
            </div>
            {untertitel && (
              <div style={{ fontSize: FS.xs, color: t.sub }}>{untertitel}</div>
            )}
          </div>
        )}
        {geraete.length > 0 && (
          <span style={{ fontSize: FS.xxs, color: accent, fontWeight: FW.medium, flexShrink: 0,
            background: accent + "15", border: `1px solid ${accent}30`,
            borderRadius: RAD.sm, padding: "1px 6px" }}>
            ⚙ {geraete.length}
          </span>
        )}
        {editMode && (
          <button onClick={(e) => { e.stopPropagation(); onRemove(); }} title="Raum entfernen" style={{
            background: "none", border: `1px solid ${t.border}`, borderRadius: RAD.sm,
            width: 26, height: 26, cursor: "pointer", padding: 0, flexShrink: 0,
            display: "flex", alignItems: "center", justifyContent: "center" }}>
            <I name="trash" size={12} color={t.sub}/>
          </button>
        )}
      </div>

      {(offen || nameEditierbar) && (
        <div style={{ padding: "0 12px 12px" }}>
          {/* Beschriftungsfelder (Name + Icon stehen im Kopf) */}
          {editMode ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <div style={{ display: "flex", gap: 8 }}>
                <div style={{ flex: 1 }}>
                  <div style={labelStyle}>Lage / Etage</div>
                  <input value={raum.lage || ""} placeholder="z. B. KG"
                    onChange={e => onUpdate({ lage: e.target.value })} style={inputStyle}/>
                </div>
                <div style={{ flex: 1 }}>
                  <div style={labelStyle}>Fläche</div>
                  <input value={raum.flaeche || ""} placeholder="z. B. 18 m²"
                    onChange={e => onUpdate({ flaeche: e.target.value })} style={inputStyle}/>
                </div>
              </div>
              <div>
                <div style={labelStyle}>Art / Nutzung</div>
                {!artFreitext ? (
                  <select value={raum.art || ""}
                    onChange={e => {
                      const v = e.target.value;
                      if (v === "__andere__") { setArtFreitext(true); onUpdate({ art: "" }); }
                      else onUpdate({ art: v });
                    }}
                    style={inputStyle}>
                    <option value="">— keine Angabe —</option>
                    {RAUM_ART_OPTIONEN.map(o => (<option key={o} value={o}>{o}</option>))}
                    <option value="__andere__">Andere…</option>
                  </select>
                ) : (
                  <div style={{ display: "flex", gap: 6 }}>
                    <input value={raum.art || ""} placeholder="Art / Nutzung (frei)"
                      onChange={e => onUpdate({ art: e.target.value })}
                      style={{ ...inputStyle, flex: 1 }}/>
                    <button onClick={() => { setArtFreitext(false); onUpdate({ art: "" }); }} style={{
                      background: "none", border: `1px solid ${t.border}`, borderRadius: RAD.sm,
                      padding: "0 10px", cursor: "pointer", color: t.sub, fontSize: FS.s,
                      fontFamily: "inherit" }}>Liste</button>
                  </div>
                )}
              </div>
              <div>
                <div style={labelStyle}>Notizen</div>
                <textarea value={raum.notizen || ""} rows={2}
                  placeholder="Notizen, Anmerkungen…"
                  onChange={e => onUpdate({ notizen: e.target.value })}
                  style={{ ...inputStyle, resize: "vertical", minHeight: 48 }}/>
              </div>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              {raum.notizen && (
                <div style={{ fontSize: FS.s, color: t.sub, whiteSpace: "pre-wrap" }}>{raum.notizen}</div>
              )}
            </div>
          )}

          {/* Zugewiesene Technik */}
          {geraete.length > 0 && (
            <div style={{ marginTop: 12, paddingTop: 10, borderTop: `1px solid ${t.border}40` }}>
              <div style={{ fontSize: FS.xs, fontWeight: FW.bold, color: t.muted,
                textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6 }}>
                Technik in diesem Raum
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {geraete.map(g => (
                  <div key={g.id} style={{ background: t.surface, border: `1px solid ${t.border}`,
                    borderRadius: RAD.sm, overflow: "hidden" }}>
                    <div onClick={() => setOffenesGeraet(o => o === g.id ? null : g.id)}
                      style={{ display: "flex", alignItems: "center", gap: 8,
                        padding: "7px 10px", cursor: "pointer" }}>
                      <span style={{ fontSize: FS.l }}>{g.icon || "⚙"}</span>
                      <span style={{ flex: 1, fontSize: FS.m, color: t.text, fontWeight: FW.medium }}>
                        {g.typLabel || "Gerät"}
                      </span>
                    </div>
                    {offenesGeraet === g.id && (
                      <div style={{ padding: "0 10px 8px" }}>
                        <FieldList fields={Array.isArray(g.felder) ? g.felder : []}
                          setFields={() => {}} t={t} accent={accent} editMode={false}
                          kategorie="technik" ohneVorschlaege={true}
                          kontakte={kontakte} setKontakte={setKontakte}
                          onKontaktClick={onKontaktClick} ves={ves}/>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function GebaeudeRaeume({ t, accent, editMode, raeume,
    neuerRaumName, setNeuerRaumName, neuerRaumLage, setNeuerRaumLage,
    neuerRaumFlaeche, setNeuerRaumFlaeche,
    addRaum, removeRaum, updateRaum, alleGeraete = [], hausId = null,
    kontakte = [], setKontakte = null, onKontaktClick = null, ves = [] }) {
  // Lese-Modus: leere Räume-Sektion ganz ausblenden.
  if (!editMode && (!raeume || raeume.length === 0)) return null;
  // Geräte je Raum (zugewiesen über hausId + raumId).
  const geraeteFuerRaum = (raumId) => (alleGeraete || []).filter(g =>
    String(g.hausId) === String(hausId) && String(g.raumId) === String(raumId));
  return (
    <div style={{ marginTop: 14, paddingTop: 12, borderTop: `1px solid ${t.border}40` }}>
      <div style={{ fontSize: FS.s, fontWeight: FW.bold, color: t.sub,
        textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 8 }}>
        Räume ({raeume.length})
      </div>
      {raeume.length === 0 && !editMode && (
        <div style={{ fontSize: FS.m, color: t.muted, fontStyle: "italic" }}>
          Keine Räume hinterlegt.
        </div>
      )}
      {raeume.length > 0 && (
        <div style={{ marginBottom: editMode ? 10 : 0 }}>
          {raeume.map(r => (
            <RaumKarte key={r.id} raum={r} t={t} accent={accent} editMode={editMode}
              geraete={geraeteFuerRaum(r.id)}
              kontakte={kontakte} setKontakte={setKontakte}
              onKontaktClick={onKontaktClick} ves={ves}
              onUpdate={(daten) => updateRaum(r.id, daten)}
              onRemove={() => removeRaum(r.id)}/>
          ))}
        </div>
      )}
      {editMode && (
        <RaumAnlegen t={t} accent={accent}
          artWert={neuerRaumName} setArtWert={setNeuerRaumName}
          lageWert={neuerRaumLage} setLageWert={setNeuerRaumLage}
          flaecheWert={neuerRaumFlaeche} setFlaecheWert={setNeuerRaumFlaeche}
          onAdd={addRaum}/>
      )}
    </div>
  );
}

// ── RaumAnlegen: Anlegen eines Raums im selben Muster wie „Einheit hinzufügen":
// erst ein getönter Button, Klick → aufklappende Form „Neuer Raum" mit Art/Nutzung
// (Dropdown+Freitext), Lage, Fläche + Abbrechen/Speichern. Die gewählte Art wird
// beim Anlegen auch als Name übernommen (Name später editierbar). Speichern aktiv,
// sobald die Art gesetzt ist.
function RaumAnlegen({ t, accent, artWert, setArtWert, lageWert, setLageWert,
  flaecheWert, setFlaecheWert, onAdd }) {
  const [offen, setOffen] = useState(false);
  const inOptionen = !artWert || RAUM_ART_OPTIONEN.indexOf(artWert) >= 0;
  const [freitext, setFreitext] = useState(!inOptionen);
  const inputStyle = feldInput(t, { padding: "6px 8px" });
  const abbrechen = () => {
    setArtWert(""); setLageWert(""); if (setFlaecheWert) setFlaecheWert("");
    setFreitext(false); setOffen(false);
  };
  const speichern = () => {
    if (!artWert.trim()) return;
    onAdd();
    setFreitext(false); setOffen(false);
  };
  if (!offen) {
    return (
      <div style={{ marginTop: 10 }}>
        <button onClick={() => setOffen(true)} style={{
          width: "100%", display: "flex", alignItems: "center", gap: 8, justifyContent: "center",
          background: "none", border: `1px dashed ${accent}55`, borderRadius: RAD.ms,
          padding: "8px 12px", cursor: "pointer", color: accent, fontSize: FS.m,
          fontWeight: FW.medium, fontFamily: "inherit" }}>
          <I name="plus" size={13} color={accent}/>
          Raum hinzufügen
        </button>
      </div>
    );
  }
  return (
    <div style={{ marginTop: 10, background: accent + "0A", border: `1px dashed ${accent}55`,
      borderRadius: RAD.md, padding: 10 }}>
      <div style={{ fontSize: FS.s, fontWeight: FW.bold, color: accent, marginBottom: 8 }}>
        Neuer Raum
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {/* Art / Nutzung — Dropdown + Freitext */}
        {!freitext ? (
          <select value={artWert} autoFocus
            onChange={e => {
              const v = e.target.value;
              if (v === "__andere__") { setFreitext(true); setArtWert(""); }
              else setArtWert(v);
            }}
            style={{ ...inputStyle, color: artWert ? t.text : t.muted }}>
            <option value="">— Art / Nutzung wählen —</option>
            {RAUM_ART_OPTIONEN.map(o => (<option key={o} value={o}>{o}</option>))}
            <option value="__andere__">Andere…</option>
          </select>
        ) : (
          <input value={artWert} autoFocus
            onChange={e => setArtWert(e.target.value)}
            placeholder="Art / Nutzung (frei)" style={inputStyle}/>
        )}
        <div style={{ display: "flex", gap: 8 }}>
          <input value={lageWert} onChange={e => setLageWert(e.target.value)}
            placeholder="Lage (z. B. KG)" style={{ ...inputStyle, flex: 1 }}/>
          <input value={flaecheWert || ""} onChange={e => setFlaecheWert && setFlaecheWert(e.target.value)}
            placeholder="Fläche (z. B. 18)" style={{ ...inputStyle, flex: 1 }}/>
        </div>
      </div>
      <div style={{ display: "flex", gap: 6, marginTop: 8, justifyContent: "flex-end" }}>
        <button onClick={abbrechen} style={{
          background: "none", border: `1px solid ${t.border}`, color: t.sub,
          borderRadius: RAD.sm, padding: "5px 12px", cursor: "pointer",
          fontSize: FS.s, fontFamily: "inherit" }}>
          Abbrechen
        </button>
        <button onClick={speichern} disabled={!artWert.trim()} style={{
          background: artWert.trim() ? accent : "transparent", border: `1px solid ${accent}`,
          color: artWert.trim() ? "#fff" : accent, borderRadius: RAD.sm, padding: "5px 12px",
          cursor: artWert.trim() ? "pointer" : "not-allowed",
          fontSize: FS.s, fontWeight: FW.medium, fontFamily: "inherit" }}>
          Speichern
        </button>
      </div>
    </div>
  );
}


// ── VertragFirmaKarte: eingebettete Firmenkarte im Vertrag, aufklappbar ─────
// Eingeklappt: kompakte KontaktKarte. Klick klappt auf (springt NICHT weg) und
// zeigt die vollständige Firmen-Detailkarte (Stammdaten, Notizen, Mitarbeiter)
// in einem Rahmen, plus — falls für DIESEN Vertrag eigene Ansprechpartner
// gewählt wurden — eine kurze Hervorhebung dieser. Button „Vollständiges
// Profil" führt in die Haupt-Detailansicht.
function VertragFirmaKarte({ firma, maListe, t, accent, onKontaktClick, ves, kontakte, setKontakte }) {
  const [offen, setOffen] = useState(false);
  if (!offen) {
    return <KontaktKarte k={firma} t={t} aktiv={false} onClick={() => setOffen(true)}/>;
  }
  return (
    <div>
      {/* Vollständige Firmen-Detailkarte. Klick auf den oberen Bereich (Name +
          Stammdaten + eigene Felder) klappt die Karte wieder ein. Notizen und
          Mitarbeiter bleiben unberührt. Ohne Bearbeitung, ohne Objekte. */}
      <KontaktDetailKarte k={firma} t={t} accent={accent}
        ves={ves || []} kontakte={kontakte} setKontakte={setKontakte}
        onUpdate={(updated) => setKontakte && setKontakte(prev =>
          prev.map(k => k.id === firma.id ? updated : k))}
        onGotoKontakt={(id) => onKontaktClick && onKontaktClick(id)}
        onKontaktClick={onKontaktClick}
        onKopfClick={() => setOffen(false)}
        embedded/>
      {/* Für diesen Vertrag gewählte Ansprechpartner (mit individueller Funktion) */}
      {maListe && maListe.length > 0 && (
        <div style={{ marginTop: 8, padding: "8px 12px",
          background: accent + "0A", border: `1px solid ${accent}30`, borderRadius: RAD.md }}>
          <div style={{ fontSize: FS.xs, fontWeight: FW.semi, color: accent, marginBottom: 6,
            letterSpacing: "0.04em", textTransform: "uppercase" }}>Ansprechpartner für diesen Vertrag</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
            {maListe.map((m, i) => (
              <div key={i} style={{ display: "flex", alignItems: "baseline", gap: 8, flexWrap: "wrap" }}>
                <button onClick={() => onKontaktClick && onKontaktClick(m.person.id)} style={{
                  background: "none", border: "none", color: accent, cursor: "pointer",
                  padding: 0, fontFamily: "inherit", fontSize: FS.m, textDecoration: "underline" }}>
                  {m.person.name || ((m.person.vorname || "") + " " + (m.person.nachname || "")).trim() || "—"}
                </button>
                {m.funktion && <span style={{ fontSize: FS.s, color: t.sub }}>· {m.funktion}</span>}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── VertragZeile: kompakte Vertragszeile, aufklappbar für Details ───────────
// Eingeklappt: Typ · Leistung, Firma (Link), ab/bis, Vertrags-Nr.
// Aufgeklappt: zusätzlich strukturierte Detail-Felder (Typ, Leistung, Firma,
// Vertrags-Nr., Laufzeit ab/bis) als übersichtliches Raster.
function VertragZeile({ v, firma, t, accent, editMode, onKontaktClick, onRemove, onEdit, kontakte, setKontakte, ves, kontext = "vertrag" }) {
  const [offen, setOffen] = useState(false);
  const kontaktFarben = useKontaktFarbe();
  const firmaFarbe = (kontaktFarben && kontaktFarben.firma) || accent;
  const istVersicherung = kontext === "versicherung";
  const istVersorger = kontext === "versorger";
  const istMessdienst = kontext === "messdienst";
  // Detailfelder je Kontext. Versicherung: ohne Leistung/Intervall, dafür
  // Versichert (Risiken), Selbstbeteiligung, Versicherungssumme, Kündigungsfrist,
  // Schadenmeldung. Vertrag: wie bisher (mit Leistung/Intervall).
  const risikenText = Array.isArray(v.risiken) && v.risiken.length > 0 ? v.risiken.join(", ") : "—";
  const medienText = Array.isArray(v.medien) && v.medien.length > 0 ? v.medien.join(", ") : "—";
  const details = istVersicherung
    ? [
        { label: "Versicherungsart", wert: v.typ || "—" },
        { label: "Versichert",       wert: risikenText },
        { label: "Vertrags-Nr.",     wert: v.vertragsnr || "—" },
        { label: "Selbstbeteiligung", wert: v.selbstbeteiligung || "—" },
        { label: "Versicherungssumme", wert: v.versSumme || "—" },
        { label: "Kündigungsfrist",  wert: v.kuendigungsfrist || "—" },
        { label: "Laufzeit ab",      wert: v.ab || "—" },
        { label: "Laufzeit bis",     wert: v.bis || "unbefristet" },
        { label: "Schadenmeldung",   wert: v.schadenmeldung || "—" },
      ]
    : istVersorger
    ? [
        { label: "Sparte",           wert: v.typ || "—" },
        { label: "Vertrags-/Kundennr.", wert: v.vertragsnr || "—" },
        { label: "Zählernummer",     wert: v.zaehlernr || "—" },
        { label: "Kündigungsfrist",  wert: v.kuendigungsfrist || "—" },
        { label: "Laufzeit ab",      wert: v.ab || "—" },
        { label: "Laufzeit bis",     wert: v.bis || "unbefristet" },
      ]
    : istMessdienst
    ? [
        { label: "Kundennr./Liegenschaftsnr.", wert: v.kundennr || "—" },
        { label: "Erfasste Medien",  wert: medienText },
        { label: "Wirtschaftsjahr",  wert: v.wirtschaftsjahr || "—" },
        { label: "Geräte",           wert: v.geraetemodell || "—" },
        { label: "Gerätelaufzeit",   wert: v.geraetelaufzeit || "—" },
        { label: "Geräteart",        wert: v.geraeteart || "—" },
        { label: "Laufzeit ab",      wert: v.ab || "—" },
      ]
    : [
        { label: "Vertragstyp",  wert: v.typ || "—" },
        { label: "Leistung",     wert: v.leistung || "—" },
        { label: "Intervall",    wert: v.intervall || "—" },
        { label: "Vertrags-Nr.", wert: v.vertragsnr || "—" },
        { label: "Laufzeit ab",  wert: v.ab || "—" },
        { label: "Laufzeit bis", wert: v.bis || "unbefristet" },
      ];
  // Makler (Firma) auflösen — nur Versicherung.
  const makler = istVersicherung && v.maklerId ? (kontakte || []).find(k => k.id === v.maklerId) : null;
  // Bei Spezial-Karten leere Felder („—") ausblenden — weniger ist mehr.
  const spezial = istVersicherung || istVersorger || istMessdienst;
  const immerLabels = istVersicherung ? ["Versicherungsart", "Laufzeit ab"]
    : istVersorger ? ["Sparte", "Laufzeit ab"]
    : istMessdienst ? ["Erfasste Medien", "Laufzeit ab"]
    : [];
  const sichtbareDetails = spezial
    ? details.filter(d => d.wert !== "—" || immerLabels.indexOf(d.label) >= 0)
    : details;
  // Gewählte Mitarbeiter auflösen (Person + Funktion). Fehlt eine explizite
  // Funktion, fällt die Anzeige auf die Firmen-Rolle der Person zurück.
  const maListe = (v.mitarbeiter || []).map(m => {
    const p = (kontakte || []).find(k => k.id === m.personId);
    let rolle = "";
    if (p && firma) {
      const zuw = (p.objektZuweisungen || []).find(z => z.firmaId === firma.id && !z.objektId);
      rolle = zuw ? (zuw.rolle || "") : "";
    }
    return { person: p, funktion: m.funktion || rolle };
  }).filter(m => m.person);
  return (
    <div style={{
      background: offen ? accent + "08" : t.surface,
      border: `1px solid ${offen ? accent : t.border}`,
      borderRadius: RAD.md, marginBottom: 6, overflow: "hidden",
      transition: "border-color 0.1s, background 0.1s" }}>
      {/* Kopf-Zeile (klickbar zum Auf-/Zuklappen) */}
      <div onClick={() => setOffen(o => !o)}
        style={{ padding: "8px 12px", display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }}>
        <span style={{ fontSize: FS.icon }}>📄</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: FS.m, fontWeight: FW.medium, color: t.text }}>
            {v.typ}{v.leistung ? " · " + v.leistung : ""}
          </div>
          <div style={{ fontSize: FS.s, color: t.sub }}>
            {firma
              ? <span style={{ color: firmaFarbe, fontWeight: FW.medium }}>{firma.name}</span>
              : "Keine Firma verknüpft"}
            {v.ab && ` · ab ${v.ab}`}
            {v.bis && ` · bis ${v.bis}`}
          </div>
        </div>
        {v.vertragsnr && (
          <span style={{ fontSize: FS.xxs, color: t.muted, padding: "2px 6px",
            background: t.card, borderRadius: 4 }}>{v.vertragsnr}</span>
        )}
        {editMode && onEdit && (
          <button onClick={(e) => { e.stopPropagation(); onEdit(); }} title="Vertrag bearbeiten" style={{
            background: "none", border: `1px solid ${t.border}`,
            borderRadius: RAD.sm, width: 24, height: 24, cursor: "pointer", padding: 0,
            display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <I name="pencil" size={11} color={t.sub}/>
          </button>
        )}
        {editMode && (
          <button onClick={(e) => { e.stopPropagation(); onRemove && onRemove(); }} style={{
            background: "none", border: `1px solid ${t.border}`,
            borderRadius: RAD.sm, width: 24, height: 24, cursor: "pointer", padding: 0,
            display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <I name="trash" size={11} color={t.sub}/>
          </button>
        )}
      </div>
      {/* Detail-Bereich */}
      {offen && (
        <div style={{ padding: "4px 12px 12px 12px", marginTop: 4 }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
            gap: "10px 14px" }}>
            {sichtbareDetails.map((d, i) => (
              <div key={i}>
                <div style={{ fontSize: FS.xs, color: t.muted, marginBottom: 2 }}>{d.label}</div>
                <div style={{ fontSize: FS.m, color: t.text }}>{d.wert}</div>
              </div>
            ))}
          </div>

          {/* Verknüpfte Firma — aufklappbare Karte mit Ansprechpartnern und
              Button zum vollständigen Profil. */}
          {firma && (
            <div style={{ marginTop: 12 }}>
              <div style={{ fontSize: FS.xs, fontWeight: FW.semi, color: t.sub, marginBottom: 6,
                letterSpacing: "0.04em", textTransform: "uppercase" }}>{istVersicherung ? "Versicherer" : istVersorger ? "Versorger" : istMessdienst ? "Messdienstleister" : "Firma"}</div>
              <VertragFirmaKarte firma={firma} maListe={maListe} t={t} accent={accent}
                onKontaktClick={onKontaktClick} ves={ves} kontakte={kontakte} setKontakte={setKontakte}/>
            </div>
          )}

          {/* Makler (nur Versicherung) — verknüpfte Firma als aufklappbare Karte. */}
          {makler && (
            <div style={{ marginTop: 12 }}>
              <div style={{ fontSize: FS.xs, fontWeight: FW.semi, color: t.sub, marginBottom: 6,
                letterSpacing: "0.04em", textTransform: "uppercase" }}>Makler</div>
              <VertragFirmaKarte firma={makler} maListe={[]} t={t} accent={accent}
                onKontaktClick={onKontaktClick} ves={ves} kontakte={kontakte} setKontakte={setKontakte}/>
            </div>
          )}
        </div>
      )}
    </div>
  );
}


function GebaeudeKarte({ karte, t, accent, editMode, onRename, onRemove, kontakte, setKontakte, onUpdateKarte, ohneEinheiten = false, onKontaktClick = null, sort = null, ves = [], onVEClick = null, etvStamm = null, onSyncChange = null, lokalEditGesperrt = false, onLokalEditChange = null, akkordeonOffen = null, onAkkordeonToggle = null, alleGeraete = [] }) {
  const istDesktop = useWindowWidth() >= DESKTOP_MIN_WIDTH;
  const rechnungsadresseAn = useRechnungsadresseAn();
  // "Immer offen" (nicht klappbar): die fixe Stammdaten-Karte sowie ETV-
  // Stammdaten. Diese Karten zeigen keinen Klapp-Mechanismus.
  const immerOffen = !!karte.fixed || karte.kategorie === "etv";
  // Default: immer-offene Karten offen. Übrige Karten in der Verwaltung
  // (ohneEinheiten) standardmäßig eingeklappt; in der Liegenschaft offen.
  // Auf-/Zuklappen per Klick auf den Karten-Kopf (kein Chevron-Button).
  // Auf-/Zuklappen per Klick auf den Karten-Kopf (kein Chevron-Button). Karten
  // starten überall eingeklappt (Akkordeon), nur immer-offene Karten offen.
  const [expanded, setExpanded] = useState(immerOffen ? true : false);
  // Akkordeon: ist onAkkordeonToggle gesetzt und die Karte klappbar, wird der
  // Offen-Zustand zentral von KartenList gesteuert (immer nur eine offen).
  const akkordeonAktiv = !!onAkkordeonToggle && !immerOffen;
  const effExpanded = immerOffen ? true : (akkordeonAktiv ? (akkordeonOffen === karte.id) : expanded);
  const toggleExpanded = (val) => {
    const neu = typeof val === "function" ? val(effExpanded) : (val === undefined ? !effExpanded : val);
    if (akkordeonAktiv) { onAkkordeonToggle(karte.id, neu); }
    else { setExpanded(neu); }
  };
  const [renaming, setRenaming] = useState(false);
  const [name, setName] = useState(karte.name);
  const [activeEinheit, setActiveEinheit] = useState(null);
  // Meldet dem VEDetail-Header, ob hier gerade eine Einheit offen ist, damit sich
  // oberer Struktur-Stift und Einheit-Bearbeitung gegenseitig ausschließen.
  const einheitOffenCtx = useEinheitOffen();
  useEffect(() => {
    if (activeEinheit != null) einheitOffenCtx.setOffen(true);
    // Beim Schließen NUR zurücksetzen, wenn diese Karte zuletzt geöffnet hatte.
    // Da pro Objekt i. d. R. eine Einheit offen ist, genügt das simple Signal.
    return () => { if (activeEinheit != null) einheitOffenCtx.setOffen(false); };
  }, [activeEinheit]);
  // Aufgeklappte, klappbare Karte meldet „offen", damit der obere globale
  // Struktur-Stift verschwindet — gegenseitiger Ausschluss. Gilt jetzt in
  // Verwaltung UND Liegenschaft (immer-offene Karten ausgenommen).
  const meldetOffen = !immerOffen && effExpanded;
  useEffect(() => {
    if (meldetOffen) einheitOffenCtx.setOffen(true);
    return () => { if (meldetOffen) einheitOffenCtx.setOffen(false); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [meldetOffen]);
  // Belegungs-Bearbeitungs-Modus der geöffneten Einheit (getrennt vom Struktur-
  // editMode). Wird über den runden Stift in der EinheitZeile gesteuert und beim
  // Schließen/Wechseln der Einheit zurückgesetzt.
  const [belegungEdit, setBelegungEdit] = useState(false);
  // Karten-eigener Bearbeitungsmodus (unabhängig vom globalen editMode). Für alle
  // klappbaren Karten (Verwaltung UND Liegenschaft), die KEINE fixe Stammdaten-
  // und KEINE ETV-Karte sind. Schaltet die Karten-FELDER frei (nicht die
  // Einheiten — die haben einen eigenen Bearbeiten/Speichern-Knopf).
  const lokalEditErlaubt = !karte.fixed && karte.kategorie !== "etv";
  const [lokalEdit, setLokalEdit] = useState(false);
  // Den karten-eigenen Edit-Zustand an die KartenList melden, damit immer nur
  // EINE Karte gleichzeitig bearbeitet werden kann.
  useEffect(() => {
    if (onLokalEditChange) onLokalEditChange(lokalEdit);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lokalEdit]);
  // Snapshot beim Start des karten-eigenen Edits — erlaubt echtes Verwerfen (X).
  // Gesichert werden Felder (allFields) und Verträge (karte.vertraege).
  const lokalSnapshot = useRef(null);
  // Effektiver Edit-Modus für Felder/Verträge dieser Karte.
  const effEdit = editMode || (lokalEditErlaubt && lokalEdit);
  const [allFields, setAllFields] = useState(() =>
    [...(karte.stamm || []).map(f => ({ ...f, _stamm: true })), ...((karte.felder) || [])]
  );
  const [localEinheiten, setLocalEinheiten] = useState(karte.einheiten || []);
  const [neuerVertragForm, setNeuerVertragForm] = useState(false);
  const [editVertragId, setEditVertragId] = useState(null);
  const vertraege = karte.vertraege || [];

  // allFields-Änderungen (Stammdaten + eigene Felder) zurück in die Karte
  // propagieren. Wir trennen wieder in stamm (mit _stamm-Flag) und felder.
  const fieldsFirstRender = useRef(true);
  useEffect(() => {
    if (fieldsFirstRender.current) { fieldsFirstRender.current = false; return; }
    if (!onUpdateKarte) return;
    const stamm = allFields.filter(f => f._stamm).map(f => {
      const { _stamm, ...rest } = f;
      return rest;
    });
    const felder = allFields.filter(f => !f._stamm);
    onUpdateKarte({ ...karte, stamm, felder });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allFields]);

  // Räume: für Gebäude-Karten und für "Eigene Karten" (sonstige =
  // kategorie:"stammdaten" und nicht fixed). Nicht für Tiefgarage / Stellplatz
  // (dort gibt es Stellplätze als Einheiten, keine Räume).
  const istGebaeude = karte.kategorie === "gebaeude"
    || (karte.kategorie === "stammdaten" && !karte.fixed);
  const [raeume, setRaeume] = useState(karte.raeume || []);
  const [neuerRaumName, setNeuerRaumName] = useState("");
  const [neuerRaumLage, setNeuerRaumLage] = useState("");
  const [neuerRaumFlaeche, setNeuerRaumFlaeche] = useState("");

  const persistRaeume = (neu) => {
    setRaeume(neu);
    if (onUpdateKarte) onUpdateKarte({ ...karte, raeume: neu });
  };
  const addRaum = () => {
    // neuerRaumName trägt die Art/Nutzung (Dropdown+Freitext). Die Art wird beim
    // Anlegen auch als Name übernommen (Name später editierbar).
    const art = neuerRaumName.trim();
    if (!art) return;
    const r = neuerRaum(art, neuerRaumLage.trim());
    r.art = art;
    const fl = neuerRaumFlaeche.trim();
    if (fl) r.flaeche = (fl.indexOf("²") >= 0 ? fl : fl + " m²");
    persistRaeume([...raeume, r]);
    setNeuerRaumName("");
    setNeuerRaumLage("");
    setNeuerRaumFlaeche("");
  };
  const removeRaum = (id) => persistRaeume(raeume.filter(r => r.id !== id));
  const updateRaum = (id, daten) =>
    persistRaeume(raeume.map(r => r.id === id ? { ...r, ...daten } : r));

  const isTG = karte.kategorie === "tiefgarage" || karte.kategorie === "stellplatz";

  // Einheiten/Stellplätze gibt es nur bei Gebäuden, Tiefgaragen/Stellplätzen und
  // der fixen Liegenschaft-Stammdaten-Karte (aggregiert) sowie eigenen Karten
  // (nicht-fixe Stammdaten-Karten). NICHT bei ETV, Versicherungen, Verträgen,
  // Zugang, Technik usw.
  const zeigtEinheiten = !ohneEinheiten && (istGebaeude || isTG
    || (karte.fixed && karte.kategorie === "stammdaten"));

  // Einheiten-Add: Mini-Form zum Anlegen einer neuen Einheit (WE/TE/Stellplatz)
  const [neueEinheitOffen, setNeueEinheitOffen] = useState(false);
  const defaultTyp = isTG ? "Stellplatz" : "Wohneigentum";
  const [neueEinheit, setNeueEinheit] = useState({
    typ: defaultTyp, nr: "", lage: "", flaeche: "", zimmer: "", mea: "",
  });

  const persistEinheiten = (neu) => {
    setLocalEinheiten(neu);
    if (onUpdateKarte) onUpdateKarte({ ...karte, einheiten: neu });
  };

  const addEinheit = () => {
    if (!neueEinheit.nr.trim()) return;
    const eintrag = {
      id: `e-${Date.now()}`,
      nr: neueEinheit.nr.trim(),
      verwNr: "",
      typ: neueEinheit.typ,
      flaeche: neueEinheit.flaeche.trim() ? (neueEinheit.flaeche.endsWith("²") ? neueEinheit.flaeche : `${neueEinheit.flaeche} m²`) : "",
      mea: neueEinheit.mea.trim(),
      lage: neueEinheit.lage.trim(),
      zimmer: neueEinheit.zimmer.trim(),
      eigentuemer: [], mieter: [],
    };
    persistEinheiten([...localEinheiten, eintrag]);
    setNeueEinheit({ typ: defaultTyp, nr: "", lage: "", flaeche: "", zimmer: "", mea: "" });
    setNeueEinheitOffen(false);
  };

  // Wenn der globale Edit-Modus aus geht, auch offene Add-Forms schließen
  // (Einheit, Raum, Karten-Umbenennung, Vertrag).
  useEffect(() => {
    if (!editMode) {
      setNeueEinheitOffen(false);
      setRenaming(false);
      setNeuerRaumName("");
      setNeuerRaumLage("");
      setNeuerVertragForm(false);
      setEditVertragId(null);
    }
  }, [editMode]);

  // Karten-eigenen Edit beenden, wenn die Karte eingeklappt wird (und offene
  // Add-/Edit-Formen dieser Karte schließen).
  useEffect(() => {
    if (!effExpanded && lokalEdit) {
      setLokalEdit(false);
      setNeuerVertragForm(false);
      setEditVertragId(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [effExpanded]);

  // Verträge anlegen/entfernen — hier für eigene
  // Karten (z.B. neu angelegte „Neue Karte"). Persistiert in karte.vertraege.
  const addVertrag = (v) => {
    if (onUpdateKarte) onUpdateKarte({ ...karte, vertraege: [...vertraege, { id: Date.now(), ...v }] });
    setNeuerVertragForm(false);
  };
  const removeVertrag = (id) => {
    if (onUpdateKarte) onUpdateKarte({ ...karte, vertraege: vertraege.filter(v => v.id !== id) });
    setEditVertragId(null);
  };
  const updateVertrag = (id, daten) => {
    if (onUpdateKarte) onUpdateKarte({ ...karte,
      vertraege: vertraege.map(v => v.id === id ? { ...v, ...daten } : v) });
    setEditVertragId(null);
  };
  // Verträge-Block: für eigene Karten in der Verwaltung (neu angelegte „Neue
  // Karte" = kategorie:"stammdaten" nicht fixed) sowie generell für
  // Versicherungs- und Verträge-Karten. So lassen sich dort sowohl eigene
  // Felder als auch Verträge pflegen.
  const zeigtVertraege = karte.kategorie === "versicherungen"
    || karte.kategorie === "versorger"
    || karte.kategorie === "messdienst"
    || karte.kategorie === "vertraege"
    || (ohneEinheiten && !karte.fixed && karte.kategorie === "stammdaten");
  // Spezialisiertes Formular je Karten-Kategorie (eigene Felder/Optionen).
  const vertragKontext = karte.kategorie === "versicherungen" ? "versicherung"
    : karte.kategorie === "versorger" ? "versorger"
    : karte.kategorie === "messdienst" ? "messdienst"
    : "vertrag";
  // Wirtschaftsjahr aus den gemeinsamen ETV-Stammdaten (für Messdienst-Anzeige).
  const wjWertVertrag = (etvStamm && etvStamm.wirtschaftsjahr) ? etvStamm.wirtschaftsjahr : "";

  // Stats
  const wohnM2 = localEinheiten.filter(e => e.typ !== "Teileigentum" && !isStellplatzTyp(e.typ))
    .reduce((s, e) => s + flaecheVon(e), 0);
  const nutzM2 = localEinheiten.filter(e => e.typ === "Teileigentum")
    .reduce((s, e) => s + flaecheVon(e), 0);

  // Karten werden IMMER angezeigt — auch ohne Inhalt. Eine leere Karte zeigt,
  // dass es den Bereich gibt, und signalisiert ggf. Handlungsbedarf. (Früher
  // wurden leere nicht-fixe Karten im Lese-Modus ausgeblendet; entfernt.)

  const [iconPickerAuf, setIconPickerAuf] = useState(false);
  return (
    <div style={{ background: t.card, border: `1px solid ${t.border}`,
      borderRadius: RAD.lg, marginBottom: 12, overflow: iconPickerAuf ? "visible" : "hidden" }}>
      <GebaeudeKopf karte={karte} t={t} accent={accent} editMode={editMode}
        renaming={renaming} name={name} setName={setName}
        onRename={onRename} setRenaming={setRenaming} onRemove={onRemove}
        onSetIcon={(ic) => onUpdateKarte && onUpdateKarte({ ...karte, icon: ic })}
        onPickerOpenChange={setIconPickerAuf}
        expanded={effExpanded} setExpanded={toggleExpanded} sort={sort} immerOffen={immerOffen}
        wohnM2={wohnM2} nutzM2={nutzM2} anzahlEinheiten={localEinheiten.length}
        anzahlVertraege={vertraege.length} zeigtVertraege={zeigtVertraege}
        lokalEditErlaubt={lokalEditErlaubt && !editMode && effExpanded && (!lokalEditGesperrt || lokalEdit) && !belegungEdit && activeEinheit == null} lokalEdit={lokalEdit}
        onLokalEditStart={() => {
          if (!effExpanded) toggleExpanded(true);
          // Snapshot der aktuellen Felder + Verträge für „Verwerfen" sichern.
          lokalSnapshot.current = {
            allFields: allFields.map(f => ({ ...f })),
            vertraege: (karte.vertraege || []).map(v => ({ ...v })),
          };
          setLokalEdit(true);
        }}
        onLokalEditFertig={() => {
          lokalSnapshot.current = null;
          setLokalEdit(false); setNeuerVertragForm(false); setEditVertragId(null);
        }}
        onLokalEditAbbrechen={() => {
          // In dieser Sitzung gemachte Änderungen verwerfen: Felder + Verträge
          // aus dem Snapshot wiederherstellen (lokaler State + Persistenz).
          const snap = lokalSnapshot.current;
          if (snap) {
            setAllFields(snap.allFields.map(f => ({ ...f })));
            if (onUpdateKarte) {
              const stamm = snap.allFields.filter(f => f._stamm).map(f => { const { _stamm, ...r } = f; return r; });
              const felder = snap.allFields.filter(f => !f._stamm);
              onUpdateKarte({ ...karte, stamm, felder, vertraege: snap.vertraege.map(v => ({ ...v })) });
            }
          }
          lokalSnapshot.current = null;
          setLokalEdit(false); setNeuerVertragForm(false); setEditVertragId(null);
        }}/>

      {effExpanded && (
        <div style={{ padding: istDesktop ? "12px 14px" : "12px 6px" }}>
          {/* Stammdaten als FieldList zuerst — Felder oben, eins nach dem
              anderen. „+ Eigenes Feld" sitzt zwischen Feldern und Verträgen,
              damit ein neu angelegtes Feld oben bei den übrigen Feldern landet. */}
          {(allFields.length > 0 || effEdit) && (
            <div style={{ marginBottom: 8 }}>
              <FieldList fields={allFields} setFields={setAllFields}
                t={t} accent={accent} editMode={effEdit} kategorie={karte.kategorie}
                ohneVorschlaege={ohneEinheiten}
                kontakte={kontakte} setKontakte={setKontakte} onKontaktClick={onKontaktClick}
                ves={ves} onVEClick={onVEClick}
                etvStamm={etvStamm} onSyncChange={onSyncChange}/>
            </div>
          )}

          {/* Verträge danach — für Versicherungen/Verträge und eigene Karten. */}
          {zeigtVertraege && (
            <div style={{ marginBottom: 8 }}>
              {vertraege.map(v => {
                const firma = (kontakte || []).find(k => k.id === v.firmaId);
                if (effEdit && editVertragId === v.id) {
                  return <VertragForm key={v.id} t={t} accent={accent} kontakte={kontakte}
                    initial={v} kontext={vertragKontext} setKontakte={setKontakte} wjWert={wjWertVertrag}
                    onSave={(daten) => updateVertrag(v.id, daten)}
                    onCancel={() => setEditVertragId(null)}/>;
                }
                return <VertragZeile key={v.id} v={v} firma={firma} t={t} accent={accent}
                  editMode={effEdit} onKontaktClick={onKontaktClick} kontakte={kontakte}
                  setKontakte={setKontakte} ves={[]} kontext={vertragKontext}
                  onEdit={() => { setNeuerVertragForm(false); setEditVertragId(v.id); }}
                  onRemove={() => removeVertrag(v.id)}/>;
              })}
              {effEdit && neuerVertragForm && (
                <VertragForm t={t} accent={accent} kontakte={kontakte}
                  kontext={vertragKontext} setKontakte={setKontakte} wjWert={wjWertVertrag}
                  onSave={addVertrag} onCancel={() => setNeuerVertragForm(false)}/>
              )}
              {effEdit && !neuerVertragForm && (
                <button onClick={() => setNeuerVertragForm(true)} style={{
                  marginTop: 8, width: "100%", display: "flex", alignItems: "center", gap: 6,
                  background: "none", border: `1px dashed ${t.border}`,
                  borderRadius: RAD.ms, padding: "6px 0", cursor: "pointer",
                  justifyContent: "center", color: t.muted, fontSize: FS.s, transition: "all 0.15s",
                  fontFamily: "inherit" }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = accent + "70"; e.currentTarget.style.color = accent; }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = t.border; e.currentTarget.style.color = t.muted; }}>
                  <I name="plus" size={11} color="currentColor"/>{vertragKontext === "versicherung" ? "Versicherung hinzufügen" : vertragKontext === "versorger" ? "Versorger hinzufügen" : vertragKontext === "messdienst" ? "Messdienst hinzufügen" : "Vertrag hinzufügen"}
                </button>
              )}
            </div>
          )}


          {/* Rechnungsadresse — nur Stammdaten-Karte, wenn Setting aktiv */}
          {karte.fixed && karte.kategorie === "stammdaten" && rechnungsadresseAn && (
            <GebaeudeRechnungsadresse t={t} accent={accent} allFields={allFields}/>
          )}

          {/* Einheiten-Liste (DnD) + Add-Form — nur wo Einheiten sinnvoll sind.
              Läuft über effEdit (global ODER lokaler Karten-Stift), analog zu den
              Stammdaten-Feldern: im lokalen Stift sind Einheiten anleg-/editierbar. */}
          {zeigtEinheiten && (
            <GebaeudeEinheiten t={t} accent={accent} editMode={effEdit}
              karte={karte} isTG={isTG} onKontaktClick={onKontaktClick}
              localEinheiten={localEinheiten} setLocalEinheiten={setLocalEinheiten}
              persistEinheiten={persistEinheiten}
              activeEinheit={activeEinheit} setActiveEinheit={setActiveEinheit}
              kontakte={kontakte} setKontakte={setKontakte}
              neueEinheitOffen={neueEinheitOffen} setNeueEinheitOffen={setNeueEinheitOffen}
              neueEinheit={neueEinheit} setNeueEinheit={setNeueEinheit}
              defaultTyp={defaultTyp} addEinheit={addEinheit}
              editGesperrt={false}
              belegungEdit={belegungEdit} setBelegungEdit={setBelegungEdit}/>
          )}

          {/* Räume — nur Gebäude-Karten (nicht Tiefgarage/Stellplatz), nicht in
              Verwaltung. Läuft über effEdit (global ODER lokaler Karten-Stift),
              analog zu Feldern und Einheiten. */}
          {istGebaeude && !ohneEinheiten && (
            <GebaeudeRaeume t={t} accent={accent} editMode={effEdit} raeume={raeume}
              neuerRaumName={neuerRaumName} setNeuerRaumName={setNeuerRaumName}
              neuerRaumLage={neuerRaumLage} setNeuerRaumLage={setNeuerRaumLage}
              neuerRaumFlaeche={neuerRaumFlaeche} setNeuerRaumFlaeche={setNeuerRaumFlaeche}
              addRaum={addRaum} removeRaum={removeRaum} updateRaum={updateRaum}
              alleGeraete={alleGeraete} hausId={karte.id}
              kontakte={kontakte} setKontakte={setKontakte}
              onKontaktClick={onKontaktClick} ves={ves}/>
          )}
        </div>
      )}
    </div>
  );
}
// Ersetzt die JSX-IIFE aus liegenschaft-komplett.jsx
function KartenList({ karten, setKarten, t, accent, editMode, kontakte, setKontakte, ve, onKontaktClick, ohneEinheiten = false, ves = [], etvStamm = null, onSyncChange = null, sprungKarte = null }) {
  // Es darf immer nur EINE Karte gleichzeitig im karten-eigenen Bearbeiten-Modus
  // sein. Wir merken uns die aktive Karten-ID; andere Karten sperren ihren Stift.
  const [aktiveEditId, setAktiveEditId] = useState(null);
  // Akkordeon (nur Verwaltung): immer nur EINE klappbare Karte offen. Klick auf
  // eine andere schließt die vorher offene. Fixe/immer-offene Karten unberührt.
  const [offeneKarteId, setOffeneKarteId] = useState(null);
  // Akkordeon (Verwaltung UND Liegenschaft): immer nur EINE klappbare Karte
  // offen. Klick auf eine andere schließt die vorher offene. Fixe/immer-offene
  // Karten (Stammdaten/ETV) unberührt.
  const akkordeon = true;
  const onAkkordeonToggle = (id, willOpen) => setOffeneKarteId(willOpen ? id : null);
  // Sprungziel (z. B. aus dem Kalender): betroffene Karte aufklappen und
  // hinscrollen. Effekt auf die Nonce, damit derselbe Sprung erneut wirkt.
  // Fixe/immer-offene Karten (Stammdaten/ETV) sind ohnehin offen — das Setzen
  // der offeneKarteId ist für sie wirkungslos, der Scroll trifft trotzdem.
  useEffect(() => {
    if (!sprungKarte || sprungKarte.karteId == null) return;
    setOffeneKarteId(sprungKarte.karteId);
    if (typeof window !== "undefined") {
      window.requestAnimationFrame(() => scrollToCard("vwkarte-" + sprungKarte.karteId));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sprungKarte ? sprungKarte.nonce : null]);
  // Alle Technik-Geräte des Objekts (über alle Technik-Karten), migriert auf das
  // aktuelle Feld-Schema. Wird an Gebäudekarten gereicht, damit Räume ihre
  // zugewiesene Technik (hausId + raumId) anzeigen können.
  const alleGeraete = (karten || [])
    .filter(k => k && k.kategorie === "technik")
    .reduce((acc, k) => acc.concat((k.technikGeraete || []).map(ergaenzeTechnikGeraetFelder)), []);
  // Verschiebt eine (nicht-fixe) Karte zum nächsten nicht-fixen Nachbarn in
  // Richtung (-1 hoch / +1 runter). Fixe Karten werden übersprungen.
  // Der Scroll bleibt erhalten — zentrale Logik im setKarten-Wrapper.
  const verschiebeKarte = (idx, richtung) => {
    if (karten[idx] && karten[idx].fixed) return;
    let ziel = idx + richtung;
    while (ziel >= 0 && ziel < karten.length && karten[ziel] && karten[ziel].fixed) ziel += richtung;
    if (ziel < 0 || ziel >= karten.length) return;
    const arr = [...karten];
    const tmp = arr[idx]; arr[idx] = arr[ziel]; arr[ziel] = tmp;
    setKarten(arr);
  };
  // Gibt es in Richtung einen verschiebbaren (nicht-fixen) Nachbarn?
  const hatNachbar = (idx, richtung) => {
    let ziel = idx + richtung;
    while (ziel >= 0 && ziel < karten.length && karten[ziel] && karten[ziel].fixed) ziel += richtung;
    return ziel >= 0 && ziel < karten.length;
  };

  return (
    <div>
      {karten.map((karte, idx) => (
        <div key={(ve && ve.id != null ? ve.id : "") + "-" + karte.id} id={"vwkarte-" + karte.id}
          style={{
            position: "relative",
            scrollMarginTop: "var(--ad-header-h, 200px)",
          }}>
          {karte.kategorie === "technik" ? (
            <TechnikKarte karte={karte} t={t} accent={accent} editMode={editMode}
              haeuser={karten.filter(k => k.kategorie === "gebaeude" || k.kategorie === "tiefgarage")}
              kontakte={kontakte} setKontakte={setKontakte}
              onKontaktClick={onKontaktClick} ves={ves}
              akkordeonOffen={akkordeon ? offeneKarteId : null}
              onAkkordeonToggle={akkordeon ? onAkkordeonToggle : null}
              lokalEditGesperrt={aktiveEditId !== null && aktiveEditId !== karte.id}
              onLokalEditChange={(aktiv) => setAktiveEditId(aktiv ? karte.id : null)}
              sort={karte.fixed ? null : { canUp: hatNachbar(idx, -1), canDown: hatNachbar(idx, +1),
                onUp: () => verschiebeKarte(idx, -1), onDown: () => verschiebeKarte(idx, +1) }}
              onUpdateKarte={(neuKarte) => setKarten(v => v.map(k => k.id === karte.id ? neuKarte : k))}
              onRename={(neu) => setKarten(v => v.map(k => k.id === karte.id ? { ...k, name: neu } : k))}
              onRemove={karte.fixed ? null : () => setKarten(v => v.filter(k => k.id !== karte.id))}/>
          ) : (
            <GebaeudeKarte karte={karte} t={t} accent={accent} editMode={editMode}
              kontakte={kontakte} setKontakte={setKontakte}
              alleGeraete={alleGeraete}
              ohneEinheiten={ohneEinheiten} onKontaktClick={onKontaktClick}
              ves={ves} onVEClick={null}
              etvStamm={etvStamm} onSyncChange={onSyncChange}
              lokalEditGesperrt={aktiveEditId !== null && aktiveEditId !== karte.id}
              onLokalEditChange={(aktiv) => setAktiveEditId(aktiv ? karte.id : null)}
              akkordeonOffen={akkordeon ? offeneKarteId : null}
              onAkkordeonToggle={akkordeon ? onAkkordeonToggle : null}
              sort={karte.fixed ? null : { canUp: hatNachbar(idx, -1), canDown: hatNachbar(idx, +1),
                onUp: () => verschiebeKarte(idx, -1), onDown: () => verschiebeKarte(idx, +1) }}
              onUpdateKarte={(neuKarte) => setKarten(v => v.map(k => k.id === karte.id ? neuKarte : k))}
              onRename={(neu) => setKarten(v => v.map(k => k.id === karte.id ? { ...k, name: neu } : k))}
              onRemove={karte.fixed ? null : () => setKarten(v => v.filter(k => k.id !== karte.id))}/>
          )}
        </div>
      ))}
    </div>
  );
}

// ── NeueKarteMenu (oben fragwürdige IIFEs vermeiden) ────────────────────────
function NeueKarteMenu({ t, accent, onAdd, optionen }) {
  const [offen, setOffen] = useState(false);
  const dropdownRef = useRef(null);
  // Beim Aufklappen sicherstellen, dass die Auswahl sichtbar wird
  // (insbesondere wenn der Button am unteren Rand des scrollbaren Panes ist).
  useEffect(() => {
    if (offen && dropdownRef.current) {
      // Kleiner Delay, damit das DOM mit dem geöffneten Dropdown gerendert ist
      const id = setTimeout(() => {
        if (dropdownRef.current) {
          dropdownRef.current.scrollIntoView({ behavior: "smooth", block: "end" });
        }
      }, 50);
      return () => clearTimeout(id);
    }
  }, [offen]);
  const opts = optionen || [
    { id: "gebaeude",       icon: "🏠", label: "Weiteres Gebäude",       sub: "Hinterhaus, Nebengebäude…" },
    { id: "tiefgarage",     icon: "🅿️", label: "Tiefgarage",              sub: "Unterirdische Parkebene(n)" },
    { id: "stellplatz",     icon: "🚗", label: "Stellplätze / Garagen / Carports",  sub: "Außenstellplätze, Garagen, Carports" },
    { id: "technik",        icon: "⚙",  label: "Technik",                 sub: "Heizung, Aufzug, Zähler …" },
    { id: "zugang",         icon: "🔑", label: "Zugang / Schließanlage",   sub: "Schlüssel, Sicherheitskarten …" },
    { id: "sonstige",       icon: "🏷", label: "Eigene Karte",            sub: "Frei benennbar" },
  ];
  return (
    <div style={{ border: offen ? `1px solid ${accent}40` : "none",
      borderRadius: RAD.lg, overflow: "hidden",
      background: offen ? accent + "10" : "transparent" }}>
      <button onClick={() => setOffen(v => !v)} style={{
        width: "100%", display: "flex", alignItems: "center", gap: 10,
        background: offen ? accent + "20" : accent + "18",
        border: offen ? "none" : `1px solid ${accent}40`,
        borderBottom: offen ? `1px solid ${accent}30` : `1px solid ${accent}40`,
        borderRadius: offen ? 0 : RAD.lg, padding: "12px 0", cursor: "pointer",
        justifyContent: "center", color: accent, fontSize: FS.m, fontWeight: FW.bold,
        transition: "all 0.15s", fontFamily: "inherit" }}
        onMouseEnter={e => { if (!offen) e.currentTarget.style.background = accent + "28"; }}
        onMouseLeave={e => { if (!offen) e.currentTarget.style.background = accent + "18"; }}>
        <I name="plus" size={15} color={accent}/>
        {offen ? "Kartentyp wählen…" : "Neue Karte hinzufügen"}
      </button>
      {/* Optionen als zusammenhängender Teil des Buttons (gleicher Tint),
          nicht als separate Kartenliste. */}
      {offen && (
        <div ref={dropdownRef}>
          {opts.map((opt, i) => (
            <button key={opt.id} onClick={() => { onAdd(opt.id); setOffen(false); }} style={{
              width: "100%", display: "flex", alignItems: "center", gap: 12,
              background: "transparent", border: "none",
              borderBottom: i < opts.length - 1 ? `1px solid ${accent}20` : "none",
              padding: "10px 14px", cursor: "pointer", textAlign: "left", fontFamily: "inherit" }}
              onMouseEnter={e => e.currentTarget.style.background = accent + "14"}
              onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
              <span style={{ fontSize: FS.icon }}>{opt.icon}</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: FS.m, fontWeight: FW.bold, color: t.text }}>{opt.label}</div>
                <div style={{ fontSize: FS.xs, color: t.sub }}>{opt.sub}</div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── LiegenschaftAnsicht: alles zusammen für eine VE ─────────────────────────
// Karten werden in ve.karten persistiert (über setVes). Wenn ve.karten noch
// nicht existiert (alte/Demo-Daten), bauen wir Defaults aus buildInitialKarten
// und schreiben sie beim ersten Edit zurück.
function LiegenschaftAnsicht({ ve, setVes, t, accent, kontakte, setKontakte, editMode = false, onKontaktClick, ves = [], etvStamm = null, onSyncChange = null, sprungKarte = null }) {
  // Derived state: aus ve.karten oder Default
  const karten = ergaenzeStammSyncFelder((ve && Array.isArray(ve.karten) && ve.karten.length > 0)
    ? ve.karten : buildInitialKarten(ve));

  // setKarten persistiert die neuen Karten in ve.karten. Zusätzlich werden
  // einige Stammdaten-Felder zu Top-Level-Feldern des VE gesynced (nr, adresse),
  // und ve.einheiten wird aus allen einheiten-haltenden Karten aggregiert.
  const setKarten = (updater, scrollZielId) => {
    if (!setVes) return;
    const neuKarten = typeof updater === "function" ? updater(karten) : updater;
    // Einheiten vorab aggregieren — wird für ve-Update UND Kontakt-Ableitung gebraucht.
    const alleEinheiten = neuKarten
      .filter(k => Array.isArray(k.einheiten))
      .flatMap(k => k.einheiten);
    const commit = () => {
      setVes(prev => prev.map(v => {
        if (v.id !== ve.id) return v;
        const updated = { ...v, karten: neuKarten };
        // Stammdaten-Karte → ve.nr und ve.adresse syncen
        const stammKarte = neuKarten.find(k => k.kategorie === "stammdaten");
        if (stammKarte && Array.isArray(stammKarte.stamm)) {
          const findVal = (n) => {
            const f = stammKarte.stamm.find(x => x.name === n);
            return f ? f.value : null;
          };
          const nr = findVal("VE-Nummer");
          const strasse = findVal("Straße");
          const plz = findVal("PLZ");
          const ort = findVal("Ort");
          const plzOrt = joinPlzOrt(plz, ort) || findVal("PLZ / Ort");
          if (nr != null && nr !== "") updated.nr = nr;
          if ((strasse != null && strasse !== "") || (plzOrt != null && plzOrt !== "")) {
            updated.adresse = [strasse, plzOrt].filter(s => s != null && s !== "").join(", ");
          }
        }
        updated.einheiten = alleEinheiten;
        return updated;
      }));
      // Kontakt-Rollen (objektZuweisungen) zentral aus den Einheiten ableiten,
      // damit Eigentümer/Mieter/Bewohner/SEV im Kontakt-Profil korrekt erscheinen.
      // Läuft als eigener Setter (nicht verschachtelt im setVes-Updater).
      if (setKontakte) {
        const veFuerAbleitung = { ...ve, id: ve.id, einheiten: alleEinheiten };
        setKontakte(prevK => wendeKontaktZuweisungenAn(prevK, veFuerAbleitung));
      }
    };
    if (scrollZielId != null) {
      commit();
      if (typeof window !== "undefined") {
        window.requestAnimationFrame(() => scrollToCard("vwkarte-" + scrollZielId));
      }
    } else {
      // Position halten — kein Sprung nach oben (robuster Anker + echter Scroller).
      haltePositionUeberUpdate((karten || []).map(k => k.id), "vwkarte-", commit);
    }
  };

  const addKarte = (typ) => {
    const tpl = ({
      gebaeude:       { name: "Neues Gebäude",   icon: "🏠", kategorie: "gebaeude",
        stamm: [{ id: 1, name: "Baujahr", value: "", type: "number" }], raeume: [] },
      tiefgarage:     { name: "Tiefgarage",      icon: "🅿️", kategorie: "tiefgarage",
        stamm: [] },
      stellplatz:     { name: "Stellplätze",     icon: "🚗", kategorie: "stellplatz",
        stamm: [] },
      technik:        { name: "Technik",         icon: "⚙",  kategorie: "technik",
        stamm: [{ id: 1, name: "Heizart", value: "", type: "text" }], technikGeraete: [] },
      zugang:         { name: "Zugang / Schließanlage", icon: "🔑", kategorie: "zugang",
        stamm: [
          { id: 1, name: "Schlüsseldienst",  value: "" },
          { id: 2, name: "Sicherheitskarte", value: "" },
          { id: 3, name: "Hersteller",       value: "" },
        ] },
      sonstige:       { name: "Neue Karte",      icon: "🏷", kategorie: "stammdaten", stamm: [] },
    })[typ];
    if (!tpl) return;
    const neueId = Date.now();
    setKarten(v => {
      const neu = { id: neueId, ...tpl, fixed: false, einheiten: tpl.einheiten || [] };
      // Ans Ende der Liste — direkt über dem „Neue Karte"-Button, der jetzt
      // unten sitzt. So erscheint die neue Karte genau dort, wo geklickt wurde.
      return [...v, neu];
    });
    // Kein scrollZielId: Position halten statt zur Karte zu springen. Die neue
    // Karte sitzt direkt über dem zuvor sichtbaren Button und bleibt im Blick.
  };

  return (
    <div>
      {/* Hinweis-Zeile sichtbar nur im Edit-Modus — dezent, ohne Box */}
      {editMode && (
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 12,
          padding: "2px 2px" }}>
          <I name="lockOpen" size={12} color={t.sub}/>
          <span style={{ fontSize: FS.xs, color: t.sub, fontWeight: FW.regular }}>
            Bearbeitung aktiv — Felder ziehen zum Sortieren · Karten umbenennen, ergänzen, löschen
          </span>
        </div>
      )}

      <KartenList karten={karten} setKarten={setKarten} t={t} accent={accent} editMode={editMode}
        kontakte={kontakte} setKontakte={setKontakte} ve={ve} onKontaktClick={onKontaktClick} ves={ves} etvStamm={etvStamm} onSyncChange={onSyncChange}
        sprungKarte={sprungKarte}/>

      {editMode && (
        <div style={{ marginTop: 4 }}>
          <NeueKarteMenu t={t} accent={accent} onAdd={addKarte}/>
        </div>
      )}
    </div>
  );
}

// ── VerwaltungAnsicht: Karten für Verwaltung (Stammdaten, ETV, Versicherungen, Verträge) ─
// ── Dokumente: Katalog WEG-relevanter Unterlagen ────────────────────────────
// Jeder Eintrag: id, label, icon und (optional) spezifische Felder zusätzlich zu
// den gemeinsamen Basisfeldern. Reihenfolge = Anzeige in der Checkliste.
const DOKUMENT_KATALOG = [
  { id: "teilungserklaerung",  label: "Teilungserklärung",          icon: "📜",
    felder: [ { name: "Notarielle Urkunde Nr.", type: "text" }, { name: "Beurkundet am", type: "date" }, { name: "Notar", type: "kontakt" } ] },
  { id: "gemeinschaftsordnung", label: "Gemeinschaftsordnung",       icon: "⚖️",
    felder: [ { name: "Letzte Änderung", type: "date" } ] },
  { id: "abgeschlossenheit",   label: "Abgeschlossenheitsbescheinigung", icon: "🏛",
    felder: [ { name: "Ausgestellt von", type: "text" }, { name: "Ausgestellt am", type: "date" } ] },
  { id: "aufteilungsplan",     label: "Aufteilungsplan",            icon: "📐",
    felder: [ { name: "Plan-Nr.", type: "text" } ] },
  { id: "energieausweis",      label: "Energieausweis",             icon: "🌡",
    felder: [ { name: "Typ", type: "select", optionen: ["Verbrauchsausweis", "Bedarfsausweis"] },
              { name: "Gültig bis", type: "date" }, { name: "Energiekennwert", type: "text" }, { name: "Effizienzklasse", type: "text" } ] },
  { id: "isfp",                label: "iSFP (Sanierungsfahrplan)",  icon: "♻️",
    felder: [ { name: "Erstellt am", type: "date" }, { name: "Energieberater", type: "kontakt" } ] },
  { id: "hausordnung",         label: "Hausordnung",                icon: "🏠",
    felder: [ { name: "Beschlossen am", type: "date" } ] },
  { id: "garagenordnung",      label: "Garagenordnung",             icon: "🚗",
    felder: [ { name: "Beschlossen am", type: "date" } ] },
  { id: "brandschutzordnung",  label: "Brandschutzordnung",         icon: "🧯",
    felder: [ { name: "Stand", type: "date" }, { name: "Brandschutzbeauftragter", type: "kontakt" } ] },
  { id: "kontakte_aushang",    label: "Kontakte-Aushang",           icon: "📌",
    felder: [ { name: "Aktualisiert am", type: "date" } ] },
  { id: "handwerkerliste",     label: "Handwerkerliste",            icon: "🔧",
    felder: [ { name: "Aktualisiert am", type: "date" } ] },
  { id: "grundbuchauszug",     label: "Grundbuchauszug",            icon: "📗",
    felder: [ { name: "Grundbuch von", type: "text" }, { name: "Blatt-Nr.", type: "text" }, { name: "Stand", type: "date" } ] },
  { id: "erbbaurecht",         label: "Erbbaurecht",                icon: "🏛",
    felder: [ { name: "Erbbauberechtigter", type: "kontakt" },
              { name: "Grundstückseigentümer", type: "kontakt" },
              { name: "Bestellt am", type: "date" },
              { name: "Laufzeit (Jahre)", type: "number" },
              { name: "Erbbaurecht endet", type: "date" },
              { name: "Erbbauzins (€/Jahr)", type: "number" },
              { name: "Wertsicherung", type: "text" },
              { name: "Heimfall-Regelung", type: "text" } ] },
  { id: "baubeschreibung",     label: "Baubeschreibung",            icon: "🏗",
    felder: [ { name: "Baujahr", type: "number" } ] },
];

// Gemeinsame Basisfelder für jedes Dokument (vor den typspezifischen Feldern).
function dokumentBasisFelder() {
  const t0 = Date.now();
  return [
    { id: t0 + 1, name: "Vorhanden seit",  type: "date",    value: "" },
    { id: t0 + 2, name: "Ablage / Ort",    type: "text",    value: "" },
    { id: t0 + 3, name: "Zuständig",       type: "kontakt", value: "", kontaktId: null },
    { id: t0 + 4, name: "Notiz",           type: "text",    value: "" },
  ];
}

// Erzeugt die Karte für ein angehaktes Dokument: Basisfelder + typspezifische.
function neueDokumentKarte(katalogId) {
  const def = DOKUMENT_KATALOG.find(d => d.id === katalogId);
  if (!def) return null;
  const felder = dokumentBasisFelder();
  let seq = 100;
  (def.felder || []).forEach(f => {
    seq += 1;
    const feld = { id: Date.now() + seq, name: f.name, type: f.type, value: "" };
    if (f.type === "kontakt") feld.kontaktId = null;
    if (f.type === "select") feld.optionen = (f.optionen || []).slice();
    felder.push(feld);
  });
  return {
    id: Date.now() + Math.floor(Math.random() * 1000),
    name: def.label, icon: def.icon, fixed: false,
    kategorie: "stammdaten",      // nutzt die generische GebaeudeKarte-Darstellung (FieldList)
    dokumentId: def.id,           // Rückverweis auf den Katalog-Eintrag
    stamm: felder, einheiten: [],
  };
}

// ── VerteilerSchluesselBlock — gemeinsamer Baustein (SSoT) für den
//    Verwaltung-Tab (editierbar = globaler editMode) und die Schnelleingabe
//    (editierbar = immer). Zeigt die vier Standard-Schlüssel + eigene,
//    klappt je Schlüssel die Einheiten-Werte auf (berechnete Basen read-only,
//    personen/manuell editierbar) und erlaubt Anlegen/Löschen eigener
//    Schlüssel. Persistiert NUR Deltas in ve.verteilerschluessel.
function VerteilerSchluesselBlock({ ve, setVes, t, accent, editierbar = false }) {
  const [aufId, setAufId] = useState(null);
  const [neuForm, setNeuForm] = useState(false);
  const [neuName, setNeuName] = useState("");
  const [neuBasis, setNeuBasis] = useState("manuell");
  const [loeschBestaetigung, setLoeschBestaetigung] = useState(null);

  const schluessel = effVerteilerschluessel(ve);
  const einheiten = (ve && Array.isArray(ve.einheiten)) ? ve.einheiten : [];

  const speichere = (id, patch) => {
    if (!setVes || !ve) return;
    setVes(prev => prev.map(v => {
      if (v.id !== ve.id) return v;
      const liste = Array.isArray(v.verteilerschluessel) ? v.verteilerschluessel : [];
      const idx = liste.findIndex(x => x && x.id === id);
      const neu = idx >= 0
        ? liste.map((x, i) => i === idx ? { ...x, ...patch } : x)
        : [...liste, { id: id, ...patch }];
      return { ...v, verteilerschluessel: neu };
    }));
  };
  const loesche = (id) => {
    if (!setVes || !ve) return;
    setVes(prev => prev.map(v => v.id === ve.id
      ? { ...v, verteilerschluessel: (Array.isArray(v.verteilerschluessel) ? v.verteilerschluessel : [])
          .filter(x => x && x.id !== id) }
      : v));
    setLoeschBestaetigung(null);
    if (aufId === id) setAufId(null);
  };
  const setzeAnteil = (s, einheitId, wert) => {
    const anteile = { ...((s && s.anteile) || {}) };
    anteile[einheitId] = wert;
    speichere(s.id, { anteile: anteile });
  };
  const legeAn = () => {
    if (!neuName.trim()) return;
    const id = "vs-" + Date.now();
    speichere(id, { name: neuName.trim(), basis: neuBasis, anteile: {} });
    setNeuName(""); setNeuBasis("manuell"); setNeuForm(false);
    setAufId(id);
  };

  const fmtZahl = (n) => {
    const r = Math.round(n * 1000) / 1000;
    return String(r).replace(".", ",");
  };

  const inputStilKlein = { background: t.surface, border: `1px solid ${t.border}`,
    borderRadius: RAD.sm, padding: "5px 8px", fontSize: FS.input, color: t.text,
    outline: "none", fontFamily: "inherit", width: "100%", boxSizing: "border-box" };

  return (
    <div style={{ background: t.card, border: `1px solid ${t.border}`,
      borderRadius: RAD.lg, marginBottom: 12, overflow: "hidden" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "14px 16px",
        borderBottom: `1px solid ${t.border}` }}>
        <span style={{ fontSize: FS.icon }}>🧮</span>
        <div style={{ fontSize: FS.xl, fontWeight: FW.bold, color: t.text }}>Verteilerschlüssel</div>
      </div>
      <div style={{ padding: "6px 8px" }}>
        {schluessel.map(s => {
          const auf = aufId === s.id;
          const manuell = vsIstManuell(s.basis);
          const summe = einheiten.reduce((acc, e) => acc + vsWertVon(s, e), 0);
          const confirm = loeschBestaetigung === s.id;
          return (
            <div key={s.id} style={{ borderBottom: `1px solid ${t.border}25` }}>
              <div onClick={() => setAufId(auf ? null : s.id)}
                style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 8px",
                  cursor: "pointer" }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: FS.m, fontWeight: FW.medium, color: t.text }}>{s.name}</div>
                  <div style={{ fontSize: FS.xs, color: t.muted }}>{vsBasisLabel(s.basis)}</div>
                </div>
                <div style={{ fontSize: FS.s, color: t.sub, flexShrink: 0 }}>
                  Σ {fmtZahl(summe)}
                </div>
              </div>
              {auf ? (
                <div style={{ padding: "0 8px 10px" }}>
                  {einheiten.length === 0 ? (
                    <div style={{ fontSize: FS.s, color: t.muted, padding: "4px 0" }}>
                      Keine Einheiten im Objekt.
                    </div>
                  ) : (
                    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                      {einheiten.map(e => {
                        const wert = vsWertVon(s, e);
                        const roh = manuell ? (((s.anteile || {})[e.id]) || "") : null;
                        return (
                          <div key={e.id} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                            <div style={{ flex: 1, minWidth: 0, fontSize: FS.s, color: t.text,
                              overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                              {e.nr || e.id}
                              {e.lage ? <span style={{ color: t.muted }}> · {e.lage}</span> : null}
                            </div>
                            {manuell && editierbar ? (
                              <input value={roh}
                                onChange={ev => setzeAnteil(s, e.id, ev.target.value)}
                                inputMode="decimal" placeholder="0"
                                style={{ ...inputStilKlein, width: 90, textAlign: "right", flexShrink: 0 }}/>
                            ) : (
                              <div style={{ fontSize: FS.s, color: t.sub, flexShrink: 0,
                                minWidth: 60, textAlign: "right" }}>{fmtZahl(wert)}</div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                  {!s.fix && editierbar ? (
                    confirm ? (
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 10 }}>
                        <div style={{ flex: 1, fontSize: FS.xs, color: t.sub }}>
                          Schlüssel „{s.name}" wirklich entfernen?
                        </div>
                        <button onClick={() => setLoeschBestaetigung(null)}
                          style={{ background: "none", border: `1px solid ${t.border}`, color: t.sub,
                            borderRadius: RAD.sm, padding: "4px 10px", fontSize: FS.xs,
                            cursor: "pointer", fontFamily: "inherit" }}>Behalten</button>
                        <button onClick={() => loesche(s.id)}
                          style={{ background: "#EF4444", border: "1px solid #EF4444", color: "#fff",
                            borderRadius: RAD.sm, padding: "4px 10px", fontSize: FS.xs,
                            fontWeight: FW.medium, cursor: "pointer", fontFamily: "inherit" }}>Entfernen</button>
                      </div>
                    ) : (
                      <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 10 }}>
                        <button onClick={() => setLoeschBestaetigung(s.id)}
                          style={{ background: "none", border: "none", color: "#EF4444",
                            fontSize: FS.xs, cursor: "pointer", fontFamily: "inherit" }}>
                          Schlüssel entfernen
                        </button>
                      </div>
                    )
                  ) : null}
                </div>
              ) : null}
            </div>
          );
        })}
        {editierbar ? (
          neuForm ? (
            <div style={{ padding: "10px 8px" }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                <input value={neuName} onChange={e => setNeuName(e.target.value)}
                  placeholder="Name (z. B. Aufzug)" style={inputStilKlein}/>
                <select value={neuBasis} onChange={e => setNeuBasis(e.target.value)}
                  style={{ ...inputStilKlein, cursor: "pointer" }}>
                  {VS_BASEN.map(b => <option key={b.id} value={b.id}>{b.label}</option>)}
                </select>
              </div>
              <div style={{ display: "flex", gap: 6, marginTop: 8, justifyContent: "flex-end" }}>
                <button onClick={() => { setNeuForm(false); setNeuName(""); }}
                  style={{ background: "none", border: `1px solid ${t.border}`, color: t.sub,
                    borderRadius: RAD.sm, padding: "5px 12px", fontSize: FS.s,
                    cursor: "pointer", fontFamily: "inherit" }}>Abbrechen</button>
                <button onClick={legeAn} disabled={!neuName.trim()}
                  style={{ background: neuName.trim() ? accent : "transparent",
                    border: `1px solid ${accent}`,
                    color: neuName.trim() ? "#fff" : accent,
                    borderRadius: RAD.sm, padding: "5px 12px", fontSize: FS.s,
                    fontWeight: FW.medium,
                    cursor: neuName.trim() ? "pointer" : "not-allowed",
                    fontFamily: "inherit" }}>Anlegen</button>
              </div>
            </div>
          ) : (
            <button onClick={() => setNeuForm(true)}
              style={{ display: "flex", alignItems: "center", gap: 6, background: "none",
                border: "none", color: accent, fontSize: FS.s, fontWeight: FW.medium,
                cursor: "pointer", fontFamily: "inherit", padding: "10px 8px" }}>
              <I name="plus" size={13} color={accent}/> Schlüssel anlegen
            </button>
          )
        ) : null}
      </div>
    </div>
  );
}

function VerwaltungAnsicht({ ve, setVes, t, accent, kontakte, setKontakte, editMode = false, onKontaktClick, ves = [], etvStamm = null, onSyncChange = null, sprungKarte = null }) {
  // Derived state: persistierte Karten (ve.verwaltungsKarten) als Basis; fehlende
  // Standard-Karten (z. B. Versicherungen bei Altbeständen) aus dem Default
  // ergänzen, damit neue Standard-Kategorien überall erscheinen. Eigene Karten
  // bleiben erhalten. Eigenes Feld (NICHT ve.karten), damit die Einheiten-
  // Aggregation der Liegenschaft die Verwaltungs-Karten nie anfasst.
  const kartenRoh = mergeVerwaltungsKarten(
    (ve && Array.isArray(ve.verwaltungsKarten)) ? ve.verwaltungsKarten : null,
    buildInitialVerwaltungsKarten(ve)
  );
  // Berechnete Felder (z. B. „Nächste Wahl") aus den aktuellen Feldwerten der
  // Karte ableiten — auch nach dem Merge persistierter Karten, damit sie stets
  // den gespeicherten „Bestellt bis"/„Nächste ETV"-Werten folgen.
  const karten = kartenRoh.map(k => {
    if (k.kategorie !== "verwaltung_stamm" || !Array.isArray(k.stamm)) return k;
    const feld = (n) => { const f = k.stamm.find(x => x.name === n); return f ? f.value : ""; };
    const bestelltBis = feld("Bestellt bis");
    const naechsteETV = (ve.verwaltung && ve.verwaltung.naechsteETV) || "";
    const text = berechneNaechsteWahl(bestelltBis, naechsteETV);
    return { ...k, stamm: k.stamm.map(f =>
      (f.type === "computed" && f.name === "Nächste Wahl") ? { ...f, value: text } : f) };
  });

  // setKarten persistiert nach ve.verwaltungsKarten. Bewusst OHNE Einheiten-
  // Aggregation / Stammdaten-Sync — Verwaltungs-Karten tragen keine Einheiten.
  // Scroll-Restore analog LiegenschaftAnsicht: an einer sichtbaren Karte
  // verankern und relativ nachkorrigieren (absolute Pixel sind unzuverlässig).
  const setKarten = (updater, scrollZielId) => {
    if (!setVes) return;
    const neuKarten = typeof updater === "function" ? updater(karten) : updater;
    const commit = () => setVes(prev => prev.map(v =>
      v.id === ve.id ? { ...v, verwaltungsKarten: neuKarten } : v));
    if (scrollZielId != null) {
      commit();
      if (typeof window !== "undefined") {
        window.requestAnimationFrame(() => scrollToCard("vwkarte-" + scrollZielId));
      }
    } else {
      haltePositionUeberUpdate((karten || []).map(k => k.id), "vwkarte-", commit);
    }
  };

  const addKarte = (typ) => {
    const tpl = ({
      sonstige: { name: "Neue Karte", icon: "🏷", kategorie: "stammdaten", stamm: [] },
    })[typ];
    if (!tpl) return;
    const neueId = Date.now();
    setKarten(v => {
      const neu = { id: neueId, ...tpl, fixed: false, einheiten: tpl.einheiten || [] };
      // Ans Ende der Liste — direkt über dem „Neue Karte"-Button, der unten
      // sitzt. So erscheint die neue Karte genau dort, wo geklickt wurde.
      return [...v, neu];
    });
    // Kein scrollZielId: Position halten statt zur Karte zu springen.
  };

  return (
    <div>
      {editMode && (
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 12,
          padding: "2px 2px" }}>
          <I name="lockOpen" size={12} color={t.sub}/>
          <span style={{ fontSize: FS.xs, color: t.sub, fontWeight: FW.regular }}>
            Bearbeitung aktiv — Karten umbenennen, ergänzen, sortieren oder löschen
          </span>
        </div>
      )}

      <KartenList karten={karten} setKarten={setKarten} t={t} accent={accent} editMode={editMode}
        kontakte={kontakte} setKontakte={setKontakte} ve={ve} onKontaktClick={onKontaktClick} ves={ves}
        etvStamm={etvStamm} onSyncChange={onSyncChange}
        sprungKarte={sprungKarte}
        ohneEinheiten/>

      <VerteilerSchluesselBlock ve={ve} setVes={setVes} t={t} accent={accent}
        editierbar={editMode}/>

      {editMode && (
        <div style={{ marginTop: 4 }}>
          <button onClick={() => addKarte("sonstige")} style={{
            width: "100%", display: "flex", alignItems: "center", gap: 10,
            background: accent + "18", border: `1px solid ${accent}40`,
            borderRadius: RAD.lg, padding: "12px 0", cursor: "pointer",
            justifyContent: "center", color: accent, fontSize: FS.m, fontWeight: FW.bold,
            transition: "all 0.15s", fontFamily: "inherit" }}
            onMouseEnter={e => e.currentTarget.style.background = accent + "28"}
            onMouseLeave={e => e.currentTarget.style.background = accent + "18"}>
            <I name="plus" size={15} color={accent}/>
            Neue Karte hinzufügen
          </button>
        </div>
      )}
    </div>
  );
}

// ── DokumenteChecklist: erste Karte im Dokumente-Tab. Listet alle WEG-relevanten
// Unterlagen mit Checkbox. Haken setzen → fügt darunter eine Dokument-Karte
// hinzu; Haken entfernen → entfernt sie wieder (mit den erfassten Feldern).
function DokumenteChecklist({ karten, setKarten, t, accent, editMode }) {
  // Welche Katalog-Dokumente sind bereits als Karte vorhanden?
  const vorhandene = {};
  (karten || []).forEach(k => { if (k && k.dokumentId) vorhandene[k.dokumentId] = k; });
  const [bestaetigeEntfernen, setBestaetigeEntfernen] = useState(null); // katalogId, der entfernt werden soll

  const toggle = (katId, an) => {
    if (an) {
      // hinzufügen — nur wenn noch nicht vorhanden
      if (vorhandene[katId]) return;
      const neu = neueDokumentKarte(katId);
      if (neu) setKarten(v => [...v, neu]);
    } else {
      // Wenn schon Felder befüllt → Bestätigung verlangen, sonst direkt entfernen.
      const karte = vorhandene[katId];
      const hatInhalt = karte && Array.isArray(karte.stamm) &&
        karte.stamm.some(f => (f.value && String(f.value).trim()) || f.kontaktId);
      if (hatInhalt) { setBestaetigeEntfernen(katId); return; }
      setKarten(v => v.filter(k => k.dokumentId !== katId));
    }
  };
  const entfernenBestaetigt = (katId) => {
    setKarten(v => v.filter(k => k.dokumentId !== katId));
    setBestaetigeEntfernen(null);
  };

  return (
    <div style={{ background: t.card, border: `1px solid ${t.border}`,
      borderRadius: RAD.lg, marginBottom: 12, overflow: "hidden" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "14px 16px",
        borderBottom: `1px solid ${t.border}` }}>
        <span style={{ fontSize: FS.icon }}>🗂</span>
        <div style={{ fontSize: FS.xl, fontWeight: FW.bold, color: t.text }}>WEG-Unterlagen</div>
      </div>
      <div style={{ padding: "6px 8px" }}>
        {DOKUMENT_KATALOG.filter(dok => editMode || vorhandene[dok.id]).map(dok => {
          const an = !!vorhandene[dok.id];
          const confirm = bestaetigeEntfernen === dok.id;
          return (
            <div key={dok.id}>
              <div onClick={() => editMode && toggle(dok.id, !an)}
                style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 8px",
                  borderBottom: `1px solid ${t.border}25`, cursor: editMode ? "pointer" : "default" }}>
                {/* Checkbox nur im Bearbeiten-Modus */}
                {editMode && (
                  <div style={{ width: 20, height: 20, borderRadius: RAD.sm, flexShrink: 0,
                    border: `1px solid ${an ? accent : t.border}`,
                    background: an ? accent : "transparent",
                    display: "flex", alignItems: "center", justifyContent: "center" }}>
                    {an && <I name="check" size={13} color="#fff"/>}
                  </div>
                )}
                <span style={{ fontSize: FS.l, flexShrink: 0 }}>{dok.icon}</span>
                <span style={{ flex: 1, fontSize: FS.m, color: an ? t.text : t.sub,
                  fontWeight: an ? FW.medium : FW.regular }}>{dok.label}</span>
                {an && editMode && <span style={{ fontSize: FS.xs, color: accent }}>angelegt</span>}
              </div>
              {confirm && (
                <div style={{ padding: "8px 10px", background: "#EF444415",
                  borderBottom: `1px solid ${t.border}25` }}>
                  <div style={{ fontSize: FS.s, color: t.text, marginBottom: 6 }}>
                    „{dok.label}" enthält erfasste Angaben. Karte mit allen Feldern wirklich entfernen?
                  </div>
                  <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
                    <button onClick={() => setBestaetigeEntfernen(null)} style={{
                      background: "none", border: `1px solid ${t.border}`, color: t.sub,
                      borderRadius: RAD.sm, padding: "4px 10px", cursor: "pointer",
                      fontSize: FS.s, fontFamily: "inherit" }}>Behalten</button>
                    <button onClick={() => entfernenBestaetigt(dok.id)} style={{
                      background: "#EF4444", border: "1px solid #EF4444", color: "#fff",
                      borderRadius: RAD.sm, padding: "4px 10px", cursor: "pointer",
                      fontSize: FS.s, fontWeight: FW.medium, fontFamily: "inherit" }}>Entfernen</button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
      {!editMode && Object.keys(vorhandene).length === 0 && (
        <div style={{ padding: "12px 16px", fontSize: FS.s, color: t.muted, fontStyle: "italic" }}>
          Noch keine Unterlagen angehakt. Im Bearbeiten-Modus auswählen, welche Dokumente vorhanden sind.
        </div>
      )}
    </div>
  );
}

// ── DokumenteAnsicht: Dokumente-Tab. Erste Karte = Checkliste; darunter je
// angehaktem Dokument eine eigene Karte (Basisfelder + typspezifische), plus
// frei ergänzbare eigene Karten. Verhalten exakt wie VerwaltungAnsicht.
function DokumenteAnsicht({ ve, setVes, t, accent, kontakte, setKontakte, editMode = false, onKontaktClick, ves = [], sprungKarte = null }) {
  const karten = (ve && Array.isArray(ve.dokumenteKarten)) ? ve.dokumenteKarten : [];

  const setKarten = (updater, scrollZielId) => {
    if (!setVes) return;
    const neuKarten = typeof updater === "function" ? updater(karten) : updater;
    const commit = () => setVes(prev => prev.map(v =>
      v.id === ve.id ? { ...v, dokumenteKarten: neuKarten } : v));
    if (scrollZielId != null) {
      commit();
      if (typeof window !== "undefined") {
        window.requestAnimationFrame(() => scrollToCard("vwkarte-" + scrollZielId));
      }
    } else {
      haltePositionUeberUpdate((karten || []).map(k => k.id), "vwkarte-", commit);
    }
  };

  const addKarte = () => {
    const neueId = Date.now();
    setKarten(v => [...v, { id: neueId, name: "Neues Dokument", icon: "📄", fixed: false,
      kategorie: "stammdaten", stamm: dokumentBasisFelder(), einheiten: [] }]);
  };

  return (
    <div>
      {editMode && (
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 12, padding: "2px 2px" }}>
          <I name="lockOpen" size={12} color={t.sub}/>
          <span style={{ fontSize: FS.xs, color: t.sub }}>
            Bearbeitung aktiv — Unterlagen anhaken, Karten bearbeiten, ergänzen oder löschen
          </span>
        </div>
      )}

      {/* Checkliste der WEG-Unterlagen */}
      <DokumenteChecklist karten={karten} setKarten={setKarten} t={t} accent={accent} editMode={editMode}/>

      {/* Dokument-Karten (aus der Checkliste + eigene) */}
      <KartenList karten={karten} setKarten={setKarten} t={t} accent={accent} editMode={editMode}
        kontakte={kontakte} setKontakte={setKontakte} ve={ve} onKontaktClick={onKontaktClick} ves={ves}
        sprungKarte={sprungKarte}
        ohneEinheiten/>

      {editMode && (
        <div style={{ marginTop: 4 }}>
          <button onClick={addKarte} style={{
            width: "100%", display: "flex", alignItems: "center", gap: 10,
            background: accent + "18", border: `1px solid ${accent}40`,
            borderRadius: RAD.lg, padding: "12px 0", cursor: "pointer",
            justifyContent: "center", color: accent, fontSize: FS.m, fontWeight: FW.bold,
            fontFamily: "inherit" }}>
            <I name="plus" size={15} color={accent}/>
            Eigenes Dokument hinzufügen
          </button>
        </div>
      )}
    </div>
  );
}

// Hilfsfunktion: bauteilen-Karten aus VE-Daten ableiten
// Die drei synchronen ETV-Felder (gemeinsame Quelle ve.etvStamm via syncKey).
// Werden sowohl in der Liegenschaft-Stammdaten- als auch in der Verwaltung-ETV-
// Karte angezeigt; Werte kommen aus ve.etvStamm.
const STAMM_SYNC_FELDER = [
  { name: "Abstimmung nach", value: "MEA", type: "select", optionen: ["MEA", "Objekt", "Kopf"], immerSichtbar: true, syncKey: "abstimmung" },
  { name: "Gesamt-MEA",      value: "1000", type: "select", optionen: ["1000", "10000"], freitextBei: "Andere…", freitextTyp: "number", immerSichtbar: true, syncKey: "gesamtanteile" },
  { name: "Wirtschaftsjahr", value: "Kalenderjahr", type: "select", optionen: ["Kalenderjahr"], freitextBei: "Selbst definieren…", freitextTyp: "zeitraum", immerSichtbar: true, syncKey: "wirtschaftsjahr" },
];
// Ergänzt fehlende Sync-Felder in der festen Liegenschaft-Stammdaten-Karte —
// auch bei Bestandsobjekten mit bereits persistierten ve.karten. Die Felder
// werden hinten an die Stammdaten angehängt; vorhandene (per syncKey erkannt)
// bleiben unverändert.
function ergaenzeStammSyncFelder(karten) {
  if (!Array.isArray(karten)) return karten;
  return karten.map(k => {
    // Technik-Karten: fehlendes „Warmwasserversorgung"-Feld nachrüsten (steuert
    // die Legionellen-Prüfpflicht). Auch bei Bestandsobjekten ohne das Feld.
    if (k && k.kategorie === "technik" && Array.isArray(k.stamm)) {
      const hatWW = k.stamm.some(f => f && f.name === "Warmwasserversorgung");
      if (!hatWW) {
        const maxId = k.stamm.reduce((m, f) => Math.max(m, (f && f.id) || 0), 0);
        const wwFeld = { id: maxId + 1, name: "Warmwasserversorgung", value: "",
          type: "select", optionen: ["Zentral", "Dezentral"], immerSichtbar: true,
          hinweis: "Bei zentraler Warmwasserversorgung gilt die Legionellen-Prüfpflicht (TrinkwV) — der Legionellen-Tab erscheint dann am Objekt." };
        return { ...k, stamm: k.stamm.concat([wwFeld]) };
      }
      return k;
    }
    if (!k || k.kategorie !== "stammdaten" || !k.fixed || !Array.isArray(k.stamm)) return k;
    // Altes „Gesamt-MEA"-Feld (number, ohne syncKey) entfernen — es wird durch das
    // synchrone Feld (gleicher Name, syncKey "gesamtanteile") ersetzt.
    let stamm = k.stamm.filter(f => !(f && f.name === "Gesamt-MEA" && !f.syncKey));
    const vorhandeneKeys = {};
    stamm.forEach(f => { if (f && f.syncKey) vorhandeneKeys[f.syncKey] = true; });
    const fehlen = STAMM_SYNC_FELDER.filter(sf => !vorhandeneKeys[sf.syncKey]);
    if (fehlen.length === 0 && stamm.length === k.stamm.length) return k;
    const maxId = stamm.reduce((m, f) => Math.max(m, (f && f.id) || 0), 0);
    const neue = fehlen.map((sf, i) => ({ id: maxId + 1 + i, ...sf }));
    return { ...k, stamm: stamm.concat(neue) };
  });
}

function buildInitialKarten(ve) {
  const wohnEinheiten = ve.einheiten.filter(e => !isStellplatzTyp(e.typ));
  const stellplaetze  = ve.einheiten.filter(e => isStellplatzTyp(e.typ));
  const adrTeile = (ve.adresse || "").split(",").map(s => s.trim());
  const strasse  = adrTeile[0] || "";
  const _po      = splitPlzOrt(adrTeile[1] || "");

  const karten = [
    { id: 1, name: "Stammdaten", icon: "🏷", fixed: true, kategorie: "stammdaten",
      stamm: [
        { id: 1, name: "VE-Nummer",      value: ve.nr,             type: "text", required: true },
        { id: 2, name: "Verwaltungsart", value: "WEG-Verwaltung",  type: "text", required: true },
        { id: 3, name: "Straße",         value: strasse,           type: "text", required: true },
        { id: 4, name: "PLZ",            value: _po.plz,           type: "text", required: true },
        { id: 5, name: "Ort",            value: _po.ort,           type: "text", required: true },
        { id: 7, name: "Abstimmung nach", value: "MEA", type: "select", optionen: ["MEA", "Objekt", "Kopf"], immerSichtbar: true, syncKey: "abstimmung" },
        { id: 8, name: "Gesamt-MEA",     value: "1000", type: "select", optionen: ["1000", "10000"], freitextBei: "Andere…", freitextTyp: "number", immerSichtbar: true, syncKey: "gesamtanteile" },
        { id: 9, name: "Wirtschaftsjahr", value: "Kalenderjahr", type: "select", optionen: ["Kalenderjahr"], freitextBei: "Selbst definieren…", freitextTyp: "zeitraum", immerSichtbar: true, syncKey: "wirtschaftsjahr" },
      ],
      einheiten: [],
    },
    { id: 2, name: "Haus 1", icon: "🏠", fixed: false, kategorie: "gebaeude",
      stamm: [
        { id: 1, name: "Baujahr",       value: "",  type: "number", required: true },
        { id: 2, name: "Stockwerke",    value: "",  type: "number" },
        { id: 3, name: "Aufgänge",      value: "",  type: "number" },
        { id: 4, name: "Ein-/Ausgänge", value: "",  type: "number" },
      ],
      einheiten: wohnEinheiten,
    },
  ];

  if (stellplaetze.length > 0) {
    karten.push({
      id: 3, name: "Stellplätze / Tiefgarage", icon: "🅿️", fixed: false, kategorie: "tiefgarage",
      stamm: [],
      einheiten: stellplaetze,
    });
  }

  karten.push({
    id: 4, name: "Zugang / Schließanlage", icon: "🔑", fixed: false, kategorie: "zugang",
    stamm: [
      { id: 1, name: "Schlüsseldienst",  value: "" },
      { id: 2, name: "Sicherheitskarte", value: "" },
      { id: 3, name: "Hersteller",       value: "" },
    ],
    einheiten: [],
  });

  // ── Technik ───────────────────────────────────────────────────────────────
  // Leer initial – Geräte werden über den Edit-Modus hinzugefügt
  karten.push({
    id: 7, name: "Technik", icon: "⚙", fixed: false, kategorie: "technik",
    stamm: [
      { id: 1, name: "Heizart",       value: "", type: "text" },
      { id: 2, name: "Heizungstyp",   value: "", type: "text" },
      { id: 3, name: "Warmwasserversorgung", value: "", type: "select",
        optionen: ["Zentral", "Dezentral"], immerSichtbar: true,
        hinweis: "Bei zentraler Warmwasserversorgung gilt die Legionellen-Prüfpflicht (TrinkwV) — der Legionellen-Tab erscheint dann am Objekt." },
    ],
    einheiten: [],
    technikGeraete: [],
  });

  return karten;
}

// Persistierte Verwaltungs-Karten mit den Default-Standardkarten zusammenführen.
// - Ist nichts/leer persistiert → komplette Default-Liste.
// - Sonst: persistierte Reihenfolge & Inhalte behalten, aber fehlende
//   Standard-Kategorien (verwaltung_stamm/etv/versicherungen/vertraege) aus dem
//   Default ergänzen. Eigene Karten (kategorie "stammdaten", nicht fixed) bleiben.
function mergeVerwaltungsKarten(persistiert, defaults) {
  if (!Array.isArray(persistiert) || persistiert.length === 0) return defaults;
  const standardKats = ["verwaltung_stamm", "etv", "versicherungen", "versorger", "messdienst", "vertraege"];
  // Standard-Namen aus dem Default je Kategorie, um Altbestände zu normalisieren
  // (z. B. "Stammdaten Verwaltung" → "Verwaltung – Stammdaten").
  const stdName = {};
  const defByKat = {};
  defaults.forEach(d => {
    if (standardKats.indexOf(d.kategorie) >= 0) { stdName[d.kategorie] = d.name; defByKat[d.kategorie] = d; }
  });
  // Feld-Schema fester Standard-Karten aus dem Default übernehmen (Typ, required,
  // immerSichtbar, readOnly = App-Vorgaben), aber die persistierten WERTE
  // (value/kontaktId) behalten. So ziehen Typ-Änderungen (z. B. text→kontakt,
  // text→date, →computed) auch bei Bestandsobjekten durch, ohne Eingaben zu
  // verlieren. Gilt für „verwaltung_stamm" (festes Set) und „etv" (Standard-
  // felder synchronisieren, eigene Felder des Nutzers zusätzlich behalten).
  const syncKats = ["verwaltung_stamm", "etv"];
  const syncSchema = (k) => {
    const def = defByKat[k.kategorie];
    if (!def || syncKats.indexOf(k.kategorie) < 0 || !Array.isArray(def.stamm)) return k;
    const persById = {}, persByName = {};
    (k.stamm || []).forEach(f => { if (f) { if (f.id != null) persById[f.id] = f; if (f.name) persByName[f.name] = f; } });
    const stamm = def.stamm.map(df => {
      const p = persById[df.id] || persByName[df.name] || null;
      // Default = Schema (Typ/Flags + Default-Wert), persistierte Werte drüberlegen.
      const merged = { ...df };
      if (p) {
        if (p.value !== undefined && p.value !== "") merged.value = p.value;
        if (p.kontaktId !== undefined && p.kontaktId !== null) merged.kontaktId = p.kontaktId;
        if (Array.isArray(p.kontaktIds)) merged.kontaktIds = p.kontaktIds;
      }
      // Mehrfach-Kontakte: Bestand mit einzelner kontaktId in kontaktIds wandeln.
      if (df.type === "kontakte") {
        if (!Array.isArray(merged.kontaktIds)) merged.kontaktIds = [];
        if (merged.kontaktIds.length === 0 && p && p.kontaktId != null) {
          merged.kontaktIds = [p.kontaktId];
        }
        merged.kontaktId = undefined;
      }
      // select-Felder: persistierten Wert gegen die Optionen prüfen. Bekannte
      // Alt-Werte auf die neuen Optionen mappen; unbekannte verwerfen (→ offen).
      // Ausnahme: Freitext-Auswahl (freitextBei) lässt beliebige Werte zu.
      if (df.type === "select" && Array.isArray(df.optionen)) {
        const ALT_MAP = { "Erforderlich": "Ja", "Nicht erforderlich": "Nein" };
        let v = merged.value;
        if (v && ALT_MAP[v]) v = ALT_MAP[v];
        if (df.freitextBei) {
          // Zahl-Auswahl: persistierten Wert numerisch mit den Optionen abgleichen.
          // Glatte Werte (keine echten Nachkommastellen) auf die Option mappen,
          // sonst Freitext-Rohwert behalten (z. B. "10000.0000" → bleibt Freitext).
          if (df.freitextTyp === "number" && v) {
            const n = parseAnteile(v);
            // „glatt" = keine im Rohwert ANGEGEBENEN Nachkommastellen (10000.0000
            // hat welche → bleibt Freitext und behält 10.000,0000 in der Anzeige).
            const hatDez = /[.,]\d+\s*$/.test(String(v)) && !/^\d{1,3}(\.\d{3})+$/.test(String(v));
            const treffer = (!hatDez && n !== null) ? df.optionen.find(o => parseAnteile(o) === n) : null;
            merged.value = treffer || v;
          } else {
            merged.value = v || "";
          }
        } else {
          merged.value = (v && df.optionen.indexOf(v) >= 0) ? v : "";
        }
      }
      return merged;
    });
    // Eigene (nicht im Default vorhandene) Felder des Nutzers anhängen.
    const defIds = {}, defNames = {};
    def.stamm.forEach(df => { if (df.id != null) defIds[df.id] = true; if (df.name) defNames[df.name] = true; });
    (k.stamm || []).forEach(f => {
      if (f && !defIds[f.id] && !defNames[f.name]) stamm.push(f);
    });
    return { ...k, stamm };
  };
  const norm = persistiert.map(k => {
    let out = k;
    // Kartennamen nur bei fixen Standardkarten (verwaltung_stamm) normalisieren;
    // umbenennbare Karten (etv u.a.) behalten ihren vom Nutzer gesetzten Namen.
    if (k && k.kategorie === "verwaltung_stamm" && stdName[k.kategorie] && k.name !== stdName[k.kategorie]) {
      out = { ...k, name: stdName[k.kategorie] };
    }
    return syncSchema(out);
  });
  const vorhanden = {};
  norm.forEach(k => { if (k && k.kategorie) vorhanden[k.kategorie] = true; });
  const fehlende = defaults.filter(d =>
    standardKats.indexOf(d.kategorie) >= 0 && !vorhanden[d.kategorie]);
  if (fehlende.length === 0) return norm;
  // Fehlende Standard-Karten in der Default-Reihenfolge hinter die letzte
  // vorhandene Standard-Karte einfügen (vor eigenen Karten am Ende, falls dort).
  let insertIdx = 0;
  for (let i = 0; i < norm.length; i++) {
    if (norm[i] && standardKats.indexOf(norm[i].kategorie) >= 0) insertIdx = i + 1;
  }
  return [...norm.slice(0, insertIdx), ...fehlende, ...norm.slice(insertIdx)];
}

// Hilfsfunktion: Karten der Verwaltungs-Ansicht aus VE-Daten ableiten
// Leitet „Nächste Wahl" aus „Bestellt bis" ab. Die Verwalterbestellung muss in
// der ETV vor Ablauf erfolgen. Ist ein konkretes nächstes ETV-Datum bekannt und
// fällt es ins Ablaufjahr, zeigen wir dieses; sonst das Ablaufjahr mit Hinweis.
function jahrAus(datum) {
  if (!datum) return null;
  if (/^\d{4}-\d{2}-\d{2}/.test(datum)) return parseInt(datum.slice(0, 4), 10);
  const m = datum.match(/(\d{4})$/);
  return m ? parseInt(m[1], 10) : null;
}
// Monat (1-12) aus einem Datum (ISO JJJJ-MM-TT oder TT.MM.JJJJ). null wenn unklar.
function monatAus(datum) {
  if (!datum) return null;
  if (/^\d{4}-\d{2}-\d{2}/.test(datum)) return parseInt(datum.slice(5, 7), 10);
  const m = datum.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
  return m ? parseInt(m[2], 10) : null;
}
function berechneNaechsteWahl(bestelltBis, naechsteETV) {
  const ablaufJahr = jahrAus(bestelltBis);
  if (!ablaufJahr) return "";
  const etvJahr = jahrAus(naechsteETV);
  // Konkretes nächstes ETV-Datum bekannt und im (oder vor dem) Ablaufjahr → das nehmen.
  if (naechsteETV && etvJahr && etvJahr <= ablaufJahr) {
    if (/^\d{4}-\d{2}-\d{2}/.test(naechsteETV)) { const p = naechsteETV.slice(0, 10).split("-"); return "ETV " + p[2] + "." + p[1] + "." + p[0]; }
    return "ETV " + naechsteETV;
  }
  // Sonst Faustregel nach Ablaufmonat: ETVs liegen meist im 1. Halbjahr (Jahres-
  // abrechnung). Läuft die Bestellung VOR Juli aus, ist die ETV des Ablaufjahres
  // oft zu spät — die Wiederbestellung muss dann schon in der Vorjahres-ETV
  // erfolgen → „ETV (Vorjahr)/(Ablaufjahr)". Ab Juli reicht die ETV im Ablaufjahr.
  const monat = monatAus(bestelltBis);
  if (monat !== null && monat < 7) {
    return "ETV " + (ablaufJahr - 1) + "/" + ablaufJahr;
  }
  return "ETV " + ablaufJahr;
}

function buildInitialVerwaltungsKarten(ve) {
  const vw = ve.verwaltung || {};
  // „Nächste Wahl" wird aus „Bestellt bis" abgeleitet: Die Verwalterbestellung
  // muss in der ETV VOR Ablauf erfolgen. Solange kein konkretes nächstes
  // ETV-Datim im Ablaufjahr bekannt ist, zeigen wir das Ablaufjahr bzw. einen
  // Hinweis. Kein frei editierbares Feld mehr (immerSichtbar, read-only).
  const naechsteWahlText = berechneNaechsteWahl(vw.bestelltBis, vw.naechsteETV);
  return [
    // Stammdaten der Verwaltung
    { id: 1, name: "Verwaltung – Stammdaten", icon: "🏷", fixed: true, kategorie: "verwaltung_stamm",
      stamm: [
        { id: 1, name: "Verwaltung ab",             value: vw.beginn || "",      type: "date",   required: true },
        { id: 2, name: "Bestellt bis",              value: vw.bestelltBis || "", type: "date",   required: true },
        { id: 3, name: "Verwalter (Firma)",         value: "", kontaktId: vw.verwalter || null,     type: "kontakt" },
        { id: 4, name: "Buchhalter",                value: "", kontaktId: vw.buchhalter || null,     type: "kontakt" },
        { id: 5, name: "Übernommen von",            value: "", kontaktId: vw.uebernommenVon || null, type: "kontakt" },
        { id: 6, name: "Verw.-Zustimmung erforderlich",  value: vw.verwZustimmung === true ? "Ja" : (vw.verwZustimmung === false ? "Nein" : ""), type: "select", optionen: ["Ja", "Nein"] },
        { id: 8, name: "Letzte Begehung",           value: "", type: "date" },
        { id: 9, name: "Nächste Begehung",          value: "", type: "date" },
        { id: 7, name: "Nächste Wahl",              value: naechsteWahlText, type: "computed", immerSichtbar: true, readOnly: true },
      ],
      einheiten: [],
    },
    // ETV-Stammdaten
    { id: 2, name: "ETV – Stammdaten", icon: "📋", fixed: false, kategorie: "etv",
      stamm: [
        { id: 1, name: "Versammlungsort",  value: "", type: "kontakte", kontaktIds: [], immerSichtbar: true },
        { id: 2, name: "Abstimmung nach",  value: "MEA", type: "select", optionen: ["MEA", "Objekt", "Kopf"], immerSichtbar: true, syncKey: "abstimmung" },
        { id: 3, name: "Gesamt-MEA",       value: "1000", type: "select", optionen: ["1000", "10000"], freitextBei: "Andere…", freitextTyp: "number", immerSichtbar: true, syncKey: "gesamtanteile" },
        { id: 6, name: "Wirtschaftsjahr",  value: "Kalenderjahr", type: "select", optionen: ["Kalenderjahr"], freitextBei: "Selbst definieren…", freitextTyp: "zeitraum", immerSichtbar: true, syncKey: "wirtschaftsjahr" },
        { id: 5, name: "Versammlung online möglich?", value: "", type: "select", optionen: ["Ja", "Nein"], immerSichtbar: true },
        { id: 7, name: "Letzte ETV",       value: "", type: "date", immerSichtbar: true },
        { id: 4, name: "Nächste ETV",      value: vw.naechsteETV || "", type: "etv_naechste", immerSichtbar: true },
      ],
      einheiten: [],
    },
    // Versicherungen — keine vordefinierten Felder; eigene Felder + Verträge frei
    { id: 3, name: "Versicherungen", icon: "🛡", fixed: false, kategorie: "versicherungen",
      stamm: [],
      einheiten: [], vertraege: [],
    },
    // Versorger (Strom/Gas/Wasser/Wärme …)
    { id: 5, name: "Versorger", icon: "⚡", fixed: false, kategorie: "versorger",
      stamm: [], einheiten: [], vertraege: [],
    },
    // Messdienst (Heizkostenabrechnung / Verbrauchserfassung)
    { id: 6, name: "Messdienst", icon: "📊", fixed: false, kategorie: "messdienst",
      stamm: [], einheiten: [], vertraege: [],
    },
    // Verträge
    { id: 4, name: "Verträge", icon: "📄", fixed: false, kategorie: "vertraege",
      stamm: [], einheiten: [],
      vertraege: (ve.vertraege || []).map(v => ({ ...v })),
    },
  ];
}

// ── StatusLeiste (optional unter Karten anhängbar) ──────────────────────────
// Standardisierte Hinweis-Zeile. Hintergrund bleibt neutral (Card-Surface),
// nur der Text wird in der Priorität (ok/info/warn/error/done) eingefärbt.
// Wenn kein Text übergeben wird, bleibt die Leiste leer – aber mit gleicher
// Höhe, sodass alle Karten in einer Reihe gleich groß sind.
// Status-Engine Phase 1
function datumsTagMon(wert) {
  if (!wert) return null;
  var isoM = String(wert).match(/(\d{4})-(\d{2})-(\d{2})/);
  var deM  = String(wert).match(/(\d{1,2})\.(\d{1,2})\./);
  if (isoM) return { tag: parseInt(isoM[3]), monat: parseInt(isoM[2]) };
  if (deM)  return { tag: parseInt(deM[1]),  monat: parseInt(deM[2]) };
  return null;
}
function tagsDiffMS(a, b) { return Math.round((b - a) / 86400000); }
function parseYMD(s) {
  if (!s) return null;
  var p = String(s).split("-");
  if (p.length < 3) return null;
  return new Date(parseInt(p[0]), parseInt(p[1])-1, parseInt(p[2]));
}

// ── Kalender: Termin-Sammelfunktion ──────────────────────────────────────────
// Liest alle Datumsquellen aus Objekten + Kontakten und liefert eine flache,
// nach Datum sortierte Liste. Quellen:
//   · Verwaltung je Objekt: bestelltBis, naechsteETV, naechsteWahl
//   · Verträge je Objekt: einmalig (bis) ODER wiederkehrend (Intervall ab "ab")
//   · Custom-Datumsfelder an Kontakten (Typ "date") als jährliche Jahrestage
// Wiederkehrende Verträge: "ab" ist der Anker, Intervall bestimmt die Schrittweite.
// Alle fälligen Vorkommen im Sichtfenster (Standard 12 Monate) werden erzeugt.
// "bis" beendet die Serie (gekündigt → keine Termine nach diesem Datum).
function intervallMonate(intervall) {
  var s = String(intervall || "").toLowerCase();
  if (s === "monatlich")     return 1;
  if (s === "quartalsweise") return 3;
  if (s === "halbjährlich" || s === "halbjaehrlich") return 6;
  if (s === "jährlich" || s === "jaehrlich")         return 12;
  return 0; // kein/unbekanntes Intervall → nicht wiederkehrend
}

// ── Kalender-Sichtbarkeit von Datum-Feldern ──────────────────────────────────
// Namens-Heuristik: deutet der Feldname auf eine KÜNFTIGE Frist? „Letzte …",
// „Vorhanden seit", „Ausgestellt/Erstellt/Beschlossen/Beurkundet/Aktualisiert
// am" und „Stand" werden ausgelassen. Wird auch als Vorbelegung des
// „Im Kalender anzeigen"-Schalters beim Feld-Anlegen genutzt.
function istFristFeldName(name) {
  var n = (name || "").toLowerCase();
  if (n.indexOf("letzte") >= 0 || n.indexOf("vorhanden seit") >= 0) return false;
  if (n.indexOf("ausgestellt") >= 0 || n.indexOf("erstellt") >= 0
    || n.indexOf("beschlossen") >= 0 || n.indexOf("beurkundet") >= 0
    || n.indexOf("aktualisiert") >= 0 || n === "stand") return false;
  return (n.indexOf("nächst") >= 0 || n.indexOf("naechst") >= 0
    || n.indexOf("gültig bis") >= 0 || n.indexOf("gueltig bis") >= 0
    || n.indexOf("ablauf") >= 0 || n.indexOf(" bis") >= 0 || n.indexOf("bis") === 0
    || n.indexOf("prüfung") >= 0 || n.indexOf("pruefung") >= 0
    || n.indexOf("wartung") >= 0 || n.indexOf("sanierung") >= 0
    || n.indexOf("ausweis") >= 0 || n.indexOf("schlüsseldienst") >= 0
    || n.indexOf("schluesseldienst") >= 0 || n.indexOf("frist") >= 0);
}
// Soll ein Datum-Feld im Kalender erscheinen? Explizites Flag gewinnt
// (imKalender true/false), ohne Flag entscheidet die Namens-Heuristik —
// Bestandsfelder verhalten sich damit unverändert.
function feldImKalender(f) {
  if (!f) return false;
  if (f.imKalender === true) return true;
  if (f.imKalender === false) return false;
  return istFristFeldName(f.name);
}

function KategorieKacheln({ settings, t, aktiverScreen, suchAktiv = false, onKlick }) {
  const aktiv = settings.kacheln.filter(k => k.aktiv).sort((a, b) => a.reihenfolge - b.reihenfolge);
  return (
    <div style={{
      display: "flex", gap: 6,
      overflowX: "auto", overflowY: "hidden",
      width: "100%",
      padding: "0 16px",
      scrollbarWidth: "thin",
      WebkitOverflowScrolling: "touch",
    }}>
      {aktiv.map(k => {
        const ist = !suchAktiv && (aktiverScreen === k.id || (aktiverScreen === "ve" && k.id === "objekte"));
        return (
          <button key={k.id} onClick={() => onKlick(k.id)} style={{
            display: "flex", alignItems: "center", gap: 6,
            padding: "8px 12px",
            background: ist ? k.farbe + "20" : t.surface,
            border: `1px solid ${ist ? k.farbe : t.border}`, borderRadius: RAD.ms,
            cursor: "pointer", transition: "all 0.15s", fontFamily: "inherit",
            flex: "0 0 auto",
          }}
            onMouseEnter={e => { if (!ist) e.currentTarget.style.borderColor = k.farbe + "60"; }}
            onMouseLeave={e => { if (!ist) e.currentTarget.style.borderColor = t.border; }}>
            <div style={{ width: 24, height: 24, borderRadius: RAD.sm, flexShrink: 0,
              background: k.farbe + "20", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <I name={k.icon} size={12} color={k.farbe}/>
            </div>
            <span style={{ fontSize: FS.m, fontWeight: ist ? 700 : 600,
              color: ist ? k.farbe : t.text,
              whiteSpace: "nowrap" }}>{k.label}</span>
          </button>
        );
      })}
    </div>
  );
}

// ── SeitenleisteKacheln (Dashboard links, resizable für Desktop ≥ 900px) ────
// Drei Anzeige-Modi je nach Sidebar-Breite:
//   · breite <  75px: nur Icons
//   · breite < 145px: Icon + erste 2 Buchstaben
//   · breite ≥ 145px: Icon + voller Text
// Breite wird über Drag-Handle am rechten Rand verstellt und in settings.sidebarBreite gespeichert.
function SeitenleisteKacheln({ settings, setSettings, t, aktiverScreen, onKlick }) {
  const aktiv = settings.kacheln.filter(k => k.aktiv).sort((a, b) => a.reihenfolge - b.reihenfolge);
  const breite = settings.sidebarBreite || 200;
  const modus = sidebarModus(breite);
  const [dragging, setDragging] = useState(false);
  const farben = useKontaktFarbe();

  // Drag-Logik: globale Mouse-Listener während des Ziehens
  useEffect(() => {
    if (!dragging) return;
    const onMove = (e) => {
      const neueBreite = Math.max(SIDEBAR_MIN_WIDTH, Math.min(SIDEBAR_MAX_WIDTH, e.clientX));
      setSettings(s => ({ ...s, sidebarBreite: neueBreite }));
    };
    const onUp = () => setDragging(false);
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    document.body.style.cursor = "ew-resize";
    document.body.style.userSelect = "none";
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
  }, [dragging, setSettings]);

  return (
    <aside style={{
      width: breite, flexShrink: 0,
      // Im neuen Layout sitzt der Sidebar-Wrapper bereits in einem flex-Container
      // mit korrekter Höhe (overflowY:auto am Wrapper). Hier nur noch die innere
      // Anordnung — keine sticky-Position, kein top-Offset, kein eigener Scroll.
      display: "flex", flexDirection: "column",
      padding: modus === "icon" ? "10px 6px" : "10px 8px",
      gap: 4,
      transition: dragging ? "none" : "width 0.15s ease",
    }}>
      {aktiv.map(k => {
        const ist = aktiverScreen === k.id || (aktiverScreen === "ve" && k.id === "objekte");
        const label = modus === "icon" ? null
                    : modus === "kurz" ? k.label.substring(0, 2)
                    : k.label;
        return (
          <button key={k.id} onClick={() => onKlick(k.id)} title={k.label} style={{
            display: "flex", alignItems: "center",
            justifyContent: modus === "icon" ? "center" : "flex-start",
            gap: 10, padding: "9px 10px",
            background: ist ? k.farbe + "20" : t.card,
            border: `1px solid ${ist ? k.farbe + "60" : t.border}`,
            borderRadius: RAD.ms, cursor: "pointer", fontFamily: "inherit",
            transition: "all 0.15s", minWidth: 0,
          }}
            onMouseEnter={e => { if (!ist) e.currentTarget.style.borderColor = k.farbe + "60"; }}
            onMouseLeave={e => { if (!ist) e.currentTarget.style.borderColor = t.border; }}>
            <div style={{ width: 28, height: 28, borderRadius: RAD.ms, flexShrink: 0,
              background: k.farbe + "20", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <I name={k.icon} size={14} color={k.farbe}/>
            </div>
            {label && (
              <span style={{ fontSize: FS.l, fontWeight: ist ? 700 : 600,
                color: ist ? k.farbe : t.text, whiteSpace: "nowrap",
                overflow: "hidden", textOverflow: "ellipsis" }}>{label}</span>
            )}
          </button>
        );
      })}
      {/* Drag-Handle am rechten Rand */}
      <div onMouseDown={(e) => { e.preventDefault(); setDragging(true); }}
        style={{
          position: "absolute", top: 0, right: -3, bottom: 0, width: 6,
          cursor: "ew-resize", zIndex: 10,
        }}
        title="Breite ändern – klicken und ziehen">
        <div style={{
          position: "absolute", top: 0, left: 2, bottom: 0, width: 2,
          background: dragging ? farben.objekt : "transparent",
          transition: "background 0.15s",
        }}/>
      </div>
    </aside>
  );
}

// ── HeaderFilterDropdown (globaler Grob-Filter, Mehrfachauswahl, DESIGN §32) ─
// Drei Sektionen (Verwalter/Buchhalter, Verwaltungsart, Objekt-Gruppen) mit
// Häkchen — beliebig kombinierbar (UND zwischen Sektionen, ODER innerhalb).
// Klick auf eine Option toggelt und lässt das Menü OFFEN (Mehrfachauswahl);
// Schließen via Klick außerhalb (useOutsideClick, §2.7) oder „Alle Objekte".
function HeaderFilterDropdown({ sektionen, value, onChange, t, anzahlGesamt = 0, anzahlGefiltert = 0, fullWidth = false }) {
  const [offen, setOffen] = useState(false);
  const wrapRef = useRef(null);
  useOutsideClick(wrapRef, () => setOffen(false), offen);
  const farben = useKontaktFarbe();
  const hf = value || HEADER_FILTER_LEER;
  const aktiv = headerFilterIstAktiv(hf);
  const istLeer = !sektionen || sektionen.length === 0;

  // Button-Beschriftung: nichts gewählt → „Alle Objekte";
  // genau 1 Häkchen → dessen Label; mehrere → „n Filter aktiv".
  const gewaehlt = [];
  (sektionen || []).forEach(s => (s.optionen || []).forEach(o => {
    if ((hf[s.feld] || []).indexOf(o.id) >= 0) gewaehlt.push(o.label);
  }));
  const buttonLabel = !aktiv
    ? "Alle Objekte"
    : (gewaehlt.length === 1 ? gewaehlt[0] : gewaehlt.length + " Filter aktiv");

  const toggleOption = (feld, id) => {
    const liste = (hf[feld] || []).slice();
    const idx = liste.indexOf(id);
    if (idx >= 0) liste.splice(idx, 1); else liste.push(id);
    onChange({ ...hf, [feld]: liste });
  };

  const zeile = (gewaehltJetzt, label, count, onClick, key, reset = false) => (
    <button key={key} onClick={onClick} style={{
      width: "100%", display: "flex", alignItems: "center", gap: 10,
      padding: "9px 14px", background: "none", border: "none",
      cursor: "pointer", textAlign: "left", fontFamily: "inherit" }}
      onMouseEnter={e => e.currentTarget.style.background = farben.objekt + "0C"}
      onMouseLeave={e => e.currentTarget.style.background = "none"}>
      <span style={{ width: 14, flexShrink: 0, display: "flex" }}>
        {gewaehltJetzt && <I name="check" size={13} color={farben.objekt}/>}
      </span>
      <span style={{ fontSize: FS.l,
        fontWeight: gewaehltJetzt ? 700 : 500,
        fontStyle: reset ? "italic" : "normal",
        color: gewaehltJetzt ? farben.objekt : t.text }}>{label}</span>
      {typeof count === "number" && (
        <span style={{ marginLeft: "auto", fontSize: FS.s, color: t.muted }}>({count})</span>
      )}
    </button>
  );

  return (
    <div ref={wrapRef} style={{ position: "relative", flexShrink: fullWidth ? 1 : 0,
      width: fullWidth ? "100%" : "auto" }}>
      <button onClick={() => !istLeer && setOffen(v => !v)}
        disabled={istLeer}
        style={{
          display: "flex", alignItems: "center", gap: 8,
          background: aktiv ? farben.objekt + "14" : t.surface,
          border: `1px solid ${aktiv ? farben.objekt + "70" : t.border}`,
          borderRadius: RAD.ml, padding: "9px 12px",
          cursor: istLeer ? "default" : "pointer",
          opacity: istLeer ? 0.5 : 1,
          color: aktiv ? farben.objekt : t.text, fontSize: FS.l,
          fontWeight: aktiv ? FW.bold : FW.medium,
          width: fullWidth ? "100%" : "auto",
          minWidth: fullWidth ? 0 : 170,
          whiteSpace: "nowrap", fontFamily: "inherit" }}>
        <span style={{ flex: 1, textAlign: "left",
          overflow: "hidden", textOverflow: "ellipsis" }}>
          {buttonLabel}
        </span>
        {aktiv && (
          <span style={{ fontSize: FS.s, color: farben.objekt, fontWeight: FW.semi }}>
            {anzahlGefiltert}/{anzahlGesamt}
          </span>
        )}
        <I name="chevD" size={13} color={aktiv ? farben.objekt : t.sub}/>
      </button>
      {offen && !istLeer && (
        <div style={{ position: "absolute", top: "calc(100% + 6px)",
          left: 0, right: fullWidth ? 0 : "auto", zIndex: 80,
          background: t.card, border: `1px solid ${t.border}`,
          borderRadius: RAD.ml,
          minWidth: fullWidth ? 0 : 240,
          width: fullWidth ? "100%" : "auto",
          maxHeight: "min(60dvh, 480px)", overflowY: "auto",
          boxShadow: "0 12px 40px rgba(0,0,0,0.3)" }}>
          {zeile(!aktiv, "Alle Objekte", anzahlGesamt,
            () => { onChange({ ...HEADER_FILTER_LEER }); setOffen(false); }, "_alle", !aktiv ? false : true)}
          {sektionen.map(s => (
            <Fragment key={s.feld}>
              <div style={{ padding: "8px 14px 4px", fontSize: FS.xs, fontWeight: FW.bold,
                color: t.muted, textTransform: "uppercase", letterSpacing: "0.06em",
                borderTop: `1px solid ${t.border}40` }}>
                {s.titel}
              </div>
              {(s.optionen || []).map(o =>
                zeile((hf[s.feld] || []).indexOf(o.id) >= 0, o.label, o.count,
                  () => toggleOption(s.feld, o.id), s.feld + "_" + o.id))}
            </Fragment>
          ))}
        </div>
      )}
    </div>
  );
}


export {
  ANDERE_OPTION,
  DokumenteAnsicht,
  HeaderFilterDropdown,
  KARTEN_ICONS,
  KategorieKacheln,
  KontaktZuweisungForm,
  LiegenschaftAnsicht,
  SeitenleisteKacheln,
  VerteilerSchluesselBlock,
  VertragFirmaKarte,
  VertragForm,
  VertragZeile,
  VerwaltungAnsicht,
  buildInitialKarten,
  buildInitialVerwaltungsKarten,
  datumsTagMon,
  eigStufen,
  ergaenzeTechnikGeraetFelder,
  feldImKalender,
  gemeinschaftName,
  gemeinschaftVertreter,
  gemeinschaftZustellAdresse,
  intervallMonate,
  istEigentuemergemeinschaft,
  istFristFeldName,
  parseYMD,
  quoteAnteil,
  quoteLabel,
  tagsDiffMS
};
