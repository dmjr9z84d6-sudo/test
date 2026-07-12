// ═══════════════════════════════════════════════════════════════════════════
// etv.jsx — UI der ETV-Welt (ETV_Konzept_AllesDa_11_07_2026_03)
// ─────────────────────────────────────────────────────────────────────────────
// Feature-Modul wie vorgang.jsx: Bausteine für den ETV-Screen (allesda_merged
// ist nur Konsument). Datenlogik (Fabriken, Fristen, Auszählung, Nahtstelle
// zu den Vorgängen) lebt KOMPLETT in datenmodell.js — hier nur Darstellung.
//
// Struktur (Konzept §2b): ObjektListeMitDetail liefert das Objekt-Detail;
// darin die Versammlungsliste (aktiv + Archiv). Klick öffnet die ETV-AKTE:
// Kopf (Art + Datum + StatusPille) + TabLeiste (§97) mit vier Tabs:
//   Übersicht     · errechneter Kopf (Phasen, Ladungsfrist-Ampel, Beschluss-
//                   fähigkeit, EIN nächster Schritt) + Stammdaten + Anwesenheit
//   Tagesordnung  · TOP-Karten (BausteinKarte-Accordion), wachsen per
//                   Baustein-Katalog (Wortlaut·Anlage·Abstimmung·Aufgabe·Notiz)
//   TE            · Nachschlage-Backup = TERegisterAnsicht (§67, EIN Baustein)
//   Beschlüsse    · gefasste dieser Versammlung + besondere (ist_besonders)
// ═══════════════════════════════════════════════════════════════════════════
import React, { useState } from "react";
import { AMPEL_FARBEN, FS, FW, RAD, getContrastColor } from "./constants.js";
import { datumDe, isoHeute } from "./utils-basis.js";
import { DatumFeld, Inp, KontaktPickerMitAllen, SegmentControl, TabLeiste, Toggle } from "./components.jsx";
import { AktionsButton } from "./kontakte-modul.jsx";
import { BausteinKarte, StatusPille } from "./vorgang.jsx";
import { TERegisterAnsicht, alleEinheitenVonVe } from "./objektansicht.jsx";
import { gemeinschaftName, istEigentuemergemeinschaft, quoteAnteil, quoteLabel } from "./liegenschaft.jsx";
import { druckeHtml } from "./listen-tools.jsx";
import {
  ETV_ARTEN, ETV_DURCHFUEHRUNG, ETV_STATUS_KETTE, ETV_STATUS_LABEL,
  TOP_BAUSTEINE, eigStatus, kontaktAnzeigename,
  ladungsfristInfo, versammlungenFuerObjekt, topsFuerVersammlung,
  anwesenheitenFuer, beschlussfaehigkeitInfo, etvNaechsterSchritt,
  neueAnwesenheit, neueVersammlung,
  weltVersammlungPatch, weltVersammlungLoeschen,
  weltTopNeu, weltTopPatch, weltTopLoeschen, weltTopVerschieben,
  weltTopAbstimmen, weltBeschlussPatch, weltAnwesenheitenSetzen,
} from "./datenmodell.js";

// ── Kleine Helfer (reine Anzeige) ───────────────────────────────────────────
const artLabel = (id) => {
  const a = ETV_ARTEN.find((x) => x.id === id);
  return a ? a.label : id;
};
const STATUS_FARBE = {
  geplant: "#6B7280", eingeladen: "#3B82F6", laeuft: "#F59E0B",
  protokolliert: "#8B5CF6", abgeschlossen: "#10B981",
};
const zahl = (v) => Number(String(v == null ? "" : v).replace(",", ".")) || 0;
const meaStr = (v) => String(Math.round(zahl(v) * 1000) / 1000).replace(".", ",");
const esc = (s) => String(s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

// Anwesenheits-Zeilen aus der Eigentümer-Struktur ERZEUGEN (Listengenerator-
// Logik §62.5: MEA quotengewichtet, Gemeinschaft = EIN Subjekt).
function etvAnwesenheitZeilen(ve, versammlungId) {
  const rows = [];
  alleEinheitenVonVe(ve).forEach((e) => {
    if (!e) return;
    const meaRoh = zahl(e.mea);
    if (istEigentuemergemeinschaft(e)) {
      rows.push(neueAnwesenheit({ versammlung_id: versammlungId,
        einheit_id: e.id != null ? e.id : null, einheit_nr: e.nr || "",
        name: gemeinschaftName(e), mea: meaRoh }));
      return;
    }
    const aktive = (e.eigentuemer || []).filter((p) => p && eigStatus(p) === "aktiv");
    aktive.forEach((p) => {
      const anteil = quoteAnteil(p, e.eigentuemer);
      const mea = meaRoh > 0 ? Math.round(meaRoh * anteil * 1000) / 1000 : 0;
      const zusatz = aktive.length > 1 ? " (" + quoteLabel(p, e.eigentuemer) + ")" : "";
      rows.push(neueAnwesenheit({ versammlung_id: versammlungId,
        kontakt_id: p.kontaktId != null ? p.kontaktId : null,
        einheit_id: e.id != null ? e.id : null, einheit_nr: e.nr || "",
        name: (p.name || "") + zusatz, mea: mea }));
    });
  });
  return rows;
}

// ── EtvPhasenLeiste — Fortschritt der Versammlung (Vorgang-Optik) ───────────
function EtvPhasenLeiste({ versammlung, t, accent }) {
  const istIdx = ETV_STATUS_KETTE.indexOf(versammlung.status);
  return (
    <div style={{ margin: "8px 0 2px 0" }}>
      <div style={{ display: "flex", alignItems: "center" }}>
        {ETV_STATUS_KETTE.map((p, i) => {
          const erledigt = istIdx >= 0 && i < istIdx;
          const aktiv = i === istIdx;
          return (
            <React.Fragment key={p}>
              {i > 0 ? (
                <div style={{ flex: 1, height: 2, minWidth: 6,
                  background: erledigt || aktiv ? accent : t.border }}/>
              ) : null}
              <div title={ETV_STATUS_LABEL[p] || p} style={{
                width: aktiv ? 12 : 8, height: aktiv ? 12 : 8,
                borderRadius: RAD.pill, flexShrink: 0, boxSizing: "border-box",
                background: erledigt || aktiv ? accent : t.card,
                border: "2px solid " + (erledigt || aktiv ? accent : t.border) }}/>
            </React.Fragment>
          );
        })}
      </div>
      <div style={{ fontSize: FS.xs, fontWeight: FW.bold, color: accent, marginTop: 4 }}>
        {(ETV_STATUS_LABEL[versammlung.status] || versammlung.status)
          + (istIdx >= 0 ? " · Schritt " + (istIdx + 1) + " von " + ETV_STATUS_KETTE.length : "")}
      </div>
    </div>
  );
}

// ── AmpelZeile — Klartext mit Punkt (Ladungsfrist etc.) ─────────────────────
function AmpelZeile({ status, text, t }) {
  if (!status || !text) return null;
  const farbe = AMPEL_FARBEN[status] || t.muted;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 7, marginTop: 6 }}>
      <div style={{ width: 9, height: 9, borderRadius: RAD.pill, flexShrink: 0,
        background: farbe }}/>
      <div style={{ fontSize: FS.s, color: t.text }}>{text}</div>
    </div>
  );
}

