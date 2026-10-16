#!/bin/bash
# Builds the Slur Studio alpha for this Mac (arm64 or x86_64, whichever it is), and installs it in /Applications.
#   ./build.sh          build and install
#   ./build.sh --run    build, install, then open the installed app
# The build lives in build.noindex: Spotlight leaves a folder of that name alone, so the app in there never turns up
# beside the installed one when "slur studio" is looked for. Nothing in there is ever opened either (./selftest.sh runs a
# copy under another name and takes it away again): a second app that looks like the real one gets opened by mistake,
# and then two copies work on the same project.
set -e
cd "$(dirname "$0")"
# Patch on Slur's prints come from the plug-in's own source on every build — their pictures (ui/prints.js) and what they
# are (ui/catalog.js: names, flavours, every hand, units) — and the build stops here when the plug-in and this wall no
# longer agree (tools/catalog-check.mjs says what to do: a new print is given its place in ui/wall.js, or left off)
node tools/prints-from-patch.mjs > /dev/null && node tools/catalog-from-patch.mjs > /dev/null && node tools/catalog-check.mjs
B=build.noindex
cmake -S . -B $B -G "Unix Makefiles" -DCMAKE_BUILD_TYPE=Release -DCMAKE_OSX_ARCHITECTURES="$(uname -m)" > build-configure.log 2>&1 || { tail -30 build-configure.log; exit 1; }
cmake --build $B -j "${SLUR_JOBS:-10}"
APP="$B/SlurDaw_artefacts/Release/Slur Studio.app"
# the page travels inside the app, so the app reads nothing outside itself
mkdir -p "$APP/Contents/Resources" && rsync -a --delete ui/ "$APP/Contents/Resources/ui/"
cp Resources/project-folder.png "$APP/Contents/Resources/project-folder.png"      # (the icon a project's own folder wears in the Finder: design/project folder icon draft 4)
# and the user guide, for Help > Slur Studio Help (guide/build.mjs makes the PDFs; a tree without them builds an app without them)
rm -rf "$APP/Contents/Resources/Guide"; if ls guide/pdf/*.pdf > /dev/null 2>&1; then mkdir -p "$APP/Contents/Resources/Guide" && cp guide/pdf/*.pdf "$APP/Contents/Resources/Guide/"; fi
# and so does the program an mp3 is made with (vendor/lame: LAME, as it is, with its licence — ./lame.sh makes it), so that
# an mp3 can be printed on any Mac the app runs on
if [ -x vendor/lame/lame ]; then mkdir -p "$APP/Contents/Helpers" && cp vendor/lame/lame "$APP/Contents/Helpers/lame" && cp vendor/lame/COPYING "$APP/Contents/Resources/lame COPYING.txt"; else echo "no vendor/lame/lame: this build cannot print an mp3 (./lame.sh makes it)"; fi
echo "built: $APP"
if [ "$1" = "--only" ]; then exit 0; fi
# installed beside the other apps: copied, signed again there (the page went in after the build signed it), then swapped in,
# so a copy that is open keeps running on the files it already has
DEST="/Applications/Slur Studio.app"
rm -rf "$DEST.new"
ditto "$APP" "$DEST.new"
# Signed with a certificate of this Mac's own when there is one whose name begins "Slur Studio" (or the one named in
# SLUR_SIGN_ID): the Mac remembers what an app may reach (the microphone, the Documents folder a plug-in keeps its presets
# in) by who signed it, and an app signed by nobody is a new app to it after every build — it asks again each time. With
# a certificate the answer given once holds for every build after. Without one it is signed by nobody, as before.
SIGN="${SLUR_SIGN_ID:-$(security find-identity -p codesigning 2> /dev/null | sed -n 's/.*"\(Slur Studio[^"]*\)".*/\1/p' | head -1)}"
if [ -n "$SIGN" ] && codesign --force --deep --sign "$SIGN" "$DEST.new" > /dev/null 2>&1; then echo "signed: $SIGN"
else codesign --force --deep --sign - "$DEST.new" > /dev/null 2>&1; echo "signed by nobody (the Mac will ask again for the microphone and Documents after this build: see build.sh)"; fi
rm -rf "$DEST" && mv "$DEST.new" "$DEST"
echo "installed: $DEST"
# the same program under the name it had before ("Slur DAW"): taken away, so that there are never two to open — unless a
# copy of it is open right now, which is left to be closed by hand
OLD="/Applications/Slur DAW.app"
if [ -d "$OLD" ]; then
  if pgrep -qf "$OLD/Contents/MacOS/"; then echo "still there, because it is open: $OLD (quit it, then delete it or build again)"; else rm -rf "$OLD" && echo "taken away: $OLD"; fi
fi
if [ "$1" = "--run" ]; then open "$DEST"; fi
exit 0
