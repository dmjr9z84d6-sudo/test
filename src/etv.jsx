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
import React, { useState, useEffect } from "react";
import { AMPEL_FARBEN, FS, FW, RAD, getContrastColor } from "./constants.js";
import { datumDe, isoHeute } from "./utils-basis.js";
import { DatumFeld, Inp, KontaktPickerMitAllen, SegmentControl, TabLeiste, Toggle,
  OverlayKopf, overlayBackdrop, overlayPanel, overlayBody, KopfIconButton, KopfAktionsLeiste } from "./components.jsx";
import { AktionsButton } from "./kontakte-modul.jsx";
import { BausteinKarte, StatusPille } from "./vorgang.jsx";
import { TERegisterAnsicht, alleEinheitenVonVe } from "./objektansicht.jsx";
import { DateiViewerModal, gemeinschaftName, istEigentuemergemeinschaft, neueDokumentKarte } from "./liegenschaft.jsx";
import { I } from "./utils-icons.jsx";
import { dateiLaden, dateiLoeschen, dateiSpeichern } from "./utils-basis.js";
import { druckeHtml } from "./listen-tools.jsx";
import { bauePdf } from "./pdfbauer.js";
import {
  ETV_ARTEN, ETV_DURCHFUEHRUNG, ETV_STATUS_KETTE, ETV_STATUS_LABEL,
  TOP_BAUSTEINE, eigStatus, kontaktNameVonId, fotoDateiname,
  ladungsfristInfo, einladungsStichtag, etvStammVomObjekt, etvSichtklasse,
  offeneOrdentlicheEtv, garantiereOffeneEtv,
  versammlungenFuerObjekt, topsFuerVersammlung,
  anwesenheitenFuer, beschlussfaehigkeitInfo, etvNaechsterSchritt,
  neueAnwesenheit, neueVersammlung,
  weltVersammlungPatch, weltVersammlungLoeschen,
  weltVersammlungUnterlage, weltVersammlungUnterlageWeg, UNTERLAGE_ART_LABEL,
  weltTopNeu, weltTopPatch, weltTopLoeschen, weltTopVerschieben,
  weltTopAbstimmen, weltBeschlussPatch, weltAnwesenheitenSetzen, weltTopVertagen,
  MEHRHEITSTYPEN, berechneAbstimmung,
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

// Anwesenheits-Zeilen aus der Eigentümer-Struktur ERZEUGEN — Ausbau-Konzept §1
// (12.07.): EINE Zeile pro EINHEIT = ein Stimmrecht. Alle Eigentümer stehen
// namentlich drauf (Ehepaar/Erbengemeinschaft); es reicht, dass einer erscheint.
// Die Quoten-Aufteilung (§62.5) wirkt hier NICHT — sie bleibt Grundbuch-Doku.
// stimmgewicht nach Prinzip: MEA = einheit.mea · Objekt/Kopf = 1.
function etvAnwesenheitZeilen(ve, versammlungId, stimmprinzip) {
  const rows = [];
  const nachMea = (stimmprinzip || "MEA") === "MEA";
  alleEinheitenVonVe(ve).forEach((e) => {
    if (!e) return;
    let namen = "";
    let ids = [];
    const aktive = (e.eigentuemer || []).filter((p) => p && eigStatus(p) === "aktiv");
    if (istEigentuemergemeinschaft(e)) {
      namen = gemeinschaftName(e);
      ids = aktive.filter((p) => p.kontaktId != null).map((p) => p.kontaktId);
    } else {
      namen = aktive.map((p) => p.name || "").filter(Boolean).join(" · ");
      ids = aktive.filter((p) => p.kontaktId != null).map((p) => p.kontaktId);
    }
    if (!namen) return; // Einheit ohne aktive Eigentümer: kein Stimmrecht, keine Zeile
    rows.push(neueAnwesenheit({ versammlung_id: versammlungId,
      einheit_id: e.id != null ? e.id : null, einheit_nr: e.nr || "",
      eigentuemer_namen: namen, eigentuemer_kontakt_ids: ids,
      stimmgewicht: nachMea ? zahl(e.mea) : 1,
      mea_einheit: zahl(e.mea) }));  // echtes MEA IMMER (Cockpit-MEA-Spur, 14.07.)
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
// ── FristHinweis — Live-Klartext beim Termin-Setzen (§2.9) ──────────────────
// Zeigt sofort, bis wann die Einladung raus muss (Termin − 21 Tage). Rot, wenn
// der Stichtag schon in der Vergangenheit liegt (Frist nicht mehr einhaltbar).
function FristHinweis({ datum, t }) {
  if (!datum) return null;
  const stichtag = einladungsStichtag(datum);
  if (!stichtag) return null;
  const verpasst = stichtag < isoHeute();
  const farbe = verpasst ? (AMPEL_FARBEN.rot || "#DC2626") : t.muted;
  return (
    <div style={{ fontSize: FS.xs, color: farbe, marginTop: -4 }}>
      {verpasst
        ? "3-Wochen-Frist nicht mehr einhaltbar (Stichtag " + datumDe(stichtag) + " war schon)"
        : "Einladung bis " + datumDe(stichtag) + " versenden (3-Wochen-Frist)"}
    </div>
  );
}

// ── DurchfuehrungWahl — Präsenz/Hybrid wählbar, Online gesperrt (§2.10) ──────
// Eigenbau statt SegmentControl, weil dieser keine disabled-Option + Hinweis
// kann (SONDERFALL: rechtlich gesperrte Zukunftsoption). Hybrid nur wählbar,
// wenn am Objekt die Zuschaltung möglich ist (hybridMoeglich).
function DurchfuehrungWahl({ value, onChange, hybridMoeglich, t, accent }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <div style={{ display: "inline-flex", gap: 4, background: t.surface,
        border: "1px solid " + t.border, borderRadius: RAD.md, padding: 3,
        maxWidth: "100%", flexWrap: "wrap" }}>
        {ETV_DURCHFUEHRUNG.map((opt) => {
          const gesperrt = opt.disabled || (opt.id === "hybrid" && !hybridMoeglich);
          const aktiv = value === opt.id;
          return (
            <button key={opt.id} disabled={gesperrt}
              onClick={() => { if (!gesperrt) onChange(opt.id); }}
              title={opt.id === "hybrid" && !hybridMoeglich
                ? "Am Versammlungsort nicht möglich" : (opt.hinweis || "")}
              style={{ padding: "6px 12px", borderRadius: RAD.sm,
                background: aktiv ? accent : "transparent",
                color: gesperrt ? t.muted : (aktiv ? getContrastColor(accent) : t.sub),
                border: "none", cursor: gesperrt ? "not-allowed" : "pointer",
                fontFamily: "inherit", fontSize: FS.m, fontWeight: FW.medium,
                opacity: gesperrt ? 0.5 : 1, whiteSpace: "nowrap" }}>
              {opt.label}
            </button>
          );
        })}
      </div>
      <div style={{ fontSize: FS.xs, color: t.muted }}>
        Rein virtuelle Versammlung: ab 2029 uneingeschränkt möglich.
        {!hybridMoeglich ? " · Hybrid am Versammlungsort derzeit nicht hinterlegt." : ""}
      </div>
    </div>
  );
}

function VersammlungNeuForm({ ve, welt, kontakte, t, accent, onAnlegen, onAbbrechen }) {
  // Nur AUSSERORDENTLICHE ETV + UMLAUFBESCHLUSS werden hier neu angelegt (§2.3b).
  // Die ordentliche ETV existiert als Auto-Hülle und wird nur TERMINIERT (über
  // ihre Zeile geöffnet, Termin in der Akte gesetzt) — sie ist hier bewusst KEINE
  // Option, sonst entstünden Dubletten neben der Hülle.
  const neuArten = ETV_ARTEN.filter((a) => a.id !== "ordentlich");
  // Vorbelegung aus Objekt-Stammdaten (§2.7) + jüngster Versammlung (Personen).
  const s = etvStammVomObjekt(ve);
  const letzte = versammlungenFuerObjekt(welt || {}, ve.id)
    .filter((v) => v.datum)
    .sort((a, b) => String(b.datum || "").localeCompare(String(a.datum || "")))[0] || {};
  const [vArt, setVArt] = useState("ausserordentlich");
  const [datum, setDatum] = useState("");
  const [uhrzeit, setUhrzeit] = useState(letzte.uhrzeit || "");
  const [ort, setOrt] = useState(letzte.ort || s.versammlungsort || "");
  const [durch, setDurch] = useState("praesenz");
  const [leiterId, setLeiterId] = useState(letzte.leiter_kontakt_id || "");
  const [protokollId, setProtokollId] = useState(letzte.protokollfuehrer_kontakt_id || "");
  const beiratVorsitzId = letzte.beirat_vorsitz_kontakt_id || null;
  const beiratIds = letzte.beirat_mitglied_kontakt_ids || [];
  const istUmlauf = vArt === "umlauf";
  const legeAn = () => {
    onAnlegen({
      objekt_id: ve.id, versammlung_art: vArt,
      art: istUmlauf ? "praesenz" : durch,
      datum: datum || null, uhrzeit: istUmlauf ? "" : uhrzeit,
      ort: istUmlauf ? "" : ort,
      stimmprinzip: s.abstimmung,
      wirtschaftsjahr: s.wirtschaftsjahr,
      leiter_kontakt_id: leiterId || null,
      protokollfuehrer_kontakt_id: protokollId || null,
      beirat_vorsitz_kontakt_id: beiratVorsitzId,
      beirat_mitglied_kontakt_ids: beiratIds,
    });
  };
  return (
    <div style={{ background: t.surface, border: "1px solid " + accent + "50",
      borderRadius: RAD.md, padding: 12, display: "flex", flexDirection: "column", gap: 10 }}>
      <div style={{ fontSize: FS.m, fontWeight: FW.bold, color: t.text }}>
        Außerordentliche Versammlung / Umlaufbeschluss</div>
      <SegmentControl t={t} accent={accent} value={vArt} onChange={setVArt}
        options={neuArten.map((a) => ({ id: a.id, label: a.label }))}/>
      <DatumFeld t={t} accent={accent} iso
        label={istUmlauf ? "Stichtag (Rücklauf bis)" : "Termin"}
        value={datum} onChange={setDatum} defaultHeute={false}/>
      {!istUmlauf ? (
        <>
          {datum ? <FristHinweis datum={datum} t={t} /> : null}
          <Inp t={t} accent={accent} label="Uhrzeit" value={uhrzeit}
            onChange={setUhrzeit} placeholder="z. B. 18:30"/>
          <Inp t={t} accent={accent} label="Ort" value={ort}
            onChange={setOrt} placeholder="z. B. Gemeindesaal, Musterstr. 1"/>
          <DurchfuehrungWahl t={t} accent={accent} value={durch} onChange={setDurch}
            hybridMoeglich={s.hybridMoeglich}/>
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

// ── VersammlungNeuOverlay (§12.8) — Anlege-Dialog des ETV-Screen-Plus ───────
// Overlay nach Vorgänge-Muster: Objektwahl als ERSTES Feld (vorbelegt bei
// offener Akte, sonst wählbar); darunter das bestehende VersammlungNeuForm
// (Single Truth — kein Zweitbau des Formulars). Die Anlege-Logik entspricht
// 1:1 dem früheren Inline-Pfad in EtvBereichFuerObjekt.
function VersammlungNeuOverlay({ ve, welt, kontakte, t, accent, objektWahl,
  onWelt, onVePatch, onClose, onFertig }) {
  return (
    <div style={overlayBackdrop()} onClick={onClose}>
      <div style={overlayPanel(t)} onClick={(e) => e.stopPropagation()}>
        <OverlayKopf t={t} titel={"Neue Versammlung · " + ((ve && (ve.nr || ve.name)) || "Objekt")} onClose={onClose}/>
        <div style={overlayBody()}>
          {objektWahl ? (
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: FS.s, fontWeight: FW.med, color: t.sub,
                marginBottom: 4 }}>Objekt *</div>
              <select value={objektWahl.aktivId != null ? String(objektWahl.aktivId) : ""}
                onChange={(e) => objektWahl.onWaehle && objektWahl.onWaehle(e.target.value || null)}
                style={{ width: "100%", padding: "10px 12px", fontSize: 16,
                  background: t.card, color: t.text, border: `1px solid ${t.border}`,
                  borderRadius: RAD.ms, boxSizing: "border-box", fontFamily: "inherit" }}>
                <option value="">— Objekt wählen —</option>
                {(objektWahl.ves || []).map((v) => (
                  <option key={v.id} value={String(v.id)}>
                    {(v.nr ? v.nr + " · " : "") + (v.adresse || v.name || "")}
                  </option>
                ))}
              </select>
            </div>
          ) : null}
          {!ve ? (
            <div style={{ fontSize: FS.m, color: t.muted, fontStyle: "italic",
              padding: "4px 2px 8px" }}>
              Bitte zuerst ein Objekt wählen.
            </div>
          ) : (
            <VersammlungNeuForm ve={ve} welt={welt} kontakte={kontakte} t={t} accent={accent}
              onAbbrechen={onClose}
              onAnlegen={(init) => {
                const v = neueVersammlung(init);
                onWelt((w) => Object.assign({}, w,
                  { versammlungen: [...(w.versammlungen || []), v] }));
                if (v.datum) syncNaechsteEtvInsObjekt(
                  [...(welt.versammlungen || []), v], ve.id, onVePatch);
                if (onFertig) onFertig(v.id);
              }}/>
          )}
        </div>
      </div>
    </div>
  );
}

// ── VersammlungZeile — Listenzeile (aktive Liste + Archiv) ──────────────────
function VersammlungZeile({ versammlung, welt, t, accent, onOeffnen }) {
  const frist = ladungsfristInfo(versammlung);
  const tops = topsFuerVersammlung(welt, versammlung.id);
  const istOrdentlichOhneTermin = versammlung.versammlung_art === "ordentlich"
    && !versammlung.datum && !versammlung.archiviert;
  // Countdown zum Einladungs-Stichtag (§2.9): nur solange Termin gesetzt,
  // Ladung noch nicht raus und Stichtag in der Zukunft.
  let countdown = null;
  if (versammlung.datum && !versammlung.ladung_versendet_am) {
    const st = einladungsStichtag(versammlung.datum);
    if (st) {
      const rest = Math.round(
        (new Date(st + "T00:00:00") - new Date(isoHeute() + "T00:00:00")) / 86400000);
      if (rest >= 0) countdown = "noch " + rest + " Tag" + (rest === 1 ? "" : "e") + " zum Einladen";
      else countdown = "Einladungsfrist überschritten";
    }
  }
  const sub = [
    versammlung.datum ? datumDe(versammlung.datum) : "Termin offen",
    versammlung.uhrzeit || null,
    versammlung.ort || null,
    tops.length > 0 ? tops.length + " TOP" + (tops.length > 1 ? "s" : "") : null,
  ].filter(Boolean).join(" · ");
  const istFertig = versammlung.status === "abgeschlossen";
  return (
    <div onClick={onOeffnen} style={{ background: t.card,
      border: "1px solid " + t.border, borderRadius: RAD.lg,
      padding: "11px 13px", cursor: "pointer", minWidth: 0,
      opacity: istFertig ? 0.72 : 1 }}>
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
      {istOrdentlichOhneTermin ? (
        <div style={{ fontSize: FS.xs, color: accent, marginTop: 4, fontWeight: FW.bold }}>
          Termin setzen — Sammelstelle für vertagte &amp; vorgemerkte Beschlüsse
        </div>
      ) : null}
      {countdown ? (
        <div style={{ fontSize: FS.xs, marginTop: 4,
          color: frist.status === "rot" ? (AMPEL_FARBEN.rot || "#DC2626") : t.muted }}>
          {countdown}
        </div>
      ) : null}
    </div>
  );
}

// ── Tab 1 · ÜBERSICHT — errechneter Kopf + Stammdaten + Anwesenheit ─────────
function EtvUebersichtTab({ versammlung, ve, onVePatch, welt, onWelt, kontakte, t, accent, editModeGlobal = false,
  bilderEinbetten = false, setBilderEinbetten = () => {}, einzelstimmen = false, setEinzelstimmen = () => {}, onUnterlageAnsehen = () => {} }) {
  // Karten unabhängig auf-/zuklappbar (Set statt Single) — Gesamtüberblick:
  // mehrere Karten können gleichzeitig offen bleiben. Default: Stand offen.
  const [offenSet, setOffenSet] = useState(() => ({ stand: true }));
  const [editStamm, setEditStamm] = useState(false);
  // Globaler Bearbeiten-Modus (Kopf-Stift der Akte) schaltet die Stammdaten-
  // Bearbeitung frei; die Karte klappt dabei auf.
  useEffect(() => {
    if (editModeGlobal) { setOffenSet(s => ({ ...s, stamm: true })); setEditStamm(true); }
    else { setEditStamm(false); }
  }, [editModeGlobal]);
  const tops = topsFuerVersammlung(welt, versammlung.id);
  const anw = anwesenheitenFuer(welt, versammlung.id);
  const frist = ladungsfristInfo(versammlung);
  const stamm = (ve && ve.etvStamm) || {};
  const bf = beschlussfaehigkeitInfo(anw, stamm.gesamtanteile, versammlung.stimmprinzip);
  const schritte = etvNaechsterSchritt(versammlung, tops, anw);
  const abgestimmt = tops.filter((tp) => tp.beschluss_noetig && tp.beschluss_id).length;
  const abstNoetig = tops.filter((tp) => tp.beschluss_noetig).length;
  const patch = (p) => onWelt((w) => weltVersammlungPatch(w, versammlung.id, p));
  const statusIdx = ETV_STATUS_KETTE.indexOf(versammlung.status);
  const istUmlauf = versammlung.versammlung_art === "umlauf";
  const istOffen = (id) => !!offenSet[id];
  const toggle = (id) => setOffenSet(s => ({ ...s, [id]: !s[id] }));

  // Anwesenheit erzeugen/aktualisieren.
  const anwErzeugen = () => {
    onWelt((w) => weltAnwesenheitenSetzen(w, versammlung.id,
      etvAnwesenheitZeilen(ve, versammlung.id, versammlung.stimmprinzip)));
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
        offen={istOffen("stand")} onToggle={() => toggle("stand")}
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
        offen={istOffen("stamm")} onToggle={() => toggle("stamm")}
        kopfAktion={!editStamm ? (
          <KopfIconButton icon="pencil" title="Stammdaten bearbeiten" t={t} accent={accent}
            onClick={() => { setOffenSet(s => ({ ...s, stamm: true })); setEditStamm(true); }}/>
        ) : null}
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
                ? kontaktNameVonId(kontakte, versammlung.leiter_kontakt_id) : "—"],
              ["Protokollführer", versammlung.protokollfuehrer_kontakt_id
                ? kontaktNameVonId(kontakte, versammlung.protokollfuehrer_kontakt_id) : "—"],
              ["Beirat (Vorsitz)", versammlung.beirat_vorsitz_kontakt_id
                ? kontaktNameVonId(kontakte, versammlung.beirat_vorsitz_kontakt_id) : "—"],
              ["Beirat (Mitglieder)", (versammlung.beirat_mitglied_kontakt_ids || []).length > 0
                ? (versammlung.beirat_mitglied_kontakt_ids || [])
                    .map((id) => kontaktNameVonId(kontakte, id)).join(", ")
                : "—"],
            ].map((z, i) => (
              <div key={i} style={{ display: "flex", gap: 8, fontSize: FS.s }}>
                <div style={{ width: 150, flexShrink: 0, color: t.muted }}>{z[0]}</div>
                <div style={{ flex: 1, minWidth: 0, color: t.text, overflowWrap: "anywhere" }}>{z[1]}</div>
              </div>
            ))}
            {/* §12.9: Bearbeiten läuft über den Stift im Karten-Kopf. */}
          </div>
        ) : (
          <EtvStammEdit versammlung={versammlung} kontakte={kontakte} ve={ve}
            t={t} accent={accent}
            onSave={(p) => {
              patch(p);
              if (p.datum) syncNaechsteEtvInsObjekt(
                (welt.versammlungen || []).map((v) =>
                  (v && v.id === versammlung.id) ? Object.assign({}, v, p) : v),
                versammlung.objekt_id, onVePatch);
              setEditStamm(false); }}
            onAbbruch={() => setEditStamm(false)}/>
        )}
      </BausteinKarte>

      {/* Anwesenheit-Karte (Präsenz-Erfassung §4.1 / Umlauf-Rücklauf) */}
      <BausteinKarte t={t} accent={accent}
        titel={istUmlauf ? "Rücklauf (schriftlich)" : "Anwesenheit"}
        anzahl={anw.length > 0 ? anw.filter((a) => a.status === "anwesend" || a.status === "vertreten").length + "/" + anw.length : null}
        offen={istOffen("anw")} onToggle={() => toggle("anw")}
        sub={anw.length > 0 ? bf.text : "noch nicht erfasst"}>
        {anw.length === 0 ? (
          <div>
            <div style={{ fontSize: FS.s, color: t.muted, marginBottom: 8 }}>
              Erzeugt EINE Zeile je Einheit — ein Stimmrecht pro Einheit
              (alle Eigentümer stehen drauf, einer genügt). Gewicht nach
              Stimmprinzip ({versammlung.stimmprinzip || "MEA"}).
            </div>
            <AktionsButton rolle="bestaetigen" variante="breit" t={t} accent={accent}
              onClick={anwErzeugen} text={istUmlauf ? "Rücklauf-Liste erzeugen" : "Anwesenheitsliste erzeugen"}/>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            {anw.map((a) => (
              <div key={a.id} style={{ padding: "6px 0", borderBottom: "1px solid " + t.border }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: FS.s, fontWeight: FW.bold, color: t.text,
                      overflowWrap: "anywhere" }}>{a.eigentuemer_namen || "—"}</div>
                    <div style={{ fontSize: FS.xs, color: t.muted }}>
                      {(a.einheit_nr ? "Einheit " + a.einheit_nr + " · " : "")
                        + ((versammlung.stimmprinzip || "MEA") === "MEA"
                          ? meaStr(a.stimmgewicht) + " MEA" : "1 Stimme")}
                    </div>
                  </div>
                  <SegmentControl t={t} accent={accent} voll={false}
                    value={a.status || "abwesend"}
                    onChange={(v) => anwPatch(a.id, { status: v,
                      zugang: istUmlauf ? "schriftlich" : "praesenz" })}
                    options={[{ id: "abwesend", label: "—" },
                      { id: "anwesend", label: "da" },
                      { id: "vertreten", label: "vertr." }]}/>
                </div>
                {a.status === "vertreten" ? (
                  <div style={{ marginTop: 6, marginLeft: 10, paddingLeft: 10,
                    borderLeft: "2px solid " + accent + "60",
                    display: "flex", flexDirection: "column", gap: 6 }}>
                    <input value={a.vertreten_durch || ""}
                      onChange={(ev) => anwPatch(a.id, { vertreten_durch: ev.target.value })}
                      placeholder="vertreten durch…"
                      style={{ fontSize: 16, padding: "5px 8px", borderRadius: RAD.sm,
                        border: "1px solid " + t.border, background: t.card,
                        color: t.text, boxSizing: "border-box", width: "100%" }}/>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <Toggle value={!!a.ist_verwaltervollmacht} color={accent}
                        onChange={(v) => anwPatch(a.id, { ist_verwaltervollmacht: v })}/>
                      <div style={{ fontSize: FS.xs, color: t.muted }}>
                        Verwalter-Vollmacht (§25 WEG)</div>
                    </div>
                    {tops.filter((tp) => tp.beschluss_noetig).length > 0 ? (
                      <div>
                        <div style={{ fontSize: FS.xs, fontWeight: FW.bold, color: t.muted,
                          textTransform: "uppercase", letterSpacing: 0.4, marginBottom: 3 }}>
                          Weisungen (je TOP, fürs Protokoll)</div>
                        {tops.filter((tp) => tp.beschluss_noetig).map((tp) => {
                          const w = (a.weisungen || {})[tp.id] || "";
                          const setW = (v) => {
                            const neu = Object.assign({}, a.weisungen || {});
                            if (v && v !== w) neu[tp.id] = v; else delete neu[tp.id];
                            anwPatch(a.id, { weisungen: neu });
                          };
                          return (
                            <div key={tp.id} style={{ display: "flex", alignItems: "center",
                              gap: 8, padding: "3px 0" }}>
                              <div style={{ flex: 1, minWidth: 0, fontSize: FS.xs,
                                color: t.text, overflowWrap: "anywhere" }}>
                                TOP {tp.nummer} · {tp.titel}</div>
                              <SegmentControl t={t} accent={accent} voll={false}
                                value={w} onChange={setW}
                                options={[{ id: "ja", label: "Ja" },
                                  { id: "nein", label: "Nein" },
                                  { id: "enthaltung", label: "Enth." }]}/>
                            </div>
                          );
                        })}
                      </div>
                    ) : null}
                  </div>
                ) : null}
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

      {/* Protokoll-Pflichtangaben (§24 WEG, Ausbau-Konzept §3) */}
      <BausteinKarte t={t} accent={accent} titel="Protokoll"
        offen={istOffen("protokoll")} onToggle={() => toggle("protokoll")}
        sub={versammlung.protokoll_beginn
          ? "Beginn " + versammlung.protokoll_beginn
            + (versammlung.protokoll_ende ? " · Ende " + versammlung.protokoll_ende : "")
          : "Pflichtangaben noch nicht erfasst"}>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <div style={{ display: "flex", gap: 8 }}>
            <div style={{ flex: 1 }}>
              <Inp t={t} accent={accent} label="Beginn" value={versammlung.protokoll_beginn || ""}
                onChange={(v) => patch({ protokoll_beginn: v })} placeholder="z. B. 18:30"/>
            </div>
            <div style={{ flex: 1 }}>
              <Inp t={t} accent={accent} label="Ende" value={versammlung.protokoll_ende || ""}
                onChange={(v) => patch({ protokoll_ende: v })} placeholder="z. B. 20:15"/>
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Toggle value={!!versammlung.einladung_festgestellt} color={accent}
              onChange={(v) => patch({ einladung_festgestellt: v })}/>
            <div style={{ fontSize: FS.s, color: t.text }}>
              Ordnungsgemäße Einladung festgestellt
              <div style={{ fontSize: FS.xs, color: t.muted }}>
                Setzt den Standardsatz ins Protokoll (§24 WEG)</div>
            </div>
          </div>
          <div>
            <div style={{ fontSize: FS.xs, fontWeight: FW.bold, color: t.muted,
              textTransform: "uppercase", letterSpacing: 0.4, marginBottom: 4 }}>
              Unterschriften (Leiter · ein Eigentümer · Beiratsvorsitz)</div>
            <KontaktPickerMitAllen t={t} accent={accent}
              kontakteObjekt={null} kontakteAlle={kontakte}
              label="Unterschreibender Eigentümer" value={versammlung.unterschrift_eigentuemer_kontakt_id || null}
              onChange={(id) => patch({ unterschrift_eigentuemer_kontakt_id: id || null })}/>
          </div>
          <div style={{ fontSize: FS.xs, color: t.muted }}>
            Optional digital festhalten, wann unterschrieben wurde:</div>
          <DatumFeld t={t} accent={accent} iso label="Leiter unterschrieben am"
            value={versammlung.unterschrift_leiter_am || ""}
            onChange={(v) => patch({ unterschrift_leiter_am: v || null })} defaultHeute={false}/>
          <DatumFeld t={t} accent={accent} iso label="Eigentümer unterschrieben am"
            value={versammlung.unterschrift_eigentuemer_am || ""}
            onChange={(v) => patch({ unterschrift_eigentuemer_am: v || null })} defaultHeute={false}/>
          {versammlung.beirat_vorsitz_kontakt_id ? (
            <DatumFeld t={t} accent={accent} iso label="Beiratsvorsitz unterschrieben am"
              value={versammlung.unterschrift_beirat_am || ""}
              onChange={(v) => patch({ unterschrift_beirat_am: v || null })} defaultHeute={false}/>
          ) : null}
          <div>
            <div style={{ fontSize: FS.xs, fontWeight: FW.bold, color: t.muted,
              textTransform: "uppercase", letterSpacing: 0.4, marginBottom: 4 }}>
              Anlagen zum Protokoll</div>
            <AnlagenBlock t={t} accent={accent} ve={ve} onVePatch={onVePatch} welt={welt}
              anlagen={versammlung.anlagen} gesperrt={false}
              kontextTitel={"ETV " + (versammlung.datum ? versammlung.datum.slice(0, 4) : "")}
              onAnlagen={(neu) => patch({ anlagen: neu })}/>
          </div>
          {/* §12.9: Druck-Optionen gehören zum Protokoll — hier in der Karte;
              der Druck selbst läuft über den Drucker-Button im Karten-Kopf. */}
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 4 }}>
            <Toggle value={bilderEinbetten} color={accent} onChange={setBilderEinbetten}/>
            <div style={{ fontSize: FS.s, color: t.text }}>
              Bilder eingebettet drucken
              <div style={{ fontSize: FS.xs, color: t.muted }}>
                Bild-Anlagen als Abbildungen ins Protokoll; PDFs bleiben Verzeichnis-Einträge</div>
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 4 }}>
            <Toggle value={einzelstimmen} color={accent} onChange={setEinzelstimmen}/>
            <div style={{ fontSize: FS.s, color: t.text }}>
              Einzelstimmen namentlich drucken
              <div style={{ fontSize: FS.xs, color: t.muted }}>
                Je Beschluss eine Tabelle, wer wie gestimmt hat (nur Cockpit-Abstimmungen)</div>
            </div>
          </div>
        </div>
      </BausteinKarte>

      {/* Unterlagen (§4.2, 19.07.): der ETV-Ordner — erzeugte PDFs
          (Einladung, Tagesordnung, Protokoll), ansehen + im Bearbeiten löschen. */}
      <EtvUnterlagenKarte versammlung={versammlung} onWelt={onWelt} t={t}
        accent={accent} editModeGlobal={editModeGlobal}
        onAnsehen={onUnterlageAnsehen}/>

      {/* §12.9: Drucken + Löschen laufen über runde Icon-Buttons in den
          Karten-/Akten-Köpfen. Hier verbleibt nur die Archiv-Statusaktion. */}
      {versammlung.status === "abgeschlossen" ? (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 4 }}>
          <AktionsButton rolle={versammlung.archiviert ? "abbrechen" : "bestaetigen"}
            variante="breit" t={t} accent={accent}
            onClick={() => patch({ archiviert: !versammlung.archiviert })}
            text={versammlung.archiviert ? "Aus dem Archiv holen" : "Ins Archiv legen"}/>
        </div>
      ) : null}
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
  const [beiratVorsitzId, setBeiratVorsitzId] = useState(versammlung.beirat_vorsitz_kontakt_id || "");
  const [beiratIds, setBeiratIds] = useState(versammlung.beirat_mitglied_kontakt_ids || []);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <SegmentControl t={t} accent={accent} value={vArt} onChange={setVArt}
        options={ETV_ARTEN.map((a) => ({ id: a.id, label: a.label }))}/>
      <DatumFeld t={t} accent={accent} iso label={vArt === "umlauf" ? "Stichtag" : "Termin"}
        value={datum} onChange={setDatum} defaultHeute={false}/>
      {vArt !== "umlauf" && datum ? <FristHinweis datum={datum} t={t} /> : null}
      {vArt !== "umlauf" ? (
        <>
          <Inp t={t} accent={accent} label="Uhrzeit" value={uhrzeit} onChange={setUhrzeit}/>
          <Inp t={t} accent={accent} label="Ort" value={ort} onChange={setOrt}/>
          <DurchfuehrungWahl t={t} accent={accent} value={durch} onChange={setDurch}
            hybridMoeglich={etvStammVomObjekt(ve).hybridMoeglich}/>
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
      <KontaktPickerMitAllen t={t} accent={accent}
        kontakteObjekt={null} kontakteAlle={kontakte}
        label="Verwaltungsbeirat (Vorsitz)" value={beiratVorsitzId || null}
        onChange={(id) => setBeiratVorsitzId(id || "")}/>
      <div>
        <div style={{ fontSize: FS.xs, fontWeight: FW.bold, color: t.muted,
          textTransform: "uppercase", letterSpacing: 0.4, marginBottom: 4 }}>
          Beirat — weitere Mitglieder</div>
        {beiratIds.map((id) => (
          <div key={id} style={{ display: "flex", alignItems: "center", gap: 8,
            padding: "3px 0" }}>
            <div style={{ flex: 1, minWidth: 0, fontSize: FS.s, color: t.text,
              overflowWrap: "anywhere" }}>{kontaktNameVonId(kontakte, id)}</div>
            <button onClick={() => setBeiratIds(beiratIds.filter((x) => x !== id))}
              style={{ width: 26, height: 26, borderRadius: RAD.pill, flexShrink: 0,
                border: "1px solid " + t.border, background: t.card, color: t.muted,
                cursor: "pointer", lineHeight: 1 }}>×</button>
          </div>
        ))}
        <KontaktPickerMitAllen t={t} accent={accent}
          kontakteObjekt={null} kontakteAlle={kontakte}
          label="Mitglied hinzufügen" value={null}
          onChange={(id) => {
            if (id && beiratIds.indexOf(id) === -1 && id !== beiratVorsitzId) {
              setBeiratIds([...beiratIds, id]);
            }
          }}/>
      </div>
      <div style={{ display: "flex", gap: 8 }}>
        <AktionsButton rolle="bestaetigen" variante="breit" t={t} accent={accent}
          onClick={() => onSave({ versammlung_art: vArt, datum: datum || null,
            uhrzeit: vArt === "umlauf" ? "" : uhrzeit, ort: vArt === "umlauf" ? "" : ort,
            art: vArt === "umlauf" ? "online" : durch,
            ladung_versendet_am: ladung || null,
            leiter_kontakt_id: leiterId || null,
            protokollfuehrer_kontakt_id: protokollId || null,
            beirat_vorsitz_kontakt_id: beiratVorsitzId || null,
            beirat_mitglied_kontakt_ids: beiratIds })}
          text="Speichern"/>
        <AktionsButton rolle="abbrechen" variante="breit" t={t}
          onClick={onAbbruch} text="Abbrechen"/>
      </div>
    </div>
  );
}

