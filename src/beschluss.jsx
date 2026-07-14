// ═══ beschluss.jsx — Beschluss-Sammlung (§24 Abs. 7/8 WEG) ══════════════════
// Konzept: BESCHLUSS_Sammlung_Konzept_AllesDa_13_07_2026_01 (durchentschieden).
// Die Sammlung ist eine SICHT auf welt.beschluesse (mit lfd_nummer) +
// welt.gerichtsentscheidungen — EIN fortlaufender Nummernkreis, kein
// Jahres-Reset (h.M.). Diese Datei liefert den renderDetail-Inhalt der
// Kachel „Beschlusssammlung" (ObjektListeMitDetail in allesda_merged §51.6).
//
// Gezeigt/gedruckt wird NUR der Pflichtinhalt: Nr · Datum · Versammlung ·
// Wortlaut · Status + Vermerke. BEWUSST OHNE Abstimmungszahlen, Anlagen,
// Teilnehmer — dafür gibt es das Protokoll (§1 Nicht-Inhalte im Konzept).

import React, { useState } from "react";
import { AMPEL_FARBEN, FS, FW, RAD } from "./constants.js";
import { datumDe, isoHeute } from "./utils-basis.js";
import { DatumFeld, Inp, Toggle } from "./components.jsx";
import { AktionsButton } from "./kontakte-modul.jsx";
import { StatusPille } from "./vorgang.jsx";
import { I } from "./utils-icons.jsx";
import { druckeHtml } from "./listen-tools.jsx";
import {
  SAMMLUNG_STATUS_LABEL, beschlussOrtDatum, naechsteLfdNummer,
  sammlungFuerObjekt, sammlungsStatus,
  weltBeschlussAltNeu, weltBeschlussPatch, weltBeschlussVermerk,
  weltGerichtsentscheidungNeu, weltGerichtsentscheidungVermerk,
} from "./datenmodell.js";

