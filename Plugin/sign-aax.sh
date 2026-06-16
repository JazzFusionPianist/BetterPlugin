#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# CoOp — AAX PACE/iLok signing
#
# An AAX plugin only loads in *release* Pro Tools if it is signed with PACE's
# `wraptool`. The unsigned bundle that `build.sh` produces only loads in a
# Pro Tools *Developer* build. This script wraps the canonical wraptool call.
#
# It does NOT (and cannot) create the accounts or licences that wraptool needs
# — those are one-time, human steps gated behind Avid + PACE agreements. See
# the CHECKLIST at the bottom. Once you have them, this script signs in place.
#
# Usage:
#   PACE_ACCOUNT=you@studio.com \
#   PACE_WCGUID=XXXXXXXX-XXXX-XXXX-XXXX-XXXXXXXXXXXX \
#   APPLE_SIGN_ID="Developer ID Application: Your Name (TEAMID)" \
#   ./sign-aax.sh
#
#   # password is prompted (never pass it on the command line / env if avoidable)
#   # or use iLok Cloud:  ICLOUD=1 ./sign-aax.sh   (adds --usecloud)
#
# Prereqs checked at runtime: wraptool on PATH, the built .aaxplugin, and the
# three values above.
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
AAX="$SCRIPT_DIR/build/CoOpPlugin_artefacts/Release/AAX/CoOp.aaxplugin"

PACE_ACCOUNT="${PACE_ACCOUNT:-}"
PACE_WCGUID="${PACE_WCGUID:-}"
APPLE_SIGN_ID="${APPLE_SIGN_ID:-}"
USECLOUD="${ICLOUD:-0}"

fail() { echo "✗ $1" >&2; exit 1; }

command -v wraptool >/dev/null 2>&1 || fail "wraptool not on PATH. Install PACE Eden Tools (see CHECKLIST in this file)."
[ -d "$AAX" ]            || fail "AAX bundle not built: $AAX  (run ./build.sh --release first)"
[ -n "$PACE_ACCOUNT" ]   || fail "Set PACE_ACCOUNT=<your PACE/iLok account name>"
[ -n "$PACE_WCGUID" ]    || fail "Set PACE_WCGUID=<the product GUID you registered in your PACE account>"
[ -n "$APPLE_SIGN_ID" ]  || fail "Set APPLE_SIGN_ID=<'Developer ID Application: … (TEAMID)'> — wraptool Apple-signs the bundle too"

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  AAX signing"
echo "    bundle : $AAX"
echo "    account: $PACE_ACCOUNT"
echo "    wcguid : $PACE_WCGUID"
echo "    apple  : $APPLE_SIGN_ID"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

CLOUD_ARGS=()
[ "$USECLOUD" = "1" ] && CLOUD_ARGS=(--usecloud)

# wraptool signs in place (--in == --out). It both PACE-wraps and Apple
# codesigns the bundle with --signid, so no separate `codesign` pass is needed
# for the .aaxplugin itself.
wraptool sign --verbose \
  --account "$PACE_ACCOUNT" \
  --wcguid  "$PACE_WCGUID" \
  --signid  "$APPLE_SIGN_ID" \
  --dsig1-compat off \
  --allowsigningservice \
  ${CLOUD_ARGS[@]+"${CLOUD_ARGS[@]}"} \
  --in  "$AAX" \
  --out "$AAX"

echo ""
echo "── verifying signature ──"
wraptool verify --verbose --in "$AAX" || fail "verify failed"

echo ""
echo "✓ AAX signed:  $AAX"
echo "  It will now load in release Pro Tools. Re-run ./package.sh to bundle it."

# ─────────────────────────────────────────────────────────────────────────────
# CHECKLIST — one-time, human-only prerequisites (cannot be scripted):
#
#  1. Avid Developer / AAX program
#       https://developer.avid.com/  → join, accept the AAX agreement.
#       (You already have the AAX SDK at ../aax-sdk-2-9-0.)
#
#  2. PACE / Eden developer account + iLok
#       https://www.paceap.com/  (PACE Anti-Piracy / "Eden Tools").
#       - Sign the PACE developer agreement.
#       - Install "PACE Eden Tools" → gives you `wraptool` on PATH.
#       - You already have iLok License Manager. PACE deposits a developer
#         signing certificate onto your iLok (USB) or iLok Cloud.
#
#  3. Register the product → get a wcguid
#       In your PACE developer account create a product entry for CoOp and
#       copy its GUID. That is PACE_WCGUID above.
#
#  4. Apple "Developer ID Application" certificate (paid Apple Developer
#       Program). The Mac currently only has an "Apple Development" cert,
#       which is NOT valid for distribution. The same cert is also required
#       to notarize the AU / VST3 / Standalone for the .pkg.
# ─────────────────────────────────────────────────────────────────────────────
