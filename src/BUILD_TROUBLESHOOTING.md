# AllesDa — Build & Start: Troubleshooting-Steckbrief

> Kurzreferenz, falls die App nicht startet oder der Build zickt.
> Diesen Text einfach Claude geben — dann ist der Kontext sofort da.
> Stand: APP_VERSION 11.75 · MODULARE Quelle (11 Dateien, Build-Entry `mount.jsx`,
> Verifikation per esbuild-Syntax-Check + jsdom-Render mit `act` + vollem App-Mount).

-----

## So wird gebaut (verbindlich)

- **Quelle:** `allesda_merged.jsx` — wird bearbeitet. Sie hat NUR den React-Import
  (kein `react-dom/client`, kein Mount-Block) und ist daher direkt im Claude-
  Artifact-Viewer anzeigbar. NICHT als Build-Entry verwenden.
- **Build-Entry:** `mount.jsx` — importiert `./allesda_merged.jsx`, enthält den
  `react-dom/client`-Import und den Mount-Block (`createRoot(#root).render(App)`)
  und blendet den Ladeindikator aus.
- **Ergebnis:** `AllesDa.js` (minifiziertes IIFE-Bundle) + `index.html` — nur das
  läuft im Deployment (GitHub Pages).
- **Build-Befehl (OHNE Shim-Aliase):**

  ```
  esbuild mount.jsx --bundle --format=iife --minify --loader:.jsx=jsx --outfile=AllesDa.js
  ```
- **Pflicht in `mount.jsx`:**
  - `import React from "react";`
  - `import { createRoot } from "react-dom/client";`  ← NICHT aus `"react-dom"`
  - `import App from "./allesda_merged.jsx";`
  - Mount-Block, der `createRoot(#root).render(App)` aufruft UND `#ladeIndikator`
    ausblendet. Fehlt er → Ladebildschirm hängt ewig.
- **index.html:** lädt KEIN externes React (kein unpkg). React steckt im Bundle.
- **Zwei getrennte Versionszähler, bei jeder Lieferung mitziehen:**
  - `APP_VERSION` in `allesda_merged.jsx` (App-Logik-Version).
  - index-Version in `index.html` an DREI Stellen (Titel, Lade-Indikator-Span,
    `?v=`) — Cache-Busting des Loaders.
- **Hochladen:** IMMER `AllesDa.js` + `index.html` zusammen. Danach am iPhone ggf.
  hart neu laden (Cache).

-----

## Verifikation (verbindlich, bei JEDER Änderung — ohne zu raten)

Arbeitsverzeichnis `/home/claude`; React + react-dom dort installiert.

### a) Bundle-Init-Test (Pflicht — fängt Syntax-/Import-Fehler)

`mount_test.jsx` importiert `App` (default) aus `./allesda_merged.jsx`;
`runtest.js` hat DOM/window/localStorage-Stubs und gibt bei Erfolg `BUNDLE INIT OK`.

```
esbuild mount_test.jsx --bundle --format=cjs --loader:.jsx=jsx --outfile=/tmp/_bundle.js
node runtest.js      # erwartet: BUNDLE INIT OK
```

### b) Echter Render-Test (Pflicht bei JEDER UI-/Komponenten-Änderung)

Der Bundle-Init-Test allein reicht NICHT — er fängt KEINE Render-Fehler wie
„Cannot access X before initialization" oder „Can't find variable: X". Deshalb die
geänderte Komponente IMMER zusätzlich mit `renderToString` rendern und auf
`RENDER OK` prüfen. Muster:

```jsx
import React from "react";
import { renderToString } from "react-dom/server";
import { MeineKomponente } from "/tmp/test_src.jsx";  // = Kopie der Quelle + export-Zeile
const t={surface:"#fff",bg:"#eee",border:"#ccc",text:"#111",sub:"#555",muted:"#999",card:"#fff"};
try {
  const html = renderToString(React.createElement(MeineKomponente, { /* nötige props */ t }));
  console.log("len", html.length); console.log("RENDER OK");
} catch(e){ console.log("RENDER FAIL:", e.message); process.exit(1); }
```

### c) Voller App-Render (Sicherheitsnetz)

`renderToString(App)` mit Browser-Stubs. ACHTUNG: rendert nur den Default-Zustand —
aufgeklappte/bedingte Pfade werden dabei NICHT betreten (siehe Render-Scope-Falle).

### d) Offene Imports im Bundle

Im fertigen `AllesDa.js` nach `from"react` / `require("react` greifen — muss 0 sein
(esbuild backt alles ein).

-----

## Symptom → Ursache → Fix

### 1. Ladebildschirm hängt ewig („wird geladen… vX.XX"), Seite bleibt leer

- **Ursache A:** Mount-Block fehlt in `mount.jsx` (kein `createRoot(...).render(App)`,
  nichts blendet `#ladeIndikator` aus).
