# Research survey: a rule-based "10-second rough mix" in three spatial pictures

Prepared 2026-10-23 for a native macOS DAW (C++ engine, JavaScript UI). Scope: automatic multitrack mixing that runs offline and deterministically. Three output pictures are covered: **A "up front"**, **B "one room"** and **C "wide"**.

---

## 0. How to read this file

**Verification marks.** Every claim carries a reference tag `[Rn]`; Section 7 gives the full citations with title, authors, year, venue and URL. Each claim also carries one of these marks:

| Mark | Meaning |
|---|---|
| **[read]** | I read the full text, or the relevant full section, for this survey and took the number from it. |
| **[abstract]** | Only an abstract, a publisher listing, repository metadata or a search-result summary was available. The statement matches that source, but I did not see the paper body. |
| **UNVERIFIED** | I could not confirm it. Treat it as a hypothesis. |
| **[proposal]** | My own derivation or design suggestion, built from the cited evidence. It is not a literature claim. |

**Units.** "Relative loudness" means the BS.1770 loudness of a source as it sits in the mix, minus the loudness of the whole mix, in LU. "RRL" means relative reverb loudness: the loudness of the wet signal minus that of the dry signal, in LU.

---

## 1. Summary

### 1.1 Findings that should shape the design

1. **A role-aware rule system can match human mixes, and a role-blind one cannot.**
   - De Man's knowledge-engineered system (KEAMS) set static level, pan, EQ and compression from instrument tags plus a few measured features. In a listening test it was **not significantly different from two professional engineers**. A real-time cross-adaptive system that ignored track roles ("VST") was rated lower; listeners complained about panned snares and vocals [R2 ch.2, read].
   - In 2026, a training-free rule-based intra-group balancer (ELL) scored 61.1 out of 100. MEGAMI scored 55.5 (not significantly different) and Diff-MST scored 21.4 (significantly worse) [R12, read].
   - **Conclusion: a deterministic, role-labelled mixer is a defensible core. It is not a stopgap until ML arrives.**

2. **Balance is the most important part of the problem. Vocals are the single most important element.**
   - Skilled listeners wrote 4,227 comment statements. Of these, 35% concerned level/balance, 29% space (58% of which was reverb and 16% panning), 25% spectrum and 11% dynamics [R2 §4.3, read].
   - 31% of all statements were about vocals [R2 §4.3, read].
   - Differentiable "reverse engineering" of real mixes points the same way. Gain/pan alone take the match loss from 19.7 to 0.689, then EQ (0.557), reverb (0.481) and compression (0.423) [R41, read]. The JAES extension finds the same order [R42, read].
   - **Conclusion: spend nightly-loop effort in that order: balance, then pan/width, then EQ, then reverb, then compression.**

3. **Concrete level targets exist and contradict the old "everything equally loud" assumption.**
   - **Lead vocal ≈ −3 LU relative to the mix** (−2.7 ± 1.6 LU [R3, read]; ≈ −3 LU [R7, read]; Pestana: the vocal is about as loud as everything else combined, cited in [R2, read]).
   - **Bass ≈ −8 to −10 LU** [R2 Table 6.1, read; R7, read].
   - **Whole drum kit, median −6.5 to −8.5 LU**, depending on song or genre [R2 Table 6.1, read].
   - The equal-loudness assumption "directly contradict[ed]" by the data [R2 §4.1.2, read].

4. **Err on the side of too little compression and too little reverb. Both have numeric bounds.**
   - Preference correlates positively with dynamic range (LDR ρ = .24, p = .016). It correlates negatively with side/mid ratio (ρ = −.32), but overly mono mixes were also disliked [R2 Table 4.6, read].
   - With automatic compression, only the "light" setting (cut loudness range by about 3 LU) beat the uncompressed mix; "heavy" was rated bad [R26, read].
   - **Total reverb loudness ≈ −14 LU relative to the dry mix is the sweet spot. Every mix at −9 LU or above was judged too reverberant** [R4, read; R2 Table 6.1, read].
   - The DMC neural mixer's main failure was too much reverb on vocals [R36, read].

5. **Licences: almost all learned mixers are non-commercial.**
   - Code that can ship in a closed product: automix-toolkit, dasp-pytorch, ST-ITO, GRAFX and auraloss (Apache-2.0); FxNorm-automix code, pyloudnorm, libebur128, pymixconsole and fadtk (MIT).
   - Code that cannot (ideas only):
     - Diff-MST, MEGAMI and Fx-Encoder++ (CC BY-NC / BY-NC-SA).
     - DeepAFx and DeepAFx-ST (Adobe Research, non-commercial).
     - Matchering, pedalboard and DawDreamer (GPL-3.0); Essentia (AGPL-3.0).
   - Even MIT/Apache weights are often trained on MUSDB18 or MedleyDB, whose audio is **non-commercial** [R56, read].
   - **Two patents overlap the planned features** (Section 2.8): LANDR/QMUL US9654869B2 on autonomous fader/pan/EQ/compression, and iZotope US10396744B2 on masking remediation.

### 1.2 What I could not verify

- The regression coefficients of Ma et al. 2015 (intelligent multitrack compression) [R29].
- The exact formulas of Giannoulis et al. 2013 (compressor parameter automation) [R27]. Only "attack and release inversely proportional to spectral flux, user sets only the threshold" was confirmed, via [R28].
- The content of Pestana & Reiss 2014 "best practices" [R9]. Its findings appear here only as cited by [R2] and [R4].
- Hafezi & Reiss 2015 masking EQ details [R22]. Mansbridge 2012 results [R18, R19]. Perez-Gonzalez 2010 panner details [R17] (paywall or bot-blocked).
- Per-role reverb send levels. No peer-reviewed numbers were found.
- Drummer's versus audience's perspective. No peer-reviewed study was found.
- Run times of any learned model on Apple Silicon. None of the papers report Mac numbers.

---

## 2. Mixing decisions: evidence and implementable rules

### 2.0 Pipeline order and analysis stretch

- **Processor order.** KEAMS used high-pass filter, then compressor, then EQ, then fader, then pan. The drums were mixed to a drum bus, which could have its own EQ and compression, and then the mix bus was processed [R2 §2.1.3, read].
  - Reason for the HPF before the compressor: it stops low-frequency rumble from triggering the compressor [R2 §2.1.3, read].
  - Faders and pans come after the inserts, as on a console [R2 §2.1.3, read].
- **Analysis stretch.** All parameters in KEAMS were static over the fragment [R2 §2.1, read]. De Man et al. analysed the "second verse and chorus", where all sources play [R3, read]. Diff-MST evaluated a 10-second window from mid-verse to mid-chorus [R39, read].
  - [proposal] Pick the densest 20–30 s, where most roles are active, as the analysis stretch. Keep a second stretch for checking.
- **Activity gating.** Measure each track only while it is active. Use a hysteresis gate: off below −30 LUFS, on above −25 LUFS [R3, read; R16, read]. KEAMS stored per-track RMS, peak, crest factor and BS.1770 loudness, measured both overall and "when active" [R2 §2.1.2, read].

### 2.1 Gain staging and balance

#### Measurement

- **BS.1770 with a multitrack modification.** De Man et al. used the best-performing modification from Pestana et al. 2013: a 280 ms time constant and a +10 dB pre-filter gain [R3, read].
- **Simple energy is enough.** iZotope compared three level-setting models: energy-based, psychoacoustic, and psychoacoustic with masking. Listeners **preferred the mixes from the simple energy-based model** [R8, abstract].
- **Narrowband correction.** Shi et al. 2025 correct LUFS for narrowband sources such as bass and kick. They use pitch (PYIN/PESTO), spectral centroid and bandwidth, and apply dynamic band-pass filtering before measuring loudness. The system handles projects of more than 100 tracks [R11, abstract].
- **Alternative used in the literature.** Inverse ISO 226 equal-loudness filter at 75 phon, then RMS over 23 ms windows [R14, read].

#### Targets by role (relative to the whole-mix loudness)

| Role | Target | Evidence |
|---|---|---|
| Lead vocal | **−2.7 ± 1.6 LU**; "about −3 LU" | [R3, read]; [R2 Table 6.1, read]; [R7, read] |
| Lead vocal (dissenting study) | below −6 LU | [R8], as cited in [R2, read]; songs undisclosed, larger error |
| Bass | −9.5 LU (mean); median −8 to −9 LU; ≈ −10 LU | [R3 Table 2, read]; [R2 Table 6.1, read]; [R7, read] |
| Drum kit total | median −6.5 to −8.5 LU, song-dependent | [R2 Table 6.1, read] |
| Kick track | −13.2 LU | [R3 Table 2, read] |
| Snare track | −16.8 LU | [R3 Table 2, read] |
| Other drum tracks | −12.7 LU | [R3 Table 2, read] |
| Vocal vs backing track | +0.54 LU (median) | [R7 Table 1, read] |
| Guitar vs rhythm section | −2.38 LU | [R7 Table 1, read] |
| Bass vs drums | −1.12 LU | [R7 Table 1, read] |

Notes on the table:

- The kick and snare values come from individual tracks. Bleed into overheads changes the effective source loudness: snare close mics can sit as low as −35 LU, with the rest of the kit compensating [R2 §4.1.2, read].
- Engineers work in one of two ways. Either the overheads are the main drum signal and close mics add emphasis, or the close mics are the main signal and overheads add air [R2 Table 6.1, read].
- The bass, snare and other-drum levels depend strongly on the engineer (p < .01, < .05, < 5·10⁻⁴) [R3, read].
- **Brightness and level.** In 55 rock multitracks under good monitoring, brighter tracks were mixed softer and darker tracks louder; track loudness was a linear function of spectral centroid [R15, abstract].
- **Normalisation before optimising.** Ronan et al. set every track to −24 LUFS and the lead vocal to −18 LUFS (+6 LU) before masking optimisation. Each mixed subgroup was again normalised to −24 LUFS, or −18 LUFS for vocal subgroups [R13, read].
- **Dead band.** Scott & Kim correct a drum track only if its loudness ratio to the rest falls outside [0.8, 1.2] for kick and snare, or [0.8, 1.3] for toms and overheads. They err "on the side of more kick and snare" in rock [R14, read].
- **The LANDR/QMUL fader method** [R16, read]:
  - the target is the mean loudness of active tracks;
  - each track's dB control comes from its loudness relative to that mean, with optional extra gain for a lead;
  - everything is smoothed by an EMA with a 3 s time constant;
  - inactive tracks hold their gain.

#### Deterministic solver [proposal]

BS.1770 is a K-weighted mean-square measure, so the energies of uncorrelated sources roughly add. That turns relative-loudness targets into energy shares: `s_i = 10^(r_i/10)`, with Σ s_i ≈ 1.

