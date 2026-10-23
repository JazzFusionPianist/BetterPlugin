# Patent landscape: rough mix and mix doctor

Checked 2026-10-23. Engineering design-around research for the DAW's planned **rough mix** and **mix doctor**.

> **This is not legal advice.** It is an engineer's reading of public patent records, written to steer the design. Claim scope is decided by courts, and claim construction, doctrine-of-equivalents risk, validity and the legal status in each country all need a patent attorney (US, plus KR and EP/UK if we sell there) before launch. Status data comes mostly from Google Patents, which says its own status field is "an assumption and not a legal conclusion". Anything marked **UNVERIFIED** I could not confirm from a primary page.

How expiry is estimated: a US utility patent runs 20 years from its earliest non-provisional US or PCT filing date, plus any patent term adjustment (PTA), and lapses early if a maintenance fee (due at 3.5, 7.5 and 11.5 years after grant, with a 6-month surcharge grace) goes unpaid. EP, KR and JP patents run 20 years from filing if annual fees are paid in each country.

---

## 0. Short answer

| Risk | Patent | Owner | Live until (est.) | What it touches |
|---|---|---|---|---|
| **HIGH** | US 9,654,869 B2 (+ GB 2503867 B) | LANDR Audio (with Queen Mary Univ. of London) | 2033-10-10 (US), 12th-year fee due by 2028-11-16 | The whole rough mix: per-track features + single-track and cross-track rules → set processing. Claim 1 is very broad. |
| **HIGH** | US 10,396,744 B2, US 10,972,065 B2, US 10,763,812 B2, US 11,469,731 B2 | Native Instruments USA (ex-iZotope) | 2038-05-24 (all four) | Any masking measure that compares a track's loudness alone against its loudness with the others present (partial loudness / "loudness loss"), then fixes it or **lists** it. Hits version A carving, version C keyed EQ, mix doctor's masking list. |
| **HIGH** | US 8,929,561 B2 | Apple | ~2031-03 (status UNVERIFIED) | Priority-based "dynamic masking": find a band two tracks share, attenuate the lower-priority one there. That is version C's keyed dynamic EQ, and frequency-specific ducking in B. |
| **HIGH** | US 11,687,314 B2 | Waves Audio | ~2041-05 (status from search snippet) | Learning processing from a human mixer's work (raw tracks + his individually processed tracks), storing the learned operations in a database, recommending from it. Touches "targets learned from the owner's past mixes". |
| MED-HIGH | US 9,304,988 B2 (+ EP 3039674 B1, JP 6585049 B2, CA 2887124 C) | LANDR Audio | ~2034-08 (fee status UNVERIFIED) | Semantic info (instrument class, numeric features, production goals) → look up reference records in a database → assign processing / target features. Touches role → learned per-role targets. |
| MED | US 9,031,243 B2 | Native Instruments USA (ex-iZotope) | 2031-10-09 (12th-year fee open now) | Audio classifier → sound-object label → control events that configure processing. Touches using the YAMNet role to drive the rough mix. |
| MED | US 9,672,806 B2; EP 4247011 A1 (pending) | Fraunhofer | ~2032-02 (status UNVERIFIED); EP pending | Closed-loop reverb level from a perceptual loudness model; EP application claims reverb gain set from the input signal. Touches reverb/delay sends set from measurements. |
| MED | US 8,965,774 B2 | Apple | ~2031-08 (fee status UNVERIFIED) | Compressor ratio from detected (peak/floor) range vs target range. Touches auto compression. |
| MED | US 9,954,507 B2 / US 10,050,596 B2 | Adobe | ~2036-08 (status UNVERIFIED) | Compressor/gate threshold from averages of an audio file (mean of min and max averages; ratio by threshold bins; stereo common threshold). |
| MED | US 10,635,389 B2 | Native Instruments USA (ex-iZotope) | 2038-05-24 | Source-ID presets then spectral tweak, with **multiband crossover placed at the edges of a peak region**. Touches auto compression only if we place crossovers that way. |
| LOW-MED | US 12,456,493 B2 | Dolby | ~2041 (PCT filed 2021-06-16) | Neural controller network + neural transformation network that mixes. Touches us only if a neural net applies the processing. |
| LOW-MED | US 12,598,441 B2 | Yamaha | ~2043-06 | Set a channel's input (head-amp) gain from its own level **and** its fader from another channel's data. |
| LOW-MED | US 12,563,360 B2 | Northwestern University | ~2043-02 | A specific masking display (other tracks drawn at a distance set by masking). Touches the mix doctor UI. |
| LOW-MED | US 11,430,463 B2 | Dolby Laboratories Licensing Corp. and Dolby International AB | ~2039-07 (status UNVERIFIED) | Frame-by-frame band gains mapping a signal's level distribution to a target spectral profile (dynamic match EQ). |
| LOW-MED | US 10,248,380 B2 / US 10,248,381 B2 | Native Instruments USA (ex-iZotope) | ~2038 (status UNVERIFIED) | Auto input gain into a window with a peak-headroom rule; '381 adds instrument ID (guitar/voice vs bass/drum). |
| LOW-MED | US 11,581,970 B2 | Lucasfilm | ~2041-04 (UNVERIFIED) | Trained model turns a mix's features + metadata into console settings for a new version. Touches a mix doctor driven by a trained model. |
| LOW | US 12,069,464 B2 | Dolby | ~2040-07 | Mastering by superimposing per-time-frequency-tile differences (mastered vs rendered) onto stems. |
| LOW | US 11,327,710 B2 | Adobe | ~2037-11 (status UNVERIFIED) | Auto-ducking keyframes computed with a summed-area table. |
| LOW | US 8,976,979 B2 | Dolby | ~2030 (status UNVERIFIED) | Dynamic EQ toward a user-blended preset profile in specific loudness. |
| LOW | US 9,350,312 B1 | Native Instruments USA (ex-iZotope) | ~2034-09 (fee status UNVERIFIED) | Gain envelope by histogram-matching level statistics to a target. |
| LOW | US 9,640,163 B2 / US 11,132,984 B2 | DTS | ~2034 | Surround (3+ channel) mix of stems by rule engine on voice + genre. Not stereo. |
| LOW | US 10,944,999 B2 | Dolby | ~2037-07 | Server-side leveling from rehearsal recordings. |

**Main design-around moves** (detail in section 4):

