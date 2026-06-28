# Entwicklung und Veröffentlichung

## Voraussetzungen

- macOS 12 oder neuer
- Node.js 20 oder neuer
- npm
- für den Launcher: `iconutil` und `codesign` aus macOS

## Befehle

```bash
npm install       # Abhängigkeiten installieren
npm run dev       # Entwicklungsserver
npm run build     # TypeScript prüfen und Produktions-Bundle bauen
npm run preview   # Produktions-Bundle testen
npm run launcher  # Produktions-Bundle und macOS-App erzeugen
```

## Projektstruktur

```text
assets/       Icon-Quellen und macOS-Icon
docs/         Projektdokumentation
launcher/     Info.plist und Launcher-Programm
scripts/      Build-Automatisierung
src/          React-/TypeScript-Quellcode
```

## Qualitätsprüfung

Vor einer Veröffentlichung mindestens ausführen:

```bash
npm run build
```

Zusätzlich sollten Sprachwechsel, RTL-Ansicht, Standortsuche einschließlich Tippfehlern und Namensvarianten, Ereigniswechsel, Simulation sowie Desktop- und Mobilansicht im Browser geprüft werden.

## Diagnose

Der Launcher schreibt Chrome-Meldungen nach `~/Library/Logs/UMBRA/browser.log` und Servermeldungen nach `~/Library/Logs/UMBRA/server.log`. Laufzeitfehler der Web-App sowie verlorene oder wiederhergestellte WebGL-Kontexte werden zusätzlich als JSON-Zeilen in `~/Library/Logs/UMBRA/app.log` protokolliert und als begrenzte Historie im lokalen Browser-Speicher gehalten.

Der dedizierte Chrome-Start deaktiviert Skia Graphite sowohl über den direkten Chromium-Schalter als auch über die gleichnamige Feature-Flag, weil dieser Compositor unabhängig vom Three.js-Globus den gesamten GPU-Prozess beenden kann. Der WebGL-Renderer bittet auf Macs mit automatischer Grafikumschaltung zusätzlich um die leistungsfähige GPU. Verliert WebGL dennoch seinen Kontext, blendet UMBRA die beschädigte Zeichenfläche aus und baut den Globus automatisch neu auf. Nach drei erfolglosen Renderer-Neustarts lädt UMBRA die Seite einmal automatisch neu. Erst wenn auch diese vollständige Wiederherstellung scheitert, erscheint eine manuelle Neustarttaste; eine Sitzungsmarkierung verhindert Endlosschleifen.

## Optionale KI-Ortssuche

Die Vorlage `.env.example` dokumentiert die Variablen `OPENAI_API_KEY` und `OPENAI_LOCATION_MODEL`. Für den macOS-Launcher gehört die echte Konfiguration nach `~/Library/Application Support/UMBRA/.env` und muss nur für den eigenen Benutzer lesbar sein. `.env`-Dateien sind von Git ausgeschlossen. Der Server verwendet die Responses API mit einem strikten JSON-Schema und protokolliert niemals den Schlüssel.

## Neue Sprache hinzufügen

1. Sprache in `languages` in `src/i18n.ts` ergänzen.
2. Einen vollständigen typisierten Übersetzungssatz anlegen.
3. Dictionary-Zuordnung ergänzen.
4. Datums-, Zahlen- und RTL-Darstellung prüfen.

## GitHub

Das Repository verwendet `main` als Hauptbranch. Änderungen sollten über einen thematischen Branch, einen prägnanten Commit und einen Pull Request veröffentlicht werden. Generierte Verzeichnisse wie `node_modules`, `dist` und das `.app`-Bundle werden nicht versioniert.
