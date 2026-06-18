import {
  ACCENT, DEFAULT_GEWERKE_LISTE, DEFAULT_KATEGORIEN, DEFAULT_LEISTUNGEN,
  DEFAULT_ROLLEN, DEFAULT_VERWENDUNGEN, KONTAKTE_FARBE
} from "./constants.js";
import { isoHeute, splitPlzOrt, zuIsoDatum } from "./utils-basis.js";

// ╔═════════════════════════════════════════════════════════════════════════╗
// ║ SEKTION 2 · DATENMODELL  (Modell A) — ausgelagertes Modul                ║
// ║ Enthält zusätzlich das eigStatus-Trio (EIG_STATUS/eigStatus/             ║
// ║ laufenderEigWechsel), fachlich Datenmodell, vormals in S5.               ║
// ╚═════════════════════════════════════════════════════════════════════════╝

// ║ SEKTION 2 · DATENMODELL  (Modell A)                                     ║
// ║ DEFAULT_KONTAKTE · DEFAULT_VES · DEFAULT_SETTINGS · FIELD_TYPES         ║
// ╚═════════════════════════════════════════════════════════════════════════╝

// ── Daten: Kontakte ─────────────────────────────────────────────────────────
// ── Mock-Daten: Generator mit deterministischem Seed ───────────────────────
// Erzeugt 100 Personen, 20 Firmen und 15 Objekte mit kreuz-verlinkten
// Eigentümern, Mietern, Beiräten, Dienstleistern. Seed = 12345.
function buildMockData() {
  let seed = 12345;
  const rand = () => { seed = (seed * 1664525 + 1013904223) & 0x7fffffff; return seed / 0x7fffffff; };
  const randInt = (min, max) => Math.floor(rand() * (max - min + 1)) + min;
  const pick = (arr) => arr[Math.floor(rand() * arr.length)];
  const chance = (pct) => rand() * 100 < pct;

  const VORNAMEN_M = ["Maximilian","Felix","Lukas","Paul","Jonas","Tim","Leon","David","Daniel","Tobias","Stefan","Andreas","Christian","Markus","Klaus","Wolfgang","Thomas","Michael","Frank","Peter","Hans","Bernd","Heinz","Werner","Joachim","Helmut","Walter","Wilhelm","Manfred","Horst","Erich","Hermann","Karl","Friedrich","Otto","Albert","Ernst","Heinrich","Erwin","Günter","Rudolf","Dieter","Norbert","Reinhard","Detlef","Volker","Ralf","Uwe","Olaf","Julian"];
  const VORNAMEN_F = ["Anna","Sophia","Marie","Lena","Lea","Mia","Hannah","Emma","Lina","Laura","Sara","Lisa","Maria","Julia","Katrin","Petra","Susanne","Brigitte","Monika","Birgit","Heike","Andrea","Karin","Sabine","Christine","Ingrid","Ursula","Renate","Elke","Christa","Helga","Marion","Doris","Annette","Silvia","Beate","Cornelia","Martina","Gisela","Iris","Bettina","Tanja","Claudia","Steffi","Carolin","Astrid","Vanessa","Nicole","Sandra","Stefanie"];
  const NACHNAMEN = ["Müller","Schmidt","Schneider","Fischer","Weber","Meyer","Wagner","Becker","Schulz","Hoffmann","Schäfer","Koch","Bauer","Richter","Klein","Wolf","Schröder","Neumann","Schwarz","Zimmermann","Braun","Krüger","Hofmann","Hartmann","Lange","Schmitt","Werner","Schmitz","Krause","Meier","Lehmann","Schmid","Schulze","Maier","Köhler","Herrmann","König","Walter","Mayer","Huber","Kaiser","Fuchs","Peters","Lang","Scholz","Möller","Weiß","Jung","Hahn","Schubert","Vogel","Friedrich","Keller","Günther","Frank","Berger","Winkler","Roth","Beck","Lorenz","Baumann","Franke","Albrecht","Schuster","Simon","Ludwig","Böhm","Winter","Kraus","Martin","Schumacher","Krämer","Vogt","Stein","Jäger","Otto","Sommer","Groß","Seidel","Brandt","Haas","Schreiber","Graf","Schulte","Dietrich","Ziegler","Kuhn","Pohl","Engel","Horn","Busch","Bergmann","Voigt","Sauer","Arnold","Wolff","Pfeiffer","Holz","Krieger"];
  const STRASSEN = ["Hauptstraße","Bahnhofstraße","Schulstraße","Gartenstraße","Bergstraße","Lindenstraße","Schillerstraße","Goethestraße","Mozartstraße","Beethovenstraße","Kirchstraße","Mühlenweg","Parkstraße","Waldstraße","Münchner Straße","Berliner Straße","Hamburger Straße","Frankfurter Straße","Nürnberger Straße","Sebastian-Bach-Straße","Theodor-Heuss-Straße","Karl-Marx-Straße","Adenauerstraße","Schwabinger Straße","Sendlinger Straße","Maximilianstraße","Rosenheimer Straße","Tegernseer Landstraße","Implerstraße","Lindwurmstraße"];
  const PLZ_ORTE = ["80331 München","80333 München","80335 München","80336 München","80337 München","80339 München","80469 München","80539 München","80636 München","80637 München","80686 München","80796 München","80797 München","80801 München","80803 München","80807 München","80809 München"];
  const FIRMA_RECHTSFORMEN = ["GmbH","OHG","KG","GmbH & Co. KG","e.K.","AG"];
  const HV_NAMEN = ["Muster Hausverwaltung","Bayern Immobilien","Stadt-Verwaltung","Wohnbau München","Süd-Verwaltung"];
  const HM_NAMEN = ["Hausmeister-Service Bayern","Allround Service","Gebäudemanagement Süd"];
  const FIRMENNAMEN_ELEKTRO = ["Elektro Fischer","Elektrotechnik Bayern","E-Service München"];
  const FIRMENNAMEN_SANITAER = ["Sanitär Maier","Heizungstechnik Schmid","Wasser & Wärme GmbH"];
  const FIRMENNAMEN_REINIGUNG = ["Glanz & Sauber","Bayrische Gebäudereinigung","CleanTec"];
  const FIRMENNAMEN_GRUEN = ["Grünpflege München","Gartenservice Bayern"];
  const FIRMENNAMEN_VERSORGER = ["Stadtwerke München","E.ON Energie"];
  const FIRMENNAMEN_VERSICHERUNG = ["Allianz Versicherung","Bayerische Hausratsversicherung"];

  const ddmmyyyy = (off) => {
    const d = new Date(); d.setDate(d.getDate() + off);
    return `${String(d.getDate()).padStart(2,"0")}.${String(d.getMonth()+1).padStart(2,"0")}.${d.getFullYear()}`;
  };
  const yyyy = (off) => { const d = new Date(); d.setFullYear(d.getFullYear() + off); return ddmmyyyy(0).slice(0,6) + d.getFullYear(); };

  // ── Firmen erzeugen (IDs 101..120) ─────────────────────────────────────
  const firmenLayouts = [
    { typ:"hv",         gewerke:["Hausverwaltung"],    rolle:"Hausverwaltung", anzahl:4 },
    { typ:"hm",         gewerke:["Hausmeister"],       rolle:"Hausmeister",    anzahl:2 },
    { typ:"sanitaer",   gewerke:["Sanitär","Heizung"], rolle:"Wartung",        anzahl:3 },
    { typ:"elektro",    gewerke:["Elektro"],           rolle:"Wartung",        anzahl:3 },
    { typ:"reinigung",  gewerke:["Reinigung"],         rolle:"Reinigung",      anzahl:2 },
    { typ:"gruen",      gewerke:["Grünpflege","Winterdienst"], rolle:"Grünpflege", anzahl:2 },
    { typ:"versorger",  gewerke:["Strom","Wasser","Gas"], rolle:"Versorger",   anzahl:2 },
    { typ:"versicher",  gewerke:["Versicherung"],      rolle:"Versicherung",   anzahl:2 },
  ];
  const firmen = [];
  let fid = 101;
  firmenLayouts.forEach(lay => {
    for (let i = 0; i < lay.anzahl; i++) {
      const namePool = lay.typ === "hv" ? HV_NAMEN
        : lay.typ === "hm" ? HM_NAMEN
        : lay.typ === "elektro" ? FIRMENNAMEN_ELEKTRO
        : lay.typ === "sanitaer" ? FIRMENNAMEN_SANITAER
        : lay.typ === "reinigung" ? FIRMENNAMEN_REINIGUNG
        : lay.typ === "gruen" ? FIRMENNAMEN_GRUEN
        : lay.typ === "versorger" ? FIRMENNAMEN_VERSORGER
        : FIRMENNAMEN_VERSICHERUNG;
      const baseName = namePool[i % namePool.length];
      const rechtsform = pick(FIRMA_RECHTSFORMEN);
      const fullName = `${baseName} ${rechtsform}`;
      const _po = splitPlzOrt(pick(PLZ_ORTE));
      const strasse = `${pick(STRASSEN)} ${randInt(1, 199)}`;
      firmen.push({
        id: fid, typ:"firma", name: fullName, rechtsform,
        sub: lay.gewerke.join(" · "),
        tel: `089 ${randInt(100000, 999999)}`,
        email: `info@${baseName.toLowerCase().replace(/[^a-z]+/g,"")}.de`,
        homepage: `www.${baseName.toLowerCase().replace(/[^a-z]+/g,"")}.de`,
        strasse, plz: _po.plz, ort: _po.ort,
        gewerke: lay.gewerke, ansprechpartner: [],
        _typ: lay.typ, _defaultRolle: lay.rolle,
        objektZuweisungen: [], // wird später befüllt
      });
      fid++;
    }
  });

  // ── 100 Personen erzeugen (IDs 1..100) ─────────────────────────────────
  const personen = [];
  for (let id = 1; id <= 100; id++) {
    const istM = chance(55);
    const vorname = pick(istM ? VORNAMEN_M : VORNAMEN_F);
    const nachname = pick(NACHNAMEN);
    const anrede = istM ? "Herr" : "Frau";
    const titel = chance(15) ? pick(["Dr.", "Prof.", "Prof. Dr.", "Dipl.-Ing.", "Dipl.-Kfm.", "Mag."]) : "";
    const strasse = `${pick(STRASSEN)} ${randInt(1, 199)}`;
    const _po = splitPlzOrt(pick(PLZ_ORTE));
    const tels = [];
    tels.push({ type: "Mobil", nr: `01${randInt(50,79)} ${randInt(1000000, 9999999)}` });
    if (chance(35)) tels.push({ type: "Festnetz", nr: `089 ${randInt(100000, 999999)}` });
    const emails = [];
    if (chance(85)) emails.push({ type: "Privat", email: `${vorname.toLowerCase()}.${nachname.toLowerCase().replace(/[äöüß]/g, ch => ({"ä":"ae","ö":"oe","ü":"ue","ß":"ss"}[ch]))}@${pick(["gmx.de","web.de","gmail.com","t-online.de"])}` });
    if (chance(20)) emails.push({ type: "Geschäftlich", email: `${vorname.charAt(0).toLowerCase()}.${nachname.toLowerCase().replace(/[äöüß]/g, ch => ({"ä":"ae","ö":"oe","ü":"ue","ß":"ss"}[ch]))}@firma.de` });
    personen.push({
      id, typ:"person", anrede, titel, vorname, nachname,
      name: `${vorname} ${nachname}`,
      sub: "", badges: [],
      tels, emails, strasse, plz: _po.plz, ort: _po.ort,
      rollen: [],
      objektZuweisungen: [],
    });
  }

  // ── 15 Objekte erzeugen (IDs ve1..ve15) ────────────────────────────────
  const ves = [];
  let eIdCounter = 1;
  for (let i = 1; i <= 15; i++) {
    const veId = `ve${i}`;
    const nr = `WEG-2024-${String(i).padStart(3, "0")}`;
    const adresse = `${pick(STRASSEN)} ${randInt(1, 199)}, ${pick(PLZ_ORTE)}`;
    // 2-12 Wohneinheiten + 0-6 Stellplätze
    const anzahlWE = randInt(2, 12);
    const anzahlSP = chance(70) ? randInt(1, 6) : 0;
    const einheiten = [];
    for (let w = 1; w <= anzahlWE; w++) {
      const flaeche = randInt(45, 145);
      const zimmer = `${randInt(1, 5)}${chance(40) ? ",5" : ""}`;
      const lagen = ["EG links","EG rechts","1. OG links","1. OG rechts","2. OG links","2. OG rechts","3. OG","DG"];
      einheiten.push({
        id: `e${eIdCounter++}`, nr: `WE ${String(w).padStart(2,"0")}`,
        verwNr: `V-${String(w).padStart(3,"0")}`,
        typ: "Wohneigentum",
        flaeche: `${flaeche} m²`,
        mea: `${Math.round(1000/anzahlWE)}`,
        lage: lagen[(w-1) % lagen.length], zimmer,
        eigentuemer: [], mieter: [],
      });
    }
    for (let s = 1; s <= anzahlSP; s++) {
      einheiten.push({
        id: `e${eIdCounter++}`, nr: `SP-${String(s).padStart(2,"0")}`,
        verwNr: `V-S${String(s).padStart(2,"0")}`,
        typ: "Stellplatz", flaeche: "", mea: "",
        lage: chance(50) ? "TG UG" : "Außen",
        eigentuemer: [], mieter: [], spStellung: "eigenstaendig", spEinheitId: null,
      });
    }
    // Verwaltungs-Status: 60% aktiv, 20% läuft bald aus, 20% abgelaufen
    const status = rand();
    let beginn, bestelltBis, naechsteWahl;
    if (status < 0.6) {
      beginn = ddmmyyyy(-randInt(200, 1500));
      bestelltBis = ddmmyyyy(randInt(180, 800));
      naechsteWahl = "";
    } else if (status < 0.8) {
      beginn = ddmmyyyy(-randInt(800, 1500));
      bestelltBis = ddmmyyyy(randInt(1, 89)); // läuft bald aus
      naechsteWahl = ddmmyyyy(randInt(1, 60));
    } else {
      beginn = ddmmyyyy(-randInt(1200, 2000));
      bestelltBis = ddmmyyyy(-randInt(1, 365)); // abgelaufen
      naechsteWahl = "";
    }
    // Verwaltungsart-Mix für Demo: ~70% WEG, je ~10% Miet, Gewerbe, SEV.
    // So sind alle 4 Arten beim Filter-Demo sichtbar.
    const artVal = rand();
    const verwaltungsart = artVal < 0.7 ? "weg"
                         : artVal < 0.8 ? "miet"
                         : artVal < 0.9 ? "gewerbe"
                         : "sev";
    ves.push({
      id: veId, nr, adresse, einheiten,
      verwaltungsart,
      verwaltung: { beginn, bestelltBis, verwalter: null, buchhalter: null, uebernommenVon: null,
        verwZustimmung: chance(60), naechsteETV: chance(70) ? ddmmyyyy(randInt(30, 300)) : "",
        naechsteWahl },
      vertraege: [], etvHistorie: [],
    });
  }

  // ── Eigentümer + Mieter pro Einheit zuweisen ───────────────────────────
  // Personen 1..70 sind "Privatpersonen" (Eigentümer/Mieter)
  // Personen 71..100 sind potenzielle Firmen-Mitarbeiter (GF/MA)
  const eigentuemerKandidaten = personen.slice(0, 70);
  let kandIdx = 0;
  ves.forEach(ve => {
    ve.einheiten.forEach(einheit => {
      // Jede Einheit hat 1 Eigentümer; gelegentlich 2 (Ehepaar)
      const e1 = eigentuemerKandidaten[kandIdx % eigentuemerKandidaten.length]; kandIdx++;
      einheit.eigentuemer.push({
        name: e1.name, von: ddmmyyyy(-randInt(100, 2500)),
        kontaktId: e1.id, grundbuch: true, selbstnutzer: chance(40),
      });
      e1.objektZuweisungen.push({ objektId: ve.id, einheitId: einheit.id, rolle: "Eigentümer", status: "aktiv" });
      if (!e1.rollen.includes("Eigentümer")) e1.rollen.push("Eigentümer");
      // ~8% Einheiten haben einen WERDENDEN Eigentümer-Wechsel (Käufer schwebt)
      if (einheit.typ === "Wohneigentum" && chance(8)) {
        const ek = eigentuemerKandidaten[kandIdx % eigentuemerKandidaten.length]; kandIdx++;
        if (ek.id !== e1.id) {
          einheit.eigentuemer.push({
            name: ek.name, von: ddmmyyyy(randInt(15, 120)),
            kontaktId: ek.id, grundbuch: false, selbstnutzer: chance(50),
          });
          ek.objektZuweisungen.push({ objektId: ve.id, einheitId: einheit.id, rolle: "Eigentümer", status: "werdend" });
          if (!ek.rollen.includes("Eigentümer")) ek.rollen.push("Eigentümer");
        }
      }
      // Mieter bei nicht-Selbstnutzern + Stellplätzen
      if (einheit.typ === "Wohneigentum" && !einheit.eigentuemer[0].selbstnutzer && chance(70)) {
        const m1 = eigentuemerKandidaten[kandIdx % eigentuemerKandidaten.length]; kandIdx++;
        if (m1.id !== e1.id) {
          einheit.mieter.push({
            name: m1.name, von: ddmmyyyy(-randInt(30, 1200)),
            kontaktId: m1.id,
          });
          m1.objektZuweisungen.push({ objektId: ve.id, einheitId: einheit.id, rolle: "Mieter", status: "aktiv" });
          if (!m1.rollen.includes("Mieter")) m1.rollen.push("Mieter");
        }
        // (Ehemalige Mieter werden NICHT mehr als verwaiste objektZuweisung
        // angelegt — die Mieter-Historie ergibt sich ausschließlich aus dem
        // Belegungsmodell und wird zentral über objektZuweisungenAusEinheiten
        // abgeleitet. Ein nur in objektZuweisungen existierender Eintrag ohne
        // zugehöriges Belegungs-Kapitel wäre inkonsistent.)
      }
      // Verwendung der Einheit aus Eigentümer-/Mieter-Situation ableiten:
      // · Selbstnutzer-Eigentümer  → Eigennutzung
      // · Vermieter mit aktivem Mieter → Vermietet
      // · weder Selbstnutzer noch Mieter → Leerstand
      // · 5 % der Einheiten: Sondereigentumsverwaltung (SEV)
      // · 4 % der Einheiten: Wohnberechtigt (Wohnrecht eingetragen)
      // · 3 % der Einheiten: Nießbrauch
      let verwName = null;
      if (chance(5))      verwName = "Sondereigentumsverwaltung";
      else if (chance(4)) verwName = "Wohnberechtigt";
      else if (chance(3)) verwName = "Nießbrauch";
      else if (einheit.mieter.length > 0) verwName = "Vermietet";
      else if (einheit.eigentuemer[0] && einheit.eigentuemer[0].selbstnutzer) verwName = "Eigennutzung";
      else if (einheit.typ === "Wohneigentum") verwName = "Leerstand";
      if (verwName) {
        einheit.verwendung = { name: verwName, status: "aktiv" };
      }
      // Bei SEV-Verwendung auch einen echten sev-Eintrag anlegen (sonst Badge
      // ohne Substanz). Eine HV-Firma fungiert als Sondereigentumsverwaltung;
      // Vollmacht in ~70 % der Fälle erteilt.
      if (verwName === "Sondereigentumsverwaltung") {
        const sevFirmen = firmen.filter(f => f._typ === "hv");
        if (sevFirmen.length > 0) {
          const sf = sevFirmen[kandIdx % sevFirmen.length];
          const eintrag = neueSev(sf.id, sf.name, ddmmyyyy(-randInt(50, 1200)));
          if (chance(70)) eintrag.vollmacht = { erteilt: true, datum: eintrag.seit };
          einheit.sev = [eintrag];
          sf.objektZuweisungen.push({ objektId: ve.id, einheitId: einheit.id,
            rolle: "Sondereigentumsverwaltung", status: "aktiv" });
        }
      }
    });
    // 1-3 Verwaltungsbeiräte pro Objekt (aus den Eigentümern)
    const eigPersonenIds = [...new Set(ve.einheiten.flatMap(e => (e.eigentuemer||[]).map(et => et.kontaktId)))];
    const anzahlBeirate = Math.min(eigPersonenIds.length, randInt(1, 3));
    for (let b = 0; b < anzahlBeirate; b++) {
      const pid = eigPersonenIds[b];
      const p = personen.find(x => x.id === pid);
      if (!p) continue;
      const istVorsitz = b === 0; // erster ist Vorsitz
      p.objektZuweisungen.push({ objektId: ve.id, einheitId: null, rolle: "Verwaltungsbeirat",
        status: "aktiv", ...(istVorsitz ? { vorsitz: true } : {}) });
      if (!p.rollen.includes("Verwaltungsbeirat")) p.rollen.push("Verwaltungsbeirat");
    }
    // 0-1 Rechnungsprüfer (aus weiteren Eigentümern)
    if (chance(60) && eigPersonenIds.length > anzahlBeirate) {
      const pid = eigPersonenIds[anzahlBeirate];
      const p = personen.find(x => x.id === pid);
      if (p) {
        p.objektZuweisungen.push({ objektId: ve.id, einheitId: null, rolle: "Rechnungsprüfer", status: "aktiv" });
        if (!p.rollen.includes("Rechnungsprüfer")) p.rollen.push("Rechnungsprüfer");
      }
    }
    // Selten: Nießbraucher (10%)
    if (chance(10)) {
      const einheit = pick(ve.einheiten.filter(e => e.typ === "Wohneigentum"));
      if (einheit) {
        const niesId = eigentuemerKandidaten[kandIdx % eigentuemerKandidaten.length].id; kandIdx++;
        const p = personen.find(x => x.id === niesId);
        if (p) {
          p.objektZuweisungen.push({ objektId: ve.id, einheitId: einheit.id, rolle: "Nießbraucher", status: "aktiv" });
          if (!p.rollen.includes("Nießbraucher")) p.rollen.push("Nießbraucher");
        }
      }
    }
  });

  // ── Firmen den Objekten zuweisen ───────────────────────────────────────
  const hvFirmen      = firmen.filter(f => f._typ === "hv");
  const hmFirmen      = firmen.filter(f => f._typ === "hm");
  const sanitaerFirmen= firmen.filter(f => f._typ === "sanitaer");
  const elektroFirmen = firmen.filter(f => f._typ === "elektro");
  const reinigungFirmen = firmen.filter(f => f._typ === "reinigung");
  const gruenFirmen   = firmen.filter(f => f._typ === "gruen");
  const versorgerFirmen = firmen.filter(f => f._typ === "versorger");
  const versicherFirmen = firmen.filter(f => f._typ === "versicher");
  ves.forEach((ve, idx) => {
    // Hausverwaltung: rotierend, alle haben eine
    const hv = hvFirmen[idx % hvFirmen.length];
    hv.objektZuweisungen.push({ objektId: ve.id, rolle: "Hausverwaltung", status: "aktiv" });
    // Hausmeister: 80%
    if (chance(80)) {
      const hm = hmFirmen[idx % hmFirmen.length];
      hm.objektZuweisungen.push({ objektId: ve.id, rolle: "Hausmeister", status: "aktiv" });
    }
    // Wartung Sanitär: 90%
    if (chance(90)) {
      const f = sanitaerFirmen[idx % sanitaerFirmen.length];
      f.objektZuweisungen.push({ objektId: ve.id, rolle: "Wartung", status: "aktiv" });
      // ein Vertrag dazu
      ve.vertraege.push({ id: `v${ve.id}-s`, typ: "Wartungsvertrag",
        leistung: "Heizungswartung jährlich", firmaId: f.id,
        ab: ddmmyyyy(-randInt(100, 1500)), bis: "", vertragsnr: `VTR-${ve.id}-S` });
    }
    // Elektro: 60%
    if (chance(60)) {
      const f = elektroFirmen[idx % elektroFirmen.length];
      f.objektZuweisungen.push({ objektId: ve.id, rolle: "Wartung", status: "aktiv" });
    }
    // Reinigung: 70%
    if (chance(70)) {
      const f = reinigungFirmen[idx % reinigungFirmen.length];
      f.objektZuweisungen.push({ objektId: ve.id, rolle: "Reinigung", status: "aktiv" });
      ve.vertraege.push({ id: `v${ve.id}-r`, typ: "Reinigungsvertrag",
        leistung: "Treppenhaus-Reinigung", firmaId: f.id,
        ab: ddmmyyyy(-randInt(100, 1200)), bis: "", vertragsnr: `VTR-${ve.id}-R` });
    }
    // Grünpflege: 50%
    if (chance(50)) {
      const f = gruenFirmen[idx % gruenFirmen.length];
      f.objektZuweisungen.push({ objektId: ve.id, rolle: "Grünpflege", status: "aktiv" });
    }
    // Versorger: 100%
    const vers = versorgerFirmen[idx % versorgerFirmen.length];
    vers.objektZuweisungen.push({ objektId: ve.id, rolle: "Versorger", status: "aktiv" });
    ve.vertraege.push({ id: `v${ve.id}-vs`, typ: "Versorgungsvertrag",
      leistung: "Strom / Gas Allgemeinstrom", firmaId: vers.id, intervall: "laufend",
      ab: ddmmyyyy(-randInt(200, 1800)), bis: "", vertragsnr: `VTR-${ve.id}-VS` });
    // Versicherung: 100%
    const vsi = versicherFirmen[idx % versicherFirmen.length];
    vsi.objektZuweisungen.push({ objektId: ve.id, rolle: "Versicherung", status: "aktiv" });
    ve.vertraege.push({ id: `v${ve.id}-vr`, typ: "Versicherungsvertrag",
      leistung: "Gebäudeversicherung", firmaId: vsi.id, intervall: "jährlich",
      ab: ddmmyyyy(-randInt(200, 2000)), bis: "", vertragsnr: `VTR-${ve.id}-VR` });
    // Ehemalige Hausverwaltung gelegentlich (40%): zweite HV als ehemalig
    if (chance(40)) {
      const altHv = hvFirmen[(idx + 1) % hvFirmen.length];
      if (altHv !== hv) {
        altHv.objektZuweisungen.push({ objektId: ve.id, rolle: "Hausverwaltung", status: "ehemalig" });
      }
    }
  });

  // ── Geschäftsführer & Mitarbeiter: Personen 71..100 ────────────────────
  const firmaMitarbeiterKand = personen.slice(70, 100);
  let mIdx = 0;
  firmen.forEach(f => {
    // Jede Firma hat 1 GF + 0-2 Mitarbeiter
    const gf = firmaMitarbeiterKand[mIdx % firmaMitarbeiterKand.length]; mIdx++;
    gf.objektZuweisungen.push({ firmaId: f.id, rolle: "Geschäftsführer", status: "aktiv" });
    gf.firmaId = f.id;
    if (!gf.rollen.includes("Geschäftsführer")) gf.rollen.push("Geschäftsführer");
    f.ansprechpartner.push({ vorname: gf.vorname, nachname: gf.nachname, funktion: "Geschäftsführer" });
    const anzMA = randInt(0, 2);
    for (let m = 0; m < anzMA; m++) {
      const ma = firmaMitarbeiterKand[mIdx % firmaMitarbeiterKand.length]; mIdx++;
      if (ma.id === gf.id) continue;
      const funktionsname = pick(["Mitarbeiter", "Sachbearbeiter", "Ansprechpartner (Firma)"]);
      ma.objektZuweisungen.push({ firmaId: f.id, rolle: funktionsname, status: "aktiv" });
      if (!ma.rollen.includes(funktionsname)) ma.rollen.push(funktionsname);
      f.ansprechpartner.push({ vorname: ma.vorname, nachname: ma.nachname, funktion: funktionsname });
    }
  });

  // ── Für die Statusleisten-Demo: 5 Personen rein-ehemalig machen ────────
  // Alle aktiven/werdenden Zuweisungen dieser Personen werden in "ehemalig"
  // umgewandelt — so erscheint die "Keine aktiven Beteiligungen"-Statusleiste.
  const ehemPool = personen.slice(60, 65);
  ehemPool.forEach(p => {
    if (p.objektZuweisungen.length === 0) {
      // Falls noch nichts da, gib ihnen wenigstens eine ehemalig-Zuweisung
      const beliebige = ves[0];
      const beliebigeEinheit = beliebige.einheiten[0];
      p.objektZuweisungen.push({ objektId: beliebige.id, einheitId: beliebigeEinheit.id,
        rolle: "Mieter", status: "ehemalig" });
      if (!p.rollen.includes("Mieter")) p.rollen.push("Mieter");
    } else {
      p.objektZuweisungen = p.objektZuweisungen.map(z => ({ ...z, status: "ehemalig" }));
    }
  });

  // ── Verwalter-IDs in den ve.verwaltung-Feldern setzen ──────────────────
  // Wir nehmen den GF der zugeordneten HV-Firma als Verwalter
  ves.forEach(ve => {
    const hvZuw = firmen.find(f =>
      f._typ === "hv" && (f.objektZuweisungen || []).some(z =>
        z.objektId === ve.id && z.rolle === "Hausverwaltung" && z.status === "aktiv"
      )
    );
    if (hvZuw) {
      const gfPerson = personen.find(p => p.firmaId === hvZuw.id);
      if (gfPerson) ve.verwaltung.verwalter = gfPerson.id;
    }
  });

  // Cleanup: _typ und _defaultRolle aus Firmen entfernen
  firmen.forEach(f => { delete f._typ; delete f._defaultRolle; });

  // Neue Beziehungs-Felder (besitz/zustaendigkeiten/firmenRollen) aus den
  // gerade aufgebauten objektZuweisungen ableiten (Schritt 1a).
  const kontakteMig = [...personen, ...firmen].map(migriereKontaktZuweisungen);
  return { kontakte: kontakteMig, ves };
}


