#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# Orb — notarize + staple the installer .pkg
#
# Apple's notary service scans the signed installer and, on success, lets you
# "staple" a ticket so it installs without a Gatekeeper warning on any Mac,
# offline. The .pkg must already be signed (package.sh with SIGN_ID set to a
# "Developer ID Installer" cert) and its payload bundles signed (sign-apple.sh
# / wraptool for AAX).
#
# One-time: store credentials in the keychain so this isn't prompting:
#   xcrun notarytool store-credentials orb-notary \
#     --apple-id you@apple.com --team-id TEAMID --password <app-specific-pw>
#   (app-specific password: https://account.apple.com ▸ Sign-In and Security)
#
# Usage:
#   ./notarize.sh installer/Orb-1.0.0.pkg            # uses profile orb-notary
#   NOTARY_PROFILE=myprofile ./notarize.sh <pkg>
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

PKG="${1:-}"
PROFILE="${NOTARY_PROFILE:-orb-notary}"

fail() { echo "✗ $1" >&2; exit 1; }
[ -n "$PKG" ] && [ -f "$PKG" ] || fail "Usage: ./notarize.sh <path-to.pkg>"

echo "── submitting to Apple notary ($PROFILE) — this can take a few minutes ──"
xcrun notarytool submit "$PKG" --keychain-profile "$PROFILE" --wait \
  || fail "notarization failed — check 'xcrun notarytool log <submission-id> --keychain-profile $PROFILE'"

echo "── stapling ticket ──"
xcrun stapler staple "$PKG"
xcrun stapler validate "$PKG"

echo ""
echo "✓ Notarized + stapled:  $PKG"
echo "  Installs cleanly on any Mac, no Gatekeeper warning."
