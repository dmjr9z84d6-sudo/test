// utils-basis.js — Blatt-Helfer (aus allesda_merged.jsx eingesammelt, Stand 11.74)
// Reine, abhängigkeitsfreie Funktionen: Datum (isoHeute/zuIsoDatum/datumDe/
// parseDatumWert), PLZ/Ort (split/join), String/Phonetik (strip/koelnerPhonetik/
// levenshtein/matchScore), Feld-Validatoren (istEmailGueltig … istIbanGueltig/
// istDatumGueltig). Kein React, keine App-Abhängigkeiten. Von Datenmodell + UI genutzt.

// Hilfs-Funktion: Datum aus Excel-Zelle parsen ("24.04.2017", Date, Number)
export function parseDatumWert(v) {
  if (!v) return null;
  if (v instanceof Date) return v;
  const s = String(v).trim();
  // Format DD.MM.YYYY
  const m = s.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
  if (m) return new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]));
  const d = new Date(s);
  if (!isNaN(d.getTime())) return d;
  return null;
}

// "80797 München" → { plz: "80797", ort: "München" }. Erstes Token = PLZ
// (optional mit Länderpräfix wie D-80797), Rest = Ort. Tolerant: nur Ort,
// nur PLZ oder leer sind alle gültig.
export function splitPlzOrt(s) {
  const str = String(s || "").trim();
  if (!str) return { plz: "", ort: "" };
  const m = str.match(/^([A-Za-z]{1,3}-)?(\d{4,5})\s+(.+)$/);
  if (m) return { plz: (m[1] || "") + m[2], ort: m[3].trim() };
  // Nur PLZ (4-5 Ziffern, evtl. mit Präfix), kein Ort
  const nurPlz = str.match(/^([A-Za-z]{1,3}-)?(\d{4,5})$/);
  if (nurPlz) return { plz: str, ort: "" };
  // Sonst: alles ist Ort
  return { plz: "", ort: str };
}

// { plz, ort } (oder Einzelwerte) → "PLZ Ort" für Anzeige/Export.
export function joinPlzOrt(plz, ort) {
  return [(plz || "").trim(), (ort || "").trim()].filter(Boolean).join(" ");
}

export function istEmailGueltig(v) {
  const s = String(v || "").trim();
  if (!s) return true;
  // genau ein @, nicht am Rand; Domain mit Punkt und TLD ≥ 2 Zeichen; keine
  // Leerzeichen.
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(s);
}

export function istTelefonGueltig(v) {
  const s = String(v || "").trim();
  if (!s) return true;
  // Nur erlaubte Zeichen (Ziffern, Leer, + ( ) / - .) und mindestens 4 Ziffern.
  if (!/^[\d\s()+\/.\-]+$/.test(s)) return false;
  const ziffern = s.replace(/\D/g, "");
  return ziffern.length >= 4 && ziffern.length <= 18;
}

export function istPlzGueltig(v) {
  const s = String(v || "").trim();
  if (!s) return true;
  // Deutsche PLZ = 5 Ziffern, optional mit Länderpräfix (z.B. D-80797, A-1010).
  return /^([A-Za-z]{1,3}-)?\d{4,5}$/.test(s);
}

export function istUrlGueltig(v) {
  const s = String(v || "").trim();
  if (!s) return true;
  // mit oder ohne Schema; mindestens "domain.tld".
  return /^(https?:\/\/)?([\w-]+\.)+[\w-]{2,}(\/\S*)?$/i.test(s);
}

export function istSteuerNrGueltig(v) {
  const s = String(v || "").trim();
  if (!s) return true;
  // Sehr tolerant: Ziffern, Schrägstriche, Leerzeichen; 8–13 Ziffern gesamt.
  if (!/^[\d\s\/.\-]+$/.test(s)) return false;
  const ziffern = s.replace(/\D/g, "");
  return ziffern.length >= 8 && ziffern.length <= 13;
}