// ── Kontakt-Zuweisungs-Migration (Mock baut Altformat, hier ins Zielformat) ──
// Slot einer Rolle direkt aus den Default-Rollen lesen. Bewusst ohne
// Modul-Level-Cache-Variable, um jede TDZ zu vermeiden (die Migration kann
// schon bei der Modul-Initialisierung von _MOCK laufen). DEFAULT_ROLLEN ist
// klein und die Migration läuft nicht in einer Hot-Loop.
function slotFuerRolle(name) {
  for (let i = 0; i < DEFAULT_ROLLEN.length; i++) {
    if (DEFAULT_ROLLEN[i].name === name) return DEFAULT_ROLLEN[i].slot;
  }
  return undefined;
}

// Eine alte objektZuweisung in eine der drei neuen Kategorien einsortieren.
// Rückgabe: { kat: "besitz"|"zustaendigkeit"|"firmenrolle", eintrag }
function klassifiziereZuweisung(z, kontaktTyp) {
  if (!z || typeof z !== "object") return null;
  const slot = slotFuerRolle(z.rolle);
  const status = z.status || "aktiv";

  // (D) Personen-/Firmen-Vertretung: Ziel ist ein anderer Kontakt (zielKontaktId),
  // z. B. "Bevollmächtigter für Person Z" / "Betreuer für Z". Vor der firmaId-
  // Prüfung, da das Ziel auch eine Firma sein kann (zielKontaktId ≠ firmaId-Anstellung).
  if (z.zielKontaktId != null) {
    return { kat: "zustaendigkeit", eintrag: {
      beteiligterTyp: kontaktTyp,
      ziel: { art: "kontakt", objektId: null, einheitId: null, anlageId: null, kontaktId: z.zielKontaktId },
      leistung: z.rolle || "", status,
      vertragId: null, ansprechpartnerId: null,
    }};
  }

  // (C) Anstellung: firmaId und kein Objektbezug → Person bei Firma
  if (z.firmaId != null && z.objektId == null && z.einheitId == null && z.geraetId == null) {
    return { kat: "firmenrolle", eintrag: { firmaId: z.firmaId, rolle: z.rolle || "", status } };
  }

  // (B) Zuständigkeit: Anlage/Gerät-Ziel
  if (z.geraetId != null || z.anlageId != null) {
    return { kat: "zustaendigkeit", eintrag: {
      beteiligterTyp: kontaktTyp,
      ziel: { art: "anlage", objektId: z.objektId || null, einheitId: z.einheitId || null,
              anlageId: z.anlageId || z.geraetId || null },
      leistung: z.rolle || "", status,
      vertragId: z.vertragId || null, ansprechpartnerId: z.ansprechpartnerId || null,
    }};
  }

  // (B) Zuständigkeit: Gremium-Rollen (Beirat, Rechnungsprüfer) → Objekt-Bezug
  if (slot === "gremium") {
    const e = { beteiligterTyp: kontaktTyp,
      ziel: { art: "objekt", objektId: z.objektId || null, einheitId: null, anlageId: null },
      leistung: z.rolle || "", status,
      vertragId: null, ansprechpartnerId: null };
    if (z.vorsitz) e.vorsitz = true;
    return { kat: "zustaendigkeit", eintrag: e };
  }

  // (B) Zuständigkeit: Person als objektbezogener Ansprechpartner (Slot firma,
  // aber mit Objekt-/Einheit-Bezug statt firmaId) → Zuständigkeit, nicht Besitz.
  if (slot === "firma" && z.firmaId == null && z.objektId != null) {
    return { kat: "zustaendigkeit", eintrag: {
      beteiligterTyp: kontaktTyp,
      ziel: { art: z.einheitId ? "einheit" : "objekt", objektId: z.objektId,
              einheitId: z.einheitId || null, anlageId: null },
      leistung: z.rolle || "", status,
      vertragId: z.vertragId || null, ansprechpartnerId: null,
    }};
  }

  // (B) Zuständigkeit: Firmen-Dienstleistung am Objekt (Hausverwaltung, Hausmeister, …)
  // Erkennbar an: Firmen-Kontakt mit objektId, ohne einheitId-Besitzbezug.
  if (kontaktTyp === "firma" && z.objektId != null) {
    const e = {
      beteiligterTyp: "firma",
      ziel: { art: z.einheitId ? "einheit" : "objekt", objektId: z.objektId,
              einheitId: z.einheitId || null, anlageId: null },
      leistung: z.rolle || "", status,
      vertragId: z.vertragId || null, ansprechpartnerId: z.ansprechpartnerId || null,
    };
    if (z.vertrag) e.vertrag = true;
    return { kat: "zustaendigkeit", eintrag: e };
  }

  // (A) Besitz/Nutzung: ve/sev-Rollen ODER Objekt-/Einheit-Bezug einer Person
  if (z.objektId != null) {
    return { kat: "besitz", eintrag: {
      beteiligterTyp: kontaktTyp,
      objektId: z.objektId, einheitId: z.einheitId || null,
      rolle: z.rolle || "", status,
    }};
  }

  return null; // nicht klassifizierbar → wird übersprungen (alte Daten bleiben erhalten)
}

