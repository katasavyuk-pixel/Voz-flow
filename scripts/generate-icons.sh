#!/bin/bash
# Genera icon.icns (Mac) y favicon.ico (Windows) desde icon.png
set -e

ICON_SRC="public/icon.png"

if [ ! -f "$ICON_SRC" ]; then
  echo "Error: No se encontró $ICON_SRC"
  echo "Coloca tu imagen PNG de 1024x1024 en public/icon.png"
  exit 1
fi

echo "Generando iconos desde $ICON_SRC..."

# --- macOS .icns ---
ICONSET="public/icon.iconset"
mkdir -p "$ICONSET"

sips -z 16 16     "$ICON_SRC" --out "$ICONSET/icon_16x16.png"      > /dev/null
sips -z 32 32     "$ICON_SRC" --out "$ICONSET/icon_16x16@2x.png"   > /dev/null
sips -z 32 32     "$ICON_SRC" --out "$ICONSET/icon_32x32.png"      > /dev/null
sips -z 64 64     "$ICON_SRC" --out "$ICONSET/icon_32x32@2x.png"   > /dev/null
sips -z 128 128   "$ICON_SRC" --out "$ICONSET/icon_128x128.png"    > /dev/null
sips -z 256 256   "$ICON_SRC" --out "$ICONSET/icon_128x128@2x.png" > /dev/null
sips -z 256 256   "$ICON_SRC" --out "$ICONSET/icon_256x256.png"    > /dev/null
sips -z 512 512   "$ICON_SRC" --out "$ICONSET/icon_256x256@2x.png" > /dev/null
sips -z 512 512   "$ICON_SRC" --out "$ICONSET/icon_512x512.png"    > /dev/null
sips -z 1024 1024 "$ICON_SRC" --out "$ICONSET/icon_512x512@2x.png" > /dev/null

iconutil -c icns "$ICONSET" -o public/icon.icns
rm -rf "$ICONSET"
echo "✓ public/icon.icns generado"

# --- Windows .ico (multi-resolución) ---
# Crear PNGs temporales para el .ico
TMPDIR=$(mktemp -d)
for SIZE in 16 24 32 48 64 128 256; do
  sips -z $SIZE $SIZE "$ICON_SRC" --out "$TMPDIR/icon_${SIZE}.png" > /dev/null
done

# Usar el PNG de 256 como favicon.ico (electron-builder lo acepta como PNG)
cp "$TMPDIR/icon_256.png" public/favicon.ico
rm -rf "$TMPDIR"
echo "✓ public/favicon.ico generado"

# --- Tray icon (16x16 para la barra de menú) ---
sips -z 32 32 "$ICON_SRC" --out public/tray-icon.png > /dev/null
echo "✓ public/tray-icon.png generado"

echo ""
echo "¡Listo! Iconos generados correctamente."
echo "Ahora puedes hacer: npm run electron-build"