// ── VersammlungNeuForm — Anlegen (Art · Termin · Ort · Durchführung) ────────
function VersammlungNeuForm({ ve, kontakte, t, accent, onAnlegen, onAbbrechen }) {
  const [vArt, setVArt] = useState("ordentlich");
  const [datum, setDatum] = useState("");
  const [uhrzeit, setUhrzeit] = useState("");
  const [ort, setOrt] = useState("");
  const [durch, setDurch] = useState("praesenz");
  const [leiterId, setLeiterId] = useState("");
  const [protokollId, setProtokollId] = useState("");
  const istUmlauf = vArt === "umlauf";
  const stamm = (ve && ve.etvStamm) || {};
  const legeAn = () => {
    onAnlegen({
      objekt_id: ve.id, versammlung_art: vArt,
      art: istUmlauf ? "online" : durch,
      datum: datum || null, uhrzeit: istUmlauf ? "" : uhrzeit,
      ort: istUmlauf ? "" : ort,
      stimmprinzip: stamm.abstimmung || "MEA",
      wirtschaftsjahr: stamm.wirtschaftsjahr || "",
      leiter_kontakt_id: leiterId || null,
      protokollfuehrer_kontakt_id: protokollId || null,
    });
  };
  return (
    <div style={{ background: t.surface, border: "1px solid " + accent + "50",
      borderRadius: RAD.md, padding: 12, display: "flex", flexDirection: "column", gap: 10 }}>
      <div style={{ fontSize: FS.m, fontWeight: FW.bold, color: t.text }}>Neue Versammlung</div>
      <SegmentControl t={t} accent={accent} value={vArt} onChange={setVArt}
        options={ETV_ARTEN.map((a) => ({ id: a.id, label: a.label }))}/>
      <DatumFeld t={t} accent={accent} iso
        label={istUmlauf ? "Stichtag (Rücklauf bis)" : "Termin"}
        value={datum} onChange={setDatum} defaultHeute={false}/>
      {!istUmlauf ? (
        <>
          <Inp t={t} accent={accent} label="Uhrzeit" value={uhrzeit}
            onChange={setUhrzeit} placeholder="z. B. 18:30"/>
          <Inp t={t} accent={accent} label="Ort" value={ort}
            onChange={setOrt} placeholder="z. B. Gemeindesaal, Musterstr. 1"/>
          <SegmentControl t={t} accent={accent} value={durch} onChange={setDurch}
            options={ETV_DURCHFUEHRUNG.map((a) => ({ id: a.id, label: a.label }))}/>
        </>
      ) : (
        <div style={{ fontSize: FS.xs, color: t.muted }}>
          Umlaufbeschluss: dieselbe Mechanik wie eine Versammlung — abgestimmt
          wird schriftlich. Auszählung regulär mit Allstimmigkeit (§23 III WEG).
        </div>
      )}
      <KontaktPickerMitAllen t={t} accent={accent}
        kontakteObjekt={null} kontakteAlle={kontakte}
        label="Versammlungsleiter" value={leiterId || null}
        onChange={(id) => setLeiterId(id || "")}/>
      <KontaktPickerMitAllen t={t} accent={accent}
        kontakteObjekt={null} kontakteAlle={kontakte}
        label="Protokollführer" value={protokollId || null}
        onChange={(id) => setProtokollId(id || "")}/>
      <div style={{ display: "flex", gap: 8 }}>
        <AktionsButton rolle="bestaetigen" variante="breit" t={t} accent={accent}
          onClick={legeAn} text="Anlegen"/>
        <AktionsButton rolle="abbrechen" variante="breit" t={t}
          onClick={onAbbrechen} text="Abbrechen"/>
      </div>
    </div>
  );
}