- **Ursache B:** Doppeltes React („Dual-React"). Konsolenfehler:
  `Cannot read properties of undefined (reading 'S')`. Entsteht durch alte esbuild
  `--alias:react` / `--alias:react-dom`-Shims → zwei React-Instanzen.
- **Fix:** Mount-Block in `mount.jsx`; `createRoot` aus `"react-dom/client"`; OHNE
  Shim-Aliase bauen (Befehl oben). Dann genau eine React-Instanz, App mountet.

### 2. „Artifact failed to load … react-dom/client" (im Claude-Viewer)

- **Kein echter Fehler** — passiert nur, wenn `mount.jsx` im Viewer geöffnet wird
  (importiert `react-dom/client` + `./allesda_merged.jsx`).
- **Fix:** Im Viewer IMMER `allesda_merged.jsx` öffnen (hat nur den React-Import,
  rendert direkt). `mount.jsx`/`AllesDa.js`/`index.html` sind fürs Deployment.

### 3. esbuild bricht ab mit „Unexpected …" / „Unterminated regular expression"

- Meist eine unbalancierte Klammer oder ein verlorenes/zu viel entferntes JSX-Tag
  durch einen Edit (z. B. ein fehlendes Opening-Tag → der Parser liest `/` im
  Closing-Tag als Regex).
- **Fix:** Die zuletzt geänderte Stelle ansehen; `{`/`}`-Balance grob prüfen;
  fehlende/doppelte Tags und Funktionssignaturen suchen. Ein reines `()`-
  Ungleichgewicht beim rohen Zählen ist NORMAL (Strings/Regex/Smileys) — maßgeblich
  ist, ob esbuild + Render durchlaufen.

### 4. „Cannot access X before initialization" (Render-Fehler im Viewer)

- Eine `const` wird vor ihrer Definition benutzt (`const` ist NICHT gehoisted).
- **Fix:** Definition nach oben verschieben; mit echtem `renderToString`-Test (b)
  reproduzieren.

-----

## Render-Scope-Falle bei Struktur-Änderungen (Pflicht-Zusatz)

> Hintergrund: Ein „Can't find variable: X"-Crash zur Laufzeit, obwohl
> Bundle-Init-Test UND isolierte Render-Tests der geänderten Komponenten grün
> waren. Ursache: State in Komponente A deklariert, aber in Komponente B genutzt
> (B bekam den Prop nicht durchgereicht). Der Bundle-Init-Test fängt das nie; ein
> isolierter Render-Test des Kindes auch nicht (die Props gibt man dort ja selbst
> mit). Der volle App-Render war grün, weil er den betroffenen Zustand (offene
> Einheit) im Default-Mount gar nicht betritt.

**Wann dieser Zusatz gilt:** sobald State verschoben, ein neuer Prop eingeführt,
oder Komponenten umgehängt werden. (Bei rein lokalen Änderungen — Styling, eine
Komponente intern — reicht der isolierte Render-Test aus b.)

Dann ZUSÄTZLICH:

1. **Grep + Scope-Check pro Trefferstelle.** Nach jedem neuen Identifier
   `grep -nE '\bX\b'` über die ganze Datei. Für JEDE Trefferstelle prüfen, in
   WELCHER Funktion sie liegt (`grep -nE '^function [A-Z]' | awk -F: '$1<ZEILE' | tail -1`)
   und ob X dort deklariert oder als Prop empfangen ist. Nutzung und Deklaration
   in verschiedenen Funktionen ohne Durchstich = der Bug.
2. **Teste den Besitzer, nicht das Kind.** Render-Test auf der nächsthöheren
   Komponente, die die geänderten Kinder ZUSAMMENSETZT (sie muss die Props selbst
   liefern) — nicht auf der geänderten Komponente isoliert. Beispiel: nicht
   `EinheitZeile`, sondern `GebaeudeEinheiten`.
3. **Den relevanten Zustand herstellen.** Der Render-Test muss den Pfad auch
   DURCHLAUFEN, der gecrasht ist — also den auslösenden State als Prop setzen
   (z. B. `activeEinheit` gesetzt, damit das aufgeklappte Detail rendert), nicht
   nur den Default-Zustand. Ein grüner `renderToString(App)` im Default-Mount
   beweist nichts über aufgeklappte/bedingte Pfade.

### Konkretes Beispiel: fehlender Import nach Modul-Schnitt (v11.88, Kalender)

Symptom: Timeline + Kalender luden normal, aber Klick auf eine Objektkarte im
Kalender → **schwarzer Bildschirm**. Crash: `ReferenceError: ObjekteMasterDetail
is not defined`. Ursache: `ObjekteMasterDetail` lebte im App-Rumpf
`allesda_merged.jsx`, war dort nicht exportiert, und `kalender.jsx` benutzte es
**ohne Import**. esbuild lässt einen unaufgelösten Identifier als nicht
existentes Global durch (kein Build-Fehler!) — er crasht erst zur Laufzeit, wenn
der Pfad betreten wird (hier: `kalView==="objekte"` + ein Objekt ausgewählt →
`renderTerminDetail` via `ObjekteMasterDetail`).

Warum die Standard-Tests grün waren: Bundle-Init betritt den Pfad nie; der
Kalender lädt im Listen-/Timeline-Modus (kein `ObjekteMasterDetail`); der Default-
Mount klickt keine Objektkarte. **Reproduziert** wurde es erst durch Render von
`KalenderScreen` mit `kalView:"objekte"` + `kalViewVEId` gesetzt (= ausgewähltes
Objekt) — exakt Regel 3 oben.

Fix-Entscheidung (Weg 1, zyklusfrei): Komponente **verschieben** dorthin, wo ihre
Bausteine leben (`objektansicht.jsx` — hat `VEDetail`/`VEKachel`/`VEListenZeile`),
statt sie aus dem App-Rumpf zu exportieren. Letzteres hätte einen **Modul-Init-
Zyklus** geschaffen (`allesda_merged` importiert bereits aus dem Zielmodul).
Faustregel: Eine geteilte Komponente gehört in die UNTERSTE Schicht, die alle
ihre Bausteine kennt — nie in den App-Rumpf, aus dem andere importieren.

**Zusatz-Check beim Modul-Schnitt:** Wird eine Funktion zwischen Modulen
verschoben oder neu woanders benutzt, für JEDE Nutzungsstelle prüfen, ob das
nutzende Modul sie auch **importiert** (`grep -n "Name" modul.jsx` → steht sie im
Import-Block?). Ein „ist definiert, aber woanders" + „wird benutzt, aber nicht
importiert" = derselbe Laufzeit-Crash wie die Prop-Variante.

-----

## Was NICHT die Ursache ist (Zeitfresser vermeiden)

- App-/Build-Version: steht nicht im Datenmodell, ist für den Start egal.
- Die einzelnen Feature-Edits (z. B. Datums-Picker, Verwendungs-Editor): laufen erst
  bei Nutzung, nicht beim Start — bei Startfehlern zuerst Mount + React-Instanz prüfen.
- Datei aus `/mnt/project/` „fehlt": gründlich suchen + erneut versuchen
  (Sync-Verzögerung kann Treffer verzögern), bevor man sie als fehlend behandelt.

---

## Mount-Test: eval statt require (TDZ-Fehler fangen)

**Symptom:** App startet live mit „Cannot access 'X' before initialization"
(weiße Seite), aber der require-basierte Verifikationstest meldet alles grün.

**Ursache:** `require()` eines CJS-Builds wertet das Modul anders aus als der
echte Artifact-Runner (iife im Browser). Top-Level-Ausführungsreihenfolge und
Temporal-Dead-Zone-Fehler (z. B. eine `let`-Variable, die VOR ihrer Definition
in einer früher aufgerufenen Funktion genutzt wird) werden dabei NICHT zuverlässig
ausgelöst.

**Lösung (Standard seit v9.01):** Das iife-Bundle per **`eval` im selben
JSDOM-Kontext** ausführen, nicht via require:
```js
const code = fs.readFileSync("./AllesDa.js","utf8");
(0, eval)(code);   // global eval — wertet Top-Level wie der Browser aus
```
Vorher globals setzen (window/document/navigator/localStorage/matchMedia/
requestAnimationFrame, IS_REACT_ACT_ENVIRONMENT=true), console.error zählen
(„not wrapped in act" filtern). Erfolg: DOM ~121.332 (ab v9.62; 121.061 v9.60;
121.038 v9.52–9.59; davor 118.060), ERR=0.

**Konkreter Fall:** `neueSevId` nutzte einen Top-Level-`let`-Zähler, der nach
`buildMockData` deklariert war → live TDZ-Crash, im require-Test unsichtbar.
Fix: ID ohne Top-Level-let (Date.now()+Random). Lehre: **keine Top-Level-let-
Zähler, die vor ihrer Definition genutzt werden** — und immer eval-Test.

## Tote-Code-Analyse (Methode seit v9.66)

Top-Level-Definitionen sammeln (`^function Name(` / `^const NAME =`), je Name
Verwendungen zeilenweise zählen — ein Treffer zählt NUR, wenn er nicht in der
Definitionszeile steht und nicht hinter `//` in derselben Zeile beginnt.
0 Verwendungen = toter Kandidat. **Fallen:**
- NIEMALS Kommentare per Regex strippen (`/\*[\s\S]*?\*/` frisst bei einem
  `/*` in einem String riesige Codebereiche → falsche 0-Treffer).
- Roh-Treffer „(2)" = Definition + 1 Verwendung = LEBENDIG (normal).
- Header-Schreibweisen weichen ab („Kachel-Übersicht" ↔ `KachelUebersicht`) —
  bei Header-Zuordnung normalisieren (lowercase, Umlaute→ae/oe/ue, Sonderzeichen raus).
- Jeden Kandidaten vor dem Löschen per `grep -n` manuell bestätigen.

## Automatisierter Block-Schnitt: Klammer-Balance-Falle (v9.66)

Block-Ende per Klammer-Balance ab der Definitionszeile funktioniert MEISTENS —
aber die Balance zählt Klammern in STRINGS und KOMMENTAREN mit. Eine
unbalancierte Klammer in einem Kommentar IM Funktionskörper (z. B. „1)" in
einer Aufzählung) beendet den Block zu früh → Funktions-REST bleibt als
Top-Level-Waise stehen (Syntaxfehler, im Glücksfall sofort vom Build gefangen).
**Pflicht nach jedem automatisierten Schnitt:**
1. esbuild-Build (fängt Waisen fast immer als „Unexpected }").
2. Mengencheck: Definitionen alt − neu = EXAKT die beabsichtigten Namen.
3. Jede Schnittkante per Diff ansehen (Zeile davor/danach = sauberer
   Top-Level-Anfang: Leerzeile/Kommentar/function/const).
4. Tot-Analyse erneut: muss leer sein UND keine frisch verwaisten Helfer
   zeigen (Konstante, deren einzige Verwendung im gelöschten Block lag).
Zu LANG schneiden kann die Balance-Methode nicht (bricht beim ersten
Null-Durchgang) — nur zu kurz.

## Tastatur-E2E-Test im JSDOM (Muster seit v9.65)

Navigation + Listen-Cursor lassen sich headless testen: nach dem eval-Mount
`window.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true,
cancelable: true }))`. Vorher stubben: `HTMLElement.prototype.scrollIntoView`
(no-op) und `getBoundingClientRect` (festes Rect > 0, sonst gilt nichts als
„sichtbar"). Ablauf-Beispiel: `e` → `[data-kb-item="1"]` zählen (Sektions-
Kacheln) → `ArrowDown` → genau EIN `[data-kb-aktiv="1"]`. Tasten laut
TASTATUR_AKTIONEN: h/o/k/t/l/s/e — t = Kalender, s = Statistik, e =
Einstellungen (nicht raten, nachschlagen!). „Not implemented: scrollTo"-
Meldungen von JSDOM sind Rauschen, keine Fehler. Achtung: der Rect-Stub macht
ALLES sichtbar — auch Listen „hinter" einem gewechselten Screen, die noch im
DOM hängen; Item-Zahlen deshalb nicht als exakte Screen-Inventur lesen.

## iOS-Scroll-Freeze in overflow-Containern (v9.77)

Symptom: Touch-Scroll im Panel friert komplett ein (iPhone), Desktop ok.
Ursache: sehr hoher Inhalt (~37k px, 60 Tagesblöcke) in einem Container mit
`WebkitOverflowScrolling: "touch"` — die Property erzwingt einen Legacy-
Composited-Layer mit GPU-Textur-Limit. Fix: Property ENTFERNEN (obsolet seit
iOS 13, Momentum ist Standard) und Inhalte fenstern (Tag-Stufe: 21 Tage,
Nachladen ±21). Regel: -webkit-overflow-scrolling nie mehr setzen; Scroll-
Container-Inhalte < ~15k px halten oder windowing.

## TDZ-Diagnose: unminifiziert bauen (v9.79)

„Cannot access 'de' before initialization" — minifizierte Namen sind nutzlos.
Vorgehen: denselben Build OHNE --minify nach /tmp bauen, im selben JSDOM-
Harness reproduzieren → echter Variablenname + Komponenten-Stack im Fehler
(hier: `kalDockAktiv` nutzte `istDesktop` ~200 Zeilen vor dessen Definition
in App). Konsequenz: abgeleitete consts IMMER direkt hinter ihre
Abhängigkeiten setzen; Kommentar „muss NACH x stehen (TDZ)" hinterlassen.

## E2E-Harness-Fallstricke (v9.70–v9.81)

- React 18 rendert asynchron: nach JEDEM dispatchten Klick ~200–300 ms warten,
  bevor innerHTML geprüft wird — sonst Phantom-FAILs.
- Button-Suche per Text: IMMER letzten Treffer nehmen (Nav-Buttons wie
  „Objekte" stehen früher im DOM und kollidieren mit Screen-Buttons).
- innerHTML escaped Entities: „Datum & Uhrzeit" steht als „Datum &amp;
  Uhrzeit" im HTML — Suchstrings entsprechend escapen.
- value-Setzen auf Inputs: nativen Setter via
  Object.getOwnPropertyDescriptor(proto,"value").set nutzen + input/change
  dispatchen, sonst ignoriert React den Wert.

## Referenz-DOM-Länge gesenkt (v10.22)

Seit der Statusleiste-Umstellung auf Handlungsbedarf zeigen grüne Objekte keine
Leiste mehr → Referenz-DOM von ~123.554 auf **~120.040** gefallen. mounttest
prüft nur `> 100.000`, daher unkritisch. Bei künftigen exakten DOM-Vergleichen
diesen Wert als neue Baseline nehmen.

## cardWidth-Rückkopplung im Master-Detail (v10.14)

Symptom: Detailfenster-Slider „springt" / klemmt (z. B. bei ~420 px), folgt nicht
stufenlos. Ursache: px-Wert wurde über `÷cardWidth → Faktor → ×cardWidth`
geführt; `cardWidth` wird dynamisch gemessen und ändert sich, sobald das Detail
aufgeht (Master schmaler) → Rückkopplung. Fix: absolute px direkt an
`useMasterDetailLayout` (`detailPx`), `wunschDetail = detailPx` ohne cardWidth.
Test: Slider per nativem value-Setter durchfahren (300→700) und gerenderte
`flex: 0 0 Npx` messen — muss exakt dem Slider folgen.

## Chevron-Bereinigung per Skript (v10.27)

Massen-Entfernung von `<I name="chevR" .../>` per Python-Regex
(`re.sub(r'\s*<I name="chevR"[^>]*/>', '', src)`). Danach Pflicht: Klammer-
Balance grob prüfen (kleine Differenz durch Strings/Templates normal), Build +
Mount, und gezielt grep auf verbleibende `name="chev"` — bestätigen, dass nur die
gewünschten Kategorien (Dropdown-Indikator + chevron-left) übrig sind. Achtung
beim Hand-Entfernen von `offen ? chevD : chevR`-Blöcken: das umschließende
`</div>` NICHT versehentlich verdoppeln (passiert v10.27, sofort korrigiert).

## str_replace, das eine Funktionssignatur mitlöscht (v10.35)

Beim Einfügen eines Blocks VOR `</>; }` einer Komponente wurde im `old_str`
auch die nachfolgende `function KalenderScreen(...) {`-Signatur mitkopiert und im
`new_str` versehentlich weggelassen → esbuild „Unexpected }" weiter unten, weil
der Funktionskörper plötzlich ohne Kopf im Modul-Top stand.
**Regel:** Bei `str_replace` an Funktions-/Komponentengrenzen den `old_str` so
schneiden, dass er NICHT in die nächste Deklaration hineinreicht — oder die
mitgenommene Signatur im `new_str` wortgleich wieder einsetzen. Nach jeder
strukturellen Einfügung: Build + `grep -n "function <Name>"` für die direkt
betroffene UND die nächste Funktion, dann Mount ERR=0.

## Verlorene `{cond && (`-Bedingung beim Block-Einfügen (v10.72)

Beim Einfügen eines Overlays per `str_replace` ging die öffnende Bedingung
`{gefiltert.length === 0 && (` der nachfolgenden Leer-Meldung verloren. Folge:
Die Meldung wurde immer gerendert UND ihr verwaistes `)}` erschien als sichtbarer
Text im UI (kein Build-Fehler, weil JSX-syntaktisch noch valide!).
**Regel:** Nach dem Einfügen großer JSX-Blöcke nicht nur den Build prüfen,
sondern auch, dass jede `{cond && (`-Klammer noch ihr `)}` hat und umgekehrt.
Ein loses `)}` oder `)` ist ein starker Hinweis. Visuelle Kontrolle am Gerät
(Screenshot) deckt solche „rendert-als-Text"-Fehler auf, die der Build nicht
fängt.

## Prop-Defaultwert-Override für Theming (v10.80)

Komponenten, die intern eine feste Kontext-Farbe ziehen (z.B.
`useKontaktFarbe().auswahlObjekt` in `VEKachel`/`VEListenZeile`/
`ObjekteMasterDetail`), lassen sich nicht von außen umfärben. Lösung sauber:
optionaler Prop `auswahlAccentOverride = null`, dann
`const x = auswahlAccentOverride || useKontaktFarbe().auswahlObjekt || accent;`.
So bleibt der Default-Aufruf (Objekte-Screen) unverändert, und der Kalender
kann seine eigene Farbe durchreichen. Gleiches Muster für `renderDetailOverride`
(fremder Detail-Inhalt bei gleichem Master-Detail-Gerüst).

## Vorgesetzter Wert wird durch Reset-Handler gelöscht (v10.82)

`objektFest`-Modus: Das Objekt war via `start.objektId` initialisiert, aber der
Bezeichnungs-onClick rief unbedingt `setObjektId("")` → vorgesetztes Objekt weg,
Folge-Schritt zeigte „Erst ein Objekt wählen". **Regel:** Reset-Handler, die
Felder beim Wechsel leeren, müssen einen „fest"-Modus respektieren
(`if (!objektFest) setObjektId("")`). Bei jedem neuen „vorgesetzt/gesperrt"-Modus
prüfen, welche bestehenden Handler den gesetzten Wert überschreiben könnten.

## Einheiten nur aus ve.einheiten statt ve.karten gesucht (v10.83)

`autoBeteiligteIds` fand die gewählte Einheit nicht, weil es nur in
`ve.einheiten` suchte — die Einheiten liegen aber kanonisch in `ve.karten`
(`karten[].einheiten[]`). **Regel:** Einheiten IMMER kanonisch sammeln:
`const aus = []; (ve.karten||[]).forEach(k => ((k&&k.einheiten)||[]).forEach(e =>
e && aus.push(e))); return aus.length ? aus : (ve.einheiten||[]);`
`ve.einheiten` allein ist je nach Bestand unvollständig.

## Karten „zu schmal" — Mobil-Flex-Row-Falle (v11.16)

Im Kalender endeten die Objektkarten rechts mit Rand (nicht randbündig), während
Header/Suchleiste bis zum Rand gingen. Ursache: Der den Listenbereich
umschließende Flex-Container stand auf **`row`** (für die Desktop-Master-Detail-
Ansicht nebeneinander gedacht). Auf Mobil gibt es dieses Nebeneinander nicht —
die einzelne Kartenspalte füllt im Row-Container nicht die volle Breite.
**Regel:** Solche Wrapper auf Mobil auf `column` schalten:
`flexDirection: istDesktop ? "row" : "column"`; Listen-Container zusätzlich
`flex: 1` + `minWidth: 0` + `width: "100%"` + `boxSizing: "border-box"`.
Siehe DESIGN.md §51.3.

## Layout/Flexbox ist in JSDOM NICHT messbar (Diagnose-Lehre, v11.16)

JSDOM rechnet kein Flexbox-Layout (`offsetWidth` bleibt 0, kein Reflow). Reine
Breiten-/Höhen-/Überlauf-Bugs lassen sich daher in der Verifikationsumgebung
NICHT visuell verifizieren — nur Build-Parse (JSX-Balance) und Mount (ERR=0).
**Vorgehen bei Layout-Bugs:** nicht iterativ raten, sondern früh einen Screenshot
vom echten Gerät erbitten, die fragliche Stelle gegen die funktionierende
Referenz (Objekte/Kontakte) diffen und die Ursache strukturell beheben. Mehrere
Pflaster-Versuche (boxSizing/minWidth an Einzelboxen) lösten das Problem nicht —
erst der strukturelle Row→Column-Fix am umschließenden Container.

## Leere StatusLeiste bei grünen Objekten (v11.15)

`VEKachel` rendert `<StatusLeiste>` mit fester `height: 26`. Bei grünen Objekten
ist `status === null` (nur rot/gelb setzen `status`), `zeigeStatus` prüfte das
aber nicht → leerer 26px-Block (`\u00A0`) unter der Karte. **Fix/Regel:**
`zeigeStatus` an `status != null` koppeln. Kontrolle über Referenz-DOM: mit Fix
sinkt er auf ~120.058 (leere Leisten weg). Siehe DESIGN.md §51.5.

## Overlay nur in EINEM Render-Zweig (v11.30)

Der Termin-Bearbeiten-Stift im Objekt-Detail tat „nichts" (klappte nur zu).
Ursache: `setBearbeiteTermin(...)` wurde korrekt gerufen, aber das
Bearbeiten-Overlay war NUR im Timeline-Render-Zweig platziert. Der
Objekt-Detail-Zweig (renderTerminDetail via ObjekteMasterDetail) ist ein anderer
Render-Pfad ohne das Overlay → State gesetzt, aber nichts gerendert.
**Lehre:** Bei einem ternären `view === A ? (…) : (…)` muss ein gemeinsames
`position:fixed`-Overlay VOR den Ternär gezogen werden, sonst erscheint es nur in
einem Ast. Nach dem Verschieben das alte (jetzt doppelte) Overlay entfernen und
per `grep -c` auf genau 1 Instanz prüfen.

## Typografische Anführungszeichen im JSX-Attribut-String (v11.23)

`sub="… im Menü „Statusleiste""` brach den Build: das `"` nach „Statusleiste"
beendete den JSX-Attribut-String vorzeitig (Parser: Expected ">" but found ")").
**Lehre:** Anführungszeichen INNERHALB eines doppelt-gequoteten JSX-Attributs
kollidieren. Fix: Attribut als JS-Ausdruck `sub={"… „Statusleiste""}` mit
typografischem Schluss-Quote `"`, oder Klammer-Ausdruck. In JSX-TEXT (zwischen
Tags) ist `"` dagegen unkritisch.

## Unterbrochene minWidth:0-Kette → Content überdeckt statt schiebt (v11.37–v11.41)

Seiten-Kalender (Dock, 340px, Flex-Kind) überdeckte den Content statt ihn zu
schieben; in anderen Fällen quetschte der Master-Detail die Spalten (Text Wort
für Wort senkrecht). Ursache: Ein Flex-Item kann nur unter seine Inhaltsbreite
schrumpfen, wenn `minWidth:0` gesetzt ist — fehlt es an EINEM Glied der Kette
(contentRef → Screen-Wurzel → mdRef-Container), misst der Master-Detail die volle
statt der reduzierten Breite. **Lehre:** Bei „Flex-Kind überdeckt/quetscht"
IMMER die GANZE Kette von Containern auf `minWidth:0` prüfen, nicht nur den
sichtbaren. Verifikation: `grep "ref={mdRef}"` + je Treffer 2 Folgezeilen auf
`minWidth: 0` prüfen (alle Treffer müssen ok sein).

## Master-Detail-Schwelle: gedehnte cardWidth zu streng (v11.43)

Erste Detail-Vorrang-Logik nutzte als Listen-Mindestbreite die gemessene
`cardWidth` — die im Mehrspalten-Fall größer als die echte Mindest-Kartenbreite
sein kann. Folge: Es sprang zu früh auf Nur-Detail und blähte das Detail auf
volle Breite, obwohl eine (schmalere) Listenspalte noch gepasst hätte.
**Lehre:** Umschalt-Schwellen an die MINDEST-Kartenbreite (Festwert ~260)
koppeln, nicht an die gedehnte Laufzeit-cardWidth.

## Layout weiterhin nicht in JSDOM messbar — Screenshot-Schleife (v11.37–v11.46)

Bestätigt die v11.16-Lehre erneut: Flexbox-Aufteilung, „schiebt vs. überdeckt",
50:50 vs. Detail-Vorrang sind in JSDOM NICHT sichtbar (alle Rects gestubbt). Der
Mount-Test liefert nur ERR=0 / DOM-Zahl, kein Layout. **Vorgehen:** Strukturell
fixen (minWidth-Kette, Schwellen-Konstanten), dann per echtem Gerät-Screenshot
verifizieren und iterieren. Nicht im JSDOM „raten".

---

## Lehren v11.47–v11.55 (15.06.2026)

### Icon-Namen IMMER gegen `IC` prüfen
`I({name})` macht `const path = IC[name]; if (!path) return null;` — ein
unbekannter Icon-Name rendert STILL nichts (kein Fehler, kein Build-Bruch). 5
Zurück-Buttons nutzten `chevron-left`, das nicht in `IC` existiert → unsichtbarer
Pfeil über Wochen. **Vor jedem neuen `<I name="…">` den Namen in `IC` prüfen.**

### Doppel-Clamp-Falle bei Slider-Grenzen
Ein Slider-Max zu erhöhen reicht oft NICHT: Werte werden häufig an ZWEI Stellen
geklemmt — am Slider selbst UND beim zentralen Durchreichen
(`const x = Math.min(ALT, settings.x)`). Beide grep-en (`Math.min(<altwert>`)
und gemeinsam anheben, sonst bleibt die Anzeige am alten Limit hängen.

### sed mit `||` im Pattern
`sed 's|…(a || b)…|…|'` bricht, weil `|` das Trennzeichen ist
(`unknown option to 's'`). Bei Patterns mit `||`/`|` lieber Python
(`str.replace`) nutzen — exakt und ohne Sonderzeichen-Fallen.

### `1fr`-Grid-Spalten sprengen Master-Detail
In einem Flex-Master mit `flex:1 1 0%` können `gridTemplateColumns: repeat(n,1fr)`
NICHT unter ihre Inhaltsbreite schrumpfen → sie drücken das Detail über den Rand.
Fix: `flex:0 1 masterWidth` am Master UND `minmax(0,1fr)` statt `1fr`. Plus
`minWidth:0` an den Karten und `overflowWrap:anywhere` an Detail-Hüllen. (Galt
für den Einstellungen-Screen; Symptom war abgeschnittener Text rechts.)

### IIFE in JSX schleicht sich beim schnellen Bauen ein
Ein Slider mit `value={(() => {…})()}` verstößt gegen die Safari-Regel. Beim
Verschieben/Refactoren prüfen und durch `const`-Berechnung vor `return` ersetzen.
`grep '(() =>'` findet sie.

### Block-Löschung per `sed Nd,Md` — Pflicht-Checks danach
Migrations-Funktion (71 Zeilen) per `sed '3529,3599d'` gelöscht. Danach IMMER:
(1) grep auf den Funktionsnamen = 0, (2) Übergang der Nachbarzeilen sichten,
(3) Build (Klammerbalance), (4) Mount-Test ERR=0. Hier alles grün.

### Settings-Migration vs. generisches Merge
Handgepflegte „fehlende Felder ergänzen"-Migrationen sind überflüssig, wenn
`DEFAULT_SETTINGS` alle Felder vollständig hat: `Object.assign({}, DEFAULT_SETTINGS,
JSON.parse(raw))` deckt fehlende Felder generisch ab. ABER: gilt nur für
Felder-Ergänzung, NICHT für Format-Umrechnung (alte→neue Struktur) — die braucht
echte Migration (oder: Daten gleich im neuen Format liefern).

### Versionsnummern-Verwirrung bei vielen Zwischenständen
Bei mehreren `cp`-Hin-und-Her zwischen `/tmp/allesda_work.jsx`,
`/tmp/realbuild/` und `/mnt/user-data/outputs/` kann der Stand divergieren.
**Single Source of Truth:** immer `outputs/allesda_merged.jsx`. Vor jedem Build
`grep APP_VERSION` auf ALLE Kopien, abgleichen, dann erst bauen. Im Zweifel die
outputs-Datei als Master nehmen und Arbeitskopie daraus frisch ziehen.

### ID-Bereichs-Kollision bei großen Importdaten (Person vs. Firma)
Die Fake-Daten-Spec sieht „Personen 1–100, Firmen ab 101" vor. Beim Import von
16 echten Musterobjekten entstanden **312 Personen** — die Personen-IDs liefen in
den Firmen-Bereich (101+) und kollidierten: eine Firma und eine Person teilten
sich ID 101, das Dedup mischte sie. Symptom in der Validierung: Firmen-Eigentümer
„ohne besitz-Spiegel" (weil der besitz-Eintrag der gleich-ID-Person zugeschrieben
wurde).
**Regel:** Firmen-ID-Basis sicher ÜBER das erwartete Personen-Maximum legen
(hier 10001). Generell bei generierten Bezugs-IDs disjunkte Bereiche sicherstellen
und in der Validierung explizit prüfen: `set(personenIds) & set(firmenIds) == ∅`.