function esc(s) {
  return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

// Status → Ampelfarbe der Sammlung (Wort steht IMMER daneben, nie Farbe allein).
const STATUS_FARBE = {
  gefasst: AMPEL_FARBEN.gruen, bestandskraeftig: AMPEL_FARBEN.gruen,
  abgelehnt: AMPEL_FARBEN.rot, angefochten: AMPEL_FARBEN.gelb,
  aufgehoben: AMPEL_FARBEN.rot, bedeutungslos: AMPEL_FARBEN.grau,
};

const VERMERK_TYPEN = [
  { id: "angefochten",   label: "Angefochten" },
  { id: "aufgehoben",    label: "Aufgehoben" },
  { id: "bedeutungslos", label: "Gegenstandslos" },
  { id: "frei",          label: "Freier Vermerk" },
];

// ── Modal-Hülle (kanonisches Muster §76.4) ───────────────────────────────────
function SammlungModal({ t, titel, onClose, children }) {
  return (
    <div style={{ position: "fixed", top: 0, right: 0, bottom: 0, left: 0,
      background: "rgba(0,0,0,0.7)", zIndex: 200, display: "flex",
      alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div style={{ background: t.card, border: "1px solid " + t.border,
        borderRadius: RAD.xl, width: "100%", maxWidth: 480,
        maxHeight: "90dvh", overflowY: "auto",
        boxShadow: "0 20px 60px rgba(0,0,0,0.5)" }}>
        <div style={{ padding: "12px 16px", borderBottom: "1px solid " + t.border,
          display: "flex", alignItems: "center", justifyContent: "space-between",
          position: "sticky", top: 0, background: t.card, zIndex: 10 }}>
          <span style={{ fontSize: FS.xl, fontWeight: FW.bold, color: t.text }}>{titel}</span>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer" }}
            title="Schließen" aria-label="Schließen">
            <I name="x" size={16} color={t.sub}/>
          </button>
        </div>
        <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 12 }}>
          {children}
        </div>
      </div>
    </div>
  );
}

// ── Vermerk anlegen (§24 VII S. 4/7: additiv, datiert) ───────────────────────
function VermerkModal({ t, accent, onClose, onSave }) {
  const [typ, setTyp] = useState("angefochten");
  const [datum, setDatum] = useState(isoHeute());
  const [text, setText] = useState("");
  return (
    <SammlungModal t={t} titel="Vermerk hinzufügen" onClose={onClose}>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
        {VERMERK_TYPEN.map((v) => (
          <button key={v.id} onClick={() => setTyp(v.id)}
            style={{ padding: "6px 12px", borderRadius: RAD.pill, cursor: "pointer",
              fontFamily: "inherit", fontSize: FS.s,
              border: "1px solid " + (typ === v.id ? accent : t.border),
              background: typ === v.id ? accent + "22" : t.surface,
              color: typ === v.id ? t.text : t.sub,
              fontWeight: typ === v.id ? FW.bold : FW.normal }}>{v.label}</button>
        ))}
      </div>
      <DatumFeld t={t} accent={accent} iso label="Datum des Vermerks"
        value={datum} onChange={setDatum}/>
      <Inp t={t} accent={accent} label="Text (z. B. „Angefochten beim AG Mannheim, Az. …\u201c)"
        value={text} onChange={setText}/>
      <div style={{ display: "flex", gap: 8 }}>
        <div style={{ flex: 1 }}>
          <AktionsButton rolle="abbrechen" variante="breit" t={t} accent={accent}
            onClick={onClose} text="Abbrechen"/>
        </div>
        <div style={{ flex: 2 }}>
          <AktionsButton rolle="bestaetigen" variante="breit" t={t} accent={accent}
            disabled={!text.trim() || !datum}
            onClick={() => { onSave({ typ: typ, datum: datum, text: text.trim() }); onClose(); }}
            text="Vermerk eintragen"/>
        </div>
      </div>
    </SammlungModal>
  );
}

// ── Alt-Beschluss erfassen (Übernahme Vorverwalter, Konzept §2 Nr. 4) ────────
function AltBeschlussModal({ t, accent, vorNummer, onClose, onSave }) {
  const [nummer, setNummer] = useState(String(vorNummer));
  const [titel, setTitel] = useState("");
  const [wortlaut, setWortlaut] = useState("");
  const [ort, setOrt] = useState("");
  const [datum, setDatum] = useState("");
  const nrZahl = Number(nummer);
  const ok = nrZahl > 0 && wortlaut.trim() && datum;
  return (
    <SammlungModal t={t} titel="Alt-Beschluss erfassen" onClose={onClose}>
      <div style={{ fontSize: FS.xs, color: t.muted }}>
        Übernahme aus einer bestehenden Sammlung — die Nummer wird fortgeführt,
        nicht neu begonnen. Die Automatik zählt danach ab der höchsten Nummer weiter.
      </div>
      <Inp t={t} accent={accent} label="Laufende Nummer" type="number"
        value={nummer} onChange={setNummer}/>
      <Inp t={t} accent={accent} label="Titel (optional)"
        value={titel} onChange={setTitel}/>
      <div>
        <div style={{ fontSize: FS.xs, fontWeight: FW.bold, color: t.muted,
          textTransform: "uppercase", letterSpacing: 0.4, marginBottom: 4 }}>
          Wortlaut des Beschlusses</div>
        <textarea value={wortlaut} onChange={(ev) => setWortlaut(ev.target.value)}
          rows={4}
          style={{ width: "100%", fontSize: 16, padding: "8px 10px", boxSizing: "border-box",
            borderRadius: RAD.ms, border: "1px solid " + t.border,
            background: t.surface, color: t.text, fontFamily: "inherit", resize: "vertical" }}/>
      </div>
      <Inp t={t} accent={accent} label="Ort der Versammlung"
        value={ort} onChange={setOrt}/>
      <DatumFeld t={t} accent={accent} iso label="Datum der Versammlung"
        value={datum} onChange={setDatum} defaultHeute={false}/>
      <div style={{ display: "flex", gap: 8 }}>
        <div style={{ flex: 1 }}>
          <AktionsButton rolle="abbrechen" variante="breit" t={t} accent={accent}
            onClick={onClose} text="Abbrechen"/>
        </div>
        <div style={{ flex: 2 }}>
          <AktionsButton rolle="bestaetigen" variante="breit" t={t} accent={accent}
            disabled={!ok}
            onClick={() => {
              onSave({ lfd_nummer: nrZahl, titel: titel.trim(), wortlaut: wortlaut.trim(),
                ort: ort.trim(), gefasst_am: datum,
                jahr: Number(String(datum).slice(0, 4)) || null });
              onClose();
            }}
            text="In Sammlung aufnehmen"/>
        </div>
      </div>
    </SammlungModal>
  );
}

// ── Gerichtsentscheidung erfassen (§24 VII Nr. 3: NUR die Urteilsformel) ─────
function GerichtModal({ t, accent, vorNummer, onClose, onSave }) {
  const [nummer, setNummer] = useState(String(vorNummer));
  const [formel, setFormel] = useState("");
  const [gericht, setGericht] = useState("");
  const [datum, setDatum] = useState("");
  const [parteien, setParteien] = useState("");
  const nrZahl = Number(nummer);
  const ok = nrZahl > 0 && formel.trim() && gericht.trim() && datum;
  return (
    <SammlungModal t={t} titel="Gerichtsentscheidung (§43 WEG)" onClose={onClose}>
      <div style={{ fontSize: FS.xs, color: t.muted }}>
        Pflichtinhalt der Sammlung ist NUR die Urteilsformel — mit Gericht,
        Datum und Parteien. Gleicher Nummernkreis wie die Beschlüsse.
      </div>
      <Inp t={t} accent={accent} label="Laufende Nummer" type="number"
        value={nummer} onChange={setNummer}/>
      <div>
        <div style={{ fontSize: FS.xs, fontWeight: FW.bold, color: t.muted,
          textTransform: "uppercase", letterSpacing: 0.4, marginBottom: 4 }}>
          Urteilsformel</div>
        <textarea value={formel} onChange={(ev) => setFormel(ev.target.value)}
          rows={4}
          style={{ width: "100%", fontSize: 16, padding: "8px 10px", boxSizing: "border-box",
            borderRadius: RAD.ms, border: "1px solid " + t.border,
            background: t.surface, color: t.text, fontFamily: "inherit", resize: "vertical" }}/>
      </div>
      <Inp t={t} accent={accent} label="Gericht (z. B. AG Mannheim)"
        value={gericht} onChange={setGericht}/>
      <DatumFeld t={t} accent={accent} iso label="Datum der Entscheidung"
        value={datum} onChange={setDatum} defaultHeute={false}/>
      <Inp t={t} accent={accent} label="Parteien"
        value={parteien} onChange={setParteien}/>
      <div style={{ display: "flex", gap: 8 }}>
        <div style={{ flex: 1 }}>
          <AktionsButton rolle="abbrechen" variante="breit" t={t} accent={accent}
            onClick={onClose} text="Abbrechen"/>
        </div>
        <div style={{ flex: 2 }}>
          <AktionsButton rolle="bestaetigen" variante="breit" t={t} accent={accent}
            disabled={!ok}
            onClick={() => {
              onSave({ lfd_nummer: nrZahl, urteilsformel: formel.trim(),
                gericht: gericht.trim(), datum: datum, parteien: parteien.trim() });
              onClose();
            }}
            text="In Sammlung aufnehmen"/>
        </div>
      </div>
    </SammlungModal>
  );
}

// ── Druck (Einsichtsrecht §24 VIII): tabellarisch, NUR Pflichtinhalt ─────────
function druckeBeschlussSammlung(ve, welt, heute) {
  const eintraege = sammlungFuerObjekt(welt, ve.id);
  const zeilen = eintraege.map((e) => {
    if (e.art === "urteil") {
      const g = e.obj;
      const vermerke = (g.vermerke || []).map((v) =>
        "<br/><i>" + esc(datumDe(v.datum)) + ": " + esc(v.text) + "</i>").join("");
      return "<tr><td>" + e.nr + "</td><td>" + esc(g.datum ? datumDe(g.datum) : "—")
        + "</td><td>Gerichtsentscheidung<br/>" + esc(g.gericht)
        + (g.parteien ? "<br/>" + esc(g.parteien) : "") + "</td>"
        + "<td>" + esc(g.urteilsformel) + vermerke + "</td>"
        + "<td>§43 WEG</td></tr>";
    }
    const b = e.obj;
    const od = beschlussOrtDatum(welt, b);
    const st = sammlungsStatus(b, heute);
    const vermerke = (b.vermerke || []).map((v) =>
      "<br/><i>" + esc(datumDe(v.datum)) + ": " + esc(v.text) + "</i>").join("");
    const vArt = od.versammlung_art === "umlauf" ? "Umlaufbeschluss"
      : od.versammlung_art === "ausserordentlich" ? "Außerordentliche ETV"
      : b.alt_erfasst ? "Alt-Bestand" : "Ordentliche ETV";
    return "<tr><td>" + e.nr + "</td><td>" + esc(od.datum ? datumDe(od.datum) : "—")
      + "</td><td>" + esc(vArt) + (od.ort ? "<br/>" + esc(od.ort) : "") + "</td>"
      + "<td>" + (b.titel ? "<b>" + esc(b.titel) + "</b><br/>" : "") + esc(b.wortlaut || "—")
      + vermerke + "</td>"
      + "<td>" + esc(SAMMLUNG_STATUS_LABEL[st] || st) + "</td></tr>";
  }).join("");
  const html = "<p><b>Objekt:</b> " + esc((ve.nr || ve.name) || "")
    + " · " + esc(ve.adresse || "") + "<br/>"
    + "<b>Stand:</b> " + esc(datumDe(heute)) + " · geführt nach §24 Abs. 7 WEG</p>"
    + "<table><tr><th style='width:32px'>Nr.</th><th style='width:70px'>Datum</th>"
    + "<th style='width:110px'>Versammlung</th><th>Beschlusswortlaut</th>"
    + "<th style='width:95px'>Status</th></tr>"
    + (zeilen || "<tr><td colspan='5'>Noch keine Eintragungen.</td></tr>")
    + "</table>";
  const css = "p{margin:4px 0;font-size:11px}"
    + " table{border-collapse:collapse;width:100%;font-size:10px}"
    + " th,td{border:1px solid #999;padding:3px 6px;text-align:left;vertical-align:top}";
  druckeHtml("Beschluss-Sammlung · " + ((ve.nr || ve.name) || ""), html, false, css);
}

// ── Eintrag-Zeile (aufklappbar per Kopf-Klick, KEIN Chevron) ─────────────────
function SammlungZeile({ eintrag, welt, onWelt, t, accent, offen, onToggle, heute }) {
  const [vermerkOffen, setVermerkOffen] = useState(false);
  const istUrteil = eintrag.art === "urteil";
  const o = eintrag.obj;
  const od = istUrteil ? null : beschlussOrtDatum(welt, o);
  const st = istUrteil ? null : sammlungsStatus(o, heute);
  const datum = istUrteil ? o.datum : (od && od.datum);
  const untertitel = istUrteil
    ? (o.gericht + (o.datum ? " · " + datumDe(o.datum) : ""))
    : ((datum ? datumDe(datum) : "—")
      + (od && od.versammlung_art === "umlauf" ? " · Umlauf"
        : o.alt_erfasst ? " · Alt-Bestand" : ""));
  const titelText = istUrteil
    ? "Gerichtsentscheidung (§43)"
    : (o.titel || (o.wortlaut || "").slice(0, 60) || "Beschluss");
  return (
    <div style={{ background: t.card, border: "1px solid " + (offen ? accent + "60" : t.border),
      borderRadius: RAD.md, minWidth: 0 }}>
      <div onClick={onToggle} style={{ padding: "10px 12px", cursor: "pointer",
        display: "flex", alignItems: "center", gap: 10 }}>
        <div style={{ flexShrink: 0, minWidth: 44, textAlign: "center",
          fontSize: FS.s, fontWeight: FW.bold, color: t.text,
          background: t.surface, border: "1px solid " + t.border,
          borderRadius: RAD.sm, padding: "3px 6px" }}>
          {istUrteil ? "⚖ " : ""}{eintrag.nr}</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: FS.s, fontWeight: FW.bold, color: t.text,
            overflowWrap: "anywhere" }}>
            {o.ist_besonders ? "★ " : ""}{titelText}</div>
          <div style={{ fontSize: FS.xs, color: t.muted }}>{untertitel}</div>
        </div>
        {!istUrteil ? (
          <StatusPille t={t} farbe={STATUS_FARBE[st] || t.muted}
            text={SAMMLUNG_STATUS_LABEL[st] || st}/>
        ) : null}
      </div>
      {offen ? (
        <div style={{ padding: "0 12px 12px 12px", display: "flex",
          flexDirection: "column", gap: 8 }}>
          <div style={{ fontSize: FS.s, color: t.text, whiteSpace: "pre-wrap",
            overflowWrap: "anywhere" }}>
            {istUrteil ? o.urteilsformel : (o.wortlaut || "— kein Wortlaut erfasst —")}</div>
          {istUrteil && o.parteien ? (
            <div style={{ fontSize: FS.xs, color: t.muted }}>Parteien: {o.parteien}</div>
          ) : null}
          {!istUrteil && od && od.ort ? (
            <div style={{ fontSize: FS.xs, color: t.muted }}>Ort: {od.ort}</div>
          ) : null}
          {!istUrteil && o.anfechtungsfrist_bis && st === "gefasst" ? (
            <div style={{ fontSize: FS.xs, color: t.muted }}>
              Anfechtungsfrist bis {datumDe(o.anfechtungsfrist_bis)} (§45 WEG)</div>
          ) : null}
          {(o.vermerke || []).length > 0 ? (
            <div style={{ borderLeft: "3px solid " + t.border, paddingLeft: 8,
              display: "flex", flexDirection: "column", gap: 3 }}>
              {(o.vermerke || []).map((v, i) => (
                <div key={i} style={{ fontSize: FS.xs, color: t.sub, fontStyle: "italic" }}>
                  {datumDe(v.datum)}: {v.text}</div>
              ))}
            </div>
          ) : null}
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            {!istUrteil ? (
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <div style={{ fontSize: FS.xs, color: t.muted }}>★ besonders</div>
                <Toggle value={!!o.ist_besonders} color={accent}
                  onChange={(v) => onWelt((w) => weltBeschlussPatch(w, o.id, { ist_besonders: v }))}/>
              </div>
            ) : null}
            <div style={{ flex: 1 }}/>
            <AktionsButton rolle="bestaetigen" variante="breit" t={t} accent={accent}
              onClick={() => setVermerkOffen(true)} text="+ Vermerk"/>
          </div>
          {vermerkOffen ? (
            <VermerkModal t={t} accent={accent} onClose={() => setVermerkOffen(false)}
              onSave={(v) => onWelt((w) => istUrteil
                ? weltGerichtsentscheidungVermerk(w, o.id, v)
                : weltBeschlussVermerk(w, o.id, v))}/>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

// ── Hauptkomponente — renderDetail der Kachel ────────────────────────────────
function BeschlussSammlungFuerObjekt({ ve, welt, onWelt, t, accent }) {
  const [offenId, setOffenId] = useState(null);
  const [filter, setFilter] = useState("alle");     // alle | stern | angefochten | <jahr>
  const [altOffen, setAltOffen] = useState(false);
  const [gerichtOffen, setGerichtOffen] = useState(false);
  const heute = isoHeute();

  const eintraege = sammlungFuerObjekt(welt, ve.id);
  const jahre = [];
  eintraege.forEach((e) => {
    const d = e.art === "urteil" ? e.obj.datum : beschlussOrtDatum(welt, e.obj).datum;
    const j = d ? String(d).slice(0, 4) : null;
    if (j && jahre.indexOf(j) < 0) jahre.push(j);
  });
  jahre.sort().reverse();

  const gefiltert = eintraege.filter((e) => {
    if (filter === "alle") return true;
    if (filter === "stern") return e.art === "beschluss" && e.obj.ist_besonders;
    if (filter === "angefochten")
      return e.art === "beschluss"
        && ["angefochten", "aufgehoben"].indexOf(sammlungsStatus(e.obj, heute)) >= 0;
    const d = e.art === "urteil" ? e.obj.datum : beschlussOrtDatum(welt, e.obj).datum;
    return d && String(d).slice(0, 4) === filter;
  });

  const pille = (id, label) => (
    <button key={id} onClick={() => setFilter(id)}
      style={{ padding: "5px 11px", borderRadius: RAD.pill, cursor: "pointer",
        fontFamily: "inherit", fontSize: FS.xs, flexShrink: 0,
        border: "1px solid " + (filter === id ? accent : t.border),
        background: filter === id ? accent + "22" : t.card,
        color: filter === id ? t.text : t.sub,
        fontWeight: filter === id ? FW.bold : FW.normal }}>{label}</button>
  );

  const vorNummer = naechsteLfdNummer(welt, ve.id);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8, minWidth: 0 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", flex: 1, minWidth: 0 }}>
          {pille("alle", "Alle (" + eintraege.length + ")")}
          {pille("stern", "★")}
          {pille("angefochten", "Angefochten")}
          {jahre.map((j) => pille(j, j))}
        </div>
        <button onClick={() => druckeBeschlussSammlung(ve, welt, heute)}
          title="Sammlung drucken" aria-label="Sammlung drucken"
          style={{ width: 30, height: 30, borderRadius: RAD.sm, flexShrink: 0,
            border: "1px solid " + t.border, background: t.card,
            cursor: "pointer", display: "flex", alignItems: "center",
            justifyContent: "center" }}>
          <I name="download" size={15} color={t.sub}/>
        </button>
      </div>

      {gefiltert.length === 0 ? (
        <div style={{ fontSize: FS.s, color: t.muted, fontStyle: "italic", padding: "8px 0" }}>
          {eintraege.length === 0
            ? "Noch keine Eintragungen. Beschlüsse erhalten ihre Nummer automatisch bei der Verkündung in der ETV — Alt-Bestände und Gerichtsentscheidungen kannst du unten aufnehmen."
            : "Kein Eintrag passt zum Filter."}
        </div>
      ) : gefiltert.map((e) => (
        <SammlungZeile key={e.art + "_" + e.obj.id} eintrag={e} welt={welt} onWelt={onWelt}
          t={t} accent={accent} heute={heute}
          offen={offenId === e.obj.id}
          onToggle={() => setOffenId(offenId === e.obj.id ? null : e.obj.id)}/>
      ))}

      <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
        <div style={{ flex: 1 }}>
          <AktionsButton rolle="bestaetigen" variante="breit" t={t} accent={accent}
            onClick={() => setAltOffen(true)} text="+ Alt-Beschluss"/>
        </div>
        <div style={{ flex: 1 }}>
          <AktionsButton rolle="bestaetigen" variante="breit" t={t} accent={accent}
            onClick={() => setGerichtOffen(true)} text="+ Gerichtsentscheidung"/>
        </div>
      </div>

      {altOffen ? (
        <AltBeschlussModal t={t} accent={accent} vorNummer={vorNummer}
          onClose={() => setAltOffen(false)}
          onSave={(init) => onWelt((w) => weltBeschlussAltNeu(w,
            Object.assign({ objekt_id: ve.id }, init)))}/>
      ) : null}
      {gerichtOffen ? (
        <GerichtModal t={t} accent={accent} vorNummer={vorNummer}
          onClose={() => setGerichtOffen(false)}
          onSave={(init) => onWelt((w) => weltGerichtsentscheidungNeu(w,
            Object.assign({ objekt_id: ve.id }, init)))}/>
      ) : null}
    </div>
  );
}

export { BeschlussSammlungFuerObjekt, druckeBeschlussSammlung };
