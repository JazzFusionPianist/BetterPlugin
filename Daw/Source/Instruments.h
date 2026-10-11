#pragma once
#include <algorithm>
#include <atomic>
#include <cmath>
#include <cstdint>
#include <cstring>
#include <memory>
#include <string>
#include <vector>

/*  The Slur DAW's own instruments: a synth, a drum kit and a sampler.

    Plain C++ — nothing of the library is used — so that each can be built and listened to by itself
    (test/inst/play.cpp does: it plays them into numbers and measures what comes out).

    An instrument is played with events that say where in the block they fall, and adds its sound to a pair of
    channels. What can be turned on one is a list of named numbers, each an atomic: the page sets them from the
    message thread while the device's thread plays. A sound handed to one (the sampler's, a drum pad's) is swapped in
    by the engine under its own lock, never while a block is being played.                                           */
namespace slurinst
{

/** One thing played: `at` is the sample of the block it falls on; then the three bytes as they travel (the status with its channel). */
struct Ev { int at = 0; uint8_t st = 0, d1 = 0, d2 = 0; };

/** A number that can be set on an instrument: its name, where it rests, how far it goes. */
struct Param { const char* name; float def, lo, hi; };

/** A sound an instrument plays from: samples the engine keeps alive (`keep`) for as long as the instrument holds them. */
struct Sample
{
    const float* L = nullptr; const float* R = nullptr;
    int n = 0;
    std::shared_ptr<void> keep;
    bool any() const { return L != nullptr && n > 1; }
};

inline float midiHz (float note) { return 440.0f * std::pow (2.0f, (note - 69.0f) / 12.0f); }
inline float dbLin (float db) { return std::pow (10.0f, db * 0.05f); }

/** A sine read from a table: the instruments ask for a few million a second. */
struct SineTable
{
    static constexpr int N = 2048;
    float t[N + 1];
    SineTable() { for (int i = 0; i <= N; ++i) t[i] = (float) std::sin (2.0 * 3.14159265358979323846 * (double) i / (double) N); }
    /** x: turns (1 = once round); any value. */
    float operator() (double x) const
    {
        x -= std::floor (x);
        const double p = x * (double) N;
        const int i = (int) p;
        const float f = (float) (p - (double) i);
        return t[i] + (t[i + 1] - t[i]) * f;
    }
};
inline const SineTable& sine() { static const SineTable s; return s; }

/** Noise that is the same on every run (a print must come out the same twice). */
struct Rng
{
    uint32_t s = 0x9E3779B9u;
    float next() { s ^= s << 13; s ^= s >> 17; s ^= s << 5; return (float) (int32_t) s * (1.0f / 2147483648.0f); }
};

/** An envelope with the bend of a charging capacitor: up towards a little above full, down towards where it is held, away to nothing. */
struct Adsr
{
    enum { kOff = 0, kAttack, kDecay, kRelease };
    int stage = kOff;
    float lvl = 0.0f;
    void on() { stage = kAttack; }
    void off() { if (stage != kOff) stage = kRelease; }
    void kill() { stage = kOff; lvl = 0.0f; }
    bool alive() const { return stage != kOff; }
    /** ca, cd, cr: how much of the way is gone in one step (see `coef`); s: the level it is held at. */
    float step (float ca, float cd, float s, float cr)
    {
        switch (stage)
        {
            case kAttack:  lvl += (1.3f - lvl) * ca; if (lvl >= 1.0f) { lvl = 1.0f; stage = kDecay; } break;
            case kDecay:   lvl += (s - lvl) * cd; break;
            case kRelease: lvl += (0.0f - lvl) * cr; if (lvl < 1.0e-4f) { lvl = 0.0f; stage = kOff; } break;
            default: break;
        }
        return lvl;
    }
    /** The step for a stretch of `seconds` (the time it takes to come within a few hundredths of where it is going). */
    static float coef (float seconds, double sr, float steps = 1.0f)
    {
        const double n = std::max (1.0, (double) seconds * sr / (double) steps);
        return (float) (1.0 - std::exp (-3.0 / n));
    }
    static float coefAttack (float seconds, double sr, float steps = 1.0f)
    {
        const double n = std::max (1.0, (double) seconds * sr / (double) steps);
        return (float) (1.0 - std::exp (-1.4663 / n));      // reaches 1 on its way to 1.3 in that time
    }
};

/** A low-pass of two poles that stays in tune and in one piece however it is swept (the trapezoid form). */
struct Svf
{
    float ic1 = 0.0f, ic2 = 0.0f, a1 = 0.0f, a2 = 0.0f, a3 = 0.0f, k = 1.0f;
    void set (float hz, float res, double sr)
    {
        const float g = std::tan (3.14159265f * std::min (hz, (float) sr * 0.45f) / (float) sr);
        k = 2.0f - 1.96f * std::min (1.0f, std::max (0.0f, res));
        a1 = 1.0f / (1.0f + g * (g + k)); a2 = g * a1; a3 = g * a2;
    }
    void clear() { ic1 = ic2 = 0.0f; }
    float low (float x)
    {
        const float v3 = x - ic2, v1 = a1 * ic1 + a2 * v3, v2 = ic2 + a2 * ic1 + a3 * v3;
        ic1 = 2.0f * v1 - ic1; ic2 = 2.0f * v2 - ic2;
        return v2;
    }
    float band (float x)
    {
        const float v3 = x - ic2, v1 = a1 * ic1 + a2 * v3, v2 = ic2 + a2 * ic1 + a3 * v3;
        ic1 = 2.0f * v1 - ic1; ic2 = 2.0f * v2 - ic2;
        return v1;
    }
    float high (float x)
    {
        const float v3 = x - ic2, v1 = a1 * ic1 + a2 * v3, v2 = ic2 + a2 * ic1 + a3 * v3;
        ic1 = 2.0f * v1 - ic1; ic2 = 2.0f * v2 - ic2;
        return x - k * v1 - v2;
    }
};

//══════════════════════════════════════════════════════════════════════════════
class Instrument
{
public:
    virtual ~Instrument() = default;
    virtual const char* kind() const = 0;
    virtual void prepare (double sampleRate) = 0;
    /** Adds what it sounds like over n samples. The events are in the order they fall. */
    virtual void render (float* L, float* R, int n, const Ev* evs, int count) = 0;
    /** Every note is let go; `hard`: and is silent at once (a print begins, the song jumps far away). */
    virtual void allOff (bool hard) = 0;
    virtual int paramCount() const = 0;
    virtual const Param& paramInfo (int i) const = 0;
    /** A sound for it to play from (the sampler has one place, the drum kit one for each pad). Not while a block is played. */
    virtual bool setSample (int, Sample) { return false; }
    /** Whether anything of it still sounds (so that a track that has gone quiet costs nothing). */
    virtual bool sounding() const = 0;

