#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# Orb Plugin Build Script
# Builds AU + VST3 formats. Optionally installs to system plugin folders.
#
# Usage:
#   ./build.sh                    # Debug build (AU + VST3 + Standalone, plus the split-outs)
#   ./build.sh --release          # Release build
#   ./build.sh --release --install # Build & install to ~/Library/...
#   ./build.sh --standalone-only  # Only build the standalone .app (fastest)
#   ./build.sh --run              # Build then open the standalone .app
#   ./build.sh --only=sounds      # Just one split-out (orb | chat | sounds | games)
#
# Requirements:
#   - Xcode (xcode-select --install)
#   - JUCE installed at /Applications/JUCE
#   - Set ORB_APP_URL below to your Vercel deployment URL
# ─────────────────────────────────────────────────────────────────────────────

set -euo pipefail

# ── Config ────────────────────────────────────────────────────────────────────
ORB_APP_URL="https://better-plugin.vercel.app"
BUILD_TYPE="Debug"
INSTALL=false
SKIP_AAX=false
STANDALONE_ONLY=false
RUN=false
ONLY=""

AAX_SDK_PATH="/Users/jasonpark/Documents/Coding/BetterPlugin/aax-sdk-2-9-0"

# ── Args ─────────────────────────────────────────────────────────────────────
for arg in "$@"; do
  case $arg in
    --release)         BUILD_TYPE="Release" ;;
    --install)         INSTALL=true ;;
    --aax=*)           AAX_SDK_PATH="${arg#--aax=}" ;;
    --no-aax)          SKIP_AAX=true ;;
    --url=*)           ORB_APP_URL="${arg#--url=}" ;;
    --standalone-only) STANDALONE_ONLY=true ;;
    --run)             RUN=true ;;
    --only=*)          ONLY="${arg#--only=}" ;;
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
echo "  Orb Plugin Build"
echo "  Config : $BUILD_TYPE"
echo "  URL    : $ORB_APP_URL"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# ── CMake configure ────────────────────────────────────────────────────────────
# The split-out single-purpose plugins (see CMakeLists.txt) build beside
# the full Orb: CMake target → product name, one line each.
SPLIT_TARGETS=(OrbChat OrbSounds OrbGames)
SPLIT_NAMES=("Orb Chat" "Patch on Slur" "Orb Games")

split_targets() { # AU + VST3 for every split-out (filtered by --only)
  local i out=""
  for i in "${!SPLIT_TARGETS[@]}"; do
    local t="${SPLIT_TARGETS[$i]}"
    case "$ONLY" in
      "")      ;;
      chat)    [ "$t" = OrbChat ]   || continue ;;
      sounds)  [ "$t" = OrbSounds ] || continue ;;
      games)   [ "$t" = OrbGames ]  || continue ;;
      *)       continue ;;
    esac
    out="$out ${t}_AU ${t}_VST3"
  done
  echo "$out"
}

if [ "$STANDALONE_ONLY" = true ]; then
  BUILD_TARGETS="OrbPlugin_Standalone"
  echo "  Format : Standalone only (fast dev iteration)"
elif [ -n "$ONLY" ] && [ "$ONLY" != orb ]; then
  BUILD_TARGETS="$(split_targets)"
  echo "  Only   : $ONLY"
elif [ -n "$AAX_SDK_PATH" ]; then
  BUILD_TARGETS="OrbPlugin_AU OrbPlugin_VST3 OrbPlugin_Standalone OrbPlugin_AAX$(split_targets)"
  echo "  AAX    : $AAX_SDK_PATH"
else
  BUILD_TARGETS="OrbPlugin_AU OrbPlugin_VST3 OrbPlugin_Standalone$(split_targets)"
  echo "  AAX    : (skipped — no SDK)"
fi
[ -n "$BUILD_TARGETS" ] || { echo "✗ --only=$ONLY matches no target (orb | chat | sounds | games)" >&2; exit 1; }

cmake -B "$BUILD_DIR" \
      -DCMAKE_BUILD_TYPE="$BUILD_TYPE" \
      -DCMAKE_OSX_DEPLOYMENT_TARGET=11.0 \
      -DORB_APP_URL="$ORB_APP_URL" \
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
AU_PATH=$(find "$BUILD_DIR" -name "Orb.component"  -maxdepth 6 2>/dev/null | head -1)
VST3_PATH=$(find "$BUILD_DIR" -name "Orb.vst3"     -maxdepth 6 2>/dev/null | head -1)
STANDALONE_PATH=$(find "$BUILD_DIR" -name "Orb.app"        -maxdepth 6 2>/dev/null | head -1)

# --only=<split> builds just that plugin: leave the full Orb's products
# (and its install below) untouched.
FULL_ORB=true
[ -n "$ONLY" ] && [ "$ONLY" != orb ] && FULL_ORB=false

if [ "$FULL_ORB" = true ]; then
  [ -n "$AU_PATH"         ] && echo "  AU         → $AU_PATH"
  [ -n "$VST3_PATH"       ] && echo "  VST3       → $VST3_PATH"
  [ -n "$STANDALONE_PATH" ] && echo "  Standalone → $STANDALONE_PATH"
fi
for SPLIT_NAME in "${SPLIT_NAMES[@]}"; do
  # while-read, not $(…): the product names carry spaces
  find "$BUILD_DIR" -maxdepth 6 \( -name "$SPLIT_NAME.component" -o -name "$SPLIT_NAME.vst3" \) -path "*/$BUILD_TYPE/*" 2>/dev/null \
    | while IFS= read -r P; do echo "  $SPLIT_NAME → $P"; done
