#pragma once
#include <juce_core/juce_core.h>
#include <vector>
#include <complex>
#include <cmath>

namespace daw
{
/** What a sound is like over a stretch of the song, as numbers: the room's ears. A request made by its sound ("kick and
    bass sound apart", "the vocal further back") is read as changes along measurable lines — brightness, width, how far
    away, how much one covers another — and every way of doing it is measured by these until it is heard as asked
    (ui/ears.js reads them into those lines; ui/ways.js asks and measures). Fed a sound block by block, as an offline
    pass hands it out (Engine::listen); read once at the end.
      bands  every HOP samples, the power of each third of an octave from 20 Hz to 20 kHz (31 of them), of the sum of
             the two sides, in dB
      level  the frame's loudness (rms of both sides) in dB
      kl     the frame's loudness as people hear it (BS.1770's weighting: the sum of both sides' mean squares after it),
             in tenths of a dB — loudness in LUFS is this less 0.691 — for levels to be matched by
      side   how much of the frame is the difference of its two sides: 0 none (mono), 1 all of it (in hundredths)
      corr   how alike the two sides are in the frame: 1 the same, 0 unrelated, −1 opposed (in hundredths)
      fast   every FAST samples (about 5 ms), the loudness of both sides in tenths of a dB: where a hit begins, how
             it rises and dies, and how far another sound gives way under it at that moment (a frame of the bands is
             190 ms long and smears all of that)
      peak   every FAST samples, the highest sample of either side in tenths of a dB: how sharp it is
      near   the loudness every FAST samples of only the stretch between two frequencies, when one is asked for
      ltas   the whole stretch's spectrum, the power of each twelfth of an octave from 20 Hz to 20 kHz (120 of them,
             per bin), in tenths of a dB: where a sound rings (a resonance stands out of its neighbours), its tilt
      mid, sideBands   the whole stretch's power of the sum and of the difference of its sides, each third of an
             octave, in tenths of a dB
      bandCorr   the whole stretch's likeness of its two sides, each third of an octave (hundredths, 1 the same, 0
             unrelated): how wide it is low and high — a sound panned to one side is as narrow as one in the middle
      lr     the whole stretch's power of its left and of its right, in tenths of a dB: where it stands
      segs   asked for by a length (in samples: a bar, for the mix doctor): ltas, mid, sideBands, bandCorr and lr again,
             for each such piece of the stretch in turn, with the frames it ends at (frames), so a bar can be read on
             its own as the whole is
    The dB are the same for every sound (one window, one scale), so sounds are compared by them; their zero is not a
    standard's (but kl's). The transform is the room's own (a radix-2 FFT here): nothing outside is asked for. */
struct Listen
{
    static constexpr int N = 8192, HOP = 2048, BANDS = 31, FAST = 256, FINE = 120;
    static const double* centres()
    {
        static const double c[BANDS] = { 20, 25, 31.5, 40, 50, 63, 80, 100, 125, 160, 200, 250, 315, 400, 500, 630, 800,
                                         1000, 1250, 1600, 2000, 2500, 3150, 4000, 5000, 6300, 8000, 10000, 12500, 16000, 20000 };
        return c;
    }
    /** The twelfths of an octave the long spectrum is told in: 20 Hz times 2^(k/12). */
    static double fineCentre (int k) { return 20.0 * std::pow (2.0, (double) k / 12.0); }

    explicit Listen (double sampleRate, double lo = 0, double hi = 0, double segSamples = 0) : sr (sampleRate), segLen (segSamples), ringL (N, 0.0f), ringR (N, 0.0f), win (N), fft (N)
    {
        band = lo > 0 && hi > lo;
        if (band) { hp.make (sr, lo, true); lp.make (sr, hi, false); }
        kShelf.kShelf (sr); kHigh.kHigh (sr); kShelfR.kShelf (sr); kHighR.kHigh (sr);
        for (int i = 0; i < N; ++i) win[(size_t) i] = 0.5f - 0.5f * std::cos (2.0f * juce::MathConstants<float>::pi * (float) i / (float) N);
        /* which bins make each band: those inside its third (or twelfth) of an octave; where none falls inside (the
           lowest, at this length), the one nearest its centre */
        const double per = sr / (double) N;
        auto span = [per] (double fc, double half, int& a, int& b)
        {
            const double lo = fc / std::pow (2.0, half), hi = fc * std::pow (2.0, half);
            int k0 = (int) std::ceil (lo / per), k1 = (int) std::floor (hi / per);
            if (k1 < k0) k0 = k1 = (int) std::lround (fc / per);
            a = juce::jlimit (1, N / 2 - 1, k0); b = juce::jlimit (a, N / 2 - 1, k1);
        };
        for (int b = 0; b < BANDS; ++b) span (centres()[b], 1.0 / 6.0, bandLo[b], bandHi[b]);
        for (int k = 0; k < FINE; ++k) span (fineCentre (k), 1.0 / 24.0, fineLo[k], fineHi[k]);
    }