// ── TOP-Ausgang-Ampel (Beschluss-Sammlung-Konzept §5.1, 13.07.) ──────────────
// EINE Funktion für Karten-Punkt, Abstimmungs-Pille und Deckblatt:
// 🟢 angenommen · 🔴 abgelehnt · 🟡 vertagt · grau offen · null (kein Beschluss).
// Erfassung UNVERÄNDERT über die Zahlen — die Ampel FOLGT dem Ergebnis.
function topAusgang(top, beschluss) {
  if (top.vertagt) return { farbe: AMPEL_FARBEN.gelb, label: "Vertagt" };
  if (beschluss && beschluss.ergebnis === "angenommen")
    return { farbe: AMPEL_FARBEN.gruen, label: "Angenommen" };
  if (beschluss && beschluss.ergebnis === "abgelehnt")
    return { farbe: AMPEL_FARBEN.rot, label: "Abgelehnt" };
  if (top.beschluss_noetig) return { farbe: AMPEL_FARBEN.grau, label: "Beschluss offen" };
  return null;
}

// ── Termin-Sync (§2.9-Rest, entschieden 13.07.): Rückschreiben ───────────────
// Setzt/ändert ein Save den Versammlungs-Termin, wird das Objekt-Feld
// „Nächste ETV" nachgezogen (Empfehlung §2.9: Objekt-Übersicht + Kalender-
// Fallback bleiben konsistent; der Kalender-VORRANG der Versammlungsdaten ist
// seit Block 2 gebaut). Regel: das Datum der FRÜHESTEN offenen zukünftigen
// Versammlung (ordentlich + außerordentlich; Umlauf ist keine Versammlung).
// Geschrieben werden BEIDE Lese-Quellen: ve.verwaltung.naechsteETV (Fallback)
// und das Kartenfeld „Nächste ETV" (nur wenn Karte/Feld existieren — nichts
// erzeugen). Kein Termin gefunden → NICHT leeren (manuelle Pflege respektieren).
function syncNaechsteEtvInsObjekt(versammlungen, objektId, onVePatch) {
  if (!onVePatch) return;
  const heute = isoHeute();
  const offene = (versammlungen || []).filter((v) => v && v.objekt_id === objektId
    && !v.archiviert && v.status !== "abgeschlossen"
    && v.versammlung_art !== "umlauf" && v.datum && v.datum >= heute)
    .sort((a, b) => (a.datum < b.datum ? -1 : 1));
  if (offene.length === 0) return;
  const datum = offene[0].datum;
  onVePatch((v) => {
    const vw = Object.assign({}, v.verwaltung || {}, { naechsteETV: datum });
    const vk = Array.isArray(v.verwaltungsKarten)
      ? v.verwaltungsKarten.map((k) => {
          if (!k || k.kategorie !== "etv" || !Array.isArray(k.stamm)) return k;
          return Object.assign({}, k, { stamm: k.stamm.map((f) =>
            (f && f.name === "Nächste ETV") ? Object.assign({}, f, { value: datum }) : f) });
        })
      : v.verwaltungsKarten;
    return Object.assign({}, v, { verwaltung: vw, verwaltungsKarten: vk });
  });
}

