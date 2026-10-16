#pragma once
/*  Where things begin in a sound, and what begins there. Plain C++ (no JUCE), so that it is tested by itself: test/hits.

    Two kinds of place are found, each with how sure it is (`score`: 1 is as sure as the clearest places in the same sound,
    above 1 surer still), so that how many are shown is chosen afterwards, by a sensitivity, without listening again:

    a hit — something struck: the sound grows louder all at once, in many of its pitches. Heard the way SuperFlux hears it
      (Böck & Widmer, 2013): the spectrum in bands a quarter tone wide, its level as the ear takes it (a logarithm), and
      how much each band has risen over the same band a moment before — the loudest of that band and its two neighbours,
      so that a voice's vibrato or a chord's beating is not taken for a rise. Bands far below the loudest of the moment
      are not listened to (a fret's squeak under a ringing chord). The rises that come close together — the strings of a
      strum, a flam — are one hit, placed where the sound, just after the strongest of them, first stands a tenth of the
      way up from the quiet before it: a pick's scrape before the strings is far below that, and is passed over. A soft
      stir just before a much louder hit is that hit's own beginning (the pick, a breath, the bow), not a hit of its own.
    a note — what sounds changes pitch without being struck (a slur, legato, a hammer-on, a voice moving to its next
      note): pitches that were not there a moment before — not even a quarter tone off — and that are then held, are
      much of what is heard. Not looked for close to a hit, which has begun a note anyway.

    The sound is looked at in steps of 5 ms through a window of about 46 ms; a hit is then placed to the sample.   */
#include <algorithm>
#include <cmath>
#include <complex>
#include <vector>

namespace slur
{
struct Hit
{
    double s = 0;       // where, in seconds from the beginning of the sound
    int kind = 0;       // 0: a hit, 1: a note (the pitch changed without a hit)
    float score = 0;    // how sure: 1 as sure as the clearest of this sound's own places of the kind
};

namespace transientsDetail
{
    /* a fast Fourier transform, in place, of a power of two */
    struct FFT
    {
        int n = 0;
        std::vector<int> rev;
        std::vector<std::complex<float>> tw;
        explicit FFT (int size) : n (size), rev ((size_t) size), tw ((size_t) size / 2)
        {
            int bits = 0;
            while ((1 << bits) < n) ++bits;
            for (int i = 0; i < n; ++i) { int r = 0; for (int b = 0; b < bits; ++b) if (i & (1 << b)) r |= 1 << (bits - 1 - b); rev[(size_t) i] = r; }
            for (int i = 0; i < n / 2; ++i) tw[(size_t) i] = std::polar (1.0f, (float) (-2.0 * M_PI * i / n));
        }
        void run (std::vector<std::complex<float>>& a) const
        {
            for (int i = 0; i < n; ++i) if (i < rev[(size_t) i]) std::swap (a[(size_t) i], a[(size_t) rev[(size_t) i]]);
            for (int len = 2; len <= n; len <<= 1)
            {
                const int half = len / 2, step = n / len;
                for (int i = 0; i < n; i += len)
                    for (int k = 0; k < half; ++k)
                    {
                        const auto u = a[(size_t) (i + k)], v = a[(size_t) (i + k + half)] * tw[(size_t) (k * step)];
                        a[(size_t) (i + k)] = u + v; a[(size_t) (i + k + half)] = u - v;
                    }
            }
        }
    };

    /* bands a quarter tone wide (24 an octave), from 30 Hz to 17 kHz, each a triangle over the bins of a spectrum of `n`
       points; a band that would fall on the same bins as the one before is left out (low down, where bins are wide) */
    struct Bands
    {
        struct Band { int lo = 0; std::vector<float> w; };
        std::vector<Band> b;
        Bands (int n, double sr)
        {
            const double top = std::min (17000.0, sr * 0.45), binHz = sr / n;
            std::vector<double> f;
            for (double x = 30.0; x <= top * 1.0001; x *= std::pow (2.0, 1.0 / 24.0)) f.push_back (x);
            std::vector<int> bins;
            for (auto x : f) { const int k = (int) std::lround (x / binHz); if (bins.empty() || k > bins.back()) bins.push_back (k); }
            for (size_t i = 1; i + 1 < bins.size(); ++i)
            {
                const int a = bins[i - 1], c = bins[i], e = bins[i + 1];
                Band band; band.lo = a;
                float sum = 0;
                for (int k = a; k <= e; ++k)
                {
                    const float w = k <= c ? (c == a ? 1.0f : (float) (k - a) / (float) (c - a)) : (float) (e - k) / (float) (e - c);
                    band.w.push_back (std::max (0.0f, w)); sum += std::max (0.0f, w);
                }
                if (sum <= 0) continue;
                for (auto& w : band.w) w /= sum;
                b.push_back (std::move (band));
            }
        }
    };