// IBAN: Format + ISO-7064 Mod-97-Prüfziffer. Leerzeichen werden ignoriert.
export function istIbanGueltig(v) {
  let s = String(v || "").trim().replace(/\s+/g, "").toUpperCase();
  if (!s) return true;
  if (!/^[A-Z]{2}\d{2}[A-Z0-9]{10,30}$/.test(s)) return false;
  // Erste 4 Zeichen ans Ende, Buchstaben → Zahlen (A=10 … Z=35), Mod 97 === 1.
  const umgestellt = s.slice(4) + s.slice(0, 4);
  let rest = 0;
  for (let i = 0; i < umgestellt.length; i++) {
    const c = umgestellt.charCodeAt(i);
    const ziffer = (c >= 65 && c <= 90) ? (c - 55) : (c - 48); // A-Z bzw. 0-9
    if (ziffer < 0 || ziffer > 35) return false;
    rest = (rest * (ziffer > 9 ? 100 : 10) + ziffer) % 97;
  }
  return rest === 1;
}

// Plausibilitätsprüfung für ein gespeichertes Datum (de ODER iso) bzw. eine
// "tt.mm.jjjj"-Eingabe: gültiges Kalenderdatum, Jahr 1900–2100.
export function istDatumGueltig(v) {
  const s = String(v || "").trim();
  if (!s) return true;
  const d = parseDatumWert(s);
  if (!d || isNaN(d.getTime())) return false;
  const j = d.getFullYear();
  if (j < 1900 || j > 2100) return false;
  // parseDatumWert mit DD.MM.YYYY normalisiert über new Date(j,m-1,t) — ein
  // Überlauf (z.B. 31.02. → 03.03.) lässt sich am Tag erkennen: bei reiner
  // DD.MM.YYYY-Eingabe vergleichen wir die Komponenten zurück.
  const m = s.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
  if (m) {
    return d.getDate() === Number(m[1]) && (d.getMonth() + 1) === Number(m[2]);
  }
  const mi = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (mi) {
    return d.getFullYear() === Number(mi[1]) && (d.getMonth() + 1) === Number(mi[2]) && d.getDate() === Number(mi[3]);
  }
  return true;
}

// Normalisierung: Kleinschreibung + Umlaute zerlegen + Akzente weg
export function strip(s) {
  return (s || "").toLowerCase()
    .replace(/ä/g, "a").replace(/ö/g, "o").replace(/ü/g, "u")
    .replace(/ß/g, "ss")
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

// Kölner Phonetik (Hans Joachim Postel, 1969) — DER Standard für deutsche Namen.
// Wandelt einen Namen in einen Klang-Code um. Gleichklingende Namen
// bekommen denselben Code: Meier = Meyer = Mayer = Maier = "67"
export function koelnerPhonetik(name) {
  if (!name) return "";
  // Vorab normalisieren: Kleinbuchstaben, Umlaute zerlegen, nicht-Buchstaben weg
  const s = (name + "").toLowerCase()
    .replace(/ä/g, "a").replace(/ö/g, "o").replace(/ü/g, "u")
    .replace(/ß/g, "ss")
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z]/g, "");
  if (!s) return "";

  let code = "";
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    const prev = s[i - 1] || "";
    const next = s[i + 1] || "";
    if ("aeijouy".indexOf(c) >= 0)      code += "0";
    else if (c === "h")                 { /* H entfällt */ }
    else if (c === "b")                 code += "1";
    else if (c === "p")                 code += (next === "h") ? "3" : "1";
    else if (c === "d" || c === "t")    code += ("csz".indexOf(next) >= 0) ? "8" : "2";
    else if ("fvw".indexOf(c) >= 0)     code += "3";
    else if ("gkq".indexOf(c) >= 0)     code += "4";
    else if (c === "c") {
      if (i === 0) code += ("ahkloqrux".indexOf(next) >= 0) ? "4" : "8";
      else if ("sz".indexOf(prev) >= 0) code += "8";
      else if ("ahkoqux".indexOf(next) >= 0) code += "4";
      else code += "8";
    }
    else if (c === "x")                 code += ("ckq".indexOf(prev) >= 0) ? "8" : "48";
    else if (c === "l")                 code += "5";
    else if (c === "m" || c === "n")    code += "6";
    else if (c === "r")                 code += "7";
    else if (c === "s" || c === "z")    code += "8";
  }

  // Aufeinanderfolgende gleiche Codes auf einen reduzieren
  let dedup = "";
  for (let i = 0; i < code.length; i++) {
    if (code[i] !== code[i - 1]) dedup += code[i];
  }
  // Alle "0" außer am Anfang entfernen
  let result = "";
  for (let i = 0; i < dedup.length; i++) {
    if (i === 0 || dedup[i] !== "0") result += dedup[i];
  }
  return result;
}

