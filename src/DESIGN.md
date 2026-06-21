# AllesDa — Design-System

Dieses Dokument hält die Layout-, Komponenten- und Verhaltens-Patterns von AllesDa fest. **Vor jeder UI-Änderung lesen.** Neue Bausteine orientieren sich an diesen Regeln; Abweichungen müssen begründet sein.

Stand: 17. Juni 2026 · bezogen auf modulare Quelle (APP_VERSION 11.75, index.html unverändert). UI diese Session unverändert (reines Struktur-Refactoring: S5 in kalender/objektansicht/kontakte/suche zerlegt).

-----

## 0. Stack & Datei-Aufbau

- **Frontend**: React (Hooks, Function Components) als single-file JSX (`allesda_merged.jsx`).
- **Build**: `esbuild mount.jsx --bundle --format=iife --minify --loader:.jsx=jsx --outfile=AllesDa.js` (mount.jsx importiert `./allesda_merged.jsx`; keine Shim-Aliase). Verifikation: jsdom-Render-Test + isolierte Logik-Tests, nicht nur Bundle-Init.
- **Persistence**: `localStorage` über einen gekapselten `storage`-Layer, JSON-Export/Import als manuelles Backup.
- **Keine externen UI-Libraries** — alle Komponenten sind inline mit `style={{ ... }}` gestylt.
- **Icons**: Heroicons-Pfade in `IC`-Map, gerendert über die `I`-Komponente (`<I name="building" size={18} color={accent}/>`).
- **Font**: „Plus Jakarta Sans” via Google Fonts (Konstante `FONT_URL` / `FONT`).

Die Datei ist in 9 Sektionen gegliedert (siehe Inhaltsverzeichnis am Datei-Kopf). Reihenfolge nicht ändern — Komponenten weiter unten verlassen sich auf Definitionen weiter oben.

-----

## 1. Layout-Architektur

### 1.1 Container-Hierarchie

Die App nutzt **internes Scrolling** — das Browser-Window scrollt nie. Alle scrollenden Bereiche sind dedizierte Container.

```
<Outer (dvh, zoom=dichte, overflow:hidden, flex column)>
  <App-Header (sticky top:0, zIndex:50)>
    [Logo · Filter|HV-Name · Suche · 🌙 · ⚙/Avatar]
    [KategorieKacheln — nur Mobile + dashboardSticky]
  </App-Header>

  <Hauptbereich (flex:1, minHeight:0, display:flex)>
    <Sidebar (Desktop ≥900px, eigener overflowY:auto)>
      [Dashboard-Kacheln · Drag-Handle]
    </Sidebar>

    <Content (flex:1, minWidth:0, overflow:hidden, flex column)>
      <Wrapper (margin:0 auto, padding:0 10px, width:100%, flex:1, flex column)>
        <ref={contentRef} (flex:1, flex column)>
          <StickySectionHeader (top:0)>
            [Titel · Filter · Aktions-Button]
          </StickySectionHeader>
          {Screen-Inhalt — Master-Detail oder Grid}
        </ref>
      </Wrapper>
    </Content>
  </Hauptbereich>
</Outer>
```

### 1.2 Goldene Regel

> **Das Window scrollt nie.** Outer-Container hat `height: dvh; overflow: hidden;`. Wenn etwas scrollt, scrollt es intern in einem eigenen Container mit `overflowY: auto`.

`dvh` statt `vh` ist Pflicht — iOS Safari rechnet die URL-Bar in `100vh` ein, dadurch würde Inhalt unten abgeschnitten, wenn die Bar sichtbar wird.

### 1.3 Dichte-Skalierung (zoom)

Die Settings-Option `dichte` (`compact` / `normal` / `relaxed`) wird über CSS-`zoom` auf den Outer-Container gelegt. Damit nach der Skalierung wieder genau ein Viewport voll bleibt, wird die Container-Größe gegenkompensiert:

```js
const DICHTE_MULT = { compact: 0.9, normal: 1.0, relaxed: 1.18 };
const dichteMult = DICHTE_MULT[settings.dichte] || 1.0;

// Outer:
height: `${100/dichteMult}dvh`,
width:  `${100/dichteMult}vw`,
zoom: dichteMult,
```

### 1.4 Spacing-Konvention

**Alle Abstände sind 10 px** — überall:

- Content-Wrapper `padding: 0 10px`
- Grid-Gap zwischen Karten: **10 px**
- Master-Detail Spalten-Gap: **10 px**

Begründung: Symmetrie. Karte zum Bildschirmrand = gleicher Abstand wie Karte zur Nachbarkarte.

Ausnahme: Sidebar-interne Listen verwenden `gap: 4` (sehr eng, da sehr kompakte Buttons), Sektions-Listen in Einstellungen `gap: 8`.

### 1.5 Keine feste Maximalbreite

Anders als in früheren Versionen gibt es **kein `maxWidth: 1600`** mehr. Der Content nutzt die volle verfügbare Breite (Viewport minus Sidebar). Master-Detail-Layouts verteilen den Platz selbst über `useMasterDetailLayout`.

-----

## 2. Sticky-Header-System

Zwei Header kleben übereinander:

1. **App-Header** (oben, `sticky top:0, zIndex:50`)
1. **StickySectionHeader** (klebt am Top des Content-Wrappers)

### 2.1 CSS-Variablen

Beide Header messen sich selbst per `ResizeObserver` und exponieren ihre Höhe als CSS-Variable:

|Variable        |Bedeutung               |Wer setzt sie         |
|----------------|------------------------|----------------------|
|`--ad-header-h` |Höhe des App-Headers    |App-Header `useEffect`|
|`--ad-section-h`|Höhe des Section-Headers|`StickySectionHeader` |

Diese Variablen werden u. a. für `scrollMarginTop` an Karten gebraucht, damit `scrollIntoView` die Karte unter dem Header platziert.

### 2.2 App-Header — schmal vs. breit

Der App-Header misst sich selbst und schaltet bei **880 px** zwischen zwei Layouts um (`headerBreit`-State):

- **schmal (< 880 px)**: zwei Zeilen
  - Zeile 1: Logo · (Filter | HV-Name) · Dunkelmodus + Avatar
  - Zeile 2: Suche (volle Breite)
- **breit (≥ 880 px)**: eine Zeile
  - Logo · (Filter | HV-Name) · Suche · Dunkelmodus · Avatar

Das Logo ist **„Alles” (in `t.text`) + „Da” (in `ACCENT`)**, `fontWeight:800, fontSize:18, letterSpacing:-0.03em`.

### 2.3 StickySectionHeader-Komponente

Verfügbar als `<StickySectionHeader t={t} accent={ACCENT}>`. Pattern:

```jsx
<StickySectionHeader t={t} accent={ACCENT}>
  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
    <div style={{ fontSize: 20, fontWeight: 800, flexShrink: 0, ... }}>
      Titel
    </div>
    <FilterButtons ... />        {/* flex: 0 1 auto */}
    <button style={{ marginLeft: "auto", ...buttonStyle }}>
      <I name="plus" />
    </button>
  </div>
</StickySectionHeader>
```

### 2.4 Section-Header-Werte (verbindlich)

```js
position: "sticky",
top: 0,                   // klebt am Content-Top (der Wrapper scrollt intern)
background: t.bg,
zIndex: 5,
paddingTop: 8, paddingBottom: 6,
marginBottom: 2,
whiteSpace: "nowrap",     // verhindert Höhensprünge bei Wrap
```

### 2.5 Aktions-Button im Header

Standard: **36×36 px rund**, Accent-farbig.

```js
{
  width: 36, height: 36,
  flexShrink: 0,
  marginLeft: "auto",     // pusht ganz rechts
  background: ACCENT,
  border: "none",
  borderRadius: 999,
  boxShadow: `0 1px 2px ${ACCENT}40`,
}
```

Bei „Bearbeiten-Modus aktiv”: `background: ACCENT + "22"`, `boxShadow: inset 0 0 0 1.5px ${ACCENT}`, Icon-Farbe = ACCENT.

-----

### 2.6 Button-System (Aktions-Rollen) — SSoT `AktionsButton`

Vier Aktions-Rollen mit fester Farb-Semantik. **Eine Farbe = eine Bedeutung:**

|Rolle        |Bedeutung                   |Hintergrund (Ruhe)             |Icon                    |Confirm-Zustand                           |
|-------------|----------------------------|-------------------------------|------------------------|------------------------------------------|
|`bestaetigen`|vorwärts / speichern        |Akzent/Kontakt getönt (`+"15"`)|`check`, Akzentfarbe    |— (disabled → transparent, Icon `t.muted`)|
|`abbrechen`  |folgenlos zurück            |neutral getönt                 |`x`, **grau** (`t.sub`) |—                                         |
|`loesen`     |Verbindung lösen (umkehrbar)|neutral                        |`x`, **rot** (`#EF4444`)|**Amber** gefüllt (`#F59E0B`), Icon weiß  |
|`loeschen`   |endgültig entfernen         |neutral/getönt                 |`trash`, **rot**        |**Rot** gefüllt (`#EF4444`), Icon weiß    |

**Merksatz:** Akzent = vorwärts · Grau = folgenlos · **Amber = umkehrbar wegnehmen** · **Rot = endgültig wegnehmen**.

**Verbindlich:**

- Abbrechen ist **nie rot** — Rot ist für „wegnehmen” reserviert. Ein graues X.
- `loesen` und `loeschen` tragen beide ein rotes Icon, unterscheiden sich aber im Icon (`x` vs. `trash`) **und** im Confirm (Amber vs. Rot).
- Der runde Ruhe-Hintergrund darf in Kontakt-/Akzentfarbe getönt sein (z. B. Edit-Header der Kontaktkarte); die *Bedeutung* steckt im Icon und im Confirm-Zustand, nicht im Hintergrund.
- Inline-Entfernen (Tel/Mail/Feld/Raum/Gewerk) entfernt **ohne** Confirm (rotes X, sofort). Das ist bewusst — kleine, leicht wiederherstellbare Einträge.
- „Zurücksetzen”-Aktionen (Einstellungen/Demo-Daten) sind **neutral**, nicht rot — sie stellen einen Standard wieder her, sie löschen nichts endgültig.

**Komponente:** `AktionsButton({ rolle, onClick, farbe, confirm, label, disabled, size, title, t, accent, variante, text, icon, flex })`
definiert in `allesda_merged.jsx` direkt vor `ZeilenAktionen`. **SSoT für alle Aktions-Buttons.**

**Zwei Varianten:**

- `variante="rund"` (Default) — kompakte Icon-Buttons (36px, rund). Edit-Header der Kontaktkarte. Props: `farbe` (Tönung), `confirm`, `label` (Text neben Icon im Confirm), `size`.
- `variante="breit"` — Formular-Abschluss-Buttons (Text, radius 8, `flex`-fähig). Abschlussleisten in Modals und Formularen. Props: `text` (Button-Text), `icon` (bool, Icon zeigen), `flex` (Breitenverteilung). `bestaetigen` ist hier **voll gefüllt** (Akzent + Kontrast-Text), nicht nur getönt.

**Confirm-Regel (Schwelle):**

- **Zwei-Klick-Confirm** (Button wird „scharf”: Amber bei `loesen`, Rot bei `loeschen`, Label wechselt zu „Wirklich …?”) immer dann, wenn die Aktion eine **ganze Entität** oder schwer wiederherstellbare Daten entfernt: Kontakt, Objekt, Vertrag, Rollen-/Objekt-Zuweisung.
- **Sofort, kein Confirm** nur bei **kleinen, leicht wieder eintippbaren Listeneinträgen**: eine Telefonnummer, E-Mail, ein Custom-Feld, ein Raum, ein Gewerk. Rotes X, ein Klick.

**Bewusste Ausnahmen (folgen der Semantik, nicht der Form):**

- `ZeilenAktionen` (vertikale 28px-Buttons neben Listen-Karten) bleiben **eckig** (radius 6) — dichter Listen-Kontext, wo kompakt besser ist. Gleiche Farb-Semantik (rotes X + Amber-Confirm = lösen, roter Papierkorb + Rot-Confirm = löschen).
- Das **Segment-Control** im Kontakt-Picker-Dropdown („Abbrechen | + Neu anlegen”) ist kein Abschluss-Button, sondern ein nahtloses Zwei-Segment-Control mit Trennlinie — kein `AktionsButton`.
- „Zurücksetzen”/„Auf Demo zurücksetzen” (Einstellungen): **neutral**, kein Rot — stellt einen Standard wieder her.

**Anordnung (ab v5.71):** Edit-Header = **Papierkorb · X(Abbrechen) · Haken**. `ZeilenAktionen` = **Stift · Papierkorb(Löschen) · X(Lösen)**. Der Stift (Bearbeiten) steht vorn, da nicht destruktiv. Haken-Button im Ruhezustand getönt + voll deckend (Icon `t.sub`, wie das X), bei Änderung voll gefüllt.