    inline float meanOf (const std::vector<float>& v, int a, int z)       // the mean of v[a..z], kept inside v
    {
        a = std::max (a, 0); z = std::min (z, (int) v.size() - 1);
        if (z < a) return 0;
        double s = 0; for (int i = a; i <= z; ++i) s += v[(size_t) i];
        return (float) (s / (z - a + 1));
    }
    inline float maxOf (const std::vector<float>& v, int a, int z)
    {
        a = std::max (a, 0); z = std::min (z, (int) v.size() - 1);
        float m = 0; for (int i = a; i <= z; ++i) m = std::max (m, v[(size_t) i]);
        return m;
    }
}

/** Where things begin in a sound of `chans` channels and `n` samples a channel, at `sr`: every place with a score of at
    least `least` (0.02 keeps nearly everything that could be wanted), in order. */
inline std::vector<Hit> transients (const float* const* ch, int chans, int n, double sr, float least = 0.02f)
{
    using namespace transientsDetail;
    std::vector<Hit> out;
    if (chans < 1 || n < (int) (sr * 0.05) || sr < 8000) return out;

    /* the sound as one channel, its loudest at 1 (so that a quiet take is heard as a loud one is) */
    std::vector<float> x ((size_t) n);
    float peak = 0;
    for (int i = 0; i < n; ++i) { float v = 0; for (int c = 0; c < chans; ++c) v += ch[c][i]; v /= (float) chans; x[(size_t) i] = v; peak = std::max (peak, std::abs (v)); }
    if (peak < 1.0e-5f) return out;
    for (auto& v : x) v /= peak;

    /* its level to the millisecond — what lies above 300 Hz, over 3 ms (a low string's slow swing is not a rise, and an
       attack is bright) */
    const int ms = std::max (1, (int) std::lround (sr / 1000.0)), msN = n / ms + 1;      // (a "millisecond" is `ms` samples: 44 at 44.1 kHz — a step is k * ms samples, never k / 1000 seconds)
    std::vector<float> env ((size_t) msN, 0.0f);
    {
        const float a = (float) std::exp (-2.0 * M_PI * 300.0 / sr);
        float px = 0, py = 0;
        std::vector<double> sq ((size_t) msN, 0.0);
        for (int i = 0; i < n; ++i) { const float y = a * (py + x[(size_t) i] - px); px = x[(size_t) i]; py = y; sq[(size_t) (i / ms)] += (double) y * y; }
        for (int k = 0; k < msN; ++k) { double s = 0; int c = 0; for (int q = k - 1; q <= k + 1; ++q) if (q >= 0 && q < msN) { s += sq[(size_t) q]; c += ms; } env[(size_t) k] = (float) std::sqrt (s / std::max (1, c)); }
    }

    /* the spectrum in steps of 5 ms, in quarter-tone bands */
    const int size = sr > 50000 ? 4096 : 2048, hop = std::max (1, (int) std::lround (sr / 200.0)), frames = n / hop + 1;
    const FFT fft (size);
    const Bands bands (size, sr);
    const int nb = (int) bands.b.size();
    std::vector<float> win ((size_t) size);
    for (int i = 0; i < size; ++i) win[(size_t) i] = (float) (0.5 - 0.5 * std::cos (2.0 * M_PI * i / size));
    std::vector<std::vector<float>> F ((size_t) frames, std::vector<float> ((size_t) nb, 0.0f));      // each band's level (its magnitude)
    {
        std::vector<std::complex<float>> buf ((size_t) size);
        std::vector<float> mag ((size_t) size / 2 + 1);
        for (int f = 0; f < frames; ++f)
        {
            const int c = f * hop;                                                    // (each step looks at the window round it)
            for (int i = 0; i < size; ++i) { const int k = c - size / 2 + i; buf[(size_t) i] = { k >= 0 && k < n ? x[(size_t) k] * win[(size_t) i] : 0.0f, 0.0f }; }
            fft.run (buf);
            for (int k = 0; k <= size / 2; ++k) mag[(size_t) k] = std::abs (buf[(size_t) k]);
            for (int b = 0; b < nb; ++b)
            {
                const auto& band = bands.b[(size_t) b];
                float s = 0; for (size_t j = 0; j < band.w.size(); ++j) s += band.w[j] * mag[(size_t) band.lo + j];
                F[(size_t) f][(size_t) b] = s;
            }
        }
    }
    const auto at = [&] (int f) { return (double) f * hop / sr; };
    const auto framesOf = [&] (double seconds) { return std::max (1, (int) std::lround (seconds * sr / hop)); };

    /* ── hits ── */
    std::vector<float> flux ((size_t) frames, 0.0f);
    std::vector<std::vector<float>> L ((size_t) frames, std::vector<float> ((size_t) nb));
    const int mu = framesOf (0.010);
    {
        for (int f = 0; f < frames; ++f) for (int b = 0; b < nb; ++b) L[(size_t) f][(size_t) b] = std::log10 (1.0f + F[(size_t) f][(size_t) b]);
        for (int f = mu; f < frames; ++f)
        {
            const auto& now = L[(size_t) f]; const auto& was = L[(size_t) (f - mu)];
            const float loud = *std::max_element (now.begin(), now.end()), gate = loud - 2.5f;      // (bands 50 dB below the loudest of the moment are not heard)
            float s = 0;
            for (int b = 0; b < nb; ++b)
            {
                if (now[(size_t) b] < gate) continue;
                const float before = std::max ({ was[(size_t) b], was[(size_t) std::max (0, b - 1)], was[(size_t) std::min (nb - 1, b + 1)] });
                s += std::max (0.0f, now[(size_t) b] - before);
            }
            flux[(size_t) f] = s;
        }
    }
    /* the peaks of the rise: the highest within 30 ms either side, and above what it has been doing round them */
    struct Peak { int f; float h; };
    std::vector<Peak> peaks;
    {
        const int near = framesOf (0.030), pre = framesOf (0.100), post = framesOf (0.070);
        for (int f = 1; f + 1 < frames; ++f)
        {
            const float v = flux[(size_t) f];
            if (v <= 0.05f || v < maxOf (flux, f - near, f + near)) continue;
            if (! peaks.empty() && f - peaks.back().f <= near) continue;               // (a plateau: its first frame)
            const float h = v - meanOf (flux, f - pre, f + post);
            if (h > 0) peaks.push_back ({ f, h });
        }
    }
    /* rises close together are one hit: its strength is the strongest of them, its place where the strongest begins */
    /* how loud, to the millisecond, only what a hit brought (the bands that rose with it): a short spectrum round each
       millisecond, read in those bands alone — a chord still ringing, beating as it dies, is in other bands, mostly */
    const int small = sr > 50000 ? 1024 : 512;
    const FFT fine (small);
    std::vector<float> fineWin ((size_t) small);
    for (int i = 0; i < small; ++i) fineWin[(size_t) i] = (float) (0.5 - 0.5 * std::cos (2.0 * M_PI * i / small));
    std::vector<int> bandBin ((size_t) nb);
    for (int b = 0; b < nb; ++b)
    {
        const auto& w = bands.b[(size_t) b].w;
        const int c = bands.b[(size_t) b].lo + (int) (std::max_element (w.begin(), w.end()) - w.begin());
        bandBin[(size_t) b] = std::min (small / 2, (int) std::lround ((double) c * small / size));
    }
    const auto newLevel = [&] (int f1, int from, int to)                               // (milliseconds from..to: the level of what rose at frame f1)
    {
        std::vector<char> take ((size_t) small / 2 + 1, 0);
        int any = 0;
        if (f1 >= mu)
            for (int b = 0; b < nb; ++b)
            {
                const float before = std::max ({ L[(size_t) (f1 - mu)][(size_t) b], L[(size_t) (f1 - mu)][(size_t) std::max (0, b - 1)], L[(size_t) (f1 - mu)][(size_t) std::min (nb - 1, b + 1)] });
                if (L[(size_t) f1][(size_t) b] - before > 0.15f && bandBin[(size_t) b] * sr / small > 150.0) { take[(size_t) bandBin[(size_t) b]] = 1; ++any; }
            }
        if (any < 2) for (int k = 0; k <= small / 2; ++k) take[(size_t) k] = k * sr / small > 300.0;
        std::vector<float> lv ((size_t) std::max (0, to - from + 1), 0.0f);
        std::vector<std::complex<float>> buf ((size_t) small);
        for (int q = from; q <= to; ++q)
        {
            const int c = q * ms;
            for (int i = 0; i < small; ++i) { const int k = c - small / 2 + i; buf[(size_t) i] = { k >= 0 && k < n ? x[(size_t) k] * fineWin[(size_t) i] : 0.0f, 0.0f }; }
            fine.run (buf);
            double e = 0; for (int k = 0; k <= small / 2; ++k) if (take[(size_t) k]) e += std::norm (buf[(size_t) k]);
            lv[(size_t) (q - from)] = (float) std::sqrt (e);
        }
        return lv;
    };
    struct Event { double s; float h; float level, rise; int f0, f1; };
    const float envTop = maxOf (env, 0, msN - 1);
    std::vector<Event> events;
    {
        const int chain = framesOf (0.045);
        int lastSteep = -1000;
        for (size_t i = 0; i < peaks.size();)
        {
            size_t j = i, best = i;
            while (j + 1 < peaks.size() && peaks[j + 1].f - peaks[j].f <= chain && peaks[j + 1].f - peaks[i].f <= framesOf (0.090)) { ++j; if (peaks[j].h > peaks[best].h) best = j; }
            Event e; e.h = peaks[best].h; e.f0 = peaks[i].f; e.f1 = peaks[best].f;
            /* placed by the level: from a little before (never before the hit ahead of it), the first millisecond that
               stands well up — 15 % of the way to how loud it is just after its steepest rise — from the quietest it has
               been since, and stays up. A chord dying away beneath is its own quietest all the way down, and never
               stands up; a pick's scrape before the strings, or a squeak, is far below; the strings of one strum, from
               the first, are all well up. */
            const int ks = (int) std::lround ((double) e.f1 * hop / ms), from = std::max (0, ks - 110), to = std::min (msN - 1, ks + 75);
            const auto lv = newLevel (e.f1, from, to);
            const auto L1 = [&] (int k) { return lv[(size_t) std::clamp (k - from, 0, (int) lv.size() - 1)]; };
            int steep = std::max (from + 2, ks - 30);
            for (int k = std::max (from + 2, ks - 30); k <= std::min (to - 2, ks + 30); ++k) if (L1 (k + 2) - L1 (k - 2) > L1 (steep + 2) - L1 (steep - 2)) steep = k;
            float top = 0; for (int k = steep; k <= std::min (to, steep + 40); ++k) top = std::max (top, L1 (k));
            const int lo = std::max ({ from, steep - 70, lastSteep + 15 });
            float low = top, lowAt = top;
            int k = -1;
            for (int q = lo; q <= steep; ++q)
            {
                low = std::min (low, L1 (q));
                const float part = top > 30.0f * low ? 0.06f : 0.15f;                    // (out of a near silence, the way up is followed from lower down: a swell begins where it is first heard)
                if (k < 0 && L1 (q) >= low + part * (top - low)) { k = q; lowAt = low; }
                else if (k >= 0 && L1 (q) < lowAt + 0.08f * (top - lowAt)) k = -1;          // (it fell back: that was not it)
            }
            if (k < 0) { k = steep; lowAt = low; }
            lastSteep = steep;
            /* struck, or only changed: how much louder all of it is (above 300 Hz) just after than just before */
            /* (by the mean over 25 ms either side, not the quietest and the loudest moment: a breath, a bow's hiss, a noisy
               sound wavers by that much all the time) */
            const float quiet = meanOf (env, k - 28, k - 4), loud = maxOf (env, k, k + 40), after = meanOf (env, k + 2, k + 26);
            /* the short spectrum round a millisecond hears a hit coming before it is there: its window, 12 ms wide, has
               taken in 15 % of it when its leading edge is a fifth of the way in — the middle is then 3 tenths of a
               window ahead of the hit. Half a millisecond ahead of the hit itself: a cut there keeps all of the attack. */
            e.s = std::max (0.0, (k * ms + 0.3 * small - 0.0005 * sr) / sr);
            e.level = loud; e.rise = after / std::max (quiet, envTop * 1.0e-4f);
            events.push_back (e);
            i = j + 1;
        }
    }
    /* a soft stir just before a much louder hit (15 dB or more, within 70 ms) is that hit's beginning; and a hit is never
       placed before the one ahead of it */
    {
        std::vector<Event> kept;
        for (size_t i = 0; i < events.size(); ++i)
        {
            bool stir = false;
            for (size_t j = i + 1; j < events.size() && events[j].s - events[i].s <= 0.070; ++j) if (events[j].level > events[i].level * 5.6f) stir = true;
            if (stir || events[i].level < envTop * 0.0056f) continue;                   // (or quieter than 45 dB below the loudest of the sound)
            if (events[i].rise < 1.18f) continue;                                        // (not 1.5 dB louder, on the whole, than just before: the sound changed, but nothing was struck — a note, if anything, below. A strum over a chord still ringing is 2 dB up and more; a slur is not up at all)
            if (! kept.empty() && events[i].s <= kept.back().s + 0.010) { if (events[i].h > kept.back().h) kept.back() = events[i]; continue; }
            kept.push_back (events[i]);
        }
        events.swap (kept);
    }
    if (! events.empty())
    {
        /* how sure, against the clearest hits of the same sound: the middle one of its strongest — as many as one for
           every four seconds of it — and never less than a quarter of the strongest of all. (Not against most of its
           hits: in a sound that rings, most of what rises is the ringing stirring, and a share of those would make
           every stir look sure.) */
        std::vector<float> hs; for (auto& e : events) hs.push_back (e.h);
        std::sort (hs.begin(), hs.end(), std::greater<float>());
        const size_t many = std::min (hs.size(), std::max<size_t> (4, (size_t) ((double) n / sr / 4.0)));
        const float ref = std::max (hs[many / 2], 0.25f * hs[0]);
        for (auto& e : events) { const float sc = e.h / std::max (ref, 1.0e-6f); if (sc >= least) out.push_back ({ e.s, 0, sc }); }
    }

    /* ── notes: pitches that were not there a moment before, and stay ── */
    {
        std::vector<std::vector<float>> E ((size_t) frames, std::vector<float> ((size_t) nb));
        std::vector<float> total ((size_t) frames, 0.0f);
        float loudest = 0;
        for (int f = 0; f < frames; ++f) for (int b = 0; b < nb; ++b) { const float p = F[(size_t) f][(size_t) b]; E[(size_t) f][(size_t) b] = p; total[(size_t) f] += p; }      // (by magnitude, not power: a low note's fundamental is not all that is heard)
        for (auto v : total) loudest = std::max (loudest, v);
        const int a0 = framesOf (0.060), a1 = framesOf (0.015), z1 = framesOf (0.060), z2 = framesOf (0.110);
        std::vector<float> was ((size_t) nb), now ((size_t) nb), then ((size_t) nb), nov ((size_t) frames, 0.0f);
        const auto spread = [&] (const std::vector<float>& v, int b) { return std::max ({ v[(size_t) b], v[(size_t) std::max (0, b - 1)], v[(size_t) std::min (nb - 1, b + 1)] }); };
        for (int f = a0; f + z2 < frames; ++f)
        {
            std::fill (was.begin(), was.end(), 0.0f); std::fill (now.begin(), now.end(), 0.0f); std::fill (then.begin(), then.end(), 0.0f);
            for (int g = f - a0; g <= f - a1; ++g) for (int b = 0; b < nb; ++b) was[(size_t) b] = std::max (was[(size_t) b], E[(size_t) g][(size_t) b]);
            for (int g = f + a1; g <= f + z1; ++g) for (int b = 0; b < nb; ++b) now[(size_t) b] += E[(size_t) g][(size_t) b] / (float) (z1 - a1 + 1);
            for (int g = f + z1; g <= f + z2; ++g) for (int b = 0; b < nb; ++b) then[(size_t) b] += E[(size_t) g][(size_t) b] / (float) (z2 - z1 + 1);
            float all = 0, fresh = 0, later = 0, after = 0;
            for (int b = 0; b < nb; ++b) { all += now[(size_t) b]; fresh += std::max (0.0f, now[(size_t) b] - 1.41f * spread (was, b)); after += then[(size_t) b]; later += std::max (0.0f, then[(size_t) b] - 1.41f * spread (now, b)); }
            if (all < loudest * 0.0056f || after < 0.5f * all) continue;                 // (too quiet, 45 dB down; or dying away)
            if (later > 0.35f * after) continue;                                        // (still moving: the middle of a slide)
            nov[(size_t) f] = fresh / all;
        }
        const int near = framesOf (0.050);
        std::vector<Hit> notes;
        for (int f = 1; f + 1 < frames; ++f)
        {
            const float v = nov[(size_t) f];
            if (v < 0.15f || v < maxOf (nov, f - near, f + near)) continue;
            if (! notes.empty() && at (f) - notes.back().s < 0.100) continue;
            bool struck = false;
            for (auto& h : out) if (std::abs (h.s - at (f)) < 0.060 && h.score >= 0.1f) struck = true;
            if (struck) continue;
            notes.push_back ({ at (f), 1, v });
        }
        for (auto& h : notes) if (h.score >= least) out.push_back (h);
    }
    std::sort (out.begin(), out.end(), [] (const Hit& a, const Hit& b) { return a.s < b.s; });
    return out;
}
}