// Levenshtein-Distance — Anzahl der nötigen Edits um a in b zu verwandeln
export function levenshtein(a, b) {
  if (!a) return (b || "").length;
  if (!b) return a.length;
  const m = a.length, n = b.length;
  // Optimierung: nur zwei Zeilen statt der ganzen Matrix
  let prev = new Array(n + 1);
  let curr = new Array(n + 1);
  for (let j = 0; j <= n; j++) prev[j] = j;
  for (let i = 1; i <= m; i++) {
    curr[0] = i;
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + cost);
    }
    [prev, curr] = [curr, prev];
  }
  return prev[n];
}

// Score-basierter Match: gibt 0 (kein Match) bis 100 (perfekt) zurück.
// opts steuert welche Stufen aktiv sind.
export function matchScore(query, text, opts) {
  const q = (query || "").trim();
  const t = (text || "").trim();
  if (!q || !t) return 0;
  const qLow = q.toLowerCase();
  const tLow = t.toLowerCase();

  // Stufe 1: exakter Substring
  if (tLow.indexOf(qLow) >= 0) return 100;

  // Stufe 2: Diakritika-insensitive
  let qS = null, tS = null;
  if (opts.diakritika !== false) {
    qS = strip(q);
    tS = strip(t);
    if (tS && qS && tS.indexOf(qS) >= 0) return 90;
  }

  // Stufe 3: mehrere Wörter — alle müssen irgendwo vorkommen
  if (opts.woerter !== false) {
    const qWords = qLow.split(/\s+/).filter(Boolean);
    if (qWords.length > 1) {
      const tWords = tLow.split(/\s+/);
      const allFound = qWords.every(qw => tWords.some(tw => tw.indexOf(qw) >= 0));
      if (allFound) return 80;
      if (opts.diakritika !== false) {
        const qWordsS = qWords.map(w => strip(w));
        const tWordsS = tLow.split(/\s+/).map(w => strip(w));
        if (qWordsS.every(qw => tWordsS.some(tw => tw.indexOf(qw) >= 0))) return 75;
      }
    }
  }

  // Stufe 4: Kölner Phonetik (nur bei einigermaßen langen Begriffen)
  if (opts.phonetik !== false && q.length >= 2) {
    const qP = koelnerPhonetik(q);
    const tP = koelnerPhonetik(t);
    if (qP && tP && tP.indexOf(qP) >= 0) return 70;
  }

  // Stufe 5: Tippfehler — Levenshtein gegen einzelne Text-Wörter
  if (opts.tippfehler !== false && q.length >= 3) {
    const qStr = qS || strip(q);
    const tStr = tS || strip(t);
    const schwelle = opts.tippfehlerSchwelle || 2;
    // Distanz gegen jedes Text-Wort; nimm das beste
    const tWords = tStr.split(/\s+/).filter(w => w.length >= 2);
    let minDist = Infinity;
    for (let i = 0; i < tWords.length; i++) {
      const d = levenshtein(qStr, tWords[i]);
      if (d < minDist) minDist = d;
    }
    if (minDist <= schwelle) {
      // 60 bei Distanz 1, 55 bei 2, 50 bei 3
      return 60 - (minDist - 1) * 5;
    }
  }

  return 0;
}

// Heutiges Datum im ISO-Format (YYYY-MM-DD), das überall im Belegungsmodell gilt.
export function isoHeute() {
  const d = new Date();
  return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
}

