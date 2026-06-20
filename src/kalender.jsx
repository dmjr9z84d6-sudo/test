import React, { useState, useRef, useEffect, Fragment } from "react";
import { ACCENT, FS, FW, RAD, feldInput, getContrastColor } from "./constants.js";
import { parseDatumWert } from "./utils-basis.js";
import {
  aktiveBelegung, belegungsPhase, eigStatus, heuteLaufendeBelegung,
  istAnonymesMitglied, sevStatus, teileVon
} from "./datenmodell.js";
import {
  Avatar, DatumFeld, DatumKalender, FeldKontaktKarte, KontaktPicker,
  Toggle, ZeitFeld, ZeitWahl, datumAnzeige, tageImMonat
} from "./components.jsx";
import {
  DESKTOP_MIN_WIDTH, I, StickySectionHeader, useFirmenRollen, useKontaktFarbe,
  useRollen, useTerminBezeichnungen, useWindowWidth, useZeitPicker
} from "./utils-icons.jsx";
// ╔═════════════════════════════════════════════════════════════════════════╗
// ║ SEKTION 5b · KALENDER / TERMINE — ausgelagertes Modul                   ║
// ║ sammleTermine · KalenderZeile · KalenderPanel · KalenderScreen ·        ║
// ║ TerminAnlegen · TerminAssistent · TerminDetailPopup · isoKW            ║
// ╚═════════════════════════════════════════════════════════════════════════╝
// ZYKLISCHER Import aus der Hauptdatei: diese Namen leben (noch) im S5-Kern.
// Alle Nutzungen erfolgen zur Laufzeit (JSX-Returns/Callbacks), nie beim
// Modul-Init — daher von esbuild korrekt auflösbar. Siehe BUILD_TROUBLESHOOTING.
import {
  AktionsButton, ObjektLegende
} from "./kontakte-modul.jsx";
import {
  ANDERE_OPTION, VertragForm, datumsTagMon, eigStufen,
  feldImKalender, intervallMonate, tagsDiffMS
} from "./liegenschaft.jsx";
import {
  FeldEinheitKarte, FeldEinheitenSammelKarte, FeldObjektKarte, FilterButtons,
  ObjekteMasterDetail, VEKachel, VEListenZeile, alleEinheitenVonVe
} from "./objektansicht.jsx";
import { objektBezugInfo } from "./kontakte.jsx";

// Wie weit der Kalender in die Zukunft reicht (Monate). Zentral steuerbar.
var KAL_FENSTER_MONATE = 24;
function sammleTermine(ves, kontakte, fensterMonate, rueckMonate, freieTermine) {
  var heute = new Date();
  heute.setHours(0, 0, 0, 0);
  var monate = fensterMonate || 12;
  // Rückblick: rueckMonate > 0 verschiebt die Untergrenze in die Vergangenheit
  // (Orientierungskalender). Ohne Angabe bleibt alles wie bisher (ab heute).
  var rueck = rueckMonate || 0;
  var fensterStart = rueck > 0
    ? new Date(heute.getFullYear(), heute.getMonth() - rueck, heute.getDate())
    : heute;
  var fensterEnde = new Date(heute.getFullYear(), heute.getMonth() + monate, heute.getDate());
  var out = [];

  function add(datum, titel, typ, farbe, icon, bezugLabel, sub, objektId, kontaktId, ziel, extra) {
    if (!datum) return;
    var d = new Date(datum); d.setHours(0, 0, 0, 0);
    out.push({
      datum: d, iso: d.getFullYear() + "-" + String(d.getMonth()+1).padStart(2,"0") + "-" + String(d.getDate()).padStart(2,"0"),
      titel: titel, typ: typ, farbe: farbe, icon: icon,
      bezugLabel: bezugLabel || "", sub: sub || "",
      objektId: objektId || null, kontaktId: kontaktId || null,
      // Verknüpfungen für die kleinen Karten im aufgeklappten Zustand.
      einheitIds: (extra && Array.isArray(extra.einheitIds)) ? extra.einheitIds.slice()
        : (extra && extra.einheitId != null ? [extra.einheitId] : []),
      kontaktIds: kontaktId ? [kontaktId] : [],
      ziel: ziel || null,
      diff: tagsDiffMS(heute, d)
    });
  }

  (ves || []).forEach(function(ve) {
    var vw = ve.verwaltung || {};
    var objLabel = ve.nr || ve.name || ("Objekt " + ve.id);
    var objSub = ve.strasse || ve.adresse || "";
    // Kanonische Verwaltungs-Stichtage: die persistierten Karten-Felder haben
    // Vorrang vor ve.verwaltung (das trägt nur Initialwerte und veraltet nach
    // der ersten Bearbeitung). Fallback bleibt für unberührte Bestände.
    var vk0 = Array.isArray(ve.verwaltungsKarten) ? ve.verwaltungsKarten : [];
    var stammKarte = null, etvKarte = null;
    vk0.forEach(function(k) {
      if (!k) return;
      if (k.kategorie === "verwaltung_stamm" && !stammKarte) stammKarte = k;
      if (k.kategorie === "etv" && !etvKarte) etvKarte = k;
    });
    function kartenFeldWert(karte, name) {
      if (!karte || !Array.isArray(karte.stamm)) return "";
      var f = null;
      karte.stamm.forEach(function(x) { if (x && x.name === name && !f) f = x; });
      return (f && f.value) || "";
    }
    var zielStamm = { tab: "verwaltung", karteId: (stammKarte && stammKarte.id) || 1, label: "Zur Verwaltung" };
    var zielEtv   = { tab: "verwaltung", karteId: (etvKarte && etvKarte.id) || 2, label: "Zur ETV" };
    // Verwaltung
    var bb = parseDatumWert(kartenFeldWert(stammKarte, "Bestellt bis") || vw.bestelltBis);
    if (bb && bb >= fensterStart && bb <= fensterEnde)
      add(bb, "Bestellung läuft aus", "verwaltung", "#F59E0B", "calendar", objLabel, objSub, ve.id, null, zielStamm);
    var etv = parseDatumWert(kartenFeldWert(etvKarte, "Nächste ETV") || vw.naechsteETV);
    if (etv && etv >= fensterStart && etv <= fensterEnde)
      add(etv, "Eigentümerversammlung", "etv", "#8B5CF6", "calendar", objLabel, objSub, ve.id, null, zielEtv);
    var wahl = parseDatumWert(vw.naechsteWahl);
    if (wahl && wahl >= fensterStart && wahl <= fensterEnde)
      add(wahl, "Verwalterwahl", "wahl", "#0EA5E9", "calendar", objLabel, objSub, ve.id, null, zielStamm);

    // Verträge — bevorzugt aus den persistierten Karten (kennen ihre Karte für
    // den Sprung und sind nach Bearbeitung aktuell); Fallback ve.vertraege.
    var vertragsQuellen = [];
    vk0.forEach(function(k) {
      ((k && k.vertraege) || []).forEach(function(v) { vertragsQuellen.push({ v: v, karte: k }); });
    });
    if (vertragsQuellen.length === 0)
      (ve.vertraege || []).forEach(function(v) { vertragsQuellen.push({ v: v, karte: null }); });
    // Sprechende Labels je Vertrags-Kategorie für den Sprung-Button.
    var VERTRAG_ZIEL_LABEL = {
      versicherungen: "Zu den Versicherungen", versorger: "Zu den Versorgern",
      messdienst: "Zum Messdienst", vertraege: "Zu den Verträgen",
    };
    vertragsQuellen.forEach(function(q) {
      var v = q.v;
      var zielVertrag = { tab: "verwaltung", karteId: (q.karte && q.karte.id) || null,
        label: (q.karte && VERTRAG_ZIEL_LABEL[q.karte.kategorie]) || "Zu den Verträgen" };
      var leistung = v.leistung || v.typ || "Vertrag";
      var ab  = parseDatumWert(v.ab);
      var bis = parseDatumWert(v.bis);
      var schritt = intervallMonate(v.intervall);
      if (schritt > 0 && ab) {
        // Wiederkehrend: vom Anker in Schritten vorwärts bis Fensterende.
        // Serienende durch "bis" (gekündigt) respektieren.
        var cur = new Date(ab);
        var guard = 0;
        while (cur < fensterStart && guard < 600) { cur = new Date(cur.getFullYear(), cur.getMonth() + schritt, cur.getDate()); guard++; }
        while (cur <= fensterEnde && guard < 600) {
          if (bis && cur > bis) break;
          add(cur, leistung, "vertrag", "#10B981", "wrench", objLabel, objSub, ve.id, null, zielVertrag);
          cur = new Date(cur.getFullYear(), cur.getMonth() + schritt, cur.getDate());
          guard++;
        }
      } else {
        // Einmalig: nur Enddatum als Termin (ab nur falls zukünftig)
        if (bis && bis >= fensterStart && bis <= fensterEnde)
          add(bis, leistung + " endet", "vertrag", "#10B981", "wrench", objLabel, objSub, ve.id, null, zielVertrag);
        if (ab && ab >= fensterStart && ab <= fensterEnde)
          add(ab, leistung + " beginnt", "vertrag", "#10B981", "wrench", objLabel, objSub, ve.id, null, zielVertrag);
      }
    });

    // Einheiten-Wechsel: Eigentümer / Belegung / SEV. Nur Stichtage mit
    // bekanntem (zukünftigem) Datum im Fenster.
    function imFenster(d) { return d && d >= fensterStart && d <= fensterEnde; }
    // Liegenschaft-Karte (Gebäude/TG), die eine Einheit enthält — Sprungziel.
    var lkAlle = Array.isArray(ve.karten) ? ve.karten : [];
    function zielFuerEinheit(eid) {
      var karte = null;
      lkAlle.forEach(function(k) {
        if (karte || !k) return;
        if ((k.einheiten || []).some(function(e) { return e && e.id === eid; })) karte = k;
      });
      return { tab: "liegenschaft", karteId: (karte && karte.id) || null, label: "Zur Einheit" };
    }
    (ve.einheiten || []).forEach(function(einheit) {
      var zielEinheit = zielFuerEinheit(einheit.id);
      var ehLabel = einheit.bezeichnung || einheit.nr || ("Einheit " + (einheit.id != null ? einheit.id : ""));
      var ehSub = objLabel + (objSub ? " · " + objSub : "");

      // 1) Eigentümerwechsel — Stufen am werdenden Käufer.
      (einheit.eigentuemer || []).forEach(function(p) {
        var stat = eigStatus(p);
        if (stat !== "interessent" && stat !== "werdend") return; // nur laufender Vorgang
        var stufen = eigStufen(p);
        stufen.forEach(function(st) {
          if (!st.datum || st.erledigt) return; // nur künftige, noch nicht erreichte
          var d = parseDatumWert(st.datum);
          if (!imFenster(d)) return;
          var wer = p.name || "neuer Eigentümer";
          add(d, st.label + ": " + wer, "eigentuemer", "#F472B6", "swap",
            ehLabel, ehSub, ve.id, p.kontaktId || null, zielEinheit, { einheitId: einheit.id });
        });
      });

      // 2) Belegungswechsel — geplante Folgebelegung(en) (Einzug) + Auszug der
      //    aktuell laufenden Belegung, je Teil. „Geplant" über belegungsPhase
      //    erkennen (deckt echte Wechsel-Vorgänge UND einfach zukünftige
      //    Belegungen ohne geplant-Flag ab — wie die Anzeige).
      (teileVon(einheit) || []).forEach(function(teil) {
        (teil.belegungen || []).forEach(function(b) {
          if (belegungsPhase(b) !== "geplant") return;
          if (!b.von) return;
          var dv = parseDatumWert(b.von);
          if (!imFenster(dv)) return;
          var gm = (b.haushalt && b.haushalt.mitglieder || [])
            .find(function(m) { return !istAnonymesMitglied(m); });
          var wer2 = gm ? gm.name : (b.typ === "vermietung" ? "neuer Mieter" : "neue Nutzung");
          var wort = b.typ === "vermietung" ? "Einzug" : "Nutzungsbeginn";
          add(dv, wort + ": " + wer2, "belegung", "#0080FF", "users", ehLabel, ehSub, ve.id, null, zielEinheit, { einheitId: einheit.id });
        });
        // Auszug = bis der laufenden Belegung (falls terminiert)
        var laufend = heuteLaufendeBelegung(teil);
        if (laufend && laufend.bis) {
          var db = parseDatumWert(laufend.bis);
          if (imFenster(db)) {
            add(db, "Auszug", "belegung", "#0080FF", "users", ehLabel, ehSub, ve.id, null, zielEinheit, { einheitId: einheit.id });
          }
        }
      });

      // 3) SEV — Übergabe (werdende SEV) bzw. Enddatum (auslaufende SEV).
      (einheit.sev || []).forEach(function(s) {
        var sst = sevStatus(s);
        if (sst === "werdend" && s.seit) {
          var ds = parseDatumWert(s.seit);
          if (imFenster(ds)) add(ds, "SEV-Übergabe: " + (s.name || ""), "sev", "#7C3AED", "calendar", ehLabel, ehSub, ve.id, s.kontaktId || null, zielEinheit, { einheitId: einheit.id });
        }
        if (sst === "aktiv" && s.bis) {
          var de = parseDatumWert(s.bis);
          if (imFenster(de)) add(de, "SEV endet: " + (s.name || ""), "sev", "#7C3AED", "calendar", ehLabel, ehSub, ve.id, s.kontaktId || null, zielEinheit, { einheitId: einheit.id });
        }
      });
    });

    // Manuell angelegte Termine (Kalender-+-Button): ve.termine.
    // Felder: id, titel, datum (iso), einheitIds[] (alt: einheitId), kontaktIds[].
    (ve.termine || []).forEach(function(tm) {
      if (!tm) return;
      var dTm = parseDatumWert(tm.datum);
      if (!dTm || dTm < fensterStart || dTm > fensterEnde) return;
      var ehIds = terminEinheitIds(tm);
      var einheitenTm = [];
      ehIds.forEach(function(eid) {
        var gef = null;
        lkAlle.forEach(function(k) {
          if (gef || !k) return;
          (k.einheiten || []).forEach(function(e) {
            if (!gef && e && e.id === eid) gef = e;
          });
        });
        if (!gef) gef = (ve.einheiten || []).find(function(e) { return e && e.id === eid; }) || null;
        if (gef) einheitenTm.push(gef);
      });
      var ehLabelTm = einheitenTm.length > 0
        ? einheitenTm.map(function(e) { return e.bezeichnung || e.nr || "Einheit"; }).join(", ")
        : null;
      var einheitTm = einheitenTm.length > 0 ? einheitenTm[0] : null;
      var namen = (tm.kontaktIds || []).map(function(kid) {
        var k = (kontakte || []).find(function(x) { return x && x.id === kid; });
        if (!k) return null;
        return k.typ === "firma" ? (k.name || "") : (((k.vorname || "") + " " + (k.nachname || "")).trim() || k.name || "");
      }).filter(Boolean);
      add(dTm, tm.titel || "Termin", "termin", "#22C55E", "calendar",
        ehLabelTm || objLabel, ehLabelTm ? (objLabel + (objSub ? " · " + objSub : "")) : objSub,
        ve.id, (tm.kontaktIds || [])[0] || null,
        einheitTm != null ? zielFuerEinheit(einheitTm.id) : null,
        { einheitIds: ehIds.slice() });
      out[out.length - 1].personen = namen;
      out[out.length - 1].kontaktIds = (tm.kontaktIds || []).slice();
      out[out.length - 1].manuellId = tm.id;
      out[out.length - 1].uhrzeit = tm.uhrzeit || "";
      out[out.length - 1].dauer = (tm.dauer != null ? tm.dauer : null);
      out[out.length - 1].notizen = tm.notizen || "";
    });

    // Fristen aus Karten-Datumsfeldern: Technik-Wartung, Objekt-Fristen
    // (Legionellen, Energieausweis, Schlüsseldienst, Dachsanierung) und
    // Dokument-Fristen („Gültig bis"). Sichtbarkeit über feldImKalender:
    // explizites imKalender-Flag gewinnt, sonst Namens-Heuristik (s. o.).
    function fristTyp(name) {
      var n = (name || "").toLowerCase();
      if (n.indexOf("wartung") >= 0) return { typ: "technik", farbe: "#0EA5E9", icon: "wrench" };
      return { typ: "verwaltung", farbe: "#F59E0B", icon: "calendar" };
    }
    function sammleKartenFristen(karten, containerLabel, bereichTab) {
      (karten || []).forEach(function(karte) {
        if (!karte) return;
        var kTitel = karte.titel || karte.name || containerLabel;
        var zielKarte = { tab: bereichTab, karteId: karte.id, label: "Zu: " + kTitel };
        // Direkte Karten-Felder (stamm + felder)
        var felder = [].concat(karte.stamm || [], karte.felder || []);
        felder.forEach(function(f) {
          if (!f || (f.type !== "date" && f.typ !== "date") || !f.value) return;
          // Entdoppelung: „Bestellt bis" der Verwaltungs-Stammdaten ist bereits
          // als „Bestellung läuft aus" fest verdrahtet — hier überspringen.
          if (karte.kategorie === "verwaltung_stamm" && f.name === "Bestellt bis") return;
          if (!feldImKalender(f)) return;
          var d = parseDatumWert(f.value);
          if (!imFenster(d)) return;
          var ft = fristTyp(f.name);
          add(d, f.name + (kTitel ? " · " + kTitel : ""), ft.typ, ft.farbe, ft.icon, objLabel, objSub, ve.id, null, zielKarte);
        });
        // Technik-Geräte mit eigenen Feldern
        (karte.technikGeraete || []).forEach(function(g) {
          var gName = g.geraeteart || g.name || "Gerät";
          (g.felder || []).forEach(function(f) {
            if (!f || (f.type !== "date" && f.typ !== "date") || !f.value) return;
            if (!feldImKalender(f)) return;
            var d = parseDatumWert(f.value);
            if (!imFenster(d)) return;
            add(d, f.name + " · " + gName, "technik", "#0EA5E9", "wrench", objLabel, objSub, ve.id, null, zielKarte);
          });
        });
      });
    }
    sammleKartenFristen(ve.verwaltungsKarten, "Verwaltung", "verwaltung");
    sammleKartenFristen(ve.dokumenteKarten, "Dokument", "dokumente");
  });

  // Jahrestage aus Kontakt-Datumsfeldern (jährlich wiederkehrend, nächstes Vorkommen)
  (kontakte || []).forEach(function(k) {
    var kLabel = k.name || ((k.vorname || "") + " " + (k.nachname || "")).trim() || "Kontakt";
    (k.customFelder || []).filter(function(f) { return f.typ === "date" && f.wert; }).forEach(function(f) {
      var dm = datumsTagMon(f.wert);
      if (!dm) return;
      var jahr = heute.getFullYear();
      var naechstes = new Date(jahr, dm.monat - 1, dm.tag);
      if (naechstes < heute) naechstes = new Date(jahr + 1, dm.monat - 1, dm.tag);
      if (naechstes <= fensterEnde)
        add(naechstes, f.name || "Jahrestag", "jahrestag", "#EC4899", "users", kLabel, "", null, k.id);
    });
  });

  // Objektlose Termine (freieTermine): Bezug "keiner" — kein ve, keine Einheit.
  (freieTermine || []).forEach(function(tm) {
    if (!tm) return;
    var dTm = parseDatumWert(tm.datum);
    if (!dTm || dTm < fensterStart || dTm > fensterEnde) return;
    var namen = (tm.kontaktIds || []).map(function(kid) {
      var k = (kontakte || []).find(function(x) { return x && x.id === kid; });
      if (!k) return null;
      return k.typ === "firma" ? (k.name || "") : (((k.vorname || "") + " " + (k.nachname || "")).trim() || k.name || "");
    }).filter(Boolean);
    add(dTm, tm.titel || "Termin", "termin", tm.farbe || "#22C55E", "calendar",
      "", "", null, (tm.kontaktIds || [])[0] || null, null, {});
    out[out.length - 1].personen = namen;
    out[out.length - 1].kontaktIds = (tm.kontaktIds || []).slice();
    out[out.length - 1].freiId = tm.id;
    out[out.length - 1].uhrzeit = tm.uhrzeit || "";
    out[out.length - 1].dauer = (tm.dauer != null ? tm.dauer : null);
    out[out.length - 1].notizen = tm.notizen || "";
  });

  out.sort(function(a, b) { return a.datum - b.datum; });
  return out;
}

function kalenderBucket(diff) {
  if (diff < 0)  return "ueberfaellig";
  if (diff <= 7) return "woche";
  if (diff <= 31) return "monat";
  if (diff <= 92) return "quartal";
  return "spaeter";
}

function restzeitText(diff) {
  if (diff < 0)  return "überfällig seit " + Math.abs(diff) + (Math.abs(diff) === 1 ? " Tag" : " Tagen");
  if (diff === 0) return "heute";
  if (diff === 1) return "morgen";
  return "in " + diff + " Tagen";
}

