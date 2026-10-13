#!/bin/bash
# The app's own audio-unit hosting, checked alone (no app, no JUCE): builds two files and runs them. A few seconds.
set -e
cd "$(dirname "$0")"
T=$(mktemp -d); trap 'rm -rf "$T"' EXIT
clang++ -std=c++17 -O1 -fobjc-arc -Wall -Wextra -Wno-unused-parameter au_test.mm ../../Source/host/Au.mm ../../Source/host/Window.mm \
  -framework AudioToolbox -framework CoreAudioKit -framework Cocoa -framework CoreFoundation -o "$T/au_test"
"$T/au_test"
