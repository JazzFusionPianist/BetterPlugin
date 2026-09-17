#include "FxEngine.h"
#include <cmath>
#include "signalsmith-stretch.h"

namespace orbfx {
/** The spectral shifter behind pitch, formant and voice. */
struct NodeState::Shifter
{
    // fine: the library's studio preset (120 ms blocks — clean, ~150 ms of
    // latency the host compensates); live: 1024-sample blocks for playing
    // through (~27 ms). Both exist so the choice is a word, not a rebuild.
    signalsmith::stretch::SignalsmithStretch<float, std::minstd_rand> fine { 1234 };
    signalsmith::stretch::SignalsmithStretch<float, std::minstd_rand> live { 4321 };
    std::vector<float> in[2], out[2];
    bool configured = false;
    bool usingLive = false;
    signalsmith::stretch::SignalsmithStretch<float, std::minstd_rand>& st (bool wantLive)
    {
        if (wantLive != usingLive) { usingLive = wantLive; (wantLive ? live : fine).reset(); }
        return wantLive ? live : fine;
    }
};
NodeState::NodeState() = default;
NodeState::~NodeState() = default;
} // namespace orbfx

// The eleven one-knob effects, one NodeState each. The DSP bodies below
// moved verbatim out of PluginProcessor.cpp (2026-09-11) so that every
// node on the wall owns its own state.

