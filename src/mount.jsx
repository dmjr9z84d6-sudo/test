// mount.jsx — Einstiegsdatei für den esbuild-Build.
// Hier liegt der react-dom/client-Import und der Mount-Block, damit
// allesda_merged.jsx selbst Viewer-kompatibel bleibt.
import React from "react";
import { createRoot } from "react-dom/client";
import App from "./allesda_merged.jsx";

// APP_VERSION wird aus allesda_merged.jsx nicht re-exportiert — wir lesen sie
// aus dem Lade-Indikator-Span (steht dort ohnehin und wird je Build gepflegt).
function leseVersion() {
  try {
    var span = document.querySelector("#ladeIndikator .sub span");
    if (span && span.textContent) return span.textContent.replace(/^v/, "");
  } catch (e) {}
  return "";
}


// ── Globales CSS (§76: DIE EINE Stelle für app-weite CSS-Regeln) ────────────
// Inline-Styles koennen ::-webkit-scrollbar & scrollbar-width nicht ausdruecken,
// darum ein einmaliger <style>-Block beim Mount. index.html bleibt unangetastet.
function injiziereGlobalCSS() {
  try {
    if (document.getElementById("ad-global-css")) return;
    var st = document.createElement("style");
    st.id = "ad-global-css";
    st.textContent =
      // Scrollbalken app-weit aus (Chrome/Edge/Safari via ::-webkit, Firefox via
      // scrollbar-width). iOS-Safari blendet Overlay-Balken ohnehin selbst aus.
      "*{scrollbar-width:none;-ms-overflow-style:none;" +
      // Grauer Tap-Blitz auf iOS/Android beim Antippen von Buttons/Karten aus.
      "-webkit-tap-highlight-color:transparent;" +
      // iOS-Safari skaliert im Querformat sonst Schriften eigenmaechtig hoch.
      "-webkit-text-size-adjust:100%;text-size-adjust:100%;}" +
      "*::-webkit-scrollbar{display:none;width:0;height:0;}" +
      // Rubber-Band/Pull-to-Refresh am Rand aus (PWA soll nicht neu laden).
      "html,body{overscroll-behavior-y:none;}" +
      // Lang-druecken-Kontextmenue (Bild speichern/Link kopieren) auf Bedien-
      // elementen aus; normaler Inhaltstext bleibt lang-druckbar/markierbar.
      "button,a,[role=button]{-webkit-touch-callout:none;}" +
      // 1A: UI-Chrome nicht markierbar, Inhaltstext bleibt Browser-Default
      // (markier-/kopierbar). Ersetzt die verstreuten userSelect:none-Setzungen.
      "button,a,[role=button],input,select,label{-webkit-user-select:none;user-select:none;}";
    document.head.appendChild(st);
  } catch (e) {}
}

(function () {
  try {
    injiziereGlobalCSS();
    var v = leseVersion();
    try { document.title = "AllesDa" + (v ? " v" + v : "") + " \u2014 Immobilienverwaltung"; } catch (e) {}
    var loader = document.getElementById("ladeIndikator");
    var rootEl = document.getElementById("root");
    if (!rootEl) throw new Error("#root nicht gefunden");
    createRoot(rootEl).render(React.createElement(App));
    if (loader) {
      setTimeout(function () {
        loader.style.opacity = "0";
        setTimeout(function () { loader.style.display = "none"; }, 300);
      }, 50);
    }
  } catch (err) {
    console.error("AllesDa Mount-Fehler:", err);
    var l = document.getElementById("ladeIndikator");
    if (l) {
      l.innerHTML = '<div style="max-width:480px;padding:30px;text-align:center;">'
        + '<div style="font-size:18px;font-weight:700;color:#EF4444;margin-bottom:10px;">'
        + 'AllesDa konnte nicht gestartet werden</div>'
        + '<div style="font-size:13px;color:#A0A0CD;line-height:1.5;">'
        + (err && err.message ? err.message : String(err)) + '</div></div>';
    }
  }
})();