### Importdaten gegen die ECHTEN App-Funktionen testen, nicht nur Schema-Lint
Eine Einlese-Datei kann schema-valide sein und trotzdem in der App „tot" wirken,
wenn die datumsgesteuerte Status-/Termin-Logik nicht greift. Verlässlicher Test:
Footer-Export der relevanten Funktionen (`eigStatus`, `belegungsPhase`,
`sammleTermine`, `sammleHistorie`, `normalisiereVes`) → esbuild `--format=cjs
--platform=node --external:react` → Datei durchschicken und die ABGELEITETEN
Größen prüfen (Status-Verteilung, Phasen, Termin-Anzahl je Typ, Historie-Jahre).
So fällt z. B. auf, dass „werdend" nur über `geplant:true` ODER `von>heute`
entsteht — nicht über ein erfundenes Status-Feld.

### dokAnalysen/Zusatzfelder am `ve` überleben Normalisierung nur per Spread
`normalisiereVes` baut `{ ...ve, einheiten: … }` — der Spread erhält unbekannte
Felder (z. B. `ve.dokAnalysen`). Würde die Funktion ein neues Objekt-Literal mit
festen Keys bauen, gingen sie verloren. Beim Einlesen daher Zusatzfelder pro `ve`
spiegeln (nicht nur top-level), weil der Import-Callback nur `kontakte`+`ves`
übernimmt.

