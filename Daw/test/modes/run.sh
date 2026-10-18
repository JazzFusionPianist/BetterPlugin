#!/bin/bash
# How a sound is stretched other than by the phase vocoder (Source/Modes.h: voice, cut, beat), by itself: sounds made here,
# stretched, and measured. Nothing is left behind.
set -e
cd "$(dirname "$0")"
OUT="$(mktemp -d "${TMPDIR:-/tmp}/slurmodes.XXXXXX")"
trap 'rm -rf "$OUT"' EXIT
c++ -std=gnu++17 -O2 -Wall -Wextra -Wno-unused-parameter modes.cpp -o "$OUT/modes"
"$OUT/modes" "$@"
