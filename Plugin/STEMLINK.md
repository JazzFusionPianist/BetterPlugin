# Orb StemLink

Orb StemLink is a transparent satellite plug-in for track discovery. Insert it
on every track that should appear in the master Orb's **Add Stems** list.

## How it works

- The DAW supplies the track name and colour through the standard AU/VST3 host
  track-properties callback.
- StemLink publishes a lightweight heartbeat containing that metadata. It is a
  transparent pass-through until the user starts an export from Orb.
- An Entire Session Share request arms all selected StemLink instances. One
  ordinary DAW master offline bounce processes the full graph; every armed
  StemLink writes its own input concurrently to synchronized 24-bit WAV files.
  Offline capture applies back-pressure so a fast host cannot outrun the WAV
  writers and truncate a stem.
- Edit Selection may still use a single realtime pass when no native selection
  renderer is available.
- The master Orb reads only live StemLink instances belonging to the same DAW
  process tree. Removing an instance removes that track from Orb automatically.
- DAW control-surface/PTSL adapters remain preferred when available; StemLink is
  the portable fallback for hosts without a track-list API.

## Export workflow

1. Insert Orb StemLink on each track that should be available to the master Orb.
2. Open **Stems → Add Stems**, select tracks, and choose Entire Session.
3. Click Share. An Orb host adapter starts one master offline bounce when the
   DAW exposes that command. All selected StemLinks finalize and Orb uploads
   them without creating tracks or regions in the project.

If the DAW has no automatic Orb command adapter yet, all StemLinks remain armed
while the user starts one normal offline master export in the DAW. Entire
Session never falls back to realtime playback capture.

DAW-native adapters may still provide a direct track bounce. StemLink is the
portable graph-capture path; the small host adapter only has to start one master
bounce rather than implement a complete per-track exporter. AAX will be
added after Avid/PACE code-signing approval; the signed distribution currently
contains AU and VST3.

If a host does not provide a track name, Orb displays `Unnamed Track`. Renaming
the track normally causes a fresh host callback and updates Orb immediately.