- The literature means behave this way. Vocal −2.65, bass −9.5, kick −13.15, snare −16.78 and other drums −12.68 LU give shares 0.54 + 0.11 + 0.05 + 0.02 + 0.05 = 0.78. That leaves about 0.22 (≈ −6.5 LU) for everything else.

Algorithm:

1. Measure each track's gated K-weighted energy `E_i` over the stretch.
2. Assign each role a share. Split a role's share across its tracks in proportion to `E_i`, or equally.
3. Set `g_i = sqrt(s_i · E_target / E_i)`.
4. Render the sum, measure BS.1770 of the sum and of each role in context, and correct. Two or three iterations converge because the only nonlinearity is the gating.
5. Treat the drum kit as one role, because of bleed. Split it internally by a kit rule, for example kick and snare emphasis within [R14]'s dead band.

**Per-picture starting values** [proposal; tune them in experiment E1]:

| Picture | Lead vocal | Bass | Drum kit | Rest |
|---|---|---|---|---|
| A "up front", vocal on top | −2.0 LU | −9 LU | −7.5 LU | residual |
| B "one room", blended | −3.5 LU | — | — | — |
| C "wide" | −3.0 LU | — | — | — |

### 2.2 Panning and width

#### What practice and the data say

- **Centre.** Low-frequency sources, the lead vocal and the snare should be centred. This is a textbook rule, confirmed on real mixes [R2 Table 6.1, read; R3, read].
  - The bass was the only source significantly more central than the mix in the lowest band [R3, read].
- **Width rises with frequency.** Mean stereo panning spectrum (SPS) widens from 50 Hz to 400 Hz, then stays roughly flat. It does not change below 50 Hz [R3, read].
  - This is direct evidence for a frequency-dependent width profile: "mono lows" with a soft knee somewhere in 50–400 Hz.
- **Textbook positions** collected by De Man (clock face: 12:00 is centre, 7:00 full left, 17:00 full right) [R2 Table 2.4, read]:
  - kick: centre;
  - snare: where it sits in the overheads (KEAMS panned it by its correlation with the left versus right overhead);
  - toms: 10:00, 13:00 and 14:00;
  - overheads: 70% wide;
  - ride at 15:00; crashes at 9:00 and 14:00;
  - **hi-hat at 14:30–15:30, which is the audience's view (hi-hat on the right)**;
  - bass: centre;
  - guitars: opposite sides if there is more than one;
  - keys: spread if stereo and there are no other harmony instruments;
  - lead vocal: centre or very slightly off-centre;
  - backing vocals: spread.
- **Drum perspective.** I found **no peer-reviewed study** of drummer's versus audience's perspective. Forum polls are split. An iZotope guide says most mixers use the audience's perspective (search-result level, UNVERIFIED).
  - The planned "drummer's view" (hi-hat left, floor tom right) is therefore a style choice.
  - [proposal] Measure the user's own reference mixes instead. Correlate the hi-hat and floor-tom close-mic envelopes with the L and R channels of his mix; see experiment E3.
- **Drum spacing in a rule system.** Scott & Kim used a ±45° pan scale: kick and snare at 0°, toms spaced linearly up to ±25°, overheads alternating at ±35° [R14, read].
- **Pairing by spectral centroid** (LANDR/QMUL) [R16, read]:
  - the pan offset grows with spectral centroid, relative to the maximum centroid across tracks;
  - a new track is paired with the track whose centroid is closest, and the pair goes on opposite sides;
  - tracks may not cross the centre;
  - per band (5 bands), the L/R balance is held within 0.45–0.55 by nudging positions (Q 0.3, step 0.02);
  - lead tracks can bypass panning and stay centred.
- **Centre-heavy position grid.** Pestana & Reiss place J tracks on Chebyshev-root positions: `P_g = sign[cos((2g−1)π/n)] − cos((2g−1)π/n)`, g = 1…n, sorted [R20, read].
  - Positions bunch near the centre, and the extreme edges are never used.
  - Informally this gave better envelopment than equal spacing.
  - Pan law used there and in KEAMS: −3 dB sine/cosine, `gL = cos(π(P+1)/4)`, `gR = sin(π(P+1)/4)`, P ∈ [−1, 1] [R20, read; R2 eq. 2.8–2.9, read].
- **Preference and width.**
  - Side/mid ratio correlates negatively with preference (ρ = −.32, p = .001), but very mono mixes also scored low. The centre must be strong, but the mix must not be overly mono [R2 §4.2.2 and Table 6.1, read].
  - A human J-Rock mix with hard-panned guitars scored high on Excitement; the learned models "are conservative when it comes to panning" [R37, read]. This supports keeping a deliberately wide picture C.
- **Panning beats EQ against masking.** In a two-instrument test of masking tools (mirrored EQ, spectrum sharing, panning), participants preferred **tools that panned both tracks** [R21, abstract].

#### Rules for the three pictures [proposal]

- **Shared rules.**
  - Kick, snare, bass, lead vocal and any track whose main energy is below about 150 Hz stay at the centre.
  - Overheads and room mics keep their recorded image; the drum perspective is set globally.
  - Use the −3 dB sine/cosine law.
- **A "up front".**
  - Use the Chebyshev centre-heavy grid with the outer 20% excluded.
  - Pair harmony tracks by centroid on opposite sides (|P| ≤ 0.6).
  - Backing vocals at ±0.3–0.5.
- **B "one room".** Like A, with a narrower span (|P| ≤ 0.5). Width comes from the shared reverb return.
- **C "wide".**
  - Doubled or paired rhythm parts, such as two guitars or a stereo keys track, go to ±0.9–1.0.
  - Spread the remaining tracks by centroid pairing over the full range.
  - Apply the frequency-dependent width profile on the bus (below).
- **Frequency-dependent width.**
  - Side gain 0 below `f_mono`; ramp to 1 by `f_full`.
  - Defaults: `f_mono` = 100 Hz and `f_full` = 400 Hz, following the SPS knee in [R3].
  - Picture C may use `f_mono` = 80 Hz.
  - Fit both values to his mixes (experiment E3).

### 2.3 EQ: static, corrective and against masking

#### Evidence that limits what EQ should do

- **Engineers agree on corrections, not on generic boosts.**
  - For most spectral features, engineers disagreed on the preferred value for every instrument except the kick [R3, read].
  - The average change per octave band was not significantly different from zero: no band was consistently boosted or cut for an instrument [R3, read].
  - But "engineers largely agree on the necessary treatment for source tracks showing spectral anomalies" [R3, read].
  - **Conclusion: EQ should be corrective, driven by the measured deviation from a role norm, rather than a fixed preset.**
- **What consistent changes there were** [R3, read]:
  - low energy was reduced on every instrument, most of all on the snare;
  - brightness increased on every track except bass and kick;
  - the snare's spectral centroid rose consistently.
- **The KEAMS failure.** Its default guitar EQ, applied to already bright guitars, gave "an overly harsh guitar sound" [R2 §2.3, read].
- **The mix tends towards a target spectrum.**
  - The average mix spectrum of 64 mixes lay within one standard deviation of Pestana et al.'s "after 2000" number-one-hit curve, except in the top band [R3, read; R23, abstract; R2 Table 6.1, read].
  - Long-term spectra of popular music relate to how prominent the percussion is: more percussion means relatively more bass and treble. Genre differences in LTAS are mostly a side effect of this [R24, abstract]. The slope values are UNVERIFIED (paywalled).
  - Implementations fit an IIR to a target curve with Yule-Walker [R16, read; R25, listing].

#### Textbook rules collected by De Man [R2 Table 2.2, read]

| Track | Rules |
|---|---|
| All tracks | Low cut |
| Kick | Cut below 30 Hz; boost 40–100 Hz; **cut 100–400 Hz by 6–12 dB, Q > 4**; cut 300–600 Hz by 2–6 dB, Q > 4; boost 1–4 kHz; shelf cut at 10 kHz |
| Snare | Boost 120–240 Hz; boost around 1 kHz or cut 1–2 kHz (sources differ); boost 5 kHz and 10 kHz |
| Toms | Shelf below 60 Hz; boost 200 Hz; cut 200–400 Hz, Q > 4; boost 6 kHz |
| Overheads | Cut 1 kHz; boost 1–5 kHz by < 3 dB with low Q; shelf boost 8–10 kHz by 3–4 dB |
| Cymbals | Cut below 500 Hz; boost 12 kHz by 3–6 dB |
| Bass | Cut below 50 Hz; boost 400 Hz; boost 1.5–3 kHz; boost 5–7 kHz |
| Acoustic guitar | Cut 100–300 Hz; cut 1–3 kHz; boost 6–10 kHz |
| Electric guitar | Boost 240–500 Hz; cut 1 kHz; boost 1.5–3 kHz; boost 6–10 kHz |
| Keys | Cut 300 Hz; cut 1 kHz; boost 3–6 kHz |
| Lead vocal | **Cut below 80 Hz**; boost 250 Hz; boost 1–6 kHz; boost 10–12 kHz |
| Mix bus | Boost 80 Hz; boost 10 kHz |

How KEAMS turned these into settings:

- ±3 dB where a source gave no gain value.
- Q chosen to span the named region.
- The high-pass filter was 12 dB/octave. The rule used: "high pass filter with cutoff frequency of 100 Hz on every track but the bass guitar and kick drum" [R2 §2.1.3, read].
- Scott & Kim's kick EQ: +2 dB from 1–6 kHz, −2 dB from 400–900 Hz, +2 dB at 100 Hz (Q 4.5). Snare: +3 dB high shelf from 10 kHz [R14, read].

#### Descriptor bands

De Man compiled the frequency ranges that textbooks give for descriptors [R2 Table 2.3, read]:

| Descriptor | Ranges given by different textbooks |
|---|---|
| boomy | 20–100, 40–200, 60–250 Hz |
| boxy | 250–800, 300–600, 300–900 Hz |
| air | mostly 10/12–20 kHz |
| harsh | 2–10 kHz |
| thin | lack of 20–200 / 40–200 Hz |

These support the engine's bands: mud 150–450 Hz, box 450–1100 Hz, presence 1.5–5 kHz and air 10–20 kHz.

#### Masking: metrics and methods

- **Cross-adaptive MPEG masking metric** (Ronan, Ma et al.) [R13, read]:
  - For track n, compute the masking threshold `T_n(sb)` produced by the *sum of the other tracks*, per scale-factor band. Use the MPEG psychoacoustic model: spreading function, tonality-weighted offsets (noise masking tone 6 dB, tone masking noise 29 dB), and the threshold in quiet.
  - Masker-to-signal ratio: `MSR_n(sb) = 10·log10(T_n(sb)/E_n(sb))`.
  - Masking score: `M_n = Σ` of MSR_n over bands where E_n < T_n, with each term capped at `T_max` = 20 dB.
  - The optimiser tuned 6-band EQ gains per track (centres 75, 100, 250, 750, 2500 and 7500 Hz; Q 1, 0.6, 0.3, 0.3, 0.2, 1) plus compressor threshold, ratio, attack and release.
  - The best variant "can compete with the mixes produced by professional engineers in terms of masking reduction and overall preference". Subgrouping improved perceived quality and clarity.
  - The paper also describes a "general frequency and dynamic processor": an EQ whose boost or cut follows a dynamics curve over time. This is in effect the keyed dynamic EQ that picture C needs.
