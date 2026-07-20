import {
  ACCENT, DEFAULT_GEWERKE_LISTE, DEFAULT_KATEGORIEN, DEFAULT_LEISTUNGEN,
  DEFAULT_ROLLEN, DEFAULT_VERWENDUNGEN, KONTAKTE_FARBE
} from "./constants.js";
import { isoHeute, splitPlzOrt, zuIsoDatum, parseDatumWert, dateinameSicher } from "./utils-basis.js";

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
  // §4.3 (Vorgang-Umbau) · Fristen-Standards: Defaults, im Einzelfall
  // überschreibbar. Rückmeldung bewusst nur EINMAL global (gilt für Angebot
  // UND Auftrag — kein doppelter Regler für denselben Wert).
  // Vorlagen/Textbausteine (Benny 11.07.): je Arbeitsschritt ein Text mit
  // Platzhaltern {nummer} {titel} {objekt} {beschreibung} {firma} {frist}.
  // Genutzt beim automatischen Kommunikations-Eintrag (Beauftragung) und
  // später fürs Auftragsschreiben (mailto) + KI-„formulieren" (Spec K0).
  vorgangsVorlagen: [
    { id: "vl_beauftragung", schritt: "beauftragung", titel: "Auftragsvergabe",
      text: "Auftrag {nummer} · {titel} · {objekt}\nHiermit beauftragen wir Sie mit: {beschreibung}.\nAusführung bis {frist}. Bitte bestätigen Sie den Auftrag kurz." },
    { id: "vl_angebotsanfrage", schritt: "angebotsanfrage", titel: "Angebotsanfrage",
      text: "Anfrage {nummer} · {titel} · {objekt}\nBitte um Angebot für: {beschreibung}.\nAngebotsabgabe bis {frist}." },
  ],
  fristen: {
    rueckmeldung_tage: 3,        // global · außen (steht sichtbar in der Nachricht)
    angebotsabgabe_tage: 14,     // Angebot · außen
    ausfuehrung_tage: 35,        // Auftrag · außen (am häufigsten pro Fall überschrieben)
    nachfass_vorlauf_tage: 7,    // übergreifend · INNEN (meine Uhr — Firma sieht ihn nie)
    rechnung_erwartet_tage: 14,  // übergreifend · innen (nach fertig, bis Mahnung)
  },
  // ETV: Standard-TOP-Katalog (Konzept _03 §8.3) — KEIN fester Pflichtblock.
  // Pflegbar in Einstellungen → ETV; wird per "TOP hinzufügen" in die
  // Tagesordnung geholt (ordentlich/außerordentlich/Umlauf stellen sich
  // ihr Programm selbst zusammen).
  // ETV · Versammlungsort-Anfrage (Benny 19.07.): E-Mail-Vorlage für die
  // Verfügbarkeits-Anfrage an die Location. Platzhalter {objekt} {datum}
  // {uhrzeit} {ort} {hv}. Vor dem Versand IMMER Vorschau (mailto-Weg).
  etvOrtAnfrage: {
    betreff: "Raumanfrage Eigentümerversammlung {objekt} — {datum}",
    text: "Sehr geehrte Damen und Herren,\n\nfür die Eigentümerversammlung der WEG {objekt} möchten wir anfragen, ob Ihre Räumlichkeit ({ort}) am {datum} um {uhrzeit} Uhr verfügbar ist.\n\nÜber eine kurze Rückmeldung freuen wir uns.\n\nMit freundlichen Grüßen\n{hv}",
  },
  etvStandardTops: [
    { id: "st1", titel: "Begrüßung und Feststellung der Beschlussfähigkeit", beschluss_noetig: false },
    { id: "st2", titel: "Genehmigung der Jahresabrechnung", beschluss_noetig: true },
    { id: "st3", titel: "Entlastung des Verwalters", beschluss_noetig: true },
    { id: "st4", titel: "Genehmigung des Wirtschaftsplans", beschluss_noetig: true },
    { id: "st5", titel: "Wahl des Verwaltungsbeirats", beschluss_noetig: true },
    { id: "st6", titel: "Verschiedenes", beschluss_noetig: false },
  ],
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
  schnellzugriffModus: "immer", // "aus" | "immer" | "home" – nur Homescreen oder überall
  schnellzugriffSticky: true,   // bei Mobile (Hochkant): Kategorie-Leiste bleibt unter dem Header sticky
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
  kalSeitenleiste: false, // Desktop: Kalender dauerhaft rechts (wie Schnellzugriff links)
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
    { id:"technik",       label:"Technik",       icon:"wrench",    farbe:"#10B981", aktiv:true,  reihenfolge:8 },
    { id:"dokumente",     label:"Dokumente",     icon:"document",  farbe:"#64748B", aktiv:true,  reihenfolge:9 },
    { id:"statistik",     label:"Statistik",     icon:"chart",     farbe:"#6366F1", aktiv:true,  reihenfolge:10 },
    { id:"listen",        label:"Listengenerator", icon:"sort",    farbe:"#0E7490", aktiv:true,  reihenfolge:11 },
    { id:"fotos",         label:"Fotos",         icon:"paint",     farbe:"#EC4899", aktiv:true,  reihenfolge:12 },
    { id:"schnelleingabe", label:"Schnelleingabe", icon:"plus",    farbe:"#0080FF", aktiv:true,  reihenfolge:13 },
    { id:"legionellen",   label:"Legionellen",   icon:"drop",      farbe:"#06B6D4", aktiv:true,  reihenfolge:14 },
    { id:"te",            label:"Teilungserklärung", icon:"badge", farbe:"#A855F7", aktiv:true,  reihenfolge:15 },
    { id:"historie",      label:"Historie",      icon:"clock",     farbe:"#F97316", aktiv:true,  reihenfolge:16 },
    // §96: Schreibtisch — objektübergreifende Handlungsliste der Vorgangs-Welt
    // („Was liegt an?"). Badge an der Kachel = Anzahl + dringlichste Farbe.
    { id:"schreibtisch",  label:"Schreibtisch",  icon:"check",     farbe:"#6366F1", aktiv:true,  reihenfolge:17 },
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
    { id:"fotos",        label:"Fotos",        icon:"paint",    aktiv:true, fix:false, reihenfolge:6 },
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

// ── Personen-Tage: manueller Override schlägt Berechnung (§76) ───────────────
// Der manuelle Wert liegt pro Jahr unter einheit.personenTageManuell[jahr]
// (Zahl) — ist er gesetzt, gilt er; sonst wird aus der Belegung berechnet.
// JEDE Stelle (Tabelle, Auswertung, später Abrechnung) holt den Wert NUR hier,
// damit „manuell vor berechnet" überall identisch gilt und nicht driftet.
function personenTageManuellVon(einheit, jahr) {
  if (!einheit || jahr == null) return null;
  const m = einheit.personenTageManuell;
  if (!m || typeof m !== "object") return null;
  const v = m[String(jahr)];
  if (v == null || v === "") return null;
  const n = Number(v);
  return (isFinite(n) && n >= 0) ? n : null;
}

// Liefert { wert, manuell, berechnet } für eine Einheit + Jahr.
//   manuell  = der Override (oder null)
//   berechnet = die Belegungs-Summe
//   wert     = manuell falls gesetzt, sonst berechnet
function personenTageWert(einheit, jahr) {
  const wjVon = `${jahr}-01-01`;
  const wjBis = `${jahr}-12-31`;
  const auf = personenTageAufschluesselung(einheit, wjVon, wjBis);
  const berechnet = (auf && typeof auf.summe === "number") ? auf.summe : 0;
  const manuell = personenTageManuellVon(einheit, jahr);
  return {
    wert: (manuell != null) ? manuell : berechnet,
    manuell, berechnet,
    istManuell: manuell != null,
  };
}

// Setzt/löscht den manuellen Personen-Tage-Wert einer Einheit für ein Jahr.
// wert == null oder "" → Override entfernen (zurück zur Berechnung).
function setzePersonenTageManuell(einheit, jahr, wert) {
  const alt = (einheit && einheit.personenTageManuell && typeof einheit.personenTageManuell === "object")
    ? einheit.personenTageManuell : {};
  const neu = { ...alt };
  const key = String(jahr);
  if (wert == null || wert === "") {
    delete neu[key];
  } else {
    const n = Number(wert);
    if (isFinite(n) && n >= 0) neu[key] = n; else delete neu[key];
  }
  const hatWerte = Object.keys(neu).length > 0;
  const out = { ...einheit };
  if (hatWerte) out.personenTageManuell = neu; else delete out.personenTageManuell;
  return out;
}

