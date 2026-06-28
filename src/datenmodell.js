import {
  ACCENT, DEFAULT_GEWERKE_LISTE, DEFAULT_KATEGORIEN, DEFAULT_LEISTUNGEN,
  DEFAULT_ROLLEN, DEFAULT_VERWENDUNGEN, KONTAKTE_FARBE
} from "./constants.js";
import { isoHeute, splitPlzOrt, zuIsoDatum, parseDatumWert } from "./utils-basis.js";

// ╔═════════════════════════════════════════════════════════════════════════╗
// ║ SEKTION 2 · DATENMODELL  (Modell A) — ausgelagertes Modul                ║
// ║ Enthält zusätzlich das eigStatus-Trio (EIG_STATUS/eigStatus/             ║
// ║ laufenderEigWechsel), fachlich Datenmodell, vormals in S5.               ║
// ╚═════════════════════════════════════════════════════════════════════════╝

// ║ SEKTION 2 · DATENMODELL  (Modell A)                                     ║
// ║ DEFAULT_KONTAKTE · DEFAULT_VES · DEFAULT_SETTINGS · FIELD_TYPES         ║
// ╚═════════════════════════════════════════════════════════════════════════╝

// ── Daten: Kontakte ─────────────────────────────────────────────────────────

// ── Kontakt-Zuweisungs-Migration (Altformat → Zielformat) ──
// Slot einer Rolle direkt aus den Default-Rollen lesen. Bewusst ohne
// Modul-Level-Cache-Variable, um jede TDZ zu vermeiden (die Migration kann
// früh bei der Modul-Initialisierung laufen). DEFAULT_ROLLEN ist
// klein und die Migration läuft nicht in einer Hot-Loop.
function slotFuerRolle(name) {
  for (let i = 0; i < DEFAULT_ROLLEN.length; i++) {
    if (DEFAULT_ROLLEN[i].name === name) return DEFAULT_ROLLEN[i].slot;
  }
  return undefined;
}

// Eine alte objektZuweisung in eine der drei neuen Kategorien einsortieren.
// Rückgabe: { kat: "besitz"|"zustaendigkeit"|"firmenrolle", eintrag }
function klassifiziereZuweisung(z, kontaktTyp) {
  if (!z || typeof z !== "object") return null;
  const slot = slotFuerRolle(z.rolle);
  const status = z.status || "aktiv";

  // (D) Personen-/Firmen-Vertretung: Ziel ist ein anderer Kontakt (zielKontaktId),
  // z. B. "Bevollmächtigter für Person Z" / "Betreuer für Z". Vor der firmaId-
  // Prüfung, da das Ziel auch eine Firma sein kann (zielKontaktId ≠ firmaId-Anstellung).
  if (z.zielKontaktId != null) {
    return { kat: "zustaendigkeit", eintrag: {
      beteiligterTyp: kontaktTyp,
      ziel: { art: "kontakt", objektId: null, einheitId: null, anlageId: null, kontaktId: z.zielKontaktId },
      leistung: z.rolle || "", status,
      vertragId: null, ansprechpartnerId: null,
    }};
  }

  // (C) Anstellung: firmaId und kein Objektbezug → Person bei Firma
  if (z.firmaId != null && z.objektId == null && z.einheitId == null && z.geraetId == null) {
    return { kat: "firmenrolle", eintrag: { firmaId: z.firmaId, rolle: z.rolle || "", status } };
  }

  // (B) Zuständigkeit: Anlage/Gerät-Ziel
  if (z.geraetId != null || z.anlageId != null) {
    return { kat: "zustaendigkeit", eintrag: {
      beteiligterTyp: kontaktTyp,
      ziel: { art: "anlage", objektId: z.objektId || null, einheitId: z.einheitId || null,
              anlageId: z.anlageId || z.geraetId || null },
      leistung: z.rolle || "", status,
      vertragId: z.vertragId || null, ansprechpartnerId: z.ansprechpartnerId || null,
    }};
  }

  // (B) Zuständigkeit: Gremium-Rollen (Beirat, Rechnungsprüfer) → Objekt-Bezug
  if (slot === "gremium") {
    const e = { beteiligterTyp: kontaktTyp,
      ziel: { art: "objekt", objektId: z.objektId || null, einheitId: null, anlageId: null },
      leistung: z.rolle || "", status,
      vertragId: null, ansprechpartnerId: null };
    if (z.vorsitz) e.vorsitz = true;
    return { kat: "zustaendigkeit", eintrag: e };
  }

  // (B) Zuständigkeit: Person als objektbezogener Ansprechpartner (Slot firma,
  // aber mit Objekt-/Einheit-Bezug statt firmaId) → Zuständigkeit, nicht Besitz.
  if (slot === "firma" && z.firmaId == null && z.objektId != null) {
    return { kat: "zustaendigkeit", eintrag: {
      beteiligterTyp: kontaktTyp,
      ziel: { art: z.einheitId ? "einheit" : "objekt", objektId: z.objektId,
              einheitId: z.einheitId || null, anlageId: null },
      leistung: z.rolle || "", status,
      vertragId: z.vertragId || null, ansprechpartnerId: null,
    }};
  }

  // (B) Zuständigkeit: Firmen-Dienstleistung am Objekt (Hausverwaltung, Hausmeister, …)
  // Erkennbar an: Firmen-Kontakt mit objektId, ohne einheitId-Besitzbezug.
  if (kontaktTyp === "firma" && z.objektId != null) {
    const e = {
      beteiligterTyp: "firma",
      ziel: { art: z.einheitId ? "einheit" : "objekt", objektId: z.objektId,
              einheitId: z.einheitId || null, anlageId: null },
      leistung: z.rolle || "", status,
      vertragId: z.vertragId || null, ansprechpartnerId: z.ansprechpartnerId || null,
    };
    if (z.vertrag) e.vertrag = true;
    return { kat: "zustaendigkeit", eintrag: e };
  }

  // (A) Besitz/Nutzung: ve/sev-Rollen ODER Objekt-/Einheit-Bezug einer Person
  if (z.objektId != null) {
    return { kat: "besitz", eintrag: {
      beteiligterTyp: kontaktTyp,
      objektId: z.objektId, einheitId: z.einheitId || null,
      rolle: z.rolle || "", status,
    }};
  }

  return null; // nicht klassifizierbar → wird übersprungen (alte Daten bleiben erhalten)
}

// Migriert einen Kontakt: leitet besitz[]/zustaendigkeiten[]/firmenRollen[] aus
// objektZuweisungen[] ab. Idempotent: läuft nur, wenn die neuen Felder fehlen.
// WICHTIG (1a): objektZuweisungen bleibt vorerst ERHALTEN, damit die bestehende
// Anzeige weiterläuft. Erst in 1b/1c stellen wir die Lesepfade um.
// ── Einmal-Migration (v5.76): "Miteigentümer" → "Eigentümer" ────────────────
// Die Rolle "Miteigentümer" wurde gestrichen. Mehrere Eigentümer einer Einheit
// (Ehepaar, Erbengemeinschaft) sind alle schlicht "Eigentümer". Schreibt den
// alten Rollen-Namen in allen Listen um; rollen[] wird dabei dedupliziert.
function mappeMiteigentuemer(k) {
  if (!k || typeof k !== "object") return k;
  const ME = "Miteigentümer", E = "Eigentümer";
  let geaendert = false;
  const out = { ...k };
  if (Array.isArray(out.rollen)) {
    const neu = [];
    out.rollen.forEach(r => {
      const name = (r === ME) ? E : r;
      if (r === ME) geaendert = true;
      if (neu.indexOf(name) < 0) neu.push(name);  // Dedup
    });
    if (geaendert) out.rollen = neu;
  }
  const mapListe = (liste, feld) => {
    if (!Array.isArray(liste)) return liste;
    let hit = false;
    const neu = liste.map(z => {
      if (z && z[feld] === ME) { hit = true; return { ...z, [feld]: E }; }
      return z;
    });
    if (hit) geaendert = true;
    return hit ? neu : liste;
  };
  out.besitz             = mapListe(out.besitz, "rolle");
  out.objektZuweisungen  = mapListe(out.objektZuweisungen, "rolle");
  return geaendert ? out : k;
}

// ── Einmal-Migration (v11.81): Rollen-Aufräumung ───────────────────────────
// Drei Bereinigungen in allen rollentragenden Feldern eines Kontakts:
//   · "Ansprechpartner (Objekt)" / "Ansprechpartner (Firma)" → "Ansprechpartner"
//     (Objekt- vs. Firmenbezug wird ohnehin aus den IDs der Zuweisung abgeleitet,
//     nicht aus dem Rollennamen — die Trennung war rein optisch.)
//   · "Wohnberechtigt" → "Wohnberechtigter" (substantivierte Form, konsistent
//     zu Bevollmächtigter/Nießbraucher).
//   · "Bewohner" → entfernt (durch konkrete Wohnrechte ersetzt).
// Idempotent: läuft mehrfach gefahrlos; deduplizert rollen[]; betroffene
// Zuweisungen mit "Bewohner" werden aus den Listen gestrichen.
function mappeRollenAufraeumung(k) {
  if (!k || typeof k !== "object") return k;
  const UMBENENNEN = {
    "Ansprechpartner (Objekt)": "Ansprechpartner",
    "Ansprechpartner (Firma)":  "Ansprechpartner",
    "Wohnberechtigt":           "Wohnberechtigter",
  };
  const ENTFERNEN = { "Bewohner": true };
  let geaendert = false;
  const out = { ...k };

  // rollen[] (Strings): umbenennen, "Bewohner" raus, dedup.
  if (Array.isArray(out.rollen)) {
    const neu = [];
    out.rollen.forEach(r => {
      if (ENTFERNEN[r]) { geaendert = true; return; }
      const name = UMBENENNEN[r] || r;
      if (name !== r) geaendert = true;
      if (neu.indexOf(name) < 0) neu.push(name); // Dedup (AP-Objekt+Firma → 1×AP)
    });
    if (geaendert) out.rollen = neu;
  }

  // Objekt-Listen mit Rollennamen in einem Feld: umbenennen ODER Eintrag streichen.
  const mapListe = (liste, feld) => {
    if (!Array.isArray(liste)) return liste;
    let hit = false;
    const neu = [];
    liste.forEach(z => {
      if (!z) { neu.push(z); return; }
      const val = z[feld];
      if (ENTFERNEN[val]) { hit = true; return; } // Eintrag entfällt
      if (UMBENENNEN[val]) { hit = true; neu.push({ ...z, [feld]: UMBENENNEN[val] }); return; }
      neu.push(z);
    });
    if (hit) geaendert = true;
    return hit ? neu : liste;
  };
  out.besitz            = mapListe(out.besitz, "rolle");
  out.objektZuweisungen = mapListe(out.objektZuweisungen, "rolle");
  out.firmenRollen      = mapListe(out.firmenRollen, "rolle");
  out.zustaendigkeiten  = mapListe(out.zustaendigkeiten, "leistung");
  return geaendert ? out : k;
}

function migriereKontaktZuweisungen(k) {
  if (!k || typeof k !== "object") return k;
  // Einmal-Migration (v5.76): "Miteigentümer" → "Eigentümer" in allen Feldern.
  // Idempotent (ein Eigentümer ggf. doppelt → unten via Set dedupliziert). Läuft
  // VOR dem early-return, damit auch bereits migrierte Kontakte erfasst werden.
  k = mappeMiteigentuemer(k);
  // Einmal-Migration (v11.81): Rollen-Aufräumung — ebenfalls VOR dem early-return,
  // damit auch bereits auf die neue Achse migrierte Kontakte erfasst werden.
  k = mappeRollenAufraeumung(k);
  if (k.besitz != null || k.zustaendigkeiten != null || k.firmenRollen != null) return k;
  const alt = Array.isArray(k.objektZuweisungen) ? k.objektZuweisungen : [];
  const besitz = [], zustaendigkeiten = [], firmenRollen = [];
  alt.forEach(z => {
    const c = klassifiziereZuweisung(z, k.typ);
    if (!c) return;
    if (c.kat === "besitz") besitz.push(c.eintrag);
    else if (c.kat === "zustaendigkeit") zustaendigkeiten.push(c.eintrag);
    else if (c.kat === "firmenrolle") firmenRollen.push(c.eintrag);
  });
  return { ...k, besitz, zustaendigkeiten, firmenRollen };
}

// Blankes Programm: keine Mock-/Fake-Daten mehr. Die App startet leer; echte
// Daten werden über den JSON-Import (Einstellungen) geladen.
const DEFAULT_KONTAKTE = [];
const DEFAULT_VES = [];


