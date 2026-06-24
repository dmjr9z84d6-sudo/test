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
  ACCENT, APP_VERSION, DARK, DEFAULT_GEWERKE_LISTE, DEFAULT_KATEGORIEN, DEFAULT_LEISTUNGEN, DEFAULT_ROLLEN, DEFAULT_VERWENDUNGEN, FIRMEN_FARBE, FONT, FONT_URL, FS, FW, KACHEL_GRID, KACHEL_W, KONTAKTE_FARBE, LIGHT, PALETTE_FARBEN, RAD, SERIOES_GRAU, SLOT_TO_ECK, effColor, effKuerzel, feldInput, feldLabel, formatKontaktName, getContrastColor, iconAufBg, kategorieVon, mischeRichtungGrau, rolleBadgeSichtbar, rolleEckPosition, rolleEckSichtbar, setFarbIntensitaet, sortKontakte, toGrau, verwendungBadgeSichtbar, verwendungEckPosition, verwendungEckSichtbar
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
  KartenIconsContext,
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
  VesContext,
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
  StatusLeiste, VEDetail, VEKachel, VEListenZeile, ObjekteMasterDetail, alleEinheitenVonVe,
  berechneKontaktStatus, hbQuelleAktiv, hbVorlauf
} from "./objektansicht.jsx";
// Kontakt-Kategorien — ausgelagert nach kontakte.jsx (zyklischer Import).
import { VEKontakteTab, objektBezugInfo } from "./kontakte.jsx";
// Universalsuche — ausgelagert nach suche.jsx (Ausbau geplant).
import { SucheFeld, Suchergebnisse } from "./suche.jsx";
// Listen/Statistik/Schnelleingabe-Screens (S6) — aus listen-tools.jsx.
import {
  ListenGeneratorScreen, SchnelleingabeScreen, StatistikScreen
} from "./listen-tools.jsx";
// Kontakte-Modul (S7) — ausgelagert nach kontakte-modul.jsx (zyklischer Import:
// holt seinerseits Vertrags-Karten + Foto-Helfer aus dieser Datei zurück).
import {
  AktionsButton, BeziehungEditor, DetailMobilScrollTop, KDKHeader, KbZurueckHook,
  KontaktDetailKarte, KontaktKarte, KontakteMasterDetail, KontakteScreen,
  ObjektLegende, ObjektPicker, RolleZeile, getFirmaMitarbeiter
} from "./kontakte-modul.jsx";
// Einstellungen-Modul (S8) — ausgelagert nach einstellungen.jsx. Kein Rück-
// import aus dieser Datei nötig (EinstellungenZentrale bleibt im App-Rumpf).
import {
  SEKTIONEN, SektionDashboard, SektionDaten, SektionErscheinungsbild, SektionFilterOpt,
  SektionHV, SektionKalenderPanel, SektionKontakte, SektionObjekte, SektionProfil,
  SektionStatusleiste, SektionSuche, SektionTastatur, TASTATUR_AKTIONEN,
  dateiZuFotoDataUrl, tastaturBelegungVon, useStorageStatus
} from "./einstellungen.jsx";
// Liegenschaft-Kern (S5a) — ausgelagert nach liegenschaft.jsx. Der App-Rumpf
// nutzt nur die Header-/Kachel-Komponenten; kein Rückimport in diese Datei.
import {
  HeaderFilterDropdown, KategorieKacheln, SeitenleisteKacheln
} from "./liegenschaft.jsx";

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
  const setKartenSpalten = settings.kartenSpalten != null ? settings.kartenSpalten : 2;
  const [mdRef, mdLayout] = useMasterDetailLayout(cardWidth, 1.1, 10, 5, true, detailMinBreite, detailMaxAnteil, setKartenSpalten);
  // Sektions-Kacheln neben dem Detail folgen dem Slider „Karten neben dem
  // Detail" (settings.kartenSpalten) — identisch zu Objekte/Kontakte.
  const setKartenCols = Math.max(1, Math.min(setKartenSpalten, mdLayout.masterCols || Math.floor((mdLayout.masterWidth || cardWidth) / 300)));

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
          <div data-ad-auslauf="1" style={{ flex: `0 0 ${mdLayout.masterFest || mdLayout.masterWidth}px`, minWidth: 0, overflowY: "auto",
            padding: 2, boxSizing: "border-box",
            ...(istListe ? { display: "grid", alignContent: "start", gridTemplateColumns: "1fr", gap: 8 } : { ...KACHEL_GRID, alignContent: "start" }) }}>
            {sortierteSektionen.map((s, i) => (
              <SektionKachel key={s.id} sektion={s}
                aktiv={offenSektion && offenSektion.id === s.id} t={t} id={"set-" + s.id}
                onClick={() => setAktSektion(s.id)}/>
            ))}
          </div>
          <div data-ad-auslauf="1" style={{ flex: `1 1 ${mdLayout.detailBreite}px`, minWidth: 0, maxWidth: "100%", overflowY: "auto" }}>
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
          <div style={istListe ? { display: "grid", gridTemplateColumns: "1fr", gap: 10 } : KACHEL_GRID}>
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
          : KACHEL_GRID}>
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

