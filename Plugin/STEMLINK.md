# Orb StemLink

Orb StemLink is a transparent satellite plug-in for track discovery. Insert it
on every track that should appear in the master Orb's **Add Stems** list.

## How it works

- The DAW supplies the track name and colour through the standard AU/VST3 host
  track-properties callback.
- StemLink publishes a lightweight heartbeat containing that metadata. It is a
  transparent pass-through until the user starts an export from Orb.
- A Share request arms all selected StemLink instances. One DAW playback pass
  records every selected track concurrently to synchronized 24-bit WAV files.
  Stopping playback closes the files and Orb uploads them to the current room.
- The master Orb reads only live StemLink instances belonging to the same DAW
  process tree. Removing an instance removes that track from Orb automatically.
- DAW control-surface/PTSL adapters remain preferred when available; StemLink is
  the portable fallback for hosts without a track-list API.

## Export workflow

1. Insert Orb StemLink on each track that should be available to the master Orb.
2. Open **Stems → Add Stems**, select tracks, and choose Entire Session or Edit
   Selection.
3. Click Share, place the DAW playhead at the desired start, and press Play.
4. Stop at the desired end. Orb finalizes and uploads all selected tracks.

DAW-native adapters may provide a true offline bounce. StemLink is the portable
automatic fallback because the standard AU/VST3 plug-in API does not allow a
plug-in to command the host transport or invoke its export dialog. AAX will be
added after Avid/PACE code-signing approval; the signed distribution currently
contains AU and VST3.

If a host does not provide a track name, Orb displays `Unnamed Track`. Renaming
the track normally causes a fresh host callback and updates Orb immediately.