// Migriert einen Kontakt: leitet besitz[]/zustaendigkeiten[]/firmenRollen[] aus
// objektZuweisungen[] ab. Idempotent: läuft nur, wenn die neuen Felder fehlen.
// WICHTIG (1a): objektZuweisungen bleibt vorerst ERHALTEN, damit die bestehende
// Anzeige weiterläuft. Erst in 1b/1c stellen wir die Lesepfade um.
// ── Einmal-Migration (v5.76): "Miteigentümer" → "Eigentümer" ────────────────
// Die Rolle "Miteigentümer" wurde gestrichen. Mehrere Eigentümer einer Einheit
// (Ehepaar, Erbengemeinschaft) sind alle schlicht "Eigentümer". Schreibt den
// alten Rollen-Namen in allen Listen um; rollen[] wird dabei dedupliziert.
function mappeMiteigentuemer(k) {
  if (!k || typeof k !== "object") return k;
  const ME = "Miteigentümer", E = "Eigentümer";
  let geaendert = false;
  const out = { ...k };
  if (Array.isArray(out.rollen)) {
    const neu = [];
    out.rollen.forEach(r => {
      const name = (r === ME) ? E : r;
      if (r === ME) geaendert = true;
      if (neu.indexOf(name) < 0) neu.push(name);  // Dedup
    });
    if (geaendert) out.rollen = neu;
  }
  const mapListe = (liste, feld) => {
    if (!Array.isArray(liste)) return liste;
    let hit = false;
    const neu = liste.map(z => {
      if (z && z[feld] === ME) { hit = true; return { ...z, [feld]: E }; }
      return z;
    });
    if (hit) geaendert = true;
    return hit ? neu : liste;
  };
  out.besitz             = mapListe(out.besitz, "rolle");
  out.objektZuweisungen  = mapListe(out.objektZuweisungen, "rolle");
  return geaendert ? out : k;
}

function migriereKontaktZuweisungen(k) {
  if (!k || typeof k !== "object") return k;
  // Einmal-Migration (v5.76): "Miteigentümer" → "Eigentümer" in allen Feldern.
  // Idempotent (ein Eigentümer ggf. doppelt → unten via Set dedupliziert). Läuft
  // VOR dem early-return, damit auch bereits migrierte Kontakte erfasst werden.
  k = mappeMiteigentuemer(k);
  if (k.besitz != null || k.zustaendigkeiten != null || k.firmenRollen != null) return k;
  const alt = Array.isArray(k.objektZuweisungen) ? k.objektZuweisungen : [];
  const besitz = [], zustaendigkeiten = [], firmenRollen = [];
  alt.forEach(z => {
    const c = klassifiziereZuweisung(z, k.typ);
    if (!c) return;
    if (c.kat === "besitz") besitz.push(c.eintrag);
    else if (c.kat === "zustaendigkeit") zustaendigkeiten.push(c.eintrag);
    else if (c.kat === "firmenrolle") firmenRollen.push(c.eintrag);
  });
  return { ...k, besitz, zustaendigkeiten, firmenRollen };
}

const _MOCK = buildMockData();
const DEFAULT_KONTAKTE = _MOCK.kontakte;
const DEFAULT_VES = _MOCK.ves;


