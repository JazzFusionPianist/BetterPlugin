#!/bin/bash
# Builds the Slur DAW alpha for this Mac (arm64 or x86_64, whichever it is), and installs it in /Applications.
#   ./build.sh          build and install
#   ./build.sh --run    build, install, then open the installed app
# The build lives in build.noindex: Spotlight leaves a folder of that name alone, so the app in there never turns up
# beside the installed one when "slur daw" is looked for. Nothing in there is ever opened either (./selftest.sh runs a
# copy under another name and takes it away again): a second app that looks like the real one gets opened by mistake,
# and then two copies work on the same project.
set -e
cd "$(dirname "$0")"
B=build.noindex
cmake -S . -B $B -G "Unix Makefiles" -DCMAKE_BUILD_TYPE=Release -DCMAKE_OSX_ARCHITECTURES="$(uname -m)" > build-configure.log 2>&1 || { tail -30 build-configure.log; exit 1; }
cmake --build $B -j "${SLUR_JOBS:-10}"
APP="$B/SlurDaw_artefacts/Release/Slur DAW.app"
# the page travels inside the app, so the app reads nothing outside itself
mkdir -p "$APP/Contents/Resources" && rsync -a --delete ui/ "$APP/Contents/Resources/ui/"
echo "built: $APP"
if [ "$1" = "--only" ]; then exit 0; fi
# installed beside the other apps: copied, signed again there (the page went in after the build signed it), then swapped in,
# so a copy that is open keeps running on the files it already has
DEST="/Applications/Slur DAW.app"
rm -rf "$DEST.new"
ditto "$APP" "$DEST.new"
codesign --force --deep --sign - "$DEST.new" > /dev/null 2>&1
rm -rf "$DEST" && mv "$DEST.new" "$DEST"
echo "installed: $DEST"
if [ "$1" = "--run" ]; then open "$DEST"; fi
exit 0