---

## Erkenntnisse Legionellen-Bau (v11.66 → 11.71)

### Vor dem Bauen prüfen, ob die Funktion schon (halb) existiert
In 11.66 waren Legionellen-Helfer + `LegionellenFeldInhalt`-Komponente bereits
angelegt, aber **unverdrahtet** (`istLegionellen` definiert, nie verwendet). Vor
einem vermeintlichen Neubau immer per `grep -n "Begriff"` den IST-Stand über die
ganze Datei prüfen — sonst baut man Doppeltes oder übersieht eine fast fertige
Funktion. Symptom „definiert aber nie verwendet" = Render-Verdrahtung fehlt.

### esbuild escaped Umlaute → grep auf Literale schlägt fehl
`--minify` wandelt „ü/ö/ä/ß" in `\u00fc` etc. um. `grep -c "Verknüpfung"` gibt
dann fälschlich 0, obwohl der String drin ist. **Verifikation deshalb über ASCII-
Fragmente** (`grep -c "rkn.*pfung"`) oder die Escape-Sequenz. Strings ohne
Umlaute (z. B. „Turnus nach TrinkwV", „Nachprobe ok") sind direkt grepbar und als
Anker geeignet.

### Stamm-Felder werden nicht von jeder Karte gerendert
`TechnikKarte` rendert NICHT `karte.stamm` (nur Geräte). Die alten
„Heizart"/„Heizungstyp"-Stammfelder waren faktisch unsichtbar. Lehre: Bevor man
ein Steuerfeld ins `stamm`-Array legt und erwartet, dass es erscheint, prüfen ob
die zuständige Karten-Komponente das Array überhaupt anzeigt. Lösung hier: der
Warmwasser-Schalter wird direkt im `TechnikKarte`-Body gerendert (liest/schreibt
das stamm-Feld über `onUpdateKarte`), nicht über die generische FieldList.

