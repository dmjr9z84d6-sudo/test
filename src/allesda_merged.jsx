import React, { useState, useRef, useEffect, createContext, useContext, Fragment } from "react";

// ═════════════════════════════════════════════════════════════════════════════
//
//   ░█████╗░██╗░░░░░██╗░░░░░███████╗░██████╗██████╗░░█████╗░
//   ██╔══██╗██║░░░░░██║░░░░░██╔════╝██╔════╝██╔══██╗██╔══██╗
//   ███████║██║░░░░░██║░░░░░█████╗░░╚█████╗░██║░░██║███████║
//   ██╔══██║██║░░░░░██║░░░░░██╔══╝░░░╚═══██╗██║░░██║██╔══██║
//   ██║░░██║███████╗███████╗███████╗██████╔╝██████╔╝██║░░██║
//
//   v3.0 · Konsolidierte Hauptdatei · Stand: Mai 2026
//
// ─────────────────────────────────────────────────────────────────────────────
// QUELLE & SCOPE
// ─────────────────────────────────────────────────────────────────────────────
// Diese Datei ist die einzige Hauptdatei der AllesDa-App. Sie wurde
// konsolidiert aus:
//   · app-v2.jsx               → Funktionaler Code (Liegenschaft, Kontakte,
//                                Einstellungen, Suche, Dashboard)
//   · bausteine.jsx            → UI-Komponenten (Avatar, KontaktPicker,
//                                FieldList, WechselModal, PersonCard …)
//   · allesda_design_playground.html → Design-Tokens & Layout-Referenz
//
// Aktiver Fokus laut MindMap "AllesDa Bausteine":
//   ✓ Liegenschaft  (Anschrift, Gebäude, Einheiten, Eigentümer/Mieter)
//   ✓ Kontakte      (Personen + Firmen mit Rollen-System)
//
// Bewusst noch NICHT enthalten (Platzhalter-Screens, kommt später):
//   · ETV / Beschlüsse / Versammlungen
//   · Technik (Heizung, Aufzug, Zähler, PV …)
//   · Verträge & Versicherungen
//   · Dokumente / Ticketsystem / Finanzen
//
// ─────────────────────────────────────────────────────────────────────────────
// INHALTSVERZEICHNIS  (Reihenfolge im File)
// ─────────────────────────────────────────────────────────────────────────────
//
//   ┌─ 1. KONSTANTEN ─────────────────────────────────────────────────────┐
//   │  · Fonts, Themes (DARK/LIGHT), Akzent-Farben                        │
//   └─────────────────────────────────────────────────────────────────────┘
//
//   ┌─ 2. DATENMODELL (Modell A) ─────────────────────────────────────────┐
//   │  · DEFAULT_KONTAKTE  — Personen + Firmen                            │
//   │  · DEFAULT_VES       — Verwaltungseinheiten + Einheiten             │
//   │  · DEFAULT_SETTINGS  — Filter, Kacheln, Such-Kategorien             │
//   │  · FIELD_TYPES — dynamische Felder                                  │
//   └─────────────────────────────────────────────────────────────────────┘
//
//   ┌─ 3. UTILS & ICONS ──────────────────────────────────────────────────┐
//   │  · Heroicons (ICON_PATHS), I-Komponente                             │
//   │  · genRechnungsadresse, sucheAlles                                  │
//   └─────────────────────────────────────────────────────────────────────┘
//
//   ┌─ 4. UI-BAUSTEINE (später ausgelagert in eigene Dateien) ────────────┐
//   │  · Toggle, Inp, CopyBtn, Avatar                                     │
//   │  · RolleBadge                                                       │
//   │  · KontaktPicker, WechselModal, PersonCard                          │
//   │  · FieldRow, FieldList, AddFieldModal                               │
//   └─────────────────────────────────────────────────────────────────────┘
//
//   ┌─ 5. LIEGENSCHAFT-MODUL ─────────────────────────────────────────────┐
//   │  · EinheitDetail, EinheitZeile                                      │
//   │  · GebaeudeKarte, KartenList, NeueKarteMenu                         │
//   │  · LiegenschaftAnsicht, buildInitialKarten                          │
//   │  · VEKachel, VEDetail                                               │
//   └─────────────────────────────────────────────────────────────────────┘
//
//   ┌─ 6. NAVIGATION & SUCHE ─────────────────────────────────────────────┐
//   │  · KategorieKacheln, FilterDropdown                                 │
//   │  · SucheFeld, Suchergebnisse                                        │
//   └─────────────────────────────────────────────────────────────────────┘
//
//   ┌─ 7. KONTAKTE-MODUL ─────────────────────────────────────────────────┐
//   │  · KontaktKarte, KontakteScreen                                     │
//   │  · NeuerKontaktModal                                                │
//   └─────────────────────────────────────────────────────────────────────┘
//
//   ┌─ 8. EINSTELLUNGEN ──────────────────────────────────────────────────┐
//   │  · EinstellKarte, EinstellZeile                                     │
//   │  · FarbPicker                                                       │
//   │  · Sektionen: Profil, Erscheinung, Header, Filter, Dashboard,       │
//   │    Suche, HV, Daten                                                 │
//   │  · EinstellungenZentrale                                            │
//   └─────────────────────────────────────────────────────────────────────┘
//
//   ┌─ 9. APP (Default Export) ───────────────────────────────────────────┐
//   │  · Top-Level-Zustand, Routing, Header-Leiste                        │
//   │  · Screen-Dispatch (home/objekte/liegenschaft/kontakte/einstellung) │
//   └─────────────────────────────────────────────────────────────────────┘
//
// ─────────────────────────────────────────────────────────────────────────────
// CODE-KONVENTIONEN  (durchgängig eingehalten)
// ─────────────────────────────────────────────────────────────────────────────
//   1. Kein optional chaining (?.) – immer (x && x.y) oder (x || {}).y
//   2. Keine IIFEs in JSX – alles als Top-Level-Komponente
//   3. Keine Hooks in verschachtelten Funktionen – jede Hook-tragende
//      Komponente ist Top-Level
//   4. Datenmodell-Versions-Tag: erhöhen, sobald sich das Schema ändert
//
// ─────────────────────────────────────────────────────────────────────────────
// ROADMAP — was als nächstes kommt
// ─────────────────────────────────────────────────────────────────────────────
//   Phase 1 (jetzt):     diese Datei — Kontakte + Liegenschaft funktional
//   Phase 2 (nächstes):  Modell-A-Erweiterungen
//                        · Eigentümer-/Mieter-Historie mit bis-Datum
//                        · Firmen-Mitarbeiter als eigene Kontakt-Personen
//                        · Felder vereinheitlichen (tels[] / emails[])
//   Phase 3:             Bausteine in eigene Files auslagern
//   Phase 4:             ETV, Technik, Verträge, Dokumente
//   Phase 5:             Excel-Import (AllesDaVorlage.xlsx) als Daten-Quelle
//
// ═════════════════════════════════════════════════════════════════════════════

import {
  ACCENT, APP_VERSION, DARK, DEFAULT_GEWERKE_LISTE, DEFAULT_KATEGORIEN, DEFAULT_LEISTUNGEN, DEFAULT_ROLLEN, DEFAULT_VERWENDUNGEN, FIRMEN_FARBE, FONT, FONT_URL, FS, FW, KONTAKTE_FARBE, LIGHT, PALETTE_FARBEN, RAD, SERIOES_GRAU, SLOT_TO_ECK, effColor, effKuerzel, feldInput, feldLabel, formatKontaktName, getContrastColor, kategorieVon, mischeRichtungGrau, rolleBadgeSichtbar, rolleEckPosition, rolleEckSichtbar, setFarbIntensitaet, sortKontakte, toGrau, verwendungBadgeSichtbar, verwendungEckPosition, verwendungEckSichtbar
} from "./constants.js";
import {
  datumDe, isoHeute, istDatumGueltig, istEmailGueltig, istIbanGueltig,
  istPlzGueltig, istSteuerNrGueltig, istTelefonGueltig, istUrlGueltig,
  joinPlzOrt, matchScore, parseDatumWert, splitPlzOrt, zuIsoDatum
} from "./utils-basis.js";

import {
  migriereKontaktZuweisungen,
  ANLEGE_FELDTYPEN,
  BELEGUNG_LABEL,
  BELEGUNG_VERWENDUNGEN,
  BEWOHNER_RECHTE,
  DEFAULT_KONTAKTE,
  DEFAULT_SETTINGS,
  DEFAULT_VES,
  EIG_STATUS,
  FIELD_TYPES,
  KONTAKTARTEN_KATEGORIEN,
  RAUM_ART_OPTIONEN,
  SUGGESTIONS,
  VERWALTUNGSARTEN,
  VS_BASEN,
  ZAEHLER_ARTEN,
  abgeleiteterBelegungstyp,
  aktiveBelegung,
  aktiverHaushalt,
  aktiverTeil,
  ausgehendeBefugnisse,
  belegPhaseZuStatus,
  belegungsPhase,
  belegungsTyp,
  belegungsVerwendungen,
  bewohnerMitKontakt,
  bewohnerRecht,
  brecheSevWechselAb,
  buildKontaktarten,
  effVerteilerschluessel,
  eigStatus,
  extractNachname,
  flaecheVon,
  haushaltKopfzahl,
  heuteLaufendeBelegung,
  isStellplatzTyp,
  istAnonymesMitglied,
  istVermietet,
  istVertragspartei,
  kontaktInGruppe,
  kontaktPasstZuArt,
  laufenderEigWechsel,
  laufenderSevWechsel,
  leererHaushalt,
  neueBelegung,
  neuerRaum,
  neuerTeil,
  neuerZaehler,
  neuesHhMitglied,
  normalisiereKontakte,
  normalisiereVes,
  objektInGruppe,
  objektOrt,
  parseFlaeche,
  sevStatus,
  starteSevWechsel,
  summeRaumFlaechen,
  teileVon,
  verwendungenVon,
  vsBasisLabel,
  vsIstManuell,
  vsWertVon,
  wendeKontaktZuweisungenAn,
  wendeKontaktZuweisungenAnAlle,
  zaehlerArtLabel
} from "./datenmodell.js";


import {
  AvatarIconsContext,
  DESKTOP_MIN_WIDTH,
  EinheitAnzeigeContext,
  EinheitOffenContext,
  FirmenRollenContext,
  HEADER_FILTER_LEER,
  HV_ADRESSE,
  HandlungsbedarfContext,
  I,
  KartenBadgesContext,
  KategorienContext,
  KontaktAnzeigeContext,
  KontaktFarbeContext,
  KontakteContext,
  LeistungenContext,
  LoeschenErlaubtContext,
  ObjektTabsContext,
  RechnungsadresseContext,
  RollenContext,
  SIDEBAR_MAX_WIDTH,
  SIDEBAR_MIN_WIDTH,
  STORAGE_SCHEMA_VERSION,
  SortierPfeile,
  StatusLeisteContext,
  StickySectionHeader,
  TerminBezeichnungenContext,
  VerwendungenContext,
  ZeitPickerContext,
  ZurueckButton,
  ableiteStatusVonBis,
  belegungsRollenFuerKontakt,
  eingehendeVertretungen,
  exportiereJSON,
  feldWertGueltig,
  filterEintragConf,
  filtereKontakteNachHeaderFilter,
  findScrollParent,
  flacheZuweisungen,
  formatNameMitCtx,
  genRechnungsadresse,
  haltePositionUeberUpdate,
  headerFilterIstAktiv,
  importiereJSON,
  kontaktAllesGueltig,
  migriereZuweisungen,
  schemaWarnung,
  scrollToCard,
  sidebarModus,
  stabilisiereScroll,
  storage,
  sucheAlles,
  useAlleKontakte,
  useAvatarIcons,
  useCardWidth,
  useEinheitAnzeige,
  useEinheitOffen,
  useFirmenRollen,
  useHandlungsbedarf,
  useKartenBadges,
  useKategorien,
  useKontaktAnzeige,
  useKontaktFarbe,
  useLeistungen,
  useLoeschenErlaubt,
  useMasterDetailLayout,
  useObjektTabs,
  useOutsideClick,
  useRechnungsadresseAn,
  useRollen,
  useStatusLeiste,
  useTerminBezeichnungen,
  useVerwendungen,
  useWindowWidth,
  useZeitPicker,
  veKartenFeldWert,
  vePasstHeaderFilter,
  zuweisungenFuerAvatar
} from "./utils-icons.jsx";


import {
  AddFieldModal,
  Avatar,
  BelegungswechselVorgang,
  CopyBtn,
  DATUM_MONATE_KURZ,
  DatumFeld,
  DatumKalender,
  EckPille,
  EigentumBlock,
  EigentumHistorie,
  EigentumswechselVorgang,
  FeldKontaktKarte,
  FieldList,
  FieldRow,
  Inp,
  KontaktPicker,
  LEGIONELLEN_BEFUNDE,
  LEGIONELLEN_STATUS_FARBE,
  MonatJahrPickerModal,
  PersonCard,
  RolleBadge,
  SegmentControl,
  Tip,
  TipProvider,
  Toggle,
  VerwendungBadge,
  VerwendungenBadges,
  ZeitFeld,
  ZeitWahl,
  aggregiereObjektVerwendungen,
  datumAnzeige,
  legionellenAnsprechpartner,
  legionellenBefund,
  legionellenFaelligStatus,
  legionellenFindeEinheit,
  legionellenFindeRaum,
  legionellenNaechste,
  legionellenStandorte,
  objektHatZentralesWarmwasser,
  parseAnteile,
  tageImMonat,
  wjEndeDatum
} from "./components.jsx";
// Kalender/Termine — ausgelagert nach kalender.jsx (zyklischer Import: kalender
// holt seinerseits S5-Kern-Helfer aus dieser Datei zurück; Laufzeit-Auflösung).
import {
  AUTO_BETEILIGTE_REGELN, KALENDER_TYPEN, KAL_FENSTER_MONATE, KAL_ZOOM_STUFEN,
  KalenderPanel, KalenderScreen, isoKW, restzeitText, sammleTermine, terminEinheitIds
} from "./kalender.jsx";
// Objekt-Übersicht/-Detail — ausgelagert nach objektansicht.jsx (zyklischer
// Import: holt seinerseits Ansicht-Komponenten aus dieser Datei zurück).
import {
  FeldEinheitKarte, FeldEinheitenSammelKarte, FeldObjektKarte, FilterButtons,
  HANDLUNGSBEDARF_QUELLEN, STAT_WOHN_TYPEN, StatBalkenZeile, StatKpi, StatPanel,
  StatusLeiste, VEDetail, VEKachel, VEListenZeile, alleEinheitenVonVe,
  berechneKontaktStatus, hbQuelleAktiv, hbVorlauf
} from "./objektansicht.jsx";
// Kontakt-Kategorien — ausgelagert nach kontakte.jsx (zyklischer Import).
import { VEKontakteTab, objektBezugInfo } from "./kontakte.jsx";
// Universalsuche — ausgelagert nach suche.jsx (Ausbau geplant).
import { SucheFeld, Suchergebnisse } from "./suche.jsx";

// ║ SEKTION 5 · LIEGENSCHAFT-MODUL                                          ║
// ║ EinheitDetail · EinheitZeile · GebaeudeKarte · KartenList ·             ║
// ║ NeueKarteMenu · LiegenschaftAnsicht · buildInitialKarten ·              ║
// ║ VEKachel · VEDetail                                                     ║
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
        <div key={karte.id} id={"vwkarte-" + karte.id}
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

// ╔═════════════════════════════════════════════════════════════════════════╗
// ║ SEKTION 7 · KONTAKTE-MODUL                                              ║
// ║ KontaktKarte · KontaktDetailKarte · RolleZeile · RolleEditor ·          ║
// ║ KontakteScreen · NeuerKontaktModal                                      ║
// ╚═════════════════════════════════════════════════════════════════════════╝

// ── RolleZeile (eine Zuweisung in der Liste, mit Edit/Löschen im Edit-Modus) ─
// typ = "person" oder "firma" — bestimmt, aus welcher Rollen-Liste der Lookup
// ── RolleDetailBox: aufklappbares Detail einer einzelnen Rollen-Zuweisung ───
// Zeigt alles was zu DIESER Zuweisung gespeichert ist: Einheit-Daten, Datum,
// Eigentümer-/Mieter-Flags, Vorsitz beim Beirat, Gewerk bei Firmen etc.
function RolleDetailBox({ z, ves, kontakte, t, accent, typ = "person", embedded = false, onVEClick = null, aktuellesObjektId = null }) {
  const ve = z.objektId ? (ves || []).find(v => v.id === z.objektId) : null;
  const einheit = (ve && z.einheitId) ? ve.einheiten.find(e => e.id === z.einheitId) : null;
  const firma = z.firmaId ? (kontakte || []).find(k => k.id === z.firmaId) : null;
  // Datum/Flags aus der Einheit holen (falls relevant für die Rolle)
  let von = "", bis = "", grundbuch = null, selbstnutzer = null;
  if (einheit && z.kontaktId !== undefined) {
    // Wenn wir den Kontakt finden, nehmen wir seine Daten aus der Einheit
    // (RolleZeile wird mit z gerufen, das den Kontakt-Bezug nicht direkt hat —
    // aber objektId+einheitId+rolle reichen meistens, plus kontaktId von außen)
  }
  // Eigentümer/Mieter-Daten aus der Einheit ziehen (Match über Rolle + Position)
  if (einheit && z.rolle === "Eigentümer" && z.kontaktId) {
    const e = (einheit.eigentuemer||[]).find(x => x.kontaktId === z.kontaktId);
    if (e) { von = e.von || ""; grundbuch = e.grundbuch; selbstnutzer = e.selbstnutzer; }
  } else if (einheit && z.rolle === "Mieter" && z.kontaktId) {
    const m = (einheit.mieter||[]).find(x => x.kontaktId === z.kontaktId);
    if (m) { von = m.von || ""; bis = m.bis || ""; }
  }

  const labelStyle = { fontSize: FS.xs, fontWeight: FW.bold, color: t.sub,
    textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 3 };
  const wertStyle = { fontSize: FS.l, color: t.text, fontWeight: FW.medium };
  const sectionStyle = { background: t.surface, border: `1px solid ${t.border}`,
    borderRadius: RAD.ms, padding: "10px 12px", marginBottom: 8 };

  const felder = [];
  // Objekt-Info
  if (ve) {
    felder.push({ label: "Objekt", wert: `${ve.nr}` });
    if (ve.adresse) felder.push({ label: "Adresse", wert: ve.adresse });
  }
  // Einheit-Info
  if (einheit) {
    felder.push({ label: "Einheit", wert: einheit.nr });
    if (einheit.lage) felder.push({ label: "Lage", wert: einheit.lage });
    if (einheit.flaeche) felder.push({ label: "Fläche", wert: einheit.flaeche });
    if (einheit.zimmer) felder.push({ label: "Zimmer", wert: einheit.zimmer });
    if (einheit.typ) felder.push({ label: "Typ", wert: einheit.typ });
    if (einheit.mea) felder.push({ label: "MEA", wert: einheit.mea });
    if (einheit.spStellung) felder.push({ label: "Rechtliche Stellung",
      wert: einheit.spStellung === "se_bestandteil" ? "SE-Bestandteil einer Einheit"
        : (einheit.spStellung === "ge_snr" ? "Gemeinschaft + Sondernutzungsrecht"
        : "Eigenständiges Teileigentum") });
  }
  // Firma-Bezug (für Personen die einer Firma zugeordnet sind, z.B. GF einer HV)
  if (firma) {
    felder.push({ label: "Firma", wert: firma.name });
    if (firma.rechtsform) felder.push({ label: "Rechtsform", wert: firma.rechtsform });
  }
  // Status
  felder.push({ label: "Status", wert: z.status || "aktiv" });
  // Datum von/bis
  if (von) felder.push({ label: z.status === "ehemalig" ? "Von" : "Seit", wert: von });
  if (bis) felder.push({ label: "Bis", wert: bis });
  // Flags Eigentümer
  if (grundbuch !== null) felder.push({ label: "Grundbuch", wert: grundbuch ? "Ja" : "Nein" });
  if (selbstnutzer !== null) felder.push({ label: "Selbstnutzer", wert: selbstnutzer ? "Ja" : "Nein" });
  // Vorsitz Beirat
  if (z.vorsitz) felder.push({ label: "Funktion", wert: "Vorsitz" });
  // Gewerk (Firma als Dienstleister)
  if (z.gewerk) felder.push({ label: "Gewerk", wert: z.gewerk });

  return (
    <div style={embedded ? {
      padding: "10px 12px",
    } : {
      background: accent + "0E", border: `1px solid ${accent}40`,
      borderRadius: RAD.ml, padding: "12px 14px" }}>
      <div style={{ display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
        gap: "10px 14px" }}>
        {felder.map((f, i) => (
          <div key={i}>
            <div style={labelStyle}>{f.label}</div>
            <div style={wertStyle}>{f.wert}</div>
          </div>
        ))}
      </div>
      {z.status === "ehemalig" && !von && !bis && (
        <div style={{ fontSize: FS.s, color: t.muted, fontStyle: "italic",
          marginTop: 10 }}>
          Details der ehemaligen Zeit wurden nicht erfasst.
        </div>
      )}
      {ve && onVEClick && String(ve.id) !== String(aktuellesObjektId) && (
        <div style={{ marginTop: 12, display: "flex", justifyContent: "flex-end" }}>
          <button onClick={(e) => { e.stopPropagation(); onVEClick(ve.id); }}
            style={{ fontSize: FS.s, padding: "6px 12px", background: accent + "15", color: accent,
              border: `1px solid ${accent}40`, borderRadius: RAD.sm, cursor: "pointer",
              fontWeight: FW.medium, fontFamily: "inherit", display: "inline-flex",
              alignItems: "center", gap: 5 }}>
            Zum Objekt
          </button>
        </div>
      )}
    </div>
  );
}

// ── AktionsButton: zentraler Baustein für die vier Aktions-Rollen ───────────
// Button-System (SSoT, siehe DESIGN.md §2.6):
//   rolle="bestaetigen" → Akzent (vorwärts).      Icon check.
//   rolle="abbrechen"   → neutral grau (folgenlos). Icon x (grau).
//   rolle="loesen"      → Verbindung lösen.        Icon x (rot) · Confirm AMBER.
//   rolle="loeschen"    → endgültig löschen.       Icon trash (rot) · Confirm ROT.
// Farb-Semantik: Akzent=vorwärts · Grau=folgenlos · Amber=umkehrbar weg · Rot=endgültig weg.
//
// Props:
//   rolle      — eine der vier oben.
//   onClick    — Handler.
//   farbe      — Kontakt-/Akzentfarbe (für getönten Ruhe-Hintergrund). Default: accent unnötig,
//                wenn nicht gesetzt, bleibt der Hintergrund neutral (t.card).
//   confirm    — true = "scharfer" Bestätigungs-Zustand (amber bei loesen, rot bei loeschen).
//   label      — optionaler Text rechts vom Icon (z.B. "Wirklich löschen?"). Macht den Button breiter.
//   disabled   — für bestaetigen (z.B. !dirty).
//   size       — Kantenlänge (Default 36). Icon skaliert mit.
//   title      — Tooltip.
const AKTION_FARBEN = {
  bestaetigen: { icon: "check", iconFarbe: "akzent" },
  abbrechen:   { icon: "x",     iconFarbe: "rot"    },
  loesen:      { icon: "x",     iconFarbe: "rot", confirmBg: "#F59E0B" },
  loeschen:    { icon: "trash", iconFarbe: "rot", confirmBg: "#EF4444" },
};
function AktionsButton({ rolle, onClick, farbe, confirm = false, label = null,
  disabled = false, size = 36, title, t, accent,
  variante = "rund", text = null, icon = true, flex = null }) {
  const def = AKTION_FARBEN[rolle] || AKTION_FARBEN.abbrechen;
  const tint = farbe || accent;
  const istConfirm = confirm && def.confirmBg;

  // ── Variante "breit": Formular-Abschluss-Buttons (Text, volle/flex Breite) ──
  if (variante === "breit") {
    // Bestätigen ist hier VOLL gefüllt (Akzent + Kontrast-Text), nicht nur getönt.
    let bg, border, farbeTxt;
    if (rolle === "bestaetigen") {
      const aktiv = !disabled;
      bg = aktiv ? (tint || accent) : t.muted;
      border = "none";
      farbeTxt = getContrastColor(aktiv ? (tint || accent) : t.muted);
    } else if (rolle === "loeschen") {
      bg = istConfirm ? "#EF4444" : "transparent";
      border = `1px solid ${istConfirm ? "#EF4444" : "#EF444455"}`;
      farbeTxt = istConfirm ? "#FFFFFF" : "#EF4444";
    } else if (rolle === "loesen") {
      bg = istConfirm ? "#F59E0B" : "transparent";
      border = `1px solid ${istConfirm ? "#F59E0B" : t.border}`;
      farbeTxt = istConfirm ? "#FFFFFF" : "#EF4444";
    } else { // abbrechen — neutral
      bg = t.surface;
      border = `1px solid ${t.border}`;
      farbeTxt = t.sub;
    }
    return (
      <button onClick={onClick} disabled={disabled} title={title}
        style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
          flex: flex != null ? flex : undefined,
          background: bg, border, color: farbeTxt,
          borderRadius: RAD.ms, padding: "9px 14px",
          fontFamily: "inherit", fontSize: FS.m, fontWeight: rolle === "bestaetigen" ? 700 : 600,
          cursor: disabled ? "not-allowed" : "pointer",
          opacity: disabled ? 0.6 : 1, transition: "all 0.15s" }}>
        {icon && def.icon && <I name={def.icon} size={13} color={farbeTxt}/>}
        {text && <span>{text}</span>}
      </button>
    );
  }

  // ── Variante "rund" (Default): kompakte Icon-Buttons ────────────────────────
  // Vollton app-weit; Icons in Kontrast (Haken=Kontrast, X/Papierkorb=rot).
  const ruheBg = tint || t.card;
  const ruheBorder = tint || t.border;
  let iconFarbe;
  if (def.iconFarbe === "akzent") iconFarbe = disabled ? t.muted : (tint || accent);
  else if (def.iconFarbe === "grau") iconFarbe = t.sub;
  else iconFarbe = "#EF4444"; // rot (loesen/loeschen Ruhe)
  // Bestätigen: Vollton im Akzent, Kontrast-Icon.
  let bg, border;
  if (istConfirm) { bg = def.confirmBg; border = def.confirmBg; }
  else if (rolle === "bestaetigen") { bg = (tint || accent); border = (tint || accent); }
  else { bg = ruheBg; border = ruheBorder; }
  if (istConfirm) iconFarbe = "#FFFFFF";
  else if (rolle === "bestaetigen") iconFarbe = getContrastColor(tint || accent);
  const iconSize = Math.round(size * 0.39);
  return (
    <button onClick={onClick} disabled={disabled} title={title}
      style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 5,
        height: size, flexShrink: 0,
        width: label ? "auto" : size,
        padding: label ? "0 12px" : 0,
        background: bg, border: `1px solid ${border}`,
        color: iconFarbe,
        borderRadius: RAD.pill, fontFamily: "inherit", fontSize: FS.m, fontWeight: FW.medium,
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: (disabled && rolle !== "bestaetigen") ? 0.5 : 1, transition: "all 0.15s" }}>
      <I name={def.icon} size={iconSize} color={iconFarbe}/>
      {label && <span>{label}</span>}
    </button>
  );
}

// ── ZeilenAktionen: einheitliche, vertikal gestapelte Aktions-Buttons rechts
// neben einer Listen-Karte (Rollen, Objekte, Mitarbeiter). Alle 28px.
// onEdit (Stift, optional), onLoesen (rotes X, neutraler Rahmen),
// onLoeschen (roter Papierkorb mit rotem Rahmen, optional).
// confirmLoesen / confirmLoeschen färben den jeweiligen Button "scharf".
function ZeilenAktionen({ t, onEdit, onLoesen, onLoeschen, confirmLoesen = false, confirmLoeschen = false,
  loesenTitle = "Verknüpfung lösen", loeschenTitle = "Löschen", editTitle = "Bearbeiten" }) {
  const btn = {
    width: 28, height: 28, borderRadius: RAD.sm, padding: 0, cursor: "pointer", flexShrink: 0,
    display: "flex", alignItems: "center", justifyContent: "center", background: t.card,
  };
  return (
    <div style={{ flexShrink: 0, alignSelf: "center", display: "flex", flexDirection: "column", gap: 4 }}>
      {onEdit && (
        <button onClick={(e) => { e.stopPropagation(); onEdit(); }} title={editTitle}
          style={{ ...btn, border: `1px solid ${t.border}` }}>
          <I name="pencil" size={13} color={t.sub}/>
        </button>
      )}
      {onLoeschen && (
        <button onClick={(e) => { e.stopPropagation(); onLoeschen(); }}
          title={confirmLoeschen ? "Nochmal klicken zum endgültigen Löschen (alle Daten)" : loeschenTitle}
          style={{ ...btn, gap: 4,
            width: confirmLoeschen ? "auto" : 28,
            padding: confirmLoeschen ? "0 9px" : 0,
            background: confirmLoeschen ? "#EF4444" : t.card,
            border: `1px solid ${confirmLoeschen ? "#EF4444" : "#EF444455"}`,
            fontSize: FS.xs, fontWeight: FW.medium, fontFamily: "inherit",
            color: "#FFFFFF" }}>
          <I name="trash" size={13} color={confirmLoeschen ? "#FFFFFF" : "#EF4444"}/>
          {confirmLoeschen && "Löschen?"}
        </button>
      )}
      {onLoesen && (
        <button onClick={(e) => { e.stopPropagation(); onLoesen(); }}
          title={confirmLoesen ? "Nochmal klicken zum Lösen" : loesenTitle}
          style={{ ...btn, gap: 4,
            width: confirmLoesen ? "auto" : 28,
            padding: confirmLoesen ? "0 9px" : 0,
            background: confirmLoesen ? "#F59E0B" : t.card,
            border: `1px solid ${confirmLoesen ? "#F59E0B" : t.border}`,
            fontSize: FS.xs, fontWeight: FW.medium, fontFamily: "inherit",
            color: confirmLoesen ? "#FFFFFF" : "#EF4444" }}>
          <I name="x" size={13} color={confirmLoesen ? "#FFFFFF" : "#EF4444"}/>
          {confirmLoesen && "Lösen?"}
        </button>
      )}
    </div>
  );
}

function RolleZeile({ z, ves, kontakte, editMode, onEdit, onDelete, t, accent, typ = "person",
  aktiv = false, onClick, id, embedded = false }) {
  const personenRollen = useRollen();
  const firmenRollen = useFirmenRollen();
  const leistungen = useLeistungen();
  // Auflösung: Personen → rollen. Firmen → Objekt-Zuweisung = Leistung
  // (settings.leistungen), Anstellung/Gewerk = firmenRollen. Da die drei
  // Vokabulare disjunkt sind (siehe DESIGN.md), ist die Kette eindeutig.
  const rolleDef = z.rolle
    ? (typ === "firma"
        ? (leistungen.find(r => r.name === z.rolle) || firmenRollen.find(r => r.name === z.rolle))
        : personenRollen.find(r => r.name === z.rolle))
    : null;
  // Wenn eine Rolle gesetzt, aber unbekannt ist: Eintrag überspringen (defensiv).
  // Wenn keine Rolle gesetzt UND Personen-Eintrag: auch überspringen (Rolle ist
  // dort Pflicht). Bei Firmen ohne Rolle: weiterrendern mit Fallback-Def.
  if (z.rolle && !rolleDef) return null;
  if (!z.rolle && typ !== "firma") return null;
  // Fallback-Def für Firmen-Einträge ohne Rolle (einmaliger Auftrag)
  const def = rolleDef || { name: "Auftrag", kuerzel: "AT", color: t.muted };

  const status = z.status || "aktiv";
  const ve = z.objektId ? (ves || []).find(v => v.id === z.objektId) : null;
  const einheit = (ve && z.einheitId) ? ve.einheiten.find(e => e.id === z.einheitId) : null;
  const firma = z.firmaId ? (kontakte || []).find(k => k.id === z.firmaId) : null;
  // Personen-/Firmen-Vertretung: Ziel ist ein anderer Kontakt (zielKontaktId).
  const zielKontakt = z.zielKontaktId != null ? (kontakte || []).find(k => String(k.id) === String(z.zielKontaktId)) : null;

  // Bezug-Zeile 1: WEG-Nr + Einheit, oder Firmenname, oder Ziel-Kontakt
  let bezugZeile = "—";
  if (zielKontakt) bezugZeile = (zielKontakt.name || ((zielKontakt.vorname || "") + " " + (zielKontakt.nachname || "")).trim() || "—");
  else if (ve)         bezugZeile = ve.nr + (einheit ? " · " + einheit.nr : "");
  else if (firma) bezugZeile = firma.name;

  // Bezug-Zeile 2: Adresse vom Objekt (Straße ohne PLZ) für Kontext;
  // bei Kontakt-Ziel: Hinweis auf die Art des Bezugs.
  let adrZeile = "\u00A0";
  if (ve) {
    const teile = (ve.adresse || "").split(",").map(s => s.trim());
    adrZeile = teile[0] || "\u00A0";
  } else if (zielKontakt) {
    adrZeile = zielKontakt.typ === "firma" ? "Firma" : "Person";
  }

  // Status-Pille rechts oben
  const statusFarbe = status === "aktiv" ? "#22C55E"
                    : status === "werdend" ? "#F59E0B"
                    : "#94A3B8";
  const miniBtn = {
    background: "none", border: `1px solid ${t.border}`, borderRadius: RAD.sm,
    width: 24, height: 24, cursor: "pointer", padding: 0, flexShrink: 0,
    display: "flex", alignItems: "center", justifyContent: "center",
  };

  return (
    <div onClick={onClick} id={id} style={{
      display: "flex", alignItems: "center", gap: 12,
      padding: "10px 12px", boxSizing: "border-box",
      background: embedded ? "transparent" : t.card,
      border: embedded ? "none" : `1px solid ${aktiv ? def.color : t.border}`,
      borderRadius: embedded ? 0 : 12,
      cursor: onClick ? "pointer" : "default",
      transition: "all 0.15s",
      scrollMarginTop: "var(--ad-header-h, 200px)" }}
      onMouseEnter={e => { if (onClick && !aktiv && !embedded) e.currentTarget.style.borderColor = def.color + "80"; }}
      onMouseLeave={e => { if (onClick && !aktiv && !embedded) e.currentTarget.style.borderColor = t.border; }}>
      {/* Links: Rollen-Badge im 48px-Wrapper analog zu Avatar bei Kontaktkarte */}
      <div style={{ width: 48, flexShrink: 0, display: "flex",
        alignItems: "center", justifyContent: "center" }}>
        {typ === "firma" ? (
          <Tip text={def.name + (status !== "aktiv" ? ` (${status})` : "")}>
            <div style={{ width: 38, height: 38, borderRadius: RAD.md,
              background: status === "aktiv" ? def.color : "transparent",
              border: status === "aktiv" ? "none" : `1.5px ${status === "werdend" ? "dashed" : "solid"} ${def.color}`,
              display: "flex", alignItems: "center", justifyContent: "center",
              opacity: status === "ehemalig" ? 0.6 : 1 }}>
              <span style={{ fontSize: FS.l, fontWeight: FW.heavy,
                color: status === "aktiv" ? getContrastColor(def.color) : def.color }}>{def.kuerzel}</span>
            </div>
          </Tip>
        ) : (
          <RolleBadge rolle={z.rolle} size={36} status={status} vorsitz={z.vorsitz}/>
        )}
      </div>
      {/* Mitte: Rolle (groß, farbig) + Bezug + Adresse */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: FS.l, fontWeight: FW.heavy, color: def.color,
          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {def.name}{z.vorsitz && def.name === "Verwaltungsbeirat" ? " · Vorsitz" : ""}
        </div>
        {zielKontakt ? (
          <>
            <div style={{ fontSize: FS.s, color: t.sub, marginTop: 1,
              overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {"für " + (zielKontakt.typ === "firma" ? "Firma" : "Person")}
            </div>
            <div style={{ fontSize: FS.s, color: t.sub,
              overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{bezugZeile}</div>
          </>
        ) : (
          <>
            <div style={{ fontSize: FS.s, color: t.sub, marginTop: 1,
              overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{bezugZeile}</div>
            <div style={{ fontSize: FS.s, color: t.sub,
              overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{adrZeile}</div>
          </>
        )}
      </div>
      {/* Rechts: nur Status-Pille — Aktions-Buttons liegen außerhalb der Karte */}
      <div style={{ display: "flex", alignItems: "center", gap: 4, flexShrink: 0 }}>
        <span style={{ fontSize: FS.xxs, padding: "3px 8px", borderRadius: RAD.ml,
          background: statusFarbe + "22", color: statusFarbe, fontWeight: FW.bold,
          letterSpacing: "0.02em" }}>{status}</span>
      </div>
    </div>
  );
}

// Rollen, deren Bezug wahlweise ein Objekt ODER eine Person/Firma sein kann.
// Bei diesen erscheint im Editor ein Objekt/Person-Umschalter; sonst nur Objekt.
const ROLLEN_MIT_PERSONENBEZUG = ["Bevollmächtigter", "Betreuer"];

// ── ObjektPicker — durchsuchbare Objektauswahl ──────────────────────────────
// Bei wenigen Objekten (≤ SCHWELLE) ein einfaches Dropdown; bei vielen ein
// aufklappbares Feld mit Suchfeld (analog KontaktPicker, aber ohne Neu-Anlegen).
// value = objektId (string) | "", onChange(id).
function ObjektPicker({ value, onChange, objekte = [], t, accent = ACCENT, placeholder = "Objekt wählen…" }) {
  const SCHWELLE = 10;
  const [offen, setOffen] = useState(false);
  const [suche, setSuche] = useState("");
  const gewaehlt = (objekte || []).find(v => String(v.id) === String(value));

  const inputStyle = feldInput(t);

  // Wenige Objekte → klassisches Dropdown.
  if ((objekte || []).length <= SCHWELLE) {
    return (
      <select value={value || ""} onChange={e => onChange(e.target.value)} style={inputStyle}>
        <option value="">{placeholder}</option>
        {objekte.map(v => <option key={v.id} value={v.id}>{v.nr} · {v.adresse}</option>)}
      </select>
    );
  }

  const q = suche.trim().toLowerCase();
  const treffer = q
    ? objekte.filter(v => ((v.nr || "") + " " + (v.adresse || "")).toLowerCase().includes(q))
    : objekte;

  return (
    <div style={{ position: "relative" }}>
      <button onClick={() => setOffen(o => !o)} type="button"
        style={{ ...inputStyle, textAlign: "left", cursor: "pointer", display: "flex",
          alignItems: "center", gap: 6, color: gewaehlt ? t.text : t.muted }}>
        <I name="building" size={13} color={gewaehlt ? accent : t.muted}/>
        <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {gewaehlt ? `${gewaehlt.nr} · ${gewaehlt.adresse}` : placeholder}
        </span>
        <I name="chevD" size={12} color={t.muted}/>
      </button>
      {offen && (
        <div style={{ marginTop: 4, border: `1px solid ${t.border}`, borderRadius: RAD.sm,
          background: t.surface, overflow: "hidden" }}>
          <input autoFocus value={suche} onChange={e => setSuche(e.target.value)}
            placeholder="Suchen (Nr. oder Adresse)…"
            style={{ width: "100%", boxSizing: "border-box", background: t.bg,
              border: "none", borderBottom: `1px solid ${t.border}`, padding: "8px 10px",
              fontSize: 16, color: t.text, outline: "none", fontFamily: "inherit" }}/>
          <div style={{ maxHeight: 220, overflowY: "auto" }}>
            {treffer.length === 0 ? (
              <div style={{ fontSize: FS.s, color: t.muted, fontStyle: "italic", padding: "10px" }}>
                Kein Objekt gefunden
              </div>
            ) : treffer.map(v => (
              <button key={v.id} type="button"
                onClick={() => { onChange(v.id); setOffen(false); setSuche(""); }}
                style={{ width: "100%", textAlign: "left", display: "block",
                  background: String(v.id) === String(value) ? accent + "18" : "transparent",
                  border: "none", borderBottom: `1px solid ${t.border}40`, cursor: "pointer",
                  padding: "8px 10px", fontFamily: "inherit", color: t.text }}>
                <div style={{ fontSize: FS.s, fontWeight: FW.medium }}>{v.nr}</div>
                <div style={{ fontSize: FS.xs, color: t.sub }}>{v.adresse}</div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── BeziehungEditor (1c-3): EIN Editor mit Wegweiser-Dropdown ───────────────
// Ersetzt RolleEditor + ObjektZuweisungEditor. Erster Schritt: Art der Beziehung
//   · besitz        → Rolle (ve/sev) + Objekt + optional Einheit
//   · zustaendigkeit → Leistung (gremium bei Person; Dienstleister bei Firma) + Objekt + optional Einheit
//   · anstellung     → Rolle (firma) + Firma
// Liefert flaches Save-Format { rolle, status, objektId?, einheitId?, firmaId?, vorsitz? },
// das addRolle/updateRolle via klassifiziereZuweisung in die neuen Felder einsortieren.
// Anzeige des fest vorgegebenen Objekts (lockObjektId) im BeziehungEditor.
function LockObjektLabel({ ves = [], lockObjektId, t }) {
  const v = (ves || []).find(x => x.id === lockObjektId);
  return v
    ? <span><strong style={{ color: t.text }}>{v.nr}</strong> · {v.adresse}</span>
    : <span>Dieses Objekt</span>;
}

function BeziehungEditor({ initial = {}, ves = [], kontakte = [], setKontakte = null, onSave, onCancel, t, accent, typ = "person", lockObjektId = null, selbstId = null }) {
  const personenRollen = useRollen();
  const firmenRollen = useFirmenRollen();
  const leistungen = useLeistungen();

  // Art aus initial._quelle ableiten (beim Bearbeiten), sonst Default je Typ.
  const artAusQuelle = initial._quelle === "besitz" ? "besitz"
    : initial._quelle === "zustaendigkeit" ? "zustaendigkeit"
    : initial._quelle === "firmenrolle" ? "anstellung"
    : null;
  const defaultArt = typ === "firma" ? "zustaendigkeit" : "besitz";
  // Art wird primär aus der gewählten Rolle abgeleitet. artFallback dient nur
  // als Zwischenspeicher (z.B. Firma+Zuständigkeit ohne konkrete Rolle).
  const [artFallback, setArtFallback] = useState(artAusQuelle || defaultArt);

  const [rolle, setRolle] = useState(initial.rolle || "");
  // Status wird nicht mehr manuell gewählt, sondern aus Von-Datum + „beabsichtigt"
  // abgeleitet (Eigentümerwechsel: Datum oft noch offen → beabsichtigt=werdend).
  const [von, setVon] = useState(initial.von || "");
  const [beabsichtigt, setBeabsichtigt] = useState(initial.status === "werdend");
  const [vorsitz, setVorsitz] = useState(!!initial.vorsitz);
  const [vertrag, setVertrag] = useState(!!initial.vertrag);
  // Personen-/Firmen-Vertretung (Bevollmächtigter/Betreuer): Bezug wahlweise
  // Objekt ODER Person/Firma. zielKontaktId = der vertretene Kontakt.
  const [zielKontaktId, setZielKontaktId] = useState(initial.zielKontaktId || "");
  const [bezugModus, setBezugModus] = useState((initial.zielKontaktId != null || initial._vollmachtModus) ? "person" : "objekt");
  // Im Objekt-Kontext ist das Objekt durch lockObjektId fixiert (die Person/Firma
  // ist bereits mit diesem Objekt verbunden) — Dropdown entfällt, Wert vorbelegt.
  const [objektId, setObjektId] = useState(initial.objektId || lockObjektId || "");
  // Mehrfachauswahl: WE + zugehöriger Stellplatz etc. (Häkchen-Liste).
  const [einheitIds, setEinheitIds] = useState(initial.einheitId ? [initial.einheitId] : []);
  const [firmaId, setFirmaId] = useState(initial.firmaId || "");

  const aktVe = (ves || []).find(v => v.id === objektId);
  const einheitenAvail = aktVe ? (aktVe.einheiten || []) : [];
  const firmen = (kontakte || []).filter(k => k.typ === "firma");

  // ── Kombiniertes Rollen-Dropdown: Gruppen statt separatem Art-Feld ──────────
  // Die "Art" der Beziehung wird aus der gewählten Rolle (ihrem slot) abgeleitet.
  // Bevollmächtigter/Betreuer sind KEINE Rollen mehr, sondern eine eigene
  // Befugnis (Spec §4) — sie werden ausschließlich über die „Hat Bevollmächtigten"-
  // Sektion gepflegt und tauchen daher nicht im Rollen-Dropdown auf.
  const personenNachSlot = (slots) => personenRollen.filter(r =>
    r.aktiv !== false && slots.indexOf(r.slot) >= 0
    && ROLLEN_MIT_PERSONENBEZUG.indexOf(r.name) < 0);
  // Gruppen je Kontakttyp + Kontext. Anstellung (firma-Slot) nur in der
  // Hauptkarte (kein lockObjektId), da nicht objektbezogen.
  let gruppen;
  if (typ === "firma") {
    gruppen = [
      { art: "zustaendigkeit", label: "Ist zuständig für (Leistung)", rollen: leistungen.filter(r => r.aktiv !== false) },
      { art: "besitz",         label: "Besitzt / nutzt",              rollen: personenNachSlot(["ve", "sev"]) },
    ];
  } else {
    gruppen = [
      { art: "besitz",         label: "Besitzt / nutzt",   rollen: personenNachSlot(["ve", "sev"]) },
      { art: "zustaendigkeit", label: "Funktion am Objekt", rollen: personenNachSlot(["gremium"]) },
    ];
    if (!lockObjektId) {
      gruppen.push({ art: "anstellung", label: "Anstellung (bei Firma)", rollen: personenNachSlot(["firma"]) });
    }
  }
  // Map: Rollenname → Art (für Ableitung beim Speichern / Folgefelder).
  const artVonRolle = {};
  gruppen.forEach(g => g.rollen.forEach(r => { artVonRolle[r.name] = g.art; }));
  // Aktuelle Art aus gewählter Rolle; Fallback auf bisherigen art-State
  // (z.B. Firma+Zuständigkeit ohne Rolle = einmaliger Auftrag).
  const art = rolle ? (artVonRolle[rolle] || (typ === "firma" ? "zustaendigkeit" : "besitz"))
                    : (typ === "firma" ? "zustaendigkeit" : artFallback);
  const def = (typ === "firma" && art === "zustaendigkeit")
    ? leistungen.find(r => r.name === rolle)
    : personenRollen.find(r => r.name === rolle);

  // Rolle wechseln: nicht passende Bezugsfelder zurücksetzen.
  // Fixiertes Objekt (lockObjektId) bleibt erhalten.
  const setRolleClean = (r) => {
    setRolle(r); setVorsitz(false); setVertrag(false);
    const a = artVonRolle[r] || (typ === "firma" ? "zustaendigkeit" : "besitz");
    setArtFallback(a);
    if (a === "anstellung") { setObjektId(lockObjektId || ""); setEinheitIds([]); }
    else { setFirmaId(""); if (!lockObjektId) { /* Objekt bleibt wählbar */ } }
  };

  // Personen-/Firmen-Vertretung aktiv? Nur bei passender Rolle, gewähltem
  // Person-Modus und außerhalb des Objekt-Kontexts (lockObjektId).
  const personVertretungMoeglich = !lockObjektId && ROLLEN_MIT_PERSONENBEZUG.indexOf(rolle) >= 0;
  const personVertretung = !!initial._vollmachtModus && personVertretungMoeglich && bezugModus === "person";

  // ── Funktion am Objekt (Verwaltungsbeirat/Rechnungsprüfer/Ansprechpartner) ──
  // Diese Rollen beziehen sich auf das OBJEKT, nicht auf Einheiten → keine
  // Einheiten-Auswahl. Funktion am Objekt setzt eine Verbindung zum Objekt voraus:
  //  · Verwaltungsbeirat / Rechnungsprüfer → nur Eigentümer
  //  · Ansprechpartner (Objekt)            → Eigentümer ODER Bewohner (Mieter etc.)
  // Wählbar sind nur passende Objekte; bei genau einem → vorausgewählt.
  const istFunktionAmObjekt = typ !== "firma" && art === "zustaendigkeit" && !personVertretung;
  const istAnsprechpartnerObjekt = rolle === "Ansprechpartner (Objekt)";
  const bezugPflicht = istFunktionAmObjekt;
  // Objekt-IDs, in denen selbstId Eigentümer ist (Einheit-Eigentümer, jeder Status).
  const eigentumsObjektIds = (selbstId == null) ? [] : (ves || []).filter(v =>
    (v.einheiten || []).some(e =>
      (e.eigentuemer || []).some(et => String(et.kontaktId) === String(selbstId)))
  ).map(v => v.id);
  // Objekt-IDs, in denen selbstId Bewohner ist (Haushaltsmitglied einer Belegung).
  const bewohnerObjektIds = (selbstId == null) ? [] : (ves || []).filter(v =>
    (v.einheiten || []).some(e =>
      teileVon(e).some(teil =>
        (teil.belegungen || []).some(b =>
          ((b.haushalt && b.haushalt.mitglieder) || []).some(m => String(m.kontaktId) === String(selbstId)))))
  ).map(v => v.id);
  // Welche Objekte stehen im Dropdown?
  const bezugsObjektIds = istAnsprechpartnerObjekt
    ? Array.from(new Set([...eigentumsObjektIds, ...bewohnerObjektIds]))
    : eigentumsObjektIds;
  const waehlbareObjekte = bezugPflicht
    ? (ves || []).filter(v => bezugsObjektIds.indexOf(v.id) >= 0)
    : (ves || []);
  // Rolle gesperrt, wenn bezugspflichtig und kein passendes Objekt vorhanden.
  const rolleGesperrtKeinEigentum = bezugPflicht && bezugsObjektIds.length === 0;

  // Bei „Funktion am Objekt": genau ein wählbares Objekt → automatisch vorwählen.
  useEffect(() => {
    if (!istFunktionAmObjekt || lockObjektId) return;
    if (waehlbareObjekte.length === 1 && objektId !== waehlbareObjekte[0].id) {
      setObjektId(waehlbareObjekte[0].id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rolle, istFunktionAmObjekt]);

  // Validierung je (abgeleiteter) Art.
  const valid =
    rolleGesperrtKeinEigentum ? false :
    personVertretung    ? (rolle && zielKontaktId) :
    art === "anstellung" ? (rolle && firmaId) :
    art === "besitz"     ? (rolle && objektId) :
    /* zustaendigkeit */   (typ === "firma" ? !!objektId : (rolle && objektId));

  const handleSave = () => {
    if (!valid) return;
    const status = ableiteStatusVonBis(von, initial.bis || "", beabsichtigt);
    const baue = (einheitId) => {
      const eintrag = { status };
      if (rolle) eintrag.rolle = rolle;
      if (von) eintrag.von = von;
      if (personVertretung) {
        eintrag.zielKontaktId = Number(zielKontaktId);
      } else if (art === "anstellung") {
        eintrag.firmaId = Number(firmaId);
      } else if (art === "besitz") {
        eintrag.objektId = objektId;
        eintrag.einheitId = einheitId || null;
      } else { // zustaendigkeit
        eintrag.objektId = objektId;
        eintrag.einheitId = einheitId || null;
        if (rolle === "Verwaltungsbeirat" && vorsitz && status !== "ehemalig") eintrag.vorsitz = true;
        if (typ === "firma" && vertrag && status !== "ehemalig") eintrag.vertrag = true;
      }
      return eintrag;
    };
    // Mehrfachauswahl: je gewählter Einheit ein Eintrag (gleiche Rolle/Datum).
    // Keine Einheit gewählt (oder Anstellung/Vertretung) → ein Eintrag aufs Objekt.
    const brauchtEinheiten = (art === "besitz" || art === "zustaendigkeit") && !personVertretung && einheitIds.length > 0;
    if (brauchtEinheiten) {
      einheitIds.forEach(eid => onSave(baue(eid)));
    } else {
      onSave(baue(null));
    }
  };

  const inputStyle = feldInput(t);
  const abgeleiteterStatus = ableiteStatusVonBis(von, initial.bis || "", beabsichtigt);
  const statusFarbe = abgeleiteterStatus === "werdend" ? "#EAB308"
    : (abgeleiteterStatus === "ehemalig" ? t.muted : "#22C55E");

  return (
    <div style={{ background: accent + "0A", border: `1px dashed ${accent}55`,
      borderRadius: RAD.md, padding: 10, marginTop: 4, marginBottom: 4 }}>
      <div style={{ fontSize: FS.xs, fontWeight: FW.bold, color: t.muted,
        marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.05em" }}>
        {initial.rolle ? "Beziehung bearbeiten" : "Neue Beziehung"}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {/* Rollen-Dropdown. Im Vollmacht-Modus auf Vertretungs-Rollen beschränkt. */}
        {initial._vollmachtModus ? (
          <select value={rolle} onChange={e => setRolleClean(e.target.value)} style={inputStyle}>
            {ROLLEN_MIT_PERSONENBEZUG.map(r => <option key={r} value={r}>{r}</option>)}
          </select>
        ) : (
          <select value={rolle} onChange={e => setRolleClean(e.target.value)} style={inputStyle}>
            <option value="">
              {typ === "firma" ? "— Keine / einmaliger Auftrag" : "Rolle / Funktion wählen…"}
            </option>
            {gruppen.map(g => (
              <optgroup key={g.art} label={g.label}>
                {g.rollen.map(r => <option key={r.name} value={r.name}>{r.name}</option>)}
              </optgroup>
            ))}
          </select>
        )}

        {/* Personen-Bevollmächtigung läuft ausschließlich über die dedizierte
            "Hat Bevollmächtigten"-Sektion (initial._vollmachtModus). Im normalen
            Rollen-Dialog hat "Bevollmächtigter" wieder nur Objekt-Bedeutung. */}

        {/* Bezug: Person/Firma bei Vertretung; sonst Objekt (+Einheit) bzw. Firma bei Anstellung */}
        {personVertretung ? (
          <KontaktPicker value={zielKontaktId ? Number(zielKontaktId) : null}
            onChange={(id) => setZielKontaktId(id != null ? String(id) : "")}
            label="Vertreter / Bevollmächtigten" t={t} accent={accent}
            kontakte={(kontakte || []).filter(c => String(c.id) !== String(selbstId))}
            setKontakte={setKontakte}/>
        ) : art === "anstellung" ? (
          <select value={firmaId} onChange={e => setFirmaId(e.target.value)} style={inputStyle}>
            <option value="">Firma wählen…</option>
            {firmen.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
          </select>
        ) : (
          <>
            {lockObjektId ? (
              <div style={{ fontSize: FS.m, color: t.sub, padding: "8px 2px",
                display: "flex", alignItems: "center", gap: 6 }}>
                <I name="building" size={13} color={t.muted}/>
                <LockObjektLabel ves={ves} lockObjektId={lockObjektId} t={t}/>
              </div>
            ) : rolleGesperrtKeinEigentum ? (
              <div style={{ fontSize: FS.s, color: t.muted, fontStyle: "italic",
                padding: "8px 10px", border: `1px dashed ${t.border}`, borderRadius: RAD.sm }}>
                {istAnsprechpartnerObjekt
                  ? "Diese Funktion setzt voraus, dass die Person Eigentümer oder Bewohner eines Objekts ist. Hier ist beides nicht hinterlegt."
                  : "Diese Funktion kann nur an einen Eigentümer vergeben werden. Diese Person ist in keinem Objekt als Eigentümer hinterlegt."}
              </div>
            ) : (
              <ObjektPicker value={objektId}
                onChange={(id) => { setObjektId(id); setEinheitIds([]); }}
                objekte={waehlbareObjekte} t={t} accent={accent}
                placeholder={bezugPflicht && !istAnsprechpartnerObjekt ? "Eigentums-Objekt wählen…" : "Objekt wählen…"}/>
            )}
            {!istFunktionAmObjekt && objektId && einheitenAvail.length > 0 && (
              <div style={{ border: `1px solid ${t.border}`, borderRadius: RAD.sm,
                padding: "4px 0", maxHeight: 200, overflowY: "auto" }}>
                <div style={{ fontSize: FS.xs, color: t.muted, padding: "2px 10px 4px" }}>
                  {art === "besitz" ? "Einheit(en) — Mehrfachauswahl" : "Einheit(en) (optional, sonst ganzes Objekt)"}
                </div>
                {einheitenAvail.map(e => {
                  const checked = einheitIds.indexOf(e.id) >= 0;
                  return (
                    <label key={e.id} style={{ display: "flex", alignItems: "center", gap: 8,
                      padding: "6px 10px", cursor: "pointer", fontSize: FS.s, color: t.text }}>
                      <input type="checkbox" checked={checked}
                        onChange={() => setEinheitIds(v => checked ? v.filter(x => x !== e.id) : [...v, e.id])}
                        style={{ width: 16, height: 16, accentColor: accent, flexShrink: 0 }}/>
                      <span style={{ fontWeight: FW.medium }}>{(e.nr || e.bez || e.id)}</span>
                      <span style={{ color: t.sub }}>· {e.typ}</span>
                    </label>
                  );
                })}
              </div>
            )}
          </>
        )}

        {/* Datum statt manueller Status-Wahl. Status leitet sich ab:
            beabsichtigt → werdend · Von in Zukunft → werdend · sonst aktiv.
            Das „Beabsichtigt"-Häkchen ist nur bei Besitz-Rollen (Eigentümer/Mieter/
            Nießbraucher/Wohnberechtigter) relevant — dort ist der Wechsel oft noch
            schwebend (Grundbuch). Bei Vollmacht/Betreuung/Funktion am Objekt entfällt es. */}
        {(rolle || (art === "zustaendigkeit" && typ === "firma")) && (
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <DatumFeld value={von} onChange={setVon} t={t} accent={accent}
              label="Beginn / ab" required={false} defaultHeute={false}/>
            {(rolle === "Eigentümer" || rolle === "Mieter") && (
              <label style={{ display: "flex", alignItems: "center", gap: 6,
                fontSize: FS.s, color: t.sub, cursor: "pointer" }}>
                <input type="checkbox" checked={beabsichtigt}
                  onChange={e => setBeabsichtigt(e.target.checked)}
                  style={{ width: 16, height: 16, accentColor: accent }}/>
                Beabsichtigt / Datum noch offen (z. B. Eigentümerwechsel im Grundbuch)
              </label>
            )}
            <div style={{ fontSize: FS.xs, color: t.sub, display: "flex", alignItems: "center", gap: 6 }}>
              Status:
              <span style={{ color: statusFarbe, fontWeight: FW.bold }}>{abgeleiteterStatus}</span>
            </div>
          </div>
        )}

        {/* Vorsitz nur bei Verwaltungsbeirat */}
        {art === "zustaendigkeit" && rolle === "Verwaltungsbeirat" && abgeleiteterStatus !== "ehemalig" && (
          <label style={{ display: "flex", alignItems: "center", gap: 6,
            fontSize: FS.s, color: t.sub, cursor: "pointer" }}>
            <input type="checkbox" checked={vorsitz} onChange={e => setVorsitz(e.target.checked)}/>
            Vorsitz (VBV)
          </label>
        )}

        {/* Vertrag nur bei Firmen-Zuständigkeit — goldener Ring markiert die
            beauftragte Firma (z. B. die mit dem Wartungsvertrag). */}
        {art === "zustaendigkeit" && typ === "firma" && rolle && abgeleiteterStatus !== "ehemalig" && (
          <label style={{ display: "flex", alignItems: "center", gap: 6,
            fontSize: FS.s, color: t.sub, cursor: "pointer" }}>
            <input type="checkbox" checked={vertrag} onChange={e => setVertrag(e.target.checked)}/>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
              mit Vertrag
              <span style={{ width: 9, height: 9, borderRadius: RAD.full, background: "#EAB308",
                boxShadow: "0 0 4px 1px #EAB30899", display: "inline-block" }}/>
            </span>
          </label>
        )}

        <div style={{ display: "flex", gap: 6, justifyContent: "flex-end", marginTop: 4 }}>
          <AktionsButton variante="breit" rolle="abbrechen" onClick={onCancel}
            text="Abbrechen" icon={false} t={t} accent={accent}/>
          <AktionsButton variante="breit" rolle="bestaetigen" disabled={!valid} onClick={handleSave}
            text={initial.rolle ? "Übernehmen" : "Hinzufügen"} icon={false} t={t} accent={accent}/>
        </div>
      </div>
    </div>
  );
}


// ── StammdatenEditor (Name, Anrede, Tels, Emails, Adresse) ──────────────────
function StammdatenEditor({ edit, setEdit, t, accent }) {
  const inputStyle = feldInput(t, { padding: "7px 10px" });
  // Eingabe-Style mit rotem Rahmen, wenn der Wert ungültig ist.
  const inputUngueltig = { ...inputStyle, border: `1px solid #EF4444` };
  const miniBtn = {
    background: "none", border: `1px solid ${t.border}`, borderRadius: RAD.sm,
    width: 22, height: 22, cursor: "pointer", padding: 0, flexShrink: 0,
    display: "flex", alignItems: "center", justifyContent: "center",
  };
  const addBtn = {
    fontSize: FS.xs, padding: "3px 8px", background: accent + "15",
    color: accent, border: "none", borderRadius: RAD.sm, cursor: "pointer",
    fontWeight: FW.medium, fontFamily: "inherit", alignSelf: "flex-start",
  };

  const ANREDEN = ["", "Herr", "Frau", "Familie", "Firma"];
  const TITEL = ["", "Dr.", "Prof.", "Prof. Dr.", "Dr. Dr.", "Dipl.-Ing.",
    "Dipl.-Kfm.", "Dipl.-Jur.", "Mag.", "RA", "B.A.", "B.Sc.", "M.A.", "M.Sc."];
  const TEL_TYPEN = ["Mobil", "Festnetz", "Geschäftlich"];
  const EMAIL_TYPEN = ["Privat", "Geschäftlich"];

  const tels = edit.tels || [];
  const emails = edit.emails || [];

  const setTel = (i, patch) => setEdit({ ...edit,
    tels: tels.map((t, idx) => idx === i ? { ...t, ...patch } : t) });
  const addTel = () => setEdit({ ...edit, tels: [...tels, { type: "Mobil", nr: "" }] });
  const rmTel  = (i) => setEdit({ ...edit, tels: tels.filter((_, idx) => idx !== i) });

  const setEmail = (i, patch) => setEdit({ ...edit,
    emails: emails.map((e, idx) => idx === i ? { ...e, ...patch } : e) });
  const addEmail = () => setEdit({ ...edit, emails: [...emails, { type: "Privat", email: "" }] });
  const rmEmail  = (i) => setEdit({ ...edit, emails: emails.filter((_, idx) => idx !== i) });

  // Weitergabe-Stern: ★ an einer Angabe bedeutet, dass die Person diese Angabe
  // zur Weitergabe freigegeben hat. Einfacher Toggle pro Eintrag — KEIN Limit.
  // Die Adresse hat EINEN gemeinsamen Stern (adresseFavorit); die alten
  // Einzel-Flags strasseFavorit/plzOrtFavorit zählen im Bestand als freigegeben
  // und werden beim ersten Umschalten ins Sammelflag überführt.
  // Flag-Name `favorit` (tels/emails) bleibt aus Kompatibilität erhalten.
  const adresseFav = !!(edit.adresseFavorit || edit.strasseFavorit || edit.plzOrtFavorit);
  const toggleFav = (kind, i) => {
    let newTels   = tels.map(x => ({ ...x }));
    let newEmails = emails.map(x => ({ ...x }));
    let newAFav   = adresseFav;
    if (kind === "tel")          newTels[i].favorit = !newTels[i].favorit;
    else if (kind === "email")   newEmails[i].favorit = !newEmails[i].favorit;
    else if (kind === "adresse") newAFav = !newAFav;
    setEdit({ ...edit, tels: newTels, emails: newEmails,
      adresseFavorit: newAFav,
      // Alte Einzel-Flags konsolidieren — ab jetzt zählt nur das Sammelflag.
      strasseFavorit: false, plzOrtFavorit: false });
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {/* Anrede + Titel */}
      <div style={{ display: "flex", gap: 4 }}>
        <select value={edit.anrede || ""}
          onChange={e => setEdit({ ...edit, anrede: e.target.value })}
          style={{ ...inputStyle, flex: 1, minWidth: 0 }}>
          {ANREDEN.map(a => <option key={a} value={a}>{a || "Anrede…"}</option>)}
        </select>
        <select value={edit.titel || ""}
          onChange={e => setEdit({ ...edit, titel: e.target.value })}
          style={{ ...inputStyle, flex: 1, minWidth: 0 }}>
          {TITEL.map(tt => <option key={tt} value={tt}>{tt || "Titel…"}</option>)}
        </select>
      </div>
      {/* Name-Zeile */}
      <div style={{ display: "flex", gap: 4 }}>
        <input type="text" placeholder="Vorname" value={edit.vorname || ""}
          onChange={e => setEdit({ ...edit, vorname: e.target.value })}
          style={inputStyle}/>
        <input type="text" placeholder="Nachname" value={edit.nachname || ""}
          onChange={e => setEdit({ ...edit, nachname: e.target.value })}
          style={inputStyle}/>
      </div>

      {/* Telefone */}
      {tels.map((tel, i) => (
        <div key={i} style={{ display: "flex", gap: 4, alignItems: "center" }}>
          <span style={{ fontSize: FS.l, width: 16, textAlign: "center", flexShrink: 0 }}>📞</span>
          <select value={tel.type} onChange={e => setTel(i, { type: e.target.value })}
            style={{ ...inputStyle, width: 105, flexShrink: 0 }}>
            {TEL_TYPEN.map(tp => <option key={tp} value={tp}>{tp}</option>)}
          </select>
          <input type="text" value={tel.nr} placeholder="0151 …"
            onChange={e => setTel(i, { nr: e.target.value })}
            style={istTelefonGueltig(tel.nr) ? inputStyle : inputUngueltig}/>
          <button onClick={() => toggleFav("tel", i)}
            title={tel.favorit ? "Weitergabe-Freigabe aufheben" : "Zur Weitergabe freigeben"}
            style={{ ...miniBtn, color: tel.favorit ? "#F59E0B" : t.muted,
              borderColor: t.border }}>
            <span style={{ fontSize: FS.m, lineHeight: 1, fontWeight: FW.bold }}>{tel.favorit ? "★" : "☆"}</span>
          </button>
          <button onClick={() => rmTel(i)} style={miniBtn} title="Telefon entfernen">
            <I name="x" size={11} color={"#EF4444"}/>
          </button>
        </div>
      ))}
      <button onClick={addTel} style={addBtn}>+ Telefon</button>

      {/* E-Mails */}
      {emails.map((em, i) => (
        <div key={i} style={{ display: "flex", gap: 4, alignItems: "center" }}>
          <span style={{ fontSize: FS.l, width: 16, textAlign: "center", flexShrink: 0 }}>✉</span>
          <select value={em.type} onChange={e => setEmail(i, { type: e.target.value })}
            style={{ ...inputStyle, width: 105, flexShrink: 0 }}>
            {EMAIL_TYPEN.map(tp => <option key={tp} value={tp}>{tp}</option>)}
          </select>
          <input type="email" value={em.email} placeholder="mail@…"
            onChange={e => setEmail(i, { email: e.target.value })}
            style={istEmailGueltig(em.email) ? inputStyle : inputUngueltig}/>
          <button onClick={() => toggleFav("email", i)}
            title={em.favorit ? "Weitergabe-Freigabe aufheben" : "Zur Weitergabe freigeben"}
            style={{ ...miniBtn, color: em.favorit ? "#F59E0B" : t.muted,
              borderColor: t.border }}>
            <span style={{ fontSize: FS.m, lineHeight: 1, fontWeight: FW.bold }}>{em.favorit ? "★" : "☆"}</span>
          </button>
          <button onClick={() => rmEmail(i)} style={miniBtn} title="E-Mail entfernen">
            <I name="x" size={11} color={"#EF4444"}/>
          </button>
        </div>
      ))}
      <button onClick={addEmail} style={addBtn}>+ E-Mail</button>

      {/* Adresse — getrennte Favoriten: Straße + Hausnr. UND PLZ + Ort
          können unabhängig auf der Kontaktkarte angezeigt werden.
          Maximal 2 Favoriten gesamt (Telefone, E-Mails, Adress-Zeilen).
          Default: nichts vorausgewählt — User markiert aktiv. */}
      <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
        <span style={{ fontSize: FS.l, width: 16, textAlign: "center", flexShrink: 0 }}>🏠</span>
        <input type="text" placeholder="Straße + Hausnr." value={edit.strasse || ""}
          onChange={e => setEdit({ ...edit, strasse: e.target.value })} style={inputStyle}/>
        <button onClick={() => toggleFav("adresse", 0)}
          title={adresseFav ? "Weitergabe-Freigabe aufheben" : "Adresse zur Weitergabe freigeben"}
          style={{ ...miniBtn,
            color: adresseFav ? "#F59E0B" : t.muted,
            borderColor: t.border }}>
          <span style={{ fontSize: FS.m, lineHeight: 1, fontWeight: FW.bold }}>
            {adresseFav ? "★" : "☆"}
          </span>
        </button>
      </div>
      <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
        <span style={{ fontSize: FS.l, width: 16, textAlign: "center", flexShrink: 0 }}>📮</span>
        <input type="text" placeholder="PLZ" value={edit.plz || ""}
          onChange={e => setEdit({ ...edit, plz: e.target.value })}
          style={{ ...(istPlzGueltig(edit.plz) ? inputStyle : inputUngueltig), flex: "0 0 72px", minWidth: 0 }}/>
        <input type="text" placeholder="Ort" value={edit.ort || ""}
          onChange={e => setEdit({ ...edit, ort: e.target.value })}
          style={{ ...inputStyle, flex: 1, minWidth: 0 }}/>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
        <span style={{ fontSize: FS.s, color: "#F59E0B", lineHeight: 1 }}>★</span>
        <span style={{ fontSize: FS.xs, color: t.muted }}>
          Mit Stern markierte Angaben sind zur Weitergabe freigegeben.
        </span>
      </div>
    </div>
  );
}

// ── FirmaStammdatenEditor (Firmenname, Rechtsform, Tel, E-Mail, Adresse, Gewerke) ─
// ── GewerkEingabe: Eingabefeld mit Vorschlägen aus den Firmen-Rollen (= Gewerke).
// Tippen filtert die Liste; Klick auf Vorschlag übernimmt ihn (einheitliche
// Schreibweise → später sauber filterbar). Freitext bleibt als Notausgang.
// Die Liste wird unter Einstellungen → Firmen-Rollen gepflegt.
function GewerkEingabe({ value, onChange, t, accent, inputStyle, autoFocus = false }) {
  const [offen, setOffen] = useState(false);
  const firmenRollen = useFirmenRollen();
  const alleGewerke = firmenRollen.filter(r => r && r.aktiv !== false && r.name).map(r => r.name);
  const wert = value || "";
  const q = wert.trim().toLowerCase();
  const vorschlaege = alleGewerke.filter(g => {
    const gl = g.toLowerCase();
    if (q.length === 0) return true;
    return gl.indexOf(q) !== -1 && gl !== q;
  }).slice(0, 50);
  const exakt = alleGewerke.some(g => g.toLowerCase() === q);
  return (
    <div style={{ position: "relative", flex: 1, minWidth: 0 }}>
      <input type="text" value={wert} placeholder="Gewerk – tippen für Vorschläge"
        autoFocus={autoFocus}
        onChange={e => { onChange(e.target.value); setOffen(true); }}
        onFocus={() => setOffen(true)}
        onBlur={() => setTimeout(() => setOffen(false), 150)}
        style={inputStyle}/>
      {offen && vorschlaege.length > 0 && (
        <div style={{ position: "absolute", left: 0, right: 0, top: "calc(100% + 2px)", zIndex: 50,
          background: t.card, border: `1px solid ${t.border}`, borderRadius: RAD.ms,
          boxShadow: "0 6px 20px rgba(0,0,0,0.35)", overflow: "hidden", maxHeight: 300, overflowY: "auto" }}>
          {!exakt && wert.trim().length > 0 && (
            <div style={{ padding: "6px 10px", fontSize: FS.xs, color: t.muted, fontStyle: "italic",
              borderBottom: `1px solid ${t.border}` }}>
              Eigener Eintrag: „{wert.trim()}" – oder Vorschlag wählen:
            </div>
          )}
          {vorschlaege.map(g => (
            <button key={g}
              onMouseDown={(e) => { e.preventDefault(); onChange(g); setOffen(false); }}
              style={{ display: "block", width: "100%", textAlign: "left",
                padding: "7px 10px", background: "none", border: "none", cursor: "pointer",
                fontSize: FS.m, color: t.text, fontFamily: "inherit" }}
              onMouseEnter={e => e.currentTarget.style.background = accent + "15"}
              onMouseLeave={e => e.currentTarget.style.background = "none"}>
              {g}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function FirmaStammdatenEditor({ edit, setEdit, t, accent }) {
  const inputStyle = feldInput(t, { padding: "7px 10px" });
  const miniBtn = {
    background: "none", border: `1px solid ${t.border}`, borderRadius: RAD.sm,
    width: 22, height: 22, cursor: "pointer", padding: 0, flexShrink: 0,
    display: "flex", alignItems: "center", justifyContent: "center",
  };
  const addBtn = {
    fontSize: FS.xs, padding: "3px 8px", background: accent + "15",
    color: accent, border: "none", borderRadius: RAD.sm, cursor: "pointer",
    fontWeight: FW.medium, fontFamily: "inherit", alignSelf: "flex-start",
  };

  const gewerke = edit.gewerke || [];
  const setGewerk = (i, val) => setEdit({ ...edit,
    gewerke: gewerke.map((g, idx) => idx === i ? val : g) });
  const addGewerk = () => setEdit({ ...edit, gewerke: [...gewerke, ""] });
  const rmGewerk  = (i) => setEdit({ ...edit, gewerke: gewerke.filter((_, idx) => idx !== i) });
  const inputUngueltig = { ...inputStyle, border: `1px solid #EF4444` };

  // Wert-Leeren-Button (leert nur den Feldinhalt, entfernt das Feld nicht)
  const ClearBtn = ({ feld, sichtbar }) => (
    sichtbar ? (
      <button onClick={() => setEdit(feld === "plzort"
        ? { ...edit, plz: "", ort: "" }
        : { ...edit, [feld]: "" })} style={miniBtn} title="Eintrag leeren">
        <I name="x" size={11} color={"#EF4444"}/>
      </button>
    ) : <span style={{ width: 22, flexShrink: 0 }}/>
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <input type="text" placeholder="Firmenname" value={edit.name || ""}
        onChange={e => setEdit({ ...edit, name: e.target.value })} style={inputStyle}/>
      <input type="text" placeholder="Rechtsform (GmbH, OHG, e.K. …)" value={edit.rechtsform || ""}
        onChange={e => setEdit({ ...edit, rechtsform: e.target.value })} style={inputStyle}/>
      <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
        <span style={{ fontSize: FS.l, width: 16, textAlign: "center", flexShrink: 0 }}>📞</span>
        <input type="text" value={edit.tel || ""} placeholder="Zentrale Tel."
          onChange={e => setEdit({ ...edit, tel: e.target.value })}
          style={istTelefonGueltig(edit.tel) ? inputStyle : inputUngueltig}/>
        <ClearBtn feld="tel" sichtbar={!!edit.tel}/>
      </div>
      <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
        <span style={{ fontSize: FS.l, width: 16, textAlign: "center", flexShrink: 0 }}>✉</span>
        <input type="email" value={edit.email || ""} placeholder="zentrale@…"
          onChange={e => setEdit({ ...edit, email: e.target.value })}
          style={istEmailGueltig(edit.email) ? inputStyle : inputUngueltig}/>
        <ClearBtn feld="email" sichtbar={!!edit.email}/>
      </div>
      <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
        <span style={{ fontSize: FS.l, width: 16, textAlign: "center", flexShrink: 0 }}>🌐</span>
        <input type="text" value={edit.homepage || ""} placeholder="www.…"
          onChange={e => setEdit({ ...edit, homepage: e.target.value })}
          style={istUrlGueltig(edit.homepage) ? inputStyle : inputUngueltig}/>
        <ClearBtn feld="homepage" sichtbar={!!edit.homepage}/>
      </div>
      <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
        <span style={{ fontSize: FS.l, width: 16, textAlign: "center", flexShrink: 0 }}>🏠</span>
        <input type="text" placeholder="Straße + Hausnr." value={edit.strasse || ""}
          onChange={e => setEdit({ ...edit, strasse: e.target.value })} style={inputStyle}/>
        <ClearBtn feld="strasse" sichtbar={!!edit.strasse}/>
      </div>
      <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
        <span style={{ fontSize: FS.l, width: 16, textAlign: "center", flexShrink: 0 }}>📮</span>
        <input type="text" placeholder="PLZ" value={edit.plz || ""}
          onChange={e => setEdit({ ...edit, plz: e.target.value })}
          style={{ ...(istPlzGueltig(edit.plz) ? inputStyle : inputUngueltig), flex: "0 0 72px", minWidth: 0 }}/>
        <input type="text" placeholder="Ort" value={edit.ort || ""}
          onChange={e => setEdit({ ...edit, ort: e.target.value })}
          style={{ ...inputStyle, flex: 1, minWidth: 0 }}/>
        <ClearBtn feld="plzort" sichtbar={!!(edit.plz || edit.ort)}/>
      </div>
      {/* Gewerke */}
      {gewerke.map((g, i) => (
        <div key={i} style={{ display: "flex", gap: 4, alignItems: "center" }}>
          <span style={{ fontSize: FS.l, width: 16, textAlign: "center", flexShrink: 0 }}>🔧</span>
          <GewerkEingabe value={g} onChange={val => setGewerk(i, val)}
            t={t} accent={accent} inputStyle={inputStyle}/>
          <button onClick={() => rmGewerk(i)} style={miniBtn} title="Gewerk entfernen">
            <I name="x" size={11} color={"#EF4444"}/>
          </button>
        </div>
      ))}
      <button onClick={addGewerk} style={{
        display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
        width: "100%", marginTop: 4, padding: "10px 14px",
        background: accent + "1A", color: accent,
        border: `1.5px dashed ${accent}80`, borderRadius: RAD.ml, cursor: "pointer",
        fontSize: FS.xl, fontWeight: FW.bold, fontFamily: "inherit",
      }}>
        <I name="plus" size={16} color={accent}/> Gewerk hinzufügen
      </button>
    </div>
  );
}

// ── Notizen-Sektion ─────────────────────────────────────────────────────────
// Textarea, die IMMER beschreibbar ist — unabhängig vom Edit-Modus.
// Wenn im Edit-Modus: Änderungen gehen in den edit-State und werden beim
// "Speichern" mitgenommen. Sonst werden sie direkt über onUpdate persistiert.
function NotizenSektion({ wert, onChange, t, accent, embedded = false }) {
  return (
    <div style={embedded ? {} : { marginTop: 10, paddingTop: 10, borderTop: `1px solid ${t.border}40` }}>
      <div style={{ fontSize: FS.s, fontWeight: FW.bold, color: t.sub,
        textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 6 }}>
        Notizen
      </div>
      <textarea
        value={wert || ""}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Notizen, Anmerkungen, Erinnerungen…"
        rows={3}
        style={{
          width: "100%", boxSizing: "border-box",
          background: t.surface, border: `1px solid ${t.border}`,
          borderRadius: RAD.ms, padding: "8px 10px",
          fontSize: FS.input, color: t.text, fontFamily: "inherit",
          outline: "none", resize: "vertical", minHeight: 60,
        }}
        onFocus={(e) => e.currentTarget.style.borderColor = accent + "80"}
        onBlur={(e) => e.currentTarget.style.borderColor = t.border}
      />
    </div>
  );
}

// ── Custom-Feld-Typen ───────────────────────────────────────────────────────
const CUSTOM_FELD_TYPEN = [
  { id: "text",   label: "Text",     icon: "Aa",  htmlType: "text" },
  { id: "number", label: "Zahl",     icon: "#",   htmlType: "number" },
  { id: "date",   label: "Datum",    icon: "📅",  htmlType: "date" },
  { id: "url",    label: "Link",     icon: "🔗",  htmlType: "url" },
  { id: "address",label: "Adresse",  icon: "🏠",  htmlType: "text" },
];

// Adress-Werte sind Objekte {strasse, plz, ort} statt Strings — Helfer dafür.
function istAdressWert(v) { return v != null && typeof v === "object"; }
function adressWertText(v) {
  if (!istAdressWert(v)) return "";
  const s = (v.strasse || "").trim();
  const p = joinPlzOrt(v.plz, v.ort) || (v.plzOrt || "").trim();
  return [s, p].filter(Boolean).join(", ");
}
// Passender Leerwert je Feldtyp (Adresse = Objekt, sonst leerer String).
function leerWertFuerTyp(typ) {
  return typ === "address" ? { strasse: "", plz: "", ort: "" } : "";
}

function formatCustomWert(typ, wert) {
  if (wert == null || wert === "") return "";
  if (typ === "address") return adressWertText(wert);
  if (typ === "date") {
    // YYYY-MM-DD → DD.MM.YYYY (DE-Format)
    const parts = String(wert).split("-");
    if (parts.length === 3) return `${parts[2]}.${parts[1]}.${parts[0]}`;
    return String(wert);
  }
  if (typ === "url") return String(wert);
  return String(wert);
}

// ── CustomFeldZeile (Einzelfeld in der Liste) ───────────────────────────────
// Im Read-Modus: Name + Wert als Text. Im Edit-Modus: Wert editierbar +
// Stift (Name/Typ ändern) + ✕ (löschen). Konsistent mit Stammdaten/Rollen.
function CustomFeldZeile({ feld, onWertChange, onRemove, editMode, t, accent }) {
  const typDef = CUSTOM_FELD_TYPEN.find(x => x.id === feld.typ) || CUSTOM_FELD_TYPEN[0];
  // address-Branch
  const adrWert = istAdressWert(feld.wert) ? feld.wert : {};
  const adrInput = {
    boxSizing: "border-box", background: t.surface,
    border: `1px solid ${t.border}`, borderRadius: RAD.sm,
    padding: "5px 8px", fontSize: FS.m, color: t.text,
    fontFamily: "inherit", outline: "none" };
  // default-Branch
  const feldOk = feldWertGueltig(feld.name, feld.typ, feld.wert);
  const ruheRand = feldOk ? t.border : "#EF4444";

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8,
      padding: "6px 0", borderBottom: `1px solid ${t.border}30` }}>
      <div style={{ flex: "0 0 130px", minWidth: 0, display: "flex", alignItems: "center", gap: 6 }}>
        <span style={{ fontSize: FS.l, opacity: 0.7 }}>{typDef.icon}</span>
        <span style={{ fontSize: FS.m, color: t.sub, fontWeight: FW.medium,
          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {feld.name}
        </span>
      </div>
      {editMode ? (
        feld.typ === "date" ? (
          <div style={{ flex: 1, minWidth: 0 }}>
            <DatumFeld value={feld.wert} onChange={onWertChange} t={t} accent={accent} iso defaultHeute={false}/>
          </div>
        ) : feld.typ === "address" ? (
          <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 6 }}>
            <input type="text" value={adrWert.strasse || ""}
              onChange={(e) => onWertChange({ ...adrWert, strasse: e.target.value })}
              placeholder="Straße + Hausnr." style={{ ...adrInput, width: "100%" }}
              onFocus={(e) => e.currentTarget.style.borderColor = accent + "80"}
              onBlur={(e) => e.currentTarget.style.borderColor = t.border}/>
            <div style={{ display: "flex", gap: 6 }}>
              <input type="text" value={adrWert.plz || ""}
                onChange={(e) => onWertChange({ ...adrWert, plz: e.target.value })}
                placeholder="PLZ" style={{ ...adrInput, flex: "0 0 72px", minWidth: 0 }}
                onFocus={(e) => e.currentTarget.style.borderColor = accent + "80"}
                onBlur={(e) => e.currentTarget.style.borderColor = t.border}/>
              <input type="text" value={adrWert.ort || ""}
                onChange={(e) => onWertChange({ ...adrWert, ort: e.target.value })}
                placeholder="Ort" style={{ ...adrInput, flex: 1, minWidth: 0 }}
                onFocus={(e) => e.currentTarget.style.borderColor = accent + "80"}
                onBlur={(e) => e.currentTarget.style.borderColor = t.border}/>
            </div>
          </div>
        ) : (
          <input
            type={typDef.htmlType}
            value={feld.wert || ""}
            onChange={(e) => onWertChange(e.target.value)}
            placeholder={`${typDef.label}…`}
            style={{
              flex: 1, minWidth: 0,
              background: t.surface, border: `1px solid ${ruheRand}`,
              borderRadius: RAD.sm, padding: "5px 8px", fontSize: FS.input, color: t.text,
              fontFamily: "inherit", outline: "none",
            }}
            onFocus={(e) => e.currentTarget.style.borderColor = feldOk ? accent + "80" : "#EF4444"}
            onBlur={(e) => e.currentTarget.style.borderColor = ruheRand}
          />
        )
      ) : (
        <div style={{ flex: 1, minWidth: 0, fontSize: FS.m, color: t.text,
          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
          padding: "5px 8px" }}>
          {formatCustomWert(feld.typ, feld.wert)
            || <span style={{ color: t.muted, fontStyle: "italic" }}>—</span>}
        </div>
      )}
      {editMode && (
        <button onClick={onRemove} title="Feld löschen"
          style={{
            background: "transparent", border: `1px solid ${t.border}`,
            borderRadius: RAD.sm, padding: "2px 6px", cursor: "pointer",
            color: "#EF4444", fontFamily: "inherit", fontSize: FS.s, fontWeight: FW.medium }}>
          ✕
        </button>
      )}
    </div>
  );
}

// ── CustomFeldForm (Inline-Formular zum Anlegen ODER Bearbeiten eines Felds) ─
function CustomFeldForm({ initial, onSave, onCancel, t, accent }) {
  const istBearbeitung = !!initial;
  const [name, setName] = useState((initial && initial.name) || "");
  const [typ, setTyp] = useState((initial && initial.typ) || "text");
  const [wert, setWert] = useState((initial && initial.wert) || "");
  const typDef = CUSTOM_FELD_TYPEN.find(x => x.id === typ) || CUSTOM_FELD_TYPEN[0];

  const kannSpeichern = name.trim().length > 0;
  const speichern = () => {
    if (!kannSpeichern) return;
    if (istBearbeitung) {
      onSave({ ...initial, name: name.trim(), typ, wert });
    } else {
      onSave({
        id: Date.now() + Math.floor(Math.random() * 1000),
        name: name.trim(), typ, wert,
      });
    }
  };

  const inputStyle = feldInput(t, { fontSize: FS.m });

  return (
    <div style={{ background: accent + "0A", border: `1px dashed ${accent}55`,
      borderRadius: RAD.md, padding: 10, marginTop: 6, marginBottom: 6 }}>
      <div style={{ fontSize: FS.xs, fontWeight: FW.bold, color: t.muted,
        marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.05em" }}>
        {istBearbeitung ? "Feld bearbeiten" : "Neues Feld"}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {!istBearbeitung && (
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 6 }}>
              <I name="sparkles" size={11} color={accent}/>
              <span style={{ fontSize: FS.xxs, fontWeight: FW.bold, color: accent,
                letterSpacing: "0.1em", textTransform: "uppercase" }}>Vorschläge</span>
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
              {SUGGESTIONS.kontakt.map((s, i) => {
                const sft = CUSTOM_FELD_TYPEN.find(x => x.id === s.type) || CUSTOM_FELD_TYPEN[0];
                const ist = name === s.name;
                return (
                  <button key={i} onClick={() => { setName(s.name); setTyp(s.type); setWert(leerWertFuerTyp(s.type)); }}
                    style={{ background: ist ? accent + "20" : t.surface,
                      border: `1px solid ${ist ? accent + "60" : t.border}`,
                      borderRadius: RAD.ms, padding: "4px 9px", cursor: "pointer", fontSize: FS.s,
                      color: ist ? accent : t.sub, display: "inline-flex", alignItems: "center",
                      gap: 4, fontFamily: "inherit" }}>
                    <span style={{ fontSize: FS.xs }}>{sft.icon}</span>{s.name}
                  </button>
                );
              })}
            </div>
          </div>
        )}
        <div>
          <div style={{ fontSize: FS.xs, color: t.muted, marginBottom: 3 }}>Feldname</div>
          <input type="text" value={name} onChange={(e) => setName(e.target.value)}
            placeholder="z. B. Geburtstag, Hobby, IBAN…" style={inputStyle}/>
        </div>
        <div>
          <div style={{ fontSize: FS.xs, color: t.muted, marginBottom: 3 }}>Typ</div>
          <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
            {CUSTOM_FELD_TYPEN.map(td => {
              const ist = typ === td.id;
              return (
                <button key={td.id} onClick={() => { setTyp(td.id); if (!istBearbeitung) setWert(leerWertFuerTyp(td.id)); }}
                  style={{
                    fontSize: FS.s, padding: "4px 10px", borderRadius: RAD.pill,
                    background: ist ? accent + "22" : "transparent",
                    border: `1px solid ${ist ? accent + "60" : t.border}`,
                    color: ist ? accent : t.sub, cursor: "pointer",
                    fontFamily: "inherit", fontWeight: ist ? 700 : 500,
                    display: "inline-flex", alignItems: "center", gap: 4 }}>
                  <span style={{ fontSize: FS.m }}>{td.icon}</span>
                  {td.label}
                </button>
              );
            })}
          </div>
        </div>
        <div>
          <div style={{ fontSize: FS.xs, color: t.muted, marginBottom: 3 }}>Wert (optional)</div>
          {typ === "date" ? (
            <DatumFeld value={wert} onChange={setWert} t={t} accent={accent} iso defaultHeute={false}/>
          ) : typ === "address" ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <input type="text" value={(istAdressWert(wert) && wert.strasse) || ""}
                onChange={(e) => setWert({ ...(istAdressWert(wert) ? wert : {}), strasse: e.target.value })}
                placeholder="Straße + Hausnr." style={inputStyle}/>
              <div style={{ display: "flex", gap: 6 }}>
                <input type="text" value={(istAdressWert(wert) && wert.plz) || ""}
                  onChange={(e) => setWert({ ...(istAdressWert(wert) ? wert : {}), plz: e.target.value })}
                  placeholder="PLZ" style={{ ...inputStyle, flex: "0 0 72px", minWidth: 0 }}/>
                <input type="text" value={(istAdressWert(wert) && wert.ort) || ""}
                  onChange={(e) => setWert({ ...(istAdressWert(wert) ? wert : {}), ort: e.target.value })}
                  placeholder="Ort" style={{ ...inputStyle, flex: 1, minWidth: 0 }}/>
              </div>
            </div>
          ) : (
            <input type={typDef.htmlType} value={wert} onChange={(e) => setWert(e.target.value)}
              placeholder={`${typDef.label}…`} style={inputStyle}/>
          )}
        </div>
        <div style={{ display: "flex", gap: 6, justifyContent: "flex-end", marginTop: 2 }}>
          <AktionsButton variante="breit" rolle="abbrechen" onClick={onCancel}
            text="Abbrechen" icon={false} t={t} accent={accent}/>
          <AktionsButton variante="breit" rolle="bestaetigen" disabled={!kannSpeichern} onClick={speichern}
            text={istBearbeitung ? "Speichern" : "Hinzufügen"} icon={false} t={t} accent={accent}/>
        </div>
      </div>
    </div>
  );
}

// ── CustomFelderSektion ─────────────────────────────────────────────────────
// Wert-Änderungen sind IMMER möglich. Struktur-Änderungen (Hinzufügen,
// Umbenennen, Typ ändern, Löschen) erfordern den Karten-Edit-Modus.
function CustomFelderSektion({ felder, onChange, editMode, t, accent, embedded = false }) {
  const [neuesFeldForm, setNeuesFeldForm] = useState(false);
  const liste = Array.isArray(felder) ? felder : [];

  const update = (idx, neueFeld) => {
    onChange(liste.map((f, i) => i === idx ? neueFeld : f));
  };
  const remove = (idx) => {
    onChange(liste.filter((_, i) => i !== idx));
  };
  const add = (neuesFeld) => {
    onChange([...liste, neuesFeld]);
    setNeuesFeldForm(false);
  };

  return (
    <div style={embedded ? {} : { marginTop: 10, paddingTop: 10, borderTop: `1px solid ${t.border}40` }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between",
        marginBottom: 6 }}>
        <div style={{ fontSize: FS.s, fontWeight: FW.bold, color: t.sub,
          textTransform: "uppercase", letterSpacing: "0.1em" }}>
          Eigene Felder ({liste.length})
        </div>
        {editMode && !neuesFeldForm && (
          <button onClick={() => setNeuesFeldForm(true)} style={{
            fontSize: FS.s, padding: "3px 10px", background: accent + "20",
            color: accent, border: "none", borderRadius: RAD.sm,
            cursor: "pointer", fontFamily: "inherit", fontWeight: FW.medium }}>
            + Feld hinzufügen
          </button>
        )}
      </div>

      {liste.length === 0 && !neuesFeldForm && (
        <div style={{ fontSize: FS.s, color: t.muted, fontStyle: "italic", padding: "6px 0" }}>
          {editMode
            ? <>Noch keine eigenen Felder. Klick {"\u201E+ Feld hinzuf\u00fcgen\u201C"} für Geburtstag, Hobby etc.</>
            : "Keine eigenen Felder."}
        </div>
      )}

      {liste.length > 0 && (
        <div>
          {liste.map((f, i) => (
            <CustomFeldZeile key={f.id || i} feld={f}
              onWertChange={(neuWert) => update(i, { ...f, wert: neuWert })}
              onRemove={() => remove(i)}
              editMode={editMode} t={t} accent={accent}/>
          ))}
        </div>
      )}

      {neuesFeldForm && editMode && (
        <CustomFeldForm
          onSave={add}
          onCancel={() => setNeuesFeldForm(false)}
          t={t} accent={accent}/>
      )}
    </div>
  );
}

// ── Mitarbeiter einer Firma ─────────────────────────────────────────────────
// Personen, die mit p.firmaId === firma.id verknüpft sind. Die Rolle innerhalb
// der Firma (Geschäftsführer, Mitarbeiter, Sachbearbeiter, Ansprechpartner)
// steht in p.objektZuweisungen als Eintrag mit { firmaId, rolle, status }
// (ohne objektId — das markiert die Firmen-interne Rolle, nicht eine
// Zuweisung zu einem konkreten Objekt).
function getFirmaMitarbeiter(firmaId, kontakte) {
  return (kontakte || [])
    .filter(k => k && k.typ === "person" && k.firmaId === firmaId)
    .map(p => {
      const zuw = (p.objektZuweisungen || []).find(
        z => z.firmaId === firmaId && !z.objektId
      );
      return {
        person: p,
        rolle: zuw ? zuw.rolle : null,
        status: zuw ? (zuw.status || "aktiv") : "aktiv",
        von: zuw ? (zuw.von || "") : "",
        bis: zuw ? (zuw.bis || "") : "",
      };
    });
}



// ── ObjektZeile: konsolidierte Liste-Karte für die Objekte-Sektion einer
// Kontakt-Detail-Karte. Aufklappbare Karte:
// Header (Icon + Bezug + Status) ist klickbar, beim Aufklappen erscheint
// ein Body INNERHALB der gleichen Karte mit Details oder Edit-Inputs.
// Im Edit-Modus können Status/Ab/Bis direkt bearbeitet werden (kein Save-
// Button — Änderungen feuern via onZuweisungUpdate sofort durch).
function ObjektZeile({ ve, einheit, zuweisungen, t, accent, editMode, aktiv = false,
  onClick, oneRolle, onBearbeiten, onRemove, onZuweisungUpdate, onGoto }) {
  const istDesktop = useWindowWidth() >= DESKTOP_MIN_WIDTH;
  if (!ve) return null;
  const istEinheit = !!einheit;
  const istSP = istEinheit && isStellplatzTyp(einheit.typ);

  const adrTeile = (ve.adresse || "").split(",").map(s => s.trim());
  const strasse = adrTeile[0] || "";

  // Erste/einzige Zuweisung als Quelle für Status/Von/Bis/Rolle
  const z = zuweisungen[0] || {};
  const rolle = z.rolle;
  const von = z.von || "";
  const bis = z.bis || "";
  // Status leitet sich aus den Datumsfeldern ab (nicht mehr manuell gesetzt).
  const status = ableiteStatusVonBis(von, bis, !!z.beabsichtigt);

  const statusFarbe = status === "aktiv" ? "#22C55E"
    : status === "werdend" ? "#F59E0B" : "#94A3B8";

  const inputStyle = feldInput(t, { fontSize: FS.m });
  const labelStyle = { fontSize: FS.xs, color: t.muted, fontWeight: FW.medium,
    textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 2 };
  const wertStyle = { fontSize: FS.m, color: t.text };

  // Akzent für die Kachel: bei mehreren Zuweisungen den passenden Roll-Akzent
  // wäre denkbar, hier nehmen wir den Objekt-Akzent (cyan-ish).

  return (
    <div style={{
      background: aktiv ? accent + "08" : t.card,
      border: `1px solid ${aktiv ? accent : t.border}`,
      borderRadius: RAD.ml, overflow: "hidden", transition: "all 0.15s",
    }}>
      {/* === Header: immer sichtbar, klickbar zum Aufklappen === */}
      <div onClick={onClick} style={{
        cursor: onClick ? "pointer" : "default",
        padding: "10px 12px",
        display: "flex", alignItems: "center", gap: 12,
      }}>
        {/* Icon */}
        <div style={{ width: 40, height: 40, borderRadius: RAD.md,
          background: accent + "20", display: "flex", alignItems: "center",
          justifyContent: "center", flexShrink: 0 }}>
          <I name={istSP ? "building" : "home"} size={18} color={accent}/>
        </div>
        {/* Title + Sub */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
            <span style={{ fontSize: FS.l, fontWeight: FW.bold, color: t.text }}>
              {ve.nr}{istEinheit ? ` · ${einheit.nr}` : ""}
            </span>
          </div>
          {(strasse || (istEinheit && einheit.lage)) && (
            <div style={{ fontSize: FS.s, color: t.sub, marginTop: 2,
              overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {strasse}{istEinheit && einheit.lage ? ` · ${einheit.lage}` : ""}
            </div>
          )}
        </div>
        {/* Rechts: Rollen-Badge + Status (Aktions-Buttons liegen außerhalb der Karte) */}
        <div style={{ display: "flex", alignItems: "center", gap: 4, flexShrink: 0 }}>
          {rolle && (
            <span style={{ fontSize: FS.xs, padding: "3px 8px", borderRadius: RAD.ml,
              background: accent + "20", color: accent, fontWeight: FW.medium }}>{rolle}</span>
          )}
          {status !== "aktiv" && (
            <span style={{ fontSize: FS.xxs, padding: "3px 8px", borderRadius: RAD.ml,
              background: statusFarbe + "22", color: statusFarbe, fontWeight: FW.bold }}>{status}</span>
          )}
        </div>
      </div>

      {/* === Body wenn aufgeklappt === */}
      {aktiv && (
        editMode && onZuweisungUpdate ? (
          /* --- Edit-Modus: Status + Ab/Bis Inputs --- */
          <div style={{ padding: "10px 12px", borderTop: `1px solid ${accent}30` }}>
            <div style={istDesktop
              ? { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }
              : { display: "flex", flexDirection: "column", gap: 8 }}>
              <div style={istDesktop ? { gridColumn: "1 / -1" } : null}>
                <div style={labelStyle}>Status</div>
                <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: FS.s,
                  color: t.sub, padding: "2px 0" }}>
                  <span style={{ color: statusFarbe, fontWeight: FW.bold }}>{status}</span>
                  <span style={{ fontSize: FS.xs, color: t.muted }}>— ergibt sich aus Ab/Bis</span>
                </div>
              </div>
              <div>
                <div style={labelStyle}>Ab</div>
                <DatumFeld value={von} onChange={v => onZuweisungUpdate({ von: v, status: ableiteStatusVonBis(v, bis, !!z.beabsichtigt) })}
                  t={t} accent={accent} iso defaultHeute={false}/>
              </div>
              <div>
                <div style={labelStyle}>Bis</div>
                <DatumFeld value={bis} onChange={v => onZuweisungUpdate({ bis: v, status: ableiteStatusVonBis(von, v, !!z.beabsichtigt) })}
                  t={t} accent={accent} iso defaultHeute={false}/>
              </div>
            </div>
            {onGoto && (
              <div style={{ marginTop: 10, display: "flex", justifyContent: "flex-end" }}>
                <button onClick={(e) => { e.stopPropagation(); onGoto(); }}
                  style={{ fontSize: FS.s, padding: "5px 12px", background: accent + "18",
                    color: accent, border: `1px solid ${accent}40`, borderRadius: RAD.sm,
                    cursor: "pointer", fontWeight: FW.medium, fontFamily: "inherit",
                    display: "inline-flex", alignItems: "center", gap: 5 }}>
                  Zum Objekt
                </button>
              </div>
            )}
          </div>
        ) : (
          /* --- Read-Modus: Details als Grid --- */
          <div style={{ padding: "10px 12px", borderTop: `1px solid ${accent}30` }}>
            <div style={{ display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: 10 }}>
              <div>
                <div style={labelStyle}>Objekt</div>
                <div style={wertStyle}>{ve.nr}</div>
              </div>
              <div>
                <div style={labelStyle}>Adresse</div>
                <div style={wertStyle}>{ve.adresse || "—"}</div>
              </div>
              {istEinheit && (
                <>
                  <div>
                    <div style={labelStyle}>Einheit</div>
                    <div style={wertStyle}>{einheit.nr}</div>
                  </div>
                  {einheit.lage && (
                    <div>
                      <div style={labelStyle}>Lage</div>
                      <div style={wertStyle}>{einheit.lage}</div>
                    </div>
                  )}
                  {einheit.flaeche && (
                    <div>
                      <div style={labelStyle}>Fläche</div>
                      <div style={wertStyle}>{einheit.flaeche}</div>
                    </div>
                  )}
                  {einheit.zimmer && (
                    <div>
                      <div style={labelStyle}>Zimmer</div>
                      <div style={wertStyle}>{einheit.zimmer}</div>
                    </div>
                  )}
                </>
              )}
              <div>
                <div style={labelStyle}>Status</div>
                <div style={wertStyle}>{status}</div>
              </div>
              {von && (
                <div>
                  <div style={labelStyle}>Ab</div>
                  <div style={wertStyle}>{von.split("-").reverse().join(".")}</div>
                </div>
              )}
              {bis && (
                <div>
                  <div style={labelStyle}>Bis</div>
                  <div style={wertStyle}>{bis.split("-").reverse().join(".")}</div>
                </div>
              )}
            </div>
            {onGoto && (
              <div style={{ marginTop: 10, display: "flex", justifyContent: "flex-end" }}>
                <button onClick={(e) => { e.stopPropagation(); onGoto(); }}
                  style={{ fontSize: FS.s, padding: "5px 12px", background: accent + "18",
                    color: accent, border: `1px solid ${accent}40`, borderRadius: RAD.sm,
                    cursor: "pointer", fontWeight: FW.medium, fontFamily: "inherit",
                    display: "inline-flex", alignItems: "center", gap: 5 }}>
                  Zum Objekt
                </button>
              </div>
            )}
          </div>
        )
      )}
    </div>
  );
}


// Modal zum Hinzufügen einer Person zur Firma
// Hinweis, wenn die gewählte Person aktuell bei einer anderen Firma hängt.
function FirmaWechselHinweis({ auswahlId, kontakte, firma, t }) {
  if (auswahlId == null) return null;
  const p = kontakte.find(k => k.id === auswahlId);
  if (!(p && p.firmaId && p.firmaId !== firma.id)) return null;
  const altFirma = kontakte.find(f => f.id === p.firmaId);
  return (
    <div style={{ marginTop: 8, padding: "6px 10px", fontSize: FS.s,
      background: "#F59E0B15", border: "1px solid #F59E0B40",
      borderRadius: RAD.sm, color: t.text }}>
      Hinweis: Diese Person ist aktuell bei „{altFirma ? altFirma.name : "?"}" eingetragen. Beim Speichern wird die Verknüpfung dorthin entfernt.
    </div>
  );
}

function AddMitarbeiterModal({ firma, kontakte, t, accent, onClose, onSave }) {
  const rollen = useRollen();
  const firmaRollen = rollen.filter(r => r.slot === "firma" && r.aktiv !== false);
  const [modus, setModus] = useState("neu"); // "neu" oder "bestehend"
  const [rolle, setRolle] = useState(firmaRollen[0] ? firmaRollen[0].name : "Mitarbeiter");
  // Felder für neue Person
  const [vorname, setVorname] = useState("");
  const [nachname, setNachname] = useState("");
  const [tel, setTel] = useState("");
  const [email, setEmail] = useState("");
  // Auswahl für bestehende Person
  const [auswahlId, setAuswahlId] = useState(null);
  const [suchBegr, setSuchBegr] = useState("");

  // Personen die wählbar sind: alle Personen die nicht schon zu DIESER Firma gehören
  const verfuegbare = kontakte
    .filter(k => k.typ === "person" && k.firmaId !== firma.id)
    .filter(k => {
      if (!suchBegr.trim()) return true;
      const q = suchBegr.toLowerCase();
      return (k.name || "").toLowerCase().includes(q)
        || (k.vorname || "").toLowerCase().includes(q)
        || (k.nachname || "").toLowerCase().includes(q);
    })
    .slice(0, 30);

  const kannSpeichern = modus === "neu"
    ? (vorname.trim().length > 0 || nachname.trim().length > 0)
    : auswahlId != null;

  const speichern = () => {
    if (!kannSpeichern) return;
    if (modus === "neu") {
      onSave({
        typ: "neu",
        person: {
          vorname: vorname.trim(),
          nachname: nachname.trim(),
          tels: tel.trim() ? [{ nr: tel.trim(), type: "Mobil" }] : [],
          emails: email.trim() ? [{ email: email.trim() }] : [],
        },
        rolle, status: "aktiv",
      });
    } else {
      onSave({ typ: "bestehend", kontaktId: auswahlId, rolle, status: "aktiv" });
    }
  };

  const tabStyle = (aktiv) => ({
    flex: 1, padding: "8px 12px",
    background: aktiv ? accent + "20" : "transparent",
    border: "none",
    borderBottom: `2px solid ${aktiv ? accent : "transparent"}`,
    color: aktiv ? accent : t.sub,
    cursor: "pointer", fontFamily: "inherit", fontSize: FS.l, fontWeight: FW.medium,
  });
  const inputStyle = {
    width: "100%", padding: "8px 10px", fontSize: FS.l,
    background: t.surface, border: `1px solid ${t.border}`,
    borderRadius: RAD.ms, color: t.text, fontFamily: "inherit", boxSizing: "border-box",
  };
  const labelStyle = { fontSize: FS.s, fontWeight: FW.medium, color: t.sub,
    textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 4 };

  return (
    <div onClick={onClose} style={{
      position: "fixed", top: 0, right: 0, bottom: 0, left: 0, background: "#0008",
      zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center",
      padding: 16 }}>
      <div onClick={(e) => e.stopPropagation()} style={{
        background: t.card, borderRadius: RAD.lg, padding: 20,
        maxWidth: 480, width: "100%", maxHeight: "90dvh", overflow: "auto",
        boxShadow: `0 10px 40px ${accent}30, 0 4px 12px #0008` }}>
        <div style={{ fontSize: FS.icon, fontWeight: FW.heavy, color: t.text, marginBottom: 4 }}>
          Person zu Firma hinzufügen
        </div>
        <div style={{ fontSize: FS.m, color: t.sub, marginBottom: 16 }}>
          {firma.name}
        </div>

        {/* Tabs: bestehend / neu */}
        <div style={{ display: "flex", borderBottom: `1px solid ${t.border}`,
          marginBottom: 14 }}>
          <button onClick={() => setModus("bestehend")} style={tabStyle(modus === "bestehend")}>
            Bestehende Person
          </button>
          <button onClick={() => setModus("neu")} style={tabStyle(modus === "neu")}>
            Neue Person
          </button>
        </div>

        {/* Rolle */}
        <div style={{ marginBottom: 14 }}>
          <div style={labelStyle}>Rolle in der Firma</div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {firmaRollen.map(r => {
              const ist = rolle === r.name;
              return (
                <button key={r.name} onClick={() => setRolle(r.name)} style={{
                  fontSize: FS.m, padding: "5px 10px", borderRadius: RAD.pill,
                  background: ist ? r.color + "22" : "transparent",
                  border: `1px solid ${ist ? r.color + "80" : t.border}`,
                  color: ist ? r.color : t.sub,
                  cursor: "pointer", fontFamily: "inherit", fontWeight: ist ? 700 : 500 }}>
                  {r.name}
                </button>
              );
            })}
          </div>
        </div>

        {/* Modus-spezifischer Bereich */}
        {modus === "neu" ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <div style={{ display: "flex", gap: 8 }}>
              <div style={{ flex: 1 }}>
                <div style={labelStyle}>Vorname</div>
                <input type="text" value={vorname} onChange={e => setVorname(e.target.value)}
                  placeholder="Max" style={inputStyle}/>
              </div>
              <div style={{ flex: 1 }}>
                <div style={labelStyle}>Nachname</div>
                <input type="text" value={nachname} onChange={e => setNachname(e.target.value)}
                  placeholder="Mustermann" style={inputStyle}/>
              </div>
            </div>
            <div>
              <div style={labelStyle}>Telefon</div>
              <input type="text" value={tel} onChange={e => setTel(e.target.value)}
                placeholder="0151 1234567" style={inputStyle}/>
            </div>
            <div>
              <div style={labelStyle}>E-Mail</div>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                placeholder="max@firma.de" style={inputStyle}/>
            </div>
          </div>
        ) : (
          <div>
            <input type="text" value={suchBegr} onChange={e => setSuchBegr(e.target.value)}
              placeholder="Person suchen…" style={{ ...inputStyle, marginBottom: 8 }}/>
            <div style={{ maxHeight: 280, overflow: "auto",
              border: `1px solid ${t.border}`, borderRadius: RAD.ms }}>
              {verfuegbare.length === 0 ? (
                <div style={{ padding: 16, fontSize: FS.m, color: t.muted, fontStyle: "italic", textAlign: "center" }}>
                  Keine Personen gefunden.
                </div>
              ) : verfuegbare.map(p => {
                const name = [p.vorname, p.nachname].filter(Boolean).join(" ") || p.name;
                const ist = auswahlId === p.id;
                return (
                  <div key={p.id} onClick={() => setAuswahlId(p.id)} style={{
                    padding: "8px 12px", cursor: "pointer",
                    background: ist ? accent + "20" : "transparent",
                    borderBottom: `1px solid ${t.border}40`,
                    display: "flex", alignItems: "center", gap: 8 }}>
                    <Avatar name={name} size={28} accent={accent}/>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: FS.l, fontWeight: FW.medium, color: t.text }}>{name}</div>
                      {p.firmaId && (
                        <div style={{ fontSize: FS.xs, color: t.muted }}>
                          aktuell bei: {(kontakte.find(f => f.id === p.firmaId) || {}).name || "?"}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
            <FirmaWechselHinweis auswahlId={auswahlId} kontakte={kontakte} firma={firma} t={t}/>
          </div>
        )}

        {/* Buttons */}
        <div style={{ display: "flex", gap: 8, marginTop: 18, justifyContent: "flex-end" }}>
          <button onClick={onClose} style={{
            padding: "8px 14px", background: "transparent",
            border: `1px solid ${t.border}`, borderRadius: RAD.ms,
            color: t.text, cursor: "pointer", fontFamily: "inherit", fontSize: FS.m, fontWeight: FW.medium }}>
            Abbrechen
          </button>
          <button onClick={speichern} disabled={!kannSpeichern} style={{
            padding: "8px 14px", background: kannSpeichern ? accent : t.border,
            border: "none", borderRadius: RAD.ms,
            color: getContrastColor(kannSpeichern ? accent : t.border), cursor: kannSpeichern ? "pointer" : "not-allowed",
            fontFamily: "inherit", fontSize: FS.m, fontWeight: FW.bold,
            opacity: kannSpeichern ? 1 : 0.5 }}>
            Hinzufügen
          </button>
        </div>
      </div>
    </div>
  );
}

// ── DSGVO-Werkzeuge (Auskunft + abgestufte Löschung) ────────────────────────
// dsgvoEinstufung: bestimmt aus den Objekt-Zuweisungen eines Kontakts, wie
// „gewichtig" eine Löschung wäre — damit der Handwerker ohne Bindung leicht
// gelöscht werden kann, ein aktiver Eigentümer aber geschützt ist.
//   "gruen"  — nichts hängt dran (keine/nur formlose Zuweisungen) → frei löschbar
//   "gelb"   — nur EHEMALIGE objektbezogene Bindungen (Alt-Eigentümer/Ex-Mieter)
//              → Aufbewahrungsfristen möglich, Löschen mit deutlicher Warnung
//   "rot"    — mind. eine AKTIVE objektbezogene Bindung → Löschen gesperrt
// WICHTIG: Eine reine Firmen-ANSTELLUNG (firmaId ohne eigenen Objektbezug) ist
// KEINE schützenswerte Bindung im DSGVO-Sinn — ein ausgeschiedener Mitarbeiter
// hängt nicht an Objekt-Aufbewahrungspflichten. Solche Einträge werden ignoriert;
// die über die Firma abgeleiteten Objekt-Rollen gehören der Firma, nicht der Person.
function dsgvoEinstufung(kontakt) {
  const zuw = (kontakt && kontakt.objektZuweisungen) || [];
  let hatAktiv = false, hatEhemalig = false;
  zuw.forEach(z => {
    if (!z) return;
    // Reine Anstellung (firmaId, kein Objekt-/Einheit-/Gerätebezug) überspringen.
    if (z.firmaId != null && z.objektId == null && z.einheitId == null && z.geraetId == null) return;
    // Eingehende Vertretungs-/Betreuungsvermerke (zielKontaktId) sind keine
    // eigene Objektbindung der Person → ebenfalls nicht löschsperrend.
    if (z.zielKontaktId != null && z.objektId == null) return;
    const s = (z.status) || "aktiv";
    if (s === "aktiv" || s === "werdend" || s === "interessent") hatAktiv = true;
    else if (s === "ehemalig") hatEhemalig = true;
    else hatAktiv = true; // unbekannter Status → vorsichtshalber als aktiv werten
  });
  if (hatAktiv) return "rot";
  if (hatEhemalig) return "gelb";
  return "gruen";
}

// anonymisiereKontakt: ersetzt alle personenbezogenen Klartext-Felder einer
// Person durch Platzhalter und markiert den Datensatz (DESIGN §26.5). Der
// Datensatz selbst bleibt mit seiner id und den objektZuweisungen erhalten —
// Belege/Historie bleiben referenzierbar, die Person ist nicht mehr
// identifizierbar. Anzeigename danach: "Kontakt #<Kürzel>" (letzte 4 Ziffern
// der id). UNWIDERRUFLICH — es gibt bewusst keine Sicherungskopie der Daten.
function kontaktAnonymKuerzel(k) {
  const roh = String((k && k.id != null) ? k.id : "");
  const ziffern = roh.replace(/\D/g, "");
  if (ziffern.length > 4) return ziffern.slice(-4);
  return ziffern || roh || "?";
}
function anonymisiereKontakt(k) {
  const platzName = "Kontakt #" + kontaktAnonymKuerzel(k);
  return {
    ...k,
    // Name-Felder: nachname trägt den Platzhalter, damit ALLE Anzeige-Pfade
    // ([vorname, nachname].join) UND der k.name-Fallback denselben Text liefern.
    name: platzName, vorname: "", nachname: platzName, anrede: "", titel: "",
    // Kontaktdaten
    tels: [], emails: [], telefon: "", mobil: "", email: "",
    // Adresse inkl. Favorit-Flags
    strasse: "", plz: "", ort: "", plzOrt: "", adresse: "",
    strasseFavorit: false, plzOrtFavorit: false, adresseFavorit: false,
    // Sonstiges Personenbezogenes
    geburtstag: "", geburtsdatum: "", notizen: "", customFelder: [], foto: "",
    // Marker: ISO-Datum der Anonymisierung → schaltet die Karte schreibgeschützt
    anonymisiert: new Date().toISOString().slice(0, 10),
  };
}

// Sammelt alle personenbezogenen Daten eines Kontakts als Klartext-Zeilen für
// die Art.-15-Auskunft. Liefert { titel, abschnitte: [{ h, zeilen:[[label,wert]] }] }.
function dsgvoAuskunftDaten(kontakt, ves) {
  const k = kontakt || {};
  const istFirma = k.typ === "firma";
  const stamm = [];
  const push = (label, wert) => { if (wert != null && String(wert).trim() !== "") stamm.push([label, String(wert).trim()]); };

  // Name aus den echten Feldern zusammensetzen (Personen: titel/vorname/nachname,
  // Firmen: name). Kein separates k.name bei Personen.
  const personName = [k.titel, k.vorname, k.nachname].filter(Boolean).join(" ").trim();
  push("Name", istFirma ? k.name : (personName || k.name));
  push("Typ", istFirma ? "Firma" : "Person");
  push("Anrede", k.anrede);
  if (istFirma) {
    push("Rechtsform", k.rechtsform);
    push("Ansprechpartner", Array.isArray(k.ansprechpartner)
      ? k.ansprechpartner.map(a => [a.titel, a.vorname, a.nachname].filter(Boolean).join(" ")
          + (a.funktion ? " (" + a.funktion + ")" : "")).filter(Boolean).join(", ")
      : null);
  }

  // Telefon-/E-Mail-Listen (Personen: tels[]/emails[] mit typ; Firmen: ggf. einzeln).
  const tels = Array.isArray(k.tels) ? k.tels : [];
  tels.forEach(tt => { if (tt && tt.nr) push("Telefon" + (tt.typ ? " (" + tt.typ + ")" : ""), tt.nr); });
  if (k.telefon) push("Telefon", k.telefon);
  if (k.mobil) push("Mobil", k.mobil);
  const emails = Array.isArray(k.emails) ? k.emails : [];
  emails.forEach(ee => { if (ee && ee.email) push("E-Mail" + (ee.typ ? " (" + ee.typ + ")" : ""), ee.email); });
  if (k.email) push("E-Mail", k.email);

  // Adresse aus strasse + plzOrt (bzw. plz/ort) bzw. fertigem adresse-Feld.
  const plzOrt = k.plzOrt || [k.plz, k.ort].filter(Boolean).join(" ");
  const adresse = k.adresse || [k.strasse, plzOrt].filter(Boolean).join(", ");
  push("Adresse", adresse);

  push("Geburtsdatum", k.geburtstag || k.geburtsdatum);
  push("Notizen", k.notizen);

  // Eigene Felder (benutzerdefiniert) — als lesbare Label/Wert-Paare.
  if (Array.isArray(k.customFelder)) {
    k.customFelder.forEach(cf => { if (cf && cf.name && cf.value != null && String(cf.value).trim() !== "") push(cf.name, cf.value); });
  }

  const veName = (id) => {
    const v = (ves || []).find(x => x && x.id === id);
    return v ? (v.nr ? v.nr + " · " : "") + (v.adresse || "Objekt") : "Objekt " + id;
  };
  const rollen = ((k.objektZuweisungen) || []).map(z => {
    const ort = z.objektId ? veName(z.objektId) : (z.firmaId ? "Firma" : "—");
    const st = (z.status || "aktiv");
    return [(z.rolle || "Rolle") + (st !== "aktiv" ? " (" + st + ")" : ""), ort];
  });

  return {
    titel: "DSGVO-Auskunft – " + (istFirma ? (k.name || "Firma") : (personName || k.name || "Kontakt")),
    abschnitte: [
      { h: "Stammdaten", zeilen: stamm },
      { h: "Rollen & Objekt-Verknüpfungen", zeilen: rollen.length ? rollen : [["—", "keine Verknüpfungen"]] },
    ],
  };
}

// Öffnet den Druckdialog mit der formatierten Auskunft → dort „Als PDF sichern".
// Nutzt den gemeinsamen iframe-Druck-Baustein druckeHtml (DESIGN §26.3).
function druckeDsgvoAuskunft(kontakt, ves) {
  const daten = dsgvoAuskunftDaten(kontakt, ves);
  const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const heute = new Date().toLocaleDateString("de-DE");
  let body = "<h1>" + esc(daten.titel) + "</h1>";
  body += '<p class="meta">Auskunft nach Art. 15 DSGVO · Stand: ' + esc(heute) + "</p>";
  daten.abschnitte.forEach(ab => {
    body += "<h2>" + esc(ab.h) + "</h2><table>";
    ab.zeilen.forEach(([label, wert]) => {
      body += "<tr><th>" + esc(label) + "</th><td>" + esc(wert) + "</td></tr>";
    });
    body += "</table>";
  });
  return druckeHtml(daten.titel, body, false,
    "h2{font-size:14px;margin:24px 0 6px;border-bottom:1px solid #ccc;padding-bottom:3px;}"
    + "th{border-bottom:none;width:180px;vertical-align:top;color:#555;font-weight:600;padding:4px 8px 4px 0;}"
    + "td{border-bottom:none;padding:4px 0;}");
}

// ── KontaktDsgvoAktionen — Auskunft (immer) + abgestufte Löschung ────────────
// Eigener Bereich unten im Kontaktprofil. Der Auskunfts-Button ist immer da
// (Auskunft erteilen ist unbedenklich). Der Lösch-Button ersetzt den alten
// einfachen Lösch-Button und ist abgestuft nach dsgvoEinstufung (DESIGN §26):
//   gruen → 2 Klick · gelb → 2 Klick + Warntext · rot → gesperrt mit Hinweis.
// onDelete wird nur aufgerufen, wenn nicht gesperrt und die Bestätigung erfolgt.
// NEU (v9.63): Bei Stufe "gelb" zusätzlich "Anonymisieren" (§26.5) — gleiche
// 2-Klick-Mechanik, ruft onAnonymisieren. Ist der Kontakt bereits anonymisiert,
// zeigt der Bereich nur noch eine Status-Box (Karte ist dann schreibgeschützt).
function KontaktDsgvoAktionen({ kontakt, ves, t, accent, onDelete, onAnonymisieren, loeschenErlaubt }) {
  const [bestaetigen, setBestaetigen] = useState(false);
  const [bestAnon, setBestAnon] = useState(false);
  useEffect(() => {
    if (!bestaetigen) return;
    const to = setTimeout(() => setBestaetigen(false), 6000);
    return () => clearTimeout(to);
  }, [bestaetigen]);
  useEffect(() => {
    if (!bestAnon) return;
    const to = setTimeout(() => setBestAnon(false), 6000);
    return () => clearTimeout(to);
  }, [bestAnon]);

  const stufe = dsgvoEinstufung(kontakt);
  const gesperrt = stufe === "rot";
  const ROT = "#EF4444", ORANGE = "#F59E0B";

  const onAuskunft = () => {
    druckeDsgvoAuskunft(kontakt, ves);
    // Bei blockiertem Popup: still bleiben — der Browser zeigt seinen eigenen Hinweis.
  };
  const onLoeschClick = () => {
    if (gesperrt) return;
    setBestAnon(false);
    if (!bestaetigen) { setBestaetigen(true); return; }
    setBestaetigen(false);
    if (onDelete) onDelete();
  };
  const onAnonClick = () => {
    setBestaetigen(false);
    if (!bestAnon) { setBestAnon(true); return; }
    setBestAnon(false);
    if (onAnonymisieren) onAnonymisieren();
  };

  const btnBasis = {
    display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6,
    padding: "8px 14px", borderRadius: RAD.sm, cursor: "pointer",
    fontSize: FS.m, fontWeight: FW.medium, fontFamily: "inherit",
  };

  // Bereits anonymisiert → nur Status-Box, keine Aktionen mehr (Karte ist
  // schreibgeschützt; eine Auskunft über Platzhalter wäre sinnfrei).
  if (kontakt && kontakt.anonymisiert) {
    return (
      <div style={{ marginTop: 14, paddingTop: 12, borderTop: `1px solid ${t.border}` }}>
        <div style={{ fontSize: FS.s, fontWeight: FW.bold, color: t.sub,
          textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 8 }}>
          Datenschutz (DSGVO)
        </div>
        <div style={{ padding: "8px 11px", background: t.surface,
          border: `1px solid ${t.border}`, borderRadius: RAD.sm, fontSize: FS.s,
          color: t.sub, lineHeight: 1.5 }}>
          Dieser Kontakt wurde am <b>{datumDe(kontakt.anonymisiert)}</b> anonymisiert.
          Alle personenbezogenen Daten wurden unwiderruflich entfernt; die
          Rollen-Historie bleibt für Belege referenzierbar. Die Karte ist
          schreibgeschützt.
        </div>
      </div>
    );
  }

  return (
    <div style={{ marginTop: 14, paddingTop: 12, borderTop: `1px solid ${t.border}` }}>
      <div style={{ fontSize: FS.s, fontWeight: FW.bold, color: t.sub,
        textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 8 }}>
        Datenschutz (DSGVO)
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
        <button onClick={onAuskunft} title="Alle gespeicherten Daten als PDF (Auskunft nach Art. 15 DSGVO)"
          style={{ ...btnBasis, background: accent + "15", color: accent,
            border: `1px solid ${accent}40` }}>
          <I name="document" size={13} color={accent}/>Auskunft als PDF
        </button>

        {loeschenErlaubt && onDelete && (
          gesperrt ? (
            <button disabled title="Kontakt ist aktiv eingebunden — erst Rollen beenden"
              style={{ ...btnBasis, background: t.surface, color: t.muted,
                border: `1px solid ${t.border}`, cursor: "not-allowed" }}>
              <I name="x" size={13} color={t.muted}/>Löschen gesperrt
            </button>
          ) : (
            <button onClick={onLoeschClick}
              title={bestaetigen ? "Nochmal klicken zum endgültigen Löschen" : "Kontakt löschen (Recht auf Löschung, Art. 17 DSGVO)"}
              style={{ ...btnBasis,
                background: bestaetigen ? ROT : ROT + "12",
                color: bestaetigen ? "#fff" : ROT,
                border: `1px solid ${ROT}${bestaetigen ? "" : "40"}` }}>
              <I name="x" size={13} color={bestaetigen ? "#fff" : ROT}/>
              {bestaetigen ? "Endgültig löschen?" : "Kontakt löschen"}
            </button>
          )
        )}

        {/* Anonymisieren — nur Stufe gelb (ehemalige Bindungen → Aufbewahrungs-
            fall, §26.5). Orange, gleiche 2-Klick-Mechanik wie Löschen. */}
        {stufe === "gelb" && loeschenErlaubt && onAnonymisieren && (
          <button onClick={onAnonClick}
            title={bestAnon ? "Nochmal klicken zum endgültigen Anonymisieren" : "Personenbezogene Daten unwiderruflich durch Platzhalter ersetzen"}
            style={{ ...btnBasis,
              background: bestAnon ? ORANGE : ORANGE + "12",
              color: bestAnon ? "#fff" : ORANGE,
              border: `1px solid ${ORANGE}${bestAnon ? "" : "40"}` }}>
            <I name="user" size={13} color={bestAnon ? "#fff" : ORANGE}/>
            {bestAnon ? "Endgültig anonymisieren?" : "Anonymisieren"}
          </button>
        )}
      </div>

      {/* Stufen-spezifische Aufklärung */}
      {gesperrt && (
        <div style={{ marginTop: 8, padding: "8px 11px", background: ROT + "10",
          border: `1px solid ${ROT}30`, borderRadius: RAD.sm, fontSize: FS.s,
          color: t.text, lineHeight: 1.5 }}>
          Dieser Kontakt ist <b>aktuell eingebunden</b> (aktive Rolle an einem Objekt).
          Solange das so ist, läuft der Verarbeitungszweck weiter — ein Löschen ist
          nicht zulässig. Beende zuerst die aktiven Rollen; danach lässt sich der
          Kontakt löschen oder anonymisieren.
        </div>
      )}
      {stufe === "gelb" && bestaetigen && (
        <div style={{ marginTop: 8, padding: "8px 11px", background: ORANGE + "12",
          border: `1px solid ${ORANGE}40`, borderRadius: RAD.sm, fontSize: FS.s,
          color: t.text, lineHeight: 1.5 }}>
          ⚠ Dieser Kontakt war <b>früher eingebunden</b> (z. B. ehemaliger Eigentümer
          oder Mieter). Unterlagen mit Bezug zu dieser Person — Abrechnungen, Beschlüsse,
          Verträge — können <b>gesetzlichen Aufbewahrungsfristen</b> (oft 6–10 Jahre)
          unterliegen. Prüfe, ob statt einer Löschung eine <b>Anonymisierung</b>
          (Button daneben) genügt — sie entfernt die Personendaten, hält aber die
          Verknüpfungen für Belege nach. Nochmal klicken löscht den Kontakt endgültig.
        </div>
      )}
      {stufe === "gelb" && bestAnon && (
        <div style={{ marginTop: 8, padding: "8px 11px", background: ORANGE + "12",
          border: `1px solid ${ORANGE}40`, borderRadius: RAD.sm, fontSize: FS.s,
          color: t.text, lineHeight: 1.5 }}>
          Anonymisieren ersetzt Name, Kontaktdaten, Adresse, Foto, Notizen und
          eigene Felder <b>unwiderruflich</b> durch Platzhalter — der Kontakt heißt
          danach „Kontakt #{kontaktAnonymKuerzel(kontakt)}". Die Rollen-Historie
          (z. B. „Eigentümer, ehemalig") bleibt erhalten, damit Abrechnungen und
          Beschlüsse referenzierbar bleiben. Die Karte ist danach <b>schreibgeschützt</b>.
          Nochmal klicken bestätigt.
        </div>
      )}
      {stufe === "gruen" && bestaetigen && (
        <div style={{ marginTop: 8, padding: "8px 11px", background: t.surface,
          border: `1px solid ${t.border}`, borderRadius: RAD.sm, fontSize: FS.s,
          color: t.sub, lineHeight: 1.5 }}>
          An diesem Kontakt hängen keine Objekt-Bindungen. Löschen entfernt ihn mit
          allen Daten unwiderruflich. Nochmal klicken bestätigt.
        </div>
      )}
    </div>
  );
}

// ── KontaktDetailKarte Sub-Komponenten ───────────────────────────────────────

function KDKHeader({ k, t, farbe, nameFarbe, istFirma, editMode, dirty, gueltig = true,
  headerOhneEditBtn, objektFilter, onGotoKontakt, onEdit, onSave, onCancel, onDelete, onLoesen, onUpdate,
  edit, setEdit }) {
  const anzeige = useKontaktAnzeige();
  const alleKontakte = useAlleKontakte();
  // Foto-Upload (nur Personen) — IMMER aktiv:
  //   · im Edit-Modus  → setzt edit.foto (Speichern/Abbrechen-Workflow)
  //   · im View-Modus  → speichert direkt über onUpdate(k.foto)
  const fotoFileRef = useRef(null);
  const aktFoto = (editMode && edit) ? edit.foto : k.foto;
  const fotoEditierbar = !istFirma && !k.anonymisiert && (editMode ? !!setEdit : !!onUpdate);
  const handleFotoWaehlen = (file) => {
    dateiZuFotoDataUrl(file, (url) => {
      if (!url) return;
      if (editMode && setEdit) {
        setEdit(e => ({ ...e, foto: url }));
      } else if (onUpdate) {
        onUpdate({ ...k, foto: url });
      }
    });
  };
  const handleFotoEntfernen = () => {
    if (editMode && setEdit) {
      setEdit(e => ({ ...e, foto: "" }));
    } else if (onUpdate) {
      onUpdate({ ...k, foto: "" });
    }
  };
  return (
    <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:12, flexWrap:"wrap" }}>
      {!istFirma && (
        <div style={{ position:"relative", flexShrink:0 }}>
          <Avatar name={k.name} firma={false} size={44} accent={farbe} foto={aktFoto}
            zuweisungen={zuweisungenFuerAvatar(k, undefined, alleKontakte)}/>
          {fotoEditierbar && (
            <input ref={fotoFileRef} type="file" accept="image/*"
              style={{ display:"none" }}
              onChange={(e) => {
                const f = e.target.files && e.target.files[0];
                if (f) handleFotoWaehlen(f);
                e.target.value = "";
              }}/>
          )}
        </div>
      )}
      <div style={{ flex:1, minWidth:0, fontSize: FS.icon, fontWeight: FW.heavy, color:nameFarbe,
        textDecoration:istFirma?"underline":"none", textDecorationColor:nameFarbe,
        textDecorationThickness:1.5, textUnderlineOffset:4,
        overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
        {formatNameMitCtx(k, anzeige) || k.name || "—"}
      </div>
      {editMode && fotoEditierbar && (
        <div style={{ display:"flex", alignItems:"center", gap:4, flexShrink:0 }}>
          <button onClick={() => fotoFileRef.current && fotoFileRef.current.click()}
            title={aktFoto ? "Profilfoto ändern" : "Profilfoto hinzufügen"}
            style={{ display:"inline-flex", alignItems:"center", gap:4,
              fontSize: FS.s, fontWeight: FW.medium, fontFamily:"inherit",
              padding:"4px 9px", borderRadius: RAD.sm, cursor:"pointer",
              background:farbe+"15", color:farbe, border:`1px solid ${farbe}40` }}>
            <I name={aktFoto ? "pencil" : "plus"} size={11} color={farbe}/>
            Foto
          </button>
          {aktFoto && (
            <button onClick={handleFotoEntfernen} title="Profilfoto entfernen"
              style={{ display:"inline-flex", alignItems:"center", gap:4,
                fontSize: FS.s, fontWeight: FW.medium, fontFamily:"inherit",
                padding:"4px 9px", borderRadius: RAD.sm, cursor:"pointer",
                background:"#EF444415", color:"#EF4444", border:`1px solid #EF444440` }}>
              <I name="trash" size={11} color={"#EF4444"}/>
              Foto
            </button>
          )}
        </div>
      )}
      <div style={{ display:"flex", alignItems:"center", gap:6, marginLeft:"auto", flexShrink:0 }}>
      {!headerOhneEditBtn && (!editMode ? (
        <button onClick={onEdit} title="Bearbeiten"
          style={{ display:"flex", alignItems:"center", justifyContent:"center",
            width:36, height:36, flexShrink:0, background:farbe, border:"none",
            borderRadius: RAD.pill, cursor:"pointer", boxShadow:`0 1px 2px ${farbe}40` }}>
          <I name="pencil" size={14} color={getContrastColor(farbe)}/>
        </button>
      ) : (
        <div style={{ display:"flex", gap:6, alignItems:"center", flexShrink:0 }}>
          <AktionsButton rolle="abbrechen" onClick={onCancel} title="Verwerfen"
            farbe={farbe} t={t} accent={farbe}/>
          <AktionsButton rolle="bestaetigen" onClick={onSave} disabled={!gueltig}
            farbe={farbe} title={gueltig ? "Speichern" : "Bitte ungültige Felder korrigieren"} t={t} accent={farbe}/>
        </div>
      ))}
      </div>
    </div>
  );
}

function KDKStammdatenBlock({ edit, setEdit, t, farbe, editMode, istFirma }) {
  const farben = useKontaktFarbe();
  return (
    <div>
      <div style={{ fontSize: FS.s, fontWeight: FW.bold, color:t.sub,
        textTransform:"uppercase", letterSpacing:"0.1em", marginBottom:6 }}>Stammdaten</div>
      {editMode ? (
        istFirma
          ? <FirmaStammdatenEditor edit={edit} setEdit={setEdit} t={t} accent={farbe}/>
          : <StammdatenEditor edit={edit} setEdit={setEdit} t={t} accent={farbe}/>
      ) : (
        <div>
          {istFirma ? (
            <>
              {edit.tel    && <div style={{ fontSize: FS.m, color:t.sub, padding:"2px 0" }}>📞 {edit.tel}</div>}
              {edit.email  && <div style={{ fontSize: FS.m, color:t.sub, padding:"2px 0" }}>✉ {edit.email}</div>}
              {edit.homepage && <div style={{ fontSize: FS.m, color:t.sub, padding:"2px 0" }}>🌐 {edit.homepage}</div>}
              {edit.strasse && <div style={{ fontSize: FS.m, color:t.sub, padding:"2px 0" }}>🏠 {edit.strasse}, {joinPlzOrt(edit.plz, edit.ort) || edit.plzOrt}</div>}
              {(edit.gewerke||[]).length > 0 && (
                <div style={{ display:"flex", gap:4, flexWrap:"wrap", marginTop:4 }}>
                  {edit.gewerke.map((g,i) => (
                    <span key={i} style={{ fontSize: FS.xs, padding:"2px 7px", borderRadius: RAD.ml,
                      background:farben.firma+"20", color:farben.firma, fontWeight: FW.semi }}>{g}</span>
                  ))}
                </div>
              )}
            </>
          ) : (
            <>
              {(edit.tels||[]).map((tel,i) => (
                <div key={i} style={{ fontSize: FS.m, color:t.sub, padding:"2px 0" }}>
                  📞 {tel.nr}{tel.type ? <span style={{ fontSize: FS.xs, color:t.muted }}> ({tel.type})</span> : null}{tel.favorit ? <span style={{ color: "#F59E0B", marginLeft: 4 }}>★</span> : null}
                </div>
              ))}
              {(edit.emails||[]).map((em,i) => (
                <div key={i} style={{ fontSize: FS.m, color:t.sub, padding:"2px 0" }}>✉ {em.email}{em.favorit ? <span style={{ color: "#F59E0B", marginLeft: 4 }}>★</span> : null}</div>
              ))}
              {edit.strasse && <div style={{ fontSize: FS.m, color:t.sub, padding:"2px 0" }}>🏠 {edit.strasse}, {joinPlzOrt(edit.plz, edit.ort) || edit.plzOrt}{(edit.adresseFavorit || edit.strasseFavorit || edit.plzOrtFavorit) ? <span style={{ color: "#F59E0B", marginLeft: 4 }}>★</span> : null}</div>}
              <div style={{ display: "flex", alignItems: "center", gap: 5, marginTop: 7 }}>
                <span style={{ fontSize: FS.s, color: "#F59E0B", lineHeight: 1 }}>★</span>
                <span style={{ fontSize: FS.xs, color: t.muted }}>
                  Mit Stern markierte Angaben sind zur Weitergabe freigegeben.
                </span>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

function KDKMitarbeiterSektion({ firma, t, farbe, editMode, kontakte, setKontakte,
  onKontaktClick,
  addMitarbeiterOffen, setAddMitarbeiterOffen }) {
  const mitarbeiter = getFirmaMitarbeiter(firma.id, kontakte);
  const [offeneIds, setOffeneIds] = useState(() => new Set());
  const toggleOffen = (id) => setOffeneIds(prev => {
    const next = new Set(prev); if (next.has(id)) next.delete(id); else next.add(id); return next;
  });
  // Bestätigung pro Person: "loesen" (Verknüpfung) oder "loeschen" (komplett)
  const [confirmId, setConfirmId] = useState(null);
  const [confirmArt, setConfirmArt] = useState(null);
  useEffect(() => {
    if (confirmId === null) return;
    const tid = setTimeout(() => { setConfirmId(null); setConfirmArt(null); }, 4000);
    return () => clearTimeout(tid);
  }, [confirmId, confirmArt]);
  const frageBestaetigung = (id, art) => {
    if (confirmId === id && confirmArt === art) {
      if (art === "loesen") {
        // Nur die Firmen-Verknüpfung der Person entfernen — Person bleibt.
        setKontakte(prev => prev.map(p => {
          if (p.id !== id) return p;
          return { ...p, firmaId: null,
            objektZuweisungen: (p.objektZuweisungen||[]).filter(z => !(z.firmaId===firma.id && !z.objektId)),
            firmenRollen: (p.firmenRollen||[]).filter(f => f.firmaId !== firma.id) };
        }));
      } else {
        // Person komplett aus AllesDa entfernen.
        setKontakte(prev => prev.filter(p => p.id !== id));
      }
      setConfirmId(null); setConfirmArt(null);
    } else {
      setConfirmId(id); setConfirmArt(art);
    }
  };
  const handleAdd = (daten) => {
    if (daten.typ === "neu") {
      const maxId = kontakte.reduce((m,x) => x.id > m ? x.id : m, 0);
      const name = [daten.person.vorname, daten.person.nachname].filter(Boolean).join(" ") || "(ohne Name)";
      setKontakte(prev => [...prev, { id: maxId+1, typ:"person", vorname:daten.person.vorname,
        nachname:daten.person.nachname, name, tels:daten.person.tels||[], emails:daten.person.emails||[],
        firmaId:firma.id, rollen:[], objektZuweisungen:[{ firmaId:firma.id, rolle:daten.rolle, status:daten.status }] }]);
    } else {
      setKontakte(prev => prev.map(p => {
        if (p.id !== daten.kontaktId) return p;
        const ohneAlt = (p.objektZuweisungen||[]).filter(z => !(z.firmaId && !z.objektId && z.firmaId !== firma.id));
        return { ...p, firmaId:firma.id, objektZuweisungen:[...ohneAlt, { firmaId:firma.id, rolle:daten.rolle, status:daten.status }] };
      }));
    }
    setAddMitarbeiterOffen(false);
  };
  return (
    <div style={{ marginTop:10, paddingTop:10, borderTop:`1px solid ${t.border}40` }}>
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:6 }}>
        <div style={{ fontSize: FS.s, fontWeight: FW.bold, color:t.sub, textTransform:"uppercase", letterSpacing:"0.1em" }}>
          Mitarbeiter ({mitarbeiter.length})
        </div>
        {editMode && (
          <button onClick={() => setAddMitarbeiterOffen(true)}
            style={{ fontSize: FS.s, padding:"3px 10px", background:farbe+"20", color:farbe,
              border:"none", borderRadius: RAD.sm, cursor:"pointer", fontFamily:"inherit", fontWeight: FW.medium }}>
            + Person hinzufügen
          </button>
        )}
      </div>
      {mitarbeiter.length === 0 ? (
        <div style={{ fontSize: FS.s, color:t.muted, fontStyle:"italic", padding:"6px 0" }}>Noch keine Mitarbeiter.</div>
      ) : (
        <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
          {mitarbeiter.map(m => {
            const p = m.person;
            const offen = offeneIds.has(p.id);
            const tels = (p.tels || []).filter(x => x && x.nr);
            const emails = (p.emails || []).filter(x => x && x.email);
            const adresse = [p.strasse, joinPlzOrt(p.plz, p.ort) || p.plzOrt].filter(Boolean).join(", ");
            return (
              <div key={p.id} style={{ display:"flex", alignItems:"stretch", gap:6 }}>
                <div style={{ flex:1, minWidth:0,
                  border: offen ? `1px solid ${farbe}` : "none",
                  borderRadius: offen ? RAD.lg : 0,
                  overflow: offen ? "hidden" : "visible",
                  transition:"all 0.15s" }}>
                  <KontaktKarte k={p} t={t} aktiv={offen} ohneRahmen={offen} onClick={() => toggleOffen(p.id)}/>
                  {offen && (
                    <div style={{ padding:"0 12px 10px 12px", background:t.surface }}>
                      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit, minmax(140px, 1fr))", gap:10 }}>
                        {m.rolle && (
                          <div>
                            <div style={{ fontSize: FS.xs, color:t.muted, fontWeight: FW.medium, textTransform:"uppercase", letterSpacing:"0.05em", marginBottom:2 }}>Rolle in Firma</div>
                            <div style={{ fontSize: FS.m, color:t.text }}>{m.rolle}{m.status && m.status!=="aktiv" ? ` · ${m.status}` : ""}</div>
                          </div>
                        )}
                        {tels.map((tt,i) => (
                          <div key={"t"+i}>
                            <div style={{ fontSize: FS.xs, color:t.muted, fontWeight: FW.medium, textTransform:"uppercase", letterSpacing:"0.05em", marginBottom:2 }}>{tt.typ || "Telefon"}</div>
                            <div style={{ fontSize: FS.m, color:t.text }}>{tt.nr}</div>
                          </div>
                        ))}
                        {emails.map((ee,i) => (
                          <div key={"e"+i}>
                            <div style={{ fontSize: FS.xs, color:t.muted, fontWeight: FW.medium, textTransform:"uppercase", letterSpacing:"0.05em", marginBottom:2 }}>{ee.typ || "E-Mail"}</div>
                            <div style={{ fontSize: FS.m, color:t.text, overflow:"hidden", textOverflow:"ellipsis" }}>{ee.email}</div>
                          </div>
                        ))}
                        {adresse && (
                          <div>
                            <div style={{ fontSize: FS.xs, color:t.muted, fontWeight: FW.medium, textTransform:"uppercase", letterSpacing:"0.05em", marginBottom:2 }}>Adresse</div>
                            <div style={{ fontSize: FS.m, color:t.text }}>{adresse}</div>
                          </div>
                        )}
                      </div>
                      {/* Eigene Felder — nur Anzeige (Bearbeitung nur im Kontakt selbst) */}
                      {p.customFelder && p.customFelder.length > 0 && (
                        <div style={{ marginTop:10 }}>
                          <CustomFelderSektion
                            felder={p.customFelder}
                            onChange={() => {}}
                            editMode={false} t={t} accent={farbe} embedded/>
                        </div>
                      )}
                      {/* Notizen — immer editierbar (außer anonymisiert §26.5) */}
                      {!p.anonymisiert && (
                      <div style={{ marginTop:10 }}>
                        <NotizenSektion
                          wert={p.notizen || ""}
                          onChange={neu => setKontakte(prev => prev.map(x => x.id===p.id ? {...x, notizen:neu} : x))}
                          t={t} accent={farbe} embedded/>
                      </div>
                      )}
                      <div style={{ marginTop:10, display:"flex", justifyContent:"flex-end" }}>
                        {onKontaktClick && (
                          <button onClick={(e) => { e.stopPropagation(); onKontaktClick(p.id); }}
                            style={{ fontSize: FS.s, padding:"5px 12px", background:farbe+"18",
                              color:farbe, border:`1px solid ${farbe}40`, borderRadius: RAD.sm,
                              cursor:"pointer", fontWeight: FW.medium, fontFamily:"inherit",
                              display:"inline-flex", alignItems:"center", gap:5 }}>
                            Zum Kontakt
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
                {editMode && (
                  <ZeilenAktionen t={t}
                    onLoesen={() => frageBestaetigung(p.id, "loesen")}
                    onLoeschen={(dsgvoEinstufung(p) === "rot" || p.anonymisiert) ? null : () => frageBestaetigung(p.id, "loeschen")}
                    confirmLoesen={confirmId===p.id && confirmArt==="loesen"}
                    confirmLoeschen={confirmId===p.id && confirmArt==="loeschen"}
                    loesenTitle="Verknüpfung zur Firma lösen (Kontakt bleibt bestehen)"
                    loeschenTitle="Kontakt löschen (alle Daten werden gelöscht)"/>
                )}
              </div>
            );
          })}
        </div>
      )}
      {addMitarbeiterOffen && (
        <AddMitarbeiterModal firma={firma} kontakte={kontakte} t={t} accent={farbe}
          onClose={() => setAddMitarbeiterOffen(false)} onSave={handleAdd}/>
      )}
    </div>
  );
}

function KDKVererbungSektion({ k, t, ves, kontakte, onVEClick }) {
  const PRIO = { aktiv:3, werdend:2, ehemalig:1 };
  const labelOf = n => n===3?"aktiv":n===2?"werdend":"ehemalig";
  const colorOf = n => n===3?"#22C55E":n===2?"#F59E0B":"#94A3B8";
  const [offenIdx, setOffenIdx] = useState(() => new Set());
  const toggle = (i) => setOffenIdx(prev => {
    const next = new Set(prev); if (next.has(i)) next.delete(i); else next.add(i); return next;
  });
  const firmenSlots = (k.objektZuweisungen||[]).filter(z => z.firmaId);
  if (firmenSlots.length === 0) return null;
  const abgeleitet = [];
  firmenSlots.forEach(z => {
    const firma = (kontakte||[]).find(c => c.id===z.firmaId);
    if (!firma) return;
    const personStatusN = PRIO[z.status||"aktiv"];
    (firma.objektZuweisungen||[]).forEach(fz => {
      const minN = Math.min(personStatusN, PRIO[fz.status||"aktiv"]);
      const ve = (ves||[]).find(x => x.id===fz.objektId);
      if (!ve) return;
      abgeleitet.push({ firma, ve, firmaRolle:fz.rolle, status:labelOf(minN), statusN:minN });
    });
  });
  if (abgeleitet.length === 0) return null;
  return (
    <div style={{ marginTop:10, paddingTop:10, borderTop:`1px solid ${t.border}40` }}>
      <div style={{ fontSize: FS.xs, fontWeight: FW.bold, color:t.muted, textTransform:"uppercase",
        letterSpacing:"0.1em", marginBottom:6 }}>Abgeleitet über Firma</div>
      {abgeleitet.map((a,i) => {
        const offen = offenIdx.has(i);
        return (
          <div key={i} style={{ background:offen ? t.card : t.surface,
            border:`1px solid ${offen ? a.firma && t.border : t.border}`,
            borderRadius: RAD.ms, marginBottom:4, overflow:"hidden", transition:"all 0.15s" }}>
            {/* Header: klickbar zum Aufklappen (bleibt im Kontakt) */}
            <div onClick={() => toggle(i)} style={{ cursor:"pointer",
              padding:"6px 10px", display:"flex", alignItems:"center", gap:8 }}>
              <div style={{ flex:1, minWidth:0, display:"flex", flexDirection:"column", gap:1 }}>
                <span style={{ fontSize: FS.m, fontWeight: FW.medium, color:t.text }}>{a.ve.nr} · {a.firmaRolle}</span>
                <span style={{ fontSize: FS.xs, color:t.muted }}>über {a.firma.name}</span>
              </div>
              <span style={{ fontSize: FS.xxs, padding:"2px 7px", borderRadius: RAD.ml,
                background:colorOf(a.statusN)+"22", color:colorOf(a.statusN), fontWeight: FW.medium }}>{a.status}</span>
            </div>
            {/* Body: mehr Info + expliziter Zum-Objekt-Button */}
            {offen && (
              <div style={{ padding:"8px 10px", borderTop:`1px solid ${t.border}` }}>
                <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit, minmax(120px, 1fr))", gap:8 }}>
                  <div>
                    <div style={{ fontSize: FS.xs, color:t.muted, fontWeight: FW.medium, textTransform:"uppercase", letterSpacing:"0.05em", marginBottom:2 }}>Objekt</div>
                    <div style={{ fontSize: FS.m, color:t.text }}>{a.ve.nr}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: FS.xs, color:t.muted, fontWeight: FW.medium, textTransform:"uppercase", letterSpacing:"0.05em", marginBottom:2 }}>Adresse</div>
                    <div style={{ fontSize: FS.m, color:t.text }}>{a.ve.adresse || "—"}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: FS.xs, color:t.muted, fontWeight: FW.medium, textTransform:"uppercase", letterSpacing:"0.05em", marginBottom:2 }}>Über Firma</div>
                    <div style={{ fontSize: FS.m, color:t.text }}>{a.firma.name}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: FS.xs, color:t.muted, fontWeight: FW.medium, textTransform:"uppercase", letterSpacing:"0.05em", marginBottom:2 }}>Leistung</div>
                    <div style={{ fontSize: FS.m, color:t.text }}>{a.firmaRolle}</div>
                  </div>
                </div>
                {onVEClick && (
                  <div style={{ marginTop:8, display:"flex", justifyContent:"flex-end" }}>
                    <button onClick={(e) => { e.stopPropagation(); onVEClick(a.ve.id); }}
                      style={{ fontSize: FS.s, padding:"5px 12px", background:t.muted+"18",
                        color:t.text, border:`1px solid ${t.border}`, borderRadius: RAD.sm,
                        cursor:"pointer", fontWeight: FW.medium, fontFamily:"inherit",
                        display:"inline-flex", alignItems:"center", gap:5 }}>
                      Zum Objekt
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── KontaktDetailKarte (aufgeklappte Detail-Karte mit Edit-Modus) ───────────
// Funktioniert für Personen UND Firmen. Bei Firmen werden die Stammdaten anders
// editiert (Firmenname statt Vor-/Nachname) und es werden Firmen-Rollen
// (Hausverwaltung, Hausmeister, Wartung …) statt Personen-Rollen angeboten.
// Eingebettete Detail-Karte des vertretenen Kontakts (Quelle "vertretung-ein").
function VertretungDetail({ z, ves, kontakte, setKontakte, onKontaktClick, t, zAkzent }) {
  const zielK = (kontakte || []).find(c => String(c.id) === String(z.zielKontaktId));
  if (!zielK) return (
    <div style={{ padding: "10px 12px", fontSize: FS.s, color: t.muted }}>Verknüpfter Kontakt nicht gefunden.</div>
  );
  return (
    <div style={{ padding: "0 10px 10px 10px" }}>
      <KontaktDetailKarte k={zielK} t={t} accent={zAkzent}
        ves={ves || []} kontakte={kontakte} setKontakte={setKontakte}
        onUpdate={(updated) => setKontakte && setKontakte(prev =>
          prev.map(c => c.id === zielK.id ? updated : c))}
        onGotoKontakt={(id) => onKontaktClick && onKontaktClick(id)}
        onKontaktClick={onKontaktClick}
        embedded/>
    </div>
  );
}

function KontaktDetailKarte({ k, t, accent, ves, kontakte, onVEClick, onUpdate, onDelete, onLoesen = null, onKontaktClick, setKontakte, objektFilter = null, onGotoKontakt = null, kategorieFarbe = null,
  externEditMode, setExternEditMode, headerOhneEditBtn: headerOhneEditBtnProp = false, listenModus = false, ohneObjekte: ohneObjekteProp = false, onKopfClick = null, zeigeGotoFooter: zeigeGotoFooterProp = false, nurStammdaten = false, embedded = false, extraFooter = null }) {
  // VEREINHEITLICHTE EINBETTUNG: Eine einzige Prop `embedded` steuert das
  // gesamte „eingebettete" Verhalten, damit neue Einbettungsstellen nicht mehr
  // jede Flag-Kombination einzeln setzen müssen:
  //   · kein Header-Edit-Button (read-only; bearbeitet wird nur die Hauptkarte)
  //   · Footer-„Zum Kontakt/Firma"-Button (statt Header-Button, der den Avatar verdeckt)
  //   · Verknüpfungs-Sektionen aus (fremde Objekte/Rollen, Vollmacht, Vererbung)
  //     — AUSSER im Objekt-Kontext (objektFilter), wo die objektbezogene Rolle
  //     bewusst sichtbar bleibt.
  //   · Firmen behalten ihre Mitarbeiter (hängt an istFirma && setKontakte).
  // Die Einzel-Props bleiben als Override bestehen (Rückwärtskompatibilität).
  // ANONYMISIERT (§26.5): Karte ist komplett schreibgeschützt — editMode wird
  // hart auf false gezwungen (egal ob intern oder extern gesteuert) und der
  // Header-Stift verschwindet. MUSS vor headerOhneEditBtn stehen (TDZ).
  const gesperrt = !!(k && k.anonymisiert);
  const headerOhneEditBtn = headerOhneEditBtnProp || embedded || gesperrt;
  const ohneObjekte        = ohneObjekteProp || (embedded && !objektFilter);
  const zeigeGotoFooter    = zeigeGotoFooterProp || (embedded && !!onGotoKontakt);
  const personenRollen = useRollen();
  const firmenRollen = useFirmenRollen();
  const [internEditMode, setInternEditMode] = useState(false);
  // Wenn von außen kontrolliert (Mobile: Bearbeiten-Toggle sitzt im
  // Sticky-Header), nutzen wir externEditMode; sonst eigenen State.
  const editMode    = gesperrt ? false : ((typeof externEditMode === "boolean") ? externEditMode : internEditMode);
  const setEditMode = setExternEditMode ? setExternEditMode : setInternEditMode;
  const [edit, setEdit] = useState(k);
  const [neueRolleForm, setNeueRolleForm] = useState(false);
  const [neueVollmachtForm, setNeueVollmachtForm] = useState(false);
  const [editRolleIdx, setEditRolleIdx] = useState(null);
  // Welche Rollen-Zuweisung ist aufgeklappt (Index in zuweisungen)
  // Welche Rollen sind aufgeklappt — als Set, damit MEHRERE gleichzeitig
  // offen sein können (Benny will Eigentümer + VB + ... parallel sehen).
  const [expandedRolleIdx, setExpandedRolleIdx] = useState(() => new Set());
  const toggleRolleIdx = (i) => {
    setExpandedRolleIdx(prev => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i); else next.add(i);
      return next;
    });
  };
  // Modal: Mitarbeiter hinzufügen (nur bei Firmen)
  const [addMitarbeiterOffen, setAddMitarbeiterOffen] = useState(false);
  // Eigener Workflow für "Objekt zuweisen" in der Objekte-Sektion
  const [objektZuweisungForm, setObjektZuweisungForm] = useState(false);
  // Welche Objekt-/Einheit-Karte ist ausgeklappt (Key = "veId::einheitId" oder "veId::")
  // Welche Objekt-/Einheit-Karten sind aufgeklappt — auch als Set für
  // Mehrfach-Auswahl (Key = "veId::einheitId" oder "veId::")
  const [expandedKey, setExpandedKey] = useState(() => new Set());
  const toggleKey = (key) => {
    setExpandedKey(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  };
  // Aufgeklappte Mitarbeiter (bei Firmen). Set für Multi-Aufklappen.
  // Bewusst kein Auto-Scroll beim Aufklappen von Rolle/Einheit — der
  // geklickte Eintrag bleibt an seiner Stelle, aufgeklappte Inhalte
  // erscheinen darunter.

  useEffect(() => {
    setEdit(k);
    setEditMode(false);
    setNeueRolleForm(false);
    setEditRolleIdx(null);
    setObjektZuweisungForm(false);
    // Sets bei Kontakt-Wechsel leeren (NICHT auf null setzen — sind Sets!)
    setExpandedKey(new Set());
    setExpandedRolleIdx(new Set());
  }, [k.id]);

  if (!k) return null;
  const istFirma = k.typ === "firma";
  const rolleTyp = istFirma ? "firma" : "person";
  const loeschenErlaubt = useLoeschenErlaubt();
  const kontaktFarben = useKontaktFarbe();
  // Im Objekt-Kontext (objektFilter aktiv) nutzen wir den Objekt-Akzent (cyan)
  // als Karten-Farbe für Border/Background/Edit-Button — passt zum
  // Objekt-Kontext. Im normalen Kontakt-Screen die Personen/Firmen-Farbe.
  const farbe = objektFilter ? accent : (istFirma ? kontaktFarben.firma : kontaktFarben.person);
  // Name-Farbe: im Objekt-Kontext die Kategorie-Farbe (z. B. pink für Eigentümer).
  // Sonst die Karten-Farbe.
  const nameFarbe = kategorieFarbe || farbe;

  // Verträge dieser Firma — über alle Objekte hinweg eingesammelt. Verträge
  // liegen am Objekt (ve.vertraege) und verweisen per firmaId auf die Firma;
  // hier drehen wir die Sicht um (Firma → ihre Verträge je Objekt). Nur für
  // Firmen und nur außerhalb des Objekt-Kontexts (im Objekt zeigt die
  // Liegenschaft ihre Verträge ohnehin selbst).
  const firmenVertraege = (istFirma && !objektFilter)
    ? (ves || []).flatMap(v =>
        ((v.karten || []).concat(v.verwaltungsKarten || [])
          .flatMap(ka => (ka.vertraege || []))
          .concat(v.vertraege || []))
          .filter(vt => vt && vt.firmaId != null && String(vt.firmaId) === String(k.id))
          .map(vt => ({ vertrag: vt, ve: v })))
    : [];

  // Schreib-Handler (1c): flache Editor-Einträge in die drei neuen Felder
  // einsortieren. Da die alten Editoren weiter flache {rolle,status,objektId,…}
  // liefern, nutzt klassifiziereZuweisung dieselbe Logik wie die Migration.
  const schreibeNeu = (besitz, zustaendigkeiten, firmenRollen) => {
    setEdit({ ...edit, besitz, zustaendigkeiten, firmenRollen });
  };
  const neueListen = () => ({
    besitz: [...(Array.isArray(edit.besitz) ? edit.besitz : [])],
    zustaendigkeiten: [...(Array.isArray(edit.zustaendigkeiten) ? edit.zustaendigkeiten : [])],
    firmenRollen: [...(Array.isArray(edit.firmenRollen) ? edit.firmenRollen : [])],
  });
  const einsortieren = (listen, zuw, vorne) => {
    const c = klassifiziereZuweisung(zuw, edit.typ);
    if (!c) return listen;
    // Neue Einträge oben (unshift); bearbeitete hinten anhängen (push).
    const ziel = c.kat === "besitz" ? listen.besitz
      : c.kat === "zustaendigkeit" ? listen.zustaendigkeiten
      : c.kat === "firmenrolle" ? listen.firmenRollen : null;
    if (ziel) { if (vorne) ziel.unshift(c.eintrag); else ziel.push(c.eintrag); }
    return listen;
  };
  const addRolle = (zuw) => {
    // Race-sicher: funktionales Update, damit mehrere synchrone Aufrufe
    // (z. B. eine Beziehung über mehrere Einheiten) sich akkumulieren statt
    // sich gegenseitig zu überschreiben.
    setEdit(prev => {
      const listen = {
        besitz: [...(Array.isArray(prev.besitz) ? prev.besitz : [])],
        zustaendigkeiten: [...(Array.isArray(prev.zustaendigkeiten) ? prev.zustaendigkeiten : [])],
        firmenRollen: [...(Array.isArray(prev.firmenRollen) ? prev.firmenRollen : [])],
      };
      const c = klassifiziereZuweisung(zuw, prev.typ);
      if (c) {
        const ziel = c.kat === "besitz" ? listen.besitz
          : c.kat === "zustaendigkeit" ? listen.zustaendigkeiten
          : c.kat === "firmenrolle" ? listen.firmenRollen : null;
        if (ziel) ziel.unshift(c.eintrag);
      }
      return { ...prev, besitz: listen.besitz, zustaendigkeiten: listen.zustaendigkeiten, firmenRollen: listen.firmenRollen };
    });
    setNeueRolleForm(false);
    // Die neue Zuweisung wird per unshift OBEN eingefügt (Index 0). Nach dem
    // Re-Render dorthin scrollen, damit der „Screen nicht stehen bleibt" und der
    // Nutzer den frisch angelegten Eintrag sieht. scrollIntoView funktioniert
    // layout-unabhängig (Window-Scroll auf Mobile, interner Container auf Desktop);
    // block:"nearest" springt nur, wenn die Zeile nicht ohnehin sichtbar ist.
    if (typeof document !== "undefined") {
      setTimeout(() => {
        const el = document.getElementById("rolle-" + k.id + "-0");
        if (el && el.scrollIntoView) el.scrollIntoView({ block: "nearest", behavior: "smooth" });
      }, 60);
    }
  };
  // updateRolle/removeRolle adressieren einen flachen Eintrag direkt über sein
  // _quelle/_idx (unabhängig vom Listen-Index, der bei Objekt-Filterung abweicht).
  const updateRolle = (ziel, zuw) => {
    const l = neueListen();
    if (ziel && ziel._quelle === "besitz") l.besitz.splice(ziel._idx, 1);
    else if (ziel && ziel._quelle === "zustaendigkeit") l.zustaendigkeiten.splice(ziel._idx, 1);
    else if (ziel && ziel._quelle === "firmenrolle") l.firmenRollen.splice(ziel._idx, 1);
    einsortieren(l, zuw);
    schreibeNeu(l.besitz, l.zustaendigkeiten, l.firmenRollen);
    setEditRolleIdx(null);
  };
  const removeRolle = (ziel) => {
    const l = neueListen();
    if (ziel && ziel._quelle === "besitz") l.besitz.splice(ziel._idx, 1);
    else if (ziel && ziel._quelle === "zustaendigkeit") l.zustaendigkeiten.splice(ziel._idx, 1);
    else if (ziel && ziel._quelle === "firmenrolle") l.firmenRollen.splice(ziel._idx, 1);
    schreibeNeu(l.besitz, l.zustaendigkeiten, l.firmenRollen);
  };
  // Patch (Status/Datum) auf mehrere flache Einträge (über _quelle/_idx) anwenden.
  const patchFlache = (flatIdxList, patch) => {
    const l = neueListen();
    flatIdxList.forEach(fi => {
      const z = alleZuweisungen[fi];
      if (!z) return;
      if (z._quelle === "besitz" && l.besitz[z._idx])
        l.besitz[z._idx] = { ...l.besitz[z._idx], ...patch };
      else if (z._quelle === "zustaendigkeit" && l.zustaendigkeiten[z._idx])
        l.zustaendigkeiten[z._idx] = { ...l.zustaendigkeiten[z._idx], ...patch };
      else if (z._quelle === "firmenrolle" && l.firmenRollen[z._idx])
        l.firmenRollen[z._idx] = { ...l.firmenRollen[z._idx], ...patch };
    });
    schreibeNeu(l.besitz, l.zustaendigkeiten, l.firmenRollen);
  };
  // Mehrere flache Einträge (über _quelle/_idx) entfernen.
  const removeFlache = (flatIdxList) => {
    const l = neueListen();
    const drop = { besitz: new Set(), zustaendigkeit: new Set(), firmenrolle: new Set() };
    flatIdxList.forEach(fi => {
      const z = alleZuweisungen[fi];
      if (z && drop[z._quelle]) drop[z._quelle].add(z._idx);
    });
    l.besitz = l.besitz.filter((_, i) => !drop.besitz.has(i));
    l.zustaendigkeiten = l.zustaendigkeiten.filter((_, i) => !drop.zustaendigkeit.has(i));
    l.firmenRollen = l.firmenRollen.filter((_, i) => !drop.firmenrolle.has(i));
    schreibeNeu(l.besitz, l.zustaendigkeiten, l.firmenRollen);
  };

  const save = () => {
    // Validierung: ungültige Eingaben blockieren das Speichern (Felder sind
    // bereits rot markiert). Edit-Modus bleibt offen, damit der User korrigiert.
    if (!kontaktAllesGueltig(edit)) return;
    // Bei Personen: Name aus Vor-/Nachname zusammenbauen
    let finalEdit = edit;
    if (!istFirma) {
      const computed = `${edit.vorname || ""} ${edit.nachname || ""}`.trim();
      finalEdit = { ...edit, name: computed || edit.name || k.name };
    }
    onUpdate(finalEdit);
    setEditMode(false); setNeueRolleForm(false); setEditRolleIdx(null);
    setObjektZuweisungForm(false);
  };
  const cancel = () => {
    setEdit(k); setEditMode(false); setNeueRolleForm(false); setEditRolleIdx(null);
    setObjektZuweisungForm(false);
  };

  // Auto-Save bei extern gesteuertem editMode-off (Mobile Sticky-Header
  // Stift→Häkchen toggelt): Änderungen direkt persistieren statt verwerfen.
  const prevExternEdit = useRef(externEditMode);
  useEffect(() => {
    if (typeof externEditMode !== "boolean") return;
    if (prevExternEdit.current === true && externEditMode === false) {
      // editMode wurde extern abgeschaltet — speichern wenn dirty UND gültig.
      // Ungültige Eingaben werden nicht persistiert (rote Markierung bleibt).
      const dirtyNow = JSON.stringify(edit) !== JSON.stringify(k);
      if (dirtyNow && kontaktAllesGueltig(edit)) {
        let finalEdit = edit;
        if (!istFirma) {
          const computed = `${edit.vorname || ""} ${edit.nachname || ""}`.trim();
          finalEdit = { ...edit, name: computed || edit.name || k.name };
        }
        onUpdate(finalEdit);
      }
      setNeueRolleForm(false); setEditRolleIdx(null); setObjektZuweisungForm(false);
    }
    prevExternEdit.current = externEditMode;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [externEditMode]);

  const alleZuweisungenRoh = flacheZuweisungen(edit);
  // Vertretungs-Vermerke (kontakt-Ziel) des Kontakts selbst sind KEINE Rollen
  // dieses Kontakts — er ist VollmachtGEBER, nicht Bevollmächtigter. Sie werden
  // separat als Vermerk gezeigt (siehe "Hat Bevollmächtigten"-Sektion).
  const eigeneVertretungsVermerke = alleZuweisungenRoh.filter(z => z.zielKontaktId != null);
  const alleZuweisungen = alleZuweisungenRoh.filter(z => z.zielKontaktId == null);
  // Eingehende Vertretungen: dieser Kontakt IST anderswo als Bevollmächtigter/
  // Betreuer benannt → das ist eine echte Rolle von IHM. Als synthetische
  // Rollenzeilen (zielKontaktId = der Vertretene) in die Rollen-Liste einspeisen.
  // _quelle "vertretung-ein" markiert sie als abgeleitet (read-only, nicht editierbar).
  const eingehendeAlsRollen = (!objektFilter ? eingehendeVertretungen(k, kontakte) : [])
    .map(v => ({ rolle: v.rolle, status: v.status, zielKontaktId: v.quelle.id,
      _quelle: "vertretung-ein", _readonly: true }));
  // Belegungs-Rollen (Mieter/Bewohner/Pächter) LIVE aus den Belegungen ableiten —
  // Quelle der Wahrheit = Belegung-Tab, KEINE Doppelpflege in den Kontaktfeldern.
  // Read-only (Edit am Belegung-Tab). Dedup gegen bereits vorhandene editierbare
  // Zeilen (Altbestand-Workaround als zustaendigkeit): gleiche objektId+einheitId+
  // rolle → die editierbare Zeile behält Vorrang, die abgeleitete entfällt.
  const belegSchluessel = new Set();
  alleZuweisungen.forEach(z => {
    if (z.objektId != null && z.einheitId != null && z.rolle)
      belegSchluessel.add(z.objektId + "|" + z.einheitId + "|" + z.rolle);
  });
  const belegungsRollen = belegungsRollenFuerKontakt(k, ves)
    .filter(z => !belegSchluessel.has(z.objektId + "|" + z.einheitId + "|" + z.rolle));
  // Im Objekt-Kontext zeigen wir NUR die Zuweisungen, die zu diesem Objekt
  // gehören. Mitarbeiter, eigene Felder, Notizen, Stammdaten gehören zum
  // Kontakt selbst und werden unverändert gezeigt.
  const zuweisungen = objektFilter
    ? [...alleZuweisungen.filter(z => z.objektId === objektFilter),
       ...belegungsRollen.filter(z => z.objektId === objektFilter)]
    : [...alleZuweisungen, ...eingehendeAlsRollen, ...belegungsRollen];
  // Objekt-Paare (Objekt + optional Einheit) aus den Zuweisungen ableiten —
  // für den Objekte-Block bei Personen ohne Objektfilter.
  const objektPaare = [];
  {
    const seenObj = new Set();
    (zuweisungen || []).forEach(z => {
      if (!z.objektId) return;
      if (seenObj.has(z.objektId)) {
        const vorh = objektPaare.find(p => p.objektId === z.objektId);
        if (vorh && !vorh.einheitId && z.einheitId) { vorh.einheitId = z.einheitId; vorh.key = `${z.objektId}::${z.einheitId}`; }
        return;
      }
      seenObj.add(z.objektId);
      objektPaare.push({ key: `${z.objektId}::${z.einheitId || ""}`, objektId: z.objektId, einheitId: z.einheitId || null });
    });
  }
  const dirty = JSON.stringify(edit) !== JSON.stringify(k);
  const gueltig = kontaktAllesGueltig(edit);
  // VE-Eintrag für Banner-Text
  const filterVE = objektFilter ? (ves || []).find(v => v.id === objektFilter) : null;

  const btnEdit = {
    display: "inline-flex", alignItems: "center", gap: 4,
    fontSize: FS.s, padding: "4px 10px", borderRadius: RAD.sm, cursor: "pointer",
    background: "transparent", border: `1px solid ${t.border}`,
    color: t.sub, fontFamily: "inherit",
  };
  const btnPrimary = {
    fontSize: FS.s, padding: "4px 12px", background: farbe, color: getContrastColor(farbe),
    border: "none", borderRadius: RAD.sm, cursor: "pointer", fontWeight: FW.medium, fontFamily: "inherit",
  };

  // Auswahl-Rahmen: in der Kontaktliste (listenModus) der Auswahl-Akzent —
  // Mehr-Farbe = Kontakt-Bereichsfarbe, Graumodus = System-Akzent. Profil,
  // eingebettete und Objekt-Kontext-Aufrufe ohne listenModus → farbe.
  const rahmen = listenModus ? (kontaktFarben.auswahlKontakt || farbe) : farbe;
  return (
    <div style={{ background: rahmen + "08", border: `1px solid ${rahmen}`,
      borderRadius: RAD.lg, padding: "12px 14px" }}>
      <div onClick={onKopfClick ? (e) => {
          // Nur einklappen, wenn nicht auf ein interaktives Element geklickt wurde.
          let n = e.target;
          while (n && n !== e.currentTarget) {
            const tag = (n.tagName || "").toLowerCase();
            if (tag === "a" || tag === "button" || tag === "input" ||
                tag === "textarea" || tag === "select") return;
            n = n.parentNode;
          }
          onKopfClick();
        } : undefined}
        style={onKopfClick ? { cursor: "pointer" } : undefined}>
        <KDKHeader k={k} t={t} farbe={farbe} nameFarbe={nameFarbe}
          istFirma={istFirma} editMode={editMode} dirty={dirty} gueltig={gueltig}
          headerOhneEditBtn={headerOhneEditBtn} objektFilter={objektFilter}
          onGotoKontakt={onGotoKontakt} onEdit={() => setEditMode(true)}
          onSave={save} onCancel={cancel}
          onDelete={onDelete} onUpdate={onUpdate}
          edit={edit} setEdit={setEdit}/>
        <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit, minmax(260px, 1fr))",
          gap:12, marginBottom:12 }}>
          <KDKStammdatenBlock edit={edit} setEdit={setEdit} t={t} farbe={farbe}
            editMode={editMode} istFirma={istFirma}/>
          <CustomFelderSektion
            felder={editMode ? (edit.customFelder||[]) : (k.customFelder||[])}
            onChange={neueFelder => {
              if (editMode) setEdit({...edit, customFelder:neueFelder});
              else onUpdate({...k, customFelder:neueFelder});
            }}
            editMode={editMode} t={t} accent={farbe} embedded/>
        </div>
      </div>
      <div style={{ marginBottom:12 }}>
        <NotizenSektion
          wert={editMode ? (edit.notizen||"") : (k.notizen||"")}
          onChange={neu => {
            if (editMode) setEdit({...edit, notizen:neu});
            else onUpdate({...k, notizen:neu});
          }}
          t={t} accent={farbe} embedded/>
      </div>
      {istFirma && setKontakte && (
        <KDKMitarbeiterSektion firma={k} t={t} farbe={farbe} editMode={editMode}
          kontakte={kontakte} setKontakte={setKontakte} onKontaktClick={onKontaktClick}
          addMitarbeiterOffen={addMitarbeiterOffen} setAddMitarbeiterOffen={setAddMitarbeiterOffen}/>
      )}
      {!ohneObjekte && (
      <div style={{ marginTop:10, paddingTop:10, borderTop:`1px solid ${t.border}40` }}>
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:6 }}>
          <div style={{ fontSize: FS.s, fontWeight: FW.bold, color:t.sub, textTransform:"uppercase", letterSpacing:"0.1em" }}>
            {istFirma ? `Objekte (${zuweisungen.length})` : `Rollen (${zuweisungen.length})`}
          </div>
          {editMode && !neueRolleForm && editRolleIdx === null && (
            <button onClick={() => setNeueRolleForm(true)}
              style={{ fontSize: FS.s, padding:"3px 10px", background:farbe+"20", color:farbe,
                border:"none", borderRadius: RAD.sm, cursor:"pointer", fontFamily:"inherit", fontWeight: FW.medium, whiteSpace:"nowrap" }}>
              {istFirma ? "+ Objekt" : "+ Rolle"}
            </button>
          )}
        </div>
        {neueRolleForm && (
          <div style={{ marginBottom: 8 }}>
            <BeziehungEditor initial={{}} ves={ves} kontakte={kontakte} t={t} accent={farbe} typ={rolleTyp} lockObjektId={objektFilter} selbstId={k.id}
              onCancel={() => setNeueRolleForm(false)} onSave={addRolle}/>
          </div>
        )}
        {zuweisungen.length === 0 && !neueRolleForm && (
          <div style={{ fontSize: FS.s, color:t.muted, fontStyle:"italic", padding:"6px 0" }}>
            {istFirma ? "Keine Objekte zugewiesen." : "Keine Rollen zugewiesen."}
          </div>
        )}
        {zuweisungen.length > 0 && (
          <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
            {zuweisungen.map((z,i) => {
              if (editRolleIdx === i) return (
                <div key={"e"+i}>
                  <BeziehungEditor initial={z} ves={ves} kontakte={kontakte} t={t} accent={farbe} typ={rolleTyp} lockObjektId={objektFilter} selbstId={k.id}
                    onCancel={() => setEditRolleIdx(null)} onSave={zuw => updateRolle(z, zuw)}/>
                </div>
              );
              const offen = expandedRolleIdx.has(i);
              const rolleDef = (rolleTyp==="firma" ? firmenRollen : personenRollen).find(r => r.name===z.rolle);
              const zAkzent = (rolleDef && rolleDef.color) || farbe;
              const zMitKontakt = { ...z, kontaktId:k.id };
              return (
                <div key={i} style={{ display:"flex", alignItems:"stretch", gap:6 }}>
                  <div style={{ flex:1, minWidth:0, background:offen?zAkzent+"08":t.card,
                    border:`1px solid ${offen?zAkzent:t.border}`, borderRadius: RAD.ml, overflow:"hidden", transition:"all 0.15s" }}>
                    <RolleZeile z={z} ves={ves} kontakte={kontakte} editMode={editMode}
                      t={t} accent={farbe} typ={rolleTyp} aktiv={offen} embedded
                      id={"rolle-"+k.id+"-"+i} onClick={() => toggleRolleIdx(i)}/>
                    {offen && (
                      <div>
                        {z._quelle === "vertretung-ein" ? (
                          <VertretungDetail z={z} ves={ves} kontakte={kontakte}
                            setKontakte={setKontakte} onKontaktClick={onKontaktClick} t={t} zAkzent={zAkzent}/>
                        ) : (
                          <RolleDetailBox z={zMitKontakt} ves={ves} kontakte={kontakte}
                            t={t} accent={zAkzent} typ={rolleTyp} embedded onVEClick={onVEClick} aktuellesObjektId={objektFilter}/>
                        )}
                      </div>
                    )}
                  </div>
                  {editMode && !z._readonly && (
                    <ZeilenAktionen t={t}
                      onEdit={() => setEditRolleIdx(i)}
                      onLoesen={() => removeRolle(z)}
                      loesenTitle="Rolle entfernen"/>
                  )}
                </div>
              );
            })}
          </div>
        )}
        {!objektFilter && !istFirma && !(objektPaare.length === 0 && !editMode) && (
            <div style={{ marginTop:10, paddingTop:10, borderTop:`1px solid ${t.border}40` }}>
              <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:6 }}>
                <div style={{ fontSize: FS.s, fontWeight: FW.bold, color:t.sub, textTransform:"uppercase", letterSpacing:"0.1em" }}>
                  Objekte ({objektPaare.length})
                </div>
                {editMode && !objektZuweisungForm && (
                  <button onClick={() => setObjektZuweisungForm(true)}
                    style={{ fontSize: FS.s, padding:"3px 10px", background:farbe+"20", color:farbe,
                      border:"none", borderRadius: RAD.sm, cursor:"pointer", fontFamily:"inherit", fontWeight: FW.medium, whiteSpace:"nowrap" }}>
                    + Objekt
                  </button>
                )}
              </div>
              {objektZuweisungForm && (
                <div style={{ marginBottom: 8 }}>
                  <BeziehungEditor initial={{}} ves={ves} kontakte={kontakte} t={t} accent={farbe} typ={rolleTyp} lockObjektId={objektFilter}
                    onCancel={() => setObjektZuweisungForm(false)}
                    onSave={zuw => { addRolle(zuw); setObjektZuweisungForm(false); }}/>
                </div>
              )}
              {objektPaare.length === 0 && !objektZuweisungForm ? (
                <div style={{ fontSize: FS.s, color:t.muted, fontStyle:"italic", padding:"6px 0" }}>Noch keinem Objekt zugewiesen.</div>
              ) : (
                <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
                  {objektPaare.map(p => {
                    const v = (ves||[]).find(x => x.id===p.objektId);
                    if (!v) return null;
                    const einheit = p.einheitId ? v.einheiten.find(x => x.id===p.einheitId) : null;
                    const offen = expandedKey.has(p.key);
                    const matchIdx = alleZuweisungen.map((z,i) => ({z,i}))
                      .filter(({z}) => z.objektId===p.objektId && (z.einheitId||null)===(p.einheitId||null)).map(({i}) => i);
                    const matchZuweisungen = matchIdx.map(i => alleZuweisungen[i]);
                    const removeVerknuepfung = () => removeFlache(matchIdx);
                    const oneRolle = matchIdx.length === 1;
                    const bearbeiten = () => { if (oneRolle) setEditRolleIdx(matchIdx[0]); };
                    const handleZuweisungUpdate = patch => patchFlache(matchIdx, patch);
                    return (
                      <div key={p.key} style={{ display:"flex", alignItems:"stretch", gap:6 }}>
                        <div style={{ flex:1, minWidth:0 }}>
                          {editMode ? (
                            <ObjektZeile ve={v} einheit={einheit} zuweisungen={matchZuweisungen}
                              t={t} accent={kontaktFarben.objekt} editMode={editMode} aktiv={offen} oneRolle={oneRolle}
                              onClick={() => toggleKey(p.key)}
                              onZuweisungUpdate={handleZuweisungUpdate}
                              onGoto={onVEClick ? () => onVEClick(v.id) : null}/>
                          ) : einheit ? (
                            <FeldEinheitKarte ve={v} einheit={einheit} t={t} accent={kontaktFarben.objekt}
                              onVEClick={onVEClick ? () => onVEClick(v.id) : null}/>
                          ) : (
                            <FeldObjektKarte ve={v} t={t} accent={kontaktFarben.objekt}
                              kontakte={kontakte}
                              onVEClick={onVEClick ? () => onVEClick(v.id) : null}/>
                          )}
                        </div>
                        {editMode && (
                          <ZeilenAktionen t={t}
                            onEdit={oneRolle ? bearbeiten : null}
                            onLoesen={removeVerknuepfung}
                            loesenTitle={matchZuweisungen.length > 1
                              ? `Verknüpfung lösen (${matchZuweisungen.length} Rollen werden entfernt)`
                              : "Verknüpfung lösen"}/>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
        )}
      </div>
      )}
      {istFirma && !objektFilter && !ohneObjekte && firmenVertraege.length > 0 && (
        <div style={{ marginTop:10, paddingTop:10, borderTop:`1px solid ${t.border}40` }}>
          <div style={{ fontSize: FS.s, fontWeight: FW.bold, color:t.sub,
            textTransform:"uppercase", letterSpacing:"0.1em", marginBottom:6 }}>
            Verträge ({firmenVertraege.length})
          </div>
          <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
            {firmenVertraege.map(({ vertrag, ve }) => (
              <div key={ve.id + "::" + vertrag.id}>
                <button onClick={onVEClick ? () => onVEClick(ve.id) : null}
                  style={{ display:"flex", alignItems:"center", gap:6, width:"100%",
                    background:"none", border:"none", padding:"0 0 3px 0",
                    cursor:onVEClick?"pointer":"default", fontFamily:"inherit", textAlign:"left" }}>
                  <I name="building" size={11} color={kontaktFarben.objekt}/>
                  <span style={{ fontSize: FS.xs, fontWeight: FW.medium, color:kontaktFarben.objekt }}>
                    {ve.nr || ve.adresse || "Objekt"}
                  </span>
                </button>
                <VertragZeile v={vertrag} firma={k} t={t} accent={farbe}
                  editMode={false} onKontaktClick={onKontaktClick}
                  kontakte={kontakte} setKontakte={setKontakte} ves={ves}/>
              </div>
            ))}
          </div>
        </div>
      )}
      {!istFirma && !editMode && !ohneObjekte && (
        <KDKVererbungSektion k={k} t={t} ves={ves} kontakte={kontakte} onVEClick={onVEClick}/>
      )}
      {!ohneObjekte && !objektFilter && eigeneVertretungsVermerke.length > 0 && (
          <div style={{ marginTop: 10, paddingTop: 10, borderTop: `1px solid ${t.border}40` }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
              <div style={{ fontSize: FS.s, fontWeight: FW.bold, color: t.sub,
                textTransform: "uppercase", letterSpacing: "0.1em" }}>
                Hat Bevollmächtigten ({eigeneVertretungsVermerke.length})
              </div>
              {editMode && !neueVollmachtForm && (
                <button onClick={() => setNeueVollmachtForm(true)}
                  style={{ fontSize: FS.s, padding: "3px 10px", background: farbe + "20", color: farbe,
                    border: "none", borderRadius: RAD.sm, cursor: "pointer", fontFamily: "inherit", fontWeight: FW.medium , whiteSpace: "nowrap" }}>
                  + Bevollmächtigten
                </button>
              )}
            </div>
            {editMode && neueVollmachtForm && (
              <div style={{ marginBottom: 8 }}>
                <BeziehungEditor initial={{ rolle: "Bevollmächtigter", _vollmachtModus: true }}
                  ves={ves} kontakte={kontakte} setKontakte={setKontakte} t={t} accent={farbe} typ={rolleTyp} selbstId={k.id}
                  onCancel={() => setNeueVollmachtForm(false)}
                  onSave={zuw => { addRolle(zuw); setNeueVollmachtForm(false); }}/>
              </div>
            )}
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {eigeneVertretungsVermerke.map((z, i) => {
                const zielK = (kontakte || []).find(c => String(c.id) === String(z.zielKontaktId));
                return (
                  <BevollmaechtigterKarte key={i} zielKontakt={zielK}
                    rolle={z.rolle} status={z.status} t={t} accent={farbe}
                    ves={ves} kontakte={kontakte} setKontakte={setKontakte}
                    onKontaktClick={onKontaktClick} editMode={editMode}
                    onLoesen={() => removeRolle(z)}/>
                );
              })}
            </div>
          </div>
      )}
      {!ohneObjekte && !objektFilter && eigeneVertretungsVermerke.length === 0 && editMode && (
        <div style={{ marginTop: 10, paddingTop: 10, borderTop: `1px solid ${t.border}40` }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
            <div style={{ fontSize: FS.s, fontWeight: FW.bold, color: t.sub,
              textTransform: "uppercase", letterSpacing: "0.1em" }}>
              Hat Bevollmächtigten
            </div>
            {!neueVollmachtForm && (
              <button onClick={() => setNeueVollmachtForm(true)}
                style={{ fontSize: FS.s, padding: "3px 10px", background: farbe + "20", color: farbe,
                  border: "none", borderRadius: RAD.sm, cursor: "pointer", fontFamily: "inherit", fontWeight: FW.medium , whiteSpace: "nowrap" }}>
                + Bevollmächtigten
              </button>
            )}
          </div>
          {neueVollmachtForm && (
            <BeziehungEditor initial={{ rolle: "Bevollmächtigter", _vollmachtModus: true }}
              ves={ves} kontakte={kontakte} setKontakte={setKontakte} t={t} accent={farbe} typ={rolleTyp} selbstId={k.id}
              onCancel={() => setNeueVollmachtForm(false)}
              onSave={zuw => { addRolle(zuw); setNeueVollmachtForm(false); }}/>
          )}
        </div>
      )}
      {((zeigeGotoFooter && onGotoKontakt) || extraFooter) && !editMode && (
        <div style={{ marginTop: 12, display: "flex", alignItems: "center",
          justifyContent: "space-between", gap: 8 }}>
          <div>{extraFooter}</div>
          {zeigeGotoFooter && onGotoKontakt ? (
            <button onClick={() => onGotoKontakt(k.id)}
              style={{ fontSize: FS.s, padding: "6px 12px", background: farbe + "15", color: farbe,
                border: `1px solid ${farbe}40`, borderRadius: RAD.sm, cursor: "pointer",
                fontWeight: FW.medium, fontFamily: "inherit", display: "inline-flex",
                alignItems: "center", gap: 5 }}>
              {istFirma ? "Zur Firma" : "Zum Kontakt"}
            </button>
          ) : <span/>}
        </div>
      )}
      {/* DSGVO-Bereich: nur im vollständigen Profil (nicht eingebettet, kein
          Objekt-Filter), nur im Lese-Modus. Auskunfts-PDF immer; abgestufte
          Löschung nur bei Personen und freigeschaltetem Lösch-Schalter. */}
      {!embedded && !objektFilter && !editMode && (
        <KontaktDsgvoAktionen kontakt={k} ves={ves} t={t} accent={farbe}
          onDelete={(!istFirma && onDelete) ? onDelete : null}
          onAnonymisieren={(!istFirma && setKontakte)
            ? () => setKontakte(prev => prev.map(x => x.id === k.id ? anonymisiereKontakt(x) : x))
            : null}
          loeschenErlaubt={loeschenErlaubt.kontakte}/>
      )}
    </div>
  );
}
// ── BevollmaechtigterKarte ───────────────────────────────────────────────────
// Eine Zeile in der "Hat Bevollmächtigten"-Sektion: eingeklappt als kompakte
// KontaktKarte, aufgeklappt als vollständige (eingebettete) Detailkarte des
// Bevollmächtigten — analog zu VertragFirmaKarte. "onGotoKontakt" führt zur
// Hauptkarte. Der Status-Chip (aktiv/ehemalig) der Vollmacht wird oben gezeigt.
function BevollmaechtigterKarte({ zielKontakt, rolle, status, t, accent, ves, kontakte, setKontakte, onKontaktClick, editMode, onLoesen }) {
  const [offen, setOffen] = useState(false);
  const rollenDefs = useRollen();
  const firmenRollenDefs = useFirmenRollen();
  const ehem = (status || "aktiv") === "ehemalig";
  const rd = rollenDefs.find(r => r.name === rolle) || firmenRollenDefs.find(r => r.name === rolle);
  const rc = ehem ? t.muted : ((rd && rd.color) || accent);
  if (!zielKontakt) {
    return (
      <div style={{ display: "flex", alignItems: "center", gap: 8, background: t.surface,
        border: `1px solid ${t.border}`, borderRadius: RAD.md, padding: "9px 11px", color: t.muted }}>
        <I name="user" size={12} color={t.muted}/> Unbekannter Kontakt
        {editMode && onLoesen && (
          <button onClick={onLoesen} title="Entfernen"
            style={{ marginLeft: "auto", background: "none", border: "none", cursor: "pointer", padding: 2 }}>
            <I name="x" size={13} color="#EF4444"/>
          </button>
        )}
      </div>
    );
  }
  return (
    <div style={{ display: "flex", alignItems: "stretch", gap: 6 }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        {!offen ? (
          <div onClick={() => setOffen(true)} style={{ cursor: "pointer", opacity: ehem ? 0.7 : 1 }}>
            <KontaktKarte k={zielKontakt} t={t} aktiv={false} onClick={() => setOffen(true)}/>
          </div>
        ) : (
          <div style={{ opacity: ehem ? 0.7 : 1 }}>
            <KontaktDetailKarte k={zielKontakt} t={t} accent={accent}
              ves={ves || []} kontakte={kontakte} setKontakte={setKontakte}
              onUpdate={(updated) => setKontakte && setKontakte(prev =>
                prev.map(c => c.id === zielKontakt.id ? updated : c))}
              onGotoKontakt={(id) => onKontaktClick && onKontaktClick(id)}
              onKontaktClick={onKontaktClick}
              onKopfClick={() => setOffen(false)}
              embedded/>
          </div>
        )}
      </div>
      {editMode && onLoesen && (
        <ZeilenAktionen t={t} onLoesen={onLoesen} loesenTitle="Bevollmächtigten entfernen"/>
      )}
    </div>
  );
}

// ── KontaktListenZeile (kompakte Listenansicht eines Kontakts, DESIGN §35) ──
// Schmale Zeile: Avatar · Name · erste Rolle. Tippen klappt dasselbe Detail
// auf wie die KontaktKarte.
function KontaktListenZeile({ k, t, accent, aktiv, onClick, id, kbItem = false }) {
  const istFirma = k.typ === "firma";
  const kontaktFarben = useKontaktFarbe();
  const farbe = istFirma ? kontaktFarben.firma : kontaktFarben.person;
  const auswahl = (istFirma ? kontaktFarben.auswahlFirma : kontaktFarben.auswahlPerson) || farbe;
  const personenRollen = useRollen();
  const firmenRollen = useFirmenRollen();
  const anzeige = useKontaktAnzeige();
  const alleKontakte = useAlleKontakte();
  const name = formatNameMitCtx(k, anzeige) || k.name;
  const zuweisungen = zuweisungenFuerAvatar(k, undefined, alleKontakte)
    .filter(z => (z.status || "aktiv") !== "ehemalig");
  const rollen = [...new Set(zuweisungen.map(z => z.rolle))];
  const rollenText = rollen.slice(0, 2).join(" · ");
  // Punkt-Farbe = Farbe der Hauptrolle (erste Rolle); sonst Personen-/Firmen-
  // Akzent. Spiegelt das bestehende Rollen-Farbsystem wider.
  const rollenListe = istFirma ? firmenRollen : personenRollen;
  let punkt = farbe;
  if (rollen.length > 0) {
    const def = rollenListe.find(r => r.name === rollen[0]);
    if (def && def.color) punkt = def.color;
  }
  const kbProps = kbItem ? { "data-kb-item": "1" } : {};
  return (
    <div onClick={onClick} id={id} {...kbProps}
      style={{ display: "flex", alignItems: "center", gap: 10,
        padding: "10px 12px", cursor: "pointer", boxSizing: "border-box",
        background: aktiv ? auswahl + "12" : t.card,
        border: `1px solid ${aktiv ? auswahl : t.border}`,
        borderRadius: RAD.md }}>
      <span style={{ width: 9, height: 9, borderRadius: 5, flexShrink: 0,
        background: punkt }}/>
      <div style={{ flex: 1, minWidth: 0, display: "flex",
        alignItems: "baseline", gap: 8 }}>
        <span style={{ fontSize: FS.m, fontWeight: FW.bold, color: t.text,
          flexShrink: 0, overflow: "hidden", textOverflow: "ellipsis",
          whiteSpace: "nowrap", maxWidth: "60%" }}>{name}</span>
        {rollenText ? (
          <span style={{ fontSize: FS.s, color: t.sub, overflow: "hidden",
            textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{rollenText}</span>
        ) : null}
      </div>
    </div>
  );
}

// ── KontaktKarte (kompakte Karten-Darstellung im Stil der VEKachel) ─────────
function KontaktKarte({ k, t, aktiv, onClick, id, ohneRahmen = false, kompakt = false, kbItem = false }) {
  const istFirma = k.typ === "firma";
  const kontaktFarben = useKontaktFarbe();
  const farbe = istFirma ? kontaktFarben.firma : kontaktFarben.person;
  const personenRollen = useRollen();
  const firmenRollen = useFirmenRollen();
  const kartenBadges = useKartenBadges();
  const zeigeKartenBadges = istFirma ? kartenBadges.firma : kartenBadges.person;
  const anzeige = useKontaktAnzeige();
  const alleKontakte = useAlleKontakte();
  const name = formatNameMitCtx(k, anzeige) || k.name;

  // Aktive Rollen für Badges (max 3, dedupliziert) — ehemalige weggelassen.
  // Quelle: zuweisungenFuerAvatar (führt besitz/zustaendigkeiten/firmenRollen
  // UND die Gewerke der Firma zusammen) — dieselbe wie für die Eck-Badges.
  // alleKontakte → eingehende Vertretungen (Bevollmächtigter-Badge) werden ergänzt.
  const zuweisungen = zuweisungenFuerAvatar(k, undefined, alleKontakte)
    .filter(z => (z.status || "aktiv") !== "ehemalig");
  const uniRollenNamen = [...new Set(zuweisungen.map(z => z.rolle))].slice(0, 3);
  // Für jede Rolle die "wichtigste" Zuweisung finden (aktiv > werdend), inkl. vorsitz/vertrag
  const PRIO = { aktiv: 3, werdend: 2 };
  const rollenAnzeige = uniRollenNamen.map(rn => {
    const beste = zuweisungen
      .filter(z => z.rolle === rn)
      .sort((a, b) => (PRIO[b.status || "aktiv"] || 0) - (PRIO[a.status || "aktiv"] || 0))[0];
    return { rolle: rn, status: beste.status || "aktiv", vorsitz: !!beste.vorsitz, vertrag: !!beste.vertrag };
  }).filter(r => {
    // Nur Rollen/Gewerke mit aktivem Karten-Badge zeigen. Definition aus der
    // passenden Liste (Firma → Gewerke, Person → Rollen); unbekannte zeigen.
    const def = (istFirma ? firmenRollen : personenRollen).find(d => d.name === r.rolle);
    return !def || rolleBadgeSichtbar(def);
  });

  // Markierte Details (max 2) — bei Personen aus tels/emails mit favorit:true
  // sowie aus dem Adress-Sammelflag (adresseFavorit; alte Einzel-Flags zählen).
  // Bei Firmen einfach Tel + Email anzeigen.
  // Falls bei Personen kein Favorit gesetzt: erste Tel + erste Email als Fallback.
  let details = [];
  if (istFirma) {
    if (k.tel)   details.push({ icon: "📞", text: k.tel });
    if (k.email) details.push({ icon: "✉", text: k.email });
  } else {
    const favTels = (k.tels   || []).filter(x => x.favorit)
      .map(x => ({ icon: "📞", text: x.nr }));
    const favEmails = (k.emails || []).filter(x => x.favorit)
      .map(x => ({ icon: "✉", text: x.email }));
    // Adresse hat EINEN gemeinsamen Stern (adresseFavorit); alte Einzel-Flags
    // (strasseFavorit/plzOrtFavorit) zählen im Bestand weiterhin.
    const plzOrtText = joinPlzOrt(k.plz, k.ort) || k.plzOrt;
    const adresseText = [k.strasse, plzOrtText].filter(Boolean).join(", ");
    const favAdresse = ((k.adresseFavorit || k.strasseFavorit || k.plzOrtFavorit) && adresseText)
      ? [{ icon: "🏠", text: adresseText }] : [];
    if (favTels.length + favEmails.length + favAdresse.length > 0) {
      details = [...favTels, ...favEmails, ...favAdresse];
    } else {
      // Fallback: erste Tel + erste Email
      if ((k.tels   || [])[0]) details.push({ icon: "📞", text: k.tels[0].nr });
      if ((k.emails || [])[0]) details.push({ icon: "✉", text: k.emails[0].email });
    }
  }
  details = details.slice(0, 2);

  // Status-Leiste — wird konfigurierbar (Menü folgt). Aktuell Demo-Logik:
  //   · Werdende Zuweisungen  →  info  "Eigentümerwechsel in Vorbereitung"
  //   · Nur ehemalige Rollen  →  done  "Keine aktiven Beteiligungen"
  // Das Setting statusLeisteKontakt steuert die Anzeige insgesamt.
  const statusLeisteSettings = useStatusLeiste();
  const status = (statusLeisteSettings.kontakt && !istFirma)
    ? berechneKontaktStatus(k, statusLeisteSettings.inhalte || {})
    : null;

  const bc = aktiv ? (kontaktFarben.auswahlKontakt || farbe) : t.border;
  // In der kleinen/eingebetteten Kontaktkarte (kompakt) wird die Statusleiste
  // nie gezeigt — sie ist dort nicht relevant.
  const zeigeStatus = statusLeisteSettings.kontakt && !kompakt;
  return (
    <div onClick={onClick} id={id} data-kb-item={kbItem ? "1" : undefined} style={{
      cursor: "pointer", transition: "all 0.15s",
      border: ohneRahmen ? "none" : `1px solid ${bc}`,
      borderRadius: ohneRahmen ? 0 : RAD.lg,
      overflow: "hidden",
      scrollMarginTop: "var(--ad-header-h, 200px)" }}
      onMouseEnter={e => { if (!aktiv) e.currentTarget.style.transform = "translateY(-1px)"; }}
      onMouseLeave={e => { if (!aktiv) e.currentTarget.style.transform = "none"; }}>
      <div style={{
        display: "flex", alignItems: "center", gap: 12,
        padding: "10px 12px", boxSizing: "border-box",
        background: istFirma ? t.surface : t.card,
      }}>
        {/* Links: Avatar — Wrapper 48px (38 Avatar + 10 Spielraum für Eck-Badges) */}
        <div style={{ width: 48, flexShrink: 0, display: "flex",
          alignItems: "center", justifyContent: "center" }}>
          <Avatar name={name} firma={istFirma} size={38} accent={farbe}
            zuweisungen={zuweisungenFuerAvatar(k, undefined, alleKontakte)}/>
        </div>
        {/* Mitte: Name + IMMER 2 Detail-Slots (leere mit Platzhalter,
            damit alle Karten gleich hoch sind) */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: FS.l, fontWeight: FW.heavy, color: farbe,
            textDecoration: istFirma ? "underline" : "none",
            textDecorationThickness: 1, textUnderlineOffset: 3,
            overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {name || "—"}
          </div>
          {[0, 1].map(i => {
            const d = details[i];
            // Bei index 0 ohne details: "Keine Kontaktdaten" als Hinweis;
            // bei index 1 ohne details: leerer Platzhalter (\u00A0)
            if (d) {
              return (
                <div key={i} style={{ fontSize: FS.s, color: t.sub, marginTop: 1,
                  display: "flex", alignItems: "center", gap: 4,
                  overflow: "hidden", whiteSpace: "nowrap" }}>
                  <span style={{ fontSize: FS.s }}>{d.icon}</span>
                  <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>{d.text}</span>
                </div>
              );
            }
            if (i === 0 && details.length === 0) {
              return (
                <div key={i} style={{ fontSize: FS.s, color: t.muted,
                  fontStyle: "italic", marginTop: 1 }}>Keine Kontaktdaten</div>
              );
            }
            // Platzhalter-Zeile für gleiche Höhe
            return (
              <div key={i} style={{ fontSize: FS.s, marginTop: 1 }}>{"\u00A0"}</div>
            );
          })}
        </div>
        {/* Rechts: Rollen-Badges */}
        {!kompakt && zeigeKartenBadges && rollenAnzeige.length > 0 && (
          <div style={{ display: "flex", gap: 3, flexShrink: 0, alignItems: "center" }}>
            {rollenAnzeige.map((r, i) => (
              <RolleBadge key={i} rolle={r.rolle} size={18}
                status={r.status} vorsitz={r.vorsitz} vertrag={r.vertrag}/>
            ))}
          </div>
        )}
      </div>
      {zeigeStatus && <StatusLeiste {...(status || {})} t={t} borderColor={bc} eingebettet={true}/>}
    </div>
  );
}

// ── KontakteMasterDetail (responsive Master-Detail-Layout) ──────────────────
// Misst die verfügbare Breite und entscheidet:
//   · 2-Spalten-Master + Detail (Standard, wenn genug Platz)
//   · 1-Spalten-Master + Detail (wenn Detail sonst zu schmal würde)
//   · nur Detail mit "Zurück"-Button (wenn auch 1-Spalten-Master nicht passt)
function KontakteMasterDetail({ cardWidth, detailMinBreite = 300, detailMaxAnteil = 0.6, kartenSpalten = 2, listenAnsicht = "karten", renderKartenSpalte, aktivK, t, accent,
  ves, kontakte, setKontakte, onVEClick, setAktiv, updateKontakt, onDelete }) {
  const istListe = listenAnsicht === "liste";
  const [mdRef, mdLayout] = useMasterDetailLayout(cardWidth, 1.1, 10, 5, true, detailMinBreite, detailMaxAnteil);
  const kartenCols = Math.max(1, Math.min(kartenSpalten, Math.floor((mdLayout.masterWidth || cardWidth) / 300)));

  // Fallback: kein Master mehr — Detail full-width + Zurück-Button
  if (mdLayout.masterCols === 0) {
    return (
      <div ref={mdRef} style={{ flex: 1, minHeight: 0, minWidth: 0,
        display: "flex", flexDirection: "column" }}>
        <ZurueckButton onClick={() => setAktiv(null)} variante="body" t={t}/>
        <div data-ad-scroll="y" style={{ flex: 1, minHeight: 0, minWidth: 0, overflowY: "auto" }}>
          <KontaktDetailKarte k={aktivK} t={t} accent={accent} listenModus={true}
            ves={ves} kontakte={kontakte} setKontakte={setKontakte}
            onVEClick={onVEClick} onKontaktClick={(id) => setAktiv(id)}
            onUpdate={updateKontakt} onDelete={onDelete}/>
        </div>
      </div>
    );
  }

  return (
    <div ref={mdRef} style={{ display: "flex", gap: 10,
      flex: 1, minHeight: 0, minWidth: 0, alignItems: "stretch" }}>
      <div data-ad-auslauf="1" style={{
        flex: mdLayout.detailFest ? "1 1 0%" : `0 0 ${mdLayout.masterWidth}px`, minWidth: 0,
        overflowY: "auto", padding: 2, boxSizing: "border-box" }}>
        {renderKartenSpalte(kartenCols)}
      </div>
      <div data-ad-auslauf="1" style={{
        flex: mdLayout.detailFest ? `0 0 ${mdLayout.detailBreite}px` : "1 1 0%", minWidth: 0,
        overflowY: "auto" }}>
        <KontaktDetailKarte k={aktivK} t={t} accent={accent} listenModus={true}
          ves={ves} kontakte={kontakte} setKontakte={setKontakte}
          onVEClick={onVEClick} onKontaktClick={(id) => setAktiv(id)}
          onUpdate={updateKontakt} onDelete={onDelete}/>
      </div>
    </div>
  );
}

// ── KontakteScreen ──────────────────────────────────────────────────────────
// ── IconLegende — erklärt die am Avatar genutzten Badges/Stile ──────────────
// Aufklappbar. Zeigt NUR die Rollen-Kürzel, die in den übergebenen Kontakten
// tatsächlich vorkommen (dynamisch), plus die Status-Stile und den Ring.
function IconLegende({ kontakte = [], t, accent, listenAnsicht = "karten", onEinstellen }) {
  const [offen, setOffen] = useState(false);
  const personenRollen = useRollen();
  const firmenRollen = useFirmenRollen();
  const istListe = listenAnsicht === "liste";

  // Genutzte Rollennamen aus allen Kontakten sammeln (Rollen + Gewerke/Firmenrollen).
  const genutzt = new Set();
  (kontakte || []).forEach(k => {
    (k.rollen || []).forEach(r => { if (r) genutzt.add(r); });
    (k.gewerke || []).forEach(g => { const n = typeof g === "string" ? g : (g && g.name); if (n) genutzt.add(n); });
    // Befugnis (Vollmacht/Betreuung) → Bevollmächtigter/Betreuer
    ausgehendeBefugnisse(k).forEach(b => genutzt.add(b.art === "betreuung" ? "Betreuer" : "Bevollmächtigter"));
  });

  const alleDefs = [...personenRollen, ...firmenRollen];
  const genutzteDefs = alleDefs.filter(d => d && genutzt.has(d.name) && d.aktiv !== false);
  // alphabetisch
  genutzteDefs.sort((a, b) => (a.name || "").localeCompare(b.name || "", "de"));

  return (
    <div style={{ marginBottom: 10, border: `1px solid ${t.border}`, borderRadius: RAD.md,
      background: t.surface, overflow: "hidden" }}>
      <button onClick={() => setOffen(o => !o)} type="button"
        style={{ width: "100%", display: "flex", alignItems: "center", gap: 8,
          background: "transparent", border: "none", cursor: "pointer",
          padding: "5px 12px", minHeight: 34, boxSizing: "border-box", fontFamily: "inherit", color: t.sub }}>
        <I name="info" size={14} color={accent}/>
        <span style={{ flex: 1, textAlign: "left", fontSize: FS.s, fontWeight: FW.medium }}>
          Legende — Symbole erklärt
        </span>
        {onEinstellen ? (
          <span
            onClick={(e) => { e.stopPropagation(); onEinstellen(); }}
            style={{ display: "flex", alignItems: "center", gap: 4, flexShrink: 0,
              padding: "3px 9px", borderRadius: RAD.sm, cursor: "pointer",
              fontFamily: "inherit", fontSize: FS.xs, fontWeight: FW.bold,
              background: accent + "14", border: `1px solid ${accent}40`, color: accent }}>
            Einstellen
          </span>
        ) : null}
      </button>
      {offen && (
        <div style={{ padding: "4px 12px 12px", borderTop: `1px solid ${t.border}40` }}>
          {istListe ? (
            /* Listen-Modus: der Punkt links zeigt die Farbe der Hauptrolle. */
            <div>
              <div style={{ marginTop: 8, fontSize: FS.xs, fontWeight: FW.bold, color: t.sub,
                textTransform: "uppercase", letterSpacing: "0.08em" }}>Punkt = Hauptrolle</div>
              {genutzteDefs.length > 0 ? (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 12, marginTop: 8 }}>
                  {genutzteDefs.map(d => (
                    <div key={d.name} style={{ display: "inline-flex", alignItems: "center", gap: 8,
                      fontSize: FS.s, color: t.text }}>
                      <span style={{ width: 9, height: 9, borderRadius: 5, flexShrink: 0,
                        background: d.color || accent }}/>
                      {d.name}
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ fontSize: FS.s, color: t.muted, fontStyle: "italic", marginTop: 8 }}>
                  Noch keine Rollen vergeben.
                </div>
              )}
            </div>
          ) : (
            <>
              {/* Rollen-Kürzel (nur genutzte) */}
              {genutzteDefs.length > 0 ? (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginTop: 8 }}>
                  {genutzteDefs.map(d => (
                    <div key={d.name} style={{ display: "inline-flex", alignItems: "center", gap: 6,
                      fontSize: FS.s, color: t.text }}>
                      <RolleBadge rolle={d.name} size={22} status="aktiv"/>
                      {d.name}
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ fontSize: FS.s, color: t.muted, fontStyle: "italic", marginTop: 8 }}>
                  Noch keine Rollen vergeben.
                </div>
              )}

              {/* Status-Stile */}
              <div style={{ marginTop: 12, fontSize: FS.xs, fontWeight: FW.bold, color: t.sub,
                textTransform: "uppercase", letterSpacing: "0.08em" }}>Status</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 12, marginTop: 6 }}>
                <div style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: FS.s, color: t.text }}>
                  <RolleBadge rolle="Eigentümer" size={22} status="aktiv"/> aktiv
                </div>
                <div style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: FS.s, color: t.text }}>
                  <RolleBadge rolle="Eigentümer" size={22} status="werdend"/> werdend
                </div>
                <div style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: FS.s, color: t.text }}>
                  <RolleBadge rolle="Eigentümer" size={22} status="ehemalig"/> ehemalig
                </div>
              </div>

              {/* Ring */}
              <div style={{ marginTop: 12, fontSize: FS.xs, fontWeight: FW.bold, color: t.sub,
                textTransform: "uppercase", letterSpacing: "0.08em" }}>Goldener Ring</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 12, marginTop: 6 }}>
                <div style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: FS.s, color: t.text }}>
                  <RolleBadge rolle="Verwaltungsbeirat" size={22} status="aktiv" vorsitz={true}/> Vorsitz (VBV)
                </div>
                <div style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: FS.s, color: t.text }}>
                  <RolleBadge rolle="Verwaltungsbeirat" size={22} status="aktiv" vertrag={true}/> mit Vertrag
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ── ObjektLegende — erklärt die an Einheiten genutzten Verwendungs-Badges ────
// Aufklappbar. Zeigt NUR die Verwendungen, die in den Objekten tatsächlich
// vorkommen (dynamisch), plus die Status-Stile.
function ObjektLegende({ ves = [], t, accent, listenAnsicht = "karten", onGotoHandlungsbedarf }) {
  const [offen, setOffen] = useState(false);
  const alleVerwendungen = useVerwendungen();
  const istListe = listenAnsicht === "liste";

  // Genutzte Verwendungsnamen aus allen Einheiten sammeln.
  const genutzt = new Set();
  (ves || []).forEach(v => {
    (v.einheiten || []).forEach(e => {
      verwendungenVon(e).forEach(vw => { if (vw && vw.name) genutzt.add(vw.name); });
    });
  });

  const genutzteDefs = (alleVerwendungen || []).filter(d => d && genutzt.has(d.name) && d.aktiv !== false);
  genutzteDefs.sort((a, b) => (a.name || "").localeCompare(b.name || "", "de"));

  // Punkt-Symbol für die Listen-Legende (Status der Verwalterbestellung).
  const PunktZeile = ({ farbe, text }) => (
    <div style={{ display: "inline-flex", alignItems: "center", gap: 8,
      fontSize: FS.s, color: t.text }}>
      <span style={{ width: 9, height: 9, borderRadius: 5, background: farbe,
        flexShrink: 0 }}/>
      {text}
    </div>
  );
  // Balken-Symbol für die Statusleiste-Legende (Karten-Modus).
  const LeisteZeile = ({ farbe, text }) => (
    <div style={{ display: "inline-flex", alignItems: "center", gap: 8,
      fontSize: FS.s, color: t.text }}>
      <span style={{ width: 18, height: 10, borderRadius: 3, background: farbe,
        flexShrink: 0 }}/>
      {text}
    </div>
  );

  return (
    <div style={{ marginBottom: 10, border: `1px solid ${t.border}`, borderRadius: RAD.md,
      background: t.surface, overflow: "hidden" }}>
      <div onClick={() => setOffen(o => !o)}
        style={{ width: "100%", display: "flex", alignItems: "center", gap: 8,
          cursor: "pointer", padding: "5px 12px", minHeight: 34, boxSizing: "border-box", color: t.sub }}>
        <I name="info" size={14} color={accent}/>
        <span style={{ flex: 1, textAlign: "left", fontSize: FS.s, fontWeight: FW.medium }}>
          Legende — Symbole erklärt
        </span>
        {onGotoHandlungsbedarf ? (
          <button type="button"
            onClick={(e) => { e.stopPropagation(); onGotoHandlungsbedarf(); }}
            style={{ display: "flex", alignItems: "center", gap: 4, flexShrink: 0,
              padding: "3px 9px", borderRadius: RAD.sm, cursor: "pointer",
              fontFamily: "inherit", fontSize: FS.xs, fontWeight: FW.bold,
              background: accent + "14", border: `1px solid ${accent}40`, color: accent }}>
            Einstellen
          </button>
        ) : null}
      </div>
      {offen && (
        <div style={{ padding: "4px 12px 12px", borderTop: `1px solid ${t.border}40` }}>
          {istListe ? (
            /* Listen-Modus: der Punkt links zeigt den Gesamt-Handlungsbedarf
               des Objekts (Fristen/Termine). */
            <div>
              <div style={{ marginTop: 8, fontSize: FS.xs, fontWeight: FW.bold, color: t.sub,
                textTransform: "uppercase", letterSpacing: "0.08em" }}>Punkt = Handlungsbedarf</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 8 }}>
                <PunktZeile farbe="#22C55E" text="alles ok — nichts Dringendes"/>
                <PunktZeile farbe="#F59E0B" text="kann was gemacht werden — Frist rückt näher"/>
                <PunktZeile farbe="#EF4444" text="muss was gemacht werden — Frist überfällig"/>
              </div>
            </div>
          ) : (
            <>
              {/* Verwendungen (nur genutzte) */}
              {genutzteDefs.length > 0 ? (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginTop: 8 }}>
                  {genutzteDefs.map(d => (
                    <div key={d.name} style={{ display: "inline-flex", alignItems: "center", gap: 6,
                      fontSize: FS.s, color: t.text }}>
                      <VerwendungBadge verwendung={d.name} size={22} status="aktiv"/>
                      {d.name}
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ fontSize: FS.s, color: t.muted, fontStyle: "italic", marginTop: 8 }}>
                  Noch keine Verwendungen vergeben.
                </div>
              )}

              {/* Status-Stile */}
              <div style={{ marginTop: 12, fontSize: FS.xs, fontWeight: FW.bold, color: t.sub,
                textTransform: "uppercase", letterSpacing: "0.08em" }}>Status</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 12, marginTop: 6 }}>
                <div style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: FS.s, color: t.text }}>
                  <VerwendungBadge verwendung="Vermietet" size={22} status="aktiv"/> aktiv
                </div>
                <div style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: FS.s, color: t.text }}>
                  <VerwendungBadge verwendung="Vermietet" size={22} status="werdend"/> werdend
                </div>
                <div style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: FS.s, color: t.text }}>
                  <VerwendungBadge verwendung="Vermietet" size={22} status="ehemalig"/> ehemalig
                </div>
              </div>

              {/* Statusleiste unter der Karte — farbcodierter Handlungsbedarf
                  mit Grund-Text (gleiche Logik wie der Punkt in der Liste). */}
              <div style={{ marginTop: 12, fontSize: FS.xs, fontWeight: FW.bold, color: t.sub,
                textTransform: "uppercase", letterSpacing: "0.08em" }}>Statusleiste = Handlungsbedarf</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 12, marginTop: 6 }}>
                <LeisteZeile farbe="#F59E0B" text="Frist rückt näher"/>
                <LeisteZeile farbe="#EF4444" text="Frist überfällig"/>
              </div>
              <div style={{ marginTop: 6, fontSize: FS.xs, color: t.muted }}>
                Alles ok: keine Leiste. Was zählt, stellst du oben rechts ein.
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ── Alphabetische Gliederung der Kontaktliste ───────────────────────────────
// kontaktAnfangsbuchstabe: liefert den Trenner-Buchstaben passend zur Sortierung
// (Firma → name; Person → vorname/nachname je nach Format). Diakritika werden
// auf den Grundbuchstaben normalisiert (Ä→A, Ö→O, Ü→U, é→E …); alles ohne
// Buchstaben (Zahlen/leer) landet unter „#".
function kontaktAnfangsbuchstabe(k, nameFormat) {
  if (!k) return "#";
  let basis = "";
  if (k.typ === "firma") basis = k.name || "";
  else {
    const sortNach = nameFormat === "nachname-vorname" ? "nachname" : "vorname";
    basis = (sortNach === "vorname" ? k.vorname : k.nachname) || k.nachname || k.vorname || k.name || "";
  }
  const ch = basis.trim().charAt(0);
  if (!ch) return "#";
  // ß zuerst (ß.toUpperCase() ergäbe "SS"). Dann Diakritika entfernen
  // (NFD + Combining-Marks weg), dann Großbuchstabe.
  if (ch === "ß") return "S";
  let norm = ch;
  try { norm = ch.normalize("NFD").replace(/[\u0300-\u036f]/g, ""); } catch (e) {}
  norm = (norm.charAt(0) || ch).toUpperCase();
  // alles Nicht-A–Z → „#".
  if (norm < "A" || norm > "Z") return "#";
  return norm;
}

// Teilt eine bereits sortierte Kontaktliste in Buchstaben-Sektionen:
// [{ buchstabe, kontakte: [...] }] in Listenreihenfolge.
function gruppiereNachBuchstabe(liste, nameFormat) {
  const sektionen = [];
  let aktuell = null;
  (liste || []).forEach(k => {
    const b = kontaktAnfangsbuchstabe(k, nameFormat);
    if (!aktuell || aktuell.buchstabe !== b) {
      aktuell = { buchstabe: b, kontakte: [] };
      sektionen.push(aktuell);
    }
    aktuell.kontakte.push(k);
  });
  return sektionen;
}

// KbZurueckHook — unsichtbares Ziel für die Esc-Taste (Tastatur Stufe 2).
// In Desktop-Master-Detail-Layouts gibt es keinen sichtbaren „Zurück"-Button;
// dieser 1×1-px-Button wird vom globalen Tastatur-Handler per .click()
// ausgelöst und schließt das offene Detail. pointerEvents:none hält ihn von
// Maus/Touch fern, programmatische clicks funktionieren trotzdem.
function KbZurueckHook({ onClick }) {
  return (
    <button data-kb-zurueck="1" aria-hidden="true" tabIndex={-1} onClick={onClick}
      style={{ position: "fixed", bottom: 0, right: 0, width: 1, height: 1,
        padding: 0, border: "none", background: "transparent", opacity: 0,
        pointerEvents: "none" }}/>
  );
}

// Mobile: aufgeklapptes Objekt-Detail. Beim Öffnen (neue VE-ID) wird der
// eigene Wurzel-Knoten an den Seitenanfang unter den Sticky-Header gescrollt,
// damit der Detail-Kopf oben steht statt am unteren Bildschirmrand zu kleben
// (Sprung-/Auslauf-Zusammenspiel, §33). Body-Scroll auf Mobile: window.scrollTo;
// falls doch ein interner Scroller existiert, diesen. Zwei rAF: nach Layout der
// frisch gemounteten Detail-Ansicht.
function DetailMobilScrollTop({ offenId, t, headerSelector, children }) {
  const wrapRef = useRef(null);
  useEffect(() => {
    if (offenId == null) return;
    const lauf = () => {
      const el = wrapRef.current;
      if (!el) return;
      const scroller = findScrollParent(el);
      if (scroller) {
        const sRect = scroller.getBoundingClientRect();
        const delta = el.getBoundingClientRect().top - sRect.top - 8;
        const ziel = Math.max(0, scroller.scrollTop + delta);
        try { scroller.scrollTo({ top: ziel, behavior: "auto" }); }
        catch (e) { scroller.scrollTop = ziel; }
      } else if (typeof window !== "undefined") {
        const headerEl = headerSelector ? document.querySelector(headerSelector) : null;
        const headerH = headerEl ? headerEl.offsetHeight + 12 : 180;
        const top = (window.scrollY || 0) + el.getBoundingClientRect().top - headerH;
        try { window.scrollTo({ top: Math.max(0, top), behavior: "auto" }); }
        catch (e) { window.scrollTo(0, Math.max(0, top)); }
      }
    };
    requestAnimationFrame(() => requestAnimationFrame(lauf));
  }, [offenId]);
  return (
    <div ref={wrapRef} style={{ display: "flex", flexDirection: "column",
      scrollMarginTop: "var(--ad-header-h, 180px)" }}>
      {children}
    </div>
  );
}

// KontaktTrenner: Buchstabe links + feine Linie über die volle Breite. Sitzt
// als eigene Grid-Zeile (gridColumn 1/-1), damit er das mehrspaltige Karten-
// Raster nicht stört.
function KontaktTrenner({ buchstabe, t, accent }) {
  return (
    <div style={{ gridColumn: "1 / -1", display: "flex", alignItems: "center",
      gap: 10, marginTop: 6, marginBottom: 2 }}>
      <span style={{ fontSize: FS.s, fontWeight: FW.bold, color: accent,
        letterSpacing: "0.06em", flexShrink: 0, minWidth: 14 }}>{buchstabe}</span>
      <span style={{ flex: 1, height: 1, background: t.border }}/>
    </div>
  );
}

function KontakteScreen({ t, accent, initialKontaktId, onVEClick, filter = "alle", kontaktart, kontakte, setKontakte, ves, cardWidth = 340, detailMinBreite = 300, detailMaxAnteil = 0.6, legendeAn = true, listenAnsicht = "karten",
  externAktiv, setExternAktiv, externEditMode, setExternEditMode, mobileDetailHeaderOhneEditBtn = false, kartenSpalten = 2 }) {
  const [internAktiv, setInternAktiv] = useState(initialKontaktId || null);
  // Aktiver Kontakt: extern kontrollierbar (Mobile: App-Ebene weiß Bescheid,
  // um Plus → Stift im Sticky-Header zu wechseln), sonst lokaler State.
  const aktiv    = (externAktiv !== undefined) ? externAktiv : internAktiv;
  const setAktiv = setExternAktiv ? setExternAktiv : setInternAktiv;
  // Bewusst kein Auto-Scroll beim Master-Detail-Klick — der geklickte
  // Listeneintrag bleibt an seiner Stelle.
  const ww = useWindowWidth();
  const personenRollen = useRollen();
  const firmenRollen = useFirmenRollen();
  const arten = buildKontaktarten(personenRollen, firmenRollen);

  // Filter-Logik abhängig vom externen filter
  const passt = (k) => {
    if (filter === "alle" || !filter) return true;
    if (filter === "personen") return k.typ === "person";
    if (filter === "firmen")   return k.typ === "firma";
    if (k.typ !== "person") return false;
    const rollen = k.rollen || [];
    if (filter === "eigentuemer") return rollen.includes("Eigentümer");
    if (filter === "mieter")      return rollen.includes("Mieter");
    if (filter === "vbeirat")     return rollen.includes("Verwaltungsbeirat");
    return true;
  };

  const updateKontakt = (updated) => {
    if (!setKontakte) return;
    setKontakte(prev => prev.map(c => c.id === updated.id ? updated : c));
  };

  const gefiltert = kontakte.filter(k =>
    passt(k) && kontaktPasstZuArt(k, kontaktart || "alle", arten));
  const aktivK = kontakte.find(k => k.id === aktiv);
  // Wenn ein Rollen-Filter aktiv ist: nur die zur Rolle passende Kategorie zeigen.
  const artDef = arten.find(a => a.id === kontaktart);
  const personenErlaubt = !artDef
    || (artDef.typ === "kategorie" && artDef.id !== "firma")
    || artDef.typ === "rolle_person"
    || kontaktart === "alle" || !kontaktart;
  const firmenErlaubt = !artDef
    || (artDef.typ === "kategorie" && artDef.id !== "person")
    || artDef.typ === "rolle_firma"
    || kontaktart === "alle" || !kontaktart;
  // Mit altem filter-Prop kombinieren
  const altFilterPersonen = filter === "alle" || filter === "personen"
    || ["eigentuemer", "mieter", "vbeirat"].includes(filter) || !filter;
  const altFilterFirmen = filter === "alle" || filter === "firmen" || !filter;
  const zeigePersonen = personenErlaubt && altFilterPersonen;
  const zeigeFirmen   = firmenErlaubt   && altFilterFirmen;

  const anzeige = useKontaktAnzeige();
  const sortSet = { kontakteNameFormat: anzeige.nameFormat };
  const personenGef = sortKontakte(gefiltert.filter(k => k.typ === "person"), sortSet);
  const firmenGef   = sortKontakte(gefiltert.filter(k => k.typ === "firma"),   sortSet);

  // Auto-Grid: Spalten sind exakt minmax(280px, 1fr); bei wenig Inhalt füllen
  // leere Slots den Rest, sodass die vorhandenen Karten nicht aufgeblasen werden.
  const wrapStyle = {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
    gap: 10,
    gridAutoFlow: "dense",
  };

  // Master-Detail: linke schmale Spalte mit Karten, rechts Detail
  const windowW = useWindowWidth();
  const istDesktop = windowW >= 900;
  const hatOffen = aktiv != null && aktivK != null;

  const istListe = listenAnsicht === "liste";
  const renderKontaktItem = (k, aktivId, onClick, kb) => istListe ? (
    <KontaktListenZeile key={k.id} k={k} t={t} accent={accent}
      aktiv={aktivId === k.id} kbItem={kb} id={"kon-" + k.id} onClick={onClick}/>
  ) : (
    <KontaktKarte key={k.id} k={k} t={t} aktiv={aktivId === k.id} kbItem={kb}
      id={"kon-" + k.id} onClick={onClick}/>
  );

  const renderKartenSpalte = (cols) => (
    <>
      {zeigePersonen && personenGef.length > 0 && (
        <div style={istListe
          ? { display: "flex", flexDirection: "column", gap: 6 }
          : { display: "grid",
              gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`,
              gap: 8, alignContent: "start" }}>
          {personenGef.map(k => renderKontaktItem(k, aktiv,
            () => setAktiv(aktiv === k.id ? null : k.id), false))}
        </div>
      )}
      {zeigeFirmen && firmenGef.length > 0 && (
        <div style={istListe
          ? { display: "flex", flexDirection: "column", gap: 6,
              marginTop: (zeigePersonen && personenGef.length > 0) ? 12 : 0 }
          : { display: "grid",
              gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`,
              gap: 8, alignContent: "start",
              marginTop: (zeigePersonen && personenGef.length > 0) ? 12 : 0 }}>
          {firmenGef.map(k => renderKontaktItem(k, aktiv,
            () => setAktiv(aktiv === k.id ? null : k.id), false))}
        </div>
      )}
    </>
  );

  // Kontakt löschen: aus der Liste entfernen + Detail schließen.
  // Bestätigungs-Dialog erfolgt schon in KDKHeader.
  const deleteKontakt = () => {
    if (!aktivK) return;
    setKontakte(prev => prev.filter(k => k.id !== aktivK.id));
    setAktiv(null);
  };

  if (hatOffen && istDesktop) {
    return (
      <>
      <KbZurueckHook onClick={() => setAktiv(null)}/>
      <KontakteMasterDetail
        cardWidth={cardWidth}
        detailMinBreite={detailMinBreite} detailMaxAnteil={detailMaxAnteil}
        kartenSpalten={kartenSpalten}
        listenAnsicht={listenAnsicht}
        renderKartenSpalte={renderKartenSpalte}
        aktivK={aktivK} t={t} accent={accent}
        ves={ves} kontakte={kontakte} setKontakte={setKontakte}
        onVEClick={onVEClick} setAktiv={setAktiv}
        updateKontakt={updateKontakt}
        onDelete={deleteKontakt}/>
      </>
    );
  }

  if (hatOffen && !istDesktop) {
    return (
      <DetailMobilScrollTop offenId={aktivK.id} t={t}
        headerSelector="[data-app-fixed-header]">
        <KbZurueckHook onClick={() => setAktiv(null)}/>
        {/* Zurück-Button sitzt jetzt oben rechts im Sticky-Header (wie in den
            Einstellungen/Objekten); der Bearbeiten-Button im KDK-Header neben
            dem Namen. Daher hier kein separater Zurück-Button mehr. */}
        <div>
          <KontaktDetailKarte k={aktivK} t={t} accent={accent} listenModus={true}
            ves={ves} kontakte={kontakte} setKontakte={setKontakte}
            externEditMode={externEditMode}
            setExternEditMode={setExternEditMode}
            headerOhneEditBtn={mobileDetailHeaderOhneEditBtn}
            onVEClick={onVEClick} onKontaktClick={(id) => setAktiv(id)}
            onUpdate={updateKontakt}
            onDelete={deleteKontakt}/>
        </div>
      </DetailMobilScrollTop>
    );
  }

  const alphaTrennerAn = anzeige.alphaTrenner !== false;
  const renderGruppe = (liste, typ) => {
    const listenWrap = { display: "flex", flexDirection: "column", gap: 6 };
    // Ohne Trenner: ein einziges Karten-Raster (bzw. Liste).
    if (!alphaTrennerAn) {
      return (
        <div style={istListe ? listenWrap : wrapStyle}>
          {liste.map(k => renderKontaktItem(k, null, () => setAktiv(k.id), true))}
        </div>
      );
    }
    // Mit Trenner: Sektionen je Anfangsbuchstabe; Trenner als volle-Breite-Zeile
    // im selben Grid (gridColumn 1/-1), Karten danach normal mehrspaltig.
    const sektionen = gruppiereNachBuchstabe(liste, anzeige.nameFormat);
    return (
      <div style={istListe ? listenWrap : wrapStyle}>
        {sektionen.map(sek => (
          <React.Fragment key={typ + "-" + sek.buchstabe}>
            <KontaktTrenner buchstabe={sek.buchstabe} t={t} accent={accent}/>
            {sek.kontakte.map(k => renderKontaktItem(k, null, () => setAktiv(k.id), true))}
          </React.Fragment>
        ))}
      </div>
    );
  };

  return (
    <div data-ad-scroll="y" style={{ flex: 1, minHeight: 0, overflowY: "auto" }}>
      {/* Aufklappbare Legende — erklärt die genutzten Rollen-Badges, Status & Ring. */}
      {legendeAn && (personenGef.length > 0 || firmenGef.length > 0) && (
        <IconLegende kontakte={[...personenGef, ...firmenGef]} t={t} accent={accent}
          listenAnsicht={listenAnsicht}
          onEinstellen={() => {
            try {
              window.dispatchEvent(new CustomEvent("allesda:goto-einstellungen",
                { detail: { sektion: "kontakte" } }));
            } catch (err) {}
          }}/>
      )}
      {/* Personen — kein Section-Header mehr, die Filter-Buttons oben
          dienen als Gliederung. */}
      {zeigePersonen && personenGef.length > 0 && renderGruppe(personenGef, "person")}

      {/* Firmen — kleiner Abstand wenn Personen darüber sichtbar waren. */}
      {zeigeFirmen && firmenGef.length > 0 && (
        <div style={{ marginTop: (zeigePersonen && personenGef.length > 0) ? 16 : 0 }}>
          {renderGruppe(firmenGef, "firma")}
        </div>
      )}

      {/* Leerer Zustand */}
      {gefiltert.length === 0 && (
        <div style={{ fontSize: FS.l, color: t.sub, textAlign: "center",
          padding: "40px 0", fontStyle: "italic" }}>
          Keine Kontakte für diesen Filter.
        </div>
      )}
    </div>
  );
}

// ╔═════════════════════════════════════════════════════════════════════════╗
// ║ SEKTION 8 · EINSTELLUNGEN                                               ║
// ║ EinstellKarte · EinstellZeile · FarbPicker                              ║
// ║ Sektionen: Profil · Erscheinungsbild · Header · Filter · Dashboard ·    ║
// ║            Suche · Hausverwaltung · Daten                               ║
// ║ Plus: EinstellungenZentrale (Routing innerhalb)                         ║
// ╚═════════════════════════════════════════════════════════════════════════╝

// ── Einstellungen-Karten/Zeilen-Container ───────────────────────────────────
function EinstellKarte({ title, children, t, accent }) {
  return (
    <div style={{ background: t.card, border: `1px solid ${t.border}`,
      borderRadius: RAD.lg, overflow: "hidden", marginBottom: 12 }}>
      <div style={{ padding: "10px 14px", background: accent + "08",
        borderBottom: `1px solid ${t.border}` }}>
        <span style={{ fontSize: FS.l, fontWeight: FW.bold, color: t.text }}>{title}</span>
      </div>
      <div style={{ padding: "14px" }}>{children}</div>
    </div>
  );
}

function EinstellZeile({ label, sub, children, t }) {
  // Auf Mobile (< 600px) wird die Zeile gestapelt: Label oben, Control darunter
  // in voller Breite. So passen breite Controls (PillGroup) sauber rein und
  // Toggles werden rechts ausgerichtet (alignSelf: flex-end), damit die
  // Touch-Trefferfläche an gewohnter Stelle sitzt.
  const ww = useWindowWidth();
  const stacked = ww < 600;
  if (stacked) {
    return (
      <div style={{ padding: "11px 0", borderBottom: `1px solid ${t.border}25`,
        display: "flex", flexDirection: "column", gap: 8 }}>
        <div>
          <div style={{ fontSize: FS.l, fontWeight: FW.semi, color: t.text }}>{label}</div>
          {sub && <div style={{ fontSize: FS.m, color: t.sub, marginTop: 3, lineHeight: 1.4 }}>{sub}</div>}
        </div>
        <div style={{ display: "flex", justifyContent: "flex-end" }}>
          {children}
        </div>
      </div>
    );
  }
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12,
      padding: "11px 0", borderBottom: `1px solid ${t.border}25` }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: FS.l, fontWeight: FW.semi, color: t.text }}>{label}</div>
        {sub && <div style={{ fontSize: FS.m, color: t.sub, marginTop: 3, lineHeight: 1.4 }}>{sub}</div>}
      </div>
      <div style={{ flexShrink: 0 }}>{children}</div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// EINSTELLUNGEN-ZENTRALE
// ─────────────────────────────────────────────────────────────────────────────
// Eine zentrale Seite mit Kachel-Übersicht. Klick auf Kachel öffnet die
// jeweilige Detail-Sektion. Jede Sektion ist eine eigene Top-Level-Komponente,
// damit später pro Sektion Zugriffsrechte vergeben werden können.
//
//   if (!user.darfSehen("hv")) return null;  // <- sowas wäre dann denkbar
// ─────────────────────────────────────────────────────────────────────────────

// ── Farb-Voreinstellungen für Kacheln (8 Presets) ───────────────────────────
// ── FarbPalettenGrid (inline, alle 30 Familien × 10 Stufen) ─────────────────
// Wird sowohl im Popup als auch direkt eingebettet (z. B. in der Sektion Rollen).
// ── Helper: alle aktuell vergebenen Farben aus den Settings sammeln ─────────
// Wird an FarbPicker/FarbPalettenGrid übergeben, damit dort bereits genutzte
// Farben ausgegraut + diagonal durchgestrichen angezeigt werden — User sieht
// auf einen Blick, welche Farben "weg" sind. Die aktuell gewählte Farbe
// (value) wird automatisch ausgeklammert (siehe istGewaehlt-Check im Grid).
function sammleVerwendeteFarben(settings) {
  const liste = [];
  (settings.kacheln || []).forEach(k => { if (k.farbe) liste.push(k.farbe); });
  (settings.rollen || []).forEach(r => { if (r.color) liste.push(r.color); });
  (settings.firmenRollen || []).forEach(r => { if (r.color) liste.push(r.color); });
  (settings.verwendungen || []).forEach(v => { if (v.color) liste.push(v.color); });
  if (settings.systemFarbe) liste.push(settings.systemFarbe);
  return liste;
}

function FarbPalettenGrid({ value, onChange, t, hoehe = null, verwendeteFarben = [] }) {
  const containerStyle = { background: t.card, border: `1px solid ${t.border}`, borderRadius: RAD.md, padding: 6 };
  const scrollStyle = hoehe ? { maxHeight: hoehe, overflowY: "auto" } : {};
  // Verwendete Farben in Lookup-Set (lowercase) — die werden ausgegraut + diagonal durchgestrichen
  const usedSet = new Set((verwendeteFarben || []).filter(Boolean).map(c => c.toLowerCase()));
  return (
    <div style={containerStyle}>
      <div style={scrollStyle}>
        {PALETTE_FARBEN.map(fam => (
          <div key={fam.familie} style={{ display: "flex", gap: 3, marginBottom: 3 }}>
            {fam.stufen.map(st => {
              const istGewaehlt  = value && value.toLowerCase() === st.hex.toLowerCase();
              const istVerwendet = !istGewaehlt && usedSet.has(st.hex.toLowerCase());
              return (
                <button key={st.stufe} onClick={() => onChange(st.hex)}
                  title={`${fam.familie} ${st.stufe} · ${st.hex}${istVerwendet ? " · bereits verwendet" : ""}`}
                  style={{
                    position: "relative",
                    flex: 1, aspectRatio: "1",
                    borderRadius: RAD.sm, background: st.hex,
                    // Border konstant 1px — Selection per outline (außerhalb des Box-Modells,
                    // verschiebt keine Geschwister). Damit alle Quadrate exakt gleich groß.
                    border: `1px solid ${t.border}40`,
                    outline: istGewaehlt ? `2px solid ${t.text}` : "none",
                    outlineOffset: istGewaehlt ? "-1px" : "0",
                    cursor: "pointer", padding: 0, fontFamily: "inherit",
                    opacity: istVerwendet ? 0.35 : 1,
                  }}>
                  {istVerwendet && (
                    <span aria-hidden="true" style={{
                      position: "absolute", top: 0, right: 0, bottom: 0, left: 0, pointerEvents: "none",
                      background: `linear-gradient(135deg, transparent 46%, ${t.text} 46%, ${t.text} 54%, transparent 54%)`,
                      borderRadius: 4,
                    }}/>
                  )}
                </button>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

// ── FarbPicker (Button + Modal mit Header/Footer) ───────────────────────────
// Drop-in-Ersatz für den alten 8-Farben-Picker. Modal-Pattern statt Popup:
//   • Mobile (<700px): vollflächiges Modal mit safe-area-Padding oben/unten
//   • Desktop:        zentriertes Modal, max 90dvh
//   • X-Button rechts im Header zum Schließen
//   • Footer mit Abbrechen + Übernehmen
//   • Auswahl erst beim Klick auf "Übernehmen" wirksam — Abbrechen verwirft.
function FarbPicker({ value, onChange, t, verwendeteFarben = [] }) {
  const [offen, setOffen] = useState(false);
  return (
    <div style={{ position: "relative" }}>
      <button onClick={() => setOffen(true)} title="Farbe wählen" style={{
        width: 26, height: 26, borderRadius: RAD.ms,
        background: value, border: `2px solid ${t.border}`,
        cursor: "pointer", padding: 0, fontFamily: "inherit" }}/>
      {offen && (
        <FarbPickerModal value={value} t={t}
          verwendeteFarben={verwendeteFarben}
          onUebernehmen={(c) => { onChange(c); setOffen(false); }}
          onClose={() => setOffen(false)}/>
      )}
    </div>
  );
}

function FarbPickerModal({ value, t, verwendeteFarben, onUebernehmen, onClose }) {
  // Entwurfs-Auswahl — wird erst per "Übernehmen" zurück nach oben gemeldet
  const [draft, setDraft] = useState(value);
  const ww = useWindowWidth();
  const isMobile = ww < 700;

  // ESC = Schließen
  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <>
      {/* Backdrop */}
      <div onClick={onClose} style={{
        position: "fixed", top: 0, right: 0, bottom: 0, left: 0, zIndex: 9000,
        background: "rgba(0,0,0,0.6)"
      }}/>
      {/* Modal */}
      <div style={{
        position: "fixed",
        top:    isMobile ? "max(8px, env(safe-area-inset-top))"       : "50%",
        left:   isMobile ? 8 : "50%",
        right:  isMobile ? 8 : "auto",
        bottom: isMobile ? "max(8px, env(safe-area-inset-bottom))"    : "auto",
        transform: isMobile ? "none" : "translate(-50%, -50%)",
        width:  isMobile ? "auto" : "min(420px, calc(100vw - 32px))",
        maxHeight: isMobile ? "none" : "90dvh",
        background: t.card, border: `1px solid ${t.border}`, borderRadius: RAD.lg,
        boxShadow: "0 16px 48px rgba(0,0,0,0.5)",
        zIndex: 9001,
        display: "flex", flexDirection: "column",
        overflow: "hidden",
      }}>
        {/* Header mit X — Titel + aktueller (gespeicherter) Farbe in einer Zeile.
            Die "aktuelle Farbe" ist das was bisher gilt (value), nicht draft —
            so sieht der User auf einen Blick womit er gerade vergleicht.
            Die Vorschau der neuen Auswahl (draft) sitzt unten am Übernehmen-Button. */}
        <div style={{ display: "flex", alignItems: "center", gap: 10,
          padding: "12px 14px", borderBottom: `1px solid ${t.border}` }}>
          <div style={{ fontSize: FS.xl, fontWeight: FW.bold, color: t.text }}>Farbe wählen</div>
          <span title="Aktuelle Farbe" style={{
            width: 20, height: 20, borderRadius: RAD.sm,
            background: value, border: `1px solid ${t.border}`,
            display: "inline-block", flexShrink: 0 }}/>
          <div style={{ flex: 1 }}/>
          <button onClick={onClose} title="Schließen" aria-label="Schließen" style={{
            width: 34, height: 34, borderRadius: RAD.md,
            background: t.surface, border: `1px solid ${t.border}`,
            cursor: "pointer", padding: 0, fontFamily: "inherit",
            display: "flex", alignItems: "center", justifyContent: "center" }}>
            <I name="x" size={15} color={t.sub}/>
          </button>
        </div>

        {/* Grid — flex 1, eigenes Scrollen */}
        <div style={{ flex: 1, overflowY: "auto", padding: 10 }}>
          <FarbPalettenGrid value={draft} onChange={setDraft}
            t={t} verwendeteFarben={verwendeteFarben}/>
        </div>

        {/* Footer */}
        <div style={{ display: "flex", gap: 8, padding: "10px 12px",
          borderTop: `1px solid ${t.border}` }}>
          <button onClick={onClose} style={{
            flex: 1, padding: "11px 0", background: t.surface,
            border: `1px solid ${t.border}`, borderRadius: RAD.ml,
            color: t.text, cursor: "pointer",
            fontSize: FS.l, fontWeight: FW.medium, fontFamily: "inherit" }}>
            Abbrechen
          </button>
          <button onClick={() => onUebernehmen(draft)} style={{
            flex: 2, padding: "11px 0", background: draft,
            border: "none", borderRadius: RAD.ml,
            color: getContrastColor(draft), cursor: "pointer",
            fontSize: FS.l, fontWeight: FW.bold, fontFamily: "inherit" }}>
            Übernehmen
          </button>
        </div>
      </div>
    </>
  );
}


// ── Foto-Helper: Datei → 200×200 Base64-JPEG ────────────────────────────────
// Liest eine Bild-Datei ein, skaliert auf max. 200×200 (Center-Crop, behält
// Seitenverhältnis), gibt Base64-DataURL als JPEG zurück. Wird für das Profil-
// foto verwendet — kleine Größe ist wichtig, damit localStorage nicht überläuft.
function dateiZuFotoDataUrl(file, callback) {
  if (!file || !file.type || file.type.indexOf("image/") !== 0) {
    callback(null); return;
  }
  const reader = new FileReader();
  reader.onload = function(ev) {
    const img = new Image();
    img.onload = function() {
      const ZIEL = 200;
      const sx = img.width  > img.height ? (img.width  - img.height) / 2 : 0;
      const sy = img.height > img.width  ? (img.height - img.width)  / 2 : 0;
      const seite = Math.min(img.width, img.height);
      const canvas = document.createElement("canvas");
      canvas.width = ZIEL; canvas.height = ZIEL;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(img, sx, sy, seite, seite, 0, 0, ZIEL, ZIEL);
      callback(canvas.toDataURL("image/jpeg", 0.85));
    };
    img.onerror = function() { callback(null); };
    img.src = ev.target.result;
  };
  reader.onerror = function() { callback(null); };
  reader.readAsDataURL(file);
}

// ── Sektion: Mein Profil ────────────────────────────────────────────────────
// Profil = Verknüpfung mit einem Kontakt im Adressbuch (settings.userKontaktId).
// User wählt einen bestehenden Kontakt oder legt einen neuen an. Nach der
// Verknüpfung wird die KontaktDetailKarte gerendert — damit hat das Profil
// automatisch alle Kontakt-Features (Stammdaten, Foto-Upload, Rollen,
// Objektzuweisungen, Notizen, Custom-Felder).
// Migration: alte settings.userProfil-Daten werden einmalig auf den
// verknüpften Kontakt geschrieben, dann ist userProfil leer.
function SektionProfil({ kontakte, setKontakte, ves, settings, setSettings, t, accent }) {
  const userKontakt = kontakte.find(k => k.id === settings.userKontaktId);
  // Edit-Modus extern steuern: bei Auswahl eines bestehenden Kontakts → View;
  // bei „+ Neu anlegen" im Picker → direkt Edit, damit der User weitere Daten
  // ergänzen und speichern kann.
  const [profilEditMode, setProfilEditMode] = useState(false);

  // Beim Wechseln der userKontaktId zurück in den View-Modus — außer wir haben
  // ihn gerade durch eine Neu-Anlage gesetzt (handlePickerCreate).
  const handlePickerChange = (id) => {
    setSettings(s => ({ ...s, userKontaktId: id }));
    setProfilEditMode(false);
  };
  const handlePickerCreate = () => {
    // onCreate feuert NACH onChange, daher hier nur den Edit-Modus aktivieren.
    setProfilEditMode(true);
  };

  // Einmalige Migration aus altem settings.userProfil
  useEffect(() => {
    const p = settings.userProfil || {};
    const hatDaten = !!(p.vorname || p.nachname || p.foto
      || (p.tels && p.tels.length)
      || (p.emails && p.emails.length)
      || p.strasse || p.plzOrt || p.plz || p.ort || p.geburtstag);
    if (!hatDaten || !userKontakt) return;

    const updated = { ...userKontakt };
    if (p.anrede)    updated.anrede   = p.anrede;
    if (p.titel)     updated.titel    = p.titel;
    if (p.vorname)   updated.vorname  = p.vorname;
    if (p.nachname)  updated.nachname = p.nachname;
    if (p.vorname || p.nachname) {
      updated.name = `${p.vorname || ""} ${p.nachname || ""}`.trim();
    }
    if (p.foto)       updated.foto       = p.foto;
    if (p.tels && p.tels.length)     updated.tels   = p.tels;
    if (p.emails && p.emails.length) updated.emails = p.emails;
    if (p.strasse)    updated.strasse    = p.strasse;
    if (p.plz)        updated.plz        = p.plz;
    if (p.ort)        updated.ort        = p.ort;
    if (p.plzOrt && !p.plz && !p.ort) {
      const sp = splitPlzOrt(p.plzOrt);
      updated.plz = sp.plz; updated.ort = sp.ort;
    }
    if (p.geburtstag) updated.geburtstag = p.geburtstag;

    setKontakte(prev => prev.map(k => k.id === userKontakt.id ? updated : k));
    setSettings(s => ({
      ...s,
      userProfil: { anrede: "", vorname: "", nachname: "", funktion: "",
        foto: "", tels: [], emails: [], strasse: "", plz: "", ort: "", geburtstag: "" }
    }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Nur Personen im Picker zur Auswahl
  const personenKontakte = kontakte.filter(k => k.typ === "person");

  // Verknüpfung lösen — Profil zeigt dann wieder den Picker.
  // Der Kontakt selbst bleibt im Adressbuch erhalten.
  const verknuepfungLoesen = () => {
    setSettings(s => ({ ...s, userKontaktId: null }));
    setProfilEditMode(false);
  };

  // Kontakt komplett löschen — entfernt ihn aus dem Adressbuch UND löst die
  // Profil-Verknüpfung. Bestätigung läuft bereits in KDKHeader.
  const profilKontaktLoeschen = () => {
    if (!userKontakt) return;
    setKontakte(prev => prev.filter(k => k.id !== userKontakt.id));
    setSettings(s => ({ ...s, userKontaktId: null }));
    setProfilEditMode(false);
  };

  return (
    <>
      {!userKontakt && (
        <EinstellKarte title="Profil-Verknüpfung" t={t} accent={accent}>
          <div style={{ fontSize: FS.m, color: t.sub, marginBottom: 10, lineHeight: 1.5 }}>
            Wähle einen bestehenden Kontakt aus dem Adressbuch — oder lege im
            Picker einen neuen an („+ Neu anlegen"). Dein Profil-Kontakt
            erscheint dann auch in der Kontakte-Liste.
          </div>
          <KontaktPicker
            value={settings.userKontaktId || null}
            onChange={handlePickerChange}
            onCreate={handlePickerCreate}
            kontakte={personenKontakte}
            setKontakte={setKontakte}
            t={t} accent={accent}/>
        </EinstellKarte>
      )}

      {userKontakt && (
        <KontaktDetailKarte
          k={userKontakt}
          t={t}
          accent={accent}
          ves={ves}
          kontakte={kontakte}
          setKontakte={setKontakte}
          externEditMode={profilEditMode}
          setExternEditMode={setProfilEditMode}
          onUpdate={(updated) => {
            setKontakte(prev => prev.map(k => k.id === userKontakt.id ? updated : k));
          }}
          onDelete={profilKontaktLoeschen}/>
      )}
    </>
  );
}
// ── Sektion: Erscheinungsbild ───────────────────────────────────────────────
// ── PositionSelector: 2×2-Raster zur Wahl der Avatar-Eck-Position (OL/OR/UL/UR).
// Global, damit RollenTabelle und VerwendungenTabelle dieselbe Quelle nutzen.
function PositionSelector({ aktivePosition, onSelect, farbe, disabled, t }) {
  const positionen = [
    { key: "OL", row: 0, col: 0 }, { key: "OR", row: 0, col: 1 },
    { key: "UL", row: 1, col: 0 }, { key: "UR", row: 1, col: 1 },
  ];
  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gridTemplateRows: "1fr 1fr",
      gap: 2, width: 22, height: 22, flexShrink: 0, opacity: disabled ? 0.35 : 1 }}>
      {positionen.map(p => {
        const ist = aktivePosition === p.key;
        return (
          <button key={p.key} disabled={disabled}
            onClick={(e) => { e.stopPropagation(); if (!disabled) onSelect(p.key); }}
            title={`Ecke ${p.key}`}
            style={{ width: 10, height: 10, padding: 0,
              background: ist ? farbe : "transparent",
              border: `1px solid ${ist ? farbe : t.border}`,
              borderRadius: RAD.sm, cursor: disabled ? "default" : "pointer",
              gridRow: p.row + 1, gridColumn: p.col + 1 }}/>
        );
      })}
    </div>
  );
}


// ── HandlungsbedarfTabelle — pro Frist-Quelle: zählt-Schalter + Vorlauf-Tage ─
// Speist settings.handlungsbedarf = { quellen:{id:bool}, vorlauf:{id:tage} }.
// Greift in objektHandlungsbedarf (Status-Punkt an Objekten in der Liste).
function HandlungsbedarfTabelle({ settings, save, t, accent }) {
  const cfg = settings.handlungsbedarf || {};
  // Feste Vorlauf-Stufen (Tage). Slider-Position 0 = aus ("wird nicht
  // angezeigt"), Position 1..N = STUFEN[0..N-1]. Der frühere Toggle entfällt.
  const STUFEN = [3, 7, 14, 21, 30, 60, 90, 120, 150, 180];
  const stufeIdx = (v) => {
    let best = 0, bestDiff = Infinity;
    for (let i = 0; i < STUFEN.length; i++) {
      const d = Math.abs(STUFEN[i] - v);
      if (d < bestDiff) { bestDiff = d; best = i; }
    }
    return best;
  };
  // Setzt Quelle an/aus UND Vorlauf in einem Rutsch (kein doppeltes save).
  const setStufe = (id, idx) => {
    const cur = settings.handlungsbedarf || {};
    if (idx === 0) {
      save({ handlungsbedarf: { ...cur, quellen: { ...(cur.quellen || {}), [id]: false } } });
    } else {
      save({ handlungsbedarf: { ...cur,
        quellen: { ...(cur.quellen || {}), [id]: true },
        vorlauf: { ...(cur.vorlauf || {}), [id]: STUFEN[idx - 1] } } });
    }
  };
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      {HANDLUNGSBEDARF_QUELLEN.map(q => {
        const an = hbQuelleAktiv(cfg, q.id);
        const vorlauf = hbVorlauf(cfg, q.id);
        const stufe = an ? stufeIdx(vorlauf) + 1 : 0;
        return (
          <div key={q.id} style={{ display: "flex", alignItems: "center", gap: 10,
            padding: "8px", borderRadius: RAD.sm,
            background: an ? "transparent" : t.surface + "80",
            border: `1px solid ${t.border}40` }}>
            <div style={{ flex: 1, minWidth: 0, fontSize: FS.m, fontWeight: FW.medium,
              color: an ? t.text : t.muted, lineHeight: 1.3 }}>{q.label}</div>
            <span style={{ fontSize: FS.s, fontWeight: FW.medium,
              fontVariantNumeric: "tabular-nums", minWidth: 116, textAlign: "right",
              color: an ? t.sub : t.muted, fontStyle: an ? "normal" : "italic", flexShrink: 0 }}>
              {an ? `${vorlauf} Tage` : "wird nicht angezeigt"}
            </span>
            <input type="range" min={0} max={STUFEN.length} step={1}
              value={stufe}
              onChange={e => setStufe(q.id, parseInt(e.target.value, 10))}
              style={{ width: 150, flexShrink: 0, accentColor: an ? accent : t.muted,
                cursor: "pointer", height: 24 }}/>
          </div>
        );
      })}
    </div>
  );
}

function SektionErscheinungsbild({ settings, setSettings, rawSettings, t, accent, mode, setMode }) {
  const save = (partial) => setSettings(s => ({ ...s, ...partial }));
  // Farb-Intensität-Wert für den Slider (rohe Settings, damit der echte Wert
  // angezeigt wird). Vor dem return als const,
  // KEINE IIFE in JSX (Safari/iOS-Regel).
  const farbIntRoh = rawSettings || settings;
  const farbIntWert = farbIntRoh.farbIntensitaet != null ? farbIntRoh.farbIntensitaet : 100;
  return (
    <>
    <EinstellKarte title="Erscheinungsbild" t={t} accent={accent}>
      <EinstellZeile label="Schriftgröße" sub="Skaliert Texte und Bedienelemente in der gesamten App" t={t}>
        <SegmentControl t={t} accent={accent}
          value={settings.dichte || "normal"}
          onChange={id => save({ dichte: id })}
          options={[
            { id: "compact", label: "Klein" },
            { id: "normal",  label: "Normal" },
            { id: "relaxed", label: "Groß" },
          ]}/>
      </EinstellZeile>
      <EinstellZeile label="Objekte & Kontakte als"
        sub="Übersicht als große Karten oder als kompakte Liste (mehr pro Bildschirm)" t={t}>
        <SegmentControl t={t} accent={accent}
          value={settings.listenAnsicht || "karten"}
          onChange={id => save({ listenAnsicht: id })}
          options={[
            { id: "karten", label: "Karten" },
            { id: "liste",  label: "Liste" },
          ]}/>
      </EinstellZeile>
      <EinstellZeile label="Detailfenster-Breite" sub="Wie breit das geöffnete Detailfenster rechts ist, wenn du ein Objekt oder einen Kontakt antippst. Liste bzw. Karten nehmen den Rest." t={t}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 160 }}>
          <span style={{ fontSize: FS.s, fontWeight: FW.medium, color: t.sub,
            fontVariantNumeric: "tabular-nums", minWidth: 56, textAlign: "right" }}>
            {Math.max(400, Math.min(1200, settings.detailMinBreite != null ? settings.detailMinBreite : 400))} px
          </span>
          <input type="range" min={400} max={1200} step={20}
            value={Math.max(400, Math.min(1200, settings.detailMinBreite != null ? settings.detailMinBreite : 400))}
            onChange={e => save({ detailMinBreite: parseInt(e.target.value, 10) })}
            style={{ flex: 1, accentColor: accent, cursor: "pointer", height: 24 }}/>
        </div>
      </EinstellZeile>
      <EinstellZeile label="Detail-Maximalanteil" sub="Höchster Anteil der Breite, den das Detailfenster einnehmen darf, solange die Liste daneben steht. Reicht der Platz für deine eingestellte Detailbreite nicht, schrumpft das Detail bis zu diesem Anteil mit — erst dann weicht die Liste ganz. So bleibt das Verhältnis auf kleineren Bildschirmen ausgewogen." t={t}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 160 }}>
          <span style={{ fontSize: FS.s, fontWeight: FW.medium, color: t.sub,
            fontVariantNumeric: "tabular-nums", minWidth: 56, textAlign: "right" }}>
            {Math.round(Math.max(0.4, Math.min(0.8, settings.detailMaxAnteil != null ? settings.detailMaxAnteil : 0.6)) * 100)} %
          </span>
          <input type="range" min={40} max={80} step={5}
            value={Math.round(Math.max(0.4, Math.min(0.8, settings.detailMaxAnteil != null ? settings.detailMaxAnteil : 0.6)) * 100)}
            onChange={e => save({ detailMaxAnteil: parseInt(e.target.value, 10) / 100 })}
            style={{ flex: 1, accentColor: accent, cursor: "pointer", height: 24 }}/>
        </div>
      </EinstellZeile>
      {(settings.listenAnsicht || "karten") === "karten" && (
        <EinstellZeile label="Karten neben dem Detail" sub="Wie viele Karten-Spalten neben dem geöffneten Detailfenster stehen bleiben (Desktop). Die Kartenbreite ergibt sich aus dem verbleibenden Platz." t={t}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 160 }}>
            <span style={{ fontSize: FS.s, fontWeight: FW.medium, color: t.sub,
              fontVariantNumeric: "tabular-nums", minWidth: 56, textAlign: "right" }}>
              {settings.kartenSpalten != null ? settings.kartenSpalten : 2} {(settings.kartenSpalten != null ? settings.kartenSpalten : 2) === 1 ? "Spalte" : "Spalten"}
            </span>
            <input type="range" min={1} max={5} step={1}
              value={settings.kartenSpalten != null ? settings.kartenSpalten : 2}
              onChange={e => save({ kartenSpalten: parseInt(e.target.value, 10) })}
              style={{ flex: 1, accentColor: accent, cursor: "pointer", height: 24 }}/>
          </div>
        </EinstellZeile>
      )}
      {/* Farb-Intensität: stufenloser Regler (ersetzt den früheren An/Aus-
          Schalter "Mehr Farbe"). 100 % = volle Akzentfarben, 0 % = neutrales
          Grau. Wert wird global an toGrau durchgereicht. Steht bewusst unter
          den Karten-/Detail-Reglern. */}
      <EinstellZeile label="Farb-Intensität" sub="Wie kräftig die Akzentfarben in der ganzen App wirken (inkl. Header). 100 % = volle Farben, 0 % = neutrales Grau für ein ruhigeres, professionelleres Erscheinungsbild. Alles dazwischen mischt stufenlos." t={t}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 160 }}>
          <span style={{ fontSize: FS.s, fontWeight: FW.medium, color: t.sub,
            fontVariantNumeric: "tabular-nums", minWidth: 42, textAlign: "right" }}>
            {farbIntWert} %
          </span>
          <input type="range" min={0} max={100} step={5}
            value={farbIntWert}
            onChange={e => save({ farbIntensitaet: parseInt(e.target.value, 10) })}
            style={{ flex: 1, accentColor: accent, cursor: "pointer", height: 24 }}/>
        </div>
      </EinstellZeile>
      <EinstellZeile label="Dunkelmodus" sub="Helles oder dunkles Design" t={t}>
        <Toggle value={mode === "dark"} onChange={v => setMode(v ? "dark" : "light")} color={accent}/>
      </EinstellZeile>
      <EinstellZeile label="Höherer Kontrast" sub="Sekundäre Texte deutlich heller bzw. dunkler – bessere Lesbarkeit" t={t}>
        <Toggle value={!!settings.hoherKontrast}
          onChange={v => save({ hoherKontrast: v })} color={accent}/>
      </EinstellZeile>
      <EinstellZeile label="Legende bei Kontakten" sub="Aufklappbare Symbol-Erklärung über der Kontaktliste anzeigen" t={t}>
        <Toggle value={settings.legendeKontakte !== false}
          onChange={v => save({ legendeKontakte: v })} color={accent}/>
      </EinstellZeile>
      <EinstellZeile label="Legende bei Objekten" sub="Aufklappbare Symbol-Erklärung über der Objektliste anzeigen" t={t}>
        <Toggle value={settings.legendeObjekte !== false}
          onChange={v => save({ legendeObjekte: v })} color={accent}/>
      </EinstellZeile>
      {/* Master-Schalter für beide Statusleisten (Objekte + Kontakte). An =
          mindestens eine an; Umlegen setzt beide gemeinsam. Die getrennten
          Einzelschalter liegen im Menü „Statusleiste". */}
      <EinstellZeile label="Statusleisten anzeigen"
        sub={"Farbige Hinweise an Objekt- und Kontakt-Karten gemeinsam ein-/ausblenden (einzeln steuerbar im Menü „Statusleiste“)"} t={t}>
        <Toggle value={settings.statusLeisteObjekt !== false || settings.statusLeisteKontakt !== false}
          onChange={v => save({ statusLeisteObjekt: v, statusLeisteKontakt: v })} color={accent}/>
      </EinstellZeile>
    </EinstellKarte>

    <EinstellKarte title="Header" t={t} accent={accent}>
      <EinstellZeile label="Filter anzeigen"
        sub="Wenn aus: Logo & HV-Name werden stattdessen mittig angezeigt" t={t}>
        <Toggle value={settings.filterAktiv}
          onChange={v => save({ filterAktiv: v })} color={accent}/>
      </EinstellZeile>
      <EinstellZeile label="Hell-/Dunkelmodus-Schalter anzeigen"
        sub="Sonne-/Mond-Button im Header (Modus kann immer hier unter Erscheinungsbild gewechselt werden)" t={t}>
        <Toggle value={settings.headerZeigeDunkelmodus !== false}
          onChange={v => save({ headerZeigeDunkelmodus: v })} color={accent}/>
      </EinstellZeile>
      <EinstellZeile label="Profilbild anzeigen"
        sub="Profilbild oben rechts (Zahnrad wenn aus). Einstellungen sind immer erreichbar." t={t}>
        <Toggle value={settings.headerZeigeAvatar}
          onChange={v => save({ headerZeigeAvatar: v })} color={accent}/>
      </EinstellZeile>
      <EinstellZeile label="Suche anzeigen"
        sub="Suchleiste im Header. Wenn aus, ist die Suche im Header ausgeblendet." t={t}>
        <Toggle value={settings.headerZeigeSuche !== false}
          onChange={v => save({ headerZeigeSuche: v })} color={accent}/>
      </EinstellZeile>
    </EinstellKarte>

    {/* ── System-Akzent ── direkt unter Erscheinungsbild, immer sichtbar
        (auch im seriös-Modus), weil Logo "Da", Zahnrad/Profil und
        Bearbeiten-Stift die App-Identität repräsentieren und bewusst farbig
        bleiben sollen. */}
    <EinstellKarte title="System-Akzent" t={t} accent={accent}>
      <div style={{ fontSize: FS.m, color: t.sub, marginBottom: 12, lineHeight: 1.5 }}>
        Akzentfarbe für Logo &bdquo;Da&ldquo;, Zahnrad/Profil-Button und
        Bearbeiten-Stift. Bleibt auch im Modus &bdquo;Weniger Farbe&ldquo; aktiv.
      </div>
      <div style={{
        display: "flex", alignItems: "center", gap: 10,
        padding: "7px 0",
      }}>
        <div style={{
          width: 28, height: 28, borderRadius: RAD.ms,
          background: ((rawSettings || settings).systemFarbe || ACCENT) + "25",
          display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
        }}>
          <I name="settings" size={14} color={(rawSettings || settings).systemFarbe || ACCENT}/>
        </div>
        <div style={{ flex: 1, minWidth: 0, fontSize: FS.l, color: t.text }}>System-Akzent</div>
        <FarbPicker value={(rawSettings || settings).systemFarbe || ACCENT}
          onChange={c => save({ systemFarbe: c })}
          t={t} verwendeteFarben={sammleVerwendeteFarben(rawSettings || settings)}/>
      </div>
    </EinstellKarte>

    {/* ── Farben ── nur ausblenden, wenn die Intensität auf 0 % steht (alles
        grau → Farbwahl sinnlos). Bei jeder Teilfarbe bleiben die Picker da. */}
    {((rawSettings || settings).farbIntensitaet != null
        ? (rawSettings || settings).farbIntensitaet : 100) > 0 && (
    <EinstellKarte title="Farben" t={t} accent={accent}>

      <div style={{ marginBottom: 14 }}>
        <div style={{ fontSize: FS.s, fontWeight: FW.bold, color: t.muted,
          textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 10 }}>
          Dashboard-Kacheln
        </div>
        {[...((rawSettings || settings).kacheln || [])].sort((a, b) => a.reihenfolge - b.reihenfolge).map(k => (
          <div key={k.id} style={{
            display: "flex", alignItems: "center", gap: 10,
            padding: "7px 0", borderBottom: "1px solid " + t.border + "20",
          }}>
            <div style={{
              width: 28, height: 28, borderRadius: RAD.ms, background: k.farbe + "25",
              display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
            }}>
              <I name={k.icon || "grid"} size={14} color={k.farbe}/>
            </div>
            <span style={{ flex: 1, fontSize: FS.l, color: t.text }}>{k.label}</span>
            <FarbPicker value={k.farbe}
              onChange={c => save({ kacheln: (rawSettings || settings).kacheln.map(x => x.id === k.id ? { ...x, farbe: c } : x) })}
              t={t} verwendeteFarben={sammleVerwendeteFarben(rawSettings || settings)}/>
          </div>
        ))}
      </div>

      {[
        { label: "Personen-Rollen", data: (rawSettings || settings).rollen || DEFAULT_ROLLEN, key: "rollen" },
        { label: "Gewerke (Firmen-Fachgebiet)", data: (rawSettings || settings).firmenRollen || DEFAULT_GEWERKE_LISTE, key: "firmenRollen" },
        { label: "Leistungen / Zuständigkeiten (am Objekt)", data: (rawSettings || settings).leistungen || DEFAULT_LEISTUNGEN, key: "leistungen" },
        { label: "Verwendungen",    data: (rawSettings || settings).verwendungen || DEFAULT_VERWENDUNGEN, key: "verwendungen" },
      ].map(gruppe => (
        <div key={gruppe.key} style={{ marginBottom: 14 }}>
          <div style={{ fontSize: FS.s, fontWeight: FW.bold, color: t.muted,
            textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 10 }}>
            {gruppe.label}
          </div>
          {[...gruppe.data].sort((a, b) => a.name.localeCompare(b.name, "de")).map(r => (
            <div key={r.name} style={{
              display: "flex", alignItems: "center", gap: 10,
              padding: "7px 0", borderBottom: "1px solid " + t.border + "20",
              opacity: r.aktiv === false ? 0.4 : 1 }}>
              <div style={{ width: 28, height: 28, borderRadius: RAD.full,
                background: r.color + "25", border: "1.5px solid " + r.color + "60",
                display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <span style={{ fontSize: FS.xxs, fontWeight: FW.heavy, color: r.color }}>{r.kuerzel}</span>
              </div>
              <span style={{ flex: 1, fontSize: FS.l, color: t.text }}>{r.name}</span>
              <FarbPicker value={r.color}
                onChange={c => {
                  const realData = (rawSettings || settings)[gruppe.key] || gruppe.data;
                  save({ [gruppe.key]: realData.map(x => x.name === r.name ? { ...x, color: c } : x) });
                }}
                t={t} verwendeteFarben={sammleVerwendeteFarben(rawSettings || settings)}/>
            </div>
          ))}
        </div>
      ))}

    </EinstellKarte>
    )}

    </>
  );
}

// ── Sektion: Kontakte (Anzeige, Avatare, Badges, …) ────────────────────────
// Platzhalter — Inhalte folgen.
function SektionKontakte({ settings, setSettings, t, accent, kontakte = [] }) {
  const save = (partial) => setSettings(s => ({ ...s, ...partial }));
  // Sichtbarkeit der Kontaktart-Pillen neben der Überschrift „Kontakte".
  const kart = settings.filterKontaktarten || { person: true, firma: true };
  const [rollenTab, setRollenTab] = useState("personen"); // "personen" | "firmen"
  // Wiederverwendbare Pill-Gruppe für Auswahl-Optionen mit 2-3 sichtbaren Werten.
  // width:100% damit die Gruppe in der EinstellZeile (nach Wrap auf Mobile) die
  // volle Breite einnimmt — konsistent zum Tab-Switcher in RollenTabelle.
  const PillGroup = ({ value, options, onChange }) => (
    <div style={{ display: "flex", gap: 4, padding: 3, width: "100%",
      background: t.surface, border: `1px solid ${t.border}`, borderRadius: RAD.md }}>
      {options.map(opt => {
        const ist = value === opt.id;
        return (
          <button key={opt.id} onClick={() => onChange(opt.id)} style={{
            flex: 1, padding: "6px 10px", borderRadius: RAD.sm, cursor: "pointer",
            background: ist ? accent : "transparent",
            border: "none", color: ist ? getContrastColor(accent) : t.sub,
            fontSize: FS.m, fontWeight: FW.medium, fontFamily: "inherit",
            textAlign: "center",
          }}>
            {opt.label}
          </button>
        );
      })}
    </div>
  );
  return (
    <>
      {/* Sortierung & Name-Format — gemeinsame Einstellung */}
      <EinstellKarte title="Anzeige" t={t} accent={accent}>
        <EinstellZeile label="Name-Format & Sortierung"
          sub="Format der Anzeige in Liste, Picker und Detail-Kopfzeile — sortiert wird automatisch nach dem zuerst gezeigten Namen." t={t}>
          <PillGroup
            value={settings.kontakteNameFormat || "vorname-nachname"}
            options={[
              { id: "vorname-nachname", label: "Vorname Nachname" },
              { id: "nachname-vorname", label: "Nachname, Vorname" },
            ]}
            onChange={(v) => save({ kontakteNameFormat: v })}/>
        </EinstellZeile>
        <EinstellZeile label="Alphabetische Trenner"
          sub="Zeigt in der Kontaktliste eine Buchstaben-Überschrift mit Linie vor jeder neuen Anfangsbuchstaben-Gruppe (A, B, C …)." t={t}>
          <Toggle value={settings.kontakteAlphaTrenner !== false}
            onChange={v => save({ kontakteAlphaTrenner: v })} color={accent}/>
        </EinstellZeile>
      </EinstellKarte>

      {/* Rollen-Verwaltung: Anlegen/Bearbeiten/Löschen + Position/Sichtbarkeit.
          Getrennt nach Personen-Rollen und Firmen (Gewerke). Die FARBE wird
          unter Erscheinungsbild gesetzt (analog zu den Objekt-Verwendungen). */}
      <EinstellKarte title="Rollen, Gewerke & Leistungen" t={t} accent={accent}>
        <div style={{ fontSize: FS.s, color: t.muted, marginBottom: 10, lineHeight: 1.5 }}>
          Anlegen, Bearbeiten und Anzeige (Eck-Icon, Position, Karten-Badge).
          Farben werden unter Erscheinungsbild eingestellt.
        </div>
        <PillGroup
          value={rollenTab}
          options={[
            { id: "personen", label: "Personen-Rollen" },
            { id: "firmen", label: "Firmen / Gewerke" },
            { id: "leistungen", label: "Leistungen" },
          ]}
          onChange={setRollenTab}/>
        <div style={{ marginTop: 12 }}>
          {rollenTab === "personen" ? (
            <RollenTabelle settings={settings} setSettings={setSettings} t={t} accent={accent}
              gruppeKey="rollen" defaults={DEFAULT_ROLLEN} einheit="Rolle" istFirma={false}/>
          ) : rollenTab === "firmen" ? (
            <RollenTabelle settings={settings} setSettings={setSettings} t={t} accent={accent}
              gruppeKey="firmenRollen" defaults={DEFAULT_GEWERKE_LISTE} einheit="Gewerk" istFirma={true}/>
          ) : (
            <RollenTabelle settings={settings} setSettings={setSettings} t={t} accent={accent}
              gruppeKey="leistungen" defaults={DEFAULT_LEISTUNGEN} einheit="Leistung" istFirma={true} ohneBadge={true}/>
          )}
        </div>
      </EinstellKarte>

      {/* Sicherheit: Löschen-Button für Kontakte freischalten (getrennt von den
          Objekten — eigener Schalter). */}
      <EinstellKarte title="Sicherheit" t={t} accent={accent}>
        <EinstellZeile label="Kontakte löschen erlauben"
          sub={'Zeigt den Löschen-Button bei Kontakten. Aus Sicherheitsgründen standardmäßig aus — Löschen entfernt den Kontakt mit allen Daten unwiderruflich.'} t={t}>
          <Toggle value={settings.loeschenErlaubtKontakte === true}
            onChange={v => save({ loeschenErlaubtKontakte: v })} color={accent}/>
        </EinstellZeile>
      </EinstellKarte>

      {/* Filter-Pillen neben der Überschrift „Kontakte" (feiner Filter
          INNERHALB des großen Header-Filters) */}
      <EinstellKarte title="Filter-Pillen: Kontaktarten" t={t} accent={accent}>
        <div style={{ fontSize: FS.m, color: t.sub, marginBottom: 8, lineHeight: 1.4 }}>
          Welche Arten als Filter-Pillen neben der Überschrift „Kontakte" erscheinen. Klick auf den Schriftzug „Kontakte" setzt zurück auf alle.
        </div>
        <div style={{ fontSize: FS.xs, fontWeight: FW.bold, color: t.muted,
          textTransform: "uppercase", letterSpacing: "0.05em",
          marginTop: 4, marginBottom: 4 }}>Hauptarten</div>
        {KONTAKTARTEN_KATEGORIEN.map(a => (
          <EinstellZeile key={a.id} label={a.label} t={t}>
            <Toggle value={!!kart[a.id]}
              onChange={v => save({ filterKontaktarten: { ...kart, [a.id]: v } })}
              color={accent}/>
          </EinstellZeile>
        ))}
        <div style={{ fontSize: FS.xs, fontWeight: FW.bold, color: t.muted,
          textTransform: "uppercase", letterSpacing: "0.05em",
          marginTop: 12, marginBottom: 4 }}>Personen-Rollen</div>
        {(settings.rollen || DEFAULT_ROLLEN).filter(r => r.aktiv !== false).map(r => {
          const id = "p_" + r.name;
          return (
            <EinstellZeile key={id} label={r.name} t={t}>
              <Toggle value={!!kart[id]}
                onChange={v => save({ filterKontaktarten: { ...kart, [id]: v } })}
                color={r.color || accent}/>
            </EinstellZeile>
          );
        })}
        <div style={{ fontSize: FS.xs, fontWeight: FW.bold, color: t.muted,
          textTransform: "uppercase", letterSpacing: "0.05em",
          marginTop: 12, marginBottom: 4 }}>Firmen-Rollen</div>
        {(settings.firmenRollen || DEFAULT_GEWERKE_LISTE).filter(r => r.aktiv !== false).map(r => {
          const id = "f_" + r.name;
          return (
            <EinstellZeile key={id} label={r.name} t={t}>
              <Toggle value={!!kart[id]}
                onChange={v => save({ filterKontaktarten: { ...kart, [id]: v } })}
                color={r.color || accent}/>
            </EinstellZeile>
          );
        })}
      </EinstellKarte>

      {/* Eigene Kontakt-Gruppen → Pillen im Kontakte-Header */}
      <SektionGruppen titel="Kontakt-Gruppen" t={t} accent={accent}
        beschreibung="Eigene Gruppen als Filter-Pillen im Kontakte-Header — kombinierbar mit Personen/Firmen. Manuell zusammenstellen oder nach Rollen — Kriterien-Gruppen halten sich selbst aktuell."
        gruppen={settings.kontaktGruppen || []}
        onChange={(neu) => setSettings(s => ({ ...s, kontaktGruppen: neu }))}
        manuellTitel="Manuell auswählen" kriterienTitel="Nach Rollen"
        kriterienGruppen={[
          { key: "rollen", titel: "Rollen",
            chips: [...(settings.rollen || []), ...(settings.firmenRollen || [])]
              .filter(r => r && r.aktiv !== false)
              .map(r => ({ id: r.name, label: r.name, kurz: r.kuerzel || r.name })) },
        ]}
        eintraege={kontakte.map(k => ({ id: k.id,
          label: k.typ === "firma" ? (k.name || "") : (((k.vorname || "") + " " + (k.nachname || "")).trim() || k.name || ""),
          sub: k.typ === "firma" ? "Firma" : "Person",
          passtKriterien: (g) => kontaktInGruppe(k, g) }))}/>
    </>
  );
}

// ── Sektion: Objekte (Liegenschaft-Tab: Einheit-Übersicht) ──────────────────
// ── Sektion: Eigene Gruppen (für Objekte UND Kontakte, parametrisiert) ──────
// Akkordeon-Liste der Gruppen; je Gruppe: Name, Sichtbarkeits-Toggle (Pille im
// Header), Modus Manuell (Häkchenliste) oder Nach Kriterien (Chips), Löschen.
function SektionGruppen({ titel, beschreibung, gruppen, onChange, t, accent,
  eintraege, kriterienGruppen, kriterienTitel, manuellTitel }) {
  const [offenId, setOffenId] = useState(null);
  const [suche, setSuche] = useState("");
  const liste = gruppen || [];
  const upd = (id, patch) => onChange(liste.map(g => g.id === id ? { ...g, ...patch } : g));
  // Auto-Benennung bei Kriterien-Gruppen: Name = gewählte Kriterien-Labels,
  // Kürzel = deren Abkürzungen (z. B. Rollen-Kürzel). Greift nur, solange der
  // Name nicht von Hand geändert wurde ("Neue Gruppe" oder letzter Auto-Name).
  const autoBenennung = (g) => {
    const labels = [], kurze = [];
    (kriterienGruppen || []).forEach(kg => {
      const sel = (g.kriterien && g.kriterien[kg.key]) || [];
      kg.chips.forEach(c => { if (sel.indexOf(c.id) >= 0) { labels.push(c.label); kurze.push(c.kurz || c.label); } });
    });
    return { name: labels.join(" + "), kurz: kurze.join("+") };
  };
  const toggleKriterium = (g, key, cid) => {
    const krit = (g.kriterien && g.kriterien[key]) || [];
    const neuKrit = { ...(g.kriterien || {}),
      [key]: krit.indexOf(cid) >= 0 ? krit.filter(x => x !== cid) : [...krit, cid] };
    const vorher = autoBenennung(g);
    const istAuto = g.name === "Neue Gruppe" || g.name === vorher.name;
    const nachher = autoBenennung({ ...g, kriterien: neuKrit });
    upd(g.id, istAuto
      ? { kriterien: neuKrit, name: nachher.name || "Neue Gruppe", kurz: nachher.kurz }
      : { kriterien: neuKrit });
  };
  // Löschen mit Inline-Zwei-Schritt statt confirm(): window.confirm ist in
  // iOS-Standalone-PWAs auf etlichen Versionen stumm kaputt (liefert false) —
  // erster Tap macht den Button scharf („Löschen?"), zweiter Tap löscht.
  const [loeschBereitId, setLoeschBereitId] = useState(null);
  const del = (g) => {
    if (loeschBereitId !== g.id) { setLoeschBereitId(g.id); return; }
    onChange(liste.filter(x => x.id !== g.id));
    setLoeschBereitId(null);
    if (offenId === g.id) setOffenId(null);
  };
  const neu = () => {
    const g = { id: "g" + Date.now(), name: "Neue Gruppe", sichtbar: true,
      modus: "manuell", mitglieder: [], kriterien: {} };
    onChange([...liste, g]);
    setOffenId(g.id);
    setSuche("");
  };
  const anzahlIn = (g) => g.modus === "kriterien"
    ? eintraege.filter(e => e.passtKriterien(g)).length
    : (g.mitglieder || []).length;
  const modusPill = (g, id, label) => (
    <button onClick={() => upd(g.id, { modus: id })}
      style={{ padding: "5px 10px", borderRadius: RAD.pill, cursor: "pointer", fontFamily: "inherit",
        fontSize: FS.xs, fontWeight: FW.bold,
        background: g.modus === id ? accent + "22" : "transparent",
        border: `1px solid ${g.modus === id ? accent : t.border}`,
        color: g.modus === id ? accent : t.sub }}>
      {label}
    </button>
  );
  return (
    <EinstellKarte title={titel} t={t} accent={accent}>
      <div style={{ fontSize: FS.s, color: t.sub, marginBottom: 10 }}>{beschreibung}</div>
      <button onClick={neu}
        style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 12px",
          marginBottom: liste.length > 0 ? 10 : 0,
          borderRadius: RAD.sm, cursor: "pointer", fontFamily: "inherit",
          fontSize: FS.s, fontWeight: FW.bold, background: accent + "14",
          border: `1px solid ${accent}40`, color: accent }}>
        <I name="plus" size={12} color={accent}/>Gruppe anlegen
      </button>
      {liste.map(g => {
        const offen = offenId === g.id;
        const treffer = eintraege.filter(e =>
          e.label.toLowerCase().indexOf(suche.toLowerCase()) >= 0).slice(0, 40);
        return (
          <div key={g.id} style={{ border: `1px solid ${offen ? accent : t.border}`,
            borderRadius: offen ? RAD.lg : RAD.md, marginBottom: 8,
            background: offen ? accent + "08" : "transparent" }}>
            <div onClick={() => { setOffenId(offen ? null : g.id); setSuche(""); setLoeschBereitId(null); }}
              style={{ display: "flex", alignItems: "center", gap: 8,
                padding: "9px 12px", cursor: "pointer" }}>
              {offen ? (
                <span onClick={e => e.stopPropagation()}
                  style={{ flex: 1, minWidth: 0, display: "flex", gap: 6 }}>
                  <input value={g.name} autoFocus
                    onChange={e => upd(g.id, { name: e.target.value })}
                    style={{ flex: 1, minWidth: 0, boxSizing: "border-box", background: t.surface,
                      border: `1px solid ${t.border}`, borderRadius: RAD.sm, padding: "6px 9px",
                      fontSize: 16, color: t.text, outline: "none", fontFamily: "inherit" }}/>
                  <input value={g.kurz || ""} placeholder="Kürzel"
                    title="Abkürzung für die Header-Pille"
                    onChange={e => upd(g.id, { kurz: e.target.value })}
                    style={{ width: 76, flexShrink: 0, boxSizing: "border-box", background: t.surface,
                      border: `1px solid ${t.border}`, borderRadius: RAD.sm, padding: "6px 9px",
                      fontSize: 16, color: t.text, outline: "none", fontFamily: "inherit" }}/>
                </span>
              ) : (
                <span style={{ flex: 1, minWidth: 0, fontSize: FS.m, fontWeight: FW.medium,
                  color: t.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {g.name}
                  <span style={{ color: t.muted, fontWeight: FW.regular }}> ({anzahlIn(g)})</span>
                </span>
              )}
              <span onClick={e => e.stopPropagation()} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ fontSize: FS.xs, color: t.muted }}>Pille</span>
                <Toggle value={g.sichtbar !== false} color={accent}
                  onChange={v => upd(g.id, { sichtbar: v })}/>
              </span>
              <button onClick={e => { e.stopPropagation(); del(g); }}
                title={loeschBereitId === g.id ? "Nochmal tippen zum Löschen" : "Gruppe löschen"}
                aria-label="Gruppe löschen"
                style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 4,
                  height: 24, minWidth: 24, flexShrink: 0, cursor: "pointer",
                  padding: loeschBereitId === g.id ? "0 8px" : 0,
                  background: loeschBereitId === g.id ? "#EF4444" : "transparent",
                  border: "1px solid " + (loeschBereitId === g.id ? "#EF4444" : "#EF444440"),
                  borderRadius: RAD.sm, fontFamily: "inherit",
                  fontSize: FS.xs, fontWeight: FW.bold,
                  color: loeschBereitId === g.id ? "#fff" : "#EF4444" }}>
                {loeschBereitId === g.id ? "Löschen?" : <I name="x" size={12} color="#EF4444"/>}
              </button>
            </div>
            {offen && (
              <div style={{ padding: "0 12px 11px 12px" }}>
                <div style={{ display: "flex", gap: 6, marginBottom: 9 }}>
                  {modusPill(g, "manuell", manuellTitel)}
                  {modusPill(g, "kriterien", kriterienTitel)}
                </div>
                {g.modus === "kriterien" ? (
                  <div>
                    {(kriterienGruppen || []).map(kg => (
                      <div key={kg.key} style={{ marginBottom: 8 }}>
                        {kriterienGruppen.length > 1 && (
                          <div style={{ fontSize: FS.xs, fontWeight: FW.bold, color: t.muted,
                            textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 5 }}>{kg.titel}</div>
                        )}
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                          {kg.chips.map(c => {
                            const krit = (g.kriterien && g.kriterien[kg.key]) || [];
                            const an = krit.indexOf(c.id) >= 0;
                            return (
                              <button key={c.id} onClick={() => toggleKriterium(g, kg.key, c.id)}
                                style={{ padding: "5px 10px", borderRadius: RAD.pill, cursor: "pointer",
                                  fontFamily: "inherit", fontSize: FS.xs, fontWeight: FW.bold,
                                  background: an ? accent + "22" : "transparent",
                                  border: `1px solid ${an ? accent : t.border}`,
                                  color: an ? accent : t.sub }}>
                                {c.label}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <>
                    <input value={suche} onChange={e => setSuche(e.target.value)}
                      placeholder="Suchen…"
                      style={{ width: "100%", boxSizing: "border-box", background: t.surface,
                        border: `1px solid ${t.border}`, borderRadius: RAD.sm, padding: "8px 10px",
                        fontSize: 16, color: t.text, outline: "none", fontFamily: "inherit",
                        marginBottom: 7 }}/>
                    <div style={{ maxHeight: 260, overflowY: "auto" }}>
                      {treffer.map(e => {
                        const an = (g.mitglieder || []).indexOf(e.id) >= 0;
                        return (
                          <label key={e.id} style={{ display: "flex", alignItems: "center", gap: 9,
                            padding: "6px 2px", cursor: "pointer", userSelect: "none" }}>
                            <input type="checkbox" checked={an}
                              onChange={() => upd(g.id, { mitglieder: an
                                ? (g.mitglieder || []).filter(x => x !== e.id)
                                : [...(g.mitglieder || []), e.id] })}
                              style={{ accentColor: accent }}/>
                            <span style={{ flex: 1, minWidth: 0, fontSize: FS.m, color: t.text,
                              overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                              {e.label}
                              {e.sub && <span style={{ color: t.muted, fontSize: FS.xs }}> · {e.sub}</span>}
                            </span>
                          </label>
                        );
                      })}
                      {treffer.length === 0 && (
                        <div style={{ fontSize: FS.s, color: t.muted, fontStyle: "italic", padding: "6px 0" }}>
                          Keine Treffer.
                        </div>
                      )}
                    </div>
                  </>
                )}
                <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 10 }}>
                  <button onClick={() => setOffenId(null)}
                    title="Fertig — Gruppe schließen" aria-label="Fertig"
                    style={{ display: "flex", alignItems: "center", gap: 5,
                      padding: "6px 12px", background: accent + "15",
                      border: `1px solid ${accent}40`, borderRadius: RAD.sm,
                      fontSize: FS.s, fontWeight: FW.medium, color: accent,
                      cursor: "pointer", fontFamily: "inherit" }}>
                    <I name="check" size={12} color={accent}/>Fertig
                  </button>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </EinstellKarte>
  );
}

function SektionObjekte({ settings, setSettings, t, accent, ves = [] }) {
  const save = (partial) => setSettings(s => ({ ...s, ...partial }));
  // Sichtbarkeit der Verwaltungsart-Pillen neben der Überschrift „Objekte".
  const verw = settings.filterVerwaltungsarten || { weg: true, miet: false, gewerbe: false, sev: false };
  return (
    <>
      {/* ── Handlungsbedarf-Punkt ── welche Fristen den Status-Punkt an Objekten
          bestimmen und ab wann Gelb greift (DESIGN §36). Anker-id für den
          Sprung aus der Objekt-Legende. */}
      <EinstellKarte title="Einheit-Übersicht im Liegenschaft-Tab" t={t} accent={accent}>
        <EinstellZeile label="Fläche anzeigen"
          sub={'z. B. „128 m²“ in der Einheit-Zeile'} t={t}>
          <Toggle value={settings.einheitAnzeigeFlaeche !== false}
            onChange={v => save({ einheitAnzeigeFlaeche: v })} color={accent}/>
        </EinstellZeile>
        <EinstellZeile label="MEA anzeigen"
          sub={'Miteigentumsanteil, z. B. „MEA 100/1000“'} t={t}>
          <Toggle value={settings.einheitAnzeigeMea !== false}
            onChange={v => save({ einheitAnzeigeMea: v })} color={accent}/>
        </EinstellZeile>
        <EinstellZeile label="Eigentümer anzeigen"
          sub={'z. B. „ET Müller“ — Nachname des aktuellen Eigentümers'} t={t}>
          <Toggle value={settings.einheitAnzeigeEigentuemer !== false}
            onChange={v => save({ einheitAnzeigeEigentuemer: v })} color={accent}/>
        </EinstellZeile>
        <EinstellZeile label="Mieter anzeigen"
          sub={'z. B. „MT Schmidt“ — Nachname des aktuellen Mieters (wenn vorhanden)'} t={t}>
          <Toggle value={settings.einheitAnzeigeMieter !== false}
            onChange={v => save({ einheitAnzeigeMieter: v })} color={accent}/>
        </EinstellZeile>
      </EinstellKarte>

      {/* Stammdaten-Karte des Objekts: optionale Auto-Sektionen */}
      <EinstellKarte title="Stammdaten der Liegenschaft" t={t} accent={accent}>
        <EinstellZeile label="Rechnungsadresse anzeigen"
          sub={'Auto-Sektion „c/o Hausverwaltung …“ unter den Stammdaten. Standard: aus.'} t={t}>
          <Toggle value={settings.rechnungsadresseAnzeigen === true}
            onChange={v => save({ rechnungsadresseAnzeigen: v })} color={accent}/>
        </EinstellZeile>
      </EinstellKarte>

      {/* Sicherheit: Löschen-Buttons nur auf bewusste Freigabe sichtbar */}
      <EinstellKarte title="Sicherheit" t={t} accent={accent}>
        <EinstellZeile label="Objekte löschen erlauben"
          sub={'Zeigt den Löschen-Button bei Objekten. Aus Sicherheitsgründen standardmäßig aus — Löschen entfernt das Objekt mit allen Einheiten und Daten unwiderruflich.'} t={t}>
          <Toggle value={settings.loeschenErlaubtObjekte === true}
            onChange={v => save({ loeschenErlaubtObjekte: v })} color={accent}/>
        </EinstellZeile>
      </EinstellKarte>

      {/* Filter-Pillen neben der Überschrift „Objekte" (feiner Filter
          INNERHALB des großen Header-Filters) */}
      <EinstellKarte title="Filter-Pillen: Verwaltungsarten" t={t} accent={accent}>
        <div style={{ fontSize: FS.m, color: t.sub, marginBottom: 8, lineHeight: 1.4 }}>
          Welche Verwaltungsarten als Filter-Pillen neben der Überschrift „Objekte" erscheinen. Klick auf den Schriftzug „Objekte" setzt zurück auf alle.
        </div>
        {VERWALTUNGSARTEN.map(a => (
          <EinstellZeile key={a.id} label={a.label} t={t}>
            <Toggle value={!!verw[a.id]}
              onChange={v => save({ filterVerwaltungsarten: { ...verw, [a.id]: v } })}
              color={accent}/>
          </EinstellZeile>
        ))}
      </EinstellKarte>

      {/* Eigene Objekt-Gruppen → Pillen im Objekte-Header + Sektion im Header-Filter.
          div-Anker: Sprungziel des Buttons in Einstellungen → Filter-Optionen. */}
      <div id="einstell-objektgruppen" style={{ scrollMarginTop: "var(--ad-header-h, 200px)" }}>
      <SektionGruppen titel="Objekt-Gruppen" t={t} accent={accent}
        beschreibung="Eigene Gruppen als Filter-Pillen im Objekte-Header und als Sektion im großen Header-Filter. Manuell zusammenstellen oder nach Kriterien (Verwaltungsart, Ort) — Kriterien-Gruppen halten sich selbst aktuell."
        gruppen={settings.objektGruppen || []}
        onChange={(neu) => setSettings(s => ({ ...s, objektGruppen: neu }))}
        manuellTitel="Manuell auswählen" kriterienTitel="Nach Kriterien"
        kriterienGruppen={[
          { key: "verwaltungsarten", titel: "Verwaltungsart",
            chips: VERWALTUNGSARTEN.map(a => ({ id: a.id, label: a.label, kurz: a.kurz || a.label })) },
          { key: "orte", titel: "Ort",
            chips: Array.from(new Set(ves.map(objektOrt).filter(Boolean))).sort()
              .map(o => ({ id: o, label: o, kurz: o })) },
        ]}
        eintraege={ves.map(v => ({ id: v.id,
          label: v.nr || v.name || ("Objekt " + v.id),
          sub: v.adresse || "",
          passtKriterien: (g) => objektInGruppe(v, g) }))}/>
      </div>

      {/* Kategorien: gemeinsame Kürzel+Farbe für Verwendung↔Rolle-Paare */}
      <EinstellKarte title="Kategorien" t={t} accent={accent}>
        <KategorienTabelle settings={settings} setSettings={setSettings} t={t} accent={accent}/>
      </EinstellKarte>

      {/* Verwendungen pro Einheit (analog zu Kontakt-Rollen) */}
      <EinstellKarte title="Verwendungen" t={t} accent={accent}>
        <VerwendungenTabelle settings={settings} setSettings={setSettings} t={t} accent={accent}/>
      </EinstellKarte>

      {/* Objekt-Detail-Tabs: Reihenfolge & Sichtbarkeit der Reiter */}
      <SektionObjektTabs settings={settings} setSettings={setSettings} t={t} accent={accent}/>

    </>
  );
}

// ── Sektion: Filter-Optionen (globaler Header-Filter, DESIGN §32) ───────────
// Pro Eintrag (Verwalter, Verwaltungsart, Objekt-Gruppe) EINE Zeile mit drei
// kompakten Schaltern: Anzeigen | Personen mitfiltern | Firmen mitfiltern.
function SektionFilterOpt({ settings, setSettings, t, accent, ves = [], kontakte = [] }) {
  const save = (partial) => setSettings(s => ({ ...s, ...partial }));
  const filterTyp = settings.filterTyp || "verwalter";
  const feld = filterTyp === "buchhalter" ? "buchhalter" : "verwalter";

  // Eintrags-Konfiguration schreiben: { [sektion]: { [id]: {anzeigen,personen,firmen} } }
  const setEintrag = (sektion, id, key, v) => {
    const alle = settings.filterEintraege || {};
    const sek = alle[sektion] || {};
    const c = sek[id] || {};
    const patch = { filterEintraege: { ...alle,
      [sektion]: { ...sek, [id]: { ...c, [key]: v } } } };
    // Alte Verwalter-Sichtbarkeit (filterAktive) aufräumen, damit der
    // Rückwärts-Fallback ein neu gesetztes anzeigen=true nicht übersteuert.
    if (sektion === "verwalter" && key === "anzeigen" && v === true
        && settings.filterAktive && settings.filterAktive[id] === false) {
      const alt = { ...settings.filterAktive };
      delete alt[id];
      patch.filterAktive = alt;
    }
    save(patch);
  };
  const conf = (sektion, id) => filterEintragConf(settings, sektion, id);

  // ── Drei-Schalter-Zeile + Spaltenkopf ────────────────────────────────────
  const SPALTE_W = 46; // Breite je Toggle-Spalte (Toggle zentriert)
  const spalte = (inhalt, key) => (
    <div key={key} style={{ width: SPALTE_W, flexShrink: 0, display: "flex",
      alignItems: "center", justifyContent: "center" }}>{inhalt}</div>
  );
  const kopfzeile = (
    <div style={{ display: "flex", alignItems: "flex-end", gap: 2,
      padding: "2px 6px 6px", borderBottom: `1px solid ${t.border}40` }}>
      <div style={{ flex: 1, minWidth: 0 }}/>
      {spalte(<span style={{ fontSize: FS.xs, fontWeight: FW.bold, color: t.muted,
        textTransform: "uppercase", letterSpacing: "0.04em" }}>Zeigen</span>, "h1")}
      {spalte(<span style={{ fontSize: FS.xs, fontWeight: FW.bold, color: t.muted,
        textTransform: "uppercase", letterSpacing: "0.04em" }}>Pers.</span>, "h2")}
      {spalte(<span style={{ fontSize: FS.xs, fontWeight: FW.bold, color: t.muted,
        textTransform: "uppercase", letterSpacing: "0.04em" }}>Firmen</span>, "h3")}
      {spalte(<span style={{ fontSize: FS.xs, fontWeight: FW.bold, color: t.muted,
        textTransform: "uppercase", letterSpacing: "0.04em" }}>Term.</span>, "h4")}
    </div>
  );
  const zeile = (sektion, id, label, sub) => {
    const c = conf(sektion, id);
    return (
      <div key={sektion + "_" + id} style={{ display: "flex", alignItems: "center", gap: 2,
        padding: "9px 6px", borderBottom: `1px solid ${t.border}25` }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: FS.l, color: t.text, overflow: "hidden",
            textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{label}</div>
          {sub && <div style={{ fontSize: FS.s, color: t.muted, marginTop: 1 }}>{sub}</div>}
        </div>
        {spalte(<Toggle value={c.anzeigen}
          onChange={v => setEintrag(sektion, id, "anzeigen", v)} color={accent}/>, "t1")}
        {spalte(<Toggle value={c.personen}
          onChange={v => setEintrag(sektion, id, "personen", v)} color={accent}/>, "t2")}
        {spalte(<Toggle value={c.firmen}
          onChange={v => setEintrag(sektion, id, "firmen", v)} color={accent}/>, "t3")}
        {spalte(<Toggle value={c.termine}
          onChange={v => setEintrag(sektion, id, "termine", v)} color={accent}/>, "t4")}
      </div>
    );
  };

  // Dynamische Liste aller in den Objekten vergebenen Verwalter/Buchhalter.
  // Original-ID-Typ erhalten (Object.keys würde Zahlen zu Strings machen).
  const gefunden = [];
  ves.forEach(ve => {
    const id = ve.verwaltung && ve.verwaltung[feld];
    if (id == null || id === "") return;
    const e = gefunden.find(x => x.id === id);
    if (e) e.count += 1; else gefunden.push({ id, count: 1 });
  });
  const personen = gefunden.map(({ id, count }) => {
    const k = kontakte.find(x => x.id === id);
    const name = k
      ? (k.typ === "firma"
          ? k.name
          : [k.nachname, k.vorname].filter(Boolean).join(", ") || k.name || String(id))
      : String(id);
    return { id, name, count };
  }).sort((a, b) => a.name.localeCompare(b.name, "de"));

  const gruppen = settings.objektGruppen || [];

  return (
    <>
      <EinstellKarte title="Filter im Header" t={t} accent={accent}>
        <div style={{ fontSize: FS.m, color: t.sub, marginBottom: 10, lineHeight: 1.4 }}>
          Der grobe Filter im App-Header — Mehrfachauswahl über die Sektionen
          Verwalter/Buchhalter, Verwaltungsart und Objekt-Gruppen, beliebig
          kombinierbar. Ein gesetzter Filter wirkt app-weit. Je Eintrag vier
          Schalter: „Zeigen" (erscheint im Dropdown), „Pers." und „Firmen"
          (blendet bei gesetztem Filter Personen bzw. Firmen ohne Bezug zu den
          gefilterten Objekten aus) sowie „Term." (beschränkt auch die
          Kalender-Termine auf die gefilterten Objekte). Die Pillen an den Listen-Überschriften
          filtern zusätzlich fein INNERHALB dieser Menge (einstellbar unter
          Objekte bzw. Kontakte).
        </div>
        <EinstellZeile label="Filtern nach"
          sub="Verwalter oder Buchhalter der Objekte" t={t}>
          <div style={{ display: "flex", gap: 4, background: t.surface,
            border: `1px solid ${t.border}`, borderRadius: RAD.md, padding: 3 }}>
            {[
              { id: "verwalter",  label: "Verwalter" },
              { id: "buchhalter", label: "Buchhalter" },
            ].map(opt => {
              const aktiv = filterTyp === opt.id;
              return (
                <button key={opt.id} onClick={() => save({ filterTyp: opt.id })} style={{
                  background: aktiv ? accent : "transparent",
                  color: aktiv ? "#fff" : t.sub,
                  border: "none", borderRadius: RAD.sm,
                  padding: "5px 12px", cursor: "pointer",
                  fontFamily: "inherit", fontSize: FS.m, fontWeight: FW.medium }}>
                  {opt.label}
                </button>
              );
            })}
          </div>
        </EinstellZeile>
      </EinstellKarte>

      <EinstellKarte title={filterTyp === "buchhalter" ? "Buchhalter" : "Verwalter"}
        t={t} accent={accent}>
        <div style={{ fontSize: FS.m, color: t.sub, marginBottom: 6, lineHeight: 1.4 }}>
          {personen.length === 0
            ? `Keine ${filterTyp === "buchhalter" ? "Buchhalter" : "Verwalter"} in den Objekten eingetragen. Zuordnung erfolgt im Objekt-Detail unter „Verwaltung“.`
            : "Automatisch aus den Objekten gelesen. Zuordnung im Objekt-Detail."}
        </div>
        {personen.length > 0 && kopfzeile}
        {personen.map(p => zeile("verwalter", p.id, p.name,
          `${p.count} ${p.count === 1 ? "Objekt" : "Objekte"}`))}
      </EinstellKarte>

      <EinstellKarte title="Verwaltungsarten" t={t} accent={accent}>
        <div style={{ fontSize: FS.m, color: t.sub, marginBottom: 6, lineHeight: 1.4 }}>
          Im Dropdown erscheinen nur Arten, die in den Objekten vorkommen.
        </div>
        {kopfzeile}
        {VERWALTUNGSARTEN.map(a => {
          const count = ves.filter(v => (v.verwaltungsart || "weg") === a.id).length;
          return zeile("arten", a.id, a.label,
            `${count} ${count === 1 ? "Objekt" : "Objekte"}`);
        })}
      </EinstellKarte>

      <EinstellKarte title="Objekt-Gruppen" t={t} accent={accent}>
        <div style={{ fontSize: FS.m, color: t.sub, marginBottom: 8, lineHeight: 1.4 }}>
          „Zeigen" wirkt nur auf den Header-Filter — angelegt und verwaltet
          werden die Gruppen unter Objekte.
        </div>
        <button onClick={() => {
            try {
              window.dispatchEvent(new CustomEvent("allesda:zentrale-sektion",
                { detail: { id: "objekte" } }));
              // Nach dem Sektions-Auto-Scroll gezielt zur Gruppen-Karte.
              setTimeout(() => {
                const el = document.getElementById("einstell-objektgruppen");
                if (el && el.scrollIntoView) el.scrollIntoView({ block: "start", behavior: "smooth" });
              }, 350);
            } catch (err) {}
          }}
          style={{ display: "flex", alignItems: "center", gap: 6,
            padding: "8px 12px", marginBottom: 10, borderRadius: RAD.sm,
            cursor: "pointer", fontFamily: "inherit",
            fontSize: FS.s, fontWeight: FW.bold,
            background: accent + "14", border: `1px solid ${accent}40`, color: accent }}>
          Objekt-Gruppen verwalten
        </button>
        {gruppen.length === 0 ? (
          <div style={{ fontSize: FS.s, color: t.muted, fontStyle: "italic", padding: "6px 0" }}>
            Noch keine Objekt-Gruppen angelegt.
          </div>
        ) : (
          <>
            {kopfzeile}
            {gruppen.map(g => {
              const count = ves.filter(v => objektInGruppe(v, g)).length;
              return zeile("gruppen", g.id, g.name || g.kurz || "Gruppe",
                `${count} ${count === 1 ? "Objekt" : "Objekte"}`);
            })}
          </>
        )}
      </EinstellKarte>
    </>
  );
}

// ── Sektion: Objekt-Tabs ────────────────────────────────────────────────────
// Reihenfolge (Pfeile) + Sichtbarkeit (Toggle) der Objekt-Detail-Reiter, global.
// Liegenschaft + Verwaltung sind fix: immer sichtbar, nicht verschiebbar und an
// erster/zweiter Stelle. Die übrigen Tabs sind frei sortier- und ausblendbar.
function SektionObjektTabs({ settings, setSettings, t, accent }) {
  const save = (partial) => setSettings(s => ({ ...s, ...partial }));
  const DEF = (DEFAULT_SETTINGS.objektTabs || []);
  const tabs = (settings.objektTabs && settings.objektTabs.length ? settings.objektTabs : DEF);
  const sortiert = [...tabs].sort((a, b) => (a.reihenfolge || 0) - (b.reihenfolge || 0));
  // Fixe Tabs (Liegenschaft/Verwaltung) zuerst, dann die frei sortierbaren.
  const fixe = sortiert.filter(x => x.fix);
  const frei = sortiert.filter(x => !x.fix);

  // Verschiebt einen frei sortierbaren Tab innerhalb des freien Blocks.
  const verschiebe = (idx, richtung) => {
    const ziel = idx + richtung;
    if (ziel < 0 || ziel >= frei.length) return;
    const neu = frei.slice();
    const tmp = neu[idx]; neu[idx] = neu[ziel]; neu[ziel] = tmp;
    // Reihenfolge neu durchschreiben: fixe behalten ihre vorderen Plätze.
    const reihen = {};
    fixe.forEach((x, i) => { reihen[x.id] = i; });
    neu.forEach((x, i) => { reihen[x.id] = fixe.length + i; });
    save({ objektTabs: tabs.map(x => ({ ...x, reihenfolge: reihen[x.id] })) });
  };
  const setAktiv = (id, v) =>
    save({ objektTabs: tabs.map(x => x.id === id ? { ...x, aktiv: v } : x) });

  const zeile = (tab, idx, sortierbar) => (
    <div key={tab.id} style={{ display: "flex", alignItems: "center", gap: 8,
      padding: "8px 6px", borderBottom: `1px solid ${t.border}25`, borderRadius: RAD.sm }}>
      {sortierbar ? (
        <SortierPfeile canUp={idx > 0} canDown={idx < frei.length - 1}
          onUp={() => verschiebe(idx, -1)} onDown={() => verschiebe(idx, +1)}
          t={t} accent={accent}/>
      ) : (
        <div style={{ width: 20, flexShrink: 0 }}/>
      )}
      <div style={{ width: 28, height: 28, borderRadius: RAD.ms, flexShrink: 0,
        background: accent + "20", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <I name={tab.icon} size={13} color={accent}/>
      </div>
      <div style={{ flex: 1, fontSize: FS.l, color: t.text }}>
        {tab.label}
        {tab.fix && <span style={{ fontSize: FS.xs, color: t.muted, marginLeft: 6 }}>· fest</span>}
      </div>
      {tab.fix ? (
        <span style={{ fontSize: FS.xs, color: t.muted, fontStyle: "italic" }}>immer sichtbar</span>
      ) : (
        <Toggle value={tab.aktiv !== false}
          onChange={v => setAktiv(tab.id, v)} color={accent}/>
      )}
    </div>
  );

  return (
    <EinstellKarte title="Objekt-Tabs" t={t} accent={accent}>
      <div style={{ fontSize: FS.m, color: t.sub, marginBottom: 8 }}>
        Reihenfolge und Sichtbarkeit der Reiter im Objekt (Liegenschaft, Verwaltung …).
        <span style={{ color: t.muted }}> Liegenschaft und Verwaltung bleiben fest vorne.</span>
      </div>
      {fixe.map((tab) => zeile(tab, -1, false))}
      {frei.map((tab, i) => zeile(tab, i, true))}
      <div style={{ marginTop: 10, textAlign: "right" }}>
        <button onClick={() => save({ objektTabs: DEF.map(x => ({ ...x })) })} style={{
          background: "none", border: `1px solid ${t.border}`, color: t.sub,
          borderRadius: RAD.sm, padding: "5px 12px", cursor: "pointer",
          fontSize: FS.s, fontFamily: "inherit" }}>
          Zurücksetzen
        </button>
      </div>
    </EinstellKarte>
  );
}

// ── Sektion: Dashboard ──────────────────────────────────────────────────────
function SektionDashboard({ settings, setSettings, t, accent }) {
  const save = (partial) => setSettings(s => ({ ...s, ...partial }));
  const sortierteKacheln = [...settings.kacheln].sort((a, b) => a.reihenfolge - b.reihenfolge);
  const dashboardAktiv = settings.dashboardModus !== "aus";

  // ── Umsortieren per Pfeil (hoch/runter) ──
  // Vertauscht den Eintrag an Position idx mit seinem Nachbarn (richtung -1/+1)
  // und schreibt die Reihenfolge-Werte neu durch.
  const verschiebeKachel = (idx, richtung) => {
    const ziel = idx + richtung;
    if (ziel < 0 || ziel >= sortierteKacheln.length) return;
    const neu = sortierteKacheln.slice();
    const tmp = neu[idx]; neu[idx] = neu[ziel]; neu[ziel] = tmp;
    const reihenfolgeMap = {};
    neu.forEach((k, i) => { reihenfolgeMap[k.id] = i; });
    save({ kacheln: settings.kacheln.map(k => ({ ...k, reihenfolge: reihenfolgeMap[k.id] })) });
  };

  return (
    <EinstellKarte title="Dashboard" t={t} accent={accent}>
      <EinstellZeile label="Dashboard anzeigen" sub="Kategorien als Navigationsleiste oben" t={t}>
        <Toggle value={dashboardAktiv}
          onChange={v => save({ dashboardModus: v ? "immer" : "aus" })} color={accent}/>
      </EinstellZeile>
      {dashboardAktiv && (
        <EinstellZeile label="Auf allen Seiten" sub="An: immer · Aus: nur Startseite" t={t}>
          <Toggle value={settings.dashboardModus === "immer"}
            onChange={v => save({ dashboardModus: v ? "immer" : "home" })} color={accent}/>
        </EinstellZeile>
      )}
      {dashboardAktiv && (
        <EinstellZeile label="Beim Scrollen sichtbar bleiben"
          sub="An: bleibt im Hochkant unter dem Header · Aus: scrollt mit weg" t={t}>
          <Toggle value={settings.dashboardSticky === true}
            onChange={v => save({ dashboardSticky: v })} color={accent}/>
        </EinstellZeile>
      )}
      <div style={{ paddingTop: 10, marginTop: 4, borderTop: `1px solid ${t.border}30` }}>
        <div style={{ fontSize: FS.m, fontWeight: FW.medium, color: t.sub, marginBottom: 8 }}>
          Kacheln & Reihenfolge <span style={{ fontWeight: FW.regular, color: t.muted }}>— Pfeile zum Umsortieren</span>
        </div>
        {sortierteKacheln.map((k, i) => {
          return (
            <div key={k.id}
              style={{
                display: "flex", alignItems: "center", gap: 8,
                padding: "8px 6px", borderBottom: `1px solid ${t.border}25`,
                borderRadius: RAD.sm,
              }}>
              <SortierPfeile
                canUp={i > 0} canDown={i < sortierteKacheln.length - 1}
                onUp={() => verschiebeKachel(i, -1)} onDown={() => verschiebeKachel(i, +1)}
                t={t} accent={accent}/>
              <div style={{ width: 28, height: 28, borderRadius: RAD.ms, flexShrink: 0,
                background: k.farbe + "20", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <I name={k.icon} size={13} color={k.farbe}/>
              </div>
              <div style={{ flex: 1, fontSize: FS.l, color: t.text }}>{k.label}</div>
              {(settings.farbIntensitaet != null ? settings.farbIntensitaet : 100) > 0 && (
                <FarbPicker value={k.farbe}
                  onChange={(c) => save({ kacheln: settings.kacheln.map(x => x.id === k.id ? { ...x, farbe: c } : x) })}
                  t={t} verwendeteFarben={sammleVerwendeteFarben(settings)}/>
              )}
              <Toggle value={k.aktiv}
                onChange={v => save({ kacheln: settings.kacheln.map(x => x.id === k.id ? { ...x, aktiv: v } : x) })}
                color={k.farbe}/>
            </div>
          );
        })}
      </div>
    </EinstellKarte>
  );
}

// ── VerwendungenTabelle ─────────────────────────────────────────────────────
// Analog RollenTabelle, aber für Objekt-Verwendungen (Wohnen, Vermietet, …).
// ── KategorienTabelle ───────────────────────────────────────────────────────
// Gemeinsame Quelle für Kürzel + Farbe der Paare (Miete=Vermietet/Mieter,
// Nießbrauch, Wohnrecht, SEV). Hier EINMAL gepflegt; Verwendung UND Rolle erben
// die Werte (siehe effKuerzel/effColor). „Weniger ist mehr": kein Doppel-Pflegen.
function KategorienTabelle({ settings, setSettings, t, accent }) {
  const kategorien = settings.kategorien || DEFAULT_KATEGORIEN;
  const [editId, setEditId] = useState(null);
  const [fLabel, setFLabel] = useState("");
  const [fKuerzel, setFKuerzel] = useState("");
  const [fColor, setFColor] = useState(accent);
  const [resetConfirm, setResetConfirm] = useState(false);

  const update = (neu) => setSettings(s => ({ ...s, kategorien: neu }));
  const startEdit = (k) => { setEditId(k.id); setFLabel(k.label || ""); setFKuerzel(k.kuerzel || ""); setFColor(k.color || accent); };
  const abbrechen = () => { setEditId(null); };
  const speichern = () => {
    const kuerzel = (fKuerzel.trim() || (fLabel.trim().slice(0, 2))).toUpperCase().slice(0, 3);
    update(kategorien.map(k => k.id === editId ? { ...k, label: fLabel.trim() || k.label, kuerzel, color: fColor } : k));
    abbrechen();
  };
  const aufStandard = () => {
    if (!resetConfirm) { setResetConfirm(true); return; }
    update(DEFAULT_KATEGORIEN.map(d => ({ ...d })));
    setResetConfirm(false);
  };
  useEffect(() => {
    if (!resetConfirm) return;
    const tid = setTimeout(() => setResetConfirm(false), 4000);
    return () => clearTimeout(tid);
  }, [resetConfirm]);

  const inputStyle = feldInput(t, { padding: "6px 8px" });

  return (
    <>
      <div style={{ fontSize: FS.m, color: t.sub, marginBottom: 10, lineHeight: 1.4 }}>
        Kategorien bündeln Kürzel und Farbe für Begriffe, die sowohl als Verwendung (am Objekt)
        als auch als Rolle (am Kontakt) vorkommen — z. B. „Miete" für Vermietet und Mieter.
        Hier einmal gepflegt, erscheint es überall gleich.
      </div>

      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 8 }}>
        <button onClick={aufStandard}
          style={{ fontSize: FS.xs, padding: "4px 10px", background: resetConfirm ? "#EF4444" : "none",
            color: resetConfirm ? "#FFFFFF" : t.sub, border: `1px solid ${resetConfirm ? "#EF4444" : t.border}`,
            borderRadius: RAD.sm, cursor: "pointer", fontWeight: FW.medium, fontFamily: "inherit" }}>
          {resetConfirm ? "Wirklich zurücksetzen?" : "Auf Standard zurücksetzen"}
        </button>
      </div>

      <div style={{ background: t.surface, border: `1px solid ${t.border}`, borderRadius: RAD.ms, padding: 4 }}>
        {kategorien.map(k => {
          const offen = editId === k.id;
          return (
            <div key={k.id} style={{ marginBottom: 2 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 6px" }}>
                <div style={{ width: 26, height: 26, borderRadius: RAD.full,
                  background: k.color, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <span style={{ fontSize: FS.xxs, fontWeight: FW.heavy, color: getContrastColor(k.color) }}>{k.kuerzel}</span>
                </div>
                <span style={{ flex: 1, minWidth: 0, fontSize: FS.m, color: t.text, fontWeight: FW.medium }}>{k.label}</span>
                <button onClick={() => offen ? abbrechen() : startEdit(k)}
                  style={{ background: "none", border: `1px solid ${t.border}`, borderRadius: RAD.sm,
                    width: 28, height: 28, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <I name="pencil" size={12} color={offen ? accent : t.sub}/>
                </button>
              </div>
              {offen && (
                <div style={{ padding: "8px 6px 10px", borderTop: `1px solid ${t.border}` }}>
                  <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                    <input type="text" value={fLabel} onChange={e => setFLabel(e.target.value)}
                      placeholder="Bezeichnung" style={{ ...inputStyle, flex: 1, minWidth: 120 }}/>
                    <input type="text" value={fKuerzel} onChange={e => setFKuerzel(e.target.value)}
                      placeholder="Kürzel" maxLength={3} style={{ ...inputStyle, width: 70, textAlign: "center" }}/>
                    <FarbPicker value={fColor} onChange={setFColor} t={t}
                      verwendeteFarben={sammleVerwendeteFarben(settings)}/>
                  </div>
                  <div style={{ display: "flex", gap: 6, justifyContent: "flex-end", marginTop: 10 }}>
                    <button onClick={abbrechen}
                      style={{ fontSize: FS.s, padding: "5px 12px", background: "none", color: t.sub,
                        border: `1px solid ${t.border}`, borderRadius: RAD.sm, cursor: "pointer", fontWeight: FW.medium, fontFamily: "inherit" }}>
                      Abbrechen
                    </button>
                    <button onClick={speichern}
                      style={{ fontSize: FS.s, padding: "5px 12px", background: accent, color: getContrastColor(accent),
                        border: "none", borderRadius: RAD.sm, cursor: "pointer", fontWeight: FW.bold, fontFamily: "inherit" }}>
                      Speichern
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </>
  );
}

// Zeigt pro Verwendung Toggle für Eck-Icon, Position-Selector und Toggle für
// Karten-Badge. Live-Vorschau über eine echte VEKachel mit einer Beispiel-WE
// in der gewählten Verwendung.
function VerwendungenTabelle({ settings, setSettings, t, accent }) {
  const verwendungen = settings.verwendungen || DEFAULT_VERWENDUNGEN;
  const kategorien = settings.kategorien || DEFAULT_KATEGORIEN;
  const [selName, setSelName] = useState((verwendungen[0] || {}).name || "");
  const [bearbeiten, setBearbeiten] = useState(false); // Schreibschutz: erst freischalten
  const [formOffen, setFormOffen] = useState(false);
  const [editName, setEditName] = useState(null);
  const [fName, setFName] = useState("");
  const [fKuerzel, setFKuerzel] = useState("");
  const [fColor, setFColor] = useState(accent);
  const [resetConfirm, setResetConfirm] = useState(false);

  useEffect(() => {
    if (!verwendungen.find(v => v.name === selName)) {
      setSelName((verwendungen[0] || {}).name || "");
    }
  }, [verwendungen.length]); // eslint-disable-line react-hooks/exhaustive-deps
  const selVerw = verwendungen.find(v => v.name === selName);

  const update = (neu) => setSettings(s => ({ ...s, verwendungen: neu }));
  const toggleEckSichtbar = (name) =>
    update(verwendungen.map(v => v.name === name ? { ...v, eckSichtbar: !verwendungEckSichtbar(v) } : v));
  const setEckPosition = (name, pos) =>
    update(verwendungen.map(v => v.name === name ? { ...v, eckPosition: pos } : v));
  const toggleBadgeSichtbar = (name) =>
    update(verwendungen.map(v => v.name === name ? { ...v, badgeSichtbar: !verwendungBadgeSichtbar(v) } : v));
  const loeschen = (name) => update(verwendungen.filter(v => v.name !== name));

  const startNeu = () => { setEditName(null); setFName(""); setFKuerzel(""); setFColor(accent); setFormOffen(true); };
  const startEdit = (v) => { setEditName(v.name); setFName(v.name); setFKuerzel(v.kuerzel || ""); setFColor(v.color || accent); setFormOffen(true); };
  const abbrechen = () => { setFormOffen(false); setEditName(null); };
  const speichern = () => {
    const name = fName.trim();
    if (!name) return;
    const kuerzel = (fKuerzel.trim() || name.slice(0, 2)).toUpperCase().slice(0, 3);
    if (editName) {
      update(verwendungen.map(v => v.name === editName ? { ...v, name, kuerzel, color: fColor } : v));
    } else {
      if (verwendungen.some(v => v.name.toLowerCase() === name.toLowerCase())) { abbrechen(); return; }
      update([...verwendungen, { name, kuerzel, color: fColor, aktiv: true }]);
    }
    abbrechen();
  };
  const aufStandard = () => {
    if (!resetConfirm) { setResetConfirm(true); return; }
    update(DEFAULT_VERWENDUNGEN.map(d => ({ ...d })));
    setResetConfirm(false);
  };
  useEffect(() => {
    if (!resetConfirm) return;
    const tid = setTimeout(() => setResetConfirm(false), 4000);
    return () => clearTimeout(tid);
  }, [resetConfirm]);

  const inputStyle = feldInput(t, { padding: "6px 8px" });
  const miniBtn = { background: "none", border: `1px solid ${t.border}`, borderRadius: RAD.sm,
    width: 26, height: 26, cursor: "pointer", padding: 0, flexShrink: 0,
    display: "flex", alignItems: "center", justifyContent: "center" };

  // Live-Vorschau: echte VEKachel mit einer Beispiel-WE in der gewählten Verwendung
  const VorschauBox = () => {
    if (!selVerw) return null;
    const eckAn = verwendungEckSichtbar(selVerw);
    const badgeAn = verwendungBadgeSichtbar(selVerw);
    const ecke = verwendungEckPosition(selVerw);
    const beispielVE = {
      id: "vorschau-ve",
      nr: "WEG-Beispiel · WE 1",
      adresse: "Musterstraße 12, 80331 München",
      verwaltung: {},
      einheiten: [
        { id: 1, typ: "Wohneigentum", eigentuemer: [], mieter: [],
          verwendung: { name: selVerw.name, status: "aktiv" } },
      ],
    };
    return (
      <div style={{ marginBottom: 12 }}>
        <div style={{ fontSize: FS.xs, fontWeight: FW.bold, color: t.muted,
          textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6,
          display: "flex", alignItems: "center", gap: 8, justifyContent: "space-between",
          padding: "0 2px" }}>
          <span>Vorschau · „{selVerw.name}"</span>
          <span style={{ fontWeight: FW.semi, textTransform: "none", letterSpacing: 0 }}>
            {eckAn ? `Eck-Icon: ${ecke}` : "Eck-Icon aus"}
            {" · "}
            {badgeAn ? "Karten-Badge an" : "Karten-Badge aus"}
          </span>
        </div>
        <VEKachel ve={beispielVE} t={t} accent={accent} ohneStatus={true}/>
      </div>
    );
  };

  return (
    <>
      <VorschauBox/>

      <div style={{ fontSize: FS.m, color: t.sub, marginBottom: 10, lineHeight: 1.4 }}>
        Pro Verwendung festlegen, ob sie als Eck-Icon am Objekt-Symbol (mit Position)
        und/oder als Karten-Badge erscheint. Zuordnung erfolgt pro Einheit (WE, Stellplatz, TG, …).
        Farbe wird unter Erscheinungsbild eingestellt.
      </div>

      <div style={{ display: "flex", justifyContent: "flex-end", gap: 6, marginBottom: 8 }}>
        {!bearbeiten ? (
          <button onClick={() => setBearbeiten(true)}
            style={{ fontSize: FS.xs, padding: "4px 12px", display: "flex", alignItems: "center", gap: 5,
              background: accent + "20", color: accent,
              border: "none", borderRadius: RAD.sm, cursor: "pointer", fontWeight: FW.bold, fontFamily: "inherit" }}>
            <I name="pencil" size={11} color={accent}/> Bearbeiten
          </button>
        ) : (
          <>
            <button onClick={aufStandard}
              style={{ fontSize: FS.xs, padding: "4px 10px", background: resetConfirm ? "#EF4444" : "none",
                color: resetConfirm ? "#FFFFFF" : t.sub, border: `1px solid ${resetConfirm ? "#EF4444" : t.border}`,
                borderRadius: RAD.sm, cursor: "pointer", fontWeight: FW.medium, fontFamily: "inherit" }}>
              {resetConfirm ? "Wirklich zurücksetzen?" : "Auf Standard zurücksetzen"}
            </button>
            <button onClick={startNeu}
              style={{ fontSize: FS.xs, padding: "4px 10px", background: accent + "20", color: accent,
                border: "none", borderRadius: RAD.sm, cursor: "pointer", fontWeight: FW.bold, fontFamily: "inherit" }}>
              + Hinzufügen
            </button>
            <button onClick={() => { setBearbeiten(false); abbrechen(); }}
              style={{ fontSize: FS.xs, padding: "4px 12px", background: accent, color: getContrastColor(accent),
                border: "none", borderRadius: RAD.sm, cursor: "pointer", fontWeight: FW.bold, fontFamily: "inherit" }}>
              Fertig
            </button>
          </>
        )}
      </div>

      {formOffen && (() => {
        const editV = editName ? verwendungen.find(v => v.name === editName) : null;
        const kat = editV ? kategorieVon(editV, kategorien) : null;
        return (
        <div style={{ marginBottom: 10, padding: 10, background: t.surface,
          border: `1px solid ${accent}40`, borderRadius: RAD.ms }}>
          <div style={{ fontSize: FS.s, fontWeight: FW.bold, color: t.sub, marginBottom: 8 }}>
            {editName ? "Bearbeiten" : "Neu anlegen"}
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            <input type="text" value={fName} onChange={e => setFName(e.target.value)}
              placeholder="Name" autoFocus style={{ ...inputStyle, flex: 1, minWidth: 140 }}/>
            {kat ? (
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <div style={{ width: 26, height: 26, borderRadius: RAD.full, background: kat.color,
                  display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <span style={{ fontSize: FS.xxs, fontWeight: FW.heavy, color: getContrastColor(kat.color) }}>{kat.kuerzel}</span>
                </div>
                <span style={{ fontSize: FS.xs, color: t.muted, fontStyle: "italic" }}>
                  Kürzel und Farbe aus Kategorie „{kat.label}"
                </span>
              </div>
            ) : (
              <>
                <input type="text" value={fKuerzel} onChange={e => setFKuerzel(e.target.value)}
                  placeholder="Kürzel" maxLength={3} style={{ ...inputStyle, width: 70, textAlign: "center" }}/>
                <FarbPicker value={fColor} onChange={setFColor} t={t}
                  verwendeteFarben={sammleVerwendeteFarben(settings)}/>
              </>
            )}
          </div>
          <div style={{ display: "flex", gap: 6, justifyContent: "flex-end", marginTop: 10 }}>
            <button onClick={abbrechen}
              style={{ fontSize: FS.s, padding: "5px 12px", background: "none", color: t.sub,
                border: `1px solid ${t.border}`, borderRadius: RAD.sm, cursor: "pointer", fontWeight: FW.medium, fontFamily: "inherit" }}>
              Abbrechen
            </button>
            <button onClick={speichern} disabled={!fName.trim()}
              style={{ fontSize: FS.s, padding: "5px 12px", background: accent, color: getContrastColor(accent),
                border: "none", borderRadius: RAD.sm, cursor: fName.trim() ? "pointer" : "not-allowed",
                opacity: fName.trim() ? 1 : 0.5, fontWeight: FW.bold, fontFamily: "inherit" }}>
              {editName ? "Speichern" : "Anlegen"}
            </button>
          </div>
        </div>
        );
      })()}

      <div style={{ display: "flex", alignItems: "center", gap: 4,
        padding: "6px 6px", fontSize: FS.xs, fontWeight: FW.bold, color: t.muted,
        textTransform: "uppercase", letterSpacing: "0.05em",
        borderBottom: `1px solid ${t.border}` }}>
        <div style={{ width: 22, flexShrink: 0 }}/>
        <div style={{ flex: 1, minWidth: 0 }}>Verwendung</div>
        <div style={{ width: 48, textAlign: "center", flexShrink: 0 }}>Eck</div>
        <div style={{ width: 28, textAlign: "center", flexShrink: 0 }}>Pos.</div>
        <div style={{ width: 48, textAlign: "center", flexShrink: 0 }}>Badge</div>
      </div>

      <div style={{ background: t.surface, border: `1px solid ${t.border}`,
        borderTop: "none", borderRadius: "0 0 9px 9px", padding: 4 }}>
        {[...verwendungen].sort((a, b) => a.name.localeCompare(b.name, "de")).map((v) => {
          const eckAn = verwendungEckSichtbar(v);
          const badgeAn = verwendungBadgeSichtbar(v);
          const ecke = verwendungEckPosition(v);
          const ist = v.name === selName;
          const markiert = bearbeiten && ist; // Highlight nur im Bearbeiten-Modus
          const vKuerzel = effKuerzel(v, kategorien);
          const vColor = effColor(v, kategorien);
          return (
            <div key={v.name}
              onClick={() => setSelName(v.name)}
              style={{
                display: "flex", alignItems: "center", gap: 4,
                padding: "6px 6px", borderRadius: RAD.sm, cursor: "pointer",
                background: markiert ? vColor + "12" : "transparent",
                border: `1px solid ${markiert ? vColor + "55" : "transparent"}`,
                opacity: !eckAn && !badgeAn ? 0.55 : 1,
                transition: "all 0.12s", marginBottom: 2,
              }}>
              <div style={{ width: 22, height: 22, borderRadius: RAD.full,
                background: vColor + "22", border: `1.5px solid ${vColor}60`,
                display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <span style={{ fontSize: FS.xxs, fontWeight: FW.heavy, color: vColor }}>{vKuerzel}</span>
              </div>
              <span style={{ fontSize: FS.m, flex: 1, minWidth: 0, color: t.text,
                whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                fontWeight: markiert ? 700 : 500 }}>{v.name}</span>
              <div style={{ width: 48, display: "flex", justifyContent: "center", flexShrink: 0 }}
                onClick={(e) => e.stopPropagation()}>
                <Toggle value={eckAn} onChange={() => toggleEckSichtbar(v.name)} t={t} accent={accent}/>
              </div>
              <div style={{ width: 28, display: "flex", justifyContent: "center", flexShrink: 0 }}>
                <PositionSelector aktivePosition={ecke}
                  onSelect={(pos) => setEckPosition(v.name, pos)}
                  farbe={v.color} disabled={!eckAn} t={t}/>
              </div>
              <div style={{ width: 48, display: "flex", justifyContent: "center", flexShrink: 0 }}
                onClick={(e) => e.stopPropagation()}>
                <Toggle value={badgeAn} onChange={() => toggleBadgeSichtbar(v.name)} t={t} accent={accent}/>
              </div>
              {/* Aktionen nur im Bearbeiten-Modus UND bei markierter Zeile. */}
              <div style={{ width: markiert ? 58 : 0, overflow: "hidden", display: "flex",
                justifyContent: "flex-end", gap: 4, flexShrink: 0, transition: "width 0.12s" }}
                onClick={(e) => e.stopPropagation()}>
                {markiert && (
                  <>
                    <button onClick={() => startEdit(v)} style={miniBtn} title="Bearbeiten">
                      <I name="pencil" size={11} color={t.sub}/>
                    </button>
                    <button onClick={() => loeschen(v.name)} style={miniBtn} title="Löschen">
                      <I name="trash" size={11} color="#EF4444"/>
                    </button>
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}

// ── RollenTabelle ───────────────────────────────────────────────────────────
// Verwaltung von Personen-Rollen ODER Firmen-Gewerken — gleiches Tabellen-Layout
// wie VerwendungenTabelle (Spalten: Rolle · Eck-Icon · Pos. · Badge), plus
// Anlegen/Bearbeiten/Löschen/Aktiv und „Auf Standard zurücksetzen". Farbe wird
// hier NICHT gesetzt (das passiert unter Erscheinungsbild) — außer im Anlegen-
// Formular, wo eine Startfarbe nötig ist. `gruppeKey`: "rollen" | "firmenRollen".
function RollenTabelle({ settings, setSettings, t, accent, gruppeKey, defaults, einheit = "Rolle", istFirma = false, ohneBadge = false }) {
  const liste = settings[gruppeKey] || defaults;
  const kategorien = settings.kategorien || DEFAULT_KATEGORIEN;
  const farben = useKontaktFarbe();
  const toggleFarbe = farben.person || accent; // Toggles in Kontakte-Farbe
  const [selName, setSelName] = useState((liste[0] || {}).name || "");
  const [bearbeiten, setBearbeiten] = useState(false); // Schreibschutz: erst freischalten
  const [formOffen, setFormOffen] = useState(false);
  const [editName, setEditName] = useState(null);
  const [fName, setFName] = useState("");
  const [fKuerzel, setFKuerzel] = useState("");
  const [fColor, setFColor] = useState(accent);
  const [resetConfirm, setResetConfirm] = useState(false);

  useEffect(() => {
    if (!liste.find(r => r.name === selName)) setSelName((liste[0] || {}).name || "");
  }, [liste.length]); // eslint-disable-line react-hooks/exhaustive-deps

  const update = (neu) => setSettings(s => ({ ...s, [gruppeKey]: neu }));
  const toggleEckSichtbar = (name) =>
    update(liste.map(r => r.name === name ? { ...r, eckSichtbar: !rolleEckSichtbar(r) } : r));
  const setEckPosition = (name, pos) =>
    update(liste.map(r => r.name === name ? { ...r, eckPosition: pos } : r));
  const toggleBadgeSichtbar = (name) =>
    update(liste.map(r => r.name === name ? { ...r, badgeSichtbar: !rolleBadgeSichtbar(r) } : r));
  const loeschen = (name) => update(liste.filter(r => r.name !== name));

  const startNeu = () => { setEditName(null); setFName(""); setFKuerzel(""); setFColor(accent); setFormOffen(true); };
  const startEdit = (r) => { setEditName(r.name); setFName(r.name); setFKuerzel(r.kuerzel || ""); setFColor(r.color || accent); setFormOffen(true); };
  const abbrechen = () => { setFormOffen(false); setEditName(null); };
  const speichern = () => {
    const name = fName.trim();
    if (!name) return;
    const kuerzel = (fKuerzel.trim() || name.slice(0, 2)).toUpperCase().slice(0, 3);
    if (editName) {
      update(liste.map(r => r.name === editName ? { ...r, name, kuerzel, color: fColor } : r));
    } else {
      if (liste.some(r => r.name.toLowerCase() === name.toLowerCase())) { abbrechen(); return; }
      update([...liste, { name, kuerzel, color: fColor, aktiv: true }]);
    }
    abbrechen();
  };
  const aufStandard = () => {
    if (!resetConfirm) { setResetConfirm(true); return; }
    update(defaults.map(d => ({ ...d })));
    setResetConfirm(false);
  };
  useEffect(() => {
    if (!resetConfirm) return;
    const tid = setTimeout(() => setResetConfirm(false), 4000);
    return () => clearTimeout(tid);
  }, [resetConfirm]);

  const inputStyle = feldInput(t, { padding: "6px 8px" });
  const miniBtn = { background: "none", border: `1px solid ${t.border}`, borderRadius: RAD.sm,
    width: 26, height: 26, cursor: "pointer", padding: 0, flexShrink: 0,
    display: "flex", alignItems: "center", justifyContent: "center" };

  // Live-Vorschau: Avatar mit der markierten Rolle als Eck-Badge.
  const selRolle = liste.find(r => r.name === selName);
  const VorschauBox = () => {
    if (!selRolle) return null;
    const eckAn = rolleEckSichtbar(selRolle);
    const badgeAn = rolleBadgeSichtbar(selRolle);
    const ecke = rolleEckPosition(selRolle);
    return (
      <div style={{ marginBottom: 12 }}>
        <div style={{ fontSize: FS.xs, fontWeight: FW.bold, color: t.muted,
          textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8,
          display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 2px" }}>
          <span>Vorschau · „{selRolle.name}"</span>
          <span style={{ fontWeight: FW.semi, textTransform: "none", letterSpacing: 0 }}>
            {eckAn ? `Eck-Icon: ${ecke}` : "Eck-Icon aus"}{" · "}
            {badgeAn ? "Karten-Badge an" : "Karten-Badge aus"}
          </span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12,
          padding: "12px 14px", background: t.surface, border: `1px solid ${t.border}`, borderRadius: RAD.lg }}>
          <Avatar name={istFirma ? "Beispiel GmbH" : "Max Beispiel"} firma={istFirma}
            size={44} accent={toggleFarbe}
            zuweisungen={[{ rolle: selRolle.name, status: "aktiv" }]}/>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ fontSize: FS.xl, fontWeight: FW.bold, color: toggleFarbe }}>
              {istFirma ? "Beispiel GmbH" : "Max Beispiel"}
            </div>
            <div style={{ fontSize: FS.s, color: t.sub }}>{selRolle.name}</div>
          </div>
          {/* Karten-Badge — erscheint rechts auf der echten Kontaktkarte, wenn
              badgeSichtbar an ist. Hier mit der echten RolleBadge dargestellt. */}
          {badgeAn && (
            <div style={{ flexShrink: 0 }}>
              <RolleBadge rolle={selRolle.name} size={22}/>
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <>
      {!ohneBadge && <VorschauBox/>}

      <div style={{ fontSize: FS.m, color: t.sub, marginBottom: 10, lineHeight: 1.4 }}>
        {ohneBadge
          ? `${einheit}en, die eine Firma an einem Objekt erbringt (Beziehung Firma↔Objekt). Name, Kürzel und Farbe werden hier gepflegt — kein Eck-Icon, kein Karten-Badge.`
          : `Pro ${einheit} festlegen, ob sie als Eck-Icon am Avatar (mit Position) und/oder als Karten-Badge erscheint. Farbe wird unter Erscheinungsbild eingestellt.`}
      </div>

      <div style={{ display: "flex", justifyContent: "flex-end", gap: 6, marginBottom: 8 }}>
        {!bearbeiten ? (
          <button onClick={() => setBearbeiten(true)}
            style={{ fontSize: FS.xs, padding: "4px 12px", display: "flex", alignItems: "center", gap: 5,
              background: toggleFarbe + "20", color: toggleFarbe,
              border: "none", borderRadius: RAD.sm, cursor: "pointer", fontWeight: FW.bold, fontFamily: "inherit" }}>
            <I name="pencil" size={11} color={toggleFarbe}/> Bearbeiten
          </button>
        ) : (
          <>
            <button onClick={aufStandard}
              style={{ fontSize: FS.xs, padding: "4px 10px", background: resetConfirm ? "#EF4444" : "none",
                color: resetConfirm ? "#FFFFFF" : t.sub, border: `1px solid ${resetConfirm ? "#EF4444" : t.border}`,
                borderRadius: RAD.sm, cursor: "pointer", fontWeight: FW.medium, fontFamily: "inherit" }}>
              {resetConfirm ? "Wirklich zurücksetzen?" : "Auf Standard zurücksetzen"}
            </button>
            <button onClick={startNeu}
              style={{ fontSize: FS.xs, padding: "4px 10px", background: toggleFarbe + "20", color: toggleFarbe,
                border: "none", borderRadius: RAD.sm, cursor: "pointer", fontWeight: FW.bold, fontFamily: "inherit" }}>
              + Hinzufügen
            </button>
            <button onClick={() => { setBearbeiten(false); abbrechen(); }}
              style={{ fontSize: FS.xs, padding: "4px 12px", background: toggleFarbe, color: getContrastColor(toggleFarbe),
                border: "none", borderRadius: RAD.sm, cursor: "pointer", fontWeight: FW.bold, fontFamily: "inherit" }}>
              Fertig
            </button>
          </>
        )}
      </div>

      {formOffen && (() => {
        const editR = editName ? liste.find(r => r.name === editName) : null;
        const kat = editR ? kategorieVon(editR, kategorien) : null;
        return (
        <div style={{ marginBottom: 10, padding: 10, background: t.surface,
          border: `1px solid ${accent}40`, borderRadius: RAD.ms }}>
          <div style={{ fontSize: FS.s, fontWeight: FW.bold, color: t.sub, marginBottom: 8 }}>
            {editName ? "Bearbeiten" : "Neu anlegen"}
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            <input type="text" value={fName} onChange={e => setFName(e.target.value)}
              placeholder="Name" autoFocus style={{ ...inputStyle, flex: 1, minWidth: 140 }}/>
            {kat ? (
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <div style={{ width: 26, height: 26, borderRadius: RAD.full, background: kat.color,
                  display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <span style={{ fontSize: FS.xxs, fontWeight: FW.heavy, color: getContrastColor(kat.color) }}>{kat.kuerzel}</span>
                </div>
                <span style={{ fontSize: FS.xs, color: t.muted, fontStyle: "italic" }}>
                  Kürzel und Farbe aus Kategorie „{kat.label}"
                </span>
              </div>
            ) : (
              <>
                <input type="text" value={fKuerzel} onChange={e => setFKuerzel(e.target.value)}
                  placeholder="Kürzel" maxLength={3} style={{ ...inputStyle, width: 70, textAlign: "center" }}/>
                <FarbPicker value={fColor} onChange={setFColor} t={t}
                  verwendeteFarben={sammleVerwendeteFarben(settings)}/>
              </>
            )}
          </div>
          <div style={{ display: "flex", gap: 6, justifyContent: "flex-end", marginTop: 10 }}>
            <button onClick={abbrechen}
              style={{ fontSize: FS.s, padding: "5px 12px", background: "none", color: t.sub,
                border: `1px solid ${t.border}`, borderRadius: RAD.sm, cursor: "pointer", fontWeight: FW.medium, fontFamily: "inherit" }}>
              Abbrechen
            </button>
            <button onClick={speichern} disabled={!fName.trim()}
              style={{ fontSize: FS.s, padding: "5px 12px", background: accent, color: getContrastColor(accent),
                border: "none", borderRadius: RAD.sm, cursor: fName.trim() ? "pointer" : "not-allowed",
                opacity: fName.trim() ? 1 : 0.5, fontWeight: FW.bold, fontFamily: "inherit" }}>
              {editName ? "Speichern" : "Anlegen"}
            </button>
          </div>
        </div>
        );
      })()}

      <div style={{ display: "flex", alignItems: "center", gap: 4,
        padding: "6px 6px", fontSize: FS.xs, fontWeight: FW.bold, color: t.muted,
        textTransform: "uppercase", letterSpacing: "0.05em",
        borderBottom: `1px solid ${t.border}` }}>
        <div style={{ width: 22, flexShrink: 0 }}/>
        <div style={{ flex: 1, minWidth: 0 }}>{einheit}</div>
        {!ohneBadge && <>
          <div style={{ width: 48, textAlign: "center", flexShrink: 0 }}>Eck</div>
          <div style={{ width: 28, textAlign: "center", flexShrink: 0 }}>Pos.</div>
          <div style={{ width: 48, textAlign: "center", flexShrink: 0 }}>Badge</div>
        </>}
      </div>

      <div style={{ background: t.surface, border: `1px solid ${t.border}`,
        borderTop: "none", borderRadius: "0 0 9px 9px", padding: 4 }}>
        {[...liste].sort((a, b) => a.name.localeCompare(b.name, "de")).map((r) => {
          const eckAn = rolleEckSichtbar(r);
          const badgeAn = rolleBadgeSichtbar(r);
          const ecke = rolleEckPosition(r);
          const ist = r.name === selName;
          const markiert = bearbeiten && ist; // Highlight nur im Bearbeiten-Modus
          const rKuerzel = effKuerzel(r, kategorien);
          const rColor = effColor(r, kategorien);
          return (
            <div key={r.name}
              onClick={() => setSelName(r.name)}
              style={{
                display: "flex", alignItems: "center", gap: 4,
                padding: "6px 6px", borderRadius: RAD.sm, cursor: "pointer",
                background: markiert ? rColor + "12" : "transparent",
                border: `1px solid ${markiert ? rColor + "55" : "transparent"}`,
                opacity: !ohneBadge && !eckAn && !badgeAn ? 0.55 : 1,
                transition: "all 0.12s", marginBottom: 2,
              }}>
              <div style={{ width: 22, height: 22, borderRadius: RAD.full,
                background: rColor + "22", border: `1.5px solid ${rColor}60`,
                display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <span style={{ fontSize: FS.xxs, fontWeight: FW.heavy, color: rColor }}>{rKuerzel}</span>
              </div>
              <span style={{ fontSize: FS.m, flex: 1, minWidth: 0, color: t.text,
                whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                fontWeight: markiert ? 700 : 500 }}>{r.name}</span>
              {!ohneBadge && <>
              <div style={{ width: 48, display: "flex", justifyContent: "center", flexShrink: 0 }}
                onClick={(e) => e.stopPropagation()}>
                <Toggle value={eckAn} onChange={() => toggleEckSichtbar(r.name)} t={t} accent={toggleFarbe}/>
              </div>
              <div style={{ width: 28, display: "flex", justifyContent: "center", flexShrink: 0 }}>
                <PositionSelector aktivePosition={ecke}
                  onSelect={(pos) => setEckPosition(r.name, pos)}
                  farbe={rColor} disabled={!eckAn} t={t}/>
              </div>
              <div style={{ width: 48, display: "flex", justifyContent: "center", flexShrink: 0 }}
                onClick={(e) => e.stopPropagation()}>
                <Toggle value={badgeAn} onChange={() => toggleBadgeSichtbar(r.name)} t={t} accent={toggleFarbe}/>
              </div>
              </>}
              {/* Aktionen nur im Bearbeiten-Modus UND bei markierter Zeile. */}
              <div style={{ width: markiert ? 58 : 0, overflow: "hidden", display: "flex",
                justifyContent: "flex-end", gap: 4, flexShrink: 0, transition: "width 0.12s" }}
                onClick={(e) => e.stopPropagation()}>
                {markiert && (
                  <>
                    <button onClick={() => startEdit(r)} style={miniBtn} title="Bearbeiten">
                      <I name="pencil" size={11} color={t.sub}/>
                    </button>
                    <button onClick={() => loeschen(r.name)} style={miniBtn} title="Löschen">
                      <I name="trash" size={11} color="#EF4444"/>
                    </button>
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}


// ── Sektion: Statusleiste ───────────────────────────────────────────────────
// Steuert die kleinen Hinweis-Zeilen unter Objekt- und Kontakt-Karten.
// "Sichtbarkeit" = ob die Leiste pro Karten-Typ überhaupt angezeigt wird.
// "Inhalte"      = welche Status-Arten gerendert werden (Bestellung läuft ab,
//                  nächste ETV, Jahrestage, Zuweisung beginnt/endet, …).
function SektionStatusleiste({ settings, setSettings, t, accent }) {
  const update = (patch) => setSettings(s => ({ ...s, ...patch }));
  const updateInhalt = (key, value) => update({
    statusInhalte: Object.assign({}, settings.statusInhalte || {}, { [key]: value })
  });

  const inhalteKontakt = [
    { key: "geburtstag", label: "Jahrestage",
      desc: "Eigene Datum-Felder (Geburtstag, Hochzeitstag, Namenstag …) — zeigt das nächste innerhalb von 7 Tagen." },
    { key: "einzugAuszug", label: "Einzug / Auszug",
      desc: "Geplanter Einzug (nächste 30 Tage) oder anstehender Auszug (60 Tage) als Mieter/Bewohner." },
    { key: "eigentumswechsel", label: "Kauf / Verkauf",
      desc: "Wird Eigentümer (nächste 30 Tage) oder Eigentum endet — Verkauf (60 Tage)." },
    { key: "zuweisungAblauf", label: "Sonstige Zuweisungen",
      desc: "Andere Rollen beginnen oder enden bald — z. B. Beirat, Hausmeister, Verwalter." },
    { key: "ehemaligHinweis", label: "Keine aktiven Beteiligungen",
      desc: "Graue Hinweis-Zeile bei Kontakten, die nur noch EHEMALIGE Rollen haben (z. B. ausgezogener Mieter, Eigentümer nach Verkauf) — also aktuell an keinem Objekt mehr aktiv eingebunden sind. Hilft, Archiv-Kontakte zu erkennen, ohne sie zu löschen." },
  ];

  return (
    <>
      <EinstellKarte title="Sichtbarkeit" t={t} accent={accent}>
        <div style={{ fontSize: FS.s, color: t.muted, lineHeight: 1.45, marginBottom: 12 }}>
          Blende die farbigen Hinweise an Objekt- und Kontakt-Karten getrennt
          ein oder aus. Bei Objekten betrifft das die Statusleiste unter der
          Karte und den Handlungsbedarf-Punkt in der Liste gemeinsam — welche
          Fristen zählen und ab wann Gelb greift, stellst du über den Button ein.
        </div>
        <EinstellZeile label="Statusleiste · Objekte"
          sub="Hinweis-Zeile unter Objekt-Karten und Handlungsbedarf-Punkt in der Liste ein-/ausblenden" t={t}>
          <Toggle value={settings.statusLeisteObjekt !== false}
            onChange={(v) => update({ statusLeisteObjekt: v })} color={accent}/>
        </EinstellZeile>
        <EinstellZeile label="Statusleiste · Kontakte"
          sub="Hinweis-Zeile unter Kontakt-Karten ein-/ausblenden" t={t}>
          <Toggle value={settings.statusLeisteKontakt !== false}
            onChange={(v) => update({ statusLeisteKontakt: v })} color={accent}/>
        </EinstellZeile>
      </EinstellKarte>
      <div id="set-handlungsbedarf">
        <EinstellKarte title="Handlungsbedarf & Fristen · Objekte" t={t} accent={accent}>
          <div style={{ fontSize: FS.m, color: t.sub, lineHeight: 1.45, marginBottom: 12 }}>
            Zeigt den Handlungsbedarf eines Objekts farblich an —{" "}
            <span style={{ color: "#22C55E", fontWeight: FW.semi }}>grün</span> = alles ok,{" "}
            <span style={{ color: "#F59E0B", fontWeight: FW.semi }}>gelb</span> = eine Frist rückt näher,{" "}
            <span style={{ color: "#EF4444", fontWeight: FW.semi }}>rot</span> = eine Frist ist überfällig.
            In der Listenansicht als Punkt links, in der Kartenansicht als
            Statusleiste mit Grund unter der Karte. Lege fest, welche Fristen
            zählen und ab wie vielen Tagen vorher Gelb greift.
          </div>
          <HandlungsbedarfTabelle settings={settings} save={update} t={t} accent={accent}/>
          <div style={{ fontSize: FS.xs, color: t.muted, marginTop: 10, lineHeight: 1.4 }}>
            Vergangene Wiederholungen (z.B. die letzte Wartung) und reine
            Beginn-Termine zählen nicht — nur offene Fristen, Enden und Fälligkeiten.
            Später kommen Vorgänge als weitere Quelle dazu.
          </div>
        </EinstellKarte>
      </div>
      <EinstellKarte title="Inhalte · Kontakte" t={t} accent={accent}>
        {inhalteKontakt.map(item => (
          <EinstellZeile key={item.key} label={item.label} sub={item.desc} t={t}>
            <Toggle value={(settings.statusInhalte || {})[item.key] !== false}
              onChange={(v) => updateInhalt(item.key, v)} color={accent}/>
          </EinstellZeile>
        ))}
      </EinstellKarte>
    </>
  );
}

// ── TerminBezeichnungenEditor: Liste fürs "Neuer Termin"-Dropdown ───────────
// Lebt INNERHALB der Kalender-Sektion (kein eigenes EinstellKarte). Optik 1:1
// am Dashboard-Kachel-Muster: Sortier-Pfeile, getöntes Farb-Icon, Trennlinien
// (keine Boxen), FarbPicker + System-Toggle rechts. Editierbar: Label als
// dezentes Inline-Input. Liste aus { id, label, farbe, sichtbar }. Sichtbar-
// Toggle blendet aus dem Dropdown aus, ohne zu löschen. Löschen Zwei-Schritt
// (kein window.confirm — iOS-PWA, DESIGN §25.2).
function TerminBezeichnungenEditor({ settings, setSettings, t, accent }) {
  const liste = settings.terminBezeichnungen || [];
  const setListe = (next) => setSettings(s => ({ ...s, terminBezeichnungen: next }));
  const upd = (id, patch) => setListe(liste.map(b => b.id === id ? { ...b, ...patch } : b));
  const [loeschBereitId, setLoeschBereitId] = useState(null);
  // „Löschen?"-Zustand fällt nach 4s von selbst zurück (Muster wie
  // KategorienTabelle) — sonst bleibt der scharfe Button hängen.
  useEffect(() => {
    if (loeschBereitId == null) return;
    const tid = setTimeout(() => setLoeschBereitId(null), 4000);
    return () => clearTimeout(tid);
  }, [loeschBereitId]);
  const verschiebe = (idx, richtung) => {
    const ziel = idx + richtung;
    if (ziel < 0 || ziel >= liste.length) return;
    const neu = liste.slice();
    const tmp = neu[idx]; neu[idx] = neu[ziel]; neu[ziel] = tmp;
    setListe(neu);
  };
  const del = (b) => {
    if (loeschBereitId !== b.id) { setLoeschBereitId(b.id); return; }
    setListe(liste.filter(x => x.id !== b.id));
    setLoeschBereitId(null);
  };
  const neu = () => {
    const b = { id: "tb" + Date.now(), label: "", farbe: accent, sichtbar: true, bezug: "objekt", autoBeteiligte: "keine" };
    setListe([...liste, b]);
  };
  const verwendeteFarben = liste.map(b => b.farbe).filter(Boolean);
  return (
    <div>
      <div style={{ fontSize: FS.s, color: t.muted, lineHeight: 1.45, marginBottom: 10 }}>
        Diese Bezeichnungen erscheinen im Auswahlmenü beim Anlegen eines Termins
        (z. B. „ETV", „Belegprüfung"). Jede bekommt eine eigene Farbe; der Schalter
        blendet eine Bezeichnung aus dem Menü aus, ohne sie zu löschen. Über
        „Andere…" bleibt im Formular immer auch ein freier Text möglich.
      </div>
      <button onClick={neu}
        style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 12px",
          marginBottom: liste.length > 0 ? 8 : 0,
          borderRadius: RAD.sm, cursor: "pointer", fontFamily: "inherit",
          fontSize: FS.s, fontWeight: FW.bold, background: accent + "14",
          border: `1px solid ${accent}40`, color: accent }}>
        <I name="plus" size={12} color={accent}/>Bezeichnung anlegen
      </button>
      {liste.map((b, i) => {
        const farbe = b.farbe || accent;
        const aus = b.sichtbar === false;
        const bezug = b.bezug || "objekt";
        const bezugPill = (id, label, disabled) => (
          <button key={id} onClick={() => { if (!disabled) upd(b.id, { bezug: id }); }}
            title={disabled ? "Objektlose Termine folgen in Kürze" : undefined}
            style={{ padding: "3px 9px", borderRadius: RAD.pill,
              cursor: disabled ? "not-allowed" : "pointer",
              fontFamily: "inherit", fontSize: FS.xs, fontWeight: FW.bold,
              background: bezug === id ? farbe + "22" : "transparent",
              border: `1px solid ${bezug === id ? farbe : t.border}`,
              color: bezug === id ? farbe : t.sub,
              opacity: disabled ? 0.4 : 1 }}>
            {label}
          </button>
        );
        return (
          <div key={b.id} style={{
            borderBottom: `1px solid ${t.border}25`,
            paddingBottom: 6, marginBottom: 6, opacity: aus ? 0.55 : 1 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8,
              padding: "2px 6px", borderRadius: RAD.sm }}>
              <SortierPfeile
                canUp={i > 0} canDown={i < liste.length - 1}
                onUp={() => verschiebe(i, -1)} onDown={() => verschiebe(i, +1)}
                t={t} accent={accent}/>
              <div style={{ width: 28, height: 28, borderRadius: RAD.ms, flexShrink: 0,
                background: farbe + "20", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <I name="calendar" size={13} color={farbe}/>
              </div>
              <input value={b.label} placeholder="Bezeichnung…"
                onChange={e => upd(b.id, { label: e.target.value })}
                style={{ flex: 1, minWidth: 0, boxSizing: "border-box",
                  background: "transparent", border: "1px solid transparent",
                  borderRadius: RAD.sm, padding: "4px 6px",
                  fontSize: 16, color: t.text, outline: "none", fontFamily: "inherit" }}
                onFocus={e => { e.target.style.background = t.surface; e.target.style.border = `1px solid ${t.border}`; }}
                onBlur={e => { e.target.style.background = "transparent"; e.target.style.border = "1px solid transparent"; }}/>
              {(settings.farbIntensitaet != null ? settings.farbIntensitaet : 100) > 0 && (
                <FarbPicker value={farbe} t={t}
                  verwendeteFarben={verwendeteFarben}
                  onChange={(c) => upd(b.id, { farbe: c })}/>
              )}
              <Toggle value={b.sichtbar !== false} color={farbe}
                onChange={(v) => upd(b.id, { sichtbar: v })}/>
              <button onClick={() => del(b)}
                title={loeschBereitId === b.id ? "Nochmal tippen zum Löschen" : "Bezeichnung löschen"}
                aria-label="Bezeichnung löschen"
                style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 4,
                  height: 28, minWidth: 28, flexShrink: 0, cursor: "pointer",
                  padding: loeschBereitId === b.id ? "0 8px" : 0,
                  background: loeschBereitId === b.id ? "#EF4444" : "transparent",
                  border: "1px solid " + (loeschBereitId === b.id ? "#EF4444" : "#EF444440"),
                  borderRadius: RAD.sm, fontFamily: "inherit",
                  fontSize: FS.xs, fontWeight: FW.bold,
                  color: loeschBereitId === b.id ? "#fff" : "#EF4444" }}>
                {loeschBereitId === b.id ? "Löschen?" : <I name="x" size={12} color="#EF4444"/>}
              </button>
            </div>
            {/* Bezug: was beim Anlegen abgefragt wird */}
            <div style={{ display: "flex", alignItems: "center", gap: 6,
              paddingLeft: 42, marginTop: 4 }}>
              <span style={{ fontSize: FS.xs, color: t.muted, marginRight: 2 }}>Bezug:</span>
              {bezugPill("keiner", "Kein Objekt", false)}
              {bezugPill("objekt", "Nur Objekt", false)}
              {bezugPill("einheit", "Objekt + Einheit", false)}
            </div>
            {/* Auto-Beteiligte: Personen automatisch vorschlagen (nur bei Objektbezug) */}
            {bezug !== "keiner" && (() => {
              const aktuelleRegel = b.autoBeteiligte || "keine";
              // Verfügbare Regeln je Bezug: "objekt" → nur Eigentümer; "einheit" → alle.
              const erlaubt = bezug === "einheit"
                ? ["keine", "eigentuemer", "eig_nutzer_einheit", "nutzer_einheit"]
                : ["keine", "eigentuemer"];
              return (
                <div style={{ display: "flex", alignItems: "center", gap: 6,
                  paddingLeft: 42, marginTop: 6 }}>
                  <span style={{ fontSize: FS.xs, color: t.muted, marginRight: 2 }}>Personen automatisch:</span>
                  <select value={erlaubt.indexOf(aktuelleRegel) >= 0 ? aktuelleRegel : "keine"}
                    onChange={e => upd(b.id, { autoBeteiligte: e.target.value })}
                    style={{ background: t.surface, border: `1px solid ${t.border}`,
                      borderRadius: RAD.sm, padding: "4px 8px", fontSize: 16,
                      color: t.text, fontFamily: "inherit", cursor: "pointer" }}>
                    {AUTO_BETEILIGTE_REGELN.filter(r => erlaubt.indexOf(r.id) >= 0).map(r => (
                      <option key={r.id} value={r.id}>{r.label}</option>
                    ))}
                  </select>
                </div>
              );
            })()}
          </div>
        );
      })}
      {liste.length === 0 && (
        <div style={{ fontSize: FS.s, color: t.muted, fontStyle: "italic",
          padding: "6px 2px" }}>
          Noch keine Bezeichnungen — beim Anlegen steht nur „Andere…" zur Verfügung.
        </div>
      )}
    </div>
  );
}

// ── Sektion: Suche ──────────────────────────────────────────────────────────
function SektionSuche({ settings, setSettings, t, accent }) {
  const save = (partial) => setSettings(s => ({ ...s, ...partial }));
  return (
    <>
      <EinstellKarte title="Suchabdeckung" t={t} accent={accent}>
        <div style={{ fontSize: FS.m, color: t.sub, marginBottom: 8, lineHeight: 1.4 }}>
          Welche Bereiche werden in der Universalsuche durchsucht.
        </div>
        {settings.suchKategorien.map((kat, i) => (
          <EinstellZeile key={kat.id} label={kat.label} t={t}>
            <Toggle value={kat.aktiv}
              onChange={v => save({ suchKategorien: settings.suchKategorien.map((k, j) => j === i ? { ...k, aktiv: v } : k) })}
              color={accent}/>
          </EinstellZeile>
        ))}
      </EinstellKarte>

      <EinstellKarte title="Intelligente Suche" t={t} accent={accent}>
        <div style={{ fontSize: FS.m, color: t.sub, marginBottom: 10, lineHeight: 1.4 }}>
          Findet auch ähnliche Schreibweisen, ähnlich klingende Namen und Tippfehler. Exakte Treffer werden immer zuerst angezeigt.
        </div>
        <EinstellZeile label="Umlaute & Akzente ignorieren"
          sub={"\u201Emüller\u201C findet \u201EMüller\u201C, \u201EMueller\u201C, \u201EMuller\u201C"} t={t}>
          <Toggle value={settings.sucheDiakritika !== false}
            onChange={v => save({ sucheDiakritika: v })} color={accent}/>
        </EinstellZeile>
        <EinstellZeile label="Mehrere Wortteile"
          sub={"\u201Elin marc\u201C findet \u201EMarcus Linder\u201C"} t={t}>
          <Toggle value={settings.sucheWoerter !== false}
            onChange={v => save({ sucheWoerter: v })} color={accent}/>
        </EinstellZeile>
        <EinstellZeile label="Ähnlich klingende Namen (Kölner Phonetik)"
          sub={"\u201EMeier\u201C findet auch \u201EMeyer\u201C, \u201EMayer\u201C, \u201EMaier\u201C – und \u201EMathias\u201C findet \u201EMatthias\u201C, \u201EMatieas\u201C"} t={t}>
          <Toggle value={settings.suchePhonetik !== false}
            onChange={v => save({ suchePhonetik: v })} color={accent}/>
        </EinstellZeile>
        <EinstellZeile label="Tippfehler-Toleranz"
          sub="Findet Treffer mit kleinen Schreibfehlern" t={t}>
          <Toggle value={settings.sucheTippfehler !== false}
            onChange={v => save({ sucheTippfehler: v })} color={accent}/>
        </EinstellZeile>
        {settings.sucheTippfehler !== false && (
          <EinstellZeile label="Tippfehler-Schärfe"
            sub="Wie viele Buchstaben darf der Treffer maximal abweichen" t={t}>
            <div style={{ display: "flex", gap: 4, background: t.surface,
              border: `1px solid ${t.border}`, borderRadius: RAD.md, padding: 3 }}>
              {[
                { v: 1, label: "Streng" },
                { v: 2, label: "Normal" },
                { v: 3, label: "Tolerant" },
              ].map(opt => {
                const aktiv = (settings.sucheTippfehlerSchwelle || 2) === opt.v;
                return (
                  <button key={opt.v} onClick={() => save({ sucheTippfehlerSchwelle: opt.v })}
                    style={{
                      background: aktiv ? accent : "transparent",
                      color: aktiv ? "#fff" : t.sub,
                      border: "none", borderRadius: RAD.sm,
                      padding: "5px 12px", cursor: "pointer",
                      fontFamily: "inherit", fontSize: FS.m, fontWeight: FW.medium }}>
                    {opt.label}
                  </button>
                );
              })}
            </div>
          </EinstellZeile>
        )}
      </EinstellKarte>
    </>
  );
}

// ── Tastaturkürzel ──────────────────────────────────────────────────────────
// Globale Kürzel im Stil verbreiteter Web-Apps (Gmail/GitHub): einzelne Tasten,
// nur aktiv wenn KEIN Eingabefeld fokussiert ist. Standard-Belegung hier;
// Overrides in settings.tastaturBelegung. Konflikte werden beim Zuweisen in
// der Einstellungs-Sektion verhindert.
const TASTATUR_AKTIONEN = [
  { id: "navHome",          gruppe: "Navigation", defaultKey: "h", label: "Übersicht (Home)",
    beschreibung: "Wechselt zur Kachel-Übersicht (Startseite)." },
  { id: "navObjekte",       gruppe: "Navigation", defaultKey: "o", label: "Objekte",
    beschreibung: "Öffnet die Objektliste." },
  { id: "navKontakte",      gruppe: "Navigation", defaultKey: "k", label: "Kontakte",
    beschreibung: "Öffnet die Kontaktliste." },
  { id: "navKalender",      gruppe: "Navigation", defaultKey: "t", label: "Kalender / Termine",
    beschreibung: "Öffnet den Kalender." },
  { id: "navListen",        gruppe: "Navigation", defaultKey: "l", label: "Listengenerator",
    beschreibung: "Öffnet den Listengenerator." },
  { id: "navStatistik",     gruppe: "Navigation", defaultKey: "s", label: "Statistik",
    beschreibung: "Öffnet das Statistik-Dashboard." },
  { id: "navEinstellungen", gruppe: "Navigation", defaultKey: "e", label: "Einstellungen",
    beschreibung: "Öffnet die Einstellungen (Zentrale)." },
  { id: "sucheFokus",       gruppe: "Aktionen",   defaultKey: "/", label: "Suche",
    beschreibung: "Setzt den Cursor in das globale Suchfeld." },
  { id: "hilfe",            gruppe: "Aktionen",   defaultKey: "?", label: "Kürzel-Übersicht",
    beschreibung: "Öffnet diese Tastatur-Übersicht in den Einstellungen." },
  { id: "neu",              gruppe: "Aktionen",   defaultKey: "n", label: "Neu anlegen",
    beschreibung: "Legt im aktuellen Bereich einen neuen Eintrag an (z. B. Kontakt oder Objekt)." },
  { id: "listeAuf",         gruppe: "Listen",     defaultKey: "ArrowUp", label: "Nach oben",
    beschreibung: "Bewegt die Markierung in der Liste ein Element nach oben." },
  { id: "listeAb",          gruppe: "Listen",     defaultKey: "ArrowDown", label: "Nach unten",
    beschreibung: "Bewegt die Markierung in der Liste ein Element nach unten." },
  { id: "oeffnen",          gruppe: "Listen",     defaultKey: "Enter", label: "Öffnen",
    beschreibung: "Öffnet das markierte Listenelement." },
  { id: "zurueck",          gruppe: "Listen",     defaultKey: "Escape", fest: true, label: "Zurück / Schließen",
    beschreibung: "Schließt das geöffnete Detail bzw. geht zur Liste zurück. (Fest belegt.)" },
];
// Sondertasten, die zugewiesen werden dürfen, mit hübscher Anzeige.
const TASTATUR_SONDER = { ArrowUp: "↑", ArrowDown: "↓", ArrowLeft: "←",
  ArrowRight: "→", Enter: "Enter" };
function tastaturTasteAnzeige(k) {
  if (k === "Escape") return "Esc";
  return TASTATUR_SONDER[k] || k;
}
// Effektive Belegung: Standard + Overrides → { aktionId: taste }.
function tastaturBelegungVon(settings) {
  const ueber = (settings && settings.tastaturBelegung) || {};
  const aus = {};
  TASTATUR_AKTIONEN.forEach(a => { aus[a.id] = ueber[a.id] || a.defaultKey; });
  return aus;
}
// Druckbare Übersicht der aktuellen Belegung (gemeinsamer iframe-Druck §26.3).
function druckeTastaturUebersicht(settings) {
  const belegung = tastaturBelegungVon(settings);
  const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const heute = new Date().toLocaleDateString("de-DE");
  let body = "<h1>AllesDa – Tastaturkürzel</h1>"
    + '<p class="meta">Stand: ' + esc(heute) + " · Kürzel wirken nur, wenn kein Eingabefeld aktiv ist</p>";
  const gruppen = [];
  TASTATUR_AKTIONEN.forEach(a => { if (gruppen.indexOf(a.gruppe) < 0) gruppen.push(a.gruppe); });
  gruppen.forEach(g => {
    body += "<h2>" + esc(g) + "</h2><table>";
    TASTATUR_AKTIONEN.filter(a => a.gruppe === g).forEach(a => {
      body += "<tr><td class='taste'><span class='kbd'>" + esc(tastaturTasteAnzeige(belegung[a.id])) + "</span></td>"
        + "<td class='fn'>" + esc(a.label) + "</td><td>" + esc(a.beschreibung) + "</td></tr>";
    });
    body += "</table>";
  });
  return druckeHtml("AllesDa – Tastaturkürzel", body, false,
    "h2{font-size:13px;margin:18px 0 4px;}"
    + ".taste{width:56px;}.fn{width:170px;font-weight:600;}"
    + ".kbd{display:inline-block;border:1px solid #999;border-bottom-width:2px;"
    + "border-radius:4px;padding:2px 8px;font-family:ui-monospace,monospace;"
    + "font-size:12px;background:#f5f5f5;}");
}

// ── Sektion: Tastatur ───────────────────────────────────────────────────────
// Je Aktion eine Zeile mit Beschreibung + Tasten-Button. Klick auf die Taste →
// Aufnahme-Modus („Taste drücken…"), nächster Tastendruck wird zugewiesen.
// Escape bricht ab. Bereits belegte Tasten werden abgelehnt (Hinweis).
function SektionTastatur({ settings, setSettings, t, accent }) {
  const [captureId, setCaptureId] = useState(null);
  const [meldung, setMeldung] = useState(null); // { aktionId, text }
  const save = (partial) => setSettings(s => ({ ...s, ...partial }));
  const belegung = tastaturBelegungVon(settings);
  const istStandard = TASTATUR_AKTIONEN.every(a => belegung[a.id] === a.defaultKey);

  const zuweisen = (aktionId, e) => {
    e.preventDefault();
    e.stopPropagation(); // globalen Kürzel-Handler nicht auslösen
    const k = e.key;
    if (k === "Escape") { setCaptureId(null); setMeldung(null); return; }
    if (k === "Tab") return; // Fokus-Navigation nicht kapern
    const istZeichen = k.length === 1 && k !== " ";
    const istSonder = !!TASTATUR_SONDER[k];
    if (!istZeichen && !istSonder) {
      setMeldung({ aktionId, text: "Bitte eine Zeichen-Taste, Pfeiltaste oder Enter wählen." });
      return;
    }
    const taste = istZeichen && /[a-zA-Z]/.test(k) ? k.toLowerCase() : k;
    const konflikt = TASTATUR_AKTIONEN.find(a => a.id !== aktionId && belegung[a.id] === taste);
    if (konflikt) {
      setMeldung({ aktionId, text: "„" + taste + "\u201C ist bereits belegt durch: " + konflikt.label + "." });
      return;
    }
    save({ tastaturBelegung: { ...(settings.tastaturBelegung || {}), [aktionId]: taste } });
    setCaptureId(null); setMeldung(null);
  };

  const gruppen = [];
  TASTATUR_AKTIONEN.forEach(a => { if (gruppen.indexOf(a.gruppe) < 0) gruppen.push(a.gruppe); });

  const kbdStil = (aktiv) => ({
    minWidth: 44, padding: "6px 12px", textAlign: "center", cursor: "pointer",
    fontFamily: "ui-monospace, monospace", fontSize: FS.m, fontWeight: FW.bold,
    background: aktiv ? accent + "22" : t.surface,
    border: `1px solid ${aktiv ? accent : t.border}`, borderBottomWidth: 2,
    borderRadius: RAD.sm, color: aktiv ? accent : t.text,
  });

  return (
    <>
      <EinstellKarte title="Tastaturkürzel" t={t} accent={accent}>
        <EinstellZeile label="Kürzel aktiv"
          sub="Einzelne Tasten wirken global — aber nie, während du in einem Eingabefeld tippst." t={t}>
          <Toggle value={settings.tastaturAn !== false}
            onChange={v => save({ tastaturAn: v })} color={accent}/>
        </EinstellZeile>

        {gruppen.map(g => (
          <div key={g} style={{ marginTop: 14 }}>
            <div style={{ fontSize: FS.xs, fontWeight: FW.bold, color: t.sub,
              textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6 }}>{g}</div>
            {TASTATUR_AKTIONEN.filter(a => a.gruppe === g).map(a => (
              <div key={a.id} style={{ display: "flex", alignItems: "center", gap: 12,
                padding: "8px 0", borderBottom: `1px solid ${t.border}40` }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: FS.m, fontWeight: FW.medium, color: t.text }}>{a.label}</div>
                  <div style={{ fontSize: FS.s, color: t.sub, lineHeight: 1.35 }}>{a.beschreibung}</div>
                  {meldung && meldung.aktionId === a.id && (
                    <div style={{ fontSize: FS.s, color: "#EF4444", marginTop: 3 }}>{meldung.text}</div>
                  )}
                </div>
                <button onClick={a.fest ? undefined : () => { setCaptureId(a.id); setMeldung(null); }}
                  onKeyDown={captureId === a.id ? (e) => zuweisen(a.id, e) : undefined}
                  onBlur={() => { if (captureId === a.id) setCaptureId(null); }}
                  title={a.fest ? "Fest belegt — nicht änderbar"
                    : (captureId === a.id ? "Gewünschte Taste drücken (Esc bricht ab)" : "Klicken und neue Taste drücken")}
                  style={{ ...kbdStil(captureId === a.id),
                    cursor: a.fest ? "default" : "pointer",
                    opacity: a.fest ? 0.6 : 1 }}>
                  {captureId === a.id ? "Taste…" : tastaturTasteAnzeige(belegung[a.id])}
                </button>
              </div>
            ))}
          </div>
        ))}

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 14 }}>
          <button onClick={() => druckeTastaturUebersicht(settings)}
            style={{ display: "inline-flex", alignItems: "center", gap: 6,
              padding: "8px 14px", borderRadius: RAD.sm, cursor: "pointer",
              fontFamily: "inherit", fontSize: FS.s, fontWeight: FW.medium,
              background: accent + "15", color: accent, border: `1px solid ${accent}40` }}>
            <I name="document" size={13} color={accent}/>Übersicht drucken
          </button>
          <button onClick={() => { save({ tastaturBelegung: {} }); setMeldung(null); }}
            disabled={istStandard}
            style={{ display: "inline-flex", alignItems: "center", gap: 6,
              padding: "8px 14px", borderRadius: RAD.sm,
              cursor: istStandard ? "default" : "pointer", opacity: istStandard ? 0.5 : 1,
              fontFamily: "inherit", fontSize: FS.s, fontWeight: FW.medium,
              background: "none", color: t.sub, border: `1px solid ${t.border}` }}>
            Auf Standard zurücksetzen
          </button>
        </div>
      </EinstellKarte>
    </>
  );
}

// ── Sektion: Hausverwaltung ─────────────────────────────────────────────────
// Logo-Variante des Bild-Helfers: NICHT quadratisch beschnitten (Logos sind
// meist breit), max. 120px hoch, Transparenz bleibt erhalten (PNG).
function dateiZuLogoDataUrl(file, callback) {
  if (!file || !file.type || file.type.indexOf("image/") !== 0) {
    callback(null); return;
  }
  const reader = new FileReader();
  reader.onload = function(ev) {
    const img = new Image();
    img.onload = function() {
      const ZIEL_H = 120;
      const skala = img.height > ZIEL_H ? ZIEL_H / img.height : 1;
      const w = Math.max(1, Math.round(img.width * skala));
      const h = Math.max(1, Math.round(img.height * skala));
      const canvas = document.createElement("canvas");
      canvas.width = w; canvas.height = h;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(img, 0, 0, w, h);
      callback(canvas.toDataURL("image/png"));
    };
    img.onerror = function() { callback(null); };
    img.src = ev.target.result;
  };
  reader.onerror = function() { callback(null); };
  reader.readAsDataURL(file);
}

function SektionHV({ settings, setSettings, t, accent }) {
  const [hvName, setHvName] = useState(settings.hvName);
  const save = (partial) => setSettings(s => ({ ...s, ...partial }));
  const logoSrc = settings.hvLogo || settings.hvLogoUrl || "";
  const logoWaehlen = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.style.display = "none";
    input.onchange = (e) => {
      const file = e.target.files && e.target.files[0];
      if (!file) return;
      dateiZuLogoDataUrl(file, (dataUrl) => {
        if (dataUrl) save({ hvLogo: dataUrl });
        try { document.body.removeChild(input); } catch (err) {}
      });
    };
    document.body.appendChild(input);
    input.click();
  };
  return (
    <EinstellKarte title="Hausverwaltung" t={t} accent={accent}>
      <Inp label="Name" value={hvName}
        onChange={v => { setHvName(v); save({ hvName: v }); }}
        placeholder="Muster Hausverwaltung GmbH" t={t} accent={accent}/>
      <div style={{ marginTop: 12 }}>
        <div style={{ fontSize: FS.xs, fontWeight: FW.bold, color: t.sub,
          textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6 }}>Logo</div>
        <div style={{ fontSize: FS.s, color: t.sub, marginBottom: 8, lineHeight: 1.4 }}>
          Erscheint im Kopf gedruckter Listen (Listengenerator) rechts oben.
        </div>
        {logoSrc && (
          <div style={{ background: "#FFFFFF", border: `1px solid ${t.border}`,
            borderRadius: RAD.sm, padding: 10, display: "inline-block", marginBottom: 8 }}>
            <img src={logoSrc} alt="Logo" style={{ maxHeight: 48, maxWidth: 200,
              objectFit: "contain", display: "block" }}/>
          </div>
        )}
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button onClick={logoWaehlen} style={{ display: "inline-flex", alignItems: "center",
            gap: 6, padding: "7px 14px", borderRadius: RAD.sm, cursor: "pointer",
            fontFamily: "inherit", fontSize: FS.s, fontWeight: FW.medium,
            background: accent + "15", color: accent, border: `1px solid ${accent}40` }}>
            {settings.hvLogo ? "Logo ändern…" : "Logo hochladen…"}
          </button>
          {settings.hvLogo && (
            <button onClick={() => save({ hvLogo: "" })} style={{ display: "inline-flex",
              alignItems: "center", gap: 6, padding: "7px 14px", borderRadius: RAD.sm,
              cursor: "pointer", fontFamily: "inherit", fontSize: FS.s,
              background: "none", color: t.sub, border: `1px solid ${t.border}` }}>
              Entfernen
            </button>
          )}
        </div>
      </div>
    </EinstellKarte>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// useStorageStatus — React-Hook für den aktuellen Speicher-Modus
// ─────────────────────────────────────────────────────────────────────────────
// Abonniert `storage.abonniereStatus()` und liefert ein State-Objekt mit
//   { modus, ordnerName, letzteSpeicherung, fehler, fsaVerfuegbar }
function useStorageStatus() {
  const [status, setStatus] = useState(storage.status());
  useEffect(() => {
    const unsub = storage.abonniereStatus((s) => setStatus(s));
    return unsub;
  }, []);
  return status;
}

// ── OrdnerAnbindenKarte — Anbindung eines Ordners auf der Festplatte ────────
// Sichtbar in Einstellungen → Daten. Zeigt den aktuellen Status, Buttons zum
// Wählen / Erneuern / Trennen. Funktioniert nur in Chrome/Edge — in Safari
// erscheint stattdessen ein Hinweis-Block.
function OrdnerAnbindenKarte({ t, accent }) {
  const s = useStorageStatus();
  const [busy, setBusy] = useState(false);
  // Zwei-Schritt-Trennen statt confirm() (DESIGN §25.2): erster Tap macht den
  // Button scharf, zweiter trennt. Jede andere Aktion entschärft.
  const [trennenBereit, setTrennenBereit] = useState(false);

  const onWaehlen = async () => {
    setTrennenBereit(false);
    setBusy(true);
    try { await storage.waehleOrdner(); } finally { setBusy(false); }
  };
  const onAktivieren = async () => {
    setTrennenBereit(false);
    setBusy(true);
    try { await storage.aktiviereOrdnerErneut(); } finally { setBusy(false); }
  };
  const onTrennen = async () => {
    if (!trennenBereit) { setTrennenBereit(true); return; }
    setTrennenBereit(false);
    setBusy(true);
    try { await storage.trenneOrdner(); } finally { setBusy(false); }
  };

  const btnPrimary = {
    display: "flex", alignItems: "center", gap: 6,
    background: accent, color: getContrastColor(accent), border: "none",
    borderRadius: RAD.ms, padding: "8px 14px", cursor: busy ? "wait" : "pointer",
    fontFamily: "inherit", fontSize: FS.m, fontWeight: FW.medium,
    opacity: busy ? 0.6 : 1,
  };
  const btnSecondary = {
    display: "flex", alignItems: "center", gap: 6,
    background: accent + "4D", color: t.text, border: `1px solid ${accent}80`,
    borderRadius: RAD.ms, padding: "8px 14px", cursor: busy ? "wait" : "pointer",
    fontFamily: "inherit", fontSize: FS.m, fontWeight: FW.medium,
  };
  const btnDanger = {
    display: "flex", alignItems: "center", gap: 6,
    background: accent + "1A", color: "#EF4444",
    border: "1px solid #EF444460",
    borderRadius: RAD.ms, padding: "8px 14px", cursor: busy ? "wait" : "pointer",
    fontFamily: "inherit", fontSize: FS.m, fontWeight: FW.medium,
  };

  // Browser ohne File System Access (Safari, Firefox, iOS) — nur Hinweis
  if (!s.fsaVerfuegbar) {
    return (
      <EinstellKarte title="Ordner auf der Festplatte anbinden" t={t} accent={accent}>
        <div style={{ display: "flex", alignItems: "flex-start", gap: 8,
          padding: "10px 12px", background: "#F59E0B15",
          border: "1px solid #F59E0B40", borderRadius: RAD.ms,
          fontSize: FS.m, color: t.text, lineHeight: 1.5 }}>
          <I name="settings" size={14} color="#F59E0B"/>
          <div>
            Dein Browser unterstützt keinen direkten Ordnerzugriff.
            In Safari und Firefox funktioniert das Anbinden nicht — bitte
            <strong> Chrome oder Edge</strong> nutzen, wenn du diese Funktion brauchst.
            Die App läuft weiterhin und speichert im Browser-Speicher.
          </div>
        </div>
      </EinstellKarte>
    );
  }

  // FSA verfügbar — drei Zustände
  return (
    <EinstellKarte title="Ordner auf der Festplatte anbinden" t={t} accent={accent}>
      <div style={{ fontSize: FS.m, color: t.sub, lineHeight: 1.55, marginBottom: 12 }}>
        Wähle einen Ordner auf deinem Rechner als Single Source of Truth.
        Die App speichert <strong>aktiv/daten.json</strong> und <strong>aktiv/einstellungen.json</strong> live mit jeder Änderung.
        Du kannst den Ordner z.&nbsp;B. in iCloud, Dropbox oder OneDrive ablegen — dann läuft das Backup automatisch.
      </div>

      {s.modus === "datei" && (
        <div style={{ display: "flex", alignItems: "center", gap: 8,
          padding: "10px 12px", background: "#10B98115",
          border: "1px solid #10B98140", borderRadius: RAD.ms,
          marginBottom: 10, fontSize: FS.m, color: t.text }}>
          <span style={{ width: 8, height: 8, borderRadius: RAD.pill,
            background: "#10B981", flexShrink: 0 }}/>
          <div style={{ flex: 1 }}>
            <strong>{s.ordnerName || "Ordner"}</strong> ist verbunden.
            {s.letzteSpeicherung && (
              <span style={{ color: t.muted }}> · Zuletzt gespeichert: {new Date(s.letzteSpeicherung).toLocaleTimeString()}</span>
            )}
          </div>
        </div>
      )}

      {s.modus === "datei-pause" && (
        <div style={{ display: "flex", alignItems: "flex-start", gap: 8,
          padding: "10px 12px", background: "#F59E0B15",
          border: "1px solid #F59E0B40", borderRadius: RAD.ms,
          marginBottom: 10, fontSize: FS.m, color: t.text }}>
          <I name="settings" size={14} color="#F59E0B"/>
          <div style={{ flex: 1 }}>
            <strong>Berechtigung pausiert.</strong> {s.fehler || "Bitte Zugriff erneut erlauben."}
          </div>
        </div>
      )}

      {s.fehler && s.modus !== "datei-pause" && (
        <div style={{ display: "flex", alignItems: "flex-start", gap: 8,
          padding: "10px 12px", background: "#EF444415",
          border: "1px solid #EF444440", borderRadius: RAD.ms,
          marginBottom: 10, fontSize: FS.m, color: t.text }}>
          <I name="x" size={14} color="#EF4444"/>
          <div style={{ flex: 1 }}>{s.fehler}</div>
        </div>
      )}

      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
        {s.modus !== "datei" && s.modus !== "datei-pause" && (
          <button onClick={onWaehlen} style={btnPrimary} disabled={busy}>
            <I name="document" size={12} color={getContrastColor(accent)}/>Ordner wählen…
          </button>
        )}
        {s.modus === "datei-pause" && (
          <button onClick={onAktivieren} style={btnPrimary} disabled={busy}>
            <I name="check" size={12} color="#fff"/>Zugriff erneuern
          </button>
        )}
        {(s.modus === "datei" || s.modus === "datei-pause") && (
          <button onClick={onTrennen} disabled={busy}
            style={{ ...btnDanger,
              background: trennenBereit ? "#EF4444" : btnDanger.background,
              color: trennenBereit ? "#fff" : btnDanger.color,
              border: "1px solid #EF4444" + (trennenBereit ? "" : "60") }}>
            <I name="x" size={12} color={trennenBereit ? "#fff" : "#EF4444"}/>
            {trennenBereit ? "Wirklich trennen?" : "Ordner trennen"}
          </button>
        )}
      </div>
      {trennenBereit && (
        <div style={{ marginTop: 8, fontSize: FS.s, color: t.sub, lineHeight: 1.4 }}>
          Die App speichert dann wieder nur im Browser. Deine Daten im Ordner
          bleiben unverändert. Nochmal tippen zum Trennen.
        </div>
      )}
    </EinstellKarte>
  );
}

// ── ImportMeldung — Inline-Bestätigung/Fehler für Import-Aktionen ───────────
// Ersetzt window.confirm/alert in den Import-Flows (beide in iOS-Standalone-
// PWAs unzuverlässig, DESIGN §25.2). Zwei Varianten:
//   "bestaetigen": Titel + Zusammenfassungs-Zeilen + optionale orangene
//                  Schema-Warnung + Buttons „Abbrechen" / jaText (Akzentfarbe)
//   "fehler":      rote Box, Titel = Fehlertext, nur „Schließen"
function ImportMeldung({ variante, titel, zeilen = [], warnung = null,
                         onJa = null, onNein, jaText = "Einspielen", t, accent }) {
  const istFehler = variante === "fehler";
  const farbe = istFehler ? "#EF4444" : accent;
  const orange = "#F59E0B";
  return (
    <div style={{ marginTop: 8, padding: "10px 12px", background: farbe + "12",
      border: "1px solid " + farbe + "50", borderRadius: RAD.ms }}>
      <div style={{ fontSize: FS.m, fontWeight: FW.medium, color: t.text,
        lineHeight: 1.4, marginBottom: (zeilen.length > 0 || warnung) ? 6 : 0 }}>
        {titel}
      </div>
      {zeilen.map((z, i) => (
        <div key={i} style={{ fontSize: FS.s, color: t.sub, padding: "1px 0" }}>{z}</div>
      ))}
      {warnung && (
        <div style={{ marginTop: 6, padding: "6px 9px", background: orange + "18",
          border: "1px solid " + orange + "50", borderRadius: RAD.sm,
          fontSize: FS.s, color: t.text, lineHeight: 1.4 }}>
          ⚠ {warnung}
        </div>
      )}
      <div style={{ display: "flex", gap: 6, justifyContent: "flex-end", marginTop: 8 }}>
        {!istFehler && (
          <button onClick={onNein} style={{ background: "none",
            border: "1px solid " + t.border, color: t.sub, borderRadius: RAD.sm,
            padding: "5px 12px", cursor: "pointer", fontSize: FS.s,
            fontFamily: "inherit" }}>Abbrechen</button>
        )}
        <button onClick={istFehler ? onNein : onJa} style={{
          background: istFehler ? "none" : farbe,
          border: "1px solid " + farbe,
          color: istFehler ? farbe : getContrastColor(farbe),
          borderRadius: RAD.sm, padding: "5px 12px", cursor: "pointer",
          fontSize: FS.s, fontWeight: FW.medium, fontFamily: "inherit" }}>
          {istFehler ? "Schließen" : jaText}
        </button>
      </div>
    </div>
  );
}

// ── Sektion: Daten (Platzhalter, kommt im nächsten Schritt) ─────────────────
function SektionDaten({ t, accent, settings, setSettings, mode, setMode,
  kontakte, setKontakte, ves, setVes }) {
  const groesse = storage.speicherGroesse();
  const formatKB = (n) => (n / 1024).toFixed(1) + " KB";

  // Inline-Meldungen statt confirm()/alert() (iOS-PWA, DESIGN §25.2):
  // pendingImport = wartende Bestätigung nach Dateiauswahl
  //   { art: "settings"|"daten"|"excel", titel, zeilen[], warnung|null, anwenden() }
  // importFehler  = { art: "settings"|"daten"|"excel", text }
  // resetBereit   = Zwei-Schritt-Scharfstellung der Reset-Buttons
  const [pendingImport, setPendingImport] = useState(null);
  const [importFehler, setImportFehler] = useState(null);
  const [resetBereit, setResetBereit] = useState(null); // "settings"|"daten"|null
  const meldungenZuruecksetzen = () => {
    setPendingImport(null); setImportFehler(null); setResetBereit(null);
  };

  const datumStempel = () => {
    const d = new Date();
    const pad = (n) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}_${pad(d.getHours())}${pad(d.getMinutes())}`;
  };

  const onSettingsExport = () => {
    exportiereJSON({
      typ: "allesda-settings",
      schema: STORAGE_SCHEMA_VERSION,
      appVersion: APP_VERSION,
      exportiertAm: new Date().toISOString(),
      mode,
      settings,
    }, `allesda-einstellungen_${datumStempel()}.json`);
  };
  const onSettingsImport = () => {
    meldungenZuruecksetzen();
    importiereJSON((obj, dateiname) => {
      if (!obj || obj.typ !== "allesda-settings" || !obj.settings) {
        setImportFehler({ art: "settings", text: "Diese Datei enthält keine "
          + "AllesDa-Einstellungen. (" + (dateiname || "unbekannt") + ")" });
        return;
      }
      setPendingImport({
        art: "settings",
        titel: "Einstellungen aus „" + dateiname + "\u201C einspielen?",
        zeilen: ["Die aktuellen Einstellungen werden überschrieben."],
        warnung: schemaWarnung(obj),
        anwenden: () => {
          setSettings(s => ({ ...s, ...obj.settings }));
          if (obj.mode === "dark" || obj.mode === "light") setMode(obj.mode);
        },
      });
    }, (msg) => setImportFehler({ art: "settings", text: msg }));
  };

  const onDatenExport = () => {
    exportiereJSON({
      typ: "allesda-daten",
      schema: STORAGE_SCHEMA_VERSION,
      appVersion: APP_VERSION,
      exportiertAm: new Date().toISOString(),
      kontakte, ves,
    }, `allesda-daten_${datumStempel()}.json`);
  };
  const onDatenImport = () => {
    meldungenZuruecksetzen();
    importiereJSON((obj, dateiname) => {
      if (!obj || obj.typ !== "allesda-daten") {
        setImportFehler({ art: "daten", text: "Diese Datei enthält keine "
          + "AllesDa-Daten. (" + (dateiname || "unbekannt") + ")" });
        return;
      }
      const mig = migriereZuweisungen(obj);
      const anzKont = Array.isArray(mig.kontakte) ? mig.kontakte.length : 0;
      const anzVes  = Array.isArray(mig.ves) ? mig.ves.length : 0;
      setPendingImport({
        art: "daten",
        titel: "Daten aus „" + dateiname + "\u201C einspielen?",
        zeilen: [anzKont + " Kontakte · " + anzVes + " Objekte",
          "Die aktuellen Daten werden überschrieben."],
        warnung: schemaWarnung(obj),
        anwenden: () => {
          // Objekte zuerst normalisieren — die Einheiten/Belegungen darin sind
          // die Quelle für die Rollen-Ableitung.
          const veNorm = Array.isArray(mig.ves) ? normalisiereVes(mig.ves) : null;
          let kontNorm = Array.isArray(mig.kontakte) ? normalisiereKontakte(mig.kontakte) : null;
          // Rollen (objektZuweisungen + rollen[]) zentral aus dem Besitz-/
          // Belegungsmodell ALLER Objekte ableiten. Dadurch muss die Importdatei
          // Eigentümer/SEV/Mieter/Bewohner NICHT mehr vorberechnen.
          if (kontNorm && veNorm) kontNorm = wendeKontaktZuweisungenAnAlle(kontNorm, veNorm);
          if (kontNorm) setKontakte(kontNorm);
          if (veNorm)   setVes(veNorm);
        },
      });
    }, (msg) => setImportFehler({ art: "daten", text: msg }));
  };

  const onSettingsReset = () => {
    if (resetBereit !== "settings") {
      setPendingImport(null); setImportFehler(null);
      setResetBereit("settings");
      return;
    }
    setResetBereit(null);
    storage.setzeZurueck("settings");
    setSettings(DEFAULT_SETTINGS);
  };
  const onDatenReset = () => {
    if (resetBereit !== "daten") {
      setPendingImport(null); setImportFehler(null);
      setResetBereit("daten");
      return;
    }
    setResetBereit(null);
    storage.setzeZurueck("daten");
    setKontakte(normalisiereKontakte(DEFAULT_KONTAKTE));
    setVes(normalisiereVes(DEFAULT_VES));
  };

  // Excel-Import: liest die AllesDa-Vorlage (.xlsx) ein und mappt sie ins
  // App-Schema. ERSETZT die aktuellen Daten — nach Inline-Bestätigung
  // (kein confirm/alert, DESIGN §25.2).
  const onExcelImport = () => {
    meldungenZuruecksetzen();
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".xlsx,.xls,.xlsm,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
    input.style.display = "none";
    input.onchange = async (e) => {
      const file = e.target.files && e.target.files[0];
      if (!file) return;
      try {
        const erg = await importiereExcel(file);
        if (erg.fehler.length > 0) {
          setImportFehler({ art: "excel", text: "Der Import konnte nicht "
            + "ausgeführt werden: " + erg.fehler.join(" · ") });
          return;
        }
        const s = erg.statistik;
        const zeilen = [
          s.objekte + " Objekte · " + s.einheiten + " Einheiten",
          s.personen + " Personen · " + s.firmen + " Firmen · "
            + s.zuordnungen + " Zuordnungen",
          "Die aktuellen Daten werden ERSETZT.",
        ];
        setPendingImport({
          art: "excel",
          titel: "Aus Datei „" + file.name + "\u201C einspielen?",
          zeilen,
          warnung: erg.warnungen.length > 0 ? erg.warnungen.join(" · ") : null,
          anwenden: () => {
            try {
              window.dispatchEvent(new CustomEvent("allesda:datei-loaded",
                { detail: { quelle: "excel-import" } }));
            } catch (err) {}
            const veNorm = normalisiereVes(erg.ves);
            let kontNorm = normalisiereKontakte(erg.kontakte);
            // Rollen zentral aus dem Besitz-/Belegungsmodell ableiten (wie beim
            // JSON-Import) — keine Vorberechnung in den Importquellen nötig.
            kontNorm = wendeKontaktZuweisungenAnAlle(kontNorm, veNorm);
            setKontakte(kontNorm);
            setVes(veNorm);
          },
        });
      } catch (err) {
        setImportFehler({ art: "excel", text: "Excel-Datei konnte nicht "
          + "eingelesen werden: " + (err.message || err) });
      } finally {
        try { document.body.removeChild(input); } catch (e2) {}
      }
    };
    document.body.appendChild(input);
    input.click();
  };

  const btnPrimary = {
    display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
    width: "100%", boxSizing: "border-box",
    background: accent, color: getContrastColor(accent), border: "none",
    borderRadius: RAD.ms, padding: "10px 14px", cursor: "pointer",
    fontFamily: "inherit", fontSize: FS.m, fontWeight: FW.medium,
  };
  const btnSecondary = {
    display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
    width: "100%", boxSizing: "border-box",
    background: accent + "4D", color: t.text, border: `1px solid ${accent}80`,
    borderRadius: RAD.ms, padding: "10px 14px", cursor: "pointer",
    fontFamily: "inherit", fontSize: FS.m, fontWeight: FW.medium,
  };
  const btnDanger = {
    display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
    width: "100%", boxSizing: "border-box",
    background: accent + "1A", color: "#EF4444",
    border: "1px solid #EF444460",
    borderRadius: RAD.ms, padding: "10px 14px", cursor: "pointer",
    fontFamily: "inherit", fontSize: FS.m, fontWeight: FW.medium,
  };
  const btnNeutral = {
    display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
    width: "100%", boxSizing: "border-box",
    background: t.card, color: t.text, border: `1px solid ${t.border}`,
    borderRadius: RAD.ms, padding: "10px 14px", cursor: "pointer",
    fontFamily: "inherit", fontSize: FS.m, fontWeight: FW.medium,
  };
  const btnGruppe = { display: "flex", flexDirection: "column", gap: 8, padding: "6px 0" };

  // Inline-Box (Bestätigung oder Fehler) für eine Import-Art — wird in der
  // jeweiligen EinstellKarte unter den Buttons gerendert (Muster wie modusPill).
  const meldungFuer = (art) => (
    <>
      {pendingImport && pendingImport.art === art && (
        <ImportMeldung variante="bestaetigen" t={t} accent={accent}
          titel={pendingImport.titel} zeilen={pendingImport.zeilen}
          warnung={pendingImport.warnung}
          onJa={() => { pendingImport.anwenden(); setPendingImport(null); }}
          onNein={() => setPendingImport(null)}/>
      )}
      {importFehler && importFehler.art === art && (
        <ImportMeldung variante="fehler" t={t} accent={accent}
          titel={importFehler.text} onNein={() => setImportFehler(null)}/>
      )}
    </>
  );
  // Zwei-Schritt-Reset-Button (DESIGN §25.2): scharf = rot ausgefüllt.
  const resetButton = (art, onClick, label, scharfLabel) => (
    <button onClick={onClick} style={resetBereit === art
      ? { ...btnNeutral, background: "#EF4444", color: "#fff",
          border: "1px solid #EF4444" }
      : btnNeutral}>
      <I name="x" size={12} color={resetBereit === art ? "#fff" : t.sub}/>
      {resetBereit === art ? scharfLabel : label}
    </button>
  );

  return (
    <>
      <EinstellKarte title="Excel-Vorlage einspielen" t={t} accent={accent}>
        <div style={{ fontSize: FS.m, color: t.sub, marginBottom: 10, lineHeight: 1.5 }}>
          Liest eine ausgefüllte <strong>AllesDa-Vorlage</strong> (.xlsx) ein und
          ersetzt die aktuellen Arbeitsdaten. Ideal zum Erstbefüllen aus deinem
          Bestand oder zum Wechsel auf eine Vorführungs-Version.
          <br/><br/>
          Die Vorlage hat fünf Tabellenblätter:
          <em> Objekte, Einheiten, Personen, Firmen, Zuordnungen</em>. Vor dem
          Anwenden zeigt die App eine Zusammenfassung.
        </div>
        <div style={btnGruppe}>
          <button onClick={onExcelImport} style={btnPrimary}>
            <I name="document" size={12} color={getContrastColor(accent)}/>Excel-Datei wählen…
          </button>
        </div>
        {meldungFuer("excel")}
      </EinstellKarte>

      <EinstellKarte title="Einstellungen sichern" t={t} accent={accent}>
        <div style={{ fontSize: FS.m, color: t.sub, marginBottom: 10, lineHeight: 1.4 }}>
          Persönliche Einstellungen (Dunkelmodus, Filter, Rollen, Sektions-Reihenfolge usw.) als JSON-Datei speichern oder aus einer Datei wiederherstellen.
        </div>
        <div style={btnGruppe}>
          <button onClick={onSettingsExport} style={btnPrimary}>
            <I name="document" size={12} color={getContrastColor(accent)}/>Einstellungen exportieren
          </button>
          <button onClick={onSettingsImport} style={btnSecondary}>
            <I name="document" size={12} color={t.text}/>Einstellungen einspielen…
          </button>
          {resetButton("settings", onSettingsReset,
            "Zurücksetzen", "Wirklich auf Werkseinstellungen zurücksetzen?")}
        </div>
        {meldungFuer("settings")}
        <div style={{ fontSize: FS.s, color: t.muted, marginTop: 6 }}>
          Aktuelle Größe im Browser: {formatKB(groesse.settings)}
        </div>
      </EinstellKarte>

      <EinstellKarte title="Arbeitsdaten sichern" t={t} accent={accent}>
        <div style={{ fontSize: FS.m, color: t.sub, marginBottom: 10, lineHeight: 1.4 }}>
          Alle Kontakte und Objekte als JSON-Datei speichern oder aus einer Datei wiederherstellen. Geeignet als Backup vor größeren Änderungen.
        </div>
        <div style={btnGruppe}>
          <button onClick={onDatenExport} style={btnPrimary}>
            <I name="document" size={12} color={getContrastColor(accent)}/>Daten exportieren
          </button>
          <button onClick={onDatenImport} style={btnSecondary}>
            <I name="document" size={12} color={t.text}/>Daten einspielen…
          </button>
          {resetButton("daten", onDatenReset,
            "Auf Demo zurücksetzen", "Wirklich auf Demo-Daten zurücksetzen?")}
        </div>
        {resetBereit === "daten" && (
          <div style={{ fontSize: FS.s, color: t.sub, marginTop: 2, lineHeight: 1.4 }}>
            Alle Kontakte und Objekte werden ersetzt — nicht rückgängig zu
            machen. Nochmal tippen zum Bestätigen.
          </div>
        )}
        {meldungFuer("daten")}
        <div style={{ fontSize: FS.s, color: t.muted, marginTop: 6 }}>
          {kontakte.length} Kontakte · {ves.length} Objekte · {formatKB(groesse.daten)} im Browser
        </div>
      </EinstellKarte>

      <OrdnerAnbindenKarte t={t} accent={accent}/>

      <EinstellKarte title="Speicherort" t={t} accent={accent}>
        {storage.istVerfuegbar() ? (
          <div style={{ display: "flex", alignItems: "center", gap: 8,
            padding: "8px 12px", background: "#10B98115",
            border: "1px solid #10B98140", borderRadius: RAD.ms,
            marginBottom: 10, fontSize: FS.m, color: t.text }}>
            <span style={{ width: 8, height: 8, borderRadius: RAD.pill,
              background: "#10B981", flexShrink: 0 }}></span>
            <span><strong>Speichern aktiv.</strong> Einstellungen und Daten bleiben beim Schließen des Browsers erhalten.</span>
          </div>
        ) : (
          <div style={{ display: "flex", alignItems: "flex-start", gap: 8,
            padding: "8px 12px", background: "#F59E0B15",
            border: "1px solid #F59E0B60", borderRadius: RAD.ms,
            marginBottom: 10, fontSize: FS.m, color: t.text, lineHeight: 1.4 }}>
            <span style={{ width: 8, height: 8, borderRadius: RAD.pill,
              background: "#F59E0B", flexShrink: 0, marginTop: 5 }}></span>
            <span>
              <strong>Speichern nicht verfügbar.</strong> Diese Umgebung (z.B. Vorschau in Claude oder privater Browsermodus) blockiert den lokalen Speicher.
              Änderungen gehen beim Reload verloren. Lade die Datei lokal herunter und öffne sie in deinem Browser — dann funktioniert das Auto-Speichern.
              Zwischendurch kannst du oben mit „Exportieren" eine Datei-Sicherung anlegen.
            </span>
          </div>
        )}
        <div style={{ fontSize: FS.m, color: t.sub, lineHeight: 1.5 }}>
          Aktuell werden alle Daten lokal im <strong style={{ color: t.text }}>Browser-Speicher</strong> dieses Geräts abgelegt.
          Beim Wechsel des Geräts oder beim Löschen des Browser-Speichers sind die Daten weg — bitte vorher exportieren.
          <br/><br/>
          <strong style={{ color: t.text }}>Geplant:</strong> automatische Synchronisation über die Cloud, damit die Einstellungen auf allen Geräten verfügbar sind und mehrere Benutzer am gleichen Datenbestand arbeiten können.
        </div>
      </EinstellKarte>
    </>
  );
}

// ── Definition aller Sektionen (Reihenfolge = Anzeigereihenfolge) ───────────
// Tagesspezifische Arbeitszeiten: je Wochentag An/Aus + Von/Bis.
// Reihenfolge folgt dem eingestellten Wochenstart. Schreibt in
// settings.kalArbeitTage (Schlüssel = JS getDay 0–6).
function KalArbeitstageTabelle({ settings, set, t, accent, pill }) {
  const gVon = settings.kalArbeitVon != null ? settings.kalArbeitVon : 8;
  const gBis = settings.kalArbeitBis != null ? settings.kalArbeitBis : 17;
  const tabelle = settings.kalArbeitTage || {};
  // Default je Tag (falls noch nicht gesetzt): Mo–Fr an, Sa/So aus.
  const tagConf = (tag) => {
    const e = tabelle[tag];
    if (e) return { an: e.an !== false, von: e.von != null ? e.von : gVon, bis: e.bis != null ? e.bis : gBis };
    const werktag = tag >= 1 && tag <= 5;
    return { an: werktag, von: gVon, bis: gBis };
  };
  const setTag = (tag, patch) => {
    const c = tagConf(tag);
    const next = { ...tabelle, [tag]: { an: c.an, von: c.von, bis: c.bis, ...patch } };
    set({ kalArbeitTage: next });
  };
  const namen = ["So", "Mo", "Di", "Mi", "Do", "Fr", "Sa"];
  const reihenfolge = settings.kalWochenstart === "so"
    ? [0, 1, 2, 3, 4, 5, 6]
    : [1, 2, 3, 4, 5, 6, 0];
  const selStyle = {
    background: t.surface, border: `1px solid ${t.border}`,
    borderRadius: RAD.sm, padding: "4px 6px", fontSize: FS.input,
    color: t.text, fontFamily: "inherit", cursor: "pointer" };
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      {reihenfolge.map(tag => {
        const c = tagConf(tag);
        return (
          <div key={tag} style={{ display: "flex", alignItems: "center", gap: 8,
            padding: "6px 8px", borderRadius: RAD.sm,
            background: c.an ? "transparent" : t.surface + "80",
            border: `1px solid ${t.border}40` }}>
            <div style={{ width: 28, flexShrink: 0, fontSize: FS.m,
              fontWeight: FW.bold, color: c.an ? t.text : t.muted }}>{namen[tag]}</div>
            <button onClick={() => setTag(tag, { an: !c.an })}
              style={{ ...pill(c.an), padding: "4px 10px", flexShrink: 0 }}>
              {c.an ? "Arbeitstag" : "frei"}
            </button>
            {c.an ? (
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginLeft: "auto" }}>
                <select value={c.von}
                  onChange={e => setTag(tag, { von: parseInt(e.target.value, 10) })}
                  style={selStyle}>
                  {Array.from({ length: 24 }, (_, h) => (
                    <option key={h} value={h}>{h}:00</option>
                  ))}
                </select>
                <span style={{ fontSize: FS.xs, color: t.sub }}>–</span>
                <select value={c.bis}
                  onChange={e => setTag(tag, { bis: parseInt(e.target.value, 10) })}
                  style={selStyle}>
                  {Array.from({ length: 24 }, (_, i) => (
                    <option key={i + 1} value={i + 1}>{i + 1}:00</option>
                  ))}
                </select>
              </div>
            ) : (
              <span style={{ marginLeft: "auto", fontSize: FS.s, color: t.muted,
                fontStyle: "italic" }}>kein Arbeitszeit-Streifen</span>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── SektionKalenderPanel — Einstellungen für den Orientierungskalender ──────
function SektionKalenderPanel({ settings, setSettings, t, accent }) {
  const wochenstart = settings.kalWochenstart || "mo";
  const kw = settings.kalKw !== false;
  const zoom = settings.kalZoom || "monat";
  const set = (patch) => setSettings(s => ({ ...s, ...patch }));
  const pill = (aktiv) => ({ padding: "6px 12px", borderRadius: RAD.ms,
    border: `1px solid ${aktiv ? accent : t.border}`,
    background: aktiv ? accent + "18" : "transparent",
    color: aktiv ? accent : t.sub, fontSize: FS.s,
    fontWeight: aktiv ? FW.semibold : FW.medium, cursor: "pointer",
    fontFamily: "inherit" });
  const zeile = { marginBottom: 14 };
  const label = { fontSize: FS.s, fontWeight: FW.semibold, color: t.text, marginBottom: 6 };
  return (
    <div>
      <div style={zeile}>
        <div style={label}>Wochenstart</div>
        <div style={{ display: "flex", gap: 6 }}>
          <button onClick={() => set({ kalWochenstart: "mo" })} style={pill(wochenstart === "mo")}>Montag</button>
          <button onClick={() => set({ kalWochenstart: "so" })} style={pill(wochenstart === "so")}>Sonntag</button>
        </div>
      </div>
      <div style={zeile}>
        <div style={label}>Kalenderwochen anzeigen</div>
        <div style={{ display: "flex", gap: 6 }}>
          <button onClick={() => set({ kalKw: true })} style={pill(kw)}>An</button>
          <button onClick={() => set({ kalKw: false })} style={pill(!kw)}>Aus</button>
        </div>
      </div>
      <div style={zeile}>
        <div style={label}>Standard-Zoomstufe</div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {KAL_ZOOM_STUFEN.slice().reverse().map(s => (
            <button key={s.id} onClick={() => set({ kalZoom: s.id })}
              style={pill(zoom === s.id)}>{s.label}</button>
          ))}
        </div>
      </div>
      <div style={zeile}>
        <div style={label}>Arbeitstag (im Zeitstrahl abgesetzt)</div>
        <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
          <button onClick={() => set({ kalArbeitTageAktiv: false })}
            style={pill(!settings.kalArbeitTageAktiv)}>Einheitlich</button>
          <button onClick={() => set({ kalArbeitTageAktiv: true })}
            style={pill(!!settings.kalArbeitTageAktiv)}>Pro Wochentag</button>
        </div>
        {!settings.kalArbeitTageAktiv ? (
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <select value={settings.kalArbeitVon != null ? settings.kalArbeitVon : 8}
              onChange={e => set({ kalArbeitVon: parseInt(e.target.value, 10) })}
              style={{ background: t.surface, border: `1px solid ${t.border}`,
                borderRadius: RAD.sm, padding: "6px 8px", fontSize: FS.input,
                color: t.text, fontFamily: "inherit", cursor: "pointer" }}>
              {Array.from({ length: 24 }, (_, h) => (
                <option key={h} value={h}>{h}:00</option>
              ))}
            </select>
            <span style={{ fontSize: FS.s, color: t.sub }}>bis</span>
            <select value={settings.kalArbeitBis != null ? settings.kalArbeitBis : 17}
              onChange={e => set({ kalArbeitBis: parseInt(e.target.value, 10) })}
              style={{ background: t.surface, border: `1px solid ${t.border}`,
                borderRadius: RAD.sm, padding: "6px 8px", fontSize: FS.input,
                color: t.text, fontFamily: "inherit", cursor: "pointer" }}>
              {Array.from({ length: 24 }, (_, i) => (
                <option key={i + 1} value={i + 1}>{i + 1}:00</option>
              ))}
            </select>
          </div>
        ) : (
          <KalArbeitstageTabelle settings={settings} set={set} t={t} accent={accent} pill={pill}/>
        )}
      </div>
      <div style={zeile}>
        <div style={label}>Datum & Uhrzeit im Heute-Button</div>
        <div style={{ display: "flex", gap: 6 }}>
          <button onClick={() => set({ kalHeuteInfo: true })}
            style={pill(settings.kalHeuteInfo !== false)}>An</button>
          <button onClick={() => set({ kalHeuteInfo: false })}
            style={pill(settings.kalHeuteInfo === false)}>Aus</button>
        </div>
      </div>
      <div style={zeile}>
        <div style={label}>Termin anlegen · Modus</div>
        <div style={{ display: "flex", gap: 6 }}>
          <button onClick={() => set({ terminAnlegeModus: "gefuehrt" })}
            style={pill((settings.terminAnlegeModus || "formular") === "gefuehrt")}>Geführt (Schritt für Schritt)</button>
          <button onClick={() => set({ terminAnlegeModus: "formular" })}
            style={pill((settings.terminAnlegeModus || "formular") === "formular")}>Formular</button>
        </div>
      </div>
      <div style={zeile}>
        <div style={label}>Uhrzeit-Auswahl · Minuten-Raster</div>
        <div style={{ display: "flex", gap: 6 }}>
          <button onClick={() => set({ zeitMinutenschritt: 15 })}
            style={pill((settings.zeitMinutenschritt || 15) === 15)}>15 Min</button>
          <button onClick={() => set({ zeitMinutenschritt: 5 })}
            style={pill(settings.zeitMinutenschritt === 5)}>5 Min</button>
        </div>
      </div>
      <div style={zeile}>
        <div style={label}>Uhrzeit-Auswahl · Stunden</div>
        <div style={{ display: "flex", gap: 6, marginBottom: settings.zeitStundenModus === "24h" ? 0 : 10 }}>
          <button onClick={() => set({ zeitStundenModus: "arbeit" })}
            style={pill((settings.zeitStundenModus || "arbeit") === "arbeit")}>An Arbeitszeit</button>
          <button onClick={() => set({ zeitStundenModus: "24h" })}
            style={pill(settings.zeitStundenModus === "24h")}>Ganztags (24h)</button>
        </div>
        {(settings.zeitStundenModus || "arbeit") === "arbeit" && (
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: FS.s, color: t.sub }}>Puffer vor/nach Arbeitszeit:</span>
            <select value={settings.zeitArbeitPuffer != null ? settings.zeitArbeitPuffer : 1}
              onChange={e => set({ zeitArbeitPuffer: parseInt(e.target.value, 10) })}
              style={{ background: t.surface, border: `1px solid ${t.border}`,
                borderRadius: RAD.sm, padding: "6px 8px", fontSize: FS.input,
                color: t.text, fontFamily: "inherit", cursor: "pointer" }}>
              {[0, 1, 2, 3].map(h => <option key={h} value={h}>{h} h</option>)}
            </select>
          </div>
        )}
      </div>
      <div style={zeile}>
        <div style={label}>Termin-Bezeichnungen</div>
        <TerminBezeichnungenEditor settings={settings} setSettings={setSettings}
          t={t} accent={accent}/>
      </div>
      <div style={{ fontSize: FS.xs, color: t.muted }}>
        Der Orientierungskalender öffnet sich über den runden Kalender-Button
        im Header (zwischen Dunkelmodus und Profil). Auf breiten Bildschirmen
        heftet er sich als feste Leiste rechts an — wie das Dashboard links;
        ein erneuter Klick oder das × im Kalender-Kopf blendet ihn wieder aus.
        Auf schmalen Geräten erscheint er kurz als Overlay.
      </div>
    </div>
  );
}

const SEKTIONEN = [
  { id: "profil",        icon: "user",     farbe: "#0E7490", title: "Mein Profil",       sub: "Name, Anrede, Kontaktdaten" },
  { id: "erscheinung",   icon: "paint",    farbe: "#EAB308", title: "Erscheinungsbild",  sub: "Dunkelmodus, Header, Farben, Kontrast" },
  { id: "objekte",       icon: "building", farbe: "#06B6D4", title: "Objekte",           sub: "Anzeige, Filter-Pillen, Gruppen" },
  { id: "kontakte",      icon: "users",    farbe: "#A855F7", title: "Kontakte",          sub: "Anzeige, Filter-Pillen, Gruppen" },
  { id: "statusleiste",  icon: "bell",     farbe: "#F97316", title: "Statusleiste",      sub: "Objekt- & Kontakt-Hinweise, Jahrestage" },
  { id: "filter",        icon: "search",   farbe: "#F59E0B", title: "Filter-Optionen",   sub: "Großer Filter im Header" },
  { id: "kalender",      icon: "calendar", farbe: "#F59E0B", title: "Kalender",          sub: "Wochenstart, KW, Termin-Bezeichnungen" },
  { id: "dashboard",     icon: "building", farbe: "#0080FF", title: "Dashboard",         sub: "Kacheln, Reihenfolge, Farben" },
  { id: "suche",         icon: "search",   farbe: "#EC4899", title: "Suche",             sub: "Welche Bereiche durchsucht werden" },
  { id: "tastatur",      icon: "settings", farbe: "#10B981", title: "Tastatur",          sub: "Kürzel anpassen und drucken" },
  { id: "hv",            icon: "building", farbe: "#64748B", title: "Hausverwaltung",    sub: "Name und Stammdaten" },
  { id: "daten",         icon: "document", farbe: "#0EA5C9", title: "Daten",             sub: "Import, Export, Backup" },
];


// ╔═════════════════════════════════════════════════════════════════════════╗
// ║ SEKTION 9 · APP  (Default Export)                                       ║
// ║ Top-Level-Zustand · Routing · Header-Leiste · Screen-Dispatch           ║
// ║ Screens: home · objekte · liegenschaft · kontakte · einstellungen       ║
// ║ Platzhalter (siehe Roadmap Phase 4): etv · technik · dokumente          ║
// ╚═════════════════════════════════════════════════════════════════════════╝

// ── Hauptkomponente ─────────────────────────────────────────────────────────
// ── SektionKachel (Karte für eine Einstellungs-Sektion, klappt auf) ─────────
function SektionKachel({ sektion, aktiv, t, onClick, id }) {
  // Auswahl-Rahmen nutzt die volle Sektionsfarbe (farbeVoll), bleibt also auch
  // im "Weniger Farbe"-Modus farbig. Icon/Titel/Tint folgen weiter sektion.farbe.
  const bc = aktiv ? (sektion.farbeVoll || sektion.farbe) : t.border;
  const klickbar = !!onClick;
  return (
    <div onClick={klickbar ? onClick : undefined} id={id}
      data-kb-item={klickbar ? "1" : undefined} style={{
      cursor: klickbar ? "pointer" : "default", transition: "all 0.15s",
      // 1px Border — gleich wie Sidebar-Kacheln, damit das Layout konsistent
      // wirkt. Aktiv = volle Sektion-Farbe, inaktiv = dezenter t.border.
      border: `1px solid ${bc}`,
      borderRadius: RAD.lg,
      minWidth: 0,
      // background auf dem äußeren Container (NICHT auf dem inneren div),
      // damit kein innerer Hintergrund den Border bei border-radius verdeckt.
      background: t.card,
      boxSizing: "border-box",
      scrollMarginTop: "var(--ad-header-h, 200px)" }}
      onMouseEnter={e => { if (klickbar && !aktiv) e.currentTarget.style.transform = "translateY(-1px)"; }}
      onMouseLeave={e => { if (klickbar && !aktiv) e.currentTarget.style.transform = "none"; }}>
      <div style={{
        display: "flex", alignItems: "center", gap: 12,
        padding: "10px 12px", boxSizing: "border-box",
        color: t.text,
      }}>
        <div style={{ width: 48, flexShrink: 0, display: "flex",
          alignItems: "center", justifyContent: "center" }}>
          <div style={{ width: 38, height: 38, borderRadius: RAD.md, flexShrink: 0,
            background: sektion.farbe + "20", display: "flex",
            alignItems: "center", justifyContent: "center" }}>
            <I name={sektion.icon} size={18} color={sektion.farbe}/>
          </div>
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: FS.l, fontWeight: FW.heavy, color: sektion.farbe,
            overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{sektion.title}</div>
          <div style={{ fontSize: FS.s, color: t.sub, marginTop: 2,
            overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{sektion.sub}</div>
        </div>
      </div>
    </div>
  );
}

function EinstellungenZentrale({ settings, setSettings, kontakte, setKontakte,
  ves = [], setVes, t, accent, mode, setMode, cardWidth = 340, detailMinBreite = 300, detailMaxAnteil = 0.6 }) {
  const [aktSektion, setAktSektion] = useState(null);
  // Sektions-Kacheln folgen dem globalen Liste/Karten-Schalter (Erscheinungsbild).
  const istListe = (settings.listenAnsicht || "karten") === "liste";
  const systemAccent = useKontaktFarbe().system || accent;
  const [mdRef, mdLayout] = useMasterDetailLayout(cardWidth, 1.1, 10, 5, true, detailMinBreite, detailMaxAnteil);
  // Sektions-Kacheln neben dem Detail folgen dem Slider „Karten neben dem
  // Detail" (settings.kartenSpalten) — identisch zu Objekte/Kontakte.
  const setKartenSpalten = settings.kartenSpalten != null ? settings.kartenSpalten : 2;
  const setMasterW = mdLayout.masterWidth || cardWidth;
  const setKartenCols = Math.max(1, Math.min(setKartenSpalten, Math.floor(setMasterW / 300)));

  // Sprung in eine Sektion von außen (z. B. Tastaturkürzel „?" → Tastatur).
  useEffect(() => {
    const handler = (e) => {
      const id = e && e.detail && e.detail.id;
      if (id && SEKTIONEN.some(s => s.id === id)) setAktSektion(id);
    };
    window.addEventListener("allesda:zentrale-sektion", handler);
    return () => window.removeEventListener("allesda:zentrale-sektion", handler);
  }, []);

  // Auto-Scroll zur aufgeklappten Karte (nicht zum Detail-Block) — Karte bleibt oben
  useEffect(() => {
    if (aktSektion) {
      scrollToCard("set-" + aktSektion);
    }
  }, [aktSektion]);

  // Reihenfolge ist fest und kommt aus SEKTIONEN (Edit-Modus für die
  // Reihenfolge wurde in v4.16 abgeschafft). settings.sektionenReihenfolge
  // ist eine Altlast und wird ignoriert — damit alte gespeicherte
  // Reihenfolgen aus LocalStorage nicht die neue Default-Reihenfolge
  // überschreiben.
  //
  // Farb-Verknüpfung: Profil + Kontakte teilen sich die Kontakte-Akzentfarbe
  // (Profil ist nur ein Spezialfall eines Personen-Kontakts). Objekte nimmt
  // die Objekte-Akzentfarbe. Beide kommen aus den Kachel-Settings, sodass der
  // FarbPicker für die Kacheln auch die Einstellungs-Sektionen umfärbt.
  const objektAccent  = ((settings.kacheln || []).find(k => k.id === "objekte")  || {}).farbe || "#06B6D4";
  const kontaktAccent = ((settings.kacheln || []).find(k => k.id === "kontakte") || {}).farbe || "#A855F7";
  // farbeVoll = die echte (nicht grau-gemappte) Sektionsfarbe. Wird für die
  // Auswahl-Hervorhebung (aktiver Kachel-Rahmen + Detail-Rahmen) genutzt, damit
  // die ausgewählte Sektion auch im "Weniger Farbe"-Modus farbig umrandet ist.
  // Der restliche Inhalt (Icon, Titel, Tint) nutzt weiter farbe (ggf. grau).
  let sortierteSektionen = SEKTIONEN.map(s => {
    if (s.id === "profil")   return { ...s, farbe: kontaktAccent, farbeVoll: kontaktAccent };
    if (s.id === "kontakte") return { ...s, farbe: kontaktAccent, farbeVoll: kontaktAccent };
    if (s.id === "objekte")  return { ...s, farbe: objektAccent,  farbeVoll: objektAccent };
    if (s.id === "daten")    return { ...s, farbe: systemAccent,  farbeVoll: systemAccent };
    return { ...s, farbeVoll: s.farbe };
  });

  // Weniger-Farbe-Modus: Sektion-Akzentfarben Richtung Grau mappen (Stufe steuert
  // toGrau global). farbeVoll bleibt erhalten (echte Farbe) und wird nur für den
  // Auswahl-Rahmen verwendet — Icon-Hintergrund/Titel/Tint folgen weiter farbe.
  const setFarbInt = settings.farbIntensitaet != null ? settings.farbIntensitaet : 100;
  setFarbIntensitaet(Math.max(0, Math.min(1, setFarbInt / 100)));
  if (setFarbInt < 100) {
    sortierteSektionen = sortierteSektionen.map(s => ({ ...s, farbe: toGrau(s.farbe) }));
  }

  // Render-Helper für die Sektions-Inhalts-Detail
  const renderSektionDetail = (s) => {
    const rahmen = s.farbeVoll || s.farbe;
    return (
      <div style={{ background: rahmen + "08",
        border: `1px solid ${rahmen}`,
        borderRadius: RAD.lg, padding: "14px 16px",
        minWidth: 0, boxSizing: "border-box", overflowWrap: "anywhere" }}>
        <div style={{ display: "flex", alignItems: "center",
          justifyContent: "space-between", gap: 10, marginBottom: 12,
          minHeight: 22 /* Konstante Höhe, egal ob Action-Button da ist */ }}>
          <div style={{ fontSize: FS.s, fontWeight: FW.bold, color: s.farbe,
            textTransform: "uppercase", letterSpacing: "0.08em" }}>{s.title}</div>
          {s.id === "profil" && settings.userKontaktId && (
            <button onClick={() => setSettings(st => ({ ...st, userKontaktId: null }))}
              title="Profil-Verknüpfung lösen (Kontakt bleibt im Adressbuch erhalten)"
              style={{ display: "inline-flex", alignItems: "center", gap: 5, flexShrink: 0,
                fontSize: FS.xs, fontWeight: FW.medium, fontFamily: "inherit",
                padding: "4px 9px", borderRadius: RAD.sm, cursor: "pointer",
                background: s.farbe + "15", color: s.farbe, border: `1px solid ${s.farbe}40` }}>
              <I name="x" size={10} color={s.farbe}/>
              Verknüpfung lösen
            </button>
          )}
        </div>
        {s.id === "profil"      && <SektionProfil kontakte={kontakte} setKontakte={setKontakte} ves={ves} settings={settings} setSettings={setSettings} t={t} accent={s.farbe}/>}
        {s.id === "erscheinung" && <SektionErscheinungsbild settings={settings} rawSettings={settings} setSettings={setSettings} t={t} accent={s.farbe} mode={mode} setMode={setMode}/>}
        {s.id === "objekte"     && <SektionObjekte settings={settings} setSettings={setSettings} t={t} accent={s.farbe} ves={ves}/>}
        {s.id === "kontakte"    && <SektionKontakte settings={settings} setSettings={setSettings} t={t} accent={s.farbe} kontakte={kontakte}/>}
        {s.id === "statusleiste" && <SektionStatusleiste settings={settings} setSettings={setSettings} t={t} accent={s.farbe}/>}
        {s.id === "filter"      && <SektionFilterOpt settings={settings} setSettings={setSettings} t={t} accent={s.farbe} ves={ves} kontakte={kontakte}/>}
        {s.id === "kalender"    && <SektionKalenderPanel settings={settings} setSettings={setSettings} t={t} accent={s.farbe}/>}
        {s.id === "dashboard"   && <SektionDashboard settings={settings} setSettings={setSettings} t={t} accent={s.farbe}/>}
        {s.id === "suche"       && <SektionSuche settings={settings} setSettings={setSettings} t={t} accent={s.farbe}/>}
        {s.id === "tastatur"    && <SektionTastatur settings={settings} setSettings={setSettings} t={t} accent={s.farbe}/>}
        {s.id === "hv"          && <SektionHV settings={settings} setSettings={setSettings} t={t} accent={s.farbe}/>}
        {s.id === "daten"       && <SektionDaten t={t} accent={systemAccent}
          settings={settings} setSettings={setSettings} mode={mode} setMode={setMode}
          kontakte={kontakte} setKontakte={setKontakte} ves={ves} setVes={setVes}/>}
      </div>
    );
  };

  const windowW = useWindowWidth();
  const istDesktop = windowW >= 900;

  // Im echten Master-Detail (Desktop mit ≥1 Master-Spalte) ist immer eine
  // Sektion offen — die Liste bleibt links sichtbar, ein „Zurück" wäre sinnlos.
  // Sobald aber keine Master-Spalte mehr danebenpasst (masterCols 0), verhält
  // sich der Bereich wie Mobile: aktSektion === null ⇒ Sektionsliste, und der
  // „Zurück zur Liste"-Button greift wieder.
  // BEWUSST keine Vorauswahl: Die Einstellungen starten immer in der
  // Übersicht (Sektions-Grid) — auch im Desktop-Master-Detail. Erst ein
  // Klick auf eine Kachel öffnet die Sektion.
  const offenSektion = aktSektion
    ? sortierteSektionen.find(x => x.id === aktSektion)
    : null;

  return (
    <div style={istDesktop
      ? { flex: 1, minHeight: 0, minWidth: 0, display: "flex", flexDirection: "column" }
      : { display: "flex", flexDirection: "column" }}>
      {/* Section-Header — auf Mobile mit Zurück-Button rechts vom Titel
          (wenn eine Sektion offen ist). Auf Desktop bleibt nur der Titel. */}
      <StickySectionHeader t={t} accent={accent}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ fontSize: FS.xxl, fontWeight: FW.heavy, color: t.text,
            userSelect: "none" }}>
            Einstellungen
          </div>
          {offenSektion && !istDesktop && (
            <ZurueckButton onClick={() => setAktSektion(null)} variante="header"
              t={t} kbZurueck={true}/>
          )}
        </div>
      </StickySectionHeader>

      {/* Master-Detail (Desktop) — nutzt dasselbe Layout wie Objekte/Kontakte:
          Sektions-Kacheln als Master-Spalten in Kartenbreite, Detail rechts mit
          dem Detailbreite-Faktor. Bei sehr schmalem Fenster (masterCols 0) wird
          das Detail full-width mit Zurück-Button. */}
      {offenSektion && istDesktop && mdLayout.masterCols === 0 && (
        <div ref={mdRef} style={{ flex: 1, minHeight: 0, minWidth: 0, display: "flex", flexDirection: "column" }}>
          <ZurueckButton onClick={() => setAktSektion(null)} variante="body"
            t={t} kbZurueck={true}/>
          <div data-ad-scroll="y" style={{ flex: 1, minHeight: 0, minWidth: 0, overflowY: "auto" }}>
            {renderSektionDetail(offenSektion)}
          </div>
        </div>
      )}
      {offenSektion && istDesktop && mdLayout.masterCols > 0 && (
        <div ref={mdRef} style={{ display: "flex", gap: 10,
          flex: 1, minHeight: 0, minWidth: 0, alignItems: "stretch" }}>
          <div data-ad-auslauf="1" style={{ flex: `0 1 ${mdLayout.masterWidth}px`, minWidth: 0, overflowY: "auto",
            padding: 2, boxSizing: "border-box",
            display: "grid", alignContent: "start",
            gridTemplateColumns: istListe ? "1fr" : `repeat(${setKartenCols}, minmax(0, 1fr))`, gap: 8 }}>
            {sortierteSektionen.map((s, i) => (
              <SektionKachel key={s.id} sektion={s}
                aktiv={offenSektion && offenSektion.id === s.id} t={t} id={"set-" + s.id}
                onClick={() => setAktSektion(s.id)}/>
            ))}
          </div>
          <div data-ad-auslauf="1" style={{ flex: `0 0 ${mdLayout.detailBreite}px`, minWidth: 0, maxWidth: "100%", overflowY: "auto" }}>
            {renderSektionDetail(offenSektion)}
          </div>
        </div>
      )}

      {/* Vollbild-Detail (Mobile) — Zurück-Button sitzt in der Header-Zeile,
          deshalb hier nur noch der Inhalt. */}
      {offenSektion && !istDesktop && (
        <div data-ad-scroll="y" style={{ flex: 1, minHeight: 0, overflowY: "auto",
          paddingBottom: "max(env(safe-area-inset-bottom, 0px), 80px)" }}>
          {renderSektionDetail(offenSektion)}
        </div>
      )}

      {/* Sektions-Grid (Übersicht) — Startansicht in ALLEN Layouts, solange
          keine Sektion offen ist. Der mdRef misst hier die Breite, damit
          masterCols korrekt bestimmt wird. */}
      {!offenSektion && (
        <div ref={mdRef} data-ad-scroll="y" style={{ flex: 1, minHeight: 0, minWidth: 0, overflowY: "auto",
          paddingBottom: "max(env(safe-area-inset-bottom, 0px), 80px)" }}>
          <div style={{
            display: "grid",
            gridTemplateColumns: istListe ? "1fr" : "repeat(auto-fill, minmax(280px, 1fr))",
            gap: 10 }}>
            {sortierteSektionen.map((s, i) => (
              <SektionKachel key={s.id} sektion={s} aktiv={false} t={t}
                id={"set-" + s.id}
                onClick={() => setAktSektion(s.id)}/>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── NeuerKontaktModal (Anlege-Dialog mit Typ-Auswahl Person/Firma) ─────────
function NeuerKontaktModal({ t, accent, onClose, onSave, ves = [], kontakte = [] }) {
  const farben = useKontaktFarbe();
  const istDesktop = useWindowWidth() >= DESKTOP_MIN_WIDTH;
  const [typ, setTyp] = useState("person");
  // Personen-Felder
  const [anrede, setAnrede] = useState("");
  const [titel, setTitel] = useState("");
  const [vorname, setVorname] = useState("");
  const [nachname, setNachname] = useState("");
  // Firmen-Felder
  const [firmenname, setFirmenname] = useState("");
  const [rechtsform, setRechtsform] = useState("");
  // Optionale Ansprechperson (nur bei Firma) — wird als eigener Personen-
  // Kontakt angelegt und automatisch als Anstellung mit der Firma verknüpft.
  const [apVorname, setApVorname] = useState("");
  const [apNachname, setApNachname] = useState("");
  const [apTel, setApTel] = useState("");
  const [apEmail, setApEmail] = useState("");
  // Gemeinsam
  const [tel, setTel] = useState("");
  const [email, setEmail] = useState("");
  const [strasse, setStrasse] = useState("");
  const [plz, setPlz] = useState("");
  const [ort, setOrt] = useState("");
  // Rollen-Zuweisungen (nur für Personen)
  const [zuweisungen, setZuweisungen] = useState([]);
  const [neueRolleForm, setNeueRolleForm] = useState(false);

  const istPerson = typ === "person";
  const farbe = istPerson ? accent : farben.firma;
  const validPerson = vorname.trim().length > 0 && nachname.trim().length > 0;
  const validFirma = firmenname.trim().length > 0;
  const valid = istPerson ? validPerson : validFirma;

  const speichern = () => {
    if (!valid) return;
    let neu;
    if (istPerson) {
      neu = { typ: "person", anrede, titel, vorname, nachname, tel, email, strasse, plz, ort,
        objektZuweisungen: zuweisungen };
    } else {
      neu = { typ: "firma", name: firmenname, rechtsform, tel, email, strasse, plz, ort,
        objektZuweisungen: zuweisungen };
      // Optionale Ansprechperson mitgeben, wenn mindestens ein Name ausgefüllt ist.
      if (apVorname.trim() || apNachname.trim()) {
        neu.ansprechperson = {
          vorname: apVorname.trim(), nachname: apNachname.trim(),
          tel: apTel.trim(), email: apEmail.trim(),
        };
      }
    }
    onSave && onSave(neu);
    onClose();
  };

  return (
    <div style={{ position: "fixed", top: 0, right: 0, bottom: 0, left: 0, background: "rgba(0,0,0,0.7)",
      zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div style={{ background: t.card, border: `1px solid ${t.border}`,
        borderRadius: RAD.xl, width: "100%", maxWidth: 480,
        maxHeight: "90dvh", overflowY: "auto",
        boxShadow: "0 20px 60px rgba(0,0,0,0.5)" }}>
        {/* Header */}
        <div style={{ padding: "12px 16px", borderBottom: `1px solid ${t.border}`,
          display: "flex", alignItems: "center", justifyContent: "space-between",
          position: "sticky", top: 0, background: t.card, zIndex: 10 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <I name="plus" size={14} color={farbe}/>
            <span style={{ fontSize: FS.xl, fontWeight: FW.bold, color: t.text }}>Neuer Kontakt</span>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer" }}>
            <I name="x" size={16} color={t.sub}/>
          </button>
        </div>

        <div style={{ padding: 16 }}>
          {/* Typ-Switch */}
          <div style={{ fontSize: FS.s, fontWeight: FW.bold, color: t.sub,
            textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8 }}>
            Was möchtest du anlegen?
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr",
            gap: 8, marginBottom: 18 }}>
            <button onClick={() => setTyp("person")} style={{
              display: "flex", flexDirection: "column", alignItems: "center", gap: 6,
              padding: "14px 10px", minWidth: 0, boxSizing: "border-box",
              background: istPerson ? accent + "18" : t.surface,
              border: `2px solid ${istPerson ? accent : t.border}`,
              borderRadius: RAD.lg, cursor: "pointer", fontFamily: "inherit",
              transition: "all 0.15s" }}>
              <div style={{ width: 38, height: 38, borderRadius: RAD.full,
                background: accent + "22", display: "flex",
                alignItems: "center", justifyContent: "center" }}>
                <I name="user" size={18} color={accent}/>
              </div>
              <span style={{ fontSize: FS.l, fontWeight: FW.bold,
                color: istPerson ? accent : t.text }}>Person</span>
              <span style={{ fontSize: FS.xs, color: t.sub, textAlign: "center", lineHeight: 1.3 }}>
                Eigentümer, Mieter, Beirat …
              </span>
            </button>
            <button onClick={() => setTyp("firma")} style={{
              display: "flex", flexDirection: "column", alignItems: "center", gap: 6,
              padding: "14px 10px", minWidth: 0, boxSizing: "border-box",
              background: !istPerson ? farben.firma + "18" : t.surface,
              border: `2px solid ${!istPerson ? farben.firma : t.border}`,
              borderRadius: RAD.lg, cursor: "pointer", fontFamily: "inherit",
              transition: "all 0.15s" }}>
              <div style={{ width: 38, height: 38, borderRadius: RAD.md,
                background: farben.firma + "22", display: "flex",
                alignItems: "center", justifyContent: "center" }}>
                <I name="building" size={18} color={farben.firma}/>
              </div>
              <span style={{ fontSize: FS.l, fontWeight: FW.bold,
                color: !istPerson ? farben.firma : t.text }}>Firma</span>
              <span style={{ fontSize: FS.xs, color: t.sub, textAlign: "center", lineHeight: 1.3 }}>
                Hausverwaltung, Handwerker …
              </span>
            </button>
          </div>

          {/* Felder Person */}
          {istPerson && (
            <>
              <div style={istDesktop
                ? { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }
                : { display: "flex", flexDirection: "column", gap: 10 }}>
                <Inp label="Anrede" value={anrede} onChange={setAnrede}
                  placeholder="Herr, Frau, Familie …" t={t} accent={farbe}/>
                <Inp label="Titel" value={titel} onChange={setTitel}
                  placeholder="Dr., Prof., Dipl.-Ing. …" t={t} accent={farbe}/>
              </div>
              <div style={istDesktop
                ? { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }
                : { display: "flex", flexDirection: "column", gap: 10 }}>
                <Inp label="Vorname" value={vorname} onChange={setVorname}
                  placeholder="Max" t={t} accent={farbe} required/>
                <Inp label="Nachname" value={nachname} onChange={setNachname}
                  placeholder="Mustermann" t={t} accent={farbe} required/>
              </div>
            </>
          )}

          {/* Felder Firma */}
          {!istPerson && (
            <>
              <Inp label="Firmenname" value={firmenname} onChange={setFirmenname}
                placeholder="Maier GmbH" t={t} accent={farbe} required/>
              <Inp label="Rechtsform" value={rechtsform} onChange={setRechtsform}
                placeholder="GmbH, OHG, e.K. …" t={t} accent={farbe}/>
            </>
          )}

          {/* Gemeinsame Felder */}
          <div style={{ marginTop: 8, paddingTop: 8,
            borderTop: `1px solid ${t.border}30` }}>
            <div style={{ fontSize: FS.s, fontWeight: FW.bold, color: t.sub,
              textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8 }}>
              Kontaktdaten (optional)
            </div>
            <div style={istDesktop
              ? { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }
              : { display: "flex", flexDirection: "column", gap: 10 }}>
              <Inp label="Telefon" value={tel} onChange={setTel}
                placeholder="0171 …" t={t} accent={farbe}/>
              <Inp label="E-Mail" value={email} onChange={setEmail}
                placeholder="name@…" t={t} accent={farbe}/>
            </div>
            <Inp label="Straße" value={strasse} onChange={setStrasse}
              placeholder="Hauptstraße 1" t={t} accent={farbe}/>
            <div style={{ display: "grid", gridTemplateColumns: "100px 1fr", gap: 10 }}>
              <Inp label="PLZ" value={plz} onChange={setPlz}
                placeholder="80331" t={t} accent={farbe}/>
              <Inp label="Ort" value={ort} onChange={setOrt}
                placeholder="München" t={t} accent={farbe}/>
            </div>
          </div>

          {/* Optionale Ansprechperson (nur bei Firma) */}
          {!istPerson && (
            <div style={{ marginTop: 10, paddingTop: 10,
              borderTop: `1px solid ${t.border}30` }}>
              <div style={{ fontSize: FS.s, fontWeight: FW.bold, color: t.sub,
                textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 4 }}>
                Ansprechperson (optional)
              </div>
              <div style={{ fontSize: FS.xs, color: t.muted, marginBottom: 8 }}>
                Wird als eigener Kontakt angelegt und mit der Firma verknüpft.
              </div>
              <div style={istDesktop
                ? { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }
                : { display: "flex", flexDirection: "column", gap: 10 }}>
                <Inp label="Vorname" value={apVorname} onChange={setApVorname}
                  placeholder="Max" t={t} accent={farbe}/>
                <Inp label="Nachname" value={apNachname} onChange={setApNachname}
                  placeholder="Mustermann" t={t} accent={farbe}/>
                <Inp label="Telefon" value={apTel} onChange={setApTel}
                  placeholder="0171 …" t={t} accent={farbe}/>
                <Inp label="E-Mail" value={apEmail} onChange={setApEmail}
                  placeholder="name@…" t={t} accent={farbe}/>
              </div>
            </div>
          )}

          {/* Rollen / Dienstleister-Rollen (Personen UND Firmen) */}
          <div style={{ marginTop: 10, paddingTop: 10,
            borderTop: `1px solid ${t.border}30` }}>
            <div style={{ display: "flex", alignItems: "center",
              justifyContent: "space-between", marginBottom: 6 }}>
              <div style={{ fontSize: FS.s, fontWeight: FW.bold, color: t.sub,
                textTransform: "uppercase", letterSpacing: "0.08em" }}>
                {istPerson ? "Rollen" : "Dienstleister-Rollen"}{zuweisungen.length > 0 ? ` (${zuweisungen.length})` : ""}
              </div>
              {!neueRolleForm && (
                <button onClick={() => setNeueRolleForm(true)} style={{
                  fontSize: FS.s, padding: "3px 10px", background: farbe + "20",
                  color: farbe, border: "none", borderRadius: RAD.sm,
                  cursor: "pointer", fontFamily: "inherit", fontWeight: FW.medium, whiteSpace: "nowrap" }}>
                  + Rolle
                </button>
              )}
            </div>
            {neueRolleForm && (
              <div style={{ marginBottom: 8 }}>
                <BeziehungEditor initial={{}} ves={ves} kontakte={kontakte} t={t} accent={farbe}
                  typ={istPerson ? "person" : "firma"}
                  onCancel={() => setNeueRolleForm(false)}
                  onSave={(zuw) => { setZuweisungen([...zuweisungen, zuw]); setNeueRolleForm(false); }}/>
              </div>
            )}
            {zuweisungen.length === 0 && !neueRolleForm && (
              <div style={{ fontSize: FS.s, color: t.muted, fontStyle: "italic", padding: "4px 0" }}>
                Optional – kann auch später ergänzt werden.
              </div>
            )}
            {zuweisungen.map((z, i) => (
              <RolleZeile key={i} z={z} ves={ves} kontakte={kontakte} editMode={true}
                onEdit={() => {}}
                onDelete={() => setZuweisungen(zuweisungen.filter((_, idx) => idx !== i))}
                t={t} accent={farbe} typ={istPerson ? "person" : "firma"}/>
            ))}
          </div>

          {/* Aktionen — gemeinsamer AktionsButton-Baustein (variante "breit") */}
          <div style={{ display: "flex", gap: 8, marginTop: 18 }}>
            <AktionsButton variante="breit" rolle="abbrechen" onClick={onClose}
              text="Abbrechen" icon={false} flex={1} t={t} accent={farbe}/>
            <AktionsButton variante="breit" rolle="bestaetigen" onClick={speichern}
              disabled={!valid} text={istPerson ? "Person anlegen" : "Firma anlegen"}
              icon={false} flex={2} t={t} accent={farbe}/>
          </div>
        </div>
      </div>
    </div>
  );
}

// Sektionen des globalen Header-Filters (Mehrfachauswahl). Der Filter ist auf
// allen Screens gleich — die Kontakt-Arten-Filterung im Header ist entfallen
// (Feinfilterung läuft über die Pillen am jeweiligen Screen).
function computeHeaderFilterSektionen(settings, kontakte, ves = []) {
  const sektionen = [];

  // 1) Verwalter/Buchhalter — dynamisch aus den Objekten gelesen.
  {
    const filterTyp = settings.filterTyp || "verwalter";
    const feld = filterTyp === "buchhalter" ? "buchhalter" : "verwalter";
    // WICHTIG: Original-ID-Typ erhalten (Object.keys würde Zahlen zu Strings
    // machen → strict-equal-Lookup und vAusw.indexOf(wer) schlagen fehl).
    const gefunden = [];
    ves.forEach(ve => {
      const id = ve.verwaltung && ve.verwaltung[feld];
      if (id == null || id === "") return;
      const e = gefunden.find(x => x.id === id);
      if (e) e.count += 1; else gefunden.push({ id, count: 1 });
    });
    const optionen = [];
    gefunden.forEach(({ id, count }) => {
      if (!filterEintragConf(settings, "verwalter", id).anzeigen) return;
      const k = kontakte.find(x => x.id === id);
      if (!k) return;
      const name = k.typ === "firma"
        ? k.name
        : [k.nachname, k.vorname].filter(Boolean).join(", ") || k.name || String(id);
      optionen.push({ id, label: name, count });
    });
    optionen.sort((a, b) => a.label.localeCompare(b.label, "de"));
    if (optionen.length > 0) {
      sektionen.push({ feld: "verwalter",
        titel: filterTyp === "buchhalter" ? "Buchhalter" : "Verwalter", optionen });
    }
  }

  // 2) Verwaltungsarten.
  {
    const counts = {};
    VERWALTUNGSARTEN.forEach(a => { counts[a.id] = 0; });
    ves.forEach(v => {
      const a = v.verwaltungsart || "weg";
      if (counts[a] !== undefined) counts[a] += 1;
    });
    const optionen = VERWALTUNGSARTEN
      .filter(a => counts[a.id] > 0 && filterEintragConf(settings, "arten", a.id).anzeigen)
      .map(a => ({ id: a.id, label: a.label, count: counts[a.id] }));
    if (optionen.length > 0) {
      sektionen.push({ feld: "arten", titel: "Verwaltungsart", optionen });
    }
  }

  // 3) Objekt-Gruppen (aus den Objekt-Einstellungen). Sichtbarkeit im
  // Header-Filter ist hier eigenständig (filterEintraege) — das sichtbar-Flag
  // der Gruppe steuert nur die Pillen am Objekte-Screen.
  {
    const gruppen = (settings.objektGruppen || [])
      .filter(g => g && filterEintragConf(settings, "gruppen", g.id).anzeigen);
    const optionen = gruppen.map(g => ({
      id: g.id, label: g.name || g.kurz || "Gruppe",
      count: ves.filter(v => objektInGruppe(v, g)).length }));
    if (optionen.length > 0) {
      sektionen.push({ feld: "gruppen", titel: "Objekt-Gruppen", optionen });
    }
  }

  return sektionen;
}

// ── NeuesObjektModal (Anlege-Dialog für ein neues Objekt/WEG) ───────────────
function NeuesObjektModal({ t, accent, onClose, onSave, vorhandeneVes = [] }) {
  // Nächste freie WEG-Nummer ermitteln (höchste laufende Nr +1)
  const naechsteNr = (() => {
    const jahr = new Date().getFullYear();
    const hochs = vorhandeneVes
      .map(v => {
        const m = (v.nr || "").match(/^WEG-\d{4}-(\d{3,})$/);
        return m ? parseInt(m[1], 10) : 0;
      })
      .reduce((a, b) => Math.max(a, b), 0);
    return `WEG-${jahr}-${String(hochs + 1).padStart(3, "0")}`;
  })();

  const [nr, setNr] = useState(naechsteNr);
  const [strasse, setStrasse] = useState("");
  const [plz, setPlz] = useState("");
  const [ort, setOrt] = useState("");
  const [verwaltungsart, setVerwaltungsart] = useState("weg");

  const valid = nr.trim().length > 0 && strasse.trim().length > 0;

  const speichern = () => {
    if (!valid) return;
    const plzOrt = joinPlzOrt(plz, ort);
    const adresse = plzOrt
      ? `${strasse.trim()}, ${plzOrt}`
      : strasse.trim();
    const neueVE = {
      id: "ve-" + Date.now(),
      nr: nr.trim(),
      adresse,
      verwaltungsart,
      einheiten: [],
      verwaltung: {
        beginn: "", bestelltBis: "",
        verwalter: null, buchhalter: null, uebernommenVon: null,
        verwZustimmung: false,
        naechsteETV: "", naechsteWahl: "",
      },
      vertraege: [],
      etvHistorie: [],
    };
    onSave && onSave(neueVE);
    onClose();
  };

  const arten = [
    { id: "weg",     label: "WEG",     beschr: "Wohnungseigentümergemeinschaft" },
    { id: "miet",    label: "Miet",    beschr: "Mietverwaltung" },
    { id: "gewerbe", label: "Gewerbe", beschr: "Gewerbeobjekt" },
    { id: "sev",     label: "SEV",     beschr: "Sondereigentumsverwaltung" },
  ];

  const labelStyle = { fontSize: FS.s, fontWeight: FW.bold, color: t.sub,
    textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6 };
  const inputStyle = { width: "100%", padding: "8px 10px",
    background: t.surface, color: t.text, border: `1px solid ${t.border}`,
    borderRadius: RAD.ms, fontSize: FS.l, fontFamily: "inherit", boxSizing: "border-box" };

  return (
    <div style={{ position: "fixed", top: 0, right: 0, bottom: 0, left: 0, background: "rgba(0,0,0,0.7)",
      zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div style={{ background: t.card, border: `1px solid ${t.border}`,
        borderRadius: RAD.xl, width: "100%", maxWidth: 480,
        maxHeight: "90dvh", overflowY: "auto",
        boxShadow: "0 20px 60px rgba(0,0,0,0.5)" }}>
        {/* Header */}
        <div style={{ padding: "12px 16px", borderBottom: `1px solid ${t.border}`,
          display: "flex", alignItems: "center", justifyContent: "space-between",
          position: "sticky", top: 0, background: t.card, zIndex: 10 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <I name="plus" size={14} color={accent}/>
            <span style={{ fontSize: FS.xl, fontWeight: FW.bold, color: t.text }}>Neues Objekt</span>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer" }}
            title="Schließen" aria-label="Schließen">
            <I name="x" size={16} color={t.sub}/>
          </button>
        </div>

        <div style={{ padding: 16 }}>
          {/* WEG-Nr */}
          <div style={{ marginBottom: 14 }}>
            <div style={labelStyle}>WEG-Nummer</div>
            <input value={nr} onChange={e => setNr(e.target.value)}
              placeholder="WEG-2026-001" style={inputStyle}/>
          </div>

          {/* Adresse */}
          <div style={{ marginBottom: 14 }}>
            <div style={labelStyle}>Straße + Hausnummer</div>
            <input value={strasse} onChange={e => setStrasse(e.target.value)}
              placeholder="z. B. Sebastian-Bach-Straße 189" style={inputStyle}/>
          </div>
          <div style={{ marginBottom: 18 }}>
            <div style={labelStyle}>PLZ + Ort</div>
            <div style={{ display: "flex", gap: 8 }}>
              <input value={plz} onChange={e => setPlz(e.target.value)}
                placeholder="80339" style={{ ...inputStyle, flex: "0 0 90px", minWidth: 0 }}/>
              <input value={ort} onChange={e => setOrt(e.target.value)}
                placeholder="München" style={{ ...inputStyle, flex: 1, minWidth: 0 }}/>
            </div>
          </div>

          {/* Verwaltungsart */}
          <div style={{ marginBottom: 14 }}>
            <div style={labelStyle}>Verwaltungsart</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr",
              gap: 8 }}>
              {arten.map(a => {
                const aktiv = verwaltungsart === a.id;
                return (
                  <button key={a.id} onClick={() => setVerwaltungsart(a.id)} style={{
                    display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 2,
                    padding: "10px 12px", minWidth: 0, boxSizing: "border-box",
                    background: aktiv ? accent + "18" : t.surface,
                    border: `2px solid ${aktiv ? accent : t.border}`,
                    borderRadius: RAD.ml, cursor: "pointer", fontFamily: "inherit",
                    transition: "all 0.15s", textAlign: "left" }}>
                    <span style={{ fontSize: FS.l, fontWeight: FW.bold,
                      color: aktiv ? accent : t.text }}>{a.label}</span>
                    <span style={{ fontSize: FS.xs, color: t.sub, lineHeight: 1.3,
                      maxWidth: "100%", overflowWrap: "anywhere" }}>
                      {a.beschr}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <div style={{ fontSize: FS.s, color: t.muted, fontStyle: "italic",
            padding: "10px 0 0", lineHeight: 1.4 }}>
            Einheiten und Verwaltungsdetails können nach dem Anlegen
            im Objekt-Detail ergänzt werden.
          </div>
        </div>

        {/* Footer */}
        <div style={{ padding: "12px 16px", borderTop: `1px solid ${t.border}`,
          display: "flex", gap: 8,
          position: "sticky", bottom: 0, background: t.card }}>
          <AktionsButton variante="breit" rolle="abbrechen" onClick={onClose}
            text="Abbrechen" icon={false} flex={1} t={t} accent={accent}/>
          <AktionsButton variante="breit" rolle="bestaetigen" onClick={speichern}
            disabled={!valid} text="Anlegen" icon={false} flex={2} t={t} accent={accent}/>
        </div>
      </div>
    </div>
  );
}

// ── ObjektListeMitDetail (kanonisches Karten-/Listen-/Master-Detail-Gerüst) ──
// Gekapseltes Muster aus dem Kalender (DESIGN §51): Liste zeigt die Objekte
// (ves), das Detail wird per renderDetail(veObj) ausgetauscht — „außen
// identisch (Objektkarten/-zeilen), innen anderer Inhalt". Erbt automatisch
// Mobil-Fallback + „Zurück zur Liste"-Button + Overflow-Schutz von
// ObjekteMasterDetail. NICHT für jeden Screen ein eigenes Grid bauen — diese
// Komponente verwenden (Kalender, ETV, Aufträge …).
function ObjektListeMitDetail({ ves, kontakte, setVes, setKontakte, t, accent,
  gotoVE, gotoKontakt, cardWidth = 280, kartenSpalten = 2, detailMinBreite = 300, detailMaxAnteil = 0.6,
  listenAnsicht = "karten", viewVEId = null, setViewVEId = null,
  renderDetail = null, istDesktop = true, emptyText = "Keine Einträge.",
  titel = "", anzahl = null, legendeAn = false, onGotoStatusEinstellungen = null }) {
  const offenVEObj = (ves || []).find(v => v.id === viewVEId) || null;
  // Im Mobil-Detail (Objekt offen, kein Desktop-Nebeneinander) zeigt der Header
  // einen „Zurück"-Button — analog zum Objekte-Tab.
  const istMobileDetail = offenVEObj && !istDesktop;
  const header = (
    <StickySectionHeader t={t} accent={accent}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <div onClick={() => setViewVEId && setViewVEId(null)}
          title="Alle Objekte anzeigen"
          style={{ fontSize: FS.xxl, fontWeight: FW.heavy, flexShrink: 0,
            color: t.text, cursor: "pointer", userSelect: "none" }}>
          {titel}
        </div>
        {anzahl != null && (
          <div style={{ display: "inline-flex", alignItems: "center", gap: 6,
            background: t.card, border: `1px solid ${t.border}`, borderRadius: RAD.pill,
            padding: "3px 10px", flexShrink: 0 }}>
            <span style={{ fontSize: FS.s, fontWeight: FW.bold, color: t.sub }}>WEG</span>
            <span style={{ fontSize: FS.s, fontWeight: FW.heavy, color: t.text }}>{anzahl}</span>
          </div>
        )}
        {istMobileDetail && (
          <ZurueckButton onClick={() => setViewVEId && setViewVEId(null)}
            variante="header" t={t} kbZurueck={true}/>
        )}
      </div>
    </StickySectionHeader>
  );
  // Detail-Override-Wrapper: einheitliche Detail-Hülle (Objektkopf + Inhalt),
  // identisch zum Kalender-Muster (renderTerminDetail).
  const renderDetailOverride = (veObj) => {
    if (!veObj) return null;
    return (
      <div style={{ background: accent + "08", border: `1px solid ${accent}`,
        borderRadius: RAD.lg, padding: "14px 16px",
        boxSizing: "border-box", width: "100%", minWidth: 0, overflowWrap: "anywhere" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14, minWidth: 0 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: FS.xxl, fontWeight: FW.heavy, color: accent,
              lineHeight: 1.1, overflowWrap: "anywhere" }}>{veObj.nr}</div>
            <div style={{ fontSize: FS.s, color: t.sub, marginTop: 2,
              overflowWrap: "anywhere" }}>{veObj.adresse}</div>
          </div>
        </div>
        {renderDetail ? renderDetail(veObj) : (
          <div style={{ fontSize: FS.m, color: t.muted, fontStyle: "italic", padding: "8px 2px" }}>
            {emptyText}
          </div>
        )}
      </div>
    );
  };
  // Mit offenem Objekt: dasselbe Master-Detail-Gerüst wie Objekte/Kontakte/
  // Kalender. Auf Mobil liefert ObjekteMasterDetail automatisch den Fallback
  // (Detail voll + „Zurück zur Liste"-Button); kein eigener Mobil-Pfad.
  if (offenVEObj) {
    return (
      <>
        {header}
        <div data-ad-scroll="y" data-ad-auslauf="1" style={{ display: "flex",
          flexDirection: istDesktop ? "row" : "column", flex: 1, minHeight: 0,
          minWidth: 0, width: "100%", boxSizing: "border-box" }}>
          <ObjekteMasterDetail
            listenAnsicht={listenAnsicht}
            cardWidth={cardWidth}
            detailMinBreite={detailMinBreite} detailMaxAnteil={detailMaxAnteil}
            kartenSpalten={kartenSpalten}
            gefiltert={ves}
            expandedVEId={viewVEId}
            setExpandedVEId={(id) => setViewVEId && setViewVEId(id)}
            offenVE={offenVEObj}
            t={t} accent={accent}
            kontakte={kontakte} setKontakte={setKontakte}
            ves={ves} setVes={setVes}
            gotoKontakt={gotoKontakt}
            auswahlAccentOverride={accent}
            renderDetailOverride={renderDetailOverride}/>
        </div>
      </>
    );
  }
  // Ohne offenes Objekt: reine Objektliste (Karten/Zeilen), gleiches Grid.
  return (
    <>
      {header}
      <div data-ad-scroll="y" data-ad-auslauf="1" style={{ flex: 1, minHeight: 0,
        minWidth: 0, width: "100%", boxSizing: "border-box", overflowY: "auto", padding: 2 }}>
        {legendeAn && (ves || []).length > 0 && (
          <ObjektLegende ves={ves} t={t} accent={accent}
            listenAnsicht={listenAnsicht}
            onGotoHandlungsbedarf={onGotoStatusEinstellungen || undefined}/>
        )}
        <div style={listenAnsicht === "liste"
          ? { display: "flex", flexDirection: "column", gap: 6 }
          : { display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 10 }}>
          {(ves || []).map(veObj => listenAnsicht === "liste" ? (
            <VEListenZeile key={veObj.id} ve={veObj} t={t} accent={accent}
              aktiv={false} kbItem id={"objliste-" + veObj.id}
              auswahlAccentOverride={accent}
              onClick={() => setViewVEId && setViewVEId(veObj.id)}/>
          ) : (
            <VEKachel key={veObj.id} ve={veObj} t={t} accent={accent}
              aktiv={false} kbItem id={"objliste-" + veObj.id}
              auswahlAccentOverride={accent}
              onClick={() => setViewVEId && setViewVEId(veObj.id)}/>
          ))}
        </div>
      </div>
    </>
  );
}

// ── ObjekteMasterDetail (responsive Master-Detail-Layout für Objekte) ───────
// Analog zu KontakteMasterDetail: misst Breite und entscheidet zwischen
// 2-Spalten-Master, 1-Spalten-Master, oder nur Detail mit "Zurück"-Button.
function ObjekteMasterDetail({ cardWidth, detailMinBreite = 300, detailMaxAnteil = 0.6, kartenSpalten = 2, gefiltert, expandedVEId, setExpandedVEId, sprungZiel = null,
  offenVE, t, accent, kontakte, setKontakte, ves, setVes, gotoKontakt, listenAnsicht = "karten", renderDetailOverride = null, auswahlAccentOverride = null }) {
  const istListe = listenAnsicht === "liste";
  // Detail immer fest (absolute px aus dem Slider), Master nimmt den Rest. Bei
  // Karten teilt sich der Rest in kartenSpalten gleich breite Spalten.
  const [mdRef, mdLayout] = useMasterDetailLayout(cardWidth, 1.1, 10, 5, true, detailMinBreite, detailMaxAnteil);
  const kartenCols = Math.max(1, Math.min(kartenSpalten, Math.floor((mdLayout.masterWidth || cardWidth) / 300)));
  // Auswahl-Akzent: Mehr-Farbe = Objekt-Bereichsfarbe, Graumodus = System-Akzent.
  // Override (z. B. Kalenderfarbe) hat Vorrang.
  const auswahlAccent = auswahlAccentOverride || useKontaktFarbe().auswahlObjekt || accent;

  // Border/Background auf eigenem inneren Wrapper (analog KontaktDetailKarte).
  // KEIN minHeight: 100% — sonst scrollt die Pane nicht.
  // renderDetailOverride: erlaubt fremden Detail-Inhalt (z. B. Kalender-Termine
  // eines Objekts) bei gleichem Master-Detail-Gerüst.
  const renderDetail = () => renderDetailOverride ? renderDetailOverride(offenVE) : (
    <div style={{
      background: auswahlAccent + "08",
      border: `1px solid ${auswahlAccent}`,
      borderRadius: RAD.lg, padding: "14px 16px",
      minWidth: 0, boxSizing: "border-box", overflowWrap: "anywhere" }}>
      <VEDetail ve={offenVE} t={t} accent={accent}
        kontakte={kontakte} setKontakte={setKontakte} ves={ves} setVes={setVes}
        cardId={"obj-" + offenVE.id}
        sprungZiel={sprungZiel}
        onKontaktClick={(id) => { setExpandedVEId(null); gotoKontakt(id); }}
        onBack={() => setExpandedVEId(null)}/>
    </div>
  );

  // Fallback: kein Master mehr — Detail full-width + Zurück-Button
  if (mdLayout.masterCols === 0) {
    return (
      <div ref={mdRef} style={{ flex: 1, minHeight: 0, minWidth: 0,
        display: "flex", flexDirection: "column" }}>
        <ZurueckButton onClick={() => setExpandedVEId(null)} variante="body" t={t}/>
        <div data-ad-scroll="y" style={{ flex: 1, minHeight: 0, minWidth: 0, overflowY: "auto" }}>
          {renderDetail()}
        </div>
      </div>
    );
  }

  return (
    <div ref={mdRef} style={{ display: "flex", gap: 10,
      flex: 1, minHeight: 0, minWidth: 0, alignItems: "stretch" }}>
      <div data-ad-scroll="y" data-ad-auslauf="1" style={{
        flex: mdLayout.detailFest ? "1 1 0%" : `0 0 ${mdLayout.masterWidth}px`, minWidth: 0,
        overflowY: "auto", padding: 2, boxSizing: "border-box" }}>
        <div style={listenAnsicht === "liste"
          ? { display: "flex", flexDirection: "column", gap: 6 }
          : kartenCols > 1
          ? { display: "grid",
              gridTemplateColumns: `repeat(${kartenCols}, minmax(0, 1fr))`,
              gap: 8, alignContent: "start" }
          : { display: "flex", flexDirection: "column", gap: 8 }}>
          {gefiltert.map(ve => listenAnsicht === "liste" ? (
            <VEListenZeile key={ve.id} ve={ve} t={t} accent={accent}
              aktiv={expandedVEId === ve.id} kbItem id={"obj-" + ve.id}
              auswahlAccentOverride={auswahlAccentOverride}
              onClick={() => setExpandedVEId(expandedVEId === ve.id ? null : ve.id)}/>
          ) : (
            <VEKachel key={ve.id} ve={ve} t={t} accent={accent}
              aktiv={expandedVEId === ve.id} kbItem
              id={"obj-" + ve.id}
              auswahlAccentOverride={auswahlAccentOverride}
              onClick={() => setExpandedVEId(expandedVEId === ve.id ? null : ve.id)}/>
          ))}
        </div>
      </div>
      <div data-ad-auslauf="1" style={{
        flex: mdLayout.detailFest ? `0 0 ${mdLayout.detailBreite}px` : "1 1 0%", minWidth: 0,
        overflowY: "auto" }}>
        {renderDetail()}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// StatusBand — schmale Zeile unter dem App-Header, zeigt Speicher-Status
// ─────────────────────────────────────────────────────────────────────────────
// Modi und Anzeige:
//   dirty (egal welcher Modus, außer FSA-aktiv):
//                  → 🟠 orange: "Ungespeicherte Änderungen — Jetzt sichern"
//   "datei"        → 🟢 grün:  "Live-Sync mit <Ordner>/aktiv/daten.json"
//   "datei-pause"  → 🟠 orange:"Datei-Sync pausiert — bitte Zugriff erneuern"
//   "lokal"        → 🟡 gelb:  "Nur in diesem Browser gespeichert"  (Hinweis-Modus)
//   "nicht-verf"   → 🔴 rot:   "Speichern blockiert (privater Modus?)"
//
// Im FSA-aktiv-Modus wird dirty NICHT angezeigt — der debounced Flush erledigt
// das im Hintergrund automatisch in <1 s.
//
// Klick auf das Band → springt zu Einstellungen → Daten.
function StatusBand({ t, status, dirty, onGotoDaten, onAktivieren,
                     onJetztSichern, kompakt }) {
  if (!status) return null;

  // Wenn lokaler Speicher OK, FSA gar nicht verfügbar UND nichts ungespeichert
  // → Band ausblenden. Bei dirty zeigen wir es immer.
  if (status.modus === "lokal" && !status.fsaVerfuegbar && !dirty) return null;

  let bg, fg, dot, text, action = null;
  const subText = (() => {
    if (!status.letzteSpeicherung) return null;
    const d = status.letzteSpeicherung;
    const pad = (n) => String(n).padStart(2, "0");
    return pad(d.getHours()) + ":" + pad(d.getMinutes());
  })();

  // Dirty hat Priorität — außer im FSA-aktiv-Modus, wo das Auto-Flush
  // den dirty-Status binnen 1s wieder löscht.
  if (dirty && status.modus !== "datei") {
    bg = "#F59E0B22"; fg = t.text; dot = "#F59E0B";
    text = kompakt
      ? "Ungespeichert"
      : "Ungespeicherte \u00c4nderungen \u2014 bitte nach iCloud sichern";
    action = { label: kompakt ? "Sichern" : "Jetzt sichern", fn: onJetztSichern };
  } else if (status.modus === "datei") {
    bg = "#10B98115"; fg = t.text; dot = "#10B981";
    text = kompakt
      ? "Datei-Sync aktiv"
      : "Live-Sync mit Ordner \u201E" + (status.ordnerName || "?") + "/aktiv/daten.json\u201C"
        + (subText ? "  \u00b7  zuletzt " + subText : "");
  } else if (status.modus === "datei-pause") {
    bg = "#F59E0B18"; fg = t.text; dot = "#F59E0B";
    text = kompakt
      ? "Sync pausiert"
      : "Datei-Sync pausiert" + (status.ordnerName ? "  \u00b7  " + status.ordnerName : "")
        + " \u2014 Zugriff erneuern";
    action = { label: "Zugriff erneuern", fn: onAktivieren };
  } else if (status.modus === "nicht-verf") {
    bg = "#EF444418"; fg = t.text; dot = "#EF4444";
    text = "Speichern blockiert (privater Modus oder Sandbox)";
  } else { // "lokal" mit verfügbarem FSA, nicht dirty
    bg = "#F59E0B12"; fg = t.text; dot = "#F59E0B";
    text = kompakt
      ? "Nur im Browser"
      : "Nur in diesem Browser gespeichert  \u00b7  Tipp: Ordner anbinden f\u00fcr Auto-Backup";
  }

  return (
    <div onClick={onGotoDaten}
      title="Klicken: zu Einstellungen \u2192 Daten"
      style={{
        display: "flex", alignItems: "center", gap: 8,
        padding: "5px 14px",
        background: bg,
        borderBottom: `1px solid ${t.border}`,
        fontSize: FS.s, color: fg, cursor: "pointer",
        whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
      }}>
      <span style={{ width: 7, height: 7, borderRadius: RAD.pill,
        background: dot, flexShrink: 0 }}/>
      <span style={{ overflow: "hidden", textOverflow: "ellipsis", flex: 1, minWidth: 0 }}>
        {text}
      </span>
      {action && (
        <button onClick={(e) => { e.stopPropagation(); action.fn && action.fn(); }}
          style={{ background: dot, border: "none",
            color: getContrastColor(dot), fontFamily: "inherit", fontSize: FS.xs, fontWeight: FW.bold,
            padding: "3px 10px", borderRadius: RAD.pill, cursor: "pointer",
            flexShrink: 0, boxShadow: `0 1px 2px ${dot}40` }}>
          {action.label}
        </button>
      )}
    </div>
  );
}

// ── HeaderProfilButton ──────────────────────────────────────────────────────
// Profil-/Settings-Button im App-Header (schmal + breit). Zeigt:
//   • headerZeigeAvatar=false → Zahnrad (Settings-Icon)
//   • headerZeigeAvatar=true und Profilfoto vorhanden → das Foto (rund)
//   • headerZeigeAvatar=true und Vor-/Nachname vorhanden → Initialen
//   • sonst → generisches User-Icon als Fallback
// Aktiv-Highlight (border/background dichter) wenn der Einstellungen-Screen
// gerade offen ist.
function HeaderProfilButton({ settings, kontakte, screen, suchErg, t, systemAccent, onClick }) {
  // Profil-Daten kommen aus dem verknüpften Kontakt (settings.userKontaktId).
  // Backward-compat: falls noch kein Kontakt verknüpft, fallback auf altes
  // settings.userProfil (nur bis zur Migration in SektionProfil).
  const userKontakt = (kontakte || []).find(k => k.id === settings.userKontaktId);
  const p = userKontakt || settings.userProfil || {};
  const fullName = userKontakt
    ? ((p.vorname || "") + " " + (p.nachname || "")).trim() || (p.name || "")
    : ((p.vorname || "") + " " + (p.nachname || "")).trim();
  const parts = fullName.split(" ").filter(Boolean);
  const initials = parts.map(w => w[0]).slice(0, 2).join("").toUpperCase();
  const hatFoto = !!(p.foto && typeof p.foto === "string" && p.foto.length > 0);
  const istEinst = !suchErg && screen === "einstellungen";
  const zeigeAvatar = settings.headerZeigeAvatar;

  let inhalt;
  if (!zeigeAvatar) {
    inhalt = <I name="settings" size={16}
      color={istEinst ? getContrastColor(systemAccent) : systemAccent}/>;
  } else if (hatFoto) {
    inhalt = <img src={p.foto} alt="" draggable={false} style={{
      width: "100%", height: "100%", objectFit: "cover",
      display: "block", borderRadius: RAD.full, pointerEvents: "none" }}/>;
  } else if (initials) {
    inhalt = <span style={{ fontSize: FS.l, fontWeight: FW.heavy,
      color: istEinst ? getContrastColor(systemAccent) : systemAccent, lineHeight: 1 }}>{initials}</span>;
  } else {
    inhalt = <I name="user" size={16}
      color={istEinst ? getContrastColor(systemAccent) : systemAccent}/>;
  }

  // Einheitlich mit Mond/Kalender: transparent + grauer Rand (Ruhe),
  // Vollton-systemAccent wenn aktiv (Einstellungen offen). Foto behält
  // keinen Tint (Bild füllt den Kreis), bekommt aber denselben Rahmen.
  return (
    <button onClick={onClick} title="Einstellungen" aria-label="Einstellungen" style={{
      width: 36, height: 36, borderRadius: RAD.full, padding: 0,
      background: istEinst ? systemAccent : "transparent",
      border: `1px solid ${istEinst ? systemAccent : t.border}`,
      display: "flex", alignItems: "center", justifyContent: "center",
      cursor: "pointer", fontFamily: "inherit", transition: "all 0.15s",
      overflow: "hidden", flexShrink: 0,
    }}>
      {inhalt}
    </button>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// APP – Default Export
// ─────────────────────────────────────────────────────────────────────────────
export default function App() {
  const [mode, setMode] = useState("dark");
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);

  // ── Farb-Intensität / Eingrauen ───────────────────────────────────────────
  // effectiveSettings: bei Intensität < 100 % alle Akzentfarben (Kacheln, Rollen,
  // systemFarbe) Richtung Grau mischen. Der Header (Logo "Da", Zahnrad/Profil,
  // Stift) geht über systemFarbe mit. Wie stark, steuert toGrau. Display-Stellen sollten
  // effectiveSettings nutzen, FarbPicker-Stellen die rohen settings (damit man
  // die echten Farben sieht und ändern kann). SektionErscheinungsbild bekommt
  // beides als Props.
  // Farb-Intensität (0..1). Quelle: settings.farbIntensitaet (0..100 %).
  const farbIntRoh = settings.farbIntensitaet != null ? settings.farbIntensitaet : 100;
  const farbIntensitaet = Math.max(0, Math.min(1, farbIntRoh / 100));
  // Global setzen, damit toGrau() die Stufe kennt (vor allen toGrau-Aufrufen).
  setFarbIntensitaet(farbIntensitaet);
  // serioes = "es wird überhaupt eingegraut" (Intensität < 100 %). Steuert wie
  // bisher die effectiveSettings-Graumappings; das WIE-stark macht toGrau selbst.
  const serioes = farbIntensitaet < 1;
  const effectiveSettings = serioes ? Object.assign({}, settings, {
    kacheln: (settings.kacheln || []).map(function(k) {
      return Object.assign({}, k, { farbe: toGrau(k.farbe) });
    }),
    rollen: (settings.rollen || DEFAULT_ROLLEN).map(function(r) {
      return Object.assign({}, r, { color: toGrau(r.color) });
    }),
    firmenRollen: (settings.firmenRollen || DEFAULT_GEWERKE_LISTE).map(function(r) {
      return Object.assign({}, r, { color: toGrau(r.color) });
    }),
    leistungen: (settings.leistungen || DEFAULT_LEISTUNGEN).map(function(r) {
      return Object.assign({}, r, { color: toGrau(r.color) });
    }),
    verwendungen: (settings.verwendungen || DEFAULT_VERWENDUNGEN).map(function(v) {
      return Object.assign({}, v, { color: toGrau(v.color) });
    }),
    // systemFarbe geht jetzt mit (Header: Logo, Zahnrad, Stift) — wird Richtung
    // Grau gemischt wie alle übrigen Akzente. Der FarbPicker nutzt weiter die
    // rohen settings, damit die echte Farbe wählbar bleibt.
    systemFarbe: toGrau(settings.systemFarbe || ACCENT),
  }) : settings;

  // Akzentfarben aus den Kachel-Einstellungen ableiten. So wirkt die in den
  // Einstellungen → Dashboard gewählte Farbe sofort auf VE-Karten, Buttons,
  // Tab-Underlines etc. Fällt auf die Konstanten zurück, falls die Kachel
  // (noch) keine Farbe hat.
  const objektAccent  = (effectiveSettings.kacheln.find(k => k.id === "objekte")  || {}).farbe || ACCENT;
  const kontaktAccent = (effectiveSettings.kacheln.find(k => k.id === "kontakte") || {}).farbe || KONTAKTE_FARBE;
  const kalenderAccent = (effectiveSettings.kacheln.find(k => k.id === "kalender") || {}).farbe || "#F59E0B";
  const systemAccent  = effectiveSettings.systemFarbe || ACCENT;

  // Auswahl-Akzente (Rahmen-Hervorhebung ausgewählter Karten/Details):
  //   · Mehr-Farbe-Modus → die in den Einstellungen gewählte Bereichsfarbe
  //     (rohe settings, NICHT grau-gemappt), also Objekte cyan / Kontakte violett.
  //   · eingegraut (Intensität < 100 %) → System-Akzent.
  const rohObjektFarbe  = ((settings.kacheln || []).find(k => k.id === "objekte")  || {}).farbe || ACCENT;
  const rohKontaktFarbe = ((settings.kacheln || []).find(k => k.id === "kontakte") || {}).farbe || KONTAKTE_FARBE;
  const auswahlObjekt   = serioes ? systemAccent : rohObjektFarbe;
  const auswahlKontakt  = serioes ? systemAccent : rohKontaktFarbe;

  // Speicher-Status für das StatusBand unter dem App-Header.
  const speicherStatus = useStorageStatus();
  const aktiviereSpeicherErneut = async () => { await storage.aktiviereOrdnerErneut(); };

  // Auto-Zoom auf Input-Feldern (iOS Safari) abstellen.
  // viewport meta mit user-scalable=no + maximum-scale=1.
  useEffect(() => {
    if (typeof document === "undefined") return;
    let meta = document.querySelector('meta[name="viewport"]');
    if (!meta) {
      meta = document.createElement("meta");
      meta.name = "viewport";
      document.head.appendChild(meta);
    }
    meta.content = "width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover";
  }, []);
  // Ladeindikator zuverlässig entfernen, sobald die App gemountet ist. Bewusst
  // hier in der App (nicht nur im mount.jsx-Timer), damit der Spinner garantiert
  // verschwindet, sobald React wirklich rendert — auch wenn der externe Timer
  // aus irgendeinem Grund nicht greift. Wird komplett aus dem DOM genommen.
  useEffect(() => {
    if (typeof document === "undefined") return;
    const loader = document.getElementById("ladeIndikator");
    if (!loader) return;
    loader.style.opacity = "0";
    const t = setTimeout(() => { if (loader && loader.parentNode) loader.parentNode.removeChild(loader); }, 300);
    return () => clearTimeout(t);
  }, []);
  // ── Datenmodell ───────────────────────────────────────────────────────────
  // Versions-Tag für künftige Migrationen. Erhöhen, sobald sich das Schema ändert.
  const SCHEMA_VERSION = 1;
  const [kontakte, setKontakte] = useState(() => normalisiereKontakte(DEFAULT_KONTAKTE));
  const [ves, setVes] = useState(() => normalisiereVes(DEFAULT_VES));
  // Objektlose Termine (Bezug "keiner") — leben nicht in einem ve.termine,
  // sondern in einem eigenen globalen Topf. Felder wie ein manueller Termin,
  // aber ohne objektId/einheitId.
  const [freieTermine, setFreieTermine] = useState([]);
  // Flag: erst nach dem Laden aus Storage beginnt das Auto-Speichern,
  // sonst würde der initiale State (Defaults) den Storage überschreiben.
  const [storageGeladen, setStorageGeladen] = useState(false);

  // Beim Mount: aus localStorage laden, sonst Defaults behalten
  useEffect(() => {
    const sett = storage.ladeSettings();
    if (sett && typeof sett === "object") {
      // Rollen/Firmenrollen mit Defaults mergen: gespeicherte Rollen bleiben
      // wie sie sind (User kann sie editiert haben), aber neue Default-Rollen
      // werden hinten angehängt — sonst fehlen sie nach App-Updates (z. B. die
      // in v4.32 hinzugefügten „Verwalter" + „Buchhalter").
      if (Array.isArray(sett.rollen)) {
        const vorhandeneNamen = sett.rollen.map(r => r && r.name);
        const fehlende = DEFAULT_ROLLEN.filter(r => vorhandeneNamen.indexOf(r.name) < 0);
        if (fehlende.length > 0) sett.rollen = [...sett.rollen, ...fehlende];
      }
      // Gleiches Muster für Dashboard-Kacheln: neue Default-Kacheln (z. B.
      // Statistik, Listengenerator, Fotos) hinten anhängen, sonst fehlen sie
      // bei Bestands-Settings nach App-Updates.
      if (Array.isArray(sett.kacheln)) {
        // Migration: frühere „Tickets"-Kachel heißt jetzt „Aufträge". Alte
        // gespeicherte id/label umschreiben, sonst entstünde eine Dublette
        // (alt „tickets" bleibt + neu „auftraege" wird angehängt).
        sett.kacheln = sett.kacheln.map(k =>
          (k && k.id === "tickets") ? { ...k, id: "auftraege", label: "Aufträge" } : k);
        const vorhandeneIds = sett.kacheln.map(k => k && k.id);
        const fehlendeK = (DEFAULT_SETTINGS.kacheln || []).filter(k => vorhandeneIds.indexOf(k.id) < 0);
        if (fehlendeK.length > 0) sett.kacheln = [...sett.kacheln, ...fehlendeK];
      }
      // Gleiches Muster für Objekt-Tabs: neue Default-Tabs (z. B. „Legionellen",
      // eingeführt in v11.67) in Bestands-Settings nachrüsten — sonst kann das
      // Tab nie erscheinen, weil die gespeicherte objektTabs-Config den Eintrag
      // gar nicht enthält (unabhängig vom Warmwasser-Schalter). Reihenfolge des
      // Defaults übernehmen; vorhandene Tabs bleiben unverändert.
      if (Array.isArray(sett.objektTabs)) {
        const vorhandeneTabIds = sett.objektTabs.map(x => x && x.id);
        const fehlendeT = (DEFAULT_SETTINGS.objektTabs || []).filter(x => vorhandeneTabIds.indexOf(x.id) < 0);
        if (fehlendeT.length > 0) {
          sett.objektTabs = [...sett.objektTabs, ...fehlendeT.map(x => ({ ...x }))]
            .slice()
            .sort((a, b) => (a.reihenfolge || 0) - (b.reihenfolge || 0));
        }
      }
      if (Array.isArray(sett.firmenRollen)) {
        const vorhandeneNamen = sett.firmenRollen.map(r => r && r.name);
        const fehlende = DEFAULT_GEWERKE_LISTE.filter(r => vorhandeneNamen.indexOf(r.name) < 0);
        if (fehlende.length > 0) sett.firmenRollen = [...sett.firmenRollen, ...fehlende];
      }
      // Termin-Bezeichnungen: fehlende Felder (bezug, sichtbar) auffüllen, damit
      // ältere Settings (vor Einführung des Bezug-Feldes) korrekt funktionieren.
      if (Array.isArray(sett.terminBezeichnungen)) {
        sett.terminBezeichnungen = sett.terminBezeichnungen.map(b => ({
          bezug: "objekt", sichtbar: true, autoBeteiligte: "keine", ...b
        }));
      }
      if (Array.isArray(sett.verwendungen)) {
        const vorhandeneNamen = sett.verwendungen.map(v => v && v.name);
        const fehlende = DEFAULT_VERWENDUNGEN.filter(v => vorhandeneNamen.indexOf(v.name) < 0);
        if (fehlende.length > 0) sett.verwendungen = [...sett.verwendungen, ...fehlende];
      }
      // Mit Defaults mergen, damit neue Settings nicht fehlen
      setSettings(s => ({ ...s, ...sett }));
      if (sett.mode === "dark" || sett.mode === "light") setMode(sett.mode);
    }
    const daten = storage.ladeDaten();
    if (daten && typeof daten === "object") {
      if (Array.isArray(daten.kontakte)) setKontakte(normalisiereKontakte(daten.kontakte));
      if (Array.isArray(daten.ves))      setVes(normalisiereVes(daten.ves));
      if (Array.isArray(daten.freieTermine)) setFreieTermine(daten.freieTermine);
    }
    setStorageGeladen(true);
  }, []);

  // Auto-Speichern Settings (inkl. Mode)
  useEffect(() => {
    if (!storageGeladen) return;
    storage.speichereSettings({ ...settings, mode });
  }, [settings, mode, storageGeladen]);

  // Auto-Speichern Daten
  useEffect(() => {
    if (!storageGeladen) return;
    storage.speichereDaten({ kontakte, ves, freieTermine });
  }, [kontakte, ves, freieTermine, storageGeladen]);
  const [headerFilter, setHeaderFilter] = useState(HEADER_FILTER_LEER);
  // Filter für Verwaltungsart auf der Objekte-Seite ("alle" oder VERWALTUNGSART.id)
  const [filterArt, setFilterArt] = useState("alle");
  // Karten-Breite synchron zwischen Übersicht (Grid) und Detail-Liste:
  // misst den Content-Bereich, berechnet die effektive Karten-Breite und
  // verwendet diese im Master-Detail-Modus für die linke Spalte → kein
  // Sprung beim Aufklappen einer Karte.
  const [contentRef, cardWidth] = useCardWidth(settings.kartenMinBreite || 280, 10);
  // Detailbreite relativ zur Kartenbreite (minDetailFactor): größer = breitere
  // Detailansicht, dafür weniger Master-Spalten. Default 1.1 (= bisheriges Verhalten).
  // Detailfenster-Breite jetzt absolut in px (settings.detailMinBreite).
  // Migration aus dem früheren Faktor detailFaktor (× Kartenbreite), auf 20er
  // gerundet. Der px-Wert wird als Faktor (px / cardWidth) durchgereicht — in
  // useMasterDetailLayout kürzt sich cardWidth raus, sodass die effektive
  // Mindest-Detailbreite exakt detailMinBreite ist, unabhängig von cardWidth.
  const detailMinBreite = Math.max(400, Math.min(1200,
    settings.detailMinBreite != null ? settings.detailMinBreite : 400));
  // Anteil der Gesamtbreite, den das Detail höchstens einnehmen darf (40–80 %),
  // damit die Liste daneben nicht gequetscht wird. Default 60 %.
  const detailMaxAnteil = Math.max(0.4, Math.min(0.8,
    settings.detailMaxAnteil != null ? settings.detailMaxAnteil : 0.6));
  const kartenSpalten = settings.kartenSpalten != null ? settings.kartenSpalten : 2;
  // Welche VE-Karte ist in der Objekte-Liste aufgeklappt (Inline-Detail).
  const [expandedVEId, setExpandedVEId] = useState(null);
  // Sprungziel im VE-Detail (Tab + Karte), z. B. aus dem Kalender. Mit Nonce,
  // damit derselbe Sprung mehrfach hintereinander wirken kann.
  const [veSprungZiel, setVeSprungZiel] = useState(null);
  // Bewusst kein Auto-Scroll: die geklickte VE-Karte bleibt an ihrer
  // Stelle, Detail-Inhalte erscheinen darunter/daneben.
  // Filter für Kontaktart auf der Kontakte-Seite ("alle", "person" oder "firma")
  const [filterKontaktart, setFilterKontaktart] = useState("alle");
  // Eigene Gruppen-Filter (UND-kombinierbar mit den Art-Pillen).
  const [filterKontaktGruppe, setFilterKontaktGruppe] = useState("alle");
  const [filterObjektGruppe, setFilterObjektGruppe] = useState("alle");
  const [screen, setScreen] = useState("objekte");
  // Kalender-Seitenleiste (Desktop/iPad): zur Laufzeit an-/ausblendbar über den
  // Header-Kalender-Button bzw. das × im Panel-Kopf. Startwert aus der früheren
  // Einstellung kalSeitenleiste (Bestand). Auf schmalen Geräten greift statt-
  // dessen das Overlay-Panel (kalPanelMobilOffen).
  const [kalDockOffen, setKalDockOffen] = useState(false);
  const [kalPanelMobilOffen, setKalPanelMobilOffen] = useState(false);
  // Kalender-Ansicht: "timeline" | "objekte" (+ aufgeklapptes Objekt).
  const [kalView, setKalView] = useState("objekte");
  const [kalViewVEId, setKalViewVEId] = useState(null);
  // Aufgeklapptes Objekt in den Gerüst-Screens ETV bzw. Aufträge (gleiches
  // Master-Detail-Muster wie Kalender: Liste = Objekte, Detail = Override).
  const [etvViewVEId, setEtvViewVEId] = useState(null);
  const [auftragViewVEId, setAuftragViewVEId] = useState(null);
  const [beschlussViewVEId, setBeschlussViewVEId] = useState(null);
  const [technikViewVEId, setTechnikViewVEId] = useState(null);
  const [dokumenteViewVEId, setDokumenteViewVEId] = useState(null);
  const [fotosViewVEId, setFotosViewVEId] = useState(null);
  const [kommunikationViewVEId, setKommunikationViewVEId] = useState(null);
  const [finanzenViewVEId, setFinanzenViewVEId] = useState(null);
  // Aus dem Seiten-Kalender angesteuerter Termin → in der Kalender-Vollansicht
  // aufklappen + hinscrollen. { key, nonce } (Nonce erlaubt Wiederholung).
  const [pendingTerminKey, setPendingTerminKey] = useState(null);
  const [kontaktId, setKontaktId] = useState(null);
  const [suchErg, setSuchErg] = useState(null);
  const [suchBegriff, setSuchBegr] = useState("");
  const [neuerKontaktOffen, setNeuerKontaktOffen] = useState(false);
  const [neuesObjektOffen, setNeuesObjektOffen] = useState(false);
  // Edit-Modus der Mobile-Detail-Ansicht von einem Objekt — wird im
  // Sticky-Header oben getoggelt (statt unten am Bearbeiten-Stift, der
  // schwer erreichbar ist nach Scroll). Bei Wechsel des offenen VE
  // zurückgesetzt.
  const [objektDetailEditMode, setObjektDetailEditMode] = useState(false);
  useEffect(() => { setObjektDetailEditMode(false); }, [expandedVEId]);

  // Selbe Logik für Kontakte: offener Kontakt auf App-Ebene, damit der
  // Plus-Button im Kontakte-Sticky-Header zum Bearbeiten-Stift wechselt.
  const [aktivKontaktId, setAktivKontaktId] = useState(null);
  const [kontaktDetailEditMode, setKontaktDetailEditMode] = useState(false);
  useEffect(() => { setKontaktDetailEditMode(false); }, [aktivKontaktId]);
  // Counter zum Triggern des Reset im SucheFeld (per useEffect dort)
  const [sucheResetCounter, setSucheResetCounter] = useState(0);
  const sucheReset = () => {
    setSuchErg(null);
    setSuchBegr("");
    setSucheResetCounter(c => c + 1);
  };
  // Konsolidierter UI-Reset: schließt Such-Anzeige und klappt alle Karten zu.
  // Wird bei jedem Screen-Wechsel aufgerufen, damit das Verhalten konsistent ist.
  const resetUI = () => {
    sucheReset();
  };
  // Detail-Zustand eines Screens bewusst schließen (Klick auf Überschrift oder
  // erneut auf denselben Menüpunkt). „offen bleiben“ beim normalen Screen-
  // Wechsel: Detail-Zustände werden NICHT angefasst, nur hier.
  const schliesseDetailVon = (screenId) => {
    if (screenId === "objekte") setExpandedVEId(null);
    else if (screenId === "kontakte") setAktivKontaktId(null);
    else if (screenId === "kalender") { if (typeof setKalViewVEId === "function") setKalViewVEId(null); }
  };

  // Header-Breite messen – entscheidet zwischen 1- und 2-Zeilen-Layout
  const headerRef = useRef(null);
  const [headerBreit, setHeaderBreit] = useState(true);
  useEffect(() => {
    if (!headerRef.current) return;
    const el = headerRef.current;
    const check = () => {
      setHeaderBreit(el.offsetWidth >= 880);
      // Header-Höhe als CSS-Variable setzen, damit Sidebar sticky-top und Karten
      // scrollMarginTop davon abhängen können
      document.documentElement.style.setProperty(
        "--ad-header-h", el.offsetHeight + "px");
    };
    check();
    if (typeof ResizeObserver !== "undefined") {
      const ro = new ResizeObserver(check);
      ro.observe(el);
      return () => ro.disconnect();
    }
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  // PWA-Standalone-Detection → body.ad-standalone Klasse für padding-bottom.
  // Fallback für iOS Safari, das @media (display-mode: standalone) nicht in
  // jeder Version zuverlässig auswertet.
  useEffect(() => {
    const check = () => {
      const isStandalone = (typeof window !== "undefined") && (
        window.navigator.standalone === true ||
        window.matchMedia("(display-mode: standalone)").matches
      );
      document.body.classList.toggle("ad-standalone", isStandalone);
    };
    check();
    const mq = window.matchMedia("(display-mode: standalone)");
    if (mq.addEventListener) mq.addEventListener("change", check);
    else if (mq.addListener) mq.addListener(check);
    return () => {
      if (mq.removeEventListener) mq.removeEventListener("change", check);
      else if (mq.removeListener) mq.removeListener(check);
    };
  }, []);

  // Fensterbreite – entscheidet zwischen Sidebar (Desktop) und horizontaler Leiste (Mobile)
  const windowWidth = useWindowWidth();
  const istDesktop = windowWidth >= DESKTOP_MIN_WIDTH;
  // Header-Kalender-Button: auf Desktop/iPad die feste Seitenleiste anheften
  // (Toggle), auf schmalen Geräten das Overlay-Panel öffnen.
  const kalenderButtonKlick = () => {
    if (istDesktop) setKalDockOffen(o => !o);
    else setKalPanelMobilOffen(true);
  };
  // ── Globaler Header-Filter (DESIGN §32): Sektionen + sichtbare Mengen ─────
  // Der Filter ist screen-unabhängig (kein Reset bei Screen-Wechsel) und wirkt
  // app-weit: Alle Screens erhalten vesSichtbar/kontakteSichtbar statt ves/
  // kontakte für die ANZEIGE. Mutationen (setVes/setKontakte) laufen weiter
  // über die vollen Listen.
  const filterSektionen = computeHeaderFilterSektionen(effectiveSettings, kontakte, ves);
  const objGruppenAlle = effectiveSettings.objektGruppen || [];
  const vesSichtbar = React.useMemo(
    () => ves.filter(ve => vePasstHeaderFilter(ve, headerFilter, effectiveSettings, objGruppenAlle, "objekte")),
    [ves, headerFilter, settings]);
  const kontakteSichtbar = React.useMemo(
    () => filtereKontakteNachHeaderFilter(kontakte, ves, headerFilter, effectiveSettings, objGruppenAlle),
    [kontakte, ves, headerFilter, settings]);
  // Kalender-Mengen: eigener "termine"-Scope je Filter-Eintrag — steuert, ob
  // der gesetzte Filter auch Kalender-Termine (Screen + Dock) beschränkt.
  const vesKalender = React.useMemo(
    () => ves.filter(ve => vePasstHeaderFilter(ve, headerFilter, effectiveSettings, objGruppenAlle, "termine")),
    [ves, headerFilter, settings]);
  const kontakteKalender = React.useMemo(
    () => filtereKontakteNachHeaderFilter(kontakte, ves, headerFilter, effectiveSettings, objGruppenAlle, "termine", "termine"),
    [kontakte, ves, headerFilter, settings]);
  const kalDockAktiv = istDesktop && kalDockOffen;
  // Termine für die Kalender-Seitenleiste (Desktop-Dock) — inkl. 12 Monate
  // Rückblick. Memoisiert, da sammleTermine bei jedem App-Render teuer wäre.
  // WICHTIG: muss NACH istDesktop + vesSichtbar stehen (const-Hoisting/TDZ).
  const dockTermine = React.useMemo(
    () => (kalDockAktiv || (!istDesktop && kalPanelMobilOffen))
      ? sammleTermine(vesKalender, kontakteKalender, KAL_FENSTER_MONATE, 12, freieTermine) : [],
    [vesKalender, kontakteKalender, kalDockAktiv, istDesktop, kalPanelMobilOffen, freieTermine]);

  const tBase = mode === "light" ? LIGHT : DARK;
  // Höherer Kontrast: sub-Texte werden noch heller bzw. dunkler – wirkt überall, wo t.sub/t.muted benutzt wird
  const t = settings.hoherKontrast
    ? { ...tBase,
        sub:   mode === "light" ? "#2A2E40" : "#D0D0E8",
        muted: mode === "light" ? "#454A60" : "#A8A8C5" }
    : tBase;

  // Schriftgröße/Dichte – wirkt auf die gesamte App via CSS-zoom
  const DICHTE_MULT = { compact: 0.9, normal: 1.0, relaxed: 1.18 };
  const dichteMult = DICHTE_MULT[settings.dichte] || 1.0;

  const wechselScreen = (s, reset = false) => {
    setScreen(s);
    resetUI();
    // „offen bleiben“: Detail-Zustände nur leeren, wenn bewusst gewünscht
    // (Klick auf Überschrift / erneut auf denselben Menüpunkt).
    if (reset) schliesseDetailVon(s);
    // Bei Screen-Wechsel zum Anfang scrollen, sodass die ersten Karten
    // unter dem Header sichtbar sind und nicht hinter ihm beginnen
    if (typeof window !== "undefined") {
      window.scrollTo({ top: 0, behavior: "auto" });
    }
  };
  // Sprung zu einer Einstellungs-Sektion aus einer Legende heraus (Objekte/
  // Kontakte/Kalender). Wechselt den Screen und feuert dann das Sektions-Event,
  // auf das der Einstellungs-Screen hört.
  useEffect(() => {
    const handler = (e) => {
      const sekId = (e && e.detail && e.detail.sektion) || null;
      const ankerId = (e && e.detail && e.detail.anker) || null;
      wechselScreen("einstellungen");
      if (sekId) {
        setTimeout(() => {
          try {
            window.dispatchEvent(new CustomEvent("allesda:zentrale-sektion",
              { detail: { id: sekId } }));
          } catch (err) {}
        }, 60);
      }
      if (ankerId) {
        setTimeout(() => {
          const el = document.getElementById(ankerId);
          if (el && el.scrollIntoView) el.scrollIntoView({ block: "start", behavior: "smooth" });
        }, 450);
      }
    };
    window.addEventListener("allesda:goto-einstellungen", handler);
    return () => window.removeEventListener("allesda:goto-einstellungen", handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  // Klick auf eine Objekt-Zuweisung in der Kontakt-Karte: gleicher Pfad wie
  // ein Klick aus der Objekt-Liste — Objekte-Tab + expandedVEId. So sieht
  // der User überall denselben Sticky-Header mit Plus/Stift, FilterButtons
  // und Master-Detail-Layout (vorher gab es einen separaten "screen=ve"
  // Vollbild-Modus ohne diesen Header).
  const gotoVE = (id, sprungZiel) => {
    // Reihenfolge wichtig: wechselScreen() ruft resetUI(), das expandedVEId
    // auf null setzt. Daher NICHT wechselScreen nutzen, sondern Screen direkt
    // setzen und danach das Detail + Filter setzen, damit das Objekt-Detail
    // aufgeklappt erscheint (nicht die Liste). Filter/Suche zurücksetzen, damit
    // das Ziel-Objekt in der gefilterten Liste enthalten ist (offenVE-Lookup).
    // sprungZiel (optional, z. B. aus dem Kalender): { tab, karteId } — öffnet
    // im Detail direkt den Tab und klappt die betroffene Karte auf. Nonce, damit
    // derselbe Sprung wiederholt ausgelöst werden kann.
    setVeSprungZiel(sprungZiel ? { ...sprungZiel, nonce: Date.now() } : null);
    setScreen("objekte");
    sucheReset();
    if (suchErg) setSuchErg(null);
    // Header-Filter nur zurücksetzen, wenn das Ziel-Objekt sonst ausgeblendet
    // wäre (offenVE-Lookup läuft über die sichtbare Liste).
    if (!vesSichtbar.some(v => v.id === id)) setHeaderFilter(HEADER_FILTER_LEER);
    setAktivKontaktId(null);
    setExpandedVEId(id);
    if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "auto" });
  };
  const gotoKontakt = (id) => { setKontaktId(id); wechselScreen("kontakte"); };
  // Aus dem Seiten-Kalender zum Termin in der Vollansicht springen: Panels
  // schließen, zum Kalender-Screen wechseln, Termin-Key zum Aufklappen merken.
  const gotoTermin = (terminKeyStr) => {
    setKalDockOffen(false);
    setKalPanelMobilOffen(false);
    setScreen("kalender");
    // In die Timeline-Ansicht wechseln: nur dort liegen Termine flach gelistet
    // und können per data-termin-key aufgeklappt + angescrollt werden. In der
    // Objekte-Ansicht steckt der Termin in einer Objektkarte → Sprung liefe ins
    // Leere (man landete in der Übersicht).
    setKalView("timeline");
    setKalViewVEId(null);
    sucheReset();
    if (suchErg) setSuchErg(null);
    setPendingTerminKey({ key: terminKeyStr, nonce: Date.now() });
  };
  const goHome = () => { wechselScreen("objekte"); };

  // ── Globale Tastaturkürzel (TASTATUR_AKTIONEN, Einstellungen → Tastatur) ──
  // Bewusst OHNE Dependency-Array registriert: der Handler greift auf frische
  // Closures (settings, wechselScreen) zu. Kürzel feuern nie in Eingabefeldern
  // und nie mit Strg/Cmd/Alt (Shift bleibt erlaubt, z. B. für „?").
  // Listen-Cursor (Stufe 2+3): DOM-basiert — Karten tragen data-kb-item, die
  // Markierung lebt als data-kb-aktiv-Attribut + injiziertes CSS (kein React-
  // State nötig, übersteht Re-Renders als „Cursor-Reset" gutmütig).
  // ⌨ KONVENTION (Stufe 3, v9.65 — gilt für ALLE künftigen Bausteine):
  //   · Jede klickbare Listen-Zeile/-Kachel bekommt data-kb-item="1" direkt am
  //     onClick-Element (fest, kein Prop — außer der Baustein wird auch in
  //     Nicht-Listen-Kontexten verwendet, dann kbItem-Prop wie VEKachel/KontaktKarte).
  //   · Jeder „Zurück"-Button (Detail→Liste, Unteransicht→Übersicht) bekommt
  //     data-kb-zurueck="1"; ohne sichtbaren Button: KbZurueckHook.
  //   · Jeder „Neu/+"-Button bekommt data-kb-neu="1".
  //   Angeschlossen: Objektliste, Kontaktliste, Einheiten-Liste (EinheitZeile),
  //   Kalender (KalenderZeile), Einstellungs-Sektionen, Listengenerator-Vorlagen.
  useEffect(() => {
    if (settings.tastaturAn === false) return;
    // Markierungs-Stil einmalig injizieren.
    if (!document.getElementById("allesda-kb-style")) {
      const st = document.createElement("style");
      st.id = "allesda-kb-style";
      st.textContent = '[data-kb-aktiv="1"]{outline:2px solid #3B82F6 !important;'
        + 'outline-offset:2px;border-radius:14px;}';
      document.head.appendChild(st);
    }
    const sichtbar = (el) => {
      const r = el.getBoundingClientRect();
      return r.width > 0 && r.height > 0;
    };
    const kbItems = () => {
      const aus = [];
      document.querySelectorAll('[data-kb-item="1"]').forEach(el => {
        if (sichtbar(el)) aus.push(el);
      });
      return aus;
    };
    const markiere = (el) => {
      document.querySelectorAll('[data-kb-aktiv="1"]').forEach(x => x.removeAttribute("data-kb-aktiv"));
      if (el) {
        el.setAttribute("data-kb-aktiv", "1");
        try { el.scrollIntoView({ block: "nearest" }); } catch (err) {}
      }
    };
    const handler = (e) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const tgt = e.target;
      const tag = tgt && tgt.tagName ? tgt.tagName.toLowerCase() : "";
      if (tag === "input" || tag === "textarea" || tag === "select"
        || (tgt && tgt.isContentEditable)) return;
      const k = e.key;
      if (!k) return;
      const istZeichen = k.length === 1;
      // Enter/Escape auf fokussierten Buttons/Links nicht kapern (native Bedienung).
      if ((k === "Enter" || k === "Escape" || k === " ") && (tag === "button" || tag === "a")) return;
      const taste = istZeichen && /[a-zA-Z]/.test(k) ? k.toLowerCase() : k;
      const belegung = tastaturBelegungVon(settings);
      const aktion = TASTATUR_AKTIONEN.find(a => belegung[a.id] === taste);
      if (!aktion) return;

      // ── Listen-Cursor ──
      if (aktion.id === "listeAb" || aktion.id === "listeAuf") {
        const items = kbItems();
        if (items.length === 0) return; // normal scrollen lassen
        e.preventDefault();
        let idx = items.findIndex(el => el.getAttribute("data-kb-aktiv") === "1");
        if (aktion.id === "listeAb") idx = idx < 0 ? 0 : Math.min(idx + 1, items.length - 1);
        else idx = idx < 0 ? items.length - 1 : Math.max(idx - 1, 0);
        markiere(items[idx]);
        return;
      }
      if (aktion.id === "oeffnen") {
        const akt = kbItems().find(el => el.getAttribute("data-kb-aktiv") === "1");
        if (!akt) return;
        e.preventDefault();
        akt.click();
        return;
      }
      if (aktion.id === "zurueck") {
        const kand = [];
        document.querySelectorAll('[data-kb-zurueck="1"]').forEach(el => {
          if (sichtbar(el)) kand.push(el);
        });
        if (kand.length === 0) return;
        e.preventDefault();
        markiere(null);
        kand[kand.length - 1].click(); // innersten/letzten Zurück-Button nehmen
        return;
      }
      if (aktion.id === "neu") {
        const kand = [];
        document.querySelectorAll('[data-kb-neu="1"]').forEach(el => {
          if (sichtbar(el)) kand.push(el);
        });
        if (kand.length === 0) return;
        e.preventDefault();
        kand[0].click();
        return;
      }

      e.preventDefault();
      if (aktion.id === "sucheFokus") {
        const el = document.querySelector("input[data-allesda-suche]");
        if (el) el.focus();
        return;
      }
      if (aktion.id === "hilfe") {
        wechselScreen("einstellungen");
        setTimeout(() => {
          try {
            window.dispatchEvent(new CustomEvent("allesda:zentrale-sektion",
              { detail: { id: "tastatur" } }));
          } catch (err) {}
        }, 60);
        return;
      }
      const ZIEL = { navHome: "home", navObjekte: "objekte", navKontakte: "kontakte",
        navKalender: "kalender", navListen: "listen", navStatistik: "statistik",
        navEinstellungen: "einstellungen" };
      if (ZIEL[aktion.id]) wechselScreen(ZIEL[aktion.id]);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  });

  const navTo = (id) => {
    // Erneuter Klick auf den AKTUELLEN Screen → Detail bewusst schließen
    // (zurück zur Liste). Wechsel zu anderem Screen → Detail bleibt erhalten.
    const reset = (id === screen);
    wechselScreen(id, reset);
  };

  // Soll das Dashboard (Kacheln/Sidebar) angezeigt werden?
  // Wird nur vom User-Setting gesteuert – auch in den Einstellungen sichtbar.
  const dashboardSichtbar = (
    settings.dashboardModus === "immer" ||
    (settings.dashboardModus === "home" && screen === "home")
  );

  // Screen-Renderer als benannte Funktionen (statt IIFEs im JSX) ───────────────
  const renderObjekteScreen = () => {
    // Counts pro Verwaltungsart bestimmen (für die Pillen in den Buttons)
    const countsArt = {};
    VERWALTUNGSARTEN.forEach(a => { countsArt[a.id] = 0; });
    vesSichtbar.forEach(v => {
      const a = v.verwaltungsart || "weg";
      if (countsArt[a] !== undefined) countsArt[a] += 1;
    });
    const aktiveArten = Object.entries(settings.filterVerwaltungsarten || {})
      .filter(([_, an]) => an).map(([id]) => id);
    // Eigene Objekt-Gruppen als zweiter Pillen-Strang — UND-kombinierbar mit
    // der Verwaltungsart (beide Filter laufen nacheinander über die Liste).
    const objGruppen = (effectiveSettings.objektGruppen || []).filter(g => g && g.sichtbar !== false);
    const objGruppenArten = objGruppen.map(g => ({ id: g.id, label: g.kurz || g.name, kurz: g.kurz || g.name }));
    const objGruppenCounts = {};
    objGruppen.forEach(g => { objGruppenCounts[g.id] = vesSichtbar.filter(v => objektInGruppe(v, g)).length; });
    const aktiveObjGruppe = objGruppen.find(g => g.id === filterObjektGruppe) || null;
    const nachArt = filterArt === "alle"
      ? vesSichtbar
      : vesSichtbar.filter(v => (v.verwaltungsart || "weg") === filterArt);
    const gefiltert = aktiveObjGruppe
      ? nachArt.filter(v => objektInGruppe(v, aktiveObjGruppe))
      : nachArt;
    const titleAktiv = filterArt === "alle";
    // Mobile-Detail-Modus erkennen: dann zeigt der Sticky-Header oben
    // statt "+ neues Objekt" einen Bearbeiten-Toggle für das offene VE.
    const offenVE = gefiltert.find(v => v.id === expandedVEId);
    const istMobileDetail = offenVE && !istDesktop;
    const hatOffen = !!offenVE;
    // Master-Detail-Inhalt vorab bestimmen (Desktop 2-Spalten / Mobile Vollbild / Grid)
    let detailInhalt;
    if (hatOffen && istDesktop) {
      detailInhalt = (
        <ObjekteMasterDetail
          listenAnsicht={effectiveSettings.listenAnsicht}
          cardWidth={cardWidth}
          detailMinBreite={detailMinBreite} detailMaxAnteil={detailMaxAnteil}
          kartenSpalten={kartenSpalten}
          gefiltert={gefiltert}
          expandedVEId={expandedVEId}
          setExpandedVEId={setExpandedVEId}
          offenVE={offenVE}
          t={t} accent={objektAccent}
          kontakte={kontakte} setKontakte={setKontakte}
          ves={ves} setVes={setVes}
          sprungZiel={veSprungZiel}
          gotoKontakt={gotoKontakt}/>
      );
    } else if (hatOffen && !istDesktop) {
      detailInhalt = (
        <DetailMobilScrollTop offenId={offenVE.id} t={t}
          headerSelector="[data-app-fixed-header]">
          <div style={{
              background: auswahlObjekt + "08",
              border: `1px solid ${auswahlObjekt}`,
              borderRadius: RAD.lg, padding: "14px 6px",
              minWidth: 0, boxSizing: "border-box", overflowWrap: "anywhere" }}>
            <KbZurueckHook onClick={() => setExpandedVEId(null)}/>
            <VEDetail ve={offenVE} t={t} accent={objektAccent}
              kontakte={kontakte} setKontakte={setKontakte} ves={ves} setVes={setVes}
              cardId={"obj-" + offenVE.id}
              sprungZiel={veSprungZiel}
              externEditMode={objektDetailEditMode}
              setExternEditMode={setObjektDetailEditMode}
              onKontaktClick={(id) => { setExpandedVEId(null); gotoKontakt(id); }}
              onBack={() => setExpandedVEId(null)}/>
          </div>
        </DetailMobilScrollTop>
      );
    } else {
      const istListe = effectiveSettings.listenAnsicht === "liste";
      detailInhalt = (
        <div data-ad-scroll="y" style={{ flex: 1, minHeight: 0, overflowY: "auto" }}>
          {settings.legendeObjekte !== false && gefiltert.length > 0 && (
            <ObjektLegende ves={gefiltert} t={t} accent={objektAccent}
              listenAnsicht={effectiveSettings.listenAnsicht}
              onGotoHandlungsbedarf={() => {
                wechselScreen("einstellungen");
                setTimeout(() => {
                  try {
                    window.dispatchEvent(new CustomEvent("allesda:zentrale-sektion",
                      { detail: { id: "statusleiste" } }));
                  } catch (err) {}
                }, 60);
                setTimeout(() => {
                  const el = document.getElementById("set-handlungsbedarf");
                  if (el && el.scrollIntoView) el.scrollIntoView({ block: "start", behavior: "smooth" });
                }, 450);
              }}/>
          )}
          <div style={istListe
            ? { display: "flex", flexDirection: "column", gap: 6 }
            : { display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 10 }}>
            {gefiltert.map(ve => istListe ? (
              <VEListenZeile key={ve.id} ve={ve} t={t} accent={objektAccent}
                aktiv={false} kbItem id={"obj-" + ve.id}
                onClick={() => setExpandedVEId(ve.id)}/>
            ) : (
              <VEKachel key={ve.id} ve={ve} t={t} accent={objektAccent}
                aktiv={false} kbItem
                id={"obj-" + ve.id}
                onClick={() => setExpandedVEId(ve.id)}/>
            ))}
          </div>
        </div>
      );
    }
    return (
      <>
        <StickySectionHeader t={t} accent={objektAccent}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div onClick={() => { setFilterArt("alle"); setFilterObjektGruppe("alle"); setExpandedVEId(null); }}
              title="Alle Objekte anzeigen"
              style={{ fontSize: FS.xxl, fontWeight: FW.heavy, flexShrink: 0,
                color: titleAktiv ? t.text : t.sub, cursor: "pointer",
                userSelect: "none", transition: "color 0.15s" }}>
              Objekte
            </div>
            <FilterButtons arten={VERWALTUNGSARTEN} aktive={aktiveArten}
              counts={countsArt} wert={filterArt} onWert={setFilterArt}
              t={t} accent={objektAccent} ohneAlle={true}/>
            {objGruppenArten.length > 0 && (
              <FilterButtons arten={objGruppenArten} aktive={objGruppenArten.map(a => a.id)}
                counts={objGruppenCounts} wert={filterObjektGruppe}
                onWert={(w) => { setFilterObjektGruppe(w); setExpandedVEId(null); }}
                t={t} accent={objektAccent} ohneAlle={true}/>
            )}
            {istMobileDetail ? (
              <ZurueckButton onClick={() => setExpandedVEId(null)}
                variante="header" t={t} kbZurueck={true}/>
            ) : (
              <button onClick={() => setNeuesObjektOffen(true)}
                data-kb-neu="1" title="Neues Objekt" aria-label="Neues Objekt" style={{
                  display: "flex", alignItems: "center", justifyContent: "center",
                  width: 36, height: 36, flexShrink: 0, marginLeft: "auto",
                  background: objektAccent, border: "none",
                  borderRadius: RAD.pill, cursor: "pointer",
                  boxShadow: `0 1px 2px ${objektAccent}40`,
                }}>
                <I name="plus" size={16} color={getContrastColor(objektAccent)}/>
              </button>
            )}
          </div>
        </StickySectionHeader>
        {detailInhalt}
        {gefiltert.length === 0 && (
          <div style={{ fontSize: FS.m, color: t.muted, fontStyle: "italic",
            marginTop: 20 }}>Keine Objekte dieser Verwaltungsart vorhanden.</div>
        )}
      </>
    );
  };

  const renderKontakteScreen = () => {
    // Filter-Arten dynamisch aus den eingestellten Rollen bauen
    const arten = buildKontaktarten(effectiveSettings.rollen, effectiveSettings.firmenRollen);
    // Counts pro Filter-Art via kontaktPasstZuArt berechnen
    const countsArt = {};
    arten.forEach(a => {
      countsArt[a.id] = kontakteSichtbar.filter(k => kontaktPasstZuArt(k, a.id, arten)).length;
    });
    const aktiveArten = Object.entries(settings.filterKontaktarten || {})
      .filter(([_, an]) => an).map(([id]) => id);
    // Eigene Kontakt-Gruppen als zweiter Pillen-Strang. UND-Kombination: die
    // Gruppen-Vorfilterung läuft VOR dem Art-Filter der Liste (kontakteFuerListe).
    const konGruppen = (effectiveSettings.kontaktGruppen || []).filter(g => g && g.sichtbar !== false);
    const konGruppenArten = konGruppen.map(g => ({ id: g.id, label: g.kurz || g.name, kurz: g.kurz || g.name }));
    const konGruppenCounts = {};
    konGruppen.forEach(g => { konGruppenCounts[g.id] = kontakteSichtbar.filter(k => kontaktInGruppe(k, g)).length; });
    const aktiveKonGruppe = konGruppen.find(g => g.id === filterKontaktGruppe) || null;
    const kontakteFuerListe = aktiveKonGruppe
      ? kontakteSichtbar.filter(k => kontaktInGruppe(k, aktiveKonGruppe))
      : kontakteSichtbar;
    const titleAktiv = filterKontaktart === "alle" && !aktiveKonGruppe;
    return (
      <>
        <StickySectionHeader t={t} accent={kontaktAccent}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div onClick={() => { setFilterKontaktart("alle"); setFilterKontaktGruppe("alle"); setAktivKontaktId(null); }}
              title="Alle Kontakte anzeigen"
              style={{ fontSize: FS.xxl, fontWeight: FW.heavy, flexShrink: 0,
                color: titleAktiv ? t.text : t.sub, cursor: "pointer",
                userSelect: "none", transition: "color 0.15s" }}>
              Kontakte
            </div>
            <FilterButtons arten={arten} aktive={aktiveArten}
              counts={countsArt} wert={filterKontaktart}
              onWert={(w) => { setFilterKontaktart(w); setAktivKontaktId(null); }}
              t={t} accent={kontaktAccent} ohneAlle={true}/>
            {konGruppenArten.length > 0 && (
              <FilterButtons arten={konGruppenArten} aktive={konGruppenArten.map(a => a.id)}
                counts={konGruppenCounts} wert={filterKontaktGruppe}
                onWert={(w) => { setFilterKontaktGruppe(w); setAktivKontaktId(null); }}
                t={t} accent={kontaktAccent} ohneAlle={true}/>
            )}
            {aktivKontaktId && !istDesktop ? (
              <ZurueckButton onClick={() => setAktivKontaktId(null)}
                variante="header" t={t} kbZurueck={true}/>
            ) : (
              <button onClick={() => setNeuerKontaktOffen(true)}
                data-kb-neu="1" title="Neuer Kontakt" aria-label="Neuer Kontakt" style={{
                  display: "flex", alignItems: "center", justifyContent: "center",
                  width: 36, height: 36, flexShrink: 0, marginLeft: "auto",
                  background: kontaktAccent, border: "none",
                  borderRadius: RAD.pill, cursor: "pointer",
                  boxShadow: `0 1px 2px ${kontaktAccent}40`,
                }}>
                <I name="plus" size={16} color={getContrastColor(kontaktAccent)}/>
              </button>
            )}
          </div>
        </StickySectionHeader>
        <KontakteScreen t={t} accent={kontaktAccent}
          listenAnsicht={effectiveSettings.listenAnsicht}
          kontaktart={filterKontaktart}
          legendeAn={settings.legendeKontakte !== false}
          kontakte={kontakteFuerListe} setKontakte={setKontakte} ves={ves}
          initialKontaktId={kontaktId} onVEClick={gotoVE}
          externAktiv={aktivKontaktId} setExternAktiv={setAktivKontaktId}
          externEditMode={kontaktDetailEditMode}
          setExternEditMode={setKontaktDetailEditMode}
          mobileDetailHeaderOhneEditBtn={false}
          cardWidth={cardWidth} detailMinBreite={detailMinBreite} detailMaxAnteil={detailMaxAnteil} kartenSpalten={kartenSpalten}/>
      </>
    );
  };

  const renderPlatzhalterScreen = () => {
    const kachel = (effectiveSettings.kacheln.find(k => k.id === screen) || {});
    // Untermenüs pro Bereich (aus Mindmap übernommen)
    const SUB = {
      etv:           ["Stammdaten", "Beschlusssammlung", "Versammlung / Planung", "Protokoll",
                      "HGA", "WPL", "ERL", "Beschluss-Vorbereitung & Nachbereitung"],
      auftraege:     ["Vorgangsliste", "Status (offen/in Arbeit/erledigt)", "Zuweisung an Person/Firma",
                      "Verknüpfung mit Objekt", "Anhänge", "Verlauf / Historie"],
      kommunikation: ["E-Mail-Postfach", "SMS / Push", "Briefe & Serienbriefe", "Vorlagen",
                      "Versandhistorie", "Adressverteiler"],
      finanzen:      ["Hausgeldabrechnung (HGA)", "Wirtschaftsplan (WPL)", "Einzelabrechnungen (ERL)",
                      "Rechnungen", "Zahlungsverkehr", "Mahnwesen", "Bankverbindungen"],
      technik:       ["Heizung", "Aufzug", "Lüftung", "Hebeanlage", "Doppelparker",
                      "Garagentor / Schranke / Automatik-Tür", "PV-Anlage", "Zähler"],
      dokumente:     ["Verträge", "Rechnungen", "Grundbuchauszüge", "Protokolle", "Pläne", "Fotos"],
      statistik:     ["Kennzahlen je Objekt (WE, Fläche, MEA)", "Leerstandsquote", "Fristen-Übersicht",
                      "Bestandsentwicklung", "Auswertungen über alle Objekte"],
      listen:        ["Eigentümerliste", "Bewohnerliste", "Klingelschild-Liste", "Verteiler / Serienbrief-Export",
                      "Eigene Spaltenauswahl", "Druck / PDF-Export"],
      fotos:         ["Objektfotos", "Einheiten-Fotos", "Schadensdokumentation", "Vorher/Nachher",
                      "Zuordnung zu Objekt / Einheit / Vorgang"],
    };
    const subs = SUB[screen] || [];
    return (
      <div data-ad-scroll="y" style={{ flex: 1, minHeight: 0, overflowY: "auto" }}>
        <div style={{ maxWidth: 720, margin: "32px auto", textAlign: "center" }}>
          <div style={{ display: "inline-flex", alignItems: "center", justifyContent: "center",
            width: 64, height: 64, borderRadius: RAD.xl, background: (kachel.farbe || t.muted) + "22",
            marginBottom: 16 }}>
            <I name={kachel.icon || "building"} size={28} color={kachel.farbe || t.muted}/>
          </div>
          <div style={{ fontSize: FS.xxl, fontWeight: FW.bold, color: t.text, marginBottom: 6 }}>{kachel.label}</div>
          <div style={{ fontSize: FS.m, color: t.muted, marginBottom: 24 }}>
            Bereich in Vorbereitung
          </div>
          {subs.length > 0 && (
            <div style={{ display: "inline-block", textAlign: "left",
              background: t.card, border: `1px solid ${t.border}`,
              borderRadius: RAD.lg, padding: "14px 18px", minWidth: 280 }}>
              <div style={{ fontSize: FS.xs, fontWeight: FW.bold, color: t.sub,
                textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 10 }}>
                Geplante Unterbereiche
              </div>
              {subs.map((s, i) => (
                <div key={i} style={{ fontSize: FS.l, color: t.sub, padding: "4px 0",
                  display: "flex", alignItems: "center", gap: 8 }}>
                  <div style={{ width: 5, height: 5, borderRadius: RAD.full,
                    background: (kachel.farbe || t.muted) + "80", flexShrink: 0 }}/>
                  {s}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <TipProvider>
    <KontakteContext.Provider value={kontakte}>
    <RollenContext.Provider value={effectiveSettings.rollen || DEFAULT_ROLLEN}>
    <FirmenRollenContext.Provider value={effectiveSettings.firmenRollen || DEFAULT_GEWERKE_LISTE}>
    <LeistungenContext.Provider value={effectiveSettings.leistungen || DEFAULT_LEISTUNGEN}>
    <VerwendungenContext.Provider value={effectiveSettings.verwendungen || DEFAULT_VERWENDUNGEN}>
    <KategorienContext.Provider value={effectiveSettings.kategorien || DEFAULT_KATEGORIEN}>
    <AvatarIconsContext.Provider value={{
      person: settings.avatarIconsPerson !== false,
      firma:  settings.avatarIconsFirma  !== false
    }}>
    <KartenBadgesContext.Provider value={{
      person: settings.kartenBadgesPerson !== false,
      firma:  settings.kartenBadgesFirma  !== false
    }}>
    <StatusLeisteContext.Provider value={{
      objekt:  settings.statusLeisteObjekt  !== false,
      kontakt: settings.statusLeisteKontakt !== false
    }}>
    <TerminBezeichnungenContext.Provider value={settings.terminBezeichnungen || []}>
    <ZeitPickerContext.Provider value={{
      minutenschritt: settings.zeitMinutenschritt === 5 ? 5 : 15,
      stundenModus: settings.zeitStundenModus === "24h" ? "24h" : "arbeit",
      puffer: settings.zeitArbeitPuffer != null ? settings.zeitArbeitPuffer : 1,
      arbeitVon: settings.kalArbeitVon != null ? settings.kalArbeitVon : 8,
      arbeitBis: settings.kalArbeitBis != null ? settings.kalArbeitBis : 17,
      dauerOptionen: (settings.terminDauerOptionen && settings.terminDauerOptionen.length > 0)
        ? settings.terminDauerOptionen : [15, 30, 45, 60, 90, 120]
    }}>
    <HandlungsbedarfContext.Provider value={settings.handlungsbedarf || { quellen: {}, vorlauf: {} }}>
    <ObjektTabsContext.Provider value={settings.objektTabs || null}>
    <EinheitAnzeigeContext.Provider value={{
      flaeche:     settings.einheitAnzeigeFlaeche     !== false,
      mea:         settings.einheitAnzeigeMea         !== false,
      eigentuemer: settings.einheitAnzeigeEigentuemer !== false,
      mieter:      settings.einheitAnzeigeMieter      !== false,
    }}>
    <RechnungsadresseContext.Provider value={settings.rechnungsadresseAnzeigen === true}>
    <LoeschenErlaubtContext.Provider value={{ objekte: settings.loeschenErlaubtObjekte === true, kontakte: settings.loeschenErlaubtKontakte === true }}>
    <KontaktFarbeContext.Provider value={{ person: kontaktAccent, firma: kontaktAccent, objekt: objektAccent, system: systemAccent, auswahlObjekt: auswahlObjekt, auswahlKontakt: auswahlKontakt }}>
    <KontaktAnzeigeContext.Provider value={{
      nameFormat: settings.kontakteNameFormat || "vorname-nachname",
      alphaTrenner: settings.kontakteAlphaTrenner !== false,
    }}>
    <div className={istDesktop ? "ad-root-desktop" : "ad-root-mobile"} style={{
      // ── Layout-Modus ──────────────────────────────────────────────────────
      // DESKTOP (≥900px): Fixed-Viewport. App-Root = volle Viewport-Höhe,
      //   Flex-Column, overflow:hidden. Innere Bereiche (Sidebar, Master-Detail)
      //   scrollen unabhängig in eigenen overflow:auto-Containern. zoom für Dichte.
      // MOBILE (<900px): Outer ist NUR Theming-Wrapper — KEINE Höhe, KEINE
      //   feste Breite, KEIN zoom (alles würde den Outer zu einem festen
      //   Rechteck machen und den Body-Scroll abschneiden). Die min-height
      //   sitzt am <body> (siehe MOBILE-RAHMEN-SPEC.md §1, §4). Block-Fluss.
      ...(istDesktop
        ? { width: `${100/dichteMult}vw`,
            height: `${100/dichteMult}dvh`, overflow: "hidden",
            display: "flex", flexDirection: "column",
            zoom: dichteMult }
        : { display: "block" }),
      background: t.bg, fontFamily: FONT, color: t.text }}>
      <link rel="stylesheet" href={FONT_URL}/>
      <style>{`
        :root {
          /* Scroll-Auslauf (DESIGN §33): Leerraum am Ende jedes Haupt-Scroll-
             Bereichs, damit auch der letzte Inhalt ins obere Drittel des
             Bildschirms gescrollt werden kann (Sprungziele kleben sonst unten). */
          --ad-auslauf: 62dvh;
        }
        html, body {
          background: ${t.bg};
          margin: 0; padding: 0;
        }
        ${istDesktop ? `
          /* DESKTOP: Window scrollt nie — alles intern. */
          html, body { height: 100%; overflow: hidden; }
          /* Scroll-Auslauf an allen internen Haupt-Scroll-Containern (§33).
             NUR Desktop — auf Mobile sind diese Container aufgelöst (Body
             scrollt), dort übernimmt das body-padding den Auslauf. */
          [data-ad-scroll="y"]::after, [data-ad-auslauf]::after {
            content: ""; display: block; height: var(--ad-auslauf); flex-shrink: 0;
          }
        ` : `
          /* MOBILE: Body scrollt nativ (MOBILE-RAHMEN-SPEC.md).
             min-height statt height, damit langer Inhalt den Body wachsen lässt;
             kein overflow:hidden, damit iOS die Toolbar einklappt und der
             Hintergrund bis zum Display-Rand reicht. safe-area unten füllt
             den Home-Indicator-Abstand in der PWA. */
          html { height: auto; }
          body {
            min-height: 100dvh;
            overflow-x: hidden;
            /* safe-area + Scroll-Auslauf (§33): Inhalt lässt sich bis ins
               obere Drittel hochschieben. Bei kurzem Inhalt füllt das Padding
               nur den Viewport (border-box + min-height) — kein Leer-Scroll. */
            padding-bottom: calc(env(safe-area-inset-bottom, 0px) + var(--ad-auslauf));
          }
        `}
        /* Modal offen → Body-Scroll blockieren (sonst scrollt der Hintergrund mit). */
        body.ad-modal-open { overflow: hidden; }
        ${!istDesktop ? `
          /* MOBILE Body-Scroll: Die screen-internen Haupt-Scroll-Container
             (flex:1; min-height:0; overflow-y:auto) würden eigene gedeckelte
             Scroll-Regionen bilden und so verhindern, dass Inhalt bis zum
             Body-Ende reicht. Hier werden sie aufgelöst — sie wachsen mit dem
             Inhalt, gescrollt wird der Body. Modal-Overlays (position:fixed)
             sind nicht betroffen. Horizontale Leisten (overflow-x) bleiben. */
          .ad-root-mobile [data-ad-scroll],
          .ad-root-mobile [data-ad-scroll="y"] {
            overflow-y: visible !important;
            flex: none !important;
            min-height: auto !important;
          }
        ` : ""}
        * { box-sizing: border-box; }
        button { font-family: ${FONT}; }
        input, textarea, select { font-family: ${FONT}; }
        /* iOS Safari zoomt automatisch in Eingabefelder mit font-size < 16px.
           Auf Touch-Devices erzwingen wir 16px als Minimum. !important
           überschreibt inline-styles in den Komponenten. */
        @media (hover: none) and (pointer: coarse) {
          input, textarea, select {
            font-size: 16px !important;
          }
        }
      `}</style>

      {/* ── Fixed-Header ───────────────────────────────────────────────────── */}
      {/* position: fixed (statt sticky) damit der Header beim Scrollen auf iOS
          nicht wackelt (URL-Bar-Ein/Ausklappen verändert sticky-Verhalten).
          left/right:0 für volle Breite, Spacer-Div darunter mit gemessener
          Header-Höhe schiebt den Content unter den Header. */}
      {/* Genau ein Layout wird gerendert, gesteuert über headerBreit (gemessen). */}
      {/*   schmal (<880px): Zeile 1 = Logo · (Filter|HV-Name) · Avatar           */}
      {/*                    Zeile 2 = Suche · Zahnrad                            */}
      {/*   breit  (≥880px): Logo · (Filter|HV-Name) · Suche · Zahnrad · Avatar   */}
      <div ref={headerRef} data-app-fixed-header="1" style={{ background: t.header,
        borderBottom: `1px solid ${t.border}`,
        ...(istDesktop
          ? { position: "fixed", top: 0, left: 0, right: 0 }
          : { position: "sticky", top: 0 }),
        zIndex: 50,
        paddingTop: "env(safe-area-inset-top, 0px)" }}>

        {!headerBreit && (
          <>
            {/* SCHMAL – Zeile 1: 3-Spalten-Grid (Logo | Filter | Avatar) */}
            <div style={{ display: "grid",
              gridTemplateColumns: "auto 1fr auto", alignItems: "center", gap: 10,
              padding: "6px 14px 6px" }}>
              <button onClick={goHome} style={{
                background: "none", border: "none", cursor: "pointer", padding: 0,
                display: "flex", flexDirection: "column", alignItems: "flex-start" }}>
                <span style={{ fontWeight: FW.heavy, fontSize: FS.icon, letterSpacing: "-0.03em", lineHeight: 1 }}>
                  <span style={{ color: t.text }}>Alles</span>
                  <span style={{ color: systemAccent }}>Da</span>
                </span>
                <span style={{ fontSize: FS.xxs, color: t.muted, marginTop: 2,
                  letterSpacing: "0.05em", fontVariantNumeric: "tabular-nums" }}>v{APP_VERSION}</span>
              </button>
              <div style={{ minWidth: 0 }}>
                {settings.filterAktiv ? (
                  <HeaderFilterDropdown sektionen={filterSektionen} value={headerFilter}
                    onChange={(v) => { setHeaderFilter(v); setAktivKontaktId(null); }} t={t}
                    anzahlGesamt={ves.length} anzahlGefiltert={vesSichtbar.length} fullWidth/>
                ) : (
                  <div style={{ display: "flex", alignItems: "center",
                    justifyContent: "center", gap: 8, minWidth: 0, overflow: "hidden" }}>
                    {settings.hvLogoUrl && (
                      <img src={settings.hvLogoUrl} alt="" style={{
                        width: 22, height: 22, borderRadius: RAD.sm, flexShrink: 0,
                        objectFit: "cover" }}/>
                    )}
                    <span style={{ fontSize: FS.m, fontWeight: FW.medium, color: t.sub,
                      whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                      {settings.hvName || ""}
                    </span>
                  </div>
                )}
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
                {settings.headerZeigeDunkelmodus !== false && (
                  <button onClick={() => setMode(mode === "dark" ? "light" : "dark")}
                    title={mode === "dark" ? "Hellmodus" : "Dunkelmodus"}
                    aria-label={mode === "dark" ? "Hellmodus" : "Dunkelmodus"}
                    style={{
                      width: 36, height: 36, borderRadius: RAD.full, padding: 0,
                      background: "transparent",
                      border: `1px solid ${t.border}`,
                      display: "flex", alignItems: "center", justifyContent: "center",
                      cursor: "pointer", fontFamily: "inherit", transition: "all 0.15s" }}>
                    <I name={mode === "dark" ? "sun" : "moon"} size={16} color={systemAccent}/>
                  </button>
                )}
                <button onClick={kalenderButtonKlick}
                  title="Kalender" aria-label="Kalender"
                  style={{
                    width: 36, height: 36, borderRadius: RAD.full, padding: 0,
                    background: (istDesktop && kalDockOffen) ? systemAccent : "transparent",
                    border: `1px solid ${(istDesktop && kalDockOffen) ? systemAccent : t.border}`,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    cursor: "pointer", fontFamily: "inherit", transition: "all 0.15s" }}>
                  <I name="calendar" size={16}
                    color={(istDesktop && kalDockOffen) ? getContrastColor(systemAccent) : systemAccent}/>
                </button>
                <HeaderProfilButton settings={settings} kontakte={kontakte} screen={screen}
                  suchErg={suchErg} t={t} systemAccent={systemAccent}
                  onClick={() => wechselScreen("einstellungen")}/>
              </div>
            </div>

            {/* SCHMAL – Zeile 2: Suche (volle Breite) — nur wenn aktiviert */}
            {settings.headerZeigeSuche !== false && (
              <div style={{ display: "flex", alignItems: "center",
                padding: "0 14px 6px" }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <SucheFeld settings={settings} t={t} accent={objektAccent} kontakte={kontakteSichtbar} ves={vesSichtbar} resetKey={screen + "-" + sucheResetCounter}
                    onErgebnis={(er, beg) => { setSuchErg(er); setSuchBegr(beg); }}/>
                </div>
              </div>
            )}
          </>
        )}

        {headerBreit && (
          <div style={{ display: "flex", alignItems: "center", gap: 10,
            padding: "10px 16px" }}>
            <button onClick={goHome} style={{
              background: "none", border: "none", cursor: "pointer",
              padding: 0, flexShrink: 0,
              display: "flex", flexDirection: "column", alignItems: "flex-start" }}>
              <span style={{ fontWeight: FW.heavy, fontSize: FS.icon, letterSpacing: "-0.03em", lineHeight: 1 }}>
                <span style={{ color: t.text }}>Alles</span>
                <span style={{ color: systemAccent }}>Da</span>
              </span>
              <span style={{ fontSize: FS.xxs, color: t.muted, marginTop: 2,
                letterSpacing: "0.05em", fontVariantNumeric: "tabular-nums" }}>v{APP_VERSION}</span>
            </button>
            {settings.filterAktiv ? (
              <HeaderFilterDropdown sektionen={filterSektionen} value={headerFilter}
                onChange={(v) => { setHeaderFilter(v); setAktivKontaktId(null); }} t={t}
                anzahlGesamt={ves.length} anzahlGefiltert={vesSichtbar.length}/>
            ) : (
              <div style={{ display: "flex", alignItems: "center", gap: 8,
                flexShrink: 1, minWidth: 0, overflow: "hidden" }}>
                {settings.hvLogoUrl && (
                  <img src={settings.hvLogoUrl} alt="" style={{
                    width: 22, height: 22, borderRadius: RAD.sm, flexShrink: 0,
                    objectFit: "cover" }}/>
                )}
                <span style={{ fontSize: FS.m, fontWeight: FW.semi, color: t.sub,
                  whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                  maxWidth: 220 }}>
                  {settings.hvName || ""}
                </span>
              </div>
            )}
            {settings.headerZeigeSuche !== false && (
              <div style={{ flex: 1, minWidth: 200 }}>
                <SucheFeld settings={settings} t={t} accent={objektAccent} kontakte={kontakteSichtbar} ves={vesSichtbar} resetKey={screen + "-" + sucheResetCounter}
                  onErgebnis={(er, beg) => { setSuchErg(er); setSuchBegr(beg); }}/>
              </div>
            )}
            <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
              {settings.headerZeigeDunkelmodus !== false && (
                <button onClick={() => setMode(mode === "dark" ? "light" : "dark")}
                  title={mode === "dark" ? "Hellmodus" : "Dunkelmodus"}
                  aria-label={mode === "dark" ? "Hellmodus" : "Dunkelmodus"}
                  style={{
                    width: 36, height: 36, borderRadius: RAD.full, padding: 0,
                    background: "transparent",
                    border: `1px solid ${t.border}`,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    cursor: "pointer", fontFamily: "inherit", transition: "all 0.15s" }}>
                  <I name={mode === "dark" ? "sun" : "moon"} size={16} color={systemAccent}/>
                </button>
              )}
              <button onClick={kalenderButtonKlick}
                title="Kalender" aria-label="Kalender"
                style={{
                  width: 36, height: 36, borderRadius: RAD.full, padding: 0,
                  background: (istDesktop && kalDockOffen) ? systemAccent : "transparent",
                  border: `1px solid ${(istDesktop && kalDockOffen) ? systemAccent : t.border}`,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  cursor: "pointer", fontFamily: "inherit", transition: "all 0.15s" }}>
                <I name="calendar" size={16}
                  color={(istDesktop && kalDockOffen) ? getContrastColor(systemAccent) : systemAccent}/>
              </button>
              <HeaderProfilButton settings={settings} kontakte={kontakte} screen={screen}
                suchErg={suchErg} t={t} systemAccent={systemAccent}
                onClick={() => wechselScreen("einstellungen")}/>
            </div>
          </div>
        )}
        {/* Wenn Sticky-Modus an: Kachel-Leiste hängt am Header dran und scrollt
            damit nicht weg. */}
        {!istDesktop && dashboardSichtbar && settings.dashboardSticky && (
          <div style={{ borderTop: `1px solid ${t.border}`, padding: "6px 0" }}>
            <KategorieKacheln settings={effectiveSettings} t={t} aktiverScreen={screen} suchAktiv={!!suchErg} onKlick={navTo}/>
          </div>
        )}
        {/* Speicher-Status-Band — schmale Zeile am Ende des Headers.
            Wird nur gerendert, wenn der Status erwähnenswert ist
            (siehe StatusBand-Logik). */}
        <StatusBand t={t} status={speicherStatus} dirty={false} kompakt={!headerBreit}
          onGotoDaten={() => wechselScreen("einstellungen")}
          onAktivieren={aktiviereSpeicherErneut}
          onJetztSichern={() => {}}/>
      </div>

      {/* Spacer für fixed Header — NUR Desktop: der fixed-Header ist aus dem
          Flow genommen, der Spacer (Höhe = gemessene Header-Höhe via CSS-Var)
          schiebt den Content darunter. Auf Mobile ist der Header sticky und
          bleibt im Flow → kein Spacer nötig (würde sonst leeren Raum erzeugen). */}
      {istDesktop && (
        <div aria-hidden="true" style={{ height: "var(--ad-header-h, 100px)", flexShrink: 0 }}/>
      )}

      {/* Horizontale Kachel-Leiste — nur bei Mobile (< 900px).
          Wenn dashboardSticky=false: außerhalb des Headers (scrollt mit weg).
          Wenn dashboardSticky=true: integriert in den fixed Header (s.o.). */}
      {!istDesktop && dashboardSichtbar && !settings.dashboardSticky && (
        <div style={{ background: t.header,
          borderBottom: `1px solid ${t.border}`, padding: "6px 0",
          flexShrink: 0 }}>
          <KategorieKacheln settings={effectiveSettings} t={t} aktiverScreen={screen} suchAktiv={!!suchErg} onKlick={navTo}/>
        </div>
      )}

      {/* Hauptbereich: Sidebar (Desktop, links) + Content.
          DESKTOP: flex:1 + minHeight:0 + overflow:hidden, damit innere
            overflow:auto-Container (Sidebar, Master-Detail) ihre Wirkung
            entfalten — eigener Scroll je Bereich, KEIN Body-Scroll.
          MOBILE: normaler Block, der mit dem Body mitwächst (Body-Scroll).
            Kein flex:1/minHeight:0/overflow — sonst würde die Höhe gedeckelt
            und Inhalt unten abgeschnitten. */}
      <div style={istDesktop
        ? { display: "flex", flex: 1, minHeight: 0, overflow: "hidden" }
        : { display: "flex", flexDirection: "column" }}>
        {istDesktop && dashboardSichtbar && (
          <div style={{
            background: t.surface,
            borderRight: `1px solid ${t.border}`,
            flexShrink: 0,
            height: "100%",
            overflowY: "auto",
          }}>
            <SeitenleisteKacheln settings={effectiveSettings} setSettings={setSettings}
              t={t} aktiverScreen={screen} onKlick={navTo}/>
          </div>
        )}

        {/* Content */}
        <div style={istDesktop
          ? { flex: 1, minWidth: 0, display: "flex", flexDirection: "column", minHeight: 0, overflow: "hidden" }
          : { display: "flex", flexDirection: "column" }}>
          <div style={istDesktop
            ? { margin: "0 auto", padding: "0 10px", width: "100%", minWidth: 0, display: "flex", flexDirection: "column", flex: 1, minHeight: 0 }
            : { margin: "0 auto", padding: "0 10px", width: "100%", display: "flex", flexDirection: "column" }}>
            <div ref={contentRef} style={istDesktop
              ? { flex: 1, minHeight: 0, minWidth: 0, display: "flex", flexDirection: "column", overflow: "hidden" }
              : { display: "flex", flexDirection: "column" }}>
        {!suchErg && screen === "einstellungen" && (
          <EinstellungenZentrale
            settings={settings} setSettings={setSettings}
            kontakte={kontakte} setKontakte={setKontakte}
            ves={ves} setVes={setVes}
            t={t} accent={objektAccent}
            mode={mode} setMode={setMode}
            cardWidth={cardWidth} detailMinBreite={detailMinBreite} detailMaxAnteil={detailMaxAnteil}/>
        )}

        {/* Suchergebnisse — werden über JEDEN aktuellen Screen gerendert
            (kein eigener Home-Screen mehr). Schließen bringt den Nutzer zum
            vorigen Screen zurück. Objekte und Kontakte erscheinen in
            getrennten Sektionen mit gleichem Karten-Layout — optisch
            unterscheidbar. */}
        {suchErg && (
          <div data-ad-scroll="y" style={{ flex: 1, minHeight: 0, overflowY: "auto" }}>
            <Suchergebnisse ergebnisse={suchErg} suchbegriff={suchBegriff} t={t} accent={objektAccent}
              ves={ves} setVes={setVes} kontakte={kontakte} setKontakte={setKontakte}
              onSchliessen={sucheReset}/>
          </div>
        )}

        {!suchErg && screen === "kalender" && (
          <KalenderScreen ves={vesKalender} kontakte={kontakteKalender} setVes={setVes} setKontakte={setKontakte} plusAccent={kalenderAccent} t={t} accent={objektAccent}
            gotoVE={gotoVE} gotoKontakt={gotoKontakt} settings={effectiveSettings}
            freieTermine={freieTermine} setFreieTermine={setFreieTermine}
            pendingTerminKey={pendingTerminKey}
            kalView={kalView} setKalView={setKalView}
            kalViewVEId={kalViewVEId} setKalViewVEId={setKalViewVEId}
            cardWidth={cardWidth} kartenSpalten={kartenSpalten}
            detailMinBreite={detailMinBreite} detailMaxAnteil={detailMaxAnteil} listenAnsicht={effectiveSettings.listenAnsicht}
            dockOffen={kalDockAktiv}/>
        )}

        {!suchErg && screen === "objekte" && renderObjekteScreen()}

        {!suchErg && screen === "kontakte" && renderKontakteScreen()}

        {/* Modal: Neuer Kontakt anlegen */}
        {neuerKontaktOffen && (
          <NeuerKontaktModal t={t} accent={kontaktAccent}
            ves={ves} kontakte={kontakte}
            onClose={() => setNeuerKontaktOffen(false)}
            onSave={(neu) => {
              // Neue ID = höchste vorhandene ID + 1
              const maxId = kontakte.reduce((m, k) => k.id > m ? k.id : m, 0);
              const id = maxId + 1;
              const eintrag = neu.typ === "person"
                ? { id, typ: "person",
                    name: `${neu.vorname || ""} ${neu.nachname || ""}`.trim(),
                    vorname: neu.vorname || "", nachname: neu.nachname || "",
                    anrede: neu.anrede || "", titel: neu.titel || "",
                    tels: neu.tel ? [{ type: "Mobil", nr: neu.tel }] : [],
                    emails: neu.email ? [{ type: "Privat", email: neu.email }] : [],
                    strasse: neu.strasse || "", plz: neu.plz || "", ort: neu.ort || "",
                    rollen: [...new Set((neu.objektZuweisungen || []).map(z => z.rolle))],
                    objektZuweisungen: neu.objektZuweisungen || [], badges: [] }
                : { id, typ: "firma",
                    name: neu.name || "",
                    rechtsform: neu.rechtsform || "",
                    tel: neu.tel || "", email: neu.email || "",
                    strasse: neu.strasse || "", plz: neu.plz || "", ort: neu.ort || "",
                    ansprechpartner: [], gewerke: [],
                    objektZuweisungen: neu.objektZuweisungen || [] };
              // Optionale Ansprechperson: eigener Personen-Kontakt, automatisch
              // als Anstellung (firmenRollen) mit der neuen Firma verknüpft.
              const ap = neu.ansprechperson;
              if (eintrag.typ === "firma" && ap && (ap.vorname || ap.nachname)) {
                const apId = id + 1;
                const apKontakt = {
                  id: apId, typ: "person",
                  name: `${ap.vorname || ""} ${ap.nachname || ""}`.trim(),
                  vorname: ap.vorname || "", nachname: ap.nachname || "",
                  anrede: "", titel: "",
                  tels: ap.tel ? [{ type: "Mobil", nr: ap.tel }] : [],
                  emails: ap.email ? [{ type: "Privat", email: ap.email }] : [],
                  strasse: "", plz: "", ort: "",
                  firmaId: id,
                  besitz: [], zustaendigkeiten: [],
                  firmenRollen: [{ firmaId: id, rolle: "Ansprechpartner (Firma)", status: "aktiv" }],
                  objektZuweisungen: [{ firmaId: id, rolle: "Ansprechpartner (Firma)", status: "aktiv" }],
                  rollen: ["Ansprechpartner (Firma)"], badges: [],
                };
                // Firma kennt die Person als Ansprechpartner.
                eintrag.ansprechpartner = [{ vorname: ap.vorname || "", nachname: ap.nachname || "", funktion: "Ansprechpartner" }];
                setKontakte(v => [...v, eintrag, apKontakt]);
              } else {
                setKontakte(v => [...v, eintrag]);
              }
              // Direkt in den neuen Kontakt springen (Detailansicht öffnen),
              // analog zum Objekt-Anlegen.
              setKontaktId(id);
            }}/>
        )}

        {/* Modal: Neues Objekt anlegen */}
        {neuesObjektOffen && (
          <NeuesObjektModal t={t} accent={objektAccent}
            vorhandeneVes={ves}
            onClose={() => setNeuesObjektOffen(false)}
            onSave={(neueVE) => {
              setVes(v => [...v, neueVE]);
              // Direkt in das neue Objekt springen, damit der Nutzer Einheiten anlegen kann
              setExpandedVEId(neueVE.id);
            }}/>
        )}

        {!suchErg && screen === "etv" && (
          <ObjektListeMitDetail
            ves={vesSichtbar} kontakte={kontakteSichtbar}
            setVes={setVes} setKontakte={setKontakte} t={t}
            accent={(effectiveSettings.kacheln.find(k => k.id === "etv") || {}).farbe || "#10B981"}
            gotoVE={gotoVE} gotoKontakt={gotoKontakt}
            cardWidth={cardWidth} kartenSpalten={kartenSpalten}
            detailMinBreite={detailMinBreite} detailMaxAnteil={detailMaxAnteil} listenAnsicht={effectiveSettings.listenAnsicht}
            viewVEId={etvViewVEId} setViewVEId={setEtvViewVEId}
            istDesktop={istDesktop}
            titel="ETV" anzahl={(vesSichtbar || []).length}
            legendeAn={effectiveSettings.legendeObjekte !== false}
            onGotoStatusEinstellungen={() => {
              wechselScreen("einstellungen");
              setTimeout(() => {
                try {
                  window.dispatchEvent(new CustomEvent("allesda:zentrale-sektion",
                    { detail: { id: "statusleiste" } }));
                } catch (err) {}
              }, 60);
              setTimeout(() => {
                const el = document.getElementById("set-handlungsbedarf");
                if (el && el.scrollIntoView) el.scrollIntoView({ block: "start", behavior: "smooth" });
              }, 450);
            }}
            emptyText="Keine Versammlungen für dieses Objekt."
            renderDetail={(veObj) => {
              // Fake-Demo-Daten nur zum Layout-Testen (echte Quelle folgt).
              const etvAccent = (effectiveSettings.kacheln.find(k => k.id === "etv") || {}).farbe || "#10B981";
              const demo = [
                { titel: "Ordentliche Eigentümerversammlung 2026", datum: "12.03.2026", status: "geplant" },
                { titel: "Beschluss Fassadensanierung", datum: "04.11.2025", status: "erledigt" },
                { titel: "Wirtschaftsplan-Genehmigung", datum: "21.06.2026", status: "offen" },
              ];
              return (
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {demo.map((d, i) => (
                    <div key={i} style={{ background: t.card, border: `1px solid ${t.border}`,
                      borderRadius: RAD.lg, padding: "12px 14px", minWidth: 0,
                      boxSizing: "border-box", width: "100%" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <div style={{ flex: 1, minWidth: 0, fontSize: FS.l, fontWeight: FW.bold,
                          color: t.text, overflowWrap: "anywhere" }}>{d.titel}</div>
                        <div style={{ flexShrink: 0, fontSize: FS.xs, fontWeight: FW.bold,
                          color: getContrastColor(etvAccent), background: etvAccent,
                          borderRadius: RAD.sm, padding: "2px 8px" }}>{d.status}</div>
                      </div>
                      <div style={{ fontSize: FS.s, color: t.muted, marginTop: 4 }}>{d.datum}</div>
                    </div>
                  ))}
                </div>
              );
            }}/>
        )}
        {!suchErg && screen === "auftraege" && (
          <ObjektListeMitDetail
            ves={vesSichtbar} kontakte={kontakteSichtbar}
            setVes={setVes} setKontakte={setKontakte} t={t}
            accent={(effectiveSettings.kacheln.find(k => k.id === "auftraege") || {}).farbe || "#EF4444"}
            gotoVE={gotoVE} gotoKontakt={gotoKontakt}
            cardWidth={cardWidth} kartenSpalten={kartenSpalten}
            detailMinBreite={detailMinBreite} detailMaxAnteil={detailMaxAnteil} listenAnsicht={effectiveSettings.listenAnsicht}
            viewVEId={auftragViewVEId} setViewVEId={setAuftragViewVEId}
            istDesktop={istDesktop}
            titel="Vorgänge" anzahl={(vesSichtbar || []).length}
            legendeAn={effectiveSettings.legendeObjekte !== false}
            onGotoStatusEinstellungen={() => {
              wechselScreen("einstellungen");
              setTimeout(() => {
                try {
                  window.dispatchEvent(new CustomEvent("allesda:zentrale-sektion",
                    { detail: { id: "statusleiste" } }));
                } catch (err) {}
              }, 60);
              setTimeout(() => {
                const el = document.getElementById("set-handlungsbedarf");
                if (el && el.scrollIntoView) el.scrollIntoView({ block: "start", behavior: "smooth" });
              }, 450);
            }}
            emptyText="Keine Vorgänge für dieses Objekt."
            renderDetail={(veObj) => {
              // Fake-Demo-Daten nur zum Layout-Testen (echte Quelle folgt).
              const aAccent = (effectiveSettings.kacheln.find(k => k.id === "auftraege") || {}).farbe || "#EF4444";
              const demo = [
                { titel: "Heizungswartung Jahresturnus", firma: "Wärme & Technik GmbH", status: "in Arbeit" },
                { titel: "Treppenhausreinigung Nachbesserung", firma: "CleanPro Service", status: "offen" },
                { titel: "Aufzug-TÜV-Prüfung", firma: "Lift Süd KG", status: "erledigt" },
              ];
              const statusFarbe = { "offen": "#F59E0B", "in Arbeit": aAccent, "erledigt": "#10B981" };
              return (
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {demo.map((d, i) => (
                    <div key={i} style={{ background: t.card, border: `1px solid ${t.border}`,
                      borderRadius: RAD.lg, padding: "12px 14px", minWidth: 0,
                      boxSizing: "border-box", width: "100%" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <div style={{ flex: 1, minWidth: 0, fontSize: FS.l, fontWeight: FW.bold,
                          color: t.text, overflowWrap: "anywhere" }}>{d.titel}</div>
                        <div style={{ flexShrink: 0, fontSize: FS.xs, fontWeight: FW.bold,
                          color: getContrastColor(statusFarbe[d.status] || aAccent),
                          background: statusFarbe[d.status] || aAccent,
                          borderRadius: RAD.sm, padding: "2px 8px" }}>{d.status}</div>
                      </div>
                      <div style={{ fontSize: FS.s, color: t.muted, marginTop: 4,
                        overflowWrap: "anywhere" }}>{d.firma}</div>
                    </div>
                  ))}
                </div>
              );
            }}/>
        )}
        {!suchErg && screen === "beschluss" && (
          <ObjektListeMitDetail
            ves={vesSichtbar} kontakte={kontakteSichtbar}
            setVes={setVes} setKontakte={setKontakte} t={t}
            accent={(effectiveSettings.kacheln.find(k => k.id === "beschluss") || {}).farbe || "#F59E0B"}
            gotoVE={gotoVE} gotoKontakt={gotoKontakt}
            cardWidth={cardWidth} kartenSpalten={kartenSpalten}
            detailMinBreite={detailMinBreite} detailMaxAnteil={detailMaxAnteil} listenAnsicht={effectiveSettings.listenAnsicht}
            viewVEId={beschlussViewVEId} setViewVEId={setBeschlussViewVEId}
            istDesktop={istDesktop}
            titel="Beschlusssammlung" anzahl={(vesSichtbar || []).length}
            legendeAn={effectiveSettings.legendeObjekte !== false}
            onGotoStatusEinstellungen={() => {
              wechselScreen("einstellungen");
              setTimeout(() => {
                try {
                  window.dispatchEvent(new CustomEvent("allesda:zentrale-sektion",
                    { detail: { id: "statusleiste" } }));
                } catch (err) {}
              }, 60);
              setTimeout(() => {
                const el = document.getElementById("set-handlungsbedarf");
                if (el && el.scrollIntoView) el.scrollIntoView({ block: "start", behavior: "smooth" });
              }, 450);
            }}
            emptyText="Keine Beschlüsse für dieses Objekt."
            renderDetail={(veObj) => {
              // Fake-Demo-Daten nur zum Layout-Testen (echte Quelle folgt).
              const bAccent = (effectiveSettings.kacheln.find(k => k.id === "beschluss") || {}).farbe || "#F59E0B";
              const demo = [
                { titel: "TOP 3 — Fassadensanierung beschlossen", datum: "04.11.2025", nummer: "2025-07" },
                { titel: "TOP 5 — Wirtschaftsplan 2026 genehmigt", datum: "04.11.2025", nummer: "2025-08" },
                { titel: "TOP 2 — Verwalterbestellung verlängert", datum: "12.03.2025", nummer: "2025-02" },
              ];
              return (
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {demo.map((d, i) => (
                    <div key={i} style={{ background: t.card, border: `1px solid ${t.border}`,
                      borderRadius: RAD.lg, padding: "12px 14px", minWidth: 0,
                      boxSizing: "border-box", width: "100%" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <div style={{ flex: 1, minWidth: 0, fontSize: FS.l, fontWeight: FW.bold,
                          color: t.text, overflowWrap: "anywhere" }}>{d.titel}</div>
                        <div style={{ flexShrink: 0, fontSize: FS.xs, fontWeight: FW.bold,
                          color: getContrastColor(bAccent), background: bAccent,
                          borderRadius: RAD.sm, padding: "2px 8px" }}>Nr. {d.nummer}</div>
                      </div>
                      <div style={{ fontSize: FS.s, color: t.muted, marginTop: 4 }}>
                        Beschlossen am {d.datum}
                      </div>
                    </div>
                  ))}
                </div>
              );
            }}/>
        )}
        {!suchErg && screen === "technik" && (
          <ObjektListeMitDetail
            ves={vesSichtbar} kontakte={kontakteSichtbar}
            setVes={setVes} setKontakte={setKontakte} t={t}
            accent={(effectiveSettings.kacheln.find(k => k.id === "technik") || {}).farbe || "#10B981"}
            gotoVE={gotoVE} gotoKontakt={gotoKontakt}
            cardWidth={cardWidth} kartenSpalten={kartenSpalten}
            detailMinBreite={detailMinBreite} detailMaxAnteil={detailMaxAnteil} listenAnsicht={effectiveSettings.listenAnsicht}
            viewVEId={technikViewVEId} setViewVEId={setTechnikViewVEId}
            istDesktop={istDesktop}
            titel="Technik" anzahl={(vesSichtbar || []).length}
            legendeAn={effectiveSettings.legendeObjekte !== false}
            onGotoStatusEinstellungen={() => {
              wechselScreen("einstellungen");
              setTimeout(() => {
                try {
                  window.dispatchEvent(new CustomEvent("allesda:zentrale-sektion",
                    { detail: { id: "statusleiste" } }));
                } catch (err) {}
              }, 60);
              setTimeout(() => {
                const el = document.getElementById("set-handlungsbedarf");
                if (el && el.scrollIntoView) el.scrollIntoView({ block: "start", behavior: "smooth" });
              }, 450);
            }}
            emptyText="Keine technischen Anlagen für dieses Objekt."
            renderDetail={(veObj) => {
              // Fake-Demo-Daten nur zum Layout-Testen (echte Quelle folgt).
              const tAccent = (effectiveSettings.kacheln.find(k => k.id === "technik") || {}).farbe || "#10B981";
              const demo = [
                { titel: "Heizung — Gas-Brennwert", info: "Nächste Wartung 09/2026", status: "ok" },
                { titel: "Aufzug — Personenaufzug", info: "TÜV fällig 06/2026", status: "faellig" },
                { titel: "Lüftung — Zentralanlage", info: "Filterwechsel offen", status: "offen" },
              ];
              const statusFarbe = { "ok": "#10B981", "faellig": "#EF4444", "offen": "#F59E0B" };
              const statusText = { "ok": "OK", "faellig": "fällig", "offen": "offen" };
              return (
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {demo.map((d, i) => (
                    <div key={i} style={{ background: t.card, border: `1px solid ${t.border}`,
                      borderRadius: RAD.lg, padding: "12px 14px", minWidth: 0,
                      boxSizing: "border-box", width: "100%" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <div style={{ flex: 1, minWidth: 0, fontSize: FS.l, fontWeight: FW.bold,
                          color: t.text, overflowWrap: "anywhere" }}>{d.titel}</div>
                        <div style={{ flexShrink: 0, fontSize: FS.xs, fontWeight: FW.bold,
                          color: getContrastColor(statusFarbe[d.status] || tAccent),
                          background: statusFarbe[d.status] || tAccent,
                          borderRadius: RAD.sm, padding: "2px 8px" }}>{statusText[d.status] || d.status}</div>
                      </div>
                      <div style={{ fontSize: FS.s, color: t.muted, marginTop: 4,
                        overflowWrap: "anywhere" }}>{d.info}</div>
                    </div>
                  ))}
                </div>
              );
            }}/>
        )}
        {!suchErg && screen === "dokumente" && (
          <ObjektListeMitDetail
            ves={vesSichtbar} kontakte={kontakteSichtbar}
            setVes={setVes} setKontakte={setKontakte} t={t}
            accent={(effectiveSettings.kacheln.find(k => k.id === "dokumente") || {}).farbe || "#64748B"}
            gotoVE={gotoVE} gotoKontakt={gotoKontakt}
            cardWidth={cardWidth} kartenSpalten={kartenSpalten}
            detailMinBreite={detailMinBreite} detailMaxAnteil={detailMaxAnteil} listenAnsicht={effectiveSettings.listenAnsicht}
            viewVEId={dokumenteViewVEId} setViewVEId={setDokumenteViewVEId}
            istDesktop={istDesktop}
            titel="Dokumente" anzahl={(vesSichtbar || []).length}
            legendeAn={effectiveSettings.legendeObjekte !== false}
            onGotoStatusEinstellungen={() => {
              wechselScreen("einstellungen");
              setTimeout(() => {
                try {
                  window.dispatchEvent(new CustomEvent("allesda:zentrale-sektion",
                    { detail: { id: "statusleiste" } }));
                } catch (err) {}
              }, 60);
              setTimeout(() => {
                const el = document.getElementById("set-handlungsbedarf");
                if (el && el.scrollIntoView) el.scrollIntoView({ block: "start", behavior: "smooth" });
              }, 450);
            }}
            emptyText="Keine Dokumente für dieses Objekt."
            renderDetail={(veObj) => {
              // Fake-Demo-Daten nur zum Layout-Testen (echte Quelle folgt).
              const dAccent = (effectiveSettings.kacheln.find(k => k.id === "dokumente") || {}).farbe || "#64748B";
              const demo = [
                { titel: "Teilungserklärung.pdf", info: "Grunddokument · 2,4 MB", art: "PDF" },
                { titel: "Gemeinschaftsordnung.pdf", info: "Grunddokument · 1,1 MB", art: "PDF" },
                { titel: "Protokoll ETV 2025.pdf", info: "Protokoll · 680 KB", art: "PDF" },
              ];
              return (
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {demo.map((d, i) => (
                    <div key={i} style={{ background: t.card, border: `1px solid ${t.border}`,
                      borderRadius: RAD.lg, padding: "12px 14px", minWidth: 0,
                      boxSizing: "border-box", width: "100%" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <div style={{ flex: 1, minWidth: 0, fontSize: FS.l, fontWeight: FW.bold,
                          color: t.text, overflowWrap: "anywhere" }}>{d.titel}</div>
                        <div style={{ flexShrink: 0, fontSize: FS.xs, fontWeight: FW.bold,
                          color: getContrastColor(dAccent), background: dAccent,
                          borderRadius: RAD.sm, padding: "2px 8px" }}>{d.art}</div>
                      </div>
                      <div style={{ fontSize: FS.s, color: t.muted, marginTop: 4,
                        overflowWrap: "anywhere" }}>{d.info}</div>
                    </div>
                  ))}
                </div>
              );
            }}/>
        )}
        {!suchErg && screen === "fotos" && (
          <ObjektListeMitDetail
            ves={vesSichtbar} kontakte={kontakteSichtbar}
            setVes={setVes} setKontakte={setKontakte} t={t}
            accent={(effectiveSettings.kacheln.find(k => k.id === "fotos") || {}).farbe || "#EC4899"}
            gotoVE={gotoVE} gotoKontakt={gotoKontakt}
            cardWidth={cardWidth} kartenSpalten={kartenSpalten}
            detailMinBreite={detailMinBreite} detailMaxAnteil={detailMaxAnteil} listenAnsicht={effectiveSettings.listenAnsicht}
            viewVEId={fotosViewVEId} setViewVEId={setFotosViewVEId}
            istDesktop={istDesktop}
            titel="Fotos" anzahl={(vesSichtbar || []).length}
            legendeAn={effectiveSettings.legendeObjekte !== false}
            onGotoStatusEinstellungen={() => {
              wechselScreen("einstellungen");
              setTimeout(() => {
                try {
                  window.dispatchEvent(new CustomEvent("allesda:zentrale-sektion",
                    { detail: { id: "statusleiste" } }));
                } catch (err) {}
              }, 60);
              setTimeout(() => {
                const el = document.getElementById("set-handlungsbedarf");
                if (el && el.scrollIntoView) el.scrollIntoView({ block: "start", behavior: "smooth" });
              }, 450);
            }}
            emptyText="Keine Fotos für dieses Objekt."
            renderDetail={(veObj) => {
              // Fake-Demo-Daten nur zum Layout-Testen (echte Quelle folgt).
              const fAccent = (effectiveSettings.kacheln.find(k => k.id === "fotos") || {}).farbe || "#EC4899";
              const demo = [
                { titel: "Fassade Vorderseite", info: "Objektfoto · 12.05.2026" },
                { titel: "Treppenhaus EG", info: "Objektfoto · 12.05.2026" },
                { titel: "Wasserschaden Keller", info: "Schadensdoku · 03.06.2026" },
              ];
              return (
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {demo.map((d, i) => (
                    <div key={i} style={{ display: "flex", alignItems: "center", gap: 12,
                      background: t.card, border: `1px solid ${t.border}`,
                      borderRadius: RAD.lg, padding: "10px 12px", minWidth: 0,
                      boxSizing: "border-box", width: "100%" }}>
                      <div style={{ width: 44, height: 44, flexShrink: 0, borderRadius: RAD.ms,
                        background: fAccent + "22", display: "flex", alignItems: "center",
                        justifyContent: "center" }}>
                        <I name="paint" size={20} color={fAccent}/>
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: FS.l, fontWeight: FW.bold, color: t.text,
                          overflowWrap: "anywhere" }}>{d.titel}</div>
                        <div style={{ fontSize: FS.s, color: t.muted, marginTop: 2,
                          overflowWrap: "anywhere" }}>{d.info}</div>
                      </div>
                    </div>
                  ))}
                </div>
              );
            }}/>
        )}
        {!suchErg && screen === "kommunikation" && (
          <ObjektListeMitDetail
            ves={vesSichtbar} kontakte={kontakteSichtbar}
            setVes={setVes} setKontakte={setKontakte} t={t}
            accent={(effectiveSettings.kacheln.find(k => k.id === "kommunikation") || {}).farbe || "#0EA5E9"}
            gotoVE={gotoVE} gotoKontakt={gotoKontakt}
            cardWidth={cardWidth} kartenSpalten={kartenSpalten}
            detailMinBreite={detailMinBreite} detailMaxAnteil={detailMaxAnteil} listenAnsicht={effectiveSettings.listenAnsicht}
            viewVEId={kommunikationViewVEId} setViewVEId={setKommunikationViewVEId}
            istDesktop={istDesktop}
            titel="Kommunikation" anzahl={(vesSichtbar || []).length}
            legendeAn={effectiveSettings.legendeObjekte !== false}
            onGotoStatusEinstellungen={() => {
              wechselScreen("einstellungen");
              setTimeout(() => {
                try {
                  window.dispatchEvent(new CustomEvent("allesda:zentrale-sektion",
                    { detail: { id: "statusleiste" } }));
                } catch (err) {}
              }, 60);
              setTimeout(() => {
                const el = document.getElementById("set-handlungsbedarf");
                if (el && el.scrollIntoView) el.scrollIntoView({ block: "start", behavior: "smooth" });
              }, 450);
            }}
            emptyText="Keine Nachrichten für dieses Objekt."
            renderDetail={(veObj) => {
              // Fake-Demo-Daten nur zum Layout-Testen (echte Quelle folgt).
              const kAccent = (effectiveSettings.kacheln.find(k => k.id === "kommunikation") || {}).farbe || "#0EA5E9";
              const demo = [
                { titel: "Einladung Eigentümerversammlung", info: "Serienbrief · an 14 Eigentümer", art: "Brief" },
                { titel: "Rückfrage Heizkostenabrechnung", info: "E-Mail · Hr. Schmidt", art: "E-Mail" },
                { titel: "Info Treppenhausreinigung", info: "Aushang · 03.06.2026", art: "Aushang" },
              ];
              return (
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {demo.map((d, i) => (
                    <div key={i} style={{ background: t.card, border: `1px solid ${t.border}`,
                      borderRadius: RAD.lg, padding: "12px 14px", minWidth: 0,
                      boxSizing: "border-box", width: "100%" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <div style={{ flex: 1, minWidth: 0, fontSize: FS.l, fontWeight: FW.bold,
                          color: t.text, overflowWrap: "anywhere" }}>{d.titel}</div>
                        <div style={{ flexShrink: 0, fontSize: FS.xs, fontWeight: FW.bold,
                          color: getContrastColor(kAccent), background: kAccent,
                          borderRadius: RAD.sm, padding: "2px 8px" }}>{d.art}</div>
                      </div>
                      <div style={{ fontSize: FS.s, color: t.muted, marginTop: 4,
                        overflowWrap: "anywhere" }}>{d.info}</div>
                    </div>
                  ))}
                </div>
              );
            }}/>
        )}
        {!suchErg && screen === "finanzen" && (
          <ObjektListeMitDetail
            ves={vesSichtbar} kontakte={kontakteSichtbar}
            setVes={setVes} setKontakte={setKontakte} t={t}
            accent={(effectiveSettings.kacheln.find(k => k.id === "finanzen") || {}).farbe || "#22C55E"}
            gotoVE={gotoVE} gotoKontakt={gotoKontakt}
            cardWidth={cardWidth} kartenSpalten={kartenSpalten}
            detailMinBreite={detailMinBreite} detailMaxAnteil={detailMaxAnteil} listenAnsicht={effectiveSettings.listenAnsicht}
            viewVEId={finanzenViewVEId} setViewVEId={setFinanzenViewVEId}
            istDesktop={istDesktop}
            titel="Finanzen" anzahl={(vesSichtbar || []).length}
            legendeAn={effectiveSettings.legendeObjekte !== false}
            onGotoStatusEinstellungen={() => {
              wechselScreen("einstellungen");
              setTimeout(() => {
                try {
                  window.dispatchEvent(new CustomEvent("allesda:zentrale-sektion",
                    { detail: { id: "statusleiste" } }));
                } catch (err) {}
              }, 60);
              setTimeout(() => {
                const el = document.getElementById("set-handlungsbedarf");
                if (el && el.scrollIntoView) el.scrollIntoView({ block: "start", behavior: "smooth" });
              }, 450);
            }}
            emptyText="Keine Finanzdaten für dieses Objekt."
            renderDetail={(veObj) => {
              // Fake-Demo-Daten nur zum Layout-Testen (echte Quelle folgt).
              const fiAccent = (effectiveSettings.kacheln.find(k => k.id === "finanzen") || {}).farbe || "#22C55E";
              const demo = [
                { titel: "Wirtschaftsplan 2026", info: "genehmigt · 04.11.2025", art: "WPL" },
                { titel: "Hausgeldabrechnung 2025", info: "in Bearbeitung", art: "HGA" },
                { titel: "Offene Hausgeld-Rückstände", info: "2 Einheiten · 1.240 €", art: "Mahnung" },
              ];
              return (
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {demo.map((d, i) => (
                    <div key={i} style={{ background: t.card, border: `1px solid ${t.border}`,
                      borderRadius: RAD.lg, padding: "12px 14px", minWidth: 0,
                      boxSizing: "border-box", width: "100%" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <div style={{ flex: 1, minWidth: 0, fontSize: FS.l, fontWeight: FW.bold,
                          color: t.text, overflowWrap: "anywhere" }}>{d.titel}</div>
                        <div style={{ flexShrink: 0, fontSize: FS.xs, fontWeight: FW.bold,
                          color: getContrastColor(fiAccent), background: fiAccent,
                          borderRadius: RAD.sm, padding: "2px 8px" }}>{d.art}</div>
                      </div>
                      <div style={{ fontSize: FS.s, color: t.muted, marginTop: 4,
                        overflowWrap: "anywhere" }}>{d.info}</div>
                    </div>
                  ))}
                </div>
              );
            }}/>
        )}
        {!suchErg && screen === "listen" && (
          <ListenGeneratorScreen ves={vesSichtbar} kontakte={kontakteSichtbar} t={t} settings={effectiveSettings}
            accent={(effectiveSettings.kacheln.find(k => k.id === "listen") || {}).farbe || "#0E7490"}/>
        )}
        {!suchErg && screen === "schnelleingabe" && (
          <SchnelleingabeScreen ves={vesSichtbar} setVes={setVes} t={t}
            accent={(effectiveSettings.kacheln.find(k => k.id === "schnelleingabe") || {}).farbe || "#0080FF"}/>
        )}
        {!suchErg && screen === "statistik" && (
          <StatistikScreen ves={vesSichtbar} kontakte={kontakteSichtbar} t={t}
            accent={(effectiveSettings.kacheln.find(k => k.id === "statistik") || {}).farbe || "#6366F1"}/>
        )}
            </div> {/* /contentRef */}
          </div> {/* /maxWidth 1100 */}
        </div>   {/* /Content scroll */}
        {kalDockAktiv ? (
          <KalenderPanel variante="dock" offen={true} onClose={() => setKalDockOffen(false)}
            termine={dockTermine} settings={effectiveSettings} t={t}
            accent={kalenderAccent}
            ves={ves} kontakte={kontakte} setVes={setVes} setKontakte={setKontakte}
            onGotoVE={(id, ziel) => gotoVE(id, ziel)} onGotoKontakt={gotoKontakt}
            onGotoTermin={gotoTermin}/>
        ) : null}
        {!istDesktop ? (
          <KalenderPanel variante="overlay" offen={kalPanelMobilOffen}
            onClose={() => setKalPanelMobilOffen(false)}
            termine={dockTermine} settings={effectiveSettings} t={t}
            accent={kalenderAccent}
            ves={ves} kontakte={kontakte}
            onGotoVE={(id, ziel) => gotoVE(id, ziel)} onGotoKontakt={gotoKontakt}
            onGotoTermin={gotoTermin}/>
        ) : null}
      </div>     {/* /Flex container */}
    </div>
    </KontaktAnzeigeContext.Provider>
    </KontaktFarbeContext.Provider>
    </LoeschenErlaubtContext.Provider>
    </RechnungsadresseContext.Provider>
    </EinheitAnzeigeContext.Provider>
    </ObjektTabsContext.Provider>
    </HandlungsbedarfContext.Provider>
    </ZeitPickerContext.Provider>
    </TerminBezeichnungenContext.Provider>
    </StatusLeisteContext.Provider>
    </KartenBadgesContext.Provider>
    </AvatarIconsContext.Provider>
    </KategorienContext.Provider>
    </VerwendungenContext.Provider>
    </LeistungenContext.Provider>
    </FirmenRollenContext.Provider>
    </RollenContext.Provider>
    </KontakteContext.Provider>
    </TipProvider>
  );
}

// ── Mount: in mount.jsx ausgelagert ─────────────────────────────────────────
// Damit allesda_v5.jsx im Claude-Artifact-Viewer geöffnet werden kann (der
// versteht react-dom/client nicht), liegt der Mount-Block in mount.jsx.
// Der esbuild-Build geht von mount.jsx aus und zieht App von hier mit rein.


// Named exports für zyklischen Import aus components.jsx (S5/S7-Bewohner,
// die von S4-Bausteinen zur Laufzeit gebraucht werden).
export {
  AktionsButton, KontaktDetailKarte, KontaktKarte, ObjektPicker, eigStufen, feldImKalender, istFristFeldName, quoteLabel,
  VerteilerSchluesselBlock, buildInitialKarten, buildInitialVerwaltungsKarten, ergaenzeTechnikGeraetFelder, gemeinschaftName, gemeinschaftVertreter, gemeinschaftZustellAdresse, istEigentuemergemeinschaft, quoteAnteil,
  ANDERE_OPTION, VertragForm, datumsTagMon, intervallMonate, tagsDiffMS,
  DokumenteAnsicht, LiegenschaftAnsicht, VerwaltungAnsicht,
  KARTEN_ICONS, KontaktZuweisungForm
};
