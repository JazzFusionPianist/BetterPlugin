#pragma once
/*  How a sound is stretched through a time map, other than by the phase vocoder (chords: Stretch.cpp, Signalsmith).
    Plain C++ (no JUCE), so that it is tested by itself: test/modes.

    The map is pins (s seconds of the source land at d seconds of what comes out), its ends taken as (0, 0) and
    (the source's length, the length asked for). The sound is cut into pieces at the pins and at `cuts` (where its hits
    are, as the page shows them) — each piece begins where the map puts its beginning:

    cut    each piece is played as it was, at its own speed: it stops where the next begins (a short fade), or ends early
           and leaves a silence behind it. Nothing is ever stretched — drums.
    beat   the same; but a piece that has room left over goes on: the last part of it is played again, crossfaded, until
           the next begins — rhythm guitars, keys.
    voice  the beginning of each piece (its attack, up to 15 ms) as it was; the rest stretched to fit by overlap-add of
           stretches of itself chosen to agree with what was just played (WSOLA), so that a single line keeps its pitch
           and its colour — a voice, a bass, a solo.

    Pieces join with a short crossfade. Returns false (and leaves `out` silent) when there is nothing to do.          */
#include <algorithm>
#include <cmath>
#include <vector>

namespace slur
{
enum class StretchMode { chords, voice, cut, beat };

struct Pin { double s = 0, d = 0; };

namespace modesDetail
{
    /* the map in samples, rising both ways: (in, out) */
    struct Map
    {
        std::vector<std::pair<double, double>> m;
        double outAt (double in) const               // where a place of the source lands
        {
            size_t i = 1;
            while (i + 1 < m.size() && m[i].first < in) ++i;
            const auto& a = m[i - 1]; const auto& b = m[i];
            return b.first - a.first > 1e-9 ? a.second + (in - a.first) * (b.second - a.second) / (b.first - a.first) : a.second;
        }
    };
    inline float hann (double t) { return (float) (0.5 - 0.5 * std::cos (2.0 * M_PI * t)); }    // t in 0…1
    inline float rise (double t) { t = std::clamp (t, 0.0, 1.0); return (float) std::sin (0.5 * M_PI * t); }      // an equal-power fade in
}

/** Render `src` (`ch` channels of `inN` samples at `sr`) into `out` (`ch` channels of `outN` samples, written over) by
    `mode` (voice, cut or beat), through `pins` (seconds) and cut at `cuts` (seconds of the source). */
inline bool renderMode (StretchMode mode, const float* const* src, int ch, int inN, double sr, std::vector<Pin> pins,
                        std::vector<double> cuts, float* const* out, int outN)
{
    using namespace modesDetail;
    for (int c = 0; c < ch; ++c) std::fill (out[c], out[c] + outN, 0.0f);
    if (ch < 1 || inN < 64 || outN < 64 || mode == StretchMode::chords) return false;

    /* the map, by where it comes from */
    Map map;
    map.m.push_back ({ 0.0, 0.0 });
    std::sort (pins.begin(), pins.end(), [] (const Pin& a, const Pin& b) { return a.s < b.s; });
    for (auto& p : pins)
    {
        const double s = p.s * sr, d = p.d * sr;
        if (s <= map.m.back().first + 8.0 || d <= map.m.back().second + 8.0 || s >= inN - 8.0 || d >= outN - 8.0) continue;
        map.m.push_back ({ s, d });
    }
    map.m.push_back ({ (double) inN, (double) outN });

    /* the pieces: from each pin and each cut to the next (a cut closer than 20 ms to another is one with it) */
    std::vector<double> at;
    for (auto& q : map.m) at.push_back (q.first);
    for (double c : cuts) { const double s = c * sr; if (s > 8.0 && s < inN - 8.0) at.push_back (s); }
    for (auto& s : at) s = std::round (s);                                              // (to the sample: a piece is read and laid down from the same one)
    std::sort (at.begin(), at.end());
    std::vector<double> edge;
    const double close = 0.020 * sr;
    for (double s : at)
    {
        if (edge.empty() || s - edge.back() > close) edge.push_back (s);
        else if (std::any_of (map.m.begin(), map.m.end(), [&] (const std::pair<double, double>& q) { return std::abs (q.first - s) < 0.5; })) edge.back() = s;      // (a pin wins over a cut beside it)
    }
    if (edge.back() < inN) edge.push_back ((double) inN);

    const int fadeOut = std::max (8, (int) (0.004 * sr)), join = std::max (8, (int) (0.002 * sr));
    /* one piece laid in at `o0`: `len` samples, faded in over its first `fin` and out over its last `fout` (sin² and cos²:
       where one piece fades out as the next fades in over the same samples, the two always add up to one) */
    auto lay = [&] (int o0, int len, int fin, int fout, auto&& from)
    {
        for (int k = 0; k < len; ++k)
        {
            const int o = o0 + k;
            if (o < 0 || o >= outN) continue;
            float g = 1.0f;
            if (k < fin) { const float r = rise ((k + 0.5) / fin); g *= r * r; }
            if (k >= len - fout) { const float r = rise ((len - k - 0.5) / fout); g *= r * r; }
            for (int c = 0; c < ch; ++c) out[c][o] += g * from (c, k);
        }
    };
    auto srcAt = [&] (int c, double i) -> float { const int k = (int) i; return k >= 0 && k < inN ? src[c][k] : 0.0f; };
    std::vector<float> mono;                                                              // (voice: all channels as one, to listen with)
    if (mode == StretchMode::voice) { mono.assign ((size_t) inN, 0.0f); for (int c = 0; c < ch; ++c) for (int k = 0; k < inN; ++k) mono[(size_t) k] += src[c][k]; }
    auto monoAt = [&] (double i) -> float { const int k = (int) i; return k >= 0 && k < inN ? mono[(size_t) k] : 0.0f; };

    for (size_t e = 0; e + 1 < edge.size(); ++e)
    {
        /* a piece is from its edge to the next, but it is read from `pre` before its edge and laid in as much before where
           its edge lands, so that its fade in is over before what it begins with (a hit) comes; it runs until the next
           piece's edge lands, fading out over the same samples as the next fades in */
        const int pre = e == 0 ? 0 : join;
        const double a = edge[e] - pre, b = edge[e + 1];
        const int o0 = (int) std::llround (map.outAt (edge[e])) - pre, o1 = (int) std::llround (map.outAt (b));
        const int ls = (int) std::llround (b - a), ld = o1 - o0;
        if (ld <= pre || ls <= pre) continue;
        const bool last = e + 2 >= edge.size();
        const int fin = pre;
        const bool same = std::abs (ld - ls) <= 2;
        if (mode == StretchMode::cut || (mode == StretchMode::beat && ld <= ls + 2) || (mode == StretchMode::voice && same))
        {
            if (ld > ls + 2) lay (o0, ls - (last ? 0 : join), fin, fadeOut, [&] (int c, int k) { return srcAt (c, a + k); });      // (ends early: a silence after it, until the next)
            else lay (o0, ld, fin, last ? (ld < ls ? fadeOut : 0) : join, [&] (int c, int k) { return srcAt (c, a + k); });
            continue;
        }
        const int len = ld;
        std::vector<std::vector<float>> buf ((size_t) ch, std::vector<float> ((size_t) len, 0.0f));
        if (mode == StretchMode::beat)
        {
            /* all of it, then its last part (a third of it, at most 60 ms) again and again, each time crossfaded into the
               one before, until the next piece begins */
            const int w = std::max (32, std::min (ls / 3, (int) (0.060 * sr))), x = std::max (8, std::min (w / 3, (int) (0.012 * sr)));
            for (int k = 0; k < std::min (ls, len); ++k) { const float r = k >= ls - x ? rise ((ls - k - 0.5) / x) : 1.0f; for (int c = 0; c < ch; ++c) buf[(size_t) c][(size_t) k] = srcAt (c, a + k) * r * r; }
            for (int p = ls - x; p < len; p += w - x)
                for (int k = 0; k < w && p + k < len; ++k)
                {
                    float g = 1.0f;
                    if (k < x) { const float r = rise ((k + 0.5) / x); g *= r * r; }
                    if (k >= w - x) { const float r = rise ((w - k - 0.5) / x); g *= r * r; }
                    for (int c = 0; c < ch; ++c) buf[(size_t) c][(size_t) (p + k)] += g * srcAt (c, b - w + k);
                }
        }
        else
        {
            /* voice: the attack as it was, the rest by WSOLA to the room it has: stretches of N samples laid every N/2,
               each taken from about where the map says, moved by up to 10 ms to where it agrees best with what the stretch
               before it would have gone on to play */
            const int keep = std::max (0, std::min ({ (int) (0.015 * sr), ls / 3, ld / 2 }));
            for (int k = 0; k < keep; ++k) for (int c = 0; c < ch; ++c) buf[(size_t) c][(size_t) k] = srcAt (c, a + k);
            const int restIn = ls - keep, restOut = len - keep;
            if (restIn > 16 && restOut > 16)
            {
                const int N = std::max (64, (int) (0.040 * sr)) & ~1, H = N / 2, D = std::max (8, (int) (0.010 * sr));
                const double ratio = (double) restIn / (double) std::max (1, ld - keep), base = a + keep;
                std::vector<double> sum ((size_t) restOut, 0.0);
                std::vector<std::vector<double>> acc ((size_t) ch, std::vector<double> ((size_t) restOut, 0.0));
                const auto agree = [&] (double want, double cand, int step)
                {
                    double cc = 0, e1 = 1e-9, e2 = 1e-9;
                    for (int k = 0; k < H; k += step) { const double p = monoAt (want + k), q = monoAt (cand + k); cc += p * q; e1 += p * p; e2 += q * q; }
                    return cc / std::sqrt (e1 * e2);
                };
                double prev = base - H;                                                     // (the stretch before the first: what led up to it)
                for (int o = -H; o < restOut; o += H)
                {
                    double best = base - H;
                    if (o >= 0)
                    {
                        const double ideal = base + o * ratio, want = prev + H;
                        double bestC = -2.0;
                        for (int dd = -D; dd <= D; dd += 4) { const double sc = agree (want, ideal + dd, 4); if (sc > bestC) { bestC = sc; best = ideal + dd; } }
                        const double rough = best;                                          // (and then to the sample)
                        bestC = -2.0;
                        for (int dd = -3; dd <= 3; ++dd) { const double sc = agree (want, rough + dd, 1); if (sc > bestC) { bestC = sc; best = rough + dd; } }
                    }
                    for (int k = 0; k < N; ++k)
                    {
                        const int to = o + k;
                        if (to < 0 || to >= restOut) continue;
                        const double w = hann ((k + 0.5) / N);
                        sum[(size_t) to] += w;
                        for (int c = 0; c < ch; ++c) acc[(size_t) c][(size_t) to] += w * srcAt (c, best + k);
                    }
                    prev = best;
                }
                for (int k = 0; k < restOut; ++k)
                {
                    const double s = sum[(size_t) k] > 1e-6 ? sum[(size_t) k] : 1.0;
                    for (int c = 0; c < ch; ++c) buf[(size_t) c][(size_t) (keep + k)] = (float) (acc[(size_t) c][(size_t) k] / s);
                }
            }
            else for (int k = keep; k < std::min (ls, len); ++k) for (int c = 0; c < ch; ++c) buf[(size_t) c][(size_t) k] = srcAt (c, a + k);
        }
        lay (o0, len, fin, last ? 0 : join, [&] (int c, int k) { return buf[(size_t) c][(size_t) k]; });
    }
    return true;
}
}