// Kurzes Näher-rück-Label für den „Wann"-Bereich (Zeile 1, vor dem Datum).
// Ab 1 Woche vorher konkretisiert es sich: zuerst Wochentag-Kürzel, dann
// übermorgen / morgen / heute. Weiter weg bleibt es leer (nur Datum zählt).
var WOCHENTAG_KURZ = ["So", "Mo", "Di", "Mi", "Do", "Fr", "Sa"];
function naehertLabel(diff, datum) {
  if (diff < 0) return "überfällig";
  if (diff === 0) return "heute";
  if (diff === 1) return "morgen";
  if (diff === 2) return "übermorgen";
  if (diff >= 3 && diff <= 7 && datum) return WOCHENTAG_KURZ[datum.getDay()];
  return "";
}

// Dauer-Prefix für den „Wann"-Bereich (Zeile 2, vor der Uhrzeit).
// „ca. 1h" bei konkreter Minutenzahl, „ganztags" oder „offen" sonst.
function dauerPrefix(d) {
  if (d === "ganztags") return "ganztags";
  if (typeof d === "number" && d > 0) {
    if (d % 60 === 0) return "ca. " + (d / 60) + "h";
    if (d < 60) return "ca. " + d + "min";
    return "ca. " + Math.floor(d / 60) + "h " + (d % 60) + "min";
  }
  return "offen";
}

// Kurz-Ort eines Termins für kompakte Listen (Tagesansicht): die VE-Nummer des
// verknüpften Objekts (z. B. „WEG-2024-001") — bewusst NICHT die lange Adresse.
// Ohne Objekt: leer (Aufrufer fällt dann auf das Typ-Label zurück).
function terminOrtKurz(termin, ves) {
  if (!termin || !termin.objektId) return "";
  var ve = (ves || []).find(function(v) { return v && v.id === termin.objektId; });
  if (!ve) return "";
  return ve.nr || "";
}

// ── Kalender-Screen: gruppierte Terminliste ──────────────────────────────────
const KALENDER_BUCKETS = [
  { id: "ueberfaellig", label: "Überfällig" },
  { id: "woche",        label: "Diese Woche" },
  { id: "monat",        label: "Dieser Monat" },
  { id: "quartal",      label: "Demnächst" },
  { id: "spaeter",      label: "Später" },
];
const KALENDER_TYPEN = [
  { id: "termin",     label: "Termine",    kurz: "Term." },
  { id: "verwaltung", label: "Verwaltung", kurz: "Verw." },
  { id: "etv",        label: "ETV",        kurz: "ETV" },
  { id: "wahl",       label: "Wahl",       kurz: "Wahl" },
  { id: "vertrag",    label: "Verträge",   kurz: "Vertr." },
  { id: "technik",    label: "Technik",    kurz: "Tech." },
  { id: "eigentuemer",label: "Eigentümer", kurz: "Eig." },
  { id: "belegung",   label: "Belegung",   kurz: "Beleg." },
  { id: "sev",        label: "SEV",        kurz: "SEV" },
  { id: "jahrestag",  label: "Jahrestage", kurz: "Jahr." },
];

