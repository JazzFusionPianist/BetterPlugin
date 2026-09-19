#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# Patch on Slur — publish a new engine.
#
# The wall (the web page) reaches everyone by itself on every push. The ENGINE
# only changes when people install a new pkg, so a change to Plugin/Source
# needs a release: this script makes one and tells every installed copy.
#
#   ./release.sh 1.0.2            # build → pkg → GitHub release → tell the wall → push
#   ./release.sh 1.0.2 --yes      # …without the question before publishing
#
# What it does:
#   1. stamps the version into CMakeLists.txt (the plugin reports it to the wall)
#   2. builds the release plugin (universal) and the installer pkg
#   3. publishes  github.com/<repo>/releases/tag/patch-on-slur-<version>  with the pkg
#   4. writes the version and the pkg's address into apps/plugin/src/lib/soundsRelease.ts
#   5. commits and pushes: the site redeploys, and every copy older than this
#      shows "<version> is out" with a download key the next time it opens.
#
# A new print? Add its type to PRINT_SINCE in soundsRelease.ts with this
# version BEFORE running this, so older engines keep it shut on the shelf.
# Needs: gh (logged in), Xcode, JUCE.
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail
VERSION="${1:-}"; YES="${2:-}"
[[ "$VERSION" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]] || { echo "usage: ./release.sh <major.minor.patch> [--yes]" >&2; exit 1; }
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"; ROOT="$(cd "$HERE/.." && pwd)"
TAG="patch-on-slur-$VERSION"
ASSET="Patch-on-Slur-$VERSION.pkg"
REPO="$(cd "$ROOT" && gh repo view --json nameWithOwner -q .nameWithOwner)"
URL="https://github.com/$REPO/releases/download/$TAG/$ASSET"
REL="$ROOT/apps/plugin/src/lib/soundsRelease.ts"

cd "$ROOT"
[ -z "$(git status --porcelain -- Plugin/Source apps/plugin/src)" ] || { echo "✗ commit your changes first (Plugin/Source, apps/plugin/src)" >&2; exit 1; }
gh release view "$TAG" >/dev/null 2>&1 && { echo "✗ $TAG is already published" >&2; exit 1; }

echo "→ version $VERSION"
sed -i '' -E "s/^project\(OrbPlugin VERSION [0-9]+\.[0-9]+\.[0-9]+\)/project(OrbPlugin VERSION $VERSION)/" "$HERE/CMakeLists.txt"
grep -q "project(OrbPlugin VERSION $VERSION)" "$HERE/CMakeLists.txt" || { echo "✗ could not stamp the version" >&2; exit 1; }

echo "→ building (release, universal) …"
( cd "$HERE" && ./build.sh --release --only=sounds > "$HERE/build/release-$VERSION.log" 2>&1 ) || { echo "✗ build failed — see Plugin/build/release-$VERSION.log" >&2; exit 1; }
BIN="$HERE/build/OrbSounds_artefacts/Release/AU/Patch on Slur.component/Contents/MacOS/Patch on Slur"
lipo -archs "$BIN" | grep -q x86_64 && lipo -archs "$BIN" | grep -q arm64 || { echo "✗ the build is not universal" >&2; exit 1; }
( cd "$HERE" && ./package.sh --product=sounds --version="$VERSION" > /dev/null )
cp "$HERE/installer/Patch on Slur-$VERSION.pkg" "$HERE/installer/$ASSET"

if [ "$YES" != "--yes" ]; then
  echo ""
  echo "  about to publish  $TAG  →  $URL"
  read -r -p "  publish? (y/n) " a; [ "$a" = y ] || { echo "stopped before publishing (the version stamp is left in CMakeLists.txt)"; exit 0; }
fi

echo "→ publishing $TAG …"
gh release create "$TAG" "$HERE/installer/$ASSET" --title "Patch on Slur $VERSION" --notes "Patch on Slur $VERSION — installer for macOS 11+ (Apple silicon and Intel): Audio Unit and VST3."
rm -f "$HERE/installer/$ASSET"

echo "→ telling the wall …"
sed -i '' -E "s|^export const LATEST: \{ version: string; url: string \} = .*|export const LATEST: { version: string; url: string } = { version: '$VERSION', url: '$URL' }|" "$REL"
grep -q "version: '$VERSION'" "$REL" || { echo "✗ could not write $REL" >&2; exit 1; }
git add "$HERE/CMakeLists.txt" "$REL"
git commit -q -m "release(sounds): Patch on Slur $VERSION" -m "Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
git push -q origin HEAD
echo ""
echo "✓ $VERSION is out: $URL"
echo "  every copy older than $VERSION says so the next time it opens (once the site has redeployed)."
