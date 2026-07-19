// ╔══════════════════════════════════════════════════════════════════════════╗
// ║ PDFBAUER — der EINE PDF-Renderer der App (Druck&Ablage-Konzept 19.07. §3)║
// ║ pdf-lib, A4 hoch, Standard-Helvetica (WinAnsi: Umlaute/§/¾ nachweislich  ║
// ║ OK, gemessen 19.07.). Block-API statt HTML — Tagesordnung, Einladung     ║
// ║ und (später) Protokoll speisen denselben Renderer (§76: ein Bau).        ║
// ║ Kein React, kein DOM — pur, damit in Node testbar.                       ║
// ╚══════════════════════════════════════════════════════════════════════════╝
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

// A4 in PDF-Punkten + Ränder (~2 cm).
const SEITE_B = 595.28;
const SEITE_H = 841.89;
const RAND = 56;
const FUSS_HOEHE = 30;

// ── Sanitize (Konzept §3, Merkposten §8) ────────────────────────────────────
// WinAnsi = CP1252: Umlaute, ß, §, €, Gedankenstriche, typografische
// Anführungszeichen, … sind erlaubt. ALLES außerhalb (Emojis 📍, Pfeile →,
// Haken ✓) wirft in pdf-lib einen Fehler — deshalb läuft JEDER Text hier
// durch, bevor er gezeichnet wird.
const CP1252_EXTRA = "\u20AC\u201A\u0192\u201E\u2026\u2020\u2021\u02C6\u2030" +
  "\u0160\u2039\u0152\u017D\u2018\u2019\u201C\u201D\u2022\u2013\u2014\u02DC" +
  "\u2122\u0161\u203A\u0153\u017E\u0178";
const ERSATZ = { "\u2192": "->", "\u2713": "[x]", "\u2717": "[ ]",
  "\u00A0": " ", "\u2003": " ", "\u2009": " " };
function sanitizePdfText(text) {
  const s = String(text == null ? "" : text);
  let raus = "";
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    const code = s.charCodeAt(i);
    if (ERSATZ[c] !== undefined) { raus += ERSATZ[c]; continue; }
    if (code >= 32 && code <= 255) { raus += c; continue; }
    if (c === "\n" || c === "\t") { raus += c; continue; }
    if (CP1252_EXTRA.indexOf(c) >= 0) { raus += c; continue; }
    // alles andere (Emojis, Symbole) fällt still weg
  }
  return raus;
}

// ── Zeilenumbruch: bricht Text auf maxBreite, achtet Wörter ─────────────────
function _umbrich(font, text, groesse, maxBreite) {
  const zeilen = [];
  const absaetze = String(text || "").split("\n");
  absaetze.forEach((abs) => {
    const woerter = abs.split(" ").filter((w) => w.length > 0);
    if (woerter.length === 0) { zeilen.push(""); return; }
    let zeile = "";
    woerter.forEach((w) => {
      const test = zeile ? zeile + " " + w : w;
      if (font.widthOfTextAtSize(test, groesse) <= maxBreite || !zeile) {
        zeile = test;
      } else {
        zeilen.push(zeile); zeile = w;
      }
    });
    if (zeile) zeilen.push(zeile);
  });
  return zeilen;
}