function KalenderZeile({ termin, t, offen, onToggle, onZiel, onLoeschen = null, rahmenFarbe = null,
  kontakte = [], ves = [], setKontakte = null, onKontaktClick = null, onVEClick = null,
  onNotiz = null, onBearbeiten = null }) {
  // Zwei-Schritt-Löschen statt confirm() (DESIGN §25.2): erster Tap macht den
  // Button scharf („Löschen?"), zweiter Tap löscht. Zuklappen entschärft.
  var loeschState = useState(false);
  var loeschBereit = loeschState[0], setLoeschBereit = loeschState[1];
  useEffect(() => { if (!offen) setLoeschBereit(false); }, [offen]);
  var d = termin.datum;
  var datumStr = String(d.getDate()).padStart(2, "0") + "." + String(d.getMonth()+1).padStart(2, "0") + "." + d.getFullYear();
  var ueberfaellig = termin.diff < 0;
  // Wann-Bereich: kompaktes Datum (ohne Jahr, wenn dieses Jahr) für die große
  // Zeile; Relativ-Label + Dauer-Prefix aus Helfern.
  var datumKurz = String(d.getDate()).padStart(2, "0") + "." + String(d.getMonth()+1).padStart(2, "0") + ".";
  var naeher = naehertLabel(termin.diff, d);
  var uhrzeitStr = termin.uhrzeit || "";
  var dauerPref = dauerPrefix(termin.dauer);
  var typEintrag = KALENDER_TYPEN.find(function(ty) { return ty.id === termin.typ; });
  var typLabel = (typEintrag && typEintrag.label) || termin.typ;
  var zielText = (termin.ziel && termin.ziel.label)
    || (termin.kontaktId && !termin.objektId ? "Zum Kontakt" : "Zum Objekt");
  // Aufgeklappt: Optik der kleinen Karten (DESIGN §20.3) — Rahmen, Tint und
  // Sprung-Button einheitlich in der KALENDER-Bereichsfarbe (rahmenFarbe),
  // damit alle Einträge als Kalender-Elemente erkennbar sind; Icon-Kachel und
  // Typ-Label behalten die Termin-Typ-Farbe als inhaltliche Kennung.
  var rf = rahmenFarbe || termin.farbe;
  // Verknüpfte Entitäten für die kleinen Karten (DESIGN §20.3) im aufgeklappten
  // Zustand: Objekt, ggf. Einheit, je Kontakt eine kleine Kontaktkarte.
  var verkVe = termin.objektId ? (ves || []).find(function(v) { return v && v.id === termin.objektId; }) || null : null;
  var verkEinheitIds = terminEinheitIds(termin);
  var verkEinheiten = verkVe
    ? verkEinheitIds
        .map(function(eid) { return alleEinheitenVonVe(verkVe).find(function(e) { return e && e.id === eid; }) || null; })
        .filter(Boolean)
    : [];
  var verkEinheit = verkEinheiten.length === 1 ? verkEinheiten[0] : null;
  var verkKontakte = (termin.kontaktIds || [])
    .map(function(kid) { return (kontakte || []).find(function(k) { return k && k.id === kid; }); })
    .filter(Boolean);
  return (
    <div onClick={onToggle} data-kb-item="1"
      data-termin-key={(termin.iso || "") + "|" + (termin.titel || "") + "|" + (termin.objektId || termin.kontaktId || "")}
      style={{ background: t.surface,
        border: "1px solid " + (offen ? rf : t.border),
        borderRadius: offen ? RAD.lg : RAD.md, cursor: "pointer",
        transition: "border-color 0.15s" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "11px 13px" }}>
        <div style={{ width: 34, height: 34, borderRadius: RAD.ms, flexShrink: 0,
          background: termin.farbe + "1A", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <I name={termin.icon} size={17} color={termin.farbe}/>
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: FS.m, fontWeight: FW.medium, color: t.text,
            whiteSpace: offen ? "normal" : "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{termin.titel}</div>
          <div style={{ fontSize: FS.s, color: t.sub,
            whiteSpace: offen ? "normal" : "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            {termin.bezugLabel}{termin.sub ? " · " + termin.sub : ""}
          </div>
        </div>
        <div style={{ textAlign: "right", flexShrink: 0 }}>
          <div style={{ display: "flex", alignItems: "baseline", justifyContent: "flex-end", gap: 6 }}>
            {naeher && (
              <span style={{ fontSize: FS.xs, fontWeight: FW.bold,
                color: ueberfaellig ? "#EF4444" : (termin.diff <= 7 ? rf : t.muted),
                textTransform: "uppercase", letterSpacing: "0.04em" }}>{naeher}</span>
            )}
            <span style={{ fontSize: FS.l, fontWeight: FW.bold, color: t.text,
              lineHeight: 1.1, whiteSpace: "nowrap" }}>{datumKurz}</span>
          </div>
          <div style={{ display: "flex", alignItems: "baseline", justifyContent: "flex-end", gap: 6, marginTop: 2 }}>
            <span style={{ fontSize: FS.xs, color: t.muted, whiteSpace: "nowrap" }}>
              {uhrzeitStr ? dauerPref + " ab" : dauerPref}
            </span>
            {uhrzeitStr && (
              <span style={{ fontSize: FS.l, fontWeight: FW.bold, color: t.text,
                lineHeight: 1.1, whiteSpace: "nowrap" }}>{uhrzeitStr}</span>
            )}
          </div>
        </div>
      </div>
      {offen && (
        <div style={{ padding: "0 13px 11px 13px" }} onClick={(e) => e.stopPropagation()}>
          {(verkKontakte.length > 0 || verkVe || verkEinheit) && (
            <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 9 }}>
              {verkKontakte.map(function(k) {
                return <FeldKontaktKarte key={"k" + k.id} k={k} t={t} accent={rf}
                  kontakte={kontakte} setKontakte={setKontakte}
                  onKontaktClick={onKontaktClick}/>;
              })}
              {verkEinheit
                ? <FeldEinheitKarte ve={verkVe} einheit={verkEinheit} t={t} accent={rf} onVEClick={onVEClick}/>
                : (verkEinheiten.length > 1
                  ? <FeldEinheitenSammelKarte ve={verkVe} einheiten={verkEinheiten} t={t} accent={rf} onVEClick={onVEClick}/>
                  : (verkVe ? <FeldObjektKarte ve={verkVe} t={t} accent={rf} kontakte={kontakte} onVEClick={onVEClick}/> : null))}
            </div>
          )}
          {termin.personen && termin.personen.length > 0 && verkKontakte.length === 0 && (
            <div style={{ fontSize: FS.s, color: t.sub, marginBottom: 7 }}>
              Mit: <span style={{ color: t.text, fontWeight: FW.medium }}>{termin.personen.join(", ")}</span>
            </div>
          )}
          {(termin.manuellId != null || termin.freiId != null) && onNotiz && (
            <div style={{ marginBottom: 9 }}>
              <div style={{ fontSize: FS.xs, fontWeight: FW.bold, color: t.muted,
                textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 5 }}>Notizen</div>
              <textarea
                value={termin.notizen || ""}
                onChange={(e) => onNotiz(e.target.value)}
                placeholder="Notizen, Anmerkungen…"
                rows={2}
                style={{ width: "100%", boxSizing: "border-box", background: t.surface,
                  border: `1px solid ${t.border}`, borderRadius: RAD.ms, padding: "7px 9px",
                  fontSize: 16, color: t.text, fontFamily: "inherit", outline: "none",
                  resize: "vertical", minHeight: 44 }}
                onFocus={(e) => e.currentTarget.style.borderColor = rf + "80"}
                onBlur={(e) => e.currentTarget.style.borderColor = t.border}/>
            </div>
          )}
          <div style={{ display: "flex", alignItems: "center", gap: 8,
            borderTop: "1px solid " + rf + "25", paddingTop: 9 }}>
            <span style={{ fontSize: FS.xs, fontWeight: FW.bold, color: termin.farbe,
              letterSpacing: "0.06em", textTransform: "uppercase" }}>{typLabel}</span>
            <span style={{ flex: 1 }}/>
            {(termin.manuellId != null || termin.freiId != null) && onLoeschen && (
              <button onClick={(e) => {
                  e.stopPropagation();
                  if (!loeschBereit) { setLoeschBereit(true); return; }
                  setLoeschBereit(false);
                  onLoeschen();
                }}
                title="Termin löschen" aria-label="Termin löschen"
                style={{ display: "flex", alignItems: "center", justifyContent: "center",
                  gap: 5, height: 28, cursor: "pointer", fontFamily: "inherit",
                  padding: loeschBereit ? "0 10px" : 0,
                  width: loeschBereit ? "auto" : 28,
                  background: loeschBereit ? "#EF4444" : "transparent",
                  border: "1px solid " + (loeschBereit ? "#EF4444" : "#EF444440"),
                  borderRadius: RAD.sm,
                  fontSize: FS.xs, fontWeight: FW.medium,
                  color: loeschBereit ? "#fff" : "#EF4444" }}>
                {loeschBereit && "Löschen?"}
                <I name="x" size={12} color={loeschBereit ? "#fff" : "#EF4444"}/>
              </button>
            )}
            {(termin.manuellId != null || termin.freiId != null) && onBearbeiten && (
              <button onClick={(e) => { e.stopPropagation(); onBearbeiten(); }}
                title="Termin bearbeiten" aria-label="Termin bearbeiten"
                style={{ display: "flex", alignItems: "center", gap: 4,
                  padding: "6px 12px", background: rf + "15",
                  border: "1px solid " + rf + "40", borderRadius: RAD.sm,
                  fontSize: FS.s, fontWeight: FW.medium, color: rf,
                  cursor: "pointer", fontFamily: "inherit" }}>
                <I name="pencil" size={13} color={rf}/>
                Bearbeiten
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Auto-Beteiligte: Personen je nach Regel automatisch vorschlagen ─────────
// Regeln: "keine" | "eigentuemer" (alle Eigentümer des Objekts) |
// "eig_nutzer_einheit" (Eigentümer + Nutzer DER Einheit) | "nutzer_einheit"
// (nur Nutzer der Einheit). Liefert eindeutige Kontakt-IDs. Eigentümer = enge
// Eigentümer-Rolle (einheit.eigentuemer, nur aktiv). Nutzer = aktive Bewohner.
const AUTO_BETEILIGTE_REGELN = [
  { id: "keine",              label: "Keine" },
  { id: "eigentuemer",        label: "Eigentümer (Objekt)" },
  { id: "eig_nutzer_einheit", label: "Eigentümer + Nutzer (Einheit)" },
  { id: "nutzer_einheit",     label: "Nutzer (Einheit)" },
];
// Termin → Einheit-IDs als Array (SSoT). Neu: tm.einheitIds[]. Abwärts-
// kompatibel: altes tm.einheitId (einzeln) wird als 1-Element-Array gelesen.
function terminEinheitIds(tm) {
  if (!tm) return [];
  if (Array.isArray(tm.einheitIds)) return tm.einheitIds.filter(function(x) { return x != null; });
  if (tm.einheitId != null) return [tm.einheitId];
  return [];
}

function autoBeteiligteIds(ve, einheitIds, regel) {
  if (!ve || !regel || regel === "keine") return [];
  var einheitIdListe = Array.isArray(einheitIds) ? einheitIds
    : (einheitIds != null ? [einheitIds] : []);
  const ids = [];
  const push = (id) => { if (id != null && ids.indexOf(id) < 0) ids.push(id); };
  // Einheiten kanonisch aus den Liegenschafts-Karten sammeln, Fallback ve.einheiten.
  const alleEinheiten = (() => {
    const aus = [];
    ((ve.karten) || []).forEach(k => ((k && k.einheiten) || []).forEach(e => e && aus.push(e)));
    return aus.length > 0 ? aus : (ve.einheiten || []);
  })();
  const eigVon = (einheit) => {
    (einheit && einheit.eigentuemer || []).forEach(e => {
      if (!e || e.kontaktId == null) return;
      const st = (typeof eigStatus === "function") ? eigStatus(e) : "aktiv";
      if (st !== "ehemalig") push(e.kontaktId); // aktiv + werdend
    });
  };
  const nutzerVon = (einheit) => {
    (typeof teileVon === "function" ? teileVon(einheit) : []).forEach(teil => {
      const beleg = (typeof aktiveBelegung === "function") ? aktiveBelegung(teil) : null;
      const hh = beleg && beleg.haushalt;
      (hh && hh.mitglieder || []).forEach(m => { if (m && m.kontaktId != null) push(m.kontaktId); });
    });
  };
  if (regel === "eigentuemer") {
    alleEinheiten.forEach(eigVon);
  } else {
    einheitIdListe.forEach(function(eid) {
      const einheit = alleEinheiten.find(e => e && String(e.id) === String(eid));
      if (einheit) {
        if (regel === "eig_nutzer_einheit") eigVon(einheit);
        nutzerVon(einheit);
      }
    });
  }
  return ids;
}

// ── DauerWahl: Schnellbuttons (Minuten) + „Ganztags" ────────────────────────
// wert: number (Minuten) | "ganztags" | null. optionen: Array<number>.
function DauerWahl({ wert, onChange, optionen, t, accent }) {
  // Zwei Reihen: oben die Minuten-Optionen (inkl. 2 h), unten Ganztags + Offen.
  // Override via `optionen` (Minuten-Array) fürs Direktformular. "ganztags" und
  // "offen" (= kein Wert / null) sind Sonderfälle.
  const minOpts = (optionen && optionen.length > 0) ? optionen : [30, 45, 60, 90, 120];
  const labelVon = (min) => {
    if (min === 90) return "1,5 h";
    return min % 60 === 0 ? (min / 60) + " h"
      : (min < 60 ? min + " min" : Math.floor(min / 60) + " h " + (min % 60) + " min");
  };
  const btn = (aktiv, onClick, label) => (
    <button onClick={onClick}
      style={{ flex: 1, minWidth: 0, padding: "9px 6px", borderRadius: RAD.ms, cursor: "pointer",
        fontFamily: "inherit", fontSize: FS.s, fontWeight: aktiv ? FW.bold : FW.medium,
        background: aktiv ? accent + "1E" : "transparent",
        border: `1px solid ${aktiv ? accent : t.border}`,
        color: aktiv ? accent : t.sub, whiteSpace: "nowrap" }}>
      {label}
    </button>
  );
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <div style={{ display: "flex", gap: 6 }}>
        {minOpts.map(min => (
          <Fragment key={min}>
            {btn(wert === min, () => onChange(wert === min ? null : min), labelVon(min))}
          </Fragment>
        ))}
      </div>
      <div style={{ display: "flex", gap: 6 }}>
        {btn(wert === "ganztags", () => onChange(wert === "ganztags" ? null : "ganztags"), "Ganztags")}
        {btn(wert == null, () => onChange(null), "Offen")}
      </div>
    </div>
  );
}
// Dauer lesbar machen (für Kontroll-Ansicht).
function dauerText(d) {
  if (d === "ganztags") return "Ganztags";
  if (typeof d === "number" && d > 0) {
    if (d % 60 === 0) return (d / 60) + " h";
    if (d < 60) return d + " min";
    return Math.floor(d / 60) + " h " + (d % 60) + " min";
  }
  return "—";
}

// ── TerminBearbeitenKompakt: schlankes Schnell-Bearbeiten ───────────────────
// Bewusst minimal: nur Datum, Uhrzeit, Dauer und Personen ergänzen/entfernen.
// Objekt/Einheit/Bezeichnung bleiben unverändert (wer das ändern will, legt den
// Termin neu an). `start` = bestehende Termin-Werte (wie bei TerminAnlegen).
// onAnlegen(neu, objektId) — gleiche Signatur wie TerminAnlegen, damit die
// vorhandene Speichern-Logik in den Overlays unverändert weiterläuft.
function TerminBearbeitenKompakt({ ves, kontakte, setKontakte, t, accent, onAnlegen, onCancel, start = null, submitText = "Speichern" }) {
  const s0 = start || {};
  const [datum, setDatum] = useState(s0.datum || "");
  const [uhrzeit, setUhrzeit] = useState(s0.uhrzeit || "");
  const [dauer, setDauer] = useState(s0.dauer != null ? s0.dauer : null);
  const [kontaktIds, setKontaktIds] = useState(Array.isArray(s0.kontaktIds) ? s0.kontaktIds.slice() : []);
  const [alleZeigen, setAlleZeigen] = useState(false);
  const zeitCfg = useZeitPicker();
  const personenRollen = useRollen();
  const firmenRollen = useFirmenRollen();
  const farben = useKontaktFarbe();
  const dauerOptionen = (zeitCfg && zeitCfg.dauerOptionen) || [15, 30, 45, 60, 90, 120];
  // Objekt/Einheit unverändert durchreichen.
  const objektId = (s0.objektId != null && s0.objektId !== "") ? s0.objektId : null;
  const einheitIds = Array.isArray(s0.einheitIds) ? s0.einheitIds.slice()
    : (s0.einheitId != null ? [s0.einheitId] : []);
  // Picker-Liste: standardmäßig nur Kontakte MIT Bezug zum verknüpften Objekt;
  // per Haken alle. (Wie im Anlege-Formular, gleicher objektBezugInfo-Filter.)
  const ve = objektId != null ? (ves || []).find(v => v && v.id === objektId) || null : null;
  const objektKontakte = (ve && !alleZeigen)
    ? (kontakte || []).filter(k => objektBezugInfo(k, ve, personenRollen, firmenRollen, farben).hatBezug)
    : (kontakte || []);
  const gewaehlteKontakte = kontaktIds
    .map(kid => (kontakte || []).find(k => k && k.id === kid))
    .filter(Boolean);
  const personHinzufuegen = (kid) => {
    if (kid == null) return;
    setKontaktIds(prev => prev.indexOf(kid) >= 0 ? prev : [...prev, kid]);
  };
  const personEntfernen = (kid) => setKontaktIds(prev => prev.filter(x => x !== kid));
  const speichern = () => {
    const neu = {
      titel: s0.titel || "Termin",
      datum: datum,
      uhrzeit: uhrzeit,
      dauer: dauer,
      objektId: objektId,
      einheitIds: einheitIds,
      kontaktIds: kontaktIds.slice(),
      notizen: s0.notizen || ""
    };
    onAnlegen(neu, objektId);
  };
  const labelStyle = { fontSize: FS.xs, fontWeight: FW.bold, color: t.muted,
    textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 };
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div>
        <div style={labelStyle}>Datum</div>
        <DatumFeld value={datum} onChange={setDatum} t={t} accent={accent}
          defaultHeute={false} iso/>
      </div>
      <div>
        <div style={labelStyle}>Uhrzeit</div>
        <ZeitFeld value={uhrzeit} onChange={setUhrzeit} t={t} accent={accent}/>
      </div>
      <div>
        <div style={labelStyle}>Dauer</div>
        <DauerWahl wert={dauer} onChange={setDauer} optionen={dauerOptionen} t={t} accent={accent}/>
      </div>
      <div>
        <div style={labelStyle}>Personen</div>
        {gewaehlteKontakte.length > 0 && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 8 }}>
            {gewaehlteKontakte.map(k => {
              const name = k.typ === "firma" ? (k.name || "")
                : (((k.vorname || "") + " " + (k.nachname || "")).trim() || k.name || "");
              return (
                <div key={k.id} style={{ display: "flex", alignItems: "center", gap: 6,
                  background: accent + "12", border: `1px solid ${accent}33`,
                  borderRadius: RAD.pill, padding: "4px 6px 4px 12px" }}>
                  <span style={{ fontSize: FS.s, fontWeight: FW.medium, color: t.text }}>{name}</span>
                  <button onClick={() => personEntfernen(k.id)}
                    title="Entfernen" aria-label="Person entfernen"
                    style={{ display: "flex", alignItems: "center", justifyContent: "center",
                      width: 20, height: 20, borderRadius: RAD.full, cursor: "pointer",
                      background: "transparent", border: "none" }}>
                    <I name="x" size={11} color={t.sub}/>
                  </button>
                </div>
              );
            })}
          </div>
        )}
        <KontaktPicker value={null} label={null} t={t} accent={accent}
          kontakte={objektKontakte} setKontakte={setKontakte}
          onChange={(kid) => personHinzufuegen(kid)}/>
        {ve && (
          <label style={{ display: "flex", alignItems: "center", gap: 7, marginTop: 6,
            fontSize: FS.s, color: t.sub, cursor: "pointer", userSelect: "none" }}>
            <input type="checkbox" checked={alleZeigen} onChange={e => setAlleZeigen(e.target.checked)}
              style={{ accentColor: accent }}/>
            Alle Kontakte durchsuchen (nicht nur die des Objekts)
          </label>
        )}
      </div>
      <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
        <button onClick={onCancel}
          style={{ flex: 1, padding: "10px 14px", borderRadius: RAD.sm, cursor: "pointer",
            fontFamily: "inherit", fontSize: FS.m, fontWeight: FW.medium,
            background: "transparent", border: `1px solid ${t.border}`, color: t.sub }}>
          Abbrechen
        </button>
        <button onClick={speichern}
          style={{ flex: 2, padding: "10px 14px", borderRadius: RAD.sm, cursor: "pointer",
            fontFamily: "inherit", fontSize: FS.m, fontWeight: FW.bold, border: "none",
            background: accent, color: getContrastColor(accent) }}>
          {submitText}
        </button>
      </div>
    </div>
  );
}

// ── TerminAnlegen: Inline-Formular für manuelle Kalender-Termine ─────────────
// Button-zu-Form-Muster (wie +Einheit, kein Modal). Pflicht: Titel, Datum,
// Objekt. Optional: Einheit, Kontakte. Kontakt-Auswahl bietet zunächst nur
// Kontakte MIT Bezug zum gewählten Objekt; per Schalter alle Kontakte —
// der Standard-KontaktPicker kann dort auch neue Kontakte anlegen.
// Die 5 gängigsten Termin-Bezeichnungen; „Andere…" öffnet ein Freitextfeld.
const TERMIN_VORSCHLAEGE = ["Objektbegehung", "Handwerkertermin", "Termin mit Eigentümer", "Wohnungsübergabe", "Besichtigung"];

function TerminAnlegen({ ves, kontakte, setKontakte, t, accent, onAnlegen, onCancel, start = null, abbrechenText = "Abbrechen", submitText = "Termin anlegen", objektFest = false, maxObjekte = 0 }) {
  const s0 = start || {};
  const [titel, setTitel] = useState(s0.titel || "");
  const [datum, setDatum] = useState(s0.datum || "");
  const [uhrzeit, setUhrzeit] = useState(s0.uhrzeit || "");
  const [dauer, setDauer] = useState(s0.dauer != null ? s0.dauer : null); // Minuten (number) | "ganztags" | null
  const [objektIds, setObjektIds] = useState(
    Array.isArray(s0.objektIds) ? s0.objektIds.slice()
    : (s0.objektId != null && s0.objektId !== "" ? [s0.objektId] : []));
  const [einheitIds, setEinheitIds] = useState(
    Array.isArray(s0.einheitIds) ? s0.einheitIds.slice()
    : (s0.einheitId != null ? [s0.einheitId] : []));
  const [kontaktIds, setKontaktIds] = useState(Array.isArray(s0.kontaktIds) ? s0.kontaktIds.slice() : []);
  const [alleZeigen, setAlleZeigen] = useState(false);
  const s0notizen = s0.notizen || "";
  const personenRollen = useRollen();
  const firmenRollen = useFirmenRollen();
  const farben = useKontaktFarbe();
  const zeitCfg = useZeitPicker();
  const dauerOptionen = (zeitCfg && zeitCfg.dauerOptionen) || [15, 30, 45, 60, 90, 120];
  // Bezeichnungs-Liste kommt aus den Einstellungen (SektionTerminVorlagen).
  // Fallback auf die alten festen Vorschläge, falls die Liste leer ist.
  const bezListe = useTerminBezeichnungen();
  const bezSichtbar = (bezListe || []).filter(b => b.sichtbar !== false);
  const bezLabels = (bezSichtbar.length > 0)
    ? bezSichtbar.map(b => b.label)
    : TERMIN_VORSCHLAEGE;
  const farbeFuerLabel = (lbl) => {
    const tr = (bezListe || []).find(b => b.label === lbl);
    return (tr && tr.farbe) || accent;
  };
  // Bezug der gewählten Bezeichnung: "keiner" | "objekt" | "einheit".
  // Freitext-Bezeichnungen (nicht in der Liste) → "objekt" als sinnvoller Default.
  const bezugFuerTitel = (lbl) => {
    const tr = (bezListe || []).find(b => b.label === lbl);
    return (tr && tr.bezug) || "objekt";
  };
  const bezug = bezugFuerTitel(titel.trim());
  const zeigtObjekt = bezug !== "keiner";
  const zeigtEinheit = bezug === "einheit";
  const autoRegelVon = (lbl) => {
    const tr = (bezListe || []).find(b => b.label === lbl);
    return (tr && tr.autoBeteiligte) || "keine";
  };
  const autoRegel = autoRegelVon(titel.trim());
  const ve = objektIds.length === 1
    ? ((ves || []).find(v => String(v.id) === String(objektIds[0])) || null)
    : null;
  // Auto-Beteiligte vorschlagen: sobald Bezeichnung + Objekt (+ggf. Einheit)
  // stehen, passende Personen zu kontaktIds ergänzen (nur hinzufügen, nie
  // entfernen — der Nutzer kann manuell wieder rausnehmen). Greift auch nach
  // Wechsel von Objekt/Einheit. Läuft nur, wenn eine Regel aktiv ist.
  useEffect(() => {
    if (autoRegel === "keine" || !ve) return;
    if (autoRegel !== "eigentuemer" && einheitIds.length === 0) return; // einheitbezogen: erst mit Einheit
    const auto = autoBeteiligteIds(ve, einheitIds, autoRegel);
    if (auto.length === 0) return;
    setKontaktIds(prev => {
      const next = prev.slice();
      auto.forEach(id => { if (next.indexOf(id) < 0) next.push(id); });
      return next.length === prev.length ? prev : next;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [titel, objektIds, einheitIds, autoRegel]);
  // Einheiten kanonisch aus den Liegenschafts-Karten, Fallback ve.einheiten.
  const einheiten = (() => {
    if (!ve) return [];
    const aus = [];
    (ve.karten || []).forEach(k => ((k && k.einheiten) || []).forEach(e => e && aus.push(e)));
    return aus.length > 0 ? aus : (ve.einheiten || []);
  })();
  const objektKontakte = ve && !alleZeigen
    ? (kontakte || []).filter(k => objektBezugInfo(k, ve, personenRollen, firmenRollen, farben).hatBezug)
    : (kontakte || []);
  const gewaehlte = kontaktIds.map(id => (kontakte || []).find(k => k && k.id === id)).filter(Boolean);
  const nameVon = (k) => k.typ === "firma" ? (k.name || "") : (((k.vorname || "") + " " + (k.nachname || "")).trim() || k.name || "");
  // Bezug steuert nur, WELCHE Felder erscheinen — nicht, was Pflicht ist.
  // Pflicht ist immer nur Bezeichnung + Datum; Objekt/Einheit bleiben optional.
  const gueltig = titel.trim() && datum;
  const labelStyle = { fontSize: FS.xs, fontWeight: FW.bold, color: t.muted,
    textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4 };
  return (
    <div>
      <div style={{ marginBottom: 10 }}>
        <div style={labelStyle}>Bezeichnung</div>
        {/* Dropdown mit den 5 gängigsten Vorschlägen + „Andere…"-Freitext.
            Freitext-Modus aus dem Wert abgeleitet (Muster wie VertragForm):
            nicht leer und nicht in den Optionen → Freitext; " " = leerer
            Freitext-Start, trim() hält den Anlegen-Button bis zur Eingabe zu. */}
        <select value={titel && bezLabels.indexOf(titel) < 0 ? ANDERE_OPTION : titel}
          onChange={e => { const v = e.target.value; setTitel(v === ANDERE_OPTION ? " " : v); }}
          style={{ ...feldInput(t), width: "100%", color: titel ? t.text : t.muted }}>
          <option value="">Bezeichnung wählen…</option>
          {bezLabels.map(o => <option key={o} value={o}>{o}</option>)}
          <option value={ANDERE_OPTION}>{ANDERE_OPTION}</option>
        </select>
        {titel && bezLabels.indexOf(titel) < 0 && (
          <input type="text" autoFocus placeholder="Eigene Bezeichnung eingeben…"
            value={titel === " " ? "" : titel} onChange={e => setTitel(e.target.value)}
            style={{ width: "100%", boxSizing: "border-box", marginTop: 6, background: t.surface,
              border: `1px solid ${t.border}`, borderRadius: RAD.sm, padding: "9px 10px",
              fontSize: 16, color: t.text, outline: "none", fontFamily: "inherit" }}/>
        )}
      </div>
      {zeigtObjekt && !objektFest && (
        <div style={{ marginBottom: 10 }}>
          <div style={labelStyle}>{maxObjekte === 1 ? "Objekt" : "Objekte"} <span style={{ fontWeight: FW.regular, textTransform: "none" }}>(optional{maxObjekte === 1 ? "" : ", mehrere möglich"})</span></div>
          {(ves || []).length > 0 ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {(ves || []).map(v => {
                const checked = objektIds.some(x => String(x) === String(v.id));
                return (
                  <button key={v.id}
                    onClick={() => setObjektIds(prev => {
                      const drin = prev.some(x => String(x) === String(v.id));
                      // maxObjekte===1 (z. B. Bearbeiten): Single-Select.
                      let next;
                      if (maxObjekte === 1) {
                        next = drin ? [] : [v.id];
                      } else {
                        next = drin
                          ? prev.filter(x => String(x) !== String(v.id))
                          : [...prev, v.id];
                      }
                      setEinheitIds([]); setKontaktIds([]); setAlleZeigen(false);
                      return next;
                    })}
                    style={{ display: "flex", alignItems: "center", gap: 10,
                      padding: "10px 12px", borderRadius: RAD.ms, cursor: "pointer",
                      fontFamily: "inherit", textAlign: "left",
                      background: checked ? accent + "1E" : t.surface,
                      border: `1px solid ${checked ? accent : t.border}` }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: FS.m, fontWeight: FW.bold, color: t.text,
                        overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{v.nr || ("Objekt " + v.id)}</div>
                      {v.adresse && (
                        <div style={{ fontSize: FS.xs, color: t.sub, marginTop: 1,
                          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{v.adresse}</div>
                      )}
                    </div>
                    <span style={{ width: 18, height: 18, flexShrink: 0, borderRadius: RAD.xs,
                      border: `1.5px solid ${checked ? accent : t.border}`,
                      background: checked ? accent : "transparent",
                      display: "flex", alignItems: "center", justifyContent: "center" }}>
                      {checked && <I name="check" size={11} color={getContrastColor(accent)}/>}
                    </span>
                  </button>
                );
              })}
            </div>
          ) : (
            <div style={{ fontSize: FS.s, color: t.muted, fontStyle: "italic" }}>Keine Objekte vorhanden.</div>
          )}
          {objektIds.length > 1 && (
            <div style={{ fontSize: FS.xs, color: t.muted, marginTop: 8, fontStyle: "italic" }}>
              Bei mehreren Objekten wird der Termin an jedem angelegt. Einheiten-Auswahl entfällt.
            </div>
          )}
        </div>
      )}
      {zeigtObjekt && zeigtEinheit && ve && einheiten.length > 0 && (
        <div style={{ marginBottom: 10 }}>
          <div style={labelStyle}>Einheiten <span style={{ fontWeight: FW.regular, textTransform: "none" }}>(optional, mehrere möglich)</span></div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {einheiten.map(e => {
              const checked = einheitIds.some(x => String(x) === String(e.id));
              return (
                <button key={e.id}
                  onClick={() => setEinheitIds(prev => prev.some(x => String(x) === String(e.id))
                    ? prev.filter(x => String(x) !== String(e.id))
                    : [...prev, e.id])}
                  style={{ display: "flex", alignItems: "center", gap: 9,
                    padding: "10px 12px", borderRadius: RAD.ms, cursor: "pointer",
                    fontFamily: "inherit", textAlign: "left", fontSize: FS.m, color: t.text,
                    background: checked ? accent + "1E" : t.surface,
                    border: `1px solid ${checked ? accent : t.border}` }}>
                  <span style={{ flex: 1, minWidth: 0 }}>{e.bezeichnung || e.nr || ("Einheit " + e.id)}</span>
                  <span style={{ width: 18, height: 18, flexShrink: 0, borderRadius: RAD.xs,
                    border: `1.5px solid ${checked ? accent : t.border}`,
                    background: checked ? accent : "transparent",
                    display: "flex", alignItems: "center", justifyContent: "center" }}>
                    {checked && <I name="check" size={11} color={getContrastColor(accent)}/>}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}
      <div style={{ marginBottom: 10 }}>
        <div style={labelStyle}>Datum</div>
        <DatumFeld value={datum} t={t} accent={accent} defaultHeute={false} iso
          onChange={setDatum}/>
      </div>
      <div style={{ marginBottom: 10 }}>
        <div style={labelStyle}>Uhrzeit (optional)</div>
        <ZeitFeld value={uhrzeit} onChange={setUhrzeit} t={t} accent={accent}/>
      </div>
      <div style={{ marginBottom: 10 }}>
        <div style={labelStyle}>Dauer (optional)</div>
        <DauerWahl wert={dauer} onChange={setDauer} optionen={dauerOptionen}
          t={t} accent={accent}/>
      </div>
      {zeigtObjekt && ve && (
        <div style={{ marginBottom: 4 }}>
          <div style={labelStyle}>Kontakte</div>
          {gewaehlte.map(k => (
            <div key={k.id} style={{ display: "flex", alignItems: "center", gap: 8,
              padding: "6px 10px", marginBottom: 6, background: t.surface,
              border: `1px solid ${t.border}`, borderRadius: RAD.sm }}>
              <span style={{ fontSize: FS.icon }}>{k.typ === "firma" ? "🏢" : "👤"}</span>
              <span style={{ flex: 1, minWidth: 0, fontSize: FS.m, color: t.text,
                overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{nameVon(k)}</span>
              <button onClick={() => setKontaktIds(ids => ids.filter(x => x !== k.id))}
                title="Entfernen" aria-label="Entfernen"
                style={{ display: "flex", alignItems: "center", justifyContent: "center",
                  width: 22, height: 22, flexShrink: 0, cursor: "pointer", background: "transparent",
                  border: "none", fontFamily: "inherit" }}>
                <I name="x" size={12} color="#EF4444"/>
              </button>
            </div>
          ))}
          <KontaktPicker value={null} label={null} t={t} accent={accent}
            kontakte={objektKontakte} setKontakte={setKontakte}
            onChange={(id) => { if (id && kontaktIds.indexOf(id) < 0) setKontaktIds([...kontaktIds, id]); }}/>
          <label style={{ display: "flex", alignItems: "center", gap: 7, marginTop: 2,
            fontSize: FS.s, color: t.sub, cursor: "pointer", userSelect: "none" }}>
            <input type="checkbox" checked={alleZeigen} onChange={e => setAlleZeigen(e.target.checked)}
              style={{ accentColor: accent }}/>
            Alle Kontakte durchsuchen (nicht nur die des Objekts)
          </label>
        </div>
      )}
      <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
        <AktionsButton variante="breit" rolle="abbrechen" onClick={onCancel}
          text={abbrechenText} icon={false} flex={1} t={t} accent={accent}/>
        <AktionsButton variante="breit" rolle="bestaetigen" disabled={!gueltig}
          text={submitText} icon={false} flex={2} t={t} accent={accent}
          onClick={() => {
            if (!gueltig) return;
            const baseId = Date.now();
            const einzelObjekt = objektIds.length === 1;
            const baue = (oid, idx) => ({
              id: baseId + idx, titel: titel.trim(), datum: datum, uhrzeit: uhrzeit || "",
              farbe: farbeFuerLabel(titel.trim()),
              dauer: dauer != null ? dauer : null,
              notizen: s0notizen,
              einheitIds: (zeigtEinheit && einzelObjekt && oid)
                ? einheitIds.map(x => isNaN(Number(x)) ? x : Number(x))
                : [],
              kontaktIds: (zeigtObjekt && oid) ? kontaktIds.slice() : [],
            });
            if (zeigtObjekt && objektIds.length > 0) {
              objektIds.forEach((oid, idx) => onAnlegen(baue(oid, idx), oid));
            } else {
              onAnlegen(baue("", 0), "");
            }
          }}/>
      </div>
    </div>
  );
}

// ── TerminAssistent: geführter Schritt-für-Schritt-Modus ────────────────────
// Auto-weiter bei Auswahl. Schritte: Bezeichnung → Objekt → (Einheit) → Datum
// → Uhrzeit → Dauer → Kontakte → Kontrolle. Optionale Schritte (Uhrzeit/Dauer/
// Kontakte) überspringbar. Bezug der Bezeichnung blendet Objekt/Einheit aus.
function TerminAssistent({ ves, kontakte, setKontakte, t, accent, onAnlegen, onCancel, start = null, objektFest = false }) {
  const a0 = start || {};
  const [titel, setTitel] = useState(a0.titel || "");
  const [datum, setDatum] = useState(a0.datum || "");
  const [uhrzeit, setUhrzeit] = useState(a0.uhrzeit || "");
  const [dauer, setDauer] = useState(a0.dauer != null ? a0.dauer : null);
  // Mehrfach-Objekt-Auswahl: objektIds ist die Formular-Auswahl. Beim Speichern
  // wird PRO Objekt eine eigene Termin-Kopie geschrieben (jede mit ihrer
  // objektId) — das Termin-Modell selbst bleibt single-objektId, was Anzeige/
  // Speicherung stabil hält. `ve` ist nur bei GENAU 1 Objekt gesetzt (Einheiten
  // gehören zu einem Objekt).
  const [objektIds, setObjektIds] = useState(
    Array.isArray(a0.objektIds) ? a0.objektIds.slice()
    : (a0.objektId != null && a0.objektId !== "" ? [a0.objektId] : []));
  const [einheitIds, setEinheitIds] = useState(
    Array.isArray(a0.einheitIds) ? a0.einheitIds.slice()
    : (a0.einheitId != null ? [a0.einheitId] : []));
  const [kontaktIds, setKontaktIds] = useState(Array.isArray(a0.kontaktIds) ? a0.kontaktIds.slice() : []);
  const [alleZeigen, setAlleZeigen] = useState(false);
  const [schritt, setSchritt] = useState(0);
  const [zeitReset, setZeitReset] = useState(0); // erhöht sich nur beim Löschen → ZeitWahl neu mounten
  const personenRollen = useRollen();
  const firmenRollen = useFirmenRollen();
  const farben = useKontaktFarbe();
  const zeitCfg = useZeitPicker();
  const dauerOptionen = (zeitCfg && zeitCfg.dauerOptionen) || [15, 30, 45, 60, 90, 120];
  const bezListe = useTerminBezeichnungen();
  const bezSichtbar = (bezListe || []).filter(b => b.sichtbar !== false);
  const farbeFuerLabel = (lbl) => {
    const tr = (bezListe || []).find(b => b.label === lbl);
    return (tr && tr.farbe) || accent;
  };
  const bezugFuerTitel = (lbl) => {
    const tr = (bezListe || []).find(b => b.label === lbl);
    return (tr && tr.bezug) || "objekt";
  };
  const bezug = bezugFuerTitel(titel.trim());
  const zeigtObjekt = bezug !== "keiner";
  const zeigtEinheit = bezug === "einheit";
  const autoRegelVon = (lbl) => {
    const tr = (bezListe || []).find(b => b.label === lbl);
    return (tr && tr.autoBeteiligte) || "keine";
  };
  const autoRegel = autoRegelVon(titel.trim());

  // ve nur bei GENAU 1 gewähltem Objekt (Einheiten/Auto-Beteiligte hängen an
  // einem konkreten Objekt). Bei mehreren Objekten kein einzelnes ve.
  const ve = objektIds.length === 1
    ? ((ves || []).find(v => String(v.id) === String(objektIds[0])) || null)
    : null;
  // Auto-Beteiligte vorschlagen (nur hinzufügen, entfernbar) — wie im Formular.
  useEffect(() => {
    if (autoRegel === "keine" || !ve) return;
    if (autoRegel !== "eigentuemer" && einheitIds.length === 0) return;
    const auto = autoBeteiligteIds(ve, einheitIds, autoRegel);
    if (auto.length === 0) return;
    setKontaktIds(prev => {
      const next = prev.slice();
      auto.forEach(id => { if (next.indexOf(id) < 0) next.push(id); });
      return next.length === prev.length ? prev : next;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [titel, objektIds, einheitIds, autoRegel]);
  const einheiten = (() => {
    if (!ve) return [];
    const aus = [];
    (ve.karten || []).forEach(k => ((k && k.einheiten) || []).forEach(e => e && aus.push(e)));
    return aus.length > 0 ? aus : (ve.einheiten || []);
  })();
  // Alle gewählten Objekte (für Mehrfach-Objekt: Kontaktquelle + Avatar-Badges
  // über ALLE gewählten Objekte sammeln, nicht nur ein einzelnes ve).
  const gewaehlteVes = objektIds
    .map(oid => (ves || []).find(v => String(v.id) === String(oid)))
    .filter(Boolean);
  const objektKontakte = (gewaehlteVes.length > 0 && !alleZeigen)
    ? (kontakte || []).filter(k => gewaehlteVes.some(gv =>
        objektBezugInfo(k, gv, personenRollen, firmenRollen, farben).hatBezug))
    : (kontakte || []);
  const gewaehlte = kontaktIds.map(id => (kontakte || []).find(k => k && k.id === id)).filter(Boolean);
  const nameVon = (k) => k.typ === "firma" ? (k.name || "") : (((k.vorname || "") + " " + (k.nachname || "")).trim() || k.name || "");

  // Aktive Schritte dynamisch (je nach Bezug). "kontrolle" immer am Ende.
  // Bei objektFest entfällt der Objekt-Schritt (Objekt steht bereits fest).
  const schritte = ["bezeichnung"];
  if (zeigtObjekt && !objektFest) schritte.push("objekt");
  if (zeigtEinheit && objektIds.length === 1) schritte.push("einheit");
  schritte.push("datum", "zeit", "kontakte", "kontrolle");
  const aktiv = schritte[Math.min(schritt, schritte.length - 1)];

  const weiter = () => setSchritt(s => Math.min(s + 1, schritte.length - 1));
  const zurueck = () => setSchritt(s => Math.max(s - 1, 0));

  const objektName = (id) => {
    const v = (ves || []).find(x => String(x.id) === String(id));
    return v ? (v.nr || ("Objekt " + id)) : "—";
  };
  const einheitName = (id) => {
    const e = einheiten.find(x => String(x.id) === String(id));
    return e ? (e.bezeichnung || e.nr || ("Einheit " + id)) : "—";
  };

  const anlegen = () => {
    if (!titel.trim() || !datum) return;
    // Gemeinsame Termin-Basis. Einheiten nur bei genau 1 Objekt (zeigtEinheit).
    const baseId = Date.now();
    const einzelObjekt = objektIds.length === 1;
    const baue = (objektId, idx) => ({
      id: baseId + idx, titel: titel.trim(), datum: datum, uhrzeit: uhrzeit || "",
      farbe: farbeFuerLabel(titel.trim()),
      dauer: dauer != null ? dauer : null,
      einheitIds: (zeigtEinheit && einzelObjekt && objektId)
        ? einheitIds.map(x => isNaN(Number(x)) ? x : Number(x))
        : [],
      kontaktIds: (zeigtObjekt && objektId) ? kontaktIds.slice() : [],
    });
    if (zeigtObjekt && objektIds.length > 0) {
      // Pro gewähltem Objekt eine eigene Kopie (jeweils mit eigener objektId).
      objektIds.forEach((oid, idx) => onAnlegen(baue(oid, idx), oid));
    } else {
      // Kein Objektbezug → ein freier Termin.
      onAnlegen(baue("", 0), "");
    }
  };

  const labelStyle = { fontSize: FS.xs, fontWeight: FW.bold, color: t.muted,
    textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 };
  const kontrollZeile = (lbl, wert) => (
    <div style={{ display: "flex", justifyContent: "space-between", gap: 10,
      padding: "7px 0", borderBottom: `1px solid ${t.border}25` }}>
      <span style={{ fontSize: FS.s, color: t.muted }}>{lbl}</span>
      <span style={{ fontSize: FS.s, fontWeight: FW.bold, color: t.text,
        textAlign: "right" }}>{wert}</span>
    </div>
  );

  // Welcher Schritt erlaubt „Weiter" überhaupt? (Pflicht nur: Bezeichnung gesetzt,
  // und beim Datum ein Datum.) Optionale Schritte sind immer „weiter"-fähig.
  const stepIdx = schritte.indexOf(aktiv);
  const istLetzter = aktiv === "kontrolle";
  const weiterErlaubt = (() => {
    if (aktiv === "bezeichnung") return !!titel.trim();
    if (aktiv === "datum") return !!datum;
    return true;
  })();
  const weiterText = istLetzter ? "Speichern" : "Weiter";
  const onWeiterFn = istLetzter ? anlegen : weiter;

  // Inhalt des aktiven Schritts (ohne eigenen Rahmen/Kopf/X — das macht der Wizard).
  const inhalt = (
    <>
      {aktiv === "bezeichnung" && (
        <div>
          <div style={labelStyle}>Welcher Termin?</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {bezSichtbar.map(b => (
              <button key={b.id}
                onClick={() => { setTitel(b.label); if (!objektFest) setObjektIds([]); setEinheitIds([]); setKontaktIds([]);
                  setTimeout(weiter, 0); }}
                style={{ display: "flex", alignItems: "center", gap: 10, padding: "11px 12px",
                  borderRadius: RAD.ms, cursor: "pointer", fontFamily: "inherit", textAlign: "left",
                  background: titel === b.label ? (b.farbe || accent) + "1E" : t.surface,
                  border: `1px solid ${titel === b.label ? (b.farbe || accent) : t.border}` }}>
                <span style={{ width: 26, height: 26, borderRadius: RAD.ms, flexShrink: 0,
                  background: (b.farbe || accent) + "20", display: "flex", alignItems: "center",
                  justifyContent: "center" }}>
                  <I name="calendar" size={13} color={b.farbe || accent}/>
                </span>
                <span style={{ flex: 1, minWidth: 0, fontSize: FS.m, fontWeight: FW.medium,
                  color: t.text }}>{b.label}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {aktiv === "objekt" && (
        <div>
          <div style={labelStyle}>Welche Objekte? <span style={{ textTransform: "none", fontWeight: FW.regular, color: t.muted }}>(optional, mehrere möglich)</span></div>
          {(ves || []).length > 0 ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {(ves || []).map(v => {
                const checked = objektIds.some(x => String(x) === String(v.id));
                return (
                  <button key={v.id}
                    onClick={() => setObjektIds(prev => {
                      const drin = prev.some(x => String(x) === String(v.id));
                      const next = drin
                        ? prev.filter(x => String(x) !== String(v.id))
                        : [...prev, v.id];
                      // Objektwechsel: Einheiten/Kontakte zurücksetzen, da objektbezogen.
                      setEinheitIds([]); setKontaktIds([]); setAlleZeigen(false);
                      return next;
                    })}
                    style={{ display: "flex", alignItems: "center", gap: 10,
                      padding: "11px 12px", borderRadius: RAD.ms, cursor: "pointer",
                      fontFamily: "inherit", textAlign: "left",
                      background: checked ? accent + "1E" : t.surface,
                      border: `1px solid ${checked ? accent : t.border}` }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: FS.m, fontWeight: FW.bold, color: t.text,
                        overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{v.nr || ("Objekt " + v.id)}</div>
                      {v.adresse && (
                        <div style={{ fontSize: FS.xs, color: t.sub, marginTop: 1,
                          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{v.adresse}</div>
                      )}
                    </div>
                    <span style={{ width: 18, height: 18, flexShrink: 0, borderRadius: RAD.xs,
                      border: `1.5px solid ${checked ? accent : t.border}`,
                      background: checked ? accent : "transparent",
                      display: "flex", alignItems: "center", justifyContent: "center" }}>
                      {checked && <I name="check" size={11} color={getContrastColor(accent)}/>}
                    </span>
                  </button>
                );
              })}
            </div>
          ) : (
            <div style={{ fontSize: FS.s, color: t.muted, fontStyle: "italic" }}>Keine Objekte vorhanden.</div>
          )}
          {objektIds.length > 1 && (
            <div style={{ fontSize: FS.xs, color: t.muted, marginTop: 8, fontStyle: "italic" }}>
              Bei mehreren Objekten wird der Termin an jedem angelegt. Einheiten-Auswahl entfällt.
            </div>
          )}
        </div>
      )}

      {aktiv === "einheit" && (
        <div>
          <div style={labelStyle}>Welche Einheiten? <span style={{ textTransform: "none", fontWeight: FW.regular, color: t.muted }}>(optional, mehrere möglich)</span></div>
          {ve && einheiten.length > 0 ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {einheiten.map(e => {
                const checked = einheitIds.some(x => String(x) === String(e.id));
                return (
                  <button key={e.id}
                    onClick={() => setEinheitIds(prev => prev.some(x => String(x) === String(e.id))
                      ? prev.filter(x => String(x) !== String(e.id))
                      : [...prev, e.id])}
                    style={{ display: "flex", alignItems: "center", gap: 9,
                      padding: "11px 12px", borderRadius: RAD.ms, cursor: "pointer",
                      fontFamily: "inherit", textAlign: "left", fontSize: FS.m, color: t.text,
                      background: checked ? accent + "1E" : t.surface,
                      border: `1px solid ${checked ? accent : t.border}` }}>
                    <span style={{ flex: 1, minWidth: 0 }}>{e.bezeichnung || e.nr || ("Einheit " + e.id)}</span>
                    <span style={{ width: 18, height: 18, flexShrink: 0, borderRadius: RAD.xs,
                      border: `1.5px solid ${checked ? accent : t.border}`,
                      background: checked ? accent : "transparent",
                      display: "flex", alignItems: "center", justifyContent: "center" }}>
                      {checked && <I name="check" size={11} color={getContrastColor(accent)}/>}
                    </span>
                  </button>
                );
              })}
            </div>
          ) : (
            <div style={{ fontSize: FS.s, color: t.muted, fontStyle: "italic" }}>
              {ve ? "Dieses Objekt hat keine Einheiten." : "Erst ein Objekt wählen."}
            </div>
          )}
        </div>
      )}

      {aktiv === "datum" && (
        <div>
          <div style={labelStyle}>Wann?</div>
          <DatumKalender startWert={datum || null} t={t} accent={accent} iso hoehe={300}
            onWaehle={(d) => { setDatum(d); setTimeout(weiter, 0); }}/>
        </div>
      )}

      {aktiv === "zeit" && (
        <div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
            <span style={labelStyle}>Uhrzeit <span style={{ textTransform: "none", fontWeight: FW.regular, color: t.muted }}>(optional)</span></span>
            <button onClick={() => { setUhrzeit(""); setZeitReset(z => z + 1); }}
              disabled={!uhrzeit}
              style={{ padding: "3px 9px", borderRadius: RAD.sm, fontFamily: "inherit",
                fontSize: FS.xs, fontWeight: FW.bold, background: "transparent",
                cursor: uhrzeit ? "pointer" : "default",
                border: `1px solid ${uhrzeit ? t.border : "transparent"}`,
                color: uhrzeit ? t.sub : "transparent" }}>Löschen</button>
          </div>
          {/* Anzeige immer sichtbar (Platzhalter --:--), damit nichts springt */}
          <div style={{ textAlign: "center", marginBottom: 12 }}>
            <span style={{ fontSize: FS.xxl, fontWeight: FW.heavy,
              color: uhrzeit ? accent : t.border, letterSpacing: "0.02em" }}>
              {uhrzeit || "--:--"}
            </span>
          </div>
          <ZeitWahl key={zeitReset} startWert={uhrzeit} t={t} accent={accent}
            onWaehle={(u) => setUhrzeit(u)}/>
          <div style={{ ...labelStyle, marginTop: 14 }}>Dauer <span style={{ textTransform: "none", fontWeight: FW.regular, color: t.muted }}>(optional)</span></div>
          <DauerWahl wert={dauer} onChange={setDauer}
            t={t} accent={accent}/>
        </div>
      )}

      {aktiv === "kontakte" && (
        <div>
          <div style={labelStyle}>Beteiligte <span style={{ textTransform: "none", fontWeight: FW.regular, color: t.muted }}>(optional)</span></div>
          {!zeigtObjekt && (
            <div style={{ fontSize: FS.s, color: t.muted, marginBottom: 8 }}>
              Ohne Objektbezug kannst du hier beliebige Kontakte hinzufügen.
            </div>
          )}
          {/* Direkt anklickbare Kontaktliste: Avatar + Name + WE/Bezug + Häkchen.
              Quelle: objektbezogene Kontakte (oder alle, wenn umgeschaltet). */}
          {(() => {
            const liste = (gewaehlteVes.length > 0 && !alleZeigen)
              ? objektKontakte
              : (kontakte || []);
            if (liste.length === 0) {
              return (
                <div style={{ fontSize: FS.s, color: t.muted, fontStyle: "italic", padding: "8px 2px" }}>
                  Keine Kontakte vorhanden.
                </div>
              );
            }
            const nameVonK = (k) => k.typ === "firma"
              ? (k.name || "")
              : (((k.vorname || "") + " " + (k.nachname || "")).trim() || k.name || "");
            // Bezug (WE/Einheit oder Rolle) für die Unterzeile — über alle
            // gewählten Objekte hinweg (erstes passendes gewinnt).
            const bezugVon = (k) => {
              for (const gv of gewaehlteVes) {
                const zuw = (k.objektZuweisungen || []).find(z => z.objektId === gv.id && z.einheitId != null);
                if (zuw) {
                  let eh = (gv.einheiten || []).find(e => e.id === zuw.einheitId);
                  if (!eh) { (gv.karten || []).forEach(ka => ((ka.einheiten) || []).forEach(e => { if (e.id === zuw.einheitId) eh = e; })); }
                  if (eh) return eh.bezeichnung || eh.nr || "";
                }
                const rolleZ = (k.objektZuweisungen || []).find(z => z.objektId === gv.id && z.rolle);
                if (rolleZ) return rolleZ.rolle;
              }
              return "";
            };
            return (
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {liste.map(k => {
                  const checked = kontaktIds.indexOf(k.id) >= 0;
                  const istFirma = k.typ === "firma";
                  const objektZuw = gewaehlteVes.length > 0
                    ? (k.objektZuweisungen || []).filter(z => gewaehlteVes.some(gv => z.objektId === gv.id))
                    : [];
                  const bezug = bezugVon(k);
                  return (
                    <button key={k.id}
                      onClick={() => setKontaktIds(prev => prev.indexOf(k.id) >= 0
                        ? prev.filter(x => x !== k.id)
                        : [...prev, k.id])}
                      style={{ display: "flex", alignItems: "center", gap: 10,
                        padding: "9px 11px", borderRadius: RAD.ms, cursor: "pointer",
                        fontFamily: "inherit", textAlign: "left", width: "100%",
                        background: checked ? accent + "1E" : t.surface,
                        border: `1px solid ${checked ? accent : t.border}` }}>
                      <Avatar name={nameVonK(k)} firma={istFirma} size={32} accent={accent}
                        zuweisungen={istFirma ? null : objektZuw}/>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: FS.m, fontWeight: FW.bold, color: t.text,
                          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{nameVonK(k)}</div>
                        {bezug && (
                          <div style={{ fontSize: FS.xs, color: t.sub, marginTop: 1,
                            overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{bezug}</div>
                        )}
                      </div>
                      <span style={{ width: 20, height: 20, flexShrink: 0, borderRadius: RAD.xs,
                        border: `1.5px solid ${checked ? accent : t.border}`,
                        background: checked ? accent : "transparent",
                        display: "flex", alignItems: "center", justifyContent: "center" }}>
                        {checked && <I name="check" size={12} color={getContrastColor(accent)}/>}
                      </span>
                    </button>
                  );
                })}
              </div>
            );
          })()}
          {zeigtObjekt && gewaehlteVes.length > 0 && (
            <label style={{ display: "flex", alignItems: "center", gap: 7, marginTop: 10,
              fontSize: FS.s, color: t.sub, cursor: "pointer", userSelect: "none" }}>
              <input type="checkbox" checked={alleZeigen} onChange={e => setAlleZeigen(e.target.checked)}
                style={{ accentColor: accent }}/>
              Alle Kontakte durchsuchen
            </label>
          )}
          {/* Neuanlage / Suche für Kontakte, die nicht in der Liste stehen. */}
          <div style={{ marginTop: 10 }}>
            <KontaktPicker value={null} label={null} t={t} accent={accent}
              kontakte={zeigtObjekt ? objektKontakte : (kontakte || [])} setKontakte={setKontakte}
              onChange={(id) => { if (id && kontaktIds.indexOf(id) < 0) setKontaktIds([...kontaktIds, id]); }}/>
          </div>
        </div>
      )}

      {aktiv === "kontrolle" && (
        <div>
          <div style={{ fontSize: FS.s, color: t.muted, marginBottom: 10 }}>
            Alles erfasst — hier kannst du noch prüfen und anpassen.
          </div>
          {kontrollZeile("Termin", titel.trim() || "—")}
          {zeigtObjekt && kontrollZeile(objektIds.length > 1 ? "Objekte" : "Objekt",
            objektIds.length > 0 ? objektIds.map(objektName).join(", ") : "—")}
          {zeigtEinheit && objektIds.length === 1 && kontrollZeile("Einheiten", einheitIds.length > 0
            ? einheitIds.map(einheitName).join(", ") : "—")}
          {kontrollZeile("Datum", datum ? datumAnzeige(datum) : "—")}
          {kontrollZeile("Uhrzeit", uhrzeit || "—")}
          {kontrollZeile("Dauer", dauer != null ? dauerText(dauer) : "—")}
          {kontrollZeile("Beteiligte", gewaehlte.length > 0
            ? gewaehlte.map(nameVon).join(", ") : "—")}
        </div>
      )}
    </>
  );

  return (
    <WizardDialog
      titel="Neuer Termin"
      anzahl={schritte.length}
      aktivIdx={stepIdx}
      accent={accent}
      t={t}
      onClose={onCancel}
      onZurueck={stepIdx > 0 ? zurueck : null}
      onWeiter={onWeiterFn}
      weiterText={weiterText}
      weiterAktiv={weiterErlaubt}>
      {inhalt}
    </WizardDialog>
  );
}

// ── KalenderPanel — Orientierungskalender, schiebt sich von rechts ein ──────
//   4 Zoom-Stufen: jahr (Mini-Raster, Tage nur farbig) → monat (Raster mit
//   KW + Punkten) → detail (Agenda je KW mit Termintiteln) → tag (volle
//   Terminblöcke mit Uhrzeit + Typ). Einstellungen: settings.kalWochenstart
//   ("mo"|"so"), settings.kalKw (KW-Spalte), settings.kalZoom (Start-Stufe).
//   Fenster = gleiche 12 Monate wie sammleTermine. Klick zoomt eine Stufe
//   rein und scrollt zum angeklickten Monat/Tag (Anchor-IDs, DESIGN-Prinzip
//   karten-relatives Scrollen).
function isoKW(d) {
  // ISO-8601-Kalenderwoche (Montag-basiert).
  const dt = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const tag = (dt.getDay() + 6) % 7; // Mo=0..So=6
  dt.setDate(dt.getDate() - tag + 3); // Donnerstag der Woche
  const jan4 = new Date(dt.getFullYear(), 0, 4);
  const jan4Tag = (jan4.getDay() + 6) % 7;
  const woche1Do = new Date(jan4.getFullYear(), 0, 4 - jan4Tag + 3);
  return 1 + Math.round((dt - woche1Do) / (7 * 24 * 3600 * 1000));
}
const KAL_ZOOM_STUFEN = [
  { id: "monat",  label: "Monat" },
  { id: "woche",  label: "Woche" },
  { id: "tag",    label: "Tag" },
];
// Minuten seit Mitternacht aus "HH:MM" (null wenn keine Uhrzeit).
function kalMinVon(uhrzeit) {
  if (!uhrzeit) return null;
  const p = String(uhrzeit).split(":");
  const h = parseInt(p[0], 10); const m = parseInt(p[1], 10);
  if (isNaN(h)) return null;
  return h * 60 + (isNaN(m) ? 0 : m);
}
// ── KalTagStreifen — horizontaler 0–24h-Zeitstrahl eines Tages ──────────────
//   Arbeitstag-Fenster abgesetzt, Stundenraster, 6h-Marker, ganztägige
//   Einträge als Quadrate links, Uhrzeit-Termine als Kreise an ihrer Stunde,
//   roter Faden (aktuelle Uhrzeit) am heutigen Tag. Reine Render-Funktion —
//   keine Hooks (§14), jetztMin kommt als Prop.
// Arbeitszeit-Fenster für ein konkretes Datum, abhängig vom Wochentag.
// Liefert { an, von, bis }. Regeln:
//   - kalArbeitTageAktiv === true: tagesspezifische Tabelle kalArbeitTage gilt.
//     Fehlt ein Tag in der Tabelle, fällt er auf die globale Zeit zurück
//     (Mo–Fr an, Sa/So aus — als sinnvoller Default).
//   - sonst: globale kalArbeitVon/Bis für ALLE Tage (Altverhalten), an=true.
// von/bis sind ganze Stunden (0–24), bis > von garantiert.
function tagArbeitszeit(settings, date) {
  const gVon = (settings && settings.kalArbeitVon != null) ? settings.kalArbeitVon : 8;
  const gBis = (settings && settings.kalArbeitBis != null) ? settings.kalArbeitBis : 17;
  const clamp = (von, bis) => {
    const v = Math.max(0, Math.min(23, von == null ? 8 : von));
    const b = Math.max(v + 1, Math.min(24, bis == null ? 17 : bis));
    return { von: v, bis: b };
  };
  if (!settings || !settings.kalArbeitTageAktiv) {
    // Einheitlich: Werktage (Mo–Fr) arbeiten, Wochenende (Sa/So) frei — so
    // setzt sich das Wochenende von Anfang an ab, ohne Pro-Wochentag-Modus.
    const tagE = date ? date.getDay() : 1;
    const werktagE = tagE >= 1 && tagE <= 5;
    const c = clamp(gVon, gBis);
    return { an: werktagE, von: c.von, bis: c.bis };
  }
  const tag = date ? date.getDay() : 1; // 0=So … 6=Sa
  const tabelle = settings.kalArbeitTage || {};
  const e = tabelle[tag];
  if (e) {
    if (e.an === false) return { an: false, von: gVon, bis: gBis };
    const c = clamp(e.von != null ? e.von : gVon, e.bis != null ? e.bis : gBis);
    return { an: true, von: c.von, bis: c.bis };
  }
  // Fallback ohne Tabelleneintrag: Mo–Fr an (globale Zeit), Sa/So aus.
  const werktag = tag >= 1 && tag <= 5;
  const c = clamp(gVon, gBis);
  return { an: werktag, von: c.von, bis: c.bis };
}

function KalTagStreifen({ eintraege, t, accent, arbeitVon, arbeitBis, hoehe, istHeute, jetztMin, arbeitFrei = false }) {
  const ganztags = (eintraege || []).filter(x => !x.uhrzeit);
  const zeitig = (eintraege || []).filter(x => !!x.uhrzeit);
  const von = Math.max(0, Math.min(23, arbeitVon == null ? 8 : arbeitVon));
  const bis = Math.max(von + 1, Math.min(24, arbeitBis == null ? 17 : arbeitBis));
  return (
    <div style={{ position: "relative", height: hoehe,
      background: t.card,
      border: `1px solid ${t.border}40`,
      borderRadius: 4, overflow: "hidden" }}>
      {/* Arbeitstag-Fenster — optisch abgesetzt (entfällt an arbeitsfreien Tagen) */}
      {!arbeitFrei ? (
        <div style={{ position: "absolute", top: 0, bottom: 0,
          left: (von / 24 * 100) + "%", width: ((bis - von) / 24 * 100) + "%",
          background: accent + "12" }}/>
      ) : null}
      {/* Stundenraster (dezent) */}
      <div style={{ position: "absolute", top: 0, right: 0, bottom: 0, left: 0,
        backgroundImage: `repeating-linear-gradient(to right, ${t.border}30 0, ${t.border}30 1px, transparent 1px, transparent ${100/24}%)` }}/>
      {/* 6h-Marker stärker */}
      <div style={{ position: "absolute", top: 0, bottom: 0, left: "25%", width: 1, background: t.border }}/>
      <div style={{ position: "absolute", top: 0, bottom: 0, left: "50%", width: 1, background: t.border }}/>
      <div style={{ position: "absolute", top: 0, bottom: 0, left: "75%", width: 1, background: t.border }}/>
      {/* Ganztägige (Fristen) — Quadrate links gestapelt */}
      {ganztags.slice(0, 4).map((x, i) => (
        <div key={"g" + i} title={x.titel}
          style={{ position: "absolute", left: 3 + i * 10, top: "50%",
            transform: "translateY(-50%)", width: 7, height: 7, borderRadius: 2,
            background: x.farbe || accent }}/>
      ))}
      {/* Uhrzeit-Termine — Kreise an ihrer Stunde */}
      {zeitig.map((x, i) => {
        const min = kalMinVon(x.uhrzeit) || 0;
        return (
          <div key={"z" + i} title={(x.uhrzeit || "") + " " + x.titel}
            style={{ position: "absolute", left: `calc(${min / 1440 * 100}% - 5px)`,
              top: "50%", transform: "translateY(-50%)", width: 10, height: 10,
              borderRadius: 5, background: x.farbe || accent,
              border: `1px solid ${t.bg}`, zIndex: 1 }}/>
        );
      })}
      {/* Roter Faden — aktuelle Uhrzeit am heutigen Tag, 1px rot */}
      {istHeute ? (
        <div style={{ position: "absolute", top: 0, bottom: 0,
          left: (jetztMin / 1440 * 100) + "%", width: 1,
          background: "#EF4444", zIndex: 2 }}/>
      ) : null}
    </div>
  );
}
// Stundenskala (0/6/12/18/24) über Streifen — gemeinsame Achse.
function KalStundenSkala({ t, links = 0 }) {
  const stunden = [0, 6, 12, 18, 24];
  return (
    <div style={{ position: "relative", height: 12, marginLeft: links, marginBottom: 2 }}>
      {stunden.map(h => (
        <div key={h} style={{ position: "absolute", top: 0,
          left: (h / 24 * 100) + "%", transform: "translateX(-50%)",
          fontSize: 8, color: t.muted }}>{h}</div>
      ))}
    </div>
  );
}
const KAL_MONATSNAMEN = ["Januar","Februar","März","April","Mai","Juni",
  "Juli","August","September","Oktober","November","Dezember"];
const KAL_WT_MO = ["Mo","Di","Mi","Do","Fr","Sa","So"];
const KAL_WT_SO = ["So","Mo","Di","Mi","Do","Fr","Sa"];

// ── TerminDetailPopup: kompakte Termin-Infos (Seiten-Kalender) ──────────────
// Zeigt alle Infos eines Termins + optional Sprung zum Objekt. Schließt bei
// Klick außerhalb. onGoto nur, wenn ein Zielobjekt/-kontakt existiert.
function TerminDetailPopup({ termin, ves, kontakte, t, accent, onClose, onGoto, onBearbeiten = null }) {
  if (!termin) return null;
  const d = termin.datum;
  const datumStr = d ? (String(d.getDate()).padStart(2, "0") + "." + String(d.getMonth()+1).padStart(2, "0") + "." + d.getFullYear()) : "";
  const ve = termin.objektId ? (ves || []).find(v => v && v.id === termin.objektId) : null;
  const einheitenListe = ve ? (typeof alleEinheitenVonVe === "function" ? alleEinheitenVonVe(ve) : (ve.einheiten || [])) : [];
  const einheitLabel = ve
    ? terminEinheitIds(termin)
        .map(eid => einheitenListe.find(e => e && e.id === eid))
        .filter(Boolean)
        .map(e => e.bezeichnung || e.nr || "")
        .filter(Boolean)
        .join(", ")
    : "";
  const beteiligte = (termin.kontaktIds || [])
    .map(kid => (kontakte || []).find(k => k && k.id === kid))
    .filter(Boolean)
    .map(k => k.typ === "firma" ? (k.name || "") : (((k.vorname || "") + " " + (k.nachname || "")).trim() || k.name || ""));
  const personenText = beteiligte.length > 0 ? beteiligte.join(", ")
    : (termin.personen && termin.personen.length > 0 ? termin.personen.join(", ") : "");
  const zeile = (lbl, wert) => wert ? (
    <div style={{ display: "flex", justifyContent: "space-between", gap: 12,
      padding: "7px 0", borderBottom: `1px solid ${t.border}25` }}>
      <span style={{ fontSize: FS.s, color: t.muted, flexShrink: 0 }}>{lbl}</span>
      <span style={{ fontSize: FS.s, fontWeight: FW.medium, color: t.text, textAlign: "right" }}>{wert}</span>
    </div>
  ) : null;
  const farbe = termin.farbe || accent;
  const kannSpringen = !!(termin.objektId || termin.kontaktId);
  return (
    <div onClick={onClose}
      style={{ position: "fixed", top: 0, right: 0, bottom: 0, left: 0,
        background: "rgba(0,0,0,0.6)", zIndex: 1100, display: "flex",
        alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div onClick={(e) => e.stopPropagation()}
        style={{ background: t.card, border: `1px solid ${t.border}`, borderRadius: RAD.xl,
          padding: 16, width: "100%", maxWidth: 360, maxHeight: "80dvh", overflowY: "auto",
          boxShadow: "0 20px 60px rgba(0,0,0,0.5)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
          <div style={{ width: 34, height: 34, borderRadius: RAD.ms, flexShrink: 0,
            background: farbe + "1A", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <I name={termin.icon || "calendar"} size={17} color={farbe}/>
          </div>
          <div style={{ flex: 1, minWidth: 0, fontSize: FS.l, fontWeight: FW.bold, color: t.text }}>
            {termin.titel}
          </div>
          <button onClick={onClose} title="Schließen" aria-label="Schließen"
            style={{ width: 28, height: 28, borderRadius: RAD.sm, cursor: "pointer",
              border: `1px solid ${t.border}`, background: "transparent", flexShrink: 0,
              display: "flex", alignItems: "center", justifyContent: "center" }}>
            <I name="x" size={12} color={t.sub}/>
          </button>
        </div>
        <div style={{ marginBottom: (onGoto || onBearbeiten) ? 14 : 0 }}>
          {zeile("Datum", datumStr)}
          {zeile("Uhrzeit", termin.uhrzeit || "")}
          {zeile("Dauer", (termin.dauer != null ? dauerText(termin.dauer) : ""))}
          {zeile("Objekt", ve ? (ve.nr || "") : "")}
          {zeile(terminEinheitIds(termin).length > 1 ? "Einheiten" : "Einheit", einheitLabel)}
          {zeile("Beteiligte", personenText)}
          {zeile("Notiz", termin.notizen || "")}
        </div>
        {(() => {
          const kannBearbeiten = !!(onBearbeiten && (termin.manuellId != null || termin.freiId != null));
          if (kannBearbeiten) {
            return (
              <button onClick={() => onBearbeiten(termin)}
                style={{ width: "100%", padding: "10px 14px", borderRadius: RAD.sm, cursor: "pointer",
                  fontFamily: "inherit", fontSize: FS.m, fontWeight: FW.bold, border: "none",
                  background: farbe, color: getContrastColor(farbe),
                  display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
                <I name="pencil" size={14} color={getContrastColor(farbe)}/>
                Bearbeiten
              </button>
            );
          }
          if (onGoto) {
            return (
              <button onClick={() => onGoto(termin)}
                style={{ width: "100%", padding: "10px 14px", borderRadius: RAD.sm, cursor: "pointer",
                  fontFamily: "inherit", fontSize: FS.m, fontWeight: FW.bold, border: "none",
                  background: farbe, color: getContrastColor(farbe),
                  display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
                Zum Termin
              </button>
            );
          }
          return null;
        })()}
      </div>
    </div>
  );
}

// ── Einheitliche Hülle für alle Termin-Anlege/Bearbeiten-Overlays ───────────
// Gleiche Größe, gleiche Position, gleicher Aufbau — handytauglich:
// feste Wunschhöhe, gedeckelt durch den sichtbaren Viewport; Inhalt scrollt.
// ── WizardDialog: generischer Schritt-Dialog (EIN Fenster) ──────────────────
// Wiederverwendbarer Baustein für geführte Anlage-Abläufe (Termin, Objekt,
// Kontakt, Ticket, ETV …). Liefert die EINE Hülle: Overlay + Panel (feste
// Größe, handytauglich) + Kopfzeile (Titel · Fortschrittspunkte · ein X) +
// scrollender Body + fest verankerter Fuß (Zurück/Weiter).
// Der Inhalt (`children`) bringt KEINEN eigenen Rahmen/Kopf/X mehr mit.
//
// Props:
//   titel        – Überschrift links im Kopf
//   anzahl       – Gesamtzahl der Schritte (für die Punkte)
//   aktivIdx     – Index des aktiven Schritts (0-basiert)
//   onClose      – X / Klick außerhalb
//   onZurueck    – Zurück-Button (null ⇒ Button ausgeblendet)
//   onWeiter     – Weiter/Abschluss-Button (null ⇒ Button ausgeblendet)
//   weiterText   – Beschriftung des Weiter-Buttons (Default „Weiter")
//   weiterAktiv  – false ⇒ Weiter ausgegraut/deaktiviert
//   accent, t    – Theme
function WizardDialog({ titel, anzahl, aktivIdx, onClose, onZurueck, onWeiter,
  weiterText = "Weiter", weiterAktiv = true, accent = ACCENT, t, children }) {
  return (
    <div onClick={onClose}
      style={{ position: "fixed", top: 0, right: 0, bottom: 0, left: 0,
        background: "rgba(0,0,0,0.5)", zIndex: 200, display: "flex",
        alignItems: "center", justifyContent: "center",
        padding: "16px", boxSizing: "border-box" }}>
      <div onClick={e => e.stopPropagation()}
        style={{ background: t.bg, border: `1px solid ${t.border}`,
          borderRadius: RAD.lg, width: "100%", maxWidth: 460,
          height: "560px", maxHeight: "calc(100dvh - 32px)",
          display: "flex", flexDirection: "column",
          boxSizing: "border-box", overflow: "hidden" }}>
        {/* Kopf: Plus · Titel · Fortschrittspunkte · EIN X */}
        <div style={{ display: "flex", alignItems: "center", gap: 12,
          padding: "12px 16px", flexShrink: 0,
          borderBottom: `1px solid ${t.border}` }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0, minWidth: 0 }}>
            <I name="plus" size={14} color={t.text}/>
            <span style={{ fontSize: FS.xl, fontWeight: FW.bold, color: t.text,
              overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{titel}</span>
          </div>
          {anzahl > 1 && (
            <div style={{ display: "flex", gap: 4, flex: 1, justifyContent: "center" }}>
              {Array.from({ length: anzahl }).map((_, i) => (
                <span key={i} style={{ width: i === aktivIdx ? 16 : 6, height: 6,
                  borderRadius: 3, background: i <= aktivIdx ? accent : t.border,
                  transition: "all 0.15s" }}/>
              ))}
            </div>
          )}
          {!(anzahl > 1) && <span style={{ flex: 1 }}/>}
          <button onClick={onClose} title="Schließen" aria-label="Schließen"
            style={{ background: "none", border: "none", cursor: "pointer", flexShrink: 0 }}>
            <I name="x" size={16} color={t.sub}/>
          </button>
        </div>
        {/* Body: scrollender Inhalt */}
        <div style={{ flex: 1, minHeight: 0, overflowY: "auto", padding: "14px" }}>
          {children}
        </div>
        {/* Fuß: fest verankert, Zurück/Weiter */}
        {(onZurueck || onWeiter) && (
          <div style={{ display: "flex", alignItems: "center",
            justifyContent: "space-between", gap: 8, padding: "12px 14px",
            flexShrink: 0, borderTop: `1px solid ${t.border}` }}>
            {onZurueck ? (
              <button onClick={onZurueck}
                style={{ padding: "9px 16px", borderRadius: RAD.sm, cursor: "pointer",
                  fontFamily: "inherit", fontSize: FS.s, fontWeight: FW.bold,
                  background: "transparent", border: `1px solid ${t.border}`, color: t.sub }}>
                Zurück
              </button>
            ) : <span/>}
            {onWeiter ? (
              <button onClick={() => { if (weiterAktiv) onWeiter(); }} disabled={!weiterAktiv}
                style={{ padding: "9px 20px", borderRadius: RAD.sm,
                  cursor: weiterAktiv ? "pointer" : "not-allowed",
                  fontFamily: "inherit", fontSize: FS.s, fontWeight: FW.bold, border: "none",
                  background: weiterAktiv ? accent : t.border,
                  color: weiterAktiv ? getContrastColor(accent) : t.muted }}>
                {weiterText}
              </button>
            ) : <span/>}
          </div>
        )}
      </div>
    </div>
  );
}

function terminOverlayBackdrop() {
  return { position: "fixed", top: 0, right: 0, bottom: 0, left: 0,
    background: "rgba(0,0,0,0.5)", zIndex: 200, display: "flex",
    alignItems: "center", justifyContent: "center",
    padding: "16px", boxSizing: "border-box" };
}
function terminOverlayPanel(t) {
  return { background: t.bg, border: `1px solid ${t.border}`,
    borderRadius: RAD.lg, width: "100%", maxWidth: 460,
    height: "560px", maxHeight: "calc(100dvh - 32px)",
    display: "flex", flexDirection: "column",
    boxSizing: "border-box", overflow: "hidden" };
}
function terminOverlayKopf(t, titel, onClose) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between",
      padding: "12px 16px", borderBottom: `1px solid ${t.border}`, flexShrink: 0 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
        <I name="plus" size={14} color={t.text}/>
        <span style={{ fontSize: FS.xl, fontWeight: FW.bold, color: t.text,
          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{titel}</span>
      </div>
      <button onClick={onClose} title="Schließen" aria-label="Schließen"
        style={{ background: "none", border: "none", cursor: "pointer", flexShrink: 0 }}>
        <I name="x" size={16} color={t.sub}/>
      </button>
    </div>
  );
}
function terminOverlayBody() {
  return { flex: 1, minHeight: 0, overflowY: "auto", padding: "0 14px 14px 14px" };
}

function KalenderPanel({ offen, onClose, termine, settings, t, accent, variante = "overlay",
  ves = [], kontakte = [], setVes = null, setKontakte = null, onGotoVE = null, onGotoKontakt = null, onGotoTermin = null }) {
  const istInline = variante === "inline";
  const istDock = variante === "dock";
  const istDesktop = useWindowWidth() >= DESKTOP_MIN_WIDTH;
  // Dock: „Neuer Termin" als schwebendes Overlay über allem (statt Inline,
  // da im schmalen Dock kein Platz ist).
  const [dockAnlegenOffen, setDockAnlegenOffen] = useState(false);
  // Im Seiten-Kalender angetippter Termin → kompaktes Detail-Popup.
  const [detailTermin, setDetailTermin] = useState(null);
  // Termin in Bearbeitung direkt im Dock (kein Ansichtswechsel): { quelle, id,
  // objektId, start:{…} } — analog zum Bearbeiten im großen Kalender.
  const [dockBearbeiteTermin, setDockBearbeiteTermin] = useState(null);
  const [zoom, setZoom] = useState(() => {
    const z = (settings && settings.kalZoom) || "monat";
    return KAL_ZOOM_STUFEN.some(s => s.id === z) ? z : "monat";
  });
  const scrollRef = useRef(null);
  // Tag-Stufe: Fenster [tagStart, tagEnde) in alleTage — startet bei der
  // aktuellen Woche, nach OBEN (Rückblick) und unten nachladbar. Bewusst
  // kleine Fenster: iOS friert Touch-Scroll bei sehr hohen Inhalten ein.
  const [tagStart, setTagStart] = useState(null); // null = Auto (aktuelle Woche)
  const [tagEnde, setTagEnde] = useState(null);
  // Minuten-Tick für den roten Faden (aktuelle Uhrzeit), nur bei offenem Panel.
  const [, setJetztTick] = useState(0);
  useEffect(() => {
    if (!offen) return;
    const iv = setInterval(() => setJetztTick(x => x + 1), 60000);
    return () => clearInterval(iv);
  }, [offen]);
  const jetztD = new Date();
  const jetztMin = jetztD.getHours() * 60 + jetztD.getMinutes();
  const arbeitVon = (settings && settings.kalArbeitVon != null) ? settings.kalArbeitVon : 8;
  const arbeitBis = (settings && settings.kalArbeitBis != null) ? settings.kalArbeitBis : 17;

  const wochenstartSo = settings && settings.kalWochenstart === "so";
  const zeigeKw = !settings || settings.kalKw !== false;
  const wtKoepfe = wochenstartSo ? KAL_WT_SO : KAL_WT_MO;

  // Termine nach ISO-Tag gruppieren.
  const byIso = {};
  (termine || []).forEach(x => {
    if (!x || !x.iso) return;
    if (!byIso[x.iso]) byIso[x.iso] = [];
    byIso[x.iso].push(x);
  });

  const heute = new Date(); heute.setHours(0, 0, 0, 0);
  const heuteIso = heute.getFullYear() + "-" + String(heute.getMonth()+1).padStart(2,"0")
    + "-" + String(heute.getDate()).padStart(2,"0");

  // 12 zurück (Rückblick) + KAL_FENSTER_MONATE voraus.
  const monate = [];
  for (let i = -12; i < KAL_FENSTER_MONATE; i++) {
    monate.push(new Date(heute.getFullYear(), heute.getMonth() + i, 1));
  }
  const isoVon = (d) => d.getFullYear() + "-" + String(d.getMonth()+1).padStart(2,"0")
    + "-" + String(d.getDate()).padStart(2,"0");
  const monatKey = (m) => m.getFullYear() + "-" + String(m.getMonth()+1).padStart(2,"0");

  // Wochen eines Monats als Zeilen [Date|null × 7], gemäß Wochenstart.
  const wochenVon = (monat) => {
    const erster = new Date(monat.getFullYear(), monat.getMonth(), 1);
    const tageImMonat = new Date(monat.getFullYear(), monat.getMonth() + 1, 0).getDate();
    const startIdx = wochenstartSo ? erster.getDay() : (erster.getDay() + 6) % 7;
    const zellen = [];
    for (let i = 0; i < startIdx; i++) zellen.push(null);
    for (let tg = 1; tg <= tageImMonat; tg++)
      zellen.push(new Date(monat.getFullYear(), monat.getMonth(), tg));
    while (zellen.length % 7 !== 0) zellen.push(null);
    const wochen = [];
    for (let i = 0; i < zellen.length; i += 7) wochen.push(zellen.slice(i, i + 7));
    return wochen;
  };

  const scrolleZu = (id) => {
    if (typeof window === "undefined") return;
    window.requestAnimationFrame(() => {
      const el = document.getElementById(id);
      if (el && typeof el.scrollIntoView === "function")
        el.scrollIntoView({ block: "start", behavior: "auto" });
    });
  };
  const zoomeZuTag = (d) => {
    const ziel = isoVon(d);
    const idx = alleTage.findIndex(x => isoVon(x) === ziel);
    if (idx >= 0) {
      if (idx < effTagStart) setTagStart(Math.max(0, idx - 7));
      if (idx + 7 > effTagEnde) setTagEnde(idx + 14);
    }
    setZoom("tag");
    scrolleZu("kalp-tag-" + ziel);
  };
  // Springt für die angegebene Stufe zum Heute-Anker (Fenster der Tag-Stufe
  // wird bei Bedarf zurückgesetzt). Wichtig wegen Rückblick: ohne Sprung
  // stünde man beim Stufenwechsel ein Jahr in der Vergangenheit.
  const springeZuHeute = (stufe) => {
    if (stufe === "woche") {
      const w = wocheVonTag(heute);
      scrolleZu(w ? "kalp-woche-" + wocheKey(w) : "kalp-tag-" + heuteIso);
      return;
    }
    if (stufe === "monat") { scrolleZu("kalp-monat-" + monatKey(heute)); return; }
    if (heuteIdx < effTagStart || heuteIdx >= effTagEnde) {
      setTagStart(heuteWochenIdx); setTagEnde(heuteWochenIdx + 21);
    }
    scrolleZu("kalp-tag-" + heuteIso);
  };
  const heuteAnzeigen = () => springeZuHeute(zoom);
  // Direkter Stufenwechsel (T/W/M-Buttons): Stufe setzen und zum Heute-Anker
  // springen, damit man nicht im Rückblick landet.
  const setStufe = (stufe) => {
    if (stufe === zoom) { springeZuHeute(stufe); return; }
    setZoom(stufe); springeZuHeute(stufe);
  };
  // Beim Öffnen zu heute springen (Inhalt beginnt sonst im Rückblick).
  useEffect(() => {
    if (offen) springeZuHeute(zoom);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [offen]);

  const typLabel = (typId) => {
    const ty = KALENDER_TYPEN.find(x => x.id === typId);
    return ty ? ty.label : typId;
  };
  const fmtTag = (d) => String(d.getDate()).padStart(2,"0") + "."
    + String(d.getMonth()+1).padStart(2,"0") + "." + d.getFullYear();
  const wtName = (d) => KAL_WT_MO[(d.getDay() + 6) % 7];

  const panelBreite = istDesktop ? 400 : "min(92vw, 400px)";
  // Kopf-Buttons: auf Mobil größere Touch-Ziele + größere Datum/Uhrzeit-Anzeige.
  const btnGr = istDesktop ? 30 : 40;
  // Einheitliche Höhe aller Kopf-Bedienelemente: das T/W/M-Segment ist das
  // höchste (innere Buttons btnGr + 3px Padding oben/unten). Datum- und
  // Schließen-Button werden auf dieselbe Höhe gebracht.
  const kopfH = btnGr + 6;
  const heuteFS = istDesktop ? FS.s : FS.m;
  const heutePad = istDesktop ? "0 10px" : "0 12px";

  // Alle Tage fortlaufend — vom Wochenstart vor 12 Monaten (Rückblick) bis
  // KAL_FENSTER_MONATE voraus.
  const fensterEnde = new Date(heute.getFullYear(), heute.getMonth() + KAL_FENSTER_MONATE, heute.getDate());
  const fensterBeginn = new Date(heute.getFullYear(), heute.getMonth() - 12, heute.getDate());
  const beginnOffset = wochenstartSo ? fensterBeginn.getDay() : (fensterBeginn.getDay() + 6) % 7;
  const alleTage = [];
  {
    const lauf = new Date(fensterBeginn); lauf.setDate(lauf.getDate() - beginnOffset);
    while (lauf <= fensterEnde) {
      alleTage.push(new Date(lauf));
      lauf.setDate(lauf.getDate() + 1);
    }
  }
  // Index des Wochenstarts der AKTUELLEN Woche (Default-Fensterbeginn Tag-Stufe).
  const heuteIdx = alleTage.findIndex(x => isoVon(x) === heuteIso);
  const startOffset = wochenstartSo ? heute.getDay() : (heute.getDay() + 6) % 7;
  const heuteWochenIdx = Math.max(0, heuteIdx - startOffset);
  const effTagStart = tagStart == null ? heuteWochenIdx : tagStart;
  const effTagEnde = tagEnde == null ? heuteWochenIdx + 21 : tagEnde;
  // Wochen als 7er-Blöcke (beginnen am Wochenstart, da alleTage so startet).
  const alleWochen = [];
  for (let i = 0; i + 6 < alleTage.length; i += 7) alleWochen.push(alleTage.slice(i, i + 7));
  const wocheKey = (tage) => isoVon(tage[0]); // ISO des ersten Wochentags — eindeutig
  const wocheVonTag = (d) => alleWochen.find(w => w.some(x => isoVon(x) === isoVon(d))) || null;

  const zoomeZuWoche = (d) => {
    const w = wocheVonTag(d);
    setZoom("woche");
    if (w) scrolleZu("kalp-woche-" + wocheKey(w));
  };

  return (
    <>
      {/* Backdrop — nur im Overlay-Modus (Mobil) */}
      {!istInline && !istDock ? (
        <div onClick={onClose}
          style={{ position: "fixed", top: 0, right: 0, bottom: 0, left: 0,
            background: "rgba(0,0,0,0.35)", zIndex: 9000,
            opacity: offen ? 1 : 0, pointerEvents: offen ? "auto" : "none",
            transition: "opacity 0.25s" }}/>
      ) : null}
      {/* Panel — dock: festes Flex-Kind rechts im App-Layout (immer sichtbar);
          inline: fährt im Kalender-Fenster auf; overlay: fixed (Mobil). */}
      <div style={istDock
        ? { width: 340, flexShrink: 0, background: t.bg,
            borderLeft: `1px solid ${t.border}`, height: "100%",
            paddingTop: 8,
            display: "flex", flexDirection: "column", minHeight: 0,
            boxSizing: "border-box" }
        : istInline
        ? { width: offen ? 340 : 0, flexShrink: 0, overflow: "hidden",
            transition: "width 0.25s ease", background: t.bg,
            borderLeft: offen ? `1px solid ${t.border}` : "none",
            display: "flex", flexDirection: "column", minHeight: 0,
            boxSizing: "border-box" }
        : { position: "fixed", top: 0, right: 0, bottom: 0,
            width: panelBreite, maxWidth: "100vw", background: t.bg,
            borderLeft: `1px solid ${t.border}`, zIndex: 9001,
            display: "flex", flexDirection: "column", height: "100dvh",
            boxSizing: "border-box",
            transform: offen ? "translateX(0)" : "translateX(105%)",
            transition: "transform 0.25s ease",
            pointerEvents: offen ? "auto" : "none" }}>
        {/* Kopf: Datum (links) · Stufen-Umschalter T|W|M · rechts:
            Dock = „Neuer Termin" (Plus), sonst Schließen (X).
            Dock-paddingTop minimal höher als links, weil das Dock-Panel ein
            paar px über dem Content-Scrollbereich beginnt — so fluchtet die
            Datum-Pille mit dem „Objekte"-Titel. */}
        {/* Kopf: Datum (links) · Stufen-Umschalter T|W|M · rechts:
            Dock = „Neuer Termin" (Plus), sonst Schließen (X).
            Dock: 8/8 wie der StickySectionHeader links → gleiche Höhe + Linie. */}
        <div style={{ display: "flex", alignItems: "center", gap: 8,
          padding: (istDock ? "8px 10px" : "12px 10px 8px"),
          boxSizing: "border-box",
          paddingTop: (!istInline && !istDock)
            ? "max(12px, env(safe-area-inset-top, 0px))" : undefined,
          flexShrink: 0, minWidth: istInline ? 380 : 0 }}>
          <button onClick={heuteAnzeigen} title="Zu heute springen"
            style={{ height: kopfH, padding: heutePad, borderRadius: RAD.sm, flexShrink: 0,
              border: `1px solid ${accent}55`, background: accent + "15", color: accent,
              fontSize: heuteFS, fontWeight: FW.semibold, cursor: "pointer",
              fontFamily: "inherit", whiteSpace: "nowrap",
              display: "flex", alignItems: "center", boxSizing: "border-box" }}>
            {(!settings || settings.kalHeuteInfo !== false)
              ? `${wtName(heute)} ${String(heute.getDate()).padStart(2,"0")}.${String(heute.getMonth()+1).padStart(2,"0")}. · ${String(jetztD.getHours()).padStart(2,"0")}:${String(jetztD.getMinutes()).padStart(2,"0")}`
              : "Heute"}
          </button>
          <div style={{ flex: 1 }}/>
          {/* Stufen-Umschalter: T(ag) · W(oche) · M(onat) — Pillen-Design,
              schmaler, horizontal mittig zwischen Datum-Pille und Plus
              (Spacer flex:1 davor UND danach). */}
          <div style={{ display: "flex", gap: 2, flexShrink: 0,
            alignItems: "center", alignSelf: "center",
            background: t.surface, border: `1px solid ${t.border}`,
            borderRadius: RAD.pill, padding: 2, boxSizing: "border-box" }}>
            {[
              { id: "tag",   kurz: "T", titel: "Tag" },
              { id: "woche", kurz: "W", titel: "Woche" },
              { id: "monat", kurz: "M", titel: "Monat" },
            ].map(opt => {
              const aktiv = zoom === opt.id;
              return (
                <button key={opt.id} onClick={() => setStufe(opt.id)}
                  title={opt.titel} aria-label={opt.titel}
                  style={{ width: istDesktop ? 26 : 32, height: istDesktop ? 26 : 32,
                    borderRadius: RAD.pill,
                    border: "none", cursor: "pointer", fontFamily: "inherit",
                    fontSize: istDesktop ? FS.s : FS.m, fontWeight: FW.bold,
                    background: aktiv ? accent : "transparent",
                    color: aktiv ? getContrastColor(accent) : t.sub,
                    display: "flex", alignItems: "center", justifyContent: "center" }}>
                  {opt.kurz}
                </button>
              );
            })}
          </div>
          <div style={{ flex: 1 }}/>
          {istDock ? (
            (setVes ? (
              <button onClick={() => setDockAnlegenOffen(true)}
                title="Neuer Termin" aria-label="Neuer Termin"
                style={{ width: 36, height: 36, flexShrink: 0,
                  background: accent, border: "none", borderRadius: RAD.pill,
                  boxShadow: `0 1px 2px ${accent}40`,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  cursor: "pointer", boxSizing: "border-box" }}>
                <I name="plus" size={16} color={getContrastColor(accent)}/>
              </button>
            ) : null)
          ) : (onClose ? (
            <button onClick={onClose} title="Schließen" aria-label="Kalender schließen"
              style={{ width: kopfH, height: kopfH, borderRadius: RAD.sm, flexShrink: 0,
                border: `1px solid ${t.border}`, background: "transparent",
                display: "flex", alignItems: "center", justifyContent: "center",
                cursor: "pointer", boxSizing: "border-box" }}>
              <I name="x" size={istDesktop ? 13 : 16} color={t.sub}/>
            </button>
          ) : null)}
        </div>
        {/* Inhalt — fortlaufend scrollbar. KEIN WebkitOverflowScrolling:touch:
            erzwingt auf iOS einen Legacy-Layer, der bei sehr hohen Inhalten
            (Tag-Stufe) das Scrolling einfriert. */}
        <div ref={scrollRef} data-ad-auslauf="1" style={{ flex: 1, minHeight: 0, overflowY: "auto",
          padding: "4px 10px 40px",
          minWidth: istInline ? 380 : 0, boxSizing: "border-box" }}>

          {zoom === "monat" ? (
            monate.map(m => {
              const wochen = wochenVon(m);
              const istAktMonat = monatKey(m) === monatKey(heute);
              return (
                <div key={monatKey(m)} id={"kalp-monat-" + monatKey(m)}
                  style={{ marginBottom: 20,
                    background: istAktMonat ? accent + "1F" : "transparent",
                    border: istAktMonat ? `1px solid ${accent}66` : "1px solid transparent",
                    borderRadius: RAD.md, padding: istAktMonat ? 8 : 0,
                    boxSizing: "border-box" }}>
                  <div style={{ fontSize: FS.m, fontWeight: FW.bold,
                    color: istAktMonat ? accent : t.text,
                    marginBottom: 6 }}>
                    {KAL_MONATSNAMEN[m.getMonth()]} {m.getFullYear()}
                  </div>
                  <div style={{ display: "flex", gap: 2, marginBottom: 3 }}>
                    {zeigeKw ? (
                      <div style={{ width: 26, flexShrink: 0, fontSize: FS.xxs || 9,
                        color: t.muted, textAlign: "center" }}>KW</div>
                    ) : null}
                    {wtKoepfe.map((wt, ki) => {
                      // Spaltenindex → getDay (0=So…6=Sa) je nach Wochenstart.
                      const tagNr = wochenstartSo ? ki : (ki + 1) % 7;
                      const probe = new Date(2026, 0, 4 + ((tagNr - new Date(2026,0,4).getDay() + 7) % 7));
                      const freiKopf = !tagArbeitszeit(settings, probe).an;
                      return (
                        <div key={wt} style={{ flex: 1, fontSize: FS.xs,
                          color: freiKopf ? t.border : t.muted,
                          fontWeight: freiKopf ? FW.regular : FW.medium,
                          textAlign: "center" }}>{wt}</div>
                      );
                    })}
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                    {wochen.map((w, wi) => {
                      const ersterTag = w.find(d => d);
                      return (
                        <div key={wi} style={{ display: "flex", gap: 2 }}>
                          {zeigeKw ? (
                            <div onClick={() => ersterTag && zoomeZuWoche(ersterTag)}
                              style={{ width: 26, flexShrink: 0, fontSize: FS.xs,
                              color: t.muted, display: "flex", alignItems: "center",
                              justifyContent: "center",
                              cursor: ersterTag ? "pointer" : "default" }}>
                              {ersterTag ? isoKW(ersterTag) : ""}
                            </div>
                          ) : null}
                          {w.map((d, di) => {
                            const eintraege = d ? (byIso[isoVon(d)] || []) : [];
                            const istHeute = d && isoVon(d) === heuteIso;
                            const azM = d ? tagArbeitszeit(settings, d) : { an: true };
                            const frei = d && !azM.an;
                            return (
                              <div key={di}
                                onClick={() => d && zoomeZuTag(d)}
                                style={{ flex: 1, minWidth: 0, minHeight: 32,
                                  borderRadius: RAD.sm, padding: "2px 2px",
                                  border: istHeute ? `1px solid ${accent}`
                                    : frei ? `1px solid ${t.border}25` : `1px solid ${t.border}55`,
                                  background: !d ? "transparent"
                                    : frei ? t.bg : t.card,
                                  opacity: frei ? 0.5 : 1,
                                  cursor: d ? "pointer" : "default",
                                  boxSizing: "border-box" }}>
                                <div style={{ fontSize: FS.xs, textAlign: "center",
                                  fontWeight: istHeute ? FW.bold : FW.regular,
                                  color: !d ? "transparent"
                                    : istHeute ? accent : (frei ? t.muted : t.text) }}>
                                  {d ? d.getDate() : "·"}
                                </div>
                                <div style={{ display: "flex", gap: 2, justifyContent: "center",
                                  marginTop: 2, flexWrap: "wrap" }}>
                                  {eintraege.slice(0, 3).map((x, xi) => (
                                    <div key={xi} style={{ width: 5, height: 5, borderRadius: 3,
                                      background: x.farbe || accent }}/>
                                  ))}
                                  {eintraege.length > 3 ? (
                                    <div style={{ fontSize: 8, color: t.muted, lineHeight: "5px" }}>+</div>
                                  ) : null}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })
          ) : null}

          {zoom === "woche" ? (
            alleWochen.map(w => {
              const ersterT = w[0]; const letzterT = w[6];
              // KW vom Donnerstag der Zeile (korrekt bei beiden Wochenstarts).
              const doTag = w.find(d => (d.getDay() + 6) % 7 === 3) || ersterT;
              const kw = isoKW(doTag);
              const istAktWoche = w.some(d => isoVon(d) === heuteIso);
              const bereich = String(ersterT.getDate()).padStart(2,"0") + "."
                + String(ersterT.getMonth()+1).padStart(2,"0") + ". – " + fmtTag(letzterT);
              return (
                <div key={wocheKey(w)} id={"kalp-woche-" + wocheKey(w)}
                  style={{ marginBottom: 16,
                    background: istAktWoche ? accent + "1F" : "transparent",
                    border: istAktWoche ? `1px solid ${accent}66` : "1px solid transparent",
                    borderRadius: RAD.md, padding: istAktWoche ? 8 : 0,
                    boxSizing: "border-box" }}>
                  <div style={{ fontSize: FS.xs, fontWeight: FW.bold,
                    color: istAktWoche ? accent : t.sub,
                    textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 4 }}>
                    {zeigeKw ? `KW ${kw} · ` : ""}{bereich}
                  </div>
                  <KalStundenSkala t={t} links={56}/>
                  {w.map((d, dIdx) => {
                    const iso = isoVon(d);
                    const eintraege = byIso[iso] || [];
                    const istHeute = iso === heuteIso;
                    const az = tagArbeitszeit(settings, d);
                    return (
                      <div key={iso} onClick={() => zoomeZuTag(d)}
                        style={{ display: "flex", alignItems: "center", gap: 6,
                          marginBottom: dIdx === w.length - 1 ? 0 : 3, cursor: "pointer" }}>
                        <div style={{ width: 50, flexShrink: 0, fontSize: FS.xs,
                          color: istHeute ? accent : (az.an ? t.sub : t.muted),
                          fontWeight: istHeute ? FW.bold : FW.medium,
                          textAlign: "right" }}>
                          {wtName(d)} {d.getDate()}.
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <KalTagStreifen eintraege={eintraege} t={t} accent={accent}
                            arbeitVon={az.von} arbeitBis={az.bis} arbeitFrei={!az.an} hoehe={20}
                            istHeute={istHeute} jetztMin={jetztMin}/>
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })
          ) : null}

          {zoom === "tag" ? (
            <>
              {effTagStart > 0 ? (
                <button onClick={() => {
                    const ankerIso = alleTage[effTagStart] ? isoVon(alleTage[effTagStart]) : null;
                    setTagStart(Math.max(0, effTagStart - 21));
                    if (ankerIso) scrolleZu("kalp-tag-" + ankerIso);
                  }}
                  style={{ width: "100%", padding: "9px 12px", borderRadius: RAD.sm,
                    border: `1px dashed ${t.border}`, background: "none", color: t.sub,
                    fontSize: FS.s, cursor: "pointer", fontFamily: "inherit",
                    marginBottom: 10 }}>
                  Frühere Tage anzeigen
                </button>
              ) : null}
              {alleTage.slice(effTagStart, effTagEnde).map((d, di) => {
                const iso = isoVon(d);
                const alle = (byIso[iso] || []).slice().sort((a, b) =>
                  String(a.uhrzeit || "99").localeCompare(String(b.uhrzeit || "99")));
                const ganztags = alle.filter(x => !x.uhrzeit);
                const zeitig = alle.filter(x => !!x.uhrzeit);
                const istHeute = iso === heuteIso;
                const monatsHeader = di === 0 || d.getDate() === 1;
                const istWochenstart = wochenstartSo ? d.getDay() === 0 : d.getDay() === 1;
                const azTag = tagArbeitszeit(settings, d);
                // Achse mit Quoten-Mapping: 1/5 vor der Arbeit, 3/5 Arbeits-
                // fenster, 1/5 danach. Das Fenster ist die EINGESTELLTE
                // Arbeitszeit, erweitert um Uhrzeit-Termine außerhalb (z. B.
                // ETV 19:00 → Fenster wächst bis 20:00, Termin "kommt zur
                // Arbeitszeit"). Außensegmente entfallen bei 0/24-Uhr-Grenzen.
                // An arbeitsfreien Tagen (az.an=false) gibt es kein festes
                // Arbeitsfenster — die Spanne ergibt sich allein aus Terminen
                // (sonst Mittag als neutraler Anker, damit die Achse nicht leer
                // kollabiert).
                let fVon, fBis;
                if (azTag.an) {
                  fVon = azTag.von * 60; fBis = azTag.bis * 60;
                } else if (zeitig.length > 0) {
                  fVon = 12 * 60; fBis = 12 * 60; // wird durch Termine aufgespannt
                } else {
                  fVon = 9 * 60; fBis = 15 * 60; // neutrale Standardspanne ohne Termine
                }
                zeitig.forEach(x => {
                  const m = kalMinVon(x.uhrzeit);
                  if (m == null) return;
                  if (m < fVon) fVon = Math.max(0, Math.floor(m / 60) * 60);
                  if (m + 30 > fBis) fBis = Math.min(1440, Math.ceil((m + 30) / 60) * 60);
                });
                if (fBis <= fVon) fBis = Math.min(1440, fVon + 60);
                const TAGH = 440;
                const vorH = fVon > 0 ? TAGH / 5 : 0;
                const nachH = fBis < 1440 ? TAGH / 5 : 0;
                const fensterH = TAGH - vorH - nachH;
                const yVon = (min) => {
                  if (min <= fVon) return fVon > 0 ? (min / fVon) * vorH : 0;
                  if (min <= fBis) return vorH + (min - fVon) / (fBis - fVon) * fensterH;
                  return vorH + fensterH + (min - fBis) / (1440 - fBis) * nachH;
                };
                const tagH = TAGH;
                // Linien/Labels: jede Fensterstunde, außerhalb nur 0/6/12/18.
                const stunden = [];
                for (let h = 0; h <= 24; h++) {
                  const imFenster = h * 60 >= fVon && h * 60 <= fBis;
                  if (imFenster || h % 6 === 0) stunden.push({ h: h, arbeit: imFenster });
                }
                return (
                  <Fragment key={iso}>
                    {monatsHeader ? (
                      <div style={{ fontSize: FS.s, fontWeight: FW.bold, color: t.text,
                        margin: "10px 0 6px" }}>
                        {KAL_MONATSNAMEN[d.getMonth()]} {d.getFullYear()}
                      </div>
                    ) : null}
                    <div id={"kalp-tag-" + iso}
                      style={{ marginBottom: 12, background: t.card,
                        border: istHeute ? `2px solid ${accent}` : `1px solid ${t.border}`,
                        borderRadius: RAD.md, overflow: "hidden" }}>
                      {/* Tages-Kopf */}
                      <div style={{ display: "flex", alignItems: "baseline", gap: 6,
                        padding: "8px 10px", borderBottom: `1px solid ${t.border}` }}>
                        <span style={{ fontSize: FS.s,
                          fontWeight: istHeute ? FW.bold : FW.semibold,
                          color: istHeute ? accent : t.text }}>
                          {wtName(d)} {fmtTag(d)}
                        </span>
                        {zeigeKw && istWochenstart ? (
                          <span style={{ fontSize: FS.xs, color: t.muted }}>KW {isoKW(d)}</span>
                        ) : null}
                      </div>
                      {/* Ganztägige Einträge (Fristen) */}
                      {ganztags.length > 0 ? (
                        <div style={{ padding: "6px 10px",
                          borderBottom: `1px solid ${t.border}` }}>
                          {ganztags.map((x, xi) => (
                            <div key={xi} onClick={(e) => { e.stopPropagation(); setDetailTermin(x); }}
                              style={{ display: "flex", alignItems: "center", cursor: "pointer",
                              gap: 6, marginBottom: xi < ganztags.length - 1 ? 3 : 0 }}>
                              <div style={{ width: 7, height: 7, borderRadius: 2,
                                flexShrink: 0, background: x.farbe || accent }}/>
                              <div style={{ fontSize: FS.xs, color: t.sub, minWidth: 0,
                                overflow: "hidden", textOverflow: "ellipsis",
                                whiteSpace: "nowrap" }}>
                                {x.titel}<span style={{ color: t.muted }}> · {terminOrtKurz(x, ves) || typLabel(x.typ)}</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : null}
                      {/* Vertikale Stunden-Achse 0–24, nichtlinear */}
                      <div style={{ position: "relative", height: tagH }}>
                        {/* Gespreiztes Fenster (Arbeitszeit + erweiterte Termine) abgesetzt.
                            An arbeitsfreien Tagen kein Arbeits-Tint. */}
                        {azTag.an ? (
                          <div style={{ position: "absolute", left: 0, right: 0,
                            top: yVon(fVon), height: yVon(fBis) - yVon(fVon),
                            background: accent + "10" }}/>
                        ) : null}
                        {/* Stundenlinien + Labels */}
                        {stunden.map(s => (
                          <Fragment key={s.h}>
                            {s.h > 0 && s.h < 24 ? (
                              <div style={{ position: "absolute", left: 0, right: 0,
                                top: yVon(s.h * 60), height: 1,
                                background: t.border + (s.arbeit ? "40" : "25") }}/>
                            ) : null}
                            {s.h < 24 ? (
                              <div style={{ position: "absolute", left: 6,
                                top: yVon(s.h * 60) + 1, fontSize: 9,
                                color: s.arbeit ? t.sub : t.muted }}>
                                {String(s.h).padStart(2, "0")}
                              </div>
                            ) : null}
                          </Fragment>
                        ))}
                        {/* Termine an ihrer Uhrzeit */}
                        {zeitig.map((x, xi) => {
                          const min = kalMinVon(x.uhrzeit) || 0;
                          return (
                            <div key={xi} title={(x.uhrzeit || "") + " " + x.titel}
                              onClick={(e) => { e.stopPropagation(); setDetailTermin(x); }}
                              style={{ position: "absolute", left: 30, right: 8,
                                top: yVon(min), minHeight: 22, cursor: "pointer",
                                background: (x.farbe || accent) + "18",
                                borderLeft: `3px solid ${x.farbe || accent}`,
                                borderRadius: 4, padding: "2px 6px",
                                boxSizing: "border-box", zIndex: 1,
                                display: "flex", alignItems: "center" }}>
                              <div style={{ fontSize: FS.xs, color: t.text, minWidth: 0,
                                overflow: "hidden", textOverflow: "ellipsis",
                                whiteSpace: "nowrap" }}>
                                {x.uhrzeit} · {x.titel}
                                <span style={{ color: t.muted }}> · {terminOrtKurz(x, ves) || typLabel(x.typ)}</span>
                              </div>
                            </div>
                          );
                        })}
                        {/* Roter Faden — aktuelle Uhrzeit (heute), 1px rot */}
                        {istHeute ? (
                          <div style={{ position: "absolute", left: 0, right: 0,
                            top: yVon(jetztMin), height: 1,
                            background: "#EF4444", zIndex: 2 }}/>
                        ) : null}
                      </div>
                    </div>
                  </Fragment>
                );
              })}
              {effTagEnde < alleTage.length ? (
                <button onClick={() => setTagEnde(effTagEnde + 21)}
                  style={{ width: "100%", padding: "9px 12px", borderRadius: RAD.sm,
                    border: `1px dashed ${t.border}`, background: "none", color: t.sub,
                    fontSize: FS.s, cursor: "pointer", fontFamily: "inherit" }}>
                  Weitere Tage anzeigen
                </button>
              ) : null}
            </>
          ) : null}
        </div>
      </div>
      {istDock && dockAnlegenOffen && setVes && (() => {
        const gefuehrt = !!(settings && settings.terminAnlegeModus === "gefuehrt");
        const schliessen = () => setDockAnlegenOffen(false);
        const aufAnlegen = (termin, objektId) => {
          if (!objektId) {
            if (setFreieTermine) setFreieTermine(prev => [...(prev || []), termin]);
          } else {
            setVes(prev => prev.map(v => String(v.id) === String(objektId)
              ? { ...v, termine: [...(v.termine || []), termin] } : v));
          }
          setDockAnlegenOffen(false);
          // Zur Kontrolle: Detail-Popup des frisch angelegten Termins öffnen.
          var dd = parseDatumWert(termin.datum);
          setDetailTermin({
            datum: dd, titel: termin.titel || "Termin",
            objektId: objektId || null,
            einheitIds: Array.isArray(termin.einheitIds) ? termin.einheitIds.slice() : [],
            kontaktIds: Array.isArray(termin.kontaktIds) ? termin.kontaktIds.slice() : [],
            uhrzeit: termin.uhrzeit || "", dauer: (termin.dauer != null ? termin.dauer : null),
            farbe: termin.farbe || accent, icon: "calendar",
            notizen: termin.notizen || "", manuellId: termin.id,
          });
        };
        if (gefuehrt) {
          return (
            <TerminAssistent ves={ves} kontakte={kontakte} setKontakte={setKontakte}
              t={t} accent={accent} onCancel={schliessen} onAnlegen={aufAnlegen}/>
          );
        }
        return (
          <div onClick={schliessen} style={terminOverlayBackdrop()}>
            <div onClick={e => e.stopPropagation()} style={terminOverlayPanel(t)}>
              {terminOverlayKopf(t, "Neuer Termin", schliessen)}
              <div style={terminOverlayBody()}>
                <TerminAnlegen ves={ves} kontakte={kontakte} setKontakte={setKontakte}
                  t={t} accent={accent} onCancel={schliessen} onAnlegen={aufAnlegen}/>
              </div>
            </div>
          </div>
        );
      })()}
      {dockBearbeiteTermin && setVes && (() => {
        const btVe = (dockBearbeiteTermin.objektId != null && dockBearbeiteTermin.objektId !== "")
          ? (ves || []).find(v => String(v.id) === String(dockBearbeiteTermin.objektId)) : null;
        const kopfTitel = btVe ? "Termin bearbeiten · " + btVe.nr : "Termin bearbeiten";
        return (
        <div onClick={() => setDockBearbeiteTermin(null)} style={terminOverlayBackdrop()}>
          <div onClick={e => e.stopPropagation()} style={terminOverlayPanel(t)}>
            {terminOverlayKopf(t, kopfTitel, () => setDockBearbeiteTermin(null))}
            <div style={terminOverlayBody()}>
              <TerminBearbeitenKompakt ves={ves} kontakte={kontakte} setKontakte={setKontakte}
                t={t} accent={accent}
                start={dockBearbeiteTermin.start}
                submitText="Speichern"
                onCancel={() => setDockBearbeiteTermin(null)}
                onAnlegen={(neu, objektId) => {
                  const bt = dockBearbeiteTermin;
                  // Alten Termin am alten Ort entfernen.
                  if (bt.quelle === "manuell") {
                    setVes(prev => prev.map(v => v.id === bt.objektId
                      ? { ...v, termine: (v.termine || []).filter(x => x.id !== bt.id) } : v));
                  } else if (setFreieTermine) {
                    setFreieTermine(prev => (prev || []).filter(x => x.id !== bt.id));
                  }
                  // Neuen Termin am (ggf. geänderten) Ort schreiben, alte ID behalten.
                  const neuMitId = { ...neu, id: bt.id };
                  if (!objektId) {
                    if (setFreieTermine) setFreieTermine(prev => [...(prev || []), neuMitId]);
                  } else {
                    setVes(prev => prev.map(v => String(v.id) === String(objektId)
                      ? { ...v, termine: [...(v.termine || []), neuMitId] } : v));
                  }
                  setDockBearbeiteTermin(null);
                }}/>
            </div>
          </div>
        </div>
        );
      })()}
      {detailTermin && (
        <TerminDetailPopup termin={detailTermin} ves={ves} kontakte={kontakte}
          t={t} accent={accent}
          onClose={() => setDetailTermin(null)}
          onBearbeiten={setVes ? (tm) => {
            // Nur bearbeitbare (manuell/frei) Termine — abgeleitete Fristen nicht.
            if (tm.manuellId == null && tm.freiId == null) return;
            const isoVon = (d) => d ? (d.getFullYear() + "-" + String(d.getMonth()+1).padStart(2,"0") + "-" + String(d.getDate()).padStart(2,"0")) : "";
            setDetailTermin(null);
            setDockBearbeiteTermin({
              quelle: tm.manuellId != null ? "manuell" : "frei",
              id: tm.manuellId != null ? tm.manuellId : tm.freiId,
              objektId: tm.objektId || "",
              start: {
                titel: tm.titel || "",
                datum: isoVon(tm.datum),
                uhrzeit: tm.uhrzeit || "",
                dauer: tm.dauer != null ? tm.dauer : null,
                objektId: tm.objektId || "",
                einheitIds: terminEinheitIds(tm).slice(),
                kontaktIds: (tm.kontaktIds || []).slice(),
                notizen: tm.notizen || ""
              }
            });
          } : null}
          onGoto={onGotoTermin ? (tm) => {
            setDetailTermin(null);
            const key = (tm.iso || "") + "|" + (tm.titel || "") + "|" + (tm.objektId || tm.kontaktId || "");
            onGotoTermin(key);
          } : null}/>
      )}
    </>
  );
}

function KalenderScreen({ ves, kontakte, t, accent, gotoVE, gotoKontakt, setVes = null, setKontakte = null, plusAccent = null, settings = null, dockOffen = false, freieTermine = [], setFreieTermine = null, pendingTerminKey = null, kalView = "objekte", setKalView = null, kalViewVEId = null, setKalViewVEId = null, cardWidth = 280, kartenSpalten = 2, detailMinBreite = 300, detailMaxAnteil = 0.6, listenAnsicht = "karten" }) {
  const [typFilter, setTypFilter] = useState("alle");
  // Orientierungskalender-Panel (Desktop: Inline-Seitenpanel rechts im
  // Kalender-Fenster; Mobil: Overlay von rechts).
  const [panelOffen, setPanelOffen] = useState(false);
  const kalIstDesktop = useWindowWidth() >= DESKTOP_MIN_WIDTH;
  // Inline-Anlegeformular (über dem Listenbereich) — geöffnet per +-Button.
  const [anlegenOffen, setAnlegenOffen] = useState(false);
  // Termin in Bearbeitung: { quelle:"manuell"|"frei", id, objektId, start:{…} }
  const [bearbeiteTermin, setBearbeiteTermin] = useState(null);
  // Schnelles Anlegen im offenen Objekt-Detail (Objekt vorgesetzt): VE-Id | null.
  const [objektAnlegenVE, setObjektAnlegenVE] = useState(null);
  // Bereichsfarbe des Kalenders: gleicher Button wie „Neues Objekt"/„Neuer
  // Kontakt" (36px-Pill, rechtsbündig) — die Farbe verrät, was er anlegt.
  const kalFarbe = plusAccent || accent;
  // Akkordeon: nur EINE Kalenderzeile gleichzeitig aufgeklappt (wie Karten,
  // DESIGN §21.1). Schlüssel = iso+titel+objektId — stabil über Re-Renders.
  const [offenTerminKey, setOffenTerminKey] = useState(null);
  const sprungSperreRef = useRef(0);
  const terminKey = function(x) { return x.iso + "|" + x.titel + "|" + (x.objektId || x.kontaktId || ""); };
  // Nach dem Anlegen: zum frisch erstellten Termin springen, damit der Nutzer
  // ihn dort sieht, wo er ihn angelegt hat (Kontrolle). Bei Objektbezug in die
  // Objekte-Ansicht wechseln und das Objekt aufklappen; sonst Timeline. Bei
  // Mehrfach-Objekten ruft der Assistent dies mehrfach im selben Tick auf —
  // die Sperre sorgt dafür, dass nur der ERSTE Aufruf (= erstes Objekt) springt.
  const springeZuTermin = function(termin, objektId) {
    if (!termin) return;
    var jetzt = Date.now();
    if (jetzt - sprungSperreRef.current < 50) return;
    sprungSperreRef.current = jetzt;
    // iso aus dem (ISO-)Datum des Termins ableiten.
    var d = parseDatumWert(termin.datum);
    if (!d) return;
    var iso = d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
    var key = iso + "|" + (termin.titel || "") + "|" + (objektId || "");
    if (objektId) {
      if (setKalView) setKalView("objekte");
      if (setKalViewVEId) setKalViewVEId(objektId);
    }
    setOffenTerminKey(key);
    setTimeout(function() {
      if (typeof document === "undefined") return;
      var sel = (window.CSS && window.CSS.escape) ? window.CSS.escape(key) : key;
      var el = document.querySelector('[data-termin-key="' + sel + '"]');
      if (el && el.scrollIntoView) el.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 200);
  };
  // Aus dem Seiten-Kalender angesteuerten Termin aufklappen + hinscrollen.
  useEffect(() => {
    if (!pendingTerminKey || !pendingTerminKey.key) return;
    setOffenTerminKey(pendingTerminKey.key);
    const tid = setTimeout(() => {
      if (typeof document === "undefined") return;
      const sel = (window.CSS && window.CSS.escape) ? window.CSS.escape(pendingTerminKey.key) : pendingTerminKey.key;
      const el = document.querySelector('[data-termin-key="' + sel + '"]');
      if (el && el.scrollIntoView) el.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 120);
    return () => clearTimeout(tid);
  }, [pendingTerminKey]);
  const termine = sammleTermine(ves, kontakte, KAL_FENSTER_MONATE, 0, freieTermine);
  // Panel-Termine inkl. 12 Monate Rückblick (Liste bleibt zukunftsbasiert).
  // Bei aktivem Desktop-Dock (Seitenleiste) entfallen Inline-Panel + Toggle.
  const dockAktiv = (kalIstDesktop && settings && settings.kalSeitenleiste === true) || dockOffen;
  // Wenn das Dock aktiv ist, ist der Vollansicht-Plus ausgeblendet — ein evtl.
  // offenes Inline-Anlegeformular dann schließen, damit es nicht hängenbleibt.
  useEffect(() => { if (dockAktiv && anlegenOffen) setAnlegenOffen(false); }, [dockAktiv]);
  const panelTermine = (panelOffen && !dockAktiv)
    ? sammleTermine(ves, kontakte, KAL_FENSTER_MONATE, 12, freieTermine) : termine;
  const gefiltert = typFilter === "alle" ? termine : termine.filter(function(x) { return x.typ === typFilter; });

  const counts = { alle: termine.length };
  KALENDER_TYPEN.forEach(function(ty) { counts[ty.id] = termine.filter(function(x) { return x.typ === ty.id; }).length; });
  const aktiveTypen = KALENDER_TYPEN.filter(function(ty) { return counts[ty.id] > 0; }).map(function(ty) { return ty.id; });

  const gruppen = {};
  KALENDER_BUCKETS.forEach(function(b) { gruppen[b.id] = []; });
  gefiltert.forEach(function(termin) { gruppen[kalenderBucket(termin.diff)].push(termin); });

  return (
    <>
      <StickySectionHeader t={t} accent={accent}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div onClick={() => { setTypFilter("alle"); if (setKalViewVEId) setKalViewVEId(null); }} title="Alle Termine anzeigen"
            style={{ fontSize: FS.xxl, fontWeight: FW.heavy, flexShrink: 0,
              color: typFilter === "alle" ? t.text : t.sub, cursor: "pointer",
              userSelect: "none", transition: "color 0.15s" }}>
            Kalender
          </div>
          {/* View-Umschalter: Timeline | Nach Objekten */}
          <div style={{ display: "flex", gap: 2, padding: 2, borderRadius: RAD.pill,
            background: t.surface, border: `1px solid ${t.border}`, flexShrink: 0 }}>
            {[{ id: "objekte", label: "Objekte" }, { id: "timeline", label: "Timeline" }].map(v => (
              <button key={v.id} onClick={() => { if (setKalView) setKalView(v.id); if (setKalViewVEId) setKalViewVEId(null); }}
                style={{ padding: "5px 12px", borderRadius: RAD.pill, cursor: "pointer",
                  fontFamily: "inherit", fontSize: FS.s, fontWeight: FW.bold, border: "none",
                  background: kalView === v.id ? kalFarbe : "transparent",
                  color: kalView === v.id ? getContrastColor(kalFarbe) : t.sub }}>
                {v.label}
              </button>
            ))}
          </div>
          {kalView === "timeline" && (
            <FilterButtons arten={KALENDER_TYPEN} aktive={aktiveTypen}
              counts={counts} wert={typFilter} onWert={setTypFilter}
              t={t} accent={accent} ohneAlle={true}/>
          )}
          {setVes && !dockAktiv && !(kalView === "objekte" && kalViewVEId) && (
            <button onClick={() => setAnlegenOffen(o => !o)}
              data-kb-neu="1" title="Neuer Termin" aria-label="Neuer Termin" style={{
                display: "flex", alignItems: "center", justifyContent: "center",
                width: 36, height: 36, flexShrink: 0, marginLeft: "auto",
                background: kalFarbe, border: "none",
                borderRadius: RAD.pill, cursor: "pointer",
                boxShadow: `0 1px 2px ${kalFarbe}40`,
              }}>
              <I name={anlegenOffen ? "x" : "plus"} size={16} color={getContrastColor(kalFarbe)}/>
            </button>
          )}
        </div>
      </StickySectionHeader>
      {!kalIstDesktop && !dockAktiv ? (
        <KalenderPanel variante="overlay" offen={panelOffen} onClose={() => setPanelOffen(false)}
          termine={panelTermine} settings={settings} t={t} accent={kalFarbe}
          ves={ves} kontakte={kontakte}
          onGotoVE={(id, ziel) => gotoVE(id, ziel)} onGotoKontakt={gotoKontakt}
          onGotoTermin={(key) => {
            setPanelOffen(false);
            setOffenTerminKey(key);
            setTimeout(() => {
              if (typeof document === "undefined") return;
              const sel = (window.CSS && window.CSS.escape) ? window.CSS.escape(key) : key;
              const el = document.querySelector('[data-termin-key="' + sel + '"]');
              if (el && el.scrollIntoView) el.scrollIntoView({ behavior: "smooth", block: "center" });
            }, 120);
          }}/>
      ) : null}
      {objektAnlegenVE != null && setVes && (() => {
        const veObj = (ves || []).find(v => String(v.id) === String(objektAnlegenVE)) || null;
        if (!veObj) return null;
        const gefuehrt = !!(settings && settings.terminAnlegeModus === "gefuehrt");
        const schliessen = () => setObjektAnlegenVE(null);
        const aufAnlegen = (termin, objektId) => {
          const ziel = objektId || veObj.id;
          setVes(prev => prev.map(v => String(v.id) === String(ziel)
            ? { ...v, termine: [...(v.termine || []), termin] } : v));
          setObjektAnlegenVE(null);
          springeZuTermin(termin, ziel);
        };
        if (gefuehrt) {
          return (
            <TerminAssistent ves={ves} kontakte={kontakte} setKontakte={setKontakte}
              t={t} accent={plusAccent || accent}
              start={{ objektId: veObj.id }} objektFest
              onCancel={schliessen} onAnlegen={aufAnlegen}/>
          );
        }
        return (
          <div onClick={schliessen} style={terminOverlayBackdrop()}>
            <div onClick={e => e.stopPropagation()} style={terminOverlayPanel(t)}>
              {terminOverlayKopf(t, "Neuer Termin · " + veObj.nr, schliessen)}
              <div style={terminOverlayBody()}>
                <TerminAnlegen ves={ves} kontakte={kontakte} setKontakte={setKontakte}
                  t={t} accent={plusAccent || accent}
                  start={{ objektId: veObj.id }} objektFest
                  onCancel={schliessen} onAnlegen={aufAnlegen}/>
              </div>
            </div>
          </div>
        );
      })()}
      {anlegenOffen && setVes && (() => {
        const gefuehrt = !!(settings && settings.terminAnlegeModus === "gefuehrt");
        const schliessen = () => setAnlegenOffen(false);
        const aufAnlegen = (termin, objektId) => {
          if (!objektId) {
            if (setFreieTermine) setFreieTermine(prev => [...(prev || []), termin]);
          } else {
            setVes(prev => prev.map(v => String(v.id) === String(objektId)
              ? { ...v, termine: [...(v.termine || []), termin] } : v));
          }
          setAnlegenOffen(false);
          springeZuTermin(termin, objektId || "");
        };
        if (gefuehrt) {
          return (
            <TerminAssistent ves={ves} kontakte={kontakte} setKontakte={setKontakte}
              t={t} accent={plusAccent || accent}
              onCancel={schliessen} onAnlegen={aufAnlegen}/>
          );
        }
        return (
          <div onClick={schliessen} style={terminOverlayBackdrop()}>
            <div onClick={e => e.stopPropagation()} style={terminOverlayPanel(t)}>
              {terminOverlayKopf(t, "Neuer Termin", schliessen)}
              <div style={terminOverlayBody()}>
                <TerminAnlegen ves={ves} kontakte={kontakte} setKontakte={setKontakte}
                  t={t} accent={plusAccent || accent}
                  onCancel={schliessen} onAnlegen={aufAnlegen}/>
              </div>
            </div>
          </div>
        );
      })()}
      {/* Termin-Bearbeiten-Overlay — bewusst VOR dem View-Container, damit es
          sowohl in der Objekte-Ansicht (Objekt-Detail) als auch in der Timeline
          erscheint (position:fixed, liegt über allem). */}
      {bearbeiteTermin && setVes && (() => {
        const btVe = (bearbeiteTermin.objektId != null && bearbeiteTermin.objektId !== "")
          ? (ves || []).find(v => String(v.id) === String(bearbeiteTermin.objektId)) : null;
        const kopfTitel = btVe ? "Termin bearbeiten · " + btVe.nr : "Termin bearbeiten";
        return (
        <div onClick={() => setBearbeiteTermin(null)} style={terminOverlayBackdrop()}>
          <div onClick={(e) => e.stopPropagation()} style={terminOverlayPanel(t)}>
            {terminOverlayKopf(t, kopfTitel, () => setBearbeiteTermin(null))}
            <div style={terminOverlayBody()}>
            <TerminBearbeitenKompakt ves={ves} kontakte={kontakte} setKontakte={setKontakte}
              t={t} accent={plusAccent || accent}
              start={bearbeiteTermin.start}
              submitText="Speichern"
              onCancel={() => setBearbeiteTermin(null)}
              onAnlegen={(neu, objektId) => {
                const bt = bearbeiteTermin;
                if (bt.quelle === "manuell") {
                  setVes(prev => prev.map(v => v.id === bt.objektId
                    ? { ...v, termine: (v.termine || []).filter(x => x.id !== bt.id) } : v));
                } else if (setFreieTermine) {
                  setFreieTermine(prev => (prev || []).filter(x => x.id !== bt.id));
                }
                const neuMitId = { ...neu, id: bt.id };
                if (!objektId) {
                  if (setFreieTermine) setFreieTermine(prev => [...(prev || []), neuMitId]);
                } else {
                  setVes(prev => prev.map(v => String(v.id) === String(objektId)
                    ? { ...v, termine: [...(v.termine || []), neuMitId] } : v));
                }
                setBearbeiteTermin(null);
              }}/>
            </div>
          </div>
        </div>
        );
      })()}
      <div style={{ display: "flex", flexDirection: kalIstDesktop ? "row" : "column",
        flex: 1, minHeight: 0, minWidth: 0, width: "100%" }}>
      {kalView === "objekte" ? (
        (() => {
          // Detail-Inhalt: objektgefilterte Termine + Fristen, chronologisch.
          const renderTerminDetail = (veObj) => {
            if (!veObj) return null;
            const objTermine = sammleTermine([veObj], kontakte, KAL_FENSTER_MONATE, 0, freieTermine);
            return (
              <div style={{ background: kalFarbe + "08", border: `1px solid ${kalFarbe}`,
                borderRadius: RAD.lg, padding: "14px 16px",
                boxSizing: "border-box", width: "100%", minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14, minWidth: 0 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: FS.xxl, fontWeight: FW.heavy, color: kalFarbe,
                      lineHeight: 1.1, overflowWrap: "anywhere" }}>{veObj.nr}</div>
                    <div style={{ fontSize: FS.s, color: t.sub, marginTop: 2,
                      overflowWrap: "anywhere" }}>{veObj.adresse}</div>
                  </div>
                  {setVes && (
                    <button onClick={() => setObjektAnlegenVE(objektAnlegenVE === veObj.id ? null : veObj.id)}
                      title="Termin für dieses Objekt anlegen" aria-label="Neuer Termin"
                      style={{ display: "flex", alignItems: "center", justifyContent: "center",
                        width: 36, height: 36, flexShrink: 0, background: kalFarbe, border: "none",
                        borderRadius: RAD.pill, cursor: "pointer", boxShadow: `0 1px 2px ${kalFarbe}40` }}>
                      <I name={objektAnlegenVE === veObj.id ? "x" : "plus"} size={16} color={getContrastColor(kalFarbe)}/>
                    </button>
                  )}
                </div>
                {objTermine.length === 0 ? (
                  <div style={{ fontSize: FS.m, color: t.muted, fontStyle: "italic", padding: "8px 2px" }}>
                    Keine Termine oder Fristen für dieses Objekt.
                  </div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {objTermine.map(function(termin, i) {
                      var key = terminKey(termin);
                      return (
                        <KalenderZeile key={key + "-" + i} termin={termin} t={t}
                          rahmenFarbe={kalFarbe}
                          kontakte={kontakte} ves={ves} setKontakte={setKontakte}
                          onKontaktClick={gotoKontakt} onVEClick={(id) => gotoVE(id)}
                          offen={offenTerminKey === key}
                          onToggle={() => setOffenTerminKey(offenTerminKey === key ? null : key)}
                          onLoeschen={
                            termin.manuellId != null && setVes ? () => {
                              setVes(prev => prev.map(v => v.id === termin.objektId
                                ? { ...v, termine: (v.termine || []).filter(x => x.id !== termin.manuellId) } : v));
                            }
                            : (termin.freiId != null && setFreieTermine ? () => {
                              setFreieTermine(prev => (prev || []).filter(x => x.id !== termin.freiId));
                            } : null)
                          }
                          onNotiz={
                            termin.manuellId != null && setVes ? (text) => {
                              setVes(prev => prev.map(v => v.id === termin.objektId
                                ? { ...v, termine: (v.termine || []).map(x => x.id === termin.manuellId ? { ...x, notizen: text } : x) } : v));
                            }
                            : (termin.freiId != null && setFreieTermine ? (text) => {
                              setFreieTermine(prev => (prev || []).map(x => x.id === termin.freiId ? { ...x, notizen: text } : x));
                            } : null)
                          }
                          onBearbeiten={
                            (termin.manuellId != null || termin.freiId != null) ? () => {
                              const isoVon = (d) => d ? (d.getFullYear() + "-" + String(d.getMonth()+1).padStart(2,"0") + "-" + String(d.getDate()).padStart(2,"0")) : "";
                              setBearbeiteTermin({
                                quelle: termin.manuellId != null ? "manuell" : "frei",
                                id: termin.manuellId != null ? termin.manuellId : termin.freiId,
                                objektId: termin.objektId || "",
                                start: {
                                  titel: termin.titel || "",
                                  datum: isoVon(termin.datum),
                                  uhrzeit: termin.uhrzeit || "",
                                  dauer: termin.dauer != null ? termin.dauer : null,
                                  objektId: termin.objektId || "",
                                  einheitIds: terminEinheitIds(termin).slice(),
                                  kontaktIds: (termin.kontaktIds || []).slice(),
                                  notizen: termin.notizen || ""
                                }
                              });
                              setOffenTerminKey(null);
                            } : null
                          }
                          onZiel={() => {
                            if (termin.objektId) gotoVE(termin.objektId, termin.ziel);
                            else if (termin.kontaktId) gotoKontakt(termin.kontaktId);
                          }}/>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          };
          const offenVEObj = (ves || []).find(v => v.id === kalViewVEId) || null;
          // Mit offenem Objekt: dasselbe Master-Detail-Gerüst wie bei Objekten/
          // Kontakten. Auf Mobil liefert ObjekteMasterDetail automatisch den
          // Fallback (Detail voll + „Zurück zur Liste"-Button); auf Desktop die
          // 2-Spalten-Ansicht. Kein eigener Mobil-Pfad mehr.
          if (offenVEObj) {
            return (
              <ObjekteMasterDetail
                listenAnsicht={listenAnsicht}
                cardWidth={cardWidth}
                detailMinBreite={detailMinBreite} detailMaxAnteil={detailMaxAnteil}
                kartenSpalten={kartenSpalten}
                gefiltert={ves}
                expandedVEId={kalViewVEId}
                setExpandedVEId={(id) => setKalViewVEId && setKalViewVEId(id)}
                offenVE={offenVEObj}
                t={t} accent={kalFarbe}
                kontakte={kontakte} setKontakte={setKontakte}
                ves={ves} setVes={setVes}
                gotoKontakt={gotoKontakt}
                auswahlAccentOverride={kalFarbe}
                renderDetailOverride={renderTerminDetail}/>
            );
          }
          return (
            <div data-ad-scroll="y" data-ad-auslauf="1" style={{ flex: 1, minHeight: 0, minWidth: 0,
              width: "100%", boxSizing: "border-box", overflowY: "auto", padding: 2 }}>
              {settings && settings.legendeObjekte !== false && (ves || []).length > 0 && (
                <ObjektLegende ves={ves} t={t} accent={kalFarbe}
                  listenAnsicht={listenAnsicht}
                  onGotoHandlungsbedarf={() => {
                    try {
                      window.dispatchEvent(new CustomEvent("allesda:goto-einstellungen",
                        { detail: { sektion: "kalender" } }));
                    } catch (err) {}
                  }}/>
              )}
              <div style={listenAnsicht === "liste"
                ? { display: "flex", flexDirection: "column", gap: 6 }
                : { display: "grid",
                    gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 10 }}>
                {(ves || []).map(veObj => listenAnsicht === "liste" ? (
                  <VEListenZeile key={veObj.id} ve={veObj} t={t} accent={kalFarbe}
                    aktiv={false} kbItem id={"kal-obj-" + veObj.id}
                    auswahlAccentOverride={kalFarbe}
                    onClick={() => setKalViewVEId && setKalViewVEId(veObj.id)}/>
                ) : (
                  <VEKachel key={veObj.id} ve={veObj} t={t} accent={kalFarbe}
                    aktiv={false} kbItem id={"kal-obj-" + veObj.id}
                    auswahlAccentOverride={kalFarbe}
                    onClick={() => setKalViewVEId && setKalViewVEId(veObj.id)}/>
                ))}
              </div>
            </div>
          );
        })()
      ) : (
      <div data-ad-scroll="y" data-ad-auslauf="1" style={{ flex: 1, minHeight: 0, minWidth: 0, width: "100%",
        overflowY: "auto", padding: "8px 2px", boxSizing: "border-box" }}>
        {kalView === "timeline" && gefiltert.length === 0 && (
          <div style={{ fontSize: FS.m, color: t.muted, fontStyle: "italic", marginTop: 20 }}>
            Keine Termine in den nächsten 24 Monaten.
          </div>
        )}
        {kalView === "timeline" && KALENDER_BUCKETS.map(function(b) {
          if (gruppen[b.id].length === 0) return null;
          return (
            <div key={b.id} style={{ marginBottom: 18 }}>
              <div style={{ fontSize: FS.s, fontWeight: FW.bold, color: b.id === "ueberfaellig" ? "#EF4444" : t.sub,
                textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 8, marginTop: 4 }}>
                {b.label} <span style={{ color: t.muted, fontWeight: FW.medium }}>({gruppen[b.id].length})</span>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {gruppen[b.id].map(function(termin, i) {
                  var key = terminKey(termin);
                  return (
                    <KalenderZeile key={b.id + "-" + i} termin={termin} t={t}
                      rahmenFarbe={kalFarbe}
                      kontakte={kontakte} ves={ves} setKontakte={setKontakte}
                      onKontaktClick={gotoKontakt} onVEClick={(id) => gotoVE(id)}
                      offen={offenTerminKey === key}
                      onToggle={() => setOffenTerminKey(offenTerminKey === key ? null : key)}
                      onLoeschen={
                        termin.manuellId != null && setVes ? () => {
                          setVes(prev => prev.map(v => v.id === termin.objektId
                            ? { ...v, termine: (v.termine || []).filter(x => x.id !== termin.manuellId) } : v));
                        }
                        : (termin.freiId != null && setFreieTermine ? () => {
                          setFreieTermine(prev => (prev || []).filter(x => x.id !== termin.freiId));
                        } : null)
                      }
                      onNotiz={
                        termin.manuellId != null && setVes ? (text) => {
                          setVes(prev => prev.map(v => v.id === termin.objektId
                            ? { ...v, termine: (v.termine || []).map(x => x.id === termin.manuellId ? { ...x, notizen: text } : x) } : v));
                        }
                        : (termin.freiId != null && setFreieTermine ? (text) => {
                          setFreieTermine(prev => (prev || []).map(x => x.id === termin.freiId ? { ...x, notizen: text } : x));
                        } : null)
                      }
                      onBearbeiten={
                        (termin.manuellId != null || termin.freiId != null) ? () => {
                          const isoVon = (d) => d ? (d.getFullYear() + "-" + String(d.getMonth()+1).padStart(2,"0") + "-" + String(d.getDate()).padStart(2,"0")) : "";
                          setBearbeiteTermin({
                            quelle: termin.manuellId != null ? "manuell" : "frei",
                            id: termin.manuellId != null ? termin.manuellId : termin.freiId,
                            objektId: termin.objektId || "",
                            start: {
                              titel: termin.titel || "",
                              datum: isoVon(termin.datum),
                              uhrzeit: termin.uhrzeit || "",
                              dauer: termin.dauer != null ? termin.dauer : null,
                              objektId: termin.objektId || "",
                              einheitIds: terminEinheitIds(termin).slice(),
                              kontaktIds: (termin.kontaktIds || []).slice(),
                              notizen: termin.notizen || ""
                            }
                          });
                          setOffenTerminKey(null);
                        } : null
                      }
                      onZiel={() => {
                        if (termin.objektId) gotoVE(termin.objektId, termin.ziel);
                        else if (termin.kontaktId) gotoKontakt(termin.kontaktId);
                      }}/>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
      )}
      {kalView === "timeline" && kalIstDesktop && !dockAktiv ? (
        <KalenderPanel variante="inline" offen={panelOffen} onClose={() => setPanelOffen(false)}
          termine={panelTermine} settings={settings} t={t} accent={kalFarbe}
          ves={ves} kontakte={kontakte}
          onGotoVE={(id, ziel) => gotoVE(id, ziel)} onGotoKontakt={gotoKontakt}
          onGotoTermin={(key) => {
            setOffenTerminKey(key);
            setTimeout(() => {
              if (typeof document === "undefined") return;
              const sel = (window.CSS && window.CSS.escape) ? window.CSS.escape(key) : key;
              const el = document.querySelector('[data-termin-key="' + sel + '"]');
              if (el && el.scrollIntoView) el.scrollIntoView({ behavior: "smooth", block: "center" });
            }, 120);
          }}/>
      ) : null}
      </div>
    </>
  );
}



export {
  AUTO_BETEILIGTE_REGELN, KALENDER_TYPEN, KAL_FENSTER_MONATE, KAL_ZOOM_STUFEN,
  KalenderPanel, KalenderScreen, isoKW, restzeitText, sammleTermine, terminEinheitIds
};