// Folgejahr-Kontext (§76): Wenn das aktuelle Jahr KEINEN manuellen Wert hat,
// aber das Vorjahr einen hatte, ist eine Entscheidung nötig (rot markieren).
// Liefert { vorjahr, vorjahrWert, entscheidungNoetig }:
//   entscheidungNoetig = true  → aktuelles Jahr ohne Override, Vorjahr mit.
// Dient nur der Anzeige/Markierung; ändert nichts an personenTageWert.
function personenTageFolgejahr(einheit, jahr) {
  const vorjahr = jahr - 1;
  const aktuellManuell = personenTageManuellVon(einheit, jahr);
  const vorjahrWert = personenTageManuellVon(einheit, vorjahr);
  return {
    vorjahr,
    vorjahrWert,
    entscheidungNoetig: (aktuellManuell == null && vorjahrWert != null),
  };
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

// ── Heizfläche (eigenes Feld pro Einheit) ───────────────────────────────────
// Anders als Wohn-/Nutzfläche (die sich aus Typ + flaeche ergeben) ist die
// Heizfläche ein separater, frei pflegbarer Wert: die beheizte Fläche für
// Heizkostenabrechnungen, die von der reinen Wohnfläche abweichen kann.
// Liegt flach an der Einheit (einheit.heizflaeche, String).
function heizflaecheVon(einheit) {
  if (!einheit) return "";
  return einheit.heizflaeche != null ? String(einheit.heizflaeche) : "";
}
function setzeEinheitHeizflaeche(einheit, wert) {
  if (!einheit) return einheit;
  const wertStr = String(wert == null ? "" : wert).replace(",", ".");
  const out = { ...einheit };
  if (wertStr === "") delete out.heizflaeche; else out.heizflaeche = wertStr;
  return out;
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

// Anzeigename per Kontakt-ID aus einer Liste (BESTANDSFIX 13.78: etv.jsx rief
// kontaktAnzeigename fälschlich mit (kontakte, id) auf — die nimmt aber ein
// Kontakt-OBJEKT. Ergebnis: Leiter/Protokollführer/Beirat wurden leer gedruckt).
function kontaktNameVonId(kontakte, id) {
  if (id == null) return "";
  const k = (kontakte || []).find((x) => x && x.id === id);
  return _kontaktAnzeigename(k);
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
  personenTageWert,
  personenTageManuellVon,
  personenTageFolgejahr,
  setzePersonenTageManuell,
  neuerPersonenAbschnitt,
  mieterNameVon,
  mitgliedPersonenTage,
  setzeEinheitKopfzahl,
  setzeEinheitMea,
  setzeEinheitFlaeche,
  heizflaecheVon,
  setzeEinheitHeizflaeche,
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

// ── Foto-Feature (§93, Stufe 1) ─────────────────────────────────────────────
// Fotos hängen am Objekt (ve.fotos[]). Alben: fixe Default-Liste + eigene
// (Freitext-Strings direkt in foto.album — keine eigene Verwaltung; ein
// eigenes Album existiert, solange ein Foto es trägt).
export const FOTO_ALBEN = [
  { id: "aussen",    label: "Außenansichten" },
  { id: "innen",     label: "Innenbereiche" },
  { id: "technik",   label: "Technik" },
  { id: "schaeden",  label: "Schäden" },
  { id: "sonstiges", label: "Sonstiges" },
];

// Anzeige-Label eines Album-Werts: Katalog-id → Label, sonst der eigene Name.
export function fotoAlbumLabel(album) {
  const a = FOTO_ALBEN.find(x => x.id === album);
  return a ? a.label : String(album || "Sonstiges");
}

// ── Zuordnungs-Auflösung: durchsucht die Standort-Karten (gebaeude/tiefgarage)
// des Objekts nach Einheit / Raum / Technik-Gerät. Reines Daten-Traversieren —
// bewusst hier (und nicht in components), damit der Dateiname-Generator ohne
// UI-Import auskommt.
export function fotoStandorte(ve) {
  const karten = (ve && Array.isArray(ve.karten)) ? ve.karten : [];
  return karten.filter(k => k && (k.kategorie === "gebaeude" || k.kategorie === "tiefgarage"));
}
export function fotoFindeEinheit(ve, einheitId) {
  if (!einheitId) return null;
  const st = fotoStandorte(ve);
  for (let i = 0; i < st.length; i++) {
    const eh = (st[i].einheiten || []).find(e => e && String(e.id) === String(einheitId));
    if (eh) return eh;
  }
  return null;
}
export function fotoFindeRaum(ve, raumId) {
  if (!raumId) return null;
  const st = fotoStandorte(ve);
  for (let i = 0; i < st.length; i++) {
    const r = (st[i].raeume || []).find(x => x && String(x.id) === String(raumId));
    if (r) return r;
    const einheiten = st[i].einheiten || [];
    for (let j = 0; j < einheiten.length; j++) {
      const teile = einheiten[j].teile || [];
      for (let k = 0; k < teile.length; k++) {
        const tr = (teile[k].raeume || []).find(x => x && String(x.id) === String(raumId));
        if (tr) return tr;
      }
    }
  }
  return null;
}
export function fotoFindeGeraet(ve, geraetId) {
  // Geräte hängen an den TECHNIK-Karten des Objekts (kategorie "technik"),
  // nicht an den Gebäude-Karten (Bugfix v13.53 — vorher lief die Suche leer).
  if (!geraetId) return null;
  const karten = (ve && Array.isArray(ve.karten)) ? ve.karten : [];
  for (let i = 0; i < karten.length; i++) {
    const k = karten[i];
    if (!k || k.kategorie !== "technik") continue;
    const g = (k.technikGeraete || []).find(x => x && String(x.id) === String(geraetId));
    if (g) return g;
  }
  return null;
}

// Zuordnungs-Label eines Fotos (fürs UI + den Dateinamen). ZWEI Welten:
//   gemeinschaft → "Gemeinschaft", mit Raum → "{Raumname}" (z. B. Heizraum)
//   einheit      → "WE{nr}",       mit Raum → "WE{nr} · {Raumname}"
// (dateinameSicher macht daraus im Dateinamen "WE3-Bad"). Die frühere eigene
// Art "raum" (Zwischenstand 13.48) wird defensiv wie gemeinschaft+Raum gelesen.
// Gerät (falls verknüpft) wird im Dateinamen angehängt, im UI separat gezeigt.
export function fotoZuordnungLabel(ve, foto) {
  const z = (foto && foto.zuordnung) || {};
  const raum = z.raumId ? fotoFindeRaum(ve, z.raumId) : null;
  const raumName = z.raumId ? ((raum && raum.name) || "Raum") : "";
  if (z.art === "einheit") {
    const eh = fotoFindeEinheit(ve, z.einheitId);
    const we = eh ? ("WE" + (eh.nr || eh.id)) : "Einheit";
    return raumName ? (we + " · " + raumName) : we;
  }
  return raumName || "Gemeinschaft";
}

// ── Generierter Foto-Dateiname (KEIN manueller Titel — §93.6):
//   {VE-Nr}_{Album}_{Zuordnung}[_{Gerät}]_{YYYY-MM-DD}[_{n}].{ext}
// Beispiel: VE-001_Aussenansichten_Gemeinschaft_2026-05-12.jpg
// Der Name ist zugleich Anzeigename in Liste/Viewer und Download-Name.
// alleFotos (optional) = ve.fotos für das Kollisions-Suffix _2, _3 …
// Hinweis: laut Spec in utils-basis vorgesehen — lebt hier, weil FOTO_ALBEN
// und die Objekt-Traversierung gebraucht werden (utils-basis bleibt Blatt).
export function fotoDateiname(ve, foto, alleFotos) {
  if (!foto) return "Foto.jpg";
  const extM = String(foto.name || "").match(/\.([A-Za-z0-9]+)$/);
  const ext = extM ? extM[1].toLowerCase() : "jpg";
  const basisVon = (f) => {
    const teile = [
      dateinameSicher((ve && ve.nr) || "Objekt"),
      dateinameSicher(fotoAlbumLabel(f.album)),
      dateinameSicher(fotoZuordnungLabel(ve, f)),
    ];
    const g = fotoFindeGeraet(ve, f.geraetId);
    if (g) teile.push(dateinameSicher(g.typLabel || "Geraet"));
    // aufgenommen "DD.MM.YYYY" → "YYYY-MM-DD"; Fallback: angelegt (ISO).
    let datum = "";
    const dm = String(f.aufgenommen || "").match(/^(\d{2})\.(\d{2})\.(\d{4})$/);
    if (dm) datum = dm[3] + "-" + dm[2] + "-" + dm[1];
    else if (f.angelegt) datum = String(f.angelegt).slice(0, 10);
    if (datum) teile.push(datum);
    return teile.filter(Boolean).join("_");
  };
  const basis = basisVon(foto);
  // Kollisions-Suffix: wie viele frühere Fotos in der Liste teilen die Basis?
  let gleich = 0;
  const alle = Array.isArray(alleFotos) ? alleFotos : [];
  for (let i = 0; i < alle.length; i++) {
    const f = alle[i];
    if (!f) continue;
    if (f.id === foto.id) break;
    if (basisVon(f) === basis) gleich++;
  }
  return basis + (gleich > 0 ? "_" + (gleich + 1) : "") + "." + ext;
}

// ╔══════════════════════════════════════════════════════════════════════════╗
// ║ §96 · VORGANGS-WELT — das Datenmodell (VORGANG_Feature_Spec _03)         ║
// ║                                                                          ║
// ║ Architektur-Prinzip (Spec §2): ALLES EIGENSTÄNDIGE IST FLACH.            ║
// ║ Jedes Ding mit eigenem Lebenszyklus ist eine eigene Liste mit Fremd-     ║
// ║ schlüssel — nie im Elternobjekt verschachtelt. Der Vorgang lebt wie ein  ║
// ║ Termin (eigene Liste, objekt_id am Eintrag → Objekt-Sicht UND Timeline   ║
// ║ sind nur zwei Filter auf dieselbe Liste), nicht wie ein Foto (Attribut). ║
// ║                                                                          ║
// ║ Spiegelt DB-Schema C2–C4 (Spec _06) + die 7 Schema-Lücken (Spec _03      ║
// ║ §10): Angebot, Beteiligung, Abnahme, Rechnung, Aufgabe, Kategorie,       ║
// ║ Beschluss-Referenz. Migration zu Supabase = 1:1 (Tabelle je Liste).      ║
// ║                                                                          ║
// ║ Bewusst KEIN Baustein: „Meldung" (= Vorgang offen + erste Nachricht +    ║
// ║ Melder-Beteiligung), „Hinweis" (= errechnet, §96-Hinweise unten),        ║
// ║ „Notiz" (§5.11: ist entweder erfasst-Auftrag, Ideen-Same oder Aufgabe    ║
// ║ an mich selbst), Foto/Datei (Eigenschaft am Träger, kein Fall).          ║
// ╚══════════════════════════════════════════════════════════════════════════╝

// ── §96.1 · Kategorien: EIN Prozess, der sich zusammenfaltet (Spec §6) ──────
// Die Kategorie entscheidet, welche Phasen der EINEN potenziellen Kette aktiv
// sind — kein Bau von 4 Parallel-Prozessen (§76 auf Prozessebene). Zugleich
// macht das Feld das Portfolio filterbar (alle Sanierungen, alle Pflege …).
const VORGANG_PHASEN_KETTE = [
  "meldung", "angebot", "beschluss", "beauftragung", "ausfuehrung",
  "abnahme", "rechnung", "abschluss", "gewaehrleistung",
];
// Kategorien-Leiter NEU (Benny 11.07.): laufend → erhalten → reparieren →
// aufwerten. Wartung ist KEINE eigene Kategorie mehr (gehört zur
// Instandhaltung), Pflege heißt Bewirtschaftung (die kleinen Aufträge an den
// Hausmeister). Versicherungsfall ist bewusst KEINE Kategorie — er ist eine
// EIGENSCHAFT über der Arbeitsart (vorgang.versicherung), sonst vermischt
// man Arbeitsart mit Kostenträger.
const VORGANG_KATEGORIEN = [
  { id: "bewirtschaftung", label: "Bewirtschaftung", kurz: "Bewirtschaftung", icon: "sparkles",
    phasen: ["meldung", "beauftragung", "ausfuehrung", "abschluss"] },
  { id: "instandhaltung", label: "Instandhaltung", kurz: "Instandhaltung", icon: "wrench",
    phasen: ["meldung", "beauftragung", "ausfuehrung", "abnahme", "rechnung", "abschluss"] },
  { id: "instandsetzung", label: "Instandsetzung", kurz: "Instandsetzung", icon: "swap",
    phasen: ["meldung", "beauftragung", "ausfuehrung", "abnahme", "rechnung", "abschluss", "gewaehrleistung"] },
  { id: "sanierung", label: "Sanierung / Modernisierung", kurz: "Sanierung", icon: "building",
    phasen: VORGANG_PHASEN_KETTE.slice() },
];
// Alt-Kategorien-Migration (Bestand vor v13.70): alte IDs bleiben lesbar.
const ALT_KATEGORIE = { wartung: "instandhaltung", pflege: "bewirtschaftung" };
function vorgangKategorie(id) {
  for (let i = 0; i < VORGANG_KATEGORIEN.length; i++) {
    if (VORGANG_KATEGORIEN[i].id === id) return VORGANG_KATEGORIEN[i];
  }
  // Default: Instandhaltung — per id gesucht, NICHT per Index (Index hat sich
  // mit der Wartungs-Kategorie verschoben).
  return VORGANG_KATEGORIEN.filter((k) => k.id === "instandhaltung")[0];
}
function kategorieHatPhase(kategorieId, phase) {
  return vorgangKategorie(kategorieId).phasen.indexOf(phase) >= 0;
}

// Abnahme PRO AUFTRAG wählbar (Umbau §6b, Bennys Korrektur der Spec): der
// explizite Schalter am Auftrag gewinnt; ohne Schalter gilt der
// Kategorie-Default. Auch im großen Vorgang gibt es Kleinaufträge ohne
// Abnahmebedarf neben dem abnahmepflichtigen Hauptauftrag.
function auftragBrauchtAbnahme(auftrag, kategorieId) {
  if (auftrag && auftrag.abnahme_noetig === true) return true;
  if (auftrag && auftrag.abnahme_noetig === false) return false;
  return kategorieHatPhase(kategorieId, "abnahme");
}

// ── §96.2 · Statusketten (Spec §7 — zwei gekoppelte Ketten) ────────────────
// Kopplung ist BEWUSST lose: Auftrags-Fertigmeldung schaltet den Vorgang
// NICHT automatisch weiter — sie erzeugt einen Hinweis („Abnahme fällig") an
// den Fallführer. Fertigmeldung = Behauptung der Firma; Abnahme = Prüfung.
const VORGANG_STATUS = [
  "offen", "beauftragt", "ausfuehrung", "abnahme",
  "rechnungspruefung", "bezahlt", "geschlossen",
];
// erfasst (NEU _03) = der frühe Auftrag („kaputte Lampe"): festgehalten, weiß
// schon was es ist, aber noch nicht rausgeschickt. KEIN Notizzettel — der
// Auftrag fängt nur früher an. Darf OHNE Vorgang leben (vorgang_id null),
// unverzichtbar für die Begehung (§5.12).
const AUFTRAG_STATUS = [
  "erfasst", "beauftragt", "in_arbeit", "fertiggemeldet",
  "nachbesserung", "abgenommen",
];
function auftragLaeuft(a) {
  return !!a && (a.status === "beauftragt" || a.status === "in_arbeit"
    || a.status === "nachbesserung");
}
const RECHNUNG_STATUS = ["eingegangen", "in_pruefung", "freigegeben", "bezahlt"];
const ABNAHME_ERGEBNISSE = ["angenommen", "mit_maengeln", "abgelehnt"];
const AUFGABE_STATUS = ["offen", "erledigt", "abgelehnt"];

// ── §96.3 · Beteiligungs-Rollen (Spec §5.2 — Rolle am VORGANG, nicht am ────
// Menschen). Die zwei Zugriffsachsen (sehen / beitragen) sind FREI kombinier-
// bar; die Werte hier sind nur die Regelfall-Vorbelegung je Rolle.
// Leitregel: Beteiligungen werden NIE gelöscht — der Zeuge bleibt für immer
// in der Akte auffindbar (Versicherung!), fällt nach `bis` nur aus dem
// laufenden Verteiler. kontakt_id null + rolle "fallfuehrer" = die Verwaltung
// selbst (bis Login/Phase 5 gibt es keinen „Ich"-Kontakt).
const BETEILIGUNG_ROLLEN = [
  { id: "fallfuehrer",   label: "Fallführer",            sehen: "voll",         beitragen: "voll" },
  { id: "melder",        label: "Melder / Zeuge",        sehen: "eigener_teil", beitragen: "lesen" },
  { id: "betroffener",   label: "Betroffener",           sehen: "voll",         beitragen: "lesen" },
  { id: "mitinformiert", label: "Mitinformiert / Beirat", sehen: "voll",        beitragen: "lesen" },
  { id: "extern",        label: "Externer Beteiligter",  sehen: "eigener_teil", beitragen: "eigener_teil_schreiben" },
  { id: "ausfuehrender", label: "Ausführender",          sehen: "eigener_teil", beitragen: "eigener_teil_schreiben" },
  { id: "pruefer",       label: "Prüfer",                sehen: "eigener_teil", beitragen: "eigener_teil_schreiben" },
];
function beteiligungRolle(id) {
  for (let i = 0; i < BETEILIGUNG_ROLLEN.length; i++) {
    if (BETEILIGUNG_ROLLEN[i].id === id) return BETEILIGUNG_ROLLEN[i];
  }
  return BETEILIGUNG_ROLLEN[0];
}

// ── §96.4 · ID-Fabriken (Bestandsmuster: präfix_ + Zeit36 + Zufall) ────────
function vgId(praefix) {
  return praefix + "_" + Date.now().toString(36) + "_"
    + Math.random().toString(36).slice(2, 8);
}

// ── §96.5 · Objekt-Fabriken = zugleich Normalisierer ───────────────────────
// Object.assign(Defaults, init): dient dem Neuanlegen UND dem Normalisieren
// geladener Daten (fehlende Felder werden generisch ergänzt, vorhandene
// gewinnen — dasselbe Prinzip wie ladeSettings).
function neuerVorgang(init) {
  const v = Object.assign({
    id: vgId("vg"),
    nummer: null,                // Vorgangsnummer JJMMTT+3-stellig (z. B. 260711001) — STABIL, wird kommuniziert
    objekt_id: null,             // WO (Gemeinschaftseigentum) — Pflicht im Alltag
    einheit_id: null,            // optional präziser (Sondereigentum / „WE 03")
    raum_id: null,               // Verfeinerung (Benny 11.07.): Objekt → Einheit → RAUM
    titel: "",
    kategorie: "instandhaltung", // steuert Phasen (§96.1) + macht Portfolio filterbar
    versicherung: null,          // A1 (11.07.): Versicherungsfall = EIGENSCHAFT über der Kategorie.
                                 // null = keiner; sonst { gesellschaft, schadennummer,
                                 // selbstbeteiligung, gemeldet_am, notiz } — eigener Strang in der Akte.
    art: null,                   // Auslöser-Typ (meldung/anfrage/schaden) — Schema C2, optional
    status: "offen",
    eigentumsbezug: "gemeinschaft", // gemeinschaft | sonder (Schema C2)
    abrechnungskreis_id: null,   // Kostenträger (Schema A2b) — nullable = Gesamt-WEG
    ersteller_kontakt_id: null,
    angelegt_am: isoHeute(),
    geschlossen_am: null,
    ruht_bis: null,              // Grau-Unterart 1: ruht bis DATUM → kippt bei Erreichen zu 🟡
    // Grau-Unterart 2 + ETV-Nahtstelle (§9): ruht bis EREIGNIS. Wert ist eine
    // Beschluss-ID ODER der Sonderwert "naechste_etv" (= gehört auf die
    // Tagesordnung, Beschluss-Objekt existiert noch nicht — die spätere
    // ETV-Welt findet ihre Tagesordnung als Filter hierüber fertig vor).
    wartet_auf_beschluss_id: null,
    entstanden_aus_beschluss_id: null, // Rückrichtung: Beschluss erzeugte diesen Vorgang
    gewaehrleistung_bis: null,   // geschlossen + trotzdem reaktivierbar (nie löschen)
    dateien: [],                 // allgemeine Vorgangs-Dokumente (§85-Mechanik)
    demo: false,                 // true = Seed-Datensatz (gesammelt entfernbar)
  }, init || {});
  if (!Array.isArray(v.dateien)) v.dateien = [];
  return v;
}
function neueBeteiligung(init) {
  const rolleId = (init && init.rolle) || "fallfuehrer";
  const r = beteiligungRolle(rolleId);
  const b = Object.assign({
    id: vgId("bet"),
    vorgang_id: null,
    kontakt_id: null,            // null = die Verwaltung selbst (s. §96.3)
    rolle: rolleId,
    sehen: r.sehen,              // nichts | eigener_teil | voll
    beitragen: r.beitragen,      // lesen | eigener_teil_schreiben | voll
    von: isoHeute(),
    bis: null,                   // Zeitfenster-Ende: fällt aus dem Verteiler, bleibt in der Akte
    status: "aktiv",             // aktiv | beendet — NIE löschen (Leitregel)
    demo: false,
  }, init || {});
  return b;
}
// §4.3 · Fristen-Standards lesen (Settings können partiell sein — Defaults
// füllen auf; selbes Prinzip wie ladeSettings).
function fristenVon(settings) {
  const d = DEFAULT_SETTINGS.fristen;
  const f = (settings && settings.fristen) || {};
  return {
    rueckmeldung_tage: f.rueckmeldung_tage != null ? f.rueckmeldung_tage : d.rueckmeldung_tage,
    angebotsabgabe_tage: f.angebotsabgabe_tage != null ? f.angebotsabgabe_tage : d.angebotsabgabe_tage,
    ausfuehrung_tage: f.ausfuehrung_tage != null ? f.ausfuehrung_tage : d.ausfuehrung_tage,
    nachfass_vorlauf_tage: f.nachfass_vorlauf_tage != null ? f.nachfass_vorlauf_tage : d.nachfass_vorlauf_tage,
    rechnung_erwartet_tage: f.rechnung_erwartet_tage != null ? f.rechnung_erwartet_tage : d.rechnung_erwartet_tage,
  };
}
// Vorlagen lesen (Settings partiell → Defaults) + Platzhalter füllen.
function vorlagenVon(settings) {
  const v = settings && Array.isArray(settings.vorgangsVorlagen)
    ? settings.vorgangsVorlagen : null;
  return v && v.length > 0 ? v : DEFAULT_SETTINGS.vorgangsVorlagen;
}
// ETV-Ort-Anfrage-Vorlage mit Default-Fallback (Muster vorlagenVon).
function etvOrtAnfrageVon(settings) {
  const v = settings && settings.etvOrtAnfrage;
  return {
    betreff: (v && v.betreff) || DEFAULT_SETTINGS.etvOrtAnfrage.betreff,
    text: (v && v.text) || DEFAULT_SETTINGS.etvOrtAnfrage.text,
  };
}
function vorlageFuerSchritt(vorlagen, schritt) {
  return (vorlagen || []).filter((v) => v.schritt === schritt)[0] || null;
}
function fuelleVorlage(text, ctx) {
  let out = String(text || "");
  const c = ctx || {};
  ["nummer", "titel", "objekt", "beschreibung", "firma", "frist"].forEach((k) => {
    out = out.split("{" + k + "}").join(c[k] != null && c[k] !== "" ? String(c[k]) : "—");
  });
  return out;
}

// ISO-Datum heute + n Tage (für berechnete Frist-Felder, §4).
function isoInTagen(n) {
  const d = new Date();
  d.setDate(d.getDate() + (Number(n) || 0));
  return d.toISOString().slice(0, 10);
}

// ── §96.x · Anlass-Typen der Information (Umbau-Konzept §3.1) ──────────────
// Der Anlass wird meist vom KONTEXT gesetzt, nicht aus dem Dropdown gewählt —
// darum darf die Liste fein sein (~10). `antwort` = Default für
// antwort_erwartet (§3.3), im Einzelfall überschreibbar.
const ANLASS_TYPEN = [
  { id: "eingangsbestaetigung", label: "Eingangsbestätigung",      antwort: false },
  { id: "rueckfrage",           label: "Rückfrage",                antwort: true },
  { id: "betroffenheit",        label: "Betroffenheit",            antwort: false },
  { id: "angebotsanfrage",      label: "Angebotsanfrage",          antwort: true },
  { id: "beauftragung",         label: "Beauftragung",             antwort: false },
  { id: "ankuendigung",         label: "Ankündigung / Termininfo", antwort: false },
  { id: "zwischenstand",        label: "Zwischenstand",            antwort: false },
  { id: "abschluss",            label: "Abschluss / Erledigung",   antwort: false },
  { id: "nachfrage",            label: "Nachfrage / Zufriedenheit", antwort: false },
  { id: "frei",                 label: "Frei",                     antwort: false },
];
function anlassTyp(id) {
  for (let i = 0; i < ANLASS_TYPEN.length; i++) {
    if (ANLASS_TYPEN[i].id === id) return ANLASS_TYPEN[i];
  }
  return ANLASS_TYPEN[ANLASS_TYPEN.length - 1];
}

function neueNachricht(init) {
  return Object.assign({
    id: vgId("nc"),
    vorgang_id: null,
    richtung: "eingehend",       // eingehend | ausgehend
    kanal: "notiz",              // telefon|whatsapp|email|brief|persoenlich|notiz (§3.2, kanal-agnostisch, PRO Eintrag)
    von_kontakt_id: null,
    an_kontakt_id: null,
    betreff: "",
    inhalt: "",
    anlass: "frei",              // Anlass-Typ (§3.1) — Haken für Vorlagen + KI `formulieren`
    antwort_erwartet: false,     // Default aus Anlass, pro Fall überschreibbar (§3.3)
    rueckmeldung_bis: null,      // §4.3: bis wann die Antwort erwartet wird (global EIN Standard)
    antwort_auf_id: null,        // eingehende Antwort MIT Inhalt schließt den Faden (§3.3)
    gesendet_am: isoHeute(),
    demo: false,
  }, init || {});
}
function neuesAngebot(init) {
  // Angebot = Anfrage OHNE Verbindlichkeit (§5.4). Endet mit Preis/Dokument,
  // nicht mit Leistung. Hält die Auftragsliste sauber (3 Anfragen ≠ 3 Aufträge).
  const a = Object.assign({
    id: vgId("ang"),
    nummer: null,                // Angebotsnummer = Vorgangsnummer + "-AG01" … (je Anfrage/Thema eine)
    vorgang_id: null,
    firma_kontakt_id: null,
    preis: null,                 // Zahl (EUR) oder null solange offen
    notiz: "",                   // kurze Notiz zum Angebot (§6a: Summe + PDF + Notiz)
    abgabe_bis: null,            // §4.3: bis wann das Angebot erwartet wird → treibt „Angebot überfällig"
    gueltig_bis: null,           // treibt „Angebot veraltet"-Frist am Schreibtisch
    eingeholt_am: isoHeute(),
    wurde_zu_auftrag_id: null,   // die Verwandlung: gewähltes Angebot → Auftrag (nachvollziehbar)
    dateien: [],
    demo: false,
  }, init || {});
  if (!Array.isArray(a.dateien)) a.dateien = [];
  return a;
}
function neuerAuftrag(init) {
  const a = Object.assign({
    id: vgId("auf"),
    nummer: null,                // Auftragsnummer = Vorgangsnummer + "-A01" … — vergeben, sobald ein Vorgang dahintersteht
    vorgang_id: null,            // NULLABLE (§5.5): erfasst-Auftrag lebt ohne Vorgang
    objekt_id: null,             //   … dann hängt er direkt am Objekt (Begehung §5.12)
    firma_kontakt_id: null,      // bei "erfasst" meist noch leer
    freigegeben_von_id: null,
    status: "erfasst",           // §96.2-Kette; erfasst = 🔵 blau (Ball liegt bei mir)
    beschreibung: "",
    einheit_id: null,            // „Wo?" — Einheit oder null = ganzes Objekt (Benny 18.07., wie Vorgang)
    raum_id: null,               // „Raum" — Verfeinerung, null = kein bestimmter Raum
    ort: "",                     // „Wo genau?" — Freitext vom Erfassen (Begehung 18.07.)
    notiz: "",                   // Notizen zum Punkt (Nachbearbeitung vor Vorgang)
    gemeldet_von_id: null,       // wer hat gemeldet/aufgenommen (Kontakt, null = ich)
    erfasst_am: isoHeute(),
    beauftragt_am: null,
    frist: null,                 // optionales Zieldatum → treibt 🔴 überfällig
    abnahme_noetig: null,        // §6b (Umbau): Abnahme PRO AUFTRAG wählbar — null = Kategorie-Default, true/false = explizit
    nachfass_ab: null,           // §4.3: INTERNER Nachfass-Zeitpunkt (frist − Vorlauf) — die Firma sieht ihn nie
    rechnung_erwartet_bis: null, // §4.3: nach „fertig" gesetzt → treibt „Rechnung fehlt"
    foto_ids: [],                // Weg A (§5.10): Fotos leben in ve.fotos[], hier nur Refs
    dateien: [],                 // Prüfprotokoll / Gutachten am Auftrag
    demo: false,
  }, init || {});
  if (!Array.isArray(a.foto_ids)) a.foto_ids = [];
  if (!Array.isArray(a.dateien)) a.dateien = [];
  return a;
}
function neueAbnahme(init) {
  // Hängt am AUFTRAG (nicht am Vorgang): bei mehreren Firmen wird jede einzeln
  // abgenommen. Wird nur bei Kategorien mit Abnahme-Phase erzeugt — immer
  // DASSELBE Objekt, nur nicht immer erzeugt (§5.6).
  const a = Object.assign({
    id: vgId("abn"),
    auftrag_id: null,
    datum: isoHeute(),
    pruefer_kontakt_id: null,
    ergebnis: "angenommen",      // angenommen | mit_maengeln | abgelehnt
    maengel: [],                 // strukturierte Liste bleibt möglich; Start schlank über notiz (§6b)
    notiz: "",                   // freies Notizfeld (§6b: was, warum, was fehlt — das Inhaltliche)
    foto_ids: [],
    dateien: [],
    demo: false,
  }, init || {});
  if (!Array.isArray(a.maengel)) a.maengel = [];
  if (!Array.isArray(a.foto_ids)) a.foto_ids = [];
  if (!Array.isArray(a.dateien)) a.dateien = [];
  return a;
}
function neueRechnung(init) {
  // Optional (§5.7) — nicht jeder Vorgang hat eine. Verweist auf den Auftrag,
  // verwaltet wird sie am Vorgang (Prüfung → Freigabe → Zahlung = Verwalter-Handlungen).
  const r = Object.assign({
    id: vgId("re"),
    vorgang_id: null,
    auftrag_id: null,
    betrag: null,
    abweichung_grund: "",        // §6c (Umbau): Freitext „warum weicht sie ab" — Nachweis der Freigabe-Begründung
    status: "eingegangen",       // §96.2 RECHNUNG_STATUS
    eingegangen_am: isoHeute(),
    bezahlt_am: null,
    dateien: [],
    demo: false,
  }, init || {});
  if (!Array.isArray(r.dateien)) r.dateien = [];
  return r;
}
function neueAufgabe(init) {
  // Delegierte Handlung an eine PERSON (≠ errechneter Hinweis). Eiserne Regel
  // (§5.8): geht immer an eine beteiligung_id, nie an einen nackten Kontakt —
  // Rechte hängen an der Beteiligung, nicht an der Aufgabe. Adressat darf auch
  // der Verwalter selbst sein (Vorbereitungs-Aufgabe, B2 in §5.11).
  return Object.assign({
    id: vgId("aufg"),
    vorgang_id: null,
    beteiligung_id: null,
    titel: "",
    status: "offen",             // offen | erledigt | abgelehnt
    frist: null,                 // treibt „überfällig" (🔴)
    bezug: null,                 // optional { typ: "rechnung"|"abnahme"|…, id } — Tap landet richtig
    rueckmeldung: "",
    angelegt_am: isoHeute(),
    erledigt_am: null,
    demo: false,
  }, init || {});
}
function neuerBeschluss(init) {
  // ETV-Ausbau 12.07. (ETV_Konzept _03 §2.3): aus dem Platzhalter wird der
  // volle Beschluss. Er trägt Wortlaut + Abstimmungsergebnis — der TOP
  // referenziert ihn nur (beschluss_id). Die Beschluss-SAMMLUNG als eigene
  // Kachel kommt später; das Objekt hier ist schon richtig geschnitten.
  return Object.assign({
    id: vgId("bes"),
    objekt_id: null,
    versammlung_id: null,        // in welcher Versammlung gefasst
    top_id: null,                // aus welchem TOP entstanden
    vorgang_id: null,            // welcher Vorgang wurde beschlossen (Nahtstelle §9)
    status: "gefasst",           // gefasst | abgelehnt | angefochten | bestandskraeftig
    datum: null,                 // (Alt-Feld, bleibt für Bestand)
    betreff: "",                 // (Alt-Feld, bleibt für Bestand)
    titel: "",
    wortlaut: "",
    abstimmung: null,            // Cockpit (14.07.): { ja_kopf,nein_kopf,enth_kopf,
                                 //   ja_mea,nein_mea,enth_mea, ja,nein,enthaltung }
                                 // — Kopf UND MEA getrennt; ja/nein/enthaltung bleiben
                                 // als Alias der nach Stimmprinzip maßgeblichen Reihe
                                 // (Alt-Beschlüsse + einfacher Druck, rückwärtskompatibel)
    stimmen: {},                 // Einzelstimmen { [einheit_id]: "ja"|"nein"|"enthaltung" }
                                 // — Redundanz-Entscheidung 14.07.: Einzelstimmen UND Summen
    mehrheitstyp: "einfach",     // gespiegelt vom TOP (fürs Protokoll/Sammlung)
    gesamt_mea: 0,               // Gesamt-MEA der WEG zum Zeitpunkt (Nenner, eingefroren)
    schwelle_erreicht: null,     // { kopf: bool, mea: bool } bei qualifiz. | null bei einfach
    ergebnis: null,              // "angenommen" | "abgelehnt"
    gefasst_am: null,
    anfechtungsfrist_bis: null,  // gefasst_am + 1 Monat (§45 WEG)
    jahr: null,
    ist_besonders: false,        // Verwalter-Merker → ETV-Tab "Beschlüsse" (§2b)
    // Beschluss-Sammlung (§24 VII WEG, Konzept 13.07.):
    lfd_nummer: null,            // FORTLAUFENDE Sammlungs-Nummer — einmal vergeben, für immer
                                 // stabil; EIN Nummernkreis mit gerichtsentscheidungen; KEIN
                                 // Jahres-Reset (h.M.: unzulässig). Vergabe automatisch bei
                                 // Verkündung (weltTopAbstimmen), außer GO-Beschluss.
    vermerke: [],                // [{datum, typ:"angefochten"|"aufgehoben"|"bedeutungslos"|"frei", text}]
                                 // additiv (Journal, §24 VII S.4/7) — nie editiert/gelöscht
    ort: "",                     // NUR Alt-Beschlüsse ohne versammlung_id (sonst abgeleitet)
    alt_erfasst: false,          // Alt-Bestand (Übernahme Vorverwalter / später KI)
    demo: false,
  }, init || {});
}

// ═══ ETV-Welt (ETV_Konzept_AllesDa_11_07_2026_03, Entscheidungs-Session) ════
// Drei neue flache Listen an der EINEN Welt: versammlungen · tops ·
// anwesenheiten. Jede Liste = künftige Supabase-Tabelle. Die ETV ist der
// Knotenpunkt zwischen Vorgängen (naechste_etv-Filter) und Beschlüssen.

// Zwei getrennte Achsen (§2.1): das WAS (versammlung_art) und das WIE (art).
// Umlaufbeschluss = dieselbe Mechanik, nur schriftlich abgestimmt (Benny 12.07.).
const ETV_ARTEN = [
  { id: "ordentlich",       label: "Ordentliche ETV" },
  { id: "ausserordentlich", label: "Außerordentliche ETV" },
  { id: "umlauf",           label: "Umlaufbeschluss" },
];
// Durchführungsart (§2.10 Ausbau-Konzept): rein "online"/virtuell ist rechtlich
// ein Sonderfall (¾-Vorratsbeschluss + Präsenzpflicht bis 2028), darum NICHT
// wählbar — bleibt sichtbar aber disabled mit korrektem Zukunfts-Hinweis
// (möglich seit 2024, ohne Präsenzpflicht erst ab 2029). Hybrid nur wählbar,
// wenn am Objekt die Zuschaltung am Ort möglich ist (etvStamm.onlineMoeglich).
const ETV_DURCHFUEHRUNG = [
  { id: "praesenz", label: "Präsenz" },
  { id: "hybrid",   label: "Hybrid" },
  { id: "online",   label: "Online", disabled: true,
    hinweis: "ab 2029 uneingeschränkt möglich" },
];
// Phasen-Kette (§2b Tab 1) — Fortschritt der Versammlung, wie die
// Vorgang-PhasenLeiste. Umlauf nutzt dieselbe Kette (eingeladen = versandt).
const ETV_STATUS_KETTE = ["geplant", "eingeladen", "laeuft", "protokolliert", "abgeschlossen"];
const ETV_STATUS_LABEL = {
  geplant: "Geplant", eingeladen: "Eingeladen", laeuft: "Läuft",
  protokolliert: "Protokolliert", abgeschlossen: "Abgeschlossen",
};

function neueVersammlung(init) {
  return Object.assign({
    id: vgId("etv"),
    objekt_id: null,
    versammlung_art: "ordentlich",  // ordentlich | ausserordentlich | umlauf (das WAS)
    art: "praesenz",                // praesenz | hybrid | online (das WIE)
    datum: null,                    // ISO
    uhrzeit: "",
    ort: "",
    ladung_versendet_am: null,      // Fristnachweis (3-Wochen-Ladungsfrist)
    status: "geplant",
    archiviert: false,              // abgeschlossene ETVs → Archiv (§8.10)
    stimmprinzip: "MEA",            // aus ve.etvStamm.abstimmung gespiegelt bei Anlage
    wirtschaftsjahr: "",            // aus ve.etvStamm gespiegelt bei Anlage
    leiter_kontakt_id: null,
    protokollfuehrer_kontakt_id: null,
    beirat_vorsitz_kontakt_id: null,   // Verwaltungsbeirat (Ausbau-Konzept §2.2, 12.07.)
    beirat_mitglied_kontakt_ids: [],   // weitere Beiratsmitglieder
    // Protokoll-Pflichtangaben (§24 WEG, Ausbau-Konzept §3, 12.07.):
    protokoll_beginn: "",              // tatsächlicher Beginn (Uhrzeit, kann vom Plan abweichen)
    protokoll_ende: "",                // tatsächliches Ende
    einladung_festgestellt: false,     // Haken → Standardsatz im Protokoll
    unterschrift_eigentuemer_kontakt_id: null,  // WER von den Eigentümern unterschreibt
    unterschrift_leiter_am: null,      // optionale digitale Erfassung (wer steht fest: Leiter)
    unterschrift_eigentuemer_am: null,
    unterschrift_beirat_am: null,      // Beiratsvorsitz (nur relevant wenn Beirat besteht)
    // Versammlungs-Anlagen (Ausbau-Konzept §4.6, 13.07.): Anhänge fürs Protokoll,
    // gleiche Referenz-Struktur wie TOP-Anlagen — {id, titel, quelle, refId, dateiRef}.
    anlagen: [],
    // Unterlagen (Druck&Ablage-Konzept 19.07. §4.1): erzeugte PDFs — der
    // „ETV-Ordner". {id, art: einladung|tagesordnung|protokoll|anlage,
    // titel, dateiRef, erzeugt_am, hinweis}. Erzeugen legt IMMER ab,
    // nichts wird überschrieben (jeder Stand dokumentiert).
    unterlagen: [],
    einladung_absender: "",         // Briefkopf-Freitext, wird gemerkt (§6 Vorstufe)
    demo: false,
  }, init || {});
}

// TOP (§2.2 + §2b Tab 2): wächst per Baustein-Katalog wie ein Vorgang.
// bausteine[] steuert, welche Blöcke sichtbar sind (wortlaut | anlage |
// abstimmung | aufgabe | notiz) — Inhalt liegt in den Feldern daneben.
// Aufgaben sind hier eine schlanke TOP-Checkliste (KEINE Vorgangs-Aufgaben:
// die hängen eisern an beteiligung_id — ETV hat keine Beteiligten-Struktur).
function neuerTop(init) {
  return Object.assign({
    id: vgId("top"),
    versammlung_id: null,
    nummer: 0,                      // Anzeige-Nummer, folgt reihenfolge
    titel: "",
    text: "",
    beschluss_noetig: false,
    mehrheitstyp: "einfach",        // "einfach" | "qualifiziert_16" | "doppelt_21"
                                    // (Abstimm-Cockpit-Konzept 14.07. §3.1) — wird in
                                    // der VORBEREITUNG gewählt (§23 II WEG), steuert
                                    // die Schwellenprüfung bei der Auszählung.
    beschluss_id: null,             // FK → beschluss (null bis gefasst)
    vorgang_id: null,               // Quelle 2: aus Vorgang (naechste_etv) entstanden
    quelle: "frei",                 // standard | vorgang | frei
    reihenfolge: 0,
    bausteine: [],                  // sichtbare Blöcke (Katalog-IDs)
    wortlaut: "",                   // Baustein Beschlussvorlage/Wortlaut
    anlagen: [],                    // Baustein Anlage (§4, 13.07.): [{id,titel,quelle:"dokument"|"foto",refId,dateiRef}] — jede Anlage braucht eine Datei
    go_beschluss: false,            // Geschäftsordnung → KEINE lfd_nummer, nicht in die Sammlung
    vertagt: false,                 // Ausgang „vertagt" (gelb) — kein Beschluss, keine Nummer
    vertagt_nach_id: null,          // FK auf den Folge-TOP in der nächsten ETV (freie TOPs)
    aufgaben: [],                   // Baustein Aufgabe: [{id,text,erledigt}]
    notiz: "",                      // Baustein Notiz (EINE freie Notiz, Vorgang-Muster)
    demo: false,
  }, init || {});
}

// Anwesenheit (§2.4, umgeschnitten 12.07. — Ausbau-Konzept §1): EINE Zeile pro
// EINHEIT (ein Stimmrecht pro Einheit, egal wie viele Eigentümer — Ehepaar wie
// Erbengemeinschaft). Die Quoten-Aufteilung (§62.5) wirkt hier NICHT mehr; sie
// bleibt Grundbuch-Doku am Objekt. stimmgewicht folgt dem Stimmprinzip der
// Versammlung (Objekt=1 | MEA=einheit.mea | Kopf=1). Vertretung strukturiert
// (WER + optional Verwalter-Vollmacht + Weisungen je TOP, §25 III WEG —
// Weisungen sind DOKU fürs Protokoll, KEINE Auto-Auszählung: Weg A).
function neueAnwesenheit(init) {
  const i = init || {};
  // Alt-Format-Hebung (vor 13.75: eine Zeile pro Person, anwesend:bool,
  // name, mea quotengewichtet). Grundsatz "keine Altlasten": in der Fabrik
  // heben, Alt-Felder danach streichen.
  const heb = {};
  if (i.status === undefined && (i.anwesend !== undefined || i.vertreten_durch)) {
    heb.status = i.anwesend ? "anwesend" : (i.vertreten_durch ? "vertreten" : "abwesend");
  }
  if (i.eigentuemer_namen === undefined && i.name !== undefined) heb.eigentuemer_namen = i.name;
  if (i.stimmgewicht === undefined && i.mea !== undefined) heb.stimmgewicht = i.mea;
  if (i.eigentuemer_kontakt_ids === undefined && i.kontakt_id != null) {
    heb.eigentuemer_kontakt_ids = [i.kontakt_id];
  }
  const out = Object.assign({
    id: vgId("anw"),
    versammlung_id: null,
    einheit_id: null,
    einheit_nr: "",
    eigentuemer_namen: "",          // ALLE Eigentümer der Einheit (Anzeige, ein String)
    eigentuemer_kontakt_ids: [],    // Referenzen (für Kontaktkarten, Block 2)
    stimmgewicht: 0,                // nach Prinzip: Objekt=1 | MEA=einheit.mea | Kopf=1
    mea_einheit: 0,                 // ECHTES MEA der Einheit, UNABHÄNGIG vom Prinzip
                                    // (Cockpit 14.07.: MEA-Spur der Auszählung braucht
                                    // das reale MEA auch bei Kopf-/Objektprinzip)
    status: "abwesend",             // abwesend | anwesend | vertreten (ersetzt bool)
    vertreten_durch: "",            // Anzeige-Name des Vertreters (Freitext)
    vertreten_durch_kontakt_id: null, // strukturierte Vertretung (optional)
    ist_verwaltervollmacht: false,  // Kennzeichen (rechtlich relevant, §25 III WEG)
    weisungen: {},                  // { [topId]: "ja"|"nein"|"enthaltung" } — Doku (Weg A)
    zugang: "praesenz",             // praesenz | link | login | schriftlich (Umlauf)
    demo: false,
  }, i, heb);
  delete out.anwesend; delete out.name; delete out.mea; delete out.kontakt_id;
  return out;
}

// ── ETV-Baustein-Katalog (§2b Tab 2, Entscheidung 3b: die fünf) ────────────
const TOP_BAUSTEINE = [
  { id: "wortlaut",   label: "Beschlussvorlage / Wortlaut" },
  { id: "anlage",     label: "Anlage" },
  { id: "abstimmung", label: "Abstimmung" },
  { id: "aufgabe",    label: "Aufgabe" },
  { id: "notiz",      label: "Notiz" },
];

// ── ETV-Helfer (alles ERRECHNET, nichts doppelt gespeichert) ────────────────
// Ladungsfrist-Ampel (§2b Tab 1): mind. 3 Wochen zwischen Ladung und Termin
// (§24 IV WEG). gruen = gewahrt · gelb = noch nicht versendet, aber noch
// möglich · rot = verletzt/nicht mehr möglich · null = kein Termin.
function ladungsfristInfo(versammlung, heute) {
  const jetzt = heute || isoHeute();
  if (!versammlung || !versammlung.datum) return { status: null, text: "" };
  const termin = new Date(versammlung.datum + "T00:00:00");
  const MIN_TAGE = 21;
  if (versammlung.ladung_versendet_am) {
    const versandt = new Date(versammlung.ladung_versendet_am + "T00:00:00");
    const abstand = Math.round((termin - versandt) / 86400000);
    return abstand >= MIN_TAGE
      ? { status: "gruen", text: "Ladungsfrist gewahrt (" + abstand + " Tage)" }
      : { status: "rot", text: "Ladungsfrist verletzt (nur " + abstand + " Tage)" };
  }
  const rest = Math.round((termin - new Date(jetzt + "T00:00:00")) / 86400000);
  if (rest >= MIN_TAGE) return { status: "gelb",
    text: "Einladung offen — spätestens in " + (rest - MIN_TAGE) + " Tagen versenden" };
  if (rest >= 0) return { status: "rot",
    text: "Einladung offen — 3-Wochen-Frist nicht mehr einhaltbar" };
  return { status: null, text: "" };
}

// Einladungs-Stichtag (§2.9 Ausbau-Konzept): spätester Tag, an dem die Ladung
// raus muss, damit die 3-Wochen-Frist gewahrt ist = Termin − 21 Tage.
function einladungsStichtag(datumIso) {
  if (!datumIso) return null;
  const d = new Date(datumIso + "T00:00:00");
  d.setDate(d.getDate() - 21);
  return d.toISOString().slice(0, 10);
}

// Sammel-Leser der ETV-Stammdaten am Objekt (§2.7 Ausbau-Konzept): fasst die an
// mehreren Stellen verstreuten Werte (ve.etvStamm gespiegelt + verwaltungsKarten
// kategorie "etv" + ve.verwaltung) an EINER Stelle zusammen. Alle Werte sind
// Vorbelegungs-VORSCHLÄGE für neue Versammlungen.
function etvStammVomObjekt(ve) {
  const stamm = (ve && ve.etvStamm) || {};
  const vk = (ve && Array.isArray(ve.verwaltungsKarten)) ? ve.verwaltungsKarten : [];
  const etvK = vk.find((k) => k && k.kategorie === "etv");
  const feld = (name) => {
    if (!etvK || !Array.isArray(etvK.stamm)) return null;
    const f = etvK.stamm.find((x) => x && x.name === name);
    return f || null;
  };
  const ortFeld = feld("Versammlungsort");
  const onlineFeld = feld("ETV online möglich?");
  const letzteFeld = feld("Letzte ETV");
  const naechsteFeld = feld("Nächste ETV");
  return {
    abstimmung: stamm.abstimmung || "MEA",
    gesamtanteile: stamm.gesamtanteile || "1000",
    wirtschaftsjahr: stamm.wirtschaftsjahr || "Kalenderjahr",
    // Versammlungsort ist ein Kontakte-Feld — Vorbelegung als Freitext (Name);
    // Kontakt-Referenz bleibt für später (Leitstand-Kontaktkarte §2.8).
    versammlungsort: (ortFeld && ortFeld.value) || "",
    versammlungsort_kontaktIds: (ortFeld && ortFeld.kontaktIds) || [],
    // Hybrid nur möglich, wenn Zuschaltung am Ort vorhanden (nicht "rein virtuell").
    hybridMoeglich: !!(onlineFeld && onlineFeld.value === "Ja"),
    letzteEtv: (letzteFeld && letzteFeld.value) || "",
    naechsteEtv: (naechsteFeld && naechsteFeld.value)
      || (ve && ve.verwaltung && ve.verwaltung.naechsteETV) || "",
  };
}

// Die offene ordentliche ETV eines Objekts (§2.3): die noch nicht abgeschlossene
// ordentliche Versammlung, deren Termin offen ODER in der Zukunft liegt. Sie ist
// die "leere Hülle" / Sammelstelle. Gibt es keine → null (dann muss eine
// erzeugt werden, siehe garantiereOffeneEtv).
function offeneOrdentlicheEtv(welt, objektId, heute) {
  const jetzt = heute || isoHeute();
  const kandidaten = (welt.versammlungen || []).filter((v) =>
    v && v.objekt_id === objektId && v.versammlung_art === "ordentlich"
    && !v.archiviert && v.status !== "abgeschlossen"
    && (!v.datum || v.datum >= jetzt));
  if (kandidaten.length === 0) return null;
  // die früheste offene (kleinstes Datum; datumslose zuletzt)
  return kandidaten.sort((a, b) =>
    String(a.datum || "9999").localeCompare(String(b.datum || "9999")))[0];
}

// Garantiert, dass eine offene ordentliche ETV existiert (§2.3/2.6). Gibt die
// (ggf. neu erzeugte) Welt zurück PLUS ein Flag, ob etwas erzeugt wurde.
// Idempotent: erzeugt nur, wenn KEINE offene ordentliche existiert. Funktioniert
// AUCH ohne jede Historie (Erst-ETV eines frischen Objekts, §2.3b).
function garantiereOffeneEtv(welt, ve, heute) {
  const w = welt || {};
  if (!ve || ve.id == null) return { welt: w, erzeugt: false };
  if (offeneOrdentlicheEtv(w, ve.id, heute)) return { welt: w, erzeugt: false };
  const s = etvStammVomObjekt(ve);
  const huelle = neueVersammlung({
    objekt_id: ve.id,
    versammlung_art: "ordentlich",
    datum: null,                    // Termin offen — die Hülle lebt trotzdem
    status: "geplant",
    art: "praesenz",
    stimmprinzip: s.abstimmung,
    wirtschaftsjahr: s.wirtschaftsjahr,
    ort: s.versammlungsort || "",
  });
  return {
    welt: Object.assign({}, w, { versammlungen: [...(w.versammlungen || []), huelle] }),
    erzeugt: true,
  };
}

// Sichtklasse einer Versammlung (§2.5 Ausbau-Konzept, abgeleitet — kein Trigger,
// kein Jahres-Umschreiben). Rollierung entsteht rein aus Status + Datums-Jahr:
//   "aktiv"    — noch nicht abgeschlossen (in Arbeit) ODER manuell aus Archiv geholt
//   "nachschau"— abgeschlossen, Datum im Vorjahr oder aktuellen Jahr (zum Nachlesen)
//   "archiv"   — abgeschlossen & älter als Vorjahr, ODER manuell ins Archiv gelegt
// Am Jahreswechsel rutscht eine "nachschau"-ETV von selbst nach "archiv", weil ihr
// Jahr aus dem Fenster fällt — ohne dass Code etwas ändert.
function etvSichtklasse(versammlung, heute) {
  if (!versammlung) return "aktiv";
  if (versammlung.archiviert) return "archiv";           // manuell übersteuert
  if (versammlung.status !== "abgeschlossen") return "aktiv";
  const jahrHeute = Number((heute || isoHeute()).slice(0, 4));
  const jahrV = versammlung.datum ? Number(String(versammlung.datum).slice(0, 4)) : jahrHeute;
  return (jahrV >= jahrHeute - 1) ? "nachschau" : "archiv";
}

// Anfechtungsfrist: 1 Monat ab Beschlussfassung (§45 WEG).
function anfechtungsfristBis(gefasstAmIso) {
  if (!gefasstAmIso) return null;
  const d = new Date(gefasstAmIso + "T00:00:00");
  d.setMonth(d.getMonth() + 1);
  return d.toISOString().slice(0, 10);
}

// ═══ Beschluss-Sammlung (§24 VII/VIII WEG — Konzept 13.07.2026) ═════════════
// Die Sammlung ist eine SICHT auf beschluesse (mit lfd_nummer) + die neue
// Liste gerichtsentscheidungen — EIN gemeinsamer, fortlaufender Nummernkreis.

// Gerichtsentscheidung (§43 WEG): NUR die Urteilsformel mit Datum/Gericht/
// Parteien (Pflichtinhalt §24 VII Nr. 3) — kein Urteils-Volltext.
function neueGerichtsentscheidung(init) {
  return Object.assign({
    id: vgId("ger"),
    objekt_id: null,
    lfd_nummer: null,            // gleicher Nummernkreis wie Beschlüsse
    urteilsformel: "",
    gericht: "",
    datum: null,                 // Datum der Entscheidung (ISO)
    parteien: "",
    vermerke: [],                // z. B. Rechtsmittel anhängig / rechtskräftig
    demo: false,
  }, init || {});
}

// Nächste fortlaufende Nummer eines Objekts: max über BEIDE Quellen + 1.
// Nummern werden NIE neu vergeben — gelöschte/lückige Nummern bleiben Lücken.
function naechsteLfdNummer(welt, objektId) {
  let max = 0;
  (welt.beschluesse || []).forEach((b) => {
    if (b && b.objekt_id === objektId && Number(b.lfd_nummer) > max) max = Number(b.lfd_nummer);
  });
  (welt.gerichtsentscheidungen || []).forEach((g) => {
    if (g && g.objekt_id === objektId && Number(g.lfd_nummer) > max) max = Number(g.lfd_nummer);
  });
  return max + 1;
}

// Sammlungs-Status: BERECHNET aus ergebnis + Anfechtungsfrist + Vermerken
// (kein gepflegtes Feld). Vermerke schlagen alles.
function sammlungsStatus(beschluss, heute) {
  if (!beschluss) return "gefasst";
  const v = Array.isArray(beschluss.vermerke) ? beschluss.vermerke : [];
  if (v.some((x) => x && x.typ === "aufgehoben")) return "aufgehoben";
  if (v.some((x) => x && x.typ === "bedeutungslos")) return "bedeutungslos";
  if (v.some((x) => x && x.typ === "angefochten")) return "angefochten";
  if (beschluss.ergebnis === "abgelehnt") return "abgelehnt";
  const h = heute || isoHeute();
  if (beschluss.anfechtungsfrist_bis && beschluss.anfechtungsfrist_bis < h) return "bestandskraeftig";
  return "gefasst";
}
const SAMMLUNG_STATUS_LABEL = {
  gefasst: "gefasst (Frist läuft)", bestandskraeftig: "bestandskräftig",
  abgelehnt: "abgelehnt", angefochten: "angefochten",
  aufgehoben: "aufgehoben", bedeutungslos: "gegenstandslos",
};

// Die Sammlung eines Objekts: Beschlüsse MIT Nummer + Gerichtsentscheidungen,
// chronologisch nach lfd_nummer. Einträge ohne Nummer (GO/alt-offen) fehlen —
// die Sammlung zeigt nur Nummeriertes (§24 VII S. 3).
function sammlungFuerObjekt(welt, objektId) {
  const eintraege = [];
  (welt.beschluesse || []).forEach((b) => {
    if (b && b.objekt_id === objektId && b.lfd_nummer != null)
      eintraege.push({ art: "beschluss", nr: Number(b.lfd_nummer), obj: b });
  });
  (welt.gerichtsentscheidungen || []).forEach((g) => {
    if (g && g.objekt_id === objektId && g.lfd_nummer != null)
      eintraege.push({ art: "urteil", nr: Number(g.lfd_nummer), obj: g });
  });
  return eintraege.sort((a, b) => a.nr - b.nr);
}

// Ort + Datum eines Sammlungs-Beschlusses: aus der Versammlung abgeleitet;
// Alt-Beschlüsse (ohne versammlung_id) tragen eigene Fallback-Felder.
function beschlussOrtDatum(welt, beschluss) {
  const v = beschluss.versammlung_id
    ? (welt.versammlungen || []).find((x) => x && x.id === beschluss.versammlung_id) : null;
  return {
    ort: (v && v.ort) || beschluss.ort || "",
    datum: (v && v.datum) || beschluss.gefasst_am || beschluss.datum || "",
    versammlung_art: (v && v.versammlung_art) || (beschluss.alt_erfasst ? "" : "ordentlich"),
  };
}

// ── Sammlungs-Mutationen ─────────────────────────────────────────────────────
// Vermerk: additiv, mit Datum (§24 VII S. 7 — unverzüglich + datiert).
function weltBeschlussVermerk(welt, beschlussId, vermerk) {
  const b = (welt.beschluesse || []).find((x) => x && x.id === beschlussId);
  if (!b) return welt;
  const v = Object.assign({ datum: isoHeute(), typ: "frei", text: "" }, vermerk || {});
  return weltBeschlussPatch(welt, beschlussId,
    { vermerke: [...(Array.isArray(b.vermerke) ? b.vermerke : []), v] });
}
// Alt-Beschluss (Übernahme Vorverwalter): Nummer frei — Automatik zählt ab Max weiter.
function weltBeschlussAltNeu(welt, init) {
  const b = neuerBeschluss(Object.assign({ alt_erfasst: true, status: "gefasst",
    ergebnis: "angenommen" }, init || {}));
  return Object.assign({}, welt, { beschluesse: [...(welt.beschluesse || []), b] });
}
function weltGerichtsentscheidungNeu(welt, init) {
  const g = neueGerichtsentscheidung(init || {});
  return Object.assign({}, welt,
    { gerichtsentscheidungen: [...(welt.gerichtsentscheidungen || []), g] });
}
function weltGerichtsentscheidungVermerk(welt, gerId, vermerk) {
  const g = (welt.gerichtsentscheidungen || []).find((x) => x && x.id === gerId);
  if (!g) return welt;
  const v = Object.assign({ datum: isoHeute(), typ: "frei", text: "" }, vermerk || {});
  return Object.assign({}, welt, {
    gerichtsentscheidungen: _ersetzeEtvIn(welt.gerichtsentscheidungen, gerId,
      { vermerke: [...(Array.isArray(g.vermerke) ? g.vermerke : []), v] }),
  });
}

// Vertagen (gelb, Konzept §5.2): KEIN Beschluss, KEINE Nummer. Vorgangs-TOP →
// Vorgang zurück in den Wartekorb (bestehender Kreislauf §2.4); freier TOP →
// Kopie in der offenen nächsten ETV (Auto-Hülle wird bei Bedarf erzeugt).
function weltTopVertagen(welt, topId, ve, heute) {
  const tp = (welt.tops || []).find((x) => x && x.id === topId);
  if (!tp || tp.beschluss_id) return welt;   // schon beschlossen → nicht vertagbar
  let neu = Object.assign({}, welt, {
    tops: _ersetzeEtvIn(welt.tops, tp.id, { vertagt: true }) });
  if (tp.vorgang_id) {
    // Wartekorb ist die Wahrheit — der Vorgang taucht als Kandidat der
    // nächsten ETV auf (Quelle 2 im TOP-Picker).
    return weltVorgangAufTagesordnung(neu, tp.vorgang_id);
  }
  // Freier/Standard-TOP: Kopie in die garantierte offene Hülle.
  const g = garantiereOffeneEtv(neu, ve, heute);
  neu = g.welt;
  const ziel = offeneOrdentlicheEtv(neu, ve && ve.id, heute);
  if (!ziel || ziel.id === tp.versammlung_id) return neu;   // Schutz: nie in dieselbe
  const maxRf = (neu.tops || []).filter((x) => x && x.versammlung_id === ziel.id)
    .reduce((m, x) => Math.max(m, x.reihenfolge || 0), 0);
  const kopie = neuerTop({
    versammlung_id: ziel.id,
    nummer: 0, reihenfolge: maxRf + 1,
    titel: tp.titel, text: tp.text,
    beschluss_noetig: tp.beschluss_noetig,
    quelle: tp.quelle, wortlaut: tp.wortlaut,
    bausteine: (tp.bausteine || []).slice(),
    anlagen: (tp.anlagen || []).map((a) => Object.assign({}, a)),   // Referenzen, keine Datei-Kopien
    go_beschluss: !!tp.go_beschluss,
  });
  return Object.assign({}, neu, {
    tops: [
      ...(neu.tops || []).map((x) =>
        (x && x.id === tp.id) ? Object.assign({}, x, { vertagt_nach_id: kopie.id }) : x),
      kopie,
    ],
  });
}

function versammlungenFuerObjekt(welt, objektId) {
  return (welt.versammlungen || []).filter((v) => v.objekt_id === objektId);
}
function topsFuerVersammlung(welt, versammlungId) {
  return (welt.tops || []).filter((tp) => tp.versammlung_id === versammlungId)
    .sort((a, b) => (a.reihenfolge || 0) - (b.reihenfolge || 0));
}
function anwesenheitenFuer(welt, versammlungId) {
  return (welt.anwesenheiten || []).filter((a) => a.versammlung_id === versammlungId);
}
// Beschlussfähigkeit (§2b Tab 1): Summe anwesender/vertretener MEA.
// Seit WEMoG ist jede Versammlung beschlussfähig — die Zahl bleibt trotzdem
// die zentrale Orientierung im Raum ("anwesend 612/1000 MEA").
function beschlussfaehigkeitInfo(anwesenheiten, gesamtanteile, stimmprinzip) {
  const da = anwesenheiten.filter((a) => a.status === "anwesend" || a.status === "vertreten");
  const summe = Math.round(da.reduce((s, a) => s + (Number(a.stimmgewicht) || 0), 0) * 1000) / 1000;
  const prinzip = stimmprinzip || "MEA";
  if (prinzip === "MEA") {
    const gesamt = Number(String(gesamtanteile || "1000").replace(",", ".")) || 1000;
    return { summe, gesamt, zeilen: da.length,
      text: "anwesend/vertreten " + String(summe).replace(".", ",") + " / "
        + String(gesamt).replace(".", ",") + " MEA (" + da.length + " Einheiten)" };
  }
  // Objekt-/Kopfprinzip: 1 Stimme je Einheit → Zählung über die Zeilen.
  const gesamt = anwesenheiten.length;
  return { summe, gesamt, zeilen: da.length,
    text: "anwesend/vertreten " + da.length + " / " + gesamt + " Einheiten (je 1 Stimme)" };
}

// EIN prominenter nächster Schritt je Phase (Vorgang-Kopf-Muster §5).
function etvNaechsterSchritt(versammlung, tops, anwesenheiten) {
  const s = versammlung.status;
  const schritte = [];
  if (s === "geplant") {
    if (!versammlung.datum) schritte.push("Termin festlegen");
    if (tops.length === 0) schritte.push("Tagesordnung zusammenstellen");
    schritte.push(versammlung.versammlung_art === "umlauf"
      ? "Umlauf-Unterlagen versenden" : "Einladung versenden");
  } else if (s === "eingeladen") {
    schritte.push(versammlung.versammlung_art === "umlauf"
      ? "Rückläufe erfassen" : "Anwesenheit erfassen");
  } else if (s === "laeuft") {
    const offen = tops.filter((tp) => tp.beschluss_noetig && !tp.beschluss_id).length;
    if (offen > 0) schritte.push(offen + " Abstimmung" + (offen > 1 ? "en" : "") + " offen");
    schritte.push("Versammlung abschließen (Protokoll)");
  } else if (s === "protokolliert") {
    schritte.push("Protokoll versenden");
    schritte.push("Versammlung abschließen");
  } else if (s === "abgeschlossen" && !versammlung.archiviert) {
    schritte.push("Ins Archiv legen");
  }
  return schritte;
}

// ── Welt-Mutationen (rein, wie die welt*-Familie der Vorgänge) ──────────────
function weltVersammlungNeu(welt, init) {
  const v = neueVersammlung(init);
  return [Object.assign({}, welt, { versammlungen: [...(welt.versammlungen || []), v] }), v];
}
function _ersetzeEtvIn(liste, id, patch) {
  return (liste || []).map((x) => x.id === id ? Object.assign({}, x, patch) : x);
}
function weltVersammlungPatch(welt, id, patch) {
  return Object.assign({}, welt, { versammlungen: _ersetzeEtvIn(welt.versammlungen, id, patch) });
}
// Unterlagen (Druck&Ablage-Konzept 19.07. §4.1): Eintrag anhängen — der
// eine Schreibweg für den ETV-Ordner. Erzeugt IMMER einen neuen Stand.
const UNTERLAGE_ART_LABEL = { einladung: "Einladung", tagesordnung: "Tagesordnung",
  protokoll: "Protokoll", anlage: "Anlage" };
function weltVersammlungUnterlage(welt, versammlungId, eintrag) {
  const v = (welt.versammlungen || []).find((x) => x.id === versammlungId);
  if (!v || !eintrag) return welt;
  const u = Object.assign({ id: vgId("unt"), erzeugt_am: new Date().toISOString(),
    art: "anlage", titel: "Unterlage", dateiRef: null, hinweis: "" }, eintrag);
  return weltVersammlungPatch(welt, versammlungId, {
    unterlagen: [...(Array.isArray(v.unterlagen) ? v.unterlagen : []), u] });
}
// Entfernt NUR die Referenz — das Blob löscht der Rumpf (dateiLoeschen),
// analog Foto-Muster (getrennte Zuständigkeit Welt/Dateispeicher).
function weltVersammlungUnterlageWeg(welt, versammlungId, unterlageId) {
  const v = (welt.versammlungen || []).find((x) => x.id === versammlungId);
  if (!v) return welt;
  return weltVersammlungPatch(welt, versammlungId, {
    unterlagen: (Array.isArray(v.unterlagen) ? v.unterlagen : [])
      .filter((u) => u.id !== unterlageId) });
}
function weltVersammlungLoeschen(welt, id) {
  const topIds = (welt.tops || []).filter((tp) => tp.versammlung_id === id).map((tp) => tp.id);
  return Object.assign({}, welt, {
    versammlungen: (welt.versammlungen || []).filter((v) => v.id !== id),
    tops: (welt.tops || []).filter((tp) => tp.versammlung_id !== id),
    anwesenheiten: (welt.anwesenheiten || []).filter((a) => a.versammlung_id !== id),
    // Gefasste Beschlüsse BLEIBEN (Dokumentation) — nur nicht-gefasste TOP-Reste weg.
    beschluesse: (welt.beschluesse || []).filter((b) =>
      !(b.top_id && topIds.indexOf(b.top_id) >= 0 && b.status !== "gefasst"
        && b.status !== "bestandskraeftig" && b.status !== "angefochten")),
  });
}
function weltTopNeu(welt, init) {
  const vorhandene = topsFuerVersammlung(welt, init && init.versammlung_id);
  const tp = neuerTop(Object.assign({}, init, {
    reihenfolge: vorhandene.length,
    nummer: vorhandene.length + 1,
  }));
  return Object.assign({}, welt, { tops: [...(welt.tops || []), tp] });
}
function weltTopPatch(welt, id, patch) {
  return Object.assign({}, welt, { tops: _ersetzeEtvIn(welt.tops, id, patch) });
}
function weltTopLoeschen(welt, id) {
  const tp = (welt.tops || []).find((x) => x.id === id);
  let neu = Object.assign({}, welt, {
    tops: (welt.tops || []).filter((x) => x.id !== id) });
  // Kam der TOP aus einem Vorgang, geht der Vorgang zurück auf die Tagesordnung-
  // Warteliste (naechste_etv) — er wurde ja noch nicht beschlossen.
  if (tp && tp.vorgang_id && !tp.beschluss_id) {
    neu = weltVorgangAufTagesordnung(neu, tp.vorgang_id);
  }
  // Nummern nachziehen (Anzeige folgt Reihenfolge).
  return weltTopsNummerieren(neu, tp ? tp.versammlung_id : null);
}
function weltTopsNummerieren(welt, versammlungId) {
  if (!versammlungId) return welt;
  const geordnet = topsFuerVersammlung(welt, versammlungId);
  const map = {};
  geordnet.forEach((tp, i) => { map[tp.id] = { reihenfolge: i, nummer: i + 1 }; });
  return Object.assign({}, welt, {
    tops: (welt.tops || []).map((tp) => map[tp.id] ? Object.assign({}, tp, map[tp.id]) : tp),
  });
}
// Verschieben mit MODUS (Druck&Ablage-Konzept 19.07. §1): „anpassen" = Nummern
// folgen der Reihenfolge (Planung, wie bisher); „behalten" = nur die
// Behandlungsreihenfolge ändert sich, TOP 9 bleibt TOP 9 (in der Versammlung
// vorgezogen — die Eigentümer haben die Nummern schwarz auf weiß).
function weltTopVerschieben(welt, id, richtung, modus = "anpassen") {
  const tp = (welt.tops || []).find((x) => x.id === id);
  if (!tp) return welt;
  const geordnet = topsFuerVersammlung(welt, tp.versammlung_id);
  const idx = geordnet.findIndex((x) => x.id === id);
  const ziel = idx + richtung;
  if (ziel < 0 || ziel >= geordnet.length) return welt;
  const neuOrd = geordnet.slice();
  const tmp = neuOrd[idx]; neuOrd[idx] = neuOrd[ziel]; neuOrd[ziel] = tmp;
  const map = {};
  neuOrd.forEach((x, i) => {
    map[x.id] = modus === "behalten"
      ? { reihenfolge: i }
      : { reihenfolge: i, nummer: i + 1 };
  });
  return Object.assign({}, welt, {
    tops: (welt.tops || []).map((x) => map[x.id] ? Object.assign({}, x, map[x.id]) : x),
  });
}
// Abstimmung auszählen → Beschluss fassen (Kern der Präsenz-Erfassung §4.1).
// Erzeugt/aktualisiert das beschluss-Objekt, verknüpft den TOP und — Nahtstelle
// §9 — löst einen wartenden Vorgang aus (Entscheidung ist gefallen, egal wie).
// ── Abstimm-Cockpit (Konzept 14.07.): Mehrheitstypen + Rechenkern ───────────
// Rechtslage (recherchiert 14.07.): Normalfall einfache Mehrheit (§25 I WEG,
// Ja > Nein, Enthaltung zählt nicht). Zwei gesetzliche Sonderfälle mit DOPPELTER
// Schwelle — Kopf-Quote bezieht sich auf die ABGEGEBENEN Stimmen (Anwesende),
// die MEA-Schwelle auf ALLE MEA der WEG (Gesamt-Nenner! Kern-Falle §1 Konzept).
const MEHRHEITSTYPEN = [
  { id: "einfach", label: "Einfache Mehrheit", kurz: "Einfach",
    hinweis: "Ja > Nein der abgegebenen Stimmen (§25 WEG); Enthaltungen zählen nicht." },
  { id: "qualifiziert_16", label: "Qualifiziert (Kostenverteilung, §16 IV)", kurz: "Qualif. §16",
    hinweis: "3/4 der abgegebenen Stimmen UND mehr als die Hälfte ALLER MEA." },
  { id: "doppelt_21", label: "Doppelt qualifiziert (baulich, §21 II)", kurz: "Doppelt §21",
    hinweis: "2/3 der abgegebenen Stimmen UND mehr als die Hälfte ALLER MEA." },
];
// EINE Wahrheit für Live-Summe (Cockpit-UI) UND Verkündung (weltTopAbstimmen).
// zeilen = Anwesenheits-Zeilen (nur anwesend/vertreten zählen); stimmen =
// { [einheit_id]: "ja"|"nein"|"enthaltung" } — Einheiten ohne Eintrag haben
// KEINE Stimme abgegeben (zählen nirgends, auch nicht als Enthaltung).
// Enthaltung gilt als NICHT abgegeben → fällt aus dem Nenner der Kopf-Quote
// (h.M. zu §25 I WEG, Konzept §6 Nr. 2 — beim Bau abgesichert).
function berechneAbstimmung(zeilen, stimmen, optionen) {
  const o = optionen || {};
  const typ = o.mehrheitstyp || "einfach";
  const prinzip = o.stimmprinzip || "MEA";
  const gesamtMea = Number(String(o.gesamtMea == null ? "" : o.gesamtMea).replace(",", ".")) || 0;
  const s = stimmen || {};
  let jaK = 0, neinK = 0, enthK = 0, jaM = 0, neinM = 0, enthM = 0;
  (zeilen || []).forEach((a) => {
    if (!a || (a.status !== "anwesend" && a.status !== "vertreten")) return;
    const v = a.einheit_id != null ? s[a.einheit_id] : undefined;
    if (v !== "ja" && v !== "nein" && v !== "enthaltung") return;
    // MEA-Spur: echtes Einheiten-MEA; Fallback stimmgewicht (Alt-Zeilen vor 13.82,
    // dort nur bei Prinzip MEA korrekt — Demo wird ohnehin neu erzeugt).
    const mea = Number(a.mea_einheit) || Number(a.stimmgewicht) || 0;
    if (v === "ja") { jaK += 1; jaM += mea; }
    else if (v === "nein") { neinK += 1; neinM += mea; }
    else { enthK += 1; enthM += mea; }
  });
  const r3 = (x) => Math.round(x * 1000) / 1000;
  jaM = r3(jaM); neinM = r3(neinM); enthM = r3(enthM);
  const abgegebenK = jaK + neinK; // Enthaltung ≠ abgegeben (Nenner der Quoten)
  let angenommen, schwelle = null;
  if (typ === "doppelt_21" || typ === "qualifiziert_16") {
    // Ganzzahl-Vergleich statt Float: ja*3 ≥ 2*abg (2/3) bzw. ja*4 ≥ 3*abg (3/4)
    const kopfOk = abgegebenK > 0 && (typ === "doppelt_21"
      ? jaK * 3 >= abgegebenK * 2 : jaK * 4 >= abgegebenK * 3);
    const meaOk = gesamtMea > 0 && jaM > gesamtMea / 2;
    schwelle = { kopf: kopfOk, mea: meaOk };
    angenommen = kopfOk && meaOk;
  } else {
    // einfach: maßgebliche Spur nach Stimmprinzip der Versammlung
    angenommen = prinzip === "MEA" ? jaM > neinM : jaK > neinK;
  }
  return {
    ja_kopf: jaK, nein_kopf: neinK, enth_kopf: enthK,
    ja_mea: jaM, nein_mea: neinM, enth_mea: enthM,
    abgegeben_kopf: abgegebenK, gesamt_mea: gesamtMea,
    angenommen, schwelle_erreicht: schwelle,
    // Alias-Reihe (rückwärtskompatibel): die nach Prinzip maßgebliche Spur
    ja: prinzip === "MEA" ? jaM : jaK,
    nein: prinzip === "MEA" ? neinM : neinK,
    enthaltung: prinzip === "MEA" ? enthM : enthK,
  };
}

// Verkündung/Auszählung. ZWEI Eingabeformen (Cockpit-Umbau 14.07.):
// NEU:  { stimmen: {einheit_id: "ja"|...}, mehrheitstyp, gesamtMea } — App rechnet selbst.
// ALT:  { ja, nein, enthaltung } als fertige Zahlen — bleibt als Fallback
//       (Alt-Aufrufer/Bestand), einfache Mehrheit wie bisher.
function weltTopAbstimmen(welt, topId, eingabe) {
  const tp = (welt.tops || []).find((x) => x.id === topId);
  if (!tp) return welt;
  const versammlung = (welt.versammlungen || []).find((v) => v.id === tp.versammlung_id) || {};
  const e = eingabe || {};
  let ja, nein, enth, angenommen, cockpit = null;
  if (e.stimmen && typeof e.stimmen === "object") {
    const zeilen = (welt.anwesenheiten || []).filter((a) => a.versammlung_id === tp.versammlung_id);
    cockpit = berechneAbstimmung(zeilen, e.stimmen, {
      mehrheitstyp: e.mehrheitstyp || tp.mehrheitstyp || "einfach",
      stimmprinzip: versammlung.stimmprinzip,
      gesamtMea: e.gesamtMea,
    });
    ja = cockpit.ja; nein = cockpit.nein; enth = cockpit.enthaltung;
    angenommen = cockpit.angenommen;
  } else {
    ja = Number(e.ja) || 0; nein = Number(e.nein) || 0; enth = Number(e.enthaltung) || 0;
    angenommen = ja > nein; // einfache Mehrheit; Enthaltungen zählen nicht mit (§25 WEG)
  }
  const gefasstAm = versammlung.datum || isoHeute();
  // Sammlung (§24 VII): fortlaufende Nummer AUTOMATISCH bei Verkündung —
  // „unverzüglich" per Konstruktion. Auch Negativbeschlüsse (verkündet =
  // Beschluss) erhalten eine Nummer. AUSNAHMEN: GO-Beschlüsse (nie) und
  // bereits nummerierte (Nummer ist für immer stabil, Korrektur-Abstimmung
  // vergibt NICHT neu).
  const bestehend = tp.beschluss_id
    ? (welt.beschluesse || []).find((x) => x && x.id === tp.beschluss_id) : null;
  const lfd = tp.go_beschluss ? null
    : (bestehend && bestehend.lfd_nummer != null) ? bestehend.lfd_nummer
    : naechsteLfdNummer(welt, versammlung.objekt_id);
  const patch = {
    objekt_id: versammlung.objekt_id || null,
    versammlung_id: tp.versammlung_id, top_id: tp.id,
    vorgang_id: tp.vorgang_id || null,
    titel: tp.titel, wortlaut: tp.wortlaut || tp.text || "",
    abstimmung: cockpit ? {
      ja_kopf: cockpit.ja_kopf, nein_kopf: cockpit.nein_kopf, enth_kopf: cockpit.enth_kopf,
      ja_mea: cockpit.ja_mea, nein_mea: cockpit.nein_mea, enth_mea: cockpit.enth_mea,
      ja: ja, nein: nein, enthaltung: enth,
    } : { ja: ja, nein: nein, enthaltung: enth },
    stimmen: cockpit ? Object.assign({}, e.stimmen) : {},
    mehrheitstyp: cockpit ? (e.mehrheitstyp || tp.mehrheitstyp || "einfach") : "einfach",
    gesamt_mea: cockpit ? cockpit.gesamt_mea : 0,
    schwelle_erreicht: cockpit ? cockpit.schwelle_erreicht : null,
    ergebnis: angenommen ? "angenommen" : "abgelehnt",
    status: angenommen ? "gefasst" : "abgelehnt",
    gefasst_am: gefasstAm,
    anfechtungsfrist_bis: anfechtungsfristBis(gefasstAm),
    jahr: Number(String(gefasstAm).slice(0, 4)) || null,
    lfd_nummer: lfd,
  };
  let neu;
  if (tp.beschluss_id) {
    neu = Object.assign({}, welt, {
      beschluesse: _ersetzeEtvIn(welt.beschluesse, tp.beschluss_id, patch) });
  } else {
    const b = neuerBeschluss(patch);
    neu = Object.assign({}, welt, {
      beschluesse: [...(welt.beschluesse || []), b],
      tops: _ersetzeEtvIn(welt.tops, tp.id, { beschluss_id: b.id }),
    });
  }
  // Nahtstelle: der wartende Vorgang wacht auf — durch das EREIGNIS Beschluss.
  if (tp.vorgang_id) neu = weltVorgangVonTagesordnung(neu, tp.vorgang_id);
  return neu;
}
function weltBeschlussPatch(welt, id, patch) {
  return Object.assign({}, welt, { beschluesse: _ersetzeEtvIn(welt.beschluesse, id, patch) });
}
function weltAnwesenheitenSetzen(welt, versammlungId, zeilen) {
  return Object.assign({}, welt, {
    anwesenheiten: [
      ...(welt.anwesenheiten || []).filter((a) => a.versammlung_id !== versammlungId),
      ...zeilen,
    ],
  });
}

// ── §96.6 · Die Welt als Ganzes: neun flache Listen ─────────────────────────
// Ein Container-Objekt, damit App-Rumpf/Storage EINEN Handle haben. Jede Liste
// entspricht einer künftigen Supabase-Tabelle (Migration 1:1, kein Auseinander-
// ziehen von Nestern).
// ── Nummernkreise (Umbau-Feinschliff 11.07., Bennys Format) ────────────────
// Vorgang: JJMMTT + dreistellig fortlaufend PRO TAG (z. B. 260711001).
// Auftrag/Angebot: KEIN eigener Kreis — Zusatz zur Vorgangsnummer
// (260711001-A01 / 260711001-AG01), fortlaufend je Vorgang. Nummern sind
// STABILE Bezugszeichen (werden nach außen kommuniziert) → gespeichert,
// nie neu berechnet. Lose Begehungsfunde haben noch keinen Vorgang und
// darum noch keine Nummer — sie bekommen sie bei der Zuordnung.
function _tagPraefix(iso) {
  const d = String(iso || isoHeute());
  return d.slice(2, 4) + d.slice(5, 7) + d.slice(8, 10);
}
function vorgangsNummerNeu(welt, angelegtAm) {
  const praefix = _tagPraefix(angelegtAm);
  let max = 0;
  for (let i = 0; i < welt.vorgaenge.length; i++) {
    const n = welt.vorgaenge[i].nummer;
    if (n && String(n).indexOf(praefix) === 0) {
      const lauf = parseInt(String(n).slice(6), 10);
      if (!isNaN(lauf) && lauf > max) max = lauf;
    }
  }
  return praefix + String(max + 1).padStart(3, "0");
}
function _zusatzNummerNeu(liste, vorgang, kuerzel) {
  if (!vorgang || !vorgang.nummer) return null;
  const praefix = vorgang.nummer + "-" + kuerzel;
  let max = 0;
  for (let i = 0; i < liste.length; i++) {
    const n = liste[i].nummer;
    if (n && String(n).indexOf(praefix) === 0) {
      const lauf = parseInt(String(n).slice(praefix.length), 10);
      if (!isNaN(lauf) && lauf > max) max = lauf;
    }
  }
  return praefix + String(max + 1).padStart(2, "0");
}
function auftragsNummerNeu(welt, vorgangId) {
  const v = welt.vorgaenge.filter((x) => x.id === vorgangId)[0];
  return _zusatzNummerNeu(welt.auftraege, v, "A");
}
function angebotsNummerNeu(welt, vorgangId) {
  const v = welt.vorgaenge.filter((x) => x.id === vorgangId)[0];
  return _zusatzNummerNeu(welt.angebote, v, "AG");
}
// Backfill für Bestandsdaten/Seeds (App nicht produktiv → deterministisch
// nach Anlagedatum). Läuft in normalisiereVorgangsWelt — vorhandene Nummern
// gewinnen IMMER (Stabilität).
function _vergebeNummern(welt) {
  const vs = welt.vorgaenge.slice().sort((a, b) =>
    String(a.angelegt_am + a.id).localeCompare(String(b.angelegt_am + b.id)));
  for (let i = 0; i < vs.length; i++) {
    if (!vs[i].nummer) vs[i].nummer = vorgangsNummerNeu(welt, vs[i].angelegt_am);
  }
  const aufs = welt.auftraege.slice().sort((a, b) =>
    String(a.erfasst_am + a.id).localeCompare(String(b.erfasst_am + b.id)));
  for (let i = 0; i < aufs.length; i++) {
    if (!aufs[i].nummer && aufs[i].vorgang_id) {
      aufs[i].nummer = auftragsNummerNeu(welt, aufs[i].vorgang_id);
    }
  }
  const angs = welt.angebote.slice().sort((a, b) =>
    String(a.eingeholt_am + a.id).localeCompare(String(b.eingeholt_am + b.id)));
  for (let i = 0; i < angs.length; i++) {
    if (!angs[i].nummer && angs[i].vorgang_id) {
      angs[i].nummer = angebotsNummerNeu(welt, angs[i].vorgang_id);
    }
  }
  return welt;
}

function normalisiereVorgangsWelt(roh) {
  const r = roh || {};
  const norm = (liste, fabrik) =>
    (Array.isArray(liste) ? liste : []).map((x) => fabrik(x || {}));
  const _migKat = (v) => ALT_KATEGORIE[v.kategorie]
    ? Object.assign({}, v, { kategorie: ALT_KATEGORIE[v.kategorie] }) : v;
  return _vergebeNummern({
    vorgaenge:     norm(r.vorgaenge, neuerVorgang).map(_migKat),
    beteiligungen: norm(r.beteiligungen, neueBeteiligung),
    nachrichten:   norm(r.nachrichten, neueNachricht),
    angebote:      norm(r.angebote, neuesAngebot),
    auftraege:     norm(r.auftraege, neuerAuftrag),
    abnahmen:      norm(r.abnahmen, neueAbnahme),
    rechnungen:    norm(r.rechnungen, neueRechnung),
    aufgaben:      norm(r.aufgaben, neueAufgabe),
    beschluesse:   norm(r.beschluesse, neuerBeschluss),
    gerichtsentscheidungen: norm(r.gerichtsentscheidungen, neueGerichtsentscheidung),
    // ETV-Welt (Konzept _03): drei weitere flache Listen an derselben Welt.
    versammlungen: norm(r.versammlungen, neueVersammlung),
    tops:          norm(r.tops, neuerTop),
    anwesenheiten: norm(r.anwesenheiten, neueAnwesenheit),
  });
}
function leereVorgangsWelt() { return normalisiereVorgangsWelt(null); }

// ── §96.7 · Hinweise (errechnet, Spec §8) + Handlungs-Ampel (Spec §8.1) ─────
// SPEICHERT NICHTS. Hinweise sind selbstheilend (Abnahme erledigt → Hinweis
// verschwindet von allein). Die Ampel ist der max-Rang über alle Fäden eines
// Vorgangs — EINE Funktion, die überall dasselbe zeigt (Listen-Punkt, Karten-
// Rand, Schreibtisch-Bündelung). Farbwerte sind UI-Sache (constants.js beim
// UI-Bau); hier nur semantische Stufen.
//
// Die Skala (Ball-liegt-bei-mir, aufsteigend):
//   grau(1)  ruht berechtigt — Ball liegt NICHT bei mir (Boden der Skala)
//   gruen(2) läuft — dabei, aber nichts gefordert
//   blau(3)  offener Entwurf (erfasst) — bei mir, ohne Zeitdruck
//   gelb(4)  Handlung fällig — bei mir, angestoßen
//   rot(5)   überfällig / Frist verpasst — bei mir, dringend
// Grün schlägt Grau (sobald IRGENDEIN Faden läuft, ruht der Vorgang nicht),
// Blau schlägt Grün („offener Faden" ist informativer als „läuft").
const AMPEL_RANG = { grau: 1, gruen: 2, blau: 3, gelb: 4, rot: 5 };
const AMPEL_REIHE = ["grau", "gruen", "blau", "gelb", "rot"];
function ampelAusRang(rang) {
  return AMPEL_REIHE[Math.max(1, Math.min(5, rang)) - 1];
}

// Alle Hinweise (Handlungsbedarf) eines Vorgangs. Jeder Hinweis trägt seinen
// Ampel-Rang; ampelFarbe() nimmt darüber das Maximum („dringlichste gewinnt").
// welt = Ergebnis von normalisiereVorgangsWelt, heute = ISO-String (Test-Injektion).
function hinweiseFuerVorgang(vorgang, welt, heute) {
  const H = [];
  if (!vorgang || !welt) return H;
  const jetzt = heute || isoHeute();
  const dazu = (rang, typ, text, bezug) => H.push({
    rang: rang, farbe: ampelAusRang(rang), typ: typ, text: text,
    vorgang_id: vorgang.id, bezug: bezug || null,
  });

  // Geschlossen = keine Handlung (Gewährleistungs-Reaktivierung ist ein
  // manueller Schritt, kein automatischer Hinweis — Leitentscheid Spec §7).
  if (vorgang.status === "geschlossen") return H;

  const auftraege = welt.auftraege.filter((a) => a.vorgang_id === vorgang.id);
  const angebote = welt.angebote.filter((a) => a.vorgang_id === vorgang.id);
  const rechnungen = welt.rechnungen.filter((r) => r.vorgang_id === vorgang.id);
  const aufgabenOffen = welt.aufgaben.filter(
    (a) => a.vorgang_id === vorgang.id && a.status === "offen");

  const ruhtBisDatum = !!vorgang.ruht_bis && vorgang.ruht_bis > jetzt;
  const ruhtBisBeschluss = !!vorgang.wartet_auf_beschluss_id;

  // 🔴/🟡 Aufgaben: an MICH (Fallführer-Beteiligung) = Handlung fällig; Frist
  // verpasst = rot (gilt auch für delegierte — verpasste Frist ist mein Problem).
  for (let i = 0; i < aufgabenOffen.length; i++) {
    const a = aufgabenOffen[i];
    const bet = welt.beteiligungen.filter((b) => b.id === a.beteiligung_id)[0] || null;
    const anMich = !!bet && bet.rolle === "fallfuehrer";
    if (a.frist && a.frist < jetzt) {
      dazu(5, "aufgabe_ueberfaellig",
        "Frist überschritten: " + (a.titel || "Aufgabe"),
        { typ: "aufgabe", id: a.id });
    } else if (anMich) {
      dazu(4, "aufgabe_offen", a.titel || "Aufgabe offen",
        { typ: "aufgabe", id: a.id });
    }
    // Delegierte Aufgabe innerhalb der Frist = Grün-Faden („warte auf jemanden")
    // — kein Hinweis, fließt unten in ampelFarbe() ein.
  }

  // 🟡 Abnahme fällig: Auftrag fertiggemeldet + DIESER Auftrag verlangt
  // Abnahme (§6b: Schalter pro Auftrag, Kategorie nur Default) + noch keine
  // angenommene Abnahme. (Fertigmeldung = Behauptung der Firma; die Prüfung
  // ist MEINE Handlung.)
  for (let i = 0; i < auftraege.length; i++) {
    const a = auftraege[i];
    if (a.status !== "fertiggemeldet") continue;
    if (!auftragBrauchtAbnahme(a, vorgang.kategorie)) {
      // Pflege/Kleinauftrag: kein Abnahme-Objekt — Abhaken (auf „abgenommen"
      // setzen) ist trotzdem meine Handlung, das Foto ist der Nachweis.
      dazu(4, "erledigung_pruefen",
        "Fertig gemeldet — abhaken: " + (a.beschreibung || "Auftrag"),
        { typ: "auftrag", id: a.id });
      continue;
    }
    const abgenommen = welt.abnahmen.filter(
      (ab) => ab.auftrag_id === a.id && ab.ergebnis === "angenommen").length > 0;
    if (!abgenommen) {
      dazu(4, "abnahme_faellig",
        "Abnahme fällig: " + (a.beschreibung || "Auftrag"),
        { typ: "auftrag", id: a.id });
    }
  }

  // 🔴 Auftrags-Frist verpasst (Auftrag läuft, Zieldatum überschritten).
  // 🟡 Nachfass-Vorlauf (§4.3, INNEN): frist − Vorlauf erreicht, frist selbst
  // noch nicht — „schaue selbst nochmal nach", die Firma sieht davon nichts.
  for (let i = 0; i < auftraege.length; i++) {
    const a = auftraege[i];
    if (auftragLaeuft(a) && a.frist && a.frist < jetzt) {
      dazu(5, "auftrag_ueberfaellig",
        "Auftrag überfällig: " + (a.beschreibung || "Auftrag"),
        { typ: "auftrag", id: a.id });
    } else if (auftragLaeuft(a) && a.nachfass_ab && a.nachfass_ab <= jetzt
        && (!a.frist || a.frist >= jetzt)) {
      dazu(4, "nachfassen",
        "Nachfassen: " + (a.beschreibung || "Auftrag")
          + (a.frist ? " (bis " + a.frist + ")" : ""),
        { typ: "auftrag", id: a.id });
    }
  }

  // 🟡 Versicherungsfall (A1): solange die Schadenmeldung nicht raus ist,
  // mahnt die Ampel — der teuerste vergessene Handgriff.
  if (vorgang.versicherung && !vorgang.versicherung.gemeldet_am) {
    dazu(4, "versicherung_meldung",
      "Schadenmeldung an Versicherung offen",
      { typ: "vorgang", id: vorgang.id });
  }

  // 🟡 Angebot überfällig (§4.3): angefragt (kein Preis), Abgabefrist vorbei.
  for (let i = 0; i < angebote.length; i++) {
    const g = angebote[i];
    if (g.preis == null && !g.wurde_zu_auftrag_id
        && g.abgabe_bis && g.abgabe_bis < jetzt) {
      dazu(4, "angebot_ueberfaellig", "Angebot überfällig",
        { typ: "angebot", id: g.id });
    }
  }

  // 🟡 Rechnung fehlt (§4.3): Auftrag fertig, Erwartungsfrist vorbei, keine
  // Rechnung zu diesem Auftrag eingegangen.
  for (let i = 0; i < auftraege.length; i++) {
    const a = auftraege[i];
    if (a.status !== "abgenommen" || !a.rechnung_erwartet_bis) continue;
    if (a.rechnung_erwartet_bis >= jetzt) continue;
    const hatRechnung = rechnungen.filter((r) => r.auftrag_id === a.id).length > 0;
    if (!hatRechnung) {
      dazu(4, "rechnung_fehlt",
        "Rechnung fehlt: " + (a.beschreibung || "Auftrag"),
        { typ: "auftrag", id: a.id });
    }
  }

  // 🟡 Antwort überfällig (§4.3, Sorte A): offener Faden (ausgehend, Antwort
  // erwartet, unbeantwortet) über der Rückmeldefrist.
  const nachrichten = welt.nachrichten.filter((n) => n.vorgang_id === vorgang.id);
  const beantwortet = {};
  for (let i = 0; i < nachrichten.length; i++) {
    if (nachrichten[i].antwort_auf_id) beantwortet[nachrichten[i].antwort_auf_id] = true;
  }
  for (let i = 0; i < nachrichten.length; i++) {
    const n = nachrichten[i];
    if (n.richtung === "ausgehend" && n.antwort_erwartet && !beantwortet[n.id]
        && n.rueckmeldung_bis && n.rueckmeldung_bis < jetzt) {
      dazu(4, "antwort_ueberfaellig", "Antwort überfällig",
        { typ: "nachricht", id: n.id });
    }
  }

  // 🟡 Rechnungen: eingegangen/in Prüfung → prüfen; freigegeben → zahlen.
  for (let i = 0; i < rechnungen.length; i++) {
    const r = rechnungen[i];
    if (r.status === "eingegangen" || r.status === "in_pruefung") {
      dazu(4, "rechnung_pruefen", "Rechnung prüfen", { typ: "rechnung", id: r.id });
    } else if (r.status === "freigegeben") {
      dazu(4, "zahlung_faellig", "Zahlung fällig", { typ: "rechnung", id: r.id });
    }
  }

  // 🟡 Angebot auswählen: Angebote liegen vor, keins gewählt — aber NUR wenn
  // der Vorgang nicht berechtigt ruht (wartet auf ETV-Beschluss = ⚪️, §8.1).
  if (angebote.length > 0 && !ruhtBisBeschluss && !ruhtBisDatum) {
    const gewaehlt = angebote.filter((a) => !!a.wurde_zu_auftrag_id).length > 0;
    if (!gewaehlt) {
      dazu(4, "angebot_auswaehlen",
        "Angebot auswählen (" + angebote.length + " liegen vor)",
        { typ: "vorgang", id: vorgang.id });
    }
  }

  // 🟡 Wiedervorlage: ruht_bis erreicht → Grau kippt zu Gelb (Unterart 1).
  // Unterart 2 (wartet_auf_beschluss_id) springt NIE durch Zeit um — nur
  // durch das Ereignis Beschluss (§8.1, Jahres-Rhythmus der ETV).
  if (vorgang.ruht_bis && vorgang.ruht_bis <= jetzt) {
    dazu(4, "wiedervorlage", "Wiedervorlage erreicht",
      { typ: "vorgang", id: vorgang.id });
  }

  // 🟡 Frisch gemeldet, noch nichts passiert (Schreibtisch-Quelle 4).
  if (vorgang.status === "offen" && auftraege.length === 0
      && angebote.length === 0 && !ruhtBisBeschluss && !ruhtBisDatum) {
    dazu(4, "neu", "Neu gemeldet — einordnen", { typ: "vorgang", id: vorgang.id });
  }

  // 🔵 Offene Entwürfe: erfasst-Aufträge am Vorgang (Ball bei mir, ohne Druck).
  for (let i = 0; i < auftraege.length; i++) {
    const a = auftraege[i];
    if (a.status === "erfasst") {
      dazu(3, "entwurf", "Erfasst, noch nicht beauftragt: "
        + (a.beschreibung || "Auftrag"), { typ: "auftrag", id: a.id });
    }
  }

  return H;
}

// Die Handlungs-Ampel: max-Rang über Hinweise + Grün-/Grau-Fäden.
// „Dringlichste gewinnt": rot > gelb > blau > grün > grau. Grau ist der BODEN —
// ein Vorgang fällt nur auf Grau zurück, wenn NICHTS anderes ihn einfärbt.
function ampelFarbe(vorgang, welt, heute) {
  if (!vorgang || !welt) return "grau";
  if (vorgang.status === "geschlossen") return "grau";
  const jetzt = heute || isoHeute();
  let rang = 0;

  const hinweise = hinweiseFuerVorgang(vorgang, welt, jetzt);
  for (let i = 0; i < hinweise.length; i++) {
    if (hinweise[i].rang > rang) rang = hinweise[i].rang;
  }
  if (rang >= 5) return "rot";

  if (rang < AMPEL_RANG.gruen) {
    // Grün-Fäden (läuft / warte auf jemanden): laufende Aufträge, delegierte
    // offene Aufgaben innerhalb der Frist, oder ein Vorgangsstatus jenseits
    // von „offen" ohne akuten Handlungsbedarf.
    const auftraege = welt.auftraege.filter((a) => a.vorgang_id === vorgang.id);
    let laeuft = auftraege.filter(auftragLaeuft).length > 0;
    if (!laeuft) {
      const offeneDelegiert = welt.aufgaben.filter((a) => {
        if (a.vorgang_id !== vorgang.id || a.status !== "offen") return false;
        const bet = welt.beteiligungen.filter((b) => b.id === a.beteiligung_id)[0] || null;
        return !(bet && bet.rolle === "fallfuehrer");
      });
      laeuft = offeneDelegiert.length > 0;
    }
    if (!laeuft) laeuft = vorgang.status !== "offen";
    if (laeuft) rang = AMPEL_RANG.gruen;
  }

  return rang > 0 ? ampelAusRang(rang) : "grau";
}

// Ampel für den VORGANGSLOSEN Auftrag (Begehungsfund, §5.5/§5.12) — der taucht
// in keiner Vorgangszeile auf, wohl aber am Schreibtisch und am Objekt.
function ampelFarbeAuftrag(auftrag, heute) {
  if (!auftrag) return "grau";
  const jetzt = heute || isoHeute();
  if (auftrag.frist && auftrag.frist < jetzt
      && auftrag.status !== "abgenommen") return "rot";
  if (auftrag.status === "erfasst") return "blau";
  if (auftrag.status === "fertiggemeldet") return "gelb";
  if (auftragLaeuft(auftrag)) return "gruen";
  return "grau"; // abgenommen
}

// ── §96.8 · Schreibtisch Stufe 1 (Spec §8): „Was liegt an?" ────────────────
// Errechnete, objektübergreifende Handlungsliste — Filter über alle flachen
// Listen, gleiche Bauweise wie die Kalender-Timeline. Selbstheilend.
// Gegenkraft zur Ampel-Verdichtung: hier erscheint JEDER Handlungsbedarf als
// eigene Zeile (auch die gelbe Aufgabe, die in der Zeile hinter einem roten
// Vorgang „verschwindet"). sortierung: "frist" (Default) | "alter" | "objekt".
function schreibtischEintraege(welt, sortierung, heute) {
  if (!welt) return [];
  const jetzt = heute || isoHeute();
  const E = [];

  // Quelle 1–3: alle Vorgangs-Hinweise (inkl. Fristen + Aufgaben an mich).
  for (let i = 0; i < welt.vorgaenge.length; i++) {
    const v = welt.vorgaenge[i];
    const hs = hinweiseFuerVorgang(v, welt, jetzt);
    for (let j = 0; j < hs.length; j++) {
      const h = hs[j];
      E.push({
        rang: h.rang, farbe: h.farbe, typ: h.typ, text: h.text,
        vorgang_id: v.id, auftrag_id: h.bezug && h.bezug.typ === "auftrag" ? h.bezug.id : null,
        objekt_id: v.objekt_id, einheit_id: v.einheit_id || null,
        titel: v.titel, seit: v.angelegt_am || null,
        frist: h.bezug && h.bezug.typ === "aufgabe"
          ? ((welt.aufgaben.filter((a) => a.id === h.bezug.id)[0] || {}).frist || null)
          : null,
        bezug: h.bezug,
      });
    }
  }

  // Quelle „erfasst"-Ecke: vorgangslose Aufträge (Begehungsfunde) — 🔵.
  for (let i = 0; i < welt.auftraege.length; i++) {
    const a = welt.auftraege[i];
    if (a.vorgang_id) continue;
    if (a.status === "abgenommen") continue;
    const farbe = ampelFarbeAuftrag(a, jetzt);
    E.push({
      rang: AMPEL_RANG[farbe] || 1, farbe: farbe,
      typ: a.status === "erfasst" ? "entwurf" : "auftrag_lauft",
      text: (a.status === "erfasst" ? "Erfasst: " : "") + (a.beschreibung || "Auftrag"),
      vorgang_id: null, auftrag_id: a.id,
      objekt_id: a.objekt_id, einheit_id: null,
      titel: a.beschreibung || "Auftrag", seit: a.erfasst_am || null,
      frist: a.frist || null,
      bezug: { typ: "auftrag", id: a.id },
    });
  }

  const s = sortierung || "frist";
  E.sort((x, y) => {
    if (y.rang !== x.rang) return y.rang - x.rang; // dringlichste zuerst
    if (s === "objekt") {
      return String(x.objekt_id || "").localeCompare(String(y.objekt_id || ""));
    }
    if (s === "alter") {
      return String(x.seit || "9999").localeCompare(String(y.seit || "9999"));
    }
    // "frist": nächste Frist zuerst, Einträge ohne Frist danach nach Alter.
    const fx = x.frist || "9999-12-31", fy = y.frist || "9999-12-31";
    if (fx !== fy) return fx.localeCompare(fy);
    return String(x.seit || "9999").localeCompare(String(y.seit || "9999"));
  });
  return E;
}

// ── §96.9 · Demo-Seeds: realistische Test-Vorgänge an ECHTE Objekte ────────
// Läuft genau einmal (App-Rumpf: nur wenn noch keine Vorgangs-Welt gespeichert
// ist). Hängt sich dynamisch an die vorhandenen Objekte/Kontakte (die Default-
// Listen sind leer — Bennys Daten kommen per Import mit eigenen IDs). Alle
// Datensätze tragen demo:true (gesammelt entfernbar) und relative Daten
// (bleiben „frisch"). Deckt alle fünf Ampelfarben ab. Ohne Objekte → null.
function erzeugeVorgangsSeeds(ves, kontakte) {
  const objekte = Array.isArray(ves) ? ves.filter((v) => v && v.id) : [];
  if (objekte.length === 0) return null;
  const o1 = objekte[0].id;
  const o2 = (objekte[1] || objekte[0]).id;
  const o3 = (objekte[2] || objekte[0]).id;
  const firmen = (Array.isArray(kontakte) ? kontakte : [])
    .filter((k) => k && k.typ === "firma");
  const personen = (Array.isArray(kontakte) ? kontakte : [])
    .filter((k) => k && k.typ !== "firma");
  const f1 = firmen[0] ? firmen[0].id : null;
  const f2 = firmen[1] ? firmen[1].id : f1;
  const p1 = personen[0] ? personen[0].id : null;

  const tage = (delta) => {
    const d = new Date();
    d.setDate(d.getDate() + delta);
    return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0")
      + "-" + String(d.getDate()).padStart(2, "0");
  };
  const welt = leereVorgangsWelt();
  const D = { demo: true };

  // ── V1 🔴 Wasserschaden (Instandsetzung): Auftrag läuft, Aufgabe überfällig ──
  const v1 = neuerVorgang(Object.assign({}, D, {
    objekt_id: o1, titel: "Wasserschaden Tiefgarage", kategorie: "instandsetzung",
    art: "schaden", status: "ausfuehrung", angelegt_am: tage(-12),
    ersteller_kontakt_id: p1,
  }));
  welt.vorgaenge.push(v1);
  const v1ff = neueBeteiligung(Object.assign({}, D, {
    vorgang_id: v1.id, rolle: "fallfuehrer", von: tage(-12) }));
  welt.beteiligungen.push(v1ff);
  if (p1) welt.beteiligungen.push(neueBeteiligung(Object.assign({}, D, {
    vorgang_id: v1.id, kontakt_id: p1, rolle: "melder", von: tage(-12) })));
  welt.nachrichten.push(neueNachricht(Object.assign({}, D, {
    vorgang_id: v1.id, richtung: "eingehend", von_kontakt_id: p1,
    betreff: "Wasser in der Tiefgarage",
    inhalt: "Bei Stellplatz 7 tritt Wasser aus der Decke aus, vermutlich Leitung.",
    gesendet_am: tage(-12) })));
  welt.auftraege.push(neuerAuftrag(Object.assign({}, D, {
    vorgang_id: v1.id, objekt_id: o1, firma_kontakt_id: f1, status: "in_arbeit",
    beschreibung: "Leckortung und Reparatur Zuleitung TG",
    erfasst_am: tage(-11), beauftragt_am: tage(-10) })));
  welt.aufgaben.push(neueAufgabe(Object.assign({}, D, {
    vorgang_id: v1.id, beteiligung_id: v1ff.id,
    titel: "Schadenmeldung an Gebäudeversicherung nachreichen",
    frist: tage(-4), angelegt_am: tage(-9) })));

  // ── V2 🟡 Heizungsausfall (Instandhaltung): fertiggemeldet → Abnahme fällig ──
  const v2 = neuerVorgang(Object.assign({}, D, {
    objekt_id: o1, titel: "Heizungsausfall Haus A", kategorie: "instandhaltung",
    art: "meldung", status: "ausfuehrung", angelegt_am: tage(-20),
  }));
  welt.vorgaenge.push(v2);
  welt.beteiligungen.push(neueBeteiligung(Object.assign({}, D, {
    vorgang_id: v2.id, rolle: "fallfuehrer", von: tage(-20) })));
  welt.nachrichten.push(neueNachricht(Object.assign({}, D, {
    vorgang_id: v2.id, richtung: "eingehend",
    betreff: "Heizung kalt", inhalt: "Mehrere Bewohner melden kalte Heizkörper.",
    gesendet_am: tage(-20) })));
  welt.auftraege.push(neuerAuftrag(Object.assign({}, D, {
    vorgang_id: v2.id, objekt_id: o1, firma_kontakt_id: f2, status: "fertiggemeldet",
    beschreibung: "Umwälzpumpe tauschen", erfasst_am: tage(-19),
    beauftragt_am: tage(-18) })));

  // ── V3 🟡 Dachrinnenreinigung: abgenommen, Rechnung in Prüfung ──────────────
  const v3 = neuerVorgang(Object.assign({}, D, {
    objekt_id: o2, titel: "Dachrinnenreinigung", kategorie: "instandhaltung",
    status: "rechnungspruefung", angelegt_am: tage(-35),
  }));
  welt.vorgaenge.push(v3);
  welt.beteiligungen.push(neueBeteiligung(Object.assign({}, D, {
    vorgang_id: v3.id, rolle: "fallfuehrer", von: tage(-35) })));
  const v3a = neuerAuftrag(Object.assign({}, D, {
    vorgang_id: v3.id, objekt_id: o2, firma_kontakt_id: f1, status: "abgenommen",
    beschreibung: "Dachrinnen reinigen, Fallrohre spülen",
    erfasst_am: tage(-34), beauftragt_am: tage(-30) }));
  welt.auftraege.push(v3a);
  welt.abnahmen.push(neueAbnahme(Object.assign({}, D, {
    auftrag_id: v3a.id, datum: tage(-8), ergebnis: "angenommen" })));
  welt.rechnungen.push(neueRechnung(Object.assign({}, D, {
    vorgang_id: v3.id, auftrag_id: v3a.id, betrag: 480,
    status: "in_pruefung", eingegangen_am: tage(-5) })));

  // ── V4 🟢 Treppenhaus streichen (Pflege): läuft, nichts gefordert ───────────
  const v4 = neuerVorgang(Object.assign({}, D, {
    objekt_id: o2, titel: "Treppenhaus streichen EG–2. OG", kategorie: "bewirtschaftung",
    status: "ausfuehrung", angelegt_am: tage(-6),
  }));
  welt.vorgaenge.push(v4);
  welt.beteiligungen.push(neueBeteiligung(Object.assign({}, D, {
    vorgang_id: v4.id, rolle: "fallfuehrer", von: tage(-6) })));
  welt.auftraege.push(neuerAuftrag(Object.assign({}, D, {
    vorgang_id: v4.id, objekt_id: o2, firma_kontakt_id: f2, status: "in_arbeit",
    beschreibung: "Wände und Decken streichen, Farbton wie Bestand",
    erfasst_am: tage(-6), beauftragt_am: tage(-5) })));

  // ── V5 ⚪️ Fassadensanierung (Sanierung): 3 Angebote, wartet auf ETV ─────────
  const v5 = neuerVorgang(Object.assign({}, D, {
    objekt_id: o1, titel: "Fassadensanierung Hofseite", kategorie: "sanierung",
    status: "offen", angelegt_am: tage(-60),
    wartet_auf_beschluss_id: "naechste_etv",
  }));
  welt.vorgaenge.push(v5);
  welt.beteiligungen.push(neueBeteiligung(Object.assign({}, D, {
    vorgang_id: v5.id, rolle: "fallfuehrer", von: tage(-60) })));
  welt.nachrichten.push(neueNachricht(Object.assign({}, D, {
    vorgang_id: v5.id, richtung: "eingehend",
    betreff: "Anregung Beirat", inhalt: "Beirat bittet, Angebote für die Hoffassade einzuholen (Putzschäden).",
    gesendet_am: tage(-60) })));
  welt.angebote.push(neuesAngebot(Object.assign({}, D, {
    vorgang_id: v5.id, firma_kontakt_id: f1, preis: 48200,
    eingeholt_am: tage(-30), gueltig_bis: tage(150) })));
  welt.angebote.push(neuesAngebot(Object.assign({}, D, {
    vorgang_id: v5.id, firma_kontakt_id: f2, preis: 52900,
    eingeholt_am: tage(-25), gueltig_bis: tage(150) })));
  welt.angebote.push(neuesAngebot(Object.assign({}, D, {
    vorgang_id: v5.id, preis: 45750, eingeholt_am: tage(-21),
    gueltig_bis: tage(150) })));

  // ── V6 ⚪️ Wiedervorlage (ruht bis Datum): Gartenpflege-Vertrag prüfen ───────
  welt.vorgaenge.push(neuerVorgang(Object.assign({}, D, {
    objekt_id: o3, titel: "Gartenpflege-Vertrag prüfen", kategorie: "bewirtschaftung",
    status: "offen", angelegt_am: tage(-15), ruht_bis: tage(45),
  })));

  // ── V7 🔵 Klingelanlage (Instandhaltung): erfasst-Auftrag am Vorgang ────────
  const v7 = neuerVorgang(Object.assign({}, D, {
    objekt_id: o3, titel: "Klingelanlage modernisieren", kategorie: "instandhaltung",
    status: "offen", angelegt_am: tage(-3),
  }));
  welt.vorgaenge.push(v7);
  welt.beteiligungen.push(neueBeteiligung(Object.assign({}, D, {
    vorgang_id: v7.id, rolle: "fallfuehrer", von: tage(-3) })));
  welt.auftraege.push(neuerAuftrag(Object.assign({}, D, {
    vorgang_id: v7.id, objekt_id: o3, status: "erfasst",
    beschreibung: "Angebot für Klingel-/Sprechanlage einholen",
    erfasst_am: tage(-3) })));

  // ── Begehungsfunde 🔵 (vorgangslose erfasst-Aufträge, §5.12) ────────────────
  welt.auftraege.push(neuerAuftrag(Object.assign({}, D, {
    objekt_id: o2, status: "erfasst",
    beschreibung: "Lampe 2. OG defekt", erfasst_am: tage(-2) })));
  welt.auftraege.push(neuerAuftrag(Object.assign({}, D, {
    objekt_id: o2, status: "erfasst",
    beschreibung: "Kellertür klemmt", erfasst_am: tage(-2) })));
  welt.auftraege.push(neuerAuftrag(Object.assign({}, D, {
    objekt_id: o2, status: "erfasst",
    beschreibung: "Graffiti an der Rückwand", erfasst_am: tage(-2) })));

  return welt;
}

// ── §96.10 · Flow-Übergänge (Spec §7) — reine Funktionen Welt → Welt ────────
// JEDE Zustands-Änderung der Vorgangs-Welt läuft über diese Funktionen:
// immutable (neue Welt zurück), unbekannte IDs → Welt unverändert. Das UI
// bleibt dünn (ruft nur auf), die Logik ist ohne DOM testbar und wandert
// später 1:1 in Supabase-Mutationen.

function _ersetzeIn(liste, id, aenderung) {
  return liste.map((x) => (x.id === id ? Object.assign({}, x, aenderung) : x));
}
// Vorgangs-Status nur VORWÄRTS schieben (Meilensteine, nie automatisch
// zurück): setzt status, wenn der Zielstatus in der Kette weiter ist.
function _vorgangMindestens(welt, vorgangId, statusId) {
  if (!vorgangId) return welt;
  const rangVon = (s) => VORGANG_STATUS.indexOf(s);
  const ziel = rangVon(statusId);
  if (ziel < 0) return welt;
  return Object.assign({}, welt, {
    vorgaenge: welt.vorgaenge.map((v) => {
      if (v.id !== vorgangId) return v;
      if (v.status === "geschlossen") return v; // geschlossen bleibt (Reaktivierung ist explizit)
      return rangVon(v.status) < ziel ? Object.assign({}, v, { status: statusId }) : v;
    }),
  });
}

// erfasst → beauftragt: Firma + optionales Zieldatum. Der Vorgang (falls
// vorhanden) rückt mindestens auf „beauftragt" vor.
function weltAuftragBeauftragen(welt, auftragId, daten) {
  const a = welt.auftraege.filter((x) => x.id === auftragId)[0];
  if (!a) return welt;
  const d = daten || {};
  let neu = Object.assign({}, welt, {
    auftraege: _ersetzeIn(welt.auftraege, auftragId, {
      status: "beauftragt",
      firma_kontakt_id: d.firma_kontakt_id || a.firma_kontakt_id || null,
      frist: d.frist || a.frist || null,
      nachfass_ab: d.nachfass_ab || a.nachfass_ab || null,
      beauftragt_am: isoHeute(),
    }),
  });
  return _vorgangMindestens(neu, a.vorgang_id, "beauftragt");
}

// Arbeits-Fortschritt: in_arbeit / fertiggemeldet / nachbesserung → fertiggemeldet.
function weltAuftragStatus(welt, auftragId, status) {
  const a = welt.auftraege.filter((x) => x.id === auftragId)[0];
  if (!a || AUFTRAG_STATUS.indexOf(status) < 0) return welt;
  let neu = Object.assign({}, welt, {
    auftraege: _ersetzeIn(welt.auftraege, auftragId, { status: status }),
  });
  if (status === "in_arbeit") neu = _vorgangMindestens(neu, a.vorgang_id, "ausfuehrung");
  return neu;
}

// Abnahme: erzeugt das Abnahme-Objekt (§5.6) und koppelt den Auftrag:
// angenommen → abgenommen, sonst → nachbesserung (Mängel als Grund).
function weltAuftragAbnehmen(welt, auftragId, daten) {
  const a = welt.auftraege.filter((x) => x.id === auftragId)[0];
  if (!a) return welt;
  const d = daten || {};
  const ergebnis = ABNAHME_ERGEBNISSE.indexOf(d.ergebnis) >= 0 ? d.ergebnis : "angenommen";
  const abnahme = neueAbnahme({
    auftrag_id: auftragId, ergebnis: ergebnis,
    maengel: Array.isArray(d.maengel) ? d.maengel : [],
    notiz: d.notiz || "",
    datum: d.datum || isoHeute(),
    pruefer_kontakt_id: d.pruefer_kontakt_id || null,
  });
  let neu = Object.assign({}, welt, {
    abnahmen: [...welt.abnahmen, abnahme],
    auftraege: _ersetzeIn(welt.auftraege, auftragId, Object.assign(
      { status: ergebnis === "angenommen" ? "abgenommen" : "nachbesserung" },
      ergebnis === "angenommen" && d.rechnung_erwartet_bis
        ? { rechnung_erwartet_bis: d.rechnung_erwartet_bis } : {})),
  });
  if (ergebnis === "angenommen") neu = _vorgangMindestens(neu, a.vorgang_id, "abnahme");
  return neu;
}

// Abhaken (Pflege/Kleinauftrag + lose Begehungsfunde): direkt „abgenommen",
// OHNE Abnahme-Objekt — das Foto am Auftrag ist der Nachweis (§5.6).
function weltAuftragAbhaken(welt, auftragId, daten) {
  const a = welt.auftraege.filter((x) => x.id === auftragId)[0];
  if (!a) return welt;
  const d = daten || {};
  return Object.assign({}, welt, {
    auftraege: _ersetzeIn(welt.auftraege, auftragId, Object.assign(
      { status: "abgenommen" },
      d.rechnung_erwartet_bis ? { rechnung_erwartet_bis: d.rechnung_erwartet_bis } : {})),
  });
}

// Rechnung erfassen (ehrlich als „eingegangen" — der Prüf-Hinweis feuert
// sofort). Vorgang rückt mindestens auf Rechnungsprüfung vor.
// §6c (Umbau) · Auto-Abgleich: Rechnung → Auftrag → Angebot (rückwärts über
// wurde_zu_auftrag_id). Jede Kette trägt ihre Summe; die App stellt gegenüber
// und BERECHNET die Abweichung. Direkter Auftrag ohne Angebot → keine
// Referenz, kein Abgleich (null).
function rechnungAbgleich(rechnung, welt) {
  if (!rechnung || rechnung.betrag == null || !welt) return null;
  const auftrag = rechnung.auftrag_id
    ? welt.auftraege.filter((a) => a.id === rechnung.auftrag_id)[0] : null;
  if (!auftrag) return null;
  const angebot = welt.angebote.filter(
    (a) => a.wurde_zu_auftrag_id === auftrag.id)[0] || null;
  if (!angebot || angebot.preis == null) return null;
  const diff = Math.round((Number(rechnung.betrag) - Number(angebot.preis)) * 100) / 100;
  return { angebotPreis: angebot.preis, abweichung: diff };
}

function weltRechnungNeu(welt, daten) {
  const d = daten || {};
  if (!d.vorgang_id) return welt;
  const r = neueRechnung({
    vorgang_id: d.vorgang_id, auftrag_id: d.auftrag_id || null,
    betrag: d.betrag != null && !isNaN(Number(d.betrag)) ? Number(d.betrag) : null,
  });
  const neu = Object.assign({}, welt, { rechnungen: [...welt.rechnungen, r] });
  return _vorgangMindestens(neu, d.vorgang_id, "rechnungspruefung");
}
function weltRechnungStatus(welt, rechnungId, status) {
  const r = welt.rechnungen.filter((x) => x.id === rechnungId)[0];
  if (!r || RECHNUNG_STATUS.indexOf(status) < 0) return welt;
  const neu = Object.assign({}, welt, {
    rechnungen: _ersetzeIn(welt.rechnungen, rechnungId,
      status === "bezahlt" ? { status: status, bezahlt_am: isoHeute() } : { status: status }),
  });
  return status === "bezahlt" ? _vorgangMindestens(neu, r.vorgang_id, "bezahlt") : neu;
}

// Aufgabe an die Verwaltung selbst (v1: einziger Adressat bis Phase 5).
// Sichert die Fallführer-Beteiligung (findet oder erzeugt sie) — eiserne
// Regel §5.8: Aufgabe hängt IMMER an einer beteiligung_id.
function weltAufgabeNeu(welt, vorgangId, daten) {
  const v = welt.vorgaenge.filter((x) => x.id === vorgangId)[0];
  if (!v) return welt;
  const d = daten || {};
  let ff = welt.beteiligungen.filter(
    (b) => b.vorgang_id === vorgangId && b.rolle === "fallfuehrer")[0];
  let beteiligungen = welt.beteiligungen;
  if (!ff) {
    ff = neueBeteiligung({ vorgang_id: vorgangId, rolle: "fallfuehrer" });
    beteiligungen = [...beteiligungen, ff];
  }
  const aufgabe = neueAufgabe({
    vorgang_id: vorgangId, beteiligung_id: ff.id,
    titel: d.titel || "", frist: d.frist || null,
    bezug: d.bezug || null,
  });
  return Object.assign({}, welt, {
    beteiligungen: beteiligungen,
    aufgaben: [...welt.aufgaben, aufgabe],
  });
}
function weltAufgabeErledigt(welt, aufgabeId) {
  const a = welt.aufgaben.filter((x) => x.id === aufgabeId)[0];
  if (!a) return welt;
  return Object.assign({}, welt, {
    aufgaben: _ersetzeIn(welt.aufgaben, aufgabeId,
      { status: "erledigt", erledigt_am: isoHeute() }),
  });
}

// Die Verwandlung (§5.4): gewähltes Angebot → Auftrag. Nachvollziehbar über
// wurde_zu_auftrag_id; ein etwaiges Beschluss-Warten endet (der Fall läuft).
function weltAngebotBeauftragen(welt, angebotId, daten) {
  const ang = welt.angebote.filter((x) => x.id === angebotId)[0];
  if (!ang || ang.wurde_zu_auftrag_id) return welt;
  const v = welt.vorgaenge.filter((x) => x.id === ang.vorgang_id)[0];
  const d = daten || {};
  const auftrag = neuerAuftrag({
    vorgang_id: ang.vorgang_id, objekt_id: v ? v.objekt_id : null,
    nummer: auftragsNummerNeu(welt, ang.vorgang_id),
    firma_kontakt_id: ang.firma_kontakt_id || null,
    status: "beauftragt", beauftragt_am: isoHeute(),
    frist: d.frist || null,
    beschreibung: d.beschreibung || (v ? v.titel : "") || "Auftrag",
  });
  let neu = Object.assign({}, welt, {
    auftraege: [...welt.auftraege, auftrag],
    angebote: _ersetzeIn(welt.angebote, angebotId, { wurde_zu_auftrag_id: auftrag.id }),
    vorgaenge: welt.vorgaenge.map((x) => x.id === ang.vorgang_id
      ? Object.assign({}, x, { wartet_auf_beschluss_id: null }) : x),
  });
  return _vorgangMindestens(neu, ang.vorgang_id, "beauftragt");
}

// Wiedervorlage aufnehmen: ruht_bis löschen — der Fall ist wieder aktiv.
function weltWiedervorlageAufheben(welt, vorgangId) {
  return Object.assign({}, welt, {
    vorgaenge: _ersetzeIn(welt.vorgaenge, vorgangId, { ruht_bis: null }),
  });
}

// Schließen / Reaktivieren (§7): geschlossen ist nie gelöscht — die Akte
// bleibt, Gewährleistung macht sie wieder aufmachbar.
function weltVorgangSchliessen(welt, vorgangId) {
  return Object.assign({}, welt, {
    vorgaenge: _ersetzeIn(welt.vorgaenge, vorgangId,
      { status: "geschlossen", geschlossen_am: isoHeute() }),
  });
}
function weltVorgangOeffnen(welt, vorgangId) {
  return Object.assign({}, welt, {
    vorgaenge: _ersetzeIn(welt.vorgaenge, vorgangId,
      { status: "offen", geschlossen_am: null }),
  });
}

// Bündeln (§5.12): lose erfasst-Aufträge bekommen einen gemeinsamen Vorgang —
// NUR Zuordnen (vorgang_id setzen), kein Verschmelzen: „diese fünf beim
// nächsten Rundgang" bleiben fünf Aufträge unter einem Vorgang und werden
// dort gemeinsam oder einzeln beauftragt. ziel:
//   { vorgang_id }                            → bestehendem Vorgang zuordnen
//   { neu: { titel, kategorie, objekt_id } }  → neuer Sammel-Vorgang (+ Fallführer)
function weltAuftraegeBuendeln(welt, auftragIds, ziel) {
  const ids = Array.isArray(auftragIds) ? auftragIds.filter(Boolean) : [];
  if (ids.length === 0 || !ziel) return welt;
  let vorgangId = ziel.vorgang_id || null;
  let neu = welt;
  if (!vorgangId && ziel.neu) {
    const v = neuerVorgang({
      objekt_id: ziel.neu.objekt_id || null,
      nummer: vorgangsNummerNeu(welt),
      titel: ziel.neu.titel || "Gebündelte Aufträge",
      kategorie: ziel.neu.kategorie || "bewirtschaftung",
    });
    const ff = neueBeteiligung({ vorgang_id: v.id, rolle: "fallfuehrer" });
    neu = Object.assign({}, welt, {
      vorgaenge: [...welt.vorgaenge, v],
      beteiligungen: [...welt.beteiligungen, ff],
    });
    vorgangId = v.id;
  }
  if (!vorgangId) return welt;
  const vorgang = neu.vorgaenge.filter((v) => v.id === vorgangId)[0];
  if (!vorgang) return welt;
  // Lose Funde bekommen ihre Nummer bei der Zuordnung (Bennys Regel B):
  // erst mit Vorgang gibt es das Bezugszeichen.
  // ziel.beauftragen (18.07.): { firma_kontakt_id } — „Direkt beauftragen":
  // alle gebündelten Punkte gehen sofort an die Firma (status beauftragt).
  const beauftragen = ziel.beauftragen && ziel.beauftragen.firma_kontakt_id
    ? ziel.beauftragen : null;
  let ergebnis = neu;
  for (let i = 0; i < ids.length; i++) {
    ergebnis = Object.assign({}, ergebnis, {
      auftraege: ergebnis.auftraege.map((a) => a.id === ids[i]
        ? Object.assign({}, a, { vorgang_id: vorgangId,
            nummer: a.nummer || auftragsNummerNeu(ergebnis, vorgangId) },
            beauftragen ? { firma_kontakt_id: beauftragen.firma_kontakt_id,
              status: "beauftragt", beauftragt_am: isoHeute() } : {})
        : a),
    });
  }
  return ergebnis;
}

// Ruhen bis Datum (Grau-Unterart 1): kippt bei Erreichen von allein zu 🟡
// (Wiedervorlage-Hinweis) — nichts weiter zu merken.
function weltVorgangRuhen(welt, vorgangId, bisIso) {
  if (!bisIso) return welt;
  return Object.assign({}, welt, {
    vorgaenge: _ersetzeIn(welt.vorgaenge, vorgangId, { ruht_bis: bisIso }),
  });
}

// ETV-Nahtstelle (§9): auf die Tagesordnung = Sonderwert "naechste_etv".
// Die spätere ETV-Welt findet ihre Tagesordnung als Filter hierüber fertig
// vor. Springt NIE durch Zeit um — nur durch das Ereignis Beschluss (oder
// explizites Herunternehmen).
function weltVorgangAufTagesordnung(welt, vorgangId) {
  return Object.assign({}, welt, {
    vorgaenge: _ersetzeIn(welt.vorgaenge, vorgangId,
      { wartet_auf_beschluss_id: "naechste_etv" }),
  });
}
function weltVorgangVonTagesordnung(welt, vorgangId) {
  return Object.assign({}, welt, {
    vorgaenge: _ersetzeIn(welt.vorgaenge, vorgangId,
      { wartet_auf_beschluss_id: null }),
  });
}

// Verwalter-Notiz in die Akte (Kanal "notiz", von mir → richtung ausgehend).
function weltNotizNeu(welt, vorgangId, text) {
  const v = welt.vorgaenge.filter((x) => x.id === vorgangId)[0];
  if (!v || !text) return welt;
  const n = neueNachricht({ vorgang_id: vorgangId, richtung: "ausgehend",
    kanal: "notiz", inhalt: text });
  return Object.assign({}, welt, { nachrichten: [...welt.nachrichten, n] });
}

// Auftrag aus dem Vorgang HERAUSLÖSEN (Benny 19.07., Regel 2A/3C): der Punkt
// geht sauber zurück in den Erfasst-Pool — Vorgangs-Zuordnung, Nummer, Firma,
// Beauftragungs-Datum und Frist werden geleert (ein „beauftragter" Punkt im
// Pool wäre verwirrend). Inhaltliches (Beschreibung, Wo, Notiz, Gemeldet von,
// Fotos, Erfasst-Datum) bleibt. War es der LETZTE Auftrag des Vorgangs, wird
// der Vorgang automatisch gelöscht (3C) — der herausgelöste Punkt überlebt
// die Kaskade, weil seine vorgang_id da schon null ist.
function weltAuftragHerausloesen(welt, auftragId) {
  const a = welt.auftraege.filter((x) => x.id === auftragId)[0];
  if (!a || !a.vorgang_id) return welt;
  const vorgangId = a.vorgang_id;
  const neu = Object.assign({}, welt, {
    auftraege: welt.auftraege.map((x) => x.id === auftragId
      ? Object.assign({}, x, { vorgang_id: null, nummer: null,
          status: "erfasst", firma_kontakt_id: null, freigegeben_von_id: null,
          beauftragt_am: null, frist: null, abnahme_noetig: null })
      : x),
  });
  const rest = neu.auftraege.filter((x) => x.vorgang_id === vorgangId);
  if (rest.length === 0) return weltVorgangLoeschen(neu, vorgangId);
  return neu;
}

// ── §96.11 · Löschen, Demo-Entfernen, Timeline (v13.58) ─────────────────────
// Löschen ist die harte Ausnahme zur „Akte bleibt"-Regel — für Fehleingaben
// und Demo-Daten in der Einzelplatz-Phase. IMMER kaskadiert: keine Waisen.

// Vorgang + ALLE Kinder entfernen (Beteiligungen, Nachrichten, Angebote,
// Aufträge inkl. deren Abnahmen, Rechnungen, Aufgaben).
function weltVorgangLoeschen(welt, vorgangId) {
  const v = welt.vorgaenge.filter((x) => x.id === vorgangId)[0];
  if (!v) return welt;
  const wegAuftraege = {};
  welt.auftraege.forEach((a) => { if (a.vorgang_id === vorgangId) wegAuftraege[a.id] = true; });
  return {
    vorgaenge: welt.vorgaenge.filter((x) => x.id !== vorgangId),
    beteiligungen: welt.beteiligungen.filter((x) => x.vorgang_id !== vorgangId),
    nachrichten: welt.nachrichten.filter((x) => x.vorgang_id !== vorgangId),
    angebote: welt.angebote.filter((x) => x.vorgang_id !== vorgangId),
    auftraege: welt.auftraege.filter((x) => x.vorgang_id !== vorgangId),
    abnahmen: welt.abnahmen.filter((x) => !wegAuftraege[x.auftrag_id]),
    rechnungen: welt.rechnungen.filter((x) => x.vorgang_id !== vorgangId),
    aufgaben: welt.aufgaben.filter((x) => x.vorgang_id !== vorgangId),
    beschluesse: welt.beschluesse,
  };
}

// Einzelnen Auftrag entfernen (auch lose Begehungsfunde): nimmt seine
// Abnahmen mit; ein darauf zeigendes Angebot wird wieder wählbar.
function weltAuftragLoeschen(welt, auftragId) {
  const a = welt.auftraege.filter((x) => x.id === auftragId)[0];
  if (!a) return welt;
  return Object.assign({}, welt, {
    auftraege: welt.auftraege.filter((x) => x.id !== auftragId),
    abnahmen: welt.abnahmen.filter((x) => x.auftrag_id !== auftragId),
    angebote: welt.angebote.map((x) => x.wurde_zu_auftrag_id === auftragId
      ? Object.assign({}, x, { wurde_zu_auftrag_id: null }) : x),
  });
}

// Alle Seed-/Demo-Datensätze (demo:true) auf einen Schlag entfernen.
function weltDemoEntfernen(welt) {
  const k = (liste) => liste.filter((x) => !x.demo);
  return {
    vorgaenge: k(welt.vorgaenge), beteiligungen: k(welt.beteiligungen),
    nachrichten: k(welt.nachrichten), angebote: k(welt.angebote),
    auftraege: k(welt.auftraege), abnahmen: k(welt.abnahmen),
    rechnungen: k(welt.rechnungen), aufgaben: k(welt.aufgaben),
    beschluesse: k(welt.beschluesse),
  };
}
function zaehleDemoDaten(welt) {
  if (!welt) return 0;
  let n = 0;
  const z = (liste) => { liste.forEach((x) => { if (x.demo) n++; }); };
  z(welt.vorgaenge); z(welt.beteiligungen); z(welt.nachrichten);
  z(welt.angebote); z(welt.auftraege); z(welt.abnahmen);
  z(welt.rechnungen); z(welt.aufgaben); z(welt.beschluesse);
  return n;
}

// Foto-Referenzen (Weg A §5.10, v13.59): die Bilder leben in ve.fotos[] —
// der Auftrag merkt sich nur die ids. Anzeigen/Löschen läuft über das
// bestehende Foto-Feature (§93), hier nur das Verknüpfen.
function weltAuftragFotoRefs(welt, auftragId, fotoIds) {
  const a = welt.auftraege.filter((x) => x.id === auftragId)[0];
  const ids = Array.isArray(fotoIds) ? fotoIds.filter(Boolean) : [];
  if (!a || ids.length === 0) return welt;
  return Object.assign({}, welt, {
    auftraege: _ersetzeIn(welt.auftraege, auftragId, {
      foto_ids: [...(Array.isArray(a.foto_ids) ? a.foto_ids : []), ...ids],
    }),
  });
}

// Löst EINE Foto-Referenz vom Punkt (das Foto selbst bleibt in ve.fotos —
// das „ganz löschen" macht der Rumpf-Callback zusätzlich mit setVes +
// dateiLoeschen). Begehung 18.07.
function weltAuftragFotoRefEntfernen(welt, auftragId, fotoId) {
  const a = welt.auftraege.filter((x) => x.id === auftragId)[0];
  if (!a || !fotoId) return welt;
  const alt = Array.isArray(a.foto_ids) ? a.foto_ids : [];
  return Object.assign({}, welt, {
    auftraege: _ersetzeIn(welt.auftraege, auftragId, {
      foto_ids: alt.filter((x) => x !== fotoId),
    }),
  });
}

// ── Timeline (Benny 09.07.): die Chronik quer über alles ───────────────────
// Jüngste Aktivität eines Vorgangs = das späteste Datum irgendeines seiner
// Ereignisse (dieselben Quellen wie der Akten-Verlauf).
function vorgangLetzteAktivitaet(vorgang, welt) {
  let max = vorgang.angelegt_am || "";
  const nimm = (d) => { if (d && d > max) max = d; };
  nimm(vorgang.geschlossen_am);
  welt.nachrichten.forEach((n) => { if (n.vorgang_id === vorgang.id) nimm(n.gesendet_am); });
  welt.angebote.forEach((a) => { if (a.vorgang_id === vorgang.id) nimm(a.eingeholt_am); });
  welt.auftraege.forEach((a) => {
    if (a.vorgang_id !== vorgang.id) return;
    nimm(a.erfasst_am); nimm(a.beauftragt_am);
  });
  welt.abnahmen.forEach((ab) => {
    const auf = welt.auftraege.filter((a) => a.id === ab.auftrag_id)[0];
    if (auf && auf.vorgang_id === vorgang.id) nimm(ab.datum);
  });
  welt.rechnungen.forEach((r) => {
    if (r.vorgang_id !== vorgang.id) return;
    nimm(r.eingegangen_am); nimm(r.bezahlt_am);
  });
  welt.aufgaben.forEach((a) => {
    if (a.vorgang_id !== vorgang.id) return;
    nimm(a.angelegt_am); nimm(a.erledigt_am);
  });
  return max;
}

// Flache Chronik-Liste: alle Vorgänge (auch geschlossene — es ist die
// Historie) + lose Aufträge, jüngste Aktivität zuerst.
function timelineEintraege(welt, heute) {
  if (!welt) return [];
  const jetzt = heute || isoHeute();
  const E = [];
  for (let i = 0; i < welt.vorgaenge.length; i++) {
    const v = welt.vorgaenge[i];
    E.push({
      typ: "vorgang", vorgang_id: v.id, auftrag_id: null,
      objekt_id: v.objekt_id, einheit_id: v.einheit_id || null,
      nummer: v.nummer || null,
      titel: v.titel || "Vorgang", kategorie: v.kategorie, status: v.status,
      farbe: ampelFarbe(v, welt, jetzt),
      letzte: vorgangLetzteAktivitaet(v, welt),
    });
  }
  for (let i = 0; i < welt.auftraege.length; i++) {
    const a = welt.auftraege[i];
    if (a.vorgang_id) continue;
    E.push({
      typ: "auftrag", vorgang_id: null, auftrag_id: a.id,
      objekt_id: a.objekt_id, einheit_id: null,
      titel: a.beschreibung || "Auftrag", kategorie: null, status: a.status,
      farbe: ampelFarbeAuftrag(a, jetzt),
      letzte: a.beauftragt_am && a.beauftragt_am > (a.erfasst_am || "")
        ? a.beauftragt_am : (a.erfasst_am || ""),
    });
  }
  E.sort((x, y) => String(y.letzte).localeCompare(String(x.letzte)));
  return E;
}

export {
  VORGANG_KATEGORIEN, VORGANG_PHASEN_KETTE, vorgangKategorie, kategorieHatPhase,
  auftragBrauchtAbnahme,
  VORGANG_STATUS, AUFTRAG_STATUS, RECHNUNG_STATUS, ABNAHME_ERGEBNISSE,
  AUFGABE_STATUS, auftragLaeuft,
  BETEILIGUNG_ROLLEN, beteiligungRolle, ANLASS_TYPEN, anlassTyp,
  neuerVorgang, neueBeteiligung, neueNachricht, neuesAngebot, neuerAuftrag,
  neueAbnahme, neueRechnung, neueAufgabe, neuerBeschluss,
  normalisiereVorgangsWelt, leereVorgangsWelt, fristenVon, isoInTagen,
  vorlagenVon, vorlageFuerSchritt, fuelleVorlage,
  vorgangsNummerNeu, auftragsNummerNeu, angebotsNummerNeu,
  AMPEL_RANG, AMPEL_REIHE, ampelAusRang,
  hinweiseFuerVorgang, ampelFarbe, ampelFarbeAuftrag, schreibtischEintraege,
  erzeugeVorgangsSeeds,
  weltAuftragBeauftragen, weltAuftragStatus, weltAuftragAbnehmen,
  weltAuftragAbhaken, weltRechnungNeu, weltRechnungStatus, rechnungAbgleich,
  weltAufgabeNeu, weltAufgabeErledigt, weltAngebotBeauftragen,
  weltWiedervorlageAufheben, weltVorgangSchliessen, weltVorgangOeffnen,
  weltAuftraegeBuendeln, weltVorgangRuhen, weltVorgangAufTagesordnung,
  weltVorgangVonTagesordnung, weltNotizNeu,
  weltVorgangLoeschen, weltAuftragLoeschen, weltAuftragHerausloesen, weltDemoEntfernen, zaehleDemoDaten,
  vorgangLetzteAktivitaet, timelineEintraege, weltAuftragFotoRefs, weltAuftragFotoRefEntfernen,
  _kontaktAnzeigename as kontaktAnzeigename, kontaktNameVonId,
  // ETV-Welt (Konzept _03, Bau 12.07.)
  ETV_ARTEN, ETV_DURCHFUEHRUNG, ETV_STATUS_KETTE, ETV_STATUS_LABEL, TOP_BAUSTEINE,
  neueVersammlung, neuerTop, neueAnwesenheit,
  ladungsfristInfo, einladungsStichtag, etvStammVomObjekt, etvSichtklasse, etvOrtAnfrageVon,
  offeneOrdentlicheEtv, garantiereOffeneEtv,
  anfechtungsfristBis, versammlungenFuerObjekt,
  topsFuerVersammlung, anwesenheitenFuer, beschlussfaehigkeitInfo,
  etvNaechsterSchritt,
  weltVersammlungNeu, weltVersammlungPatch, weltVersammlungLoeschen,
  weltVersammlungUnterlage, weltVersammlungUnterlageWeg, UNTERLAGE_ART_LABEL,
  weltTopNeu, weltTopPatch, weltTopLoeschen, weltTopVerschieben,
  weltTopAbstimmen, weltBeschlussPatch, weltAnwesenheitenSetzen,
  // Abstimm-Cockpit (Konzept 14.07.):
  MEHRHEITSTYPEN, berechneAbstimmung,
  // Beschluss-Sammlung (§24 VII WEG, Konzept 13.07.):
  neueGerichtsentscheidung, naechsteLfdNummer, sammlungsStatus,
  SAMMLUNG_STATUS_LABEL, sammlungFuerObjekt, beschlussOrtDatum,
  weltBeschlussVermerk, weltBeschlussAltNeu,
  weltGerichtsentscheidungNeu, weltGerichtsentscheidungVermerk,
  weltTopVertagen,
};
