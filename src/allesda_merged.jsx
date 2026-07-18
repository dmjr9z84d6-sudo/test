import React, { useState, useRef, useEffect, createContext, useContext, Fragment } from "react";

// ── FehlerGrenze (Error Boundary) — fängt Render-Fehler in Screen-Details ab,
// damit ein einzelner kaputter Bereich nicht den ganzen Screen schwärzt.
// Zeigt die Fehlermeldung sichtbar an (statt schwarzem Bildschirm).
class FehlerGrenze extends React.Component {
  constructor(props) { super(props); this.state = { fehler: null }; }
  static getDerivedStateFromError(fehler) { return { fehler }; }
  componentDidCatch(fehler, info) {
    try { console.error("FehlerGrenze:", fehler && fehler.message, info && info.componentStack); } catch (e) {}
  }
  render() {
    if (this.state.fehler) {
      const t = this.props.t || {};
      return React.createElement("div", { style: {
        padding: 16, margin: 8, borderRadius: 12,
        background: (t.card || "#1a0000"), border: "1px solid #EF4444",
        color: (t.text || "#fff"), fontSize: 13, lineHeight: 1.5 } },
        React.createElement("div", { style: { fontWeight: 700, color: "#EF4444", marginBottom: 6 } },
          "Dieser Bereich konnte nicht geladen werden."),
        React.createElement("div", { style: { color: (t.sub || "#aaa"), fontSize: 12, whiteSpace: "pre-wrap" } },
          String(this.state.fehler && this.state.fehler.message || this.state.fehler)));
    }
    return this.props.children;
  }
}

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
//                                Einstellungen, Suche, Schnellzugriff)
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
//   │  · sucheAlles                                                       │
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
//   │  · Sektionen: Profil, Erscheinung, Header, Filter, Schnellzugriff,       │
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
  ACCENT, APP_VERSION, DARK, DEFAULT_GEWERKE_LISTE, DEFAULT_KATEGORIEN, DEFAULT_LEISTUNGEN, DEFAULT_ROLLEN, DEFAULT_VERWENDUNGEN, FIRMEN_FARBE, FONT, FONT_URL, FS, FW, KACHEL_GRID, KACHEL_W, kartenGridStyle, KONTAKTE_FARBE, LIGHT, PALETTE_FARBEN, RAD, SERIOES_GRAU, SLOT_TO_ECK, effColor, effKuerzel, feldInput, feldLabel, formatKontaktName, getContrastColor, iconAufBg, kategorieVon, mischeRichtungGrau, rolleBadgeSichtbar, rolleEckPosition, rolleEckSichtbar, setFarbIntensitaet, sortKontakte, toGrau, verwendungBadgeSichtbar, verwendungEckPosition, verwendungEckSichtbar
} from "./constants.js";
import {
  datumDe, isoHeute, istDatumGueltig, istEmailGueltig, istIbanGueltig,
  istPlzGueltig, istSteuerNrGueltig, istTelefonGueltig, istUrlGueltig,
  joinPlzOrt, listeBreiteAus, matchScore, parseDatumWert, splitPlzOrt, zuIsoDatum,
  dateiSpeichern, dateiLoeschen
} from "./utils-basis.js";

import {
  migriereKontaktZuweisungen,
  ANLEGE_FELDTYPEN,
  BELEGUNG_LABEL,
  BELEGUNG_VERWENDUNGEN,
  BEWOHNER_RECHTE,
  DEFAULT_KONTAKTE,
  DEFAULT_SETTINGS, fristenVon, vorlagenVon,
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
  zaehlerArtLabel,
  // §96 Vorgangs-Welt
  leereVorgangsWelt,
  normalisiereVorgangsWelt,
  erzeugeVorgangsSeeds,
  neuerVorgang, vorgangsNummerNeu,
  neueBeteiligung,
  neueNachricht,
  neuerAuftrag,
  weltAuftragFotoRefs, weltAuftragFotoRefEntfernen
} from "./datenmodell.js";

import {
  VorgangsBereichFuerObjekt, VorgangsBereichFuerFirma, VorgangDetail, vorgangAnzahlFuerObjekt,
  SchreibtischBereich, schreibtischBadgeInfo, VorgangNeuOverlay,
  TimelineBereich, DemoHinweis
} from "./vorgang.jsx";

import { EtvBereichFuerObjekt, VersammlungNeuOverlay } from "./etv.jsx";
import { BeschlussSammlungFuerObjekt } from "./beschluss.jsx";


import {
  AvatarIconsContext,
  FristenContext, VorlagenContext, KartenIconsContext,
  DokumenteKartenContext,
  DokumentViewerBgContext,
  DESKTOP_MIN_WIDTH,
  EinheitAnzeigeContext,
  EinheitOffenContext,
  FirmenRollenContext,
  HEADER_FILTER_LEER,
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
  useObjektTabs,
  useOutsideClick,
  useRollen,
  useStatusLeiste,
  useTerminBezeichnungen,
  useVerwendungen,
  useWindowWidth,
  passendeMasterSpalten,
  useContentWidth,
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
  DetailRahmen, objektKopfProps,
  KopfPille,
  MasterDetailRahmen,
  ScreenKopf,
  HeaderZurueck,
  HeaderPlus,
  OverlayKopf, overlayBackdrop, overlayPanel, overlayBody,
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
  legionellenEffektiveNaechste,
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
  KalenderPanel, KalenderScreen, LegionellenTimeline, isoKW, restzeitText, sammleTermine, terminEinheitIds
} from "./kalender.jsx";
// Objekt-Übersicht/-Detail — ausgelagert nach objektansicht.jsx (zyklischer
// Import: holt seinerseits Ansicht-Komponenten aus dieser Datei zurück).
import {
  FeldEinheitKarte, FeldEinheitenSammelKarte, FeldObjektKarte, FilterButtons,
  HANDLUNGSBEDARF_QUELLEN, STAT_WOHN_TYPEN, StatBalkenZeile, StatKpi, StatPanel,
  StatusLeiste, VEDetail, VEKachel, VEListenZeile, FotosAnsicht, HistorieAnsicht,
  LegionellenAnsicht, TERegisterAnsicht, ObjekteMasterDetail, alleEinheitenVonVe,
  ObjektWahlOverlay, FotoUploadModal,
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
  SEKTIONEN, SektionSchnellzugriff, SektionDaten, SektionDokumente, SektionErscheinungsbild, SektionEtv, SektionFilterOpt, SektionVorgaenge,
  SektionHV, SektionKalenderPanel, SektionKontakte, SektionObjekte, SektionProfil,
  SektionStatusleiste, SektionSuche, SektionTastatur, TASTATUR_AKTIONEN,
  dateiZuFotoDataUrl, tastaturBelegungVon, useStorageStatus
} from "./einstellungen.jsx";
// Liegenschaft-Kern (S5a) — ausgelagert nach liegenschaft.jsx. Der App-Rumpf
// nutzt nur die Header-/Kachel-Komponenten; kein Rückimport in diese Datei.
import {
  DokumenteAnsicht, HeaderFilterDropdown, KategorieKacheln, SeitenleisteKacheln, TechnikUebersichtAnsicht, TechnikPflegeAnsicht,
  TechnikGeraetNeuModal, DokumentUploadModal, dokumentUploadAnVe
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
  ves = [], setVes, t, accent, mode, setMode, cardWidth = 340, detailMinBreite = 300, detailMin = null, kartenMaxBreite = 340, kartenMin = 272, listeOpt = null, festeGridSpec = null }) {
  const [aktSektion, setAktSektion] = useState(null);
  // Meldet der Baustein, dass die Liste ganz weg ist (Mobil/eng) → Zurück-Button
  // im Header zeigen.
  const [nurDetail, setNurDetail] = useState(false);
  const windowW = useWindowWidth();
  const istDesktop = windowW >= 900;
  // Sektions-Kacheln folgen dem globalen Liste/Karten-Schalter (Erscheinungsbild).
  const istListe = (settings.listenAnsicht || "karten") === "liste";
  const systemAccent = useKontaktFarbe().system || accent;
  const setKartenSpalten = settings.kartenSpalten != null ? settings.kartenSpalten : 2;
  // Einstellungs-Sektionen folgen dem globalen Spalten-Slider (1–5), genau wie
  // Objekte/Kontakte. Bei ungleicher letzter Kachelzeile bleibt rechts ggf. eine
  // kleine Lücke zum Detail — bewusst akzeptiert (Bennys Entscheidung v12.48),
  // damit der Slider überall gleich wirkt.
  const setWunschCols = Math.max(1, setKartenSpalten);

  // Sprung in eine Sektion von außen (z. B. Tastaturkürzel „?" → Tastatur).
  useEffect(() => {
    const handler = (e) => {
      const id = e && e.detail && e.detail.id;
      if (id && SEKTIONEN.some(s => s.id === id)) setAktSektion(id);
    };
    window.addEventListener("allesda:zentrale-sektion", handler);
    return () => window.removeEventListener("allesda:zentrale-sektion", handler);
  }, []);

  // Auto-Scroll zur aufgeklappten Karte NUR auf Mobil (dort ersetzt das Detail
  // die Liste, man will oben starten). Auf Desktop bleibt die Liste neben dem
  // Detail stehen — KEIN Scroll, sonst springt die Liste beim Klick (unruhig).
  useEffect(() => {
    if (aktSektion && !istDesktop) {
      scrollToCard("set-" + aktSektion);
    }
  }, [aktSektion, istDesktop]);

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
  // Kachel-Bindung (Farbe + Icon aus EINER Quelle = Schnellzugriff-Kacheln).
  // Achtung ID-Falle — Sektion "vorgaenge" hängt an Kachel "auftraege".
  const kachelVon = (id) => (settings.kacheln || []).find(k => k.id === id) || {};
  const kontaktAccent = kachelVon("kontakte").farbe || "#A855F7";
  // farbeVoll = die echte (nicht grau-gemappte) Sektionsfarbe. Wird für die
  // Auswahl-Hervorhebung (aktiver Kachel-Rahmen + Detail-Rahmen) genutzt, damit
  // die ausgewählte Sektion auch im "Weniger Farbe"-Modus farbig umrandet ist.
  // Der restliche Inhalt (Icon, Titel, Tint) nutzt weiter farbe (ggf. grau).
  // SEKTION_ZU_KACHEL: welche Einstellungs-Sektion hängt an welcher Kachel.
  const SEKTION_ZU_KACHEL = {
    objekte: "objekte", kontakte: "kontakte", etv: "etv",
    vorgaenge: "auftraege", kalender: "kalender", dokumente: "dokumente",
  };
  let sortierteSektionen = SEKTIONEN.map(s => {
    // SONDERFALL: Profil = Personen-Spezialfall → Kontakte-Farbe, eigenes Icon.
    if (s.id === "profil") return { ...s, farbe: kontaktAccent, farbeVoll: kontaktAccent };
    if (s.id === "daten")  return { ...s, farbe: systemAccent,  farbeVoll: systemAccent };
    const kId = SEKTION_ZU_KACHEL[s.id];
    if (kId) {
      const k = kachelVon(kId);
      const f = k.farbe || s.farbe;
      return { ...s, farbe: f, farbeVoll: f, icon: k.icon || s.icon };
    }
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
        {s.id === "vorgaenge"   && <SektionVorgaenge settings={settings} setSettings={setSettings} t={t} accent={s.farbe}/>}
        {s.id === "etv"         && <SektionEtv settings={settings} setSettings={setSettings} t={t} accent={s.farbe}/>}
        {s.id === "filter"      && <SektionFilterOpt settings={settings} setSettings={setSettings} t={t} accent={s.farbe} ves={ves} kontakte={kontakte}/>}
        {s.id === "kalender"    && <SektionKalenderPanel settings={settings} setSettings={setSettings} t={t} accent={s.farbe}/>}
        {s.id === "dokumente"   && <SektionDokumente settings={settings} setSettings={setSettings} t={t} accent={s.farbe}/>}
        {s.id === "schnellzugriff"   && <SektionSchnellzugriff settings={settings} setSettings={setSettings} t={t} accent={s.farbe}/>}
        {s.id === "suche"       && <SektionSuche settings={settings} setSettings={setSettings} t={t} accent={s.farbe}/>}
        {s.id === "tastatur"    && <SektionTastatur settings={settings} setSettings={setSettings} t={t} accent={s.farbe}/>}
        {s.id === "hv"          && <SektionHV settings={settings} setSettings={setSettings} t={t} accent={s.farbe}/>}
        {s.id === "daten"       && <SektionDaten t={t} accent={systemAccent}
          settings={settings} setSettings={setSettings} mode={mode} setMode={setMode}
          kontakte={kontakte} setKontakte={setKontakte} ves={ves} setVes={setVes}/>}
      </div>
    );
  };

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

  // Master = Sektions-Kacheln (Funktion(layout) für Karten-Spalten). In der
  // Übersicht ohne offene Sektion bleibt die Breite über listeBreiteAus gedeckelt
  // (Liste-Modus) bzw. nutzt das feste Grid (Karten-Modus).
  const sektionsGrid = (layout, alsMaster) => (
    <div style={istListe
      ? (alsMaster
          ? { display: "grid", alignContent: "start", gridTemplateColumns: "1fr", gap: 8 }
          : { display: "grid", gridTemplateColumns: "1fr", gap: 10, maxWidth: listeBreiteAus(listeOpt), width: "100%" })
      : (alsMaster
          ? kartenGridStyle({ einspaltig: !istDesktop, nurMaster: false, cols: layout.cols, kartenBreite: layout.kartenBreite }, { alignContent: "start" })
          : kartenGridStyle({ einspaltig: !istDesktop, nurMaster: true, kartenMaxBreite: KACHEL_W, festeGridSpec: festeGridSpec }))}>
      {sortierteSektionen.map((s) => (
        <SektionKachel key={s.id} sektion={s}
          aktiv={offenSektion && offenSektion.id === s.id} t={t} id={"set-" + s.id}
          onClick={() => setAktSektion(s.id)}/>
      ))}
    </div>
  );

  return (
    <div style={istDesktop
      ? { flex: 1, minHeight: 0, minWidth: 0, display: "flex", flexDirection: "column" }
      : { display: "flex", flexDirection: "column" }}>
      {/* Section-Header — Titel links, „Zurück"-Button rechts (ohne Pfeil),
          sobald die Liste weicht (Mobil/eng). Der Baustein meldet diesen
          Zustand via onNurDetail. */}
      <StickySectionHeader t={t} accent={accent}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, width: "100%" }}>
          <div style={{ fontSize: FS.xxl, fontWeight: FW.heavy, color: t.text,
            userSelect: "none" }}>
            Einstellungen
          </div>
          {offenSektion && nurDetail && (
            <div style={{ marginLeft: "auto" }}>
              <HeaderZurueck onClick={() => setAktSektion(null)} t={t}/>
            </div>
          )}
        </div>
      </StickySectionHeader>

      {/* Master-Detail über den kanonischen Baustein (§75). Master = Sektions-
          Kacheln; Detail nur bei offener Sektion. Weicht die Liste, meldet der
          Baustein nurDetail → Zurück-Button erscheint oben im Header. */}
      <MasterDetailRahmen
        master={(layout) => sektionsGrid(layout, !!offenSektion)}
        detail={offenSektion ? renderSektionDetail(offenSektion) : null}
        mobilDetail={offenSektion ? renderSektionDetail(offenSektion) : null}
        onNurDetail={setNurDetail}
        istDesktop={istDesktop}
        listenAnsicht={settings.listenAnsicht || "karten"} listeOpt={listeOpt}
        kartenSpalten={setWunschCols} kartenMaxBreite={kartenMaxBreite}
        kartenMin={kartenMin} detailMinBreite={detailMinBreite} detailMin={detailMin}/>
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
  gotoVE, gotoKontakt, cardWidth = 280, kartenSpalten = 2, detailMinBreite = 300, detailMin = null, kartenMaxBreite = 340, kartenMin = 272, listeOpt = null,
  listenAnsicht = "karten", viewVEId = null, setViewVEId = null, festeGridSpec = null,
  renderDetail = null, istDesktop = true, emptyText = "Keine Einträge.",
  detailAktion = null, masterBadge = null, kopfMitte = null, kopfPlus = null,
  titel = "", anzahl = null, legendeAn = false, onGotoStatusEinstellungen = null,
  statusKontext = null }) {
  const offenVEObj = (ves || []).find(v => v.id === viewVEId) || null;
  // Im Mobil-Detail (Objekt offen, kein Desktop-Nebeneinander) zeigt der Header
  // einen „Zurück"-Button — analog zum Objekte-Tab. Zusätzlich meldet der
  // Master-Detail-Baustein (über onNurDetail), wenn auf Desktop das Fenster so
  // eng wird, dass die Liste ganz weicht (cols===0) — dann braucht der Header
  // ebenfalls den Zurück-Button.
  const [nurDetail, setNurDetail] = React.useState(false);
  const istMobileDetail = offenVEObj && !istDesktop;
  const zeigeZurueck = istMobileDetail || (offenVEObj && nurDetail);
  const header = (
    <ScreenKopf t={t} accent={accent} titel={titel}
      onTitelClick={() => setViewVEId && setViewVEId(null)}
      mitte={(kopfMitte || anzahl != null) ? (
        // §95: optionaler kopfMitte-Slot (z. B. KopfPille Timeline⇄Objekte)
        // VOR der Anzahl-Pille — ohne kopfMitte exakt das bisherige Bild.
        <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
          {kopfMitte}
          {anzahl != null ? (
            <div style={{ display: "inline-flex", alignItems: "center", gap: 6,
              background: t.card, border: `1px solid ${t.border}`, borderRadius: RAD.pill,
              padding: "3px 10px", flexShrink: 0 }}>
              <span style={{ fontSize: FS.s, fontWeight: FW.bold, color: t.sub }}>WEG</span>
              <span style={{ fontSize: FS.s, fontWeight: FW.heavy, color: t.text }}>{anzahl}</span>
            </div>
          ) : null}
        </div>
      ) : null}
      rechts={(kopfPlus || zeigeZurueck) ? (
        // §Plus-Buttons: HeaderPlus (kanonisch) + ggf. Zurück — gleiche
        // Anordnung wie im Vorgänge-Screen (Plus links, Zurück rechts).
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {kopfPlus ? (
            <HeaderPlus onClick={kopfPlus.onClick} accent={accent}
              title={kopfPlus.title || "Neu"} t={t}/>
          ) : null}
          {zeigeZurueck ? (
            <HeaderZurueck onClick={() => setViewVEId && setViewVEId(null)} t={t}/>
          ) : null}
        </div>
      ) : null}/>
  );
  // Detail-Override-Wrapper: einheitliche Detail-Hülle (Objektkopf + Inhalt),
  // identisch zum Kalender-Muster (renderTerminDetail).
  const renderDetailOverride = (veObj) => {
    if (!veObj) return null;
    return (
      <DetailRahmen t={t} accent={accent} {...objektKopfProps(veObj)}
        aktion={detailAktion ? detailAktion(veObj) : null}>
        {renderDetail ? renderDetail(veObj) : (
          <div style={{ fontSize: FS.m, color: t.muted, fontStyle: "italic", padding: "8px 2px" }}>
            {emptyText}
          </div>
        )}
      </DetailRahmen>
    );
  };
  // Mit offenem Objekt: dasselbe Master-Detail-Gerüst wie Objekte/Kontakte/
  // Kalender. Auf Mobil liefert ObjekteMasterDetail automatisch den Fallback
  // (Detail voll + „Zurück zur Liste"-Button); kein eigener Mobil-Pfad.
  if (offenVEObj) {
    return (
      <>
        {header}
        {legendeAn && (ves || []).length > 0 && (
          <ObjektLegende ves={ves} t={t} accent={accent}
            listenAnsicht={listenAnsicht}
            onGotoHandlungsbedarf={onGotoStatusEinstellungen || undefined}/>
        )}
        <div data-ad-scroll="y" data-ad-auslauf="1" style={{ display: "flex",
          flexDirection: istDesktop ? "row" : "column", flex: 1, minHeight: 0,
          minWidth: 0, width: "100%", boxSizing: "border-box" }}>
          <ObjekteMasterDetail
            listenAnsicht={listenAnsicht}
            cardWidth={cardWidth}
            detailMinBreite={detailMinBreite} detailMin={detailMin} kartenMaxBreite={kartenMaxBreite} kartenMin={kartenMin} listeOpt={listeOpt}
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
            masterBadge={masterBadge}
            onNurDetail={setNurDetail}
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
          ? { display: "flex", flexDirection: "column", gap: 6, maxWidth: listeBreiteAus(listeOpt), width: "100%" }
          : kartenGridStyle({ einspaltig: !istDesktop, nurMaster: true, kartenMaxBreite: KACHEL_W, festeGridSpec: festeGridSpec })}>
          {(ves || []).map(veObj => listenAnsicht === "liste" ? (
            <VEListenZeile key={veObj.id} ve={veObj} t={t} accent={accent}
              aktiv={false} kbItem id={"objliste-" + veObj.id}
              auswahlAccentOverride={accent} statusKontext={statusKontext}
              extraBadge={masterBadge ? masterBadge(veObj) : null}
              onClick={() => setViewVEId && setViewVEId(veObj.id)}/>
          ) : (
            <VEKachel key={veObj.id} ve={veObj} t={t} accent={accent}
              aktiv={false} kbItem id={"objliste-" + veObj.id}
              auswahlAccentOverride={accent} statusKontext={statusKontext}
              extraBadge={masterBadge ? masterBadge(veObj) : null}
              onClick={() => setViewVEId && setViewVEId(veObj.id)}/>
          ))}
        </div>
      </div>
    </>
  );
}

