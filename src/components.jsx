import React, { useState, useRef, useEffect, useContext, createContext, Fragment } from "react";
import {
  ACCENT, FS, FW, KONTAKTE_FARBE, RAD, effColor, effKuerzel, getContrastColor,
  rolleEckPosition, rolleEckSichtbar, sortKontakte, toGrau, verwendungBadgeSichtbar,
  verwendungEckPosition, verwendungEckSichtbar
} from "./constants.js";
import {
  datumDe, isoHeute, istDatumGueltig, istEmailGueltig, istTelefonGueltig,
  listeBreiteAus, parseDatumWert, zuIsoDatum
} from "./utils-basis.js";
import {
  ANLEGE_FELDTYPEN, EIG_STATUS, FIELD_TYPES, SUGGESTIONS, aktiverHaushalt,
  eigStatus, findeKontaktKandidaten, verwendungenVon
} from "./datenmodell.js";
import {
  I, StickySectionHeader, formatNameMitCtx, passendeMasterSpalten, useAvatarIcons,
  useContentWidth, useFirmenRollen, useKategorien,
  useKontaktAnzeige, useKontaktFarbe, useLeistungen, useRollen, useVerwendungen,
  useZeitPicker, zuweisungenFuerAvatar
} from "./utils-icons.jsx";
// ZYKLISCHER Import aus der Hauptdatei: diese 10 Namen leben (noch) in S5/S7.
// Alle Nutzungen erfolgen zur Laufzeit (JSX-Returns/Callbacks), nie beim Modul-
// Init — daher von esbuild korrekt auflösbar. Siehe BUILD_TROUBLESHOOTING.
import {
  AktionsButton, KontaktDetailKarte, KontaktKarte, ObjektPicker
} from "./kontakte-modul.jsx";
import {
  eigStufen, feldImKalender, istFristFeldName, quoteLabel
} from "./liegenschaft.jsx";
import { FeldObjektKarte } from "./objektansicht.jsx";
import { isoKW } from "./kalender.jsx";

// ╔═════════════════════════════════════════════════════════════════════════╗
// ║ SEKTION 4 · UI-BAUSTEINE — ausgelagertes Modul                          ║
// ╚═════════════════════════════════════════════════════════════════════════╝


// ── Toggle ──────────────────────────────────────────────────────────────────
function Toggle({ value, onChange, color = ACCENT, disabled = false }) {
  return (
    <div onClick={() => !disabled && onChange(!value)} style={{
      width: 30, height: 17, borderRadius: RAD.md,
      background: value ? color : "#3D3D5C", position: "relative",
      cursor: disabled ? "not-allowed" : "pointer",
      transition: "background 0.2s", flexShrink: 0,
      opacity: disabled ? 0.5 : 1,
    }}>
      <div style={{
        width: 13, height: 13, borderRadius: RAD.full, background: "#fff",
        position: "absolute", top: 2, left: value ? 15 : 2,
        transition: "left 0.2s",
      }}/>
    </div>
  );
}