// ── Anlage-Picker (Ausbau-Konzept §4, 13.07.) ────────────────────────────────
// Zweistufiges Kachel-Modal (kanonisches Modal-Muster §76.4/§85.2):
//   Stufe 1 · zwei Quellen-Kacheln (Vom Gerät / Aus Dokumenten und Fotos)
//   Stufe 2a · Upload: Datei + Titelfeld (vorbelegt mit Auto-Namen). Datei landet
//              als Zeile an der Katalog-Karte „Versammlungen (ETV)" — eine Wahrheit.
//   Stufe 2b · Auswahl: Liste aller Objekt-Dokumente + Objekt-Fotos, antippen = wählen.
// Kamera: KEIN eigener Button — der native iOS-Datei-Dialog bietet „Foto
// aufnehmen" ohnehin an (§4.1, deckt sich mit §93.8).
// Anlage-Referenz: {id, titel, quelle:"dokument"|"foto", refId, dateiRef}.
const DOK_ACCEPT = ".pdf,image/*,.doc,.docx,.xls,.xlsx,.txt";

function anlId() { return "anl_" + Date.now().toString(36) + Math.floor(Math.random() * 999); }

// Alle Anlage-Referenzen der ETV-Welt eines Objekts (Mehrfach-Referenz-Prüfung §4.5).
function alleEtvAnlagen(welt, objektId) {
  const res = [];
  (welt.versammlungen || []).forEach((v) => {
    if (!v || v.objekt_id !== objektId) return;
    (v.anlagen || []).forEach((a) => res.push(a));
  });
  (welt.tops || []).forEach((tp) => {
    if (!tp) return;
    (tp.anlagen || []).forEach((a) => res.push(a));
  });
  return res;
}