// ── VersammlungZeile — Listenzeile (aktive Liste + Archiv) ──────────────────
function VersammlungZeile({ versammlung, welt, t, accent, onOeffnen }) {
  const frist = ladungsfristInfo(versammlung);
  const tops = topsFuerVersammlung(welt, versammlung.id);
  const sub = [
    versammlung.datum ? datumDe(versammlung.datum) : "Termin offen",
    versammlung.uhrzeit || null,
    versammlung.ort || null,
    tops.length > 0 ? tops.length + " TOP" + (tops.length > 1 ? "s" : "") : null,
  ].filter(Boolean).join(" · ");
  return (
    <div onClick={onOeffnen} style={{ background: t.card,
      border: "1px solid " + t.border, borderRadius: RAD.lg,
      padding: "11px 13px", cursor: "pointer", minWidth: 0 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        {frist.status ? (
          <div title={frist.text} style={{ width: 9, height: 9, flexShrink: 0,
            borderRadius: RAD.pill, background: AMPEL_FARBEN[frist.status] || t.muted }}/>
        ) : null}
        <div style={{ flex: 1, minWidth: 0, fontSize: FS.m, fontWeight: FW.bold,
          color: t.text, overflowWrap: "anywhere" }}>
          {artLabel(versammlung.versammlung_art)}
        </div>
        <StatusPille t={t} farbe={STATUS_FARBE[versammlung.status] || t.muted}
          text={ETV_STATUS_LABEL[versammlung.status] || versammlung.status}/>
      </div>
      <div style={{ fontSize: FS.s, color: t.muted, marginTop: 3 }}>{sub}</div>
    </div>
  );
}

// ── Tab 1 · ÜBERSICHT — errechneter Kopf + Stammdaten + Anwesenheit ─────────
function EtvUebersichtTab({ versammlung, ve, welt, onWelt, kontakte, t, accent }) {
  const [offen, setOffen] = useState("stand");
  const [editStamm, setEditStamm] = useState(false);
  const [loeschStufe, setLoeschStufe] = useState(false);
  const tops = topsFuerVersammlung(welt, versammlung.id);
  const anw = anwesenheitenFuer(welt, versammlung.id);
  const frist = ladungsfristInfo(versammlung);
  const stamm = (ve && ve.etvStamm) || {};
  const bf = beschlussfaehigkeitInfo(anw, stamm.gesamtanteile);
  const schritte = etvNaechsterSchritt(versammlung, tops, anw);
  const abgestimmt = tops.filter((tp) => tp.beschluss_noetig && tp.beschluss_id).length;
  const abstNoetig = tops.filter((tp) => tp.beschluss_noetig).length;
  const patch = (p) => onWelt((w) => weltVersammlungPatch(w, versammlung.id, p));
  const statusIdx = ETV_STATUS_KETTE.indexOf(versammlung.status);
  const istUmlauf = versammlung.versammlung_art === "umlauf";
  const toggle = (id) => setOffen(offen === id ? null : id);

  // Anwesenheit erzeugen/aktualisieren.
  const anwErzeugen = () => {
    onWelt((w) => weltAnwesenheitenSetzen(w, versammlung.id,
      etvAnwesenheitZeilen(ve, versammlung.id)));
  };
  const anwPatch = (id, p) => {
    onWelt((w) => Object.assign({}, w, {
      anwesenheiten: (w.anwesenheiten || []).map((a) =>
        a.id === id ? Object.assign({}, a, p) : a),
    }));
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {/* Stand-Karte: alles ERRECHNET (Konzept: Abgeleitetes schlägt Gespeichertes) */}
      <BausteinKarte t={t} accent={accent} titel="Stand"
        offen={offen === "stand"} onToggle={() => toggle("stand")}
        sub={ETV_STATUS_LABEL[versammlung.status]}>
        <EtvPhasenLeiste versammlung={versammlung} t={t} accent={accent}/>
        <AmpelZeile status={frist.status} text={frist.text} t={t}/>
        {anw.length > 0 ? (
          <AmpelZeile status="gruen" text={bf.text} t={t}/>
        ) : null}
        {abstNoetig > 0 ? (
          <AmpelZeile status={abgestimmt >= abstNoetig ? "gruen" : "gelb"}
            text={"Abstimmungen: " + abgestimmt + " von " + abstNoetig} t={t}/>
        ) : null}
        {schritte.length > 0 ? (
          <div style={{ marginTop: 10 }}>
            <div style={{ fontSize: FS.xs, fontWeight: FW.bold, color: t.muted,
              textTransform: "uppercase", letterSpacing: 0.4 }}>Nächster Schritt</div>
            <div style={{ fontSize: FS.m, fontWeight: FW.bold, color: accent, marginTop: 2 }}>
              {schritte[0]}
              {schritte.length > 1 ? (
                <span style={{ fontSize: FS.xs, fontWeight: FW.medium, color: t.muted,
                  marginLeft: 7 }}>+{schritte.length - 1} weitere</span>
              ) : null}
            </div>
          </div>
        ) : null}
        {/* Phasen-Aktionen */}
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 12 }}>
          {versammlung.status === "geplant" ? (
            <AktionsButton rolle="bestaetigen" variante="breit" t={t} accent={accent}
              onClick={() => patch({ ladung_versendet_am: isoHeute(), status: "eingeladen" })}
              text={(istUmlauf ? "Umlauf versendet" : "Einladung versendet") + " (heute)"}/>
          ) : null}
          {versammlung.status === "eingeladen" ? (
            <AktionsButton rolle="bestaetigen" variante="breit" t={t} accent={accent}
              onClick={() => patch({ status: "laeuft" })}
              text={istUmlauf ? "Rücklauf-Erfassung starten" : "Versammlung läuft"}/>
          ) : null}
          {versammlung.status === "laeuft" ? (
            <AktionsButton rolle="bestaetigen" variante="breit" t={t} accent={accent}
              onClick={() => patch({ status: "protokolliert" })}
              text="Protokoll erstellt"/>
          ) : null}
          {versammlung.status === "protokolliert" ? (
            <AktionsButton rolle="bestaetigen" variante="breit" t={t} accent={accent}
              onClick={() => patch({ status: "abgeschlossen" })}
              text="Versammlung abschließen"/>
          ) : null}
          {statusIdx > 0 ? (
            <AktionsButton rolle="abbrechen" variante="breit" t={t}
              onClick={() => patch({ status: ETV_STATUS_KETTE[statusIdx - 1] })}
              text="Schritt zurück"/>
          ) : null}
        </div>
      </BausteinKarte>

      {/* Stammdaten-Karte */}
      <BausteinKarte t={t} accent={accent} titel="Stammdaten"
        offen={offen === "stamm"} onToggle={() => toggle("stamm")}
        sub={versammlung.datum ? datumDe(versammlung.datum) : "Termin offen"}>
        {!editStamm ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
            {[
              ["Art", artLabel(versammlung.versammlung_art)],
              ["Durchführung", istUmlauf ? "schriftlich (Umlauf)"
                : ((ETV_DURCHFUEHRUNG.find((x) => x.id === versammlung.art) || {}).label || versammlung.art)],
              [istUmlauf ? "Stichtag" : "Termin",
                (versammlung.datum ? datumDe(versammlung.datum) : "—")
                + (versammlung.uhrzeit ? " · " + versammlung.uhrzeit : "")],
              ["Ort", versammlung.ort || (istUmlauf ? "—" : "—")],
              ["Einladung versendet", versammlung.ladung_versendet_am
                ? datumDe(versammlung.ladung_versendet_am) : "noch nicht"],
              ["Stimmprinzip", versammlung.stimmprinzip || "MEA"],
              ["Wirtschaftsjahr", versammlung.wirtschaftsjahr || "Kalenderjahr"],
              ["Versammlungsleiter", versammlung.leiter_kontakt_id
                ? kontaktAnzeigename(kontakte, versammlung.leiter_kontakt_id) : "—"],
              ["Protokollführer", versammlung.protokollfuehrer_kontakt_id
                ? kontaktAnzeigename(kontakte, versammlung.protokollfuehrer_kontakt_id) : "—"],
            ].map((z, i) => (
              <div key={i} style={{ display: "flex", gap: 8, fontSize: FS.s }}>
                <div style={{ width: 150, flexShrink: 0, color: t.muted }}>{z[0]}</div>
                <div style={{ flex: 1, minWidth: 0, color: t.text, overflowWrap: "anywhere" }}>{z[1]}</div>
              </div>
            ))}
            <div style={{ marginTop: 6 }}>
              <AktionsButton rolle="bestaetigen" variante="breit" t={t} accent={accent}
                onClick={() => setEditStamm(true)} text="Bearbeiten"/>
            </div>
          </div>
        ) : (
          <EtvStammEdit versammlung={versammlung} kontakte={kontakte} ve={ve}
            t={t} accent={accent}
            onSave={(p) => { patch(p); setEditStamm(false); }}
            onAbbruch={() => setEditStamm(false)}/>
        )}
      </BausteinKarte>

      {/* Anwesenheit-Karte (Präsenz-Erfassung §4.1 / Umlauf-Rücklauf) */}
      <BausteinKarte t={t} accent={accent}
        titel={istUmlauf ? "Rücklauf (schriftlich)" : "Anwesenheit"}
        anzahl={anw.length > 0 ? anw.filter((a) => a.anwesend || a.vertreten_durch).length + "/" + anw.length : null}
        offen={offen === "anw"} onToggle={() => toggle("anw")}
        sub={anw.length > 0 ? bf.text : "noch nicht erfasst"}>
        {anw.length === 0 ? (
          <div>
            <div style={{ fontSize: FS.s, color: t.muted, marginBottom: 8 }}>
              Erzeugt die Zeilen aus den Eigentümern des Objekts — MEA
              quotengewichtet, Gemeinschaften als ein Stimmrecht (§62.5).
            </div>
            <AktionsButton rolle="bestaetigen" variante="breit" t={t} accent={accent}
              onClick={anwErzeugen} text={istUmlauf ? "Rücklauf-Liste erzeugen" : "Anwesenheitsliste erzeugen"}/>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            {anw.map((a) => (
              <div key={a.id} style={{ display: "flex", alignItems: "center", gap: 8,
                padding: "5px 0", borderBottom: "1px solid " + t.border }}>
                <Toggle value={!!a.anwesend} color={accent}
                  onChange={(v) => anwPatch(a.id, { anwesend: v,
                    zugang: istUmlauf ? "schriftlich" : "praesenz" })}/>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: FS.s, fontWeight: FW.bold, color: t.text,
                    overflowWrap: "anywhere" }}>{a.name || "—"}</div>
                  <div style={{ fontSize: FS.xs, color: t.muted }}>
                    {(a.einheit_nr ? "Einheit " + a.einheit_nr + " · " : "") + meaStr(a.mea) + " MEA"}
                  </div>
                </div>
                <input value={a.vertreten_durch || ""}
                  onChange={(ev) => anwPatch(a.id, { vertreten_durch: ev.target.value })}
                  placeholder="vertreten durch…"
                  style={{ width: 130, flexShrink: 0, fontSize: 16, padding: "5px 8px",
                    borderRadius: RAD.sm, border: "1px solid " + t.border,
                    background: t.card, color: t.text, boxSizing: "border-box" }}/>
              </div>
            ))}
            <div style={{ fontSize: FS.s, fontWeight: FW.bold, color: accent, marginTop: 6 }}>
              {bf.text}
            </div>
            <div style={{ marginTop: 4 }}>
              <AktionsButton rolle="abbrechen" variante="breit" t={t}
                onClick={anwErzeugen} text="Liste neu aus Eigentümern erzeugen"/>
            </div>
          </div>
        )}
      </BausteinKarte>

      {/* Fuß-Aktionen: Protokoll · Archiv · Löschen */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 4 }}>
        <AktionsButton rolle="bestaetigen" variante="breit" t={t} accent={accent}
          onClick={() => druckeEtvProtokoll(versammlung, ve, welt, kontakte)}
          text="Protokoll drucken"/>
        {versammlung.status === "abgeschlossen" ? (
          <AktionsButton rolle={versammlung.archiviert ? "abbrechen" : "bestaetigen"}
            variante="breit" t={t} accent={accent}
            onClick={() => patch({ archiviert: !versammlung.archiviert })}
            text={versammlung.archiviert ? "Aus dem Archiv holen" : "Ins Archiv legen"}/>
        ) : null}
        {!loeschStufe ? (
          <AktionsButton rolle="loeschen" variante="breit" t={t}
            onClick={() => setLoeschStufe(true)} text="Versammlung löschen"/>
        ) : (
          <AktionsButton rolle="loeschen" variante="breit" t={t} confirm
            onClick={() => onWelt((w) => weltVersammlungLoeschen(w, versammlung.id))}
            text="Wirklich löschen? (Beschlüsse bleiben)"/>
        )}
      </div>
    </div>
  );
}

