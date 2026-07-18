// ═══════════════════════════════════════════════════════════════════════════
// vorgang.jsx — UI der Vorgangs-Welt (§96, VORGANG_Feature_Spec _03)
// ─────────────────────────────────────────────────────────────────────────────
// Feature-Modul wie kalender.jsx: Bausteine für den Vorgänge-Screen
// (allesda_merged ist nur Konsument). Datenlogik (Ampel, Hinweise, Status-
// ketten) lebt KOMPLETT in datenmodell.js — hier nur Darstellung.
//
// Bausteine:
//   AmpelPunkt        · 9×9-Punkt in den zentralen AMPEL_FARBEN (wie der
//                       Objekt-Status-Punkt der VEListenZeile — ein Aussehen)
//   VorgangKarte      · Karten-Klapp-Muster (§DESIGN: Klick auf den GESAMTEN
//                       Kopf, KEIN Chevron): Kopf = Punkt + Titel + Status-
//                       Pille; aufgeklappt Hinweise + Verlauf
//   LoseAuftragKarte  · vorgangsloser erfasst-Auftrag (Begehungsfund §5.12)
//   VorgangsBereichFuerObjekt / …FuerFirma · fertige Detail-Inhalte für die
//                       beiden Achsen der Vorgänge-Kachel (Objekte | Firmen)
// ═══════════════════════════════════════════════════════════════════════════
import React, { useEffect, useState } from "react";
import { AMPEL_FARBEN, FS, FW, RAD, getContrastColor } from "./constants.js";
import { datumDe, isoHeute, dateiBlobUrl } from "./utils-basis.js";
import { Avatar, HeaderZurueck, Inp, KontaktPicker, KontaktPickerMitAllen, KopfPille, SegmentControl, TabLeiste, overlayBackdrop, overlayPanel, OverlayKopf, overlayBody } from "./components.jsx";
import { NeueKarteMenu } from "./liegenschaft.jsx";
import { KontaktDetailKarte, KontaktZeile, objektBezugInfo } from "./kontakte.jsx";
import { AktionsButton } from "./kontakte-modul.jsx";
import { DESKTOP_MIN_WIDTH, I, useFristen, useVorlagen, useWindowWidth, useRollen, useFirmenRollen, useKontaktFarbe } from "./utils-icons.jsx";
import {
  VORGANG_KATEGORIEN, ampelFarbe, ampelFarbeAuftrag, auftragLaeuft,
  hinweiseFuerVorgang, kontaktAnzeigename, schreibtischEintraege,
  neuerAuftrag, neuesAngebot, neueNachricht, ANLASS_TYPEN, anlassTyp,
  BETEILIGUNG_ROLLEN, beteiligungRolle, neueBeteiligung,
  vorlageFuerSchritt, fuelleVorlage, fotoStandorte, fotoFindeRaum,
  vorgangKategorie, kategorieHatPhase, auftragBrauchtAbnahme, isoInTagen,
  auftragsNummerNeu, angebotsNummerNeu,
  weltAuftragBeauftragen, weltAuftragStatus, weltAuftragAbnehmen,
  weltAuftragAbhaken, weltRechnungNeu, weltRechnungStatus, rechnungAbgleich,
  weltAufgabeNeu, weltAufgabeErledigt, weltAngebotBeauftragen,
  weltWiedervorlageAufheben, weltVorgangSchliessen, weltVorgangOeffnen,
  weltAuftraegeBuendeln, weltVorgangRuhen, weltVorgangAufTagesordnung,
  weltVorgangVonTagesordnung, weltNotizNeu,
  weltVorgangLoeschen, weltAuftragLoeschen, weltDemoEntfernen, zaehleDemoDaten,
  timelineEintraege,
} from "./datenmodell.js";

// ── UI-Labels der Statusketten (reine Anzeige; ids siehe datenmodell §96.2) ──
const VORGANG_STATUS_LABEL = {
  offen: "Offen", beauftragt: "Beauftragt", ausfuehrung: "In Ausführung",
  abnahme: "Abnahme", rechnungspruefung: "Rechnungsprüfung",
  bezahlt: "Bezahlt", geschlossen: "Geschlossen",
};
const AUFTRAG_STATUS_LABEL = {
  erfasst: "Erfasst", beauftragt: "Beauftragt", in_arbeit: "In Arbeit",
  fertiggemeldet: "Fertig gemeldet", nachbesserung: "Nachbesserung",
  abgenommen: "Abgenommen",
};
const AMPEL_TITEL = {
  rot: "Überfällig", gelb: "Handlung fällig", blau: "Offener Entwurf",
  gruen: "Läuft", grau: "Ruht",
};

// ═════════════════════════════════════════════════════════════════════════
// VORGANG-UMBAU (VORGANG_Umbau_Konzept 11.07.2026) — der führende Kopf.
// Alles ERRECHNET, nichts gespeichert (§5): Phase, Ampel-Klartext und der
// eine nächste Schritt lesen den Zustand der Bausteine ab. Selbstheilend.
// ═════════════════════════════════════════════════════════════════════════
const PHASE_LABEL = {
  meldung: "Meldung", angebot: "Angebot", beschluss: "Beschluss",
  beauftragung: "Beauftragung", ausfuehrung: "Ausführung", abnahme: "Abnahme",
  rechnung: "Rechnung", abschluss: "Abschluss", gewaehrleistung: "Gewährleistung",
};

// Ist-Phase des Vorgangs — die Station, in der gerade gearbeitet wird.
// Abgeleitet aus dem Zustand der Aufträge/Angebote/Rechnungen (nie gespeichert).
function vorgangPhase(vorgang, welt) {
  const kat = vorgangKategorie(vorgang.kategorie);
  const hat = (p) => kat.phasen.indexOf(p) >= 0;
  if (vorgang.status === "geschlossen") return "abschluss";
  const auftraege = welt.auftraege.filter((a) => a.vorgang_id === vorgang.id);
  const angebote = welt.angebote.filter((a) => a.vorgang_id === vorgang.id);
  const rechnungen = welt.rechnungen.filter((r) => r.vorgang_id === vorgang.id);
  const alleDurch = auftraege.length > 0
    && auftraege.filter((a) => a.status !== "abgenommen").length === 0;
  if (alleDurch) {
    if (hat("rechnung")) {
      const offen = rechnungen.filter((r) => r.status !== "bezahlt").length > 0;
      if (offen || rechnungen.length === 0) return "rechnung";
    }
    return "abschluss";
  }
  const status = (s) => auftraege.filter((a) => a.status === s).length > 0;
  const abnahmeWartet = auftraege.filter((a) => a.status === "fertiggemeldet"
    && auftragBrauchtAbnahme(a, vorgang.kategorie)).length > 0;
  if (abnahmeWartet && hat("abnahme")) return "abnahme";
  if (status("in_arbeit") || status("nachbesserung") || status("fertiggemeldet")) {
    return "ausfuehrung";
  }
  if (status("beauftragt")) return "beauftragung";
  if (status("erfasst")) return "beauftragung";
  if (angebote.length > 0 && hat("angebot")) return "angebot";
  return "meldung";
}

// Fortschritts-Leiste durch die Phasenkette der Kategorie (§5.2): Punkte mit
// Verbindungslinien, Ist-Punkt gefüllt + Label darunter. Kategorie faltet
// die Stationen (kat.phasen), Mobile-tauglich schmal.
function PhasenLeiste({ vorgang, welt, t, accent }) {
  const kat = vorgangKategorie(vorgang.kategorie);
  const phasen = kat.phasen;
  const ist = vorgangPhase(vorgang, welt);
  const istIdx = phasen.indexOf(ist);
  return (
    <div style={{ margin: "8px 0 2px 0" }}>
      <div style={{ display: "flex", alignItems: "center" }}>
        {phasen.map((p, i) => {
          const erledigt = istIdx >= 0 && i < istIdx;
          const aktiv = i === istIdx;
          return (
            <React.Fragment key={p}>
              {i > 0 ? (
                <div style={{ flex: 1, height: 2, minWidth: 6,
                  background: erledigt || aktiv ? accent : t.border }}/>
              ) : null}
              <div title={PHASE_LABEL[p] || p} style={{
                width: aktiv ? 12 : 8, height: aktiv ? 12 : 8,
                borderRadius: RAD.pill, flexShrink: 0, boxSizing: "border-box",
                background: erledigt || aktiv ? accent : t.card,
                border: "2px solid " + (erledigt || aktiv ? accent : t.border) }}/>
            </React.Fragment>
          );
        })}
      </div>
      <div style={{ fontSize: FS.xs, fontWeight: FW.bold, color: accent,
        marginTop: 4 }}>
        {(PHASE_LABEL[ist] || ist)
          + (istIdx >= 0 ? " · Schritt " + (istIdx + 1) + " von " + phasen.length : "")}
      </div>
    </div>
  );
}

// ── BausteinKarte — aufklappbare Karte im Vorgangs-Stapel (§6) ─────────────
// Objekt-Verwaltung-Muster: ganzer Kopf ist Klickfläche, KEIN Chevron.
// Accordion macht der Aufrufer (offen/onToggle). Badge = Anzahl.
function BausteinKarte({ titel, anzahl, sub, punktFarbe, offen, onToggle, t, accent, children, kopfAktion = null }) {
  return (
    <div style={{ background: t.surface,
      border: "1px solid " + (offen ? accent + "60" : t.border),
      borderRadius: RAD.md, minWidth: 0 }}>
      <div onClick={onToggle} style={{ padding: "9px 12px", cursor: "pointer",
        display: "flex", alignItems: "center", gap: 8 }}>
        {punktFarbe ? (
          <span style={{ width: 10, height: 10, borderRadius: RAD.pill,
            background: punktFarbe, flexShrink: 0 }}/>
        ) : null}
        <div style={{ flex: 1, minWidth: 0, fontSize: FS.s, fontWeight: FW.bold,
          color: t.text }}>
          {titel}
          {anzahl != null ? (
            <span style={{ marginLeft: 6, fontSize: FS.xs, fontWeight: FW.bold,
              color: accent, background: accent + "18", borderRadius: RAD.pill,
              padding: "1px 7px" }}>{anzahl}</span>
          ) : null}
        </div>
        {sub ? (
          <div style={{ fontSize: FS.xs, color: t.muted, flexShrink: 0 }}>{sub}</div>
        ) : null}
        {/* §12.9 Kopf-Aktions-Slot: runde Icon-Buttons (KopfIconButton) rechts
            im Karten-Kopf. stopPropagation, damit der Klapp-Klick nicht feuert. */}
        {kopfAktion ? (
          <div onClick={(e) => e.stopPropagation()}
            style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
            {kopfAktion}
          </div>
        ) : null}
      </div>
      {offen ? (
        <div style={{ padding: "0 10px 10px 10px" }}>{children}</div>
      ) : null}
    </div>
  );
}

// ── AuftragNeuForm — Auftrag im Vorgang anlegen (§6b: an wen/was/bis wann) ──
// „Womit" (zugrundeliegendes Angebot) kommt mit der Angebots-Verbreiterung.
// Ohne Firma bleibt er „erfasst" (Entwurf); mit Firma wird direkt beauftragt.
function AuftragNeuForm({ vorgangId, kategorieId = null, firmen, kontakteObjekt = null, t, accent, onWelt, DatumFeld, onFertig }) {
  const [beschreibung, setBeschreibung] = useState("");
  const [firmaId, setFirmaId] = useState("");
  // §4.3: Ausführungsfrist-Default aus den Einstellungen — der am häufigsten
  // pro Fall überschriebene Wert, darum vorbelegt statt erzwungen.
  const fristen = useFristen();
  const vorlagen = useVorlagen();
  const [frist, setFrist] = useState(isoInTagen(fristen.ausfuehrung_tage));
  // §6b: Kategorie schlägt den Default vor, entschieden wird pro Auftrag.
  const [abnahme, setAbnahme] = useState(kategorieHatPhase(kategorieId, "abnahme"));
  const legeAn = () => {
    if (!beschreibung.trim()) return;
    const d = { vorgang_id: vorgangId, beschreibung: beschreibung.trim(),
      abnahme_noetig: abnahme };
    onWelt((w) => {
      const a = neuerAuftrag(Object.assign({}, d,
        { nummer: auftragsNummerNeu(w, vorgangId) }));
      let neu = Object.assign({}, w, { auftraege: [...w.auftraege, a] });
      if (firmaId) {
        neu = weltAuftragBeauftragen(neu, a.id,
          { firma_kontakt_id: firmaId, frist: frist || null,
            nachfass_ab: fristMinusTage(frist, fristen.nachfass_vorlauf_tage) });
        // Beauftragung → Kommunikation (dokumentiert + hält nach)
        neu = logBeauftragung(neu, { vorgangId: vorgangId, nummer: a.nummer,
          beschreibung: a.beschreibung, firmaId: firmaId,
          firmaName: nameVon(firmen, firmaId), frist: frist || null,
          vorlagen: vorlagen, rueckmeldungTage: fristen.rueckmeldung_tage });
      }
      return neu;
    });
    onFertig();
  };
  return (
    <div style={flowZeileStil(t)}>
      <label style={feldLabelStil(t)}>Was ist zu tun?</label>
      <input value={beschreibung} onChange={(e) => setBeschreibung(e.target.value)}
        placeholder="z. B. Dach decken (abgegrenzter Leistungsteil)"
        style={Object.assign({}, selectStil(t, accent, !!beschreibung), { marginBottom: 0 })}/>
      <KontaktPickerMitAllen value={firmaId || null}
        onChange={(id) => setFirmaId(id || "")}
        label="An wen (Firma) — leer = nur erfassen" t={t} accent={accent} nurFirmen
        kontakteObjekt={kontakteObjekt ? pickerListe(kontakteObjekt) : null}
        kontakteAlle={pickerListe(firmen)}/>
      {firmaId && DatumFeld ? (
        <DatumFeld t={t} accent={accent} label="Bis wann (Ausführungsfrist)"
          value={frist} onChange={setFrist} iso defaultHeute={false}/>
      ) : null}
      <label style={{ display: "flex", alignItems: "center", gap: 8,
        fontSize: FS.s, color: t.text, cursor: "pointer" }}>
        <input type="checkbox" checked={abnahme}
          onChange={(e) => setAbnahme(e.target.checked)}
          style={{ width: 18, height: 18 }}/>
        Abnahme erforderlich
      </label>
      <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
        <button onClick={onFertig} style={flowKnopf(t, accent, false)}>Abbrechen</button>
        <button onClick={legeAn} style={flowKnopf(t, accent, true)}>
          {firmaId ? "Beauftragen" : "Erfassen"}</button>
      </div>
    </div>
  );
}

// Objekt-Kontakte (Benny 11.07.): Auswahl zeigt ERST die Kontakte mit Bezug
// zum Objekt (objektBezugInfo — dieselbe Logik wie der Objekt-Kontakte-Tab),
// „Alle durchsuchen" schaltet um (KontaktPickerMitAllen-Baustein).
function useObjektKontakte(kontakte, ve) {
  const personenRollen = useRollen();
  const firmenRollen = useFirmenRollen();
  const farben = useKontaktFarbe();
  if (!ve) return null; // kein Objekt-Kontext (z. B. Firmen-Sicht) → kein Filter
  return (kontakte || []).filter((k) =>
    k && objektBezugInfo(k, ve, personenRollen, firmenRollen, farben).hatBezug);
}

// Räume je Wo (Benny 11.07.): Objekt → Einheit → RAUM. Einheit gewählt →
// Räume ihrer Teile; Gemeinschaft → Räume der Standorte (Häuser).
function raeumeFuerWo(ve, einheitId) {
  if (!ve) return [];
  const raus = [];
  if (einheitId) {
    const e = (ve.einheiten || []).find((x) => x && String(x.id) === String(einheitId));
    ((e && e.teile) || []).forEach((teil) => {
      (teil.raeume || []).forEach((r) => { if (r) raus.push(r); });
    });
  } else {
    (fotoStandorte(ve) || []).forEach((st) => {
      (st.raeume || []).forEach((r) => { if (r) raus.push(r); });
    });
  }
  return raus;
}

// Raum finden — über BEIDE Welten (Benny 11.07.): fotoFindeRaum kennt nur
// die Gebäude-Karten (§93); Einheiten-Räume leben in ve.einheiten[].teile.
function findeRaum(ve, raumId) {
  if (!ve || !raumId) return null;
  const ausKarten = fotoFindeRaum(ve, raumId);
  if (ausKarten) return ausKarten;
  const einheiten = Array.isArray(ve.einheiten) ? ve.einheiten : [];
  for (let i = 0; i < einheiten.length; i++) {
    const teile = (einheiten[i] && einheiten[i].teile) || [];
    for (let j = 0; j < teile.length; j++) {
      const r = (teile[j].raeume || []).find((x) => x && String(x.id) === String(raumId));
      if (r) return r;
    }
  }
  return null;
}

// KontaktPicker-Adapter (§76): der kanonische Baustein erwartet ein
// name-Feld — Personen bekommen es aus kontaktAnzeigename.
function pickerListe(kontakte) {
  return (kontakte || []).map((k) =>
    Object.assign({}, k, { name: kontaktAnzeigename(k) || k.name || "" }));
}

// Beauftragung → Kommunikation (Benny 11.07.): jede Auftragserteilung
// schreibt einen AUSGEHENDEN Eintrag in die Kommunikation des Vorgangs —
// Text aus der Vorlage „Auftragsvergabe", Antwort (Auftragsbestätigung)
// erwartet, Rückmeldefrist läuft. Die Karte ist das Gedächtnis: Klicks
// allein beauftragen keine Firma, aber ab jetzt ist jede Vergabe als
// Kommunikationsvorgang dokumentiert und wird nachgehalten.
function logBeauftragung(w, args) {
  const v = w.vorgaenge.filter((x) => x.id === args.vorgangId)[0] || null;
  const vorlage = vorlageFuerSchritt(args.vorlagen, "beauftragung");
  const text = fuelleVorlage(vorlage ? vorlage.text : "Auftrag {nummer} erteilt: {beschreibung} (bis {frist})", {
    nummer: args.nummer || (v ? v.nummer : ""),
    titel: v ? v.titel : "",
    objekt: args.objektText || "",
    beschreibung: args.beschreibung || "",
    firma: args.firmaName || "",
    frist: args.frist ? datumDe(args.frist) : "",
  });
  return Object.assign({}, w, {
    nachrichten: [...w.nachrichten, neueNachricht({
      vorgang_id: args.vorgangId, richtung: "ausgehend",
      an_kontakt_id: args.firmaId || null, kanal: "notiz",
      anlass: "beauftragung", inhalt: text,
      antwort_erwartet: true,
      rueckmeldung_bis: isoInTagen(args.rueckmeldungTage),
    })],
  });
}

// §4.3: interner Nachfass-Zeitpunkt = Ausführungsfrist − Vorlauf (Tage).
function fristMinusTage(iso, tage) {
  if (!iso) return null;
  const d = new Date(iso + "T12:00:00");
  if (isNaN(d.getTime())) return null;
  d.setDate(d.getDate() - (Number(tage) || 0));
  return d.toISOString().slice(0, 10);
}

function eur(n) {
  if (n == null || isNaN(Number(n))) return "";
  return Number(n).toLocaleString("de-DE") + " €";
}
function nameVon(kontakte, id) {
  if (!id) return "";
  const k = (kontakte || []).filter((x) => x && x.id === id)[0];
  return k ? kontaktAnzeigename(k) : "";
}