// Datums-Anzeige (deutsch). Akzeptiert ISO ("2026-06-09") UND Legacy dd.MM.yyyy
// ("09.06.2026") und liefert immer "09.06.2026". Leere/ungültige Werte → "".
// Der Bindestrich-Fallback "—" aus alten Wechsel-Daten wird als leer behandelt.
export function datumDe(wert) {
  if (!wert || wert === "—") return "";
  const iso = String(wert).match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[3]}.${iso[2]}.${iso[1]}`;
  const de = String(wert).match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})/);
  if (de) return `${de[1].padStart(2, "0")}.${de[2].padStart(2, "0")}.${de[3]}`;
  return "";
}

// Normalisiert ein Datum (ISO "2026-06-09" ODER Legacy dd.MM.yyyy "09.06.2026")
// in das sortierbare ISO-Format "YYYY-MM-DD". Für chronologische Vergleiche —
// String-Sortierung über gemischte Formate ist sonst falsch (z. B. "23.06.2025"
// > "2026-08-01" als Strings). Leere/ungültige Werte → "".
export function zuIsoDatum(wert) {
  if (!wert || wert === "—") return "";
  const iso = String(wert).match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  const de = String(wert).match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})/);
  if (de) return `${de[3]}-${de[2].padStart(2, "0")}-${de[1].padStart(2, "0")}`;
  return "";
}

// ── Listen-Übersicht: EINE Quelle für die feste Breite ─────────────────────
// Übersichts-Listen (Liste-Modus OHNE offenes Detail) sollen NICHT über den
// ganzen Screen laufen, sondern dieselbe feste Breite haben wie die Master-
// Spalte im Master-Detail-Zustand. Quelle: listeOpt.listeMax (zentral aus
// settings.listeBreite, Default 400). ALLE Übersichts-Listen (Objekte,
// Kontakte, Einstellungen, ObjektListeMitDetail → Kalender/ETV/Listengenerator/
// Kommunikation/Finanzen/Technik/Beschlusssammlung) MÜSSEN diesen Wert nutzen,
// damit die Liste überall gleich breit ist (Benny-Regel: ein Schema oder keins).
export function listeBreiteAus(listeOpt) {
  return (listeOpt && listeOpt.listeMax) || 400;
}

// ── Datei-Ablage (IndexedDB) ───────────────────────────────────────────────
// Backend-agnostischer Datei-Speicher für Dokument-Anhänge (PDFs, Bilder …).
// localStorage scheidet aus (~5 MB-Limit, kein Binär). IndexedDB hat kein
// praktisches Cap und speichert Blobs nativ. Am Dokument hängt NUR eine
// dateiRef-ID (String) — der Blob lebt hier. Beim Umstieg auf Supabase Storage
// (Roadmap Phase 4+) wird NUR dieser Layer getauscht: dateiRef zeigt dann auf
// einen Storage-Pfad statt eine IndexedDB-id, die Aufrufer bleiben gleich.
// Jeder Eintrag: { id, blob, name, typ, groesse, angelegt }.
const DATEI_DB_NAME = "allesda_dateien";
const DATEI_DB_STORE = "dateien";
const DATEI_DB_VERSION = 1;

function dateiDbOeffnen() {
  return new Promise(function (resolve, reject) {
    if (typeof indexedDB === "undefined" || !indexedDB) {
      reject(new Error("IndexedDB nicht verfügbar"));
      return;
    }
    const req = indexedDB.open(DATEI_DB_NAME, DATEI_DB_VERSION);
    req.onupgradeneeded = function () {
      const db = req.result;
      if (!db.objectStoreNames.contains(DATEI_DB_STORE)) {
        db.createObjectStore(DATEI_DB_STORE, { keyPath: "id" });
      }
    };
    req.onsuccess = function () { resolve(req.result); };
    req.onerror = function () { reject(req.error || new Error("DB-Fehler")); };
  });
}

// Erzeugt eine eindeutige Datei-id (String). Kein Krypto nötig — nur kollisionsarm.
function neueDateiId() {
  return "f_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2, 10);
}

// Speichert ein File/Blob. Liefert ein Promise mit dem Metadaten-Objekt
// { id, name, typ, groesse, angelegt } — id ist die dateiRef für das Dokument.
export function dateiSpeichern(file) {
  return new Promise(function (resolve, reject) {
    if (!file) { reject(new Error("keine Datei")); return; }
    dateiDbOeffnen().then(function (db) {
      const eintrag = {
        id: neueDateiId(),
        blob: file,
        name: (file && file.name) || "Datei",
        typ: (file && file.type) || "",
        groesse: (file && file.size) || 0,
        angelegt: Date.now(),
      };
      const tx = db.transaction(DATEI_DB_STORE, "readwrite");
      tx.objectStore(DATEI_DB_STORE).put(eintrag);
      tx.oncomplete = function () {
        db.close();
        resolve({ id: eintrag.id, name: eintrag.name, typ: eintrag.typ,
          groesse: eintrag.groesse, angelegt: eintrag.angelegt });
      };
      tx.onerror = function () { db.close(); reject(tx.error || new Error("Speichern fehlgeschlagen")); };
    }).catch(reject);
  });
}

// Lädt den Blob zu einer dateiRef-id. Promise mit Blob (oder null, wenn weg).
export function dateiLaden(id) {
  return new Promise(function (resolve, reject) {
    if (!id) { resolve(null); return; }
    dateiDbOeffnen().then(function (db) {
      const tx = db.transaction(DATEI_DB_STORE, "readonly");
      const req = tx.objectStore(DATEI_DB_STORE).get(id);
      req.onsuccess = function () {
        db.close();
        resolve(req.result ? req.result.blob : null);
      };
      req.onerror = function () { db.close(); reject(req.error || new Error("Laden fehlgeschlagen")); };
    }).catch(reject);
  });
}

// Löscht den Blob zu einer dateiRef-id. Promise<boolean>.
export function dateiLoeschen(id) {
  return new Promise(function (resolve) {
    if (!id) { resolve(false); return; }
    dateiDbOeffnen().then(function (db) {
      const tx = db.transaction(DATEI_DB_STORE, "readwrite");
      tx.objectStore(DATEI_DB_STORE).delete(id);
      tx.oncomplete = function () { db.close(); resolve(true); };
      tx.onerror = function () { db.close(); resolve(false); };
    }).catch(function () { resolve(false); });
  });
}

// Lädt eine gespeicherte Datei als Download herunter (unsichtbarer <a download>,
// KEIN window.open). Für den expliziten „Herunterladen"-Button im Viewer.
export function dateiOeffnen(id, dateiname) {
  return new Promise(function (resolve) {
    dateiLaden(id).then(function (blob) {
      if (!blob) { resolve(false); return; }
      try {
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = dateiname || "Datei";
        document.body.appendChild(a);
        a.click();
        setTimeout(function () {
          try { document.body.removeChild(a); } catch (e) {}
          URL.revokeObjectURL(url);
        }, 100);
        resolve(true);
      } catch (e) { resolve(false); }
    }).catch(function () { resolve(false); });
  });
}

// Liefert für den Inline-Viewer eine Object-URL + den MIME-Typ der Datei.
// Aufrufer MUSS die URL nach Gebrauch via URL.revokeObjectURL freigeben
// (sonst Speicher-Leak). Promise mit { url, typ, name } oder null.
export function dateiBlobUrl(id) {
  return new Promise(function (resolve) {
    dateiDbOeffnen().then(function (db) {
      const tx = db.transaction(DATEI_DB_STORE, "readonly");
      const req = tx.objectStore(DATEI_DB_STORE).get(id);
      req.onsuccess = function () {
        db.close();
        const e = req.result;
        if (!e || !e.blob) { resolve(null); return; }
        try {
          resolve({ url: URL.createObjectURL(e.blob), typ: e.typ || "", name: e.name || "Datei" });
        } catch (err) { resolve(null); }
      };
      req.onerror = function () { db.close(); resolve(null); };
    }).catch(function () { resolve(null); });
  });
}