1. Measure masking as **co-activity of two tracks' own levels** (each measured alone, per band and per bar), never as "how much quieter A gets when B plays". No partial loudness, no loudness loss, no excitation patterns.
2. **No frequency-specific keyed ducking chosen by the software** (version C as written, and any band-limited ducking in B). Use broadband sidechain compression (decades old) and static complementary EQ instead, or let the user pick the band.
3. Learn from the owner's past songs using **only raw multitracks + the final stereo mix** (never his individually processed stems), with no neural network that applies processing, no stored per-song records to be matched at run time, and no per-tile difference maps.
4. Role for processing comes from a **user-set role field** (the classifier may only suggest a name/order), until US 9,031,243 is gone.
5. Compression and reverb from **open-loop role presets** plus percentile-based thresholds, not from the formulas above.
6. LANDR US 9,654,869 has no clean element to drop while keeping an automatic multi-track rough mix. Under the owner's rule this means: in the US (and UK) either ship the rough mix in a "measure and suggest, the user turns the knob" form, wait for expiry/lapse, or license. The mix doctor in diagnosis-only form is outside it.

---

## 1. The two named patents

### 1.1 US 9,654,869 B2 — "System and method for autonomous multi-track audio processing"

| | |
|---|---|
| Owner | LANDR Audio Inc. (Google lists Queen Mary University of London as co-current assignee; recorded chain: inventors → Queen Mary → Mixgenius Inc. → renamed LANDR Audio Inc., 2015) |
| Inventors | Joshua D. Reiss, Stuart Mansbridge, Alice Clifford, Zheng Ma, Sina Hafezi, Nicholas Jillings |
| Priority | GB 1208012.3, 2012-05-08 |
| Filed | 2013-05-07 (US national stage of PCT/GB2013/051184, appl. US 14/398,990) |
| Granted | 2017-05-16 |
| Status | **Active.** 4th-year fee paid 2020-09-17, 8th-year fee paid 2024-08-15 (small entity). |
| Expiry | Adjusted expiration **2033-10-10** (20 years from 2013-05-07 plus about 156 days PTA). The 12th-year fee window is 2028-05-16 to 2028-11-16 (grace with surcharge to 2029-05-16); if unpaid it would lapse 2029-05-16. |
| Family | GB 2503867 B (granted 2016-12-21; GB renewal status **UNVERIFIED**; at most to 2032-05-08), WO 2013/167884 A1. **No EP, KR, JP or CN member** in the DOCDB family, and no US continuation. |

**Independent claim.** Only claim 1 is independent. Claims 29 (apparatus) and 30 (computer-readable medium) perform "the method of claim 1", so they carry the same elements. Claim 1, element by element (close paraphrase that keeps every limitation):

- **1a** receiving at least one audio track;
- **1b** extracting at least one feature from each audio track;
- **1c** enabling a configuration for each of at least one processing control function for the track(s) to be controlled;
- **1d** processing each track with the processing control function configured for that track, in accordance with the extracted feature(s);
- **1e** outputting at least one processed track;
- **1f** wherein the processing control function is determined in accordance with **a plurality of processing rules**, at least one rule provided **for one audio track** and at least one rule provided **for a plurality of audio tracks**.

Dependent claims show how wide claim 1 is meant to be. Offline use is covered (real-time is only dependent claim 27), and static parameters are covered (dynamic is only claim 28). Claim 18 names loudness, loudness range, spectral masking, spectral centroid, spatial masking, spectral balance and crest factor as features. Claim 19 sets level from the average loudness of the active tracks. Claims 20–25 cover panning: pan from frequency content (higher content further out, claim 21), the two tracks with the closest spectra panned to opposite sides (22), the spectral centre of the mix kept within limits (23), the L/R peak ratio kept within limits (24), and the pan width optimised (25). Claims 7–11 cover mastering by spectral shaping over bands. Claim 6 covers configuration from source recognition, genre and subgroups.

**Which planned methods could fall under claim 1**

| Planned method | 1a | 1b | 1c/1d | 1e | 1f | Reading |
|---|---|---|---|---|---|---|
| Rough mix, any version (fader, pan, EQ, comp, sends, bus comp, low cut, mono lows set from loudness/spectrum/crest/masking + role) | yes | yes (per-track measurements) | yes | yes | yes: role rules are per-track, masking/balance rules are cross-track | **Inside claim 1** on a plain reading. Offline, static, "in seconds" does not help (claims 27 and 28 are only dependent). |
| Version A (EQ carving between overlapping tracks) | yes | yes | yes | yes | yes (pair rule + per-track rules) | Inside. |
| Version B (shared room, ducking, glue) | yes | yes | yes | yes | yes | Inside. |
| Version C (wide panning, keyed dynamic EQ) | yes | yes | yes | yes | yes | Inside; panning by frequency content also meets dependent claims 20–25. |
| Mix doctor, diagnosis and list only | yes | yes | **no processing** | no | n/a | **Outside** (nothing is processed). |
| Mix doctor, one-click "apply fix" with computed values | yes | yes | yes | yes | depends on how many rules shaped that one control | At risk; see option (c) below. |

**Design-around options.** No element of claim 1 can be cleanly removed from an *automatic* multi-track rough mix: every version extracts per-track features (1b), sets processing from them (1d), and mixes per-track rules (role) with cross-track rules (balance, masking) (1f). These are the realistic options, strongest first:

- **(a) Do not ship automatic setting in the US and UK until the patent ends** (2033-10-10 US, earlier if the 12th-year fee is not paid by 2028-11-16 / 2029-05-16; GB by 2032-05-08 at the latest). Korea, the EU outside the UK, and Japan have no family member, so this patent does not reach sales there. Note that a download sold to US customers counts as a US sale; a region switch has to be real.
- **(b) "Measure and suggest; the user turns the knob."** The rough mix shows each track's measurements against the owner's targets (for example "vocal 3.5 dB under your usual, 2.1 kHz overlap with guitar L"), and the user moves the controls himself. Then no processing control function is "determined in accordance with a plurality of processing rules" by the system, so 1d/1f are not done by our software. This keeps the analysis but loses the "in seconds" automatic part. It is the cleanest option that still ships something.
- **(c) One rule per control (weaker).** Each control is set by exactly one rule. The vocal fader comes only from a balance rule; the vocal low cut only from a per-role rule; no single control is shaped by both a per-track rule and a cross-track rule. This argues that no processing control function is determined by "a plurality of rules" of both kinds (1f). It is a claim-construction argument, not a structural absence, because "the at least one processing control function" may be read collectively. Do not rely on it without counsel.
- **(d) Single-track rules only (weaker, guts the feature).** Every setting comes from the track's own measurements and an absolute per-role target, with no cross-track rule (no relative balance, no masking carving). Risk remains that one rule applied to many tracks counts as "a rule provided for a plurality of audio tracks".
- **(e) License from LANDR, or invalidity opinion.** Claim 1 is broad and older automatic mixers exist. For example US 7,526,348 B1 (filed 2000) scales several files from each file's peak and mean relative to the others, and Perez-Gonzalez & Reiss published cross-adaptive automatic gain, panning and EQ in 2007–2010. Treating claim 1 as invalid is counsel's decision, not an engineering one. Under the owner's rule, assume it is valid.