// Stammdaten-Bearbeitung (inline, Felder beim Öffnen frisch — §12.1-Muster).
function EtvStammEdit({ versammlung, kontakte, ve, t, accent, onSave, onAbbruch }) {
  const istUmlauf = versammlung.versammlung_art === "umlauf";
  const [vArt, setVArt] = useState(versammlung.versammlung_art);
  const [datum, setDatum] = useState(versammlung.datum || "");
  const [uhrzeit, setUhrzeit] = useState(versammlung.uhrzeit || "");
  const [ort, setOrt] = useState(versammlung.ort || "");
  const [durch, setDurch] = useState(versammlung.art || "praesenz");
  const [ladung, setLadung] = useState(versammlung.ladung_versendet_am || "");
  const [leiterId, setLeiterId] = useState(versammlung.leiter_kontakt_id || "");
  const [protokollId, setProtokollId] = useState(versammlung.protokollfuehrer_kontakt_id || "");
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <SegmentControl t={t} accent={accent} value={vArt} onChange={setVArt}
        options={ETV_ARTEN.map((a) => ({ id: a.id, label: a.label }))}/>
      <DatumFeld t={t} accent={accent} iso label={vArt === "umlauf" ? "Stichtag" : "Termin"}
        value={datum} onChange={setDatum} defaultHeute={false}/>
      {vArt !== "umlauf" ? (
        <>
          <Inp t={t} accent={accent} label="Uhrzeit" value={uhrzeit} onChange={setUhrzeit}/>
          <Inp t={t} accent={accent} label="Ort" value={ort} onChange={setOrt}/>
          <SegmentControl t={t} accent={accent} value={durch} onChange={setDurch}
            options={ETV_DURCHFUEHRUNG.map((a) => ({ id: a.id, label: a.label }))}/>
        </>
      ) : null}
      <DatumFeld t={t} accent={accent} iso label="Einladung versendet am"
        value={ladung} onChange={setLadung} defaultHeute={false}/>
      <KontaktPickerMitAllen t={t} accent={accent}
        kontakteObjekt={null} kontakteAlle={kontakte}
        label="Versammlungsleiter" value={leiterId || null}
        onChange={(id) => setLeiterId(id || "")}/>
      <KontaktPickerMitAllen t={t} accent={accent}
        kontakteObjekt={null} kontakteAlle={kontakte}
        label="Protokollführer" value={protokollId || null}
        onChange={(id) => setProtokollId(id || "")}/>
      <div style={{ display: "flex", gap: 8 }}>
        <AktionsButton rolle="bestaetigen" variante="breit" t={t} accent={accent}
          onClick={() => onSave({ versammlung_art: vArt, datum: datum || null,
            uhrzeit: vArt === "umlauf" ? "" : uhrzeit, ort: vArt === "umlauf" ? "" : ort,
            art: vArt === "umlauf" ? "online" : durch,
            ladung_versendet_am: ladung || null,
            leiter_kontakt_id: leiterId || null,
            protokollfuehrer_kontakt_id: protokollId || null })}
          text="Speichern"/>
        <AktionsButton rolle="abbrechen" variante="breit" t={t}
          onClick={onAbbruch} text="Abbrechen"/>
      </div>
    </div>
  );
}

// ── Tab 2 · TAGESORDNUNG — TOP-Karten, wachsen per Baustein-Katalog ─────────
function EtvTagesordnungTab({ versammlung, ve, welt, onWelt, settings, t, accent }) {
  const [offenId, setOffenId] = useState(null);
  const [addOffen, setAddOffen] = useState(false);
  const tops = topsFuerVersammlung(welt, versammlung.id);
  const gesperrt = versammlung.status === "abgeschlossen";
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {tops.length === 0 ? (
        <div style={{ fontSize: FS.s, color: t.muted, fontStyle: "italic" }}>
          Noch keine Tagesordnungspunkte — unten hinzufügen (Standard-Katalog,
          aus Vorgängen, oder frei).
        </div>
      ) : tops.map((tp) => (
        <TopKarte key={tp.id} top={tp} versammlung={versammlung} welt={welt}
          onWelt={onWelt} t={t} accent={accent} gesperrt={gesperrt}
          offen={offenId === tp.id}
          onToggle={() => setOffenId(offenId === tp.id ? null : tp.id)}/>
      ))}
      {!gesperrt ? (
        !addOffen ? (
          <AktionsButton rolle="bestaetigen" variante="breit" t={t} accent={accent}
            onClick={() => setAddOffen(true)} text="TOP hinzufügen"/>
        ) : (
          <TopHinzufuegen versammlung={versammlung} ve={ve} welt={welt}
            onWelt={onWelt} settings={settings} t={t} accent={accent}
            onFertig={() => setAddOffen(false)}/>
        )
      ) : (
        <div style={{ fontSize: FS.xs, color: t.muted }}>
          Versammlung abgeschlossen — Tagesordnung ist eingefroren.
        </div>
      )}
    </div>
  );
}

// TOP hinzufügen: drei Quellen (Entscheidung §8.3) — Standard-Katalog aus den
// Einstellungen, Vorgänge auf der Warteliste (naechste_etv), freie Hand.
function TopHinzufuegen({ versammlung, ve, welt, onWelt, settings, t, accent, onFertig }) {
  const [quelle, setQuelle] = useState("standard");
  const [freiTitel, setFreiTitel] = useState("");
  const katalog = (settings && Array.isArray(settings.etvStandardTops))
    ? settings.etvStandardTops : [];
  const tops = topsFuerVersammlung(welt, versammlung.id);
  const schonTitel = {};
  tops.forEach((tp) => { schonTitel[tp.titel] = true; });
  const schonVorgang = {};
  tops.forEach((tp) => { if (tp.vorgang_id) schonVorgang[tp.vorgang_id] = true; });
  // Quelle 2: Vorgänge dieses Objekts, die auf die Tagesordnung wollen.
  const wartende = (welt.vorgaenge || []).filter((v) =>
    v.objekt_id === versammlung.objekt_id
    && v.wartet_auf_beschluss_id === "naechste_etv" && !schonVorgang[v.id]);
  const nimmStandard = (st) => {
    onWelt((w) => weltTopNeu(w, { versammlung_id: versammlung.id,
      titel: st.titel, beschluss_noetig: !!st.beschluss_noetig, quelle: "standard",
      bausteine: st.beschluss_noetig ? ["wortlaut", "abstimmung"] : [] }));
  };
  const nimmVorgang = (v) => {
    onWelt((w) => weltTopNeu(w, { versammlung_id: versammlung.id,
      titel: "Beschluss: " + (v.titel || v.nummer || "Vorgang"),
      text: v.nummer ? "Vorgang " + v.nummer : "",
      beschluss_noetig: true, vorgang_id: v.id, quelle: "vorgang",
      bausteine: ["wortlaut", "abstimmung"] }));
  };
  const nimmFrei = () => {
    if (!freiTitel.trim()) return;
    onWelt((w) => weltTopNeu(w, { versammlung_id: versammlung.id,
      titel: freiTitel.trim(), quelle: "frei" }));
    setFreiTitel("");
  };
  return (
    <div style={{ background: t.surface, border: "1px solid " + accent + "50",
      borderRadius: RAD.md, padding: 12, display: "flex", flexDirection: "column", gap: 10 }}>
      <SegmentControl t={t} accent={accent} value={quelle} onChange={setQuelle}
        options={[
          { id: "standard", label: "Standard-TOPs" },
          { id: "vorgang", label: "Aus Vorgängen" + (wartende.length > 0 ? " (" + wartende.length + ")" : "") },
          { id: "frei", label: "Frei" },
        ]}/>
      {quelle === "standard" ? (
        katalog.length === 0 ? (
          <div style={{ fontSize: FS.s, color: t.muted }}>
            Kein Standard-Katalog — in Einstellungen → ETV pflegbar.
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
            {katalog.map((st) => (
              <div key={st.id} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <div style={{ flex: 1, minWidth: 0, fontSize: FS.s, color: t.text,
                  overflowWrap: "anywhere" }}>
                  {st.titel}
                  {st.beschluss_noetig ? (
                    <span style={{ fontSize: FS.xs, color: accent, marginLeft: 6 }}>Beschluss</span>
                  ) : null}
                </div>
                {schonTitel[st.titel] ? (
                  <div style={{ fontSize: FS.xs, color: t.muted, flexShrink: 0 }}>drin</div>
                ) : (
                  <button onClick={() => nimmStandard(st)}
                    style={{ flexShrink: 0, width: 30, height: 30, borderRadius: RAD.pill,
                      border: "none", cursor: "pointer", fontSize: FS.l, lineHeight: 1,
                      background: accent, color: getContrastColor(accent) }}>+</button>
                )}
              </div>
            ))}
          </div>
        )
      ) : null}
      {quelle === "vorgang" ? (
        wartende.length === 0 ? (
          <div style={{ fontSize: FS.s, color: t.muted }}>
            Kein Vorgang wartet auf einen Beschluss. (In der Vorgangs-Akte:
            „Auf die Tagesordnung" setzt einen Vorgang hierher.)
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
            {wartende.map((v) => (
              <div key={v.id} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <div style={{ flex: 1, minWidth: 0, fontSize: FS.s, color: t.text,
                  overflowWrap: "anywhere" }}>
                  {(v.nummer ? v.nummer + " · " : "") + (v.titel || "Vorgang")}
                </div>
                <button onClick={() => nimmVorgang(v)}
                  style={{ flexShrink: 0, width: 30, height: 30, borderRadius: RAD.pill,
                    border: "none", cursor: "pointer", fontSize: FS.l, lineHeight: 1,
                    background: accent, color: getContrastColor(accent) }}>+</button>
              </div>
            ))}
          </div>
        )
      ) : null}
      {quelle === "frei" ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <Inp t={t} accent={accent} label="Titel" value={freiTitel}
            onChange={setFreiTitel} placeholder="z. B. Beschluss über Fahrradraum-Nutzung"/>
          <AktionsButton rolle="bestaetigen" variante="breit" t={t} accent={accent}
            onClick={nimmFrei} text="TOP anlegen" disabled={!freiTitel.trim()}/>
        </div>
      ) : null}
      <AktionsButton rolle="abbrechen" variante="breit" t={t}
        onClick={onFertig} text="Fertig"/>
    </div>
  );
}

