import React, { useState, useRef, useEffect } from "react";
import {
  ACCENT, APP_VERSION, DEFAULT_GEWERKE_LISTE, DEFAULT_KATEGORIEN, DEFAULT_LEISTUNGEN,
  DEFAULT_ROLLEN, DEFAULT_VERWENDUNGEN, FS, FW, PALETTE_FARBEN, RAD, effColor, effKuerzel,
  feldInput, getContrastColor, kategorieVon, rolleBadgeSichtbar, rolleEckPosition,
  rolleEckSichtbar, toGrau, verwendungBadgeSichtbar, verwendungEckPosition, verwendungEckSichtbar
} from "./constants.js";
import { splitPlzOrt } from "./utils-basis.js";
import {
  DEFAULT_SETTINGS, KONTAKTARTEN_KATEGORIEN, VERWALTUNGSARTEN,
  gruppiereDubletten, fuehreKontakteZusammen, kontaktInGruppe, normalisiereKontakte, normalisiereVes, objektInGruppe, objektOrt,
  wendeKontaktZuweisungenAnAlle
} from "./datenmodell.js";
import {
  I, STORAGE_SCHEMA_VERSION, SortierPfeile, exportiereJSON, filterEintragConf, importiereJSON,
  migriereZuweisungen, schemaWarnung, storage, useKontaktFarbe, useWindowWidth
} from "./utils-icons.jsx";
import {
  Avatar, Inp, KontaktPicker, RolleBadge, SegmentControl, Toggle
} from "./components.jsx";
import { AUTO_BETEILIGTE_REGELN, KAL_ZOOM_STUFEN } from "./kalender.jsx";
import {
  HANDLUNGSBEDARF_QUELLEN, VEKachel, hbQuelleAktiv, hbVorlauf
} from "./objektansicht.jsx";
import { druckeHtml } from "./listen-tools.jsx";
// ╔═════════════════════════════════════════════════════════════════════════╗
// ║ SEKTION 8 · EINSTELLUNGEN — ausgelagertes Modul                         ║
// ║ EinstellKarte · EinstellZeile · FarbPicker · SEKTIONEN                   ║
// ║ Sektionen: Profil · Erscheinungsbild · Header · Filter · Dashboard ·    ║
// ║            Suche · Hausverwaltung · Daten · Tastatur · Kalender         ║
// ║ TASTATUR_AKTIONEN · useStorageStatus · dateiZuFotoDataUrl               ║
// ╚═════════════════════════════════════════════════════════════════════════╝

// ── Einstellungen-Karten/Zeilen-Container ───────────────────────────────────
function EinstellKarte({ title, children, t, accent }) {
  return (
    <div style={{ background: t.card, border: `1px solid ${t.border}`,
      borderRadius: RAD.lg, overflow: "hidden", marginBottom: 12 }}>
      <div style={{ padding: "10px 14px", background: accent + "08",
        borderBottom: `1px solid ${t.border}` }}>
        <span style={{ fontSize: FS.l, fontWeight: FW.bold, color: t.text }}>{title}</span>
      </div>
      <div style={{ padding: "14px" }}>{children}</div>
    </div>
  );
}

function EinstellZeile({ label, sub, children, t }) {
  // Auf Mobile (< 600px) wird die Zeile gestapelt: Label oben, Control darunter
  // in voller Breite. So passen breite Controls (PillGroup) sauber rein und
  // Toggles werden rechts ausgerichtet (alignSelf: flex-end), damit die
  // Touch-Trefferfläche an gewohnter Stelle sitzt.
  const ww = useWindowWidth();
  const stacked = ww < 600;
  if (stacked) {
    return (
      <div style={{ padding: "11px 0", borderBottom: `1px solid ${t.border}25`,
        display: "flex", flexDirection: "column", gap: 8 }}>
        <div>
          <div style={{ fontSize: FS.l, fontWeight: FW.semi, color: t.text }}>{label}</div>
          {sub && <div style={{ fontSize: FS.m, color: t.sub, marginTop: 3, lineHeight: 1.4 }}>{sub}</div>}
        </div>
        <div style={{ display: "flex", justifyContent: "flex-end" }}>
          {children}
        </div>
      </div>
    );
  }
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12,
      padding: "11px 0", borderBottom: `1px solid ${t.border}25` }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: FS.l, fontWeight: FW.semi, color: t.text }}>{label}</div>
        {sub && <div style={{ fontSize: FS.m, color: t.sub, marginTop: 3, lineHeight: 1.4 }}>{sub}</div>}
      </div>
      <div style={{ flexShrink: 0 }}>{children}</div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// EINSTELLUNGEN-ZENTRALE
// ─────────────────────────────────────────────────────────────────────────────
// Eine zentrale Seite mit Kachel-Übersicht. Klick auf Kachel öffnet die
// jeweilige Detail-Sektion. Jede Sektion ist eine eigene Top-Level-Komponente,
// damit später pro Sektion Zugriffsrechte vergeben werden können.
//
//   if (!user.darfSehen("hv")) return null;  // <- sowas wäre dann denkbar
// ─────────────────────────────────────────────────────────────────────────────

// ── Farb-Voreinstellungen für Kacheln (8 Presets) ───────────────────────────
// ── FarbPalettenGrid (inline, alle 30 Familien × 10 Stufen) ─────────────────
// Wird sowohl im Popup als auch direkt eingebettet (z. B. in der Sektion Rollen).
// ── Helper: alle aktuell vergebenen Farben aus den Settings sammeln ─────────
// Wird an FarbPicker/FarbPalettenGrid übergeben, damit dort bereits genutzte
// Farben ausgegraut + diagonal durchgestrichen angezeigt werden — User sieht
// auf einen Blick, welche Farben "weg" sind. Die aktuell gewählte Farbe
// (value) wird automatisch ausgeklammert (siehe istGewaehlt-Check im Grid).
function sammleVerwendeteFarben(settings) {
  const liste = [];
  (settings.kacheln || []).forEach(k => { if (k.farbe) liste.push(k.farbe); });
  (settings.rollen || []).forEach(r => { if (r.color) liste.push(r.color); });
  (settings.firmenRollen || []).forEach(r => { if (r.color) liste.push(r.color); });
  (settings.verwendungen || []).forEach(v => { if (v.color) liste.push(v.color); });
  if (settings.systemFarbe) liste.push(settings.systemFarbe);
  return liste;
}

function FarbPalettenGrid({ value, onChange, t, hoehe = null, verwendeteFarben = [] }) {
  const containerStyle = { background: t.card, border: `1px solid ${t.border}`, borderRadius: RAD.md, padding: 6 };
  const scrollStyle = hoehe ? { maxHeight: hoehe, overflowY: "auto" } : {};
  // Verwendete Farben in Lookup-Set (lowercase) — die werden ausgegraut + diagonal durchgestrichen
  const usedSet = new Set((verwendeteFarben || []).filter(Boolean).map(c => c.toLowerCase()));
  return (
    <div style={containerStyle}>
      <div style={scrollStyle}>
        {PALETTE_FARBEN.map(fam => (
          <div key={fam.familie} style={{ display: "flex", gap: 3, marginBottom: 3 }}>
            {fam.stufen.map(st => {
              const istGewaehlt  = value && value.toLowerCase() === st.hex.toLowerCase();
              const istVerwendet = !istGewaehlt && usedSet.has(st.hex.toLowerCase());
              return (
                <button key={st.stufe} onClick={() => onChange(st.hex)}
                  title={`${fam.familie} ${st.stufe} · ${st.hex}${istVerwendet ? " · bereits verwendet" : ""}`}
                  style={{
                    position: "relative",
                    flex: 1, aspectRatio: "1",
                    borderRadius: RAD.sm, background: st.hex,
                    // Border konstant 1px — Selection per outline (außerhalb des Box-Modells,
                    // verschiebt keine Geschwister). Damit alle Quadrate exakt gleich groß.
                    border: `1px solid ${t.border}40`,
                    outline: istGewaehlt ? `2px solid ${t.text}` : "none",
                    outlineOffset: istGewaehlt ? "-1px" : "0",
                    cursor: "pointer", padding: 0, fontFamily: "inherit",
                    opacity: istVerwendet ? 0.35 : 1,
                  }}>
                  {istVerwendet && (
                    <span aria-hidden="true" style={{
                      position: "absolute", top: 0, right: 0, bottom: 0, left: 0, pointerEvents: "none",
                      background: `linear-gradient(135deg, transparent 46%, ${t.text} 46%, ${t.text} 54%, transparent 54%)`,
                      borderRadius: 4,
                    }}/>
                  )}
                </button>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

// ── FarbPicker (Button + Modal mit Header/Footer) ───────────────────────────
// Drop-in-Ersatz für den alten 8-Farben-Picker. Modal-Pattern statt Popup:
//   • Mobile (<700px): vollflächiges Modal mit safe-area-Padding oben/unten
//   • Desktop:        zentriertes Modal, max 90dvh
//   • X-Button rechts im Header zum Schließen
//   • Footer mit Abbrechen + Übernehmen
//   • Auswahl erst beim Klick auf "Übernehmen" wirksam — Abbrechen verwirft.
function FarbPicker({ value, onChange, t, verwendeteFarben = [] }) {
  const [offen, setOffen] = useState(false);
  return (
    <div style={{ position: "relative" }}>
      <button onClick={() => setOffen(true)} title="Farbe wählen" style={{
        width: 26, height: 26, borderRadius: RAD.ms,
        background: value, border: `2px solid ${t.border}`,
        cursor: "pointer", padding: 0, fontFamily: "inherit" }}/>
      {offen && (
        <FarbPickerModal value={value} t={t}
          verwendeteFarben={verwendeteFarben}
          onUebernehmen={(c) => { onChange(c); setOffen(false); }}
          onClose={() => setOffen(false)}/>
      )}
    </div>
  );
}

function FarbPickerModal({ value, t, verwendeteFarben, onUebernehmen, onClose }) {
  // Entwurfs-Auswahl — wird erst per "Übernehmen" zurück nach oben gemeldet
  const [draft, setDraft] = useState(value);
  const ww = useWindowWidth();
  const isMobile = ww < 700;

  // ESC = Schließen
  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <>
      {/* Backdrop */}
      <div onClick={onClose} style={{
        position: "fixed", top: 0, right: 0, bottom: 0, left: 0, zIndex: 9000,
        background: "rgba(0,0,0,0.6)"
      }}/>
      {/* Modal */}
      <div style={{
        position: "fixed",
        top:    isMobile ? "max(8px, env(safe-area-inset-top))"       : "50%",
        left:   isMobile ? 8 : "50%",
        right:  isMobile ? 8 : "auto",
        bottom: isMobile ? "max(8px, env(safe-area-inset-bottom))"    : "auto",
        transform: isMobile ? "none" : "translate(-50%, -50%)",
        width:  isMobile ? "auto" : "min(420px, calc(100vw - 32px))",
        maxHeight: isMobile ? "none" : "90dvh",
        background: t.card, border: `1px solid ${t.border}`, borderRadius: RAD.lg,
        boxShadow: "0 16px 48px rgba(0,0,0,0.5)",
        zIndex: 9001,
        display: "flex", flexDirection: "column",
        overflow: "hidden",
      }}>
        {/* Header mit X — Titel + aktueller (gespeicherter) Farbe in einer Zeile.
            Die "aktuelle Farbe" ist das was bisher gilt (value), nicht draft —
            so sieht der User auf einen Blick womit er gerade vergleicht.
            Die Vorschau der neuen Auswahl (draft) sitzt unten am Übernehmen-Button. */}
        <div style={{ display: "flex", alignItems: "center", gap: 10,
          padding: "12px 14px", borderBottom: `1px solid ${t.border}` }}>
          <div style={{ fontSize: FS.xl, fontWeight: FW.bold, color: t.text }}>Farbe wählen</div>
          <span title="Aktuelle Farbe" style={{
            width: 20, height: 20, borderRadius: RAD.sm,
            background: value, border: `1px solid ${t.border}`,
            display: "inline-block", flexShrink: 0 }}/>
          <div style={{ flex: 1 }}/>
          <button onClick={onClose} title="Schließen" aria-label="Schließen" style={{
            width: 34, height: 34, borderRadius: RAD.md,
            background: t.surface, border: `1px solid ${t.border}`,
            cursor: "pointer", padding: 0, fontFamily: "inherit",
            display: "flex", alignItems: "center", justifyContent: "center" }}>
            <I name="x" size={15} color={t.sub}/>
          </button>
        </div>

        {/* Grid — flex 1, eigenes Scrollen */}
        <div style={{ flex: 1, overflowY: "auto", padding: 10 }}>
          <FarbPalettenGrid value={draft} onChange={setDraft}
            t={t} verwendeteFarben={verwendeteFarben}/>
        </div>

        {/* Footer */}
        <div style={{ display: "flex", gap: 8, padding: "10px 12px",
          borderTop: `1px solid ${t.border}` }}>
          <button onClick={onClose} style={{
            flex: 1, padding: "11px 0", background: t.surface,
            border: `1px solid ${t.border}`, borderRadius: RAD.ml,
            color: t.text, cursor: "pointer",
            fontSize: FS.l, fontWeight: FW.medium, fontFamily: "inherit" }}>
            Abbrechen
          </button>
          <button onClick={() => onUebernehmen(draft)} style={{
            flex: 2, padding: "11px 0", background: draft,
            border: "none", borderRadius: RAD.ml,
            color: getContrastColor(draft), cursor: "pointer",
            fontSize: FS.l, fontWeight: FW.bold, fontFamily: "inherit" }}>
            Übernehmen
          </button>
        </div>
      </div>
    </>
  );
}


// ── Foto-Helper: Datei → 200×200 Base64-JPEG ────────────────────────────────
// Liest eine Bild-Datei ein, skaliert auf max. 200×200 (Center-Crop, behält
// Seitenverhältnis), gibt Base64-DataURL als JPEG zurück. Wird für das Profil-
// foto verwendet — kleine Größe ist wichtig, damit localStorage nicht überläuft.
function dateiZuFotoDataUrl(file, callback) {
  if (!file || !file.type || file.type.indexOf("image/") !== 0) {
    callback(null); return;
  }
  const reader = new FileReader();
  reader.onload = function(ev) {
    const img = new Image();
    img.onload = function() {
      const ZIEL = 200;
      const sx = img.width  > img.height ? (img.width  - img.height) / 2 : 0;
      const sy = img.height > img.width  ? (img.height - img.width)  / 2 : 0;
      const seite = Math.min(img.width, img.height);
      const canvas = document.createElement("canvas");
      canvas.width = ZIEL; canvas.height = ZIEL;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(img, sx, sy, seite, seite, 0, 0, ZIEL, ZIEL);
      callback(canvas.toDataURL("image/jpeg", 0.85));
    };
    img.onerror = function() { callback(null); };
    img.src = ev.target.result;
  };
  reader.onerror = function() { callback(null); };
  reader.readAsDataURL(file);
}

// ── Sektion: Mein Profil ────────────────────────────────────────────────────
// Profil = Verknüpfung mit einem Kontakt im Adressbuch (settings.userKontaktId).
// User wählt einen bestehenden Kontakt oder legt einen neuen an. Nach der
// Verknüpfung wird die KontaktDetailKarte gerendert — damit hat das Profil
// automatisch alle Kontakt-Features (Stammdaten, Foto-Upload, Rollen,
// Objektzuweisungen, Notizen, Custom-Felder).
// Migration: alte settings.userProfil-Daten werden einmalig auf den
// verknüpften Kontakt geschrieben, dann ist userProfil leer.
function SektionProfil({ kontakte, setKontakte, ves, settings, setSettings, t, accent }) {
  const userKontakt = kontakte.find(k => k.id === settings.userKontaktId);
  // Edit-Modus extern steuern: bei Auswahl eines bestehenden Kontakts → View;
  // bei „+ Neu anlegen" im Picker → direkt Edit, damit der User weitere Daten
  // ergänzen und speichern kann.
  const [profilEditMode, setProfilEditMode] = useState(false);

  // Beim Wechseln der userKontaktId zurück in den View-Modus — außer wir haben
  // ihn gerade durch eine Neu-Anlage gesetzt (handlePickerCreate).
  const handlePickerChange = (id) => {
    setSettings(s => ({ ...s, userKontaktId: id }));
    setProfilEditMode(false);
  };
  const handlePickerCreate = () => {
    // onCreate feuert NACH onChange, daher hier nur den Edit-Modus aktivieren.
    setProfilEditMode(true);
  };

  // Einmalige Migration aus altem settings.userProfil
  useEffect(() => {
    const p = settings.userProfil || {};
    const hatDaten = !!(p.vorname || p.nachname || p.foto
      || (p.tels && p.tels.length)
      || (p.emails && p.emails.length)
      || p.strasse || p.plzOrt || p.plz || p.ort || p.geburtstag);
    if (!hatDaten || !userKontakt) return;

    const updated = { ...userKontakt };
    if (p.anrede)    updated.anrede   = p.anrede;
    if (p.titel)     updated.titel    = p.titel;
    if (p.vorname)   updated.vorname  = p.vorname;
    if (p.nachname)  updated.nachname = p.nachname;
    if (p.vorname || p.nachname) {
      updated.name = `${p.vorname || ""} ${p.nachname || ""}`.trim();
    }
    if (p.foto)       updated.foto       = p.foto;
    if (p.tels && p.tels.length)     updated.tels   = p.tels;
    if (p.emails && p.emails.length) updated.emails = p.emails;
    if (p.strasse)    updated.strasse    = p.strasse;
    if (p.plz)        updated.plz        = p.plz;
    if (p.ort)        updated.ort        = p.ort;
    if (p.plzOrt && !p.plz && !p.ort) {
      const sp = splitPlzOrt(p.plzOrt);
      updated.plz = sp.plz; updated.ort = sp.ort;
    }
    if (p.geburtstag) updated.geburtstag = p.geburtstag;

    setKontakte(prev => prev.map(k => k.id === userKontakt.id ? updated : k));
    setSettings(s => ({
      ...s,
      userProfil: { anrede: "", vorname: "", nachname: "", funktion: "",
        foto: "", tels: [], emails: [], strasse: "", plz: "", ort: "", geburtstag: "" }
    }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Nur Personen im Picker zur Auswahl
  const personenKontakte = kontakte.filter(k => k.typ === "person");

  // Verknüpfung lösen — Profil zeigt dann wieder den Picker.
  // Der Kontakt selbst bleibt im Adressbuch erhalten.
  const verknuepfungLoesen = () => {
    setSettings(s => ({ ...s, userKontaktId: null }));
    setProfilEditMode(false);
  };

  // Kontakt komplett löschen — entfernt ihn aus dem Adressbuch UND löst die
  // Profil-Verknüpfung. Bestätigung läuft bereits in KDKHeader.
  const profilKontaktLoeschen = () => {
    if (!userKontakt) return;
    setKontakte(prev => prev.filter(k => k.id !== userKontakt.id));
    setSettings(s => ({ ...s, userKontaktId: null }));
    setProfilEditMode(false);
  };

  return (
    <>
      {!userKontakt && (
        <EinstellKarte title="Profil-Verknüpfung" t={t} accent={accent}>
          <div style={{ fontSize: FS.m, color: t.sub, marginBottom: 10, lineHeight: 1.5 }}>
            Wähle einen bestehenden Kontakt aus dem Adressbuch — oder lege im
            Picker einen neuen an („+ Neu anlegen"). Dein Profil-Kontakt
            erscheint dann auch in der Kontakte-Liste.
          </div>
          <KontaktPicker
            value={settings.userKontaktId || null}
            onChange={handlePickerChange}
            onCreate={handlePickerCreate}
            kontakte={personenKontakte}
            setKontakte={setKontakte}
            t={t} accent={accent}/>
        </EinstellKarte>
      )}

      {userKontakt && (
        <KontaktDetailKarte
          k={userKontakt}
          t={t}
          accent={accent}
          ves={ves}
          kontakte={kontakte}
          setKontakte={setKontakte}
          externEditMode={profilEditMode}
          setExternEditMode={setProfilEditMode}
          onUpdate={(updated) => {
            setKontakte(prev => prev.map(k => k.id === userKontakt.id ? updated : k));
          }}
          onDelete={profilKontaktLoeschen}/>
      )}
    </>
  );
}
// ── Sektion: Erscheinungsbild ───────────────────────────────────────────────
// ── PositionSelector: 2×2-Raster zur Wahl der Avatar-Eck-Position (OL/OR/UL/UR).
// Global, damit RollenTabelle und VerwendungenTabelle dieselbe Quelle nutzen.
function PositionSelector({ aktivePosition, onSelect, farbe, disabled, t }) {
  const positionen = [
    { key: "OL", row: 0, col: 0 }, { key: "OR", row: 0, col: 1 },
    { key: "UL", row: 1, col: 0 }, { key: "UR", row: 1, col: 1 },
  ];
  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gridTemplateRows: "1fr 1fr",
      gap: 2, width: 22, height: 22, flexShrink: 0, opacity: disabled ? 0.35 : 1 }}>
      {positionen.map(p => {
        const ist = aktivePosition === p.key;
        return (
          <button key={p.key} disabled={disabled}
            onClick={(e) => { e.stopPropagation(); if (!disabled) onSelect(p.key); }}
            title={`Ecke ${p.key}`}
            style={{ width: 10, height: 10, padding: 0,
              background: ist ? farbe : "transparent",
              border: `1px solid ${ist ? farbe : t.border}`,
              borderRadius: RAD.sm, cursor: disabled ? "default" : "pointer",
              gridRow: p.row + 1, gridColumn: p.col + 1 }}/>
        );
      })}
    </div>
  );
}


// ── HandlungsbedarfTabelle — pro Frist-Quelle: zählt-Schalter + Vorlauf-Tage ─
// Speist settings.handlungsbedarf = { quellen:{id:bool}, vorlauf:{id:tage} }.
// Greift in objektHandlungsbedarf (Status-Punkt an Objekten in der Liste).
function HandlungsbedarfTabelle({ settings, save, t, accent }) {
  const cfg = settings.handlungsbedarf || {};
  // Feste Vorlauf-Stufen (Tage). Slider-Position 0 = aus ("wird nicht
  // angezeigt"), Position 1..N = STUFEN[0..N-1]. Der frühere Toggle entfällt.
  const STUFEN = [3, 7, 14, 21, 30, 60, 90, 120, 150, 180];
  const stufeIdx = (v) => {
    let best = 0, bestDiff = Infinity;
    for (let i = 0; i < STUFEN.length; i++) {
      const d = Math.abs(STUFEN[i] - v);
      if (d < bestDiff) { bestDiff = d; best = i; }
    }
    return best;
  };
  // Setzt Quelle an/aus UND Vorlauf in einem Rutsch (kein doppeltes save).
  const setStufe = (id, idx) => {
    const cur = settings.handlungsbedarf || {};
    if (idx === 0) {
      save({ handlungsbedarf: { ...cur, quellen: { ...(cur.quellen || {}), [id]: false } } });
    } else {
      save({ handlungsbedarf: { ...cur,
        quellen: { ...(cur.quellen || {}), [id]: true },
        vorlauf: { ...(cur.vorlauf || {}), [id]: STUFEN[idx - 1] } } });
    }
  };
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      {HANDLUNGSBEDARF_QUELLEN.map(q => {
        const an = hbQuelleAktiv(cfg, q.id);
        const vorlauf = hbVorlauf(cfg, q.id);
        const stufe = an ? stufeIdx(vorlauf) + 1 : 0;
        return (
          <div key={q.id} style={{ display: "flex", alignItems: "center", gap: 10,
            padding: "8px", borderRadius: RAD.sm,
            background: an ? "transparent" : t.surface + "80",
            border: `1px solid ${t.border}40` }}>
            <div style={{ flex: 1, minWidth: 0, fontSize: FS.m, fontWeight: FW.medium,
              color: an ? t.text : t.muted, lineHeight: 1.3 }}>{q.label}</div>
            <span style={{ fontSize: FS.s, fontWeight: FW.medium,
              fontVariantNumeric: "tabular-nums", minWidth: 116, textAlign: "right",
              color: an ? t.sub : t.muted, fontStyle: an ? "normal" : "italic", flexShrink: 0 }}>
              {an ? `${vorlauf} Tage` : "wird nicht angezeigt"}
            </span>
            <input type="range" min={0} max={STUFEN.length} step={1}
              value={stufe}
              onChange={e => setStufe(q.id, parseInt(e.target.value, 10))}
              style={{ width: 150, flexShrink: 0, accentColor: an ? accent : t.muted,
                cursor: "pointer", height: 24 }}/>
          </div>
        );
      })}
    </div>
  );
}

function SektionErscheinungsbild({ settings, setSettings, rawSettings, t, accent, mode, setMode }) {
  const save = (partial) => setSettings(s => ({ ...s, ...partial }));
  // Farb-Intensität-Wert für den Slider (rohe Settings, damit der echte Wert
  // angezeigt wird). Vor dem return als const,
  // KEINE IIFE in JSX (Safari/iOS-Regel).
  const farbIntRoh = rawSettings || settings;
  const farbIntWert = farbIntRoh.farbIntensitaet != null ? farbIntRoh.farbIntensitaet : 100;
  return (
    <>
    <EinstellKarte title="Erscheinungsbild" t={t} accent={accent}>
      <EinstellZeile label="Schriftgröße" sub="Skaliert Texte und Bedienelemente in der gesamten App" t={t}>
        <SegmentControl t={t} accent={accent}
          value={settings.dichte || "normal"}
          onChange={id => save({ dichte: id })}
          options={[
            { id: "compact", label: "Klein" },
            { id: "normal",  label: "Normal" },
            { id: "relaxed", label: "Groß" },
          ]}/>
      </EinstellZeile>
      <EinstellZeile label="Objekte & Kontakte als"
        sub="Übersicht als große Karten oder als kompakte Liste (mehr pro Bildschirm)" t={t}>
        <SegmentControl t={t} accent={accent}
          value={settings.listenAnsicht || "karten"}
          onChange={id => save({ listenAnsicht: id })}
          options={[
            { id: "karten", label: "Karten" },
            { id: "liste",  label: "Liste" },
          ]}/>
      </EinstellZeile>
      <EinstellZeile label="Symbole an Karten"
        sub="An: Karten zeigen ihr Symbol links vom Titel · Aus: Karten ohne Symbol" t={t}>
        <Toggle value={settings.kartenIconsAn !== false}
          onChange={v => save({ kartenIconsAn: v })} color={accent}/>
      </EinstellZeile>
      {(settings.listenAnsicht || "karten") === "karten" && (
        <EinstellZeile label="Übersicht: feste Spaltenzahl"
          sub="An: Die Übersicht zeigt immer genau die eingestellte Spaltenzahl (Karten auf Maximalbreite, Rest bleibt rechts frei) — die Karten springen beim Öffnen eines Details nicht mehr. Aus: Die Übersicht füllt die ganze Breite mit so vielen Spalten wie passen." t={t}>
          <Toggle value={settings.festeSpalten !== false}
            onChange={v => save({ festeSpalten: v })} color={accent}/>
        </EinstellZeile>
      )}
      {(settings.listenAnsicht || "karten") === "karten" && (
        <EinstellZeile label="Karten neben dem Detail" sub="Wie viele Karten-Spalten höchstens neben dem geöffneten Detailfenster stehen (Desktop). Reicht der Platz nicht, werden es automatisch weniger." t={t}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 160 }}>
            <span style={{ fontSize: FS.s, fontWeight: FW.medium, color: t.sub,
              fontVariantNumeric: "tabular-nums", minWidth: 56, textAlign: "right" }}>
              {settings.kartenSpalten != null ? settings.kartenSpalten : 2} {(settings.kartenSpalten != null ? settings.kartenSpalten : 2) === 1 ? "Spalte" : "Spalten"}
            </span>
            <input type="range" min={1} max={5} step={1}
              value={settings.kartenSpalten != null ? settings.kartenSpalten : 2}
              onChange={e => save({ kartenSpalten: parseInt(e.target.value, 10) })}
              style={{ flex: 1, accentColor: accent, cursor: "pointer", height: 24 }}/>
          </div>
        </EinstellZeile>
      )}
      {(settings.listenAnsicht || "karten") === "karten" && (
        <EinstellZeile label="Karten-Maximalbreite" sub="So breit wird eine Karte höchstens. Ist mehr Platz da, bleibt er rechts frei — die Karten werden nicht breitgezogen." t={t}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 160 }}>
            <span style={{ fontSize: FS.s, fontWeight: FW.medium, color: t.sub,
              fontVariantNumeric: "tabular-nums", minWidth: 56, textAlign: "right" }}>
              {Math.max(240, Math.min(480, settings.kartenMaxBreite != null ? settings.kartenMaxBreite : 340))} px
            </span>
            <input type="range" min={240} max={480} step={10}
              value={Math.max(240, Math.min(480, settings.kartenMaxBreite != null ? settings.kartenMaxBreite : 340))}
              onChange={e => save({ kartenMaxBreite: parseInt(e.target.value, 10) })}
              style={{ flex: 1, accentColor: accent, cursor: "pointer", height: 24 }}/>
          </div>
        </EinstellZeile>
      )}
      {(settings.listenAnsicht || "karten") === "karten" && (
        <EinstellZeile label="Schrumpf-Toleranz" sub="Wie weit eine Karte unter ihre Maximalbreite schrumpfen darf, bevor eine Spalte wegfällt. Höher = enger zusammenschieben (mehr Spalten halten), niedriger = früher eine Spalte weniger." t={t}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 160 }}>
            <span style={{ fontSize: FS.s, fontWeight: FW.medium, color: t.sub,
              fontVariantNumeric: "tabular-nums", minWidth: 56, textAlign: "right" }}>
              {Math.max(0, Math.min(50, settings.kartenSchrumpf != null ? settings.kartenSchrumpf : 20))} %
            </span>
            <input type="range" min={0} max={50} step={5}
              value={Math.max(0, Math.min(50, settings.kartenSchrumpf != null ? settings.kartenSchrumpf : 20))}
              onChange={e => save({ kartenSchrumpf: parseInt(e.target.value, 10) })}
              style={{ flex: 1, accentColor: accent, cursor: "pointer", height: 24 }}/>
          </div>
        </EinstellZeile>
      )}
      {(settings.listenAnsicht || "karten") === "karten" && (
        <EinstellZeile label="Detailfenster-Breite" sub="Wie breit das geöffnete Detailfenster ist, wenn du ein Objekt oder einen Kontakt antippst. Die Karten stehen links davor; rechts bleibt frei. Reicht der Platz nicht für die eingestellte Spaltenzahl, werden es automatisch weniger Spalten." t={t}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 160 }}>
            <span style={{ fontSize: FS.s, fontWeight: FW.medium, color: t.sub,
              fontVariantNumeric: "tabular-nums", minWidth: 56, textAlign: "right" }}>
              {Math.max(400, Math.min(1200, settings.detailMinBreite != null ? settings.detailMinBreite : 400))} px
            </span>
            <input type="range" min={400} max={1200} step={20}
              value={Math.max(400, Math.min(1200, settings.detailMinBreite != null ? settings.detailMinBreite : 400))}
              onChange={e => save({ detailMinBreite: parseInt(e.target.value, 10) })}
              style={{ flex: 1, accentColor: accent, cursor: "pointer", height: 24 }}/>
          </div>
        </EinstellZeile>
      )}
      {(settings.listenAnsicht || "karten") === "liste" && (
        <EinstellZeile label="Listenbreite" sub="So breit wird die Listen-Spalte links höchstens. Ist mehr Platz da, bleibt er rechts frei." t={t}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 160 }}>
            <span style={{ fontSize: FS.s, fontWeight: FW.medium, color: t.sub,
              fontVariantNumeric: "tabular-nums", minWidth: 56, textAlign: "right" }}>
              {Math.max(280, Math.min(720, settings.listeBreite != null ? settings.listeBreite : 400))} px
            </span>
            <input type="range" min={280} max={720} step={20}
              value={Math.max(280, Math.min(720, settings.listeBreite != null ? settings.listeBreite : 400))}
              onChange={e => save({ listeBreite: parseInt(e.target.value, 10) })}
              style={{ flex: 1, accentColor: accent, cursor: "pointer", height: 24 }}/>
          </div>
        </EinstellZeile>
      )}
      {(settings.listenAnsicht || "karten") === "liste" && (
        <EinstellZeile label="Listen-Schrumpf" sub="Wie weit die Liste unter ihre Breite schrumpfen darf, bevor sie ganz weicht. Bei knappem Platz schrumpft zuerst die Liste, dann das Detail, dann bleibt nur das Detail." t={t}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 160 }}>
            <span style={{ fontSize: FS.s, fontWeight: FW.medium, color: t.sub,
              fontVariantNumeric: "tabular-nums", minWidth: 56, textAlign: "right" }}>
              {Math.max(0, Math.min(50, settings.listeSchrumpf != null ? settings.listeSchrumpf : 25))} %
            </span>
            <input type="range" min={0} max={50} step={5}
              value={Math.max(0, Math.min(50, settings.listeSchrumpf != null ? settings.listeSchrumpf : 25))}
              onChange={e => save({ listeSchrumpf: parseInt(e.target.value, 10) })}
              style={{ flex: 1, accentColor: accent, cursor: "pointer", height: 24 }}/>
          </div>
        </EinstellZeile>
      )}
      {(settings.listenAnsicht || "karten") === "liste" && (
        <EinstellZeile label="Detailfenster-Breite" sub="Wie breit das Detailfenster neben der Liste ist. Wird der Platz eng, schrumpft erst die Liste, dann das Detail." t={t}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 160 }}>
            <span style={{ fontSize: FS.s, fontWeight: FW.medium, color: t.sub,
              fontVariantNumeric: "tabular-nums", minWidth: 56, textAlign: "right" }}>
              {Math.max(400, Math.min(1200, settings.detailBreiteListe != null ? settings.detailBreiteListe : 540))} px
            </span>
            <input type="range" min={400} max={1200} step={20}
              value={Math.max(400, Math.min(1200, settings.detailBreiteListe != null ? settings.detailBreiteListe : 540))}
              onChange={e => save({ detailBreiteListe: parseInt(e.target.value, 10) })}
              style={{ flex: 1, accentColor: accent, cursor: "pointer", height: 24 }}/>
          </div>
        </EinstellZeile>
      )}
      {(settings.listenAnsicht || "karten") === "liste" && (
        <EinstellZeile label="Detail-Schrumpf" sub="Wie weit das Detailfenster unter seine Breite schrumpfen darf, nachdem die Liste schon am Minimum ist. Reicht auch das nicht, weicht die Liste ganz." t={t}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 160 }}>
            <span style={{ fontSize: FS.s, fontWeight: FW.medium, color: t.sub,
              fontVariantNumeric: "tabular-nums", minWidth: 56, textAlign: "right" }}>
              {Math.max(0, Math.min(40, settings.detailSchrumpfListe != null ? settings.detailSchrumpfListe : 20))} %
            </span>
            <input type="range" min={0} max={40} step={5}
              value={Math.max(0, Math.min(40, settings.detailSchrumpfListe != null ? settings.detailSchrumpfListe : 20))}
              onChange={e => save({ detailSchrumpfListe: parseInt(e.target.value, 10) })}
              style={{ flex: 1, accentColor: accent, cursor: "pointer", height: 24 }}/>
          </div>
        </EinstellZeile>
      )}
      {/* Farb-Intensität: stufenloser Regler (ersetzt den früheren An/Aus-
          Schalter "Mehr Farbe"). 100 % = volle Akzentfarben, 0 % = neutrales
          Grau. Wert wird global an toGrau durchgereicht. Steht bewusst unter
          den Karten-/Detail-Reglern. */}
      <EinstellZeile label="Farb-Intensität" sub="Wie kräftig die Akzentfarben in der ganzen App wirken (inkl. Header). 100 % = volle Farben, 0 % = neutrales Grau für ein ruhigeres, professionelleres Erscheinungsbild. Alles dazwischen mischt stufenlos." t={t}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 160 }}>
          <span style={{ fontSize: FS.s, fontWeight: FW.medium, color: t.sub,
            fontVariantNumeric: "tabular-nums", minWidth: 42, textAlign: "right" }}>
            {farbIntWert} %
          </span>
          <input type="range" min={0} max={100} step={5}
            value={farbIntWert}
            onChange={e => save({ farbIntensitaet: parseInt(e.target.value, 10) })}
            style={{ flex: 1, accentColor: accent, cursor: "pointer", height: 24 }}/>
        </div>
      </EinstellZeile>
      <EinstellZeile label="Dunkelmodus" sub="Helles oder dunkles Design" t={t}>
        <Toggle value={mode === "dark"} onChange={v => setMode(v ? "dark" : "light")} color={accent}/>
      </EinstellZeile>
      <EinstellZeile label="Höherer Kontrast" sub="Sekundäre Texte deutlich heller bzw. dunkler – bessere Lesbarkeit" t={t}>
        <Toggle value={!!settings.hoherKontrast}
          onChange={v => save({ hoherKontrast: v })} color={accent}/>
      </EinstellZeile>
      <EinstellZeile label="Legende bei Kontakten" sub="Aufklappbare Symbol-Erklärung über der Kontaktliste anzeigen" t={t}>
        <Toggle value={settings.legendeKontakte !== false}
          onChange={v => save({ legendeKontakte: v })} color={accent}/>
      </EinstellZeile>
      <EinstellZeile label="Legende bei Objekten" sub="Aufklappbare Symbol-Erklärung über der Objektliste anzeigen" t={t}>
        <Toggle value={settings.legendeObjekte !== false}
          onChange={v => save({ legendeObjekte: v })} color={accent}/>
      </EinstellZeile>
      {/* Master-Schalter für beide Statusleisten (Objekte + Kontakte). An =
          mindestens eine an; Umlegen setzt beide gemeinsam. Die getrennten
          Einzelschalter liegen im Menü „Statusleiste". */}
      <EinstellZeile label="Statusleisten anzeigen"
        sub={"Farbige Hinweise an Objekt- und Kontakt-Karten gemeinsam ein-/ausblenden (einzeln steuerbar im Menü „Statusleiste“)"} t={t}>
        <Toggle value={settings.statusLeisteObjekt !== false || settings.statusLeisteKontakt !== false}
          onChange={v => save({ statusLeisteObjekt: v, statusLeisteKontakt: v })} color={accent}/>
      </EinstellZeile>
    </EinstellKarte>

    <EinstellKarte title="Header" t={t} accent={accent}>
      <EinstellZeile label="Filter anzeigen"
        sub="Wenn aus: Logo & HV-Name werden stattdessen mittig angezeigt" t={t}>
        <Toggle value={settings.filterAktiv}
          onChange={v => save({ filterAktiv: v })} color={accent}/>
      </EinstellZeile>
      <EinstellZeile label="Hell-/Dunkelmodus-Schalter anzeigen"
        sub="Sonne-/Mond-Button im Header (Modus kann immer hier unter Erscheinungsbild gewechselt werden)" t={t}>
        <Toggle value={settings.headerZeigeDunkelmodus !== false}
          onChange={v => save({ headerZeigeDunkelmodus: v })} color={accent}/>
      </EinstellZeile>
      <EinstellZeile label="Profilbild anzeigen"
        sub="Profilbild oben rechts (Zahnrad wenn aus). Einstellungen sind immer erreichbar." t={t}>
        <Toggle value={settings.headerZeigeAvatar}
          onChange={v => save({ headerZeigeAvatar: v })} color={accent}/>
      </EinstellZeile>
      <EinstellZeile label="Suche anzeigen"
        sub="Suchleiste im Header. Wenn aus, ist die Suche im Header ausgeblendet." t={t}>
        <Toggle value={settings.headerZeigeSuche !== false}
          onChange={v => save({ headerZeigeSuche: v })} color={accent}/>
      </EinstellZeile>
    </EinstellKarte>

    {/* ── System-Akzent ── direkt unter Erscheinungsbild, immer sichtbar
        (auch im seriös-Modus), weil Logo "Da", Zahnrad/Profil und
        Bearbeiten-Stift die App-Identität repräsentieren und bewusst farbig
        bleiben sollen. */}
    <EinstellKarte title="System-Akzent" t={t} accent={accent}>
      <div style={{ fontSize: FS.m, color: t.sub, marginBottom: 12, lineHeight: 1.5 }}>
        Akzentfarbe für Logo &bdquo;Da&ldquo;, Zahnrad/Profil-Button und
        Bearbeiten-Stift. Bleibt auch im Modus &bdquo;Weniger Farbe&ldquo; aktiv.
      </div>
      <div style={{
        display: "flex", alignItems: "center", gap: 10,
        padding: "7px 0",
      }}>
        <div style={{
          width: 28, height: 28, borderRadius: RAD.ms,
          background: ((rawSettings || settings).systemFarbe || ACCENT) + "25",
          display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
        }}>
          <I name="settings" size={14} color={(rawSettings || settings).systemFarbe || ACCENT}/>
        </div>
        <div style={{ flex: 1, minWidth: 0, fontSize: FS.l, color: t.text }}>System-Akzent</div>
        <FarbPicker value={(rawSettings || settings).systemFarbe || ACCENT}
          onChange={c => save({ systemFarbe: c })}
          t={t} verwendeteFarben={sammleVerwendeteFarben(rawSettings || settings)}/>
      </div>
    </EinstellKarte>

    {/* ── Farben ── nur ausblenden, wenn die Intensität auf 0 % steht (alles
        grau → Farbwahl sinnlos). Bei jeder Teilfarbe bleiben die Picker da. */}
    {((rawSettings || settings).farbIntensitaet != null
        ? (rawSettings || settings).farbIntensitaet : 100) > 0 && (
    <EinstellKarte title="Farben" t={t} accent={accent}>

      <div style={{ marginBottom: 14 }}>
        <div style={{ fontSize: FS.s, fontWeight: FW.bold, color: t.muted,
          textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 10 }}>
          Dashboard-Kacheln
        </div>
        {[...((rawSettings || settings).kacheln || [])].sort((a, b) => a.reihenfolge - b.reihenfolge).map(k => (
          <div key={k.id} style={{
            display: "flex", alignItems: "center", gap: 10,
            padding: "7px 0", borderBottom: "1px solid " + t.border + "20",
          }}>
            <div style={{
              width: 28, height: 28, borderRadius: RAD.ms, background: k.farbe + "25",
              display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
            }}>
              <I name={k.icon || "grid"} size={14} color={k.farbe}/>
            </div>
            <span style={{ flex: 1, fontSize: FS.l, color: t.text }}>{k.label}</span>
            <FarbPicker value={k.farbe}
              onChange={c => save({ kacheln: (rawSettings || settings).kacheln.map(x => x.id === k.id ? { ...x, farbe: c } : x) })}
              t={t} verwendeteFarben={sammleVerwendeteFarben(rawSettings || settings)}/>
          </div>
        ))}
      </div>

      {[
        { label: "Personen-Rollen", data: (rawSettings || settings).rollen || DEFAULT_ROLLEN, key: "rollen" },
        { label: "Gewerke (Firmen-Fachgebiet)", data: (rawSettings || settings).firmenRollen || DEFAULT_GEWERKE_LISTE, key: "firmenRollen" },
        { label: "Leistungen / Zuständigkeiten (am Objekt)", data: (rawSettings || settings).leistungen || DEFAULT_LEISTUNGEN, key: "leistungen" },
        { label: "Verwendungen",    data: (rawSettings || settings).verwendungen || DEFAULT_VERWENDUNGEN, key: "verwendungen" },
      ].map(gruppe => (
        <div key={gruppe.key} style={{ marginBottom: 14 }}>
          <div style={{ fontSize: FS.s, fontWeight: FW.bold, color: t.muted,
            textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 10 }}>
            {gruppe.label}
          </div>
          {[...gruppe.data].sort((a, b) => a.name.localeCompare(b.name, "de")).map(r => (
            <div key={r.name} style={{
              display: "flex", alignItems: "center", gap: 10,
              padding: "7px 0", borderBottom: "1px solid " + t.border + "20",
              opacity: r.aktiv === false ? 0.4 : 1 }}>
              <div style={{ width: 28, height: 28, borderRadius: RAD.full,
                background: r.color + "25", border: "1.5px solid " + r.color + "60",
                display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <span style={{ fontSize: FS.xxs, fontWeight: FW.heavy, color: r.color }}>{r.kuerzel}</span>
              </div>
              <span style={{ flex: 1, fontSize: FS.l, color: t.text }}>{r.name}</span>
              <FarbPicker value={r.color}
                onChange={c => {
                  const realData = (rawSettings || settings)[gruppe.key] || gruppe.data;
                  save({ [gruppe.key]: realData.map(x => x.name === r.name ? { ...x, color: c } : x) });
                }}
                t={t} verwendeteFarben={sammleVerwendeteFarben(rawSettings || settings)}/>
            </div>
          ))}
        </div>
      ))}

    </EinstellKarte>
    )}

    </>
  );
}

