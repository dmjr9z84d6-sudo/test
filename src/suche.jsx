import React, { useState, useRef, useEffect } from "react";
import { FS, FW, RAD, getContrastColor } from "./constants.js";
import { I, sucheAlles, useKontaktFarbe, zuweisungenFuerAvatar } from "./utils-icons.jsx";
import { Avatar } from "./components.jsx";
import { VEDetail, VEKachel } from "./objektansicht.jsx";
// ╔═════════════════════════════════════════════════════════════════════════╗
// ║ SEKTION 5e · SUCHE — ausgelagertes Modul (Ausbau geplant)              ║
// ║ SucheFeld · Suchergebnisse                                             ║
// ╚═════════════════════════════════════════════════════════════════════════╝
// ZYKLISCHER Import aus der Hauptdatei: Anzeige-Bausteine (Laufzeit).
import { AktionsButton, KontaktDetailKarte, KontaktKarte } from "./kontakte-modul.jsx";

// ── SucheFeld (Universalsuche mit Vorschlägen) ──────────────────────────────
function SucheFeld({ settings, t, accent, onErgebnis, kontakte, ves, resetKey }) {
  const [query, setQuery] = useState("");
  const [vorschlaege, setVS] = useState([]);
  const [fokus, setFokus] = useState(false);
  const farben = useKontaktFarbe();

  // Reset bei Wechsel des resetKey (z.B. Screen-Wechsel von außen)
  useEffect(() => {
    setQuery("");
    setVS([]);
    setFokus(false);
  }, [resetKey]);

  useEffect(() => {
    if (!query.trim()) { setVS([]); return; }
    const r = sucheAlles(query, settings, kontakte, ves);
    setVS(r.vorschlaege);
  }, [query]);

  const suchen = (q) => {
    const term = q || query;
    if (!term.trim()) return;
    const r = sucheAlles(term, settings, kontakte, ves);
    onErgebnis(r.ergebnisse, term);
    setVS([]); setFokus(false);
  };
  const klar = () => { setQuery(""); setVS([]); onErgebnis(null, ""); };

  return (
    <div style={{ position: "relative", flex: 1, minWidth: 0 }}>
      <div style={{ display: "flex", alignItems: "center",
        background: t.surface, border: `1px solid ${fokus ? farben.system + "80" : t.border}`,
        borderRadius: RAD.md, padding: "5px 5px 5px 10px", gap: 6, transition: "border-color 0.15s" }}>
        <I name="search" size={13} color={fokus ? farben.system : t.muted}/>
        <input value={query} onChange={e => setQuery(e.target.value)} data-allesda-suche="1"
          onFocus={() => setFokus(true)} onBlur={() => setTimeout(() => setFokus(false), 150)}
          onKeyDown={e => {
            if (e.key === "Enter") { suchen(); e.target.blur(); }
            if (e.key === "Escape") { klar(); e.target.blur(); }
          }}
          placeholder="VE-Nr., Adresse, Eigentümer, Firma, Mieter…"
          style={{ flex: 1, background: "none", border: "none", outline: "none",
            fontSize: FS.input, color: t.text, minWidth: 0, fontFamily: "inherit", padding: "3px 0" }}/>
        {query && (
          <button onClick={klar} style={{ background: "none", border: "none", cursor: "pointer", opacity: 0.5, padding: 2 }}>
            <I name="x" size={11} color={t.sub}/>
          </button>
        )}
        <button onClick={() => suchen()} style={{
          background: farben.system, border: "none", borderRadius: RAD.sm,
          padding: "4px 11px", cursor: "pointer",
          fontSize: FS.s, fontWeight: FW.bold, color: getContrastColor(farben.system), whiteSpace: "nowrap", fontFamily: "inherit" }}>
          Suchen
        </button>
      </div>
      {fokus && vorschlaege.length > 0 && (
        <div style={{ position: "absolute", top: "calc(100% + 6px)", left: 0, right: 0, zIndex: 100,
          background: t.card, border: `1px solid ${farben.system}40`, borderRadius: RAD.ml,
          boxShadow: "0 16px 48px rgba(0,0,0,0.35)", overflow: "hidden" }}>
          {vorschlaege.map((v, i) => (
            <button key={i} onMouseDown={() => suchen(v.text)} style={{
              width: "100%", display: "flex", alignItems: "center", gap: 10,
              padding: "9px 14px", background: "none", border: "none",
              borderBottom: `1px solid ${t.border}20`, cursor: "pointer",
              textAlign: "left", fontFamily: "inherit" }}
              onMouseEnter={e => e.currentTarget.style.background = accent + "0C"}
              onMouseLeave={e => e.currentTarget.style.background = "none"}>
              <div style={{ width: 28, height: 28, borderRadius: RAD.ms, flexShrink: 0,
                background: v.typ === "ve" ? accent + "20" : v.typ === "kontakt" ? farben.firma + "20" : t.surface,
                display: "flex", alignItems: "center", justifyContent: "center" }}>
                <I name={v.typ === "ve" ? "building" : v.typ === "kontakt" ? "user" : "home"}
                  size={13} color={v.typ === "ve" ? accent : v.typ === "kontakt" ? farben.firma : t.muted}/>
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: FS.m, fontWeight: FW.bold, color: t.text }}>{v.text}</div>
                <div style={{ fontSize: FS.xs, color: t.sub }}>{v.sub}</div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Suchergebnisse ──────────────────────────────────────────────────────────
function Suchergebnisse({ ergebnisse, suchbegriff, t, accent,
  onSchliessen, ves, setVes, kontakte, setKontakte }) {
  const [expandedVEId, setExpandedVEId] = useState(null);
  const [expandedKontaktId, setExpandedKontaktId] = useState(null);
  const farben = useKontaktFarbe();
  // Bewusst kein Auto-Scroll beim Aufklappen — der geklickte Eintrag
  // bleibt an seiner Stelle.

  const updateKontakt = (id, patch) => {
    setKontakte(prev => prev.map(k => k.id === id ? { ...k, ...patch } : k));
  };
  const onVEFromKontakt = (id) => { setExpandedKontaktId(null); setExpandedVEId(id); };
  const onKontaktFromVE = (id) => { setExpandedVEId(null); setExpandedKontaktId(id); };

  const renderVEList = (list) => (
    <div style={{ display: "grid",
      gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 10 }}>
      {list.map(ve => {
        const offen = expandedVEId === ve.id;
        return (
          <Fragment key={ve.id}>
            {offen ? (
              <div style={{ gridColumn: "1 / -1",
                background: accent + "08",
                border: `1px solid ${accent}`,
                borderRadius: RAD.lg, padding: "14px 16px" }}>
                <VEDetail ve={ve} kontakte={kontakte} setKontakte={setKontakte}
                  t={t} accent={accent} ves={ves} setVes={setVes}
                  cardId={"such-obj-" + ve.id}
                  onKontaktClick={onKontaktFromVE}
                  headerOhneEditBtn={true}
                  onBack={() => setExpandedVEId(null)}/>
              </div>
            ) : (
              <VEKachel ve={ve} t={t} accent={accent} aktiv={false}
                id={"such-obj-" + ve.id}
                onClick={() => setExpandedVEId(ve.id)}/>
            )}
          </Fragment>
        );
      })}
    </div>
  );

  const renderKontaktList = (list) => (
    <div style={{ display: "grid",
      gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 10 }}>
      {list.map(k => {
        const offen = expandedKontaktId === k.id;
        const kFarbe = k.typ === "firma" ? farben.firma : farben.person;
        return (
          <Fragment key={k.id}>
            {offen ? (
              <div style={{ gridColumn: "1 / -1" }}>
                <KontaktDetailKarte k={k} t={t} accent={kFarbe}
                  ves={ves} kontakte={kontakte} setKontakte={setKontakte}
                  onVEClick={onVEFromKontakt}
                  embedded
                  onKopfClick={() => setExpandedKontaktId(null)}
                  onUpdate={(patch) => updateKontakt(k.id, patch)}/>
              </div>
            ) : (
              <KontaktKarte k={k} t={t} aktiv={false}
                id={"such-kon-" + k.id}
                onClick={() => setExpandedKontaktId(k.id)}/>
            )}
          </Fragment>
        );
      })}
    </div>
  );

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center",
        gap: 10, marginBottom: 16 }}>
        <div style={{ flex: 1, minWidth: 0, fontSize: FS.l, fontWeight: FW.bold, color: t.text,
          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          Ergebnisse für „{suchbegriff}"
        </div>
        <AktionsButton variante="breit" rolle="abbrechen" onClick={onSchliessen}
          title="Suche schließen" text="Schließen" t={t} accent={accent}/>
      </div>
      {ergebnisse.objekte && (
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: FS.xs, fontWeight: FW.bold, color: t.muted,
            textTransform: "uppercase", letterSpacing: "0.12em", marginBottom: 10 }}>Objekte</div>
          {renderVEList(ergebnisse.objekte)}
        </div>
      )}
      {ergebnisse.objekte_von_kontakt && (
        <div style={{ marginBottom: 20 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
            <Avatar name={ergebnisse.objekte_von_kontakt.kontakt.name} size={24} accent={accent}
              zuweisungen={zuweisungenFuerAvatar(ergebnisse.objekte_von_kontakt.kontakt)}/>
            <div style={{ fontSize: FS.l, fontWeight: FW.bold, color: t.text }}>
              Objekte von <span style={{ color: accent }}>{ergebnisse.objekte_von_kontakt.kontakt.name}</span>
            </div>
          </div>
          {renderVEList(ergebnisse.objekte_von_kontakt.ves)}
        </div>
      )}
      {ergebnisse.kontakte && (
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: FS.xs, fontWeight: FW.bold, color: t.muted,
            textTransform: "uppercase", letterSpacing: "0.12em", marginBottom: 10 }}>Kontakte</div>
          {renderKontaktList(ergebnisse.kontakte)}
        </div>
      )}
      {!ergebnisse.objekte && !ergebnisse.kontakte && !ergebnisse.objekte_von_kontakt && (
        <div style={{ fontSize: FS.m, color: t.muted, textAlign: "center", padding: "30px 0" }}>
          Keine Ergebnisse für „{suchbegriff}".
        </div>
      )}
    </div>
  );
}


export { SucheFeld, Suchergebnisse };