// Die TOP-Karte: BausteinKarte-Accordion, wächst per Baustein-Katalog (§2b).
function TopKarte({ top, versammlung, welt, onWelt, t, accent, offen, onToggle, gesperrt }) {
  const [loeschStufe, setLoeschStufe] = useState(false);
  const [ja, setJa] = useState("");
  const [nein, setNein] = useState("");
  const [enth, setEnth] = useState("");
  const [anlageTitel, setAnlageTitel] = useState("");
  const [aufgabeText, setAufgabeText] = useState("");
  const beschluss = top.beschluss_id
    ? (welt.beschluesse || []).find((b) => b.id === top.beschluss_id) || null : null;
  const patch = (p) => onWelt((w) => weltTopPatch(w, top.id, p));
  const hatB = (id) => (top.bausteine || []).indexOf(id) >= 0;
  const addBaustein = (id) => patch({ bausteine: [...(top.bausteine || []), id] });
  const fehlende = TOP_BAUSTEINE.filter((b) => !hatB(b.id)
    && !(b.id === "abstimmung" && !top.beschluss_noetig));
  const subText = beschluss
    ? (beschluss.ergebnis === "angenommen" ? "angenommen" : "abgelehnt")
    : (top.beschluss_noetig ? "Beschluss offen" : null);
  const zahlInp = (label, v, setV) => (
    <div style={{ flex: 1, minWidth: 70 }}>
      <div style={{ fontSize: FS.xs, color: t.muted, marginBottom: 2 }}>{label}</div>
      <input value={v} onChange={(ev) => setV(ev.target.value.replace(/[^0-9.,]/g, ""))}
        inputMode="decimal"
        style={{ width: "100%", fontSize: 16, padding: "6px 8px", boxSizing: "border-box",
          borderRadius: RAD.sm, border: "1px solid " + t.border,
          background: t.card, color: t.text }}/>
    </div>
  );
  return (
    <BausteinKarte t={t} accent={accent}
      titel={"TOP " + (top.nummer || "?") + " · " + (top.titel || "—")}
      sub={subText} offen={offen} onToggle={onToggle}>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {/* Reihenfolge + Kern */}
        {!gesperrt ? (
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <button onClick={() => onWelt((w) => weltTopVerschieben(w, top.id, -1))}
              title="nach oben"
              style={{ width: 30, height: 30, borderRadius: RAD.pill, border: "1px solid " + t.border,
                background: t.card, color: t.text, cursor: "pointer" }}>↑</button>
            <button onClick={() => onWelt((w) => weltTopVerschieben(w, top.id, 1))}
              title="nach unten"
              style={{ width: 30, height: 30, borderRadius: RAD.pill, border: "1px solid " + t.border,
                background: t.card, color: t.text, cursor: "pointer" }}>↓</button>
            <div style={{ flex: 1 }}/>
            <div style={{ fontSize: FS.xs, color: t.muted }}>Beschluss nötig</div>
            <Toggle value={!!top.beschluss_noetig} color={accent}
              onChange={(v) => patch({ beschluss_noetig: v })}/>
          </div>
        ) : null}
        {!gesperrt ? (
          <>
            <Inp t={t} accent={accent} label="Titel" value={top.titel || ""}
              onChange={(v) => patch({ titel: v })}/>
            <Inp t={t} accent={accent} label="Beschreibung" value={top.text || ""}
              onChange={(v) => patch({ text: v })}/>
          </>
        ) : (
          top.text ? <div style={{ fontSize: FS.s, color: t.text }}>{top.text}</div> : null
        )}

        {/* Baustein: Wortlaut */}
        {hatB("wortlaut") ? (
          <div>
            <div style={{ fontSize: FS.xs, fontWeight: FW.bold, color: t.muted,
              textTransform: "uppercase", letterSpacing: 0.4, marginBottom: 4 }}>
              Beschlussvorlage / Wortlaut</div>
            {!gesperrt ? (
              <textarea value={top.wortlaut || ""}
                onChange={(ev) => patch({ wortlaut: ev.target.value })}
                rows={3} placeholder="Die Gemeinschaft beschließt…"
                style={{ width: "100%", boxSizing: "border-box", fontSize: 16,
                  padding: "7px 9px", borderRadius: RAD.sm, resize: "vertical",
                  border: "1px solid " + t.border, background: t.card, color: t.text,
                  fontFamily: "inherit" }}/>
            ) : (
              <div style={{ fontSize: FS.s, color: t.text, whiteSpace: "pre-wrap" }}>
                {top.wortlaut || "—"}</div>
            )}
          </div>
        ) : null}

        {/* Baustein: Anlagen */}
        {hatB("anlage") ? (
          <div>
            <div style={{ fontSize: FS.xs, fontWeight: FW.bold, color: t.muted,
              textTransform: "uppercase", letterSpacing: 0.4, marginBottom: 4 }}>
              Anlagen</div>
            {(top.anlagen || []).map((a) => (
              <div key={a.id} style={{ display: "flex", alignItems: "center", gap: 8,
                fontSize: FS.s, color: t.text, padding: "3px 0" }}>
                <div style={{ flex: 1, minWidth: 0, overflowWrap: "anywhere" }}>📎 {a.titel}</div>
                {!gesperrt ? (
                  <button onClick={() => patch({ anlagen: (top.anlagen || []).filter((x) => x.id !== a.id) })}
                    style={{ width: 26, height: 26, borderRadius: RAD.pill, flexShrink: 0,
                      border: "1px solid " + t.border, background: t.card, color: t.muted,
                      cursor: "pointer", lineHeight: 1 }}>×</button>
                ) : null}
              </div>
            ))}
            {!gesperrt ? (
              <div style={{ display: "flex", gap: 6, marginTop: 4 }}>
                <input value={anlageTitel} onChange={(ev) => setAnlageTitel(ev.target.value)}
                  placeholder="z. B. Angebot Dachdecker Meyer"
                  style={{ flex: 1, minWidth: 0, fontSize: 16, padding: "6px 9px",
                    borderRadius: RAD.sm, border: "1px solid " + t.border,
                    background: t.card, color: t.text, boxSizing: "border-box" }}/>
                <button onClick={() => {
                    if (!anlageTitel.trim()) return;
                    patch({ anlagen: [...(top.anlagen || []),
                      { id: "anl_" + Date.now().toString(36), titel: anlageTitel.trim() }] });
                    setAnlageTitel("");
                  }}
                  style={{ width: 30, height: 30, borderRadius: RAD.pill, flexShrink: 0,
                    border: "none", background: accent, color: getContrastColor(accent),
                    cursor: "pointer", fontSize: FS.l, lineHeight: 1 }}>+</button>
              </div>
            ) : null}
          </div>
        ) : null}

        {/* Baustein: Abstimmung (nur bei beschluss_noetig) */}
        {hatB("abstimmung") && top.beschluss_noetig ? (
          <div>
            <div style={{ fontSize: FS.xs, fontWeight: FW.bold, color: t.muted,
              textTransform: "uppercase", letterSpacing: 0.4, marginBottom: 4 }}>
              Abstimmung ({versammlung.stimmprinzip || "MEA"})</div>
            {beschluss ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <StatusPille t={t}
                    farbe={beschluss.ergebnis === "angenommen" ? "#10B981" : "#EF4444"}
                    text={beschluss.ergebnis === "angenommen" ? "Angenommen" : "Abgelehnt"}/>
                  <div style={{ fontSize: FS.s, color: t.text }}>
                    Ja {meaStr((beschluss.abstimmung || {}).ja)} ·
                    Nein {meaStr((beschluss.abstimmung || {}).nein)} ·
                    Enth. {meaStr((beschluss.abstimmung || {}).enthaltung)}
                  </div>
                </div>
                {beschluss.anfechtungsfrist_bis ? (
                  <div style={{ fontSize: FS.xs, color: t.muted }}>
                    Anfechtungsfrist bis {datumDe(beschluss.anfechtungsfrist_bis)} (§45 WEG)
                  </div>
                ) : null}
                {versammlung.versammlung_art === "umlauf"
                  && beschluss.ergebnis === "angenommen"
                  && zahl((beschluss.abstimmung || {}).nein) + zahl((beschluss.abstimmung || {}).enthaltung) > 0 ? (
                  <div style={{ fontSize: FS.xs, color: AMPEL_FARBEN.gelb }}>
                    Umlauf: regulär ist Allstimmigkeit nötig (§23 III WEG) —
                    Quorum-Absenkung nur, wenn dafür beschlossen.
                  </div>
                ) : null}
                {!gesperrt ? (
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 2 }}>
                    <div style={{ fontSize: FS.xs, color: t.muted }}>Besonderer Beschluss (Merker)</div>
                    <Toggle value={!!beschluss.ist_besonders} color={accent}
                      onChange={(v) => onWelt((w) => weltBeschlussPatch(w, beschluss.id, { ist_besonders: v }))}/>
                  </div>
                ) : null}
              </div>
            ) : null}
            {!gesperrt ? (
              <div style={{ marginTop: beschluss ? 8 : 0 }}>
                <div style={{ display: "flex", gap: 8 }}>
                  {zahlInp("Ja", ja, setJa)}
                  {zahlInp("Nein", nein, setNein)}
                  {zahlInp("Enthaltung", enth, setEnth)}
                </div>
                <div style={{ marginTop: 8 }}>
                  <AktionsButton rolle="bestaetigen" variante="breit" t={t} accent={accent}
                    onClick={() => {
                      onWelt((w) => weltTopAbstimmen(w, top.id,
                        { ja: zahl(ja), nein: zahl(nein), enthaltung: zahl(enth) }));
                      setJa(""); setNein(""); setEnth("");
                    }}
                    disabled={ja === "" && nein === "" && enth === ""}
                    text={beschluss ? "Neu auszählen (überschreibt)" : "Auszählen — Beschluss fassen"}/>
                </div>
              </div>
            ) : null}
          </div>
        ) : null}

        {/* Baustein: Aufgaben (schlanke TOP-Checkliste) */}
        {hatB("aufgabe") ? (
          <div>
            <div style={{ fontSize: FS.xs, fontWeight: FW.bold, color: t.muted,
              textTransform: "uppercase", letterSpacing: 0.4, marginBottom: 4 }}>
              Aufgaben</div>
            {(top.aufgaben || []).map((a) => (
              <div key={a.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "3px 0" }}>
                <Toggle value={!!a.erledigt} color={accent}
                  onChange={(v) => patch({ aufgaben: (top.aufgaben || []).map((x) =>
                    x.id === a.id ? Object.assign({}, x, { erledigt: v }) : x) })}/>
                <div style={{ flex: 1, minWidth: 0, fontSize: FS.s, overflowWrap: "anywhere",
                  color: a.erledigt ? t.muted : t.text,
                  textDecoration: a.erledigt ? "line-through" : "none" }}>{a.text}</div>
                {!gesperrt ? (
                  <button onClick={() => patch({ aufgaben: (top.aufgaben || []).filter((x) => x.id !== a.id) })}
                    style={{ width: 26, height: 26, borderRadius: RAD.pill, flexShrink: 0,
                      border: "1px solid " + t.border, background: t.card, color: t.muted,
                      cursor: "pointer", lineHeight: 1 }}>×</button>
                ) : null}
              </div>
            ))}
            {!gesperrt ? (
              <div style={{ display: "flex", gap: 6, marginTop: 4 }}>
                <input value={aufgabeText} onChange={(ev) => setAufgabeText(ev.target.value)}
                  placeholder="z. B. Beschlussvorlage bis ETV vorbereiten"
                  style={{ flex: 1, minWidth: 0, fontSize: 16, padding: "6px 9px",
                    borderRadius: RAD.sm, border: "1px solid " + t.border,
                    background: t.card, color: t.text, boxSizing: "border-box" }}/>
                <button onClick={() => {
                    if (!aufgabeText.trim()) return;
                    patch({ aufgaben: [...(top.aufgaben || []),
                      { id: "ta_" + Date.now().toString(36), text: aufgabeText.trim(), erledigt: false }] });
                    setAufgabeText("");
                  }}
                  style={{ width: 30, height: 30, borderRadius: RAD.pill, flexShrink: 0,
                    border: "none", background: accent, color: getContrastColor(accent),
                    cursor: "pointer", fontSize: FS.l, lineHeight: 1 }}>+</button>
              </div>
            ) : null}
          </div>
        ) : null}

        {/* Baustein: Notiz (EINE freie Notiz, Vorgang-Muster) */}
        {hatB("notiz") ? (
          <div>
            <div style={{ fontSize: FS.xs, fontWeight: FW.bold, color: t.muted,
              textTransform: "uppercase", letterSpacing: 0.4, marginBottom: 4 }}>
              Notiz</div>
            {!gesperrt ? (
              <textarea value={top.notiz || ""}
                onChange={(ev) => patch({ notiz: ev.target.value })}
                rows={2}
                style={{ width: "100%", boxSizing: "border-box", fontSize: 16,
                  padding: "7px 9px", borderRadius: RAD.sm, resize: "vertical",
                  border: "1px solid " + t.border, background: t.card, color: t.text,
                  fontFamily: "inherit" }}/>
            ) : (
              <div style={{ fontSize: FS.s, color: t.text, whiteSpace: "pre-wrap" }}>
                {top.notiz || "—"}</div>
            )}
          </div>
        ) : null}

        {/* Baustein hinzufügen (der Katalog wächst den TOP — Vorgang-Muster) */}
        {!gesperrt && fehlende.length > 0 ? (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {fehlende.map((b) => (
              <button key={b.id} onClick={() => addBaustein(b.id)}
                style={{ fontSize: FS.xs, fontWeight: FW.bold, padding: "5px 10px",
                  borderRadius: RAD.pill, cursor: "pointer", fontFamily: "inherit",
                  background: accent + "15", color: accent,
                  border: "1px solid " + accent + "40" }}>
                + {b.label}
              </button>
            ))}
          </div>
        ) : null}

        {/* Löschen (2-Stufen, §25.2) */}
        {!gesperrt ? (
          !loeschStufe ? (
            <div>
              <AktionsButton rolle="loeschen" variante="breit" t={t}
                onClick={() => setLoeschStufe(true)} text="TOP entfernen"/>
            </div>
          ) : (
            <div>
              <AktionsButton rolle="loeschen" variante="breit" t={t} confirm
                onClick={() => onWelt((w) => weltTopLoeschen(w, top.id))}
                text={"Wirklich entfernen?" + (top.vorgang_id && !top.beschluss_id
                  ? " (Vorgang geht zurück auf die Warteliste)" : "")}/>
            </div>
          )
        ) : null}
      </div>
    </BausteinKarte>
  );
}