// ── Default-Settings ────────────────────────────────────────────────────────
const DEFAULT_SETTINGS = {
  hvName: "Muster Hausverwaltung GmbH",
  hvLogoUrl: "",
  hvLogo: "",                  // hochgeladenes Logo (DataURL) — Vorrang vor hvLogoUrl im Listendruck
  tastaturAn: true,            // globale Tastaturkürzel aktiv
  tastaturBelegung: {},        // Overrides { aktionId: taste } — leer = Standard
  headerZeigeAvatar: true,
  headerZeigeSuche: true,
  headerZeigeDunkelmodus: true,
  filterAktiv: true,
  filterTyp: "verwalter",       // "verwalter" oder "buchhalter"
  filterAktive: {},             // Map: { kontaktId: false } – sichtbar wenn nicht false
  suchKategorien: [
    { id:"objekte",   label:"Objekte",   aktiv:true  },
    { id:"kontakte",  label:"Kontakte",  aktiv:true  },
    { id:"adressen",  label:"Adressen",  aktiv:true  },
    { id:"vertraege", label:"Verträge",  aktiv:false },
  ],
  // Intelligente Suche — alle Stufen default an. Stufe 1 (exakt) ist immer aktiv.
  sucheDiakritika:           true,   // Umlaute & Akzente ignorieren (Müller=Mueller=Muller)
  sucheWoerter:              true,   // Mehrere Wortteile (alle müssen vorkommen)
  suchePhonetik:             true,   // Kölner Phonetik (Meier=Meyer=Mayer)
  sucheTippfehler:           true,   // Levenshtein-Distanz für Tippfehler
  sucheTippfehlerSchwelle:   2,      // Max. Edit-Distanz (1=streng, 3=sehr tolerant)
  // Reihenfolge der Einstellungs-Sektionen (Array von IDs)
  sektionenReihenfolge: null,  // null = Default-Reihenfolge wie in SEKTIONEN definiert
  dashboardModus: "immer", // "aus" | "immer" | "home" – nur Homescreen oder überall
  dashboardSticky: true,   // bei Mobile (Hochkant): Kategorie-Leiste bleibt unter dem Header sticky
  sidebarBreite: 200,      // Breite der Desktop-Sidebar (px) – wird vom Resize-Handle gesetzt
  rollen: DEFAULT_ROLLEN,  // Editierbare Rollen (Name, Kürzel, Farbe, Aktiv) – Reihenfolge im Array zählt
  firmenRollen: DEFAULT_GEWERKE_LISTE, // GEWERKE der Firma (Sanitär, Elektro, …) – Badge-fähig
  leistungen: DEFAULT_LEISTUNGEN, // Leistungen/Zuständigkeiten am Objekt (Hausverwaltung, Wartung, …)
  verwendungen: DEFAULT_VERWENDUNGEN, // Verwendungen für Objekt-Einheiten
  kategorien: DEFAULT_KATEGORIEN, // Gemeinsame Quelle für Kürzel+Farbe von Paaren (Verwendung↔Rolle)
  avatarIconsPerson: true,    // Eck-Badges an Personen-Avataren
  avatarIconsFirma:  true,    // Eck-Badges an Firmen-Avataren
  kartenBadgesPerson: true,   // Rollen-Badges auf der Kontaktkarte (Personen)
  kartenBadgesFirma:  true,   // Rollen-Badges auf der Kontaktkarte (Firmen)
  // ── Kontakte-Anzeige ──
  // Name-Format steuert sowohl Anzeige als auch Sortier-Reihenfolge:
  // "vorname-nachname" → sortiert nach Vorname; "nachname-vorname" → nach Nachname.
  kontakteNameFormat: "vorname-nachname",
  kontakteAlphaTrenner: true,   // alphabetische Trenner (A, B, C …) in der Kontaktliste
  statusLeisteObjekt:  true,  // Statusleiste unter Objekt-Karten (z. B. "Bestellung abgelaufen")
  statusLeisteKontakt: true,  // Statusleiste unter Kontakt-Karten (Demo-Inhalte)
  // Frei pflegbare Bezeichnungs-Liste für das "Neuer Termin"-Dropdown.
  // Jeder Eintrag: { id, label, farbe }. In SektionTerminVorlagen editierbar.
  terminBezeichnungen: [
    { id: "tb_begehung",  label: "Objektbegehung",        farbe: "#0E7490", sichtbar: true, bezug: "objekt",  autoBeteiligte: "keine" },
    { id: "tb_handwerk",  label: "Handwerkertermin",      farbe: "#F59E0B", sichtbar: true, bezug: "einheit", autoBeteiligte: "nutzer_einheit" },
    { id: "tb_eigent",    label: "Termin mit Eigentümer", farbe: "#3B82F6", sichtbar: true, bezug: "objekt",  autoBeteiligte: "eigentuemer" },
    { id: "tb_uebergabe", label: "Wohnungsübergabe",      farbe: "#10B981", sichtbar: true, bezug: "einheit", autoBeteiligte: "eig_nutzer_einheit" },
    { id: "tb_besicht",   label: "Besichtigung",          farbe: "#8B5CF6", sichtbar: true, bezug: "einheit", autoBeteiligte: "eig_nutzer_einheit" },
  ],
  // Anlege-Modus für neue Termine: "gefuehrt" = Schritt-für-Schritt-Assistent
  // (folgt in Teil 2), "formular" = klassisches Ein-Fenster-Formular.
  terminAnlegeModus: "formular",
  // Dauer-Schnellbuttons (Minuten) im Anlege-Flow.
  terminDauerOptionen: [15, 30, 45, 60, 90, 120],
  // Uhrzeit-Picker (Termin-Anlegen): Minuten-Raster (5 oder 15), Stunden-
  // Auswahl ganztags (24h) oder an die Arbeitszeit gekoppelt (+Puffer h davor/
  // danach). Tastatureingabe bleibt unabhängig davon immer möglich.
  zeitMinutenschritt: 15,    // 5 | 15
  zeitStundenModus: "arbeit", // "24h" | "arbeit"
  zeitArbeitPuffer: 1,       // Stunden vor/nach Arbeitszeit (nur bei "arbeit")
  // Rechnungsadresse-Sektion in der Liegenschaft-Stammdaten-Karte. Default
  // aus, da viele Verwalter ihre eigene Adresse nicht direkt im Objekt sehen
  // wollen.
  rechnungsadresseAnzeigen: false,
  farbIntensitaet: 100,    // Farb-Intensität 0..100 %. 100 = volle Akzentfarben, 0 = neutrales Grau
  systemFarbe: ACCENT,     // Akzentfarbe für System-Elemente (Logo, Zahnrad, Profil, Stift) — vom seriös-Modus mit eingegraut
  // ── Mein Profil ──
  // Eigenes User-Profil (NICHT mehr auf einen Kontakt verknüpft). Wird in
  // SektionProfil bearbeitet und im Header-Avatar als Initialen/Foto angezeigt.
  // Foto wird als Base64-DataURL gespeichert (auf 200×200 herunterskaliert
  // damit localStorage nicht überläuft).
  userProfil: {
    anrede: "",
    titel: "",
    vorname: "",
    nachname: "",
    funktion: "",
    foto: "",       // Base64-DataURL oder leer
    tels: [],       // [{ nr, type: "mobil"|"festnetz"|"büro" }]
    emails: [],     // [{ email }]
    strasse: "",
    plz: "",
    ort: "",
    geburtstag: "", // ISO YYYY-MM-DD
  },
  userKontaktId: 1,        // Verknüpft mit DEFAULT_KONTAKTE – Profil im persönlichen Menü
  dichte: "normal",        // "compact" | "normal" | "relaxed" – globale Schriftgröße/Dichte
  kartenMinBreite: 280,    // Mindest-Kartenbreite px → steuert Spaltenzahl (Übersicht) + Detailbreite (Master-Detail)
  detailFaktor: 1.1,       // Detailbreite als Vielfaches der Kartenbreite (1.0–2.5) → größer = breitere Detailansicht, weniger Master-Spalten
  hoherKontrast: false,    // sub-Texte mit deutlich höherem Kontrast
  legendeKontakte: true,   // Symbol-Legende über der Kontaktliste anzeigen
  legendeObjekte: true,    // Symbol-Legende über der Objektliste anzeigen
  // Sicherheits-Schalter: Löschen-Button getrennt für Objekte und Kontakte nur
  // sichtbar, wenn aktiv. Default aus, damit Löschen eine bewusste Entscheidung bleibt.
  loeschenErlaubtObjekte: false,
  loeschenErlaubtKontakte: false,
  // Filter-Buttons auf den Listenseiten — pro Art an/aus. Nur aktivierte Arten
  // erscheinen als Filter-Button neben der Sektions-Überschrift; "Alle" ist
  // immer sichtbar.
  filterVerwaltungsarten: { weg: true, miet: false, gewerbe: false, sev: false },
  // Eigene Gruppen (Pillen im Header): je { id, name, sichtbar, modus
  // "manuell"|"kriterien", mitglieder: [IDs], kriterien: {rollen|verwaltungsarten} }
  kontaktGruppen: [],
  // Kalender-Panel (Orientierungskalender im Kalender-Tab)
  kalWochenstart: "mo",   // "mo" | "so"
  kalKw: true,            // KW-Spalte anzeigen
  kalZoom: "monat",       // Standard-Zoomstufe: monat | woche | tag
  kalArbeitVon: 8,        // Arbeitstag-Fenster (Stunde 0–23) — im Zeitstrahl abgesetzt
  kalArbeitBis: 17,
  // Tagesspezifische Arbeitszeiten (optional). Schlüssel = JS getDay()
  // (0=So … 6=Sa). Fehlt der Eintrag, gilt kalArbeitVon/Bis für Mo–Fr und
  // Sa/So als arbeitsfrei (siehe tagArbeitszeit). { an, von, bis } je Tag.
  kalArbeitTage: null,
  kalArbeitTageAktiv: false, // false = einheitliche Zeit (kalArbeitVon/Bis) für alle Werktage
  listenAnsicht: "karten",   // "karten" | "liste" — Übersicht von Objekten/Kontakten
  kalHeuteInfo: true,     // Datum + Uhrzeit im Heute-Button anzeigen
  kalSeitenleiste: false, // Desktop: Kalender dauerhaft rechts (wie Dashboard links)
  objektGruppen: [],
  filterKontaktarten:     { person: true, firma: true }, // Rollen-Filter (p_…, f_…) werden dynamisch aus settings.rollen/firmenRollen gefüllt
  kacheln: [
    { id:"objekte",       label:"Objekte",       icon:"building",  farbe:ACCENT,    aktiv:true,  reihenfolge:0 },
    { id:"kontakte",      label:"Kontakte",      icon:"users",     farbe:KONTAKTE_FARBE,        aktiv:true,  reihenfolge:1 },
    { id:"kalender",      label:"Kalender",      icon:"calendar",  farbe:"#F59E0B", aktiv:true,  reihenfolge:2 },
    { id:"etv",           label:"ETV",           icon:"calendar",  farbe:"#8B5CF6", aktiv:true,  reihenfolge:3 },
    { id:"beschluss",     label:"Beschlusssammlung", icon:"document", farbe:"#F59E0B", aktiv:false, reihenfolge:4 },
    { id:"auftraege",     label:"Vorgänge",      icon:"ticket",    farbe:"#EF4444", aktiv:true,  reihenfolge:5 },
    { id:"kommunikation", label:"Kommunikation", icon:"mail",      farbe:"#0EA5E9", aktiv:true,  reihenfolge:6 },
    { id:"finanzen",      label:"Finanzen",      icon:"chart",     farbe:"#22C55E", aktiv:true,  reihenfolge:7 },
    { id:"technik",       label:"Technik",       icon:"wrench",    farbe:"#10B981", aktiv:false, reihenfolge:8 },
    { id:"dokumente",     label:"Dokumente",     icon:"document",  farbe:"#64748B", aktiv:false, reihenfolge:9 },
    { id:"statistik",     label:"Statistik",     icon:"chart",     farbe:"#6366F1", aktiv:true,  reihenfolge:10 },
    { id:"listen",        label:"Listengenerator", icon:"sort",    farbe:"#0E7490", aktiv:true,  reihenfolge:11 },
    { id:"fotos",         label:"Fotos",         icon:"paint",     farbe:"#EC4899", aktiv:true,  reihenfolge:12 },
    { id:"schnelleingabe", label:"Schnelleingabe", icon:"plus",    farbe:"#0080FF", aktiv:true,  reihenfolge:13 },
  ],
  // Objekt-Detail-Tabs: Reihenfolge + Sichtbarkeit (global). Liegenschaft und
  // Verwaltung sind fix (immer sichtbar, nicht sortierbar) — daher nur die
  // übrigen Tabs hier konfigurierbar. fix:true markiert die unverrückbaren.
  objektTabs: [
    { id:"liegenschaft", label:"Liegenschaft", icon:"building", aktiv:true, fix:true,  reihenfolge:0 },
    { id:"verwaltung",   label:"Verwaltung",   icon:"document", aktiv:true, fix:true,  reihenfolge:1 },
    { id:"legionellen",  label:"Legionellen",  icon:"drop",     aktiv:true, fix:false, reihenfolge:2 },
    { id:"te",           label:"TE",           icon:"badge",    aktiv:true, fix:false, reihenfolge:3 },
    { id:"dokumente",    label:"Dokumente",    icon:"document", aktiv:true, fix:false, reihenfolge:4 },
    { id:"kontakte",     label:"Kontakte",     icon:"users",    aktiv:true, fix:false, reihenfolge:5 },
    { id:"bilder",       label:"Bilder",       icon:"paint",    aktiv:true, fix:false, reihenfolge:6 },
    { id:"historie",     label:"Historie",     icon:"calendar", aktiv:true, fix:false, reihenfolge:7 },
  ],
};

// ── Verwaltungsarten und Kontaktarten ────────────────────────────────────
// Reihenfolge wirkt sich auf die Filter-Button-Reihenfolge aus.
const VERWALTUNGSARTEN = [
  { id: "weg",     label: "WEG",                kurz: "WEG"     },
  { id: "miet",    label: "Mietverwaltung",     kurz: "Miet"    },
  { id: "gewerbe", label: "Gewerbeverwaltung",  kurz: "Gewerbe" },
  { id: "sev",     label: "SEV",                kurz: "SEV"     },
];

// ── Verteilerschlüssel (Umlageschlüssel) ─────────────────────────────────
// Vier Standard-Schlüssel sind vordefiniert; eigene kommen dazu. Persistiert
// wird NUR das Delta in ve.verteilerschluessel (Overrides der Standards, z. B.
// Personen-Anteile, + komplett eigene Schlüssel). effVerteilerschluessel
// merged beim Lesen — gleiches Muster wie das Kategorien-System.
// Basen: mea/flaeche/einheiten = berechnet aus Einheiten-Daten;
//        personen/manuell      = manuelle Anteile je Einheit (anteile-Map).
const DEFAULT_VERTEILERSCHLUESSEL = [
  { id: "mea",       name: "MEA",        basis: "mea",       fix: true },
  { id: "flaeche",   name: "Wohnfläche", basis: "flaeche",   fix: true },
  { id: "einheiten", name: "Einheiten",  basis: "einheiten", fix: true },
  { id: "personen",  name: "Personen",   basis: "personen",  fix: true },
];
const VS_BASEN = [
  { id: "mea",       label: "nach MEA (berechnet)" },
  { id: "flaeche",   label: "nach Wohnfläche (berechnet)" },
  { id: "einheiten", label: "je Einheit gleich (berechnet)" },
  { id: "personen",  label: "Personenzahl (manuell je Einheit)" },
  { id: "manuell",   label: "manuelle Anteile je Einheit" },
];
const vsBasisLabel = (basis) => {
  const b = VS_BASEN.find(x => x.id === basis);
  return b ? b.label : basis;
};
const vsIstManuell = (basis) => basis === "personen" || basis === "manuell";
function effVerteilerschluessel(ve) {
  const over = (ve && Array.isArray(ve.verteilerschluessel)) ? ve.verteilerschluessel : [];
  const std = DEFAULT_VERTEILERSCHLUESSEL.map(d => {
    const o = over.find(x => x && x.id === d.id);
    // basis/fix der Standards sind nicht überschreibbar — nur name/anteile.
    return o ? { ...d, ...o, basis: d.basis, fix: true } : { ...d };
  });
  const eigene = over.filter(x => x && !DEFAULT_VERTEILERSCHLUESSEL.some(d => d.id === x.id));
  return [...std, ...eigene];
}
// Wert eines Schlüssels für eine Einheit (Zahl; 0 wenn leer/unbekannt).
function vsWertVon(schluessel, einheit) {
  const basis = (schluessel && schluessel.basis) || "manuell";
  if (basis === "mea")       return parseFlaeche(einheit && einheit.mea);
  if (basis === "flaeche")   return flaecheVon(einheit);
  if (basis === "einheiten") return 1;
  const ant = (schluessel && schluessel.anteile) || {};
  return parseFlaeche(ant[einheit && einheit.id]);
}
// Kontaktarten: Kategorien (Personen/Firmen) und Rollen-Filter. Die Rollen-
// Filter werden zur Laufzeit aus settings.rollen und settings.firmenRollen
// gebaut, damit sie immer zur Rollen-Verwaltung passen — auch nach
// Umbenennen/Löschen/Hinzufügen.
const KONTAKTARTEN_KATEGORIEN = [
  { id: "person", label: "Personen", kurz: "Personen", typ: "kategorie" },
  { id: "firma",  label: "Firmen",   kurz: "Firmen",   typ: "kategorie" },
];
function buildKontaktarten(personenRollen, firmenRollen) {
  const out = [...KONTAKTARTEN_KATEGORIEN];
  (personenRollen || []).filter(r => r.aktiv !== false).forEach(r => {
    out.push({
      id: "p_" + r.name, label: r.name, kurz: r.name,
      typ: "rolle_person", rollenname: r.name,
    });
  });
  (firmenRollen || []).filter(r => r.aktiv !== false).forEach(r => {
    out.push({
      id: "f_" + r.name, label: r.name, kurz: r.kuerzel || r.name,
      typ: "rolle_firma", rollenname: r.name,
    });
  });
  return out;
}
// Helper: prüft ob ein Kontakt zum Filter-ID passt. `arten` ist die aktuelle
// (dynamisch gebaute) Liste.
function kontaktPasstZuArt(k, artId, arten) {
  if (artId === "alle" || !artId) return true;
  const def = (arten || []).find(a => a.id === artId);
  if (!def) return true;
  if (def.typ === "kategorie") {
    if (def.id === "person") return k.typ !== "firma";
    if (def.id === "firma")  return k.typ === "firma";
    return true;
  }
  if (def.typ === "rolle_person" && k.typ === "firma") return false;
  if (def.typ === "rolle_firma"  && k.typ !== "firma") return false;
  return (k.objektZuweisungen || []).some(z =>
    z.rolle === def.rollenname && (z.status || "aktiv") === "aktiv");
}