// ── SegmentControl — einheitliche Auswahl aus 2–4 Optionen (DESIGN §37) ─────
// Ersetzt alle handgebauten Segment-Button-Reihen und Auswahl-Pill-Reihen.
// options: [{ id, label, icon? }]. Aktiv = voller Akzent + Kontrasttext.
function SegmentControl({ options, value, onChange, accent = ACCENT, t, voll = true }) {
  return (
    <div style={{ display: "inline-flex", gap: 4, background: t.surface,
      border: `1px solid ${t.border}`, borderRadius: RAD.md, padding: 3,
      maxWidth: "100%", flexWrap: "wrap" }}>
      {(options || []).map(opt => {
        const aktiv = value === opt.id;
        const aktivBg = voll ? accent : accent + "20";
        const aktivFg = voll ? getContrastColor(accent) : accent;
        return (
          <button key={opt.id} onClick={() => onChange(opt.id)} style={{
            padding: "6px 12px", borderRadius: RAD.sm,
            background: aktiv ? aktivBg : "transparent",
            color: aktiv ? aktivFg : t.sub,
            border: voll ? "none" : `1px solid ${aktiv ? accent : "transparent"}`,
            cursor: "pointer", fontFamily: "inherit",
            fontSize: FS.m, fontWeight: FW.medium, transition: "all 0.15s",
            display: "inline-flex", alignItems: "center", gap: 6, whiteSpace: "nowrap" }}>
            {opt.icon ? <I name={opt.icon} size={15}
              color={aktiv ? aktivFg : t.sub}/> : null}
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

// ── Inp (Label + Eingabefeld) ───────────────────────────────────────────────
function Inp({ label, value, onChange, placeholder, t, accent = ACCENT, type = "text", required = false, readOnly = false, invalid = false, hinweis = "" }) {
  const randFarbe = invalid ? "#EF4444" : (value ? accent + "50" : t.border);
  return (
    <div style={{ marginBottom: 10, minWidth: 0 }}>
      {label && (
        <label style={{ fontSize: FS.s, fontWeight: FW.medium, color: t.sub, display: "block", marginBottom: 4 }}>
          {label}{required && <span style={{ color: "#EF4444", marginLeft: 3 }}>*</span>}
        </label>
      )}
      <input value={value || ""} onChange={e => onChange(e.target.value)}
        placeholder={placeholder} type={type} readOnly={readOnly}
        style={{ width: "100%", boxSizing: "border-box", background: t.surface,
          border: `1px solid ${randFarbe}`,
          borderRadius: RAD.ms, padding: "7px 10px", fontSize: FS.input,
          color: readOnly ? t.muted : t.text, outline: "none",
          transition: "border-color 0.15s", fontFamily: "inherit" }}/>
      {invalid && hinweis && (
        <div style={{ fontSize: FS.xs, color: "#EF4444", marginTop: 3 }}>{hinweis}</div>
      )}
    </div>
  );
}

// ── Datums-Helfer ───────────────────────────────────────────────────────────

// ── DatumFeld: eigener Dreh-Picker (Tag / Monat / Jahr) ─────────────────────
// Bewusst KEIN <input type="date">: dessen Darstellung (Kalender vs. Räder)
// entscheidet das OS, nicht die App. Stattdessen drei scroll-snap-Spalten, die
// auf jedem Gerät gleich aussehen und sich per Wischen/Tippen drehen lassen.
// Nach außen weiterhin deutsches Format "tt.mm.jjjj" (Datenmodell unverändert).
// Default = heute, sobald das Feld leer ist (defaultHeute, an).
const DATUM_MONATE_KURZ = ["Jan","Feb","Mär","Apr","Mai","Jun",
  "Jul","Aug","Sep","Okt","Nov","Dez"];
const DATUM_MONATE = ["Januar","Februar","März","April","Mai","Juni",
  "Juli","August","September","Oktober","November","Dezember"];
function tageImMonat(monat1, jahr) {
  return new Date(jahr, monat1, 0).getDate(); // monat1 = 1..12
}
function DatumSpalte({ items, render, index, onIndex, t, accent, breite, zeile = 34, reihen = 3 }) {
  const ref = useRef(null);
  const ZEILE = zeile; // px pro Eintrag
  const POLSTER = Math.floor(reihen / 2); // Polsterreihen je Seite
  // Position synchron halten, wenn sich index von außen ändert.
  useEffect(() => {
    const el = ref.current;
    if (el && Math.round(el.scrollTop / ZEILE) !== index) {
      el.scrollTop = index * ZEILE;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index]);
  const onScroll = () => {
    const el = ref.current;
    if (!el) return;
    const i = Math.max(0, Math.min(items.length - 1, Math.round(el.scrollTop / ZEILE)));
    if (i !== index) onIndex(i);
  };
  return (
    <div ref={ref} onScroll={onScroll}
      style={{ flex: breite ? `0 0 ${breite}px` : 1, height: ZEILE * reihen,
        overflowY: "auto", scrollSnapType: "y mandatory",
        WebkitOverflowScrolling: "touch", scrollbarWidth: "none",
        position: "relative" }}>
      {/* Polster oben/unten, damit jeder Eintrag mittig snappen kann */}
      <div style={{ height: ZEILE * POLSTER }}/>
      {items.map((it, i) => (
        <div key={i} onClick={() => { const el = ref.current; if (el) el.scrollTop = i * ZEILE; onIndex(i); }}
          style={{ height: ZEILE, scrollSnapAlign: "center",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: FS.xl, cursor: "pointer", userSelect: "none",
            whiteSpace: "nowrap",
            fontWeight: i === index ? 800 : 500,
            color: i === index ? accent : t.sub,
            opacity: i === index ? 1 : 0.4,
            transition: "color 0.1s, opacity 0.1s" }}>
          {render(it)}
        </div>
      ))}
      <div style={{ height: ZEILE * POLSTER }}/>
    </div>
  );
}
// Formatiert einen gespeicherten Datumswert (de ODER iso) als "tt.mm.jjjj"
// für die Anzeige im Feld.
function datumAnzeige(value) {
  const d = parseDatumWert(value);
  if (!d || isNaN(d.getTime())) return "";
  return String(d.getDate()).padStart(2, "0") + "." +
         String(d.getMonth() + 1).padStart(2, "0") + "." + d.getFullYear();
}

// Modal-Overlay mit den drei Dreh-Spalten + Bestätigen.
// Monat/Jahr-Rad-Picker (gleiche Bausteine wie DatumPickerModal/TagMonat-
// PickerModal — DatumSpalte-Räder, gleiches Modal-Layout). Wert: "YYYY-MM".
function MonatJahrPickerModal({ startWert, titel, onConfirm, onClose, t, accent }) {
  const m = String(startWert || "").match(/^(\d{4})-(\d{1,2})$/);
  const jetzt = new Date();
  const initJahr = m ? parseInt(m[1], 10) : jetzt.getFullYear();
  const initMon  = m ? parseInt(m[2], 10) : jetzt.getMonth() + 1;
  const [mon, setMon]   = useState(initMon >= 1 && initMon <= 12 ? initMon : 1);
  const [jahr, setJahr] = useState(initJahr);
  const ZEILE = 36;
  const jahre = [];
  for (let j = jetzt.getFullYear() - 30; j <= jetzt.getFullYear() + 5; j++) jahre.push(j);
  const jahrIdx = jahre.indexOf(jahr) < 0 ? jahre.indexOf(jetzt.getFullYear()) : jahre.indexOf(jahr);
  return (
    <div onClick={onClose}
      style={{ position: "fixed", top: 0, right: 0, bottom: 0, left: 0, background: "rgba(0,0,0,0.6)",
        zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div onClick={e => e.stopPropagation()}
        style={{ background: t.card, border: `1px solid ${t.border}`,
          borderRadius: RAD.xl, padding: 16, width: "100%", maxWidth: 280,
          boxShadow: "0 20px 60px rgba(0,0,0,0.5)" }}>
        <div style={{ fontSize: FS.l, fontWeight: FW.bold, color: t.text,
          marginBottom: 12, textAlign: "center" }}>{titel || "Monat & Jahr wählen"}</div>
        <div style={{ display: "flex", gap: 6, justifyContent: "center",
          position: "relative", marginBottom: 14 }}>
          <div style={{ position: "absolute", left: 0, right: 0,
            top: "50%", transform: "translateY(-50%)", height: ZEILE,
            borderTop: `1px solid ${accent}55`, borderBottom: `1px solid ${accent}55`,
            borderRadius: RAD.ms, background: accent + "12", pointerEvents: "none" }}/>
          <DatumSpalte items={DATUM_MONATE_KURZ} render={mm => mm} t={t} accent={accent} breite={72} zeile={ZEILE} reihen={5}
            index={mon - 1}
            onIndex={i => setMon(i + 1)}/>
          <DatumSpalte items={jahre} render={j => j} t={t} accent={accent} breite={72} zeile={ZEILE} reihen={5}
            index={jahrIdx}
            onIndex={i => setJahr(jahre[i])}/>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={onClose}
            style={{ flex: 1, padding: "9px 0", borderRadius: RAD.sm, cursor: "pointer", fontFamily: "inherit",
              fontSize: FS.s, fontWeight: FW.bold, background: "transparent",
              border: `1px solid ${t.border}`, color: t.sub }}>
            Abbrechen
          </button>
          <button onClick={() => onConfirm(jahr + "-" + String(mon).padStart(2, "0"))}
            style={{ flex: 1, padding: "9px 0", borderRadius: RAD.sm, cursor: "pointer", fontFamily: "inherit",
              fontSize: FS.s, fontWeight: FW.bold, background: accent, border: "none",
              color: getContrastColor(accent) }}>
            Übernehmen
          </button>
        </div>
      </div>
    </div>
  );
}

// Inline-Kalender (Monats-Scroller) OHNE Overlay-Hülle. Wird vom
// DatumPickerModal (im Overlay) UND direkt im geführten Termin-Modus genutzt,
// damit dort kein drittes gestapeltes Fenster aufgeht.
// hoehe: Pixelhöhe des Scrollbereichs (Default 330).
function DatumKalender({ startWert, onWaehle, t, accent, iso, hoehe = 330 }) {
  const heute = new Date();
  const init = parseDatumWert(startWert) || heute;
  const initY = init.getFullYear(), initM = init.getMonth(); // M = 0..11
  // Sichtbare Monate: volle 2 Jahre zurück … 2 Jahre voraus (Jan…Dez), damit
  // jeder Jahres-Klick in der Kopf-Leiste auch wirklich hinscrollen kann.
  const JAHR_SPANNE = 2;
  const monate = [];
  for (let jy = initY - JAHR_SPANNE; jy <= initY + JAHR_SPANNE; jy++) {
    for (let mm = 0; mm < 12; mm++) {
      monate.push({ y: jy, m: mm, key: jy + "-" + mm });
    }
  }
  const scrollRef = useRef(null);
  const startMonatRef = useRef(null);
  // Refs auf den Januar jedes Jahres → Sprungziel für die Jahres-Leiste.
  const jahrRefs = useRef({});
  // Header zeigt den aktuell sichtbaren Monat/Jahr (folgt dem Scrollen).
  const [kopf, setKopf] = useState({ y: initY, m: initM });
  // Beim Öffnen direkt zum Start-Monat scrollen.
  useEffect(() => {
    const el = startMonatRef.current;
    const box = scrollRef.current;
    if (el && box) box.scrollTop = el.offsetTop - box.offsetTop - 4;
  }, []);

  // Klick auf eine Jahreszahl in der Kopf-Leiste → zum Januar des Jahres scrollen.
  const springZuJahr = (jahr) => {
    const box = scrollRef.current;
    const ziel = jahrRefs.current[jahr];
    if (box && ziel) {
      box.scrollTop = ziel.offsetTop - box.offsetTop - 4;
      setKopf({ y: jahr, m: 0 });
    }
  };

  const waehle = (y, m, tag) => {
    const wert = iso
      ? y + "-" + String(m + 1).padStart(2, "0") + "-" + String(tag).padStart(2, "0")
      : tag + "." + (m + 1) + "." + y;
    if (onWaehle) onWaehle(wert);
  };

  const istHeute = (y, m, tag) =>
    y === heute.getFullYear() && m === heute.getMonth() && tag === heute.getDate();
  const istGewaehlt = (y, m, tag) =>
    y === init.getFullYear() && m === init.getMonth() && tag === init.getDate();

  const WT = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];
  const ZELL = 32; // Zellgröße
  // 8 Spalten: KW + 7 Wochentage. KW-Spalte etwas schmaler.
  const GRID_COLS = "26px repeat(7, 1fr)";

  // Sichtbaren Monat aus dem Scroll-Stand ableiten (für den Header).
  const onScroll = () => {
    const box = scrollRef.current;
    if (!box) return;
    const kinder = box.children;
    const ref = box.scrollTop + 6;
    for (let i = 0; i < kinder.length; i++) {
      const k = kinder[i];
      if (k.offsetTop - box.offsetTop + k.offsetHeight > ref) {
        const y = parseInt(k.getAttribute("data-y"), 10);
        const m = parseInt(k.getAttribute("data-m"), 10);
        if (!isNaN(y) && !isNaN(m) && (y !== kopf.y || m !== kopf.m)) setKopf({ y, m });
        break;
      }
    }
  };

  const renderMonat = (mo) => {
    const { y, m } = mo;
    const erster = new Date(y, m, 1);
    const startWt = (erster.getDay() + 6) % 7; // Mo=0 … So=6
    const anzTage = tageImMonat(m + 1, y);
    // Wochenzeilen bauen (jede Zeile: KW-Wert + 7 Tage/Leerzellen)
    const zellen = [];
    for (let i = 0; i < startWt; i++) zellen.push(null);
    for (let d = 1; d <= anzTage; d++) zellen.push(d);
    while (zellen.length % 7 !== 0) zellen.push(null);
    const wochen = [];
    for (let i = 0; i < zellen.length; i += 7) wochen.push(zellen.slice(i, i + 7));
    const istStart = y === initY && m === initM;
    const setMonatRef = (el) => {
      if (istStart) startMonatRef.current = el;
      if (m === 0) { if (el) jahrRefs.current[y] = el; else delete jahrRefs.current[y]; }
    };
    return (
      <div key={mo.key} data-y={y} data-m={m}
        ref={setMonatRef} style={{ marginBottom: 10 }}>
        <div style={{ fontSize: FS.s, fontWeight: FW.heavy, color: t.text, marginBottom: 4,
          textAlign: "center" }}>
          {DATUM_MONATE[m]}
        </div>
        {wochen.map((woche, wi) => {
          // KW aus dem ersten echten Tag der Woche.
          const ersterTag = woche.find(d => d != null);
          const kw = ersterTag != null ? isoKW(new Date(y, m, ersterTag)) : "";
          return (
            <div key={wi} style={{ display: "grid", gridTemplateColumns: GRID_COLS, gap: 2,
              marginBottom: 2 }}>
              <div style={{ height: ZELL, display: "flex", alignItems: "center",
                justifyContent: "center", fontSize: FS.xs, color: t.muted, fontWeight: FW.bold,
                background: accent + "14", borderRadius: RAD.sm }}>
                {kw}
              </div>
              {woche.map((tag, di) => {
                if (tag == null) return <div key={"l" + di} style={{ height: ZELL }}/>;
                const wochenende = di >= 5;
                const gew = istGewaehlt(y, m, tag);
                const ht = istHeute(y, m, tag);
                const bg = gew ? accent
                  : (ht ? accent + "20" : (wochenende ? t.border + "40" : "transparent"));
                return (
                  <button key={tag} onClick={() => waehle(y, m, tag)}
                    style={{ height: ZELL, display: "flex", alignItems: "center",
                      justifyContent: "center", cursor: "pointer", fontFamily: "inherit",
                      fontSize: FS.s, fontWeight: gew ? FW.heavy : (ht ? FW.bold : FW.medium),
                      color: gew ? getContrastColor(accent) : (wochenende ? t.muted : t.text),
                      background: bg,
                      border: ht && !gew ? `1px solid ${accent}80` : "1px solid transparent",
                      borderRadius: RAD.ms, padding: 0, outline: "none",
                      transition: "background 0.12s" }}>
                    {tag}
                  </button>
                );
              })}
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", minHeight: 0 }}>
      {/* Jahres-Leiste: kopf.y ±2, mittiges (sichtbares) Jahr farbig, Trenner dazwischen */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center",
        gap: 4, marginBottom: 8 }}>
        {[kopf.y - 2, kopf.y - 1, kopf.y, kopf.y + 1, kopf.y + 2].map((jahr, ji) => {
          const aktiv = jahr === kopf.y;
          return (
            <Fragment key={jahr}>
              {ji > 0 ? (
                <span style={{ color: t.border, fontSize: FS.xs, flexShrink: 0 }}>·</span>
              ) : null}
              <button onClick={() => springZuJahr(jahr)}
                style={{ flex: 1, padding: "5px 0", borderRadius: RAD.sm,
                  border: "none", cursor: "pointer", fontFamily: "inherit",
                  fontSize: aktiv ? FS.s : FS.xs,
                  fontWeight: aktiv ? FW.heavy : FW.medium,
                  color: aktiv ? accent : t.text,
                  background: aktiv ? accent + "22" : "transparent",
                  outline: "none" }}>
                {jahr}
              </button>
            </Fragment>
          );
        })}
      </div>
      {/* Fixer Wochentag-Kopf (mit KW-Spalte) */}
      <div style={{ display: "grid", gridTemplateColumns: GRID_COLS, gap: 2,
        paddingBottom: 6, marginBottom: 4, borderBottom: `1px solid ${t.border}` }}>
        <div style={{ textAlign: "center", fontSize: FS.xs, fontWeight: FW.heavy, color: t.sub,
          background: accent + "14", borderRadius: RAD.sm,
          display: "flex", alignItems: "center", justifyContent: "center" }}>KW</div>
        {WT.map((w, i) => {
          const we = i >= 5;
          return (
            <div key={"wt" + i} style={{ textAlign: "center", fontSize: FS.s,
              fontWeight: FW.heavy, color: we ? t.muted : t.text,
              background: we ? t.border + "40" : "transparent", borderRadius: RAD.sm,
              display: "flex", alignItems: "center", justifyContent: "center",
              padding: "2px 0" }}>{w}</div>
          );
        })}
      </div>
      <div ref={scrollRef} onScroll={onScroll}
        style={{ overflowY: "auto", height: hoehe, maxHeight: "62dvh",
          minHeight: 0, paddingRight: 2 }}>
        {monate.map(renderMonat)}
      </div>
    </div>
  );
}

function DatumPickerModal({ startWert, onConfirm, onClose, t, accent, iso }) {
  return (
    <div onClick={onClose}
      style={{ position: "fixed", top: 0, right: 0, bottom: 0, left: 0, background: "rgba(0,0,0,0.6)",
        zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center",
        padding: 16 }}>
      <div onClick={e => e.stopPropagation()}
        style={{ background: t.card, border: `1px solid ${t.border}`,
          borderRadius: RAD.xl, padding: 14, width: "100%", maxWidth: 320,
          display: "flex", flexDirection: "column", maxHeight: "82dvh",
          boxShadow: "0 20px 60px rgba(0,0,0,0.5)" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between",
          marginBottom: 8 }}>
          <span style={{ fontSize: FS.s, fontWeight: FW.heavy, color: t.text }}>
            Datum auswählen
          </span>
          <button onClick={onClose} title="Schließen" aria-label="Schließen"
            style={{ width: 28, height: 28, borderRadius: RAD.sm, cursor: "pointer",
              border: `1px solid ${t.border}`, background: "transparent", flexShrink: 0,
              display: "flex", alignItems: "center", justifyContent: "center" }}>
            <I name="x" size={12} color={t.sub}/>
          </button>
        </div>
        <DatumKalender startWert={startWert} t={t} accent={accent} iso={iso}
          onWaehle={(w) => onConfirm(w)}/>
      </div>
    </div>
  );
}

// Tag/Monat-Rad-Picker OHNE Jahr (für wiederkehrende Zeiträume, z. B.
// Wirtschaftsjahr). Nutzt dieselbe DatumSpalte wie DatumPickerModal.
// startWert/Ergebnis im Format "TT.MM." (z. B. "01.04.").
function TagMonatPickerModal({ startWert, titel, onConfirm, onClose, t, accent }) {
  const m = String(startWert || "").match(/^(\d{1,2})\.(\d{1,2})/);
  const initTag = m ? parseInt(m[1], 10) : 1;
  const initMon = m ? parseInt(m[2], 10) : 1;
  const [tag, setTag] = useState(initTag >= 1 && initTag <= 31 ? initTag : 1);
  const [mon, setMon] = useState(initMon >= 1 && initMon <= 12 ? initMon : 1);
  const ZEILE = 36;
  const maxTag = tageImMonat(mon, 2024); // Schaltjahr → Feb bis 29 möglich
  const tage = [];
  for (let d = 1; d <= maxTag; d++) tage.push(d);
  const tagGeklemmt = Math.min(tag, maxTag);

  const bestaetigen = () => {
    const t2 = Math.min(tag, tageImMonat(mon, 2024));
    onConfirm(String(t2).padStart(2, "0") + "." + String(mon).padStart(2, "0") + ".");
  };

  return (
    <div onClick={onClose}
      style={{ position: "fixed", top: 0, right: 0, bottom: 0, left: 0, background: "rgba(0,0,0,0.6)",
        zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div onClick={e => e.stopPropagation()}
        style={{ background: t.card, border: `1px solid ${t.border}`,
          borderRadius: RAD.xl, padding: 16, width: "100%", maxWidth: 280,
          boxShadow: "0 20px 60px rgba(0,0,0,0.5)" }}>
        <div style={{ fontSize: FS.l, fontWeight: FW.bold, color: t.text,
          marginBottom: 12, textAlign: "center" }}>{titel || "Tag & Monat wählen"}</div>
        <div style={{ display: "flex", gap: 6, justifyContent: "center",
          position: "relative", marginBottom: 14 }}>
          <div style={{ position: "absolute", left: 0, right: 0,
            top: "50%", transform: "translateY(-50%)", height: ZEILE,
            borderTop: `1px solid ${accent}55`, borderBottom: `1px solid ${accent}55`,
            borderRadius: RAD.ms, background: accent + "12", pointerEvents: "none" }}/>
          <DatumSpalte items={tage} render={d => d} t={t} accent={accent} breite={56} zeile={ZEILE} reihen={5}
            index={tage.indexOf(tagGeklemmt) < 0 ? 0 : tage.indexOf(tagGeklemmt)}
            onIndex={i => setTag(tage[i])}/>
          <DatumSpalte items={DATUM_MONATE_KURZ} render={mm => mm} t={t} accent={accent} breite={72} zeile={ZEILE} reihen={5}
            index={mon - 1}
            onIndex={i => setMon(i + 1)}/>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <AktionsButton variante="breit" rolle="abbrechen" onClick={onClose}
            text="Abbrechen" icon={false} flex={1} t={t} accent={accent}/>
          <AktionsButton variante="breit" rolle="bestaetigen" onClick={bestaetigen}
            text="Übernehmen" icon={false} flex={2} t={t} accent={accent}/>
        </div>
      </div>
    </div>
  );
}

// Tipp-Maske für die Direkteingabe: roher Text → "tt.mm.jjjj" mit
// automatisch gesetzten Punkten, max. 8 Ziffern. Toleriert Teil-Eingaben
// (z.B. "2.6." beim Tippen), erzwingt keine Vollständigkeit.
function maskeDatum(roh) {
  const z = String(roh || "").replace(/[^\d]/g, "").slice(0, 8);
  if (z.length <= 2) return z;
  if (z.length <= 4) return z.slice(0, 2) + "." + z.slice(2);
  return z.slice(0, 2) + "." + z.slice(2, 4) + "." + z.slice(4);
}

function DatumFeld({ value, onChange, t, accent = ACCENT, label, required = false, defaultHeute = true, iso = false, autoOpen = false }) {
  const [offen, setOffen] = useState(false);
  // autoOpen: Picker beim ersten Anzeigen sofort öffnen (geführter Modus).
  useEffect(() => { if (autoOpen) setOffen(true); /* eslint-disable-next-line */ }, []);
  const anzeige = datumAnzeige(value);
  // Lokaler Tipp-Zustand, damit Teil-Eingaben ("2.6.") nicht sofort vom
  // formatierten Außenwert überschrieben werden.
  const [tippWert, setTippWert] = useState(anzeige);
  const [aktiv, setAktiv] = useState(false);
  // Außenwert-Änderungen (Picker, Reset) übernehmen, solange nicht getippt wird.
  useEffect(() => {
    if (!aktiv) setTippWert(anzeige);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [anzeige]);

  const uebernehmen = (text) => {
    const txt = String(text || "").trim();
    if (!txt) { if (onChange) onChange(""); return; }
    const d = parseDatumWert(txt);
    if (d && !isNaN(d.getTime())) {
      const wert = iso
        ? d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0")
        : d.getDate() + "." + (d.getMonth() + 1) + "." + d.getFullYear();
      if (onChange) onChange(wert);
    } else {
      // Ungültig → auf letzten gültigen Anzeige-Wert zurückspringen.
      setTippWert(anzeige);
    }
  };

  const hatWert = !!anzeige;
  const ungueltig = !!value && !istDatumGueltig(value);
  const randFarbe = ungueltig ? "#EF4444"
    : (aktiv ? accent : (hatWert ? accent + "50" : t.border));

  return (
    <div style={{ marginBottom: label ? 10 : 0, minWidth: 0 }}>
      {label && (
        <label style={{ fontSize: FS.s, fontWeight: FW.medium, color: t.sub, display: "block", marginBottom: 4 }}>
          {label}{required && <span style={{ color: "#EF4444", marginLeft: 3 }}>*</span>}
        </label>
      )}
      <div style={{ display: "flex", alignItems: "stretch", minWidth: 0,
        background: t.surface,
        border: `1px solid ${randFarbe}`,
        borderRadius: RAD.ms, overflow: "hidden",
        transition: "border-color 0.15s" }}>
        {/* Direkteingabe per Tastatur */}
        <input type="text" inputMode="numeric" placeholder="tt.mm.jjjj"
          value={tippWert}
          onFocus={() => setAktiv(true)}
          onChange={e => setTippWert(maskeDatum(e.target.value))}
          onBlur={() => { setAktiv(false); uebernehmen(tippWert); }}
          onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); uebernehmen(tippWert); if (e.target && e.target.blur) e.target.blur(); } }}
          style={{ flex: 1, minWidth: 0, boxSizing: "border-box",
            background: "transparent", border: "none", outline: "none",
            padding: "7px 10px", fontSize: FS.input, fontFamily: "inherit",
            color: hatWert || tippWert ? t.text : t.muted }}/>
        {/* Abgesetzter Picker-Trigger: Kalender + Chevron, klar als „öffnet etwas" lesbar */}
        <button onClick={() => setOffen(true)} type="button" title="Datum auswählen"
          style={{ flexShrink: 0, display: "flex", alignItems: "center", gap: 3,
            padding: "0 11px", cursor: "pointer", border: "none",
            borderLeft: `1px solid ${t.border}`,
            background: accent + "14", color: accent }}>
          <I name="calendar" size={16} color={accent}/>
          <I name="chevD" size={11} color={accent}/>
        </button>
      </div>
      {ungueltig && (
        <div style={{ fontSize: FS.xs, color: "#EF4444", marginTop: 3 }}>
          Kein gültiges Datum (tt.mm.jjjj)
        </div>
      )}
      {offen && (
        <DatumPickerModal
          startWert={value || (defaultHeute ? new Date() : null)}
          onConfirm={(w) => { if (onChange) onChange(w); setOffen(false); }}
          onClose={() => setOffen(false)}
          t={t} accent={accent} iso={iso}/>
      )}
    </div>
  );
}

// ── maskeZeit: roher Text → "HH:MM" beim Tippen ─────────────────────────────
function maskeZeit(roh) {
  const z = String(roh || "").replace(/[^\d]/g, "").slice(0, 4);
  if (z.length <= 2) return z;
  return z.slice(0, 2) + ":" + z.slice(2);
}
// "HH:MM" → gültig? (00–23 : 00–59)
function istZeitGueltig(v) {
  const m = String(v || "").match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return false;
  const h = parseInt(m[1], 10), min = parseInt(m[2], 10);
  return h >= 0 && h <= 23 && min >= 0 && min <= 59;
}

// ── ZeitPickerModal: zuerst Stunde wählen, dann Minute → schließt sofort ─────
// Stunden ganztags (24h) oder an Arbeitszeit gekoppelt (±Puffer). Minuten im
// 5er- oder 15er-Raster. Konfiguration via ZeitPickerContext.
// Inline-Schnellwahl Uhrzeit (Stunde → Minute als Buttons), OHNE Overlay.
// Wird vom ZeitPickerModal (im Overlay) UND direkt im geführten Termin-Modus
// genutzt. onWaehle bekommt "HH:MM".
function ZeitWahl({ startWert, onWaehle, t, accent = ACCENT }) {
  const cfg = useZeitPicker();
  const m = String(startWert || "").match(/^(\d{1,2}):(\d{2})$/);
  const initH = m ? parseInt(m[1], 10) : null;
  const initM = m ? parseInt(m[2], 10) : 0;
  const [stunde, setStunde] = useState(initH);
  const [minute, setMinute] = useState(initM);

  // Stunden-Liste je nach Modus (respektiert Arbeitszeit-Einstellung).
  const stunden = [];
  if (cfg.stundenModus === "arbeit") {
    let von = cfg.arbeitVon - cfg.puffer;
    let bis = cfg.arbeitBis + cfg.puffer;
    if (von < 0) von = 0;
    if (bis > 23) bis = 23;
    for (let h = von; h <= bis; h++) stunden.push(h);
  } else {
    for (let h = 0; h <= 23; h++) stunden.push(h);
  }
  // In zwei Spalten teilen: links vor 12, rechts ab 12.
  const vormittag = stunden.filter(h => h < 12);
  const nachmittag = stunden.filter(h => h >= 12);

  // Minuten-Liste je nach Schritt.
  const minuten = [];
  const schritt = cfg.minutenschritt === 5 ? 5 : 15;
  for (let mm = 0; mm < 60; mm += schritt) minuten.push(mm);

  // Bei jeder Änderung den kombinierten Wert melden — sobald eine Stunde
  // gewählt ist (Minute hat Default 0). So füllt sich der Wert sofort.
  const melde = (h, mm) => {
    if (h == null) return;
    if (onWaehle) onWaehle(String(h).padStart(2, "0") + ":" + String(mm).padStart(2, "0"));
  };
  const waehleStunde = (h) => { setStunde(h); melde(h, minute); };
  const waehleMinute = (mm) => { setMinute(mm); melde(stunde, mm); };

  const zellBtn = (val, label, onClick, aktiv) => (
    <button key={val} onClick={onClick}
      style={{ width: "100%", height: 40, boxSizing: "border-box",
        display: "flex", alignItems: "center", justifyContent: "center",
        cursor: "pointer", fontFamily: "inherit", fontSize: FS.m,
        fontWeight: aktiv ? FW.bold : FW.medium,
        color: aktiv ? accent : t.text,
        background: aktiv ? accent + "1E" : "transparent",
        border: `1px solid ${aktiv ? accent : t.border}`,
        borderRadius: RAD.ms, padding: 0, outline: "none" }}>
      {label}
    </button>
  );

  const spaltenKopf = (txt) => (
    <div style={{ fontSize: FS.xs, fontWeight: FW.bold, color: t.muted,
      textTransform: "uppercase", letterSpacing: "0.05em", textAlign: "center",
      marginBottom: 6 }}>{txt}</div>
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", minHeight: 0 }}>
      {/* Stunden in zwei Spalten: links vor 12, rechts ab 12 */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <div>
          {vormittag.length > 0 && spaltenKopf("Vormittag")}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 6 }}>
            {vormittag.map(h => zellBtn(h, String(h).padStart(2, "0"),
              () => waehleStunde(h), stunde === h))}
          </div>
        </div>
        <div>
          {nachmittag.length > 0 && spaltenKopf("Nachmittag")}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 6 }}>
            {nachmittag.map(h => zellBtn(h, String(h).padStart(2, "0"),
              () => waehleStunde(h), stunde === h))}
          </div>
        </div>
      </div>
      {/* Minuten fest darunter, immer sichtbar */}
      <div style={{ fontSize: FS.xs, fontWeight: FW.bold, color: t.muted,
        textTransform: "uppercase", letterSpacing: "0.05em", marginTop: 14, marginBottom: 6 }}>Minuten</div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 6 }}>
        {minuten.map(mm => zellBtn("m" + mm, String(mm).padStart(2, "0"),
          () => waehleMinute(mm), stunde != null && minute === mm))}
      </div>
    </div>
  );
}

function ZeitPickerModal({ startWert, onConfirm, onClose, t, accent }) {
  const [wert, setWert] = useState(startWert || "");
  return (
    <div onClick={onClose}
      style={{ position: "fixed", top: 0, right: 0, bottom: 0, left: 0, background: "rgba(0,0,0,0.6)",
        zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div onClick={e => e.stopPropagation()}
        style={{ background: t.card, border: `1px solid ${t.border}`,
          borderRadius: RAD.xl, padding: 14, width: "100%", maxWidth: 340,
          display: "flex", flexDirection: "column", maxHeight: "80dvh",
          boxShadow: "0 20px 60px rgba(0,0,0,0.5)" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between",
          marginBottom: 8 }}>
          <span style={{ fontSize: FS.l, fontWeight: FW.heavy, color: accent }}>
            {wert || "Uhrzeit"}
          </span>
          <button onClick={onClose} title="Schließen" aria-label="Schließen"
            style={{ width: 28, height: 28, borderRadius: RAD.sm, cursor: "pointer",
              border: `1px solid ${t.border}`, background: "transparent", flexShrink: 0,
              display: "flex", alignItems: "center", justifyContent: "center" }}>
            <I name="x" size={12} color={t.sub}/>
          </button>
        </div>
        <ZeitWahl startWert={startWert} t={t} accent={accent}
          onWaehle={(w) => setWert(w)}/>
        <button onClick={() => { if (wert) onConfirm(wert); }} disabled={!wert}
          style={{ marginTop: 12, padding: "10px 14px", borderRadius: RAD.sm,
            cursor: wert ? "pointer" : "not-allowed", fontFamily: "inherit",
            fontSize: FS.m, fontWeight: FW.bold, border: "none",
            background: wert ? accent : t.border,
            color: wert ? getContrastColor(accent) : t.muted }}>
          Übernehmen
        </button>
      </div>
    </div>
  );
}

// ── ZeitFeld: Tastatureingabe (HH:MM) + Picker-Trigger (Uhr-Icon) ───────────
function ZeitFeld({ value, onChange, t, accent = ACCENT, label, required = false, autoOpen = false }) {
  const [offen, setOffen] = useState(false);
  useEffect(() => { if (autoOpen) setOffen(true); /* eslint-disable-next-line */ }, []);
  const anzeige = istZeitGueltig(value) ? value : (value || "");
  const [tippWert, setTippWert] = useState(anzeige);
  const [aktiv, setAktiv] = useState(false);
  useEffect(() => {
    if (!aktiv) setTippWert(istZeitGueltig(value) ? value : (value || ""));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  const uebernehmen = (text) => {
    const txt = String(text || "").trim();
    if (!txt) { if (onChange) onChange(""); return; }
    if (istZeitGueltig(txt)) {
      const m = txt.match(/^(\d{1,2}):(\d{2})$/);
      const wert = String(parseInt(m[1], 10)).padStart(2, "0") + ":" + m[2];
      if (onChange) onChange(wert);
    } else {
      setTippWert(istZeitGueltig(value) ? value : "");
    }
  };

  const hatWert = istZeitGueltig(value);
  const ungueltig = !!value && !istZeitGueltig(value);
  const randFarbe = ungueltig ? "#EF4444"
    : (aktiv ? accent : (hatWert ? accent + "50" : t.border));

  return (
    <div style={{ marginBottom: label ? 10 : 0, minWidth: 0 }}>
      {label && (
        <label style={{ fontSize: FS.s, fontWeight: FW.medium, color: t.sub, display: "block", marginBottom: 4 }}>
          {label}{required && <span style={{ color: "#EF4444", marginLeft: 3 }}>*</span>}
        </label>
      )}
      <div style={{ display: "flex", alignItems: "stretch", minWidth: 0,
        background: t.surface, border: `1px solid ${randFarbe}`,
        borderRadius: RAD.ms, overflow: "hidden", transition: "border-color 0.15s" }}>
        <input type="text" inputMode="numeric" placeholder="hh:mm"
          value={tippWert}
          onFocus={() => setAktiv(true)}
          onChange={e => setTippWert(maskeZeit(e.target.value))}
          onBlur={() => { setAktiv(false); uebernehmen(tippWert); }}
          onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); uebernehmen(tippWert); if (e.target && e.target.blur) e.target.blur(); } }}
          style={{ flex: 1, minWidth: 0, boxSizing: "border-box",
            background: "transparent", border: "none", outline: "none",
            padding: "7px 10px", fontSize: FS.input, fontFamily: "inherit",
            color: hatWert || tippWert ? t.text : t.muted }}/>
        <button onClick={() => setOffen(true)} type="button" title="Uhrzeit auswählen"
          style={{ flexShrink: 0, display: "flex", alignItems: "center", gap: 3,
            padding: "0 11px", cursor: "pointer", border: "none",
            borderLeft: `1px solid ${t.border}`, background: accent + "14", color: accent }}>
          <I name="clock" size={16} color={accent}/>
          <I name="chevD" size={11} color={accent}/>
        </button>
      </div>
      {ungueltig && (
        <div style={{ fontSize: FS.xs, color: "#EF4444", marginTop: 3 }}>
          Keine gültige Uhrzeit (hh:mm)
        </div>
      )}
      {offen && (
        <ZeitPickerModal startWert={value || ""}
          onConfirm={(w) => { if (onChange) onChange(w); setOffen(false); }}
          onClose={() => setOffen(false)}
          t={t} accent={accent}/>
      )}
    </div>
  );
}


// ── CopyBtn ─────────────────────────────────────────────────────────────────
function CopyBtn({ text, label = "Kopieren", t, accent = ACCENT }) {
  const [ok, setOk] = useState(false);
  return (
    <button onClick={() => {
        try { navigator.clipboard.writeText(text); } catch (e) {}
        setOk(true); setTimeout(() => setOk(false), 1500);
      }}
      style={{ display: "flex", alignItems: "center", gap: 5,
        background: ok ? "#10B98120" : "none",
        border: `1px solid ${ok ? "#10B981" : (t ? t.border : "#252540")}`,
        borderRadius: RAD.ms, padding: "3px 8px", cursor: "pointer", fontSize: FS.xs, fontWeight: FW.medium,
        color: ok ? "#10B981" : (t ? t.muted : "#3D3D5C") }}>
      <I name={ok ? "check" : "copy"} size={11} color={ok ? "#10B981" : (t ? t.muted : "#3D3D5C")}/>
      {ok ? "Kopiert" : label}
    </button>
  );
}

// ── Avatar (mit optionalen Eck-Badges für Rollen-Slots) ─────────────────────
// zuweisungen: Liste von { rolle, status, vorsitz, einheitId? }
// Pro Slot wird die wichtigste Zuweisung gewählt (Priorität: aktiv > werdend > ehemalig)
// und in der passenden Ecke positioniert. Slots gemäß allesda_rollen.jsx:
//   tl ↖ SEV-Bevollmächtigter
//   tr ↗ Gremium (VB / VBV / RP)
//   bl ↙ Person Firma (GF, MA, SB, AP)
//   br ↘ Person VE (E, M, N, W)
// Die Badges hängen mit -6px außerhalb des Avatars (Spec).
// ── Tip (Custom Hover-Tooltip) ──────────────────────────────────────────────
// Globaler Tooltip-Container am App-Wurzel (TipProvider), Tip-Wrapper schreiben
// per Context rein. So entkommt das Tooltip-Div allen overflow:hidden und
// transform-Parents der inneren Karten — es wird auf App-Ebene gerendert.
// Touch-Support: Antippen zeigt das Tooltip ~2s lang an (für Mobile).
const TipContext = createContext({ show: () => {}, hide: () => {} });

function TipProvider({ children }) {
  const [state, setState] = useState(null); // { text, x, y }
  const show = (text, x, y) => setState({ text, x, y });
  const hide = () => setState(null);
  return (
    <TipContext.Provider value={{ show, hide }}>
      {children}
      {state && (
        <div style={{
          position: "fixed",
          left: state.x, top: state.y - 6,
          transform: "translate(-50%, -100%)",
          background: "#1F2937", color: "#FFFFFF",
          padding: "5px 9px", borderRadius: RAD.sm,
          fontSize: FS.s, fontWeight: FW.medium,
          whiteSpace: "nowrap", pointerEvents: "none",
          zIndex: 99999,
          boxShadow: "0 2px 8px rgba(0,0,0,0.4)",
        }}>{state.text}</div>
      )}
    </TipContext.Provider>
  );
}

function Tip({ text, children }) {
  const ctx = useContext(TipContext);
  const ref = useRef(null);
  const timeoutRef = useRef(null);
  if (!text) return children;
  const show = () => {
    if (!ref.current) return;
    const r = ref.current.getBoundingClientRect();
    ctx.show(text, r.left + r.width / 2, r.top);
  };
  const showAndAutoHide = () => {
    show();
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(ctx.hide, 2000);
  };
  return (
    <span ref={ref} style={{ display: "inline-flex", lineHeight: 0, verticalAlign: "top" }}
      onPointerEnter={(e) => { if (e.pointerType === "mouse") show(); }}
      onPointerLeave={(e) => { if (e.pointerType === "mouse") ctx.hide(); }}
      onTouchStart={showAndAutoHide}>
      {children}
    </span>
  );
}

function Avatar({ name, firma = false, size = 32, accent = KONTAKTE_FARBE, zuweisungen = null, foto = null, verwendungsZuweisungen = null, text = null }) {
  const parts = ((name || "") + "").trim().split(" ").filter(Boolean);
  // `text` überschreibt die Initialen-Berechnung — z. B. für Einheiten, die ihre
  // Nummer ("07") statt Namens-Initialen anzeigen.
  const initials = (text != null && text !== "")
    ? text
    : (firma
        ? ((name || "?")[0] || "?").toUpperCase()
        : parts.map(w => w[0]).slice(0, 2).join("").toUpperCase() || "?");
  // Farbe = der übergebene accent. Früher wurde für firma=true hart die
  // Kontakt-Firmenfarbe erzwungen; das überschrieb aber den accent, den die
  // VEKachel fürs Objekt-Icon mitgibt (objektAccent/cyan) → Icons waren immer
  // violett. Echte Firmen-Kontakte übergeben ihre Firmenfarbe ohnehin als
  // accent, daher ist `accent` hier für alle Aufrufer korrekt.
  const color = accent;
  const rollen = useRollen();
  const firmenRollen = useFirmenRollen();
  const verwendungen = useVerwendungen();
  const { person: iconsPerson, firma: iconsFirma } = useAvatarIcons();
  const iconsZeigen = firma ? iconsFirma : iconsPerson;
  const hatFoto = !firma && foto && typeof foto === "string" && foto.length > 0;

  // Pro Eck-Position (OL/OR/UL/UR): aktiv > werdend > ehemalig wählen.
  // Personen ziehen aus `rollen` (settings.rollen) — Position via slot oder
  // explizitem eckPosition. Firmen ziehen aus `firmenRollen` — Zuweisungen
  // sind hier objektgebundene Dienstleister-Rollen (Hausverwaltung etc.).
  // Wenn `verwendungsZuweisungen` übergeben werden (Objekt-Icon-Modus), werden
  // stattdessen Verwendungs-Eck-Badges (Vermietet, Eigennutzung, …) gerendert.
  const PRIO = { aktiv: 3, werdend: 2, ehemalig: 1 };
  const eckBadges = { OL: null, OR: null, UL: null, UR: null };
  const istVerwendungsModus = !!verwendungsZuweisungen;
  if (istVerwendungsModus) {
    (verwendungsZuweisungen || []).forEach(z => {
      const def = verwendungen.find(v => v.name === z.verwendung);
      if (!def) return;
      if (!verwendungEckSichtbar(def)) return;
      const pos = verwendungEckPosition(def);
      const status = z.status || "aktiv";
      const cur = eckBadges[pos];
      if (!cur || PRIO[status] > PRIO[cur.status]) {
        eckBadges[pos] = { verwendung: z.verwendung, status, vorsitz: false };
      }
    });
  } else {
    // Rollen-Defs typgerecht zuerst, dann die andere Liste als Fallback —
    // damit z. B. die SEV-Rolle (steht in Personen-rollen) auch an einer Firma
    // ihr Eck-Badge bekommt (Zusammenführung SEV-Firma ↔ SEV-Badge).
    const primaer = firma ? firmenRollen : rollen;
    const sekundaer = firma ? rollen : firmenRollen;
    if (iconsZeigen && zuweisungen && Array.isArray(zuweisungen)) {
      // Schritt 1: pro ROLLENNAME nur das statushöchste Exemplar fürs Badge
      // wählen. Eine Person kann GF mehrerer Firmen sein (mehrere gleiche
      // Rollen-Einträge) — fürs Avatar-Badge zählt die Rolle aber nur EINMAL.
      // Die volle Liste (beide Firmen) bleibt für Detailkarte/DSGVO erhalten,
      // da diese aus flacheZuweisungen() lesen, nicht hier.
      const proRolle = {};
      zuweisungen.forEach(z => {
        if (!z || !z.rolle) return;
        const status = z.status || "aktiv";
        const cur = proRolle[z.rolle];
        if (!cur || PRIO[status] > PRIO[cur.status]) {
          proRolle[z.rolle] = { rolle: z.rolle, status, vorsitz: !!z.vorsitz, vertrag: !!z.vertrag, selbstnutzend: !!z.selbstnutzend };
        }
      });
      // Schritt 2: jede (deduplizierte) Rolle deterministisch in IHRE Ecke
      // legen. Position wird genau einmal pro Rollenname bestimmt → dieselbe
      // Rolle kann nie zwei Ecken belegen (OR/UL-Konflikt ausgeschlossen).
      // Konkurrieren verschiedene Rollen um dieselbe Ecke, gewinnt die mit
      // höherem Status (sonst die zuerst gesehene).
      Object.keys(proRolle).forEach(name => {
        const r = proRolle[name];
        const def = (primaer || []).find(d => d.name === name)
          || (sekundaer || []).find(d => d.name === name);
        if (!def) return;
        if (!rolleEckSichtbar(def)) return;
        const pos = rolleEckPosition(def);
        const cur = eckBadges[pos];
        if (!cur || PRIO[r.status] > PRIO[cur.status]) {
          eckBadges[pos] = { rolle: r.rolle, status: r.status, vorsitz: r.vorsitz, vertrag: r.vertrag, selbstnutzend: r.selbstnutzend };
        }
      });
    }
  }

  // Badge-Größe: ~37% der Avatar-Größe, aber min 14, max 22
  const badgeSize = Math.min(22, Math.max(14, Math.round(size * 0.37)));
  // Badge-Position: das Badge sitzt halb-halb auf dem sichtbaren Avatar-Rand.
  // Badge-Position: vom Avatar-MITTELPUNKT aus entlang der 45°-Diagonale nach
  // außen. So sitzt jedes Badge auf der gedachten Linie durch die Ecke — bei
  // Kreis wie Quadrat optisch korrekt „angedockt". `radius` = Abstand Zentrum →
  // Badge-Mittelpunkt, relativ zur Avatar-Größe.
  //   · Person (rund):   0.636 — entspricht exakt dem bisherigen 5/95-Look.
  //   · Firma/Objekt (Quadrat): 0.58 — minimal weiter innen, da die echte
  //     Quadrat-Ecke weiter draußen liegt; sonst schwebt das Badge in der
  //     leeren Rundecke. Sitzt so halb überlappend auf der Kante.
  const c = size / 2;
  // Form: quadratisch (abgerundet) bei Firma/Objekt ODER wenn `text` gesetzt ist
  // (Einheiten), sonst rund (Personen). Bestimmt Radius-Faktor UND borderRadius.
  const eckig = firma || (text != null && text !== "");
  const radius = (eckig ? size * 0.58 : size * 0.636);
  const d = radius / Math.SQRT2;  // diagonale X/Y-Komponente
  const posNah  = c - d;
  const posFern = c + d;

  // Wrapper-Container: feste size×size Box als Flex, damit die innere Icon-Box
  // exakt deckungsgleich sitzt. inline-block erzeugt sonst einen Baseline-/
  // Descender-Gap unter der Box → der Wrapper wird minimal höher, und die
  // unteren Eck-Badges (top:posFern) rutschen gegenüber der sichtbaren Box nach
  // unten (obere vs. untere Badges asymmetrisch). Flex + lineHeight:0 schließt
  // den Gap; die absolut positionierten Badges sitzen dann exakt diagonal.
  return (
    <div style={{
      position: "relative", display: "inline-flex", flexShrink: 0,
      width: size, height: size, verticalAlign: "middle",
      lineHeight: 0,
    }}>
      <div style={{
        width: size, height: size,
        borderRadius: eckig ? Math.round(size * 0.22) : "50%",
        background: hatFoto ? "transparent" : `${color}22`,
        border: `1.5px solid ${color}40`,
        display: "flex", alignItems: "center", justifyContent: "center",
        boxSizing: "border-box", overflow: "hidden",
      }}>
        {hatFoto ? (
          <img src={foto} alt="" draggable={false} style={{
            width: "100%", height: "100%", objectFit: "cover",
            display: "block", pointerEvents: "none" }}/>
        ) : (text != null && text !== "") ? (
          <span style={{ fontSize: size * 0.34, fontWeight: FW.heavy, color, lineHeight: 1 }}>{initials}</span>
        ) : firma ? (
          <I name="building" size={Math.round(size * 0.5)} color={color}/>
        ) : (
          <span style={{ fontSize: size * 0.36, fontWeight: FW.bold, color, lineHeight: 1 }}>{initials}</span>
        )}
      </div>
      {eckBadges.OL && (
        <div style={{ position: "absolute",
          left: posNah, top: posNah,
          width: badgeSize, height: badgeSize,
          transform: "translate(-50%, -50%)" }}>
          {istVerwendungsModus
            ? <VerwendungBadge verwendung={eckBadges.OL.verwendung} size={badgeSize} status={eckBadges.OL.status}/>
            : <RolleBadge rolle={eckBadges.OL.rolle} size={badgeSize}
                status={eckBadges.OL.status} vorsitz={eckBadges.OL.vorsitz} vertrag={eckBadges.OL.vertrag} selbstnutzend={eckBadges.OL.selbstnutzend}/>}
        </div>
      )}
      {eckBadges.OR && (
        <div style={{ position: "absolute",
          left: posFern, top: posNah,
          width: badgeSize, height: badgeSize,
          transform: "translate(-50%, -50%)" }}>
          {istVerwendungsModus
            ? <VerwendungBadge verwendung={eckBadges.OR.verwendung} size={badgeSize} status={eckBadges.OR.status}/>
            : <RolleBadge rolle={eckBadges.OR.rolle} size={badgeSize}
                status={eckBadges.OR.status} vorsitz={eckBadges.OR.vorsitz} vertrag={eckBadges.OR.vertrag} selbstnutzend={eckBadges.OR.selbstnutzend}/>}
        </div>
      )}
      {eckBadges.UL && (
        <div style={{ position: "absolute",
          left: posNah, top: posFern,
          width: badgeSize, height: badgeSize,
          transform: "translate(-50%, -50%)" }}>
          {istVerwendungsModus
            ? <VerwendungBadge verwendung={eckBadges.UL.verwendung} size={badgeSize} status={eckBadges.UL.status}/>
            : <RolleBadge rolle={eckBadges.UL.rolle} size={badgeSize}
                status={eckBadges.UL.status} vorsitz={eckBadges.UL.vorsitz} vertrag={eckBadges.UL.vertrag} selbstnutzend={eckBadges.UL.selbstnutzend}/>}
        </div>
      )}
      {eckBadges.UR && (
        <div style={{ position: "absolute",
          left: posFern, top: posFern,
          width: badgeSize, height: badgeSize,
          transform: "translate(-50%, -50%)" }}>
          {istVerwendungsModus
            ? <VerwendungBadge verwendung={eckBadges.UR.verwendung} size={badgeSize} status={eckBadges.UR.status}/>
            : <RolleBadge rolle={eckBadges.UR.rolle} size={badgeSize}
                status={eckBadges.UR.status} vorsitz={eckBadges.UR.vorsitz} vertrag={eckBadges.UR.vertrag} selbstnutzend={eckBadges.UR.selbstnutzend}/>}
        </div>
      )}
    </div>
  );
}

// ── RolleBadge ──────────────────────────────────────────────────────────────
// Spec aus allesda_rollen.jsx:
//   aktiv:    Vollton-Hintergrund + weiße Schrift
//   werdend:  transparenter Hintergrund + gestrichelter Rand + Schrift in Farbe + ›-Indikator
//   ehemalig: grauer Hintergrund (#E5E7EB) + Schrift bleibt FARBIG + Diagonal-Strich -45°
// vorsitz:    Farbiger Kreis oben-rechts außerhalb mit weißem ★ (z. B. VB+vorsitz = VBV)
function RolleBadge({ rolle, size = 20, status = "aktiv", vorsitz = false, vertrag = false, selbstnutzend = false }) {
  // Erst Personen-Rollen, dann Firmen-Rollen durchsuchen
  const personenRollen = useRollen();
  const firmenRollen = useFirmenRollen();
  const leistungen = useLeistungen();
  const kategorien = useKategorien();
  const def = personenRollen.find(r => r.name === rolle)
    || leistungen.find(r => r.name === rolle)
    || firmenRollen.find(r => r.name === rolle)
    || null;
  if (!def) return null;
  // Effektive Werte: aus Kategorie geerbt (falls def.kategorie), sonst Eigenwert.
  const farbe = effColor(def, kategorien);
  const kuerzel = effKuerzel(def, kategorien);

  const ehemalig = status === "ehemalig";
  const werdend  = status === "werdend";
  const systemDeaktiviert = def.aktiv === false;

  // Status-Darstellung
  // (werdend wird unten als SVG gerendert, damit der Stricheabstand konfigurierbar ist;
  //  der CSS-Border bekommt für werdend nur einen transparenten Platzhalter)
  let bg, border, textColor;
  if (ehemalig) {
    bg = "transparent"; border = `1px solid ${farbe}`; textColor = farbe;
  } else if (werdend) {
    bg = "transparent"; border = `1px solid transparent`; textColor = farbe;
  } else {
    // Aktive Badges: Hintergrund in Rollen-Farbe, Text-Kontrast automatisch
    // berechnet (Schwarz auf hellen, Weiß auf dunklen Farben) für gute
    // Lesbarkeit auch bei Gelb, Hellgrün, Magenta etc.
    bg = farbe; border = `1.5px solid ${farbe}`; textColor = getContrastColor(farbe);
  }

  // Schriftgröße: kleineres Kürzel = größere Schrift
  const fs = size < 20
    ? (kuerzel.length > 1 ? Math.round(size * 0.42) : Math.round(size * 0.55))
    : (kuerzel.length > 2 ? Math.round(size * 0.32)
      : kuerzel.length > 1 ? Math.round(size * 0.42) : Math.round(size * 0.50));

  // Tooltip
  const tip = def.name
    + (status !== "aktiv" ? ` (${status})` : "")
    + (vorsitz ? " · Vorsitz" : "")
    + (vertrag ? " · mit Vertrag" : "")
    + (selbstnutzend ? " · Selbstnutzer" : "")
    + (systemDeaktiviert ? " [Rolle deaktiviert]" : "");

  // Goldener Ring bei Vorsitz ODER Vertrag ODER Selbstnutzung: 1px solide Linie
  // + weicher Glow. Vorsitz (Personen, Verwaltungsbeirat), Vertrag (Firmen-
  // Zuständigkeit) und Selbstnutzung (Eigentümer wohnt selbst) markieren je eine
  // "besondere Stellung" und kollidieren nie am selben Badge — Eigentümer ist nie
  // zugleich Vorsitz/Vertrag an DEMSELBEN Badge. Im "Weniger Farbe"-Modus graut
  // der Gold-Ring graduell mit (toGrau nutzt die globale Farb-Intensität).
  const goldRing = (vorsitz || vertrag || selbstnutzend) && !ehemalig;
  const VORSITZ_GOLD = toGrau("#EAB308"); // Tailwind yellow-500, intensitätsabhängig
  const vorsitzShadow = goldRing
    ? `0 0 0 2px ${VORSITZ_GOLD}, 0 0 ${size < 20 ? 6 : 8}px ${size < 20 ? 2 : 3}px ${VORSITZ_GOLD}99`
    : "none";

  return (
    <Tip text={tip}>
      <div style={{
        position: "relative", display: "block", flexShrink: 0,
        width: size, height: size, boxSizing: "content-box",
        opacity: systemDeaktiviert ? 0.5 : 1,
      }}>
      <div style={{
        width: size, height: size, borderRadius: RAD.full,
        background: bg, border: border, boxSizing: "border-box",
        display: "flex", alignItems: "center", justifyContent: "center",
        position: "relative", overflow: "hidden",
        boxShadow: vorsitzShadow,
      }}>
        {/* Werdend: gestrichelter SVG-Kreisring mit großzügigen Lücken */}
        {werdend && (
          <svg style={{ position: "absolute", top: 0, right: 0, bottom: 0, left: 0, width: "100%", height: "100%",
              pointerEvents: "none" }} viewBox={`0 0 ${size} ${size}`}>
            <circle cx={size / 2} cy={size / 2} r={size / 2 - 0.75}
              fill="none" stroke={farbe} strokeWidth="1.5"
              strokeDasharray={size < 20 ? "2 4" : "2.5 5"} strokeLinecap="round"/>
          </svg>
        )}
        <span style={{ fontSize: fs, fontWeight: FW.heavy, letterSpacing: "-0.3px",
          lineHeight: 1, userSelect: "none", color: textColor, position: "relative" }}>{kuerzel}</span>
        {/* Diagonal-Strich für ehemalig: -45° durch die Mitte */}
        {ehemalig && (
          <div style={{
            position: "absolute", top: "50%", left: "50%",
            width: "140%", height: size < 20 ? 1.5 : 2,
            background: farbe, opacity: 0.8,
            transform: "translate(-50%, -50%) rotate(-45deg)",
            borderRadius: 1, pointerEvents: "none",
          }}/>
        )}
      </div>
      </div>
    </Tip>
  );
}


// ── VerwendungBadge / VerwendungenBadges ────────────────────────────────────
// Spec analog RolleBadge: aktiv = Vollton, werdend = transparenter Rand mit ›,
// ehemalig = grauer Grund + Diagonal-Strich.

function VerwendungBadge({ verwendung, size = 20, status = "aktiv" }) {
  const verwendungen = useVerwendungen();
  const kategorien = useKategorien();
  const def = verwendungen.find(v => v.name === verwendung);
  if (!def) return null;
  const farbe = effColor(def, kategorien);
  const kuerzel = effKuerzel(def, kategorien);
  const ehemalig = status === "ehemalig";
  const werdend  = status === "werdend";
  const systemDeaktiviert = def.aktiv === false;
  let bg, border, textColor;
  if (ehemalig) {
    bg = "#E5E7EB"; border = "transparent"; textColor = farbe;
  } else if (werdend) {
    bg = "transparent"; border = "transparent"; textColor = farbe;
  } else {
    bg = farbe; border = farbe; textColor = "#FFFFFF";
  }
  const fontSize = Math.max(7, Math.floor(size * 0.42));
  return (
    <div style={{ position: "relative", display: "inline-block",
      width: size, height: size, flexShrink: 0,
      opacity: systemDeaktiviert ? 0.4 : 1 }}>
      <div style={{ width: size, height: size, borderRadius: RAD.full,
        background: bg, border: `2px solid ${border}`,
        display: "flex", alignItems: "center", justifyContent: "center",
        boxSizing: "border-box", overflow: "hidden", position: "relative" }}>
        <span style={{ fontSize, fontWeight: FW.heavy, color: textColor, lineHeight: 1,
          textAlign: "center", whiteSpace: "nowrap", letterSpacing: "-0.02em" }}>
          {kuerzel}
        </span>
        {ehemalig && (
          <svg style={{ position: "absolute", top: 0, right: 0, bottom: 0, left: 0, width: size, height: size,
            pointerEvents: "none" }} viewBox={`0 0 ${size} ${size}`}>
            <line x1={size * 0.18} y1={size * 0.82} x2={size * 0.82} y2={size * 0.18}
              stroke={farbe} strokeWidth={Math.max(1.4, size * 0.06)} strokeLinecap="round"/>
          </svg>
        )}
      </div>
      {werdend && (
        <svg style={{ position: "absolute", top: 0, right: 0, bottom: 0, left: 0, width: size, height: size,
          pointerEvents: "none" }} viewBox={`0 0 ${size} ${size}`}>
          <circle cx={size / 2} cy={size / 2} r={size / 2 - 1.5}
            fill="none" stroke={farbe} strokeWidth={1.5}
            strokeDasharray="2.5 2"/>
        </svg>
      )}
    </div>
  );
}

// Aggregiert die Verwendungen aller Einheiten eines Objekts in eine Liste von
// {verwendung, status, vorsitz}-Objekten — analog zur Personen-zuweisungen.
// Pro Verwendung wird der "wichtigste" Status gewählt (aktiv > werdend > ehemalig).
function aggregiereObjektVerwendungen(ve) {
  if (!ve || !Array.isArray(ve.einheiten)) return [];
  const PRIO = { aktiv: 3, werdend: 2, ehemalig: 1 };
  const map = {}; // name → bester Status
  ve.einheiten.forEach(e => {
    verwendungenVon(e).forEach(v => {
      if (!v || !v.name) return;
      const status = v.status || "aktiv";
      const cur = map[v.name];
      if (!cur || PRIO[status] > PRIO[cur.status]) {
        map[v.name] = { verwendung: v.name, rolle: v.name, status };
      }
    });
  });
  return Object.values(map);
}

function VerwendungenBadges({ ve, size = 20 }) {
  const verwendungen = useVerwendungen();
  const aggregiert = aggregiereObjektVerwendungen(ve);
  // Nur Verwendungen mit aktivem Karten-Badge-Toggle einblenden.
  const sichtbar = aggregiert.filter(z => {
    const def = verwendungen.find(v => v.name === z.verwendung);
    return def && verwendungBadgeSichtbar(def);
  });
  if (sichtbar.length === 0) return null;
  return (
    <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
      {sichtbar.slice(0, 4).map((z, i) => (
        <VerwendungBadge key={i} verwendung={z.verwendung} size={size} status={z.status}/>
      ))}
      {sichtbar.length > 4 && <span style={{ fontSize: FS.xxs, color: "#64748B" }}>+{sichtbar.length - 4}</span>}
    </div>
  );
}

// ── KontaktPicker (aus bausteine.jsx, ?. entfernt) ──────────────────────────
function KontaktPicker({ value, onChange, label, t, accent = ACCENT, editMode = true, nurFirmen = false, kontakte = [], setKontakte, onCreate }) {
  const [offen, setOffen] = useState(false);
  const [suche, setSuche] = useState("");
  // Inline-Schnellanlage: kompaktes Mini-Formular im Picker, damit User nicht
  // erst zur Kontakte-Seite springen müssen, um z. B. einen Eigentümer
  // anzulegen, der noch nicht im System ist.
  const [neuOffen, setNeuOffen] = useState(false);
  const [neuTyp, setNeuTyp] = useState(nurFirmen ? "firma" : "person");
  const [neuName, setNeuName] = useState("");
  const [neuTel, setNeuTel] = useState("");
  const [neuEmail, setNeuEmail] = useState("");
  const rollen = useRollen();
  const farben = useKontaktFarbe();
  const anzeige = useKontaktAnzeige();

  // Sortier-Reihenfolge folgt dem Name-Format-Setting
  const sortierSettings = { kontakteNameFormat: anzeige.nameFormat };
  const liste = sortKontakte(kontakte.filter(k => nurFirmen ? k.typ === "firma" : true), sortierSettings);
  const gefunden = liste.find(k => k.id === value);

  const treffer = suche.trim().length > 0
    ? liste.filter(k =>
        k.name.toLowerCase().includes(suche.toLowerCase()) ||
        ((k.sub || "")).toLowerCase().includes(suche.toLowerCase()))
    : liste;

  const personen = treffer.filter(k => k.typ === "person");
  const firmen   = treffer.filter(k => k.typ === "firma");

  const waehle = (k) => { onChange(k.id); setOffen(false); setSuche(""); };
  const loesche = (e) => { e.stopPropagation(); onChange(null); };

  // Schnellanlage darf nur bei gültigen Eingaben (Name vorhanden, Tel/E-Mail
  // sinnvoll bzw. leer). Nutzt dieselben Prüfungen wie die Kontaktkarte.
  const darfAnlegen = neuName.trim() && istTelefonGueltig(neuTel) && istEmailGueltig(neuEmail);

  // Dubletten-Vorwarnung: gegen Bestand prüfen, sobald ein Name/E-Mail/Tel
  // eingegeben ist. Reine Anzeige — Anlegen bleibt möglich, ist aber nicht mehr
  // der reflexhafte Default. Nutzt die zentrale Match-Schicht (datenmodell.js).
  const neuEntwurf = { typ: neuTyp, name: neuName, tel: neuTel, email: neuEmail };
  const dublKandidaten = (neuOffen && neuName.trim().length >= 2)
    ? findeKontaktKandidaten(neuEntwurf, kontakte, { nurTyp: neuTyp }).slice(0, 4)
    : [];

  // Neuen Kontakt direkt im Picker anlegen, in die kontakte-Liste schreiben
  // und sofort als ausgewählten Wert zurückgeben.
  const neuAnlegen = () => {
    const name = neuName.trim();
    if (!name || !setKontakte || !darfAnlegen) return;

    // Name parsen — bei Personen in Vorname/Nachname aufteilen.
    //   "Nachname, Vorname"  → comma-split
    //   "Vorname Nachname"   → letztes Wort = Nachname, Rest = Vorname
    //   "Nur ein Wort"       → komplett als Nachname
    let vorname = "", nachname = "";
    if (neuTyp === "person") {
      if (name.indexOf(",") >= 0) {
        const parts = name.split(",").map(s => s.trim()).filter(Boolean);
        nachname = parts[0] || "";
        vorname  = parts[1] || "";
      } else {
        const parts = name.split(/\s+/).filter(Boolean);
        if (parts.length === 1) {
          nachname = parts[0];
        } else if (parts.length > 1) {
          nachname = parts[parts.length - 1];
          vorname  = parts.slice(0, -1).join(" ");
        }
      }
    }
    const computedName = neuTyp === "person"
      ? `${vorname} ${nachname}`.trim() || name
      : name;

    const telTrim = (neuTel || "").trim();
    const emailTrim = (neuEmail || "").trim();
    const neuerKontakt = neuTyp === "person"
      ? {
          id: Date.now(),
          typ: "person",
          name: computedName,
          vorname, nachname, anrede: "", titel: "",
          tels: telTrim ? [{ nr: telTrim, typ: "mobil" }] : [],
          emails: emailTrim ? [{ email: emailTrim, typ: "privat" }] : [],
          strasse: "", plz: "", ort: "",
          rollen: [], objektZuweisungen: [], badges: [],
          notizen: "", customFelder: [],
        }
      : {
          id: Date.now(),
          typ: "firma",
          name,
          rechtsform: "",
          tel: telTrim, email: emailTrim,
          strasse: "", plz: "", ort: "",
          ansprechpartner: [], gewerke: [],
          objektZuweisungen: [],
          notizen: "", customFelder: [],
        };

    setKontakte(arr => [...arr, neuerKontakt]);
    onChange(neuerKontakt.id);
    if (onCreate) onCreate(neuerKontakt);
    setNeuOffen(false); setNeuName(""); setNeuTel(""); setNeuEmail(""); setOffen(false); setSuche("");
  };

  return (
    <div style={{ marginBottom: 10 }}>
      {label && <div style={{ fontSize: FS.xs, fontWeight: FW.bold, color: t.muted,
        textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 5 }}>{label}</div>}

      {/* Anzeige wenn geschlossen */}
      {!offen && (
        <div onClick={() => editMode && setOffen(true)} style={{
          display: "flex", alignItems: "center", gap: 8,
          cursor: editMode ? "pointer" : "default",
          padding: editMode ? "5px 9px" : "2px 0", borderRadius: RAD.ms,
          background: editMode ? (gefunden ? accent + "0D" : t.surface) : "transparent",
          border: editMode ? `1px solid ${gefunden ? accent + "40" : t.border}` : "none",
          minHeight: 32, transition: "all 0.15s",
        }}>
          {gefunden ? (
            <>
              <Avatar name={gefunden.name} firma={gefunden.typ === "firma"} size={22} accent={accent}
                zuweisungen={gefunden.typ === "firma" ? null : zuweisungenFuerAvatar(gefunden)}/>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: FS.m, fontWeight: FW.medium, color: t.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{formatNameMitCtx(gefunden, anzeige) || gefunden.name}</div>
                {gefunden.sub && <div style={{ fontSize: FS.xs, color: t.sub }}>{gefunden.sub}</div>}
              </div>
              {editMode && <button onClick={loesche} style={{ background: "none", border: "none", cursor: "pointer", padding: 2, opacity: 0.5 }}><I name="x" size={11} color={"#EF4444"}/></button>}
            </>
          ) : (
            <span style={{ fontSize: FS.m, color: t.muted }}>{editMode ? "Suchen…" : "—"}</span>
          )}
        </div>
      )}

      {/* Geöffnet: Suche + Liste */}
      {offen && (
        <div>
          <input autoFocus value={suche} onChange={e => setSuche(e.target.value)}
            placeholder="Name eingeben…"
            style={{ width: "100%", boxSizing: "border-box", background: t.surface,
              border: `1px solid ${accent}`, borderRadius: "8px 8px 0 0",
              padding: "7px 10px", fontSize: FS.input, color: t.text, outline: "none", fontFamily: "inherit" }}/>
          <div style={{ background: t.card, border: `1px solid ${accent}40`, borderTop: "none",
            borderRadius: "0 0 10px 10px", maxHeight: 260, overflowY: "auto",
            boxShadow: "0 10px 32px rgba(0,0,0,0.25)" }}>
            {/* Sticky-Header: Abbrechen / Neu */}
            <div style={{ display: "flex", borderBottom: `1px solid ${t.border}`,
              position: "sticky", top: 0, background: t.card, zIndex: 5 }}>
              <button onClick={() => { setOffen(false); setSuche(""); setNeuOffen(false); }} style={{
                flex: 1, padding: "7px 0", background: "none", border: "none", cursor: "pointer",
                fontSize: FS.s, color: t.muted, borderRight: `1px solid ${t.border}`, fontFamily: "inherit" }}>Abbrechen</button>
              <button onClick={() => {
                  // Schnellanlage öffnen — wenn bereits gesucht wurde, den
                  // Suchtext als Vorschlag in den Name übernehmen.
                  if (setKontakte) {
                    setNeuOffen(true);
                    if (suche.trim() && !neuName) setNeuName(suche.trim());
                  }
                }} style={{
                flex: 1, padding: "7px 0", background: "none", border: "none",
                cursor: setKontakte ? "pointer" : "not-allowed",
                fontSize: FS.s, color: setKontakte ? accent : t.muted, fontWeight: FW.bold, fontFamily: "inherit" }}>+ Neu anlegen</button>
            </div>
            {/* Inline-Schnellanlage */}
            {neuOffen && setKontakte && (
              <div style={{ padding: "10px 12px", background: accent + "08",
                borderBottom: `1px solid ${t.border}` }}>
                {!nurFirmen && (
                  <div style={{ display: "flex", gap: 4, marginBottom: 8 }}>
                    <button onClick={() => setNeuTyp("person")} style={{
                      flex: 1, padding: "5px 0", fontSize: FS.xs, fontWeight: FW.bold,
                      background: neuTyp === "person" ? accent : "transparent",
                      color: neuTyp === "person" ? "#fff" : t.sub,
                      border: `1px solid ${neuTyp === "person" ? accent : t.border}`,
                      borderRadius: RAD.sm, cursor: "pointer", fontFamily: "inherit" }}>
                      Person
                    </button>
                    <button onClick={() => setNeuTyp("firma")} style={{
                      flex: 1, padding: "5px 0", fontSize: FS.xs, fontWeight: FW.bold,
                      background: neuTyp === "firma" ? accent : "transparent",
                      color: neuTyp === "firma" ? "#fff" : t.sub,
                      border: `1px solid ${neuTyp === "firma" ? accent : t.border}`,
                      borderRadius: RAD.sm, cursor: "pointer", fontFamily: "inherit" }}>
                      Firma
                    </button>
                  </div>
                )}
                <input autoFocus value={neuName} onChange={e => setNeuName(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter" && neuName.trim()) neuAnlegen(); }}
                  placeholder={neuTyp === "firma" ? "Firmen-Name" : "Vor- und Nachname"}
                  style={{ width: "100%", boxSizing: "border-box", background: t.surface,
                    border: `1px solid ${t.border}`, borderRadius: RAD.sm,
                    padding: "6px 10px", fontSize: FS.input, color: t.text,
                    outline: "none", fontFamily: "inherit", marginBottom: 6 }}/>
                <input value={neuTel} onChange={e => setNeuTel(e.target.value)}
                  type="tel" inputMode="tel" placeholder="Telefon (optional)"
                  style={{ width: "100%", boxSizing: "border-box", background: t.surface,
                    border: `1px solid ${istTelefonGueltig(neuTel) ? t.border : "#EF4444"}`, borderRadius: RAD.sm,
                    padding: "6px 10px", fontSize: 16, color: t.text,
                    outline: "none", fontFamily: "inherit", marginBottom: 6 }}/>
                <input value={neuEmail} onChange={e => setNeuEmail(e.target.value)}
                  type="email" inputMode="email" placeholder="E-Mail (optional)"
                  onKeyDown={e => { if (e.key === "Enter" && neuName.trim() && istTelefonGueltig(neuTel) && istEmailGueltig(neuEmail)) neuAnlegen(); }}
                  style={{ width: "100%", boxSizing: "border-box", background: t.surface,
                    border: `1px solid ${istEmailGueltig(neuEmail) ? t.border : "#EF4444"}`, borderRadius: RAD.sm,
                    padding: "6px 10px", fontSize: 16, color: t.text,
                    outline: "none", fontFamily: "inherit", marginBottom: 6 }}/>
                {(!istTelefonGueltig(neuTel) || !istEmailGueltig(neuEmail)) && (
                  <div style={{ fontSize: FS.xs, color: "#EF4444", marginBottom: 6 }}>
                    {!istTelefonGueltig(neuTel) ? "Telefonnummer prüfen. " : ""}
                    {!istEmailGueltig(neuEmail) ? "E-Mail-Adresse prüfen." : ""}
                  </div>
                )}
                {dublKandidaten.length > 0 && (
                  <div style={{ marginBottom: 8, padding: "8px 10px",
                    background: "#F59E0B14", border: "1px solid #F59E0B55",
                    borderRadius: RAD.sm }}>
                    <div style={{ fontSize: FS.xs, fontWeight: FW.bold, color: "#B45309",
                      marginBottom: 6 }}>
                      {dublKandidaten.some(d => d.sicher)
                        ? "Es gibt bereits passende Kontakte — lieber auswählen statt neu anlegen?"
                        : "Ähnlicher Name vorhanden — schon angelegt?"}
                    </div>
                    {dublKandidaten.map(d => (
                      <button key={d.kontakt.id}
                        onClick={() => { onChange(d.kontakt.id); setNeuOffen(false); setNeuName("");
                          setNeuTel(""); setNeuEmail(""); setOffen(false); setSuche(""); }}
                        style={{ display: "flex", alignItems: "center", gap: 7, width: "100%",
                          textAlign: "left", padding: "5px 7px", marginBottom: 3,
                          background: t.surface, border: `1px solid ${t.border}`,
                          borderRadius: RAD.sm, cursor: "pointer", fontFamily: "inherit" }}>
                        <Avatar name={d.kontakt.name} firma={d.kontakt.typ === "firma"} size={20} accent={accent}/>
                        <span style={{ flex: 1, minWidth: 0, fontSize: FS.s, color: t.text,
                          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {d.kontakt.name}
                        </span>
                        <span style={{ fontSize: FS.xxs, color: t.muted,
                          textTransform: "uppercase", letterSpacing: "0.04em" }}>
                          {d.grund === "email" ? "gl. E-Mail" : d.grund === "telefon" ? "gl. Tel." : "gl. Name"}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
                <div style={{ display: "flex", gap: 6 }}>
                  <button onClick={() => { setNeuOffen(false); setNeuName(""); setNeuTel(""); setNeuEmail(""); }} style={{
                    flex: 1, padding: "5px 0", fontSize: FS.s,
                    background: "transparent", color: t.sub,
                    border: `1px solid ${t.border}`, borderRadius: RAD.sm,
                    cursor: "pointer", fontFamily: "inherit" }}>
                    Abbrechen
                  </button>
                  <button onClick={neuAnlegen} disabled={!darfAnlegen}
                    style={{ flex: 1, padding: "5px 0", fontSize: FS.s, fontWeight: FW.bold,
                      background: darfAnlegen ? accent : t.muted,
                      color: getContrastColor(darfAnlegen ? accent : t.muted), border: "none", borderRadius: RAD.sm,
                      cursor: darfAnlegen ? "pointer" : "not-allowed",
                      fontFamily: "inherit" }}>
                    Anlegen
                  </button>
                </div>
                <div style={{ marginTop: 6, fontSize: FS.xxs, color: t.muted, fontStyle: "italic" }}>
                  Mehr Daten kannst du später in der Kontakt-Karte ergänzen.
                </div>
              </div>
            )}
            {/* Kein Treffer */}
            {treffer.length === 0 && (
              <div style={{ padding: "12px", fontSize: FS.s, color: t.muted, fontStyle: "italic" }}>„{suche}" nicht gefunden</div>
            )}
            {/* Personen */}
            {!nurFirmen && personen.length > 0 && (
              <>
                <div style={{ padding: "5px 12px 3px", fontSize: FS.xxs, fontWeight: FW.bold,
                  color: t.muted, textTransform: "uppercase", letterSpacing: "0.1em",
                  background: t.surface }}>Personen</div>
                {personen.map(k => (
                  <button key={k.id} onClick={() => waehle(k)} style={{
                    width: "100%", display: "flex", alignItems: "center", gap: 10,
                    background: "none", border: "none",
                    borderBottom: `1px solid ${t.border}20`, padding: "8px 12px",
                    cursor: "pointer", textAlign: "left", fontFamily: "inherit" }}
                    onMouseEnter={e => e.currentTarget.style.background = `${accent}0C`}
                    onMouseLeave={e => e.currentTarget.style.background = "none"}>
                    <Avatar name={k.name} size={26} accent={accent}
                      zuweisungen={zuweisungenFuerAvatar(k)}/>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: FS.m, fontWeight: FW.medium, color: t.text }}>{formatNameMitCtx(k, anzeige) || k.name}</div>
                      {k.sub && <div style={{ fontSize: FS.xs, color: t.sub }}>{k.sub}</div>}
                    </div>
                  </button>
                ))}
              </>
            )}
            {/* Firmen */}
            {firmen.length > 0 && (
              <>
                <div style={{ padding: "5px 12px 3px", fontSize: FS.xxs, fontWeight: FW.bold,
                  color: t.muted, textTransform: "uppercase", letterSpacing: "0.1em",
                  background: t.surface }}>Firmen</div>
                {firmen.map(k => (
                  <button key={k.id} onClick={() => waehle(k)} style={{
                    width: "100%", display: "flex", alignItems: "center", gap: 10,
                    background: "none", border: "none",
                    borderBottom: `1px solid ${t.border}20`, padding: "8px 12px",
                    cursor: "pointer", textAlign: "left", fontFamily: "inherit" }}
                    onMouseEnter={e => e.currentTarget.style.background = `${farben.firma}0C`}
                    onMouseLeave={e => e.currentTarget.style.background = "none"}>
                    <Avatar name={k.name} firma size={26} accent={farben.firma}/>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: FS.m, fontWeight: FW.medium, color: t.text }}>{k.name}</div>
                      {k.sub && <div style={{ fontSize: FS.xs, color: t.sub }}>{k.sub}</div>}
                    </div>
                  </button>
                ))}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}


// ── EckPille — kleine Status-Pille rechts oben als Overlay über einer Karte ──
// Wird absolut positioniert; der Eltern-Container muss position:relative sein.
function EckPille({ label, farbe, t }) {
  if (!label) return null;
  return (
    <span style={{ position: "absolute", top: 8, right: 10, zIndex: 2,
      fontSize: FS.xxs, padding: "2px 8px", borderRadius: RAD.ms,
      background: (farbe || t.sub), color: getContrastColor(farbe || t.sub),
      fontWeight: FW.medium, pointerEvents: "none" }}>
      {label}
    </span>
  );
}

// ── EigentumBlock — Info-Block oben im Eigentümer-Tab (analog Mietvertrag) ──
// Zeigt zum aktuellen Eigentümer: seit wann, ob im Grundbuch / Stimmrecht.
function EigentumBlock({ eig, t, accent, einheit = null }) {
  // Aktive Eigentümer = stimmberechtigt im Grundbuch. Werdende Käufer und
  // ehemalige zählen hier nicht (die laufen über Vorgangs-Karte/Historie).
  // Bei mehreren Eigentümern (z. B. Ehepaar) werden alle aufgeführt.
  const aktive = (eig || []).filter(p => eigStatus(p) === "aktiv");
  const liste = aktive.length > 0
    ? aktive
    : [((eig || []).find(p => !p.bis) || (eig || [])[0])].filter(Boolean);
  if (liste.length === 0) return null;
  const zeilen = [];
  // Eigentümer-Zeile(n): bei einem direkt, bei mehreren je eigene Zeile.
  // Bei mehreren Eigentümern wird der Quoten-Anteil (sofern relevant) an den
  // Namen angehängt — „Max Müller · 5/12 (41,7 %)".
  const mehrere = liste.length > 1;
  liste.forEach((p, i) => {
    const ql = mehrere ? quoteLabel(p, eig) : "";
    const name = ql ? (p.name + " · " + ql) : p.name;
    zeilen.push([i === 0 ? "Eigentümer" : "", name]);
  });
  // „Eigentümer seit" nur sinnvoll bei genau einem (bei mehreren oft verschieden).
  if (liste.length === 1 && liste[0].von) {
    zeilen.push(["Eigentümer seit", datumDe(liste[0].von) || liste[0].von]);
  }
  // MEA der EINHEIT (für alle Eigentümer gleich — MEA hängt an der Einheit).
  if (einheit && einheit.mea) zeilen.push(["MEA", String(einheit.mea)]);
  const grundbuchJa = liste.some(p => p.grundbuch);
  zeilen.push(["Grundbuch", grundbuchJa ? "Ja · Stimmrecht ETV" : "Nein"]);

  // Laufender Eigentümerwechsel: bekannte Meilensteine als abgesetzte Zeilen
  // (analog „Auszug/Nachfolge" beim Mietvertrag). Solange nicht abgeschlossen.
  const kaeufer = (eig || []).find(p => { const s = eigStatus(p); return s === "interessent" || s === "werdend"; });
  const wechselZeilen = [];
  if (kaeufer) {
    wechselZeilen.push(["Verkauf an", kaeufer.name]);
    if (kaeufer.kostenAb) {
      const erreicht = zuIsoDatum(kaeufer.kostenAb) <= isoHeute();
      wechselZeilen.push([erreicht ? "Lastenübergang" : "Lastenübergang geplant", datumDe(kaeufer.kostenAb) || kaeufer.kostenAb]);
    }
    if (kaeufer.von) {
      const erreicht = zuIsoDatum(kaeufer.von) <= isoHeute();
      wechselZeilen.push([erreicht ? "Grundbuch umgeschrieben" : "Grundbuch geplant", datumDe(kaeufer.von) || kaeufer.von]);
    }
  }

  return (
    <div style={{ marginBottom: 8, padding: "10px 12px", background: t.bg,
      border: `1px solid ${t.border}`, borderRadius: RAD.md }}>
      <div style={{ fontSize: FS.s, fontWeight: FW.bold, color: t.text, marginBottom: 6 }}>
        Eigentum
      </div>
      {zeilen.map(([label, wert], i) => (
        <div key={i} style={{ display: "flex", gap: 8, fontSize: FS.s, padding: "2px 0" }}>
          <span style={{ width: 130, color: t.sub, flexShrink: 0 }}>{label}</span>
          <span style={{ color: t.text }}>{wert}</span>
        </div>
      ))}
      {wechselZeilen.length > 0 && (
        <div style={{ marginTop: 6, paddingTop: 6, borderTop: `1px solid ${t.border}` }}>
          {wechselZeilen.map(([label, wert], i) => (
            <div key={"w"+i} style={{ display: "flex", gap: 8, fontSize: FS.s, padding: "2px 0" }}>
              <span style={{ width: 130, color: accent, flexShrink: 0 }}>{label}</span>
              <span style={{ color: t.text, fontWeight: i === 0 ? FW.medium : FW.regular }}>{wert}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── EigentumswechselVorgang — 3-Stufen-Stepper für einen laufenden Verkauf ──
// Erscheint im Eigentümer-Tab, sobald ein Käufer mit Status interessent/werdend
// existiert (Spec §22.5). Bildet den realen Ablauf ab:
//   1. Kaufabsicht     — Käufer tritt auf (beim Anlegen gesetzt)
//   2. Lastenübergang  — Kosten/Nutzen/Lasten gehen über (abrechnungsrelevant)
//   3. Grundbuch       — Umschreibung; Käufer wird Eigentümer, Verkäufer raus
// Jede offene Stufe lässt sich mit Datum abhaken; nach Stufe 3 verschwindet die
// Karte (Käufer ist normaler aktiver Eigentümer). belegungEdit steuert die
// Bearbeitbarkeit — im Lese-Modus reiner Fortschrittsanzeiger.
function EigentumswechselVorgang({ kaeufer, verkaeufer, farbe = ACCENT, t,
                                   editierbar = false, onStufe, onAbbrechen }) {
  const [abhaken, setAbhaken] = useState(null); // { stufe, datum } | null
  if (!kaeufer) return null;
  const stufen = eigStufen(kaeufer);
  // Nächste zu terminierende Stufe = erste, die weder erledigt noch bereits
  // terminiert (Datum gesetzt, aber Zukunft) ist.
  const naechsteIdx = stufen.findIndex(s => !s.erledigt && !s.terminiert);
  // Eine Stufe, deren Datum gesetzt aber noch nicht erreicht ist (wartet auf
  // den Stichtag). Für den „wird wirksam am"-Hinweis.
  const terminierteStufe = stufen.find(s => s.terminiert) || null;
  const OK = "#10B981";

  return (
    <div style={{ marginBottom: 10, padding: "12px 14px", background: farbe + "0A",
      border: `1px solid ${farbe}30`, borderRadius: RAD.md }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between",
        marginBottom: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <I name="arrow" size={13} color={farbe}/>
          <span style={{ fontSize: FS.s, fontWeight: FW.bold, color: t.text }}>
            Eigentümerwechsel läuft
          </span>
        </div>
        <span style={{ fontSize: FS.xxs, padding: "2px 8px", borderRadius: RAD.ms,
          background: "#3B82F6", color: "#fff", fontWeight: FW.medium }}>
          {EIG_STATUS[eigStatus(kaeufer)].label}
        </span>
      </div>

      {/* Parteien */}
      <div style={{ fontSize: FS.xs, color: t.sub, marginBottom: 12, lineHeight: 1.5 }}>
        {verkaeufer && <>Verkäufer: <b style={{ color: t.text }}>{verkaeufer.name}</b> · </>}
        Käufer: <b style={{ color: t.text }}>{kaeufer.name}</b>
      </div>

      {/* Stepper — horizontale Punkt-Linie */}
      <div style={{ display: "flex", marginBottom: editierbar ? 12 : 0 }}>
        {stufen.map((s, i) => {
          const istNaechste = i === naechsteIdx;
          const punktFarbe = s.erledigt ? OK : ((istNaechste || s.terminiert) ? farbe : t.border);
          return (
            <div key={s.key} style={{ flex: 1, display: "flex", flexDirection: "column",
              alignItems: "center", position: "relative" }}>
              {/* Verbindungslinie nach links */}
              {i > 0 && (
                <div style={{ position: "absolute", top: 9, right: "50%", left: "-50%", height: 2,
                  background: s.erledigt ? OK : t.border, zIndex: 0 }}/>
              )}
              <div style={{ width: 20, height: 20, borderRadius: RAD.full, zIndex: 1,
                background: s.erledigt ? OK : t.card,
                border: `2px solid ${punktFarbe}`,
                display: "flex", alignItems: "center", justifyContent: "center" }}>
                {s.erledigt && <I name="check" size={11} color="#fff"/>}
              </div>
              <span style={{ fontSize: FS.xxs, marginTop: 5, textAlign: "center",
                color: s.erledigt ? t.text : ((istNaechste || s.terminiert) ? farbe : t.muted),
                fontWeight: (istNaechste || s.terminiert) ? FW.bold : FW.regular }}>
                {s.label}
              </span>
              {s.datum && (
                <span style={{ fontSize: FS.xxs, color: t.muted, marginTop: 1 }}>
                  {datumDe(s.datum)}
                </span>
              )}
            </div>
          );
        })}
      </div>

      {/* „Wird wirksam am"-Hinweis für eine terminierte Stufe (Datum in Zukunft);
          auch im Lese-Modus sichtbar. */}
      {terminierteStufe && !abhaken && (
        <div style={{ fontSize: FS.xs, color: t.sub, marginBottom: editierbar ? 8 : 0,
          marginTop: editierbar ? 0 : 4, lineHeight: 1.4 }}>
          {terminierteStufe.label} wird wirksam am <b style={{ color: farbe }}>{datumDe(terminierteStufe.datum)}</b>.
        </div>
      )}

      {/* Aktionen — nur im Bearbeiten-Modus */}
      {editierbar && (
        <>
          {abhaken ? (
            <div style={{ background: t.card, border: `1px solid ${farbe}40`,
              borderRadius: RAD.md, padding: 10 }}>
              <div style={{ fontSize: FS.xs, color: t.sub, marginBottom: 6 }}>
                {abhaken.stufe === "kosten"
                  ? "Lasten-/Kostenübergang am"
                  : "Grundbuch-Umschreibung am"}
              </div>
              <div style={{ marginBottom: 8 }}>
                <DatumFeld value={abhaken.datum} onChange={d => setAbhaken(a => ({ ...a, datum: d }))}
                  t={t} accent={farbe} iso defaultHeute={false}/>
              </div>
              {abhaken.stufe === "grundbuch" && verkaeufer && (
                <div style={{ fontSize: FS.xxs, color: t.muted, marginBottom: 8, lineHeight: 1.4 }}>
                  {verkaeufer.name} wird zu diesem Datum als Eigentümer beendet und wandert in die Historie.
                </div>
              )}
              <div style={{ display: "flex", gap: 6 }}>
                <AktionsButton variante="breit" rolle="abbrechen" onClick={() => setAbhaken(null)}
                  text="Abbrechen" icon={false} flex={1} t={t} accent={farbe}/>
                <AktionsButton variante="breit" rolle="bestaetigen"
                  onClick={() => { onStufe && onStufe(kaeufer.kontaktId, abhaken.stufe, abhaken.datum || isoHeute()); setAbhaken(null); }}
                  text="Datum eintragen" icon={false} flex={2} farbe={farbe} t={t} accent={farbe}/>
              </div>
            </div>
          ) : terminierteStufe ? (
            // Eine Stufe ist terminiert (Datum in Zukunft) — Datum ändern oder Vorgang abbrechen.
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={() => setAbhaken({ stufe: terminierteStufe.key, datum: terminierteStufe.datum })}
                style={{ flex: 1, background: "transparent", border: `1px solid ${farbe}40`,
                  borderRadius: RAD.md, padding: "8px 0", cursor: "pointer",
                  color: farbe, fontSize: FS.s, fontWeight: FW.medium, fontFamily: "inherit" }}>
                Datum ändern
              </button>
              <button onClick={() => onAbbrechen && onAbbrechen(kaeufer.kontaktId)}
                style={{ flex: 1, background: "transparent", border: `1px solid ${t.border}`,
                  borderRadius: RAD.md, padding: "8px 0", cursor: "pointer",
                  color: t.sub, fontSize: FS.s, fontWeight: FW.medium, fontFamily: "inherit" }}>
                Vorgang abbrechen
              </button>
            </div>
          ) : naechsteIdx >= 0 ? (
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={() => setAbhaken({ stufe: stufen[naechsteIdx].key, datum: isoHeute() })}
                style={{ flex: 2, display: "flex", alignItems: "center", gap: 6,
                  background: farbe, border: "none", borderRadius: RAD.md, padding: "8px 0",
                  cursor: "pointer", justifyContent: "center", color: getContrastColor(farbe),
                  fontSize: FS.s, fontWeight: FW.medium, fontFamily: "inherit" }}>
                <I name="calendar" size={13} color={getContrastColor(farbe)}/>
                {stufen[naechsteIdx].label} ab (Datum)
              </button>
              <button onClick={() => onAbbrechen && onAbbrechen(kaeufer.kontaktId)}
                style={{ flex: 1, background: "transparent", border: `1px solid ${t.border}`,
                  borderRadius: RAD.md, padding: "8px 0", cursor: "pointer",
                  color: t.sub, fontSize: FS.s, fontWeight: FW.medium, fontFamily: "inherit" }}>
                Vorgang abbrechen
              </button>
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}

// ── BelegungswechselVorgang — 2-Stufen-Stepper für einen laufenden Bewohner-/
// Nutzerwechsel (analog EigentumswechselVorgang). Stufe 1 „Angekündigt" ist mit
// dem Anlegen der geplanten Belegung erledigt; Stufe 2 „Übergang" wird mit
// Auszugsdatum abgehakt (optional abweichendes Einzugsdatum → Leerstand-Lücke).
// alterBewohner/neuerBewohner sind Anzeige-Strings. belegungEdit steuert die
// Bearbeitbarkeit; im Lese-Modus reiner Fortschrittsanzeiger.
function BelegungswechselVorgang({ geplant, auszugDatum = null, alterBewohner, neuerBewohner, farbe = "#0080FF",
                                   t, editierbar = false, onTerminieren, onAbbrechen }) {
  const terminiert = !!(geplant && geplant.von); // Übergangsdatum schon gesetzt?
  const [abhaken, setAbhaken] = useState(null); // { einzug, auszug, getrennt } | null
  if (!geplant) return null;
  const istSelbst = geplant.typ === "selbstnutzung";
  const folgeWort = istSelbst ? "Selbstnutzung" : "Vermietung";
  // Leerstand-Phase nur, wenn terminiert UND Auszug VOR Einzug liegt.
  const mitLeerstand = !!(terminiert && auszugDatum && geplant.von
    && zuIsoDatum(auszugDatum) < zuIsoDatum(geplant.von));
  const stufen = mitLeerstand
    ? [
        { key: "angekuendigt", label: "Angekündigt", erledigt: true, datum: null },
        { key: "leerstand",    label: "Leerstand",    erledigt: false, datum: auszugDatum, leer: true },
        { key: "uebergang",    label: "Einzug",       erledigt: false, datum: geplant.von },
      ]
    : [
        { key: "angekuendigt", label: "Angekündigt", erledigt: true, datum: null },
        { key: "uebergang",    label: "Übergang",    erledigt: false, datum: terminiert ? geplant.von : null },
      ];
  const naechsteIdx = 1;
  const OK = "#10B981";
  const LEER_FARBE = "#94A3B8";

  return (
    <div style={{ marginBottom: 10, padding: "12px 14px", background: farbe + "0A",
      border: `1px solid ${farbe}30`, borderRadius: RAD.md }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between",
        marginBottom: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <I name="swap" size={13} color={farbe}/>
          <span style={{ fontSize: FS.s, fontWeight: FW.bold, color: t.text }}>
            Belegungswechsel läuft
          </span>
        </div>
        <span style={{ fontSize: FS.xxs, padding: "2px 8px", borderRadius: RAD.ms,
          background: "#3B82F6", color: "#fff", fontWeight: FW.medium }}>
          werdend
        </span>
      </div>

      {/* Parteien */}
      <div style={{ fontSize: FS.xs, color: t.sub, marginBottom: 12, lineHeight: 1.5 }}>
        {alterBewohner && <>Bisher: <b style={{ color: t.text }}>{alterBewohner}</b> · </>}
        Neu ({folgeWort}): <b style={{ color: t.text }}>{neuerBewohner || "—"}</b>
      </div>

      {/* Stepper */}
      <div style={{ display: "flex", marginBottom: editierbar ? 12 : 0 }}>
        {stufen.map((s, i) => {
          const istNaechste = i === naechsteIdx;
          const akzent = s.leer ? LEER_FARBE : farbe;
          const punktFarbe = s.erledigt ? OK : (istNaechste ? akzent : t.border);
          return (
            <div key={s.key} style={{ flex: 1, display: "flex", flexDirection: "column",
              alignItems: "center", position: "relative" }}>
              {i > 0 && (
                <div style={{ position: "absolute", top: 9, right: "50%", left: "-50%", height: 2,
                  background: s.erledigt ? OK : t.border, zIndex: 0 }}/>
              )}
              <div style={{ width: 20, height: 20, borderRadius: RAD.full, zIndex: 1,
                background: s.erledigt ? OK : t.card, border: `2px solid ${punktFarbe}`,
                display: "flex", alignItems: "center", justifyContent: "center" }}>
                {s.erledigt && <I name="check" size={11} color="#fff"/>}
              </div>
              <span style={{ fontSize: FS.xxs, marginTop: 5, textAlign: "center",
                color: s.erledigt ? t.text : (s.leer ? LEER_FARBE : (istNaechste ? akzent : t.muted)),
                fontWeight: istNaechste ? FW.bold : FW.regular }}>
                {s.label}
              </span>
              {s.datum && (
                <span style={{ fontSize: FS.xxs, color: t.muted, marginTop: 1 }}>
                  {datumDe(s.datum)}
                </span>
              )}
            </div>
          );
        })}
      </div>

      {/* „Wird wirksam am"-Hinweis: reine Information, auch im Lese-Modus sichtbar
          (wenn terminiert und gerade nicht das Datums-Formular offen ist). */}
      {terminiert && !abhaken && (
        <div style={{ fontSize: FS.xs, color: t.sub, marginBottom: editierbar ? 8 : 0,
          marginTop: editierbar ? 0 : 4, lineHeight: 1.4 }}>
          Wird automatisch wirksam am <b style={{ color: farbe }}>{datumDe(geplant.von)}</b>.
          Bis dahin bleibt der bisherige Bewohner aktiv.
        </div>
      )}

      {/* Aktionen */}
      {editierbar && (
        <>
          {abhaken ? (
            <div style={{ background: t.card, border: `1px solid ${farbe}40`,
              borderRadius: RAD.md, padding: 10 }}>
              <div style={{ fontSize: FS.xs, color: t.sub, marginBottom: 4 }}>
                {abhaken.getrennt
                  ? `Einzug neuer ${istSelbst ? "Nutzer" : "Mieter"} am`
                  : "Übergang (Einzug = Auszug) am"}
              </div>
              <div style={{ marginBottom: 8 }}>
                <DatumFeld value={abhaken.einzug} onChange={d => setAbhaken(a => ({ ...a, einzug: d }))}
                  t={t} accent={farbe} iso defaultHeute={false}/>
              </div>
              {abhaken.getrennt && (
                <>
                  <div style={{ fontSize: FS.xs, color: t.sub, marginBottom: 4 }}>
                    Auszug bisheriger Bewohner am
                  </div>
                  <div style={{ marginBottom: 8 }}>
                    <DatumFeld value={abhaken.auszug} onChange={d => setAbhaken(a => ({ ...a, auszug: d }))}
                      t={t} accent={farbe} iso defaultHeute={false}/>
                  </div>
                  {abhaken.auszug && abhaken.einzug && abhaken.auszug > abhaken.einzug && (
                    <div style={{ fontSize: FS.xxs, color: "#EF4444", marginBottom: 8 }}>
                      Auszug darf nicht nach dem Einzug liegen.
                    </div>
                  )}
                </>
              )}
              {/* Toggle für abweichendes Auszugsdatum (alter zieht früher aus → Leerstand) */}
              <button onClick={() => setAbhaken(a => ({ ...a, getrennt: !a.getrennt,
                auszug: a.getrennt ? null : a.einzug }))}
                style={{ background: "transparent", border: "none", cursor: "pointer",
                  color: farbe, fontSize: FS.xs, fontWeight: FW.medium, fontFamily: "inherit",
                  padding: "2px 0", marginBottom: 8 }}>
                {abhaken.getrennt ? "− Gleiches Datum für Auszug und Einzug" : "+ Abweichendes Auszugsdatum (Leerstand)"}
              </button>
              <div style={{ display: "flex", gap: 6 }}>
                <AktionsButton variante="breit" rolle="abbrechen" onClick={() => setAbhaken(null)}
                  text="Abbrechen" icon={false} flex={1} t={t} accent={farbe}/>
                <AktionsButton variante="breit" rolle="bestaetigen"
                  disabled={abhaken.getrennt && abhaken.auszug && abhaken.einzug && abhaken.auszug > abhaken.einzug}
                  onClick={() => {
                    const einzug = abhaken.einzug || isoHeute();
                    const auszug = abhaken.getrennt ? (abhaken.auszug || einzug) : einzug;
                    onTerminieren && onTerminieren({ auszug, einzug });
                    setAbhaken(null);
                  }}
                  text="Übergang eintragen" icon={false} flex={2} farbe={farbe} t={t} accent={farbe}/>
              </div>
            </div>
          ) : terminiert ? (
            // Übergang ist terminiert (Datum in der Zukunft): nur Aktions-Buttons,
            // der Hinweis steht bereits oben (auch im Lese-Modus).
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={() => setAbhaken({ einzug: geplant.von, auszug: null, getrennt: false })}
                style={{ flex: 1, background: "transparent", border: `1px solid ${farbe}40`,
                  borderRadius: RAD.md, padding: "8px 0", cursor: "pointer",
                  color: farbe, fontSize: FS.s, fontWeight: FW.medium, fontFamily: "inherit" }}>
                Datum ändern
              </button>
              <button onClick={() => onAbbrechen && onAbbrechen()}
                style={{ flex: 1, background: "transparent", border: `1px solid ${t.border}`,
                  borderRadius: RAD.md, padding: "8px 0", cursor: "pointer",
                  color: t.sub, fontSize: FS.s, fontWeight: FW.medium, fontFamily: "inherit" }}>
                Vorgang abbrechen
              </button>
            </div>
          ) : (
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={() => setAbhaken({ einzug: isoHeute(), auszug: null, getrennt: false })}
                style={{ flex: 2, display: "flex", alignItems: "center", gap: 6,
                  background: farbe, border: "none", borderRadius: RAD.md, padding: "8px 0",
                  cursor: "pointer", justifyContent: "center", color: getContrastColor(farbe),
                  fontSize: FS.s, fontWeight: FW.medium, fontFamily: "inherit" }}>
                <I name="calendar" size={13} color={getContrastColor(farbe)}/>
                Übergangsdatum eintragen
              </button>
              <button onClick={() => onAbbrechen && onAbbrechen()}
                style={{ flex: 1, background: "transparent", border: `1px solid ${t.border}`,
                  borderRadius: RAD.md, padding: "8px 0", cursor: "pointer",
                  color: t.sub, fontSize: FS.s, fontWeight: FW.medium, fontFamily: "inherit" }}>
                Vorgang abbrechen
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ── EigentumHistorie — abgeschlossene (ehemalige) Eigentümer als Zeitstrahl ──
// Read-only, analog BelegungsHistorie. Zeigt nur ehemalige Einträge (mit bis),
// neueste zuerst. Erscheint nur, wenn es mindestens einen gibt.
function EigentumHistorie({ eig, t, accent = ACCENT }) {
  const ehemalige = (eig || [])
    .filter(p => eigStatus(p) === "ehemalig")
    .sort((a, b) => String(b.bis || "").localeCompare(String(a.bis || "")));
  if (ehemalige.length === 0) return null;
  return (
    <div style={{ marginTop: 12 }}>
      <div style={{ fontSize: FS.xs, fontWeight: FW.bold, color: t.muted,
        textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8 }}>
        Frühere Eigentümer
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
        {ehemalige.map((p, i) => (
          <div key={i} style={{ display: "flex", gap: 10, position: "relative",
            paddingBottom: i < ehemalige.length - 1 ? 12 : 0 }}>
            {/* Zeitstrahl-Punkt + Linie */}
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", flexShrink: 0 }}>
              <div style={{ width: 9, height: 9, borderRadius: RAD.full, marginTop: 4,
                background: t.muted, flexShrink: 0 }}/>
              {i < ehemalige.length - 1 && (
                <div style={{ width: 2, flex: 1, background: t.border, marginTop: 2 }}/>
              )}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: FS.s, fontWeight: FW.medium, color: t.sub }}>{p.name}</div>
              <div style={{ fontSize: FS.xs, color: t.muted }}>
                {datumDe(p.von) && `${datumDe(p.von)} – `}{datumDe(p.bis)}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── PersonCard — Eigentümer/Person als kompakte, aufklappbare KontaktKarte ───
// Gleiches Muster wie die Bewohner-Karten (Belegung): eingeklappt kompakte
// KontaktKarte; aufgeklappt durchgehender Rahmen + Detail. Die Kontext-Leiste
// (Grundbuch/Stimmrecht, seit/bis, aktuell) ist immer sichtbar.
function PersonCard({ p, pIndex = 0, farbe = ACCENT, isAktuell = true, t, kontakte = [], onKontaktClick = null, setKontakte = null, editierbar = false, onRemove = null }) {
  const [offen, setOffen] = useState(false);
  if (!p) return null;
  const kontakt = p.kontaktId ? (kontakte || []).find(k => k.id === p.kontaktId) : null;
  // Status-Pille: aktiver Eigentümer → „aktuell" (Akzentfarbe), werdender Käufer
  // → „werdend" in Info-Blau (an der Kontaktkarte klarer als das Stepper-Label
  // „in Übernahme"). Ehemalige erscheinen hier nicht (Historie).
  const st = eigStatus(p);
  const KARTEN_LABEL = { interessent: "Kaufabsicht", werdend: "werdend", aktiv: "aktuell", ehemalig: "ehemalig" };
  const pilleLabel = KARTEN_LABEL[st] || EIG_STATUS[st].label;
  const pilleFarbe = EIG_STATUS[st].farbe || farbe;
  const zeigePille = isAktuell || st === "interessent" || st === "werdend";
  // Entfernen-Button (nur im Bearbeiten-Modus, aufgeklappt): wandert via
  // extraFooter IN die KontaktDetailKarte, links neben „Zum Kontakt". Löst nur
  // die Verknüpfung an DIESER Einheit (kein Löschen) — daher x-Icon, kein
  // Papierkorb. Der Kontakt selbst bleibt unangetastet.
  const entfernenBtn = (editierbar && onRemove) ? (
    <button onClick={() => onRemove(p)}
      style={{ display: "inline-flex", alignItems: "center", gap: 5,
        fontSize: FS.s, padding: "6px 12px", background: "transparent", color: "#EF4444",
        border: `1px solid #EF444440`, borderRadius: RAD.sm, cursor: "pointer",
        fontWeight: FW.medium, fontFamily: "inherit" }}>
      <I name="x" size={13} color="#EF4444"/> Entfernen
    </button>
  ) : null;

  // Falls kein verknüpfter Kontakt existiert (Legacy-Eintrag nur mit Name):
  // einfache Karte mit Avatar + Name, sonst die echte KontaktKarte.
  const kopf = kontakt
    ? <KontaktKarte k={kontakt} t={t} aktiv={offen} onClick={() => setOffen(o => !o)} kompakt ohneRahmen/>
    : (
      <div onClick={() => setOffen(o => !o)} style={{ display: "flex", alignItems: "center",
        gap: 10, padding: "8px 12px", cursor: "pointer" }}>
        <Avatar name={p.name} size={30} accent={farbe}/>
        <div style={{ flex: 1, minWidth: 0, fontSize: FS.m, fontWeight: FW.bold,
          color: isAktuell ? t.text : t.sub }}>{p.name}</div>
      </div>
    );

  if (!offen) {
    // Werdende/künftige Eigentümer (nicht aktuell) leicht ausgrauen — wie die
    // werdende Bewohner-Karte. Aufgeklappt erscheint das Profil normal.
    const werdend = !isAktuell;
    return (
      <div style={{ position: "relative", marginBottom: 6,
        border: `1px solid ${isAktuell ? farbe + "30" : t.border}`,
        borderRadius: RAD.md, overflow: "hidden",
        background: isAktuell ? farbe + "08" : "transparent",
        opacity: werdend ? 0.7 : 1 }}>
        {zeigePille && <EckPille label={pilleLabel} farbe={pilleFarbe} t={t}/>}
        {kopf}
      </div>
    );
  }
  // Aufgeklappt: bei verknüpftem Kontakt volles Profil (embedded), sonst nur Kopf.
  if (kontakt) {
    return (
      <div style={{ position: "relative", marginBottom: 6 }}>
        {zeigePille && <EckPille label={pilleLabel} farbe={pilleFarbe} t={t}/>}
        <KontaktDetailKarte k={kontakt} t={t} accent={farbe}
          ves={[]} kontakte={kontakte || []} setKontakte={setKontakte}
          onUpdate={(updated) => setKontakte && setKontakte(prev =>
            prev.map(x => x.id === kontakt.id ? updated : x))}
          onGotoKontakt={(id) => onKontaktClick && onKontaktClick(id)}
          onKontaktClick={onKontaktClick}
          onKopfClick={() => setOffen(false)}
          extraFooter={entfernenBtn}
          embedded/>
      </div>
    );
  }
  return (
    <div style={{ position: "relative", marginBottom: 6, border: `1px solid ${farbe}`,
      borderRadius: RAD.md, background: farbe + "08", overflow: "hidden" }}>
      {zeigePille && <EckPille label={pilleLabel} farbe={pilleFarbe} t={t}/>}
      {kopf}
      {entfernenBtn && <div style={{ padding: "0 12px 10px" }}>{entfernenBtn}</div>}
    </div>
  );
}

// ── Anteile-Formatierung (deutsch) ──────────────────────────────────────────
// MEA-/Gesamtanteile haben oft Nachkommastellen (z. B. 10.000,0000). Intern
// rechnen wir mit einer echten Zahl; angezeigt wird deutsch: Punkt als
// Tausendertrenner, Komma als Dezimaltrenner. Eingaben dürfen englisch
// ("10000.0000") oder deutsch ("10.000,0000") notiert sein.
function parseAnteile(roh) {
  if (roh === null || roh === undefined) return null;
  if (typeof roh === "number") return isNaN(roh) ? null : roh;
  let s = String(roh).trim();
  if (!s) return null;
  const hatKomma = s.indexOf(",") >= 0;
  if (hatKomma) {
    // Deutsch: Punkte sind Tausendertrenner, Komma ist Dezimaltrenner.
    s = s.replace(/\./g, "").replace(",", ".");
  }
  // Sonst: Punkt ist Dezimaltrenner (englisch) oder gar nicht vorhanden.
  const n = parseFloat(s);
  return isNaN(n) ? null : n;
}
// Formatiert eine Zahl deutsch. nachkomma: gewünschte Nachkommastellen; wird aus
// dem Rohwert abgeleitet, damit angegebene Stellen (auch Nullen) erhalten bleiben.
function formatAnteileDE(roh) {
  const n = parseAnteile(roh);
  if (n === null) return "";
  // Nachkommastellen aus dem Rohwert bestimmen (englische ODER deutsche Notation).
  let dezStellen = 0;
  const s = String(roh);
  const mKomma = s.match(/,(\d+)\s*$/);
  const mPunkt = s.match(/\.(\d+)\s*$/);
  if (mKomma) dezStellen = mKomma[1].length;
  else if (mPunkt && typeof roh !== "number") dezStellen = mPunkt[1].length;
  const fest = n.toFixed(dezStellen); // z. B. "10000.0000"
  const teile = fest.split(".");
  const ganz = teile[0].replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return teile.length > 1 ? ganz + "," + teile[1] : ganz;
}

// Ende eines 12-Monats-Wirtschaftsjahres aus dem Beginn (TT.MM.) ableiten:
// einen Tag vor dem Beginn. Z. B. 01.04. → 31.03.; 01.01. → 31.12.
function wirtschaftsjahrEnde(beginnTagMonat) {
  const m = String(beginnTagMonat || "").match(/^(\d{1,2})\.(\d{1,2})/);
  if (!m) return "";
  const tag = parseInt(m[1], 10);
  const mon = parseInt(m[2], 10);
  // Referenzjahr (Schaltjahr) für korrektes Tagesdatum; einen Tag zurück.
  const d = new Date(2024, mon - 1, tag);
  d.setDate(d.getDate() - 1);
  return String(d.getDate()).padStart(2, "0") + "." + String(d.getMonth() + 1).padStart(2, "0") + ".";
}

// ── ETV-Status-Logik (Wirtschaftsjahr → Nächste ETV) ────────────────────────
// Bestimmt aus dem Wirtschaftsjahr-Wert (Feld "Wirtschaftsjahr") den Endtag des
// LAUFENDEN Wirtschaftsjahres als JS-Date. "Kalenderjahr" → 31.12.; ein selbst
// definierter Zeitraum "TT.MM.–TT.MM." → das Ende-Datum. Bezugspunkt ist heute:
// es wird das Wirtschaftsjahr-Ende gewählt, das als nächstes in der Zukunft (oder
// heute) liegt.
function wjEndeDatum(wjWert, heute) {
  const jetzt = heute || new Date();
  const s = String(wjWert || "").trim();
  // Endtag/-monat ermitteln.
  let endTag = 31, endMon = 12;
  const m = s.match(/–\s*(\d{1,2})\.(\d{1,2})/);
  if (m) { endTag = parseInt(m[1], 10); endMon = parseInt(m[2], 10); }
  // Kandidat im aktuellen Kalenderjahr; wenn schon vorbei, nächstes Jahr.
  let jahr = jetzt.getFullYear();
  let kand = new Date(jahr, endMon - 1, endTag, 23, 59, 59);
  if (kand.getTime() < jetzt.getTime()) {
    jahr += 1;
    kand = new Date(jahr, endMon - 1, endTag, 23, 59, 59);
  }
  return kand;
}
// Ablaufjahr des laufenden Wirtschaftsjahres (Kalenderjahr des WJ-Endes).
function wjAblaufJahr(wjWert, heute) {
  return wjEndeDatum(wjWert, heute).getFullYear();
}
// Status für „Nächste ETV":
//  - mit Datum in der Zukunft → "geplant" (neutral)
//  - mit Datum in der Vergangenheit → "erledigt" (grün)
//  - ohne Datum, > 2 Monate vor WJ-Ende → "offen" (orange)
//  - ohne Datum, ≤ 2 Monate vor WJ-Ende → "dringend" (rot)
function etvNaechsteStatus(datumIso, wjWert, heute) {
  const jetzt = heute || new Date();
  if (datumIso) {
    const d = parseDatumWert(datumIso);
    if (d && d.getTime() < jetzt.getTime()) return "erledigt";
    return "geplant";
  }
  const ende = wjEndeDatum(wjWert, jetzt);
  const zweiMonateVor = new Date(ende.getTime());
  zweiMonateVor.setMonth(zweiMonateVor.getMonth() - 2);
  return jetzt.getTime() >= zweiMonateVor.getTime() ? "dringend" : "offen";
}
const ETV_STATUS_FARBE = { erledigt: "#10B981", geplant: null, offen: "#F59E0B", dringend: "#EF4444" };

// ── Legionellenprüfung (TrinkwV) ────────────────────────────────────────────
// Strukturiertes Spezial-Feld (type:"legionellen") an der fixen Liegenschaft-
// Stammdaten-Karte. Datenform am Feld:
//   { letzte: "DD.MM.YYYY", naechste: "DD.MM.YYYY", befund: <BEFUND_ID>,
//     naechsteManuell: bool }
// Befund steuert den Wiederbeprobungs-Turnus ab Tag der letzten Prüfung
// (TrinkwV-Eskalationskette):
//   unauffaellig   → +3 Jahre   (Normalrhythmus, Wert unter Maßnahmenwert)
//   ueberschritten → +3 Monate  (akute Nachbeprobung nach Überschreitung)
//   nachprobe_ok   → +1 Jahr    (erste saubere Wiederholung nach Maßnahme)
// Danach, wenn weiter unauffällig, wieder +3 Jahre.
const LEGIONELLEN_BEFUNDE = [
  { id: "unauffaellig",   label: "Unauffällig",            kurz: "+3 J", monate: 36, farbe: "#10B981" },
  { id: "ueberschritten", label: "Maßnahmenwert überschritten", kurz: "+3 M", monate: 3,  farbe: "#EF4444" },
  { id: "nachprobe_ok",   label: "Nachprobe ok",           kurz: "+1 J", monate: 12, farbe: "#F59E0B" },
];
function legionellenBefund(id) {
  return LEGIONELLEN_BEFUNDE.find(b => b.id === id) || LEGIONELLEN_BEFUNDE[0];
}
// Nächstes Fälligkeitsdatum aus letzter Prüfung + Befund-Intervall berechnen.
// Liefert "DD.MM.YYYY" oder "" (kein gültiges Ausgangsdatum).
function legionellenNaechste(letzteWert, befundId) {
  const d = parseDatumWert(letzteWert);
  if (!d || isNaN(d.getTime())) return "";
  const b = legionellenBefund(befundId);
  const ziel = new Date(d.getTime());
  ziel.setMonth(ziel.getMonth() + b.monate);
  return datumAnzeige(ziel);
}
// Ampel-Status der Fälligkeit (für die Anzeige-Farbe):
//   erledigt-Lücke gibt es nicht — relevant ist, wie nah/überfällig die nächste
//   Prüfung ist: > 3 Monate hin → "ok" (neutral), ≤ 3 Monate → "bald"
//   (orange), in der Vergangenheit → "ueberfaellig" (rot).
function legionellenFaelligStatus(naechsteWert, heute) {
  const d = parseDatumWert(naechsteWert);
  if (!d || isNaN(d.getTime())) return null;
  const jetzt = heute || new Date();
  if (d.getTime() < jetzt.getTime()) return "ueberfaellig";
  const dreiMonate = new Date(jetzt.getTime());
  dreiMonate.setMonth(dreiMonate.getMonth() + 3);
  return d.getTime() <= dreiMonate.getTime() ? "bald" : "ok";
}
const LEGIONELLEN_STATUS_FARBE = { ok: null, bald: "#F59E0B", ueberfaellig: "#EF4444" };

// ── Prüfpflicht-Ableitung aus der Technik ───────────────────────────────────
// Die Legionellen-Prüfpflicht (TrinkwV) gilt nur bei ZENTRALER Trinkwasser-
// erwärmung (Großanlage). Statt eines redundanten Schalters leiten wir das aus
// den Technik-Geräten des Objekts ab: existiert ein Warmwasser-Gerät
// (typ "warmwasser") mit einem zentralen System, ist das Objekt prüfpflichtig
// und der Legionellen-Tab wird sichtbar. Dezentrale Systeme
// (Durchlauferhitzer / Boiler dezentral) lösen KEINE Pflicht aus.
const LEGIONELLEN_ZENTRAL_SYSTEME = ["Zentralspeicher", "Frischwasserstation", "Solarthermie"];
function geraetSystemWert(g) {
  const felder = (g && Array.isArray(g.felder)) ? g.felder : [];
  const sf = felder.find(f => f && f.name === "System");
  return sf ? (sf.value || "") : "";
}
// true, wenn das Objekt prüfpflichtig ist (zentrale Warmwasserversorgung).
// Vorrang hat das explizite Technik-Stammfeld „Warmwasserversorgung"
// (Zentral/Dezentral). Nur wenn das leer/ungesetzt ist, greift hilfsweise die
// Ableitung aus den Technik-Geräten (Warmwasser-Gerät mit zentralem System).
function objektHatZentralesWarmwasser(ve) {
  const karten = (ve && Array.isArray(ve.karten)) ? ve.karten : [];
  // 1) Expliziter Schalter im Technik-Stammfeld.
  for (let i = 0; i < karten.length; i++) {
    const k = karten[i];
    if (!k || k.kategorie !== "technik" || !Array.isArray(k.stamm)) continue;
    const f = k.stamm.find(x => x && x.name === "Warmwasserversorgung");
    if (f && f.value === "Zentral") return true;
    if (f && f.value === "Dezentral") return false;
  }
  // 2) Hilfsweise: aus den Technik-Geräten ableiten.
  for (let i = 0; i < karten.length; i++) {
    const k = karten[i];
    if (!k || k.kategorie !== "technik") continue;
    const geraete = Array.isArray(k.technikGeraete) ? k.technikGeraete : [];
    for (let j = 0; j < geraete.length; j++) {
      const g = geraete[j];
      if (!g || g.typ !== "warmwasser") continue;
      if (LEGIONELLEN_ZENTRAL_SYSTEME.indexOf(geraetSystemWert(g)) >= 0) return true;
    }
  }
  return false;
}

// Sammelt alle Standorte (Gebäude-/Tiefgaragen-Karten) eines Objekts samt ihrer
// Räume und Einheiten — dieselbe Quelle, die auch die Technik-Zuordnung nutzt.
function legionellenStandorte(ve) {
  const karten = (ve && Array.isArray(ve.karten)) ? ve.karten : [];
  return karten.filter(k => k && (k.kategorie === "gebaeude" || k.kategorie === "tiefgarage"));
}
// Findet eine Einheit über alle Standorte hinweg (für Anzeige + Ansprechpartner).
function legionellenFindeEinheit(ve, einheitId) {
  if (!einheitId) return null;
  const standorte = legionellenStandorte(ve);
  for (let i = 0; i < standorte.length; i++) {
    const eh = (standorte[i].einheiten || []).find(e => e && String(e.id) === String(einheitId));
    if (eh) return eh;
  }
  return null;
}
// Findet einen Raum über alle Standorte hinweg.
function legionellenFindeRaum(ve, raumId) {
  if (!raumId) return null;
  const standorte = legionellenStandorte(ve);
  for (let i = 0; i < standorte.length; i++) {
    const r = (standorte[i].raeume || []).find(x => x && String(x.id) === String(raumId));
    if (r) return r;
    const einheiten = standorte[i].einheiten || [];
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
// Ansprechpartner einer einheit-verknüpften Probenahmestelle: aktueller Bewohner
// (Zutritt zur Wohnung), ersatzweise Eigentümer. Liefert das Kontakt-Objekt
// oder null. kontakte = globale Kontaktliste.
function legionellenAnsprechpartner(ve, einheitId, kontakte) {
  const eh = legionellenFindeEinheit(ve, einheitId);
  if (!eh || !Array.isArray(kontakte)) return null;
  const findK = (kid) => kontakte.find(k => k && k.id === kid) || null;
  // 1) Aktueller Bewohner (erstes Haushaltsmitglied der aktiven Belegung).
  const hh = aktiverHaushalt(eh);
  const mit = (hh && Array.isArray(hh.mitglieder)) ? hh.mitglieder.filter(Boolean) : [];
  if (mit.length > 0 && mit[0].kontaktId != null) {
    const k = findK(mit[0].kontaktId);
    if (k) return k;
  }
  // 2) Fallback: Eigentümer.
  const eig = (eh.eigentuemer || []).filter(Boolean);
  if (eig.length > 0 && eig[0].kontaktId != null) {
    const k = findK(eig[0].kontaktId);
    if (k) return k;
  }
  return null;
}

// ── FeldKontaktKarte: aufklappbare Kontakt-Anzeige für ein Kontakt-Feld ──────
// Eingeklappt: kompakte KontaktKarte (Avatar + Name). Klick klappt auf und
// zeigt die Profildaten (Stammdaten + Notizen) via KontaktDetailKarte im
// embedded-Modus — ohne Rollen/Objekte, ohne Bearbeitung —, plus Footer-Button
// „Zum Profil". Gleiches Muster wie VertragFirmaKarte.
function FeldKontaktKarte({ k, t, accent, onKontaktClick, kontakte, setKontakte }) {
  const [offen, setOffen] = useState(false);
  if (!offen) {
    return <KontaktKarte k={k} t={t} aktiv={false} onClick={() => setOffen(true)} kompakt/>;
  }
  return (
    <KontaktDetailKarte k={k} t={t} accent={accent}
      ves={[]} kontakte={kontakte || []} setKontakte={setKontakte}
      onUpdate={(updated) => setKontakte && setKontakte(prev =>
        prev.map(x => x.id === k.id ? updated : x))}
      onGotoKontakt={(id) => onKontaktClick && onKontaktClick(id)}
      onKontaktClick={onKontaktClick}
      onKopfClick={() => setOffen(false)}
      embedded/>
  );
}

// ── LegionellenFeldInhalt: strukturierte Anzeige/Bearbeitung des Spezial-Felds
// type:"legionellen". Sub-Werte liegen direkt am Feld (letzte/befund/naechste/
// naechsteManuell). Im Edit-Modus berechnet sich „nächste fällig" automatisch
// aus letzter Prüfung + Befund-Intervall, solange der Nutzer das Datum nicht
// von Hand überschrieben hat (naechsteManuell).
function LegionellenFeldInhalt({ field, index, t, accent, editMode, setFields }) {
  const letzte = field.letzte || "";
  const befund = field.befund || "unauffaellig";
  const naechsteManuell = !!field.naechsteManuell;
  // Effektive nächste Fälligkeit: manuell gesetzter Wert oder Auto-Berechnung.
  const autoNaechste = legionellenNaechste(letzte, befund);
  const naechste = naechsteManuell && field.naechste ? field.naechste : autoNaechste;
  const status = legionellenFaelligStatus(naechste);
  const statusFarbe = LEGIONELLEN_STATUS_FARBE[status] || null;
  const bInfo = legionellenBefund(befund);

  const patch = (daten) => setFields(fs => fs.map((f, i) => i === index ? { ...f, ...daten } : f));
  const setLetzte = (w) => patch({ letzte: w, naechsteManuell: false, naechste: "" });
  const setBefund = (id) => patch({ befund: id, naechsteManuell: false, naechste: "" });
  const setNaechste = (w) => patch({ naechste: w, naechsteManuell: true });

  if (!editMode) {
    const hatWert = !!letzte || !!naechste;
    if (!hatWert) {
      return <span style={{ flex: 1, fontSize: FS.s, color: t.muted, textAlign: "right" }}>—</span>;
    }
    return (
      <div style={{ flex: 1, minWidth: 0, textAlign: "right" }}>
        <div style={{ fontSize: FS.s, fontWeight: 600, color: statusFarbe || t.text }}>
          {naechste ? ("Nächste: " + naechste) : "—"}
        </div>
        <div style={{ fontSize: FS.xs, color: t.muted, marginTop: 2 }}>
          {(letzte ? ("Letzte: " + datumAnzeige(letzte)) : "Keine Prüfung")}
          {" · "}
          <span style={{ color: bInfo.farbe }}>{bInfo.label}</span>
        </div>
      </div>
    );
  }
  return (
    <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 8 }}>
      <div>
        <div style={{ fontSize: FS.xs, color: t.muted, marginBottom: 3 }}>Letzte Prüfung</div>
        <DatumFeld value={letzte} t={t} accent={accent} defaultHeute={false}
          onChange={setLetzte}/>
      </div>
      <div>
        <div style={{ fontSize: FS.xs, color: t.muted, marginBottom: 3 }}>Befund</div>
        <select value={befund} onChange={e => setBefund(e.target.value)}
          style={{ width: "100%", boxSizing: "border-box", background: t.surface,
            border: `1px solid ${accent}60`, borderRadius: RAD.sm,
            padding: "4px 8px", fontSize: FS.input, color: t.text,
            outline: "none", fontFamily: "inherit", appearance: "auto" }}>
          {LEGIONELLEN_BEFUNDE.map(b => (
            <option key={b.id} value={b.id}>{b.label} ({b.kurz})</option>
          ))}
        </select>
      </div>
      <div>
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between",
          marginBottom: 3 }}>
          <span style={{ fontSize: FS.xs, color: t.muted }}>Nächste fällig</span>
          {naechsteManuell && (
            <button onClick={() => patch({ naechsteManuell: false, naechste: "" })}
              style={{ background: "none", border: "none", cursor: "pointer", padding: 0,
                fontSize: FS.xs, color: accent }}>Auto</button>
          )}
        </div>
        <DatumFeld value={naechste} t={t} accent={accent} defaultHeute={false}
          onChange={setNaechste}/>
        {!naechsteManuell && autoNaechste && (
          <div style={{ fontSize: FS.xs, color: t.muted, marginTop: 3 }}>
            Automatisch {bInfo.kurz} ab letzter Prüfung
          </div>
        )}
      </div>
    </div>
  );
}

// ── FieldRow (Drag&Drop, Inline-Edit) ───────────────────────────────────────
function FieldRow({ field, index, t, accent, editMode, setFields, kontakte = [], setKontakte = null, onKontaktClick = null, ves = [], onVEClick = null, wjWert = "", etvStamm = null, onSyncChange = null }) {
  const ft = FIELD_TYPES.find(f => f.id === (field.type || "text")) || FIELD_TYPES[0];
  const istKontakt = field.type === "kontakt";
  const istKontakteMulti = field.type === "kontakte";
  const istObjekt = field.type === "objekt";
  const istDatum = field.type === "date";
  const istBerechnet = field.type === "computed" || (field.readOnly && field.type !== "berechnet_override");
  // Berechnet-mit-Override: zeigt im Lese-Modus den Override-Wert (field.value),
  // sonst den berechneten Wert (field.berechnet). Im Edit-Modus überschreibbar.
  const istBerechnetOverride = field.type === "berechnet_override";
  const istSelect = field.type === "select";
  const istNotiz = field.type === "notiz";
  const istEtvNaechste = field.type === "etv_naechste";
  const istLegionellen = field.type === "legionellen";
  // Auswahl mit Freitext-Option (z. B. Gesamtanteile 1000/10.000/„Andere…"):
  // freitextAktiv, wenn ein Wert gesetzt ist, der nicht in den festen Optionen
  // liegt — dann ist der „Andere…"-Eintrag gewählt und ein Eingabefeld sichtbar.
  const hatFreitext = istSelect && field.freitextBei;
  const optionenListe = (field.optionen || []);
  // Anzeige-Wert: bei Zahl-Auswahl (z. B. Gesamtanteile) deutsch formatieren.
  const istZahlAuswahl = istSelect && field.freitextTyp === "number";

  // Name eines Kontakts (Firma: name; Person: Vor-/Nachname).
  const kontaktName = (k) => !k ? "" : (k.typ === "firma"
    ? (k.name || "")
    : (`${k.vorname || ""} ${k.nachname || ""}`.trim() || k.name || ""));
  const verknuepft = istKontakt && field.kontaktId
    ? (kontakte || []).find(k => k.id === field.kontaktId) : null;
  const verknuepftesObjekt = istObjekt && field.objektId
    ? (ves || []).find(v => String(v.id) === String(field.objektId)) : null;
  // Mehrfach-Kontakte: IDs am Feld (kontaktIds[]) → Kontaktobjekte auflösen.
  const multiIds = istKontakteMulti && Array.isArray(field.kontaktIds) ? field.kontaktIds : [];
  const multiKontakte = multiIds
    .map(id => (kontakte || []).find(k => String(k.id) === String(id)))
    .filter(Boolean);
  const addMultiKontakt = (kid) => {
    if (!kid) return;
    setFields(fs => fs.map((f, i) => {
      if (i !== index) return f;
      const ids = Array.isArray(f.kontaktIds) ? f.kontaktIds.slice() : [];
      if (ids.map(String).indexOf(String(kid)) < 0) ids.push(kid);
      return { ...f, kontaktIds: ids };
    }));
  };
  const removeMultiKontakt = (kid) => {
    setFields(fs => fs.map((f, i) => {
      if (i !== index) return f;
      const ids = (Array.isArray(f.kontaktIds) ? f.kontaktIds : []).filter(x => String(x) !== String(kid));
      return { ...f, kontaktIds: ids };
    }));
  };
  // Sync-Feld: Wert kommt aus der gemeinsamen Quelle (etvStamm), nicht aus der
  // Karte. Beide Karten (Liegenschaft + Verwaltung) teilen sich denselben Wert.
  const istSync = !!(field.syncKey && etvStamm && onSyncChange);
  const syncWert = istSync ? (etvStamm[field.syncKey] != null ? etvStamm[field.syncKey] : "") : null;
  // Effektiver Anzeige-/Startwert: bei Sync aus der Quelle, sonst Feldwert (sonst
  // Name des verknüpften Kontakts).
  const startVal = istSync ? syncWert : (field.value || (verknuepft ? kontaktName(verknuepft) : ""));

  const [val, setVal] = useState(startVal);
  // Außenänderungen am Sync-Wert (andere Karte hat geändert) übernehmen.
  useEffect(() => {
    if (istSync) setVal(syncWert);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [syncWert]);
  // Freitext-Modus bei Auswahl mit „Andere…": initial aktiv, wenn der Startwert
  // gesetzt ist, aber nicht zu den festen Optionen gehört.
  const startFreitext = hatFreitext && startVal && optionenListe.indexOf(startVal) < 0;
  const [freitextModus, setFreitextModus] = useState(!!startFreitext);
  // Steuert, ob das Freitext-Zahlenfeld gerade fokussiert ist: beim Tippen
  // Roheingabe stehen lassen, erst beim Verlassen deutsch formatieren.
  const [freitextFokus, setFreitextFokus] = useState(false);
  // Zeitraum-Freitext (z. B. Wirtschaftsjahr „selbst definieren": TT.MM.–TT.MM.).
  // Startwerte aus dem gespeicherten value parsen.
  const zeitraumTeile = (typeof startVal === "string" && startVal.indexOf("–") >= 0)
    ? startVal.split("–") : ["", ""];
  const [zrVon, setZrVon] = useState((zeitraumTeile[0] || "").trim());
  const [zrBis, setZrBis] = useState((zeitraumTeile[1] || "").trim());
  // Welcher Zeitraum-Picker offen ist: null | "von" | "bis".
  const [zrPicker, setZrPicker] = useState(null);
  // Anzeige-Wert: bei Zahl-Auswahl (z. B. Gesamtanteile) deutsch formatieren.
  const anzeigeWert = istZahlAuswahl ? (formatAnteileDE(val) || (val || "")) : val;
  // Nächste-ETV-Anzeige: mit Datum → Datum (grün wenn vergangen); ohne Datum →
  // Ablaufjahr des Wirtschaftsjahres (orange offen / rot ≤2 Monate vor WJ-Ende).
  let etvAnzeigeText = "—", etvAnzeigeFarbe = null;
  if (istEtvNaechste) {
    const st = etvNaechsteStatus(val, wjWert);
    if (val) {
      etvAnzeigeText = datumAnzeige(val) || "—";
    } else {
      etvAnzeigeText = String(wjAblaufJahr(wjWert));
    }
    etvAnzeigeFarbe = ETV_STATUS_FARBE[st] || null;
  }

  const save = () => {
    if (istSync) { onSyncChange(field.syncKey, val); return; }
    setFields(fs => fs.map((f, i) => i === index ? { ...f, value: val } : f));
  };
  // Direktes Persistieren mit explizitem Wert (für bool-Toggle, da setVal async ist).
  const save2 = (neuVal) => {
    if (istSync) { onSyncChange(field.syncKey, neuVal); return; }
    setFields(fs => fs.map((f, i) => i === index ? { ...f, value: neuVal } : f));
  };
  // Kontakt verknüpfen: ID am Feld speichern, Name als value übernehmen.
  const setKontaktVerknuepfung = (kid) => {
    const k = (kontakte || []).find(x => x.id === kid);
    const nm = kontaktName(k);
    setFields(fs => fs.map((f, i) => i === index ? { ...f, kontaktId: kid, value: nm || f.value } : f));
    if (nm) setVal(nm);
  };
  const loeseVerknuepfung = () => {
    setFields(fs => fs.map((f, i) => i === index ? { ...f, kontaktId: null } : f));
  };
  // Objekt verknüpfen: objektId am Feld speichern (value = WEG-Nr als Anzeige).
  const setObjektVerknuepfung = (oid) => {
    const v = (ves || []).find(x => String(x.id) === String(oid));
    setFields(fs => fs.map((f, i) => i === index ? { ...f, objektId: oid || null, value: v ? (v.nr || "") : "" } : f));
  };

  // Sonderfall: Mehrfach-Kontakte → Label oben, darunter mehrere kleine
  // Kontaktkarten (volle Breite). Im Edit-Modus zusätzlich „+ Kontakt"-Picker
  // und je Karte ein Lösen-Button. Im Lese-Modus nur die Karten.
  if (istKontakteMulti) {
    const leer = multiKontakte.length === 0;
    if (!editMode && leer && !field.required && !field.immerSichtbar) return null;
    return (
      <div style={{ padding: "7px 2px", borderBottom: `1px solid ${t.border}40` }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
          <span style={{ fontSize: FS.s, color: t.sub }}>
            {field.name}{field.required && <span style={{ color: "#EF4444" }}>*</span>}
          </span>
          {editMode && !field.required && !field._stamm && (
            <button onClick={() => setFields(f => f.filter((_, i) => i !== index))} style={{
              background: "none", border: "none", cursor: "pointer", padding: 2, marginLeft: "auto",
              opacity: 0.25, transition: "opacity 0.15s" }}
              onMouseEnter={e => e.currentTarget.style.opacity = 0.8}
              onMouseLeave={e => e.currentTarget.style.opacity = 0.25}>
              <I name="trash" size={11} color="#EF4444"/>
            </button>
          )}
        </div>
        {leer && !editMode && (
          <div style={{ fontSize: FS.s, color: t.muted, fontStyle: "italic" }}>—</div>
        )}
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {multiKontakte.map(k => (
            <div key={k.id} style={{ display: "flex", alignItems: "stretch", gap: 6 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <FeldKontaktKarte k={k} t={t} accent={accent}
                  onKontaktClick={onKontaktClick} kontakte={kontakte} setKontakte={setKontakte}/>
              </div>
              {editMode && (
                <button onClick={() => removeMultiKontakt(k.id)} title="Kontakt entfernen" style={{
                  background: "none", border: "none", cursor: "pointer", padding: 4, alignSelf: "center" }}>
                  <I name="x" size={14} color="#EF4444"/>
                </button>
              )}
            </div>
          ))}
        </div>
        {editMode && (
          <div style={{ marginTop: multiKontakte.length > 0 ? 8 : 0 }}>
            <KontaktPicker value={null}
              onChange={(kid) => { if (kid) addMultiKontakt(kid); }}
              label="" t={t} accent={accent} editMode={true}
              kontakte={kontakte} setKontakte={setKontakte}/>
          </div>
        )}
      </div>
    );
  }

  // Sonderfall: Kontakt-Feld im Lese-Modus MIT Verknüpfung → ganze Zeile als
  // Label oben + aufklappbare Kontaktkarte darunter (volle Breite), statt des
  // schmalen „Wert rechts"-Schemas.
  if (istKontakt && !editMode && verknuepft) {
    return (
      <div style={{ padding: "7px 2px", borderBottom: `1px solid ${t.border}40` }}>
        <div style={{ fontSize: FS.s, color: t.sub, marginBottom: 6 }}>
          {field.name}{field.required && <span style={{ color: "#EF4444" }}>*</span>}
        </div>
        <FeldKontaktKarte k={verknuepft} t={t} accent={accent}
          onKontaktClick={onKontaktClick} kontakte={kontakte} setKontakte={setKontakte}/>
      </div>
    );
  }
  // Sonderfall: Objekt-Feld im Lese-Modus MIT Verknüpfung → Label oben +
  // aufklappbare kleine Objektkarte (volle Breite).
  if (istObjekt && !editMode && verknuepftesObjekt) {
    return (
      <div style={{ padding: "7px 2px", borderBottom: `1px solid ${t.border}40` }}>
        <div style={{ fontSize: FS.s, color: t.sub, marginBottom: 6 }}>
          {field.name}{field.required && <span style={{ color: "#EF4444" }}>*</span>}
        </div>
        <FeldObjektKarte ve={verknuepftesObjekt} t={t} accent={accent}
          kontakte={kontakte} onVEClick={onVEClick}/>
      </div>
    );
  }

  // Sonderfall: Notiz-Feld → großes, IMMER beschreibbares Textfeld (auch im
  // Lese-Modus), volle Breite, Muster wie NotizenSektion bei Kontakten.
  if (istNotiz) {
    return (
      <div style={{ padding: "7px 2px", borderBottom: `1px solid ${t.border}40` }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
          <span style={{ fontSize: FS.s, color: t.sub }}>
            {field.name}{field.required && <span style={{ color: "#EF4444" }}>*</span>}
          </span>
          {editMode && !field.required && !field._stamm && (
            <button onClick={() => setFields(f => f.filter((_, i) => i !== index))} style={{
              background: "none", border: "none", cursor: "pointer", padding: 2, marginLeft: "auto",
              opacity: 0.25, transition: "opacity 0.15s" }}
              onMouseEnter={e => e.currentTarget.style.opacity = 0.8}
              onMouseLeave={e => e.currentTarget.style.opacity = 0.25}>
              <I name="trash" size={11} color="#EF4444"/>
            </button>
          )}
        </div>
        <textarea
          value={val || ""}
          onChange={(e) => { setVal(e.target.value); }}
          onBlur={(e) => save2(e.target.value)}
          placeholder="Notizen, Anmerkungen, Erinnerungen…"
          rows={3}
          style={{
            width: "100%", boxSizing: "border-box",
            background: t.surface, border: `1px solid ${t.border}`,
            borderRadius: RAD.ms, padding: "8px 10px",
            fontSize: FS.input, color: t.text, fontFamily: "inherit",
            outline: "none", resize: "vertical", minHeight: 60,
          }}
          onFocus={(e) => e.currentTarget.style.borderColor = accent + "80"}/>
      </div>
    );
  }

  return (
    <div
      style={{ display: "flex", alignItems: "center", gap: 8, padding: "7px 2px",
        borderBottom: `1px solid ${t.border}40`, transition: "background 0.1s", position: "relative" }}>
      <div style={{ minWidth: 112, maxWidth: "62%", fontSize: FS.s, color: t.sub, flexShrink: 0, display: "flex", alignItems: "center" }}>
        <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {field.name}{field.required && <span style={{ color: "#EF4444" }}>*</span>}
        </span>
      </div>
      {istBerechnet ? (
        <span style={{ flex: 1, fontSize: FS.s, color: val ? t.sub : t.muted,
          fontWeight: 400, fontStyle: "italic", textAlign: "right" }}>
          {val || "—"}
        </span>
      ) : istBerechnetOverride ? (
        editMode ? (
          <div style={{ flex: 1, minWidth: 0 }}>
            <input value={val}
              onChange={e => setVal(e.target.value)}
              onBlur={save}
              onKeyDown={e => { if (e.key === "Enter") save(); if (e.key === "Escape") { setVal(field.value || ""); e.currentTarget.blur(); } }}
              inputMode="decimal"
              placeholder={field.berechnet != null && field.berechnet !== "" ? String(field.berechnet) : ""}
              style={{ width: "100%", boxSizing: "border-box", background: t.surface,
                border: `1px solid ${accent}60`, borderRadius: RAD.sm,
                padding: "3px 8px", fontSize: FS.input, color: t.text, outline: "none", fontFamily: "inherit" }}/>
            {field.berechnet != null && field.berechnet !== "" && (
              <div style={{ fontSize: FS.xs, color: t.muted, textAlign: "right", marginTop: 3 }}>
                berechnet: {field.berechnet}{val ? "" : " (wird angezeigt)"}
              </div>
            )}
          </div>
        ) : (
          <span style={{ flex: 1, fontSize: FS.s,
            color: (val || field.berechnet) ? t.text : t.muted,
            fontWeight: (val || field.berechnet) ? 500 : 400, textAlign: "right" }}>
            {val || field.berechnet || "—"}
          </span>
        )
      ) : field.type === "bool" ? (
        <div onClick={() => { if (!editMode) return; const nv = val === "ja" ? "nein" : "ja"; setVal(nv); save2(nv); }} style={{
            width: 30, height: 17, borderRadius: RAD.md,
            background: val === "ja" ? "#10B981" : t.border, position: "relative",
            cursor: editMode ? "pointer" : "default", transition: "background 0.2s",
            marginLeft: "auto" }}>
          <div style={{ width: 13, height: 13, borderRadius: RAD.full, background: "#fff",
            position: "absolute", top: 2, left: val === "ja" ? 15 : 2, transition: "left 0.2s" }}/>
        </div>
      ) : istKontakt ? (
        // Kontakt-Feld: nutzt den überall verwendeten KontaktPicker (Suche,
        // Abbrechen, „Neu anlegen", rotes x ohne Rand). value = verknüpfte
        // kontaktId; onChange(kid)=verknüpfen, onChange(null)=Verknüpfung lösen.
        editMode ? (
          <div style={{ flex: 1, minWidth: 0 }}>
            <KontaktPicker value={field.kontaktId || null}
              onChange={(kid) => { if (kid) setKontaktVerknuepfung(kid); else loeseVerknuepfung(); }}
              label="" t={t} accent={accent} editMode={true}
              kontakte={kontakte} setKontakte={setKontakte}/>
          </div>
        ) : (
          <span onClick={() => { if (verknuepft && onKontaktClick) onKontaktClick(verknuepft.id); }}
            style={{ flex: 1, fontSize: FS.s, color: verknuepft ? accent : (val ? t.text : t.muted),
              fontWeight: val ? 500 : 400, textAlign: "right",
              cursor: verknuepft && onKontaktClick ? "pointer" : "default",
              textDecoration: verknuepft ? "underline" : "none" }}>
            {val || "—"}
          </span>
        )
      ) : istObjekt ? (
        // Objekt-Feld: nutzt den vorhandenen ObjektPicker. value=objektId.
        editMode ? (
          <div style={{ flex: 1, minWidth: 0 }}>
            <ObjektPicker value={field.objektId || ""}
              onChange={(oid) => setObjektVerknuepfung(oid)}
              objekte={ves} t={t} accent={accent}/>
          </div>
        ) : (
          <span onClick={() => { if (verknuepftesObjekt && onVEClick) onVEClick(verknuepftesObjekt.id); }}
            style={{ flex: 1, fontSize: FS.s, color: verknuepftesObjekt ? accent : (val ? t.text : t.muted),
              fontWeight: val ? 500 : 400, textAlign: "right",
              cursor: verknuepftesObjekt && onVEClick ? "pointer" : "default" }}>
            {val || "—"}
          </span>
        )
      ) : istSelect ? (
        editMode ? (
          hatFreitext ? (
            <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 5 }}>
              <select value={freitextModus ? field.freitextBei : val}
                onChange={e => {
                  const sel = e.target.value;
                  if (sel === field.freitextBei) { setFreitextModus(true); setVal(""); save2(""); }
                  else { setFreitextModus(false); setVal(sel); save2(sel); }
                }}
                style={{ width: "100%", boxSizing: "border-box", background: t.surface,
                  border: `1px solid ${accent}60`, borderRadius: RAD.sm,
                  padding: "4px 8px", fontSize: FS.input, color: (freitextModus || val) ? t.text : t.muted,
                  outline: "none", fontFamily: "inherit", appearance: "auto" }}>
                <option value="">— bitte wählen —</option>
                {optionenListe.map((opt, oi) => (<option key={oi} value={opt}>{istZahlAuswahl ? (formatAnteileDE(opt) || opt) : opt}</option>))}
                <option value={field.freitextBei}>{field.freitextBei}</option>
              </select>
              {freitextModus && (field.freitextTyp === "zeitraum" ? (
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <button onClick={() => setZrPicker("von")} style={{
                    flex: 1, minWidth: 0, boxSizing: "border-box", textAlign: "left",
                    background: t.surface, border: `1px solid ${t.border}`, borderRadius: RAD.sm,
                    padding: "5px 8px", fontSize: FS.input, color: zrVon ? t.text : t.muted,
                    cursor: "pointer", fontFamily: "inherit" }}>
                    {zrVon || "Beginn TT.MM."}
                  </button>
                  <span style={{ fontSize: FS.s, color: t.muted, whiteSpace: "nowrap" }}>
                    bis {zrVon ? wirtschaftsjahrEnde(zrVon) : "–"}
                  </span>
                  {zrPicker && (
                    <TagMonatPickerModal
                      startWert={zrVon}
                      titel="Beginn (Tag & Monat)"
                      t={t} accent={accent}
                      onClose={() => setZrPicker(null)}
                      onConfirm={(w) => {
                        setZrVon(w);
                        const ende = wirtschaftsjahrEnde(w);
                        setZrBis(ende);
                        setZrPicker(null);
                        const neu = w ? (w + "–" + ende) : "";
                        setVal(neu);
                        save2(neu);
                      }}/>
                  )}
                </div>
              ) : (
                <input value={(istZahlAuswahl && !freitextFokus) ? (formatAnteileDE(val) || val) : val}
                  onFocus={() => setFreitextFokus(true)}
                  onChange={e => { setVal(e.target.value); }}
                  onBlur={e => {
                    setFreitextFokus(false);
                    const roh = e.target.value;
                    if (field.freitextTyp === "number") {
                      const n = parseAnteile(roh);
                      if (n === null) { save2(""); setVal(""); return; }
                      // Nachkommastellen aus der Eingabe übernehmen.
                      let dez = 0;
                      const mK = String(roh).match(/,(\d+)\s*$/);
                      const mP = String(roh).match(/\.(\d+)\s*$/);
                      if (mK) dez = mK[1].length; else if (mP) dez = mP[1].length;
                      const kanonisch = n.toFixed(dez); // interne Form, z. B. "10000.0000"
                      save2(kanonisch); setVal(kanonisch);
                    } else { save2(roh); }
                  }}
                  inputMode={field.freitextTyp === "number" ? "decimal" : "text"}
                  placeholder={field.freitextTyp === "number" ? "z. B. 10.000,0000" : "Wert eingeben…"}
                  style={{ width: "100%", boxSizing: "border-box", background: t.surface,
                    border: `1px solid ${t.border}`, borderRadius: RAD.sm,
                    padding: "4px 8px", fontSize: FS.input, color: t.text, outline: "none", fontFamily: "inherit" }}/>
              ))}
            </div>
          ) : (
            <select value={val}
              onChange={e => { const nv = e.target.value; setVal(nv); save2(nv); }}
              style={{ flex: 1, minWidth: 0, background: t.surface,
                border: `1px solid ${accent}60`, borderRadius: RAD.sm,
                padding: "4px 8px", fontSize: FS.input, color: val ? t.text : t.muted,
                outline: "none", fontFamily: "inherit", appearance: "auto" }}>
              <option value="">— bitte wählen —</option>
              {optionenListe.map((opt, oi) => (
                <option key={oi} value={opt}>{opt}</option>
              ))}
            </select>
          )
        ) : (
          <span style={{ flex: 1, fontSize: FS.s, color: val ? t.text : t.muted,
            fontWeight: val ? 500 : 400, textAlign: "right" }}>{anzeigeWert || "—"}</span>
        )
      ) : istDatum ? (
        editMode ? (
          <div style={{ flex: 1, minWidth: 0 }}>
            <DatumFeld value={val} t={t} accent={accent} defaultHeute={false} iso
              onChange={(w) => { setVal(w); save2(w); }}/>
            <div style={{ display: "flex", alignItems: "center", gap: 8,
              justifyContent: "flex-end", marginTop: 5 }}>
              <span style={{ fontSize: FS.xs, color: t.muted }}>Im Kalender</span>
              <Toggle value={feldImKalender(field)} color={accent}
                onChange={(v) => setFields(fs => fs.map((f, i) => i === index ? { ...f, imKalender: v } : f))}/>
            </div>
          </div>
        ) : (
          <span style={{ flex: 1, fontSize: FS.s, color: val ? t.text : t.muted,
            fontWeight: val ? 500 : 400, textAlign: "right" }}>{datumAnzeige(val) || "—"}</span>
        )
      ) : istEtvNaechste ? (
        editMode ? (
          <div style={{ flex: 1, minWidth: 0 }}>
            <DatumFeld value={val} t={t} accent={accent} defaultHeute={false} iso
              onChange={(w) => { setVal(w); save2(w); }}/>
          </div>
        ) : (
          <span style={{ flex: 1, fontSize: FS.s, color: etvAnzeigeFarbe || (val ? t.text : t.muted),
            fontWeight: 500, textAlign: "right" }}>{etvAnzeigeText}</span>
        )
      ) : istLegionellen ? (
        <LegionellenFeldInhalt field={field} index={index} t={t} accent={accent}
          editMode={editMode} setFields={setFields}/>
      ) : editMode ? (
        <input value={val} onChange={e => setVal(e.target.value)}
          onBlur={save} onKeyDown={e => { if (e.key === "Enter") save(); if (e.key === "Escape") { setVal(field.value || ""); e.currentTarget.blur(); } }}
          type={field.type === "number" ? "number" : "text"}
          style={{ flex: 1, minWidth: 0, background: t.surface,
            border: `1px solid ${accent}60`, borderRadius: RAD.sm,
            padding: "3px 8px", fontSize: FS.input, color: t.text, outline: "none", fontFamily: "inherit" }}/>
      ) : (
        <span style={{ flex: 1, fontSize: FS.s, color: val ? t.text : t.muted,
          fontWeight: val ? 500 : 400, textAlign: "right" }}>{val || "—"}</span>
      )}
      {editMode && !field.required && !field._stamm && !istBerechnet && (
        <button onClick={() => setFields(f => f.filter((_, i) => i !== index))} style={{
          background: "none", border: "none", cursor: "pointer", padding: 2,
          opacity: 0.25, transition: "opacity 0.15s" }}
          onMouseEnter={e => e.currentTarget.style.opacity = 0.8}
          onMouseLeave={e => e.currentTarget.style.opacity = 0.25}>
          <I name="trash" size={11} color="#EF4444"/>
        </button>
      )}
    </div>
  );
}

// ── AddFieldModal mit Typ-Erkennung (aus liegenschaft-komplett, ?. entfernt) ─
function AddFieldModal({ t, accent, kategorie, onAdd, onClose, ohneVorschlaege = false }) {
  const [name, setName] = useState("");
  // Anlege-Typ-ID (aus ANLEGE_FELDTYPEN): text/number/date/janein/select/kontakt/objekt
  const [anlegeTyp, setAnlegeTyp] = useState("text");
  const [optionenText, setOptionenText] = useState(""); // für „Auswahl": Komma-getrennt
  // „Im Kalender anzeigen" (nur Datum-Felder): Heuristik als Vorbelegung,
  // bis der Schalter einmal angefasst wurde — dann zählt nur noch der Schalter.
  const [imKalender, setImKalender] = useState(false);
  const [imKalenderTouched, setImKalenderTouched] = useState(false);
  const kalEff = imKalenderTouched ? imKalender : istFristFeldName(name);
  const sugg = SUGGESTIONS[kategorie] || SUGGESTIONS.gebaeude;

  // Übersetzt den Anlege-Typ in die tatsächliche Feld-Definition (ohne Wert —
  // der wird erst im angelegten Feld eingegeben).
  const baueFeld = () => {
    const basis = { id: Date.now(), name: name.trim(), value: "" };
    if (anlegeTyp === "janein") return { ...basis, type: "select", optionen: ["Ja", "Nein"] };
    if (anlegeTyp === "date") return { ...basis, type: "date", imKalender: kalEff };
    if (anlegeTyp === "select") {
      const opts = optionenText.split(",").map(s => s.trim()).filter(Boolean);
      return { ...basis, type: "select", optionen: opts };
    }
    if (anlegeTyp === "kontakt") return { ...basis, type: "kontakt", kontaktId: null };
    if (anlegeTyp === "kontakte") return { ...basis, type: "kontakte", kontaktIds: [] };
    if (anlegeTyp === "objekt")  return { ...basis, type: "objekt", objektId: null };
    return { ...basis, type: anlegeTyp }; // text/number/date
  };

  const optionenListe = optionenText.split(",").map(s => s.trim()).filter(Boolean);
  const darfAnlegen = name.trim() && (anlegeTyp !== "select" || optionenListe.length >= 2);

  return (
    <div style={{ position: "fixed", top: 0, right: 0, bottom: 0, left: 0, background: "rgba(0,0,0,0.65)",
      zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div style={{ background: t.card, border: `1px solid ${t.border}`,
        borderRadius: RAD.xl, width: "100%", maxWidth: 440, overflow: "hidden",
        boxShadow: "0 20px 60px rgba(0,0,0,0.5)" }}>
        <div style={{ padding: "12px 16px", borderBottom: `1px solid ${t.border}`,
          display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
            <I name="plus" size={13} color={accent}/>
            <span style={{ fontSize: FS.l, fontWeight: FW.bold, color: t.text }}>Neues Feld anlegen</span>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer" }}>
            <I name="x" size={15} color={t.sub}/>
          </button>
        </div>
        <div style={{ padding: "14px 16px" }}>
          {/* Vorschläge — in der Verwaltung ausgeblendet (ohneVorschlaege) */}
          {!ohneVorschlaege && (
          <div style={{ marginBottom: 12 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 7 }}>
              <I name="sparkles" size={11} color={accent}/>
              <span style={{ fontSize: FS.xs, fontWeight: FW.bold, color: accent,
                letterSpacing: "0.1em", textTransform: "uppercase" }}>Vorschläge</span>
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
              {sugg.map((s, i) => (
                <button key={i} onClick={() => {
                    setName(s.name);
                    // bool-Vorschläge auf Ja/Nein-Auswahl abbilden; select-Vorschläge
                    // belegen die Optionsliste vor (bleibt vor dem Speichern editierbar).
                    if (s.type === "bool") setAnlegeTyp("janein");
                    else if (s.type === "select" && Array.isArray(s.optionen)) {
                      setAnlegeTyp("select");
                      setOptionenText(s.optionen.join(", "));
                    }
                    else if (["text","number","date"].indexOf(s.type) >= 0) setAnlegeTyp(s.type);
                  }} style={{
                    background: name === s.name ? accent + "20" : t.surface,
                    border: `1px solid ${name === s.name ? accent + "60" : t.border}`,
                    borderRadius: RAD.ms, padding: "4px 9px", cursor: "pointer", fontSize: FS.s,
                    color: name === s.name ? accent : t.sub,
                    display: "flex", alignItems: "center", gap: 4, fontFamily: "inherit" }}>
                  {s.name}
                </button>
              ))}
            </div>
          </div>
          )}
          <Inp label="Feldname" value={name} onChange={setName}
            placeholder="z.B. Umbaujahr, Legionellenprüfung..." t={t} accent={accent} required/>
          <div style={{ marginBottom: 12 }}>
            <label style={{ fontSize: FS.s, fontWeight: FW.medium, color: t.sub,
              display: "block", marginBottom: 6 }}>Feldtyp</label>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 5 }}>
              {ANLEGE_FELDTYPEN.map(ft2 => (
                <button key={ft2.id} onClick={() => setAnlegeTyp(ft2.id)} style={{
                  background: anlegeTyp === ft2.id ? accent + "20" : t.surface,
                  border: `1.5px solid ${anlegeTyp === ft2.id ? accent : t.border}`,
                  borderRadius: RAD.ms, padding: "7px 4px", cursor: "pointer",
                  display: "flex", flexDirection: "column", alignItems: "center", gap: 3,
                  fontFamily: "inherit" }}>
                  <span style={{ fontSize: FS.l }}>{ft2.icon}</span>
                  <span style={{ fontSize: FS.xxs, fontWeight: FW.medium,
                    color: anlegeTyp === ft2.id ? accent : t.muted }}>{ft2.label}</span>
                </button>
              ))}
            </div>
          </div>
          {/* Optionen-Eingabe nur für „Auswahl" */}
          {anlegeTyp === "select" && (
            <div style={{ marginBottom: 12 }}>
              <label style={{ fontSize: FS.s, fontWeight: FW.medium, color: t.sub, display: "block", marginBottom: 4 }}>
                Optionen <span style={{ color: t.muted, fontWeight: FW.regular }}>(durch Komma getrennt)</span>
              </label>
              <input value={optionenText} onChange={e => setOptionenText(e.target.value)}
                placeholder="z.B. Niedrig, Mittel, Hoch"
                style={{ width: "100%", boxSizing: "border-box", background: t.surface,
                  border: `1px solid ${optionenListe.length >= 2 ? t.border : "#EF4444"}`, borderRadius: RAD.ms,
                  padding: "7px 10px", fontSize: FS.input, color: t.text, outline: "none", fontFamily: "inherit" }}/>
              {optionenListe.length < 2 && (
                <div style={{ fontSize: FS.xs, color: "#EF4444", marginTop: 3 }}>
                  Mindestens zwei Optionen angeben.
                </div>
              )}
            </div>
          )}
          {anlegeTyp === "date" && (
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12,
              background: accent + "0C", border: `1px solid ${accent}25`, borderRadius: RAD.md, padding: "8px 12px" }}>
              <I name="calendar" size={12} color={accent}/>
              <span style={{ fontSize: FS.s, color: t.sub, flex: 1 }}>Im Kalender anzeigen</span>
              <Toggle value={kalEff} color={accent}
                onChange={(v) => { setImKalender(v); setImKalenderTouched(true); }}/>
            </div>
          )}
          {anlegeTyp === "janein" && (
            <div style={{ fontSize: FS.s, color: t.sub, marginBottom: 12,
              background: accent + "0C", border: `1px solid ${accent}25`, borderRadius: RAD.md, padding: "8px 12px" }}>
              Auswahl „Ja" / „Nein" – solange nichts gewählt ist, bleibt das Feld offen.
            </div>
          )}
          {anlegeTyp === "kontakt" && (
            <div style={{ fontSize: FS.s, color: t.sub, marginBottom: 12,
              background: accent + "0C", border: `1px solid ${accent}25`, borderRadius: RAD.md, padding: "8px 12px" }}>
              Verknüpfung zu einer Person oder Firma (Kontakt-Picker).
            </div>
          )}
          {anlegeTyp === "kontakte" && (
            <div style={{ fontSize: FS.s, color: t.sub, marginBottom: 12,
              background: accent + "0C", border: `1px solid ${accent}25`, borderRadius: RAD.md, padding: "8px 12px" }}>
              Mehrere Kontakte (Personen/Firmen) verknüpfen – einzeln hinzufügen und entfernen.
            </div>
          )}
          {anlegeTyp === "objekt" && (
            <div style={{ fontSize: FS.s, color: t.sub, marginBottom: 12,
              background: accent + "0C", border: `1px solid ${accent}25`, borderRadius: RAD.md, padding: "8px 12px" }}>
              Verknüpfung zu einem Objekt (Objekt-Picker).
            </div>
          )}
          <div style={{ display: "flex", gap: 8 }}>
            <AktionsButton variante="breit" rolle="abbrechen" onClick={onClose}
              text="Abbrechen" icon={false} flex={1} t={t} accent={accent}/>
            <AktionsButton variante="breit" rolle="bestaetigen"
              disabled={!darfAnlegen}
              onClick={() => {
                if (!darfAnlegen) return;
                onAdd(baueFeld());
                onClose();
              }}
              text="Feld anlegen" icon={false} flex={2} t={t} accent={accent}/>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── FieldList (Drag&Drop, Gesamtfläche, Eigenes Feld) ──────────────────────
function FieldList({ fields, setFields, t, accent, editMode, kategorie, ohneVorschlaege = false,
  kontakte = [], setKontakte = null, onKontaktClick = null, ves = [], onVEClick = null,
  etvStamm = null, onSyncChange = null }) {
  const [showModal, setShowModal] = useState(false);
  const flaechen = fields.filter(f => f.type === "number"
    && f.name.toLowerCase().includes("fläche") && f.value);
  const gesamt = flaechen.reduce((s, f) => s + (parseFloat((f.value + "").replace(",", ".")) || 0), 0);

  // Grundprinzip „weniger ist mehr": Felder mit leerem Wert werden im Lese-Modus
  // ausgeblendet. Im Bearbeiten-Modus immer sichtbar (zum Befüllen). Ausnahmen,
  // die auch leer sichtbar bleiben: required oder explizit immerSichtbar gesetzt.
  const istLeer = (f) => {
    // Notiz-Feld ist immer beschreibbar → muss auch leer immer sichtbar bleiben.
    if (f.type === "notiz") return false;
    // Nächste-ETV-Feld zeigt immer mindestens den Jahres-Hinweis.
    if (f.type === "etv_naechste") return false;
    // Legionellen-Feld bleibt sichtbar (Pflicht-Charakter je Objekt).
    if (f.type === "legionellen") return false;
    // Berechnet-mit-Override: zeigt immer mindestens den berechneten Wert.
    if (f.type === "berechnet_override") return false;
    // Kontakt-Feld mit Verknüpfung gilt als befüllt (Name wird abgeleitet).
    if (f.type === "kontakt" && f.kontaktId) return false;
    // Mehrfach-Kontakte mit mindestens einem Eintrag gelten als befüllt.
    if (f.type === "kontakte" && Array.isArray(f.kontaktIds) && f.kontaktIds.length > 0) return false;
    // Objekt-Feld mit Verknüpfung gilt als befüllt.
    if (f.type === "objekt" && f.objektId) return false;
    const v = f.value;
    if (v === 0) return false; // 0 ist ein Wert
    return v === undefined || v === null || (typeof v === "string" && v.trim() === "");
  };
  const sichtbareFelder = editMode
    ? fields
    : fields.filter(f => !istLeer(f) || f.required || f.immerSichtbar);
  // Indizes auf das Originalarray merken, damit setFields/FieldRow korrekt schreibt.
  const sichtbareMitIndex = [];
  fields.forEach((f, i) => {
    if (editMode || !istLeer(f) || f.required || f.immerSichtbar) sichtbareMitIndex.push({ f, i });
  });
  // Im Edit-Modus: befüllte Felder behalten ihre Reihenfolge (= identisch zum
  // Lese-Modus), leere optionale Felder wandern stabil ans Ende — so „springt"
  // die Struktur zwischen Lesen und Bearbeiten nicht, leere Felder bleiben aber
  // befüllbar. Pflicht-/immerSichtbar-Felder zählen als „oben\". Stabil: Original-
  // Reihenfolge innerhalb jeder Gruppe bleibt erhalten (Index i als Tiebreaker).
  if (editMode) {
    const istUntenKandidat = (f) => istLeer(f) && !f.required && !f.immerSichtbar;
    sichtbareMitIndex.sort((a, b) => {
      const ua = istUntenKandidat(a.f) ? 1 : 0;
      const ub = istUntenKandidat(b.f) ? 1 : 0;
      if (ua !== ub) return ua - ub;
      return a.i - b.i;
    });
  }

  // Wirtschaftsjahr-Wert (für den Nächste-ETV-Status): bei Sync aus der
  // gemeinsamen Quelle, sonst aus dem Zeitraum-Feld der Karte.
  const wjFeld = fields.find(f => f && f.type === "select" && f.freitextTyp === "zeitraum");
  const wjWert = (etvStamm && etvStamm.wirtschaftsjahr != null && etvStamm.wirtschaftsjahr !== "")
    ? etvStamm.wirtschaftsjahr
    : (wjFeld ? wjFeld.value : "");

  // Automatisches Umspringen beim Laden/Öffnen: Ist im Feld „Nächste ETV" ein
  // konkretes Datum eingetragen, das VOR dem laufenden Wirtschaftsjahr-Ende lag
  // UND dessen Wirtschaftsjahr inzwischen abgelaufen ist, wandert das Datum nach
  // „Letzte ETV" und „Nächste ETV" wird geleert (zeigt dann das neue Ablaufjahr).
  // Einmalig pro Mount; nur wenn die Karte beide ETV-Felder besitzt.
  useEffect(() => {
    const idxNaechste = fields.findIndex(f => f && f.type === "etv_naechste");
    const idxLetzte = fields.findIndex(f => f && f.name === "Letzte ETV");
    if (idxNaechste < 0) return;
    const naechste = fields[idxNaechste];
    if (!naechste || !naechste.value) return;
    const d = parseDatumWert(naechste.value);
    if (!d) return;
    // Ende des Wirtschaftsjahres, zu dem dieses Datum gehörte (das letzte WJ-Ende,
    // das vor heute liegt). Wenn das Datum vor diesem Ende lag → WJ abgelaufen.
    const jetzt = new Date();
    const ende = wjEndeDatum(wjWert, jetzt);
    const letztesEnde = new Date(ende.getTime());
    letztesEnde.setFullYear(letztesEnde.getFullYear() - 1);
    if (d.getTime() <= letztesEnde.getTime()) {
      setFields(fs => fs.map((f, i) => {
        if (i === idxNaechste) return { ...f, value: "" };
        if (i === idxLetzte) return { ...f, value: naechste.value };
        return f;
      }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div>
      {sichtbareMitIndex.map(({ f, i }) => (
        <FieldRow key={f.id || i} field={f} index={i} t={t} accent={accent}
          editMode={editMode} setFields={setFields}
          kontakte={kontakte} setKontakte={setKontakte} onKontaktClick={onKontaktClick}
          ves={ves} onVEClick={onVEClick} wjWert={wjWert}
          etvStamm={etvStamm} onSyncChange={onSyncChange}/>
      ))}
      {flaechen.length > 1 && (
        <div style={{ display: "flex", alignItems: "center", gap: 8,
          padding: "6px 2px", borderBottom: `1px solid ${t.border}40` }}>
          <I name="calc" size={12} color="#0EA5C9"/>
          <span style={{ fontSize: FS.s, color: "#0EA5C9", flex: 1 }}>Gesamtfläche (berechnet)</span>
          <span style={{ fontSize: FS.s, fontWeight: FW.bold, color: "#0EA5C9" }}>{gesamt.toFixed(1)} m²</span>
        </div>
      )}
      {editMode && (
        <button onClick={() => setShowModal(true)} style={{
          marginTop: 8, width: "100%", display: "flex", alignItems: "center", gap: 6,
          background: "none", border: `1px dashed ${t.border}`,
          borderRadius: RAD.ms, padding: "6px 0", cursor: "pointer",
          justifyContent: "center", color: t.muted, fontSize: FS.s, transition: "all 0.15s",
          fontFamily: "inherit" }}
          onMouseEnter={e => { e.currentTarget.style.borderColor = accent + "70"; e.currentTarget.style.color = accent; }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = t.border; e.currentTarget.style.color = t.muted; }}>
          <I name="plus" size={11} color="currentColor"/>Eigenes Feld hinzufügen
        </button>
      )}
      {showModal && (
        <AddFieldModal t={t} accent={accent} kategorie={kategorie} ohneVorschlaege={ohneVorschlaege}
          onAdd={f => setFields(v => [...v, f])} onClose={() => setShowModal(false)}/>
      )}
    </div>
  );
}

// KopfPille — KANONISCHER Segment-Umschalter im Screen-Kopf (§73). Genau der
// Kalender-Stil: EINE umschließende Kapsel (RAD.pill, t.surface-BG, 1px border),
// darin randlose Buttons, der aktive ausgefüllt in accent. Vorbild war der
// Kalender-Umschalter „Objekte | Timeline"; jetzt EINE Quelle für ALLE Screens
// (Kalender, Statistik, Listengenerator, Vorgänge), damit nichts auseinanderläuft.
// optionen = [{ id, label }]; aktiv = id; onWaehle(id).
function KopfPille({ t, accent, optionen, aktiv, onWaehle }) {
  return (
    <div style={{ display: "flex", gap: 2, padding: 2, borderRadius: RAD.pill,
      background: t.surface, border: `1px solid ${t.border}`, flexShrink: 0 }}>
      {optionen.map(o => (
        <button key={o.id} onClick={() => onWaehle(o.id)}
          style={{ padding: "5px 12px", borderRadius: RAD.pill, cursor: "pointer",
            fontFamily: "inherit", fontSize: FS.s, fontWeight: FW.bold, border: "none",
            background: aktiv === o.id ? accent : "transparent",
            color: aktiv === o.id ? getContrastColor(accent) : t.sub }}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

// ScreenKopf — KANONISCHER Screen-Kopf (§73). EIN Baustein für ALLE Screen-Köpfe
// (Objekte, Kontakte, Vorgänge, Statistik, Listengenerator, Schnelleingabe, …),
// damit Titel-Höhe, Abstände und Button-Position NIE wieder je Screen auseinander-
// laufen. Wrapper-Schema ist hier FEST verdrahtet — Screens dürfen kein eigenes
// padding/flexWrap mehr dazusetzen:
//   • StickySectionHeader liefert die symmetrischen 8/8-Abstände → Titel sitzt
//     überall gleich hoch.
//   • innerer Wrapper: flex, alignItems:center, width:100% → marginLeft:auto am
//     rechts-Slot wirkt garantiert (Button sitzt überall ganz rechts).
//   • KEIN flexWrap (würde Höhe ändern → Titel „springt").
// Slots:
//   titel  — String oder Node (groß, FW.heavy). Optional onTitelClick (z.B. „alle
//            anzeigen").
//   mitte  — neben dem Titel: KopfPille / FilterButtons (optional).
//   rechts — Plus-/Zurück-Button (optional). Bekommt automatisch marginLeft:auto.
// HeaderZurueck — kanonischer „Zurück"-Button für den ScreenKopf-rechts-Slot.
// EIN Baustein für ALLE Screens (Objekte/Kontakte/Bereichskacheln/Statistik/
// Listengen/Schnelleingabe/Aufträge/Kalender). Ersetzt die früheren ~12
// handkopierten Inline-Buttons. Kein Pfeil (DESIGN: kein Chevron an Text-/
// Zurück-Buttons). data-kb-zurueck=1 für die Tastatur-Navigation.
// HeaderPlus — kanonischer „+"-Button (Neu-Anlegen) für den ScreenKopf-rechts-
// Slot. EIN Baustein für Objekte/Kontakte/Kalender. Der Kalender nutzt icon="x"
// im Toggle-Zustand. Ersetzt die früheren handkopierten 36×36-Kreis-Buttons.
function HeaderPlus({ onClick, accent, icon = "plus", title = "Neu", t }) {
  return (
    <button onClick={onClick} data-kb-neu="1" title={title} aria-label={title}
      style={{ display: "flex", alignItems: "center", justifyContent: "center",
        width: 36, height: 36, flexShrink: 0,
        background: accent, border: "none",
        borderRadius: RAD.pill, cursor: "pointer",
        boxShadow: `0 1px 2px ${accent}40` }}>
      <I name={icon} size={16} color={getContrastColor(accent)}/>
    </button>
  );
}

function HeaderZurueck({ onClick, label = "Zurück", t }) {
  return (
    <button onClick={onClick} data-kb-zurueck="1"
      title={label} aria-label={label}
      style={{ display: "flex", alignItems: "center",
        background: "none", border: `1px solid ${t.border}`, color: t.text,
        borderRadius: RAD.ms, padding: "0 12px", height: 36, boxSizing: "border-box",
        cursor: "pointer", fontFamily: "inherit", fontSize: FS.m, fontWeight: FW.medium,
        flexShrink: 0 }}>
      {label}
    </button>
  );
}

function ScreenKopf({ t, accent, titel, titelAktiv = true, onTitelClick = null,
  mitte = null, rechts = null }) {
  const titelNode = (typeof titel === "string") ? (
    <div onClick={onTitelClick || undefined}
      title={onTitelClick ? "Alle anzeigen" : undefined}
      style={{ fontSize: FS.xxl, fontWeight: FW.heavy,
        color: titelAktiv ? t.text : t.sub,
        cursor: onTitelClick ? "pointer" : "default",
        userSelect: "none", transition: "color 0.15s",
        whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
      {titel}
    </div>
  ) : titel;

  // Titel + Bedienelemente in EINER Zeile, ohne Umbruch. Wird der Titel zu lang,
  // schweben die rechten Bedienelemente (mitte+rechts) über dem Titelende: sie
  // liegen absolut rechts mit einem t.bg→transparent-Verlauf, der den Titel weich
  // ausblendet statt hart abzuschneiden oder umzubrechen. Bei kurzen Titeln liegt
  // der Verlauf über leerem Raum und ist unsichtbar. Zentral hier → alle Screens
  // (Listengenerator, Schnelleingabe, Statistik …) erben dasselbe Verhalten (§76).
  const hatRechts = mitte != null || rechts != null;
  return (
    <StickySectionHeader t={t} accent={accent}>
      <div style={{ position: "relative", display: "flex", alignItems: "center",
        width: "100%", minWidth: 0 }}>
        <div style={{ flex: 1, minWidth: 0, display: "flex", alignItems: "center", gap: 10 }}>
          {titelNode}
        </div>
        {hatRechts && (
          <div style={{ position: "absolute", top: 0, bottom: 0, right: 0,
            display: "flex", alignItems: "center", gap: 8, flexShrink: 0,
            paddingLeft: 32,
            background: `linear-gradient(to right, ${t.bg}00 0%, ${t.bg} 24px, ${t.bg} 100%)` }}>
            {mitte}
            {rechts}
          </div>
        )}
      </div>
    </StickySectionHeader>
  );
}

// DetailRahmen — KANONISCHER Detail-Rahmen (§73): die gerahmte Box, in der jeder
// Master-Detail-Screen seinen Detail-Inhalt zeigt. Identisch zum Rahmen in
// ObjektListeMitDetail (accent+"08"-BG, 1px solid accent, RAD.lg, Padding) plus
// optionalem Kopf (titel groß in accent, sub klein). So sehen ALLE Detailfenster
// gleich aus — Statistik, Listengenerator, Schnelleingabe, Vorgänge.
// DetailRahmen — kanonischer Detail-Kopf für ALLE Detail-Ansichten (§77).
// Aufbau verbindlich: Nummer (titel, groß, Akzent) + Adresse (sub, klein, WEISS)
// in EINER Zeile, baseline-ausgerichtet; Adresse wird bei Platzmangel mit … ge-
// kürzt, die Nummer bleibt immer ganz. Optionaler aktion-Slot rechts (z. B. der
// Edit-Stift bei Objekten). Wer einen Detail-Kopf braucht, nutzt DIESEN Baustein
// und baut ihn NICHT selbst nach — neue Kacheln/Bereiche erben damit dieselbe
// Kopf-Optik automatisch.
// ── DetailKopf — die EINE Detail-Titelzeile (§76) ───────────────────────────
// VE-Nummer groß/Akzent + Adresse klein/weiß (kürzt mit …) links, Aktions-Slot
// (Stift bzw. X+Haken) rechts. Jeder Detail-/Vollbild-Screen (Objekt, Schnell-
// eingabe, künftige Bereiche) nutzt DIESEN Kopf und baut ihn NICHT selbst nach.
// onTitelClick: optional (z. B. Mobil-Header → Zurück bei Klick auf den Titel).
function DetailKopf({ t, accent, titel = null, sub = null, aktion = null, onTitelClick = null, marginBottom = 14 }) {
  if (titel == null && aktion == null) return null;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom, minWidth: 0 }}>
      <div onClick={onTitelClick || undefined}
        style={{ flex: 1, minWidth: 0, display: "flex", alignItems: "baseline",
          gap: 10, overflow: "hidden", cursor: onTitelClick ? "pointer" : "default" }}>
        {(titel != null) && (
          <span style={{ fontSize: FS.xxl, fontWeight: FW.heavy, color: accent,
            lineHeight: 1.1, whiteSpace: "nowrap", flexShrink: 0 }}>{titel}</span>
        )}
        {(sub != null) && (
          <span style={{ fontSize: FS.s, color: t.text, minWidth: 0,
            overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{sub}</span>
        )}
      </div>
      {(aktion != null) && (
        <div style={{ flexShrink: 0, display: "flex", alignItems: "center", gap: 6 }}>{aktion}</div>
      )}
    </div>
  );
}

// ── Objekt-Kopf — DIE kanonische Quelle für „VE-Nr + Anschrift" (§76) ────────
// Vorher rief jeder Detail-Screen DetailKopf bzw. DetailRahmen einzeln mit
// titel={ve.nr} sub={ve.adresse} auf (Schnelleingabe, Objekt-Detail, VE-Detail,
// Kalender, Listengenerator, Statistik) → fünf verstreute Stellen, der
// Listengenerator vergaß ihn ganz. Jetzt liegt das Format an EINER Stelle.
//
// objektKopfProps(ve): liefert { titel, sub } für Stellen, die einen
//   DetailRahmen mit titel/sub befüllen (Rahmen rendert den Kopf intern).
// ObjektDetailKopf: rendert den Kopf direkt (für Stellen ohne DetailRahmen-Kopf).
function objektKopfProps(ve) {
  if (!ve) return { titel: null, sub: null };
  return { titel: ve.nr || "Objekt", sub: ve.adresse || null };
}
function ObjektDetailKopf({ t, accent, ve, aktion = null, onTitelClick = null, marginBottom = 14 }) {
  const p = objektKopfProps(ve);
  return (
    <DetailKopf t={t} accent={accent} titel={p.titel} sub={p.sub}
      aktion={aktion} onTitelClick={onTitelClick} marginBottom={marginBottom}/>
  );
}

function DetailRahmen({ t, accent, titel = null, sub = null, aktion = null, children }) {
  const hatKopf = titel != null || aktion != null;
  return (
    <div style={{ background: accent + "08", border: `1px solid ${accent}`,
      borderRadius: RAD.lg, padding: "14px 16px",
      boxSizing: "border-box", width: "100%", minWidth: 0, overflowWrap: "anywhere" }}>
      {hatKopf && (
        <DetailKopf t={t} accent={accent} titel={titel} sub={sub} aktion={aktion}/>
      )}
      {children}
    </div>
  );
}

// ── MasterDetailRahmen — DAS kanonische Master-Detail-Gerüst (§73/§75) ───────
// EIN Baustein für ALLE Screens, die ihr Master-Detail selbst aufbauen
// (Schnelleingabe, Listengenerator, Statistik, Vorgänge, Kalender-Timeline).
// Vorher baute jeder Screen sein eigenes flex-row-Gerüst mit eigener Breiten-
// rechnung und eigenem Detail-Platzhalter → drei verschiedene Breiten trotz
// „Liste-Modus überall gleich". Jetzt schreiben alle ihre Liste + ihr Detail
// hier rein, das Gerüst ist identisch.
//
// VERBINDLICHE Liste-Modus-Regel (Benny v12.57): im Liste-Modus richtet sich die
// Master-Breite NUR nach den Liste-Slidern (listeOpt), Karten kommen nicht vor.
// OHNE offenes Detail wird RECHTS NICHTS reserviert — die schmale Liste steht
// allein links, der Rest bleibt leer (wie Objekte/Kontakte). Erst mit Auswahl
// erscheint das Detail rechts.
//
// Props:
//   master      = React-Node: die Master-Liste (Buckets/flache Liste, egal)
//   detail      = React-Node | null: der Detail-Inhalt (null = keine Auswahl)
//   istDesktop  = bool
//   listenAnsicht, listeOpt, kartenSpalten, kartenMaxBreite, kartenMin,
//   detailMinBreite, detailMin = Layout-Parameter (wie an die Screens gereicht)
//   gap         = Abstand Master↔Detail (default 20)
//   mobilDetail = React-Node für den Mobil-Detail-Pfad (default = detail)
function MasterDetailRahmen({ master, detail = null, istDesktop = true,
  listenAnsicht = "karten", listeOpt = null, kartenSpalten = 2,
  kartenMaxBreite = 340, kartenMin = 272, detailMinBreite = 540, detailMin = null,
  gap = 10, mobilDetail = undefined, onNurDetail = null, t = null,
  uebersichtBreite = "voll" }) {
  const [contentRef, contentW] = useContentWidth();
  const istListe = listenAnsicht === "liste";
  const hatDetail = detail != null;
  // Auf Mobil NIE den 1200px-Desktop-Fallback nutzen: solange die echte Breite
  // (contentW) noch nicht gemessen ist (erster Render = 0), würde verf=1200 in
  // passendeMasterSpalten ZWEI Spalten ergeben → zweispaltiges Grid auf fiktiver
  // 1200px-Breite → horizontaler Overflow (Querscroll) am Handy. Mobil rechnet
  // ausschließlich einspaltig; Desktop behält den Fallback bis zur Messung.
  const verf = contentW || (istDesktop
    ? Math.max(1200, detailMinBreite + kartenMaxBreite + 80)
    : 360);
  const layoutRaw = istDesktop
    ? passendeMasterSpalten(verf, kartenSpalten, kartenMaxBreite,
        kartenMin, detailMinBreite, gap, detailMin, istListe ? listeOpt : null)
    // MOBIL: immer genau EINE Spalte, volle Breite (das --ad-kg:1fr-Grid greift).
    : { cols: 1, kartenBreite: 0, masterBreite: 0, detailBreite: verf };
  // nurMaster = Übersicht ohne offenes Detail → der Master nutzt die VOLLE Breite
  // und das Grid füllt per auto-fill so viele Spalten wie passen,
  // statt auf die feste Master-neben-Detail-Spaltenzahl begrenzt zu sein. Die
  // master-Funktion liest layout.nurMaster, um das passende Grid zu wählen.
  // kartenMaxBreite/kartenMin werden mitgegeben, damit das auto-fill-Grid
  // dieselbe Kartenbreite nutzt wie der Detail-Fall (sonst laufen die Breiten
  // auseinander: Übersicht 340 vs Detail-Fall die eingestellte Breite).
  const layout = { ...layoutRaw, nurMaster: !hatDetail,
    kartenMaxBreite, kartenMin, einspaltig: !istDesktop };
  const masterBreite = layout.masterBreite;
  const detailBreite = layout.detailBreite || detailMinBreite;
  // master darf Node ODER Funktion(layout) sein — so kann die Master-Liste im
  // Karten-Modus die berechneten Spalten/Kartenbreite nutzen (layout.cols /
  // layout.kartenBreite), ohne dass der Screen selbst rechnet.
  const masterNode = (typeof master === "function") ? master(layout) : master;

  // Der Baustein meldet dem Screen, ob die Liste gerade ganz weg ist (Mobil ODER
  // Desktop so eng, dass nur das Detail bleibt). So kann der Screen seinen
  // „Zurück"-Button an der richtigen Stelle (eigene Header-Zeile, rechts) zeigen
  // — der Baustein baut KEINEN eigenen Button (kein Pfeil, keine eigene Leiste).
  const nurDetail = hatDetail && (!istDesktop || layout.cols === 0);
  useEffect(() => {
    if (typeof onNurDetail === "function") onNurDetail(nurDetail);
  }, [nurDetail, onNurDetail]);

  // MOBIL: Detail ersetzt die Liste (Detail offen → nur Detail, sonst nur Liste).
  // KEIN horizontales Padding hier — die Karten sollen wie im Kontakte-Vollbild
  // bis zum Rand laufen (sonst minimal schmaler als andere Screens).
  if (!istDesktop) {
    const md = mobilDetail !== undefined ? mobilDetail : detail;
    if (hatDetail && md != null) {
      return (
        <div data-ad-scroll="y" data-ad-auslauf="1" style={{ flex: 1, minHeight: 0,
          minWidth: 0, width: "100%", overflowY: "auto", padding: "8px 0",
          boxSizing: "border-box" }}>
          {md}
        </div>
      );
    }
    return (
      <div data-ad-scroll="y" style={{ flex: 1, minHeight: 0, minWidth: 0,
        width: "100%", overflowY: "auto", padding: "8px 0", boxSizing: "border-box" }}>
        {masterNode}
      </div>
    );
  }

  // DESKTOP: Master links (feste Breite), Detail NUR bei Auswahl rechts.
  // DESKTOP: Vier Fälle —
  //   A) Detail offen, cols>0:  Master (feste Breite masterBreite) links, Detail rechts.
  //   B) Detail offen, cols=0:  Nur-Detail (Master weicht ganz) — sehr enges Fenster.
  //   C) kein Detail:           Master über VOLLE Breite (Übersicht). Das Grid
  //                             füllt per auto-fill so viele Spalten wie passen —
  //                             NICHT auf masterBreite begrenzen, sonst werden die
  //                             Karten abgeschnitten.
  if (layout.cols === 0 && hatDetail) {
    return (
      <div ref={contentRef} data-ad-scroll="y" data-ad-auslauf="1" style={{ flex: 1, minHeight: 0,
        minWidth: 0, width: "100%", overflowY: "auto", padding: "8px 0", boxSizing: "border-box" }}>
        {detail}
      </div>
    );
  }
  if (!hatDetail) {
    // Karten-Modus: volle Breite (auto-fill füllt sie). Liste-Modus: Liste auf
    // die eingestellte Listenbreite begrenzen — sonst zieht sie über die ganze
    // Breite. Das gehört in den Baustein, damit ALLE Screens es gleich machen.
    // uebersichtBreite="master" (z. B. Kalender-Timeline): einspaltige Zeilen-
    // liste — KEIN auto-fill-Grid. Auf die Breite von genau kartenSpalten Karten
    // begrenzen. WICHTIG: die Kontakte-/Objekte-Übersicht rendert ihre Karten mit
    // dem durchgereichten kartenMaxBreite (Settings-Wert). GENAU diesen Wert hier
    // verwenden — sonst wird die Timeline schmaler/breiter als zwei echte Karten
    // und das Detail dockt an anderer x-Position an als bei Kontakten/Objekten.
    let maxW = istListe ? listeBreiteAus(listeOpt) : undefined;
    if (uebersichtBreite === "master") {
      maxW = kartenSpalten * kartenMaxBreite + (kartenSpalten - 1) * gap;
    }
    return (
      <div ref={contentRef} data-ad-scroll="y" style={{ flex: 1, minHeight: 0,
        minWidth: 0, width: "100%", overflowY: "auto", padding: "8px 0",
        boxSizing: "border-box" }}>
        <div style={{ maxWidth: maxW, width: maxW ? "100%" : undefined }}>
          {masterNode}
        </div>
      </div>
    );
  }
  // Master-Breite im Detail-Fall. Bei uebersichtBreite="master" (Timeline) MUSS
  // sie exakt der Übersichts-Breite entsprechen: kartenSpalten × kartenMaxBreite
  // + gap — DERSELBE kartenMaxBreite wie die Kontakte-/Objekte-Übersicht nutzt.
  // So dockt das Detail an derselben x-Position an wie dort und die Liste springt
  // beim Öffnen nicht (passendeMasterSpalten würde die Breite je nach Fenster und
  // Detail-Reservierung anders berechnen).
  const masterFix = uebersichtBreite === "master"
    ? kartenSpalten * kartenMaxBreite + (kartenSpalten - 1) * gap
    : null;
  const masterFlexBreite = masterFix != null ? masterFix : masterBreite;
  return (
    <div ref={contentRef} style={{ display: "flex", flexDirection: "row", flex: 1,
      minHeight: 0, minWidth: 0, width: "100%", boxSizing: "border-box", gap }}>
      <div data-ad-scroll="y" style={{
        flex: (layout.cols > 0 && masterFlexBreite > 0) ? `0 0 ${masterFlexBreite}px` : "1 1 0%",
        minWidth: 0, overflowY: "auto", padding: "8px 0", boxSizing: "border-box" }}>
        {masterNode}
      </div>
      {layout.cols > 0 && (
        <div data-ad-auslauf="1" style={{ flex: `0 0 ${detailBreite}px`,
          minWidth: 0, overflowY: "auto", padding: "8px 0", boxSizing: "border-box" }}>
          {detail}
        </div>
      )}
    </div>
  );
}

// ╔═════════════════════════════════════════════════════════════════════════╗

export {
  KopfPille,
  ScreenKopf,
  HeaderZurueck,
  HeaderPlus,
  DetailKopf,
  ObjektDetailKopf,
  objektKopfProps,
  DetailRahmen,
  MasterDetailRahmen,
  Toggle,
  SegmentControl,
  Inp,
  DATUM_MONATE_KURZ,
  DATUM_MONATE,
  tageImMonat,
  DatumSpalte,
  datumAnzeige,
  MonatJahrPickerModal,
  DatumKalender,
  DatumPickerModal,
  TagMonatPickerModal,
  maskeDatum,
  DatumFeld,
  maskeZeit,
  istZeitGueltig,
  ZeitWahl,
  ZeitPickerModal,
  ZeitFeld,
  CopyBtn,
  TipContext,
  TipProvider,
  Tip,
  Avatar,
  RolleBadge,
  VerwendungBadge,
  aggregiereObjektVerwendungen,
  VerwendungenBadges,
  KontaktPicker,
  EckPille,
  EigentumBlock,
  EigentumswechselVorgang,
  BelegungswechselVorgang,
  EigentumHistorie,
  PersonCard,
  parseAnteile,
  formatAnteileDE,
  wirtschaftsjahrEnde,
  wjEndeDatum,
  wjAblaufJahr,
  etvNaechsteStatus,
  ETV_STATUS_FARBE,
  LEGIONELLEN_BEFUNDE,
  legionellenBefund,
  legionellenNaechste,
  legionellenFaelligStatus,
  LEGIONELLEN_STATUS_FARBE,
  LEGIONELLEN_ZENTRAL_SYSTEME,
  geraetSystemWert,
  objektHatZentralesWarmwasser,
  legionellenStandorte,
  legionellenFindeEinheit,
  legionellenFindeRaum,
  legionellenAnsprechpartner,
  FeldKontaktKarte,
  LegionellenFeldInhalt,
  FieldRow,
  AddFieldModal,
  FieldList
};