    int find (const char* name) const { for (int i = 0; i < paramCount(); ++i) if (std::strcmp (paramInfo (i).name, name) == 0) return i; return -1; }
    void set (int i, float v) { if (i >= 0 && i < paramCount()) { const auto& p = paramInfo (i); vals[(size_t) i].store (std::min (p.hi, std::max (p.lo, v)), std::memory_order_relaxed); } }
    bool set (const char* name, float v) { const int i = find (name); if (i < 0) return false; set (i, v); return true; }
    float get (int i) const { return vals[(size_t) i].load (std::memory_order_relaxed); }

protected:
    void makeParams() { vals = std::vector<std::atomic<float>> ((size_t) paramCount()); for (int i = 0; i < paramCount(); ++i) vals[(size_t) i].store (paramInfo (i).def); }
    /** Play a block in the stretches between its events: `handle` takes each event, `sound` each stretch. */
    template <typename Handle, typename Sound>
    static void walk (int n, const Ev* evs, int count, Handle&& handle, Sound&& sound)
    {
        int pos = 0, k = 0;
        while (pos < n)
        {
            while (k < count && evs[k].at <= pos) handle (evs[k++]);
            const int until = k < count ? std::min (n, std::max (pos + 1, evs[k].at)) : n;
            sound (pos, until - pos);
            pos = until;
        }
        while (k < count) handle (evs[k++]);
    }
    std::vector<std::atomic<float>> vals;
    double sr = 48000.0;
};

//══════════════════════════════════════════════════════════════════════════════
/** The synth: two oscillators (the second can bend the first, for struck and bell-like sounds), one below, noise; a
    low-pass with its own envelope; an envelope for loudness; a slow wave for vibrato and for the filter. Sixteen
    notes at a time, or one that slides. */
class Synth final : public Instrument
{
public:
    enum P { pWave1, pWave2, pOct2, pSemi2, pDetune, pMix, pSub, pNoise, pPw, pFm, pFmRatio, pFmDecay,
             pCutoff, pReso, pSlope, pEnvAmt, pKeyTrack, pVelCut, pFA, pFD, pFS, pFR, pAA, pAD, pAS, pAR,
             pLfoRate, pVib, pLfoCut, pGlide, pMono, pLevel, pSpread, pVelAmp, pBend, pCount };
    static const Param* table()
    {
        static const Param t[pCount] = {
            { "wave1", 0, 0, 3 }, { "wave2", 0, 0, 3 }, { "oct2", 0, -2, 2 }, { "semi2", 0, -12, 12 }, { "detune", 8, 0, 60 }, { "mix", 0.5f, 0, 1 },
            { "sub", 0, 0, 1 }, { "noise", 0, 0, 1 }, { "pw", 0.5f, 0.05f, 0.95f }, { "fm", 0, 0, 1 }, { "fmRatio", 1, 0.5f, 16 }, { "fmDecay", 0.6f, 0.01f, 8 },
            { "cutoff", 4000, 20, 20000 }, { "reso", 0.15f, 0, 1 }, { "slope", 1, 0, 1 }, { "envAmt", 2, -6, 6 }, { "keyTrack", 0.4f, 0, 1 }, { "velCut", 0.3f, 0, 1 },
            { "fA", 0.002f, 0.0005f, 10 }, { "fD", 0.35f, 0.002f, 10 }, { "fS", 0.3f, 0, 1 }, { "fR", 0.3f, 0.002f, 12 },
            { "aA", 0.004f, 0.0005f, 10 }, { "aD", 0.4f, 0.002f, 10 }, { "aS", 0.8f, 0, 1 }, { "aR", 0.25f, 0.002f, 12 },
            { "lfoRate", 5.2f, 0.05f, 20 }, { "vib", 0, 0, 1 }, { "lfoCut", 0, -3, 3 }, { "glide", 0, 0, 2 }, { "mono", 0, 0, 1 },
            { "level", -6, -36, 6 }, { "spread", 0.35f, 0, 1 }, { "velAmp", 0.7f, 0, 1 }, { "bend", 2, 0, 24 } };
        return t;
    }
    Synth() { makeParams(); }
    const char* kind() const override { return "synth"; }
    int paramCount() const override { return pCount; }
    const Param& paramInfo (int i) const override { return table()[i]; }

    void prepare (double sampleRate) override { sr = sampleRate; for (auto& v : voices) v = Voice(); pedal = false; bend = 0.0f; wheel = 0.0f; lfo = 0.0; nHeld = 0; lastHz = 0.0f; }
    bool sounding() const override { for (auto& v : voices) if (v.amp.alive()) return true; return false; }