// ── Eigene Gruppen (settings.kontaktGruppen / settings.objektGruppen) ───────
// Mitgliedschaft: manuell kuratiert (mitglieder-IDs) oder kriterienbasiert —
// Kontakte über aktive Rollen-Zuweisungen, Objekte über die Verwaltungsart.
// Kriterien-Gruppen halten sich dadurch von selbst aktuell.
function kontaktInGruppe(k, g) {
  if (!k || !g) return false;
  if (g.modus === "kriterien") {
    var rl = (g.kriterien && g.kriterien.rollen) || [];
    return rl.length > 0 && (k.objektZuweisungen || []).some(function(z) {
      return z && rl.indexOf(z.rolle) >= 0 && (z.status || "aktiv") === "aktiv";
    });
  }
  return (g.mitglieder || []).indexOf(k.id) >= 0;
}
// Ort eines Objekts aus der Adresse („Waldstraße 123, 80337 München" → „München").
function objektOrt(ve) {
  var teile = String((ve && ve.adresse) || "").split(",");
  var letzter = (teile[teile.length - 1] || "").trim();
  return splitPlzOrt(letzter).ort || letzter;
}
function objektInGruppe(ve, g) {
  if (!ve || !g) return false;
  if (g.modus === "kriterien") {
    // Dimensionen UND-verknüpft, innerhalb einer Dimension ODER.
    var va = (g.kriterien && g.kriterien.verwaltungsarten) || [];
    var orte = (g.kriterien && g.kriterien.orte) || [];
    if (va.length === 0 && orte.length === 0) return false;
    if (va.length > 0 && va.indexOf(ve.verwaltungsart || "weg") < 0) return false;
    if (orte.length > 0 && orte.indexOf(objektOrt(ve)) < 0) return false;
    return true;
  }
  return (g.mitglieder || []).indexOf(ve.id) >= 0;
}

// ── Feld-Typen für FieldList / AddFieldModal ────────────────────────────────
const FIELD_TYPES = [
  { id:"text",   label:"Text",    icon:"T",  color:"#6366F1" },
  { id:"number", label:"Zahl/m²", icon:"#",  color:"#0EA5C9" },
  { id:"date",   label:"Datum",   icon:"📅", color:"#F59E0B" },
  { id:"bool",   label:"Ja/Nein", icon:"✓",  color:"#10B981" },
  { id:"select", label:"Auswahl", icon:"☰",  color:"#0EA5C9" },
  { id:"kontakt",label:"Kontakt", icon:"👤", color:"#8B5CF6" },
  { id:"kontakte",label:"Kontakte", icon:"👥", color:"#8B5CF6" },
  { id:"objekt", label:"Objekt",  icon:"🏢", color:"#0E7490" },
  { id:"notiz",  label:"Notizen", icon:"📝", color:"#6366F1" },
  { id:"file",   label:"Datei",   icon:"📎", color:"#8B5CF6" },
  { id:"legionellen", label:"Legionellen", icon:"💧", color:"#0EA5C9" },
];

// Feldtypen, die im „Neues Feld anlegen"-Menü zur Auswahl stehen (bewusst
// reduziert): kein bool-Haken (→ Ja/Nein ist ein select), keine Datei. Ja/Nein
// erzeugt ein select mit festen Optionen, Auswahl ein select mit eigenen.
// „Notizen" = großes, IMMER beschreibbares Textfeld (auch im Lese-Modus).
const ANLEGE_FELDTYPEN = [
  { id:"text",    label:"Text",    icon:"T" },
  { id:"number",  label:"Zahl/m²", icon:"#" },
  { id:"date",    label:"Datum",   icon:"📅" },
  { id:"janein",  label:"Ja/Nein", icon:"☰" },
  { id:"select",  label:"Auswahl", icon:"☰" },
  { id:"kontakt", label:"Kontakt", icon:"👤" },
  { id:"kontakte",label:"Kontakte",icon:"👥" },
  { id:"objekt",  label:"Objekt",  icon:"🏢" },
  { id:"notiz",   label:"Notizen", icon:"📝" },
];

const SUGGESTIONS = {
  gebaeude: [
    { name:"Umbaujahr",          type:"number" }, { name:"Dachsanierung",   type:"date"   },
    { name:"Energieklasse",      type:"text"   },
    { name:"Aufzug vorhanden",   type:"bool"   }, { name:"Photovoltaik",    type:"bool"   },
    { name:"Balkonkraftwerk",    type:"bool"   }, { name:"Fassadenzustand", type:"text"   },
    { name:"Kabelanschluss",     type:"bool"   }, { name:"Internet-Anbieter", type:"text" },
    { name:"Glasfaser – Stand",  type:"select",
      optionen: ["Nicht verfügbar", "Ausbau geplant", "FTTC – bis Verteilerkasten", "FTTB – bis ins Gebäude", "FTTH – bis in die Wohnungen"] },
    { name:"Glasfaser – Gemeinschaft möchte", type:"select",
      optionen: ["Kein Interesse", "Interesse, ungeklärt", "FTTB gewünscht", "FTTH gewünscht", "Beschluss gefasst"] },
  ],
  stammdaten: [
    { name:"Grundbuchblatt",     type:"text"   }, { name:"Grundstücksfläche m²", type:"number" },
    { name:"Gemarkung",          type:"text"   }, { name:"Energieausweis bis",   type:"date"   },
  ],
  zugang: [
    { name:"Anzahl Schlüssel",   type:"number" }, { name:"Nächster Schlüsseldienst", type:"date" },
    { name:"Codeschloss",        type:"bool"   }, { name:"Video-Gegensprechanlage",  type:"bool" },
  ],
  einheit: [
    { name:"Messdienst-Nr.",     type:"text"   }, { name:"Zimmer",          type:"number" },
    { name:"Sondernutzungsrecht",type:"text"   }, { name:"Keller",          type:"bool"   },
    { name:"Balkon",             type:"bool"   }, { name:"Stellplatz-Nr.",  type:"text"   },
  ],
  kontakt: [
    { name:"Geburtstag",   type:"date" }, { name:"Hobby",        type:"text" },
    { name:"IBAN",         type:"text" }, { name:"Steuer-Nr.",   type:"text" },
    { name:"Zusätzliche Adresse", type:"address" },
  ],
};


const isStellplatzTyp = (typ) => ["Stellplatz","Garage","Carport","Doppelparker"].includes(typ);
const extractNachname = (n) => { if(!n) return ""; const p=n.trim().split(" "); return p[p.length-1]; };

// ═════════════════════════════════════════════════════════════════════════════
// SCHICHTUNG: EINHEIT → TEIL → BELEGUNG → HAUSHALT   (Umbau-Spec, Variante A)
// ─────────────────────────────────────────────────────────────────────────────
// Konzept (siehe Umbau-Spec):
//   EINHEIT   statisch · Eigentum/Recht  (Grundbuch, MEA, Stimmrecht, EIGENTÜMER)
//             → der Eigentümer hängt weiterhin an der Einheit (einheit.eigentuemer)
//     └ TEIL          physisch · Substanz (Räume, Zähler) — immer MINDESTENS 1.
//                     Im 95-%-Fall genau 1, dann von der UI unsichtbar geführt.
//          └ BELEGUNG          zeitlich · Kapitel im Zeitstrahl (von–bis, lückenlos)
//                              typ: "vermietung" | "selbstnutzung" | "leerstand"
//                              bei vermietung: + mietvertrag {von, kaution, hoehe, ...}
//                              vertragspartei: kontaktId (kann ≠ Bewohner sein)
//               └ HAUSHALT     wer wohnt drin (außer bei leerstand)
//                              mitglieder: [{kontaktId|null, name, vermerk}]  (mit/ohne Kontakt)
//                              anonym: Zahl (z. B. 2 = „+2 Kinder")
//
// Variante A: einheit.teile ist IMMER ein Array mit ≥1 Teil. Kein Sonderpfad
// für „nicht unterteilt". Die UI versteckt die Teil-Ebene, wenn teile.length === 1.
// ─────────────────────────────────────────────────────────────────────────────

const BELEGUNG_TYPEN = ["vermietung", "selbstnutzung", "leerstand"];
const BELEGUNG_LABEL = { vermietung: "Vermietung", selbstnutzung: "Selbstnutzung", leerstand: "Leerstand" };

// Weg 2 (Variante B): Jeder Bewohner trägt eine eigene Rechtsgrundlage. Der
// Belegungstyp wird daraus ABGELEITET (gibt es einen Mieter → vermietet; sonst
// Eigennutzer/Nießbraucher/Wohnberechtigter → bewohnt; niemand → leer).
// kuerzel = Badge, farbe = Akzent, mietvertrag = ob bei dieser Rolle ein
// Mietvertrag-Block sinnvoll ist.
const BEWOHNER_RECHTE = [
  { id: "mieter",          label: "Mieter",          kuerzel: "M",  farbe: "#22C55E", mietvertrag: true  },
  { id: "paechter",        label: "Pächter",         kuerzel: "P",  farbe: "#16A34A", mietvertrag: true  },
  { id: "eigennutzer",     label: "Eigennutzer",     kuerzel: "EN", farbe: "#3B82F6", mietvertrag: false },
  { id: "niessbraucher",   label: "Nießbraucher",    kuerzel: "NB", farbe: "#9333EA", mietvertrag: false },
  { id: "wohnberechtigt",  label: "Wohnberechtigt",  kuerzel: "WB", farbe: "#0891B2", mietvertrag: false },
  { id: "angehoeriger",    label: "Angehöriger",     kuerzel: "AG", farbe: "#64748B", mietvertrag: false },
  { id: "sonstige",        label: "Sonstige",        kuerzel: "S",  farbe: "#64748B", mietvertrag: false },
];
function bewohnerRecht(id) {
  return BEWOHNER_RECHTE.find(r => r.id === id) || BEWOHNER_RECHTE[0];
}
// Hat dieses Recht einen (Miet-/Pacht-)Vertrag und macht den Inhaber zur
// Vertragspartei? Single Source of Truth über das mietvertrag-Flag — damit
// Pächter (und künftige vertragsbasierte Rechte) ÜBERALL wie Mieter behandelt
// werden, ohne jede Stelle einzeln auf id-Strings zu prüfen.
function istVertragspartei(recht) {
  const r = BEWOHNER_RECHTE.find(x => x.id === recht);
  return !!(r && r.mietvertrag);
}

// IDs aus laufendem Counter PLUS Zeitstempel-Suffix — damit neu erzeugte IDs
// nicht mit sequenziellen Bestands-IDs (z. B. importiertes "beleg-1") kollidieren.
// Der Counter sichert Eindeutigkeit innerhalb desselben Millisekunden-Ticks.
let _teilIdCounter = 1, _belegIdCounter = 1, _hhMitgliedIdCounter = 1, _raumIdCounter = 1, _zaehlerIdCounter = 1;
const neueTeilId    = () => "teil-"  + Date.now().toString(36) + "-" + (_teilIdCounter++);
const neueBelegId   = () => "beleg-" + Date.now().toString(36) + "-" + (_belegIdCounter++);
const neueHhmId     = () => "hhm-"   + Date.now().toString(36) + "-" + (_hhMitgliedIdCounter++);
const neueRaumId    = () => "raum-"  + Date.now().toString(36) + "-" + (_raumIdCounter++);
const neueZaehlerId = () => "zlr-"   + Date.now().toString(36) + "-" + (_zaehlerIdCounter++);

// Leerer Haushalt-Container.
function leererHaushalt() {
  return { mitglieder: [] };
}

// Ein Haushaltsmitglied (Bewohner). recht = Rechtsgrundlage (siehe BEWOHNER_RECHTE).
// Default: mieter (häufigster Fall beim manuellen Hinzufügen).
function neuesHhMitglied(kontaktId, name, recht, anzahl) {
  return {
    id: neueHhmId(),
    kontaktId: kontaktId != null ? kontaktId : null,
    name: name || "",
    vermerk: "",
    recht: recht || "mieter",
    anzahl: (typeof anzahl === "number" && anzahl >= 1) ? anzahl : 1,
  };
}

// Ein anonymes Mitglied = Bewohner ohne Kontaktkarte, trägt nur eine Personen-
// Anzahl (z. B. „3" Kinder). Erkennbar an kontaktId === null && !name.
function istAnonymesMitglied(m) {
  return !!m && (m.kontaktId == null) && !(m.name && String(m.name).trim());
}

// Personenzahl eines Mitglieds: benannt = 1, anonym = anzahl (mind. 1).
function mitgliedKopfzahl(m) {
  if (!m) return 0;
  if (istAnonymesMitglied(m)) return Math.max(1, Number(m.anzahl) || 1);
  return 1;
}

// Summe aller Köpfe eines Haushalts (benannte + anonyme nach anzahl).
function haushaltKopfzahl(hh) {
  if (!hh || !Array.isArray(hh.mitglieder)) return 0;
  return hh.mitglieder.reduce((s, m) => s + mitgliedKopfzahl(m), 0);
}

// Eine frische Belegung eines bestimmten Typs (Standard: Leerstand = lückenfüllend).
function neueBelegung(typ, von, bis) {
  const t = BELEGUNG_TYPEN.indexOf(typ) >= 0 ? typ : "leerstand";
  const b = {
    id: neueBelegId(),
    typ: t,
    von: von || "",
    bis: bis || "",
    haushalt: t === "leerstand" ? leererHaushalt() : leererHaushalt(),
  };
  if (t === "vermietung") {
    b.vertragsparteiId = null;          // Kontakt-ID der Vertragspartei (≠ Bewohner möglich)
    b.mietvertrag = { von: von || "", kaution: "", hoehe: "", kuendigung: "" };
  }
  return b;
}

