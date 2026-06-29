import React, { useState, useRef, useEffect } from "react";
import {
  ACCENT, FS, FW, RAD, KACHEL_GRID, kartenGridStyle, feldInput, getContrastColor, rolleBadgeSichtbar, sortKontakte
} from "./constants.js";
import {
  datumDe, istEmailGueltig, istPlzGueltig, istTelefonGueltig, istUrlGueltig, joinPlzOrt, listeBreiteAus
} from "./utils-basis.js";
import {
  SUGGESTIONS, ausgehendeBefugnisse, buildKontaktarten, gruppiereRollenkarten, isStellplatzTyp,
  klassifiziereZuweisung, kontaktPasstZuArt, teileVon, verwendungenVon,
  belegungVerwendungEinerEinheit, istSelbstnutzerInEinheit, karteIstSelbstnutzend
} from "./datenmodell.js";
import {
  DESKTOP_MIN_WIDTH, I, ableiteStatusVonBis, belegungsRollenFuerKontakt,
  eingehendeVertretungen, feldWertGueltig, findScrollParent, flacheZuweisungen,
  formatNameMitCtx, kontaktAllesGueltig, useAlleKontakte, useAlleVes, useFirmenRollen, useKartenBadges,
  useKontaktAnzeige, useKontaktFarbe, useLeistungen, useLoeschenErlaubt,
  useRollen, useStatusLeiste, useVerwendungen, useWindowWidth, zuweisungenFuerAvatar
} from "./utils-icons.jsx";
import {
  Avatar, DatumFeld, KontaktPicker, MasterDetailRahmen, RolleBadge, Tip, Toggle, VerwendungBadge
} from "./components.jsx";
import {
  EinheitKachel, FeldEinheitKarte, FeldObjektKarte, StatusLeiste, VEKachel, berechneKontaktStatus
} from "./objektansicht.jsx";
import { druckeHtml } from "./listen-tools.jsx";
// ╔═════════════════════════════════════════════════════════════════════════╗
// ║ SEKTION 7 · KONTAKTE-MODUL — ausgelagertes Modul                        ║
// ║ KontaktKarte · KontaktDetailKarte · RolleZeile · BeziehungEditor ·      ║
// ║ KontakteMasterDetail · KontakteScreen · DSGVO-Aktionen · CustomFelder   ║
// ╚═════════════════════════════════════════════════════════════════════════╝
import { dateiZuFotoDataUrl } from "./einstellungen.jsx";
// Vertrags-Karten — jetzt im Liegenschaft-Kern (liegenschaft.jsx).
import {
  VertragZeile, VertragFirmaKarte
} from "./liegenschaft.jsx";

// ── RolleDetailBox: aufklappbares Detail einer einzelnen Rollen-Zuweisung ───
// Zeigt alles was zu DIESER Zuweisung gespeichert ist: Einheit-Daten, Datum,
// Eigentümer-/Mieter-Flags, Vorsitz beim Beirat, Gewerk bei Firmen etc.
function RolleDetailBox({ z, ves, kontakte, t, accent, typ = "person", embedded = false, onVEClick = null, aktuellesObjektId = null }) {
  const ve = z.objektId ? (ves || []).find(v => v.id === z.objektId) : null;
  const einheit = (ve && z.einheitId) ? ve.einheiten.find(e => e.id === z.einheitId) : null;
  const firma = z.firmaId ? (kontakte || []).find(k => k.id === z.firmaId) : null;
  // Datum/Flags aus der Einheit holen (falls relevant für die Rolle)
  let von = "", bis = "", grundbuch = null, selbstnutzer = null;
  if (einheit && z.kontaktId !== undefined) {
    // Wenn wir den Kontakt finden, nehmen wir seine Daten aus der Einheit
    // (RolleZeile wird mit z gerufen, das den Kontakt-Bezug nicht direkt hat —
    // aber objektId+einheitId+rolle reichen meistens, plus kontaktId von außen)
  }
  // Eigentümer/Mieter-Daten aus der Einheit ziehen (Match über Rolle + Position)
  if (einheit && z.rolle === "Eigentümer" && z.kontaktId) {
    const e = (einheit.eigentuemer||[]).find(x => x.kontaktId === z.kontaktId);
    if (e) { von = e.von || ""; grundbuch = e.grundbuch; selbstnutzer = e.selbstnutzer; }
  } else if (einheit && z.rolle === "Mieter" && z.kontaktId) {
    const m = (einheit.mieter||[]).find(x => x.kontaktId === z.kontaktId);
    if (m) { von = m.von || ""; bis = m.bis || ""; }
  }

  const labelStyle = { fontSize: FS.xs, fontWeight: FW.bold, color: t.sub,
    textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 3 };
  const wertStyle = { fontSize: FS.l, color: t.text, fontWeight: FW.medium };
  const sectionStyle = { background: t.surface, border: `1px solid ${t.border}`,
    borderRadius: RAD.ms, padding: "10px 12px", marginBottom: 8 };

  const felder = [];
  // Objekt-Info
  if (ve) {
    felder.push({ label: "Objekt", wert: `${ve.nr}` });
    if (ve.adresse) felder.push({ label: "Adresse", wert: ve.adresse });
  }
  // Einheit-Info
  if (einheit) {
    felder.push({ label: "Einheit", wert: einheit.nr });
    if (einheit.lage) felder.push({ label: "Lage", wert: einheit.lage });
    if (einheit.flaeche) felder.push({ label: "Fläche", wert: einheit.flaeche });
    if (einheit.zimmer) felder.push({ label: "Zimmer", wert: einheit.zimmer });
    if (einheit.typ) felder.push({ label: "Typ", wert: einheit.typ });
    if (einheit.mea) felder.push({ label: "MEA", wert: einheit.mea });
    if (einheit.spStellung) felder.push({ label: "Rechtliche Stellung",
      wert: einheit.spStellung === "se_bestandteil" ? "SE-Bestandteil einer Einheit"
        : (einheit.spStellung === "ge_snr" ? "Gemeinschaft + Sondernutzungsrecht"
        : "Eigenständiges Teileigentum") });
  }
  // Firma-Bezug (für Personen die einer Firma zugeordnet sind, z.B. GF einer HV)
  if (firma) {
    felder.push({ label: "Firma", wert: firma.name });
    if (firma.rechtsform) felder.push({ label: "Rechtsform", wert: firma.rechtsform });
  }
  // Status
  felder.push({ label: "Status", wert: z.status || "aktiv" });
  // Datum von/bis
  if (von) felder.push({ label: z.status === "ehemalig" ? "Von" : "Seit", wert: von });
  if (bis) felder.push({ label: "Bis", wert: bis });
  // Flags Eigentümer
  if (grundbuch !== null) felder.push({ label: "Grundbuch", wert: grundbuch ? "Ja" : "Nein" });
  if (selbstnutzer !== null) felder.push({ label: "Selbstnutzer", wert: selbstnutzer ? "Ja" : "Nein" });
  // Vorsitz Beirat
  if (z.vorsitz) felder.push({ label: "Funktion", wert: "Vorsitz" });
  // Gewerk (Firma als Dienstleister)
  if (z.gewerk) felder.push({ label: "Gewerk", wert: z.gewerk });

  return (
    <div style={embedded ? {
      padding: "10px 12px",
    } : {
      background: accent + "0E", border: `1px solid ${accent}40`,
      borderRadius: RAD.ml, padding: "12px 14px" }}>
      <div style={{ display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
        gap: "10px 14px" }}>
        {felder.map((f, i) => (
          <div key={i}>
            <div style={labelStyle}>{f.label}</div>
            <div style={wertStyle}>{f.wert}</div>
          </div>
        ))}
      </div>
      {z.status === "ehemalig" && !von && !bis && (
        <div style={{ fontSize: FS.s, color: t.muted, fontStyle: "italic",
          marginTop: 10 }}>
          Details der ehemaligen Zeit wurden nicht erfasst.
        </div>
      )}
      {ve && onVEClick && String(ve.id) !== String(aktuellesObjektId) && (
        <div style={{ marginTop: 12, display: "flex", justifyContent: "flex-end" }}>
          <button onClick={(e) => { e.stopPropagation(); onVEClick(ve.id); }}
            style={{ fontSize: FS.s, padding: "6px 12px", background: accent + "15", color: accent,
              border: `1px solid ${accent}40`, borderRadius: RAD.sm, cursor: "pointer",
              fontWeight: FW.medium, fontFamily: "inherit", display: "inline-flex",
              alignItems: "center", gap: 5 }}>
            Zum Objekt
          </button>
        </div>
      )}
    </div>
  );
}

// ── AktionsButton: zentraler Baustein für die vier Aktions-Rollen ───────────
// Button-System (SSoT, siehe DESIGN.md §2.6):
//   rolle="bestaetigen" → Akzent (vorwärts).      Icon check.
//   rolle="abbrechen"   → neutral grau (folgenlos). Icon x (grau).
//   rolle="loesen"      → Verbindung lösen.        Icon x (rot) · Confirm AMBER.
//   rolle="loeschen"    → endgültig löschen.       Icon trash (rot) · Confirm ROT.
// Farb-Semantik: Akzent=vorwärts · Grau=folgenlos · Amber=umkehrbar weg · Rot=endgültig weg.
//
// Props:
//   rolle      — eine der vier oben.
//   onClick    — Handler.
//   farbe      — Kontakt-/Akzentfarbe (für getönten Ruhe-Hintergrund). Default: accent unnötig,
//                wenn nicht gesetzt, bleibt der Hintergrund neutral (t.card).
//   confirm    — true = "scharfer" Bestätigungs-Zustand (amber bei loesen, rot bei loeschen).
//   label      — optionaler Text rechts vom Icon (z.B. "Wirklich löschen?"). Macht den Button breiter.
//   disabled   — für bestaetigen (z.B. !dirty).
//   size       — Kantenlänge (Default 36). Icon skaliert mit.
//   title      — Tooltip.
const AKTION_FARBEN = {
  bestaetigen: { icon: "check", iconFarbe: "akzent" },
  abbrechen:   { icon: "x",     iconFarbe: "rot"    },
  loesen:      { icon: "x",     iconFarbe: "rot", confirmBg: "#F59E0B" },
  loeschen:    { icon: "trash", iconFarbe: "rot", confirmBg: "#EF4444" },
};
function AktionsButton({ rolle, onClick, farbe, confirm = false, label = null,
  disabled = false, size = 36, title, t, accent,
  variante = "rund", text = null, icon = true, flex = null }) {
  const def = AKTION_FARBEN[rolle] || AKTION_FARBEN.abbrechen;
  const tint = farbe || accent;
  const istConfirm = confirm && def.confirmBg;

  // ── Variante "breit": Formular-Abschluss-Buttons (Text, volle/flex Breite) ──
  if (variante === "breit") {
    // Bestätigen ist hier VOLL gefüllt (Akzent + Kontrast-Text), nicht nur getönt.
    let bg, border, farbeTxt;
    if (rolle === "bestaetigen") {
      const aktiv = !disabled;
      bg = aktiv ? (tint || accent) : t.muted;
      border = "none";
      farbeTxt = getContrastColor(aktiv ? (tint || accent) : t.muted);
    } else if (rolle === "loeschen") {
      bg = istConfirm ? "#EF4444" : "transparent";
      border = `1px solid ${istConfirm ? "#EF4444" : "#EF444455"}`;
      farbeTxt = istConfirm ? "#FFFFFF" : "#EF4444";
    } else if (rolle === "loesen") {
      bg = istConfirm ? "#F59E0B" : "transparent";
      border = `1px solid ${istConfirm ? "#F59E0B" : t.border}`;
      farbeTxt = istConfirm ? "#FFFFFF" : "#EF4444";
    } else { // abbrechen — neutral
      bg = t.surface;
      border = `1px solid ${t.border}`;
      farbeTxt = t.sub;
    }
    return (
      <button onClick={onClick} disabled={disabled} title={title}
        style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
          flex: flex != null ? flex : undefined,
          background: bg, border, color: farbeTxt,
          borderRadius: RAD.ms, padding: "9px 14px",
          fontFamily: "inherit", fontSize: FS.m, fontWeight: rolle === "bestaetigen" ? 700 : 600,
          cursor: disabled ? "not-allowed" : "pointer",
          opacity: disabled ? 0.6 : 1, transition: "all 0.15s" }}>
        {icon && def.icon && <I name={def.icon} size={13} color={farbeTxt}/>}
        {text && <span>{text}</span>}
      </button>
    );
  }

  // ── Variante "rund" (Default): kompakte Icon-Buttons ────────────────────────
  // Vollton app-weit; Icons in Kontrast (Haken=Kontrast, X/Papierkorb=rot).
  const ruheBg = tint || t.card;
  const ruheBorder = tint || t.border;
  let iconFarbe;
  if (def.iconFarbe === "akzent") iconFarbe = disabled ? t.muted : (tint || accent);
  else if (def.iconFarbe === "grau") iconFarbe = t.sub;
  else iconFarbe = "#EF4444"; // rot (loesen/loeschen Ruhe)
  // Bestätigen: Vollton im Akzent, Kontrast-Icon.
  let bg, border;
  if (istConfirm) { bg = def.confirmBg; border = def.confirmBg; }
  else if (rolle === "bestaetigen") { bg = (tint || accent); border = (tint || accent); }
  else { bg = ruheBg; border = ruheBorder; }
  if (istConfirm) iconFarbe = "#FFFFFF";
  else if (rolle === "bestaetigen") iconFarbe = getContrastColor(tint || accent);
  const iconSize = Math.round(size * 0.39);
  return (
    <button onClick={onClick} disabled={disabled} title={title}
      style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 5,
        height: size, flexShrink: 0,
        width: label ? "auto" : size,
        padding: label ? "0 12px" : 0,
        background: bg, border: `1px solid ${border}`,
        color: iconFarbe,
        borderRadius: RAD.pill, fontFamily: "inherit", fontSize: FS.m, fontWeight: FW.medium,
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: (disabled && rolle !== "bestaetigen") ? 0.5 : 1, transition: "all 0.15s" }}>
      <I name={def.icon} size={iconSize} color={iconFarbe}/>
      {label && <span>{label}</span>}
    </button>
  );
}

// ── ZeilenAktionen: einheitliche, vertikal gestapelte Aktions-Buttons rechts
// neben einer Listen-Karte (Rollen, Objekte, Mitarbeiter). Alle 28px.
// onEdit (Stift, optional), onLoesen (rotes X, neutraler Rahmen),
// onLoeschen (roter Papierkorb mit rotem Rahmen, optional).
// confirmLoesen / confirmLoeschen färben den jeweiligen Button "scharf".
function ZeilenAktionen({ t, onEdit, onLoesen, onLoeschen, confirmLoesen = false, confirmLoeschen = false,
  loesenTitle = "Verknüpfung lösen", loeschenTitle = "Löschen", editTitle = "Bearbeiten" }) {
  const btn = {
    width: 28, height: 28, borderRadius: RAD.sm, padding: 0, cursor: "pointer", flexShrink: 0,
    display: "flex", alignItems: "center", justifyContent: "center", background: t.card,
  };
  return (
    <div style={{ flexShrink: 0, alignSelf: "center", display: "flex", flexDirection: "column", gap: 4 }}>
      {onEdit && (
        <button onClick={(e) => { e.stopPropagation(); onEdit(); }} title={editTitle}
          style={{ ...btn, border: `1px solid ${t.border}` }}>
          <I name="pencil" size={13} color={t.sub}/>
        </button>
      )}
      {onLoeschen && (
        <button onClick={(e) => { e.stopPropagation(); onLoeschen(); }}
          title={confirmLoeschen ? "Nochmal klicken zum endgültigen Löschen (alle Daten)" : loeschenTitle}
          style={{ ...btn, gap: 4,
            width: confirmLoeschen ? "auto" : 28,
            padding: confirmLoeschen ? "0 9px" : 0,
            background: confirmLoeschen ? "#EF4444" : t.card,
            border: `1px solid ${confirmLoeschen ? "#EF4444" : "#EF444455"}`,
            fontSize: FS.xs, fontWeight: FW.medium, fontFamily: "inherit",
            color: "#FFFFFF" }}>
          <I name="trash" size={13} color={confirmLoeschen ? "#FFFFFF" : "#EF4444"}/>
          {confirmLoeschen && "Löschen?"}
        </button>
      )}
      {onLoesen && (
        <button onClick={(e) => { e.stopPropagation(); onLoesen(); }}
          title={confirmLoesen ? "Nochmal klicken zum Lösen" : loesenTitle}
          style={{ ...btn, gap: 4,
            width: confirmLoesen ? "auto" : 28,
            padding: confirmLoesen ? "0 9px" : 0,
            background: confirmLoesen ? "#F59E0B" : t.card,
            border: `1px solid ${confirmLoesen ? "#F59E0B" : t.border}`,
            fontSize: FS.xs, fontWeight: FW.medium, fontFamily: "inherit",
            color: confirmLoesen ? "#FFFFFF" : "#EF4444" }}>
          <I name="x" size={13} color={confirmLoesen ? "#FFFFFF" : "#EF4444"}/>
          {confirmLoesen && "Lösen?"}
        </button>
      )}
    </div>
  );
}

