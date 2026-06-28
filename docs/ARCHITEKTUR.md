# Architektur

## Überblick

UMBRA ist eine statische Single-Page-Anwendung. Sämtliche astronomischen Berechnungen und Darstellungen laufen im Browser. Ein kleiner lokaler Node.js-Server liefert ausschließlich die gebauten Dateien aus.

```text
Benutzeroberfläche (React)
├── Ereignis- und Standortzustand
├── fehlertoleranter Offline-Ortsindex
├── optionale serverseitige KI-Ortsauflösung
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
- `src/locations.ts`: lazy geladene Offline-Ortssuche, Namensvarianten, Tippfehlertoleranz und Trefferbewertung
- `src/diagnostics.ts`: lokale Fehlerhistorie und Übermittlung an das Launcher-Protokoll
- `src/data/cities.json`: kompakter, lokal gebündelter GeoNames-Ortsindex
- `src/i18n.ts`: zehn vollständige Sprachfassungen
- `src/styles.css`: responsives Design, Tooltips und Sprachwahl
- `server.mjs`: minimaler lokaler Produktionsserver
- `launcher/`: Quellen des macOS-Launchers
- `scripts/build-launcher.sh`: reproduzierbarer App-Bundle-Build

## Offline-Grenze

Astronomisches Modell, JavaScript, Styles, Kartendaten und Ortsverzeichnis sind im Produktions-Bundle enthalten. Die reguläre Nutzung benötigt keine externen Dienste; der Ortsindex wird erst beim Fokussieren der Standorteingabe in den Browser geladen. Ausschließlich die vom Nutzer ausgelöste genauere Ortssuche ruft über den lokalen Node-Server die OpenAI Responses API auf. Der API-Schlüssel bleibt dabei im Serverprozess und wird nicht an den Browser ausgeliefert.

Der Server liest die optionale Konfiguration aus `.env` im Entwicklungsordner oder aus `~/Library/Application Support/UMBRA/.env` beim Launcher-Betrieb. Ergebnisse werden für die laufende Sitzung im Speicher zwischengespeichert. Anfragen haben Größen- und Zeitlimits; Fehler fallen auf die lokale Suche zurück.

Die Ortsdaten stammen über `all-the-cities` aus dem unter CC BY bereitgestellten [GeoNames-Datenexport](https://www.geonames.org/export/). Das Skript `npm run generate:cities` erzeugt daraus den kompakten Browserindex.

## Datenfluss

1. Astronomy Engine sucht Ereignisse um das aktuelle Datum.
2. React wählt das nächste oder ein manuell angeklicktes Ereignis.
3. `calculateShadowPath` berechnet zeitabhängige Schnittpunkte der Mondschattenachse mit dem Erdellipsoid.
4. Three.js projiziert diese Punkte auf die Globusoberfläche.
5. Die Simulationszeit steuert den aktuellen Schattenmarker; die Standortkoordinaten steuern unabhängig davon den kleinen Beobachtungsmarker.

## Internationalisierung

Übersetzungen sind typisiert. Jede Sprache muss denselben vollständigen Schlüsselsatz bereitstellen. Datum, Zeit und Zahlen werden zusätzlich über `Intl` in der gewählten Locale formatiert.
