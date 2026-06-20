# MANIFEST — AllesDa Dateibestand

**Stand:** 20.06.2026 · **APP_VERSION 11.91**
**Build-relevante Dateien:** 15 (14 Quelldateien + mount.jsx)
**Verifiziert:** esbuild minify + ohne minify grün · React-Import-Check = 0 · Mount ERR = 0 (DOM 123.990)
**Quell-Speicherort (SSoT):** GitHub `dmjr9z84d6-sudo/test`, Branch `main`, Ordner **`src/`**
→ `https://raw.githubusercontent.com/dmjr9z84d6-sudo/test/main/src/<datei>`
Die 15 Quelldateien liegen NICHT im Claude-Projekt-Wissen. Claude liest sie zu
Session-Beginn von GitHub. `test` = Werkstatt (instabil), `AllesDa` = Schaufenster (stabil).

---

## Vollständiges Build-Set — alle 15 müssen zusammen im Build-Ordner / GitHub-`/src` liegen

Reihenfolge = Build-/Abhängigkeitsschicht (Blatt zuerst, App-Rumpf zuletzt).

| Nr | Datei | Zeilen | Inhalt (Kurz) |
|----|-------|--------|---------------|
| 1/15 | `constants.js` | 564 | **APP_VERSION**, Design-Tokens (FS/FW/LH/LS/SP/RAD), Default-Rollen/Verwendungen/Kategorien |
| 2/15 | `utils-basis.js` | 291 | Blatt-Helfer: Datum, PLZ/Ort, String/Phonetik, Validatoren |
| 3/15 | `datenmodell.js` | 2.383 | Datenmodell-Helfer, Belegung/Teile/Verteiler-Logik, Rollen-Ableitung, Selbstnutzer-Helfer, Mock-Cluster |
| 4/15 | `utils-icons.jsx` | 2.081 | Icons (I), Contexts/Hooks, useMasterDetailLayout, ZurueckButton, Basis-Helfer |
| 5/15 | `components.jsx` | 3.246 | Gemeinsame UI-Bausteine, Karten, Picker, RolleBadge/VerwendungBadge, Legionellen |
| 6/15 | `liegenschaft.jsx` | 7.032 | S5a · Liegenschaft/Verwaltung-Ansicht, Technik, Dokumente, Verteilerschlüssel |
| 7/15 | `objektansicht.jsx` | 2.173 | S5c · Objekt/VE-Detail, **ObjekteMasterDetail**, FeldObjektKarte, Stat-Bausteine |
| 8/15 | `listen-tools.jsx` | 2.118 | S6 · Schnelleingabe, Listengenerator, Statistik, druckeHtml |
| 9/15 | `kontakte-modul.jsx` | 4.385 | KontaktDetailKarte, RollenkarteBox, RolleZeile, BeziehungEditor |
| 10/15 | `einstellungen.jsx` | 3.669 | S8 · Einstellungen (Rollen/Verwendungen/Tabs/Daten/Kalender) |
| 11/15 | `kalender.jsx` | 3.088 | S5b · Kalender (KalenderScreen/-Panel, isoKW, sammleTermine, KALENDER_TYPEN) |
| 12/15 | `kontakte.jsx` | 1.340 | S5d · Kontakte-Ansicht, VEKontakteTab, objektBezugInfo |
| 13/15 | `suche.jsx` | 219 | S5e · Suche |
| 14/15 | `allesda_merged.jsx` | 3.262 | S9 · App-Rumpf (App-Default-Export, StatusBand, Header, Routing) |
| 15/15 | `mount.jsx` | 43 | Build-Einstiegspunkt (rendert in #root) |

---

## Build-Befehl

```
esbuild mount.jsx --bundle --format=iife --minify --loader:.jsx=jsx --outfile=AllesDa.js
```

→ erzeugt **eine** `AllesDa.js` (~1,05 MB). Diese eine Datei + `index.html` ist das GitHub-Pages-Deployment.

## Verifikations-Kriterien (nach jedem Schnitt/Build)
- esbuild **minify** ohne Fehler
- esbuild **ohne minify** ohne Fehler (fängt fehlende Re-Exporte/Importe)
- `grep -c 'from"react"\|require("react")' AllesDa.js` = **0**
- Mount-Test ERR = **0**
- Bei Render-relevanten Änderungen: isolierter Mit-Daten-Render der Schlüsselkomponenten (ERR = 0)

---

## Stabile Projekt-Dokumente (NICHT Build-relevant, ändern sich selten)
Diese bleiben im Claude-Projekt-Wissen, nicht in `/src`:
`DESIGN.md` · `BUILD_TROUBLESHOOTING.md` · `ROADMAP_AllesDa_*.md` ·
`Konzepte_AllesDa.md` · `AllesDa_Datenformat_Spec_*.md` · `MOBILE-RAHMEN-SPEC.md` ·
`DB_Schema_Spec_AllesDa_*.md` · `Luecken_Analyse_TE_vs_AllesDa.md` ·
`Marktanalyse_*.docx` · `EINSTIEG_AllesDa_*.md` · `EP_*.md` · dieses `MANIFEST_AllesDa.md`

---

## Hinweis zur Pflege
- Bei **jedem Schnitt** ändert sich dieses MANIFEST (neue Zeile, Gesamtzahl, ggf. Reihenfolge) — wird beim Backup miterneuert.
- Wenn ein Schnitt eine Datei **aufteilt** und ein alter Name verschwindet: die verwaiste Datei explizit aus `/src` löschen (wird beim jeweiligen Schnitt benannt).
- Zeilenzahlen oben sind Stand 20.06.2026 (per `wc -l` gegen GitHub-Quelle). Bei Abweichung gilt GitHub.