done
echo ""

# ── Launch standalone (optional, for fast iteration) ─────────────────────────
if [ "$RUN" = true ] && [ -n "$STANDALONE_PATH" ]; then
  echo "→ Launching standalone…"
  # Re-launching the same bundle: kill the running instance first so the
  # rebuild's binary is actually what we open.
  pkill -x Orb 2>/dev/null || true
  open "$STANDALONE_PATH"
fi

# ── Install (optional) ────────────────────────────────────────────────────────
if [ "$INSTALL" = true ]; then
  AU_DEST=~/Library/Audio/Plug-Ins/Components
  VST3_DEST=~/Library/Audio/Plug-Ins/VST3
  AAX_DEST="/Library/Application Support/Avid/Audio/Plug-Ins"
  # Do not install a stale AAX bundle left by an earlier build when this run
  # explicitly skipped AAX (otherwise a normal AU/VST3 refresh unexpectedly
  # prompts for an administrator password and aborts before cache refresh).
  AAX_PATH=""
  if [ -n "$AAX_SDK_PATH" ]; then
    AAX_PATH=$(find "$BUILD_DIR" -name "Orb.aaxplugin" -maxdepth 6 2>/dev/null | head -1)
  fi

  mkdir -p "$AU_DEST" "$VST3_DEST"

  if [ "$FULL_ORB" = true ] && [ -n "$AU_PATH" ]; then
    rm -rf "$AU_DEST/Orb.component"
    cp -R "$AU_PATH" "$AU_DEST/"
    echo "✓ AU   installed → $AU_DEST/Orb.component"
  fi

  if [ "$FULL_ORB" = true ] && [ -n "$VST3_PATH" ]; then
    rm -rf "$VST3_DEST/Orb.vst3"
    cp -R "$VST3_PATH" "$VST3_DEST/"
    echo "✓ VST3 installed → $VST3_DEST/Orb.vst3"
  fi

  # The split-out plugins (Orb Chat, Patch on Slur, …) install alongside Orb —
  # only the ones this run built (this config), so --only=sounds never
  # re-installs a stale Orb Chat.
  for SPLIT_NAME in "${SPLIT_NAMES[@]}"; do
    case "$ONLY" in
      chat)   [ "$SPLIT_NAME" = "Orb Chat" ]   || continue ;;
      sounds) [ "$SPLIT_NAME" = "Patch on Slur" ] || continue ;;
      games)  [ "$SPLIT_NAME" = "Orb Games" ]  || continue ;;
    esac
    SPLIT_AU_PATH=$(find "$BUILD_DIR" -maxdepth 6 -name "$SPLIT_NAME.component" -path "*/$BUILD_TYPE/*" 2>/dev/null | head -1)
    SPLIT_VST3_PATH=$(find "$BUILD_DIR" -maxdepth 6 -name "$SPLIT_NAME.vst3" -path "*/$BUILD_TYPE/*" 2>/dev/null | head -1)
    if [ -n "$SPLIT_AU_PATH" ]; then
      # Patch on Slur was Orb Sounds: the old bundle carries the same codes,
      # so it must go or the host sees the plugin twice.
      [ "$SPLIT_NAME" = "Patch on Slur" ] && rm -rf "$AU_DEST/Orb Sounds.component" "$VST3_DEST/Orb Sounds.vst3"
      rm -rf "$AU_DEST/$SPLIT_NAME.component"
      cp -R "$SPLIT_AU_PATH" "$AU_DEST/"
      echo "✓ AU   installed → $AU_DEST/$SPLIT_NAME.component"
    fi
    if [ -n "$SPLIT_VST3_PATH" ]; then
      rm -rf "$VST3_DEST/$SPLIT_NAME.vst3"
      cp -R "$SPLIT_VST3_PATH" "$VST3_DEST/"
      echo "✓ VST3 installed → $VST3_DEST/$SPLIT_NAME.vst3"
    fi
  done

  # Cubase/Nuendo discover user MIDI Remote scripts from this documented
  # folder. Install the Orb adapter beside the plugin so the master instance
  # can read project tracks through Steinberg's own in-DAW API.
  CUBASE_REMOTE_SOURCE="$SCRIPT_DIR/RemoteScripts/Cubase/orb_orb_control.js"
  if [ -f "$CUBASE_REMOTE_SOURCE" ]; then
    for STEINBERG_PRODUCT in "Cubase 15" "Cubase 14" "Cubase 13" "Nuendo 14" "Nuendo 13"; do
      CUBASE_REMOTE_DEST="$HOME/Documents/Steinberg/$STEINBERG_PRODUCT/MIDI Remote/Driver Scripts/Local/Orb/Orb Control"
      mkdir -p "$CUBASE_REMOTE_DEST"
      cp "$CUBASE_REMOTE_SOURCE" "$CUBASE_REMOTE_DEST/orb_orb_control.js"
    done
    echo "✓ Cubase/Nuendo Orb Control adapter installed"
  fi

  if [ "$FULL_ORB" = true ] && [ -n "$AAX_PATH" ]; then
    sudo mkdir -p "$AAX_DEST"
    sudo rm -rf "$AAX_DEST/Orb.aaxplugin"
    sudo cp -R "$AAX_PATH" "$AAX_DEST/"
    echo "✓ AAX  installed → $AAX_DEST/Orb.aaxplugin"
  fi

  # Notify Logic Pro / AudioComponentRegistrar
  killall -9 AudioComponentRegistrar 2>/dev/null || true
  echo ""
  echo "✓ Plugin folders refreshed. Restart your DAW."
fi
