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
import { SegmentControl, TabLeiste, overlayBackdrop, overlayPanel, OverlayKopf, overlayBody } from "./components.jsx";
import {
  VORGANG_KATEGORIEN, ampelFarbe, ampelFarbeAuftrag, auftragLaeuft,
  hinweiseFuerVorgang, kontaktAnzeigename, schreibtischEintraege,
  vorgangKategorie, kategorieHatPhase,
  weltAuftragBeauftragen, weltAuftragStatus, weltAuftragAbnehmen,
  weltAuftragAbhaken, weltRechnungNeu, weltRechnungStatus,
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
        : ab.ergebnis === "mit_maengeln"
          ? "mit Mängeln (" + ab.maengel.length + ")" : "abgelehnt"));
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

// ── VorgangKarte ─────────────────────────────────────────────────────────────
// Karten-Klapp-Muster: der GESAMTE Kopf ist die Klick-Fläche (kein Chevron,
// kein Pfeil). Zu: Punkt + Titel + Status-Pille + Sub (Kategorie · seit).
// Auf: zusätzlich Handlungs-Hinweise (farbig) und der Verlauf.
function VorgangKarte({ vorgang, welt, kontakte, t, accent, offen, onToggle, onWelt = null, DatumFeld = null, ve = null, onFotoHinzu = null }) {
  const [schliessConfirm, setSchliessConfirm] = useState(false);
  const [loeschConfirm, setLoeschConfirm] = useState(false);
  const [aufgabeFormOffen, setAufgabeFormOffen] = useState(false);
  const [aufgabeTitel, setAufgabeTitel] = useState("");
  const [rechnungFormOffen, setRechnungFormOffen] = useState(false);
  const [rechnungBetrag, setRechnungBetrag] = useState("");
  const [ruhenFormOffen, setRuhenFormOffen] = useState(false);
  const [ruhenBis, setRuhenBis] = useState("");
  const [notizFormOffen, setNotizFormOffen] = useState(false);
  const [notizText, setNotizText] = useState("");
  const farbe = ampelFarbe(vorgang, welt);
  const kat = vorgangKategorie(vorgang.kategorie);
  const hinweise = offen ? hinweiseFuerVorgang(vorgang, welt) : [];
  const verlauf = offen ? baueVerlauf(vorgang, welt, kontakte) : [];
  const sub = [kat.label, "seit " + datumDe(vorgang.angelegt_am)]
    .filter(Boolean).join(" · ");
  const kannFlows = !!onWelt && vorgang.status !== "geschlossen";
  const auftraege = offen ? welt.auftraege.filter((a) => a.vorgang_id === vorgang.id) : [];
  const angebote = offen ? welt.angebote.filter((a) => a.vorgang_id === vorgang.id) : [];
  const rechnungen = offen ? welt.rechnungen.filter((r) => r.vorgang_id === vorgang.id) : [];
  const aufgabenOffen = offen ? welt.aufgaben.filter(
    (a) => a.vorgang_id === vorgang.id && a.status === "offen") : [];
  const firmen = (kontakte || []).filter((k) => k && k.typ === "firma");
  const brauchtAbnahme = kategorieHatPhase(vorgang.kategorie, "abnahme");
  const keinsGewaehlt = angebote.filter((a) => !!a.wurde_zu_auftrag_id).length === 0;

  const legeAufgabeAn = () => {
    if (!aufgabeTitel.trim()) return;
    onWelt((w) => weltAufgabeNeu(w, vorgang.id, { titel: aufgabeTitel.trim() }));
    setAufgabeTitel(""); setAufgabeFormOffen(false);
  };
  const erfasseRechnung = () => {
    const betrag = parseFloat(String(rechnungBetrag).replace(",", "."));
    if (isNaN(betrag)) return;
    const abgenommene = auftraege.filter((a) => a.status === "abgenommen");
    onWelt((w) => weltRechnungNeu(w, { vorgang_id: vorgang.id,
      auftrag_id: abgenommene.length === 1 ? abgenommene[0].id
        : (auftraege.length === 1 ? auftraege[0].id : null),
      betrag: betrag }));
    setRechnungBetrag(""); setRechnungFormOffen(false);
  };

  return (
    <div style={{ background: t.card,
      border: "1px solid " + (offen ? accent : t.border),
      borderRadius: RAD.lg, minWidth: 0, boxSizing: "border-box", width: "100%" }}>
      <div onClick={onToggle}
        style={{ padding: "12px 14px", cursor: "pointer" }}>
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
      {offen ? (
        <div style={{ padding: "0 14px 12px 14px" }}>
          {hinweise.length > 0 ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 6,
              marginBottom: 10 }}>
              {hinweise.map((h, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <AmpelPunkt farbe={h.farbe}/>
                  <div style={{ fontSize: FS.s, fontWeight: FW.med, color: t.text,
                    minWidth: 0, overflowWrap: "anywhere", flex: 1 }}>{h.text}</div>
                  {kannFlows && h.typ === "wiedervorlage" ? (
                    <button style={flowKnopf(t, accent, true)}
                      onClick={() => onWelt((w) => weltWiedervorlageAufheben(w, vorgang.id))}>
                      Wieder aufnehmen</button>
                  ) : null}
                </div>
              ))}
            </div>
          ) : null}
          {kannFlows && auftraege.length > 0 ? (
            <div>
              <div style={blockTitelStil(t)}>Aufträge</div>
              {auftraege.map((a) => (
                <AuftragFlowZeile key={a.id} auftrag={a}
                  brauchtAbnahme={brauchtAbnahme} firmen={firmen}
                  kontakte={kontakte} t={t} accent={accent}
                  onWelt={onWelt} DatumFeld={DatumFeld}
                  ve={ve} onFotoHinzu={onFotoHinzu}/>
              ))}
            </div>
          ) : null}
          {kannFlows && angebote.length > 0 ? (
            <div>
              <div style={blockTitelStil(t)}>Angebote</div>
              {angebote.map((a) => (
                <AngebotFlowZeile key={a.id} angebot={a} kontakte={kontakte}
                  keinsGewaehlt={keinsGewaehlt} t={t} accent={accent} onWelt={onWelt}/>
              ))}
            </div>
          ) : null}
          {kannFlows && (rechnungen.length > 0 || kategorieHatPhase(vorgang.kategorie, "rechnung")) ? (
            <div>
              <div style={blockTitelStil(t)}>Rechnungen</div>
              {rechnungen.map((r) => (
                <RechnungFlowZeile key={r.id} rechnung={r} t={t} accent={accent} onWelt={onWelt}/>
              ))}
              {rechnungFormOffen ? (
                <div style={flowZeileStil(t)}>
                  <label style={feldLabelStil(t)}>Betrag (€)</label>
                  <input value={rechnungBetrag} inputMode="decimal"
                    onChange={(e) => setRechnungBetrag(e.target.value)}
                    placeholder="z. B. 480"
                    style={Object.assign({}, selectStil(t, accent, !!rechnungBetrag), { marginBottom: 0 })}/>
                  <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
                    <button onClick={() => setRechnungFormOffen(false)}
                      style={flowKnopf(t, accent, false)}>Abbrechen</button>
                    <button onClick={erfasseRechnung}
                      style={flowKnopf(t, accent, true)}>Erfassen</button>
                  </div>
                </div>
              ) : (
                <button onClick={() => setRechnungFormOffen(true)}
                  style={flowKnopf(t, accent, false)}>+ Rechnung</button>
              )}
            </div>
          ) : null}
          {kannFlows ? (
            <div>
              <div style={blockTitelStil(t)}>Aufgaben</div>
              {aufgabenOffen.map((a) => (
                <AufgabeFlowZeile key={a.id} aufgabe={a} t={t} accent={accent} onWelt={onWelt}/>
              ))}
              {aufgabeFormOffen ? (
                <div style={flowZeileStil(t)}>
                  <input value={aufgabeTitel}
                    onChange={(e) => setAufgabeTitel(e.target.value)}
                    placeholder="Was ist zu tun?"
                    style={Object.assign({}, selectStil(t, accent, !!aufgabeTitel), { marginBottom: 0 })}/>
                  <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
                    <button onClick={() => setAufgabeFormOffen(false)}
                      style={flowKnopf(t, accent, false)}>Abbrechen</button>
                    <button onClick={legeAufgabeAn}
                      style={flowKnopf(t, accent, true)}>Anlegen</button>
                  </div>
                </div>
              ) : (
                <button onClick={() => setAufgabeFormOffen(true)}
                  style={flowKnopf(t, accent, false)}>+ Aufgabe</button>
              )}
            </div>
          ) : null}
          {kannFlows ? (
            <div style={{ marginTop: 8 }}>
              {notizFormOffen ? (
                <div style={flowZeileStil(t)}>
                  <textarea value={notizText}
                    onChange={(e) => setNotizText(e.target.value)} rows={2}
                    placeholder="Notiz in die Akte …"
                    style={Object.assign({}, selectStil(t, accent, !!notizText),
                      { resize: "vertical", minHeight: 44, marginBottom: 0 })}/>
                  <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
                    <button onClick={() => { setNotizFormOffen(false); setNotizText(""); }}
                      style={flowKnopf(t, accent, false)}>Abbrechen</button>
                    <button onClick={() => {
                        if (!notizText.trim()) return;
                        onWelt((w) => weltNotizNeu(w, vorgang.id, notizText.trim()));
                        setNotizText(""); setNotizFormOffen(false);
                      }} style={flowKnopf(t, accent, true)}>Speichern</button>
                  </div>
                </div>
              ) : (
                <button onClick={() => setNotizFormOffen(true)}
                  style={flowKnopf(t, accent, false)}>+ Notiz</button>
              )}
            </div>
          ) : null}
          <div style={{ borderTop: "1px solid " + t.border, paddingTop: 8,
            marginTop: 10, display: "flex", flexDirection: "column", gap: 5 }}>
            {verlauf.map((e, i) => (
              <div key={i} style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
                <span style={{ fontSize: FS.xs, color: t.muted, flexShrink: 0,
                  whiteSpace: "nowrap" }}>{datumDe(e.datum)}</span>
                <span style={{ fontSize: FS.s, color: t.text, minWidth: 0,
                  overflowWrap: "anywhere" }}>{e.text}</span>
              </div>
            ))}
          </div>
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
          {kannFlows && ruhenFormOffen ? (
            <div style={Object.assign({}, flowZeileStil(t), { marginTop: 8 })}>
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
          {onWelt ? (
            <div style={{ marginTop: 10, display: "flex", justifyContent: "flex-end",
              gap: 6, flexWrap: "wrap" }}>
              <button style={loeschConfirm
                  ? Object.assign({}, flowKnopf(t, accent, true),
                      { background: AMPEL_FARBEN.rot, color: "#fff", marginRight: "auto" })
                  : Object.assign({}, flowKnopf(t, accent, false),
                      { color: AMPEL_FARBEN.rot, borderColor: AMPEL_FARBEN.rot + "60", marginRight: "auto" })}
                onClick={() => {
                  if (!loeschConfirm) { setLoeschConfirm(true); return; }
                  onWelt((w) => weltVorgangLoeschen(w, vorgang.id));
                }}>
                {loeschConfirm ? "Wirklich löschen?" : "Löschen"}</button>
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
                <button style={schliessConfirm
                    ? Object.assign({}, flowKnopf(t, accent, true), { background: "#F59E0B", color: "#fff" })
                    : flowKnopf(t, accent, false)}
                  onClick={() => {
                    if (!schliessConfirm) { setSchliessConfirm(true); return; }
                    onWelt((w) => weltVorgangSchliessen(w, vorgang.id));
                    setSchliessConfirm(false);
                  }}>
                  {schliessConfirm ? "Wirklich schließen?" : "Vorgang schließen"}</button>
              )}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

// ── LoseAuftragKarte ─────────────────────────────────────────────────────────
// Vorgangsloser Auftrag (Begehungsfund): dieselbe Zeilen-Optik, ohne Klapp
// (es gibt noch keinen Verlauf — nur der festgehaltene Fund).
function LoseAuftragKarte({ auftrag, t, kontakte = [], accent = "#888", onWelt = null, DatumFeld = null,
  auswahlModus = false, ausgewaehlt = false, onAuswahl = null, ve = null, onFotoHinzu = null }) {
  const [loeschConfirm, setLoeschConfirm] = useState(false);
  const farbe = ampelFarbeAuftrag(auftrag);
  const firmen = (kontakte || []).filter((k) => k && k.typ === "firma");
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
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 4,
        marginBottom: onWelt && !auswahlModus ? 6 : 0 }}>
        <div style={{ flex: 1, fontSize: FS.s, color: t.muted }}>
          {"erfasst " + datumDe(auftrag.erfasst_am)}
        </div>
        {onWelt && !auswahlModus ? (
          <button style={loeschConfirm
              ? Object.assign({}, flowKnopf(t, accent, true), { background: AMPEL_FARBEN.rot, color: "#fff" })
              : Object.assign({}, flowKnopf(t, accent, false), { color: AMPEL_FARBEN.rot, borderColor: AMPEL_FARBEN.rot + "60" })}
            onClick={(e) => {
              e.stopPropagation();
              if (!loeschConfirm) { setLoeschConfirm(true); return; }
              onWelt((w) => weltAuftragLoeschen(w, auftrag.id));
            }}>{loeschConfirm ? "Wirklich löschen?" : "Löschen"}</button>
        ) : null}
      </div>
      {!auswahlModus ? (
        <div style={{ marginBottom: onWelt ? 6 : 0 }}>
          <AuftragFotoLeiste auftrag={auftrag} ve={ve} t={t} accent={accent}
            onFotoHinzu={onFotoHinzu}/>
        </div>
      ) : null}
      {onWelt && !auswahlModus ? (
        <AuftragFlowAktionen auftrag={auftrag} brauchtAbnahme={false}
          firmen={firmen} t={t} accent={accent}
          onWelt={onWelt} DatumFeld={DatumFeld}/>
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
function VorgangsBereichFuerObjekt({ veId, welt, kontakte, t, accent, initialOffeneId = null, onWelt = null, DatumFeld = null, ve = null, onFotoHinzu = null }) {
  const [offeneId, setOffeneId] = useState(initialOffeneId);
  // Kategorie-Tabs (Benny 09.07.): Alle | Wartung | Pflege | Instandhaltung |
  // Instandsetzung | Sanierung — Filter auf die Vorgänge des Objekts.
  const [katTab, setKatTab] = useState("alle");
  const [buendelModus, setBuendelModus] = useState(false);
  const [buendelIds, setBuendelIds] = useState([]);
  const [buendelZiel, setBuendelZiel] = useState(null); // null | "neu" | "bestehend"
  const [buendelTitel, setBuendelTitel] = useState("");
  const [buendelKategorie, setBuendelKategorie] = useState("pflege");
  const [buendelVorgangId, setBuendelVorgangId] = useState("");
  const alleVorgaenge = sortiereVorgaenge(
    welt.vorgaenge.filter((v) => v.objekt_id === veId), welt);
  const vorgaenge = katTab === "alle" ? alleVorgaenge
    : alleVorgaenge.filter((v) => vorgangKategorie(v.kategorie).id === katTab);
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
    setBuendelTitel(""); setBuendelVorgangId("");
  };
  const buendle = () => {
    if (buendelIds.length === 0 || !onWelt) return;
    if (buendelZiel === "neu") {
      if (!buendelTitel.trim()) return;
      onWelt((w) => weltAuftraegeBuendeln(w, buendelIds,
        { neu: { titel: buendelTitel.trim(), kategorie: buendelKategorie, objekt_id: veId } }));
    } else {
      if (!buendelVorgangId) return;
      onWelt((w) => weltAuftraegeBuendeln(w, buendelIds, { vorgang_id: buendelVorgangId }));
    }
    buendelReset();
  };
  return (
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
        <div style={{ display: "flex", alignItems: "center", gap: 8,
          margin: "6px 2px 0 2px" }}>
          <div style={{ flex: 1, fontSize: FS.xs, fontWeight: FW.bold, color: t.muted,
            textTransform: "uppercase", letterSpacing: 0.5 }}>
            Erfasst — noch keinem Vorgang zugeordnet</div>
          {onWelt && lose.length > 1 && !buendelModus ? (
            <button onClick={() => setBuendelModus(true)}
              style={flowKnopf(t, accent, false)}>Bündeln</button>
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
              <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
                <button onClick={() => setBuendelZiel(null)} style={flowKnopf(t, accent, false)}>Zurück</button>
                <button onClick={buendle} style={flowKnopf(t, accent, true)}>Bündeln</button>
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
}

// ── Detail-Inhalt Achse FIRMA ────────────────────────────────────────────────
// Alle Vorgänge, an denen die Firma über einen Auftrag ODER ein Angebot hängt
// — die Auftragshistorie einer Firma über alle Objekte hinweg.
function VorgangsBereichFuerFirma({ firmaId, welt, kontakte, t, accent, onWelt = null, DatumFeld = null }) {
  const [offeneId, setOffeneId] = useState(null);
  const idsAuftrag = welt.auftraege
    .filter((a) => a.firma_kontakt_id === firmaId && a.vorgang_id)
    .map((a) => a.vorgang_id);
  const idsAngebot = welt.angebote
    .filter((a) => a.firma_kontakt_id === firmaId && a.vorgang_id)
    .map((a) => a.vorgang_id);
  const ids = {};
  idsAuftrag.concat(idsAngebot).forEach((id) => { ids[id] = true; });
  const vorgaenge = sortiereVorgaenge(
    welt.vorgaenge.filter((v) => ids[v.id]), welt);
  const lose = welt.auftraege.filter(
    (a) => !a.vorgang_id && a.firma_kontakt_id === firmaId
      && a.status !== "abgenommen");
  if (vorgaenge.length === 0 && lose.length === 0) {
    return leerText(t, "Keine Vorgänge mit dieser Firma.");
  }
  return (
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
function AuftragFlowZeile({ auftrag, brauchtAbnahme, firmen, kontakte, t, accent, onWelt, DatumFeld, ve = null, onFotoHinzu = null }) {
  const firmaName = nameVon(kontakte, auftrag.firma_kontakt_id);
  const statusFarbe = AMPEL_FARBEN[ampelFarbeAuftrag(auftrag)];
  return (
    <div style={flowZeileStil(t)}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <div style={{ flex: 1, minWidth: 0, fontSize: FS.s, fontWeight: FW.med,
          color: t.text, overflowWrap: "anywhere" }}>
          {auftrag.beschreibung || "Auftrag"}
          {firmaName ? (
            <span style={{ color: t.muted }}>{" · " + firmaName}</span>
          ) : null}
          {auftrag.frist ? (
            <span style={{ color: t.muted }}>{" · bis " + datumDe(auftrag.frist)}</span>
          ) : null}
        </div>
        <StatusPille t={t} farbe={statusFarbe}
          text={AUFTRAG_STATUS_LABEL[auftrag.status] || auftrag.status}/>
      </div>
      <AuftragFotoLeiste auftrag={auftrag} ve={ve} t={t} accent={accent}
        onFotoHinzu={onFotoHinzu}/>
      <AuftragFlowAktionen auftrag={auftrag} brauchtAbnahme={brauchtAbnahme}
        firmen={firmen} t={t} accent={accent} onWelt={onWelt} DatumFeld={DatumFeld}/>
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
function AuftragFlowAktionen({ auftrag, brauchtAbnahme, firmen, t, accent, onWelt, DatumFeld }) {
  const [formOffen, setFormOffen] = useState(null); // "beauftragen" | "abnehmen" | null
  const [firmaId, setFirmaId] = useState(auftrag.firma_kontakt_id || "");
  const [frist, setFrist] = useState("");
  const [ergebnis, setErgebnis] = useState("angenommen");
  const [maengelText, setMaengelText] = useState("");
  const s = auftrag.status;

  const beauftrage = () => {
    onWelt((w) => weltAuftragBeauftragen(w, auftrag.id,
      { firma_kontakt_id: firmaId || null, frist: frist || null }));
    setFormOffen(null);
  };
  const nimmAb = () => {
    const maengel = maengelText.split("\n").map((x) => x.trim()).filter(Boolean);
    onWelt((w) => weltAuftragAbnehmen(w, auftrag.id,
      { ergebnis: ergebnis, maengel: maengel }));
    setFormOffen(null); setMaengelText("");
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
            <button onClick={() => { setErgebnis("angenommen"); setMaengelText(""); setFormOffen("abnehmen"); }}
              style={flowKnopf(t, accent, true)}>Abnehmen</button>
          ) : (
            <button onClick={() => onWelt((w) => weltAuftragAbhaken(w, auftrag.id))}
              style={flowKnopf(t, accent, true)}>Abhaken</button>
          )) : null}
        </div>
      ) : null}
      {formOffen === "beauftragen" ? (
        <div>
          <label style={feldLabelStil(t)}>Firma</label>
          <select value={firmaId} onChange={(e) => setFirmaId(e.target.value)}
            style={selectStil(t, accent, !!firmaId)}>
            <option value="">— noch offen —</option>
            {(firmen || []).map((f) => (
              <option key={f.id} value={f.id}>{f.name || ""}</option>
            ))}
          </select>
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
          {ergebnis !== "angenommen" ? (
            <div>
              <label style={feldLabelStil(t)}>Mängel (eine Zeile je Mangel)</label>
              <textarea value={maengelText}
                onChange={(e) => setMaengelText(e.target.value)} rows={2}
                placeholder={"z. B. Pumpe läuft laut"}
                style={Object.assign({}, selectStil(t, accent, !!maengelText),
                  { resize: "vertical", minHeight: 44 })}/>
            </div>
          ) : null}
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

function RechnungFlowZeile({ rechnung, t, accent, onWelt }) {
  const s = rechnung.status;
  const label = { eingegangen: "Eingegangen", in_pruefung: "In Prüfung",
    freigegeben: "Freigegeben", bezahlt: "Bezahlt" }[s] || s;
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
      {(s === "eingegangen" || s === "in_pruefung") ? (
        <div style={{ display: "flex", gap: 6 }}>
          <button onClick={() => onWelt((w) => weltRechnungStatus(w, rechnung.id, "freigegeben"))}
            style={flowKnopf(t, accent, true)}>Freigeben</button>
        </div>
      ) : null}
      {s === "freigegeben" ? (
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
  const [confirm, setConfirm] = useState(false);
  const wer = nameVon(kontakte, angebot.firma_kontakt_id) || "ohne Firma";
  return (
    <div style={flowZeileStil(t)}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <div style={{ flex: 1, minWidth: 0, fontSize: FS.s, fontWeight: FW.med,
          color: t.text, overflowWrap: "anywhere" }}>
          {wer + (angebot.preis != null ? " · " + eur(angebot.preis) : "")}
        </div>
        {angebot.wurde_zu_auftrag_id ? (
          <StatusPille t={t} farbe={AMPEL_FARBEN.gruen} text="Beauftragt"/>
        ) : keinsGewaehlt ? (
          <button style={flowKnopf(t, accent, confirm)}
            onClick={() => {
              if (!confirm) { setConfirm(true); return; }
              onWelt((w) => weltAngebotBeauftragen(w, angebot.id, {}));
              setConfirm(false);
            }}>{confirm ? "Wirklich beauftragen?" : "Beauftragen"}</button>
        ) : null}
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
  onErfasseAuftrag, Inp, kontakteAlle = [] }) {
  const [modus, setModus] = useState("vorgang"); // "vorgang" | "auftrag"
  // Vorgang-Felder
  const [titel, setTitel] = useState("");
  const [kategorie, setKategorie] = useState("instandhaltung");
  const [einheitId, setEinheitId] = useState("");
  const [melderId, setMelderId] = useState(""); // "" = ich / die Verwaltung
  const [notiz, setNotiz] = useState("");
  // Auftrag-Felder + Begehungszähler
  const [beschreibung, setBeschreibung] = useState("");
  const [erfasstZahl, setErfasstZahl] = useState(0);
  const [fehler, setFehler] = useState(false);

  const einheiten = (ve && Array.isArray(ve.einheiten)) ? ve.einheiten : [];

  const legeVorgangAn = () => {
    if (!titel.trim()) { setFehler(true); return; }
    onAnlegenVorgang({
      titel: titel.trim(), kategorie: kategorie,
      einheit_id: einheitId || null, notiz: notiz.trim(),
      melder_kontakt_id: melderId || null,
    });
    onClose();
  };
  const erfasseAuftrag = (weiter) => {
    if (!beschreibung.trim()) { setFehler(true); return; }
    onErfasseAuftrag({ beschreibung: beschreibung.trim() });
    if (weiter) {
      setBeschreibung(""); setFehler(false);
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
          <div style={{ marginBottom: 12 }}>
            <SegmentControl t={t} accent={accent} voll={false}
              options={[{ id: "vorgang", label: "Vorgang" },
                { id: "auftrag", label: "Auftrag erfassen" }]}
              value={modus}
              onChange={(m) => { setModus(m); setFehler(false); }}/>
          </div>
          {modus === "vorgang" ? (
            <div>
              <Inp t={t} accent={accent} label="Titel" required
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
              {einheiten.length > 0 ? (
                <div>
                  <label style={feldLabelStil(t)}>Einheit (optional)</label>
                  <select value={einheitId}
                    onChange={(e) => setEinheitId(e.target.value)}
                    style={selectStil(t, accent, !!einheitId)}>
                    <option value="">Gemeinschaft / keine</option>
                    {einheiten.map((e) => (
                      <option key={e.id} value={e.id}>
                        {e.bezeichnung || e.nr || e.einheitLabel || String(e.id)}
                      </option>
                    ))}
                  </select>
                </div>
              ) : null}
              <label style={feldLabelStil(t)}>Gemeldet von</label>
              <select value={melderId}
                onChange={(e) => setMelderId(e.target.value)}
                style={selectStil(t, accent, !!melderId)}>
                <option value="">Ich / die Verwaltung</option>
                {(kontakteAlle || []).map((k) => (
                  <option key={k.id} value={k.id}>{kontaktAnzeigename(k)}</option>
                ))}
              </select>
              <label style={feldLabelStil(t)}>Erste Notiz (optional)</label>
              <textarea value={notiz} onChange={(e) => setNotiz(e.target.value)}
                rows={3} placeholder="Was wurde gemeldet?"
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
                am Objekt und am Schreibtisch. Für die Begehung: „Speichern +
                weiter" erfasst Punkt für Punkt.
              </div>
              <Inp t={t} accent={accent} label="Was ist Sache?" required
                value={beschreibung} onChange={setBeschreibung}
                invalid={fehler && !beschreibung.trim()}
                placeholder="z. B. Lampe 2. OG defekt"/>
              {erfasstZahl > 0 ? (
                <div style={{ fontSize: FS.s, fontWeight: FW.bold, color: accent,
                  marginBottom: 8 }}>
                  {erfasstZahl === 1 ? "1 Punkt erfasst" : erfasstZahl + " Punkte erfasst"}
                </div>
              ) : null}
              <div style={{ display: "flex", gap: 8, justifyContent: "flex-end",
                flexWrap: "wrap", marginTop: 4 }}>
                <button onClick={onClose} style={knopfStil(accent, false, t)}>
                  {erfasstZahl > 0 ? "Fertig" : "Abbrechen"}
                </button>
                <button onClick={() => erfasseAuftrag(true)}
                  style={knopfStil(accent, false, t)}>Speichern + weiter</button>
                <button onClick={() => erfasseAuftrag(false)}
                  style={knopfStil(accent, true, t)}>Speichern</button>
              </div>
            </div>
          )}
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
function TimelineZeile({ eintrag, objektText, t, onSpringe }) {
  const kat = eintrag.kategorie ? (vorgangKategorie(eintrag.kategorie).kurz || "") : "Erfasst";
  const sub = [objektText, kat, "zuletzt " + datumDe(eintrag.letzte)]
    .filter(Boolean).join(" · ");
  return (
    <div onClick={onSpringe}
      style={{ background: t.card, border: "1px solid " + t.border,
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

function TimelineBereich({ welt, ves, t, accent, onSpringe }) {
  const eintraege = timelineEintraege(welt);
  const objektText = (id) => {
    if (!id) return "";
    const v = (ves || []).filter((x) => x && x.id === id)[0];
    return v ? (v.nr || v.name || "") : "";
  };
  if (eintraege.length === 0) {
    return leerText(t, "Noch keine Vorgänge.");
  }
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {eintraege.map((e, i) => (
        <TimelineZeile key={(e.vorgang_id || e.auftrag_id || "") + ":" + i}
          eintrag={e} objektText={objektText(e.objekt_id)} t={t}
          onSpringe={() => onSpringe && onSpringe(e)}/>
      ))}
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
      <button style={confirm
          ? Object.assign({}, flowKnopf(t, accent, true), { background: AMPEL_FARBEN.rot, color: "#fff" })
          : flowKnopf(t, accent, false)}
        onClick={() => {
          if (!confirm) { setConfirm(true); return; }
          onWelt((w) => weltDemoEntfernen(w));
          setConfirm(false);
        }}>{confirm ? "Wirklich alle entfernen?" : "Demo-Daten entfernen"}</button>
    </div>
  );
}

export {
  AmpelPunkt, StatusPille, VorgangKarte, LoseAuftragKarte,
  VorgangsBereichFuerObjekt, VorgangsBereichFuerFirma,
  vorgangAnzahlFuerObjekt,
  SchreibtischBereich, schreibtischBadgeInfo, VorgangNeuOverlay, AuftragFlowAktionen,
  TimelineBereich, DemoHinweis,
  VORGANG_STATUS_LABEL, AUFTRAG_STATUS_LABEL,
};