    void allOff (bool hard) override
    {
        pedal = false; nHeld = 0;
        for (auto& v : voices) { v.gate = false; v.susp = false; if (hard) { v.amp.kill(); v.flt.kill(); v.f1.clear(); v.f2.clear(); } else { v.amp.off(); v.flt.off(); } }
    }

    void render (float* L, float* R, int n, const Ev* evs, int count) override
    {
        walk (n, evs, count, [this] (const Ev& e) { handle (e); }, [this, L, R] (int from, int len) { sound (L + from, R + from, len); });
    }

private:
    static constexpr int kVoices = 16, kCtl = 16;
    struct Voice
    {
        Adsr amp, flt;
        Svf f1, f2;
        Rng rng;
        double ph1 = 0.0, ph2 = 0.0, phS = 0.0, phM = 0.0;
        double d1 = 0.0, d2 = 0.0, dS = 0.0, dM = 0.0;       // what the last control step worked out (a block may begin anywhere between two steps)
        float idx = 0.0f, a0 = 0.0f, a1 = 0.0f;
        float hz = 0.0f, target = 0.0f, vel = 0.0f, mod = 0.0f, pl = 0.7f, pr = 0.7f, fltNow = 0.0f;
        int note = -1, ctl = 0;
        uint32_t born = 0;
        bool gate = false, susp = false;      // susp: its key is up, the pedal holds it
    };

    static float blep (double t, double dt)
    {
        if (t < dt) { t /= dt; return (float) (t + t - t * t - 1.0); }
        if (t > 1.0 - dt) { t = (t - 1.0) / dt; return (float) (t * t + t + t + 1.0); }
        return 0.0f;
    }
    /** One oscillator's value at phase t (0..1), stepping dt a sample; `pm`: how far its phase is pushed (in turns). */
    static float wave (int w, double t, double dt, float pw, float pm)
    {
        if (pm != 0.0f) { t += (double) pm; t -= std::floor (t); }
        switch (w)
        {
            case 0:  return (float) (2.0 * t - 1.0) - blep (t, dt);
            case 1:  { double t2 = t + 1.0 - (double) pw; t2 -= std::floor (t2); return (t < (double) pw ? 1.0f : -1.0f) + blep (t, dt) - blep (t2, dt); }
            case 2:  return (float) (4.0 * std::abs (t - 0.5) - 1.0);
            default: return sine() (t);
        }
    }

    void handle (const Ev& e)
    {
        const int type = e.st & 0xF0;
        if (type == 0x90 && e.d2 > 0) noteOn (e.d1, (float) e.d2 / 127.0f);
        else if (type == 0x80 || type == 0x90) noteOff (e.d1);
        else if (type == 0xE0) bend = (float) (((int) e.d2 << 7 | (int) e.d1) - 8192) / 8192.0f;
        else if (type == 0xB0)
        {
            if (e.d1 == 1) wheel = (float) e.d2 / 127.0f;
            else if (e.d1 == 64) { const bool down = e.d2 >= 64; if (pedal && ! down) for (auto& v : voices) if (v.susp) { v.susp = false; v.amp.off(); v.flt.off(); } pedal = down; }
            else if (e.d1 == 120 || e.d1 == 123) allOff (e.d1 == 120);
        }
    }

    void start (Voice& v, int note, float vel, bool legato)
    {
        const float f = midiHz ((float) note);
        v.note = note; v.vel = vel; v.target = f; v.gate = true; v.susp = false; v.born = ++clock;
        if (! legato)
        {
            const float glide = get (pGlide);
            v.hz = glide > 0.001f && lastHz > 0.0f ? lastHz : f;
            if (! v.amp.alive()) { v.ph1 = 0.0; v.ph2 = 0.25; v.phS = 0.0; v.phM = 0.0; v.f1.clear(); v.f2.clear(); v.a0 = v.a1 = 0.0f; }
            v.mod = 1.0f; v.ctl = 0;
            v.amp.on(); v.flt.on();
            const float sp = get (pSpread), where = ((float) ((clock * 7u) % 9u) / 4.0f - 1.0f) * sp;       // each note a little to one side or the other
            v.pl = std::cos ((where + 1.0f) * 0.7853982f); v.pr = std::sin ((where + 1.0f) * 0.7853982f);
        }
        lastHz = f;
    }

    void noteOn (int note, float vel)
    {
        if (get (pMono) >= 0.5f)
        {
            if (nHeld < 16) keys[nHeld++] = (uint8_t) note;
            auto& v = voices[0];
            start (v, note, vel, v.gate && v.amp.alive());
            return;
        }
        Voice* pick = nullptr;
        for (auto& v : voices) if (v.note == note && v.amp.alive()) { pick = &v; break; }       // the same key again plays the same voice
        if (pick == nullptr) for (auto& v : voices) if (! v.amp.alive()) { pick = &v; break; }
        if (pick == nullptr)
        {
            for (auto& v : voices) if (! v.gate && ! v.susp && (pick == nullptr || v.born < pick->born)) pick = &v;      // the oldest of those let go
            if (pick == nullptr) for (auto& v : voices) if (pick == nullptr || v.born < pick->born) pick = &v;           // else the oldest
        }
        start (*pick, note, vel, false);
    }

    void noteOff (int note)
    {
        if (get (pMono) >= 0.5f)
        {
            int w = 0; for (int i = 0; i < nHeld; ++i) if (keys[i] != note) keys[w++] = keys[i];
            nHeld = w;
            auto& v = voices[0];
            if (nHeld > 0) { if (v.note == note) { v.note = keys[nHeld - 1]; v.target = midiHz ((float) v.note); lastHz = v.target; } return; }      // back to the key still held
            if (v.note == note) { v.gate = false; if (pedal) v.susp = true; else { v.amp.off(); v.flt.off(); } }
            return;
        }
        for (auto& v : voices)
            if (v.note == note && v.gate) { v.gate = false; if (pedal) v.susp = true; else { v.amp.off(); v.flt.off(); } }
    }