// ── Default-Settings ────────────────────────────────────────────────────────
const DEFAULT_SETTINGS = {
  hvName: "Muster Hausverwaltung GmbH",
  hvLogoUrl: "",
  hvLogo: "",                  // hochgeladenes Logo (DataURL) — Vorrang vor hvLogoUrl im Listendruck
  tastaturAn: true,            // globale Tastaturkürzel aktiv
  tastaturBelegung: {},        // Overrides { aktionId: taste } — leer = Standard
  headerZeigeAvatar: true,
  headerZeigeSuche: true,
  headerZeigeDunkelmodus: true,
  filterAktiv: true,
  filterTyp: "verwalter",       // "verwalter" oder "buchhalter"
  filterAktive: {},             // Map: { kontaktId: false } – sichtbar wenn nicht false
  // Nur Objekte + Kontakte: Das sind die einzigen Quellen, die die Universalsuche
  // (sucheAlles) real durchsucht. „Adressen" steckt bereits in den Objekt-Treffern
  // (Adress-Vorschläge aus ve.adresse) und in den Kontakten; „Verträge" hatte gar
  // keinen eigenen Such-Branch (toter Schalter). Beide entfernt (v12.88).
  suchKategorien: [
    { id:"objekte",   label:"Objekte",   aktiv:true  },
    { id:"kontakte",  label:"Kontakte",  aktiv:true  },
  ],
  // Intelligente Suche — alle Stufen default an. Stufe 1 (exakt) ist immer aktiv.
  sucheDiakritika:           true,   // Umlaute & Akzente ignorieren (Müller=Mueller=Muller)
  sucheWoerter:              true,   // Mehrere Wortteile (alle müssen vorkommen)
  suchePhonetik:             true,   // Kölner Phonetik (Meier=Meyer=Mayer)
  sucheTippfehler:           true,   // Levenshtein-Distanz für Tippfehler
  sucheTippfehlerSchwelle:   2,      // Max. Edit-Distanz (1=streng, 3=sehr tolerant)
  // Reihenfolge der Einstellungs-Sektionen (Array von IDs)
  sektionenReihenfolge: null,  // null = Default-Reihenfolge wie in SEKTIONEN definiert
  dashboardModus: "immer", // "aus" | "immer" | "home" – nur Homescreen oder überall
  dashboardSticky: true,   // bei Mobile (Hochkant): Kategorie-Leiste bleibt unter dem Header sticky
  sidebarBreite: 200,      // Breite der Desktop-Sidebar (px) – wird vom Resize-Handle gesetzt
  rollen: DEFAULT_ROLLEN,  // Editierbare Rollen (Name, Kürzel, Farbe, Aktiv) – Reihenfolge im Array zählt
  firmenRollen: DEFAULT_GEWERKE_LISTE, // GEWERKE der Firma (Sanitär, Elektro, …) – Badge-fähig
  leistungen: DEFAULT_LEISTUNGEN, // Leistungen/Zuständigkeiten am Objekt (Hausverwaltung, Wartung, …)
  verwendungen: DEFAULT_VERWENDUNGEN, // Verwendungen für Objekt-Einheiten
  kategorien: DEFAULT_KATEGORIEN, // Gemeinsame Quelle für Kürzel+Farbe von Paaren (Verwendung↔Rolle)
  avatarIconsPerson: true,    // Eck-Badges an Personen-Avataren
  avatarIconsFirma:  true,    // Eck-Badges an Firmen-Avataren
  kartenIconsAn:     true,    // globaler Schalter: Symbole an allen Karten-Köpfen
  kartenBadgesPerson: true,   // Rollen-Badges auf der Kontaktkarte (Personen)
  kartenBadgesFirma:  true,   // Rollen-Badges auf der Kontaktkarte (Firmen)
  // ── Kontakte-Anzeige ──
  // Name-Format steuert sowohl Anzeige als auch Sortier-Reihenfolge:
  // "vorname-nachname" → sortiert nach Vorname; "nachname-vorname" → nach Nachname.
  kontakteNameFormat: "vorname-nachname",
  kontakteAlphaTrenner: true,   // alphabetische Trenner (A, B, C …) in der Kontaktliste
  statusLeisteObjekt:  true,  // Statusleiste unter Objekt-Karten (z. B. "Bestellung abgelaufen")
  statusLeisteKontakt: true,  // Statusleiste unter Kontakt-Karten (Demo-Inhalte)
  // Frei pflegbare Bezeichnungs-Liste für das "Neuer Termin"-Dropdown.
  // Jeder Eintrag: { id, label, farbe }. In SektionTerminVorlagen editierbar.
  terminBezeichnungen: [
    { id: "tb_begehung",  label: "Objektbegehung",        farbe: "#0E7490", sichtbar: true, bezug: "objekt",  autoBeteiligte: "keine" },
    { id: "tb_handwerk",  label: "Handwerkertermin",      farbe: "#F59E0B", sichtbar: true, bezug: "einheit", autoBeteiligte: "nutzer_einheit" },
    { id: "tb_eigent",    label: "Termin mit Eigentümer", farbe: "#3B82F6", sichtbar: true, bezug: "objekt",  autoBeteiligte: "eigentuemer" },
    { id: "tb_uebergabe", label: "Wohnungsübergabe",      farbe: "#10B981", sichtbar: true, bezug: "einheit", autoBeteiligte: "eig_nutzer_einheit" },
    { id: "tb_besicht",   label: "Besichtigung",          farbe: "#8B5CF6", sichtbar: true, bezug: "einheit", autoBeteiligte: "eig_nutzer_einheit" },
  ],
  // Anlege-Modus für neue Termine: "gefuehrt" = Schritt-für-Schritt-Assistent
  // (folgt in Teil 2), "formular" = klassisches Ein-Fenster-Formular.
  terminAnlegeModus: "formular",
  // Dauer-Schnellbuttons (Minuten) im Anlege-Flow.
  terminDauerOptionen: [15, 30, 45, 60, 90, 120],
  // Uhrzeit-Picker (Termin-Anlegen): Minuten-Raster (5 oder 15), Stunden-
  // Auswahl ganztags (24h) oder an die Arbeitszeit gekoppelt (+Puffer h davor/
  // danach). Tastatureingabe bleibt unabhängig davon immer möglich.
  zeitMinutenschritt: 15,    // 5 | 15
  zeitStundenModus: "arbeit", // "24h" | "arbeit"
  zeitArbeitPuffer: 1,       // Stunden vor/nach Arbeitszeit (nur bei "arbeit")
  farbIntensitaet: 100,    // Farb-Intensität 0..100 %. 100 = volle Akzentfarben, 0 = neutrales Grau
  systemFarbe: ACCENT,     // Akzentfarbe für System-Elemente (Logo, Zahnrad, Profil, Stift) — vom seriös-Modus mit eingegraut
  // ── Mein Profil ──
  // Eigenes User-Profil (NICHT mehr auf einen Kontakt verknüpft). Wird in
  // SektionProfil bearbeitet und im Header-Avatar als Initialen/Foto angezeigt.
  // Foto wird als Base64-DataURL gespeichert (auf 200×200 herunterskaliert
  // damit localStorage nicht überläuft).
  userProfil: {
    anrede: "",
    titel: "",
    vorname: "",
    nachname: "",
    funktion: "",
    foto: "",       // Base64-DataURL oder leer
    tels: [],       // [{ nr, type: "mobil"|"festnetz"|"büro" }]
    emails: [],     // [{ email }]
    strasse: "",
    plz: "",
    ort: "",
    geburtstag: "", // ISO YYYY-MM-DD
  },
  userKontaktId: null,     // Kein Default-Profil (blankes Programm); wird gesetzt, sobald Daten geladen sind
  dichte: "normal",        // "compact" | "normal" | "relaxed" – globale Schriftgröße/Dichte
  kartenMinBreite: 280,    // Mindest-Kartenbreite px → steuert Spaltenzahl (Übersicht) + Detailbreite (Master-Detail)
  detailFaktor: 1.1,       // Detailbreite als Vielfaches der Kartenbreite (1.0–2.5) → größer = breitere Detailansicht, weniger Master-Spalten
  hoherKontrast: false,    // sub-Texte mit deutlich höherem Kontrast
  legendeKontakte: true,   // Symbol-Legende über der Kontaktliste anzeigen
  legendeObjekte: true,    // Symbol-Legende über der Objektliste anzeigen
  // Sicherheits-Schalter: Löschen-Button getrennt für Objekte und Kontakte nur
  // sichtbar, wenn aktiv. Default aus, damit Löschen eine bewusste Entscheidung bleibt.
  loeschenErlaubtObjekte: false,
  loeschenErlaubtKontakte: false,
  // Filter-Buttons auf den Listenseiten — pro Art an/aus. Nur aktivierte Arten
  // erscheinen als Filter-Button neben der Sektions-Überschrift; "Alle" ist
  // immer sichtbar.
  filterVerwaltungsarten: { weg: true, miet: false, gewerbe: false, sev: false },
  // Eigene Gruppen (Pillen im Header): je { id, name, sichtbar, modus
  // "manuell"|"kriterien", mitglieder: [IDs], kriterien: {rollen|verwaltungsarten} }
  kontaktGruppen: [],
  // Kalender-Panel (Orientierungskalender im Kalender-Tab)
  kalWochenstart: "mo",   // "mo" | "so"
  kalKw: true,            // KW-Spalte anzeigen
  kalZoom: "monat",       // Standard-Zoomstufe: monat | woche | tag
  kalArbeitVon: 8,        // Arbeitstag-Fenster (Stunde 0–23) — im Zeitstrahl abgesetzt
  kalArbeitBis: 17,
  // Tagesspezifische Arbeitszeiten (optional). Schlüssel = JS getDay()
  // (0=So … 6=Sa). Fehlt der Eintrag, gilt kalArbeitVon/Bis für Mo–Fr und
  // Sa/So als arbeitsfrei (siehe tagArbeitszeit). { an, von, bis } je Tag.
  kalArbeitTage: null,
  kalArbeitTageAktiv: false, // false = einheitliche Zeit (kalArbeitVon/Bis) für alle Werktage
  listenAnsicht: "karten",   // "karten" | "liste" — Übersicht von Objekten/Kontakten
  kalHeuteInfo: true,     // Datum + Uhrzeit im Heute-Button anzeigen
  kalSeitenleiste: false, // Desktop: Kalender dauerhaft rechts (wie Dashboard links)
  objektGruppen: [],
  filterKontaktarten:     { person: true, firma: true }, // Rollen-Filter (p_…, f_…) werden dynamisch aus settings.rollen/firmenRollen gefüllt
  kacheln: [
    { id:"objekte",       label:"Objekte",       icon:"building",  farbe:ACCENT,    aktiv:true,  reihenfolge:0 },
    { id:"kontakte",      label:"Kontakte",      icon:"users",     farbe:KONTAKTE_FARBE,        aktiv:true,  reihenfolge:1 },
    { id:"kalender",      label:"Kalender",      icon:"calendar",  farbe:"#F59E0B", aktiv:true,  reihenfolge:2 },
    { id:"etv",           label:"ETV",           icon:"calendar",  farbe:"#8B5CF6", aktiv:true,  reihenfolge:3 },
    { id:"beschluss",     label:"Beschlusssammlung", icon:"document", farbe:"#F59E0B", aktiv:false, reihenfolge:4 },
    { id:"auftraege",     label:"Vorgänge",      icon:"ticket",    farbe:"#EF4444", aktiv:true,  reihenfolge:5 },
    { id:"kommunikation", label:"Kommunikation", icon:"mail",      farbe:"#0EA5E9", aktiv:true,  reihenfolge:6 },
    { id:"finanzen",      label:"Finanzen",      icon:"chart",     farbe:"#22C55E", aktiv:true,  reihenfolge:7 },
    { id:"technik",       label:"Technik",       icon:"wrench",    farbe:"#10B981", aktiv:false, reihenfolge:8 },
    { id:"dokumente",     label:"Dokumente",     icon:"document",  farbe:"#64748B", aktiv:false, reihenfolge:9 },
    { id:"statistik",     label:"Statistik",     icon:"chart",     farbe:"#6366F1", aktiv:true,  reihenfolge:10 },
    { id:"listen",        label:"Listengenerator", icon:"sort",    farbe:"#0E7490", aktiv:true,  reihenfolge:11 },
    { id:"fotos",         label:"Fotos",         icon:"paint",     farbe:"#EC4899", aktiv:true,  reihenfolge:12 },
    { id:"schnelleingabe", label:"Schnelleingabe", icon:"plus",    farbe:"#0080FF", aktiv:true,  reihenfolge:13 },
  ],
  // Objekt-Detail-Tabs: Reihenfolge + Sichtbarkeit (global). Liegenschaft und
  // Verwaltung sind fix (immer sichtbar, nicht sortierbar) — daher nur die
  // übrigen Tabs hier konfigurierbar. fix:true markiert die unverrückbaren.
  objektTabs: [
    { id:"liegenschaft", label:"Liegenschaft", icon:"building", aktiv:true, fix:true,  reihenfolge:0 },
    { id:"verwaltung",   label:"Verwaltung",   icon:"document", aktiv:true, fix:true,  reihenfolge:1 },
    { id:"legionellen",  label:"Legionellen",  icon:"drop",     aktiv:true, fix:false, reihenfolge:2 },
    { id:"te",           label:"TE",           icon:"badge",    aktiv:true, fix:false, reihenfolge:3 },
    { id:"dokumente",    label:"Dokumente",    icon:"document", aktiv:true, fix:false, reihenfolge:4 },
    { id:"kontakte",     label:"Kontakte",     icon:"users",    aktiv:true, fix:false, reihenfolge:5 },
    { id:"bilder",       label:"Bilder",       icon:"paint",    aktiv:true, fix:false, reihenfolge:6 },
    { id:"historie",     label:"Historie",     icon:"calendar", aktiv:true, fix:false, reihenfolge:7 },
  ],
};

// ── Verwaltungsarten und Kontaktarten ────────────────────────────────────
// Reihenfolge wirkt sich auf die Filter-Button-Reihenfolge aus.
const VERWALTUNGSARTEN = [
  { id: "weg",     label: "WEG",                kurz: "WEG"     },
  { id: "miet",    label: "Mietverwaltung",     kurz: "Miet"    },
  { id: "gewerbe", label: "Gewerbeverwaltung",  kurz: "Gewerbe" },
  { id: "sev",     label: "SEV",                kurz: "SEV"     },
];

// ── Wirtschaftsjahr → rechenbarer Zeitraum (für Personen-Tage-Schlüssel) ──
// Das Wirtschaftsjahr-Feld (ve.etvStamm.wirtschaftsjahr) ist ein STRING:
// entweder "Kalenderjahr" (Default) oder ein frei definierter Zeitraum. Für
// den Personen-Tage-Schlüssel brauchen wir daraus ein rechenbares {von, bis}
// (ISO yyyy-mm-dd, inklusive bis). Default "Kalenderjahr" ⇒ VORJAHR (das
// typische Abrechnungsjahr), 01.01.–31.12. Schaltjahre fallen durch die echte
// Datumsrechnung automatisch korrekt aus (366 statt 365 Tage).
function wirtschaftsjahrZeitraum(wjWert, jahr) {
  const s = String(wjWert == null ? "" : wjWert).trim();
  const istKalender = !s || s.toLowerCase() === "kalenderjahr";
  if (istKalender) {
    // Ohne explizit gewähltes Jahr: Vorjahr (typisches Abrechnungsjahr).
    const j = (typeof jahr === "number" && jahr >= 1900)
      ? jahr : (new Date().getFullYear() - 1);
    return { von: `${j}-01-01`, bis: `${j}-12-31` };
  }
  // Freitext-Zeitraum: "tt.mm.jjjj – tt.mm.jjjj" (diverse Trenner tolerant).
  const teile = s.split(/\s*(?:–|-|bis|—|\u2013|\u2014)\s*/i).filter(Boolean);
  if (teile.length >= 2) {
    const von = zuIsoDatum(teile[0]);
    const bis = zuIsoDatum(teile[teile.length - 1]);
    if (von && bis) return { von, bis };
  }
  // Nur eine Jahreszahl im Freitext ⇒ ganzes Kalenderjahr.
  const nurJahr = s.match(/(\d{4})/);
  if (nurJahr) {
    const j = Number(nurJahr[1]);
    return { von: `${j}-01-01`, bis: `${j}-12-31` };
  }
  // Unparsbar: Fallback Vorjahr.
  const j = new Date().getFullYear() - 1;
  return { von: `${j}-01-01`, bis: `${j}-12-31` };
}

// Tage zwischen zwei ISO-Daten, INKLUSIVE beider Ränder (echte Kalendertage,
// Schaltjahr-korrekt). Gibt 0 zurück, wenn ungültig oder bis < von.
function tageInklusive(vonIso, bisIso) {
  const v = parseDatumWert(vonIso);
  const b = parseDatumWert(bisIso);
  if (!v || !b) return 0;
  const MS = 24 * 60 * 60 * 1000;
  // Auf Mitternacht normalisieren, Zeitzonen-Drift vermeiden.
  const vU = Date.UTC(v.getFullYear(), v.getMonth(), v.getDate());
  const bU = Date.UTC(b.getFullYear(), b.getMonth(), b.getDate());
  if (bU < vU) return 0;
  return Math.round((bU - vU) / MS) + 1;
}

// Überschneidungs-Tage eines Personen-Zeitraums [pVon,pBis] mit dem
// Wirtschaftsjahr [wjVon,wjBis] — beide inklusive. Offene Ränder (leeres von /
// leeres bis am Personen-Zeitraum) bedeuten „seit jeher" bzw. „bis auf
// Weiteres" und werden auf die WJ-Grenze geklemmt. So zählt eine Person ohne
// erfasste Daten automatisch das volle Wirtschaftsjahr (Hybrid-Fallback).
function personenTageImWj(pVon, pBis, wjVon, wjBis) {
  const pv = (pVon && zuIsoDatum(pVon)) || wjVon;
  const pb = (pBis && zuIsoDatum(pBis)) || wjBis;
  // Schnittmenge der beiden Intervalle (ISO-Strings vergleichbar lexikografisch).
  const von = pv > wjVon ? pv : wjVon;
  const bis = pb < wjBis ? pb : wjBis;
  if (bis < von) return 0;
  return tageInklusive(von, bis);
}

// ── Verteilerschlüssel (Umlageschlüssel) ─────────────────────────────────
// Vier Standard-Schlüssel sind vordefiniert; eigene kommen dazu. Persistiert
// wird NUR das Delta in ve.verteilerschluessel (Overrides der Standards, z. B.
// Personen-Anteile, + komplett eigene Schlüssel). effVerteilerschluessel
// merged beim Lesen — gleiches Muster wie das Kategorien-System.
// Basen: mea/flaeche/einheiten = berechnet aus Einheiten-Daten;
//        personen/manuell      = manuelle Anteile je Einheit (anteile-Map).
const DEFAULT_VERTEILERSCHLUESSEL = [
  { id: "mea",       name: "MEA",        basis: "mea",       fix: true },
  { id: "flaeche",   name: "Wohnfläche", basis: "flaeche",   fix: true },
  { id: "einheiten", name: "Einheiten",  basis: "einheiten", fix: true },
  { id: "personen",  name: "Personen",   basis: "personen",  fix: true },
];
const VS_BASEN = [
  { id: "mea",       label: "nach MEA (berechnet)" },
  { id: "flaeche",   label: "nach Wohnfläche (berechnet)" },
  { id: "einheiten", label: "je Einheit gleich (berechnet)" },
  { id: "personen",  label: "Personenzahl (aus Bewohnern)" },
  { id: "manuell",   label: "manuelle Anteile je Einheit" },
];
const vsBasisLabel = (basis) => {
  const b = VS_BASEN.find(x => x.id === basis);
  return b ? b.label : basis;
};
// Manuelle Anteile (anteile-Map je Einheit): nur die freie „manuell"-Basis.
// „personen" ist NICHT mehr manuell — der Wert kommt aus den Bewohnern und wird
// beim Editieren über setzeEinheitKopfzahl in die Einheit zurückgeschrieben.
const vsIstManuell = (basis) => basis === "manuell";
// Editierbar, aber an die Einheit gekoppelt (Kopfzahl-Rückschreibung).
const vsIstPersonen = (basis) => basis === "personen";
function effVerteilerschluessel(ve) {
  const over = (ve && Array.isArray(ve.verteilerschluessel)) ? ve.verteilerschluessel : [];
  const std = DEFAULT_VERTEILERSCHLUESSEL.map(d => {
    const o = over.find(x => x && x.id === d.id);
    // basis/fix der Standards sind nicht überschreibbar — nur name/anteile.
    return o ? { ...d, ...o, basis: d.basis, fix: true } : { ...d };
  });
  const eigene = over.filter(x => x && !DEFAULT_VERTEILERSCHLUESSEL.some(d => d.id === x.id));
  return [...std, ...eigene];
}
// Wert eines Schlüssels für eine Einheit (Zahl; 0 wenn leer/unbekannt).
// Optionaler 3. Parameter wj = { von, bis }: ist er gesetzt, liefert die
// Personen-Basis PERSONEN-TAGE über das Wirtschaftsjahr (historisch korrekt)
// statt der heutigen Kopfzahl. Ohne wj bleibt das Alt-Verhalten (Köpfe) — so
// brechen bestehende Aufrufstellen nicht.
function vsWertVon(schluessel, einheit, wj) {
  const basis = (schluessel && schluessel.basis) || "manuell";
  if (basis === "mea")       return parseFlaeche(einheit && einheit.mea);
  if (basis === "flaeche")   return flaecheVon(einheit);
  if (basis === "einheiten") return 1;
  if (basis === "personen") {
    if (wj && wj.von && wj.bis) return einheitPersonenTage(einheit, wj.von, wj.bis);
    return einheitKopfzahl(einheit);
  }
  const ant = (schluessel && schluessel.anteile) || {};
  return parseFlaeche(ant[einheit && einheit.id]);
}
// Kontaktarten: Kategorien (Personen/Firmen) und Rollen-Filter. Die Rollen-
// Filter werden zur Laufzeit aus settings.rollen und settings.firmenRollen
// gebaut, damit sie immer zur Rollen-Verwaltung passen — auch nach
// Umbenennen/Löschen/Hinzufügen.
const KONTAKTARTEN_KATEGORIEN = [
  { id: "person", label: "Personen", kurz: "Personen", typ: "kategorie" },
  { id: "firma",  label: "Firmen",   kurz: "Firmen",   typ: "kategorie" },
];
function buildKontaktarten(personenRollen, firmenRollen) {
  const out = [...KONTAKTARTEN_KATEGORIEN];
  (personenRollen || []).filter(r => r.aktiv !== false).forEach(r => {
    out.push({
      id: "p_" + r.name, label: r.name, kurz: r.name,
      typ: "rolle_person", rollenname: r.name,
    });
  });
  (firmenRollen || []).filter(r => r.aktiv !== false).forEach(r => {
    out.push({
      id: "f_" + r.name, label: r.name, kurz: r.kuerzel || r.name,
      typ: "rolle_firma", rollenname: r.name,
    });
  });
  return out;
}
// Helper: prüft ob ein Kontakt zum Filter-ID passt. `arten` ist die aktuelle
// (dynamisch gebaute) Liste.
function kontaktPasstZuArt(k, artId, arten) {
  if (artId === "alle" || !artId) return true;
  const def = (arten || []).find(a => a.id === artId);
  if (!def) return true;
  if (def.typ === "kategorie") {
    if (def.id === "person") return k.typ !== "firma";
    if (def.id === "firma")  return k.typ === "firma";
    return true;
  }
  if (def.typ === "rolle_person" && k.typ === "firma") return false;
  if (def.typ === "rolle_firma"  && k.typ !== "firma") return false;
  return (k.objektZuweisungen || []).some(z =>
    z.rolle === def.rollenname && (z.status || "aktiv") === "aktiv");
}