// ── Tab 4 · BESCHLÜSSE — diese Versammlung + besondere (ist_besonders) ──────
function EtvBeschluesseTab({ versammlung, welt, onWelt, t, accent }) {
  const alleObjekt = (welt.beschluesse || []).filter((b) =>
    b.objekt_id === versammlung.objekt_id);
  const diese = alleObjekt.filter((b) => b.versammlung_id === versammlung.id);
  const besondere = alleObjekt.filter((b) => b.ist_besonders);
  const Karte = ({ b }) => (
    <div style={{ background: t.card, border: "1px solid " + t.border,
      borderRadius: RAD.md, padding: "10px 12px", minWidth: 0 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <div style={{ flex: 1, minWidth: 0, fontSize: FS.s, fontWeight: FW.bold,
          color: t.text, overflowWrap: "anywhere" }}>
          {(b.jahr ? b.jahr + " · " : "") + (b.titel || b.betreff || "Beschluss")}
        </div>
        {b.ergebnis ? (
          <StatusPille t={t} farbe={b.ergebnis === "angenommen" ? "#10B981" : "#EF4444"}
            text={b.ergebnis === "angenommen" ? "Angenommen" : "Abgelehnt"}/>
        ) : null}
        <button onClick={() => onWelt((w) => weltBeschlussPatch(w, b.id,
            { ist_besonders: !b.ist_besonders }))}
          title={b.ist_besonders ? "Merker entfernen" : "Als besonders merken"}
          style={{ width: 30, height: 30, borderRadius: RAD.pill, flexShrink: 0,
            border: "1px solid " + (b.ist_besonders ? accent : t.border),
            background: b.ist_besonders ? accent + "18" : t.card,
            color: b.ist_besonders ? accent : t.muted,
            cursor: "pointer", fontSize: FS.m, lineHeight: 1 }}>★</button>
      </div>
      {b.wortlaut ? (
        <div style={{ fontSize: FS.xs, color: t.muted, marginTop: 4,
          whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>{b.wortlaut}</div>
      ) : null}
      {b.gefasst_am ? (
        <div style={{ fontSize: FS.xs, color: t.muted, marginTop: 4 }}>
          Gefasst am {datumDe(b.gefasst_am)}
          {b.anfechtungsfrist_bis ? " · Anfechtungsfrist bis " + datumDe(b.anfechtungsfrist_bis) : ""}
        </div>
      ) : null}
    </div>
  );
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <div style={{ fontSize: FS.xs, fontWeight: FW.bold, color: t.muted,
        textTransform: "uppercase", letterSpacing: 0.4 }}>Besondere Beschlüsse (gemerkt)</div>
      {besondere.length === 0 ? (
        <div style={{ fontSize: FS.s, color: t.muted, fontStyle: "italic" }}>
          Noch keine gemerkt. Der Stern ★ an einem gefassten Beschluss legt ihn
          hier ab — griffbereit für die Versammlung. (Die volle
          Beschluss-Sammlung als eigener Bereich kommt später.)
        </div>
      ) : besondere.map((b) => <Karte key={b.id} b={b}/>)}
      <div style={{ fontSize: FS.xs, fontWeight: FW.bold, color: t.muted,
        textTransform: "uppercase", letterSpacing: 0.4, marginTop: 8 }}>Diese Versammlung</div>
      {diese.length === 0 ? (
        <div style={{ fontSize: FS.s, color: t.muted, fontStyle: "italic" }}>
          Noch keine Beschlüsse gefasst — Abstimmung im Tagesordnung-Tab.
        </div>
      ) : diese.map((b) => <Karte key={b.id} b={b}/>)}
    </div>
  );
}

// ── Protokoll (§5): strukturiert TOP-für-TOP + Anwesenheitsliste, druckeHtml ─
function druckeEtvProtokoll(versammlung, ve, welt, kontakte) {
  const tops = topsFuerVersammlung(welt, versammlung.id);
  const anw = anwesenheitenFuer(welt, versammlung.id);
  const stamm = (ve && ve.etvStamm) || {};
  const bf = beschlussfaehigkeitInfo(anw, stamm.gesamtanteile);
  const topHtml = tops.map((tp) => {
    const b = tp.beschluss_id
      ? (welt.beschluesse || []).find((x) => x.id === tp.beschluss_id) || null : null;
    let inner = "";
    if (tp.text) inner += "<p>" + esc(tp.text) + "</p>";
    if (tp.wortlaut) inner += "<p><b>Beschlussvorlage:</b><br/>" + esc(tp.wortlaut) + "</p>";
    if ((tp.anlagen || []).length > 0) {
      inner += "<p><b>Anlagen:</b> " + tp.anlagen.map((a) => esc(a.titel)).join(", ") + "</p>";
    }
    if (b && b.abstimmung) {
      inner += "<p><b>Abstimmung (" + esc(versammlung.stimmprinzip || "MEA") + "):</b> "
        + "Ja " + meaStr(b.abstimmung.ja) + " · Nein " + meaStr(b.abstimmung.nein)
        + " · Enthaltung " + meaStr(b.abstimmung.enthaltung)
        + " — <b>" + (b.ergebnis === "angenommen" ? "ANGENOMMEN" : "ABGELEHNT") + "</b></p>";
      if (b.anfechtungsfrist_bis) {
        inner += "<p style='color:#555'>Anfechtungsfrist bis "
          + esc(datumDe(b.anfechtungsfrist_bis)) + " (§45 WEG)</p>";
      }
    } else if (tp.beschluss_noetig) {
      inner += "<p style='color:#555'>Abstimmung noch offen.</p>";
    }
    if (tp.notiz) inner += "<p><i>" + esc(tp.notiz) + "</i></p>";
    return "<h3>TOP " + tp.nummer + " · " + esc(tp.titel) + "</h3>" + (inner || "<p>—</p>");
  }).join("");
  const anwHtml = anw.length > 0
    ? "<h3>Anwesenheitsliste</h3><table><tr><th>Einheit</th><th>Eigentümer</th>"
      + "<th>MEA</th><th>Anwesend</th><th>Vertreten durch</th></tr>"
      + anw.map((a) => "<tr><td>" + esc(a.einheit_nr) + "</td><td>" + esc(a.name)
        + "</td><td>" + meaStr(a.mea) + "</td><td>"
        + (a.anwesend ? "ja" : (a.vertreten_durch ? "vertreten" : "nein"))
        + "</td><td>" + esc(a.vertreten_durch) + "</td></tr>").join("")
      + "</table><p><b>" + esc(bf.text) + "</b></p>"
    : "";
  const kopf = "<p>"
    + "<b>Objekt:</b> " + esc((ve && (ve.nr || ve.name)) || "") + " · " + esc((ve && ve.adresse) || "") + "<br/>"
    + "<b>Art:</b> " + esc(artLabel(versammlung.versammlung_art))
    + (versammlung.versammlung_art !== "umlauf"
      ? " (" + esc(((ETV_DURCHFUEHRUNG.find((x) => x.id === versammlung.art) || {}).label || "")) + ")" : "")
    + "<br/><b>" + (versammlung.versammlung_art === "umlauf" ? "Stichtag" : "Termin") + ":</b> "
    + esc(versammlung.datum ? datumDe(versammlung.datum) : "—")
    + (versammlung.uhrzeit ? " · " + esc(versammlung.uhrzeit) + " Uhr" : "")
    + (versammlung.ort ? "<br/><b>Ort:</b> " + esc(versammlung.ort) : "")
    + "<br/><b>Stimmprinzip:</b> " + esc(versammlung.stimmprinzip || "MEA")
    + (versammlung.leiter_kontakt_id
      ? "<br/><b>Versammlungsleiter:</b> " + esc(kontaktAnzeigename(kontakte, versammlung.leiter_kontakt_id)) : "")
    + (versammlung.protokollfuehrer_kontakt_id
      ? "<br/><b>Protokollführer:</b> " + esc(kontaktAnzeigename(kontakte, versammlung.protokollfuehrer_kontakt_id)) : "")
    + "</p>";
  const css = "h3{margin:14px 0 4px 0;font-size:13px} p{margin:4px 0;font-size:11px}"
    + " table{border-collapse:collapse;width:100%;font-size:10px}"
    + " th,td{border:1px solid #999;padding:3px 6px;text-align:left}";
  druckeHtml("Protokoll · " + artLabel(versammlung.versammlung_art)
    + (versammlung.datum ? " · " + datumDe(versammlung.datum) : ""),
    kopf + topHtml + anwHtml, false, css);
}

// ── Die ETV-AKTE: Kopf + TabLeiste (§97) + vier Tabs (§2b) ──────────────────
function EtvDetail({ versammlung, ve, welt, onWelt, kontakte, settings, t, accent, onZurueck }) {
  const [tab, setTab] = useState("uebersicht");
  const tops = topsFuerVersammlung(welt, versammlung.id);
  const tabs = [
    { id: "uebersicht", label: "Übersicht", icon: "home" },
    { id: "tagesordnung", label: "Tagesordnung" + (tops.length > 0 ? " (" + tops.length + ")" : ""), icon: "list" },
    { id: "te", label: "TE", icon: "badge" },
    { id: "beschluesse", label: "Beschlüsse", icon: "check" },
  ];
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8, minWidth: 0 }}>
      {/* Akten-Kopf (Vorgang-Muster §98.3: Titel groß + Sub + StatusPille) */}
      <div style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: FS.xl, fontWeight: FW.bold, color: t.text,
            overflowWrap: "anywhere" }}>
            {artLabel(versammlung.versammlung_art)}
          </div>
          <div style={{ fontSize: FS.s, color: t.muted, marginTop: 2 }}>
            {(versammlung.datum ? datumDe(versammlung.datum) : "Termin offen")
              + (versammlung.uhrzeit ? " · " + versammlung.uhrzeit : "")
              + (versammlung.ort ? " · " + versammlung.ort : "")}
          </div>
        </div>
        <StatusPille t={t} farbe={STATUS_FARBE[versammlung.status] || t.muted}
          text={ETV_STATUS_LABEL[versammlung.status] || versammlung.status}/>
        <button onClick={onZurueck}
          style={{ flexShrink: 0, fontSize: FS.xs, fontWeight: FW.bold,
            padding: "5px 11px", borderRadius: RAD.pill, cursor: "pointer",
            fontFamily: "inherit", background: t.card, color: t.text,
            border: "1px solid " + t.border }}>
          Zurück
        </button>
      </div>
      <TabLeiste t={t} accent={accent} tabs={tabs} aktiv={tab} onWaehle={setTab}/>
      {tab === "uebersicht" ? (
        <EtvUebersichtTab versammlung={versammlung} ve={ve} welt={welt}
          onWelt={onWelt} kontakte={kontakte} t={t} accent={accent}/>
      ) : null}
      {tab === "tagesordnung" ? (
        <EtvTagesordnungTab versammlung={versammlung} ve={ve} welt={welt}
          onWelt={onWelt} settings={settings} t={t} accent={accent}/>
      ) : null}
      {tab === "te" ? (
        <TERegisterAnsicht ve={ve} t={t} accent={accent}/>
      ) : null}
      {tab === "beschluesse" ? (
        <EtvBeschluesseTab versammlung={versammlung} welt={welt} onWelt={onWelt}
          t={t} accent={accent}/>
      ) : null}
    </div>
  );
}