    void sound (float* L, float* R, int n)
    {
        const int w1 = (int) (get (pWave1) + 0.5f), w2 = (int) (get (pWave2) + 0.5f);
        const float mix = get (pMix), sub = get (pSub), noise = get (pNoise), pw = get (pPw), fm = get (pFm), ratio = get (pFmRatio);
        const float cut = get (pCutoff), reso = get (pReso), envAmt = get (pEnvAmt), keyTrack = get (pKeyTrack), velCut = get (pVelCut), lfoCut = get (pLfoCut);
        const bool steep = get (pSlope) >= 0.5f;
        const float k2 = std::pow (2.0f, std::floor (get (pOct2) + 0.5f) + (std::floor (get (pSemi2) + 0.5f) + get (pDetune) / 100.0f) / 12.0f);
        const float ctl = (float) kCtl;
        const float fa = Adsr::coefAttack (get (pFA), sr, ctl), fd = Adsr::coef (get (pFD), sr, ctl), fs = get (pFS), fr = Adsr::coef (get (pFR), sr, ctl);
        const float aa = Adsr::coefAttack (get (pAA), sr, ctl), ad = Adsr::coef (get (pAD), sr, ctl), as = get (pAS), ar = Adsr::coef (get (pAR), sr, ctl);
        const float modDecay = (float) std::exp (-(double) kCtl / (std::max (0.01, (double) get (pFmDecay)) * sr));
        const float glide = get (pGlide), glideK = glide > 0.001f ? (float) (1.0 - std::exp (-(double) kCtl / ((double) glide * 0.33 * sr))) : 1.0f;
        const float velAmp = get (pVelAmp), level = dbLin (get (pLevel)) * 0.6f, vibDepth = get (pVib) + wheel * 0.5f, range = get (pBend);
        const double lfoStep = (double) get (pLfoRate) / sr;
        const float isr = (float) (1.0 / sr);

        for (auto& v : voices)
        {
            if (! v.amp.alive()) continue;
            const float velG = (1.0f - velAmp) + velAmp * v.vel * v.vel;
            float o1 = 1.0f - mix, o2 = mix;
            if (fm > 0.0005f) { o1 = 1.0f; o2 = 0.0f; }                         // bent by the second, only the first is heard
            for (int i = 0; i < n; ++i)
            {
                if (v.ctl == 0)
                {
                    v.hz += (v.target - v.hz) * glideK;
                    const float wob = sine() (lfo + lfoStep * (double) i), semis = bend * range + wob * vibDepth;
                    const float f = v.hz * (semis != 0.0f ? std::pow (2.0f, semis / 12.0f) : 1.0f);
                    v.d1 = (double) (f * isr); v.d2 = (double) (f * k2 * isr); v.dS = v.d1 * 0.5; v.dM = (double) (f * ratio * isr);
                    v.fltNow = v.flt.step (fa, fd, fs, fr);
                    const float oct = envAmt * v.fltNow * ((1.0f - velCut) + velCut * v.vel) + keyTrack * ((float) v.note - 60.0f) / 12.0f + lfoCut * wob;
                    const float hz = std::min (20000.0f, std::max (20.0f, cut * std::pow (2.0f, oct)));
                    v.f1.set (hz, reso, sr); if (steep) v.f2.set (hz, reso * 0.35f, sr);
                    v.mod *= modDecay;
                    v.idx = fm * 2.2f * v.mod * (0.35f + 0.65f * v.vel);
                    v.a0 = v.a1; v.a1 = v.amp.step (aa, ad, as, ar) * velG * level;
                    if (! v.amp.alive()) { v.a0 = v.a1 = 0.0f; break; }
                }
                const float pm = v.idx > 0.0f ? v.idx * sine() (v.phM) : 0.0f;
                float x = o1 * wave (w1, v.ph1, v.d1, pw, pm);
                if (o2 > 0.0f) x += o2 * wave (w2, v.ph2, v.d2, pw, pm);
                if (sub > 0.0f) x += sub * sine() (v.phS);
                if (noise > 0.0f) x += noise * v.rng.next();
                v.ph1 += v.d1; if (v.ph1 >= 1.0) v.ph1 -= 1.0;
                v.ph2 += v.d2; if (v.ph2 >= 1.0) v.ph2 -= 1.0;
                v.phS += v.dS; if (v.phS >= 1.0) v.phS -= 1.0;
                v.phM += v.dM; if (v.phM >= 1.0) v.phM -= std::floor (v.phM);
                x = v.f1.low (x); if (steep) x = v.f2.low (x);
                x *= v.a0 + (v.a1 - v.a0) * (float) (v.ctl + 1) / ctl;            // the loudness glides between its steps
                L[i] += x * v.pl; R[i] += x * v.pr;
                if (++v.ctl >= kCtl) v.ctl = 0;
            }
        }
        lfo += lfoStep * (double) n; lfo -= std::floor (lfo);
    }