// ── Eigene Gruppen (settings.kontaktGruppen / settings.objektGruppen) ───────
// Mitgliedschaft: manuell kuratiert (mitglieder-IDs) oder kriterienbasiert —
// Kontakte über aktive Rollen-Zuweisungen, Objekte über die Verwaltungsart.
// Kriterien-Gruppen halten sich dadurch von selbst aktuell.
function kontaktInGruppe(k, g) {
  if (!k || !g) return false;
  if (g.modus === "kriterien") {
    var rl = (g.kriterien && g.kriterien.rollen) || [];
    return rl.length > 0 && (k.objektZuweisungen || []).some(function(z) {
      return z && rl.indexOf(z.rolle) >= 0 && (z.status || "aktiv") === "aktiv";
    });
  }
  return (g.mitglieder || []).indexOf(k.id) >= 0;
}
// Ort eines Objekts aus der Adresse („Waldstraße 123, 80337 München" → „München").
function objektOrt(ve) {
  var teile = String((ve && ve.adresse) || "").split(",");
  var letzter = (teile[teile.length - 1] || "").trim();
  return splitPlzOrt(letzter).ort || letzter;
}
function objektInGruppe(ve, g) {
  if (!ve || !g) return false;
  if (g.modus === "kriterien") {
    // Dimensionen UND-verknüpft, innerhalb einer Dimension ODER.
    var va = (g.kriterien && g.kriterien.verwaltungsarten) || [];
    var orte = (g.kriterien && g.kriterien.orte) || [];
    if (va.length === 0 && orte.length === 0) return false;
    if (va.length > 0 && va.indexOf(ve.verwaltungsart || "weg") < 0) return false;
    if (orte.length > 0 && orte.indexOf(objektOrt(ve)) < 0) return false;
    return true;
  }
  return (g.mitglieder || []).indexOf(ve.id) >= 0;
}

// ── Feld-Typen für FieldList / AddFieldModal ────────────────────────────────
const FIELD_TYPES = [
  { id:"text",   label:"Text",    icon:"T",  color:"#6366F1" },
  { id:"number", label:"Zahl/m²", icon:"#",  color:"#0EA5C9" },
  { id:"date",   label:"Datum",   icon:"📅", color:"#F59E0B" },
  { id:"bool",   label:"Ja/Nein", icon:"✓",  color:"#10B981" },
  { id:"select", label:"Auswahl", icon:"☰",  color:"#0EA5C9" },
  { id:"kontakt",label:"Kontakt", icon:"👤", color:"#8B5CF6" },
  { id:"kontakte",label:"Kontakte", icon:"👥", color:"#8B5CF6" },
  { id:"objekt", label:"Objekt",  icon:"🏢", color:"#0E7490" },
  { id:"notiz",  label:"Notizen", icon:"📝", color:"#6366F1" },
  { id:"file",   label:"Datei",   icon:"📎", color:"#8B5CF6" },
  { id:"legionellen", label:"Legionellen", icon:"💧", color:"#0EA5C9" },
  { id:"berechnet_override", label:"Berechnet", icon:"=", color:"#0EA5C9" },
];

// Feldtypen, die im „Neues Feld anlegen"-Menü zur Auswahl stehen (bewusst
// reduziert): kein bool-Haken (→ Ja/Nein ist ein select), keine Datei. Ja/Nein
// erzeugt ein select mit festen Optionen, Auswahl ein select mit eigenen.
// „Notizen" = großes, IMMER beschreibbares Textfeld (auch im Lese-Modus).
const ANLEGE_FELDTYPEN = [
  { id:"text",    label:"Text",    icon:"T" },
  { id:"number",  label:"Zahl/m²", icon:"#" },
  { id:"date",    label:"Datum",   icon:"📅" },
  { id:"janein",  label:"Ja/Nein", icon:"☰" },
  { id:"select",  label:"Auswahl", icon:"☰" },
  { id:"kontakt", label:"Kontakt", icon:"👤" },
  { id:"kontakte",label:"Kontakte",icon:"👥" },
  { id:"objekt",  label:"Objekt",  icon:"🏢" },
  { id:"notiz",   label:"Notizen", icon:"📝" },
];

const SUGGESTIONS = {
  gebaeude: [
    { name:"Umbaujahr",          type:"number" }, { name:"Dachsanierung",   type:"date"   },
    { name:"Energieklasse",      type:"text"   },
    { name:"Aufzug vorhanden",   type:"bool"   }, { name:"Photovoltaik",    type:"bool"   },
    { name:"Balkonkraftwerk",    type:"bool"   }, { name:"Fassadenzustand", type:"text"   },
    { name:"Kabelanschluss",     type:"bool"   }, { name:"Internet-Anbieter", type:"text" },
    { name:"Glasfaser – Stand",  type:"select",
      optionen: ["Nicht verfügbar", "Ausbau geplant", "FTTC – bis Verteilerkasten", "FTTB – bis ins Gebäude", "FTTH – bis in die Wohnungen"] },
    { name:"Glasfaser – Gemeinschaft möchte", type:"select",
      optionen: ["Kein Interesse", "Interesse, ungeklärt", "FTTB gewünscht", "FTTH gewünscht", "Beschluss gefasst"] },
  ],
  stammdaten: [
    { name:"Grundbuchblatt",     type:"text"   }, { name:"Grundstücksfläche m²", type:"number" },
    { name:"Gemarkung",          type:"text"   }, { name:"Energieausweis bis",   type:"date"   },
  ],
  zugang: [
    { name:"Anzahl Schlüssel",   type:"number" }, { name:"Nächster Schlüsseldienst", type:"date" },
    { name:"Codeschloss",        type:"bool"   }, { name:"Video-Gegensprechanlage",  type:"bool" },
  ],
  einheit: [
    { name:"Messdienst-Nr.",     type:"text"   }, { name:"Zimmer",          type:"number" },
    { name:"Sondernutzungsrecht",type:"text"   }, { name:"Keller",          type:"bool"   },
    { name:"Balkon",             type:"bool"   }, { name:"Stellplatz-Nr.",  type:"text"   },
  ],
  kontakt: [
    { name:"Geburtstag",   type:"date" }, { name:"Hobby",        type:"text" },
    { name:"IBAN",         type:"text" }, { name:"Steuer-Nr.",   type:"text" },
    { name:"Zusätzliche Adresse", type:"address" },
  ],
};


const isStellplatzTyp = (typ) => ["Stellplatz","Garage","Carport","Doppelparker"].includes(typ);
const extractNachname = (n) => { if(!n) return ""; const p=n.trim().split(" "); return p[p.length-1]; };

// ═════════════════════════════════════════════════════════════════════════════
// SCHICHTUNG: EINHEIT → TEIL → BELEGUNG → HAUSHALT   (Umbau-Spec, Variante A)
// ─────────────────────────────────────────────────────────────────────────────
// Konzept (siehe Umbau-Spec):
//   EINHEIT   statisch · Eigentum/Recht  (Grundbuch, MEA, Stimmrecht, EIGENTÜMER)
//             → der Eigentümer hängt weiterhin an der Einheit (einheit.eigentuemer)
//     └ TEIL          physisch · Substanz (Räume, Zähler) — immer MINDESTENS 1.
//                     Im 95-%-Fall genau 1, dann von der UI unsichtbar geführt.
//          └ BELEGUNG          zeitlich · Kapitel im Zeitstrahl (von–bis, lückenlos)
//                              typ: "vermietung" | "selbstnutzung" | "leerstand"
//                              bei vermietung: + mietvertrag {von, kaution, hoehe, ...}
//                              vertragspartei: kontaktId (kann ≠ Bewohner sein)
//               └ HAUSHALT     wer wohnt drin (außer bei leerstand)
//                              mitglieder: [{kontaktId|null, name, vermerk}]  (mit/ohne Kontakt)
//                              anonym: Zahl (z. B. 2 = „+2 Kinder")
//
// Variante A: einheit.teile ist IMMER ein Array mit ≥1 Teil. Kein Sonderpfad
// für „nicht unterteilt". Die UI versteckt die Teil-Ebene, wenn teile.length === 1.
// ─────────────────────────────────────────────────────────────────────────────

const BELEGUNG_TYPEN = ["vermietung", "selbstnutzung", "leerstand"];
const BELEGUNG_LABEL = { vermietung: "Vermietung", selbstnutzung: "Selbstnutzung", leerstand: "Leerstand" };

// Weg 2 (Variante B): Jeder Bewohner trägt eine eigene Rechtsgrundlage. Der
// Belegungstyp wird daraus ABGELEITET (gibt es einen Mieter → vermietet; sonst
// Eigennutzer/Nießbraucher/Wohnberechtigter → bewohnt; niemand → leer).
// kuerzel = Badge, farbe = Akzent, mietvertrag = ob bei dieser Rolle ein
// Mietvertrag-Block sinnvoll ist.
const BEWOHNER_RECHTE = [
  { id: "mieter",          label: "Mieter",          kuerzel: "M",  farbe: "#22C55E", mietvertrag: true  },
  { id: "paechter",        label: "Pächter",         kuerzel: "P",  farbe: "#16A34A", mietvertrag: true  },
  { id: "eigennutzer",     label: "Eigennutzer",     kuerzel: "EN", farbe: "#3B82F6", mietvertrag: false },
  { id: "niessbraucher",   label: "Nießbraucher",    kuerzel: "NB", farbe: "#9333EA", mietvertrag: false },
  { id: "wohnberechtigt",  label: "Wohnberechtigt",  kuerzel: "WB", farbe: "#0891B2", mietvertrag: false },
  { id: "angehoeriger",    label: "Angehöriger",     kuerzel: "AG", farbe: "#64748B", mietvertrag: false },
  { id: "sonstige",        label: "Sonstige",        kuerzel: "S",  farbe: "#64748B", mietvertrag: false },
];
function bewohnerRecht(id) {
  return BEWOHNER_RECHTE.find(r => r.id === id) || BEWOHNER_RECHTE[0];
}
// Hat dieses Recht einen (Miet-/Pacht-)Vertrag und macht den Inhaber zur
// Vertragspartei? Single Source of Truth über das mietvertrag-Flag — damit
// Pächter (und künftige vertragsbasierte Rechte) ÜBERALL wie Mieter behandelt
// werden, ohne jede Stelle einzeln auf id-Strings zu prüfen.
function istVertragspartei(recht) {
  const r = BEWOHNER_RECHTE.find(x => x.id === recht);
  return !!(r && r.mietvertrag);
}

// IDs aus laufendem Counter PLUS Zeitstempel-Suffix — damit neu erzeugte IDs
// nicht mit sequenziellen Bestands-IDs (z. B. importiertes "beleg-1") kollidieren.
// Der Counter sichert Eindeutigkeit innerhalb desselben Millisekunden-Ticks.
let _teilIdCounter = 1, _belegIdCounter = 1, _hhMitgliedIdCounter = 1, _raumIdCounter = 1, _zaehlerIdCounter = 1;
const neueTeilId    = () => "teil-"  + Date.now().toString(36) + "-" + (_teilIdCounter++);
const neueBelegId   = () => "beleg-" + Date.now().toString(36) + "-" + (_belegIdCounter++);
const neueHhmId     = () => "hhm-"   + Date.now().toString(36) + "-" + (_hhMitgliedIdCounter++);
const neueRaumId    = () => "raum-"  + Date.now().toString(36) + "-" + (_raumIdCounter++);
const neueZaehlerId = () => "zlr-"   + Date.now().toString(36) + "-" + (_zaehlerIdCounter++);

// Leerer Haushalt-Container.
function leererHaushalt() {
  return { mitglieder: [] };
}

// Ein Haushaltsmitglied (Bewohner). recht = Rechtsgrundlage (siehe BEWOHNER_RECHTE).
// Default: mieter (häufigster Fall beim manuellen Hinzufügen).
function neuesHhMitglied(kontaktId, name, recht, anzahl) {
  return {
    id: neueHhmId(),
    kontaktId: kontaktId != null ? kontaktId : null,
    name: name || "",
    vermerk: "",
    recht: recht || "mieter",
    anzahl: (typeof anzahl === "number" && anzahl >= 1) ? anzahl : 1,
    // Meldezeitraum je Mitglied (für den Personen-Tage-Verteilerschlüssel).
    // Leer = „seit jeher / bis auf Weiteres" ⇒ zählt im Schlüssel das volle
    // Wirtschaftsjahr. Bei anonymen Sammel-Mitgliedern (anzahl > 1) gilt das
    // von/bis für ALLE darin gebündelten Köpfe gemeinsam (Hybrid: wer einzelne
    // Zeiträume braucht, legt mehrere anonyme Einträge mit je anzahl 1 an).
    von: "",
    bis: "",
  };
}

// Ein anonymes Mitglied = Bewohner ohne Kontaktkarte, trägt nur eine Personen-
// Anzahl (z. B. „3" Kinder). Erkennbar an kontaktId === null && !name.
function istAnonymesMitglied(m) {
  return !!m && (m.kontaktId == null) && !(m.name && String(m.name).trim());
}

// Personenzahl eines Mitglieds: benannt = 1, anonym = anzahl (mind. 1).
function mitgliedKopfzahl(m) {
  if (!m) return 0;
  if (istAnonymesMitglied(m)) return Math.max(1, Number(m.anzahl) || 1);
  return 1;
}

// Summe aller Köpfe eines Haushalts (benannte + anonyme nach anzahl).
function haushaltKopfzahl(hh) {
  if (!hh || !Array.isArray(hh.mitglieder)) return 0;
  return hh.mitglieder.reduce((s, m) => s + mitgliedKopfzahl(m), 0);
}

// ── Personenzahl je Einheit (für den Personen-Verteilerschlüssel) ───────────
// Die Personenzahl einer Einheit ist KEIN eigenes Feld, sondern die Summe der
// Köpfe über alle Teile (heute laufende bzw. aktive Belegung). Quelle der
// Wahrheit sind die Haushaltsmitglieder — benannte zählen 1, anonyme nach
// anzahl. So bleibt der Personen-Schlüssel automatisch mit den Bewohnern der
// Einheit verknüpft (Änderung dort wirkt sofort im Schlüssel).
function einheitKopfzahl(einheit) {
  const teile = teileVon(einheit);
  return teile.reduce((s, teil) => {
    const b = heuteLaufendeBelegung(teil) || aktiveBelegung(teil);
    const hh = (b && b.haushalt) || null;
    return s + haushaltKopfzahl(hh);
  }, 0);
}

