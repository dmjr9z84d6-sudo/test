import React, { useState, useRef, useEffect, Fragment } from "react";
import { FS, FW, RAD, getContrastColor } from "./constants.js";
import {
  BEWOHNER_RECHTE, aktiveBelegung, bewohnerRecht, teileVon
} from "./datenmodell.js";
import {
  I, SortierPfeile, stabilisiereScroll, useAlleKontakte, useFirmenRollen, useKartenIcons, useKontaktFarbe,
  useOutsideClick, useRollen, zuweisungenFuerAvatar
} from "./utils-icons.jsx";
import { Avatar, KontaktPicker } from "./components.jsx";
// ╔═════════════════════════════════════════════════════════════════════════╗
// ║ SEKTION 5d · KONTAKT-KATEGORIEN — ausgelagertes Modul                   ║
// ║ KONTAKT_KATEGORIEN · KontaktKategorieKarte · VEKontakteTab ·            ║
// ║ KontaktZeile · CustomKriterienEditor · sammleFuerKategorie             ║
// ╚═════════════════════════════════════════════════════════════════════════╝
// ZYKLISCHER Import aus der Hauptdatei: S5-Kern-Helfer (Laufzeit-Auflösung).
import { KontaktDetailKarte } from "./kontakte-modul.jsx";
import {
  KARTEN_ICONS, KontaktZuweisungForm, buildInitialKarten
} from "./liegenschaft.jsx";

// ── VEKontakteTab (Personen+Dienstleister gruppiert nach Rolle) ─────────────
// ── KONTAKT_KATEGORIEN: Kategorien für den Kontakte-Tab im VEDetail ─────────
// Reihenfolge ist die Anzeige-Reihenfolge. Personen-Kategorien gruppieren
// nach Rollen, Firmen-Kategorien nach Tätigkeitsbereich (Vertrag/Versorgung/
// einmaliger Auftrag).
// Die `defaultFarbe` ist ein Fallback. Im Render ziehen wir die Farbe primär
// aus den Rollen-Einstellungen (Settings → Rollen): die erste Rolle der
// Kategorie bestimmt die Farbe. So bleibt die Farbe konsistent zum Avatar-Badge
// und reagiert auf Einstellungs-Änderungen.
const KONTAKT_KATEGORIEN = [
  { id: "eigentuemer", label: "Eigentümer", icon: "🏷", defaultFarbe: "#F472B6", typ: "person",
    rollen: ["Eigentümer"],
    sub: "Eigentümer der Einheiten" },
  { id: "bewohner", label: "Bewohner", icon: "🏠", defaultFarbe: "#22C55E", typ: "person",
    rollen: null, bewohnerRechte: ["mieter", "eigennutzer", "niessbraucher", "wohnberechtigt", "angehoeriger", "sonstige"],
    sub: "Alle aktuellen Bewohner laut Belegung" },
  { id: "mieter", label: "Mieter", icon: "🔑", defaultFarbe: "#0EA5E9", typ: "person",
    rollen: null, bewohnerRechte: ["mieter"],
    sub: "Bewohner mit Mietvertrag" },
  { id: "gremium", label: "Gremium", icon: "👥", defaultFarbe: "#15803D", typ: "person",
    rollen: ["Verwaltungsbeirat", "Rechnungsprüfer", "Bevollmächtigter"],
    sub: "Verwaltungsbeirat · Rechnungsprüfer · Bevollmächtigte" },
  { id: "vertraglich", label: "Vertragliche Dienstleister", icon: "📄", defaultFarbe: "#2563EB", typ: "firma",
    rollen: ["Hausverwaltung", "Hausmeister", "Wartung", "Brandschutz", "Winterdienst",
             "Grünpflege", "Reinigung", "Messdienst", "Versicherung"],
    sub: "Hausmeister, Reinigung, Wartung, Versicherung etc." },
  { id: "versorger", label: "Ver- und Entsorger", icon: "⚡", defaultFarbe: "#EA580C", typ: "firma",
    rollen: ["Versorger", "Müllabfuhr"],
    sub: "Strom, Gas, Wasser, Müllabfuhr" },
  { id: "gelegentlich", label: "Gelegentliche Aufträge", icon: "🛠", defaultFarbe: "#71717A", typ: "firma",
    rollen: null, // null = keine Rolle ODER Sammelrolle "Dienstleister"
    sub: "Einmaltätigkeiten ohne feste Rolle" },
];

// Aktuelle Farbe einer Kategorie: aus den Rollen-Einstellungen, sonst Default.
function farbeFuerKategorie(kat, personenRollen, firmenRollen) {
  // Bewohner-Kategorien: eigene defaultFarbe (erlaubt z. B. Mieter eine eigene
  // Farbe trotz gleicher Rechtsgrundlagen-Farbe), sonst Farbe der ersten Rechtsgrundlage.
  if (kat.bewohnerRechte && kat.bewohnerRechte.length > 0) {
    if (kat.defaultFarbe) return kat.defaultFarbe;
    const r = bewohnerRecht(kat.bewohnerRechte[0]);
    if (r && r.farbe) return r.farbe;
    return kat.defaultFarbe;
  }
  if (!kat.rollen || kat.rollen.length === 0) return kat.defaultFarbe;
  const rollenListe = kat.typ === "firma" ? firmenRollen : personenRollen;
  // Erste passende, aktive Rolle bestimmt die Farbe
  for (const rname of kat.rollen) {
    const def = (rollenListe || []).find(r => r.name === rname && r.aktiv !== false);
    if (def && def.color) return def.color;
  }
  return kat.defaultFarbe;
}

// Findet alle Kontakte, die zu einer Kategorie passen.
// Liefert eine Liste von Kontakt-Objekten zurück, denen für die Bewohner-
// Kategorien ein abgeleiteter `_bezug` (Einheit · Recht) angehängt wird, damit
// KontaktZeile den Bezug ohne objektZuweisung anzeigen kann.
function sammleFuerKategorie(kat, ve, kontakte) {
  // ── Bewohner-Kategorien: aus den aktiven Belegungen der Einheiten ableiten ──
  // Die Bewohner sitzen in belegung.haushalt.mitglieder[] mit eigener
  // Rechtsgrundlage (recht). Eine objektZuweisung existiert dafür NICHT.
  if (kat.bewohnerRechte && kat.bewohnerRechte.length > 0) {
    const rechteSet = kat.bewohnerRechte;
    // Pro Kontakt-ID den ersten Treffer merken (Einheit-Bez. + Recht-Label),
    // damit jemand mit mehreren Einheiten nur einmal in der Liste steht.
    const gefunden = new Map(); // kontaktId -> bezugString
    (ve.einheiten || []).forEach(e => {
      const einheitBez = e.nr || e.bez || "";
      teileVon(e).forEach(teil => {
        const beleg = aktiveBelegung(teil);
        if (!beleg || !beleg.haushalt) return;
        (beleg.haushalt.mitglieder || []).forEach(m => {
          if (!m || m.kontaktId == null) return;
          if (rechteSet.indexOf(m.recht) < 0) return;
          if (gefunden.has(m.kontaktId)) return;
          const rl = bewohnerRecht(m.recht);
          const bezug = [einheitBez, rl && rl.label].filter(Boolean).join(" · ");
          gefunden.set(m.kontaktId, bezug);
        });
      });
    });
    const out = [];
    (kontakte || []).forEach(k => {
      if (k.typ !== "person") return;
      if (!gefunden.has(k.id)) return;
      out.push({ ...k, _bezug: gefunden.get(k.id) });
    });
    return out;
  }
  return (kontakte || []).filter(k => {
    if (k.typ !== kat.typ) return false;
    return (k.objektZuweisungen || []).some(z => {
      if (z.objektId !== ve.id) return false;
      if (kat.rollen === null) {
        // Gelegentlich: ohne Rolle oder Sammelrolle "Dienstleister"
        return !z.rolle || z.rolle === "Dienstleister";
      }
      return kat.rollen.includes(z.rolle);
    });
  });
}

// ── Sortierung der Kontakte in einer Gruppen-Karte ──────────────────────────
// Sinnvolle Sortier-Optionen je Kartentyp. Personen können nach Einheit (WE)
// sortiert werden, Firmen nicht. Alle können nach Name / Rolle / zuletzt.
function sortOptionenFuer(kat) {
  const opts = [{ id: "name", label: "Name (A–Z)" }];
  if (kat.typ === "person") opts.push({ id: "einheit", label: "Einheit / WE" });
  opts.push({ id: "rolle", label: "Rolle" });
  opts.push({ id: "zuletzt", label: "Zuletzt hinzugefügt" });
  return opts;
}

// Sortiert eine Kontaktliste nach Modus. ve wird für die Einheiten-Sortierung
// benötigt (Bezug = Einheit). "zuletzt" nutzt die Reihenfolge im Array (neueste
// zuletzt) und kehrt sie um. Mutiert die Eingabe NICHT.
function sortiereKontakte(items, modus, ve) {
  const liste = (items || []).slice();
  const nameOf = (k) => (k.typ === "firma"
    ? (k.name || "")
    : `${k.nachname || ""} ${k.vorname || ""}`.trim() || k.name || "").toLowerCase();
  const rolleOf = (k) => {
    const z = (k.objektZuweisungen || []).find(x => ve && x.objektId === ve.id && x.rolle);
    return (z && z.rolle ? z.rolle : "").toLowerCase();
  };
  const einheitOf = (k) => (k._bezug || "").toLowerCase();
  if (modus === "name") liste.sort((a, b) => nameOf(a).localeCompare(nameOf(b)));
  else if (modus === "rolle") liste.sort((a, b) => rolleOf(a).localeCompare(rolleOf(b)) || nameOf(a).localeCompare(nameOf(b)));
  else if (modus === "einheit") liste.sort((a, b) => einheitOf(a).localeCompare(einheitOf(b), undefined, { numeric: true }) || nameOf(a).localeCompare(nameOf(b)));
  else if (modus === "zuletzt") liste.reverse();
  return liste;
}