// ── bauePdf: Blockliste → PDF-Bytes (Uint8Array) ────────────────────────────
// Blöcke:
//   { typ: "ueberschrift", text, groesse? }           — fett, mit Abstand
//   { typ: "absatz", text, groesse?, fett?, farbe? }  — fließender Text
//   { typ: "punkt", label, text, textFett? }          — hängender Einzug (TOP 1 · …)
//   { typ: "adressfeld", zeilen: [..] }               — Empfängerblock
//   { typ: "zeile" }                                  — dünne Trennlinie
//   { typ: "abstand", hoehe? }                        — Leerraum
//   { typ: "seitenumbruch" }                          — neue Seite
//   { typ: "bild", bytes, format: "jpg"|"png", maxHoehe? } — eingebettetes Bild
// optionen: { fusszeile?: "AllesDa · WEG …" } — links im Fuß, rechts Seite n/m.
async function bauePdf(bloecke, optionen) {
  const opt = optionen || {};
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const fontFett = await doc.embedFont(StandardFonts.HelveticaBold);
  const maxB = SEITE_B - 2 * RAND;
  const grau = rgb(0.45, 0.45, 0.45);
  const schwarz = rgb(0.1, 0.1, 0.12);

  let seite = doc.addPage([SEITE_B, SEITE_H]);
  let y = SEITE_H - RAND;

  const neueSeite = () => {
    seite = doc.addPage([SEITE_B, SEITE_H]);
    y = SEITE_H - RAND;
  };
  const platzNoetig = (hoehe) => {
    if (y - hoehe < RAND + FUSS_HOEHE) neueSeite();
  };
  const schreibeZeilen = (zeilen, groesse, f, farbe, zeilenHoehe, einzug) => {
    zeilen.forEach((z) => {
      platzNoetig(zeilenHoehe);
      if (z) seite.drawText(z, { x: RAND + (einzug || 0), y: y - groesse,
        size: groesse, font: f, color: farbe });
      y -= zeilenHoehe;
    });
  };

  for (const roh of (bloecke || [])) {
    if (!roh) continue;
    const b = roh;
    if (b.typ === "seitenumbruch") { neueSeite(); continue; }
    if (b.typ === "abstand") { y -= (b.hoehe || 10); continue; }
    if (b.typ === "zeile") {
      platzNoetig(12);
      seite.drawLine({ start: { x: RAND, y: y - 4 }, end: { x: SEITE_B - RAND, y: y - 4 },
        thickness: 0.7, color: grau });
      y -= 12;
      continue;
    }
    if (b.typ === "ueberschrift") {
      const g = b.groesse || 15;
      const zeilen = _umbrich(fontFett, sanitizePdfText(b.text), g, maxB);
      y -= 6;
      schreibeZeilen(zeilen, g, fontFett, schwarz, g * 1.35, 0);
      y -= 4;
      continue;
    }
    if (b.typ === "absatz") {
      const g = b.groesse || 10.5;
      const f = b.fett ? fontFett : font;
      const farbe = b.farbe === "grau" ? grau : schwarz;
      const zeilen = _umbrich(f, sanitizePdfText(b.text), g, maxB);
      schreibeZeilen(zeilen, g, f, farbe, g * 1.45, 0);
      y -= 3;
      continue;
    }
    if (b.typ === "punkt") {
      // Hängender Einzug: Label links (fett), Text rechts davon umgebrochen.
      const g = 10.5;
      const label = sanitizePdfText(b.label || "");
      const labelB = fontFett.widthOfTextAtSize(label, g) + 10;
      const einzug = Math.max(labelB, 58);
      const zeilen = _umbrich(b.textFett ? fontFett : font,
        sanitizePdfText(b.text), g, maxB - einzug);
      platzNoetig(g * 1.45);
      seite.drawText(label, { x: RAND, y: y - g, size: g, font: fontFett, color: schwarz });
      schreibeZeilen(zeilen.length ? zeilen : [""], g,
        b.textFett ? fontFett : font, schwarz, g * 1.45, einzug);
      y -= 4;
      continue;
    }
    if (b.typ === "adressfeld") {
      const g = 10.5;
      (b.zeilen || []).forEach((z) => {
        platzNoetig(g * 1.4);
        seite.drawText(sanitizePdfText(z), { x: RAND, y: y - g, size: g,
          font, color: schwarz });
        y -= g * 1.4;
      });
      y -= 6;
      continue;
    }
    if (b.typ === "bild" && b.bytes) {
      // Bild einbetten (fürs Protokoll später) — skaliert auf Seitenbreite
      // bzw. maxHoehe. Ein kaputtes Bild darf das Dokument nicht reißen.
      try {
        const img = b.format === "png"
          ? await doc.embedPng(b.bytes) : await doc.embedJpg(b.bytes);
        const maxH = b.maxHoehe || 300;
        let w = img.width, h = img.height;
        if (w > maxB) { h = h * (maxB / w); w = maxB; }
        if (h > maxH) { w = w * (maxH / h); h = maxH; }
        platzNoetig(h + 6);
        seite.drawImage(img, { x: RAND, y: y - h, width: w, height: h });
        y -= h + 6;
      } catch (err) { /* still — Bild überspringen */ }
      continue;
    }
  }

  // Fußzeilen NACH dem Inhalt (Gesamtzahl steht erst jetzt fest).
  const seiten = doc.getPages();
  const gesamt = seiten.length;
  seiten.forEach((s, i) => {
    const nr = "Seite " + (i + 1) + " von " + gesamt;
    const links = sanitizePdfText(opt.fusszeile || "");
    if (links) s.drawText(links, { x: RAND, y: RAND - 26, size: 8, font, color: grau });
    const nrB = font.widthOfTextAtSize(nr, 8);
    s.drawText(nr, { x: SEITE_B - RAND - nrB, y: RAND - 26, size: 8, font, color: grau });
  });

  return doc.save();
}

export { bauePdf, sanitizePdfText };
