#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# CoOp Plugin Build Script
# Builds AU + VST3 formats. Optionally installs to system plugin folders.
#
# Usage:
#   ./build.sh                    # Debug build
#   ./build.sh --release          # Release build
#   ./build.sh --release --install # Build & install to ~/Library/...
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

AAX_SDK_PATH="/Users/jasonpark/Documents/Coding/BetterPlugin/aax-sdk-2-9-0"

# ── Args ─────────────────────────────────────────────────────────────────────
for arg in "$@"; do
  case $arg in
    --release) BUILD_TYPE="Release" ;;
    --install) INSTALL=true ;;
    --aax=*)   AAX_SDK_PATH="${arg#--aax=}" ;;
  esac
done

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BUILD_DIR="$SCRIPT_DIR/build"

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  CoOp Plugin Build"
echo "  Config : $BUILD_TYPE"
echo "  URL    : $COOP_APP_URL"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# ── CMake configure ────────────────────────────────────────────────────────────
BUILD_TARGETS="CoOpPlugin_AU CoOpPlugin_VST3 CoOpPlugin_AAX"

if [ -n "$AAX_SDK_PATH" ]; then
  echo "  AAX    : $AAX_SDK_PATH"
fi

cmake -B "$BUILD_DIR" \
      -DCMAKE_BUILD_TYPE="$BUILD_TYPE" \
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

echo "  AU   → $AU_PATH"
echo "  VST3 → $VST3_PATH"
echo ""

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
