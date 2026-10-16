#!/bin/bash
# Makes vendor/lame/lame: the mp3 encoder the app carries with it (see vendor/lame/README).
#   ./lame.sh        fetch LAME's source through Homebrew (its formula names the tarball and its checksum), build it for
#                    Apple silicon and Intel in one file, macOS 11 and later, without the decoder, and lay it in vendor/lame
# Nothing is installed on the Mac: the source is unpacked and built in a folder of its own that is taken away again.
set -e
cd "$(dirname "$0")"
command -v brew > /dev/null || { echo "Homebrew is needed to fetch LAME's source (https://brew.sh)"; exit 1; }
HOMEBREW_NO_AUTO_UPDATE=1 brew fetch --build-from-source lame > /dev/null
TAR="$(brew --cache --build-from-source lame)"
W="$(mktemp -d)"
trap 'rm -rf "$W"' EXIT
tar xzf "$TAR" -C "$W"
SRC="$(ls -d "$W"/lame-*)"
# the configure script asks for pkg-config only to look for a decoder library, which is left out: this stands in for it
printf '#!/bin/sh\ncase "$1" in --atleast-pkgconfig-version) exit 0;; --version) echo 0.29; exit 0;; esac\nexit 1\n' > "$W/no-pkg-config"; chmod +x "$W/no-pkg-config"
FLAGS="-arch arm64 -arch x86_64 -mmacosx-version-min=11.0"
( cd "$SRC" && PKG_CONFIG="$W/no-pkg-config" CFLAGS="-O2 $FLAGS -include locale.h" LDFLAGS="$FLAGS" ./configure --disable-shared --enable-static --disable-decoder --disable-dependency-tracking > "$W/configure.log" 2>&1 && make -j8 > "$W/make.log" 2>&1 ) || { tail -20 "$W/make.log" 2> /dev/null || tail -20 "$W/configure.log"; exit 1; }
mkdir -p vendor/lame
cp "$SRC/frontend/lame" vendor/lame/lame && strip -x vendor/lame/lame && codesign --force --sign - vendor/lame/lame
cp "$SRC/COPYING" vendor/lame/COPYING
file vendor/lame/lame | head -1
vendor/lame/lame --version | head -1