**Button-Form (ab v9.81, verbindlich):** Text-Buttons (Toggles, Auswahl-Pills, Aktionen) haben **abgerundete Ecken** — `RAD.sm`/`RAD.ms` (Auswahl/Toggle in Einstellungen: `RAD.ms`, padding ~6px 12px), Container-Gruppen `RAD.md`. **NIEMALS `RAD.full` (= 50 % → Ellipse/„Ei") an Text-Buttons** — das bricht die systemweite Ecken-Optik. `RAD.full` ist ausschließlich für echte Kreise (width === height: Avatare, Farb-Punkte, Fotos); `RAD.pill` (999) nur für die etablierten runden Icon-Buttons (36 px) und FilterButtons-Chips, nicht für neue Text-Buttons.

-----

### 2.7 Rolle / Gewerk / Leistung — Auflösung über Liste, nicht Feldname

`objektZuweisungen[]` (auf jedem Kontakt) nutzt **einheitlich das Feld `rolle`** — auch bei Firmen. Die *Bedeutung* ergibt sich aus Kontakttyp und Bezug, nicht aus dem Feldnamen (bewusste Architektur-Entscheidung „Modell 2”):

- **Person** → `rolle` gegen `settings.rollen` (Eigentümer, Mieter, Beirat …).
- **Firma, Objekt-Zuweisung** (`objektId` gesetzt) → `rolle` = **Leistung**, gegen `settings.leistungen` (Hausverwaltung, Wartung, Reinigung …).
- **Firma, Anstellung** (`firmaId` gesetzt) → Personen-Rolle in der Firma (GF, Mitarbeiter …).
- **Gewerk** (was die Firma *ist/kann*: Sanitär, Elektro …) lebt an der Firma selbst (`firma.gewerke`), **nicht** in `objektZuweisungen`. Quelle: `settings.firmenRollen` / `DEFAULT_GEWERKE_LISTE`.

**Auflösungs-Kette** (z. B. `RolleBadge`, `RolleZeile`): personenRollen → leistungen → firmenRollen, jeweils erster Treffer.

**INVARIANTE (verbindlich):** Die drei Vokabulare `DEFAULT_ROLLEN`, `DEFAULT_LEISTUNGEN`, `DEFAULT_GEWERKE_LISTE` müssen **disjunkt** bleiben (kein Name in zwei Listen). Nur so ist die namensbasierte Auflösung eindeutig. Vor dem Aufnehmen eines neuen Namens prüfen, dass er in den anderen beiden Listen nicht vorkommt. (Stand heute: vollständig disjunkt, verifiziert.)

Editoren: `BeziehungEditor` ist der **einzige** aktive Editor für Zuweisungen (ersetzt die gelöschten `RolleEditor` + `ObjektZuweisungEditor`). Bei Firma + Zuständigkeit wählt er aus `leistungen`.

### 2.8 Popover-Regel (ab v9.82, verbindlich)

JEDES schwebende Popover (Dropdown, Picker, Menü) MUSS bei Klick außerhalb
schließen. Immer den SSoT-Hook `useOutsideClick(ref, onClose, offen)` verwenden;
`ref` umfasst Trigger-Button UND Popover (contains-Check verhindert
Toggle-Konflikt). Modals schließen via Backdrop-onClick + `stopPropagation`
innen. Umgesetzt u. a.: HeaderFilterDropdown, FilterDropdown, Gruppen-Sortmenü,
IconPicker (3×), Lösch-Confirm.

### 2.9 Keine dekorativen Pfeile/Chevrons (ab v10.26, verbindlich)

KEINE Chevron-Pfeile als Auf/Zu-Klapp-Indikator an Karten/Legenden und KEINE
Pfeile an Text-/Sprung-/Footer-Buttons („Einstellen", „Zum Objekt/Kontakt",
„Vollständiges Objekt" …). Aufklappen erfolgt durch Klick auf den gesamten Kopf
(`div onClick`, `cursor:pointer`), ohne Indikator.

**Erlaubt bleiben ausschließlich:**
- Dropdown-Indikator-Chevron an echten Auswahl-/Datumsfeldern (signalisiert „hier
  öffnet ein Menü").
- `chevron-left` / `chevL` als Zurück-Pfeil in der (mobilen) Navigation.

Neue Pfeile nur auf ausdrücklichen Wunsch. Legende-Kopfzeile = `div` mit
`onClick`-Toggle (kein `<button>`, da ggf. ein Aktions-Button darin sitzt);
Aktions-Button rechts mit `e.stopPropagation()`, auch bei eingeklappter Legende
sichtbar.

-----

## 3. Master-Detail-Pattern

Wenn der User eine Karte aufklappt: Master-Detail. Linke Spalte = Liste (1 oder 2 Spalten), rechte Spalte = Detail.

### 3.1 useCardWidth-Hook

Misst den Content-Bereich, berechnet die effektive Karten-Breite **wie ein CSS-Grid mit `minmax(minCard, 1fr)` es täte**. `minCard` kommt aus dem Setting `kartenMinBreite` (Default 280, einstellbar via Slider „Kartenbreite” unter Erscheinungsbild, 220–420 px).

```js
const [contentRef, cardWidth] = useCardWidth(settings.kartenMinBreite || 280, 10);
// contentRef → an innersten Wrapper-div hängen
// cardWidth → die Breite, die jede Karte im Grid hätte
```

### 3.2 useMasterDetailLayout-Hook

Entscheidet je nach verfügbarer Breite, wie viele Master-Spalten passen. Detail muss mindestens `cardWidth * minDetailFactor` breit sein. `minDetailFactor` kommt aus dem Setting `detailFaktor` (Default 1.1, einstellbar via Slider „Detailbreite” unter Erscheinungsbild, 1.0×–2.5×).

```js
const [mdRef, mdLayout] = useMasterDetailLayout(cardWidth, detailFaktor);
// mdLayout.masterCols  → 0 bis maxCols (Default 5)
// mdLayout.masterWidth → Breite der gesamten Master-Spalte in px
```

- **n-Spalten-Master**: von `maxCols` (5) nach unten probiert — die erste Spaltenzahl, neben die das Detail noch mit `cardWidth*detailFaktor` passt, gewinnt.
- **0 Master**: zu schmal — Detail full-width mit „← Zurück zur Liste”-Button oben

**Zwei Regler, ein System**: Kartenbreite steuert Spaltenzahl der Übersicht, Detailbreite die Mindestbreite der geöffneten Detailansicht. Größere Detailbreite → weniger Master-Spalten daneben. Beide wirken in Objekte + Kontakte.

### 3.3 Spalten-Layout

```jsx
<div ref={mdRef} style={{ display: "flex", gap: 10,
  flex: 1, minHeight: 0, alignItems: "stretch" }}>
  {/* Linke Spalte: Karten-Liste (Grid mit masterCols), eigener Scroll */}
  <div style={{
    flex: `0 0 ${mdLayout.masterWidth}px`,
    overflowY: "auto",
    display: "grid",
    gridTemplateColumns: `repeat(${mdLayout.masterCols}, 1fr)`,
    gap: 8, alignContent: "start",
  }}>
    {liste.map(...)}
  </div>

  {/* Rechte Spalte: Detail, eigener Scroll */}
  <div style={{ flex: 1, minWidth: 0, overflowY: "auto" }}>
    {renderDetail()}
  </div>
</div>
```

Wichtig: Master-Detail-Container nutzt `flex: 1, minHeight: 0` (keine Sticky-Höhe mehr — der Parent gibt die Höhe vor, weil der Content-Wrapper intern scrollt).

### 3.4 Detail-Karte: Doppel-Container (kritisch)

Border und Background gehören **in den inneren Container**, damit sie mit dem Inhalt scrollen — sonst entsteht ein „Extra-Fenster”-Effekt.

```jsx
{/* Outer: overflow — UNSICHTBAR (kein Border, kein Background) */}
<div style={{ flex: 1, minWidth: 0, overflowY: "auto" }}>
  {/* Inner: hat Border + Background — scrollt MIT dem Inhalt */}
  <div style={{
    background: accent + "08",
    border: `1px solid ${accent}`,
    borderRadius: 12,
    padding: "14px 16px",
  }}>
    <Detail />
  </div>
</div>
```

### 3.5 Mobile-Fallback (kein Master)

Auf schmalen Viewports oder bei `masterCols === 0`: Detail full-width mit „← Zurück zur Liste”-Button:

```jsx
{offenItem && !istDesktop && (
  <>
    <button onClick={() => setAktiv(null)} style={{...}}>
      <I name="chevron-left" /> Zurück zur Liste
    </button>
    <DetailKarte />
  </>
)}
```

### 3.6 Verboten

- ❌ Fixe Karten-Breite (`flex: 0 0 300px`) im Master-Detail — **immer `cardWidth`** über `useCardWidth`
- ❌ Border/Background direkt am Scroll-Container — **immer doppelt verschachteln**
- ❌ `paddingBottom: calc(100vh - ...)` als Scroll-Padding-Hack — Outer-Container scrollt eh nicht
- ❌ `position: sticky` im Master-Detail — Spalten haben jeweils eigenen `overflowY: auto`
- ❌ `minHeight: 100%` an Detail-Outer — verhindert das Scrollen

-----

## 4. Karten-Übersicht (Grid)

### 4.1 Pattern

```jsx
<div style={{
  display: "grid",
  gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
  gap: 10,
}}>
  {items.map(item => <Karte ... />)}
</div>
```

### 4.2 Verbindliche Werte

- **Mindestbreite Karte**: 280 px
- **Gap**: 10 px
- **Max-Breite**: 1fr (Karten füllen den Container — responsive)

Auf wide Bildschirm: 4–5 Spalten. Auf Laptop: 3 Spalten. Auf Mobile: 1 Spalte.

### 4.3 Karten-Komponenten

Alle Übersichts-Karten folgen demselben Aufbau:

```
┌─────────────────────────────────────────────────────┐
│  [48px Icon/Avatar-Wrapper]  [Titel + 2 Detail-Z.]   [Stats] │
│  ─────────────────────────────────────────────────── │ ← Status-Leiste optional
└─────────────────────────────────────────────────────┘
```

- **`VEKachel`** (Objekte): WEG-Nr in Accent-Farbe, 2 Adress-Zeilen (Straße + Ort, leere mit `\u00A0`), `n WE · m SP`-Stats rechts, Status-Leiste (z. B. „Bestellung läuft in 45 Tagen aus”).
- **`KontaktKarte`** (Personen/Firmen): Avatar (mit Eck-Badges für Rollen-Slots), Name, 2 Detail-Zeilen (Favoriten-Tel/Mail oder Fallback), Rollen-Badges rechts.
- **Firmen-Detailkarte** hat zusätzlich einen eigenen Block **„Verträge (N)”** unter dem Objekte-Block: sammelt alle Verträge der Firma über sämtliche Objekte (`ve.vertraege` + `ve.karten[].vertraege`, firmaId-Match per String-Cast). Pro Eintrag anklickbare Objekt-Zeile + read-only `VertragZeile`. Nur Firmen, nur außerhalb Objekt-Kontext (`!objektFilter`).
- **`SektionKachel`** (Einstellungs-Sektionen): farbige Icon-Kachel, Titel in Sektions-Farbe, Untertitel.

Gemeinsame Werte:

- **Outer-Wrapper**: `border: 1px solid {bc}`, `borderRadius: 12`, `overflow: hidden`, `scrollMarginTop: var(--ad-header-h, 200px)`
- **Inner-Padding**: `10px 12px`
- **Icon/Avatar-Wrapper**: `width: 48px` (38 Icon + Spielraum für Eck-Badges)
- **Icon-Square**: `38×38, borderRadius: 9, background: accent + "18"`
- **Active-State**: `border: 1px solid accent`
- **Hover**: `translateY(-1px)` (nur wenn nicht aktiv)

-----

## 5. Farb- und Theming

### 5.1 Theme-Objekt `t` (DARK / LIGHT)

|Token      |Dark     |Light    |Verwendung                        |
|-----------|---------|---------|----------------------------------|
|`t.bg`     |`#07070C`|`#ECEEF3`|Body, Section-Header              |
|`t.surface`|`#0D0D16`|`#F4F6FA`|Eingabefelder, Toggle, Firma-Karte|
|`t.card`   |`#13131F`|`#FFFFFF`|Person-Karte, VE-Karte            |
|`t.header` |`#0D0D14`|`#FFFFFF`|App-Header                        |
|`t.text`   |`#F0F0FF`|`#0F1022`|Primärtext                        |
|`t.sub`    |`#A0A0CD`|`#4A5072`|Sekundärtext                      |
|`t.muted`  |`#7575A0`|`#737896`|Datumsangaben, Hilfetexte         |
|`t.border` |`#252540`|`#D8DCE8`|Borderfarbe                       |

Hoher-Kontrast-Modus (`settings.hoherKontrast`) macht `sub` und `muted` deutlich heller bzw. dunkler:

- Dark: sub→`#D0D0E8`, muted→`#A8A8C5`
- Light: sub→`#2A2E40`, muted→`#454A60`

### 5.2 Akzent-System

Es gibt **mehrere parallele Akzente**, abgeleitet aus `settings.kacheln`:

- `ACCENT` (globale Konstante): `#0E7490` (Cyan) — Standard-Akzent, Logo „Da”, App-Header-Buttons.
- `objektAccent` = `settings.kacheln['objekte'].farbe || ACCENT` — wirkt auf VE-Karten, Objekte-Sticky-Header, Verwaltungsart-Filter.
- `kontaktAccent` = `settings.kacheln['kontakte'].farbe || KONTAKTE_FARBE` — wirkt auf Kontakt-Karten, Kontakte-Sticky-Header. Default `#8B5CF6` (Violett).
- **Sektion-Farben** (Einstellungen): jede Sektion hat eine eigene Farbe (Profil cyan, Erscheinung violett, Header smaragd, …) — definiert in `SEKTIONEN`.

Akzente werden mit **Hex-Alpha-Suffixen** für transparente Varianten genutzt:

- `${accent}08` — sehr dezenter Background-Tint (Detail-Boxen)
- `${accent}18` / `${accent}20` — Icon-Square-Hintergrund
- `${accent}40` — Soft-Shadow
- `${accent}60` — Hover-Border

### 5.3 300er Farbpalette (PALETTE_FARBEN)

Verbindliche Farbquelle für Rollen-Editor, Kachel-Farbpicker etc. **30 Familien × 10 Stufen (50–900)** = 300 Hex-Codes, gruppiert in Gruppen (`Grautöne`, `Rot & Pink`, `Orange & Gelb`, `Braun & Erdtöne`, `Grün`, `Blau`, `Lila & Magenta`, …).

Neue farbige Elemente sollen Hex-Codes aus PALETTE_FARBEN verwenden, nicht frei erfundene.

### 5.4 Funktions-/Status-Farben

|Status               |Farbe                  |Verwendung                             |
|---------------------|-----------------------|---------------------------------------|
|OK / aktiv / Erfolg  |`#10B981` (Smaragd-500)|Häkchen, „aktiv”-Pillen                |
|Information / werdend|Akzent                 |„Eigentümerwechsel in Vorbereitung”    |
|Warnung              |`#F59E0B` (Amber-500)  |„Bestellung läuft in X Tagen aus”      |
|Fehler / abgelaufen  |`#EF4444` (Rot-500)    |„Bestellung abgelaufen”, Löschen-Button|

### 5.5 Kontrast-Helfer

`getContrastColor(hex)` liefert `#1A1A1A` oder `#FFFFFF` je nach Luminanz (WCAG-konform, Schwelle 0.55). Pflicht für Badges/Pillen mit dynamischer Farbe.

### 5.6 Design-Tokens (FS / FW / RAD) — code-verifiziert

Definiert in `allesda_merged.jsx` direkt vor den zentralen Eingabefeld-Styles
(~Z. 137-139). **Nur diese drei Token-Objekte existieren** — es gibt **kein**
`LH`, `LS` oder `SP` im Code (frühere Cheat-Sheets nannten sie fälschlich;
Abstände werden inline gesetzt, App-Standard ist 10px Content-Padding/Grid-Gap).
Migration graduell: neue/angefasste Stellen nutzen Tokens, Bestand mit
hardcodierten Zahlen wird nach und nach umgestellt. `KARTE.*` hat eigene Tokens
(geometrische Constraints) und wird NICHT migriert.

**Font-Sizes — `FS`** (px):

| Token | px | Verwendung |
|---|---|---|
| `FS.xxs` | 9 | Status-Marken, Badge-Pillen, Mikro-Labels |
| `FS.xs` | 10 | Sehr kleine Meta-Info |
| `FS.s` | 11 | Sekundäre Texte, kleine Labels |
| `FS.m` | 12 | Standard-Meta / Buttons |
| `FS.l` | 13 | Betonter Body-Text |
| `FS.xl` | 14 | Standard-Body / größere Texte |
| `FS.input` | 16 | **Eingabefelder (iOS no-zoom!)** |
| `FS.icon` | 18 | Icon-Buttons |
| `FS.xxl` | 20 | Section-/Page-Titles |

> **`FS.input` = 16px** ist Pflicht für alle `<input>`/`<textarea>` — sonst zoomt
> iOS Safari beim Fokus rein.

**Font-Weights — `FW`:**

| Token | Wert | Verwendung |
|---|---|---|
| `FW.regular` | 400 | Body-Text |
| `FW.semi` | 500 | leichte Hervorhebung |
| `FW.medium` | 600 | Labels, Buttons (Standard-Button-Gewicht) |
| `FW.bold` | 700 | betonte Titel/Akzente |
| `FW.heavy` | 800 | Hauptüberschriften, Logo, Badge-Kürzel |

> **Achtung Namens-Falle:** `FW.semi`=500, `FW.medium`=600 (nicht intuitiv —
> „semi" ist leichter als „medium").

**Border-Radien — `RAD`** (px):

| Token | Wert | Verwendung |
|---|---|---|
| `RAD.sm` | 6 | Standard-Buttons, Inputs, Tags |
| `RAD.ms` | 8 | kleine Karten/Pillen |
| `RAD.md` | 9 | Karten-nah |
| `RAD.ml` | 10 | — |
| `RAD.lg` | 12 | Karten, Panels |
| `RAD.xl` | 16 | Dialoge, Modals |
| `RAD.pill` | 999 | Status-Pills, breite Pill-Buttons |
| `RAD.full` | "50%" | runde Icon-Buttons, Avatare |

Schriftart der App: **Plus Jakarta Sans**. Akzente: `#0E7490` (Cyan/Objekte),
`#8B5CF6` (Lila/Firmen), `#0080FF` (Belegung/Teile).

-----

## 6. Rollen-System

### 6.1 Personen-Rollen (DEFAULT_ROLLEN)

12 Default-Rollen mit Avatar-Eck-Slot:

|Slot     |Position am Avatar|Rollen                                                           |
|---------|------------------|-----------------------------------------------------------------|
|`ve`     |unten-rechts      |Eigentümer, Miteigentümer, Mieter, Nießbraucher, Wohnberechtigter|
|`sev`    |oben-links        |Bevollmächtigter                                                 |
|`gremium`|oben-rechts       |Verwaltungsbeirat (mit `vorsitz:true` = VBV), Rechnungsprüfer    |
|`firma`  |unten-links       |Geschäftsführer, Mitarbeiter, Sachbearbeiter, Ansprechpartner    |

Eine Rolle hat: `{ name, kuerzel, color, slot, aktiv }`. Reihenfolge im Array zählt (Rollen-Editor in Einstellungen).

**VBR-Vorsitz** ist KEINE eigene Rolle, sondern „Verwaltungsbeirat” mit Flag `vorsitz:true` an der Zuweisung.

### 6.2 Firmen-Rollen (DEFAULT_FIRMEN_ROLLEN)

12 Dienstleister-Rollen (HV, Hausmeister, Versorger, Messdienst, Brandschutz, …) — werden **nicht als Avatar-Eck-Badges** angezeigt (eine Firma kann je Objekt eine andere Rolle haben, visuell nicht eindeutig). Sie erscheinen als **Pillen** in Detail-Karten und Listen.

### 6.3 RolleBadge

- `<RolleBadge rolle="Eigentümer" size={20} status="aktiv" vorsitz={false} selbstnutzend={false}/>` — eine einzelne farbige Pille mit Kürzel.
- **Goldener Ring** bei `vorsitz` (VBR) ODER `vertrag` (Firmen-Zuständigkeit) ODER `selbstnutzend` (Eigentümer wohnt selbst). Alle drei markieren eine „besondere Stellung" und kollidieren nie am selben Badge (Eigentümer ist nie zugleich Vorsitz/Vertrag an DEMSELBEN Badge). `selbstnutzend` wird in `RollenkarteBox` LIVE aus der Belegung abgeleitet (`karteIstSelbstnutzend`), nie gespeichert — das tote `selbstnutzer`-Flag bleibt tot.
- Avatar-Eck-Badges entstehen automatisch über `<Avatar zuweisungen={...}/>`.
- (Hinweis v9.66: das ungenutzte Plural-Wrapper `RollenBadges` wurde bei der Tot-Code-Bereinigung entfernt.)

-----

## 7. Datenmodell (Modell A)

### 7.1 Top-Level

```js
const SCHEMA_VERSION = 1;
const [kontakte, setKontakte] = useState(DEFAULT_KONTAKTE);  // Personen + Firmen
const [ves, setVes]           = useState(DEFAULT_VES);       // Verwaltungseinheiten
const [settings, setSettings] = useState(DEFAULT_SETTINGS);
```

### 7.2 Kontakt

```js
// Person:
{
  id, typ: "person", anrede, vorname, nachname,
  tels:   [{ nr, typ, favorit }],
  emails: [{ email, typ, favorit }],
  strasse, plzOrt, adresseFavorit,
  objektZuweisungen: [
    { veId, einheitId?, rolle, status: "aktiv"|"werdend"|"ehemalig",
      von, bis, vorsitz?: boolean, anteil?: "250/1000" }
  ],
  notizen, customFelder
}
// Firma:
{ id, typ: "firma", name, tel, email, strasse, plzOrt,
  objektZuweisungen: [...], mitarbeiter: [...], notizen, customFelder }
```

### 7.3 VE (Verwaltungseinheit)

```js
{
  id, nr: "WEG-2024-001", adresse, verwaltungsart: "weg"|"miet"|"gewerbe"|"sev",
  verwaltung: { verwalter, buchhalter, bestelltAb, bestelltBis },
  einheiten: [{ id, typ: "Wohneigentum"|"Teileigentum"|"Gewerbe"|"Stellplatz"|"Carport"|"Doppelparker",
                bez, flaeche, mea, etage }],
  haeuser: [...], karten: [...]  // Karten-Layout der Liegenschaft
}
```

### 7.4 Status-Werte für objektZuweisungen

- `aktiv` — aktuell wirkend (Default)
- `werdend` — Eigentümerwechsel in Vorbereitung
- `ehemalig` — abgeschlossen, in Historie

VE-IDs folgen dem Format `WEG-JJJJ-NNN` (z. B. `WEG-2024-007`).

-----

## 8. Sidebar (Desktop ≥ 900 px)

### 8.1 Drei Anzeige-Modi

Die Sidebar ist resizable über einen Drag-Handle am rechten Rand (`SIDEBAR_MIN_WIDTH=56`, `SIDEBAR_MAX_WIDTH=280`). Drei Modi basierend auf `settings.sidebarBreite`:

|Breite   |Modus |Anzeige                  |
|---------|------|-------------------------|
|< 75 px  |`icon`|nur Icons (zentriert)    |
|75–144 px|`kurz`|Icon + erste 2 Buchstaben|
|≥ 145 px |`voll`|Icon + voller Text       |

Helper: `sidebarModus(breite)` in `allesda_merged.jsx`.

### 8.2 Mobile-Pendant: KategorieKacheln

Bei `< 900 px` (`!istDesktop`) erscheint eine horizontale Kachel-Leiste (`KategorieKacheln`) — entweder integriert in den Sticky-Header (`settings.dashboardSticky === true`) oder darunter (scrollt mit weg).

### 8.3 Steuerung der Sichtbarkeit

`settings.dashboardModus`:

- `"aus"` — kein Dashboard sichtbar
- `"immer"` — Sidebar/Kacheln immer sichtbar (Default)
- `"home"` — nur auf dem Home-Screen

-----

## 9. Context-System

Sieben React-Contexts liefern Settings-Werte tief in den Baum, ohne sie als Props durchzuschleifen:

|Context                  |Liefert                                                             |Konsumenten                                          |
|-------------------------|--------------------------------------------------------------------|-----------------------------------------------------|
|`RollenContext`          |`settings.rollen` (Personen-Rollen)                                 |RolleBadge, KontaktPicker, KontaktKarte              |
|`FirmenRollenContext`    |`settings.firmenRollen` (Dienstleister-Rollen)                      |KontaktKarte (Firma), VertragZeile/Avatar (Firmen)   |
|`AvatarIconsContext`     |`{person, firma}` — Eck-Badges an/aus                               |Avatar                                               |
|`KartenBadgesContext`    |`{person, firma}` — Rollen-Pillen rechts auf Kontaktkarte an/aus    |KontaktKarte                                         |
|`StatusLeisteContext`    |`{objekt, kontakt}` — Statusleiste unter Karten an/aus              |VEKachel, KontaktKarte                               |
|`RechnungsadresseContext`|`boolean` — Rechnungsadresse-Sektion in Stammdaten                  |LiegenschaftAnsicht                                  |
|`EinheitAnzeigeContext`  |`{flaeche, mea, eigentuemer, mieter}` — Spalten in Einheit-Übersicht|EinheitZeile                                         |

**Pattern**: Provider im `App`-Komponenten, Consumer über `useRollen()`, `useStatusLeiste()` etc. (Helper-Hooks neben jedem Context definiert).

-----

## 10. Suche

### 10.1 Scoring-Stufen

Stufen-Match mit Score von 100 (perfekt) bis 0 (kein Treffer):

|Score|Stufe                      |Beispiel                    |
|-----|---------------------------|----------------------------|
|100  |Exakter Substring          |„Math” → „Mathias”          |
|90   |Diakritika-insensitiv      |„muller” → „Müller”         |
|80   |Mehrere Wörter exakt       |„lin marc” → „Marcus Linder”|
|75   |Mehrere Wörter + Diakritika|„mul fra” → „Müller-Franke” |
|70   |Kölner Phonetik            |„Mathias” → „Matthias”      |
|60   |Levenshtein-Distanz 1      |„Schimdt” → „Schmidt”       |
|55   |Levenshtein-Distanz 2      |„Schimt” → „Schmidt”        |
|50   |Levenshtein-Distanz 3      |nur bei Toleranz „Tolerant” |

### 10.2 Funktionen

- `strip(s)` — entfernt Diakritika
- `koelnerPhonetik(name)` — phonetische Codierung
- `levenshtein(a, b)` — Edit-Distanz
- `matchScore(query, text, opts)` — kombinierter Score
- `sucheAlles(query, settings, kontakte, ves)` — Top-Level-Suche, gibt Ergebnisse pro Kategorie zurück

### 10.3 Settings

- `sucheDiakritika`, `sucheWoerter`, `suchePhonetik`, `sucheTippfehler` — Stufen an/aus (Stufe 1 ist immer aktiv)
- `sucheTippfehlerSchwelle`: 1 (Streng) / 2 (Normal, Default) / 3 (Tolerant)
- `suchKategorien`: welche Bereiche durchsucht werden (Objekte, Kontakte, Adressen, Verträge)

-----

## 11. Persistente Speicherung

### 11.1 Storage-Layer

Gekapseltes `storage`-Objekt — App-Code ruft nur diese Funktionen auf, niemals direkt `localStorage`:

```js
storage.ladeSettings()
storage.speichereSettings(obj)
storage.ladeDaten()                 // { kontakte, ves }
storage.speichereDaten({ kontakte, ves })
storage.setzeZurueck("settings" | "daten" | "alles")
storage.speicherGroesse()           // { settings, daten, gesamt } in chars
storage.istVerfuegbar()             // probe-write Test
```

**Begründung**: Wenn wir später auf Cloud (Supabase o. ä.) umsteigen, tauschen wir nur die Implementierung — der App-Code bleibt gleich.

### 11.2 Auto-Save-Pattern

Nach Mount erst `storageGeladen=true` setzen, dann via `useEffect` reagieren — sonst überschreibt der Initial-State (Defaults) den Storage:

```js
const [storageGeladen, setStorageGeladen] = useState(false);
useEffect(() => {
  const sett = storage.ladeSettings();
  if (sett) setSettings(s => ({ ...s, ...sett }));
  // ...
  setStorageGeladen(true);
}, []);

useEffect(() => {
  if (!storageGeladen) return;
  storage.speichereSettings({ ...settings, mode });
}, [settings, mode, storageGeladen]);
```

### 11.3 Datei-Export/Import

Globale Funktionen `exportiereJSON(obj, dateiname)` und `importiereJSON(callback)`. Datei-Format:

```json
{
  "typ": "allesda-settings" | "allesda-daten",
  "schema": 1,
  "exportiertAm": "2026-05-23T16:40:00Z",
  "settings": { ... } | "kontakte": [...], "ves": [...]
}
```

Beim Import: Typ-Check + Confirm-Dialog mit Datensatz-Anzahl.

### 11.4 Status-Anzeige

In Sektion **Daten** zeigt eine farbige Box:

- 🟢 Grün: localStorage verfügbar → Auto-Save funktioniert
- 🟡 Orange: localStorage blockiert (Sandbox/privat) → nur Datei-Export

-----

## 12. Komponenten-Konventionen

### 12.1 Bearbeiten-Modus

Im Header rechts ein **Stift-Button** (gleicher 36×36-Style wie Plus). Klick → wechselt zu Häkchen (`I name="check"`), Inhalt zeigt Up/Down-Pfeile zum Verschieben. Pattern:

```jsx
{editMode && (
  <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
    <button disabled={!kannHoch} onClick={onHoch}>▲</button>
    <button disabled={!kannRunter} onClick={onRunter}>▼</button>
  </div>
)}
```

Reihenfolge wird im Settings als Array von IDs gespeichert:

- Sektionen: `settings.sektionenReihenfolge`
- Dashboard-Kacheln: `settings.kacheln[i].reihenfolge` (Zahl pro Kachel)

### 12.2 Avatar / Zahnrad-Button

Im App-Header oben rechts. **Immer sichtbar** (auch wenn `headerZeigeAvatar=false`), wechselt nur das Icon:

- `headerZeigeAvatar: true` → `user`-Icon, Accent-Kreis (Avatar-Look)
- `headerZeigeAvatar: false` → `settings`-Icon, transparent + dezenter Rand

**Begründung**: Sicherheit — der User darf sich nie aus den Einstellungen aussperren.

### 12.3 Dunkelmodus-Toggle

Im Header optional (gesteuert via `settings.headerZeigeDunkelmodus`). Auch wenn ausgeblendet, ist der Modus-Wechsel **immer** unter Einstellungen → Erscheinungsbild verfügbar.

### 12.4 Auto-Scroll zur Karte

Wenn eine Karte aufgeklappt wird, scrollt der Content so, dass die Karte oben unter dem Header sitzt:

```js
useEffect(() => {
  if (expandedId) scrollToCard("prefix-" + expandedId);
}, [expandedId]);
```

Helper-Funktion `scrollToCard(elementId)` ist global. Skippt das Scrollen, wenn die Karte schon korrekt positioniert ist (innerhalb 5 px).

Karten brauchen `scrollMarginTop: "var(--ad-header-h, 200px)"` — sonst landet die Karte unter dem Header.

### 12.5 Beim Screen-Wechsel zurücksetzen

`wechselScreen(s)` → ruft intern `resetUI()` auf:

- `setSuchErg(null)` + `setSuchBegr("")` (Such-Anzeige schließen)
- `setExpandedVEId(null)` (offene Karten zuklappen)
- `window.scrollTo({ top: 0 })`

Außerdem werden bei Wechsel des offenen VE/Kontakts die Detail-Edit-Modi zurückgesetzt:

```js
useEffect(() => { setObjektDetailEditMode(false); },  [expandedVEId]);
useEffect(() => { setKontaktDetailEditMode(false); }, [aktivKontaktId]);
```

### 12.6 FilterButtons (Verwaltungsart / Kontaktart)

Konsistente Pillen-Reihe für „WEG · Miet · Gewerbe · SEV” bzw. „Personen · Firmen · Rollen”. Props:

```
arten, aktive, counts, wert, onWert, t, accent, ohneAlle
```

„Alle” wird durch Klick auf den Sektion-Titel (`Objekte`, `Kontakte`) erreicht — daher Standard `ohneAlle={true}` neben dem Titel.

### 12.7 Status-Leiste unter Karten

Eingebettet (`eingebettet={true}`) direkt im selben Outer-Container der Karte, scrollt mit. Typen: `error` (rot), `warn` (orange), `info` (Akzent), `done` (grün). Schaltbar pro Karten-Typ über `StatusLeisteContext`.

-----

## 13. Mobile- & iOS-Spezifika

### 13.1 Breakpoint

```js
const DESKTOP_MIN_WIDTH = 900;
const istDesktop = useWindowWidth() >= DESKTOP_MIN_WIDTH;
```

### 13.2 iOS Safari

1. **`dvh` statt `vh`** — URL-Bar in `100vh` würde Inhalt unten abschneiden.
1. **Viewport-Meta**: `width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover` — verhindert Auto-Zoom bei Input-Fokus.
1. **Mindest-Font-Size 16 px auf Touch-Devices**:
   
   ```css
   @media (hover: none) and (pointer: coarse) {
     input, textarea, select { font-size: 16px !important; }
   }
   ```
   
   Sonst zoomt Safari beim Fokus rein.
1. **`WebkitOverflowScrolling: "touch"`** für horizontale Scroll-Container (KategorieKacheln).

### 13.3 Master-Detail auf Mobile

Statt zwei Spalten: Vollbild-Detail mit `← Zurück zur Liste`-Button oben — automatisch über `useMasterDetailLayout` (masterCols=0 als Fallback). Pattern siehe §3.5.

### 13.4 Bearbeiten-Modus auf Mobile

Im Detail-View auf Mobile wird der Plus-Button im Section-Header durch einen **Bearbeiten-Toggle für das offene VE/Kontakt** ersetzt (`objektDetailEditMode` / `kontaktDetailEditMode`). Dadurch ist „bearbeiten” auch erreichbar, ohne ganz nach unten zur Karte zu scrollen.

### 13.5 Reduce-Motion

Wenn `settings.reduceMotion=true`, wird per inline `<style>` global gesetzt:

```css
* { transition: none !important; animation: none !important; }
```

-----

## 14. JSX- & JavaScript-Konventionen

### 14.1 Pflicht-Regeln (siehe Datei-Kopf von `allesda_merged.jsx`)

1. **Kein optional chaining (`?.`)** — immer `(x && x.y)` oder `(x || {}).y`.
1. **Keine IIFEs in JSX** — alles als Top-Level-Komponente.
1. **Keine Hooks in verschachtelten Funktionen** — jede Hook-tragende Komponente ist Top-Level.
1. **Datenmodell-Versions-Tag** (`SCHEMA_VERSION`) erhöhen, sobald sich das Schema ändert.

### 14.2 Warum keine `?.`

Babel-/Tooling-Setups in der Single-File-JSX-Umgebung haben mit modernen Syntax-Features unterschiedlich gute Abdeckung. `(x && x.y)` ist universell und debugbar; `?.` hat in mehreren Setups zu Silent-Failures geführt (Daten waren da, Karte rendert nicht). Daher die einheitliche Regel.

### 14.3 Anführungszeichen in JSX-Attributen

Typografische Anführungszeichen (`„"`) in JSX-Attribut-Strings **escapen**:

```jsx
sub={"\u201Emüller\u201C findet \u201EMüller\u201C"}
```

Sonst Parse-Error.

### 14.4 useState mit Storage-Merge

Beim Laden gespeicherter Settings: **mit Defaults mergen**, damit neue Felder nicht fehlen:

```js
setSettings(s => ({ ...s, ...geladeneSettings }));
```

Niemals direkt `setSettings(geladeneSettings)` — dadurch verschwinden neue Default-Keys.

### 14.5 Komponenten-Definition

- Function components, Default-Werte über Destructuring-Defaults: `function Foo({ value, t, accent = ACCENT })`.
- Props in folgender Reihenfolge: payload (data), Theme (`t`), Akzent, Callbacks, Flags.
- Helper-Funktionen kleinerer Komponenten dürfen `useRollen()`, `useStatusLeiste()` etc. nutzen statt Props.

-----

## 15. Einstellungs-Sektionen (Reihenfolge & Inhalt)

Die 10 Default-Sektionen aus `SEKTIONEN`:

|ID           |Titel           |Farbe       |Inhalt                                                                               |
|-------------|----------------|------------|-------------------------------------------------------------------------------------|
|`profil`     |Mein Profil     |Cyan-700    |Name, Anrede, Kontaktdaten                                                           |
|`erscheinung`|Erscheinungsbild|Violett-500 |Dunkelmodus, Schriftgröße/Dichte, Kartenbreite, Detailbreite, Kontrast, Reduce-Motion|
|`header`     |Header          |Smaragd-500 |Avatar an/aus, Dunkelmodus-Button an/aus                                             |
|`filter`     |Filter-Optionen |Amber-500   |Welche Filter sichtbar (Verwalter/Buchhalter, Verwaltungsarten, Kontaktarten)        |
|`rollen`     |Rollen          |Indigo-600  |Personen-/Firmen-Rollen-Editor (Name, Kürzel, Farbe, Aktiv)                          |
|`dashboard`  |Dashboard       |Blau-500    |Kacheln, Reihenfolge, Farben                                                         |
|`objekte`    |Objekte         |Cyan-500    |Welche Felder in der Einheit-Übersicht (Fläche, MEA, ET, MT)                         |
|`suche`      |Suche           |Pink-500    |Stufen, Kategorien                                                                   |
|`hv`         |Hausverwaltung  |Schiefer-500|HV-Name, Logo-URL                                                                    |
|`daten`      |Daten           |Cyan-600    |Storage-Status, Import, Export, Reset                                                |

Reihenfolge ist im UI editierbar; gespeichert in `settings.sektionenReihenfolge` (Array von IDs).

-----

## 16. Domain-Terminologie

Die App ist für **deutsche Immobilien-Verwaltung (WEG)**. Verwende konsistent:

|Begriff     |Bedeutung                                   |
|------------|--------------------------------------------|
|VE          |Verwaltungseinheit (= eine Liegenschaft)    |
|WEG         |Wohnungseigentümergemeinschaft              |
|Einheit (WE)|Eine einzelne Wohnung/Wohneinheit           |
|TE          |Teileigentum                                |
|SP          |Stellplatz (auch Carport, Doppelparker)     |
|MEA         |Miteigentumsanteil (z. B. 250/1000)         |
|ET          |Eigentümer                                  |
|MT          |Mieter                                      |
|VB          |Verwaltungsbeirat (mit `vorsitz:true` → VBV)|
|RP          |Rechnungsprüfer                             |
|HV          |Hausverwaltung                              |
|SEV         |Sondereigentumsverwaltung                   |
|ETV         |Eigentümerversammlung                       |
|Gewerk      |Dienstleistungsart (Heizung, Aufzug, …)     |

VE-IDs folgen dem Format `WEG-JJJJ-NNN` (z. B. `WEG-2024-007`).

Verwaltungsarten (`VERWALTUNGSARTEN`): `weg` · `miet` (Mietverwaltung) · `gewerbe` (Gewerbeverwaltung) · `sev` (SEV).

-----

## 17. Architektur-Patterns

### 17.1 Kapselung

Wiederkehrende Bedürfnisse als Komponente oder Hook:

- `StickySectionHeader` (Header pro Screen)
- `useCardWidth` (responsive Karten-Breite)
- `useMasterDetailLayout` (Spaltenzahl entscheiden)
- `useWindowWidth` (responsive Breakpoint)
- `EinstellKarte` / `EinstellZeile` (Settings-UI)
- `FilterButtons` (Verwaltungsart-/Rollen-Filter)
- `storage.*` (Persistence)

### 17.2 Settings-Driven

Layout-Verhalten ist über `settings.*` konfigurierbar:

- `headerZeigeAvatar`, `headerZeigeDunkelmodus`
- `dashboardModus` (`"aus"` | `"immer"` | `"home"`), `dashboardSticky`, `sidebarBreite`
- `filterAktiv`, `filterTyp` (`"verwalter"` | `"buchhalter"`)
- `sektionenReihenfolge`, `kacheln[i].reihenfolge`
- `rollen`, `firmenRollen`
- `avatarIconsPerson/Firma`, `kartenBadgesPerson/Firma`, `statusLeisteObjekt/Kontakt`
- `einheitAnzeigeFlaeche/Mea/Eigentuemer/Mieter`
- `dichte`, `hoherKontrast`, `reduceMotion`
- Such-Stufen-Toggles

Neue konfigurierbare Werte → in `DEFAULT_SETTINGS` mit sinnvollem Default.

### 17.3 Konsistenz vor Eigenkreation

Wenn ein Screen einen ähnlichen Bedarf hat wie ein anderer, **vorhandenes Pattern wiederverwenden**, nicht neu erfinden. Neue Patterns nur, wenn:

1. Bestehende passen wirklich nicht, UND
1. Das neue Pattern wird in `DESIGN.md` ergänzt.

### 17.4 Top-Level only

Hooks und Komponenten dürfen niemals in verschachtelten Funktionen (z. B. inline-Render-Helpern) definiert werden. Render-Helper, die Hooks brauchen → als eigene Top-Level-Komponente extrahieren.

-----

## 18. Wann diese Doku anpassen

Diese Datei ist **kein Gesetz**, sondern eine festgeschriebene Konvention. Wenn ein Pattern nachhaltig nicht funktioniert, **erst hier diskutieren**, dann ändern, dann den Code anpassen — nicht andersrum.

Änderungen brauchen:

1. Begründung („warum war das alte Pattern nicht gut?”)
1. Update in dieser Datei
1. Refactor aller bestehenden Stellen (oder Markierung als „Legacy bis vor Datum X”)

-----

## 19. Roadmap-Bezug

Aktiver Stand (v7.70): Liegenschaft, Kontakte, Verwaltung (inkl. ETV-/Versicherungs-/Vertrags-Karten), Belegungsmodell (Bewohner-Rechte), Stellplatz-Modell, Einheit-Unterteilung (Teile), Räume/Zähler — funktional.

Bewusst noch NICHT enthalten (Platzhalter-Screens):

- **Dokumente & Fotos** (nur Platzhalter-Reiter — größtes offenes Modul)
- Ticketsystem / Finanzen

Offene Detail-Punkte: Stellplatz-Migration alt-rechtsstatus → spStellung (falls nötig); Raum-Fläche optional zur Teil-Fläche summieren; SE-Raum-Symbol evtl. ändern.

Wenn neue Module dazukommen, gilt: dieselben Patterns wie hier. Neue Screens nutzen `StickySectionHeader`, `useCardWidth`, ggf. `useMasterDetailLayout`, holen Theme via `t`, Akzent aus der jeweiligen Dashboard-Kachel. Neue Verknüpfungs-Felder nutzen die bestehenden Picker und kleinen Karten (Abschnitt 20), nie Eigenbau.

-----

## 20. Wiederverwendbare Bausteine, Picker & Feldtypen

**Grundregel: Konsistenz vor Eigenkreation.** Vor dem Bau eines neuen Eingabe- oder Anzeige-Elements zuerst per `grep` nach einem bestehenden Baustein suchen und diesen wiederverwenden. Neue Picker oder Karten nur, wenn nachweislich keiner passt.

### 20.1 Picker (immer wiederverwenden, nie neu bauen)

|Zweck                            |Komponente                                                         |Verhalten                                                                                                                                                                       |
|---------------------------------|-------------------------------------------------------------------|--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
|Kontakt verknüpfen (Person/Firma)|`KontaktPicker`                                                    |Eigene Suche, „Abbrechen”, „+ Neu anlegen” (Schnellanlage Person/Firma inkl. Tel/E-Mail), rotes `x` ohne Rand zum Lösen. `value` = Kontakt-ID, `onChange(id                     |
|Datum                            |`DatumFeld`                                                        |Tastatureingabe `tt.mm.jjjj` (mit Maske) **plus** Rad-Picker `DatumPickerModal` über Kalender-Button. Prop `iso` speichert als `JJJJ-MM-TT`. `defaultHeute` steuert Vorbelegung.|
|Objekt / Einheit verknüpfen      |bestehendes Objekt-/Einheit-Picker-Muster bzw. `spEinheitId`-Muster|Vor Eigenbau prüfen.                                                                                                                                                            |

|Monat/Jahr (ohne Tag)            |`MonatJahrPickerModal`                                             |Rad-Picker (Monat+Jahr) aus denselben `DatumSpalte`-Rädern wie `DatumPickerModal`. Wert `"JJJJ-MM"`. Einsatz z. B. Historie-Zeitraumfilter. NIE natives `input[type=month]` verwenden.|

`FarbPicker` dient ausschließlich der Dashboard-Kachel-Farbwahl (anderer Zweck, bleibt).

**Baustein-Regel (verallgemeinert, ab v9.37):** Die Grundregel oben gilt für ALLE
Bausteine, nicht nur Picker — auch Räder (`DatumSpalte`), Chips/Pillen
(`FilterButtons`), Auswahl-Muster (`renderAuswahl`/„Andere…"-Freitext), kleine
Karten (§20.3), Häkchen-Suchlisten. Vor jedem Neubau `grep`; Neubau nur, wenn
nichts passt — dann im Stil der vorhandenen Bausteine.

### 20.2 Feldtypen (`FIELD_TYPES`, gerendert in `FieldRow` / `FieldList`)

- **text**, **number**, **bool** — Standard.
- **date** → rendert `DatumFeld` (mit `iso`); Lese-Modus formatiert `TT.MM.JJJJ` via `datumAnzeige`.
- **kontakt** → `value` = Name (Freitext erlaubt) + optionale `kontaktId`. Lese-Modus: aufklappbare **kleine Kontaktkarte** (`FeldKontaktKarte`). Edit-Modus: `KontaktPicker`.
- **computed** / `readOnly:true` → berechneter, kursiver, nicht editier-/löschbarer Wert (z. B. „Nächste Wahl” via `berechneNaechsteWahl(bestelltBis, naechsteETV)`).

**Feld-Flags:** `required` (Pflicht, rotes `*`, bleibt auch leer sichtbar) · `immerSichtbar` (leer trotzdem zeigen).

**FieldList-Render-Regel:** Im **Lese-Modus** werden Felder mit leerem Wert ausgeblendet (`0` zählt als Wert; ein `kontakt`-Feld mit `kontaktId` gilt als befüllt; `required`/`immerSichtbar` bleiben). Im **Bearbeiten-Modus** werden alle Felder gezeigt.

**Schema vs. Werte bei festen Standard-Karten:** Bei `verwaltung_stamm` (und anderen festen Karten) kommt das Feld-**Schema** (Typ, `required`, `immerSichtbar`, `readOnly`) aus dem Default in `buildInitialVerwaltungsKarten`; die **Werte** (`value`, `kontaktId`) aus dem Persistierten. Zusammengeführt in `mergeVerwaltungsKarten` (`syncSchema`, Match per id/Name). So ziehen Typ-Änderungen (z. B. text→kontakt/date/computed) auch bei Bestandsobjekten durch, ohne Eingaben zu verlieren.

### 20.3 Kleine Karten (aufklappbar, in Feldern/Sektionen)

Drei Wrapper, **ein gemeinsames Muster** (Vorbild: `VertragFirmaKarte`):

|Karte             |eingeklappt                                                           |aufgeklappt                                                                                                            |
|------------------|----------------------------------------------------------------------|-----------------------------------------------------------------------------------------------------------------------|
|`FeldKontaktKarte`|`KontaktKarte` mit `kompakt` (Avatar + Name + Kontaktdaten)           |`KontaktDetailKarte` `embedded` (Stammdaten + Notizen, read-only) + Footer „Zum Kontakt”                               |
|`FeldObjektKarte` |`VEKachel` mit `kompakt` (Avatar + WEG-Nr + Adresse + Einheiten-Stats)|Eckdaten (Adresse, Einheiten, Verwaltung ab/bis, Verwalter, Gesamtanteile, Nächste ETV) + Footer „Vollständiges Objekt”|
|`FeldEinheitKarte`|`EinheitKachel` (WEG·Einheit + Adresse + Lage + Größe)                |Eckdaten (Objekt, Einheit, Typ, Lage, Fläche, Zimmer, MEA, Stellung) + Footer „Vollständige Einheit”                   |

**Gemeinsame Optik (aufgeklappt):** umlaufender Rahmen `1px` in Akzentfarbe + Hintergrund `Akzent+"08"`, `RAD.lg`; die Kopf-Kachel **ohne eigenen Rahmen** (`ohneRahmen`-Prop an `KontaktKarte`/`VEKachel`/`EinheitKachel`). **Footer-Button rechtsbündig**, getönt: `padding 6px 12px`, `background Akzent+"15"`, `border 1px Akzent+"40"`, `RAD.sm`, `FW.medium`, mit `chevR`-Icon rechts.

**Regel — was NICHT in die kleinen Karten gehört:** Status-Leisten, Rollen-Badges und Objekt-/Verwendungs-Verknüpfungen. Die kleinen Karten zeigen nur Kerndaten + Link.

**Aufklapp-Verhalten:** Klick auf den Kopf klappt auf/zu. Leere Eckdaten-Zeilen werden weggelassen. Null-sicher (kein Datensatz → nichts).

**Einsatz-Regel Lese-/Edit-Modus:** Wo eine Zeile sowohl Anzeige als auch Bearbeitung kann (z. B. OBJEKTE-Sektion im Kontaktprofil), zeigt der **Lese-Modus** die kleine Karte, der **Edit-Modus** die funktionale Zeile (`ObjektZeile` mit Rolle-Badge + Bearbeiten/Lösen). Die kleinen Karten sind read-only.

-----

## 21. Karten-Interaktion: Akkordeon, lokaler Edit, Sync (ab v8.x)

Diese Mechaniken gelten einheitlich in **Verwaltung UND Liegenschaft** (und für die `TechnikKarte`). Sie lösen das frühere „global editMode für alles” ab.

### 21.1 Akkordeon — immer nur EINE Karte offen

- Koordiniert in `KartenList` über `offeneKarteId`-State + `onAkkordeonToggle(id, willOpen)`.
- An jede klappbare Karte gehen `akkordeonOffen` (= offene ID) und `onAkkordeonToggle`.
- In `GebaeudeKarte`/`TechnikKarte`: `akkordeonAktiv = !!onAkkordeonToggle && !immerOffen`; `effExpanded = immerOffen ? true : (akkordeonAktiv ? (akkordeonOffen === karte.id) : expanded)`; `toggleExpanded` meldet bei aktivem Akkordeon an `KartenList`, sonst lokales `setExpanded`.
- **Alle** `expanded`-Verwendungen im Karten-Body laufen über `effExpanded`/`toggleExpanded`.
- Karten starten **eingeklappt** (`useState(immerOffen ? true : false)`). Fixe/immer-offene Karten (Stammdaten/ETV) unberührt.

### 21.2 „Nur eine Karte editierbar”

- `KartenList` hält `aktiveEditId`; Karte meldet via `onLokalEditChange(aktiv)` Start/Ende ihres lokalen Edits.
- Andere Karten bekommen `lokalEditGesperrt = aktiveEditId !== null && aktiveEditId !== karte.id` → ihr Stift wird ausgeblendet (`lokalEditErlaubt && … && (!lokalEditGesperrt || lokalEdit)`).

### 21.3 Lokaler Karten-Edit-Stift (Felder)

- `lokalEditErlaubt = !karte.fixed && karte.kategorie !== "etv"` (gilt jetzt auch in der Liegenschaft, nicht mehr nur Verwaltung).
- Runder Stift im aufgeklappten Karten-Kopf (über `GebaeudeKopf`-Props `lokalEditErlaubt`/`lokalEdit`/`onLokalEditStart`/`onLokalEditFertig`/`onLokalEditAbbrechen`). `effEdit = editMode || (lokalEditErlaubt && lokalEdit)` schaltet Felder/Verträge frei.
- Snapshot beim Start (`lokalSnapshot`) erlaubt echtes Verwerfen (✗). ✓ = behalten.
- Eine offene Karte meldet `useEinheitOffen().setOffen(true)` (`meldetOffen = !immerOffen && effExpanded`), damit der **obere globale Struktur-Stift** verschwindet (gegenseitiger Ausschluss).

### 21.4 Drei Bearbeiten-Ebenen: global / Karte / Einheit (gegenseitiger Ausschluss)

Auf Objekt-Ebene gibt es **drei** sich gegenseitig ausschließende Edit-Ebenen:

1. **Global** (Stift oben rechts im VE-Header, `editMode`): Karten + Stammdaten. Versteckt sich, sobald eine Einheit/klappbare Karte offen ist (`einheitOffen`-Zähler via `EinheitOffenContext`, Bedingung `!(einheitOffen && !editMode)`).
1. **Karten-Ebene** (lokaler Stift in `GebaeudeKopf`, `lokalEdit`): nur Karten-Felder + Einheiten anlegen. Sichtbar nur bei `lokalEditErlaubt && !editMode && effExpanded && (!lokalEditGesperrt || lokalEdit) && !belegungEdit && activeEinheit == null` — verschwindet also bei Ebene 1, bei aktivem Einheit-Edit **und sobald eine Einheit aufgeklappt ist**.
1. **Einheit-Ebene** (runder Stift in `EinheitZeile`, `belegungEdit`): macht **alles der Einheit** editierbar — Stammdaten **und** Belegung. Erscheint nur bei `!editMode` (schließt Ebene 1 aus).

**`strukturEdit` in `EinheitDetail`:** `const strukturEdit = editMode || belegungEdit`. Der Stammdaten-Tab (`tab === "info"`) bindet alle Edit-Schalter (Felder via `FieldList editMode={strukturEdit}`, Aufteilen, `TeilRaeume editMode={strukturEdit}`) an `strukturEdit`, damit der Einheit-Stift auch die Stammdaten freischaltet. Der Belegungs-/Eigentümer-Tab nutzt weiter `belegungEdit` bzw. den globalen Modus wie gehabt.

### 21.5 Echte Feld-Synchronisation Liegenschaft ↔ Verwaltung

- Gemeinsame Quelle `ve.etvStamm = { abstimmung, gesamtanteile, wirtschaftsjahr }`.
- Sync-Felder tragen `syncKey` (“abstimmung”/“gesamtanteile”/“wirtschaftsjahr”); in `FieldRow`: `istSync = field.syncKey && etvStamm && onSyncChange`; save/save2 leiten auf `onSyncChange(key, value)` um statt lokalem setFields. Wert kommt aus `etvStamm[syncKey]`.
- Props `etvStamm` + `onSyncChange` laufen durch die ganze Kette (VEDetail → Ansichten → KartenList → GebaeudeKarte → FieldList → FieldRow). `VEDetail` leitet `etvStamm` aus `ve.etvStamm` ab (oder migriert aus Bestandsfeldern); `setEtvStamm(key,value)` schreibt zurück.
- „Gesamt-MEA” ist EIN Sync-Feld (syncKey `gesamtanteile`), kein doppeltes number-Feld mehr.

### 21.6 ETV-Statuslogik (`etv_naechste`)

- Feldtyp `etv_naechste` (Feld „Nächste ETV”): Status grün/neutral/orange/rot via `etvNaechsteStatus(datumIso, wjWert, heute)`; Helfer `wjEndeDatum`, `wjAblaufJahr`, Map `ETV_STATUS_FARBE`. „dringend” (rot) ab 2 Monate vor WJ-Ende.
- **Automatisches Umspringen** (useEffect in `FieldList`, einmalig beim Mount): abgelaufenes WJ + eingetragenes Datum → Datum wandert nach „Letzte ETV”, „Nächste ETV” wird geleert.
- Felder „Letzte ETV” (date) und „Wirtschaftsjahr” (select „Kalenderjahr”/„Selbst definieren…” mit Zeitraum-Picker `TagMonatPickerModal`; Ende automatisch via `wirtschaftsjahrEnde(beginn)` = Beginn − 1 Tag).

### 21.7 Vertrags-Kontexte: Versicherung / Versorger / Messdienst

`VertragForm` + `VertragZeile` sind generisch über `kontext` (`vertrag` | `versicherung` | `versorger` | `messdienst`). `GebaeudeKarte` leitet aus `karte.kategorie` ab (`vertragKontext`). Vier Standard-Karten in `buildInitialVerwaltungsKarten`, Reihenfolge: ETV → Versicherungen → Versorger → Messdienst → Verträge. `standardKats` deckt alle ab (Bestands-Merge ergänzt).

- **Reine Render-Hilfe `renderAuswahl(wert, setWert, optionen, platzhalter, freitextPlatzhalter, extraStyle)`**: Dropdown mit gängigen Optionen + „Andere…” → Freitext. Freitext-Modus = Wert nicht leer & nicht in Optionen.
- **Versicherung:** kein Intervall/Leistung; Versicherungsart (`VERSICHERUNG_ARTEN`), Makler (KontaktPicker, nurFirmen), Selbstbeteiligung/Versicherungssumme/Kündigungsfrist (Dropdowns), Mitversichert (Chips `VERSICHERUNG_RISIKEN`). Kündigungsfrist-Default „3 Monate zum Jahresende”. Detail-Label „Versichert” (= Risiken).
- **Versorger:** Sparte (`VERSORGER_SPARTEN`) statt Typ, Vertrags-/Kundennummer, Zählernummer, Kündigungsfrist (Default „3 Monate zum Jahresende”).
- **Messdienst:** kein Typ-Dropdown (typ intern „Messdienst”, `valid = true`); Messdienstleister-Firma, Kundennummer/Liegenschaftsnr., **Wirtschaftsjahr synchron** (read-only aus `etvStamm.wirtschaftsjahr`, `wjWert`-Prop), Gerätemodell Kauf/Miete, Gerätelaufzeit 6/8/10 Jahre, Geräteart Funk/manuell, erfasste Medien (Chips `MESSDIENST_MEDIEN` inkl. RWM). Kein „Laufzeit bis”/Kündigungsfrist.
- **Farbe:** Vertragszeile-Rahmen/Hintergrund in Objekt-Akzent (`accent`); Firmenname bleibt Kontakt-Lila. Keine feine Trennlinie im Detail-Bereich.

### 21.8 TechnikKarte: zweistufige Geräte-Auswahl

- `TECHNIK_KATEGORIEN` (6 Gruppen: Energie & Heizung, Sanitär & Wasser, Lüftung & Klima, Elektro & Kommunikation, Sicherheit & Brandschutz, Förder & Zugänge) → `typen[]`. `TECHNIK_GERAET_TYPEN` = flache Ableitung (für Form-Auflösung + Bestands-Lookup; alte Typ-IDs erhalten).
- Auswahl: Stufe 1 Kategorie wählen (+ „Eigene Anlage” direkt), Stufe 2 Typ mit Zurück-Pfeil. Erst nach lokalem Edit-Stift sichtbar.
- `TechnikKarte` nimmt am Akkordeon + lokalen Edit teil (wie `GebaeudeKarte`); Geräte-Bereich an `effEdit`/`effExpanded` gebunden.

### 21.9 Stellplatz-Typen

- `isStellplatzTyp` = `["Stellplatz","Garage","Carport","Doppelparker"]`; Anlege-Dropdown enthält Garage. Karten-Menü-Option „Stellplätze / Garagen / Carports”.

-----

## 22. Belegungs-/Eigentümer-Karten & Rollen-Sync (ab v8.3x)

### 22.1 `EckPille` — Status-Overlay rechts oben

- Kleine Pille, **absolut** rechts oben über einer Karte (`position:absolute; top:8; right:10; zIndex:2; pointerEvents:none`). Der Eltern-Container muss `position:relative` sein.
- Ersetzt in Belegungs-/Eigentümer-Karten die frühere Status-Leiste unter der Karte. Inhalt: das Recht (z. B. „Mieter”) in der Belegung, „aktuell” beim Eigentümer.
- Farbe = Recht-/Akzentfarbe, Text via `getContrastColor`. **Nicht** zu verwechseln mit der globalen `StatusLeiste` (Abschnitt 12.7) — das bleibt für eingebettete Karten-Hinweise.

### 22.2 Volles Profil beim Aufklappen (Belegung/Eigentümer)

- `BewohnerLeseKarte`, `BewohnerEditKarte`, `PersonCard` zeigen **eingeklappt** die kompakte `KontaktKarte` (`kompakt ohneRahmen`) mit `EckPille`, **aufgeklappt** das volle Profil via `KontaktDetailKarte … embedded` (gleiches Innenleben wie `FeldKontaktKarte`) — Stammdaten + Notizen, `onKopfClick` klappt zu, `onGotoKontakt` als Footer.
- Dafür brauchen die Karten `kontakte` + `setKontakte` (durch die Kette gereicht; `HaushaltAnzeige` bekam `setKontakte`).
- `BewohnerEditKarte` hängt **unter** das Profil einen eigenen Block mit den belegungsspezifischen Feldern (Recht-Dropdown, Vermerk, Entfernen) — die gehören zur Belegung, nicht zum Kontakt.

### 22.3 Info-Blöcke oben (Mietvertrag / Eigentum)

- **Mietvertrag-Block** (`HaushaltMietvertrag`): Vertragspartei (aus Mieter-Bewohner abgeleitet, kein separater Picker mehr), Mietbeginn, Zeile „Bewohner · N Personen” (Gesamtkopfzahl), Konditionen.
- **`EigentumBlock`** (oben im Eigentümer-Tab, analog Mietvertrag): aktueller Eigentümer, „Eigentümer seit”, Grundbuch/Stimmrecht.
- **Beide Blöcke spiegeln den laufenden Wechsel** (ab v8.85/8.88), abgesetzt durch eine Trennlinie und in Akzentfarbe, solange der Vorgang nicht abgeschlossen ist:
  - Mietvertrag: „Auszug zum [Datum]” + „Nachfolge: [Name] · [Typ] · ab [Einzug]”.
  - Eigentum: „Verkauf an [Käufer]”, „Lastenübergang [Datum]” bzw. „… geplant”, „Grundbuch geplant [Datum]” bzw. „… umgeschrieben”. Labels datumsabhängig (ohne „geplant” = erreicht).

### 22.4 „Zusätzliche Personen ohne Kontakt”

- Im **Edit-Modus immer sichtbar** (feste Karte, startet bei 0): Anzahl-Stepper + Vermerk. Helfer in `HaushaltEditor`: `anonymMitglied`/`anonymAnzahl`/`setAnonymAnzahl(n)` (0 = anlegen bzw. entfernen) / `setAnonymVermerk`. Datenmodell unverändert: Anzahl 0 = kein gespeichertes Mitglied, ab 1 genau ein anonymes Mitglied.
- **Lese-Modus**: nur bei Anzahl > 0, und immer **unten** (Kontakt-Bewohner zuerst — stabile Sortierung via `rang(m)`: Kontakt 0, benannt-ohne-Kontakt 1, anonym 2).
- Picker „+ Bewohner hinzufügen” weist nur noch Kontakte zu (kein „Ohne Kontakt anlegen” mehr).
- Optik der Lese-Karte = Kontaktkarte: Hintergrund `t.card`, `padding 10px 12px`, Avatar-Wrapper 48 px. Avatar-Kreis + Name in der **Personen-Akzentfarbe** (`useKontaktFarbe().person`) — exakt wie echte Kontaktkarten, nicht in Rollenfarbe. **Rahmen + leichter Tint** jedoch in der **Rollenfarbe des Haupt-Bewohners** (`leitMitglied = mitglieder.find(!istAnonymesMitglied)`, dann `bewohnerRecht(recht).farbe + "30"/"08"`), damit die anonyme Karte denselben Rahmen wie die echten Karten daneben trägt — nicht ihre eigene (oft graue „Angehöriger”)-Rolle (ab v8.91–8.93).

### 22.5 Avatar nicht nachbauen — echte Werte übernehmen

Soll etwas wie ein `Avatar` aussehen (z. B. der „+N”-Kreis), exakt die `Avatar`-Render-Werte spiegeln, **nicht** frei stylen: rund `borderRadius:"50%"`, Hintergrund `farbe+"22"`, Ring `1.5px solid ${farbe}40`, `boxSizing:border-box`, Text `fontSize: size*0.36, fontWeight: FW.bold, color: farbe`. (Die `Avatar`-Komponente selbst wird **eckig**, sobald `text`/`firma` gesetzt ist — daher für runde Sonderfälle den Kreis mit diesen Werten selbst rendern statt `Avatar text=…` zu missbrauchen.)

### 22.6 Rollen-Sync — zentral beim Speichern (nicht verteilt pflegen)

- Helfer `syncZuweisungenAusEinheiten(veId, einheiten, kontakte)` (rein, **idempotent**): leitet aus dem Ist-Zustand der VE die `objektZuweisungen` je Kontakt ab. Aktuelle Eigentümer (ohne `bis`) → Rolle „Eigentümer”; Bewohner der laufenden Belegung → gemappte Rolle. Aktive Bezüge `status:"aktiv"`, weggefallene `status:"ehemalig"` (**nicht löschen**). Anonyme/ohne Kontakt: nichts. Fremde VEs und fremde Rollen (Verwaltungsbeirat, Hausverwaltung …) bleiben unangetastet.
- Recht→Rolle (`RECHT_ZU_ROLLE`): mieter→Mieter, niessbraucher→Nießbraucher, wohnberechtigt→Wohnberechtigt, eigennutzer/angehoeriger/sonstige→Bewohner. Verwaltete Rollen: `SYNC_ROLLEN`.
- **Andockpunkt:** `LiegenschaftAnsicht.setKarten` ruft nach der Einheiten-Aggregation `setKontakte(prev => syncZuweisungenAusEinheiten(ve.id, alleEinheiten, prev))`. Damit greift der Sync für alle Wege (Picker, Recht-Änderung, Belegungswechsel, Eigentümer hinzufügen/wechsel) — Prinzip „eine Wahrheitsquelle, beim Speichern ableiten” statt verteiltem Zustand.

### 22.7 Wechsel als datumsgesteuerter Vorgang (Belegung + Eigentümer, ab v8.72/8.86)

Belegungs- und Eigentümerwechsel sind **datumsgesteuerte Stepper-Vorgänge** mit identischem
Bedienmuster. Kein „abhaken per Klick” mehr — Stufen werden über **Datumseingabe** terminiert
und erst am Stichtag automatisch wirksam.

**Belegungswechsel** (`BelegungswechselVorgang`):

- Start: **inline-Formular** in der Box (kein Modal): Typ (Vermietung/Selbstnutzung), „Neuer
  Nutzer”-Picker, optionales Übergangsdatum. Handler `starteBelegungswechsel` /
  `terminiereBelegungswechsel` / `brecheBelegungswechselAb`. Bei Selbstnutzung wird der
  Eigentümer der Einheit automatisch als Nutzer übernommen (kein Picker).
- 2 Stufen (Angekündigt → Übergang); bei abweichendem Auszug ein dritter Leerstand-Punkt
  (grau `#94A3B8`). `vorgangAuszugsdatum(teil)` liest den Auszug aus dem Leerstand-Kapitel.
- Geplante Folgebelegung trägt `geplant:true`; `geplanteBelegung` filtert
  `b.geplant && (!b.von || von>heute)`. Ab Datum-Erreichen automatisch aktiv (datumsgesteuert).
- Hauptanzeige nutzt `heuteLaufendeBelegung` (kein Fallback auf beendete Belegung), damit der
  bisherige Bewohner bis zum terminierten Auszug sichtbar bleibt.

**Eigentümerwechsel** (`EigentumswechselVorgang`):

- Start: **inline-Formular** (State `eigStartForm`, Handler `starteEigVorgang`): bisheriger
  Eigentümer, Käufer-Picker. Käufer wird `status:"interessent"`, `kaufabsichtAb:isoHeute()`.
- 3 Stufen: Kaufabsicht → Lastenübergang (`kostenAb`) → Grundbuch (`von`).
- `eigStufen(kaeufer)`: `erledigt` nur wenn Datum gesetzt UND erreicht (≤heute), sonst
  `terminiert` (Datum am Kreis sichtbar, **kein** Haken).
- `eigStatus(p)` leitet den Status **aus den erreichten Datums-Meilensteinen** ab
  (interessent → werdend bei `kostenAb` erreicht → aktiv bei `von` erreicht); Verkäufer-`bis`
  macht nur ehemalig, wenn erreicht. `eigStufeAbhaken` setzt nur das Datum (`status:undefined`).
- Button-Beschriftung „[Stufe] ab (Datum)” (öffnet Datumsfeld), **nicht** „abhaken”.
- „Eigentümer hinzufügen” (Mit-Eigentümer, sofort aktiv im Grundbuch): ebenfalls **inline**
  (State `eigAddForm`, Handler `eigHinzufuegen`).

**Gemeinsame Muster:**

- Terminierte Stufe (Datum in Zukunft): Hinweis „… wird wirksam am [Datum]” (auch im Lese-Modus
  sichtbar) + „Datum ändern” / „Vorgang abbrechen”.
- **Werdende Karten** (`WerdendKarte` für Bewohner, `PersonCard isAktuell=false` für Eigentümer):
  als eigene, **leicht ausgegraute** (`opacity:0.7`, **kein** grayscale-Filter) Karte mit vollem
  Kontakt — klickbar (öffnet `KontaktDetailKarte embedded` nicht ausgegraut). Erscheinen in
  **Lese- UND Bearbeiten-Modus** (`HaushaltAnzeige` und `HaushaltEditor`), damit der kommende
  Mieter/Nutzer/Käufer schon vorab erreichbar ist.
- **Kein Modal:** `WechselModal` wurde mit v8.95 vollständig entfernt; der gesamte
  Wechsel-Komplex (Start, Hinzufügen) läuft inline. Konsequenz: ein Bedienmuster für beide
  Wechsel-Arten, kontextschonend auf Mobile.

-----

## 23. Domänen-Datenmodelle (Detail-Schemata)

Fabriken und Schemata der fachlichen Kern-Objekte. Maßgeblich ist immer der Code in
`allesda_merged.jsx`; diese Übersicht dient als Landkarte.

### 23.1 Einheit-Unterteilung — Teile (`neuerTeil`, ab v7.14)

Eine Einheit besteht aus einem oder mehreren **Teilen** (`einheit.teile[]`). Physische Daten
hängen am Teil, rechtliche/organisatorische an der Einheit.

- **`neuerTeil(name)`** → `{ id, name, flaeche, zimmer, lage, raeume:[], zaehler:[] (legacy), belegungen:[neueBelegung("leerstand")] }`.
- Bei genau **einem** Teil bleibt `name` unsichtbar; ab Unterteilung „Wohnung A” etc.
- **`flaecheVon(einheit)`** = Summe der Teil-Flächen (nicht manuell pflegen).
- Eigentümer, MEA, Verwaltungsnummer bleiben an der **Einheit**; Fläche/Zimmer/Lage/Räume/
  Belegung am **Teil**. Erstes Aufteilen vererbt die Daten an Teil 1.
- UI: Teil-Pills (flex, füllen die Zeile) + runder `+` in Stammdaten UND Belegung, Farbe `#0080FF`.

### 23.2 Räume (`neuerRaum`, ab v8.15)

**EIN gemeinsames Schema** für Gemeinschaftsräume (an der Gebäude-Karte) und
Sondereigentums-Räume (am Teil) — nur kontextabhängige Felder werden je nach Aufhängung
ein-/ausgeblendet.

- **`neuerRaum(name, lage)`** → `{ id, name, icon, lage, flaeche, art, notizen, snrAn, abrechnungsrelevant:true, zaehler:[], technik:[] }`.
- Kontextabhängig: **Gemeinschaft** zeigt `snrAn` (Sondernutzungsrecht an `{kontaktId|einheitId}`) + `art`; **Sondereigentum** zeigt `abrechnungsrelevant`.
- `art` aus `RAUM_ART_OPTIONEN` (Technikraum, Keller, Treppenhaus, Garten … + Freitext „Andere…”); beim Anlegen = Name.
- UI: `RaumKarte` aufklappbar, Optik wie Einheit-Zeile (Icon-Tile, Titel `name||art`, Untertitel Lage·Art·Fläche). Edit: Name + Icon-Picker (`KARTEN_ICONS`) im Kopf + Lage/Fläche/Art/Notizen. Anlegen `RaumAnlegen` (Button-zu-Form, wie +Einheit). Aufgeklappt: zugewiesene Technik via `hausId`+`raumId` inline klickbar.

### 23.3 Belegungsmodell — Bewohner-Rechte (Weg 2, ab v7.16)

Jeder Bewohner trägt seine **eigene Rechtsgrundlage** `recht` (`BEWOHNER_RECHTE`:
mieter / eigennutzer / niessbraucher / wohnberechtigt / angehoeriger / sonstige).

- **`neuesHhMitglied(kontaktId, name, recht, anzahl)`** — Fabrik fürs Haushalts-Mitglied.
- Belegungstyp wird **abgeleitet** (`abgeleiteterBelegungstyp(beleg)`): mind. ein Mieter → `vermietung`; sonst Bewohner vorhanden → `selbstnutzung`; keiner → `leerstand`.
- Migration `ergaenzeBewohnerRechte` (in `normalisiereVes` verkettet).
- Tab heißt **„Belegung”** (intern teils noch „Haushalt”-Bezeichner).
- Belegungs-/Eigentümerwechsel sind datumsgesteuerte Vorgänge → siehe §22.7.

### 23.4 Stellplatz (ab v7.16)

Eigener, reduzierter Belegung-Tab (Status + eine Nutzer-Partei + Mietvertrag; „Nutzer” statt
„Bewohner”; keine anonyme Kopfzahl).

- Rechtliche Stellung **`spStellung`** (`se_bestandteil` | `ge_snr` | `eigenstaendig`) + **`spEinheitId`** (Picker auf eine Einheit im selben Objekt).
- Bei `se_bestandteil`/`ge_snr` zeigt der Eigentümer-Tab den Eigentümer der **verknüpften Einheit**.
- Ersetzt den alten `rechtsstatus` (SE/GE/SNR); Fallback bleibt. Migration noch offen (§19/Roadmap).
- `geschwisterEinheiten` als Prop an `EinheitDetail`.

### 23.5 Dokumente-Tab (ab v8.23)

`DokumenteAnsicht` analog `VerwaltungAnsicht`; Daten in `ve.dokumenteKarten`.

- Erste Karte **`DokumenteChecklist`** aus `DOKUMENT_KATALOG` (13 Standard-Unterlagen).
- Edit: Liste mit Checkboxen. Haken → Dokument-Karte (`neueDokumentKarte`: `dokumentBasisFelder()` [Vorhanden seit / Ablage / Zuständig (kontakt) / Notiz] + typspezifische Felder). Haken weg → entfernen (mit Abfrage).
- Lese: nur angehakte, ohne Checkbox. Karten `kategorie=stammdaten` + `dokumentId` → `GebaeudeKarte`/`FieldList`. Zusätzlich „Eigenes Dokument hinzufügen”.
- Terminologie: stabile Grundlagen = **Stammunterlagen** (Teilungserklärung, Gemeinschaftsordnung, Aufteilungspläne); laufende Aufzeichnungen = **Dokumentation**.

### 23.6 Objekt-Detail-Tabs konfigurierbar (ab v8.20)

Reihenfolge + Sichtbarkeit global in `settings.objektTabs` (`{id,label,icon,aktiv,fix,reihenfolge}`).

- Liegenschaft + Verwaltung **fix** (immer sichtbar, vorne). Default: Liegenschaft, Verwaltung, Dokumente, Kontakte, Bilder, Historie.
- `ObjektTabsContext` → `VEDetail` nutzt `useObjektTabs()` (sortiert nach `reihenfolge`, filtert `fix||aktiv`, Fallback).
- Bearbeitet in Einstellungs-Sektion „Objekte” (`SektionObjektTabs`: Pfeile + Toggle + Reset; fixe ohne Toggle/Pfeile).

### 23.7 Technik / Geräte (ab v8.10)

Geräte = aufklappbare **`GeraetKarte`** (zu: Icon + typLabel + Standort; auf: Lese = `FieldList`, Edit = `TechnikGeraetForm`).

- Felder via **`technikStandardfelder(typId)`**: System (select je Typ aus `TECHNIK_SYSTEM_OPTIONEN`), Hersteller, Baujahr, Nummer, Wartungsfirma + Zugang (kontakt), Letzte/Nächste Wartung.
- Migration `ergaenzeTechnikGeraetFelder`.
- Zuordnung Haus/TG → Raum ODER Einheit + Zuständigkeit (Gemeinschaft/SE; SE → Eigentümer automatisch).
- Anlegen: `+`-Button → 2 Dropdowns (Kategorie / Typ).

-----

## 24. SEV, Kategorien, Verwendung↔Belegung & Kalender (ab v9.x)

### 24.1 Kategorien-System (gemeinsame Kürzel+Farbe für Paare)
`DEFAULT_KATEGORIEN` {id,label,kuerzel,color}: miete(M/#22C55E),
niessbrauch(N/#0EA5E9), wohnrecht(W/#A855F7), sev(SEV/#7C3AED). Wo eine
Verwendung UND eine Rolle dasselbe Konzept beschreiben, tragen beide ein
`kategorie`-Feld und ERBEN Kürzel+Farbe daraus. Auflösung über `effKuerzel(def,
kategorien)` / `effColor(def, kategorien)` — geerbt wenn `def.kategorie` gesetzt,
sonst Eigenwert. `kategorieVon(def, kategorien)` liefert die Kategorie.
KategorienContext/useKategorien/Provider. RolleBadge+VerwendungBadge nutzen die
eff-Helfer. Einstellungen: Sektion „Kategorien" (KategorienTabelle, vor
Verwendungen) editiert Label/Kürzel/Farbe; Rollen/Verwendungs-Tabellen zeigen
geerbte Werte read-only („aus Kategorie …"). Migration in
migriereGewerkeLeistungen (idempotent). Eigene Eigenheiten (eckPosition, slot,
eckSichtbar) bleiben getrennt bei Verwendung/Rolle. **Eine Kategorie-Änderung
wirkt auf beide Seiten** — das ist der Sinn.

### 24.2 Rollen-Definitionen (Ergänzungen)
Neu in DEFAULT_ROLLEN: „Sondereigentumsverwaltung" (SEV/#7C3AED/slot:sev,
kategorie:sev) und „Bewohner" (B/#64748B/slot:ve, **eckSichtbar:false** = kein
Avatar-Badge, nur Text/Profil — „Besonderes kennzeichnen, Normalität nicht").
Mieter/Nießbraucher/Wohnberechtigter tragen jetzt kategorie. Avatar-Eck-Badge
und objektBezugInfo suchen Rollen-Def in BEIDEN Listen (Personen+Firmen,
typgerecht zuerst), damit die SEV-Rolle auch an einer Firma greift.

### 24.3 SEV-Modell (Sondereigentumsverwaltung)
`einheit.sev[]` (Liste, chronikfähig): {id, kontaktId, name, seit, bis,
vollmacht:{erteilt,datum}}. Helfer: sevStatus (aktiv/werdend/ehemalig via seit/
bis datumsgesteuert), laufenderSevWechsel, starteSevWechsel (alte endet bis=
Datum, neue beginnt lückenlos), brecheSevWechselAb, sevBeenden (setzt bis ohne
Nachfolger), syncSevVerwendung (hält Verwendung „Sondereigentumsverwaltung"
synchron), heileSevVerwendung (entfernt verwaiste SEV-Verwendung),
ergaenzeSevFeld (Migration). **WICHTIG: neueSevId OHNE Top-Level-let** (TDZ-
Falle — nutzt Date.now()+Random).

**Verortung (ab v9.11):** Anlegen/Pflegen NUR im **Eigentümer-Tab** (unter
belegungEdit; SEV handelt im Auftrag des Eigentümers; voller Block mit
FeldKontaktKarte). In Stammdaten nur read-only SEV-Info, gebündelt mit der
Verwendung in EINEM Rahmen.

**Wechsel ODER Ende (ab v9.12):** EIN Formular. Neue SEV gewählt → „Wechsel
starten" (sevWechselStarten). Leer + vorhandene SEV → „SEV beenden" (sevBeenden
auf aktiven Eintrag mit dem Datum). Vollmacht gilt ab Beauftragung (= s.seit),
kein eigenes Vollmacht-Datum. Enddatum deutlich in SEV-Violett, rechtsbündig in
der oberen Status-Zeile. Vollmacht als „· mit Vollmacht" an SEV-seit-Zeile.

### 24.4 Verwendung↔Belegung-Kopplung
Belegungs-Verwendungen (Vermietet/Eigennutzung/Leerstand) sind NICHT frei
wählbar, sondern LIVE aus der Belegung abgeleitet. Konstanten
BELEGUNG_VERWENDUNGEN + BELEGUNGSTYP_ZU_VERWENDUNG. `belegungsVerwendungen(einheit)`
leitet ab. Zentraler Hebel `verwendungenVon(einheit)`: verwirft gespeicherte
Belegungs-Verwendungen + ergänzt abgeleitete live → alle Leser (Anzeige/Badge/
Aggregat) automatisch konsistent. Im Editor hält der verwendungen-State nur die
freien (rechtlichen) Verwendungen: Sondernutzungsrecht, Verpachtet, Nießbrauch,
Wohnberechtigt.

### 24.5 Kontakt-Rollen-Ableitung (zentral)
`objektZuweisungenAusEinheiten(ve)` leitet aus den Einheiten ab: Eigentümer
(eigStatus), SEV (sevStatus), Mieter/Bewohner (Belegungsmodell via
belegungsPhase; belegPhaseZuStatus: aktuell→aktiv/geplant→werdend/beendet→
ehemalig). `wendeKontaktZuweisungenAn(kontakte, ve)` ersetzt nur einheit-
bezogene Zuweisungen für DIESES Objekt (HV/Beirat/andere Objekte unangetastet).
Angedockt am zentralen Commit in LiegenschaftAnsicht.setKarten. Nicht-Mieter-
Bewohner → Sammelrolle „Bewohner".

### 24.6 Belegung-Info-Block für alle Typen
`HaushaltNutzungInfo` (parallel zu HaushaltMietvertrag, gleiches Label/Wert-
Layout): Eigennutzung → Eigennutzer/„Genutzt seit"/Bewohnerzahl; Leerstand →
„Leer seit". Plus Nachfolge bei laufendem Wechsel. Stellplatz → „Nutzung"/
„Nutzer". In HaushaltAnzeige: Vermietung=HaushaltMietvertrag, sonst
HaushaltNutzungInfo.

### 24.7 Kalender-Quellen (sammleTermine)
Filter-Typen (KALENDER_TYPEN): verwaltung, etv, wahl, vertrag, **technik**,
**eigentuemer**, **belegung**, **sev**, jahrestag. sammleTermine sammelt:
- Verwaltung (bestelltBis, naechsteETV, naechsteWahl), Verträge (ab/bis/
  intervall — deckt auch Versicherung/Versorger ab, die als ve.vertraege liegen).
- **Einheiten-Wechsel:** Eigentümerwechsel (eigStufen am werdenden Käufer: alle
  3 Stufen Kaufabsicht/Lastenübergang/Grundbuch, #F472B6), Belegungswechsel
  (geplante Belegung via **belegungsPhase**==="geplant" → Einzug/Nutzungsbeginn;
  laufende.bis → Auszug; #0080FF), SEV (werdend.seit → Übergabe; aktiv.bis →
  Ende; #7C3AED).
- **Karten-Fristen:** über ve.verwaltungsKarten + ve.dokumenteKarten, deren
  felder/stamm + technikGeraete[].felder. Heuristik `istFristFeld(name)`: nur
  date-Felder mit Frist-Charakter (nächst/gültig bis/ablauf/prüfung/wartung/
  sanierung/ausweis/schlüsseldienst/frist); ausgelassen: „Letzte…", „Vorhanden
  seit", „Ausgestellt/Erstellt/Beschlossen/Beurkundet/Aktualisiert am", „Stand".
  Wartung→typ technik(#0EA5E9), sonst verwaltung(#F59E0B).
- Kontakt-Jahrestage (jährlich wiederkehrend).
- **Manuelle Termine (ab v9.33):** `ve.termine = [{id, titel, datum(iso),
  einheitId|null, kontaktIds[]}]` → Typ **termin** (#22C55E, vorn in
  KALENDER_TYPEN). Anlage über `TerminAnlegen` (Inline-Form im Kalender-Kopf,
  36px-Pill-Plus in Kalender-Bereichsfarbe): Bezeichnung-Dropdown
  TERMIN_VORSCHLAEGE + „Andere…"-Freitext, DatumFeld iso, ObjektPicker
  (Pflicht), Einheit-Select optional, KontaktPicker mehrfach (Objekt-Bezug
  zuerst, Checkbox „Alle Kontakte"). Löschen in der aufgeklappten Zeile.
Nur künftige Stichtage mit bekanntem Datum im Fenster (Default 12 Mon).

**Eintrags-Verknüpfungen (ab v9.39):** Jeder sammleTermine-Eintrag trägt
`einheitId` + `kontaktIds` und ein sprechendes `ziel.label` („Zur Verwaltung",
„Zur ETV", „Zu den Versicherungen/Versorgern", „Zum Messdienst", „Zu den
Verträgen", „Zu: <Kartenname>", „Zur Einheit"). Aufgeklappte KalenderZeile:
Rahmen/Tint/Trennlinie/Sprung-Button in KALENDER-Bereichsfarbe (rahmenFarbe);
Icon+Typ-Label behalten Typ-Farbe; kleine Karten (FeldKontaktKarte je Kontakt,
FeldEinheitKarte bzw. FeldObjektKarte) für Verknüpfungen, Namen ohne kontaktId
als Textzeile.

### 24.8 Verifikations-Workflow (WICHTIG)
Build: `esbuild mount.jsx --bundle --format=iife --loader:.jsx=jsx`. Mount-Test
per **eval des iife-Bundles im selben JSDOM-Kontext** (NICHT require!) — nur so
werden Top-Level-/TDZ-Fehler gefangen, wie sie der echte Artifact-Runner zeigt.
act-Warnungen filtern. Erfolg = DOM ~121.017 (ab v9.48; davor 118.060 — drei
neue aktive Dashboard-Kacheln), ERR=0. Unittests via CJS-Build mit
`--footer:js='module.exports={…}'` und `--external:react`.

-----

*Ende — wenn du einen Konflikt zwischen dieser Doku und dem Code findest: erst die Doku konsultieren, dann mit dem User klären.*

## 25. Historie, Gruppen, Statusleiste, Statistik (v9.33–v9.50)

### 25.1 Historie-Tab (Objekt)
`HistorieAnsicht` ersetzt den Platzhalter. `sammleHistorie(ve, kontakte)` leitet
ALLES aus dem Bestand ab (kein Ereignis-Log): Eigentümer-Stufen (eigStufen;
grundbuch→„Eigentum (Grundbuch)") + Eigentümer-Ende, Belegungen (Einzug/
Nutzungsbeginn/Auszug je teileVon-Belegung, anonyme Mitglieder gefiltert), SEV
(beauftragt/Übergabe/Ende), Verwaltung (Verwaltungsbeginn mit Verwalter-Name,
Bestellungsende — kanonisch aus Karten), manuelle Termine. HISTORIE_TYPEN:
eigentuemer #F472B6 / belegung #0080FF / sev #7C3AED / verwaltung #F59E0B /
termin #22C55E. Filter: Typ-Chips (FilterButtons), Zeitraum Alle/Aktuelles WJ/
Letztes WJ (`wjBereich(wjWert, versatz)` aus wjEndeDatum; Quelle
ve.etvStamm.wirtschaftsjahr) / frei Monat-Jahr (MonatJahrPickerModal),
Einheiten-Select. Gruppierung nach Jahr desc; HistorieZeile aufklappbar
(Akkordeon) mit kleinen Karten, „geplant"-Badge für Zukunft, relative Zeit
(`historieZeitText`: vergangen „vor X Tagen/Monaten/Jahren", Zukunft via
restzeitText). Helfer `alleEinheitenVonVe(ve)` (Karten kanonisch, Fallback
ve.einheiten).

### 25.2 Zwei-Schritt-Löschen statt confirm()/alert() (VERBINDLICH für neue UI)
`window.confirm` UND `window.alert` sind in iOS-Standalone-PWAs auf etlichen
Versionen stumm kaputt (confirm liefert false ohne Dialog; alert erscheint nicht).
Auch `window.open()` ist betroffen (neue Tabs/Fenster werden blockiert) — siehe
§26.3. Muster: erster Tap macht den Lösch-Button scharf (rot ausgefüllt,
„Löschen?\"), zweiter Tap löscht; jede andere Interaktion entschärft (State
`loeschBereitId`). Umgesetzt zuerst in SektionGruppen (v9.47).
**confirm()/alert()-Sweep abgeschlossen (v9.51):** Alle window.confirm/alert aus
der UI entfernt. Termin löschen (KalenderZeile, Zwei-Schritt mit „Löschen?\"-Text),
Ordner-Anbindung trennen (Zwei-Schritt + Hinweiszeile), Einstellungen/Daten
zurücksetzen (Zwei-Schritt rot), Import von Daten/Einstellungen/Excel (Inline-Box
`ImportMeldung`: Bestätigung mit Zusammenfassung + Schema-Warnung, oder rote
Fehler-Box). `schemaImportOk`→`schemaWarnung` (liefert Warntext statt confirm);
`importiereJSON` hat einen `onFehler`-Parameter. `ImportMeldung`-Komponente mit
Varianten „bestaetigen\"/„fehler\". Dokument-Checklist-Abwahl war schon inline.
Generisches Baustein-Paar: Zwei-Schritt-Button (Aktion sofort, Feedback per Text)
für reversible/schnelle Fälle; Inline-Box für Importe mit Zusammenfassung.

### 25.3 Eigene Gruppen (Objekte + Kontakte)
`settings.kontaktGruppen` / `settings.objektGruppen` = `[{id, name, kurz,
sichtbar, modus:"manuell"|"kriterien", mitglieder:[IDs], kriterien}]`. Matching:
`kontaktInGruppe` (Kriterien = aktive Rollen der objektZuweisungen, ODER);
`objektInGruppe` (Dimensionen UND, innerhalb ODER: verwaltungsarten mit Default
„weg", orte via `objektOrt(ve)` = letzter Adress-Teil durch splitPlzOrt).
Verwaltung: gemeinsame Komponente `SektionGruppen` in Einstellungen→Objekte
(„Objekt-Gruppen") + Einstellungen→Kontakte („Kontakt-Gruppen"): Akkordeon,
Name+Kürzel-Inputs, „Pille"-Sichtbarkeits-Toggle, Modus-Pills, Häkchen-Suchliste
bzw. Kriterien-Chips, Auto-Benennung (Name+Kürzel aus Kriterien-Labels/Rollen-
kuerzel, „+"-verkettet, solange Name unberührt), ✓-Fertig-Button, Zwei-Schritt-
Löschen. Header: ZWEITE FilterButtons-Instanz (Label = kurz||name), UND-
kombinierbar mit Art-Pillen (filterKontaktGruppe/filterObjektGruppe; Kontakte
via vorgefilterter kontakteFuerListe-Prop, Objekte in der gefiltert-Pipeline);
Titel-Klick resettet beides.

### 25.4 Statusleisten-Inhalte (Einstellungen → Statusleiste)
Alle Inhalte einzeln schaltbar via settings.statusInhalte (Default an).
**Objekte** (VEKachel; kanonische Quellen via `veKartenFeldWert(ve, kategorie,
feldName)`): Priorität error „Bestellung abgelaufen" > warn „endet <90" > Info
ETV ≤30 > Begehung ≤30 > nächster Termin ≤14 (mit Titel). Keys:
bestellungAblauf, naechsteETV, naechsteBegehung, naechsterTermin.
**Kontakte** (`berechneKontaktStatus`, rollen-spezifisch): WOHN_ROLLEN (Mieter/
Bewohner/Eigennutzer/Nießbraucher/Wohnberechtigter) → „Einzug"/„Auszug";
Eigentümer → „Wird Eigentümer"/„Verkauf"; sonstige generisch mit Rollen-Zusatz;
nächstliegendes gewinnt (warn ≤7 werdend / ≤14 endend). Keys: geburtstag,
einzugAuszug, eigentumswechsel, zuweisungAblauf, ehemaligHinweis („Keine
aktiven Beteiligungen" = nur ehemalige Zuweisungen, Archiv-Erkennung).
„Eigentümerwechsel in Vorbereitung" nur noch Fallback ohne nahes Datum.
**WICHTIG:** `heute` IMMER auf Mitternacht normalisieren (setHours(0,0,0,0)) —
sonst runden Tages-Differenzen nachmittags einen Tag zu niedrig.

### 25.5 Dashboard-Kacheln + Lade-Merge
Neue Kacheln: statistik (chart, #6366F1), listen „Listengenerator" (sort,
#0E7490), fotos (paint, #EC4899) — alle aktiv, Reihenfolge 9–11. Der
ladeSettings-useEffect ergänzt fehlende Default-Kacheln im Bestand per id-
Vergleich (Muster wie Rollen-Merge) — neue Kacheln NIE nur in DEFAULT_SETTINGS
eintragen, der Merge macht sie für Bestands-Settings sichtbar.

### 25.6 Statistik-Dashboard (Kachel „Statistik")
`StatistikScreen` (live abgeleitet, keine Persistenz; Bausteine StatKpi/
StatPanel/StatBalkenZeile): KPI-Grid (Objekte je Verwaltungsart, Einheiten
WE·SP via isStellplatzTyp/STAT_WOHN_TYPEN, Fläche = Summe teileVon-Flächen mit
Fallback einheit.flaeche, Kontakte P·F, Leerstandsquote %, Termine 30 Tage je
Typ via sammleTermine); Belegungs-Stapelbalken (belegungsTyp); Verteilungen
(Verwaltungsart, Ort Top 8, aktive Rollen Top 6); Fristen (Bestellungen
abgelaufen/<90, kanonisch). **Technik & Ausstattung (nur Gepflegtes):**
Heizsysteme (Technik-Geräte typId „heizung" Feld „System"; Fallback Stammfeld
„Heizart" je Objekt), Glasfaser (Gebäude-Feld „Glasfaser – Stand"), Messdienste
(Messdienst-Verträge, firmaId→Kontaktname; je Objekt einfach). Ohne Daten:
erklärendes Hinweis-Panel. Erweiterung = je ein Zähler + ein Panel.

-----

## 26. DSGVO am Kontakt (v9.52–v9.55)

### 26.1 Einstufung der Löschbarkeit (`dsgvoEinstufung`)
Zentrale Helferfunktion, bestimmt aus `kontakt.objektZuweisungen`, wie gewichtig
eine Löschung ist — Rückgabe `"gruen"` / `"gelb"` / `"rot"`:
- **gruen** — keine schützenswerte Objektbindung → frei löschbar (z. B. ein
  Handwerker, der nur als Kontakt angelegt wurde).
- **gelb** — nur EHEMALIGE objektbezogene Rollen (Alt-Eigentümer, Ex-Mieter) →
  Aufbewahrungsfristen möglich, Löschen mit deutlicher Warnung.
- **rot** — mind. eine AKTIVE/werdende objektbezogene Rolle → Löschen GESPERRT.
**WICHTIG (v9.53):** Eine reine Firmen-ANSTELLUNG (`firmaId` ohne objektId/
einheitId/geraetId) ist KEINE Sperre — ein ausgeschiedener Mitarbeiter hängt
nicht an Objekt-Aufbewahrungspflichten; die über die Firma abgeleiteten Objekt-
Rollen gehören der Firma, nicht der Person. Ebenso ignoriert: eingehende
Vertretungs-/Betreuungsvermerke (`zielKontaktId` ohne objektId). Unbekannter
Status zählt vorsichtshalber als aktiv.

### 26.2 DSGVO-Bereich im Kontaktprofil (`KontaktDsgvoAktionen`)
Eigener Abschnitt „Datenschutz (DSGVO)" unten im VOLLSTÄNDIGEN Profil, nur im
Lese-Modus und nur wenn `!embedded && !objektFilter && !editMode` (eingebettete
Karten / Objekt-Kontext zeigen ihn nicht). Drei Buttons:
- **Auskunft als PDF** — IMMER sichtbar (Auskunft erteilen ist unbedenklich),
  Art. 15 DSGVO. Sammelt Stammdaten + Rollen/Objekt-Verknüpfungen.
- **Kontakt löschen** — ERSETZT den alten Lösch-Button im KDKHeader. Nur bei
  Personen + freigeschaltetem `loeschenErlaubt.kontakte`. Abgestuft:
  gruen→2 Klick (knapper Hinweis) · gelb→2 Klick + orange Warnbox (Aufbewahrung
  6–10 J., verweist auf Anonymisieren) · rot→Button gesperrt + roter Hinweis
  „erst aktive Rollen beenden". Bestätigungs-State läuft nach 6 s aus.
- **Anonymisieren** (v9.63, §26.5) — NUR bei Stufe gelb, nur Personen, gleiche
  Schalter-Bindung (`loeschenErlaubt.kontakte`), eigene 2-Klick-Bestätigung
  (orange); beide Bestätigungs-States setzen sich gegenseitig zurück.
Der Sicherheits-Schalter „Kontakte löschen erlauben" (settings.loeschen-
ErlaubtKontakte, Einstellungen→Kontakte→Sicherheit) bleibt der Hauptschalter.

### 26.3 Druck-Baustein `druckeHtml` — synchroner window.print() (v9.61)
Gemeinsamer Baustein für ALLE Drucke (DSGVO-Auskunft, Listengenerator, Tastatur).
**iOS-Safari-Regeln (hart):** (1) `window.print()` MUSS synchron in der User-Geste
laufen — jeder setTimeout/onload-Umweg gilt als „automatisches Drucken" und wird
gesperrt („Diese Seite wurde für das automatische Drucken gesperrt"). (2) NIEMALS
print() doppelt aufrufen (gleiche Sperre). (3) Kein window.open (Popups in
Standalone blockiert), kein iframe-print (unzuverlässig/als automatisch gewertet;
der frühere iframe-Weg v9.55–9.60 scheiterte daran).
**Lösung:** Print-Only-Container `#allesda-print-bereich` im HAUPTdokument +
`@media print`-Style, das `body>*:not(#container)` ausblendet; dann genau EIN
synchroner `window.print()`. Aufrufer-`extraCss` wird automatisch per Regex auf
den Container gescoped (einfache `sel{…}`-Ketten ohne Kommas voraussetzen!).
`document.title` wird temporär auf den Drucktitel gesetzt (→ PDF-Dateiname) und
per `afterprint` zurückgesetzt; Container/Style werden per afterprint und
spätestens beim nächsten Druck entfernt. Signatur:
`druckeHtml(titel, bodyHtml, quer, extraCss)` — quer=true → A4 landscape.

### 26.4 Zwei Lösch-Wege, EIN Regelwerk
Personen lassen sich an zwei Stellen löschen — beide respektieren `dsgvoEinstufung`:
1. DSGVO-Bereich im Profil (§26.2).
2. Firma-Mitarbeiterliste (`KDKMitarbeiterSektion` → `ZeilenAktionen`): Bei
   Einstufung „rot" wird `onLoeschen=null` gesetzt → kein Komplett-Lösch-Button,
   nur „Verknüpfung lösen" (löst `firmaId` + firmen-abgeleitete Zuweisungen,
   Person bleibt). `ZeilenAktionen` zeigt im scharfen Zustand jetzt Text
   („Löschen?"/„Lösen?", Button wird breiter) statt nur Farbwechsel.

### 26.5 Anonymisierungs-Pfad (v9.63) — FERTIG
`anonymisiereKontakt(k)` ersetzt UNWIDERRUFLICH alle personenbezogenen
Klartext-Felder durch Platzhalter: Name/Anrede/Titel, tels/emails (+ Legacy
telefon/mobil/email), Adresse inkl. Favorit-Flags, Geburtstag, Notizen,
customFelder, Foto. `id` und `objektZuweisungen` bleiben — Belege/Historie
bleiben referenzierbar. Anzeigename danach „Kontakt #<Kürzel>"
(`kontaktAnonymKuerzel`: letzte 4 Ziffern der id; kurze ids ganz). Der
Platzhalter steht in `nachname` UND `name`, damit alle Anzeige-Pfade greifen.
Marker `k.anonymisiert` = ISO-Datum.
**Schreibschutz danach (KontaktDetailKarte):** `gesperrt = !!k.anonymisiert`
zwingt editMode hart auf false (intern UND extern) und blendet den
Header-Stift aus (`headerOhneEditBtn || gesperrt` — gesperrt MUSS vor
headerOhneEditBtn definiert sein, TDZ!). Foto-Upload aus; in der Firmen-
Mitarbeiterliste sind Löschen + Notizen-Inline-Edit gesperrt („Verknüpfung
lösen" bleibt — Datenpflege der Firma). Der DSGVO-Bereich zeigt nur noch
eine Status-Box mit Anonymisierungs-Datum (keine Auskunft mehr — über
Platzhalter sinnfrei).

-----

## 27. Listengenerator (v9.58–v9.59)

### 27.1 Architektur
Dashboard-Kachel „listen" → `ListenGeneratorScreen`. ALLES Vorlagen-getrieben:
`LISTEN_KATALOG` = Array von Vorlagen `{ id, icon, label, sub, bereich
("objekt"|"alle"), hausFilter, sonder, hatRollenFilter, spalten:[{id,label,
default}], filter:[{id,label,default}], zeilen(ctx), fussnote(rows) }`.
`ctx = { ve, ves, kontakte, f (filterState), hausId, rolleFilter }` — zeilen()
liefert Row-Objekte mit `row[spaltenId]` als String. **Neue Liste = neuer
Katalog-Eintrag, kein Screen-Code.** 11 Vorlagen: Eigentümer, ETV-Anwesenheit,
Bewohner, Personenzahl, Klingelschild, Einheiten, Telefon/Notfall, Technik,
Verträge (objektbezogen) + Leerstand, Kontakte-nach-Rolle (alle Objekte).

### 27.2 Helfer (lg*)
`lgKartenVon(ve)` (persistierte ve.karten, sonst buildInitialKarten — gleiches
Fallback-Muster bei Verträgen via buildInitialVerwaltungsKarten);
`lgHaeuserVon` / `lgEinheitenVon(ve, hausId)` (Haus-Dropdown bei >1 Gebäude;
Technik filtert über `g.hausId`); `lgBewohnerZeilen(einheit)` läuft über ALLE
Teile + Eigennutzer-Fallback (keine gepflegten Bewohner, aber Selbstnutzung →
aktive Eigentümer als „Eigennutzer"); `lgPersonenZahl`; `lgHvKontakt(ve,
kontakte, fallback)` zieht „Verwalter (Firma)" aus der verwaltung_stamm-Karte;
`lgMeaSumme` (null bei nicht-numerischen Werten).

### 27.3 ETV-Stimmprinzipien
Spalten `stimmeObjekt`/`stimmeKopf`: „1" nur in der ERSTEN Zeile je Einheit bzw.
je Person (Dedup über kontaktId||Name) — Fußnote summiert: „Summe MEA · Einheiten
(Objektprinzip) · Köpfe (Kopfprinzip)".

### 27.4 Darstellung + Druck
Blatt-Vorschau = weißer Container mit festen Hell-Farben (Theme-unabhängig),
identisch zum Druck: Titel/Datum, Logo rechts (settings.hvLogo DataURL, Upload in
Einstellungen→Hausverwaltung via dateiZuLogoDataUrl — proportional, PNG/
Transparenz, KEIN Quadrat-Crop), HV-Kopfblock (getönt, fett), Tabelle bzw.
Klingelschild-Kästchen. Pillen: Hoch/Quer, Schrift s/m/l (LG_FONT), Abstand
kompakt/normal/weit (LG_PAD), HV-Kopf an/aus, Logo an/aus, Klingelschild
Tabelle/Schilder. Druck über druckeHtml (§26.3).

## 28. Tastatur-Bedienung (v9.60–v9.62)

### 28.1 Katalog + Belegung
`TASTATUR_AKTIONEN` = `{ id, gruppe, defaultKey, label, beschreibung, fest? }`.
Gruppen: Navigation (h/o/k/t/l/s/e → Screens), Aktionen (/ Suche-Fokus, ? Hilfe-
Sprung in die Sektion, n Neu), Listen (↑/↓ Cursor, Enter Öffnen, Esc Zurück —
Esc ist FEST, da es im Aufnahme-Modus abbricht). Overrides in
settings.tastaturBelegung; `tastaturBelegungVon(settings)` merged. Sondertasten-
Whitelist `TASTATUR_SONDER` (Pfeile, Enter); Anzeige via tastaturTasteAnzeige
(↑ ↓ Esc). Schalter settings.tastaturAn.

### 28.2 Globaler Handler (Haupt-App)
useEffect OHNE Dependency-Array (frische Closures). Guards: nie in input/
textarea/select/contentEditable; nie mit Strg/Cmd/Alt (Shift erlaubt, „?");
Enter/Esc/Space auf button/a nicht kapern (native Bedienung).

### 28.3 Listen-Cursor (DOM-basiert, Stufe 2+3)
KEIN React-Fokus-State: Karten tragen `data-kb-item="1"` (Prop `kbItem` an
KontaktKarte + VEKachel, gesetzt in Kontakt-Übersicht + Objektliste). Markierung
= Attribut `data-kb-aktiv="1"` + injiziertes CSS (#allesda-kb-style, blauer
Outline). ↑/↓ sammeln sichtbare Items (getBoundingClientRect>0), bewegen die
Markierung, scrollIntoView nearest; ohne Items wird NICHT preventDefault
(normales Scrollen). Enter → markiertes Element `.click()`. Re-Renders werfen
die Markierung gutmütig weg (Cursor-Reset).

**Stufe 3 (v9.65) — fest verdrahtete Listen:** KalenderZeile (Kalender),
EinheitZeile-Kopf (Einheiten im Objekt), SektionKachel (Einstellungs-Zentrale,
nur wenn klickbar), Listengenerator-Vorlagen. Diese Komponenten sind IMMER
Listenelemente → Attribut fest am onClick-Element, kein Prop.
**⌨ KONVENTION (verbindlich für ALLE neuen Bausteine):** Jede klickbare
Listen-Zeile/-Kachel bekommt `data-kb-item="1"` direkt am onClick-Element
(fest; kbItem-Prop NUR wenn der Baustein auch in Nicht-Listen-Kontexten lebt,
wie VEKachel/KontaktKarte). Jeder Zurück-Button `data-kb-zurueck="1"` (ohne
sichtbaren Button: KbZurueckHook), jeder Neu-Button `data-kb-neu="1"`. Der
Handler ist rein DOM-basiert — neue Bausteine funktionieren damit automatisch,
ohne Handler-Änderung. Konventions-Kommentar steht auch direkt am Handler.

### 28.4 Zurück/Neu-Ziele
Esc klickt das LETZTE sichtbare `[data-kb-zurueck="1"]`; n das erste
`[data-kb-neu="1"]`. Markiert: Sticky-Header „Zurück zur Liste" + „Neues
Objekt"/„Neuer Kontakt"/„Neuer Termin"; seit v9.65 auch: Einstellungs-Sektion
→ Übersicht (beide Zurück-Buttons) und Listengenerator → Vorlagenwahl. Für
Desktop-Master-Detail (kein
sichtbarer Zurück-Button) gibt es `KbZurueckHook` — ein unsichtbarer
1×1-px-Button (opacity 0, pointerEvents none, tabIndex −1), der per .click()
das Detail schließt (Kontakte: setAktiv(null); Objekte: setExpandedVEId(null)).
Neue Screens: Items per kbItem-Prop, Zurück/Neu per data-Attribut anschließen.

### 28.5 Einstellungen + Druck
Sektion „Tastatur" (SEKTIONEN id tastatur, grün): Toggle, je Aktion Zeile mit
Beschreibung + Tasten-Button (Klick → „Taste…", nächster Tastendruck wird
zugewiesen; Esc bricht ab; Konflikt wird mit Hinweis ABGELEHNT — keine
Doppelbelegung möglich; feste Aktionen ausgegraut). „Auf Standard zurücksetzen"
leert die Overrides. „Übersicht drucken" → druckeTastaturUebersicht (kbd-Optik)
über druckeHtml. Die Zentrale hört auf CustomEvent „allesda:zentrale-sektion"
(für den ?-Sprung).

-----

## 29. Schnelleingabe (v9.67–v9.72)

Eigener Tab `schnelleingabe` (#0080FF, reihenfolge 12), Screen `SchnelleingabeScreen`, drei Modi (Umschalter, segBtn `RAD.sm`):

- **Neu anlegen** — Ziel-Umschalter **Neues Objekt** (Standard; Bezeichnung*, Straße*, PLZ, Ort, Verwaltungsart; Schema identisch `ObjektAnlegen`: `ve-<ts>`, `joinPlzOrt`) / **Bestehendes Objekt** (Dropdown + Bestand). Muster-Generator `seBaueZeilen`: Fortlaufend, Etagen×Seite (Pills → Lage), Stellplätze → editierbares Raster (nr, Typ, Lage, Fläche, Zimmer, MEA). Einheiten-IDs `e-<ts>-<index>` (kollisionssicher bei Bulk!), Fläche „ m²"-Suffix, Stellplätze `spStellung`/`spEinheitId`.
- **Bearbeiten** — Ebenen Einheiten (objektübergreifend, Objekt-+Typ-Filter) / Objekte (Verwaltungsart). Checkbox-Mehrfachauswahl, Aktionen setzen/nur-wenn-leer/leeren, **Vorschau-Modal** (alt→neu, No-Ops gefiltert), **Undo** per Feld-Snapshot.
- **Schlüssel** — siehe §30.

Screen-Wrapper: Mobil Block-Fluss (`width:100%`, `alignSelf:stretch`), Desktop eigener Scroll (`flex:1; minHeight:0; overflowY:auto`) — Flex-Kind mit `margin:auto` ohne width kollabiert (Lehre v9.68/69).

## 30. Verteilerschlüssel (v9.72)

Defaults+Delta-Muster (wie Kategorien): `DEFAULT_VERTEILERSCHLUESSEL` (mea, flaeche, einheiten, personen — fix), `ve.verteilerschluessel` speichert NUR Overrides (Personen-`anteile`) + eigene (`vs-<ts>`, name, basis, anteile). Helfer `effVerteilerschluessel(ve)`, `vsWertVon(s, einheit)` (parseFlaeche/flaecheVon), `vsBasisLabel`, `vsIstManuell`. Basen mea/flaeche/einheiten = berechnet (read-only); personen/manuell = Anteile-Map editierbar.

UI `VerteilerSchluesselBlock` (SSoT, ohne Chevron, Lösch-Bestätigung inline): (1) Verwaltung-Tab (editierbar nur im editMode), (2) Schnelleingabe→Schlüssel (immer editierbar). Zeile: Name, Basis-Label, **Σ-Summe** (MEA-1000stel-Check).

## 31. Orientierungskalender (v9.73–v9.81)

`KalenderPanel` — eine Komponente, drei Varianten:
- `overlay` (Mobil): fixed rechts, Backdrop, translateX-Animation.
- `inline` (Desktop): Seitenpanel IM Kalender-Fenster, Breiten-Animation (Kinder minWidth 380), Liste bleibt sichtbar.
- `dock` (Setting `kalSeitenleiste`): dauerhaft rechts im App-Layout über ALLE Screens (Flex-Kind nach Content), kein X, Termine via `React.useMemo` (`dockTermine`, NACH `istDesktop` definieren — TDZ!).

Einstieg: runder Kalender-Button links neben Neu-Pill im Kalender-Header (entfällt bei Dock; Neu-Pill bekommt dann marginLeft:auto).

**Zoom-Stufen** Monat → Woche → Tag (−/+ und Öffnen springen via `springeZuHeute(stufe)` immer zu heute):
- **Monat:** Raster, KW-Spalte klickbar→Woche, Termin-Punkte; aktueller Monat Tint `accent+"10"`.
- **Woche:** Mo–So gleiche Zeilenhöhe, `KalTagStreifen` (horizontal 0–24h, Arbeitsfenster getönt, ganztägige Quadrate, Uhrzeit-Kreise, roter Faden 1px), `KalStundenSkala`; aktuelle Woche Tint.
- **Tag (v9.80 Quoten-Achse):** jeder Tag 440px-Block: Kopf → ganztägige Fristen → vertikale Achse mit Quoten **1/5 vor / 3/5 Fenster / 1/5 nach**. Fenster = eingestellte Arbeitszeit (`kalArbeitVon/Bis`), **dynamisch erweitert** um Uhrzeit-Termine außerhalb (auf volle Stunde, +30 min Luft) — „ETV kommt zur Arbeitszeit". Außensegmente entfallen bei 0/24-Grenzen. Fensterstunden voll beschriftet, außerhalb nur 0/6/12/18. Roter Faden 1px live (Minuten-Interval nur bei offen). Heutiger Tag accent-umrandet.

**Rückblick:** `sammleTermine(ves, kontakte, fensterMonate, rueckMonate)` — `fensterStart` als Untergrenze (8 Vergleiche); Panel nutzt 12/12, Termine-LISTE bleibt zukunftsbasiert. Tag-Fenster `[tagStart, tagEnde)` ab aktueller Woche, „Frühere Tage" oben (Scroll-Anker), „Weitere Tage" unten, je +21; `zoomeZuTag` lädt beidseitig nach. Grenze: Jahrestage nur zukunftsbasiert.

**iOS-Pflicht:** KEIN `WebkitOverflowScrolling:"touch"` (Legacy-Layer friert Scroll bei hohen Inhalten ein); Tag-Fenster klein halten (21 Tage).

**Settings (Sektion „kalender", `SektionKalenderPanel`):** kalWochenstart (mo/so), kalKw, kalZoom, kalArbeitVon/Bis, kalHeuteInfo (Datum+Uhrzeit live im Heute-Button), kalSeitenleiste. Mobil größere Touch-Ziele im Panel-Kopf (40px vs 30px Desktop).

**Termin-Uhrzeit:** optionales `uhrzeit`-Feld (type=time) in TerminAnlegen, via sammleTermine gereicht (`tm.uhrzeit`).

-----

-----

## 32. Header-Filter (globaler Grob-Filter, v9.82)

`HeaderFilterDropdown` (Datei-Marker „DESIGN §32") — ein Mehrfachauswahl-Filter
oben im Header, ersetzt die frühere „Alle Objekte"-Pille.

- Drei Sektionen: Verwalter/Buchhalter-Zuständigkeit, Verwaltungsart,
  Objekt-Gruppen. Häkchen beliebig kombinierbar — **UND zwischen Sektionen, ODER
  innerhalb** einer Sektion.
- Klick auf eine Option toggelt und lässt das Menü OFFEN (Mehrfachauswahl);
  Schließen via Klick außerhalb (`useOutsideClick`, §2.8) oder „Alle Objekte".
- Button-Beschriftung: nichts gewählt → „Alle Objekte"; genau 1 Häkchen → dessen
  Label; mehrere → „n Filter aktiv".
- Helfer: `headerFilterIstAktiv(hf)`, `headerFilterErlaubt(...)`,
  `headerFilterWirktAufScope(hf, settings, scope)`. Konstante `HEADER_FILTER_LEER`.
- Setting `settings.headerFilter`; wirkt scope-abhängig (Objekte/Kontakte).
- Schalter „Großer Filter im Header" in Einstellungen → Filter-Optionen.

## 33. Scroll-to-top im Mobil-Detail (v9.x)

`DetailMobilScrollTop({ offenId, t, headerSelector, children })` — sorgt dafür,
dass beim Öffnen eines Objekt-/Kontakt-Details auf Mobile der Detailkopf direkt
unter den Header gescrollt wird (sonst „springt" man mitten in den Inhalt).

- Findet den Scroll-Container (`findScrollParent`) oder nutzt `window`.
- Korrigiert um Header-Höhe (`headerSelector` → offsetHeight, sonst Fallback 180).
- `requestAnimationFrame`-Doppeltick, damit das Layout vor dem Scroll steht.
- Eingesetzt in der Objekt- und Kontakt-Detailspalte (Mobile).

## 34. Tagesspezifische Arbeitszeiten / Orientierungskalender (v9.73–v9.81)

Tag-Stufe des Orientierungskalenders (Details auch §31):
- Quoten-Achse der Tagesspalte im Verhältnis **1/5 – 3/5 – 1/5** (Morgen –
  Kernzeit – Abend).
- Das **Arbeitsfenster** ergibt sich allein aus den Terminen des Tages und wird
  dynamisch um Uhrzeit-Termine erweitert (z. B. Termin 19:00 dehnt das Fenster
  nach unten). Keine fixe 8–18-Uhr-Annahme.
- Lehren (BUILD_TROUBLESHOOTING): kein `WebkitOverflowScrolling`; Tag-Fenster
  21 Tage; TDZ-Diagnose unminifiziert bauen.

## 35. Listenansicht — Liste vs. Karten (v9.x, ab v10.x ausgebaut)

`settings.listenAnsicht` (`"karten"` | `"liste"`) schaltet die Übersicht von
Objekten UND Kontakten um. Steuerung in Einstellungen → Erscheinungsbild
(„Objekte & Kontakte als", SegmentControl).

- **Karten:** `VEKachel` / `KontaktKarte` — große Karten im Grid.
- **Liste:** `VEListenZeile` / `KontaktListenZeile` — kompakte Zeilen, mehr pro
  Bildschirm. Objekt-Zeile zeigt links den Handlungsbedarf-Punkt (§36).
- Render-Weiche zentral über `istListe = listenAnsicht === "liste"` in
  `ObjekteMasterDetail` / `KontakteMasterDetail`; das Detailfenster ist in beiden
  Ansichten identisch (§38).

## 36. Handlungsbedarf & Fristen — Punkt + Statusleiste (v10.04–v10.25)

Eine Einstellung steuert ZWEI Anzeigen: **Punkt** links in der Objekt-Liste
(`VEListenZeile`) und **Statusleiste** unter der Objekt-Karte (`VEKachel`).
Karte in **Einstellungen → Objekte**, Titel „Handlungsbedarf & Fristen (Punkt &
Statusleiste)", Anker-id `set-handlungsbedarf`.

- **Quellen** (`HANDLUNGSBEDARF_QUELLEN`): verwaltung(180,an), wahl(180,an),
  etv(60,an), vertrag(90,an), technik(30,an), eigentuemer(30,aus),
  belegung(30,aus), sev(30,aus), termin(14,aus). Helfer `hbQuelleAktiv`,
  `hbVorlauf`. Context `HandlungsbedarfContext` / `useHandlungsbedarf`.
- **Logik `objektHandlungsbedarfDetail(ve, cfg)` → `{ farbe, text }`:** sammelt
  Termine (`sammleTermine`, gefiltert nach aktiven Quellen, ohne reine
  Beginn-Ereignisse), gruppiert nach `typ|titel`. Pro Gruppe: kommendes Vorkommen
  ≤ Vorlauf → gelb (dringlichstes = kleinster diff); alle vergangen → rot
  (meiste Tage überfällig). Rückgabe rot vor gelb vor grün. Text: gelb
  „{Titel} in X Tagen", rot „{Titel} — seit X Tagen überfällig".
  `objektHandlungsbedarf(ve, cfg) = objektHandlungsbedarfDetail(...).farbe`.
- **Farben** `HANDLUNGSBEDARF_FARBEN`: grün #22C55E, gelb #F59E0B, rot #EF4444
  (= identisch zu Statusleiste warn/error).
- **Einstellung (`HandlungsbedarfTabelle`):** pro Quelle EIN Stufen-Slider.
  `STUFEN = [3,7,14,21,30,60,90,120,150,180]`, Slider `min=0 max=STUFEN.length`.
  Position 0 = Quelle AUS (Anzeige „wird nicht angezeigt", grau/kursiv, Slider
  `accentColor:t.muted`); 1..N = `STUFEN[idx-1]`. `setStufe(id,idx)` schreibt
  `quellen[id]` UND `vorlauf[id]` in EINEM `save`. Kein Toggle mehr.
  Wertanzeige vor dem Slider (§39).
- **„Statusleiste an Karten"-Toggle** (`settings.statusLeisteObjekt`) sitzt oben
  in der HB-Karte. Blendet nur die Kachel-Leiste aus; der Punkt bleibt unabhängig.
- **`VEKachel`:** `status` aus `objektHandlungsbedarfDetail(ve, hbCfg)` —
  rot→typ „error", gelb→typ „warn", grün→keine Leiste
  (`zeigeStatus = ... && statusLeisteSettings.objekt && status != null`). Die alte
  fest verdrahtete Schwellen-Logik (90/30/14) ist entfernt.
- **Datenstruktur:** `settings.handlungsbedarf = { quellen:{id:bool}, vorlauf:{id:tage} }`.
- **Sprung-Buttons** zur Karte: aus der Objekt-Legende (`onGotoHandlungsbedarf`)
  und aus der Statusleiste-Sektion, via `allesda:zentrale-sektion {id:"objekte"}`
  + Scroll zu `set-handlungsbedarf`.

> §25-Anpassung: `SektionStatusleiste` steuert nur noch die Kontakt-Leiste
> (`berechneKontaktStatus`) + deren Inhalte/Sichtbarkeit. Objekt-Leiste läuft
> komplett über §36. Sektions-Untertitel „Kontakt-Hinweise, Jahrestage".

## 37. SegmentControl & Schalter-Schema (v10.06+)

Zentrale Komponente `SegmentControl({ options, value, onChange, accent, t, voll=true })`
(options `[{id,label,icon?}]`, aktiv = voller Akzent + `getContrastColor`;
`voll=false` → Tint-Variante).

**Einheitliches Schalter-Schema:**
- An/Aus → IMMER `Toggle`.
- Auswahl 2–4 Optionen → IMMER `SegmentControl` (voll-Akzent).
- Auswahl viele → `Select`.
- Zahlenwert → Slider (stufenlos/visuell) oder Number-Input (präzise/groß).
- Ausnahmen bleiben: Checkbox nur für Listen-Mehrfachauswahl; farbige Filter-Chips.

Referenz-Migration: Sektion Erscheinungsbild (Dichte/Schriftgröße, Listenansicht).
Weitere Sektionen sukzessive nachziehen.

## 38. Master-Detail: feste Detailbreite (v10.13–v10.16)

Das Detailfenster (Objekt, Kontakt, Einstellungs-Sektion) hat eine ABSOLUTE
px-Breite aus dem Slider „Detailfenster-Breite" (500–1200, step 20, Default 500),
identisch bei Liste und Karten. Der Master nimmt den Rest.

- `useMasterDetailLayout(cardWidth, minDetailFactor=1.1, gap=10, maxCols=5, detailFest=false, detailPx=null)`.
  - `detailFest && detailPx != null` → `wunschDetail = detailPx` (ABSOLUT).
    **Kritisch:** den px-Wert NIEMALS über `÷cardWidth → Faktor → ×cardWidth`
    führen — `cardWidth` ändert sich, sobald das Detail aufgeht (Master schmaler)
    → Rückkopplung/Springen (war Bug bis v10.14).
  - detailFest-Zweig: `minMaster=240`; `maxDetail = cw - gap - minMaster`;
    `maxDetail < 220` → Vollbild-Detail (`masterCols 0`); sonst
    `detailBreite = min(detailPx, maxDetail)`.
- Aufrufer übergeben `detailMinBreite` (px) als `detailPx`.
- Karten-Spalten: Slider „Karten neben dem Detail" (`settings.kartenSpalten`, 1–5,
  Default 2). `kartenCols = max(1, min(kartenSpalten, floor(masterWidth/200)))`,
  Grid `repeat(kartenCols, minmax(0,1fr))`.
- Der frühere `kartenMinBreite`-Slider („Kartenbreite") ist entfernt (kollidierte
  mit fester Detailbreite); `kartenMinBreite` bleibt nur intern als cardWidth-
  Default.
- Flex: Master `flex: detailFest ? "1 1 0%" : "0 0 {masterWidth}px"`, Detail
  `flex: 0 0 {detailBreite}px`, beide `minWidth:0`.

## 39. Slider-Layout (v10.19)

Wertanzeige (px / Anzahl / Tage) steht IMMER VOR dem `<input type="range">`
(span zuerst, dann input). Span: `FS.s`, `FW.medium`, `tabular-nums`,
`textAlign:"right"`, sinnvolles `minWidth`. Input: `flex:1` (oder feste `width`),
`accentColor: accent`, `height:24`.

## 40. Header- & Kalender-Feinschliff (v10.28–v10.49)

Sammelkapitel der Header-, Abstands- und Kalender-Dock-Arbeiten.

### 40.1 StickySectionHeader — symmetrische, responsive Abstände
Die zentrale Listen-Titelzeile (`StickySectionHeader`, genutzt von Objekte,
Kontakte, Kalender, Statistik, Einstellungen) liest jetzt selbst die Viewport-
Breite (`useWindowWidth() >= DESKTOP_MIN_WIDTH`).
- `paddingTop = paddingBottom = istDesktop ? 8 : 4` — oben/unten IMMER gleich.
- `marginBottom: 0` (vorher 8 auf Desktop) — das frühere Zusatz-`marginBottom`
  ließ den Block unten doppelt so luftig wirken wie oben. Symmetrie geht vor
  dem alten Subpixel-Schutz; falls an der ersten Karte ein 1px-Strich auftaucht,
  über die Karte lösen, nicht über margin.

### 40.2 Mobiler App-Header — einheitlich 6px
Alle vertikalen Abstände im schmalen (mobilen) Header auf konsequent 6px:
Header-Zeile 1 (Logo/Filter/Buttons) 6/6, Suchleiste unten 6, Nav-Leiste
(`KategorieKacheln`-Wrapper, beide Varianten sticky/normal) 6/6. Kein Wert ragt
mehr heraus; Desktop (`headerBreit`) unverändert.

### 40.3 Header-Icon-Buttons — einheitliches Schema
Mond (Hell/Dunkel), Kalender-Toggle und Profil (`HeaderProfilButton`) folgen
demselben Schema, 36px / `RAD.full`:
- Ruhe: `background: transparent`, `border: 1px t.border`, Icon/Initialen in
  `systemAccent`.
- Aktiv (Einstellungen offen → Profil; Dock offen → Kalender): Vollton
  `systemAccent`, Icon/Initialen in `getContrastColor(systemAccent)`.
- Der Mond hat keinen Aktiv-Zustand (toggelt nur), bleibt im Ruhe-Stil, Icon
  aber `systemAccent` statt grau. Profil verlor den alten Doppel-Ring-Look
  (2px Ring + getönter Innenkreis); ein Profilfoto füllt den Kreis weiterhin.

### 40.4 Kalender-Dock — Termin-Plus statt X, oben bündig
Im Dock-Modus (`variante="dock"`, Kalender rechts angedockt):
- Statt des X steht rechts der runde Vollton-„Neuer Termin"-Plus in
  Kalenderfarbe (36px, `RAD.pill`, `getContrastColor`-Icon, dezenter Schatten —
  identisch zum Objekt-Anlegen-Button). X bleibt nur bei Overlay/Inline.
- „Neuer Termin" öffnet ein schwebendes **Overlay**-Modal (fixed, Backdrop,
  zentriert oben, Klick-außerhalb schließt) mit der bestehenden
  `TerminAnlegen`-Komponente. Dafür reicht `KalenderPanel` jetzt optional
  `ves`/`kontakte`/`setVes`/`setKontakte` durch (nur Dock nutzt sie).
- Safe-Area: das frühere `paddingTop: env(safe-area-inset-top)` gilt nur im
  Overlay-Modus (Mobil), NICHT im Dock/Inline.
- Vertikale Ausrichtung: Dock-Header bei 8/8 (gleiche Höhe wie der
  StickySectionHeader links, 36px-Element → 52px Block). Der Dock-PANEL-Container
  bekommt `paddingTop: 8`, um den minimalen Start-Versatz zum Content-
  Scrollbereich auszugleichen, damit Datum-Pille und Objekte-Plus auf einer
  Linie sitzen. (Wert empirisch justiert.)

### 40.5 T/W/M-Stufen-Umschalter — Pillen-Design, mittig
- Container und Einzel-Buttons `RAD.pill` (vorher `RAD.ms`/`RAD.sm`).
- Schmaler: Buttons `istDesktop ? 26 : 32` (vorher `btnGr` 30/40), Padding 2.
- Aktiver Button = runder Vollton-Kreis in Kalenderfarbe.
- Horizontal mittig zwischen Datum-Pille und Plus: flex:1-Spacer DAVOR UND
  DANACH (`alignSelf:center` für vertikale Mitte).

### 40.6 Termin-Plus-Sichtbarkeit nach Dock-Zustand
- Dock-Plus (im angedockten Kalender): IMMER sichtbar.
- Vollansicht-Plus (`KalenderScreen`-Header, Klick auf „Kalender"): nur sichtbar,
  wenn der Kalender NICHT angedockt ist — sonst redundant. `dockAktiv` deckt
  BEIDE Dock-Wege ab: Einstellung `kalSeitenleiste` ODER Header-Toggle
  (`kalDockOffen`, als Prop `dockOffen` durchgereicht). Wird das Dock aktiv,
  schließt ein offenes Inline-Anlegeformular automatisch (`useEffect`).

### 40.7 Wochen-Kalender — Wochenende & Symmetrie
- Arbeitsfreie Tage (Sa/So) erhalten denselben neutralen `t.card`-Streifen mit
  voller Deckkraft wie die Vor-/Nach-Arbeit-Zonen der Werktage (vorher blasser
  `t.bg` + opacity 0.6). Unterschied zum Werktag: nur das eingefärbte
  Arbeitsfenster-Rechteck fehlt.
- Wochen-Block: letzte Tagzeile (So) ohne `marginBottom`, damit oben/unten
  symmetrisch (8px Block-Padding beidseitig).

### 40.8 Einstellungen-Sektionen folgen dem Spalten-Slider
Die Sektions-Kacheln der Einstellungen-Zentrale respektieren jetzt den Slider
„Karten neben dem Detail" (`settings.kartenSpalten`), analog Objekte/Kontakte:
`kartenCols = max(1, min(kartenSpalten, floor(masterWidth/200)))`. Listenansicht
bleibt einspaltig (`"1fr"`).

---

## §41 Termin-Feature — Großausbau (v10.50–v10.83)

Dieser Abschnitt dokumentiert den vollständigen Ausbau der manuellen Termine
und der Kalender-Ansichten. Datenmodell-Hinweis: ein manueller Termin hat
aktuell `einheitId` (einzeln); der Umstieg auf `einheitIds` (Array) ist als
eigener Großpunkt vorgemerkt.

### 41.1 Termin-Bezeichnungen (Settings)
`settings.terminBezeichnungen: [{id, label, farbe, sichtbar, bezug,
autoBeteiligte}]`. Bereitgestellt über `TerminBezeichnungenContext` /
`useTerminBezeichnungen`. Editor in der Kalender-Sektion der Einstellungen
(`TerminBezeichnungenEditor`, Dashboard-Kachel-Stil). Merge beim Laden füllt
fehlende Felder auf (`bezug:"objekt", sichtbar:true, autoBeteiligte:"keine"`).
- `bezug` ∈ {keiner, objekt, einheit} — steuert NUR Sichtbarkeit von Objekt-/
  Einheit-Feld, NICHT Pflicht. Gültigkeit: `titel.trim() && datum`.
- `farbeFuerLabel(label)` / `bezugFuerTitel(label)` / `autoRegelVon(label)`
  lesen das passende Listenobjekt.

### 41.2 Datums-Picker (`DatumPickerModal`)
Global für alle `DatumFeld`. Vertikal scrollendes Monatsraster (18 zurück, 30
voraus), springt zum Startmonat. Fixer Mo–So-Kopf mit KW-Spalte, Wochenende
abgesetzt, Monatsname mittig, nur Jahr im Header (folgt Scroll via onScroll).
Tag-Tipp wählt + schließt sofort. Feste Höhe 330px (kein dvh).
`DatumFeld`/`ZeitFeld` haben `autoOpen` (Picker beim Mount sofort offen — für
den geführten Modus). `TagMonatPickerModal` (Wirtschaftsjahr) behält Rad-Picker.

### 41.3 Uhrzeit-Picker (`ZeitFeld` + `ZeitPickerModal`)
Textfeld mit HH:MM-Maske (`maskeZeit`, `istZeitGueltig`) + Uhr-Icon → Modal:
erst Stunde, dann Minute → schließt sofort. Settings (über `ZeitPickerContext`):
`zeitMinutenschritt` (5|15), `zeitStundenModus` (24h|arbeit), `zeitArbeitPuffer`
(0–3h). Arbeitszeit aus `kalArbeitVon`/`kalArbeitBis` (default 8–17).

### 41.4 Dauer (`DauerWahl`)
Schnellbuttons aus `terminDauerOptionen` (default 15/30/45/60/90/120) + Ganztags.
`dauerText(wert)`-Helfer. Dauer optional; im Payload `dauer` (number |
"ganztags" | null).

### 41.5 Objektlose („freie") Termine
Root-State `freieTermine`/`setFreieTermine`, persistiert via
`storage.speichereDaten({…, freieTermine})` + Laden. `sammleTermine(ves,
kontakte, fensterMonate, rueckMonate, freieTermine)` sammelt sie mit `freiId`
(plus notizen/dauer/uhrzeit) ein. Bei leerem `objektId` schreibt das
Anlege-Callback in `freieTermine` statt `v.termine`. Löschen über `freiId`.

### 41.6 Anlege-Modi: Formular vs. geführter Assistent
`settings.terminAnlegeModus` (formular|gefuehrt). Aufrufstellen wählen
`Komp = gefuehrt ? TerminAssistent : TerminAnlegen`.
- `TerminAnlegen`: Formular. Props `start` (Vorausfüllung), `abbrechenText`,
  `submitText`, `objektFest`.
- `TerminAssistent`: Schritte Bezeichnung → Objekt → (Einheit) → Datum →
  Uhrzeit → Dauer → Kontakte → Kontrolle. Auto-weiter bei Auswahl
  (`setTimeout(weiter,0)`), Überspringen-Buttons für optionale Schritte,
  Fortschrittspunkte, Zurück. Letzter Schritt „kontrolle" rendert das echte
  `TerminAnlegen` vorausgefüllt (randlos, ohne Card-in-Card). Props `start`,
  `objektFest`.

### 41.7 objektFest (Schnell-Anlegen im Objekt)
Bei gesetztem Objekt (z.B. aus dem Objekt-Detail im Kalender): `objektFest`
blendet das Objekt-Feld (Formular) bzw. den Objekt-Schritt (Assistent) aus.
WICHTIG: Bezeichnungswahl darf das Objekt NICHT zurücksetzen
(`if (!objektFest) setObjektId("")`).

### 41.8 Auto-Beteiligte
`AUTO_BETEILIGTE_REGELN` = keine | eigentuemer | eig_nutzer_einheit |
nutzer_einheit. `autoBeteiligteIds(ve, einheitId, regel)` liefert eindeutige
Kontakt-IDs. Einheiten werden kanonisch aus `ve.karten` gesammelt (Fallback
`ve.einheiten`!). Eigentümer = enge Rolle aus `einheit.eigentuemer` (nicht
ehemalig); Nutzer = aktive Bewohner via `teileVon` + `aktiveBelegung().haushalt.
mitglieder`. Feld `autoBeteiligte` pro Bezeichnung; useEffect in TerminAnlegen +
TerminAssistent schlägt Kontakte vor (nur hinzufügen, entfernbar) bei Änderung
von titel/objektId/einheitId.

### 41.9 Bearbeiten + Notizen am Termin
`KalenderZeile` (aufgeklappt, nur manuelle/freie Termine):
- `onNotiz` → direkt editierbares Notizfeld (ohne Bearbeiten-Modus, wie bei
  Kontakten). `notizen` läuft durch `sammleTermine`.
- `onBearbeiten` → Stift-Button öffnet vorausgefülltes `TerminAnlegen`
  (submitText „Speichern"). Beim Speichern: alter Termin am alten Ort entfernt +
  neuer mit ALTER ID am ggf. geänderten Ort geschrieben.

### 41.10 Seiten-Kalender: Detail-Popup + Sprung zum Termin
`TerminDetailPopup` (alle Infos) öffnet bei Klick auf Panel-Termine (ganztags +
zeitig). Button „Zum Termin" springt zur Vollansicht: `gotoTermin(terminKey)` im
Root wechselt zum Kalender-Screen, merkt `pendingTerminKey {key, nonce}`;
`KalenderScreen` klappt den Termin auf (`offenTerminKey`) und scrollt via
`[data-termin-key]` (Attribut an der `KalenderZeile`-Wurzel). `terminKey` =
`iso|titel|(objektId||kontaktId)`. KalenderPanel bekam `onGotoTermin` an allen
4 Aufrufstellen.

### 41.11 Kalender-Fenster
`KAL_FENSTER_MONATE = 24` (zentrale Konstante). Termin-Liste/Panel-Raster/Dock:
24 Monate Zukunft, 12 Monate Rückblick.

### 41.12 Zweite Kalender-Ansicht „Objekte"
Umschalter Timeline | Objekte im Kalender-Kopf (`kalView`/`kalViewVEId`, im Root
gehalten + an KalenderScreen durchgereicht; Layout-Werte `cardWidth`/
`kartenSpalten`/`detailMinBreite`/`listenAnsicht` ebenfalls als Props).
Wiederverwendet das vorhandene **Master-Detail-Gerüst** `ObjekteMasterDetail`
(gleiches `useMasterDetailLayout` wie Objekte/Kontakte) — KEIN Eigenbau:
- Neuer Prop `renderDetailOverride(ve)`: rendert statt `VEDetail` die
  objektgefilterte Termin-/Fristenliste (`sammleTermine([ve], …)` +
  `KalenderZeile`), Kopf mit Objektnummer (FS.xxl) in Kalenderfarbe.
- Neuer Prop `auswahlAccentOverride` (auch an `VEKachel`/`VEListenZeile`):
  aktive Karte in Kalenderfarbe statt Objekt-Cyan.
- `ObjektLegende` oben; Karten-Grid `auto-fill minmax(280px,1fr)` wie im
  Objekte-Screen; respektiert `legendeObjekte`/`listenAnsicht`.
- Im offenen Objekt-Detail: kein Zurück-Pfeil, stattdessen „+ Termin"-Button
  (Kalenderfarbe) → Schnell-Anlegen mit `objektFest`. Großer Kopf-+Button
  ausgeblendet, solange ein Objekt-Detail offen ist.

## §42 WizardDialog — wiederverwendbarer Schritt-Dialog (v10.91)

Zentraler Baustein für mehrstufige Anlage-Flows. EINE Hülle für alle geführten
Dialoge: Kopf (Titel · Fortschrittspunkte · ein X), scrollender Body, fester
Fuß (Zurück/Weiter). Liegt vor `terminOverlayBackdrop`.

`WizardDialog({titel, anzahl, aktivIdx, onClose, onZurueck, onWeiter,
weiterText, weiterAktiv, accent, t, children})`
- Schritt-Inhalt kommt ausschließlich als `children` — der aufrufende Assistent
  liefert NUR den Inhalt des aktiven Schritts, KEINEN eigenen Rahmen/Kopf/X.
  (Behebt „Fenster-im-Fenster" mit doppeltem X.)
- `anzahl`/`aktivIdx` rendern die Fortschrittspunkte (aktiver Punkt als Balken).
- `weiterAktiv=false` sperrt den Weiter-Button (z. B. Pflichtfeld leer).
- Letzter Schritt: `weiterText="Speichern"`.

Klick-Verhalten der Schritte:
- **Einfachauswahl** (Bezeichnung, Datum): Tipp wählt und springt direkt weiter
  (`setTimeout(weiter, 0)`).
- **Mehrfach/Kann-Auswahl** (Objekte, Einheiten, Zeit, Kontakte): Auswahl togglet
  nur, der Schritt wartet auf „Weiter".

Wiederverwendbar für künftige Objekt-/Kontakt-/Ticket-/ETV-Anlage. Drei Termin-
Overlay-Stellen (Haupt-Plus, Objekt-Plus, Dock) rendern im geführten Modus
`<TerminAssistent>` (eigene Wizard-Hülle), im Direktmodus `<TerminAnlegen>` in
der `terminOverlay`-Hülle.

## §43 Inline-Bausteine Datum / Uhrzeit / Dauer (v10.90–v10.95)

Aus den Modal-Pickern extrahierte, einbettbare Auswahl-Bausteine, damit der
geführte Modus KEINE gestapelten Fenster mehr öffnet. Die Modals nutzen
weiterhin dieselben Bausteine (mit Overlay-Hülle).

### 43.1 `DatumKalender({startWert, onWaehle, t, accent, iso, hoehe})`
Das scrollende Monatsraster aus `DatumPickerModal`, ohne Overlay. Im geführten
Datum-Schritt inline eingebettet. `iso`-Flag liefert ISO-Datum.

### 43.2 `ZeitWahl({startWert, onWaehle, t, accent})`
Stunden in ZWEI Spalten nebeneinander: links Vormittag (vor 12), rechts
Nachmittag (ab 12). Respektiert `cfg.stundenModus==="arbeit"` (zeigt nur den
Arbeitszeitbereich + Puffer; leere Spalte fällt mit ihrem Kopf weg). Minuten
(00/15/30/45) fest darunter, IMMER sichtbar — kein Phasenwechsel mehr. Stunde
und Minute werden gemeinsam gehalten; bei jeder Änderung wird der kombinierte
Wert gemeldet (Minute-Default 0). Buttons einheitlich Tint+Rahmen (`accent+"1E"`
BG, `accent` Rahmen bei aktiv), volle Zellenbreite (`width:100%`).
- Reset beim Löschen: Eltern-State `zeitReset`-Zähler als `key` → Neumontage.
- `ZeitPickerModal` sammelt den Wert lokal + „Übernehmen"-Button (schließt nicht
  mehr sofort bei der ersten Auswahl).
- Zeit-Schritt: Anzeige IMMER sichtbar (Platzhalter `--:--` in `t.border`, sonst
  gewählte Zeit in `accent`, `FS.xxl`, zentriert). „Löschen" mit reserviertem
  Platz (transparent + disabled wenn leer) → Layout springt nicht.

### 43.3 `DauerWahl({wert, onChange, optionen, t, accent})`
Zwei Reihen: oben Minuten-Optionen inkl. 2 h (`30·45·1h·1,5h·2h`; 90 →
„1,5 h"), unten `Ganztags · Offen`. „Offen" = kein Wert (`null`, Default).
`optionen` (Minuten-Array) überschreibt die Minuten-Reihe fürs Direktformular.
Buttons gleichmäßig (`flex:1`), Tint+Rahmen.

## §44 Mehrfach-Einheiten & Mehrfach-Objekte am Termin (v10.84, v11.03)

### 44.1 Mehrfach-Einheiten (v10.84)
Datenmodell `einheitId` → `einheitIds[]` (abwärtskompatibel). SSoT-Helfer
`terminEinheitIds(tm)` liest das Array, fällt auf altes `einheitId` zurück.
`autoBeteiligteIds(ve, einheitIds, regel)` iteriert über alle Einheiten.
Einheiten-Schritt/Formular: Mehrfach-Checkbox-Liste. Anzeige-Label „WE 03, WE 05".

### 44.2 Mehrfach-Objekte (v11.03)
`objektId` → `objektIds[]` NUR als FORMULAR-State (nicht im Termin-Modell). Beim
Speichern wird PRO gewähltem Objekt eine eigene Termin-Kopie mit ihrer eigenen
`objektId` geschrieben (`onAnlegen` wird mehrfach aufgerufen — die Handler nutzen
funktionale `setVes`/`setFreieTermine`-Updates und sind multi-call-sicher). Das
hält Anzeige- und Speicher-Kette stabil (Termin-Modell bleibt single-objektId).
- `ve` ist nur bei GENAU 1 gewähltem Objekt gesetzt (Einheiten/Auto-Beteiligte
  hängen an einem konkreten Objekt). Bei mehreren Objekten kein einzelnes `ve`.
- Objekt-Schritt → Mehrfach-Checkbox-Liste (Objektnummer + Adresse, Häkchen
  rechts). Bei Mehrfachauswahl kein Auto-Weiter (wartet auf „Weiter").
- Einheiten-Schritt entfällt bei `objektIds.length !== 1` (Hinweistext).
- Beteiligte-Schritt sammelt Kontaktquelle, Avatar-Eck-Badges und WE/Bezug-
  Unterzeile über ALLE gewählten Objekte (`gewaehlteVes`), nicht nur ein `ve`.
- Kontrolle zeigt „Objekte: …, …" als Liste.
- Bearbeiten bleibt Single-Select: `TerminAnlegen`-Prop `maxObjekte={1}`.
- Sprung zur Kontrolle: `sprungSperreRef` (Same-Tick-Sperre, <50 ms) → nur der
  erste Aufruf (= erstes Objekt) springt.

## §45 Häkchen-Position in Auswahl-Listen (v11.02)

Verbindlich: In Mehrfachauswahl-Listen (Objekte, Einheiten, Beteiligte) sitzt
das Häkchen IMMER RECHTS. Reihenfolge in der Zeile: Inhalt (Avatar/Name/Bezug,
`flex:1`) zuerst, dann die Checkbox (`width 18–20`, `RAD.xs`, `accent`-Rahmen,
gefüllt + Check bei aktiv).

## §46 Direkt anklickbare Kontaktliste im Beteiligte-Schritt (v10.96)

Statt nur Chips + Picker: die objektbezogenen Kontakte als Liste (Muster wie
`KontaktZeile`). Pro Zeile: `Avatar` (mit Eck-Badges via `zuweisungen={objektZuw}`)
+ Name + WE/Bezug-Unterzeile + Häkchen rechts; Klick auf die Zeile togglet die
Auswahl. Quelle: objektbezogene Kontakte über alle gewählten Objekte; „Alle
Kontakte durchsuchen" schaltet auf die volle Liste. `KontaktPicker`/Neuanlage
bleibt darunter für Kontakte außerhalb der Liste.

## §47 Sprung zur Kontrolle nach dem Anlegen (v10.97)

Nach dem Anlegen wird zum frisch erstellten Termin gesprungen, passend zum
Anlage-Ort. `springeZuTermin(termin, objektId)` in `KalenderScreen`:
- berechnet den Key `iso|titel|objektId` (iso via `parseDatumWert`),
- bei Objektbezug: `setKalView("objekte")` + `setKalViewVEId(objektId)`,
- `setOffenTerminKey(key)` + `scrollIntoView` über `[data-termin-key]`.
Aufgerufen in den Haupt-Plus- und Objekt-Plus-Handlern. Das Dock öffnet
stattdessen das `TerminDetailPopup` des neuen Termins (Datum via `parseDatumWert`).

## §48 Legenden-Konsistenz & Einstellen-Sprung (v10.98–v11.00)

### 48.1 Einheitliche Kopfzeilen-Höhe
Beide Legenden (`ObjektLegende`, `IconLegende`) haben in der Kopfzeile eine
feste niedrige `minHeight: 34` (`padding: "5px 12px"`, `boxSizing`). Der
„Einstellen"-Button kompakt (`padding: "3px 9px"`), damit er die Zeile nicht in
die Höhe zieht. So sind Objekte-, Kalender- und Kontakte-Legende gleich hoch.

### 48.2 „Einstellen"-Button in allen drei Legenden
App-Level-Listener auf `allesda:goto-einstellungen` (Detail `{sektion, anker?}`):
wechselt zum Einstellungs-Screen und feuert dann `allesda:zentrale-sektion` mit
der Sektions-ID (objekte | kontakte | kalender), optional Scroll zu `anker`.
- `IconLegende` bekam Prop `onEinstellen`; der Trigger ist ein klickbares
  `<span>` (kein `<button>`, da die Legende selbst ein Button ist — verschachtelte
  Buttons sind ungültiges HTML).
- Kalender-Legende feuert `sektion:"kalender"`, Kontakte-Legende
  `sektion:"kontakte"`. Objekte-Screen behält seine bestehende Inline-Logik.

## §49 „Detail bleibt offen" beim Screen-Wechsel (v11.05)

Grundverhalten: Wechselt man den Screen, bleibt die offene Detailansicht
erhalten — getrennt pro Screen (Variante A): `expandedVEId` (Objekte),
`aktivKontaktId` (Kontakte), `kalViewVEId` (Kalender-Objekt). So kann man kurz
woanders schauen und kehrt zum selben Punkt zurück.
- `resetUI()` setzt NUR noch die Suche zurück, NICHT mehr das Detail.
- `wechselScreen(s, reset=false)`: nur bei `reset=true` wird
  `schliesseDetailVon(s)` gerufen (leert den Detail-Zustand des Ziel-Screens).
- `navTo(id)`: erneuter Klick auf den AKTUELLEN Screen → `reset=true` (schließt);
  Wechsel zu anderem Screen → Detail bleibt.
- Screen-Überschriften schließen ihr Detail bewusst: „Objekte" →
  `setExpandedVEId(null)`, „Kontakte" → `setAktivKontaktId(null)`, „Kalender" →
  `setKalViewVEId(null)` (jeweils zusätzlich zum bestehenden Filter-Reset).
- Logo „AllesDa" (`goHome`) wechselt zu Objekte, lässt das Detail aber stehen.

## §50 Aufgeklappte KalenderZeile — Hervorhebung (v11.07)

Eine aufgeklappte `KalenderZeile` wird über einen VOLLTON-Rahmen in der
Termin-/Rahmenfarbe (`rf`) hervorgehoben, OHNE getönte Füllung (Hintergrund
bleibt `t.surface`). Grund: Ein halbtransparenter Rahmen mischt sich optisch mit
dem Untergrund und wirkt wie eine falsche Farbe; der Vollton-Rahmen ohne Tint
setzt die Karte klar vom umliegenden Rahmen ab. `borderRadius` offen `RAD.lg`.

## §51 Kanonisches Karten-/Listen-/Master-Detail-Gerüst (v11.16)

**Regel: Objekte und Kontakte sind die Referenz-Implementierung. Jede neue
Listen-/Detail-Ansicht (Kalender, ETV, Tickets/Aufträge …) wird von dort
NACHGEBAUT — niemals ein eigenes Grid- oder Layout-Konstrukt erfinden.** Das
spart nicht nur Code, sondern erbt automatisch das geprüfte Responsive-Verhalten
(Mobil-Fallback, Zurück-Button, Overflow-Schutz).

### §51.1 Das Karten-Grid

Ein Listenbereich rendert seine Karten nach genau diesem Muster (identisch in
Objekte-Tab und Kalender):

```jsx
<div style={listenAnsicht === "liste"
  ? { display: "flex", flexDirection: "column", gap: 6 }
  : { display: "grid",
      gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 10 }}>
  {liste.map(eintrag => listenAnsicht === "liste"
    ? <XListenZeile key={…} … />
    : <XKachel       key={…} … />)}
</div>
```

- `liste`-Modus → vertikale Liste (`flex column`, gap 6), Zeilen-Komponente.
- `karten`-Modus → `auto-fill, minmax(280px, 1fr)` (gap 10), Kachel-Komponente.
  `auto-fill` legt so viele 280px-Spalten an, wie passen; eine einzelne Spalte
  wird über `1fr` auf volle Breite gestreckt.

### §51.2 Master-Detail über `ObjekteMasterDetail`

Sobald ein Eintrag aufgeklappt/geöffnet wird, läuft die Detailansicht über
`ObjekteMasterDetail` — NICHT über einen eigenen Mobil-Pfad. Die Komponente
misst per `useMasterDetailLayout(cardWidth, …)` die echte Breite und entscheidet:

- **Desktop** (genug Platz): 2-Spalten Master-Detail, Detail mit fester px-Breite,
  Master füllt den Rest.
- **Mobil** (`mdLayout.masterCols === 0`): Detail in Vollbreite + automatischer
  „Zurück zur Liste"-Button (chevL). Diesen Button NICHT selbst nachbauen — er
  kommt aus dem Gerüst.

Fremder Detail-Inhalt (z. B. Termine eines Objekts) wird per
`renderDetailOverride={fn}` eingehängt; das Master-Detail-Gerüst bleibt gleich.
Beispiel Kalender:

```jsx
if (offenVEObj) {
  return (
    <ObjekteMasterDetail
      listenAnsicht={listenAnsicht} cardWidth={cardWidth}
      detailMinBreite={detailMinBreite} kartenSpalten={kartenSpalten}
      gefiltert={ves} expandedVEId={kalViewVEId}
      setExpandedVEId={id => setKalViewVEId(id)}
      offenVE={offenVEObj} t={t} accent={kalFarbe}
      kontakte={kontakte} setKontakte={setKontakte} ves={ves} setVes={setVes}
      gotoKontakt={gotoKontakt} auswahlAccentOverride={kalFarbe}
      renderDetailOverride={renderTerminDetail}/>
  );
}
```

### §51.3 MOBIL-FALLE: der umschließende Flex-Container (Kernlektion v11.16)

Wenn ein Screen seinen Listen-/Master-Detail-Bereich in einen zusätzlichen
Flex-Container packt (auf Desktop für das Nebeneinander von Master und Detail
gedacht), MUSS dieser Container auf Mobil auf `column` umschalten. Bleibt er
`row`, füllt die einzelne Kartenspalte NICHT die volle Breite — es entsteht ein
Rand rechts (Karten „zu schmal", enden vor dem Bildschirmrand).

```jsx
<div style={{ display: "flex",
  flexDirection: istDesktop ? "row" : "column",
  flex: 1, minHeight: 0, minWidth: 0, width: "100%" }}>
  …
</div>
```

Der innere Listen-Container zusätzlich absichern:
`{ flex: 1, minWidth: 0, width: "100%", boxSizing: "border-box", overflowY: "auto" }`.

### §51.4 Overflow-Schutz an Detail-Boxen

Lange Inhalte (Adressen, große Titel) dürfen die Karte nicht über den Viewport
schieben. Durchgängige Kette:

- Fallback-Wrapper + Scroll-Container in `ObjekteMasterDetail`: `minWidth: 0`.
- Die eigentliche Detail-Box: `boxSizing: "border-box"`, `width: "100%"`,
  `minWidth: 0`.
- Lange Textwerte (Objekt-Nr., Adresse): `overflowWrap: "anywhere"`.

Grund: In einem Flex-Kontext erzwingt ein Kind ohne `minWidth: 0` seine
intrinsische Mindestbreite und sprengt den Container.

### §51.5 StatusLeiste nur bei echtem Handlungsbedarf

`VEKachel` rendert die `StatusLeiste` ausschließlich, wenn `status != null`
(roter/gelber Handlungsbedarf). Grüne Objekte zeigen KEINE Leiste — sonst
entsteht ein leerer 26px-Block (`\u00A0`) unter der Karte:

```jsx
const zeigeStatus = !ohneStatus && !kompakt
  && statusLeisteSettings.objekt && status != null;
```

(`objektHandlungsbedarfDetail` liefert bei grün `{ farbe:"gruen", text:null }`;
nur rot/gelb setzen `status`.) Referenz-DOM dadurch ~120.058.

### §51.6 Anwendung auf ETV und Tickets/Aufträge

Geplante Screens (ETV, Tickets/Aufträge) übernehmen §51.1–§51.5 unverändert:
gleiches Grid (`auto-fill, minmax(280px,1fr)` bzw. Liste), gleiche
`ObjekteMasterDetail`-Bühne mit `renderDetailOverride` für den jeweils eigenen
Detail-Inhalt, gleiche Mobil-Column-Regel und Overflow-Kette. Nur der
Karten-/Detail-INHALT ist neu — das GERÜST bleibt identisch.

> Merksatz: **„Außen identisch, innen anderer Inhalt."** Bei jedem neuen
> Listen-Screen zuerst Objekte/Kontakte öffnen, das Gerüst kopieren, dann nur
> den Inhalt austauschen.

---

## §52 Universelle Gerüst-Komponente `ObjektListeMitDetail` (v11.18–v11.27)

§51 hat das Karten-/Master-Detail-Muster definiert; ab v11.18 ist es in **eine
wiederverwendbare Komponente** gekapselt: `ObjektListeMitDetail`. Jeder
Bereichs-Screen, der „Liste der Objekte → pro Objekt ein eigener Detail-Inhalt"
zeigt, nutzt sie — kein eigenes Grid/Layout mehr nachbauen.

**Props:**
- `ves, kontakte, setVes, setKontakte, t, accent` — Standard-Daten/Theme
- `gotoVE, gotoKontakt` — Sprünge
- `cardWidth, kartenSpalten, detailMinBreite, listenAnsicht` — Layout (vom
  Haupt-Render durchgereicht, NICHT aus Defaults)
- `viewVEId, setViewVEId` — welches Objekt ist offen (eigener State je Screen)
- `renderDetail(veObj)` — der bereichsspezifische Detail-Inhalt
- `istDesktop` — für die Mobil-Column-Falle (§51.3)
- `titel, anzahl` — StickySectionHeader-Kopf („ETV · WEG 11")
- `legendeAn, onGotoStatusEinstellungen` — Legende + Einstellen-Sprung
- `emptyText` — Fallback ohne Inhalt

**Interner Aufbau:** Header (StickySectionHeader mit Titel + WEG-Zähler + bei
Mobil-Detail „Zurück"-Button) → dann entweder die reine Objektliste
(VEKachel/VEListenZeile im §51-Grid) oder bei offenem Objekt
`ObjekteMasterDetail` mit `renderDetailOverride`. Der Detail-Override liefert
eine einheitliche Hülle (Objektkopf nr + adresse) und ruft darin `renderDetail`.

**Angewandt auf ALLE Bereiche** (v11.18–v11.27): ETV, Vorgänge,
Beschlusssammlung, Technik, Dokumente, Fotos, Kommunikation, Finanzen. Der
`renderPlatzhalterScreen` wird seither nirgends mehr geroutet (Funktion bleibt
als Quelle für künftige Bereiche stehen).

> Merksatz bleibt §51: **„Außen identisch, innen anderer Inhalt."** Neuer
> Bereich = `ObjektListeMitDetail` aufrufen + `renderDetail` schreiben. Fertig.

## §53 Statusleiste & Handlungsbedarf-Punkt — gemeinsamer Schalter (v11.22–v11.23)

**Designentscheidung umgekehrt** gegenüber §51.5: Die Objekt-Statusleiste wird
wieder IMMER als fester 26px-Platz unten gezeigt (leer bei grün), damit alle
Karten einer Zeile gleich hoch sind und bündig enden. Inhalt oben, Leiste unten
(`VEKachel`: kein flex-column-Stretch, Inhalt nicht mittig).

Der **Listen-Punkt** (VEListenZeile) und die **Karten-Statusleiste** hängen am
SELBEN Schalter `statusLeisteObjekt` — beide zeigen denselben Handlungsbedarf.

**Settings-Struktur (v11.23):**
- Menü **Statusleiste** (Sektion `statusleiste`): beide Einzelschalter
  (`statusLeisteObjekt`, `statusLeisteKontakt`) + die Handlungsbedarf-Fristen-
  Tabelle (Anker `set-handlungsbedarf`, von Objekte-Sektion hierher verschoben).
- Menü **Erscheinungsbild**: EIN Master-Schalter „Statusleisten anzeigen" —
  an = mind. einer an; Umlegen setzt BEIDE (`{statusLeisteObjekt:v,
  statusLeisteKontakt:v}`). Die drei Schalter sind so verbunden.

Legenden-„Einstellen"-Buttons (Objekte-Tab + alle `ObjektListeMitDetail`-Screens)
springen jetzt in die **Statusleiste**-Sektion (nicht mehr Objekte). Kalender-
Legende springt weiterhin zur Kalender-Sektion (eigene Handlungsbedarf-Settings).

## §54 Terminologie: „Vorgänge" statt „Aufträge" (v11.28)

Die Dashboard-Kachel heißt im UI **„Vorgänge"** (vorher „Aufträge", noch früher
„Tickets"). **WICHTIG — Trennung Label vs. interner Schlüssel:** Der
State-/Routing-/Settings-Key bleibt `auftraege`. Grund: „Vorgang" ist im Code
bereits hundertfach für die Einzug/Auszug-Logik der Einheiten belegt
(`vorgangAuszugsdatum`, `vorgangBeleg`, `VorgangAnzeige` …). Ein Umbenennen des
Keys auf „vorgang" hätte damit kollidiert. Nach außen „Vorgänge", intern
`auftraege` → keine Migration nötig.

Neue Kachel **Beschlusssammlung** (`id:"beschluss"`, inaktiv default, Amber
`#F59E0B`) ist seit v11.25 dabei.

## §55 Termin bearbeiten — überall erreichbar, schlankes Fenster (v11.29–v11.36)

**Das Bearbeiten-Overlay lebt im KalenderScreen UND im Dock (KalenderPanel).**
Lektion v11.30: Das Overlay war nur im Timeline-Render-Zweig — im Objekt-Detail-
Zweig (`renderTerminDetail` via ObjekteMasterDetail) fehlte es, daher tat der
Stift dort „nichts" (klappte nur zu). Fix: Overlay VOR den View-Container ziehen,
sodass es in beiden Ansichten (Objekte + Timeline) erscheint (`position:fixed`).

**Drei Bearbeiten-Wege, alle führen zum selben schlanken Fenster:**
1. Großer Kalender, Timeline → Stift in KalenderZeile
2. Großer Kalender, Objekt-Detail → Stift in KalenderZeile (v11.29)
3. Seiten-Kalender-Popup (TerminDetailPopup) → Button „Bearbeiten" öffnet das
   Bearbeiten-Overlay DIREKT im Dock, ohne Ansichtswechsel (v11.31,
   State `dockBearbeiteTermin`).

**Schlanke Bearbeiten-Komponente `TerminBearbeitenKompakt` (v11.33):** bewusst
NICHT das volle `TerminAnlegen`. Nur Datum, Uhrzeit, Dauer, Personen
(ergänzen/entfernen). Objekt/Einheit/Bezeichnung bleiben unverändert und werden
durchgereicht. `onAnlegen(neu, objektId)`-Signatur identisch zu TerminAnlegen,
damit die Speichern-Logik (alten Termin entfernen, neuen mit gleicher ID
schreiben) unverändert läuft.

**KontaktPicker beim Bearbeiten (v11.34):** Standard nur Kontakte MIT Objektbezug
(`objektBezugInfo`-Filter wie im Anlegen) + Haken „Alle Kontakte durchsuchen".
Avatare zeigen Rollen-Icons (über `zuweisungenFuerAvatar`, schon im Picker).

**Header (v11.36):** Bearbeiten-Fenster zeigt die Objektnummer im Kopf
(„Termin bearbeiten · WEG-2024-001"), wie das Anlegen-im-Objekt.

## §56 KalenderZeile — „Wann"-Bereich & Buttons (v11.32, v11.35)

**„Wann"-Bereich rechts, zweizeilig (v11.32):**
- Zeile 1: Relativ-Label + Datum GROSS (FS.l). Label = `naehertLabel(diff,
  datum)`: heute / morgen / übermorgen / ab 3–7 Tagen Wochentag-Kürzel / sonst
  leer. Färbt sich accent bei ≤7 Tagen, rot bei überfällig.
- Zeile 2: Dauer-Prefix + „ab" + Uhrzeit GROSS. Prefix = `dauerPrefix(dauer)`:
  „ca. 1h" / „ganztags" / „offen". Ohne Uhrzeit nur das Dauer-Label.

**Buttons unten (v11.32):** „Zum Objekt"/„Zum Kontakt" ENTFERNT (Sprung geht über
die verknüpfte Objektkarte oben). Übrig: Löschen-x links (Zwei-Schritt
„Löschen?"), Bearbeiten rechts (in der früheren „Zum Objekt"-Optik: größer, mit
Text + Stift).

**Tagesansicht (v11.35):** Termin-Zeile zeigt statt grauem Typ-Label das Objekt
als kurze VE-Nummer (`terminOrtKurz(termin, ves)` → `ve.nr`, NICHT die Adresse).
Fallback Typ-Label, wenn kein Objekt verknüpft.

## §57 Master-Detail-Aufteilung — Detail-Vorrang & Konsistenz (v11.37–v11.46)

**Kernregel: Detail hat Vorrang, Liste bekommt den Rest, sonst Nur-Detail.**
Kein gequetschtes 50:50. Logik in `useMasterDetailLayout` (detailFest-Pfad):
1. Detail-Wunschbreite (`detailMinBreite`) zuerst reservieren.
2. Bleibt für die Liste ≥ `minSpalte` (260px) übrig → beides nebeneinander
   (Liste mehrspaltig je nach Rest). Reicht es NICHT → Nur-Detail (voll breit) +
   „Zurück zur Liste". Schwelle nutzt die MINDEST-Kartenbreite (260), NICHT die
   evtl. gedehnte cardWidth (sonst springt es zu früh auf Nur-Detail).

**Schrumpf-Kette `minWidth:0` (v11.37, v11.39–v11.41):** Damit der Content neben
dem Seiten-Kalender schrumpft (statt drüberzulaufen), MUSS jeder Flex-Container
in der Kette `minWidth:0` haben — vom contentRef-Container über die Screen-Wurzel
bis zu JEDEM `mdRef`-Container (alle 7). Fehlt es irgendwo, misst der Master-
Detail die volle statt der reduzierten Breite und quetscht.

**Einheitlichkeit (v11.40–v11.41):** Alle drei Master-Detail-Komponenten
(Objekte, Kontakte, Einstellungen) + alle `ObjektListeMitDetail`-Screens nutzen
dieselben `useMasterDetailLayout`-Parameter und dieselbe (gemessene) cardWidth
vom Haupt-Render. Die unterschiedlichen Signatur-Defaults (280/340) greifen nie.

**Detail-Slider (v11.44):** `detailMinBreite` jetzt 400–700px (vorher 500–1200),
Default 400. Bestandswerte werden auf 400–700 geklemmt.

**Seiten-Kalender (v11.45–v11.46):** Dock-Breite 340px (vorher 380, ~10%
schmaler), Monats-Tageszellen `minHeight:32` (vorher 40, kompakter).

## §58 ZurueckButton — einheitlicher Zurück-Button (v11.47)

EINE Komponente `ZurueckButton({ onClick, variante, t, label, kbZurueck })` für
ALLE Master-Detail-Pfade (Objekte, Kontakte, Einstellungen, ObjektListeMitDetail).
Ersetzt 7 zuvor handkopierte Buttons.

- `variante="body"` → eigene Zeile über dem Detail (gap6, marginBottom8,
  alignSelf flex-start), Default-Text „Zurück zur Liste".
- `variante="header"` → kompakt rechts im Sticky-Header (marginLeft auto, gap4,
  flexShrink0), Default-Text „Zurück".
- `kbZurueck` setzt `data-kb-zurueck="1"` für die Tastatur-Navigation.

**Wichtige Lehre:** Icon-Name IMMER `chevL` (in `IC` definiert). Der früher an
5 Stellen genutzte Name `chevron-left` existiert NICHT in `IC` → `I` rendert
`null` → gar kein Pfeil. Bei neuen Icons immer gegen `IC` prüfen.

## §59 Master-Detail — proportionales Schrumpfen & Anteils-Regler (v11.48–v11.51)

### §59.1 Detailbreite als WUNSCH, nicht starr
`useMasterDetailLayout(cardWidth, minDetailFactor, gap, maxCols, detailFest,
detailPx, maxAnteil=0.6)`. Bei `detailFest`:
- Wunschbreite = `min(detailPx, maxAnteil × Gesamtbreite)` — proportionale
  Obergrenze gegen Quetschen auf kleinen Schirmen.
- Reicht der Rest nicht für eine Mindestspalte (280px) → Detail schrumpft weiter,
  bis genau die Spalte passt.
- Fiele das Detail dabei unter `min(detailPx, 400)` → Vollbild-Detail
  (`masterCols 0`, Liste weicht ganz).

Slider „Detailfenster-Breite" jetzt **400–1200px** (zwei Clamps: Slider + zentrale
Durchreichung). Neuer Slider **„Detail-Maximalanteil"** (`detailMaxAnteil`,
40–80 %, Default 60 %) steuert die proportionale Obergrenze.

### §59.2 Mindest-Kartenbreite 300 px
`kartenCols = max(1, min(sliderMax, floor(masterWidth / 300)))` — Schwelle von
200 auf **300** angehoben (an allen 3 Stellen: ObjekteMasterDetail,
KontakteMasterDetail, Einstellungen-`setKartenCols`). Bei knappem Platz lieber
1 breite, lesbare Spalte als 2 gequetschte. Slider bleibt Obergrenze.

### §59.3 Einstellungen-Master-Grid: Overflow-Fix
Das Sektions-Master-Grid darf NICHT `flex:1 1 0%` mit `1fr`-Spalten sein —
`1fr` kann nicht unter Inhaltsbreite schrumpfen und drückt das Detail über den
Rand. Richtig: `flex:0 1 masterWidth` + `gridTemplateColumns: repeat(n,
minmax(0,1fr))`. Detail zusätzlich `maxWidth:100%`. `SektionKachel` braucht
`minWidth:0`, `renderSektionDetail`-Hülle `minWidth:0 + boxSizing:border-box +
overflowWrap:anywhere`. Dieser Overflow-Schutz gilt für ALLE Detail-Hüllen
(Objekte/Kontakte/ListeMitDetail/Einstellungen) einheitlich.

## §60 Farb-Intensität — stufenloser Regler statt „Mehr Farbe" (v11.52–v11.55)

Der binäre Schalter `serioesModus` ist ERSETZT durch einen stufenlosen Regler
`settings.farbIntensitaet` (0–100 %, Default 100).

### §60.1 Mechanik
- `mischeRichtungGrau(hex, t)` interpoliert linear: `t=1` → Originalfarbe,
  `t=0` → `SERIOES_GRAU` (#6B7280).
- Globaler Modul-Wert `_farbIntensitaet`, gesetzt via `setFarbIntensitaet(v)`.
  Wird im App-Render UND in `SektionErscheinungsbild` VOR allen `toGrau`-Aufrufen
  gesetzt (Render-Reihenfolge-Absicherung).
- `toGrau(hex)` ruft `mischeRichtungGrau(hex, _farbIntensitaet)`.
- `serioes = farbIntensitaet < 1` steuert weiterhin, OB die
  effectiveSettings-Graumappings laufen; das WIE-stark macht `toGrau`.

### §60.2 Header geht mit
`systemFarbe` (Logo „Da", Zahnrad/Profil-Button, Bearbeiten-Stift) läuft jetzt
AUCH durch `toGrau` (in `effectiveSettings`). Früher bewusst ausgenommen — auf
Bennys Wunsch graut der Header nun synchron mit. Der FarbPicker für den
System-Akzent nutzt weiter die ROHEN settings (echte Farbe wählbar).

### §60.3 Gold-Ring graduell
Der Vorsitz-/Vertrags-Goldring am Avatar nutzt `toGrau("#EAB308")` statt eines
Exakt-Vergleichs `farbe === SERIOES_GRAU` — graut dadurch graduell mit der
Intensität, statt erst bei exakt 0 % umzuschlagen.

### §60.4 FarbPicker-Sichtbarkeit
FarbPicker (Kacheln, Beirat, System-Akzent) sind sichtbar, SOLANGE
`farbIntensitaet > 0`. Nur bei exakt 0 % (alles grau) werden sie ausgeblendet
(Farbwahl dann sinnlos). Slider sitzt in Erscheinungsbild UNTER den Karten-/
Detail-Reglern.

## §61 Settings-Laden: generisches Default-Merge (v11.55)

`ladeSettings` nutzt `Object.assign({}, DEFAULT_SETTINGS, JSON.parse(raw))` —
gespeicherte Werte über die Defaults gelegt. Fehlende Felder werden generisch
mit ihrem Default ergänzt; KEIN handgepflegtes Migrations-Wirrwarr mehr. Ersetzt
die gelöschte `migriereGewerkeLeistungen` (war für frische Settings wirkungslos,
da DEFAULT_SETTINGS alle Listen vollständig enthält).

> **Grundsatz „Keine Altlasten bis zur Öffentlichkeit" (Benny, 15.06.2026):**
> Solange es keine echten Nutzer/Daten gibt, werden KEINE Migrationen/Legacy-
> Fallbacks mitgeschleppt. Fake-Daten + Defaults werden direkt aufs Zielformat
> gehoben. Migrationen/Integritätsprüfungen kommen erst zur Öffentlichkeit
> zurück (Roadmap-Phase 6). Zielformat: `AllesDa_Datenformat_Spec_*.md`.

## §62 Eigentumsquoten (L1) (v11.56)

Anteile mehrerer **Miteigentümer an EINER Einheit**, grundbuch-genau als Bruch.
Wirkt im **Stimmrecht** (MEA × Quotenanteil), **nicht** in der Abrechnung (die bleibt
einheitenbasiert / über Verteilerschlüssel). Konzept: `Konzept_Eigentumsquoten.md`.

### §62.1 Datenmodell (additiv)
Eigentümer-Eintrag erhält ein optionales Feld:
`{ …, quote: { zaehler, nenner } | null }`.
- `quote: null` (Default) → keine Eingabe nötig. 1 Eigentümer = 100 %; mehrere
  ohne Quote = gleiche Teile (1/n).
- Bruch, NICHT Prozent (exakt; 5/12+4/12+3/12 = 12/12, kein Rundungsdrift bei
  Stimmmehrheiten). Keine Migration (Grundsatz „keine Altlasten").

### §62.2 Helfer (bei `eigStatus`)
- `quoteRoh(p)` → Dezimalwert oder null (tolerant: nenner ≤ 0 → null).
- `quoteAnteil(p, alleEig)` → normierter Anteil 0..1 über die AKTIVEN Eigentümer.
  Gemischt gepflegte Daten werden NICHT stillschweigend aufgefüllt (Einträge ohne
  Quote zählen mit Rohanteil 0, sobald irgendwer eine Quote hat) — bewusst, damit
  Unsauberkeit sichtbar bleibt.
- `quoteLabel(p, alleEig)` → „5/12 (41,7 %)" / „50 %" / "" (kein Badge bei 1 Eig.).
- `quotenStatus(alleEig)` → { gepflegt, summeProz, vollstaendig } für Edit-Hinweis.

### §62.3 Anzeige
`EigentumBlock`: bei mehreren Eigentümern Anteil an den Namen angehängt
(„Max Müller · 5/12 (41,7 %)"). Bei genau 1 Eigentümer kein Quoten-Text.

### §62.4 Eingabe (Belegung-Edit, Level 3)
Quoten-Editor erscheint NUR im `belegungEdit` UND bei ≥ 2 aktiven Eigentümern.
Zwei Zahlenfelder (Zähler / Nenner, je 52px, fontSize 16 — iOS-Regel). Handler
`eigQuoteSetzen(eintrag, z, n)`: ungültig/leer → `quote` gelöscht (null). Dezenter
Summen-Hinweis (Senf-Farbe #CA8A04 bei Über-/Unterdeckung, sonst t.sub).

### §62.5 Stimmrecht-Anschluss (ETV-Anwesenheitsliste)
Liste „ETV-Anwesenheitsliste": MEA pro Eigentümer-Zeile = MEA der Einheit ×
`quoteAnteil`. Damit bleibt die **MEA-Summe je Einheit korrekt**, auch bei
Miteigentum (vorher zeigte jeder Miteigentümer das volle MEA → Summe verdoppelt).
Neue optionale Spalte „Anteil" (Bruch-Badge, nur bei Miteigentum). Greift nur fürs
MEA-/Anteilsprinzip; Objekt-/Kopfprinzip unverändert.

### §62.6 Bewusst NICHT im Scope
Keine Abrechnungswirkung (Verteilerschlüssel bleibt einheitenbasiert; Quote ist
Privatsache der Miteigentümer / Gesamtschuldner-Prinzip). Keine Prozent-Eingabe.
Keine „Eigentümergemeinschaft als Subjekt" (L2 — separates Roadmap-Thema).

## §66 Eigentümergemeinschaft — L2b Zustellung/Liste (v11.62)

Ergänzt §65 (L2a) um den Zustell-/Listen-Aspekt. Damit ist L2 im Rahmen des heute
Möglichen abgeschlossen (der reine Serienbrief-Versand wartet auf die noch nicht
gebaute Serienbrief-Funktion — siehe §66.4).

### §66.1 Modell-Erweiterung
`eigentuemerGemeinschaft.zustellAdresse` (optional, String). Leer → Fallback auf die
Anschrift des Vertreters. Helfer `gemeinschaftZustellAdresse(einheit)`.

### §66.2 Eigentümerliste — wählbare Darstellung
Neuer Filter „Eigentümergemeinschaften zusammenfassen" (default aus). AN → eine Zeile
je Gemeinschaft: Name „Erbengemeinschaft Müller (z. H. <Vertreter>)", MEA der Einheit,
Kontakt/Adresse des Vertreters bzw. die abweichende Zustellanschrift. AUS → alle
Mitglieder einzeln (bisheriges Verhalten). Bewusst wählbar (Benny): Stimmrechts-/
Versandsicht vs. vollständige Kontaktsicht.

### §66.3 Eingabe
Im Gemeinschafts-Block (Quoten-Editor) unter dem Vertreter: optionales Textfeld
„Abweichende Zustellanschrift" (leer = Anschrift des Vertreters). iOS: fontSize 16,
boxSizing border-box.

### §66.4 Offen (echter Serienbrief)
Der eigentliche Serienbrief-/Verteiler-Export ist noch nicht gebaut (nur als geplanter
Listenpunkt vorhanden). Sobald er kommt, muss er bei Gemeinschaften EINEN Empfänger je
Gemeinschaft erzeugen (Vertreter/Zustelladresse) — die Datengrundlage dafür liegt mit
§66.1–66.2 bereit. Weg B (objektübergreifendes Gemeinschafts-Objekt) bleibt Roadmap-
Phase 2.

## §67 TE-Klausel-Register (Dokument-Auswertung am Objekt) — v11.63

Neuer Objekt-Tab „TE" zwischen Verwaltung und Dokumente. Zeigt die Teilungs-
erklärung als gefiltertes, strukturiertes Klausel-Register. Erste Ausprägung des
allgemeinen **Dokument-Register-Musters**: die TE ist Referenz-Bauplan, an dem
spätere Register (Versicherungspolice, Verwaltervertrag, Beschluss) als
Geschwister hängen — gleiche Felder, gleicher Review-Workflow, gleiche
Handlungsbedarf-Anbindung. Schema in `AllesDa_Datenformat_Spec_TE-Register`.

### §67.1 Datenquelle
Liest aus `ve.dokAnalysen[]` (top-level beim Einlesen, pro Objekt gespiegelt).
Erste Analyse mit `dokTyp:"teilungserklaerung"` wird angezeigt. Fehlt sie →
generische **Muster-Klauseln** mit Hinweisbanner („sobald eine TE ausgewertet
ist, erscheinen hier die echten Regelungen"). Keine echten Liegenschaftsdaten in
den Muster-Daten.

### §67.2 Aufbau (Baustein-Wiederverwendung, KEIN neues Layout)
- Kopfzeile: Titel „Teilungserklärung", Anzahl Regelungen + Stand, Button
  „Cheatsheet drucken" (nur Hoch-Klauseln, via `druckeHtml`, ein synchroner
  `window.print` — DESIGN §26.3).
- Bereich-Filter über `FilterButtons` (geschlossene Liste `TE_BEREICHE`,
  farbgruppiert).
- Klausel-Liste als **Akkordeon** (`offeneKarteId`/`onToggle`, nur EINE Karte
  offen, **KEIN Chevron** — §2.9). Klick auf den ganzen Kartenkopf klappt auf/zu.

### §67.3 Klausel-Karte (`TEKlauselKarte`)
Kopf: Bereich-Label (farbig) + Fundstelle, darunter Stichwort. Rechts zwei
Badges: **Relevanz** (`TE_RELEVANZ`: hoch=rot, mittel=amber, niedrig=grau) und —
nur wenn nicht „unverändert/kein_bezug" — **WEMoG-Status** (`TE_WEMOG`:
teilw./überholt/umstritten). Linker Farbstreifen = Bereichsfarbe (`borderLeft 3px`).
Aufgeklappt: Inhalt, Bedeutung für Verwalter, WEMoG-Hinweis (Surface-Box) und —
falls gesetzt — Aktion (Akzent-Tint mit `clock`-Icon).

### §67.4 Schema-Felder (für KI-Senke vorbereitet)
Pro Klausel: `bereich` (Enum), `fundstelle`, `punkt`, `inhalt`, `bedeutung`,
`wemogHinweis` (Freitext) + `wemogStatus` (Enum), `relevanz` (System-Empfehlung)
**getrennt von** `userRelevanz` (Verwalter-Triage, noch nicht gebaut). `quelle`-
Block (`herkunft`/`seite`/`konfidenz`/`reviewStatus`) trägt die Herkunft; bei
KI-Extraktion startet jede Klausel `reviewStatus:"offen"` — KI setzt NIE
„freigegeben". Stufe-2-Wirkung (Handlungsbedarf) nur bei `relevanz:"hoch"` UND
`freigegeben`.

### §67.5 Tab-Registrierung
`DEFAULT_SETTINGS.objektTabs` + `TAB_DEFAULTS` um `{id:"te", label:"TE",
icon:"badge"}` ergänzt (Reihenfolge nach Verwaltung). Über Einstellungen →
Objekt-Tabs aus-/einblendbar und umsortierbar wie die übrigen Tabs.

### §67.6 Offen (Folge-Stufen)
- Stufe 2: `userRelevanz` als inline-editierbares Auswahlfeld (`renderAuswahl`,
  kein Modal); Hoch-Klauseln als Handlungsbedarf-Quelle; Spiegelung definierter
  Klauseln in den `ve`-Stammsatz (Stimmrecht/Geschäftsjahr/Beiratsgröße/abw.
  Kostenverteilung) mit `belegId`-Rückverweis.
- Stufe 3: Mistral Document AI füllt `dokAnalysen`, Review-Screen davor
  („überraschen, nicht überfordern"). Backend-abhängig (Roadmap Phase 4+).

---

## §68 Legionellen-Prüfung (TrinkwV) — eigener Objekt-Tab — v11.67–11.71

Strukturierte Erfassung der Legionellen-Prüfpflicht je Objekt als eigener Tab,
gesteuert über die Warmwasserversorgung in der Technik. Konzept-Dateien:
`Konzept_Legionellen_17_06_2026_02.md`.

### §68.1 Prüfpflicht-Steuerung (Technik → Tab)
Schalter **Warmwasserversorgung** (Zentral/Dezentral) in der Technik-Karte,
immer sichtbar oben im aufgeklappten Karten-Body (`TechnikKarte`), Segment-
Buttons + dynamischer Legionellen-Hinweis. Liegt im `stamm`-Array der Technik-
Karte als Feld `{name:"Warmwasserversorgung", type:"select", optionen:
["Zentral","Dezentral"], immerSichtbar:true}`. Back-Fill in Bestandsobjekte über
`ergaenzeStammSyncFelder` (erweitert um Technik-Zweig).

`objektHatZentralesWarmwasser(ve)` entscheidet über Tab-Sichtbarkeit:
1. **Vorrang:** expliziter Schalter (`Zentral`→true, `Dezentral`→false).
2. **Fallback** (Schalter leer): Ableitung aus Technik-Geräten — Warmwasser-Gerät
   (`typ:"warmwasser"`) mit zentralem System (`LEGIONELLEN_ZENTRAL_SYSTEME` =
   Zentralspeicher/Frischwasserstation/Solarthermie).

Tab-Filter in der Objekt-Detail-Tab-Konstruktion: `legionellen`-Tab nur wenn
`zeigeLegionellen`. Tab-Wechsel-Effekt-Dependency um `zeigeLegionellen` ergänzt,
damit bei Umschalten sauber weggewechselt wird.

### §68.2 Datenmodell (am Objekt)
```
ve.legionellen = {
  letzte, befund ("unauffaellig"|"ueberschritten"|"nachprobe_ok"),
  naechste, naechsteManuell,
  pruefstellen: [{ id, bezeichnung, art ("speicher"|"peripherie"),
                   hausId, raumId, einheitId, notiz }]
}
```

### §68.3 Turnus-Logik (TrinkwV)
`legionellenNaechste(letzte, befund)` ab Tag der letzten Prüfung:
unauffällig → +3 J, ueberschritten → +3 M, nachprobe_ok → +1 J. `naechste`
auto-berechnet, manuell überschreibbar (`naechsteManuell`, „Auto"-Reset).
Status-Ampel `legionellenFaelligStatus`: >3 Mon = ok (neutral), ≤3 Mon = bald
(amber), überfällig = rot. `LEGIONELLEN_STATUS_FARBE`.

### §68.4 Ansicht (`LegionellenAnsicht`)
Drei Karten: Status-Kopf (Ampel + drop-Icon), Erfassung (letzte/Befund/nächste),
Probenahmestellen-Liste, plus TrinkwV-Hinweis-Box. Wiederverwendet `DatumFeld`.

### §68.5 Probenahmestellen + Verknüpfung
Liste mit Bezeichnung + Art-Badge (Speicher=türkis/Peripherie=Akzent) + Löschen.
Inline-Formular: Bezeichnung + Art + **Verknüpfung Haus→Raum/Einheit** (identisch
zum Technik-Zuordnungsmuster, Raum/Einheit gegenseitig ausschließend).
Quelle: `legionellenStandorte(ve)` = Gebäude-/Tiefgaragen-Karten mit `.raeume`/
`.einheiten`. Anzeige je Stelle: zweite Zeile mit Raum-Name bzw. Einheit-Nr +
Ansprechpartner (antippbar → Kontaktprofil).

`legionellenAnsprechpartner(ve, einheitId, kontakte)`: aktueller Bewohner
(`aktiverHaushalt` → erstes Haushaltsmitglied), Fallback Eigentümer. null wenn
keiner. Helfer `legionellenFindeEinheit`/`legionellenFindeRaum`.

### §68.6 Icon
Neues `drop`-Icon in `IC` (Wassertropfen-Pfad) für Tab + Warmwasser-Schalter.

### §68.7 Offen (Folge-Stufen)
- Prüf-Historie / Protokoll-Upload (mit Datei-Upload-Feature).
- Objektübergreifende Legionellen-Übersicht (eigener Screen).
- Optionale Kalender-Kopplung (Termin aus „nächste fällig").

## §69 Selbstnutzer am Kontakt: goldener Ring + Belegungs-Chips (v11.88)

**Problem:** „Selbstnutzer" war fälschlich eine zweite Rolle neben „Eigentümer" am Kontakt.
Selbstnutzung ist KEIN Recht, sondern eine wertvolle Information (Eigentümer wohnt selbst →
direkt ansprechbar, kein Mieter dazwischen). Außerdem ist nicht jeder Eigentümer Selbstnutzer
(mehrere Wohnungen, nur eine selbst bewohnt).

### §69.1 Goldener Ring am Eigentümer-Rollen-Badge
Gleicher Mechanismus wie VBR-Vorsitz: `RolleBadge` erhält drittes Flag `selbstnutzend`, das den
`goldRing` mit auslöst (neben `vorsitz`/`vertrag`). Der Ring sitzt am Eigentümer-Badge in der
aufgeklappten `RollenkarteBox` und sagt „wohnt IRGENDWO selbst" — nicht „wo" (exakt wie der
VBR-Ring bei Vorsitz in mehreren Objekten; Auflösung beim Aufklappen). Tooltip „· Selbstnutzer".

Ableitung in `RollenkarteBox`: nur an der Eigentümer-Karte (slot ve, Rolle „Eigentümer", nicht
ehemalig) via `karteIstSelbstnutzend(karte, ves, kontaktId)`. Dafür reicht `KontaktDetailKarte`
jetzt `kontaktId={k.id}` an `RollenkarteBox` durch.

### §69.2 Belegungs-Chip je Einheit-Kachel
`RollenEinheitZeile` zeigt rechts (wo sonst Fläche/„SE-Bestandteil") für Eigentümer-Karten einen
Klartext-Chip mit Icon in der Verwendungsfarbe:
- „selbst bewohnt" — blau `#3B82F6`, Icon `home` (überschreibt „eigengenutzt", wenn ES der
  angezeigte Kontakt ist)
- „vermietet" — grün `#10B981`, Icon `key`
- „Leerstand" — rot `#DC2626`, Icon `circle`

Farben LIVE aus den Verwendungs-Defs (`useVerwendungen`, Fallback auf die drei Defaults), damit
Custom-Farben mitziehen. Props: `zustand` (Verwendungsname) / `selbst` (bool) / `zustandColor`.
Stellplätze tragen keinen Zustand (eigene Stellung-Anzeige).

### §69.3 Quelle = Belegung, nie ein Flag
Alles rein abgeleitet aus der heute laufenden Belegung (`heuteLaufendeBelegung` →
`recht:"eigennutzer"`-Mitglied mit passender kontaktId). KEIN neues Datenfeld, das verbotene
`selbstnutzer:true`-Flag (Spec §8 Regel 2) bleibt tot. Helfer in `datenmodell.js`:
`istSelbstnutzerInEinheit`, `belegungVerwendungEinerEinheit`, `karteIstSelbstnutzend`.

> **Daten-Hinweis:** Die aktuellen Mock-Daten haben 0 `eigennutzer`-Mitglieder — der Ring
> erscheint dort nie (Code synthetisch verifiziert korrekt). Im echten Betrieb greift es, sobald
> Selbstnutzung sauber mit dem Eigentümer als eigennutzer-Mitglied angelegt ist.

### §69.4 Abgeleitete „Eigennutzer"-Rolle wird bei Eigentümer-Selbstnutzung unterdrückt (v11.91)
**Problem:** Ein Eigentümer, der seine eigene Einheit selbst bewohnt, bekam zusätzlich zur
Eigentümer-Rolle eine **separate abgeleitete „Eigennutzer"-Rolle** — sowohl als eigene
Rollenkarte als auch als EN-Eck-Avatar (blauer Kreis mit Goldring) oben am Kontaktkopf. Das ist
redundant: Die Selbstnutzung wird bereits über den goldenen Ring am Eigentümer-Badge (§69.1) und
das „selbst bewohnt"-Chip an der Einheit-Kachel (§69.2) ausgedrückt.

**Regel:** Ist der Kontakt **aktiver Eigentümer** (Eintrag in `einheit.eigentuemer` ohne `bis`)
**DERSELBEN Einheit**, in der er als `recht:"eigennutzer"`-Haushaltsmitglied steht, wird die
abgeleitete „Eigennutzer"-Rolle **gar nicht erst erzeugt**. Die Selbstnutzung zeigt sich allein
über Ring + Einheit-Chip.

**Single-Point-of-Fix:** Beide Anzeigewege (Eck-Avatar via `belegungsZuweisungen`, Rollenkarte via
`belegungsRollenFuerKontakt`) laufen durch dieselbe Quellfunktion **`belegungsRollenFuerKontakt`**
(`utils-icons.jsx`). Der Filter sitzt dort: pro Einheit wird `istEigentuemerHier` bestimmt
(`einheit.eigentuemer.some(e => !e.bis && String(e.kontaktId)===kid)`); ist das Mitglieds-`recht`
gleich `"eigennutzer"` UND `istEigentuemerHier`, wird das Mitglied übersprungen. Dadurch
verschwindet die EN überall gleichzeitig.

**Bewusst NICHT betroffen** (synthetisch verifiziert):
- **Mieter** behalten ihre „Mieter"-Rolle.
- **Fremde Eigennutzer** (z. B. Nießbraucher/Wohnberechtigte oder ein `eigennutzer`-Mitglied, das
  NICHT Eigentümer derselben Einheit ist) behalten ihre „Eigennutzer"-Rolle — die Unterdrückung
  greift ausschließlich bei der Eigentümer⇄Selbstnutzer-Identität an EINER Einheit.

**Goldener Ring bleibt:** Er hängt an `karteIstSelbstnutzend` → `istSelbstnutzerInEinheit`, das
direkt die Belegung liest — unabhängig von der (jetzt unterdrückten) abgeleiteten Rolle.

### §69.5 „Eigennutzer" ist gar keine Rolle mehr — generelle Entfernung (v11.92)
**Entscheidung (Benny):** „Eigennutzer" soll **komplett aus den Rollen raus**. Die Selbstnutzung
reicht über den goldenen Ring an der Eigentümer-Karte (§69.1) und „selbst bewohnt" an der Einheit
(§69.2) — eine eigene Rolle/Badge ist überflüssig und verwirrend. Erweitert §69.4 (das nur den
Spezialfall Eigentümer⇄Selbstnutzer abdeckte) auf den generellen Fall.

**Drei Änderungen:**
1. **`constants.js` — `DEFAULT_ROLLEN`:** Der Eintrag `{ name:"Eigennutzer", … }` (slot ve) ist
   entfernt. Damit erscheint „Eigennutzer" nicht mehr in der Rollen-Verwaltung
   (Einstellungen → Rollen, Gruppe „Einheit / Nutzung") und ist nirgends mehr als Rolle wählbar.
2. **`utils-icons.jsx` — `belegungsRollenFuerKontakt`:** Mitglieder mit `recht==="eigennutzer"`
   werden GENERELL übersprungen (vorher: nur bei Eigentümer-Identität). Speist Eck-Avatar UND
   Rollenkarte → EN verschwindet an beiden Anzeigewegen für JEDEN, der das Recht trägt.
3. **`datenmodell.js` — `objektZuweisungenAusEinheiten`:** Gleiche generelle Unterdrückung im
   gespeicherten `objektZuweisungen`-Index (`recht==="eigennutzer"` → keine Zuweisung). Damit
   greift es auch in Filtern/Listen, die über den Index laufen.

**Settings-Migration:** `bereinigeRollenSettings` (utils-icons.jsx) hat „Eigennutzer" im
`ENTFERNEN`-Set — eine eventuell gespeicherte `settings.rollen`-Liste verliert den Alt-Eintrag
automatisch beim Laden (analog zur früheren „Bewohner"-Rolle). Kein separates Migrationsskript.

**Was BLEIBT (bewusst unangetastet):** Das Bewohner-**Recht** `eigennutzer` in `BEWOHNER_RECHTE`
(`datenmodell.js`) inkl. `label:"Eigennutzer"`. Es ist weiterhin Quelle für: goldenen Ring
(`istSelbstnutzerInEinheit`/`karteIstSelbstnutzend`), „selbst bewohnt"-Chip, die „Eigennutzer"-
Zeile in den Einheit-Stammdaten (`liegenschaft.jsx` nutzerLabel) sowie Klingelschild/Bewohnerlisten
(`listen-tools.jsx`). „Eigennutzer" ist also ein **Recht**, keine **Rolle** — diese Trennung ist
ab v11.92 die kanonische.

> **Verifiziert mit echten Exportdaten (Andreas+Petra, beide 50%-Eigentümer + selbstnutzend in
> Einheit e2):** Rolle aus DEFAULT_ROLLEN weg; `belegungsRollenFuerKontakt` liefert für beide `[]`;
> `objektZuweisungenAusEinheiten`-Index enthält nur Eigentümer/Mieter/Nießbraucher (kein
> Eigennutzer); Mieter bleibt erhalten; `bereinigeRollenSettings` entfernt Alt-Eintrag.

### §69.6 Goldener Ring auch am Eck-Avatar (oben am Kontaktkopf) (v11.93)
**Problem:** Der goldene Selbstnutzer-Ring (§69.1) erschien nur an der Eigentümer-**Rollenkarte**,
nicht am **Eck-Avatar** oben neben dem Namen. Inkonsistent: dieselbe Eigentümer-Selbstnutzung,
zwei Anzeigeorte, nur einer mit Ring.

**Ursache:** Der Kopf-Avatar bezieht seine Eck-Badges aus `zuweisungenFuerAvatar()`. Die
Eigentümer-Zuweisung (Quelle `kontakt.besitz[]`) trug aber **kein** `selbstnutzend`-Signal — anders
als die Rollenkarte, die es über `karteIstSelbstnutzend` selbst berechnet. Der `RolleBadge` kann den
goldRing bei `selbstnutzend` rendern (Bedingung `vorsitz || vertrag || selbstnutzend`), bekam das
Flag am Eck aber nie.

**Fix (3 Stellen, alle additiv):**
1. `utils-icons.jsx` · `zuweisungenFuerAvatar`: pro `besitz`-Eintrag wird `selbstnutzend` gesetzt
   (`istSelbstnutzerInEinheit(einheit, k.id)`, Einheit über `besitz.objektId/einheitId` aufgelöst).
   Nebenbei `rolle: b.rolle || "Eigentümer"` (besitz-Einträge tragen kein `rolle`-Feld).
2. `components.jsx` · `Avatar`: `selbstnutzend` wird durch `proRolle` → `eckBadges` → alle vier
   Eck-`RolleBadge`-Aufrufe (OL/OR/UL/UR) durchgereicht.
3. `RolleBadge` selbst unverändert — konnte den Ring schon.

Der Ring hängt weiter an `istSelbstnutzerInEinheit` (Belegung, §69.3), nicht an einem Flag. Mieter
und fremde Eigentümer (nicht selbstnutzend) bekommen erwartungsgemäß keinen Ring.

---

## §70 Einheit-Stammdaten: Räume + Sondereigentum-Stellung sichtbar (v11.93, „Block A")

**Anlass:** Die Einheit-Stammdaten zeigten nur 7 Stammfelder (Nr., Verwaltungsnr., Typ, Fläche,
MEA, Lage, Zimmer). Hinterlegte **Räume** (Name, Art, Lage, Fläche — z. B. 7 Räume je Wohnung)
waren komplett unsichtbar, obwohl im Datenmodell vorhanden (`teil.raeume[]`).

**Ursache:** Der Räume-Block (`TeilRaeume`) wurde nur im `unterteilt`-Zweig gerendert — also nur bei
Einheiten mit ≥2 Teilen. Die Normaleinheit (genau ein Teil) erreichte den Block nie. `TeilRaeume`
selbst zeigt Räume auch read-only korrekt (mit „Keine Räume hinterlegt"-Fallback).

**Block A (umgesetzt v11.93):**
- **Räume immer zeigen:** Bei `!unterteilt && !isStellplatz` wird `TeilRaeume` mit `teile[0]`
  separat gerendert (direkt nach der FieldList, vor dem `unterteilt`-Zweig). Liste mit Name,
  Fläche, Zähleranzahl, „nicht abrechenbar"-Markierung; im Edit Σ-Raumflächen + „Als Teilfläche
  übernehmen". Sondernutzung an Räumen (`snrAn`) erscheint mit, sobald gesetzt.
- **Rechtliche Stellung:** Sektion „Sondereigentum" + „Verknüpft mit Einheit N", aber **nur wenn**
  `spStellung !== "eigenstaendig"` ODER `spEinheitId != null`. Bei der Standard-Einheit
  (eigenständig, kein verknüpfter Stellplatz) bleibt sie bewusst leer — „überraschen, nicht
  überfordern".

**Block B (NICHT umgesetzt, Roadmap — echte Modell-Lücken laut Lücken-Analyse TE):** L1
Eigentumsquote pro Miteigentümer (über Verteilerschlüssel weitgehend entschärft), L3 Erbbaurecht,
L4 Pacht/Gewerbe-Nutzungsart strukturiert. Diese brauchen Datenmodell-Erweiterungen, kein Schnellschuss.

> Verifiziert (echte Daten, Einheit e2 mit 7 Räumen): „Räume (7)"-Header + Wohnzimmer + Terrasse
> im gerenderten Stammdaten-Tab sichtbar, ERR=0.

### §70.1 Berechnete Stammdaten-Zeilen mit Override: Gesamtfläche · Wohnfläche · Nutzfläche · Einheiten (v11.94)

**Anlass:** Der Gebäudekarten-Header (`GebaeudeKopf`) zeigte „513 m² Wohnfl. · 118 m² Nutzfl. ·
7 Einheiten" als reine Live-Berechnung aus den Einheiten. Unten in den Stammdaten tauchten diese
Werte gar nicht auf — sie existierten nur im Header, nicht als gepflegte Felder.

**Lösung — neuer Feldtyp `berechnet_override` (datenmodell.js `FIELD_TYPES`):** ein berechneter Wert
mit optionalem manuellem Override. Bewusst **nicht** in `ANLEGE_FELDTYPEN` (nicht manuell anlegbar).
- **Lesemodus:** zeigt den Override-Wert (`field.value`), falls gepflegt, sonst den berechneten Wert
  (`field.berechnet`). Kein „(berechnet)"-Zusatz.
- **Edit-Modus:** Eingabefeld mit dem berechneten Wert als Platzhalter; darunter ein dezenter Hinweis
  „berechnet: 513 m²" (+ „(wird angezeigt)", solange kein Override gesetzt ist). Leer lassen = der
  berechnete Wert gilt weiter.
- Render in `FieldRow` (components.jsx) als eigener Zweig nach `istBerechnet`; `istLeer` in
  `FieldList` lässt diese Felder im Lesemodus **immer** sichtbar (zeigen mind. den berechneten Wert).
  Der `computed`/`readOnly`-Zweig bleibt strikt read-only — `berechnet_override` ist davon getrennt.

**Einspeisung (liegenschaft.jsx `GebaeudeKarte`):** Auf Karten, die Einheiten tragen
(`zeigtEinheiten`), werden vier Zeilen **vorne** in die Stammdaten gehängt — Reihenfolge
**Gesamtfläche · Wohnfläche · Nutzfläche · Einheiten** (feste IDs `_calc_gesamt/_calc_wohn/
_calc_nutz/_calc_einh`). Berechnung wie im Header: Wohnfläche = Σ `flaecheVon` der Nicht-
Teileigentum/Nicht-Stellplatz-Einheiten, Nutzfläche = Σ Teileigentum, Gesamtfläche = Summe beider,
Einheiten = Anzahl. Die berechneten Zeilen werden bei jedem Render frisch erzeugt; **nur** wenn ein
Override gepflegt ist, wird das Feld als normales Stammfeld (`stamm[]`) persistiert — kein neues
Datenmodell-Feld nötig. Auf Karten ohne Einheiten (Technik/Verträge/Versicherungen) erscheinen die
Zeilen nicht.

**Header zeigt den Override:** `GebaeudeKopf` nimmt optionale fertige Anzeige-Strings (`wohnText`/
`nutzText`/`einhText`) entgegen — ist ein Override gepflegt, steht er auch oben im Header statt der
Teilesumme. Fehlen die Props (z. B. Technik-Karte), greift der alte Zahlen-Fallback. Abwärtskompatibel.

> Verifiziert (isolierter Mit-Daten-Render, Einheiten 200+313 m² Wohn + 118 m² Nutz): Lese ohne
> Override zeigt „513"/„118"/„3" ohne Hinweis; Edit zeigt „berechnet:"-Hinweis; Lese+Override (Wohn=
> „520 m²") zeigt „520" statt „513"; Edit+Override zeigt Override + berechnet-Hinweis gleichzeitig.
> Mount ERR=0, DOM 750.

### §70.2 Räume-Abrechenbar im Lesemodus symmetrisch (v11.94)

**Anlass:** Im Raum-Lesemodus (`TeilRaeume`) erschien nur „nicht abrechenbar" (kursiv-grau), wenn
`abrechnungsrelevant === false`. Abrechenbare Räume zeigten **nichts** — die Pflege war stumm, man
konnte „abrechenbar" nicht von „noch nicht gesetzt" unterscheiden.

**Lösung:** Symmetrische Anzeige je Raum: „abrechenbar" in Grün (#10B981) bei
`abrechnungsrelevant !== false`, „nicht abrechenbar" in `t.muted` (grau) bei `=== false` — **beide
kursiv** (`FS.xs`). Default greift weiter (`!== false` → abrechenbar; App-Default `true`).

**Editierbarkeit war schon vorhanden:** Über den Einheit-Stift (`strukturEdit = editMode ||
belegungEdit`, §21.4) wird `TeilRaeume` editierbar; je Raum gibt es die Checkbox „Abrechnungsrelevant".
Kein Umbau — nur der Lesemodus wurde klarer. Die Außenflächen-Regel (Balkon/Terrasse/Loggia/
Dachterrasse/Garten = nicht abrechenbar, Innenräume = abrechenbar) ist eine **Daten**-Konvention,
keine Code-Logik; sie gehört in den JSON-Bauplan (`AUFTRAG_AllesDa_JSON_bauen.md`).

> Verifiziert (isolierter Render): 3 Räume → 2× „abrechenbar" (inkl. Raum ohne Flag), 1× „nicht
> abrechenbar" (Balkon), Grün present; Edit zeigt 3 Checkboxen, keine Lese-Hinweise. ERR=0.