- **Hafezi & Reiss 2015** designed a simplified masking measure from best practices. They built offline and real-time multitrack EQ systems that reduced both perceived and objective masking [R22, abstract]. Parameter details are UNVERIFIED.
- **Spectral-overlap EQ** (LANDR/QMUL) [R16, read]:
  - model each track as a band centred on its spectral centroid, with width equal to its spectral spread; overlaps indicate masking;
  - high-pass and low-pass at the spread edges confine each source;
  - shelf and notch filters handle prominent overlaps;
  - de-essing applies a notch when 5–10 kHz energy crosses a threshold.
- **Subgroup EQ.** Engineers who made more EQ'd subgroups got higher ratings (Spearman ρ = .67 per engineer, .40 per mix) [R2 Table 4.7, read]. This argues for a group EQ stage (Section 2.6).

#### Per-picture carve [proposal]

- **A** — static complementary cuts on the masked partner, only where the pair-masking measure exceeds a threshold during the masker's hits. The vocal is protected: other tracks are cut in 1.5–5 kHz, and the vocal is never cut to make room.
- **B** — sidechain ducking keyed from the front element: kick ducks bass; vocal ducks pads and guitars. The depth goal is "no audible pumping": aim for 1–3 dB gain reduction and check it.
  - The only numeric ducking data found is from TV, an adjacent domain. There, listeners wanted at least a 10 LU difference between commentary and music [R32, abstract].