// ── Sektion: Kontakte (Anzeige, Avatare, Badges, …) ────────────────────────
// Platzhalter — Inhalte folgen.
function SektionKontakte({ settings, setSettings, t, accent, kontakte = [] }) {
  const save = (partial) => setSettings(s => ({ ...s, ...partial }));
  // Sichtbarkeit der Kontaktart-Pillen neben der Überschrift „Kontakte".
  const kart = settings.filterKontaktarten || { person: true, firma: true };
  const [rollenTab, setRollenTab] = useState("personen"); // "personen" | "firmen"
  // Wiederverwendbare Pill-Gruppe für Auswahl-Optionen mit 2-3 sichtbaren Werten.
  // width:100% damit die Gruppe in der EinstellZeile (nach Wrap auf Mobile) die
  // volle Breite einnimmt — konsistent zum Tab-Switcher in RollenTabelle.
  const PillGroup = ({ value, options, onChange }) => (
    <div style={{ display: "flex", gap: 4, padding: 3, width: "100%",
      background: t.surface, border: `1px solid ${t.border}`, borderRadius: RAD.md }}>
      {options.map(opt => {
        const ist = value === opt.id;
        return (
          <button key={opt.id} onClick={() => onChange(opt.id)} style={{
            flex: 1, padding: "6px 10px", borderRadius: RAD.sm, cursor: "pointer",
            background: ist ? accent : "transparent",
            border: "none", color: ist ? getContrastColor(accent) : t.sub,
            fontSize: FS.m, fontWeight: FW.medium, fontFamily: "inherit",
            textAlign: "center",
          }}>
            {opt.label}
          </button>
        );
      })}
    </div>
  );
  return (
    <>
      {/* Sortierung & Name-Format — gemeinsame Einstellung */}
      <EinstellKarte title="Anzeige" t={t} accent={accent}>
        <EinstellZeile label="Name-Format & Sortierung"
          sub="Format der Anzeige in Liste, Picker und Detail-Kopfzeile — sortiert wird automatisch nach dem zuerst gezeigten Namen." t={t}>
          <PillGroup
            value={settings.kontakteNameFormat || "vorname-nachname"}
            options={[
              { id: "vorname-nachname", label: "Vorname Nachname" },
              { id: "nachname-vorname", label: "Nachname, Vorname" },
            ]}
            onChange={(v) => save({ kontakteNameFormat: v })}/>
        </EinstellZeile>
        <EinstellZeile label="Alphabetische Trenner"
          sub="Zeigt in der Kontaktliste eine Buchstaben-Überschrift mit Linie vor jeder neuen Anfangsbuchstaben-Gruppe (A, B, C …)." t={t}>
          <Toggle value={settings.kontakteAlphaTrenner !== false}
            onChange={v => save({ kontakteAlphaTrenner: v })} color={accent}/>
        </EinstellZeile>
      </EinstellKarte>

      {/* Rollen-Verwaltung: Anlegen/Bearbeiten/Löschen + Position/Sichtbarkeit.
          Getrennt nach Personen-Rollen und Firmen (Gewerke). Die FARBE wird
          unter Erscheinungsbild gesetzt (analog zu den Objekt-Verwendungen). */}
      <EinstellKarte title="Rollen, Gewerke & Leistungen" t={t} accent={accent}>
        <div style={{ fontSize: FS.s, color: t.muted, marginBottom: 10, lineHeight: 1.5 }}>
          Anlegen, Bearbeiten und Anzeige (Eck-Icon, Position, Karten-Badge).
          Farben werden unter Erscheinungsbild eingestellt.
        </div>
        <PillGroup
          value={rollenTab}
          options={[
            { id: "personen", label: "Personen-Rollen" },
            { id: "firmen", label: "Firmen / Gewerke" },
            { id: "leistungen", label: "Leistungen" },
          ]}
          onChange={setRollenTab}/>
        <div style={{ marginTop: 12 }}>
          {rollenTab === "personen" ? (
            <RollenTabelle settings={settings} setSettings={setSettings} t={t} accent={accent}
              gruppeKey="rollen" defaults={DEFAULT_ROLLEN} einheit="Rolle" istFirma={false}/>
          ) : rollenTab === "firmen" ? (
            <RollenTabelle settings={settings} setSettings={setSettings} t={t} accent={accent}
              gruppeKey="firmenRollen" defaults={DEFAULT_GEWERKE_LISTE} einheit="Gewerk" istFirma={true}/>
          ) : (
            <RollenTabelle settings={settings} setSettings={setSettings} t={t} accent={accent}
              gruppeKey="leistungen" defaults={DEFAULT_LEISTUNGEN} einheit="Leistung" istFirma={true} ohneBadge={true}/>
          )}
        </div>
      </EinstellKarte>

      {/* Sicherheit: Löschen-Button für Kontakte freischalten (getrennt von den
          Objekten — eigener Schalter). */}
      <EinstellKarte title="Sicherheit" t={t} accent={accent}>
        <EinstellZeile label="Kontakte löschen erlauben"
          sub={'Zeigt den Löschen-Button bei Kontakten. Aus Sicherheitsgründen standardmäßig aus — Löschen entfernt den Kontakt mit allen Daten unwiderruflich.'} t={t}>
          <Toggle value={settings.loeschenErlaubtKontakte === true}
            onChange={v => save({ loeschenErlaubtKontakte: v })} color={accent}/>
        </EinstellZeile>
      </EinstellKarte>

      {/* Filter-Pillen neben der Überschrift „Kontakte" (feiner Filter
          INNERHALB des großen Header-Filters) */}
      <EinstellKarte title="Filter-Pillen: Kontaktarten" t={t} accent={accent}>
        <div style={{ fontSize: FS.m, color: t.sub, marginBottom: 8, lineHeight: 1.4 }}>
          Welche Arten als Filter-Pillen neben der Überschrift „Kontakte" erscheinen. Klick auf den Schriftzug „Kontakte" setzt zurück auf alle.
        </div>
        <div style={{ fontSize: FS.xs, fontWeight: FW.bold, color: t.muted,
          textTransform: "uppercase", letterSpacing: "0.05em",
          marginTop: 4, marginBottom: 4 }}>Hauptarten</div>
        {KONTAKTARTEN_KATEGORIEN.map(a => (
          <EinstellZeile key={a.id} label={a.label} t={t}>
            <Toggle value={!!kart[a.id]}
              onChange={v => save({ filterKontaktarten: { ...kart, [a.id]: v } })}
              color={accent}/>
          </EinstellZeile>
        ))}
        <div style={{ fontSize: FS.xs, fontWeight: FW.bold, color: t.muted,
          textTransform: "uppercase", letterSpacing: "0.05em",
          marginTop: 12, marginBottom: 4 }}>Personen-Rollen</div>
        {(settings.rollen || DEFAULT_ROLLEN).filter(r => r.aktiv !== false).map(r => {
          const id = "p_" + r.name;
          return (
            <EinstellZeile key={id} label={r.name} t={t}>
              <Toggle value={!!kart[id]}
                onChange={v => save({ filterKontaktarten: { ...kart, [id]: v } })}
                color={r.color || accent}/>
            </EinstellZeile>
          );
        })}
        <div style={{ fontSize: FS.xs, fontWeight: FW.bold, color: t.muted,
          textTransform: "uppercase", letterSpacing: "0.05em",
          marginTop: 12, marginBottom: 4 }}>Firmen-Rollen</div>
        {(settings.firmenRollen || DEFAULT_GEWERKE_LISTE).filter(r => r.aktiv !== false).map(r => {
          const id = "f_" + r.name;
          return (
            <EinstellZeile key={id} label={r.name} t={t}>
              <Toggle value={!!kart[id]}
                onChange={v => save({ filterKontaktarten: { ...kart, [id]: v } })}
                color={r.color || accent}/>
            </EinstellZeile>
          );
        })}
      </EinstellKarte>

      {/* Eigene Kontakt-Gruppen → Pillen im Kontakte-Header */}
      <SektionGruppen titel="Kontakt-Gruppen" t={t} accent={accent}
        beschreibung="Eigene Gruppen als Filter-Pillen im Kontakte-Header — kombinierbar mit Personen/Firmen. Manuell zusammenstellen oder nach Rollen — Kriterien-Gruppen halten sich selbst aktuell."
        gruppen={settings.kontaktGruppen || []}
        onChange={(neu) => setSettings(s => ({ ...s, kontaktGruppen: neu }))}
        manuellTitel="Manuell auswählen" kriterienTitel="Nach Rollen"
        kriterienGruppen={[
          { key: "rollen", titel: "Rollen",
            chips: [...(settings.rollen || []), ...(settings.firmenRollen || [])]
              .filter(r => r && r.aktiv !== false)
              .map(r => ({ id: r.name, label: r.name, kurz: r.kuerzel || r.name })) },
        ]}
        eintraege={kontakte.map(k => ({ id: k.id,
          label: k.typ === "firma" ? (k.name || "") : (((k.vorname || "") + " " + (k.nachname || "")).trim() || k.name || ""),
          sub: k.typ === "firma" ? "Firma" : "Person",
          passtKriterien: (g) => kontaktInGruppe(k, g) }))}/>
    </>
  );
}