### Mount-Test-Harness: niedrige Knotenzahl ≠ App-Fehler
Nach Filesystem-Reset neu gebautes `mounttest.js` seedet keine Mock-Daten wie die
Referenz → DOM-Knoten ~748 statt ~123.860, „RESULT: FAIL". Solange **ERR=0** und
die Shell (`ad-root-desktop`) rendert, ist das ein Harness-Artefakt, kein
Regress. Aussagekräftig sind: ERR=0, React-Import=0, und gezielte Unit-Tests der
neuen Logik (isoliert, ohne JSDOM).

### Prüfpflicht-Ableitung: expliziter Schalter vor Geräte-Heuristik
Eine abgeleitete Sichtbarkeit (aus Geräten) ist fragil, wenn der Nutzer kein
Gerät erfasst. Robust: explizites Stammfeld mit Vorrang, Geräte-Ableitung nur als
Fallback. Mit Unit-Test absichern, dass „Dezentral" auch ein vorhandenes
zentrales Gerät übersteuert (6/6 Fälle).

### Zwei Unit-Test-Muster für reine Logik (ohne JSDOM)
Reine Helfer (`objektHatZentralesWarmwasser`, `legionellenAnsprechpartner`) lassen
sich 1:1 in ein eigenständiges Node-Script kopieren und mit Fall-Tabellen prüfen
(erwartet/ist). Schnell, deterministisch, deckt Kanten ab (Mix-Fälle, leere
Werte, unbekannte IDs). Ergänzt den Mount-Test, ersetzt ihn nicht.