// ── AmpelPunkt ───────────────────────────────────────────────────────────────
// Exakt die Optik des Objekt-Status-Punkts (VEListenZeile: 9×9, radius 5).
function AmpelPunkt({ farbe, title }) {
  return (
    <span title={title || AMPEL_TITEL[farbe] || ""}
      style={{ width: 9, height: 9, borderRadius: 5, flexShrink: 0,
        background: AMPEL_FARBEN[farbe] || AMPEL_FARBEN.grau }}/>
  );
}

// ── StatusPille ──────────────────────────────────────────────────────────────
// Muster der bestehenden Status-Pillen (ETV-/Demo-Zeilen): RAD.sm, 2px 8px.
function StatusPille({ text, farbe, t }) {
  const bg = farbe || (t ? t.border : "#888");
  return (
    <span style={{ flexShrink: 0, fontSize: FS.xs, fontWeight: FW.bold,
      color: getContrastColor(bg), background: bg,
      borderRadius: RAD.sm, padding: "2px 8px", whiteSpace: "nowrap" }}>{text}</span>
  );
}

// ── Verlauf: chronologische Ereignisliste eines Vorgangs (reine Funktion) ────
// Zieht alle Kinder aus den flachen Listen zusammen — jede Zeile { datum,
// text }. Sortiert aufsteigend (Meldung oben, Jüngstes unten = Leserichtung
// einer Akte).
function baueVerlauf(vorgang, welt, kontakte) {
  const E = [];
  const dazu = (datum, text) => { if (text) E.push({ datum: datum || "", text: text }); };

  dazu(vorgang.angelegt_am, "Vorgang angelegt");
  const nachrichten = welt.nachrichten.filter((n) => n.vorgang_id === vorgang.id);
  for (let i = 0; i < nachrichten.length; i++) {
    const n = nachrichten[i];
    if (n.kanal === "notiz" && !n.von_kontakt_id && !n.an_kontakt_id && !n.betreff) {
      // Verwalter-Notiz (§96.10): kein Absender/Empfänger — der Inhalt IST die Zeile.
      dazu(n.gesendet_am, "Notiz: " + (n.inhalt || ""));
      continue;
    }
    const wer = nameVon(kontakte, n.richtung === "eingehend" ? n.von_kontakt_id : n.an_kontakt_id);
    dazu(n.gesendet_am, (n.richtung === "eingehend" ? "Nachricht" : "Nachricht an")
      + (wer ? (n.richtung === "eingehend" ? " von " + wer : " " + wer) : "")
      + (n.betreff ? ": " + n.betreff : (n.inhalt ? ": " + n.inhalt : "")));
  }
  const angebote = welt.angebote.filter((a) => a.vorgang_id === vorgang.id);
  for (let i = 0; i < angebote.length; i++) {
    const a = angebote[i];
    const wer = nameVon(kontakte, a.firma_kontakt_id);
    dazu(a.eingeholt_am, "Angebot" + (wer ? " " + wer : "")
      + (a.preis != null ? " · " + eur(a.preis) : "")
      + (a.wurde_zu_auftrag_id ? " → beauftragt" : ""));
  }
  const auftraege = welt.auftraege.filter((a) => a.vorgang_id === vorgang.id);
  for (let i = 0; i < auftraege.length; i++) {
    const a = auftraege[i];
    dazu(a.erfasst_am, "Erfasst: " + (a.beschreibung || "Auftrag"));
    if (a.beauftragt_am) {
      const wer = nameVon(kontakte, a.firma_kontakt_id);
      dazu(a.beauftragt_am, "Beauftragt" + (wer ? ": " + wer : "")
        + " — " + (AUFTRAG_STATUS_LABEL[a.status] || a.status));
    }
    const abnahmen = welt.abnahmen.filter((ab) => ab.auftrag_id === a.id);
    for (let j = 0; j < abnahmen.length; j++) {
      const ab = abnahmen[j];
      dazu(ab.datum, "Abnahme: " + (ab.ergebnis === "angenommen" ? "angenommen"
        : ab.ergebnis === "mit_maengeln" ? "mit Mängeln" : "abgelehnt")
        + (ab.notiz ? " — " + ab.notiz : (Array.isArray(ab.maengel) && ab.maengel.length > 0
          ? " (" + ab.maengel.length + ")" : "")));
    }
  }
  const rechnungen = welt.rechnungen.filter((r) => r.vorgang_id === vorgang.id);
  for (let i = 0; i < rechnungen.length; i++) {
    const r = rechnungen[i];
    dazu(r.eingegangen_am, "Rechnung eingegangen"
      + (r.betrag != null ? " · " + eur(r.betrag) : ""));
    if (r.bezahlt_am) dazu(r.bezahlt_am, "Rechnung bezahlt");
  }
  const aufgaben = welt.aufgaben.filter((a) => a.vorgang_id === vorgang.id);
  for (let i = 0; i < aufgaben.length; i++) {
    const a = aufgaben[i];
    dazu(a.angelegt_am, "Aufgabe: " + (a.titel || "")
      + (a.frist ? " (Frist " + datumDe(a.frist) + ")" : ""));
    if (a.erledigt_am) dazu(a.erledigt_am, "Aufgabe erledigt: " + (a.titel || ""));
  }
  if (vorgang.geschlossen_am) dazu(vorgang.geschlossen_am, "Vorgang geschlossen");

  E.sort((x, y) => String(x.datum).localeCompare(String(y.datum)));
  return E;
}

