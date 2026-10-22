#!/bin/bash
# Makes the room's ear for what a sound is (ui/yamnet: tidy.js hears a track with it, to know what it is) — not kept in
# git, so a fresh tree makes it here once: YAMNet as Google published it for the web (Apache 2.0, about 14 MB, from
# kaggle.com, and its classes from github.com/tensorflow/models), cut down to int8 (tools/yamnet-make.mjs, some 4 MB), and
# the fetched copy taken away again. A tree without ui/yamnet tidies by names alone.
set -e
cd "$(dirname "$0")"
SRC=build.noindex/yamnet-src
mkdir -p "$SRC/tfjs"
[ -s "$SRC/class_map.csv" ] || curl -sfL -o "$SRC/class_map.csv" https://raw.githubusercontent.com/tensorflow/models/master/research/audioset/yamnet/yamnet_class_map.csv
if [ ! -s "$SRC/tfjs/model.json" ]; then
  curl -sfL -o "$SRC/yamnet-tfjs.tar.gz" "https://www.kaggle.com/models/google/yamnet/tfJs/tfjs/1/download"
  echo "604467f7ce0900a27a05f274c7e7a46effbb936788a7cee84648238de5c97c82  $SRC/yamnet-tfjs.tar.gz" | shasum -a 256 -c --quiet      # (the weights as they were tried, 2026-10-22)
  tar -xzf "$SRC/yamnet-tfjs.tar.gz" -C "$SRC/tfjs"
fi
node tools/yamnet-make.mjs
rm -rf "$SRC"
echo "made: ui/yamnet ($(du -sh ui/yamnet | cut -f1))"