// ── EtvBereichFuerObjekt — der renderDetail-Inhalt der ETV-Kachel ───────────
// Ohne offene Akte: Versammlungsliste (aktiv) + Archiv (KlappBereich) +
// Neu-Anlegen. Mit offener Akte: EtvDetail (die vier Tabs).
function EtvBereichFuerObjekt({ ve, welt, onWelt, kontakte, settings, t, accent, akteId, setAkteId }) {
  const [neuOffen, setNeuOffen] = useState(false);
  const [archivOffen, setArchivOffen] = useState(false);
  const alle = versammlungenFuerObjekt(welt, ve.id)
    .sort((a, b) => String(b.datum || "").localeCompare(String(a.datum || "")));
  const aktive = alle.filter((v) => !v.archiviert);
  const archiv = alle.filter((v) => v.archiviert);
  const akte = akteId ? alle.find((v) => v.id === akteId) || null : null;

  if (akte) {
    return (
      <EtvDetail versammlung={akte} ve={ve} welt={welt} onWelt={onWelt}
        kontakte={kontakte} settings={settings} t={t} accent={accent}
        onZurueck={() => setAkteId(null)}/>
    );
  }
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {aktive.length === 0 && archiv.length === 0 ? (
        <div style={{ fontSize: FS.s, color: t.muted, fontStyle: "italic" }}>
          Noch keine Versammlung für dieses Objekt.
        </div>
      ) : null}
      {aktive.map((v) => (
        <VersammlungZeile key={v.id} versammlung={v} welt={welt} t={t}
          accent={accent} onOeffnen={() => setAkteId(v.id)}/>
      ))}
      {!neuOffen ? (
        <AktionsButton rolle="bestaetigen" variante="breit" t={t} accent={accent}
          onClick={() => setNeuOffen(true)} text="Neue Versammlung"/>
      ) : (
        <VersammlungNeuForm ve={ve} kontakte={kontakte} t={t} accent={accent}
          onAbbrechen={() => setNeuOffen(false)}
          onAnlegen={(init) => {
            const v = neueVersammlung(init);
            onWelt((w) => Object.assign({}, w,
              { versammlungen: [...(w.versammlungen || []), v] }));
            setNeuOffen(false);
            setAkteId(v.id);
          }}/>
      )}
      {archiv.length > 0 ? (
        <div style={{ marginTop: 6 }}>
          <div onClick={() => setArchivOffen(!archivOffen)}
            style={{ fontSize: FS.xs, fontWeight: FW.bold, color: t.muted,
              textTransform: "uppercase", letterSpacing: 0.4, cursor: "pointer",
              padding: "4px 0" }}>
            Archiv ({archiv.length})
          </div>
          {archivOffen ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 4 }}>
              {archiv.map((v) => (
                <VersammlungZeile key={v.id} versammlung={v} welt={welt} t={t}
                  accent={accent} onOeffnen={() => setAkteId(v.id)}/>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

export {
  EtvBereichFuerObjekt, EtvDetail, VersammlungZeile,
  etvAnwesenheitZeilen, druckeEtvProtokoll,
};
