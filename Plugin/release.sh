#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# Release one product — Patch on Slur, Slur or Slur Games — on its own.
#
# Each product carries its own page (built from apps/plugin/<product>.html) and counts its own version, so a
# release of one never waits on, or carries, the others' work. The check before publishing looks only at the files
# THIS product's page is made of (dist-<product>/modules.json, written by the page build) and the engine sources.
#
#   ./release.sh sounds 1.0.29         # Patch on Slur: build → pkg → GitHub release → tell the wall → push
#   ./release.sh chat   1.0.5          # Slur
#   ./release.sh games  1.0.29         # Slur Games
#   ./release.sh sounds 1.0.29 --yes   # …without the question before publishing
#
# What it does:
#   1. stamps the product's version into CMakeLists.txt (ORB_VERSION_<PRODUCT>; the plugin reports it to its page)
#   2. builds the product's page, checks nothing it is made of is uncommitted, then builds the release plugin
#      (universal) and the installer pkg
#   3. publishes  github.com/<repo>/releases/tag/<tag>-<version>  with the pkg
#   4. Patch on Slur only: writes the version and the pkg's address into apps/plugin/src/lib/soundsRelease.ts, so
#      every older copy says "<version> is out" the next time it opens
#   5. commits and pushes
#
# A new print? Add its type to PRINT_SINCE in soundsRelease.ts with this version BEFORE running this.
# Needs: gh (logged in), Xcode, JUCE, pnpm.
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

PRODUCT="${1:-}"; VERSION="${2:-}"; YES="${3:-}"
usage() { echo "usage: ./release.sh <sounds|chat|games> <major.minor.patch> [--yes]" >&2; exit 1; }
[[ "$VERSION" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]] || usage
case "$PRODUCT" in
  sounds) NAME="Patch on Slur"; TAGBASE="patch-on-slur"; ASSET="Patch-on-Slur-$VERSION.pkg"; VAR=ORB_VERSION_SOUNDS; TARGET=OrbSounds; BUNDLE="Patch on Slur" ;;
  chat)   NAME="Slur";          TAGBASE="slur";          ASSET="Slur-$VERSION.pkg";          VAR=ORB_VERSION_CHAT;   TARGET=OrbChat;   BUNDLE="Slur" ;;
  games)  NAME="Slur Games";    TAGBASE="slur-games";    ASSET="Slur-Games-$VERSION.pkg";    VAR=ORB_VERSION_GAMES;  TARGET=OrbGames;  BUNDLE="Slur Games" ;;
  *) usage ;;
esac
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"; ROOT="$(cd "$HERE/.." && pwd)"
TAG="$TAGBASE-$VERSION"
REPO="$(cd "$ROOT" && gh repo view --json nameWithOwner -q .nameWithOwner)"
URL="https://github.com/$REPO/releases/download/$TAG/$ASSET"
REL="$ROOT/apps/plugin/src/lib/soundsRelease.ts"
WEB="$ROOT/apps/plugin"

cd "$ROOT"
gh release view "$TAG" >/dev/null 2>&1 && { echo "✗ $TAG is already published" >&2; exit 1; }

echo "→ $NAME $VERSION"
sed -i '' -E "s/^set\($VAR +[0-9]+\.[0-9]+\.[0-9]+\)/set($VAR $VERSION)/" "$HERE/CMakeLists.txt"
grep -qE "^set\($VAR +$VERSION\)" "$HERE/CMakeLists.txt" || { echo "✗ could not stamp the version ($VAR)" >&2; exit 1; }

# the page first: it says what it is made of, and only those files (and the engine's) must be committed
echo "→ building the $PRODUCT page …"
( cd "$WEB" && pnpm run "build:$PRODUCT" > "$HERE/build/web-build-$PRODUCT.log" 2>&1 ) || { echo "✗ the page did not build — see Plugin/build/web-build-$PRODUCT.log" >&2; exit 1; }
DIRTY="$(git status --porcelain -- Plugin/Source Plugin/build.sh Plugin/package.sh "apps/plugin/$PRODUCT.html" apps/plugin/vite.config.ts apps/plugin/package.json $(python3 -c "import json; print(' '.join(json.load(open('$WEB/dist-$PRODUCT/modules.json'))))") | grep -v "Plugin/CMakeLists.txt" || true)"
[ -z "$DIRTY" ] || { echo "✗ commit these first — $NAME is made of them:" >&2; echo "$DIRTY" >&2; exit 1; }
mkdir -p "$HERE/build/webui-$PRODUCT"; rm -f "$HERE/build/webui-$PRODUCT/webui.zip"
( cd "$WEB/dist-$PRODUCT" && rm -f index.html && cp "$PRODUCT.html" index.html && zip -q -r -X "$HERE/build/webui-$PRODUCT/webui.zip" . -x "$PRODUCT.html" )

echo "→ building (release, universal) …"
( cd "$HERE" && SKIP_WEB=1 ./build.sh --release --only="$PRODUCT" > "$HERE/build/release-$PRODUCT-$VERSION.log" 2>&1 ) || { echo "✗ build failed — see Plugin/build/release-$PRODUCT-$VERSION.log" >&2; exit 1; }
BIN="$HERE/build/${TARGET}_artefacts/Release/AU/$BUNDLE.component/Contents/MacOS/$BUNDLE"
lipo -archs "$BIN" | grep -q x86_64 && lipo -archs "$BIN" | grep -q arm64 || { echo "✗ the build is not universal" >&2; exit 1; }
( cd "$HERE" && ./package.sh --product="$PRODUCT" --version="$VERSION" > /dev/null )
[ "$HERE/installer/$BUNDLE-$VERSION.pkg" = "$HERE/installer/$ASSET" ] || cp "$HERE/installer/$BUNDLE-$VERSION.pkg" "$HERE/installer/$ASSET"

if [ "$YES" != "--yes" ]; then
  echo ""
  echo "  about to publish  $TAG  →  $URL"
  read -r -p "  publish? (y/n) " a; [ "$a" = y ] || { echo "stopped before publishing (the version stamp is left in CMakeLists.txt)"; exit 0; }
fi

echo "→ publishing $TAG …"
gh release create "$TAG" "$HERE/installer/$ASSET" --title "$NAME $VERSION" --notes "$NAME $VERSION — installer for macOS 12+ (Apple silicon and Intel): Audio Unit and VST3."
rm -f "$HERE/installer/$ASSET"

FILES=("$HERE/CMakeLists.txt")
if [ "$PRODUCT" = sounds ]; then
  echo "→ telling the wall …"
  sed -i '' -E "s|^export const LATEST: \{ version: string; url: string \} = .*|export const LATEST: { version: string; url: string } = { version: '$VERSION', url: '$URL' }|" "$REL"
  grep -q "version: '$VERSION'" "$REL" || { echo "✗ could not write $REL" >&2; exit 1; }
  FILES+=("$REL")
fi
git add "${FILES[@]}"
git commit -q -m "release($PRODUCT): $NAME $VERSION" -m "Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
git push -q origin HEAD
echo ""
echo "✓ $NAME $VERSION is out: $URL"
[ "$PRODUCT" = sounds ] && echo "  every copy older than $VERSION says so the next time it opens (once the site has redeployed)."
exit 0