    Voice voices[kVoices];
    uint8_t keys[16] {};
    int nHeld = 0;
    uint32_t clock = 0;
    float bend = 0.0f, wheel = 0.0f, lastHz = 0.0f;
    double lfo = 0.0;
    bool pedal = false;
};

//══════════════════════════════════════════════════════════════════════════════
/** The drum kit: sixteen pads on the keys a drum machine's notes are sent on. Each pad is made from nothing — a struck
    sine, noise, a handful of square waves that do not agree — or plays a sound that was given to it. */
class Drums final : public Instrument
{
public:
    static constexpr int kPads = 16;
    enum Model { mKick, mSnare, mClap, mHat, mOpenHat, mTom, mRim, mCowbell, mCrash, mRide, mTamb, mShaker, mClave, mConga };
    struct Pad { const char* name; int note; int model; float base; int choke; };
    static const Pad* pads()
    {
        static const Pad p[kPads] = {
            { "kick", 36, mKick, 48, 0 }, { "rim", 37, mRim, 1700, 0 }, { "snare", 38, mSnare, 185, 0 }, { "clap", 39, mClap, 1100, 0 },
            { "low tom", 41, mTom, 82, 0 }, { "hat", 42, mHat, 1, 1 }, { "mid tom", 45, mTom, 123, 0 }, { "open hat", 46, mOpenHat, 1, 1 },
            { "high tom", 48, mTom, 164, 0 }, { "crash", 49, mCrash, 1, 0 }, { "ride", 51, mRide, 1, 0 }, { "tambourine", 54, mTamb, 1, 0 },
            { "cowbell", 56, mCowbell, 540, 0 }, { "conga", 63, mConga, 220, 0 }, { "shaker", 70, mShaker, 1, 0 }, { "clave", 75, mClave, 2500, 0 } };
        return p;
    }
    /** Which pad a key plays (-1: none). Keys beside a pad's own play the nearest drum of its kind, as drum notes are usually laid out. */
    static int padOf (int note)
    {
        for (int i = 0; i < kPads; ++i) if (pads()[i].note == note) return i;
        switch (note) { case 35: return 0; case 40: return 2; case 43: return 4; case 44: return 5; case 47: return 6; case 50: return 8; case 57: return 9; case 59: return 10; case 62: case 64: return 13; case 69: case 82: return 14; case 76: return 15; default: return -1; }
    }
    enum { kLevel = 0, kTune, kDecay, kPan, kPer };
    Drums()
    {
        static const char* words[kPer] = { "level", "tune", "decay", "pan" };
        static const float defs[kPer][3] = { { 0, -36, 6 }, { 0, -24, 24 }, { 1, 0.2f, 3 }, { 0, -1, 1 } };
        names.reserve ((size_t) kPads * kPer + 1);
        for (int i = 0; i < kPads; ++i) for (int k = 0; k < kPer; ++k) { names.push_back (std::string (pads()[i].name) + "." + words[k]); }
        names.push_back ("level");
        for (int i = 0; i < kPads; ++i) for (int k = 0; k < kPer; ++k) info.push_back ({ names[(size_t) (i * kPer + k)].c_str(), defs[k][0], defs[k][1], defs[k][2] });
        info.push_back ({ names.back().c_str(), -3, -36, 6 });
        makeParams();
    }
    const char* kind() const override { return "drums"; }
    int paramCount() const override { return (int) info.size(); }
    const Param& paramInfo (int i) const override { return info[(size_t) i]; }

    void prepare (double sampleRate) override
    {
        sr = sampleRate;
        for (auto& v : voices) v = Voice();
    }
    bool sounding() const override { for (auto& v : voices) if (v.on) return true; return false; }
    void allOff (bool hard) override { if (hard) for (auto& v : voices) v.on = false; }      // (a drum that has been struck rings out)
    bool setSample (int slot, Sample s) override { if (slot < 0 || slot >= kPads) return false; for (auto& v : voices) if (v.pad == slot) v.on = false; own[slot] = std::move (s); return true; }

    void render (float* L, float* R, int n, const Ev* evs, int count) override
    {
        walk (n, evs, count, [this] (const Ev& e) { if ((e.st & 0xF0) == 0x90 && e.d2 > 0) hit (e.d1, (float) e.d2 / 127.0f); else if ((e.st & 0xF0) == 0xB0 && e.d1 == 120) allOff (true); },
              [this, L, R] (int from, int len) { for (auto& v : voices) if (v.on) sound (v, L + from, R + from, len); });
    }

private:
    struct Voice
    {
        bool on = false;
        int pad = 0, model = 0, t = 0, choke = 0;
        float vel = 0.0f, gain = 0.0f, pl = 0.7f, pr = 0.7f, tune = 1.0f, decay = 1.0f, fade = 1.0f;
        double ph[6] { 0, 0, 0, 0, 0, 0 }, pos = 0.0;
        Svf f1, f2;
        Rng rng;
        uint32_t born = 0;
    };

    void hit (int note, float vel)
    {
        const int pi = padOf (note);
        if (pi < 0) return;
        const auto& pd = pads()[pi];
        if (pd.choke != 0) for (auto& v : voices) if (v.on && v.choke == pd.choke && v.fade >= 1.0f) v.fade = 0.999f;        // a hat closes the one that was ringing
        Voice* pick = nullptr;
        for (auto& v : voices) if (! v.on) { pick = &v; break; }
        if (pick == nullptr) for (auto& v : voices) if (pick == nullptr || v.born < pick->born) pick = &v;
        auto& v = *pick;
        v = Voice();
        v.on = true; v.pad = pi; v.model = pd.model; v.choke = pd.choke; v.vel = vel; v.born = ++clock;
        v.rng.s = 0x9E3779B9u ^ (uint32_t) (pi * 2654435761u);
        const float lv = get (pi * kPer + kLevel), pan = get (pi * kPer + kPan);
        v.gain = dbLin (lv + get (kPads * kPer)) * (0.25f + 0.75f * vel * vel);
        v.tune = std::pow (2.0f, get (pi * kPer + kTune) / 12.0f);
        v.decay = get (pi * kPer + kDecay);
        v.pl = std::cos ((pan + 1.0f) * 0.7853982f) * 1.4142f; v.pr = std::sin ((pan + 1.0f) * 0.7853982f) * 1.4142f;
        const float s = (float) sr;
        switch (v.model)
        {
            case mSnare:   v.f1.set (1400.0f, 0.1f, s); v.f2.set (9000.0f, 0.05f, s); break;
            case mClap:    v.f1.set (1100.0f * v.tune, 0.55f, s); break;
            case mHat: case mOpenHat: v.f1.set (7200.0f * v.tune, 0.25f, s); break;
            case mCrash:   v.f1.set (4200.0f * v.tune, 0.1f, s); break;
            case mRide:    v.f1.set (6000.0f * v.tune, 0.3f, s); break;
            case mTamb: case mShaker: v.f1.set (6500.0f * v.tune, 0.2f, s); break;
            case mCowbell: v.f1.set (2640.0f * v.tune, 0.5f, s); break;
            default: break;
        }
    }

