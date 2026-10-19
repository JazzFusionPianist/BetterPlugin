#pragma once
#include <juce_core/juce_core.h>
#include <vector>
#include <complex>
#include <cmath>
#include <functional>

namespace daw
{
/** A plug-in learnt by what it does, not by its name: sound of a known kind is sent through it and what comes out is
    measured (Engine::probe plays it; ui/probe.js moves one control at a time and reads, from how the answer changes,
    which control is a band's frequency, a compressor's threshold, a reverb's decay…). With that, any plug-in on the Mac
    can be put to work by a request made by its sound — an eq is an eq whoever made it (his ask, 2026-10-16: every
    kind of plug-in, none written out by hand). Each signal answers one question:
      noise    a flat noise that repeats every N samples, at −20 dBFS, the same on both sides: what it does to each
               twelfth of an octave (exact whatever its lateness: a period of the answer over a period of the signal),
               how loud it comes out, and whether it makes a mono sound wide
      levels   a tone (1 kHz, or hz) in steps of 3 dB from −60 to 0 dBFS, 300 ms each: how loud each comes out (a
               compressor's curve: where it begins, how hard it holds)
      burst    the tone at −40 dBFS, then −6 for a second, then −40 again for three: how it moves the level each
               millisecond (how fast it takes hold and lets go)
      impulse  one click, then four seconds of nothing: what sounds on after it, 2 ms at a time (a reverb's length, its
               wait before the room answers, an echo)
      sine     a tone (hz, db asked for) for a second: the harmonics it adds, each against the tone
      stereo   two unrelated noises, one each side: whether it makes a sound wider or narrower, louder on one side
    The plug-in is played offline, block by block, through `run` (it processes L and R in place). */
struct Probe
{
    static constexpr int N = 8192, FINE = 120;
    using Run = std::function<void (float*, float*, int)>;

    Probe (double sampleRate, int blockSize, Run r) : sr (sampleRate), block (juce::jmax (32, blockSize)), run (std::move (r)) {}
    int lat = 0;                                                       // how late it says it is (samples): what comes out is read that much later

    juce::var measure (const juce::String& sig, double hz = 1000.0, double dbIn = -12.0)
    {
        if (sig == "noise")   return noise (false);
        if (sig == "stereo")  return noise (true);
        if (sig == "levels")  return levels (hz);                      // (a de-esser is asked at 6 kHz)
        if (sig == "burst")   return burst();
        if (sig == "impulse") return impulse();
        if (sig == "sine")    return sine (hz, dbIn);
        auto* o = new juce::DynamicObject(); o->setProperty ("error", "no such signal"); return juce::var (o);
    }

private:
    double sr;
    int block;
    Run run;
    juce::Random rnd { 20261016 };

    static int tenths (double p) { return (int) std::lround (juce::jlimit (-2000.0, 400.0, 100.0 * std::log10 (p + 1e-20))); }
    static double dbOf (double p) { return 10.0 * std::log10 (p + 1e-20); }
    static void fft (std::vector<std::complex<double>>& a, bool inverse)
    {
        const int n = (int) a.size();
        for (int i = 1, j = 0; i < n; ++i) { int bit = n >> 1; for (; j & bit; bit >>= 1) j ^= bit; j ^= bit; if (i < j) std::swap (a[(size_t) i], a[(size_t) j]); }
        for (int len = 2; len <= n; len <<= 1)
        {
            const double ang = (inverse ? 2.0 : -2.0) * juce::MathConstants<double>::pi / (double) len;
            const std::complex<double> wl (std::cos (ang), std::sin (ang));
            for (int i = 0; i < n; i += len)
            {
                std::complex<double> w (1.0, 0.0);
                for (int k = 0; k < len / 2; ++k) { const auto u = a[(size_t) (i + k)], v = a[(size_t) (i + k + len / 2)] * w; a[(size_t) (i + k)] = u + v; a[(size_t) (i + k + len / 2)] = u - v; w *= wl; }
            }
        }
        if (inverse) for (auto& x : a) x /= (double) n;
    }
    /** The signal played through, block by block; what came out, side by side. */
    void play (std::vector<float>& L, std::vector<float>& R)
    {
        for (size_t i = 0; i < L.size(); i += (size_t) block)
        {
            const int n = (int) juce::jmin ((size_t) block, L.size() - i);
            run (L.data() + i, R.data() + i, n);
        }
    }
    /** One period of a flat noise: every bin of N at one strength, at a phase of its own; rms 0.1 (−20 dBFS). */
    std::vector<double> period()
    {
        std::vector<std::complex<double>> X ((size_t) N);
        for (int k = 1; k < N / 2; ++k) { const double ph = rnd.nextDouble() * 2.0 * juce::MathConstants<double>::pi; X[(size_t) k] = std::polar (1.0, ph); X[(size_t) (N - k)] = std::conj (X[(size_t) k]); }
        fft (X, true);
        std::vector<double> x ((size_t) N);
        double e = 0; for (int i = 0; i < N; ++i) { x[(size_t) i] = X[(size_t) i].real(); e += x[(size_t) i] * x[(size_t) i]; }
        const double g = 0.1 / std::sqrt (e / N);
        for (auto& v : x) v *= g;
        return x;
    }
    /** The twelfths of an octave (as Listen tells them): which bins each holds; the nearest where none falls inside. */
    void fineSpan (int k, int& a, int& b) const
    {
        const double fc = 20.0 * std::pow (2.0, k / 12.0), per = sr / N, lo = fc / std::pow (2.0, 1.0 / 24.0), hi = fc * std::pow (2.0, 1.0 / 24.0);
        a = (int) std::ceil (lo / per); b = (int) std::floor (hi / per);
        if (b < a) a = b = (int) std::lround (fc / per);
        a = juce::jlimit (1, N / 2 - 1, a); b = juce::jlimit (a, N / 2 - 1, b);
    }

