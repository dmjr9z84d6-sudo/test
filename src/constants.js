// constants.js — SEKTION 1 (aus allesda_merged.jsx extrahiert, Stand 11.73)
// Design-Tokens, Themes, Farben, Rollen-/Verwendungs-/Kategorie-Konstanten und
// die zugehörigen reinen Helfer (Farb-Logik, Namens-Formatierung/-Sortierung).
// Kein React-Bedarf. Modul-globaler Farb-State (_farbIntensitaet) bleibt hier
// gekapselt; nur setFarbIntensitaet/toGrau/mischeRichtungGrau greifen darauf zu.

// ╔═════════════════════════════════════════════════════════════════════════╗
// ║ SEKTION 1 · KONSTANTEN                                                  ║
// ║ Fonts, Themes (DARK/LIGHT), Akzent-Farben                               ║
// ╚═════════════════════════════════════════════════════════════════════════╝

export const FONT_URL = "https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap";
export const FONT = "'Plus Jakarta Sans', sans-serif";

export const DARK  = { bg:"#07070C", surface:"#0D0D16", card:"#13131F", border:"#252540", text:"#F0F0FF", sub:"#A0A0CD", muted:"#7575A0", header:"#0D0D14" };
export const LIGHT = { bg:"#ECEEF3", surface:"#F4F6FA", card:"#FFFFFF",  border:"#D8DCE8", text:"#0F1022", sub:"#4A5072", muted:"#737896", header:"#FFFFFF" };

export const ACCENT = "#0E7490"; // Objekte (Cyan)
export const KONTAKTE_FARBE = "#8B5CF6"; // Personen + Firmen (Violett) — konfigurierbar via Schnellzugriff

// ── Design-Tokens ───────────────────────────────────────────────────────────
// Bewusst schlank und an die TATSÄCHLICH im Code verwendeten Cluster-Werte
// angelehnt (keine erfundene Skala). Schrittweise Migration: neue/angefasste
// Stellen nutzen Tokens, Bestand wird nach und nach umgestellt. Erweiterbar.
//   RAD — Border-Radien:   sm=Standard-Buttons/Inputs, md=Karten-nah, lg=Karten,
//                          pill=Status-Pills, full=runde Icon-Buttons.
//   FS  — Font-Sizes (px): xs=Mikro-Label, s=Sekundär, m=Standard, l=betont,
//                          icon=Icon-Buttons.
//   FW  — Font-Weights:    medium=Standard-Button, bold=betont, heavy=Titel.
export const RAD = { sm: 6, ms: 8, md: 9, ml: 10, lg: 12, xl: 16, pill: 999, full: "50%" };
export const FS  = { xxs: 9, xs: 10, s: 11, m: 12, l: 13, xl: 14, input: 16, icon: 18, xxl: 20 };
export const FW  = { regular: 400, semi: 500, medium: 600, bold: 700, heavy: 800 };

// ── Einheitliche Kachel-Breite (systemweit) ─────────────────────────────────
// Objekt-/Kontakt-Kacheln haben IMMER dieselbe feste Breite und werden NIE
// gedehnt (kein 1fr). So sehen sie in Liste, Master-Detail, Kontakten und
// Einstellungen identisch aus; bei viel Platz bleibt rechts Abstand statt
// breitgezogener Karten. Auf schmalen Schirmen (Mobil) fällt das Grid über
// `KACHEL_GRID` automatisch auf eine volle Spalte zurück.
export const KACHEL_W = 340;
// Grid-Style für gleich breite Kacheln: so viele KACHEL_W-Spalten wie passen,
// linksbündig, Rest bleibt leer. `minmax(min(100%, KACHEL_W), KACHEL_W)` hält
// die Spalte exakt auf KACHEL_W (kein Dehnen), lässt sie aber auf schmalen
// Containern (Mobil < KACHEL_W) auf 100 % schrumpfen statt überzulaufen.
// Die Spalten-Formel steckt in der CSS-Variable `--ad-kg`: Desktop-Default =
// festes 340px-Raster; auf Mobil setzt `.ad-root-mobile` (allesda_merged.jsx)
// `--ad-kg: 1fr` → EINE Spalte volle Breite (flexibel, wie die Detail-Karte).
// So wird das mobile 1-Spalten-Verhalten an EINER Stelle gesteuert, ohne jede
// Grid-Nutzungsstelle anzufassen.
export const KACHEL_GRID = {
  display: "grid",
  gridTemplateColumns: `var(--ad-kg, repeat(auto-fill, minmax(min(100%, ${KACHEL_W}px), ${KACHEL_W}px)))`,
  justifyContent: "start",
  gap: 10,
};

// kachelGridBreite — wie KACHEL_GRID, aber mit einstellbarer Kartenbreite.
// Genutzt in der Master-Übersicht (nurMaster), damit die auto-fill-Kacheln
// dieselbe Breite haben wie die berechneten Karten im Detail-Fall — sonst
// laufen die Breiten auseinander (Übersicht 340 vs Detail-Fall die eingestellte
// Breite). Respektiert weiterhin die CSS-Variable --ad-kg (Mobil = 1 Spalte).
export function kachelGridBreite(kartenBreite, einspaltig) {
  // einspaltig=true → hartes 1fr (EINE Spalte, volle Breite). Bewusst NICHT über
  // var(--ad-kg): Inline-Style gewinnt immer und ist unabhängig davon, ob die
  // .ad-root-mobile-Klassenregel auf dem Gerät greift (Mobil-Overflow-Fix).
  if (einspaltig) {
    return { display: "grid", gridTemplateColumns: "1fr", justifyContent: "stretch", gap: 10 };
  }
  const w = Math.max(160, kartenBreite || KACHEL_W);
  return {
    display: "grid",
    gridTemplateColumns: `var(--ad-kg, repeat(auto-fill, minmax(min(100%, ${w}px), ${w}px)))`,
    justifyContent: "start",
    gap: 10,
  };
}