Whatever is chosen, also avoid the specific panning rules of claims 20–25. Pan from a fixed role convention (kick, bass, snare, lead vocal centre; doubles opposite; overheads by drummer's view), not from spectral content, closest-spectrum pairing, spectral-centre balancing or L/R peak-ratio balancing. That narrows exposure if claim 1 were ever found to be met.

### 1.2 US 10,396,744 B2 — "Systems and methods for identifying and remediating sound masking" (and its family)

| | |
|---|---|
| Owner | Native Instruments USA, Inc. (iZotope, Inc. renamed, recorded 2023-10-23). An IP security agreement in favour of Lucid Trustee Services Ltd was recorded 2021-06-30. |
| Inventors | James McClellan, Gordon Wichern, Hannah Robertson, Aaron Wishnick, Alexey Lukin, Matthew Hines, Nicholas LaPenn |
| Priority | US provisional 62/516,601, 2017-06-07; PCT/US2018/034336 filed 2018-05-24 (WO 2018/226418 A1) |
| Filed / granted | US 16/250,486 filed 2019-01-17 (bypass continuation of the PCT); granted 2019-08-27 |
| Status | **Active.** 4th-year fee paid late with surcharge 2023-06-30 (large entity). The 8th-year fee window opened 2026-08-27 (due by 2027-02-27). |
| Expiry | **2038-05-24** (20 years from the PCT filing; no PTA shown) |
| US family (same priority, same expiry, all active) | **US 10,763,812 B2** (appl. 16/512,257, granted 2020-09-01, 4th-year fee paid 2024-04-02); **US 10,972,065 B2** (16/903,045, granted 2021-04-06, fee paid 2024-10-07); **US 11,469,731 B2** (17/193,986, granted 2022-10-11, fee paid late 2026-04-16). Pre-grant publications US 2019/0158052, 2019/0341898, 2020/0403592, 2021/0234524. |
| Non-US family | Only WO 2018/226418 A1. **No EP, KR, JP or CN member** in the DOCDB family. |

**Independent claims.** There are four patents and five independent claim sets. Element by element:

**US 10,396,744 claim 1** (method). This is the only independent claim; claims 2–15 depend on it.
- (A) receive a multi-track recording with ≥2 tracks synchronised over a time interval; first and second tracks hold sound from **different instruments**;
- (B) determine the loudness of the first recording **at each of a plurality of frequencies** in a particular time period;
- (C) determine the loudness of the second recording at each of those frequencies in that period;
- (D) determine a **partial loudness** of the first recording at a first frequency in that period, based at least in part on the second recording's loudness at that frequency from (C);
- (E) determine a **loudness loss** for the first recording at that frequency and period, based at least in part on the partial loudness from (D);
- (F) create a processed multi-track recording by applying one or more measures based on the loudness loss from (E).
- Notable dependents: excitation patterns (2), variable-resolution FFT (3), audibility and extreme-loudness thresholds (4), masking threshold from a psychoacoustic model (6–7), phons with loss = loudness − partial loudness (9), a GUI that shows the loss and lets the user fix it with filtering/mixing/EQ/attenuating/amplifying/panning/compressing/phase rotation (10–11), user-specified fixes (13), automatic fixes (14).

**US 10,972,065 claim 1** (computer-readable medium) and **claim 2** (apparatus): the same (A)–(F) as above, in medium and processor form.

**US 10,763,812 claims 1 (method), 12 (medium), 13 (system)**, all the same steps:
- (A) identify **a plurality of sound-masking events**, each event being sound in a first recording, in a time period and frequency range, masked by sound in a second recording in the same period and range. Each event has a **loudness loss** giving its magnitude, based at least in part on the difference between the first recording's loudness **in isolation** and its **partial loudness** when concurrent with the second;
- (B) identify a **subset** of events with greater loudness loss than the others;
- (C) cause a representation of that subset to be **displayed** on a GUI.
- Dependents: percentile cut-offs (99/95/90/80th), a bar graph of event counts per frequency range, EQ controls, and a threshold control for how many events are shown.

**US 11,469,731 claim 1** (method; claim 23 is the apparatus and claim 24 the medium, both performing the method of claim 1). This is the broadest:
- (A) receive at least one recording with sound from a plurality of instruments in a time interval (a first instrument and at least one other);
- (B) determine a **first loudness of the first instrument absent** the other instrument(s), in at least one frequency range in a time period;
- (C) determine a **second loudness of the first instrument in the presence of** the other(s), in the same range and period;
- (D) **compare** the first and second loudness;
- (E) apply one or more measures to the recording in that range and period, based at least in part on the comparison.
- Dependents: the other instrument's sound may include an applied **effect such as reverb** (8); partial loudness (9–11); loudness loss in phons (12–13); the range where the first instrument's energy is greatest (14); a difference that exceeds an amount or lasts a time (15–18); the same list of fixes (19); a GUI (20–21).

**Which planned methods could fall under them**

| Planned method | '744 / '065 (A–F) | '731 (A–E) | '812 (A–C) |
|---|---|---|---|
| "Masking between pairs" measured as how much of track A is lost or hidden when B plays (psychoacoustic or not) | yes, if partial loudness / loudness loss is computed | **yes**: any "A alone vs A with B present" loudness comparison, psychoacoustic or not | — |
| Rough mix A: EQ carving driven by that measure | yes (F) | yes (E) | — |
| Rough mix C: keyed dynamic EQ placed where that measure says tracks overlap | yes | yes | — |
| Rough mix B: reverb or delay judged by how much it hides the dry vocal | — | yes (claim 8 covers effects) | — |
| Mix doctor: list the worst masking by bar range | — | — | **yes** if the ranking quantity is a loudness loss (isolation vs concurrent partial loudness). Display alone is enough; no processing is needed. |
| Mix doctor: "apply fix" for masking | yes | yes | — |
| Mix doctor: "vocal too quiet / buried" judged by vocal-in-mix vs vocal-alone loudness | — | yes | yes if listed as masking events |

**Design-around options**

- **DA-1: co-activity masking metric (main option).** Measure each track **only by itself**: band energies per bar on a fixed set of bands (say 1/3-octave or 24 bands), from the track rendered alone. Call it an overlap when, in the same band and the same bars, *both* tracks are active and close in level. For example: both are above their own long-term band average, the level difference is within N dB, and this holds for at least M bars. Score overlap with something symmetric, such as min(Ea, Eb) or the count of co-active band-bars. This removes:
  - '744/'065 (D) and (E): no partial loudness and no loudness loss is computed;
  - '731 (C) and (D): no "loudness of the first instrument in the presence of the other" is computed, and nothing is compared with it. We compare A's level with B's level, both measured alone, which is a different comparison from A-alone vs A-with-B;
  - '812 (A): events carry no loudness-loss magnitude.

  To keep the doctrine-of-equivalents argument clean, do not use excitation patterns, specific loudness, phons or sones, masking thresholds or a partial-loudness model anywhere in the masking path. Do not name or show the quantity as "loudness loss", "masked amount" or "how much is hidden". Do not compute "track share of the mix in a band" (track ÷ mix) as a stand-in for partial loudness.
- **DA-2: rank and list by co-activity, not by loss.** The mix doctor lists "guitar L and vocal both strong at 2–3 kHz, bars 17–32" ranked by co-activity score or by duration. It does not show "vocal loses 4 phon here". This avoids '812 even for display.
- **DA-3: "buried vocal" as a level relation, not a loss.** Judge "too quiet" from the vocal's own loudness against the sum of the other tracks' loudness (each rendered without the vocal), compared with the owner's learned relation. Never compute the vocal's loudness "in the presence of" the others.
- **DA-4: no reverb-masking analysis.** Set reverb sends from role presets (section 4), so claim 8 of '731 never comes up.
- Caveat: DA-1 detects overlap from "both tracks above a level in the same band". That is close to an element of Apple US 8,929,561 (both signals above a threshold). Combine DA-1 with the Apple design-around in section 2.1. Static, symmetric carving is fine there; a software-chosen band for keyed ducking is not.

---

## 2. Other patents found

Each entry gives the number, title, owner, dates, status, a one-paragraph summary of the independent claim(s), what it could touch, and the design-around. "UNVERIFIED" marks what I could not confirm.

### 2.1 Masking, EQ carving, dynamic EQ, ducking

**US 8,929,561 B2 — "System and method for automated audio mix equalization and mix visualization"** (Apple Inc.). Filed 2011-03-16 (no earlier priority), granted 2015-01-06. Status: UNVERIFIED. The 12th-year fee was due by 2026-07-06 with grace to 2027-01-06; if unpaid it lapses 2027-01-06. Estimated expiry about 2031-03-16 plus any PTA (PTA UNVERIFIED). Family: no non-US member found (UNVERIFIED).
*Claims 1 (method), 14 (system), 27 (medium):* identify a first frequency band present in both a first and a second audio signal, where the first signal has a higher **priority** than the second (priority in that band determined from its **relevance**) and both signals are **above a predetermined amplitude threshold**; generate a **dynamic masking algorithm** from that identification; apply it to the **second** signal to attenuate it **in that band**; combine the two signals for output.
*Touches:* version C's "keyed dynamic EQ where tracks overlap" (the lead keys a band cut on the bed), any band-limited ducking in version B, and possibly version A if carving is priority-based and level-gated. *Design-around:* (i) for C, use **broadband** sidechain compression (no band identified, so no attenuation "in the first frequency band"), or a keyed dynamic EQ whose band and keying the **user** chooses; (ii) for A, use **static** EQ (no "dynamic masking algorithm") that is **symmetric** (each track of a pair is cut where the other has its home band), so no priority ranking is used; (iii) wait for expiry or lapse.

**US 11,430,463 B2 — "Dynamic EQ"** (Dolby Laboratories Licensing Corp. and Dolby International AB). Priority 2018-07-12, filed 2019-07-11, granted 2022-08-30. Status UNVERIFIED (4th-year fee was due by 2026-02-28, grace to 2026-08-30). Family includes HK 40044141 (other members UNVERIFIED).
*Claim 1:* split the input into frames and each frame into bands; per frame, compute the band levels as a spectral profile (the input level distribution); compute a per-band gain from a **mapping of properties of the input level distribution to a target spectral profile** (a reference level distribution); apply the gains; reconstruct. *Touches:* any time-varying "match the target curve" EQ (a reference-matched or learned-target dynamic EQ), and mix doctor fixes for harshness or mud built that way. *Design-around:* a **static** corrective EQ computed once per section (one curve, not per-frame gains), and classic threshold/ratio dynamic EQ bands with fixed thresholds (de-esser style), not gains mapped from a level distribution to a target profile.

**US 8,976,979 B2 — "Audio signal dynamic equalization processing control"** (Dolby Laboratories Licensing). Priority 2009-05-26, filed 2011-11-18, granted 2015-03-10. Status UNVERIFIED, estimated expiry about 2030. *Claims 1, 14, 15:* a user control interface **blends two or more DEQ preset spectral profiles**; the audio is processed so its time-varying spectrum (in **specific loudness** on perceptual bands) is driven toward that time-invariant profile. *Touches:* only a target-curve dynamic EQ with user-blended presets. *Design-around:* no preset blending, no specific-loudness DEQ.

**US 11,327,710 B2 — "Automatic audio ducking with real time feedback based on fast integration of signal levels"** (Adobe Inc.). Priority 2017-11-06, filed 2020-03-27, granted 2022-05-10. Status UNVERIFIED (4th-year fee was due by 2025-11-10, grace to 2026-05-10). *Claims 1, 13, 16:* metrics per slice of a foreground signal; a **summed-area table** over an observation window; a total metric from two table entries; a **key frame** added to the background track to duck it. *Touches:* version B ducking if written as volume-automation keyframes computed with prefix sums. *Design-around:* duck with a sidechain compressor at playback (no keyframes), or compute window sums without a summed-area table.

**US 12,563,360 B2 — "Visualizing auditory masking in multitrack audio recording"** (Northwestern University). Priority 2022-02-16, filed 2023-02-16, granted 2026-02-24, so newly live (estimated about 2043-02). *Claims 1, 7, 13:* determine each input's masking; display perceived loudness and masking of each input **in the time domain**; on user selection of a region of one input, show the **other inputs at a relative distance from it set by the amount of masking**. *Touches:* mix doctor UI. *Design-around:* a text or list view by bar range plus ordinary per-track meters. No "constellation" in which distance encodes masking.

### 2.2 Automatic mixing, balance, gain, panning

**US 12,456,493 B2 — "System for automated multitrack mixing"** (Dolby Laboratories Licensing; inventors include C. Steinmetz and J. Serrà). Priority from 2020 Spanish, EP and US provisional applications; PCT filed 2021-06-16 (WO 2021/259725); US pre-grant publication US 2023/0352058 A1; granted 2025-10-28. Status: active (first maintenance fee not due until 2029); estimated expiry about 2041-06-16 plus PTA. A European member is **UNVERIFIED**. *Claims 1, 18, 21:* a deep-learning **controller network** produces mixing parameters from the input tracks; a deep-learning **transformation network** applies signal processing and mixing gain from those parameters. In claim 1 the two are trained separately, the controller on the pre-trained transformation network; in claims 18 and 21 the tracks go to both networks in parallel. *Touches:* only a neural "differentiable mixing console" design. *Design-around:* all processing is conventional DSP (our EQ, compressors, gain, pan). If any model predicts parameters, it never sees a neural processor.

**US 12,598,441 B2 — "Audio signal processing method and audio signal processing apparatus"** (Yamaha Corp.; probably related to its DM7 "Mixing Assist" functions). Priority 2022-07-01, filed 2023-06-23, granted 2026-04-07, estimated expiry about 2043-06. *Claims 1, 12:* on a mixer with a head amplifier and faders, select a channel; specify setting data that includes **both** the head-amp gain (from that channel's time-series volume data) **and** the fader level (from data on a **second** channel); output the settings. *Touches:* a rough mix that sets a per-track input trim or clip gain from the track's own level and also sets faders from the other tracks. *Design-around:* one gain stage per track (the fader only); leave input trim or clip gain alone.

**US 10,248,380 B2 / US 10,248,381 B2 — "Audio control system and related methods"** (Native Instruments USA, ex-iZotope; the Spire recorder's auto level). Priority 2017-02-03, both granted 2019-04-02. Status UNVERIFIED (8th-year fee window opened 2026-04-02). *'380 claims 1, 11:* determine the input's gain level and automatically set an amplifier's gain so output stays in a range between a lower and an upper level, with the upper level from the peak and (upper − peak) ≤ 30% of (upper − lower). *'381 claims 1, 17:* the same auto gain, plus identifying the instrument **as guitar, voice, bass or drum** from the audio and setting a different gain for guitar/voice than for bass/drum. *Touches:* role-based gain staging if roles come from audio and the target is a level window. *Design-around:* gains set to relative-loudness targets (no upper/lower window with that headroom rule); roles from the user-set field (section 4).

**US 10,944,999 B2 (and US 11,363,314 B2, US 11,749,243 B2) — "Network-based processing and distribution of multimedia content of a live musical performance"** (Dolby). Priority 2016-07-22. *'999 claims 1, 11:* a **server system** estimates each source's level from a **rehearsal** where sources play alone, then levels the performance mix from those. The others are about video. *Touches:* nothing local or offline; noted for completeness.

**US 9,640,163 B2 / US 11,132,984 B2 — "Automatic multi-channel music mix from multiple audio stems"** (DTS). *Claims:* a rule engine picks rules from stem metadata (voice and genre); a mixing matrix makes **three or more output channels**. *Touches:* nothing while output is stereo. Recheck if a surround or Atmos rough mix is planned.

**US 7,526,348 B1 — "Computer based automatic audio mixer"** (filed 2000-12-27, granted 2009-04-28; no assignee recorded, inventors John D. Marshall and John C. Gaddy). *Claims 1, 4, 7, 10:* scale factors for several audio files from each file's **peak and mean level** relative to the others, so means become equal within the output format's maximum. Expiry: very likely expired. Twenty years from filing ended 2020-12-27, and it would need more than about 5.8 years of PTA to still be live (PTA and fee history UNVERIFIED). If it is expired, it is prior art and safe ground for "match average levels, keep peaks under full scale".

**US 2023/0267899 A1 — "Automatic audio mixing device"** (Nusic Ltd; application, priority 2020-03-11; status UNVERIFIED). Claim 1 computes beat, chord, chroma, energy, tonality and tempo from melody, bass, drum and vocal tracks. This is mash-up territory and does not touch the rough mix.

### 2.3 Automatic compression and dynamics

**US 8,965,774 B2 — "Automatic detection of audio compression parameters"** (Apple Inc.; inventor A. Eppolito). Filed 2011-08-23, granted 2015-02-24. Status shown as active with an adjusted expiration on Google Patents (via search snippet; date not seen). The 12th-year fee was due by 2026-08-24, grace to 2027-02-24, estimated expiry about 2031-08-23 plus PTA. *Claims 1, 11, 21:* determine a target range from predefined parameters; analyse the audio for a **detected range from its peak level and floor level**; generate compression parameters from peak and floor, with at least one being a **ratio expressing the difference between target range and detected range**; compress. *Touches:* auto compression if the ratio is derived from measured dynamic range against a target range. *Design-around:* ratio from a fixed per-role preset (textbook values); threshold from a loudness percentile (below); never ratio = f(detected range, target range).

**US 9,954,507 B2 and US 10,050,596 B2 — "Using averaged audio measurements to automatically set audio compressor threshold levels"** (Adobe Systems Inc., now Adobe Inc.; inventor M. G. Stegner). Priority 2016-08-01, granted 2018-04-24 and 2018-08-14. Status UNVERIFIED. *'507 claims 1, 9, 16 ('596 is the same for a noise gate):* (1) on loading a file, compute a minimum average and a maximum average of amplitude and set the threshold as **their average**; (9) discard the max and min sample, average the rest, set the threshold, then pick the **ratio from which threshold range** the threshold falls in; (16) per-channel averages, and a **common threshold when the channel averages differ by less than a set amount**. *Design-around:* threshold set so a target amount of gain reduction happens on the loudest P% of short-term windows (a percentile of the short-term loudness histogram); ratio from the role preset; stereo always linked (no conditional linking test).

**US 10,635,389 B2 — "Systems and methods for automatically generating enhanced audio output"** (Native Instruments USA, ex-iZotope; the Neutron Track Assistant line). Priority 2017-06-07, filed 2018-09-21, granted 2020-04-28, 4th-year fee paid 2023-10-30, anticipated expiry 2038-05-24. US and WO only. *Claims 1, 15, 28:* (A) automatically identify the sound source; (B) settings from it; (C) then measure a spectral or dynamic characteristic; (D) modify the settings from it; (E) user adjusts; (F) playback. All three are limited to: find the **frequency range where power peaks occur at a predefined amplitude or incidence rate**, place a **multiband crossover at its upper or lower limit**, and use a different compression threshold or ratio inside that range. *Design-around:* no automatic multiband crossover placement tied to a detected peak region. Use single-band compression, or multiband with fixed role-preset crossovers.

**US 9,350,312 B1 — "Audio dynamic range adjustment system and method"** (iZotope, now Native Instruments USA). Priority 2013-09-19, granted 2016-05-24. Status UNVERIFIED (8th-year fee was due by 2024-05-24). *Claims 1, 7, 8:* histogram of level measurements, then a **histogram-equalization mapping** to a target histogram, then a gain envelope. *Design-around:* never build a gain envelope by histogram matching. Percentile-picked thresholds feeding a normal compressor are a different mechanism.

### 2.4 Learning targets from the owner's own mixes; semantic and role-driven presets

**US 11,687,314 B2 — "Digital audio workstation with audio processing recommendations"** (Waves Audio Ltd; inventors I. Beiser, M. Shaashua, I. Neoran). Priority 2020-05-18, filed 2021-05-13, granted 2023-06-27. Status shown as active on Google Patents (via search snippet); first maintenance fee due by 2027-06-27, estimated expiry about 2041-05-13 plus PTA. Family: no non-US member found (UNVERIFIED).
*Claims 1 (method), 9 (system):* in the setting where training tracks were given to a **human sound mixer** who returned **individually processed training tracks**: input original tracks to a trained machine; input a **target audio feature**; extract features from the original tracks; select a **recommendation from a database** for individual processing, responsive to the features and the target feature. The machine was trained by inputting the training tracks **and the individually processed training tracks**, outputting processing operations that emulate the human's processing, and **storing those operations in a database record**.
*Touches:* "targets are learned from the owner's own past mixes" and mix doctor "offers fixes". *Design-around (any one breaks the claim; do all three):* (i) learn only from the raw multitracks and the **final stereo mix**, never from his individually processed per-track bounces or stems; (ii) learn **target relations in the measurement domain** (for example vocal-to-bed loudness, kick/bass ratio, spectral tilt relative to the mix), not "processing operations", and do not keep a database of operations to pick recommendations from; (iii) version A/B/C is a style choice, not an input "target audio feature".

**US 9,304,988 B2 — "System and method for performing automatic audio production using semantic data"** (LANDR Audio; inventors M. J. Terrell, S. Mansbridge, J. D. Reiss, B. De Man). Priority 2013-08-28 (provisional), filed 2014-08-28, granted 2016-04-05. Status shown as active on Google Patents (via search snippet); 8th-year fee history UNVERIFIED, estimated expiry about 2034-08-28 plus PTA. Family (Google Patents search snippets and GreyB's 2025 LANDR portfolio list): EP 3039674 B1 (filed 2014-08-28, granted 2019-04-17; national parts seen for DE (DE 602014045056 T2) and AT; other validations and annual-fee status **UNVERIFIED**), JP 6585049 B2, CN 105612510 B, CA 2887124 C, BR 112016004029 B1, WO 2015/027327. **No KR member listed.**
*US claims 1 (method), 16 (system):* receive a signal and **semantic information** (at least one of "chromosomal" numeric features such as tempo or MFCCs, **classification features** such as instrument or genre, and production features); determine a semantic rule holding **production data** (processing actions and their static settings, a configuration, and/or **target production features**); process and output. Determining the rule comprises **accessing a database of reference records, identifying at least one record using the semantic information, and assigning the actions, settings, configuration and/or targets from that record**. *EP claim 1* is similar but keyed on production features, which are numeric features describing a production objective, matched against reference records that each hold a reference configuration, settings and production features.
*Touches:* "role → look up the owner's learned per-role targets → set processing", and A/B/C chosen as a production objective that pulls stored settings. *Design-around (medium strength):* no run-time **retrieval** of stored records (per song, per genre or per role). Instead, fit one compact parametric model from his past mixes (for example a small regression from numeric features to relative-loudness and tilt targets, fitted offline) and **evaluate** it; no lookup tables keyed by role or style. A per-role constant table is the riskiest form, because it looks like a reference record identified by a classification feature. Counsel should look at this one. For the EP side (UK and EU sales) the same logic applies.

**US 9,031,243 B2 — "Automatic labeling and control of audio algorithms by audio recognition"** (Native Instruments USA, ex-iZotope). Priority 2009-09-28, filed 2010-09-28, granted 2015-05-12. Status: active; 4th-year fee paid 2018-11-12, 8th-year fee 2023-04-18. **The 12th-year fee window is open now** (2026-05-12 to 2026-11-12, grace to 2027-05-12); whether it was paid is UNVERIFIED. Adjusted expiry **2031-10-09**. US only.
*Claims 1 (medium), 24, 31 (methods):* stage 1 windowed analysis gives a raw feature vector; stage 2 statistical processing gives a reduced feature vector; stage 3 derives a **sound-object label**; the label is mapped into a **stream of control events** sent to an application that **configures processing** for the signal (claim 31: adjusts a **mixing-console** processing parameter). The stages are configurable.
*Touches:* using the YAMNet track-role classifier (Tidy Tracks) to drive rough-mix processing. Naming and ordering tracks alone does not configure processing, so Tidy Tracks as built is outside it. *Design-around:* the rough mix reads a **role field the user sets or explicitly confirms**; the classifier may pre-fill only the track name or colour. Better still, the role picker defaults to empty or "other" until the user picks. Re-evaluate after 2027-05-12 (lapse if the fee is unpaid) or 2031-10-09.

**US 12,069,464 B2 — "Presentation independent mastering of audio content"** (Dolby). Priority 2019-07-09, granted 2024-08-20, estimated expiry about 2040-07. *Claims 1, 16:* compare a mastered presentation with the rendered presentation of the same content and determine, **for each time-frequency tile**, an attribute difference; superimpose the difference on each corresponding tile of the input signals. *Touches:* reverse-engineering his final mix against the raw sum. *Design-around:* learn aggregate statistics only; never transfer a per-tile difference map from a mix onto stems.

**US 11,581,970 B2 — "System for deliverables versioning in audio mastering"** (Lucasfilm Entertainment Company Ltd. LLC; inventors S. Morris, S. Levine, N. Tsingos). Priority 2021-04-21, granted 2023-02-14, estimated expiry about 2041-04 plus PTA. Status UNVERIFIED (4th-year fee due by 2026-08-14, grace to 2027-02-14).
*Claims 1, 3, 5, 11, 12, 15:* obtain a first version of a sound mix; extract audio features from it; obtain mixing metadata; **calculate with a trained model**, from the metadata and features, mixing-console features (in claims 1 and 15, console automation with time-domain control values; in claim 3, **displayed to the user in human-readable form**); derive a second version of the mix from them. Claims 5 and 12 add video features; claim 11 offers a choice between console features and predicted audio features.
*Touches:* a mix doctor that runs a **trained model** on the current mix plus session metadata (roles) and outputs console settings or fixes for the user. *Design-around:* the doctor's fixes come from closed-form rules on measurement-vs-target differences (for example "vocal 3 dB under target → raise the fader 3 dB"); the only learned things are target values (means and ranges from his past mixes), not a model whose output is console settings.

### 2.5 Reverb and delay sends from measurements

**US 9,672,806 B2 — "Apparatus and method for determining a measure for a perceived level of reverberation, audio processor and method for processing a signal"** (Fraunhofer-Gesellschaft). Priority 2011-03-02, PCT filed 2012-02-24, US filed 2013-08-31, granted 2017-06-06. Status UNVERIFIED, estimated expiry about 2032-02-24 plus PTA. Family includes CA 2827326 and EP/MX members (other members UNVERIFIED).
*Claims 1, 10, 15, 17, 18, 19 (measure) and 11, 14, 16 (processor):* filter the direct and reverberant components (or the mix) with a **perceptual filter stage modelling auditory perception**, estimate a loudness for each, and combine them into a perceived reverberation level. The processor claims then **control the reverb toward a target value** with that measure. *Touches:* reverb sends set by measuring perceived reverb level, and K-weighted LUFS counts as a perceptual filter. *Design-around:* **open-loop** sends from role and tempo presets (a send in dB relative to the dry fader; decay and pre-delay from tempo); no loop that measures the reverb return against a target.

**EP 4247011 A1 — "Apparatus and method for an automated control of a reverberation level using a perceptional model"** (Fraunhofer; filed 2022-03-16, published 2023-09-20; **pending application, grant status UNVERIFIED**). *Claim 1 as filed:* determine reverberation gain information **depending on the audio input signal** and add artificial reverb accordingly. Dependents: from an estimate of perceived reverberation, via linear regression on features, mapped to a send gain. Very broad if granted. Related EP 4494361 A1 (2025) is **UNVERIFIED**. *Design-around:* reverb send levels come from role and user choice, not from analysis of the track's audio. Version B's "shared room" is a fixed role table.

### 2.6 Reference-track and mastering matching

In the searches that could be run (section 5), no live patent was found that claims plain **long-term spectral matching to a reference** (average spectrum of source vs reference turned into a static EQ curve) or plain **loudness matching**. Dolby's US 8,976,979 itself names Logic's Match EQ, Steinberg's FreeFilter and Voxengo CurveEQ as existing spectral-matching tools. The dynamic version is claimed in US 11,430,463 (section 2.1), and per-tile mastering transfer in US 12,069,464 (section 2.4). Design rule: static, whole-section matching curves with smoothing; loudness by BS.1770 integrated loudness and a gain change.

### 2.7 Assistants and vendors searched with no relevant live patent found

- **iZotope / Native Instruments:** besides the patents above, Google Patents assignee searches (iZotope, all years; Native Instruments, priority from 2015) list none on Mix Assistant, Master Assistant or Tonal Balance. NI researchers published "Automatic Equalization for Individual Instrument Tracks Using CNNs" (DAFx 2024): instrument ID → target spectrum → EQ-matching network. No patent publication found; a filing could still be unpublished (**UNVERIFIED**).
- **Sonible:** no patent or application found under "sonible GmbH" (**UNVERIFIED**: web search only; the Google Patents assignee search was blocked).
- **LANDR:** besides US 9,654,869 and US 9,304,988 families, WO 2015/035492 A1 ("System and method for performing automatic multi-track audio mixing", Mixgenius, priority 2013-09-13; automatic EQ by splitting spectra into bands and comparing bands across tracks): GreyB's LANDR portfolio list shows no national-phase member of it, so it probably never became a granted patent (UNVERIFIED).
- **Waves:** only US 11,687,314 found as relevant.
- **Mixed In Key:** patents on key detection (US 7,842,878) and energy level (US 8,865,993); not mixing.
- **Roland:** no automatic-mix patent found (US 2023/0412964 A1 is a mixing device with output-unit settings).
- **Yamaha:** US 12,598,441 above; older console patents expired.
- **Sony:** no granted automatic-mixing or style-transfer patent found (**UNVERIFIED**; Sony AI publishes in the area).
- **Apple Logic Mastering Assistant:** no patent or application found (**UNVERIFIED**; it may be unpublished). Apple's compression patents are above.
- **Steinberg:** none found.
- **RoEx (Queen Mary spin-out):** says its mixing is "in the patenting process"; Queen Mary's GB 2625729 A "Audio techniques" (priority 2022-12-22) is probably that: claims and status UNVERIFIED (Google Patents was unreachable when checked).
- **Soundtheory (Gullfoss):** markets Gullfoss as using "patent-pending" automatic-EQ technology (2018). No publication found (**UNVERIFIED**). It is a real-time perceptual auto-EQ; a static, section-wise EQ is a different mechanism, but check again before shipping any real-time auto-EQ.
- **Dolby EP 4136753 A1 / WO 2021/211471, "Automated mixing of audio description"** (priority 2020-04-13): ducking of programme audio under narration. Claims not read (**UNVERIFIED**). It is relevant only if the ducking design copies audio-description mixing.
- **Korea (KR):** none of the key patents above has a KR family member that I could find (LANDR '869: none; iZotope masking family: none; Apple, Waves, Dolby '493: not verified). No Korean-origin patent on DAW multitrack auto-mixing turned up (searched by web in English and Korean; KIPRIS not reachable by script — **UNVERIFIED**).

---

## 3. Safe ground (old enough to lean on)

Prior art older than 20 years cannot be validly claimed by anyone now, and expired patents are free to use. Two cautions: (1) in the US "I was practising the prior art" is **not** a defence to literal infringement of a live claim. It is an invalidity argument, so a new combination can still be claimed. (2) The safe ground is the old **technique**, not every way of automating it. Automation choices still go through sections 1–2.

| Technique | Evidence of age | How the design uses it |
|---|---|---|
| Shelving (bass/treble) EQ | P. J. Baxandall, "Negative-Feedback Tone Control", *Wireless World*, Oct. 1952 | low and high shelves in the rough-mix EQ |
| Parametric (peak) EQ | G. Massenburg, "Parametric Equalization", AES 42nd Convention, paper K-2, May 1972 (AES E-Library) | carving bands |
| High-pass / low cut on non-bass sources, frequency "slots" per instrument, panning conventions (kick, bass, snare, lead vocal centre) | D. Gibson, *The Art of Mixing* (1997); B. Owsinski, *The Mixing Engineer's Handbook* (1999) | low cut per role, role-table panning, static complementary EQ |
| Mid/side (sum and difference) stereo | A. D. Blumlein, British Patent 394,325 (filed 1931, granted 1933); Fairchild 670 "lateral/vertical" (sum/difference) limiter mode, 1959–60, made for stereo disc cutting | M/S processing, width |
| Mono low frequencies | "Elliptical equaliser" in disc mastering: LF crossover that sums L/R to mono below a corner frequency, Neumann cutting systems from the 1950s–60s (practitioner accounts; exact model and year **UNVERIFIED**) | mono lows below about 100–150 Hz |
| Broadband sidechain compression / ducking (one signal's level controls another's gain) | Voice-over ducking in broadcast, and Dan Dugan's automatic microphone mixing patents of the mid-1970s (gain sharing; US 3,814,856 is listed as "Control apparatus for sound reinforcement systems", 1974, inventor attribution **UNVERIFIED**); D. Dugan, "Automatic Microphone Mixing", *J. Audio Eng. Soc.* 23(6), 1975 | version B ducking (broadband only) |
| Frequency-selective compression (de-esser; dynamic EQ bands with fixed threshold and ratio) | De-essers from the 1960s–70s; BSS DPR-901 four-band dynamic EQ, early 1990s (exact year **UNVERIFIED**) | user-set dynamic EQ bands, de-essing |
| Bus "glue" compression | SSL 4000 E console (1979) with a master bus compressor; the design is traced to the B-series of 1976 (Wikipedia / trade-press histories) | version B bus compressor with fixed settings |
| Aux/send reverb shared by many channels | Standard console architecture since the 1960s–70s; Gibson 1997, Owsinski 1999 | version B shared room, open-loop send levels |
| Loudness measurement | ISO 532 (Zwicker / Stevens methods), 1975; ITU-R BS.1770-1, July 2006 (just over 20 years) | track and mix loudness, gain to targets |
| Partial-loudness model (as published science) | B. C. J. Moore, B. R. Glasberg, T. Baer, "A model for the prediction of thresholds, loudness, and partial loudness", *JAES* 45(4), 1997 | **do not use** in the masking path anyway (section 1.2) |
| Crest factor, peak/RMS metering, spectral centroid | MPEG-7 audio descriptors, ISO/IEC 15938-4 (2002); peak/RMS metering is far older | measurements |
| Automatic mixer by gain sharing | Dugan 1975 (above) | relative balance |
| Level matching of several files by peak and mean | US 7,526,348 B1, filed 2000-12-27; very likely expired (it would need more than about 5.8 years of PTA to still be live; UNVERIFIED) | balance pass, if expired |
| Average-spectrum matching EQ ("match EQ") | Steinberg FreeFilter: a source track's spectrum is matched to a reference with a third-octave linear-phase EQ, reviewed in *Sound On Sound* PC Notes, July 1998; SOS's March 2003 Voxengo CurveEQ review says several such products existed "over the last few years". Logic's Match EQ is also cited as existing in Dolby's 2009-priority US 8,976,979 | static whole-section target matching against the owner's average curve or a reference |

Useful but **not yet 20 years old** (prior art against the patents above, not public domain by age): Perez-Gonzalez & Reiss, automatic gain/fader, panning and cross-adaptive EQ papers (DAFx/AES 2007–2010); Barchiesi & Reiss, "Automatic target mixing using least-squares optimization of gains and equalization settings" (DAFx 2009) and "Reverse engineering of a mix" (JAES 2010). The last is close to the owner-style learning step and predates LANDR's 2012 and Waves' 2020 priority dates.

---

## 4. Design that follows from this (per planned function)

| Function | Design that avoids the claims found | Patents it avoids |
|---|---|---|
| **Masking measure** (A, C, doctor) | Per-track, per-bar band energies from each track rendered alone; overlap = co-activity of two tracks within N dB over M bars; symmetric score; no psychoacoustic loudness, no "loss" | iZotope '744/'065/'731/'812 |
| **Fader / balance** | Single gain stage (fader). Target relations learned from past mixes (raw multitrack vs final 2-mix, least-squares gains), held as one fitted parametric model, not looked up by role or style | Yamaha '441, Waves '314, LANDR '988 (reduced), iZotope '380/'381 |
| **Pan** | Role-table convention plus a width setting for C; no pan from spectral content or spectral-centre balancing | LANDR '869 claims 20–25 |
| **EQ** | Low cut and shelves by role; static complementary carving for A (each of a pair keeps a home band, no priority ranking); static whole-section target curve | Apple '561, Dolby '463, Dolby '979 |
| **Compression** | Role preset ratio, attack and release (textbook); threshold from a loudness-histogram percentile for a target gain reduction; stereo always linked; single-band or fixed-crossover multiband | Apple '774, '507/'596, iZotope '389, iZotope '312 |
| **Reverb / delay sends** | Open loop: role table in dB relative to the dry fader; decay and pre-delay from tempo; no measurement of the reverb return | Fraunhofer '806, EP 4247011 |
| **Ducking (B)** | Broadband sidechain compressor at playback; no software-chosen band; no keyframes from summed-area tables | Apple '561, Adobe '710 |
| **Keyed dynamic EQ (C)** | **Drop as an automatic move** until Apple '561 ends (about 2031) or lapses, or ship it as a user-configured tool (the user picks keyer, band, depth) | Apple '561, iZotope family |
| **Bus compression, low cut, mono lows** | Fixed textbook settings; M/S mono below a corner | (safe ground) |
| **Role source** | User-set or user-confirmed role field; classifier output used only for names, colours and order | iZotope '243, '381 |
| **Learning from past mixes** | Inputs: raw multitracks + final stereo mix only; output: target relations in the measurement domain; conventional DSP only; no stored per-song records retrieved at run time; no per-tile transfer | Waves '314, Dolby '493, Dolby '464, LANDR '988 |
| **Mix doctor** | Diagnosis listed as text by bar range, ranked by co-activity, duration or level offset from his targets; meters only, no masking-distance constellation; fixes from closed-form rules (no trained model outputs settings), offered as **suggested moves the user performs** (in the US/UK while LANDR '869 lives) | iZotope '812, Northwestern '360, Lucasfilm '970, LANDR '869 |
| **Whole automatic rough mix in US/UK** | Still inside LANDR '869 claim 1 after all of the above. Ship "measure and suggest" there, or license, or wait (2028 fee check, 2033 expiry) | LANDR '869 (+ GB '867) |

---

## 5. What I could not verify, and method

- **Status fields** marked UNVERIFIED were not reachable. Google Patents throttled automated reads part-way through (after the LANDR and iZotope pages were read in full), and Justia, FreePatentsOnline, the USPTO fee page and the EPO Register all refuse scripted access. Claims for US patents were read on Searchlight (patents.searchlight.law), and EP claims on the EPO publication server (data.epo.org).
- EP 3039674 B1: states where it was validated and whether annual fees are being paid (EPO Register blocked automated access).
- GB 2503867 B and GB 2625729 A: UK IPO renewal and pendency status.
- KR coverage: KIPRIS could not be queried by script; Korean web search found nothing relevant.
- Unpublished applications (18-month publication lag) from NI/iZotope, Apple (Mastering Assistant), Sony, RoEx, LANDR and Waves cannot be seen by anyone yet. A re-check in 6–12 months is worth scheduling.
- Doctrine of equivalents: the masking design-around is a structural difference (A-vs-B levels measured alone, not A-alone vs A-with-B), but an equivalence argument always remains possible. That is the main question to put to counsel, together with LANDR '869 claim 1 and LANDR '988.
