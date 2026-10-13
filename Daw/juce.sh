#!/bin/bash
# Puts the one copy of JUCE this app is built with into vendor/JUCE (not kept in git: the commit named in
# cmake/Juce.cmake and vendor/juce-local.patch are what is kept). Once it is there the build uses it and no longer
# looks at /Applications/JUCE.
#   ./juce.sh            from a checkout on this Mac that has the commit (SLUR_JUCE_SRC, default /Applications/JUCE),
#                        else from the library's own repository
#   ./juce.sh --check    only says which copy a build would take, and whether it is the right one
set -e
cd "$(dirname "$0")"
COMMIT=$(sed -n 's/^set(SLUR_JUCE_COMMIT  *\([0-9a-f]\{40\}\)).*/\1/p' cmake/Juce.cmake)
[ -n "$COMMIT" ] || { echo "no commit named in cmake/Juce.cmake"; exit 1; }
SRC="${SLUR_JUCE_SRC:-/Applications/JUCE}"
if [ "$1" = "--check" ]; then
  D=vendor/JUCE; [ -f "$D/CMakeLists.txt" ] || D="$SRC"
  if [ -f "$D/.slur-commit" ]; then H=$(cat "$D/.slur-commit"); else H=$(git -C "$D" rev-parse HEAD 2>/dev/null || echo unknown); fi
  echo "a build takes: $(cd "$D" && pwd -P)"; echo "it stands at:  $H"; echo "wanted:        $COMMIT"
  [ "$H" = "$COMMIT" ] && echo "the right copy" || { echo "NOT the copy this app is built with"; exit 1; }
  exit 0
fi
[ ! -e vendor/JUCE ] || { echo "vendor/JUCE is already there (delete it to fetch again)"; exit 1; }
# only what a build reads: the modules, the build scripts, the licence
PARTS="CMakeLists.txt LICENSE.md modules extras/Build"
mkdir -p vendor/JUCE.new
if git -C "$SRC" cat-file -e "$COMMIT^{commit}" 2>/dev/null; then
  git -C "$SRC" archive "$COMMIT" $PARTS | tar -x -C vendor/JUCE.new
else
  T=$(mktemp -d); trap 'rm -rf "$T"' EXIT
  git -C "$T" init -q && git -C "$T" fetch -q --depth 1 https://github.com/juce-framework/JUCE "$COMMIT"
  git -C "$T" archive FETCH_HEAD $PARTS | tar -x -C vendor/JUCE.new
fi
# the change made by hand in the checkout this app was built with until now (it only acts in a debug build)
( cd vendor/JUCE.new && patch -p1 -s < ../juce-local.patch )
echo "$COMMIT" > vendor/JUCE.new/.slur-commit
mv vendor/JUCE.new vendor/JUCE
echo "vendor/JUCE: $COMMIT, $(du -sh vendor/JUCE | cut -f1)"