function AnlagePickerModal({ t, accent, ve, onVePatch, kontextTitel, onWahl, onClose }) {
  const [stufe, setStufe] = useState("quellen");   // quellen | upload | auswahl
  const [datei, setDatei] = useState(null);
  const [titel, setTitel] = useState("");
  const [fehler, setFehler] = useState("");
  const [ladend, setLadend] = useState(false);

  const labelStyle = { fontSize: FS.s, fontWeight: FW.bold, color: t.sub,
    textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6 };
  const inputStyle = { width: "100%", padding: "8px 10px",
    background: t.surface, color: t.text, border: "1px solid " + t.border,
    borderRadius: RAD.ms, fontSize: 16, fontFamily: "inherit", boxSizing: "border-box" };

  const dateiWaehlen = () => {
    setFehler("");
    const input = document.createElement("input");
    input.type = "file";
    input.accept = DOK_ACCEPT;
    input.style.display = "none";
    input.onchange = (ev) => {
      const f = ev.target.files && ev.target.files[0];
      try { document.body.removeChild(input); } catch (err) {}
      if (!f) return;
      const nm = (f.name || "").toLowerCase();
      if (nm.endsWith(".heic") || nm.endsWith(".heif") || (f.type || "").indexOf("heic") >= 0) {
        setFehler("HEIC-Fotos kann der Browser nicht anzeigen. Bitte am iPhone unter Einstellungen → Kamera → Formate „Maximale Kompatibilität\" wählen oder das Foto als JPEG teilen.");
        return;
      }
      setDatei(f);
      setTitel((kontextTitel ? kontextTitel + " · " : "") + (f.name || "Datei"));
    };
    document.body.appendChild(input);
    input.click();
  };

  // Upload-Weg (§4.3): Blob speichern, Meta (name = Titel) an die Karte
  // „Versammlungen (ETV)" hängen (Karte anlegen falls fehlend), Referenz melden.
  const uploadSpeichern = () => {
    if (!datei || !titel.trim() || ladend) return;
    setLadend(true);
    dateiSpeichern(datei).then((meta) => {
      const m = Object.assign({}, meta, { name: titel.trim() });
      let karte = (ve.dokumenteKarten || []).find((k) => k && k.dokumentId === "versammlungen");
      let karteId;
      if (karte) {
        karteId = karte.id;
        onVePatch((v) => Object.assign({}, v, {
          dokumenteKarten: (v.dokumenteKarten || []).map((k) =>
            (k && k.dokumentId === "versammlungen")
              ? Object.assign({}, k, { dateien: [...(Array.isArray(k.dateien) ? k.dateien : []), m] })
              : k),
        }));
      } else {
        const neu = neueDokumentKarte("versammlungen");
        neu.dateien = [m];
        karteId = neu.id;
        onVePatch((v) => Object.assign({}, v, {
          dokumenteKarten: [...(v.dokumenteKarten || []), neu],
        }));
      }
      onWahl({ id: anlId(), titel: titel.trim(), quelle: "dokument", refId: karteId, dateiRef: m.id });
      onClose();
    }).catch((err) => {
      setLadend(false);
      setFehler("Datei konnte nicht gespeichert werden: " + ((err && err.message) || "unbekannt"));
    });
  };

  // Auswahl-Weg (§4.3): bestehende Dokumente + Fotos, per Referenz (keine Kopie).
  const dokZeilen = [];
  (ve.dokumenteKarten || []).forEach((k) => {
    if (!k || !Array.isArray(k.dateien)) return;
    k.dateien.forEach((m) => {
      if (!m || !m.id) return;
      dokZeilen.push({ label: (k.name || "Dokument") + " — " + (m.name || "Datei"),
        quelle: "dokument", refId: k.id, dateiRef: m.id, titel: m.name || k.name || "Datei" });
    });
  });
  const fotos = Array.isArray(ve.fotos) ? ve.fotos : [];
  const fotoZeilen = fotos.map((f) => {
    const nm = fotoDateiname(ve, f, fotos);
    return { label: nm, quelle: "foto", refId: f.id, dateiRef: f.dateiRef, titel: nm };
  });

  const zeileStyle = { display: "flex", alignItems: "center", gap: 8, width: "100%",
    padding: "9px 10px", border: "1px solid " + t.border, borderRadius: RAD.sm,
    background: t.surface, color: t.text, cursor: "pointer", fontFamily: "inherit",
    fontSize: FS.s, textAlign: "left", boxSizing: "border-box" };

  const kachel = (label, beschr, iconName, onClick) => (
    <button onClick={onClick} style={{
      display: "flex", flexDirection: "column", alignItems: "center", gap: 8,
      padding: "18px 12px", minWidth: 0, boxSizing: "border-box",
      background: t.surface, border: "2px solid " + t.border,
      borderRadius: RAD.ml, cursor: "pointer", fontFamily: "inherit",
      transition: "all 0.15s", textAlign: "center" }}>
      <I name={iconName} size={22} color={t.sub}/>
      <span style={{ fontSize: FS.m, fontWeight: FW.bold, color: t.text }}>{label}</span>
      <span style={{ fontSize: FS.xs, color: t.sub, lineHeight: 1.3 }}>{beschr}</span>
    </button>
  );

  return (
    <div style={{ position: "fixed", top: 0, right: 0, bottom: 0, left: 0, background: "rgba(0,0,0,0.7)",
      zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div style={{ background: t.card, border: "1px solid " + t.border,
        borderRadius: RAD.xl, width: "100%", maxWidth: 480,
        maxHeight: "90dvh", overflowY: "auto",
        boxShadow: "0 20px 60px rgba(0,0,0,0.5)" }}>
        <div style={{ padding: "12px 16px", borderBottom: "1px solid " + t.border,
          display: "flex", alignItems: "center", justifyContent: "space-between",
          position: "sticky", top: 0, background: t.card, zIndex: 10 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {stufe !== "quellen" ? (
              <button onClick={() => { setStufe("quellen"); setFehler(""); setDatei(null); }}
                style={{ background: "none", border: "none", cursor: "pointer", padding: 0 }}
                title="Zurück" aria-label="Zurück">
                <I name="chevL" size={16} color={t.sub}/>
              </button>
            ) : <I name="plus" size={14} color={accent}/>}
            <span style={{ fontSize: FS.xl, fontWeight: FW.bold, color: t.text }}>Anlage hinzufügen</span>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer" }}
            title="Schließen" aria-label="Schließen">
            <I name="x" size={16} color={t.sub}/>
          </button>
        </div>

        <div style={{ padding: 16 }}>
          {stufe === "quellen" ? (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              {kachel("Vom Gerät hochladen", "Datei, Foto oder Kamera", "document",
                () => { setStufe("upload"); })}
              {kachel("Aus Dokumenten und Fotos", "Vorhandenes des Objekts wählen", "eye",
                () => { setStufe("auswahl"); })}
            </div>
          ) : null}

          {stufe === "upload" ? (
            <div>
              <div style={{ marginBottom: 14 }}>
                <div style={labelStyle}>Datei</div>
                <button onClick={dateiWaehlen} style={{
                  width: "100%", display: "flex", alignItems: "center", gap: 10,
                  background: t.surface, border: "1px solid " + t.border,
                  borderRadius: RAD.ms, padding: "10px 12px", cursor: "pointer",
                  fontFamily: "inherit", boxSizing: "border-box", textAlign: "left" }}>
                  <I name="document" size={16} color={datei ? accent : t.sub}/>
                  <span style={{ fontSize: FS.s, color: datei ? t.text : t.sub,
                    overflowWrap: "anywhere" }}>
                    {datei ? datei.name : "Datei wählen (auch Kamera/Fotomediathek)"}</span>
                </button>
              </div>
              {datei ? (
                <div style={{ marginBottom: 14 }}>
                  <div style={labelStyle}>Titel der Anlage</div>
                  <input value={titel} onChange={(ev) => setTitel(ev.target.value)} style={inputStyle}/>
                </div>
              ) : null}
              {fehler ? (
                <div style={{ fontSize: FS.s, color: "#EF4444", padding: "2px 0 6px" }}>{fehler}</div>
              ) : null}
              <div style={{ display: "flex", gap: 8 }}>
                <div style={{ flex: 1 }}>
                  <AktionsButton rolle="abbrechen" variante="breit" t={t} accent={accent}
                    onClick={onClose} text="Abbrechen"/>
                </div>
                <div style={{ flex: 2 }}>
                  <AktionsButton rolle="bestaetigen" variante="breit" t={t} accent={accent}
                    disabled={!datei || !titel.trim() || ladend}
                    onClick={uploadSpeichern} text={ladend ? "Speichert …" : "Hinzufügen"}/>
                </div>
              </div>
            </div>
          ) : null}

          {stufe === "auswahl" ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {fehler ? (
                <div style={{ fontSize: FS.s, color: "#EF4444" }}>{fehler}</div>
              ) : null}
              {dokZeilen.length > 0 ? (
                <div style={labelStyle}>Dokumente</div>
              ) : null}
              {dokZeilen.map((z, i) => (
                <button key={"d" + i} style={zeileStyle}
                  onClick={() => { onWahl({ id: anlId(), titel: z.titel, quelle: z.quelle,
                    refId: z.refId, dateiRef: z.dateiRef }); onClose(); }}>
                  <I name="document" size={15} color={t.sub}/>
                  <span style={{ flex: 1, minWidth: 0, overflowWrap: "anywhere" }}>{z.label}</span>
                </button>
              ))}
              {fotoZeilen.length > 0 ? (
                <div style={Object.assign({}, labelStyle, { marginTop: dokZeilen.length > 0 ? 8 : 0 })}>Fotos</div>
              ) : null}
              {fotoZeilen.map((z, i) => (
                <button key={"f" + i} style={zeileStyle}
                  onClick={() => { onWahl({ id: anlId(), titel: z.titel, quelle: z.quelle,
                    refId: z.refId, dateiRef: z.dateiRef }); onClose(); }}>
                  <I name="eye" size={15} color={t.sub}/>
                  <span style={{ flex: 1, minWidth: 0, overflowWrap: "anywhere" }}>{z.label}</span>
                </button>
              ))}
              {dokZeilen.length === 0 && fotoZeilen.length === 0 ? (
                <div style={{ fontSize: FS.s, color: t.muted, padding: "6px 0" }}>
                  Dieses Objekt hat noch keine Dokumente oder Fotos.</div>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

// ── AnlagenBlock — Anzeige + Verwaltung einer Anlagen-Liste (§4.6) ───────────
// EIN Baustein für TOP-Anlagen UND Versammlungs-Anlagen (Protokoll-Anhänge).
// Entfernen: Referenz geht IMMER weg; Nachfrage „auch löschen?" (§4.5) — bei
// Mehrfach-Referenz oder Foto-/Fremd-Dokument-Herkunft wird defensiv gewarnt
// bzw. echtes Löschen greift auf Quelle (Dokumente-Karte oder Fotos) durch.
function AnlagenBlock({ anlagen, onAnlagen, ve, onVePatch, welt, kontextTitel, t, accent, gesperrt }) {
  const [pickerOffen, setPickerOffen] = useState(false);
  const [entfernenFrage, setEntfernenFrage] = useState(null);   // Anlage-Objekt
  const [viewerAnlage, setViewerAnlage] = useState(null);

  const liste = Array.isArray(anlagen) ? anlagen : [];

  const nurVerknuepfungWeg = (a) => {
    onAnlagen(liste.filter((x) => x.id !== a.id));
    setEntfernenFrage(null);
  };

  const auchLoeschen = (a) => {
    // Mehrfach-Referenz-Prüfung (§4.5): hängt dieselbe Datei noch woanders?
    const andere = alleEtvAnlagen(welt, ve.id).filter((x) => x && x.id !== a.id && x.dateiRef === a.dateiRef);
    onAnlagen(liste.filter((x) => x.id !== a.id));
    if (andere.length > 0) { setEntfernenFrage(null); return; }   // Datei bleibt — noch referenziert
    if (a.quelle === "foto") {
      onVePatch((v) => Object.assign({}, v, {
        fotos: (Array.isArray(v.fotos) ? v.fotos : []).filter((f) => !f || f.id !== a.refId),
      }));
    } else {
      onVePatch((v) => Object.assign({}, v, {
        dokumenteKarten: (v.dokumenteKarten || []).map((k) => {
          if (!k || k.id !== a.refId) return k;
          return Object.assign({}, k, {
            dateien: (Array.isArray(k.dateien) ? k.dateien : []).filter((m) => !m || m.id !== a.dateiRef),
          });
        }).filter((k) => {
          // eigene (frei benannte) Karten ohne letzte Datei verschwinden (§85.3);
          // Katalog-Karten (dokumentId) bleiben bestehen.
          if (!k) return false;
          if (k.dokumentId) return true;
          if (k.id !== a.refId) return true;
          return (Array.isArray(k.dateien) ? k.dateien : []).length > 0
            || (Array.isArray(k.stamm) && k.stamm.some((f) => (f.value && String(f.value).trim()) || f.kontaktId));
        }),
      }));
    }
    dateiLoeschen(a.dateiRef);
    if (viewerAnlage && viewerAnlage.id === a.dateiRef) setViewerAnlage(null);
    setEntfernenFrage(null);
  };

  return (
    <div>
      {liste.map((a) => (
        <div key={a.id} style={{ display: "flex", alignItems: "center", gap: 8,
          fontSize: FS.s, color: t.text, padding: "3px 0" }}>
          <div style={{ flex: 1, minWidth: 0, overflowWrap: "anywhere" }}>📎 {a.titel}</div>
          {a.dateiRef ? (
            <button onClick={() => setViewerAnlage({ id: a.dateiRef, name: a.titel })}
              title="Ansehen" aria-label="Ansehen"
              style={{ width: 30, height: 30, borderRadius: RAD.sm, flexShrink: 0,
                border: "1px solid " + t.border, background: t.card,
                cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <I name="eye" size={15} color={t.sub}/>
            </button>
          ) : null}
          {!gesperrt ? (
            <button onClick={() => setEntfernenFrage(a)}
              title="Entfernen" aria-label="Entfernen"
              style={{ width: 30, height: 30, borderRadius: RAD.sm, flexShrink: 0,
                border: "1px solid " + t.border, background: t.card,
                cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <I name="trash" size={15} color={t.sub}/>
            </button>
          ) : null}
        </div>
      ))}
      {!gesperrt ? (
        <div style={{ marginTop: 4 }}>
          <AktionsButton rolle="bestaetigen" variante="breit" t={t} accent={accent}
            onClick={() => setPickerOffen(true)} text="+ Anlage"/>
        </div>
      ) : null}

      {pickerOffen ? (
        <AnlagePickerModal t={t} accent={accent} ve={ve} onVePatch={onVePatch}
          kontextTitel={kontextTitel}
          onWahl={(a) => onAnlagen([...liste, a])}
          onClose={() => setPickerOffen(false)}/>
      ) : null}

      {entfernenFrage ? (
        <div style={{ position: "fixed", top: 0, right: 0, bottom: 0, left: 0,
          background: "rgba(0,0,0,0.7)", zIndex: 210, display: "flex",
          alignItems: "center", justifyContent: "center", padding: 16 }}>
          <div style={{ background: t.card, border: "1px solid " + t.border,
            borderRadius: RAD.xl, width: "100%", maxWidth: 400, padding: 16 }}>
            <div style={{ fontSize: FS.m, fontWeight: FW.bold, color: t.text, marginBottom: 6 }}>
              Anlage entfernen</div>
            <div style={{ fontSize: FS.s, color: t.sub, marginBottom: 12 }}>
              „{entfernenFrage.titel}" wird von hier entfernt. Soll die Datei zusätzlich aus
              {entfernenFrage.quelle === "foto" ? " den Fotos" : " den Dokumenten"} des Objekts gelöscht werden?</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <AktionsButton rolle="bestaetigen" variante="breit" t={t} accent={accent}
                onClick={() => nurVerknuepfungWeg(entfernenFrage)} text="Nur Verknüpfung entfernen"/>
              <AktionsButton rolle="loeschen" variante="breit" t={t} accent={accent}
                onClick={() => auchLoeschen(entfernenFrage)}
                text={entfernenFrage.quelle === "foto" ? "Auch aus Fotos löschen" : "Auch aus Dokumenten löschen"}/>
              <AktionsButton rolle="abbrechen" variante="breit" t={t} accent={accent}
                onClick={() => setEntfernenFrage(null)} text="Abbrechen"/>
            </div>
          </div>
        </div>
      ) : null}

      {viewerAnlage ? (
        <DateiViewerModal t={t} accent={accent} datei={viewerAnlage}
          onClose={() => setViewerAnlage(null)}/>
      ) : null}
    </div>
  );
}

// ── Tab 2 · TAGESORDNUNG — TOP-Karten, wachsen per Baustein-Katalog ─────────
function EtvTagesordnungTab({ versammlung, ve, onVePatch, welt, onWelt, settings, t, accent }) {
  const [offenId, setOffenId] = useState(null);
  const [addOffen, setAddOffen] = useState(false);
  // Sortier-Modus (Druck&Ablage-Konzept 19.07. §1.2): „anpassen" = Nummern
  // folgen der Reihenfolge (Planung), „behalten" = nur Behandlungsreihenfolge
  // (in der Versammlung — TOP 9 bleibt TOP 9). Vorbelegung am Ladungs-Anker,
  // manuell jederzeit umschaltbar (Bennys Entscheidung 19.07.).
  const [sortModus, setSortModus] = useState(
    versammlung.ladung_versendet_am ? "behalten" : "anpassen");
  const tops = topsFuerVersammlung(welt, versammlung.id);
  const gesperrt = versammlung.status === "abgeschlossen";
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {!gesperrt && tops.length > 1 ? (
        <div>
          <SegmentControl t={t} accent={accent} voll={false}
            options={[{ id: "anpassen", label: "Nummern anpassen" },
              { id: "behalten", label: "Nummern behalten" }]}
            value={sortModus} onChange={setSortModus}/>
          <div style={{ fontSize: FS.xs, color: t.muted, marginTop: 4 }}>
            {sortModus === "behalten"
              ? "Verschieben ändert nur die Behandlungsreihenfolge — die TOP-Nummern bleiben (z. B. TOP vorziehen in der Versammlung)."
              : "Verschieben nummeriert die TOPs neu — für die Planung vor dem Einladungsversand."}
          </div>
        </div>
      ) : null}
      {tops.length === 0 ? (
        <div style={{ fontSize: FS.s, color: t.muted, fontStyle: "italic" }}>
          Noch keine Tagesordnungspunkte — unten hinzufügen (Standard-Katalog,
          aus Vorgängen, oder frei).
        </div>
      ) : tops.map((tp, idx) => (
        <TopKarte key={tp.id} top={tp} versammlung={versammlung} ve={ve} onVePatch={onVePatch} welt={welt}
          onWelt={onWelt} t={t} accent={accent} gesperrt={gesperrt}
          sortModus={sortModus}
          versetzt={tp.nummer && tp.nummer !== idx + 1
            ? (tp.nummer > idx + 1 ? "vorgezogen" : "nachgestellt") : null}
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
// ── AbstimmCockpit (Konzept 14.07. §4.2) — ersetzt die drei Handeingabe- ────
// Felder. Klick pro anwesender/vertretener Einheit, Schnell-Schalter, Live-
// Summe nach Kopf UND MEA (Rechenkern berechneAbstimmung = EINE Wahrheit mit
// weltTopAbstimmen). Weisungen aus Verwaltervollmachten belegen den Klick vor.
// WICHTIG (Phase-4-Merker §7): stimmen-Format ist quellenneutral — später
// füllen es zugeschaltete Eigentümer selbst (Hybrid/Online), gleiche Struktur.
function AbstimmCockpit({ top, versammlung, ve, welt, onWelt, t, accent, beschluss }) {
  const zeilen = anwesenheitenFuer(welt, versammlung.id)
    .filter((a) => a.status === "anwesend" || a.status === "vertreten");
  const stamm = (ve && ve.etvStamm) || {};
  // Vorbelegung: bestehende Einzelstimmen (Neu-Auszählen) > Vollmacht-Weisung.
  const [stimmen, setStimmen] = useState(() => {
    const init = {};
    zeilen.forEach((a) => {
      if (a.einheit_id == null) return;
      const alt = (beschluss && beschluss.stimmen) ? beschluss.stimmen[a.einheit_id] : undefined;
      const weisung = (a.weisungen && a.weisungen[top.id]) || undefined;
      const v = alt || weisung;
      if (v === "ja" || v === "nein" || v === "enthaltung") init[a.einheit_id] = v;
    });
    return init;
  });
  const typ = top.mehrheitstyp || "einfach";
  const nachMea = (versammlung.stimmprinzip || "MEA") === "MEA";
  const calc = berechneAbstimmung(zeilen, stimmen, {
    mehrheitstyp: typ, stimmprinzip: versammlung.stimmprinzip,
    gesamtMea: stamm.gesamtanteile });
  const abgegeben = Object.keys(stimmen).length;
  const setzen = (einheitId, v) => setStimmen((s) => {
    const n = Object.assign({}, s);
    if (n[einheitId] === v) delete n[einheitId]; else n[einheitId] = v;  // Toggle-Off
    return n;
  });
  const alleSetzen = (v) => setStimmen(() => {
    const n = {};
    zeilen.forEach((a) => { if (a.einheit_id != null) n[a.einheit_id] = v; });
    return n;
  });
  const optJNE = [{ id: "ja", label: "Ja" }, { id: "nein", label: "Nein" },
    { id: "enthaltung", label: "Enth." }];
  const schnellBtn = (label, v) => (
    <button onClick={() => alleSetzen(v)}
      style={{ fontSize: FS.xs, fontWeight: FW.medium, padding: "5px 10px",
        borderRadius: RAD.pill, border: "1px solid " + t.border, cursor: "pointer",
        background: t.card, color: t.text, fontFamily: "inherit" }}>{label}</button>
  );
  const summeZeile = (label, k, m) => (
    <div style={{ display: "flex", gap: 8, fontSize: FS.s, color: t.text }}>
      <div style={{ width: 44, fontWeight: FW.medium }}>{label}</div>
      <div>{k} {k === 1 ? "Stimme" : "Stimmen"}</div>
      <div style={{ color: t.muted }}>· {meaStr(m)} MEA</div>
    </div>
  );
  const gesamtMeaZahl = calc.gesamt_mea;
  const schwelleZeile = (label, ok, detail) => (
    <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: FS.xs }}>
      <span style={{ display: "inline-block", width: 9, height: 9, borderRadius: 9,
        background: ok ? "#10B981" : "#EF4444" }}/>
      <span style={{ color: t.text }}>{label}: {ok ? "erreicht" : "nicht erreicht"}</span>
      <span style={{ color: t.muted }}>({detail})</span>
    </div>
  );
  if (zeilen.length === 0) {
    return (
      <div style={{ fontSize: FS.xs, color: t.muted }}>
        Keine anwesenden oder vertretenen Einheiten — erst die Anwesenheit im
        Übersicht-Tab erfassen.
      </div>
    );
  }
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        {schnellBtn("Alle Ja", "ja")}
        {schnellBtn("Alle Nein", "nein")}
        {schnellBtn("Alle Enthaltung", "enthaltung")}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {zeilen.map((a) => (
          <div key={a.id} style={{ display: "flex", alignItems: "center", gap: 8,
            padding: "6px 8px", borderRadius: RAD.sm, border: "1px solid " + t.border,
            background: t.card }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: FS.s, color: t.text, fontWeight: FW.medium,
                overflowWrap: "anywhere" }}>
                {(a.einheit_nr ? a.einheit_nr + " · " : "") + (a.eigentuemer_namen || "—")}
              </div>
              <div style={{ fontSize: FS.xs, color: t.muted }}>
                {meaStr(a.mea_einheit || a.stimmgewicht) + " MEA"
                  + (a.status === "vertreten"
                    ? " · vertreten" + (a.vertreten_durch ? " durch " + a.vertreten_durch : "")
                    : "")
                  + (a.weisungen && a.weisungen[top.id] ? " · Weisung vorbelegt" : "")}
              </div>
            </div>
            <SegmentControl t={t} accent={accent} voll={false}
              value={a.einheit_id != null ? (stimmen[a.einheit_id] || null) : null}
              onChange={(v) => a.einheit_id != null && setzen(a.einheit_id, v)}
              options={optJNE}/>
          </div>
        ))}
      </div>
      {/* Live-Summe: Kopf UND MEA (Konzept §4.2) */}
      <div style={{ padding: "8px 10px", borderRadius: RAD.sm,
        border: "1px solid " + t.border, background: t.surface,
        display: "flex", flexDirection: "column", gap: 4 }}>
        {summeZeile("Ja", calc.ja_kopf, calc.ja_mea)}
        {summeZeile("Nein", calc.nein_kopf, calc.nein_mea)}
        {summeZeile("Enth.", calc.enth_kopf, calc.enth_mea)}
        <div style={{ fontSize: FS.xs, color: t.muted }}>
          {abgegeben} von {zeilen.length} Einheiten abgestimmt
          {abgegeben < zeilen.length ? " — ohne Klick = keine Stimme abgegeben" : ""}
        </div>
        {typ !== "einfach" && abgegeben > 0 ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 3, marginTop: 2 }}>
            {schwelleZeile(
              typ === "doppelt_21" ? "Kopf-Quote 2/3" : "Kopf-Quote 3/4",
              calc.schwelle_erreicht && calc.schwelle_erreicht.kopf,
              calc.ja_kopf + " Ja von " + calc.abgegeben_kopf + " abgegeben, Enthaltung zählt nicht")}
            {schwelleZeile("MEA-Schwelle > 1/2 ALLER Anteile",
              calc.schwelle_erreicht && calc.schwelle_erreicht.mea,
              meaStr(calc.ja_mea) + " Ja-MEA von " + meaStr(gesamtMeaZahl) + " gesamt — Abwesende zählen im Nenner mit!")}
          </div>
        ) : null}
        {abgegeben > 0 ? (
          <div style={{ marginTop: 2 }}>
            <StatusPille t={t}
              farbe={calc.angenommen ? "#10B981" : "#EF4444"}
              text={"Stand jetzt: " + (calc.angenommen ? "Angenommen" : "Abgelehnt")}/>
          </div>
        ) : null}
      </div>
      <AktionsButton rolle="bestaetigen" variante="breit" t={t} accent={accent}
        onClick={() => onWelt((w) => weltTopAbstimmen(w, top.id,
          { stimmen: stimmen, mehrheitstyp: typ, gesamtMea: stamm.gesamtanteile }))}
        disabled={abgegeben === 0}
        text={beschluss ? "Neu auszählen (überschreibt)" : "Auszählen — Beschluss fassen"}/>
    </div>
  );
}

function TopKarte({ top, versammlung, ve, onVePatch, welt, onWelt, t, accent, offen, onToggle, gesperrt, sortModus = "anpassen", versetzt = null }) {
  const [loeschStufe, setLoeschStufe] = useState(false);
  const [aufgabeText, setAufgabeText] = useState("");
  const beschluss = top.beschluss_id
    ? (welt.beschluesse || []).find((b) => b.id === top.beschluss_id) || null : null;
  const patch = (p) => onWelt((w) => weltTopPatch(w, top.id, p));
  const hatB = (id) => (top.bausteine || []).indexOf(id) >= 0;
  const addBaustein = (id) => patch({ bausteine: [...(top.bausteine || []), id] });
  const fehlende = TOP_BAUSTEINE.filter((b) => !hatB(b.id)
    && !(b.id === "abstimmung" && !top.beschluss_noetig));
  const ausgang = topAusgang(top, beschluss);
  const subText = ausgang ? ausgang.label : null;
  return (
    <BausteinKarte t={t} accent={accent}
      titel={"TOP " + (top.nummer || "?") + (versetzt ? " (" + versetzt + ")" : "")
        + " · " + (top.titel || "—")}
      sub={subText} punktFarbe={ausgang ? ausgang.farbe : null}
      offen={offen} onToggle={onToggle}>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {/* Reihenfolge + Kern */}
        {!gesperrt ? (
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <button onClick={() => onWelt((w) => weltTopVerschieben(w, top.id, -1, sortModus))}
              title="nach oben"
              style={{ width: 30, height: 30, borderRadius: RAD.pill, border: "1px solid " + t.border,
                background: t.card, color: t.text, cursor: "pointer" }}>↑</button>
            <button onClick={() => onWelt((w) => weltTopVerschieben(w, top.id, 1, sortModus))}
              title="nach unten"
              style={{ width: 30, height: 30, borderRadius: RAD.pill, border: "1px solid " + t.border,
                background: t.card, color: t.text, cursor: "pointer" }}>↓</button>
            <div style={{ flex: 1 }}/>
            <div style={{ fontSize: FS.xs, color: t.muted }}>Beschluss nötig</div>
            <Toggle value={!!top.beschluss_noetig} color={accent}
              onChange={(v) => patch({ beschluss_noetig: v })}/>
          </div>
        ) : null}
        {/* GO-Haken (Konzept §2 Nr. 6): Geschäftsordnungsbeschlüsse erhalten
            KEINE lfd. Nummer und erscheinen nicht in der Beschluss-Sammlung. */}
        {!gesperrt && top.beschluss_noetig && !beschluss ? (
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <div style={{ flex: 1, fontSize: FS.xs, color: t.muted }}>
              Geschäftsordnungsbeschluss (nicht in die Beschluss-Sammlung)</div>
            <Toggle value={!!top.go_beschluss} color={accent}
              onChange={(v) => patch({ go_beschluss: v })}/>
          </div>
        ) : null}
        {/* Mehrheitstyp (Cockpit-Konzept 14.07. §4.1): in der VORBEREITUNG
            wählen (§23 II WEG — erhöhtes Quorum gehört in die Einladung).
            Default „einfach"; Hinweistext nennt die Schwelle. */}
        {!gesperrt && top.beschluss_noetig ? (
          <div>
            <div style={{ fontSize: FS.xs, color: t.muted, marginBottom: 4 }}>
              Erforderliche Mehrheit</div>
            <SegmentControl t={t} accent={accent}
              value={top.mehrheitstyp || "einfach"}
              onChange={(v) => patch({ mehrheitstyp: v })}
              options={MEHRHEITSTYPEN.map((m) => ({ id: m.id, label: m.kurz }))}/>
            <div style={{ fontSize: FS.xs, color: t.muted, marginTop: 4 }}>
              {(MEHRHEITSTYPEN.find((m) => m.id === (top.mehrheitstyp || "einfach")) || {}).hinweis}
            </div>
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

        {/* Baustein: Anlagen (§4, 13.07.: Picker statt Titel-Eingabe — jede Anlage hat eine Datei) */}
        {hatB("anlage") ? (
          <div>
            <div style={{ fontSize: FS.xs, fontWeight: FW.bold, color: t.muted,
              textTransform: "uppercase", letterSpacing: 0.4, marginBottom: 4 }}>
              Anlagen</div>
            <AnlagenBlock t={t} accent={accent} ve={ve} onVePatch={onVePatch} welt={welt}
              anlagen={top.anlagen} gesperrt={gesperrt}
              kontextTitel={"TOP " + (top.nummer || "") }
              onAnlagen={(neu) => patch({ anlagen: neu })}/>
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
                    {(beschluss.abstimmung || {}).ja_kopf != null
                      ? "Ja " + beschluss.abstimmung.ja_kopf + " (" + meaStr(beschluss.abstimmung.ja_mea) + " MEA) · "
                        + "Nein " + beschluss.abstimmung.nein_kopf + " (" + meaStr(beschluss.abstimmung.nein_mea) + " MEA) · "
                        + "Enth. " + beschluss.abstimmung.enth_kopf + " (" + meaStr(beschluss.abstimmung.enth_mea) + " MEA)"
                      : "Ja " + meaStr((beschluss.abstimmung || {}).ja)
                        + " · Nein " + meaStr((beschluss.abstimmung || {}).nein)
                        + " · Enth. " + meaStr((beschluss.abstimmung || {}).enthaltung)}
                  </div>
                </div>
                {beschluss.mehrheitstyp && beschluss.mehrheitstyp !== "einfach" ? (
                  <div style={{ fontSize: FS.xs, color: t.muted }}>
                    {(MEHRHEITSTYPEN.find((m) => m.id === beschluss.mehrheitstyp) || {}).label}
                    {beschluss.schwelle_erreicht
                      ? " — Kopf-Quote " + (beschluss.schwelle_erreicht.kopf ? "erreicht" : "verfehlt")
                        + " · MEA-Schwelle " + (beschluss.schwelle_erreicht.mea ? "erreicht" : "verfehlt")
                        + " (von " + meaStr(beschluss.gesamt_mea) + " Gesamt-MEA)"
                      : ""}
                  </div>
                ) : null}
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
            {top.vertagt ? (
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <StatusPille t={t} farbe={AMPEL_FARBEN.gelb} text="Vertagt"/>
                <div style={{ fontSize: FS.xs, color: t.muted }}>
                  {top.vorgang_id
                    ? "Vorgang wartet auf die nächste ETV (Wartekorb)"
                    : "als TOP in die nächste ETV übernommen"}</div>
              </div>
            ) : null}
            {!gesperrt && !top.vertagt ? (
              <div style={{ marginTop: beschluss ? 8 : 0 }}>
                {/* Abstimm-Cockpit (14.07.): Klick je Einheit statt Handeingabe.
                    key erzwingt frische Vorbelegung bei TOP-/Beschluss-Wechsel. */}
                <AbstimmCockpit key={top.id + "_" + (beschluss ? beschluss.id : "neu")}
                  top={top} versammlung={versammlung} ve={ve} welt={welt}
                  onWelt={onWelt} t={t} accent={accent} beschluss={beschluss}/>
                {!beschluss ? (
                  <div style={{ marginTop: 6 }}>
                    <AktionsButton rolle="bestaetigen" variante="breit" t={t}
                      accent={AMPEL_FARBEN.gelb}
                      onClick={() => onWelt((w) => weltTopVertagen(w, top.id, ve, isoHeute()))}
                      text="Vertagen — in nächste ETV"/>
                  </div>
                ) : null}
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

// ── Protokoll (§5 + §3 Ausbau): TOP-für-TOP + Anwesenheit + Pflichtangaben ───
// HTML-Bau getrennt (testbar); druckeEtvProtokoll druckt nur noch.
function baueEtvProtokollHtml(versammlung, ve, welt, kontakte, optionen) {
  const opt = optionen || {};
  const tops = topsFuerVersammlung(welt, versammlung.id);
  const anw = anwesenheitenFuer(welt, versammlung.id);
  const stamm = (ve && ve.etvStamm) || {};
  const bf = beschlussfaehigkeitInfo(anw, stamm.gesamtanteile, versammlung.stimmprinzip);
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
      // Cockpit-Beschlüsse (14.07.): Kopf UND MEA ausweisen + Mehrheitstyp +
      // Schwellen. Alt-Beschlüsse (nur ja/nein/enthaltung): bisherige Zeile.
      const ab = b.abstimmung;
      if (ab.ja_kopf != null) {
        inner += "<p><b>Abstimmung:</b> "
          + "Ja " + ab.ja_kopf + " Stimmen (" + meaStr(ab.ja_mea) + " MEA) · "
          + "Nein " + ab.nein_kopf + " Stimmen (" + meaStr(ab.nein_mea) + " MEA) · "
          + "Enthaltung " + ab.enth_kopf + " Stimmen (" + meaStr(ab.enth_mea) + " MEA)"
          + " — <b>" + (b.ergebnis === "angenommen" ? "ANGENOMMEN" : "ABGELEHNT") + "</b></p>";
        const mt = MEHRHEITSTYPEN.find((m) => m.id === b.mehrheitstyp);
        if (b.mehrheitstyp && b.mehrheitstyp !== "einfach" && mt) {
          inner += "<p style='color:#555'>Erforderliche Mehrheit: " + esc(mt.label)
            + (b.schwelle_erreicht
              ? " — Kopf-Quote " + (b.schwelle_erreicht.kopf ? "erreicht" : "verfehlt")
                + ", MEA-Schwelle " + (b.schwelle_erreicht.mea ? "erreicht" : "verfehlt")
                + " (Ja-MEA " + meaStr(ab.ja_mea) + " von " + meaStr(b.gesamt_mea)
                + " Gesamt-MEA)"
              : "") + "</p>";
        }
        // Einzelstimmen namentlich — NUR per Druck-Haken (Default AUS, §2 Nr. 7).
        if (opt.einzelstimmen && b.stimmen && Object.keys(b.stimmen).length > 0) {
          const anwAlle = anwesenheitenFuer(welt, versammlung.id);
          const sLabel = { ja: "Ja", nein: "Nein", enthaltung: "Enthaltung" };
          inner += "<table><tr><th>Einheit</th><th>Eigentümer</th><th>Stimme</th></tr>"
            + Object.keys(b.stimmen).map((eid) => {
                const az = anwAlle.find((x) => String(x.einheit_id) === String(eid));
                return "<tr><td>" + esc(az ? az.einheit_nr : eid) + "</td><td>"
                  + esc(az ? az.eigentuemer_namen : "—") + "</td><td>"
                  + (sLabel[b.stimmen[eid]] || "—") + "</td></tr>";
              }).join("") + "</table>";
        }
      } else {
        inner += "<p><b>Abstimmung (" + esc(versammlung.stimmprinzip || "MEA") + "):</b> "
          + "Ja " + meaStr(ab.ja) + " · Nein " + meaStr(ab.nein)
          + " · Enthaltung " + meaStr(ab.enthaltung)
          + " — <b>" + (b.ergebnis === "angenommen" ? "ANGENOMMEN" : "ABGELEHNT") + "</b></p>";
      }
      inner += ""
        // Verkündung (§24 WEG, Ausbau-Konzept §3): Standardsatz je gefasstem
        // Beschluss — mit der Verkündung wird der Beschluss rechtlich existent.
        + "<p>Der Versammlungsleiter verkündete das Beschlussergebnis.</p>";
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
  const nachMea = (versammlung.stimmprinzip || "MEA") === "MEA";
  const mitWeisung = anw.filter((a) => a.status === "vertreten"
    && a.weisungen && Object.keys(a.weisungen).length > 0);
  const wLabel = { ja: "Ja", nein: "Nein", enthaltung: "Enthaltung" };
  const weisungsHtml = mitWeisung.length === 0 ? ""
    : "<h3>Vollmachten mit Weisung (§25 WEG)</h3>" + mitWeisung.map((a) => {
        const teile = Object.keys(a.weisungen).map((topId) => {
          const tp = tops.find((x) => x.id === topId);
          return "TOP " + (tp ? tp.nummer : "?") + " " + (wLabel[a.weisungen[topId]] || "");
        }).join(" · ");
        return "<p>Einheit " + esc(a.einheit_nr) + " (" + esc(a.eigentuemer_namen)
          + ") — vertreten durch " + esc(a.vertreten_durch || "—")
          + (a.ist_verwaltervollmacht ? " [Verwalter-Vollmacht]" : "")
          + ": " + esc(teile) + "</p>";
      }).join("");
  const anwHtml = anw.length > 0
    ? "<h3>Anwesenheitsliste</h3><table><tr><th>Einheit</th><th>Eigentümer</th>"
      + "<th>" + (nachMea ? "MEA" : "Stimme") + "</th><th>Status</th><th>Vertreten durch</th></tr>"
      + anw.map((a) => "<tr><td>" + esc(a.einheit_nr) + "</td><td>" + esc(a.eigentuemer_namen)
        + "</td><td>" + (nachMea ? meaStr(a.stimmgewicht) : "1") + "</td><td>"
        + (a.status === "anwesend" ? "anwesend" : (a.status === "vertreten" ? "vertreten" : "—"))
        + "</td><td>" + esc(a.vertreten_durch)
        + (a.ist_verwaltervollmacht ? " (Verwalter-Vollmacht)" : "") + "</td></tr>").join("")
      + "</table><p><b>" + esc(bf.text) + "</b></p>" + weisungsHtml
    : "";
  // Deckblatt (Sammlung-Konzept §5.3, 13.07.): IMMER Seite 1 — Versammlungskopf
  // + Tabelle „TOP · Titel · Ausgang". Ausgang als Wort UND Farbmarker (nie
  // Farbe allein — druckfreundlich). Seitenumbruch danach.
  const deckZeilen = tops.map((tp) => {
    const b = tp.beschluss_id
      ? (welt.beschluesse || []).find((x) => x.id === tp.beschluss_id) || null : null;
    const a = topAusgang(tp, b);
    const wort = a ? a.label : "—";
    const farbe = a ? a.farbe : "#94A3B8";
    const nr = b && b.lfd_nummer != null ? " (Beschluss Nr. " + b.lfd_nummer + ")" : "";
    return "<tr><td>" + esc(String(tp.nummer || "")) + "</td>"
      + "<td>" + esc(tp.titel || "—") + nr + "</td>"
      + "<td><span style='display:inline-block;width:9px;height:9px;border-radius:9px;"
      + "background:" + farbe + ";margin-right:5px'></span>" + esc(wort) + "</td></tr>";
  }).join("");
  const deckblatt = "<div class='deckblatt'>"
    + "<h2 style='margin:0 0 2px 0'>" + esc(artLabel(versammlung.versammlung_art)) + "</h2>"
    + "<p>"
    + "<b>Objekt:</b> " + esc((ve && (ve.nr || ve.name)) || "") + " · " + esc((ve && ve.adresse) || "")
    + "<br/><b>" + (versammlung.versammlung_art === "umlauf" ? "Stichtag" : "Termin") + ":</b> "
    + esc(versammlung.datum ? datumDe(versammlung.datum) : "—")
    + (versammlung.uhrzeit ? " · " + esc(versammlung.uhrzeit) + " Uhr" : "")
    + (versammlung.ort ? "<br/><b>Ort:</b> " + esc(versammlung.ort) : "")
    + "</p>"
    + "<h3>Tagesordnung und Ausgang</h3>"
    + "<table><tr><th style='width:36px'>TOP</th><th>Titel</th><th style='width:150px'>Ausgang</th></tr>"
    + deckZeilen + "</table></div>";
  const kopf = "<p>"
    + "<b>Objekt:</b> " + esc((ve && (ve.nr || ve.name)) || "") + " · " + esc((ve && ve.adresse) || "") + "<br/>"
    + "<b>Art:</b> " + esc(artLabel(versammlung.versammlung_art))
    + (versammlung.versammlung_art !== "umlauf"
      ? " (" + esc(((ETV_DURCHFUEHRUNG.find((x) => x.id === versammlung.art) || {}).label || "")) + ")" : "")
    + "<br/><b>" + (versammlung.versammlung_art === "umlauf" ? "Stichtag" : "Termin") + ":</b> "
    + esc(versammlung.datum ? datumDe(versammlung.datum) : "—")
    + (versammlung.uhrzeit ? " · " + esc(versammlung.uhrzeit) + " Uhr" : "")
    + (versammlung.protokoll_beginn
      ? "<br/><b>Beginn:</b> " + esc(versammlung.protokoll_beginn) + " Uhr"
        + (versammlung.protokoll_ende
          ? " · <b>Ende:</b> " + esc(versammlung.protokoll_ende) + " Uhr" : "")
      : "")
    + (versammlung.ort ? "<br/><b>Ort:</b> " + esc(versammlung.ort) : "")
    + "<br/><b>Stimmprinzip:</b> " + esc(versammlung.stimmprinzip || "MEA")
    + (versammlung.leiter_kontakt_id
      ? "<br/><b>Versammlungsleiter:</b> " + esc(kontaktNameVonId(kontakte, versammlung.leiter_kontakt_id)) : "")
    + (versammlung.protokollfuehrer_kontakt_id
      ? "<br/><b>Protokollführer:</b> " + esc(kontaktNameVonId(kontakte, versammlung.protokollfuehrer_kontakt_id)) : "")
    + (versammlung.beirat_vorsitz_kontakt_id
      ? "<br/><b>Verwaltungsbeirat (Vorsitz):</b> "
        + esc(kontaktNameVonId(kontakte, versammlung.beirat_vorsitz_kontakt_id))
        + ((versammlung.beirat_mitglied_kontakt_ids || []).length > 0
          ? " · Mitglieder: " + (versammlung.beirat_mitglied_kontakt_ids || [])
              .map((id) => esc(kontaktNameVonId(kontakte, id))).join(", ")
          : "")
      : "")
    + "</p>"
    // Feststellung der ordnungsgemäßen Einladung (§24 WEG) — Standardsatz per Haken.
    + (versammlung.einladung_festgestellt
      ? "<p>Der Versammlungsleiter stellte fest, dass zu der Versammlung form-"
        + " und fristgerecht eingeladen wurde.</p>"
      : "")
    // Feststellung der Beschlussfähigkeit (üblich, wenn Anwesenheit erfasst).
    + (anw.length > 0
      ? "<p>Der Versammlungsleiter stellte die Beschlussfähigkeit fest ("
        + esc(bf.text) + ").</p>"
      : "");
  // Unterschriftenblock (§24 WEG: Leiter + ein Eigentümer + Beiratsvorsitz).
  const uName = (kid, fallback) => kid ? kontaktNameVonId(kontakte, kid) : fallback;
  const uZeile = (name, rolle, am) =>
    "<p style='margin-top:30px'>_________________________________<br/>"
    + esc(name) + ", " + rolle
    + (am ? " — unterschrieben am " + esc(datumDe(am)) : "") + "</p>";
  const unterschriftenHtml = "<h3>Unterschriften</h3>"
    + uZeile(uName(versammlung.leiter_kontakt_id, "________________"),
        "Versammlungsleiter", versammlung.unterschrift_leiter_am)
    + uZeile(uName(versammlung.unterschrift_eigentuemer_kontakt_id, "________________"),
        "Wohnungseigentümer", versammlung.unterschrift_eigentuemer_am)
    + (versammlung.beirat_vorsitz_kontakt_id
      ? uZeile(uName(versammlung.beirat_vorsitz_kontakt_id, ""),
          "Vorsitzender des Verwaltungsbeirats", versammlung.unterschrift_beirat_am)
      : "");
  // Anlagenverzeichnis (§4.7, 13.07.): nummerierte Liste am Protokoll-Ende —
  // erst Versammlungs-Anlagen, dann TOP-Anlagen mit Zuordnungs-Vermerk.
  const verzeichnis = [];
  (versammlung.anlagen || []).forEach((a) => verzeichnis.push({ a: a, zu: "" }));
  tops.forEach((tp) => (tp.anlagen || []).forEach((a) =>
    verzeichnis.push({ a: a, zu: " (zu TOP " + tp.nummer + ")" })));
  const anlagenHtml = verzeichnis.length > 0
    ? "<h3>Anlagenverzeichnis</h3>" + verzeichnis.map((e, i) =>
        "<p>Anlage " + (i + 1) + ": " + esc(e.a.titel) + esc(e.zu) + "</p>").join("")
    : "";
  const css = "h3{margin:14px 0 4px 0;font-size:13px} p{margin:4px 0;font-size:11px}"
    + " table{border-collapse:collapse;width:100%;font-size:10px}"
    + " th,td{border:1px solid #999;padding:3px 6px;text-align:left}"
    + " img.anlage-bild{max-width:100%;max-height:800px;display:block;margin:6px 0}"
    + " .deckblatt{page-break-after:always}";
  return {
    titel: "Protokoll · " + artLabel(versammlung.versammlung_art)
      + (versammlung.datum ? " · " + datumDe(versammlung.datum) : ""),
    html: deckblatt + kopf + topHtml + anwHtml + anlagenHtml + unterschriftenHtml,
    css: css,
    verzeichnis: verzeichnis,
  };
}

// Druck (§4.7): optional Bild-Anlagen als Abbildungen einbetten. Dafür werden
// die Blobs asynchron aus IndexedDB geladen und als dataURL angehängt — nur
// echte Bilder (blob.type image/*), PDFs/Office bleiben Verzeichnis-Einträge.
function druckeEtvProtokoll(versammlung, ve, welt, kontakte, optionen) {
  const p = baueEtvProtokollHtml(versammlung, ve, welt, kontakte, optionen);
  const einbetten = !!(optionen && optionen.bilderEinbetten);
  if (!einbetten || p.verzeichnis.length === 0) {
    druckeHtml(p.titel, p.html, false, p.css);
    return;
  }
  const jobs = p.verzeichnis.map((e, i) => {
    if (!e.a.dateiRef) return Promise.resolve("");
    return dateiLaden(e.a.dateiRef).then((blob) => new Promise((resolve) => {
      if (!blob || !(blob.type || "").startsWith("image/")) { resolve(""); return; }
      const r = new FileReader();
      r.onload = () => resolve(
        "<p><b>Anlage " + (i + 1) + ": " + esc(e.a.titel) + "</b></p>"
        + "<img class='anlage-bild' src='" + r.result + "'/>");
      r.onerror = () => resolve("");
      r.readAsDataURL(blob);
    })).catch(() => "");
  });
  Promise.all(jobs).then((teile) => {
    const bilder = teile.filter(Boolean).join("");
    const html = p.html + (bilder ? "<h3>Abbildungen</h3>" + bilder : "");
    druckeHtml(p.titel, html, false, p.css);
  });
}

// ── Die ETV-AKTE: Kopf + TabLeiste (§97) + vier Tabs (§2b) ──────────────────
// ╔══════════════════════════════════════════════════════════════════════════╗
// ║ PDF-DRUCKWERKE (Druck&Ablage-Konzept 19.07.): Tagesordnung + Einladung   ║
// ║ als PDF über den PdfBauer — erzeugen legt IMMER im ETV-Ordner ab (§4.1). ║
// ║ Protokoll bleibt (noch) auf dem HTML-Druckweg; Umzug = eigene Stufe §7.5.║
// ╚══════════════════════════════════════════════════════════════════════════╝

// „zur ordentlichen Eigentümerversammlung" — Beugung nach Art.
function einladungArtText(versammlung) {
  const a = versammlung.versammlung_art;
  if (a === "ausserordentlich") return "außerordentlichen Eigentümerversammlung";
  if (a === "umlauf") return "Beschlussfassung im Umlaufverfahren";
  return "ordentlichen Eigentümerversammlung";
}
function etvObjektText(ve) {
  const teile = [];
  if (ve && (ve.nr || ve.name)) teile.push(ve.nr || ve.name);
  if (ve && ve.adresse && ve.adresse.strasse) {
    teile.push(ve.adresse.strasse + (ve.adresse.plz || ve.adresse.ort
      ? ", " + [ve.adresse.plz, ve.adresse.ort].filter(Boolean).join(" ") : ""));
  }
  return teile.join(" · ");
}
function etvTerminText(versammlung) {
  return (versammlung.datum ? "am " + datumDe(versammlung.datum) : "Termin offen")
    + (versammlung.uhrzeit ? " um " + versammlung.uhrzeit + " Uhr" : "")
    + (versammlung.ort ? ", " + versammlung.ort : "");
}
function pdfDateiName(art, versammlung) {
  const d = versammlung.datum || isoHeute();
  return art.charAt(0).toUpperCase() + art.slice(1) + "_ETV_" + d + ".pdf";
}

// Empfänger der Einladung (§2.2): je Einheit EIN Brief (Standard, Miteigen-
// tümer zusammen) oder je Eigentümer ein eigener. Einheiten ohne aktive
// Eigentümer werden gemeldet und übersprungen. Muster: etvAnwesenheitZeilen.
function einladungsEmpfaenger(ve, kontakte, modus) {
  const raus = [];
  const adresseVon = (p) => {
    const k = p && p.kontaktId != null
      ? (kontakte || []).find((x) => x && x.id === p.kontaktId) : null;
    if (!k) return [];
    const z = [];
    if (k.strasse) z.push(k.strasse);
    const po = [k.plz, k.ort].filter(Boolean).join(" ");
    if (po) z.push(po);
    return z;
  };
  alleEinheitenVonVe(ve).forEach((e) => {
    if (!e) return;
    const aktive = (e.eigentuemer || []).filter((p) => p && eigStatus(p) === "aktiv");
    if (aktive.length === 0) { raus.push({ leer: true, einheit: e }); return; }
    if (modus === "eigentuemer") {
      aktive.forEach((p) => raus.push({ einheit: e,
        namen: [p.name || "Eigentümer"], adresse: adresseVon(p) }));
    } else {
      const namen = istEigentuemergemeinschaft(e)
        ? [gemeinschaftName(e)]
        : aktive.map((p) => p.name || "").filter(Boolean);
      raus.push({ einheit: e, namen: namen.length ? namen : ["Eigentümer"],
        adresse: adresseVon(aktive[0]) });
    }
  });
  return raus;
}

// Tagesordnung (§2.1): IMMER Nummernfolge (§1.4) — so wurde geladen.
function baueTagesordnungBloecke(versammlung, ve, welt, optionen) {
  const opt = optionen || {};
  const tops = topsFuerVersammlung(welt, versammlung.id)
    .slice().sort((a, b) => (a.nummer || 0) - (b.nummer || 0));
  const bloecke = [];
  if (!opt.ohneKopf) {
    bloecke.push({ typ: "ueberschrift", text: "Tagesordnung" });
    bloecke.push({ typ: "absatz", farbe: "grau",
      text: einladungArtText(versammlung).replace(/^B/, "B") + " · " + etvObjektText(ve) });
    bloecke.push({ typ: "absatz", farbe: "grau", text: etvTerminText(versammlung) });
    bloecke.push({ typ: "zeile" });
  } else {
    bloecke.push({ typ: "ueberschrift", groesse: 12, text: "Tagesordnung" });
  }
  if (tops.length === 0) {
    bloecke.push({ typ: "absatz", farbe: "grau", text: "Noch keine Tagesordnungspunkte." });
  }
  tops.forEach((tp) => {
    bloecke.push({ typ: "punkt", label: "TOP " + (tp.nummer || "?"),
      text: tp.titel || "—", textFett: true });
    if (opt.mitWortlaut && tp.wortlaut) {
      bloecke.push({ typ: "absatz", farbe: "grau", groesse: 9.5,
        text: "Beschlussvorlage: " + tp.wortlaut });
    }
    bloecke.push({ typ: "abstand", hoehe: 2 });
  });
  return bloecke;
}

// Einladung (§2.2): Serienbrief — pro Empfänger Anschreiben + Tagesordnung,
// dazwischen Seitenumbruch. Personalisiert: Adressfeld, Einheit-Nr., MEA.
function baueEinladungBloecke(versammlung, ve, welt, kontakte, optionen) {
  const opt = optionen || {};
  const empfaenger = einladungsEmpfaenger(ve, kontakte, opt.modus || "einheit")
    .filter((r) => !r.leer);
  const absenderZeilen = String(opt.absender || "").split("\n")
    .map((z) => z.trim()).filter(Boolean);
  const bloecke = [];
  empfaenger.forEach((r, i) => {
    if (i > 0) bloecke.push({ typ: "seitenumbruch" });
    if (absenderZeilen.length > 0) {
      bloecke.push({ typ: "absatz", farbe: "grau", groesse: 8.5,
        text: absenderZeilen.join(" · ") });
      bloecke.push({ typ: "zeile" });
    }
    bloecke.push({ typ: "abstand", hoehe: 16 });
    bloecke.push({ typ: "adressfeld", zeilen: [...r.namen, ...r.adresse] });
    bloecke.push({ typ: "abstand", hoehe: 12 });
    bloecke.push({ typ: "ueberschrift", groesse: 13,
      text: "Einladung zur " + einladungArtText(versammlung) });
    bloecke.push({ typ: "absatz", farbe: "grau", text: etvObjektText(ve) });
    bloecke.push({ typ: "abstand", hoehe: 6 });
    bloecke.push({ typ: "absatz", text: "Sehr geehrte Damen und Herren," });
    bloecke.push({ typ: "absatz",
      text: "hiermit laden wir Sie herzlich zur " + einladungArtText(versammlung)
        + " ein. Die Versammlung findet statt " + etvTerminText(versammlung) + "." });
    const einheitTeile = ["Ihre Einheit: " + (r.einheit.nr || r.einheit.bezeichnung || "—")];
    if (r.einheit.mea) einheitTeile.push("Miteigentumsanteil: " + r.einheit.mea);
    bloecke.push({ typ: "absatz", fett: true, text: einheitTeile.join(" · ") });
    bloecke.push({ typ: "absatz",
      text: "Die Tagesordnung finden Sie auf den folgenden Seiten. Sollten Sie "
        + "nicht persönlich teilnehmen können, besteht die Möglichkeit, sich "
        + "durch eine bevollmächtigte Person vertreten zu lassen." });
    bloecke.push({ typ: "abstand", hoehe: 8 });
    bloecke.push({ typ: "absatz", text: "Mit freundlichen Grüßen" });
    if (absenderZeilen.length > 0) {
      bloecke.push({ typ: "absatz", text: absenderZeilen[0] });
    }
    bloecke.push({ typ: "abstand", hoehe: 10 });
    baueTagesordnungBloecke(versammlung, ve, welt,
      { mitWortlaut: opt.mitWortlaut, ohneKopf: true }).forEach((b) => bloecke.push(b));
  });
  return bloecke;
}

// ── Unterlagen-Karte (§4.2): der ETV-Ordner in der Übersicht ────────────────
// Protokoll als PDF (§2.3/§7.5): DIESELBE Datenlogik wie der HTML-Druck
// (baueEtvProtokollHtml), gerendert als PdfBauer-Blöcke. TOPs in
// BEHANDLUNGSREIHENFOLGE (§1.4 — so lief die Versammlung) mit
// „(vorgezogen)"-Vermerk; das Deckblatt listet in Nummernfolge.
function baueProtokollBloecke(versammlung, ve, welt, kontakte, optionen) {
  const opt = optionen || {};
  const bl = [];
  const tops = topsFuerVersammlung(welt, versammlung.id);
  const anw = anwesenheitenFuer(welt, versammlung.id);
  const stamm = (ve && ve.etvStamm) || {};
  const bf = beschlussfaehigkeitInfo(anw, stamm.gesamtanteile, versammlung.stimmprinzip);
  const nachMea = (versammlung.stimmprinzip || "MEA") === "MEA";
  const beschlussVon = (tp) => tp.beschluss_id
    ? (welt.beschluesse || []).find((x) => x.id === tp.beschluss_id) || null : null;
  const wLabel = { ja: "Ja", nein: "Nein", enthaltung: "Enthaltung" };
  // Deckblatt: Nummernfolge (Nachschlagewerk), Ausgang als Wort.
  bl.push({ typ: "ueberschrift", text: "Protokoll · " + artLabel(versammlung.versammlung_art) });
  bl.push({ typ: "absatz", farbe: "grau", text: etvObjektText(ve) });
  bl.push({ typ: "absatz", farbe: "grau", text: etvTerminText(versammlung) });
  bl.push({ typ: "zeile" });
  bl.push({ typ: "ueberschrift", groesse: 12, text: "Tagesordnung und Ausgang" });
  tops.slice().sort((a, b) => (a.nummer || 0) - (b.nummer || 0)).forEach((tp) => {
    const b = beschlussVon(tp);
    const a = topAusgang(tp, b);
    const nr = b && b.lfd_nummer != null ? " (Beschluss Nr. " + b.lfd_nummer + ")" : "";
    bl.push({ typ: "punkt", label: "TOP " + (tp.nummer || "?"),
      text: (tp.titel || "—") + nr + " — " + (a ? a.label : "—") });
  });
  bl.push({ typ: "seitenumbruch" });
  // Kopf/Pflichtangaben (§24 WEG).
  const kopfZeilen = [];
  kopfZeilen.push("Art: " + artLabel(versammlung.versammlung_art)
    + (versammlung.versammlung_art !== "umlauf"
      ? " (" + (((ETV_DURCHFUEHRUNG.find((x) => x.id === versammlung.art) || {}).label) || "") + ")" : ""));
  kopfZeilen.push((versammlung.versammlung_art === "umlauf" ? "Stichtag: " : "Termin: ")
    + (versammlung.datum ? datumDe(versammlung.datum) : "—")
    + (versammlung.uhrzeit ? " · " + versammlung.uhrzeit + " Uhr" : ""));
  if (versammlung.protokoll_beginn) {
    kopfZeilen.push("Beginn: " + versammlung.protokoll_beginn + " Uhr"
      + (versammlung.protokoll_ende ? " · Ende: " + versammlung.protokoll_ende + " Uhr" : ""));
  }
  if (versammlung.ort) kopfZeilen.push("Ort: " + versammlung.ort);
  kopfZeilen.push("Stimmprinzip: " + (versammlung.stimmprinzip || "MEA"));
  if (versammlung.leiter_kontakt_id) {
    kopfZeilen.push("Versammlungsleiter: " + kontaktNameVonId(kontakte, versammlung.leiter_kontakt_id));
  }
  if (versammlung.protokollfuehrer_kontakt_id) {
    kopfZeilen.push("Protokollführer: " + kontaktNameVonId(kontakte, versammlung.protokollfuehrer_kontakt_id));
  }
  if (versammlung.beirat_vorsitz_kontakt_id) {
    kopfZeilen.push("Verwaltungsbeirat (Vorsitz): "
      + kontaktNameVonId(kontakte, versammlung.beirat_vorsitz_kontakt_id)
      + ((versammlung.beirat_mitglied_kontakt_ids || []).length > 0
        ? " · Mitglieder: " + (versammlung.beirat_mitglied_kontakt_ids || [])
            .map((id) => kontaktNameVonId(kontakte, id)).join(", ")
        : ""));
  }
  kopfZeilen.forEach((z) => bl.push({ typ: "absatz", text: z }));
  if (versammlung.einladung_festgestellt) {
    bl.push({ typ: "absatz", text: "Der Versammlungsleiter stellte fest, dass zu der "
      + "Versammlung form- und fristgerecht eingeladen wurde." });
  }
  if (anw.length > 0) {
    bl.push({ typ: "absatz", text: "Der Versammlungsleiter stellte die "
      + "Beschlussfähigkeit fest (" + bf.text + ")." });
  }
  // TOPs in Behandlungsreihenfolge (§1.4) mit „vorgezogen"-Vermerk.
  tops.forEach((tp, idx) => {
    const b = beschlussVon(tp);
    const versetzt = tp.nummer && tp.nummer !== idx + 1
      ? (tp.nummer > idx + 1 ? " (vorgezogen)" : " (nachgestellt)") : "";
    bl.push({ typ: "abstand", hoehe: 6 });
    bl.push({ typ: "ueberschrift", groesse: 12,
      text: "TOP " + (tp.nummer || "?") + versetzt + " · " + (tp.titel || "—") });
    if (tp.text) bl.push({ typ: "absatz", text: tp.text });
    if (tp.wortlaut) bl.push({ typ: "absatz", text: "Beschlussvorlage: " + tp.wortlaut });
    if ((tp.anlagen || []).length > 0) {
      bl.push({ typ: "absatz", farbe: "grau",
        text: "Anlagen: " + tp.anlagen.map((a) => a.titel).join(", ") });
    }
    if (b && b.abstimmung) {
      const ab = b.abstimmung;
      if (ab.ja_kopf != null) {
        bl.push({ typ: "absatz", fett: true,
          text: "Abstimmung: Ja " + ab.ja_kopf + " Stimmen (" + meaStr(ab.ja_mea) + " MEA) · "
            + "Nein " + ab.nein_kopf + " Stimmen (" + meaStr(ab.nein_mea) + " MEA) · "
            + "Enthaltung " + ab.enth_kopf + " Stimmen (" + meaStr(ab.enth_mea) + " MEA) — "
            + (b.ergebnis === "angenommen" ? "ANGENOMMEN" : "ABGELEHNT") });
        const mt = MEHRHEITSTYPEN.find((m) => m.id === b.mehrheitstyp);
        if (b.mehrheitstyp && b.mehrheitstyp !== "einfach" && mt) {
          bl.push({ typ: "absatz", farbe: "grau",
            text: "Erforderliche Mehrheit: " + mt.label
              + (b.schwelle_erreicht
                ? " — Kopf-Quote " + (b.schwelle_erreicht.kopf ? "erreicht" : "verfehlt")
                  + ", MEA-Schwelle " + (b.schwelle_erreicht.mea ? "erreicht" : "verfehlt")
                  + " (Ja-MEA " + meaStr(ab.ja_mea) + " von " + meaStr(b.gesamt_mea)
                  + " Gesamt-MEA)"
                : "") });
        }
        if (opt.einzelstimmen && b.stimmen && Object.keys(b.stimmen).length > 0) {
          bl.push({ typ: "absatz", fett: true, groesse: 9.5, text: "Einzelstimmen:" });
          Object.keys(b.stimmen).forEach((eid) => {
            const az = anw.find((x) => String(x.einheit_id) === String(eid));
            bl.push({ typ: "punkt", label: az ? az.einheit_nr : String(eid),
              text: (az ? az.eigentuemer_namen : "—") + " — "
                + (wLabel[b.stimmen[eid]] || "—") });
          });
        }
      } else {
        bl.push({ typ: "absatz", fett: true,
          text: "Abstimmung (" + (versammlung.stimmprinzip || "MEA") + "): "
            + "Ja " + meaStr(ab.ja) + " · Nein " + meaStr(ab.nein)
            + " · Enthaltung " + meaStr(ab.enthaltung) + " — "
            + (b.ergebnis === "angenommen" ? "ANGENOMMEN" : "ABGELEHNT") });
      }
      bl.push({ typ: "absatz", text: "Der Versammlungsleiter verkündete das Beschlussergebnis." });
      if (b.anfechtungsfrist_bis) {
        bl.push({ typ: "absatz", farbe: "grau",
          text: "Anfechtungsfrist bis " + datumDe(b.anfechtungsfrist_bis) + " (§45 WEG)" });
      }
    } else if (tp.beschluss_noetig) {
      bl.push({ typ: "absatz", farbe: "grau", text: "Abstimmung noch offen." });
    }
    if (tp.notiz) bl.push({ typ: "absatz", farbe: "grau", text: tp.notiz });
  });
  // Anwesenheitsliste + Weisungen.
  if (anw.length > 0) {
    bl.push({ typ: "abstand", hoehe: 8 });
    bl.push({ typ: "ueberschrift", groesse: 12, text: "Anwesenheitsliste" });
    anw.forEach((a) => {
      bl.push({ typ: "punkt", label: a.einheit_nr || "—",
        text: (a.eigentuemer_namen || "—") + " · "
          + (nachMea ? meaStr(a.stimmgewicht) + " MEA" : "1 Stimme") + " · "
          + (a.status === "anwesend" ? "anwesend"
            : (a.status === "vertreten"
              ? "vertreten durch " + (a.vertreten_durch || "—")
                + (a.ist_verwaltervollmacht ? " (Verwalter-Vollmacht)" : "")
              : "—")) });
    });
    bl.push({ typ: "absatz", fett: true, text: bf.text });
    const mitWeisung = anw.filter((a) => a.status === "vertreten"
      && a.weisungen && Object.keys(a.weisungen).length > 0);
    if (mitWeisung.length > 0) {
      bl.push({ typ: "ueberschrift", groesse: 12, text: "Vollmachten mit Weisung (§25 WEG)" });
      mitWeisung.forEach((a) => {
        const teile = Object.keys(a.weisungen).map((topId) => {
          const tp = tops.find((x) => x.id === topId);
          return "TOP " + (tp ? tp.nummer : "?") + " " + (wLabel[a.weisungen[topId]] || "");
        }).join(" · ");
        bl.push({ typ: "punkt", label: a.einheit_nr || "—",
          text: (a.eigentuemer_namen || "—") + " — vertreten durch "
            + (a.vertreten_durch || "—")
            + (a.ist_verwaltervollmacht ? " [Verwalter-Vollmacht]" : "") + ": " + teile });
      });
    }
  }
  // Anlagenverzeichnis (Versammlung + TOPs) — nur Titel, wie HTML-Weg.
  const verzeichnis = [];
  (versammlung.anlagen || []).forEach((a) => verzeichnis.push({ a, zu: "" }));
  tops.forEach((tp) => (tp.anlagen || []).forEach((a) =>
    verzeichnis.push({ a, zu: " (zu TOP " + (tp.nummer || "?") + ")" })));
  if (verzeichnis.length > 0) {
    bl.push({ typ: "abstand", hoehe: 8 });
    bl.push({ typ: "ueberschrift", groesse: 12, text: "Anlagenverzeichnis" });
    verzeichnis.forEach((v, i) => {
      bl.push({ typ: "punkt", label: "Anlage " + (i + 1),
        text: (v.a.titel || "—") + v.zu });
    });
  }
  // Unterschriften (§24 WEG).
  bl.push({ typ: "abstand", hoehe: 10 });
  bl.push({ typ: "ueberschrift", groesse: 12, text: "Unterschriften" });
  const uZeile = (kid, rolle, am) => {
    bl.push({ typ: "abstand", hoehe: 26 });
    bl.push({ typ: "zeile" });
    bl.push({ typ: "absatz",
      text: (kid ? kontaktNameVonId(kontakte, kid) : "________________") + ", " + rolle
        + (am ? " — unterschrieben am " + datumDe(am) : "") });
  };
  uZeile(versammlung.leiter_kontakt_id, "Versammlungsleiter", versammlung.unterschrift_leiter_am);
  uZeile(versammlung.unterschrift_eigentuemer_kontakt_id, "Wohnungseigentümer",
    versammlung.unterschrift_eigentuemer_am);
  if (versammlung.beirat_vorsitz_kontakt_id) {
    uZeile(versammlung.beirat_vorsitz_kontakt_id,
      "Vorsitzender des Verwaltungsbeirats", versammlung.unterschrift_beirat_am);
  }
  return bl;
}

function EtvUnterlagenKarte({ versammlung, onWelt, t, accent, editModeGlobal, onAnsehen }) {
  const [offen, setOffen] = useState(true);
  const unterlagen = Array.isArray(versammlung.unterlagen) ? versammlung.unterlagen : [];
  if (unterlagen.length === 0) return null;
  return (
    <BausteinKarte t={t} accent={accent} titel="Unterlagen"
      offen={offen} onToggle={() => setOffen(!offen)}
      sub={unterlagen.length === 1 ? "1 Dokument" : unterlagen.length + " Dokumente"}>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {unterlagen.map((u) => (
          <div key={u.id} style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div onClick={() => onAnsehen({ id: u.dateiRef, name: u.titel || "Unterlage" })}
              style={{ flex: 1, minWidth: 0, cursor: "pointer" }}>
              <div style={{ fontSize: FS.s, fontWeight: FW.bold, color: t.text,
                overflowWrap: "anywhere" }}>
                {(UNTERLAGE_ART_LABEL[u.art] || "Dokument") + " · " + (u.titel || "—")}
              </div>
              <div style={{ fontSize: FS.xs, color: t.muted }}>
                {(u.erzeugt_am ? datumDe(u.erzeugt_am.slice(0, 10))
                  + " " + u.erzeugt_am.slice(11, 16) : "")
                  + (u.hinweis ? " · " + u.hinweis : "")}
              </div>
            </div>
            {editModeGlobal ? (
              <button onClick={() => {
                  if (u.dateiRef) dateiLoeschen(u.dateiRef);
                  onWelt((w) => weltVersammlungUnterlageWeg(w, versammlung.id, u.id));
                }}
                title="Unterlage löschen" aria-label="Unterlage löschen"
                style={{ display: "flex", alignItems: "center", justifyContent: "center",
                  width: 30, height: 30, flexShrink: 0, borderRadius: RAD.pill,
                  border: "1px solid #EF4444", background: "none", cursor: "pointer" }}>
                <I name="trash" size={13} color="#EF4444"/>
              </button>
            ) : null}
          </div>
        ))}
      </div>
    </BausteinKarte>
  );
}

// ── Druck-Menü (§5): DAS ETV-Menü im Akten-Kopf ─────────────────────────────
// Drucker-Button öffnet dieses Menü: Tagesordnung + Einladung erzeugen PDFs
// (immer abgelegt, dann Viewer), Protokoll druckt wie bisher (synchroner
// window.print-Weg, §26.3). Einstellungen (Wortlaut-Haken, Empfänger-Modus,
// Absender, Protokoll-Haken) wohnen hier.
function EtvDruckMenue({ versammlung, ve, welt, kontakte, onWelt, t, accent, onClose,
  bilderEinbetten, setBilderEinbetten, einzelstimmen, setEinzelstimmen, onAnsehen }) {
  const [schritt, setSchritt] = useState("menue"); // menue | einladung
  const [mitWortlaut, setMitWortlaut] = useState(true);
  const [einlModus, setEinlModus] = useState("einheit"); // Standard je Einheit (Entscheidung 1)
  const [absender, setAbsender] = useState(versammlung.einladung_absender || "");
  const [laufend, setLaufend] = useState(false);
  const [fehler, setFehler] = useState("");
  const empfaenger = einladungsEmpfaenger(ve, kontakte, einlModus);
  const briefe = empfaenger.filter((r) => !r.leer);
  const leere = empfaenger.filter((r) => r.leer);
  const erzeuge = (art) => {
    if (laufend) return;
    setLaufend(true); setFehler("");
    const opt = { mitWortlaut, modus: einlModus, absender };
    const bloecke = art === "tagesordnung"
      ? baueTagesordnungBloecke(versammlung, ve, welt, opt)
      : art === "protokoll"
      ? baueProtokollBloecke(versammlung, ve, welt, kontakte, { einzelstimmen })
      : baueEinladungBloecke(versammlung, ve, welt, kontakte, opt);
    const hinweis = art === "einladung"
      ? briefe.length + (briefe.length === 1 ? " Brief" : " Briefe")
        + (einlModus === "einheit" ? ", je Einheit" : ", je Eigentümer")
      : art === "protokoll"
      ? (einzelstimmen ? "mit Einzelstimmen" : "")
      : (mitWortlaut ? "mit Beschlussvorlagen" : "");
    bauePdf(bloecke, { fusszeile: "AllesDa · " + etvObjektText(ve) })
      .then((bytes) => {
        const name = pdfDateiName(art, versammlung);
        const file = new File([bytes], name, { type: "application/pdf" });
        return dateiSpeichern(file).then((meta) => {
          onWelt((w) => {
            let neu = weltVersammlungUnterlage(w, versammlung.id,
              { art, titel: name, dateiRef: meta.id, hinweis });
            if (art === "einladung" && absender !== (versammlung.einladung_absender || "")) {
              neu = weltVersammlungPatch(neu, versammlung.id, { einladung_absender: absender });
            }
            return neu;
          });
          setLaufend(false);
          onAnsehen({ id: meta.id, name });
          onClose();
        });
      })
      .catch(() => { setLaufend(false); setFehler("PDF konnte nicht erzeugt werden."); });
  };
  return (
    <div style={overlayBackdrop(210)} onClick={onClose}>
      <div style={overlayPanel(t)} onClick={(e) => e.stopPropagation()}>
        <OverlayKopf t={t} icon="printer"
          titel={schritt === "einladung" ? "Einladung erzeugen" : "Drucken & Unterlagen"}
          onClose={onClose}/>
        <div style={overlayBody()}>
          {schritt === "menue" ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <AktionsButton rolle="bestaetigen" variante="breit" t={t} accent={accent}
                onClick={() => erzeuge("tagesordnung")}
                text={laufend ? "Erzeuge …" : "Tagesordnung (PDF)"}/>
              <AktionsButton rolle="bestaetigen" variante="breit" t={t} accent={accent}
                onClick={() => setSchritt("einladung")}
                text="Einladung mit Anschreiben (PDF) …"/>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <div style={{ flex: 1, fontSize: FS.s, color: t.sub }}>
                  Beschlussvorlagen mitdrucken</div>
                <Toggle value={mitWortlaut} color={accent} onChange={setMitWortlaut}/>
              </div>
              <div style={{ borderTop: "1px solid " + t.border, paddingTop: 10,
                display: "flex", flexDirection: "column", gap: 8 }}>
                <AktionsButton rolle="bestaetigen" variante="breit" t={t} accent={accent}
                  onClick={() => erzeuge("protokoll")}
                  text={laufend ? "Erzeuge …" : "Protokoll als PDF ablegen"}/>
                <AktionsButton rolle="abbrechen" variante="breit" t={t} accent={accent}
                  onClick={() => { druckeEtvProtokoll(versammlung, ve, welt, kontakte,
                    { bilderEinbetten, einzelstimmen }); onClose(); }}
                  text="Protokoll drucken (Papier)"/>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <div style={{ flex: 1, fontSize: FS.s, color: t.sub }}>
                    Bilder eingebettet drucken</div>
                  <Toggle value={bilderEinbetten} color={accent} onChange={setBilderEinbetten}/>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <div style={{ flex: 1, fontSize: FS.s, color: t.sub }}>
                    Einzelstimmen namentlich drucken</div>
                  <Toggle value={einzelstimmen} color={accent} onChange={setEinzelstimmen}/>
                </div>
              </div>
              {fehler ? (
                <div style={{ fontSize: FS.s, color: "#EF4444" }}>{fehler}</div>
              ) : null}
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <div>
                <label style={{ display: "block", fontSize: FS.xs, fontWeight: FW.bold,
                  color: t.muted, marginBottom: 4 }}>Empfänger</label>
                <SegmentControl t={t} accent={accent} voll={false}
                  options={[{ id: "einheit", label: "Je Einheit ein Brief" },
                    { id: "eigentuemer", label: "Je Eigentümer" }]}
                  value={einlModus} onChange={setEinlModus}/>
                <div style={{ fontSize: FS.xs, color: t.muted, marginTop: 4 }}>
                  {briefe.length === 1 ? "1 Brief wird erzeugt."
                    : briefe.length + " Briefe werden erzeugt."}
                </div>
                {leere.length > 0 ? (
                  <div style={{ fontSize: FS.xs, color: "#F59E0B", marginTop: 2 }}>
                    {leere.map((r) => r.einheit.nr || r.einheit.bezeichnung || "Einheit")
                      .join(", ") + (leere.length === 1
                        ? " hat keinen aktiven Eigentümer und wird übersprungen."
                        : " haben keinen aktiven Eigentümer und werden übersprungen.")}
                  </div>
                ) : null}
              </div>
              <div>
                <label style={{ display: "block", fontSize: FS.xs, fontWeight: FW.bold,
                  color: t.muted, marginBottom: 4 }}>
                  Absender / Briefkopf (wird gemerkt)</label>
                <textarea value={absender} onChange={(e) => setAbsender(e.target.value)}
                  rows={3} placeholder={"Hausverwaltung Muster\nMusterstraße 1\n04109 Leipzig"}
                  style={{ width: "100%", boxSizing: "border-box", fontSize: 16,
                    fontFamily: "inherit", color: t.text, background: t.bg,
                    border: "1px solid " + t.border, borderRadius: RAD.sm,
                    padding: "8px 10px", resize: "vertical" }}/>
              </div>
              <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
                <AktionsButton rolle="abbrechen" variante="breit" t={t} accent={accent}
                  onClick={() => setSchritt("menue")} text="Zurück"/>
                <AktionsButton rolle="bestaetigen" variante="breit" t={t} accent={accent}
                  onClick={() => erzeuge("einladung")}
                  text={laufend ? "Erzeuge …" : "Einladung erzeugen"}/>
              </div>
              {fehler ? (
                <div style={{ fontSize: FS.s, color: "#EF4444" }}>{fehler}</div>
              ) : null}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function EtvDetail({ versammlung, ve, onVePatch, welt, onWelt, kontakte, settings, t, accent, onZurueck }) {
  const [tab, setTab] = useState("uebersicht");
  // §12.9: Akten-Kopf trägt Bearbeiten (globaler editMode), Drucken, Löschen.
  const [loeschConfirm, setLoeschConfirm] = useState(false);
  const [editModeGlobal, setEditModeGlobal] = useState(false);
  // Druck-Optionen liegen hier (Kopf-Drucker nutzt sie); die Übersicht-Karte
  // zeigt die Toggles und schreibt hierher zurück.
  const [bilderEinbetten, setBilderEinbetten] = useState(false);
  const [einzelstimmen, setEinzelstimmen] = useState(false);
  // Druck-Menü (§5, 19.07.): der Drucker-Button öffnet DAS ETV-Menü —
  // Druckwerke + Einstellungen. Viewer zeigt erzeugte/abgelegte PDFs.
  const [druckMenue, setDruckMenue] = useState(false);
  const [unterlageViewer, setUnterlageViewer] = useState(null); // {id, name}
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
        {/* §12.10 Akten-Kopf-Aktionen: Ansicht [Drucken][Bearbeiten],
            Bearbeiten [Löschen][X][Bestätigen]. Nur im Übersicht-Tab. */}
        {tab === "uebersicht" ? (
          <KopfAktionsLeiste t={t} accent={accent} editMode={editModeGlobal}
            onEdit={() => setEditModeGlobal(true)}
            onCancel={() => { setEditModeGlobal(false); setLoeschConfirm(false); }}
            onConfirm={() => { setEditModeGlobal(false); setLoeschConfirm(false); }}
            onPrint={() => setDruckMenue(true)}
            loeschConfirm={loeschConfirm}
            onDelete={() => {
              if (!loeschConfirm) { setLoeschConfirm(true); return; }
              onWelt((w) => weltVersammlungLoeschen(w, versammlung.id));
              if (onZurueck) onZurueck();
            }}/>
        ) : (
          <KopfIconButton icon="printer" title="Drucken & Unterlagen" t={t} accent={accent}
            onClick={() => setDruckMenue(true)}/>
        )}
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
        <EtvUebersichtTab versammlung={versammlung} ve={ve} onVePatch={onVePatch} welt={welt}
          onWelt={onWelt} kontakte={kontakte} t={t} accent={accent}
          editModeGlobal={editModeGlobal}
          onUnterlageAnsehen={setUnterlageViewer}
          bilderEinbetten={bilderEinbetten} setBilderEinbetten={setBilderEinbetten}
          einzelstimmen={einzelstimmen} setEinzelstimmen={setEinzelstimmen}/>
      ) : null}
      {tab === "tagesordnung" ? (
        <EtvTagesordnungTab versammlung={versammlung} ve={ve} onVePatch={onVePatch} welt={welt}
          onWelt={onWelt} settings={settings} t={t} accent={accent}/>
      ) : null}
      {tab === "te" ? (
        <TERegisterAnsicht ve={ve} t={t} accent={accent}/>
      ) : null}
      {tab === "beschluesse" ? (
        <EtvBeschluesseTab versammlung={versammlung} welt={welt} onWelt={onWelt}
          t={t} accent={accent}/>
      ) : null}
      {druckMenue ? (
        <EtvDruckMenue versammlung={versammlung} ve={ve} welt={welt} kontakte={kontakte}
          onWelt={onWelt} t={t} accent={accent} onClose={() => setDruckMenue(false)}
          bilderEinbetten={bilderEinbetten} setBilderEinbetten={setBilderEinbetten}
          einzelstimmen={einzelstimmen} setEinzelstimmen={setEinzelstimmen}
          onAnsehen={setUnterlageViewer}/>
      ) : null}
      {unterlageViewer ? (
        <DateiViewerModal t={t} accent={accent} datei={unterlageViewer}
          onClose={() => setUnterlageViewer(null)}/>
      ) : null}
    </div>
  );
}

// ── EtvBereichFuerObjekt — der renderDetail-Inhalt der ETV-Kachel ───────────
// Ohne offene Akte: Versammlungsliste (aktiv) + Archiv (KlappBereich) +
// Neu-Anlegen. Mit offener Akte: EtvDetail (die vier Tabs).
function EtvBereichFuerObjekt({ ve, onVePatch, welt, onWelt, kontakte, settings, t, accent, akteId, setAkteId }) {
  const [archivOffen, setArchivOffen] = useState(false);

  // Auto-Hülle (§2.3/2.6): garantiert, dass IMMER eine offene ordentliche ETV
  // existiert — sie ist das Zuhause vertagter/vorgemerkter Beschlüsse. Sicht-Ebene
  // via useEffect (seiteneffektfrei im Render); idempotent, erzeugt nur wenn keine
  // offene existiert. Läuft auch ohne Historie (Erst-ETV §2.3b).
  useEffect(() => {
    if (!ve || ve.id == null) return;
    if (offeneOrdentlicheEtv(welt, ve.id)) return;
    onWelt((w) => garantiereOffeneEtv(w, ve).welt);
    // Abhängig von objekt-id + Anzahl Versammlungen: nach Erzeugung existiert
    // eine offene → Effekt feuert nicht erneut (idempotent).
    // eslint-disable-next-line
  }, [ve && ve.id, (welt.versammlungen || []).length]);

  const alle = versammlungenFuerObjekt(welt, ve.id)
    .sort((a, b) => String(b.datum || "").localeCompare(String(a.datum || "")));
  // Rollierendes Fenster (§2.5, abgeleitet): "aktiv" (in Arbeit) + "nachschau"
  // (abgeschlossen, Vorjahr/aktuell) bleiben oben; "archiv" (älter oder manuell)
  // klappt weg. Kein Trigger, kein Jahres-Umschreiben — reine Ableitung.
  const aktive = alle.filter((v) => etvSichtklasse(v) !== "archiv");
  const archiv = alle.filter((v) => etvSichtklasse(v) === "archiv");
  const akte = akteId ? alle.find((v) => v.id === akteId) || null : null;

  if (akte) {
    return (
      <EtvDetail versammlung={akte} ve={ve} onVePatch={onVePatch} welt={welt} onWelt={onWelt}
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
      {/* §12.8: Neu-Anlegen läuft über den Screen-Header-Plus →
          VersammlungNeuOverlay (Objektwahl im Dialog). Der frühere breite
          Aktions-Button + Inline-Form sind entfallen (Beschluss 18.07.). */}
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
  EtvBereichFuerObjekt, EtvDetail, VersammlungZeile, VersammlungNeuOverlay,
  etvAnwesenheitZeilen, druckeEtvProtokoll, baueEtvProtokollHtml, AbstimmCockpit,
};
