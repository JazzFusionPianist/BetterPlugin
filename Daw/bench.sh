#!/bin/bash
# The measure: sessions of growing size put through the real page and the real engine (ui/bench.js), on a throwaway copy
# of the app with the speakers silent, like the check. What it finds is kept in bench/results and shown as a table.
#   ./bench.sh            build, measure, keep, show
#   ./bench.sh device     the same, and then each session played through the device itself at blocks of 64 and of 32 samples.
#                         A device's block is the device's own, for every program playing through it: run this only when
#                         nothing else that makes sound is open (it is put back afterwards)
#   ./bench.sh show [file]    show a kept result again (the last one when no file is named)
set -e
cd "$(dirname "$0")"
mkdir -p bench/results
if [ "$1" != "show" ]; then
  if [ "$1" = "device" ] && pgrep -qf "Logic Pro.app/Contents/MacOS|Pro Tools.app/Contents/MacOS|GarageBand.app/Contents/MacOS|MainStage.app/Contents/MacOS|/Slur DAW.app/Contents/MacOS|/Slur Studio.app/Contents/MacOS"; then echo "another program that makes sound is open: the device's block is left alone (close it and run this again)"; exit 1; fi
  SLUR_STUCK=300 ./selftest.sh "$([ "$1" = "device" ] && echo benchdevice || echo bench)"
  OUT="bench/results/$(date +%Y-%m-%d\ %H%M)${BENCH_NAME:+ $BENCH_NAME}.json"
  cp "$HOME/Library/Logs/Slur/selftest.json" "$OUT"
else
  OUT="${2:-$(ls -t bench/results/*.json | head -1)}"
fi
python3 bench/show.py "$OUT"