---

## Baustein-Zerlegung (Strang A, ab v11.73)

### Grundregel: Schnitt und Verschlanken TRENNEN
Modul erst 1:1 mechanisch rausziehen (kein Verhalten ändern), in eigener Etappe
verschlanken/zusammenziehen. Sonst ist bei einem Build-Fehler nicht trennbar, ob
Schnitt oder Optimierung schuld ist — bei 33k Zeilen ohne Layout-Feedback fatal.

### Box-Kommentar-Sektionen ≠ echte Abhängigkeiten ⚠️
Die `╔ SEKTION n ╗`-Boxen sind grobe Gliederung, NICHT die Schichtung. Gemessen:
„Datenmodell" (S2) braucht aus „Utils" (S3) `splitPlzOrt`/`isoHeute`(9×)/`zuIsoDatum`,
und `isoHeute`/`zuIsoDatum` sind sogar erst in S5 (Z.7067) definiert. `eigStatus`
gehört fachlich in S2, steht aber in S5. **Vor jedem Sektions-Schnitt die echten
Cross-Refs messen, nicht der Box trauen.** Konsequenz: erst Blatt-Utils über ALLE
Sektionen einsammeln, dann Domänen-Module — nie umgekehrt.

### Verfahren je Schnitt (Checkliste)
1. **Zyklus-Analyse:** Definiert das Modul etwas, das nur „nach oben" zeigt? Prüfe
   per Skript, ob jeder Funktionskörper nur Builtins + andere Modul-Member ruft
   (LEAF) oder App-interne Defs (DEP). Nur LEAF-Cluster oder solche, deren Deps
   schon Module sind, sind schnittreif.