// ── Personen-TAGE je Einheit (für den Personen-Tage-Verteilerschlüssel) ──────
// Anders als einheitKopfzahl (Stichtag heute) summiert das hier über die GANZE
// Historie: alle Belegungen aller Teile, deren Zeitraum das Wirtschaftsjahr
// schneidet — auch längst ehemalige. Pro Mitglied werden die im WJ gemeldeten
// Tage gezählt und mit der Kopfzahl des Mitglieds multipliziert (anonyme
// Sammel-Köpfe zählen anzahl-fach). So bleibt die Abrechnung eines vergangenen
// WJ korrekt, selbst wenn längst neue Bewohner eingezogen sind.
//
// Zeit-Kaskade je Mitglied (engste verfügbare Angabe gewinnt):
//   1. m.von / m.bis            (individueller Meldezeitraum, falls gepflegt)
//   2. sonst beleg.von/.bis     (Zeitraum der Belegung)
//   3. offene Ränder ⇒ WJ-Grenze (personenTageImWj klemmt automatisch)
function mitgliedPersonenTage(m, beleg, wjVon, wjBis) {
  if (!m) return 0;
  const von = (m.von && String(m.von).trim()) || (beleg && beleg.von) || "";
  const bis = (m.bis && String(m.bis).trim()) || (beleg && beleg.bis) || "";
  const tage = personenTageImWj(von, bis, wjVon, wjBis);
  return tage * mitgliedKopfzahl(m);
}
// Personen-Tage eines einzelnen Abschnitts (Weg A): Tage im WJ × Anzahl.
// Offene Ränder erben den Belegungs-Zeitraum, dann die WJ-Grenze.
function abschnittPersonenTage(a, beleg, wjVon, wjBis) {
  if (!a) return 0;
  const von = (a.von && String(a.von).trim()) || (beleg && beleg.von) || "";
  const bis = (a.bis && String(a.bis).trim()) || (beleg && beleg.bis) || "";
  const tage = personenTageImWj(von, bis, wjVon, wjBis);
  const anz = (typeof a.anzahl === "number" && a.anzahl >= 0) ? a.anzahl : 1;
  return tage * anz;
}
// Personen-Tage einer Belegung. Hat sie GEFÜLLTE personenAbschnitte, sind diese
// maßgeblich (Weg A) — Lücken zwischen Abschnitten zählen automatisch als 0.
// Sonst Fallback auf die Haushalts-Mitglieder (Köpfe × Belegungs-Zeitraum).
function belegungPersonenTage(beleg, wjVon, wjBis) {
  if (!beleg) return 0;
  const abschnitte = Array.isArray(beleg.personenAbschnitte) ? beleg.personenAbschnitte : [];
  if (abschnitte.length > 0) {
    return abschnitte.reduce((s, a) => s + abschnittPersonenTage(a, beleg, wjVon, wjBis), 0);
  }
  const hh = beleg.haushalt || null;
  if (!hh || !Array.isArray(hh.mitglieder)) return 0;
  return hh.mitglieder.reduce((s, m) => s + mitgliedPersonenTage(m, beleg, wjVon, wjBis), 0);
}
function einheitPersonenTage(einheit, wjVon, wjBis) {
  if (!wjVon || !wjBis) return 0;
  const teile = teileVon(einheit);
  return teile.reduce((s, teil) => {
    const belegungen = (teil && Array.isArray(teil.belegungen)) ? teil.belegungen : [];
    return s + belegungen.reduce((ss, b) => ss + belegungPersonenTage(b, wjVon, wjBis), 0);
  }, 0);
}

// Aufschlüsselung der Personen-Tage einer Einheit im WJ — für die Übersicht/den
// Editor. Liefert je Belegung (die das WJ schneidet) eine Liste von Zeilen
// { id, von, bis, anzahl, tage, mieter, belegId, istAbschnitt }. Hat eine
// Belegung GEFÜLLTE personenAbschnitte, kommt je Abschnitt eine Zeile
// (istAbschnitt:true). Sonst eine abgeleitete Sammelzeile aus den Mitgliedern
// (istAbschnitt:false → in der UI als „noch nicht aufgeschlüsselt" markierbar).
// Die `tage` sind bereits gegen das WJ geschnitten.
function personenTageAufschluesselung(einheit, wjVon, wjBis) {
  const out = { zeilen: [], summe: 0, wjVon, wjBis };
  if (!wjVon || !wjBis) return out;
  const teile = teileVon(einheit);
  teile.forEach(teil => {
    const belegungen = (teil && Array.isArray(teil.belegungen)) ? teil.belegungen : [];
    belegungen.forEach(beleg => {
      // Belegungen, die das WJ gar nicht berühren, überspringen.
      const belegTage = personenTageImWj(beleg.von || "", beleg.bis || "", wjVon, wjBis);
      if (belegTage <= 0 && (beleg.von || beleg.bis)) {
        // Prüfen, ob trotzdem ein Abschnitt ins WJ ragt (offene Belegungsränder).
        const ragt = (Array.isArray(beleg.personenAbschnitte) ? beleg.personenAbschnitte : [])
          .some(a => personenTageImWj(a.von || "", a.bis || "", wjVon, wjBis) > 0);
        if (!ragt) return;
      }
      const mieter = mieterNameVon(beleg);
      const abschnitte = Array.isArray(beleg.personenAbschnitte) ? beleg.personenAbschnitte : [];
      if (abschnitte.length > 0) {
        abschnitte.forEach(a => {
          const tage = abschnittPersonenTage(a, beleg, wjVon, wjBis);
          const vonEff = (a.von && String(a.von).trim()) || beleg.von || "";
          const bisEff = (a.bis && String(a.bis).trim()) || beleg.bis || "";
          const kalenderTage = personenTageImWj(vonEff, bisEff, wjVon, wjBis);
          out.zeilen.push({
            id: a.id, belegId: beleg.id, istAbschnitt: true,
            von: a.von || beleg.von || "", bis: a.bis || beleg.bis || "",
            anzahl: (typeof a.anzahl === "number" ? a.anzahl : 1),
            kalenderTage, tage, mieter,
          });
          out.summe += tage;
        });
      } else {
        // Fallback-Sammelzeile aus Mitgliedern.
        const tage = belegungPersonenTage(beleg, wjVon, wjBis);
        const hh = beleg.haushalt || null;
        const koepfe = hh ? haushaltKopfzahl(hh) : 0;
        const kalenderTage = personenTageImWj(beleg.von || "", beleg.bis || "", wjVon, wjBis);
        out.zeilen.push({
          id: beleg.id, belegId: beleg.id, istAbschnitt: false,
          von: beleg.von || "", bis: beleg.bis || "",
          anzahl: koepfe, kalenderTage, tage, mieter,
        });
        out.summe += tage;
      }
    });
  });
  return out;
}

// Mieter-/Vertragspartei-Name einer Belegung für die Anzeige (kurz).
function mieterNameVon(beleg) {
  if (!beleg) return "";
  if (beleg.typ === "leerstand") return "Leerstand";
  const hh = beleg.haushalt || null;
  const ms = (hh && Array.isArray(hh.mitglieder)) ? hh.mitglieder : [];
  const benannt = ms.filter(m => m && m.kontaktId != null && m.name);
  const mieter = benannt.find(m => m.recht === "mieter") || benannt[0];
  return (mieter && mieter.name) || "";
}

// Setzt die Personenzahl einer Einheit auf einen Zielwert, indem die Differenz
// zu den BENANNTEN Köpfen auf die anonymen Mitglieder gebucht wird — rauf wie
// runter. Benannte Bewohner bleiben unangetastet. Geschrieben wird in die heute
// laufende (sonst aktive) Belegung des aktiven Teils. Gibt die (ggf.) geänderte
// Einheit zurück; ist nichts zu ändern, kommt die Einheit unverändert zurück.
function setzeEinheitKopfzahl(einheit, ziel) {
  const z = Math.max(0, Math.round(Number(ziel) || 0));
  const teile = teileVon(einheit);
  const aktiv = aktiverTeil(einheit);
  if (!aktiv) return einheit;
  // Kopfzahl der ANDEREN Teile (bleibt unberührt) vom Ziel abziehen — der
  // aktive Teil trägt nur seinen Anteil.
  let andereKoepfe = 0;
  teile.forEach(teil => {
    if (teil === aktiv) return;
    const b = heuteLaufendeBelegung(teil) || aktiveBelegung(teil);
    andereKoepfe += haushaltKopfzahl((b && b.haushalt) || null);
  });
  const zielAktiv = Math.max(0, z - andereKoepfe);

  const beleg = heuteLaufendeBelegung(aktiv) || aktiveBelegung(aktiv);
  if (!beleg) return einheit; // echter Leerstand, keine Belegung zum Schreiben
  const hh = beleg.haushalt || leererHaushalt();
  const mitglieder = Array.isArray(hh.mitglieder) ? hh.mitglieder.slice() : [];

  const benannte = mitglieder.filter(m => !istAnonymesMitglied(m))
    .reduce((s, m) => s + mitgliedKopfzahl(m), 0);
  // Differenz, die über anonyme Köpfe abgebildet werden muss (nie negativ:
  // unter die benannten Köpfe kann nicht gedrückt werden).
  const zielAnonym = Math.max(0, zielAktiv - benannte);

  const anonIdx = mitglieder.findIndex(m => istAnonymesMitglied(m));
  let neueMitglieder;
  if (zielAnonym <= 0) {
    // keine anonymen Köpfe mehr nötig → vorhandenes anonymes Mitglied entfernen
    neueMitglieder = mitglieder.filter(m => !istAnonymesMitglied(m));
  } else if (anonIdx >= 0) {
    neueMitglieder = mitglieder.map((m, i) =>
      i === anonIdx ? { ...m, anzahl: zielAnonym } : m);
  } else {
    // Recht vom ersten benannten Mitglied erben, sonst eigennutzer als neutral.
    const benannt = mitglieder.find(m => !istAnonymesMitglied(m));
    const recht = (benannt && benannt.recht) || "eigennutzer";
    neueMitglieder = [...mitglieder, neuesHhMitglied(null, "", recht, zielAnonym)];
  }

  const neuHh = { ...hh, mitglieder: neueMitglieder };
  const neueBelegungen = aktiv.belegungen.map(b => b === beleg ? { ...b, haushalt: neuHh } : b);
  const neuerTeilObj = { ...aktiv, belegungen: neueBelegungen };
  const neueTeile = einheit.teile.map(teil => teil === aktiv ? neuerTeilObj : teil);
  return { ...einheit, teile: neueTeile };
}

// MEA einer Einheit setzen — flaches Stammdatenfeld (einheit.mea). Roh-String,
// damit Teil-Eingaben wie "12,5" erhalten bleiben (parseFlaeche liest sie aus).
function setzeEinheitMea(einheit, wert) {
  if (!einheit) return einheit;
  return { ...einheit, mea: String(wert == null ? "" : wert) };
}

// Anzahl der Teile einer Einheit (für die Sperre der Flächen-Bearbeitung bei
// Unterteilung). Eine Einheit ohne explizite Teile gilt als 1 (ungeteilt).
function einheitTeilAnzahl(einheit) {
  return (einheit && Array.isArray(einheit.teile)) ? einheit.teile.length : 1;
}

// Wohnfläche im Verteilerschlüssel ist nur bei UNGETEILTEN Einheiten rückschreibbar
// (genau ein Teil). Bei Unterteilung müsste die Summe auf mehrere Teile verteilt
// werden — das bleibt der Einheit vorbehalten.
function darfFlaecheImVsEditieren(einheit) {
  return einheitTeilAnzahl(einheit) <= 1;
}

// Wohnfläche einer ungeteilten Einheit setzen — schreibt in den (einzigen) Teil.
// Bei Unterteilung NO-OP (Sicherung gegen versehentliches Plätten mehrerer Teile).
function setzeEinheitFlaeche(einheit, wert) {
  if (!einheit) return einheit;
  if (!darfFlaecheImVsEditieren(einheit)) return einheit;
  const wertStr = String(wert == null ? "" : wert);
  const teile = teileVon(einheit);
  const aktiv = teile[0];
  // Legacy-Einheit ohne teile-Array: flaches Feld schreiben, damit flaecheVon greift.
  if (!Array.isArray(einheit.teile) || einheit.teile.length === 0) {
    return { ...einheit, flaeche: wertStr };
  }
  const neuerTeilObj = { ...aktiv, flaeche: wertStr };
  const neueTeile = einheit.teile.map(teil => teil === aktiv ? neuerTeilObj : teil);
  return { ...einheit, teile: neueTeile, flaeche: "" };
}

// Eine frische Belegung eines bestimmten Typs (Standard: Leerstand = lückenfüllend).
function neueBelegung(typ, von, bis) {
  const t = BELEGUNG_TYPEN.indexOf(typ) >= 0 ? typ : "leerstand";
  const b = {
    id: neueBelegId(),
    typ: t,
    von: von || "",
    bis: bis || "",
    haushalt: t === "leerstand" ? leererHaushalt() : leererHaushalt(),
    // Personenzahl-über-Zeit (Weg A, ab v12.17). Liste von Abschnitten
    // { id, von, bis, anzahl } für den Personen-Tage-Verteilerschlüssel.
    // LEER = Fallback auf die Haushalts-Kopfzahl über den Belegungs-Zeitraum
    // (Rückwärtskompatibilität). GEFÜLLT = maßgeblich; Lücken zwischen
    // Abschnitten zählen als 0 Personen (Leerstand). Der Mieter/die Belegung
    // ändert sich dabei NICHT — nur die gemeldete Personenzahl.
    personenAbschnitte: [],
  };
  if (t === "vermietung") {
    b.vertragsparteiId = null;          // Kontakt-ID der Vertragspartei (≠ Bewohner möglich)
    b.mietvertrag = { von: von || "", kaution: "", hoehe: "", kuendigung: "" };
  }
  return b;
}

// Ein Personenzahl-Abschnitt: in [von, bis] (inkl.) waren `anzahl` Personen
// gemeldet. Leeres von/bis = offener Rand (erbt Belegungs-/WJ-Grenze).
function neuerPersonenAbschnittId() {
  return "pa_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2, 8);
}
function neuerPersonenAbschnitt(von, anzahl, bis) {
  return {
    id: neuerPersonenAbschnittId(),
    von: von || "",
    bis: bis || "",
    anzahl: (typeof anzahl === "number" && anzahl >= 0) ? anzahl : 1,
  };
}