// ── Sektion: Objekte (Liegenschaft-Tab: Einheit-Übersicht) ──────────────────
// ── Sektion: Eigene Gruppen (für Objekte UND Kontakte, parametrisiert) ──────
// Akkordeon-Liste der Gruppen; je Gruppe: Name, Sichtbarkeits-Toggle (Pille im
// Header), Modus Manuell (Häkchenliste) oder Nach Kriterien (Chips), Löschen.
function SektionGruppen({ titel, beschreibung, gruppen, onChange, t, accent,
  eintraege, kriterienGruppen, kriterienTitel, manuellTitel }) {
  const [offenId, setOffenId] = useState(null);
  const [suche, setSuche] = useState("");
  const liste = gruppen || [];
  const upd = (id, patch) => onChange(liste.map(g => g.id === id ? { ...g, ...patch } : g));
  // Auto-Benennung bei Kriterien-Gruppen: Name = gewählte Kriterien-Labels,
  // Kürzel = deren Abkürzungen (z. B. Rollen-Kürzel). Greift nur, solange der
  // Name nicht von Hand geändert wurde ("Neue Gruppe" oder letzter Auto-Name).
  const autoBenennung = (g) => {
    const labels = [], kurze = [];
    (kriterienGruppen || []).forEach(kg => {
      const sel = (g.kriterien && g.kriterien[kg.key]) || [];
      kg.chips.forEach(c => { if (sel.indexOf(c.id) >= 0) { labels.push(c.label); kurze.push(c.kurz || c.label); } });
    });
    return { name: labels.join(" + "), kurz: kurze.join("+") };
  };
  const toggleKriterium = (g, key, cid) => {
    const krit = (g.kriterien && g.kriterien[key]) || [];
    const neuKrit = { ...(g.kriterien || {}),
      [key]: krit.indexOf(cid) >= 0 ? krit.filter(x => x !== cid) : [...krit, cid] };
    const vorher = autoBenennung(g);
    const istAuto = g.name === "Neue Gruppe" || g.name === vorher.name;
    const nachher = autoBenennung({ ...g, kriterien: neuKrit });
    upd(g.id, istAuto
      ? { kriterien: neuKrit, name: nachher.name || "Neue Gruppe", kurz: nachher.kurz }
      : { kriterien: neuKrit });
  };
  // Löschen mit Inline-Zwei-Schritt statt confirm(): window.confirm ist in
  // iOS-Standalone-PWAs auf etlichen Versionen stumm kaputt (liefert false) —
  // erster Tap macht den Button scharf („Löschen?"), zweiter Tap löscht.
  const [loeschBereitId, setLoeschBereitId] = useState(null);
  const del = (g) => {
    if (loeschBereitId !== g.id) { setLoeschBereitId(g.id); return; }
    onChange(liste.filter(x => x.id !== g.id));
    setLoeschBereitId(null);
    if (offenId === g.id) setOffenId(null);
  };
  const neu = () => {
    const g = { id: "g" + Date.now(), name: "Neue Gruppe", sichtbar: true,
      modus: "manuell", mitglieder: [], kriterien: {} };
    onChange([...liste, g]);
    setOffenId(g.id);
    setSuche("");
  };
  const anzahlIn = (g) => g.modus === "kriterien"
    ? eintraege.filter(e => e.passtKriterien(g)).length
    : (g.mitglieder || []).length;
  const modusPill = (g, id, label) => (
    <button onClick={() => upd(g.id, { modus: id })}
      style={{ padding: "5px 10px", borderRadius: RAD.pill, cursor: "pointer", fontFamily: "inherit",
        fontSize: FS.xs, fontWeight: FW.bold,
        background: g.modus === id ? accent + "22" : "transparent",
        border: `1px solid ${g.modus === id ? accent : t.border}`,
        color: g.modus === id ? accent : t.sub }}>
      {label}
    </button>
  );
  return (
    <EinstellKarte title={titel} t={t} accent={accent}>
      <div style={{ fontSize: FS.s, color: t.sub, marginBottom: 10 }}>{beschreibung}</div>
      <button onClick={neu}
        style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 12px",
          marginBottom: liste.length > 0 ? 10 : 0,
          borderRadius: RAD.sm, cursor: "pointer", fontFamily: "inherit",
          fontSize: FS.s, fontWeight: FW.bold, background: accent + "14",
          border: `1px solid ${accent}40`, color: accent }}>
        <I name="plus" size={12} color={accent}/>Gruppe anlegen
      </button>
      {liste.map(g => {
        const offen = offenId === g.id;
        const treffer = eintraege.filter(e =>
          e.label.toLowerCase().indexOf(suche.toLowerCase()) >= 0).slice(0, 40);
        return (
          <div key={g.id} style={{ border: `1px solid ${offen ? accent : t.border}`,
            borderRadius: offen ? RAD.lg : RAD.md, marginBottom: 8,
            background: offen ? accent + "08" : "transparent" }}>
            <div onClick={() => { setOffenId(offen ? null : g.id); setSuche(""); setLoeschBereitId(null); }}
              style={{ display: "flex", alignItems: "center", gap: 8,
                padding: "9px 12px", cursor: "pointer" }}>
              {offen ? (
                <span onClick={e => e.stopPropagation()}
                  style={{ flex: 1, minWidth: 0, display: "flex", gap: 6 }}>
                  <input value={g.name} autoFocus
                    onChange={e => upd(g.id, { name: e.target.value })}
                    style={{ flex: 1, minWidth: 0, boxSizing: "border-box", background: t.surface,
                      border: `1px solid ${t.border}`, borderRadius: RAD.sm, padding: "6px 9px",
                      fontSize: 16, color: t.text, outline: "none", fontFamily: "inherit" }}/>
                  <input value={g.kurz || ""} placeholder="Kürzel"
                    title="Abkürzung für die Header-Pille"
                    onChange={e => upd(g.id, { kurz: e.target.value })}
                    style={{ width: 76, flexShrink: 0, boxSizing: "border-box", background: t.surface,
                      border: `1px solid ${t.border}`, borderRadius: RAD.sm, padding: "6px 9px",
                      fontSize: 16, color: t.text, outline: "none", fontFamily: "inherit" }}/>
                </span>
              ) : (
                <span style={{ flex: 1, minWidth: 0, fontSize: FS.m, fontWeight: FW.medium,
                  color: t.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {g.name}
                  <span style={{ color: t.muted, fontWeight: FW.regular }}> ({anzahlIn(g)})</span>
                </span>
              )}
              <span onClick={e => e.stopPropagation()} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ fontSize: FS.xs, color: t.muted }}>Pille</span>
                <Toggle value={g.sichtbar !== false} color={accent}
                  onChange={v => upd(g.id, { sichtbar: v })}/>
              </span>
              <button onClick={e => { e.stopPropagation(); del(g); }}
                title={loeschBereitId === g.id ? "Nochmal tippen zum Löschen" : "Gruppe löschen"}
                aria-label="Gruppe löschen"
                style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 4,
                  height: 24, minWidth: 24, flexShrink: 0, cursor: "pointer",
                  padding: loeschBereitId === g.id ? "0 8px" : 0,
                  background: loeschBereitId === g.id ? "#EF4444" : "transparent",
                  border: "1px solid " + (loeschBereitId === g.id ? "#EF4444" : "#EF444440"),
                  borderRadius: RAD.sm, fontFamily: "inherit",
                  fontSize: FS.xs, fontWeight: FW.bold,
                  color: loeschBereitId === g.id ? "#fff" : "#EF4444" }}>
                {loeschBereitId === g.id ? "Löschen?" : <I name="x" size={12} color="#EF4444"/>}
              </button>
            </div>
            {offen && (
              <div style={{ padding: "0 12px 11px 12px" }}>
                <div style={{ display: "flex", gap: 6, marginBottom: 9 }}>
                  {modusPill(g, "manuell", manuellTitel)}
                  {modusPill(g, "kriterien", kriterienTitel)}
                </div>
                {g.modus === "kriterien" ? (
                  <div>
                    {(kriterienGruppen || []).map(kg => (
                      <div key={kg.key} style={{ marginBottom: 8 }}>
                        {kriterienGruppen.length > 1 && (
                          <div style={{ fontSize: FS.xs, fontWeight: FW.bold, color: t.muted,
                            textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 5 }}>{kg.titel}</div>
                        )}
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                          {kg.chips.map(c => {
                            const krit = (g.kriterien && g.kriterien[kg.key]) || [];
                            const an = krit.indexOf(c.id) >= 0;
                            return (
                              <button key={c.id} onClick={() => toggleKriterium(g, kg.key, c.id)}
                                style={{ padding: "5px 10px", borderRadius: RAD.pill, cursor: "pointer",
                                  fontFamily: "inherit", fontSize: FS.xs, fontWeight: FW.bold,
                                  background: an ? accent + "22" : "transparent",
                                  border: `1px solid ${an ? accent : t.border}`,
                                  color: an ? accent : t.sub }}>
                                {c.label}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <>
                    <input value={suche} onChange={e => setSuche(e.target.value)}
                      placeholder="Suchen…"
                      style={{ width: "100%", boxSizing: "border-box", background: t.surface,
                        border: `1px solid ${t.border}`, borderRadius: RAD.sm, padding: "8px 10px",
                        fontSize: 16, color: t.text, outline: "none", fontFamily: "inherit",
                        marginBottom: 7 }}/>
                    <div style={{ maxHeight: 260, overflowY: "auto" }}>
                      {treffer.map(e => {
                        const an = (g.mitglieder || []).indexOf(e.id) >= 0;
                        return (
                          <label key={e.id} style={{ display: "flex", alignItems: "center", gap: 9,
                            padding: "6px 2px", cursor: "pointer", userSelect: "none" }}>
                            <input type="checkbox" checked={an}
                              onChange={() => upd(g.id, { mitglieder: an
                                ? (g.mitglieder || []).filter(x => x !== e.id)
                                : [...(g.mitglieder || []), e.id] })}
                              style={{ accentColor: accent }}/>
                            <span style={{ flex: 1, minWidth: 0, fontSize: FS.m, color: t.text,
                              overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                              {e.label}
                              {e.sub && <span style={{ color: t.muted, fontSize: FS.xs }}> · {e.sub}</span>}
                            </span>
                          </label>
                        );
                      })}
                      {treffer.length === 0 && (
                        <div style={{ fontSize: FS.s, color: t.muted, fontStyle: "italic", padding: "6px 0" }}>
                          Keine Treffer.
                        </div>
                      )}
                    </div>
                  </>
                )}
                <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 10 }}>
                  <button onClick={() => setOffenId(null)}
                    title="Fertig — Gruppe schließen" aria-label="Fertig"
                    style={{ display: "flex", alignItems: "center", gap: 5,
                      padding: "6px 12px", background: accent + "15",
                      border: `1px solid ${accent}40`, borderRadius: RAD.sm,
                      fontSize: FS.s, fontWeight: FW.medium, color: accent,
                      cursor: "pointer", fontFamily: "inherit" }}>
                    <I name="check" size={12} color={accent}/>Fertig
                  </button>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </EinstellKarte>
  );
}

function SektionObjekte({ settings, setSettings, t, accent, ves = [] }) {
  const save = (partial) => setSettings(s => ({ ...s, ...partial }));
  // Sichtbarkeit der Verwaltungsart-Pillen neben der Überschrift „Objekte".
  const verw = settings.filterVerwaltungsarten || { weg: true, miet: false, gewerbe: false, sev: false };
  return (
    <>
      {/* ── Handlungsbedarf-Punkt ── welche Fristen den Status-Punkt an Objekten
          bestimmen und ab wann Gelb greift (DESIGN §36). Anker-id für den
          Sprung aus der Objekt-Legende. */}
      <EinstellKarte title="Einheit-Übersicht im Liegenschaft-Tab" t={t} accent={accent}>
        <EinstellZeile label="Fläche anzeigen"
          sub={'z. B. „128 m²“ in der Einheit-Zeile'} t={t}>
          <Toggle value={settings.einheitAnzeigeFlaeche !== false}
            onChange={v => save({ einheitAnzeigeFlaeche: v })} color={accent}/>
        </EinstellZeile>
        <EinstellZeile label="MEA anzeigen"
          sub={'Miteigentumsanteil, z. B. „MEA 100/1000“'} t={t}>
          <Toggle value={settings.einheitAnzeigeMea !== false}
            onChange={v => save({ einheitAnzeigeMea: v })} color={accent}/>
        </EinstellZeile>
        <EinstellZeile label="Eigentümer anzeigen"
          sub={'z. B. „ET Müller“ — Nachname des aktuellen Eigentümers'} t={t}>
          <Toggle value={settings.einheitAnzeigeEigentuemer !== false}
            onChange={v => save({ einheitAnzeigeEigentuemer: v })} color={accent}/>
        </EinstellZeile>
        <EinstellZeile label="Mieter anzeigen"
          sub={'z. B. „MT Schmidt“ — Nachname des aktuellen Mieters (wenn vorhanden)'} t={t}>
          <Toggle value={settings.einheitAnzeigeMieter !== false}
            onChange={v => save({ einheitAnzeigeMieter: v })} color={accent}/>
        </EinstellZeile>
      </EinstellKarte>

      {/* Stammdaten-Karte des Objekts: optionale Auto-Sektionen */}
      <EinstellKarte title="Stammdaten der Liegenschaft" t={t} accent={accent}>
        <EinstellZeile label="Rechnungsadresse anzeigen"
          sub={'Auto-Sektion „c/o Hausverwaltung …“ unter den Stammdaten. Standard: aus.'} t={t}>
          <Toggle value={settings.rechnungsadresseAnzeigen === true}
            onChange={v => save({ rechnungsadresseAnzeigen: v })} color={accent}/>
        </EinstellZeile>
      </EinstellKarte>

      {/* Sicherheit: Löschen-Buttons nur auf bewusste Freigabe sichtbar */}
      <EinstellKarte title="Sicherheit" t={t} accent={accent}>
        <EinstellZeile label="Objekte löschen erlauben"
          sub={'Zeigt den Löschen-Button bei Objekten. Aus Sicherheitsgründen standardmäßig aus — Löschen entfernt das Objekt mit allen Einheiten und Daten unwiderruflich.'} t={t}>
          <Toggle value={settings.loeschenErlaubtObjekte === true}
            onChange={v => save({ loeschenErlaubtObjekte: v })} color={accent}/>
        </EinstellZeile>
      </EinstellKarte>

      {/* Filter-Pillen neben der Überschrift „Objekte" (feiner Filter
          INNERHALB des großen Header-Filters) */}
      <EinstellKarte title="Filter-Pillen: Verwaltungsarten" t={t} accent={accent}>
        <div style={{ fontSize: FS.m, color: t.sub, marginBottom: 8, lineHeight: 1.4 }}>
          Welche Verwaltungsarten als Filter-Pillen neben der Überschrift „Objekte" erscheinen. Klick auf den Schriftzug „Objekte" setzt zurück auf alle.
        </div>
        {VERWALTUNGSARTEN.map(a => (
          <EinstellZeile key={a.id} label={a.label} t={t}>
            <Toggle value={!!verw[a.id]}
              onChange={v => save({ filterVerwaltungsarten: { ...verw, [a.id]: v } })}
              color={accent}/>
          </EinstellZeile>
        ))}
      </EinstellKarte>

      {/* Eigene Objekt-Gruppen → Pillen im Objekte-Header + Sektion im Header-Filter.
          div-Anker: Sprungziel des Buttons in Einstellungen → Filter-Optionen. */}
      <div id="einstell-objektgruppen" style={{ scrollMarginTop: "var(--ad-header-h, 200px)" }}>
      <SektionGruppen titel="Objekt-Gruppen" t={t} accent={accent}
        beschreibung="Eigene Gruppen als Filter-Pillen im Objekte-Header und als Sektion im großen Header-Filter. Manuell zusammenstellen oder nach Kriterien (Verwaltungsart, Ort) — Kriterien-Gruppen halten sich selbst aktuell."
        gruppen={settings.objektGruppen || []}
        onChange={(neu) => setSettings(s => ({ ...s, objektGruppen: neu }))}
        manuellTitel="Manuell auswählen" kriterienTitel="Nach Kriterien"
        kriterienGruppen={[
          { key: "verwaltungsarten", titel: "Verwaltungsart",
            chips: VERWALTUNGSARTEN.map(a => ({ id: a.id, label: a.label, kurz: a.kurz || a.label })) },
          { key: "orte", titel: "Ort",
            chips: Array.from(new Set(ves.map(objektOrt).filter(Boolean))).sort()
              .map(o => ({ id: o, label: o, kurz: o })) },
        ]}
        eintraege={ves.map(v => ({ id: v.id,
          label: v.nr || v.name || ("Objekt " + v.id),
          sub: v.adresse || "",
          passtKriterien: (g) => objektInGruppe(v, g) }))}/>
      </div>

      {/* Kategorien: gemeinsame Kürzel+Farbe für Verwendung↔Rolle-Paare */}
      <EinstellKarte title="Kategorien" t={t} accent={accent}>
        <KategorienTabelle settings={settings} setSettings={setSettings} t={t} accent={accent}/>
      </EinstellKarte>

      {/* Verwendungen pro Einheit (analog zu Kontakt-Rollen) */}
      <EinstellKarte title="Verwendungen" t={t} accent={accent}>
        <VerwendungenTabelle settings={settings} setSettings={setSettings} t={t} accent={accent}/>
      </EinstellKarte>

      {/* Objekt-Detail-Tabs: Reihenfolge & Sichtbarkeit der Reiter */}
      <SektionObjektTabs settings={settings} setSettings={setSettings} t={t} accent={accent}/>

    </>
  );
}

// ── Sektion: Filter-Optionen (globaler Header-Filter, DESIGN §32) ───────────
// Pro Eintrag (Verwalter, Verwaltungsart, Objekt-Gruppe) EINE Zeile mit drei
// kompakten Schaltern: Anzeigen | Personen mitfiltern | Firmen mitfiltern.
function SektionFilterOpt({ settings, setSettings, t, accent, ves = [], kontakte = [] }) {
  const save = (partial) => setSettings(s => ({ ...s, ...partial }));
  const filterTyp = settings.filterTyp || "verwalter";
  const feld = filterTyp === "buchhalter" ? "buchhalter" : "verwalter";

  // Eintrags-Konfiguration schreiben: { [sektion]: { [id]: {anzeigen,personen,firmen} } }
  const setEintrag = (sektion, id, key, v) => {
    const alle = settings.filterEintraege || {};
    const sek = alle[sektion] || {};
    const c = sek[id] || {};
    const patch = { filterEintraege: { ...alle,
      [sektion]: { ...sek, [id]: { ...c, [key]: v } } } };
    // Alte Verwalter-Sichtbarkeit (filterAktive) aufräumen, damit der
    // Rückwärts-Fallback ein neu gesetztes anzeigen=true nicht übersteuert.
    if (sektion === "verwalter" && key === "anzeigen" && v === true
        && settings.filterAktive && settings.filterAktive[id] === false) {
      const alt = { ...settings.filterAktive };
      delete alt[id];
      patch.filterAktive = alt;
    }
    save(patch);
  };
  const conf = (sektion, id) => filterEintragConf(settings, sektion, id);

  // ── Drei-Schalter-Zeile + Spaltenkopf ────────────────────────────────────
  const SPALTE_W = 46; // Breite je Toggle-Spalte (Toggle zentriert)
  const spalte = (inhalt, key) => (
    <div key={key} style={{ width: SPALTE_W, flexShrink: 0, display: "flex",
      alignItems: "center", justifyContent: "center" }}>{inhalt}</div>
  );
  const kopfzeile = (
    <div style={{ display: "flex", alignItems: "flex-end", gap: 2,
      padding: "2px 6px 6px", borderBottom: `1px solid ${t.border}40` }}>
      <div style={{ flex: 1, minWidth: 0 }}/>
      {spalte(<span style={{ fontSize: FS.xs, fontWeight: FW.bold, color: t.muted,
        textTransform: "uppercase", letterSpacing: "0.04em" }}>Zeigen</span>, "h1")}
      {spalte(<span style={{ fontSize: FS.xs, fontWeight: FW.bold, color: t.muted,
        textTransform: "uppercase", letterSpacing: "0.04em" }}>Pers.</span>, "h2")}
      {spalte(<span style={{ fontSize: FS.xs, fontWeight: FW.bold, color: t.muted,
        textTransform: "uppercase", letterSpacing: "0.04em" }}>Firmen</span>, "h3")}
      {spalte(<span style={{ fontSize: FS.xs, fontWeight: FW.bold, color: t.muted,
        textTransform: "uppercase", letterSpacing: "0.04em" }}>Term.</span>, "h4")}
    </div>
  );
  const zeile = (sektion, id, label, sub) => {
    const c = conf(sektion, id);
    return (
      <div key={sektion + "_" + id} style={{ display: "flex", alignItems: "center", gap: 2,
        padding: "9px 6px", borderBottom: `1px solid ${t.border}25` }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: FS.l, color: t.text, overflow: "hidden",
            textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{label}</div>
          {sub && <div style={{ fontSize: FS.s, color: t.muted, marginTop: 1 }}>{sub}</div>}
        </div>
        {spalte(<Toggle value={c.anzeigen}
          onChange={v => setEintrag(sektion, id, "anzeigen", v)} color={accent}/>, "t1")}
        {spalte(<Toggle value={c.personen}
          onChange={v => setEintrag(sektion, id, "personen", v)} color={accent}/>, "t2")}
        {spalte(<Toggle value={c.firmen}
          onChange={v => setEintrag(sektion, id, "firmen", v)} color={accent}/>, "t3")}
        {spalte(<Toggle value={c.termine}
          onChange={v => setEintrag(sektion, id, "termine", v)} color={accent}/>, "t4")}
      </div>
    );
  };

  // Dynamische Liste aller in den Objekten vergebenen Verwalter/Buchhalter.
  // Original-ID-Typ erhalten (Object.keys würde Zahlen zu Strings machen).
  const gefunden = [];
  ves.forEach(ve => {
    const id = ve.verwaltung && ve.verwaltung[feld];
    if (id == null || id === "") return;
    const e = gefunden.find(x => x.id === id);
    if (e) e.count += 1; else gefunden.push({ id, count: 1 });
  });
  const personen = gefunden.map(({ id, count }) => {
    const k = kontakte.find(x => x.id === id);
    const name = k
      ? (k.typ === "firma"
          ? k.name
          : [k.nachname, k.vorname].filter(Boolean).join(", ") || k.name || String(id))
      : String(id);
    return { id, name, count };
  }).sort((a, b) => a.name.localeCompare(b.name, "de"));

  const gruppen = settings.objektGruppen || [];

  return (
    <>
      <EinstellKarte title="Filter im Header" t={t} accent={accent}>
        <div style={{ fontSize: FS.m, color: t.sub, marginBottom: 10, lineHeight: 1.4 }}>
          Der grobe Filter im App-Header — Mehrfachauswahl über die Sektionen
          Verwalter/Buchhalter, Verwaltungsart und Objekt-Gruppen, beliebig
          kombinierbar. Ein gesetzter Filter wirkt app-weit. Je Eintrag vier
          Schalter: „Zeigen" (erscheint im Dropdown), „Pers." und „Firmen"
          (blendet bei gesetztem Filter Personen bzw. Firmen ohne Bezug zu den
          gefilterten Objekten aus) sowie „Term." (beschränkt auch die
          Kalender-Termine auf die gefilterten Objekte). Die Pillen an den Listen-Überschriften
          filtern zusätzlich fein INNERHALB dieser Menge (einstellbar unter
          Objekte bzw. Kontakte).
        </div>
        <EinstellZeile label="Filtern nach"
          sub="Verwalter oder Buchhalter der Objekte" t={t}>
          <div style={{ display: "flex", gap: 4, background: t.surface,
            border: `1px solid ${t.border}`, borderRadius: RAD.md, padding: 3 }}>
            {[
              { id: "verwalter",  label: "Verwalter" },
              { id: "buchhalter", label: "Buchhalter" },
            ].map(opt => {
              const aktiv = filterTyp === opt.id;
              return (
                <button key={opt.id} onClick={() => save({ filterTyp: opt.id })} style={{
                  background: aktiv ? accent : "transparent",
                  color: aktiv ? "#fff" : t.sub,
                  border: "none", borderRadius: RAD.sm,
                  padding: "5px 12px", cursor: "pointer",
                  fontFamily: "inherit", fontSize: FS.m, fontWeight: FW.medium }}>
                  {opt.label}
                </button>
              );
            })}
          </div>
        </EinstellZeile>
      </EinstellKarte>

      <EinstellKarte title={filterTyp === "buchhalter" ? "Buchhalter" : "Verwalter"}
        t={t} accent={accent}>
        <div style={{ fontSize: FS.m, color: t.sub, marginBottom: 6, lineHeight: 1.4 }}>
          {personen.length === 0
            ? `Keine ${filterTyp === "buchhalter" ? "Buchhalter" : "Verwalter"} in den Objekten eingetragen. Zuordnung erfolgt im Objekt-Detail unter „Verwaltung“.`
            : "Automatisch aus den Objekten gelesen. Zuordnung im Objekt-Detail."}
        </div>
        {personen.length > 0 && kopfzeile}
        {personen.map(p => zeile("verwalter", p.id, p.name,
          `${p.count} ${p.count === 1 ? "Objekt" : "Objekte"}`))}
      </EinstellKarte>

      <EinstellKarte title="Verwaltungsarten" t={t} accent={accent}>
        <div style={{ fontSize: FS.m, color: t.sub, marginBottom: 6, lineHeight: 1.4 }}>
          Im Dropdown erscheinen nur Arten, die in den Objekten vorkommen.
        </div>
        {kopfzeile}
        {VERWALTUNGSARTEN.map(a => {
          const count = ves.filter(v => (v.verwaltungsart || "weg") === a.id).length;
          return zeile("arten", a.id, a.label,
            `${count} ${count === 1 ? "Objekt" : "Objekte"}`);
        })}
      </EinstellKarte>

      <EinstellKarte title="Objekt-Gruppen" t={t} accent={accent}>
        <div style={{ fontSize: FS.m, color: t.sub, marginBottom: 8, lineHeight: 1.4 }}>
          „Zeigen" wirkt nur auf den Header-Filter — angelegt und verwaltet
          werden die Gruppen unter Objekte.
        </div>
        <button onClick={() => {
            try {
              window.dispatchEvent(new CustomEvent("allesda:zentrale-sektion",
                { detail: { id: "objekte" } }));
              // Nach dem Sektions-Auto-Scroll gezielt zur Gruppen-Karte.
              setTimeout(() => {
                const el = document.getElementById("einstell-objektgruppen");
                if (el && el.scrollIntoView) el.scrollIntoView({ block: "start", behavior: "smooth" });
              }, 350);
            } catch (err) {}
          }}
          style={{ display: "flex", alignItems: "center", gap: 6,
            padding: "8px 12px", marginBottom: 10, borderRadius: RAD.sm,
            cursor: "pointer", fontFamily: "inherit",
            fontSize: FS.s, fontWeight: FW.bold,
            background: accent + "14", border: `1px solid ${accent}40`, color: accent }}>
          Objekt-Gruppen verwalten
        </button>
        {gruppen.length === 0 ? (
          <div style={{ fontSize: FS.s, color: t.muted, fontStyle: "italic", padding: "6px 0" }}>
            Noch keine Objekt-Gruppen angelegt.
          </div>
        ) : (
          <>
            {kopfzeile}
            {gruppen.map(g => {
              const count = ves.filter(v => objektInGruppe(v, g)).length;
              return zeile("gruppen", g.id, g.name || g.kurz || "Gruppe",
                `${count} ${count === 1 ? "Objekt" : "Objekte"}`);
            })}
          </>
        )}
      </EinstellKarte>
    </>
  );
}

// ── Sektion: Objekt-Tabs ────────────────────────────────────────────────────
// Reihenfolge (Pfeile) + Sichtbarkeit (Toggle) der Objekt-Detail-Reiter, global.
// Liegenschaft + Verwaltung sind fix: immer sichtbar, nicht verschiebbar und an
// erster/zweiter Stelle. Die übrigen Tabs sind frei sortier- und ausblendbar.
function SektionObjektTabs({ settings, setSettings, t, accent }) {
  const save = (partial) => setSettings(s => ({ ...s, ...partial }));
  const DEF = (DEFAULT_SETTINGS.objektTabs || []);
  const tabs = (settings.objektTabs && settings.objektTabs.length ? settings.objektTabs : DEF);
  const sortiert = [...tabs].sort((a, b) => (a.reihenfolge || 0) - (b.reihenfolge || 0));
  // Fixe Tabs (Liegenschaft/Verwaltung) zuerst, dann die frei sortierbaren.
  const fixe = sortiert.filter(x => x.fix);
  const frei = sortiert.filter(x => !x.fix);

  // Verschiebt einen frei sortierbaren Tab innerhalb des freien Blocks.
  const verschiebe = (idx, richtung) => {
    const ziel = idx + richtung;
    if (ziel < 0 || ziel >= frei.length) return;
    const neu = frei.slice();
    const tmp = neu[idx]; neu[idx] = neu[ziel]; neu[ziel] = tmp;
    // Reihenfolge neu durchschreiben: fixe behalten ihre vorderen Plätze.
    const reihen = {};
    fixe.forEach((x, i) => { reihen[x.id] = i; });
    neu.forEach((x, i) => { reihen[x.id] = fixe.length + i; });
    save({ objektTabs: tabs.map(x => ({ ...x, reihenfolge: reihen[x.id] })) });
  };
  const setAktiv = (id, v) =>
    save({ objektTabs: tabs.map(x => x.id === id ? { ...x, aktiv: v } : x) });

  const zeile = (tab, idx, sortierbar) => (
    <div key={tab.id} style={{ display: "flex", alignItems: "center", gap: 8,
      padding: "8px 6px", borderBottom: `1px solid ${t.border}25`, borderRadius: RAD.sm }}>
      {sortierbar ? (
        <SortierPfeile canUp={idx > 0} canDown={idx < frei.length - 1}
          onUp={() => verschiebe(idx, -1)} onDown={() => verschiebe(idx, +1)}
          t={t} accent={accent}/>
      ) : (
        <div style={{ width: 20, flexShrink: 0 }}/>
      )}
      <div style={{ width: 28, height: 28, borderRadius: RAD.ms, flexShrink: 0,
        background: accent + "20", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <I name={tab.icon} size={13} color={accent}/>
      </div>
      <div style={{ flex: 1, fontSize: FS.l, color: t.text }}>
        {tab.label}
        {tab.fix && <span style={{ fontSize: FS.xs, color: t.muted, marginLeft: 6 }}>· fest</span>}
      </div>
      {tab.fix ? (
        <span style={{ fontSize: FS.xs, color: t.muted, fontStyle: "italic" }}>immer sichtbar</span>
      ) : (
        <Toggle value={tab.aktiv !== false}
          onChange={v => setAktiv(tab.id, v)} color={accent}/>
      )}
    </div>
  );

  return (
    <EinstellKarte title="Objekt-Tabs" t={t} accent={accent}>
      <div style={{ fontSize: FS.m, color: t.sub, marginBottom: 8 }}>
        Reihenfolge und Sichtbarkeit der Reiter im Objekt (Liegenschaft, Verwaltung …).
        <span style={{ color: t.muted }}> Liegenschaft und Verwaltung bleiben fest vorne.</span>
      </div>
      {fixe.map((tab) => zeile(tab, -1, false))}
      {frei.map((tab, i) => zeile(tab, i, true))}
      <div style={{ marginTop: 10, textAlign: "right" }}>
        <button onClick={() => save({ objektTabs: DEF.map(x => ({ ...x })) })} style={{
          background: "none", border: `1px solid ${t.border}`, color: t.sub,
          borderRadius: RAD.sm, padding: "5px 12px", cursor: "pointer",
          fontSize: FS.s, fontFamily: "inherit" }}>
          Zurücksetzen
        </button>
      </div>
    </EinstellKarte>
  );
}

// ── Sektion: Dashboard ──────────────────────────────────────────────────────
function SektionDashboard({ settings, setSettings, t, accent }) {
  const save = (partial) => setSettings(s => ({ ...s, ...partial }));
  const sortierteKacheln = [...settings.kacheln].sort((a, b) => a.reihenfolge - b.reihenfolge);
  const dashboardAktiv = settings.dashboardModus !== "aus";

  // ── Umsortieren per Pfeil (hoch/runter) ──
  // Vertauscht den Eintrag an Position idx mit seinem Nachbarn (richtung -1/+1)
  // und schreibt die Reihenfolge-Werte neu durch.
  const verschiebeKachel = (idx, richtung) => {
    const ziel = idx + richtung;
    if (ziel < 0 || ziel >= sortierteKacheln.length) return;
    const neu = sortierteKacheln.slice();
    const tmp = neu[idx]; neu[idx] = neu[ziel]; neu[ziel] = tmp;
    const reihenfolgeMap = {};
    neu.forEach((k, i) => { reihenfolgeMap[k.id] = i; });
    save({ kacheln: settings.kacheln.map(k => ({ ...k, reihenfolge: reihenfolgeMap[k.id] })) });
  };

  return (
    <EinstellKarte title="Dashboard" t={t} accent={accent}>
      <EinstellZeile label="Dashboard anzeigen" sub="Kategorien als Navigationsleiste oben" t={t}>
        <Toggle value={dashboardAktiv}
          onChange={v => save({ dashboardModus: v ? "immer" : "aus" })} color={accent}/>
      </EinstellZeile>
      {dashboardAktiv && (
        <EinstellZeile label="Auf allen Seiten" sub="An: immer · Aus: nur Startseite" t={t}>
          <Toggle value={settings.dashboardModus === "immer"}
            onChange={v => save({ dashboardModus: v ? "immer" : "home" })} color={accent}/>
        </EinstellZeile>
      )}
      {dashboardAktiv && (
        <EinstellZeile label="Beim Scrollen sichtbar bleiben"
          sub="An: bleibt im Hochkant unter dem Header · Aus: scrollt mit weg" t={t}>
          <Toggle value={settings.dashboardSticky === true}
            onChange={v => save({ dashboardSticky: v })} color={accent}/>
        </EinstellZeile>
      )}
      <div style={{ paddingTop: 10, marginTop: 4, borderTop: `1px solid ${t.border}30` }}>
        <div style={{ fontSize: FS.m, fontWeight: FW.medium, color: t.sub, marginBottom: 8 }}>
          Kacheln & Reihenfolge <span style={{ fontWeight: FW.regular, color: t.muted }}>— Pfeile zum Umsortieren</span>
        </div>
        {sortierteKacheln.map((k, i) => {
          return (
            <div key={k.id}
              style={{
                display: "flex", alignItems: "center", gap: 8,
                padding: "8px 6px", borderBottom: `1px solid ${t.border}25`,
                borderRadius: RAD.sm,
              }}>
              <SortierPfeile
                canUp={i > 0} canDown={i < sortierteKacheln.length - 1}
                onUp={() => verschiebeKachel(i, -1)} onDown={() => verschiebeKachel(i, +1)}
                t={t} accent={accent}/>
              <div style={{ width: 28, height: 28, borderRadius: RAD.ms, flexShrink: 0,
                background: k.farbe + "20", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <I name={k.icon} size={13} color={k.farbe}/>
              </div>
              <div style={{ flex: 1, fontSize: FS.l, color: t.text }}>{k.label}</div>
              {(settings.farbIntensitaet != null ? settings.farbIntensitaet : 100) > 0 && (
                <FarbPicker value={k.farbe}
                  onChange={(c) => save({ kacheln: settings.kacheln.map(x => x.id === k.id ? { ...x, farbe: c } : x) })}
                  t={t} verwendeteFarben={sammleVerwendeteFarben(settings)}/>
              )}
              <Toggle value={k.aktiv}
                onChange={v => save({ kacheln: settings.kacheln.map(x => x.id === k.id ? { ...x, aktiv: v } : x) })}
                color={k.farbe}/>
            </div>
          );
        })}
      </div>
    </EinstellKarte>
  );
}

// ── VerwendungenTabelle ─────────────────────────────────────────────────────
// Analog RollenTabelle, aber für Objekt-Verwendungen (Wohnen, Vermietet, …).
// ── KategorienTabelle ───────────────────────────────────────────────────────
// Gemeinsame Quelle für Kürzel + Farbe der Paare (Miete=Vermietet/Mieter,
// Nießbrauch, Wohnrecht, SEV). Hier EINMAL gepflegt; Verwendung UND Rolle erben
// die Werte (siehe effKuerzel/effColor). „Weniger ist mehr": kein Doppel-Pflegen.
function KategorienTabelle({ settings, setSettings, t, accent }) {
  const kategorien = settings.kategorien || DEFAULT_KATEGORIEN;
  const [editId, setEditId] = useState(null);
  const [fLabel, setFLabel] = useState("");
  const [fKuerzel, setFKuerzel] = useState("");
  const [fColor, setFColor] = useState(accent);
  const [resetConfirm, setResetConfirm] = useState(false);

  const update = (neu) => setSettings(s => ({ ...s, kategorien: neu }));
  const startEdit = (k) => { setEditId(k.id); setFLabel(k.label || ""); setFKuerzel(k.kuerzel || ""); setFColor(k.color || accent); };
  const abbrechen = () => { setEditId(null); };
  const speichern = () => {
    const kuerzel = (fKuerzel.trim() || (fLabel.trim().slice(0, 2))).toUpperCase().slice(0, 3);
    update(kategorien.map(k => k.id === editId ? { ...k, label: fLabel.trim() || k.label, kuerzel, color: fColor } : k));
    abbrechen();
  };
  const aufStandard = () => {
    if (!resetConfirm) { setResetConfirm(true); return; }
    update(DEFAULT_KATEGORIEN.map(d => ({ ...d })));
    setResetConfirm(false);
  };
  useEffect(() => {
    if (!resetConfirm) return;
    const tid = setTimeout(() => setResetConfirm(false), 4000);
    return () => clearTimeout(tid);
  }, [resetConfirm]);

  const inputStyle = feldInput(t, { padding: "6px 8px" });

  return (
    <>
      <div style={{ fontSize: FS.m, color: t.sub, marginBottom: 10, lineHeight: 1.4 }}>
        Kategorien bündeln Kürzel und Farbe für Begriffe, die sowohl als Verwendung (am Objekt)
        als auch als Rolle (am Kontakt) vorkommen — z. B. „Miete" für Vermietet und Mieter.
        Hier einmal gepflegt, erscheint es überall gleich.
      </div>

      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 8 }}>
        <button onClick={aufStandard}
          style={{ fontSize: FS.xs, padding: "4px 10px", background: resetConfirm ? "#EF4444" : "none",
            color: resetConfirm ? "#FFFFFF" : t.sub, border: `1px solid ${resetConfirm ? "#EF4444" : t.border}`,
            borderRadius: RAD.sm, cursor: "pointer", fontWeight: FW.medium, fontFamily: "inherit" }}>
          {resetConfirm ? "Wirklich zurücksetzen?" : "Auf Standard zurücksetzen"}
        </button>
      </div>

      <div style={{ background: t.surface, border: `1px solid ${t.border}`, borderRadius: RAD.ms, padding: 4 }}>
        {kategorien.map(k => {
          const offen = editId === k.id;
          return (
            <div key={k.id} style={{ marginBottom: 2 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 6px" }}>
                <div style={{ width: 26, height: 26, borderRadius: RAD.full,
                  background: k.color, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <span style={{ fontSize: FS.xxs, fontWeight: FW.heavy, color: getContrastColor(k.color) }}>{k.kuerzel}</span>
                </div>
                <span style={{ flex: 1, minWidth: 0, fontSize: FS.m, color: t.text, fontWeight: FW.medium }}>{k.label}</span>
                <button onClick={() => offen ? abbrechen() : startEdit(k)}
                  style={{ background: "none", border: `1px solid ${t.border}`, borderRadius: RAD.sm,
                    width: 28, height: 28, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <I name="pencil" size={12} color={offen ? accent : t.sub}/>
                </button>
              </div>
              {offen && (
                <div style={{ padding: "8px 6px 10px", borderTop: `1px solid ${t.border}` }}>
                  <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                    <input type="text" value={fLabel} onChange={e => setFLabel(e.target.value)}
                      placeholder="Bezeichnung" style={{ ...inputStyle, flex: 1, minWidth: 120 }}/>
                    <input type="text" value={fKuerzel} onChange={e => setFKuerzel(e.target.value)}
                      placeholder="Kürzel" maxLength={3} style={{ ...inputStyle, width: 70, textAlign: "center" }}/>
                    <FarbPicker value={fColor} onChange={setFColor} t={t}
                      verwendeteFarben={sammleVerwendeteFarben(settings)}/>
                  </div>
                  <div style={{ display: "flex", gap: 6, justifyContent: "flex-end", marginTop: 10 }}>
                    <button onClick={abbrechen}
                      style={{ fontSize: FS.s, padding: "5px 12px", background: "none", color: t.sub,
                        border: `1px solid ${t.border}`, borderRadius: RAD.sm, cursor: "pointer", fontWeight: FW.medium, fontFamily: "inherit" }}>
                      Abbrechen
                    </button>
                    <button onClick={speichern}
                      style={{ fontSize: FS.s, padding: "5px 12px", background: accent, color: getContrastColor(accent),
                        border: "none", borderRadius: RAD.sm, cursor: "pointer", fontWeight: FW.bold, fontFamily: "inherit" }}>
                      Speichern
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </>
  );
}

// Zeigt pro Verwendung Toggle für Eck-Icon, Position-Selector und Toggle für
// Karten-Badge. Live-Vorschau über eine echte VEKachel mit einer Beispiel-WE
// in der gewählten Verwendung.
function VerwendungenTabelle({ settings, setSettings, t, accent }) {
  const verwendungen = settings.verwendungen || DEFAULT_VERWENDUNGEN;
  const kategorien = settings.kategorien || DEFAULT_KATEGORIEN;
  const [selName, setSelName] = useState((verwendungen[0] || {}).name || "");
  const [bearbeiten, setBearbeiten] = useState(false); // Schreibschutz: erst freischalten
  const [formOffen, setFormOffen] = useState(false);
  const [editName, setEditName] = useState(null);
  const [fName, setFName] = useState("");
  const [fKuerzel, setFKuerzel] = useState("");
  const [fColor, setFColor] = useState(accent);
  const [resetConfirm, setResetConfirm] = useState(false);

  useEffect(() => {
    if (!verwendungen.find(v => v.name === selName)) {
      setSelName((verwendungen[0] || {}).name || "");
    }
  }, [verwendungen.length]); // eslint-disable-line react-hooks/exhaustive-deps
  const selVerw = verwendungen.find(v => v.name === selName);

  const update = (neu) => setSettings(s => ({ ...s, verwendungen: neu }));
  const toggleEckSichtbar = (name) =>
    update(verwendungen.map(v => v.name === name ? { ...v, eckSichtbar: !verwendungEckSichtbar(v) } : v));
  const setEckPosition = (name, pos) =>
    update(verwendungen.map(v => v.name === name ? { ...v, eckPosition: pos } : v));
  const toggleBadgeSichtbar = (name) =>
    update(verwendungen.map(v => v.name === name ? { ...v, badgeSichtbar: !verwendungBadgeSichtbar(v) } : v));
  const loeschen = (name) => update(verwendungen.filter(v => v.name !== name));

  const startNeu = () => { setEditName(null); setFName(""); setFKuerzel(""); setFColor(accent); setFormOffen(true); };
  const startEdit = (v) => { setEditName(v.name); setFName(v.name); setFKuerzel(v.kuerzel || ""); setFColor(v.color || accent); setFormOffen(true); };
  const abbrechen = () => { setFormOffen(false); setEditName(null); };
  const speichern = () => {
    const name = fName.trim();
    if (!name) return;
    const kuerzel = (fKuerzel.trim() || name.slice(0, 2)).toUpperCase().slice(0, 3);
    if (editName) {
      update(verwendungen.map(v => v.name === editName ? { ...v, name, kuerzel, color: fColor } : v));
    } else {
      if (verwendungen.some(v => v.name.toLowerCase() === name.toLowerCase())) { abbrechen(); return; }
      update([...verwendungen, { name, kuerzel, color: fColor, aktiv: true }]);
    }
    abbrechen();
  };
  const aufStandard = () => {
    if (!resetConfirm) { setResetConfirm(true); return; }
    update(DEFAULT_VERWENDUNGEN.map(d => ({ ...d })));
    setResetConfirm(false);
  };
  useEffect(() => {
    if (!resetConfirm) return;
    const tid = setTimeout(() => setResetConfirm(false), 4000);
    return () => clearTimeout(tid);
  }, [resetConfirm]);

  const inputStyle = feldInput(t, { padding: "6px 8px" });
  const miniBtn = { background: "none", border: `1px solid ${t.border}`, borderRadius: RAD.sm,
    width: 26, height: 26, cursor: "pointer", padding: 0, flexShrink: 0,
    display: "flex", alignItems: "center", justifyContent: "center" };

  // Live-Vorschau: echte VEKachel mit einer Beispiel-WE in der gewählten Verwendung
  const VorschauBox = () => {
    if (!selVerw) return null;
    const eckAn = verwendungEckSichtbar(selVerw);
    const badgeAn = verwendungBadgeSichtbar(selVerw);
    const ecke = verwendungEckPosition(selVerw);
    const beispielVE = {
      id: "vorschau-ve",
      nr: "WEG-Beispiel · WE 1",
      adresse: "Musterstraße 12, 80331 München",
      verwaltung: {},
      einheiten: [
        { id: 1, typ: "Wohneigentum", eigentuemer: [], mieter: [],
          verwendung: { name: selVerw.name, status: "aktiv" } },
      ],
    };
    return (
      <div style={{ marginBottom: 12 }}>
        <div style={{ fontSize: FS.xs, fontWeight: FW.bold, color: t.muted,
          textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6,
          display: "flex", alignItems: "center", gap: 8, justifyContent: "space-between",
          padding: "0 2px" }}>
          <span>Vorschau · „{selVerw.name}"</span>
          <span style={{ fontWeight: FW.semi, textTransform: "none", letterSpacing: 0 }}>
            {eckAn ? `Eck-Icon: ${ecke}` : "Eck-Icon aus"}
            {" · "}
            {badgeAn ? "Karten-Badge an" : "Karten-Badge aus"}
          </span>
        </div>
        <VEKachel ve={beispielVE} t={t} accent={accent} ohneStatus={true}/>
      </div>
    );
  };

  return (
    <>
      <VorschauBox/>

      <div style={{ fontSize: FS.m, color: t.sub, marginBottom: 10, lineHeight: 1.4 }}>
        Pro Verwendung festlegen, ob sie als Eck-Icon am Objekt-Symbol (mit Position)
        und/oder als Karten-Badge erscheint. Zuordnung erfolgt pro Einheit (WE, Stellplatz, TG, …).
        Farbe wird unter Erscheinungsbild eingestellt.
      </div>

      <div style={{ display: "flex", justifyContent: "flex-end", gap: 6, marginBottom: 8 }}>
        {!bearbeiten ? (
          <button onClick={() => setBearbeiten(true)}
            style={{ fontSize: FS.xs, padding: "4px 12px", display: "flex", alignItems: "center", gap: 5,
              background: accent + "20", color: accent,
              border: "none", borderRadius: RAD.sm, cursor: "pointer", fontWeight: FW.bold, fontFamily: "inherit" }}>
            <I name="pencil" size={11} color={accent}/> Bearbeiten
          </button>
        ) : (
          <>
            <button onClick={aufStandard}
              style={{ fontSize: FS.xs, padding: "4px 10px", background: resetConfirm ? "#EF4444" : "none",
                color: resetConfirm ? "#FFFFFF" : t.sub, border: `1px solid ${resetConfirm ? "#EF4444" : t.border}`,
                borderRadius: RAD.sm, cursor: "pointer", fontWeight: FW.medium, fontFamily: "inherit" }}>
              {resetConfirm ? "Wirklich zurücksetzen?" : "Auf Standard zurücksetzen"}
            </button>
            <button onClick={startNeu}
              style={{ fontSize: FS.xs, padding: "4px 10px", background: accent + "20", color: accent,
                border: "none", borderRadius: RAD.sm, cursor: "pointer", fontWeight: FW.bold, fontFamily: "inherit" }}>
              + Hinzufügen
            </button>
            <button onClick={() => { setBearbeiten(false); abbrechen(); }}
              style={{ fontSize: FS.xs, padding: "4px 12px", background: accent, color: getContrastColor(accent),
                border: "none", borderRadius: RAD.sm, cursor: "pointer", fontWeight: FW.bold, fontFamily: "inherit" }}>
              Fertig
            </button>
          </>
        )}
      </div>

      {formOffen && (() => {
        const editV = editName ? verwendungen.find(v => v.name === editName) : null;
        const kat = editV ? kategorieVon(editV, kategorien) : null;
        return (
        <div style={{ marginBottom: 10, padding: 10, background: t.surface,
          border: `1px solid ${accent}40`, borderRadius: RAD.ms }}>
          <div style={{ fontSize: FS.s, fontWeight: FW.bold, color: t.sub, marginBottom: 8 }}>
            {editName ? "Bearbeiten" : "Neu anlegen"}
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            <input type="text" value={fName} onChange={e => setFName(e.target.value)}
              placeholder="Name" autoFocus style={{ ...inputStyle, flex: 1, minWidth: 140 }}/>
            {kat ? (
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <div style={{ width: 26, height: 26, borderRadius: RAD.full, background: kat.color,
                  display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <span style={{ fontSize: FS.xxs, fontWeight: FW.heavy, color: getContrastColor(kat.color) }}>{kat.kuerzel}</span>
                </div>
                <span style={{ fontSize: FS.xs, color: t.muted, fontStyle: "italic" }}>
                  Kürzel und Farbe aus Kategorie „{kat.label}"
                </span>
              </div>
            ) : (
              <>
                <input type="text" value={fKuerzel} onChange={e => setFKuerzel(e.target.value)}
                  placeholder="Kürzel" maxLength={3} style={{ ...inputStyle, width: 70, textAlign: "center" }}/>
                <FarbPicker value={fColor} onChange={setFColor} t={t}
                  verwendeteFarben={sammleVerwendeteFarben(settings)}/>
              </>
            )}
          </div>
          <div style={{ display: "flex", gap: 6, justifyContent: "flex-end", marginTop: 10 }}>
            <button onClick={abbrechen}
              style={{ fontSize: FS.s, padding: "5px 12px", background: "none", color: t.sub,
                border: `1px solid ${t.border}`, borderRadius: RAD.sm, cursor: "pointer", fontWeight: FW.medium, fontFamily: "inherit" }}>
              Abbrechen
            </button>
            <button onClick={speichern} disabled={!fName.trim()}
              style={{ fontSize: FS.s, padding: "5px 12px", background: accent, color: getContrastColor(accent),
                border: "none", borderRadius: RAD.sm, cursor: fName.trim() ? "pointer" : "not-allowed",
                opacity: fName.trim() ? 1 : 0.5, fontWeight: FW.bold, fontFamily: "inherit" }}>
              {editName ? "Speichern" : "Anlegen"}
            </button>
          </div>
        </div>
        );
      })()}

      <div style={{ display: "flex", alignItems: "center", gap: 4,
        padding: "6px 6px", fontSize: FS.xs, fontWeight: FW.bold, color: t.muted,
        textTransform: "uppercase", letterSpacing: "0.05em",
        borderBottom: `1px solid ${t.border}` }}>
        <div style={{ width: 22, flexShrink: 0 }}/>
        <div style={{ flex: 1, minWidth: 0 }}>Verwendung</div>
        <div style={{ width: 48, textAlign: "center", flexShrink: 0 }}>Eck</div>
        <div style={{ width: 28, textAlign: "center", flexShrink: 0 }}>Pos.</div>
        <div style={{ width: 48, textAlign: "center", flexShrink: 0 }}>Badge</div>
      </div>

      <div style={{ background: t.surface, border: `1px solid ${t.border}`,
        borderTop: "none", borderRadius: "0 0 9px 9px", padding: 4 }}>
        {[...verwendungen].sort((a, b) => a.name.localeCompare(b.name, "de")).map((v) => {
          const eckAn = verwendungEckSichtbar(v);
          const badgeAn = verwendungBadgeSichtbar(v);
          const ecke = verwendungEckPosition(v);
          const ist = v.name === selName;
          const markiert = bearbeiten && ist; // Highlight nur im Bearbeiten-Modus
          const vKuerzel = effKuerzel(v, kategorien);
          const vColor = effColor(v, kategorien);
          return (
            <div key={v.name}
              onClick={() => setSelName(v.name)}
              style={{
                display: "flex", alignItems: "center", gap: 4,
                padding: "6px 6px", borderRadius: RAD.sm, cursor: "pointer",
                background: markiert ? vColor + "12" : "transparent",
                border: `1px solid ${markiert ? vColor + "55" : "transparent"}`,
                opacity: !eckAn && !badgeAn ? 0.55 : 1,
                transition: "all 0.12s", marginBottom: 2,
              }}>
              <div style={{ width: 22, height: 22, borderRadius: RAD.full,
                background: vColor + "22", border: `1.5px solid ${vColor}60`,
                display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <span style={{ fontSize: FS.xxs, fontWeight: FW.heavy, color: vColor }}>{vKuerzel}</span>
              </div>
              <span style={{ fontSize: FS.m, flex: 1, minWidth: 0, color: t.text,
                whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                fontWeight: markiert ? 700 : 500 }}>{v.name}</span>
              <div style={{ width: 48, display: "flex", justifyContent: "center", flexShrink: 0 }}
                onClick={(e) => e.stopPropagation()}>
                <Toggle value={eckAn} onChange={() => toggleEckSichtbar(v.name)} t={t} accent={accent}/>
              </div>
              <div style={{ width: 28, display: "flex", justifyContent: "center", flexShrink: 0 }}>
                <PositionSelector aktivePosition={ecke}
                  onSelect={(pos) => setEckPosition(v.name, pos)}
                  farbe={v.color} disabled={!eckAn} t={t}/>
              </div>
              <div style={{ width: 48, display: "flex", justifyContent: "center", flexShrink: 0 }}
                onClick={(e) => e.stopPropagation()}>
                <Toggle value={badgeAn} onChange={() => toggleBadgeSichtbar(v.name)} t={t} accent={accent}/>
              </div>
              {/* Aktionen nur im Bearbeiten-Modus UND bei markierter Zeile. */}
              <div style={{ width: markiert ? 58 : 0, overflow: "hidden", display: "flex",
                justifyContent: "flex-end", gap: 4, flexShrink: 0, transition: "width 0.12s" }}
                onClick={(e) => e.stopPropagation()}>
                {markiert && (
                  <>
                    <button onClick={() => startEdit(v)} style={miniBtn} title="Bearbeiten">
                      <I name="pencil" size={11} color={t.sub}/>
                    </button>
                    <button onClick={() => loeschen(v.name)} style={miniBtn} title="Löschen">
                      <I name="trash" size={11} color="#EF4444"/>
                    </button>
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}

// ── RollenTabelle ───────────────────────────────────────────────────────────
// Verwaltung von Personen-Rollen ODER Firmen-Gewerken — gleiches Tabellen-Layout
// wie VerwendungenTabelle (Spalten: Rolle · Eck-Icon · Pos. · Badge), plus
// Anlegen/Bearbeiten/Löschen/Aktiv und „Auf Standard zurücksetzen". Farbe wird
// hier NICHT gesetzt (das passiert unter Erscheinungsbild) — außer im Anlegen-
// Formular, wo eine Startfarbe nötig ist. `gruppeKey`: "rollen" | "firmenRollen".
function RollenTabelle({ settings, setSettings, t, accent, gruppeKey, defaults, einheit = "Rolle", istFirma = false, ohneBadge = false }) {
  const liste = settings[gruppeKey] || defaults;
  // Personen-Rollen werden nach Slot-Gruppe geordnet (Einheit → Vertretung →
  // Gremium → Firma) statt alphabetisch — so stehen fachlich verwandte Rollen
  // beieinander und die wichtigsten oben. Gewerke/Leistungen bleiben alphabetisch.
  const SLOT_GRUPPE = { ve: 0, sev: 1, gremium: 2, firma: 3 };
  const SLOT_LABEL = { ve: "Einheit / Nutzung", sev: "Vertretung", gremium: "Gremium", firma: "Firma" };
  const ROLLE_RANG = { // Reihenfolge innerhalb der Slot-Gruppe (kleiner = oben)
    "Eigentümer": 0, "Mieter": 1, "Pächter": 2, "Eigennutzer": 3, "Nießbraucher": 4,
    "Wohnberechtigter": 5, "Angehöriger": 6, "Sonstige": 7,
    "Bevollmächtigter": 0, "Betreuer": 1,
    "Verwaltungsbeirat": 0, "Rechnungsprüfer": 1,
    "Verwalter": 0, "Geschäftsführer": 1, "Buchhalter": 2, "Sachbearbeiter": 3,
    "Mitarbeiter": 4, "Ansprechpartner": 5,
  };
  const sortierePersonen = (a, b) => {
    const ga = SLOT_GRUPPE[a.slot]; const gb = SLOT_GRUPPE[b.slot];
    const gA = (ga == null) ? 99 : ga; const gB = (gb == null) ? 99 : gb;
    if (gA !== gB) return gA - gB;
    const ra = ROLLE_RANG[a.name]; const rb = ROLLE_RANG[b.name];
    const rA = (ra == null) ? 99 : ra; const rB = (rb == null) ? 99 : rb;
    if (rA !== rB) return rA - rB;
    return a.name.localeCompare(b.name, "de"); // Fallback: alphabetisch
  };
  const sortiereListe = (arr) => istFirma
    ? [...arr].sort((a, b) => a.name.localeCompare(b.name, "de"))
    : [...arr].sort(sortierePersonen);
  const kategorien = settings.kategorien || DEFAULT_KATEGORIEN;
  const farben = useKontaktFarbe();
  const toggleFarbe = farben.person || accent; // Toggles in Kontakte-Farbe
  const [selName, setSelName] = useState((liste[0] || {}).name || "");
  const [bearbeiten, setBearbeiten] = useState(false); // Schreibschutz: erst freischalten
  const [formOffen, setFormOffen] = useState(false);
  const [editName, setEditName] = useState(null);
  const [fName, setFName] = useState("");
  const [fKuerzel, setFKuerzel] = useState("");
  const [fColor, setFColor] = useState(accent);
  const [fSlot, setFSlot] = useState("gremium");
  const [resetConfirm, setResetConfirm] = useState(false);

  useEffect(() => {
    if (!liste.find(r => r.name === selName)) setSelName((liste[0] || {}).name || "");
  }, [liste.length]); // eslint-disable-line react-hooks/exhaustive-deps

  const update = (neu) => setSettings(s => ({ ...s, [gruppeKey]: neu }));
  const toggleEckSichtbar = (name) =>
    update(liste.map(r => r.name === name ? { ...r, eckSichtbar: !rolleEckSichtbar(r) } : r));
  const setEckPosition = (name, pos) =>
    update(liste.map(r => r.name === name ? { ...r, eckPosition: pos } : r));
  const toggleBadgeSichtbar = (name) =>
    update(liste.map(r => r.name === name ? { ...r, badgeSichtbar: !rolleBadgeSichtbar(r) } : r));
  const loeschen = (name) => update(liste.filter(r => r.name !== name));

  const startNeu = () => { setEditName(null); setFName(""); setFKuerzel(""); setFColor(accent); setFSlot("gremium"); setFormOffen(true); };
  const startEdit = (r) => { setEditName(r.name); setFName(r.name); setFKuerzel(r.kuerzel || ""); setFColor(r.color || accent); setFSlot(r.slot || "gremium"); setFormOffen(true); };
  const abbrechen = () => { setFormOffen(false); setEditName(null); };
  const speichern = () => {
    const name = fName.trim();
    if (!name) return;
    const kuerzel = (fKuerzel.trim() || name.slice(0, 2)).toUpperCase().slice(0, 3);
    // Slot bestimmt die Zuordnung zu den Kontakt-Gruppen. Firmen-Rollen gehören
    // immer in den Firma-Slot; Personen-Rollen bekommen den im Formular gewählten.
    const slot = istFirma ? "firma" : fSlot;
    if (editName) {
      update(liste.map(r => r.name === editName ? { ...r, name, kuerzel, color: fColor, slot } : r));
    } else {
      if (liste.some(r => r.name.toLowerCase() === name.toLowerCase())) { abbrechen(); return; }
      update([...liste, { name, kuerzel, color: fColor, slot, aktiv: true }]);
    }
    abbrechen();
  };
  const aufStandard = () => {
    if (!resetConfirm) { setResetConfirm(true); return; }
    update(defaults.map(d => ({ ...d })));
    setResetConfirm(false);
  };
  useEffect(() => {
    if (!resetConfirm) return;
    const tid = setTimeout(() => setResetConfirm(false), 4000);
    return () => clearTimeout(tid);
  }, [resetConfirm]);

  const inputStyle = feldInput(t, { padding: "6px 8px" });
  const miniBtn = { background: "none", border: `1px solid ${t.border}`, borderRadius: RAD.sm,
    width: 26, height: 26, cursor: "pointer", padding: 0, flexShrink: 0,
    display: "flex", alignItems: "center", justifyContent: "center" };

  // Live-Vorschau: Avatar mit der markierten Rolle als Eck-Badge.
  const selRolle = liste.find(r => r.name === selName);
  const VorschauBox = () => {
    if (!selRolle) return null;
    const eckAn = rolleEckSichtbar(selRolle);
    const badgeAn = rolleBadgeSichtbar(selRolle);
    const ecke = rolleEckPosition(selRolle);
    return (
      <div style={{ marginBottom: 12 }}>
        <div style={{ fontSize: FS.xs, fontWeight: FW.bold, color: t.muted,
          textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8,
          display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 2px" }}>
          <span>Vorschau · „{selRolle.name}"</span>
          <span style={{ fontWeight: FW.semi, textTransform: "none", letterSpacing: 0 }}>
            {eckAn ? `Eck-Icon: ${ecke}` : "Eck-Icon aus"}{" · "}
            {badgeAn ? "Karten-Badge an" : "Karten-Badge aus"}
          </span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12,
          padding: "12px 14px", background: t.surface, border: `1px solid ${t.border}`, borderRadius: RAD.lg }}>
          <Avatar name={istFirma ? "Beispiel GmbH" : "Max Beispiel"} firma={istFirma}
            size={44} accent={toggleFarbe}
            zuweisungen={[{ rolle: selRolle.name, status: "aktiv" }]}/>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ fontSize: FS.xl, fontWeight: FW.bold, color: toggleFarbe }}>
              {istFirma ? "Beispiel GmbH" : "Max Beispiel"}
            </div>
            <div style={{ fontSize: FS.s, color: t.sub }}>{selRolle.name}</div>
          </div>
          {/* Karten-Badge — erscheint rechts auf der echten Kontaktkarte, wenn
              badgeSichtbar an ist. Hier mit der echten RolleBadge dargestellt. */}
          {badgeAn && (
            <div style={{ flexShrink: 0 }}>
              <RolleBadge rolle={selRolle.name} size={22}/>
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <>
      {!ohneBadge && <VorschauBox/>}

      <div style={{ fontSize: FS.m, color: t.sub, marginBottom: 10, lineHeight: 1.4 }}>
        {ohneBadge
          ? `${einheit}en, die eine Firma an einem Objekt erbringt (Beziehung Firma↔Objekt). Name, Kürzel und Farbe werden hier gepflegt — kein Eck-Icon, kein Karten-Badge.`
          : `Pro ${einheit} festlegen, ob sie als Eck-Icon am Avatar (mit Position) und/oder als Karten-Badge erscheint. Farbe wird unter Erscheinungsbild eingestellt.`}
      </div>

      <div style={{ display: "flex", justifyContent: "flex-end", gap: 6, marginBottom: 8 }}>
        {!bearbeiten ? (
          <button onClick={() => setBearbeiten(true)}
            style={{ fontSize: FS.xs, padding: "4px 12px", display: "flex", alignItems: "center", gap: 5,
              background: toggleFarbe + "20", color: toggleFarbe,
              border: "none", borderRadius: RAD.sm, cursor: "pointer", fontWeight: FW.bold, fontFamily: "inherit" }}>
            <I name="pencil" size={11} color={toggleFarbe}/> Bearbeiten
          </button>
        ) : (
          <>
            <button onClick={aufStandard}
              style={{ fontSize: FS.xs, padding: "4px 10px", background: resetConfirm ? "#EF4444" : "none",
                color: resetConfirm ? "#FFFFFF" : t.sub, border: `1px solid ${resetConfirm ? "#EF4444" : t.border}`,
                borderRadius: RAD.sm, cursor: "pointer", fontWeight: FW.medium, fontFamily: "inherit" }}>
              {resetConfirm ? "Wirklich zurücksetzen?" : "Auf Standard zurücksetzen"}
            </button>
            <button onClick={startNeu}
              style={{ fontSize: FS.xs, padding: "4px 10px", background: toggleFarbe + "20", color: toggleFarbe,
                border: "none", borderRadius: RAD.sm, cursor: "pointer", fontWeight: FW.bold, fontFamily: "inherit" }}>
              + Hinzufügen
            </button>
            <button onClick={() => { setBearbeiten(false); abbrechen(); }}
              style={{ fontSize: FS.xs, padding: "4px 12px", background: toggleFarbe, color: getContrastColor(toggleFarbe),
                border: "none", borderRadius: RAD.sm, cursor: "pointer", fontWeight: FW.bold, fontFamily: "inherit" }}>
              Fertig
            </button>
          </>
        )}
      </div>

      {formOffen && (() => {
        const editR = editName ? liste.find(r => r.name === editName) : null;
        const kat = editR ? kategorieVon(editR, kategorien) : null;
        return (
        <div style={{ marginBottom: 10, padding: 10, background: t.surface,
          border: `1px solid ${accent}40`, borderRadius: RAD.ms }}>
          <div style={{ fontSize: FS.s, fontWeight: FW.bold, color: t.sub, marginBottom: 8 }}>
            {editName ? "Bearbeiten" : "Neu anlegen"}
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            <input type="text" value={fName} onChange={e => setFName(e.target.value)}
              placeholder="Name" autoFocus style={{ ...inputStyle, flex: 1, minWidth: 140 }}/>
            {kat ? (
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <div style={{ width: 26, height: 26, borderRadius: RAD.full, background: kat.color,
                  display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <span style={{ fontSize: FS.xxs, fontWeight: FW.heavy, color: getContrastColor(kat.color) }}>{kat.kuerzel}</span>
                </div>
                <span style={{ fontSize: FS.xs, color: t.muted, fontStyle: "italic" }}>
                  Kürzel und Farbe aus Kategorie „{kat.label}"
                </span>
              </div>
            ) : (
              <>
                <input type="text" value={fKuerzel} onChange={e => setFKuerzel(e.target.value)}
                  placeholder="Kürzel" maxLength={3} style={{ ...inputStyle, width: 70, textAlign: "center" }}/>
                <FarbPicker value={fColor} onChange={setFColor} t={t}
                  verwendeteFarben={sammleVerwendeteFarben(settings)}/>
              </>
            )}
          </div>
          {!istFirma && (
            <div style={{ marginTop: 10 }}>
              <div style={{ fontSize: FS.xs, fontWeight: FW.bold, color: t.muted,
                textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 6 }}>
                Gruppe / Zuordnung
              </div>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {[["ve", "Einheit / Nutzung"], ["sev", "Vertretung"], ["gremium", "Gremium"], ["firma", "Firma"]].map(([sid, slabel]) => {
                  const slotAktiv = fSlot === sid;
                  return (
                    <button key={sid} onClick={() => setFSlot(sid)}
                      style={{ padding: "5px 11px", borderRadius: RAD.pill, cursor: "pointer",
                        fontFamily: "inherit", fontSize: FS.xs, fontWeight: FW.bold,
                        background: slotAktiv ? accent + "22" : "transparent",
                        border: `1px solid ${slotAktiv ? accent : t.border}`,
                        color: slotAktiv ? accent : t.sub }}>
                      {slabel}
                    </button>
                  );
                })}
              </div>
              <div style={{ fontSize: FS.xxs, color: t.muted, marginTop: 5, lineHeight: 1.4 }}>
                Bestimmt, in welcher Kontakt-Gruppe die Rolle erscheint (z.\u00a0B. \u201EGremium\u201C f\u00fcr Verwaltungsbeirat).
              </div>
            </div>
          )}
          <div style={{ display: "flex", gap: 6, justifyContent: "flex-end", marginTop: 10 }}>
            <button onClick={abbrechen}
              style={{ fontSize: FS.s, padding: "5px 12px", background: "none", color: t.sub,
                border: `1px solid ${t.border}`, borderRadius: RAD.sm, cursor: "pointer", fontWeight: FW.medium, fontFamily: "inherit" }}>
              Abbrechen
            </button>
            <button onClick={speichern} disabled={!fName.trim()}
              style={{ fontSize: FS.s, padding: "5px 12px", background: accent, color: getContrastColor(accent),
                border: "none", borderRadius: RAD.sm, cursor: fName.trim() ? "pointer" : "not-allowed",
                opacity: fName.trim() ? 1 : 0.5, fontWeight: FW.bold, fontFamily: "inherit" }}>
              {editName ? "Speichern" : "Anlegen"}
            </button>
          </div>
        </div>
        );
      })()}

      <div style={{ display: "flex", alignItems: "center", gap: 4,
        padding: "6px 6px", fontSize: FS.xs, fontWeight: FW.bold, color: t.muted,
        textTransform: "uppercase", letterSpacing: "0.05em",
        borderBottom: `1px solid ${t.border}` }}>
        <div style={{ width: 22, flexShrink: 0 }}/>
        <div style={{ flex: 1, minWidth: 0 }}>{einheit}</div>
        {!ohneBadge && <>
          <div style={{ width: 48, textAlign: "center", flexShrink: 0 }}>Eck</div>
          <div style={{ width: 28, textAlign: "center", flexShrink: 0 }}>Pos.</div>
          <div style={{ width: 48, textAlign: "center", flexShrink: 0 }}>Badge</div>
        </>}
      </div>

      <div style={{ background: t.surface, border: `1px solid ${t.border}`,
        borderTop: "none", borderRadius: "0 0 9px 9px", padding: 4 }}>
        {(() => { let letzterSlot = null; return sortiereListe(liste).map((r) => {
          const eckAn = rolleEckSichtbar(r);
          const badgeAn = rolleBadgeSichtbar(r);
          const ecke = rolleEckPosition(r);
          const ist = r.name === selName;
          const markiert = bearbeiten && ist; // Highlight nur im Bearbeiten-Modus
          const rKuerzel = effKuerzel(r, kategorien);
          const rColor = effColor(r, kategorien);
          // Gruppen-Überschrift nur bei Personen-Rollen und nur beim Slot-Wechsel.
          const zeigeKopf = !istFirma && SLOT_LABEL[r.slot] && r.slot !== letzterSlot;
          const ersterKopf = letzterSlot === null;
          if (zeigeKopf) letzterSlot = r.slot;
          return (
            <React.Fragment key={r.name}>
            {zeigeKopf && (
              <div style={{ display: "flex", alignItems: "center", gap: 8,
                padding: "10px 6px 4px", marginTop: ersterKopf ? 0 : 6 }}>
                <span style={{ fontSize: FS.xs, fontWeight: FW.bold, color: t.muted,
                  textTransform: "uppercase", letterSpacing: "0.06em", flexShrink: 0 }}>
                  {SLOT_LABEL[r.slot]}
                </span>
                <div style={{ flex: 1, height: 1, background: t.border + "40" }}/>
              </div>
            )}
            <div
              onClick={() => setSelName(r.name)}
              style={{
                display: "flex", alignItems: "center", gap: 4,
                padding: "6px 6px", borderRadius: RAD.sm, cursor: "pointer",
                background: markiert ? rColor + "12" : "transparent",
                border: `1px solid ${markiert ? rColor + "55" : "transparent"}`,
                opacity: !ohneBadge && !eckAn && !badgeAn ? 0.55 : 1,
                transition: "all 0.12s", marginBottom: 2,
              }}>
              <div style={{ width: 22, height: 22, borderRadius: RAD.full,
                background: rColor + "22", border: `1.5px solid ${rColor}60`,
                display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <span style={{ fontSize: FS.xxs, fontWeight: FW.heavy, color: rColor }}>{rKuerzel}</span>
              </div>
              <span style={{ fontSize: FS.m, flex: 1, minWidth: 0, color: t.text,
                whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                fontWeight: markiert ? 700 : 500 }}>{r.name}</span>
              {!ohneBadge && <>
              <div style={{ width: 48, display: "flex", justifyContent: "center", flexShrink: 0 }}
                onClick={(e) => e.stopPropagation()}>
                <Toggle value={eckAn} onChange={() => toggleEckSichtbar(r.name)} t={t} accent={toggleFarbe}/>
              </div>
              <div style={{ width: 28, display: "flex", justifyContent: "center", flexShrink: 0 }}>
                <PositionSelector aktivePosition={ecke}
                  onSelect={(pos) => setEckPosition(r.name, pos)}
                  farbe={rColor} disabled={!eckAn} t={t}/>
              </div>
              <div style={{ width: 48, display: "flex", justifyContent: "center", flexShrink: 0 }}
                onClick={(e) => e.stopPropagation()}>
                <Toggle value={badgeAn} onChange={() => toggleBadgeSichtbar(r.name)} t={t} accent={toggleFarbe}/>
              </div>
              </>}
              {/* Aktionen nur im Bearbeiten-Modus UND bei markierter Zeile. */}
              <div style={{ width: markiert ? 58 : 0, overflow: "hidden", display: "flex",
                justifyContent: "flex-end", gap: 4, flexShrink: 0, transition: "width 0.12s" }}
                onClick={(e) => e.stopPropagation()}>
                {markiert && (
                  <>
                    <button onClick={() => startEdit(r)} style={miniBtn} title="Bearbeiten">
                      <I name="pencil" size={11} color={t.sub}/>
                    </button>
                    <button onClick={() => loeschen(r.name)} style={miniBtn} title="Löschen">
                      <I name="trash" size={11} color="#EF4444"/>
                    </button>
                  </>
                )}
              </div>
            </div>
            </React.Fragment>
          );
        }); })()}
      </div>
    </>
  );
}


// ── Sektion: Statusleiste ───────────────────────────────────────────────────
// Steuert die kleinen Hinweis-Zeilen unter Objekt- und Kontakt-Karten.
// "Sichtbarkeit" = ob die Leiste pro Karten-Typ überhaupt angezeigt wird.
// "Inhalte"      = welche Status-Arten gerendert werden (Bestellung läuft ab,
//                  nächste ETV, Jahrestage, Zuweisung beginnt/endet, …).
function SektionStatusleiste({ settings, setSettings, t, accent }) {
  const update = (patch) => setSettings(s => ({ ...s, ...patch }));
  const updateInhalt = (key, value) => update({
    statusInhalte: Object.assign({}, settings.statusInhalte || {}, { [key]: value })
  });

  const inhalteKontakt = [
    { key: "geburtstag", label: "Jahrestage",
      desc: "Eigene Datum-Felder (Geburtstag, Hochzeitstag, Namenstag …) — zeigt das nächste innerhalb von 7 Tagen." },
    { key: "einzugAuszug", label: "Einzug / Auszug",
      desc: "Geplanter Einzug (nächste 30 Tage) oder anstehender Auszug (60 Tage) als Mieter/Bewohner." },
    { key: "eigentumswechsel", label: "Kauf / Verkauf",
      desc: "Wird Eigentümer (nächste 30 Tage) oder Eigentum endet — Verkauf (60 Tage)." },
    { key: "zuweisungAblauf", label: "Sonstige Zuweisungen",
      desc: "Andere Rollen beginnen oder enden bald — z. B. Beirat, Hausmeister, Verwalter." },
    { key: "ehemaligHinweis", label: "Keine aktiven Beteiligungen",
      desc: "Graue Hinweis-Zeile bei Kontakten, die nur noch EHEMALIGE Rollen haben (z. B. ausgezogener Mieter, Eigentümer nach Verkauf) — also aktuell an keinem Objekt mehr aktiv eingebunden sind. Hilft, Archiv-Kontakte zu erkennen, ohne sie zu löschen." },
  ];

  return (
    <>
      <EinstellKarte title="Sichtbarkeit" t={t} accent={accent}>
        <div style={{ fontSize: FS.s, color: t.muted, lineHeight: 1.45, marginBottom: 12 }}>
          Blende die farbigen Hinweise an Objekt- und Kontakt-Karten getrennt
          ein oder aus. Bei Objekten betrifft das die Statusleiste unter der
          Karte und den Handlungsbedarf-Punkt in der Liste gemeinsam — welche
          Fristen zählen und ab wann Gelb greift, stellst du über den Button ein.
        </div>
        <EinstellZeile label="Statusleiste · Objekte"
          sub="Hinweis-Zeile unter Objekt-Karten und Handlungsbedarf-Punkt in der Liste ein-/ausblenden" t={t}>
          <Toggle value={settings.statusLeisteObjekt !== false}
            onChange={(v) => update({ statusLeisteObjekt: v })} color={accent}/>
        </EinstellZeile>
        <EinstellZeile label="Statusleiste · Kontakte"
          sub="Hinweis-Zeile unter Kontakt-Karten ein-/ausblenden" t={t}>
          <Toggle value={settings.statusLeisteKontakt !== false}
            onChange={(v) => update({ statusLeisteKontakt: v })} color={accent}/>
        </EinstellZeile>
      </EinstellKarte>
      <div id="set-handlungsbedarf">
        <EinstellKarte title="Handlungsbedarf & Fristen · Objekte" t={t} accent={accent}>
          <div style={{ fontSize: FS.m, color: t.sub, lineHeight: 1.45, marginBottom: 12 }}>
            Zeigt den Handlungsbedarf eines Objekts farblich an —{" "}
            <span style={{ color: "#22C55E", fontWeight: FW.semi }}>grün</span> = alles ok,{" "}
            <span style={{ color: "#F59E0B", fontWeight: FW.semi }}>gelb</span> = eine Frist rückt näher,{" "}
            <span style={{ color: "#EF4444", fontWeight: FW.semi }}>rot</span> = eine Frist ist überfällig.
            In der Listenansicht als Punkt links, in der Kartenansicht als
            Statusleiste mit Grund unter der Karte. Lege fest, welche Fristen
            zählen und ab wie vielen Tagen vorher Gelb greift.
          </div>
          <HandlungsbedarfTabelle settings={settings} save={update} t={t} accent={accent}/>
          <div style={{ fontSize: FS.xs, color: t.muted, marginTop: 10, lineHeight: 1.4 }}>
            Vergangene Wiederholungen (z.B. die letzte Wartung) und reine
            Beginn-Termine zählen nicht — nur offene Fristen, Enden und Fälligkeiten.
            Später kommen Vorgänge als weitere Quelle dazu.
          </div>
        </EinstellKarte>
      </div>
      <EinstellKarte title="Inhalte · Kontakte" t={t} accent={accent}>
        {inhalteKontakt.map(item => (
          <EinstellZeile key={item.key} label={item.label} sub={item.desc} t={t}>
            <Toggle value={(settings.statusInhalte || {})[item.key] !== false}
              onChange={(v) => updateInhalt(item.key, v)} color={accent}/>
          </EinstellZeile>
        ))}
      </EinstellKarte>
    </>
  );
}

// ── TerminBezeichnungenEditor: Liste fürs "Neuer Termin"-Dropdown ───────────
// Lebt INNERHALB der Kalender-Sektion (kein eigenes EinstellKarte). Optik 1:1
// am Dashboard-Kachel-Muster: Sortier-Pfeile, getöntes Farb-Icon, Trennlinien
// (keine Boxen), FarbPicker + System-Toggle rechts. Editierbar: Label als
// dezentes Inline-Input. Liste aus { id, label, farbe, sichtbar }. Sichtbar-
// Toggle blendet aus dem Dropdown aus, ohne zu löschen. Löschen Zwei-Schritt
// (kein window.confirm — iOS-PWA, DESIGN §25.2).
function TerminBezeichnungenEditor({ settings, setSettings, t, accent }) {
  const liste = settings.terminBezeichnungen || [];
  const setListe = (next) => setSettings(s => ({ ...s, terminBezeichnungen: next }));
  const upd = (id, patch) => setListe(liste.map(b => b.id === id ? { ...b, ...patch } : b));
  const [loeschBereitId, setLoeschBereitId] = useState(null);
  // „Löschen?"-Zustand fällt nach 4s von selbst zurück (Muster wie
  // KategorienTabelle) — sonst bleibt der scharfe Button hängen.
  useEffect(() => {
    if (loeschBereitId == null) return;
    const tid = setTimeout(() => setLoeschBereitId(null), 4000);
    return () => clearTimeout(tid);
  }, [loeschBereitId]);
  const verschiebe = (idx, richtung) => {
    const ziel = idx + richtung;
    if (ziel < 0 || ziel >= liste.length) return;
    const neu = liste.slice();
    const tmp = neu[idx]; neu[idx] = neu[ziel]; neu[ziel] = tmp;
    setListe(neu);
  };
  const del = (b) => {
    if (loeschBereitId !== b.id) { setLoeschBereitId(b.id); return; }
    setListe(liste.filter(x => x.id !== b.id));
    setLoeschBereitId(null);
  };
  const neu = () => {
    const b = { id: "tb" + Date.now(), label: "", farbe: accent, sichtbar: true, bezug: "objekt", autoBeteiligte: "keine" };
    setListe([...liste, b]);
  };
  const verwendeteFarben = liste.map(b => b.farbe).filter(Boolean);
  return (
    <div>
      <div style={{ fontSize: FS.s, color: t.muted, lineHeight: 1.45, marginBottom: 10 }}>
        Diese Bezeichnungen erscheinen im Auswahlmenü beim Anlegen eines Termins
        (z. B. „ETV", „Belegprüfung"). Jede bekommt eine eigene Farbe; der Schalter
        blendet eine Bezeichnung aus dem Menü aus, ohne sie zu löschen. Über
        „Andere…" bleibt im Formular immer auch ein freier Text möglich.
      </div>
      <button onClick={neu}
        style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 12px",
          marginBottom: liste.length > 0 ? 8 : 0,
          borderRadius: RAD.sm, cursor: "pointer", fontFamily: "inherit",
          fontSize: FS.s, fontWeight: FW.bold, background: accent + "14",
          border: `1px solid ${accent}40`, color: accent }}>
        <I name="plus" size={12} color={accent}/>Bezeichnung anlegen
      </button>
      {liste.map((b, i) => {
        const farbe = b.farbe || accent;
        const aus = b.sichtbar === false;
        const bezug = b.bezug || "objekt";
        const bezugPill = (id, label, disabled) => (
          <button key={id} onClick={() => { if (!disabled) upd(b.id, { bezug: id }); }}
            title={disabled ? "Objektlose Termine folgen in Kürze" : undefined}
            style={{ padding: "3px 9px", borderRadius: RAD.pill,
              cursor: disabled ? "not-allowed" : "pointer",
              fontFamily: "inherit", fontSize: FS.xs, fontWeight: FW.bold,
              background: bezug === id ? farbe + "22" : "transparent",
              border: `1px solid ${bezug === id ? farbe : t.border}`,
              color: bezug === id ? farbe : t.sub,
              opacity: disabled ? 0.4 : 1 }}>
            {label}
          </button>
        );
        return (
          <div key={b.id} style={{
            borderBottom: `1px solid ${t.border}25`,
            paddingBottom: 6, marginBottom: 6, opacity: aus ? 0.55 : 1 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8,
              padding: "2px 6px", borderRadius: RAD.sm }}>
              <SortierPfeile
                canUp={i > 0} canDown={i < liste.length - 1}
                onUp={() => verschiebe(i, -1)} onDown={() => verschiebe(i, +1)}
                t={t} accent={accent}/>
              <div style={{ width: 28, height: 28, borderRadius: RAD.ms, flexShrink: 0,
                background: farbe + "20", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <I name="calendar" size={13} color={farbe}/>
              </div>
              <input value={b.label} placeholder="Bezeichnung…"
                onChange={e => upd(b.id, { label: e.target.value })}
                style={{ flex: 1, minWidth: 0, boxSizing: "border-box",
                  background: "transparent", border: "1px solid transparent",
                  borderRadius: RAD.sm, padding: "4px 6px",
                  fontSize: 16, color: t.text, outline: "none", fontFamily: "inherit" }}
                onFocus={e => { e.target.style.background = t.surface; e.target.style.border = `1px solid ${t.border}`; }}
                onBlur={e => { e.target.style.background = "transparent"; e.target.style.border = "1px solid transparent"; }}/>
              {(settings.farbIntensitaet != null ? settings.farbIntensitaet : 100) > 0 && (
                <FarbPicker value={farbe} t={t}
                  verwendeteFarben={verwendeteFarben}
                  onChange={(c) => upd(b.id, { farbe: c })}/>
              )}
              <Toggle value={b.sichtbar !== false} color={farbe}
                onChange={(v) => upd(b.id, { sichtbar: v })}/>
              <button onClick={() => del(b)}
                title={loeschBereitId === b.id ? "Nochmal tippen zum Löschen" : "Bezeichnung löschen"}
                aria-label="Bezeichnung löschen"
                style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 4,
                  height: 28, minWidth: 28, flexShrink: 0, cursor: "pointer",
                  padding: loeschBereitId === b.id ? "0 8px" : 0,
                  background: loeschBereitId === b.id ? "#EF4444" : "transparent",
                  border: "1px solid " + (loeschBereitId === b.id ? "#EF4444" : "#EF444440"),
                  borderRadius: RAD.sm, fontFamily: "inherit",
                  fontSize: FS.xs, fontWeight: FW.bold,
                  color: loeschBereitId === b.id ? "#fff" : "#EF4444" }}>
                {loeschBereitId === b.id ? "Löschen?" : <I name="x" size={12} color="#EF4444"/>}
              </button>
            </div>
            {/* Bezug: was beim Anlegen abgefragt wird */}
            <div style={{ display: "flex", alignItems: "center", gap: 6,
              paddingLeft: 42, marginTop: 4 }}>
              <span style={{ fontSize: FS.xs, color: t.muted, marginRight: 2 }}>Bezug:</span>
              {bezugPill("keiner", "Kein Objekt", false)}
              {bezugPill("objekt", "Nur Objekt", false)}
              {bezugPill("einheit", "Objekt + Einheit", false)}
            </div>
            {/* Auto-Beteiligte: Personen automatisch vorschlagen (nur bei Objektbezug) */}
            {bezug !== "keiner" && (() => {
              const aktuelleRegel = b.autoBeteiligte || "keine";
              // Verfügbare Regeln je Bezug: "objekt" → nur Eigentümer; "einheit" → alle.
              const erlaubt = bezug === "einheit"
                ? ["keine", "eigentuemer", "eig_nutzer_einheit", "nutzer_einheit"]
                : ["keine", "eigentuemer"];
              return (
                <div style={{ display: "flex", alignItems: "center", gap: 6,
                  paddingLeft: 42, marginTop: 6 }}>
                  <span style={{ fontSize: FS.xs, color: t.muted, marginRight: 2 }}>Personen automatisch:</span>
                  <select value={erlaubt.indexOf(aktuelleRegel) >= 0 ? aktuelleRegel : "keine"}
                    onChange={e => upd(b.id, { autoBeteiligte: e.target.value })}
                    style={{ background: t.surface, border: `1px solid ${t.border}`,
                      borderRadius: RAD.sm, padding: "4px 8px", fontSize: 16,
                      color: t.text, fontFamily: "inherit", cursor: "pointer" }}>
                    {AUTO_BETEILIGTE_REGELN.filter(r => erlaubt.indexOf(r.id) >= 0).map(r => (
                      <option key={r.id} value={r.id}>{r.label}</option>
                    ))}
                  </select>
                </div>
              );
            })()}
          </div>
        );
      })}
      {liste.length === 0 && (
        <div style={{ fontSize: FS.s, color: t.muted, fontStyle: "italic",
          padding: "6px 2px" }}>
          Noch keine Bezeichnungen — beim Anlegen steht nur „Andere…" zur Verfügung.
        </div>
      )}
    </div>
  );
}

// ── Sektion: Suche ──────────────────────────────────────────────────────────
function SektionSuche({ settings, setSettings, t, accent }) {
  const save = (partial) => setSettings(s => ({ ...s, ...partial }));
  return (
    <>
      <EinstellKarte title="Suchabdeckung" t={t} accent={accent}>
        <div style={{ fontSize: FS.m, color: t.sub, marginBottom: 8, lineHeight: 1.4 }}>
          Welche Bereiche werden in der Universalsuche durchsucht.
        </div>
        {settings.suchKategorien.map((kat, i) => (
          <EinstellZeile key={kat.id} label={kat.label} t={t}>
            <Toggle value={kat.aktiv}
              onChange={v => save({ suchKategorien: settings.suchKategorien.map((k, j) => j === i ? { ...k, aktiv: v } : k) })}
              color={accent}/>
          </EinstellZeile>
        ))}
      </EinstellKarte>

      <EinstellKarte title="Intelligente Suche" t={t} accent={accent}>
        <div style={{ fontSize: FS.m, color: t.sub, marginBottom: 10, lineHeight: 1.4 }}>
          Findet auch ähnliche Schreibweisen, ähnlich klingende Namen und Tippfehler. Exakte Treffer werden immer zuerst angezeigt.
        </div>
        <EinstellZeile label="Umlaute & Akzente ignorieren"
          sub={"\u201Emüller\u201C findet \u201EMüller\u201C, \u201EMueller\u201C, \u201EMuller\u201C"} t={t}>
          <Toggle value={settings.sucheDiakritika !== false}
            onChange={v => save({ sucheDiakritika: v })} color={accent}/>
        </EinstellZeile>
        <EinstellZeile label="Mehrere Wortteile"
          sub={"\u201Elin marc\u201C findet \u201EMarcus Linder\u201C"} t={t}>
          <Toggle value={settings.sucheWoerter !== false}
            onChange={v => save({ sucheWoerter: v })} color={accent}/>
        </EinstellZeile>
        <EinstellZeile label="Ähnlich klingende Namen (Kölner Phonetik)"
          sub={"\u201EMeier\u201C findet auch \u201EMeyer\u201C, \u201EMayer\u201C, \u201EMaier\u201C – und \u201EMathias\u201C findet \u201EMatthias\u201C, \u201EMatieas\u201C"} t={t}>
          <Toggle value={settings.suchePhonetik !== false}
            onChange={v => save({ suchePhonetik: v })} color={accent}/>
        </EinstellZeile>
        <EinstellZeile label="Tippfehler-Toleranz"
          sub="Findet Treffer mit kleinen Schreibfehlern" t={t}>
          <Toggle value={settings.sucheTippfehler !== false}
            onChange={v => save({ sucheTippfehler: v })} color={accent}/>
        </EinstellZeile>
        {settings.sucheTippfehler !== false && (
          <EinstellZeile label="Tippfehler-Schärfe"
            sub="Wie viele Buchstaben darf der Treffer maximal abweichen" t={t}>
            <div style={{ display: "flex", gap: 4, background: t.surface,
              border: `1px solid ${t.border}`, borderRadius: RAD.md, padding: 3 }}>
              {[
                { v: 1, label: "Streng" },
                { v: 2, label: "Normal" },
                { v: 3, label: "Tolerant" },
              ].map(opt => {
                const aktiv = (settings.sucheTippfehlerSchwelle || 2) === opt.v;
                return (
                  <button key={opt.v} onClick={() => save({ sucheTippfehlerSchwelle: opt.v })}
                    style={{
                      background: aktiv ? accent : "transparent",
                      color: aktiv ? "#fff" : t.sub,
                      border: "none", borderRadius: RAD.sm,
                      padding: "5px 12px", cursor: "pointer",
                      fontFamily: "inherit", fontSize: FS.m, fontWeight: FW.medium }}>
                    {opt.label}
                  </button>
                );
              })}
            </div>
          </EinstellZeile>
        )}
      </EinstellKarte>
    </>
  );
}

// ── Tastaturkürzel ──────────────────────────────────────────────────────────
// Globale Kürzel im Stil verbreiteter Web-Apps (Gmail/GitHub): einzelne Tasten,
// nur aktiv wenn KEIN Eingabefeld fokussiert ist. Standard-Belegung hier;
// Overrides in settings.tastaturBelegung. Konflikte werden beim Zuweisen in
// der Einstellungs-Sektion verhindert.
const TASTATUR_AKTIONEN = [
  { id: "navHome",          gruppe: "Navigation", defaultKey: "h", label: "Übersicht (Home)",
    beschreibung: "Wechselt zur Kachel-Übersicht (Startseite)." },
  { id: "navObjekte",       gruppe: "Navigation", defaultKey: "o", label: "Objekte",
    beschreibung: "Öffnet die Objektliste." },
  { id: "navKontakte",      gruppe: "Navigation", defaultKey: "k", label: "Kontakte",
    beschreibung: "Öffnet die Kontaktliste." },
  { id: "navKalender",      gruppe: "Navigation", defaultKey: "t", label: "Kalender / Termine",
    beschreibung: "Öffnet den Kalender." },
  { id: "navListen",        gruppe: "Navigation", defaultKey: "l", label: "Listengenerator",
    beschreibung: "Öffnet den Listengenerator." },
  { id: "navStatistik",     gruppe: "Navigation", defaultKey: "s", label: "Statistik",
    beschreibung: "Öffnet das Statistik-Dashboard." },
  { id: "navEinstellungen", gruppe: "Navigation", defaultKey: "e", label: "Einstellungen",
    beschreibung: "Öffnet die Einstellungen (Zentrale)." },
  { id: "sucheFokus",       gruppe: "Aktionen",   defaultKey: "/", label: "Suche",
    beschreibung: "Setzt den Cursor in das globale Suchfeld." },
  { id: "hilfe",            gruppe: "Aktionen",   defaultKey: "?", label: "Kürzel-Übersicht",
    beschreibung: "Öffnet diese Tastatur-Übersicht in den Einstellungen." },
  { id: "neu",              gruppe: "Aktionen",   defaultKey: "n", label: "Neu anlegen",
    beschreibung: "Legt im aktuellen Bereich einen neuen Eintrag an (z. B. Kontakt oder Objekt)." },
  { id: "listeAuf",         gruppe: "Listen",     defaultKey: "ArrowUp", label: "Nach oben",
    beschreibung: "Bewegt die Markierung in der Liste ein Element nach oben." },
  { id: "listeAb",          gruppe: "Listen",     defaultKey: "ArrowDown", label: "Nach unten",
    beschreibung: "Bewegt die Markierung in der Liste ein Element nach unten." },
  { id: "oeffnen",          gruppe: "Listen",     defaultKey: "Enter", label: "Öffnen",
    beschreibung: "Öffnet das markierte Listenelement." },
  { id: "zurueck",          gruppe: "Listen",     defaultKey: "Escape", fest: true, label: "Zurück / Schließen",
    beschreibung: "Schließt das geöffnete Detail bzw. geht zur Liste zurück. (Fest belegt.)" },
];
// Sondertasten, die zugewiesen werden dürfen, mit hübscher Anzeige.
const TASTATUR_SONDER = { ArrowUp: "↑", ArrowDown: "↓", ArrowLeft: "←",
  ArrowRight: "→", Enter: "Enter" };
function tastaturTasteAnzeige(k) {
  if (k === "Escape") return "Esc";
  return TASTATUR_SONDER[k] || k;
}
// Effektive Belegung: Standard + Overrides → { aktionId: taste }.
function tastaturBelegungVon(settings) {
  const ueber = (settings && settings.tastaturBelegung) || {};
  const aus = {};
  TASTATUR_AKTIONEN.forEach(a => { aus[a.id] = ueber[a.id] || a.defaultKey; });
  return aus;
}
// Druckbare Übersicht der aktuellen Belegung (gemeinsamer iframe-Druck §26.3).
function druckeTastaturUebersicht(settings) {
  const belegung = tastaturBelegungVon(settings);
  const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const heute = new Date().toLocaleDateString("de-DE");
  let body = "<h1>AllesDa – Tastaturkürzel</h1>"
    + '<p class="meta">Stand: ' + esc(heute) + " · Kürzel wirken nur, wenn kein Eingabefeld aktiv ist</p>";
  const gruppen = [];
  TASTATUR_AKTIONEN.forEach(a => { if (gruppen.indexOf(a.gruppe) < 0) gruppen.push(a.gruppe); });
  gruppen.forEach(g => {
    body += "<h2>" + esc(g) + "</h2><table>";
    TASTATUR_AKTIONEN.filter(a => a.gruppe === g).forEach(a => {
      body += "<tr><td class='taste'><span class='kbd'>" + esc(tastaturTasteAnzeige(belegung[a.id])) + "</span></td>"
        + "<td class='fn'>" + esc(a.label) + "</td><td>" + esc(a.beschreibung) + "</td></tr>";
    });
    body += "</table>";
  });
  return druckeHtml("AllesDa – Tastaturkürzel", body, false,
    "h2{font-size:13px;margin:18px 0 4px;}"
    + ".taste{width:56px;}.fn{width:170px;font-weight:600;}"
    + ".kbd{display:inline-block;border:1px solid #999;border-bottom-width:2px;"
    + "border-radius:4px;padding:2px 8px;font-family:ui-monospace,monospace;"
    + "font-size:12px;background:#f5f5f5;}");
}

// ── Sektion: Tastatur ───────────────────────────────────────────────────────
// Je Aktion eine Zeile mit Beschreibung + Tasten-Button. Klick auf die Taste →
// Aufnahme-Modus („Taste drücken…"), nächster Tastendruck wird zugewiesen.
// Escape bricht ab. Bereits belegte Tasten werden abgelehnt (Hinweis).
function SektionTastatur({ settings, setSettings, t, accent }) {
  const [captureId, setCaptureId] = useState(null);
  const [meldung, setMeldung] = useState(null); // { aktionId, text }
  const save = (partial) => setSettings(s => ({ ...s, ...partial }));
  const belegung = tastaturBelegungVon(settings);
  const istStandard = TASTATUR_AKTIONEN.every(a => belegung[a.id] === a.defaultKey);

  const zuweisen = (aktionId, e) => {
    e.preventDefault();
    e.stopPropagation(); // globalen Kürzel-Handler nicht auslösen
    const k = e.key;
    if (k === "Escape") { setCaptureId(null); setMeldung(null); return; }
    if (k === "Tab") return; // Fokus-Navigation nicht kapern
    const istZeichen = k.length === 1 && k !== " ";
    const istSonder = !!TASTATUR_SONDER[k];
    if (!istZeichen && !istSonder) {
      setMeldung({ aktionId, text: "Bitte eine Zeichen-Taste, Pfeiltaste oder Enter wählen." });
      return;
    }
    const taste = istZeichen && /[a-zA-Z]/.test(k) ? k.toLowerCase() : k;
    const konflikt = TASTATUR_AKTIONEN.find(a => a.id !== aktionId && belegung[a.id] === taste);
    if (konflikt) {
      setMeldung({ aktionId, text: "„" + taste + "\u201C ist bereits belegt durch: " + konflikt.label + "." });
      return;
    }
    save({ tastaturBelegung: { ...(settings.tastaturBelegung || {}), [aktionId]: taste } });
    setCaptureId(null); setMeldung(null);
  };

  const gruppen = [];
  TASTATUR_AKTIONEN.forEach(a => { if (gruppen.indexOf(a.gruppe) < 0) gruppen.push(a.gruppe); });

  const kbdStil = (aktiv) => ({
    minWidth: 44, padding: "6px 12px", textAlign: "center", cursor: "pointer",
    fontFamily: "ui-monospace, monospace", fontSize: FS.m, fontWeight: FW.bold,
    background: aktiv ? accent + "22" : t.surface,
    border: `1px solid ${aktiv ? accent : t.border}`, borderBottomWidth: 2,
    borderRadius: RAD.sm, color: aktiv ? accent : t.text,
  });

  return (
    <>
      <EinstellKarte title="Tastaturkürzel" t={t} accent={accent}>
        <EinstellZeile label="Kürzel aktiv"
          sub="Einzelne Tasten wirken global — aber nie, während du in einem Eingabefeld tippst." t={t}>
          <Toggle value={settings.tastaturAn !== false}
            onChange={v => save({ tastaturAn: v })} color={accent}/>
        </EinstellZeile>

        {gruppen.map(g => (
          <div key={g} style={{ marginTop: 14 }}>
            <div style={{ fontSize: FS.xs, fontWeight: FW.bold, color: t.sub,
              textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6 }}>{g}</div>
            {TASTATUR_AKTIONEN.filter(a => a.gruppe === g).map(a => (
              <div key={a.id} style={{ display: "flex", alignItems: "center", gap: 12,
                padding: "8px 0", borderBottom: `1px solid ${t.border}40` }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: FS.m, fontWeight: FW.medium, color: t.text }}>{a.label}</div>
                  <div style={{ fontSize: FS.s, color: t.sub, lineHeight: 1.35 }}>{a.beschreibung}</div>
                  {meldung && meldung.aktionId === a.id && (
                    <div style={{ fontSize: FS.s, color: "#EF4444", marginTop: 3 }}>{meldung.text}</div>
                  )}
                </div>
                <button onClick={a.fest ? undefined : () => { setCaptureId(a.id); setMeldung(null); }}
                  onKeyDown={captureId === a.id ? (e) => zuweisen(a.id, e) : undefined}
                  onBlur={() => { if (captureId === a.id) setCaptureId(null); }}
                  title={a.fest ? "Fest belegt — nicht änderbar"
                    : (captureId === a.id ? "Gewünschte Taste drücken (Esc bricht ab)" : "Klicken und neue Taste drücken")}
                  style={{ ...kbdStil(captureId === a.id),
                    cursor: a.fest ? "default" : "pointer",
                    opacity: a.fest ? 0.6 : 1 }}>
                  {captureId === a.id ? "Taste…" : tastaturTasteAnzeige(belegung[a.id])}
                </button>
              </div>
            ))}
          </div>
        ))}

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 14 }}>
          <button onClick={() => druckeTastaturUebersicht(settings)}
            style={{ display: "inline-flex", alignItems: "center", gap: 6,
              padding: "8px 14px", borderRadius: RAD.sm, cursor: "pointer",
              fontFamily: "inherit", fontSize: FS.s, fontWeight: FW.medium,
              background: accent + "15", color: accent, border: `1px solid ${accent}40` }}>
            <I name="document" size={13} color={accent}/>Übersicht drucken
          </button>
          <button onClick={() => { save({ tastaturBelegung: {} }); setMeldung(null); }}
            disabled={istStandard}
            style={{ display: "inline-flex", alignItems: "center", gap: 6,
              padding: "8px 14px", borderRadius: RAD.sm,
              cursor: istStandard ? "default" : "pointer", opacity: istStandard ? 0.5 : 1,
              fontFamily: "inherit", fontSize: FS.s, fontWeight: FW.medium,
              background: "none", color: t.sub, border: `1px solid ${t.border}` }}>
            Auf Standard zurücksetzen
          </button>
        </div>
      </EinstellKarte>
    </>
  );
}

// ── Sektion: Hausverwaltung ─────────────────────────────────────────────────
// Logo-Variante des Bild-Helfers: NICHT quadratisch beschnitten (Logos sind
// meist breit), max. 120px hoch, Transparenz bleibt erhalten (PNG).
function dateiZuLogoDataUrl(file, callback) {
  if (!file || !file.type || file.type.indexOf("image/") !== 0) {
    callback(null); return;
  }
  const reader = new FileReader();
  reader.onload = function(ev) {
    const img = new Image();
    img.onload = function() {
      const ZIEL_H = 120;
      const skala = img.height > ZIEL_H ? ZIEL_H / img.height : 1;
      const w = Math.max(1, Math.round(img.width * skala));
      const h = Math.max(1, Math.round(img.height * skala));
      const canvas = document.createElement("canvas");
      canvas.width = w; canvas.height = h;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(img, 0, 0, w, h);
      callback(canvas.toDataURL("image/png"));
    };
    img.onerror = function() { callback(null); };
    img.src = ev.target.result;
  };
  reader.onerror = function() { callback(null); };
  reader.readAsDataURL(file);
}

function SektionHV({ settings, setSettings, t, accent }) {
  const [hvName, setHvName] = useState(settings.hvName);
  const save = (partial) => setSettings(s => ({ ...s, ...partial }));
  const logoSrc = settings.hvLogo || settings.hvLogoUrl || "";
  const logoWaehlen = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.style.display = "none";
    input.onchange = (e) => {
      const file = e.target.files && e.target.files[0];
      if (!file) return;
      dateiZuLogoDataUrl(file, (dataUrl) => {
        if (dataUrl) save({ hvLogo: dataUrl });
        try { document.body.removeChild(input); } catch (err) {}
      });
    };
    document.body.appendChild(input);
    input.click();
  };
  return (
    <EinstellKarte title="Hausverwaltung" t={t} accent={accent}>
      <Inp label="Name" value={hvName}
        onChange={v => { setHvName(v); save({ hvName: v }); }}
        placeholder="Muster Hausverwaltung GmbH" t={t} accent={accent}/>
      <div style={{ marginTop: 12 }}>
        <div style={{ fontSize: FS.xs, fontWeight: FW.bold, color: t.sub,
          textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6 }}>Logo</div>
        <div style={{ fontSize: FS.s, color: t.sub, marginBottom: 8, lineHeight: 1.4 }}>
          Erscheint im Kopf gedruckter Listen (Listengenerator) rechts oben.
        </div>
        {logoSrc && (
          <div style={{ background: "#FFFFFF", border: `1px solid ${t.border}`,
            borderRadius: RAD.sm, padding: 10, display: "inline-block", marginBottom: 8 }}>
            <img src={logoSrc} alt="Logo" style={{ maxHeight: 48, maxWidth: 200,
              objectFit: "contain", display: "block" }}/>
          </div>
        )}
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button onClick={logoWaehlen} style={{ display: "inline-flex", alignItems: "center",
            gap: 6, padding: "7px 14px", borderRadius: RAD.sm, cursor: "pointer",
            fontFamily: "inherit", fontSize: FS.s, fontWeight: FW.medium,
            background: accent + "15", color: accent, border: `1px solid ${accent}40` }}>
            {settings.hvLogo ? "Logo ändern…" : "Logo hochladen…"}
          </button>
          {settings.hvLogo && (
            <button onClick={() => save({ hvLogo: "" })} style={{ display: "inline-flex",
              alignItems: "center", gap: 6, padding: "7px 14px", borderRadius: RAD.sm,
              cursor: "pointer", fontFamily: "inherit", fontSize: FS.s,
              background: "none", color: t.sub, border: `1px solid ${t.border}` }}>
              Entfernen
            </button>
          )}
        </div>
      </div>
    </EinstellKarte>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// useStorageStatus — React-Hook für den aktuellen Speicher-Modus
// ─────────────────────────────────────────────────────────────────────────────
// Abonniert `storage.abonniereStatus()` und liefert ein State-Objekt mit
//   { modus, ordnerName, letzteSpeicherung, fehler, fsaVerfuegbar }
function useStorageStatus() {
  const [status, setStatus] = useState(storage.status());
  useEffect(() => {
    const unsub = storage.abonniereStatus((s) => setStatus(s));
    return unsub;
  }, []);
  return status;
}

// ── OrdnerAnbindenKarte — Anbindung eines Ordners auf der Festplatte ────────
// Sichtbar in Einstellungen → Daten. Zeigt den aktuellen Status, Buttons zum
// Wählen / Erneuern / Trennen. Funktioniert nur in Chrome/Edge — in Safari
// erscheint stattdessen ein Hinweis-Block.
function OrdnerAnbindenKarte({ t, accent }) {
  const s = useStorageStatus();
  const [busy, setBusy] = useState(false);
  // Zwei-Schritt-Trennen statt confirm() (DESIGN §25.2): erster Tap macht den
  // Button scharf, zweiter trennt. Jede andere Aktion entschärft.
  const [trennenBereit, setTrennenBereit] = useState(false);

  const onWaehlen = async () => {
    setTrennenBereit(false);
    setBusy(true);
    try { await storage.waehleOrdner(); } finally { setBusy(false); }
  };
  const onAktivieren = async () => {
    setTrennenBereit(false);
    setBusy(true);
    try { await storage.aktiviereOrdnerErneut(); } finally { setBusy(false); }
  };
  const onTrennen = async () => {
    if (!trennenBereit) { setTrennenBereit(true); return; }
    setTrennenBereit(false);
    setBusy(true);
    try { await storage.trenneOrdner(); } finally { setBusy(false); }
  };

  const btnPrimary = {
    display: "flex", alignItems: "center", gap: 6,
    background: accent, color: getContrastColor(accent), border: "none",
    borderRadius: RAD.ms, padding: "8px 14px", cursor: busy ? "wait" : "pointer",
    fontFamily: "inherit", fontSize: FS.m, fontWeight: FW.medium,
    opacity: busy ? 0.6 : 1,
  };
  const btnSecondary = {
    display: "flex", alignItems: "center", gap: 6,
    background: accent + "4D", color: t.text, border: `1px solid ${accent}80`,
    borderRadius: RAD.ms, padding: "8px 14px", cursor: busy ? "wait" : "pointer",
    fontFamily: "inherit", fontSize: FS.m, fontWeight: FW.medium,
  };
  const btnDanger = {
    display: "flex", alignItems: "center", gap: 6,
    background: accent + "1A", color: "#EF4444",
    border: "1px solid #EF444460",
    borderRadius: RAD.ms, padding: "8px 14px", cursor: busy ? "wait" : "pointer",
    fontFamily: "inherit", fontSize: FS.m, fontWeight: FW.medium,
  };

  // Browser ohne File System Access (Safari, Firefox, iOS) — nur Hinweis
  if (!s.fsaVerfuegbar) {
    return (
      <EinstellKarte title="Ordner auf der Festplatte anbinden" t={t} accent={accent}>
        <div style={{ display: "flex", alignItems: "flex-start", gap: 8,
          padding: "10px 12px", background: "#F59E0B15",
          border: "1px solid #F59E0B40", borderRadius: RAD.ms,
          fontSize: FS.m, color: t.text, lineHeight: 1.5 }}>
          <I name="settings" size={14} color="#F59E0B"/>
          <div>
            Dein Browser unterstützt keinen direkten Ordnerzugriff.
            In Safari und Firefox funktioniert das Anbinden nicht — bitte
            <strong> Chrome oder Edge</strong> nutzen, wenn du diese Funktion brauchst.
            Die App läuft weiterhin und speichert im Browser-Speicher.
          </div>
        </div>
      </EinstellKarte>
    );
  }

  // FSA verfügbar — drei Zustände
  return (
    <EinstellKarte title="Ordner auf der Festplatte anbinden" t={t} accent={accent}>
      <div style={{ fontSize: FS.m, color: t.sub, lineHeight: 1.55, marginBottom: 12 }}>
        Wähle einen Ordner auf deinem Rechner als Single Source of Truth.
        Die App speichert <strong>aktiv/daten.json</strong> und <strong>aktiv/einstellungen.json</strong> live mit jeder Änderung.
        Du kannst den Ordner z.&nbsp;B. in iCloud, Dropbox oder OneDrive ablegen — dann läuft das Backup automatisch.
      </div>

      {s.modus === "datei" && (
        <div style={{ display: "flex", alignItems: "center", gap: 8,
          padding: "10px 12px", background: "#10B98115",
          border: "1px solid #10B98140", borderRadius: RAD.ms,
          marginBottom: 10, fontSize: FS.m, color: t.text }}>
          <span style={{ width: 8, height: 8, borderRadius: RAD.pill,
            background: "#10B981", flexShrink: 0 }}/>
          <div style={{ flex: 1 }}>
            <strong>{s.ordnerName || "Ordner"}</strong> ist verbunden.
            {s.letzteSpeicherung && (
              <span style={{ color: t.muted }}> · Zuletzt gespeichert: {new Date(s.letzteSpeicherung).toLocaleTimeString()}</span>
            )}
          </div>
        </div>
      )}

      {s.modus === "datei-pause" && (
        <div style={{ display: "flex", alignItems: "flex-start", gap: 8,
          padding: "10px 12px", background: "#F59E0B15",
          border: "1px solid #F59E0B40", borderRadius: RAD.ms,
          marginBottom: 10, fontSize: FS.m, color: t.text }}>
          <I name="settings" size={14} color="#F59E0B"/>
          <div style={{ flex: 1 }}>
            <strong>Berechtigung pausiert.</strong> {s.fehler || "Bitte Zugriff erneut erlauben."}
          </div>
        </div>
      )}

      {s.fehler && s.modus !== "datei-pause" && (
        <div style={{ display: "flex", alignItems: "flex-start", gap: 8,
          padding: "10px 12px", background: "#EF444415",
          border: "1px solid #EF444440", borderRadius: RAD.ms,
          marginBottom: 10, fontSize: FS.m, color: t.text }}>
          <I name="x" size={14} color="#EF4444"/>
          <div style={{ flex: 1 }}>{s.fehler}</div>
        </div>
      )}

      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
        {s.modus !== "datei" && s.modus !== "datei-pause" && (
          <button onClick={onWaehlen} style={btnPrimary} disabled={busy}>
            <I name="document" size={12} color={getContrastColor(accent)}/>Ordner wählen…
          </button>
        )}
        {s.modus === "datei-pause" && (
          <button onClick={onAktivieren} style={btnPrimary} disabled={busy}>
            <I name="check" size={12} color="#fff"/>Zugriff erneuern
          </button>
        )}
        {(s.modus === "datei" || s.modus === "datei-pause") && (
          <button onClick={onTrennen} disabled={busy}
            style={{ ...btnDanger,
              background: trennenBereit ? "#EF4444" : btnDanger.background,
              color: trennenBereit ? "#fff" : btnDanger.color,
              border: "1px solid #EF4444" + (trennenBereit ? "" : "60") }}>
            <I name="x" size={12} color={trennenBereit ? "#fff" : "#EF4444"}/>
            {trennenBereit ? "Wirklich trennen?" : "Ordner trennen"}
          </button>
        )}
      </div>
      {trennenBereit && (
        <div style={{ marginTop: 8, fontSize: FS.s, color: t.sub, lineHeight: 1.4 }}>
          Die App speichert dann wieder nur im Browser. Deine Daten im Ordner
          bleiben unverändert. Nochmal tippen zum Trennen.
        </div>
      )}
    </EinstellKarte>
  );
}

// ── ImportMeldung — Inline-Bestätigung/Fehler für Import-Aktionen ───────────
// Ersetzt window.confirm/alert in den Import-Flows (beide in iOS-Standalone-
// PWAs unzuverlässig, DESIGN §25.2). Zwei Varianten:
//   "bestaetigen": Titel + Zusammenfassungs-Zeilen + optionale orangene
//                  Schema-Warnung + Buttons „Abbrechen" / jaText (Akzentfarbe)
//   "fehler":      rote Box, Titel = Fehlertext, nur „Schließen"
function ImportMeldung({ variante, titel, zeilen = [], warnung = null,
                         onJa = null, onNein, jaText = "Einspielen", t, accent }) {
  const istFehler = variante === "fehler";
  const farbe = istFehler ? "#EF4444" : accent;
  const orange = "#F59E0B";
  return (
    <div style={{ marginTop: 8, padding: "10px 12px", background: farbe + "12",
      border: "1px solid " + farbe + "50", borderRadius: RAD.ms }}>
      <div style={{ fontSize: FS.m, fontWeight: FW.medium, color: t.text,
        lineHeight: 1.4, marginBottom: (zeilen.length > 0 || warnung) ? 6 : 0 }}>
        {titel}
      </div>
      {zeilen.map((z, i) => (
        <div key={i} style={{ fontSize: FS.s, color: t.sub, padding: "1px 0" }}>{z}</div>
      ))}
      {warnung && (
        <div style={{ marginTop: 6, padding: "6px 9px", background: orange + "18",
          border: "1px solid " + orange + "50", borderRadius: RAD.sm,
          fontSize: FS.s, color: t.text, lineHeight: 1.4 }}>
          ⚠ {warnung}
        </div>
      )}
      <div style={{ display: "flex", gap: 6, justifyContent: "flex-end", marginTop: 8 }}>
        {!istFehler && (
          <button onClick={onNein} style={{ background: "none",
            border: "1px solid " + t.border, color: t.sub, borderRadius: RAD.sm,
            padding: "5px 12px", cursor: "pointer", fontSize: FS.s,
            fontFamily: "inherit" }}>Abbrechen</button>
        )}
        <button onClick={istFehler ? onNein : onJa} style={{
          background: istFehler ? "none" : farbe,
          border: "1px solid " + farbe,
          color: istFehler ? farbe : getContrastColor(farbe),
          borderRadius: RAD.sm, padding: "5px 12px", cursor: "pointer",
          fontSize: FS.s, fontWeight: FW.medium, fontFamily: "inherit" }}>
          {istFehler ? "Schließen" : jaText}
        </button>
      </div>
    </div>
  );
}

// ── Sektion: Daten (Platzhalter, kommt im nächsten Schritt) ─────────────────
function SektionDaten({ t, accent, settings, setSettings, mode, setMode,
  kontakte, setKontakte, ves, setVes }) {
  const groesse = storage.speicherGroesse();
  const formatKB = (n) => (n / 1024).toFixed(1) + " KB";

  // Inline-Meldungen statt confirm()/alert() (iOS-PWA, DESIGN §25.2):
  // pendingImport = wartende Bestätigung nach Dateiauswahl
  //   { art: "settings"|"daten"|"excel", titel, zeilen[], warnung|null, anwenden() }
  // importFehler  = { art: "settings"|"daten"|"excel", text }
  // resetBereit   = Zwei-Schritt-Scharfstellung der Reset-Buttons
  const [pendingImport, setPendingImport] = useState(null);
  const [importFehler, setImportFehler] = useState(null);
  const [resetBereit, setResetBereit] = useState(null); // "settings"|"daten"|null
  // Dubletten-Aufräumen: bestaetigeMerge = Gruppe, die gerade zur Bestätigung
  // ansteht (Inline-Confirm statt window.confirm, DESIGN §25.2).
  const [bestaetigeMerge, setBestaetigeMerge] = useState(null);
  const meldungenZuruecksetzen = () => {
    setPendingImport(null); setImportFehler(null); setResetBereit(null); setBestaetigeMerge(null);
  };

  const datumStempel = () => {
    const d = new Date();
    const pad = (n) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}_${pad(d.getHours())}${pad(d.getMinutes())}`;
  };

  const onSettingsExport = () => {
    exportiereJSON({
      typ: "allesda-settings",
      schema: STORAGE_SCHEMA_VERSION,
      appVersion: APP_VERSION,
      exportiertAm: new Date().toISOString(),
      mode,
      settings,
    }, `allesda-einstellungen_${datumStempel()}.json`);
  };
  const onSettingsImport = () => {
    meldungenZuruecksetzen();
    importiereJSON((obj, dateiname) => {
      if (!obj || obj.typ !== "allesda-settings" || !obj.settings) {
        setImportFehler({ art: "settings", text: "Diese Datei enthält keine "
          + "AllesDa-Einstellungen. (" + (dateiname || "unbekannt") + ")" });
        return;
      }
      setPendingImport({
        art: "settings",
        titel: "Einstellungen aus „" + dateiname + "\u201C einspielen?",
        zeilen: ["Die aktuellen Einstellungen werden überschrieben."],
        warnung: schemaWarnung(obj),
        anwenden: () => {
          setSettings(s => ({ ...s, ...obj.settings }));
          if (obj.mode === "dark" || obj.mode === "light") setMode(obj.mode);
        },
      });
    }, (msg) => setImportFehler({ art: "settings", text: msg }));
  };

  // Firmen-Dubletten im aktuellen Bestand (E-Mail/Tel/Name). Live aus den
  // Kontakten — verschwindet eine Gruppe nach dem Merge automatisch.
  const dublGruppen = gruppiereDubletten(kontakte || [], { nurTyp: "firma" });

  // Eine Gruppe zusammenführen: Master = vollständigster Datensatz. Schreibt
  // Kontakte UND Objekte (wegen umgehängter SEV-/Vertrags-Verweise) zurück.
  const mergeAusfuehren = (gruppe) => {
    const r = fuehreKontakteZusammen({ kontakte, ves }, gruppe);
    if (setKontakte) setKontakte(() => r.kontakte);
    if (setVes && r.ves) setVes(() => r.ves);
    setBestaetigeMerge(null);
  };

  const onDatenExport = () => {
    exportiereJSON({
      typ: "allesda-daten",
      schema: STORAGE_SCHEMA_VERSION,
      appVersion: APP_VERSION,
      exportiertAm: new Date().toISOString(),
      kontakte, ves,
    }, `allesda-daten_${datumStempel()}.json`);
  };
  const onDatenImport = () => {
    meldungenZuruecksetzen();
    importiereJSON((obj, dateiname) => {
      if (!obj || obj.typ !== "allesda-daten") {
        setImportFehler({ art: "daten", text: "Diese Datei enthält keine "
          + "AllesDa-Daten. (" + (dateiname || "unbekannt") + ")" });
        return;
      }
      const mig = migriereZuweisungen(obj);
      const anzKont = Array.isArray(mig.kontakte) ? mig.kontakte.length : 0;
      const anzVes  = Array.isArray(mig.ves) ? mig.ves.length : 0;
      setPendingImport({
        art: "daten",
        titel: "Daten aus „" + dateiname + "\u201C einspielen?",
        zeilen: [anzKont + " Kontakte · " + anzVes + " Objekte",
          "Die aktuellen Daten werden überschrieben."],
        warnung: schemaWarnung(obj),
        anwenden: () => {
          // Objekte zuerst normalisieren — die Einheiten/Belegungen darin sind
          // die Quelle für die Rollen-Ableitung.
          const veNorm = Array.isArray(mig.ves) ? normalisiereVes(mig.ves) : null;
          let kontNorm = Array.isArray(mig.kontakte) ? normalisiereKontakte(mig.kontakte) : null;
          // Rollen (objektZuweisungen + rollen[]) zentral aus dem Besitz-/
          // Belegungsmodell ALLER Objekte ableiten. Dadurch muss die Importdatei
          // Eigentümer/SEV/Mieter/Bewohner NICHT mehr vorberechnen.
          if (kontNorm && veNorm) kontNorm = wendeKontaktZuweisungenAnAlle(kontNorm, veNorm);
          if (kontNorm) setKontakte(kontNorm);
          if (veNorm)   setVes(veNorm);
        },
      });
    }, (msg) => setImportFehler({ art: "daten", text: msg }));
  };

  const onSettingsReset = () => {
    if (resetBereit !== "settings") {
      setPendingImport(null); setImportFehler(null);
      setResetBereit("settings");
      return;
    }
    setResetBereit(null);
    storage.setzeZurueck("settings");
    setSettings(DEFAULT_SETTINGS);
  };

  // Excel-Import: liest die AllesDa-Vorlage (.xlsx) ein und mappt sie ins
  // App-Schema. ERSETZT die aktuellen Daten — nach Inline-Bestätigung
  // (kein confirm/alert, DESIGN §25.2).
  const onExcelImport = () => {
    meldungenZuruecksetzen();
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".xlsx,.xls,.xlsm,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
    input.style.display = "none";
    input.onchange = async (e) => {
      const file = e.target.files && e.target.files[0];
      if (!file) return;
      try {
        const erg = await importiereExcel(file);
        if (erg.fehler.length > 0) {
          setImportFehler({ art: "excel", text: "Der Import konnte nicht "
            + "ausgeführt werden: " + erg.fehler.join(" · ") });
          return;
        }
        const s = erg.statistik;
        const zeilen = [
          s.objekte + " Objekte · " + s.einheiten + " Einheiten",
          s.personen + " Personen · " + s.firmen + " Firmen · "
            + s.zuordnungen + " Zuordnungen",
          "Die aktuellen Daten werden ERSETZT.",
        ];
        setPendingImport({
          art: "excel",
          titel: "Aus Datei „" + file.name + "\u201C einspielen?",
          zeilen,
          warnung: erg.warnungen.length > 0 ? erg.warnungen.join(" · ") : null,
          anwenden: () => {
            try {
              window.dispatchEvent(new CustomEvent("allesda:datei-loaded",
                { detail: { quelle: "excel-import" } }));
            } catch (err) {}
            const veNorm = normalisiereVes(erg.ves);
            let kontNorm = normalisiereKontakte(erg.kontakte);
            // Rollen zentral aus dem Besitz-/Belegungsmodell ableiten (wie beim
            // JSON-Import) — keine Vorberechnung in den Importquellen nötig.
            kontNorm = wendeKontaktZuweisungenAnAlle(kontNorm, veNorm);
            setKontakte(kontNorm);
            setVes(veNorm);
          },
        });
      } catch (err) {
        setImportFehler({ art: "excel", text: "Excel-Datei konnte nicht "
          + "eingelesen werden: " + (err.message || err) });
      } finally {
        try { document.body.removeChild(input); } catch (e2) {}
      }
    };
    document.body.appendChild(input);
    input.click();
  };

  const btnPrimary = {
    display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
    width: "100%", boxSizing: "border-box",
    background: accent, color: getContrastColor(accent), border: "none",
    borderRadius: RAD.ms, padding: "10px 14px", cursor: "pointer",
    fontFamily: "inherit", fontSize: FS.m, fontWeight: FW.medium,
  };
  const btnSecondary = {
    display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
    width: "100%", boxSizing: "border-box",
    background: accent + "4D", color: t.text, border: `1px solid ${accent}80`,
    borderRadius: RAD.ms, padding: "10px 14px", cursor: "pointer",
    fontFamily: "inherit", fontSize: FS.m, fontWeight: FW.medium,
  };
  const btnDanger = {
    display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
    width: "100%", boxSizing: "border-box",
    background: accent + "1A", color: "#EF4444",
    border: "1px solid #EF444460",
    borderRadius: RAD.ms, padding: "10px 14px", cursor: "pointer",
    fontFamily: "inherit", fontSize: FS.m, fontWeight: FW.medium,
  };
  const btnNeutral = {
    display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
    width: "100%", boxSizing: "border-box",
    background: t.card, color: t.text, border: `1px solid ${t.border}`,
    borderRadius: RAD.ms, padding: "10px 14px", cursor: "pointer",
    fontFamily: "inherit", fontSize: FS.m, fontWeight: FW.medium,
  };
  const btnGruppe = { display: "flex", flexDirection: "column", gap: 8, padding: "6px 0" };

  // Inline-Box (Bestätigung oder Fehler) für eine Import-Art — wird in der
  // jeweiligen EinstellKarte unter den Buttons gerendert (Muster wie modusPill).
  const meldungFuer = (art) => (
    <>
      {pendingImport && pendingImport.art === art && (
        <ImportMeldung variante="bestaetigen" t={t} accent={accent}
          titel={pendingImport.titel} zeilen={pendingImport.zeilen}
          warnung={pendingImport.warnung}
          onJa={() => { pendingImport.anwenden(); setPendingImport(null); }}
          onNein={() => setPendingImport(null)}/>
      )}
      {importFehler && importFehler.art === art && (
        <ImportMeldung variante="fehler" t={t} accent={accent}
          titel={importFehler.text} onNein={() => setImportFehler(null)}/>
      )}
    </>
  );
  // Zwei-Schritt-Reset-Button (DESIGN §25.2): scharf = rot ausgefüllt.
  const resetButton = (art, onClick, label, scharfLabel) => (
    <button onClick={onClick} style={resetBereit === art
      ? { ...btnNeutral, background: "#EF4444", color: "#fff",
          border: "1px solid #EF4444" }
      : btnNeutral}>
      <I name="x" size={12} color={resetBereit === art ? "#fff" : t.sub}/>
      {resetBereit === art ? scharfLabel : label}
    </button>
  );

  return (
    <>
      <EinstellKarte title="Excel-Vorlage einspielen" t={t} accent={accent}>
        <div style={{ fontSize: FS.m, color: t.sub, marginBottom: 10, lineHeight: 1.5 }}>
          Liest eine ausgefüllte <strong>AllesDa-Vorlage</strong> (.xlsx) ein und
          ersetzt die aktuellen Arbeitsdaten. Ideal zum Erstbefüllen aus deinem
          Bestand oder zum Wechsel auf eine Vorführungs-Version.
          <br/><br/>
          Die Vorlage hat fünf Tabellenblätter:
          <em> Objekte, Einheiten, Personen, Firmen, Zuordnungen</em>. Vor dem
          Anwenden zeigt die App eine Zusammenfassung.
        </div>
        <div style={btnGruppe}>
          <button onClick={onExcelImport} style={btnPrimary}>
            <I name="document" size={12} color={getContrastColor(accent)}/>Excel-Datei wählen…
          </button>
        </div>
        {meldungFuer("excel")}
      </EinstellKarte>

      <EinstellKarte title="Einstellungen sichern" t={t} accent={accent}>
        <div style={{ fontSize: FS.m, color: t.sub, marginBottom: 10, lineHeight: 1.4 }}>
          Persönliche Einstellungen (Dunkelmodus, Filter, Rollen, Sektions-Reihenfolge usw.) als JSON-Datei speichern oder aus einer Datei wiederherstellen.
        </div>
        <div style={btnGruppe}>
          <button onClick={onSettingsExport} style={btnPrimary}>
            <I name="document" size={12} color={getContrastColor(accent)}/>Einstellungen exportieren
          </button>
          <button onClick={onSettingsImport} style={btnSecondary}>
            <I name="document" size={12} color={t.text}/>Einstellungen einspielen…
          </button>
          {resetButton("settings", onSettingsReset,
            "Zurücksetzen", "Wirklich auf Werkseinstellungen zurücksetzen?")}
        </div>
        {meldungFuer("settings")}
        <div style={{ fontSize: FS.s, color: t.muted, marginTop: 6 }}>
          Aktuelle Größe im Browser: {formatKB(groesse.settings)}
        </div>
      </EinstellKarte>

      <EinstellKarte title="Arbeitsdaten sichern" t={t} accent={accent}>
        <div style={{ fontSize: FS.m, color: t.sub, marginBottom: 10, lineHeight: 1.4 }}>
          Alle Kontakte und Objekte als JSON-Datei speichern oder aus einer Datei wiederherstellen. Geeignet als Backup vor größeren Änderungen.
        </div>
        <div style={btnGruppe}>
          <button onClick={onDatenExport} style={btnPrimary}>
            <I name="document" size={12} color={getContrastColor(accent)}/>Daten exportieren
          </button>
          <button onClick={onDatenImport} style={btnSecondary}>
            <I name="document" size={12} color={t.text}/>Daten einspielen…
          </button>
        </div>
        {meldungFuer("daten")}
        <div style={{ fontSize: FS.s, color: t.muted, marginTop: 6 }}>
          {kontakte.length} Kontakte · {ves.length} Objekte · {formatKB(groesse.daten)} im Browser
        </div>
      </EinstellKarte>

      <OrdnerAnbindenKarte t={t} accent={accent}/>

      <EinstellKarte title="Speicherort" t={t} accent={accent}>
        {storage.istVerfuegbar() ? (
          <div style={{ display: "flex", alignItems: "center", gap: 8,
            padding: "8px 12px", background: "#10B98115",
            border: "1px solid #10B98140", borderRadius: RAD.ms,
            marginBottom: 10, fontSize: FS.m, color: t.text }}>
            <span style={{ width: 8, height: 8, borderRadius: RAD.pill,
              background: "#10B981", flexShrink: 0 }}></span>
            <span><strong>Speichern aktiv.</strong> Einstellungen und Daten bleiben beim Schließen des Browsers erhalten.</span>
          </div>
        ) : (
          <div style={{ display: "flex", alignItems: "flex-start", gap: 8,
            padding: "8px 12px", background: "#F59E0B15",
            border: "1px solid #F59E0B60", borderRadius: RAD.ms,
            marginBottom: 10, fontSize: FS.m, color: t.text, lineHeight: 1.4 }}>
            <span style={{ width: 8, height: 8, borderRadius: RAD.pill,
              background: "#F59E0B", flexShrink: 0, marginTop: 5 }}></span>
            <span>
              <strong>Speichern nicht verfügbar.</strong> Diese Umgebung (z.B. Vorschau in Claude oder privater Browsermodus) blockiert den lokalen Speicher.
              Änderungen gehen beim Reload verloren. Lade die Datei lokal herunter und öffne sie in deinem Browser — dann funktioniert das Auto-Speichern.
              Zwischendurch kannst du oben mit „Exportieren" eine Datei-Sicherung anlegen.
            </span>
          </div>
        )}
        <div style={{ fontSize: FS.m, color: t.sub, lineHeight: 1.5 }}>
          Aktuell werden alle Daten lokal im <strong style={{ color: t.text }}>Browser-Speicher</strong> dieses Geräts abgelegt.
          Beim Wechsel des Geräts oder beim Löschen des Browser-Speichers sind die Daten weg — bitte vorher exportieren.
          <br/><br/>
          <strong style={{ color: t.text }}>Geplant:</strong> automatische Synchronisation über die Cloud, damit die Einstellungen auf allen Geräten verfügbar sind und mehrere Benutzer am gleichen Datenbestand arbeiten können.
        </div>
      </EinstellKarte>

      <EinstellKarte title="Doppelte Firmen aufräumen" t={t} accent={accent}>
        {dublGruppen.length === 0 ? (
          <div style={{ display: "flex", alignItems: "center", gap: 8,
            padding: "8px 12px", background: "#10B98115",
            border: "1px solid #10B98140", borderRadius: RAD.ms,
            fontSize: FS.m, color: t.text }}>
            <span style={{ width: 8, height: 8, borderRadius: RAD.pill,
              background: "#10B981", flexShrink: 0 }}></span>
            <span>Keine doppelten Firmen gefunden.</span>
          </div>
        ) : (
          <>
            <div style={{ fontSize: FS.m, color: t.sub, lineHeight: 1.5, marginBottom: 12 }}>
              {dublGruppen.length === 1 ? "Eine Firma kommt" : dublGruppen.length + " Firmen kommen"} mehrfach vor.
              Beim Zusammenführen bleibt der vollständigste Datensatz; alle Objekt-Zuordnungen,
              Verträge und Zuständigkeiten der Doppel werden übernommen.
            </div>
            {dublGruppen.map((g, gi) => {
              const ist = bestaetigeMerge === g;
              const name = (g.kontakte[0].name || "").trim();
              const grundLabel = g.grund === "email" ? "gleiche E-Mail"
                : g.grund === "telefon" ? "gleiche Telefonnummer" : "gleicher Name";
              return (
                <div key={gi} style={{ padding: "10px 12px", marginBottom: 8,
                  background: t.surface, border: `1px solid ${ist ? "#F59E0B" : t.border}`,
                  borderRadius: RAD.ms }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                    <span style={{ fontSize: FS.m, fontWeight: FW.bold, color: t.text }}>{name}</span>
                    <span style={{ fontSize: FS.xs, color: t.muted,
                      padding: "1px 7px", background: t.card, borderRadius: RAD.pill }}>
                      {g.kontakte.length}× · {grundLabel}
                    </span>
                  </div>
                  {!ist ? (
                    <button onClick={() => setBestaetigeMerge(g)} style={{
                      marginTop: 8, padding: "5px 14px", fontSize: FS.s, fontWeight: FW.bold,
                      background: accent, color: getContrastColor(accent), border: "none",
                      borderRadius: RAD.sm, cursor: "pointer", fontFamily: "inherit" }}>
                      Zusammenführen
                    </button>
                  ) : (
                    <div style={{ marginTop: 8 }}>
                      <div style={{ fontSize: FS.xs, color: "#B45309", marginBottom: 7 }}>
                        {g.kontakte.length} Einträge zu einem zusammenführen? Die übrigen
                        {" " + (g.kontakte.length - 1) + " "}werden entfernt, ihre Zuordnungen
                        wandern mit. Das lässt sich nicht rückgängig machen — vorher exportieren.
                      </div>
                      <div style={{ display: "flex", gap: 6 }}>
                        <button onClick={() => setBestaetigeMerge(null)} style={{
                          flex: 1, padding: "5px 0", fontSize: FS.s, background: "transparent",
                          color: t.sub, border: `1px solid ${t.border}`, borderRadius: RAD.sm,
                          cursor: "pointer", fontFamily: "inherit" }}>
                          Abbrechen
                        </button>
                        <button onClick={() => mergeAusfuehren(g)} style={{
                          flex: 2, padding: "5px 0", fontSize: FS.s, fontWeight: FW.bold,
                          background: "#F59E0B", color: "#fff", border: "none",
                          borderRadius: RAD.sm, cursor: "pointer", fontFamily: "inherit" }}>
                          Jetzt zusammenführen
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </>
        )}
      </EinstellKarte>
    </>
  );
}

// ── Definition aller Sektionen (Reihenfolge = Anzeigereihenfolge) ───────────
// Tagesspezifische Arbeitszeiten: je Wochentag An/Aus + Von/Bis.
// Reihenfolge folgt dem eingestellten Wochenstart. Schreibt in
// settings.kalArbeitTage (Schlüssel = JS getDay 0–6).
function KalArbeitstageTabelle({ settings, set, t, accent, pill }) {
  const gVon = settings.kalArbeitVon != null ? settings.kalArbeitVon : 8;
  const gBis = settings.kalArbeitBis != null ? settings.kalArbeitBis : 17;
  const tabelle = settings.kalArbeitTage || {};
  // Default je Tag (falls noch nicht gesetzt): Mo–Fr an, Sa/So aus.
  const tagConf = (tag) => {
    const e = tabelle[tag];
    if (e) return { an: e.an !== false, von: e.von != null ? e.von : gVon, bis: e.bis != null ? e.bis : gBis };
    const werktag = tag >= 1 && tag <= 5;
    return { an: werktag, von: gVon, bis: gBis };
  };
  const setTag = (tag, patch) => {
    const c = tagConf(tag);
    const next = { ...tabelle, [tag]: { an: c.an, von: c.von, bis: c.bis, ...patch } };
    set({ kalArbeitTage: next });
  };
  const namen = ["So", "Mo", "Di", "Mi", "Do", "Fr", "Sa"];
  const reihenfolge = settings.kalWochenstart === "so"
    ? [0, 1, 2, 3, 4, 5, 6]
    : [1, 2, 3, 4, 5, 6, 0];
  const selStyle = {
    background: t.surface, border: `1px solid ${t.border}`,
    borderRadius: RAD.sm, padding: "4px 6px", fontSize: FS.input,
    color: t.text, fontFamily: "inherit", cursor: "pointer" };
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      {reihenfolge.map(tag => {
        const c = tagConf(tag);
        return (
          <div key={tag} style={{ display: "flex", alignItems: "center", gap: 8,
            padding: "6px 8px", borderRadius: RAD.sm,
            background: c.an ? "transparent" : t.surface + "80",
            border: `1px solid ${t.border}40` }}>
            <div style={{ width: 28, flexShrink: 0, fontSize: FS.m,
              fontWeight: FW.bold, color: c.an ? t.text : t.muted }}>{namen[tag]}</div>
            <button onClick={() => setTag(tag, { an: !c.an })}
              style={{ ...pill(c.an), padding: "4px 10px", flexShrink: 0 }}>
              {c.an ? "Arbeitstag" : "frei"}
            </button>
            {c.an ? (
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginLeft: "auto" }}>
                <select value={c.von}
                  onChange={e => setTag(tag, { von: parseInt(e.target.value, 10) })}
                  style={selStyle}>
                  {Array.from({ length: 24 }, (_, h) => (
                    <option key={h} value={h}>{h}:00</option>
                  ))}
                </select>
                <span style={{ fontSize: FS.xs, color: t.sub }}>–</span>
                <select value={c.bis}
                  onChange={e => setTag(tag, { bis: parseInt(e.target.value, 10) })}
                  style={selStyle}>
                  {Array.from({ length: 24 }, (_, i) => (
                    <option key={i + 1} value={i + 1}>{i + 1}:00</option>
                  ))}
                </select>
              </div>
            ) : (
              <span style={{ marginLeft: "auto", fontSize: FS.s, color: t.muted,
                fontStyle: "italic" }}>kein Arbeitszeit-Streifen</span>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── SektionKalenderPanel — Einstellungen für den Orientierungskalender ──────
function SektionKalenderPanel({ settings, setSettings, t, accent }) {
  const wochenstart = settings.kalWochenstart || "mo";
  const kw = settings.kalKw !== false;
  const zoom = settings.kalZoom || "monat";
  const set = (patch) => setSettings(s => ({ ...s, ...patch }));
  const pill = (aktiv) => ({ padding: "6px 12px", borderRadius: RAD.ms,
    border: `1px solid ${aktiv ? accent : t.border}`,
    background: aktiv ? accent + "18" : "transparent",
    color: aktiv ? accent : t.sub, fontSize: FS.s,
    fontWeight: aktiv ? FW.semibold : FW.medium, cursor: "pointer",
    fontFamily: "inherit" });
  const zeile = { marginBottom: 14 };
  const label = { fontSize: FS.s, fontWeight: FW.semibold, color: t.text, marginBottom: 6 };
  return (
    <div>
      <div style={zeile}>
        <div style={label}>Wochenstart</div>
        <div style={{ display: "flex", gap: 6 }}>
          <button onClick={() => set({ kalWochenstart: "mo" })} style={pill(wochenstart === "mo")}>Montag</button>
          <button onClick={() => set({ kalWochenstart: "so" })} style={pill(wochenstart === "so")}>Sonntag</button>
        </div>
      </div>
      <div style={zeile}>
        <div style={label}>Kalenderwochen anzeigen</div>
        <div style={{ display: "flex", gap: 6 }}>
          <button onClick={() => set({ kalKw: true })} style={pill(kw)}>An</button>
          <button onClick={() => set({ kalKw: false })} style={pill(!kw)}>Aus</button>
        </div>
      </div>
      <div style={zeile}>
        <div style={label}>Standard-Zoomstufe</div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {KAL_ZOOM_STUFEN.slice().reverse().map(s => (
            <button key={s.id} onClick={() => set({ kalZoom: s.id })}
              style={pill(zoom === s.id)}>{s.label}</button>
          ))}
        </div>
      </div>
      <div style={zeile}>
        <div style={label}>Arbeitstag (im Zeitstrahl abgesetzt)</div>
        <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
          <button onClick={() => set({ kalArbeitTageAktiv: false })}
            style={pill(!settings.kalArbeitTageAktiv)}>Einheitlich</button>
          <button onClick={() => set({ kalArbeitTageAktiv: true })}
            style={pill(!!settings.kalArbeitTageAktiv)}>Pro Wochentag</button>
        </div>
        {!settings.kalArbeitTageAktiv ? (
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <select value={settings.kalArbeitVon != null ? settings.kalArbeitVon : 8}
              onChange={e => set({ kalArbeitVon: parseInt(e.target.value, 10) })}
              style={{ background: t.surface, border: `1px solid ${t.border}`,
                borderRadius: RAD.sm, padding: "6px 8px", fontSize: FS.input,
                color: t.text, fontFamily: "inherit", cursor: "pointer" }}>
              {Array.from({ length: 24 }, (_, h) => (
                <option key={h} value={h}>{h}:00</option>
              ))}
            </select>
            <span style={{ fontSize: FS.s, color: t.sub }}>bis</span>
            <select value={settings.kalArbeitBis != null ? settings.kalArbeitBis : 17}
              onChange={e => set({ kalArbeitBis: parseInt(e.target.value, 10) })}
              style={{ background: t.surface, border: `1px solid ${t.border}`,
                borderRadius: RAD.sm, padding: "6px 8px", fontSize: FS.input,
                color: t.text, fontFamily: "inherit", cursor: "pointer" }}>
              {Array.from({ length: 24 }, (_, i) => (
                <option key={i + 1} value={i + 1}>{i + 1}:00</option>
              ))}
            </select>
          </div>
        ) : (
          <KalArbeitstageTabelle settings={settings} set={set} t={t} accent={accent} pill={pill}/>
        )}
      </div>
      <div style={zeile}>
        <div style={label}>Datum & Uhrzeit im Heute-Button</div>
        <div style={{ display: "flex", gap: 6 }}>
          <button onClick={() => set({ kalHeuteInfo: true })}
            style={pill(settings.kalHeuteInfo !== false)}>An</button>
          <button onClick={() => set({ kalHeuteInfo: false })}
            style={pill(settings.kalHeuteInfo === false)}>Aus</button>
        </div>
      </div>
      <div style={zeile}>
        <div style={label}>Termin anlegen · Modus</div>
        <div style={{ display: "flex", gap: 6 }}>
          <button onClick={() => set({ terminAnlegeModus: "gefuehrt" })}
            style={pill((settings.terminAnlegeModus || "formular") === "gefuehrt")}>Geführt (Schritt für Schritt)</button>
          <button onClick={() => set({ terminAnlegeModus: "formular" })}
            style={pill((settings.terminAnlegeModus || "formular") === "formular")}>Formular</button>
        </div>
      </div>
      <div style={zeile}>
        <div style={label}>Uhrzeit-Auswahl · Minuten-Raster</div>
        <div style={{ display: "flex", gap: 6 }}>
          <button onClick={() => set({ zeitMinutenschritt: 15 })}
            style={pill((settings.zeitMinutenschritt || 15) === 15)}>15 Min</button>
          <button onClick={() => set({ zeitMinutenschritt: 5 })}
            style={pill(settings.zeitMinutenschritt === 5)}>5 Min</button>
        </div>
      </div>
      <div style={zeile}>
        <div style={label}>Uhrzeit-Auswahl · Stunden</div>
        <div style={{ display: "flex", gap: 6, marginBottom: settings.zeitStundenModus === "24h" ? 0 : 10 }}>
          <button onClick={() => set({ zeitStundenModus: "arbeit" })}
            style={pill((settings.zeitStundenModus || "arbeit") === "arbeit")}>An Arbeitszeit</button>
          <button onClick={() => set({ zeitStundenModus: "24h" })}
            style={pill(settings.zeitStundenModus === "24h")}>Ganztags (24h)</button>
        </div>
        {(settings.zeitStundenModus || "arbeit") === "arbeit" && (
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: FS.s, color: t.sub }}>Puffer vor/nach Arbeitszeit:</span>
            <select value={settings.zeitArbeitPuffer != null ? settings.zeitArbeitPuffer : 1}
              onChange={e => set({ zeitArbeitPuffer: parseInt(e.target.value, 10) })}
              style={{ background: t.surface, border: `1px solid ${t.border}`,
                borderRadius: RAD.sm, padding: "6px 8px", fontSize: FS.input,
                color: t.text, fontFamily: "inherit", cursor: "pointer" }}>
              {[0, 1, 2, 3].map(h => <option key={h} value={h}>{h} h</option>)}
            </select>
          </div>
        )}
      </div>
      <div style={zeile}>
        <div style={label}>Termin-Bezeichnungen</div>
        <TerminBezeichnungenEditor settings={settings} setSettings={setSettings}
          t={t} accent={accent}/>
      </div>
      <div style={{ fontSize: FS.xs, color: t.muted }}>
        Der Orientierungskalender öffnet sich über den runden Kalender-Button
        im Header (zwischen Dunkelmodus und Profil). Auf breiten Bildschirmen
        heftet er sich als feste Leiste rechts an — wie das Dashboard links;
        ein erneuter Klick auf den Kalender-Button blendet ihn wieder aus.
        Auf schmalen Geräten erscheint er kurz als Overlay.
      </div>
    </div>
  );
}

const SEKTIONEN = [
  { id: "profil",        icon: "user",     farbe: "#0E7490", title: "Mein Profil",       sub: "Name, Anrede, Kontaktdaten" },
  { id: "erscheinung",   icon: "paint",    farbe: "#EAB308", title: "Erscheinungsbild",  sub: "Dunkelmodus, Header, Farben, Kontrast" },
  { id: "objekte",       icon: "building", farbe: "#06B6D4", title: "Objekte",           sub: "Anzeige, Filter-Pillen, Gruppen" },
  { id: "kontakte",      icon: "users",    farbe: "#A855F7", title: "Kontakte",          sub: "Anzeige, Filter-Pillen, Gruppen" },
  { id: "statusleiste",  icon: "bell",     farbe: "#F97316", title: "Statusleiste",      sub: "Objekt- & Kontakt-Hinweise, Jahrestage" },
  { id: "filter",        icon: "search",   farbe: "#F59E0B", title: "Filter-Optionen",   sub: "Großer Filter im Header" },
  { id: "kalender",      icon: "calendar", farbe: "#F59E0B", title: "Kalender",          sub: "Wochenstart, KW, Termin-Bezeichnungen" },
  { id: "dashboard",     icon: "building", farbe: "#0080FF", title: "Dashboard",         sub: "Kacheln, Reihenfolge, Farben" },
  { id: "suche",         icon: "search",   farbe: "#EC4899", title: "Suche",             sub: "Welche Bereiche durchsucht werden" },
  { id: "tastatur",      icon: "settings", farbe: "#10B981", title: "Tastatur",          sub: "Kürzel anpassen und drucken" },
  { id: "hv",            icon: "building", farbe: "#64748B", title: "Hausverwaltung",    sub: "Name und Stammdaten" },
  { id: "daten",         icon: "document", farbe: "#0EA5C9", title: "Daten",             sub: "Import, Export, Backup" },
];


export {
  EinstellKarte,
  EinstellZeile,
  FarbPicker,
  SEKTIONEN,
  SektionDashboard,
  SektionDaten,
  SektionErscheinungsbild,
  SektionFilterOpt,
  SektionHV,
  SektionKalenderPanel,
  SektionKontakte,
  SektionObjekte,
  SektionProfil,
  SektionStatusleiste,
  SektionSuche,
  SektionTastatur,
  TASTATUR_AKTIONEN,
  dateiZuFotoDataUrl,
  tastaturBelegungVon,
  useStorageStatus
};