    /** Six square waves that are not in tune with one another: what a cymbal is made of. */
    static float metal (Voice& v, float tune, float isr)
    {
        static const float hz[6] = { 205.3f, 304.4f, 369.6f, 522.7f, 540.0f, 800.0f };
        float x = 0.0f;
        for (int k = 0; k < 6; ++k) { v.ph[k] += (double) (hz[k] * 4.1f * tune * isr); if (v.ph[k] >= 1.0) v.ph[k] -= 1.0; x += v.ph[k] < 0.5 ? 1.0f : -1.0f; }
        return x * (1.0f / 6.0f);
    }

    void sound (Voice& v, float* L, float* R, int n)
    {
        const float isr = (float) (1.0 / sr), base = pads()[v.pad].base * v.tune, d = v.decay;
        const Sample& smp = own[v.pad];
        if (smp.any())
        {
            /* a pad that was given a sound plays it from its beginning, faster or slower with its tuning, and dies away
               with its decay (turned all the way up it plays to its end) */
            const double step = (double) v.tune;
            const float tau = d >= 2.99f ? 0.0f : 0.5f * d * d;
            for (int i = 0; i < n; ++i)
            {
                const int i0 = (int) v.pos;
                if (i0 >= smp.n - 1 || v.fade < 1.0e-3f) { v.on = false; return; }
                const float f = (float) (v.pos - (double) i0), t = (float) v.t * isr;
                float e = v.gain * (tau > 0.0f ? std::exp (-t / tau) : 1.0f);
                if (v.fade < 1.0f) { v.fade *= 0.9985f; e *= v.fade; }
                L[i] += (smp.L[i0] + (smp.L[i0 + 1] - smp.L[i0]) * f) * e * v.pl;
                R[i] += (smp.R[i0] + (smp.R[i0 + 1] - smp.R[i0]) * f) * e * v.pr;
                v.pos += step; ++v.t;
                if (tau > 0.0f && t > tau * 9.0f) { v.on = false; return; }
            }
            return;
        }
        for (int i = 0; i < n; ++i)
        {
            const float t = (float) v.t * isr;
            float x = 0.0f, life = 0.0f;                                   // life: how much of it is left (it ends when that is next to nothing)
            switch (v.model)
            {
                case mKick:
                {
                    const float f = base * (1.0f + 2.6f * std::exp (-t / 0.028f) + 6.0f * std::exp (-t / 0.004f)), env = std::exp (-t / (0.30f * d));
                    v.ph[0] += (double) (f * isr);
                    x = std::tanh (1.7f * sine() (v.ph[0])) * env + v.rng.next() * 0.22f * std::exp (-t / 0.0025f);
                    life = env; break;
                }
                case mSnare:
                {
                    const float body = std::exp (-t / (0.085f * d)), sizzle = std::exp (-t / (0.15f * d)), drop = 1.0f + 0.5f * std::exp (-t / 0.012f);
                    v.ph[0] += (double) (base * drop * isr); v.ph[1] += (double) (base * 1.78f * drop * isr);
                    const float nz = v.f2.low (v.f1.high (v.rng.next()));
                    x = (sine() (v.ph[0]) * 0.55f + sine() (v.ph[1]) * 0.28f) * body + nz * 0.95f * sizzle;
                    life = std::max (body, sizzle); break;
                }
                case mClap:
                {
                    float env = 0.0f;
                    for (int k = 0; k < 3; ++k) { const float u = t - 0.011f * (float) k; if (u >= 0.0f) env = std::max (env, std::exp (-u / 0.0045f)); }
                    const float u = t - 0.031f, tail = u >= 0.0f ? std::exp (-u / (0.11f * d)) : 0.0f;
                    env = std::max (env * 0.9f, tail);
                    x = v.f1.band (v.rng.next()) * 2.4f * env;
                    life = t < 0.04f ? 1.0f : tail; break;
                }
                case mHat: case mOpenHat:
                {
                    const float env = std::exp (-t / ((v.model == mHat ? 0.038f : 0.34f) * d));
                    x = v.f1.high (metal (v, v.tune, isr) + v.rng.next() * 0.25f) * 1.5f * env;
                    life = env; break;
                }
                case mTom:
                {
                    const float f = base * (1.0f + 0.9f * std::exp (-t / 0.045f)), env = std::exp (-t / (0.26f * d));
                    v.ph[0] += (double) (f * isr);
                    x = sine() (v.ph[0]) * env + v.rng.next() * 0.12f * std::exp (-t / 0.006f);
                    life = env; break;
                }
                case mRim:
                {
                    v.ph[0] += (double) (base * isr); v.ph[1] += (double) (base * 0.283f * isr);
                    const float e1 = std::exp (-t / (0.011f * d)), e2 = std::exp (-t / (0.028f * d));
                    x = sine() (v.ph[0]) * 0.7f * e1 + sine() (v.ph[1]) * 0.45f * e2 + v.rng.next() * 0.3f * std::exp (-t / 0.0015f);
                    life = e2; break;
                }
                case mCowbell:
                {
                    v.ph[0] += (double) (base * isr); if (v.ph[0] >= 1.0) v.ph[0] -= 1.0;
                    v.ph[1] += (double) (base * 1.4815f * isr); if (v.ph[1] >= 1.0) v.ph[1] -= 1.0;
                    const float env = 0.6f * std::exp (-t / 0.018f) + 0.4f * std::exp (-t / (0.24f * d));
                    x = v.f1.band ((v.ph[0] < 0.5 ? 1.0f : -1.0f) + (v.ph[1] < 0.5 ? 1.0f : -1.0f)) * 0.9f * env;
                    life = env; break;
                }
                case mCrash:
                {
                    const float env = std::exp (-t / (0.55f * d));
                    x = v.f1.high (metal (v, v.tune * 1.12f, isr) * 0.8f + v.rng.next() * 0.6f) * 1.1f * env;
                    life = env; break;
                }
                case mRide:
                {
                    const float env = std::exp (-t / (0.5f * d));
                    x = v.f1.band (metal (v, v.tune * 1.31f, isr)) * 1.6f * env + v.rng.next() * 0.05f * std::exp (-t / 0.004f);
                    life = env; break;
                }
                case mTamb:
                {
                    const float env = std::min (1.0f, t / 0.003f) * std::exp (-t / (0.16f * d));
                    x = v.f1.high (metal (v, v.tune * 1.6f, isr) * 0.6f + v.rng.next() * 0.6f) * 1.2f * env;
                    life = t < 0.004f ? 1.0f : env; break;
                }
                case mShaker:
                {
                    const float env = std::min (1.0f, t / 0.006f) * std::exp (-t / (0.055f * d));
                    x = v.f1.high (v.rng.next()) * 1.1f * env;
                    life = t < 0.008f ? 1.0f : env; break;
                }
                case mClave:
                {
                    v.ph[0] += (double) (base * isr);
                    const float env = std::exp (-t / (0.026f * d));
                    x = sine() (v.ph[0]) * env;
                    life = env; break;
                }
                default: // mConga
                {
                    const float f = base * (1.0f + 0.25f * std::exp (-t / 0.02f)), env = std::exp (-t / (0.17f * d));
                    v.ph[0] += (double) (f * isr);
                    x = sine() (v.ph[0]) * env + v.rng.next() * 0.1f * std::exp (-t / 0.003f);
                    life = env; break;
                }
            }
            if (v.fade < 1.0f) { v.fade *= 0.9985f; x *= v.fade; life *= v.fade; }
            x *= v.gain;
            L[i] += x * v.pl * 0.7071f; R[i] += x * v.pr * 0.7071f;
            ++v.t;
            if (life < 5.0e-4f) { v.on = false; return; }
        }
    }