namespace orbfx {

// RBJ shelf (S = 1). type: false = low shelf, true = high shelf.
static void bakeShelf (bool high, float gainDb, float freq, float sr,
                       float& b0, float& b1, float& b2, float& a1, float& a2)
{
    const float A     = std::pow (10.0f, gainDb / 40.0f);
    const float w0    = juce::MathConstants<float>::twoPi * freq / sr;
    const float cosw  = std::cos (w0);
    const float sinw  = std::sin (w0);
    const float alpha = sinw / 2.0f * std::sqrt (2.0f);
    const float sq    = 2.0f * std::sqrt (A) * alpha;

    float bb0, bb1, bb2, aa0, aa1, aa2;
    if (! high)
    {
        bb0 =  A * ((A + 1) - (A - 1) * cosw + sq);
        bb1 =  2 * A * ((A - 1) - (A + 1) * cosw);
        bb2 =  A * ((A + 1) - (A - 1) * cosw - sq);
        aa0 =  (A + 1) + (A - 1) * cosw + sq;
        aa1 = -2 * ((A - 1) + (A + 1) * cosw);
        aa2 =  (A + 1) + (A - 1) * cosw - sq;
    }
    else
    {
        bb0 =  A * ((A + 1) + (A - 1) * cosw + sq);
        bb1 = -2 * A * ((A - 1) + (A + 1) * cosw);
        bb2 =  A * ((A + 1) + (A - 1) * cosw - sq);
        aa0 =  (A + 1) - (A - 1) * cosw + sq;
        aa1 =  2 * ((A - 1) - (A + 1) * cosw);
        aa2 =  (A + 1) - (A - 1) * cosw - sq;
    }
    b0 = bb0 / aa0; b1 = bb1 / aa0; b2 = bb2 / aa0; a1 = aa1 / aa0; a2 = aa2 / aa0;
}

// RBJ 2nd-order LP/HP (Q = 1/sqrt 2) for the cut effect.
static void bakeCutFilter (bool hp, float freq, float sr,
                           float& b0, float& b1, float& b2, float& a1, float& a2)
{
    const float w0    = juce::MathConstants<float>::twoPi * freq / sr;
    const float cosw  = std::cos (w0);
    const float sinw  = std::sin (w0);
    const float alpha = sinw / (2.0f * 0.70710678f);
    float bb0, bb1, bb2;
    const float aa0 = 1.0f + alpha;
    const float aa1 = -2.0f * cosw;
    const float aa2 = 1.0f - alpha;
    if (hp)
    {
        bb0 = (1.0f + cosw) * 0.5f;
        bb1 = -(1.0f + cosw);
        bb2 = (1.0f + cosw) * 0.5f;
    }
    else
    {
        bb0 = (1.0f - cosw) * 0.5f;
        bb1 = 1.0f - cosw;
        bb2 = (1.0f - cosw) * 0.5f;
    }
    b0 = bb0 / aa0; b1 = bb1 / aa0; b2 = bb2 / aa0; a1 = aa1 / aa0; a2 = aa2 / aa0;
}

//==============================================================================
// Shared machinery for the pitched effects.

static constexpr float kDivBeats[7] = { 0.25f, 1.0f / 3.0f, 0.5f, 0.75f, 1.0f, 1.5f, 2.0f };

/** Two grains on a ring, half a cycle apart, each faded by a raised sine
 *  so one hands over to the other as it wraps. The read heads drift at
 *  (1 − ratio): up-shifts read faster than the writer, down-shifts
 *  slower. Latency ≈ half a grain. In place, both channels. */
static void pitchShiftBlock (NodeState& st, float ratio, float sr, int n, float* L, float* R)
{
    if (st.psBuf[0].empty()) return;
    const int   len   = (int) st.psBuf[0].size();
    const float grain = juce::jlimit (256.0f, (float) len - 8.0f, sr * 0.045f);   // 45 ms
    const float inc   = (1.0f - ratio) / grain;
    for (int i = 0; i < n; ++i)
    {
        st.psBuf[0][(size_t) st.psWrite] = L[i];
        st.psBuf[1][(size_t) st.psWrite] = R != nullptr ? R[i] : L[i];
        st.psPhase += inc;
        st.psPhase -= std::floor (st.psPhase);
        float outL = 0.0f, outR = 0.0f;
        for (int k = 0; k < 2; ++k)
        {
            float f = st.psPhase + 0.5f * (float) k;
            f -= std::floor (f);
            const float w  = std::sin (juce::MathConstants<float>::pi * f);
            float rp = (float) st.psWrite - f * grain;
            while (rp < 0.0f) rp += (float) len;
            const int   i0 = (int) rp;
            const float fr = rp - (float) i0;
            const int   i1 = i0 + 1 < len ? i0 + 1 : 0;
            outL += w * (st.psBuf[0][(size_t) i0] * (1.0f - fr) + st.psBuf[0][(size_t) i1] * fr);
            outR += w * (st.psBuf[1][(size_t) i0] * (1.0f - fr) + st.psBuf[1][(size_t) i1] * fr);
        }
        L[i] = outL;
        if (R != nullptr) R[i] = outR;
        st.psWrite = st.psWrite + 1 < len ? st.psWrite + 1 : 0;
    }
}

/** Monophonic pitch by normalised autocorrelation over the last 1024
 *  samples (mono), run every ~20 ms. Returns a fractional MIDI note or
 *  −1 when nothing periodic is there. */
static float trackPitch (NodeState& st, float sr)
{
    const int N = 1024;
    if ((int) st.pdBuf.size() < N) return -1.0f;
    float x[1024];
    const int len = (int) st.pdBuf.size();
    int rp = st.pdWrite - N; while (rp < 0) rp += len;
    float energy = 0.0f;
    for (int i = 0; i < N; ++i) { x[i] = st.pdBuf[(size_t) rp]; energy += x[i] * x[i]; rp = rp + 1 < len ? rp + 1 : 0; }
    if (energy < 1.0e-4f) return -1.0f;
    const int minLag = juce::jmax (16, (int) (sr / 1400.0f));   // ≤ 1.4 kHz
    const int maxLag = juce::jmin (N / 2, (int) (sr / 50.0f));  // ≥ 50 Hz
    float bestVal = 0.0f; int bestLag = -1;
    float prev = 0.0f; bool rising = false;
    for (int lag = minLag; lag <= maxLag; ++lag)
    {
        float ac = 0.0f, e0 = 0.0f, e1 = 0.0f;
        for (int i = 0; i + lag < N; i += 2)   // every other sample: half the cost, same peak
        {
            ac += x[i] * x[i + lag]; e0 += x[i] * x[i]; e1 += x[i + lag] * x[i + lag];
        }
        const float nac = ac / (std::sqrt (e0 * e1) + 1.0e-9f);
        // first strong peak wins (octave errors otherwise pull to 2×period)
        if (nac > prev) rising = true;
        else if (rising && prev > 0.82f && prev > bestVal * 0.9f) { bestVal = prev; bestLag = lag - 1; break; }
        else rising = false;
        if (nac > bestVal && nac > 0.82f) { bestVal = nac; bestLag = lag; }
        prev = nac;
    }
    if (bestLag <= 0) return -1.0f;
    const float hz = sr / (float) bestLag;
    return 69.0f + 12.0f * std::log2 (hz / 440.0f);
}

/** Diatonic harmony: the input's nearest scale degree in `key`, moved by
 *  `degrees` steps along the scale, as a semitone shift. */
static float diatonicShift (float note, int keyRoot, int scale, int degrees)
{
    static const int major[7] = { 0, 2, 4, 5, 7, 9, 11 };
    static const int minor[7] = { 0, 2, 3, 5, 7, 8, 10 };
    const int* sc = scale == 1 ? minor : major;
    const int n   = (int) std::lround (note);
    const int rel = ((n - keyRoot) % 12 + 12) % 12;
    int deg = 0, bestD = 99;
    for (int d = 0; d < 7; ++d)
    {
        int diff = std::abs (rel - sc[d]); if (diff > 6) diff = 12 - diff;
        if (diff < bestD) { bestD = diff; deg = d; }
    }
    const int base   = n - rel + sc[deg];                      // the degree's pitch near n
    const int target = deg + degrees;
    const int oct    = (int) std::floor ((float) target / 7.0f);
    const int td     = ((target % 7) + 7) % 7;
    const int tpitch = (base - sc[deg]) + oct * 12 + sc[td];
    return (float) (tpitch - n);
}

/** Push a block through the slot's spectral shifter, in place. */
static void shiftBlock (NodeState& st, bool liveMode, int n, float* L, float* R)
{
    auto* sh = st.shifter.get();
    if (sh == nullptr || ! sh->configured) return;
    auto& eng = sh->st (liveMode);
    for (int ch = 0; ch < 2; ++ch)
    {
        if ((int) sh->in[ch].size() < n) { sh->in[ch].resize ((size_t) n); sh->out[ch].resize ((size_t) n); }
    }
    std::copy (L, L + n, sh->in[0].begin());
    if (R != nullptr) std::copy (R, R + n, sh->in[1].begin()); else std::copy (L, L + n, sh->in[1].begin());
    float* ins[2]  = { sh->in[0].data(),  sh->in[1].data() };
    float* outs[2] = { sh->out[0].data(), sh->out[1].data() };
    eng.process (ins, n, outs, n);
    std::copy (sh->out[0].begin(), sh->out[0].begin() + n, L);
    if (R != nullptr) std::copy (sh->out[1].begin(), sh->out[1].begin() + n, R);
}

/** Beats since the bar of time zero, sample-accurate within the block:
 *  the host's position while rolling, our own clock otherwise. */
static inline double beatAt (const NodeParams& p, double freeBeat, int i, float sr)
{
    const double perSample = (double) p.bpm / 60.0 / (double) sr;
    return (p.playing ? p.ppq : freeBeat) + perSample * (double) i;
}

//==============================================================================
void NodeState::prepare (double sampleRate)
{
    const float srf = (float) sampleRate;
    // juce::Reverb boots with its own dry at 0.4 and SMOOTHS toward the
    // levels we set — 30 ms of leaked dry on every fresh node. Set our
    // levels first, then setSampleRate snaps the smoothers onto them.
    {
        juce::Reverb::Parameters pr;
        pr.dryLevel = 0.0f; pr.wetLevel = 1.0f;
        fxReverb.setParameters (pr);
    }
    fxReverb.setSampleRate (sampleRate);
    // Every slot gets every line up front (~1.2 MB each), so binding a
    // slot to a new effect is allocation-free and can happen on the audio
    // thread the moment a Program is adopted. Message thread only.
    auto line = [&] (std::vector<float>* dl, float seconds)
    {
        const int len = (int) (srf * seconds) + 64;
        dl[0].assign ((size_t) len, 0.0f);
        dl[1].assign ((size_t) len, 0.0f);
    };
    // Modulated delay for chorus/flanger: 60 ms is comfortably past the
    // deepest excursion. Doubler ghosts live within ~35 ms. The echo line
    // holds a half note down to 43 BPM (~2.8 s) with headroom.
    line (modDl, 0.06f);
    line (dblDl, 0.06f);
    line (dlyBuf, 3.0f);
    // pitch shifter grains (≤ 60 ms) and the tracker's analysis window
    line (psBuf, 0.2f);
    pdBuf.assign (2048, 0.0f);
    // the spectral shifter: ~43 ms blocks, 4× overlap — clean, ~60 ms of
    // latency, a fraction of the cost of the studio preset
    if (shifter == nullptr) shifter = std::make_unique<Shifter>();
    {
        shifter->fine.presetDefault (2, (float) sampleRate, false);
        const int block = sampleRate > 60000.0 ? 2048 : 1024;   // power of two
        shifter->live.configure (2, block, block / 4, false);
        shifter->configured = true;
    }
    line (grainRing, 2.0f);
    line (stutBuf, 2.2f);      // a whole beat down to 27 BPM
    line (wowDl, 0.05f);
    shimWet[0].assign (8192, 0.0f); shimWet[1].assign (8192, 0.0f);
    reset();
}

void NodeState::reset()
{
    // One node, one effect — clear everything; the amount glides back up
    // from neutral so a (re)inserted node never clicks.
    amtSm = neutralAmount (type);
    grDb = 0.0f;
    for (int ch = 0; ch < 2; ++ch) { tiltLow[ch] = {}; tiltHigh[ch] = {}; }
    tiltApplied = 999.0f;
    for (int ch = 0; ch < 2; ++ch)
    {
        tapeLpState[ch] = 0.0f; cleanXoState[ch] = 0.0f; cleanXoState2[ch] = 0.0f; cleanShelf[ch] = {};
    }
    cleanShelfBaked = -1.0f;
    fxReverb.reset();
    sendHpState[0] = sendHpState[1] = 0.0f;
    for (auto& st : apState) { st[0] = 0.0f; st[1] = 0.0f; }
    sideHpState = 0.0f; sideHpState2 = 0.0f; stEnvM = 0.0f; stEnvS = 0.0f;
    glueEnv = 0.0f;
    gainPrimed = false;
    modLfoPhase = 0.0f; modWrite = 0;
    std::fill (modDl[0].begin(), modDl[0].end(), 0.0f);
    std::fill (modDl[1].begin(), modDl[1].end(), 0.0f);
    for (int st = 0; st < 6; ++st)
        for (int ch = 0; ch < 2; ++ch) { phX1[st][ch] = 0.0f; phY1[st][ch] = 0.0f; }
    phFb[0] = phFb[1] = 0.0f;
    for (int ch = 0; ch < 2; ++ch) { cutBqHp[ch] = {}; cutBqLp[ch] = {}; cutBqHp2[ch] = {}; cutBqLp2[ch] = {}; }
    cutBakedA = -1.0f; cutBakedVar = -1; cutUseHp = cutUseLp = false;
    for (int ch = 0; ch < 2; ++ch)
    {
        ampHpState[ch] = 0.0f; ampDcState[ch] = 0.0f; ampLpState[ch] = 0.0f;
        ampLp2State[ch] = 0.0f; ampMidLo[ch] = 0.0f; ampMidHi[ch] = 0.0f; ampEnv[ch] = 0.0f;
        ampStageHp[ch] = 0.0f;
        ampInEnv[ch] = 0.0f; ampOutEnv[ch] = 0.0f; ampMakeup[ch] = 1.0f;
    }
    dblWrite = 0; dblLfoPhase = 0.0f;
    std::fill (dblDl[0].begin(), dblDl[0].end(), 0.0f);
    std::fill (dblDl[1].begin(), dblDl[1].end(), 0.0f);
    dlyWrite = 0; dlySmSamp = -1.0f; dlyFbLp[0] = dlyFbLp[1] = 0.0f;
    std::fill (dlyBuf[0].begin(), dlyBuf[0].end(), 0.0f);
    std::fill (dlyBuf[1].begin(), dlyBuf[1].end(), 0.0f);
    tremPhase = 0.0f; tremGainSm[0] = tremGainSm[1] = 1.0f;
    psWrite = 0; psPhase = 0.0f; psRatioSm = 1.0f;
    std::fill (psBuf[0].begin(), psBuf[0].end(), 0.0f);
    std::fill (psBuf[1].begin(), psBuf[1].end(), 0.0f);
    arpStep = -1; arpFreeBeat = 0.0;
    std::fill (pdBuf.begin(), pdBuf.end(), 0.0f);
    pdWrite = 0; pdCountdown = 0; pdNote = -1.0f; harmShiftSm = 0.0f;
    for (auto& st : radioBp) { st[0] = {}; st[1] = {}; }
    radioBakedA = -1.0f; radioNoiseLp[0] = radioNoiseLp[1] = 0.0f; radioHum = 0.0f;
    if (shifter != nullptr && shifter->configured) { shifter->fine.reset(); shifter->live.reset(); }
    shiftSemiSm = 0.0f; formantSemiSm = 0.0f;
    std::fill (grainRing[0].begin(), grainRing[0].end(), 0.0f);
    std::fill (grainRing[1].begin(), grainRing[1].end(), 0.0f);
    grainWrite = 0; grainClock = 0.0f; grainBeat = 0.0; grainLastStep = -1;
    for (auto& g : grains) g = Grain {};
    grainNote = -1.0f; grainPdCountdown = 0;
    crushHold[0] = crushHold[1] = 0.0f; crushPhase = 0.0f;
    std::fill (shimWet[0].begin(), shimWet[0].end(), 0.0f);
    std::fill (shimWet[1].begin(), shimWet[1].end(), 0.0f);
    shimHp[0] = shimHp[1] = 0.0f; shimLp[0] = shimLp[1] = 0.0f;
    swellEnvFast = 0.0f; swellEnvSlow = 0.0f; swellGain = 1.0f; swellHold = 0;
    std::fill (stutBuf[0].begin(), stutBuf[0].end(), 0.0f);
    std::fill (stutBuf[1].begin(), stutBuf[1].end(), 0.0f);
    stutLen = 0; stutFill = 0; stutPos = 0; stutCell = -1; stutFreeBeat = 0.0;
    for (int ch = 0; ch < 2; ++ch) { airHp[ch] = {}; airHp2[ch] = {}; airShelf[ch] = {}; airDc[ch] = 0.0f; airEnv[ch] = 0.0f; }
    airBakedSr = 0.0f; airBakedA = -1.0f;
    ringPhase = 0.0f;
    gateEnv = 0.0f; gateOpen = false; gateHold = 0; gateGain = 1.0f;
    std::fill (wowDl[0].begin(), wowDl[0].end(), 0.0f);
    std::fill (wowDl[1].begin(), wowDl[1].end(), 0.0f);
    wowWrite = 0; wowPhase = 0.0f; wowFlutPhase = 0.0f; wowDrift = 0.0f; wowJitter = 0.0f;
}

//==============================================================================
void NodeState::process (const NodeParams& p, float sr, int n, float* L, float* R,
                         juce::AudioBuffer<float>& scratch)
{
    if (! isEffect (type)) return;
    const float twoPi = juce::MathConstants<float>::twoPi;
    const int variant = p.variant;
    if (variant != lastVar)
    {
        // Flavour switch is a LIGHT touch: keep the amount and the tails
        // so A/B is instant — just force filter re-bakes.
        lastVar = variant;
        if (type == kTape) cleanShelfBaked = -1.0f;
        if (type == kTone) tiltApplied = 999.0f;
        if (type == kCut)  cutBakedA = -1.0f;
    }

    const float target = juce::jlimit (0.0f, 1.0f, p.amount);
    const float alpha  = 1.0f - std::exp (-(float) n / (0.05f * sr));
    amtSm += (target - amtSm) * alpha;
    const float a = amtSm;

    // Neutral positions cost nothing.
    if (type == kTone || type == kStereoize || type == kPitch || type == kFormant)
                            { if (std::abs (a - 0.5f) < 0.004f && std::abs (target - 0.5f) < 0.004f
                                  && ! (type == kPitch && p.aux[0] != 0)) return; }
    else if (type == kGain) { if (variant == 0 && std::abs (a - 0.75f) < 0.002f
                                               && std::abs (target - 0.75f) < 0.002f)
                              { gainPrimed = false; return; } }
    else                    { if (a < 0.004f && target < 0.004f)
                              {
                                  if (type == kGlue) grDb = 0.0f;
                                  // Wet Solo at zero is silence, not a dry copy —
                                  // a parallel branch must not double the source.
                                  if (p.wet && (type == kSpace || type == kDelay || type == kDoubler || type == kMod || type == kHarmony || type == kGrain || type == kShimmer))
                                  {
                                      juce::FloatVectorOperations::clear (L, n);
                                      if (R != nullptr) juce::FloatVectorOperations::clear (R, n);
                                  }
                                  return;
                              } }

    switch (type)
    {
        case kTone:
        {
            // Tilt: dark ⟵ 0.5 ⟶ bright, ±6 dB split across two shelves.
            const float tilt = (a - 0.5f) * 12.0f;
            if (std::abs (tilt - tiltApplied) > 0.05f)
            {
                for (int ch = 0; ch < 2; ++ch)
                {
                    bakeShelf (false, -tilt, 300.0f,  sr, tiltLow[ch].b0,  tiltLow[ch].b1,  tiltLow[ch].b2,  tiltLow[ch].a1,  tiltLow[ch].a2);
                    bakeShelf (true,   tilt, 2800.0f, sr, tiltHigh[ch].b0, tiltHigh[ch].b1, tiltHigh[ch].b2, tiltHigh[ch].a1, tiltHigh[ch].a2);
                }
                tiltApplied = tilt;
            }
            for (int i = 0; i < n; ++i)
            {
                L[i] = tiltHigh[0].run (tiltLow[0].run (L[i]));
                if (R != nullptr) R[i] = tiltHigh[1].run (tiltLow[1].run (R[i]));
            }
            break;
        }

        case kCut:
        {
            // One knob, three scalpels: low cut sweeps 20 Hz → 5 kHz,
            // high cut sweeps 20 kHz → 63 Hz, band narrows a passband
            // around 800 Hz until only the telephone is left.
            if (std::abs (a - cutBakedA) > 0.0015f || variant != cutBakedVar)
            {
                float hpF = 0.0f, lpF = 0.0f;
                if (variant == 0)      hpF = 20.0f * std::pow (2.0f, a * 8.0f);
                else if (variant == 1) lpF = 20000.0f * std::pow (2.0f, -a * 8.3f);
                else
                {
                    const float w = 0.3f + (1.0f - a) * 9.0f;   // width, octaves
                    hpF = 800.0f / std::pow (2.0f, w * 0.5f);
                    lpF = 800.0f * std::pow (2.0f, w * 0.5f);
                }
                cutUseHp = hpF > 21.0f;
                cutUseLp = lpF > 0.0f && lpF < 19000.0f;
                for (int ch = 0; ch < 2; ++ch)
                {
                    if (cutUseHp)
                    {
                        const float f = juce::jlimit (10.0f, sr * 0.45f, hpF);
                        bakeCutFilter (true, f, sr, cutBqHp[ch].b0,  cutBqHp[ch].b1,  cutBqHp[ch].b2,  cutBqHp[ch].a1,  cutBqHp[ch].a2);
                        bakeCutFilter (true, f, sr, cutBqHp2[ch].b0, cutBqHp2[ch].b1, cutBqHp2[ch].b2, cutBqHp2[ch].a1, cutBqHp2[ch].a2);
                    }
                    if (cutUseLp)
                    {
                        const float f = juce::jlimit (40.0f, sr * 0.45f, lpF);
                        bakeCutFilter (false, f, sr, cutBqLp[ch].b0,  cutBqLp[ch].b1,  cutBqLp[ch].b2,  cutBqLp[ch].a1,  cutBqLp[ch].a2);
                        bakeCutFilter (false, f, sr, cutBqLp2[ch].b0, cutBqLp2[ch].b1, cutBqLp2[ch].b2, cutBqLp2[ch].a1, cutBqLp2[ch].a2);
                    }
                }
                cutBakedA = a; cutBakedVar = variant;
            }
            if (! cutUseHp && ! cutUseLp) break;
            for (int i = 0; i < n; ++i)
            {
                float x = L[i];
                if (cutUseHp) x = cutBqHp2[0].run (cutBqHp[0].run (x));
                if (cutUseLp) x = cutBqLp2[0].run (cutBqLp[0].run (x));
                L[i] = x;
                if (R != nullptr)
                {
                    float y = R[i];
                    if (cutUseHp) y = cutBqHp2[1].run (cutBqHp[1].run (y));
                    if (cutUseLp) y = cutBqLp2[1].run (cutBqLp[1].run (y));
                    R[i] = y;
                }
            }
            break;
        }

        case kAmp:
        {
            // clean / crunch / lead / fuzz — waveform-first this time.
            // Real amp gain structure: crunch lives around +36 dB, lead
            // stacks two stages to ~+58 dB, fuzz slams ~+52 dB into a
            // near-square. The shaper is a DIODE curve, not tanh —
            // lim * (1 - e^(-|x|/lim)) has the harder knee that actually
            // flattens the tops — and it's ASYMMETRIC (the negative lobe
            // clips earlier), which is where the amp "bark" lives.
            // Output stays LOUD: no drive-dependent shrink — a clipped
            // waveform is pinned near full scale like a real amp, only a
            // fixed trim per variant. Post: two-pole cab + a presence
            // tap (pole-1 minus pole-2 mixed back in).
            const bool isClean  = variant == 0;
            const bool isCrunch = variant == 1;
            const bool isLead   = variant == 2;
            const bool isFuzz   = variant == 3;

            // input gain — the whole game
            const float g1 = isClean  ? 2.0f  + a * 6.0f
                           : isCrunch ? 8.0f  + a * 60.0f
                           : isLead   ? 6.0f  + a * 28.0f
                           :            30.0f + a * 400.0f;
            const float g2 = isLead ? 4.0f + a * 22.0f : 0.0f;   // lead stage 2

            // clip ceilings: positive/negative lobes (asymmetric)
            const float limP = isFuzz ? 0.75f : 0.70f;
            const float limN = isClean ? 0.80f : isFuzz ? 0.55f : 0.62f;

            const float midG = isClean ? 0.2f : isCrunch ? 1.1f : isLead ? 1.6f : 0.5f;
            // Character trim only — loudness is handled by the auto-gain
            // below, which matches output energy to input energy so the
            // amp distorts without becoming a volume jump.
            const float outT = isClean ? 1.0f : isCrunch ? 1.05f : isLead ? 1.0f : 0.95f;
            const float pres = isClean ? 0.5f : isCrunch ? 0.4f : isLead ? 0.3f : 0.2f;

            const float hpF = isFuzz ? 55.0f : isLead ? 110.0f : isCrunch ? 85.0f : 70.0f;
            const float lpF = isClean  ? 7500.0f - a * 1500.0f
                            : isCrunch ? 5800.0f - a * 1000.0f
                            : isLead   ? 5200.0f - a * 900.0f
                            :            4600.0f - a * 700.0f;
            const float hpK  = 1.0f - std::exp (-twoPi * hpF / sr);
            const float lpK  = 1.0f - std::exp (-twoPi * lpF / sr);
            const float dcK  = 1.0f - std::exp (-twoPi * 12.0f / sr);
            const float cplK = 1.0f - std::exp (-twoPi * 40.0f / sr);   // stage coupling cap
            const float mLoK = 1.0f - std::exp (-twoPi * 350.0f / sr);
            const float mHiK = 1.0f - std::exp (-twoPi * 1800.0f / sr);
            const float envA = 1.0f - std::exp (-twoPi * 30.0f / sr);
            const float envR = 1.0f - std::exp (-twoPi * 2.0f / sr);
            // auto-gain followers: slow (≈400 ms) so the makeup breathes,
            // never pumps; the ratio is clamped so silence can't blow up.
            const float agK  = 1.0f - std::exp (-twoPi * 0.4f / sr);

            // diode-knee clipper: hard-ish, per-lobe ceiling
            auto diode = [limP, limN] (float x) noexcept -> float
            {
                if (x >= 0.0f) return limP * (1.0f - std::exp (-x / limP));
                return -limN * (1.0f - std::exp (x / limN));
            };

            const int chs = R != nullptr ? 2 : 1;
            for (int i = 0; i < n; ++i)
                for (int ch = 0; ch < chs; ++ch)
                {
                    float* S = ch == 1 ? R : L;
                    ampHpState[ch] += (S[i] - ampHpState[ch]) * hpK;
                    float t = S[i] - ampHpState[ch];

                    // pre-clip mid emphasis
                    ampMidLo[ch] += (t - ampMidLo[ch]) * mLoK;
                    ampMidHi[ch] += (t - ampMidHi[ch]) * mHiK;
                    t += midG * (ampMidHi[ch] - ampMidLo[ch]);

                    float y;
                    if (isFuzz)
                    {
                        // bias sag: the envelope pulls the operating point
                        // down so decaying notes sputter and gate.
                        const float at = std::abs (t);
                        ampEnv[ch] += (at - ampEnv[ch]) * (at > ampEnv[ch] ? envA : envR);
                        const float bias = -0.55f * juce::jmin (1.0f, ampEnv[ch] * g1 * 0.15f);
                        y = diode (g1 * t + bias);
                        // second squash toward square
                        y = juce::jlimit (-limN, limP, y * 1.6f);
                    }
                    else if (isLead)
                    {
                        // stage 1 clips, the coupling cap re-centres,
                        // stage 2 clips again — cascaded like channels
                        // in a high-gain preamp.
                        const float s1 = diode (g1 * t);
                        ampStageHp[ch] += (s1 - ampStageHp[ch]) * cplK;
                        y = diode (g2 * (s1 - ampStageHp[ch]));
                    }
                    else
                    {
                        y = diode (g1 * t);
                    }

                    ampDcState[ch] += (y - ampDcState[ch]) * dcK;
                    y -= ampDcState[ch];

                    // two-pole cab + presence tap
                    ampLpState[ch]  += (y - ampLpState[ch]) * lpK;
                    ampLp2State[ch] += (ampLpState[ch] - ampLp2State[ch]) * lpK;
                    const float shaped = (ampLp2State[ch] + pres * (ampLpState[ch] - ampLp2State[ch])) * outT;

                    // loudness-matching makeup: track in/out energy and
                    // ride the ratio (0.05×–1.5×), smoothed by agK.
                    const float inSq  = S[i] * S[i];
                    const float outSq = shaped * shaped;
                    ampInEnv[ch]  += (inSq  - ampInEnv[ch])  * agK;
                    ampOutEnv[ch] += (outSq - ampOutEnv[ch]) * agK;
                    const float eps = 1.0e-6f;
                    const float target = juce::jlimit (0.05f, 1.5f,
                        std::sqrt ((ampInEnv[ch] + eps) / (ampOutEnv[ch] + eps)));
                    ampMakeup[ch] += (target - ampMakeup[ch]) * agK;
                    S[i] = shaped * ampMakeup[ch];
                }
            break;
        }

        case kTape:
        {
            if (variant == 0)
            {
                // HARD — full-band tanh drive with loudness compensation and
                // a darkening one-pole (16k pushed toward 6.5k with drive).
                const float drive = 1.0f + a * 9.0f;
                const float comp  = 1.0f / std::sqrt (drive);
                const float fc    = 16000.0f - a * 9500.0f;
                const float k     = 1.0f - std::exp (-twoPi * fc / sr);
                for (int i = 0; i < n; ++i)
                {
                    {
                        const float shaped = std::tanh (drive * L[i]) * comp;
                        tapeLpState[0] += (shaped - tapeLpState[0]) * k;
                        L[i] = tapeLpState[0];
                    }
                    if (R != nullptr)
                    {
                        const float shaped = std::tanh (drive * R[i]) * comp;
                        tapeLpState[1] += (shaped - tapeLpState[1]) * k;
                        R[i] = tapeLpState[1];
                    }
                }
            }
            else
            {
                // CLEAN — the lows pass untouched; only the band above
                // ~800 Hz saturates, gently, and a small shelf above 2.5k
                // opens the top. Two cascaded one-poles (12 dB/oct) keep
                // the low band genuinely clean. Cool, airy, still glued.
                const float drive = 1.0f + a * 2.5f;
                const float comp  = 1.0f / std::sqrt (drive);
                const float xok   = 1.0f - std::exp (-twoPi * 800.0f / sr);
                const float shelfDb = a * 4.5f;
                if (std::abs (shelfDb - cleanShelfBaked) > 0.05f)
                {
                    for (int ch = 0; ch < 2; ++ch)
                        bakeShelf (true, shelfDb, 2500.0f, sr,
                                   cleanShelf[ch].b0, cleanShelf[ch].b1, cleanShelf[ch].b2,
                                   cleanShelf[ch].a1, cleanShelf[ch].a2);
                    cleanShelfBaked = shelfDb;
                }
                for (int i = 0; i < n; ++i)
                {
                    {
                        cleanXoState[0]  += (L[i] - cleanXoState[0]) * xok;
                        cleanXoState2[0] += (cleanXoState[0] - cleanXoState2[0]) * xok;
                        const float lo = cleanXoState2[0];
                        const float hi = L[i] - lo;
                        L[i] = cleanShelf[0].run (lo + std::tanh (drive * hi) * comp);
                    }
                    if (R != nullptr)
                    {
                        cleanXoState[1]  += (R[i] - cleanXoState[1]) * xok;
                        cleanXoState2[1] += (cleanXoState[1] - cleanXoState2[1]) * xok;
                        const float lo = cleanXoState2[1];
                        const float hi = R[i] - lo;
                        R[i] = cleanShelf[1].run (lo + std::tanh (drive * hi) * comp);
                    }
                }
            }
            break;
        }

        case kDoubler:
        {
            if (dblDl[0].empty()) break;
            // Two detuned ghosts on asymmetric taps — reads as extra takes,
            // not an effect. A slow quadrature LFO drifts the pitch the way
            // human timing does.
            const int len = (int) dblDl[0].size();
            const bool wide = variant == 1;
            const float baseL = (wide ? 0.023f : 0.013f) * sr;
            const float baseR = (wide ? 0.031f : 0.018f) * sr;
            const float depth = (wide ? 0.0035f : 0.0020f) * sr;
            const float inc   = 0.32f / sr;
            const float mix   = a * 0.72f;
            const float duck  = p.wet ? 0.0f : 1.0f - mix * 0.30f;   // wet: ghosts only
            for (int i = 0; i < n; ++i)
            {
                dblLfoPhase += inc; if (dblLfoPhase >= 1.0f) dblLfoPhase -= 1.0f;
                dblDl[0][(size_t) dblWrite] = L[i];
                dblDl[1][(size_t) dblWrite] = R != nullptr ? R[i] : L[i];
                const float lfoL = std::sin (twoPi * dblLfoPhase);
                const float lfoR = std::sin (twoPi * dblLfoPhase + 1.5708f);
                const auto tap = [&] (int ch, float pos) -> float
                {
                    float rp = (float) dblWrite - pos;
                    while (rp < 0.0f) rp += (float) len;
                    const int   i0 = (int) rp;
                    const float fr = rp - (float) i0;
                    const int   i1 = i0 + 1 < len ? i0 + 1 : 0;
                    return dblDl[ch][(size_t) i0] * (1.0f - fr) + dblDl[ch][(size_t) i1] * fr;
                };
                L[i] = L[i] * duck + tap (0, baseL + depth * (0.5f + 0.5f * lfoL)) * mix;
                if (R != nullptr)
                    R[i] = R[i] * duck + tap (1, baseR + depth * (0.5f + 0.5f * lfoR)) * mix;
                dblWrite = dblWrite + 1 < len ? dblWrite + 1 : 0;
            }
            break;
        }

        case kDelay:
        {
            if (dlyBuf[0].empty()) break;
            // BPM-synced echo. The knob is the mix; the print's two hands
            // set the beat division and the feedback. The read head GLIDES
            // to a new length (tape-style repitch) so tempo and division
            // changes bend instead of clicking.
            static constexpr float divBeats[7] = { 0.25f, 1.0f / 3.0f, 0.5f, 0.75f, 1.0f, 1.5f, 2.0f };
            const int   di   = juce::jlimit (0, 6, p.delayDiv);
            const float bpm  = (float) juce::jlimit (30.0, 300.0, (double) p.bpm);
            const int   len  = (int) dlyBuf[0].size();
            const float secs = juce::jlimit (0.03f, 2.8f, (60.0f / bpm) * divBeats[di]);
            const float targ = juce::jmin ((float) len - 4.0f, secs * sr);
            if (dlySmSamp < 0.0f) dlySmSamp = targ;
            const float smK  = 1.0f - std::exp (-1.0f / (0.12f * sr));
            const float fb   = juce::jlimit (0.0f, 0.85f, p.delayFb * 0.85f);
            const float mix  = a * 0.62f;
            const float duck = p.wet ? 0.0f : 1.0f - mix * 0.25f;   // wet: echoes only
            const bool  tapeFl = variant == 1;
            const bool  ping   = variant == 2;
            const float lpK  = 1.0f - std::exp (-twoPi * 3200.0f / sr);
            for (int i = 0; i < n; ++i)
            {
                dlySmSamp += (targ - dlySmSamp) * smK;
                const auto rd = [&] (int ch) -> float
                {
                    float rp = (float) dlyWrite - dlySmSamp;
                    while (rp < 0.0f) rp += (float) len;
                    const int   i0 = (int) rp;
                    const float fr = rp - (float) i0;
                    const int   i1 = i0 + 1 < len ? i0 + 1 : 0;
                    return dlyBuf[ch][(size_t) i0] * (1.0f - fr) + dlyBuf[ch][(size_t) i1] * fr;
                };
                const float wetL = rd (0);
                const float wetR = rd (1);
                const float inL = L[i];
                const float inR = R != nullptr ? R[i] : inL;
                float fbL = wetL, fbR = wetR;
                if (tapeFl)
                {
                    // tape loop: darker and softer with every pass
                    dlyFbLp[0] += (wetL - dlyFbLp[0]) * lpK;
                    dlyFbLp[1] += (wetR - dlyFbLp[1]) * lpK;
                    fbL = std::tanh (dlyFbLp[0] * 1.15f);
                    fbR = std::tanh (dlyFbLp[1] * 1.15f);
                }
                if (ping)
                {
                    // mono into the left line; each side regenerates the other
                    const float mono = 0.5f * (inL + inR);
                    dlyBuf[0][(size_t) dlyWrite] = mono + fbR * fb;
                    dlyBuf[1][(size_t) dlyWrite] = fbL * fb;
                }
                else
                {
                    dlyBuf[0][(size_t) dlyWrite] = inL + fbL * fb;
                    dlyBuf[1][(size_t) dlyWrite] = inR + fbR * fb;
                }
                L[i] = inL * duck + wetL * mix;
                if (R != nullptr) R[i] = inR * duck + wetR * mix;
                dlyWrite = dlyWrite + 1 < len ? dlyWrite + 1 : 0;
            }
            break;
        }

        case kSpace:
        {
            // The reverb hears a high-passed send (~170 Hz), so the lows
            // stay bone dry; the dry path is untouched full-band.
            // Three very different rooms: cathedral-long hall, a tight dead
            // room (quieter for the same knob), and a bright dense plate.
            // The second hand: per-flavour decay, 0.5 = the stock room —
            // it trims roomSize around each flavour's centre.
            const float d = juce::jlimit (0.0f, 1.0f,
                p.decay);
            juce::Reverb::Parameters pr;
            float wetScale;
            if (variant == 0)      { pr.roomSize = juce::jlimit (0.0f,  1.0f, 0.769f + d * 0.191f);        pr.damping = 0.12f; pr.width = 1.0f;  wetScale = 0.95f; }  // hall — RT60 2.5..7 s
            else if (variant == 1) { pr.roomSize = juce::jlimit (0.02f, 1.0f, 0.16f + (d - 0.5f) * 0.44f); pr.damping = 0.80f; pr.width = 0.65f; wetScale = 0.60f; }  // room
            else                   { pr.roomSize = juce::jlimit (0.0f,  1.0f, 0.50f + (d - 0.5f) * 0.70f); pr.damping = 0.03f; pr.width = 1.0f;  wetScale = 0.85f; }  // plate
            pr.wetLevel   = 1.0f;
            pr.dryLevel   = 0.0f;
            pr.freezeMode = 0.0f;
            fxReverb.setParameters (pr);

            if (scratch.getNumSamples() < n)
                scratch.setSize (2, n, false, false, true);
            float* wl = scratch.getWritePointer (0);
            float* wr = scratch.getWritePointer (1);
            const float hpk = 1.0f - std::exp (-twoPi * 170.0f / sr);
            for (int i = 0; i < n; ++i)
            {
                sendHpState[0] += (L[i] - sendHpState[0]) * hpk;
                wl[i] = L[i] - sendHpState[0];
                if (R != nullptr)
                {
                    sendHpState[1] += (R[i] - sendHpState[1]) * hpk;
                    wr[i] = R[i] - sendHpState[1];
                }
                else wr[i] = wl[i];
            }
            fxReverb.processStereo (wl, wr, n);

            const float wet = a * wetScale;
            const float dry = p.wet ? 0.0f : 1.0f - a * 0.2f;   // wet: the room only
            for (int i = 0; i < n; ++i)
            {
                L[i] = L[i] * dry + wl[i] * wet;
                if (R != nullptr) R[i] = R[i] * dry + wr[i] * wet;
            }
            break;
        }

        case kStereoize:
        {
            // Phase-based width: rotate the mid through a small allpass
            // chain and inject the rotated signal ANTISYMMETRICALLY
            // (+ into L, − into R). The mono sum is bit-identical to the
            // input — width for free, no mono penalty. Lows are kept
            // centred by high-passing the side send at ~180 Hz.
            if (R == nullptr) break;   // needs stereo
            static const float apFreqs[4] = { 240.0f, 900.0f, 2800.0f, 7000.0f };
            float c[4];
            for (int st = 0; st < 4; ++st)
            {
                const float t = std::tan (juce::MathConstants<float>::pi * apFreqs[st] / sr);
                c[st] = (t - 1.0f) / (t + 1.0f);
            }
            const float hpK = 1.0f - std::exp (-twoPi * 180.0f / sr);
            // Ozone-style imaging: WIDTH scales the side that is already
            // there (polar samples pushed outward, direction preserved —
            // a left-leaning source stays left, just wider). The allpass
            // rotation only tops up decorrelation for near-mono sources.
            // bipolar: the middle leaves the image alone; left of it the
            // side fades out (−100 = mono), right of it the image widens
            const float wide   = juce::jmax (0.0f, (a - 0.5f) * 2.0f);
            const float keepS  = juce::jmin (1.0f, a * 2.0f);          // 0 at −100 … 1 from the middle up
            const float widthK = wide * 1.7f;   // extra gain on existing side (highs)
            const float synthK = wide * 0.35f;  // synthesized side, DEAD-MONO ONLY
            const float envK   = 1.0f - std::exp (-1.0f / (0.05f * sr));
            for (int i = 0; i < n; ++i)
            {
                const float mid   = 0.5f * (L[i] + R[i]);
                const float side0 = 0.5f * (L[i] - R[i]);
                // Ozone-style law: if the source already HAS a direction
                // (any real side energy — incl. hard-panned mono), width
                // must be a pure side rescale, so the polar plot stays a
                // straight line that only changes angle. The allpass
                // decorrelation would bend it into an arc — gate it down
                // to zero unless the input is essentially dead-centre.
                stEnvM += (std::abs (mid)   - stEnvM) * envK;
                stEnvS += (std::abs (side0) - stEnvS) * envK;
                float mono = 1.0f - stEnvS / (0.10f * stEnvM + 1.0e-9f);
                mono = juce::jlimit (0.0f, 1.0f, mono);
                mono *= mono;
                float x = mid;
                for (int st = 0; st < 4; ++st)
                {
                    const float y = c[st] * x + apState[st][0] - c[st] * apState[st][1];
                    apState[st][0] = x;
                    apState[st][1] = y;
                    x = y;
                }
                sideHpState  += (x - sideHpState) * hpK;          // HP the synth send
                const float synth = x - sideHpState;
                sideHpState2 += (side0 - sideHpState2) * hpK;     // HP the width boost
                const float sideHi = side0 - sideHpState2;        // lows stay centred
                const float sideOut = side0 * keepS + sideHi * widthK + synth * (synthK * mono);
                L[i] = mid + sideOut;
                R[i] = mid - sideOut;
            }
            break;
        }

        case kGlue:
        {
            // Stereo-linked 4:1 with programme-friendly times. The knob
            // lowers the threshold and adds matched makeup.
            const float threshDb = -2.0f - a * 20.0f;
            const float makeup   = std::pow (10.0f, (a * 5.0f) / 20.0f);
            const float atkK = 1.0f - std::exp (-1.0f / (0.008f * sr));
            const float relK = 1.0f - std::exp (-1.0f / (0.220f * sr));
            float grMax = 0.0f;
            for (int i = 0; i < n; ++i)
            {
                const float inMax = R != nullptr ? juce::jmax (std::abs (L[i]), std::abs (R[i]))
                                                 : std::abs (L[i]);
                glueEnv += (inMax - glueEnv) * (inMax > glueEnv ? atkK : relK);
                const float envDb = juce::Decibels::gainToDecibels (glueEnv, -80.0f);
                const float overDb = envDb - threshDb;
                const float grNow  = overDb > 0.0f ? overDb * 0.75f : 0.0f;   // 4:1
                grMax = juce::jmax (grMax, grNow);
                const float g = std::pow (10.0f, -grNow / 20.0f) * makeup;
                L[i] *= g;
                if (R != nullptr) R[i] *= g;
            }
            grDb = grMax;
            break;
        }

        case kGain:
        {
            // A fader, nothing more: 0.75 = unity, the bottom quarter dives
            // to −60 dB, the top quarter opens +12 dB. The variant bitmask
            // flips polarity per channel — the sign rides the same ramp as
            // the level, so even a flip mid-playback is a 5 ms crossfade
            // through zero instead of a click.
            const float db  = a < 0.75f ? (a / 0.75f - 1.0f) * 60.0f
                                        : (a - 0.75f) * 48.0f;
            const float lin = a < 0.0005f ? 0.0f : std::pow (10.0f, db / 20.0f);
            const float gl  = (variant & 1) != 0 ? -lin : lin;
            const float gr  = (variant & 2) != 0 ? -lin : lin;
            if (! gainPrimed) { gainPrev[0] = gl; gainPrev[1] = gr; gainPrimed = true; }
            const float inv = 1.0f / (float) n;
            for (int i = 0; i < n; ++i)
            {
                const float t = (float) (i + 1) * inv;
                L[i] *= gainPrev[0] + (gl - gainPrev[0]) * t;
                if (R != nullptr) R[i] *= gainPrev[1] + (gr - gainPrev[1]) * t;
            }
            gainPrev[0] = gl;
            gainPrev[1] = gr;
            break;
        }

        case kMod:
        {
            // One LFO, three machines. Chorus and flanger read a modulated
            // delay (R runs the LFO in quadrature, so the pair breathes wide);
            // the phaser sweeps a six-stage allpass ladder with feedback.
            if (modDl[0].empty()) break;
            const int len = (int) modDl[0].size();

            if (variant == 2)
            {
                // PHASER — 320 Hz..~2 kHz exponential sweep, slow and deep.
                const float inc = 0.35f / sr;
                const float fb  = 0.55f * a;
                const float mix = 0.5f  * a;
                const float dryK = p.wet ? 0.0f : 1.0f - mix;
                for (int i = 0; i < n; ++i)
                {
                    modLfoPhase += inc; if (modLfoPhase >= 1.0f) modLfoPhase -= 1.0f;
                    const int chs = R != nullptr ? 2 : 1;
                    for (int ch = 0; ch < chs; ++ch)
                    {
                        const float lfo = 0.5f + 0.5f * std::sin (twoPi * modLfoPhase + (ch == 1 ? 1.5708f : 0.0f));
                        const float f   = 320.0f * std::pow (2.0f, lfo * 2.6f);
                        const float tn  = std::tan (juce::MathConstants<float>::pi * f / sr);
                        const float c   = (tn - 1.0f) / (tn + 1.0f);
                        float* S = ch == 1 ? R : L;
                        float x = S[i] + phFb[ch] * fb;
                        for (int st = 0; st < 6; ++st)
                        {
                            const float y = c * x + phX1[st][ch] - c * phY1[st][ch];
                            phX1[st][ch] = x;
                            phY1[st][ch] = y;
                            x = y;
                        }
                        phFb[ch] = x;
                        S[i] = S[i] * dryK + x * mix;
                    }
                }
            }
            else
            {
                // CHORUS — lush doubling around 8 ms, no feedback.
                // FLANGER — jet swing down near 1 ms with regeneration.
                const bool  fl    = variant == 1;
                const float inc   = (fl ? 0.22f : 0.85f) / sr;
                const float base  = (fl ? 0.0009f : 0.008f)  * sr;
                const float depth = (fl ? 0.0032f : 0.0045f) * sr * a;
                const float fb    = fl ? 0.6f  * a : 0.0f;
                const float mix   = fl ? 0.55f * a : 0.5f * a;
                const float dryK  = p.wet ? 0.0f : 1.0f - mix * 0.55f;
                for (int i = 0; i < n; ++i)
                {
                    modLfoPhase += inc; if (modLfoPhase >= 1.0f) modLfoPhase -= 1.0f;
                    const int chs = R != nullptr ? 2 : 1;
                    for (int ch = 0; ch < chs; ++ch)
                    {
                        const float lfo = 0.5f + 0.5f * std::sin (twoPi * modLfoPhase + (ch == 1 ? 1.5708f : 0.0f));
                        float rp = (float) modWrite - (base + depth * lfo);
                        while (rp < 0.0f) rp += (float) len;
                        const int   i0 = (int) rp;
                        const float fr = rp - (float) i0;
                        const int   i1 = i0 + 1 < len ? i0 + 1 : 0;
                        const float wet = modDl[ch][(size_t) i0] * (1.0f - fr)
                                        + modDl[ch][(size_t) i1] * fr;
                        float* S = ch == 1 ? R : L;
                        modDl[ch][(size_t) modWrite] = S[i] + wet * fb;
                        S[i] = S[i] * dryK + wet * mix;
                    }
                    if (R == nullptr) modDl[1][(size_t) modWrite] = modDl[0][(size_t) modWrite];
                    modWrite = modWrite + 1 < len ? modWrite + 1 : 0;
                }
            }
            break;
        }

        case kTremolo:
        {
            // Volume (or pan) chased by a tempo-locked cycle. Shapes: sine,
            // triangle, square, pulse, saw — or whatever was drawn on the
            // print. Depth is the knob; the cycle is one beat division.
            const int   di    = juce::jlimit (0, 6, p.delayDiv);
            const float cycle = kDivBeats[di];
            const bool  pan   = p.aux[0] == 1 && R != nullptr;
            const float depth = a;
            const float slewK = 1.0f - std::exp (-1.0f / (0.0015f * sr));   // 1.5 ms: squares stay clean
            const double perSample = (double) p.bpm / 60.0 / (double) sr / (double) cycle;
            auto shapeAt = [&] (float ph) -> float
            {
                if (p.hasCurve)
                {
                    const float x  = ph * (float) kCurveLen;
                    const int   i0 = ((int) x) % kCurveLen;
                    const int   i1 = (i0 + 1) % kCurveLen;
                    const float fr = x - std::floor (x);
                    return p.curve[i0] * (1.0f - fr) + p.curve[i1] * fr;
                }
                switch (variant)
                {
                    case 1:  return 1.0f - 2.0f * std::abs (ph - 0.5f);            // triangle
                    case 2:  return ph < 0.5f ? 0.0f : 1.0f;                          // square: the dip first
                    case 3:  return ph < 0.25f ? 0.0f : 1.0f;                         // pulse: a short dip
                    case 4:  return ph;                                               // saw: rises, drops
                    default: return 0.5f + 0.5f * std::cos (twoPi * ph);              // sine
                }
            };
            for (int i = 0; i < n; ++i)
            {
                float ph;
                if (p.playing)
                {
                    const double b = (p.ppq + (double) p.bpm / 60.0 / (double) sr * (double) i) / (double) cycle;
                    ph = (float) (b - std::floor (b));
                    tremPhase = ph;
                }
                else
                {
                    tremPhase += (float) perSample;
                    tremPhase -= std::floor (tremPhase);
                    ph = tremPhase;
                }
                const float sh = juce::jlimit (0.0f, 1.0f, shapeAt (ph));
                if (! pan)
                {
                    const float g = 1.0f - depth * (1.0f - sh);
                    tremGainSm[0] += (g - tremGainSm[0]) * slewK;
                    L[i] *= tremGainSm[0];
                    if (R != nullptr) R[i] *= tremGainSm[0];
                }
                else
                {
                    // constant power: centre = unity both sides
                    const float pos = (sh - 0.5f) * 2.0f * depth;   // −1 (left) .. +1 (right)
                    const float ang = (pos + 1.0f) * juce::MathConstants<float>::pi * 0.25f;
                    const float gl = std::cos (ang) * 1.41421356f;
                    const float gr = std::sin (ang) * 1.41421356f;
                    tremGainSm[0] += (gl - tremGainSm[0]) * slewK;
                    tremGainSm[1] += (gr - tremGainSm[1]) * slewK;
                    L[i] *= tremGainSm[0];
                    R[i] *= tremGainSm[1];
                }
            }
            break;
        }

        case kArp:
        {
            // The audio climbs a ladder: every beat division the pitch
            // jumps by `interval` semitones, up to `range` (the knob, 0..24
            // st), in the pattern's order, then wraps. Whole signal shifted.
            const int   di       = juce::jlimit (0, 6, p.delayDiv);
            const float stepBeat = kDivBeats[di];
            const int   interval = juce::jlimit (1, 12, p.aux[0] == 0 ? 12 : p.aux[0]);
            // the ladder's height is a discrete choice — read the hand itself,
            // not the glided amount (which only ever approaches its target)
            const float range    = juce::jlimit (0.0f, 1.0f, p.amount) * 24.0f;
            const int   count    = juce::jmax (1, (int) std::floor (range / (float) interval + 0.02f) + 1);
            // which step are we on at block start?
            const double beat = beatAt (p, arpFreeBeat, 0, sr);
            const int idx = (int) std::floor (beat / (double) stepBeat);
            // up climbs 0, +i, +2i…; down descends 0, −i, −2i…; up-down
            // bounces between the ends; random picks a rung each step.
            int k;
            switch (variant)
            {
                case 2:  { const int per = juce::jmax (1, 2 * count - 2); const int m = idx % per;
                           k = m < count ? m : per - m; break; }
                case 3:  { unsigned h = (unsigned) idx * 2654435761u; h ^= h >> 13; h *= 0x5bd1e995u; h ^= h >> 15;
                           k = (int) (h % (unsigned) count); break; }
                default: k = idx % count; break;
            }
            arpStep = k;
            const float semis = (float) (k * interval) * (variant == 1 ? -1.0f : 1.0f);
            if (shifter != nullptr)
            {
                auto& eng = shifter->st (true);
                eng.setTransposeSemitones (semis, 8000.0f / sr);
                eng.setFormantSemitones (0.0f, false);
                shiftBlock (*this, true, n, L, R);
            }
            else pitchShiftBlock (*this, std::pow (2.0f, semis / 12.0f), sr, n, L, R);
            if (! p.playing) arpFreeBeat += (double) p.bpm / 60.0 / (double) sr * (double) n;
            break;
        }

        case kRadio:
        {
            // Knob up = through a small speaker in a small box: mono, a
            // narrowing band around 1.6 kHz, driven into a soft clip, with
            // hiss and a little hum riding underneath. Dry fades to it.
            if (std::abs (a - radioBakedA) > 0.002f)
            {
                const float q  = 0.7f + a * 2.6f;
                const float fc = 1600.0f;
                const float w0 = twoPi * fc / sr;
                const float al = std::sin (w0) / (2.0f * q);
                const float b0 = al, b1 = 0.0f, b2 = -al;
                const float a0 = 1.0f + al, a1c = -2.0f * std::cos (w0), a2c = 1.0f - al;
                for (auto& st : radioBp)
                    for (auto& bq : st)
                    { bq.b0 = b0 / a0; bq.b1 = b1 / a0; bq.b2 = b2 / a0; bq.a1 = a1c / a0; bq.a2 = a2c / a0; }
                radioBakedA = a;
            }
            const bool  phone = variant == 1;
            const float drive = 1.0f + a * (phone ? 3.0f : 7.0f);
            const float comp  = 1.0f / std::sqrt (drive) * (1.0f + a * 1.6f);   // the band loses energy: make it up
            const float hiss  = a * a * (phone ? 0.006f : 0.012f);
            const float hum   = a * a * (phone ? 0.0f : 0.006f);
            const float humInc = twoPi * 60.0f / sr;
            const float nlpK  = 1.0f - std::exp (-twoPi * 3000.0f / sr);
            const float mix   = a;
            for (int i = 0; i < n; ++i)
            {
                const float dryL = L[i];
                const float dryR = R != nullptr ? R[i] : L[i];
                float x = 0.5f * (dryL + dryR);
                x = std::tanh (drive * x) * comp;
                x = radioBp[0][1].run (radioBp[0][0].run (x));
                // hiss: white noise, dulled; hum: a 60 Hz whisper
                radioRng = radioRng * 1664525u + 1013904223u;
                const float white = ((float) (radioRng >> 8) / 8388608.0f) - 1.0f;
                radioNoiseLp[0] += (white - radioNoiseLp[0]) * nlpK;
                radioHum += humInc; if (radioHum > twoPi) radioHum -= twoPi;
                x += radioNoiseLp[0] * hiss + std::sin (radioHum) * hum;
                L[i] = dryL * (1.0f - mix) + x * mix;
                if (R != nullptr) R[i] = dryR * (1.0f - mix) + x * mix;
            }
            break;
        }

        case kHarmony:
        {
            // A second voice: in `key`, some scale degrees above or below
            // whatever is being played (the tracker listens), or a fixed
            // chromatic interval. The knob is the voice's level; the dry
            // stays. Shifts glide so a tracked note change never zips.
            const bool chromatic = variant == 1;
            const int  keyRoot   = ((p.aux[0] % 12) + 12) % 12;
            const int  scale     = p.aux[1] == 1 ? 1 : 0;
            const int  degrees   = juce::jlimit (-14, 14, p.aux[2] == 0 ? 2 : p.aux[2]);
            // feed the tracker (mono), analyse every ~1024 samples
            const int plen = (int) pdBuf.size();
            for (int i = 0; i < n; ++i)
            {
                pdBuf[(size_t) pdWrite] = R != nullptr ? 0.5f * (L[i] + R[i]) : L[i];
                pdWrite = pdWrite + 1 < plen ? pdWrite + 1 : 0;
            }
            pdCountdown -= n;
            float targetShift = chromatic ? (float) degrees : harmShiftSm;
            if (! chromatic)
            {
                if (pdCountdown <= 0)
                {
                    pdCountdown = 1024;
                    const float note = trackPitch (*this, sr);
                    if (note > 0.0f) pdNote = note;
                }
                if (pdNote > 0.0f) targetShift = diatonicShift (pdNote, keyRoot, scale, degrees);
                else               targetShift = (float) (degrees > 0 ? 4 : -3);   // nothing to track yet: a third
            }
            const float glideK = 1.0f - std::exp (-(float) n / (0.012f * sr));
            harmShiftSm += (targetShift - harmShiftSm) * glideK;
            // the voice is shifted in the scratch buffer, then layered
            if (scratch.getNumSamples() < n) scratch.setSize (2, n, false, false, true);
            float* vl = scratch.getWritePointer (0);
            float* vr = scratch.getWritePointer (1);
            juce::FloatVectorOperations::copy (vl, L, n);
            juce::FloatVectorOperations::copy (vr, R != nullptr ? R : L, n);
            if (shifter != nullptr)
            {
                auto& eng = shifter->st (false);
                eng.setTransposeSemitones (harmShiftSm, 8000.0f / sr);
                eng.setFormantSemitones (0.0f, true);   // the second voice keeps its own throat
                shiftBlock (*this, false, n, vl, vr);
            }
            else pitchShiftBlock (*this, std::pow (2.0f, harmShiftSm / 12.0f), sr, n, vl, vr);
            const float lvl = a * 0.9f;
            const float dry = p.wet ? 0.0f : 1.0f - a * 0.15f;
            for (int i = 0; i < n; ++i)
            {
                L[i] = L[i] * dry + vl[i] * lvl;
                if (R != nullptr) R[i] = R[i] * dry + vr[i] * lvl;
            }
            break;
        }

        case kPitch:
        {
            // Clean transposition: the knob is ±12 semitones around the
            // middle, the second hand adds cents. `natural` keeps the
            // formants where they were (a voice stays the same person);
            // `raw` shifts everything, the classic tape-speed colour.
            if (shifter == nullptr) break;
            const bool liveMode = p.aux[1] == 1;
            auto& eng = shifter->st (liveMode);
            const float semis = (a - 0.5f) * 24.0f + (float) juce::jlimit (-100, 100, p.aux[0]) / 100.0f;
            const float k = 1.0f - std::exp (-(float) n / (0.02f * sr));
            shiftSemiSm += (semis - shiftSemiSm) * k;
            eng.setTransposeSemitones (shiftSemiSm, 8000.0f / sr);
            eng.setFormantSemitones (0.0f, variant == 1);   // `natural` (1) keeps the formants; `raw` (0) moves everything
            eng.setFormantBase (0.0f);
            shiftBlock (*this, liveMode, n, L, R);
            break;
        }

        case kFormant:
        {
            // The vowel colour moves, the pitch does not: ±12 semitones of
            // formant shift around the middle.
            if (shifter == nullptr) break;
            const bool liveMode = p.aux[0] == 1;
            auto& eng = shifter->st (liveMode);
            const float fs = (a - 0.5f) * 24.0f;
            const float k = 1.0f - std::exp (-(float) n / (0.02f * sr));
            formantSemiSm += (fs - formantSemiSm) * k;
            eng.setTransposeSemitones (0.0f, 8000.0f / sr);
            eng.setFormantSemitones (formantSemiSm, false);
            eng.setFormantBase (0.0f);
            shiftBlock (*this, liveMode, n, L, R);
            break;
        }

        case kVoice:
        {
            // Another person: pitch and formant move together in the
            // proportions a throat would. The knob is how far.
            if (shifter == nullptr) break;
            float ps = 0, fs = 0;
            switch (variant)
            {
                case 1:  ps = -5.0f;  fs = -3.5f; break;   // male
                case 2:  ps = 9.0f;   fs = 5.5f;  break;   // child
                case 3:  ps = -10.0f; fs = -7.0f; break;   // giant
                default: ps = 5.0f;   fs = 3.5f;  break;   // female
            }
            auto& eng = shifter->st (false);
            const float k = 1.0f - std::exp (-(float) n / (0.02f * sr));
            shiftSemiSm   += (ps * a - shiftSemiSm) * k;
            formantSemiSm += (fs * a - formantSemiSm) * k;
            eng.setTransposeSemitones (shiftSemiSm, 8000.0f / sr);
            eng.setFormantSemitones (formantSemiSm, false);
            eng.setFormantBase (0.0f);
            shiftBlock (*this, false, n, L, R);
            break;
        }

        case kGrain:
        {
            // A cloud of grains read from the last two seconds: `size` is a
            // grain's length, `spray` how far back it may start, `scatter`
            // how far its pitch may wander — in the KEY (the tracker hears
            // the source; each grain lands on a scale degree), on a set of
            // clean intervals, in cents (thick, in tune), or free. Grains
            // scatter across the stereo field by `pan`. freeze holds the
            // buffer. cloud = free-running, stutter = new grains only on
            // the beat division, reverse = read backwards.
            if (grainRing[0].empty()) break;
            const int   ringLen = (int) grainRing[0].size();
            const float sizeMs  = (float) juce::jlimit (10, 600, p.aux[0] == 0 ? 120 : p.aux[0]);
            const float sprayMs = (float) juce::jlimit (0, 1500, p.aux[1]);
            const float scatter = (float) juce::jlimit (0, 24, p.aux[2]);
            const int   keyRoot = ((p.aux[3] % 12) + 12) % 12;
            const int   scale   = p.aux[4] == 1 ? 1 : 0;
            const float panSpread = juce::jlimit (0, 100, p.aux[5]) / 100.0f;
            const int   pmode   = juce::jlimit (0, 3, p.aux[6]);   // 0 key, 1 intervals, 2 cents, 3 free
            const bool  freeze  = p.aux[7] != 0;
            const float lenS    = sizeMs * 0.001f * sr;
            const float overlap = 3.0f;
            const float perSample = overlap / lenS;
            const bool  stutter = variant == 1, reverse = variant == 2;
            const int   di = juce::jlimit (0, 6, p.delayDiv);
            const float stepBeat = kDivBeats[di];
            const float wet = a, dry = p.wet ? 0.0f : 1.0f - a * 0.85f;
            auto rnd = [&] () { grainRng = grainRng * 1664525u + 1013904223u; return (float) (grainRng >> 8) / 16777216.0f; };
            // the tracker listens to what goes in (even while frozen, for the next thaw)
            {
                const int plen = (int) pdBuf.size();
                for (int i = 0; i < n; ++i)
                {
                    pdBuf[(size_t) pdWrite] = R != nullptr ? 0.5f * (L[i] + R[i]) : L[i];
                    pdWrite = pdWrite + 1 < plen ? pdWrite + 1 : 0;
                }
                grainPdCountdown -= n;
                if (pmode == 0 && grainPdCountdown <= 0)
                {
                    grainPdCountdown = 1024;
                    const float note = trackPitch (*this, sr);
                    if (note > 0.0f) grainNote = note;
                }
            }
            static const int kIntervals[] = { 0, 12, -12, 7, -5, 19, -17, 24, -24 };
            auto pickSemis = [&] () -> float
            {
                if (scatter <= 0.0f) return 0.0f;
                switch (pmode)
                {
                    case 0:   // key: a random scale-degree step, resolved against the tracked note
                    {
                        const int maxDeg = juce::jmax (1, (int) std::round (scatter / 1.7f));
                        const int d = (int) std::floor (rnd() * (2 * maxDeg + 1)) - maxDeg;
                        if (grainNote > 0.0f) return diatonicShift (grainNote, keyRoot, scale, d);
                        // nothing tracked yet: intervals of the scale from its root
                        static const int major[7] = { 0, 2, 4, 5, 7, 9, 11 }, minor[7] = { 0, 2, 3, 5, 7, 8, 10 };
                        const int* sc = scale == 1 ? minor : major;
                        const int oct = (int) std::floor ((float) d / 7.0f), td = ((d % 7) + 7) % 7;
                        return (float) (oct * 12 + sc[td]);
                    }
                    case 1:   // intervals: octaves and fifths within reach
                    {
                        int count = 0; for (int v : kIntervals) if (std::abs (v) <= scatter + 0.5f) ++count;
                        int pick = (int) std::floor (rnd() * (float) count); float out = 0.0f; int seen = 0;
                        for (int v : kIntervals) if (std::abs (v) <= scatter + 0.5f) { if (seen++ == pick) { out = (float) v; break; } }
                        return out;
                    }
                    case 2:   // cents: ±(scatter × 8) cents, in tune, thick
                        return (rnd() * 2.0f - 1.0f) * scatter * 0.08f;
                    default:  // free: chromatic
                        return std::round ((rnd() * 2.0f - 1.0f) * scatter);
                }
            };
            for (int i = 0; i < n; ++i)
            {
                if (! freeze)
                {
                    grainRing[0][(size_t) grainWrite] = L[i];
                    grainRing[1][(size_t) grainWrite] = R != nullptr ? R[i] : L[i];
                }
                bool spawn = false;
                if (stutter)
                {
                    const double beat = beatAt (p, grainBeat, i, sr);
                    const int step = (int) std::floor (beat / (double) stepBeat);
                    if (step != grainLastStep) { grainLastStep = step; spawn = true; }
                }
                else
                {
                    grainClock += perSample;
                    if (grainClock >= 1.0f) { grainClock -= 1.0f; spawn = true; }
                }
                if (spawn)
                {
                    for (auto& g : grains)
                    {
                        if (g.on) continue;
                        const float back = stutter ? 0.0f : rnd() * sprayMs * 0.001f * sr;
                        g.pos = (float) grainWrite - back - (reverse ? 0.0f : lenS);
                        while (g.pos < 0.0f) g.pos += (float) ringLen;
                        g.len = lenS; g.phase = 0.0f;
                        g.rate = std::pow (2.0f, pickSemis() / 12.0f) * (reverse ? -1.0f : 1.0f);
                        g.rev = reverse; g.amp = 0.7f + 0.3f * rnd(); g.on = true;
                        const float pan = (rnd() * 2.0f - 1.0f) * panSpread;   // −1..1
                        const float ang = (pan + 1.0f) * juce::MathConstants<float>::pi * 0.25f;
                        g.gl = std::cos (ang) * 1.41421356f; g.gr = std::sin (ang) * 1.41421356f;
                        break;
                    }
                }
                float outL = 0.0f, outR = 0.0f;
                for (auto& g : grains)
                {
                    if (! g.on) continue;
                    const float w = 0.5f - 0.5f * std::cos (juce::MathConstants<float>::twoPi * g.phase);
                    float rp = g.pos + (g.rev ? g.len : 0.0f) + g.phase * g.len * g.rate;
                    while (rp < 0.0f) rp += (float) ringLen;
                    while (rp >= (float) ringLen) rp -= (float) ringLen;
                    const int i0 = (int) rp; const float fr = rp - (float) i0; const int i1 = i0 + 1 < ringLen ? i0 + 1 : 0;
                    const float sl = grainRing[0][(size_t) i0] * (1.0f - fr) + grainRing[0][(size_t) i1] * fr;
                    const float sr2 = grainRing[1][(size_t) i0] * (1.0f - fr) + grainRing[1][(size_t) i1] * fr;
                    const float mono = 0.5f * (sl + sr2);
                    // spread: the grain's own stereo blends toward a mono source panned by its own hand
                    const float gsl = sl * (1.0f - panSpread) + mono * panSpread * g.gl;
                    const float gsr = sr2 * (1.0f - panSpread) + mono * panSpread * g.gr;
                    outL += w * g.amp * gsl;
                    outR += w * g.amp * gsr;
                    g.phase += 1.0f / g.len;
                    if (g.phase >= 1.0f) g.on = false;
                }
                const float norm = 0.55f;
                const float inR = R != nullptr ? R[i] : L[i];
                L[i] = L[i] * dry + outL * norm * wet;
                if (R != nullptr) R[i] = inR * dry + outR * norm * wet;
                if (! freeze) grainWrite = grainWrite + 1 < ringLen ? grainWrite + 1 : 0;
            }
            if (! p.playing) grainBeat += (double) p.bpm / 60.0 / (double) sr * (double) n;
            break;
        }

        case kCrush:
        {
            // Fewer bits, fewer samples: the knob takes 16 bits down toward
            // 2 and holds each sample longer. `bits` only quantises, `rate`
            // only decimates, `both` does what a cheap sampler did.
            const bool doBits = variant != 1, doRate = variant != 0;
            const float bits  = 16.0f - a * 14.0f;
            const float steps = std::pow (2.0f, bits - 1.0f);
            const float hold  = 1.0f + a * a * 60.0f;   // samples per held value
            for (int i = 0; i < n; ++i)
            {
                crushPhase += 1.0f;
                float xl = L[i], xr = R != nullptr ? R[i] : L[i];
                if (doRate)
                {
                    if (crushPhase >= hold) { crushPhase -= hold; crushHold[0] = xl; crushHold[1] = xr; }
                    xl = crushHold[0]; xr = crushHold[1];
                }
                if (doBits)
                {
                    xl = std::round (xl * steps) / steps;
                    xr = std::round (xr * steps) / steps;
                }
                L[i] = xl;
                if (R != nullptr) R[i] = xr;
            }
            break;
        }

        case kShimmer:
        {
            // A hall whose tail is pitched up and fed back into itself:
            // the last wet block passes through the shifter, is band-
            // limited and soft-clipped, and joins the send. The knob is
            // both the feedback and the wet.
            if (shifter == nullptr) break;
            const float semis = variant == 1 ? 7.0f : variant == 2 ? -12.0f : 12.0f;
            juce::Reverb::Parameters pr;
            pr.roomSize = 0.92f; pr.damping = 0.22f; pr.width = 1.0f;
            pr.wetLevel = 1.0f; pr.dryLevel = 0.0f; pr.freezeMode = 0.0f;
            fxReverb.setParameters (pr);
            if (scratch.getNumSamples() < n) scratch.setSize (2, n, false, false, true);
            float* wl = scratch.getWritePointer (0);
            float* wr = scratch.getWritePointer (1);
            const bool haveFb = n <= (int) shimWet[0].size();
            if (haveFb)
            {
                juce::FloatVectorOperations::copy (wl, shimWet[0].data(), n);
                juce::FloatVectorOperations::copy (wr, shimWet[1].data(), n);
                auto& eng = shifter->st (true);
                eng.setTransposeSemitones (semis, 8000.0f / sr);
                eng.setFormantSemitones (0.0f, false);
                eng.setFormantBase (0.0f);
                shiftBlock (*this, true, n, wl, wr);
            }
            else { juce::FloatVectorOperations::clear (wl, n); juce::FloatVectorOperations::clear (wr, n); }
            const float fb  = 0.25f + 0.5f * a;
            const float hpk = 1.0f - std::exp (-twoPi * 250.0f / sr);
            const float lpk = 1.0f - std::exp (-twoPi * 5500.0f / sr);
            const float inHpk = 1.0f - std::exp (-twoPi * 170.0f / sr);
            for (int i = 0; i < n; ++i)
            {
                shimHp[0] += (wl[i] - shimHp[0]) * hpk;  shimLp[0] += ((wl[i] - shimHp[0]) - shimLp[0]) * lpk;
                shimHp[1] += (wr[i] - shimHp[1]) * hpk;  shimLp[1] += ((wr[i] - shimHp[1]) - shimLp[1]) * lpk;
                const float f0 = std::tanh (shimLp[0] * fb);
                const float f1 = std::tanh (shimLp[1] * fb);
                sendHpState[0] += (L[i] - sendHpState[0]) * inHpk;
                const float inR = R != nullptr ? R[i] : L[i];
                sendHpState[1] += (inR - sendHpState[1]) * inHpk;
                wl[i] = (L[i] - sendHpState[0]) + f0;
                wr[i] = (inR  - sendHpState[1]) + f1;
            }
            fxReverb.processStereo (wl, wr, n);
            if (haveFb)
            {
                juce::FloatVectorOperations::copy (shimWet[0].data(), wl, n);
                juce::FloatVectorOperations::copy (shimWet[1].data(), wr, n);
            }
            const float wet = a * 0.9f;
            const float dry = p.wet ? 0.0f : 1.0f - a * 0.25f;
            for (int i = 0; i < n; ++i)
            {
                L[i] = L[i] * dry + wl[i] * wet;
                if (R != nullptr) R[i] = R[i] * dry + wr[i] * wet;
            }
            break;
        }

        case kSwell:
        {
            // Every onset restarts a slow fade-in, so plucks and hits bloom
            // like a bowed string. The knob is the rise (20 ms .. 1.5 s);
            // `soft` dips to a quarter, `hard` to silence.
            const float T     = 0.02f * std::pow (75.0f, a);
            const float rise  = 1.0f / (T * sr);
            const float relK  = 1.0f - std::exp (-1.0f / (0.03f * sr));
            const float slowK = 1.0f - std::exp (-1.0f / (0.15f * sr));
            const float depth  = juce::jlimit (0, 100, p.aux[0] > 0 || p.aux[1] == 1 ? p.aux[0] : 100) / 100.0f;   // aux[1] = 1 marks "depth was set"
            const float floorG = 1.0f - depth * (variant == 1 ? 1.0f : 0.75f);
            const int   holdN  = (int) (0.08f * sr);
            for (int i = 0; i < n; ++i)
            {
                const float x = juce::jmax (std::abs (L[i]), R != nullptr ? std::abs (R[i]) : 0.0f);
                if (x > swellEnvFast) swellEnvFast = x; else swellEnvFast += (x - swellEnvFast) * relK;
                if (swellHold > 0) --swellHold;
                else if (swellEnvFast > 2.5f * swellEnvSlow + 0.003f)
                {
                    swellGain = juce::jmin (swellGain, floorG);
                    swellHold = holdN;
                }
                swellEnvSlow += (swellEnvFast - swellEnvSlow) * slowK;
                swellGain = juce::jmin (1.0f, swellGain + rise);
                L[i] *= swellGain;
                if (R != nullptr) R[i] *= swellGain;
            }
            break;
        }

        case kStutter:
        {
            // At every beat (or bar) the first slice is captured, then
            // repeated until the next cell. The knob picks the slice:
            // 1 beat, 1/2, 1/4, 1/8, 1/16 of a beat (1/4 .. 1/64 notes).
            if (stutBuf[0].empty()) break;
            static const float kSlice[5] = { 1.0f, 0.5f, 0.25f, 0.125f, 0.0625f };
            const int   zone   = juce::jlimit (0, 4, (int) (a * 5.0f));
            const float spb    = 60.0f / juce::jmax (20.0f, p.bpm) * sr;   // samples per beat
            const int   want   = juce::jmax (32, (int) (kSlice[zone] * spb));
            const float cellB  = variant == 1 ? 4.0f : 1.0f;
            const int   cap    = (int) stutBuf[0].size();
            const int   fadeN  = 24;
            for (int i = 0; i < n; ++i)
            {
                const double b = beatAt (p, stutFreeBeat, i, sr);
                const long cell = (long) std::floor (b / cellB);
                if (cell != stutCell)
                {
                    stutCell = cell; stutFill = 0; stutPos = 0;
                    stutLen = juce::jmin (cap, (int) spb);   // capture up to a beat; the knob picks how much repeats
                }
                const float xl = L[i], xr = R != nullptr ? R[i] : L[i];
                if (stutFill < stutLen)
                {
                    stutBuf[0][(size_t) stutFill] = xl; stutBuf[1][(size_t) stutFill] = xr; ++stutFill;
                    if (stutFill <= want) continue;     // the first slice passes as it is captured
                }
                const int len = juce::jmin (want, stutFill);
                if (len < 8) continue;
                if (stutPos >= len) stutPos = 0;
                const float g = juce::jmin (1.0f, juce::jmin ((float) stutPos, (float) (len - stutPos)) / (float) fadeN);
                L[i] = stutBuf[0][(size_t) stutPos] * g;
                if (R != nullptr) R[i] = stutBuf[1][(size_t) stutPos] * g;
                ++stutPos;
            }
            if (! p.playing) stutFreeBeat += (double) p.bpm / 60.0 / (double) sr * (double) n;
            break;
        }

        case kAir:
        {
            // An exciter: what lives above ~3 kHz is bent into new harmonics
            // and laid back on top, plus a shelf of plain air. The bend is
            // level-tracked (the band is normalised before the curve, then
            // scaled back), so quiet highs sparkle as much as loud ones.
            // `silk` bends evenly (soft, glassy), `bright` bends oddly (edge).
            if (airBakedSr != sr)
            {
                for (int ch = 0; ch < 2; ++ch)
                {
                    airHp[ch] = {}; airHp2[ch] = {};
                    bakeCutFilter (true, 3000.0f, sr, airHp[ch].b0, airHp[ch].b1, airHp[ch].b2, airHp[ch].a1, airHp[ch].a2);
                    airHp2[ch] = airHp[ch];
                }
                airBakedSr = sr; airBakedA = -1.0f;
            }
            if (std::abs (a - airBakedA) > 0.01f)
            {
                for (int ch = 0; ch < 2; ++ch)
                    bakeShelf (true, a * 10.0f, 9000.0f, sr, airShelf[ch].b0, airShelf[ch].b1, airShelf[ch].b2, airShelf[ch].a1, airShelf[ch].a2);
                airBakedA = a;
            }
            const float dcK  = 1.0f - std::exp (-twoPi * 30.0f / sr);
            const float attK = 1.0f - std::exp (-1.0f / (0.003f * sr));
            const float relK = 1.0f - std::exp (-1.0f / (0.08f * sr));
            const float amt  = a * 2.4f;
            const int chs = R != nullptr ? 2 : 1;
            for (int ch = 0; ch < chs; ++ch)
            {
                float* S = ch == 1 ? R : L;
                for (int i = 0; i < n; ++i)
                {
                    const float hi = airHp2[ch].run (airHp[ch].run (S[i]));
                    const float mag = std::abs (hi);
                    airEnv[ch] += (mag - airEnv[ch]) * (mag > airEnv[ch] ? attK : relK);
                    const float norm = hi / (airEnv[ch] * 1.5f + 1.0e-4f);          // the band at unit level
                    float h = variant == 1 ? std::tanh (norm * 2.0f) * 0.7f : norm * std::abs (norm) * 0.6f;
                    h = std::tanh (h) * airEnv[ch] * 1.5f;                            // back to its own level, limited
                    airDc[ch] += (h - airDc[ch]) * dcK;
                    h -= airDc[ch];
                    S[i] = airShelf[ch].run (S[i] + h * amt);
                }
            }
            break;
        }

        case kRing:
        {
            // Ring modulation: the knob sweeps the carrier 20 Hz .. 5 kHz.
            // `ring` multiplies (sum and difference tones only), `am`
            // keeps the source underneath. The first few percent cross-
            // fade in so the print never jumps.
            const float f   = 20.0f * std::pow (2.0f, a * 8.0f);
            const float inc = f / sr;
            const float mix = juce::jmin (1.0f, a * 12.0f);
            for (int i = 0; i < n; ++i)
            {
                ringPhase += inc; if (ringPhase >= 1.0f) ringPhase -= 1.0f;
                const float c = std::sin (twoPi * ringPhase);
                const float k = variant == 1 ? 0.5f + 0.5f * c : c;
                L[i] = L[i] * (1.0f - mix) + L[i] * k * mix;
                if (R != nullptr) R[i] = R[i] * (1.0f - mix) + R[i] * k * mix;
            }
            break;
        }

        case kGate:
        {
            // A noise gate: an expander with an infinite ratio. The knob is
            // the threshold (−60 .. 0 dB); what stays under it is cut. The
            // gate closes 3 dB below where it opened (no chatter), holds a
            // moment, then `tight` shuts in 20 ms and `loose` in 250 ms.
            const float thr    = std::pow (10.0f, (-60.0f + a * 60.0f) / 20.0f);
            const float close  = thr * 0.7f;   // 3 dB of hysteresis
            const float detK   = 1.0f - std::exp (-1.0f / (0.008f * sr));
            const float attK   = 1.0f - std::exp (-1.0f / ((variant == 1 ? 0.005f : 0.0005f) * sr));
            const float relK   = 1.0f - std::exp (-1.0f / ((variant == 1 ? 0.25f : 0.02f) * sr));
            const int   holdN  = (int) ((variant == 1 ? 0.03f : 0.01f) * sr);
            for (int i = 0; i < n; ++i)
            {
                const float x = juce::jmax (std::abs (L[i]), R != nullptr ? std::abs (R[i]) : 0.0f);
                if (x > gateEnv) gateEnv = x; else gateEnv += (x - gateEnv) * detK;
                if (gateEnv > thr) { gateOpen = true; gateHold = holdN; }
                else if (gateEnv < close) { if (gateHold > 0) --gateHold; else gateOpen = false; }
                const float target = gateOpen ? 1.0f : 0.0f;
                gateGain += (target - gateGain) * (target > gateGain ? attK : relK);
                L[i] *= gateGain;
                if (R != nullptr) R[i] *= gateGain;
            }
            break;
        }

        case kWow:
        {
            // Tape transport trouble: a short line whose read head sways.
            // `wow` is the slow sway (~0.6 Hz, drifting), `flutter` the
            // fast shiver (~7 Hz, jittery), `both` a worn deck.
            if (wowDl[0].empty()) break;
            const int   len   = (int) wowDl[0].size();
            const bool  doWow = variant != 1, doFlut = variant != 0;
            const float base  = 0.012f * sr;
            const float wowD  = doWow  ? a * a * 0.0045f * sr : 0.0f;
            const float flutD = doFlut ? a * 0.0007f * sr : 0.0f;
            const float mix   = juce::jmin (1.0f, a * 20.0f);
            auto rnd = [&] () { wowRng = wowRng * 1664525u + 1013904223u; return (float) (wowRng >> 8) / 16777216.0f - 0.5f; };
            const float driftK = 1.0f - std::exp (-1.0f / (0.8f * sr));
            const float jitK   = 1.0f - std::exp (-1.0f / (0.02f * sr));
            for (int i = 0; i < n; ++i)
            {
                wowDrift  += (rnd() * 0.6f - wowDrift) * driftK;
                wowJitter += (rnd() - wowJitter) * jitK;
                wowPhase     += (0.6f * (1.0f + wowDrift)) / sr;      if (wowPhase >= 1.0f) wowPhase -= 1.0f;
                wowFlutPhase += (7.3f * (1.0f + wowJitter * 0.5f)) / sr; if (wowFlutPhase >= 1.0f) wowFlutPhase -= 1.0f;
                const float d = base + wowD * std::sin (twoPi * wowPhase) + flutD * (std::sin (twoPi * wowFlutPhase) + wowJitter * 0.8f);
                const int chs = R != nullptr ? 2 : 1;
                for (int ch = 0; ch < chs; ++ch)
                {
                    float* S = ch == 1 ? R : L;
                    wowDl[ch][(size_t) wowWrite] = S[i];
                    float rp = (float) wowWrite - d; while (rp < 0.0f) rp += (float) len;
                    const int   r0 = (int) rp; const float fr = rp - (float) r0;
                    const int   r1 = (r0 + 1) % len;
                    const float y = wowDl[ch][(size_t) r0] * (1.0f - fr) + wowDl[ch][(size_t) r1] * fr;
                    S[i] = S[i] * (1.0f - mix) + y * mix;
                }
                if (++wowWrite >= len) wowWrite = 0;
            }
            break;
        }

        default: break;
    }
}

//==============================================================================
// Compile: the wall's graph → a flat Program over a pool of block buffers.

bool compile (const Graph& g, Program& out, juce::String& error, LatencyFn latencyOf, const void* ctx)
{
    Program prog;
    const Graph::Node* nodeOf[kMaxNodes] {};
    auto latOf = [&] (int id) { return latencyOf != nullptr && nodeOf[id] != nullptr ? latencyOf (*nodeOf[id], ctx) : 0; };
    int arrival[kMaxNodes] {};   // samples of latency at each node's OUTPUT
    int nextLine = 0;

    // ── nodes: id = slot, unique, typed ─────────────────────────────────
    int slotType[kMaxNodes];
    bool bypassed[kMaxNodes] {};
    for (auto& t : slotType) t = kNone;
    bool controlSlot[kMaxNodes] {};
    for (auto& nd : g.nodes)
    {
        if (nd.id < 0 || nd.id >= kMaxNodes)          { error = "bad node id";        return false; }
        if (slotType[nd.id] != kNone || controlSlot[nd.id]) { error = "duplicate node id"; return false; }
        if (isControl (nd.type)) { controlSlot[nd.id] = true; continue; }   // no audio: the processor plays these
        if (! isEffect (nd.type) && nd.type != kMixType && ! isSplitter (nd.type)) { error = "bad node type"; return false; }
        slotType[nd.id] = nd.type;
        nodeOf[nd.id] = &nd;
        bypassed[nd.id] = nd.bypass && isEffect (nd.type);
    }
    auto isNode = [&] (int id) { return id >= 0 && id < kMaxNodes && slotType[id] != kNone; };
    auto isCtl  = [&] (int id) { return id >= 0 && id < kMaxNodes && controlSlot[id]; };

    // ── wires: the control wires (and the lfo → rate ones) are not audio ──
    Graph audio;
    for (auto& e : g.edges)
        if (e.hand == kHandNone && ! isCtl (e.from) && ! isCtl (e.to)) audio.edges.push_back (e);
    const std::vector<Graph::Edge>& edges = audio.edges;   // the audio wires only, from here on

    // ── wires: valid endpoints, a second port only where a splitter has one,
    //    no duplicates. Any point takes any number of wires: they sum.
    const int E = (int) edges.size();
    if (E > kMaxEdges) { error = "too many wires"; return false; }
    for (int i = 0; i < E; ++i)
    {
        const auto& e = edges[(size_t) i];
        if (! (e.from == kPortIn  || isNode (e.from))) { error = "wire from nowhere"; return false; }
        if (! (e.to   == kPortOut || isNode (e.to)))   { error = "wire to nowhere";   return false; }
        if (e.from == e.to)                            { error = "wire to itself";    return false; }
        const int ports = isNode (e.from) && isSplitter (slotType[e.from]) ? 2 : 1;
        if (e.port < 0 || e.port >= ports)             { error = "no such port";      return false; }
        for (int j = 0; j < i; ++j)
            if (edges[(size_t) j].from == e.from && edges[(size_t) j].to == e.to && edges[(size_t) j].port == e.port)
            { error = "duplicate wire"; return false; }
    }

    // ── reachability: a node counts only if in → node → out ─────────────
    bool fwd[kMaxNodes] {}, bwd[kMaxNodes] {};
    {
        bool changed = true;
        while (changed)
        {
            changed = false;
            for (auto& e : edges)
            {
                const bool srcOk = e.from == kPortIn || fwd[e.from];
                if (srcOk && e.to != kPortOut && ! fwd[e.to]) { fwd[e.to] = true; changed = true; }
            }
        }
        changed = true;
        while (changed)
        {
            changed = false;
            for (auto& e : edges)
            {
                const bool dstOk = e.to == kPortOut || bwd[e.to];
                if (dstOk && e.from != kPortIn && ! bwd[e.from]) { bwd[e.from] = true; changed = true; }
            }
        }
    }
    bool activeNode[kMaxNodes] {};
    for (int i = 0; i < kMaxNodes; ++i) activeNode[i] = slotType[i] != kNone && fwd[i] && bwd[i];
    bool activeEdge[kMaxEdges] {};
    bool anyOut = false;
    for (int i = 0; i < E; ++i)
    {
        const auto& e = edges[(size_t) i];
        const bool a = (e.from == kPortIn || activeNode[e.from]) && (e.to == kPortOut || activeNode[e.to]);
        activeEdge[i] = a;
        if (a && e.to == kPortOut) anyOut = true;
    }
    if (! anyOut)
    {
        // Nothing reaches out: the wall is silent on purpose? No — a bare
        // insert passes audio. Bypass.
        prog.bypass = 1;
        out = prog;
        return true;
    }

    // ── order: Kahn over the active subgraph; leftovers = a cycle ───────
    int order[kMaxNodes]; int nOrder = 0;
    {
        int inDeg[kMaxNodes] {};
        for (int i = 0; i < E; ++i)
            if (activeEdge[i] && edges[(size_t) i].to != kPortOut && edges[(size_t) i].from != kPortIn)
                ++inDeg[edges[(size_t) i].to];
        bool done[kMaxNodes] {};
        int activeCount = 0;
        for (int i = 0; i < kMaxNodes; ++i) if (activeNode[i]) ++activeCount;
        while (nOrder < activeCount)
        {
            int pick = -1;
            for (int i = 0; i < kMaxNodes; ++i)
                if (activeNode[i] && ! done[i] && inDeg[i] == 0) { pick = i; break; }
            if (pick < 0) { error = "cycle"; return false; }   // feedback — refused (v1)
            done[pick] = true;
            order[nOrder++] = pick;
            for (int i = 0; i < E; ++i)
                if (activeEdge[i] && edges[(size_t) i].from == pick && edges[(size_t) i].to != kPortOut)
                    --inDeg[edges[(size_t) i].to];
        }
    }

    // ── emit ────────────────────────────────────────────────────────────
    int  bufOfEdge[kMaxEdges];
    for (auto& b : bufOfEdge) b = -1;
    bool used[kMaxBuffers] {};
    int  laneOfBuf[kMaxBuffers] {};   // what each live buffer carries
    used[0] = true;   // the host buffer starts owned by in's first wire
    auto alloc = [&] () -> int
    {
        for (int b = 1; b < kMaxBuffers; ++b) if (! used[b]) { used[b] = true; laneOfBuf[b] = kLaneStereo; return b; }
        return -1;
    };
    auto release = [&] (int b) { if (b >= 1 && b < kMaxBuffers) used[b] = false; };
    auto emit = [&] (Op op) -> bool
    {
        if (prog.numOps >= kMaxOps) { error = "patch too big"; return false; }
        prog.ops[prog.numOps++] = op;
        return true;
    };
    auto nearUnity = [] (float gn) { return std::abs (gn - 1.0f) < 1.0e-6f; };
    // mult one output (a node's port, or in) to every wire leaving it
    auto fanOut = [&] (int fromId, int port, int srcBuf) -> bool
    {
        bool first = true;
        for (int i = 0; i < E; ++i)
        {
            if (! activeEdge[i] || edges[(size_t) i].from != fromId || edges[(size_t) i].port != port) continue;
            if (first) { bufOfEdge[i] = srcBuf; first = false; continue; }
            const int b = alloc();
            if (b < 0) { error = "too many branches"; return false; }
            laneOfBuf[b] = laneOfBuf[srcBuf];
            Op op; op.kind = Op::kCopy; op.dst = b; op.src = srcBuf;
            if (! emit (op)) return false;
            bufOfEdge[i] = b;
        }
        if (first) release (srcBuf);   // nobody took this port
        return true;
    };
    // gather: everything landing on `id` (or out) becomes one buffer.
    // One wire passes through; several sum, wire by wire at its send
    // level. Wires of one lane sum and keep the lane; where lanes meet
    // (or at out, where the speakers are) they join into a stereo pair.
    auto gather = [&] (int id, bool atOut, int& outBuf, int& latestOut) -> bool
    {
        int ins[kMaxEdges]; int nIn = 0;
        for (int i = 0; i < E; ++i)
            if (activeEdge[i] && edges[(size_t) i].to == id) ins[nIn++] = i;
        if (nIn == 0) { error = "unwired node"; return false; }   // cannot happen (active)
        // branches arrive with different latencies: hold the early ones
        int latest = 0;
        for (int k = 0; k < nIn; ++k)
        {
            const auto& e = edges[(size_t) ins[k]];
            latest = juce::jmax (latest, e.from == kPortIn ? 0 : arrival[e.from]);
        }
        for (int k = 0; k < nIn; ++k)
        {
            const auto& e = edges[(size_t) ins[k]];
            const int here = e.from == kPortIn ? 0 : arrival[e.from];
            if (latest - here > 0)
            {
                if (nextLine >= kMaxDelayLines) { error = "too many branches to align"; return false; }
                Op d; d.kind = Op::kDelay; d.dst = bufOfEdge[ins[k]]; d.samples = juce::jmin (kMaxDelaySamples, latest - here); d.slot = nextLine++;
                if (! emit (d)) return false;
            }
        }
        latestOut = latest;
        int count[5] {};
        for (int k = 0; k < nIn; ++k) ++count[laneOfBuf[bufOfEdge[ins[k]]]];
        int theLane = kLaneStereo; bool oneLane = false;
        for (int l = 0; l < 5; ++l) if (count[l] == nIn) { oneLane = true; theLane = l; }
        // one wire: pass it through (at out only if it is already a pair)
        if (nIn == 1 && oneLane && (! atOut || theLane == kLaneStereo))
        {
            const int b = bufOfEdge[ins[0]];
            const float gn = edges[(size_t) ins[0]].gain;
            if (! nearUnity (gn))
            {
                Op gop; gop.kind = Op::kGain; gop.dst = b; gop.gain = gn;
                if (! emit (gop)) return false;
            }
            outBuf = b;
            return true;
        }
        const int dst = alloc();
        if (dst < 0) { error = "too many branches"; return false; }
        bool have = false;
        auto sumLane = [&] (int lane, int into, bool& haveInto) -> bool
        {
            for (int k = 0; k < nIn; ++k)
            {
                const int b = bufOfEdge[ins[k]];
                if (laneOfBuf[b] != lane) continue;
                Op op; op.kind = haveInto ? Op::kAccum : Op::kScale;
                op.dst = into; op.src = b; op.gain = edges[(size_t) ins[k]].gain;
                if (id >= 0) { op.slot = id; op.src2 = edges[(size_t) ins[k]].from; }   // tagged: a rate may play this share
                if (! emit (op)) return false;
                haveInto = true;
            }
            return true;
        };
        if (oneLane && ! atOut)
        {
            // the same lane all round: a plain sum, the lane carries on
            if (! sumLane (theLane, dst, have)) return false;
            laneOfBuf[dst] = theLane;
        }
        else
        {
            if (count[kLaneStereo] && ! sumLane (kLaneStereo, dst, have)) return false;
            auto joinPair = [&] (int la, int lb, int kind) -> bool
            {
                if (count[la] == 0 && count[lb] == 0) return true;
                int ta = -1, tb = -1; bool ha = false, hb = false;
                if (count[la]) { ta = alloc(); if (ta < 0) { error = "too many branches"; return false; } if (! sumLane (la, ta, ha)) return false; }
                if (count[lb]) { tb = alloc(); if (tb < 0) { error = "too many branches"; return false; } if (! sumLane (lb, tb, hb)) return false; }
                Op j; j.kind = kind; j.dst = dst; j.src = ta; j.src2 = tb; j.flag = have ? 1 : 0;
                if (! emit (j)) return false;
                have = true;
                release (ta); release (tb);
                return true;
            };
            if (! joinPair (kLaneL, kLaneR, Op::kJoinLR)) return false;
            if (! joinPair (kLaneM, kLaneS, Op::kJoinMS)) return false;
            laneOfBuf[dst] = kLaneStereo;
        }
        for (int k = 0; k < nIn; ++k) release (bufOfEdge[ins[k]]);
        outBuf = dst;
        return true;
    };

    // in: mult the host buffer to every wire leaving the in port
    laneOfBuf[0] = kLaneStereo;
    if (! fanOut (kPortIn, 0, 0)) return false;

    for (int k = 0; k < nOrder; ++k)
    {
        const int id = order[k];
        int b = -1, latest = 0;
        if (! gather (id, false, b, latest)) return false;
        arrival[id] = latest;
        if (isSplitter (slotType[id]))
        {
            // a split: port 0 keeps the buffer, port 1 gets a fresh one
            const int b2 = alloc();
            if (b2 < 0) { error = "too many branches"; return false; }
            const bool lr = slotType[id] == kSplitLR;
            Op sp; sp.kind = lr ? Op::kSplitLR : Op::kSplitMS; sp.slot = id; sp.src = b; sp.dst = b; sp.dst2 = b2;
            if (! emit (sp)) return false;
            laneOfBuf[b]  = lr ? kLaneL : kLaneM;
            laneOfBuf[b2] = lr ? kLaneR : kLaneS;
            if (! fanOut (id, 0, b))  return false;
            if (! fanOut (id, 1, b2)) return false;
            continue;
        }
        if (slotType[id] != kMixType && ! bypassed[id])
        {
            Op op; op.kind = Op::kProcess; op.slot = id; op.type = slotType[id]; op.dst = b;
            if (! emit (op)) return false;
            arrival[id] += latOf (id);
        }
        if (! fanOut (id, 0, b)) return false;
    }

    // out: whatever lands on the out port ends up in the host buffer
    {
        int b = -1, latest = 0;
        if (! gather (kPortOut, true, b, latest)) return false;
        prog.latency = latest;
        if (b != 0)
        {
            Op cp; cp.kind = Op::kCopy; cp.dst = 0; cp.src = b;
            if (! emit (cp)) return false;
        }
    }
    prog.bypass = 0;
    out = prog;
    return true;
}

//==============================================================================
void Chain::prepare (double sampleRate, int blockSize)
{
    srHz = sampleRate;
    const int n = juce::jmax (64, blockSize);
    scratch.setSize (2, n, false, false, true);
    pool.resize ((size_t) (kMaxBuffers - 1));
    for (auto& b : pool) b.setSize (2, n, false, false, true);
    for (auto& node : nodes) node.prepare (sampleRate);
    for (auto& pk : peaks) pk.store (0.0f, std::memory_order_relaxed);
    active = Program {};
    // what the shifters cost in latency, at this rate
    if (auto* sh = nodes[0].shifter.get(); sh != nullptr && sh->configured)
    {
        latencyFine = sh->fine.inputLatency() + sh->fine.outputLatency();
        latencyLive = sh->live.inputLatency() + sh->live.outputLatency();
    }
    latencyGrain = (int) (sampleRate * 0.045 * 0.5);
    latencyWow   = (int) (sampleRate * 0.012);
    for (int i = 0; i < kMaxDelayLines; ++i)
    {
        delayLines[i][0].assign ((size_t) kMaxDelaySamples, 0.0f);
        delayLines[i][1].assign ((size_t) kMaxDelaySamples, 0.0f);
        delayWrite[i] = 0;
    }
}

int Chain::nodeLatency (const Graph::Node& n) const noexcept
{
    switch (n.type)
    {
        case kPitch:   return n.aux[1] == 1 ? latencyLive : latencyFine;
        case kFormant: return n.aux[0] == 1 ? latencyLive : latencyFine;
        case kVoice:   return latencyFine;
        case kHarmony: return latencyFine;
        case kArp:     return latencyLive;
        case kWow:     return latencyWow;
        default:       return 0;
    }
}

void Chain::publish (const Program& p)
{
    // Message thread. The audio thread only ever try-locks, so holding
    // this briefly never stalls it.
    const juce::SpinLock::ScopedLockType lock (pendingLock);
    pending = p;
    pendingFlag.store (true, std::memory_order_release);
}

void Chain::adoptPending()
{
    if (! pendingFlag.load (std::memory_order_acquire)) return;
    if (! pendingLock.tryEnter()) return;   // writer mid-publish: next block

    // Carry each op's smoothed gain over from the op it matches in the
    // running program (same kind / node / buffers), so a level drag stays
    // click-free. An op with no twin is new: a serial gain starts from
    // unity (a missing gain op IS unity, so 100 → 99 ramps instead of
    // jumping) and a wire landing on a mix fades in from silence.
    {
        float next[kMaxOps];
        for (int i = 0; i < pending.numOps; ++i)
        {
            const Op& b = pending.ops[i];
            float g = b.kind == Op::kGain ? 1.0f : 0.0f;
            for (int j = 0; j < active.numOps; ++j)
            {
                const Op& a = active.ops[j];
                if (a.kind == b.kind && a.slot == b.slot && a.type == b.type && a.dst == b.dst && a.src == b.src && a.src2 == b.src2 && a.dst2 == b.dst2)
                { g = gainSm[j]; break; }
            }
            next[i] = g;
        }
        for (int i = 0; i < pending.numOps; ++i) gainSm[i] = next[i];
    }

    // A delay line put to new use starts silent
    for (int i = 0; i < pending.numOps; ++i)
    {
        const Op& op = pending.ops[i];
        if (op.kind != Op::kDelay || op.slot < 0 || op.slot >= kMaxDelayLines) continue;
        bool same = false;
        for (int j = 0; j < active.numOps; ++j)
            if (active.ops[j].kind == Op::kDelay && active.ops[j].slot == op.slot && active.ops[j].samples == op.samples) { same = true; break; }
        if (! same)
        {
            std::fill (delayLines[op.slot][0].begin(), delayLines[op.slot][0].end(), 0.0f);
            std::fill (delayLines[op.slot][1].begin(), delayLines[op.slot][1].end(), 0.0f);
            delayWrite[op.slot] = 0;
        }
    }
    // A node entering the wall (or changing effect) starts clean and
    // glides up from neutral — exactly what switching modes always did.
    for (int i = 0; i < pending.numOps; ++i)
    {
        const Op& op = pending.ops[i];
        if (op.kind != Op::kProcess) continue;
        bool wasRunning = false;
        for (int j = 0; j < active.numOps; ++j)
            if (active.ops[j].kind == Op::kProcess && active.ops[j].slot == op.slot && active.ops[j].type == op.type)
            { wasRunning = true; break; }
        if (! wasRunning)
        {
            auto& node = nodes[(size_t) op.slot];
            node.type = op.type;
            node.reset();
        }
    }

    active = pending;
    pendingFlag.store (false, std::memory_order_release);
    pendingLock.exit();
}

float* Chain::chan (int buf, int ch, int n)
{
    if (buf <= 0) return host->getWritePointer (ch);
    auto& b = pool[(size_t) (buf - 1)];
    if (b.getNumSamples() < n) b.setSize (2, n, false, false, true);   // host grew its block: last resort
    return b.getWritePointer (ch);
}

void Chain::runOp (const Op& op, int opIndex, float sampleRate, int n, int nc, const NodeParams* params)
{
    const float g0 = gainSm[opIndex];
    float g1 = op.gain;
    if ((op.kind == Op::kScale || op.kind == Op::kAccum) && op.slot >= 0 && op.slot < kMaxNodes && op.src2 >= kPortIn && op.src2 < kMaxNodes)
        g1 = juce::jlimit (0.0f, 1.0f, g1 + params[op.slot].shareK[op.src2 + 1] * 0.5f);
    const bool  ramp = std::abs (g1 - g0) > 1.0e-6f;
    const float inv  = 1.0f / (float) n;
    gainSm[opIndex] = g1;

    switch (op.kind)
    {
        case Op::kCopy:
            for (int ch = 0; ch < nc; ++ch)
                juce::FloatVectorOperations::copy (chan (op.dst, ch, n), chan (op.src, ch, n), n);
            break;
        case Op::kGain:
            for (int ch = 0; ch < nc; ++ch)
            {
                float* d = chan (op.dst, ch, n);
                if (ramp) for (int i = 0; i < n; ++i) d[i] *= g0 + (g1 - g0) * (float) (i + 1) * inv;
                else      juce::FloatVectorOperations::multiply (d, g1, n);
            }
            break;
        case Op::kScale:
            for (int ch = 0; ch < nc; ++ch)
            {
                float* d = chan (op.dst, ch, n); const float* s = chan (op.src, ch, n);
                if (ramp) for (int i = 0; i < n; ++i) d[i] = s[i] * (g0 + (g1 - g0) * (float) (i + 1) * inv);
                else      juce::FloatVectorOperations::copyWithMultiply (d, s, g1, n);
            }
            break;
        case Op::kAccum:
            for (int ch = 0; ch < nc; ++ch)
            {
                float* d = chan (op.dst, ch, n); const float* s = chan (op.src, ch, n);
                if (ramp) for (int i = 0; i < n; ++i) d[i] += s[i] * (g0 + (g1 - g0) * (float) (i + 1) * inv);
                else      juce::FloatVectorOperations::addWithMultiply (d, s, g1, n);
            }
            break;
        case Op::kDelay:
        {
            if (op.slot < 0 || op.slot >= kMaxDelayLines || op.samples <= 0) break;
            const int len = kMaxDelaySamples;
            const int d = juce::jmin (op.samples, len - 1);
            for (int ch = 0; ch < nc; ++ch)
            {
                float* x = chan (op.dst, ch, n);
                auto& line = delayLines[op.slot][ch];
                int w = delayWrite[op.slot];
                for (int i = 0; i < n; ++i)
                {
                    int r = w - d; if (r < 0) r += len;
                    const float out = line[(size_t) r];
                    line[(size_t) w] = x[i];
                    x[i] = out;
                    w = w + 1 < len ? w + 1 : 0;
                }
                if (ch == nc - 1) delayWrite[op.slot] = w;
            }
            break;
        }
        case Op::kSplitLR:
        {
            // dst = (L, L) and dst2 = (R, R); src may be dst, so the right goes out first
            const float* sL = chan (op.src, 0, n);
            const float* sR = nc > 1 ? chan (op.src, 1, n) : sL;
            float* e0 = chan (op.dst2, 0, n);
            juce::FloatVectorOperations::copy (e0, sR, n);
            if (nc > 1) juce::FloatVectorOperations::copy (chan (op.dst2, 1, n), sR, n);
            float* d0 = chan (op.dst, 0, n);
            if (d0 != sL) juce::FloatVectorOperations::copy (d0, sL, n);
            if (nc > 1) juce::FloatVectorOperations::copy (chan (op.dst, 1, n), d0, n);
            break;
        }
        case Op::kSplitMS:
        {
            const float* sL = chan (op.src, 0, n);
            const float* sR = nc > 1 ? chan (op.src, 1, n) : sL;
            float* d0 = chan (op.dst, 0, n);  float* d1 = nc > 1 ? chan (op.dst, 1, n) : nullptr;
            float* e0 = chan (op.dst2, 0, n); float* e1 = nc > 1 ? chan (op.dst2, 1, n) : nullptr;
            for (int i = 0; i < n; ++i)
            {
                const float l = sL[i], r = sR[i];
                const float m = 0.5f * (l + r), s = 0.5f * (l - r);
                e0[i] = s; if (e1 != nullptr) e1[i] = s;
                d0[i] = m; if (d1 != nullptr) d1[i] = m;
            }
            break;
        }
        case Op::kJoinLR:
        case Op::kJoinMS:
        {
            // a lane's buffer is mono on both channels; fold it in case an
            // effect on the way made the two channels differ
            const float* a0 = op.src  >= 0 ? chan (op.src,  0, n) : nullptr;
            const float* a1 = op.src  >= 0 && nc > 1 ? chan (op.src,  1, n) : a0;
            const float* b0 = op.src2 >= 0 ? chan (op.src2, 0, n) : nullptr;
            const float* b1 = op.src2 >= 0 && nc > 1 ? chan (op.src2, 1, n) : b0;
            float* d0 = chan (op.dst, 0, n);
            float* d1 = nc > 1 ? chan (op.dst, 1, n) : nullptr;
            const bool ms = op.kind == Op::kJoinMS, add = op.flag != 0;
            for (int i = 0; i < n; ++i)
            {
                const float a = a0 != nullptr ? 0.5f * (a0[i] + a1[i]) : 0.0f;
                const float b = b0 != nullptr ? 0.5f * (b0[i] + b1[i]) : 0.0f;
                const float l = ms ? a + b : a;
                const float r = ms ? a - b : b;
                if (d1 != nullptr) { if (add) { d0[i] += l; d1[i] += r; } else { d0[i] = l; d1[i] = r; } }
                else               { const float mono = 0.5f * (l + r); if (add) d0[i] += mono; else d0[i] = mono; }
            }
            break;
        }
        case Op::kProcess:
        {
            if (op.slot < 0 || op.slot >= kMaxNodes) break;
            auto& node = nodes[(size_t) op.slot];
            float* L = chan (op.dst, 0, n);
            float* R = nc > 1 ? chan (op.dst, 1, n) : nullptr;
            node.process (params[op.slot], sampleRate, n, L, R, scratch);
            float pk = 0.0f;
            for (int i = 0; i < n; ++i) pk = juce::jmax (pk, std::abs (L[i]));
            if (R != nullptr) for (int i = 0; i < n; ++i) pk = juce::jmax (pk, std::abs (R[i]));
            peaks[(size_t) op.slot].store (pk, std::memory_order_relaxed);
            break;
        }
        default: break;
    }
}

void Chain::process (juce::AudioBuffer<float>& buffer, float sampleRate,
                     const NodeParams* params, float& grDbOut)
{
    const int n  = buffer.getNumSamples();
    const int nc = juce::jmin (2, buffer.getNumChannels());
    grDbOut = 0.0f;
    if (n == 0 || nc == 0) return;

    adoptPending();
    host = &buffer;
    for (auto& pk : peaks) pk.store (0.0f, std::memory_order_relaxed);
    if (active.bypass) return;

    for (int i = 0; i < active.numOps; ++i)
    {
        const Op& op = active.ops[i];
        runOp (op, i, sampleRate, n, nc, params);
        if (op.kind == Op::kProcess && op.type == kGlue)
            grDbOut = juce::jmax (grDbOut, nodes[(size_t) op.slot].grDb);
    }
    host = nullptr;
}

} // namespace orbfx
