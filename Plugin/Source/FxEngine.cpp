#include "FxEngine.h"
#include <cmath>

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
void NodeState::prepare (int newType, double sampleRate)
{
    type = newType;
    const float srf = (float) sampleRate;
    fxReverb.setSampleRate (sampleRate);
    // Allocate only what this node's effect needs — the 3 s echo line is
    // the big one. Message thread only; never resized on the audio thread.
    auto line = [&] (std::vector<float>* dl, bool wanted, float seconds)
    {
        if (wanted)
        {
            const int len = (int) (srf * seconds) + 64;
            dl[0].assign ((size_t) len, 0.0f);
            dl[1].assign ((size_t) len, 0.0f);
        }
        else
        {
            for (int ch = 0; ch < 2; ++ch) { dl[ch].clear(); dl[ch].shrink_to_fit(); }
        }
    };
    // Modulated delay for chorus/flanger: 60 ms is comfortably past the
    // deepest excursion. Doubler ghosts live within ~35 ms. The echo line
    // holds a half note down to 43 BPM (~2.8 s) with headroom.
    line (modDl, type == kMod,     0.06f);
    line (dblDl, type == kDoubler, 0.06f);
    line (dlyBuf, type == kDelay,  3.0f);
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
}

//==============================================================================
void NodeState::process (const NodeParams& p, float sr, int n, float* L, float* R,
                         juce::AudioBuffer<float>& scratch)
{
    if (type < 0 || type >= kNumFx) return;
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
    if (type == kTone)      { if (std::abs (a - 0.5f) < 0.004f) return; }
    else if (type == kGain) { if (variant == 0 && std::abs (a - 0.75f) < 0.002f
                                               && std::abs (target - 0.75f) < 0.002f)
                              { gainPrimed = false; return; } }
    else                    { if (a < 0.004f && target < 0.004f)
                              { if (type == kGlue) grDb = 0.0f;
                                return; } }

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
            const float duck  = 1.0f - mix * 0.30f;
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
            const float duck = 1.0f - mix * 0.25f;
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
            const float dry = 1.0f - a * 0.2f;
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
            const float widthK = a * 1.7f;      // extra gain on existing side (highs)
            const float synthK = a * 0.35f;     // synthesized side, DEAD-MONO ONLY
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
                const float sideOut = side0 + sideHi * widthK + synth * (synthK * mono);
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
                        S[i] = S[i] * (1.0f - mix) + x * mix;
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
                        S[i] = S[i] * (1.0f - mix * 0.55f) + wet * mix;
                    }
                    if (R == nullptr) modDl[1][(size_t) modWrite] = modDl[0][(size_t) modWrite];
                    modWrite = modWrite + 1 < len ? modWrite + 1 : 0;
                }
            }
            break;
        }

        default: break;
    }
}

//==============================================================================
void Chain::prepare (double sampleRate, int blockSize)
{
    sr = sampleRate;
    scratch.setSize (2, juce::jmax (64, blockSize), false, false, true);
    // Phase 0: slots 0..kNumFx-1 are pre-bound one per effect (slot ==
    // type) so the per-effect memories the UI already keeps map 1:1; the
    // remaining slots stay free for the graph.
    for (int i = 0; i < kMaxNodes; ++i)
        nodes[(size_t) i].prepare (i < (int) kNumFx ? i : (int) kNone, sampleRate);
    last = Schedule {};
}

void Chain::setNodeType (int slot, int type)
{
    if (slot < 0 || slot >= kMaxNodes) return;
    const juce::SpinLock::ScopedLockType lock (writeLock);
    nodes[(size_t) slot].prepare (type, sr);
}

void Chain::publish (const Schedule& s)
{
    // Seqlock writer (message thread, rare). Odd seq = write in progress;
    // the reader retries until it sees the same even seq before and after.
    const juce::SpinLock::ScopedLockType lock (writeLock);
    seq.fetch_add (1, std::memory_order_acq_rel);
    shared.count.store (juce::jlimit (0, kMaxNodes, s.count), std::memory_order_relaxed);
    for (int i = 0; i < kMaxNodes; ++i)
        shared.slot[i].store (s.slot[i], std::memory_order_relaxed);
    seq.fetch_add (1, std::memory_order_acq_rel);
}

Schedule Chain::current() const
{
    Schedule s;
    for (;;)
    {
        const unsigned s0 = seq.load (std::memory_order_acquire);
        if (s0 & 1u) continue;
        s.count = shared.count.load (std::memory_order_relaxed);
        for (int i = 0; i < kMaxNodes; ++i) s.slot[i] = shared.slot[i].load (std::memory_order_relaxed);
        if (seq.load (std::memory_order_acquire) == s0) break;
    }
    return s;
}

void Chain::process (juce::AudioBuffer<float>& buffer, float sampleRate,
                     const NodeParams* params, float& grDbOut)
{
    const int n  = buffer.getNumSamples();
    const int nc = buffer.getNumChannels();
    grDbOut = 0.0f;
    if (n == 0 || nc == 0) return;

    const Schedule s = current();

    // A node that just entered the chain starts clean and glides up from
    // neutral — exactly what switching modes always did.
    for (int i = 0; i < s.count; ++i)
    {
        const int slot = s.slot[i];
        if (slot < 0 || slot >= kMaxNodes) continue;
        bool wasThere = false;
        for (int j = 0; j < last.count; ++j)
            if (last.slot[j] == slot) { wasThere = true; break; }
        if (! wasThere) nodes[(size_t) slot].reset();
    }
    last = s;

    float* L = buffer.getWritePointer (0);
    float* R = nc > 1 ? buffer.getWritePointer (1) : nullptr;
    for (int i = 0; i < s.count; ++i)
    {
        const int slot = s.slot[i];
        if (slot < 0 || slot >= kMaxNodes) continue;
        auto& node = nodes[(size_t) slot];
        node.process (params[slot], sampleRate, n, L, R, scratch);
        if (node.type == kGlue) grDbOut = juce::jmax (grDbOut, node.grDb);
    }
}

} // namespace orbfx