// ── Sammelt Kontakte für eine FREI definierte Gruppe ────────────────────────
// Kriterien mischbar: rollen[] (über objektZuweisungen.rolle, Person ODER Firma)
// UND rechte[] (Bewohner-Rechtsgrundlagen über die Belegung). Optional zusätzlich
// auf bestimmte Gebäude/Bereiche eingrenzen: gebaeudeEinheitIds = Set von
// Einheiten-IDs, die zu den gewählten Liegenschafts-Karten gehören. Ist es null,
// wird nicht räumlich gefiltert. Dedupliziert pro Kontakt-ID.
function sammleFuerCustom(rollen, rechte, ve, kontakte, gebaeudeEinheitIds) {
  const rollenSet = rollen || [];
  const rechteSet = rechte || [];
  const raeumlich = gebaeudeEinheitIds || null; // Set oder null
  const einheitErlaubt = (einheitId) => !raeumlich || (einheitId != null && raeumlich.has(einheitId));
  const ausgewaehlt = new Map(); // kontaktId -> bezugString (oder "")
  // 1) Rechtsgrundlagen aus der Belegung — nur in erlaubten Einheiten.
  if (rechteSet.length > 0) {
    (ve.einheiten || []).forEach(e => {
      if (!einheitErlaubt(e.id)) return;
      const einheitBez = e.nr || e.bez || "";
      teileVon(e).forEach(teil => {
        const beleg = aktiveBelegung(teil);
        if (!beleg || !beleg.haushalt) return;
        (beleg.haushalt.mitglieder || []).forEach(m => {
          if (!m || m.kontaktId == null) return;
          if (rechteSet.indexOf(m.recht) < 0) return;
          if (ausgewaehlt.has(m.kontaktId)) return;
          const rl = bewohnerRecht(m.recht);
          const bezug = [einheitBez, rl && rl.label].filter(Boolean).join(" · ");
          ausgewaehlt.set(m.kontaktId, bezug);
        });
      });
    });
  }
  // 2) Rollen über objektZuweisungen (Person UND Firma). Bei räumlichem Filter
  //    zählt eine Zuweisung nur, wenn ihre Einheit erlaubt ist. Zuweisungen OHNE
  //    Einheitenbezug (z. B. Hausverwaltung fürs ganze Objekt) gelten nur, wenn
  //    KEIN Gebäude-Filter gesetzt ist.
  if (rollenSet.length > 0) {
    (kontakte || []).forEach(k => {
      if (ausgewaehlt.has(k.id)) return;
      const hit = (k.objektZuweisungen || []).some(z => {
        if (z.objektId !== ve.id || !z.rolle || rollenSet.indexOf(z.rolle) < 0) return false;
        if (!raeumlich) return true;
        return z.einheitId != null && raeumlich.has(z.einheitId);
      });
      if (hit) ausgewaehlt.set(k.id, "");
    });
    // Eigentümer hängen oft direkt an der Einheit (einheit.eigentuemer[]), nicht
    // an objektZuweisungen. Bei aktivem Gebäude-Filter UND ausgewählter Rolle
    // „Eigentümer" diese ebenfalls berücksichtigen.
    if (raeumlich && rollenSet.indexOf("Eigentümer") >= 0) {
      (ve.einheiten || []).forEach(e => {
        if (!einheitErlaubt(e.id)) return;
        (e.eigentuemer || []).forEach(et => {
          if (et.kontaktId != null && !ausgewaehlt.has(et.kontaktId)) {
            ausgewaehlt.set(et.kontaktId, e.nr || e.bez || "");
          }
        });
      });
    }
  }
  const out = [];
  (kontakte || []).forEach(k => {
    if (!ausgewaehlt.has(k.id)) return;
    const bez = ausgewaehlt.get(k.id);
    out.push(bez ? { ...k, _bezug: bez } : k);
  });
  return out;
}

// ── Objektbezug eines Kontakts: aktive Rolle(n) bzw. Bewohner-Recht zu DIESEM
//    Objekt, plus passende Farbe. Für die Kontakt-Auswahlliste (Untertitel +
//    Avatar-Farbe). Liefert { hatBezug, label, farbe }.
function objektBezugInfo(kontakt, ve, personenRollen, firmenRollen, farben) {
  const fallbackFarbe = (farben && (kontakt.typ === "firma" ? farben.firma : farben.person))
    || "#64748B";
  // 1) Aktive Rollen aus objektZuweisungen für dieses Objekt.
  const rollen = [];
  (kontakt.objektZuweisungen || []).forEach(z => {
    if (z.objektId !== ve.id) return;
    if (z.status === "ehemalig" || z.status === "werdend") return;
    if (z.rolle && rollen.indexOf(z.rolle) < 0) rollen.push(z.rolle);
  });
  if (rollen.length > 0) {
    // Farbe/Def in der typgerechten Liste suchen, mit Fallback auf die andere
    // (z. B. SEV-Rolle steht in personenRollen, kann aber an einer Firma hängen).
    const primaer = kontakt.typ === "firma" ? firmenRollen : personenRollen;
    const sekundaer = kontakt.typ === "firma" ? personenRollen : firmenRollen;
    let farbe = fallbackFarbe;
    for (const rname of rollen) {
      const def = (primaer || []).find(r => r.name === rname && r.aktiv !== false)
        || (sekundaer || []).find(r => r.name === rname && r.aktiv !== false);
      if (def && def.color) { farbe = def.color; break; }
    }
    return { hatBezug: true, label: rollen.join(" · "), farbe };
  }
  // 2) Bewohner-Recht aus aktiven Belegungen.
  let recht = null;
  (ve.einheiten || []).some(e => teileVon(e).some(teil => {
    const beleg = aktiveBelegung(teil);
    if (!beleg || !beleg.haushalt) return false;
    return (beleg.haushalt.mitglieder || []).some(m => {
      if (m && m.kontaktId === kontakt.id && m.recht) { recht = m.recht; return true; }
      return false;
    });
  }));
  if (recht) {
    const rl = bewohnerRecht(recht);
    return { hatBezug: true, label: "Bewohner: " + (rl && rl.label ? rl.label : recht),
      farbe: (rl && rl.farbe) || fallbackFarbe };
  }
  return { hatBezug: false, label: "Kein Bezug", farbe: fallbackFarbe };
}

// Liegenschafts-Karten mit Einheiten (Gebäude / Tiefgarage / Stellplätze) als
// Filter-Optionen für eigene Gruppen. Liefert {id, name, icon, einheitIds[]}.
function liegenschaftsBereiche(ve) {
  const karten = (ve && Array.isArray(ve.karten) && ve.karten.length > 0)
    ? ve.karten : (typeof buildInitialKarten === "function" ? buildInitialKarten(ve) : []);
  return (karten || [])
    .filter(k => Array.isArray(k.einheiten) && k.einheiten.length > 0)
    .map(k => ({
      id: k.id, name: k.name, icon: k.icon || "🏠",
      einheitIds: k.einheiten.map(e => e.id),
    }));
}

// ── KontaktZeile: kompakte Liste-Zeile pro Kontakt im VE-Kontakte-Tab ───────
// Analog zu EinheitZeile (Avatar/Icon links, Name, Bezug+Tel mitte, Chevron rechts).
// `accent` = Kategorie-Farbe (Avatar, Eck-Badges). `highlightAccent` = Border/BG
// beim aufgeklappten Zustand — sollte die Objekt-Akzent-Farbe sein, damit der
// Highlight zum Objekt-Kontext passt (nicht zur Rolle).
function KontaktZeile({ k, ve, t, accent, highlightAccent, isActive, onClick, id }) {
  const hl = highlightAccent || accent;
  const istFirma = k.typ === "firma";
  const alleKontakte = useAlleKontakte();
  const name = istFirma
    ? k.name
    : `${k.vorname || ""} ${k.nachname || ""}`.trim() || k.name;

  // Avatar-Eck-Badges: nur Rollen die zu DIESEM Objekt gehören. Über
  // zuweisungenFuerAvatar (neue Achsen besitz/zustaendigkeit + LIVE-Belegung
  // dieses Objekts via [ve]), damit Mieter/Pächter etc. konsistent erscheinen.
  const avatarZuw = zuweisungenFuerAvatar(k, ve.id, alleKontakte, [ve]);
  // Bezug-Berechnung weiterhin aus den rohen objektZuweisungen (braucht
  // einheitId/rolle-Details, die die Avatar-Form nicht trägt).
  const objektZuw = (k.objektZuweisungen || []).filter(z => z.objektId === ve.id);

  // Bezug: bei Bewohnern vorab berechnet (_bezug = Einheit · Recht);
  // sonst bei Personen die Einheit, bei Firmen die Rolle (oder „Auftrag")
  let bezug = k._bezug || "";
  const zuweisung = objektZuw[0];
  if (!bezug && zuweisung) {
    if (zuweisung.einheitId) {
      const einheit = (ve.einheiten || []).find(e => e.id === zuweisung.einheitId);
      if (einheit) bezug = einheit.nr + (einheit.lage ? ` · ${einheit.lage}` : "");
    } else if (istFirma) {
      bezug = zuweisung.rolle || "Auftrag";
    }
  }

  const tel = (k.tels && k.tels[0] && k.tels[0].nr) || k.tel || "";
  const email = (k.emails && k.emails[0] && k.emails[0].email) || k.email || "";

  return (
    <div id={id} onClick={onClick} style={{
      background: isActive ? hl + "10" : t.bg,
      border: `1px solid ${isActive ? hl + "50" : t.border}`,
      borderRadius: RAD.ms, marginBottom: 5,
      display: "flex", alignItems: "center", gap: 10, padding: "9px 12px",
      cursor: "pointer", transition: "all 0.15s",
    }}>
      <Avatar name={name} firma={istFirma} size={32} accent={accent}
        zuweisungen={istFirma ? null : avatarZuw}/>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: FS.m, fontWeight: FW.bold, color: t.text,
          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{name}</div>
        <div style={{ fontSize: FS.xs, color: t.sub, display: "flex", gap: 5,
          flexWrap: "wrap", marginTop: 1 }}>
          {bezug && <span>{bezug}</span>}
          {tel && <span>{bezug ? "· " : ""}📞 {tel}</span>}
          {email && !tel && <span>{bezug ? "· " : ""}✉ {email}</span>}
        </div>
      </div>
    </div>
  );
}

