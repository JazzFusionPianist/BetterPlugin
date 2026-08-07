# Orb StemLink

Orb StemLink is a transparent satellite plug-in for track discovery. Insert it
on every track that should appear in the master Orb's **Add Stems** list.

## How it works

- The DAW supplies the track name and colour through the standard AU/VST3 host
  track-properties callback.
- StemLink publishes a lightweight heartbeat containing that metadata. It does
  not capture, modify, or copy audio in `processBlock`.
- The master Orb reads only live StemLink instances belonging to the same DAW
  process tree. Removing an instance removes that track from Orb automatically.
- DAW control-surface/PTSL adapters remain preferred when available; StemLink is
  the portable fallback for hosts without a track-list API.

## Current scope

StemLink provides track discovery and selection. Automatic export still depends
on a DAW adapter, so StemLink-only tracks show **Automatic export unavailable**
until the audio-render path is implemented. AAX will be added after Avid/PACE
code-signing approval; the current signed distribution contains AU and VST3.

If a host does not provide a track name, Orb displays `Unnamed Track`. Renaming
the track normally causes a fresh host callback and updates Orb immediately.
