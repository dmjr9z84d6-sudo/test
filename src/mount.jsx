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

(function () {
  try {
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