// ── Kontakte-Layout pro Objekt (ve.kontakteLayout) ──────────────────────────
// Steuert WELCHE Karten im Kontakte-Tab sichtbar sind, ihre Reihenfolge und je
// Gruppen-Karte die Sortierung. Gruppen-Karten bleiben automatisch befüllt
// (über sammleFuerKategorie); Einzel-Karten zeigen einen konkreten Kontakt.
// Eintrag: { id, art:"gruppe"|"einzel", katId?, kontaktId?, sort, sichtbar }
function buildInitialKontakteLayout() {
  return KONTAKT_KATEGORIEN.map(kat => ({
    id: "g_" + kat.id,
    art: "gruppe",
    katId: kat.id,
    sort: "name",
    sichtbar: true,
  }));
}

// Persistiertes Layout mit Defaults zusammenführen: fehlende Standard-Gruppen
// (z. B. neue Kategorie nach Update) ergänzen, ungültige katIds verwerfen.
function mergeKontakteLayout(persistiert) {
  const defaults = buildInitialKontakteLayout();
  if (!Array.isArray(persistiert) || persistiert.length === 0) return defaults;
  const gueltigeKatIds = KONTAKT_KATEGORIEN.map(k => k.id);
  // Meta-Eintrag: welche Standard-Gruppen wurden bewusst ausgeblendet?
  const metaRoh = persistiert.find(e => e && e.art === "_meta");
  const entfernt = (metaRoh && Array.isArray(metaRoh.entfernt)) ? metaRoh.entfernt.slice() : [];
  const bereinigt = persistiert
    .filter(e => e && (e.art === "einzel" || e.art === "custom" || e.art === "manuell" || (e.art === "gruppe" && gueltigeKatIds.indexOf(e.katId) >= 0)))
    .map(e => ({
      id: e.id || (e.art === "einzel" ? "e_" + e.kontaktId : e.art === "custom" ? "c_" + Date.now() : e.art === "manuell" ? "m_" + Date.now() : "g_" + e.katId),
      art: e.art,
      katId: e.katId,
      kontaktId: e.kontaktId,
      kontaktIds: Array.isArray(e.kontaktIds) ? e.kontaktIds : [],
      name: e.name,
      icon: e.icon,
      farbe: e.farbe,
      rollen: Array.isArray(e.rollen) ? e.rollen : [],
      rechte: Array.isArray(e.rechte) ? e.rechte : [],
      gebaeude: Array.isArray(e.gebaeude) ? e.gebaeude : [],
      sort: e.sort || "name",
      sichtbar: e.sichtbar !== false,
    }));
  const vorhandeneKat = new Set(bereinigt.filter(e => e.art === "gruppe").map(e => e.katId));
  // Default-Gruppe nur ergänzen, wenn sie weder vorhanden noch bewusst entfernt ist.
  defaults.forEach(d => {
    if (!vorhandeneKat.has(d.katId) && entfernt.indexOf(d.katId) < 0) bereinigt.push(d);
  });
  // Meta-Eintrag (bereinigt um nur noch gültige, weiterhin abwesende katIds) anhängen.
  const finalEntfernt = entfernt.filter(kid =>
    gueltigeKatIds.indexOf(kid) >= 0 && !vorhandeneKat.has(kid));
  if (finalEntfernt.length > 0) bereinigt.push({ art: "_meta", entfernt: finalEntfernt });
  return bereinigt;
}

// ── KontaktKategorieKarte: ein Bereich (z. B. „Eigentümer") als Karte ──────
// Header mit Icon + Name + Count, klappbar. Inhalt: KontaktZeile-Liste.
// ── CustomKriterienEditor: ändert Rollen/Rechte/Gebäude einer custom-Gruppe ──
//    nachträglich. Pill-Auswahl analog KontakteNeueKarteMenu (Stufe custom),
//    vorbefüllt mit den aktuellen Kriterien. Inline unter dem Karten-Kopf.
function CustomKriterienEditor({ t, accent, kriterien, personenRollen, firmenRollen, bereiche, onSave, onCancel }) {
  const [rollen, setRollen] = useState((kriterien && kriterien.rollen) || []);
  const [rechte, setRechte] = useState((kriterien && kriterien.rechte) || []);
  const [gebaeude, setGebaeude] = useState((kriterien && kriterien.gebaeude) || []);
  const toggle = (arr, val) => arr.indexOf(val) >= 0 ? arr.filter(x => x !== val) : [...arr, val];
  const alleRollen = []
    .concat((personenRollen || []).filter(r => r.aktiv !== false).map(r => r.name))
    .concat((firmenRollen || []).filter(r => r.aktiv !== false).map(r => r.name));
  const rollenListe = Array.from(new Set(alleRollen));
  const gueltig = rollen.length > 0 || rechte.length > 0;
  const pill = (an, label, farbe, onClick, key) => (
    <button key={key} onClick={onClick}
      style={{ padding: "5px 10px", borderRadius: RAD.pill, cursor: "pointer", fontFamily: "inherit",
        fontSize: FS.xs, fontWeight: FW.bold,
        background: an ? farbe + "22" : "transparent",
        border: `1px solid ${an ? farbe : t.border}`, color: an ? farbe : t.sub }}>
      {label}
    </button>
  );
  return (
    <div style={{ padding: "12px 14px", borderBottom: `1px solid ${t.border}`, background: accent + "08" }}>
      <div style={{ fontSize: FS.xs, color: t.sub, fontWeight: FW.bold, marginBottom: 5 }}>Bewohner-Rechtsgrundlagen</div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 10 }}>
        {BEWOHNER_RECHTE.map(r => pill(rechte.indexOf(r.id) >= 0, r.label, r.farbe,
          () => setRechte(v => toggle(v, r.id)), "r_" + r.id))}
      </div>
      {bereiche && bereiche.length > 1 && (
        <Fragment>
          <div style={{ fontSize: FS.xs, color: t.sub, fontWeight: FW.bold, marginBottom: 5 }}>
            Gebäude / Bereich <span style={{ fontWeight: FW.regular }}>(optional — leer = alle)</span>
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 10 }}>
            {bereiche.map(b => {
              const an = gebaeude.indexOf(b.id) >= 0;
              return (
                <button key={b.id} onClick={() => setGebaeude(v => toggle(v, b.id))}
                  style={{ display: "flex", alignItems: "center", gap: 5,
                    padding: "5px 10px", borderRadius: RAD.pill, cursor: "pointer", fontFamily: "inherit",
                    fontSize: FS.xs, fontWeight: FW.bold,
                    background: an ? accent + "22" : "transparent",
                    border: `1px solid ${an ? accent : t.border}`, color: an ? accent : t.sub }}>
                  <span>{b.icon}</span>{b.name}
                </button>
              );
            })}
          </div>
        </Fragment>
      )}
      <div style={{ fontSize: FS.xs, color: t.sub, fontWeight: FW.bold, marginBottom: 5 }}>Rollen</div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 12, maxHeight: 140, overflowY: "auto" }}>
        {rollenListe.length === 0 ? (
          <span style={{ fontSize: FS.s, color: t.muted, fontStyle: "italic" }}>Keine Rollen definiert.</span>
        ) : rollenListe.map(rn => pill(rollen.indexOf(rn) >= 0, rn, accent, () => setRollen(v => toggle(v, rn)), "rl_" + rn))}
      </div>
      <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
        <button onClick={onCancel}
          style={{ padding: "8px 14px", borderRadius: RAD.sm, cursor: "pointer", fontFamily: "inherit",
            fontSize: FS.s, fontWeight: FW.bold, background: "transparent",
            border: `1px solid ${t.border}`, color: t.sub }}>
          Abbrechen
        </button>
        <button disabled={!gueltig}
          onClick={() => gueltig && onSave({ rollen, rechte, gebaeude })}
          style={{ padding: "8px 14px", borderRadius: RAD.sm, fontFamily: "inherit",
            fontSize: FS.s, fontWeight: FW.bold, cursor: gueltig ? "pointer" : "default",
            background: gueltig ? accent : t.border + "30", border: "none",
            color: gueltig ? getContrastColor(accent) : t.muted }}>
          Übernehmen
        </button>
      </div>
    </div>
  );
}