    static constexpr int kVoices = 16;
    Voice voices[kVoices];
    Sample own[kPads];
    std::vector<std::string> names;
    std::vector<Param> info;
    uint32_t clock = 0;
};

//══════════════════════════════════════════════════════════════════════════════
/** The sampler: one sound, played up and down the keys from the key it was made on. */
class Sampler final : public Instrument
{
public:
    enum P { pRoot, pTune, pStart, pEnd, pLoop, pLoopStart, pLoopEnd, pA, pD, pS, pR, pCutoff, pReso, pLevel, pVelAmp, pOneShot, pMono, pBend, pCount };
    static const Param* table()
    {
        static const Param t[pCount] = {
            { "root", 60, 0, 127 }, { "tune", 0, -100, 100 }, { "start", 0, 0, 1 }, { "end", 1, 0, 1 }, { "loop", 0, 0, 1 }, { "loopStart", 0, 0, 1 }, { "loopEnd", 1, 0, 1 },
            { "a", 0.002f, 0.0005f, 10 }, { "d", 0.3f, 0.002f, 10 }, { "s", 1, 0, 1 }, { "r", 0.12f, 0.002f, 12 },
            { "cutoff", 20000, 20, 20000 }, { "reso", 0.1f, 0, 1 }, { "level", -3, -36, 12 }, { "velAmp", 0.6f, 0, 1 }, { "oneShot", 0, 0, 1 }, { "mono", 0, 0, 1 }, { "bend", 2, 0, 24 } };
        return t;
    }
    Sampler() { makeParams(); }
    const char* kind() const override { return "sampler"; }
    int paramCount() const override { return pCount; }
    const Param& paramInfo (int i) const override { return table()[i]; }
    void prepare (double sampleRate) override { sr = sampleRate; for (auto& v : voices) v = Voice(); pedal = false; bend = 0.0f; }
    bool sounding() const override { for (auto& v : voices) if (v.env.alive()) return true; return false; }
    bool setSample (int slot, Sample s) override { if (slot != 0) return false; for (auto& v : voices) v.env.kill(); smp = std::move (s); return true; }
    void allOff (bool hard) override { pedal = false; for (auto& v : voices) { v.gate = false; v.susp = false; if (hard) v.env.kill(); else v.env.off(); } }

    void render (float* L, float* R, int n, const Ev* evs, int count) override
    {
        walk (n, evs, count, [this] (const Ev& e) { handle (e); }, [this, L, R] (int from, int len) { sound (L + from, R + from, len); });
    }

private:
    static constexpr int kVoices = 16, kCtl = 16;
    struct Voice
    {
        Adsr env;
        Svf fl, fr;
        double pos = 0.0;
        float vel = 0.0f, a0 = 0.0f, a1 = 0.0f;
        int note = -1, ctl = 0;
        uint32_t born = 0;
        bool gate = false, susp = false;
    };

