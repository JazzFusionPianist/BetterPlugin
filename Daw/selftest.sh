#!/bin/bash
# Runs the app's own check (ui/selftest.js) on what is in this folder now. Nothing is installed.
#   ./selftest.sh           the whole check (about five minutes), with the speakers silent
#   SLUR_OWN_AU=1 ./selftest.sh    the whole check with audio units opened by the app's own host (Source/host) and not
#                           through the library; SLUR_AU_APART=1 as well: each in a process of its own
#   ./selftest.sh slur      only slur's own page in its place (needs the net)
#   SLUR_URL=http://localhost:5173 ./selftest.sh slur     the same, with the panel reading another copy of the page
#   ./selftest.sh realtime  only a realtime print: the mix, two stems, a bounce in place, and one stopped (the room drawn as it plays)
#   ./selftest.sh menus     only the menu bar: every menu there, which keys it takes and leaves, a line pressed, its tick
#   ./selftest.sh display   only settings > display: the room wearing a look, and slur turning light with its ground (needs the net)
#   ./selftest.sh themes    only the themes: the six pressed in settings > display, the room wearing each (its parts too), and back
#   ./selftest.sh keys      only settings > key commands: as logic pro, his own logic set read from this Mac, a key given by hand and undone
#   ./selftest.sh plugins   only settings > plug-ins: every plug-in on the Mac in it, the delays left out of the room's lists and back,
#                           the mac's delay called a reverb by hand and given back
#   ./selftest.sh bench     only the measure (ui/bench.js; ./bench.sh runs it and keeps what it found)
#   ./selftest.sh crash     only a bad end and what comes back after it: the app is brought down by a plug-in in the middle
#                           of a take, then started again (the first run's notes are kept as selftest-crash.json)
#   ./selftest.sh twice     only this: the app is put down twice from outside with a song open that has a plug-in in it (two
#                           bad ends with nothing to name); the third start must bring the song back without the plug-in
#   ./selftest.sh hung      only this: a plug-in never comes back on the device's thread; the app stands still and is put down
#                           from outside; the next start must name the plug-in and leave it out
#   ./selftest.sh stuck     only this: the app is closed while a print is inside a plug-in that never comes back; it must go by
#                           itself after its wait, and the next start must name the plug-in and leave it out
#   ./selftest.sh start     only this: the app opened as a hand opens it. Its window must fill the screen; its start page must come
#                           up by itself, write nothing while it waits, make a project from a template, list it, and open it
#   ./selftest.sh quitprint only this: the app is closed while it prints stems. It must be gone within a few seconds, leave
#                           no half-made file, and end as an app ends by itself
# What runs is a throwaway copy under a name of its own ("Slur DAW self-test"), which opens no kind of file and is taken
# away at the end. So the check can run beside the app while it is in use, is never taken for it, and leaves nothing
# behind that could be opened in its place. (It keeps the app's bundle id on purpose: macOS remembers what an app may
# reach by that id, and a new id would make it ask again, in the middle of work, for whatever a plug-in touches
# — a FabFilter plug-in reading its presets in Documents stopped a run that way.) It cannot see a real project either: with --selftest
# the app keeps its projects and bounces in ~/Library/Caches/Slur DAW self-test (emptied at the start of each run, so
# the last run's can still be looked at). A project put in test/projects is copied in there first, for the checks
# that open one from before (the folder is named for the project: "<name>.sls" or "<name>.slur", project.json inside).
set -e
cd "$(dirname "$0")"
MODE="$1"
B=build.noindex
LOGS="$HOME/Library/Logs/Slur"
LSR=/System/Library/Frameworks/CoreServices.framework/Frameworks/LaunchServices.framework/Support/lsregister
# the check writes a few hundred megabytes while it runs (two copies of the app, its own projects, sound made for it):
# on a disk with little room left it does not begin (a full disk stops everything else on the machine)
FREE_KB="$(df -k "$HOME" | tail -1 | awk '{print $4}')"
if [ "${FREE_KB:-0}" -lt 3145728 ]; then echo "less than 3 GB free on the disk ($((FREE_KB / 1024)) MB): the check is not run"; exit 1; fi
[ "$SLUR_SKIP_BUILD" = "1" ] || ./build.sh --only > /dev/null
rm -rf "$B/selftest"
# the copies are signed by the certificate the app itself is signed with (build.sh), when this Mac has one: the Mac keeps
# what an app may reach (the microphone, Documents, Downloads) by its id and by who signed it, and a copy with the app's id
# signed by nobody was another app to it — each check asked again, as "Slur Studio", and the app's own answers were
# forgotten, so the app asked again on its next start (his ask, 2026-10-19: "매번 열때마다 … allow")
SIGN="${SLUR_SIGN_ID:-$(security find-identity -p codesigning 2> /dev/null | sed -n 's/.*"\(Slur Studio[^"]*\)".*/\1/p' | head -1)}"
copy () {                                                   # a copy of the build under the check's own name and identity
  mkdir -p "$B/selftest/$1"
  local T="$B/selftest/$1/Slur DAW self-test.app"
  ditto "$B/SlurDaw_artefacts/Release/Slur Studio.app" "$T"
  /usr/libexec/PlistBuddy -c "Delete :CFBundleDocumentTypes" "$T/Contents/Info.plist" 2> /dev/null || true
  /usr/libexec/PlistBuddy -c "Delete :UTExportedTypeDeclarations" "$T/Contents/Info.plist" 2> /dev/null || true
  { [ -n "$SIGN" ] && codesign --force --deep --sign "$SIGN" "$T" > /dev/null 2>&1; } || codesign --force --deep --sign - "$T" > /dev/null 2>&1
  echo "$PWD/$T"
}
A="$(copy a)"
rm -f "$LOGS/selftest.json" "$LOGS/selftest-second.json" "$LOGS"/selftest-twice-*.json "$LOGS"/selftest-stuck-*.json "$LOGS"/selftest-*.png
ROOT="$HOME/Library/Caches/Slur DAW self-test"
rm -rf "$ROOT" && mkdir -p "$ROOT/Projects"
# two projects as they come back from another Mac (ui/missing.js, the movedProject step): one whose folder was renamed on the
# way ("Moved Song 2", holding Moved Song.sls beside its Audio Files), and one whose sounds were not copied with it
python3 - "$ROOT/Projects" <<'PY'
import json, math, os, struct, sys, wave
root = sys.argv[1]
song = lambda name, f: {"v": 3, "name": name, "tempo": 120, "meter": [4, 4], "end": 16, "scenes": [], "tracks": [{"id": 1, "name": "tone", "kind": "audio", "vol": 0, "pan": 0, "sends": [], "autos": {},
  "patch": {"A": {"tape": 0, "space": 0, "delay": 0, "share": 62}, "B": {"tape": 0, "space": 0, "delay": 0, "share": 62}, "x": 0},
  "regs": [{"id": 1, "a": 1, "b": 3, "file": f, "sec": 1, "srcBars": .5, "rate": 1, "loop": False, "off": 0}]}]}
for home, name, f, sound in (("Moved Song 2", "Moved Song", "tone.wav", True), ("Lost Song", "Lost Song", "gone.wav", False)):
    os.makedirs(os.path.join(root, home, name + ".sls"), exist_ok=True); os.makedirs(os.path.join(root, home, "Audio Files"), exist_ok=True)
    json.dump(song(name, f), open(os.path.join(root, home, name + ".sls", "project.json"), "w"))
    if sound:
        w = wave.open(os.path.join(root, home, "Audio Files", f), "wb"); w.setnchannels(1); w.setsampwidth(2); w.setframerate(44100)
        w.writeframes(b"".join(struct.pack("<h", int(12000 * math.sin(2 * math.pi * 220 * i / 44100))) for i in range(44100))); w.close()
PY
# a real project, to see how it opens (SLUR_OPEN=<its .sls folder> ./selftest.sh steps:openReal): laid in as "<name> probe",
# its song copied and each of its sounds a link to where it lies, so nothing of it is written
if [ -n "$SLUR_OPEN" ] && [ -f "$SLUR_OPEN/project.json" ]; then
  P="$ROOT/Projects/$(basename "$SLUR_OPEN" .sls) probe.sls"; mkdir -p "$P/audio"; cp "$SLUR_OPEN/project.json" "$P/"
  SND="$SLUR_OPEN/audio"; [ -d "$SND" ] || SND="$(dirname "$SLUR_OPEN")/Audio Files"
  for f in "$SND"/*; do ln -s "$f" "$P/audio/"; done
fi
if [ -d test/projects ]; then for p in test/projects/*.sls test/projects/*.slur; do [ -d "$p" ] && ditto "$p" "$ROOT/Projects/$(basename "$p")"; done; fi
open -g -n "$A" --args "--selftest${MODE:+=$MODE}" ${SLUR_URL:+"--slur-url=$SLUR_URL"} ${SLUR_OWN_AU:+"--own-au"} ${SLUR_AU_APART:+"--au-apart"}
# while it runs: a second copy, opened from somewhere else, must see the first and go without doing anything
SECOND="{}"; STAYED=0; S="$A"
if [ "$MODE" != "crash" ] && [ "$MODE" != "quitprint" ] && [ "$MODE" != "twice" ] && [ "$MODE" != "stuck" ] && [ "$MODE" != "hung" ]; then
  sleep 4
  S="$(copy b)"
  open -g -n "$S" --args --selftest=second
  for i in $(seq 1 20); do [ -f "$LOGS/selftest-second.json" ] && break; sleep 0.5; done
  sleep 1
  SECOND="$(cat "$LOGS/selftest-second.json" 2> /dev/null || echo '{}')"
  STAYED="$(pgrep -f "selftest/b/Slur DAW self-test.app/Contents/MacOS" | wc -l | tr -d ' ')"
fi
# the first one, to its end; one that has written nothing for two minutes is stuck (a plug-in waiting for an answer
# nobody will give, say) and is put down, so that nothing of it stays on the screen
STUCK=""
await () {
  for i in $(seq 1 "${SLUR_WAIT:-200}"); do
    if grep -q '"finished"\|"fail"' "$LOGS/selftest.json" 2> /dev/null; then break; fi
    if [ "$1" = "may-die" ] && [ "$i" -gt 2 ] && ! pgrep -f "selftest/a/Slur DAW self-test.app/Contents/MacOS" > /dev/null; then break; fi
    if [ -f "$LOGS/selftest.json" ] && [ $(( $(date +%s) - $(stat -f %m "$LOGS/selftest.json") )) -gt "${SLUR_STUCK:-120}" ]; then
      STUCK="$(python3 -c "import json,sys; print(list(json.load(open(sys.argv[1])).keys())[-1])" "$LOGS/selftest.json" 2> /dev/null)"
      pkill -f "selftest/a/Slur DAW self-test.app/Contents/MacOS" || true
      break
    fi
    sleep "${2:-5}"
  done
}
if [ "$MODE" = "quitprint" ]; then
  # the page starts a long print and closes the app: from the moment it says so, how long until the app is gone, and what is left
  for i in $(seq 1 240); do grep -q '"before"' "$LOGS/selftest.json" 2> /dev/null && break; sleep 0.25; done
  T0=$(date +%s)
  for i in $(seq 1 120); do pgrep -f "selftest/a/Slur DAW self-test.app/Contents/MacOS" > /dev/null || break; sleep 0.25; done
  GONE=$(( $(date +%s) - T0 ))
  STILL="$(pgrep -f "selftest/a/Slur DAW self-test.app/Contents/MacOS" | wc -l | tr -d ' ')"
  [ "$STILL" = "0" ] || pkill -f "selftest/a/Slur DAW self-test.app/Contents/MacOS" || true
  FILES="$(find "$ROOT" -path "*quit print*" -type f 2> /dev/null | wc -l | tr -d ' ')"
  MARK="no"; [ -f "$ROOT/State/running.json" ] && MARK="yes"
  NOTE="$(stat -f %z "$ROOT/State/crash.note" 2> /dev/null || echo 0)"
  echo "closed during a print: gone after about ${GONE} s (still running: $STILL), files of the print left: $FILES, mark of a bad end left: $MARK, crash note bytes: $NOTE"
  if [ "$STILL" = "0" ] && [ "$GONE" -le 4 ] && [ "$FILES" = "0" ] && [ "$MARK" = "no" ] && [ "$NOTE" = "0" ]; then echo "closed during a print: as it should be"; else echo "closed during a print: NOT as it should be"; fi
elif [ "$MODE" = "hung" ]; then
  # the page says it is about to; a quarter of a minute later the app must still be there (standing still), and is put down
  for i in $(seq 1 240); do grep -q '"before"' "$LOGS/selftest.json" 2> /dev/null && break; sleep 0.25; done
  sleep 14
  STILL="$(pgrep -f "selftest/a/Slur DAW self-test.app/Contents/MacOS" | wc -l | tr -d ' ')"
  NOTE="$(stat -f %z "$ROOT/State/crash.note" 2> /dev/null || echo 0)"
  pkill -9 -f "selftest/a/Slur DAW self-test.app/Contents/MacOS" || true
  for i in $(seq 1 20); do pgrep -f "selftest/a/Slur DAW self-test.app/Contents/MacOS" > /dev/null || break; sleep 0.25; done
  open -g -n "$A" --args --selftest=hung
  sleep 2
  await
  python3 - "$LOGS" "$STILL" "$NOTE" <<'PY'
import json, sys, os
d, still, note = sys.argv[1], sys.argv[2], int(sys.argv[3])
try: r = json.load(open(os.path.join(d, 'selftest.json'))).get('after') or {}
except Exception: r = {}
ins = (r.get('inserts') or [[None, None, None]])[0]
good = still == '1' and note > 0 and ins[1:] == [True, False] and any('had not come back' in str(l) for l in (r.get('said') or [])) and 'not closed' in str(r.get('title'))
print('a plug-in that never comes back on the device: the app was still there after 14 s (' + still + '), note bytes', note, '— next start:', r.get('title'), r.get('said'), ins)
print('hung plug-in: as it should be' if good else 'hung plug-in: NOT as it should be')
PY
elif [ "$MODE" = "stuck" ]; then
  # from the moment the page says it is closing the app: how long until the app is gone by itself, and what the next start says
  for i in $(seq 1 240); do grep -q '"before"' "$LOGS/selftest.json" 2> /dev/null && break; sleep 0.25; done
  T0=$(date +%s)
  for i in $(seq 1 180); do pgrep -f "selftest/a/Slur DAW self-test.app/Contents/MacOS" > /dev/null || break; sleep 0.25; done
  GONE=$(( $(date +%s) - T0 ))
  STILL="$(pgrep -f "selftest/a/Slur DAW self-test.app/Contents/MacOS" | wc -l | tr -d ' ')"
  [ "$STILL" = "0" ] || pkill -9 -f "selftest/a/Slur DAW self-test.app/Contents/MacOS" || true
  NOTE="$(stat -f %z "$ROOT/State/crash.note" 2> /dev/null || echo 0)"
  cp "$LOGS/selftest.json" "$LOGS/selftest-stuck-1.json" 2> /dev/null || true
  open -g -n "$A" --args --selftest=stuck
  sleep 2
  await
  python3 - "$LOGS" "$GONE" "$STILL" "$NOTE" <<'PY'
import json, sys, os
d, gone, still, note = sys.argv[1], int(sys.argv[2]), sys.argv[3], int(sys.argv[4])
try: r = json.load(open(os.path.join(d, 'selftest.json'))).get('after') or {}
except Exception: r = {}
ins = (r.get('inserts') or [[None, None, None]])[0]
good = still == '0' and 15 <= gone <= 30 and note > 0 and ins[1:] == [True, False] and any('left out' in str(l) for l in (r.get('said') or [])) and 'print did not come back' in str(r.get('title'))
print('closed with a print stuck in a plug-in: gone by itself after about', gone, 's (still running:', still + '), note bytes', note, '— next start:', r.get('title'), r.get('said'), ins)
print('stuck print: as it should be' if good else 'stuck print: NOT as it should be')
PY
elif [ "$MODE" = "twice" ]; then
  # each of the first two runs says what it found and stays; it is put down from outside (nothing is caught, nothing named)
  for n in 1 2; do
    for i in $(seq 1 240); do grep -q "\"run$n\"" "$LOGS/selftest.json" 2> /dev/null && break; sleep 0.25; done
    sleep 1
    pkill -9 -f "selftest/a/Slur DAW self-test.app/Contents/MacOS" || true
    for i in $(seq 1 20); do pgrep -f "selftest/a/Slur DAW self-test.app/Contents/MacOS" > /dev/null || break; sleep 0.25; done
    cp "$LOGS/selftest.json" "$LOGS/selftest-twice-$n.json" 2> /dev/null || true
    open -g -n "$A" --args --selftest=twice
    sleep 2
  done
  await
  python3 - "$LOGS" <<'PY'
import json, sys, os
d = sys.argv[1]
def rd(f):
    try: return json.load(open(os.path.join(d, f)))
    except Exception: return {}
r1, r2, r3 = rd('selftest-twice-1.json').get('run1') or {}, rd('selftest-twice-2.json').get('run2') or {}, rd('selftest.json').get('run3') or {}
ins = lambda r: (r.get('inserts') or [[None, None, None]])[0]
good = ins(r1)[1:] == [False, True] and r2.get('ends') == 1 and ins(r2)[1:] == [False, True] and r3.get('ends') == 2 and ins(r3)[1:] == [True, False] and any('without its plug-ins' in str(l) for l in (r3.get('said') or [])) and ((r3.get('allBack') or [[None, None, None]])[0][1:] == [False, True])
print('two bad ends with nothing to name: first run', ins(r1), '— second (one such end)', ins(r2), '— third (two)', ins(r3), 'said', r3.get('said'), '— all brought back', r3.get('allBack'))
print('two bad ends: as it should be' if good else 'two bad ends: NOT as it should be')
PY
elif [ "$MODE" = "crash" ]; then
  # the first run is brought down on purpose in the middle of a take; the second is the app starting after that
  await may-die 1
  for i in $(seq 1 20); do pgrep -f "selftest/a/Slur DAW self-test.app/Contents/MacOS" > /dev/null || break; sleep 0.5; done
  cp "$LOGS/selftest.json" "$LOGS/selftest-crash.json" 2> /dev/null || true
  open -g -n "$A" --args --selftest=back
  sleep 2
  await
else
  await
fi
for i in $(seq 1 20); do pgrep -f "selftest/a/Slur DAW self-test.app/Contents/MacOS" > /dev/null || break; sleep 0.5; done
rm -rf "${ROOT:?}/Sound"                                    # the check's cache of decoded sound: made again whenever it is wanted, and not small
case "$MODE" in bench*) rm -rf "${ROOT:?}/Projects"; mkdir -p "$ROOT/Projects";; esac      # the measure's sessions (three hundred megabytes of long files) are only measured, never looked at afterwards
LEFT="$(pgrep -f "Slur DAW self-test.app/Contents/MacOS" | wc -l | tr -d ' ')"
"$LSR" -u "$A" > /dev/null 2>&1 || true
"$LSR" -u "$S" > /dev/null 2>&1 || true
if [ "$LEFT" = "0" ]; then rm -rf "$B/selftest"; fi
if [ "$MODE" = "start" ]; then
  python3 - "$LOGS" <<'PY'
import json, os, sys
try: r = json.load(open(os.path.join(sys.argv[1], 'selftest.json')))
except Exception: r = {}
s, page = r.get('start') or {}, r.get('page') or {}
up, made, again, opened = s.get('up') or {}, s.get('made') or {}, s.get('again') or {}, s.get('opened') or {}
listed = again.get('listed') or []
given = up.get('written') or []                             # the projects the check was handed (test/projects): the page lists them, and makes none while it waits
fill = up.get('fill') or {}
good = (bool(fill.get('window')) and fill.get('window') == fill.get('screen') and up.get('on') is True and up.get('held') == 1 and up.get('list') == len(given) and 'untitled' not in given and up.get('free') is True and up.get('cmdHidden') is True and up.get('played') is False and len(up.get('templates') or []) == 5
        and made.get('on') is False and made.get('held') == 0 and made.get('name') == 'untitled' and made.get('tempo') == 96 and len(made.get('tracks') or []) == 8 and made.get('sends') == ['lead vox', 'backing vox'] and (made.get('plate') or 0) > 0 and sorted(made.get('written') or []) == sorted(given + ['untitled']) and made.get('undo') == 0
        and again.get('on') is True and len(listed) == len(given) + 1 and listed[0].get('name') == 'untitled' and listed[0].get('tracks') == 8 and listed[0].get('tempo') == 96 and all((p.get('tracks') or 0) > 0 and (p.get('bytes') or 0) > 0 for p in listed)
        and opened.get('on') is False and opened.get('held') == 0 and opened.get('name') == 'untitled' and opened.get('tracks') == 8 and opened.get('tempo') == 96 and not page.get('errors'))
print('the start page: up', up, '— made', made, '— again', again, '— opened', opened, '— page', page)
print('the start page: as it should be' if good else 'the start page: NOT as it should be')
PY
fi
if [ -n "$STUCK" ]; then echo "STUCK: nothing written for two minutes after step '$STUCK'; the check was put down"; fi
echo "second copy: $SECOND, still open afterwards: $STAYED"
echo "check copies still running: $LEFT"
echo "result: $LOGS/selftest.json  (what it made: $ROOT)"
