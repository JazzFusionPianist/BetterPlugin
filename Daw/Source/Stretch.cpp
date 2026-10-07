#include "Stretch.h"
#include "signalsmith-stretch.h"
#include <algorithm>
#include <cmath>

namespace daw
{
namespace
{
/** The source as the stretcher reads it: from `base` on, silent outside itself, or going round when it is a loop. */
struct In
{
    const juce::AudioBuffer<float>& b;
    juce::int64 base;
    bool loop, reverse;
    struct Ch
    {
        const float* p; int n; juce::int64 base; bool loop, reverse;
        float operator[] (int i) const
        {
            juce::int64 k = base + i;
            if (loop) { k %= n; if (k < 0) k += n; }
            else if (k < 0 || k >= n) return 0.0f;
            return p[reverse ? n - 1 - k : k];
        }
    };
    Ch operator[] (int c) const { return { b.getReadPointer (c), b.getNumSamples(), base, loop, reverse }; }
};
struct Out
{
    float* const* p; int base;
    float* operator[] (int c) const { return p[c] + base; }
};
}

juce::AudioBuffer<float> warp (const juce::AudioBuffer<float>& src, double sr, double semis,
                               std::vector<WarpPoint> map, double outSec, bool loop, bool reverse,
                               const std::atomic<bool>* cancel)
{
    const int ch = src.getNumChannels(), inN = src.getNumSamples();
    const int outN = (int) std::llround (outSec * sr);
    juce::AudioBuffer<float> out;
    if (ch < 1 || inN < 64 || outN < 64) return out;
    out.setSize (ch, outN);
    out.clear();

    // the map in samples, by where it lands: strictly rising both ways, pinned at both ends
    std::vector<std::pair<double, double>> m;        // (out, in)
    m.push_back ({ 0.0, 0.0 });
    std::sort (map.begin(), map.end(), [] (const WarpPoint& a, const WarpPoint& b) { return a.d < b.d; });
    for (auto& w : map)
    {
        const double d = w.d * sr, s = w.s * sr;
        if (d <= m.back().first + 8.0 || s <= m.back().second + 8.0) continue;
        if (d >= (double) outN - 8.0 || s >= (double) inN - 8.0) continue;
        m.push_back ({ d, s });
    }
    m.push_back ({ (double) outN, (double) inN });
    auto srcAt = [&] (double o) -> double
    {
        if (loop)
        {
            const double k = std::floor (o / (double) outN), f = o - k * (double) outN;
            size_t i = 1;
            while (i + 1 < m.size() && m[i].first < f) ++i;
            const auto& a = m[i - 1]; const auto& b = m[i];
            return k * (double) inN + a.second + (f - a.first) * (b.second - a.second) / (b.first - a.first);
        }
        size_t i = 1;
        while (i + 1 < m.size() && m[i].first < o) ++i;
        const auto& a = m[i - 1]; const auto& b = m[i];
        return a.second + (o - a.first) * (b.second - a.second) / (b.first - a.first);      // runs on past either end at the slope it has there
    };

    signalsmith::stretch::SignalsmithStretch<float> st;
    st.presetDefault (ch, (float) sr);
    st.setTransposeSemitones ((float) semis, 8000.0f / (float) sr);
    const int inLat = st.inputLatency(), outLat = st.outputLatency();
    // when `o` samples have come out, this much of the source has to have gone in
    auto fed = [&] (double o) { return (juce::int64) std::llround (srcAt (o + (double) outLat)) + (juce::int64) inLat; };

    const int chunk = 128;
    juce::AudioBuffer<float> scratch (ch, chunk);
    const int pre = loop ? juce::jmin (outN, (int) (sr * 1.5)) : 0;      // a loop is run in before it is kept, so its first note already has its last behind it
    juce::int64 cursor;
    if (loop)
    {
        st.reset();
        cursor = fed ((double) -pre);
        const int len = st.seekLength();
        In in { src, cursor - len, true, reverse };
        st.seek (in, len, (m[1].second - m[0].second) / (m[1].first - m[0].first));
    }
    else
    {
        const double rate0 = (m[1].second - m[0].second) / (m[1].first - m[0].first);
        const int len = st.outputSeekLength ((float) rate0);
        In in { src, 0, false, reverse };
        st.outputSeek (in, len);
        cursor = len;
    }
    for (int o = -pre; o < outN;)
    {
        if (cancel != nullptr && cancel->load()) return {};
        const int n = juce::jmin (chunk, (o < 0 ? 0 : outN) - o);
        const juce::int64 next = juce::jmax (cursor, fed ((double) (o + n)));
        In in { src, cursor, loop, reverse };
        if (o < 0) { Out to { scratch.getArrayOfWritePointers(), 0 }; st.process (in, (int) (next - cursor), to, n); }
        else       { Out to { out.getArrayOfWritePointers(), o };     st.process (in, (int) (next - cursor), to, n); }
        cursor = next;
        o += n;
    }
    return out;
}

/*  Onsets: the level of the file in short steps, in two bands (all of it,
    and its bright part), and the places where the level jumps well above
    what it has just been doing.                                          */
std::vector<double> onsets (const juce::AudioBuffer<float>& src, double sr)
{
    std::vector<double> found;
    const int n = src.getNumSamples(), ch = src.getNumChannels();
    const int hop = juce::jmax (32, (int) (sr * 0.004)), frames = n / hop;
    if (frames < 8 || ch < 1) return found;
    std::vector<float> lo ((size_t) frames, 0.0f), hi ((size_t) frames, 0.0f);
    float prev = 0.0f;
    for (int f = 0; f < frames; ++f)
    {
        double a = 0.0, b = 0.0;
        for (int i = f * hop; i < (f + 1) * hop; ++i)
        {
            float v = 0.0f;
            for (int c = 0; c < ch; ++c) v += src.getSample (c, i);
            v /= (float) ch;
            const float d = v - prev; prev = v;
            a += (double) v * v; b += (double) d * d;
        }
        lo[(size_t) f] = (float) std::sqrt (a / hop); hi[(size_t) f] = (float) std::sqrt (b / hop);
    }
    float top = 0.0f;
    for (auto v : lo) top = juce::jmax (top, v);
    if (top < 1.0e-4f) return found;
    const float floorLo = top * 0.003f, floorHi = floorLo * 0.25f;
    // how much louder a step is than the two before it, in both bands
    std::vector<float> odf ((size_t) frames, 0.0f);
    for (int f = 2; f < frames; ++f)
    {
        const float pl = juce::jmax (lo[(size_t) f - 1], lo[(size_t) f - 2]) + floorLo, ph = juce::jmax (hi[(size_t) f - 1], hi[(size_t) f - 2]) + floorHi;
        const float a = std::log ((lo[(size_t) f] + floorLo) / pl), b = std::log ((hi[(size_t) f] + floorHi) / ph);
        odf[(size_t) f] = juce::jmax (0.0f, a) + 0.7f * juce::jmax (0.0f, b);
    }
    const int near = juce::jmax (2, (int) (0.030 * sr / hop)), wide = juce::jmax (8, (int) (0.40 * sr / hop)), gap = juce::jmax (3, (int) (0.070 * sr / hop));
    int last = -gap;
    std::vector<float> win;
    for (int f = 2; f < frames - 1; ++f)
    {
        const float v = odf[(size_t) f];
        if (v < 0.35f) continue;
        bool peak = true;
        for (int k = juce::jmax (0, f - near); k <= juce::jmin (frames - 1, f + near) && peak; ++k) if (odf[(size_t) k] > v) peak = false;
        if (! peak || f - last < gap) continue;
        win.assign (odf.begin() + juce::jmax (0, f - wide), odf.begin() + juce::jmin (frames, f + wide));
        std::nth_element (win.begin(), win.begin() + (long) (win.size() / 2), win.end());
        const float med = win[win.size() / 2];
        if (v < med * 2.5f + 0.25f) continue;
        if (lo[(size_t) juce::jmin (frames - 1, f + 1)] < top * 0.02f && lo[(size_t) f] < top * 0.02f) continue;    // too quiet to be worth a line
        // walk back to where the rise starts
        int g = f;
        while (g > 1 && g > f - near && odf[(size_t) g - 1] > 0.12f) --g;
        found.push_back (juce::jmax (0.0, ((double) g * hop - hop * 0.5) / sr));
        last = f;
        if (found.size() >= 4000) break;
    }
    return found;
}
/*  Tempo: how much louder each short step is than the ones just before it (the same two bands as for onsets),
    set against itself a while later. Where that agrees best — at one lag and at twice, three and four times
    it — is one beat. Between a speed and its half or its double the sound alone cannot always tell: the one
    nearer to what most songs do (about 110) is taken. The beat is then measured again over longer and longer
    runs of beats, as long as the sound still agrees with itself that far apart, which gives it to a few
    hundredths of a beat a minute.                                                                              */
Tempo tempoOf (const juce::AudioBuffer<float>& src, double sr)
{
    Tempo out;
    const int ch = src.getNumChannels();
    const int hop = juce::jmax (16, (int) std::lround (sr * 0.005));
    const int n = juce::jmin (src.getNumSamples(), (int) (sr * 360.0)), frames = n / hop;
    const double fps = sr / hop;
    if (ch < 1 || frames < (int) (fps * 2.0)) return out;
    std::vector<float> lo ((size_t) frames), hi ((size_t) frames), odf ((size_t) frames, 0.0f);
    float top = 0.0f;
    {
        // the level of each step is taken over three steps (fifteen thousandths of a second), so that a steady low note —
        // whose own wave is about as long as a step — does not look like something happening again and again
        std::vector<double> ea ((size_t) frames), eb ((size_t) frames);
        float prev = 0.0f;
        for (int f = 0; f < frames; ++f)
        {
            double a = 0.0, b = 0.0;
            for (int i = f * hop; i < (f + 1) * hop; ++i)
            {
                float v = 0.0f;
                for (int c = 0; c < ch; ++c) v += src.getSample (c, i);
                v /= (float) ch;
                const float d = v - prev; prev = v;
                a += (double) v * v; b += (double) d * d;
            }
            ea[(size_t) f] = a; eb[(size_t) f] = b;
        }
        for (int f = 0; f < frames; ++f)
        {
            const int f0 = juce::jmax (0, f - 2), count = f - f0 + 1;
            double a = 0.0, b = 0.0;
            for (int k = f0; k <= f; ++k) { a += ea[(size_t) k]; b += eb[(size_t) k]; }
            lo[(size_t) f] = (float) std::sqrt (a / (count * hop)); hi[(size_t) f] = (float) std::sqrt (b / (count * hop));
            top = juce::jmax (top, lo[(size_t) f]);
        }
    }
    if (top < 1.0e-4f) return out;
    const float floorLo = top * 0.003f, floorHi = floorLo * 0.25f;
    int rises = 0;                                                    // how many times something clearly begins
    for (int f = 4; f < frames; ++f)
    {
        const float pl = juce::jmax (lo[(size_t) f - 3], lo[(size_t) f - 4]) + floorLo, ph = juce::jmax (hi[(size_t) f - 3], hi[(size_t) f - 4]) + floorHi;
        const float v = juce::jmax (0.0f, std::log ((lo[(size_t) f] + floorLo) / pl)) + 0.7f * juce::jmax (0.0f, std::log ((hi[(size_t) f] + floorHi) / ph));
        odf[(size_t) f] = v > 0.2f ? v : 0.0f;                         // (a level that only wavers is nothing beginning)
        if (v > 0.35f && odf[(size_t) f - 1] <= 0.35f) ++rises;
    }
    if (rises < 8) return out;                                         // too little happens in it to speak of a beat
    // what stands out of its surroundings (a quarter of a second to each side)
    {
        const int w = juce::jmax (4, (int) (fps * 0.25));
        std::vector<float> mean ((size_t) frames, 0.0f);
        double run = 0.0; int count = 0;
        for (int f = 0; f < juce::jmin (frames, w); ++f) { run += odf[(size_t) f]; ++count; }
        for (int f = 0; f < frames; ++f)
        {
            if (f + w < frames) { run += odf[(size_t) (f + w)]; ++count; }
            if (f - w - 1 >= 0) { run -= odf[(size_t) (f - w - 1)]; --count; }
            mean[(size_t) f] = (float) (run / juce::jmax (1, count));
        }
        for (int f = 0; f < frames; ++f) odf[(size_t) f] = juce::jmax (0.0f, odf[(size_t) f] - mean[(size_t) f]);
    }
    double r0 = 0.0;
    for (int f = 0; f < frames; ++f) r0 += (double) odf[(size_t) f] * odf[(size_t) f];
    if (r0 < 1.0e-9) return out;
    r0 /= frames;
    auto at = [&] (int lag) -> double                                   // how well the sound agrees with itself `lag` steps later (1 = wholly)
    {
        if (lag < 1 || lag >= frames - 8) return 0.0;
        double s = 0.0;
        const float* p = odf.data();
        for (int i = 0; i + lag < frames; ++i) s += (double) p[i] * p[i + lag];
        return s / (frames - lag) / r0;
    };
    const double minBpm = 50.0, maxBpm = 220.0;
    const int maxLag = juce::jmin (frames - 9, (int) std::ceil (fps * 60.0 / minBpm * 4.0) + 2);
    if (maxLag < (int) (fps * 60.0 / maxBpm) + 2) return out;
    std::vector<double> ac ((size_t) maxLag + 2, 0.0);
    for (int L = 1; L <= maxLag; ++L) ac[(size_t) L] = at (L);
    auto acAt = [&] (double lag) -> double { if (lag < 1.0 || lag >= maxLag) return 0.0; const int i = (int) lag; const double fr = lag - i; return ac[(size_t) i] * (1.0 - fr) + ac[(size_t) i + 1] * fr; };
    double best = 0.0, bestScore = -1.0, bestRaw = 0.0;
    for (double bpm = minBpm; bpm <= maxBpm + 1.0e-9; bpm += 0.1)
    {
        const double T = fps * 60.0 / bpm;
        double s = 0.0; int k = 0;
        for (int m = 1; m <= 4; ++m) if (T * m < maxLag) { s += acAt (T * m); ++k; }
        if (k == 0) continue;
        s /= k;
        const double oct = std::log2 (bpm / 110.0), score = s * std::exp (-0.5 * oct * oct / (0.8 * 0.8));
        if (score > bestScore) { bestScore = score; best = bpm; bestRaw = s; }
    }
    if (best <= 0.0 || bestRaw < 0.02) return out;
    // measured again over longer runs of beats
    double T = fps * 60.0 / best;
    const double base = juce::jmax (1.0e-6, acAt (T));
    for (int k = 2; k <= 64; k *= 2)
    {
        const double centre = T * k;
        if (centre + 4.0 >= frames * 0.6) break;                       // (too few beats left to compare that far apart)
        const int from = (int) std::floor (centre) - 3, to = from + 7;
        double pv = -1.0; int pl = 0;
        for (int L = from; L <= to; ++L) { const double v = at (L); if (v > pv) { pv = v; pl = L; } }
        if (pv < base * 0.35 || pl <= from || pl >= to) break;        // it no longer agrees with itself this far apart (the speed drifts), or the best is off the edge
        const double ya = at (pl - 1), yb = pv, yc = at (pl + 1), den = ya - 2.0 * yb + yc;
        const double fine = pl + (std::abs (den) > 1.0e-12 ? 0.5 * (ya - yc) / den : 0.0);
        if (std::abs (fine / k - T) > T * 0.02) break;
        T = fine / k;
    }
    out.bpm = fps * 60.0 / T;
    out.sure = juce::jlimit (0.0, 1.0, bestRaw);
    // where the first beat falls: the offset at which a beat-wide comb gathers the most
    {
        const int steps = juce::jmax (1, (int) std::floor (T));
        double pb = -1.0; int ps = 0;
        for (int p = 0; p < steps; ++p)
        {
            double s = 0.0;
            for (double x = p; x < frames - 1; x += T) { const int i = (int) x; s += odf[(size_t) i] + 0.5f * odf[(size_t) juce::jmin (frames - 1, i + 1)]; }
            if (s > pb) { pb = s; ps = p; }
        }
        out.first = ps * hop / sr;
    }
    // a loop cut to length: the whole file is a whole number of bars at very nearly this speed
    {
        const double sec = src.getNumSamples() / sr, beats = sec * out.bpm / 60.0, whole = std::round (beats / 4.0) * 4.0;
        const int bars = (int) std::lround (whole / 4.0);
        if (sec < 180.0 && bars >= 1 && (bars & (bars - 1)) == 0 && std::abs (beats - whole) < 0.06) out.loop = whole * 60.0 / sec;      // one, two, four, eight … bars, to within a sixteenth of a beat: cut by hand to the bar
    }
    return out;
}
/*  Where there is sound: the loudest sample of each thousandth of a second, on any channel, against the floor.  */
std::vector<std::pair<double, double>> soundParts (const juce::AudioBuffer<float>& src, double sr, double floorDb, double gap, double pre, double post)
{
    std::vector<std::pair<double, double>> out;
    const int n = src.getNumSamples(), ch = src.getNumChannels();
    const int hop = juce::jmax (8, (int) std::lround (sr * 0.001)), frames = (n + hop - 1) / hop;
    if (n < 1 || ch < 1) return out;
    const float floor = (float) std::pow (10.0, floorDb / 20.0);
    std::vector<char> on ((size_t) frames, 0);
    for (int f = 0; f < frames; ++f)
    {
        float m = 0.0f;
        const int i0 = f * hop, i1 = juce::jmin (n, i0 + hop);
        for (int c = 0; c < ch; ++c) { const float* p = src.getReadPointer (c); for (int i = i0; i < i1; ++i) m = juce::jmax (m, std::abs (p[i])); }
        on[(size_t) f] = m >= floor ? 1 : 0;
    }
    const int minGap = juce::jmax (1, (int) std::lround (gap * sr / hop));
    const double len = n / sr;
    int f = 0;
    while (f < frames)
    {
        while (f < frames && ! on[(size_t) f]) ++f;
        if (f >= frames) break;
        const int from = f;
        int last = f;                                                  // the last step with sound in this stretch
        while (f < frames)
        {
            if (on[(size_t) f]) { last = f; ++f; continue; }
            int g = f;
            while (g < frames && ! on[(size_t) g]) ++g;
            if (g >= frames || g - f >= minGap) break;                 // a real silence (or the end): the stretch is over
            f = g;
        }
        const double a = juce::jmax (0.0, from * hop / sr - pre), b = juce::jmin (len, (last + 1) * hop / sr + post);
        if (! out.empty() && a <= out.back().second + 1.0e-9) out.back().second = juce::jmax (out.back().second, b);
        else out.emplace_back (a, b);
        f = juce::jmax (f, last + 1);
    }
    return out;
}
}
