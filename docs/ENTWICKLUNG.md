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

Zusätzlich sollten Sprachwechsel, RTL-Ansicht, Standortwahl, Ereigniswechsel, Simulation sowie Desktop- und Mobilansicht im Browser geprüft werden.

## Neue Sprache hinzufügen

1. Sprache in `languages` in `src/i18n.ts` ergänzen.
2. Einen vollständigen typisierten Übersetzungssatz anlegen.
3. Dictionary-Zuordnung ergänzen.
4. Datums-, Zahlen- und RTL-Darstellung prüfen.

## GitHub

Das Repository verwendet `main` als Hauptbranch. Änderungen sollten über einen thematischen Branch, einen prägnanten Commit und einen Pull Request veröffentlicht werden. Generierte Verzeichnisse wie `node_modules`, `dist` und das `.app`-Bundle werden nicht versioniert.
