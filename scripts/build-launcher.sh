#!/bin/zsh
set -euo pipefail

ROOT="$(cd "${0:A:h}/.." && pwd)"
APP="$ROOT/Start_Sonnenfinsternis.app"

cd "$ROOT"
npm run build

rm -rf "$APP"
mkdir -p "$APP/Contents/MacOS" "$APP/Contents/Resources/dist"
cp launcher/Info.plist "$APP/Contents/Info.plist"
cp launcher/Start_Sonnenfinsternis "$APP/Contents/MacOS/Start_Sonnenfinsternis"
cp assets/Umbra.icns "$APP/Contents/Resources/Umbra.icns"
cp server.mjs "$APP/Contents/Resources/server.mjs"
cp -R dist/. "$APP/Contents/Resources/dist/"
chmod +x "$APP/Contents/MacOS/Start_Sonnenfinsternis"
codesign --force --deep --sign - "$APP"
codesign --verify --deep --strict "$APP"

echo "Launcher erstellt: $APP"