// ── Sondereigentumsverwaltung (SEV) ─────────────────────────────────────────
// Die SEV ist eine (meist Firmen-)Verwaltung, die EINE Einheit im Auftrag des
// Eigentümers betreut. Anders als die WEG-Verwaltung (Objekt-Ebene) hängt sie an
// der Einheit. Modelliert als LISTE einträge an `einheit.sev[]` — analog zu
// `eigentuemer[]` —, damit ein SEV-Wechsel als Chronik (alte endet, neue beginnt)
// abbildbar ist. Jeder Eintrag:
//   { id, kontaktId, name, seit, bis, vollmacht:{ erteilt:bool, datum } }
// Status wird datumsgesteuert abgeleitet (sevStatus), genau wie bei Eigentümern.
// SEV-ID ohne Top-Level-let (vermeidet TDZ/const-Hoisting-Falle, da neueSev
// bereits in buildMockData aufgerufen wird, das früher im Modul steht).
function neueSevId() { return "sev_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2, 8); }
function neueSev(kontaktId, name, seit) {
  return {
    id: neueSevId(),
    kontaktId: kontaktId || null,
    name: name || "",
    seit: seit || "",
    bis: "",
    vollmacht: { erteilt: false, datum: "" },
  };
}
// Status eines SEV-Eintrags: ehemalig (bis erreicht), werdend (seit in Zukunft),
// sonst aktiv. Spiegelt das datumsgesteuerte Muster von eigStatus/Belegung.
function sevStatus(s) {
  if (!s) return "aktiv";
  const heute = isoHeute();
  if (s.bis && s.bis !== "—" && zuIsoDatum(s.bis) <= heute) return "ehemalig";
  if (s.seit && zuIsoDatum(s.seit) > heute) return "werdend";
  return "aktiv";
}
// Läuft an dieser Einheit gerade ein SEV-Wechsel? (mind. ein werdender Eintrag)
function laufenderSevWechsel(sevListe) {
  return (sevListe || []).some(s => sevStatus(s) === "werdend");
}
// SEV-WECHSEL als Vorgang (angelehnt an Belegungswechsel, ohne Zwischenstufen):
// beendet die laufende SEV mit bis=wechselDatum und legt eine neue SEV ab
// demselben Datum an (lückenlos). Gibt die neue sev-Liste zurück.
function starteSevWechsel(sevListe, neuKontaktId, neuName, wechselDatum) {
  const liste = Array.isArray(sevListe) ? sevListe : [];
  const datum = wechselDatum || "";
  const beendet = liste.map(s =>
    sevStatus(s) === "aktiv" ? { ...s, bis: datum || s.bis } : s);
  const neu = neueSev(neuKontaktId, neuName, datum);
  return [...beendet, neu];
}
// SEV-Wechsel abbrechen: entfernt werdende Einträge und macht das bis der zuvor
// beendeten aktiven SEV wieder rückgängig (sofern es == wechselDatum war).
function brecheSevWechselAb(sevListe) {
  const liste = Array.isArray(sevListe) ? sevListe : [];
  const werdendDaten = liste.filter(s => sevStatus(s) === "werdend").map(s => s.seit);
  const ohneWerdend = liste.filter(s => sevStatus(s) !== "werdend");
  return ohneWerdend.map(s =>
    (s.bis && werdendDaten.indexOf(s.bis) >= 0) ? { ...s, bis: "" } : s);
}
// Migration: ergänzt fehlendes sev-Feld an Bestandseinheiten. Idempotent.
function ergaenzeSevFeld(einheit) {
  if (!einheit || typeof einheit !== "object") return einheit;
  if (Array.isArray(einheit.sev)) return einheit;
  return { ...einheit, sev: [] };
}

// Ein frischer Teil mit genau einer (leerstehenden) Default-Belegung.
// Physische Stammdaten (Fläche, Zimmer, Lage, Räume, Zähler) hängen am Teil,
// nicht an der Einheit — eine Grundbuch-VE kann physisch in mehrere Wohnungen
// unterteilt sein. Auf Einheit-Ebene bleiben Eigentümer, MEA, Verwaltungsnr.
function neuerTeil(name) {
  return {
    id: neueTeilId(),
    name: name || "",                   // bei genau 1 Teil unsichtbar; bei Unterteilung „Wohnung A" etc.
    flaeche: "",                        // m² dieses Teils
    zimmer: "",                         // Zimmeranzahl dieses Teils
    lage: "",                           // z. B. „VH EG links" / „HH OG"
    raeume: [],                         // SE-Räume dieses Teils (neuerRaum)
    zaehler: [],                        // LEGACY: Zähler wandern an den Raum (raum.zaehler). Bleibt für Übergang.
    belegungen: [ neueBelegung("leerstand") ],
  };
}

// Gemeinsames Raum-Schema — IDENTISCH für Gemeinschaftsräume (an der Gebäude-Karte)
// und Sondereigentums-Räume (am Teil). Nur die kontextabhängigen Felder werden je
// nach Aufhängung in der UI ein-/ausgeblendet:
//   • Gemeinschaft: snrAn (Sondernutzungsrecht an Eigentümer/Einheit), art
//   • Sondereigentum: abrechnungsrelevant
// Geräte (zaehler/technik) sind überall gleich → eine Zähler-Komponente für beide.
function neuerRaum(name, lage) {
  return {
    id: neueRaumId(),
    name: name || "",
    icon: "",                           // optionales Symbol (KARTEN_ICONS); leer = Default-Tür
    lage: lage || "",                   // Etage / Lagebeschreibung
    flaeche: "",                        // optionale Raumfläche
    art: "",                            // Gemeinschaft: Technikraum/Keller/Außenanlage … (kontextabhängig)
    notizen: "",                        // freie Notizen zum Raum
    snrAn: null,                        // Gemeinschaft: Sondernutzungsrecht an {kontaktId|einheitId} (kontextabhängig)
    abrechnungsrelevant: true,          // Sondereigentum: zählt zur Abrechnungsfläche (kontextabhängig)
    zaehler: [],                        // Zähler & Heizkostenverteiler dieses Raums (neuerZaehler)
    technik: [],                        // sonstige technische Anlagen (frei)
  };
}

// Vorschläge für „Art / Nutzung" eines Raums (Dropdown mit Freitext „Andere…").
const RAUM_ART_OPTIONEN = [
  "Technikraum", "Heizungsraum", "Keller", "Kellerraum", "Hausflur", "Treppenhaus",
  "Waschküche", "Trockenraum", "Fahrradraum", "Müllraum", "Dachboden", "Speicher",
  "Außenanlage", "Garten", "Hof", "Abstellraum", "Lagerraum",
];

// Zähler-/HKV-Arten zur Auswahl. kuerzel für kompakte Anzeige, label fürs Dropdown.
const ZAEHLER_ARTEN = [
  { id: "kaltwasser", kuerzel: "KW",  label: "Kaltwasser" },
  { id: "warmwasser", kuerzel: "WW",  label: "Warmwasser" },
  { id: "strom",      kuerzel: "Str", label: "Strom" },
  { id: "gas",        kuerzel: "Gas", label: "Gas" },
  { id: "waerme",     kuerzel: "WMZ", label: "Wärmemenge" },
  { id: "hkv",        kuerzel: "HKV", label: "Heizkostenverteiler" },
];
function zaehlerArtLabel(id) {
  const a = ZAEHLER_ARTEN.find(x => x.id === id);
  return a ? a.label : (id || "Zähler");
}

// Schema für einen Zähler bzw. Heizkostenverteiler. Hängt an einem Raum.
// art unterscheidet die Geräteklasse; HKV trägt zusätzlich bewertungsfaktor.
function neuerZaehler(art) {
  return {
    id: neueZaehlerId(),
    art: art || "",                     // "kaltwasser"|"warmwasser"|"strom"|"gas"|"waerme"|"hkv" …
    nummer: "",                         // Zähler-/Gerätenummer
    standort: "",                       // Feinverortung im Raum (z. B. „Heizkörper Wohnzimmer Süd")
    staende: [],                        // Ablesungen: [{ datum, wert }]
    eichDatum: "",                      // letzte Eichung / Eichfrist-Beginn
    bewertungsfaktor: "",               // nur HKV: Bewertungs-/Bewertungsfaktor des Heizkörpers
  };
}

// Stellt sicher, dass eine Einheit das neue Schichtmodell besitzt. Idempotent,
// mutationsfrei genutzt (gibt teile-Array zurück, das ggf. neu erzeugt wurde).
function teileVon(einheit) {
  if (einheit && Array.isArray(einheit.teile) && einheit.teile.length > 0) return einheit.teile;
  return [ neuerTeil() ];
}

// Der „aktive" (erste) Teil — im Normalfall der einzige.
function aktiverTeil(einheit) {
  const teile = teileVon(einheit);
  return teile[0];
}

// Parst einen Flächen-Wert (z. B. "97", "97 m²", "60,5") zu einer Zahl. Gibt 0
// zurück, wenn nichts Sinnvolles enthalten ist.
function parseFlaeche(v) {
  if (v == null) return 0;
  const m = String(v).replace(",", ".").match(/-?\d+(\.\d+)?/);
  return m ? parseFloat(m[0]) : 0;
}

// Gesamtfläche einer Einheit. Bei Unterteilung = Summe der Teil-Flächen.
// Legacy-Fallback: flache einheit.flaeche, solange noch kein Teil eine Fläche hat.
function flaecheVon(einheit) {
  const teile = teileVon(einheit);
  const summe = teile.reduce((acc, teil) => acc + parseFlaeche(teil && teil.flaeche), 0);
  if (summe > 0) return summe;
  return parseFlaeche(einheit && einheit.flaeche);
}

// Summe der Raumflächen eines Teils (alle Räume mit flaeche > 0). Dient als
// weicher Vorschlag für die Teilfläche — nie als harte Überschreibung.
// (Optional später: nur abrechnungsrelevante Räume zählen.)
function summeRaumFlaechen(raeume) {
  if (!Array.isArray(raeume)) return 0;
  return raeume.reduce((acc, r) => acc + parseFlaeche(r && r.flaeche), 0);
}

// Die aktuell laufende Belegung eines Teils = jene ohne Enddatum (bis leer),
// sonst die zuletzt beginnende. Gibt null zurück, wenn keine existiert.
function aktiveBelegung(teil) {
  if (!teil || !Array.isArray(teil.belegungen) || teil.belegungen.length === 0) return null;
  const heute = isoHeute();
  // Noch zukünftige geplante (werdende) Belegungen zählen nicht als aktiv;
  // terminierte, deren Übergangsdatum erreicht ist, dagegen schon.
  const echte = teil.belegungen.filter(b => !(b.geplant && (!b.von || zuIsoDatum(b.von) > heute)));
  if (echte.length === 0) return null;
  const laufend = echte.filter(b => !b.bis);
  if (laufend.length > 0) {
    // jüngster Beginn gewinnt, falls mehrere offen sind (ISO-normalisiert)
    return laufend.slice().sort((a, b) => zuIsoDatum(b.von).localeCompare(zuIsoDatum(a.von)))[0];
  }
  return echte.slice().sort((a, b) => zuIsoDatum(b.von).localeCompare(zuIsoDatum(a.von)))[0];
}

// Die aktuell laufende Belegung der Einheit (über den aktiven Teil).
function aktiveBelegungVon(einheit) {
  return aktiveBelegung(aktiverTeil(einheit));
}

// Phase einer Belegung bezogen auf heute (ISO-normalisiert):
//   · "beendet"  — bis liegt heute oder früher
//   · "geplant"  — von liegt in der Zukunft (beginnt erst später)
//   · "aktuell"  — läuft jetzt (von ≤ heute, kein bis oder bis > heute)
function belegungsPhase(b, heuteIso) {
  if (!b) return "aktuell";
  const heute = heuteIso || isoHeute();
  const von = zuIsoDatum(b.von);
  const bis = zuIsoDatum(b.bis);
  // Geplante (werdende) Belegung aus einem laufenden Wechsel-Vorgang: solange
  // kein Übergangsdatum gesetzt ist ODER es noch in der Zukunft liegt → geplant.
  // Ist das Datum erreicht/überschritten, gilt die normale Datumslogik (aktiv).
  if (b.geplant && (!von || von > heute)) return "geplant";
  if (bis && bis <= heute) return "beendet";
  if (von && von > heute) return "geplant";
  return "aktuell";
}

// Die HEUTE laufende Belegung eines Teils (Phase "aktuell"). Anders als
// aktiveBelegung (nimmt das offene/jüngste Kapitel) berücksichtigt dies das
// Datum: eine erst künftig beginnende Belegung ist NICHT die heute laufende.
// Fällt auf aktiveBelegung zurück, wenn heute keine Phase "aktuell" hat.
function heuteLaufendeBelegung(teil) {
  if (!teil || !Array.isArray(teil.belegungen) || teil.belegungen.length === 0) return null;
  const heute = isoHeute();
  const laufendHeute = teil.belegungen.filter(b => belegungsPhase(b, heute) === "aktuell");
  if (laufendHeute.length > 0) {
    return laufendHeute.slice().sort((a, b) => zuIsoDatum(b.von).localeCompare(zuIsoDatum(a.von)))[0];
  }
  // Nichts läuft heute (echter Leerstand zwischen Kapiteln, oder alles beendet).
  // KEIN Fallback auf eine beendete Belegung — sonst gilt ein längst ausgezogener
  // Bewohner fälschlich als aktiv. Eine ggf. existierende offene (nie beendete)
  // Belegung wird über aktiveBelegung dennoch gefunden.
  const akt = aktiveBelegung(teil);
  if (akt && (!akt.bis || zuIsoDatum(akt.bis) > heute)) return akt;
  return null;
}

// Der aktuelle Haushalt der Einheit (über aktive Belegung). Leerstand → leerer HH.
function aktiverHaushalt(einheit) {
  const b = aktiveBelegungVon(einheit);
  if (!b) return leererHaushalt();
  return b.haushalt || leererHaushalt();
}

// Belegungstyp der Einheit aktuell ("vermietung"|"selbstnutzung"|"leerstand"|null).
// Weg 2: aus den Rechtsgrundlagen der Bewohner ABGELEITET. Gibt es einen Mieter →
// "vermietung"; sonst Bewohner vorhanden → "selbstnutzung" (Eigennutzung im weiteren
// Sinn, inkl. Nießbrauch/Wohnrecht); niemand → "leerstand". Fällt auf das alte
// beleg.typ-Feld zurück, falls (noch) keine Bewohner mit recht existieren.
function abgeleiteterBelegungstyp(beleg) {
  if (!beleg) return null;
  const hh = beleg.haushalt || { mitglieder: [] };
  const mit = (hh.mitglieder || []).filter(Boolean);
  if (mit.length > 0) {
    if (mit.some(m => istVertragspartei(m.recht))) return "vermietung";
    return "selbstnutzung";
  }
  // keine Bewohner: Legacy-typ respektieren, sonst Leerstand
  return beleg.typ || "leerstand";
}

function belegungsTyp(einheit) {
  const b = aktiveBelegungVon(einheit);
  return b ? abgeleiteterBelegungstyp(b) : null;
}

// ── Belegungsabgeleitete Verwendungen ───────────────────────────────────────
// Diese drei Verwendungen sind KEINE frei wählbaren Etiketten mehr, sondern
// folgen automatisch aus der Belegung (Quelle der Wahrheit ist der Belegung-Tab).
// Sie werden in den Stammdaten nur ANGEZEIGT, nicht editiert.
const BELEGUNG_VERWENDUNGEN = ["Vermietet", "Eigennutzung", "Leerstand"];
const BELEGUNGSTYP_ZU_VERWENDUNG = {
  vermietung: "Vermietet",
  selbstnutzung: "Eigennutzung",
  leerstand: "Leerstand",
};
// Leitet die Belegungs-Verwendung(en) einer Einheit aus den Belegungen ihrer
// Teile ab. Bei Unterteilung können mehrere Typen gleichzeitig vorkommen (z. B.
// ein Teil vermietet, einer leer). Liefert eine Liste { name, status:"aktiv" }.
// Leerstand wird nur gemeldet, wenn KEIN Teil belegt ist (sonst wäre die ganze
// Einheit fälschlich „auch leer").
function belegungsVerwendungen(einheit) {
  const teile = teileVon(einheit);
  const typen = new Set();
  teile.forEach(teil => {
    const b = heuteLaufendeBelegung(teil) || aktiveBelegung(teil);
    const typ = b ? abgeleiteterBelegungstyp(b) : "leerstand";
    typen.add(typ);
  });
  // Wenn irgendein Teil belegt ist, zählt Leerstand nicht für die Gesamt-Einheit.
  if (typen.size > 1) typen.delete("leerstand");
  const namen = [];
  typen.forEach(typ => {
    const name = BELEGUNGSTYP_ZU_VERWENDUNG[typ];
    if (name && namen.indexOf(name) < 0) namen.push(name);
  });
  return namen.map(name => ({ name, status: "aktiv" }));
}

// ── Kontakt-Rollen-Ableitung (zentral) ──────────────────────────────────────
// Quelle der Wahrheit sind die EINHEITEN (Eigentümer/SEV an der Einheit, Mieter/
// Bewohner im Belegungsmodell). Die kontakt.objektZuweisungen sind nur ein
// abgeleiteter Index für Kontakt-Profil/Filter. Diese Funktion leitet für EIN
// Objekt alle einheit-bezogenen Zuweisungen neu ab und liefert eine Map
// kontaktId → [{ objektId, einheitId, rolle, status }]. Phasen → Status:
// aktuell→aktiv, geplant→werdend, beendet→ehemalig.
function belegPhaseZuStatus(phase) {
  if (phase === "geplant") return "werdend";
  if (phase === "beendet") return "ehemalig";
  return "aktiv";
}
function objektZuweisungenAusEinheiten(ve) {
  const map = {}; // kontaktId → Array von Zuweisungen
  if (!ve || !Array.isArray(ve.einheiten)) return map;
  const heute = isoHeute();
  const add = (kontaktId, einheitId, rolle, status) => {
    if (kontaktId == null) return;
    const key = String(kontaktId);
    if (!map[key]) map[key] = [];
    // Duplikate (gleiche einheitId+rolle) vermeiden; besten Status behalten.
    const PRIO = { aktiv: 3, werdend: 2, ehemalig: 1 };
    const vorhanden = map[key].find(z => z.einheitId === einheitId && z.rolle === rolle);
    if (vorhanden) {
      if ((PRIO[status] || 0) > (PRIO[vorhanden.status] || 0)) vorhanden.status = status;
      return;
    }
    map[key].push({ objektId: ve.id, einheitId, rolle, status });
  };
  ve.einheiten.forEach(einheit => {
    if (!einheit) return;
    // Eigentümer (inkl. werdend/ehemalig via eigStatus).
    (einheit.eigentuemer || []).forEach(e => {
      if (!e || e.kontaktId == null) return;
      add(e.kontaktId, einheit.id, "Eigentümer", eigStatus(e));
    });
    // SEV (inkl. werdend/ehemalig via sevStatus).
    (einheit.sev || []).forEach(s => {
      if (!s || s.kontaktId == null) return;
      add(s.kontaktId, einheit.id, "Sondereigentumsverwaltung", sevStatus(s));
    });
    // Mieter/Bewohner über alle Teile + Belegungen + Haushalt. recht==="mieter"
    // → „Mieter", sonst Sammelrolle „Bewohner" (das genaue Recht steht am
    // Mitglied/Belegung-Tab). Status aus belegungsPhase.
    teileVon(einheit).forEach(teil => {
      (teil.belegungen || []).forEach(b => {
        const status = belegPhaseZuStatus(belegungsPhase(b, heute));
        const hh = b.haushalt || { mitglieder: [] };
        (hh.mitglieder || []).forEach(m => {
          if (!m || m.kontaktId == null) return;
          const rolle = istVertragspartei(m.recht) ? bewohnerRecht(m.recht).label : "Bewohner";
          add(m.kontaktId, einheit.id, rolle, status);
        });
      });
    });
  });
  return map;
}

// Wendet die abgeleiteten Zuweisungen auf die Kontaktliste an: ersetzt für DIESES
// Objekt alle einheit-bezogenen Zuweisungen (mit einheitId) durch die neu
// abgeleiteten. Objekt-/Firmen-Rollen ohne einheitId (HV, Beirat, Versorger …)
// und alle anderen Objekte bleiben unangetastet. Konsolidiert kontakt.rollen[].
function wendeKontaktZuweisungenAn(kontakte, ve) {
  if (!Array.isArray(kontakte) || !ve) return kontakte;
  const abgeleitet = objektZuweisungenAusEinheiten(ve);
  return kontakte.map(k => {
    if (!k) return k;
    const bisher = Array.isArray(k.objektZuweisungen) ? k.objektZuweisungen : [];
    // Behalte: alles für ANDERE Objekte + Zuweisungen OHNE einheitId (objekt-/
    // firmenbezogen) für DIESES Objekt.
    const behalten = bisher.filter(z =>
      z.objektId !== ve.id || z.einheitId == null);
    const neueFuerObjekt = abgeleitet[String(k.id)] || [];
    const neueZuw = behalten.concat(neueFuerObjekt);
    // rollen[] neu konsolidieren. Einheit-abgeleitete Rollennamen werden komplett
    // aus den Zuweisungen neu bestimmt (über ALLE Objekte, da rollen[] global ist);
    // andere Rollen (HV, Beirat, Versorger …) bleiben erhalten.
    const EINHEIT_ROLLEN = { "Eigentümer": 1, "Mieter": 1, "Bewohner": 1, "Sondereigentumsverwaltung": 1 };
    const rollenSet = {};
    // (a) Nicht-einheit-Rollen aus bisherigem rollen[] behalten.
    (Array.isArray(k.rollen) ? k.rollen : []).forEach(r => { if (!EINHEIT_ROLLEN[r]) rollenSet[r] = true; });
    // (b) Einheit-Rollen aus ALLEN aktuellen Zuweisungen (alle Objekte) ableiten.
    neueZuw.forEach(z => { if (z.rolle && z.einheitId != null) rollenSet[z.rolle] = true; });
    // (c) Objekt-/Firmen-Rollen aus Zuweisungen ohne einheitId behalten.
    neueZuw.forEach(z => { if (z.rolle && z.einheitId == null) rollenSet[z.rolle] = true; });
    return { ...k, objektZuweisungen: neueZuw, rollen: Object.keys(rollenSet) };
  });
}

// Wendet die Rollen-Ableitung über ALLE Objekte an. Aufruf beim Import, damit
// Eigentümer/SEV/Mieter/Bewohner sofort in objektZuweisungen + rollen[] stehen,
// OHNE dass die Importdatei diese Felder vorberechnen muss (schlankes Modell:
// besitz + Belegungen reichen). Idempotent: jeder Objekt-Durchlauf ersetzt nur
// die einheit-bezogenen Zuweisungen FÜR DIESES Objekt und lässt die anderen
// Objekte unangetastet — sequentielles Anwenden baut das Gesamtbild korrekt auf.
function wendeKontaktZuweisungenAnAlle(kontakte, ves) {
  if (!Array.isArray(kontakte) || !Array.isArray(ves)) return kontakte;
  return ves.reduce((acc, ve) => wendeKontaktZuweisungenAn(acc, ve), kontakte);
}

// Läuft aktuell eine Vermietung? (steuert Sichtbarkeit der Mietgeschichte)
function istVermietet(einheit) {
  return belegungsTyp(einheit) === "vermietung";
}

// Benannte Haushaltsmitglieder MIT Kontakt — diese sind informierbar.
function bewohnerMitKontakt(einheit) {
  const hh = aktiverHaushalt(einheit);
  return (hh.mitglieder || []).filter(m => m && m.kontaktId != null);
}


// Verwendungen einer Einheit als LISTE [{name, status}], rückwärtskompatibel:
// liest das neue Feld einheit.verwendungen ODER das Legacy-Einzelfeld
// einheit.verwendung. So kann eine Einheit mehrere Verwendungen tragen
// (z. B. „Vermietet" + „Sondereigentumsverwaltung").
//
// WICHTIG: Die drei Belegungs-Verwendungen (Vermietet/Eigennutzung/Leerstand)
// werden NICHT mehr aus dem gespeicherten Feld gelesen, sondern LIVE aus der
// Belegung abgeleitet (Quelle der Wahrheit = Belegung-Tab). Gespeicherte
// Belegungs-Verwendungen (Altbestand) werden ignoriert und durch die abgeleiteten
// ersetzt. So bleiben Einheit-Anzeige, Avatar-Badge und Objekt-Aggregat
// automatisch konsistent, ohne dass etwas doppelt gepflegt wird.
function verwendungenVon(einheit) {
  if (!einheit) return [];
  let gespeichert = [];
  if (Array.isArray(einheit.verwendungen)) gespeichert = einheit.verwendungen.filter(Boolean);
  else if (einheit.verwendung && einheit.verwendung.name) gespeichert = [einheit.verwendung];
  // Freie (rechtliche) Verwendungen behalten; Belegungs-Verwendungen verwerfen.
  const frei = gespeichert.filter(v => v && BELEGUNG_VERWENDUNGEN.indexOf(v.name) < 0);
  // Belegungs-Verwendungen live ableiten.
  const abgeleitet = belegungsVerwendungen(einheit);
  return [...abgeleitet, ...frei];
}

// ─────────────────────────────────────────────────────────────────────────────
// NORMALISIERUNG — hebt eine Einheit idempotent auf das Schichtmodell.
// Wendet Variante A an: jede Einheit bekommt mindestens einen Teil mit genau
// einer laufenden Belegung. Vorhandene Legacy-Felder (mieter[], selbstnutzer,
// verwendung) werden in eine passende Belegung + Haushalt überführt, OHNE die
// Legacy-Felder zu löschen (sanfte, rückwärtskompatible Anreicherung).
// Eigentümer bleibt an der Einheit und wird NICHT in den Haushalt verschoben;
// ein selbstnutzender Eigentümer wird zusätzlich als Haushaltsmitglied gespiegelt.
// Migriert das alte rechtsstatus-Feld (SE/GE/SNR) auf das neue spStellung-Schema.
// Sichere Variante: alle Alt-Stellplätze → "eigenstaendig" (kein verwaister
// spEinheitId-Verweis). Zuordnung wird bei Bedarf manuell nachgepflegt.
// Idempotent: Einheiten mit gesetztem spStellung bleiben unverändert; das alte
// rechtsstatus-Feld wird nach der Migration entfernt.
function migriereSpStellung(einheit) {
  if (!einheit || typeof einheit !== "object") return einheit;
  if (einheit.spStellung) {
    if ("rechtsstatus" in einheit) {
      const kopie = { ...einheit };
      delete kopie.rechtsstatus;
      return kopie;
    }
    return einheit;
  }
  if (!("rechtsstatus" in einheit)) return einheit;
  const kopie = { ...einheit, spStellung: "eigenstaendig" };
  delete kopie.rechtsstatus;
  return kopie;
}

// Heilt verwaiste SEV-Verwendungen: Die Verwendung „Sondereigentumsverwaltung"
// darf nur existieren, wenn auch ein aktiver/werdender sev-Eintrag vorhanden ist.
// Altbestände/Seeds, die nur das Badge ohne sev-Firma trugen, werden bereinigt.
// Idempotent.
function heileSevVerwendung(einheit) {
  if (!einheit || typeof einheit !== "object") return einheit;
  const SEV = "Sondereigentumsverwaltung";
  const hatSev = Array.isArray(einheit.sev)
    && einheit.sev.some(s => { const st = sevStatus(s); return st === "aktiv" || st === "werdend"; });
  if (hatSev) return einheit;
  const liste = Array.isArray(einheit.verwendungen) ? einheit.verwendungen : null;
  const einzel = (einheit.verwendung && einheit.verwendung.name === SEV);
  const inListe = liste && liste.some(v => v && v.name === SEV);
  if (!einzel && !inListe) return einheit;
  const kopie = { ...einheit };
  if (liste) kopie.verwendungen = liste.filter(v => !(v && v.name === SEV));
  if (einzel) {
    kopie.verwendung = (kopie.verwendungen && kopie.verwendungen.length > 0)
      ? kopie.verwendungen[0] : null;
  }
  return kopie;
}

function normalisiereEinheit(einheit) {
  if (!einheit || typeof einheit !== "object") return einheit;
  einheit = migriereSpStellung(einheit);
  einheit = ergaenzeSevFeld(einheit);
  einheit = heileSevVerwendung(einheit);
  // Bereits normalisiert? (besitzt einen Teil mit Belegungen) → unverändert lassen.
  if (Array.isArray(einheit.teile) && einheit.teile.length > 0
      && einheit.teile[0] && Array.isArray(einheit.teile[0].belegungen)
      && einheit.teile[0].belegungen.length > 0) {
    return einheit;
  }

  const legacyMieter = Array.isArray(einheit.mieter) ? einheit.mieter : [];
  const aktiverEig = (Array.isArray(einheit.eigentuemer) ? einheit.eigentuemer : []).find(e => !e.bis) || null;
  const selbstnutzer = !!(aktiverEig && aktiverEig.selbstnutzer);
  const aktiverMieterLegacy = legacyMieter.find(m => !m.bis) || null;

  // Belegungstyp aus Legacy ableiten.
  let typ = "leerstand";
  if (aktiverMieterLegacy) typ = "vermietung";
  else if (selbstnutzer)   typ = "selbstnutzung";

  const beleg = neueBelegung(typ, (aktiverMieterLegacy && aktiverMieterLegacy.von) || (aktiverEig && aktiverEig.von) || "");

  // Haushalt füllen.
  if (typ === "vermietung" && aktiverMieterLegacy) {
    beleg.vertragsparteiId = aktiverMieterLegacy.kontaktId != null ? aktiverMieterLegacy.kontaktId : null;
    beleg.haushalt.mitglieder.push(neuesHhMitglied(
      aktiverMieterLegacy.kontaktId, aktiverMieterLegacy.name || "", "mieter"));
  } else if (typ === "selbstnutzung" && aktiverEig) {
    beleg.haushalt.mitglieder.push(neuesHhMitglied(
      aktiverEig.kontaktId, aktiverEig.name || "", "eigennutzer"));
  }

  // Teil über die Fabrik erzeugen (volle Felder: flaeche/zimmer/lage/raeume …),
  // dann die abgeleitete Belegung einsetzen.
  const teil = { ...neuerTeil(""), belegungen: [ beleg ] };
  // Rückgabe als neues Objekt (mutationsfrei für React-State).
  return { ...einheit, teile: [ teil ] };
}

// Hebt bereits normalisierte Einheiten zusätzlich auf Weg 2: vorhandene
// Haushaltsmitglieder ohne recht bekommen eines abgeleitet (aus beleg.typ).
// Idempotent — Mitglieder mit recht bleiben unangetastet.
function ergaenzeBewohnerRechte(einheit) {
  if (!einheit || !Array.isArray(einheit.teile)) return einheit;
  let geaendert = false;
  const teile = einheit.teile.map(teil => {
    if (!teil || !Array.isArray(teil.belegungen)) return teil;
    const belegungen = teil.belegungen.map(b => {
      if (!b || !b.haushalt) return b;
      const hh = b.haushalt;
      const standard = b.typ === "vermietung" ? "mieter"
        : (b.typ === "selbstnutzung" ? "eigennutzer" : "mieter");
      let mitglieder = Array.isArray(hh.mitglieder) ? hh.mitglieder : [];
      let lokalGeaendert = false;

      // (a) Fehlende Rechtsgrundlage ergänzen.
      if (!mitglieder.every(m => m && m.recht)) {
        mitglieder = mitglieder.map(m => (m && m.recht) ? m : { ...m, recht: standard });
        lokalGeaendert = true;
      }
      // (b) Fehlende anzahl ergänzen (Default 1).
      if (!mitglieder.every(m => m && typeof m.anzahl === "number")) {
        mitglieder = mitglieder.map(m =>
          (m && typeof m.anzahl === "number") ? m : { ...m, anzahl: 1 });
        lokalGeaendert = true;
      }
      // (c) Alte anonym-Kopfzahl → ein anonymes Mitglied mit anzahl.
      const altAnonym = Number(hh.anonym) || 0;
      if (altAnonym > 0) {
        mitglieder = [...mitglieder, neuesHhMitglied(null, "", standard, altAnonym)];
        lokalGeaendert = true;
      }

      if (!lokalGeaendert && !("anonym" in hh)) return b;
      geaendert = true;
      const neuHh = { ...hh, mitglieder };
      delete neuHh.anonym; // Feld endgültig entfernen
      return { ...b, haushalt: neuHh };
    });
    return { ...teil, belegungen };
  });
  return geaendert ? { ...einheit, teile } : einheit;
}

// Normalisiert eine komplette VE-Liste (alle Einheiten aller Objekte).
function normalisiereVes(ves) {
  if (!Array.isArray(ves)) return ves;
  return ves.map(ve => {
    if (!ve || !Array.isArray(ve.einheiten)) return ve;
    return { ...ve, einheiten: ve.einheiten.map(e =>
      ergaenzeBewohnerRechte(normalisiereEinheit(e))) };
  });
}

// ═════════════════════════════════════════════════════════════════════════════
// BEZIEHUNG & BEFUGNIS  (Umbau-Spec §4 · zwei unabhängige Achsen, Variante I)
// ─────────────────────────────────────────────────────────────────────────────
// Statt „Bevollmächtigter/Betreuer" als Rolle gibt es zwei eigenständige,
// unabhängig pflegbare Achsen an EINER Verknüpfung zwischen zwei Kontakten:
//
//   verknuepfung = {
//     id, zielKontaktId,                 ← auf wen zeigt die Verknüpfung
//     beziehung: { typ } | null,         ← sozial/faktisch ("Ehefrau", "Steuerberater")
//     befugnis:  { art } | null,         ← rechtlich ("vollmacht" | "betreuung")
//     status: "aktiv" | "ehemalig",
//   }
//
// Beide Achsen sind optional und einzeln schaltbar: Ehefrau MIT Vollmacht = eine
// Verknüpfung mit beiden gesetzt; endet die Vollmacht, bleibt die Beziehung
// (befugnis=null, beziehung bleibt). Berufsbetreuer = nur befugnis, keine beziehung.
//
// Die Achsen liegen am VERKNÜPFENDEN Kontakt (z. B. an der Ehefrau, die zum
// Eigentümer „verheiratet" ist und für ihn „Vollmacht" hat) — also die Person,
// die die Beziehung/Befugnis AUSÜBT. zielKontaktId = die Person, auf die sie
// sich bezieht. Avatar-Badge schaut auf die BEFUGNIS (nicht mehr auf Rollennamen).
// ─────────────────────────────────────────────────────────────────────────────

const BEFUGNIS_ARTEN = ["vollmacht", "betreuung"];


let _verknId = 1;
const neueVerknId = () => "vk-" + (_verknId++);

function neueVerknuepfung(zielKontaktId, opts) {
  const o = opts || {};
  return {
    id: neueVerknId(),
    zielKontaktId: zielKontaktId != null ? zielKontaktId : null,
    beziehung: o.beziehungTyp ? { typ: o.beziehungTyp } : null,
    befugnis:  o.befugnisArt && BEFUGNIS_ARTEN.indexOf(o.befugnisArt) >= 0 ? { art: o.befugnisArt } : null,
    status: o.status || "aktiv",
  };
}

// Alle Verknüpfungen eines Kontakts (ausgehend) — neues Feld, sonst [].
function verknuepfungenVon(k) {
  return (k && Array.isArray(k.verknuepfungen)) ? k.verknuepfungen : [];
}

// Ausgehende BEFUGNISSE eines Kontakts: „für wen darf dieser Kontakt entscheiden".
// Liest die neue Achse UND (Legacy-Fallback) die alten zielKontaktId-Zuständig-
// keiten mit Rolle Bevollmächtigter/Betreuer. Rückgabe: [{ zielKontaktId, art, status }].
function ausgehendeBefugnisse(k) {
  const out = [];
  const gesehen = new Set();
  const push = (zielKontaktId, art, status) => {
    const key = String(zielKontaktId) + "|" + art;
    if (gesehen.has(key)) return;
    gesehen.add(key);
    out.push({ zielKontaktId, art, status: status || "aktiv" });
  };
  verknuepfungenVon(k).forEach(v => {
    if (v && v.befugnis && v.befugnis.art) push(v.zielKontaktId, v.befugnis.art, v.status);
  });
  // Legacy: zustaendigkeiten mit ziel.art="kontakt" + Rolle Bevollmächtigter/Betreuer
  (k && Array.isArray(k.zustaendigkeiten) ? k.zustaendigkeiten : []).forEach(z => {
    const ziel = z.ziel || {};
    if (ziel.art === "kontakt" && ziel.kontaktId != null) {
      const r = z.leistung || "";
      const art = r === "Betreuer" ? "betreuung" : (r === "Bevollmächtigter" ? "vollmacht" : null);
      if (art) push(ziel.kontaktId, art, z.status);
    }
  });
  return out;
}




// Idempotente Normalisierung eines Kontakts: spiegelt Legacy-Befugnis-
// Zuständigkeiten in die neue verknuepfungen-Achse, OHNE die Legacy-Felder zu
// löschen (rückwärtskompatibel). Mehrfach-Aufruf erzeugt keine Duplikate.
function normalisiereKontakt(k) {
  if (!k || typeof k !== "object") return k;
  const vorhanden = verknuepfungenVon(k);
  // Bereits vorhandene (ziel+art)-Paare merken, um Duplikate zu vermeiden.
  const gesehen = new Set(vorhanden
    .filter(v => v && v.befugnis && v.befugnis.art)
    .map(v => String(v.zielKontaktId) + "|" + v.befugnis.art));
  const ausLegacy = [];
  (Array.isArray(k.zustaendigkeiten) ? k.zustaendigkeiten : []).forEach(z => {
    const ziel = z.ziel || {};
    if (ziel.art === "kontakt" && ziel.kontaktId != null) {
      const r = z.leistung || "";
      const art = r === "Betreuer" ? "betreuung" : (r === "Bevollmächtigter" ? "vollmacht" : null);
      if (art) {
        const key = String(ziel.kontaktId) + "|" + art;
        if (!gesehen.has(key)) {
          gesehen.add(key);
          ausLegacy.push(neueVerknuepfung(ziel.kontaktId, { befugnisArt: art, status: z.status || "aktiv" }));
        }
      }
    }
  });
  if (ausLegacy.length === 0 && Array.isArray(k.verknuepfungen)) return k;
  return { ...k, verknuepfungen: [...vorhanden, ...ausLegacy] };
}

function normalisiereKontakte(kontakte) {
  if (!Array.isArray(kontakte)) return kontakte;
  return kontakte.map(normalisiereKontakt);
}

// ╔═════════════════════════════════════════════════════════════════════════╗

// ── eigStatus-Trio (fachlich Datenmodell, vormals S5) ──────────────────────
//   · von           — Stufe 3: Grundbuch-Umschreibung (Eigentum + Stimmrecht)
//   · bis           — Verkäufer: Eigentum endet (= von der Käuferstufe 3)
// grundbuch:true erst ab Stufe 3. selbstnutzer bleibt unverändert.
const EIG_STATUS = {
  interessent: { label: "Kaufabsicht",   farbe: "#3B82F6" }, // info
  werdend:     { label: "in Übernahme",  farbe: "#3B82F6" }, // info (Lasten übergegangen)
  aktiv:       { label: "aktuell",       farbe: null },       // null → Akzentfarbe der Karte
  ehemalig:    { label: "ehemalig",      farbe: null },       // null → t.muted
};
// Status eines Eigentümer-Eintrags ableiten (rückwärtskompatibel + datums-
// gesteuert): Sind die Vorgangs-Daten (kaufabsichtAb/kostenAb/von) gesetzt, wird
// der Status anhand des heutigen Datums abgeleitet — ein für die Zukunft
// eingetragenes Grundbuch-/Lastendatum springt erst am Stichtag. Ohne diese
// Datumsfelder gilt das explizite status-Feld bzw. der bis/grundbuch-Fallback.
function eigStatus(p) {
  if (!p) return "aktiv";
  // Beendeter Eigentümer (Verkäufer nach Grundbuch) — bis erreicht?
  if (p.bis && p.bis !== "—" && zuIsoDatum(p.bis) <= isoHeute()) return "ehemalig";
  // Käufer im Vorgang: Status aus den erreichten Datums-Meilensteinen.
  const heute = isoHeute();
  const erreicht = (d) => !!d && zuIsoDatum(d) <= heute;
  if (p.kaufabsichtAb != null || p.kostenAb != null || (p.status === "interessent" || p.status === "werdend")) {
    if (erreicht(p.von)) return "aktiv";       // Grundbuch wirksam → aktiver Eigentümer
    if (erreicht(p.kostenAb)) return "werdend"; // Lasten übergegangen
    return "interessent";                        // Kaufabsicht
  }
  if (p.status && EIG_STATUS[p.status]) return p.status;
  if (p.bis && p.bis !== "—" && zuIsoDatum(p.bis) <= heute) return "ehemalig";
  return "aktiv"; // Altdaten / Verkäufer mit künftigem bis: noch aktiv
}
// Läuft an dieser Einheit gerade ein Eigentümerwechsel? (mind. ein werdender/
// interessierter Eintrag). Steuert die Sichtbarkeit der Vorgangs-Karte.
function laufenderEigWechsel(eig) {
  return (eig || []).some(p => { const s = eigStatus(p); return s === "interessent" || s === "werdend"; });
}

export {
  buildMockData,
  _MOCK,
  DEFAULT_KONTAKTE,
  DEFAULT_VES,
  DEFAULT_SETTINGS,
  VERWALTUNGSARTEN,
  DEFAULT_VERTEILERSCHLUESSEL,
  VS_BASEN,
  vsBasisLabel,
  vsIstManuell,
  effVerteilerschluessel,
  vsWertVon,
  KONTAKTARTEN_KATEGORIEN,
  buildKontaktarten,
  kontaktPasstZuArt,
  kontaktInGruppe,
  objektOrt,
  objektInGruppe,
  FIELD_TYPES,
  ANLEGE_FELDTYPEN,
  SUGGESTIONS,
  isStellplatzTyp,
  extractNachname,
  BELEGUNG_TYPEN,
  BELEGUNG_LABEL,
  BEWOHNER_RECHTE,
  bewohnerRecht,
  istVertragspartei,
  _teilIdCounter,
  neueTeilId,
  neueBelegId,
  neueHhmId,
  neueRaumId,
  neueZaehlerId,
  leererHaushalt,
  neuesHhMitglied,
  istAnonymesMitglied,
  mitgliedKopfzahl,
  haushaltKopfzahl,
  neueBelegung,
  neueSevId,
  neueSev,
  sevStatus,
  laufenderSevWechsel,
  starteSevWechsel,
  brecheSevWechselAb,
  ergaenzeSevFeld,
  neuerTeil,
  neuerRaum,
  RAUM_ART_OPTIONEN,
  ZAEHLER_ARTEN,
  zaehlerArtLabel,
  neuerZaehler,
  teileVon,
  aktiverTeil,
  parseFlaeche,
  flaecheVon,
  summeRaumFlaechen,
  aktiveBelegung,
  aktiveBelegungVon,
  belegungsPhase,
  heuteLaufendeBelegung,
  aktiverHaushalt,
  abgeleiteterBelegungstyp,
  belegungsTyp,
  BELEGUNG_VERWENDUNGEN,
  BELEGUNGSTYP_ZU_VERWENDUNG,
  belegungsVerwendungen,
  belegPhaseZuStatus,
  objektZuweisungenAusEinheiten,
  wendeKontaktZuweisungenAn,
  wendeKontaktZuweisungenAnAlle,
  istVermietet,
  bewohnerMitKontakt,
  verwendungenVon,
  migriereSpStellung,
  heileSevVerwendung,
  normalisiereEinheit,
  ergaenzeBewohnerRechte,
  normalisiereVes,
  BEFUGNIS_ARTEN,
  _verknId,
  neueVerknId,
  neueVerknuepfung,
  verknuepfungenVon,
  ausgehendeBefugnisse,
  normalisiereKontakt,
  normalisiereKontakte,
  EIG_STATUS,
  eigStatus,
  laufenderEigWechsel,
  migriereKontaktZuweisungen
};
