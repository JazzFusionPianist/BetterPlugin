#!/bin/bash
# The DAW's own instruments (Source/Instruments.h) played by themselves and measured. Nothing is left behind: the
# program is built in a folder of its own that is taken away again.
set -e
cd "$(dirname "$0")"
OUT="$(mktemp -d "${TMPDIR:-/tmp}/slurinst.XXXXXX")"
trap 'rm -rf "$OUT"' EXIT
c++ -std=gnu++17 -O2 -Wall -Wextra -Wno-unused-parameter play.cpp -o "$OUT/play"
"$OUT/play"