function KontaktKategorieKarte({ kategorie, katId, kontakte, ve, alleKontakte, ves, t, editMode,
  expandedKontaktId, onKlick, onKontaktUpdate, onVEKlick, setKontakte, onGotoKontakt, objektAccent,
  sort = "name", sortOptionen = null, onSort = null, onUp = null, onDown = null, onRemove = null,
  canUp = false, canDown = false, nameEditierbar = false, onRename = null, onSetIcon = null,
  kriterien = null, onSetKriterien = null, personenRollen = null, firmenRollen = null, bereiche = null,
  kontaktIds = null, onSetKontaktIds = null, alleKontakteFuerEdit = null, farbenFuerEdit = null,
  kartenDomId = null }) {
  // Default: aufgeklappt wenn etwas drin ist (sonst zugeklappt).
  // Manuelle Gruppen (kontaktIds) starten IMMER offen, damit das
  // „Kontakt zuweisen"-Feld direkt nach dem Anlegen sichtbar ist.
  const [expanded, setExpanded] = useState(kontakte.length > 0 || kontaktIds !== null);
  const [sortMenuAuf, setSortMenuAuf] = useState(false);
  const [iconPickerAuf, setIconPickerAuf] = useState(false);
  const kartenIconsAn = useKartenIcons();
  // Popovers schließen bei Klick außerhalb (§2.7).
  const sortMenuRef = useRef(null);
  useOutsideClick(sortMenuRef, () => setSortMenuAuf(false), sortMenuAuf);
  const gruppenIconRef = useRef(null);
  useOutsideClick(gruppenIconRef, () => setIconPickerAuf(false), iconPickerAuf);
  // Inline-Editor (Kriterien bei custom / Mitglieder bei manuell).
  const [editPanelAuf, setEditPanelAuf] = useState(false);
  const kannKriterien = editMode && !!onSetKriterien;
  // Manuelle Gruppen (kontaktIds): KEIN Stift/Mitglieder-Editor mehr — die
  // Zuweisung läuft inline im Karten-Body über den Standard-KontaktPicker,
  // Entfernen über das × an der Kontakt-Zeile.
  const kannMitglieder = editMode && !!onSetKontaktIds;
  const hatEditPanel = kannKriterien;
  // Eindeutiger Schlüssel je Gruppe+Kontakt — dieselbe Person kann in mehreren
  // Gruppen stehen (z.B. Eigentümer UND Beirat); ohne katId würden beide
  // gleichzeitig aufklappen und der Scroll spränge zur ersten.
  const keyOf = (kid) => katId + "::" + kid;
  const domId = (kid) => "vekon-" + ve.id + "-" + katId + "-" + kid;
  // Beim Aufklappen einer Karte den sichtbaren Bereich stabil halten: das
  // Ersetzen der kleinen Zeile durch die große Karte ändert die Layout-Höhe,
  // was sonst den Scroll springen lässt. block:"nearest" scrollt nur minimal.
  useEffect(() => {
    if (expandedKontaktId == null) return;
    const offeneId = kontakte.find(k => keyOf(k.id) === expandedKontaktId);
    if (!offeneId) return;
    const el = typeof document !== "undefined"
      && document.getElementById(domId(offeneId.id));
    if (el && el.scrollIntoView) {
      requestAnimationFrame(() => el.scrollIntoView({ block: "nearest", behavior: "auto" }));
    }
  }, [expandedKontaktId]);
  return (
    <div id={kartenDomId || undefined} style={{ background: t.card, border: `1px solid ${t.border}`,
      borderRadius: RAD.lg, marginBottom: 12, overflow: iconPickerAuf ? "visible" : "hidden" }}>
      <div onClick={() => { if (!nameEditierbar) setExpanded(v => !v); }} style={{
        padding: "11px 14px", background: kategorie.farbe + "08",
        borderBottom: expanded ? `1px solid ${t.border}` : "none",
        display: "flex", alignItems: "center", gap: 10,
        cursor: nameEditierbar ? "default" : "pointer", position: "relative" }}>
        {editMode && onSetIcon ? (
          <div ref={gruppenIconRef} style={{ position: "relative", flexShrink: 0 }}>
            <button onClick={(e) => e.stopPropagation()}
              onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); setIconPickerAuf(o => !o); }}
              title="Symbol ändern"
              style={{ width: 32, height: 32, borderRadius: RAD.sm, background: t.surface,
                border: `1px ${kategorie.icon ? "solid" : "dashed"} ${objektAccent}`, cursor: "pointer", display: "flex",
                alignItems: "center", justifyContent: "center", fontSize: FS.icon, padding: 0 }}>
              {kategorie.icon ? kategorie.icon : <I name="plus" size={13} color={objektAccent}/>}
            </button>
            {iconPickerAuf && (
              <div style={{ position: "absolute", top: 38, left: 0, zIndex: 100,
                background: t.card, border: `1px solid ${t.border}`, borderRadius: RAD.md,
                padding: 8, boxShadow: "0 8px 24px rgba(0,0,0,0.35)",
                display: "grid", gridTemplateColumns: "repeat(8, 1fr)", gap: 4,
                maxWidth: 320, maxHeight: 260, overflowY: "auto" }}>
                {/* „Kein Symbol" — leeres Feld; entfernt das Icon. */}
                <button onClick={(e) => e.stopPropagation()}
                  onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); onSetIcon(""); setIconPickerAuf(false); }}
                  title="Kein Symbol" aria-label="Kein Symbol"
                  style={{ width: 32, height: 32, borderRadius: RAD.sm, cursor: "pointer",
                    background: !kategorie.icon ? objektAccent + "25" : "transparent",
                    border: `1px dashed ${!kategorie.icon ? objektAccent : t.border}`,
                    display: "flex", alignItems: "center", justifyContent: "center", padding: 0 }}>
                  <I name="x" size={12} color={!kategorie.icon ? objektAccent : t.muted}/>
                </button>
                {KARTEN_ICONS.map(ic => (
                  <button key={ic} onClick={(e) => e.stopPropagation()}
                    onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); onSetIcon(ic); setIconPickerAuf(false); }}
                    style={{ width: 32, height: 32, borderRadius: RAD.sm, cursor: "pointer",
                      background: ic === kategorie.icon ? objektAccent + "25" : "transparent",
                      border: `1px solid ${ic === kategorie.icon ? objektAccent : "transparent"}`,
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: FS.icon, padding: 0 }}>
                    {ic}
                  </button>
                ))}
              </div>
            )}
          </div>
        ) : (
          kartenIconsAn && kategorie.icon ? <span style={{ fontSize: FS.icon }}>{kategorie.icon}</span> : null
        )}
        {nameEditierbar ? (
          <input value={kategorie.label}
            onChange={e => onRename && onRename(e.target.value)}
            onClick={(e) => e.stopPropagation()} onMouseDown={(e) => e.stopPropagation()}
            placeholder="Gruppenname"
            style={{ flex: 1, minWidth: 0, background: t.surface, border: `1px solid ${objektAccent}`,
              borderRadius: RAD.sm, padding: "4px 8px", fontSize: FS.input, fontWeight: FW.bold,
              color: t.text, outline: "none", fontFamily: "inherit" }}/>
        ) : (
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: FS.l, fontWeight: FW.bold, color: t.text }}>
              {kategorie.label}
              <span style={{ fontWeight: FW.semi, color: t.sub, marginLeft: 6 }}>
                ({kontakte.length})
              </span>
            </div>
            {kategorie.sub && (
              <div style={{ fontSize: FS.s, color: t.muted, marginTop: 2 }}>{kategorie.sub}</div>
            )}
          </div>
        )}
        {editMode && (
          <div onClick={(e) => e.stopPropagation()}
            style={{ display: "flex", gap: 4, flexShrink: 0, alignItems: "center" }}>
            {/* Stift: Kriterien (custom) bzw. Mitglieder (manuell) bearbeiten. */}
            {hatEditPanel && (
              <button onClick={() => setEditPanelAuf(v => !v)}
                title="Kriterien bearbeiten"
                aria-label="Kriterien bearbeiten"
                style={{ display: "flex", alignItems: "center", justifyContent: "center",
                  width: 24, height: 24, cursor: "pointer",
                  background: editPanelAuf ? objektAccent : objektAccent + "18",
                  border: `1px solid ${objektAccent}${editPanelAuf ? "" : "40"}`,
                  borderRadius: RAD.sm, fontFamily: "inherit" }}>
                <I name="pencil" size={12} color={editPanelAuf ? getContrastColor(objektAccent) : objektAccent}/>
              </button>
            )}
            {/* Sortierung wählen (nur Gruppen mit Optionen) — neutraler Akzent. */}
            {sortOptionen && sortOptionen.length > 0 && onSort && (
              <div ref={sortMenuRef} style={{ position: "relative" }}>
                <button onClick={() => setSortMenuAuf(v => !v)}
                  title="Sortierung" aria-label="Sortierung"
                  style={{ display: "flex", alignItems: "center", justifyContent: "center",
                    gap: 4, height: 24, padding: "0 8px", cursor: "pointer",
                    background: objektAccent + "18", border: `1px solid ${objektAccent}40`,
                    borderRadius: RAD.sm, color: objektAccent, fontSize: FS.xs,
                    fontWeight: FW.bold, fontFamily: "inherit" }}>
                  <I name="sort" size={11} color={objektAccent}/>
                </button>
                {sortMenuAuf && (
                  <div style={{ position: "absolute", top: "calc(100% + 4px)", right: 0, zIndex: 100,
                    background: t.card, border: `1px solid ${t.border}`, borderRadius: RAD.ml,
                    boxShadow: "0 8px 24px rgba(0,0,0,0.3)", overflow: "hidden", minWidth: 170 }}>
                    {sortOptionen.map(opt => (
                      <button key={opt.id} onClick={() => { onSort(opt.id); setSortMenuAuf(false); }}
                        style={{ display: "flex", alignItems: "center", gap: 8, width: "100%",
                          background: opt.id === sort ? objektAccent + "14" : "none", border: "none",
                          padding: "9px 12px", cursor: "pointer", textAlign: "left",
                          fontFamily: "inherit", fontSize: FS.s,
                          fontWeight: opt.id === sort ? FW.bold : FW.regular,
                          color: opt.id === sort ? objektAccent : t.text }}>
                        {opt.id === sort && <I name="check" size={11} color={objektAccent}/>}
                        <span style={{ marginLeft: opt.id === sort ? 0 : 19 }}>{opt.label}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
            <SortierPfeile horizontal size={24}
              canUp={canUp} canDown={canDown} onUp={onUp} onDown={onDown}
              t={t} accent={objektAccent}/>
            {/* Anzeige lösen (X) — roter Rahmen wie bei den Kontakten. Der
                Kontakt selbst bleibt erhalten, nur die Karte verschwindet. */}
            {onRemove && (
              <button onClick={onRemove} title="Karte ausblenden" aria-label="Karte ausblenden"
                style={{ display: "flex", alignItems: "center", justifyContent: "center",
                  width: 24, height: 24, cursor: "pointer",
                  background: "#EF444418", border: `1px solid #EF444455`,
                  borderRadius: RAD.sm, fontFamily: "inherit" }}>
                <I name="x" size={12} color="#EF4444"/>
              </button>
            )}
          </div>
        )}
      </div>
      {editPanelAuf && kannKriterien && (
        <CustomKriterienEditor t={t} accent={objektAccent}
          kriterien={kriterien}
          personenRollen={personenRollen} firmenRollen={firmenRollen} bereiche={bereiche}
          onSave={(krit) => { onSetKriterien(krit); setEditPanelAuf(false); }}
          onCancel={() => setEditPanelAuf(false)}/>
      )}
      {expanded && (
        <div style={{ padding: "10px 14px" }}>
          {kontakte.length === 0 ? (
            <div style={{ fontSize: FS.s, color: t.muted, fontStyle: "italic", padding: "8px 0", textAlign: "center" }}>
              {kontaktIds !== null ? "Noch keine Kontakte zugewiesen." : `Keine ${kategorie.label.toLowerCase()} verknüpft.`}
            </div>
          ) : (
            kontakte.map(k => {
              const offen = expandedKontaktId === keyOf(k.id);
              return (
                <Fragment key={k.id}>
                  {offen ? (
                    <div id={domId(k.id)}
                      style={{ marginTop: 6, marginBottom: 10,
                        scrollMarginTop: "var(--ad-header-h, 200px)" }}>
                      <KontaktDetailKarte k={k} t={t}
                        accent={objektAccent}
                        kategorieFarbe={kategorie.farbe}
                        ves={ves} kontakte={alleKontakte}
                        setKontakte={setKontakte}
                        objektFilter={ve.id}
                        embedded
                        onKopfClick={() => onKlick && onKlick(keyOf(k.id))}
                        onGotoKontakt={onGotoKontakt}
                        onKontaktClick={(id) => onKlick && onKlick(id)}
                        onVEClick={onVEKlick}
                        onUpdate={(patch) => onKontaktUpdate && onKontaktUpdate(k.id, patch)}/>
                    </div>
                  ) : kannMitglieder ? (
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <KontaktZeile k={k} ve={ve} t={t} accent={kategorie.farbe}
                          highlightAccent={objektAccent}
                          isActive={false}
                          id={domId(k.id)}
                          onClick={() => onKlick && onKlick(keyOf(k.id))}/>
                      </div>
                      <button onClick={() => onSetKontaktIds((kontaktIds || []).filter(x => x !== k.id))}
                        title="Aus der Karte entfernen" aria-label="Aus der Karte entfernen"
                        style={{ display: "flex", alignItems: "center", justifyContent: "center",
                          width: 24, height: 24, flexShrink: 0, cursor: "pointer",
                          background: "transparent", border: "1px solid #EF444440",
                          borderRadius: RAD.sm, fontFamily: "inherit" }}>
                        <I name="x" size={12} color="#EF4444"/>
                      </button>
                    </div>
                  ) : (
                    <KontaktZeile k={k} ve={ve} t={t} accent={kategorie.farbe}
                      highlightAccent={objektAccent}
                      isActive={false}
                      id={domId(k.id)}
                      onClick={() => onKlick && onKlick(keyOf(k.id))}/>
                  )}
                </Fragment>
              );
            })
          )}
          {/* Manuelle Gruppe (z. B. Nachbarn): Zuweisung über den Standard-
              KontaktPicker (Suche + „+ Neu anlegen"). Auswahl/Neuanlage hängt
              den Kontakt an; value bleibt leer für die nächste Zuweisung.
              Entfernen weiterhin über den Stift (Mitglieder-Editor). */}
          {kannMitglieder && (
            <div style={{ marginTop: kontakte.length > 0 ? 8 : 0 }}>
              <KontaktPicker value={null} label="Kontakt zuweisen"
                t={t} accent={objektAccent}
                kontakte={alleKontakteFuerEdit || alleKontakte} setKontakte={setKontakte}
                onChange={(id) => {
                  if (id && (kontaktIds || []).indexOf(id) < 0) {
                    onSetKontaktIds([...(kontaktIds || []), id]);
                  }
                }}/>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── KontakteNeueKarteMenu: zweistufiges Hinzufügen-Menü für den Kontakte-Tab ─
// Stufe 1: Art wählen (Gruppe nach Kategorie ODER einzelner Kontakt).
// Stufe 2: konkrete Auswahl (welche Gruppe / welcher Kontakt aus allen).
// Optik wie NeueKarteMenu (getönt, eingegliedert). Verhalten wie Liegenschaft.
function KontakteNeueKarteMenu({ t, accent, ve, fehlendeGruppen, alleKontakte, farben,
  personenRollen, firmenRollen, bereiche, onAddGruppe, onAddEinzel, onAddCustom, onAddManuell }) {
  const [offen, setOffen] = useState(false);
  const [stufe, setStufe] = useState("art"); // "art" | "gruppe" | "kontakt" | "custom"
  const [suche, setSuche] = useState("");
  // Mehrfachauswahl in der Kontakt-Stufe (für manuelle Gruppe).
  const [auswahl, setAuswahl] = useState([]);
  // Custom-Gruppen-Formular
  const [cName, setCName] = useState("");
  // Rollen-Chips: zunächst nur die meistgebrauchten, Rest hinter „weitere Rollen".
  const [cRollenAlle, setCRollenAlle] = useState(false);
  const [cIcon, setCIcon] = useState("🏷");
  const [cRollen, setCRollen] = useState([]);
  const [cRechte, setCRechte] = useState([]);
  const [cGebaeude, setCGebaeude] = useState([]);
  const reset = () => { setOffen(false); setStufe("art"); setSuche(""); setAuswahl([]);
    setCName(""); setCIcon("🏷"); setCRollen([]); setCRechte([]); setCGebaeude([]); setCRollenAlle(false); };
  const toggle = (arr, val) => arr.indexOf(val) >= 0 ? arr.filter(x => x !== val) : [...arr, val];
  // Verfügbare Rollen (aktive) aus Personen- und Firmen-Rollen zusammenführen.
  const alleRollen = []
    .concat((personenRollen || []).filter(r => r.aktiv !== false).map(r => r.name))
    .concat((firmenRollen || []).filter(r => r.aktiv !== false).map(r => r.name));
  const rollenListe = Array.from(new Set(alleRollen));
  // Meistgebrauchte Rollen zuerst; bereits angewählte bleiben auch in der
  // eingeklappten Ansicht sichtbar.
  const C_TOP_ROLLEN = ["Eigentümer", "Mieter", "Eigennutzer", "Verwalter", "Hausmeister"];
  const cRollenKurz = C_TOP_ROLLEN.filter(rn => rollenListe.indexOf(rn) >= 0)
    .concat(rollenListe.filter(rn => C_TOP_ROLLEN.indexOf(rn) < 0 && cRollen.indexOf(rn) >= 0));
  const cRollenAnzeige = cRollenAlle ? rollenListe : cRollenKurz;
  const cRollenRest = rollenListe.length - cRollenKurz.length;
  const nameOf = (k) => k.typ === "firma"
    ? (k.name || "")
    : (`${k.vorname || ""} ${k.nachname || ""}`.trim() || k.name || "");
  // Alle Kontakte anbieten — die MIT Bezug zu diesem Objekt zuerst, darunter
  // der Rest (z. B. Nachbarn, die bewusst keine Rolle am Objekt haben). Der
  // Untertitel zeigt den Bezug bzw. „Ohne Bezug zu diesem Objekt".
  const treffer = (alleKontakte || [])
    .map(k => ({ k, bezug: ve ? objektBezugInfo(k, ve, personenRollen, firmenRollen, farben)
      : { hatBezug: false, label: "", farbe: (farben && (k.typ === "firma" ? farben.firma : farben.person)) || "#64748B" } }))
    .filter(x => nameOf(x.k).toLowerCase().indexOf(suche.toLowerCase()) >= 0)
    .sort((a, b) => (b.bezug.hatBezug ? 1 : 0) - (a.bezug.hatBezug ? 1 : 0))
    .slice(0, 40);
  const headBtnStyle = {
    width: "100%", display: "flex", alignItems: "center", gap: 10,
    background: offen ? accent + "20" : accent + "18",
    border: offen ? "none" : `1px solid ${accent}40`,
    borderBottom: `1px solid ${accent}${offen ? "30" : "40"}`,
    borderRadius: offen ? 0 : RAD.lg, padding: "12px 0", cursor: "pointer",
    justifyContent: "center", color: accent, fontSize: FS.m, fontWeight: FW.bold,
    transition: "all 0.15s", fontFamily: "inherit",
  };
  const kopfText = offen
    ? (stufe === "art" ? "Was hinzufügen?" : stufe === "gruppe" ? "Gruppe wählen…"
       : stufe === "kontakt" ? "Kontakte wählen…" : "Eigene Gruppe definieren")
    : "Neue Karte hinzufügen";
  const optBtn = (onClick, icon, iconColor, label, sub) => (
    <button onClick={onClick} style={{
      width: "100%", display: "flex", alignItems: "center", gap: 12,
      background: "transparent", border: "none",
      borderBottom: `1px solid ${accent}20`,
      padding: "10px 14px", cursor: "pointer", textAlign: "left", fontFamily: "inherit" }}
      onMouseEnter={e => e.currentTarget.style.background = accent + "14"}
      onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
      <span style={{ fontSize: FS.icon }}>{icon}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: FS.m, fontWeight: FW.bold, color: t.text,
          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{label}</div>
        {sub && <div style={{ fontSize: FS.xs, color: t.sub }}>{sub}</div>}
      </div>
    </button>
  );
  return (
    <div style={{ border: offen ? `1px solid ${accent}40` : "none",
      borderRadius: RAD.lg, overflow: "hidden",
      background: offen ? accent + "10" : "transparent" }}>
      <button onClick={() => { if (offen) reset(); else setOffen(true); }} style={headBtnStyle}>
        <I name={offen ? "x" : "plus"} size={15} color={accent}/>
        {kopfText}
      </button>
      {offen && stufe === "art" && (
        <div>
          {optBtn(() => setStufe("gruppe"), "👥", accent, "Gruppen-Karte", "Nach Kategorie / Rolle, automatisch befüllt")}
          {optBtn(() => setStufe("kontakt"), "👤", accent, "Einzelne Kontakte", "Einen oder mehrere wählen (= eigene Gruppe)")}
          {optBtn(() => { onAddManuell([], { name: "Nachbarn", icon: "🏘" }); reset(); }, "🏘", accent, "Nachbarn", "Leere Karte anlegen — Kontakte dann in der Karte zuweisen")}
          <div style={{ borderBottom: "none" }}>
            {optBtn(() => setStufe("custom"), "🏷", accent, "Eigene Gruppe", "Selbst benennen + Rollen/Rechte wählen")}
          </div>
        </div>
      )}
      {offen && stufe === "gruppe" && (
        <div>
          {fehlendeGruppen.length === 0 ? (
            <div style={{ padding: "12px 14px", fontSize: FS.s, color: t.muted, fontStyle: "italic" }}>
              Alle Gruppen werden bereits angezeigt.
            </div>
          ) : fehlendeGruppen.map(kat => (
            <div key={kat.id} style={{ borderBottom: `1px solid ${accent}20` }}>
              {optBtn(() => { onAddGruppe(kat.id); reset(); }, kat.icon, accent, kat.label, kat.sub)}
            </div>
          ))}
        </div>
      )}
      {offen && stufe === "kontakt" && (
        <div>
          <div style={{ padding: "8px 12px" }}>
            <input autoFocus value={suche} onChange={e => setSuche(e.target.value)}
              placeholder="Kontakt suchen…"
              style={{ width: "100%", boxSizing: "border-box", background: t.surface,
                border: `1px solid ${t.border}`, borderRadius: RAD.sm, padding: "8px 10px",
                fontSize: 16, color: t.text, outline: "none", fontFamily: "inherit" }}/>
          </div>
          <div style={{ paddingLeft: 14, paddingRight: 14, paddingBottom: 4,
            fontSize: FS.xs, color: t.sub }}>
            Mehrere wählen = eine eigene Gruppe.
          </div>
          <div style={{ maxHeight: 240, overflowY: "auto" }}>
            {treffer.length === 0 ? (
              <div style={{ padding: "10px 14px", fontSize: FS.s, color: t.muted, fontStyle: "italic" }}>
                Keine Kontakte mit Bezug zu diesem Objekt gefunden.
              </div>
            ) : treffer.map(({ k, bezug }) => {
              const an = auswahl.indexOf(k.id) >= 0;
              const initialen = k.typ === "firma"
                ? (k.name || "?").slice(0, 1).toUpperCase()
                : ((k.vorname || " ").slice(0, 1) + (k.nachname || " ").slice(0, 1)).trim().toUpperCase();
              return (
                <button key={k.id} onClick={() => setAuswahl(v => toggle(v, k.id))}
                  style={{ width: "100%", display: "flex", alignItems: "center", gap: 10,
                    background: an ? accent + "14" : "transparent", border: "none",
                    borderBottom: `1px solid ${accent}20`,
                    padding: "9px 14px", cursor: "pointer", textAlign: "left", fontFamily: "inherit" }}>
                  <span style={{ width: 18, height: 18, flexShrink: 0, borderRadius: RAD.sm,
                    border: `1px solid ${an ? accent : t.border}`, background: an ? accent : "transparent",
                    display: "flex", alignItems: "center", justifyContent: "center" }}>
                    {an && <I name="check" size={11} color={getContrastColor(accent)}/>}
                  </span>
                  <span style={{ width: 30, height: 30, flexShrink: 0,
                    borderRadius: k.typ === "firma" ? RAD.sm : RAD.full,
                    background: bezug.farbe, display: "flex", alignItems: "center",
                    justifyContent: "center", fontSize: FS.xs, fontWeight: FW.bold,
                    color: getContrastColor(bezug.farbe) }}>
                    {initialen}
                  </span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: FS.m, fontWeight: FW.bold, color: t.text,
                      overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{nameOf(k)}</div>
                    <div style={{ fontSize: FS.xs, color: bezug.hatBezug ? bezug.farbe : t.muted,
                      fontWeight: bezug.hatBezug ? FW.semi : FW.regular,
                      fontStyle: bezug.hatBezug ? "normal" : "italic",
                      overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {bezug.hatBezug ? bezug.label : "Ohne Bezug zu diesem Objekt"}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
          {auswahl.length > 0 && (
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", padding: "10px 14px",
              borderTop: `1px solid ${accent}20` }}>
              <button onClick={() => setAuswahl([])}
                style={{ padding: "8px 14px", borderRadius: RAD.sm, cursor: "pointer", fontFamily: "inherit",
                  fontSize: FS.s, fontWeight: FW.bold, background: "transparent",
                  border: `1px solid ${t.border}`, color: t.sub }}>
                Auswahl leeren
              </button>
              <button onClick={() => {
                  if (auswahl.length === 1) onAddEinzel(auswahl[0]);
                  else onAddManuell(auswahl, { name: "Eigene Auswahl", icon: "👥" });
                  reset();
                }}
                style={{ padding: "8px 14px", borderRadius: RAD.sm, cursor: "pointer", fontFamily: "inherit",
                  fontSize: FS.s, fontWeight: FW.bold, background: accent, border: "none",
                  color: getContrastColor(accent) }}>
                {auswahl.length === 1 ? "Als Karte hinzufügen" : `Als Gruppe anlegen (${auswahl.length})`}
              </button>
            </div>
          )}
        </div>
      )}
      {offen && stufe === "custom" && (
        <div style={{ padding: "10px 14px" }}>
          {/* Name — das Icon wird erst NACH dem Anlegen an der Karte geändert
              (Icon-Picker am Kartenkopf), hier bewusst kein Auswahlfeld. */}
          <div style={{ marginBottom: 10 }}>
            <input value={cName} onChange={e => setCName(e.target.value)}
              placeholder="Gruppenname (z. B. Mieter)"
              style={{ width: "100%", boxSizing: "border-box", background: t.surface,
                border: `1px solid ${t.border}`, borderRadius: RAD.sm, padding: "8px 10px",
                fontSize: 16, color: t.text, outline: "none", fontFamily: "inherit" }}/>
          </div>
          {/* Rechtsgrundlagen */}
          <div style={{ fontSize: FS.xs, color: t.sub, fontWeight: FW.bold, marginBottom: 5 }}>Bewohner-Rechtsgrundlagen</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 10 }}>
            {BEWOHNER_RECHTE.map(r => {
              const an = cRechte.indexOf(r.id) >= 0;
              return (
                <button key={r.id} onClick={() => setCRechte(v => toggle(v, r.id))}
                  style={{ padding: "5px 10px", borderRadius: RAD.pill, cursor: "pointer", fontFamily: "inherit",
                    fontSize: FS.xs, fontWeight: FW.bold,
                    background: an ? r.farbe + "22" : "transparent",
                    border: `1px solid ${an ? r.farbe : t.border}`,
                    color: an ? r.farbe : t.sub }}>
                  {r.label}
                </button>
              );
            })}
          </div>
          {/* Gebäude / Bereiche (optional eingrenzen) */}
          {bereiche && bereiche.length > 1 && (
            <>
              <div style={{ fontSize: FS.xs, color: t.sub, fontWeight: FW.bold, marginBottom: 5 }}>
                Gebäude / Bereich <span style={{ fontWeight: FW.regular }}>(optional — leer = alle)</span>
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 10 }}>
                {bereiche.map(b => {
                  const an = cGebaeude.indexOf(b.id) >= 0;
                  return (
                    <button key={b.id} onClick={() => setCGebaeude(v => toggle(v, b.id))}
                      style={{ display: "flex", alignItems: "center", gap: 5,
                        padding: "5px 10px", borderRadius: RAD.pill, cursor: "pointer", fontFamily: "inherit",
                        fontSize: FS.xs, fontWeight: FW.bold,
                        background: an ? accent + "22" : "transparent",
                        border: `1px solid ${an ? accent : t.border}`,
                        color: an ? accent : t.sub }}>
                      <span>{b.icon}</span>{b.name}
                    </button>
                  );
                })}
              </div>
            </>
          )}
          {/* Rollen */}
          <div style={{ fontSize: FS.xs, color: t.sub, fontWeight: FW.bold, marginBottom: 5 }}>Rollen</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 12,
            maxHeight: 140, overflowY: "auto" }}>
            {rollenListe.length === 0 ? (
              <span style={{ fontSize: FS.s, color: t.muted, fontStyle: "italic" }}>Keine Rollen definiert.</span>
            ) : cRollenAnzeige.map(rn => {
              const an = cRollen.indexOf(rn) >= 0;
              return (
                <button key={rn} onClick={() => setCRollen(v => toggle(v, rn))}
                  style={{ padding: "5px 10px", borderRadius: RAD.pill, cursor: "pointer", fontFamily: "inherit",
                    fontSize: FS.xs, fontWeight: FW.bold,
                    background: an ? accent + "22" : "transparent",
                    border: `1px solid ${an ? accent : t.border}`,
                    color: an ? accent : t.sub }}>
                  {rn}
                </button>
              );
            })}
            {rollenListe.length > 0 && cRollenRest > 0 && (
              <button onClick={() => setCRollenAlle(a => !a)}
                style={{ padding: "5px 10px", borderRadius: RAD.pill, cursor: "pointer", fontFamily: "inherit",
                  fontSize: FS.xs, fontWeight: FW.bold, background: "transparent",
                  border: `1px dashed ${accent}60`, color: accent }}>
                {cRollenAlle ? "Weniger anzeigen" : `+ ${cRollenRest} weitere Rollen`}
              </button>
            )}
          </div>
          {/* Aktionen */}
          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
            <button onClick={() => setStufe("art")}
              style={{ padding: "8px 14px", borderRadius: RAD.sm, cursor: "pointer", fontFamily: "inherit",
                fontSize: FS.s, fontWeight: FW.bold, background: "transparent",
                border: `1px solid ${t.border}`, color: t.sub }}>
              Zurück
            </button>
            <button disabled={!cName.trim() || (cRollen.length === 0 && cRechte.length === 0)}
              onClick={() => { onAddCustom({ name: cName.trim(), icon: cIcon, farbe: accent, rollen: cRollen, rechte: cRechte, gebaeude: cGebaeude }); reset(); }}
              style={{ padding: "8px 14px", borderRadius: RAD.sm, fontFamily: "inherit",
                fontSize: FS.s, fontWeight: FW.bold,
                cursor: (cName.trim() && (cRollen.length || cRechte.length)) ? "pointer" : "default",
                background: (cName.trim() && (cRollen.length || cRechte.length)) ? accent : t.border + "30",
                border: "none", color: (cName.trim() && (cRollen.length || cRechte.length)) ? getContrastColor(accent) : t.muted }}>
              Gruppe anlegen
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function VEKontakteTab({ ve, setVes, t, accent, kontakte, setKontakte, onKontaktClick, editMode = false, ves = [] }) {
  const personenRollen = useRollen();
  const firmenRollen = useFirmenRollen();
  const farben = useKontaktFarbe();
  const [addType, setAddType] = useState(null); // "person" | "firma"
  const [pickerOffen, setPickerOffen] = useState(false);
  // Aufgeklappter Kontakt — inline in der Kategorie darunter.
  // Bewusst kein Auto-Scroll: der geklickte Eintrag soll an der Stelle
  // bleiben wo der User geklickt hat. Die aufgeklappte Karte erscheint
  // darunter; falls sie unten teilweise aus dem Bild läuft, gibt es
  // unten genug Spacer-Raum zum Scrollen.
  const [expandedKontaktId, setExpandedKontaktId] = useState(null);
  // Update-Hook für KontaktDetailKarte (Stammdaten-Edit)
  const updateKontakt = (kontaktId, patch) => {
    setKontakte(kontakte.map(k =>
      k.id === kontaktId ? { ...k, ...patch } : k));
  };

  // Pro Kategorie die Roh-Items + Farbe sammeln (für Counts und Gruppen-Karten).
  const katMap = {};
  KONTAKT_KATEGORIEN.forEach(kat => {
    katMap[kat.id] = {
      kat: { ...kat, farbe: farbeFuerKategorie(kat, personenRollen, firmenRollen) },
      items: sammleFuerKategorie(kat, ve, kontakte),
    };
  });
  const gesamtPersonen = KONTAKT_KATEGORIEN
    .filter(k => k.typ === "person")
    .reduce((s, k) => s + (katMap[k.id].items.length), 0);
  const gesamtFirmen = KONTAKT_KATEGORIEN
    .filter(k => k.typ === "firma")
    .reduce((s, k) => s + (katMap[k.id].items.length), 0);

  // Layout (Reihenfolge / Sichtbarkeit / Sortierung) aus dem VE lesen.
  const layout = mergeKontakteLayout(ve && ve.kontakteLayout);
  // Reine Karten-Liste (ohne den _meta-Eintrag) für Rendern + Index-Helfer.
  const kartenLayout = layout.filter(e => e.art !== "_meta");
  const setLayout = (updater) => {
    if (!setVes) return;
    const neu = typeof updater === "function" ? updater(layout) : updater;
    setVes(prev => prev.map(v => v.id === ve.id ? { ...v, kontakteLayout: neu } : v));
  };
  // DOM-id-Präfix der Karten (weiterhin als stabile id je Karte vergeben).
  const KARTE_ID_PREFIX = "vekontkarte-" + (ve && ve.id ? ve.id : "x") + "-";
  const moveCard = (idx, dir) => {
    stabilisiereScroll(() => setLayout(l => {
      const arr = l.slice();
      const j = idx + dir;
      if (j < 0 || j >= arr.length) return arr;
      const tmp = arr[idx]; arr[idx] = arr[j]; arr[j] = tmp;
      return arr;
    }));
  };
  // Karte aus dem Layout entfernen. Bei festen Gruppen-Karten zusätzlich in
  // _meta.entfernt vermerken, damit mergeKontakteLayout sie nicht sofort wieder
  // ergänzt (sonst wirkungslos). _meta bleibt stets der letzte Eintrag.
  const hideCard = (idx) => {
    const ziel = kartenLayout[idx];
    stabilisiereScroll(() => setLayout(l => {
      const z = ziel;
      const ohne = l.filter(e => !(e.id && z && e.id === z.id) && e.art !== "_meta");
      const meta = l.find(e => e.art === "_meta");
      const entfernt = (meta && Array.isArray(meta.entfernt)) ? meta.entfernt.slice() : [];
      if (z && z.art === "gruppe" && entfernt.indexOf(z.katId) < 0) {
        entfernt.push(z.katId);
      }
      return entfernt.length > 0 ? [...ohne, { art: "_meta", entfernt }] : ohne;
    }));
  };
  const setCardSort = (idx, modus) => setLayout(l => l.map((e, i) => i === idx ? { ...e, sort: modus } : e));
  const setCardName = (idx, name) => setLayout(l => l.map((e, i) => i === idx ? { ...e, name } : e));
  const setCardIcon = (idx, icon) => setLayout(l => l.map((e, i) => i === idx ? { ...e, icon } : e));
  // Kriterien einer custom-Gruppe nachträglich ändern (Rollen/Rechte/Gebäude).
  const setCardKriterien = (idx, krit) => setLayout(l => l.map((e, i) => i === idx
    ? { ...e, rollen: krit.rollen || [], rechte: krit.rechte || [], gebaeude: krit.gebaeude || [] } : e));
  // Mitglieder einer manuellen Gruppe nachträglich setzen (Kontakt-IDs).
  const setCardKontaktIds = (idx, ids) => setLayout(l => l.map((e, i) => i === idx
    ? { ...e, kontaktIds: (ids || []).slice() } : e));

  const handleAdd = (kontaktId, rolleEintrag) => {
    if (!setKontakte || !kontaktId) return;
    const neueZuw = { ...rolleEintrag, objektId: ve.id };
    setKontakte(prev => prev.map(k => {
      if (k.id !== kontaktId) return k;
      const liste = k.objektZuweisungen || [];
      return { ...k, objektZuweisungen: [...liste, neueZuw] };
    }));
    setAddType(null);
  };

  // Eine Gruppen-Kategorie wieder einblenden (falls zuvor ausgeblendet).
  // Aus _meta.entfernt streichen und VOR dem _meta-Eintrag einfügen.
  const zeigeGruppe = (katId) => {
    stabilisiereScroll(() => setLayout(l => {
      if (l.some(e => e.art === "gruppe" && e.katId === katId)) return l; // schon da
      const karten = l.filter(e => e.art !== "_meta");
      const meta = l.find(e => e.art === "_meta");
      const entfernt = (meta && Array.isArray(meta.entfernt))
        ? meta.entfernt.filter(k => k !== katId) : [];
      const neu = [...karten, { id: "g_" + katId, art: "gruppe", katId, sort: "name", sichtbar: true }];
      return entfernt.length > 0 ? [...neu, { art: "_meta", entfernt }] : neu;
    }));
  };
  // Einzel-Karte für einen konkreten Kontakt hinzufügen.
  const zeigeEinzel = (kontaktId) => {
    stabilisiereScroll(() => setLayout(l => {
      if (l.some(e => e.art === "einzel" && e.kontaktId === kontaktId)) return l;
      return [...l, { id: "e_" + kontaktId + "_" + Date.now(), art: "einzel", kontaktId, sort: "name", sichtbar: true }];
    }));
  };
  // Frei definierte Gruppe hinzufügen (Name + Icon + Kriterien).
  const zeigeCustom = (def) => {
    stabilisiereScroll(() => setLayout(l => [...l, {
      id: "c_" + Date.now(), art: "custom",
      name: def.name || "Eigene Gruppe", icon: def.icon || "🏷", farbe: def.farbe || accent,
      rollen: def.rollen || [], rechte: def.rechte || [], gebaeude: def.gebaeude || [],
      sort: "name", sichtbar: true,
    }]));
  };
  // Manuelle Gruppe aus einer handverlesenen Kontaktliste.
  const zeigeManuell = (kontaktIds, def) => {
    if (!Array.isArray(kontaktIds)) kontaktIds = [];
    stabilisiereScroll(() => setLayout(l => [...l, {
      id: "m_" + Date.now(), art: "manuell",
      name: (def && def.name) || "Eigene Auswahl", icon: (def && def.icon) || "👥",
      farbe: accent, kontaktIds: kontaktIds.slice(),
      sort: "name", sichtbar: true,
    }]));
  };
  // Welche Gruppen sind aktuell NICHT im Layout (zum Wieder-Hinzufügen anbieten)?
  const fehlendeGruppen = KONTAKT_KATEGORIEN.filter(kat =>
    !layout.some(e => e.art === "gruppe" && e.katId === kat.id));


  return (
    <div>
      {/* Kopfzeile: nur die Zusammenfassung (Hinzufügen sitzt jetzt unten). */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
        <div style={{ flex: 1, minWidth: 0, fontSize: FS.m, color: t.sub }}>
          {gesamtPersonen} {gesamtPersonen === 1 ? "Person" : "Personen"}
          {" · "}
          {gesamtFirmen} {gesamtFirmen === 1 ? "Firma" : "Firmen"} verknüpft
        </div>
      </div>

      {/* Add-Form (Kontakt einer Rolle zuweisen) */}
      {addType && (
        <KontaktZuweisungForm
          t={t} accent={addType === "firma" ? farben.firma : accent}
          ves={[ve]} kontakte={kontakte} typ={addType}
          onSave={(kontaktId, rolleEintrag) => handleAdd(kontaktId, rolleEintrag)}
          onCancel={() => setAddType(null)}/>
      )}

      {/* Karten in Layout-Reihenfolge. Gruppen-Karten automatisch befüllt +
          sortiert; Einzel-Karten zeigen einen konkreten Kontakt. Der
          _meta-Eintrag (ausgeblendete Gruppen) wird nicht gerendert; er steht
          stets zuletzt, daher entsprechen die Indizes 1:1 dem Layout. */}
      {kartenLayout.map((eintrag, idx) => {
        const canUp = idx > 0;
        const canDown = idx < kartenLayout.length - 1;
        if (eintrag.art === "einzel") {
          const k = kontakte.find(x => x.id === eintrag.kontaktId);
          if (!k) return null;
          const farbe = k.typ === "firma" ? farben.firma : farben.person;
          const einzelKat = { id: eintrag.id, label: k.typ === "firma" ? (k.name || "Firma")
              : (`${k.vorname || ""} ${k.nachname || ""}`.trim() || k.name || "Kontakt"),
            icon: k.typ === "firma" ? "🏢" : "👤", farbe, sub: "Einzelner Kontakt", typ: k.typ };
          return (
            <KontaktKategorieKarte key={eintrag.id} kartenDomId={KARTE_ID_PREFIX + eintrag.id}
              katId={eintrag.id}
              kategorie={einzelKat} kontakte={[k]} ve={ve}
              alleKontakte={kontakte} ves={ves}
              setKontakte={setKontakte} objektAccent={accent}
              t={t} editMode={editMode}
              expandedKontaktId={expandedKontaktId}
              onKlick={(key) => setExpandedKontaktId(expandedKontaktId === key ? null : key)}
              onKontaktUpdate={updateKontakt}
              onGotoKontakt={(id) => { setExpandedKontaktId(null); onKontaktClick && onKontaktClick(id); }}
              onVEKlick={(veId) => { setExpandedKontaktId(null); onKontaktClick && onKontaktClick(veId); }}
              sortOptionen={null}
              onUp={() => moveCard(idx, -1)} onDown={() => moveCard(idx, 1)}
              canUp={canUp} canDown={canDown}
              onRemove={() => hideCard(idx)}/>
          );
        }
        const eintragKat = katMap[eintrag.katId];
        if (eintrag.art === "custom") {
          // Gebäude-Filter: aus gewählten Karten-IDs die Einheiten-IDs sammeln.
          let gebSet = null;
          if (Array.isArray(eintrag.gebaeude) && eintrag.gebaeude.length > 0) {
            gebSet = new Set();
            liegenschaftsBereiche(ve).forEach(b => {
              if (eintrag.gebaeude.indexOf(b.id) >= 0) b.einheitIds.forEach(eid => gebSet.add(eid));
            });
          }
          const items = sammleFuerCustom(eintrag.rollen, eintrag.rechte, ve, kontakte, gebSet);
          // Sortier-Optionen: Einheit nur sinnvoll, wenn Rechte (Bewohner) dabei.
          const hatPersonen = items.some(k => k.typ === "person");
          const customKat = { id: eintrag.id, label: eintrag.name, icon: eintrag.icon,
            farbe: eintrag.farbe || accent, sub: "Eigene Gruppe", typ: hatPersonen ? "person" : "firma" };
          const sortiert = sortiereKontakte(items, eintrag.sort, ve);
          return (
            <KontaktKategorieKarte key={eintrag.id} kartenDomId={KARTE_ID_PREFIX + eintrag.id}
              katId={eintrag.id}
              kategorie={customKat} kontakte={sortiert} ve={ve}
              alleKontakte={kontakte} ves={ves}
              setKontakte={setKontakte} objektAccent={accent}
              t={t} editMode={editMode}
              expandedKontaktId={expandedKontaktId}
              onKlick={(key) => setExpandedKontaktId(expandedKontaktId === key ? null : key)}
              onKontaktUpdate={updateKontakt}
              onGotoKontakt={(id) => { setExpandedKontaktId(null); onKontaktClick && onKontaktClick(id); }}
              onVEKlick={(veId) => { setExpandedKontaktId(null); onKontaktClick && onKontaktClick(veId); }}
              sort={eintrag.sort}
              sortOptionen={sortOptionenFuer(customKat)}
              onSort={(modus) => setCardSort(idx, modus)}
              onUp={() => moveCard(idx, -1)} onDown={() => moveCard(idx, 1)}
              canUp={canUp} canDown={canDown}
              nameEditierbar={editMode}
              onRename={(name) => setCardName(idx, name)}
              onSetIcon={(ic) => setCardIcon(idx, ic)}
              kriterien={{ rollen: eintrag.rollen || [], rechte: eintrag.rechte || [], gebaeude: eintrag.gebaeude || [] }}
              onSetKriterien={(krit) => setCardKriterien(idx, krit)}
              personenRollen={personenRollen} firmenRollen={firmenRollen}
              bereiche={liegenschaftsBereiche(ve)}
              onRemove={() => hideCard(idx)}/>
          );
        }
        if (eintrag.art === "manuell") {
          const ids = eintrag.kontaktIds || [];
          const items = ids.map(id => kontakte.find(k => k.id === id)).filter(Boolean);
          const hatPersonen = items.some(k => k.typ === "person");
          const manuellKat = { id: eintrag.id, label: eintrag.name, icon: eintrag.icon,
            farbe: eintrag.farbe || accent, sub: "Eigene Auswahl", typ: hatPersonen ? "person" : "firma" };
          const sortiert = sortiereKontakte(items, eintrag.sort, ve);
          return (
            <KontaktKategorieKarte key={eintrag.id} kartenDomId={KARTE_ID_PREFIX + eintrag.id}
              katId={eintrag.id}
              kategorie={manuellKat} kontakte={sortiert} ve={ve}
              alleKontakte={kontakte} ves={ves}
              setKontakte={setKontakte} objektAccent={accent}
              t={t} editMode={editMode}
              expandedKontaktId={expandedKontaktId}
              onKlick={(key) => setExpandedKontaktId(expandedKontaktId === key ? null : key)}
              onKontaktUpdate={updateKontakt}
              onGotoKontakt={(id) => { setExpandedKontaktId(null); onKontaktClick && onKontaktClick(id); }}
              onVEKlick={(veId) => { setExpandedKontaktId(null); onKontaktClick && onKontaktClick(veId); }}
              sort={eintrag.sort}
              sortOptionen={sortOptionenFuer(manuellKat)}
              onSort={(modus) => setCardSort(idx, modus)}
              onUp={() => moveCard(idx, -1)} onDown={() => moveCard(idx, 1)}
              canUp={canUp} canDown={canDown}
              nameEditierbar={editMode}
              onRename={(name) => setCardName(idx, name)}
              onSetIcon={(ic) => setCardIcon(idx, ic)}
              kontaktIds={eintrag.kontaktIds || []}
              onSetKontaktIds={(ids) => setCardKontaktIds(idx, ids)}
              alleKontakteFuerEdit={kontakte} farbenFuerEdit={farben}
              onRemove={() => hideCard(idx)}/>
          );
        }
        if (!eintragKat) return null;
        const sortiert = sortiereKontakte(eintragKat.items, eintrag.sort, ve);
        // Icon-Override aus dem Layout (feste Gruppen: nur Icon änderbar).
        // "" = bewusst KEIN Symbol; undefined/null = kein Override → Default-Icon.
        const hatIconOverride = eintrag.icon !== undefined && eintrag.icon !== null;
        const gruppeKat = hatIconOverride ? { ...eintragKat.kat, icon: eintrag.icon } : eintragKat.kat;
        return (
          <KontaktKategorieKarte key={eintrag.id} kartenDomId={KARTE_ID_PREFIX + eintrag.id}
            katId={eintrag.katId}
            kategorie={gruppeKat} kontakte={sortiert} ve={ve}
            alleKontakte={kontakte} ves={ves}
            setKontakte={setKontakte} objektAccent={accent}
            t={t} editMode={editMode}
            expandedKontaktId={expandedKontaktId}
            onKlick={(key) => setExpandedKontaktId(expandedKontaktId === key ? null : key)}
            onKontaktUpdate={updateKontakt}
            onGotoKontakt={(id) => { setExpandedKontaktId(null); onKontaktClick && onKontaktClick(id); }}
            onVEKlick={(veId) => { setExpandedKontaktId(null); onKontaktClick && onKontaktClick(veId); }}
            sort={eintrag.sort}
            sortOptionen={sortOptionenFuer(eintragKat.kat)}
            onSort={(modus) => setCardSort(idx, modus)}
            onUp={() => moveCard(idx, -1)} onDown={() => moveCard(idx, 1)}
            canUp={canUp} canDown={canDown}
            nameEditierbar={false}
            onSetIcon={(ic) => setCardIcon(idx, ic)}
            onRemove={() => hideCard(idx)}/>
        );
      })}

      {/* Neue Karte hinzufügen — zweistufiges Menü (Art → konkrete Auswahl) */}
      {editMode && (
        <div style={{ marginTop: 4 }}>
          <KontakteNeueKarteMenu t={t} accent={accent} ve={ve}
            fehlendeGruppen={fehlendeGruppen}
            alleKontakte={kontakte} farben={farben}
            personenRollen={personenRollen} firmenRollen={firmenRollen}
            bereiche={liegenschaftsBereiche(ve)}
            onAddGruppe={zeigeGruppe} onAddEinzel={zeigeEinzel} onAddCustom={zeigeCustom} onAddManuell={zeigeManuell}/>
        </div>
      )}

      {/* Spacer: damit die unterste Karte aufgeklappt vollständig sichtbar wird. */}
      <div style={{ height: "40dvh" }}/>
    </div>
  );
}



export { VEKontakteTab, objektBezugInfo };