    juce::var noise (bool apart)
    {
        auto pl = period(), pr = apart ? period() : pl;
        const int warm = (int) std::ceil (0.6 * sr / N) + 1, keep = 4, periods = warm + keep;
        std::vector<float> L ((size_t) (periods * N)), R ((size_t) (periods * N));
        for (int p = 0; p < periods; ++p) for (int i = 0; i < N; ++i) { L[(size_t) (p * N + i)] = (float) pl[(size_t) i]; R[(size_t) (p * N + i)] = (float) pr[(size_t) i]; }
        play (L, R);
        /* the last periods, laid one on another: the steady answer to one period */
        std::vector<double> yl ((size_t) N, 0.0), yr ((size_t) N, 0.0);
        for (int p = warm; p < periods; ++p) for (int i = 0; i < N; ++i) { yl[(size_t) i] += L[(size_t) (p * N + i)] / keep; yr[(size_t) i] += R[(size_t) (p * N + i)] / keep; }
        auto spec = [] (const std::vector<double>& v) { std::vector<std::complex<double>> X (v.size()); for (size_t i = 0; i < v.size(); ++i) X[i] = v[i]; fft (X, false); return X; };
        const auto XL = spec (pl), XR = spec (pr), YL = spec (yl), YR = spec (yr);
        auto* o = new juce::DynamicObject();
        double eIn = 0, eL = 0, eR = 0, eM = 0, eS = 0, eX = 0;
        for (int i = 0; i < N; ++i) { eIn += pl[(size_t) i] * pl[(size_t) i] + pr[(size_t) i] * pr[(size_t) i]; eL += yl[(size_t) i] * yl[(size_t) i]; eR += yr[(size_t) i] * yr[(size_t) i]; const double m = 0.5 * (yl[(size_t) i] + yr[(size_t) i]), s = 0.5 * (yl[(size_t) i] - yr[(size_t) i]); eM += m * m; eS += s * s; eX += yl[(size_t) i] * yr[(size_t) i]; }
        o->setProperty ("gain", juce::String (dbOf ((eL + eR) / (eIn + 1e-20)), 2));
        o->setProperty ("side", juce::String (eM + eS > 1e-20 ? eS / (eM + eS) : 0.0, 3));
        o->setProperty ("corr", juce::String (eL > 1e-20 && eR > 1e-20 ? eX / std::sqrt (eL * eR) : 1.0, 3));
        o->setProperty ("lr", juce::String (dbOf (eR / (eL + 1e-20)), 2));
        /* each twelfth: what comes out of both sides over what went in (the power over the bins it holds) */
        juce::Array<juce::var> tf, tfS;
        for (int k = 0; k < FINE; ++k)
        {
            int a, b; fineSpan (k, a, b);
            double pin = 0, pout = 0, pside = 0;
            for (int j = a; j <= b; ++j)
            {
                pin += std::norm (XL[(size_t) j]) + std::norm (XR[(size_t) j]);
                pout += std::norm (YL[(size_t) j]) + std::norm (YR[(size_t) j]);
                pside += std::norm (0.5 * (YL[(size_t) j] - YR[(size_t) j]));
            }
            tf.add (tenths (pout / (pin + 1e-30)));
            tfS.add (tenths (pside / (pout + 1e-30)));
        }
        o->setProperty ("tf", tf);                                     // (tenths of a dB, a twelfth of an octave each from 20 Hz)
        o->setProperty ("tfSide", tfS);
        return juce::var (o);
    }

    std::vector<float> tone (double hz, const std::vector<std::pair<double, double>>& parts)      // (seconds, dBFS) one after another
    {
        size_t n = 0; for (auto& p : parts) n += (size_t) (p.first * sr);
        std::vector<float> x (n);
        size_t at = 0; double ph = 0;
        for (auto& p : parts)
        {
            const double a = std::pow (10.0, p.second / 20.0) * std::sqrt (2.0);      // (a tone's rms at that many dBFS)
            for (size_t i = 0; i < (size_t) (p.first * sr); ++i) { x[at++] = (float) (a * std::sin (ph)); ph += 2.0 * juce::MathConstants<double>::pi * hz / sr; }
        }
        return x;
    }
    static double rmsOf (const std::vector<float>& L, const std::vector<float>& R, size_t a, size_t b)
    {
        double e = 0; for (size_t i = a; i < b && i < L.size(); ++i) e += 0.5 * ((double) L[i] * L[i] + (double) R[i] * R[i]);
        return e / (double) juce::jmax ((size_t) 1, b - a);
    }

