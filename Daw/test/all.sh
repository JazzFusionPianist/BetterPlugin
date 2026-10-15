#!/bin/bash
# Everything that can be checked without the app: edits at random against the page's code (Node, test/fuzz.cjs), then the
# page itself in a headless browser with a real pointer and keys (test/*.mjs). About five minutes.
#   ./test/all.sh              12 seeds of 1500 acts, then every browser check
#   ./test/all.sh 40 2500      more of the random edits
# The app's own check is ./selftest.sh (the real engine), the measure ./bench.sh.
cd "$(dirname "$0")/.."
BAD=0
node test/fuzz.cjs "${1:-12}" "${2:-1500}" || BAD=1
./test/inst/run.sh | tail -1 | grep -q " 0 failed" && echo "instruments: all passed" || { echo "instruments: SOMETHING FAILED (./test/inst/run.sh)"; BAD=1; }      # the room's own instruments, played by themselves and measured
./test/host/run.sh | tail -1 | grep -q " 0 wrong" && echo "audio-unit host: all passed" || { echo "audio-unit host: SOMETHING FAILED (./test/host/run.sh)"; BAD=1; }      # the app's own way of opening an audio unit, alone (not yet what the app uses)
run () {                                                    # one browser check: its last line says how it went
  local OUT; OUT="$(node "test/$1.mjs" ${2:+"$2"} ${3:+"$3"} 2>&1 | tail -1)"
  case "$OUT" in *"all passed"*) echo "$1${2:+ $2 x $3}: all passed";; *) echo "$1${2:+ $2 x $3}: $OUT"; BAD=1;; esac
}
for T in edit edit2 basics group time alt deep meter mixed mixed2 small hands start say chords join inst keys stretch doors folders grid roll autonudge fadekeys study caps prompt rowh busrow hint wavez picker wall autoseg away nest preset; do run "$T"; done
run hands 1100 640
run picker 1100 640
run wall 1100 640
run start 1100 640
run keys 1100 640
run grid 1100 640
run roll 1100 640
[ "$BAD" = "0" ] && echo "everything passed" || echo "SOMETHING FAILED"
exit $BAD