2. **Extrahieren:** `export` vor Top-Level `function`/`const`. `let`-State + `_MOCK`-
   artige Init-Konstanten NICHT exportieren (modul-intern, von Funktionen geteilt).
3. **Import in merged:** nur die TATSÄCHLICH genutzten Namen (grep-Count außer
   Import-Zeile); intern-genutzte gar nicht importieren.
4. **Build** → React-Import=0 → **Mount gegen Referenz 740/ERR=0** →
   Doppeldefinition-Check (kein S-Name mehr als Top-Level in merged).
5. **Isolierte Unit-Tests** der extrahierten Logik per `.mjs` (ESM-Import direkt aus
   dem neuen Modul) — echte Funktionsprüfung, nicht nur Mount.

### Referenz-Mount: 740 Knoten, ERR=0
`mountref.js` rendert nur die Shell (Mock-Daten füllen erst per Navigation) → ~740
DOM-Knoten. Der ABSOLUTWERT ist egal, die **Konstanz** über Schnitte hinweg beweist
„nichts verändert". ERR=0 ist das harte Kriterium.

### Stand-Falle beim Schneiden (iCloud)
`/mnt/project` kann hinterherhinken. Beim Schnitt 1 wäre fast der 11.72-Legionellen-
Fix verloren gegangen, weil die Projektkopie noch 11.71 war. IMMER vom echten Stand
in `/mnt/user-data/outputs` ausgehen (per `diff`/`grep APP_VERSION` gegenchecken).

### GitHub-Upload bleibt EINE Datei
esbuild bündelt alle Quell-Module zu EINER `AllesDa.js`. Trotz mehrerer Quelldateien
lädt GitHub Pages nur `AllesDa.js` (+ unverändertes index.html). Die Modul-Struktur
existiert nur in der Quelle, nicht im Deploy.

---

## Zerlegung Fortschritt (17.06.2026, v11.74) — datenmodell / utils-icons / components

**Stand der Module (Schicht-Reihenfolge, jede zeigt nach unten):**
`constants.js` → `utils-basis.js` → `datenmodell.js` → `utils-icons.jsx` →
`components.jsx` → `allesda_merged.jsx` (Rest: S5 Liegenschaft, S7 Kontakte,
S8 Einstellungen, S9 App). Mount-Referenz dieser Session: **748 Knoten, ERR=0**.

### Schnitt datenmodell.js (S2 + eigStatus-Trio + Migrations-Cluster)
- S2 (Z.124–1691) + `EIG_STATUS`/`eigStatus`/`laufenderEigWechsel` (vormals S5) →
  `datenmodell.js`. Kein JSX → `.js` korrekt.
- **Falle: Funktions-Referenz OHNE Klammern wird vom Call-Scan übersehen.**
  Erster Mount brach mit `migriereKontaktZuweisungen is not defined`. Grund:
  `buildMockData` nutzt sie als Wert (`.map(migriereKontaktZuweisungen)`), nicht
  als Aufruf `name(`. Der grep `name(` fand sie nicht. **Beim Cross-Ref-Messen
  auch klammernlose Referenzen prüfen** (`.map(fn)`, Callbacks, Zuweisungen,
  JSX `<Comp/>`).
- **Wurzel-Fix statt Workaround:** Der ganze Migrations-Cluster (`slotFuerRolle`,
  `klassifiziereZuweisung`, `mappeMiteigentuemer`, `migriereKontaktZuweisungen`)
  zog mit nach datenmodell.js — er ist fachlich Mock-Migration und hängt nur an
  `DEFAULT_ROLLEN` (bereits importiert). Damit kein zirkulärer Top-Level-Aufruf:
  `_MOCK = buildMockData()` läuft beim Modul-Init und ruft jetzt eine Funktion
  IN DERSELBEN Datei. (`migriereZuweisungen` blieb in merged, importiert nun
  `migriereKontaktZuweisungen` aus datenmodell.)

### Schnitt utils-icons.jsx (S3)
- S3 (Icon-System `IC`/`I`, 19 React-Contexts, Helfer-Komponenten) → eigenes Modul.
- **0 echte Vorwärts-Refs** — die 10 grep-Treffer auf nach-S3-Defs standen ALLE
  nur in Kommentaren. Verifikation: Kommentare per `sed 's|//.*$||'` strippen,
  DANN grep. Reiner Code = sauber → kein Zyklus.
- **`.jsx` statt `.js` Pflicht bei JSX-Modulen.** Erster Build: „JSX syntax
  extension is not currently enabled … loader set to js“. Module mit Komponenten
  (`<div>`) MÜSSEN `.jsx` heißen, damit der unveränderte Build-Befehl
  (`--loader:.jsx=jsx`) sie parst. Faustregel: **Datenmodell/Utils ohne Markup →
  `.js`; alles mit Komponenten → `.jsx`.** Import-Pfad in merged entsprechend
  (`./utils-icons.jsx`).

### Schnitt components.jsx (S4) — ZYKLISCHER Import (erlaubt!)
- S4 (UI-Bausteine, 59 Defs) → `components.jsx`.
- **Echter Zyklus S4↔S5, aber laufzeit-tolerant.** S4 nutzt 10 Dinge aus S5/S7
  (`KontaktKarte`, `KontaktDetailKarte`, `ObjektPicker`, `AktionsButton`,
  `FeldObjektKarte` + Mini-Helfer `eigStufen`/`feldImKalender`/`isoKW`/
  `istFristFeldName`/`quoteLabel`). Messung zeigte: ALLE 10 feuern nur zur
  Laufzeit (JSX-Returns/Callbacks), NIE beim Modul-Init.
- **Freigabe-Bedingung für zyklischen Import:** kein Ref beim Modul-Init. Dann
  löst esbuild den Kreis korrekt auf. Test: `grep` auf Top-Level-Aufrufe
  (`^const x = NAME(` / `^NAME(`) muss leer sein.
- **Mechanik:** `components.jsx` importiert die 10 aus `./allesda_merged.jsx`;
  die Hauptdatei stellt sie per `export { ... }` am Dateiende bereit (ZUSÄTZLICH
  zum `export default App`). Beide Dateien importieren sich → 1 Import je Richtung.
- **Warum NICHT die 10 mitnehmen (Weg 2 verworfen):** Messung der Kaskade ergab,
  dass die 5 großen Komponenten (`KontaktDetailKarte` allein 621 Z.) 24 weitere
  S5/S7-Defs nachziehen — und die wieder weitere. Keine saubere Stopp-Grenze →
  hätte halb das Kontakt-Modul mitgezogen. Der Zyklus ist die ehrlichere Lösung;
  er löst sich automatisch auf, sobald S5/S7 zerlegt sind (die 10 zeigen dann in
  echte Module statt in merged).
