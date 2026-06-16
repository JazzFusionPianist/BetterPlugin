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
#   SIGN_ID="Developer ID Installer: …" ./package.sh   # signed pkg
#
# Prereqs: run ./build.sh --release first. Formats that weren't built
# are skipped with a warning (e.g. AAX without the Avid SDK).
#
# Notes:
#   • Unsigned pkgs show a Gatekeeper warning on other machines
#     (right-click → Open works). For distribution, set SIGN_ID to a
#     "Developer ID Installer" cert and notarize the result.
#   • AAX additionally needs PACE/iLok signing to load in release
#     Pro Tools — the unsigned AAX here only works in PT Developer
#     builds. The pkg still installs it for that workflow.
# ─────────────────────────────────────────────────────────────────────────────

set -euo pipefail

VERSION="1.0.0"
SIGN_ID="${SIGN_ID:-}"
IDENTIFIER_BASE="com.orb.plugin"

for arg in "$@"; do
  case $arg in
    --version=*) VERSION="${arg#--version=}" ;;
    --version)   shift_next=1 ;;
    *) if [ "${shift_next:-0}" = 1 ]; then VERSION="$arg"; shift_next=0; fi ;;
  esac
done

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ARTEFACTS="$SCRIPT_DIR/build/OrbPlugin_artefacts/Release"
OUT_DIR="$SCRIPT_DIR/installer"
WORK="$OUT_DIR/work"

rm -rf "$WORK"
mkdir -p "$WORK/pkgs" "$WORK/roots"

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  Orb Installer Packager  v$VERSION"
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
    "$WORK/pkgs/Orb-$key.pkg" > /dev/null
  echo "  ✓ $key  →  $dest"
  return 0
}

# Auto-sign AAX with PACE/iLok before packaging when credentials are present.
# Without this the bundled .aaxplugin only loads in Pro Tools Developer builds.
# See sign-aax.sh for the one-time account prerequisites.
if [ -n "${PACE_ACCOUNT:-}" ] && [ -d "$ARTEFACTS/AAX/Orb.aaxplugin" ]; then
  echo "  • signing AAX (PACE_ACCOUNT set) …"
  "$SCRIPT_DIR/sign-aax.sh" || echo "  ⚠ AAX signing failed — packaging the unsigned bundle"
fi

HAVE_VST3=0; HAVE_AU=0; HAVE_AAX=0; HAVE_APP=0
build_component vst3       "$ARTEFACTS/VST3/Orb.vst3"           "/Library/Audio/Plug-Ins/VST3"                      && HAVE_VST3=1 || true
build_component au         "$ARTEFACTS/AU/Orb.component"        "/Library/Audio/Plug-Ins/Components"                && HAVE_AU=1   || true
build_component aax        "$ARTEFACTS/AAX/Orb.aaxplugin"       "/Library/Application Support/Avid/Audio/Plug-Ins"  && HAVE_AAX=1  || true
build_component standalone "$ARTEFACTS/Standalone/Orb.app"      "/Applications"                                     && HAVE_APP=1  || true

if [ $((HAVE_VST3 + HAVE_AU + HAVE_AAX + HAVE_APP)) -eq 0 ]; then
  echo "✗ Nothing to package. Run ./build.sh --release first." >&2
  exit 1
fi

# ── Distribution definition (choice per format) ──────────────────────────────
DIST="$WORK/distribution.xml"
{
  echo '<?xml version="1.0" encoding="utf-8"?>'
  echo '<installer-gui-script minSpecVersion="2">'
  echo "  <title>Orb $VERSION</title>"
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
    echo "  <pkg-ref id=\"$IDENTIFIER_BASE.$1\" version=\"$VERSION\">Orb-$1.pkg</pkg-ref>"
  }
  [ $HAVE_AU   -eq 1 ] && emit_choice au         "Audio Unit (AU)"  "For Logic Pro, GarageBand and other AU hosts."
  [ $HAVE_VST3 -eq 1 ] && emit_choice vst3       "VST3"             "For Cubase, Ableton Live, FL Studio and other VST3 hosts."
  [ $HAVE_AAX  -eq 1 ] && emit_choice aax        "AAX"              "For Pro Tools. Requires PACE-signed builds for release Pro Tools."
  [ $HAVE_APP  -eq 1 ] && emit_choice standalone "Standalone App"   "Run Orb without a DAW. Installs to /Applications."
  echo '</installer-gui-script>'
} > "$DIST"

# ── Final product archive ─────────────────────────────────────────────────────
mkdir -p "$OUT_DIR"
FINAL="$OUT_DIR/Orb-$VERSION.pkg"
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