// ── Sondereigentumsverwaltung (SEV) ─────────────────────────────────────────
// Die SEV ist eine (meist Firmen-)Verwaltung, die EINE Einheit im Auftrag des
// Eigentümers betreut. Anders als die WEG-Verwaltung (Objekt-Ebene) hängt sie an
// der Einheit. Modelliert als LISTE einträge an `einheit.sev[]` — analog zu
// `eigentuemer[]` —, damit ein SEV-Wechsel als Chronik (alte endet, neue beginnt)
// abbildbar ist. Jeder Eintrag:
//   { id, kontaktId, name, seit, bis, vollmacht:{ erteilt:bool, datum } }
// Status wird datumsgesteuert abgeleitet (sevStatus), genau wie bei Eigentümern.
// SEV-ID ohne Top-Level-let (vermeidet TDZ/const-Hoisting-Falle, da neueSev
// früh im Modul referenziert wird).
function neueSevId() { return "sev_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2, 8); }
function neueSev(kontaktId, name, seit) {
  return {
    id: neueSevId(),
    kontaktId: kontaktId || null,
    name: name || "",
    seit: seit || "",
    bis: "",
    vollmacht: { erteilt: false, datum: "" },
  };
}
// Status eines SEV-Eintrags: ehemalig (bis erreicht), werdend (seit in Zukunft),
// sonst aktiv. Spiegelt das datumsgesteuerte Muster von eigStatus/Belegung.
function sevStatus(s) {
  if (!s) return "aktiv";
  const heute = isoHeute();
  if (s.bis && s.bis !== "—" && zuIsoDatum(s.bis) <= heute) return "ehemalig";
  if (s.seit && zuIsoDatum(s.seit) > heute) return "werdend";
  return "aktiv";
}
// Läuft an dieser Einheit gerade ein SEV-Wechsel? (mind. ein werdender Eintrag)
function laufenderSevWechsel(sevListe) {
  return (sevListe || []).some(s => sevStatus(s) === "werdend");
}
// SEV-WECHSEL als Vorgang (angelehnt an Belegungswechsel, ohne Zwischenstufen):
// beendet die laufende SEV mit bis=wechselDatum und legt eine neue SEV ab
// demselben Datum an (lückenlos). Gibt die neue sev-Liste zurück.
function starteSevWechsel(sevListe, neuKontaktId, neuName, wechselDatum) {
  const liste = Array.isArray(sevListe) ? sevListe : [];
  const datum = wechselDatum || "";
  const beendet = liste.map(s =>
    sevStatus(s) === "aktiv" ? { ...s, bis: datum || s.bis } : s);
  const neu = neueSev(neuKontaktId, neuName, datum);
  return [...beendet, neu];
}
// SEV-Wechsel abbrechen: entfernt werdende Einträge und macht das bis der zuvor
// beendeten aktiven SEV wieder rückgängig (sofern es == wechselDatum war).
function brecheSevWechselAb(sevListe) {
  const liste = Array.isArray(sevListe) ? sevListe : [];
  const werdendDaten = liste.filter(s => sevStatus(s) === "werdend").map(s => s.seit);
  const ohneWerdend = liste.filter(s => sevStatus(s) !== "werdend");
  return ohneWerdend.map(s =>
    (s.bis && werdendDaten.indexOf(s.bis) >= 0) ? { ...s, bis: "" } : s);
}
// Migration: ergänzt fehlendes sev-Feld an Bestandseinheiten. Idempotent.
function ergaenzeSevFeld(einheit) {
  if (!einheit || typeof einheit !== "object") return einheit;
  if (Array.isArray(einheit.sev)) return einheit;
  return { ...einheit, sev: [] };
}

// Ein frischer Teil mit genau einer (leerstehenden) Default-Belegung.
// Physische Stammdaten (Fläche, Zimmer, Lage, Räume, Zähler) hängen am Teil,
// nicht an der Einheit — eine Grundbuch-VE kann physisch in mehrere Wohnungen
// unterteilt sein. Auf Einheit-Ebene bleiben Eigentümer, MEA, Verwaltungsnr.
function neuerTeil(name) {
  return {
    id: neueTeilId(),
    name: name || "",                   // bei genau 1 Teil unsichtbar; bei Unterteilung „Wohnung A" etc.
    flaeche: "",                        // m² dieses Teils
    zimmer: "",                         // Zimmeranzahl dieses Teils
    lage: "",                           // z. B. „VH EG links" / „HH OG"
    raeume: [],                         // SE-Räume dieses Teils (neuerRaum)
    zaehler: [],                        // LEGACY: Zähler wandern an den Raum (raum.zaehler). Bleibt für Übergang.
    belegungen: [ neueBelegung("leerstand") ],
  };
}

// Gemeinsames Raum-Schema — IDENTISCH für Gemeinschaftsräume (an der Gebäude-Karte)
// und Sondereigentums-Räume (am Teil). Nur die kontextabhängigen Felder werden je
// nach Aufhängung in der UI ein-/ausgeblendet:
//   • Gemeinschaft: snrAn (Sondernutzungsrecht an Eigentümer/Einheit), art
//   • Sondereigentum: abrechnungsrelevant
// Geräte (zaehler/technik) sind überall gleich → eine Zähler-Komponente für beide.
function neuerRaum(name, lage) {
  return {
    id: neueRaumId(),
    name: name || "",
    icon: "",                           // optionales Symbol (KARTEN_ICONS); leer = Default-Tür
    lage: lage || "",                   // Etage / Lagebeschreibung
    flaeche: "",                        // optionale Raumfläche
    art: "",                            // Gemeinschaft: Technikraum/Keller/Außenanlage … (kontextabhängig)
    notizen: "",                        // freie Notizen zum Raum
    snrAn: null,                        // Gemeinschaft: Sondernutzungsrecht an {kontaktId|einheitId} (kontextabhängig)
    abrechnungsrelevant: true,          // Sondereigentum: zählt zur Abrechnungsfläche (kontextabhängig)
    zaehler: [],                        // Zähler & Heizkostenverteiler dieses Raums (neuerZaehler)
    technik: [],                        // sonstige technische Anlagen (frei)
  };
}

// Vorschläge für „Art / Nutzung" eines Raums (Dropdown mit Freitext „Andere…").
const RAUM_ART_OPTIONEN = [
  "Technikraum", "Heizungsraum", "Keller", "Kellerraum", "Hausflur", "Treppenhaus",
  "Waschküche", "Trockenraum", "Fahrradraum", "Müllraum", "Dachboden", "Speicher",
  "Außenanlage", "Garten", "Hof", "Abstellraum", "Lagerraum",
];

// Zähler-/HKV-Arten zur Auswahl. kuerzel für kompakte Anzeige, label fürs Dropdown.
const ZAEHLER_ARTEN = [
  { id: "kaltwasser", kuerzel: "KW",  label: "Kaltwasser" },
  { id: "warmwasser", kuerzel: "WW",  label: "Warmwasser" },
  { id: "strom",      kuerzel: "Str", label: "Strom" },
  { id: "gas",        kuerzel: "Gas", label: "Gas" },
  { id: "waerme",     kuerzel: "WMZ", label: "Wärmemenge" },
  { id: "hkv",        kuerzel: "HKV", label: "Heizkostenverteiler" },
];
function zaehlerArtLabel(id) {
  const a = ZAEHLER_ARTEN.find(x => x.id === id);
  return a ? a.label : (id || "Zähler");
}

// Schema für einen Zähler bzw. Heizkostenverteiler. Hängt an einem Raum.
// art unterscheidet die Geräteklasse; HKV trägt zusätzlich bewertungsfaktor.
function neuerZaehler(art) {
  return {
    id: neueZaehlerId(),
    art: art || "",                     // "kaltwasser"|"warmwasser"|"strom"|"gas"|"waerme"|"hkv" …
    nummer: "",                         // Zähler-/Gerätenummer
    standort: "",                       // Feinverortung im Raum (z. B. „Heizkörper Wohnzimmer Süd")
    staende: [],                        // Ablesungen: [{ datum, wert }]
    eichDatum: "",                      // letzte Eichung / Eichfrist-Beginn
    bewertungsfaktor: "",               // nur HKV: Bewertungs-/Bewertungsfaktor des Heizkörpers
  };
}

// Stellt sicher, dass eine Einheit das neue Schichtmodell besitzt. Idempotent,
// mutationsfrei genutzt (gibt teile-Array zurück, das ggf. neu erzeugt wurde).
function teileVon(einheit) {
  if (einheit && Array.isArray(einheit.teile) && einheit.teile.length > 0) return einheit.teile;
  return [ neuerTeil() ];
}

// Der „aktive" (erste) Teil — im Normalfall der einzige.
function aktiverTeil(einheit) {
  const teile = teileVon(einheit);
  return teile[0];
}

// Parst einen Flächen-Wert (z. B. "97", "97 m²", "60,5") zu einer Zahl. Gibt 0
// zurück, wenn nichts Sinnvolles enthalten ist.
function parseFlaeche(v) {
  if (v == null) return 0;
  const m = String(v).replace(",", ".").match(/-?\d+(\.\d+)?/);
  return m ? parseFloat(m[0]) : 0;
}

// Gesamtfläche einer Einheit. Bei Unterteilung = Summe der Teil-Flächen.
// Legacy-Fallback: flache einheit.flaeche, solange noch kein Teil eine Fläche hat.
function flaecheVon(einheit) {
  const teile = teileVon(einheit);
  const summe = teile.reduce((acc, teil) => acc + parseFlaeche(teil && teil.flaeche), 0);
  if (summe > 0) return summe;
  return parseFlaeche(einheit && einheit.flaeche);
}

// Summe der Raumflächen eines Teils (alle Räume mit flaeche > 0). Dient als
// weicher Vorschlag für die Teilfläche — nie als harte Überschreibung.
// (Optional später: nur abrechnungsrelevante Räume zählen.)
function summeRaumFlaechen(raeume) {
  if (!Array.isArray(raeume)) return 0;
  return raeume.reduce((acc, r) => acc + parseFlaeche(r && r.flaeche), 0);
}

// Die aktuell laufende Belegung eines Teils = jene ohne Enddatum (bis leer),
// sonst die zuletzt beginnende. Gibt null zurück, wenn keine existiert.
function aktiveBelegung(teil) {
  if (!teil || !Array.isArray(teil.belegungen) || teil.belegungen.length === 0) return null;
  const heute = isoHeute();
  // Noch zukünftige geplante (werdende) Belegungen zählen nicht als aktiv;
  // terminierte, deren Übergangsdatum erreicht ist, dagegen schon.
  const echte = teil.belegungen.filter(b => !(b.geplant && (!b.von || zuIsoDatum(b.von) > heute)));
  if (echte.length === 0) return null;
  const laufend = echte.filter(b => !b.bis);
  if (laufend.length > 0) {
    // jüngster Beginn gewinnt, falls mehrere offen sind (ISO-normalisiert)
    return laufend.slice().sort((a, b) => zuIsoDatum(b.von).localeCompare(zuIsoDatum(a.von)))[0];
  }
  return echte.slice().sort((a, b) => zuIsoDatum(b.von).localeCompare(zuIsoDatum(a.von)))[0];
}

// Die aktuell laufende Belegung der Einheit (über den aktiven Teil).
function aktiveBelegungVon(einheit) {
  return aktiveBelegung(aktiverTeil(einheit));
}

// Phase einer Belegung bezogen auf heute (ISO-normalisiert):
//   · "beendet"  — bis liegt heute oder früher
//   · "geplant"  — von liegt in der Zukunft (beginnt erst später)
//   · "aktuell"  — läuft jetzt (von ≤ heute, kein bis oder bis > heute)
function belegungsPhase(b, heuteIso) {
  if (!b) return "aktuell";
  const heute = heuteIso || isoHeute();
  const von = zuIsoDatum(b.von);
  const bis = zuIsoDatum(b.bis);
  // Geplante (werdende) Belegung aus einem laufenden Wechsel-Vorgang: solange
  // kein Übergangsdatum gesetzt ist ODER es noch in der Zukunft liegt → geplant.
  // Ist das Datum erreicht/überschritten, gilt die normale Datumslogik (aktiv).
  if (b.geplant && (!von || von > heute)) return "geplant";
  if (bis && bis <= heute) return "beendet";
  if (von && von > heute) return "geplant";
  return "aktuell";
}

// Die HEUTE laufende Belegung eines Teils (Phase "aktuell"). Anders als
// aktiveBelegung (nimmt das offene/jüngste Kapitel) berücksichtigt dies das
// Datum: eine erst künftig beginnende Belegung ist NICHT die heute laufende.
// Fällt auf aktiveBelegung zurück, wenn heute keine Phase "aktuell" hat.
function heuteLaufendeBelegung(teil) {
  if (!teil || !Array.isArray(teil.belegungen) || teil.belegungen.length === 0) return null;
  const heute = isoHeute();
  const laufendHeute = teil.belegungen.filter(b => belegungsPhase(b, heute) === "aktuell");
  if (laufendHeute.length > 0) {
    return laufendHeute.slice().sort((a, b) => zuIsoDatum(b.von).localeCompare(zuIsoDatum(a.von)))[0];
  }
  // Nichts läuft heute (echter Leerstand zwischen Kapiteln, oder alles beendet).
  // KEIN Fallback auf eine beendete Belegung — sonst gilt ein längst ausgezogener
  // Bewohner fälschlich als aktiv. Eine ggf. existierende offene (nie beendete)
  // Belegung wird über aktiveBelegung dennoch gefunden.
  const akt = aktiveBelegung(teil);
  if (akt && (!akt.bis || zuIsoDatum(akt.bis) > heute)) return akt;
  return null;
}

// Der aktuelle Haushalt der Einheit (über aktive Belegung). Leerstand → leerer HH.
function aktiverHaushalt(einheit) {
  const b = aktiveBelegungVon(einheit);
  if (!b) return leererHaushalt();
  return b.haushalt || leererHaushalt();
}

// Belegungstyp der Einheit aktuell ("vermietung"|"selbstnutzung"|"leerstand"|null).
// Weg 2: aus den Rechtsgrundlagen der Bewohner ABGELEITET. Gibt es einen Mieter →
// "vermietung"; sonst Bewohner vorhanden → "selbstnutzung" (Eigennutzung im weiteren
// Sinn, inkl. Nießbrauch/Wohnrecht); niemand → "leerstand". Fällt auf das alte
// beleg.typ-Feld zurück, falls (noch) keine Bewohner mit recht existieren.
function abgeleiteterBelegungstyp(beleg) {
  if (!beleg) return null;
  const hh = beleg.haushalt || { mitglieder: [] };
  const mit = (hh.mitglieder || []).filter(Boolean);
  if (mit.length > 0) {
    if (mit.some(m => istVertragspartei(m.recht))) return "vermietung";
    return "selbstnutzung";
  }
  // keine Bewohner: Legacy-typ respektieren, sonst Leerstand
  return beleg.typ || "leerstand";
}

function belegungsTyp(einheit) {
  const b = aktiveBelegungVon(einheit);
  return b ? abgeleiteterBelegungstyp(b) : null;
}

// ── Belegungsabgeleitete Verwendungen ───────────────────────────────────────
// Diese drei Verwendungen sind KEINE frei wählbaren Etiketten mehr, sondern
// folgen automatisch aus der Belegung (Quelle der Wahrheit ist der Belegung-Tab).
// Sie werden in den Stammdaten nur ANGEZEIGT, nicht editiert.
// Abgeleitete (NICHT frei wählbare) Verwendungen. Diese Namen werden live aus
// der Belegung bzw. dem Bewohner-Recht erzeugt und dürfen daher NICHT zusätzlich
// als freie Etiketten in einheit.verwendungen geführt werden (sonst Doppel-
// anzeige, z. B. „Vermietet" + „Verpachtet" gleichzeitig). „Verpachtet" und
// „Nießbrauch" gehören hierher, weil sie — wie Miete — den Belegungsschlitz
// belegen und einander ausschließen (ein Bewohner trägt genau EIN Recht).
const BELEGUNG_VERWENDUNGEN = ["Vermietet", "Verpachtet", "Eigennutzung", "Nießbrauch", "Leerstand"];
const BELEGUNGSTYP_ZU_VERWENDUNG = {
  vermietung: "Vermietet",
  selbstnutzung: "Eigennutzung",
  leerstand: "Leerstand",
};
// Feiner Verwendungsname EINER Belegung — leitet die konkrete Vertrags-/Rechts-
// art aus dem Bewohner-Recht ab (Single Source of Truth = recht am Haushalts-
// mitglied). Mieter→Vermietet, Pächter→Verpachtet, Nießbraucher→Nießbrauch,
// sonstige Bewohner→Eigennutzung, niemand→Leerstand. Mehrere Bewohner: das erste
// „stärkste" Recht gewinnt (Vertragspartei vor Nießbrauch vor übrigen).
function verwendungNameAusBelegung(beleg) {
  if (!beleg) return "Leerstand";
  const hh = beleg.haushalt || { mitglieder: [] };
  const mit = (hh.mitglieder || []).filter(Boolean);
  if (mit.length === 0) {
    // keine Bewohner: Legacy-typ respektieren
    return BELEGUNGSTYP_ZU_VERWENDUNG[beleg.typ] || "Leerstand";
  }
  if (mit.some(m => m.recht === "mieter"))   return "Vermietet";
  if (mit.some(m => m.recht === "paechter")) return "Verpachtet";
  if (mit.some(m => m.recht === "niessbraucher")) return "Nießbrauch";
  return "Eigennutzung";
}
// Leitet die Belegungs-Verwendung(en) einer Einheit aus den Belegungen ihrer
// Teile ab. Bei Unterteilung können mehrere Verwendungen gleichzeitig vorkommen
// (z. B. ein Teil vermietet, einer leer). Liefert eine Liste { name, status:
// "aktiv" }. Leerstand wird nur gemeldet, wenn KEIN Teil belegt ist (sonst wäre
// die ganze Einheit fälschlich „auch leer").
function belegungsVerwendungen(einheit) {
  const teile = teileVon(einheit);
  const namenSet = [];
  teile.forEach(teil => {
    const b = heuteLaufendeBelegung(teil) || aktiveBelegung(teil);
    const name = b ? verwendungNameAusBelegung(b) : "Leerstand";
    if (namenSet.indexOf(name) < 0) namenSet.push(name);
  });
  // Wenn irgendein Teil belegt ist, zählt Leerstand nicht für die Gesamt-Einheit.
  const belegt = namenSet.filter(n => n !== "Leerstand");
  const namen = belegt.length > 0 ? belegt : namenSet;
  return namen.map(name => ({ name, status: "aktiv" }));
}

// ── Selbstnutzung + Belegungszustand je Einheit (rein abgeleitet, Anzeige) ──
// Quelle ist IMMER die laufende Belegung — kein selbstnutzer-Flag (das ist tot).
// Genutzt für: goldener Ring am Eigentümer-Rollen-Badge (Kontakt) + Zustands-
// Chip je Einheit-Kachel in der aufgeklappten Rolle.

// Wohnt der gegebene Kontakt in DIESER Einheit selbst (recht "eigennutzer" in
// der heute laufenden Belegung eines ihrer Teile)? Wir verlangen ausdrücklich
// "eigennutzer" — Nießbraucher/Wohnberechtigte sind Bewohner, aber NICHT der
// selbstnutzende Eigentümer im hier gemeinten Sinn.
function istSelbstnutzerInEinheit(einheit, kontaktId) {
  if (!einheit || kontaktId == null) return false;
  const teile = teileVon(einheit);
  for (let i = 0; i < teile.length; i++) {
    const b = heuteLaufendeBelegung(teile[i]) || aktiveBelegung(teile[i]);
    if (!b) continue;
    const hh = b.haushalt || { mitglieder: [] };
    const mit = (hh.mitglieder || []).filter(Boolean);
    for (let j = 0; j < mit.length; j++) {
      if (mit[j].recht === "eigennutzer"
          && mit[j].kontaktId != null
          && String(mit[j].kontaktId) === String(kontaktId)) {
        return true;
      }
    }
  }
  return false;
}

// Die heute geltende Belegungs-Verwendung EINER Einheit als EIN Name
// ("Vermietet" | "Eigennutzung" | "Leerstand"). Aggregiert über alle Teile via
// belegungsVerwendungen; bei gemischten Teilen gewinnt die erste Nicht-Leer-
// Verwendung (Leerstand wird dort bereits herausgefiltert, sobald ein Teil
// belegt ist). Für den Zustands-Chip je Einheit-Kachel.
function belegungVerwendungEinerEinheit(einheit) {
  const verw = belegungsVerwendungen(einheit);
  if (!verw || verw.length === 0) return "Leerstand";
  return verw[0].name;
}

// Ist IRGENDEINE Einheit dieser gruppierten Rollenkarte vom gegebenen Kontakt
// selbstgenutzt? Steuert den goldenen Ring am Eigentümer-Rollen-Badge — analog
// zu vorsitz/vertrag eine "besondere Stellung", nur über alle Einheiten der
// Karte aggregiert (eine Wohnung selbst bewohnt reicht).
function karteIstSelbstnutzend(karte, ves, kontaktId) {
  if (!karte || kontaktId == null || !Array.isArray(ves)) return false;
  const objekte = karte.objekte || [];
  for (let o = 0; o < objekte.length; o++) {
    const ve = ves.find(v => v && String(v.id) === String(objekte[o].objektId));
    if (!ve) continue;
    const einheiten = objekte[o].einheiten || [];
    for (let e = 0; e < einheiten.length; e++) {
      const einheit = (ve.einheiten || []).find(x => x && x.id === einheiten[e].einheitId);
      if (einheit && istSelbstnutzerInEinheit(einheit, kontaktId)) return true;
    }
  }
  return false;
}

// ── Kontakt-Rollen-Ableitung (zentral) ──────────────────────────────────────
// Quelle der Wahrheit sind die EINHEITEN (Eigentümer/SEV an der Einheit, Mieter/
// Bewohner im Belegungsmodell). Die kontakt.objektZuweisungen sind nur ein
// abgeleiteter Index für Kontakt-Profil/Filter. Diese Funktion leitet für EIN
// Objekt alle einheit-bezogenen Zuweisungen neu ab und liefert eine Map
// kontaktId → [{ objektId, einheitId, rolle, status }]. Phasen → Status:
// aktuell→aktiv, geplant→werdend, beendet→ehemalig.
function belegPhaseZuStatus(phase) {
  if (phase === "geplant") return "werdend";
  if (phase === "beendet") return "ehemalig";
  return "aktiv";
}
function objektZuweisungenAusEinheiten(ve) {
  const map = {}; // kontaktId → Array von Zuweisungen
  if (!ve || !Array.isArray(ve.einheiten)) return map;
  const heute = isoHeute();
  const add = (kontaktId, einheitId, rolle, status) => {
    if (kontaktId == null) return;
    const key = String(kontaktId);
    if (!map[key]) map[key] = [];
    // Duplikate (gleiche einheitId+rolle) vermeiden; besten Status behalten.
    const PRIO = { aktiv: 3, werdend: 2, ehemalig: 1 };
    const vorhanden = map[key].find(z => z.einheitId === einheitId && z.rolle === rolle);
    if (vorhanden) {
      if ((PRIO[status] || 0) > (PRIO[vorhanden.status] || 0)) vorhanden.status = status;
      return;
    }
    map[key].push({ objektId: ve.id, einheitId, rolle, status });
  };
  ve.einheiten.forEach(einheit => {
    if (!einheit) return;
    // Eigentümer (inkl. werdend/ehemalig via eigStatus).
    (einheit.eigentuemer || []).forEach(e => {
      if (!e || e.kontaktId == null) return;
      add(e.kontaktId, einheit.id, "Eigentümer", eigStatus(e));
    });
    // SEV (inkl. werdend/ehemalig via sevStatus).
    (einheit.sev || []).forEach(s => {
      if (!s || s.kontaktId == null) return;
      add(s.kontaktId, einheit.id, "Sondereigentumsverwaltung", sevStatus(s));
    });
    // Mieter/Bewohner über alle Teile + Belegungen + Haushalt. recht==="mieter"
    // → „Mieter", sonst Sammelrolle „Bewohner" (das genaue Recht steht am
    // Mitglied/Belegung-Tab). Status aus belegungsPhase.
    teileVon(einheit).forEach(teil => {
      (teil.belegungen || []).forEach(b => {
        const status = belegPhaseZuStatus(belegungsPhase(b, heute));
        const hh = b.haushalt || { mitglieder: [] };
        (hh.mitglieder || []).forEach(m => {
          if (!m || m.kontaktId == null) return;
          // Jedes Mitglied trägt sein konkretes Recht als Rolle (Mieter, Pächter,
          // Nießbraucher, Wohnberechtigt, Angehöriger, Sonstige). Die frühere
          // Sammelrolle „Bewohner" entfällt — das genaue Recht ist immer bekannt
          // (m.recht) und aussagekräftiger.
          // AUSNAHME (v11.92): „Eigennutzer" ist KEINE Rolle. Das Recht "eigennutzer"
          // erzeugt generell keine Zuweisung/kein Badge — Selbstnutzung zeigt sich nur
          // über goldenen Ring + „selbst bewohnt". Das Recht selbst bleibt am Mitglied.
          if (m.recht === "eigennutzer") return;
          const rolle = bewohnerRecht(m.recht).label;
          add(m.kontaktId, einheit.id, rolle, status);
        });
      });
    });
  });
  return map;
}

// Wendet die abgeleiteten Zuweisungen auf die Kontaktliste an: ersetzt für DIESES
// Objekt alle einheit-bezogenen Zuweisungen (mit einheitId) durch die neu
// abgeleiteten. Objekt-/Firmen-Rollen ohne einheitId (HV, Beirat, Versorger …)
// und alle anderen Objekte bleiben unangetastet. Konsolidiert kontakt.rollen[].
function wendeKontaktZuweisungenAn(kontakte, ve) {
  if (!Array.isArray(kontakte) || !ve) return kontakte;
  const abgeleitet = objektZuweisungenAusEinheiten(ve);
  return kontakte.map(k => {
    if (!k) return k;
    const bisher = Array.isArray(k.objektZuweisungen) ? k.objektZuweisungen : [];
    // Behalte: alles für ANDERE Objekte + Zuweisungen OHNE einheitId (objekt-/
    // firmenbezogen) für DIESES Objekt.
    const behalten = bisher.filter(z =>
      z.objektId !== ve.id || z.einheitId == null);
    const neueFuerObjekt = abgeleitet[String(k.id)] || [];
    const neueZuw = behalten.concat(neueFuerObjekt);
    // rollen[] neu konsolidieren. Einheit-abgeleitete Rollennamen werden komplett
    // aus den Zuweisungen neu bestimmt (über ALLE Objekte, da rollen[] global ist);
    // andere Rollen (HV, Beirat, Versorger …) bleiben erhalten.
    // Einheit-abgeleitete Rollen, die bei jeder Konsolidierung neu aus den
    // Zuweisungen bestimmt werden. „Bewohner" bleibt als Altlast-Putzer gelistet,
    // damit früher gespeicherte „Bewohner"-Einträge beim ersten Laden verschwinden;
    // erzeugt wird die Rolle nicht mehr. Die konkreten Wohn-/Nutzungsrechte stehen
    // hier, damit ein Rechtswechsel (z. B. Nießbraucher → Angehöriger) den alten
    // Eintrag sauber ersetzt statt zu duplizieren.
    const EINHEIT_ROLLEN = { "Eigentümer": 1, "Mieter": 1, "Pächter": 1, "Eigennutzer": 1,
      "Nießbraucher": 1, "Wohnberechtigt": 1, "Angehöriger": 1, "Sonstige": 1,
      "Bewohner": 1, "Sondereigentumsverwaltung": 1 };
    const rollenSet = {};
    // (a) Nicht-einheit-Rollen aus bisherigem rollen[] behalten.
    (Array.isArray(k.rollen) ? k.rollen : []).forEach(r => { if (!EINHEIT_ROLLEN[r]) rollenSet[r] = true; });
    // (b) Einheit-Rollen aus ALLEN aktuellen Zuweisungen (alle Objekte) ableiten.
    neueZuw.forEach(z => { if (z.rolle && z.einheitId != null) rollenSet[z.rolle] = true; });
    // (c) Objekt-/Firmen-Rollen aus Zuweisungen ohne einheitId behalten.
    neueZuw.forEach(z => { if (z.rolle && z.einheitId == null) rollenSet[z.rolle] = true; });

    // NEUE ACHSE synchron halten (besitz/zustaendigkeiten). Avatar und ROLLEN-
    // Liste lesen aus besitz/flacheZuweisungen — diese Achse muss dieselbe
    // Einheit-Ableitung tragen wie objektZuweisungen, sonst driften die Achsen
    // auseinander (rollenlose besitz-Einträge → Objekt sichtbar, Rolle/Badge fehlt).
    // Nur DIESES Objekt + einheit-bezogene Einträge ersetzen; alles andere behalten
    // (objektbezogener Besitz ohne einheitId, andere Objekte, Dienstleister-
    // Zuständigkeiten, Firmen-Gewerke). Gleicher Schutzfilter wie oben.
    const hatNeueAchse = Array.isArray(k.besitz) || Array.isArray(k.zustaendigkeiten) || Array.isArray(k.firmenRollen);
    let zusatz = null;
    if (hatNeueAchse) {
      const besitzBehalten = (Array.isArray(k.besitz) ? k.besitz : [])
        .filter(b => b.objektId !== ve.id || b.einheitId == null);
      const zustBehalten = (Array.isArray(k.zustaendigkeiten) ? k.zustaendigkeiten : [])
        .filter(z => {
          const ziel = z.ziel || {};
          return ziel.objektId !== ve.id || ziel.einheitId == null;
        });
      const besitzNeu = [], zustNeu = [];
      neueFuerObjekt.forEach(z => {
        if (z.einheitId == null) return; // objekt-/firmenbezogen separat behandelt
        const c = klassifiziereZuweisung(z, k.typ);
        if (!c) return;
        if (c.kat === "besitz") besitzNeu.push(c.eintrag);
        else if (c.kat === "zustaendigkeit") zustNeu.push(c.eintrag);
      });
      zusatz = {
        besitz: besitzBehalten.concat(besitzNeu),
        zustaendigkeiten: zustBehalten.concat(zustNeu),
      };
    }

    return { ...k, objektZuweisungen: neueZuw, rollen: Object.keys(rollenSet),
      ...(zusatz || {}) };
  });
}

// Wendet die Rollen-Ableitung über ALLE Objekte an. Aufruf beim Import, damit
// Eigentümer/SEV/Mieter/Bewohner sofort in objektZuweisungen + rollen[] stehen,
// OHNE dass die Importdatei diese Felder vorberechnen muss (schlankes Modell:
// besitz + Belegungen reichen). Idempotent: jeder Objekt-Durchlauf ersetzt nur
// die einheit-bezogenen Zuweisungen FÜR DIESES Objekt und lässt die anderen
// Objekte unangetastet — sequentielles Anwenden baut das Gesamtbild korrekt auf.
function wendeKontaktZuweisungenAnAlle(kontakte, ves) {
  if (!Array.isArray(kontakte) || !Array.isArray(ves)) return kontakte;
  return ves.reduce((acc, ve) => wendeKontaktZuweisungenAn(acc, ve), kontakte);
}

// Läuft aktuell eine Vermietung? (steuert Sichtbarkeit der Mietgeschichte)
function istVermietet(einheit) {
  return belegungsTyp(einheit) === "vermietung";
}

// Benannte Haushaltsmitglieder MIT Kontakt — diese sind informierbar.
function bewohnerMitKontakt(einheit) {
  const hh = aktiverHaushalt(einheit);
  return (hh.mitglieder || []).filter(m => m && m.kontaktId != null);
}


// Verwendungen einer Einheit als LISTE [{name, status}], rückwärtskompatibel:
// liest das neue Feld einheit.verwendungen ODER das Legacy-Einzelfeld
// einheit.verwendung. So kann eine Einheit mehrere Verwendungen tragen
// (z. B. „Vermietet" + „Sondereigentumsverwaltung").
//
// WICHTIG: Die drei Belegungs-Verwendungen (Vermietet/Eigennutzung/Leerstand)
// werden NICHT mehr aus dem gespeicherten Feld gelesen, sondern LIVE aus der
// Belegung abgeleitet (Quelle der Wahrheit = Belegung-Tab). Gespeicherte
// Belegungs-Verwendungen (Altbestand) werden ignoriert und durch die abgeleiteten
// ersetzt. So bleiben Einheit-Anzeige, Avatar-Badge und Objekt-Aggregat
// automatisch konsistent, ohne dass etwas doppelt gepflegt wird.
function verwendungenVon(einheit) {
  if (!einheit) return [];
  let gespeichert = [];
  if (Array.isArray(einheit.verwendungen)) gespeichert = einheit.verwendungen.filter(Boolean);
  else if (einheit.verwendung && einheit.verwendung.name) gespeichert = [einheit.verwendung];
  // Freie (rechtliche) Verwendungen behalten; Belegungs-Verwendungen verwerfen.
  const frei = gespeichert.filter(v => v && BELEGUNG_VERWENDUNGEN.indexOf(v.name) < 0);
  // Belegungs-Verwendungen live ableiten.
  const abgeleitet = belegungsVerwendungen(einheit);
  return [...abgeleitet, ...frei];
}

// ─────────────────────────────────────────────────────────────────────────────
// NORMALISIERUNG — hebt eine Einheit idempotent auf das Schichtmodell.
// Wendet Variante A an: jede Einheit bekommt mindestens einen Teil mit genau
// einer laufenden Belegung. Vorhandene Legacy-Felder (mieter[], selbstnutzer,
// verwendung) werden in eine passende Belegung + Haushalt überführt, OHNE die
// Legacy-Felder zu löschen (sanfte, rückwärtskompatible Anreicherung).
// Eigentümer bleibt an der Einheit und wird NICHT in den Haushalt verschoben;
// ein selbstnutzender Eigentümer wird zusätzlich als Haushaltsmitglied gespiegelt.
// Migriert das alte rechtsstatus-Feld (SE/GE/SNR) auf das neue spStellung-Schema.
// Sichere Variante: alle Alt-Stellplätze → "eigenstaendig" (kein verwaister
// spEinheitId-Verweis). Zuordnung wird bei Bedarf manuell nachgepflegt.
// Idempotent: Einheiten mit gesetztem spStellung bleiben unverändert; das alte
// rechtsstatus-Feld wird nach der Migration entfernt.
function migriereSpStellung(einheit) {
  if (!einheit || typeof einheit !== "object") return einheit;
  if (einheit.spStellung) {
    if ("rechtsstatus" in einheit) {
      const kopie = { ...einheit };
      delete kopie.rechtsstatus;
      return kopie;
    }
    return einheit;
  }
  if (!("rechtsstatus" in einheit)) return einheit;
  const kopie = { ...einheit, spStellung: "eigenstaendig" };
  delete kopie.rechtsstatus;
  return kopie;
}

// Heilt verwaiste SEV-Verwendungen: Die Verwendung „Sondereigentumsverwaltung"
// darf nur existieren, wenn auch ein aktiver/werdender sev-Eintrag vorhanden ist.
// Altbestände/Seeds, die nur das Badge ohne sev-Firma trugen, werden bereinigt.
// Idempotent.
function heileSevVerwendung(einheit) {
  if (!einheit || typeof einheit !== "object") return einheit;
  const SEV = "Sondereigentumsverwaltung";
  const hatSev = Array.isArray(einheit.sev)
    && einheit.sev.some(s => { const st = sevStatus(s); return st === "aktiv" || st === "werdend"; });
  if (hatSev) return einheit;
  const liste = Array.isArray(einheit.verwendungen) ? einheit.verwendungen : null;
  const einzel = (einheit.verwendung && einheit.verwendung.name === SEV);
  const inListe = liste && liste.some(v => v && v.name === SEV);
  if (!einzel && !inListe) return einheit;
  const kopie = { ...einheit };
  if (liste) kopie.verwendungen = liste.filter(v => !(v && v.name === SEV));
  if (einzel) {
    kopie.verwendung = (kopie.verwendungen && kopie.verwendungen.length > 0)
      ? kopie.verwendungen[0] : null;
  }
  return kopie;
}

function normalisiereEinheit(einheit) {
  if (!einheit || typeof einheit !== "object") return einheit;
  einheit = migriereSpStellung(einheit);
  einheit = ergaenzeSevFeld(einheit);
  einheit = heileSevVerwendung(einheit);
  // Bereits normalisiert? (besitzt einen Teil mit Belegungen) → unverändert lassen.
  if (Array.isArray(einheit.teile) && einheit.teile.length > 0
      && einheit.teile[0] && Array.isArray(einheit.teile[0].belegungen)
      && einheit.teile[0].belegungen.length > 0) {
    return einheit;
  }

  const legacyMieter = Array.isArray(einheit.mieter) ? einheit.mieter : [];
  const aktiverEig = (Array.isArray(einheit.eigentuemer) ? einheit.eigentuemer : []).find(e => !e.bis) || null;
  const selbstnutzer = !!(aktiverEig && aktiverEig.selbstnutzer);
  const aktiverMieterLegacy = legacyMieter.find(m => !m.bis) || null;

  // Belegungstyp aus Legacy ableiten.
  let typ = "leerstand";
  if (aktiverMieterLegacy) typ = "vermietung";
  else if (selbstnutzer)   typ = "selbstnutzung";

  const beleg = neueBelegung(typ, (aktiverMieterLegacy && aktiverMieterLegacy.von) || (aktiverEig && aktiverEig.von) || "");

  // Haushalt füllen.
  if (typ === "vermietung" && aktiverMieterLegacy) {
    beleg.vertragsparteiId = aktiverMieterLegacy.kontaktId != null ? aktiverMieterLegacy.kontaktId : null;
    beleg.haushalt.mitglieder.push(neuesHhMitglied(
      aktiverMieterLegacy.kontaktId, aktiverMieterLegacy.name || "", "mieter"));
  } else if (typ === "selbstnutzung" && aktiverEig) {
    beleg.haushalt.mitglieder.push(neuesHhMitglied(
      aktiverEig.kontaktId, aktiverEig.name || "", "eigennutzer"));
  }

  // Teil über die Fabrik erzeugen (volle Felder: flaeche/zimmer/lage/raeume …),
  // dann die abgeleitete Belegung einsetzen.
  const teil = { ...neuerTeil(""), belegungen: [ beleg ] };
  // Rückgabe als neues Objekt (mutationsfrei für React-State).
  return { ...einheit, teile: [ teil ] };
}

// Hebt bereits normalisierte Einheiten zusätzlich auf Weg 2: vorhandene
// Haushaltsmitglieder ohne recht bekommen eines abgeleitet (aus beleg.typ).
// Idempotent — Mitglieder mit recht bleiben unangetastet.
function ergaenzeBewohnerRechte(einheit) {
  if (!einheit || !Array.isArray(einheit.teile)) return einheit;
  let geaendert = false;
  const teile = einheit.teile.map(teil => {
    if (!teil || !Array.isArray(teil.belegungen)) return teil;
    const belegungen = teil.belegungen.map(b => {
      if (!b || !b.haushalt) return b;
      const hh = b.haushalt;
      const standard = b.typ === "vermietung" ? "mieter"
        : (b.typ === "selbstnutzung" ? "eigennutzer" : "mieter");
      let mitglieder = Array.isArray(hh.mitglieder) ? hh.mitglieder : [];
      let lokalGeaendert = false;

      // (a) Fehlende Rechtsgrundlage ergänzen.
      if (!mitglieder.every(m => m && m.recht)) {
        mitglieder = mitglieder.map(m => (m && m.recht) ? m : { ...m, recht: standard });
        lokalGeaendert = true;
      }
      // (b) Fehlende anzahl ergänzen (Default 1).
      if (!mitglieder.every(m => m && typeof m.anzahl === "number")) {
        mitglieder = mitglieder.map(m =>
          (m && typeof m.anzahl === "number") ? m : { ...m, anzahl: 1 });
        lokalGeaendert = true;
      }
      // (c) Alte anonym-Kopfzahl → ein anonymes Mitglied mit anzahl.
      const altAnonym = Number(hh.anonym) || 0;
      if (altAnonym > 0) {
        mitglieder = [...mitglieder, neuesHhMitglied(null, "", standard, altAnonym)];
        lokalGeaendert = true;
      }

      if (!lokalGeaendert && !("anonym" in hh)) return b;
      geaendert = true;
      const neuHh = { ...hh, mitglieder };
      delete neuHh.anonym; // Feld endgültig entfernen
      return { ...b, haushalt: neuHh };
    });
    return { ...teil, belegungen };
  });
  return geaendert ? { ...einheit, teile } : einheit;
}

// Normalisiert eine komplette VE-Liste (alle Einheiten aller Objekte).
function normalisiereVes(ves) {
  if (!Array.isArray(ves)) return ves;
  return ves.map(ve => {
    if (!ve || !Array.isArray(ve.einheiten)) return ve;
    return { ...ve, einheiten: ve.einheiten.map(e =>
      ergaenzeBewohnerRechte(normalisiereEinheit(e))) };
  });
}

// ═════════════════════════════════════════════════════════════════════════════
// BEZIEHUNG & BEFUGNIS  (Umbau-Spec §4 · zwei unabhängige Achsen, Variante I)
// ─────────────────────────────────────────────────────────────────────────────
// Statt „Bevollmächtigter/Betreuer" als Rolle gibt es zwei eigenständige,
// unabhängig pflegbare Achsen an EINER Verknüpfung zwischen zwei Kontakten:
//
//   verknuepfung = {
//     id, zielKontaktId,                 ← auf wen zeigt die Verknüpfung
//     beziehung: { typ } | null,         ← sozial/faktisch ("Ehefrau", "Steuerberater")
//     befugnis:  { art } | null,         ← rechtlich ("vollmacht" | "betreuung")
//     status: "aktiv" | "ehemalig",
//   }
//
// Beide Achsen sind optional und einzeln schaltbar: Ehefrau MIT Vollmacht = eine
// Verknüpfung mit beiden gesetzt; endet die Vollmacht, bleibt die Beziehung
// (befugnis=null, beziehung bleibt). Berufsbetreuer = nur befugnis, keine beziehung.
//
// Die Achsen liegen am VERKNÜPFENDEN Kontakt (z. B. an der Ehefrau, die zum
// Eigentümer „verheiratet" ist und für ihn „Vollmacht" hat) — also die Person,
// die die Beziehung/Befugnis AUSÜBT. zielKontaktId = die Person, auf die sie
// sich bezieht. Avatar-Badge schaut auf die BEFUGNIS (nicht mehr auf Rollennamen).
// ─────────────────────────────────────────────────────────────────────────────

const BEFUGNIS_ARTEN = ["vollmacht", "betreuung"];


let _verknId = 1;
const neueVerknId = () => "vk-" + (_verknId++);

function neueVerknuepfung(zielKontaktId, opts) {
  const o = opts || {};
  return {
    id: neueVerknId(),
    zielKontaktId: zielKontaktId != null ? zielKontaktId : null,
    beziehung: o.beziehungTyp ? { typ: o.beziehungTyp } : null,
    befugnis:  o.befugnisArt && BEFUGNIS_ARTEN.indexOf(o.befugnisArt) >= 0 ? { art: o.befugnisArt } : null,
    status: o.status || "aktiv",
  };
}

// Alle Verknüpfungen eines Kontakts (ausgehend) — neues Feld, sonst [].
function verknuepfungenVon(k) {
  return (k && Array.isArray(k.verknuepfungen)) ? k.verknuepfungen : [];
}

// Ausgehende BEFUGNISSE eines Kontakts: „für wen darf dieser Kontakt entscheiden".
// Liest die neue Achse UND (Legacy-Fallback) die alten zielKontaktId-Zuständig-
// keiten mit Rolle Bevollmächtigter/Betreuer. Rückgabe: [{ zielKontaktId, art, status }].
function ausgehendeBefugnisse(k) {
  const out = [];
  const gesehen = new Set();
  const push = (zielKontaktId, art, status) => {
    const key = String(zielKontaktId) + "|" + art;
    if (gesehen.has(key)) return;
    gesehen.add(key);
    out.push({ zielKontaktId, art, status: status || "aktiv" });
  };
  verknuepfungenVon(k).forEach(v => {
    if (v && v.befugnis && v.befugnis.art) push(v.zielKontaktId, v.befugnis.art, v.status);
  });
  // Legacy: zustaendigkeiten mit ziel.art="kontakt" + Rolle Bevollmächtigter/Betreuer
  (k && Array.isArray(k.zustaendigkeiten) ? k.zustaendigkeiten : []).forEach(z => {
    const ziel = z.ziel || {};
    if (ziel.art === "kontakt" && ziel.kontaktId != null) {
      const r = z.leistung || "";
      const art = r === "Betreuer" ? "betreuung" : (r === "Bevollmächtigter" ? "vollmacht" : null);
      if (art) push(ziel.kontaktId, art, z.status);
    }
  });
  return out;
}




// Idempotente Normalisierung eines Kontakts: spiegelt Legacy-Befugnis-
// Zuständigkeiten in die neue verknuepfungen-Achse, OHNE die Legacy-Felder zu
// löschen (rückwärtskompatibel). Mehrfach-Aufruf erzeugt keine Duplikate.
function normalisiereKontakt(k) {
  if (!k || typeof k !== "object") return k;
  const vorhanden = verknuepfungenVon(k);
  // Bereits vorhandene (ziel+art)-Paare merken, um Duplikate zu vermeiden.
  const gesehen = new Set(vorhanden
    .filter(v => v && v.befugnis && v.befugnis.art)
    .map(v => String(v.zielKontaktId) + "|" + v.befugnis.art));
  const ausLegacy = [];
  (Array.isArray(k.zustaendigkeiten) ? k.zustaendigkeiten : []).forEach(z => {
    const ziel = z.ziel || {};
    if (ziel.art === "kontakt" && ziel.kontaktId != null) {
      const r = z.leistung || "";
      const art = r === "Betreuer" ? "betreuung" : (r === "Bevollmächtigter" ? "vollmacht" : null);
      if (art) {
        const key = String(ziel.kontaktId) + "|" + art;
        if (!gesehen.has(key)) {
          gesehen.add(key);
          ausLegacy.push(neueVerknuepfung(ziel.kontaktId, { befugnisArt: art, status: z.status || "aktiv" }));
        }
      }
    }
  });
  if (ausLegacy.length === 0 && Array.isArray(k.verknuepfungen)) return k;
  return { ...k, verknuepfungen: [...vorhanden, ...ausLegacy] };
}

function normalisiereKontakte(kontakte) {
  if (!Array.isArray(kontakte)) return kontakte;
  return kontakte.map(normalisiereKontakt);
}

// ╔═════════════════════════════════════════════════════════════════════════╗

// ── eigStatus-Trio (fachlich Datenmodell, vormals S5) ──────────────────────
//   · von           — Stufe 3: Grundbuch-Umschreibung (Eigentum + Stimmrecht)
//   · bis           — Verkäufer: Eigentum endet (= von der Käuferstufe 3)
// grundbuch:true erst ab Stufe 3. selbstnutzer bleibt unverändert.
const EIG_STATUS = {
  interessent: { label: "Kaufabsicht",   farbe: "#3B82F6" }, // info
  werdend:     { label: "in Übernahme",  farbe: "#3B82F6" }, // info (Lasten übergegangen)
  aktiv:       { label: "aktuell",       farbe: null },       // null → Akzentfarbe der Karte
  ehemalig:    { label: "ehemalig",      farbe: null },       // null → t.muted
};
// Status eines Eigentümer-Eintrags ableiten (rückwärtskompatibel + datums-
// gesteuert): Sind die Vorgangs-Daten (kaufabsichtAb/kostenAb/von) gesetzt, wird
// der Status anhand des heutigen Datums abgeleitet — ein für die Zukunft
// eingetragenes Grundbuch-/Lastendatum springt erst am Stichtag. Ohne diese
// Datumsfelder gilt das explizite status-Feld bzw. der bis/grundbuch-Fallback.
function eigStatus(p) {
  if (!p) return "aktiv";
  // Beendeter Eigentümer (Verkäufer nach Grundbuch) — bis erreicht?
  if (p.bis && p.bis !== "—" && zuIsoDatum(p.bis) <= isoHeute()) return "ehemalig";
  // Käufer im Vorgang: Status aus den erreichten Datums-Meilensteinen.
  const heute = isoHeute();
  const erreicht = (d) => !!d && zuIsoDatum(d) <= heute;
  if (p.kaufabsichtAb != null || p.kostenAb != null || (p.status === "interessent" || p.status === "werdend")) {
    if (erreicht(p.von)) return "aktiv";       // Grundbuch wirksam → aktiver Eigentümer
    if (erreicht(p.kostenAb)) return "werdend"; // Lasten übergegangen
    return "interessent";                        // Kaufabsicht
  }
  if (p.status && EIG_STATUS[p.status]) return p.status;
  if (p.bis && p.bis !== "—" && zuIsoDatum(p.bis) <= heute) return "ehemalig";
  return "aktiv"; // Altdaten / Verkäufer mit künftigem bis: noch aktiv
}
// Läuft an dieser Einheit gerade ein Eigentümerwechsel? (mind. ein werdender/
// interessierter Eintrag). Steuert die Sichtbarkeit der Vorgangs-Karte.
function laufenderEigWechsel(eig) {
  return (eig || []).some(p => { const s = eigStatus(p); return s === "interessent" || s === "werdend"; });
}

// ── Dubletten-Match-Schicht ─────────────────────────────────────────────────
// Gemeinsames Fundament für: (a) Dublettenwarnung im KontaktPicker beim
// Anlegen, (b) Dubletten-Aufräumen unter Einstellungen, (c) später Import &
// E-Mail-Absender-Matching (Konzepte_AllesDa.md Teil A). Rein funktional und
// ohne Seiteneffekt — über den CJS-Stack unit-testbar.
//
// Drei Schlüssel, absteigende Trennschärfe:
//   E-Mail (hart) > Telefon (hart) > normalisierter Name (weich = nur Verdacht).
// Es gibt KEINEN Auto-Merge im Code; diese Helfer liefern nur Kandidaten/
// Gruppen. Über das tatsächliche Zusammenführen entscheidet immer der Nutzer.

const _RECHTSFORM_SUFFIXE = [
  "gmbhundcokg", "gmbhcokg", "gmbh", "ohg", "kg", "ag",
  "ek", "gbr", "ug", "ughaftungsbeschraenkt", "ev", "se", "kgaa", "partg"
];

// E-Mail normalisieren: trim + lowercase. Leer -> "".
function normalisiereEmail(e) {
  return ((e || "") + "").trim().toLowerCase();
}

// Telefon normalisieren: nur Ziffern. "+49 (0)89 / 123-45" -> "4908912345".
// Leer/ohne Ziffern -> "".
function normalisiereTelefon(t) {
  return ((t || "") + "").replace(/[^0-9]/g, "");
}

// Firmen-/Kontaktname normalisieren: lowercase, Umlaute ent-mappt,
// Satzzeichen/Whitespace raus, Rechtsform-Suffix abgeschnitten.
// "WEG-Verwaltung Mitte GmbH" -> "wegverwaltungmitte".
// So matchen "Müller GmbH", "Mueller G.m.b.H." und "Müller" auf denselben Kern.
function normalisiereFirmenname(name) {
  let s = ((name || "") + "").trim().toLowerCase();
  s = s.replace(/ä/g, "ae").replace(/ö/g, "oe").replace(/ü/g, "ue").replace(/ß/g, "ss");
  s = s.replace(/[^a-z0-9]/g, ""); // alles außer Buchstaben/Ziffern weg
  for (const rf of _RECHTSFORM_SUFFIXE.slice().sort((a, b) => b.length - a.length)) {
    if (s.length > rf.length && s.endsWith(rf)) {
      return s.slice(0, -rf.length);
    }
  }
  return s;
}

// Anzeigename eines Kontakts (Person ODER Firma) für den Namens-Match.
function _kontaktAnzeigename(k) {
  if (!k) return "";
  if (k.typ === "firma") return k.name || "";
  if (k.name) return k.name;
  return [k.vorname, k.nachname].filter(Boolean).join(" ");
}

// Alle E-Mail-Werte eines Kontakts (Firma: einzelnes email; Person: emails[]).
function _kontaktEmails(k) {
  if (!k) return [];
  const out = [];
  if (k.email) out.push(normalisiereEmail(k.email));
  (k.emails || []).forEach(e => {
    const v = normalisiereEmail(typeof e === "string" ? e : (e && e.email));
    if (v) out.push(v);
  });
  return out.filter(Boolean);
}

// Alle Telefon-Werte eines Kontakts (Firma: tel; Person: tels[]).
function _kontaktTelefone(k) {
  if (!k) return [];
  const out = [];
  if (k.tel) out.push(normalisiereTelefon(k.tel));
  (k.tels || []).forEach(t => {
    const v = normalisiereTelefon(typeof t === "string" ? t : (t && t.nr));
    if (v) out.push(v);
  });
  return out.filter(v => v && v.length >= 4); // sehr kurze "Nummern" ignorieren
}

// findeKontaktKandidaten(neu, bestand, opts) -> Liste von Treffern, sortiert
// nach Trennschärfe. Jeder Treffer: { kontakt, grund: "email"|"telefon"|"name",
// sicher: bool }. "neu" ist ein (auch unvollständiger) Kontakt-Entwurf
// { typ, name, email, tel, ... }. Self-Match wird über opts.ignoriereId
// ausgeschlossen (beim Bearbeiten eines bestehenden Kontakts).
function findeKontaktKandidaten(neu, bestand, opts) {
  const o = opts || {};
  const ignId = o.ignoriereId;
  const nurTyp = o.nurTyp || (neu && neu.typ) || null; // i.d.R. auf "firma" eingrenzen
  const nEmails = new Set(_kontaktEmails(neu));
  const nTels = new Set(_kontaktTelefone(neu));
  const nName = normalisiereFirmenname(_kontaktAnzeigename(neu));
  const treffer = [];
  (bestand || []).forEach(k => {
    if (!k || k.id === ignId) return;
    if (nurTyp && k.typ !== nurTyp) return;
    let grund = null, sicher = false;
    if (nEmails.size) {
      const ke = _kontaktEmails(k);
      if (ke.some(e => nEmails.has(e))) { grund = "email"; sicher = true; }
    }
    if (!grund && nTels.size) {
      const kt = _kontaktTelefone(k);
      if (kt.some(t => nTels.has(t))) { grund = "telefon"; sicher = true; }
    }
    if (!grund && nName) {
      if (normalisiereFirmenname(_kontaktAnzeigename(k)) === nName) { grund = "name"; sicher = false; }
    }
    if (grund) treffer.push({ kontakt: k, grund, sicher });
  });
  const rang = { email: 0, telefon: 1, name: 2 };
  treffer.sort((a, b) => rang[a.grund] - rang[b.grund]);
  return treffer;
}

// gruppiereDubletten(kontakte, opts) -> [{ kern, grund, kontakte: [...] }]
// Findet zusammengehörige Kontakte über E-Mail/Telefon/Name. Für die
// Aufräum-Übersicht. opts.nurTyp grenzt auf z.B. "firma" ein. Verbindet
// transitiv: A~B (E-Mail) und B~C (Name) landen in EINER Gruppe.
function gruppiereDubletten(kontakte, opts) {
  const o = opts || {};
  const nurTyp = o.nurTyp || null;
  const liste = (kontakte || []).filter(k => k && (!nurTyp || k.typ === nurTyp));
  // Union-Find über Index
  const parent = liste.map((_, i) => i);
  const find = (x) => { while (parent[x] !== x) { parent[x] = parent[parent[x]]; x = parent[x]; } return x; };
  const union = (a, b) => { const ra = find(a), rb = find(b); if (ra !== rb) parent[ra] = rb; };
  // Index-Maps für harte Schlüssel
  const byEmail = new Map(), byTel = new Map(), byName = new Map();
  const grundRang = {}; // root-index -> bester (=härtester) Grund
  liste.forEach((k, i) => {
    _kontaktEmails(k).forEach(e => {
      if (byEmail.has(e)) { union(i, byEmail.get(e)); _setGrund(grundRang, find(i), "email"); }
      else byEmail.set(e, i);
    });
    _kontaktTelefone(k).forEach(t => {
      if (byTel.has(t)) { union(i, byTel.get(t)); _setGrund(grundRang, find(i), "telefon"); }
      else byTel.set(t, i);
    });
    const nm = normalisiereFirmenname(_kontaktAnzeigename(k));
    if (nm) {
      if (byName.has(nm)) { union(i, byName.get(nm)); _setGrund(grundRang, find(i), "name"); }
      else byName.set(nm, i);
    }
  });
  // Gruppen einsammeln
  const gruppen = new Map();
  liste.forEach((k, i) => {
    const r = find(i);
    if (!gruppen.has(r)) gruppen.set(r, []);
    gruppen.get(r).push(k);
  });
  const out = [];
  gruppen.forEach((mitglieder, r) => {
    if (mitglieder.length < 2) return; // nur echte Dubletten
    out.push({
      kern: normalisiereFirmenname(_kontaktAnzeigename(mitglieder[0])),
      grund: grundRang[r] || "name",
      kontakte: mitglieder,
    });
  });
  return out;
}
function _setGrund(map, root, grund) {
  const rang = { email: 0, telefon: 1, name: 2 };
  if (!map[root] || rang[grund] < rang[map[root]]) map[root] = grund;
}

// Vollständigkeits-Score eines Kontakts — für die Master-Wahl beim Merge.
function _vollstaendigkeit(k) {
  let s = 0;
  ["tel", "email", "strasse", "plz", "ort", "homepage", "rechtsform", "sub"].forEach(f => {
    if ((k[f] || "").toString().trim()) s++;
  });
  ["zustaendigkeiten", "besitz", "ansprechpartner", "gewerke", "firmenRollen",
   "objektZuweisungen", "tels", "emails"].forEach(f => {
    if (Array.isArray(k[f])) s += k[f].length;
  });
  return s;
}

function _dedupListe(items) {
  const seen = new Set(); const out = [];
  (items || []).forEach(it => {
    const sig = (it && typeof it === "object") ? JSON.stringify(it) : String(it);
    if (!seen.has(sig)) { seen.add(sig); out.push(it); }
  });
  return out;
}

// fuehreKontakteZusammen(daten, gruppe, opts) — führt EINE Dublettengruppe
// zusammen. daten = { kontakte, ves }. gruppe = Array von Kontakt-Objekten
// (aus gruppiereDubletten). Liefert NEUE { kontakte, ves } (kein Mutieren der
// Eingabe) plus einen Bericht. Master = vollständigster, sonst kleinste ID,
// sofern opts.masterId nicht explizit gesetzt ist.
//
// Kritisch: ALLE ID-Verweise im gesamten Baum (kontaktId/firmaId/partnerId/
// ansprechpartnerId/zielKontaktId/vertragsparteiId/beteiligterId) werden von
// den Dublette-IDs auf die Master-ID umgebogen — sonst zeigen SEV-Einträge
// oder Verträge nach dem Löschen ins Leere.
function fuehreKontakteZusammen(daten, gruppe, opts) {
  const o = opts || {};
  const tief = JSON.parse(JSON.stringify({ kontakte: daten.kontakte || [], ves: daten.ves || [] }));
  const idsInGruppe = new Set(gruppe.map(g => g.id));
  // Master bestimmen
  let masterId = o.masterId;
  if (masterId == null) {
    const sortiert = gruppe.slice().sort((a, b) =>
      (_vollstaendigkeit(b) - _vollstaendigkeit(a)) || (a.id - b.id));
    masterId = sortiert[0].id;
  }
  const master = tief.kontakte.find(k => k.id === masterId);
  if (!master) return { kontakte: tief.kontakte, ves: tief.ves, bericht: { fehler: "Master nicht gefunden" } };
  const dublIds = new Set([...idsInGruppe].filter(id => id !== masterId));
  const konflikte = [];

  // Listen vereinen + Skalare auffüllen
  tief.kontakte.forEach(k => {
    if (!dublIds.has(k.id)) return;
    ["zustaendigkeiten", "besitz", "ansprechpartner", "gewerke", "firmenRollen",
     "objektZuweisungen", "tels", "emails"].forEach(lf => {
      if (Array.isArray(k[lf]) && k[lf].length) {
        master[lf] = (Array.isArray(master[lf]) ? master[lf] : []).concat(k[lf]);
      }
    });
    ["tel", "email", "strasse", "plz", "ort", "homepage", "rechtsform", "sub"].forEach(sf => {
      const mv = (master[sf] || "").toString().trim();
      const fv = (k[sf] || "").toString().trim();
      if (!mv && fv) master[sf] = k[sf];
      else if (mv && fv && mv.toLowerCase() !== fv.toLowerCase()) {
        konflikte.push({ feld: sf, master: mv, dublette: fv, dubletteId: k.id });
      }
    });
  });
  ["zustaendigkeiten", "besitz", "ansprechpartner", "gewerke", "firmenRollen",
   "objektZuweisungen", "tels", "emails"].forEach(lf => {
    if (Array.isArray(master[lf])) master[lf] = _dedupListe(master[lf]);
  });

  // Verweise umbiegen (gesamter Baum)
  const VERWEIS_KEYS = new Set(["kontaktId", "firmaId", "partnerId", "ansprechpartnerId",
    "zielKontaktId", "vertragsparteiId", "beteiligterId"]);
  let umgehaengt = 0;
  const umbiegen = (node) => {
    if (Array.isArray(node)) { node.forEach(umbiegen); return; }
    if (node && typeof node === "object") {
      Object.keys(node).forEach(key => {
        const val = node[key];
        if (VERWEIS_KEYS.has(key) && dublIds.has(val)) { node[key] = masterId; umgehaengt++; }
        else umbiegen(val);
      });
    }
  };
  umbiegen(tief.kontakte);
  umbiegen(tief.ves);

  // Dubletten entfernen
  const kontakteNeu = tief.kontakte.filter(k => !dublIds.has(k.id));
  return {
    kontakte: kontakteNeu, ves: tief.ves,
    bericht: { masterId, entfernt: [...dublIds], umgehaengt, konflikte },
  };
}

// ── Rollenkarten-Gruppierung ────────────────────────────────────────────────
// Verschmilzt die frühere "Rollen"- und "Objekte"-Sektion der Kontakt-
// Detailkarte zu EINER hierarchischen Liste: Rolle+Status → Objekte →
// Einheiten. Eingabe sind die flachen Zeilen aus flacheZuweisungen() +
// belegungsRollenFuerKontakt() (Felder: rolle, status, objektId, einheitId,
// zielKontaktId?, firmaId?, vorsitz?, _quelle, _readonly?). rollenDefs ist die
// Liste aller Rollen-Definitionen (settings.rollen + firmenRollen + leistungen
// zusammengeführt), aus der der `slot` je Rolle gelesen wird.
//
// Slot bestimmt Bucket UND Darstellungstyp:
//   gremium → objektweit (Objekt-Rahmen, KEINE Einheit)
//   sev     → kontaktbezogen (Ziel-Kontakt, kein Objekt/Einheit)
//   firma   → Anstellung (Firma als Ziel)
//   ve      → einheitsbezogen (Objekt → Einheiten)
//
// Sortierung: 1) Bucket-Reihenfolge gremium→sev→firma→ve.
//             2) innerhalb Bucket: aktiv vor werdend/ehemalig.
//             3) stabil nach Rollenname.
// Rückgabe: [{ rolle, status, slot, vorsitz, zielKontaktId?, firmaId?,
//              objekte: [{ objektId, einheiten: [{ einheitId, _quelle, _readonly }] }] }]

const ROLLEN_BUCKET_ORDER = ["gremium", "sev", "firma", "ve"];
const ROLLEN_STATUS_ORDER = { aktiv: 0, werdend: 1, ehemalig: 2 };

function _slotFuerRolle(rolleName, rollenDefs) {
  const def = (rollenDefs || []).find(r => r && r.name === rolleName);
  return (def && def.slot) || "ve"; // Default: einheitsbezogen
}

function gruppiereRollenkarten(zuweisungen, rollenDefs) {
  const zeilen = (zuweisungen || []).filter(z => z && z.rolle);
  // 1. Nach Rolle+Status+Vorsitz gruppieren (= ein Rahmen).
  //    Vorsitz trennt, weil "Verwaltungsbeirat (Vorsitz)" ein eigener Rahmen ist.
  const karten = new Map();
  zeilen.forEach(z => {
    const status = z.status || "aktiv";
    const slot = _slotFuerRolle(z.rolle, rollenDefs);
    const key = z.rolle + "|" + status + "|" + (z.vorsitz ? "V" : "") +
                "|" + (z.zielKontaktId != null ? "z" + z.zielKontaktId : "") +
                "|" + (z.firmaId != null ? "f" + z.firmaId : "");
    if (!karten.has(key)) {
      karten.set(key, { rolle: z.rolle, status, slot,
        vorsitz: !!z.vorsitz,
        zielKontaktId: z.zielKontaktId != null ? z.zielKontaktId : null,
        firmaId: z.firmaId != null ? z.firmaId : null,
        objekte: new Map() });
    }
    const karte = karten.get(key);
    // Objekt-Ebene (nur wenn objektId vorhanden — gremium/ve haben sie, sev/firma nicht)
    if (z.objektId) {
      if (!karte.objekte.has(z.objektId)) karte.objekte.set(z.objektId, new Map());
      const einheiten = karte.objekte.get(z.objektId);
      // Einheit-Ebene (nur ve-Slot trägt einheitId; gremium nicht)
      if (z.einheitId) {
        if (!einheiten.has(z.einheitId)) {
          einheiten.set(z.einheitId, { einheitId: z.einheitId,
            _quelle: z._quelle, _readonly: !!z._readonly });
        }
      }
    }
  });
  // 2. Maps → Arrays
  const liste = [];
  karten.forEach(k => {
    const objekte = [];
    k.objekte.forEach((einheitenMap, objektId) => {
      const einheiten = [];
      einheitenMap.forEach(e => einheiten.push(e));
      objekte.push({ objektId, einheiten });
    });
    liste.push({ rolle: k.rolle, status: k.status, slot: k.slot,
      vorsitz: k.vorsitz, zielKontaktId: k.zielKontaktId, firmaId: k.firmaId,
      objekte });
  });
  // 3. Sortierung
  liste.sort((a, b) => {
    const ba = ROLLEN_BUCKET_ORDER.indexOf(a.slot);
    const bb = ROLLEN_BUCKET_ORDER.indexOf(b.slot);
    if (ba !== bb) return (ba < 0 ? 99 : ba) - (bb < 0 ? 99 : bb);
    const sa = ROLLEN_STATUS_ORDER[a.status] != null ? ROLLEN_STATUS_ORDER[a.status] : 9;
    const sb = ROLLEN_STATUS_ORDER[b.status] != null ? ROLLEN_STATUS_ORDER[b.status] : 9;
    if (sa !== sb) return sa - sb;
    return (a.rolle || "").localeCompare(b.rolle || "");
  });
  return liste;
}


export {
  DEFAULT_KONTAKTE,
  DEFAULT_VES,
  DEFAULT_SETTINGS,
  VERWALTUNGSARTEN,
  DEFAULT_VERTEILERSCHLUESSEL,
  VS_BASEN,
  vsBasisLabel,
  vsIstManuell,
  vsIstPersonen,
  wirtschaftsjahrZeitraum,
  tageInklusive,
  personenTageImWj,
  einheitKopfzahl,
  einheitPersonenTage,
  belegungPersonenTage,
  abschnittPersonenTage,
  personenTageAufschluesselung,
  neuerPersonenAbschnitt,
  mieterNameVon,
  mitgliedPersonenTage,
  setzeEinheitKopfzahl,
  setzeEinheitMea,
  setzeEinheitFlaeche,
  darfFlaecheImVsEditieren,
  effVerteilerschluessel,
  vsWertVon,
  KONTAKTARTEN_KATEGORIEN,
  buildKontaktarten,
  klassifiziereZuweisung,
  kontaktPasstZuArt,
  kontaktInGruppe,
  objektOrt,
  objektInGruppe,
  FIELD_TYPES,
  ANLEGE_FELDTYPEN,
  SUGGESTIONS,
  isStellplatzTyp,
  extractNachname,
  BELEGUNG_TYPEN,
  BELEGUNG_LABEL,
  BEWOHNER_RECHTE,
  bewohnerRecht,
  istVertragspartei,
  _teilIdCounter,
  neueTeilId,
  neueBelegId,
  neueHhmId,
  neueRaumId,
  neueZaehlerId,
  leererHaushalt,
  neuesHhMitglied,
  istAnonymesMitglied,
  mitgliedKopfzahl,
  haushaltKopfzahl,
  neueBelegung,
  neueSevId,
  neueSev,
  sevStatus,
  laufenderSevWechsel,
  starteSevWechsel,
  brecheSevWechselAb,
  ergaenzeSevFeld,
  neuerTeil,
  neuerRaum,
  RAUM_ART_OPTIONEN,
  ZAEHLER_ARTEN,
  zaehlerArtLabel,
  neuerZaehler,
  teileVon,
  aktiverTeil,
  parseFlaeche,
  flaecheVon,
  summeRaumFlaechen,
  aktiveBelegung,
  aktiveBelegungVon,
  belegungsPhase,
  heuteLaufendeBelegung,
  aktiverHaushalt,
  abgeleiteterBelegungstyp,
  belegungsTyp,
  BELEGUNG_VERWENDUNGEN,
  BELEGUNGSTYP_ZU_VERWENDUNG,
  belegungsVerwendungen,
  istSelbstnutzerInEinheit,
  belegungVerwendungEinerEinheit,
  karteIstSelbstnutzend,
  belegPhaseZuStatus,
  objektZuweisungenAusEinheiten,
  wendeKontaktZuweisungenAn,
  wendeKontaktZuweisungenAnAlle,
  istVermietet,
  bewohnerMitKontakt,
  verwendungenVon,
  migriereSpStellung,
  heileSevVerwendung,
  normalisiereEinheit,
  ergaenzeBewohnerRechte,
  normalisiereVes,
  BEFUGNIS_ARTEN,
  _verknId,
  neueVerknId,
  neueVerknuepfung,
  verknuepfungenVon,
  ausgehendeBefugnisse,
  normalisiereKontakt,
  normalisiereKontakte,
  EIG_STATUS,
  eigStatus,
  laufenderEigWechsel,
  migriereKontaktZuweisungen,
  normalisiereEmail,
  normalisiereTelefon,
  normalisiereFirmenname,
  findeKontaktKandidaten,
  gruppiereDubletten,
  fuehreKontakteZusammen,
  gruppiereRollenkarten
};
