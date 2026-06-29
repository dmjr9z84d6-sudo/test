import React, { useState, useRef, useEffect } from "react";
import { FS, FW, RAD, kartenGridStyle, feldInput, feldLabel, getContrastColor } from "./constants.js";
import { parseDatumWert } from "./utils-basis.js";
import {
  flaecheVon, isStellplatzTyp, istAnonymesMitglied, teileVon
} from "./datenmodell.js";
import {
  DESKTOP_MIN_WIDTH, EinheitOffenContext, I, scrollToCard, useHandlungsbedarf, useKontaktFarbe,
  useLoeschenErlaubt, useObjektTabs, useStatusLeiste, useWindowWidth, veKartenFeldWert
} from "./utils-icons.jsx";
import {
  Avatar, DATUM_MONATE_KURZ, DatumFeld, FeldKontaktKarte, LEGIONELLEN_BEFUNDE,
  LEGIONELLEN_STATUS_FARBE, DetailKopf, DetailRahmen, MasterDetailRahmen, MonatJahrPickerModal, VerwendungenBadges,
  aggregiereObjektVerwendungen, datumAnzeige, legionellenAnsprechpartner,
  legionellenBefund, legionellenFaelligStatus, legionellenFindeEinheit,
  legionellenFindeRaum, legionellenNaechste, legionellenStandorte,
  objektHatZentralesWarmwasser, wjEndeDatum
} from "./components.jsx";
import { restzeitText, sammleTermine, terminEinheitIds } from "./kalender.jsx";
// ╔═════════════════════════════════════════════════════════════════════════╗
// ║ SEKTION 5c · OBJEKT-ÜBERSICHT / -DETAIL — ausgelagertes Modul           ║
// ║ Historie · Statistik · VEKachel · VEDetail · TE-Register · Legionellen  ║
// ╚═════════════════════════════════════════════════════════════════════════╝
// ZYKLISCHER Import aus der Hauptdatei: S5-Kern-Helfer, die hier zur Laufzeit
// (JSX/Callbacks) gebraucht werden. esbuild löst den Zyklus auf.
import { AktionsButton, DetailMobilScrollTop } from "./kontakte-modul.jsx";
import {
  DokumenteAnsicht, LiegenschaftAnsicht, VerwaltungAnsicht,
  eigStufen, feldImKalender, parseYMD
} from "./liegenschaft.jsx";
import { VEKontakteTab, objektBezugInfo } from "./kontakte.jsx";

// ═══════════════════════════════════════════════════════════════════════════
// HISTORIE — personelle Bewegungen + Termine eines Objekts, abgeleitet aus dem
// Bestand (kein eigenes Ereignis-Log): Eigentümer-Stufen/-Ende, Belegungen
// (Einzug/Auszug, vergangen UND geplant), SEV, Verwaltungsbeginn/-ende und
// manuelle Termine. Bauliches/Instandhaltung kommt später dazu.
// ═══════════════════════════════════════════════════════════════════════════
const HISTORIE_TYPEN = [
  { id: "eigentuemer", label: "Eigentümer", kurz: "Eig.",   farbe: "#F472B6", icon: "swap" },
  { id: "belegung",    label: "Belegung",   kurz: "Beleg.", farbe: "#0080FF", icon: "users" },
  { id: "sev",         label: "SEV",        kurz: "SEV",    farbe: "#7C3AED", icon: "calendar" },
  { id: "verwaltung",  label: "Verwaltung", kurz: "Verw.",  farbe: "#F59E0B", icon: "calendar" },
  { id: "termin",      label: "Termine",    kurz: "Term.",  farbe: "#22C55E", icon: "calendar" },
];

// Einheiten kanonisch aus den Liegenschafts-Karten, Fallback ve.einheiten.
function alleEinheitenVonVe(ve) {
  if (!ve) return [];
  var aus = [];
  (ve.karten || []).forEach(function(k) { ((k && k.einheiten) || []).forEach(function(e) { if (e) aus.push(e); }); });
  return aus.length > 0 ? aus : (ve.einheiten || []);
}

function sammleHistorie(ve, kontakte) {
  var out = [];
  var heute = new Date(); heute.setHours(0, 0, 0, 0);
  function nameVonId(kid) {
    var k = (kontakte || []).find(function(x) { return x && x.id === kid; });
    if (!k) return null;
    return k.typ === "firma" ? (k.name || "") : (((k.vorname || "") + " " + (k.nachname || "")).trim() || k.name || "");
  }
  function add(datumWert, typ, titel, einheitId, einheitLabel, personen, kontaktIds, einheitIds) {
    var d = parseDatumWert(datumWert);
    if (!d) return;
    d.setHours(0, 0, 0, 0);
    out.push({
      datum: d,
      iso: d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"),
      typ: typ, titel: titel,
      einheitId: einheitId != null ? einheitId : null,
      einheitIds: Array.isArray(einheitIds) ? einheitIds.slice() : (einheitId != null ? [einheitId] : []),
      einheitLabel: einheitLabel || "",
      personen: personen || [],
      // Verknüpfte Kontakte → kleine Kontaktkarten im aufgeklappten Zustand.
      kontaktIds: (kontaktIds || []).filter(function(x) { return x != null; }),
      zukunft: d.getTime() > heute.getTime(),
    });
  }
  function feldWert(karte, name) {
    if (!karte || !Array.isArray(karte.stamm)) return "";
    var f = null;
    karte.stamm.forEach(function(x) { if (x && x.name === name && !f) f = x; });
    return f ? f : null;
  }
  // ── Verwaltung (kanonisch aus persistierten Karten, Fallback ve.verwaltung) ─
  var vw = ve.verwaltung || {};
  var vk0 = Array.isArray(ve.verwaltungsKarten) ? ve.verwaltungsKarten : [];
  var stammKarte = null;
  vk0.forEach(function(k) { if (k && k.kategorie === "verwaltung_stamm" && !stammKarte) stammKarte = k; });
  var fAb = feldWert(stammKarte, "Verwaltung ab");
  var fBis = feldWert(stammKarte, "Bestellt bis");
  var fVerw = feldWert(stammKarte, "Verwalter (Firma)");
  var verwName = fVerw && fVerw.kontaktId != null ? nameVonId(fVerw.kontaktId)
    : (vw.verwalter != null ? nameVonId(vw.verwalter) : null);
  var verwAb = (fAb && fAb.value) || vw.beginn;
  var verwKid = fVerw && fVerw.kontaktId != null ? fVerw.kontaktId : (vw.verwalter != null ? vw.verwalter : null);
  if (verwAb) add(verwAb, "verwaltung", "Verwaltungsbeginn" + (verwName ? ": " + verwName : ""), null, "", verwName ? [verwName] : [], [verwKid]);
  var verwBis = (fBis && fBis.value) || vw.bestelltBis;
  if (verwBis) {
    var dBis = parseDatumWert(verwBis);
    var endetWort = dBis && dBis.getTime() < heute.getTime() ? "Verwalterbestellung endete" : "Verwalterbestellung endet";
    add(verwBis, "verwaltung", endetWort + (verwName ? ": " + verwName : ""), null, "", verwName ? [verwName] : [], [verwKid]);
  }
  // ── Einheiten: Eigentümer, Belegung, SEV ─
  var einheiten = alleEinheitenVonVe(ve);
  einheiten.forEach(function(einheit) {
    var ehLabel = einheit.bezeichnung || einheit.nr || ("Einheit " + (einheit.id != null ? einheit.id : ""));
    // Eigentümer: alle Stufen mit Datum (vergangen = Geschichte, künftig = geplant)
    (einheit.eigentuemer || []).forEach(function(p) {
      var wer = p.name || (p.kontaktId != null ? nameVonId(p.kontaktId) : null) || "Eigentümer";
      eigStufen(p).forEach(function(st) {
        if (!st.datum) return;
        var label = st.key === "grundbuch" ? "Eigentum (Grundbuch)" : st.label;
        add(st.datum, "eigentuemer", label + ": " + wer, einheit.id, ehLabel, [wer], [p.kontaktId]);
      });
      if (p.bis) add(p.bis, "eigentuemer", "Eigentümer-Ende: " + wer, einheit.id, ehLabel, [wer], [p.kontaktId]);
    });
    // Belegungen: Einzug/Nutzungsbeginn + Auszug — ALLE Belegungen je Teil
    (teileVon(einheit) || []).forEach(function(teil) {
      (teil.belegungen || []).forEach(function(b) {
        if (!b) return;
        var mitglieder = ((b.haushalt && b.haushalt.mitglieder) || [])
          .filter(function(m) { return !istAnonymesMitglied(m); });
        var namen = mitglieder.map(function(m) { return m.name; }).filter(Boolean);
        var mitIds = mitglieder.map(function(m) { return m.kontaktId; });
        var wer2 = namen[0] || (b.typ === "vermietung" ? "Mieter" : "Nutzung");
        if (b.von) add(b.von, "belegung", (b.typ === "vermietung" ? "Einzug" : "Nutzungsbeginn") + ": " + wer2, einheit.id, ehLabel, namen, mitIds);
        if (b.bis) add(b.bis, "belegung", "Auszug: " + wer2, einheit.id, ehLabel, namen, mitIds);
      });
    });
    // SEV: beauftragt / Übergabe / Ende
    (einheit.sev || []).forEach(function(s) {
      if (!s) return;
      var sn = s.name || (s.kontaktId != null ? nameVonId(s.kontaktId) : null) || "SEV";
      if (s.beauftragt) add(s.beauftragt, "sev", "SEV beauftragt: " + sn, einheit.id, ehLabel, [sn], [s.kontaktId]);
      if (s.seit)       add(s.seit,       "sev", "SEV-Übergabe: " + sn,  einheit.id, ehLabel, [sn], [s.kontaktId]);
      if (s.bis)        add(s.bis,        "sev", "SEV-Ende: " + sn,      einheit.id, ehLabel, [sn], [s.kontaktId]);
    });
  });
  // ── Manuelle Termine (gewesene UND kommende) ─
  (ve.termine || []).forEach(function(tm) {
    if (!tm) return;
    var ehIds = terminEinheitIds(tm);
    var ehObjekte = ehIds.map(function(eid) {
      return einheiten.find(function(e) { return e && e.id === eid; });
    }).filter(Boolean);
    var ehL = ehObjekte.length > 0
      ? ehObjekte.map(function(e) { return e.bezeichnung || e.nr || "Einheit"; }).join(", ")
      : "";
    var ehIdErst = ehObjekte.length > 0 ? ehObjekte[0].id : null;
    var namen = (tm.kontaktIds || []).map(nameVonId).filter(Boolean);
    add(tm.datum, "termin", tm.titel || "Termin", ehIdErst, ehL, namen, (tm.kontaktIds || []).slice(), ehIds.slice());
  });
  out.sort(function(a, b) { return b.datum.getTime() - a.datum.getTime(); });
  return out;
}

// Wirtschaftsjahr-Bereich: versatzJahre 0 = laufendes WJ, -1 = letztes WJ.
function wjBereich(wjWert, versatzJahre) {
  var ende = wjEndeDatum(wjWert, new Date());
  ende = new Date(ende.getFullYear() + (versatzJahre || 0), ende.getMonth(), ende.getDate(), 23, 59, 59);
  var beginn = new Date(ende.getFullYear() - 1, ende.getMonth(), ende.getDate());
  beginn.setDate(beginn.getDate() + 1);
  beginn.setHours(0, 0, 0, 0);
  return { von: beginn, bis: ende };
}

// Relative Zeitangabe für Historie: Vergangenheit „vor X Tagen/Monaten/Jahren",
// Zukunft über das vorhandene restzeitText (heute/morgen/in X Tagen).
function historieZeitText(diffTage) {
  if (diffTage >= 0) return restzeitText(diffTage);
  var tage = Math.abs(diffTage);
  if (tage === 1) return "gestern";
  if (tage < 60) return "vor " + tage + " Tagen";
  if (tage < 730) return "vor " + Math.round(tage / 30.44) + " Monaten";
  return "vor " + Math.round(tage / 365.25) + " Jahren";
}

