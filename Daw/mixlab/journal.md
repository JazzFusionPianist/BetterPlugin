# Rough mix research journal

One entry per round. Each round:
1. Find one new idea (papers, open-source code, or the list in research-1.md §6).
2. Try it as a change to ui/roughplan.js.
3. Score it with `node mixlab/bench-roughplan.mjs` (mean role error in dB against his own mixes, leaving out each song in turn; lower is better).
4. Keep the change only if the score drops and `node test/roughplan.mjs` still passes.

Rules that hold every round:
- Patents (patents-1.md): nothing a live claim covers.
- Learning uses only raw multitracks plus his final mix. His project faders are a check, never a target.
- Nothing is committed or pushed without Steven.
- His client names stay out of anything public.

## Round 0 — 2026-10-23 (made by hand, the baseline)

- **Plan v0** (ui/roughplan.js):
  - Each part is set to his middle share of the whole: lead −5.8, bgv −12.1, kit −7.8, kick −10.2, snare −14.4, bass −8.9, other −4.4 dB. Within a part, tracks keep the balance they came with.
  - Pan comes from a role table (drummer's view).
  - The floor: low cut and mono lows.
  - Corrective EQ fixes ringing, mud and box.
  - Picture-specific moves:
    - A: complementary carve.
    - B: broadband kick→bass duck and glue.
    - C: wide image, long tails, no bus.
  - Comp settings come from role presets.
- **Score board (17 songs read well):**

  | Method | Mean role error |
  |---|---|
  | Plan v0 | 3.31 dB |
  | Stems as they came (faders at 0) | 3.73 dB |
  | Every track at one loudness | 4.00 dB |

- **Where the error is:** song-to-song spread in his own balance. The 808 songs carry their bass about 4 dB higher than the band songs.
- **Next ideas, in order:**
  1. Targets by kind of song: 808/hip-hop vs band, number of lead singers, density.
  2. Within a part, equal loudness vs as-came.
  3. Lead target scaled by how many lead tracks there are.
  4. Kit split from overheads vs close mics.
  5. EQ targets per role from his mixes' read-back eq.
