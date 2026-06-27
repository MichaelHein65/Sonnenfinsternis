# Architektur

## Überblick

UMBRA ist eine statische Single-Page-Anwendung. Sämtliche astronomischen Berechnungen und Darstellungen laufen im Browser. Ein kleiner lokaler Node.js-Server liefert ausschließlich die gebauten Dateien aus.

```text
Benutzeroberfläche (React)
├── Ereignis- und Standortzustand
├── fehlertoleranter Offline-Ortsindex
├── Internationalisierung
├── Simulationssteuerung
└── 3D-Globus (Three.js)
    ├── lokale Weltkarte (world-atlas)
    ├── Kartenprojektion (D3-Geo)
    └── Schattenbahn (Astronomy Engine + eigene Geometrie)
```

## Module

- `src/App.tsx`: Anwendungszustand, Bedienoberfläche und Ereignisauswahl
- `src/Globe.tsx`: Three.js-Szene, Welttextur, Atmosphäre und Schattenbahn
- `src/astronomy.ts`: Ereignissuche, lokale Berechnung und Schnittpunkt der Schattenachse
- `tz-lookup`: lokale Offline-Zeitzone aus den Koordinaten des Beobachtungsorts
- `src/locations.ts`: lazy geladene Offline-Ortssuche, Namensvarianten und Tippfehlertoleranz
- `src/data/cities.json`: kompakter, lokal gebündelter GeoNames-Ortsindex
- `src/i18n.ts`: zehn vollständige Sprachfassungen
- `src/styles.css`: responsives Design, Tooltips und Sprachwahl
- `server.mjs`: minimaler lokaler Produktionsserver
- `launcher/`: Quellen des macOS-Launchers
- `scripts/build-launcher.sh`: reproduzierbarer App-Bundle-Build

## Offline-Grenze

Zur Laufzeit werden keine HTTP-Anfragen an externe Dienste gestellt. Astronomisches Modell, JavaScript, Styles, Kartendaten und Ortsverzeichnis sind im Produktions-Bundle enthalten. Der Ortsindex wird erst beim Fokussieren der Standorteingabe in den Browser geladen. Lediglich die einmalige Paketinstallation benötigt Zugriff auf das npm-Registry.

Die Ortsdaten stammen über `all-the-cities` aus dem unter CC BY bereitgestellten [GeoNames-Datenexport](https://www.geonames.org/export/). Das Skript `npm run generate:cities` erzeugt daraus den kompakten Browserindex.

## Datenfluss

1. Astronomy Engine sucht Ereignisse um das aktuelle Datum.
2. React wählt das nächste oder ein manuell angeklicktes Ereignis.
3. `calculateShadowPath` berechnet zeitabhängige Schnittpunkte der Mondschattenachse mit dem Erdellipsoid.
4. Three.js projiziert diese Punkte auf die Globusoberfläche.
5. Die Simulationszeit steuert den aktuellen Schattenmarker.

## Internationalisierung

Übersetzungen sind typisiert. Jede Sprache muss denselben vollständigen Schlüsselsatz bereitstellen. Datum, Zeit und Zahlen werden zusätzlich über `Intl` in der gewählten Locale formatiert.