// Aufklappbar im Akkordeon-Muster (eine offen, wie KalenderZeile/DESIGN §21.1):
// zu = kompakte Zeile; auf = Rahmen/Tint im Bereichs-Akzent, voller Titel,
// Beteiligte, Einheit und relative Zeitangabe.
function HistorieZeile({ e, t, accent, offen, onToggle,
  ve = null, kontakte = [], setKontakte = null, onKontaktClick = null }) {
  var typ = HISTORIE_TYPEN.find(function(x) { return x.id === e.typ; }) || HISTORIE_TYPEN[0];
  var d = e.datum;
  var datumStr = String(d.getDate()).padStart(2, "0") + "." + String(d.getMonth() + 1).padStart(2, "0") + "." + d.getFullYear();
  var sub = [e.einheitLabel, e.personen.length > 1 ? e.personen.join(", ") : ""].filter(Boolean).join(" · ");
  var heute = new Date(); heute.setHours(0, 0, 0, 0);
  var diff = Math.round((d.getTime() - heute.getTime()) / 86400000);
  var rf = accent || typ.farbe;
  // Verknüpfte Entitäten für die kleinen Karten (DESIGN §20.3): je Kontakt eine
  // kleine Kontaktkarte, dazu die kleine Einheitskarte (Objekt-Karte wäre hier
  // redundant — wir sind ja schon im Objekt). Namen OHNE Kontakt-Verknüpfung
  // bleiben als Textzeile.
  var verkKontakte = (e.kontaktIds || [])
    .map(function(kid) { return (kontakte || []).find(function(k) { return k && k.id === kid; }); })
    .filter(Boolean);
  var verkEinheitIds = terminEinheitIds(e);
  var verkEinheiten = ve
    ? verkEinheitIds
        .map(function(eid) { return alleEinheitenVonVe(ve).find(function(x) { return x && x.id === eid; }) || null; })
        .filter(Boolean)
    : [];
  var verkEinheit = verkEinheiten.length === 1 ? verkEinheiten[0] : null;
  var verkNamen = verkKontakte.map(function(k) {
    return k.typ === "firma" ? (k.name || "") : (((k.vorname || "") + " " + (k.nachname || "")).trim() || k.name || "");
  });
  var textNamen = (e.personen || []).filter(function(n) { return verkNamen.indexOf(n) < 0; });
  return (
    <div onClick={onToggle}
      style={{ background: offen ? rf + "08" : t.surface,
        border: "1px solid " + (offen ? rf : t.border),
        borderRadius: offen ? RAD.lg : RAD.md, cursor: "pointer",
        opacity: !offen && e.zukunft ? 0.75 : 1,
        transition: "border-color 0.15s" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 13px" }}>
        <div style={{ width: 32, height: 32, borderRadius: RAD.ms, flexShrink: 0,
          background: typ.farbe + "1A", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <I name={typ.icon} size={16} color={typ.farbe}/>
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: FS.m, fontWeight: FW.medium, color: t.text,
            whiteSpace: offen ? "normal" : "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{e.titel}</div>
          {sub && <div style={{ fontSize: FS.s, color: t.sub,
            whiteSpace: offen ? "normal" : "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{sub}</div>}
        </div>
        <div style={{ textAlign: "right", flexShrink: 0 }}>
          <div style={{ fontSize: FS.s, fontWeight: FW.medium, color: t.text }}>{datumStr}</div>
          {e.zukunft && <div style={{ fontSize: FS.xxs, fontWeight: FW.bold, color: typ.farbe,
            textTransform: "uppercase", letterSpacing: "0.05em" }}>geplant</div>}
        </div>
      </div>
      {offen && (
        <div style={{ padding: "0 13px 11px 13px" }} onClick={(ev) => ev.stopPropagation()}>
          {(verkKontakte.length > 0 || verkEinheit || verkEinheiten.length > 1) && (
            <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 9 }}>
              {verkKontakte.map(function(k) {
                return <FeldKontaktKarte key={"k" + k.id} k={k} t={t} accent={rf}
                  kontakte={kontakte} setKontakte={setKontakte}
                  onKontaktClick={onKontaktClick}/>;
              })}
              {verkEinheit && <FeldEinheitKarte ve={ve} einheit={verkEinheit} t={t} accent={rf}/>}
              {!verkEinheit && verkEinheiten.length > 1 &&
                <FeldEinheitenSammelKarte ve={ve} einheiten={verkEinheiten} t={t} accent={rf}/>}
            </div>
          )}
          {textNamen.length > 0 && (
            <div style={{ fontSize: FS.s, color: t.sub, marginBottom: 4 }}>
              {e.typ === "termin" ? "Mit: " : "Beteiligt: "}
              <span style={{ color: t.text, fontWeight: FW.medium }}>{textNamen.join(", ")}</span>
            </div>
          )}
          {e.einheitLabel && !verkEinheit && verkEinheiten.length <= 1 && (
            <div style={{ fontSize: FS.s, color: t.sub, marginBottom: 4 }}>
              Einheit: <span style={{ color: t.text, fontWeight: FW.medium }}>{e.einheitLabel}</span>
            </div>
          )}
          <div style={{ display: "flex", alignItems: "center", gap: 8,
            borderTop: "1px solid " + rf + "25", paddingTop: 9, marginTop: 7 }}>
            <span style={{ fontSize: FS.xs, fontWeight: FW.bold, color: typ.farbe,
              letterSpacing: "0.06em", textTransform: "uppercase" }}>{typ.label}</span>
            <span style={{ flex: 1 }}/>
            <span style={{ fontSize: FS.xs, color: t.muted }}>{historieZeitText(diff)}</span>
          </div>
        </div>
      )}
    </div>
  );
}

function HistorieAnsicht({ ve, kontakte, t, accent, setKontakte = null, onKontaktClick = null }) {
  const [typFilter, setTypFilter] = useState("alle");
  // Zeitraum: "alle" | "wj0" (laufendes WJ) | "wj1" (letztes WJ) | "frei"
  const [zeitraum, setZeitraum] = useState("alle");
  const [freiVon, setFreiVon] = useState("");   // "YYYY-MM"
  const [freiBis, setFreiBis] = useState("");   // "YYYY-MM"
  const [einheitFilter, setEinheitFilter] = useState("alle");
  // Welcher Monat/Jahr-Picker ist offen: "von" | "bis" | null.
  const [mjPicker, setMjPicker] = useState(null);
  // Akkordeon: nur EIN Eintrag gleichzeitig aufgeklappt (DESIGN §21.1).
  const [offenKey, setOffenKey] = useState(null);
  const wjWert = (ve.etvStamm && ve.etvStamm.wirtschaftsjahr) || "Kalenderjahr";
  const einheiten = alleEinheitenVonVe(ve);
  const alle = sammleHistorie(ve, kontakte);

  // Zeitraum-Grenzen bestimmen (Monat/Jahr-genau bei freier Auswahl).
  let von = null, bis = null;
  if (zeitraum === "wj0" || zeitraum === "wj1") {
    const b = wjBereich(wjWert, zeitraum === "wj0" ? 0 : -1);
    von = b.von; bis = b.bis;
  } else if (zeitraum === "frei") {
    if (freiVon) { const p = freiVon.split("-"); von = new Date(Number(p[0]), Number(p[1]) - 1, 1); }
    if (freiBis) { const p2 = freiBis.split("-"); bis = new Date(Number(p2[0]), Number(p2[1]), 0, 23, 59, 59); }
  }
  const gefiltert = alle.filter(e => {
    if (typFilter !== "alle" && e.typ !== typFilter) return false;
    if (einheitFilter !== "alle") {
      const ids = terminEinheitIds(e);
      if (!ids.some(x => String(x) === String(einheitFilter))) return false;
    }
    if (von && e.datum.getTime() < von.getTime()) return false;
    if (bis && e.datum.getTime() > bis.getTime()) return false;
    return true;
  });
  const counts = { alle: alle.length };
  HISTORIE_TYPEN.forEach(ty => { counts[ty.id] = alle.filter(e => e.typ === ty.id).length; });
  const aktiveTypen = HISTORIE_TYPEN.filter(ty => counts[ty.id] > 0).map(ty => ty.id);

  // Gruppierung nach Jahr (neueste zuerst — Reihenfolge folgt der Sortierung).
  const jahre = [];
  const proJahr = {};
  gefiltert.forEach(e => {
    const j = e.datum.getFullYear();
    if (!proJahr[j]) { proJahr[j] = []; jahre.push(j); }
    proJahr[j].push(e);
  });

  const wjChip = (id, label) => (
    <button onClick={() => setZeitraum(zeitraum === id ? "alle" : id)}
      style={{ padding: "5px 10px", borderRadius: RAD.pill, cursor: "pointer", fontFamily: "inherit",
        fontSize: FS.xs, fontWeight: FW.bold,
        background: zeitraum === id ? accent + "22" : "transparent",
        border: `1px solid ${zeitraum === id ? accent : t.border}`,
        color: zeitraum === id ? accent : t.sub }}>
      {label}
    </button>
  );
  // Anzeige "Mär 2026" für "YYYY-MM"; Auswahl über den Rad-Picker
  // (MonatJahrPickerModal — gleiche Bausteine wie der Datums-Picker überall).
  const monatAnzeige = (wert) => {
    const m = String(wert || "").match(/^(\d{4})-(\d{1,2})$/);
    return m ? DATUM_MONATE_KURZ[parseInt(m[2], 10) - 1] + " " + m[1] : "";
  };
  const monatTrigger = (wert, platzhalter, oeffnen) => (
    <button onClick={oeffnen} type="button"
      style={{ flex: 1, minWidth: 0, boxSizing: "border-box", display: "flex",
        alignItems: "center", gap: 6, background: t.surface,
        border: `1px solid ${t.border}`, borderRadius: RAD.sm, padding: "8px 10px",
        fontSize: 16, color: wert ? t.text : t.muted, cursor: "pointer",
        fontFamily: "inherit", textAlign: "left" }}>
      <I name="calendar" size={13} color={wert ? accent : t.muted}/>
      <span style={{ flex: 1 }}>{monatAnzeige(wert) || platzhalter}</span>
    </button>
  );

  return (
    <div>
      {/* Filterleiste: Typ-Chips, Zeitraum (Wirtschaftsjahr / frei), Einheit */}
      <div style={{ background: t.card, border: `1px solid ${t.border}`,
        borderRadius: RAD.lg, padding: "12px 14px", marginBottom: 14 }}>
        <FilterButtons arten={HISTORIE_TYPEN} aktive={aktiveTypen}
          counts={counts} wert={typFilter} onWert={setTypFilter}
          t={t} accent={accent} ohneAlle={false}/>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 10, alignItems: "center" }}>
          {wjChip("wj0", "Aktuelles WJ")}
          {wjChip("wj1", "Letztes WJ")}
          {wjChip("frei", "Zeitraum…")}
          {einheiten.length > 0 && (
            <select value={einheitFilter} onChange={e => setEinheitFilter(e.target.value)}
              style={{ ...feldInput(t), width: "auto", flex: "1 1 140px", minWidth: 120 }}>
              <option value="alle">Alle Einheiten</option>
              {einheiten.map(e => (
                <option key={e.id} value={e.id}>{e.bezeichnung || e.nr || ("Einheit " + e.id)}</option>
              ))}
            </select>
          )}
        </div>
        {zeitraum === "frei" && (
          <div style={{ display: "flex", gap: 8, marginTop: 8, alignItems: "center" }}>
            {monatTrigger(freiVon, "Von (Monat)", () => setMjPicker("von"))}
            <span style={{ color: t.muted, fontSize: FS.s }}>bis</span>
            {monatTrigger(freiBis, "Bis (Monat)", () => setMjPicker("bis"))}
          </div>
        )}
        {mjPicker && (
          <MonatJahrPickerModal t={t} accent={accent}
            titel={mjPicker === "von" ? "Von — Monat & Jahr" : "Bis — Monat & Jahr"}
            startWert={mjPicker === "von" ? freiVon : freiBis}
            onConfirm={(v) => {
              if (mjPicker === "von") setFreiVon(v); else setFreiBis(v);
              setMjPicker(null);
            }}
            onClose={() => setMjPicker(null)}/>
        )}
      </div>
      {gefiltert.length === 0 && (
        <div style={{ fontSize: FS.m, color: t.muted, fontStyle: "italic", textAlign: "center", padding: "18px 0" }}>
          Keine Ereignisse im gewählten Zeitraum.
        </div>
      )}
      {jahre.map(j => (
        <div key={j} style={{ marginBottom: 16 }}>
          <div style={{ fontSize: FS.s, fontWeight: FW.bold, color: t.sub,
            letterSpacing: "0.04em", marginBottom: 8 }}>{j}</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {proJahr[j].map((e, i) => {
              const k = e.iso + "|" + e.typ + "|" + e.titel;
              return (
                <HistorieZeile key={j + "-" + i} e={e} t={t} accent={accent}
                  ve={ve} kontakte={kontakte} setKontakte={setKontakte}
                  onKontaktClick={onKontaktClick}
                  offen={offenKey === k}
                  onToggle={() => setOffenKey(offenKey === k ? null : k)}/>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}


// ═══════════════════════════════════════════════════════════════════════════
// STATISTIK — Kennzahlen-Dashboard über den gesamten Bestand: KPI-Kacheln,
// Belegungs-Balken, Verteilungen (Verwaltungsart, Ort, Rollen) und Fristen.
// Alles live aus den Daten abgeleitet, keine eigene Persistenz.
// ═══════════════════════════════════════════════════════════════════════════
const STAT_WOHN_TYPEN = ["Wohneigentum", "Teileigentum", "Gewerbe"];

function StatKpi({ wert, label, sub, farbe, t }) {
  return (
    <div style={{ background: t.card, border: `1px solid ${t.border}`,
      borderRadius: RAD.lg, padding: "13px 14px", minWidth: 0 }}>
      <div style={{ fontSize: 26, fontWeight: FW.heavy, color: farbe, lineHeight: 1.1 }}>{wert}</div>
      <div style={{ fontSize: FS.s, fontWeight: FW.medium, color: t.text, marginTop: 3 }}>{label}</div>
      {sub && <div style={{ fontSize: FS.xs, color: t.muted, marginTop: 1 }}>{sub}</div>}
    </div>
  );
}

function StatPanel({ titel, children, t }) {
  return (
    <div style={{ background: t.card, border: `1px solid ${t.border}`,
      borderRadius: RAD.lg, padding: "13px 14px", marginBottom: 12 }}>
      <div style={{ fontSize: FS.xs, fontWeight: FW.bold, color: t.muted,
        textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 10 }}>{titel}</div>
      {children}
    </div>
  );
}

function StatBalkenZeile({ label, wert, max, farbe, t, suffix = "" }) {
  const pct = max > 0 ? Math.round((wert / max) * 100) : 0;
  return (
    <div style={{ marginBottom: 8 }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 3 }}>
        <span style={{ flex: 1, minWidth: 0, fontSize: FS.s, color: t.text,
          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{label}</span>
        <span style={{ fontSize: FS.s, fontWeight: FW.bold, color: t.text }}>{wert}{suffix}</span>
      </div>
      <div style={{ height: 6, borderRadius: RAD.pill, background: t.border, overflow: "hidden" }}>
        <div style={{ width: pct + "%", height: "100%", background: farbe, borderRadius: RAD.pill }}/>
      </div>
    </div>
  );
}

// ── Listen/Druck-Tools ausgelagert → ./listen-tools.jsx ──
import { druckeHtml, SchnelleingabeScreen, ListenGeneratorScreen, StatistikScreen } from "./listen-tools.jsx";

function berechneKontaktStatus(k, inhalte) {
  // Auf Mitternacht normalisieren: die Zieldaten (parseYMD) sind Mitternacht —
  // mit Uhrzeit in „heute" rundete tagsDiffMS nachmittags einen Tag zu wenig.
  var heute = new Date(); heute.setHours(0, 0, 0, 0);
  var allZuw = k.objektZuweisungen || [];
  var hatWerd  = allZuw.some(function(z) { return z.status === "werdend"; });
  var hatAktiv = allZuw.some(function(z) { return (z.status || "aktiv") === "aktiv"; });
  var hatEhem  = allZuw.some(function(z) { return z.status === "ehemalig"; });
  // Jahrestage (alle Datum-Felder)
  if (inhalte.geburtstag !== false) {
    var datumFelder = (k.customFelder || []).filter(function(f) { return f.typ === "date" && f.wert; });
    var best = null;
    datumFelder.forEach(function(f) {
      var d = datumsTagMon(f.wert);
      if (!d) return;
      var jetzt = heute.getFullYear();
      var naechstes = new Date(jetzt, d.monat - 1, d.tag);
      if (naechstes < heute) naechstes = new Date(jetzt + 1, d.monat - 1, d.tag);
      var diff = Math.round((naechstes - heute) / 86400000);
      var ges = new Date(heute); ges.setDate(ges.getDate() - 1);
      var warGestern = d.tag === ges.getDate() && d.monat === ges.getMonth() + 1;
      var sortWert = warGestern ? -1 : diff;
      if (best === null || sortWert < best.sortWert)
        best = { f: f, diff: diff, warGestern: warGestern, sortWert: sortWert };
    });
    if (best) {
      var label = best.f.name || "Datum";
      if (best.warGestern) return { typ: "info", text: "\uD83D\uDCC5 Gestern: " + label };
      if (best.diff === 0) return { typ: "info", text: "\uD83D\uDCC5 Heute: " + label + "!" };
      if (best.diff === 1) return { typ: "info", text: "\uD83D\uDCC5 Morgen: " + label };
      if (best.diff <= 7)  return { typ: "info", text: "\uD83D\uDCC5 " + label + " in " + best.diff + " Tagen" };
    }
  }
  // Bewegungen rollen-spezifisch: Wohn-Rollen → Einzug/Auszug, Eigentümer →
  // Kauf/Verkauf, sonstige Rollen → generisch „Zuweisung beginnt/endet".
  // Je Kategorie eigener Einstellungs-Schalter; nächstliegendes Ereignis zählt.
  var WOHN_ROLLEN = ["Mieter", "Pächter", "Eigennutzer", "Nießbraucher", "Wohnberechtigt", "Angehöriger", "Sonstige"];
  var bewegungen = [];
  allZuw.forEach(function(z) {
    var rolle = z.rolle || "";
    var istWohn = WOHN_ROLLEN.indexOf(rolle) >= 0;
    var istEig = rolle === "Eigentümer";
    var key = istWohn ? "einzugAuszug" : istEig ? "eigentumswechsel" : "zuweisungAblauf";
    if (inhalte[key] === false) return;
    var suffix = (!istWohn && !istEig && rolle) ? " (" + rolle + ")" : "";
    if ((z.status || "aktiv") === "werdend") {
      var von = parseYMD(z.von);
      if (von) {
        var dv = tagsDiffMS(heute, von);
        if (dv >= 0 && dv <= 30) bewegungen.push({ diff: dv, warnAb: 7,
          wort: istWohn ? "Einzug" : istEig ? "Wird Eigentümer" : "Zuweisung beginnt",
          suffix: suffix });
      }
    }
    var bis = parseYMD(z.bis);
    if (bis) {
      var db = tagsDiffMS(heute, bis);
      if (db >= 0 && db <= 60) bewegungen.push({ diff: db, warnAb: 14,
        wort: istWohn ? "Auszug" : istEig ? "Verkauf" : "Zuweisung endet",
        suffix: suffix });
    }
  });
  if (bewegungen.length > 0) {
    var bw = bewegungen[0];
    bewegungen.forEach(function(x) { if (x.diff < bw.diff) bw = x; });
    var wann = bw.diff === 0 ? " heute" : bw.diff === 1 ? " morgen" : " in " + bw.diff + " Tagen";
    return { typ: bw.diff <= bw.warnAb ? "warn" : "info", text: bw.wort + wann + bw.suffix };
  }
  // Fallback: werdende Zuweisung ohne (nahes) Datum.
  if (hatWerd) return { typ: "info", text: "Eigent\u00FCmerwechsel in Vorbereitung" };
  if (inhalte.ehemaligHinweis !== false && hatEhem && !hatAktiv)
    return { typ: "done", text: "Keine aktiven Beteiligungen" };
  return null;
}

function StatusLeiste({ typ, text, t, borderColor, eingebettet = false }) {
  const F = {
    ok:    "#10B981",
    info:  "#3B82F6",
    warn:  "#F59E0B",
    error: "#EF4444",
    done:  t.muted,
  };
  const farbe = typ && F[typ] ? F[typ] : t.muted;
  const bc = borderColor || t.border;
  return (
    <div style={{
      borderLeft:   eingebettet ? "none" : `1px solid ${bc}`,
      borderRight:  eingebettet ? "none" : `1px solid ${bc}`,
      borderBottom: eingebettet ? "none" : `1px solid ${bc}`,
      borderTop:    `1px solid ${t.border}`,
      borderRadius: eingebettet ? 0 : "0 0 12px 12px",
      background: t.card, color: farbe,
      padding: "0 12px", height: 26, boxSizing: "border-box",
      fontSize: FS.xs, fontWeight: FW.bold, letterSpacing: "0.02em",
      display: "flex", alignItems: "center", gap: 6,
      overflow: "hidden", whiteSpace: "nowrap",
    }}>
      <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>
        {text || "\u00A0"}
      </span>
    </div>
  );
}

// ── FilterButtons ───────────────────────────────────────────────────────────
// Generische horizontale Button-Leiste mit "Alle" + benutzerdefinierten Arten.
// Bei wenig Platz (Mobile-Hochkant) horizontal scrollbar — wie das Dashboard.
// Jeder Button zeigt das Label und (optional) den Count in einer kleinen Pille.
//
// arten:    Array { id, label, kurz } – alle möglichen Arten
// aktive:   Array<string>             – IDs, die als Buttons sichtbar sein sollen
// counts:   Object { id -> number }   – Anzahlen pro Art (für die Pille)
// wert:     "alle" oder eine art-id   – aktueller Filter
// onWert:   (id) => void
// ohneAlle: kein "Alle"-Button; stattdessen Toggle: erneutes Klicken auf den
//           aktiven Button setzt zurück auf "alle".
function FilterButtons({ arten, aktive, counts, wert, onWert, t, accent, ohneAlle = false }) {
  const sichtbar = arten.filter(a => (aktive || []).includes(a.id));
  if (sichtbar.length === 0) return null;
  const total = Object.values(counts || {}).reduce((a, b) => a + b, 0);
  const Btn = ({ id, label, count }) => {
    const aktiv = wert === id;
    const klick = () => {
      if (ohneAlle && aktiv) onWert("alle");
      else onWert(id);
    };
    return (
      <button onClick={klick} style={{
        display: "inline-flex", alignItems: "center", gap: 6,
        padding: "4px 10px", borderRadius: RAD.pill, flexShrink: 0,
        fontSize: FS.s, fontWeight: aktiv ? 700 : 500, fontFamily: "inherit",
        background: aktiv ? accent + "22" : "transparent",
        border: `1px solid ${aktiv ? accent + "80" : t.border}`,
        color: aktiv ? accent : t.sub, cursor: "pointer",
        whiteSpace: "nowrap",
      }}>
        <span>{label}</span>
        {typeof count === "number" && (
          <span style={{ fontSize: FS.xs, fontWeight: FW.bold,
            padding: "1px 6px", borderRadius: RAD.pill,
            background: aktiv ? accent + "33" : t.border + "60",
            color: aktiv ? accent : t.muted }}>{count}</span>
        )}
      </button>
    );
  };
  return (
    <>
      <style>{`.ad-filter-scroll::-webkit-scrollbar{display:none}`}</style>
      <div className="ad-filter-scroll" style={{
        display: "flex", flexWrap: "nowrap", gap: 6,
        overflowX: "auto", overflowY: "hidden",
        scrollbarWidth: "none", msOverflowStyle: "none",
        WebkitOverflowScrolling: "touch",
        flex: "0 1 auto", minWidth: 0,
      }}>
        {!ohneAlle && <Btn id="alle" label="Alle" count={total}/>}
        {sichtbar.map(a => <Btn key={a.id} id={a.id} label={a.kurz} count={counts[a.id] || 0}/>)}
      </div>
    </>
  );
}

// ── EinheitKachel (eine Wohneinheit / ein Stellplatz innerhalb einer VE) ────
// Wird verwendet, wenn eine Person/Firma einer konkreten Einheit zugewiesen
// ist — die Karte zeigt dann die WE statt des kompletten Objekts.
function EinheitKachel({ ve, einheit, t, accent, onClick, id, ohneRahmen = false }) {
  if (!ve || !einheit) return null;
  const istSP = isStellplatzTyp(einheit.typ);
  // Adresse-Splitting wie in VEKachel
  const adrTeile = (ve.adresse || "").split(",").map(s => s.trim());
  const strasse = adrTeile[0] || "";
  let ort = "";
  if (adrTeile[1]) {
    const m = adrTeile[1].match(/^\d{4,5}\s+(.+)$/);
    ort = m ? m[1] : adrTeile[1];
  }
  return (
    <div onClick={onClick} id={id} style={{
      cursor: "pointer", transition: "all 0.15s", scrollMarginTop: "var(--ad-header-h, 200px)" }}
      onMouseEnter={e => { e.currentTarget.style.transform = "translateY(-1px)"; }}
      onMouseLeave={e => { e.currentTarget.style.transform = "none"; }}>
      <div style={{
        display: "flex", alignItems: "center", gap: 12,
        padding: "10px 12px", boxSizing: "border-box",
        background: t.card, color: t.text,
        border: ohneRahmen ? "none" : `1px solid ${t.border}`, borderRadius: ohneRahmen ? 0 : RAD.lg }}>
        {/* Links: Icon im 48px-Wrapper, konsistent mit VEKachel */}
        <div style={{ width: 48, flexShrink: 0, display: "flex",
          alignItems: "center", justifyContent: "center" }}>
          <div style={{ width: 38, height: 38, borderRadius: RAD.md,
            background: accent + "18", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <I name={istSP ? "building" : "home"} size={18} color={accent}/>
          </div>
        </div>
        {/* Mitte: WEG · Einheit + Adresse + Lage */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: FS.l, fontWeight: FW.heavy, color: accent,
            overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {ve.nr} · {einheit.nr}
          </div>
          <div style={{ fontSize: FS.s, color: t.sub, marginTop: 1,
            overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {strasse || "\u00A0"}
          </div>
          <div style={{ fontSize: FS.s, color: t.sub,
            overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {einheit.lage || ort || "\u00A0"}
          </div>
        </div>
        {/* Rechts: Größe + Zimmer / Status */}
        <div style={{ fontSize: FS.s, color: t.sub, whiteSpace: "nowrap", flexShrink: 0,
          textAlign: "right" }}>
          {istSP ? (
            <span>{einheit.spStellung === "se_bestandteil" ? "SE-Bestandteil"
              : (einheit.spStellung === "ge_snr" ? "GE + SNR"
              : (einheit.spStellung === "eigenstaendig" ? "Teileigentum"
              : "Stellplatz"))}</span>
          ) : (
            <>
              {einheit.flaeche && <strong style={{ color: t.text }}>{einheit.flaeche}</strong>}
              {einheit.zimmer && <> · {einheit.zimmer} Zi</>}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ── VEKachel (Objekt-Vorschaukachel) ────────────────────────────────────────
// ── Handlungsbedarf-Ampel eines Objekts ─────────────────────────────────────
// Der Status-Punkt an Objekten zeigt den Gesamt-Handlungsbedarf, abgeleitet
// aus allen Terminen/Fristen des Objekts (sammleTermine als SSoT):
//   · rot   = mindestens eine relevante Frist ist überfällig (muss)
//   · gelb  = mindestens eine Frist innerhalb ihrer Vorlaufzeit (kann)
//   · grün  = sonst (alles ok)
// Welche Termin-Typen zählen (quellen) und ab wann Gelb greift (vorlauf, in
// Tagen) ist pro Typ einstellbar (Einstellungen → Erscheinungsbild). Defaults:
// echte Fristen aktiv mit fachlichen Vorlaufzeiten; Wechsel/SEV/Termine aus.
// Jahrestage sind kontaktbezogen (objektId=null) und zählen hier NIE.
const HANDLUNGSBEDARF_QUELLEN = [
  { id: "verwaltung",  label: "Verwalterbestellung & Verwaltungs-Fristen", vorlauf: 180, default: true },
  { id: "wahl",        label: "Verwalterwahl",                             vorlauf: 180, default: true },
  { id: "etv",         label: "Eigentümerversammlung (ETV)",              vorlauf: 60,  default: true },
  { id: "vertrag",     label: "Verträge / Versicherungen / Versorger",    vorlauf: 90,  default: true },
  { id: "technik",     label: "Technik-Wartung & -Fristen",               vorlauf: 30,  default: true },
  { id: "eigentuemer", label: "Eigentümerwechsel",                        vorlauf: 30,  default: false },
  { id: "belegung",    label: "Belegungswechsel (Ein-/Auszug)",           vorlauf: 30,  default: false },
  { id: "sev",         label: "SEV-Wechsel",                              vorlauf: 30,  default: false },
  { id: "termin",      label: "Manuelle Termine",                         vorlauf: 14,  default: false },
];
const HANDLUNGSBEDARF_FARBEN = { gruen: "#22C55E", gelb: "#F59E0B", rot: "#EF4444" };

function hbQuelleAktiv(cfg, typId) {
  const q = (cfg && cfg.quellen) || {};
  if (q[typId] !== undefined) return q[typId];
  const def = HANDLUNGSBEDARF_QUELLEN.find(x => x.id === typId);
  return def ? def.default : false;
}
function hbVorlauf(cfg, typId) {
  const v = (cfg && cfg.vorlauf) || {};
  if (v[typId] != null && v[typId] !== "") return Number(v[typId]);
  const def = HANDLUNGSBEDARF_QUELLEN.find(x => x.id === typId);
  return def ? def.vorlauf : 30;
}
// Liefert "rot" | "gelb" | "gruen". Termine werden nach Quelle (Typ+Titel)
// gruppiert: Gibt es zu einer Quelle ein KOMMENDES Vorkommen, gelten vergangene
// als erledigt (wiederkehrende Wartung/ETV) — nur das nächste zählt gegen die
// Vorlaufzeit (gelb). Sind ALLE Vorkommen einer Quelle vergangen, ist es eine
// echte abgelaufene Deadline (rot). Rückblick 24 Monate fängt alte Stichtage,
// Vorblick 12 Monate die kommenden. Ohne Kontakte → nur objektbezogene Fristen.
function objektHandlungsbedarfDetail(ve, cfg) {
  if (!ve) return { farbe: "gruen", text: null };
  const termine = sammleTermine([ve], [], 12, 24).filter(tm =>
    tm && hbQuelleAktiv(cfg, tm.typ)
    // Reine Beginn-/Start-Ereignisse sind keine offenen Deadlines (ein Vertrag,
    // der vor Jahren begann und läuft, ist kein Handlungsbedarf). Nur Enden,
    // Fristen, Wartungsfälligkeiten und Termine zählen.
    && String(tm.titel || "").indexOf(" beginnt") < 0
    && String(tm.titel || "").indexOf("beginn") < 0);
  const gruppen = {};
  termine.forEach(tm => {
    const key = tm.typ + "|" + tm.titel;
    if (!gruppen[key]) gruppen[key] = [];
    gruppen[key].push(tm);
  });
  // Dringlichsten roten (am längsten überfällig) bzw. gelben (am nächsten
  // kommend) Auslöser ermitteln — für Punkt-Farbe UND Leisten-Text.
  let rotKand = null, gelbKand = null;
  Object.keys(gruppen).forEach(key => {
    const liste = gruppen[key];
    const kommend = liste.filter(x => x.diff >= 0).sort((a, b) => a.diff - b.diff);
    if (kommend.length > 0) {
      // Es gibt ein kommendes Vorkommen — vergangene zählen als erledigt.
      const naechst = kommend[0];
      if (naechst.diff <= hbVorlauf(cfg, naechst.typ)) {
        if (!gelbKand || naechst.diff < gelbKand.diff) {
          gelbKand = { titel: naechst.titel, diff: naechst.diff };
        }
      }
    } else {
      // Alle Vorkommen vergangen → echte abgelaufene Deadline. Jüngstes (größter
      // diff < 0) ist die maßgebliche Frist; Tage seither = Math.abs.
      const vergangen = liste.slice().sort((a, b) => b.diff - a.diff);
      const tage = Math.abs(vergangen[0].diff);
      if (!rotKand || tage > rotKand.tage) {
        rotKand = { titel: vergangen[0].titel, tage: tage };
      }
    }
  });
  if (rotKand) {
    const tg = rotKand.tage === 0 ? "heute fällig"
      : rotKand.tage === 1 ? "seit gestern überfällig"
      : "seit " + rotKand.tage + " Tagen überfällig";
    return { farbe: "rot", text: (rotKand.titel || "Frist") + " — " + tg };
  }
  if (gelbKand) {
    const tg = gelbKand.diff === 0 ? "heute"
      : gelbKand.diff === 1 ? "morgen" : "in " + gelbKand.diff + " Tagen";
    return { farbe: "gelb", text: (gelbKand.titel || "Frist") + " " + tg };
  }
  return { farbe: "gruen", text: null };
}
function objektHandlungsbedarf(ve, cfg) {
  return objektHandlungsbedarfDetail(ve, cfg).farbe;
}

// ── VEListenZeile (kompakte Listenansicht eines Objekts, DESIGN §35) ────────
// Eine schmale, scannbare Zeile statt der Kachel: Status-Punkt · WEG-Nr ·
// Adresse · Einheiten-Zahl. Tippen klappt dasselbe Detail auf wie die Kachel.
function VEListenZeile({ ve, t, accent, onClick, aktiv = false, id, kbItem = false, auswahlAccentOverride = null }) {
  const auswahlAccent = auswahlAccentOverride || useKontaktFarbe().auswahlObjekt || accent;
  const hbCfg = useHandlungsbedarf();
  const statusLeisteSettings = useStatusLeiste();
  // Der Listen-Punkt zeigt denselben Handlungsbedarf wie die Karten-Statusleiste
  // und hängt am selben Schalter (statusLeisteObjekt). Aus → kein Punkt.
  const zeigePunkt = statusLeisteSettings.objekt;
  const wohn = (ve.einheiten || []).filter(e => ["Wohneigentum","Teileigentum","Gewerbe"].includes(e.typ)).length;
  const sp = (ve.einheiten || []).filter(e => isStellplatzTyp(e.typ)).length;
  // Status-Punkt: Gesamt-Handlungsbedarf (rot=muss, gelb=kann, grün=ok).
  const punkt = HANDLUNGSBEDARF_FARBEN[objektHandlungsbedarf(ve, hbCfg)] || HANDLUNGSBEDARF_FARBEN.gruen;
  const nr = ve.nr || ve.name || ("Objekt " + ve.id);
  const adrTeile = (ve.adresse || "").split(",").map(s => s.trim());
  const strasse = adrTeile[0] || "";
  let ort = "";
  if (adrTeile[1]) { const m = adrTeile[1].match(/^\d{4,5}\s+(.+)$/); ort = m ? m[1] : adrTeile[1]; }
  const adrText = [strasse, ort].filter(Boolean).join(", ");
  const einheitenText = [wohn > 0 ? wohn + " EH" : null, sp > 0 ? sp + " SP" : null].filter(Boolean).join(" · ");
  const kbProps = kbItem ? { "data-kb-item": "1" } : {};
  return (
    <div onClick={onClick} id={id} {...kbProps}
      style={{ display: "flex", alignItems: "center", gap: 10,
        padding: "10px 12px", cursor: "pointer", boxSizing: "border-box",
        background: aktiv ? auswahlAccent + "12" : t.card,
        border: `1px solid ${aktiv ? auswahlAccent : t.border}`,
        borderRadius: RAD.md }}>
      {zeigePunkt && (
        <span style={{ width: 9, height: 9, borderRadius: 5, flexShrink: 0,
          background: punkt }}/>
      )}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 8, minWidth: 0 }}>
          <span style={{ fontSize: FS.m, fontWeight: FW.bold, color: t.text,
            flexShrink: 0 }}>{nr}</span>
          <span style={{ fontSize: FS.s, color: t.sub, overflow: "hidden",
            textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{adrText}</span>
        </div>
      </div>
      {einheitenText ? (
        <span style={{ fontSize: FS.xs, color: t.muted, flexShrink: 0,
          whiteSpace: "nowrap" }}>{einheitenText}</span>
      ) : null}
    </div>
  );
}

function VEKachel({ ve, t, accent, onClick, ohneStatus = false, aktiv = false, id, kompakt = false, ohneRahmen = false, kbItem = false, auswahlAccentOverride = null }) {
  const statusLeisteSettings = useStatusLeiste();
  const hbCfg = useHandlungsbedarf();
  // Auswahl-Hervorhebung: im Mehr-Farbe-Modus die Objekt-Bereichsfarbe,
  // im Graumodus der System-Akzent (bleibt farbig). Siehe auswahlObjekt.
  // Override erlaubt z. B. im Kalender die Kalenderfarbe.
  const auswahlAccent = auswahlAccentOverride || useKontaktFarbe().auswahlObjekt || accent;
  const wohneinheiten = ve.einheiten.filter(e => ["Wohneigentum","Teileigentum","Gewerbe"].includes(e.typ));
  const stellplaetze  = ve.einheiten.filter(e => isStellplatzTyp(e.typ));
  let tagesBis = null;
  if (ve.verwaltung.bestelltBis) {
    const parts = ve.verwaltung.bestelltBis.split(".");
    if (parts.length === 3) {
      const d = new Date(parts[2] + "-" + parts[1] + "-" + parts[0]);
      tagesBis = Math.round((d - new Date()) / (1000 * 60 * 60 * 24));
    }
  }
  // Kanonische Quellen (persistierte Karten vor ve.verwaltung) + neue Inhalte.
  const stInhalte = statusLeisteSettings.inhalte || {};
  const stHeute = new Date(); stHeute.setHours(0, 0, 0, 0);
  const stTage = (wert) => {
    const d = parseDatumWert(wert);
    return d ? Math.round((d.getTime() - stHeute.getTime()) / 86400000) : null;
  };
  const bestelltKanon = veKartenFeldWert(ve, "verwaltung_stamm", "Bestellt bis");
  if (bestelltKanon) tagesBis = stTage(bestelltKanon);
  const etvTage = stTage(veKartenFeldWert(ve, "etv", "Nächste ETV")
    || (ve.verwaltung && ve.verwaltung.naechsteETV));
  const begehungTage = stTage(veKartenFeldWert(ve, "verwaltung_stamm", "Nächste Begehung"));
  let terminTage = null, terminTitel = "";
  (ve.termine || []).forEach(tm => {
    const dT = tm ? stTage(tm.datum) : null;
    if (dT === null || dT < 0) return;
    if (terminTage === null || dT < terminTage) { terminTage = dT; terminTitel = tm.titel || "Termin"; }
  });
  const inTagenText = (n) => n === 0 ? "heute" : n === 1 ? "morgen" : "in " + n + " Tagen";

  // Adresse in 2 Zeilen splitten, PLZ entfernen
  const adrTeile = (ve.adresse || "").split(",").map(s => s.trim());
  const strasse = adrTeile[0] || "";
  // Name als Unterzeile (Beschreibung unter der VE-Nr). Leer → keine Zeile.
  // Nur zeigen, wenn er sich von der angezeigten Nr unterscheidet (sonst doppelt).
  const veName = (ve.name && ve.name !== ve.nr) ? ve.name : "";
  let ort = "";
  if (adrTeile[1]) {
    const m = adrTeile[1].match(/^\d{4,5}\s+(.+)$/);
    ort = m ? m[1] : adrTeile[1];
  }

  // Status-Leiste: nutzt jetzt dieselbe Handlungsbedarf-Auswertung wie der
  // Punkt in der Liste (eine Einstellung für beides). Gelb/Rot zeigen den
  // dringlichsten Auslöser als Text; Grün blendet die Leiste aus.
  // Rot → "error"-Farbe (#EF4444), Gelb → "warn"-Farbe (#F59E0B).
  let status = null;
  if (!ohneStatus && statusLeisteSettings.objekt) {
    const hb = objektHandlungsbedarfDetail(ve, hbCfg);
    if (hb.farbe === "rot") status = { typ: "error", text: hb.text };
    else if (hb.farbe === "gelb") status = { typ: "warn", text: hb.text };
  }

  const bc = aktiv ? auswahlAccent : t.border;
  // In der kleinen/eingebetteten Objektkarte (kompakt) werden Statusleiste und
  // Verwendungs-Badges nie gezeigt.
  // Statusleiste IMMER als fester Platz unten (bewusste Design-Entscheidung):
  // bei rotem/gelbem Handlungsbedarf mit Text, sonst leer. So sind alle Karten
  // einer Zeile gleich hoch und enden bündig (Inhalt oben, Leiste unten).
  const zeigeStatus = !ohneStatus && !kompakt && statusLeisteSettings.objekt;
  return (
    <div onClick={onClick} id={id} data-kb-item={kbItem ? "1" : undefined} style={{
      cursor: "pointer", transition: "all 0.15s",
      border: ohneRahmen ? "none" : `1px solid ${bc}`,
      borderRadius: ohneRahmen ? 0 : RAD.lg,
      overflow: "hidden",
      // Karte füllt ihre Grid-Zelle in voller Höhe (Grid streckt Zellen auf
      // gleiche Höhe). So klebt die Statusleiste unten, kein dunkler Reststreifen.
      height: "100%", display: "flex", flexDirection: "column",
      background: t.card,
      scrollMarginTop: "var(--ad-header-h, 200px)" }}
      onMouseEnter={e => { if (!aktiv) e.currentTarget.style.transform = "translateY(-1px)"; }}
      onMouseLeave={e => { if (!aktiv) e.currentTarget.style.transform = "none"; }}>
      <div style={{
        display: "flex", alignItems: "center", gap: 12,
        padding: "10px 12px", boxSizing: "border-box",
        background: t.card, color: t.text,
        flex: 1, minHeight: 0 }}>
        {/* Links: Icon — wir nutzen DEN ECHTEN Avatar (firma=true) mit
            verwendungsZuweisungen. Damit ist die Render-Pipeline 1:1 die
            gleiche wie bei den Firmen-Kontakten, wo die Eck-Badges perfekt
            sitzen. Der Avatar zeigt bei firma=true automatisch das Building-
            Icon und die rounded-rect Box. */}
        <div style={{ width: 48, flexShrink: 0, display: "flex",
          alignItems: "center", justifyContent: "center" }}>
          <Avatar firma={true} size={38} accent={accent}
            verwendungsZuweisungen={aggregiereObjektVerwendungen(ve)}/>
        </div>
        {/* Mitte: VE-Nr + Name (Unterzeile) + IMMER 2 Adress-Zeilen (leere mit Platzhalter) */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: FS.l, fontWeight: FW.heavy, color: accent,
            overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{ve.nr}</div>
          {veName && (
            <div style={{ fontSize: FS.s, fontWeight: FW.medium, color: t.text, marginTop: 1,
              overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {veName}
            </div>
          )}
          <div style={{ fontSize: FS.s, color: t.sub, marginTop: 1,
            overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {strasse || "\u00A0"}
          </div>
          <div style={{ fontSize: FS.s, color: t.sub,
            overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {ort || "\u00A0"}
          </div>
        </div>
        {/* Rechts: kompakte Stats + Verwendungs-Badges */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end",
          gap: 6, flexShrink: 0 }}>
          <div style={{ fontSize: FS.s, color: t.sub, whiteSpace: "nowrap" }}>
            <strong style={{ color: t.text }}>{wohneinheiten.length}</strong> WE
            {stellplaetze.length > 0 && (
              <> · <strong style={{ color: t.text }}>{stellplaetze.length}</strong> SP</>
            )}
          </div>
          {!kompakt && <VerwendungenBadges ve={ve} size={18}/>}
        </div>
      </div>
      {zeigeStatus && <StatusLeiste {...(status || { typ: null, text: "" })} t={t} borderColor={bc} eingebettet={true}/>}
    </div>
  );
}

// ── FeldObjektKarte: aufklappbare kleine Objektkarte (Pendant zu ───────────
// FeldKontaktKarte). Eingeklappt: VEKachel kompakt (Avatar + WEG-Nr + Adresse +
// Einheiten-Stats, OHNE Status + OHNE Verwendungs-Badges). Aufgeklappt: read-
// only Eckdaten (Adresse, Einheiten, Verwaltung ab/bis, Verwalter, Gesamt-
// anteile, Nächste ETV) + Footer-Button „Vollständiges Objekt". Status/
// Verwendungs-Badges gehören NICHT in die kleine Objektkarte.
function FeldObjektKarte({ ve, t, accent, onVEClick, kontakte = [] }) {
  const [offen, setOffen] = useState(false);
  if (!offen) {
    return <VEKachel ve={ve} t={t} accent={accent} onClick={() => setOffen(true)} kompakt/>;
  }
  const vw = ve.verwaltung || {};
  const wohneinheiten = (ve.einheiten || []).filter(e => ["Wohneigentum", "Teileigentum", "Gewerbe"].indexOf(e.typ) >= 0);
  const stellplaetze  = (ve.einheiten || []).filter(e => isStellplatzTyp(e.typ));
  const verwalterK = vw.verwalter ? (kontakte || []).find(k => k.id === vw.verwalter) : null;
  const verwalterName = verwalterK
    ? (verwalterK.typ === "firma" ? (verwalterK.name || "")
       : (`${verwalterK.vorname || ""} ${verwalterK.nachname || ""}`.trim() || verwalterK.name || ""))
    : "";
  const einheitenText = wohneinheiten.length + " WE" + (stellplaetze.length > 0 ? " · " + stellplaetze.length + " SP" : "");
  const zeilen = [
    { label: "Adresse",      wert: ve.adresse || "" },
    { label: "Einheiten",    wert: einheitenText },
    { label: "Verwaltung ab", wert: datumAnzeige(vw.beginn) || "" },
    { label: "Bestellt bis", wert: datumAnzeige(vw.bestelltBis) || "" },
    { label: "Verwalter",    wert: verwalterName },
    { label: "Gesamtanteile", wert: vw.gesamtanteile || ve.gesamtanteile || "" },
    { label: "Nächste ETV",  wert: datumAnzeige(vw.naechsteETV) || "" },
  ].filter(z => z.wert !== "" && z.wert !== null && z.wert !== undefined);
  return (
    <div style={{ border: `1px solid ${accent}`, borderRadius: RAD.lg, overflow: "hidden",
      background: accent + "08", padding: "0 0 0 0" }}>
      {/* Kopf: Klick klappt wieder ein. Kachel ohne eigenen Rahmen (umlaufender
          Rahmen kommt vom Container, wie bei der kleinen Kontaktkarte). */}
      <div onClick={() => setOffen(false)} style={{ cursor: "pointer" }}>
        <VEKachel ve={ve} t={t} accent={accent} onClick={() => setOffen(false)} kompakt ohneRahmen/>
      </div>
      {/* Eckdaten read-only */}
      <div style={{ padding: "4px 12px 10px" }}>
        {zeilen.map((z, i) => (
          <div key={i} style={{ display: "flex", alignItems: "baseline", gap: 8,
            padding: "6px 0", borderBottom: i < zeilen.length - 1 ? `1px solid ${t.border}40` : "none" }}>
            <span style={{ width: 110, flexShrink: 0, fontSize: FS.s, color: t.sub }}>{z.label}</span>
            <span style={{ flex: 1, fontSize: FS.s, color: t.text, fontWeight: 500, textAlign: "right",
              overflow: "hidden", textOverflow: "ellipsis" }}>{z.wert}</span>
          </div>
        ))}
      </div>
      {/* Footer: Vollständiges Objekt — gleicher Stil wie die kleine Kontaktkarte
          (rechtsbündiger getönter Button mit Chevron, kein Voll-Breite-Streifen). */}
      {onVEClick && (
        <div style={{ padding: "0 12px 10px", display: "flex", justifyContent: "flex-end" }}>
          <button onClick={() => onVEClick(ve.id)}
            style={{ fontSize: FS.s, padding: "6px 12px", background: accent + "15", color: accent,
              border: `1px solid ${accent}40`, borderRadius: RAD.sm, cursor: "pointer",
              fontWeight: FW.medium, fontFamily: "inherit", display: "inline-flex",
              alignItems: "center", gap: 5 }}>
            Vollständiges Objekt
          </button>
        </div>
      )}
    </div>
  );
}

// ── FeldEinheitKarte: aufklappbare kleine Einheitskarte (Pendant zu ─────────
// FeldObjektKarte). Eingeklappt: EinheitKachel (WEG·Einheit + Adresse + Lage +
// Größe/Stellung). Aufgeklappt: read-only Eckdaten (Typ, Lage, Fläche, Zimmer,
// MEA, Rechtliche Stellung) + Footer-Button „Vollständige Einheit" (springt
// zum Objekt via onVEClick). Leere Zeilen weggelassen.
// ── FeldEinheitenSammelKarte (kleine Karte, mehrere Einheiten) ──────────────
// Kompakte Sammelkarte für Mehrfach-Einheiten-Termine: „N Einheiten · WE 03,
// WE 05, WE 07". Visuell konsistent mit EinheitKachel (38px-Icon-Wrapper,
// accent-Farbe). Klick springt zum Objekt (onVEClick), wie der verkVe-Fall.
function FeldEinheitenSammelKarte({ ve, einheiten, t, accent, onVEClick }) {
  if (!ve || !einheiten || einheiten.length === 0) return null;
  var labels = einheiten
    .map(function(e) { return (e && (e.bezeichnung || e.nr)) || ""; })
    .filter(Boolean);
  var labelText = labels.join(", ");
  var anzahl = labels.length;
  return (
    <div onClick={onVEClick ? function() { onVEClick(ve.id); } : undefined}
      style={{ cursor: onVEClick ? "pointer" : "default", transition: "all 0.15s" }}
      onMouseEnter={function(e) { e.currentTarget.style.transform = "translateY(-1px)"; }}
      onMouseLeave={function(e) { e.currentTarget.style.transform = "none"; }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12,
        padding: "10px 12px", boxSizing: "border-box",
        background: t.card, color: t.text,
        border: "1px solid " + t.border, borderRadius: RAD.lg }}>
        <div style={{ width: 48, flexShrink: 0, display: "flex",
          alignItems: "center", justifyContent: "center" }}>
          <div style={{ width: 38, height: 38, borderRadius: RAD.md,
            background: accent + "18", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <I name="home" size={18} color={accent}/>
          </div>
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: FS.l, fontWeight: FW.heavy, color: accent,
            overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {ve.nr} · {anzahl} Einheiten
          </div>
          <div style={{ fontSize: FS.s, color: t.sub, marginTop: 1,
            overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {labelText}
          </div>
        </div>
      </div>
    </div>
  );
}

function FeldEinheitKarte({ ve, einheit, t, accent, onVEClick }) {
  const [offen, setOffen] = useState(false);
  if (!ve || !einheit) return null;
  if (!offen) {
    return <EinheitKachel ve={ve} einheit={einheit} t={t} accent={accent} onClick={() => setOffen(true)}/>;
  }
  const istSP = isStellplatzTyp(einheit.typ);
  const stellungText = einheit.spStellung === "se_bestandteil" ? "SE-Bestandteil einer Einheit"
    : (einheit.spStellung === "ge_snr" ? "Gemeinschaft + Sondernutzungsrecht"
    : (einheit.spStellung === "eigenstaendig" ? "Eigenständiges Teileigentum"
    : ""));
  const zeilen = [
    { label: "Objekt",    wert: ve.nr || "" },
    { label: "Einheit",   wert: einheit.nr || "" },
    { label: "Typ",       wert: einheit.typ || "" },
    { label: "Lage",      wert: einheit.lage || "" },
    { label: "Fläche",    wert: einheit.flaeche || einheit.flaecheVon || "" },
    { label: "Zimmer",    wert: einheit.zimmer || "" },
    { label: "MEA",       wert: einheit.mea || "" },
    { label: istSP ? "Rechtliche Stellung" : "Rechtsstatus", wert: stellungText },
  ].filter(z => z.wert !== "" && z.wert !== null && z.wert !== undefined);
  return (
    <div style={{ border: `1px solid ${accent}`, borderRadius: RAD.lg, overflow: "hidden",
      background: accent + "08" }}>
      <div onClick={() => setOffen(false)} style={{ cursor: "pointer" }}>
        <EinheitKachel ve={ve} einheit={einheit} t={t} accent={accent} onClick={() => setOffen(false)} ohneRahmen/>
      </div>
      <div style={{ padding: "4px 12px 10px" }}>
        {zeilen.map((z, i) => (
          <div key={i} style={{ display: "flex", alignItems: "baseline", gap: 8,
            padding: "6px 0", borderBottom: i < zeilen.length - 1 ? `1px solid ${t.border}40` : "none" }}>
            <span style={{ width: 110, flexShrink: 0, fontSize: FS.s, color: t.sub }}>{z.label}</span>
            <span style={{ flex: 1, fontSize: FS.s, color: t.text, fontWeight: 500, textAlign: "right",
              overflow: "hidden", textOverflow: "ellipsis" }}>{z.wert}</span>
          </div>
        ))}
      </div>
      {/* Footer: Vollständige Einheit — gleicher Stil wie die kleine Kontaktkarte. */}
      {onVEClick && (
        <div style={{ padding: "0 12px 10px", display: "flex", justifyContent: "flex-end" }}>
          <button onClick={() => onVEClick(ve.id)}
            style={{ fontSize: FS.s, padding: "6px 12px", background: accent + "15", color: accent,
              border: `1px solid ${accent}40`, borderRadius: RAD.sm, cursor: "pointer",
              fontWeight: FW.medium, fontFamily: "inherit", display: "inline-flex",
              alignItems: "center", gap: 5 }}>
            Vollständige Einheit
          </button>
        </div>
      )}
    </div>
  );
}

// ── VEDetail (mit echtem Liegenschaft-Tab via LiegenschaftAnsicht) ──────────
function VEDetail({ ve, t, accent, onKontaktClick, onBack, kontakte, setKontakte, cardId, ves = [], setVes,
  externEditMode, setExternEditMode, headerOhneEditBtn = false, sprungZiel = null }) {
  const [tab, setTab] = useState("liegenschaft");
  // Sprungziel (z. B. aus dem Kalender): Tab direkt öffnen. Die betroffene
  // Karte wird unten via initialOffeneKarteId ans Karten-Akkordeon gereicht.
  // Effekt statt Initialwert, weil VEDetail beim Objektwechsel nicht zwingend
  // neu mountet. Nonce stellt sicher, dass derselbe Sprung erneut wirkt.
  useEffect(() => {
    if (sprungZiel && sprungZiel.tab) setTab(sprungZiel.tab);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sprungZiel ? sprungZiel.nonce : null]);
  const [internEditMode, setInternEditMode] = useState(false);
  // Wenn von außen kontrolliert (Mobile: Bearbeiten-Button sitzt im Sticky-
  // Header oben), nutzen wir externEditMode; sonst eigenen State.
  const editMode    = (typeof externEditMode === "boolean") ? externEditMode : internEditMode;
  const setEditMode = setExternEditMode ? setExternEditMode : setInternEditMode;
  // Gegenseitiger Ausschluss: ist eine Einheit ODER eine klappbare Verwaltungs-
  // Karte aufgeklappt, blenden wir den oberen Struktur-Stift aus. Da mehrere
  // gleichzeitig offen sein können (v. a. Verwaltungs-Karten), zählen wir die
  // offenen Melder statt eines einzelnen Bools — sonst blendet das Schließen
  // EINER Karte den Stift fälschlich wieder ein.
  const [offenCount, setOffenCount] = useState(0);
  const einheitOffen = offenCount > 0;
  // API-kompatibler Setter: setOffen(true) = +1, setOffen(false) = −1 (>=0).
  const setEinheitOffen = (v) => setOffenCount(c => Math.max(0, c + (v ? 1 : -1)));

  // ── Gemeinsame ETV-Stammdaten (Abstimmung/Gesamtanteile/Wirtschaftsjahr) ──
  // Eine Quelle (ve.etvStamm), die Liegenschaft- UND Verwaltungs-Karte teilen.
  // Fehlt sie (Bestand), aus den vorhandenen ETV-Karten-Feldern migrieren.
  const etvStamm = (() => {
    if (ve && ve.etvStamm && typeof ve.etvStamm === "object") {
      return {
        abstimmung: ve.etvStamm.abstimmung != null ? ve.etvStamm.abstimmung : "MEA",
        gesamtanteile: ve.etvStamm.gesamtanteile != null ? ve.etvStamm.gesamtanteile : "1000",
        wirtschaftsjahr: ve.etvStamm.wirtschaftsjahr != null ? ve.etvStamm.wirtschaftsjahr : "Kalenderjahr",
      };
    }
    // Migration aus persistierten Karten-Feldern (falls vorhanden).
    let abst = "MEA", ges = "1000", wj = "Kalenderjahr";
    const vk = (ve && Array.isArray(ve.verwaltungsKarten)) ? ve.verwaltungsKarten : [];
    const etvK = vk.find(k => k && k.kategorie === "etv");
    if (etvK && Array.isArray(etvK.stamm)) {
      const fA = etvK.stamm.find(f => f.name === "Abstimmung nach");
      const fW = etvK.stamm.find(f => f.name === "Wirtschaftsjahr");
      if (fA && fA.value) abst = fA.value;
      if (fW && fW.value) wj = fW.value;
    }
    // Gesamtanteile: bevorzugt aus dem alten Liegenschaft-„Gesamt-MEA"-Feld (das
    // den fachlich korrekten Wert trägt, z. B. 1000). Erst danach ETV-Feld.
    const lk = (ve && Array.isArray(ve.karten)) ? ve.karten : [];
    const stammK = lk.find(k => k && k.kategorie === "stammdaten" && k.fixed);
    let mea = null;
    if (stammK && Array.isArray(stammK.stamm)) {
      const fMea = stammK.stamm.find(f => f.name === "Gesamt-MEA");
      if (fMea && fMea.value != null && fMea.value !== "") mea = fMea.value;
    }
    if (mea != null) {
      ges = mea;
    } else if (etvK && Array.isArray(etvK.stamm)) {
      const fG = etvK.stamm.find(f => f.name === "Gesamtanteile" || f.name === "Gesamt-MEA");
      if (fG && fG.value) ges = fG.value;
    }
    return { abstimmung: abst, gesamtanteile: ges, wirtschaftsjahr: wj };
  })();
  const setEtvStamm = (key, value) => {
    if (!setVes) return;
    setVes(prev => prev.map(v => {
      if (v.id !== ve.id) return v;
      const basis = (v.etvStamm && typeof v.etvStamm === "object") ? v.etvStamm : etvStamm;
      return { ...v, etvStamm: { ...basis, [key]: value } };
    }));
  };
  // Snapshot des VE beim Eintritt in den Bearbeiten-Modus — ermöglicht echtes
  // „Abbrechen" (Verwerfen), obwohl Änderungen sonst live gespeichert werden.
  const editSnapshot = useRef(null);
  const vorherEdit = useRef(editMode);
  useEffect(() => {
    if (editMode && !vorherEdit.current) {
      try { editSnapshot.current = JSON.parse(JSON.stringify(ve)); }
      catch (e) { editSnapshot.current = null; }
    }
    vorherEdit.current = editMode;
  }, [editMode]);
  const bearbeitenFertig = () => { editSnapshot.current = null; setEditMode(false); };
  const bearbeitenAbbrechen = () => {
    const snap = editSnapshot.current;
    if (snap && setVes) setVes(prev => prev.map(v => v.id === snap.id ? snap : v));
    editSnapshot.current = null;
    setEditMode(false);
  };
  const loeschenErlaubt = useLoeschenErlaubt();
  const [loeschConfirm, setLoeschConfirm] = useState(false);
  useEffect(() => {
    if (!loeschConfirm) return;
    const tmr = setTimeout(() => setLoeschConfirm(false), 4000);
    return () => clearTimeout(tmr);
  }, [loeschConfirm]);
  const handleObjektLoeschen = () => {
    if (!loeschConfirm) { setLoeschConfirm(true); return; }
    setLoeschConfirm(false);
    if (setVes) setVes(prev => prev.filter(v => v.id !== ve.id));
    if (onBack) onBack();
  };
  const objektTabsCfg = useObjektTabs();
  // Default-Tab-Definitionen (Label/Icon). Reihenfolge + Sichtbarkeit kommen aus
  // den Einstellungen (objektTabsCfg); fehlt die Konfiguration, gilt diese Folge.
  const TAB_DEFAULTS = [
    { id: "liegenschaft", label: "Liegenschaft", icon: "building" },
    { id: "verwaltung",   label: "Verwaltung",   icon: "document" },
    { id: "legionellen",  label: "Legionellen",  icon: "drop" },
    { id: "te",           label: "TE",           icon: "badge" },
    { id: "dokumente",    label: "Dokumente",    icon: "document" },
    { id: "kontakte",     label: "Kontakte",     icon: "users" },
    { id: "bilder",       label: "Bilder",       icon: "paint" },
    { id: "historie",     label: "Historie",     icon: "calendar" },
  ];
  const tabDef = (id) => TAB_DEFAULTS.find(d => d.id === id) || { id, label: id, icon: "document" };
  // Legionellen-Tab nur, wenn das Objekt eine zentrale Warmwasserversorgung hat
  // (Prüfpflicht nach TrinkwV, abgeleitet aus der Technik). Sonst ausblenden.
  const zeigeLegionellen = objektHatZentralesWarmwasser(ve);
  let TABS;
  if (Array.isArray(objektTabsCfg) && objektTabsCfg.length > 0) {
    TABS = objektTabsCfg
      .filter(tc => tc.fix || tc.aktiv !== false)        // Liegenschaft/Verwaltung (fix) immer; Rest nur wenn aktiv
      .filter(tc => tc.id !== "legionellen" || zeigeLegionellen)
      .slice()
      .sort((a, b) => (a.reihenfolge || 0) - (b.reihenfolge || 0))
      .map(tc => { const d = tabDef(tc.id); return { id: tc.id, label: tc.label || d.label, icon: tc.icon || d.icon }; });
  } else {
    TABS = TAB_DEFAULTS.filter(d => d.id !== "legionellen" || zeigeLegionellen);
  }
  // Wenn der aktive Tab ausgeblendet wurde, auf den ersten verfügbaren wechseln.
  useEffect(() => {
    if (TABS.length > 0 && !TABS.some(x => x.id === tab)) setTab(TABS[0].id);
  }, [objektTabsCfg, zeigeLegionellen]);
  // Tab-Wechsel: zur VE-Karte (oben) zurückscrollen, damit die Ansicht
  // konsistent bleibt (Karte oben unter dem Header, Details darunter).
  // Auch bei kürzeren Tabs wie "Kontakte" landet der Nutzer immer an
  // derselben Stelle, nicht irgendwo dazwischen.
  const wechselTab = (id) => {
    setTab(id);
    if (cardId) {
      // setTimeout statt requestAnimationFrame: bei einem Tab-Wechsel auf
      // einen leeren Reiter ist der Container noch nicht in der finalen Höhe,
      // wenn rAF feuert — 50ms ist robust und visuell unauffällig.
      setTimeout(() => scrollToCard(cardId), 50);
    }
  };
  // Aktiven Reiter horizontal ins Sichtfeld bringen — NUR bei echtem Tab-Wechsel
  // (über useEffect auf `tab`), nicht bei jedem Re-Render. Früher saß ein
  // scrollIntoView in einem ref-Callback, der bei JEDEM Render feuerte (z. B.
  // beim Hinzufügen einer Kontakt-Karte) und auf Mobile den Body vertikal
  // hochzog ("Screen läuft hoch"). scrollLeft statt scrollIntoView hält die
  // vertikale Position garantiert unberührt.
  const tabLeisteRef = useRef(null);
  const tabBtnRefs = useRef({});
  useEffect(() => {
    const leiste = tabLeisteRef.current;
    const btn = tabBtnRefs.current[tab];
    if (!leiste || !btn) return;
    // Ziel: aktiven Button horizontal zentrieren, rein über scrollLeft.
    const ziel = btn.offsetLeft - (leiste.clientWidth / 2) + (btn.offsetWidth / 2);
    leiste.scrollLeft = Math.max(0, ziel);
  }, [tab]);

  // Beteiligte Kontakte ermitteln
  const beteiligteIds = [...new Set(
    ve.einheiten.flatMap(e =>
      [...(e.eigentuemer||[]).map(et => et.kontaktId), ...(e.mieter||[]).map(m => m.kontaktId)]
    ).filter(Boolean)
  )];
  const beteiligte = beteiligteIds.map(id => kontakte.find(k => k.id === id)).filter(Boolean);

  return (
    <EinheitOffenContext.Provider value={{ offen: einheitOffen, setOffen: setEinheitOffen }}>
    <div>
      {/* Detail-Titelzeile aus dem zentralen DetailKopf-Baustein (§76). Aktions-
          Slot: Stift bzw. X+Haken (+ Löschen im Edit). headerOhneEditBtn=true im
          Mobile-Detail (Button sitzt im Sticky-Header) → kein Aktions-Slot hier,
          Klick auf den Titel geht zurück. */}
      <DetailKopf t={t} accent={accent} titel={ve.nr} sub={ve.adresse || null}
        marginBottom={12}
        onTitelClick={(headerOhneEditBtn && onBack) ? onBack : null}
        aktion={(!headerOhneEditBtn && !(einheitOffen && !editMode)) ? (
          editMode ? (
            <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
              {loeschenErlaubt.objekte && setVes && (
                <AktionsButton rolle="loeschen" onClick={handleObjektLoeschen}
                  farbe={accent} confirm={loeschConfirm}
                  label={loeschConfirm ? "Wirklich löschen?" : null}
                  title={loeschConfirm ? "Nochmal klicken zum Löschen" : "Objekt löschen"}
                  t={t} accent={accent}/>
              )}
              <button onClick={bearbeitenAbbrechen}
                title="Abbrechen — Änderungen verwerfen" aria-label="Abbrechen"
                style={{ display: "flex", alignItems: "center", justifyContent: "center",
                  width: 36, height: 36, flexShrink: 0, background: accent, border: "none",
                  borderRadius: RAD.pill, cursor: "pointer", boxShadow: `0 1px 2px ${accent}40` }}>
                <I name="x" size={16} color="#EF4444"/>
              </button>
              <button onClick={bearbeitenFertig}
                title="Fertig — Änderungen behalten" aria-label="Fertig"
                style={{ display: "flex", alignItems: "center", justifyContent: "center",
                  width: 36, height: 36, flexShrink: 0, background: accent, border: "none",
                  borderRadius: RAD.pill, cursor: "pointer", boxShadow: `0 1px 2px ${accent}40` }}>
                <I name="check" size={14} color="#FFFFFF"/>
              </button>
            </div>
          ) : (
            <button onClick={() => setEditMode(true)}
              title="Bearbeiten" aria-label="Bearbeiten"
              style={{ display: "flex", alignItems: "center", justifyContent: "center",
                width: 36, height: 36, flexShrink: 0, background: accent, border: "none",
                borderRadius: RAD.pill, cursor: "pointer", boxShadow: `0 1px 2px ${accent}40` }}>
              <I name="pencil" size={14} color={getContrastColor(accent)}/>
            </button>
          )
        ) : null}/>

      {/* Reiter — horizontal scrollbar (wie das Dashboard im Header), damit
          auch 6+ Reiter auf Mobile Platz finden. Aktiver Reiter scrollt
          automatisch ins Sichtfeld. */}
      <div ref={tabLeisteRef} style={{ display: "flex", background: t.card, border: `1px solid ${t.border}`,
        borderRadius: RAD.lg, marginBottom: 16,
        overflowX: "auto", overflowY: "hidden",
        scrollbarWidth: "thin", WebkitOverflowScrolling: "touch" }}>
        {TABS.map(tb => (
          <button key={tb.id} onClick={() => wechselTab(tb.id)}
            ref={el => { tabBtnRefs.current[tb.id] = el; }}
            style={{
              flex: "0 0 auto", display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
              padding: "11px 18px", background: "none", border: "none", cursor: "pointer",
              borderBottom: tab === tb.id ? `2px solid ${accent}` : "2px solid transparent",
              fontSize: FS.m, fontWeight: tab === tb.id ? 700 : 500,
              color: tab === tb.id ? accent : t.sub, fontFamily: "inherit",
              whiteSpace: "nowrap" }}>
            <I name={tb.icon} size={13} color={tab === tb.id ? accent : t.sub}/>{tb.label}
          </button>
        ))}
      </div>

      {/* Liegenschaft */}
      {tab === "liegenschaft" && <LiegenschaftAnsicht ve={ve} setVes={setVes} t={t} accent={accent} kontakte={kontakte} setKontakte={setKontakte} editMode={editMode} onKontaktClick={onKontaktClick} ves={ves} etvStamm={etvStamm} onSyncChange={setEtvStamm} sprungKarte={sprungZiel && sprungZiel.tab === "liegenschaft" ? { karteId: sprungZiel.karteId, nonce: sprungZiel.nonce } : null}/>}

      {/* Verwaltung */}
      {tab === "verwaltung" && <VerwaltungAnsicht ve={ve} setVes={setVes} t={t} accent={accent} kontakte={kontakte} setKontakte={setKontakte} editMode={editMode} onKontaktClick={onKontaktClick} ves={ves} etvStamm={etvStamm} onSyncChange={setEtvStamm} sprungKarte={sprungZiel && sprungZiel.tab === "verwaltung" ? { karteId: sprungZiel.karteId, nonce: sprungZiel.nonce } : null}/>}

      {/* TE-Klausel-Register (Dokument-Auswertung) */}
      {tab === "te" && (
        <TERegisterAnsicht ve={ve} t={t} accent={accent}/>
      )}

      {/* Legionellen / Trinkwasser (TrinkwV) — eigener Tab je Objekt */}
      {tab === "legionellen" && (
        <LegionellenAnsicht ve={ve} setVes={setVes} t={t} accent={accent}
          editMode={editMode}
          kontakte={kontakte} onKontaktClick={onKontaktClick}/>
      )}

      {/* Kontakte (Personen gruppiert nach Rolle, plus Dienstleister-Firmen) */}
      {tab === "kontakte" && (
        <VEKontakteTab ve={ve} setVes={setVes} t={t} accent={accent}
          kontakte={kontakte} setKontakte={setKontakte}
          editMode={editMode} ves={ves}
          onKontaktClick={onKontaktClick}/>
      )}

      {/* Historie · Dokumente · Bilder — Platzhalter, Inhalte folgen.
          Konsistente Karte mit Icon + Erklärung, damit der Bereich nicht
          leer wirkt und klar ist, was hier geplant ist. */}
      {tab === "historie" && (
        <HistorieAnsicht ve={ve} kontakte={kontakte} t={t} accent={accent}
          setKontakte={setKontakte} onKontaktClick={onKontaktClick}/>
      )}
      {tab === "dokumente" && (
        <DokumenteAnsicht ve={ve} setVes={setVes} t={t} accent={accent}
          kontakte={kontakte} setKontakte={setKontakte} editMode={editMode}
          onKontaktClick={onKontaktClick} ves={ves}
          sprungKarte={sprungZiel && sprungZiel.tab === "dokumente" ? { karteId: sprungZiel.karteId, nonce: sprungZiel.nonce } : null}/>
      )}
      {tab === "bilder" && (
        <PlatzhalterReiter t={t} accent={accent} icon="paint"
          titel="Bilder"
          beschreibung="Fotos zum Objekt — Außenansichten, technische Anlagen, Schadensbilder, Begehungs-Fotos."
          punkte={[
            "Kategorien (Außen, Innen, Technik, Schäden …)",
            "Direkter Upload vom Handy (Kamera)",
            "Verknüpfung mit Einheiten oder Räumen",
            "Lightbox-Vorschau",
          ]}/>
      )}
    </div>
    </EinheitOffenContext.Provider>
  );
}

// ── TE-Klausel-Register (Dokument-Auswertung am Objekt) ─────────────────────
// Stufe 1: lesbares, gefiltertes Register strukturierter TE-Klauseln. Schema
// nach AllesDa_Datenformat_Spec_TE-Register. Die TE ist Referenz-Bauplan für
// spätere Dokument-Register (Police, Vertrag, Beschluss) — gleiches Gerüst.
//
// Baustein-Wiederverwendung: FilterButtons (Bereich-Filter), Akkordeon-Muster
// (offeneKarteId/onAkkordeonToggle, nur EINE Karte offen, KEIN Chevron),
// feldInput/feldLabel, I-Icons, druckeHtml (Cheatsheet-Druck). Kein neues
// Layout, kein Modal — DESIGN-konform.

// Geschlossene Werteliste: Bereiche (Spec §5). Reihenfolge = Anzeige/Filter.
const TE_BEREICHE = [
  { id: "stammdaten",      kurz: "Stammdaten",   label: "Stammdaten",          farbe: "#64748B" },
  { id: "sondereigentum",  kurz: "SE/GE",        label: "Sonder-/Gemeinsch.",  farbe: "#7C3AED" },
  { id: "nutzung",         kurz: "Nutzung",      label: "Nutzung",             farbe: "#0EA5E9" },
  { id: "veraeusserung",   kurz: "Veräußerung",  label: "Veräußerung",         farbe: "#DB2777" },
  { id: "instandhaltung",  kurz: "Instandh.",    label: "Instandhaltung",      farbe: "#EA580C" },
  { id: "versicherung",    kurz: "Versich.",     label: "Versicherung",        farbe: "#0891B2" },
  { id: "pflichten_rechte",kurz: "Pfl./Rechte",  label: "Pflichten / Rechte",  farbe: "#65A30D" },
  { id: "zahlungen",       kurz: "Zahlungen",    label: "Zahlungen / WP",      farbe: "#CA8A04" },
  { id: "etv",             kurz: "ETV",          label: "Eigentümerversammlung",farbe: "#2563EB" },
  { id: "verwalter",       kurz: "Verwalter",    label: "Verwalter",           farbe: "#9333EA" },
  { id: "beirat",          kurz: "Beirat",       label: "Beirat",              farbe: "#16A34A" },
];
const teBereich = (id) => TE_BEREICHE.find(b => b.id === id) || { id, kurz: id, label: id, farbe: "#64748B" };

// Relevanz-Stufen (Spec §2). Farbe steuert das Badge.
const TE_RELEVANZ = {
  hoch:          { label: "Hoch",          farbe: "#DC2626" },
  mittel:        { label: "Mittel",        farbe: "#D97706" },
  niedrig:       { label: "Niedrig",       farbe: "#64748B" },
  nicht_relevant:{ label: "Nicht relevant",farbe: "#94A3B8" },
};
// WEMoG-Status (Spec §2). Nur „nicht unverändert/kein_bezug" wird sichtbar markiert.
const TE_WEMOG = {
  unveraendert:        { label: "WEMoG: unverändert",   farbe: "#16A34A", zeige: false },
  teilweise_ueberholt: { label: "teilw. überholt",      farbe: "#D97706", zeige: true  },
  ueberholt:           { label: "überholt",             farbe: "#DC2626", zeige: true  },
  umstritten:          { label: "umstritten",           farbe: "#CA8A04", zeige: true  },
  kein_bezug:          { label: "",                     farbe: "#94A3B8", zeige: false },
};

// Generische MUSTER-Klauseln (erfunden, keine echte Liegenschaft). Dienen als
// UI-Testdaten und als Anschauung, bis echte Daten/Upload kommen. herkunft:
// "import"/"manuell". Spec §10.2 (Muster-Testdaten, keine Echtdaten).
const TE_MUSTER_PUNKTE = [
  { id:"p1", nr:1, bereich:"stammdaten", fundstelle:"§ 1", punkt:"Grundstück / Grundbuch",
    inhalt:"Bezeichnung des Grundstücks und Grundbuchstelle, auf der die Gemeinschaft beruht.",
    bedeutung:"Stammdatum für Notarvorgänge, Grundsteuer und Versicherungs-Stammdaten.",
    wemogHinweis:"", wemogStatus:"kein_bezug", relevanz:"mittel", userRelevanz:null, notizen:"", aktion:"" },
  { id:"p2", nr:2, bereich:"sondereigentum", fundstelle:"§ 2 (3)", punkt:"Sondereigentum: Definition",
    inhalt:"Abgrenzung, welche Gebäudeteile zum Sondereigentum gehören (Bodenbelag, Innentüren, Zu-/Ableitungen ab Hauptstrang …).",
    bedeutung:"Wichtigste Abgrenzung: entscheidet bei Schäden, wer zahlt — Eigentümer oder Gemeinschaft.",
    wemogHinweis:"Nach der Reform 2020 ist Wandputz an tragenden Wänden zwingend Gemeinschaftseigentum — Klausel kann teilweise überholt sein.",
    wemogStatus:"teilweise_ueberholt", relevanz:"hoch", userRelevanz:null, notizen:"", aktion:"" },
  { id:"p3", nr:3, bereich:"nutzung", fundstelle:"§ 5 (3)", punkt:"Vermietung",
    inhalt:"Überlassung der Wohnung an Dritte bedarf der schriftlichen Einwilligung des Verwalters (Ausnahmen für nahe Angehörige).",
    bedeutung:"Auf dem Papier braucht jeder Mietvertrag Zustimmung. Praktisch oft nicht beachtet.",
    wemogHinweis:"Wirksamkeit nach heutiger Rechtsprechung umstritten; willkürliche Versagung wäre unwirksam.",
    wemogStatus:"umstritten", relevanz:"mittel", userRelevanz:null, notizen:"", aktion:"" },
  { id:"p4", nr:4, bereich:"veraeusserung", fundstelle:"§ 6 (2)", punkt:"Verwalterzustimmung beim Verkauf",
    inhalt:"Veräußerung des Wohnungseigentums bedarf der Zustimmung des Verwalters (mit gesetzlichen Ausnahmen).",
    bedeutung:"Formell jedem Verkauf zustimmen — Notar verlangt die Zustimmung. Gebühr laut Verwaltervertrag prüfen.",
    wemogHinweis:"Inhaltlich unverändert (§ 12 WEG).",
    wemogStatus:"unveraendert", relevanz:"hoch", userRelevanz:null, notizen:"", aktion:"Bei Eigentümerwechsel an Zustimmung denken." },
  { id:"p5", nr:5, bereich:"instandhaltung", fundstelle:"§ 7 (1) S. 2", punkt:"Außenfenster + Wohnungstüren",
    inhalt:"Instandhaltung der Wohnungsabschlusstüren und Außenfenster obliegt dem Wohnungseigentümer.",
    bedeutung:"Abweichende Kostenverteilung: Fenster sind Gemeinschaftseigentum, aber der Eigentümer zahlt. Bei Fenster-Beschlüssen stets Streitpunkt.",
    wemogHinweis:"Klausel vermutlich wirksam; bei Großmaßnahme abweichende Verteilung nach § 16 Abs. 2 WEG prüfen.",
    wemogStatus:"unveraendert", relevanz:"hoch", userRelevanz:null, notizen:"", aktion:"Bei nächstem Fenster-TOP Eigentümer-Kostentragung kommunizieren." },
  { id:"p6", nr:6, bereich:"versicherung", fundstelle:"§ 8 (1)", punkt:"Versicherungspflichten",
    inhalt:"Die Gemeinschaft schließt Haftpflicht-, Gebäudefeuer- und Leitungswasserschadenversicherung zum gleitenden Neuwert ab.",
    bedeutung:"Prüfen, ob alle drei Versicherungen tatsächlich bestehen und zum gleitenden Neuwert geführt werden.",
    wemogHinweis:"", wemogStatus:"kein_bezug", relevanz:"hoch", userRelevanz:null, notizen:"", aktion:"" },
  { id:"p7", nr:7, bereich:"zahlungen", fundstelle:"§ 13 (4)", punkt:"Geschäftsjahr",
    inhalt:"Festlegung eines vom Kalenderjahr abweichenden Geschäftsjahres mit entsprechender Abrechnungspflicht.",
    bedeutung:"Bestimmt den Zeitplan für Wirtschaftsplan und Jahresabrechnung. Falls nie umgestellt: Fristen daran ausrichten.",
    wemogHinweis:"", wemogStatus:"kein_bezug", relevanz:"hoch", userRelevanz:null, notizen:"", aktion:"Beschluss suchen, ob Geschäftsjahr je umgestellt wurde." },
  { id:"p8", nr:8, bereich:"etv", fundstelle:"§ 15 (1)", punkt:"Stimmrecht nach MEA",
    inhalt:"Beschlüsse werden in der Versammlung gefasst; das Stimmrecht richtet sich nach Miteigentumsanteilen.",
    bedeutung:"Abweichend vom gesetzlichen Kopfprinzip — bei jeder Beschlussfassung MEA-Listen verwenden.",
    wemogHinweis:"Zulässige abweichende Regelung in der TE bleibt wirksam.",
    wemogStatus:"unveraendert", relevanz:"hoch", userRelevanz:null, notizen:"", aktion:"" },
  { id:"p9", nr:9, bereich:"etv", fundstelle:"§ 15 (4)", punkt:"Beschlussfähigkeit",
    inhalt:"Versammlung ist nur bei Vertretung von mehr als der Hälfte der Anteile beschlussfähig; sonst Wiederholungsversammlung.",
    bedeutung:"Für die Einladungspraxis relevant — klassischer Wiederholungs-Hinweis.",
    wemogHinweis:"Das gesetzliche Quorum wurde 2020 aufgehoben: die Versammlung ist heute stets beschlussfähig — die Klausel ist insoweit überholt.",
    wemogStatus:"ueberholt", relevanz:"hoch", userRelevanz:null, notizen:"", aktion:"" },
  { id:"p10", nr:10, bereich:"beirat", fundstelle:"§ 17", punkt:"Verwaltungsbeirat",
    inhalt:"Bestellung eines Verwaltungsbeirats aus drei Wohnungseigentümern einschließlich Vorsitzendem.",
    bedeutung:"Beiratsgröße per TE auf drei festgelegt; heute frei wählbar, aber bis zur Änderung bindend.",
    wemogHinweis:"Seit 2020 ist die Anzahl frei; die Vorgabe kann durch Beschluss geändert werden.",
    wemogStatus:"teilweise_ueberholt", relevanz:"hoch", userRelevanz:null, notizen:"", aktion:"" },
];

// ── ObjekteMasterDetail (responsive Master-Detail-Layout für Objekte) ───────
// Analog zu KontakteMasterDetail: misst Breite und entscheidet zwischen
// 2-Spalten-Master, 1-Spalten-Master, oder nur Detail mit "Zurück"-Button.
// Hierher verschoben (aus dem App-Rumpf), weil alle Bausteine (VEDetail/VEKachel/
// VEListenZeile) hier leben und so KEIN Modul-Init-Zyklus entsteht; Nutzer sind
// der App-Rumpf UND der Kalender (renderDetailOverride für Objekt-Termine).
function ObjekteMasterDetail({ cardWidth, detailMinBreite = 300, detailMin = null, kartenMaxBreite = 340, kartenMin = 272, listeOpt = null, kartenSpalten = 2, gefiltert, expandedVEId, setExpandedVEId, sprungZiel = null,
  offenVE, t, accent, kontakte, setKontakte, ves, setVes, gotoKontakt, listenAnsicht = "karten", renderDetailOverride = null, auswahlAccentOverride = null, onNurDetail = null }) {
  const istListe = listenAnsicht === "liste";
  // Auswahl-Akzent: Mehr-Farbe = Objekt-Bereichsfarbe, Graumodus = System-Akzent.
  // Override (z. B. Kalenderfarbe) hat Vorrang.
  const auswahlAccent = auswahlAccentOverride || useKontaktFarbe().auswahlObjekt || accent;
  const istDesktop = useWindowWidth() >= DESKTOP_MIN_WIDTH;

  // Border/Background auf eigenem inneren Wrapper (analog KontaktDetailKarte).
  // renderDetailOverride: erlaubt fremden Detail-Inhalt (z. B. Kalender-Termine
  // eines Objekts) bei gleichem Master-Detail-Gerüst.
  const renderDetail = () => renderDetailOverride ? renderDetailOverride(offenVE) : (
    <DetailRahmen t={t} accent={auswahlAccent}>
      <VEDetail ve={offenVE} t={t} accent={accent}
        kontakte={kontakte} setKontakte={setKontakte} ves={ves} setVes={setVes}
        cardId={"obj-" + offenVE.id}
        sprungZiel={sprungZiel}
        onKontaktClick={(id) => { setExpandedVEId(null); gotoKontakt(id); }}
        onBack={() => setExpandedVEId(null)}/>
    </DetailRahmen>
  );

  // Master-Liste (Karten/Zeilen). Funktion(layout) → Karten-Spalten aus dem
  // Baustein-Layout.
  const masterListe = (layout) => (
    <div style={listenAnsicht === "liste"
      ? { display: "flex", flexDirection: "column", gap: 6 }
      : kartenGridStyle(layout)}>
      {gefiltert.map(ve => listenAnsicht === "liste" ? (
        <VEListenZeile key={ve.id} ve={ve} t={t} accent={accent}
          aktiv={expandedVEId === ve.id} kbItem id={"obj-" + ve.id}
          auswahlAccentOverride={auswahlAccentOverride}
          onClick={() => setExpandedVEId(expandedVEId === ve.id ? null : ve.id)}/>
      ) : (
        <VEKachel key={ve.id} ve={ve} t={t} accent={accent}
          aktiv={expandedVEId === ve.id} kbItem
          id={"obj-" + ve.id}
          auswahlAccentOverride={auswahlAccentOverride}
          onClick={() => setExpandedVEId(expandedVEId === ve.id ? null : ve.id)}/>
      ))}
    </div>
  );

  // Mobil-Detail: DetailMobilScrollTop scrollt den Detail-Kopf unter den Sticky-
  // Header (Header sichtbar). Kein eigener Body-Zurück-Button — das „Zurück" oben
  // rechts liefert der aufrufende Sticky-Header.
  const mobilDetail = (
    <DetailMobilScrollTop offenId={offenVE && offenVE.id} t={t}
      headerSelector="[data-app-fixed-header]" zumAnfang={true}>
      {renderDetail()}
    </DetailMobilScrollTop>
  );

  return (
    <MasterDetailRahmen
      master={masterListe}
      detail={renderDetail()}
      mobilDetail={mobilDetail}
      istDesktop={istDesktop}
      listenAnsicht={listenAnsicht} listeOpt={listeOpt}
      kartenSpalten={kartenSpalten} kartenMaxBreite={kartenMaxBreite}
      kartenMin={kartenMin} detailMinBreite={detailMinBreite} detailMin={detailMin}
      onNurDetail={onNurDetail}/>
  );
}

// Eine Klausel-Karte. Akkordeon: Klick auf den Kopf klappt auf/zu. KEIN Chevron
// (DESIGN §2.9). Kopf zeigt Bereich-Punkt + Fundstelle + Relevanz/WEMoG-Badges.
function TEKlauselKarte({ punkt, t, accent, offen, onToggle }) {
  const b = teBereich(punkt.bereich);
  const rel = TE_RELEVANZ[punkt.relevanz] || TE_RELEVANZ.niedrig;
  const wem = TE_WEMOG[punkt.wemogStatus] || null;
  const zeigeWemog = wem && wem.zeige;
  return (
    <div style={{ background: t.card, border: `1px solid ${t.border}`,
      borderLeft: `3px solid ${b.farbe}`, borderRadius: RAD.ml, overflow: "hidden" }}>
      {/* Kopf — klickbar, ganze Zeile (DESIGN: kein Pfeil-Indikator) */}
      <div onClick={() => onToggle(punkt.id, !offen)} style={{
        display: "flex", alignItems: "flex-start", gap: 10,
        padding: "11px 13px", cursor: "pointer" }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <span style={{ fontSize: FS.xs, fontWeight: FW.bold, color: b.farbe,
              textTransform: "uppercase", letterSpacing: "0.04em" }}>{b.label}</span>
            {punkt.fundstelle && (
              <span style={{ fontSize: FS.xs, color: t.muted }}>{punkt.fundstelle}</span>
            )}
          </div>
          <div style={{ fontSize: FS.l, fontWeight: FW.bold, color: t.text,
            marginTop: 3, overflowWrap: "anywhere" }}>{punkt.punkt}</div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end",
          gap: 4, flexShrink: 0 }}>
          <span style={{ fontSize: FS.xxs, fontWeight: FW.bold, color: rel.farbe,
            background: rel.farbe + "1A", padding: "2px 7px", borderRadius: RAD.pill,
            whiteSpace: "nowrap" }}>{rel.label}</span>
          {zeigeWemog && (
            <span style={{ fontSize: FS.xxs, fontWeight: FW.medium, color: wem.farbe,
              background: wem.farbe + "1A", padding: "2px 7px", borderRadius: RAD.pill,
              whiteSpace: "nowrap" }}>{wem.label}</span>
          )}
        </div>
      </div>
      {/* Inhalt — nur wenn offen */}
      {offen && (
        <div style={{ padding: "0 13px 13px", display: "flex", flexDirection: "column", gap: 10 }}>
          <div>
            <div style={feldLabel(t, { uppercase: true })}>Inhalt</div>
            <div style={{ fontSize: FS.m, color: t.text, lineHeight: 1.5,
              overflowWrap: "anywhere" }}>{punkt.inhalt}</div>
          </div>
          <div>
            <div style={feldLabel(t, { uppercase: true })}>Bedeutung für Verwalter</div>
            <div style={{ fontSize: FS.m, color: t.text, lineHeight: 1.5,
              overflowWrap: "anywhere" }}>{punkt.bedeutung}</div>
          </div>
          {punkt.wemogHinweis ? (
            <div style={{ background: t.surface, border: `1px solid ${t.border}`,
              borderRadius: RAD.md, padding: "8px 11px" }}>
              <div style={feldLabel(t, { uppercase: true })}>Hinweis (WEMoG / Praxis)</div>
              <div style={{ fontSize: FS.s, color: t.sub, lineHeight: 1.5,
                overflowWrap: "anywhere" }}>{punkt.wemogHinweis}</div>
            </div>
          ) : null}
          {punkt.aktion ? (
            <div style={{ display: "flex", alignItems: "flex-start", gap: 8,
              background: accent + "12", borderRadius: RAD.md, padding: "8px 11px" }}>
              <I name="clock" size={14} color={accent}/>
              <div style={{ fontSize: FS.s, color: t.text, lineHeight: 1.5,
                overflowWrap: "anywhere" }}>{punkt.aktion}</div>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}

// Register-Ansicht (ein Objekt-Tab). Filterleiste (Bereich) + Akkordeon-Liste.
// Liest Klauseln aus ve.dokAnalysen (erste TE) — fehlt das Feld, MUSTER-Daten.
function TERegisterAnsicht({ ve, t, accent }) {
  const [offeneKarteId, setOffeneKarteId] = useState(null);
  const [bereichFilter, setBereichFilter] = useState("alle");
  const onAkkordeonToggle = (id, willOpen) => setOffeneKarteId(willOpen ? id : null);

  // Datenquelle: erste TE-Analyse am Objekt; sonst Muster-Klauseln.
  const dokListe = (ve && Array.isArray(ve.dokAnalysen)) ? ve.dokAnalysen : [];
  const teDok = dokListe.find(d => d && d.dokTyp === "teilungserklaerung") || null;
  const istMuster = !teDok;
  const punkteRoh = (teDok && Array.isArray(teDok.punkte) && teDok.punkte.length > 0)
    ? teDok.punkte : TE_MUSTER_PUNKTE;
  const punkte = punkteRoh.slice().sort((a, b) => (a.nr || 0) - (b.nr || 0));

  // Counts je Bereich für die Filterleiste.
  const counts = {};
  punkte.forEach(p => { counts[p.bereich] = (counts[p.bereich] || 0) + 1; });
  const aktiveBereiche = TE_BEREICHE.filter(b => counts[b.id]).map(b => b.id);

  const gefiltert = bereichFilter === "alle"
    ? punkte : punkte.filter(p => p.bereich === bereichFilter);

  // Cheatsheet-Druck: nur die „Hoch"-Klauseln, kompakt. Ein synchroner Aufruf
  // über druckeHtml (DESIGN §26.3).
  const druckeCheatsheet = () => {
    const hoch = punkte.filter(p => p.relevanz === "hoch");
    const esc = (s) => String(s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    const rows = hoch.map(p => {
      const b = teBereich(p.bereich);
      return `<tr>
        <td style="white-space:nowrap;color:${b.farbe};font-weight:600">${esc(b.label)}</td>
        <td style="white-space:nowrap">${esc(p.fundstelle)}</td>
        <td><b>${esc(p.punkt)}</b><br><span style="color:#555">${esc(p.bedeutung)}</span></td>
      </tr>`;
    }).join("");
    const body = `<h1>TE-Cheatsheet — wichtige Punkte</h1>
      <p style="color:#555">${esc(ve && ve.nr ? ve.nr : "")} · ${esc(ve && ve.adresse ? ve.adresse : "")}</p>
      <table style="width:100%;border-collapse:collapse;font-size:12px">
        <thead><tr style="text-align:left;border-bottom:2px solid #333">
          <th>Bereich</th><th>Fundstelle</th><th>Punkt / Bedeutung</th></tr></thead>
        <tbody>${rows}</tbody></table>`;
    druckeHtml("TE-Cheatsheet", body, false,
      "td{border-bottom:1px solid #ddd;padding:6px 8px;vertical-align:top}th{padding:6px 8px}");
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {/* Kopfzeile: Titel + Muster-Hinweis + Druck */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: FS.input, fontWeight: FW.heavy, color: t.text }}>
            Teilungserklärung
          </div>
          <div style={{ fontSize: FS.s, color: t.sub }}>
            {punkte.length} Regelungen{teDok && teDok.stand ? ` · Stand ${teDok.stand}` : ""}
          </div>
        </div>
        <button onClick={druckeCheatsheet} style={{
          display: "inline-flex", alignItems: "center", gap: 6,
          padding: "6px 12px", borderRadius: RAD.ms, flexShrink: 0,
          background: "none", border: `1px solid ${t.border}`, color: t.text,
          cursor: "pointer", fontFamily: "inherit", fontSize: FS.m, fontWeight: FW.medium }}>
          <I name="document" size={14} color={t.text}/>
          Cheatsheet drucken
        </button>
      </div>

      {istMuster && (
        <div style={{ display: "flex", alignItems: "flex-start", gap: 8,
          background: accent + "12", border: `1px solid ${accent}33`,
          borderRadius: RAD.md, padding: "9px 12px" }}>
          <I name="sparkles" size={15} color={accent}/>
          <div style={{ fontSize: FS.s, color: t.text, lineHeight: 1.5 }}>
            Muster-Ansicht mit Beispiel-Klauseln. Sobald eine Teilungserklärung
            ausgewertet ist (manuell oder per Dokument-Analyse), erscheinen hier
            die echten Regelungen dieses Objekts.
          </div>
        </div>
      )}

      {/* Bereich-Filter */}
      <FilterButtons arten={TE_BEREICHE} aktive={aktiveBereiche} counts={counts}
        wert={bereichFilter} onWert={setBereichFilter} t={t} accent={accent}/>

      {/* Klausel-Liste (Akkordeon) */}
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {gefiltert.map(p => (
          <TEKlauselKarte key={p.id} punkt={p} t={t} accent={accent}
            offen={offeneKarteId === p.id} onToggle={onAkkordeonToggle}/>
        ))}
        {gefiltert.length === 0 && (
          <div style={{ fontSize: FS.m, color: t.muted, textAlign: "center", padding: "20px 0" }}>
            Keine Regelungen in diesem Bereich.
          </div>
        )}
      </div>
    </div>
  );
}

// Einheitlicher Platzhalter für noch nicht implementierte Reiter im VEDetail.
// ── LegionellenAnsicht: eigener Objekt-Tab für die Trinkwasser-/Legionellen-
// Prüfung (TrinkwV). Strukturierte Daten am Objekt (ve.legionellen):
//   { letzte, befund, naechste, naechsteManuell }. Nächste Fälligkeit
// berechnet sich automatisch aus letzter Prüfung + Befund-Intervall, solange
// nicht manuell überschrieben. Wiederverwendet die Legionellen-Helfer und
// DatumFeld — kein paralleles Konstrukt. Fundament für späteren Ausbau
// (mehrere Probenahmestellen, Historie, Prüfprotokolle).
function LegionellenAnsicht({ ve, setVes, t, accent, editMode = false, kontakte = [], onKontaktClick = null }) {
  const daten = (ve && ve.legionellen) || {};
  const letzte = daten.letzte || "";
  const befund = daten.befund || "unauffaellig";
  const naechsteManuell = !!daten.naechsteManuell;
  const autoNaechste = legionellenNaechste(letzte, befund);
  const naechste = naechsteManuell && daten.naechste ? daten.naechste : autoNaechste;
  const status = legionellenFaelligStatus(naechste);
  const statusFarbe = LEGIONELLEN_STATUS_FARBE[status] || accent;
  const bInfo = legionellenBefund(befund);

  const patch = (neu) => {
    if (!setVes) return;
    setVes(prev => prev.map(v => v.id === ve.id
      ? { ...v, legionellen: { ...((v.legionellen) || {}), ...neu } } : v));
  };
  const setLetzte = (w) => patch({ letzte: w, naechsteManuell: false, naechste: "" });
  const setBefund = (id) => patch({ befund: id, naechsteManuell: false, naechste: "" });
  const setNaechste = (w) => patch({ naechste: w, naechsteManuell: true });

  // Probenahmestellen (Schritt 2+3): Liste am Objekt mit optionaler Verknüpfung
  // zu Raum ODER Einheit (Haus → Raum/Einheit-Picker, identisch zur Technik-
  // Zuordnung). Einheit-Verknüpfung liefert automatisch den Ansprechpartner.
  const stellen = Array.isArray(daten.pruefstellen) ? daten.pruefstellen : [];
  const standorte = legionellenStandorte(ve);
  const hatTiefgarage = standorte.some(h => h && h.kategorie === "tiefgarage");
  const hatGebaeude = standorte.some(h => h && h.kategorie === "gebaeude");
  const standortPlatzhalter = hatTiefgarage
    ? (hatGebaeude ? "— Haus / Tiefgarage —" : "— Tiefgarage —")
    : "— Haus —";
  const [neueBez, setNeueBez] = useState("");
  const [neuHaus, setNeuHaus] = useState("");
  const [neuRaum, setNeuRaum] = useState("");
  const [neuEinheit, setNeuEinheit] = useState("");
  const [formOffen, setFormOffen] = useState(false);
  const [infoOffen, setInfoOffen] = useState(false);
  // Haus-Auswahl nur nötig, wenn mehrere Standorte zur Wahl stehen. Bei genau
  // einem Standort ist er implizit vorgewählt (Dropdown wird ausgeblendet).
  const einzigerStandort = standorte.length === 1 ? standorte[0] : null;
  const effHausId = neuHaus || (einzigerStandort ? String(einzigerStandort.id) : "");
  const aktHaus = standorte.find(h => String(h.id) === String(effHausId)) || null;
  const verfEinheiten = aktHaus ? (aktHaus.einheiten || []) : [];
  const aktEinheit = verfEinheiten.find(e => String(e.id) === String(neuEinheit)) || null;
  // Räume: aus der gewählten Einheit (über ihre Teile), sonst aus dem Haus
  // (Gemeinschaftsräume wie Heizraum). „Vom Groben zum Feinen": Haus → Einheit → Raum.
  const einheitRaeume = (eh) => {
    if (!eh || !Array.isArray(eh.teile)) return [];
    const out = [];
    eh.teile.forEach(teil => {
      (teil && Array.isArray(teil.raeume) ? teil.raeume : []).forEach(r => { if (r) out.push(r); });
    });
    return out;
  };
  const verfRaeume = aktEinheit ? einheitRaeume(aktEinheit) : (aktHaus ? (aktHaus.raeume || []) : []);
  const formReset = () => { setNeueBez("");
    setNeuHaus(""); setNeuRaum(""); setNeuEinheit(""); setFormOffen(false); };
  const stellenPatch = (liste) => patch({ pruefstellen: liste });
  // Pflicht: ein Raum (aus Einheit ODER aus der Gemeinschaft/Haus). Notiz optional.
  const verknuepfungGesetzt = !!neuRaum;
  const stelleHinzu = () => {
    if (!verknuepfungGesetzt) return;
    stellenPatch(stellen.concat([{ id: Date.now(),
      hausId: effHausId || null, raumId: neuRaum || null,
      einheitId: neuEinheit || null, notiz: neueBez.trim() }]));
    formReset();
  };
  const stelleLoeschen = (id) => stellenPatch(stellen.filter(s => s.id !== id));
  // Verknüpfungs-Anzeige je Stelle: Raum ist Pflicht; Einheit (falls gesetzt)
  // als Kontext davor + Ansprechpartner. Reine Gemeinschaftsräume: nur Raum.
  const stelleVerknuepfung = (s) => {
    const raum = s.raumId ? legionellenFindeRaum(ve, s.raumId) : null;
    const raumLabel = s.raumId ? (raum ? raum.name : "Raum (entfernt)") : null;
    if (s.einheitId) {
      const eh = legionellenFindeEinheit(ve, s.einheitId);
      const ap = legionellenAnsprechpartner(ve, s.einheitId, kontakte);
      const ehLabel = eh ? ("Einheit " + (eh.nr || "")) : "Einheit (entfernt)";
      const label = raumLabel ? (ehLabel + " · " + raumLabel) : ehLabel;
      return { typ: "einheit", label: label, ansprech: ap };
    }
    if (s.raumId) {
      return { typ: "raum", label: "Raum " + (raum ? raum.name : "(entfernt)"), ansprech: null };
    }
    return null;
  };

  const statusText = !naechste ? "Keine Prüfung erfasst"
    : status === "ueberfaellig" ? "Überfällig"
    : status === "bald" ? "Bald fällig"
    : "Im Plan";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {/* Status-Kopf mit Ampel */}
      <div style={{ background: t.card, border: `1px solid ${t.border}`,
        borderRadius: RAD.lg, padding: "16px 18px", display: "flex",
        alignItems: "center", gap: 14 }}>
        <div style={{ width: 44, height: 44, borderRadius: RAD.lg, flexShrink: 0,
          background: statusFarbe + "1A", display: "flex", alignItems: "center",
          justifyContent: "center" }}>
          <I name="drop" size={22} color={statusFarbe}/>
        </div>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ fontSize: FS.input, fontWeight: FW.heavy, color: statusFarbe }}>
            {naechste ? ("Nächste Prüfung: " + naechste) : "Keine Prüfung erfasst"}
          </div>
          <div style={{ fontSize: FS.m, color: t.sub, marginTop: 2 }}>
            {statusText}
            {letzte ? (" · Letzte: " + datumAnzeige(letzte)) : ""}
          </div>
        </div>
      </div>

      {/* Erfassung — im Lese-Modus reine Anzeige, im Edit befüllbar */}
      <div style={{ background: t.card, border: `1px solid ${t.border}`,
        borderRadius: RAD.lg, padding: "16px 18px", display: "flex",
        flexDirection: "column", gap: 14 }}>
        <div>
          <div style={{ fontSize: FS.xs, color: t.muted, marginBottom: 4 }}>Letzte Prüfung</div>
          {editMode ? (
            <DatumFeld value={letzte} t={t} accent={accent} defaultHeute={false}
              onChange={setLetzte}/>
          ) : (
            <div style={{ fontSize: FS.input, color: letzte ? t.text : t.muted }}>
              {letzte ? datumAnzeige(letzte) : "—"}
            </div>
          )}
        </div>
        <div>
          <div style={{ fontSize: FS.xs, color: t.muted, marginBottom: 4 }}>Befund</div>
          {editMode ? (
            <select value={befund} onChange={e => setBefund(e.target.value)}
              style={{ width: "100%", boxSizing: "border-box", background: t.surface,
                border: `1px solid ${accent}60`, borderRadius: RAD.sm,
                padding: "7px 10px", fontSize: FS.input, color: t.text,
                outline: "none", fontFamily: "inherit", appearance: "auto" }}>
              {LEGIONELLEN_BEFUNDE.map(b => (
                <option key={b.id} value={b.id}>{b.label} ({b.kurz})</option>
              ))}
            </select>
          ) : (
            <div style={{ fontSize: FS.input, color: t.text }}>
              {bInfo.label} ({bInfo.kurz})
            </div>
          )}
        </div>
        <div>
          <div style={{ display: "flex", alignItems: "baseline",
            justifyContent: "space-between", marginBottom: 4 }}>
            <span style={{ fontSize: FS.xs, color: t.muted }}>Nächste fällig</span>
            {editMode && naechsteManuell && (
              <button onClick={() => patch({ naechsteManuell: false, naechste: "" })}
                style={{ background: "none", border: "none", cursor: "pointer", padding: 0,
                  fontSize: FS.xs, color: accent, fontFamily: "inherit" }}>Auto</button>
            )}
          </div>
          {editMode ? (
            <DatumFeld value={naechste} t={t} accent={accent} defaultHeute={false}
              onChange={setNaechste}/>
          ) : (
            <div style={{ fontSize: FS.input, color: naechste ? t.text : t.muted }}>
              {naechste ? datumAnzeige(naechste) : "—"}
            </div>
          )}
          {!naechsteManuell && autoNaechste && (
            <div style={{ fontSize: FS.xs, color: t.muted, marginTop: 4 }}>
              Automatisch {bInfo.kurz} ab letzter Prüfung
            </div>
          )}
        </div>
      </div>

      {/* Probenahmestellen */}
      <div style={{ background: t.card, border: `1px solid ${t.border}`,
        borderRadius: RAD.lg, padding: "16px 18px", display: "flex",
        flexDirection: "column", gap: 12 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span style={{ fontSize: FS.input, fontWeight: FW.heavy, color: t.text }}>
            Probenahmestellen
          </span>
          <span style={{ fontSize: FS.xs, color: t.muted }}>
            {stellen.length} {stellen.length === 1 ? "Stelle" : "Stellen"}
          </span>
        </div>

        {/* Aufklappbarer Erklärtext: Pflicht-Probenahmestellen & Zweck */}
        <div>
          <span onClick={() => setInfoOffen(o => !o)}
            style={{ display: "inline-flex", alignItems: "center", gap: 5,
              fontSize: FS.xs, fontWeight: FW.bold, color: accent, cursor: "pointer",
              letterSpacing: "0.02em" }}>
            {infoOffen ? "Erklärung ausblenden" : "Welche Stellen sind Pflicht?"}
          </span>
          {infoOffen && (
            <div style={{ marginTop: 10, background: t.surface,
              border: `1px solid ${t.border}`, borderRadius: RAD.sm,
              padding: "12px 14px", display: "flex", flexDirection: "column", gap: 12 }}>
              <div>
                <div style={{ fontSize: FS.xs, fontWeight: FW.bold, color: t.muted,
                  textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 6 }}>
                  Pflicht-Probenahmestellen und ihr Zweck
                </div>
                <div style={{ fontSize: FS.m, color: t.sub, lineHeight: 1.5,
                  display: "flex", flexDirection: "column", gap: 7 }}>
                  <div><strong style={{ color: t.text }}>Warmwasserabgang</strong> — prüft, ob der Speicher das Wasser ausreichend erhitzt (≥ 60 °C) und hygienisch abgibt.</div>
                  <div><strong style={{ color: t.text }}>Zirkulationsrücklauf</strong> — zeigt, ob die Temperatur im gesamten Zirkulationssystem gehalten wird (≥ 55 °C), also ob das System „gesund" bleibt.</div>
                  <div><strong style={{ color: t.text }}>Entfernteste Dusche je Steigstrang</strong> — prüft, ob das Wasser bis zur letzten Zapfstelle hygienisch bleibt und keine Stagnation/Abkühlung stattfindet.</div>
                  <div><strong style={{ color: t.text }}>Weitere repräsentative Duschen</strong> (falls mehrere Stränge oder komplexe Verteilung) — stellt sicher, dass alle hydraulisch relevanten Bereiche des Gebäudes abgedeckt sind.</div>
                </div>
              </div>
              <div style={{ borderTop: `1px solid ${t.border}`, paddingTop: 10 }}>
                <div style={{ fontSize: FS.xs, fontWeight: FW.bold, color: t.muted,
                  textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 6 }}>
                  Warum genau diese Stellen?
                </div>
                <div style={{ fontSize: FS.m, color: t.sub, lineHeight: 1.5,
                  display: "flex", flexDirection: "column", gap: 5 }}>
                  <div><strong style={{ color: t.text }}>Speicherabgang</strong> = Funktion des Erhitzers</div>
                  <div><strong style={{ color: t.text }}>Zirkulationsrücklauf</strong> = Funktion der Temperaturhaltung im System</div>
                  <div><strong style={{ color: t.text }}>Entfernteste Dusche</strong> = Funktion der hygienischen Verteilung bis zum Ende des Systems</div>
                </div>
                <div style={{ fontSize: FS.m, color: t.sub, lineHeight: 1.5, marginTop: 9,
                  fontStyle: "italic" }}>
                  Erst alle drei zusammen ergeben ein vollständiges Bild der Warmwasserhygiene.
                </div>
              </div>
            </div>
          )}
        </div>

        {stellen.length === 0 && !formOffen && (
          <div style={{ fontSize: FS.m, color: t.sub }}>
            Noch keine Probenahmestellen erfasst. Typisch: eine am
            Warmwasserspeicher, weitere in repräsentativen Wohneinheiten.
          </div>
        )}

        {stellen.map(s => {
          const vk = stelleVerknuepfung(s);
          // Notiz: neues Feld; Altbestand-Fallback auf frühere "bezeichnung".
          const notizText = (s.notiz && s.notiz.trim()) || (s.bezeichnung && s.bezeichnung.trim()) || "";
          const kopf = vk ? vk.label : (notizText || "Probenahmestelle");
          return (
          <div key={s.id} style={{ display: "flex", alignItems: "center", gap: 10,
            background: t.surface, border: `1px solid ${t.border}`,
            borderRadius: RAD.sm, padding: "9px 12px" }}>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ fontSize: FS.m, fontWeight: 600, color: t.text,
                overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {kopf}
                {vk && vk.ansprech ? (
                  <span style={{ fontWeight: 400, color: t.muted }}> · <span
                    onClick={() => onKontaktClick && vk.ansprech && onKontaktClick(vk.ansprech.id)}
                    style={{ color: accent, cursor: onKontaktClick ? "pointer" : "default" }}>
                    {vk.ansprech.name}</span></span>
                ) : (vk && vk.typ === "einheit" ? (
                  <span style={{ fontWeight: 400, color: t.muted }}> · kein Ansprechpartner</span>
                ) : null)}
              </div>
              {notizText && vk && (
                <div style={{ fontSize: FS.xs, color: t.muted, marginTop: 2,
                  overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {notizText}
                </div>
              )}
            </div>
            {editMode && (
              <button onClick={() => stelleLoeschen(s.id)} aria-label="Löschen"
                style={{ flexShrink: 0, background: "none", border: "none",
                  cursor: "pointer", padding: 4, display: "flex", alignItems: "center" }}>
                <I name="trash" size={15} color={t.muted}/>
              </button>
            )}
          </div>
          );
        })}

        {editMode && (formOffen ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 10,
            background: t.surface, border: `1px solid ${accent}40`,
            borderRadius: RAD.sm, padding: "12px 14px" }}>

            {/* Verknüpfung: Haus → Einheit → Raum (vom Groben zum Feinen).
                Raum ist Pflicht; Einheit optional (leer = Gemeinschaft/Haus-Raum). */}
            {standorte.length > 0 ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <div style={{ fontSize: FS.xs, fontWeight: FW.bold, color: t.muted,
                  textTransform: "uppercase", letterSpacing: "0.05em" }}>
                  Verknüpfung (Raum ist Pflicht)
                </div>

                {/* Haus nur zur Auswahl, wenn mehrere Standorte existieren. */}
                {standorte.length > 1 && (
                  <select value={neuHaus}
                    onChange={e => { setNeuHaus(e.target.value); setNeuEinheit(""); setNeuRaum(""); }}
                    style={{ width: "100%", boxSizing: "border-box", background: t.card,
                      border: `1px solid ${t.border}`, borderRadius: RAD.sm,
                      padding: "8px 10px", fontSize: FS.input, color: t.text,
                      outline: "none", fontFamily: "inherit", appearance: "auto" }}>
                    <option value="">{standortPlatzhalter}</option>
                    {standorte.map(h => (
                      <option key={h.id} value={h.id}>{h.name}</option>
                    ))}
                  </select>
                )}

                {/* Einheit (optional) — schaltet die Raum-Quelle um. */}
                <select value={neuEinheit}
                  onChange={e => { setNeuEinheit(e.target.value); setNeuRaum(""); }}
                  disabled={!aktHaus || verfEinheiten.length === 0}
                  style={{ width: "100%", boxSizing: "border-box", background: t.card,
                    border: `1px solid ${t.border}`, borderRadius: RAD.sm,
                    padding: "8px 10px", fontSize: FS.input, color: t.text,
                    outline: "none", fontFamily: "inherit", appearance: "auto",
                    opacity: (!aktHaus || verfEinheiten.length === 0) ? 0.5 : 1 }}>
                  <option value="">
                    {!aktHaus ? "Einheit"
                      : verfEinheiten.length === 0 ? "keine Einheiten"
                      : "— Einheit (optional, sonst Gemeinschaft) —"}
                  </option>
                  {verfEinheiten.map(eh => (
                    <option key={eh.id} value={eh.id}>{eh.nr || "Einheit"}{eh.lage ? ` · ${eh.lage}` : ""}</option>
                  ))}
                </select>

                {/* Raum (Pflicht) — aus Einheit oder aus dem Haus (Gemeinschaft). */}
                <select value={neuRaum}
                  onChange={e => setNeuRaum(e.target.value)}
                  disabled={!aktHaus || verfRaeume.length === 0}
                  style={{ width: "100%", boxSizing: "border-box", background: t.card,
                    border: `1px solid ${t.border}`, borderRadius: RAD.sm,
                    padding: "8px 10px", fontSize: FS.input, color: t.text,
                    outline: "none", fontFamily: "inherit", appearance: "auto",
                    opacity: (!aktHaus || verfRaeume.length === 0) ? 0.5 : 1 }}>
                  <option value="">
                    {!aktHaus ? "Raum"
                      : verfRaeume.length === 0
                        ? (aktEinheit ? "keine Räume in dieser Einheit" : "keine Gemeinschaftsräume")
                      : (aktEinheit ? "— Raum der Einheit —" : "— Raum (Gemeinschaft) —")}
                  </option>
                  {verfRaeume.map(r => (
                    <option key={r.id} value={r.id}>{r.name}{r.lage ? ` (${r.lage})` : ""}</option>
                  ))}
                </select>
              </div>
            ) : (
              <div style={{ fontSize: FS.xs, color: t.muted }}>
                Noch keine Häuser/Räume/Einheiten am Objekt — bitte zuerst anlegen.
              </div>
            )}

            {/* Notiz (optional): Zugang / wo genau */}
            <div style={{ display: "flex", flexDirection: "column", gap: 6,
              paddingTop: 4, borderTop: `1px solid ${t.border}` }}>
              <div style={{ fontSize: FS.xs, fontWeight: FW.bold, color: t.muted,
                textTransform: "uppercase", letterSpacing: "0.05em" }}>
                Notiz (optional)
              </div>
              <input value={neueBez} onChange={e => setNeueBez(e.target.value)}
                placeholder="z.B. wo genau? Bezeichnung Ort, Zugang/Schlüssel"
                style={{ width: "100%", boxSizing: "border-box", background: t.card,
                  border: `1px solid ${t.border}`, borderRadius: RAD.sm,
                  padding: "9px 11px", fontSize: FS.input, color: t.text,
                  outline: "none", fontFamily: "inherit" }}/>
            </div>

            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={formReset}
                style={{ flex: 1, padding: "9px 0", borderRadius: RAD.sm,
                  border: `1px solid ${t.border}`, background: "none",
                  color: t.sub, fontSize: FS.m, fontWeight: 600,
                  cursor: "pointer", fontFamily: "inherit" }}>
                Abbrechen
              </button>
              <button onClick={stelleHinzu} disabled={!verknuepfungGesetzt}
                style={{ flex: 1, padding: "9px 0", borderRadius: RAD.sm,
                  border: "none", background: verknuepfungGesetzt ? accent : t.border,
                  color: verknuepfungGesetzt ? "#fff" : t.muted, fontSize: FS.m,
                  fontWeight: 700, cursor: verknuepfungGesetzt ? "pointer" : "default",
                  fontFamily: "inherit" }}>
                Hinzufügen
              </button>
            </div>
          </div>
        ) : (
          <button onClick={() => setFormOffen(true)}
            style={{ display: "flex", alignItems: "center", justifyContent: "center",
              gap: 6, padding: "9px 0", borderRadius: RAD.sm,
              border: `1px dashed ${accent}80`, background: "none",
              color: accent, fontSize: FS.m, fontWeight: 600,
              cursor: "pointer", fontFamily: "inherit" }}>
            <I name="plus" size={14} color={accent}/>Probenahmestelle hinzufügen
          </button>
        ))}
      </div>

      {/* Fachlicher Hinweis */}
      <div style={{ background: t.surface, border: `1px solid ${t.border}`,
        borderRadius: RAD.md, padding: "12px 16px" }}>
        <div style={{ fontSize: FS.xs, fontWeight: FW.bold, color: t.muted,
          textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6 }}>
          Turnus nach TrinkwV
        </div>
        <div style={{ fontSize: FS.m, color: t.text, lineHeight: 1.5 }}>
          Unauffällig → alle 3 Jahre. Bei Überschreitung des Maßnahmenwerts:
          Nachbeprobung nach 3 Monaten, dann nach 1 Jahr, anschließend
          zurück in den 3-Jahres-Rhythmus.
        </div>
      </div>
    </div>
  );
}

function PlatzhalterReiter({ t, accent, icon, titel, beschreibung, punkte }) {
  return (
    <div style={{ background: t.card, border: `1px solid ${t.border}`,
      borderRadius: RAD.lg, padding: "24px 18px", textAlign: "center" }}>
      <div style={{ width: 56, height: 56, borderRadius: RAD.lg, margin: "0 auto 14px",
        background: accent + "18", display: "flex", alignItems: "center",
        justifyContent: "center" }}>
        <I name={icon} size={26} color={accent}/>
      </div>
      <div style={{ fontSize: FS.input, fontWeight: FW.heavy, color: t.text, marginBottom: 6 }}>
        {titel}
      </div>
      <div style={{ fontSize: FS.m, color: t.sub, marginBottom: 14, lineHeight: 1.5,
        maxWidth: 480, margin: "0 auto 14px" }}>
        {beschreibung}
      </div>
      <div style={{ display: "inline-block", fontSize: FS.xxs, fontWeight: FW.bold,
        color: accent, background: accent + "15", letterSpacing: "0.08em",
        textTransform: "uppercase", padding: "3px 9px", borderRadius: RAD.pill,
        marginBottom: 14 }}>
        Funktion folgt
      </div>
      {punkte && punkte.length > 0 && (
        <div style={{ background: t.surface, border: `1px solid ${t.border}`,
          borderRadius: RAD.md, padding: "12px 16px", maxWidth: 480, margin: "0 auto",
          textAlign: "left" }}>
          <div style={{ fontSize: FS.xs, fontWeight: FW.bold, color: t.muted,
            textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8 }}>
            Geplant
          </div>
          <ul style={{ margin: 0, padding: 0, listStyle: "none",
            display: "flex", flexDirection: "column", gap: 6 }}>
            {punkte.map((p, i) => (
              <li key={i} style={{ display: "flex", alignItems: "flex-start",
                gap: 8, fontSize: FS.m, color: t.text }}>
                <span style={{ color: accent, marginTop: 2 }}>·</span>
                {p}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}


export {
  EinheitKachel, FeldEinheitKarte, FeldEinheitenSammelKarte, FeldObjektKarte, FilterButtons,
  HANDLUNGSBEDARF_QUELLEN, STAT_WOHN_TYPEN, StatBalkenZeile, StatKpi, StatPanel,
  StatusLeiste, VEDetail, VEKachel, VEListenZeile, ObjekteMasterDetail, alleEinheitenVonVe,
  berechneKontaktStatus, hbQuelleAktiv, hbVorlauf
};