    void push (const float* l, const float* r, int n)
    {
        for (int i = 0; i < n; ++i)
        {
            const float L = l[i], R = r != nullptr ? r[i] : l[i], m = 0.5f * (L + R), s = 0.5f * (L - R);
            ringL[(size_t) at] = L; ringR[(size_t) at] = R; at = (at + 1) % N;
            sumLR += (double) L * L + (double) R * R; sumM += (double) m * m; sumS += (double) s * s;
            sumL += (double) L * L; sumR += (double) R * R; sumX += (double) L * R;
            const double kL = kHigh.run (kShelf.run ((double) L)), kR = kHighR.run (kShelfR.run ((double) R));
            sumK += kL * kL + kR * kR;
            fastLR += (double) L * L + (double) R * R;
            fastPk = juce::jmax (fastPk, std::abs (L), std::abs (R));
            if (band) { const double x = lp.run (hp.run ((double) m)); fastB += x * x; }
            if (++fastN >= FAST)
            {
                fasts.push_back (tenths (fastLR / (2.0 * FAST)));
                peaks.push_back (tenths ((double) fastPk * fastPk));
                if (band) nears.push_back (tenths (fastB / FAST));
                fastLR = fastB = 0; fastPk = 0; fastN = 0;
            }
            ++pushed;
            if (++fill >= HOP) frame();
        }
    }

