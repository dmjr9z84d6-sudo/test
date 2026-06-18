# MANIFEST — AllesDa Dateibestand

**Stand:** 18.06.2026
**Build-relevante Dateien:** 12 (11 Quelldateien + mount.jsx)
**Verifiziert:** esbuild grün · React-Import-Check = 0 · Mount ERR = 0 (742 DOM-Knoten)

---

## Vollständiges Build-Set — alle 12 müssen zusammen im Build-Ordner / GitHub-`/src` liegen

Reihenfolge = Build-/Abhängigkeitsschicht (Blatt zuerst, App-Rumpf zuletzt).

| Nr | Datei | Zeilen | Inhalt (Kurz) |
|----|-------|--------|---------------|
| 1/12 | `constants.js` | 561 | APP_VERSION, Design-Tokens (FS/FW/LH/LS/SP/RAD), 37 exports |
| 2/12 | `utils-basis.js` | 291 | 17 Blatt-Funktionen (strip/levenshtein/koelnerPhonetik modul-intern) |
| 3/12 | `datenmodell.js` | 1.864 | Datenmodell-Helfer, Belegung/Teile/Verteiler-Logik |
| 4/12 | `utils-icons.jsx` | 2.001 | Icons (I), StickySectionHeader, useWindowWidth, Basis-Helfer |
| 5/12 | `components.jsx` | 3.184 | Gemeinsame UI-Bausteine, Karten, Picker, KontaktKarte |
| 6/12 | `kalender.jsx` | 3.085 | S5b · Kalender (KalenderScreen/-Panel, isoKW, sammleTermine, KALENDER_TYPEN) |
| 7/12 | `objektansicht.jsx` | 2.087 | S5c · Objekt/VE-Detail, FeldObjektKarte, Stat-Bausteine |
| 8/12 | `kontakte.jsx` | 1.333 | S5d · Kontakte-Ansicht |
| 9/12 | `suche.jsx` | 219 | S5e · Suche |
| 10/12 | `listen-tools.jsx` | 2.118 | S6 · Schnelleingabe, Listengenerator, Statistik, druckeHtml |
| 11/12 | `allesda_merged.jsx` | 17.850 | Rest-Kern (S5a Liegenschaft, S7 Kontakte, S8 Einstellungen, S9 App/Default-Export) |
| 12/12 | `mount.jsx` | 43 | Build-Einstiegspunkt (rendert in #root) |

---

## Build-Befehl

```
esbuild mount.jsx --bundle --format=iife --minify --loader:.jsx=jsx --outfile=AllesDa.js
```

→ erzeugt **eine** `AllesDa.js` (~990 KB). Diese eine Datei + `index.html` ist das GitHub-Pages-Deployment.

## Verifikations-Kriterien (nach jedem Schnitt)
- esbuild ohne Fehler
- `grep -c 'from"react"\|require("react")' AllesDa.js` = **0**
- Mount-Test ERR = **0**

---

## Stabile Projekt-Dokumente (NICHT Build-relevant, ändern sich selten)
Diese bleiben im Claude-Projekt-Wissen, nicht zwingend in `/src`:
`DESIGN.md` · `BUILD_TROUBLESHOOTING.md` · `ROADMAP_AllesDa_*.md` ·
`Konzepte_AllesDa.md` · `AllesDa_Datenformat_Spec_*.md` · `MOBILE-RAHMEN-SPEC.md` ·
`EINSTIEG_AllesDa_*.md` · dieses `MANIFEST_AllesDa.md`

---

## Hinweis zur Pflege
- Bei **jedem Schnitt** ändert sich dieses MANIFEST (neue Zeile, Gesamtzahl, ggf. Reihenfolge) — wird beim Backup miterneuert.
- Wenn ein Schnitt eine Datei **aufteilt** und ein alter Name verschwindet: die verwaiste Datei explizit aus `/src` löschen (wird beim jeweiligen Schnitt benannt).
