#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# Orb — Apple Developer ID codesigning (AU / VST3 / Standalone)
#
# Signs the built bundles with a "Developer ID Application" certificate +
# hardened runtime + the network entitlement, so they pass Gatekeeper and can
# be notarized. The .aaxplugin is NOT signed here — wraptool does that as part
# of PACE signing (see sign-aax.sh).
#
# Usage:
#   APPLE_SIGN_ID="Developer ID Application: Your Name (TEAMID)" ./sign-apple.sh
#
# Find your identity with:  security find-identity -v -p codesigning
# (You're enrolled in the Apple Developer Program but this cert isn't created
#  yet — make it in Xcode ▸ Settings ▸ Accounts ▸ Manage Certificates ▸ +
#  ▸ "Developer ID Application", then re-run.)
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REL="$SCRIPT_DIR/build/OrbPlugin_artefacts/Release"
STEMLINK_REL="$SCRIPT_DIR/build/OrbStemLink_artefacts/Release"
ENTITLEMENTS="$SCRIPT_DIR/Resources/Orb.entitlements"
APPLE_SIGN_ID="${APPLE_SIGN_ID:-}"

fail() { echo "✗ $1" >&2; exit 1; }

[ -n "$APPLE_SIGN_ID" ] || fail "Set APPLE_SIGN_ID='Developer ID Application: … (TEAMID)'"
[ -f "$ENTITLEMENTS" ]  || fail "Missing entitlements: $ENTITLEMENTS"

sign_bundle() {
  local b="$1"
  [ -d "$b" ] || { echo "  ⚠ skip (not built): $b"; return 0; }
  # --options runtime = hardened runtime (required for notarization).
  # --timestamp       = secure timestamp (required for notarization).
  # --deep signs nested helpers; entitlements grant outbound network for WKWebView.
  codesign --force --deep --options runtime --timestamp \
    --entitlements "$ENTITLEMENTS" \
    --sign "$APPLE_SIGN_ID" \
    "$b"
  codesign --verify --strict --verbose=2 "$b"
  echo "  ✓ signed: $b"
}

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  Apple Developer ID signing"
echo "    identity: $APPLE_SIGN_ID"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
sign_bundle "$REL/VST3/Orb.vst3"
sign_bundle "$REL/AU/Orb.component"
sign_bundle "$REL/Standalone/Orb.app"
sign_bundle "$STEMLINK_REL/VST3/Orb StemLink.vst3"
sign_bundle "$STEMLINK_REL/AU/Orb StemLink.component"
echo ""
echo "✓ Apple bundles signed. Next: ./package.sh then ./notarize.sh"