    juce::var levels (double hz)
    {
        std::vector<std::pair<double, double>> parts { { 0.6, -60.0 } };
        for (int d = -60; d <= 0; d += 3) parts.push_back ({ 0.3, (double) d });
        auto L = tone (hz, parts), R = L;
        play (L, R);
        auto* o = new juce::DynamicObject();
        juce::Array<juce::var> in, out;
        size_t at = (size_t) (0.6 * sr);
        for (int d = -60; d <= 0; d += 3)
        {
            const size_t len = (size_t) (0.3 * sr);
            in.add (d); out.add (juce::String (dbOf (rmsOf (L, R, at + len / 2, at + len)), 2).getDoubleValue());
            at += len;
        }
        o->setProperty ("in", in); o->setProperty ("out", out);
        return juce::var (o);
    }

    juce::var burst()
    {
        auto L = tone (1000.0, { { 1.0, -40.0 }, { 1.0, -6.0 }, { 3.0, -40.0 } }), R = L, I = L;      // (three seconds after: a long release is seen let go)
        play (L, R);
        auto* o = new juce::DynamicObject();
        juce::Array<juce::var> g;
        const size_t ms = (size_t) (sr / 1000.0), late = (size_t) juce::jmax (0, lat);
        for (size_t i = 0; i + ms + late <= L.size(); i += ms)
        {
            double ei = 0; for (size_t j = i; j < i + ms; ++j) ei += (double) I[j] * I[j];
            g.add (tenths (rmsOf (L, R, i + late, i + late + ms) * (double) ms / (ei + 1e-20)));      // (what came out, as late as it is, over what went in, each millisecond)
        }
        o->setProperty ("gain", g); o->setProperty ("up", 1000); o->setProperty ("down", 2000);      // (the milliseconds where the tone steps up and down)
        return juce::var (o);
    }

    juce::var impulse()
    {
        const size_t at = (size_t) (0.2 * sr), n = at + (size_t) (4.0 * sr);
        std::vector<float> L (n, 0.0f), R (n, 0.0f);
        L[at] = R[at] = 0.5f;
        play (L, R);
        auto* o = new juce::DynamicObject();
        juce::Array<juce::var> env;
        const size_t step = (size_t) (0.002 * sr);
        for (size_t i = at; i + step <= n; i += step) env.add (tenths (rmsOf (L, R, i, i + step) / 0.25));      // (against the click's own power)
        double pre = 0; for (size_t i = 0; i < at; ++i) pre += 0.5 * ((double) L[i] * L[i] + (double) R[i] * R[i]);
        o->setProperty ("env", env); o->setProperty ("stepMs", 2); o->setProperty ("before", tenths (pre / juce::jmax ((size_t) 1, at)));
        return juce::var (o);
    }

    juce::var sine (double hz, double dbIn)
    {
        const double per = sr / N, f = juce::jmax (1.0, std::round (hz / per)) * per;      // (on a bin: nothing smears)
        auto L = tone (f, { { 1.0, dbIn } }), R = L;
        play (L, R);
        std::vector<std::complex<double>> X ((size_t) N);
        const size_t from = L.size() - (size_t) N;
        for (int i = 0; i < N; ++i) { const double w = 0.5 - 0.5 * std::cos (2.0 * juce::MathConstants<double>::pi * i / N); X[(size_t) i] = w * 0.5 * ((double) L[from + (size_t) i] + (double) R[from + (size_t) i]); }
        fft (X, false);
        const int k0 = (int) std::lround (f / per);
        auto at = [&] (int k) { double p = 0; for (int j = k - 2; j <= k + 2; ++j) if (j > 0 && j < N / 2) p += std::norm (X[(size_t) j]); return p; };
        auto* o = new juce::DynamicObject();
        juce::Array<juce::var> h;
        const double p1 = at (k0);
        for (int m = 2; m <= 8 && k0 * m < N / 2 - 2; ++m) h.add (juce::String (dbOf (at (k0 * m) / (p1 + 1e-30)), 1).getDoubleValue());
        double all = 0; for (int k = 1; k < N / 2; ++k) all += std::norm (X[(size_t) k]);
        o->setProperty ("hz", f); o->setProperty ("harm", h);
        o->setProperty ("thd", juce::String (dbOf ((all - p1) / (p1 + 1e-30)), 1).getDoubleValue());      // (everything that is not the tone, against the tone)
        o->setProperty ("out", juce::String (dbOf (rmsOf (L, R, from, L.size())), 2).getDoubleValue());
        return juce::var (o);
    }
};
}