// ── kartenGridStyle — DIE EINE Quelle fürs Karten-Raster (§76) ──────────────
// Jede Master-Übersicht (Objekte, Kontakte, Schnelleingabe, Listengenerator,
// Statistik und künftige Bereichs-Kacheln) holt ihren Grid-Style NUR hier.
// Kein Screen baut mehr selbst `KACHEL_GRID`/`kachelGridBreite` mit eigener
// Mobil-/Spalten-Logik zusammen — sonst driften die Screens wieder auseinander
// (genau der Bug, der Objekte/Kontakte unterschiedlich breit machte).
//
// Erwartet das `layout`-Objekt aus MasterDetailRahmen/passendeMasterSpalten:
//   { einspaltig, nurMaster, cols, kartenBreite, kartenMaxBreite, festeGridSpec }
// Regeln (Reihenfolge = Priorität):
//   • einspaltig (Mobil)      → hartes 1fr, EINE Spalte volle Breite. GEWINNT
//                               IMMER, auch über festeGridSpec — sonst greift auf
//                               Mobil fälschlich das feste repeat(N,…px)-Raster
//                               (linksbündig, Leerraum rechts = genau der Bug).
//   • festeGridSpec (Desktop) → explizit vorgegebene Spalten-Spezifikation.
//   • nurMaster (Übersicht)   → auto-fill mit kartenMaxBreite (volle Breite füllen).
//   • Detail offen (Desktop)  → feste Spaltenzahl × kartenBreite.
// extra = optionale Zusatz-Styles (z. B. alignContent:"start").
export function kartenGridStyle(layout, extra) {
  const lay = layout || {};
  const zusatz = extra || {};
  if (lay.einspaltig) {
    return { display: "grid", gridTemplateColumns: "1fr", justifyContent: "stretch", gap: 10, ...zusatz };
  }
  if (lay.festeGridSpec) {
    return { ...KACHEL_GRID, gridTemplateColumns: lay.festeGridSpec, ...zusatz };
  }
  if (lay.nurMaster) {
    return { ...kachelGridBreite(lay.kartenMaxBreite, false), ...zusatz };
  }
  const cols = Math.max(1, lay.cols || 1);
  return { ...KACHEL_GRID, gridTemplateColumns: `repeat(${cols}, ${lay.kartenBreite}px)`, ...zusatz };
}

// ── Zentrale Eingabefeld-/Label-Styles ──────────────────────────────────────
// Vermeidet ~40 byte-gleiche Inline-Style-Objekte in Formularen. Die Varianten
// unterscheiden sich nur in padding/fontSize/borderRadius — daher parametriert.
// Kern (width, boxSizing, surface-Hintergrund, Rahmen, Farbe, Schrift, outline)
// ist überall identisch.
export function feldInput(t, opts) {
  const o = opts || {};
  return {
    width: "100%", boxSizing: "border-box", background: t.surface,
    border: `1px solid ${t.border}`, borderRadius: o.radius || RAD.sm,
    padding: o.padding || "5px 8px", fontSize: o.fontSize || FS.input,
    color: t.text, outline: "none", fontFamily: "inherit",
  };
}
// Standard-Label über einem Eingabefeld (kleine, gedämpfte Beschriftung).
export function feldLabel(t, opts) {
  const o = opts || {};
  const base = { fontSize: FS.xs, color: o.color || t.muted, marginBottom: o.marginBottom || 3 };
  if (o.uppercase) { base.fontWeight = FW.medium; base.textTransform = "uppercase"; base.letterSpacing = "0.05em"; }
  return base;
}


// Version-Stempel — wird unter dem Logo als kleine Subline angezeigt.
// Bei jedem Build auch in index.html (Title, Lade-Indikator, ?v=) mitziehen.
export const APP_VERSION = "14.23";
export const FIRMEN_FARBE   = KONTAKTE_FARBE; // identisch — Unterscheidung erfolgt über Avatar-Form + Inhalt

// ── Handlungs-Ampel-Farbtöne (§96) ───────────────────────────────────────────
// EINE Quelle für alle Ampel-Punkte: die 5-stufige Vorgangs-Ampel UND der
// 3-stufige Objekt-Status-Punkt (HANDLUNGSBEDARF_FARBEN in objektansicht.jsx
// = Teilmenge rot/gelb/gruen hieraus). Töne sind die etablierten Statusfarben
// des Projekts (rot/gelb wie LEGIONELLEN_STATUS_FARBE, blau/grau wie Bestand).
export const AMPEL_FARBEN = {
  rot:   "#EF4444", // überfällig / Frist verpasst
  gelb:  "#F59E0B", // Handlung fällig
  blau:  "#3B82F6", // offener Entwurf (erfasst)
  gruen: "#22C55E", // läuft
  grau:  "#94A3B8", // ruht berechtigt / geschlossen
};

// ── Seriös-Modus Farbe ───────────────────────────────────────────────────────
// Im "Weniger Farbe"-Modus wird eine einzige neutrale Graufarbe für ALLE
// Akzente verwendet — einheitlich, professionell, kein Farbton.
export const SERIOES_GRAU = "#6B7280";
// Globale Farb-Intensität (0..1). 1 = volle Akzentfarben, 0 = neutrales Grau
// (= alter "Weniger Farbe"-Modus). Wird von der App-Komponente bei jedem Render
// aus settings.farbIntensitaet gesetzt; toGrau() liest sie. Modul-Level statt
// Context, weil toGrau eine reine Helferfunktion außerhalb der Render-Bäume ist.
let _farbIntensitaet = 1;
export function setFarbIntensitaet(v) {
  const n = (typeof v === "number" && isFinite(v)) ? v : 1;
  _farbIntensitaet = Math.max(0, Math.min(1, n));
}
// Mischt eine Hex-Farbe Richtung Grau. t=1 → Originalfarbe, t=0 → SERIOES_GRAU.
export function mischeRichtungGrau(hex, t) {
  if (!hex || hex[0] !== "#" || hex.length < 7) return hex;
  const f = Math.max(0, Math.min(1, t));
  try {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    const gr = parseInt(SERIOES_GRAU.slice(1, 3), 16);
    const gg = parseInt(SERIOES_GRAU.slice(3, 5), 16);
    const gb = parseInt(SERIOES_GRAU.slice(5, 7), 16);
    const mix = (c, grau) => Math.round(grau + (c - grau) * f);
    const hx = (n) => ("0" + n.toString(16)).slice(-2);
    return "#" + hx(mix(r, gr)) + hx(mix(g, gg)) + hx(mix(b, gb));
  } catch (e) { return hex; }
}
export function toGrau(hex) {
  if (!hex) return hex;
  return mischeRichtungGrau(hex, _farbIntensitaet);
}

// ── getContrastColor: wählt schwarz oder weiß als Vordergrundfarbe je nach
// Helligkeit der Hintergrundfarbe (WCAG-konforme relative Luminance).
// Bei hellen Hintergründen (z. B. Gelb, helles Grün) → Schwarz für Lesbarkeit,
// bei dunklen → Weiß. Schwelle 0.55 ist empirisch gewählt für gute Lesbarkeit
// im Standard-Pillen-/Badge-Kontext mit Bold-Text.
export function getContrastColor(hex) {
  if (!hex || hex[0] !== "#" || hex.length < 7) return "#FFFFFF";
  try {
    const r = parseInt(hex.slice(1, 3), 16) / 255;
    const g = parseInt(hex.slice(3, 5), 16) / 255;
    const b = parseInt(hex.slice(5, 7), 16) / 255;
    // sRGB → lineares RGB (Gamma-Korrektur), dann WCAG-Luminance
    const lin = (c) => c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
    const lum = 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
    return lum > 0.55 ? "#1A1A1A" : "#FFFFFF";
  } catch (e) {
    return "#FFFFFF";
  }
}

