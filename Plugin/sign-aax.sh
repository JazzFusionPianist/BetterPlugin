#!/usr/bin/env bash
# Sign one built AAX plugin with Slur Studio's PACE signing-only account.
# PACE Code Signing for AAX SDK 6 can sign with the publisher's customer name
# and number; no product or Wrap Configuration registration is required.
#
# Usage:
#   PACE_CUSTOMER_NUMBER=<number-from-PACE-Central> \
#   APPLE_SIGN_ID='Developer ID Application: ...' \
#   ./sign-aax.sh /path/to/Plugin.aaxplugin
#
# Optional: PACE_PRODUCT_NAME=<display-name> overrides the name embedded in
# the PACE signature. Otherwise wraptool uses the AAX bundle's filename.
# Keep the iLok USB connected and sign in to iLok License Manager first.
set -euo pipefail

fail() { echo "✗ $1" >&2; exit 1; }

[ "$#" -eq 1 ] || fail "Usage: $0 /path/to/Plugin.aaxplugin"
AAX="$1"
[ -d "$AAX" ] || fail "AAX bundle not found: $AAX"
[[ "$AAX" == *.aaxplugin ]] || fail "Expected a .aaxplugin bundle: $AAX"

PACE_WRAPTOOL="${PACE_WRAPTOOL:-/Applications/PACEAntiPiracy/Eden/Fusion/Current/bin/wraptool}"
if [ ! -x "$PACE_WRAPTOOL" ]; then
  PACE_WRAPTOOL="$(command -v wraptool || true)"
fi
[ -n "$PACE_WRAPTOOL" ] && [ -x "$PACE_WRAPTOOL" ] || fail "PACE wraptool is not installed"

PACE_CUSTOMER_NAME="${PACE_CUSTOMER_NAME:-Slur Studio}"
PACE_CUSTOMER_NUMBER="${PACE_CUSTOMER_NUMBER:-}"
APPLE_SIGN_ID="${APPLE_SIGN_ID:-}"
[ -n "$PACE_CUSTOMER_NUMBER" ] || fail "Set PACE_CUSTOMER_NUMBER from PACE Central → Admin → Company Details"
[ -n "$APPLE_SIGN_ID" ] || fail "Set APPLE_SIGN_ID to your Developer ID Application certificate name"

echo "Signing $AAX for $PACE_CUSTOMER_NAME"
args=(sign --verbose
  --customernumber "$PACE_CUSTOMER_NUMBER"
  --customername "$PACE_CUSTOMER_NAME"
  --signid "$APPLE_SIGN_ID"
  --dsig1-compat off)
[ -z "${PACE_ACCOUNT:-}" ] || args+=(--account "$PACE_ACCOUNT")
[ -z "${PACE_PRODUCT_NAME:-}" ] || args+=(--productname "$PACE_PRODUCT_NAME")
args+=(--in "$AAX")

"$PACE_WRAPTOOL" "${args[@]}"
"$PACE_WRAPTOOL" verify --verbose --in "$AAX" || fail "PACE signature verification failed"
echo "✓ AAX signed and verified: $AAX"