// ── RollenkarteBox: EINE gruppierte Rollenkarte (Rolle+Status) ──────────────
// Verschmolzene Darstellung: runder RolleBadge + Name + Sub-Zeile + Status-
// Pille; darunter je Objekt ein Rahmen (Bezeichnung groß, Adresse einmal) mit
// kompakten Einheit-Kacheln (2-zeilig: Einheit-Bez + Lage, rechts Kenndaten).
// Verhalten je Slot (aus gruppiereRollenkarten):
//   ve      → Objekt-Rahmen mit Einheit-Kacheln
//   gremium → Objekt-Rahmen ohne Einheiten (objektweit)
//   sev     → Ziel-Kontakt statt Objekt
//   firma   → Firma als Ziel
// Ehemalige/werdende werden ausgegraut (opacity), bleiben aber sichtbar.
// zustand:  Belegungs-Verwendung dieser Einheit ("Vermietet"|"Eigennutzung"|
//           "Leerstand"|null) — nur für Eigentümer-Karten gesetzt. selbst: ob
//           der angezeigte Kontakt diese Einheit SELBST bewohnt (Klartext-Chip).
function RollenEinheitZeile({ ve, einheit, t, accent, onClick, zustand = null, selbst = false, zustandColor = null }) {
  // Kompakte Einheit-Kachel: KEINE VE-/Adress-Wiederholung (steht im Objekt-
  // Kopf). Zwei Zeilen: Einheit-Bezeichnung + Lage; rechts Fläche/Stellung.
  if (!einheit) return null;
  const istSP = isStellplatzTyp(einheit.typ);
  let rechts = null;
  if (istSP) {
    rechts = einheit.spStellung === "se_bestandteil" ? "SE-Bestandteil"
      : (einheit.spStellung === "ge_snr" ? "GE + SNR"
      : (einheit.spStellung === "eigenstaendig" ? "Teileigentum" : "Stellplatz"));
  }
  // Zustands-Chip: Klartext + Icon in der Verwendungsfarbe. "selbst bewohnt"
  // überschreibt das generische "Eigennutzung", wenn es DER angezeigte Kontakt
  // ist. Icon konsistent zur Belegung: home (Eigennutzung), key (Vermietet),
  // circle (Leerstand).
  let chip = null;
  if (zustand) {
    const cFarbe = zustandColor || "#64748B";
    const cLabel = selbst ? "selbst bewohnt"
      : (zustand === "Vermietet" ? "vermietet"
      : (zustand === "Eigennutzung" ? "eigengenutzt" : "Leerstand"));
    const cIcon = (selbst || zustand === "Eigennutzung") ? "home"
      : (zustand === "Vermietet" ? "key" : "circle");
    chip = (
      <span style={{ display:"inline-flex", alignItems:"center", gap:4,
        fontSize: FS.xs, fontWeight: FW.bold, padding:"3px 9px", borderRadius: RAD.pill,
        color: cFarbe, background: cFarbe + "1E", whiteSpace:"nowrap" }}>
        <I name={cIcon} size={12} color={cFarbe}/>{cLabel}
      </span>
    );
  }
  return (
    <div onClick={onClick} style={{ display:"flex", alignItems:"center", gap:11,
      padding:"9px 11px", background:t.card, border:`1px solid ${t.border}`,
      borderRadius: RAD.ml, marginBottom:6, cursor:onClick?"pointer":"default" }}>
      <div style={{ width:40, flexShrink:0, display:"flex", alignItems:"center", justifyContent:"center" }}>
        <div style={{ width:36, height:36, borderRadius: RAD.md, background: accent+"18",
          display:"flex", alignItems:"center", justifyContent:"center" }}>
          <I name={istSP ? "building" : "home"} size={17} color={accent}/>
        </div>
      </div>
      <div style={{ flex:1, minWidth:0 }}>
        <div style={{ fontSize: FS.l, fontWeight: FW.heavy, color: accent,
          overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
          {einheit.nr}
        </div>
        {einheit.lage && (
          <div style={{ fontSize: FS.s, color:t.sub, marginTop:1,
            overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
            {einheit.lage}
          </div>
        )}
      </div>
      <div style={{ display:"flex", flexDirection:"column", alignItems:"flex-end", gap:4,
        flexShrink:0, textAlign:"right" }}>
        {chip}
        <div style={{ fontSize: FS.s, color:t.sub, whiteSpace:"nowrap" }}>
          {rechts ? <span>{rechts}</span> : (
            <>
              {einheit.flaeche && <strong style={{ color:t.text }}>{einheit.flaeche}</strong>}
              {einheit.zimmer && <span> · {einheit.zimmer} Zi</span>}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function RollenkarteBox({ karte, ves, kontakte, t, accent, onVEClick, onKontaktClick, kontaktId = null, aktuellesObjektId = null }) {
  const personenRollen = useRollen();
  const firmenRollen = useFirmenRollen();
  const leistungen = useLeistungen();
  const alleVerwendungen = useVerwendungen();
  const def = personenRollen.find(r => r.name === karte.rolle)
    || leistungen.find(r => r.name === karte.rolle)
    || firmenRollen.find(r => r.name === karte.rolle)
    || { name: karte.rolle, color: accent };
  const status = karte.status || "aktiv";
  const ehemalig = status === "ehemalig";
  const werdend = status === "werdend";
  const farbe = ehemalig ? "#64748B" : (def.color || accent);
  const statusFarbe = status === "aktiv" ? "#22C55E" : (werdend ? "#F59E0B" : "#94A3B8");
  const statusLabel = status === "aktiv" ? "aktiv" : (werdend ? "werdend" : "ehemalig");

  // Sub-Zeile: Vorsitz/Zähl-Info
  const objektCount = (karte.objekte || []).length;
  const einheitCount = (karte.objekte || []).reduce((s,o) => s + (o.einheiten||[]).length, 0);
  let sub = "";
  if (karte.vorsitz) sub = "Vorsitz";
  else if (objektCount > 1) sub = `${einheitCount} Einheiten in ${objektCount} Objekten`;

  // Ziel-Kontakt (sev / firma)
  const zielKontakt = karte.zielKontaktId != null
    ? (kontakte || []).find(k => String(k.id) === String(karte.zielKontaktId)) : null;
  const zielFirma = karte.firmaId != null
    ? (kontakte || []).find(k => String(k.id) === String(karte.firmaId)) : null;
  const ziel = zielKontakt || zielFirma;

  // Selbstnutzer-Ring: nur an der Eigentümer-Karte (slot "ve", Rolle Eigentümer)
  // und nur wenn DIESER Kontakt in irgendeiner seiner Einheiten selbst wohnt.
  // Rein abgeleitet (keine Datenänderung) — analog vorsitz/vertrag eine
  // "besondere Stellung", die den goldenen Ring auslöst.
  const istEigentuemerKarte = karte.rolle === "Eigentümer";
  const selbstnutzend = istEigentuemerKarte && !ehemalig
    && karteIstSelbstnutzend(karte, ves, kontaktId);

  // Verwendungsfarbe nach Name (live aus den Verwendungs-Defs, mit Defaults als
  // Fallback). Damit tragen die Zustands-Chips dieselbe Farbe wie überall sonst.
  const VERWENDUNG_FALLBACK = { Vermietet: "#10B981", Eigennutzung: "#3B82F6", Leerstand: "#DC2626" };
  const verwendungFarbe = (name) => {
    const d = (alleVerwendungen || []).find(v => v.name === name);
    return (d && d.color) || VERWENDUNG_FALLBACK[name] || "#64748B";
  };

  return (
    <div style={{ background:t.card, border:`1px solid ${t.border}`, borderRadius: RAD.ml,
      padding:12, opacity: ehemalig ? 0.62 : 1 }}>
      {/* Kopf: runder Badge + Rolle + Status */}
      <div style={{ display:"flex", alignItems:"center", gap:11, marginBottom: (karte.objekte.length || ziel) ? 11 : 0 }}>
        <RolleBadge rolle={karte.rolle} size={32} status={status} vorsitz={karte.vorsitz} selbstnutzend={selbstnutzend}/>
        <div style={{ minWidth:0, flex:1 }}>
          <div style={{ fontSize: FS.l, fontWeight: FW.heavy, color: farbe,
            overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
            {karte.rolle}{karte.vorsitz ? " (Vorsitz)" : ""}
          </div>
          {sub && <div style={{ fontSize: FS.s, color:t.sub }}>{sub}</div>}
        </div>
        <span style={{ marginLeft:"auto", flexShrink:0, fontSize: FS.xs, fontWeight: FW.bold,
          padding:"3px 9px", borderRadius: RAD.pill, color: statusFarbe,
          background: statusFarbe+"22" }}>{statusLabel}</span>
      </div>

      {/* Ziel-Kontakt (sev/firma) */}
      {ziel && (
        <div onClick={onKontaktClick ? () => onKontaktClick(ziel.id) : null}
          style={{ display:"flex", alignItems:"center", gap:10, padding:"9px 11px",
            background:t.surface, border:`1px solid ${t.border}`, borderRadius: RAD.ml,
            cursor:onKontaktClick?"pointer":"default" }}>
          <Avatar name={ziel.name || ((ziel.vorname||"")+" "+(ziel.nachname||"")).trim()}
            firma={ziel.typ==="firma"} size={32} accent={accent}/>
          <div style={{ minWidth:0 }}>
            <div style={{ fontSize: FS.m, fontWeight: FW.bold, color:t.text,
              overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
              {ziel.name || ((ziel.vorname||"")+" "+(ziel.nachname||"")).trim()}
            </div>
            <div style={{ fontSize: FS.s, color:t.sub }}>
              {karte.firmaId != null ? "Firma" : (ziel.typ==="firma" ? "Firma" : "Person")}
            </div>
          </div>
        </div>
      )}

      {/* Objekte mit Einheiten (ve/gremium) */}
      {(karte.objekte || []).map((obj, oi) => {
        const ve = (ves || []).find(v => v.id === obj.objektId);
        if (!ve) return null;
        const adrTeile = (ve.adresse || "").split(",").map(s => s.trim());
        const adr = adrTeile.slice(0, 2).join(", ");
        const objKlickbar = onVEClick && String(ve.id) !== String(aktuellesObjektId);
        return (
          <div key={oi} style={{ background:t.surface, border:`1px solid ${t.border}`,
            borderRadius: RAD.ml, padding:"11px 12px", marginBottom: oi < karte.objekte.length-1 ? 8 : 0 }}>
            <div onClick={objKlickbar ? () => onVEClick(ve.id) : null}
              style={{ marginBottom: (obj.einheiten||[]).length ? 9 : 0,
                cursor: objKlickbar ? "pointer" : "default" }}>
              <div style={{ fontSize: FS.xl, fontWeight: FW.heavy, color: accent,
                overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
                {ve.nr}
              </div>
              {adr && <div style={{ fontSize: FS.s, color:t.sub, marginTop:1 }}>
                {adr}{karte.slot === "gremium" ? " · ganze WEG" : ""}
              </div>}
            </div>
            {(obj.einheiten || []).map((eh, ei) => {
              const einheit = (ve.einheiten || []).find(e => e.id === eh.einheitId);
              if (!einheit) return null;
              // Belegungszustand nur an der Eigentümer-Karte zeigen — bei Mieter/
              // SEV wäre "vermietet" redundant. Stellplätze tragen keinen Zustand
              // (eigene Stellung-Anzeige).
              const zeigeZustand = istEigentuemerKarte && !isStellplatzTyp(einheit.typ);
              const zustand = zeigeZustand ? belegungVerwendungEinerEinheit(einheit) : null;
              const selbst = zeigeZustand && kontaktId != null
                && istSelbstnutzerInEinheit(einheit, kontaktId);
              return <RollenEinheitZeile key={ei} ve={ve} einheit={einheit} t={t} accent={accent}
                onClick={objKlickbar ? () => onVEClick(ve.id) : null}
                zustand={zustand} selbst={selbst}
                zustandColor={zustand ? verwendungFarbe(zustand) : null}/>;
            })}
          </div>
        );
      })}
    </div>
  );
}

function RolleZeile({ z, ves, kontakte, editMode, onEdit, onDelete, t, accent, typ = "person",
  aktiv = false, onClick, id, embedded = false }) {
  const personenRollen = useRollen();
  const firmenRollen = useFirmenRollen();
  const leistungen = useLeistungen();
  // Auflösung: Personen → rollen. Firmen → Objekt-Zuweisung = Leistung
  // (settings.leistungen), Anstellung/Gewerk = firmenRollen. Da die drei
  // Vokabulare disjunkt sind (siehe DESIGN.md), ist die Kette eindeutig.
  // ABER: Eine Firma kann über `besitz` auch eine PERSONEN-Rolle tragen
  // (Eigentümer/Nießbraucher etc. — eine GmbH besitzt eine Einheit). Diese
  // Rollen stehen in personenRollen. Daher bei Firmen personenRollen als
  // Fallback durchsuchen — analog zur Avatar-Badge-Logik (primaer+sekundaer).
  const rolleDef = z.rolle
    ? (typ === "firma"
        ? (leistungen.find(r => r.name === z.rolle) || firmenRollen.find(r => r.name === z.rolle)
           || personenRollen.find(r => r.name === z.rolle))
        : personenRollen.find(r => r.name === z.rolle))
    : null;
  // Wenn eine Rolle gesetzt, aber unbekannt ist: Eintrag überspringen (defensiv).
  // Wenn keine Rolle gesetzt UND Personen-Eintrag: auch überspringen (Rolle ist
  // dort Pflicht). Bei Firmen ohne Rolle: weiterrendern mit Fallback-Def.
  if (z.rolle && !rolleDef) return null;
  if (!z.rolle && typ !== "firma") return null;
  // Fallback-Def für Firmen-Einträge ohne Rolle (einmaliger Auftrag)
  const def = rolleDef || { name: "Auftrag", kuerzel: "AT", color: t.muted };

  const status = z.status || "aktiv";
  const ve = z.objektId ? (ves || []).find(v => v.id === z.objektId) : null;
  const einheit = (ve && z.einheitId) ? ve.einheiten.find(e => e.id === z.einheitId) : null;
  const firma = z.firmaId ? (kontakte || []).find(k => k.id === z.firmaId) : null;
  // Personen-/Firmen-Vertretung: Ziel ist ein anderer Kontakt (zielKontaktId).
  const zielKontakt = z.zielKontaktId != null ? (kontakte || []).find(k => String(k.id) === String(z.zielKontaktId)) : null;

  // Bezug-Zeile 1: WEG-Nr + Einheit, oder Firmenname, oder Ziel-Kontakt
  let bezugZeile = "—";
  if (zielKontakt) bezugZeile = (zielKontakt.name || ((zielKontakt.vorname || "") + " " + (zielKontakt.nachname || "")).trim() || "—");
  else if (ve)         bezugZeile = ve.nr + (einheit ? " · " + einheit.nr : "");
  else if (firma) bezugZeile = firma.name;

  // Bezug-Zeile 2: Adresse vom Objekt (Straße ohne PLZ) für Kontext;
  // bei Kontakt-Ziel: Hinweis auf die Art des Bezugs.
  let adrZeile = "\u00A0";
  if (ve) {
    const teile = (ve.adresse || "").split(",").map(s => s.trim());
    adrZeile = teile[0] || "\u00A0";
  } else if (zielKontakt) {
    adrZeile = zielKontakt.typ === "firma" ? "Firma" : "Person";
  }

  // Status-Pille rechts oben
  const statusFarbe = status === "aktiv" ? "#22C55E"
                    : status === "werdend" ? "#F59E0B"
                    : "#94A3B8";
  const miniBtn = {
    background: "none", border: `1px solid ${t.border}`, borderRadius: RAD.sm,
    width: 24, height: 24, cursor: "pointer", padding: 0, flexShrink: 0,
    display: "flex", alignItems: "center", justifyContent: "center",
  };

  return (
    <div onClick={onClick} id={id} style={{
      display: "flex", alignItems: "center", gap: 12,
      padding: "10px 12px", boxSizing: "border-box",
      background: embedded ? "transparent" : t.card,
      border: embedded ? "none" : `1px solid ${aktiv ? def.color : t.border}`,
      borderRadius: embedded ? 0 : 12,
      cursor: onClick ? "pointer" : "default",
      transition: "all 0.15s",
      scrollMarginTop: "var(--ad-header-h, 200px)" }}
      onMouseEnter={e => { if (onClick && !aktiv && !embedded) e.currentTarget.style.borderColor = def.color + "80"; }}
      onMouseLeave={e => { if (onClick && !aktiv && !embedded) e.currentTarget.style.borderColor = t.border; }}>
      {/* Links: Rollen-Badge im 48px-Wrapper analog zu Avatar bei Kontaktkarte */}
      <div style={{ width: 48, flexShrink: 0, display: "flex",
        alignItems: "center", justifyContent: "center" }}>
        {typ === "firma" ? (
          <Tip text={def.name + (status !== "aktiv" ? ` (${status})` : "")}>
            <div style={{ width: 38, height: 38, borderRadius: RAD.md,
              background: status === "aktiv" ? def.color : "transparent",
              border: status === "aktiv" ? "none" : `1.5px ${status === "werdend" ? "dashed" : "solid"} ${def.color}`,
              display: "flex", alignItems: "center", justifyContent: "center",
              opacity: status === "ehemalig" ? 0.6 : 1 }}>
              <span style={{ fontSize: FS.l, fontWeight: FW.heavy,
                color: status === "aktiv" ? getContrastColor(def.color) : def.color }}>{def.kuerzel}</span>
            </div>
          </Tip>
        ) : (
          <RolleBadge rolle={z.rolle} size={36} status={status} vorsitz={z.vorsitz}/>
        )}
      </div>
      {/* Mitte: Rolle (groß, farbig) + Bezug + Adresse */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: FS.l, fontWeight: FW.heavy, color: def.color,
          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {def.name}{z.vorsitz && def.name === "Verwaltungsbeirat" ? " · Vorsitz" : ""}
        </div>
        {zielKontakt ? (
          <>
            <div style={{ fontSize: FS.s, color: t.sub, marginTop: 1,
              overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {"für " + (zielKontakt.typ === "firma" ? "Firma" : "Person")}
            </div>
            <div style={{ fontSize: FS.s, color: t.sub,
              overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{bezugZeile}</div>
          </>
        ) : (
          <>
            <div style={{ fontSize: FS.s, color: t.sub, marginTop: 1,
              overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{bezugZeile}</div>
            <div style={{ fontSize: FS.s, color: t.sub,
              overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{adrZeile}</div>
          </>
        )}
      </div>
      {/* Rechts: nur Status-Pille — Aktions-Buttons liegen außerhalb der Karte */}
      <div style={{ display: "flex", alignItems: "center", gap: 4, flexShrink: 0 }}>
        <span style={{ fontSize: FS.xxs, padding: "3px 8px", borderRadius: RAD.ml,
          background: statusFarbe + "22", color: statusFarbe, fontWeight: FW.bold,
          letterSpacing: "0.02em" }}>{status}</span>
      </div>
    </div>
  );
}

// Rollen, deren Bezug wahlweise ein Objekt ODER eine Person/Firma sein kann.
// Bei diesen erscheint im Editor ein Objekt/Person-Umschalter; sonst nur Objekt.
const ROLLEN_MIT_PERSONENBEZUG = ["Bevollmächtigter", "Betreuer"];

// ── ObjektPicker — durchsuchbare Objektauswahl ──────────────────────────────
// Bei wenigen Objekten (≤ SCHWELLE) ein einfaches Dropdown; bei vielen ein
// aufklappbares Feld mit Suchfeld (analog KontaktPicker, aber ohne Neu-Anlegen).
// value = objektId (string) | "", onChange(id).
function ObjektPicker({ value, onChange, objekte = [], t, accent = ACCENT, placeholder = "Objekt wählen…" }) {
  const SCHWELLE = 10;
  const [offen, setOffen] = useState(false);
  const [suche, setSuche] = useState("");
  const gewaehlt = (objekte || []).find(v => String(v.id) === String(value));

  const inputStyle = feldInput(t);

  // Wenige Objekte → klassisches Dropdown.
  if ((objekte || []).length <= SCHWELLE) {
    return (
      <select value={value || ""} onChange={e => onChange(e.target.value)} style={inputStyle}>
        <option value="">{placeholder}</option>
        {objekte.map(v => <option key={v.id} value={v.id}>{v.nr} · {v.adresse}</option>)}
      </select>
    );
  }

  const q = suche.trim().toLowerCase();
  const treffer = q
    ? objekte.filter(v => ((v.nr || "") + " " + (v.adresse || "")).toLowerCase().includes(q))
    : objekte;

  return (
    <div style={{ position: "relative" }}>
      <button onClick={() => setOffen(o => !o)} type="button"
        style={{ ...inputStyle, textAlign: "left", cursor: "pointer", display: "flex",
          alignItems: "center", gap: 6, color: gewaehlt ? t.text : t.muted }}>
        <I name="building" size={13} color={gewaehlt ? accent : t.muted}/>
        <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {gewaehlt ? `${gewaehlt.nr} · ${gewaehlt.adresse}` : placeholder}
        </span>
        <I name="chevD" size={12} color={t.muted}/>
      </button>
      {offen && (
        <div style={{ marginTop: 4, border: `1px solid ${t.border}`, borderRadius: RAD.sm,
          background: t.surface, overflow: "hidden" }}>
          <input autoFocus value={suche} onChange={e => setSuche(e.target.value)}
            placeholder="Suchen (Nr. oder Adresse)…"
            style={{ width: "100%", boxSizing: "border-box", background: t.bg,
              border: "none", borderBottom: `1px solid ${t.border}`, padding: "8px 10px",
              fontSize: 16, color: t.text, outline: "none", fontFamily: "inherit" }}/>
          <div style={{ maxHeight: 220, overflowY: "auto" }}>
            {treffer.length === 0 ? (
              <div style={{ fontSize: FS.s, color: t.muted, fontStyle: "italic", padding: "10px" }}>
                Kein Objekt gefunden
              </div>
            ) : treffer.map(v => (
              <button key={v.id} type="button"
                onClick={() => { onChange(v.id); setOffen(false); setSuche(""); }}
                style={{ width: "100%", textAlign: "left", display: "block",
                  background: String(v.id) === String(value) ? accent + "18" : "transparent",
                  border: "none", borderBottom: `1px solid ${t.border}40`, cursor: "pointer",
                  padding: "8px 10px", fontFamily: "inherit", color: t.text }}>
                <div style={{ fontSize: FS.s, fontWeight: FW.medium }}>{v.nr}</div>
                <div style={{ fontSize: FS.xs, color: t.sub }}>{v.adresse}</div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── BeziehungEditor (1c-3): EIN Editor mit Wegweiser-Dropdown ───────────────
// Ersetzt RolleEditor + ObjektZuweisungEditor. Erster Schritt: Art der Beziehung
//   · besitz        → Rolle (ve/sev) + Objekt + optional Einheit
//   · zustaendigkeit → Leistung (gremium bei Person; Dienstleister bei Firma) + Objekt + optional Einheit
//   · anstellung     → Rolle (firma) + Firma
// Liefert flaches Save-Format { rolle, status, objektId?, einheitId?, firmaId?, vorsitz? },
// das addRolle/updateRolle via klassifiziereZuweisung in die neuen Felder einsortieren.
// Anzeige des fest vorgegebenen Objekts (lockObjektId) im BeziehungEditor.
function LockObjektLabel({ ves = [], lockObjektId, t }) {
  const v = (ves || []).find(x => x.id === lockObjektId);
  return v
    ? <span><strong style={{ color: t.text }}>{v.nr}</strong> · {v.adresse}</span>
    : <span>Dieses Objekt</span>;
}

function BeziehungEditor({ initial = {}, ves = [], kontakte = [], setKontakte = null, onSave, onCancel, t, accent, typ = "person", lockObjektId = null, selbstId = null }) {
  const personenRollen = useRollen();
  const firmenRollen = useFirmenRollen();
  const leistungen = useLeistungen();

  // Art aus initial._quelle ableiten (beim Bearbeiten), sonst Default je Typ.
  const artAusQuelle = initial._quelle === "besitz" ? "besitz"
    : initial._quelle === "zustaendigkeit" ? "zustaendigkeit"
    : initial._quelle === "firmenrolle" ? "anstellung"
    : null;
  const defaultArt = typ === "firma" ? "zustaendigkeit" : "besitz";
  // Art wird primär aus der gewählten Rolle abgeleitet. artFallback dient nur
  // als Zwischenspeicher (z.B. Firma+Zuständigkeit ohne konkrete Rolle).
  const [artFallback, setArtFallback] = useState(artAusQuelle || defaultArt);

  const [rolle, setRolle] = useState(initial.rolle || "");
  // Status wird nicht mehr manuell gewählt, sondern aus Von-Datum + „beabsichtigt"
  // abgeleitet (Eigentümerwechsel: Datum oft noch offen → beabsichtigt=werdend).
  const [von, setVon] = useState(initial.von || "");
  const [beabsichtigt, setBeabsichtigt] = useState(initial.status === "werdend");
  const [vorsitz, setVorsitz] = useState(!!initial.vorsitz);
  const [vertrag, setVertrag] = useState(!!initial.vertrag);
  // Personen-/Firmen-Vertretung (Bevollmächtigter/Betreuer): Bezug wahlweise
  // Objekt ODER Person/Firma. zielKontaktId = der vertretene Kontakt.
  const [zielKontaktId, setZielKontaktId] = useState(initial.zielKontaktId || "");
  const [bezugModus, setBezugModus] = useState((initial.zielKontaktId != null || initial._vollmachtModus) ? "person" : "objekt");
  // Im Objekt-Kontext ist das Objekt durch lockObjektId fixiert (die Person/Firma
  // ist bereits mit diesem Objekt verbunden) — Dropdown entfällt, Wert vorbelegt.
  const [objektId, setObjektId] = useState(initial.objektId || lockObjektId || "");
  // Mehrfachauswahl: WE + zugehöriger Stellplatz etc. (Häkchen-Liste).
  const [einheitIds, setEinheitIds] = useState(initial.einheitId ? [initial.einheitId] : []);
  const [firmaId, setFirmaId] = useState(initial.firmaId || "");

  const aktVe = (ves || []).find(v => v.id === objektId);
  const einheitenAvail = aktVe ? (aktVe.einheiten || []) : [];
  const firmen = (kontakte || []).filter(k => k.typ === "firma");

  // ── Kombiniertes Rollen-Dropdown: Gruppen statt separatem Art-Feld ──────────
  // Die "Art" der Beziehung wird aus der gewählten Rolle (ihrem slot) abgeleitet.
  // Bevollmächtigter/Betreuer sind KEINE Rollen mehr, sondern eine eigene
  // Befugnis (Spec §4) — sie werden ausschließlich über die „Hat Bevollmächtigten"-
  // Sektion gepflegt und tauchen daher nicht im Rollen-Dropdown auf.
  const personenNachSlot = (slots) => personenRollen.filter(r =>
    r.aktiv !== false && slots.indexOf(r.slot) >= 0
    && ROLLEN_MIT_PERSONENBEZUG.indexOf(r.name) < 0);
  // Gruppen je Kontakttyp + Kontext. Anstellung (firma-Slot) nur in der
  // Hauptkarte (kein lockObjektId), da nicht objektbezogen.
  let gruppen;
  if (typ === "firma") {
    gruppen = [
      { art: "zustaendigkeit", label: "Ist zuständig für (Leistung)", rollen: leistungen.filter(r => r.aktiv !== false) },
      { art: "besitz",         label: "Besitzt / nutzt",              rollen: personenNachSlot(["ve", "sev"]) },
    ];
  } else {
    gruppen = [
      { art: "besitz",         label: "Besitzt / nutzt",   rollen: personenNachSlot(["ve", "sev"]) },
      { art: "zustaendigkeit", label: "Funktion am Objekt", rollen: personenNachSlot(["gremium"]) },
    ];
    if (!lockObjektId) {
      gruppen.push({ art: "anstellung", label: "Anstellung (bei Firma)", rollen: personenNachSlot(["firma"]) });
    }
  }
  // Map: Rollenname → Art (für Ableitung beim Speichern / Folgefelder).
  const artVonRolle = {};
  gruppen.forEach(g => g.rollen.forEach(r => { artVonRolle[r.name] = g.art; }));
  // Aktuelle Art aus gewählter Rolle; Fallback auf bisherigen art-State
  // (z.B. Firma+Zuständigkeit ohne Rolle = einmaliger Auftrag).
  const art = rolle ? (artVonRolle[rolle] || (typ === "firma" ? "zustaendigkeit" : "besitz"))
                    : (typ === "firma" ? "zustaendigkeit" : artFallback);
  const def = (typ === "firma" && art === "zustaendigkeit")
    ? leistungen.find(r => r.name === rolle)
    : personenRollen.find(r => r.name === rolle);

  // Rolle wechseln: nicht passende Bezugsfelder zurücksetzen.
  // Fixiertes Objekt (lockObjektId) bleibt erhalten.
  const setRolleClean = (r) => {
    setRolle(r); setVorsitz(false); setVertrag(false);
    const a = artVonRolle[r] || (typ === "firma" ? "zustaendigkeit" : "besitz");
    setArtFallback(a);
    if (a === "anstellung") { setObjektId(lockObjektId || ""); setEinheitIds([]); }
    else { setFirmaId(""); if (!lockObjektId) { /* Objekt bleibt wählbar */ } }
  };

  // Personen-/Firmen-Vertretung aktiv? Nur bei passender Rolle, gewähltem
  // Person-Modus und außerhalb des Objekt-Kontexts (lockObjektId).
  const personVertretungMoeglich = !lockObjektId && ROLLEN_MIT_PERSONENBEZUG.indexOf(rolle) >= 0;
  const personVertretung = !!initial._vollmachtModus && personVertretungMoeglich && bezugModus === "person";

  // ── Funktion am Objekt (Verwaltungsbeirat/Rechnungsprüfer/Ansprechpartner) ──
  // Diese Rollen beziehen sich auf das OBJEKT, nicht auf Einheiten → keine
  // Einheiten-Auswahl. Funktion am Objekt setzt eine Verbindung zum Objekt voraus:
  //  · Verwaltungsbeirat / Rechnungsprüfer → nur Eigentümer
  //  · Ansprechpartner (Objekt)            → Eigentümer ODER Bewohner (Mieter etc.)
  // Wählbar sind nur passende Objekte; bei genau einem → vorausgewählt.
  const istFunktionAmObjekt = typ !== "firma" && art === "zustaendigkeit" && !personVertretung;
  const istAnsprechpartnerObjekt = rolle === "Ansprechpartner (Objekt)";
  const bezugPflicht = istFunktionAmObjekt;
  // Objekt-IDs, in denen selbstId Eigentümer ist (Einheit-Eigentümer, jeder Status).
  const eigentumsObjektIds = (selbstId == null) ? [] : (ves || []).filter(v =>
    (v.einheiten || []).some(e =>
      (e.eigentuemer || []).some(et => String(et.kontaktId) === String(selbstId)))
  ).map(v => v.id);
  // Objekt-IDs, in denen selbstId Bewohner ist (Haushaltsmitglied einer Belegung).
  const bewohnerObjektIds = (selbstId == null) ? [] : (ves || []).filter(v =>
    (v.einheiten || []).some(e =>
      teileVon(e).some(teil =>
        (teil.belegungen || []).some(b =>
          ((b.haushalt && b.haushalt.mitglieder) || []).some(m => String(m.kontaktId) === String(selbstId)))))
  ).map(v => v.id);
  // Welche Objekte stehen im Dropdown?
  const bezugsObjektIds = istAnsprechpartnerObjekt
    ? Array.from(new Set([...eigentumsObjektIds, ...bewohnerObjektIds]))
    : eigentumsObjektIds;
  const waehlbareObjekte = bezugPflicht
    ? (ves || []).filter(v => bezugsObjektIds.indexOf(v.id) >= 0)
    : (ves || []);
  // Rolle gesperrt, wenn bezugspflichtig und kein passendes Objekt vorhanden.
  const rolleGesperrtKeinEigentum = bezugPflicht && bezugsObjektIds.length === 0;

  // Bei „Funktion am Objekt": genau ein wählbares Objekt → automatisch vorwählen.
  useEffect(() => {
    if (!istFunktionAmObjekt || lockObjektId) return;
    if (waehlbareObjekte.length === 1 && objektId !== waehlbareObjekte[0].id) {
      setObjektId(waehlbareObjekte[0].id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rolle, istFunktionAmObjekt]);

  // Validierung je (abgeleiteter) Art.
  const valid =
    rolleGesperrtKeinEigentum ? false :
    personVertretung    ? (rolle && zielKontaktId) :
    art === "anstellung" ? (rolle && firmaId) :
    art === "besitz"     ? (rolle && objektId) :
    /* zustaendigkeit */   (typ === "firma" ? !!objektId : (rolle && objektId));

  const handleSave = () => {
    if (!valid) return;
    const status = ableiteStatusVonBis(von, initial.bis || "", beabsichtigt);
    const baue = (einheitId) => {
      const eintrag = { status };
      if (rolle) eintrag.rolle = rolle;
      if (von) eintrag.von = von;
      if (personVertretung) {
        eintrag.zielKontaktId = Number(zielKontaktId);
      } else if (art === "anstellung") {
        eintrag.firmaId = Number(firmaId);
      } else if (art === "besitz") {
        eintrag.objektId = objektId;
        eintrag.einheitId = einheitId || null;
      } else { // zustaendigkeit
        eintrag.objektId = objektId;
        eintrag.einheitId = einheitId || null;
        if (rolle === "Verwaltungsbeirat" && vorsitz && status !== "ehemalig") eintrag.vorsitz = true;
        if (typ === "firma" && vertrag && status !== "ehemalig") eintrag.vertrag = true;
      }
      return eintrag;
    };
    // Mehrfachauswahl: je gewählter Einheit ein Eintrag (gleiche Rolle/Datum).
    // Keine Einheit gewählt (oder Anstellung/Vertretung) → ein Eintrag aufs Objekt.
    const brauchtEinheiten = (art === "besitz" || art === "zustaendigkeit") && !personVertretung && einheitIds.length > 0;
    if (brauchtEinheiten) {
      einheitIds.forEach(eid => onSave(baue(eid)));
    } else {
      onSave(baue(null));
    }
  };

  const inputStyle = feldInput(t);
  const abgeleiteterStatus = ableiteStatusVonBis(von, initial.bis || "", beabsichtigt);
  const statusFarbe = abgeleiteterStatus === "werdend" ? "#EAB308"
    : (abgeleiteterStatus === "ehemalig" ? t.muted : "#22C55E");

  return (
    <div style={{ background: accent + "0A", border: `1px dashed ${accent}55`,
      borderRadius: RAD.md, padding: 10, marginTop: 4, marginBottom: 4 }}>
      <div style={{ fontSize: FS.xs, fontWeight: FW.bold, color: t.muted,
        marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.05em" }}>
        {initial.rolle ? "Beziehung bearbeiten" : "Neue Beziehung"}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {/* Rollen-Dropdown. Im Vollmacht-Modus auf Vertretungs-Rollen beschränkt. */}
        {initial._vollmachtModus ? (
          <select value={rolle} onChange={e => setRolleClean(e.target.value)} style={inputStyle}>
            {ROLLEN_MIT_PERSONENBEZUG.map(r => <option key={r} value={r}>{r}</option>)}
          </select>
        ) : (
          <select value={rolle} onChange={e => setRolleClean(e.target.value)} style={inputStyle}>
            <option value="">
              {typ === "firma" ? "— Keine / einmaliger Auftrag" : "Rolle / Funktion wählen…"}
            </option>
            {gruppen.map(g => (
              <optgroup key={g.art} label={g.label}>
                {g.rollen.map(r => <option key={r.name} value={r.name}>{r.name}</option>)}
              </optgroup>
            ))}
          </select>
        )}

        {/* Personen-Bevollmächtigung läuft ausschließlich über die dedizierte
            "Hat Bevollmächtigten"-Sektion (initial._vollmachtModus). Im normalen
            Rollen-Dialog hat "Bevollmächtigter" wieder nur Objekt-Bedeutung. */}

        {/* Bezug: Person/Firma bei Vertretung; sonst Objekt (+Einheit) bzw. Firma bei Anstellung */}
        {personVertretung ? (
          <KontaktPicker value={zielKontaktId ? Number(zielKontaktId) : null}
            onChange={(id) => setZielKontaktId(id != null ? String(id) : "")}
            label="Vertreter / Bevollmächtigten" t={t} accent={accent}
            kontakte={(kontakte || []).filter(c => String(c.id) !== String(selbstId))}
            setKontakte={setKontakte}/>
        ) : art === "anstellung" ? (
          <select value={firmaId} onChange={e => setFirmaId(e.target.value)} style={inputStyle}>
            <option value="">Firma wählen…</option>
            {firmen.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
          </select>
        ) : (
          <>
            {lockObjektId ? (
              <div style={{ fontSize: FS.m, color: t.sub, padding: "8px 2px",
                display: "flex", alignItems: "center", gap: 6 }}>
                <I name="building" size={13} color={t.muted}/>
                <LockObjektLabel ves={ves} lockObjektId={lockObjektId} t={t}/>
              </div>
            ) : rolleGesperrtKeinEigentum ? (
              <div style={{ fontSize: FS.s, color: t.muted, fontStyle: "italic",
                padding: "8px 10px", border: `1px dashed ${t.border}`, borderRadius: RAD.sm }}>
                {istAnsprechpartnerObjekt
                  ? "Diese Funktion setzt voraus, dass die Person Eigentümer oder Bewohner eines Objekts ist. Hier ist beides nicht hinterlegt."
                  : "Diese Funktion kann nur an einen Eigentümer vergeben werden. Diese Person ist in keinem Objekt als Eigentümer hinterlegt."}
              </div>
            ) : (
              <ObjektPicker value={objektId}
                onChange={(id) => { setObjektId(id); setEinheitIds([]); }}
                objekte={waehlbareObjekte} t={t} accent={accent}
                placeholder={bezugPflicht && !istAnsprechpartnerObjekt ? "Eigentums-Objekt wählen…" : "Objekt wählen…"}/>
            )}
            {!istFunktionAmObjekt && objektId && einheitenAvail.length > 0 && (
              <div style={{ border: `1px solid ${t.border}`, borderRadius: RAD.sm,
                padding: "4px 0", maxHeight: 200, overflowY: "auto" }}>
                <div style={{ fontSize: FS.xs, color: t.muted, padding: "2px 10px 4px" }}>
                  {art === "besitz" ? "Einheit(en) — Mehrfachauswahl" : "Einheit(en) (optional, sonst ganzes Objekt)"}
                </div>
                {einheitenAvail.map(e => {
                  const checked = einheitIds.indexOf(e.id) >= 0;
                  return (
                    <label key={e.id} style={{ display: "flex", alignItems: "center", gap: 8,
                      padding: "6px 10px", cursor: "pointer", fontSize: FS.s, color: t.text }}>
                      <input type="checkbox" checked={checked}
                        onChange={() => setEinheitIds(v => checked ? v.filter(x => x !== e.id) : [...v, e.id])}
                        style={{ width: 16, height: 16, accentColor: accent, flexShrink: 0 }}/>
                      <span style={{ fontWeight: FW.medium }}>{(e.nr || e.bez || e.id)}</span>
                      <span style={{ color: t.sub }}>· {e.typ}</span>
                    </label>
                  );
                })}
              </div>
            )}
          </>
        )}

        {/* Datum statt manueller Status-Wahl. Status leitet sich ab:
            beabsichtigt → werdend · Von in Zukunft → werdend · sonst aktiv.
            Das „Beabsichtigt"-Häkchen ist nur bei Besitz-Rollen (Eigentümer/Mieter/
            Nießbraucher/Wohnberechtigter) relevant — dort ist der Wechsel oft noch
            schwebend (Grundbuch). Bei Vollmacht/Betreuung/Funktion am Objekt entfällt es. */}
        {(rolle || (art === "zustaendigkeit" && typ === "firma")) && (
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <DatumFeld value={von} onChange={setVon} t={t} accent={accent}
              label="Beginn / ab" required={false} defaultHeute={false}/>
            {(rolle === "Eigentümer" || rolle === "Mieter") && (
              <label style={{ display: "flex", alignItems: "center", gap: 6,
                fontSize: FS.s, color: t.sub, cursor: "pointer" }}>
                <input type="checkbox" checked={beabsichtigt}
                  onChange={e => setBeabsichtigt(e.target.checked)}
                  style={{ width: 16, height: 16, accentColor: accent }}/>
                Beabsichtigt / Datum noch offen (z. B. Eigentümerwechsel im Grundbuch)
              </label>
            )}
            <div style={{ fontSize: FS.xs, color: t.sub, display: "flex", alignItems: "center", gap: 6 }}>
              Status:
              <span style={{ color: statusFarbe, fontWeight: FW.bold }}>{abgeleiteterStatus}</span>
            </div>
          </div>
        )}

        {/* Vorsitz nur bei Verwaltungsbeirat */}
        {art === "zustaendigkeit" && rolle === "Verwaltungsbeirat" && abgeleiteterStatus !== "ehemalig" && (
          <label style={{ display: "flex", alignItems: "center", gap: 6,
            fontSize: FS.s, color: t.sub, cursor: "pointer" }}>
            <input type="checkbox" checked={vorsitz} onChange={e => setVorsitz(e.target.checked)}/>
            Vorsitz (VBV)
          </label>
        )}

        {/* Vertrag nur bei Firmen-Zuständigkeit — goldener Ring markiert die
            beauftragte Firma (z. B. die mit dem Wartungsvertrag). */}
        {art === "zustaendigkeit" && typ === "firma" && rolle && abgeleiteterStatus !== "ehemalig" && (
          <label style={{ display: "flex", alignItems: "center", gap: 6,
            fontSize: FS.s, color: t.sub, cursor: "pointer" }}>
            <input type="checkbox" checked={vertrag} onChange={e => setVertrag(e.target.checked)}/>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
              mit Vertrag
              <span style={{ width: 9, height: 9, borderRadius: RAD.full, background: "#EAB308",
                boxShadow: "0 0 4px 1px #EAB30899", display: "inline-block" }}/>
            </span>
          </label>
        )}

        <div style={{ display: "flex", gap: 6, justifyContent: "flex-end", marginTop: 4 }}>
          <AktionsButton variante="breit" rolle="abbrechen" onClick={onCancel}
            text="Abbrechen" icon={false} t={t} accent={accent}/>
          <AktionsButton variante="breit" rolle="bestaetigen" disabled={!valid} onClick={handleSave}
            text={initial.rolle ? "Übernehmen" : "Hinzufügen"} icon={false} t={t} accent={accent}/>
        </div>
      </div>
    </div>
  );
}


// ── StammdatenEditor (Name, Anrede, Tels, Emails, Adresse) ──────────────────
function StammdatenEditor({ edit, setEdit, t, accent }) {
  const inputStyle = feldInput(t, { padding: "7px 10px" });
  // Eingabe-Style mit rotem Rahmen, wenn der Wert ungültig ist.
  const inputUngueltig = { ...inputStyle, border: `1px solid #EF4444` };
  const miniBtn = {
    background: "none", border: `1px solid ${t.border}`, borderRadius: RAD.sm,
    width: 22, height: 22, cursor: "pointer", padding: 0, flexShrink: 0,
    display: "flex", alignItems: "center", justifyContent: "center",
  };
  const addBtn = {
    fontSize: FS.xs, padding: "3px 8px", background: accent + "15",
    color: accent, border: "none", borderRadius: RAD.sm, cursor: "pointer",
    fontWeight: FW.medium, fontFamily: "inherit", alignSelf: "flex-start",
  };

  const ANREDEN = ["", "Herr", "Frau", "Familie", "Firma"];
  const TITEL = ["", "Dr.", "Prof.", "Prof. Dr.", "Dr. Dr.", "Dipl.-Ing.",
    "Dipl.-Kfm.", "Dipl.-Jur.", "Mag.", "RA", "B.A.", "B.Sc.", "M.A.", "M.Sc."];
  const TEL_TYPEN = ["Mobil", "Festnetz", "Geschäftlich"];
  const EMAIL_TYPEN = ["Privat", "Geschäftlich"];

  const tels = edit.tels || [];
  const emails = edit.emails || [];

  const setTel = (i, patch) => setEdit({ ...edit,
    tels: tels.map((t, idx) => idx === i ? { ...t, ...patch } : t) });
  const addTel = () => setEdit({ ...edit, tels: [...tels, { type: "Mobil", nr: "" }] });
  const rmTel  = (i) => setEdit({ ...edit, tels: tels.filter((_, idx) => idx !== i) });

  const setEmail = (i, patch) => setEdit({ ...edit,
    emails: emails.map((e, idx) => idx === i ? { ...e, ...patch } : e) });
  const addEmail = () => setEdit({ ...edit, emails: [...emails, { type: "Privat", email: "" }] });
  const rmEmail  = (i) => setEdit({ ...edit, emails: emails.filter((_, idx) => idx !== i) });

  // Weitergabe-Stern: ★ an einer Angabe bedeutet, dass die Person diese Angabe
  // zur Weitergabe freigegeben hat. Einfacher Toggle pro Eintrag — KEIN Limit.
  // Die Adresse hat EINEN gemeinsamen Stern (adresseFavorit); die alten
  // Einzel-Flags strasseFavorit/plzOrtFavorit zählen im Bestand als freigegeben
  // und werden beim ersten Umschalten ins Sammelflag überführt.
  // Flag-Name `favorit` (tels/emails) bleibt aus Kompatibilität erhalten.
  const adresseFav = !!(edit.adresseFavorit || edit.strasseFavorit || edit.plzOrtFavorit);
  const toggleFav = (kind, i) => {
    let newTels   = tels.map(x => ({ ...x }));
    let newEmails = emails.map(x => ({ ...x }));
    let newAFav   = adresseFav;
    if (kind === "tel")          newTels[i].favorit = !newTels[i].favorit;
    else if (kind === "email")   newEmails[i].favorit = !newEmails[i].favorit;
    else if (kind === "adresse") newAFav = !newAFav;
    setEdit({ ...edit, tels: newTels, emails: newEmails,
      adresseFavorit: newAFav,
      // Alte Einzel-Flags konsolidieren — ab jetzt zählt nur das Sammelflag.
      strasseFavorit: false, plzOrtFavorit: false });
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {/* Anrede + Titel */}
      <div style={{ display: "flex", gap: 4 }}>
        <select value={edit.anrede || ""}
          onChange={e => setEdit({ ...edit, anrede: e.target.value })}
          style={{ ...inputStyle, flex: 1, minWidth: 0 }}>
          {ANREDEN.map(a => <option key={a} value={a}>{a || "Anrede…"}</option>)}
        </select>
        <select value={edit.titel || ""}
          onChange={e => setEdit({ ...edit, titel: e.target.value })}
          style={{ ...inputStyle, flex: 1, minWidth: 0 }}>
          {TITEL.map(tt => <option key={tt} value={tt}>{tt || "Titel…"}</option>)}
        </select>
      </div>
      {/* Name-Zeile */}
      <div style={{ display: "flex", gap: 4 }}>
        <input type="text" placeholder="Vorname" value={edit.vorname || ""}
          onChange={e => setEdit({ ...edit, vorname: e.target.value })}
          style={inputStyle}/>
        <input type="text" placeholder="Nachname" value={edit.nachname || ""}
          onChange={e => setEdit({ ...edit, nachname: e.target.value })}
          style={inputStyle}/>
      </div>

      {/* Telefone */}
      {tels.map((tel, i) => (
        <div key={i} style={{ display: "flex", gap: 4, alignItems: "center" }}>
          <span style={{ fontSize: FS.l, width: 16, textAlign: "center", flexShrink: 0 }}>📞</span>
          <select value={tel.type} onChange={e => setTel(i, { type: e.target.value })}
            style={{ ...inputStyle, width: 105, flexShrink: 0 }}>
            {TEL_TYPEN.map(tp => <option key={tp} value={tp}>{tp}</option>)}
          </select>
          <input type="text" value={tel.nr} placeholder="0151 …"
            onChange={e => setTel(i, { nr: e.target.value })}
            style={istTelefonGueltig(tel.nr) ? inputStyle : inputUngueltig}/>
          <button onClick={() => toggleFav("tel", i)}
            title={tel.favorit ? "Weitergabe-Freigabe aufheben" : "Zur Weitergabe freigeben"}
            style={{ ...miniBtn, color: tel.favorit ? "#F59E0B" : t.muted,
              borderColor: t.border }}>
            <span style={{ fontSize: FS.m, lineHeight: 1, fontWeight: FW.bold }}>{tel.favorit ? "★" : "☆"}</span>
          </button>
          <button onClick={() => rmTel(i)} style={miniBtn} title="Telefon entfernen">
            <I name="x" size={11} color={"#EF4444"}/>
          </button>
        </div>
      ))}
      <button onClick={addTel} style={addBtn}>+ Telefon</button>

      {/* E-Mails */}
      {emails.map((em, i) => (
        <div key={i} style={{ display: "flex", gap: 4, alignItems: "center" }}>
          <span style={{ fontSize: FS.l, width: 16, textAlign: "center", flexShrink: 0 }}>✉</span>
          <select value={em.type} onChange={e => setEmail(i, { type: e.target.value })}
            style={{ ...inputStyle, width: 105, flexShrink: 0 }}>
            {EMAIL_TYPEN.map(tp => <option key={tp} value={tp}>{tp}</option>)}
          </select>
          <input type="email" value={em.email} placeholder="mail@…"
            onChange={e => setEmail(i, { email: e.target.value })}
            style={istEmailGueltig(em.email) ? inputStyle : inputUngueltig}/>
          <button onClick={() => toggleFav("email", i)}
            title={em.favorit ? "Weitergabe-Freigabe aufheben" : "Zur Weitergabe freigeben"}
            style={{ ...miniBtn, color: em.favorit ? "#F59E0B" : t.muted,
              borderColor: t.border }}>
            <span style={{ fontSize: FS.m, lineHeight: 1, fontWeight: FW.bold }}>{em.favorit ? "★" : "☆"}</span>
          </button>
          <button onClick={() => rmEmail(i)} style={miniBtn} title="E-Mail entfernen">
            <I name="x" size={11} color={"#EF4444"}/>
          </button>
        </div>
      ))}
      <button onClick={addEmail} style={addBtn}>+ E-Mail</button>

      {/* Adresse — getrennte Favoriten: Straße + Hausnr. UND PLZ + Ort
          können unabhängig auf der Kontaktkarte angezeigt werden.
          Maximal 2 Favoriten gesamt (Telefone, E-Mails, Adress-Zeilen).
          Default: nichts vorausgewählt — User markiert aktiv. */}
      <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
        <span style={{ fontSize: FS.l, width: 16, textAlign: "center", flexShrink: 0 }}>🏠</span>
        <input type="text" placeholder="Straße + Hausnr." value={edit.strasse || ""}
          onChange={e => setEdit({ ...edit, strasse: e.target.value })} style={inputStyle}/>
        <button onClick={() => toggleFav("adresse", 0)}
          title={adresseFav ? "Weitergabe-Freigabe aufheben" : "Adresse zur Weitergabe freigeben"}
          style={{ ...miniBtn,
            color: adresseFav ? "#F59E0B" : t.muted,
            borderColor: t.border }}>
          <span style={{ fontSize: FS.m, lineHeight: 1, fontWeight: FW.bold }}>
            {adresseFav ? "★" : "☆"}
          </span>
        </button>
      </div>
      <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
        <span style={{ fontSize: FS.l, width: 16, textAlign: "center", flexShrink: 0 }}>📮</span>
        <input type="text" placeholder="PLZ" value={edit.plz || ""}
          onChange={e => setEdit({ ...edit, plz: e.target.value })}
          style={{ ...(istPlzGueltig(edit.plz) ? inputStyle : inputUngueltig), flex: "0 0 72px", minWidth: 0 }}/>
        <input type="text" placeholder="Ort" value={edit.ort || ""}
          onChange={e => setEdit({ ...edit, ort: e.target.value })}
          style={{ ...inputStyle, flex: 1, minWidth: 0 }}/>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
        <span style={{ fontSize: FS.s, color: "#F59E0B", lineHeight: 1 }}>★</span>
        <span style={{ fontSize: FS.xs, color: t.muted }}>
          Mit Stern markierte Angaben sind zur Weitergabe freigegeben.
        </span>
      </div>
    </div>
  );
}

// ── FirmaStammdatenEditor (Firmenname, Rechtsform, Tel, E-Mail, Adresse, Gewerke) ─
// ── GewerkEingabe: Eingabefeld mit Vorschlägen aus den Firmen-Rollen (= Gewerke).
// Tippen filtert die Liste; Klick auf Vorschlag übernimmt ihn (einheitliche
// Schreibweise → später sauber filterbar). Freitext bleibt als Notausgang.
// Die Liste wird unter Einstellungen → Firmen-Rollen gepflegt.
function GewerkEingabe({ value, onChange, t, accent, inputStyle, autoFocus = false }) {
  const [offen, setOffen] = useState(false);
  const firmenRollen = useFirmenRollen();
  const alleGewerke = firmenRollen.filter(r => r && r.aktiv !== false && r.name).map(r => r.name);
  const wert = value || "";
  const q = wert.trim().toLowerCase();
  const vorschlaege = alleGewerke.filter(g => {
    const gl = g.toLowerCase();
    if (q.length === 0) return true;
    return gl.indexOf(q) !== -1 && gl !== q;
  }).slice(0, 50);
  const exakt = alleGewerke.some(g => g.toLowerCase() === q);
  return (
    <div style={{ position: "relative", flex: 1, minWidth: 0 }}>
      <input type="text" value={wert} placeholder="Gewerk – tippen für Vorschläge"
        autoFocus={autoFocus}
        onChange={e => { onChange(e.target.value); setOffen(true); }}
        onFocus={() => setOffen(true)}
        onBlur={() => setTimeout(() => setOffen(false), 150)}
        style={inputStyle}/>
      {offen && vorschlaege.length > 0 && (
        <div style={{ position: "absolute", left: 0, right: 0, top: "calc(100% + 2px)", zIndex: 50,
          background: t.card, border: `1px solid ${t.border}`, borderRadius: RAD.ms,
          boxShadow: "0 6px 20px rgba(0,0,0,0.35)", overflow: "hidden", maxHeight: 300, overflowY: "auto" }}>
          {!exakt && wert.trim().length > 0 && (
            <div style={{ padding: "6px 10px", fontSize: FS.xs, color: t.muted, fontStyle: "italic",
              borderBottom: `1px solid ${t.border}` }}>
              Eigener Eintrag: „{wert.trim()}" – oder Vorschlag wählen:
            </div>
          )}
          {vorschlaege.map(g => (
            <button key={g}
              onMouseDown={(e) => { e.preventDefault(); onChange(g); setOffen(false); }}
              style={{ display: "block", width: "100%", textAlign: "left",
                padding: "7px 10px", background: "none", border: "none", cursor: "pointer",
                fontSize: FS.m, color: t.text, fontFamily: "inherit" }}
              onMouseEnter={e => e.currentTarget.style.background = accent + "15"}
              onMouseLeave={e => e.currentTarget.style.background = "none"}>
              {g}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function FirmaStammdatenEditor({ edit, setEdit, t, accent }) {
  const inputStyle = feldInput(t, { padding: "7px 10px" });
  const miniBtn = {
    background: "none", border: `1px solid ${t.border}`, borderRadius: RAD.sm,
    width: 22, height: 22, cursor: "pointer", padding: 0, flexShrink: 0,
    display: "flex", alignItems: "center", justifyContent: "center",
  };
  const addBtn = {
    fontSize: FS.xs, padding: "3px 8px", background: accent + "15",
    color: accent, border: "none", borderRadius: RAD.sm, cursor: "pointer",
    fontWeight: FW.medium, fontFamily: "inherit", alignSelf: "flex-start",
  };

  const gewerke = edit.gewerke || [];
  const setGewerk = (i, val) => setEdit({ ...edit,
    gewerke: gewerke.map((g, idx) => idx === i ? val : g) });
  const addGewerk = () => setEdit({ ...edit, gewerke: [...gewerke, ""] });
  const rmGewerk  = (i) => setEdit({ ...edit, gewerke: gewerke.filter((_, idx) => idx !== i) });
  const inputUngueltig = { ...inputStyle, border: `1px solid #EF4444` };

  // Wert-Leeren-Button (leert nur den Feldinhalt, entfernt das Feld nicht)
  const ClearBtn = ({ feld, sichtbar }) => (
    sichtbar ? (
      <button onClick={() => setEdit(feld === "plzort"
        ? { ...edit, plz: "", ort: "" }
        : { ...edit, [feld]: "" })} style={miniBtn} title="Eintrag leeren">
        <I name="x" size={11} color={"#EF4444"}/>
      </button>
    ) : <span style={{ width: 22, flexShrink: 0 }}/>
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <input type="text" placeholder="Firmenname" value={edit.name || ""}
        onChange={e => setEdit({ ...edit, name: e.target.value })} style={inputStyle}/>
      <input type="text" placeholder="Rechtsform (GmbH, OHG, e.K. …)" value={edit.rechtsform || ""}
        onChange={e => setEdit({ ...edit, rechtsform: e.target.value })} style={inputStyle}/>
      <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
        <span style={{ fontSize: FS.l, width: 16, textAlign: "center", flexShrink: 0 }}>📞</span>
        <input type="text" value={edit.tel || ""} placeholder="Zentrale Tel."
          onChange={e => setEdit({ ...edit, tel: e.target.value })}
          style={istTelefonGueltig(edit.tel) ? inputStyle : inputUngueltig}/>
        <ClearBtn feld="tel" sichtbar={!!edit.tel}/>
      </div>
      <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
        <span style={{ fontSize: FS.l, width: 16, textAlign: "center", flexShrink: 0 }}>✉</span>
        <input type="email" value={edit.email || ""} placeholder="zentrale@…"
          onChange={e => setEdit({ ...edit, email: e.target.value })}
          style={istEmailGueltig(edit.email) ? inputStyle : inputUngueltig}/>
        <ClearBtn feld="email" sichtbar={!!edit.email}/>
      </div>
      <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
        <span style={{ fontSize: FS.l, width: 16, textAlign: "center", flexShrink: 0 }}>🌐</span>
        <input type="text" value={edit.homepage || ""} placeholder="www.…"
          onChange={e => setEdit({ ...edit, homepage: e.target.value })}
          style={istUrlGueltig(edit.homepage) ? inputStyle : inputUngueltig}/>
        <ClearBtn feld="homepage" sichtbar={!!edit.homepage}/>
      </div>
      <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
        <span style={{ fontSize: FS.l, width: 16, textAlign: "center", flexShrink: 0 }}>🏠</span>
        <input type="text" placeholder="Straße + Hausnr." value={edit.strasse || ""}
          onChange={e => setEdit({ ...edit, strasse: e.target.value })} style={inputStyle}/>
        <ClearBtn feld="strasse" sichtbar={!!edit.strasse}/>
      </div>
      <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
        <span style={{ fontSize: FS.l, width: 16, textAlign: "center", flexShrink: 0 }}>📮</span>
        <input type="text" placeholder="PLZ" value={edit.plz || ""}
          onChange={e => setEdit({ ...edit, plz: e.target.value })}
          style={{ ...(istPlzGueltig(edit.plz) ? inputStyle : inputUngueltig), flex: "0 0 72px", minWidth: 0 }}/>
        <input type="text" placeholder="Ort" value={edit.ort || ""}
          onChange={e => setEdit({ ...edit, ort: e.target.value })}
          style={{ ...inputStyle, flex: 1, minWidth: 0 }}/>
        <ClearBtn feld="plzort" sichtbar={!!(edit.plz || edit.ort)}/>
      </div>
      {/* Gewerke */}
      {gewerke.map((g, i) => (
        <div key={i} style={{ display: "flex", gap: 4, alignItems: "center" }}>
          <span style={{ fontSize: FS.l, width: 16, textAlign: "center", flexShrink: 0 }}>🔧</span>
          <GewerkEingabe value={g} onChange={val => setGewerk(i, val)}
            t={t} accent={accent} inputStyle={inputStyle}/>
          <button onClick={() => rmGewerk(i)} style={miniBtn} title="Gewerk entfernen">
            <I name="x" size={11} color={"#EF4444"}/>
          </button>
        </div>
      ))}
      <button onClick={addGewerk} style={{
        display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
        width: "100%", marginTop: 4, padding: "10px 14px",
        background: accent + "1A", color: accent,
        border: `1.5px dashed ${accent}80`, borderRadius: RAD.ml, cursor: "pointer",
        fontSize: FS.xl, fontWeight: FW.bold, fontFamily: "inherit",
      }}>
        <I name="plus" size={16} color={accent}/> Gewerk hinzufügen
      </button>
    </div>
  );
}

// ── Notizen-Sektion ─────────────────────────────────────────────────────────
// Textarea, die IMMER beschreibbar ist — unabhängig vom Edit-Modus.
// Wenn im Edit-Modus: Änderungen gehen in den edit-State und werden beim
// "Speichern" mitgenommen. Sonst werden sie direkt über onUpdate persistiert.
function NotizenSektion({ wert, onChange, t, accent, embedded = false }) {
  return (
    <div style={embedded ? {} : { marginTop: 10, paddingTop: 10, borderTop: `1px solid ${t.border}40` }}>
      <div style={{ fontSize: FS.s, fontWeight: FW.bold, color: t.sub,
        textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 6 }}>
        Notizen
      </div>
      <textarea
        value={wert || ""}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Notizen, Anmerkungen, Erinnerungen…"
        rows={3}
        style={{
          width: "100%", boxSizing: "border-box",
          background: t.surface, border: `1px solid ${t.border}`,
          borderRadius: RAD.ms, padding: "8px 10px",
          fontSize: FS.input, color: t.text, fontFamily: "inherit",
          outline: "none", resize: "vertical", minHeight: 60,
        }}
        onFocus={(e) => e.currentTarget.style.borderColor = accent + "80"}
        onBlur={(e) => e.currentTarget.style.borderColor = t.border}
      />
    </div>
  );
}

// ── Custom-Feld-Typen ───────────────────────────────────────────────────────
const CUSTOM_FELD_TYPEN = [
  { id: "text",   label: "Text",     icon: "Aa",  htmlType: "text" },
  { id: "number", label: "Zahl",     icon: "#",   htmlType: "number" },
  { id: "date",   label: "Datum",    icon: "📅",  htmlType: "date" },
  { id: "url",    label: "Link",     icon: "🔗",  htmlType: "url" },
  { id: "address",label: "Adresse",  icon: "🏠",  htmlType: "text" },
];

// Adress-Werte sind Objekte {strasse, plz, ort} statt Strings — Helfer dafür.
function istAdressWert(v) { return v != null && typeof v === "object"; }
function adressWertText(v) {
  if (!istAdressWert(v)) return "";
  const s = (v.strasse || "").trim();
  const p = joinPlzOrt(v.plz, v.ort) || (v.plzOrt || "").trim();
  return [s, p].filter(Boolean).join(", ");
}
// Passender Leerwert je Feldtyp (Adresse = Objekt, sonst leerer String).
function leerWertFuerTyp(typ) {
  return typ === "address" ? { strasse: "", plz: "", ort: "" } : "";
}

function formatCustomWert(typ, wert) {
  if (wert == null || wert === "") return "";
  if (typ === "address") return adressWertText(wert);
  if (typ === "date") {
    // YYYY-MM-DD → DD.MM.YYYY (DE-Format)
    const parts = String(wert).split("-");
    if (parts.length === 3) return `${parts[2]}.${parts[1]}.${parts[0]}`;
    return String(wert);
  }
  if (typ === "url") return String(wert);
  return String(wert);
}

// ── CustomFeldZeile (Einzelfeld in der Liste) ───────────────────────────────
// Im Read-Modus: Name + Wert als Text. Im Edit-Modus: Wert editierbar +
// Stift (Name/Typ ändern) + ✕ (löschen). Konsistent mit Stammdaten/Rollen.
function CustomFeldZeile({ feld, onWertChange, onRemove, editMode, t, accent }) {
  const typDef = CUSTOM_FELD_TYPEN.find(x => x.id === feld.typ) || CUSTOM_FELD_TYPEN[0];
  // address-Branch
  const adrWert = istAdressWert(feld.wert) ? feld.wert : {};
  const adrInput = {
    boxSizing: "border-box", background: t.surface,
    border: `1px solid ${t.border}`, borderRadius: RAD.sm,
    padding: "5px 8px", fontSize: FS.m, color: t.text,
    fontFamily: "inherit", outline: "none" };
  // default-Branch
  const feldOk = feldWertGueltig(feld.name, feld.typ, feld.wert);
  const ruheRand = feldOk ? t.border : "#EF4444";

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8,
      padding: "6px 0", borderBottom: `1px solid ${t.border}30` }}>
      <div style={{ flex: "0 0 130px", minWidth: 0, display: "flex", alignItems: "center", gap: 6 }}>
        <span style={{ fontSize: FS.l, opacity: 0.7 }}>{typDef.icon}</span>
        <span style={{ fontSize: FS.m, color: t.sub, fontWeight: FW.medium,
          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {feld.name}
        </span>
      </div>
      {editMode ? (
        feld.typ === "date" ? (
          <div style={{ flex: 1, minWidth: 0 }}>
            <DatumFeld value={feld.wert} onChange={onWertChange} t={t} accent={accent} iso defaultHeute={false}/>
          </div>
        ) : feld.typ === "address" ? (
          <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 6 }}>
            <input type="text" value={adrWert.strasse || ""}
              onChange={(e) => onWertChange({ ...adrWert, strasse: e.target.value })}
              placeholder="Straße + Hausnr." style={{ ...adrInput, width: "100%" }}
              onFocus={(e) => e.currentTarget.style.borderColor = accent + "80"}
              onBlur={(e) => e.currentTarget.style.borderColor = t.border}/>
            <div style={{ display: "flex", gap: 6 }}>
              <input type="text" value={adrWert.plz || ""}
                onChange={(e) => onWertChange({ ...adrWert, plz: e.target.value })}
                placeholder="PLZ" style={{ ...adrInput, flex: "0 0 72px", minWidth: 0 }}
                onFocus={(e) => e.currentTarget.style.borderColor = accent + "80"}
                onBlur={(e) => e.currentTarget.style.borderColor = t.border}/>
              <input type="text" value={adrWert.ort || ""}
                onChange={(e) => onWertChange({ ...adrWert, ort: e.target.value })}
                placeholder="Ort" style={{ ...adrInput, flex: 1, minWidth: 0 }}
                onFocus={(e) => e.currentTarget.style.borderColor = accent + "80"}
                onBlur={(e) => e.currentTarget.style.borderColor = t.border}/>
            </div>
          </div>
        ) : (
          <input
            type={typDef.htmlType}
            value={feld.wert || ""}
            onChange={(e) => onWertChange(e.target.value)}
            placeholder={`${typDef.label}…`}
            style={{
              flex: 1, minWidth: 0,
              background: t.surface, border: `1px solid ${ruheRand}`,
              borderRadius: RAD.sm, padding: "5px 8px", fontSize: FS.input, color: t.text,
              fontFamily: "inherit", outline: "none",
            }}
            onFocus={(e) => e.currentTarget.style.borderColor = feldOk ? accent + "80" : "#EF4444"}
            onBlur={(e) => e.currentTarget.style.borderColor = ruheRand}
          />
        )
      ) : (
        <div style={{ flex: 1, minWidth: 0, fontSize: FS.m, color: t.text,
          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
          padding: "5px 8px" }}>
          {formatCustomWert(feld.typ, feld.wert)
            || <span style={{ color: t.muted, fontStyle: "italic" }}>—</span>}
        </div>
      )}
      {editMode && (
        <button onClick={onRemove} title="Feld löschen"
          style={{
            background: "transparent", border: `1px solid ${t.border}`,
            borderRadius: RAD.sm, padding: "2px 6px", cursor: "pointer",
            color: "#EF4444", fontFamily: "inherit", fontSize: FS.s, fontWeight: FW.medium }}>
          ✕
        </button>
      )}
    </div>
  );
}

// ── CustomFeldForm (Inline-Formular zum Anlegen ODER Bearbeiten eines Felds) ─
function CustomFeldForm({ initial, onSave, onCancel, t, accent }) {
  const istBearbeitung = !!initial;
  const [name, setName] = useState((initial && initial.name) || "");
  const [typ, setTyp] = useState((initial && initial.typ) || "text");
  const [wert, setWert] = useState((initial && initial.wert) || "");
  const typDef = CUSTOM_FELD_TYPEN.find(x => x.id === typ) || CUSTOM_FELD_TYPEN[0];

  const kannSpeichern = name.trim().length > 0;
  const speichern = () => {
    if (!kannSpeichern) return;
    if (istBearbeitung) {
      onSave({ ...initial, name: name.trim(), typ, wert });
    } else {
      onSave({
        id: Date.now() + Math.floor(Math.random() * 1000),
        name: name.trim(), typ, wert,
      });
    }
  };

  const inputStyle = feldInput(t, { fontSize: FS.m });

  return (
    <div style={{ background: accent + "0A", border: `1px dashed ${accent}55`,
      borderRadius: RAD.md, padding: 10, marginTop: 6, marginBottom: 6 }}>
      <div style={{ fontSize: FS.xs, fontWeight: FW.bold, color: t.muted,
        marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.05em" }}>
        {istBearbeitung ? "Feld bearbeiten" : "Neues Feld"}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {!istBearbeitung && (
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 6 }}>
              <I name="sparkles" size={11} color={accent}/>
              <span style={{ fontSize: FS.xxs, fontWeight: FW.bold, color: accent,
                letterSpacing: "0.1em", textTransform: "uppercase" }}>Vorschläge</span>
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
              {SUGGESTIONS.kontakt.map((s, i) => {
                const sft = CUSTOM_FELD_TYPEN.find(x => x.id === s.type) || CUSTOM_FELD_TYPEN[0];
                const ist = name === s.name;
                return (
                  <button key={i} onClick={() => { setName(s.name); setTyp(s.type); setWert(leerWertFuerTyp(s.type)); }}
                    style={{ background: ist ? accent + "20" : t.surface,
                      border: `1px solid ${ist ? accent + "60" : t.border}`,
                      borderRadius: RAD.ms, padding: "4px 9px", cursor: "pointer", fontSize: FS.s,
                      color: ist ? accent : t.sub, display: "inline-flex", alignItems: "center",
                      gap: 4, fontFamily: "inherit" }}>
                    <span style={{ fontSize: FS.xs }}>{sft.icon}</span>{s.name}
                  </button>
                );
              })}
            </div>
          </div>
        )}
        <div>
          <div style={{ fontSize: FS.xs, color: t.muted, marginBottom: 3 }}>Feldname</div>
          <input type="text" value={name} onChange={(e) => setName(e.target.value)}
            placeholder="z. B. Geburtstag, Hobby, IBAN…" style={inputStyle}/>
        </div>
        <div>
          <div style={{ fontSize: FS.xs, color: t.muted, marginBottom: 3 }}>Typ</div>
          <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
            {CUSTOM_FELD_TYPEN.map(td => {
              const ist = typ === td.id;
              return (
                <button key={td.id} onClick={() => { setTyp(td.id); if (!istBearbeitung) setWert(leerWertFuerTyp(td.id)); }}
                  style={{
                    fontSize: FS.s, padding: "4px 10px", borderRadius: RAD.pill,
                    background: ist ? accent + "22" : "transparent",
                    border: `1px solid ${ist ? accent + "60" : t.border}`,
                    color: ist ? accent : t.sub, cursor: "pointer",
                    fontFamily: "inherit", fontWeight: ist ? 700 : 500,
                    display: "inline-flex", alignItems: "center", gap: 4 }}>
                  <span style={{ fontSize: FS.m }}>{td.icon}</span>
                  {td.label}
                </button>
              );
            })}
          </div>
        </div>
        <div>
          <div style={{ fontSize: FS.xs, color: t.muted, marginBottom: 3 }}>Wert (optional)</div>
          {typ === "date" ? (
            <DatumFeld value={wert} onChange={setWert} t={t} accent={accent} iso defaultHeute={false}/>
          ) : typ === "address" ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <input type="text" value={(istAdressWert(wert) && wert.strasse) || ""}
                onChange={(e) => setWert({ ...(istAdressWert(wert) ? wert : {}), strasse: e.target.value })}
                placeholder="Straße + Hausnr." style={inputStyle}/>
              <div style={{ display: "flex", gap: 6 }}>
                <input type="text" value={(istAdressWert(wert) && wert.plz) || ""}
                  onChange={(e) => setWert({ ...(istAdressWert(wert) ? wert : {}), plz: e.target.value })}
                  placeholder="PLZ" style={{ ...inputStyle, flex: "0 0 72px", minWidth: 0 }}/>
                <input type="text" value={(istAdressWert(wert) && wert.ort) || ""}
                  onChange={(e) => setWert({ ...(istAdressWert(wert) ? wert : {}), ort: e.target.value })}
                  placeholder="Ort" style={{ ...inputStyle, flex: 1, minWidth: 0 }}/>
              </div>
            </div>
          ) : (
            <input type={typDef.htmlType} value={wert} onChange={(e) => setWert(e.target.value)}
              placeholder={`${typDef.label}…`} style={inputStyle}/>
          )}
        </div>
        <div style={{ display: "flex", gap: 6, justifyContent: "flex-end", marginTop: 2 }}>
          <AktionsButton variante="breit" rolle="abbrechen" onClick={onCancel}
            text="Abbrechen" icon={false} t={t} accent={accent}/>
          <AktionsButton variante="breit" rolle="bestaetigen" disabled={!kannSpeichern} onClick={speichern}
            text={istBearbeitung ? "Speichern" : "Hinzufügen"} icon={false} t={t} accent={accent}/>
        </div>
      </div>
    </div>
  );
}

// ── CustomFelderSektion ─────────────────────────────────────────────────────
// Wert-Änderungen sind IMMER möglich. Struktur-Änderungen (Hinzufügen,
// Umbenennen, Typ ändern, Löschen) erfordern den Karten-Edit-Modus.
function CustomFelderSektion({ felder, onChange, editMode, t, accent, embedded = false }) {
  const [neuesFeldForm, setNeuesFeldForm] = useState(false);
  const liste = Array.isArray(felder) ? felder : [];

  const update = (idx, neueFeld) => {
    onChange(liste.map((f, i) => i === idx ? neueFeld : f));
  };
  const remove = (idx) => {
    onChange(liste.filter((_, i) => i !== idx));
  };
  const add = (neuesFeld) => {
    onChange([...liste, neuesFeld]);
    setNeuesFeldForm(false);
  };

  return (
    <div style={embedded ? {} : { marginTop: 10, paddingTop: 10, borderTop: `1px solid ${t.border}40` }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between",
        marginBottom: 6 }}>
        <div style={{ fontSize: FS.s, fontWeight: FW.bold, color: t.sub,
          textTransform: "uppercase", letterSpacing: "0.1em" }}>
          Eigene Felder ({liste.length})
        </div>
        {editMode && !neuesFeldForm && (
          <button onClick={() => setNeuesFeldForm(true)} style={{
            fontSize: FS.s, padding: "3px 10px", background: accent + "20",
            color: accent, border: "none", borderRadius: RAD.sm,
            cursor: "pointer", fontFamily: "inherit", fontWeight: FW.medium }}>
            + Feld hinzufügen
          </button>
        )}
      </div>

      {liste.length === 0 && !neuesFeldForm && (
        <div style={{ fontSize: FS.s, color: t.muted, fontStyle: "italic", padding: "6px 0" }}>
          {editMode
            ? <>Noch keine eigenen Felder. Klick {"\u201E+ Feld hinzuf\u00fcgen\u201C"} für Geburtstag, Hobby etc.</>
            : "Keine eigenen Felder."}
        </div>
      )}

      {liste.length > 0 && (
        <div>
          {liste.map((f, i) => (
            <CustomFeldZeile key={f.id || i} feld={f}
              onWertChange={(neuWert) => update(i, { ...f, wert: neuWert })}
              onRemove={() => remove(i)}
              editMode={editMode} t={t} accent={accent}/>
          ))}
        </div>
      )}

      {neuesFeldForm && editMode && (
        <CustomFeldForm
          onSave={add}
          onCancel={() => setNeuesFeldForm(false)}
          t={t} accent={accent}/>
      )}
    </div>
  );
}

// ── Mitarbeiter einer Firma ─────────────────────────────────────────────────
// Personen, die mit p.firmaId === firma.id verknüpft sind. Die Rolle innerhalb
// der Firma (Geschäftsführer, Mitarbeiter, Sachbearbeiter, Ansprechpartner)
// steht in p.objektZuweisungen als Eintrag mit { firmaId, rolle, status }
// (ohne objektId — das markiert die Firmen-interne Rolle, nicht eine
// Zuweisung zu einem konkreten Objekt).
function getFirmaMitarbeiter(firmaId, kontakte) {
  return (kontakte || [])
    .filter(k => k && k.typ === "person" && k.firmaId === firmaId)
    .map(p => {
      const zuw = (p.objektZuweisungen || []).find(
        z => z.firmaId === firmaId && !z.objektId
      );
      return {
        person: p,
        rolle: zuw ? zuw.rolle : null,
        status: zuw ? (zuw.status || "aktiv") : "aktiv",
        von: zuw ? (zuw.von || "") : "",
        bis: zuw ? (zuw.bis || "") : "",
      };
    });
}



// ── ObjektZeile: konsolidierte Liste-Karte für die Objekte-Sektion einer
// Kontakt-Detail-Karte. Aufklappbare Karte:
// Header (Icon + Bezug + Status) ist klickbar, beim Aufklappen erscheint
// ein Body INNERHALB der gleichen Karte mit Details oder Edit-Inputs.
// Im Edit-Modus können Status/Ab/Bis direkt bearbeitet werden (kein Save-
// Button — Änderungen feuern via onZuweisungUpdate sofort durch).
function ObjektZeile({ ve, einheit, zuweisungen, t, accent, editMode, aktiv = false,
  onClick, oneRolle, onBearbeiten, onRemove, onZuweisungUpdate, onGoto }) {
  const istDesktop = useWindowWidth() >= DESKTOP_MIN_WIDTH;
  if (!ve) return null;
  const istEinheit = !!einheit;
  const istSP = istEinheit && isStellplatzTyp(einheit.typ);

  const adrTeile = (ve.adresse || "").split(",").map(s => s.trim());
  const strasse = adrTeile[0] || "";

  // Erste/einzige Zuweisung als Quelle für Status/Von/Bis/Rolle
  const z = zuweisungen[0] || {};
  const rolle = z.rolle;
  const von = z.von || "";
  const bis = z.bis || "";
  // Status leitet sich aus den Datumsfeldern ab (nicht mehr manuell gesetzt).
  const status = ableiteStatusVonBis(von, bis, !!z.beabsichtigt);

  const statusFarbe = status === "aktiv" ? "#22C55E"
    : status === "werdend" ? "#F59E0B" : "#94A3B8";

  const inputStyle = feldInput(t, { fontSize: FS.m });
  const labelStyle = { fontSize: FS.xs, color: t.muted, fontWeight: FW.medium,
    textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 2 };
  const wertStyle = { fontSize: FS.m, color: t.text };

  // Akzent für die Kachel: bei mehreren Zuweisungen den passenden Roll-Akzent
  // wäre denkbar, hier nehmen wir den Objekt-Akzent (cyan-ish).

  return (
    <div style={{
      background: aktiv ? accent + "08" : t.card,
      border: `1px solid ${aktiv ? accent : t.border}`,
      borderRadius: RAD.ml, overflow: "hidden", transition: "all 0.15s",
    }}>
      {/* === Header: immer sichtbar, klickbar zum Aufklappen === */}
      <div onClick={onClick} style={{
        cursor: onClick ? "pointer" : "default",
        padding: "10px 12px",
        display: "flex", alignItems: "center", gap: 12,
      }}>
        {/* Icon */}
        <div style={{ width: 40, height: 40, borderRadius: RAD.md,
          background: accent + "20", display: "flex", alignItems: "center",
          justifyContent: "center", flexShrink: 0 }}>
          <I name={istSP ? "building" : "home"} size={18} color={accent}/>
        </div>
        {/* Title + Sub */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
            <span style={{ fontSize: FS.l, fontWeight: FW.bold, color: t.text }}>
              {ve.nr}{istEinheit ? ` · ${einheit.nr}` : ""}
            </span>
          </div>
          {(strasse || (istEinheit && einheit.lage)) && (
            <div style={{ fontSize: FS.s, color: t.sub, marginTop: 2,
              overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {strasse}{istEinheit && einheit.lage ? ` · ${einheit.lage}` : ""}
            </div>
          )}
        </div>
        {/* Rechts: Rollen-Badge + Status (Aktions-Buttons liegen außerhalb der Karte) */}
        <div style={{ display: "flex", alignItems: "center", gap: 4, flexShrink: 0 }}>
          {rolle && (
            <span style={{ fontSize: FS.xs, padding: "3px 8px", borderRadius: RAD.ml,
              background: accent + "20", color: accent, fontWeight: FW.medium }}>{rolle}</span>
          )}
          {status !== "aktiv" && (
            <span style={{ fontSize: FS.xxs, padding: "3px 8px", borderRadius: RAD.ml,
              background: statusFarbe + "22", color: statusFarbe, fontWeight: FW.bold }}>{status}</span>
          )}
        </div>
      </div>

      {/* === Body wenn aufgeklappt === */}
      {aktiv && (
        editMode && onZuweisungUpdate ? (
          /* --- Edit-Modus: Status + Ab/Bis Inputs --- */
          <div style={{ padding: "10px 12px", borderTop: `1px solid ${accent}30` }}>
            <div style={istDesktop
              ? { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }
              : { display: "flex", flexDirection: "column", gap: 8 }}>
              <div style={istDesktop ? { gridColumn: "1 / -1" } : null}>
                <div style={labelStyle}>Status</div>
                <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: FS.s,
                  color: t.sub, padding: "2px 0" }}>
                  <span style={{ color: statusFarbe, fontWeight: FW.bold }}>{status}</span>
                  <span style={{ fontSize: FS.xs, color: t.muted }}>— ergibt sich aus Ab/Bis</span>
                </div>
              </div>
              <div>
                <div style={labelStyle}>Ab</div>
                <DatumFeld value={von} onChange={v => onZuweisungUpdate({ von: v, status: ableiteStatusVonBis(v, bis, !!z.beabsichtigt) })}
                  t={t} accent={accent} iso defaultHeute={false}/>
              </div>
              <div>
                <div style={labelStyle}>Bis</div>
                <DatumFeld value={bis} onChange={v => onZuweisungUpdate({ bis: v, status: ableiteStatusVonBis(von, v, !!z.beabsichtigt) })}
                  t={t} accent={accent} iso defaultHeute={false}/>
              </div>
            </div>
            {onGoto && (
              <div style={{ marginTop: 10, display: "flex", justifyContent: "flex-end" }}>
                <button onClick={(e) => { e.stopPropagation(); onGoto(); }}
                  style={{ fontSize: FS.s, padding: "5px 12px", background: accent + "18",
                    color: accent, border: `1px solid ${accent}40`, borderRadius: RAD.sm,
                    cursor: "pointer", fontWeight: FW.medium, fontFamily: "inherit",
                    display: "inline-flex", alignItems: "center", gap: 5 }}>
                  Zum Objekt
                </button>
              </div>
            )}
          </div>
        ) : (
          /* --- Read-Modus: Details als Grid --- */
          <div style={{ padding: "10px 12px", borderTop: `1px solid ${accent}30` }}>
            <div style={{ display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: 10 }}>
              <div>
                <div style={labelStyle}>Objekt</div>
                <div style={wertStyle}>{ve.nr}</div>
              </div>
              <div>
                <div style={labelStyle}>Adresse</div>
                <div style={wertStyle}>{ve.adresse || "—"}</div>
              </div>
              {istEinheit && (
                <>
                  <div>
                    <div style={labelStyle}>Einheit</div>
                    <div style={wertStyle}>{einheit.nr}</div>
                  </div>
                  {einheit.lage && (
                    <div>
                      <div style={labelStyle}>Lage</div>
                      <div style={wertStyle}>{einheit.lage}</div>
                    </div>
                  )}
                  {einheit.flaeche && (
                    <div>
                      <div style={labelStyle}>Fläche</div>
                      <div style={wertStyle}>{einheit.flaeche}</div>
                    </div>
                  )}
                  {einheit.zimmer && (
                    <div>
                      <div style={labelStyle}>Zimmer</div>
                      <div style={wertStyle}>{einheit.zimmer}</div>
                    </div>
                  )}
                </>
              )}
              <div>
                <div style={labelStyle}>Status</div>
                <div style={wertStyle}>{status}</div>
              </div>
              {von && (
                <div>
                  <div style={labelStyle}>Ab</div>
                  <div style={wertStyle}>{von.split("-").reverse().join(".")}</div>
                </div>
              )}
              {bis && (
                <div>
                  <div style={labelStyle}>Bis</div>
                  <div style={wertStyle}>{bis.split("-").reverse().join(".")}</div>
                </div>
              )}
            </div>
            {onGoto && (
              <div style={{ marginTop: 10, display: "flex", justifyContent: "flex-end" }}>
                <button onClick={(e) => { e.stopPropagation(); onGoto(); }}
                  style={{ fontSize: FS.s, padding: "5px 12px", background: accent + "18",
                    color: accent, border: `1px solid ${accent}40`, borderRadius: RAD.sm,
                    cursor: "pointer", fontWeight: FW.medium, fontFamily: "inherit",
                    display: "inline-flex", alignItems: "center", gap: 5 }}>
                  Zum Objekt
                </button>
              </div>
            )}
          </div>
        )
      )}
    </div>
  );
}


// Modal zum Hinzufügen einer Person zur Firma
// Hinweis, wenn die gewählte Person aktuell bei einer anderen Firma hängt.
function FirmaWechselHinweis({ auswahlId, kontakte, firma, t }) {
  if (auswahlId == null) return null;
  const p = kontakte.find(k => k.id === auswahlId);
  if (!(p && p.firmaId && p.firmaId !== firma.id)) return null;
  const altFirma = kontakte.find(f => f.id === p.firmaId);
  return (
    <div style={{ marginTop: 8, padding: "6px 10px", fontSize: FS.s,
      background: "#F59E0B15", border: "1px solid #F59E0B40",
      borderRadius: RAD.sm, color: t.text }}>
      Hinweis: Diese Person ist aktuell bei „{altFirma ? altFirma.name : "?"}" eingetragen. Beim Speichern wird die Verknüpfung dorthin entfernt.
    </div>
  );
}

function AddMitarbeiterModal({ firma, kontakte, t, accent, onClose, onSave }) {
  const rollen = useRollen();
  const firmaRollen = rollen.filter(r => r.slot === "firma" && r.aktiv !== false);
  const [modus, setModus] = useState("neu"); // "neu" oder "bestehend"
  const [rolle, setRolle] = useState(firmaRollen[0] ? firmaRollen[0].name : "Mitarbeiter");
  // Felder für neue Person
  const [vorname, setVorname] = useState("");
  const [nachname, setNachname] = useState("");
  const [tel, setTel] = useState("");
  const [email, setEmail] = useState("");
  // Auswahl für bestehende Person
  const [auswahlId, setAuswahlId] = useState(null);
  const [suchBegr, setSuchBegr] = useState("");

  // Personen die wählbar sind: alle Personen die nicht schon zu DIESER Firma gehören
  const verfuegbare = kontakte
    .filter(k => k.typ === "person" && k.firmaId !== firma.id)
    .filter(k => {
      if (!suchBegr.trim()) return true;
      const q = suchBegr.toLowerCase();
      return (k.name || "").toLowerCase().includes(q)
        || (k.vorname || "").toLowerCase().includes(q)
        || (k.nachname || "").toLowerCase().includes(q);
    })
    .slice(0, 30);

  const kannSpeichern = modus === "neu"
    ? (vorname.trim().length > 0 || nachname.trim().length > 0)
    : auswahlId != null;

  const speichern = () => {
    if (!kannSpeichern) return;
    if (modus === "neu") {
      onSave({
        typ: "neu",
        person: {
          vorname: vorname.trim(),
          nachname: nachname.trim(),
          tels: tel.trim() ? [{ nr: tel.trim(), type: "Mobil" }] : [],
          emails: email.trim() ? [{ email: email.trim() }] : [],
        },
        rolle, status: "aktiv",
      });
    } else {
      onSave({ typ: "bestehend", kontaktId: auswahlId, rolle, status: "aktiv" });
    }
  };

  const tabStyle = (aktiv) => ({
    flex: 1, padding: "8px 12px",
    background: aktiv ? accent + "20" : "transparent",
    border: "none",
    borderBottom: `2px solid ${aktiv ? accent : "transparent"}`,
    color: aktiv ? accent : t.sub,
    cursor: "pointer", fontFamily: "inherit", fontSize: FS.l, fontWeight: FW.medium,
  });
  const inputStyle = {
    width: "100%", padding: "8px 10px", fontSize: FS.l,
    background: t.surface, border: `1px solid ${t.border}`,
    borderRadius: RAD.ms, color: t.text, fontFamily: "inherit", boxSizing: "border-box",
  };
  const labelStyle = { fontSize: FS.s, fontWeight: FW.medium, color: t.sub,
    textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 4 };

  return (
    <div onClick={onClose} style={{
      position: "fixed", top: 0, right: 0, bottom: 0, left: 0, background: "#0008",
      zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center",
      padding: 16 }}>
      <div onClick={(e) => e.stopPropagation()} style={{
        background: t.card, borderRadius: RAD.lg, padding: 20,
        maxWidth: 480, width: "100%", maxHeight: "90dvh", overflow: "auto",
        boxShadow: `0 10px 40px ${accent}30, 0 4px 12px #0008` }}>
        <div style={{ fontSize: FS.icon, fontWeight: FW.heavy, color: t.text, marginBottom: 4 }}>
          Person zu Firma hinzufügen
        </div>
        <div style={{ fontSize: FS.m, color: t.sub, marginBottom: 16 }}>
          {firma.name}
        </div>

        {/* Tabs: bestehend / neu */}
        <div style={{ display: "flex", borderBottom: `1px solid ${t.border}`,
          marginBottom: 14 }}>
          <button onClick={() => setModus("bestehend")} style={tabStyle(modus === "bestehend")}>
            Bestehende Person
          </button>
          <button onClick={() => setModus("neu")} style={tabStyle(modus === "neu")}>
            Neue Person
          </button>
        </div>

        {/* Rolle */}
        <div style={{ marginBottom: 14 }}>
          <div style={labelStyle}>Rolle in der Firma</div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {firmaRollen.map(r => {
              const ist = rolle === r.name;
              return (
                <button key={r.name} onClick={() => setRolle(r.name)} style={{
                  fontSize: FS.m, padding: "5px 10px", borderRadius: RAD.pill,
                  background: ist ? r.color + "22" : "transparent",
                  border: `1px solid ${ist ? r.color + "80" : t.border}`,
                  color: ist ? r.color : t.sub,
                  cursor: "pointer", fontFamily: "inherit", fontWeight: ist ? 700 : 500 }}>
                  {r.name}
                </button>
              );
            })}
          </div>
        </div>

        {/* Modus-spezifischer Bereich */}
        {modus === "neu" ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <div style={{ display: "flex", gap: 8 }}>
              <div style={{ flex: 1 }}>
                <div style={labelStyle}>Vorname</div>
                <input type="text" value={vorname} onChange={e => setVorname(e.target.value)}
                  placeholder="Max" style={inputStyle}/>
              </div>
              <div style={{ flex: 1 }}>
                <div style={labelStyle}>Nachname</div>
                <input type="text" value={nachname} onChange={e => setNachname(e.target.value)}
                  placeholder="Mustermann" style={inputStyle}/>
              </div>
            </div>
            <div>
              <div style={labelStyle}>Telefon</div>
              <input type="text" value={tel} onChange={e => setTel(e.target.value)}
                placeholder="0151 1234567" style={inputStyle}/>
            </div>
            <div>
              <div style={labelStyle}>E-Mail</div>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                placeholder="max@firma.de" style={inputStyle}/>
            </div>
          </div>
        ) : (
          <div>
            <input type="text" value={suchBegr} onChange={e => setSuchBegr(e.target.value)}
              placeholder="Person suchen…" style={{ ...inputStyle, marginBottom: 8 }}/>
            <div style={{ maxHeight: 280, overflow: "auto",
              border: `1px solid ${t.border}`, borderRadius: RAD.ms }}>
              {verfuegbare.length === 0 ? (
                <div style={{ padding: 16, fontSize: FS.m, color: t.muted, fontStyle: "italic", textAlign: "center" }}>
                  Keine Personen gefunden.
                </div>
              ) : verfuegbare.map(p => {
                const name = [p.vorname, p.nachname].filter(Boolean).join(" ") || p.name;
                const ist = auswahlId === p.id;
                return (
                  <div key={p.id} onClick={() => setAuswahlId(p.id)} style={{
                    padding: "8px 12px", cursor: "pointer",
                    background: ist ? accent + "20" : "transparent",
                    borderBottom: `1px solid ${t.border}40`,
                    display: "flex", alignItems: "center", gap: 8 }}>
                    <Avatar name={name} size={28} accent={accent}/>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: FS.l, fontWeight: FW.medium, color: t.text }}>{name}</div>
                      {p.firmaId && (
                        <div style={{ fontSize: FS.xs, color: t.muted }}>
                          aktuell bei: {(kontakte.find(f => f.id === p.firmaId) || {}).name || "?"}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
            <FirmaWechselHinweis auswahlId={auswahlId} kontakte={kontakte} firma={firma} t={t}/>
          </div>
        )}

        {/* Buttons */}
        <div style={{ display: "flex", gap: 8, marginTop: 18, justifyContent: "flex-end" }}>
          <button onClick={onClose} style={{
            padding: "8px 14px", background: "transparent",
            border: `1px solid ${t.border}`, borderRadius: RAD.ms,
            color: t.text, cursor: "pointer", fontFamily: "inherit", fontSize: FS.m, fontWeight: FW.medium }}>
            Abbrechen
          </button>
          <button onClick={speichern} disabled={!kannSpeichern} style={{
            padding: "8px 14px", background: kannSpeichern ? accent : t.border,
            border: "none", borderRadius: RAD.ms,
            color: getContrastColor(kannSpeichern ? accent : t.border), cursor: kannSpeichern ? "pointer" : "not-allowed",
            fontFamily: "inherit", fontSize: FS.m, fontWeight: FW.bold,
            opacity: kannSpeichern ? 1 : 0.5 }}>
            Hinzufügen
          </button>
        </div>
      </div>
    </div>
  );
}

// ── DSGVO-Werkzeuge (Auskunft + abgestufte Löschung) ────────────────────────
// dsgvoEinstufung: bestimmt aus den Objekt-Zuweisungen eines Kontakts, wie
// „gewichtig" eine Löschung wäre — damit der Handwerker ohne Bindung leicht
// gelöscht werden kann, ein aktiver Eigentümer aber geschützt ist.
//   "gruen"  — nichts hängt dran (keine/nur formlose Zuweisungen) → frei löschbar
//   "gelb"   — nur EHEMALIGE objektbezogene Bindungen (Alt-Eigentümer/Ex-Mieter)
//              → Aufbewahrungsfristen möglich, Löschen mit deutlicher Warnung
//   "rot"    — mind. eine AKTIVE objektbezogene Bindung → Löschen gesperrt
// WICHTIG: Eine reine Firmen-ANSTELLUNG (firmaId ohne eigenen Objektbezug) ist
// KEINE schützenswerte Bindung im DSGVO-Sinn — ein ausgeschiedener Mitarbeiter
// hängt nicht an Objekt-Aufbewahrungspflichten. Solche Einträge werden ignoriert;
// die über die Firma abgeleiteten Objekt-Rollen gehören der Firma, nicht der Person.
function dsgvoEinstufung(kontakt) {
  const zuw = (kontakt && kontakt.objektZuweisungen) || [];
  let hatAktiv = false, hatEhemalig = false;
  zuw.forEach(z => {
    if (!z) return;
    // Reine Anstellung (firmaId, kein Objekt-/Einheit-/Gerätebezug) überspringen.
    if (z.firmaId != null && z.objektId == null && z.einheitId == null && z.geraetId == null) return;
    // Eingehende Vertretungs-/Betreuungsvermerke (zielKontaktId) sind keine
    // eigene Objektbindung der Person → ebenfalls nicht löschsperrend.
    if (z.zielKontaktId != null && z.objektId == null) return;
    const s = (z.status) || "aktiv";
    if (s === "aktiv" || s === "werdend" || s === "interessent") hatAktiv = true;
    else if (s === "ehemalig") hatEhemalig = true;
    else hatAktiv = true; // unbekannter Status → vorsichtshalber als aktiv werten
  });
  if (hatAktiv) return "rot";
  if (hatEhemalig) return "gelb";
  return "gruen";
}

// anonymisiereKontakt: ersetzt alle personenbezogenen Klartext-Felder einer
// Person durch Platzhalter und markiert den Datensatz (DESIGN §26.5). Der
// Datensatz selbst bleibt mit seiner id und den objektZuweisungen erhalten —
// Belege/Historie bleiben referenzierbar, die Person ist nicht mehr
// identifizierbar. Anzeigename danach: "Kontakt #<Kürzel>" (letzte 4 Ziffern
// der id). UNWIDERRUFLICH — es gibt bewusst keine Sicherungskopie der Daten.
function kontaktAnonymKuerzel(k) {
  const roh = String((k && k.id != null) ? k.id : "");
  const ziffern = roh.replace(/\D/g, "");
  if (ziffern.length > 4) return ziffern.slice(-4);
  return ziffern || roh || "?";
}
function anonymisiereKontakt(k) {
  const platzName = "Kontakt #" + kontaktAnonymKuerzel(k);
  return {
    ...k,
    // Name-Felder: nachname trägt den Platzhalter, damit ALLE Anzeige-Pfade
    // ([vorname, nachname].join) UND der k.name-Fallback denselben Text liefern.
    name: platzName, vorname: "", nachname: platzName, anrede: "", titel: "",
    // Kontaktdaten
    tels: [], emails: [], telefon: "", mobil: "", email: "",
    // Adresse inkl. Favorit-Flags
    strasse: "", plz: "", ort: "", plzOrt: "", adresse: "",
    strasseFavorit: false, plzOrtFavorit: false, adresseFavorit: false,
    // Sonstiges Personenbezogenes
    geburtstag: "", geburtsdatum: "", notizen: "", customFelder: [], foto: "",
    // Marker: ISO-Datum der Anonymisierung → schaltet die Karte schreibgeschützt
    anonymisiert: new Date().toISOString().slice(0, 10),
  };
}

// Sammelt alle personenbezogenen Daten eines Kontakts als Klartext-Zeilen für
// die Art.-15-Auskunft. Liefert { titel, abschnitte: [{ h, zeilen:[[label,wert]] }] }.
function dsgvoAuskunftDaten(kontakt, ves) {
  const k = kontakt || {};
  const istFirma = k.typ === "firma";
  const stamm = [];
  const push = (label, wert) => { if (wert != null && String(wert).trim() !== "") stamm.push([label, String(wert).trim()]); };

  // Name aus den echten Feldern zusammensetzen (Personen: titel/vorname/nachname,
  // Firmen: name). Kein separates k.name bei Personen.
  const personName = [k.titel, k.vorname, k.nachname].filter(Boolean).join(" ").trim();
  push("Name", istFirma ? k.name : (personName || k.name));
  push("Typ", istFirma ? "Firma" : "Person");
  push("Anrede", k.anrede);
  if (istFirma) {
    push("Rechtsform", k.rechtsform);
    push("Ansprechpartner", Array.isArray(k.ansprechpartner)
      ? k.ansprechpartner.map(a => [a.titel, a.vorname, a.nachname].filter(Boolean).join(" ")
          + (a.funktion ? " (" + a.funktion + ")" : "")).filter(Boolean).join(", ")
      : null);
  }

  // Telefon-/E-Mail-Listen (Personen: tels[]/emails[] mit typ; Firmen: ggf. einzeln).
  const tels = Array.isArray(k.tels) ? k.tels : [];
  tels.forEach(tt => { if (tt && tt.nr) push("Telefon" + (tt.typ ? " (" + tt.typ + ")" : ""), tt.nr); });
  if (k.telefon) push("Telefon", k.telefon);
  if (k.mobil) push("Mobil", k.mobil);
  const emails = Array.isArray(k.emails) ? k.emails : [];
  emails.forEach(ee => { if (ee && ee.email) push("E-Mail" + (ee.typ ? " (" + ee.typ + ")" : ""), ee.email); });
  if (k.email) push("E-Mail", k.email);

  // Adresse aus strasse + plzOrt (bzw. plz/ort) bzw. fertigem adresse-Feld.
  const plzOrt = k.plzOrt || [k.plz, k.ort].filter(Boolean).join(" ");
  const adresse = k.adresse || [k.strasse, plzOrt].filter(Boolean).join(", ");
  push("Adresse", adresse);

  push("Geburtsdatum", k.geburtstag || k.geburtsdatum);
  push("Notizen", k.notizen);

  // Eigene Felder (benutzerdefiniert) — als lesbare Label/Wert-Paare.
  if (Array.isArray(k.customFelder)) {
    k.customFelder.forEach(cf => { if (cf && cf.name && cf.value != null && String(cf.value).trim() !== "") push(cf.name, cf.value); });
  }

  const veName = (id) => {
    const v = (ves || []).find(x => x && x.id === id);
    return v ? (v.nr ? v.nr + " · " : "") + (v.adresse || "Objekt") : "Objekt " + id;
  };
  const rollen = ((k.objektZuweisungen) || []).map(z => {
    const ort = z.objektId ? veName(z.objektId) : (z.firmaId ? "Firma" : "—");
    const st = (z.status || "aktiv");
    return [(z.rolle || "Rolle") + (st !== "aktiv" ? " (" + st + ")" : ""), ort];
  });

  return {
    titel: "DSGVO-Auskunft – " + (istFirma ? (k.name || "Firma") : (personName || k.name || "Kontakt")),
    abschnitte: [
      { h: "Stammdaten", zeilen: stamm },
      { h: "Rollen & Objekt-Verknüpfungen", zeilen: rollen.length ? rollen : [["—", "keine Verknüpfungen"]] },
    ],
  };
}

// Öffnet den Druckdialog mit der formatierten Auskunft → dort „Als PDF sichern".
// Nutzt den gemeinsamen iframe-Druck-Baustein druckeHtml (DESIGN §26.3).
function druckeDsgvoAuskunft(kontakt, ves) {
  const daten = dsgvoAuskunftDaten(kontakt, ves);
  const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const heute = new Date().toLocaleDateString("de-DE");
  let body = "<h1>" + esc(daten.titel) + "</h1>";
  body += '<p class="meta">Auskunft nach Art. 15 DSGVO · Stand: ' + esc(heute) + "</p>";
  daten.abschnitte.forEach(ab => {
    body += "<h2>" + esc(ab.h) + "</h2><table>";
    ab.zeilen.forEach(([label, wert]) => {
      body += "<tr><th>" + esc(label) + "</th><td>" + esc(wert) + "</td></tr>";
    });
    body += "</table>";
  });
  return druckeHtml(daten.titel, body, false,
    "h2{font-size:14px;margin:24px 0 6px;border-bottom:1px solid #ccc;padding-bottom:3px;}"
    + "th{border-bottom:none;width:180px;vertical-align:top;color:#555;font-weight:600;padding:4px 8px 4px 0;}"
    + "td{border-bottom:none;padding:4px 0;}");
}

// ── KontaktDsgvoAktionen — Auskunft (immer) + abgestufte Löschung ────────────
// Eigener Bereich unten im Kontaktprofil. Der Auskunfts-Button ist immer da
// (Auskunft erteilen ist unbedenklich). Der Lösch-Button ersetzt den alten
// einfachen Lösch-Button und ist abgestuft nach dsgvoEinstufung (DESIGN §26):
//   gruen → 2 Klick · gelb → 2 Klick + Warntext · rot → gesperrt mit Hinweis.
// onDelete wird nur aufgerufen, wenn nicht gesperrt und die Bestätigung erfolgt.
// NEU (v9.63): Bei Stufe "gelb" zusätzlich "Anonymisieren" (§26.5) — gleiche
// 2-Klick-Mechanik, ruft onAnonymisieren. Ist der Kontakt bereits anonymisiert,
// zeigt der Bereich nur noch eine Status-Box (Karte ist dann schreibgeschützt).
function KontaktDsgvoAktionen({ kontakt, ves, t, accent, onDelete, onAnonymisieren, loeschenErlaubt }) {
  const [bestaetigen, setBestaetigen] = useState(false);
  const [bestAnon, setBestAnon] = useState(false);
  useEffect(() => {
    if (!bestaetigen) return;
    const to = setTimeout(() => setBestaetigen(false), 6000);
    return () => clearTimeout(to);
  }, [bestaetigen]);
  useEffect(() => {
    if (!bestAnon) return;
    const to = setTimeout(() => setBestAnon(false), 6000);
    return () => clearTimeout(to);
  }, [bestAnon]);

  const stufe = dsgvoEinstufung(kontakt);
  const gesperrt = stufe === "rot";
  const ROT = "#EF4444", ORANGE = "#F59E0B";

  const onAuskunft = () => {
    druckeDsgvoAuskunft(kontakt, ves);
    // Bei blockiertem Popup: still bleiben — der Browser zeigt seinen eigenen Hinweis.
  };
  const onLoeschClick = () => {
    if (gesperrt) return;
    setBestAnon(false);
    if (!bestaetigen) { setBestaetigen(true); return; }
    setBestaetigen(false);
    if (onDelete) onDelete();
  };
  const onAnonClick = () => {
    setBestaetigen(false);
    if (!bestAnon) { setBestAnon(true); return; }
    setBestAnon(false);
    if (onAnonymisieren) onAnonymisieren();
  };

  const btnBasis = {
    display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6,
    padding: "8px 14px", borderRadius: RAD.sm, cursor: "pointer",
    fontSize: FS.m, fontWeight: FW.medium, fontFamily: "inherit",
  };

  // Bereits anonymisiert → nur Status-Box, keine Aktionen mehr (Karte ist
  // schreibgeschützt; eine Auskunft über Platzhalter wäre sinnfrei).
  if (kontakt && kontakt.anonymisiert) {
    return (
      <div style={{ marginTop: 14, paddingTop: 12, borderTop: `1px solid ${t.border}` }}>
        <div style={{ fontSize: FS.s, fontWeight: FW.bold, color: t.sub,
          textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 8 }}>
          Datenschutz (DSGVO)
        </div>
        <div style={{ padding: "8px 11px", background: t.surface,
          border: `1px solid ${t.border}`, borderRadius: RAD.sm, fontSize: FS.s,
          color: t.sub, lineHeight: 1.5 }}>
          Dieser Kontakt wurde am <b>{datumDe(kontakt.anonymisiert)}</b> anonymisiert.
          Alle personenbezogenen Daten wurden unwiderruflich entfernt; die
          Rollen-Historie bleibt für Belege referenzierbar. Die Karte ist
          schreibgeschützt.
        </div>
      </div>
    );
  }

  return (
    <div style={{ marginTop: 14, paddingTop: 12, borderTop: `1px solid ${t.border}` }}>
      <div style={{ fontSize: FS.s, fontWeight: FW.bold, color: t.sub,
        textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 8 }}>
        Datenschutz (DSGVO)
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
        <button onClick={onAuskunft} title="Alle gespeicherten Daten als PDF (Auskunft nach Art. 15 DSGVO)"
          style={{ ...btnBasis, background: accent + "15", color: accent,
            border: `1px solid ${accent}40` }}>
          <I name="document" size={13} color={accent}/>Auskunft als PDF
        </button>

        {loeschenErlaubt && onDelete && (
          gesperrt ? (
            <button disabled title="Kontakt ist aktiv eingebunden — erst Rollen beenden"
              style={{ ...btnBasis, background: t.surface, color: t.muted,
                border: `1px solid ${t.border}`, cursor: "not-allowed" }}>
              <I name="x" size={13} color={t.muted}/>Löschen gesperrt
            </button>
          ) : (
            <button onClick={onLoeschClick}
              title={bestaetigen ? "Nochmal klicken zum endgültigen Löschen" : "Kontakt löschen (Recht auf Löschung, Art. 17 DSGVO)"}
              style={{ ...btnBasis,
                background: bestaetigen ? ROT : ROT + "12",
                color: bestaetigen ? "#fff" : ROT,
                border: `1px solid ${ROT}${bestaetigen ? "" : "40"}` }}>
              <I name="x" size={13} color={bestaetigen ? "#fff" : ROT}/>
              {bestaetigen ? "Endgültig löschen?" : "Kontakt löschen"}
            </button>
          )
        )}

        {/* Anonymisieren — nur Stufe gelb (ehemalige Bindungen → Aufbewahrungs-
            fall, §26.5). Orange, gleiche 2-Klick-Mechanik wie Löschen. */}
        {stufe === "gelb" && loeschenErlaubt && onAnonymisieren && (
          <button onClick={onAnonClick}
            title={bestAnon ? "Nochmal klicken zum endgültigen Anonymisieren" : "Personenbezogene Daten unwiderruflich durch Platzhalter ersetzen"}
            style={{ ...btnBasis,
              background: bestAnon ? ORANGE : ORANGE + "12",
              color: bestAnon ? "#fff" : ORANGE,
              border: `1px solid ${ORANGE}${bestAnon ? "" : "40"}` }}>
            <I name="user" size={13} color={bestAnon ? "#fff" : ORANGE}/>
            {bestAnon ? "Endgültig anonymisieren?" : "Anonymisieren"}
          </button>
        )}
      </div>

      {/* Stufen-spezifische Aufklärung */}
      {gesperrt && (
        <div style={{ marginTop: 8, padding: "8px 11px", background: ROT + "10",
          border: `1px solid ${ROT}30`, borderRadius: RAD.sm, fontSize: FS.s,
          color: t.text, lineHeight: 1.5 }}>
          Dieser Kontakt ist <b>aktuell eingebunden</b> (aktive Rolle an einem Objekt).
          Solange das so ist, läuft der Verarbeitungszweck weiter — ein Löschen ist
          nicht zulässig. Beende zuerst die aktiven Rollen; danach lässt sich der
          Kontakt löschen oder anonymisieren.
        </div>
      )}
      {stufe === "gelb" && bestaetigen && (
        <div style={{ marginTop: 8, padding: "8px 11px", background: ORANGE + "12",
          border: `1px solid ${ORANGE}40`, borderRadius: RAD.sm, fontSize: FS.s,
          color: t.text, lineHeight: 1.5 }}>
          ⚠ Dieser Kontakt war <b>früher eingebunden</b> (z. B. ehemaliger Eigentümer
          oder Mieter). Unterlagen mit Bezug zu dieser Person — Abrechnungen, Beschlüsse,
          Verträge — können <b>gesetzlichen Aufbewahrungsfristen</b> (oft 6–10 Jahre)
          unterliegen. Prüfe, ob statt einer Löschung eine <b>Anonymisierung</b>
          (Button daneben) genügt — sie entfernt die Personendaten, hält aber die
          Verknüpfungen für Belege nach. Nochmal klicken löscht den Kontakt endgültig.
        </div>
      )}
      {stufe === "gelb" && bestAnon && (
        <div style={{ marginTop: 8, padding: "8px 11px", background: ORANGE + "12",
          border: `1px solid ${ORANGE}40`, borderRadius: RAD.sm, fontSize: FS.s,
          color: t.text, lineHeight: 1.5 }}>
          Anonymisieren ersetzt Name, Kontaktdaten, Adresse, Foto, Notizen und
          eigene Felder <b>unwiderruflich</b> durch Platzhalter — der Kontakt heißt
          danach „Kontakt #{kontaktAnonymKuerzel(kontakt)}". Die Rollen-Historie
          (z. B. „Eigentümer, ehemalig") bleibt erhalten, damit Abrechnungen und
          Beschlüsse referenzierbar bleiben. Die Karte ist danach <b>schreibgeschützt</b>.
          Nochmal klicken bestätigt.
        </div>
      )}
      {stufe === "gruen" && bestaetigen && (
        <div style={{ marginTop: 8, padding: "8px 11px", background: t.surface,
          border: `1px solid ${t.border}`, borderRadius: RAD.sm, fontSize: FS.s,
          color: t.sub, lineHeight: 1.5 }}>
          An diesem Kontakt hängen keine Objekt-Bindungen. Löschen entfernt ihn mit
          allen Daten unwiderruflich. Nochmal klicken bestätigt.
        </div>
      )}
    </div>
  );
}

// ── KontaktDetailKarte Sub-Komponenten ───────────────────────────────────────

function KDKHeader({ k, t, farbe, nameFarbe, istFirma, editMode, dirty, gueltig = true,
  headerOhneEditBtn, objektFilter, onGotoKontakt, onEdit, onSave, onCancel, onDelete, onLoesen, onUpdate,
  edit, setEdit }) {
  const anzeige = useKontaktAnzeige();
  const alleKontakte = useAlleKontakte();
  const alleVes = useAlleVes();
  // Foto-Upload (nur Personen) — IMMER aktiv:
  //   · im Edit-Modus  → setzt edit.foto (Speichern/Abbrechen-Workflow)
  //   · im View-Modus  → speichert direkt über onUpdate(k.foto)
  const fotoFileRef = useRef(null);
  const aktFoto = (editMode && edit) ? edit.foto : k.foto;
  const fotoEditierbar = !istFirma && !k.anonymisiert && (editMode ? !!setEdit : !!onUpdate);
  const handleFotoWaehlen = (file) => {
    dateiZuFotoDataUrl(file, (url) => {
      if (!url) return;
      if (editMode && setEdit) {
        setEdit(e => ({ ...e, foto: url }));
      } else if (onUpdate) {
        onUpdate({ ...k, foto: url });
      }
    });
  };
  const handleFotoEntfernen = () => {
    if (editMode && setEdit) {
      setEdit(e => ({ ...e, foto: "" }));
    } else if (onUpdate) {
      onUpdate({ ...k, foto: "" });
    }
  };
  return (
    <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:12, flexWrap:"wrap" }}>
      {!istFirma && (
        <div style={{ position:"relative", flexShrink:0 }}>
          <Avatar name={k.name} firma={false} size={44} accent={farbe} foto={aktFoto}
            zuweisungen={zuweisungenFuerAvatar(k, undefined, alleKontakte, alleVes)}/>
          {fotoEditierbar && (
            <input ref={fotoFileRef} type="file" accept="image/*"
              style={{ display:"none" }}
              onChange={(e) => {
                const f = e.target.files && e.target.files[0];
                if (f) handleFotoWaehlen(f);
                e.target.value = "";
              }}/>
          )}
        </div>
      )}
      <div style={{ flex:1, minWidth:0, fontSize: FS.icon, fontWeight: FW.heavy, color:nameFarbe,
        textDecoration:istFirma?"underline":"none", textDecorationColor:nameFarbe,
        textDecorationThickness:2.5, textUnderlineOffset:4,
        overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
        {formatNameMitCtx(k, anzeige) || k.name || "—"}
      </div>
      {editMode && fotoEditierbar && (
        <div style={{ display:"flex", alignItems:"center", gap:4, flexShrink:0 }}>
          <button onClick={() => fotoFileRef.current && fotoFileRef.current.click()}
            title={aktFoto ? "Profilfoto ändern" : "Profilfoto hinzufügen"}
            style={{ display:"inline-flex", alignItems:"center", gap:4,
              fontSize: FS.s, fontWeight: FW.medium, fontFamily:"inherit",
              padding:"4px 9px", borderRadius: RAD.sm, cursor:"pointer",
              background:farbe+"15", color:farbe, border:`1px solid ${farbe}40` }}>
            <I name={aktFoto ? "pencil" : "plus"} size={11} color={farbe}/>
            Foto
          </button>
          {aktFoto && (
            <button onClick={handleFotoEntfernen} title="Profilfoto entfernen"
              style={{ display:"inline-flex", alignItems:"center", gap:4,
                fontSize: FS.s, fontWeight: FW.medium, fontFamily:"inherit",
                padding:"4px 9px", borderRadius: RAD.sm, cursor:"pointer",
                background:"#EF444415", color:"#EF4444", border:`1px solid #EF444440` }}>
              <I name="trash" size={11} color={"#EF4444"}/>
              Foto
            </button>
          )}
        </div>
      )}
      <div style={{ display:"flex", alignItems:"center", gap:6, marginLeft:"auto", flexShrink:0 }}>
      {!headerOhneEditBtn && (!editMode ? (
        <button onClick={onEdit} title="Bearbeiten"
          style={{ display:"flex", alignItems:"center", justifyContent:"center",
            width:36, height:36, flexShrink:0, background:farbe, border:"none",
            borderRadius: RAD.pill, cursor:"pointer", boxShadow:`0 1px 2px ${farbe}40` }}>
          <I name="pencil" size={14} color={getContrastColor(farbe)}/>
        </button>
      ) : (
        <div style={{ display:"flex", gap:6, alignItems:"center", flexShrink:0 }}>
          <AktionsButton rolle="abbrechen" onClick={onCancel} title="Verwerfen"
            farbe={farbe} t={t} accent={farbe}/>
          <AktionsButton rolle="bestaetigen" onClick={onSave} disabled={!gueltig}
            farbe={farbe} title={gueltig ? "Speichern" : "Bitte ungültige Felder korrigieren"} t={t} accent={farbe}/>
        </div>
      ))}
      </div>
    </div>
  );
}

function KDKStammdatenBlock({ edit, setEdit, t, farbe, editMode, istFirma }) {
  const farben = useKontaktFarbe();
  return (
    <div>
      <div style={{ fontSize: FS.s, fontWeight: FW.bold, color:t.sub,
        textTransform:"uppercase", letterSpacing:"0.1em", marginBottom:6 }}>Stammdaten</div>
      {editMode ? (
        istFirma
          ? <FirmaStammdatenEditor edit={edit} setEdit={setEdit} t={t} accent={farbe}/>
          : <StammdatenEditor edit={edit} setEdit={setEdit} t={t} accent={farbe}/>
      ) : (
        <div>
          {istFirma ? (
            <>
              {edit.rechtsform && <div style={{ fontSize: FS.m, color:t.sub, padding:"2px 0" }}>🏢 {edit.rechtsform}</div>}
              {edit.sub && <div style={{ fontSize: FS.m, color:t.sub, padding:"2px 0" }}>🏷 {edit.sub}</div>}
              {edit.tel    && <div style={{ fontSize: FS.m, color:t.sub, padding:"2px 0" }}>📞 {edit.tel}</div>}
              {edit.email  && <div style={{ fontSize: FS.m, color:t.sub, padding:"2px 0" }}>✉ {edit.email}</div>}
              {edit.homepage && <div style={{ fontSize: FS.m, color:t.sub, padding:"2px 0" }}>🌐 {edit.homepage}</div>}
              {edit.strasse && <div style={{ fontSize: FS.m, color:t.sub, padding:"2px 0" }}>🏠 {edit.strasse}, {joinPlzOrt(edit.plz, edit.ort) || edit.plzOrt}</div>}
              {(edit.gewerke||[]).length > 0 && (
                <div style={{ display:"flex", gap:4, flexWrap:"wrap", marginTop:4 }}>
                  {edit.gewerke.map((g,i) => (
                    <span key={i} style={{ fontSize: FS.xs, padding:"2px 7px", borderRadius: RAD.ml,
                      background:farben.firma+"20", color:farben.firma, fontWeight: FW.semi }}>{g}</span>
                  ))}
                </div>
              )}
            </>
          ) : (
            <>
              {(edit.anrede || edit.titel) && (
                <div style={{ fontSize: FS.m, color:t.sub, padding:"2px 0" }}>👤 {[edit.anrede, edit.titel].filter(Boolean).join(" ")}</div>
              )}
              {(edit.tels||[]).map((tel,i) => (
                <div key={i} style={{ fontSize: FS.m, color:t.sub, padding:"2px 0" }}>
                  📞 {tel.nr}{(tel.type || tel.typ) ? <span style={{ fontSize: FS.xs, color:t.muted }}> ({tel.type || tel.typ})</span> : null}{tel.favorit ? <span style={{ color: "#F59E0B", marginLeft: 4 }}>★</span> : null}
                </div>
              ))}
              {(edit.emails||[]).map((em,i) => (
                <div key={i} style={{ fontSize: FS.m, color:t.sub, padding:"2px 0" }}>✉ {em.email}{(em.type || em.typ) ? <span style={{ fontSize: FS.xs, color:t.muted }}> ({em.type || em.typ})</span> : null}{em.favorit ? <span style={{ color: "#F59E0B", marginLeft: 4 }}>★</span> : null}</div>
              ))}
              {edit.strasse && <div style={{ fontSize: FS.m, color:t.sub, padding:"2px 0" }}>🏠 {edit.strasse}, {joinPlzOrt(edit.plz, edit.ort) || edit.plzOrt}{(edit.adresseFavorit || edit.strasseFavorit || edit.plzOrtFavorit) ? <span style={{ color: "#F59E0B", marginLeft: 4 }}>★</span> : null}</div>}
              {(edit.geburtstag || edit.geburtsdatum) && (
                <div style={{ fontSize: FS.m, color:t.sub, padding:"2px 0" }}>🎂 {edit.geburtstag || edit.geburtsdatum}</div>
              )}
              <div style={{ display: "flex", alignItems: "center", gap: 5, marginTop: 7 }}>
                <span style={{ fontSize: FS.s, color: "#F59E0B", lineHeight: 1 }}>★</span>
                <span style={{ fontSize: FS.xs, color: t.muted }}>
                  Mit Stern markierte Angaben sind zur Weitergabe freigegeben.
                </span>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

function KDKMitarbeiterSektion({ firma, t, farbe, editMode, kontakte, setKontakte,
  onKontaktClick,
  addMitarbeiterOffen, setAddMitarbeiterOffen }) {
  const mitarbeiter = getFirmaMitarbeiter(firma.id, kontakte);
  const [offeneIds, setOffeneIds] = useState(() => new Set());
  const toggleOffen = (id) => setOffeneIds(prev => {
    const next = new Set(prev); if (next.has(id)) next.delete(id); else next.add(id); return next;
  });
  // Bestätigung pro Person: "loesen" (Verknüpfung) oder "loeschen" (komplett)
  const [confirmId, setConfirmId] = useState(null);
  const [confirmArt, setConfirmArt] = useState(null);
  useEffect(() => {
    if (confirmId === null) return;
    const tid = setTimeout(() => { setConfirmId(null); setConfirmArt(null); }, 4000);
    return () => clearTimeout(tid);
  }, [confirmId, confirmArt]);
  const frageBestaetigung = (id, art) => {
    if (confirmId === id && confirmArt === art) {
      if (art === "loesen") {
        // Nur die Firmen-Verknüpfung der Person entfernen — Person bleibt.
        setKontakte(prev => prev.map(p => {
          if (p.id !== id) return p;
          return { ...p, firmaId: null,
            objektZuweisungen: (p.objektZuweisungen||[]).filter(z => !(z.firmaId===firma.id && !z.objektId)),
            firmenRollen: (p.firmenRollen||[]).filter(f => f.firmaId !== firma.id) };
        }));
      } else {
        // Person komplett aus AllesDa entfernen.
        setKontakte(prev => prev.filter(p => p.id !== id));
      }
      setConfirmId(null); setConfirmArt(null);
    } else {
      setConfirmId(id); setConfirmArt(art);
    }
  };
  const handleAdd = (daten) => {
    if (daten.typ === "neu") {
      const maxId = kontakte.reduce((m,x) => x.id > m ? x.id : m, 0);
      const name = [daten.person.vorname, daten.person.nachname].filter(Boolean).join(" ") || "(ohne Name)";
      setKontakte(prev => [...prev, { id: maxId+1, typ:"person", vorname:daten.person.vorname,
        nachname:daten.person.nachname, name, tels:daten.person.tels||[], emails:daten.person.emails||[],
        firmaId:firma.id, rollen:[], objektZuweisungen:[{ firmaId:firma.id, rolle:daten.rolle, status:daten.status }] }]);
    } else {
      setKontakte(prev => prev.map(p => {
        if (p.id !== daten.kontaktId) return p;
        const ohneAlt = (p.objektZuweisungen||[]).filter(z => !(z.firmaId && !z.objektId && z.firmaId !== firma.id));
        return { ...p, firmaId:firma.id, objektZuweisungen:[...ohneAlt, { firmaId:firma.id, rolle:daten.rolle, status:daten.status }] };
      }));
    }
    setAddMitarbeiterOffen(false);
  };
  return (
    <div style={{ marginTop:10, paddingTop:10, borderTop:`1px solid ${t.border}40` }}>
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:6 }}>
        <div style={{ fontSize: FS.s, fontWeight: FW.bold, color:t.sub, textTransform:"uppercase", letterSpacing:"0.1em" }}>
          Mitarbeiter ({mitarbeiter.length})
        </div>
        {editMode && (
          <button onClick={() => setAddMitarbeiterOffen(true)}
            style={{ fontSize: FS.s, padding:"3px 10px", background:farbe+"20", color:farbe,
              border:"none", borderRadius: RAD.sm, cursor:"pointer", fontFamily:"inherit", fontWeight: FW.medium }}>
            + Person hinzufügen
          </button>
        )}
      </div>
      {mitarbeiter.length === 0 ? (
        <div style={{ fontSize: FS.s, color:t.muted, fontStyle:"italic", padding:"6px 0" }}>Noch keine Mitarbeiter.</div>
      ) : (
        <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
          {mitarbeiter.map(m => {
            const p = m.person;
            const offen = offeneIds.has(p.id);
            const tels = (p.tels || []).filter(x => x && x.nr);
            const emails = (p.emails || []).filter(x => x && x.email);
            const adresse = [p.strasse, joinPlzOrt(p.plz, p.ort) || p.plzOrt].filter(Boolean).join(", ");
            return (
              <div key={p.id} style={{ display:"flex", alignItems:"stretch", gap:6 }}>
                <div style={{ flex:1, minWidth:0,
                  border: offen ? `1px solid ${farbe}` : "none",
                  borderRadius: offen ? RAD.lg : 0,
                  overflow: offen ? "hidden" : "visible",
                  transition:"all 0.15s" }}>
                  <KontaktKarte k={p} t={t} aktiv={offen} ohneRahmen={offen} onClick={() => toggleOffen(p.id)}/>
                  {offen && (
                    <div style={{ padding:"0 12px 10px 12px", background:t.surface }}>
                      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit, minmax(140px, 1fr))", gap:10 }}>
                        {m.rolle && (
                          <div>
                            <div style={{ fontSize: FS.xs, color:t.muted, fontWeight: FW.medium, textTransform:"uppercase", letterSpacing:"0.05em", marginBottom:2 }}>Rolle in Firma</div>
                            <div style={{ fontSize: FS.m, color:t.text }}>{m.rolle}{m.status && m.status!=="aktiv" ? ` · ${m.status}` : ""}</div>
                          </div>
                        )}
                        {tels.map((tt,i) => (
                          <div key={"t"+i}>
                            <div style={{ fontSize: FS.xs, color:t.muted, fontWeight: FW.medium, textTransform:"uppercase", letterSpacing:"0.05em", marginBottom:2 }}>{tt.typ || "Telefon"}</div>
                            <div style={{ fontSize: FS.m, color:t.text }}>{tt.nr}</div>
                          </div>
                        ))}
                        {emails.map((ee,i) => (
                          <div key={"e"+i}>
                            <div style={{ fontSize: FS.xs, color:t.muted, fontWeight: FW.medium, textTransform:"uppercase", letterSpacing:"0.05em", marginBottom:2 }}>{ee.typ || "E-Mail"}</div>
                            <div style={{ fontSize: FS.m, color:t.text, overflow:"hidden", textOverflow:"ellipsis" }}>{ee.email}</div>
                          </div>
                        ))}
                        {adresse && (
                          <div>
                            <div style={{ fontSize: FS.xs, color:t.muted, fontWeight: FW.medium, textTransform:"uppercase", letterSpacing:"0.05em", marginBottom:2 }}>Adresse</div>
                            <div style={{ fontSize: FS.m, color:t.text }}>{adresse}</div>
                          </div>
                        )}
                      </div>
                      {/* Eigene Felder — nur Anzeige (Bearbeitung nur im Kontakt selbst) */}
                      {p.customFelder && p.customFelder.length > 0 && (
                        <div style={{ marginTop:10 }}>
                          <CustomFelderSektion
                            felder={p.customFelder}
                            onChange={() => {}}
                            editMode={false} t={t} accent={farbe} embedded/>
                        </div>
                      )}
                      {/* Notizen — immer editierbar (außer anonymisiert §26.5) */}
                      {!p.anonymisiert && (
                      <div style={{ marginTop:10 }}>
                        <NotizenSektion
                          wert={p.notizen || ""}
                          onChange={neu => setKontakte(prev => prev.map(x => x.id===p.id ? {...x, notizen:neu} : x))}
                          t={t} accent={farbe} embedded/>
                      </div>
                      )}
                      <div style={{ marginTop:10, display:"flex", justifyContent:"flex-end" }}>
                        {onKontaktClick && (
                          <button onClick={(e) => { e.stopPropagation(); onKontaktClick(p.id); }}
                            style={{ fontSize: FS.s, padding:"5px 12px", background:farbe+"18",
                              color:farbe, border:`1px solid ${farbe}40`, borderRadius: RAD.sm,
                              cursor:"pointer", fontWeight: FW.medium, fontFamily:"inherit",
                              display:"inline-flex", alignItems:"center", gap:5 }}>
                            Zum Kontakt
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
                {editMode && (
                  <ZeilenAktionen t={t}
                    onLoesen={() => frageBestaetigung(p.id, "loesen")}
                    onLoeschen={(dsgvoEinstufung(p) === "rot" || p.anonymisiert) ? null : () => frageBestaetigung(p.id, "loeschen")}
                    confirmLoesen={confirmId===p.id && confirmArt==="loesen"}
                    confirmLoeschen={confirmId===p.id && confirmArt==="loeschen"}
                    loesenTitle="Verknüpfung zur Firma lösen (Kontakt bleibt bestehen)"
                    loeschenTitle="Kontakt löschen (alle Daten werden gelöscht)"/>
                )}
              </div>
            );
          })}
        </div>
      )}
      {addMitarbeiterOffen && (
        <AddMitarbeiterModal firma={firma} kontakte={kontakte} t={t} accent={farbe}
          onClose={() => setAddMitarbeiterOffen(false)} onSave={handleAdd}/>
      )}
    </div>
  );
}

function KDKVererbungSektion({ k, t, ves, kontakte, onVEClick }) {
  const PRIO = { aktiv:3, werdend:2, ehemalig:1 };
  const labelOf = n => n===3?"aktiv":n===2?"werdend":"ehemalig";
  const colorOf = n => n===3?"#22C55E":n===2?"#F59E0B":"#94A3B8";
  const [offenIdx, setOffenIdx] = useState(() => new Set());
  const toggle = (i) => setOffenIdx(prev => {
    const next = new Set(prev); if (next.has(i)) next.delete(i); else next.add(i); return next;
  });
  const firmenSlots = (k.objektZuweisungen||[]).filter(z => z.firmaId);
  if (firmenSlots.length === 0) return null;
  const abgeleitet = [];
  firmenSlots.forEach(z => {
    const firma = (kontakte||[]).find(c => c.id===z.firmaId);
    if (!firma) return;
    const personStatusN = PRIO[z.status||"aktiv"];
    (firma.objektZuweisungen||[]).forEach(fz => {
      const minN = Math.min(personStatusN, PRIO[fz.status||"aktiv"]);
      const ve = (ves||[]).find(x => x.id===fz.objektId);
      if (!ve) return;
      abgeleitet.push({ firma, ve, firmaRolle:fz.rolle, status:labelOf(minN), statusN:minN });
    });
  });
  if (abgeleitet.length === 0) return null;
  return (
    <div style={{ marginTop:10, paddingTop:10, borderTop:`1px solid ${t.border}40` }}>
      <div style={{ fontSize: FS.xs, fontWeight: FW.bold, color:t.muted, textTransform:"uppercase",
        letterSpacing:"0.1em", marginBottom:6 }}>Abgeleitet über Firma</div>
      {abgeleitet.map((a,i) => {
        const offen = offenIdx.has(i);
        return (
          <div key={i} style={{ background:offen ? t.card : t.surface,
            border:`1px solid ${offen ? a.firma && t.border : t.border}`,
            borderRadius: RAD.ms, marginBottom:4, overflow:"hidden", transition:"all 0.15s" }}>
            {/* Header: klickbar zum Aufklappen (bleibt im Kontakt) */}
            <div onClick={() => toggle(i)} style={{ cursor:"pointer",
              padding:"6px 10px", display:"flex", alignItems:"center", gap:8 }}>
              <div style={{ flex:1, minWidth:0, display:"flex", flexDirection:"column", gap:1 }}>
                <span style={{ fontSize: FS.m, fontWeight: FW.medium, color:t.text }}>{a.ve.nr} · {a.firmaRolle}</span>
                <span style={{ fontSize: FS.xs, color:t.muted }}>über {a.firma.name}</span>
              </div>
              <span style={{ fontSize: FS.xxs, padding:"2px 7px", borderRadius: RAD.ml,
                background:colorOf(a.statusN)+"22", color:colorOf(a.statusN), fontWeight: FW.medium }}>{a.status}</span>
            </div>
            {/* Body: mehr Info + expliziter Zum-Objekt-Button */}
            {offen && (
              <div style={{ padding:"8px 10px", borderTop:`1px solid ${t.border}` }}>
                <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit, minmax(120px, 1fr))", gap:8 }}>
                  <div>
                    <div style={{ fontSize: FS.xs, color:t.muted, fontWeight: FW.medium, textTransform:"uppercase", letterSpacing:"0.05em", marginBottom:2 }}>Objekt</div>
                    <div style={{ fontSize: FS.m, color:t.text }}>{a.ve.nr}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: FS.xs, color:t.muted, fontWeight: FW.medium, textTransform:"uppercase", letterSpacing:"0.05em", marginBottom:2 }}>Adresse</div>
                    <div style={{ fontSize: FS.m, color:t.text }}>{a.ve.adresse || "—"}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: FS.xs, color:t.muted, fontWeight: FW.medium, textTransform:"uppercase", letterSpacing:"0.05em", marginBottom:2 }}>Über Firma</div>
                    <div style={{ fontSize: FS.m, color:t.text }}>{a.firma.name}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: FS.xs, color:t.muted, fontWeight: FW.medium, textTransform:"uppercase", letterSpacing:"0.05em", marginBottom:2 }}>Leistung</div>
                    <div style={{ fontSize: FS.m, color:t.text }}>{a.firmaRolle}</div>
                  </div>
                </div>
                {onVEClick && (
                  <div style={{ marginTop:8, display:"flex", justifyContent:"flex-end" }}>
                    <button onClick={(e) => { e.stopPropagation(); onVEClick(a.ve.id); }}
                      style={{ fontSize: FS.s, padding:"5px 12px", background:t.muted+"18",
                        color:t.text, border:`1px solid ${t.border}`, borderRadius: RAD.sm,
                        cursor:"pointer", fontWeight: FW.medium, fontFamily:"inherit",
                        display:"inline-flex", alignItems:"center", gap:5 }}>
                      Zum Objekt
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── KontaktDetailKarte (aufgeklappte Detail-Karte mit Edit-Modus) ───────────
// Funktioniert für Personen UND Firmen. Bei Firmen werden die Stammdaten anders
// editiert (Firmenname statt Vor-/Nachname) und es werden Firmen-Rollen
// (Hausverwaltung, Hausmeister, Wartung …) statt Personen-Rollen angeboten.
// Eingebettete Detail-Karte des vertretenen Kontakts (Quelle "vertretung-ein").
function VertretungDetail({ z, ves, kontakte, setKontakte, onKontaktClick, t, zAkzent }) {
  const zielK = (kontakte || []).find(c => String(c.id) === String(z.zielKontaktId));
  if (!zielK) return (
    <div style={{ padding: "10px 12px", fontSize: FS.s, color: t.muted }}>Verknüpfter Kontakt nicht gefunden.</div>
  );
  return (
    <div style={{ padding: "0 10px 10px 10px" }}>
      <KontaktDetailKarte k={zielK} t={t} accent={zAkzent}
        ves={ves || []} kontakte={kontakte} setKontakte={setKontakte}
        onUpdate={(updated) => setKontakte && setKontakte(prev =>
          prev.map(c => c.id === zielK.id ? updated : c))}
        onGotoKontakt={(id) => onKontaktClick && onKontaktClick(id)}
        onKontaktClick={onKontaktClick}
        embedded/>
    </div>
  );
}

function KontaktDetailKarte({ k, t, accent, ves, kontakte, onVEClick, onUpdate, onDelete, onLoesen = null, onKontaktClick, setKontakte, objektFilter = null, onGotoKontakt = null, kategorieFarbe = null,
  externEditMode, setExternEditMode, headerOhneEditBtn: headerOhneEditBtnProp = false, listenModus = false, ohneObjekte: ohneObjekteProp = false, onKopfClick = null, zeigeGotoFooter: zeigeGotoFooterProp = false, nurStammdaten = false, embedded = false, extraFooter = null }) {
  // VEREINHEITLICHTE EINBETTUNG: Eine einzige Prop `embedded` steuert das
  // gesamte „eingebettete" Verhalten, damit neue Einbettungsstellen nicht mehr
  // jede Flag-Kombination einzeln setzen müssen:
  //   · kein Header-Edit-Button (read-only; bearbeitet wird nur die Hauptkarte)
  //   · Footer-„Zum Kontakt/Firma"-Button (statt Header-Button, der den Avatar verdeckt)
  //   · Verknüpfungs-Sektionen aus (fremde Objekte/Rollen, Vollmacht, Vererbung)
  //     — AUSSER im Objekt-Kontext (objektFilter), wo die objektbezogene Rolle
  //     bewusst sichtbar bleibt.
  //   · Firmen behalten ihre Mitarbeiter (hängt an istFirma && setKontakte).
  // Die Einzel-Props bleiben als Override bestehen (Rückwärtskompatibilität).
  // ANONYMISIERT (§26.5): Karte ist komplett schreibgeschützt — editMode wird
  // hart auf false gezwungen (egal ob intern oder extern gesteuert) und der
  // Header-Stift verschwindet. MUSS vor headerOhneEditBtn stehen (TDZ).
  const gesperrt = !!(k && k.anonymisiert);
  const headerOhneEditBtn = headerOhneEditBtnProp || embedded || gesperrt;
  const ohneObjekte        = ohneObjekteProp || (embedded && !objektFilter);
  const zeigeGotoFooter    = zeigeGotoFooterProp || (embedded && !!onGotoKontakt);
  const personenRollen = useRollen();
  const firmenRollen = useFirmenRollen();
  const kdkLeistungen = useLeistungen();
  const [internEditMode, setInternEditMode] = useState(false);
  // Wenn von außen kontrolliert (Mobile: Bearbeiten-Toggle sitzt im
  // Sticky-Header), nutzen wir externEditMode; sonst eigenen State.
  const editMode    = gesperrt ? false : ((typeof externEditMode === "boolean") ? externEditMode : internEditMode);
  const setEditMode = setExternEditMode ? setExternEditMode : setInternEditMode;
  const [edit, setEdit] = useState(k);
  const [neueRolleForm, setNeueRolleForm] = useState(false);
  const [neueVollmachtForm, setNeueVollmachtForm] = useState(false);
  const [editRolleIdx, setEditRolleIdx] = useState(null);
  // Welche Rollen-Zuweisung ist aufgeklappt (Index in zuweisungen)
  // Welche Rollen sind aufgeklappt — als Set, damit MEHRERE gleichzeitig
  // offen sein können (Benny will Eigentümer + VB + ... parallel sehen).
  const [expandedRolleIdx, setExpandedRolleIdx] = useState(() => new Set());
  const toggleRolleIdx = (i) => {
    setExpandedRolleIdx(prev => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i); else next.add(i);
      return next;
    });
  };
  // Modal: Mitarbeiter hinzufügen (nur bei Firmen)
  const [addMitarbeiterOffen, setAddMitarbeiterOffen] = useState(false);
  // Eigener Workflow für "Objekt zuweisen" in der Objekte-Sektion
  const [objektZuweisungForm, setObjektZuweisungForm] = useState(false);
  // Welche Objekt-/Einheit-Karte ist ausgeklappt (Key = "veId::einheitId" oder "veId::")
  // Welche Objekt-/Einheit-Karten sind aufgeklappt — auch als Set für
  // Mehrfach-Auswahl (Key = "veId::einheitId" oder "veId::")
  const [expandedKey, setExpandedKey] = useState(() => new Set());
  const toggleKey = (key) => {
    setExpandedKey(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  };
  // Aufgeklappte Mitarbeiter (bei Firmen). Set für Multi-Aufklappen.
  // Bewusst kein Auto-Scroll beim Aufklappen von Rolle/Einheit — der
  // geklickte Eintrag bleibt an seiner Stelle, aufgeklappte Inhalte
  // erscheinen darunter.

  useEffect(() => {
    setEdit(k);
    setEditMode(false);
    setNeueRolleForm(false);
    setEditRolleIdx(null);
    setObjektZuweisungForm(false);
    // Sets bei Kontakt-Wechsel leeren (NICHT auf null setzen — sind Sets!)
    setExpandedKey(new Set());
    setExpandedRolleIdx(new Set());
  }, [k.id]);

  if (!k) return null;
  const istFirma = k.typ === "firma";
  const rolleTyp = istFirma ? "firma" : "person";
  const loeschenErlaubt = useLoeschenErlaubt();
  const kontaktFarben = useKontaktFarbe();
  // Im Objekt-Kontext (objektFilter aktiv) nutzen wir den Objekt-Akzent (cyan)
  // als Karten-Farbe für Border/Background/Edit-Button — passt zum
  // Objekt-Kontext. Im normalen Kontakt-Screen die Personen/Firmen-Farbe.
  const farbe = objektFilter ? accent : (istFirma ? kontaktFarben.firma : kontaktFarben.person);
  // Name-Farbe: im Objekt-Kontext die Kategorie-Farbe (z. B. pink für Eigentümer).
  // Sonst die Karten-Farbe.
  const nameFarbe = kategorieFarbe || farbe;

  // Verträge dieser Firma — über alle Objekte hinweg eingesammelt. Verträge
  // liegen am Objekt (ve.vertraege) und verweisen per firmaId auf die Firma;
  // hier drehen wir die Sicht um (Firma → ihre Verträge je Objekt). Nur für
  // Firmen und nur außerhalb des Objekt-Kontexts (im Objekt zeigt die
  // Liegenschaft ihre Verträge ohnehin selbst).
  const firmenVertraege = (istFirma && !objektFilter)
    ? (ves || []).flatMap(v =>
        ((v.karten || []).concat(v.verwaltungsKarten || [])
          .flatMap(ka => (ka.vertraege || []))
          .concat(v.vertraege || []))
          .filter(vt => vt && vt.firmaId != null && String(vt.firmaId) === String(k.id))
          .map(vt => ({ vertrag: vt, ve: v })))
    : [];

  // Schreib-Handler (1c): flache Editor-Einträge in die drei neuen Felder
  // einsortieren. Da die alten Editoren weiter flache {rolle,status,objektId,…}
  // liefern, nutzt klassifiziereZuweisung dieselbe Logik wie die Migration.
  const schreibeNeu = (besitz, zustaendigkeiten, firmenRollen) => {
    setEdit({ ...edit, besitz, zustaendigkeiten, firmenRollen });
  };
  const neueListen = () => ({
    besitz: [...(Array.isArray(edit.besitz) ? edit.besitz : [])],
    zustaendigkeiten: [...(Array.isArray(edit.zustaendigkeiten) ? edit.zustaendigkeiten : [])],
    firmenRollen: [...(Array.isArray(edit.firmenRollen) ? edit.firmenRollen : [])],
  });
  const einsortieren = (listen, zuw, vorne) => {
    const c = klassifiziereZuweisung(zuw, edit.typ);
    if (!c) return listen;
    // Neue Einträge oben (unshift); bearbeitete hinten anhängen (push).
    const ziel = c.kat === "besitz" ? listen.besitz
      : c.kat === "zustaendigkeit" ? listen.zustaendigkeiten
      : c.kat === "firmenrolle" ? listen.firmenRollen : null;
    if (ziel) { if (vorne) ziel.unshift(c.eintrag); else ziel.push(c.eintrag); }
    return listen;
  };
  const addRolle = (zuw) => {
    // Race-sicher: funktionales Update, damit mehrere synchrone Aufrufe
    // (z. B. eine Beziehung über mehrere Einheiten) sich akkumulieren statt
    // sich gegenseitig zu überschreiben.
    setEdit(prev => {
      const listen = {
        besitz: [...(Array.isArray(prev.besitz) ? prev.besitz : [])],
        zustaendigkeiten: [...(Array.isArray(prev.zustaendigkeiten) ? prev.zustaendigkeiten : [])],
        firmenRollen: [...(Array.isArray(prev.firmenRollen) ? prev.firmenRollen : [])],
      };
      const c = klassifiziereZuweisung(zuw, prev.typ);
      if (c) {
        const ziel = c.kat === "besitz" ? listen.besitz
          : c.kat === "zustaendigkeit" ? listen.zustaendigkeiten
          : c.kat === "firmenrolle" ? listen.firmenRollen : null;
        if (ziel) ziel.unshift(c.eintrag);
      }
      return { ...prev, besitz: listen.besitz, zustaendigkeiten: listen.zustaendigkeiten, firmenRollen: listen.firmenRollen };
    });
    setNeueRolleForm(false);
    // Die neue Zuweisung wird per unshift OBEN eingefügt (Index 0). Nach dem
    // Re-Render dorthin scrollen, damit der „Screen nicht stehen bleibt" und der
    // Nutzer den frisch angelegten Eintrag sieht. scrollIntoView funktioniert
    // layout-unabhängig (Window-Scroll auf Mobile, interner Container auf Desktop);
    // block:"nearest" springt nur, wenn die Zeile nicht ohnehin sichtbar ist.
    if (typeof document !== "undefined") {
      setTimeout(() => {
        const el = document.getElementById("rolle-" + k.id + "-0");
        if (el && el.scrollIntoView) el.scrollIntoView({ block: "nearest", behavior: "smooth" });
      }, 60);
    }
  };
  // updateRolle/removeRolle adressieren einen flachen Eintrag direkt über sein
  // _quelle/_idx (unabhängig vom Listen-Index, der bei Objekt-Filterung abweicht).
  const updateRolle = (ziel, zuw) => {
    const l = neueListen();
    if (ziel && ziel._quelle === "besitz") l.besitz.splice(ziel._idx, 1);
    else if (ziel && ziel._quelle === "zustaendigkeit") l.zustaendigkeiten.splice(ziel._idx, 1);
    else if (ziel && ziel._quelle === "firmenrolle") l.firmenRollen.splice(ziel._idx, 1);
    einsortieren(l, zuw);
    schreibeNeu(l.besitz, l.zustaendigkeiten, l.firmenRollen);
    setEditRolleIdx(null);
  };
  const removeRolle = (ziel) => {
    const l = neueListen();
    if (ziel && ziel._quelle === "besitz") l.besitz.splice(ziel._idx, 1);
    else if (ziel && ziel._quelle === "zustaendigkeit") l.zustaendigkeiten.splice(ziel._idx, 1);
    else if (ziel && ziel._quelle === "firmenrolle") l.firmenRollen.splice(ziel._idx, 1);
    schreibeNeu(l.besitz, l.zustaendigkeiten, l.firmenRollen);
  };
  // Patch (Status/Datum) auf mehrere flache Einträge (über _quelle/_idx) anwenden.
  const patchFlache = (flatIdxList, patch) => {
    const l = neueListen();
    flatIdxList.forEach(fi => {
      const z = alleZuweisungen[fi];
      if (!z) return;
      if (z._quelle === "besitz" && l.besitz[z._idx])
        l.besitz[z._idx] = { ...l.besitz[z._idx], ...patch };
      else if (z._quelle === "zustaendigkeit" && l.zustaendigkeiten[z._idx])
        l.zustaendigkeiten[z._idx] = { ...l.zustaendigkeiten[z._idx], ...patch };
      else if (z._quelle === "firmenrolle" && l.firmenRollen[z._idx])
        l.firmenRollen[z._idx] = { ...l.firmenRollen[z._idx], ...patch };
    });
    schreibeNeu(l.besitz, l.zustaendigkeiten, l.firmenRollen);
  };
  // Mehrere flache Einträge (über _quelle/_idx) entfernen.
  const removeFlache = (flatIdxList) => {
    const l = neueListen();
    const drop = { besitz: new Set(), zustaendigkeit: new Set(), firmenrolle: new Set() };
    flatIdxList.forEach(fi => {
      const z = alleZuweisungen[fi];
      if (z && drop[z._quelle]) drop[z._quelle].add(z._idx);
    });
    l.besitz = l.besitz.filter((_, i) => !drop.besitz.has(i));
    l.zustaendigkeiten = l.zustaendigkeiten.filter((_, i) => !drop.zustaendigkeit.has(i));
    l.firmenRollen = l.firmenRollen.filter((_, i) => !drop.firmenrolle.has(i));
    schreibeNeu(l.besitz, l.zustaendigkeiten, l.firmenRollen);
  };

  const save = () => {
    // Validierung: ungültige Eingaben blockieren das Speichern (Felder sind
    // bereits rot markiert). Edit-Modus bleibt offen, damit der User korrigiert.
    if (!kontaktAllesGueltig(edit)) return;
    // Bei Personen: Name aus Vor-/Nachname zusammenbauen
    let finalEdit = edit;
    if (!istFirma) {
      const computed = `${edit.vorname || ""} ${edit.nachname || ""}`.trim();
      finalEdit = { ...edit, name: computed || edit.name || k.name };
    }
    onUpdate(finalEdit);
    setEditMode(false); setNeueRolleForm(false); setEditRolleIdx(null);
    setObjektZuweisungForm(false);
  };
  const cancel = () => {
    setEdit(k); setEditMode(false); setNeueRolleForm(false); setEditRolleIdx(null);
    setObjektZuweisungForm(false);
  };

  // Auto-Save bei extern gesteuertem editMode-off (Mobile Sticky-Header
  // Stift→Häkchen toggelt): Änderungen direkt persistieren statt verwerfen.
  const prevExternEdit = useRef(externEditMode);
  useEffect(() => {
    if (typeof externEditMode !== "boolean") return;
    if (prevExternEdit.current === true && externEditMode === false) {
      // editMode wurde extern abgeschaltet — speichern wenn dirty UND gültig.
      // Ungültige Eingaben werden nicht persistiert (rote Markierung bleibt).
      const dirtyNow = JSON.stringify(edit) !== JSON.stringify(k);
      if (dirtyNow && kontaktAllesGueltig(edit)) {
        let finalEdit = edit;
        if (!istFirma) {
          const computed = `${edit.vorname || ""} ${edit.nachname || ""}`.trim();
          finalEdit = { ...edit, name: computed || edit.name || k.name };
        }
        onUpdate(finalEdit);
      }
      setNeueRolleForm(false); setEditRolleIdx(null); setObjektZuweisungForm(false);
    }
    prevExternEdit.current = externEditMode;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [externEditMode]);

  const alleZuweisungenRoh = flacheZuweisungen(edit);
  // Vertretungs-Vermerke (kontakt-Ziel) des Kontakts selbst sind KEINE Rollen
  // dieses Kontakts — er ist VollmachtGEBER, nicht Bevollmächtigter. Sie werden
  // separat als Vermerk gezeigt (siehe "Hat Bevollmächtigten"-Sektion).
  const eigeneVertretungsVermerke = alleZuweisungenRoh.filter(z => z.zielKontaktId != null);
  const alleZuweisungen = alleZuweisungenRoh.filter(z => z.zielKontaktId == null);
  // Eingehende Vertretungen: dieser Kontakt IST anderswo als Bevollmächtigter/
  // Betreuer benannt → das ist eine echte Rolle von IHM. Als synthetische
  // Rollenzeilen (zielKontaktId = der Vertretene) in die Rollen-Liste einspeisen.
  // _quelle "vertretung-ein" markiert sie als abgeleitet (read-only, nicht editierbar).
  const eingehendeAlsRollen = (!objektFilter ? eingehendeVertretungen(k, kontakte) : [])
    .map(v => ({ rolle: v.rolle, status: v.status, zielKontaktId: v.quelle.id,
      _quelle: "vertretung-ein", _readonly: true }));
  // Belegungs-Rollen (Mieter/Bewohner/Pächter) LIVE aus den Belegungen ableiten —
  // Quelle der Wahrheit = Belegung-Tab, KEINE Doppelpflege in den Kontaktfeldern.
  // Read-only (Edit am Belegung-Tab). Dedup gegen bereits vorhandene editierbare
  // Zeilen (Altbestand-Workaround als zustaendigkeit): gleiche objektId+einheitId+
  // rolle → die editierbare Zeile behält Vorrang, die abgeleitete entfällt.
  const belegSchluessel = new Set();
  alleZuweisungen.forEach(z => {
    if (z.objektId != null && z.einheitId != null && z.rolle)
      belegSchluessel.add(z.objektId + "|" + z.einheitId + "|" + z.rolle);
  });
  const belegungsRollen = belegungsRollenFuerKontakt(k, ves)
    .filter(z => !belegSchluessel.has(z.objektId + "|" + z.einheitId + "|" + z.rolle));
  // Im Objekt-Kontext zeigen wir NUR die Zuweisungen, die zu diesem Objekt
  // gehören. Mitarbeiter, eigene Felder, Notizen, Stammdaten gehören zum
  // Kontakt selbst und werden unverändert gezeigt.
  const zuweisungen = objektFilter
    ? [...alleZuweisungen.filter(z => z.objektId === objektFilter),
       ...belegungsRollen.filter(z => z.objektId === objektFilter)]
    : [...alleZuweisungen, ...eingehendeAlsRollen, ...belegungsRollen];
  // Gruppierte Rollenkarten (verschmolzene Rollen+Objekte-Darstellung) für den
  // ANZEIGE-Modus. Slot/Sortierung kommt aus gruppiereRollenkarten; die
  // Rollendefs vereinen Personen-, Firmen- und Leistungs-Rollen (für den slot).
  const _alleRollenDefs = [...personenRollen, ...firmenRollen, ...kdkLeistungen];
  const rollenKarten = gruppiereRollenkarten(zuweisungen, _alleRollenDefs);
  // Objekt-Paare (Objekt + optional Einheit) aus den Zuweisungen ableiten —
  // für den Objekte-Block bei Personen ohne Objektfilter.
  const objektPaare = [];
  {
    const seenObj = new Set();
    (zuweisungen || []).forEach(z => {
      if (!z.objektId) return;
      if (seenObj.has(z.objektId)) {
        const vorh = objektPaare.find(p => p.objektId === z.objektId);
        if (vorh && !vorh.einheitId && z.einheitId) { vorh.einheitId = z.einheitId; vorh.key = `${z.objektId}::${z.einheitId}`; }
        return;
      }
      seenObj.add(z.objektId);
      objektPaare.push({ key: `${z.objektId}::${z.einheitId || ""}`, objektId: z.objektId, einheitId: z.einheitId || null });
    });
  }
  const dirty = JSON.stringify(edit) !== JSON.stringify(k);
  const gueltig = kontaktAllesGueltig(edit);
  // VE-Eintrag für Banner-Text
  const filterVE = objektFilter ? (ves || []).find(v => v.id === objektFilter) : null;

  const btnEdit = {
    display: "inline-flex", alignItems: "center", gap: 4,
    fontSize: FS.s, padding: "4px 10px", borderRadius: RAD.sm, cursor: "pointer",
    background: "transparent", border: `1px solid ${t.border}`,
    color: t.sub, fontFamily: "inherit",
  };
  const btnPrimary = {
    fontSize: FS.s, padding: "4px 12px", background: farbe, color: getContrastColor(farbe),
    border: "none", borderRadius: RAD.sm, cursor: "pointer", fontWeight: FW.medium, fontFamily: "inherit",
  };

  // Auswahl-Rahmen: in der Kontaktliste (listenModus) der Auswahl-Akzent —
  // Mehr-Farbe = Kontakt-Bereichsfarbe, Graumodus = System-Akzent. Profil,
  // eingebettete und Objekt-Kontext-Aufrufe ohne listenModus → farbe.
  const rahmen = listenModus ? (kontaktFarben.auswahlKontakt || farbe) : farbe;
  return (
    <div style={{ background: rahmen + "08", border: `1px solid ${rahmen}`,
      borderRadius: RAD.lg, padding: "12px 14px" }}>
      <div onClick={onKopfClick ? (e) => {
          // Nur einklappen, wenn nicht auf ein interaktives Element geklickt wurde.
          let n = e.target;
          while (n && n !== e.currentTarget) {
            const tag = (n.tagName || "").toLowerCase();
            if (tag === "a" || tag === "button" || tag === "input" ||
                tag === "textarea" || tag === "select") return;
            n = n.parentNode;
          }
          onKopfClick();
        } : undefined}
        style={onKopfClick ? { cursor: "pointer" } : undefined}>
        <KDKHeader k={k} t={t} farbe={farbe} nameFarbe={nameFarbe}
          istFirma={istFirma} editMode={editMode} dirty={dirty} gueltig={gueltig}
          headerOhneEditBtn={headerOhneEditBtn} objektFilter={objektFilter}
          onGotoKontakt={onGotoKontakt} onEdit={() => setEditMode(true)}
          onSave={save} onCancel={cancel}
          onDelete={onDelete} onUpdate={onUpdate}
          edit={edit} setEdit={setEdit}/>
        <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit, minmax(260px, 1fr))",
          gap:12, marginBottom:12 }}>
          <KDKStammdatenBlock edit={edit} setEdit={setEdit} t={t} farbe={farbe}
            editMode={editMode} istFirma={istFirma}/>
          <CustomFelderSektion
            felder={editMode ? (edit.customFelder||[]) : (k.customFelder||[])}
            onChange={neueFelder => {
              if (editMode) setEdit({...edit, customFelder:neueFelder});
              else onUpdate({...k, customFelder:neueFelder});
            }}
            editMode={editMode} t={t} accent={farbe} embedded/>
        </div>
      </div>
      <div style={{ marginBottom:12 }}>
        <NotizenSektion
          wert={editMode ? (edit.notizen||"") : (k.notizen||"")}
          onChange={neu => {
            if (editMode) setEdit({...edit, notizen:neu});
            else onUpdate({...k, notizen:neu});
          }}
          t={t} accent={farbe} embedded/>
      </div>
      {istFirma && setKontakte && (
        <KDKMitarbeiterSektion firma={k} t={t} farbe={farbe} editMode={editMode}
          kontakte={kontakte} setKontakte={setKontakte} onKontaktClick={onKontaktClick}
          addMitarbeiterOffen={addMitarbeiterOffen} setAddMitarbeiterOffen={setAddMitarbeiterOffen}/>
      )}
      {!ohneObjekte && (
      <div style={{ marginTop:10, paddingTop:10, borderTop:`1px solid ${t.border}40` }}>
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:6 }}>
          <div style={{ fontSize: FS.s, fontWeight: FW.bold, color:t.sub, textTransform:"uppercase", letterSpacing:"0.1em" }}>
            {(istFirma && editMode) ? `Objekte (${zuweisungen.length})` : `Rollen (${rollenKarten.length || zuweisungen.length})`}
          </div>
          {editMode && !neueRolleForm && editRolleIdx === null && (
            <button onClick={() => setNeueRolleForm(true)}
              style={{ fontSize: FS.s, padding:"3px 10px", background:farbe+"20", color:farbe,
                border:"none", borderRadius: RAD.sm, cursor:"pointer", fontFamily:"inherit", fontWeight: FW.medium, whiteSpace:"nowrap" }}>
              {istFirma ? "+ Objekt" : "+ Rolle"}
            </button>
          )}
        </div>
        {neueRolleForm && (
          <div style={{ marginBottom: 8 }}>
            <BeziehungEditor initial={{}} ves={ves} kontakte={kontakte} t={t} accent={farbe} typ={rolleTyp} lockObjektId={objektFilter} selbstId={k.id}
              onCancel={() => setNeueRolleForm(false)} onSave={addRolle}/>
          </div>
        )}
        {zuweisungen.length === 0 && !neueRolleForm && (
          <div style={{ fontSize: FS.s, color:t.muted, fontStyle:"italic", padding:"6px 0" }}>
            {istFirma ? "Keine Objekte zugewiesen." : "Keine Rollen zugewiesen."}
          </div>
        )}
        {zuweisungen.length > 0 && !editMode && (
          <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
            {rollenKarten.map((karte, ki) => (
              <RollenkarteBox key={ki} karte={karte} ves={ves} kontakte={kontakte}
                t={t} accent={farbe} onVEClick={onVEClick} onKontaktClick={onKontaktClick}
                kontaktId={k.id} aktuellesObjektId={objektFilter}/>
            ))}
          </div>
        )}
        {zuweisungen.length > 0 && editMode && (
          <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
            {zuweisungen.map((z,i) => {
              if (editRolleIdx === i) return (
                <div key={"e"+i}>
                  <BeziehungEditor initial={z} ves={ves} kontakte={kontakte} t={t} accent={farbe} typ={rolleTyp} lockObjektId={objektFilter} selbstId={k.id}
                    onCancel={() => setEditRolleIdx(null)} onSave={zuw => updateRolle(z, zuw)}/>
                </div>
              );
              const offen = expandedRolleIdx.has(i);
              const rolleDef = (rolleTyp==="firma" ? firmenRollen : personenRollen).find(r => r.name===z.rolle);
              const zAkzent = (rolleDef && rolleDef.color) || farbe;
              const zMitKontakt = { ...z, kontaktId:k.id };
              return (
                <div key={i} style={{ display:"flex", alignItems:"stretch", gap:6 }}>
                  <div style={{ flex:1, minWidth:0, background:offen?zAkzent+"08":t.card,
                    border:`1px solid ${offen?zAkzent:t.border}`, borderRadius: RAD.ml, overflow:"hidden", transition:"all 0.15s" }}>
                    <RolleZeile z={z} ves={ves} kontakte={kontakte} editMode={editMode}
                      t={t} accent={farbe} typ={rolleTyp} aktiv={offen} embedded
                      id={"rolle-"+k.id+"-"+i} onClick={() => toggleRolleIdx(i)}/>
                    {offen && (
                      <div>
                        {z._quelle === "vertretung-ein" ? (
                          <VertretungDetail z={z} ves={ves} kontakte={kontakte}
                            setKontakte={setKontakte} onKontaktClick={onKontaktClick} t={t} zAkzent={zAkzent}/>
                        ) : (
                          <RolleDetailBox z={zMitKontakt} ves={ves} kontakte={kontakte}
                            t={t} accent={zAkzent} typ={rolleTyp} embedded onVEClick={onVEClick} aktuellesObjektId={objektFilter}/>
                        )}
                      </div>
                    )}
                  </div>
                  {editMode && !z._readonly && (
                    <ZeilenAktionen t={t}
                      onEdit={() => setEditRolleIdx(i)}
                      onLoesen={() => removeRolle(z)}
                      loesenTitle="Rolle entfernen"/>
                  )}
                </div>
              );
            })}
          </div>
        )}
        {!objektFilter && !istFirma && editMode && !(objektPaare.length === 0 && !editMode) && (
            <div style={{ marginTop:10, paddingTop:10, borderTop:`1px solid ${t.border}40` }}>
              <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:6 }}>
                <div style={{ fontSize: FS.s, fontWeight: FW.bold, color:t.sub, textTransform:"uppercase", letterSpacing:"0.1em" }}>
                  Objekte ({objektPaare.length})
                </div>
                {editMode && !objektZuweisungForm && (
                  <button onClick={() => setObjektZuweisungForm(true)}
                    style={{ fontSize: FS.s, padding:"3px 10px", background:farbe+"20", color:farbe,
                      border:"none", borderRadius: RAD.sm, cursor:"pointer", fontFamily:"inherit", fontWeight: FW.medium, whiteSpace:"nowrap" }}>
                    + Objekt
                  </button>
                )}
              </div>
              {objektZuweisungForm && (
                <div style={{ marginBottom: 8 }}>
                  <BeziehungEditor initial={{}} ves={ves} kontakte={kontakte} t={t} accent={farbe} typ={rolleTyp} lockObjektId={objektFilter}
                    onCancel={() => setObjektZuweisungForm(false)}
                    onSave={zuw => { addRolle(zuw); setObjektZuweisungForm(false); }}/>
                </div>
              )}
              {objektPaare.length === 0 && !objektZuweisungForm ? (
                <div style={{ fontSize: FS.s, color:t.muted, fontStyle:"italic", padding:"6px 0" }}>Noch keinem Objekt zugewiesen.</div>
              ) : (
                <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
                  {objektPaare.map(p => {
                    const v = (ves||[]).find(x => x.id===p.objektId);
                    if (!v) return null;
                    const einheit = p.einheitId ? v.einheiten.find(x => x.id===p.einheitId) : null;
                    const offen = expandedKey.has(p.key);
                    const matchIdx = alleZuweisungen.map((z,i) => ({z,i}))
                      .filter(({z}) => z.objektId===p.objektId && (z.einheitId||null)===(p.einheitId||null)).map(({i}) => i);
                    const matchZuweisungen = matchIdx.map(i => alleZuweisungen[i]);
                    const removeVerknuepfung = () => removeFlache(matchIdx);
                    const oneRolle = matchIdx.length === 1;
                    const bearbeiten = () => { if (oneRolle) setEditRolleIdx(matchIdx[0]); };
                    const handleZuweisungUpdate = patch => patchFlache(matchIdx, patch);
                    return (
                      <div key={p.key} style={{ display:"flex", alignItems:"stretch", gap:6 }}>
                        <div style={{ flex:1, minWidth:0 }}>
                          {editMode ? (
                            <ObjektZeile ve={v} einheit={einheit} zuweisungen={matchZuweisungen}
                              t={t} accent={kontaktFarben.objekt} editMode={editMode} aktiv={offen} oneRolle={oneRolle}
                              onClick={() => toggleKey(p.key)}
                              onZuweisungUpdate={handleZuweisungUpdate}
                              onGoto={onVEClick ? () => onVEClick(v.id) : null}/>
                          ) : einheit ? (
                            <FeldEinheitKarte ve={v} einheit={einheit} t={t} accent={kontaktFarben.objekt}
                              onVEClick={onVEClick ? () => onVEClick(v.id) : null}/>
                          ) : (
                            <FeldObjektKarte ve={v} t={t} accent={kontaktFarben.objekt}
                              kontakte={kontakte}
                              onVEClick={onVEClick ? () => onVEClick(v.id) : null}/>
                          )}
                        </div>
                        {editMode && (
                          <ZeilenAktionen t={t}
                            onEdit={oneRolle ? bearbeiten : null}
                            onLoesen={removeVerknuepfung}
                            loesenTitle={matchZuweisungen.length > 1
                              ? `Verknüpfung lösen (${matchZuweisungen.length} Rollen werden entfernt)`
                              : "Verknüpfung lösen"}/>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
        )}
      </div>
      )}
      {istFirma && !objektFilter && !ohneObjekte && firmenVertraege.length > 0 && (
        <div style={{ marginTop:10, paddingTop:10, borderTop:`1px solid ${t.border}40` }}>
          <div style={{ fontSize: FS.s, fontWeight: FW.bold, color:t.sub,
            textTransform:"uppercase", letterSpacing:"0.1em", marginBottom:6 }}>
            Verträge ({firmenVertraege.length})
          </div>
          <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
            {firmenVertraege.map(({ vertrag, ve }) => (
              <div key={ve.id + "::" + vertrag.id}>
                <button onClick={onVEClick ? () => onVEClick(ve.id) : null}
                  style={{ display:"flex", alignItems:"center", gap:6, width:"100%",
                    background:"none", border:"none", padding:"0 0 3px 0",
                    cursor:onVEClick?"pointer":"default", fontFamily:"inherit", textAlign:"left" }}>
                  <I name="building" size={11} color={kontaktFarben.objekt}/>
                  <span style={{ fontSize: FS.xs, fontWeight: FW.medium, color:kontaktFarben.objekt }}>
                    {ve.nr || ve.adresse || "Objekt"}
                  </span>
                </button>
                <VertragZeile v={vertrag} firma={k} t={t} accent={farbe}
                  editMode={false} onKontaktClick={onKontaktClick}
                  kontakte={kontakte} setKontakte={setKontakte} ves={ves}/>
              </div>
            ))}
          </div>
        </div>
      )}
      {!istFirma && !editMode && !ohneObjekte && (
        <KDKVererbungSektion k={k} t={t} ves={ves} kontakte={kontakte} onVEClick={onVEClick}/>
      )}
      {!ohneObjekte && !objektFilter && eigeneVertretungsVermerke.length > 0 && (
          <div style={{ marginTop: 10, paddingTop: 10, borderTop: `1px solid ${t.border}40` }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
              <div style={{ fontSize: FS.s, fontWeight: FW.bold, color: t.sub,
                textTransform: "uppercase", letterSpacing: "0.1em" }}>
                Hat Bevollmächtigten ({eigeneVertretungsVermerke.length})
              </div>
              {editMode && !neueVollmachtForm && (
                <button onClick={() => setNeueVollmachtForm(true)}
                  style={{ fontSize: FS.s, padding: "3px 10px", background: farbe + "20", color: farbe,
                    border: "none", borderRadius: RAD.sm, cursor: "pointer", fontFamily: "inherit", fontWeight: FW.medium , whiteSpace: "nowrap" }}>
                  + Bevollmächtigten
                </button>
              )}
            </div>
            {editMode && neueVollmachtForm && (
              <div style={{ marginBottom: 8 }}>
                <BeziehungEditor initial={{ rolle: "Bevollmächtigter", _vollmachtModus: true }}
                  ves={ves} kontakte={kontakte} setKontakte={setKontakte} t={t} accent={farbe} typ={rolleTyp} selbstId={k.id}
                  onCancel={() => setNeueVollmachtForm(false)}
                  onSave={zuw => { addRolle(zuw); setNeueVollmachtForm(false); }}/>
              </div>
            )}
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {eigeneVertretungsVermerke.map((z, i) => {
                const zielK = (kontakte || []).find(c => String(c.id) === String(z.zielKontaktId));
                return (
                  <BevollmaechtigterKarte key={i} zielKontakt={zielK}
                    rolle={z.rolle} status={z.status} t={t} accent={farbe}
                    ves={ves} kontakte={kontakte} setKontakte={setKontakte}
                    onKontaktClick={onKontaktClick} editMode={editMode}
                    onLoesen={() => removeRolle(z)}/>
                );
              })}
            </div>
          </div>
      )}
      {!ohneObjekte && !objektFilter && eigeneVertretungsVermerke.length === 0 && editMode && (
        <div style={{ marginTop: 10, paddingTop: 10, borderTop: `1px solid ${t.border}40` }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
            <div style={{ fontSize: FS.s, fontWeight: FW.bold, color: t.sub,
              textTransform: "uppercase", letterSpacing: "0.1em" }}>
              Hat Bevollmächtigten
            </div>
            {!neueVollmachtForm && (
              <button onClick={() => setNeueVollmachtForm(true)}
                style={{ fontSize: FS.s, padding: "3px 10px", background: farbe + "20", color: farbe,
                  border: "none", borderRadius: RAD.sm, cursor: "pointer", fontFamily: "inherit", fontWeight: FW.medium , whiteSpace: "nowrap" }}>
                + Bevollmächtigten
              </button>
            )}
          </div>
          {neueVollmachtForm && (
            <BeziehungEditor initial={{ rolle: "Bevollmächtigter", _vollmachtModus: true }}
              ves={ves} kontakte={kontakte} setKontakte={setKontakte} t={t} accent={farbe} typ={rolleTyp} selbstId={k.id}
              onCancel={() => setNeueVollmachtForm(false)}
              onSave={zuw => { addRolle(zuw); setNeueVollmachtForm(false); }}/>
          )}
        </div>
      )}
      {((zeigeGotoFooter && onGotoKontakt) || extraFooter) && !editMode && (
        <div style={{ marginTop: 12, display: "flex", alignItems: "center",
          justifyContent: "space-between", gap: 8 }}>
          <div>{extraFooter}</div>
          {zeigeGotoFooter && onGotoKontakt ? (
            <button onClick={() => onGotoKontakt(k.id)}
              style={{ fontSize: FS.s, padding: "6px 12px", background: farbe + "15", color: farbe,
                border: `1px solid ${farbe}40`, borderRadius: RAD.sm, cursor: "pointer",
                fontWeight: FW.medium, fontFamily: "inherit", display: "inline-flex",
                alignItems: "center", gap: 5 }}>
              {istFirma ? "Zur Firma" : "Zum Kontakt"}
            </button>
          ) : <span/>}
        </div>
      )}
      {/* DSGVO-Bereich: nur im vollständigen Profil (nicht eingebettet, kein
          Objekt-Filter), nur im Lese-Modus. Auskunfts-PDF immer; abgestufte
          Löschung nur bei Personen und freigeschaltetem Lösch-Schalter. */}
      {!embedded && !objektFilter && !editMode && (
        <KontaktDsgvoAktionen kontakt={k} ves={ves} t={t} accent={farbe}
          onDelete={(!istFirma && onDelete) ? onDelete : null}
          onAnonymisieren={(!istFirma && setKontakte)
            ? () => setKontakte(prev => prev.map(x => x.id === k.id ? anonymisiereKontakt(x) : x))
            : null}
          loeschenErlaubt={loeschenErlaubt.kontakte}/>
      )}
    </div>
  );
}
// ── BevollmaechtigterKarte ───────────────────────────────────────────────────
// Eine Zeile in der "Hat Bevollmächtigten"-Sektion: eingeklappt als kompakte
// KontaktKarte, aufgeklappt als vollständige (eingebettete) Detailkarte des
// Bevollmächtigten — analog zu VertragFirmaKarte. "onGotoKontakt" führt zur
// Hauptkarte. Der Status-Chip (aktiv/ehemalig) der Vollmacht wird oben gezeigt.
function BevollmaechtigterKarte({ zielKontakt, rolle, status, t, accent, ves, kontakte, setKontakte, onKontaktClick, editMode, onLoesen }) {
  const [offen, setOffen] = useState(false);
  const rollenDefs = useRollen();
  const firmenRollenDefs = useFirmenRollen();
  const ehem = (status || "aktiv") === "ehemalig";
  const rd = rollenDefs.find(r => r.name === rolle) || firmenRollenDefs.find(r => r.name === rolle);
  const rc = ehem ? t.muted : ((rd && rd.color) || accent);
  if (!zielKontakt) {
    return (
      <div style={{ display: "flex", alignItems: "center", gap: 8, background: t.surface,
        border: `1px solid ${t.border}`, borderRadius: RAD.md, padding: "9px 11px", color: t.muted }}>
        <I name="user" size={12} color={t.muted}/> Unbekannter Kontakt
        {editMode && onLoesen && (
          <button onClick={onLoesen} title="Entfernen"
            style={{ marginLeft: "auto", background: "none", border: "none", cursor: "pointer", padding: 2 }}>
            <I name="x" size={13} color="#EF4444"/>
          </button>
        )}
      </div>
    );
  }
  return (
    <div style={{ display: "flex", alignItems: "stretch", gap: 6 }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        {!offen ? (
          <div onClick={() => setOffen(true)} style={{ cursor: "pointer", opacity: ehem ? 0.7 : 1 }}>
            <KontaktKarte k={zielKontakt} t={t} aktiv={false} onClick={() => setOffen(true)}/>
          </div>
        ) : (
          <div style={{ opacity: ehem ? 0.7 : 1 }}>
            <KontaktDetailKarte k={zielKontakt} t={t} accent={accent}
              ves={ves || []} kontakte={kontakte} setKontakte={setKontakte}
              onUpdate={(updated) => setKontakte && setKontakte(prev =>
                prev.map(c => c.id === zielKontakt.id ? updated : c))}
              onGotoKontakt={(id) => onKontaktClick && onKontaktClick(id)}
              onKontaktClick={onKontaktClick}
              onKopfClick={() => setOffen(false)}
              embedded/>
          </div>
        )}
      </div>
      {editMode && onLoesen && (
        <ZeilenAktionen t={t} onLoesen={onLoesen} loesenTitle="Bevollmächtigten entfernen"/>
      )}
    </div>
  );
}

// ── KontaktListenZeile (kompakte Listenansicht eines Kontakts, DESIGN §35) ──
// Schmale Zeile: Avatar · Name · erste Rolle. Tippen klappt dasselbe Detail
// auf wie die KontaktKarte.
function KontaktListenZeile({ k, t, accent, aktiv, onClick, id, kbItem = false }) {
  const istFirma = k.typ === "firma";
  const kontaktFarben = useKontaktFarbe();
  const farbe = istFirma ? kontaktFarben.firma : kontaktFarben.person;
  const auswahl = (istFirma ? kontaktFarben.auswahlFirma : kontaktFarben.auswahlPerson) || farbe;
  const personenRollen = useRollen();
  const firmenRollen = useFirmenRollen();
  const anzeige = useKontaktAnzeige();
  const alleKontakte = useAlleKontakte();
  const alleVes = useAlleVes();
  const name = formatNameMitCtx(k, anzeige) || k.name;
  const zuweisungen = zuweisungenFuerAvatar(k, undefined, alleKontakte, alleVes)
    .filter(z => (z.status || "aktiv") !== "ehemalig");
  const rollen = [...new Set(zuweisungen.map(z => z.rolle))];
  const rollenText = rollen.slice(0, 2).join(" · ");
  // Punkt-Farbe = Farbe der Hauptrolle (erste Rolle); sonst Personen-/Firmen-
  // Akzent. Spiegelt das bestehende Rollen-Farbsystem wider.
  const rollenListe = istFirma ? firmenRollen : personenRollen;
  let punkt = farbe;
  if (rollen.length > 0) {
    const def = rollenListe.find(r => r.name === rollen[0]);
    if (def && def.color) punkt = def.color;
  }
  const kbProps = kbItem ? { "data-kb-item": "1" } : {};
  return (
    <div onClick={onClick} id={id} {...kbProps}
      style={{ display: "flex", alignItems: "center", gap: 10,
        padding: "10px 12px", cursor: "pointer", boxSizing: "border-box",
        background: aktiv ? auswahl + "12" : t.card,
        border: `1px solid ${aktiv ? auswahl : t.border}`,
        borderRadius: RAD.md }}>
      <span style={{ width: 9, height: 9, borderRadius: 5, flexShrink: 0,
        background: punkt }}/>
      <div style={{ flex: 1, minWidth: 0, display: "flex",
        alignItems: "baseline", gap: 8 }}>
        <span style={{ fontSize: FS.m, fontWeight: FW.bold, color: t.text,
          flexShrink: 0, overflow: "hidden", textOverflow: "ellipsis",
          whiteSpace: "nowrap", maxWidth: "60%",
          // Firmen-Kennung: Name unterstrichen (text-decoration belegt KEINEN
          // zusätzlichen Platz → Zeilenhöhe bleibt identisch zu Personen).
          textDecoration: istFirma ? "underline" : "none",
          textDecorationColor: istFirma ? farbe : undefined,
          textDecorationThickness: istFirma ? 2 : undefined,
          textUnderlineOffset: istFirma ? 2 : undefined }}>{name}</span>
        {rollenText ? (
          <span style={{ fontSize: FS.s, color: t.sub, overflow: "hidden",
            textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{rollenText}</span>
        ) : null}
      </div>
    </div>
  );
}

// ── KontaktKarte (kompakte Karten-Darstellung im Stil der VEKachel) ─────────
function KontaktKarte({ k, t, aktiv, onClick, id, ohneRahmen = false, kompakt = false, kbItem = false }) {
  const istFirma = k.typ === "firma";
  const kontaktFarben = useKontaktFarbe();
  const farbe = istFirma ? kontaktFarben.firma : kontaktFarben.person;
  const personenRollen = useRollen();
  const firmenRollen = useFirmenRollen();
  const kartenBadges = useKartenBadges();
  const zeigeKartenBadges = istFirma ? kartenBadges.firma : kartenBadges.person;
  const anzeige = useKontaktAnzeige();
  const alleKontakte = useAlleKontakte();
  const alleVes = useAlleVes();
  const name = formatNameMitCtx(k, anzeige) || k.name;

  // Aktive Rollen für Badges (max 3, dedupliziert) — ehemalige weggelassen.
  // Quelle: zuweisungenFuerAvatar (führt besitz/zustaendigkeiten/firmenRollen
  // UND die Gewerke der Firma zusammen) — dieselbe wie für die Eck-Badges.
  // alleKontakte → eingehende Vertretungen (Bevollmächtigter-Badge) werden ergänzt.
  const zuweisungen = zuweisungenFuerAvatar(k, undefined, alleKontakte, alleVes)
    .filter(z => (z.status || "aktiv") !== "ehemalig");
  const uniRollenNamen = [...new Set(zuweisungen.map(z => z.rolle))].slice(0, 3);
  // Für jede Rolle die "wichtigste" Zuweisung finden (aktiv > werdend), inkl. vorsitz/vertrag
  const PRIO = { aktiv: 3, werdend: 2 };
  const rollenAnzeige = uniRollenNamen.map(rn => {
    const beste = zuweisungen
      .filter(z => z.rolle === rn)
      .sort((a, b) => (PRIO[b.status || "aktiv"] || 0) - (PRIO[a.status || "aktiv"] || 0))[0];
    return { rolle: rn, status: beste.status || "aktiv", vorsitz: !!beste.vorsitz, vertrag: !!beste.vertrag };
  }).filter(r => {
    // Nur Rollen/Gewerke mit aktivem Karten-Badge zeigen. Definition aus der
    // passenden Liste (Firma → Gewerke, Person → Rollen); unbekannte zeigen.
    const def = (istFirma ? firmenRollen : personenRollen).find(d => d.name === r.rolle);
    return !def || rolleBadgeSichtbar(def);
  });

  // Markierte Details (max 2) — bei Personen aus tels/emails mit favorit:true
  // sowie aus dem Adress-Sammelflag (adresseFavorit; alte Einzel-Flags zählen).
  // Bei Firmen einfach Tel + Email anzeigen.
  // Falls bei Personen kein Favorit gesetzt: erste Tel + erste Email als Fallback.
  let details = [];
  if (istFirma) {
    if (k.tel)   details.push({ icon: "📞", text: k.tel });
    if (k.email) details.push({ icon: "✉", text: k.email });
  } else {
    const favTels = (k.tels   || []).filter(x => x.favorit)
      .map(x => ({ icon: "📞", text: x.nr }));
    const favEmails = (k.emails || []).filter(x => x.favorit)
      .map(x => ({ icon: "✉", text: x.email }));
    // Adresse hat EINEN gemeinsamen Stern (adresseFavorit); alte Einzel-Flags
    // (strasseFavorit/plzOrtFavorit) zählen im Bestand weiterhin.
    const plzOrtText = joinPlzOrt(k.plz, k.ort) || k.plzOrt;
    const adresseText = [k.strasse, plzOrtText].filter(Boolean).join(", ");
    const favAdresse = ((k.adresseFavorit || k.strasseFavorit || k.plzOrtFavorit) && adresseText)
      ? [{ icon: "🏠", text: adresseText }] : [];
    if (favTels.length + favEmails.length + favAdresse.length > 0) {
      details = [...favTels, ...favEmails, ...favAdresse];
    } else {
      // Fallback: erste Tel + erste Email
      if ((k.tels   || [])[0]) details.push({ icon: "📞", text: k.tels[0].nr });
      if ((k.emails || [])[0]) details.push({ icon: "✉", text: k.emails[0].email });
    }
  }
  details = details.slice(0, 2);

  // Status-Leiste — wird konfigurierbar (Menü folgt). Aktuell Demo-Logik:
  //   · Werdende Zuweisungen  →  info  "Eigentümerwechsel in Vorbereitung"
  //   · Nur ehemalige Rollen  →  done  "Keine aktiven Beteiligungen"
  // Das Setting statusLeisteKontakt steuert die Anzeige insgesamt.
  const statusLeisteSettings = useStatusLeiste();
  const status = (statusLeisteSettings.kontakt && !istFirma)
    ? berechneKontaktStatus(k, statusLeisteSettings.inhalte || {})
    : null;

  const bc = aktiv ? (kontaktFarben.auswahlKontakt || farbe) : t.border;
  // In der kleinen/eingebetteten Kontaktkarte (kompakt) wird die Statusleiste
  // nie gezeigt — sie ist dort nicht relevant.
  const zeigeStatus = statusLeisteSettings.kontakt && !kompakt;
  return (
    <div onClick={onClick} id={id} data-kb-item={kbItem ? "1" : undefined} style={{
      cursor: "pointer", transition: "all 0.15s",
      border: ohneRahmen ? "none" : `1px solid ${bc}`,
      borderRadius: ohneRahmen ? 0 : RAD.lg,
      overflow: "hidden",
      // Karte füllt ihre Grid-Zelle in voller Höhe (das Grid streckt die Zellen
      // auf gleiche Höhe). So klebt die Statusleiste unten und es bleibt KEIN
      // dunkler Grid-Hintergrund-Streifen unter kürzeren Karten.
      height: "100%", display: "flex", flexDirection: "column",
      background: istFirma ? t.surface : t.card,
      scrollMarginTop: "var(--ad-header-h, 200px)" }}
      onMouseEnter={e => { if (!aktiv) e.currentTarget.style.transform = "translateY(-1px)"; }}
      onMouseLeave={e => { if (!aktiv) e.currentTarget.style.transform = "none"; }}>
      <div style={{
        display: "flex", alignItems: "center", gap: 12,
        padding: "10px 12px", boxSizing: "border-box",
        background: istFirma ? t.surface : t.card,
        flex: 1, minHeight: 0 }}>
        {/* Links: Avatar — Wrapper 48px (38 Avatar + 10 Spielraum für Eck-Badges) */}
        <div style={{ width: 48, flexShrink: 0, display: "flex",
          alignItems: "center", justifyContent: "center" }}>
          <Avatar name={name} firma={istFirma} size={38} accent={farbe}
            zuweisungen={zuweisungenFuerAvatar(k, undefined, alleKontakte, alleVes)}/>
        </div>
        {/* Mitte: Name + IMMER 2 Detail-Slots (leere mit Platzhalter,
            damit alle Karten gleich hoch sind) */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: FS.l, fontWeight: FW.heavy, color: farbe,
            textDecoration: istFirma ? "underline" : "none", textDecorationColor: farbe,
            textDecorationThickness: 2, textUnderlineOffset: 2,
            overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {name || "—"}
          </div>
          {[0, 1].map(i => {
            const d = details[i];
            // Bei index 0 ohne details: "Keine Kontaktdaten" als Hinweis;
            // bei index 1 ohne details: leerer Platzhalter (\u00A0)
            if (d) {
              return (
                <div key={i} style={{ fontSize: FS.s, color: t.sub, marginTop: 1,
                  display: "flex", alignItems: "center", gap: 4,
                  overflow: "hidden", whiteSpace: "nowrap" }}>
                  <span style={{ fontSize: FS.s }}>{d.icon}</span>
                  <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>{d.text}</span>
                </div>
              );
            }
            if (i === 0 && details.length === 0) {
              return (
                <div key={i} style={{ fontSize: FS.s, color: t.muted,
                  fontStyle: "italic", marginTop: 1 }}>Keine Kontaktdaten</div>
              );
            }
            // Platzhalter-Zeile für gleiche Höhe
            return (
              <div key={i} style={{ fontSize: FS.s, marginTop: 1 }}>{"\u00A0"}</div>
            );
          })}
        </div>
        {/* Rechts: Rollen-Badges */}
        {!kompakt && zeigeKartenBadges && rollenAnzeige.length > 0 && (
          <div style={{ display: "flex", gap: 3, flexShrink: 0, alignItems: "center" }}>
            {rollenAnzeige.map((r, i) => (
              <RolleBadge key={i} rolle={r.rolle} size={18}
                status={r.status} vorsitz={r.vorsitz} vertrag={r.vertrag}/>
            ))}
          </div>
        )}
      </div>
      {zeigeStatus && <StatusLeiste {...(status || {})} t={t} borderColor={bc} eingebettet={true}/>}
    </div>
  );
}

// ── KontakteMasterDetail (responsive Master-Detail-Layout) ──────────────────
// Misst die verfügbare Breite und entscheidet:
//   · 2-Spalten-Master + Detail (Standard, wenn genug Platz)
//   · 1-Spalten-Master + Detail (wenn Detail sonst zu schmal würde)
//   · nur Detail mit "Zurück"-Button (wenn auch 1-Spalten-Master nicht passt)
function KontakteMasterDetail({ cardWidth, detailMinBreite = 300, kartenMaxBreite = 340, kartenMin = 272, listeOpt = null, kartenSpalten = 2, listenAnsicht = "karten", renderKartenSpalte, aktivK, t, accent,
  ves, kontakte, setKontakte, onVEClick, setAktiv, updateKontakt, onDelete, onNurDetail = null }) {
  const istDesktop = useWindowWidth() >= DESKTOP_MIN_WIDTH;
  const detailKarte = (
    <KontaktDetailKarte k={aktivK} t={t} accent={accent} listenModus={true}
      ves={ves} kontakte={kontakte} setKontakte={setKontakte}
      onVEClick={onVEClick} onKontaktClick={(id) => setAktiv(id)}
      onUpdate={updateKontakt} onDelete={onDelete}/>
  );
  return (
    <MasterDetailRahmen
      master={(layout) => layout.nurMaster
        ? renderKartenSpalte(Math.max(1, layout.cols), null, layout.kartenMaxBreite, layout.einspaltig)
        : renderKartenSpalte(Math.max(1, layout.cols), layout.kartenBreite)}
      detail={detailKarte}
      mobilDetail={detailKarte}
      istDesktop={istDesktop}
      listenAnsicht={listenAnsicht} listeOpt={listeOpt}
      kartenSpalten={kartenSpalten} kartenMaxBreite={kartenMaxBreite}
      kartenMin={kartenMin} detailMinBreite={detailMinBreite}
      onNurDetail={onNurDetail}/>
  );
}

// ── KontakteScreen ──────────────────────────────────────────────────────────
// ── IconLegende — erklärt die am Avatar genutzten Badges/Stile ──────────────
// Aufklappbar. Zeigt NUR die Rollen-Kürzel, die in den übergebenen Kontakten
// tatsächlich vorkommen (dynamisch), plus die Status-Stile und den Ring.
function IconLegende({ kontakte = [], t, accent, listenAnsicht = "karten", onEinstellen }) {
  const [offen, setOffen] = useState(false);
  const personenRollen = useRollen();
  const firmenRollen = useFirmenRollen();
  const istListe = listenAnsicht === "liste";

  // Genutzte Rollennamen aus allen Kontakten sammeln (Rollen + Gewerke/Firmenrollen).
  const genutzt = new Set();
  (kontakte || []).forEach(k => {
    (k.rollen || []).forEach(r => { if (r) genutzt.add(r); });
    (k.gewerke || []).forEach(g => { const n = typeof g === "string" ? g : (g && g.name); if (n) genutzt.add(n); });
    // Befugnis (Vollmacht/Betreuung) → Bevollmächtigter/Betreuer
    ausgehendeBefugnisse(k).forEach(b => genutzt.add(b.art === "betreuung" ? "Betreuer" : "Bevollmächtigter"));
  });

  const alleDefs = [...personenRollen, ...firmenRollen];
  const genutzteDefs = alleDefs.filter(d => d && genutzt.has(d.name) && d.aktiv !== false);
  // alphabetisch
  genutzteDefs.sort((a, b) => (a.name || "").localeCompare(b.name || "", "de"));

  return (
    <div style={{ marginBottom: 10, border: `1px solid ${t.border}`, borderRadius: RAD.md,
      background: t.surface, overflow: "hidden" }}>
      <button onClick={() => setOffen(o => !o)} type="button"
        style={{ width: "100%", display: "flex", alignItems: "center", gap: 8,
          background: "transparent", border: "none", cursor: "pointer",
          padding: "5px 12px", minHeight: 34, boxSizing: "border-box", fontFamily: "inherit", color: t.sub }}>
        <I name="info" size={14} color={accent}/>
        <span style={{ flex: 1, textAlign: "left", fontSize: FS.s, fontWeight: FW.medium }}>
          Legende — Symbole erklärt
        </span>
        {onEinstellen ? (
          <span
            onClick={(e) => { e.stopPropagation(); onEinstellen(); }}
            style={{ display: "flex", alignItems: "center", gap: 4, flexShrink: 0,
              padding: "3px 9px", borderRadius: RAD.sm, cursor: "pointer",
              fontFamily: "inherit", fontSize: FS.xs, fontWeight: FW.bold,
              background: accent + "14", border: `1px solid ${accent}40`, color: accent }}>
            Einstellen
          </span>
        ) : null}
      </button>
      {offen && (
        <div style={{ padding: "4px 12px 12px", borderTop: `1px solid ${t.border}40` }}>
          {istListe ? (
            /* Listen-Modus: der Punkt links zeigt die Farbe der Hauptrolle. */
            <div>
              <div style={{ marginTop: 8, fontSize: FS.xs, fontWeight: FW.bold, color: t.sub,
                textTransform: "uppercase", letterSpacing: "0.08em" }}>Punkt = Hauptrolle</div>
              {genutzteDefs.length > 0 ? (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 12, marginTop: 8 }}>
                  {genutzteDefs.map(d => (
                    <div key={d.name} style={{ display: "inline-flex", alignItems: "center", gap: 8,
                      fontSize: FS.s, color: t.text }}>
                      <span style={{ width: 9, height: 9, borderRadius: 5, flexShrink: 0,
                        background: d.color || accent }}/>
                      {d.name}
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ fontSize: FS.s, color: t.muted, fontStyle: "italic", marginTop: 8 }}>
                  Noch keine Rollen vergeben.
                </div>
              )}
            </div>
          ) : (
            <>
              {/* Rollen-Kürzel (nur genutzte) */}
              {genutzteDefs.length > 0 ? (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginTop: 8 }}>
                  {genutzteDefs.map(d => (
                    <div key={d.name} style={{ display: "inline-flex", alignItems: "center", gap: 6,
                      fontSize: FS.s, color: t.text }}>
                      <RolleBadge rolle={d.name} size={22} status="aktiv"/>
                      {d.name}
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ fontSize: FS.s, color: t.muted, fontStyle: "italic", marginTop: 8 }}>
                  Noch keine Rollen vergeben.
                </div>
              )}

              {/* Status-Stile */}
              <div style={{ marginTop: 12, fontSize: FS.xs, fontWeight: FW.bold, color: t.sub,
                textTransform: "uppercase", letterSpacing: "0.08em" }}>Status</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 12, marginTop: 6 }}>
                <div style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: FS.s, color: t.text }}>
                  <RolleBadge rolle="Eigentümer" size={22} status="aktiv"/> aktiv
                </div>
                <div style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: FS.s, color: t.text }}>
                  <RolleBadge rolle="Eigentümer" size={22} status="werdend"/> werdend
                </div>
                <div style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: FS.s, color: t.text }}>
                  <RolleBadge rolle="Eigentümer" size={22} status="ehemalig"/> ehemalig
                </div>
              </div>

              {/* Ring */}
              <div style={{ marginTop: 12, fontSize: FS.xs, fontWeight: FW.bold, color: t.sub,
                textTransform: "uppercase", letterSpacing: "0.08em" }}>Goldener Ring</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 12, marginTop: 6 }}>
                <div style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: FS.s, color: t.text }}>
                  <RolleBadge rolle="Verwaltungsbeirat" size={22} status="aktiv" vorsitz={true}/> Vorsitz (VBV)
                </div>
                <div style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: FS.s, color: t.text }}>
                  <RolleBadge rolle="Verwaltungsbeirat" size={22} status="aktiv" vertrag={true}/> mit Vertrag
                </div>
                <div style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: FS.s, color: t.text }}>
                  <RolleBadge rolle="Eigentümer" size={22} status="aktiv" selbstnutzend={true}/> selbst bewohnt
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ── ObjektLegende — erklärt die an Einheiten genutzten Verwendungs-Badges ────
// Aufklappbar. Zeigt NUR die Verwendungen, die in den Objekten tatsächlich
// vorkommen (dynamisch), plus die Status-Stile.
function ObjektLegende({ ves = [], t, accent, listenAnsicht = "karten", onGotoHandlungsbedarf }) {
  const [offen, setOffen] = useState(false);
  const alleVerwendungen = useVerwendungen();
  const istListe = listenAnsicht === "liste";

  // Genutzte Verwendungsnamen aus allen Einheiten sammeln.
  const genutzt = new Set();
  (ves || []).forEach(v => {
    (v.einheiten || []).forEach(e => {
      verwendungenVon(e).forEach(vw => { if (vw && vw.name) genutzt.add(vw.name); });
    });
  });

  const genutzteDefs = (alleVerwendungen || []).filter(d => d && genutzt.has(d.name) && d.aktiv !== false);
  genutzteDefs.sort((a, b) => (a.name || "").localeCompare(b.name || "", "de"));

  // Punkt-Symbol für die Listen-Legende (Status der Verwalterbestellung).
  const PunktZeile = ({ farbe, text }) => (
    <div style={{ display: "inline-flex", alignItems: "center", gap: 8,
      fontSize: FS.s, color: t.text }}>
      <span style={{ width: 9, height: 9, borderRadius: 5, background: farbe,
        flexShrink: 0 }}/>
      {text}
    </div>
  );
  // Balken-Symbol für die Statusleiste-Legende (Karten-Modus).
  const LeisteZeile = ({ farbe, text }) => (
    <div style={{ display: "inline-flex", alignItems: "center", gap: 8,
      fontSize: FS.s, color: t.text }}>
      <span style={{ width: 18, height: 10, borderRadius: 3, background: farbe,
        flexShrink: 0 }}/>
      {text}
    </div>
  );

  return (
    <div style={{ marginBottom: 10, border: `1px solid ${t.border}`, borderRadius: RAD.md,
      background: t.surface, overflow: "hidden" }}>
      <div onClick={() => setOffen(o => !o)}
        style={{ width: "100%", display: "flex", alignItems: "center", gap: 8,
          cursor: "pointer", padding: "5px 12px", minHeight: 34, boxSizing: "border-box", color: t.sub }}>
        <I name="info" size={14} color={accent}/>
        <span style={{ flex: 1, textAlign: "left", fontSize: FS.s, fontWeight: FW.medium }}>
          Legende — Symbole erklärt
        </span>
        {onGotoHandlungsbedarf ? (
          <button type="button"
            onClick={(e) => { e.stopPropagation(); onGotoHandlungsbedarf(); }}
            style={{ display: "flex", alignItems: "center", gap: 4, flexShrink: 0,
              padding: "3px 9px", borderRadius: RAD.sm, cursor: "pointer",
              fontFamily: "inherit", fontSize: FS.xs, fontWeight: FW.bold,
              background: accent + "14", border: `1px solid ${accent}40`, color: accent }}>
            Einstellen
          </button>
        ) : null}
      </div>
      {offen && (
        <div style={{ padding: "4px 12px 12px", borderTop: `1px solid ${t.border}40` }}>
          {istListe ? (
            /* Listen-Modus: der Punkt links zeigt den Gesamt-Handlungsbedarf
               des Objekts (Fristen/Termine). */
            <div>
              <div style={{ marginTop: 8, fontSize: FS.xs, fontWeight: FW.bold, color: t.sub,
                textTransform: "uppercase", letterSpacing: "0.08em" }}>Punkt = Handlungsbedarf</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 8 }}>
                <PunktZeile farbe="#22C55E" text="alles ok — nichts Dringendes"/>
                <PunktZeile farbe="#F59E0B" text="kann was gemacht werden — Frist rückt näher"/>
                <PunktZeile farbe="#EF4444" text="muss was gemacht werden — Frist überfällig"/>
              </div>
            </div>
          ) : (
            <>
              {/* Verwendungen (nur genutzte) */}
              {genutzteDefs.length > 0 ? (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginTop: 8 }}>
                  {genutzteDefs.map(d => (
                    <div key={d.name} style={{ display: "inline-flex", alignItems: "center", gap: 6,
                      fontSize: FS.s, color: t.text }}>
                      <VerwendungBadge verwendung={d.name} size={22} status="aktiv"/>
                      {d.name}
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ fontSize: FS.s, color: t.muted, fontStyle: "italic", marginTop: 8 }}>
                  Noch keine Verwendungen vergeben.
                </div>
              )}

              {/* Status-Stile */}
              <div style={{ marginTop: 12, fontSize: FS.xs, fontWeight: FW.bold, color: t.sub,
                textTransform: "uppercase", letterSpacing: "0.08em" }}>Status</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 12, marginTop: 6 }}>
                <div style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: FS.s, color: t.text }}>
                  <VerwendungBadge verwendung="Vermietet" size={22} status="aktiv"/> aktiv
                </div>
                <div style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: FS.s, color: t.text }}>
                  <VerwendungBadge verwendung="Vermietet" size={22} status="werdend"/> werdend
                </div>
                <div style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: FS.s, color: t.text }}>
                  <VerwendungBadge verwendung="Vermietet" size={22} status="ehemalig"/> ehemalig
                </div>
              </div>

              {/* Statusleiste unter der Karte — farbcodierter Handlungsbedarf
                  mit Grund-Text (gleiche Logik wie der Punkt in der Liste). */}
              <div style={{ marginTop: 12, fontSize: FS.xs, fontWeight: FW.bold, color: t.sub,
                textTransform: "uppercase", letterSpacing: "0.08em" }}>Statusleiste = Handlungsbedarf</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 12, marginTop: 6 }}>
                <LeisteZeile farbe="#F59E0B" text="Frist rückt näher"/>
                <LeisteZeile farbe="#EF4444" text="Frist überfällig"/>
              </div>
              <div style={{ marginTop: 6, fontSize: FS.xs, color: t.muted }}>
                Alles ok: keine Leiste. Was zählt, stellst du oben rechts ein.
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ── Alphabetische Gliederung der Kontaktliste ───────────────────────────────
// kontaktAnfangsbuchstabe: liefert den Trenner-Buchstaben passend zur Sortierung
// (Firma → name; Person → vorname/nachname je nach Format). Diakritika werden
// auf den Grundbuchstaben normalisiert (Ä→A, Ö→O, Ü→U, é→E …); alles ohne
// Buchstaben (Zahlen/leer) landet unter „#".
function kontaktAnfangsbuchstabe(k, nameFormat) {
  if (!k) return "#";
  let basis = "";
  if (k.typ === "firma") basis = k.name || "";
  else {
    const sortNach = nameFormat === "nachname-vorname" ? "nachname" : "vorname";
    basis = (sortNach === "vorname" ? k.vorname : k.nachname) || k.nachname || k.vorname || k.name || "";
  }
  const ch = basis.trim().charAt(0);
  if (!ch) return "#";
  // ß zuerst (ß.toUpperCase() ergäbe "SS"). Dann Diakritika entfernen
  // (NFD + Combining-Marks weg), dann Großbuchstabe.
  if (ch === "ß") return "S";
  let norm = ch;
  try { norm = ch.normalize("NFD").replace(/[\u0300-\u036f]/g, ""); } catch (e) {}
  norm = (norm.charAt(0) || ch).toUpperCase();
  // alles Nicht-A–Z → „#".
  if (norm < "A" || norm > "Z") return "#";
  return norm;
}

// Teilt eine bereits sortierte Kontaktliste in Buchstaben-Sektionen:
// [{ buchstabe, kontakte: [...] }] in Listenreihenfolge.
function gruppiereNachBuchstabe(liste, nameFormat) {
  const sektionen = [];
  let aktuell = null;
  (liste || []).forEach(k => {
    const b = kontaktAnfangsbuchstabe(k, nameFormat);
    if (!aktuell || aktuell.buchstabe !== b) {
      aktuell = { buchstabe: b, kontakte: [] };
      sektionen.push(aktuell);
    }
    aktuell.kontakte.push(k);
  });
  return sektionen;
}

// KbZurueckHook — unsichtbares Ziel für die Esc-Taste (Tastatur Stufe 2).
// In Desktop-Master-Detail-Layouts gibt es keinen sichtbaren „Zurück"-Button;
// dieser 1×1-px-Button wird vom globalen Tastatur-Handler per .click()
// ausgelöst und schließt das offene Detail. pointerEvents:none hält ihn von
// Maus/Touch fern, programmatische clicks funktionieren trotzdem.
function KbZurueckHook({ onClick }) {
  return (
    <button data-kb-zurueck="1" aria-hidden="true" tabIndex={-1} onClick={onClick}
      style={{ position: "fixed", bottom: 0, right: 0, width: 1, height: 1,
        padding: 0, border: "none", background: "transparent", opacity: 0,
        pointerEvents: "none" }}/>
  );
}

// Mobile: aufgeklapptes Objekt-Detail. Beim Öffnen (neue VE-ID) wird der
// eigene Wurzel-Knoten an den Seitenanfang unter den Sticky-Header gescrollt,
// damit der Detail-Kopf oben steht statt am unteren Bildschirmrand zu kleben
// (Sprung-/Auslauf-Zusammenspiel, §33). Body-Scroll auf Mobile: window.scrollTo;
// falls doch ein interner Scroller existiert, diesen. Zwei rAF: nach Layout der
// frisch gemounteten Detail-Ansicht.
function DetailMobilScrollTop({ offenId, t, headerSelector, children, zumAnfang = false }) {
  const wrapRef = useRef(null);
  useEffect(() => {
    if (offenId == null) return;
    const lauf = () => {
      const el = wrapRef.current;
      if (!el) return;
      const scroller = findScrollParent(el);
      // zumAnfang: NICHT den Detail-Kopf unter den Header ziehen (das schiebt den
      // sticky ScreenKopf — Titel/Pillen/Zurück — aus dem Bild), sondern an den
      // ANFANG des scrollbaren Bereichs scrollen. Der sticky ScreenKopf klebt
      // dann oben sichtbar, das Detail beginnt direkt darunter (Benny-Wunsch:
      // „Header nicht verschwunden").
      if (zumAnfang) {
        if (scroller) {
          try { scroller.scrollTo({ top: 0, behavior: "auto" }); }
          catch (e) { scroller.scrollTop = 0; }
        } else if (typeof window !== "undefined") {
          try { window.scrollTo({ top: 0, behavior: "auto" }); }
          catch (e) { window.scrollTo(0, 0); }
        }
        return;
      }
      if (scroller) {
        const sRect = scroller.getBoundingClientRect();
        const delta = el.getBoundingClientRect().top - sRect.top - 8;
        const ziel = Math.max(0, scroller.scrollTop + delta);
        try { scroller.scrollTo({ top: ziel, behavior: "auto" }); }
        catch (e) { scroller.scrollTop = ziel; }
      } else if (typeof window !== "undefined") {
        const headerEl = headerSelector ? document.querySelector(headerSelector) : null;
        // Zusätzlich zur App-Header-Höhe auch die sticky Sektionsleiste
        // (Kontakte/Personen/Firmen/Zurück) abziehen — sonst rutscht der
        // Detail-Kopf hinter diese Leiste (sie bleibt sticky stehen).
        let sektionH = 0;
        if (typeof document !== "undefined" && document.documentElement) {
          const raw = getComputedStyle(document.documentElement)
            .getPropertyValue("--ad-section-h");
          const parsed = parseFloat(raw);
          if (!isNaN(parsed)) sektionH = parsed;
        }
        const headerH = (headerEl ? headerEl.offsetHeight : 168) + sektionH + 12;
        const top = (window.scrollY || 0) + el.getBoundingClientRect().top - headerH;
        try { window.scrollTo({ top: Math.max(0, top), behavior: "auto" }); }
        catch (e) { window.scrollTo(0, Math.max(0, top)); }
      }
    };
    requestAnimationFrame(() => requestAnimationFrame(lauf));
  }, [offenId]);
  return (
    <div ref={wrapRef} style={{ display: "flex", flexDirection: "column",
      scrollMarginTop: "var(--ad-header-h, 180px)" }}>
      {children}
    </div>
  );
}

// KontaktTrenner: Buchstabe links + feine Linie über die volle Breite. Sitzt
// als eigene Grid-Zeile (gridColumn 1/-1), damit er das mehrspaltige Karten-
// Raster nicht stört.
function KontaktTrenner({ buchstabe, t, accent }) {
  return (
    <div style={{ gridColumn: "1 / -1", display: "flex", alignItems: "center",
      gap: 10, marginTop: 6, marginBottom: 2 }}>
      <span style={{ fontSize: FS.s, fontWeight: FW.bold, color: accent,
        letterSpacing: "0.06em", flexShrink: 0, minWidth: 14 }}>{buchstabe}</span>
      <span style={{ flex: 1, height: 1, background: t.border }}/>
    </div>
  );
}

function KontakteScreen({ t, accent, initialKontaktId, onVEClick, filter = "alle", kontaktart, kontakte, setKontakte, ves, cardWidth = 340, detailMinBreite = 300, kartenMaxBreite = 340, kartenMin = 272, listeOpt = null, legendeAn = true, listenAnsicht = "karten",
  externAktiv, setExternAktiv, externEditMode, setExternEditMode, mobileDetailHeaderOhneEditBtn = false, kartenSpalten = 2, festeGridSpec = null, onNurDetail = null }) {
  const [internAktiv, setInternAktiv] = useState(initialKontaktId || null);
  // Aktiver Kontakt: extern kontrollierbar (Mobile: App-Ebene weiß Bescheid,
  // um Plus → Stift im Sticky-Header zu wechseln), sonst lokaler State.
  const aktiv    = (externAktiv !== undefined) ? externAktiv : internAktiv;
  const setAktiv = setExternAktiv ? setExternAktiv : setInternAktiv;
  // Bewusst kein Auto-Scroll beim Master-Detail-Klick — der geklickte
  // Listeneintrag bleibt an seiner Stelle.
  const ww = useWindowWidth();
  const personenRollen = useRollen();
  const firmenRollen = useFirmenRollen();
  const arten = buildKontaktarten(personenRollen, firmenRollen);

  // Filter-Logik abhängig vom externen filter
  const passt = (k) => {
    if (filter === "alle" || !filter) return true;
    if (filter === "personen") return k.typ === "person";
    if (filter === "firmen")   return k.typ === "firma";
    if (k.typ !== "person") return false;
    const rollen = k.rollen || [];
    if (filter === "eigentuemer") return rollen.includes("Eigentümer");
    if (filter === "mieter")      return rollen.includes("Mieter");
    if (filter === "vbeirat")     return rollen.includes("Verwaltungsbeirat");
    return true;
  };

  const updateKontakt = (updated) => {
    if (!setKontakte) return;
    setKontakte(prev => prev.map(c => c.id === updated.id ? updated : c));
  };

  const gefiltert = kontakte.filter(k =>
    passt(k) && kontaktPasstZuArt(k, kontaktart || "alle", arten));
  const aktivK = kontakte.find(k => k.id === aktiv);
  // Wenn ein Rollen-Filter aktiv ist: nur die zur Rolle passende Kategorie zeigen.
  const artDef = arten.find(a => a.id === kontaktart);
  const personenErlaubt = !artDef
    || (artDef.typ === "kategorie" && artDef.id !== "firma")
    || artDef.typ === "rolle_person"
    || kontaktart === "alle" || !kontaktart;
  const firmenErlaubt = !artDef
    || (artDef.typ === "kategorie" && artDef.id !== "person")
    || artDef.typ === "rolle_firma"
    || kontaktart === "alle" || !kontaktart;
  // Mit altem filter-Prop kombinieren
  const altFilterPersonen = filter === "alle" || filter === "personen"
    || ["eigentuemer", "mieter", "vbeirat"].includes(filter) || !filter;
  const altFilterFirmen = filter === "alle" || filter === "firmen" || !filter;
  const zeigePersonen = personenErlaubt && altFilterPersonen;
  const zeigeFirmen   = firmenErlaubt   && altFilterFirmen;

  const anzeige = useKontaktAnzeige();
  const sortSet = { kontakteNameFormat: anzeige.nameFormat };
  // trenneTypen aus (Default): Personen UND Firmen in EINEM Topf, gemeinsam
  // alphabetisch sortiert. trenneTypen an: erst alle Personen, dann alle Firmen
  // (getrennte Listen, alter Modus).
  const trenneTypen = anzeige.trenneTypen === true;
  const personenGef = sortKontakte(gefiltert.filter(k => k.typ === "person"), sortSet);
  const firmenGef   = sortKontakte(gefiltert.filter(k => k.typ === "firma"),   sortSet);
  // Gemischte Liste: nur die Typen, die der Filter aktuell zulässt; rein nach
  // Anzeigename sortiert (gemischt=true schaltet die Firma-vor-Person-Regel ab).
  const gemischtGef = sortKontakte(gefiltert.filter(k =>
    (k.typ === "person" && zeigePersonen) || (k.typ === "firma" && zeigeFirmen)), sortSet, true);

  // Kontakt-Legende: steht in ALLEN Zuständen (auch bei offener Detailkarte),
  // damit man jederzeit nachschlagen kann — analog zur Objekt-Legende.
  // Ausblendbar via settings.legendeKontakte (Prop legendeAn).
  const kontaktLegendeEl = (legendeAn && (personenGef.length > 0 || firmenGef.length > 0)) ? (
    <IconLegende kontakte={[...personenGef, ...firmenGef]} t={t} accent={accent}
      listenAnsicht={listenAnsicht}
      onEinstellen={() => {
        try {
          window.dispatchEvent(new CustomEvent("allesda:goto-einstellungen",
            { detail: { sektion: "kontakte" } }));
        } catch (err) {}
      }}/>
  ) : null;

  // Breite zuerst — wird für das Mobil-Einspalten-Grid gebraucht.
  const windowW = useWindowWidth();
  const istDesktop = windowW >= 900;

  // Karten-Raster der Vollbild-Übersicht — zentral aus kartenGridStyle (§76),
  // damit es identisch zu Objekten/Schnelleingabe läuft (Mobil = 1fr volle
  // Breite). SONDERFALL: festeGridSpec (Desktop, explizit vorgegebene Spalten-
  // Spezifikation) + gridAutoFlow:dense bleibt lokal — das nutzt nur Kontakte.
  const wrapStyle = (!istDesktop || !festeGridSpec)
    ? kartenGridStyle({ einspaltig: !istDesktop, nurMaster: true, kartenMaxBreite: kartenMaxBreite },
        istDesktop ? { gridAutoFlow: "dense" } : null)
    : { ...KACHEL_GRID, gridTemplateColumns: festeGridSpec, gridAutoFlow: "dense" }; // SONDERFALL: feste Spaltenspez (nur Kontakte-Desktop)

  // Master-Detail: linke schmale Spalte mit Karten, rechts Detail
  const hatOffen = aktiv != null && aktivK != null;

  // nurDetail an die App-Ebene melden (Header tauscht +Button ↔ Zurück).
  // Mobil + Detail → immer nurDetail. Kein Detail → nie. Desktop + Detail
  // übernimmt der Baustein (KontakteMasterDetail.onNurDetail), daher hier
  // ausgespart, sonst überschreiben sich beide.
  useEffect(() => {
    if (typeof onNurDetail !== "function") return;
    if (!hatOffen) { onNurDetail(false); return; }
    if (!istDesktop) { onNurDetail(true); return; }
    // Desktop + Detail: Baustein meldet den echten (breitenabhängigen) Zustand.
  }, [hatOffen, istDesktop, onNurDetail]);

  const istListe = listenAnsicht === "liste";
  const renderKontaktItem = (k, aktivId, onClick, kb) => istListe ? (
    <KontaktListenZeile key={k.id} k={k} t={t} accent={accent}
      aktiv={aktivId === k.id} kbItem={kb} id={"kon-" + k.id} onClick={onClick}/>
  ) : (
    <KontaktKarte key={k.id} k={k} t={t} aktiv={aktivId === k.id} kbItem={kb}
      id={"kon-" + k.id} onClick={onClick}/>
  );

  const renderKartenSpalte = (cols, kartenBreite, nurMasterBreite, einspaltig) => {
    const gridStyle = kartenGridStyle({
      einspaltig: einspaltig,
      nurMaster: !kartenBreite,
      cols: cols,
      kartenBreite: kartenBreite,
      kartenMaxBreite: nurMasterBreite,
    }, { alignContent: "start" });
    const alphaTrennerAn = anzeige.alphaTrenner !== false;
    // EINE Gruppe rendern — identisch zur Vollbild-Logik (renderGruppe), nur mit
    // dem Master-Detail-Grid und Toggle-Klick. So gibt es die Buchstaben-Einteilung
    // (A/D/F…) auch bei offenem Detail (Benny-Wunsch: „die Einteilung immer geben").
    const renderGruppeMD = (liste, typ, extraStyle) => {
      const listenWrap = { display: "flex", flexDirection: "column", gap: 6, ...(extraStyle || {}) };
      const rasterStyle = istListe ? listenWrap : { ...gridStyle, ...(extraStyle || {}) };
      const klick = (k) => () => setAktiv(aktiv === k.id ? null : k.id);
      if (!alphaTrennerAn) {
        return (
          <div style={rasterStyle}>
            {liste.map(k => renderKontaktItem(k, aktiv, klick(k), false))}
          </div>
        );
      }
      const sektionen = gruppiereNachBuchstabe(liste, anzeige.nameFormat);
      return (
        <div style={rasterStyle}>
          {sektionen.map(sek => (
            <React.Fragment key={typ + "-" + sek.buchstabe}>
              <KontaktTrenner buchstabe={sek.buchstabe} t={t} accent={accent}/>
              {sek.kontakte.map(k => renderKontaktItem(k, aktiv, klick(k), false))}
            </React.Fragment>
          ))}
        </div>
      );
    };
    return (
    <>
      {trenneTypen ? (
        <>
          {zeigePersonen && personenGef.length > 0 && renderGruppeMD(personenGef, "person")}
          {zeigeFirmen && firmenGef.length > 0 && renderGruppeMD(firmenGef, "firma",
            (zeigePersonen && personenGef.length > 0) ? { marginTop: 12 } : null)}
        </>
      ) : (
        gemischtGef.length > 0 && renderGruppeMD(gemischtGef, "alle")
      )}
    </>
    );
  };

  // Kontakt löschen: aus der Liste entfernen + Detail schließen.
  // Bestätigungs-Dialog erfolgt schon in KDKHeader.
  const deleteKontakt = () => {
    if (!aktivK) return;
    setKontakte(prev => prev.filter(k => k.id !== aktivK.id));
    setAktiv(null);
  };

  if (hatOffen && istDesktop) {
    return (
      <div style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0, minWidth: 0 }}>
      <KbZurueckHook onClick={() => setAktiv(null)}/>
      {kontaktLegendeEl}
      <KontakteMasterDetail
        cardWidth={cardWidth}
        detailMinBreite={detailMinBreite} kartenMaxBreite={kartenMaxBreite} kartenMin={kartenMin} listeOpt={listeOpt}
        kartenSpalten={kartenSpalten}
        listenAnsicht={listenAnsicht}
        renderKartenSpalte={renderKartenSpalte}
        aktivK={aktivK} t={t} accent={accent}
        ves={ves} kontakte={kontakte} setKontakte={setKontakte}
        onVEClick={onVEClick} setAktiv={setAktiv}
        onNurDetail={onNurDetail}
        updateKontakt={updateKontakt}
        onDelete={deleteKontakt}/>
      </div>
    );
  }

  if (hatOffen && !istDesktop) {
    return (
      <DetailMobilScrollTop offenId={aktivK.id} t={t}
        headerSelector="[data-app-fixed-header]" zumAnfang={true}>
        <KbZurueckHook onClick={() => setAktiv(null)}/>
        {/* Zurück-Button sitzt jetzt oben rechts im Sticky-Header (wie in den
            Einstellungen/Objekten); der Bearbeiten-Button im KDK-Header neben
            dem Namen. Daher hier kein separater Zurück-Button mehr. */}
        <div>
          <KontaktDetailKarte k={aktivK} t={t} accent={accent} listenModus={true}
            ves={ves} kontakte={kontakte} setKontakte={setKontakte}
            externEditMode={externEditMode}
            setExternEditMode={setExternEditMode}
            headerOhneEditBtn={mobileDetailHeaderOhneEditBtn}
            onVEClick={onVEClick} onKontaktClick={(id) => setAktiv(id)}
            onUpdate={updateKontakt}
            onDelete={deleteKontakt}/>
        </div>
      </DetailMobilScrollTop>
    );
  }

  const alphaTrennerAn = anzeige.alphaTrenner !== false;
  const renderGruppe = (liste, typ) => {
    // Feste Listenbreite in der Übersicht — EINE Quelle (listeBreiteAus), damit
    // ALLE Übersichts-Listen gleich breit sind (Objekte/Kontakte/Einstellungen/
    // Kalender/ETV/…). Siehe utils-basis.listeBreiteAus.
    const listenWrap = { display: "flex", flexDirection: "column", gap: 6, maxWidth: listeBreiteAus(listeOpt), width: "100%" };
    // Ohne Trenner: ein einziges Karten-Raster (bzw. Liste).
    if (!alphaTrennerAn) {
      return (
        <div style={istListe ? listenWrap : wrapStyle}>
          {liste.map(k => renderKontaktItem(k, null, () => setAktiv(k.id), true))}
        </div>
      );
    }
    // Mit Trenner: Sektionen je Anfangsbuchstabe; Trenner als volle-Breite-Zeile
    // im selben Grid (gridColumn 1/-1), Karten danach normal mehrspaltig.
    const sektionen = gruppiereNachBuchstabe(liste, anzeige.nameFormat);
    return (
      <div style={istListe ? listenWrap : wrapStyle}>
        {sektionen.map(sek => (
          <React.Fragment key={typ + "-" + sek.buchstabe}>
            <KontaktTrenner buchstabe={sek.buchstabe} t={t} accent={accent}/>
            {sek.kontakte.map(k => renderKontaktItem(k, null, () => setAktiv(k.id), true))}
          </React.Fragment>
        ))}
      </div>
    );
  };

  return (
    <div data-ad-scroll="y" style={{ flex: 1, minHeight: 0, overflowY: "auto" }}>
      {/* Aufklappbare Legende — erklärt die genutzten Rollen-Badges, Status & Ring. */}
      {kontaktLegendeEl}
      {/* Kontakte — gemischt (ein Topf) oder nach Typ getrennt, je nach
          Einstellung „Person & Firma getrennt auflisten". */}
      {trenneTypen ? (
        <>
          {zeigePersonen && personenGef.length > 0 && renderGruppe(personenGef, "person")}
          {zeigeFirmen && firmenGef.length > 0 && (
            <div style={{ marginTop: (zeigePersonen && personenGef.length > 0) ? 16 : 0 }}>
              {renderGruppe(firmenGef, "firma")}
            </div>
          )}
        </>
      ) : (
        gemischtGef.length > 0 && renderGruppe(gemischtGef, "alle")
      )}

      {/* Leerer Zustand */}
      {gefiltert.length === 0 && (
        <div style={{ fontSize: FS.l, color: t.sub, textAlign: "center",
          padding: "40px 0", fontStyle: "italic" }}>
          Keine Kontakte für diesen Filter.
        </div>
      )}
    </div>
  );
}


export {
  AktionsButton,
  BeziehungEditor,
  DetailMobilScrollTop,
  KDKHeader,
  KbZurueckHook,
  KontaktDetailKarte,
  KontaktKarte,
  KontakteMasterDetail,
  KontakteScreen,
  NotizenSektion,
  ObjektLegende,
  ObjektPicker,
  RolleZeile,
  getFirmaMitarbeiter
};
