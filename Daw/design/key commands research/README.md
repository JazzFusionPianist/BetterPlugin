# Key commands of other DAWs (2026-10-18)

For settings > key commands' "keys like" (design/themes draft 1, sheet 8). `menu-commands.json` is every command of
Slur Studio's menu bar with its key as of this day; each of the four files has one row for each of them, in the same
order: the DAW's own name for it, its default key in Slur's notation (modifiers ⌃⌥⇧⌘ then the key's code), a note, a
confidence and a source; `taken` is every key the DAW uses by default (so that what only Slur Studio has can stay off
them).

- logic.json: Logic Pro 11.2.2, its U.S. set read from the app itself, checked against Apple's 11.2 pages.
- ableton.json: Ableton Live 12.4, from Ableton's manual and help articles.
- cubase.json: Cubase Pro 14.0.30, from Steinberg's Default Key Commands pages (15.0.30 compared).
- protools.json: Pro Tools 2025.12, from Avid's Shortcuts Guide 2026.4 and the app's own help.

Reading a person's own set (settings > key commands, "from my own set…", 2026-10-18):

- logic-decode.mjs: Logic's set in use (~/Library/Preferences/com.apple.logic10.plist, KeyCommands) and .logikcs files;
  logic-ids.json ties each command of Slur Studio to Logic's command numbers.
- cubase-decode.mjs: Key Commands.xml (~/Library/Preferences/Cubase NN/, and Presets/KeyCommands); cubase-ids.json.
- protools-decode.mjs: PTCustomHotkeys.txt (~/Library/Preferences/Avid/Pro Tools/) and .ptpreset files, which hold only
  what differs from Pro Tools' own set (its defaults are in protools-ids.json).
- Ableton Live's keys cannot be changed (Live 12.4): there is no set of one's own to read.

build.mjs writes ui/keysets.js (the four DAWs' defaults); build-import.mjs writes ui/keyimport.js (the readers and the
ties, for the settings window).