- **React-Import pro JSX-Modul NEU messen.** Erster Mount brach mit
  `createContext is not defined` — nicht der Zyklus, ein vergessener React-Import.
  S4 braucht `useState/useRef/useEffect/useContext/createContext/Fragment`.
  **Nie den React-Header vom letzten Schnitt kopieren** — pro Modul grep auf die
  tatsächlich genutzten Hooks/APIs.

### Verwaiste Box-Rahmen nach Schnitten
Wird ein S-Block durch eine Import-Zeile ersetzt, können `╔`/`╚`-Box-Kanten der
Nachbar-Sektion verwaisen (Oberkante über dem Import, Header weg). Rein kosmetisch
(Build läuft), aber beim nächsten Schnitt mit aufräumen.

## S5-Zerlegung in 4 thematische Module (17.06.2026, v11.75)
S5 war kein Schichtenmodell, sondern ein dichtes Netz (~13.5k Z.: Liegenschaft +
Kalender + Statistik + TE + Legionellen + Kontakt-Kategorien + Suche). Zerlegt in
`kalender.jsx`, `objektansicht.jsx`, `kontakte.jsx`, `suche.jsx`. merged: 24.441 →
17.850 Z. Drei harte Lehren:

### 1. Importscan VOR dem ersten Build — über ALLE Module, nicht nur intern
Beim 1. Schnitt (kalender) nur S5-intern gemessen → Mount-Test warf
`eigStatus is not defined`; es fehlten datenmodell-Helfer (7 Namen), der komplette
utils-icons-Header (9) und einzelne component-Importe. **Fix-Methode:** für JEDES
bestehende Modul (constants, utils-basis, datenmodell, utils-icons, components,
und schon ausgelagerte Geschwister-Module) dessen Export-Liste gegen den Block-Body
grep'en — was der Block nutzt UND nicht selbst definiert = Importbedarf. Ab dem
2. Schnitt so vorgezogen → jeweils **erster Build grün** (statt Fehlerschleife).

```bash
# Pro Modul: Exporte sammeln (export-block + einzel-exports), gegen Block-Body prüfen
blk=$(sed -n "/^export {/,\$p" "$f")
defs=$(grep -oE "export (const|function|let|var) [A-Za-z_]+" "$f" | awk "{print \$3}")
exports=$( (echo "$blk" | tr ",{}" "\n" | sed "s/export//;s/ //g" | grep -vE "^$|from|\""; echo "$defs") | sort -u)
for name in $exports; do
  grep -qwE "$name" /tmp/block_body.txt && ! echo "$owndefs" | grep -qx "$name" && echo "$name"
done
```

### 2. Selbst-Import-Falle
Ein Name, der IM Block definiert ist, darf nicht im merged-Import-Header des neuen
Moduls stehen (sonst „importiert sich selbst" / Doppel-Binding). Passierte mit
`FilterButtons` (lokal in objektansicht definiert, aber vom Scan als „genutzt"
gefunden, weil auch lokal referenziert). **Check:** jeden geplanten merged-Import
gegen die Block-eigenen Defs gegenprüfen, `lokal=0` muss gelten.

### 3. Umhäng-Kaskade
Wandert Name X von merged in Modul M, müssen ALLE anderen Module, die X bisher aus
merged importierten, auf M umgehängt werden — sonst „No matching export in
allesda_merged.jsx for import X". Betroffen u. a.: `isoKW`/`sammleTermine`/
`KALENDER_TYPEN` (→kalender), `alleEinheitenVonVe`/Stat-Namen/`FeldObjektKarte`
(→objektansicht), `objektBezugInfo`/`VEKontakteTab` (→kontakte). Gleichzeitig:
merged muss die vom neuen Modul ZYKLISCH benötigten Kern-Namen NEU exportieren
(z. B. `KARTEN_ICONS`, `KontaktZuweisungForm`, die Ansicht-Komponenten).

### Verfahren-Reihenfolge pro Schnitt (bewährt)
1. Block-Grenzen auf saubere Kommentarköpfe ausrichten; `{}`-Balance = 0 prüfen
   (`()`/`[]`-Differenz ist String/Regex-Rauschen, ignorieren).
2. Vollständiger Importscan (oben) → Header bauen.
3. Block extrahieren, Header + `export {…}` anhängen → neues Modul.
4. Block aus merged löschen (`sed -i 'A,Bd'`), Import-Zeile + ggf. Re-Exports rein.
5. Umhäng-Kaskade in Geschwister-Modulen.
6. Build → React=0 → Mount 748/ERR=0 → Doppel-Def-Check (jeder Name genau 1×).

### Zyklen-Stand
merged ⇄ {components, kalender, objektansicht, kontakte, suche, listen-tools};
Quer-Zyklen kalender↔objektansicht↔kontakte, components→{kalender,objektansicht}.
Alle Laufzeit-Refs (JSX/Callbacks) → esbuild löst auf. KEINE Modul-Init-Refs.

## Fehlender Import → schwarzer Bildschirm beim Vertrag-Bearbeiten (20.06.2026, v11.90)
**Symptom:** Klick auf „Vertrag bearbeiten" (Einzelvertrag in der Verwaltung-Ansicht, VertragForm)
→ Bildschirm wird schwarz. Beim NEU-Anlegen ohne Firma trat es NICHT auf.

**Wurzel (bekannte Klasse):** `VertragForm` (in `liegenschaft.jsx`) ruft `getFirmaMitarbeiter(firmaIdNum, kontakte)`
auf, um die Mitarbeiter der verknüpften Firma zu listen. Die Funktion wird aus `kontakte-modul.jsx`
exportiert, war in `liegenschaft.jsx` aber **nicht importiert**. `esbuild --bundle` lässt den fehlenden
Import still als (nicht existentes) Global durch → Laufzeit-Crash `getFirmaMitarbeiter is not defined`,
sobald die Komponente MIT gesetzter `firmaId` rendert. Der Aufruf hängt an `firmaIdNum ? getFirmaMitarbeiter(...) : []`
— deshalb crashte nur das BEARBEITEN eines bestehenden Vertrags (Firma gesetzt), nicht das Neu-Anlegen.

**Fix:** `getFirmaMitarbeiter` zum `from "./kontakte-modul.jsx"`-Import in `liegenschaft.jsx` ergänzt.

**Lehre (bestätigt erneut):** Der EINZIGE Test, der das fängt, ist der **isolierte Mit-Daten-Render**
der Schlüsselkomponente MIT GESETZTEM auslösenden State. Erster Probe-Lauf mit `initial:null` (keine Firma)
ergab fälschlich ERR=0 — erst `initial:{ firmaId: <echte Firma> }` reproduzierte den Crash. Bei BEDINGTEN
Crash-Pfaden (hier: nur bei gesetzter Firma) muss der auslösende State im Render-Test gesetzt werden,
sonst bleibt der Pfad ungetestet.
