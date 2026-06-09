#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# CoOp Plugin Build Script
# Builds AU + VST3 formats. Optionally installs to system plugin folders.
#
# Usage:
#   ./build.sh                    # Debug build (AU + VST3 + Standalone)
#   ./build.sh --release          # Release build
#   ./build.sh --release --install # Build & install to ~/Library/...
#   ./build.sh --standalone-only  # Only build the standalone .app (fastest)
#   ./build.sh --run              # Build then open the standalone .app
#
# Requirements:
#   - Xcode (xcode-select --install)
#   - JUCE installed at /Applications/JUCE
#   - Set COOP_APP_URL below to your Vercel deployment URL
# ─────────────────────────────────────────────────────────────────────────────

set -euo pipefail

# ── Config ────────────────────────────────────────────────────────────────────
COOP_APP_URL="https://better-plugin.vercel.app"
BUILD_TYPE="Debug"
INSTALL=false
SKIP_AAX=false
STANDALONE_ONLY=false
RUN=false

AAX_SDK_PATH="/Users/jasonpark/Documents/Coding/BetterPlugin/aax-sdk-2-9-0"

# ── Args ─────────────────────────────────────────────────────────────────────
for arg in "$@"; do
  case $arg in
    --release)         BUILD_TYPE="Release" ;;
    --install)         INSTALL=true ;;
    --aax=*)           AAX_SDK_PATH="${arg#--aax=}" ;;
    --no-aax)          SKIP_AAX=true ;;
    --url=*)           COOP_APP_URL="${arg#--url=}" ;;
    --standalone-only) STANDALONE_ONLY=true ;;
    --run)             RUN=true ;;
  esac
done

# AAX requires the Avid SDK; skip it gracefully when the path is missing
# or --no-aax was passed (keeps local builds green without Avid access).
if [ "$SKIP_AAX" = true ] || [ ! -d "$AAX_SDK_PATH" ]; then
  AAX_SDK_PATH=""
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BUILD_DIR="$SCRIPT_DIR/build"

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  CoOp Plugin Build"
echo "  Config : $BUILD_TYPE"
echo "  URL    : $COOP_APP_URL"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# ── CMake configure ────────────────────────────────────────────────────────────
if [ "$STANDALONE_ONLY" = true ]; then
  BUILD_TARGETS="CoOpPlugin_Standalone"
  echo "  Format : Standalone only (fast dev iteration)"
elif [ -n "$AAX_SDK_PATH" ]; then
  BUILD_TARGETS="CoOpPlugin_AU CoOpPlugin_VST3 CoOpPlugin_Standalone CoOpPlugin_AAX"
  echo "  AAX    : $AAX_SDK_PATH"
else
  BUILD_TARGETS="CoOpPlugin_AU CoOpPlugin_VST3 CoOpPlugin_Standalone"
  echo "  AAX    : (skipped — no SDK)"
fi

cmake -B "$BUILD_DIR" \
      -DCMAKE_BUILD_TYPE="$BUILD_TYPE" \
      -DCMAKE_OSX_DEPLOYMENT_TARGET=11.0 \
      -DCOOP_APP_URL="$COOP_APP_URL" \
      -DAAX_SDK_PATH="$AAX_SDK_PATH" \
      -G Xcode \
      "$SCRIPT_DIR"

# ── Build ─────────────────────────────────────────────────────────────────────
cmake --build "$BUILD_DIR" \
      --config "$BUILD_TYPE" \
      --target $BUILD_TARGETS \
      -- -quiet

echo ""
echo "✓ Build complete."
echo ""

# ── Locate built products ─────────────────────────────────────────────────────
AU_PATH=$(find "$BUILD_DIR" -name "CoOp.component"  -maxdepth 6 2>/dev/null | head -1)
VST3_PATH=$(find "$BUILD_DIR" -name "CoOp.vst3"     -maxdepth 6 2>/dev/null | head -1)
STANDALONE_PATH=$(find "$BUILD_DIR" -name "CoOp.app"        -maxdepth 6 2>/dev/null | head -1)

[ -n "$AU_PATH"         ] && echo "  AU         → $AU_PATH"
[ -n "$VST3_PATH"       ] && echo "  VST3       → $VST3_PATH"
[ -n "$STANDALONE_PATH" ] && echo "  Standalone → $STANDALONE_PATH"
echo ""

# ── Launch standalone (optional, for fast iteration) ─────────────────────────
if [ "$RUN" = true ] && [ -n "$STANDALONE_PATH" ]; then
  echo "→ Launching standalone…"
  # Re-launching the same bundle: kill the running instance first so the
  # rebuild's binary is actually what we open.
  pkill -x CoOp 2>/dev/null || true
  open "$STANDALONE_PATH"
fi

# ── Install (optional) ────────────────────────────────────────────────────────
if [ "$INSTALL" = true ]; then
  AU_DEST=~/Library/Audio/Plug-Ins/Components
  VST3_DEST=~/Library/Audio/Plug-Ins/VST3
  AAX_DEST="/Library/Application Support/Avid/Audio/Plug-Ins"
  AAX_PATH=$(find "$BUILD_DIR" -name "CoOp.aaxplugin" -maxdepth 6 2>/dev/null | head -1)

  mkdir -p "$AU_DEST" "$VST3_DEST"

  if [ -n "$AU_PATH" ]; then
    rm -rf "$AU_DEST/CoOp.component"
    cp -R "$AU_PATH" "$AU_DEST/"
    echo "✓ AU   installed → $AU_DEST/CoOp.component"
  fi

  if [ -n "$VST3_PATH" ]; then
    rm -rf "$VST3_DEST/CoOp.vst3"
    cp -R "$VST3_PATH" "$VST3_DEST/"
    echo "✓ VST3 installed → $VST3_DEST/CoOp.vst3"
  fi

  if [ -n "$AAX_PATH" ]; then
    sudo mkdir -p "$AAX_DEST"
    sudo rm -rf "$AAX_DEST/CoOp.aaxplugin"
    sudo cp -R "$AAX_PATH" "$AAX_DEST/"
    echo "✓ AAX  installed → $AAX_DEST/CoOp.aaxplugin"
  fi

  # Notify Logic Pro / AudioComponentRegistrar
  killall -9 AudioComponentRegistrar 2>/dev/null || true
  echo ""
  echo "✓ Plugin folders refreshed. Restart your DAW."
fi