// ObjekteMasterDetail wohnt jetzt in objektansicht.jsx (zyklusfrei) und wird
// von dort importiert. Siehe Import-Block oben.

// ── DokumenteScreenDetail ──────────────────────────────────────────────────
// Detail-Inhalt des Dokumente-HAUPTSCREENS (linke Navigation → Dokumente).
// Zeigt rechts die ECHTE DokumenteAnsicht des gewählten Objekts — exakt
// dieselbe Komponente wie im Objekt-Dokumente-Tab (Baustein-Regel: ein
// Dokumente-Inhalt, kein Zweitbau). Da der Hauptscreen keinen globalen
// Bearbeiten-Schalter hat, hält dieser Wrapper einen EIGENEN lokalen editMode
// + Bearbeiten-Toggle, damit Upload/Bearbeiten direkt hier möglich ist.
function DokumenteScreenDetail({ ve, setVes, t, accent, kontakte, setKontakte, gotoKontakt, ves, editMode = false }) {
  return (
    <DokumenteAnsicht ve={ve} setVes={setVes} t={t} accent={accent}
      kontakte={kontakte} setKontakte={setKontakte} editMode={editMode}
      onKontaktClick={gotoKontakt} ves={ves}/>
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
  // Einstellungen → Schnellzugriff gewählte Farbe sofort auf VE-Karten, Buttons,
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
  // Vorgangs-Welt (§96): neun flache Listen (Vorgänge, Aufträge, Nachrichten,
  // Beteiligungen, Angebote, Abnahmen, Rechnungen, Aufgaben, Beschlüsse) in
  // EINEM Container — objektübergreifend wie freieTermine, gespiegelt gegen
  // das Supabase-Schema C2–C4 (Migration 1:1).
  const [vorgangsWelt, setVorgangsWelt] = useState(() => leereVorgangsWelt());
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
        // Migration (v12.25): slotlose Rollen nachrüsten. Default-Rollen erhalten
        // ihren bekannten Slot aus DEFAULT_ROLLEN; selbst angelegte Rollen ohne
        // Slot (z. B. „VBR") wandern ins Gremium, damit sie in der Gremium-Gruppe
        // erscheinen statt durch alle Kontakt-Gruppen zu fallen.
        {
          const slotVonDefault = {};
          DEFAULT_ROLLEN.forEach(d => { if (d && d.name) slotVonDefault[d.name] = d.slot; });
          sett.rollen = sett.rollen.map(r => {
            if (!r || r.slot) return r;
            const s = slotVonDefault[r.name] || "gremium";
            return { ...r, slot: s };
          });
        }
        const vorhandeneNamen = sett.rollen.map(r => r && r.name);
        const fehlende = DEFAULT_ROLLEN.filter(r => vorhandeneNamen.indexOf(r.name) < 0);
        if (fehlende.length > 0) sett.rollen = [...sett.rollen, ...fehlende];
      }
      // Gleiches Muster für Schnellzugriff-Kacheln: neue Default-Kacheln (z. B.
      // Statistik, Listengenerator, Fotos) hinten anhängen, sonst fehlen sie
      // bei Bestands-Settings nach App-Updates.
      if (Array.isArray(sett.kacheln)) {
        // Migration: frühere „Tickets"- bzw. „Aufträge"-Kachel heißt jetzt
        // „Vorgänge". Alte gespeicherte id/label umschreiben, sonst entstünde
        // eine Dublette (alt „tickets" bleibt + neu „auftraege" wird angehängt)
        // bzw. bliebe das veraltete Label „Aufträge" stehen.
        sett.kacheln = sett.kacheln.map(k => {
          if (!k) return k;
          if (k.id === "tickets") return { ...k, id: "auftraege", label: "Vorgänge" };
          // Bestands-User mit auftraege-Kachel: nur das veraltete Default-Label
          // „Aufträge" auf „Vorgänge" heben (eigene Umbenennungen NICHT anfassen).
          if (k.id === "auftraege" && k.label === "Aufträge") return { ...k, label: "Vorgänge" };
          return k;
        });
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
        // Einmal-Migration (v13.53): Technik + Dokumente waren als Platzhalter
        // per Default unsichtbar; ab jetzt zeigen sie echte Inhalte → einmalig
        // sichtbar schalten. Das Flag sorgt dafür, dass eine SPÄTERE bewusste
        // Deaktivierung durch den Nutzer nie wieder überschrieben wird.
        if (!sett.kachelnMigSichtbarV1353) {
          sett.kacheln = sett.kacheln.map(k =>
            (k && (k.id === "technik" || k.id === "dokumente") && k.aktiv === false)
              ? { ...k, aktiv: true } : k);
          sett.kachelnMigSichtbarV1353 = true;
        }
      }
      // Migration (v12.88): tote Suchkategorien „adressen" + „vertraege" aus
      // Bestands-Settings entfernen. Die Universalsuche durchsucht real nur
      // Objekte + Kontakte; Adressen stecken bereits in den Objekt-Treffern,
      // „Verträge" hatte nie einen eigenen Such-Branch. Sonst blieben die toten
      // Schalter bei Bestands-Usern sichtbar. Nur die zwei bekannten id's filtern.
      if (Array.isArray(sett.suchKategorien)) {
        const tot = { adressen: true, vertraege: true };
        sett.suchKategorien = sett.suchKategorien.filter(k => k && !tot[k.id]);
      }
      // Gleiches Muster für Objekt-Tabs: neue Default-Tabs (z. B. „Legionellen",
      // eingeführt in v11.67) in Bestands-Settings nachrüsten — sonst kann das
      // Tab nie erscheinen, weil die gespeicherte objektTabs-Config den Eintrag
      // gar nicht enthält (unabhängig vom Warmwasser-Schalter). Reihenfolge des
      // Defaults übernehmen; vorhandene Tabs bleiben unverändert.
      if (Array.isArray(sett.objektTabs)) {
        // Alte Tab-id „bilder" (vor v13.46 umbenannt in „fotos") aus gespeicherten
        // Configs werfen — sonst bleibt der tote Tab neben dem neuen stehen.
        sett.objektTabs = sett.objektTabs.filter(x => !(x && x.id === "bilder"));
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
      // Legende: zwei alte Schalter (legendeKontakte/legendeObjekte) → EIN Schalter
      // legendeAn (v12.82). Nur migrieren, wenn der neue Key noch fehlt: an, wenn
      // BEIDE alten an waren (Default an).
      if (sett.legendeAn == null && (sett.legendeKontakte != null || sett.legendeObjekte != null)) {
        sett.legendeAn = (sett.legendeKontakte !== false) && (sett.legendeObjekte !== false);
      }
      // Schrumpf: zwei alte Werte (listeSchrumpf/detailSchrumpfListe) → EIN Wert
      // schrumpfProzent (v12.82), gleicher % für Liste UND Detail. Nur wenn neuer
      // Key fehlt: alten Listen-Wert übernehmen (sonst Detail-Wert, sonst Default).
      if (sett.schrumpfProzent == null && (sett.listeSchrumpf != null || sett.detailSchrumpfListe != null)) {
        sett.schrumpfProzent = sett.listeSchrumpf != null ? sett.listeSchrumpf
          : (sett.detailSchrumpfListe != null ? sett.detailSchrumpfListe : 25);
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
      // Vorgangs-Welt (§96): gespeicherte Welt normalisiert übernehmen. Gibt es
      // noch keine (Bestand vor v13.57), EINMAL Demo-Seeds an die echten
      // Objekte hängen (alle demo:true, gesammelt entfernbar). Danach ist die
      // Welt — auch geleert — im Storage vorhanden, Seeds kommen nie doppelt.
      if (daten.vorgangsWelt && typeof daten.vorgangsWelt === "object") {
        setVorgangsWelt(normalisiereVorgangsWelt(daten.vorgangsWelt));
      } else {
        const seeds = erzeugeVorgangsSeeds(vFinal, kGeladen || kontakte);
        if (seeds) setVorgangsWelt(normalisiereVorgangsWelt(seeds));
      }
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
    storage.speichereDaten({ kontakte, ves, freieTermine, vorgangsWelt });
  }, [kontakte, ves, freieTermine, vorgangsWelt, storageGeladen]);
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
  const detailMinBreite = Math.max(400, Math.min(1400,
    settings.detailMinBreite != null ? settings.detailMinBreite : 400));
  // NEUES MODELL (v12.29): Karten haben eine MAXIMALBREITE (dehnen sich nie
  // darüber, Freiraum bleibt rechts) und eine prozentuale Schrumpf-Toleranz
  // (wie weit sie unter Max gedrückt werden dürfen, bevor eine Spalte wegfällt).
  const kartenMaxBreite = Math.max(240, Math.min(480,
    settings.kartenMaxBreite != null ? settings.kartenMaxBreite : 340));
  const kartenSchrumpf = Math.max(0, Math.min(50,
    settings.kartenSchrumpf != null ? settings.kartenSchrumpf : 20));
  // Mindest-Kartenbreite = Max × (1 − Toleranz). Untergrenze 160px Sicherheit.
  const kartenMinBreiteEff = Math.max(160, Math.round(kartenMaxBreite * (1 - kartenSchrumpf / 100)));
  // Mindest-DETAILbreite (Karten-Modus, v12.47): das Detailfenster darf bei
  // Platzmangel mit DERSELBEN Schrumpf-Toleranz wie die Karten schrumpfen
  // (Bennys Entscheidung). Untergrenze 400px für Lesbarkeit des Detail-Inhalts.
  const detailMinBreiteEff = Math.max(400, Math.round(detailMinBreite * (1 - kartenSchrumpf / 100)));
  const kartenSpalten = settings.kartenSpalten != null ? settings.kartenSpalten : 2;
  // ÜBERSICHT FESTE SPALTENZAHL (v12.31, Schalter): Wenn an, zeigt auch die
  // frische Übersicht (ohne offenes Detail) IMMER genau kartenSpalten Spalten
  // auf Karten-Maxbreite — die Karten springen beim Öffnen nicht mehr, und das
  // Detail geht überall an derselben x-Position auf (Master-Breite konstant).
  // Wenn aus: bisheriges auto-fill (so viele Spalten wie passen).
  const festeSpalten = settings.festeSpalten !== false;
  // gridTemplateColumns-Wert für die feste Übersicht (oder null = KACHEL_GRID).
  const festeGridSpec = festeSpalten
    ? `repeat(${kartenSpalten}, ${kartenMaxBreite}px)` : null;
  // LISTE-MODUS (v12.30): eigene, von den Karten getrennte Regler. Liste und
  // Detail haben je Max-Breite + Schrumpf-% → Min. Schrumpf-Reihenfolge bei
  // engem Platz: erst Liste, dann Detail, dann Liste ganz weg (Nur-Detail).
  const istListenModus = (effectiveSettings.listenAnsicht || "karten") === "liste";
  const listeBreiteMax = Math.max(280, Math.min(720,
    settings.listeBreite != null ? settings.listeBreite : 400));
  // Schrumpf (v12.82): EIN Wert schrumpfProzent für Liste UND Detail. Fallback
  // auf die alten getrennten Keys, solange noch nicht migriert.
  const schrumpfProz = Math.max(0, Math.min(50,
    settings.schrumpfProzent != null ? settings.schrumpfProzent
      : (settings.listeSchrumpf != null ? settings.listeSchrumpf : 25)));
  const listeBreiteMin = Math.max(160, Math.round(listeBreiteMax * (1 - schrumpfProz / 100)));
  const detailBreiteListeMax = Math.max(400, Math.min(1400,
    settings.detailBreiteListe != null ? settings.detailBreiteListe : 540));
  const detailBreiteListeMin = Math.max(300, Math.round(detailBreiteListeMax * (1 - schrumpfProz / 100)));
  // listeOpt: kompaktes Objekt, das die Module unverändert an useMasterDetailLayout
  // durchreichen. null im Karten-Modus → Karten-Zweig greift.
  const listeOpt = istListenModus ? {
    listeMax: listeBreiteMax, listeMin: listeBreiteMin,
    detailMax: detailBreiteListeMax, detailMin: detailBreiteListeMin
  } : null;
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
  const [etvAkteId, setEtvAkteId] = useState(null); // offene ETV-Akte (§2b)
  // Screen-Plus (Kalender-Prinzip): Objektwahl-Overlay für „Neu anlegen" ohne
  // offene Akte. Ziel steuert, welches Formular nach der Wahl startet.
  // §12.8 Screen-Plus: die vier gehosteten Anlege-Dialoge (Objektwahl IM
  // Dialog, Vorgänge-Muster). Kein Vorschalt-Fenster, keine Signal-Props mehr.
  const [etvNeuOffen, setEtvNeuOffen] = useState(false);         // VersammlungNeuOverlay
  const [technikEditSignal, setTechnikEditSignal] = useState(0);   // Stift → editMode
  const [technikNeuKarteSignal, setTechnikNeuKarteSignal] = useState(0); // Plus → neue Karte
  const [plusWahlTechnik, setPlusWahlTechnik] = useState(false);   // Technik-Plus ohne Objekt → Objektwahl
  const [dokNeuOffen, setDokNeuOffen] = useState(false);         // DokumentUploadModal
  const [fotoNeuOffen, setFotoNeuOffen] = useState(false);       // FotoUploadModal
  const [kommPlusHinweis, setKommPlusHinweis] = useState(false); // Kommunikation: Modul folgt
  const [auftragViewVEId, setAuftragViewVEId] = useState(null);
  // Sprung vom Schreibtisch (§96.8): dieser Vorgang wird beim Öffnen des
  // Objekt-Details direkt aufgeklappt (initialOffeneId + key-Remount).
  const [auftragSprungId, setAuftragSprungId] = useState(null);
  // Erfassen-Overlay (§96/Etappe 4): offen nur mit gewähltem Objekt.
  const [auftragNeuOffen, setAuftragNeuOffen] = useState(false);
  // Vorgänge-Pille (Benny v12.36): "objekt" → Vorgänge je Objekt; "firma" →
  // Vorgänge je Firma (alle Firmen-Kontakte). Eigener Auswahl-State je Achse.
  const [auftragView, setAuftragView] = useState("objekt"); // "objekt" | "firma"
  const [auftragFirmaId, setAuftragFirmaId] = useState(null);
  const [auftragNurDetail, setAuftragNurDetail] = useState(false);
  // Feinschliff 11.07. (Skizze): geöffnete Vorgangs-AKTE — hebt das
  // Master-Detail eine Ebene hoch (Vorgangsliste = Master, Akte = Detail).
  const [vorgangAkteId, setVorgangAkteId] = useState(null);
  const [beschlussViewVEId, setBeschlussViewVEId] = useState(null);
  const [technikViewVEId, setTechnikViewVEId] = useState(null);
  const [dokumenteViewVEId, setDokumenteViewVEId] = useState(null);
  // Bearbeiten-Modus des Dokumente-Hauptscreens — liegt hier (nicht im
  // DokumenteScreenDetail), damit der Stift-Button im DetailRahmen-Header
  // (aktion-Slot) sitzt, wie bei allen anderen Detail-Screens.
  const [dokumenteEditMode, setDokumenteEditMode] = useState(false);
  const [fotosViewVEId, setFotosViewVEId] = useState(null);
  const [fotosEditMode, setFotosEditMode] = useState(false);
  const [legionellenViewVEId, setLegionellenViewVEId] = useState(null);
  const [legionellenEditMode, setLegionellenEditMode] = useState(false);
  // §95: Sicht-Umschalter der Legionellen-Kachel (KopfPille wie im Kalender):
  // "objekte" = bestehende Master-Detail-Erfassung, "timeline" = objektüber-
  // greifende Fälligkeits-Übersicht. Default "objekte" — bestehendes Verhalten
  // der Kachel bleibt unverändert; View bleibt (wie kalView) über Screen-
  // Wechsel hinweg erhalten.
  const [legionellenView, setLegionellenView] = useState("objekte");
  // §95: Auswahl-State der Timeline-Sicht (controlled, Kalender-Muster) +
  // nurDetail-Meldung des MasterDetailRahmen für den Header-Zurück.
  const [legionellenTimelineKey, setLegionellenTimelineKey] = useState(null);
  const [legionellenNurDetail, setLegionellenNurDetail] = useState(false);
  const [teViewVEId, setTeViewVEId] = useState(null);
  const [historieViewVEId, setHistorieViewVEId] = useState(null);
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
  // Meldet der Baustein, dass die Liste ganz weg ist (Mobil/eng) → im Header
  // den +Button gegen einen pfeillosen Zurück-Button tauschen.
  const [kontaktNurDetail, setKontaktNurDetail] = useState(false);
  const [objektNurDetail, setObjektNurDetail] = useState(false);
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
    // Objektlisten-Screens (Schnellzugriff): erneuter Klick auf den Menüpunkt
    // schließt das offene Objekt — gleiches Verhalten wie Objekte/Kontakte.
    else if (screenId === "dokumente") { setDokumenteViewVEId(null); setDokumenteEditMode(false); }
    else if (screenId === "fotos") { setFotosViewVEId(null); setFotosEditMode(false); }
    else if (screenId === "technik") setTechnikViewVEId(null);
    else if (screenId === "legionellen") { setLegionellenViewVEId(null); setLegionellenEditMode(false); setLegionellenTimelineKey(null); }
    else if (screenId === "te") setTeViewVEId(null);
    else if (screenId === "etv") { setEtvViewVEId(null); setEtvAkteId(null); }
    else if (screenId === "historie") setHistorieViewVEId(null);
    else if (screenId === "kommunikation") setKommunikationViewVEId(null);
    else if (screenId === "finanzen") { if (typeof setFinanzenViewVEId === "function") setFinanzenViewVEId(null); }
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

  // ── Browser-/Wisch-Zurück auf Screen-Ebene (v13.44) ──────────────────────
  // Die App ist eine SPA ohne Routing → der iPhone-Wisch-Zurück würde ohne das
  // hier komplett aus der App fliegen. Wir spiegeln AUSSCHLIESSLICH die eine
  // zentrale Achse `screen` in die Browser-History. Details/Modals/Unter-Tabs
  // (HeaderZurueck §75.5, MasterDetailRahmen/onNurDetail §75, kalNurDetail-Fix)
  // bleiben UNBERÜHRT und regeln ihr Zurück wie bisher — History kennt sie
  // nicht, daher kein Widerspruch. Verhalten: „nur Screen" (Variante B) — ein
  // Zurück wechselt immer direkt den Screen, offene Details werden nicht als
  // eigener Zwischenschritt behandelt. Am „Boden" (Start-Screen) bleibt die App
  // offen statt zu schließen (Boden-Eintrag wird re-gepusht).
  //
  // Ein useEffect auf `screen` führt die History, damit es EGAL ist, welcher
  // Aufrufer den Screen ändert (wechselScreen / gotoVE / gotoTermin / …).
  // vonPopstateRef verhindert, dass ein durch popstate ausgelöstes setScreen
  // erneut pusht (sonst Endlosschleife / History-Stau).
  const vonPopstateRef = useRef(false);
  const historyInitRef = useRef(false);
  useEffect(() => {
    if (typeof window === "undefined" || !window.history) return;
    // Boden-Eintrag: liegt UNTER dem Start-Screen, damit der erste Zurück-Wisch
    // nicht aus der App führt. Nur einmal beim Mount.
    if (!historyInitRef.current) {
      historyInitRef.current = true;
      try {
        window.history.replaceState({ adScreen: "objekte", adBoden: true }, "");
      } catch (err) {}
    }
    const onPop = (e) => {
      const st = (e && e.state) || null;
      const zielScreen = (st && st.adScreen) || "objekte";
      // Am Boden angekommen: Boden-Eintrag re-pushen → App bleibt offen (nie
      // rausfliegen), statt dass der Browser das PWA-Fenster schließt.
      if (st && st.adBoden) {
        try { window.history.pushState({ adScreen: "objekte", adBoden: true }, ""); } catch (err) {}
      }
      vonPopstateRef.current = true;
      setScreen(zielScreen);
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  // Vorwärts-Wechsel: bei JEDER `screen`-Änderung einen History-Eintrag pushen —
  // außer die Änderung kam gerade durch popstate (dann nur Flag zurücksetzen).
  useEffect(() => {
    if (typeof window === "undefined" || !window.history) return;
    if (vonPopstateRef.current) { vonPopstateRef.current = false; return; }
    // Kein Doppel-Eintrag, wenn der aktuelle Top-State schon dieser Screen ist
    // (z. B. erneuter Klick auf denselben Menüpunkt).
    const st = window.history.state;
    if (st && st.adScreen === screen && !st.adBoden) return;
    try { window.history.pushState({ adScreen: screen }, ""); } catch (err) {}
  }, [screen]);

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
  // Gemeinsame Objekt-Legende für die Pille-Screens (Statistik, Listengenerator,
  // Schnelleingabe). Wird als legendeEl-Prop übergeben — so steht die Legende auf
  // ALLEN Master-Detail-Screens gleich (kein eigener Nachbau je Screen, kein
  // Import-Zyklus listen-tools→kontakte-modul). Ausblendbar via legendeObjekte.
  // Zentraler Sprung zur Handlungsbedarf-Einstellung (eine Quelle statt je Screen
  // kopierter dispatchEvent-Block). Nutzt den vorhandenen goto-einstellungen-Handler.
  const springHandlungsbedarf = () => {
    try {
      window.dispatchEvent(new CustomEvent("allesda:goto-einstellungen",
        { detail: { sektion: "statusleiste", anker: "set-handlungsbedarf" } }));
    } catch (err) {}
  };
  const baueObjektLegende = (legAccent) =>
    (legendeSichtbar(settings) && (vesSichtbar || []).length > 0) ? (
      <ObjektLegende ves={vesSichtbar} t={t} accent={legAccent}
        listenAnsicht={effectiveSettings.listenAnsicht}
        onGotoHandlungsbedarf={springHandlungsbedarf}/>
    ) : null;
  // Termine für die Kalender-Seitenleiste (Desktop-Dock) — inkl. 12 Monate
  // Rückblick. Memoisiert, da sammleTermine bei jedem App-Render teuer wäre.
  // WICHTIG: muss NACH istDesktop + vesSichtbar stehen (const-Hoisting/TDZ).
  const dockTermine = React.useMemo(
    () => (kalDockAktiv || (!istDesktop && kalPanelMobilOffen))
      ? sammleTermine(vesKalender, kontakteKalender, KAL_FENSTER_MONATE, 12, freieTermine) : [],
    [vesKalender, kontakteKalender, kalDockAktiv, istDesktop, kalPanelMobilOffen, freieTermine]);

  const tBase = mode === "light" ? LIGHT : DARK;
  // Hoher Kontrast ist seit v12.82 generell aktiv (kein Schalter mehr): sub-Texte
  // immer heller bzw. dunkler – wirkt überall, wo t.sub/t.muted benutzt wird.
  const t = { ...tBase,
    sub:   mode === "light" ? "#2A2E40" : "#D0D0E8",
    muted: mode === "light" ? "#454A60" : "#A8A8C5" };

  // Legende-Sichtbarkeit (v12.82): EIN Schalter legendeAn für alle Kacheln.
  // Fallback für noch nicht migrierte Settings: alte Keys (beide an → an).
  const legendeSichtbar = (s) => {
    if (!s) return true;
    if (s.legendeAn != null) return s.legendeAn !== false;
    return (s.legendeKontakte !== false) && (s.legendeObjekte !== false);
  };

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

  // Soll der Schnellzugriff (Kacheln/Sidebar) angezeigt werden?
  // Wird nur vom User-Setting gesteuert – auch in den Einstellungen sichtbar.
  const schnellzugriffSichtbar = (
    settings.schnellzugriffModus === "immer" ||
    (settings.schnellzugriffModus === "home" && screen === "home")
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
    const objektLegendeEl = (legendeSichtbar(settings) && gefiltert.length > 0) ? (
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
          detailMinBreite={detailMinBreite} detailMin={detailMinBreiteEff} kartenMaxBreite={kartenMaxBreite} kartenMin={kartenMinBreiteEff} listeOpt={listeOpt}
          kartenSpalten={kartenSpalten}
          gefiltert={gefiltert}
          expandedVEId={expandedVEId}
          setExpandedVEId={setExpandedVEId}
          offenVE={offenVE}
          t={t} accent={objektAccent}
          kontakte={kontakte} setKontakte={setKontakte}
          ves={ves} setVes={setVes}
          sprungZiel={veSprungZiel}
          gotoKontakt={gotoKontakt}
          onNurDetail={setObjektNurDetail}/>
      );
    } else if (hatOffen && !istDesktop) {
      detailInhalt = (
        <DetailMobilScrollTop offenId={offenVE.id} t={t}
          headerSelector="[data-app-fixed-header]" zumAnfang={true}>
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
            ? { display: "flex", flexDirection: "column", gap: 6, maxWidth: listeBreiteAus(listeOpt), width: "100%" }
            : kartenGridStyle({ einspaltig: !istDesktop, nurMaster: true, kartenMaxBreite: KACHEL_W, festeGridSpec: festeGridSpec })}>
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
        <ScreenKopf t={t} accent={objektAccent} titel="Objekte"
          titelAktiv={titleAktiv}
          onTitelClick={() => { setFilterArt("alle"); setFilterObjektGruppe("alle"); setExpandedVEId(null); }}
          rechts={
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <HeaderPlus onClick={() => setNeuesObjektOffen(true)} accent={objektAccent} title="Neues Objekt" t={t}/>
              {(istMobileDetail || (hatOffen && objektNurDetail)) ? (
                <HeaderZurueck onClick={() => setExpandedVEId(null)} t={t}/>
              ) : null}
            </div>
          }/>
        {/* Filter-Pillen (Verwaltungsart + Gruppen) als EIGENE horizontal scrollbare
            Zeile unter dem Kopf — NICHT im ScreenKopf-mitte-Slot (der schwebt seit §89
            absolut rechts → kein Scrollen, verdeckt den Titel). Nicht im Mobil-Detail. */}
        {!(istMobileDetail || (hatOffen && objektNurDetail)) && (
          <div style={{ flexShrink: 0, padding: "8px 2px 4px", display: "flex", gap: 6, minWidth: 0 }}>
            <FilterButtons arten={VERWALTUNGSARTEN} aktive={aktiveArten}
              counts={countsArt} wert={filterArt} onWert={setFilterArt}
              t={t} accent={objektAccent} ohneAlle={true}/>
            {objGruppenArten.length > 0 && (
              <FilterButtons arten={objGruppenArten} aktive={objGruppenArten.map(a => a.id)}
                counts={objGruppenCounts} wert={filterObjektGruppe}
                onWert={(w) => { setFilterObjektGruppe(w); setExpandedVEId(null); }}
                t={t} accent={objektAccent} ohneAlle={true}/>
            )}
          </div>
        )}
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
        <ScreenKopf t={t} accent={kontaktAccent} titel="Kontakte"
          titelAktiv={titleAktiv}
          onTitelClick={() => { setFilterKontaktart("alle"); setFilterKontaktGruppe("alle"); setAktivKontaktId(null); }}
          rechts={
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <HeaderPlus onClick={() => setNeuerKontaktOffen(true)} accent={kontaktAccent} title="Neuer Kontakt" t={t}/>
              {(aktivKontaktId && kontaktNurDetail) ? (
                <HeaderZurueck onClick={() => setAktivKontaktId(null)} t={t}/>
              ) : null}
            </div>
          }/>
        {/* Filter-Pillen (Kontaktart + Gruppen) als EIGENE horizontal scrollbare
            Zeile unter dem Kopf (§89-Konvention, siehe Objekte/Kalender). Nicht im
            Mobil-Detail. */}
        {!(aktivKontaktId && kontaktNurDetail) && (
          <div style={{ flexShrink: 0, padding: "8px 2px 4px", display: "flex", gap: 6, minWidth: 0 }}>
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
          </div>
        )}
        <KontakteScreen t={t} accent={kontaktAccent}
          listenAnsicht={effectiveSettings.listenAnsicht}
          kontaktart={filterKontaktart}
          legendeAn={legendeSichtbar(settings)}
          kontakte={kontakteFuerListe} setKontakte={setKontakte} ves={ves}
          initialKontaktId={kontaktId} onVEClick={gotoVE}
          externAktiv={aktivKontaktId} setExternAktiv={setAktivKontaktId}
          externEditMode={kontaktDetailEditMode}
          setExternEditMode={setKontaktDetailEditMode}
          mobileDetailHeaderOhneEditBtn={false}
          onNurDetail={setKontaktNurDetail}
          cardWidth={cardWidth} detailMinBreite={detailMinBreite} kartenMaxBreite={kartenMaxBreite} kartenMin={kartenMinBreiteEff} listeOpt={listeOpt} kartenSpalten={kartenSpalten} festeGridSpec={festeGridSpec}/>
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

  // §96: Badge der Schreibtisch-Kachel — Anzahl anliegender Handlungspunkte,
  // gefärbt in der dringlichsten Ampel-Stufe. null → kein Badge.
  const schreibtischBadge = schreibtischBadgeInfo(vorgangsWelt);
  const navBadges = schreibtischBadge ? { schreibtisch: schreibtischBadge } : null;

  // §95: Ableitungen der Legionellen-Kachel — EINE Quelle für beide Sichten
  // (Timeline + Objekte), statt die Accent-Suche mehrfach inline zu rechnen.
  const legionellenAccent = ((effectiveSettings.kacheln || [])
    .find(k => k.id === "legionellen") || {}).farbe || "#06B6D4";
  const legionellenPille = (
    <KopfPille t={t} accent={legionellenAccent}
      optionen={[{ id: "objekte", label: "Objekte" }, { id: "timeline", label: "Timeline" }]}
      aktiv={legionellenView}
      onWaehle={(id) => { setLegionellenView(id); setLegionellenViewVEId(null);
        setLegionellenEditMode(false); setLegionellenTimelineKey(null); }}/>
  );

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
    <VorlagenContext.Provider value={vorlagenVon(settings)}>
    <FristenContext.Provider value={fristenVon(settings)}>
    <KartenIconsContext.Provider value={settings.kartenIconsAn !== false}>
    <DokumenteKartenContext.Provider value={settings.dokumenteKartenAn === true}>
    <DokumentViewerBgContext.Provider value={settings.dokumentViewerBg || "modus"}>
    <KartenBadgesContext.Provider value={{
      person: settings.kartenBadgesPerson !== false,
      firma:  settings.kartenBadgesFirma  !== false
    }}>
    <StatusLeisteContext.Provider value={{
      objekt:  settings.statusLeisteObjekt  !== false,
      kontakt: settings.statusLeisteKontakt !== false,
      kontextWahl: settings.statusKontextWahl || {},
      kontextDaten: { welt: vorgangsWelt }
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
    <LoeschenErlaubtContext.Provider value={{ objekte: settings.loeschenErlaubtObjekte === true, kontakte: settings.loeschenErlaubtKontakte === true }}>
    <KontaktFarbeContext.Provider value={{ person: kontaktAccent, firma: kontaktAccent, objekt: objektAccent, system: systemAccent, auswahlObjekt: auswahlObjekt, auswahlKontakt: auswahlKontakt }}>
    <KontaktAnzeigeContext.Provider value={{
      nameFormat: settings.kontakteNameFormat || "vorname-nachname",
      alphaTrenner: settings.kontakteAlphaTrenner !== false,
      trenneTypen: settings.kontakteTrennePersonenFirmen === true,
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
          /* MOBILE: Übersichts-Kachelraster (KACHEL_GRID) wird zu EINER Spalte
             voller Breite — die Karten laufen flexibel bis zum Rand wie die
             Detail-Karte, statt als feste 340px-Kachel mit Rest-Raum rechts.
             Desktop behält das feste 340px-Raster (Default-Wert von --ad-kg). */
          .ad-root-mobile { --ad-kg: 1fr; }
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
        {!istDesktop && schnellzugriffSichtbar && settings.schnellzugriffSticky && (
          <div style={{ borderTop: `1px solid ${t.border}`, padding: "6px 0" }}>
            <KategorieKacheln settings={effectiveSettings} t={t} aktiverScreen={screen} suchAktiv={!!suchErg} onKlick={navTo} badges={navBadges}/>
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
          Wenn schnellzugriffSticky=false: außerhalb des Headers (scrollt mit weg).
          Wenn schnellzugriffSticky=true: integriert in den fixed Header (s.o.). */}
      {!istDesktop && schnellzugriffSichtbar && !settings.schnellzugriffSticky && (
        <div style={{ background: t.header,
          borderBottom: `1px solid ${t.border}`, padding: "6px 0",
          flexShrink: 0 }}>
          <KategorieKacheln settings={effectiveSettings} t={t} aktiverScreen={screen} suchAktiv={!!suchErg} onKlick={navTo} badges={navBadges}/>
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
        {istDesktop && schnellzugriffSichtbar && (
          <div style={{
            background: t.surface,
            borderRight: `1px solid ${t.border}`,
            flexShrink: 0,
            height: "100%",
            overflowY: "auto",
          }}>
            <SeitenleisteKacheln badges={navBadges} settings={effectiveSettings} setSettings={setSettings}
              t={t} aktiverScreen={screen} onKlick={navTo}/>
          </div>
        )}

        {/* Content */}
        <div style={istDesktop
          ? { flex: 1, minWidth: 0, display: "flex", flexDirection: "column", minHeight: 0, overflow: "hidden" }
          : { display: "flex", flexDirection: "column" }}>
          <div style={istDesktop
            ? { margin: "0 auto", padding: "0 10px", width: "100%", minWidth: 0, display: "flex", flexDirection: "column", flex: 1, minHeight: 0 }
            : { margin: "0 auto", padding: "0 10px", width: "100%", minWidth: 0, boxSizing: "border-box", display: "flex", flexDirection: "column" }}>
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
            cardWidth={cardWidth} detailMinBreite={detailMinBreite} detailMin={detailMinBreiteEff} kartenMaxBreite={kartenMaxBreite} kartenMin={kartenMinBreiteEff} listeOpt={listeOpt} festeGridSpec={festeGridSpec}/>
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
          <KalenderScreen ves={vesKalender} kontakte={kontakteKalender} welt={vorgangsWelt} setVes={setVes} setKontakte={setKontakte} plusAccent={kalenderAccent} t={t} accent={objektAccent}
            gotoVE={gotoVE} gotoKontakt={gotoKontakt} settings={effectiveSettings}
            freieTermine={freieTermine} setFreieTermine={setFreieTermine}
            pendingTerminKey={pendingTerminKey}
            kalView={kalView} setKalView={setKalView}
            kalViewVEId={kalViewVEId} setKalViewVEId={setKalViewVEId}
            cardWidth={cardWidth} kartenSpalten={kartenSpalten}
            detailMinBreite={detailMinBreite} detailMin={detailMinBreiteEff} kartenMaxBreite={kartenMaxBreite} kartenMin={kartenMinBreiteEff} listeOpt={listeOpt} listenAnsicht={effectiveSettings.listenAnsicht} festeGridSpec={festeGridSpec}
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

        {/* §12.8 Screen-Plus: die vier gehosteten Anlege-Dialoge — Objektwahl
            als ERSTES Feld im Dialog (Vorgänge-Muster), vorbelegt bei offener
            Akte. Die Wahl stellt zugleich die Objekt-Sicht dahinter um. */}
        {etvNeuOffen && (
          <VersammlungNeuOverlay t={t}
            accent={(effectiveSettings.kacheln.find(k => k.id === "etv") || {}).farbe || "#8B5CF6"}
            ve={(vesSichtbar || []).find(v => v.id === etvViewVEId) || null}
            welt={vorgangsWelt} kontakte={kontakteSichtbar}
            objektWahl={{ ves: vesSichtbar, aktivId: etvViewVEId,
              onWaehle: (id) => { setEtvAkteId(null); setEtvViewVEId(id || null); } }}
            onWelt={(fn) => setVorgangsWelt(prev => fn(prev))}
            onVePatch={(fn) => setVes(prev => prev.map(v => (v && v.id === etvViewVEId) ? fn(v) : v))}
            onClose={() => setEtvNeuOffen(false)}
            onFertig={(vid) => { setEtvNeuOffen(false); setEtvAkteId(vid); }}/>
        )}
        {/* Technik-Plus ohne offenes Objekt: erst Objektwahl, dann Akte öffnen
            und neue Technik-Karte anlegen (TechnikPflegeAnsicht via Signal). */}
        {plusWahlTechnik && (
          <ObjektWahlOverlay ves={vesSichtbar} t={t}
            accent={(effectiveSettings.kacheln.find(k => k.id === "technik") || {}).farbe || "#10B981"}
            titel="Objekt wählen — neue Technik"
            onClose={() => setPlusWahlTechnik(false)}
            onWaehle={(veObj) => {
              setTechnikViewVEId(veObj.id);
              setTechnikNeuKarteSignal(s => s + 1);
              setPlusWahlTechnik(false);
            }}/>
        )}
        {dokNeuOffen && (() => {
          const dokVe = (vesSichtbar || []).find(v => v.id === dokumenteViewVEId) || null;
          const dokVorhandene = {};
          ((dokVe && dokVe.karten) || []).forEach(k => { if (k && k.dokumentId) dokVorhandene[k.dokumentId] = k; });
          return (
            <DokumentUploadModal t={t}
              accent={(effectiveSettings.kacheln.find(k => k.id === "dokumente") || {}).farbe || "#64748B"}
              ve={dokVe} vorhandene={dokVorhandene}
              objektWahl={{ ves: vesSichtbar, aktivId: dokumenteViewVEId,
                onWaehle: (id) => setDokumenteViewVEId(id || null) }}
              onClose={() => setDokNeuOffen(false)}
              onSave={(katId, file, ersetzen, fertig, eigenName) =>
                dokumentUploadAnVe(setVes, dokumenteViewVEId, katId, file, ersetzen,
                  (ok, msg) => { fertig(ok, msg); if (ok) setDokNeuOffen(false); }, eigenName)}/>
          );
        })()}
        {fotoNeuOffen && (
          <FotoUploadModal t={t}
            accent={(effectiveSettings.kacheln.find(k => k.id === "fotos") || {}).farbe || "#EC4899"}
            ve={(vesSichtbar || []).find(v => v.id === fotosViewVEId) || null}
            objektWahl={{ ves: vesSichtbar, aktivId: fotosViewVEId,
              onWaehle: (id) => setFotosViewVEId(id || null) }}
            onClose={() => setFotoNeuOffen(false)}
            onSave={(eintraege) => setVes(prev => prev.map(v =>
              (v && v.id === fotosViewVEId)
                ? { ...v, fotos: [ ...(Array.isArray(v.fotos) ? v.fotos : []), ...eintraege ] }
                : v))}/>
        )}

        {/* Kommunikation: Plus zeigt Hinweis, bis das echte Modul existiert. */}
        {kommPlusHinweis && (
          <div style={overlayBackdrop()} onClick={() => setKommPlusHinweis(false)}>
            <div style={overlayPanel(t)} onClick={(e) => e.stopPropagation()}>
              <OverlayKopf t={t} titel="Kommunikation" onClose={() => setKommPlusHinweis(false)} icon="mail"/>
              <div style={overlayBody()}>
                <div style={{ fontSize: FS.m, color: t.text, lineHeight: 1.5 }}>
                  Das Anlegen von Nachrichten kommt mit dem Kommunikations-Modul.
                </div>
                <div style={{ fontSize: FS.s, color: t.muted, marginTop: 6, lineHeight: 1.5 }}>
                  Dieser Bereich zeigt aktuell Beispieldaten zur Layout-Vorschau.
                </div>
              </div>
            </div>
          </div>
        )}

        {!suchErg && screen === "etv" && (
          <ObjektListeMitDetail
            ves={vesSichtbar} kontakte={kontakteSichtbar}
            statusKontext="etv"
            setVes={setVes} setKontakte={setKontakte} t={t}
            accent={(effectiveSettings.kacheln.find(k => k.id === "etv") || {}).farbe || "#8B5CF6"}
            gotoVE={gotoVE} gotoKontakt={gotoKontakt}
            cardWidth={cardWidth} kartenSpalten={kartenSpalten}
            detailMinBreite={detailMinBreite} detailMin={detailMinBreiteEff} kartenMaxBreite={kartenMaxBreite} kartenMin={kartenMinBreiteEff} listeOpt={listeOpt} listenAnsicht={effectiveSettings.listenAnsicht} festeGridSpec={festeGridSpec}
            viewVEId={etvViewVEId}
            setViewVEId={(id) => { setEtvAkteId(null); setEtvViewVEId(id); }}
            istDesktop={istDesktop}
            titel="ETV" anzahl={(vesSichtbar || []).length}
            kopfPlus={{ title: "Neue Versammlung", onClick: () => setEtvNeuOffen(true) }}
            legendeAn={legendeSichtbar(effectiveSettings)}
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
              // ETV-Welt (Konzept _03, Bau 12.07.): Versammlungsliste + Akte.
              const etvAccent = (effectiveSettings.kacheln.find(k => k.id === "etv") || {}).farbe || "#8B5CF6";
              return (
                <EtvBereichFuerObjekt ve={veObj} welt={vorgangsWelt}
                  onWelt={(fn) => setVorgangsWelt(prev => fn(prev))}
                  onVePatch={(fn) => setVes(prev => prev.map(v => (v && v.id === veObj.id) ? fn(v) : v))}
                  kontakte={kontakteSichtbar} settings={effectiveSettings}
                  t={t} accent={etvAccent}
                  akteId={etvAkteId} setAkteId={setEtvAkteId}/>
              );
            }}/>
        )}
        {!suchErg && screen === "auftraege" && (() => {
          const aAccent = (effectiveSettings.kacheln.find(k => k.id === "auftraege") || {}).farbe || "#EF4444";
          const istDesk = istDesktop;
          const istListeA = effectiveSettings.listenAnsicht === "liste";
          const firmen = (kontakteSichtbar || []).filter(k => k && k.typ === "firma");

          const hatAuswahl = (auftragView === "objekt" && auftragViewVEId) || (auftragView === "firma" && auftragFirmaId);
          let detailKopf = null, detailSub = null, detailListe = null;
          // In den GEMEINSAMEN Scope gehoben (Fix 11.07.): die Akten-Ebene
          // unten braucht den Foto-Callback ebenfalls — als const im
          // objekt-if war er dort unsichtbar (ReferenceError → Schwarz-Screen).
          let auftragFotoHinzu = null;
          let auftragFotoEntfernen = null;
          if (auftragView === "objekt" && auftragViewVEId) {
            const vo = (vesSichtbar || []).find(v => v.id === auftragViewVEId);
            detailKopf = vo ? (vo.nr || "Objekt") : "";
            detailSub = (vo && vo.adresse) ? vo.adresse : null;
            // Auftragsfotos (Weg A §5.10, v13.59): Bild in IndexedDB + Eintrag
            // in ve.fotos[] (exakt die §93-Struktur, Album „sonstiges", Notiz =
            // Auftragsbeschreibung → in der Foto-Ansicht auffindbar) + Referenz
            // am Auftrag. EIN setVes je Auswahl (Mehrfach-Upload gesammelt).
            auftragFotoHinzu = (auftrag, files) => {
              if (!vo || !files || files.length === 0) return;
              const vId = auftrag.vorgang_id
                ? ((vorgangsWelt.vorgaenge.find(x => x.id === auftrag.vorgang_id) || {}).einheit_id || null)
                : null;
              const p2 = (n) => String(n).padStart(2, "0");
              const h = new Date();
              const heuteDE = p2(h.getDate()) + "." + p2(h.getMonth() + 1) + "." + h.getFullYear();
              const eintraege = [];
              let kette = Promise.resolve();
              files.forEach((f, i) => {
                kette = kette.then(() => dateiSpeichern(f).then(meta => {
                  eintraege.push({
                    id: "foto_" + Date.now().toString(36) + "_" + i + "_" + Math.random().toString(36).slice(2, 8),
                    dateiRef: meta.id, name: meta.name, typ: meta.typ, groesse: meta.groesse,
                    album: "sonstiges",
                    zuordnung: { art: vId ? "einheit" : "gemeinschaft",
                      hausId: null, einheitId: vId, raumId: null },
                    geraetId: null, aufgenommen: heuteDE, exifQuelle: "upload",
                    gps: null, notiz: auftrag.beschreibung || "Auftragsfoto",
                    angelegt: new Date().toISOString(),
                  });
                }));
              });
              kette.then(() => {
                if (eintraege.length === 0) return;
                setVes(prev => prev.map(v => v.id === vo.id
                  ? { ...v, fotos: [...(Array.isArray(v.fotos) ? v.fotos : []), ...eintraege] }
                  : v));
                setVorgangsWelt(prev => weltAuftragFotoRefs(prev, auftrag.id, eintraege.map(e => e.id)));
              }).catch(() => {});
            };
            // Foto vom Punkt entfernen (Begehung 18.07.): Referenz IMMER lösen
            // (weltAuftragFotoRefEntfernen). „ganzWeg" zusätzlich: Foto aus der
            // Objekt-Zentrale (ve.fotos) + Blob (dateiLoeschen) — die Wahl
            // trifft der Nutzer im AuftragFotoLeiste-Dialog.
            auftragFotoEntfernen = (auftrag, foto, ganzWeg) => {
              if (!auftrag || !foto) return;
              setVorgangsWelt(prev => weltAuftragFotoRefEntfernen(prev, auftrag.id, foto.id));
              if (ganzWeg && vo) {
                if (foto.dateiRef) dateiLoeschen(foto.dateiRef);
                setVes(prev => prev.map(v => v.id === vo.id
                  ? { ...v, fotos: (Array.isArray(v.fotos) ? v.fotos : []).filter(f => f.id !== foto.id) }
                  : v));
              }
            };
            // Echte Quelle (§96): Vorgänge dieses Objekts + „Erfasst"-Ecke
            // (vorgangslose Begehungsfunde). key=veId → frischer Klapp-State
            // je Objekt (React-Key-Lehre).
            detailListe = (
              <VorgangsBereichFuerObjekt key={auftragViewVEId + ":" + (auftragSprungId || "")}
                veId={auftragViewVEId} welt={vorgangsWelt}
                kontakte={kontakteSichtbar} t={t} accent={aAccent}
                offeneIdCtrl={vorgangAkteId} onOeffneId={setVorgangAkteId}
                onWelt={(fn) => setVorgangsWelt(prev => fn(prev))}
                DatumFeld={DatumFeld}
                ve={vo} onFotoHinzu={auftragFotoHinzu} onFotoEntfernen={auftragFotoEntfernen}/>
            );
          } else if (auftragView === "firma" && auftragFirmaId) {
            const fk = firmen.find(f => f.id === auftragFirmaId);
            detailKopf = fk ? (fk.name || "Firma") : "";
            // Echte Quelle (§96): Vorgänge, an denen die Firma über Auftrag
            // oder Angebot hängt — objektübergreifend.
            detailListe = (
              <VorgangsBereichFuerFirma key={auftragFirmaId}
                firmaId={auftragFirmaId} welt={vorgangsWelt}
                kontakte={kontakteSichtbar} t={t} accent={aAccent}
                offeneIdCtrl={vorgangAkteId} onOeffneId={setVorgangAkteId}
                onWelt={(fn) => setVorgangsWelt(prev => fn(prev))}
                DatumFeld={DatumFeld}/>
            );
          }

          // §94.2-Badge: Anzahl lebender Fälle (offene Vorgänge + lose
          // erfasst-Aufträge) je Objekt an der Master-Liste.
          const aufBadge = (v) => {
            const n = vorgangAnzahlFuerObjekt(v.id, vorgangsWelt);
            return n > 0 ? String(n) : null;
          };
          const masterInhalt = (layout) => auftragView === "objekt" ? (
            <div style={istListeA
              ? { display: "flex", flexDirection: "column", gap: 6 }
              : kartenGridStyle(layout)}>
              {(vesSichtbar || []).map(v => istListeA ? (
                <VEListenZeile key={v.id} ve={v} t={t} accent={aAccent}
                  aktiv={auftragViewVEId === v.id} kbItem id={"auf-" + v.id}
                  auswahlAccentOverride={aAccent} extraBadge={aufBadge(v)}
                  statusKontext="vorgaenge"
                  onClick={() => { setAuftragSprungId(null); setVorgangAkteId(null); setAuftragViewVEId(auftragViewVEId === v.id ? null : v.id); }}/>
              ) : (
                <VEKachel key={v.id} ve={v} t={t} accent={aAccent}
                  aktiv={auftragViewVEId === v.id} kbItem id={"auf-" + v.id}
                  auswahlAccentOverride={aAccent} extraBadge={aufBadge(v)}
                  statusKontext="vorgaenge"
                  onClick={() => { setAuftragSprungId(null); setVorgangAkteId(null); setAuftragViewVEId(auftragViewVEId === v.id ? null : v.id); }}/>
              ))}
            </div>
          ) : (
            <div style={istListeA
              ? { display: "flex", flexDirection: "column", gap: 6 }
              : kartenGridStyle(layout)}>
              {firmen.length === 0 ? (
                <div style={{ fontSize: FS.m, color: t.muted, fontStyle: "italic", marginTop: 12 }}>
                  Keine Firmen-Kontakte vorhanden.
                </div>
              ) : firmen.map(f => (
                <KontaktKarte key={f.id} k={f} t={t}
                  aktiv={auftragFirmaId === f.id} kbItem id={"auffirma-" + f.id}
                  auswahlAccentOverride={aAccent}
                  onClick={() => { setVorgangAkteId(null); setAuftragFirmaId(auftragFirmaId === f.id ? null : f.id); }}/>
              ))}
            </div>
          );

          const detailInhalt = hatAuswahl ? (
            <DetailRahmen t={t} accent={aAccent} titel={detailKopf} sub={detailSub}>
              {detailListe}
            </DetailRahmen>
          ) : null;

          const aufLegende = baueObjektLegende(aAccent);
          const auftragHeader = (
            <ScreenKopf t={t} accent={aAccent} titel="Vorgänge"
              mitte={
                <KopfPille t={t} accent={aAccent}
                  optionen={[{ id: "objekt", label: "Objekte" }, { id: "firma", label: "Firmen" }, { id: "timeline", label: "Timeline" }]}
                  aktiv={auftragView} onWaehle={setAuftragView}/>
              }
              rechts={(() => {
                // Zurück gehört RECHTS in den Screen-Kopf (Benny 11.07.,
                // Objekte-Muster): mobil zuerst die Akte schließen, dann die
                // Objekt-/Firmen-Auswahl — eine Kaskade, ein Platz.
                const akteOffenMobil = !istDesk && !!vorgangAkteId
                  && (hatAuswahl || auftragView === "timeline");
                const zurueck = akteOffenMobil
                  ? () => setVorgangAkteId(null)
                  : ((hatAuswahl && (auftragNurDetail || !istDesk))
                    ? () => { setAuftragViewVEId(null); setAuftragFirmaId(null); }
                    : null);
                // Plus IMMER sichtbar (Kalender-Prinzip) — auch im Mobil-Detail
                // (18.07.: Plus + Zurück koexistieren, wie Kalender/Objekte/Kontakte).
                const plus = true;
                const plusClick = () => setAuftragNeuOffen(true);
                if (!zurueck && !plus) return null;
                return (
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    {plus ? (
                      <HeaderPlus onClick={plusClick}
                        accent={aAccent} title="Neu (Vorgang / Auftrag erfassen)" t={t}/>
                    ) : null}
                    {zurueck ? <HeaderZurueck onClick={zurueck} t={t}/> : null}
                  </div>
                );
              })()}/>
          );

          // Erfassen-Overlay (§96 Etappe 4). Mutationen laufen über die
          // Modell-Fabriken — Vorgang bekommt automatisch die Fallführer-
          // Beteiligung (kontakt_id null = die Verwaltung, §96.3) und
          // optional die erste Notiz als Nachricht.
          const anlegenVe = auftragNeuOffen && auftragView === "objekt" && auftragViewVEId
            ? (vesSichtbar || []).find(v => v.id === auftragViewVEId) : null;
          // §Plus-Buttons: Overlay öffnet auch OHNE Objekt — die Objektwahl ist
          // das erste Feld im Dialog (vorbelegt bei offener Akte). Die Wahl
          // setzt zugleich die Objekt-Sicht (Akte hinter dem Dialog).
          const auftragNeuOverlay = auftragNeuOffen ? (
            <VorgangNeuOverlay ve={anlegenVe} t={t} accent={aAccent}
              Inp={Inp} kontakteAlle={kontakteSichtbar}
              objektWahl={{ ves: vesSichtbar, aktivId: auftragViewVEId,
                onWaehle: (id) => {
                  setAuftragView("objekt");
                  setAuftragFirmaId(null);
                  setAuftragSprungId(null);
                  setVorgangAkteId(null);
                  setAuftragViewVEId(id || null);
                } }}
              onClose={() => setAuftragNeuOffen(false)}
              onAnlegenVorgang={(d) => {
                const v = neuerVorgang({ objekt_id: anlegenVe.id,
                  nummer: vorgangsNummerNeu(vorgangsWelt),
                  einheit_id: d.einheit_id, raum_id: d.raum_id || null,
                  titel: d.titel, kategorie: d.kategorie,
                  ersteller_kontakt_id: d.melder_kontakt_id || null });
                const bets = [neueBeteiligung({ vorgang_id: v.id, rolle: "fallfuehrer" })];
                // Melder (Benny 09.07.): „Gemeldet von" — als Melder-Beteiligung
                // in der Akte, die Notiz trägt ihn als Absender.
                if (d.melder_kontakt_id) {
                  bets.push(neueBeteiligung({ vorgang_id: v.id,
                    kontakt_id: d.melder_kontakt_id, rolle: "melder" }));
                }
                const nachricht = d.notiz
                  ? neueNachricht({ vorgang_id: v.id, richtung: "eingehend",
                      von_kontakt_id: d.melder_kontakt_id || null,
                      inhalt: d.notiz })
                  : null;
                setVorgangsWelt(prev => ({ ...prev,
                  vorgaenge: [...prev.vorgaenge, v],
                  beteiligungen: [...prev.beteiligungen, ...bets],
                  nachrichten: nachricht ? [...prev.nachrichten, nachricht] : prev.nachrichten,
                }));
              }}
              onErfasseAuftrag={(d) => {
                const a = neuerAuftrag({ objekt_id: anlegenVe.id,
                  beschreibung: d.beschreibung, status: "erfasst",
                  ort: d.ort || "", notiz: d.notiz || "",
                  gemeldet_von_id: d.gemeldet_von_id || null });
                setVorgangsWelt(prev => ({ ...prev,
                  auftraege: [...prev.auftraege, a] }));
                // Fotos (Begehung 18.07.): in die Foto-Zentrale des Objekts
                // (ve.fotos, §93-Struktur) + Referenzen an den Punkt — exakt
                // der Weg-A-Pfad der Auftragsfotos (§5.10).
                const files = Array.isArray(d.fotos) ? d.fotos : [];
                if (files.length > 0) {
                  const p2 = (n) => String(n).padStart(2, "0");
                  const h = new Date();
                  const heuteDE = p2(h.getDate()) + "." + p2(h.getMonth() + 1) + "." + h.getFullYear();
                  const eintraege = [];
                  let kette = Promise.resolve();
                  files.forEach((f, i) => {
                    kette = kette.then(() => dateiSpeichern(f).then(meta => {
                      eintraege.push({
                        id: "foto_" + Date.now().toString(36) + "_" + i + "_" + Math.random().toString(36).slice(2, 8),
                        dateiRef: meta.id, name: meta.name, typ: meta.typ, groesse: meta.groesse,
                        album: "sonstiges",
                        zuordnung: { art: "gemeinschaft", hausId: null, einheitId: null, raumId: null },
                        geraetId: null, aufgenommen: heuteDE, exifQuelle: "upload",
                        gps: null, notiz: d.beschreibung || "Begehungsfoto",
                        angelegt: new Date().toISOString(),
                      });
                    }));
                  });
                  kette.then(() => {
                    if (eintraege.length === 0) return;
                    setVes(prev => prev.map(v => v.id === anlegenVe.id
                      ? { ...v, fotos: [...(Array.isArray(v.fotos) ? v.fotos : []), ...eintraege] }
                      : v));
                    setVorgangsWelt(prev => weltAuftragFotoRefs(prev, a.id, eintraege.map(e => e.id)));
                  }).catch(() => {});
                }
              }}/>
          ) : null;

          // ── AKTEN-EBENE (Feinschliff 11.07., Bennys Skizze) ──────────────
          // Ist eine Akte offen, hebt sich das Master-Detail eine Stufe:
          // die Objekt-Spalte verschwindet, die VORGANGSLISTE wird Master
          // (Spalte 2), die AKTE das Detail (Spalte 3) — exakt das
          // Objekte-Muster. Mobil: Akte füllt den Screen, Zurück im Kopf.
          const akteVorgang = vorgangAkteId && auftragView !== "timeline" && hatAuswahl
            ? (vorgangsWelt.vorgaenge.find(v => v.id === vorgangAkteId) || null) : null;
          if (akteVorgang) {
            const akteVe = auftragView === "objekt"
              ? ((vesSichtbar || []).find(v => v.id === auftragViewVEId) || null) : null;
            const akteDetail = (
              <VorgangDetail vorgang={akteVorgang} welt={vorgangsWelt}
                kontakte={kontakteSichtbar} t={t} accent={aAccent}
                onZurueck={() => setVorgangAkteId(null)}
                onWelt={(fn) => setVorgangsWelt(prev => fn(prev))}
                DatumFeld={DatumFeld} ve={akteVe}
                onFotoHinzu={akteVe ? auftragFotoHinzu : null}
                zurueckKnopf={false}/>
            );
            if (!istDesk) {
              return (
                <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column" }}>
                  {auftragNeuOverlay}
                  {auftragHeader}
                  <div data-ad-scroll="y" style={{ flex: 1, minHeight: 0, overflowY: "auto", padding: "8px 2px" }}>
                    {akteDetail}
                  </div>
                </div>
              );
            }
            return (
              <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column" }}>
                {auftragNeuOverlay}
                {auftragHeader}
                <MasterDetailRahmen
                  master={() => (
                    /* Zurück im KOPF des Listen-Rahmens (Benny 11.07.):
                       aktion-Slot des DetailRahmen — die Liste startet damit
                       auf gleicher Höhe wie die Akte rechts. */
                    <DetailRahmen t={t} accent={aAccent} titel={detailKopf} sub={detailSub}
                      aktion={<HeaderZurueck onClick={() => setVorgangAkteId(null)} t={t}/>}>
                      {detailListe}
                    </DetailRahmen>
                  )}
                  detail={akteDetail}
                  istDesktop={true}
                  listenAnsicht={effectiveSettings.listenAnsicht} listeOpt={listeOpt}
                  kartenSpalten={kartenSpalten} kartenMaxBreite={kartenMaxBreite}
                  kartenMin={kartenMinBreiteEff} detailMinBreite={detailMinBreite} detailMin={detailMinBreiteEff}
                  t={t} onNurDetail={() => {}}/>
              </div>
            );
          }

          // Timeline (Benny 09.07.): dritte Achse — Chronik quer über alles,
          // kein Master-Detail. Tap springt in die Objekt-Akte (wie Schreibtisch).
          if (auftragView === "timeline") {
            // Timeline im kanonischen Kalender-Muster (Benny 11.07.):
            // LINKSBÜNDIGE Bucket-Liste als Master (uebersichtBreite="master"
            // → gleiche Listenbreite wie im Kalender), Antippen öffnet die
            // AKTE als Detail. Lose Erfasst-Funde (keine Akte) springen
            // weiterhin in die Objektliste.
            const springeT = (e) => {
              if (!e || !e.objekt_id) return;
              setAuftragView("objekt");
              setAuftragFirmaId(null);
              setAuftragViewVEId(e.objekt_id);
              setAuftragSprungId(e.vorgang_id || null);
              setVorgangAkteId(e.vorgang_id || null);
            };
            const tlVorgang = vorgangAkteId
              ? (vorgangsWelt.vorgaenge.find(v => v.id === vorgangAkteId) || null) : null;
            const tlVe = tlVorgang
              ? ((vesSichtbar || []).find(v => v.id === tlVorgang.objekt_id) || null) : null;
            const tlDetail = tlVorgang ? (
              <VorgangDetail vorgang={tlVorgang} welt={vorgangsWelt}
                kontakte={kontakteSichtbar} t={t} accent={aAccent}
                onZurueck={() => setVorgangAkteId(null)}
                onWelt={(fn) => setVorgangsWelt(prev => fn(prev))}
                DatumFeld={DatumFeld} ve={tlVe} onFotoHinzu={null}
                zurueckKnopf={false}/>
            ) : null;
            const tlMaster = () => (
              <div style={{ minWidth: 0 }}>
                {tlVorgang && istDesk ? (
                  <div style={{ marginBottom: 10 }}>
                    <HeaderZurueck onClick={() => setVorgangAkteId(null)} t={t}/>
                  </div>
                ) : null}
                <DemoHinweis welt={vorgangsWelt} t={t} accent={aAccent}
                  onWelt={(fn) => setVorgangsWelt(prev => fn(prev))}/>
                <TimelineBereich welt={vorgangsWelt} ves={vesSichtbar}
                  t={t} accent={aAccent} onSpringe={springeT}
                  offeneIdCtrl={vorgangAkteId} onOeffneId={setVorgangAkteId}/>
              </div>
            );
            if (!istDesk && tlVorgang) {
              return (
                <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column" }}>
                  {auftragHeader}
                  <div data-ad-scroll="y" style={{ flex: 1, minHeight: 0, overflowY: "auto", padding: "8px 2px" }}>
                    {tlDetail}
                  </div>
                </div>
              );
            }
            if (!istDesk) {
              return (
                <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column" }}>
                  {auftragHeader}
                  <div data-ad-scroll="y" style={{ flex: 1, minHeight: 0, overflowY: "auto", padding: "8px 2px" }}>
                    {tlMaster()}
                  </div>
                </div>
              );
            }
            return (
              <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column" }}>
                {auftragHeader}
                <MasterDetailRahmen
                  master={tlMaster}
                  detail={tlDetail}
                  istDesktop={true}
                  listenAnsicht={effectiveSettings.listenAnsicht} listeOpt={listeOpt}
                  kartenSpalten={kartenSpalten} kartenMaxBreite={kartenMaxBreite}
                  kartenMin={kartenMinBreiteEff} detailMinBreite={detailMinBreite} detailMin={detailMinBreiteEff}
                  t={t} onNurDetail={() => {}}
                  uebersichtBreite="master"/>
              </div>
            );
          }

          if (!istDesk) {
            return (
              <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column" }}>
                {auftragNeuOverlay}
                {auftragHeader}
                {hatAuswahl ? (
                  <div data-ad-scroll="y" style={{ flex: 1, minHeight: 0, overflowY: "auto", padding: "8px 2px" }}>
                    {detailInhalt}
                  </div>
                ) : (
                  <div data-ad-scroll="y" style={{ flex: 1, minHeight: 0, overflowY: "auto", padding: "8px 2px" }}>
                    {masterInhalt({ einspaltig: true })}
                  </div>
                )}
              </div>
            );
          }
          return (
            <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column" }}>
              {auftragNeuOverlay}
              {auftragHeader}
              {auftragView === "objekt" && aufLegende ? (
                <div style={{ flexShrink: 0, padding: "0 2px" }}>{aufLegende}</div>
              ) : null}
              <MasterDetailRahmen
                master={masterInhalt}
                detail={detailInhalt}
                istDesktop={true}
                listenAnsicht={effectiveSettings.listenAnsicht} listeOpt={listeOpt}
                kartenSpalten={kartenSpalten} kartenMaxBreite={kartenMaxBreite}
                kartenMin={kartenMinBreiteEff} detailMinBreite={detailMinBreite} detailMin={detailMinBreiteEff}
                t={t} onNurDetail={setAuftragNurDetail}/>
            </div>
          );
        })()}
        {!suchErg && screen === "schreibtisch" && (() => {
          // §96.8 Schreibtisch Stufe 1: objektübergreifende Handlungsliste.
          // Kein Master-Detail — die Liste IST der Inhalt; Tap springt in den
          // Vorgänge-Screen (Objekt geöffnet, Ziel-Vorgang aufgeklappt).
          const sAccent = (effectiveSettings.kacheln.find(k => k.id === "schreibtisch") || {}).farbe || "#6366F1";
          const springe = (e) => {
            if (!e || !e.objekt_id) return;
            setAuftragView("objekt");
            setAuftragFirmaId(null);
            setAuftragViewVEId(e.objekt_id);
            setAuftragSprungId(e.vorgang_id || null);
            setVorgangAkteId(e.vorgang_id || null);
            wechselScreen("auftraege");
          };
          const anzahl = schreibtischBadge ? schreibtischBadge.zahl : 0;
          return (
            <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column" }}>
              <ScreenKopf t={t} accent={sAccent} titel="Schreibtisch"
                mitte={anzahl > 0 ? (
                  <span style={{ fontSize: FS.s, fontWeight: FW.bold, color: sAccent,
                    background: sAccent + "18", padding: "2px 10px",
                    borderRadius: RAD.pill, whiteSpace: "nowrap" }}>
                    {anzahl === 1 ? "1 Punkt" : anzahl + " Punkte"}
                  </span>
                ) : null}/>
              <div data-ad-scroll="y" style={{ flex: 1, minHeight: 0, overflowY: "auto", padding: "8px 2px" }}>
                <div style={{ maxWidth: 720, margin: "0 auto", width: "100%",
                  boxSizing: "border-box" }}>
                  <SchreibtischBereich welt={vorgangsWelt} ves={vesSichtbar}
                    t={t} accent={sAccent} onSpringe={springe}/>
                </div>
              </div>
            </div>
          );
        })()}
        {!suchErg && screen === "beschluss" && (
          <ObjektListeMitDetail
            ves={vesSichtbar} kontakte={kontakteSichtbar}
            statusKontext="beschluss"
            setVes={setVes} setKontakte={setKontakte} t={t}
            accent={(effectiveSettings.kacheln.find(k => k.id === "beschluss") || {}).farbe || "#F59E0B"}
            gotoVE={gotoVE} gotoKontakt={gotoKontakt}
            cardWidth={cardWidth} kartenSpalten={kartenSpalten}
            detailMinBreite={detailMinBreite} detailMin={detailMinBreiteEff} kartenMaxBreite={kartenMaxBreite} kartenMin={kartenMinBreiteEff} listeOpt={listeOpt} listenAnsicht={effectiveSettings.listenAnsicht} festeGridSpec={festeGridSpec}
            viewVEId={beschlussViewVEId} setViewVEId={setBeschlussViewVEId}
            istDesktop={istDesktop}
            titel="Beschlusssammlung" anzahl={(vesSichtbar || []).length}
            legendeAn={legendeSichtbar(effectiveSettings)}
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
              const bAccent = (effectiveSettings.kacheln.find(k => k.id === "beschluss") || {}).farbe || "#F59E0B";
              return (
                <BeschlussSammlungFuerObjekt ve={veObj} welt={vorgangsWelt}
                  onWelt={(fn) => setVorgangsWelt(prev => fn(prev))}
                  t={t} accent={bAccent}/>
              );
            }}/>
        )}
        {!suchErg && screen === "technik" && (
          <ObjektListeMitDetail
            ves={vesSichtbar} kontakte={kontakteSichtbar}
            statusKontext="technik"
            setVes={setVes} setKontakte={setKontakte} t={t}
            accent={(effectiveSettings.kacheln.find(k => k.id === "technik") || {}).farbe || "#10B981"}
            gotoVE={gotoVE} gotoKontakt={gotoKontakt}
            cardWidth={cardWidth} kartenSpalten={kartenSpalten}
            detailMinBreite={detailMinBreite} detailMin={detailMinBreiteEff} kartenMaxBreite={kartenMaxBreite} kartenMin={kartenMinBreiteEff} listeOpt={listeOpt} listenAnsicht={effectiveSettings.listenAnsicht} festeGridSpec={festeGridSpec}
            viewVEId={technikViewVEId} setViewVEId={setTechnikViewVEId}
            istDesktop={istDesktop}
            titel="Technik" anzahl={(vesSichtbar || []).length}
            kopfPlus={{ title: "Neue Technik", onClick: () => {
              // Plus: bei offenem Objekt direkt neue Technik-Karte hier anlegen;
              // ohne Objekt erst Objektwahl (Kalender-Prinzip).
              if (technikViewVEId) { setTechnikNeuKarteSignal(s => s + 1); }
              else { setPlusWahlTechnik(true); }
            } }}
            detailAktion={(veObj) => (
              // §12.9: Stift schaltet die Technik-Pflege im Screen scharf
              // (kein Sprung ins Objekt — Schnellzugriff pflegt direkt hier).
              <KopfIconButton icon="pencil" title="Technik bearbeiten"
                t={t} accent={(effectiveSettings.kacheln.find(k => k.id === "technik") || {}).farbe || "#10B981"}
                onClick={() => setTechnikEditSignal(s => s + 1)}/>
            )}
            legendeAn={legendeSichtbar(effectiveSettings)}
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
            renderDetail={(veObj) => (
              // ECHTE Quelle: Technik-Geräte der Standort-Karten des Objekts
              // (TechnikUebersichtAnsicht, read-only — gepflegt wird am Objekt).
              <FehlerGrenze t={t}>
              <TechnikPflegeAnsicht ve={veObj} t={t}
                accent={(effectiveSettings.kacheln.find(k => k.id === "technik") || {}).farbe || "#10B981"}
                kontakte={kontakteSichtbar} setKontakte={setKontakte}
                onKontaktClick={gotoKontakt} ves={vesSichtbar}
                setVes={setVes}
                editSignal={technikEditSignal} neuKarteSignal={technikNeuKarteSignal}/>
              </FehlerGrenze>
            )}/>
        )}
        {!suchErg && screen === "dokumente" && (
          <ObjektListeMitDetail
            ves={vesSichtbar} kontakte={kontakteSichtbar}
            setVes={setVes} setKontakte={setKontakte} t={t}
            accent={(effectiveSettings.kacheln.find(k => k.id === "dokumente") || {}).farbe || "#64748B"}
            gotoVE={gotoVE} gotoKontakt={gotoKontakt}
            cardWidth={cardWidth} kartenSpalten={kartenSpalten}
            detailMinBreite={detailMinBreite} detailMin={detailMinBreiteEff} kartenMaxBreite={kartenMaxBreite} kartenMin={kartenMinBreiteEff} listeOpt={listeOpt} listenAnsicht={effectiveSettings.listenAnsicht} festeGridSpec={festeGridSpec}
            viewVEId={dokumenteViewVEId} setViewVEId={(id) => { setDokumenteViewVEId(id); setDokumenteEditMode(false); }}
            istDesktop={istDesktop}
            titel="Dokumente" anzahl={(vesSichtbar || []).length}
            kopfPlus={{ title: "Dokument hochladen", onClick: () => setDokNeuOffen(true) }}
            legendeAn={legendeSichtbar(effectiveSettings)}
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
            detailAktion={() => {
              const dAccent = (effectiveSettings.kacheln.find(k => k.id === "dokumente") || {}).farbe || "#64748B";
              return dokumenteEditMode ? (
                <button onClick={() => setDokumenteEditMode(false)}
                  title="Fertig" aria-label="Fertig"
                  style={{ display: "flex", alignItems: "center", justifyContent: "center",
                    width: 36, height: 36, flexShrink: 0, background: dAccent, border: "none",
                    borderRadius: RAD.pill, cursor: "pointer", boxShadow: `0 1px 2px ${dAccent}40` }}>
                  <I name="check" size={14} color="#FFFFFF"/>
                </button>
              ) : (
                <button onClick={() => setDokumenteEditMode(true)}
                  title="Bearbeiten" aria-label="Bearbeiten"
                  style={{ display: "flex", alignItems: "center", justifyContent: "center",
                    width: 36, height: 36, flexShrink: 0, background: dAccent, border: "none",
                    borderRadius: RAD.pill, cursor: "pointer", boxShadow: `0 1px 2px ${dAccent}40` }}>
                  <I name="pencil" size={14} color={getContrastColor(dAccent)}/>
                </button>
              );
            }}
            renderDetail={(veObj) => (
              <DokumenteScreenDetail
                ve={veObj} setVes={setVes} t={t}
                accent={(effectiveSettings.kacheln.find(k => k.id === "dokumente") || {}).farbe || "#64748B"}
                kontakte={kontakteSichtbar} setKontakte={setKontakte}
                editMode={dokumenteEditMode}
                gotoKontakt={gotoKontakt} ves={vesSichtbar}/>
            )}/>
        )}
        {!suchErg && screen === "fotos" && (
          <ObjektListeMitDetail
            ves={vesSichtbar} kontakte={kontakteSichtbar}
            statusKontext="fotos"
            setVes={setVes} setKontakte={setKontakte} t={t}
            accent={(effectiveSettings.kacheln.find(k => k.id === "fotos") || {}).farbe || "#EC4899"}
            gotoVE={gotoVE} gotoKontakt={gotoKontakt}
            cardWidth={cardWidth} kartenSpalten={kartenSpalten}
            detailMinBreite={detailMinBreite} detailMin={detailMinBreiteEff} kartenMaxBreite={kartenMaxBreite} kartenMin={kartenMinBreiteEff} listeOpt={listeOpt} listenAnsicht={effectiveSettings.listenAnsicht} festeGridSpec={festeGridSpec}
            viewVEId={fotosViewVEId} setViewVEId={(id) => { setFotosViewVEId(id); setFotosEditMode(false); }}
            istDesktop={istDesktop}
            titel="Fotos" anzahl={(vesSichtbar || []).length}
            kopfPlus={{ title: "Fotos hochladen", onClick: () => setFotoNeuOffen(true) }}
            masterBadge={(veObj) => {
              const n = (veObj && Array.isArray(veObj.fotos)) ? veObj.fotos.length : 0;
              return n > 0 ? (n === 1 ? "1 Foto" : n + " Fotos") : null;
            }}
            legendeAn={legendeSichtbar(effectiveSettings)}
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
            detailAktion={() => {
              const fAccent = (effectiveSettings.kacheln.find(k => k.id === "fotos") || {}).farbe || "#EC4899";
              return fotosEditMode ? (
                <button onClick={() => setFotosEditMode(false)}
                  title="Fertig" aria-label="Fertig"
                  style={{ display: "flex", alignItems: "center", justifyContent: "center",
                    width: 36, height: 36, flexShrink: 0, background: fAccent, border: "none",
                    borderRadius: RAD.pill, cursor: "pointer", boxShadow: `0 1px 2px ${fAccent}40` }}>
                  <I name="check" size={14} color="#FFFFFF"/>
                </button>
              ) : (
                <button onClick={() => setFotosEditMode(true)}
                  title="Bearbeiten" aria-label="Bearbeiten"
                  style={{ display: "flex", alignItems: "center", justifyContent: "center",
                    width: 36, height: 36, flexShrink: 0, background: fAccent, border: "none",
                    borderRadius: RAD.pill, cursor: "pointer", boxShadow: `0 1px 2px ${fAccent}40` }}>
                  <I name="pencil" size={14} color={getContrastColor(fAccent)}/>
                </button>
              );
            }}
            renderDetail={(veObj) => (
              // ECHTE Quelle: dieselbe FotosAnsicht wie der Objekt-Tab „Fotos"
              // (Baustein-Regel §76/§85.4: EIN Foto-Inhalt, kein Zweitbau —
              // der Nav-Screen ist reiner Schnellzugriff auf die Objektdaten).
              <FotosAnsicht
                ve={veObj} setVes={setVes} t={t}
                accent={(effectiveSettings.kacheln.find(k => k.id === "fotos") || {}).farbe || "#EC4899"}
                editMode={fotosEditMode}/>
            )}/>
        )}
        {/* §95: Timeline-Sicht der Legionellen-Kachel — EXAKT die Kalender-
            Timeline (KalenderZeile in Dringlichkeits-Buckets, Detail nebendran
            über MasterDetailRahmen, mobil ersetzt das Detail die Liste; Zurück
            im Header-rechts-Slot wie überall). */}
        {!suchErg && screen === "legionellen" && legionellenView === "timeline" && (
          <>
            <ScreenKopf t={t} accent={legionellenAccent} titel="Legionellen"
              onTitelClick={() => setLegionellenTimelineKey(null)}
              mitte={legionellenPille}
              rechts={(legionellenTimelineKey && (!istDesktop || legionellenNurDetail)) ? (
                <HeaderZurueck onClick={() => setLegionellenTimelineKey(null)} t={t}/>
              ) : null}/>
            <LegionellenTimeline
              ves={vesSichtbar} kontakte={kontakteSichtbar}
              setVes={setVes} setKontakte={setKontakte}
              t={t} accent={legionellenAccent}
              gotoVE={gotoVE} gotoKontakt={gotoKontakt}
              istDesktop={istDesktop}
              listenAnsicht={effectiveSettings.listenAnsicht} listeOpt={listeOpt}
              kartenSpalten={kartenSpalten} kartenMaxBreite={kartenMaxBreite} kartenMin={kartenMinBreiteEff}
              detailMinBreite={detailMinBreite} detailMin={detailMinBreiteEff}
              offenKey={legionellenTimelineKey} setOffenKey={setLegionellenTimelineKey}
              onNurDetail={setLegionellenNurDetail}/>
          </>
        )}
        {!suchErg && screen === "legionellen" && legionellenView === "objekte" && (
          <ObjektListeMitDetail
            ves={(vesSichtbar || []).filter(objektHatZentralesWarmwasser)} kontakte={kontakteSichtbar}
            statusKontext="legionellen"
            setVes={setVes} setKontakte={setKontakte} t={t}
            gotoVE={gotoVE} gotoKontakt={gotoKontakt}
            kopfMitte={legionellenPille}
            cardWidth={cardWidth} kartenSpalten={kartenSpalten}
            detailMinBreite={detailMinBreite} detailMin={detailMinBreiteEff} kartenMaxBreite={kartenMaxBreite} kartenMin={kartenMinBreiteEff} listeOpt={listeOpt} listenAnsicht={effectiveSettings.listenAnsicht} festeGridSpec={festeGridSpec}
            istDesktop={istDesktop}
            legendeAn={legendeSichtbar(effectiveSettings)}
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
            accent={legionellenAccent}
            viewVEId={legionellenViewVEId} setViewVEId={(id) => { setLegionellenViewVEId(id); setLegionellenEditMode(false); }}
            titel="Legionellen" anzahl={(vesSichtbar || []).filter(objektHatZentralesWarmwasser).length}
            emptyText="Keine prüfpflichtigen Objekte (zentrale Warmwasserversorgung)."
            detailAktion={(veObj) => {
              // Stift nur bei Prüfpflicht (zentrales Warmwasser) — sonst gibt es
              // nichts zu erfassen und der Hinweis unten erklärt das.
              if (!objektHatZentralesWarmwasser(veObj)) return null;
              const lAccent = legionellenAccent;
              return legionellenEditMode ? (
                <button onClick={() => setLegionellenEditMode(false)}
                  title="Fertig" aria-label="Fertig"
                  style={{ display: "flex", alignItems: "center", justifyContent: "center",
                    width: 36, height: 36, flexShrink: 0, background: lAccent, border: "none",
                    borderRadius: RAD.pill, cursor: "pointer", boxShadow: `0 1px 2px ${lAccent}40` }}>
                  <I name="check" size={14} color="#FFFFFF"/>
                </button>
              ) : (
                <button onClick={() => setLegionellenEditMode(true)}
                  title="Bearbeiten" aria-label="Bearbeiten"
                  style={{ display: "flex", alignItems: "center", justifyContent: "center",
                    width: 36, height: 36, flexShrink: 0, background: lAccent, border: "none",
                    borderRadius: RAD.pill, cursor: "pointer", boxShadow: `0 1px 2px ${lAccent}40` }}>
                  <I name="pencil" size={14} color={getContrastColor(lAccent)}/>
                </button>
              );
            }}
            renderDetail={(veObj) => (
              // ECHTE Quelle: dieselbe LegionellenAnsicht wie der Objekt-Tab.
              // Ohne zentrale Warmwasserversorgung besteht keine Prüfpflicht
              // (TrinkwV) — dann Hinweis statt leerer Erfassung.
              objektHatZentralesWarmwasser(veObj) ? (
                <LegionellenAnsicht ve={veObj} setVes={setVes} t={t}
                  accent={legionellenAccent}
                  editMode={legionellenEditMode}
                  kontakte={kontakteSichtbar} onKontaktClick={gotoKontakt}/>
              ) : (
                <div style={{ background: t.card, border: `1px solid ${t.border}`,
                  borderRadius: RAD.lg, padding: "16px 18px", fontSize: FS.m,
                  color: t.muted, lineHeight: 1.5 }}>
                  Dieses Objekt hat keine zentrale Warmwasserversorgung — die
                  Legionellen-Prüfpflicht nach TrinkwV besteht hier nicht.
                  (Einstellbar an der Technik-Karte des Gebäudes.)
                </div>
              )
            )}/>
        )}
        {!suchErg && screen === "te" && (
          <ObjektListeMitDetail
            ves={vesSichtbar} kontakte={kontakteSichtbar}
            setVes={setVes} setKontakte={setKontakte} t={t}
            gotoVE={gotoVE} gotoKontakt={gotoKontakt}
            cardWidth={cardWidth} kartenSpalten={kartenSpalten}
            detailMinBreite={detailMinBreite} detailMin={detailMinBreiteEff} kartenMaxBreite={kartenMaxBreite} kartenMin={kartenMinBreiteEff} listeOpt={listeOpt} listenAnsicht={effectiveSettings.listenAnsicht} festeGridSpec={festeGridSpec}
            istDesktop={istDesktop}
            legendeAn={legendeSichtbar(effectiveSettings)}
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
            accent={(effectiveSettings.kacheln.find(k => k.id === "te") || {}).farbe || "#A855F7"}
            viewVEId={teViewVEId} setViewVEId={setTeViewVEId}
            titel="Teilungserklärung" anzahl={(vesSichtbar || []).length}
            emptyText="Kein TE-Register für dieses Objekt."
            renderDetail={(veObj) => (
              // ECHTE Quelle: dasselbe TE-Klausel-Register wie der Objekt-Tab.
              <TERegisterAnsicht ve={veObj} t={t}
                accent={(effectiveSettings.kacheln.find(k => k.id === "te") || {}).farbe || "#A855F7"}/>
            )}/>
        )}
        {!suchErg && screen === "historie" && (
          <ObjektListeMitDetail
            ves={vesSichtbar} kontakte={kontakteSichtbar}
            setVes={setVes} setKontakte={setKontakte} t={t}
            gotoVE={gotoVE} gotoKontakt={gotoKontakt}
            cardWidth={cardWidth} kartenSpalten={kartenSpalten}
            detailMinBreite={detailMinBreite} detailMin={detailMinBreiteEff} kartenMaxBreite={kartenMaxBreite} kartenMin={kartenMinBreiteEff} listeOpt={listeOpt} listenAnsicht={effectiveSettings.listenAnsicht} festeGridSpec={festeGridSpec}
            istDesktop={istDesktop}
            legendeAn={legendeSichtbar(effectiveSettings)}
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
            accent={(effectiveSettings.kacheln.find(k => k.id === "historie") || {}).farbe || "#F97316"}
            viewVEId={historieViewVEId} setViewVEId={setHistorieViewVEId}
            titel="Historie" anzahl={(vesSichtbar || []).length}
            emptyText="Keine Historie für dieses Objekt."
            renderDetail={(veObj) => (
              // ECHTE Quelle: dieselbe HistorieAnsicht wie der Objekt-Tab.
              <HistorieAnsicht ve={veObj} t={t}
                accent={(effectiveSettings.kacheln.find(k => k.id === "historie") || {}).farbe || "#F97316"}
                kontakte={kontakteSichtbar} setKontakte={setKontakte}
                onKontaktClick={gotoKontakt}/>
            )}/>
        )}
        {!suchErg && screen === "kommunikation" && (
          <ObjektListeMitDetail
            ves={vesSichtbar} kontakte={kontakteSichtbar}
            setVes={setVes} setKontakte={setKontakte} t={t}
            accent={(effectiveSettings.kacheln.find(k => k.id === "kommunikation") || {}).farbe || "#0EA5E9"}
            gotoVE={gotoVE} gotoKontakt={gotoKontakt}
            cardWidth={cardWidth} kartenSpalten={kartenSpalten}
            detailMinBreite={detailMinBreite} detailMin={detailMinBreiteEff} kartenMaxBreite={kartenMaxBreite} kartenMin={kartenMinBreiteEff} listeOpt={listeOpt} listenAnsicht={effectiveSettings.listenAnsicht} festeGridSpec={festeGridSpec}
            viewVEId={kommunikationViewVEId} setViewVEId={setKommunikationViewVEId}
            istDesktop={istDesktop}
            titel="Kommunikation" anzahl={(vesSichtbar || []).length}
            kopfPlus={{ title: "Neu", onClick: () => setKommPlusHinweis(true) }}
            legendeAn={legendeSichtbar(effectiveSettings)}
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
            statusKontext="finanzen"
            setVes={setVes} setKontakte={setKontakte} t={t}
            accent={(effectiveSettings.kacheln.find(k => k.id === "finanzen") || {}).farbe || "#22C55E"}
            gotoVE={gotoVE} gotoKontakt={gotoKontakt}
            cardWidth={cardWidth} kartenSpalten={kartenSpalten}
            detailMinBreite={detailMinBreite} detailMin={detailMinBreiteEff} kartenMaxBreite={kartenMaxBreite} kartenMin={kartenMinBreiteEff} listeOpt={listeOpt} listenAnsicht={effectiveSettings.listenAnsicht} festeGridSpec={festeGridSpec}
            viewVEId={finanzenViewVEId} setViewVEId={setFinanzenViewVEId}
            istDesktop={istDesktop}
            titel="Finanzen" anzahl={(vesSichtbar || []).length}
            legendeAn={legendeSichtbar(effectiveSettings)}
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
            listenAnsicht={effectiveSettings.listenAnsicht} kartenSpalten={kartenSpalten}
            kartenMaxBreite={kartenMaxBreite} kartenMin={kartenMinBreiteEff}
            detailMinBreite={detailMinBreite} detailMin={detailMinBreiteEff} listeOpt={listeOpt} festeGridSpec={festeGridSpec}
            legendeEl={baueObjektLegende((effectiveSettings.kacheln.find(k => k.id === "listen") || {}).farbe || "#0E7490")}
            accent={(effectiveSettings.kacheln.find(k => k.id === "listen") || {}).farbe || "#0E7490"}/>
        )}
        {!suchErg && screen === "schnelleingabe" && (
          <SchnelleingabeScreen ves={vesSichtbar} setVes={setVes} kontakte={kontakteSichtbar} t={t}
            settings={effectiveSettings} listenAnsicht={effectiveSettings.listenAnsicht}
            kartenSpalten={kartenSpalten} kartenMaxBreite={kartenMaxBreite} kartenMin={kartenMinBreiteEff}
            detailMinBreite={detailMinBreite} detailMin={detailMinBreiteEff} listeOpt={listeOpt} festeGridSpec={festeGridSpec}
            legendeEl={baueObjektLegende((effectiveSettings.kacheln.find(k => k.id === "schnelleingabe") || {}).farbe || "#0080FF")}
            accent={(effectiveSettings.kacheln.find(k => k.id === "schnelleingabe") || {}).farbe || "#0080FF"}/>
        )}
        {!suchErg && screen === "statistik" && (
          <StatistikScreen ves={vesSichtbar} kontakte={kontakteSichtbar} t={t}
            settings={effectiveSettings} listenAnsicht={effectiveSettings.listenAnsicht}
            kartenSpalten={kartenSpalten} kartenMaxBreite={kartenMaxBreite} kartenMin={kartenMinBreiteEff}
            detailMinBreite={detailMinBreite} detailMin={detailMinBreiteEff} listeOpt={listeOpt} festeGridSpec={festeGridSpec}
            legendeEl={baueObjektLegende((effectiveSettings.kacheln.find(k => k.id === "statistik") || {}).farbe || "#6366F1")}
            accent={(effectiveSettings.kacheln.find(k => k.id === "statistik") || {}).farbe || "#6366F1"}/>
        )}
            </div> {/* /contentRef */}
          </div> {/* /maxWidth 1100 */}
        </div>   {/* /Content scroll */}
        {kalDockAktiv ? (
          <KalenderPanel variante="dock" offen={true} onClose={() => setKalDockOffen(false)}
            termine={dockTermine} settings={effectiveSettings} t={t}
            accent={kalenderAccent}
            ves={ves} kontakte={kontakte} setVes={setVes} setKontakte={setKontakte} setFreieTermine={setFreieTermine}
            onGotoVE={(id, ziel) => gotoVE(id, ziel)} onGotoKontakt={gotoKontakt}
            onGotoTermin={gotoTermin}/>
        ) : null}
        {!istDesktop ? (
          <KalenderPanel variante="overlay" offen={kalPanelMobilOffen}
            onClose={() => setKalPanelMobilOffen(false)}
            termine={dockTermine} settings={effectiveSettings} t={t}
            accent={kalenderAccent}
            ves={ves} kontakte={kontakte} setVes={setVes} setKontakte={setKontakte} setFreieTermine={setFreieTermine}
            onGotoVE={(id, ziel) => gotoVE(id, ziel)} onGotoKontakt={gotoKontakt}
            onGotoTermin={gotoTermin}/>
        ) : null}
      </div>     {/* /Flex container */}
    </div>
    </KontaktAnzeigeContext.Provider>
    </KontaktFarbeContext.Provider>
    </LoeschenErlaubtContext.Provider>
    </EinheitAnzeigeContext.Provider>
    </ObjektTabsContext.Provider>
    </HandlungsbedarfContext.Provider>
    </ZeitPickerContext.Provider>
    </TerminBezeichnungenContext.Provider>
    </StatusLeisteContext.Provider>
    </KartenBadgesContext.Provider>
    </DokumentViewerBgContext.Provider>
    </DokumenteKartenContext.Provider>
    </KartenIconsContext.Provider>
    </FristenContext.Provider>
    </VorlagenContext.Provider>
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




