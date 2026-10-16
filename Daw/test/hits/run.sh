#!/bin/bash
# The app's ear for where things begin (Source/Transients.h), by itself, against sounds made with their truth, and against
# the ear it took the place of. Files given are listened to as well. Nothing is left behind.
set -e
cd "$(dirname "$0")"
OUT="$(mktemp -d "${TMPDIR:-/tmp}/slurhits.XXXXXX")"
trap 'rm -rf "$OUT"' EXIT
c++ -std=gnu++17 -O2 -Wall -Wextra -Wno-unused-parameter hits.cpp -o "$OUT/hits"
"$OUT/hits" "$@"