    void handle (const Ev& e)
    {
        const int type = e.st & 0xF0;
        if (type == 0x90 && e.d2 > 0) noteOn (e.d1, (float) e.d2 / 127.0f);
        else if (type == 0x80 || type == 0x90) noteOff (e.d1);
        else if (type == 0xE0) bend = (float) (((int) e.d2 << 7 | (int) e.d1) - 8192) / 8192.0f;
        else if (type == 0xB0)
        {
            if (e.d1 == 64) { const bool down = e.d2 >= 64; if (pedal && ! down) for (auto& v : voices) if (v.susp) { v.susp = false; v.env.off(); } pedal = down; }
            else if (e.d1 == 120 || e.d1 == 123) allOff (e.d1 == 120);
        }
    }
    void noteOn (int note, float vel)
    {
        if (! smp.any()) return;
        Voice* pick = nullptr;
        if (get (pMono) >= 0.5f) { for (auto& v : voices) if (&v != &voices[0]) v.env.off(); pick = &voices[0]; }
        if (pick == nullptr) for (auto& v : voices) if (! v.env.alive()) { pick = &v; break; }
        if (pick == nullptr)
        {
            for (auto& v : voices) if (! v.gate && ! v.susp && (pick == nullptr || v.born < pick->born)) pick = &v;
            if (pick == nullptr) for (auto& v : voices) if (pick == nullptr || v.born < pick->born) pick = &v;
        }
        auto& v = *pick;
        const bool was = v.env.alive();
        v.note = note; v.vel = vel; v.gate = true; v.susp = false; v.born = ++clock; v.ctl = 0;
        v.pos = (double) get (pStart) * (double) (smp.n - 1);
        if (! was) { v.fl.clear(); v.fr.clear(); v.a0 = v.a1 = 0.0f; }
        v.env.on();
    }
    void noteOff (int note)
    {
        if (get (pOneShot) >= 0.5f) { for (auto& v : voices) if (v.note == note) v.gate = false; return; }      // struck once, it plays to its end
        for (auto& v : voices) if (v.note == note && v.gate) { v.gate = false; if (pedal) v.susp = true; else v.env.off(); }
    }

    /** A sound read between its samples, bent through the four nearest (so that it stays clear when it is played far from its own key). */
    static float read (const float* s, int n, double pos)
    {
        const int i1 = (int) pos; const float f = (float) (pos - (double) i1);
        const float y0 = s[i1 > 0 ? i1 - 1 : 0], y1 = s[i1], y2 = s[i1 + 1 < n ? i1 + 1 : n - 1], y3 = s[i1 + 2 < n ? i1 + 2 : n - 1];
        const float c1 = 0.5f * (y2 - y0), c2 = y0 - 2.5f * y1 + 2.0f * y2 - 0.5f * y3, c3 = 0.5f * (y3 - y0) + 1.5f * (y1 - y2);
        return ((c3 * f + c2) * f + c1) * f + y1;
    }

    void sound (float* L, float* R, int n)
    {
        if (! smp.any()) return;
        const float ctl = (float) kCtl;
        const float ca = Adsr::coefAttack (get (pA), sr, ctl), cd = Adsr::coef (get (pD), sr, ctl), cs = get (pS), cr = Adsr::coef (get (pR), sr, ctl);
        const float root = get (pRoot), tune = get (pTune) / 100.0f + bend * get (pBend), cut = get (pCutoff), reso = get (pReso), velAmp = get (pVelAmp), level = dbLin (get (pLevel));
        const bool filtered = cut < 19000.0f, loop = get (pLoop) >= 0.5f, oneShot = get (pOneShot) >= 0.5f;
        const double last = (double) (smp.n - 1);
        const double endAt = std::max (1.0, std::min (last, (double) get (pEnd) * last));
        double l0 = (double) get (pLoopStart) * last, l1 = std::min (endAt, (double) get (pLoopEnd) * last);
        const bool loops = loop && l1 - l0 > 16.0;
        for (auto& v : voices)
        {
            if (! v.env.alive()) continue;
            const double step = std::pow (2.0, ((double) v.note - (double) root + (double) tune) / 12.0);
            const float velG = ((1.0f - velAmp) + velAmp * v.vel * v.vel) * level;
            if (filtered) { v.fl.set (cut, reso, sr); v.fr.set (cut, reso, sr); }
            const double closing = std::max (2.0, 0.003 * sr * step);            // a sound that is cut off before its own end is faded over its last three thousandths of a second
            for (int i = 0; i < n; ++i)
            {
                if (v.ctl == 0)
                {
                    v.a0 = v.a1; v.a1 = v.env.step (ca, cd, oneShot ? 1.0f : cs, cr) * velG;
                    if (! v.env.alive()) { v.a0 = v.a1 = 0.0f; break; }
                }
                const bool round = loops && (v.gate || v.susp);                  // held, it goes round its loop; let go, it runs on to its end
                if (round && v.pos >= l1) v.pos = l0 + std::fmod (v.pos - l0, l1 - l0);
                if (v.pos >= endAt) { v.env.kill(); v.a0 = v.a1 = 0.0f; break; }
                float l = read (smp.L, smp.n, v.pos), r = read (smp.R, smp.n, v.pos);
                if (filtered) { l = v.fl.low (l); r = v.fr.low (r); }
                float a = v.a0 + (v.a1 - v.a0) * (float) (v.ctl + 1) / ctl;
                if (! round && endAt - v.pos < closing) a *= (float) ((endAt - v.pos) / closing);
                L[i] += l * a; R[i] += r * a;
                v.pos += step;
                if (++v.ctl >= kCtl) v.ctl = 0;
            }
        }
    }

    Voice voices[kVoices];
    Sample smp;
    uint32_t clock = 0;
    float bend = 0.0f;
    bool pedal = false;
};

inline std::unique_ptr<Instrument> make (const char* kind)
{
    if (std::strcmp (kind, "synth") == 0)   return std::make_unique<Synth>();
    if (std::strcmp (kind, "drums") == 0)   return std::make_unique<Drums>();
    if (std::strcmp (kind, "sampler") == 0) return std::make_unique<Sampler>();
    return {};
}

} // namespace slurinst