// ObjekteMasterDetail wohnt jetzt in objektansicht.jsx (zyklusfrei) und wird
// von dort importiert. Siehe Import-Block oben.

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
function HeaderProfilButton({ settings, kontakte, screen, suchErg, t, systemAccent, iconAccent, onClick }) {
  // iconAccent: kontrast-gesicherte Icon-Farbe für den Ruhezustand (Fallback
  // auf systemAccent, falls nicht übergeben).
  const ruheAccent = iconAccent || systemAccent;
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
      color={istEinst ? getContrastColor(systemAccent) : ruheAccent}/>;
  } else if (hatFoto) {
    inhalt = <img src={p.foto} alt="" draggable={false} style={{
      width: "100%", height: "100%", objectFit: "cover",
      display: "block", borderRadius: RAD.full, pointerEvents: "none" }}/>;
  } else if (initials) {
    inhalt = <span style={{ fontSize: FS.l, fontWeight: FW.heavy,
      color: istEinst ? getContrastColor(systemAccent) : ruheAccent, lineHeight: 1 }}>{initials}</span>;
  } else {
    inhalt = <I name="user" size={16}
      color={istEinst ? getContrastColor(systemAccent) : ruheAccent}/>;
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
        // Migration: Bevollmächtigter-Kürzel „S" → „BV" (kollidierte mit
        // „Sonstige"). Nur das alte Default-Kürzel umschreiben, vom User
        // bewusst geändertes Kürzel bleibt unangetastet.
        sett.rollen = sett.rollen.map(r =>
          (r && r.name === "Bevollmächtigter" && r.kuerzel === "S")
            ? { ...r, kuerzel: "BV" } : r);
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
        // Dedupe nach id: durch die tickets→auftraege-Umbenennung (oder doppelt
        // gespeicherte Settings) können zwei Kacheln dieselbe id tragen. Erste
        // gewinnt (behält die vom User gewählte Farbe/Reihenfolge/Sichtbarkeit).
        {
          const gesehen = {};
          sett.kacheln = sett.kacheln.filter(k => {
            if (!k || !k.id) return false;
            if (gesehen[k.id]) return false;
            gesehen[k.id] = true;
            return true;
          });
        }
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
      // Sowohl Kontakte als auch VEs laden, dann EINMAL die Einheit-Ableitung
      // über alle Objekte anwenden — synchronisiert besitz/zustaendigkeiten +
      // objektZuweisungen mit der Quelle der Wahrheit (Einheiten). Heilt
      // Altbestand mit rollenlosen/veralteten Zuweisungen sofort beim Start.
      const kGeladen = Array.isArray(daten.kontakte) ? normalisiereKontakte(daten.kontakte) : null;
      const vGeladen = Array.isArray(daten.ves) ? normalisiereVes(daten.ves) : null;
      const vFinal = vGeladen || ves;
      if (kGeladen) setKontakte(wendeKontaktZuweisungenAnAlle(kGeladen, vFinal));
      else setKontakte(prevK => wendeKontaktZuweisungenAnAlle(prevK, vFinal));
      if (vGeladen) setVes(vGeladen);
      if (Array.isArray(daten.freieTermine)) setFreieTermine(daten.freieTermine);
    } else {
      // Keine gespeicherten Daten → DEFAULT-Stand ebenfalls einmal synchronisieren.
      setKontakte(prevK => wendeKontaktZuweisungenAnAlle(prevK, ves));
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

  // Icon-Farbe der Header-Buttons (Mond/Kalender/Profil) im Ruhezustand:
  // systemAccent, aber gegen den Header-Hintergrund kontrast-gesichert. Helle
  // Akzente (Gelb, helles Grün) verschwinden sonst auf dem weißen Hell-Header.
  const headerIconAccent = iconAufBg(systemAccent, t.header);

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
    // Objekt-Legende: steht in ALLEN Zuständen (auch bei offener Karte), damit
    // man jederzeit nachschlagen kann. Ausblendbar via settings.legendeObjekte.
    const objektLegendeEl = (settings.legendeObjekte !== false && gefiltert.length > 0) ? (
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
    ) : null;
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
          <div style={istListe
            ? { display: "flex", flexDirection: "column", gap: 6 }
            : KACHEL_GRID}>
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
        {objektLegendeEl}
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
    <VesContext.Provider value={ves}>
    <RollenContext.Provider value={effectiveSettings.rollen || DEFAULT_ROLLEN}>
    <FirmenRollenContext.Provider value={effectiveSettings.firmenRollen || DEFAULT_GEWERKE_LISTE}>
    <LeistungenContext.Provider value={effectiveSettings.leistungen || DEFAULT_LEISTUNGEN}>
    <VerwendungenContext.Provider value={effectiveSettings.verwendungen || DEFAULT_VERWENDUNGEN}>
    <KategorienContext.Provider value={effectiveSettings.kategorien || DEFAULT_KATEGORIEN}>
    <AvatarIconsContext.Provider value={{
      person: settings.avatarIconsPerson !== false,
      firma:  settings.avatarIconsFirma  !== false
    }}>
    <KartenIconsContext.Provider value={settings.kartenIconsAn !== false}>
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
                    <I name={mode === "dark" ? "sun" : "moon"} size={16} color={headerIconAccent}/>
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
                    color={(istDesktop && kalDockOffen) ? getContrastColor(systemAccent) : headerIconAccent}/>
                </button>
                <HeaderProfilButton settings={settings} kontakte={kontakte} screen={screen}
                  suchErg={suchErg} t={t} systemAccent={systemAccent} iconAccent={headerIconAccent}
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
                  <I name={mode === "dark" ? "sun" : "moon"} size={16} color={headerIconAccent}/>
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
                  color={(istDesktop && kalDockOffen) ? getContrastColor(systemAccent) : headerIconAccent}/>
              </button>
              <HeaderProfilButton settings={settings} kontakte={kontakte} screen={screen}
                suchErg={suchErg} t={t} systemAccent={systemAccent} iconAccent={headerIconAccent}
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
          <SchnelleingabeScreen ves={vesSichtbar} setVes={setVes} kontakte={kontakteSichtbar} t={t}
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
    </KartenIconsContext.Provider>
    </AvatarIconsContext.Provider>
    </KategorienContext.Provider>
    </VerwendungenContext.Provider>
    </LeistungenContext.Provider>
    </FirmenRollenContext.Provider>
    </RollenContext.Provider>
    </VesContext.Provider>
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

