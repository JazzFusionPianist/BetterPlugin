#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# Orb Plugin Installer Packager (macOS .pkg)
#
# Bundles the built formats into a single distribution installer the user
# can download and double-click:
#   VST3       → /Library/Audio/Plug-Ins/VST3
#   AU         → /Library/Audio/Plug-Ins/Components
#   AAX        → /Library/Application Support/Avid/Audio/Plug-Ins
#   Standalone → /Applications
#
# Each format is its own sub-package so the user can deselect formats
# they don't need on the "Installation Type" screen.
#
# Usage:
#   ./package.sh                  # package whatever exists in build/…/Release
#   ./package.sh --version 1.2.0  # stamp a version (default 1.0.0)
#   ./package.sh --product=sounds # one of the split-outs: orb (default) | chat | sounds | games
#                                 # → installer/Orb Sounds-1.0.0.pkg, its own identifier
#   SIGN_ID="Developer ID Installer: …" ./package.sh   # signed pkg
#
# Prereqs: run ./build.sh --release first. Formats that weren't built
# are skipped with a warning (e.g. AAX without the Avid SDK).
#
# Notes:
#   • For distribution, set SIGN_ID to a Developer ID Installer certificate
#     and notarize the resulting package.
#   • Release Pro Tools requires a PACE-signed AAX. Unsigned AAX bundles
#     are excluded from the installer.
# ─────────────────────────────────────────────────────────────────────────────

set -euo pipefail

VERSION="1.0.0"
SIGN_ID="${SIGN_ID:-}"
PRODUCT="orb"

for arg in "$@"; do
  case $arg in
    --version=*) VERSION="${arg#--version=}" ;;
    --version)   shift_next=1 ;;
    --product=*) PRODUCT="${arg#--product=}" ;;
    *) if [ "${shift_next:-0}" = 1 ]; then VERSION="$arg"; shift_next=0; fi ;;
  esac
done

# Each split-out is its own downloadable installer with its own bundle
# identifier, so installing Orb Sounds never touches an installed Orb.
case "$PRODUCT" in
  orb)    TARGET="OrbPlugin"; NAME="Orb";        IDENTIFIER_BASE="com.orb.plugin" ;;
  chat)   TARGET="OrbChat";   NAME="Orb Chat";   IDENTIFIER_BASE="com.orb.chat"   ;;
  sounds) TARGET="OrbSounds"; NAME="Orb Sounds"; IDENTIFIER_BASE="com.orb.sounds" ;;
  games)  TARGET="OrbGames";  NAME="Orb Games";  IDENTIFIER_BASE="com.orb.games"  ;;
  *) echo "✗ unknown --product=$PRODUCT (orb | chat | sounds | games)" >&2; exit 1 ;;
esac
SLUG="${NAME// /}"   # inner component pkgs get a space-free name

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ARTEFACTS="$SCRIPT_DIR/build/${TARGET}_artefacts/Release"
OUT_DIR="$SCRIPT_DIR/installer"
WORK="$OUT_DIR/work"

rm -rf "$WORK"
mkdir -p "$WORK/pkgs" "$WORK/roots"

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  $NAME Installer Packager  v$VERSION"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# ── Build one component package ───────────────────────────────────────────────
# $1 = format key (vst3/au/aax/standalone)
# $2 = source bundle path
# $3 = install destination dir
build_component() {
  local key="$1" src="$2" dest="$3"
  if [ ! -d "$src" ]; then
    echo "  ⚠ $key: not built — skipped ($src)"
    return 1
  fi
  local root="$WORK/roots/$key"
  mkdir -p "$root$dest"
  cp -R "$src" "$root$dest/"
  pkgbuild \
    --root "$root" \
    --identifier "$IDENTIFIER_BASE.$key" \
    --version "$VERSION" \
    --install-location "/" \
    "$WORK/pkgs/$SLUG-$key.pkg" > /dev/null
  echo "  ✓ $key  →  $dest"
  return 0
}

# PACE SDK 6 signs with Slur Studio's customer identity, with no product or
# Wrap Configuration registration. Never ship an unsigned AAX by accident.
AAX_SOURCE="$ARTEFACTS/AAX/$NAME.aaxplugin"
AAX_SIGNED=0
if [ -d "$AAX_SOURCE" ]; then
  PACE_WRAPTOOL="${PACE_WRAPTOOL:-/Applications/PACEAntiPiracy/Eden/Fusion/Current/bin/wraptool}"
  if [ ! -x "$PACE_WRAPTOOL" ]; then
    PACE_WRAPTOOL="$(command -v wraptool || true)"
  fi
  if [ -n "${PACE_CUSTOMER_NUMBER:-}" ] && [ -n "${APPLE_SIGN_ID:-}" ]; then
    echo "  • signing AAX for Slur Studio …"
    "$SCRIPT_DIR/sign-aax.sh" "$AAX_SOURCE"
  fi
  if [ -x "$PACE_WRAPTOOL" ] && "$PACE_WRAPTOOL" verify --in "$AAX_SOURCE" >/dev/null 2>&1; then
    AAX_SIGNED=1
  else
    echo "  ⚠ Skipping unsigned AAX; set PACE_CUSTOMER_NUMBER and APPLE_SIGN_ID to include it"
  fi