// ── relLuminanz: WCAG-relative Luminance einer Hex-Farbe (0=schwarz, 1=weiß).
// Interner Helfer für Kontrastberechnungen.
function relLuminanz(hex) {
  if (!hex || hex[0] !== "#" || hex.length < 7) return 1;
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  const lin = (c) => c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

// ── iconAufBg: liefert eine Akzentfarbe, die auf dem gegebenen Hintergrund
// (bg) lesbar bleibt. Helle Akzente (Gelb, helles Grün) auf hellem Header
// verschwinden sonst — dann wird der Akzent so weit Richtung Schwarz
// abgedunkelt (mit gemeinsamem Hintergrund gemischt), dass genug Kontrast
// entsteht. Auf dunklem Hintergrund bleibt der Akzent unverändert.
// Rückgabe ist immer ein gültiger Hex-String.
export function iconAufBg(accent, bg) {
  if (!accent || accent[0] !== "#" || accent.length < 7) return accent || "#000000";
  const bgLum = relLuminanz(bg);
  const acLum = relLuminanz(accent);
  // Kontrast (WCAG) zwischen Akzent und Hintergrund.
  const hell = Math.max(acLum, bgLum) + 0.05;
  const dunkel = Math.min(acLum, bgLum) + 0.05;
  const ratio = hell / dunkel;
  if (ratio >= 3) return accent; // genug Kontrast → unverändert
  // Zu wenig Kontrast. Auf hellem Hintergrund abdunkeln, auf dunklem aufhellen,
  // indem der Akzent schrittweise Richtung Schwarz/Weiß gemischt wird, bis das
  // 3:1-Ziel erreicht ist (oder das Maximum).
  const zielSchwarz = bgLum > 0.5; // heller Hintergrund → Richtung Schwarz
  const r0 = parseInt(accent.slice(1, 3), 16);
  const g0 = parseInt(accent.slice(3, 5), 16);
  const b0 = parseInt(accent.slice(5, 7), 16);
  const ziel = zielSchwarz ? 0 : 255;
  const toHex = (n) => Math.round(n).toString(16).padStart(2, "0");
  for (let f = 0.1; f <= 1.0; f += 0.1) {
    const r = r0 + (ziel - r0) * f;
    const g = g0 + (ziel - g0) * f;
    const b = b0 + (ziel - b0) * f;
    const kand = "#" + toHex(r) + toHex(g) + toHex(b);
    const kl = relLuminanz(kand);
    const h2 = Math.max(kl, bgLum) + 0.05;
    const d2 = Math.min(kl, bgLum) + 0.05;
    if (h2 / d2 >= 3) return kand;
  }
  return zielSchwarz ? "#1A1A1A" : "#FFFFFF";
}

// Rollen-Slots (Avatar-Eckpositionen):
//   "ve"      → unten-rechts (Eigentümer, Mieter, Nießbraucher, Wohnberechtigter)
//   "sev"     → oben-links   (SEV-Bevollmächtigter)
//   "gremium" → oben-rechts  (Verwaltungsbeirat [+vorsitz=VBV], Rechnungsprüfer)
//   "firma"   → unten-links  (Geschäftsführer, Mitarbeiter, Sachbearbeiter, Ansprechpartner)
// Hinweis: VBR-Vorsitzender ist KEINE eigene Rolle, sondern "Verwaltungsbeirat" mit vorsitz:true.
export const DEFAULT_ROLLEN = [
  // Person VE
  { name: "Eigentümer",               kuerzel: "E",   color: "#F472B6", slot: "ve",      aktiv: true }, // Pink
  { name: "Mieter",                   kuerzel: "M",   color: "#22C55E", slot: "ve",      aktiv: true, kategorie: "miete" }, // Grün
  { name: "Pächter",                  kuerzel: "P",   color: "#16A34A", slot: "ve",      aktiv: true }, // Grün dunkel — Pacht (Vertragspartei)
  // Konkrete Wohn-/Nutzungsrechte. Ersetzen die frühere Sammelrolle „Bewohner":
  // Jedes Haushaltsmitglied trägt sein echtes Recht (Quelle: BEWOHNER_RECHTE),
  // das Label wird daraus abgeleitet. „Angehöriger"/„Sonstige" decken Mitwohnende
  // ohne eigenen Rechtstitel ab. Avatar-Eck bewusst zurückhaltend (eckSichtbar:false)
  // bei den „normalen" Wohnverhältnissen — Badge erscheint dennoch im Profil/Einheit.
  // HINWEIS: „Eigennutzer" ist bewusst KEINE Rolle (v11.92). Selbstnutzung lebt nur
  // als Bewohner-Recht (BEWOHNER_RECHTE id:"eigennutzer") und zeigt sich über den
  // goldenen Ring an der Eigentümer-Karte + „selbst bewohnt" an der Einheit — nie als
  // eigene Rolle/Badge. Die abgeleitete Rollen-Erzeugung überspringt das Recht generell
  // (datenmodell.js objektZuweisungenAusEinheiten + utils-icons.jsx belegungsRollenFuerKontakt).
  { name: "Nießbraucher",             kuerzel: "N",   color: "#9333EA", slot: "ve",      aktiv: true, kategorie: "niessbrauch" }, // Lila
  { name: "Wohnberechtigter",         kuerzel: "W",   color: "#0891B2", slot: "ve",      aktiv: true, kategorie: "wohnrecht" }, // Cyan
  { name: "Angehöriger",              kuerzel: "AG",  color: "#64748B", slot: "ve",      aktiv: true, eckSichtbar: false }, // Schiefer — mitwohnend ohne eigenen Rechtstitel
  { name: "Sonstige",                 kuerzel: "S",   color: "#64748B", slot: "ve",      aktiv: true, eckSichtbar: false }, // Schiefer
  // SEV
  { name: "Bevollmächtigter",         kuerzel: "BV",  color: "#0891B2", slot: "sev",     aktiv: true }, // Cyan
  { name: "Betreuer",                 kuerzel: "BT",  color: "#0369A1", slot: "sev",     aktiv: true }, // Blau dunkel
  // Zusatzfunktionen (Gremium)
  { name: "Verwaltungsbeirat",        kuerzel: "VB",  color: "#15803D", slot: "gremium", aktiv: true }, // Grün; mit vorsitz:true wird das VBV
  { name: "Rechnungsprüfer",          kuerzel: "RP",  color: "#047857", slot: "gremium", aktiv: true }, // Smaragd
  // Person Firma / Hausverwaltung
  { name: "Verwalter",                kuerzel: "VW",  color: "#2563EB", slot: "firma",   aktiv: true }, // Blau (analog Firmen-Rolle Hausverwaltung)
  { name: "Buchhalter",               kuerzel: "BH",  color: "#0E7490", slot: "firma",   aktiv: true }, // Cyan dunkel
  { name: "Geschäftsführer",          kuerzel: "GF",  color: "#4338CA", slot: "firma",   aktiv: true }, // Indigo
  { name: "Mitarbeiter",              kuerzel: "MA",  color: "#7C3AED", slot: "firma",   aktiv: true }, // Violett
  { name: "Sachbearbeiter",           kuerzel: "SB",  color: "#9333EA", slot: "firma",   aktiv: true }, // Lila
  { name: "Ansprechpartner",          kuerzel: "AP",  color: "#C026D3", slot: "firma",   aktiv: true }, // Magenta — Objekt/Firma wird aus der Zuweisung abgeleitet
];


// ── Rollen-Anzeige-Logik ────────────────────────────────────────────────────
// Pro Rolle drei Felder zusätzlich zum Datenmodell:
//   · eckSichtbar  (bool)         — am Avatar als Eck-Icon anzeigen?
//   · eckPosition  ("OL"|"OR"|"UL"|"UR") — welche Ecke?
//   · badgeSichtbar(bool)         — hinten auf der Karte als Badge anzeigen?
// Default-Werte werden NICHT in die User-Daten geschrieben, sondern bei Bedarf
// aus dem `slot` (für Position) bzw. dem alten `aktiv`-Flag (für Sichtbarkeit)
// abgeleitet. So funktioniert die App auch mit Bestandsdaten ohne Migration.
export const SLOT_TO_ECK = { ve: "UR", firma: "UL", sev: "OL", gremium: "OR" };
export function rolleEckPosition(rolle) {
  if (!rolle) return "UR";
  if (rolle.eckPosition && ["OL","OR","UL","UR"].indexOf(rolle.eckPosition) >= 0) {
    return rolle.eckPosition;
  }
  return SLOT_TO_ECK[rolle.slot] || "UR";
}
export function rolleEckSichtbar(rolle) {
  if (!rolle) return false;
  if (typeof rolle.eckSichtbar === "boolean") return rolle.eckSichtbar;
  return rolle.aktiv !== false;
}
export function rolleBadgeSichtbar(rolle) {
  if (!rolle) return false;
  if (typeof rolle.badgeSichtbar === "boolean") return rolle.badgeSichtbar;
  return rolle.aktiv !== false;
}

// ── Verwendungen (Objekt-Einheiten) ─────────────────────────────────────────
// Eine "Verwendung" beschreibt wie eine Einheit (WE, Stellplatz, TG, Raum …)
// derzeit genutzt wird. Pro Einheit normalerweise EINE Verwendung mit Status
// (aktiv / werdend / ehemalig). Auf Objekt-Ebene werden die Verwendungen aller
// Einheiten aggregiert und am Avatar (Eck-Icons) und auf der Karte (Badges)
// angezeigt — analog zu Rollen bei Kontakten.
export const DEFAULT_VERWENDUNGEN = [
  { name: "Vermietet",                  kuerzel: "VM", color: "#10B981", eckPosition: "UR", aktiv: true, kategorie: "miete" }, // erbt aus Kategorie „miete"
  { name: "Eigennutzung",               kuerzel: "EN", color: "#3B82F6", eckPosition: "OR", aktiv: true }, // Blau
  { name: "Leerstand",                  kuerzel: "LS", color: "#DC2626", eckPosition: "UL", aktiv: true }, // Rot
  { name: "Sondereigentumsverwaltung",  kuerzel: "SEV",color: "#7C3AED", eckPosition: "OL", aktiv: true, kategorie: "sev" }, // erbt aus Kategorie „sev"
  { name: "Sondernutzungsrecht",        kuerzel: "SNR",color: "#0E7490", eckPosition: "OL", aktiv: true }, // Cyan dunkel
  { name: "Verpachtet",                 kuerzel: "VP", color: "#CA8A04", eckPosition: "UR", aktiv: true }, // Senf
  { name: "Nießbrauch",                 kuerzel: "NB", color: "#9333EA", eckPosition: "OR", aktiv: true, kategorie: "niessbrauch" }, // erbt aus Kategorie
  { name: "Wohnberechtigt",             kuerzel: "WB", color: "#0891B2", eckPosition: "UL", aktiv: true, kategorie: "wohnrecht" }, // erbt aus Kategorie
];

// ── KATEGORIEN (gemeinsame Quelle für Kürzel + Farbe von Paaren) ─────────────
// Wo Verwendung UND Rolle dasselbe Konzept beschreiben (Miete, Nießbrauch,
// Wohnrecht, SEV), liegen Kürzel+Farbe EINMAL hier. Verwendung/Rolle tragen ein
// `kategorie`-Feld und ERBEN diese Werte (siehe effKuerzel/effColor). Eigene
// Eigenheiten (eckPosition, slot, Sichtbarkeit) bleiben bei Verwendung/Rolle.
// Vorlage sind die Rollen-Werte (Mieter-Grün etc.).
export const DEFAULT_KATEGORIEN = [
  { id: "miete",       label: "Miete",       kuerzel: "M",   color: "#22C55E" }, // = Rolle Mieter / Verwendung Vermietet
  { id: "niessbrauch", label: "Nießbrauch",  kuerzel: "N",   color: "#0EA5E9" }, // = Nießbraucher / Nießbrauch
  { id: "wohnrecht",   label: "Wohnrecht",   kuerzel: "W",   color: "#A855F7" }, // = Wohnberechtigter / Wohnberechtigt
  { id: "sev",         label: "SEV",         kuerzel: "SEV", color: "#7C3AED" }, // = Rolle SEV / Verwendung SEV
];
// Auflösung: effektives Kürzel/Farbe eines Verwendungs- oder Rollen-Defs.
// Trägt es eine kategorie und existiert die, gewinnen Kategorie-Werte; sonst
// der Eigenwert des Defs.
export function kategorieVon(def, kategorien) {
  if (!def || !def.kategorie) return null;
  const liste = Array.isArray(kategorien) ? kategorien : DEFAULT_KATEGORIEN;
  return liste.find(k => k.id === def.kategorie) || null;
}
export function effKuerzel(def, kategorien) {
  if (!def) return "";
  const kat = kategorieVon(def, kategorien);
  return (kat && kat.kuerzel) || def.kuerzel || "";
}
export function effColor(def, kategorien) {
  if (!def) return "#64748B";
  const kat = kategorieVon(def, kategorien);
  return (kat && kat.color) || def.color || "#64748B";
}

export function verwendungEckPosition(v) {
  if (!v) return "UR";
  if (v.eckPosition && ["OL","OR","UL","UR"].indexOf(v.eckPosition) >= 0) {
    return v.eckPosition;
  }
  return "UR";
}
export function verwendungEckSichtbar(v) {
  if (!v) return false;
  if (typeof v.eckSichtbar === "boolean") return v.eckSichtbar;
  return v.aktiv !== false;
}
export function verwendungBadgeSichtbar(v) {
  if (!v) return false;
  if (typeof v.badgeSichtbar === "boolean") return v.badgeSichtbar;
  return v.aktiv !== false;
}

// ── Kontakt-Name-Format & Sortierung ────────────────────────────────────────
// Zentrale Helper-Funktionen, damit Anzeige und Sortier-Reihenfolge an einer
// Stelle gesteuert werden. Settings: kontakteNameFormat ("vorname-nachname" |
// "nachname-vorname") und kontakteSortierung ("nachname" | "vorname").
export function formatKontaktName(k, settings) {
  if (!k) return "";
  if (k.typ === "firma") return k.name || "";
  const tit = (k.titel || "").trim();
  const vor = (k.vorname || "").trim();
  const nach = (k.nachname || "").trim();
  if (!vor && !nach) return k.name || "";
  const format = settings && settings.kontakteNameFormat;
  if (format === "nachname-vorname") {
    // "Nachname, Titel Vorname" — Titel bleibt beim Vornamen-Teil
    if (!vor) return tit ? tit + " " + nach : nach;
    if (!nach) return tit ? tit + " " + vor : vor;
    const vorMitTitel = tit ? tit + " " + vor : vor;
    return nach + ", " + vorMitTitel;
  }
  // "Titel Vorname Nachname"
  const kern = !vor ? nach : !nach ? vor : vor + " " + nach;
  return tit ? tit + " " + kern : kern;
}
export function sortKontakte(liste, settings, gemischt) {
  // Sortier-Reihenfolge folgt dem Name-Format: Wer "Nachname, Vorname" anzeigt,
  // sortiert nach Nachname; wer "Vorname Nachname" anzeigt, nach Vorname.
  const nameFormat = settings && settings.kontakteNameFormat;
  const sortNach = nameFormat === "nachname-vorname" ? "nachname" : "vorname";
  const collator = new Intl.Collator("de", { sensitivity: "base", numeric: true });
  // gemischt = true: Personen UND Firmen in EINEM Topf, rein nach Anzeigename
  // sortiert (keine Firma-vor-Person-Trennung). Firma → name; Person → vorname/
  // nachname je nach Format.
  if (gemischt) {
    const sortName = (k) => {
      if (!k) return "";
      if (k.typ === "firma") return k.name || "";
      return ((sortNach === "vorname" ? k.vorname : k.nachname) || k.nachname || k.vorname || k.name || "");
    };
    return [...liste].sort((a, b) => {
      const primary = collator.compare(sortName(a), sortName(b));
      if (primary !== 0) return primary;
      // Sekundär: für Personen der jeweils andere Namensteil, für Firmen leer.
      const aSec = a && a.typ !== "firma" ? ((sortNach === "vorname" ? a.nachname : a.vorname) || "") : "";
      const bSec = b && b.typ !== "firma" ? ((sortNach === "vorname" ? b.nachname : b.vorname) || "") : "";
      return collator.compare(aSec, bSec);
    });
  }
  return [...liste].sort((a, b) => {
    if (a.typ === "firma" && b.typ === "firma") {
      return collator.compare(a.name || "", b.name || "");
    }
    if (a.typ === "firma") return -1;
    if (b.typ === "firma") return 1;
    const aPri = (sortNach === "vorname" ? a.vorname : a.nachname) || "";
    const bPri = (sortNach === "vorname" ? b.vorname : b.nachname) || "";
    const primary = collator.compare(aPri, bPri);
    if (primary !== 0) return primary;
    const aSec = (sortNach === "vorname" ? a.nachname : a.vorname) || "";
    const bSec = (sortNach === "vorname" ? b.nachname : b.vorname) || "";
    return collator.compare(aSec, bSec);
  });
}

// ── Gewerke (was eine Firma IST/KANN) ───────────────────────────────────────
// Fachliche Qualifikation der Firma, objektunabhängig. Eine Firma kann mehrere
// Gewerke haben. Badge-fähig (Kürzel/Farbe → Avatar-Eck-Icon der Firma).
// Siehe KONZEPT_Gewerke_vs_Leistungen.md.
export const DEFAULT_GEWERKE_LISTE = [
  { name: "Sanitär",          kuerzel: "SN", color: "#0284C7", aktiv: true }, // Hellblau
  { name: "Heizung",          kuerzel: "HZ", color: "#DC2626", aktiv: true }, // Rot
  { name: "Klima/Lüftung",    kuerzel: "KL", color: "#06B6D4", aktiv: true }, // Türkis
  { name: "Elektro",          kuerzel: "EL", color: "#CA8A04", aktiv: true }, // Gold
  { name: "Dach/Spengler",    kuerzel: "DA", color: "#78716C", aktiv: true }, // Stein
  { name: "Maler/Lackierer",  kuerzel: "ML", color: "#DB2777", aktiv: true }, // Pink
  { name: "Bodenleger",       kuerzel: "BO", color: "#A16207", aktiv: true }, // Bronze
  { name: "Fliesenleger",     kuerzel: "FL", color: "#0D9488", aktiv: true }, // Teal
  { name: "Trockenbau",       kuerzel: "TB", color: "#57534E", aktiv: true }, // Grau
  { name: "Maurer/Beton",     kuerzel: "MB", color: "#6B7280", aktiv: true }, // Schiefer
  { name: "Fenster/Türen",    kuerzel: "FT", color: "#2563EB", aktiv: true }, // Blau
  { name: "Schreiner/Tischler", kuerzel: "ST", color: "#92400E", aktiv: true }, // Braun
  { name: "Schlosser/Metallbau", kuerzel: "SM", color: "#475569", aktiv: true }, // Schiefer dunkel
  { name: "Glaser",           kuerzel: "GL", color: "#0891B2", aktiv: true }, // Cyan
  { name: "Gerüstbau",        kuerzel: "GB", color: "#854D0E", aktiv: true }, // Ocker
  { name: "Aufzug",           kuerzel: "AZ", color: "#1D4ED8", aktiv: true }, // Blau
  { name: "Schornsteinfeger", kuerzel: "SF", color: "#44403C", aktiv: true }, // Anthrazit
  { name: "Baumpflege",       kuerzel: "BP", color: "#15803D", aktiv: true }, // Grün
  { name: "Schädlingsbekämpfung", kuerzel: "SB", color: "#B91C1C", aktiv: true }, // Rot dunkel
  { name: "Sicherheit/Schließanlagen", kuerzel: "SI", color: "#1E40AF", aktiv: true }, // Blau dunkel
  { name: "Rauchwarnmelder",  kuerzel: "RW", color: "#EA580C", aktiv: true }, // Orange
  { name: "Telekommunikation", kuerzel: "TK", color: "#7C3AED", aktiv: true }, // Violett
  { name: "Architekt/Statik", kuerzel: "AR", color: "#334155", aktiv: true }, // Schiefer
  { name: "Gutachter/Sachverständiger", kuerzel: "GU", color: "#525252", aktiv: true }, // Grau
  { name: "Energieberater",   kuerzel: "EB", color: "#0D9488", aktiv: true }, // Teal
  { name: "Dienstleister",    kuerzel: "DL", color: "#71717A", aktiv: true }, // Zink (Sammelgewerk)
];

// ── Leistungen / Zuständigkeiten (was eine Firma am OBJEKT TUT) ──────────────
// Eigenschaft der Beziehung Firma↔Objekt, pro Objekt unterschiedlich.
// Wird der Zuständigkeit (zustaendigkeiten[].leistung) zugeordnet.
export const DEFAULT_LEISTUNGEN = [
  { name: "Hausverwaltung",   kuerzel: "HV", color: "#2563EB", aktiv: true }, // Blau
  { name: "Hausmeister",      kuerzel: "HM", color: "#65A30D", aktiv: true }, // Limette
  { name: "Wartung",          kuerzel: "WT", color: "#475569", aktiv: true }, // Schiefer
  { name: "Winterdienst",     kuerzel: "WD", color: "#0891B2", aktiv: true }, // Cyan
  { name: "Grünpflege",       kuerzel: "GP", color: "#16A34A", aktiv: true }, // Grün
  { name: "Reinigung",        kuerzel: "RG", color: "#0F766E", aktiv: true }, // Petrol
  { name: "Müllabfuhr",       kuerzel: "MÜ", color: "#92400E", aktiv: true }, // Braun
  { name: "Brandschutz",      kuerzel: "BS", color: "#DC2626", aktiv: true }, // Rot (Prüfung)
  { name: "Messdienst",       kuerzel: "MD", color: "#0E7490", aktiv: true }, // Cyan dunkel
  { name: "Versorger",        kuerzel: "VS", color: "#EA580C", aktiv: true }, // Orange
  { name: "Energieversorgung", kuerzel: "EV", color: "#F59E0B", aktiv: true }, // Amber
  { name: "Versicherung",     kuerzel: "VR", color: "#7C3AED", aktiv: true }, // Violett
];




export const PALETTE_FARBEN = [
  // ── Grautöne ──────────────────────────────────────────────────────────────
  { familie: "Schiefer", gruppe: "Grautöne", stufen: [
    { stufe: 50,  hex: "#F8FAFC" }, { stufe: 100, hex: "#F1F5F9" },
    { stufe: 200, hex: "#E2E8F0" }, { stufe: 300, hex: "#CBD5E1" },
    { stufe: 400, hex: "#94A3B8" }, { stufe: 500, hex: "#64748B" },
    { stufe: 600, hex: "#475569" }, { stufe: 700, hex: "#334155" },
    { stufe: 800, hex: "#1E293B" }, { stufe: 900, hex: "#0F172A" },
  ]},
  { familie: "Grau", gruppe: "Grautöne", stufen: [
    { stufe: 50,  hex: "#F9FAFB" }, { stufe: 100, hex: "#F3F4F6" },
    { stufe: 200, hex: "#E5E7EB" }, { stufe: 300, hex: "#D1D5DB" },
    { stufe: 400, hex: "#9CA3AF" }, { stufe: 500, hex: "#6B7280" },
    { stufe: 600, hex: "#4B5563" }, { stufe: 700, hex: "#374151" },
    { stufe: 800, hex: "#1F2937" }, { stufe: 900, hex: "#111827" },
  ]},
  { familie: "Zink", gruppe: "Grautöne", stufen: [
    { stufe: 50,  hex: "#FAFAFA" }, { stufe: 100, hex: "#F4F4F5" },
    { stufe: 200, hex: "#E4E4E7" }, { stufe: 300, hex: "#D4D4D8" },
    { stufe: 400, hex: "#A1A1AA" }, { stufe: 500, hex: "#71717A" },
    { stufe: 600, hex: "#52525B" }, { stufe: 700, hex: "#3F3F46" },
    { stufe: 800, hex: "#27272A" }, { stufe: 900, hex: "#18181B" },
  ]},
  { familie: "Stein", gruppe: "Grautöne", stufen: [
    { stufe: 50,  hex: "#FAFAF9" }, { stufe: 100, hex: "#F5F5F4" },
    { stufe: 200, hex: "#E7E5E4" }, { stufe: 300, hex: "#D6D3D1" },
    { stufe: 400, hex: "#A8A29E" }, { stufe: 500, hex: "#78716C" },
    { stufe: 600, hex: "#57534E" }, { stufe: 700, hex: "#44403C" },
    { stufe: 800, hex: "#292524" }, { stufe: 900, hex: "#1C1917" },
  ]},
  // ── Rot & Pink ────────────────────────────────────────────────────────────
  { familie: "Rot", gruppe: "Rot & Pink", stufen: [
    { stufe: 50,  hex: "#FEF2F2" }, { stufe: 100, hex: "#FEE2E2" },
    { stufe: 200, hex: "#FECACA" }, { stufe: 300, hex: "#FCA5A5" },
    { stufe: 400, hex: "#F87171" }, { stufe: 500, hex: "#EF4444" },
    { stufe: 600, hex: "#DC2626" }, { stufe: 700, hex: "#B91C1C" },
    { stufe: 800, hex: "#991B1B" }, { stufe: 900, hex: "#7F1D1D" },
  ]},
  { familie: "Weinrot", gruppe: "Rot & Pink", stufen: [
    { stufe: 50,  hex: "#FDF2F4" }, { stufe: 100, hex: "#FADEE3" },
    { stufe: 200, hex: "#F5BECA" }, { stufe: 300, hex: "#ED93A6" },
    { stufe: 400, hex: "#E26079" }, { stufe: 500, hex: "#C8304E" },
    { stufe: 600, hex: "#A81E3A" }, { stufe: 700, hex: "#87182D" },
    { stufe: 800, hex: "#6A1424" }, { stufe: 900, hex: "#52111C" },
  ]},
  { familie: "Koralle", gruppe: "Rot & Pink", stufen: [
    { stufe: 50,  hex: "#FFF4F0" }, { stufe: 100, hex: "#FFE6DE" },
    { stufe: 200, hex: "#FFCABC" }, { stufe: 300, hex: "#FFA492" },
    { stufe: 400, hex: "#FF7462" }, { stufe: 500, hex: "#FF4D35" },
    { stufe: 600, hex: "#E8321A" }, { stufe: 700, hex: "#C32411" },
    { stufe: 800, hex: "#9E1E0F" }, { stufe: 900, hex: "#7A1B10" },
  ]},
  { familie: "Rose", gruppe: "Rot & Pink", stufen: [
    { stufe: 50,  hex: "#FFF1F2" }, { stufe: 100, hex: "#FFE4E6" },
    { stufe: 200, hex: "#FECDD3" }, { stufe: 300, hex: "#FDA4AF" },
    { stufe: 400, hex: "#FB7185" }, { stufe: 500, hex: "#F43F5E" },
    { stufe: 600, hex: "#E11D48" }, { stufe: 700, hex: "#BE123C" },
    { stufe: 800, hex: "#9F1239" }, { stufe: 900, hex: "#881337" },
  ]},
  { familie: "Pink", gruppe: "Rot & Pink", stufen: [
    { stufe: 50,  hex: "#FDF2F8" }, { stufe: 100, hex: "#FCE7F3" },
    { stufe: 200, hex: "#FBCFE8" }, { stufe: 300, hex: "#F9A8D4" },
    { stufe: 400, hex: "#F472B6" }, { stufe: 500, hex: "#EC4899" },
    { stufe: 600, hex: "#DB2777" }, { stufe: 700, hex: "#BE185D" },
    { stufe: 800, hex: "#9D174D" }, { stufe: 900, hex: "#831843" },
  ]},
  // ── Orange & Gelb ─────────────────────────────────────────────────────────
  { familie: "Orange", gruppe: "Orange & Gelb", stufen: [
    { stufe: 50,  hex: "#FFF7ED" }, { stufe: 100, hex: "#FFEDD5" },
    { stufe: 200, hex: "#FED7AA" }, { stufe: 300, hex: "#FDBA74" },
    { stufe: 400, hex: "#FB923C" }, { stufe: 500, hex: "#F97316" },
    { stufe: 600, hex: "#EA580C" }, { stufe: 700, hex: "#C2410C" },
    { stufe: 800, hex: "#9A3412" }, { stufe: 900, hex: "#7C2D12" },
  ]},
  { familie: "Amber", gruppe: "Orange & Gelb", stufen: [
    { stufe: 50,  hex: "#FFFBEB" }, { stufe: 100, hex: "#FEF3C7" },
    { stufe: 200, hex: "#FDE68A" }, { stufe: 300, hex: "#FCD34D" },
    { stufe: 400, hex: "#FBBF24" }, { stufe: 500, hex: "#F59E0B" },
    { stufe: 600, hex: "#D97706" }, { stufe: 700, hex: "#B45309" },
    { stufe: 800, hex: "#92400E" }, { stufe: 900, hex: "#78350F" },
  ]},
  { familie: "Gold", gruppe: "Orange & Gelb", stufen: [
    { stufe: 50,  hex: "#FFFEF0" }, { stufe: 100, hex: "#FEFBD3" },
    { stufe: 200, hex: "#FCF49E" }, { stufe: 300, hex: "#FAE55C" },
    { stufe: 400, hex: "#F5CE1E" }, { stufe: 500, hex: "#E0B008" },
    { stufe: 600, hex: "#BC8E05" }, { stufe: 700, hex: "#946F05" },
    { stufe: 800, hex: "#715408" }, { stufe: 900, hex: "#57400A" },
  ]},
  { familie: "Gelb", gruppe: "Orange & Gelb", stufen: [
    { stufe: 50,  hex: "#FEFCE8" }, { stufe: 100, hex: "#FEF9C3" },
    { stufe: 200, hex: "#FEF08A" }, { stufe: 300, hex: "#FDE047" },
    { stufe: 400, hex: "#FACC15" }, { stufe: 500, hex: "#EAB308" },
    { stufe: 600, hex: "#CA8A04" }, { stufe: 700, hex: "#A16207" },
    { stufe: 800, hex: "#854D0E" }, { stufe: 900, hex: "#713F12" },
  ]},
  // ── Braun & Erdtöne ───────────────────────────────────────────────────────
  { familie: "Braun", gruppe: "Braun & Erdtöne", stufen: [
    { stufe: 50,  hex: "#FDF7F2" }, { stufe: 100, hex: "#F8EDE1" },
    { stufe: 200, hex: "#EECFB6" }, { stufe: 300, hex: "#E3AB82" },
    { stufe: 400, hex: "#D38049" }, { stufe: 500, hex: "#B8621E" },
    { stufe: 600, hex: "#964E16" }, { stufe: 700, hex: "#753D11" },
    { stufe: 800, hex: "#562C0D" }, { stufe: 900, hex: "#3C1E09" },
  ]},
  { familie: "Terrakotta", gruppe: "Braun & Erdtöne", stufen: [
    { stufe: 50,  hex: "#FEF4EF" }, { stufe: 100, hex: "#FDE4D5" },
    { stufe: 200, hex: "#FAC5A8" }, { stufe: 300, hex: "#F69E74" },
    { stufe: 400, hex: "#F07444" }, { stufe: 500, hex: "#E5511E" },
    { stufe: 600, hex: "#CB3D0E" }, { stufe: 700, hex: "#A43008" },
    { stufe: 800, hex: "#7E260A" }, { stufe: 900, hex: "#5F1E0B" },
  ]},
  { familie: "Ocker", gruppe: "Braun & Erdtöne", stufen: [
    { stufe: 50,  hex: "#FDFAEE" }, { stufe: 100, hex: "#FAF2CC" },
    { stufe: 200, hex: "#F4E299" }, { stufe: 300, hex: "#EACC5E" },
    { stufe: 400, hex: "#DCB42B" }, { stufe: 500, hex: "#C49A12" },
    { stufe: 600, hex: "#9E7C0C" }, { stufe: 700, hex: "#7B5F0B" },
    { stufe: 800, hex: "#5F490C" }, { stufe: 900, hex: "#483810" },
  ]},
  // ── Grün ──────────────────────────────────────────────────────────────────
  { familie: "Salbei", gruppe: "Grün", stufen: [
    { stufe: 50,  hex: "#F4F7F1" }, { stufe: 100, hex: "#E5EDDE" },
    { stufe: 200, hex: "#C9D9BC" }, { stufe: 300, hex: "#A6BF93" },
    { stufe: 400, hex: "#7E9F68" }, { stufe: 500, hex: "#5E824A" },
    { stufe: 600, hex: "#476836" }, { stufe: 700, hex: "#38522B" },
    { stufe: 800, hex: "#2C4022" }, { stufe: 900, hex: "#21301A" },
  ]},
  { familie: "Limette", gruppe: "Grün", stufen: [
    { stufe: 50,  hex: "#F7FEE7" }, { stufe: 100, hex: "#ECFCCB" },
    { stufe: 200, hex: "#D9F99D" }, { stufe: 300, hex: "#BEF264" },
    { stufe: 400, hex: "#A3E635" }, { stufe: 500, hex: "#84CC16" },
    { stufe: 600, hex: "#65A30D" }, { stufe: 700, hex: "#4D7C0F" },
    { stufe: 800, hex: "#3F6212" }, { stufe: 900, hex: "#365314" },
  ]},
  { familie: "Grün", gruppe: "Grün", stufen: [
    { stufe: 50,  hex: "#F0FDF4" }, { stufe: 100, hex: "#DCFCE7" },
    { stufe: 200, hex: "#BBF7D0" }, { stufe: 300, hex: "#86EFAC" },
    { stufe: 400, hex: "#4ADE80" }, { stufe: 500, hex: "#22C55E" },
    { stufe: 600, hex: "#16A34A" }, { stufe: 700, hex: "#15803D" },
    { stufe: 800, hex: "#166534" }, { stufe: 900, hex: "#14532D" },
  ]},
  { familie: "Smaragd", gruppe: "Grün", stufen: [
    { stufe: 50,  hex: "#ECFDF5" }, { stufe: 100, hex: "#D1FAE5" },
    { stufe: 200, hex: "#A7F3D0" }, { stufe: 300, hex: "#6EE7B7" },
    { stufe: 400, hex: "#34D399" }, { stufe: 500, hex: "#10B981" },
    { stufe: 600, hex: "#059669" }, { stufe: 700, hex: "#047857" },
    { stufe: 800, hex: "#065F46" }, { stufe: 900, hex: "#064E3B" },
  ]},
  { familie: "Petrol", gruppe: "Grün", stufen: [
    { stufe: 50,  hex: "#F0FDFA" }, { stufe: 100, hex: "#CCFBF1" },
    { stufe: 200, hex: "#99F6E4" }, { stufe: 300, hex: "#5EEAD4" },
    { stufe: 400, hex: "#2DD4BF" }, { stufe: 500, hex: "#14B8A6" },
    { stufe: 600, hex: "#0D9488" }, { stufe: 700, hex: "#0F766E" },
    { stufe: 800, hex: "#115E59" }, { stufe: 900, hex: "#134E4A" },
  ]},
  // ── Blau ──────────────────────────────────────────────────────────────────
  { familie: "Cyan", gruppe: "Blau", stufen: [
    { stufe: 50,  hex: "#ECFEFF" }, { stufe: 100, hex: "#CFFAFE" },
    { stufe: 200, hex: "#A5F3FC" }, { stufe: 300, hex: "#67E8F9" },
    { stufe: 400, hex: "#22D3EE" }, { stufe: 500, hex: "#06B6D4" },
    { stufe: 600, hex: "#0891B2" }, { stufe: 700, hex: "#0E7490" },
    { stufe: 800, hex: "#155E75" }, { stufe: 900, hex: "#164E63" },
  ]},
  { familie: "Himmel", gruppe: "Blau", stufen: [
    { stufe: 50,  hex: "#F0F9FF" }, { stufe: 100, hex: "#E0F2FE" },
    { stufe: 200, hex: "#BAE6FD" }, { stufe: 300, hex: "#7DD3FC" },
    { stufe: 400, hex: "#38BDF8" }, { stufe: 500, hex: "#0EA5E9" },
    { stufe: 600, hex: "#0284C7" }, { stufe: 700, hex: "#0369A1" },
    { stufe: 800, hex: "#075985" }, { stufe: 900, hex: "#0C4A6E" },
  ]},
  { familie: "Blau", gruppe: "Blau", stufen: [
    { stufe: 50,  hex: "#EFF6FF" }, { stufe: 100, hex: "#DBEAFE" },
    { stufe: 200, hex: "#BFDBFE" }, { stufe: 300, hex: "#93C5FD" },
    { stufe: 400, hex: "#60A5FA" }, { stufe: 500, hex: "#3B82F6" },
    { stufe: 600, hex: "#2563EB" }, { stufe: 700, hex: "#1D4ED8" },
    { stufe: 800, hex: "#1E40AF" }, { stufe: 900, hex: "#1E3A8A" },
  ]},
  { familie: "Kobalt", gruppe: "Blau", stufen: [
    { stufe: 50,  hex: "#EEF0FF" }, { stufe: 100, hex: "#DBE1FF" },
    { stufe: 200, hex: "#B9C4FF" }, { stufe: 300, hex: "#8A9CFF" },
    { stufe: 400, hex: "#5A71FF" }, { stufe: 500, hex: "#3349FF" },
    { stufe: 600, hex: "#1E30F2" }, { stufe: 700, hex: "#1725CC" },
    { stufe: 800, hex: "#161EA3" }, { stufe: 900, hex: "#151C7E" },
  ]},
  { familie: "Indigo", gruppe: "Blau", stufen: [
    { stufe: 50,  hex: "#EEF2FF" }, { stufe: 100, hex: "#E0E7FF" },
    { stufe: 200, hex: "#C7D2FE" }, { stufe: 300, hex: "#A5B4FC" },
    { stufe: 400, hex: "#818CF8" }, { stufe: 500, hex: "#6366F1" },
    { stufe: 600, hex: "#4F46E5" }, { stufe: 700, hex: "#4338CA" },
    { stufe: 800, hex: "#3730A3" }, { stufe: 900, hex: "#312E81" },
  ]},
  // ── Lila & Magenta ────────────────────────────────────────────────────────
  { familie: "Violett", gruppe: "Lila & Magenta", stufen: [
    { stufe: 50,  hex: "#F5F3FF" }, { stufe: 100, hex: "#EDE9FE" },
    { stufe: 200, hex: "#DDD6FE" }, { stufe: 300, hex: "#C4B5FD" },
    { stufe: 400, hex: "#A78BFA" }, { stufe: 500, hex: "#8B5CF6" },
    { stufe: 600, hex: "#7C3AED" }, { stufe: 700, hex: "#6D28D9" },
    { stufe: 800, hex: "#5B21B6" }, { stufe: 900, hex: "#4C1D95" },
  ]},
  { familie: "Lila", gruppe: "Lila & Magenta", stufen: [
    { stufe: 50,  hex: "#FAF5FF" }, { stufe: 100, hex: "#F3E8FF" },
    { stufe: 200, hex: "#E9D5FF" }, { stufe: 300, hex: "#D8B4FE" },
    { stufe: 400, hex: "#C084FC" }, { stufe: 500, hex: "#A855F7" },
    { stufe: 600, hex: "#9333EA" }, { stufe: 700, hex: "#7E22CE" },
    { stufe: 800, hex: "#6B21A8" }, { stufe: 900, hex: "#581C87" },
  ]},
  { familie: "Fuchsia", gruppe: "Lila & Magenta", stufen: [
    { stufe: 50,  hex: "#FDF4FF" }, { stufe: 100, hex: "#FAE8FF" },
    { stufe: 200, hex: "#F5D0FE" }, { stufe: 300, hex: "#F0ABFC" },
    { stufe: 400, hex: "#E879F9" }, { stufe: 500, hex: "#D946EF" },
    { stufe: 600, hex: "#C026D3" }, { stufe: 700, hex: "#A21CAF" },
    { stufe: 800, hex: "#86198F" }, { stufe: 900, hex: "#701A75" },
  ]},
  { familie: "Magenta", gruppe: "Lila & Magenta", stufen: [
    { stufe: 50,  hex: "#FFF0FB" }, { stufe: 100, hex: "#FFE1F8" },
    { stufe: 200, hex: "#FFC2F2" }, { stufe: 300, hex: "#FF97E9" },
    { stufe: 400, hex: "#FF5FDB" }, { stufe: 500, hex: "#FF1FCA" },
    { stufe: 600, hex: "#E500B2" }, { stufe: 700, hex: "#BF0093" },
    { stufe: 800, hex: "#9C0078" }, { stufe: 900, hex: "#780060" },
  ]},
];