- **C** — keyed dynamic EQ (Ronan's frequency-dynamic processor) acting only in the overlapping band and only while the key is active.

### 2.4 Dynamic range compression

#### Evidence on how much

- **Err on the light side.**
  - Preference correlated positively with dynamic range at matched loudness (LDR ρ = .244). PLR and crest factor also became significant under alternative rating aggregations [R2 §4.2.2, read].
  - Rule: "it is better to err on the side of applying (too) little compression" [R2 Table 6.1, read].
- **Maddams et al.: compression driven by loudness range** [R26, read]:
  - LRA computed with 400 ms windows at 7.5 Hz.
  - Target per track: `LRA_T(i) = LRA(i) − ΔLRA_red · (LRA(i) − LRA_min)/(LRA_max − LRA_min)`. The track with the smallest LRA is left alone.
  - "Touch" settings: ΔLRA_red = 3, 6 or 9 LU.
  - "Ratio" mode: threshold = RMS − 12 dB, knee 3 dB, ratio searched to 0.1. "Threshold" mode: ratio ∞:1, knee = |threshold|.
  - **Only threshold-light scored above no compression. Heavy settings were rated "bad"**, and the expert's manual mix won on sound quality.
  - The expert applied *more* compression to the tracks with the *lowest* LRA — the opposite of the algorithm's assumption.
- **Engineers raise crest factor.** All instruments had a higher crest factor (100 ms and 1 s) after processing [R3, read]. Short-term dynamics were effectively expanded, consistent with compressors whose attack lets transients through.
  - Design consequence [proposal]: any track compressor must not reduce the track's 100 ms crest factor. Use that as a hard check.

#### Settings rules

- **Textbook settings collected by De Man** [R2 Table 2.1, read]:

| Track | Ratio | Gain reduction | Attack | Release | Other |
|---|---|---|---|---|---|
| Kick | 5:1–10:1 | 5–15 dB (peak) | 1–5 ms | 200 ms | hard knee |
| Snare | 6:1 | — | slow to medium | until the next snare hit | release = 2 beats, from tempo |
| Overheads | 4:1–6:1 | 12 dB | 10 ms | 20–100 ms | — |
| Bass | 5:1–∞ | 3–4 dB | slow to medium | medium | hard knee |
| Acoustic guitar | 4:1–8:1 | 5–10 dB | 10–40 ms | 100–500 ms | hard knee |
| Distorted guitar | uncompressed | — | — | — | — |
| Electric guitar | 8:1 | 5–15 dB | 2–10 ms | 500 ms | hard knee |
| Lead vocal | 4:1 | 4–6 dB | medium | 500 ms | soft 4 dB knee, RMS sensing |
| Lead vocal (peak clip) | ∞ | low (high threshold) | — | — | — |
| Backing vocals | — | up to 10 dB | — | — | — |
| Mix bus | 2:1–4:1 | 3–6 dB | slow | slow | — |
| Mix bus limiter | ∞ | — | — | — | ceiling 0.3 dB below full scale |

  - Note: these textbook amounts are heavier than the listening evidence above supports. Start at the light end.
- **Automated ballistics (Giannoulis et al.).** Attack and release are set inversely proportional to the spectral flux of the side-chain signal: short times for transient material, long times for steady material. Only the threshold is left to the user [R28 §3.1, read; R27, abstract]. Exact constants are UNVERIFIED.
- **LANDR/QMUL compression** [R16, read]:
  - per-track compressors aim to minimise the spread of loudness range across active tracks, using spectral flux and crest factor;
  - mastering compressor: threshold from the input RMS; knee proportional to the threshold; attack and release from the crest factor;
  - average-compression estimate: `c·T·(1 − 1/R)` with c = 0.5;
  - limiter threshold 2 dB above the compressor threshold;
  - make-up gain = energy in / energy out.
- **Ma et al. 2015** [R29, abstract]:
  - ratio and threshold were learned by multiple linear regression from an adjustment experiment with engineers;
  - knee, attack, release and make-up gain follow features and rules;
  - two new weightings: "percussivity" and "low-frequency";
  - results "compete with or outperform" semi-professional manual mixes.
  - The coefficients are UNVERIFIED.
- **Mastering ballistics (Katz, via Hilsamer & Herzog).** Attack 50–300 ms (common 100 ms); release 50–500 ms (common 150–250 ms) [R28, read].

#### Deterministic per-track rule [proposal]

1. **Goal.** Gain reduction of `GR_role` dB at the 95th percentile of the 100 ms RMS level, taken from the light end of the table above:

   | Role | GR_role |
   |---|---|
   | Vocal | 3–4 dB |
   | Bass | 3 dB |
   | Kick, snare | 2–4 dB |
   | Acoustic guitar | 2–3 dB |
   | Distorted guitar, pads, FX | 0 |

2. **Threshold.** `T = L95 − GR_role / (1 − 1/R)`. Ratio R is taken from the table.
3. **Attack** from percussiveness. With `CF100` the 100 ms crest factor and `CF_vocal` ≈ 3.3, the vocal mean in [R3 Table 2]:
   - attack = clamp(30 ms × CF100/CF_vocal, 3 ms, 50 ms) for sustained roles;
   - attack = 10–30 ms for drums, so transients pass and the crest-factor check holds.
4. **Release** from tempo. Release = clamp(k × 60/BPM, 80 ms, 600 ms):
   - k = 2 for snare and backbeat elements, after [R2 Table 2.1];
   - k = 0.5 for kick and bass;
   - k = 1 for vocals and instruments.
5. **Guard.** Back off GR until the track's 100 ms crest factor is ≥ its input value and its LRA has dropped by no more than 3 LU, the "light" touch [R26].
6. **Per picture.** Picture A is allowed the vocal's full GR_role. Picture C uses 0.5 × GR_role.

### 2.5 Reverb and delay sends

- **Measured bounds** [R4, read; R2 Table 6.1 and App. A, read]:
  - The study: 80 mixes of 10 songs by trained engineers, rated by 34 skilled listeners. Reverb came up in 35% of comments without being prompted.
  - `RRL = mean over windows of [ML(wet) − ML(dry)]`, where ML is BS.1770 momentary loudness.
  - **Every mix with RRL ≥ −9 LU was judged too reverberant. −14 LU is "a more desirable loudness".** Pestana's earlier estimate of −9 LU as optimal [R9] is thereby contested.
  - JND of the direct-to-reverberant ratio: 5–6 dB.
  - A perceived excess of reverb hurts more than a lack of it.
  - **Decay time matters as well.** Mixes perceived as too wet despite a low RRL had long tails; mixes perceived as too dry had short, strong reverb.
  - Logistic model of P(too reverberant): `logit = 6.78 + 0.487·RRL[LU] + 2.56·log(EDT[s])`.
    - EDT is measured on an "equivalent impulse response": spectral division of the wet and dry mono sums, decay method, 6 × the time to fall 10 dB.
    - The log base is not stated (UNVERIFIED). With EDT = 1 s the 50% boundary is RRL ≈ −13.9 LU, consistent with −14 LU.
    - Rule: "for a higher perceived amount of reverberation, increase the reverb loudness and/or reverb time".
- **Typical failure.** DMC listeners "rated harshly" mixes with too much reverb on vocals [R36, read]. Skilled listeners also show "general dislike for an excessive reverb on the lead vocal" [R2 §4.3, read].
- **Reverb lengths used in FxNorm training** [R37 repo README, read]:
  - training reverbs with RT between 2 and 4 s;
  - for real dry inputs, a "pre-reverb" with RT under 1.5 s.
- **Learned approaches.**
  - Chourdakis & Reiss: classifiers map a 31-dimensional feature set to reverb parameter presets, from user examples [R31, abstract].
  - Diff2Mix includes a reverb send whose wet amount the network learns [R44, read].
  - Diff-MST has no reverb, and lists this as a limitation [R39, read].
- **Per-role send levels.** No peer-reviewed numbers were found (UNVERIFIED). [proposal] Calibrate them on his mixes (experiment E5).

#### Per-picture rules [proposal]

| Picture | Reverb |
|---|---|
| A | Total RRL ≤ −20 LU. Short, early-reflection-like room (EDT ≤ 0.6 s) on drums and backing only. Lead vocal dry, or a slap delay at ≤ −22 LU. |
| B | One shared room on a bus. Total RRL −14 LU (range −16 to −12). EDT 1.2–1.8 s. Sends scaled so roles sit at roughly equal wet share, with the lead vocal at about −3 LU below the others. Pre-delay is not evidence-based; leave it as a tunable value. |
| C | Front roles (lead vocal, kick, snare, bass) dry. Back roles (pads, backing vocals, overheads/room, FX) get long tails (EDT 2–3 s). Keep total RRL ≤ −12 LU and check the logistic risk P(too reverberant) < 0.5. |

All pictures: high-pass the reverb returns. There is no data on the frequency; 150–250 Hz is a tunable value (UNVERIFIED).

### 2.6 Bus processing and grouping

- **Mix bus.** Glue compression of 2:1–4:1 with 3–6 dB gain reduction and slow ballistics. Limiter ceiling 0.3 dB below full scale [R2 Table 2.1, read]. [proposal] For streaming delivery, use a true-peak ceiling of −1 dBTP, following EBU R 128 [R52; not re-read for this survey].
- **Grouping matters.**
  - Two-stage mixing (balance within groups, then between groups) significantly beat single-stage for both MEGAMI (61.6 vs 54.7) and Diff-MST (28.7 vs 19.4) [R12, read].
  - Poor grouping clearly hurt results; loudness errors had weaker effects [R12, read].
  - The 7-group mixing-oriented scheme [R12, read]:
    1. Low-frequency (bass)
    2. Low/mid percussion (kick, snare, toms)
    3. High percussion (hi-hats, cymbals, overheads)
    4. Lead (lead vocal, solos, main melodies)
    5. Accompaniment (backing vocals, harmonic and rhythmic support)
    6. Pad (sustained, weak attacks)
    7. Other (FX, transitions)
  - This maps directly onto the engine's role labels.
- **What goes wrong in amateur work.** In data from the MixCheck Studio platform for amateur producers, loudness and dynamics issues were the most common, especially in masters. Mixes had more stereo-field and phase issues than masters [R33, abstract].
- **Listener quality ratings** of commercial releases were most associated with features related to loudness and dynamic range compression [R34, abstract].
- **Main dimensions of mix variation:** dynamics/amplitude, brightness/treble, bass, and width [R35, abstract]. These are a good compact axis set for comparing against his references.

#### Per-picture bus [proposal]

| Picture | Bus processing |
|---|---|
| A | Peak catcher only: limiter or clipper at −1 dBTP, gain reduction ≤ 1–2 dB on the loudest peaks. |
| B | Glue compressor 2:1, 1–3 dB gain reduction, attack about 30 ms, release 0.3 s or tempo-synced. Then the same peak catcher as A. |
| C | No bus compression. Only a safety ceiling at −1 dBTP that should rarely engage. |

Check for every picture: PLR (true peak minus integrated loudness) must not fall more than about 1–2 dB below the dry gain-staged sum. Calibrate this in experiment E10.

### 2.7 Low cut and mono lows

- **Evidence.**
  - "All tracks: low cut", with role cutoffs: kick < 30 Hz, bass < 50 Hz, vocal < 80 Hz; 100 Hz on everything except bass and kick; 12 dB/octave [R2 Tables 2.1–2.2, §2.1.3, read].
  - Low energy is reduced on every instrument in real mixes [R3, read].
  - Low sources are panned centre, and width rises from 50 to 400 Hz [R3, read].
  - Mono-compatibility and phase problems are frequent in amateur mixes [R33, abstract].
- **Content-driven low cut** ("low cut where nothing low is played") [proposal]:
  - For pitched tracks: f0_min = the 2nd percentile of PYIN-style f0 over active frames. Cutoff = 0.7 × f0_min.
  - For unpitched tracks: the frequency below which cumulative energy is < −30 dB of the track's total.
  - Clamp the cutoff to [20 Hz, role maximum]: vocal ≤ 120 Hz, guitars and keys ≤ 150 Hz, pads ≤ 200 Hz, overheads ≤ 250 Hz. Never cut the kick above 30 Hz or the bass above 40 Hz.
  - Slope 12 dB/octave by default; test 24 dB/octave.
- **Mono lows** [proposal]: on each bus and on the mix, use M/S with side gain 0 below `f_mono` and ramping to 1 at `f_full` (Section 2.2). In picture C, also apply it to each stereo track before panning, so wide pads do not carry side content below 100 Hz.

### 2.8 IP caution (not legal advice)

- **US9654869B2, "System and method for autonomous multi-track audio processing"** [R16, read].
  - Inventors: Reiss, Mansbridge, Clifford, Ma, Hafezi and Jillings. Assignees: LANDR Audio Inc. and Queen Mary University of London. Priority 2012, granted 2017. Google estimates expiry around 2033.
  - The description covers equal-loudness fader control with activity gating and EMA smoothing, centroid-paired panning, centroid/spread masking EQ, LRA-driven compression, and Yule-Walker target EQ.
  - **A shipping product that implements these specific methods should be checked by counsel.**
- **US10396744B2, "Systems and methods for identifying and remediating sound masking"** [R53, abstract]. Originally iZotope, now Native Instruments. Relevant to the keyed dynamic-EQ "carve". The claims were not read.

---

## 3. How automatic mixes have been evaluated against reference mixes

### 3.1 Listening-test designs

- **Multi-stimulus beats pairwise.** De Man found multi-stimulus rating more discriminating and faster than pairwise comparison, even with six stimuli [R2 §3.2, read].
  - Keep a page under about 12 stimuli [R2 §3.2, read].
  - Single-axis "drag and drop" ranking (APE) is easier for experienced listeners than MUSHRA sliders [R2 §3.2, read].
- **Arguments against strict MUSHRA (ITU-R BS.1534 [R51]) for mixes** [R2 §3.2, read]:
  - there is often no valid reference, because renowned engineers' mixes are not always rated above students';
  - MUSHRA is "not suitable" when stimuli may exceed the reference;
  - low anchors compress the other ratings.
  - FxNorm also dropped the low anchor for the same reason [R37, read].
- **Common practice in this literature:**
  - The Web Audio Evaluation Tool with the APE interface [R36, read; R37, read].
  - All stimuli loudness-normalised: −23 LUFS in [R37], BS.1770 in [R2].
  - Excerpts of 10–25 s, often chorus-to-verse transitions [R37, read; R39, read; R12, read].
  - Dry stems sometimes provided as context [R37, read; R43, read].
- **Rater screening.**
  - Hidden repeated trials with intra-rater Pearson r > 0.75 [R12, read].
  - Correlating each rater with the panel median [R26, read].
- **Statistics.**
  - Kruskal-Wallis followed by Conover [R36, read].
  - Mann-Whitney with Bonferroni correction [R37, read].
  - Holm-adjusted Wilcoxon [R44, read].
  - Paired t-tests with FDR correction and Cohen's d_z [R12, read].
- **Experienced listeners are harsh.**
  - None of the mixes, human ones included, was consistently rated "very good" by professionals [R37, read].
  - More experienced listeners were more negative and more specific, and agreed with each other more [R5, abstract].
  - 76% of comment statements were criticism [R2 §4.3, read].

### 3.2 Reported results: automatic versus human

| System (type) | Test | Result versus human or target | Ref |
|---|---|---|---|
| KEAMS (rules + role tags: HPF, compressor, EQ, fader, pan; no reverb) | 15 listeners, 5 songs, 11–24 s, against 2 pros, a role-blind cross-adaptive chain, and a mono sum | **No significant difference from the pros.** The role-blind chain was rated lower. | [R2 ch.2, read] |
| Maddams LRA compression | MUSHRA-like, 3 tests | Light setting > no compression; expert manual mix best on sound quality; heavy settings "bad" | [R26, read] |
| Ronan et al. masking optimiser + subgroups | Listening test on preference and clarity | Best variant competes with professional mixes on masking reduction and preference; subgrouping helps | [R13, read] |
| DMC, Steinmetz 2021 (neural, gain/pan/EQ/compressor/reverb) | 16 engineers, APE | Drums (gain and pan only): **not different from target** (p_adj = 0.08). Full MedleyDB mix: worse than target (p_adj = 1.1·10⁻⁹); fails through over-reverbed vocals. | [R36, read] |
| FxNorm-automix 2022 (neural, 4 stems) | 14 professionals averaging 11.6 years, 6 songs | Production value: **not significantly different from human**. Clarity: **higher than human** (p = .008 / .013). Excitement: not different. | [R37, read] |
| Mixing style transfer, Koo 2023 | Experienced engineers (average 7.3 years) | Close to reference style; robust when used with source separation | [R38, read] |
| Diff-MST 2024 | **No listening test**; objective features only | Best AF-loss among systems | [R39, read] |
| MEGAMI 2025 (generative) | 12 listeners, 7 songs | "Approaching" human; wide confidence intervals; depends on song | [R43, read] |
| Diff2Mix 2026 | webMUSHRA, 20 professionals | Diff2Mix-P **not significantly different from human** on quality; fails on a rock reference | [R44, read] |
| Two-stage analysis 2026 | 18 retained listeners, 3 excerpts of 23–27 tracks | **Rule-based ELL 61.1 ≈ MEGAMI 55.5 ≫ Diff-MST 21.4** (intra-group); two-stage beats single-stage | [R12, read] |
| Spectral panning, Pestana & Reiss 2014 | Ranking test | Better on clarity; an effect rather than a general mixing method | [R20, read] |

### 3.3 Objective metrics and how far they track listening

- **Feature-distance metrics against a reference mix.**
  - FxNorm reports mean absolute percentage error by feature group, each computed with a 0.5 s running mean [R37, read]:
    - spectral: centroid, bandwidth, contrast, flatness, roll-off;
    - panning: panning RMS;
    - dynamics: RMS, dynamic spread, crest factor;
    - loudness: LUFS.
  - Loudness, dynamics and panning matched the reference better than spectral features. The authors read this as deviations in EQ and reverb [R37, read].
- **Diff-MST "audio feature" (AF) loss.** A weighted MSE between predicted and reference mix of [R39, read]:

  | Term | Weight |
  |---|---|
  | RMS | 0.1 |
  | Crest factor, 20·log10(max\|x\|/RMS) | 0.001 |
  | Log Bark spectrum | 0.1 |
  | Stereo width, Σ(L−R)²/Σ(L+R)² | 1.0 |
  | Stereo imbalance, (ΣR² − ΣL²)/(ΣR² + ΣL²) | 1.0 |

  - Before computing it, the reference is normalised to −16 dBFS and the prediction to −22 dBFS.
  - This is a cheap, interpretable full-reference metric that fits the nightly loop. The authors note it measures similarity, not quality or creative choices [R39, read].
- **Multi-resolution mid/side Mel-STFT distance** [R41, read]:
  - left/right weight 0.5, mid 0.25, side 0.25;
  - FFT sizes 512, 1024 and 4096, hop at a quarter of the FFT size, 96 Mel bands, A-weighting.
  - The mixing-graph work used it to fit consoles to real mixes.
- **Distributional metrics:**
  - FAD on VGGish [R39];
  - KAD on AFx-Rep, Fx-Encoder, Fx-Encoder++ and CLAP embeddings [R43, R44].
  - These need many examples and compare sets, not one song against its reference. Encoders used in training bias the metric [R43, read; R44, read].
  - In a 2026 study, MUSHRA results "diverge from the distributional metrics" [R45, read].
- **Learned quality predictors.** Audiobox Aesthetics "production quality" scored a plain raw sum at 7.74, DMC at 7.73 and MEGAMI at 7.65; the proposed system scored 7.97 [R45, read]. That is poor separation between a raw sum and processed mixes. A 2026 music-generation paper reports a correlation of r = 0.20 with music quality (search-snippet level, UNVERIFIED).
- **Which features predicted preference** in the 98 rated mixes (Spearman) [R2 Table 4.6, read]:
  - side/mid ratio: ρ = −.32;
  - LDR (micro-dynamics): ρ = +.24;
  - no spectral, octave-band or MFCC feature was significant.
- **Quality of commercial productions** was associated mostly with loudness and compression features [R34, abstract].
- **Bottom line.** No objective metric has been validated as a stand-in for listening tests on automatic mixes. The defensible approach: compute a multi-feature distance to *his* mix along balance, dynamics, width and spectrum, and confirm periodically by blind listening.

---

## 4. Open-source projects

All licences below were checked by opening the repository's licence file through the GitHub API on 2026-10-23 [read]. "Commercial closed-source use" refers to the code. Weights trained on non-commercial data are flagged separately, because the code licence does not cure the data licence: MUSDB18 is "academic purposes" only, and its MedleyDB tracks are CC BY-NC-SA 4.0 [R56, read].

| Project | URL | What it does | Language | Weights | Licence (file) | Commercial closed-source? |
|---|---|---|---|---|---|---|
| automix-toolkit | https://github.com/csteinmetz1/automix-toolkit | Train and run DMC and Mix-Wave-U-Net automatic mixers; dataset recipes | Python | HF csteinmetz1/automix-toolkit: enst-drums-dmc.ckpt 149.6 MB, medleydb-16-dmc.ckpt 149.6 MB, enst-drums-mixwaveunet.ckpt 214.2 MB, encoder.ckpt 48.6 MB | Apache-2.0 (LICENSE) | **Yes for code.** Weights are tagged Apache-2.0 but trained on ENST-Drums and MedleyDB (MedleyDB is NC); weights UNVERIFIED for commercial use. |
| FxNorm-automix | https://github.com/sony/FxNorm-automix | Effect normalisation of wet stems plus a TCN/BLSTM 4-stem automatic mixer [R37] | Python | In-repo: ours_S_Lb 11.1 MB, ours_S_pretrained 9.9 MB, wun_S_Lb 9.9 MB (MUSDB18-trained; the large-dataset models were not released) | MIT (LICENSE.md) | **Yes for code.** Released weights are trained on MUSDB18 (non-commercial data). |
| music_mixing_style_transfer | https://github.com/jhtonyKoo/music_mixing_style_transfer | FXencoder plus MixFXcloner reference-based style transfer [R38] | Python | Google Drive links; size UNVERIFIED (MUSDB18-trained) | MIT (LICENSE) | **Yes for code.** Weights carry the MUSDB18 data issue. |
| Diff-MST | https://github.com/sai-soum/Diff-MST | Transformer controller plus differentiable console (gain, PEQ, compressor, pan, master EQ and compressor) [R39] | Python, notebooks | No public checkpoint found in README or releases (UNVERIFIED elsewhere) | CC BY-NC-SA 4.0 (LICENSE) | **No: ideas only.** |
| MEGAMI | https://github.com/SonyResearch/MEGAMI | Diffusion model in effect-embedding space plus TCN effect processor [R43] | Python | Release v0: FxGenerator_public.pt 1,226.6 MB, FxProcessor_public.pt 202.0 MB, CLAP_DA_public.pt 8.4 MB. Also needs LAION-CLAP music, 2,352.5 MB (CC0), and Fx-Encoder++, 1,608.4 MB. About 5.4 GB in total. | CC BY-NC-SA 4.0 (LICENSE) | **No: ideas only.** The README invites commercial licensing enquiries. |
| Fx-Encoder++ | https://github.com/SonyResearch/Fx-Encoder_PlusPlus | Instrument-wise audio-effects embeddings from mixtures [R46] | Python | 1,608.4 MB (HF yytung/fxencoder-plusplus, no licence tag) | CC BY-NC 4.0 (LICENSE) | **No: ideas only.** |
| ST-ITO | https://github.com/csteinmetz1/st-ito | Inference-time CMA-ES search over the parameters of arbitrary effect chains, including VSTs, driven by the AFx-Rep style embedding [R40] | Python | AFx-Rep checkpoint location and size UNVERIFIED; a BEATs baseline is downloaded from Microsoft storage | Apache-2.0 (LICENSE) | **Yes for code.** Check the AFx-Rep training data (it includes MTG-Jamendo and other public sets [R40]). |
| dasp-pytorch | https://github.com/csteinmetz1/dasp-pytorch | Differentiable EQ, compressor, reverb and other processors (used by Diff-MST) | Python | None (DSP) | Apache-2.0 (LICENSE) | **Yes.** |
| GRAFX | https://github.com/sh-lee97/grafx | Audio processing graphs in PyTorch; basis of mixing-graph reverse engineering [R41, R42] | Python | None | Apache-2.0 (LICENSE) | **Yes.** |
| grafx-prune | https://github.com/sh-lee97/grafx-prune | Mixing-graph search by pruning [R41] | Python | None listed | **No licence file** (repo root: README.md, code, docs) | **No.** All rights reserved by default; ideas only. |
| pymixconsole | https://github.com/csteinmetz1/pymixconsole | Headless multitrack mixing console | Python | None | MIT (LICENSE) | **Yes.** |
| auraloss | https://github.com/csteinmetz1/auraloss | Multi-resolution STFT and related audio losses (usable as metrics) | Python | None | Apache-2.0 (LICENSE) | **Yes.** |
| pyloudnorm | https://github.com/csteinmetz1/pyloudnorm | ITU-R BS.1770-4 loudness meter | Python | None | MIT (LICENSE) | **Yes.** |
| libebur128 | https://github.com/jiixyj/libebur128 | EBU R128: BS.1770 loudness, LRA, true peak | **C** (drops straight into the C++ engine) | None | MIT (COPYING) | **Yes.** |
| fadtk | https://github.com/microsoft/fadtk | Fréchet Audio Distance toolkit (nightly evaluation only) | Python | Downloads embedding models at run time; sizes vary (UNVERIFIED) | MIT (LICENSE) | **Yes for code.** Check each embedding model's licence. |
| audiobox-aesthetics | https://github.com/facebookresearch/audiobox-aesthetics | Learned quality predictor: production quality and complexity, content enjoyment and usefulness | Python | checkpoint.pt / model.safetensors 415.5 MB (HF, CC-BY-4.0) | CC-BY-4.0 (LICENSE); parts MIT | **Yes, with attribution.** Weak as a mix metric (Section 3.3). |
| e2e_music_remastering_system | https://github.com/jhtonyKoo/e2e_music_remastering_system | Mastering style transfer, Koo et al. | Python | UNVERIFIED | MIT (LICENSE) | **Yes for code.** Data provenance unchecked. |
| nablafx | https://github.com/mcomunita/nablafx | Differentiable black-box and grey-box effect modelling | Python | UNVERIFIED | MIT (LICENSE) | **Yes.** |
| AutoEq | https://github.com/jaakkopasanen/AutoEq | Automatic headphone EQ to a target curve; useful as a curve-fitting and EQ-design reference | Python | None (data) | MIT (LICENSE) | **Yes.** |
| AES2025-materials (Shi et al., stage 1) | https://github.com/SparrowReivun/AES2025-materials | Rule-based intra-group balance (pitch, centroid, dynamic band-pass, then loudness) [R11] | Python | None | **No licence file on GitHub.** The Zenodo archive record says CC BY 4.0 [R11]. | **Unclear.** Treat as ideas only unless the authors confirm CC BY 4.0 covers the GitHub code. |
| dl4am tutorial | https://github.com/dl4am/tutorial | ISMIR 2022 tutorial "Deep learning for automatic mixing" | Notebooks | — | Apache-2.0 (LICENSE) | **Yes.** |
| AutomaticMixingPapers | https://github.com/csteinmetz1/AutomaticMixingPapers | Curated paper list with code and PDF links | HTML/JS | — | MIT (LICENSE) | **Yes** (it is a list). |
| DeepAFx-ST | https://github.com/adobe-research/DeepAFx-ST | Style transfer of audio effects with differentiable DSP | Python | UNVERIFIED | Adobe Research License: "noncommercial research purposes only" (LICENSE) | **No.** |
| DeepAFx | https://github.com/adobe-research/DeepAFx | Third-party plug-ins as differentiable layers | Python | UNVERIFIED | Adobe Research License, non-commercial (LICENSE) | **No.** |
| Matchering | https://github.com/sergree/matchering | Reference mastering: matches RMS, frequency response, peak and stereo width to a reference | Python | None | GPL-3.0 (LICENSE) | **No: ideas only.** The idea is simple to re-implement. |
| pedalboard | https://github.com/spotify/pedalboard | Python audio and VST/AU hosting (used by ST-ITO) | C++/Python | None | GPL-3.0 (LICENSE) | **No** (fine for an internal nightly harness that is not shipped). |
| DawDreamer | https://github.com/DBraun/DawDreamer | Scriptable DAW and plug-in host | C++/Python | None | GPL-3.0 (LICENSE) | **No** (internal tooling only). |
| deeuu/loudness | https://github.com/deeuu/loudness | Psychoacoustic loudness models (used in De Man's reverb work [R4]) | C++ | None | GPL-3.0 (LICENSE) | **No.** |
| Essentia | https://github.com/MTG/essentia | Music analysis library | C++/Python | Optional models | AGPL-3.0 (COPYING.txt) | **No.** |

Note on tooling: GPL tools such as pedalboard and DawDreamer can run in an internal nightly harness that is never distributed, but must not be linked into the shipped app. The general rule is standard; confirm specifics with counsel.

---

## 5. Learned approaches: what they predict and whether they fit "offline, Mac, seconds"

None of these papers report Apple-Silicon run times. Every speed statement in the last column is my estimate [proposal / UNVERIFIED] unless a number is quoted.

| Approach | Predicts | Inputs | Size | Reported speed and compute | Offline on a Mac in seconds? |
|---|---|---|---|---|---|
| **DMC**, Steinmetz et al. 2021 [R36, read] | Human-readable per-channel parameters: gain, polarity, EQ, compressor, reverb (via a pre-trained TCN proxy), fader, pan. Permutation-invariant, any number of tracks. | Dry tracks only, no labels | Checkpoints ~150 MB [Section 4]. A Demucs-style baseline was ~80M parameters. | Not reported | Plausible for inference (TCN per track), but the published models are drums-only or MedleyDB-16, trained on NC data. Mixed results on full songs. |
| **FxNorm-automix** 2022 [R37, read] | A wet stereo mix from 4 normalised stems (TCN + BLSTM + squeeze-excitation). Audio out, no parameters. | Vocals/bass/drums/other stems, effect-normalised with MUSDB18 statistics; 10 s frames at 44.1 kHz | **2.7M parameters**; ~10–11 MB weights | Not reported | Small enough for seconds on CPU (estimate). Needs grouping into 4 stems first; not interpretable; only MUSDB18-trained weights released. |
| **Mixing style transfer**, Koo et al. 2023 [R38, read] | Converts each stem's mixing style to a reference's; FXencoder embedding (contrastive) plus MixFXcloner | Stems (or Demucs-separated mixture) + reference song; ~11.8 s segments | UNVERIFIED | Not reported | Possible; audio-domain output (artefact risk); MUSDB18-trained. |
| **Diff-MST** 2024 [R39, read] | Parameters for gain, PEQ, compressor and pan per track, plus master EQ and compressor; no reverb; static | Any number of raw tracks (≤ 16 trained) + reference song | **190M parameters** (76.5M encoders, 37.9M transformer) | Not reported | Inference likely seconds to tens of seconds (estimate). Licence NC; weak listening results in [R12] (≈ 19–31/100). |
| **ST-ITO** 2024 [R40, read] | Parameters of *any* effect chain, including VSTs, found by CMA-ES (population 64, ≤ 25 steps) minimising AFx-Rep distance to a reference | Track + reference audio | AFx-Rep (PANNs backbone; size not reported) | "≈1 min" per optimisation versus ≈1 s for direct estimators | **Too slow for 10 s per track** if run at mix time. Fits a nightly "learn his plug-in settings" job; Apache-2.0. |
| **Mixing-graph search / reverse engineering**, Lee et al. 2024–2025 [R41, R42, read] | Sparse per-track graph (EQ, compressor, gate, imager, gain/pan, delay, reverb) with fitted parameters that reproduce a *given* mix | Dry tracks + **the actual mix** | Per-song optimisation; no network | 12k steps; **29–56 min per song on an RTX 3090** | Not for mix time. **Very useful offline** to recover his settings from his own multitrack-and-mix pairs (GRAFX is Apache-2.0). Mac time UNVERIFIED. |
| **MEGAMI** 2025 [R43, read] | Per-track effect embeddings sampled by conditional diffusion (EDM, permutation-equivariant transformer), rendered by a TCN effect processor | Dry tracks, unlabelled (CLAP infers content); 11.9 s segments; ≤ 14 tracks | Score model ~70M + processor ~9M; **~5.4 GB of checkpoints** including CLAP and Fx-Encoder++ | Sampling steps and time not reported | Unlikely in 10 s on a Mac (estimate); NC licence; audio-domain processor. |
| **Diff2Mix** 2026 [R44, read] | A diffusion embedding decoded to console parameters (gain, PEQ, compressor, pan, reverb send); optional reference | Dry stems (+ reference) | Not reported | Not reported | Unknown; code release and licence UNVERIFIED. |
| **Sequential stem blending** 2026 [R45, read] | Each processed stem, generated in the Stable Audio Open VAE latent by rectified flow (10 steps), added to a growing submix | Stem + current submix + loudness, genre and instrument meta | Not reported | Trained on one RTX 4090; inference time not reported | Generative audio: interpretability and artefact risks; not suitable for a deterministic product (assessment). |
| **LLM2Fx-Tools** 2026 [R47, abstract] | An LLM plans an effect chain and parameters by tool calls | Audio (+ text) | LLM-scale | Not reported | Not for offline seconds on device (assessment). |

**What the learned work implies for a rule-based mixer** [proposal]:

1. The interpretable "parameter-estimation" design (DMC, Diff-MST, Diff2Mix) is the same contract as this engine: predict console parameters, render with real DSP. Rules can be swapped for a learned predictor later without changing the renderer.
2. Grouping first, then balance, is the strongest structural result [R12].
3. Mixing-graph fitting [R41, R42] and ST-ITO [R40] are best used **offline as measuring instruments** on his own songs. They turn "his final mix" into per-track settings that calibrate the rules.

---

## 6. Ten experiments for the nightly improve-and-measure loop

### 6.1 Common harness [proposal]

**Data per song.** His multitracks (with role labels) and his final mix `Y`.

**Preparation.**

- Align `Y` to the dry tracks by cross-correlating against the dry sum.
- Choose two stretches with the mixer's own stretch logic: a *fit* stretch and a *held-out* stretch.
- If `Y` is mastered, treat dynamics features cautiously. Prefer a pre-master bounce if he has one.
- Loudness-normalise every mix and `Y` to −23 LUFS integrated before spectral, width and balance comparisons (as in [R37]). Use true levels for PLR and true peak.

**Measurement H1: "inverse mix" estimate.** Run once per song and cache it.

- For each 1/3-octave band b and output channel c ∈ {L, R}, fit non-negative weights by least squares:
  - `P_Y,c,b(t) ≈ Σ_i w_{i,c,b} · P_{X_i,b}(t)`, with short-time band powers over the fit stretch.
- The weights give his per-track **level** (K-weighted sum over b and c), **pan** (L/R ratio, per low, mid and high band) and **EQ shape** (w over b relative to the track's mean).
- The unexplained power is a proxy for reverb, saturation and other added content.
- Assumes uncorrelated, roughly time-invariant processing. Treat each drum kit as one group because of bleed.
- Runs in seconds per song.
- Optional slow upgrade: a nightly GRAFX mixing-graph fit [R41, R42] for a few songs. It also recovers compressor and reverb settings.

**Measurement H2: mix feature vector**, per stretch:

- integrated LUFS, LRA (EBU Tech 3342 [R52]), PLR, crest factor at 100 ms and 1 s [R3];
- side/mid ratio, overall and per band (P_low < 250 Hz, P_mid 250–2500 Hz, P_high > 2500 Hz [R3]), and the SPS curve;
- L/R imbalance [R3];
- 1/3-octave spectrum, tilt (dB/octave over 100 Hz–10 kHz) and the five band shares;
- RRL and EDT via the equivalent-impulse-response method [R4];
- per-role relative loudness (from H1, or from rendering our own stems);
- the pair-masking score for lead vocal against accompaniment and kick against bass [R13];
- two scalar full-reference distances to `Y`: the Diff-MST AF loss [R39] and the mid/side Mel-STFT distance [R41].

**Scoring.**

- Report per-feature errors. Aggregate them with weights 0.35 level, 0.29 space, 0.25 spectrum, 0.11 dynamics, matching how skilled listeners distribute their comments [R2 §4.3].
- **Leave one song out:** anything fitted from his songs is fitted on N−1 songs and scored on the held-out song.
- Accept a change only if both hold:
  1. median error falls on ≥ 2/3 of songs (paired Wilcoxon p < .05 once N ≥ 10 songs);
  2. no feature group worsens beyond a tolerance: 1 LU for role loudness (the vocal's spread across engineers is ±1.6 LU [R3]); 5 dB for RRL (the DRR JND [R4]); 0.5 dB/octave for tilt.

**Pictures versus his mix.** His mix is *one* picture.

- Each night, classify which of A/B/C is nearest to `Y` on width, RRL and PLR. Score that picture on all dimensions.
- Score the other two only on shared dimensions (balance, tonal balance, lows) plus their picture "envelope". For example: C's side/mid > his; B's RRL within −16…−12 LU; A's RRL ≤ −20 LU.

**Human check.**

- Weekly blind APE-style page for Steven: A/B/C plus his own mix as a hidden item, loudness-matched, ≤ 12 stimuli, no forced anchor [R2 §3.2].
- Log his ranking as a separate target. It is the only metric that is truly "his taste".

### 6.2 The ten experiments

Ordered by expected impact. The order follows the comment-share and processor-contribution evidence in Section 1.1, point 2.

**E1. Role loudness targets: literature defaults versus fitted to him**

- **Hypothesis.** His per-role relative loudness differs consistently from the literature means for at least one role, most likely the vocal or the drum kit. The literature means are vocal −3, bass −9, kit −7.5 LU [R2, R3, R7].
- **Change.** Replace the share table with shrinkage estimates: `r_role = w · r_his + (1−w) · r_lit`, with w ∈ {0, 0.5, 0.8, 1}, fitted on N−1 songs. Also try a per-section vocal offset (verse versus chorus).
- **Measure.** Per-role relative-loudness error against H1 on the held-out song, with the vocal error reported separately. AF-loss RMS term.
- **Success.** Vocal error ≤ 1 LU on median and lower total role error than w = 0.

**E2. Which loudness measure to balance with**

- **Hypothesis.** A plain gated K-weighted energy balances as well as fancier models [R8]. Narrowband correction [R11] fixes kick and bass, where LUFS misjudges them.
- **Change.** Run the same solver with four measures:
  1. BS.1770 integrated;
  2. active-region K-weighted energy;
  3. the Pestana modification (280 ms, +10 dB pre-filter [R3]);
  4. f0- and centroid-band-limited loudness (after [R11]).
- **Measure.** Role-loudness error against H1 and its variance across songs, per role. Also the solver's iteration count, as a speed check.
- **Success.** Pick the measure with the lowest kick and bass error that does not worsen the vocal.

**E3. Pan positions, frequency-dependent width and drum perspective**

- **Hypothesis.** His SPS curve has a knee frequency `f_k` in 100–400 Hz [R3]. Setting `f_mono` and `f_full` from it reduces width error. His drum perspective is consistent across songs.
- **Change.**
  - Pan assignment variants: role table [R2 Table 2.4]; centroid pairing [R16]; Chebyshev grid [R20].
  - Width-profile sweep: `f_mono` ∈ {60, 80, 100, 150} Hz, `f_full` ∈ {250, 400, 600} Hz.
  - Drum-perspective detector: sign of the correlation between the hi-hat and floor-tom close mics and L−R in his mix.
- **Measure.** Per-track pan error |ΔP| against H1 (for non-drum tracks); SPS-curve distance; side/mid ratio per band; AF-loss SW and SI terms; detector agreement across songs.
- **Success.** Lower width error. The perspective is decided by his data, or by his choice if the songs disagree.

**E4. Spectral targets: preset EQ versus corrective EQ versus his target curve**

- **Hypothesis.** Corrective EQ (deviation from role norms) beats textbook preset boosts, as [R3] shows and KEAMS's harsh guitar illustrates [R2]. A whole-mix target curve fitted to his mixes beats a generic one [R23, R24].
- **Change.** Three variants:
  1. Table 2.2 presets;
  2. corrective only: cut mud, box or resonance when a band share exceeds the role's median by more than k dB, k ∈ {2, 3, 4};
  3. corrective plus a gentle mix-bus Yule-Walker match to his mean 1/3-octave curve, capped at ±3 dB per band.
- **Measure.** 1/3-octave distance to `Y` (loudness-normalised); tilt error; the five band-share errors; per-role EQ-shape error against H1; Bark term of the AF loss.
- **Success.** Lower spectral distance without raising presence or air errors, which are the harshness risk.

**E5. Reverb amount and decay per picture, calibrated to him**

- **Hypothesis.** His total RRL lies in −18…−10 LU, near the −14 LU optimum in [R4], with an EDT typical for his genre. B set to his RRL and A set 6 LU lower are rated closest to his taste.
- **Change.**
  - Estimate his RRL and EDT: deconvolve `Y` against the H1 dry reconstruction to get an equivalent impulse response [R4].
  - Sweep B's return so total RRL ∈ {−18, −16, −14, −12, −10} LU, and EDT ∈ {0.8, 1.2, 1.8, 2.5} s.
  - For C, sweep the long-tail sends on back roles only.
- **Measure.** |RRL − RRL_his|; |log EDT − log EDT_his|; the logistic risk P(too reverberant) [R4]; vocal-only wet share, which must stay below the others [R36].
- **Success.** RRL within 3 dB of his (below the 5–6 dB JND) and risk < 0.5.

**E6. Two-stage grouping (7 groups) versus flat balancing**

- **Hypothesis.** Balancing inside the 7 functional groups first, then between groups, reduces both role-level and masking errors [R12, R13].
- **Change.** Run the solver hierarchically: groups get shares; tracks within a group get sub-shares. Add a group EQ and compressor stage in B. Compare with the flat solver.
- **Measure.** Role- and group-loudness error against H1; masking score for lead against accompaniment; AF loss.
- **Success.** Lower errors, and Steven's weekly ranking does not drop.

**E7. Masking carve method and depth per picture**

- **Hypothesis.** His mixes leave a measurable, non-zero masking level. Matching it gives the closest result; maximising unmasking makes the mix thin [proposal]. Panning both partners is the most accepted fix [R21].
- **Change.** For each masked pair flagged by the engine's pair-masking measure, compare:
  - static complementary cut (A);
  - sidechain duck (B), 0/1.5/3/6 dB;
  - keyed dynamic EQ in the overlap band (C), 0/1.5/3/6 dB;
  - a "pan apart first" pre-step.
- **Measure.** Cross-adaptive masking score `M_n` [R13] for the pair in our mix against the same score computed on `Y`; tonal-balance error, which must not rise; vocal relative loudness drift, which must stay ≤ 0.5 LU.
- **Success.** Masking score within 10% of his with no tonal regression.

**E8. Content-driven low cut and slope**

- **Hypothesis.** Cutoffs derived from each track's lowest real content match his low end better than fixed role cutoffs [R2 Table 2.2].
- **Change.** Three variants:
  1. fixed cutoffs: 100 Hz on everything except kick and bass; vocal 80 Hz; bass 50 Hz; kick 30 Hz;
  2. the content rule from Section 2.7 with factor ∈ {0.5, 0.7, 0.9};
  3. 12 versus 24 dB/octave slopes.
- **Measure.** Energy-share error in 20–60, 60–120 and 120–250 Hz against `Y`; P_low; the kick and bass transient check (band crest factor 40–100 Hz must not drop).
- **Success.** Lower low-band error with kick and bass punch unchanged.

**E9. Compression amount and ballistics**

- **Hypothesis.** Light compression (ΔLRA ≤ 3 LU) is closest to his mixes and to listener preference [R2, R26]. Flux-driven attack and release [R27, R28] and tempo-synced release [R2 Table 2.1] beat fixed times on punch.
- **Change.**
  - Per-role gain-reduction sweep {0, 0.5, 1, 1.5} × GR_role.
  - Attack: fixed versus the crest- or flux-driven rule in Section 2.4.
  - Release: fixed versus k × beat.
- **Measure.** Mix PLR, LRA, crest factor (100 ms and 1 s) and LDR against `Y`, at matched loudness. Per-role "punch in mix": band-limited transient rise for kick (40–100 Hz), snare (150–250 Hz and 2–5 kHz) and vocal consonants. Hard check: track 100 ms crest factor ≥ input.
- **Success.** Dynamics features within 1 dB or 1 LU of his; no punch regression.

**E10. Bus processing and final loudness per picture**

- **Hypothesis.** B's glue at ≤ 2 dB gain reduction and A's peak catcher at ≤ 1–2 dB gain reduction keep PLR within 1 dB of his pre-master mix. A higher setting moves away from both his mix and listener preference [R2, R34].
- **Change.**
  - B glue: 2:1, gain reduction ∈ {1, 2, 3} dB, attack ∈ {10, 30} ms, release ∈ {0.1, 0.3, auto}.
  - A limiter: ceiling −1 dBTP, gain reduction ∈ {0, 1, 2} dB.
  - C: no compression.
  - Output loudness options: fixed −14 or −16 LUFS versus "his loudness".
- **Measure.** PLR, true peak, LRA and crest factor against `Y` (or his pre-master); spectral tilt change caused by the bus; picture-envelope checks (A drier and denser, C wider).
- **Success.** PLR within 1 dB, true peak ≤ −1 dBTP, and no clipping.

**Loop hygiene** [proposal]:

- Never tune on the held-out stretch.
- Freeze the literature priors as the w = 0 fallback.
- Keep every nightly result keyed to the exact rule-set hash, so a regression can be traced and reverted.
- Re-check the full 10-second time budget after each accepted change. Analysis on a 20–30 s stretch must leave room for rendering.

---

## 7. References

Each entry gives authors, year, title, venue and URL, followed by the verification mark for this survey.

- **[R1]** B. De Man, J. D. Reiss, R. Stables (2017). "Ten years of automatic mixing." Proc. 3rd Workshop on Intelligent Music Production (WIMP), Salford. https://www.open-access.bcu.ac.uk/4968/1/WIMP2017_DeManEtAl.pdf **[read]**
- **[R2]** B. De Man (2017). "Towards a better understanding of mix engineering." PhD thesis, Queen Mary University of London. Record: https://qmro.qmul.ac.uk/xmlui/handle/123456789/25814. PDF read from the author's site repository: https://raw.githubusercontent.com/BrechtDeMan/BrechtDeMan.github.io/master/publications/pdf/PhD-thesis.pdf **[read]**: ch. 2 (KEAMS rules and test), §3.2 (test design), §4.1–4.3 (features, preference, comments), Table 6.1, App. A.
- **[R3]** B. De Man, B. Leonard, R. King, J. D. Reiss (2014). "An analysis and evaluation of audio features for multitrack music mixtures." Proc. 15th ISMIR, Taipei, pp. 137–142. https://archives.ismir.net/ismir2014/paper/000293.pdf **[read]**
- **[R4]** B. De Man, K. McNally, J. D. Reiss (2017). "Perceptual evaluation and analysis of reverberation in multitrack music production." J. Audio Eng. Soc. 65(1/2):108–116, doi:10.17743/jaes.2016.0062. https://dspace.library.uvic.ca/items/274cc3b0-af9d-4da7-81a6-8204cf48e65f **[read]**
- **[R5]** B. De Man, J. D. Reiss (2017). "The Mix Evaluation Dataset." Proc. DAFx-17, Edinburgh. https://raw.githubusercontent.com/BrechtDeMan/BrechtDeMan.github.io/master/publications/pdf/DAFx-17.pdf **[abstract]**
- **[R6]** B. De Man, J. D. Reiss (2013). "A knowledge-engineered autonomous mixing system." AES 135th Convention, paper 8961. https://aes2.org/publications/elibrary-page/?id=17011 **[abstract]**; content read via [R2] ch. 2.
- **[R7]** A. Wilson, B. M. Fazenda (2015). "Navigating the mix-space: theoretical and practical level-balancing technique in multitrack music mixtures." Proc. 12th Sound and Music Computing Conf. (SMC 2015). https://zenodo.org/records/851115 **[read]**
- **[R8]** G. Wichern, A. Wishnick, A. Lukin, H. Robertson (2015). "Comparison of loudness features for automatic level adjustment in mixing." AES 139th Convention, paper 9370. https://aes2.org/publications/elibrary-page/?id=17928 **[abstract]**
- **[R9]** P. D. Pestana, J. D. Reiss (2014). "Intelligent audio production strategies informed by best practices." AES 53rd Int. Conf. (Semantic Audio), paper S2-2. https://aes2.org/publications/elibrary-page/?id=17121 **[abstract]**; findings only as cited in [R2] and [R4]; full text bot-blocked.
- **[R10]** P. D. Pestana, J. D. Reiss, A. Barbosa (2013). "Loudness measurement of multitrack audio content using modifications of ITU-R BS.1770." AES 134th Convention. Cited via [R3] **[read in R3]**; no direct URL opened.
- **[R11]** J. Shi, K. Xie, Y. Ma, J. D. Reiss (2025). "A scalable two-stage automatic mixing system integrating machine learning and domain knowledge." AES 159th Convention, paper 10232 (citation as given in [R12]). Code: https://github.com/SparrowReivun/AES2025-materials. Archive: https://zenodo.org/records/17171082 **[abstract]**
- **[R12]** J. Shi, W. Hua, K. Xie, M. Li, Y. Liu, J. D. Reiss (2026). "Understanding automatic mixing: a subtask-oriented analysis of two-stage mixing system." Accepted at ISMIR 2026; arXiv:2609.02835. https://arxiv.org/abs/2609.02835 **[read]**
- **[R13]** D. Ronan, Z. Ma, P. Mc Namara, H. Gunes, J. D. Reiss (2018). "Automatic minimisation of masking in multitrack audio using subgroups." arXiv:1803.09960. https://arxiv.org/abs/1803.09960 **[read]**
- **[R14]** J. Scott, Y. E. Kim (2013). "Instrument identification informed multi-track mixing." Proc. 14th ISMIR. https://archives.ismir.net/ismir2013/paper/000200.pdf **[read]**
- **[R15]** E. Deruty, F. Pachet, P. Roy (2014). "Human-made rock mixes feature tight relations between spectrum and loudness." J. Audio Eng. Soc. 62(10):643–653. https://aes2.org/publications/elibrary-page/?id=17542 **[abstract]**
- **[R16]** J. D. Reiss, S. Mansbridge, A. Clifford, Z. Ma, S. Hafezi, N. Jillings (2017). "System and method for autonomous multi-track audio processing." US Patent 9,654,869 B2 (LANDR Audio Inc.; Queen Mary University of London), priority 2012-05-08. https://patents.google.com/patent/US9654869 **[read]** (description, first ~100k characters)
- **[R17]** E. Perez Gonzalez, J. D. Reiss (2010). "A real-time semiautonomous audio panning system for music mixing." EURASIP J. Adv. Signal Process. 2010:436895. https://asp-eurasipjournals.springeropen.com/articles/10.1155/2010/436895 **[abstract]**
- **[R18]** S. Mansbridge, S. Finn, J. D. Reiss (2012). "An autonomous system for multitrack stereo pan positioning." AES 133rd Convention. Listed in [R1]; https://csteinmetz1.github.io/AutomaticMixingPapers/ **[abstract/listing]**
- **[R19]** S. Mansbridge, S. Finn, J. D. Reiss (2012). "Implementation and evaluation of autonomous multi-track fader control." AES 132nd Convention. Listed in [R1]; https://csteinmetz1.github.io/AutomaticMixingPapers/ **[listing]**
- **[R20]** P. D. Pestana, J. D. Reiss (2014). "A cross-adaptive dynamic spectral panning technique." Proc. DAFx-14, Erlangen. https://dafx14.uni-erlangen.de/papers/dafx14_pedro_d._pestana_a_cross_adaptive_dynamic_.pdf **[read]**
- **[R21]** J. P. Wakefield, C. Dewey (2015). "An investigation into the efficacy of methods commonly employed by mix engineers to reduce frequency masking in the mixing of multitrack musical recordings." AES 138th Convention, Warsaw. https://eprints.hud.ac.uk/id/eprint/25979 **[abstract]**
- **[R22]** S. Hafezi, J. D. Reiss (2015). "Autonomous multitrack equalization based on masking reduction." J. Audio Eng. Soc. 63(5). https://aes2.org/publications/elibrary-page/?id=17637 **[abstract]**
- **[R23]** P. D. Pestana, Z. Ma, J. D. Reiss, A. Barbosa, D. A. A. Black (2013). "Spectral characteristics of popular commercial recordings 1950–2010." AES 135th Convention. https://aes2.org/publications/elibrary-page/?id=17010 **[abstract]**
- **[R24]** A. Elowsson, A. Friberg (2017). "Long-term average spectrum in popular music and its relation to the level of the percussion." AES 142nd Convention, paper 9762. https://aes2.org/publications/elibrary-page/?id=18638 **[abstract]**
- **[R25]** Z. Ma, J. D. Reiss, D. A. A. Black (2013). "Implementation of an intelligent equalization tool using Yule-Walker for music mixing and mastering." AES 134th Convention. Listed in [R1] **[listing]**
- **[R26]** J. A. Maddams, S. Finn, J. D. Reiss (2012). "An autonomous method for multi-track dynamic range compression." Proc. DAFx-12, York. https://www.dafx.de/paper-archive/2012/papers/dafx12_submission_6.pdf **[read]**
- **[R27]** D. Giannoulis, M. Massberg, J. D. Reiss (2013). "Parameter automation in a dynamic range compressor." J. Audio Eng. Soc. 61(10):716–726. https://aes2.org/publications/elibrary-page/?id=16965 **[abstract]**
- **[R28]** M. Hilsamer, S. Herzog (2014). "A statistical approach to automated offline dynamic processing in the audio mastering process." Proc. DAFx-14. https://www.dafx14.fau.de/papers/dafx14_marcel_hilsamer_a_statistical_approach_to.pdf **[read]**
- **[R29]** Z. Ma, B. De Man, P. D. Pestana, D. A. A. Black, J. D. Reiss (2015). "Intelligent multitrack dynamic range compression." J. Audio Eng. Soc. 63(6):412–426, doi:10.17743/jaes.2015.0053. https://aes2.org/publications/elibrary-page/?id=17821 **[abstract]**
- **[R31]** E. T. Chourdakis, J. D. Reiss (2017). "A machine learning approach to application of intelligent artificial reverberation." J. Audio Eng. Soc. 65(1/2):56–65. https://aes2.org/publications/elibrary-page/?id=18543 **[abstract]**
- **[R32]** M. Torcoli, A. Freke-Morin, J. Paulus, C. Simon, B. Shirley (2019). "Background ducking to produce esthetically pleasing audio for TV with clear speech." AES 146th Convention; journal version JAES 67(12), 2019. https://cris.fau.de/publications/221136558 **[abstract]**
- **[R33]** A. Mourgela, E. Quinton, S. Bissas, J. D. Reiss, D. Ronan (2024). "Exploring trends in audio mixes and masters: insights from a dataset analysis." AES 157th Convention; arXiv:2412.03373. https://arxiv.org/abs/2412.03373 **[abstract]**
- **[R34]** A. Wilson, B. M. Fazenda (2016). "Perception of audio quality in productions of popular music." J. Audio Eng. Soc. 64(1/2):23–34. https://salford-repository.worktribe.com/output/1407562 **[abstract]**
- **[R35]** A. Wilson, B. M. Fazenda (2016). "Variation in multitrack mixes: analysis of low-level audio signal features." J. Audio Eng. Soc. 64(7/8); with "101 mixes" (2015). https://salford-repository.worktribe.com/output/1401896 **[abstract]**
- **[R36]** C. J. Steinmetz, J. Pons, S. Pascual, J. Serrà (2021). "Automatic multitrack mixing with a differentiable mixing console of neural audio effects." ICASSP 2021; arXiv:2010.10291. https://arxiv.org/abs/2010.10291 **[read]**
- **[R37]** M. A. Martínez-Ramírez, W.-H. Liao, G. Fabbro, S. Uhlich, C. Nagashima, Y. Mitsufuji (2022). "Automatic music mixing with deep learning and out-of-domain data." ISMIR 2022; arXiv:2208.11428. https://arxiv.org/abs/2208.11428 **[read]**; repo README read for IR guidance.
- **[R38]** J. Koo, M. A. Martínez-Ramírez, W.-H. Liao, S. Uhlich, K. Lee, Y. Mitsufuji (2023). "Music mixing style transfer: a contrastive learning approach to disentangle audio effects." ICASSP 2023; arXiv:2211.02247. https://arxiv.org/abs/2211.02247 **[read]** (partial)
- **[R39]** S. S. Vanka, C. J. Steinmetz, J.-B. Rolland, J. D. Reiss, G. Fazekas (2024). "Diff-MST: Differentiable mixing style transfer." ISMIR 2024; arXiv:2407.08889. https://arxiv.org/abs/2407.08889 **[read]**
- **[R40]** C. J. Steinmetz, S. Singh, M. Comunità, I. Ibnyahya, S. Yuan, E. Benetos, J. D. Reiss (2024). "ST-ITO: Controlling audio effects for style transfer with inference-time optimization." ISMIR 2024; arXiv:2410.21233. https://arxiv.org/abs/2410.21233 **[read]** (HTML)
- **[R41]** S. Lee, M. A. Martínez-Ramírez, W.-H. Liao, S. Uhlich, G. Fabbro, K. Lee, Y. Mitsufuji (2024). "Searching for music mixing graphs: a pruning approach." DAFx 2024; arXiv:2406.01049. https://arxiv.org/abs/2406.01049 **[read]**
- **[R42]** S. Lee, M. A. Martínez-Ramírez, W.-H. Liao, S. Uhlich, G. Fabbro, K. Lee, Y. Mitsufuji (2025). "Reverse engineering of music mixing graphs with differentiable processors and iterative pruning." JAES (per arXiv comment); arXiv:2509.15948. https://arxiv.org/abs/2509.15948 **[read]** (HTML, first 100k characters)
- **[R43]** E. Moliner, M. A. Martínez-Ramírez, J. Koo, W.-H. Liao, K. W. Cheuk, J. Serrà, V. Välimäki, Y. Mitsufuji (2025). "Automatic music mixing using a generative model of effect embeddings" (MEGAMI). arXiv:2511.08040 (cited as ICASSP 2026). https://arxiv.org/abs/2511.08040 **[read]** (HTML)
- **[R44]** Y. Zong, J. Shi, J. D. Reiss (2026). "Diff2Mix: controllable music mixing via diffusion models and differentiable audio effects." Accepted at ISMIR 2026; arXiv:2608.05442. https://arxiv.org/abs/2608.05442 **[read]** (HTML)
- **[R45]** Y.-T. Yeh et al. (2026). "Rethinking automatic music mixing as sequential stem blending." arXiv:2608.05506. https://arxiv.org/abs/2608.05506 **[read]** (HTML). Full author list UNVERIFIED.
- **[R46]** Y.-T. Yeh, J. Koo, M. A. Martínez-Ramírez, W.-H. Liao, Y.-H. Yang, Y. Mitsufuji (2025). "Fx-Encoder++: extracting instrument-wise audio effects representations from mixtures." ISMIR 2025; arXiv:2507.02273. https://arxiv.org/abs/2507.02273 **[abstract]**
- **[R47]** S. Doh, J. Koo, et al. (2026). "LLM2Fx-Tools: tool calling for music post-production." ICLR 2026; arXiv:2512.01559. https://arxiv.org/abs/2512.01559 **[abstract]**
- **[R48]** J. T. Colonel, J. D. Reiss (2021). "Reverse engineering of a recording mix with differentiable digital signal processing." J. Acoust. Soc. Am. 150(1):608. https://pubs.aip.org/asa/jasa/article/150/1/608/606638 **[listing only]**
- **[R49]** J. T. Colonel, J. D. Reiss (2023). "Reverse engineering a nonlinear mix of a multitrack recording." J. Audio Eng. Soc. 71(9):586–595. https://aes2.org/publications/elibrary-page/?id=22917 **[abstract]**
- **[R50]** S. S. Vanka, M. Safi, J.-B. Rolland, G. Fazekas (2024). "The role of communication and reference songs in the mixing process: insights from professional mix engineers." J. Audio Eng. Soc. 72(1/2); arXiv:2309.03404. https://arxiv.org/abs/2309.03404 **[abstract]**. Context: most engineers use reference songs (90% use more than one) and aim to match the *feel*, not to copy the mix. This supports scoring against his mix on broad dimensions rather than waveform identity.
- **[R51]** ITU-R (2015). Recommendation BS.1534-3, "Method for the subjective assessment of intermediate quality level of audio systems" (MUSHRA). https://www.itu.int/rec/R-REC-BS.1534 (standard; not re-read; its properties as summarised in [R2 §3.2, read])
- **[R52]** EBU (2020). R 128, "Loudness normalisation and permitted maximum level of audio signals", with EBU Tech 3342 (loudness range). https://tech.ebu.ch/publications/r128 (standard; not re-read; LRA use as described in [R26, read])
- **[R53]** iZotope Inc. (now Native Instruments USA). US Patent 10,396,744 B2, "Systems and methods for identifying and remediating sound masking." https://patents.google.com/patent/US10396744 **[abstract]**
- **[R54]** C. J. Steinmetz, S. S. Vanka, M. A. Martínez-Ramírez, G. Bromham (2022). "Deep learning for automatic mixing." ISMIR 2022 tutorial. https://github.com/dl4am/tutorial (repo and licence **[read]**). Author list as commonly cited: UNVERIFIED.
- **[R56]** SigSep. "MUSDB18" dataset page (access and licence terms). https://sigsep.github.io/datasets/musdb.html **[read]**

GitHub licence checks in Section 4 were made with `gh api repos/<owner>/<repo>/license`, reading the decoded licence file text, on 2026-10-23. Hugging Face weight sizes and licence tags come from `https://huggingface.co/api/models/<id>?blobs=true`. MEGAMI release sizes come from the GitHub releases API.