fi

HAVE_VST3=0; HAVE_AU=0; HAVE_AAX=0; HAVE_APP=0
build_component vst3       "$ARTEFACTS/VST3/$NAME.vst3"         "/Library/Audio/Plug-Ins/VST3"                      && HAVE_VST3=1 || true
build_component au         "$ARTEFACTS/AU/$NAME.component"      "/Library/Audio/Plug-Ins/Components"                && HAVE_AU=1   || true
if [ "$AAX_SIGNED" -eq 1 ]; then
  build_component aax "$AAX_SOURCE" "/Library/Application Support/Avid/Audio/Plug-Ins" && HAVE_AAX=1 || true
fi
build_component standalone "$ARTEFACTS/Standalone/$NAME.app"    "/Applications"                                     && HAVE_APP=1  || true

if [ $((HAVE_VST3 + HAVE_AU + HAVE_AAX + HAVE_APP)) -eq 0 ]; then
  echo "✗ Nothing to package for $NAME. Run ./build.sh --release first." >&2
  exit 1
fi

# ── Distribution definition (choice per format) ──────────────────────────────
DIST="$WORK/distribution.xml"
{
  echo '<?xml version="1.0" encoding="utf-8"?>'
  echo '<installer-gui-script minSpecVersion="2">'
  echo "  <title>$NAME $VERSION</title>"
  echo '  <options customize="allow" require-scripts="false" hostArchitectures="arm64,x86_64"/>'
  echo '  <domains enable_localSystem="true"/>'
  echo '  <choices-outline>'
  [ $HAVE_AU   -eq 1 ] && echo '    <line choice="au"/>'
  [ $HAVE_VST3 -eq 1 ] && echo '    <line choice="vst3"/>'
  [ $HAVE_AAX  -eq 1 ] && echo '    <line choice="aax"/>'
  [ $HAVE_APP  -eq 1 ] && echo '    <line choice="standalone"/>'
  echo '  </choices-outline>'
  emit_choice() { # key title desc
    echo "  <choice id=\"$1\" title=\"$2\" description=\"$3\">"
    echo "    <pkg-ref id=\"$IDENTIFIER_BASE.$1\"/>"
    echo '  </choice>'
    echo "  <pkg-ref id=\"$IDENTIFIER_BASE.$1\" version=\"$VERSION\">$SLUG-$1.pkg</pkg-ref>"
  }
  [ $HAVE_AU   -eq 1 ] && emit_choice au         "Audio Unit (AU)"  "For Logic Pro, GarageBand and other AU hosts."
  [ $HAVE_VST3 -eq 1 ] && emit_choice vst3       "VST3"             "For Cubase, Ableton Live, FL Studio and other VST3 hosts."
  [ $HAVE_AAX  -eq 1 ] && emit_choice aax        "AAX"              "For Pro Tools. Requires PACE-signed builds for release Pro Tools."
  [ $HAVE_APP  -eq 1 ] && emit_choice standalone "Standalone App"   "Run $NAME without a DAW. Installs to /Applications."
  echo '</installer-gui-script>'
} > "$DIST"

# ── Final product archive ─────────────────────────────────────────────────────
mkdir -p "$OUT_DIR"
FINAL="$OUT_DIR/$NAME-$VERSION.pkg"
# ${arr[@]+…} guard: macOS ships bash 3.2 where expanding an empty
# array under `set -u` is an unbound-variable error.
SIGN_ARGS=()
[ -n "$SIGN_ID" ] && SIGN_ARGS=(--sign "$SIGN_ID")

productbuild \
  --distribution "$DIST" \
  --package-path "$WORK/pkgs" \
  ${SIGN_ARGS[@]+"${SIGN_ARGS[@]}"} \
  "$FINAL" > /dev/null

rm -rf "$WORK"

echo ""
echo "✓ Installer ready:"
echo "    $FINAL"
[ -z "$SIGN_ID" ] && echo "  (unsigned — set SIGN_ID env to sign for distribution)"
