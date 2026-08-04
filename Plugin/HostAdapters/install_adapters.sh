#!/bin/zsh
set -euo pipefail

SOURCE_DIR="${0:A:h}"
ORB_SUPPORT="$HOME/Library/Application Support/Orb"
ADAPTER_DIR="$ORB_SUPPORT/Adapters"
CONTROL_DIR="$ORB_SUPPORT/HostControl"
PT_DIR="$ADAPTER_DIR/ProTools"
REAPER_DIR="$HOME/Library/Application Support/REAPER/Scripts/Orb"
REAPER_STARTUP="$HOME/Library/Application Support/REAPER/Scripts/__startup.lua"
LAUNCH_AGENTS="$HOME/Library/LaunchAgents"
PLIST="$LAUNCH_AGENTS/com.orb.protools-adapter.plist"

mkdir -p "$PT_DIR" "$CONTROL_DIR/Exports" "$REAPER_DIR" "$LAUNCH_AGENTS"
cp "$SOURCE_DIR/ProTools/orb_protools_adapter.py" "$PT_DIR/orb_protools_adapter.py"
cp "$SOURCE_DIR/REAPER/Orb Control.lua" "$REAPER_DIR/Orb Control.lua"

touch "$REAPER_STARTUP"
if ! grep -q "ORB_AUTOSTART_ADAPTER" "$REAPER_STARTUP"; then
  cat >> "$REAPER_STARTUP" <<'LUA'

-- ORB_AUTOSTART_ADAPTER
local orb_adapter = os.getenv("HOME") .. "/Library/Application Support/REAPER/Scripts/Orb/Orb Control.lua"
local orb_file = io.open(orb_adapter, "rb")
if orb_file then orb_file:close(); dofile(orb_adapter) end
LUA
fi

python3 -m venv "$PT_DIR/venv"
"$PT_DIR/venv/bin/python" -m pip install --disable-pip-version-check --quiet "py-ptsl==601.1.0"

TMP_PLIST="$(mktemp)"
sed \
  -e "s|__PYTHON__|$PT_DIR/venv/bin/python|g" \
  -e "s|__SCRIPT__|$PT_DIR/orb_protools_adapter.py|g" \
  -e "s|__LOG__|$PT_DIR/adapter.log|g" \
  "$SOURCE_DIR/ProTools/com.orb.protools-adapter.plist.template" > "$TMP_PLIST"
cp "$TMP_PLIST" "$PLIST"
rm -f "$TMP_PLIST"
launchctl bootout "gui/$(id -u)/com.orb.protools-adapter" >/dev/null 2>&1 || true
launchctl bootstrap "gui/$(id -u)" "$PLIST"

echo "Orb Pro Tools adapter installed and running."
echo "Orb REAPER script installed at: $REAPER_DIR/Orb Control.lua"