// ═════════════════════════════════════════════════════════════════════════
// BETEILIGTEN-KARTE (Umbau-Konzept §2) — der Vorgang wächst im Kreis der
// Menschen. Regeln: nachträglich pflegbar · NIE löschen, nur beenden
// (bis-Datum, bleibt in der Akte auffindbar — Versicherung!) · Hinzufügen ist
// STILL (löst nie eine Nachricht aus, macht nur erreichbar) — die Oberfläche
// bietet danach DEZENT „auch informieren?" an: zwei bewusste Handgriffe.
// ═════════════════════════════════════════════════════════════════════════
// Rollen-Gruppen-Optik (Icons analog KONTAKT_KATEGORIEN im Objekt-Kontakte-Tab)
const BETEILIGTE_GRUPPEN_ICON = {
  fallfuehrer: "🧭", melder: "📣", betroffener: "🏠", mitinformiert: "👥",
  extern: "🌐", ausfuehrender: "🛠", pruefer: "✓",
};
function BeteiligtenBlock({ vorgang, beteiligungen, kontakte, kontakteObjekt = null, ve = null, t, accent, kannFlows, onWelt, onInformieren }) {
  const [formOffen, setFormOffen] = useState(false);
  const [kontaktId, setKontaktId] = useState("");
  const [rolle, setRolle] = useState("betroffener");
  const [frisch, setFrisch] = useState(null);
  const [offenerKontakt, setOffenerKontakt] = useState(null); // "beteiligungId" → aufgeklappte Karte
  const aktive = beteiligungen.filter((b) => b.status !== "beendet");
  const beendete = beteiligungen.filter((b) => b.status === "beendet");
  const fuegeHinzu = () => {
    if (!kontaktId) return;
    onWelt((w) => Object.assign({}, w, {
      beteiligungen: [...w.beteiligungen, neueBeteiligung({
        vorgang_id: vorgang.id, kontakt_id: kontaktId, rolle: rolle })],
    }));
    setFrisch(kontaktId);
    setKontaktId(""); setFormOffen(false);
  };
  const beende = (b) => {
    onWelt((w) => Object.assign({}, w, {
      beteiligungen: w.beteiligungen.map((x) => x.id === b.id
        ? Object.assign({}, x, { status: "beendet", bis: isoHeute() }) : x),
    }));
  };
  // Beteiligungs-Zeile im Objekt-Kontakte-Muster: kleine KontaktZeile,
  // Klick klappt die echte KontaktDetailKarte auf (derselbe Baustein wie im
  // Objekt-Kontakte-Tab — direkter Griff zu Telefon & Co.).
  const zeile = (b, beendet) => {
    const k = b.kontakt_id ? (kontakte || []).filter((x) => x && x.id === b.kontakt_id)[0] : null;
    const seitBis = beendet && b.bis ? "bis " + datumDe(b.bis)
      : (b.von ? "seit " + datumDe(b.von) : "");
    const rechts = (
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
        <span style={{ fontSize: FS.xs, color: t.muted, whiteSpace: "nowrap" }}>{seitBis}</span>
        {kannFlows && !beendet && b.rolle !== "fallfuehrer" ? (
          <button onClick={(e) => { e.stopPropagation(); beende(b); }}
            style={flowKnopf(t, accent, false)}>Beenden</button>
        ) : null}
      </div>
    );
    if (!k) {
      // die Verwaltung (kein Kontakt-Datensatz) — schlichte Zeile
      return (
        <div key={b.id} style={{ display: "flex", alignItems: "center", gap: 10,
          padding: "6px 2px", opacity: beendet ? 0.6 : 1 }}>
          <Avatar name="die Verwaltung" size={30} accent={accent}/>
          <div style={{ flex: 1, minWidth: 0, fontSize: FS.s, color: t.text }}>
            die Verwaltung</div>
          {rechts}
        </div>
      );
    }
    const offen = offenerKontakt === b.id;
    return (
      <div key={b.id} style={{ opacity: beendet ? 0.6 : 1 }}>
        {offen ? (
          <div style={{ margin: "6px 0 10px" }}>
            <KontaktDetailKarte k={k} t={t} accent={accent}
              kategorieFarbe={accent} ves={ve ? [ve] : []} kontakte={kontakte}
              setKontakte={null} embedded
              onKopfClick={() => setOffenerKontakt(null)}/>
            <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 4 }}>
              {rechts}
            </div>
          </div>
        ) : (
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <KontaktZeile k={k} ve={ve} t={t} accent={accent}
                highlightAccent={accent} isActive={false}
                onClick={() => setOffenerKontakt(b.id)}/>
            </div>
            {rechts}
          </div>
        )}
      </div>
    );
  };
  // Rollen-Gruppen wie im Objekt-Kontakte-Tab: Kopf mit Icon · Label · Zähler,
  // beendete Beteiligungen grau in ihrer Gruppe (Akte vergisst nichts).
  const gruppen = BETEILIGUNG_ROLLEN.map((r) => ({
    rolle: r,
    aktive: aktive.filter((b) => b.rolle === r.id),
    beendete: beendete.filter((b) => b.rolle === r.id),
  })).filter((g) => g.aktive.length + g.beendete.length > 0);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {gruppen.map((g) => (
        <div key={g.rolle.id} style={{ background: t.card,
          border: "1px solid " + t.border, borderRadius: RAD.lg,
          padding: "10px 12px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
            <span style={{ fontSize: 16 }}>{BETEILIGTE_GRUPPEN_ICON[g.rolle.id] || "👤"}</span>
            <div style={{ fontSize: FS.m, fontWeight: FW.bold, color: t.text }}>
              {g.rolle.label}
              <span style={{ color: t.muted, fontWeight: FW.med }}>
                {"  (" + (g.aktive.length + g.beendete.length) + ")"}</span>
            </div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            {g.aktive.map((b) => zeile(b, false))}
            {g.beendete.map((b) => zeile(b, true))}
          </div>
        </div>
      ))}
      {frisch ? (
        <div style={{ display: "flex", alignItems: "center", gap: 8,
          padding: "6px 10px", borderRadius: RAD.md,
          background: accent + "10", border: "1px solid " + accent + "30" }}>
          <div style={{ flex: 1, minWidth: 0, fontSize: FS.xs, color: t.text }}>
            {(nameVon(kontakte, frisch) || "Kontakt") + " hinzugefügt — auch informieren?"}</div>
          <button onClick={() => { onInformieren(frisch); setFrisch(null); }}
            style={flowKnopf(t, accent, true)}>Informieren</button>
          <button onClick={() => setFrisch(null)}
            style={flowKnopf(t, accent, false)}>Später</button>
        </div>
      ) : null}
      {kannFlows && formOffen ? (
        <div style={flowZeileStil(t)}>
          <KontaktPickerMitAllen value={kontaktId || null}
            onChange={(id) => setKontaktId(id || "")}
            label="Wer?" t={t} accent={accent}
            kontakteObjekt={kontakteObjekt ? pickerListe(kontakteObjekt) : null}
            kontakteAlle={pickerListe(kontakte)}/>
          <label style={feldLabelStil(t)}>Rolle am Vorgang</label>
          <select value={rolle} onChange={(e) => setRolle(e.target.value)}
            style={Object.assign({}, selectStil(t, accent, true), { marginBottom: 0 })}>
            {BETEILIGUNG_ROLLEN.filter((r) => r.id !== "fallfuehrer").map((r) => (
              <option key={r.id} value={r.id}>{r.label}</option>
            ))}
          </select>
          <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
            <button onClick={() => setFormOffen(false)}
              style={flowKnopf(t, accent, false)}>Abbrechen</button>
            <button onClick={fuegeHinzu}
              style={flowKnopf(t, accent, true)}>Hinzufügen</button>
          </div>
        </div>
      ) : (kannFlows ? (
        <button onClick={() => setFormOffen(true)}
          style={flowKnopf(t, accent, false)}>+ Beteiligter</button>
      ) : null)}
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════════
// KOMMUNIKATIONS-KARTE (Umbau-Konzept §3.2) — primär LESE-Ort („wie kann ich
// nachvollziehen, was geschrieben wurde"). Zwei umschaltbare Sichten auf EINE
// flache nachrichten[]-Liste (Termin-Muster, kein Doppelmodell):
//  · Verlauf — alles gemischt, chronologisch (der Kommunikations-Film)
//  · Chat    — 1:1-Faden pro Person/Firma, Wähler „mit wem"
// Kanal-agnostisch, manuell eintrag- UND zuweisbar; Kanal PRO Eintrag.
// Eingehende Antwort MIT Inhalt schließt den offenen Faden (§3.3 — Nachweis).
// ═════════════════════════════════════════════════════════════════════════
const KANAL_OPTIONEN = [
  { id: "telefon", label: "Telefon", symbol: "☎" },
  { id: "whatsapp", label: "WhatsApp", symbol: "💬" },
  { id: "email", label: "E-Mail", symbol: "✉" },
  { id: "brief", label: "Brief", symbol: "📄" },
  { id: "persoenlich", label: "Persönlich", symbol: "🤝" },
  { id: "notiz", label: "Notiz", symbol: "✎" },
];
function kanalSymbol(id) {
  const k = KANAL_OPTIONEN.filter((x) => x.id === id)[0];
  return k ? k.symbol : "✎";
}
// Das Gegenüber einer Nachricht (für Chat-Gruppierung): eingehend → Absender,
// ausgehend → Empfänger. null = reine Akte-Notiz (nur im Verlauf sichtbar).
function nachrichtGegenueber(n) {
  return n.richtung === "eingehend" ? (n.von_kontakt_id || null) : (n.an_kontakt_id || null);
}

function NachrichtNeuForm({ vorgangId, kontakte, kontakteObjekt = null, t, accent, onWelt, onFertig, antwortAuf = null, vorKontaktId = null, vorAnlass = null }) {
  // Antwort nachtragen (§3.3): Gegenüber + Richtung „eingehend" vorbelegt,
  // antwort_auf_id schließt den Faden. §2/§3.1: Kontext setzt den Anlass —
  // „informieren" nach Hinzufügen eines Betroffenen bringt „Betroffenheit" mit.
  const [gegenueberId, setGegenueberId] = useState(
    antwortAuf ? (nachrichtGegenueber(antwortAuf) || "") : (vorKontaktId || ""));
  const [richtung, setRichtung] = useState(antwortAuf ? "eingehend" : "ausgehend");
  const [kanal, setKanal] = useState(antwortAuf ? (antwortAuf.kanal || "notiz") : "telefon");
  const [anlass, setAnlass] = useState(vorAnlass || "frei");
  const [antwortErwartet, setAntwortErwartet] = useState(
    vorAnlass ? !!anlassTyp(vorAnlass).antwort : false);
  const fristen = useFristen();
  const [inhalt, setInhalt] = useState("");
  const waehleAnlass = (id) => {
    setAnlass(id);
    setAntwortErwartet(!!anlassTyp(id).antwort); // Default aus Anlass (§3.3)
  };
  const speichere = () => {
    if (!inhalt.trim()) return;
    const erwartet = richtung === "ausgehend" ? antwortErwartet : false;
    const d = {
      vorgang_id: vorgangId, richtung: richtung, kanal: kanal,
      anlass: anlass, inhalt: inhalt.trim(),
      antwort_erwartet: erwartet,
      // §4.3: Rückmeldung — EIN globaler Standard für alle offenen Fäden.
      rueckmeldung_bis: erwartet ? isoInTagen(fristen.rueckmeldung_tage) : null,
      antwort_auf_id: antwortAuf ? antwortAuf.id : null,
      von_kontakt_id: richtung === "eingehend" ? (gegenueberId || null) : null,
      an_kontakt_id: richtung === "ausgehend" ? (gegenueberId || null) : null,
    };
    onWelt((w) => Object.assign({}, w, {
      nachrichten: [...w.nachrichten, neueNachricht(d)],
    }));
    onFertig();
  };
  return (
    <div style={flowZeileStil(t)}>
      {antwortAuf ? (
        <div style={{ fontSize: FS.xs, color: t.muted, overflowWrap: "anywhere" }}>
          {"Antwort auf: " + (antwortAuf.inhalt || antwortAuf.betreff || "Nachricht")}</div>
      ) : null}
      <KontaktPickerMitAllen value={gegenueberId || null}
        onChange={(id) => setGegenueberId(id || "")}
        label="Mit wem? (leer = Akte-Notiz)" t={t} accent={accent}
        kontakteObjekt={kontakteObjekt ? pickerListe(kontakteObjekt) : null}
        kontakteAlle={pickerListe(kontakte)}/>
      <SegmentControl t={t} accent={accent} voll={true}
        options={[{ id: "ausgehend", label: "Von mir (ausgehend)" },
          { id: "eingehend", label: "An mich (eingehend)" }]}
        value={richtung} onChange={setRichtung}/>
      <label style={feldLabelStil(t)}>Kanal</label>
      <select value={kanal} onChange={(e) => setKanal(e.target.value)}
        style={Object.assign({}, selectStil(t, accent, true), { marginBottom: 0 })}>
        {KANAL_OPTIONEN.map((k) => (
          <option key={k.id} value={k.id}>{k.symbol + " " + k.label}</option>
        ))}
      </select>
      {!antwortAuf ? (
        <div>
          <label style={feldLabelStil(t)}>Anlass</label>
          <select value={anlass} onChange={(e) => waehleAnlass(e.target.value)}
            style={Object.assign({}, selectStil(t, accent, true), { marginBottom: 0 })}>
            {ANLASS_TYPEN.map((a) => (
              <option key={a.id} value={a.id}>{a.label}</option>
            ))}
          </select>
        </div>
      ) : null}
      {richtung === "ausgehend" && !antwortAuf ? (
        <label style={{ display: "flex", alignItems: "center", gap: 8,
          fontSize: FS.s, color: t.text, cursor: "pointer" }}>
          <input type="checkbox" checked={antwortErwartet}
            onChange={(e) => setAntwortErwartet(e.target.checked)}
            style={{ width: 18, height: 18 }}/>
          Antwort erwartet
        </label>
      ) : null}
      <textarea value={inhalt} onChange={(e) => setInhalt(e.target.value)} rows={3}
        placeholder={antwortAuf ? "Was wurde geantwortet? (schließt den Faden)"
          : "Was wurde besprochen / geschrieben?"}
        style={Object.assign({}, selectStil(t, accent, !!inhalt),
          { resize: "vertical", minHeight: 60, marginBottom: 0 })}/>
      <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
        <button onClick={onFertig} style={flowKnopf(t, accent, false)}>Abbrechen</button>
        <button onClick={speichere} style={flowKnopf(t, accent, true)}>
          {antwortAuf ? "Antwort festhalten" : "Festhalten"}</button>
      </div>
    </div>
  );
}

function KommunikationsBlock({ vorgang, nachrichten, kontakte, kontakteObjekt = null, t, accent, kannFlows, onWelt, formAuto, onFormZu, vorKontaktId = null, vorAnlass = null }) {
  const [sicht, setSicht] = useState("verlauf"); // "verlauf" | "chat"
  const [chatMit, setChatMit] = useState("");
  const [antwortAuf, setAntwortAuf] = useState(null); // Nachricht | null
  const sortiert = nachrichten.slice().sort((a, b) =>
    String(a.gesendet_am).localeCompare(String(b.gesendet_am)));
  // Offene Fäden (§3.3): ausgehend + antwort_erwartet + noch keine Antwort.
  const beantwortet = {};
  for (let i = 0; i < sortiert.length; i++) {
    if (sortiert[i].antwort_auf_id) beantwortet[sortiert[i].antwort_auf_id] = true;
  }
  const istOffen = (n) => n.richtung === "ausgehend" && n.antwort_erwartet && !beantwortet[n.id];
  // Chat-Gegenüber: alle Kontakte, mit denen Nachrichten bestehen.
  const gegenueberIds = [];
  for (let i = 0; i < sortiert.length; i++) {
    const g = nachrichtGegenueber(sortiert[i]);
    if (g && gegenueberIds.indexOf(g) < 0) gegenueberIds.push(g);
  }
  const chatAktiv = chatMit || gegenueberIds[0] || "";
  const chatNachrichten = sortiert.filter((n) => nachrichtGegenueber(n) === chatAktiv);
  const formOffen = formAuto || antwortAuf;

  const zeile = (n) => {
    const wer = nameVon(kontakte, nachrichtGegenueber(n));
    return (
      <div key={n.id} style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
        <span style={{ fontSize: FS.xs, color: t.muted, flexShrink: 0,
          whiteSpace: "nowrap" }}>{datumDe(n.gesendet_am)}</span>
        <span style={{ fontSize: FS.xs, flexShrink: 0 }} title={n.kanal}>
          {kanalSymbol(n.kanal)}</span>
        <span style={{ fontSize: FS.xs, color: t.muted, flexShrink: 0 }}>
          {n.richtung === "eingehend" ? "←" : "→"}</span>
        <span style={{ fontSize: FS.s, color: t.text, minWidth: 0,
          overflowWrap: "anywhere", flex: 1 }}>
          {(wer ? wer + ": " : "") + (n.inhalt || n.betreff || "")}
        </span>
        {istOffen(n) ? (
          kannFlows ? (
            <button onClick={() => setAntwortAuf(n)}
              style={Object.assign({}, flowKnopf(t, accent, false),
                { borderColor: AMPEL_FARBEN.gelb + "80", color: t.text })}>
              Antwort nachtragen</button>
          ) : (
            <StatusPille t={t} farbe={AMPEL_FARBEN.gelb} text="Antwort erwartet"/>
          )
        ) : null}
      </div>
    );
  };
  const blase = (n) => {
    const aus = n.richtung === "ausgehend";
    return (
      <div key={n.id} style={{ display: "flex",
        justifyContent: aus ? "flex-end" : "flex-start" }}>
        <div style={{ maxWidth: "82%", padding: "7px 10px", borderRadius: RAD.md,
          background: aus ? accent + "1C" : t.surface,
          border: "1px solid " + (aus ? accent + "40" : t.border) }}>
          <div style={{ fontSize: FS.s, color: t.text,
            overflowWrap: "anywhere" }}>{n.inhalt || n.betreff || ""}</div>
          <div style={{ fontSize: FS.xs, color: t.muted, marginTop: 3,
            display: "flex", gap: 6, justifyContent: aus ? "flex-end" : "flex-start" }}>
            <span>{kanalSymbol(n.kanal)}</span>
            <span>{datumDe(n.gesendet_am)}</span>
            {istOffen(n) ? <span style={{ color: AMPEL_FARBEN.gelb,
              fontWeight: FW.bold }}>Antwort erwartet</span> : null}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {sortiert.length > 0 ? (
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <KopfPille t={t} accent={accent} aktiv={sicht} onWaehle={setSicht}
            optionen={[{ id: "verlauf", label: "Verlauf" }, { id: "chat", label: "Chat" }]}/>
          {sicht === "chat" && gegenueberIds.length > 0 ? (
            <select value={chatAktiv} onChange={(e) => setChatMit(e.target.value)}
              style={Object.assign({}, selectStil(t, accent, true),
                { marginBottom: 0, flex: 1, minWidth: 120 })}>
              {gegenueberIds.map((id) => (
                <option key={id} value={id}>{nameVon(kontakte, id) || "Unbekannt"}</option>
              ))}
            </select>
          ) : null}
        </div>
      ) : null}
      {sicht === "verlauf" ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
          {sortiert.map(zeile)}
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {gegenueberIds.length === 0 ? (
            <div style={{ fontSize: FS.s, color: t.muted }}>
              Noch keine Nachrichten mit einem Gegenüber.</div>
          ) : chatNachrichten.map(blase)}
        </div>
      )}
      {kannFlows && formOffen ? (
        <NachrichtNeuForm vorgangId={vorgang.id} kontakte={kontakte}
          kontakteObjekt={kontakteObjekt} t={t}
          accent={accent} onWelt={onWelt} antwortAuf={antwortAuf}
          vorKontaktId={vorKontaktId} vorAnlass={vorAnlass}
          onFertig={() => { setAntwortAuf(null); onFormZu(); }}/>
      ) : (kannFlows ? (
        <button onClick={() => onFormZu(true)}
          style={flowKnopf(t, accent, false)}>+ Nachricht</button>
      ) : null)}
    </div>
  );
}

// ── VorgangKarte ─────────────────────────────────────────────────────────────
// Karten-Klapp-Muster: der GESAMTE Kopf ist die Klick-Fläche (kein Chevron,
// kein Pfeil). Zu: Punkt + Titel + Status-Pille + Sub (Kategorie · seit).
// Auf: zusätzlich Handlungs-Hinweise (farbig) und der Verlauf.
function VorgangKarte({ vorgang, welt, kontakte, t, accent, offen, onToggle }) {
  // NUR noch die Listen-Zeile (Feinschliff 11.07.): der Vorgang ist eine AKTE
  // — Klick öffnet das Detail-Fenster (VorgangDetail), kein Aufklappen mehr.
  // offen = dieser Vorgang ist gerade im Detail (Akzent-Rahmen als Marker).
  const farbe = ampelFarbe(vorgang, welt);
  const kat = vorgangKategorie(vorgang.kategorie);
  const sub = [vorgang.nummer, kat.label, "seit " + datumDe(vorgang.angelegt_am)]
    .filter(Boolean).join(" · ");
  return (
    <div onClick={onToggle} style={{ background: t.card,
      border: "1px solid " + (offen ? accent : t.border),
      borderRadius: RAD.lg, minWidth: 0, boxSizing: "border-box", width: "100%",
      padding: "12px 14px", cursor: "pointer" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <AmpelPunkt farbe={farbe}/>
        <div style={{ flex: 1, minWidth: 0, fontSize: FS.l, fontWeight: FW.bold,
          color: t.text, overflowWrap: "anywhere" }}>{vorgang.titel || "Vorgang"}</div>
        <StatusPille t={t} farbe={accent}
          text={VORGANG_STATUS_LABEL[vorgang.status] || vorgang.status}/>
      </div>
      <div style={{ fontSize: FS.s, color: t.muted, marginTop: 4,
        overflowWrap: "anywhere" }}>{sub}</div>
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════════
// VORGANG-DETAIL (Feinschliff 11.07., Bennys Grundriss) — der Vorgang ist
// eine AKTE, kein Klapp-Eintrag. Eigenes Detail-Fenster nach Objekt-Vorbild:
// Kopf = Vorgangsnummer groß + Titel/Liegenschaft klein · darunter TabLeiste
// (§97), die MIT dem Vorgang WÄCHST: Übersicht · Beteiligte · Kommunikation
// sind das Minimum, Angebote/Rechnungen erscheinen, sobald es sie gibt.
// Übersicht: Stand-Karte (Phasen-Linie + nächster Schritt) oben, dann Daten
// (inkl. Verlauf — Bennys Wahl D), dann Aufträge/Aufgaben/Notiz wie gehabt.
// ═════════════════════════════════════════════════════════════════════════
function VorgangDetail({ vorgang, welt, kontakte, t, accent, onZurueck, onWelt = null, DatumFeld = null, ve = null, onFotoHinzu = null, zurueckKnopf = true }) {
  const [tab, setTab] = useState("uebersicht");
  const kontakteObjekt = useObjektKontakte(kontakte, ve);
  const [tabZwang, setTabZwang] = useState({}); // Katalog erzwingt Tab vor erstem Inhalt
  const [offenerBaustein, setOffenerBaustein] = useState(null);
  const [formBaustein, setFormBaustein] = useState(null);
  const [mehrOffen, setMehrOffen] = useState(false);
  const [informierenKontakt, setInformierenKontakt] = useState(null);
  const [aufgabeTitel, setAufgabeTitel] = useState("");
  const [rechnungBetrag, setRechnungBetrag] = useState("");
  const [notizText, setNotizText] = useState("");
  const [schliessConfirm, setSchliessConfirm] = useState(false);
  const [loeschConfirm, setLoeschConfirm] = useState(false);
  const [ruhenFormOffen, setRuhenFormOffen] = useState(false);
  const [ruhenBis, setRuhenBis] = useState("");
  // Versicherungsfall (A1): Formular-State — Eigenschaft, keine Kategorie.
  const vs = vorgang.versicherung || null;
  const [vsForm, setVsForm] = useState(false);
  const [vsGesellschaft, setVsGesellschaft] = useState(vs ? vs.gesellschaft || "" : "");
  const [vsSchadennr, setVsSchadennr] = useState(vs ? vs.schadennummer || "" : "");
  const [vsSb, setVsSb] = useState(vs && vs.selbstbeteiligung != null ? String(vs.selbstbeteiligung) : "");
  const [vsGemeldet, setVsGemeldet] = useState(vs ? vs.gemeldet_am || "" : "");
  const [vsNotiz, setVsNotiz] = useState(vs ? vs.notiz || "" : "");
  const speichereVersicherung = () => {
    const sb = parseFloat(String(vsSb).replace(",", "."));
    onWelt((w) => Object.assign({}, w, {
      vorgaenge: w.vorgaenge.map((v) => v.id === vorgang.id
        ? Object.assign({}, v, { versicherung: {
            gesellschaft: vsGesellschaft.trim(),
            schadennummer: vsSchadennr.trim(),
            selbstbeteiligung: isNaN(sb) ? null : sb,
            gemeldet_am: vsGemeldet || null,
            notiz: vsNotiz.trim(),
          } }) : v),
    }));
    setVsForm(false);
  };

  const farbe = ampelFarbe(vorgang, welt);
  const kat = vorgangKategorie(vorgang.kategorie);
  const hinweise = hinweiseFuerVorgang(vorgang, welt);
  const verlauf = baueVerlauf(vorgang, welt, kontakte);
  const einheiten = (ve && Array.isArray(ve.einheiten)) ? ve.einheiten : [];
  const einheit = vorgang.einheit_id
    ? (einheiten.filter((e) => e.id === vorgang.einheit_id)[0] || null) : null;
  const raum = ve && vorgang.raum_id ? findeRaum(ve, vorgang.raum_id) : null;
  const woText = (einheit
    ? (einheit.bezeichnung || einheit.nr || einheit.einheitLabel || "Einheit")
    : "Ganzes Objekt / Gemeinschaft")
    + (raum ? " · " + (raum.name || raum.bezeichnung || "Raum") : "");
  const objektText = ve ? ((ve.nr || ve.name || "") +
    (ve.adresse && ve.adresse.strasse ? " · " + ve.adresse.strasse : "")) : "";
  const kannFlows = !!onWelt && vorgang.status !== "geschlossen";
  const auftraege = welt.auftraege.filter((a) => a.vorgang_id === vorgang.id);
  const angebote = welt.angebote.filter((a) => a.vorgang_id === vorgang.id);
  const rechnungen = welt.rechnungen.filter((r) => r.vorgang_id === vorgang.id);
  const aufgabenOffen = welt.aufgaben.filter(
    (a) => a.vorgang_id === vorgang.id && a.status === "offen");
  const nachrichten = welt.nachrichten.filter((n) => n.vorgang_id === vorgang.id);
  const beteiligungen = welt.beteiligungen.filter((b) => b.vorgang_id === vorgang.id);
  const abnahmenAlle = welt.abnahmen;
  const firmen = (kontakte || []).filter((k) => k && k.typ === "firma");
  const keinsGewaehlt = angebote.filter((a) => !!a.wurde_zu_auftrag_id).length === 0;
  const auftraegeOffen = auftraege.filter((a) => a.status !== "abgenommen").length;
  const alleDurch = auftraege.length > 0 && auftraegeOffen === 0;
  const abschlussReif = kannFlows && alleDurch
    && aufgabenOffen.length === 0 && hinweise.length === 0;
  const beantwortetIds = {};
  for (let i = 0; i < nachrichten.length; i++) {
    if (nachrichten[i].antwort_auf_id) beantwortetIds[nachrichten[i].antwort_auf_id] = true;
  }
  const faedenOffen = nachrichten.filter((n) =>
    n.richtung === "ausgehend" && n.antwort_erwartet && !beantwortetIds[n.id]).length;

  // Ampel AUSGESCHRIEBEN (§5.3)
  const laufende = auftraege.filter(auftragLaeuft);
  let ampelText;
  if (vorgang.status === "geschlossen") {
    ampelText = "Geschlossen";
  } else if (hinweise.length > 0) {
    ampelText = hinweise[0].text;
  } else if (abschlussReif) {
    ampelText = "Alles erledigt";
  } else if (farbe === "gruen" && laufende.length > 0) {
    const bei = nameVon(kontakte, laufende[0].firma_kontakt_id);
    ampelText = "Läuft" + (bei ? " — Ball liegt bei " + bei : "")
      + (laufende[0].frist ? ", bis " + datumDe(laufende[0].frist) : "");
  } else {
    ampelText = AMPEL_TITEL[farbe] || "";
  }

  // ── Wachsende TabLeiste (Bennys Regel C) ──
  const tabs = [{ id: "uebersicht", label: "Übersicht", icon: "list" },
    { id: "beteiligte", label: "Beteiligte", icon: "users" },
    { id: "kommunikation", label: "Kommunikation", icon: "mail" }];
  if (angebote.length > 0 || tabZwang.angebote) {
    tabs.push({ id: "angebote", label: "Angebote", icon: "document" });
  }
  if (rechnungen.length > 0 || tabZwang.rechnungen) {
    tabs.push({ id: "rechnungen", label: "Rechnungen", icon: "document" });
  }
  if (vs || tabZwang.versicherung) {
    tabs.push({ id: "versicherung", label: "Versicherung", icon: "shield" });
  }

  // Katalog (§6.2): Kommunikation ist jetzt Tab (raus); Angebot/Rechnung
  // erzeugen ihren Tab und springen hin — Wachstum auf Tab-Ebene.
  const katalog = [
    { id: "auftraege", icon: "🛠", label: "Auftrag", sub: "An wen · was · bis wann" },
    { id: "angebote", icon: "§", label: "Angebot", sub: "Eigener Tab — anfragen oder erfassen" },
    { id: "aufgaben", icon: "✓", label: "Aufgabe", sub: "Delegieren + nachhalten" },
    { id: "rechnungen", icon: "€", label: "Rechnung", sub: "Eigener Tab — Betrag + Prüfung" },
    { id: "notiz", icon: "✎", label: "Notiz", sub: "Freier Text in die Akte" },
  ];
  if (!vs) {
    katalog.splice(4, 0, { id: "versicherung", icon: "🛡", label: "Versicherungsfall",
      sub: "Schaden über die Versicherung — eigener Strang" });
  }
  const bausteinAdd = (id) => {
    if (id === "versicherung") {
      setTabZwang(Object.assign({}, tabZwang, { versicherung: true }));
      setTab("versicherung"); setVsForm(true);
      return;
    }
    if (id === "angebote" || id === "rechnungen") {
      setTabZwang(Object.assign({}, tabZwang, { [id]: true }));
      setTab(id); setFormBaustein(id);
      return;
    }
    setOffenerBaustein(id); setFormBaustein(id);
  };
  const toggleBaustein = (id) => {
    setOffenerBaustein(offenerBaustein === id ? null : id);
    if (formBaustein && formBaustein !== id) setFormBaustein(null);
  };
  const legeAufgabeAn = () => {
    if (!aufgabeTitel.trim()) return;
    onWelt((w) => weltAufgabeNeu(w, vorgang.id, { titel: aufgabeTitel.trim() }));
    setAufgabeTitel(""); setFormBaustein(null);
  };
  const erfasseRechnung = () => {
    const betrag = parseFloat(String(rechnungBetrag).replace(",", "."));
    if (isNaN(betrag)) return;
    const abgenommene = auftraege.filter((a) => a.status === "abgenommen");
    onWelt((w) => weltRechnungNeu(w, { vorgang_id: vorgang.id,
      auftrag_id: abgenommene.length === 1 ? abgenommene[0].id
        : (auftraege.length === 1 ? auftraege[0].id : null),
      betrag: betrag }));
    setRechnungBetrag(""); setFormBaustein(null);
  };
  const speichereNotiz = () => {
    if (!notizText.trim()) return;
    onWelt((w) => weltNotizNeu(w, vorgang.id, notizText.trim()));
    setNotizText(""); setFormBaustein(null); setOffenerBaustein(null);
  };

  const standKarte = (
    <div style={{ background: t.card, border: "1px solid " + t.border,
      borderRadius: RAD.lg, padding: "12px 14px" }}>
      <PhasenLeiste vorgang={vorgang} welt={welt} t={t} accent={accent}/>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 6 }}>
        <AmpelPunkt farbe={farbe}/>
        <div style={{ flex: 1, minWidth: 0, fontSize: FS.s, fontWeight: FW.med,
          color: t.text, overflowWrap: "anywhere" }}>{ampelText}</div>
      </div>
      {abschlussReif ? (
        <button onClick={() => onWelt((w) => weltVorgangSchliessen(w, vorgang.id))}
          style={Object.assign({}, flowKnopf(t, accent, true), { marginTop: 8 })}>
          Vorgang abschließen</button>
      ) : null}
      {!abschlussReif && hinweise.length > 0 ? (
        <div style={{ marginTop: 8, padding: "8px 10px", borderRadius: RAD.md,
          background: AMPEL_FARBEN[hinweise[0].farbe] + "14",
          border: "1px solid " + AMPEL_FARBEN[hinweise[0].farbe] + "50",
          display: "flex", alignItems: "center", gap: 8 }}>
          <AmpelPunkt farbe={hinweise[0].farbe}/>
          <div style={{ flex: 1, minWidth: 0, fontSize: FS.s, fontWeight: FW.bold,
            color: t.text, overflowWrap: "anywhere" }}>
            {"Nächster Schritt: " + hinweise[0].text}</div>
          {kannFlows && hinweise[0].typ === "wiedervorlage" ? (
            <button style={flowKnopf(t, accent, true)}
              onClick={() => onWelt((w) => weltWiedervorlageAufheben(w, vorgang.id))}>
              Wieder aufnehmen</button>
          ) : null}
        </div>
      ) : null}
      {hinweise.length > 1 ? (
        <div style={{ marginTop: 6 }}>
          <button onClick={() => setMehrOffen(!mehrOffen)}
            style={{ background: "none", border: "none", padding: 0,
              cursor: "pointer", fontSize: FS.xs, fontWeight: FW.bold,
              color: t.muted, fontFamily: "inherit" }}>
            {mehrOffen ? "Weitere ausblenden"
              : "+" + (hinweise.length - 1) + " weitere offene Punkte"}
          </button>
          {mehrOffen ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 5,
              marginTop: 6 }}>
              {hinweise.slice(1).map((h, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <AmpelPunkt farbe={h.farbe}/>
                  <div style={{ fontSize: FS.s, color: t.text, minWidth: 0,
                    overflowWrap: "anywhere", flex: 1 }}>{h.text}</div>
                </div>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}
      {kannFlows && vorgang.ruht_bis && vorgang.ruht_bis > isoHeute() ? (
        <div style={{ marginTop: 8, display: "flex", alignItems: "center", gap: 8 }}>
          <AmpelPunkt farbe="grau"/>
          <div style={{ flex: 1, fontSize: FS.s, color: t.muted }}>
            {"Ruht bis " + datumDe(vorgang.ruht_bis)}</div>
          <button style={flowKnopf(t, accent, false)}
            onClick={() => onWelt((w) => weltWiedervorlageAufheben(w, vorgang.id))}>
            Aufheben</button>
        </div>
      ) : null}
      {kannFlows && vorgang.wartet_auf_beschluss_id ? (
        <div style={{ marginTop: 8, display: "flex", alignItems: "center", gap: 8 }}>
          <AmpelPunkt farbe="grau"/>
          <div style={{ flex: 1, fontSize: FS.s, color: t.muted }}>
            Wartet auf ETV-Beschluss (Tagesordnung)</div>
          <button style={flowKnopf(t, accent, false)}
            onClick={() => onWelt((w) => weltVorgangVonTagesordnung(w, vorgang.id))}>
            Herunternehmen</button>
        </div>
      ) : null}
    </div>
  );

  const datenKarte = (
    <div style={{ background: t.card, border: "1px solid " + t.border,
      borderRadius: RAD.lg, padding: "12px 14px" }}>
      <div style={blockTitelStil(t)}>Daten</div>
      <div style={{ fontSize: FS.s, color: t.text }}>
        {woText}
        <span style={{ color: t.muted }}>
          {" · " + kat.label + " · seit " + datumDe(vorgang.angelegt_am)}</span>
      </div>
      {/* Verlauf oben bei den Daten (Bennys Wahl D) */}
      <div style={{ borderTop: "1px solid " + t.border, paddingTop: 8,
        marginTop: 8, display: "flex", flexDirection: "column", gap: 5 }}>
        {verlauf.map((e, i) => (
          <div key={i} style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
            <span style={{ fontSize: FS.xs, color: t.muted, flexShrink: 0,
              whiteSpace: "nowrap" }}>{datumDe(e.datum)}</span>
            <span style={{ fontSize: FS.s, color: t.text, minWidth: 0,
              overflowWrap: "anywhere" }}>{e.text}</span>
          </div>
        ))}
      </div>
    </div>
  );

  const fussAktionen = onWelt ? (
    <div style={{ display: "flex", justifyContent: "flex-end",
      gap: 6, flexWrap: "wrap" }}>
      {/* §76: AktionsButton (variante breit) ist der kanonische Confirm-Baustein */}
      <div style={{ marginRight: "auto" }}>
        <AktionsButton rolle="loeschen" variante="breit" t={t} accent={accent}
          confirm={loeschConfirm}
          text={loeschConfirm ? "Wirklich löschen?" : "Löschen"}
          onClick={() => {
            if (!loeschConfirm) { setLoeschConfirm(true); return; }
            onWelt((w) => weltVorgangLoeschen(w, vorgang.id));
            onZurueck();
          }}/>
      </div>
      {kannFlows && !vorgang.ruht_bis && !ruhenFormOffen ? (
        <button style={flowKnopf(t, accent, false)}
          onClick={() => setRuhenFormOffen(true)}>Ruhen bis …</button>
      ) : null}
      {kannFlows && !vorgang.wartet_auf_beschluss_id ? (
        <button style={flowKnopf(t, accent, false)}
          onClick={() => onWelt((w) => weltVorgangAufTagesordnung(w, vorgang.id))}>
          Auf ETV-Tagesordnung</button>
      ) : null}
      {vorgang.status === "geschlossen" ? (
        <button style={flowKnopf(t, accent, false)}
          onClick={() => onWelt((w) => weltVorgangOeffnen(w, vorgang.id))}>
          Wieder öffnen</button>
      ) : (
        <AktionsButton rolle="loesen" variante="breit" t={t} accent={accent}
          confirm={schliessConfirm}
          text={schliessConfirm ? "Wirklich schließen?" : "Vorgang schließen"}
          onClick={() => {
            if (!schliessConfirm) { setSchliessConfirm(true); return; }
            onWelt((w) => weltVorgangSchliessen(w, vorgang.id));
            setSchliessConfirm(false);
          }}/>
      )}
    </div>
  ) : null;

  return (
    <div style={{ background: t.card, border: "1px solid " + accent,
      borderRadius: RAD.lg, minWidth: 0, boxSizing: "border-box", width: "100%",
      display: "flex", flexDirection: "column" }}>
      {/* ── Kopf (Objekt-Vorbild): Nummer groß · Titel + Liegenschaft klein ── */}
      <div style={{ padding: "12px 14px", borderBottom: "1px solid " + t.border }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          {onZurueck && zurueckKnopf ? <HeaderZurueck onClick={onZurueck} t={t}/> : null}
          <AmpelPunkt farbe={farbe}/>
          <div style={{ fontSize: FS.xxl, fontWeight: FW.bold, color: t.text,
            letterSpacing: 0.5 }}>{vorgang.nummer || "Vorgang"}</div>
          <div style={{ flex: 1, minWidth: 0, fontSize: FS.s, color: t.muted,
            overflowWrap: "anywhere" }}>
            {(vorgang.titel || "Vorgang") + (objektText ? " · " + objektText : "")}
          </div>
          {vs ? <StatusPille t={t} farbe="#0EA5E9" text="Versicherungsfall"/> : null}
          <StatusPille t={t} farbe={accent}
            text={VORGANG_STATUS_LABEL[vorgang.status] || vorgang.status}/>
        </div>
        <div style={{ marginTop: 10 }}>
          <TabLeiste tabs={tabs} aktiv={tab} onWaehle={setTab} t={t} accent={accent}/>
        </div>
      </div>

      <div style={{ padding: "12px 14px", display: "flex",
        flexDirection: "column", gap: 10 }}>
        {tab === "uebersicht" ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {standKarte}
            {datenKarte}
            {(auftraege.length > 0 || formBaustein === "auftraege") ? (
              <BausteinKarte titel="Aufträge" anzahl={auftraege.length} t={t} accent={accent}
                sub={auftraege.length === 0 ? null
                  : (auftraegeOffen > 0 ? auftraegeOffen + " offen" : "alle fertig")}
                offen={offenerBaustein === "auftraege"}
                onToggle={() => toggleBaustein("auftraege")}>
                {auftraege.map((a) => (
                  <AuftragFlowZeile key={a.id} auftrag={a}
                    kategorieId={vorgang.kategorie} firmen={firmen}
                    kontakteObjekt={kontakteObjekt}
                    abnahmen={abnahmenAlle.filter((ab) => ab.auftrag_id === a.id)}
                    kontakte={kontakte} t={t} accent={accent}
                    onWelt={onWelt} DatumFeld={DatumFeld}
                    ve={ve} onFotoHinzu={onFotoHinzu}/>
                ))}
                {kannFlows && formBaustein === "auftraege" ? (
                  <AuftragNeuForm vorgangId={vorgang.id} kategorieId={vorgang.kategorie}
                    firmen={firmen} kontakteObjekt={kontakteObjekt} t={t}
                    accent={accent} onWelt={onWelt} DatumFeld={DatumFeld}
                    onFertig={() => setFormBaustein(null)}/>
                ) : (kannFlows ? (
                  <button onClick={() => setFormBaustein("auftraege")}
                    style={flowKnopf(t, accent, false)}>+ Auftrag</button>
                ) : null)}
              </BausteinKarte>
            ) : null}
            {(aufgabenOffen.length > 0 || formBaustein === "aufgaben") ? (
              <BausteinKarte titel="Aufgaben" anzahl={aufgabenOffen.length} t={t} accent={accent}
                offen={offenerBaustein === "aufgaben"}
                onToggle={() => toggleBaustein("aufgaben")}>
                {aufgabenOffen.map((a) => (
                  <AufgabeFlowZeile key={a.id} aufgabe={a} t={t} accent={accent} onWelt={onWelt}/>
                ))}
                {kannFlows && formBaustein === "aufgaben" ? (
                  <div style={flowZeileStil(t)}>
                    <input value={aufgabeTitel}
                      onChange={(e) => setAufgabeTitel(e.target.value)}
                      placeholder="Was ist zu tun?"
                      style={Object.assign({}, selectStil(t, accent, !!aufgabeTitel), { marginBottom: 0 })}/>
                    <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
                      <button onClick={() => setFormBaustein(null)}
                        style={flowKnopf(t, accent, false)}>Abbrechen</button>
                      <button onClick={legeAufgabeAn}
                        style={flowKnopf(t, accent, true)}>Anlegen</button>
                    </div>
                  </div>
                ) : (kannFlows ? (
                  <button onClick={() => setFormBaustein("aufgaben")}
                    style={flowKnopf(t, accent, false)}>+ Aufgabe</button>
                ) : null)}
              </BausteinKarte>
            ) : null}
            {formBaustein === "notiz" ? (
              <BausteinKarte titel="Notiz" t={t} accent={accent}
                offen={true} onToggle={() => { setFormBaustein(null); setOffenerBaustein(null); }}>
                <div style={flowZeileStil(t)}>
                  <textarea value={notizText}
                    onChange={(e) => setNotizText(e.target.value)} rows={2}
                    placeholder="Notiz in die Akte …"
                    style={Object.assign({}, selectStil(t, accent, !!notizText),
                      { resize: "vertical", minHeight: 44, marginBottom: 0 })}/>
                  <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
                    <button onClick={() => { setFormBaustein(null); setNotizText(""); }}
                      style={flowKnopf(t, accent, false)}>Abbrechen</button>
                    <button onClick={speichereNotiz}
                      style={flowKnopf(t, accent, true)}>Speichern</button>
                  </div>
                </div>
              </BausteinKarte>
            ) : null}
            {kannFlows ? (
              <NeueKarteMenu t={t} accent={accent} onAdd={bausteinAdd} optionen={katalog}/>
            ) : null}
            {kannFlows && ruhenFormOffen ? (
              <div style={flowZeileStil(t)}>
                {DatumFeld ? (
                  <DatumFeld t={t} accent={accent} label="Ruhen bis"
                    value={ruhenBis} onChange={setRuhenBis} iso defaultHeute={false}/>
                ) : null}
                <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
                  <button onClick={() => { setRuhenFormOffen(false); setRuhenBis(""); }}
                    style={flowKnopf(t, accent, false)}>Abbrechen</button>
                  <button onClick={() => {
                      if (!ruhenBis) return;
                      onWelt((w) => weltVorgangRuhen(w, vorgang.id, ruhenBis));
                      setRuhenBis(""); setRuhenFormOffen(false);
                    }} style={flowKnopf(t, accent, true)}>Ruhen lassen</button>
                </div>
              </div>
            ) : null}
            {fussAktionen}
          </div>
        ) : null}

        {tab === "beteiligte" ? (
          <BeteiligtenBlock vorgang={vorgang} beteiligungen={beteiligungen}
            kontakte={kontakte} kontakteObjekt={kontakteObjekt} ve={ve}
            t={t} accent={accent} kannFlows={kannFlows}
            onWelt={onWelt}
            onInformieren={(kid) => {
              setInformierenKontakt(kid);
              setTab("kommunikation");
              setFormBaustein("kommunikation");
            }}/>
        ) : null}

        {tab === "kommunikation" ? (
          <KommunikationsBlock vorgang={vorgang} nachrichten={nachrichten}
            kontakte={kontakte} kontakteObjekt={kontakteObjekt}
            t={t} accent={accent} kannFlows={kannFlows}
            onWelt={onWelt} formAuto={formBaustein === "kommunikation"}
            vorKontaktId={informierenKontakt}
            vorAnlass={informierenKontakt ? "betroffenheit" : null}
            onFormZu={(auf) => {
              setFormBaustein(auf ? "kommunikation" : null);
              if (!auf) setInformierenKontakt(null);
            }}/>
        ) : null}

        {tab === "angebote" ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {angebote.length > 0 ? (
              <div style={{ fontSize: FS.xs, color: t.muted }}>
                {keinsGewaehlt ? "Noch keins gewählt — nicht gewählte bleiben stehen (Nachweis)."
                  : "Ein Angebot wurde beauftragt."}</div>
            ) : null}
            {angebote.map((a) => (
              <AngebotFlowZeile key={a.id} angebot={a} kontakte={kontakte}
                keinsGewaehlt={keinsGewaehlt} t={t} accent={accent} onWelt={onWelt}/>
            ))}
            {kannFlows && formBaustein === "angebote" ? (
              <AngebotNeuForm vorgangId={vorgang.id} firmen={firmen}
                kontakteObjekt={kontakteObjekt} t={t}
                accent={accent} onWelt={onWelt}
                onFertig={() => setFormBaustein(null)}/>
            ) : (kannFlows && keinsGewaehlt ? (
              <button onClick={() => setFormBaustein("angebote")}
                style={flowKnopf(t, accent, false)}>+ Angebot</button>
            ) : null)}
          </div>
        ) : null}

        {tab === "versicherung" ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {vs && !vsForm ? (
              <div style={flowZeileStil(t)}>
                <div style={{ fontSize: FS.s, color: t.text, display: "flex",
                  flexDirection: "column", gap: 4 }}>
                  <div>{"Gesellschaft: " + (vs.gesellschaft || "—")}</div>
                  <div>{"Schadennummer: " + (vs.schadennummer || "—")}</div>
                  <div>{"Selbstbeteiligung: "
                    + (vs.selbstbeteiligung != null ? eur(vs.selbstbeteiligung) : "—")}</div>
                  <div style={{ color: vs.gemeldet_am ? t.text : AMPEL_FARBEN.gelb,
                    fontWeight: vs.gemeldet_am ? FW.reg : FW.bold }}>
                    {vs.gemeldet_am
                      ? "Schaden gemeldet am " + datumDe(vs.gemeldet_am)
                      : "Schadenmeldung noch offen"}</div>
                  {vs.notiz ? <div style={{ color: t.muted }}>{vs.notiz}</div> : null}
                </div>
                {kannFlows ? (
                  <div style={{ display: "flex", gap: 6, justifyContent: "flex-end",
                    flexWrap: "wrap" }}>
                    {!vs.gemeldet_am ? (
                      <button onClick={() => {
                          onWelt((w) => Object.assign({}, w, {
                            vorgaenge: w.vorgaenge.map((v) => v.id === vorgang.id
                              ? Object.assign({}, v, { versicherung:
                                  Object.assign({}, v.versicherung, { gemeldet_am: isoHeute() }) })
                              : v),
                          }));
                          setVsGemeldet(isoHeute());
                        }} style={flowKnopf(t, accent, true)}>Heute gemeldet</button>
                    ) : null}
                    <button onClick={() => setVsForm(true)}
                      style={flowKnopf(t, accent, false)}>Bearbeiten</button>
                  </div>
                ) : null}
              </div>
            ) : null}
            {kannFlows && (vsForm || !vs) ? (
              <div style={flowZeileStil(t)}>
                <label style={feldLabelStil(t)}>Gesellschaft</label>
                <input value={vsGesellschaft} onChange={(e) => setVsGesellschaft(e.target.value)}
                  placeholder="z. B. Allianz Gebäudeversicherung"
                  style={Object.assign({}, selectStil(t, accent, !!vsGesellschaft), { marginBottom: 0 })}/>
                <label style={feldLabelStil(t)}>Schadennummer</label>
                <input value={vsSchadennr} onChange={(e) => setVsSchadennr(e.target.value)}
                  placeholder="sobald vergeben"
                  style={Object.assign({}, selectStil(t, accent, !!vsSchadennr), { marginBottom: 0 })}/>
                <label style={feldLabelStil(t)}>Selbstbeteiligung (€)</label>
                <input value={vsSb} inputMode="decimal"
                  onChange={(e) => setVsSb(e.target.value)} placeholder="optional"
                  style={Object.assign({}, selectStil(t, accent, !!vsSb), { marginBottom: 0 })}/>
                {DatumFeld ? (
                  <DatumFeld t={t} accent={accent} label="Schaden gemeldet am (leer = noch offen)"
                    value={vsGemeldet} onChange={setVsGemeldet} iso defaultHeute={false}/>
                ) : null}
                <label style={feldLabelStil(t)}>Notiz</label>
                <input value={vsNotiz} onChange={(e) => setVsNotiz(e.target.value)}
                  placeholder="z. B. Gutachter angekündigt"
                  style={Object.assign({}, selectStil(t, accent, !!vsNotiz), { marginBottom: 0 })}/>
                <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
                  {vs ? (
                    <button onClick={() => setVsForm(false)}
                      style={flowKnopf(t, accent, false)}>Abbrechen</button>
                  ) : null}
                  <button onClick={speichereVersicherung}
                    style={flowKnopf(t, accent, true)}>Festhalten</button>
                </div>
              </div>
            ) : null}
          </div>
        ) : null}

        {tab === "rechnungen" ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {rechnungen.map((r) => (
              <RechnungFlowZeile key={r.id} rechnung={r} welt={welt}
                vorgangId={vorgang.id} t={t} accent={accent} onWelt={onWelt}/>
            ))}
            {kannFlows && formBaustein === "rechnungen" ? (
              <div style={flowZeileStil(t)}>
                <label style={feldLabelStil(t)}>Betrag (€)</label>
                <input value={rechnungBetrag} inputMode="decimal"
                  onChange={(e) => setRechnungBetrag(e.target.value)}
                  placeholder="z. B. 480"
                  style={Object.assign({}, selectStil(t, accent, !!rechnungBetrag), { marginBottom: 0 })}/>
                <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
                  <button onClick={() => setFormBaustein(null)}
                    style={flowKnopf(t, accent, false)}>Abbrechen</button>
                  <button onClick={erfasseRechnung}
                    style={flowKnopf(t, accent, true)}>Erfassen</button>
                </div>
              </div>
            ) : (kannFlows ? (
              <button onClick={() => setFormBaustein("rechnungen")}
                style={flowKnopf(t, accent, false)}>+ Rechnung</button>
            ) : null)}
          </div>
        ) : null}
      </div>
    </div>
  );
}

// ── LoseAuftragKarte ─────────────────────────────────────────────────────────
// Vorgangsloser Auftrag (Begehungsfund): dieselbe Zeilen-Optik, ohne Klapp
// (es gibt noch keinen Verlauf — nur der festgehaltene Fund).
function LoseAuftragKarte({ auftrag, t, kontakte = [], accent = "#888", onWelt = null, DatumFeld = null,
  auswahlModus = false, ausgewaehlt = false, onAuswahl = null, ve = null, onFotoHinzu = null }) {
  const [loeschConfirm, setLoeschConfirm] = useState(false);
  // Nachbearbeitung (Begehung 18.07.): Punkt VOR dem Vorgang vervollständigen —
  // Beschreibung, Wo genau, Notizen, Gemeldet von. Stift im Kartenkopf (§12.9).
  const [edit, setEdit] = useState(false);
  const [eBeschreibung, setEBeschreibung] = useState("");
  const [eOrt, setEOrt] = useState("");
  const [eNotiz, setENotiz] = useState("");
  const [eGemeldet, setEGemeldet] = useState("");
  const farbe = ampelFarbeAuftrag(auftrag);
  const firmen = (kontakte || []).filter((k) => k && k.typ === "firma");
  const gemeldetKontakt = auftrag.gemeldet_von_id
    ? (kontakte || []).find((k) => k && k.id === auftrag.gemeldet_von_id) : null;
  const editStart = () => {
    setEBeschreibung(auftrag.beschreibung || "");
    setEOrt(auftrag.ort || ""); setENotiz(auftrag.notiz || "");
    setEGemeldet(auftrag.gemeldet_von_id || "");
    setEdit(true);
  };
  const editSpeichern = () => {
    if (!onWelt) { setEdit(false); return; }
    onWelt((w) => Object.assign({}, w, {
      auftraege: w.auftraege.map((a) => a.id === auftrag.id
        ? Object.assign({}, a, { beschreibung: eBeschreibung.trim() || a.beschreibung,
            ort: eOrt.trim(), notiz: eNotiz.trim(),
            gemeldet_von_id: eGemeldet || null })
        : a),
    }));
    setEdit(false);
  };
  const infoTeile = [];
  if (auftrag.erfasst_am) infoTeile.push("erfasst " + datumDe(auftrag.erfasst_am));
  if (auftrag.ort) infoTeile.push("📍 " + auftrag.ort);
  if (gemeldetKontakt) infoTeile.push("gemeldet von " + (gemeldetKontakt.name || "Kontakt"));
  return (
    <div onClick={auswahlModus && onAuswahl ? onAuswahl : undefined}
      style={{ background: ausgewaehlt ? accent + "12" : t.card,
      border: "1px solid " + (ausgewaehlt ? accent : t.border),
      borderRadius: RAD.lg, padding: "12px 14px", minWidth: 0,
      cursor: auswahlModus ? "pointer" : "default",
      boxSizing: "border-box", width: "100%" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <AmpelPunkt farbe={farbe}/>
        <div style={{ flex: 1, minWidth: 0, fontSize: FS.l, fontWeight: FW.bold,
          color: t.text, overflowWrap: "anywhere" }}>{auftrag.beschreibung || "Auftrag"}</div>
        <StatusPille t={t} farbe={AMPEL_FARBEN[farbe]}
          text={AUFTRAG_STATUS_LABEL[auftrag.status] || auftrag.status}/>
        {onWelt && !auswahlModus && !edit ? (
          <button onClick={(e) => { if (e && e.stopPropagation) e.stopPropagation(); editStart(); }}
            title="Punkt bearbeiten" aria-label="Punkt bearbeiten"
            style={{ display: "flex", alignItems: "center", justifyContent: "center",
              width: 30, height: 30, flexShrink: 0, background: accent, border: "none",
              borderRadius: RAD.pill, cursor: "pointer" }}>
            <I name="pencil" size={13} color={getContrastColor(accent)}/>
          </button>
        ) : null}
      </div>
      {!edit ? (
        <div>
          {infoTeile.length > 0 ? (
            <div style={{ fontSize: FS.s, color: t.muted, marginTop: 4 }}>
              {infoTeile.join(" · ")}
            </div>
          ) : null}
          {auftrag.notiz ? (
            <div style={{ fontSize: FS.s, color: t.sub, marginTop: 4,
              whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>{auftrag.notiz}</div>
          ) : null}
        </div>
      ) : (
        <div style={{ marginTop: 8 }} onClick={(e) => e.stopPropagation()}>
          <Inp t={t} accent={accent} label="Was ist Sache?" required
            value={eBeschreibung} onChange={setEBeschreibung}/>
          <Inp t={t} accent={accent} label="Wo genau? (optional)"
            value={eOrt} onChange={setEOrt}
            placeholder="z. B. Treppenhaus 2. OG"/>
          <label style={feldLabelStil(t)}>Notizen (optional)</label>
          <textarea value={eNotiz} onChange={(e) => setENotiz(e.target.value)}
            rows={2} style={Object.assign({}, selectStil(t, accent, !!eNotiz),
              { resize: "vertical", minHeight: 48 })}/>
          <KontaktPickerMitAllen value={eGemeldet || null}
            onChange={(id) => setEGemeldet(id || "")}
            label="Gemeldet von (leer = ich / die Verwaltung)" t={t} accent={accent}
            kontakteObjekt={null}
            kontakteAlle={pickerListe(kontakte)}/>
          <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
            <button onClick={() => setEdit(false)} style={flowKnopf(t, accent, false)}>Abbrechen</button>
            <button onClick={editSpeichern} style={flowKnopf(t, accent, true)}>Speichern</button>
          </div>
        </div>
      )}
      {!auswahlModus && !edit ? (
        <div style={{ marginTop: 6, marginBottom: onWelt ? 6 : 0 }}>
          <AuftragFotoLeiste auftrag={auftrag} ve={ve} t={t} accent={accent}
            onFotoHinzu={onFotoHinzu}/>
        </div>
      ) : null}
      {/* Buttons rechts ausgerichtet unten in EINER Reihe (Benny 18.07.). */}
      {onWelt && !auswahlModus && !edit ? (
        <div style={{ display: "flex", alignItems: "center", gap: 6,
          justifyContent: "flex-end", flexWrap: "wrap" }}>
          <AuftragFlowAktionen auftrag={auftrag} brauchtAbnahme={false}
            firmen={firmen} t={t} accent={accent}
            onWelt={onWelt} DatumFeld={DatumFeld}/>
          <AktionsButton rolle="loeschen" variante="breit" t={t} accent={accent}
            confirm={loeschConfirm}
            text={loeschConfirm ? "Wirklich löschen?" : "Löschen"}
            onClick={(e) => {
              if (e && e.stopPropagation) e.stopPropagation();
              if (!loeschConfirm) { setLoeschConfirm(true); return; }
              onWelt((w) => weltAuftragLoeschen(w, auftrag.id));
            }}/>
        </div>
      ) : null}
    </div>
  );
}

// ── Sortierung: dringlichste zuerst, innerhalb neueste zuerst ────────────────
const AMPEL_SORT = { rot: 5, gelb: 4, blau: 3, gruen: 2, grau: 1 };
function sortiereVorgaenge(liste, welt) {
  return liste.slice().sort((a, b) => {
    const ra = AMPEL_SORT[ampelFarbe(a, welt)] || 0;
    const rb = AMPEL_SORT[ampelFarbe(b, welt)] || 0;
    if (rb !== ra) return rb - ra;
    return String(b.angelegt_am || "").localeCompare(String(a.angelegt_am || ""));
  });
}

const leerText = (t, text) => (
  <div style={{ fontSize: FS.m, color: t.muted, fontStyle: "italic",
    padding: "8px 2px" }}>{text}</div>
);

// ── Detail-Inhalt Achse OBJEKT ───────────────────────────────────────────────
// Vorgänge des Objekts (Rang-sortiert) + darunter die „Erfasst"-Ecke: vorgangs-
// lose Aufträge (Begehungsfunde) dieses Objekts. Klapp-State lebt hier; der
// Aufrufer instanziiert per key={veId} neu (React-Key-Lehre: kein Recycling
// über Objekt-Wechsel hinweg).
function VorgangsBereichFuerObjekt({ veId, welt, kontakte, t, accent, initialOffeneId = null, onWelt = null, DatumFeld = null, ve = null, onFotoHinzu = null, offeneIdCtrl = null, onOeffneId = null }) {
  // GESTEUERTER Modus (Feinschliff 11.07., Skizze Spalten 2/3): der Screen
  // (allesda_merged) hält die Akten-Auswahl und baut das Master-Detail
  // selbst — dieser Bereich ist dann NUR die Liste (Spalte 2). Ungesteuert
  // (Tests/Fallback) bleibt das interne Verhalten.
  const gesteuert = typeof onOeffneId === "function";
  const [offeneIdIntern, setOffeneIdIntern] = useState(initialOffeneId);
  const offeneId = gesteuert ? offeneIdCtrl : offeneIdIntern;
  const setOffeneId = gesteuert ? onOeffneId : setOffeneIdIntern;
  const istDesktop = useWindowWidth() >= DESKTOP_MIN_WIDTH;
  // Kategorie-Tabs (Benny 09.07.): Alle | Wartung | Pflege | Instandhaltung |
  // Instandsetzung | Sanierung — Filter auf die Vorgänge des Objekts.
  const [katTab, setKatTab] = useState("alle");
  const [buendelModus, setBuendelModus] = useState(false);
  const [buendelIds, setBuendelIds] = useState([]);
  const [buendelZiel, setBuendelZiel] = useState(null); // null | "neu" | "bestehend"
  const [buendelTitel, setBuendelTitel] = useState("");
  const [buendelKategorie, setBuendelKategorie] = useState("bewirtschaftung");
  const [buendelVorgangId, setBuendelVorgangId] = useState("");
  const [buendelFirmaId, setBuendelFirmaId] = useState("");   // Direkt beauftragen (18.07.)
  const alleVorgaenge = sortiereVorgaenge(
    welt.vorgaenge.filter((v) => v.objekt_id === veId), welt);
  const vorgaenge = katTab === "alle" ? alleVorgaenge
    : alleVorgaenge.filter((v) => vorgangKategorie(v.kategorie).id === katTab);
  const offenerVorgang = offeneId
    ? (alleVorgaenge.filter((v) => v.id === offeneId)[0] || null) : null;
  const lose = welt.auftraege.filter(
    (a) => !a.vorgang_id && a.objekt_id === veId && a.status !== "abgenommen");
  const offeneVorgaenge = alleVorgaenge.filter((v) => v.status !== "geschlossen");
  if (alleVorgaenge.length === 0 && lose.length === 0) {
    return leerText(t, "Keine Vorgänge.");
  }
  const katOptionen = [{ id: "alle", label: "Alle", icon: "list" }].concat(
    VORGANG_KATEGORIEN.map((k) => ({ id: k.id, label: k.kurz || k.label, icon: k.icon })));
  const buendelReset = () => {
    setBuendelModus(false); setBuendelIds([]); setBuendelZiel(null);
    setBuendelTitel(""); setBuendelVorgangId(""); setBuendelFirmaId("");
  };
  const buendle = () => {
    if (buendelIds.length === 0 || !onWelt) return;
    // Direkt beauftragen (18.07.): Firma gewählt → gebündelte Punkte sofort
    // beauftragt (status, Datum, Firma) — z. B. drei Punkte an den Hausmeister.
    const beauftragen = buendelFirmaId ? { firma_kontakt_id: buendelFirmaId } : null;
    if (buendelZiel === "neu") {
      if (!buendelTitel.trim()) return;
      onWelt((w) => weltAuftraegeBuendeln(w, buendelIds,
        { neu: { titel: buendelTitel.trim(), kategorie: buendelKategorie, objekt_id: veId },
          beauftragen }));
    } else {
      if (!buendelVorgangId) return;
      onWelt((w) => weltAuftraegeBuendeln(w, buendelIds,
        { vorgang_id: buendelVorgangId, beauftragen }));
    }
    buendelReset();
  };
  const liste = (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {alleVorgaenge.length > 0 ? (
        <TabLeiste tabs={katOptionen} aktiv={katTab} onWaehle={setKatTab} t={t} accent={accent}/>
      ) : null}
      {vorgaenge.length === 0 && alleVorgaenge.length > 0 ? (
        leerText(t, "Keine Vorgänge in dieser Kategorie.")
      ) : null}
      {vorgaenge.map((v) => (
        <VorgangKarte key={v.id} vorgang={v} welt={welt} kontakte={kontakte}
          t={t} accent={accent} offen={offeneId === v.id}
          onWelt={onWelt} DatumFeld={DatumFeld}
          ve={ve} onFotoHinzu={onFotoHinzu}
          onToggle={() => setOffeneId(offeneId === v.id ? null : v.id)}/>
      ))}
      {lose.length > 0 ? (
        <div style={{ margin: "6px 2px 0 2px" }}>
          <div style={{ fontSize: FS.xs, fontWeight: FW.bold, color: t.muted,
            textTransform: "uppercase", letterSpacing: 0.5 }}>
            Erfasst — noch keinem Vorgang zugeordnet</div>
          {/* Bündeln präsent UNTER der Überschrift (Benny 18.07.), nicht mehr
              als kleiner Knopf an der Seite. */}
          {onWelt && lose.length > 1 && !buendelModus ? (
            <div style={{ marginTop: 6 }}>
              <AktionsButton rolle="bestaetigen" variante="breit" t={t} accent={accent}
                onClick={() => setBuendelModus(true)}
                text={"Punkte bündeln / beauftragen (" + lose.length + ")"}/>
            </div>
          ) : null}
        </div>
      ) : null}
      {buendelModus ? (
        <div style={{ fontSize: FS.s, color: t.muted, margin: "0 2px" }}>
          Funde antippen, die zusammengehören.
        </div>
      ) : null}
      {lose.map((a) => (
        <LoseAuftragKarte key={a.id} auftrag={a} t={t} kontakte={kontakte}
          accent={accent} onWelt={onWelt} DatumFeld={DatumFeld}
          ve={ve} onFotoHinzu={onFotoHinzu}
          auswahlModus={buendelModus}
          ausgewaehlt={buendelIds.indexOf(a.id) >= 0}
          onAuswahl={() => setBuendelIds(buendelIds.indexOf(a.id) >= 0
            ? buendelIds.filter((x) => x !== a.id) : [...buendelIds, a.id])}/>
      ))}
      {buendelModus ? (
        <div style={flowZeileStil(t)}>
          <div style={{ fontSize: FS.s, fontWeight: FW.bold, color: t.text }}>
            {buendelIds.length === 0 ? "Nichts ausgewählt"
              : buendelIds.length === 1 ? "1 Fund ausgewählt"
              : buendelIds.length + " Funde ausgewählt"}
          </div>
          {buendelZiel === null ? (
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              <button onClick={buendelReset} style={flowKnopf(t, accent, false)}>Abbrechen</button>
              <button onClick={() => setBuendelZiel("neu")}
                disabled={buendelIds.length === 0}
                style={Object.assign({}, flowKnopf(t, accent, true),
                  buendelIds.length === 0 ? { opacity: 0.5 } : {})}>Neuer Vorgang</button>
              {offeneVorgaenge.length > 0 ? (
                <button onClick={() => setBuendelZiel("bestehend")}
                  disabled={buendelIds.length === 0}
                  style={Object.assign({}, flowKnopf(t, accent, false),
                    buendelIds.length === 0 ? { opacity: 0.5 } : {})}>Zu bestehendem Vorgang</button>
              ) : null}
            </div>
          ) : null}
          {buendelZiel === "neu" ? (
            <div>
              <input value={buendelTitel}
                onChange={(e) => setBuendelTitel(e.target.value)}
                placeholder={"z. B. Hausmeister-Rundgang"}
                style={selectStil(t, accent, !!buendelTitel)}/>
              <label style={feldLabelStil(t)}>Kategorie</label>
              <select value={buendelKategorie}
                onChange={(e) => setBuendelKategorie(e.target.value)}
                style={selectStil(t, accent, true)}>
                {VORGANG_KATEGORIEN.map((k) => (
                  <option key={k.id} value={k.id}>{k.label}</option>
                ))}
              </select>
              {/* Direkt beauftragen (Benny 18.07.): Firma wählen → die
                  gebündelten Punkte gehen SOFORT beauftragt raus (z. B. drei
                  Punkte an den Hausmeister). Ohne Firma: nur bündeln. */}
              <label style={feldLabelStil(t)}>Direkt beauftragen an (optional)</label>
              <select value={buendelFirmaId}
                onChange={(e) => setBuendelFirmaId(e.target.value)}
                style={selectStil(t, accent, !!buendelFirmaId)}>
                <option value="">— nur bündeln, noch nicht beauftragen —</option>
                {(kontakte || []).filter((k) => k && k.typ === "firma").map((k) => (
                  <option key={k.id} value={k.id}>{k.name || "Firma"}</option>
                ))}
              </select>
              <div style={{ display: "flex", gap: 6, justifyContent: "flex-end", flexWrap: "wrap" }}>
                <button onClick={() => setBuendelZiel(null)} style={flowKnopf(t, accent, false)}>Zurück</button>
                <button onClick={buendle} style={flowKnopf(t, accent, true)}>
                  {buendelFirmaId ? "Bündeln + beauftragen" : "Bündeln"}</button>
              </div>
            </div>
          ) : null}
          {buendelZiel === "bestehend" ? (
            <div>
              <select value={buendelVorgangId}
                onChange={(e) => setBuendelVorgangId(e.target.value)}
                style={selectStil(t, accent, !!buendelVorgangId)}>
                <option value="">— Vorgang wählen —</option>
                {offeneVorgaenge.map((v) => (
                  <option key={v.id} value={v.id}>{v.titel || "Vorgang"}</option>
                ))}
              </select>
              <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
                <button onClick={() => setBuendelZiel(null)} style={flowKnopf(t, accent, false)}>Zurück</button>
                <button onClick={buendle} style={flowKnopf(t, accent, true)}>Zuordnen</button>
              </div>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );

  // ── Akten-Navigation (Feinschliff 11.07.): Klick auf einen Vorgang öffnet
  // das Detail-Fenster. Desktop: Liste rückt als schmale Spalte nach links,
  // Detail rechts (Master-Detail-Kaskade). Mobil: Detail ersetzt die Liste,
  // Zurück-Knopf im Akten-Kopf (§74.2-Verhalten).
  const detail = offenerVorgang ? (
    <VorgangDetail vorgang={offenerVorgang} welt={welt} kontakte={kontakte}
      t={t} accent={accent} onZurueck={() => setOffeneId(null)}
      onWelt={onWelt} DatumFeld={DatumFeld} ve={ve} onFotoHinzu={onFotoHinzu}/>
  ) : null;
  if (gesteuert) return liste;
  if (offenerVorgang && !istDesktop) return detail;
  if (offenerVorgang) {
    return (
      <div style={{ display: "flex", gap: 10, alignItems: "flex-start", minWidth: 0 }}>
        <div style={{ width: 340, flexShrink: 0, minWidth: 0 }}>{liste}</div>
        <div style={{ flex: 1, minWidth: 0 }}>{detail}</div>
      </div>
    );
  }
  return liste;
}

// ── Detail-Inhalt Achse FIRMA ────────────────────────────────────────────────
// Alle Vorgänge, an denen die Firma über einen Auftrag ODER ein Angebot hängt
// — die Auftragshistorie einer Firma über alle Objekte hinweg.
function VorgangsBereichFuerFirma({ firmaId, welt, kontakte, t, accent, onWelt = null, DatumFeld = null, offeneIdCtrl = null, onOeffneId = null }) {
  const gesteuert = typeof onOeffneId === "function";
  const [offeneIdIntern, setOffeneIdIntern] = useState(null);
  const offeneId = gesteuert ? offeneIdCtrl : offeneIdIntern;
  const setOffeneId = gesteuert ? onOeffneId : setOffeneIdIntern;
  const istDesktop = useWindowWidth() >= DESKTOP_MIN_WIDTH;
  const idsAuftrag = welt.auftraege
    .filter((a) => a.firma_kontakt_id === firmaId && a.vorgang_id)
    .map((a) => a.vorgang_id);
  const idsAngebot = welt.angebote
    .filter((a) => a.firma_kontakt_id === firmaId && a.vorgang_id)
    .map((a) => a.vorgang_id);
  // §2 (Umbau): beidseitige Verknüpfung — auch über Beteiligungen (fällt frei
  // heraus, weil flach mit kontakt_id). Beendete zählen mit: bleibt auffindbar.
  const idsBeteiligung = welt.beteiligungen
    .filter((b) => b.kontakt_id === firmaId && b.vorgang_id)
    .map((b) => b.vorgang_id);
  const ids = {};
  idsAuftrag.concat(idsAngebot).concat(idsBeteiligung).forEach((id) => { ids[id] = true; });
  const vorgaenge = sortiereVorgaenge(
    welt.vorgaenge.filter((v) => ids[v.id]), welt);
  const offenerVorgang = offeneId
    ? (vorgaenge.filter((v) => v.id === offeneId)[0] || null) : null;
  const lose = welt.auftraege.filter(
    (a) => !a.vorgang_id && a.firma_kontakt_id === firmaId
      && a.status !== "abgenommen");
  if (vorgaenge.length === 0 && lose.length === 0) {
    return leerText(t, "Keine Vorgänge mit dieser Firma.");
  }
  const liste = (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {vorgaenge.map((v) => (
        <VorgangKarte key={v.id} vorgang={v} welt={welt} kontakte={kontakte}
          t={t} accent={accent} offen={offeneId === v.id}
          onWelt={onWelt} DatumFeld={DatumFeld}
          onToggle={() => setOffeneId(offeneId === v.id ? null : v.id)}/>
      ))}
      {lose.map((a) => (
        <LoseAuftragKarte key={a.id} auftrag={a} t={t} kontakte={kontakte}
          accent={accent} onWelt={onWelt} DatumFeld={DatumFeld}/>
      ))}
    </div>
  );

  // ── Akten-Navigation (Feinschliff 11.07.): Klick auf einen Vorgang öffnet
  // das Detail-Fenster. Desktop: Liste rückt als schmale Spalte nach links,
  // Detail rechts (Master-Detail-Kaskade). Mobil: Detail ersetzt die Liste,
  // Zurück-Knopf im Akten-Kopf (§74.2-Verhalten).
  const detail = offenerVorgang ? (
    <VorgangDetail vorgang={offenerVorgang} welt={welt} kontakte={kontakte}
      t={t} accent={accent} onZurueck={() => setOffeneId(null)}
      onWelt={onWelt} DatumFeld={DatumFeld} ve={null} onFotoHinzu={null}/>
  ) : null;
  if (gesteuert) return liste;
  if (offenerVorgang && !istDesktop) return detail;
  if (offenerVorgang) {
    return (
      <div style={{ display: "flex", gap: 10, alignItems: "flex-start", minWidth: 0 }}>
        <div style={{ width: 340, flexShrink: 0, minWidth: 0 }}>{liste}</div>
        <div style={{ flex: 1, minWidth: 0 }}>{detail}</div>
      </div>
    );
  }
  return liste;
}

// Anzahl „lebender" Fälle eines Objekts (nicht geschlossene Vorgänge + lose
// nicht abgenommene Aufträge) — für das masterBadge der Objektliste (§94.2).
function vorgangAnzahlFuerObjekt(veId, welt) {
  if (!welt) return 0;
  const v = welt.vorgaenge.filter(
    (x) => x.objekt_id === veId && x.status !== "geschlossen").length;
  const a = welt.auftraege.filter(
    (x) => !x.vorgang_id && x.objekt_id === veId && x.status !== "abgenommen").length;
  return v + a;
}

// ── Schreibtisch (§96.8 / Spec §8): „Was liegt an?" ─────────────────────────
// Objektübergreifende Handlungsliste — jede Zeile ein Handlungspunkt aus
// schreibtischEintraege() (errechnet, selbstheilend). Gegenkraft zur Ampel-
// Verdichtung: hier verschwindet keine gelbe Aufgabe hinter einem roten
// Vorgang. Sortierung als SegmentControl (Optionen im Inhalt, kein
// Sicht-Wechsel — Umschalter-Entscheidungsregel).

// Badge-Info für die Schreibtisch-Kachel: Anzahl aller Einträge, gefärbt in
// der dringlichsten Stufe. null wenn nichts anliegt (kein leerer 0-Badge).
function schreibtischBadgeInfo(welt) {
  const E = schreibtischEintraege(welt);
  if (E.length === 0) return null;
  let maxRang = 0, farbe = "grau";
  for (let i = 0; i < E.length; i++) {
    if (E[i].rang > maxRang) { maxRang = E[i].rang; farbe = E[i].farbe; }
  }
  return { zahl: E.length, farbe: AMPEL_FARBEN[farbe] || AMPEL_FARBEN.grau };
}

function SchreibtischZeile({ eintrag, objektText, t, onSpringe }) {
  const fristText = eintrag.frist
    ? (eintrag.rang >= 5 ? "Frist " : "bis ") + datumDe(eintrag.frist)
    : (eintrag.seit ? "seit " + datumDe(eintrag.seit) : "");
  const sub = [eintrag.titel !== eintrag.text ? eintrag.titel : null,
    objektText, fristText].filter(Boolean).join(" · ");
  return (
    <div onClick={onSpringe}
      style={{ background: t.card, border: "1px solid " + t.border,
        borderRadius: RAD.lg, padding: "11px 14px", cursor: "pointer",
        minWidth: 0, boxSizing: "border-box", width: "100%" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <AmpelPunkt farbe={eintrag.farbe}/>
        <div style={{ flex: 1, minWidth: 0, fontSize: FS.m, fontWeight: FW.bold,
          color: t.text, overflowWrap: "anywhere" }}>{eintrag.text}</div>
      </div>
      {sub ? (
        <div style={{ fontSize: FS.s, color: t.muted, marginTop: 3,
          paddingLeft: 17, overflowWrap: "anywhere" }}>{sub}</div>
      ) : null}
    </div>
  );
}

// ── Flow-UI (§96.10 / Etappe 5): Aktionen an Aufträgen, Rechnungen, ─────────
// Aufgaben und Angeboten. Die Logik lebt KOMPLETT im Modell (welt…-Funktionen);
// hier nur Buttons + Mini-Formulare. onWelt(fn) ist der einzige Mutations-Weg.
function flowKnopf(t, accent, primaer) {
  return primaer ? {
    background: accent, color: getContrastColor(accent), border: "none",
    borderRadius: RAD.sm, padding: "5px 10px", fontSize: FS.s,
    fontWeight: FW.bold, cursor: "pointer", fontFamily: "inherit",
  } : {
    background: "transparent", color: t.sub, border: "1px solid " + t.border,
    borderRadius: RAD.sm, padding: "5px 10px", fontSize: FS.s,
    fontWeight: FW.med, cursor: "pointer", fontFamily: "inherit",
  };
}
const blockTitelStil = (t) => ({ fontSize: FS.xs, fontWeight: FW.bold,
  color: t.muted, textTransform: "uppercase", letterSpacing: 0.5,
  margin: "10px 0 6px 0" });
const flowZeileStil = (t) => ({ display: "flex", flexDirection: "column",
  gap: 6, padding: "8px 10px", border: "1px solid " + t.border,
  borderRadius: RAD.md, marginBottom: 6 });

// Ein Auftrag mit seinem nächsten Schritt: erfasst→Beauftragen (Form),
// beauftragt→In Arbeit, in_arbeit/nachbesserung→Fertig gemeldet,
// fertiggemeldet→Abnehmen (Form) bzw. Abhaken (ohne Abnahme-Phase).
function AuftragFlowZeile({ auftrag, kategorieId = null, firmen, kontakte, kontakteObjekt = null, t, accent, onWelt, DatumFeld, ve = null, onFotoHinzu = null, abnahmen = [] }) {
  const firmaName = nameVon(kontakte, auftrag.firma_kontakt_id);
  // Firma als KONTAKT-Zeile (Benny 11.07., Objekt-Kontakte-Muster): Klick
  // klappt die echte KontaktDetailKarte auf — Telefon & Co. direkt greifbar.
  const [firmaOffen, setFirmaOffen] = useState(false);
  const firmaKontakt = auftrag.firma_kontakt_id
    ? (kontakte || []).filter((k) => k && k.id === auftrag.firma_kontakt_id)[0] : null;
  const statusFarbe = AMPEL_FARBEN[ampelFarbeAuftrag(auftrag)];
  // §6b (Umbau): Abnahme PRO AUFTRAG — Schalter am Auftrag, Kategorie nur Default.
  const brauchtAbnahme = auftragBrauchtAbnahme(auftrag, kategorieId);
  const schalterSichtbar = !!onWelt && auftrag.status !== "abgenommen";
  const setzeAbnahme = (wert) => {
    onWelt((w) => Object.assign({}, w, {
      auftraege: w.auftraege.map((x) => x.id === auftrag.id
        ? Object.assign({}, x, { abnahme_noetig: wert }) : x),
    }));
  };
  const ergebnisLabel = (id) => {
    const o = ABNAHME_ERGEBNIS_OPTIONEN.filter((x) => x.id === id)[0];
    return o ? o.label : id;
  };
  return (
    <div style={flowZeileStil(t)}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <div style={{ flex: 1, minWidth: 0, fontSize: FS.s, fontWeight: FW.med,
          color: t.text, overflowWrap: "anywhere" }}>
          {auftrag.nummer ? (
            <span style={{ color: t.muted, fontWeight: FW.bold }}>{auftrag.nummer + " · "}</span>
          ) : null}
          {auftrag.beschreibung || "Auftrag"}
          {firmaName ? (
            <span style={{ color: t.muted }}>{" · " + firmaName}</span>
          ) : null}
          {auftrag.frist ? (
            <span style={{ color: t.muted }}>{" · bis " + datumDe(auftrag.frist)}</span>
          ) : null}
        </div>
      {firmaKontakt ? (
        firmaOffen ? (
          <div style={{ margin: "2px 0 6px" }}>
            <KontaktDetailKarte k={firmaKontakt} t={t} accent={accent}
              kategorieFarbe={accent} ves={ve ? [ve] : []} kontakte={kontakte}
              setKontakte={null} embedded
              onKopfClick={() => setFirmaOffen(false)}/>
          </div>
        ) : (
          <KontaktZeile k={firmaKontakt} ve={ve} t={t} accent={accent}
            highlightAccent={accent} isActive={false}
            onClick={() => setFirmaOffen(true)}/>
        )
      ) : null}
        <StatusPille t={t} farbe={statusFarbe}
          text={AUFTRAG_STATUS_LABEL[auftrag.status] || auftrag.status}/>
      </div>
      {/* Abnahme-Historie (§6b): abnahmen[] flach, IN der Auftragskarte —
          die Nachbesserungs-Schleife lebt IM Auftrag, Nachweis fällt frei heraus. */}
      {abnahmen.length > 0 ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
          {abnahmen.map((ab, i) => (
            <div key={ab.id} style={{ fontSize: FS.xs, color: t.muted,
              overflowWrap: "anywhere" }}>
              {(i + 1) + ". Abnahme " + datumDe(ab.datum) + " – " + ergebnisLabel(ab.ergebnis)
                + (nameVon(kontakte, ab.pruefer_kontakt_id)
                  ? " – " + nameVon(kontakte, ab.pruefer_kontakt_id) : "")
                + (ab.notiz ? " – " + ab.notiz : "")}
            </div>
          ))}
        </div>
      ) : null}
      {schalterSichtbar ? (
        <label style={{ display: "flex", alignItems: "center", gap: 8,
          fontSize: FS.xs, color: t.muted, cursor: "pointer" }}>
          <input type="checkbox" checked={brauchtAbnahme}
            onChange={(e) => setzeAbnahme(e.target.checked)}
            style={{ width: 16, height: 16 }}/>
          Abnahme erforderlich
        </label>
      ) : null}
      <AuftragFotoLeiste auftrag={auftrag} ve={ve} t={t} accent={accent}
        onFotoHinzu={onFotoHinzu}/>
      <AuftragFlowAktionen auftrag={auftrag} brauchtAbnahme={brauchtAbnahme}
        rechnungErwartet={kategorieHatPhase(kategorieId, "rechnung")}
        firmen={firmen} kontakte={kontakte} kontakteObjekt={kontakteObjekt}
        t={t} accent={accent} onWelt={onWelt} DatumFeld={DatumFeld}/>
    </div>
  );
}

// ── Auftragsfotos (Weg A §5.10, v13.59) ─────────────────────────────────────
// Thumbnails der referenzierten ve.fotos + „+ Foto" (Kamera/Galerie). Die
// Ablage (IndexedDB + ve.fotos-Eintrag) macht der Rumpf-Callback onFotoHinzu —
// hier nur Auswahl und Anzeige. HEIC wird wie im Foto-Feature abgewiesen (§93.10).
function FotoThumb({ foto, t }) {
  const [url, setUrl] = useState(null);
  useEffect(() => {
    let aktiv = true;
    dateiBlobUrl(foto.dateiRef).then((u) => { if (aktiv) setUrl(u); });
    return () => { aktiv = false; };
  }, [foto.dateiRef]);
  return url ? (
    <img src={url} alt={foto.name || "Foto"} title={foto.notiz || foto.name || ""}
      style={{ width: 46, height: 46, objectFit: "cover", borderRadius: RAD.sm,
        border: "1px solid " + t.border, flexShrink: 0 }}/>
  ) : (
    <div style={{ width: 46, height: 46, borderRadius: RAD.sm, flexShrink: 0,
      background: t.surface, border: "1px solid " + t.border }}/>
  );
}
function istHeicDatei(f) {
  const n = ((f && f.name) || "").toLowerCase();
  const ty = ((f && f.type) || "").toLowerCase();
  return n.endsWith(".heic") || n.endsWith(".heif") || ty.indexOf("heic") >= 0 || ty.indexOf("heif") >= 0;
}
function AuftragFotoLeiste({ auftrag, ve, t, accent, onFotoHinzu }) {
  const [heicHinweis, setHeicHinweis] = useState(false);
  const fotoIds = Array.isArray(auftrag.foto_ids) ? auftrag.foto_ids : [];
  const fotos = ((ve && ve.fotos) || []).filter((f) => f && fotoIds.indexOf(f.id) >= 0);
  if (!onFotoHinzu && fotos.length === 0) return null;
  const waehle = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.multiple = true;
    input.style.display = "none";
    input.onchange = (e) => {
      const roh = Array.from((e.target && e.target.files) || []);
      try { document.body.removeChild(input); } catch (err) {}
      if (roh.length === 0) return;
      const ok = roh.filter((f) => !istHeicDatei(f));
      setHeicHinweis(ok.length < roh.length);
      if (ok.length > 0) onFotoHinzu(auftrag, ok);
    };
    document.body.appendChild(input);
    input.click();
  };
  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
        {fotos.map((f) => (
          <FotoThumb key={f.id} foto={f} t={t}/>
        ))}
        {onFotoHinzu ? (
          <button onClick={waehle} style={flowKnopf(t, accent, false)}>+ Foto</button>
        ) : null}
      </div>
      {heicHinweis ? (
        <div style={{ fontSize: FS.xs, color: t.muted, marginTop: 4 }}>
          HEIC-Bilder kann der Browser nicht anzeigen — bitte als JPEG aufnehmen/teilen (§93.10).
        </div>
      ) : null}
    </div>
  );
}

// Nur die Aktionen (Buttons + Mini-Formulare) — genutzt von AuftragFlowZeile
// (Vorgangs-Detail) UND LoseAuftragKarte (Begehungsfund), ein Bau (§76).
function AuftragFlowAktionen({ auftrag, brauchtAbnahme, rechnungErwartet = false, firmen, kontakte = [], kontakteObjekt = null, t, accent, onWelt, DatumFeld }) {
  const [formOffen, setFormOffen] = useState(null); // "beauftragen" | "abnehmen" | null
  const [firmaId, setFirmaId] = useState(auftrag.firma_kontakt_id || "");
  const fristen = useFristen();
  const [frist, setFrist] = useState(isoInTagen(fristen.ausfuehrung_tage));
  const [ergebnis, setErgebnis] = useState("angenommen");
  const [abnahmeNotiz, setAbnahmeNotiz] = useState("");
  const [prueferId, setPrueferId] = useState("");
  const s = auftrag.status;

  const vorlagen = useVorlagen();
  const beauftrage = () => {
    onWelt((w) => {
      let neu = weltAuftragBeauftragen(w, auftrag.id,
        { firma_kontakt_id: firmaId || null, frist: frist || null,
          nachfass_ab: fristMinusTage(frist, fristen.nachfass_vorlauf_tage) });
      if (firmaId && auftrag.vorgang_id) {
        const a2 = neu.auftraege.filter((x) => x.id === auftrag.id)[0] || auftrag;
        neu = logBeauftragung(neu, { vorgangId: auftrag.vorgang_id,
          nummer: a2.nummer, beschreibung: a2.beschreibung, firmaId: firmaId,
          firmaName: nameVon(kontakte, firmaId), frist: frist || null,
          vorlagen: vorlagen, rueckmeldungTage: fristen.rueckmeldung_tage });
      }
      return neu;
    });
    setFormOffen(null);
  };
  // Abnahme SCHLANK (§6b): Datum (heute) · Prüfer · Ergebnis · freies
  // Notizfeld — keine strukturierte Mängelliste; das Ergebnis treibt die
  // Mechanik (mit Mängeln → nachbesserung), das Inhaltliche steckt in der Notiz.
  const nimmAb = () => {
    onWelt((w) => weltAuftragAbnehmen(w, auftrag.id,
      { ergebnis: ergebnis, notiz: abnahmeNotiz.trim(),
        pruefer_kontakt_id: prueferId || null,
        rechnung_erwartet_bis: rechnungErwartet
          ? isoInTagen(fristen.rechnung_erwartet_tage) : null }));
    setFormOffen(null); setAbnahmeNotiz(""); setPrueferId("");
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      {formOffen === null ? (
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {s === "erfasst" ? (
            <button onClick={() => setFormOffen("beauftragen")}
              style={flowKnopf(t, accent, true)}>Beauftragen</button>
          ) : null}
          {s === "beauftragt" ? (
            <button onClick={() => onWelt((w) => weltAuftragStatus(w, auftrag.id, "in_arbeit"))}
              style={flowKnopf(t, accent, true)}>In Arbeit</button>
          ) : null}
          {(s === "in_arbeit" || s === "nachbesserung") ? (
            <button onClick={() => onWelt((w) => weltAuftragStatus(w, auftrag.id, "fertiggemeldet"))}
              style={flowKnopf(t, accent, true)}>Fertig gemeldet</button>
          ) : null}
          {s === "fertiggemeldet" ? (brauchtAbnahme ? (
            <button onClick={() => { setErgebnis("angenommen"); setAbnahmeNotiz(""); setPrueferId(""); setFormOffen("abnehmen"); }}
              style={flowKnopf(t, accent, true)}>Abnehmen</button>
          ) : (
            <button onClick={() => onWelt((w) => weltAuftragAbhaken(w, auftrag.id,
                { rechnung_erwartet_bis: rechnungErwartet
                  ? isoInTagen(fristen.rechnung_erwartet_tage) : null }))}
              style={flowKnopf(t, accent, true)}>Abhaken</button>
          )) : null}
        </div>
      ) : null}
      {formOffen === "beauftragen" ? (
        <div>
          <KontaktPickerMitAllen value={firmaId || null}
            onChange={(id) => setFirmaId(id || "")}
            label="Firma" t={t} accent={accent} nurFirmen
            kontakteObjekt={kontakteObjekt ? pickerListe(kontakteObjekt) : null}
            kontakteAlle={pickerListe(firmen)}/>
          {DatumFeld ? (
            <DatumFeld t={t} accent={accent} label="Zieldatum (optional)"
              value={frist} onChange={setFrist} iso defaultHeute={false}/>
          ) : null}
          <div style={{ display: "flex", gap: 6, justifyContent: "flex-end", marginTop: 6 }}>
            <button onClick={() => setFormOffen(null)} style={flowKnopf(t, accent, false)}>Abbrechen</button>
            <button onClick={beauftrage} style={flowKnopf(t, accent, true)}>Beauftragen</button>
          </div>
        </div>
      ) : null}
      {formOffen === "abnehmen" ? (
        <div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 8 }}>
            {ABNAHME_ERGEBNIS_OPTIONEN.map((o) => (
              <button key={o.id} onClick={() => setErgebnis(o.id)}
                style={Object.assign({}, flowKnopf(t, accent, ergebnis === o.id),
                  ergebnis === o.id ? {} : { color: t.text })}>{o.label}</button>
            ))}
          </div>
          <KontaktPickerMitAllen value={prueferId || null}
            onChange={(id) => setPrueferId(id || "")}
            label="Prüfer (leer = ich / die Verwaltung)" t={t} accent={accent}
            kontakteObjekt={kontakteObjekt ? pickerListe(kontakteObjekt) : null}
            kontakteAlle={pickerListe(kontakte)}/>
          <label style={feldLabelStil(t)}>
            {ergebnis === "angenommen" ? "Notiz (optional)" : "Was ist Sache? (Notiz)"}</label>
          <textarea value={abnahmeNotiz}
            onChange={(e) => setAbnahmeNotiz(e.target.value)} rows={2}
            placeholder={ergebnis === "angenommen" ? "z. B. alles sauber übergeben"
              : "z. B. Pumpe läuft laut, Nacharbeit zugesagt"}
            style={Object.assign({}, selectStil(t, accent, !!abnahmeNotiz),
              { resize: "vertical", minHeight: 44 })}/>
          <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
            <button onClick={() => setFormOffen(null)} style={flowKnopf(t, accent, false)}>Abbrechen</button>
            <button onClick={nimmAb} style={flowKnopf(t, accent, true)}>
              {ergebnis === "angenommen" ? "Abnahme bestätigen" : "Abnahme festhalten"}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
const ABNAHME_ERGEBNIS_OPTIONEN = [
  { id: "angenommen", label: "Angenommen" },
  { id: "mit_maengeln", label: "Mit Mängeln" },
  { id: "abgelehnt", label: "Abgelehnt" },
];

// §6c (Umbau) · Die Rechnungswelt: Auto-Abgleich (Angebot ↔ Rechnung, Abweichung
// BERECHNET) + Freitext „warum" bei Abweichung + Prüf-Kette
// eingegangen → geprüft → freigegeben → bezahlt. Beirats-Prüfung = AUFGABE
// (§5.8, bezug: rechnung) — kein neuer Mechanismus, offener Faden hält nach.
function RechnungFlowZeile({ rechnung, welt = null, vorgangId = null, t, accent, onWelt }) {
  const [grundFormOffen, setGrundFormOffen] = useState(false);
  const [grund, setGrund] = useState(rechnung.abweichung_grund || "");
  const s = rechnung.status;
  const label = { eingegangen: "Eingegangen", in_pruefung: "Geprüft",
    freigegeben: "Freigegeben", bezahlt: "Bezahlt" }[s] || s;
  const abgleich = welt ? rechnungAbgleich(rechnung, welt) : null;
  const weicht = abgleich && abgleich.abweichung !== 0;
  const speichereGrund = () => {
    onWelt((w) => Object.assign({}, w, {
      rechnungen: w.rechnungen.map((x) => x.id === rechnung.id
        ? Object.assign({}, x, { abweichung_grund: grund.trim() }) : x),
    }));
    setGrundFormOffen(false);
  };
  const beiratsAufgabe = () => {
    if (!vorgangId) return;
    onWelt((w) => weltAufgabeNeu(w, vorgangId, {
      titel: "Rechnungsprüfung Beirat — auf ok warten"
        + (rechnung.betrag != null ? " (" + eur(rechnung.betrag) + ")" : ""),
      bezug: { typ: "rechnung", id: rechnung.id },
    }));
  };
  return (
    <div style={flowZeileStil(t)}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <div style={{ flex: 1, minWidth: 0, fontSize: FS.s, fontWeight: FW.med,
          color: t.text }}>
          {"Rechnung" + (rechnung.betrag != null ? " · " + eur(rechnung.betrag) : "")}
        </div>
        <StatusPille t={t}
          farbe={s === "bezahlt" ? AMPEL_FARBEN.grau : AMPEL_FARBEN.gelb}
          text={label}/>
      </div>
      {/* Auto-Abgleich: Gegenüberstellung + berechnete Abweichung */}
      {abgleich ? (
        <div style={{ fontSize: FS.xs, color: t.muted, display: "flex",
          flexDirection: "column", gap: 2 }}>
          <div>{"Angebot: " + eur(abgleich.angebotPreis)}</div>
          <div>
            {"Rechnung: " + eur(rechnung.betrag)}
            {weicht ? (
              <span style={{ color: AMPEL_FARBEN.gelb, fontWeight: FW.bold }}>
                {" ← " + (abgleich.abweichung > 0 ? "+" : "")
                  + eur(abgleich.abweichung) + " Abweichung"}</span>
            ) : (
              <span style={{ color: AMPEL_FARBEN.gruen, fontWeight: FW.bold }}>
                {" ✓ stimmt überein"}</span>
            )}
          </div>
        </div>
      ) : null}
      {/* Abweichung → Freitext „warum" (Nachweis der Freigabe-Begründung) */}
      {weicht && rechnung.abweichung_grund && !grundFormOffen ? (
        <div style={{ fontSize: FS.xs, color: t.text, overflowWrap: "anywhere" }}>
          {"Warum: " + rechnung.abweichung_grund}
          {onWelt && s !== "bezahlt" ? (
            <button onClick={() => setGrundFormOffen(true)}
              style={{ background: "none", border: "none", padding: "0 0 0 6px",
                cursor: "pointer", fontSize: FS.xs, color: accent,
                fontFamily: "inherit", fontWeight: FW.bold }}>ändern</button>
          ) : null}
        </div>
      ) : null}
      {onWelt && weicht && s !== "bezahlt" && (grundFormOffen || !rechnung.abweichung_grund) ? (
        <div>
          <label style={feldLabelStil(t)}>Warum weicht sie ab?</label>
          <input value={grund} onChange={(e) => setGrund(e.target.value)}
            placeholder={"z. B. Mehrarbeit, telefonisch zugestimmt"}
            style={Object.assign({}, selectStil(t, accent, !!grund), { marginBottom: 0 })}/>
          <div style={{ display: "flex", gap: 6, justifyContent: "flex-end",
            marginTop: 6 }}>
            {grundFormOffen ? (
              <button onClick={() => { setGrundFormOffen(false); setGrund(rechnung.abweichung_grund || ""); }}
                style={flowKnopf(t, accent, false)}>Abbrechen</button>
            ) : null}
            <button onClick={speichereGrund}
              style={flowKnopf(t, accent, true)}>Festhalten</button>
          </div>
        </div>
      ) : null}
      {/* Prüf-Kette: eingegangen → geprüft → freigegeben → bezahlt */}
      {onWelt && s === "eingegangen" ? (
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          <button onClick={() => onWelt((w) => weltRechnungStatus(w, rechnung.id, "in_pruefung"))}
            style={flowKnopf(t, accent, true)}>Geprüft</button>
          {vorgangId ? (
            <button onClick={beiratsAufgabe}
              style={flowKnopf(t, accent, false)}>An Beirat (Aufgabe)</button>
          ) : null}
        </div>
      ) : null}
      {onWelt && s === "in_pruefung" ? (
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          <button onClick={() => onWelt((w) => weltRechnungStatus(w, rechnung.id, "freigegeben"))}
            style={flowKnopf(t, accent, true)}>Freigeben</button>
          {vorgangId ? (
            <button onClick={beiratsAufgabe}
              style={flowKnopf(t, accent, false)}>An Beirat (Aufgabe)</button>
          ) : null}
        </div>
      ) : null}
      {onWelt && s === "freigegeben" ? (
        <div style={{ display: "flex", gap: 6 }}>
          <button onClick={() => onWelt((w) => weltRechnungStatus(w, rechnung.id, "bezahlt"))}
            style={flowKnopf(t, accent, true)}>Als bezahlt markieren</button>
        </div>
      ) : null}
    </div>
  );
}

function AufgabeFlowZeile({ aufgabe, t, accent, onWelt }) {
  const ueberfaellig = aufgabe.frist && aufgabe.frist < isoHeute();
  return (
    <div style={flowZeileStil(t)}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <AmpelPunkt farbe={ueberfaellig ? "rot" : "gelb"}/>
        <div style={{ flex: 1, minWidth: 0, fontSize: FS.s, fontWeight: FW.med,
          color: t.text, overflowWrap: "anywhere" }}>
          {aufgabe.titel || "Aufgabe"}
          {aufgabe.frist ? (
            <span style={{ color: ueberfaellig ? AMPEL_FARBEN.rot : t.muted }}>
              {" · Frist " + datumDe(aufgabe.frist)}
            </span>
          ) : null}
        </div>
        <button onClick={() => onWelt((w) => weltAufgabeErledigt(w, aufgabe.id))}
          style={flowKnopf(t, accent, true)}>Erledigt</button>
      </div>
    </div>
  );
}
function AngebotFlowZeile({ angebot, kontakte, keinsGewaehlt, t, accent, onWelt }) {
  const fristenAB = useFristen();
  const vorlagenAB = useVorlagen();
  const [confirm, setConfirm] = useState(false);
  const [summeFormOffen, setSummeFormOffen] = useState(false);
  const [summe, setSumme] = useState("");
  const wer = nameVon(kontakte, angebot.firma_kontakt_id) || "ohne Firma";
  const liegtVor = angebot.preis != null;
  const erfasseSumme = () => {
    const p = parseFloat(String(summe).replace(",", "."));
    if (isNaN(p)) return;
    onWelt((w) => Object.assign({}, w, {
      angebote: w.angebote.map((x) => x.id === angebot.id
        ? Object.assign({}, x, { preis: p }) : x),
    }));
    setSumme(""); setSummeFormOffen(false);
  };
  return (
    <div style={flowZeileStil(t)}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <div style={{ flex: 1, minWidth: 0, fontSize: FS.s, fontWeight: FW.med,
          color: t.text, overflowWrap: "anywhere" }}>
          {angebot.nummer ? (
            <span style={{ color: t.muted, fontWeight: FW.bold }}>{angebot.nummer + " · "}</span>
          ) : null}
          {wer + (liegtVor ? " · " + eur(angebot.preis)
            : (angebot.abgabe_bis ? " · erwartet bis " + datumDe(angebot.abgabe_bis) : ""))}
        </div>
        {angebot.wurde_zu_auftrag_id ? (
          <StatusPille t={t} farbe={AMPEL_FARBEN.gruen} text="Beauftragt"/>
        ) : !liegtVor ? (
          <StatusPille t={t} farbe={AMPEL_FARBEN.blau} text="Angefragt"/>
        ) : keinsGewaehlt ? (
          <button style={flowKnopf(t, accent, confirm)}
            onClick={() => {
              if (!confirm) { setConfirm(true); return; }
              onWelt((w) => {
                let neu = weltAngebotBeauftragen(w, angebot.id, {});
                // Beauftragung → Kommunikation: der eben entstandene Auftrag
                // (Kette wurde_zu_auftrag_id) liefert Nummer + Beschreibung.
                const ang2 = neu.angebote.filter((x) => x.id === angebot.id)[0];
                const auf2 = ang2 && ang2.wurde_zu_auftrag_id
                  ? neu.auftraege.filter((x) => x.id === ang2.wurde_zu_auftrag_id)[0] : null;
                if (auf2 && angebot.vorgang_id) {
                  neu = logBeauftragung(neu, { vorgangId: angebot.vorgang_id,
                    nummer: auf2.nummer, beschreibung: auf2.beschreibung,
                    firmaId: angebot.firma_kontakt_id,
                    firmaName: nameVon(kontakte, angebot.firma_kontakt_id),
                    frist: auf2.frist || null,
                    vorlagen: vorlagenAB, rueckmeldungTage: fristenAB.rueckmeldung_tage });
                }
                return neu;
              });
              setConfirm(false);
            }}>{confirm ? "Wirklich beauftragen?" : "Beauftragen"}</button>
        ) : null}
      </div>
      {angebot.notiz ? (
        <div style={{ fontSize: FS.xs, color: t.muted,
          overflowWrap: "anywhere" }}>{angebot.notiz}</div>
      ) : null}
      {/* Eintrudeln (§6a Moment 2): Summe nachtragen → Angebot „liegt vor". */}
      {onWelt && !liegtVor && !angebot.wurde_zu_auftrag_id ? (
        summeFormOffen ? (
          <div>
            <label style={feldLabelStil(t)}>Summe (€)</label>
            <input value={summe} inputMode="decimal"
              onChange={(e) => setSumme(e.target.value)}
              placeholder="z. B. 4200"
              style={Object.assign({}, selectStil(t, accent, !!summe), { marginBottom: 0 })}/>
            <div style={{ display: "flex", gap: 6, justifyContent: "flex-end",
              marginTop: 6 }}>
              <button onClick={() => setSummeFormOffen(false)}
                style={flowKnopf(t, accent, false)}>Abbrechen</button>
              <button onClick={erfasseSumme}
                style={flowKnopf(t, accent, true)}>Liegt vor</button>
            </div>
          </div>
        ) : (
          <div style={{ display: "flex", justifyContent: "flex-end" }}>
            <button onClick={() => setSummeFormOffen(true)}
              style={flowKnopf(t, accent, false)}>Summe erfassen</button>
          </div>
        )
      ) : null}
    </div>
  );
}

// ── AngebotNeuForm — Angebot einholen/erfassen (§6a Momente 1+2) ────────────
// Pro Firma EIN Angebot-Objekt. Ohne Summe = „angefragt" (wird überfällig,
// §4); mit Summe = „liegt vor". Die ausgehende Angebotsanfrage-Nachricht
// (Anlass-Typ) dockt mit der Kommunikations-Karte an.
function AngebotNeuForm({ vorgangId, firmen, kontakteObjekt = null, t, accent, onWelt, onFertig }) {
  const [firmaId, setFirmaId] = useState("");
  const [summe, setSumme] = useState("");
  const [notiz, setNotiz] = useState("");
  const fristen = useFristen();
  const legeAn = () => {
    if (!firmaId) return;
    const p = parseFloat(String(summe).replace(",", "."));
    onWelt((w) => Object.assign({}, w, {
      angebote: [...w.angebote, neuesAngebot({
        vorgang_id: vorgangId, nummer: angebotsNummerNeu(w, vorgangId),
        firma_kontakt_id: firmaId,
        preis: isNaN(p) ? null : p, notiz: notiz.trim(),
        // §4.3: angefragt → Abgabefrist aus den Einstellungen; liegt es schon
        // vor, braucht es keine.
        abgabe_bis: isNaN(p) ? isoInTagen(fristen.angebotsabgabe_tage) : null,
      })],
    }));
    onFertig();
  };
  return (
    <div style={flowZeileStil(t)}>
      <KontaktPickerMitAllen value={firmaId || null}
        onChange={(id) => setFirmaId(id || "")}
        label="Von welcher Firma?" t={t} accent={accent} nurFirmen
        kontakteObjekt={kontakteObjekt ? pickerListe(kontakteObjekt) : null}
        kontakteAlle={pickerListe(firmen)}/>
      <label style={feldLabelStil(t)}>Summe (€) — leer = erst angefragt</label>
      <input value={summe} inputMode="decimal"
        onChange={(e) => setSumme(e.target.value)}
        placeholder="z. B. 4200"
        style={Object.assign({}, selectStil(t, accent, !!summe), { marginBottom: 0 })}/>
      <label style={feldLabelStil(t)}>Notiz (optional)</label>
      <input value={notiz} onChange={(e) => setNotiz(e.target.value)}
        placeholder="z. B. inkl. Gerüst"
        style={Object.assign({}, selectStil(t, accent, !!notiz), { marginBottom: 0 })}/>
      <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
        <button onClick={onFertig} style={flowKnopf(t, accent, false)}>Abbrechen</button>
        <button onClick={legeAn} style={flowKnopf(t, accent, true)}>
          {summe ? "Liegt vor" : "Anfragen"}</button>
      </div>
    </div>
  );
}

const SCHREIBTISCH_SORTIERUNGEN = [
  { id: "frist", label: "Frist" },
  { id: "alter", label: "Älteste" },
  { id: "objekt", label: "Objekt" },
];

// ── Erfassen (§96 / Spec §5.5 + §5.12): das Anlege-Overlay ───────────────────
// EIN Overlay (Bausteine aus components.jsx, §76-Hebung) mit zwei Wegen:
//   · „Vorgang" — der echte Fall: Titel, Kategorie, optional Einheit + erste
//     Notiz. Erzeugt Vorgang + Fallführer-Beteiligung (+ Nachricht).
//   · „Auftrag erfassen" — der schnelle Fund („kaputte Lampe"): nur die
//     Beschreibung, OHNE Vorgang, hängt am Objekt (§5.5).
// Der Begehungsmodus (§5.12) ist KEIN eigener Baustein, sondern der Button
// „Speichern + weiter": Formular leert sich, Overlay bleibt offen, Zähler
// zählt hoch — Punkt für Punkt, Handy in der Hand, ohne Navigation.
function knopfStil(accent, primaer, t) {
  return primaer ? {
    background: accent, color: getContrastColor(accent), border: "none",
    borderRadius: RAD.md, padding: "9px 14px", fontSize: FS.m,
    fontWeight: FW.bold, cursor: "pointer", fontFamily: "inherit",
  } : {
    background: "transparent", color: t.sub,
    border: "1px solid " + t.border,
    borderRadius: RAD.md, padding: "9px 14px", fontSize: FS.m,
    fontWeight: FW.med, cursor: "pointer", fontFamily: "inherit",
  };
}
const selectStil = (t, accent, gesetzt) => ({
  width: "100%", boxSizing: "border-box", padding: "9px 10px",
  fontSize: 16, // §14: iOS zoomt bei < 16px in Eingaben
  color: t.text, background: t.card,
  border: "1px solid " + (gesetzt ? accent + "50" : t.border),
  borderRadius: RAD.md, fontFamily: "inherit", marginBottom: 10,
});
const feldLabelStil = (t) => ({ fontSize: FS.s, fontWeight: FW.med,
  color: t.sub, display: "block", marginBottom: 4 });

function VorgangNeuOverlay({ ve, t, accent, onClose, onAnlegenVorgang,
  onErfasseAuftrag, Inp, kontakteAlle = [], objektWahl = null }) {
  const kontakteObjektOv = useObjektKontakte(kontakteAlle, ve);
  const [raumId, setRaumId] = useState("");
  const [modus, setModus] = useState("vorgang"); // "vorgang" | "auftrag"
  // Vorgang-Felder — Reihenfolge WER / WO / WAS (Umbau-Konzept §1): Der Melder
  // ist IMMER ein Kontakt; „Ich / die Verwaltung" ist der Verwaltungs-Wer
  // (Beschluss-Fall & Eigenfund). Ein Melder ohne Kontakt wäre eine
  // kommunikative Sackgasse.
  const [melderId, setMelderId] = useState(""); // "" = ich / die Verwaltung
  const [einheitId, setEinheitId] = useState("");
  const [titel, setTitel] = useState("");
  const [kategorie, setKategorie] = useState("instandhaltung");
  const [notiz, setNotiz] = useState("");
  // Auftrag-Felder + Begehungszähler (Begehung 18.07.: + Wo genau, Notizen,
  // Fotos direkt bei der Aufnahme — Fotos landen in der Foto-Zentrale des
  // Objekts, am Punkt hängen nur Referenzen).
  const [beschreibung, setBeschreibung] = useState("");
  const [auftragOrt, setAuftragOrt] = useState("");
  const [auftragNotiz, setAuftragNotiz] = useState("");
  const [auftragFotos, setAuftragFotos] = useState([]);   // File-Objekte bis zum Speichern
  const [erfasstZahl, setErfasstZahl] = useState(0);
  const [fehler, setFehler] = useState(false);

  const fotosWaehlen = () => {
    const input = document.createElement("input");
    input.type = "file"; input.accept = "image/*"; input.multiple = true;
    input.style.display = "none";
    input.onchange = (ev) => {
      const fl = ev.target.files ? Array.from(ev.target.files) : [];
      try { document.body.removeChild(input); } catch (err) {}
      if (fl.length) setAuftragFotos((alt) => [...alt, ...fl]);
    };
    document.body.appendChild(input);
    input.click();
  };

  const einheiten = (ve && Array.isArray(ve.einheiten)) ? ve.einheiten : [];

  const legeVorgangAn = () => {
    if (!titel.trim()) { setFehler(true); return; }
    onAnlegenVorgang({
      titel: titel.trim(), kategorie: kategorie,
      einheit_id: einheitId || null, raum_id: raumId || null,
      notiz: notiz.trim(),
      melder_kontakt_id: melderId || null,
    });
    onClose();
  };
  const erfasseAuftrag = (weiter) => {
    // „Speichern" mit leerem Formular = einfach fertig (letzter Screen ohne
    // Punkt, Benny 18.07.) — kein Fehler, Overlay schließt.
    if (!beschreibung.trim()) {
      if (weiter) { setFehler(true); return; }   // „Nächster Punkt" braucht Inhalt
      onClose(); return;
    }
    onErfasseAuftrag({ beschreibung: beschreibung.trim(),
      ort: auftragOrt.trim(), notiz: auftragNotiz.trim(),
      gemeldet_von_id: melderId || null,
      fotos: auftragFotos });
    if (weiter) {
      setBeschreibung(""); setAuftragOrt(""); setAuftragNotiz("");
      setAuftragFotos([]); setFehler(false);
      setErfasstZahl(erfasstZahl + 1);
    } else {
      onClose();
    }
  };

  const kopfTitel = "Neu · " + ((ve && (ve.nr || ve.name)) || "Objekt");
  return (
    <div onClick={onClose} style={overlayBackdrop()}>
      <div onClick={(e) => e.stopPropagation()} style={overlayPanel(t)}>
        <OverlayKopf t={t} titel={kopfTitel} onClose={onClose}/>
        <div style={overlayBody()}>
          {/* §Plus-Buttons: Objektwahl als ERSTES Feld im Dialog (statt
              vorgeschaltetem Wahl-Fenster). Vorbelegt, wenn der Screen bereits
              eine Objekt-Akte offen hat; sonst wählbar. Ohne Objekt bleibt der
              Rest des Formulars ausgeblendet. */}
          {objektWahl ? (
            <div style={{ marginBottom: 12 }}>
              <label style={feldLabelStil(t)}>Objekt *</label>
              <select value={objektWahl.aktivId != null ? String(objektWahl.aktivId) : ""}
                onChange={(e) => objektWahl.onWaehle && objektWahl.onWaehle(e.target.value || null)}
                style={selectStil(t, accent, true)}>
                <option value="">— Objekt wählen —</option>
                {(objektWahl.ves || []).map((v) => (
                  <option key={v.id} value={String(v.id)}>
                    {(v.nr ? v.nr + " · " : "") + (v.adresse || v.name || "")}
                  </option>
                ))}
              </select>
            </div>
          ) : null}
          {(!ve && objektWahl) ? (
            <div style={{ fontSize: FS.m, color: t.muted, fontStyle: "italic",
              padding: "4px 2px 8px" }}>
              Bitte zuerst ein Objekt wählen.
            </div>
          ) : null}
          {ve ? (<div>
          <div style={{ marginBottom: 12 }}>
            <SegmentControl t={t} accent={accent} voll={false}
              options={[{ id: "vorgang", label: "Vorgang" },
                { id: "auftrag", label: "Auftrag erfassen" }]}
              value={modus}
              onChange={(m) => { setModus(m); setFehler(false); }}/>
          </div>
          {modus === "vorgang" ? (
            <div>
              {/* WER meldet — immer ein Kontakt (harte Regel §1). */}
              <KontaktPickerMitAllen value={melderId || null}
                onChange={(id) => setMelderId(id || "")}
                label="Wer meldet? (leer = ich / die Verwaltung)" t={t} accent={accent}
                kontakteObjekt={kontakteObjektOv ? pickerListe(kontakteObjektOv) : null}
                kontakteAlle={pickerListe(kontakteAlle)}/>
              {/* WO — „ganzes Objekt" ist gleichwertige Antwort. */}
              {einheiten.length > 0 ? (
                <div>
                  <label style={feldLabelStil(t)}>Wo?</label>
                  <select value={einheitId}
                    onChange={(e) => { setEinheitId(e.target.value); setRaumId(""); }}
                    style={selectStil(t, accent, true)}>
                    <option value="">Ganzes Objekt / Gemeinschaft</option>
                    {einheiten.map((e) => (
                      <option key={e.id} value={e.id}>
                        {e.bezeichnung || e.nr || e.einheitLabel || String(e.id)}
                      </option>
                    ))}
                  </select>
                </div>
              ) : null}
              {/* RAUM — die Verfeinerung nach Objekt/Einheit (Benny 11.07.):
                  Räume der gewählten Einheit bzw. der Standorte (Gemeinschaft).
                  Nur sichtbar, wenn es welche gibt — kein leeres Pflichtfeld. */}
              {(() => {
                const raeume = raeumeFuerWo(ve, einheitId);
                if (raeume.length === 0) return null;
                return (
                  <div>
                    <label style={feldLabelStil(t)}>Raum (optional)</label>
                    <select value={raumId}
                      onChange={(e) => setRaumId(e.target.value)}
                      style={selectStil(t, accent, !!raumId)}>
                      <option value="">— kein bestimmter Raum —</option>
                      {raeume.map((r) => (
                        <option key={r.id} value={r.id}>
                          {r.name || r.bezeichnung || "Raum"}
                        </option>
                      ))}
                    </select>
                  </div>
                );
              })()}
              {/* WAS — Sache + Kategorie (Kategorie = sanfter Vorschlag §6.2). */}
              <Inp t={t} accent={accent} label="Was ist Sache?" required
                value={titel} onChange={setTitel}
                invalid={fehler && !titel.trim()}
                placeholder="z. B. Wasserschaden Tiefgarage"/>
              <label style={feldLabelStil(t)}>Kategorie</label>
              <select value={kategorie}
                onChange={(e) => setKategorie(e.target.value)}
                style={selectStil(t, accent, true)}>
                {VORGANG_KATEGORIEN.map((k) => (
                  <option key={k.id} value={k.id}>{k.label}</option>
                ))}
              </select>
              <label style={feldLabelStil(t)}>Was wurde gemeldet? (optional)</label>
              <textarea value={notiz} onChange={(e) => setNotiz(e.target.value)}
                rows={3} placeholder="Erste Notiz in die Akte"
                style={Object.assign({}, selectStil(t, accent, !!notiz),
                  { resize: "vertical", minHeight: 60 })}/>
              <div style={{ display: "flex", gap: 8, justifyContent: "flex-end",
                marginTop: 4 }}>
                <button onClick={onClose} style={knopfStil(accent, false, t)}>Abbrechen</button>
                <button onClick={legeVorgangAn} style={knopfStil(accent, true, t)}>Anlegen</button>
              </div>
            </div>
          ) : (
            <div>
              <div style={{ fontSize: FS.s, color: t.muted, marginBottom: 10 }}>
                Der schnelle Fund — nur festhalten, ohne Vorgang. Landet blau
                am Objekt und am Schreibtisch. Für die Begehung: „Nächster
                Punkt" erfasst Punkt für Punkt.
              </div>
              <Inp t={t} accent={accent} label="Was ist Sache?" required
                value={beschreibung} onChange={setBeschreibung}
                invalid={fehler && !beschreibung.trim()}
                placeholder="z. B. Lampe 2. OG defekt"/>
              {/* Fotos direkt bei der Aufnahme (Begehung 18.07.) — landen beim
                  Speichern in der Foto-Zentrale des Objekts. */}
              <label style={feldLabelStil(t)}>Fotos (optional)</label>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 10 }}>
                {auftragFotos.map((f, i) => (
                  <span key={i} style={{ display: "inline-flex", alignItems: "center",
                    gap: 6, fontSize: FS.s, color: t.text, background: t.card,
                    border: "1px solid " + t.border, borderRadius: RAD.pill,
                    padding: "4px 10px", maxWidth: "100%" }}>
                    <span style={{ overflow: "hidden", textOverflow: "ellipsis",
                      whiteSpace: "nowrap", maxWidth: 160 }}>{f.name || "Foto"}</span>
                    <span onClick={() => setAuftragFotos(auftragFotos.filter((_, j) => j !== i))}
                      style={{ cursor: "pointer", color: "#EF4444", fontWeight: FW.bold }}>×</span>
                  </span>
                ))}
                <button onClick={fotosWaehlen} style={knopfStil(accent, false, t)}>
                  + Foto</button>
              </div>
              <Inp t={t} accent={accent} label="Wo genau? (optional)"
                value={auftragOrt} onChange={setAuftragOrt}
                placeholder="z. B. Treppenhaus 2. OG, vor Wohnung 5"/>
              <label style={feldLabelStil(t)}>Notizen (optional)</label>
              <textarea value={auftragNotiz} onChange={(e) => setAuftragNotiz(e.target.value)}
                rows={2} placeholder="Details, Beobachtungen, Material …"
                style={Object.assign({}, selectStil(t, accent, !!auftragNotiz),
                  { resize: "vertical", minHeight: 48 })}/>
              <KontaktPickerMitAllen value={melderId || null}
                onChange={(id) => setMelderId(id || "")}
                label="Gemeldet von (leer = ich / die Verwaltung)" t={t} accent={accent}
                kontakteObjekt={kontakteObjektOv ? pickerListe(kontakteObjektOv) : null}
                kontakteAlle={pickerListe(kontakteAlle)}/>
              {erfasstZahl > 0 ? (
                <div style={{ fontSize: FS.s, fontWeight: FW.bold, color: accent,
                  marginBottom: 8 }}>
                  {erfasstZahl === 1 ? "1 Punkt erfasst" : erfasstZahl + " Punkte erfasst"}
                </div>
              ) : null}
              {/* Buttons rechts unten in EINER Reihe (Benny 18.07.):
                  [Nächster Punkt] [Speichern] — „Fertig" entfällt; Speichern
                  bei leerem Formular schließt einfach. */}
              <div style={{ display: "flex", gap: 8, justifyContent: "flex-end",
                flexWrap: "wrap", marginTop: 4 }}>
                <button onClick={() => erfasseAuftrag(true)}
                  style={knopfStil(accent, false, t)}>Nächster Punkt</button>
                <button onClick={() => erfasseAuftrag(false)}
                  style={knopfStil(accent, true, t)}>Speichern</button>
              </div>
            </div>
          )}
          </div>) : null}
        </div>
      </div>
    </div>
  );
}

function SchreibtischBereich({ welt, ves, t, accent, onSpringe }) {
  const [sortierung, setSortierung] = useState("frist");
  const eintraege = schreibtischEintraege(welt, sortierung);
  const objektText = (id) => {
    if (!id) return "";
    const v = (ves || []).filter((x) => x && x.id === id)[0];
    return v ? (v.nr || v.name || "") : "";
  };
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {eintraege.length > 0 ? (
        <div style={{ marginBottom: 2 }}>
          <SegmentControl t={t} accent={accent} voll={false}
            options={SCHREIBTISCH_SORTIERUNGEN} value={sortierung}
            onChange={setSortierung}/>
        </div>
      ) : null}
      {eintraege.length === 0 ? (
        <div style={{ fontSize: FS.m, color: t.muted, fontStyle: "italic",
          padding: "8px 2px" }}>
          Nichts liegt an — alle Vorgänge laufen oder ruhen berechtigt.
        </div>
      ) : eintraege.map((e, i) => (
        <SchreibtischZeile key={(e.vorgang_id || "") + ":" + (e.auftrag_id || "") + ":" + e.typ + ":" + i}
          eintrag={e} objektText={objektText(e.objekt_id)} t={t}
          onSpringe={() => onSpringe && onSpringe(e)}/>
      ))}
    </div>
  );
}

// ── Timeline (Benny 09.07.): die Chronik als dritte Achse ──────────────────
// Alle Vorgänge (auch geschlossene) + lose Funde, jüngste Aktivität zuerst.
// Zeile: Ampelpunkt · Titel · [Objekt · Kategorie · zuletzt TT.MM.JJJJ].
// Tap springt in die Objekt-Akte (gleiches Muster wie der Schreibtisch).
function TimelineZeile({ eintrag, objektText, t, accent = null, aktiv = false, onSpringe }) {
  const kat = eintrag.kategorie ? (vorgangKategorie(eintrag.kategorie).kurz || "") : "Erfasst";
  const sub = [eintrag.nummer, objektText, kat, "zuletzt " + datumDe(eintrag.letzte)]
    .filter(Boolean).join(" · ");
  return (
    <div onClick={onSpringe}
      style={{ background: t.card,
        border: "1px solid " + (aktiv && accent ? accent : t.border),
        borderRadius: RAD.lg, padding: "11px 14px", cursor: "pointer",
        minWidth: 0, boxSizing: "border-box", width: "100%" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <AmpelPunkt farbe={eintrag.farbe}/>
        <div style={{ flex: 1, minWidth: 0, fontSize: FS.m, fontWeight: FW.bold,
          color: t.text, overflowWrap: "anywhere" }}>{eintrag.titel}</div>
        {eintrag.status === "geschlossen" ? (
          <StatusPille t={t} farbe={AMPEL_FARBEN.grau} text="Geschlossen"/>
        ) : null}
      </div>
      <div style={{ fontSize: FS.s, color: t.muted, marginTop: 3,
        paddingLeft: 17, overflowWrap: "anywhere" }}>{sub}</div>
    </div>
  );
}

// Timeline im KANONISCHEN Kalender-Baustein-Muster (§95-Optik, Benny 11.07.):
// Dringlichkeits-Buckets nach Ampel mit Großbuchstaben-Kopf + Zähler,
// linksbündige Zeilen, Antippen WÄHLT AUS (Akte als Detail — kein Sprung
// mehr zum Objekt). Lose Erfasst-Funde haben keine Akte → onSpringe
// (Objektliste) bleibt für sie der Weg.
const TIMELINE_BUCKETS = [
  { id: "rot",   label: "Überfällig" },
  { id: "gelb",  label: "Handlung fällig" },
  { id: "blau",  label: "Offene Entwürfe" },
  { id: "gruen", label: "Läuft" },
  { id: "grau",  label: "Ruht / erledigt" },
];
function TimelineBereich({ welt, ves, t, accent, onSpringe, offeneIdCtrl = null, onOeffneId = null }) {
  const eintraege = timelineEintraege(welt);
  const objektText = (id) => {
    if (!id) return "";
    const v = (ves || []).filter((x) => x && x.id === id)[0];
    return v ? (v.nr || v.name || "") : "";
  };
  if (eintraege.length === 0) {
    return leerText(t, "Noch keine Vorgänge.");
  }
  const gruppen = {};
  TIMELINE_BUCKETS.forEach((b) => { gruppen[b.id] = []; });
  eintraege.forEach((e) => {
    (gruppen[e.farbe] || gruppen.grau).push(e);
  });
  const tippe = (e) => {
    if (e.vorgang_id && onOeffneId) {
      onOeffneId(offeneIdCtrl === e.vorgang_id ? null : e.vorgang_id);
    } else if (onSpringe) {
      onSpringe(e);
    }
  };
  return (
    <div style={{ minWidth: 0 }}>
      {TIMELINE_BUCKETS.map((b) => {
        if (gruppen[b.id].length === 0) return null;
        return (
          <div key={b.id} style={{ marginBottom: 18 }}>
            <div style={{ fontSize: FS.s, fontWeight: FW.bold,
              color: b.id === "rot" ? AMPEL_FARBEN.rot : t.muted,
              textTransform: "uppercase", letterSpacing: "0.04em",
              marginBottom: 8, marginTop: 4 }}>
              {b.label}{" "}
              <span style={{ color: t.muted, fontWeight: FW.med }}>
                {"(" + gruppen[b.id].length + ")"}</span>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {gruppen[b.id].map((e, i) => (
                <TimelineZeile key={(e.vorgang_id || e.auftrag_id || "") + ":" + i}
                  eintrag={e} objektText={objektText(e.objekt_id)} t={t}
                  accent={accent} aktiv={!!e.vorgang_id && offeneIdCtrl === e.vorgang_id}
                  onSpringe={() => tippe(e)}/>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Demo-Hinweis: Seed-Daten gesammelt entfernen (Zwei-Klick) ───────────────
function DemoHinweis({ welt, t, accent, onWelt }) {
  const [confirm, setConfirm] = useState(false);
  const n = zaehleDemoDaten(welt);
  if (!onWelt || n === 0) return null;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8,
      padding: "6px 2px", marginBottom: 4 }}>
      <div style={{ flex: 1, fontSize: FS.s, color: t.muted }}>
        {n + " Demo-Datensätze (Beispiele)"}
      </div>
      <AktionsButton rolle="loeschen" variante="breit" t={t} accent={accent}
        confirm={confirm}
        text={confirm ? "Wirklich alle entfernen?" : "Demo-Daten entfernen"}
        onClick={() => {
          if (!confirm) { setConfirm(true); return; }
          onWelt((w) => weltDemoEntfernen(w));
          setConfirm(false);
        }}/>
    </div>
  );
}

export {
  AmpelPunkt, StatusPille, BausteinKarte, VorgangKarte, VorgangDetail, LoseAuftragKarte,
  VorgangsBereichFuerObjekt, VorgangsBereichFuerFirma,
  vorgangAnzahlFuerObjekt,
  SchreibtischBereich, schreibtischBadgeInfo, VorgangNeuOverlay, AuftragFlowAktionen,
  TimelineBereich, DemoHinweis,
  VORGANG_STATUS_LABEL, AUFTRAG_STATUS_LABEL,
};