    juce::var result() const
    {
        auto* o = new juce::DynamicObject();
        auto list = [] (const std::vector<int>& v) { juce::Array<juce::var> a; for (auto x : v) a.add (x); return a; };
        juce::Array<juce::var> fb;
        for (auto& f : frames) fb.add (list (f));
        const double nf = juce::jmax (1.0, (double) frames.size());
        std::vector<int> lt (FINE), md (BANDS), sd (BANDS), bc (BANDS);
        for (int k = 0; k < FINE; ++k) lt[(size_t) k] = tenths (fineSum[k] / nf);
        for (int b = 0; b < BANDS; ++b)
        {
            md[(size_t) b] = tenths (midSum[b] / nf); sd[(size_t) b] = tenths (sideSum[b] / nf);
            bc[(size_t) b] = (int) std::lround (100.0 * (lSum[b] > 1e-20 && rSum[b] > 1e-20 ? xSum[b] / std::sqrt (lSum[b] * rSum[b]) : 1.0));
        }
        o->setProperty ("bands", fb); o->setProperty ("level", list (levels)); o->setProperty ("kl", list (kls)); o->setProperty ("side", list (sides));
        o->setProperty ("corr", list (corrs)); o->setProperty ("fast", list (fasts)); o->setProperty ("peak", list (peaks));
        o->setProperty ("ltas", list (lt)); o->setProperty ("mid", list (md)); o->setProperty ("sideBands", list (sd)); o->setProperty ("bandCorr", list (bc));
        juce::Array<juce::var> lr; lr.add (tenths (allL / juce::jmax (1.0, count))); lr.add (tenths (allR / juce::jmax (1.0, count)));
        o->setProperty ("lr", lr);
        if (band) o->setProperty ("near", list (nears));
        if (segLen > 0)
        {
            juce::Array<juce::var> sg (segs);
            if (seg.frames > 0) sg.add (seg.read ((int) frames.size()));      // (the last piece, however short)
            o->setProperty ("segs", sg);
        }
        return juce::var (o);
    }

private:
    double sr, segLen = 0;
    juce::int64 pushed = 0;
    /** One piece of the stretch's sums: what the whole keeps only once, kept again for each piece. */
    struct Piece
    {
        double fine[FINE] {}, mid[BANDS] {}, side[BANDS] {}, l[BANDS] {}, r[BANDS] {}, x[BANDS] {}, allL = 0, allR = 0, count = 0;
        int frames = 0;
        juce::var read (int endFrame) const
        {
            auto* o = new juce::DynamicObject();
            const double nf = juce::jmax (1.0, (double) frames);
            juce::Array<juce::var> lt, md, sd, bc, lr;
            for (int k = 0; k < FINE; ++k) lt.add (tenths (fine[k] / nf));
            for (int b = 0; b < BANDS; ++b) { md.add (tenths (mid[b] / nf)); sd.add (tenths (side[b] / nf)); bc.add ((int) std::lround (100.0 * (l[b] > 1e-20 && r[b] > 1e-20 ? x[b] / std::sqrt (l[b] * r[b]) : 1.0))); }
            lr.add (tenths (allL / juce::jmax (1.0, count))); lr.add (tenths (allR / juce::jmax (1.0, count)));
            o->setProperty ("ltas", lt); o->setProperty ("mid", md); o->setProperty ("sideBands", sd); o->setProperty ("bandCorr", bc); o->setProperty ("lr", lr); o->setProperty ("frames", endFrame);
            return juce::var (o);
        }
    } seg;
    juce::Array<juce::var> segs;
    std::vector<float> ringL, ringR, win;
    std::vector<std::complex<float>> fft;
    int at = 0, fill = 0;
    double sumLR = 0, sumM = 0, sumS = 0, sumL = 0, sumR = 0, sumX = 0, sumK = 0, fastLR = 0, fastB = 0, allL = 0, allR = 0, count = 0;
    float fastPk = 0;
    int fastN = 0;
    bool band = false;
    int bandLo[BANDS] {}, bandHi[BANDS] {}, fineLo[FINE] {}, fineHi[FINE] {};
    double fineSum[FINE] {}, midSum[BANDS] {}, sideSum[BANDS] {}, lSum[BANDS] {}, rSum[BANDS] {}, xSum[BANDS] {};
    std::vector<std::vector<int>> frames;
    std::vector<int> levels, kls, sides, corrs, fasts, peaks, nears;
    /** Two poles (RBJ's cookbook, and BS.1770's own), in doubles. */
    struct Pole2
    {
        double b0 = 1, b1 = 0, b2 = 0, a1 = 0, a2 = 0, z1 = 0, z2 = 0;
        void make (double sr, double f, bool high)                    // Butterworth: a high-pass at lo or a low-pass at hi makes the stretch
        {
            const double w = 2.0 * juce::MathConstants<double>::pi * juce::jlimit (1.0, sr * 0.45, f) / sr, c = std::cos (w), al = std::sin (w) / (2.0 * 0.7071067811865476), a0 = 1.0 + al;
            b0 = (high ? (1.0 + c) : (1.0 - c)) / 2.0 / a0; b1 = (high ? -(1.0 + c) : (1.0 - c)) / a0; b2 = b0; a1 = -2.0 * c / a0; a2 = (1.0 - al) / a0;
        }
        void kShelf (double sr)                                        // BS.1770's first stage, at any rate (as libebur128 works it out)
        {
            const double f0 = 1681.974450955533, G = 3.999843853973347, Q = 0.7071752369554196, K = std::tan (juce::MathConstants<double>::pi * f0 / sr);
            const double Vh = std::pow (10.0, G / 20.0), Vb = std::pow (Vh, 0.4996667741545416), a0 = 1.0 + K / Q + K * K;
            b0 = (Vh + Vb * K / Q + K * K) / a0; b1 = 2.0 * (K * K - Vh) / a0; b2 = (Vh - Vb * K / Q + K * K) / a0;
            a1 = 2.0 * (K * K - 1.0) / a0; a2 = (1.0 - K / Q + K * K) / a0;
        }
        void kHigh (double sr)                                         // … and its second, the high-pass
        {
            const double f0 = 38.13547087602444, Q = 0.5003270373238773, K = std::tan (juce::MathConstants<double>::pi * f0 / sr), a0 = 1.0 + K / Q + K * K;
            b0 = 1.0; b1 = -2.0; b2 = 1.0; a1 = 2.0 * (K * K - 1.0) / a0; a2 = (1.0 - K / Q + K * K) / a0;
        }
        double run (double x) { const double y = b0 * x + z1; z1 = b1 * x - a1 * y + z2; z2 = b2 * x - a2 * y; return y; }
    } hp, lp, kShelf, kHigh, kShelfR, kHighR;

    static int db (double p) { return (int) std::lround (juce::jlimit (-200.0, 20.0, 10.0 * std::log10 (p + 1e-20))); }      // (the floor far below anything heard: a quiet stretch must not seem to rise when the rest falls)
    static int tenths (double p) { return (int) std::lround (juce::jlimit (-2000.0, 200.0, 100.0 * std::log10 (p + 1e-20))); }

    void frame()
    {
        /* both sides in one transform (left the real part, right the imaginary), parted again bin by bin */
        for (int i = 0; i < N; ++i) { const size_t j = (size_t) ((at + i) % N); fft[(size_t) i] = { ringL[j] * win[(size_t) i], ringR[j] * win[(size_t) i] }; }      // (the last N samples, oldest first)
        transform();
        const double scale = 4.0 / ((double) N * (double) N);
        std::complex<float> Lk, Rk;
        auto parts = [this, &Lk, &Rk] (int k, double& pm, double& ps)  // the power of the sum (halved) and of the difference (halved) at bin k
        {
            const auto X = fft[(size_t) k], Y = std::conj (fft[(size_t) ((N - k) % N)]);
            Lk = 0.5f * (X + Y); Rk = std::complex<float> (0.0f, -0.5f) * (X - Y);
            pm = (double) std::norm (0.5f * (Lk + Rk)); ps = (double) std::norm (0.5f * (Lk - Rk));
        };
        std::vector<int> row (BANDS);
        for (int b = 0; b < BANDS; ++b)
        {
            double p = 0, q = 0, pm, ps;
            for (int k = bandLo[b]; k <= bandHi[b]; ++k)
            {
                parts (k, pm, ps); p += pm; q += ps;
                lSum[b] += (double) std::norm (Lk); rSum[b] += (double) std::norm (Rk); xSum[b] += (double) (Lk * std::conj (Rk)).real();
                if (segLen > 0) { seg.l[b] += (double) std::norm (Lk); seg.r[b] += (double) std::norm (Rk); seg.x[b] += (double) (Lk * std::conj (Rk)).real(); }
            }
            row[(size_t) b] = db (p * scale);
            midSum[b] += p * scale; sideSum[b] += q * scale;
            if (segLen > 0) { seg.mid[b] += p * scale; seg.side[b] += q * scale; }
        }
        for (int k = 0; k < FINE; ++k)
        {
            double p = 0, pm, ps;
            for (int j = fineLo[k]; j <= fineHi[k]; ++j) { parts (j, pm, ps); p += pm; }
            fineSum[k] += p * scale / (double) (fineHi[k] - fineLo[k] + 1);      // (per bin: a twelfth high up holds many, one low down a few)
            if (segLen > 0) seg.fine[k] += p * scale / (double) (fineHi[k] - fineLo[k] + 1);
        }
        frames.push_back (std::move (row));
        levels.push_back (db (sumLR / (2.0 * fill)));
        kls.push_back (tenths (sumK / fill));
        sides.push_back ((int) std::lround (100.0 * (sumM + sumS > 1e-14 ? sumS / (sumM + sumS) : 0.0)));      // (in hundredths)
        corrs.push_back ((int) std::lround (100.0 * (sumL > 1e-14 && sumR > 1e-14 ? sumX / std::sqrt (sumL * sumR) : 1.0)));
        allL += sumL; allR += sumR; count += fill;
        if (segLen > 0)
        {
            seg.allL += sumL; seg.allR += sumR; seg.count += fill; ++seg.frames;
            if ((double) pushed >= segLen * (double) (segs.size() + 1)) { segs.add (seg.read ((int) frames.size())); seg = Piece(); }      // (a piece ends at the frame that reaches its length)
        }
        sumLR = sumM = sumS = sumL = sumR = sumX = sumK = 0; fill = 0;
    }

    /** In place, radix 2: N is a power of two. */
    void transform()
    {
        auto& a = fft;
        for (int i = 1, j = 0; i < N; ++i)
        {
            int bit = N >> 1;
            for (; j & bit; bit >>= 1) j ^= bit;
            j ^= bit;
            if (i < j) std::swap (a[(size_t) i], a[(size_t) j]);
        }
        for (int len = 2; len <= N; len <<= 1)
        {
            const double ang = -2.0 * juce::MathConstants<double>::pi / (double) len;
            const std::complex<double> wl (std::cos (ang), std::sin (ang));      // (the turn kept in doubles: four thousand steps of it in floats would wander)
            for (int i = 0; i < N; i += len)
            {
                std::complex<double> w (1.0, 0.0);
                for (int k = 0; k < len / 2; ++k)
                {
                    const auto u = a[(size_t) (i + k)], v = a[(size_t) (i + k + len / 2)] * std::complex<float> ((float) w.real(), (float) w.imag());
                    a[(size_t) (i + k)] = u + v; a[(size_t) (i + k + len / 2)] = u - v;
                    w *= wl;
                }
            }
        }
    }
};
}
