// The app's ear for where things begin (Source/Transients.h), by itself: sounds made here, each with where its hits and its
// notes truly are, are listened to by it and by the ear it took the place of (the old one, copied below as it was), and
// each is scored: how many of the true places were found (within 20 ms for a hit, 50 ms for a note), how many places
// were found that are not there, and how far from the truth a hit was placed. Files given on the command line are
// listened to as well, and what was found in them is said (they have no truth to be held to).
//   ./test/hits/run.sh                 the made sounds; fails if the new ear does worse than it must
//   ./test/hits/run.sh some.wav …      and what it finds in these
#include "../../Source/Transients.h"
#include <cstdio>
#include <cstdint>
#include <cstring>
#include <random>
#include <string>

using namespace slur;
static const double SR = 44100.0;

/* ── the old ear, as it was in Source/Stretch.cpp (onsets), over plain arrays ── */
static std::vector<double> oldOnsets (const std::vector<float>& x, double sr)
{
    std::vector<double> found;
    const int n = (int) x.size(), hop = std::max (32, (int) (sr * 0.004)), frames = n / hop;
    if (frames < 8) return found;
    std::vector<float> lo ((size_t) frames, 0.0f), hi ((size_t) frames, 0.0f);
    float prev = 0.0f;
    for (int f = 0; f < frames; ++f)
    {
        double a = 0.0, b = 0.0;
        for (int i = f * hop; i < (f + 1) * hop; ++i) { const float v = x[(size_t) i], d = v - prev; prev = v; a += (double) v * v; b += (double) d * d; }
        lo[(size_t) f] = (float) std::sqrt (a / hop); hi[(size_t) f] = (float) std::sqrt (b / hop);
    }
    float top = 0.0f;
    for (auto v : lo) top = std::max (top, v);
    if (top < 1.0e-4f) return found;
    const float floorLo = top * 0.003f, floorHi = floorLo * 0.25f;
    std::vector<float> odf ((size_t) frames, 0.0f);
    for (int f = 2; f < frames; ++f)
    {
        const float pl = std::max (lo[(size_t) f - 1], lo[(size_t) f - 2]) + floorLo, ph = std::max (hi[(size_t) f - 1], hi[(size_t) f - 2]) + floorHi;
        const float a = std::log ((lo[(size_t) f] + floorLo) / pl), b = std::log ((hi[(size_t) f] + floorHi) / ph);
        odf[(size_t) f] = std::max (0.0f, a) + 0.7f * std::max (0.0f, b);
    }
    const int near = std::max (2, (int) (0.030 * sr / hop)), wide = std::max (8, (int) (0.40 * sr / hop)), gap = std::max (3, (int) (0.070 * sr / hop));
    int last = -gap;
    std::vector<float> win;
    for (int f = 2; f < frames - 1; ++f)
    {
        const float v = odf[(size_t) f];
        if (v < 0.35f) continue;
        bool peak = true;
        for (int k = std::max (0, f - near); k <= std::min (frames - 1, f + near) && peak; ++k) if (odf[(size_t) k] > v) peak = false;
        if (! peak || f - last < gap) continue;
        win.assign (odf.begin() + std::max (0, f - wide), odf.begin() + std::min (frames, f + wide));
        std::nth_element (win.begin(), win.begin() + (long) (win.size() / 2), win.end());
        const float med = win[win.size() / 2];
        if (v < med * 2.5f + 0.25f) continue;
        if (lo[(size_t) std::min (frames - 1, f + 1)] < top * 0.02f && lo[(size_t) f] < top * 0.02f) continue;
        int g = f;
        while (g > 1 && g > f - near && odf[(size_t) g - 1] > 0.12f) --g;
        found.push_back (std::max (0.0, ((double) g * hop - hop * 0.5) / sr));
        last = f;
    }
    return found;
}

/* ── sounds, and where things truly begin in them ── */
struct Truth { double s; int kind; bool optional = false; };      // optional: found or not, it is not held against either ear
struct Case { std::string name; std::vector<float> x; std::vector<Truth> truth; double slack = 0.006; };      // slack: how far from the truth a hit may be placed, on the whole

static std::mt19937 rng (7);
static float noise() { return std::uniform_real_distribution<float> (-1.0f, 1.0f) (rng); }
static void add (std::vector<float>& x, size_t at, const std::vector<float>& y, float g = 1.0f) { for (size_t i = 0; i < y.size() && at + i < x.size(); ++i) x[at + i] += g * y[i]; }
static size_t S (double s) { return (size_t) std::llround (s * SR); }

/* a plucked string (Karplus–Strong): `f` Hz, for `len` seconds, its brightness at the pluck */
static std::vector<float> pluck (double f, double len, float bright = 0.7f, float decay = 0.996f)
{
    std::vector<float> y (S (len), 0.0f);
    const int p = std::max (2, (int) std::lround (SR / f));
    std::vector<float> line ((size_t) p);
    float lp = 0;
    for (auto& v : line) { lp = bright * noise() + (1 - bright) * lp; v = lp; }
    for (size_t i = 0; i < y.size(); ++i)
    {
        const size_t k = i % (size_t) p, k1 = (i + 1) % (size_t) p;
        const float out = line[k];
        line[k] = decay * 0.5f * (line[k] + line[k1]);
        y[i] = out;
    }
    return y;
}
/* noise through a simple band (a pick's scrape, a squeak), `len` seconds with a soft shape */
static std::vector<float> scrape (double len, double lo, double hi)
{
    std::vector<float> y (S (len));
    const float a = (float) std::exp (-2 * M_PI * lo / SR), b = (float) std::exp (-2 * M_PI * hi / SR);
    float h = 0, px = 0, l = 0;
    for (size_t i = 0; i < y.size(); ++i)
    {
        const float v = noise(); h = a * (h + v - px); px = v; l = b * l + (1 - b) * h;
        const double t = (double) i / (double) y.size();
        y[i] = l * (float) std::sin (M_PI * t);
    }
    return y;
}
static void level (std::vector<float>& x, float peakTo)
{
    float p = 0; for (auto v : x) p = std::max (p, std::abs (v));
    if (p > 0) for (auto& v : x) v *= peakTo / p;
}
static void hiss (std::vector<float>& x, float g) { for (auto& v : x) v += g * noise(); }

/* strummed guitar: down and up strokes, each with a pick's scrape before it, a chord left to ring for four seconds (two
   of its strings a little out of tune with each other, so that it beats), a fret's squeak in the middle of it */
static Case guitar()
{
    Case c { "guitar, strummed", std::vector<float> (S (14.0), 0.0f), {} };
    const std::vector<std::vector<double>> chords = { { 98, 123.5, 146.8, 196, 246.9, 392 }, { 130.8, 164.8, 196, 261.6, 329.6 }, { 146.8, 220, 293.7, 370 }, { 82.4, 123.5, 164.8, 196, 246.9, 329.6 } };
    double t = 0.5;
    const double beat = 60.0 / 90.0;
    for (int bar = 0; bar < 3; ++bar)
        for (int i = 0; i < 8; ++i)
        {
            const bool down = i % 2 == 0;
            if (! down && i % 4 == 1) { t += beat / 2; continue; }                      // (a rhythm: not every upstroke is played)
            const auto& ch = chords[(size_t) (bar + (i >= 4 ? 1 : 0)) % chords.size()];
            const double spread = down ? 0.009 : 0.006, gap = 0.025 + 0.045 * std::uniform_real_distribution<double> (0, 1) (rng);
            const float g = down ? 1.0f : 0.6f;
            add (c.x, S (t - gap), scrape (gap + 0.004, 1500, 7000), 0.03f * g);      // (the pick on the strings before they sound: about 30 dB down)
            for (size_t s = 0; s < ch.size(); ++s)
            {
                const size_t j = down ? s : ch.size() - 1 - s;
                add (c.x, S (t + spread * (double) s), pluck (ch[j], beat * 1.2, 0.75f, 0.9965f), g * 0.35f);
            }
            c.truth.push_back ({ t, 0 });
            t += beat / 2;
        }
    /* the long chord */
    t += 0.3;
    add (c.x, S (t - 0.04), scrape (0.044, 1500, 7000), 0.03f);
    const std::vector<double> ring = { 82.4, 123.5, 164.8, 196, 196.7, 329.6 };
    for (size_t s = 0; s < ring.size(); ++s) add (c.x, S (t + 0.010 * (double) s), pluck (ring[s], 4.2, 0.75f, 0.9995f), 0.35f);
    c.truth.push_back ({ t, 0 });
    add (c.x, S (t + 1.7), scrape (0.03, 2000, 9000), 0.01f);                         // (a squeak of the fretting hand: not a hit)
    level (c.x, 0.8f); hiss (c.x, 0.0003f);
    return c;
}
/* drums: kick, snare, hats; soft ghost strokes on the snare, one flam (its grace stroke is not held against either ear) */
static std::vector<float> kick() { std::vector<float> y (S (0.35)); double ph = 0; for (size_t i = 0; i < y.size(); ++i) { const double t = (double) i / SR, f = 50 + 110 * std::exp (-t * 30); ph += 2 * M_PI * f / SR; y[i] = (float) (std::sin (ph) * std::exp (-t * 9)) + (t < 0.003 ? 0.3f * noise() : 0.0f); } return y; }
static std::vector<float> snare() { std::vector<float> y (S (0.25)); for (size_t i = 0; i < y.size(); ++i) { const double t = (double) i / SR; y[i] = (float) (0.5 * std::sin (2 * M_PI * 185 * t) * std::exp (-t * 25) + 0.6 * noise() * std::exp (-t * 18)); } return y; }
static std::vector<float> hat() { auto y = scrape (0.06, 6000, 16000); for (size_t i = 0; i < y.size(); ++i) y[i] = noise() * (float) std::exp (-(double) i / SR * 70) * 0.5f; return y; }
static Case drums()
{
    Case c { "drums, with ghost strokes and a flam", std::vector<float> (S (10.5), 0.0f), {} };
    const double six = 60.0 / 100.0 / 4;                                                 // (sixteenths at 100)
    for (int k = 0; k < 64; ++k)
    {
        const double t = 0.4 + k * six;
        bool any = false;
        if (k % 8 == 0 || k % 16 == 10) { add (c.x, S (t), kick(), 0.9f); any = true; }
        if (k % 8 == 4) { add (c.x, S (t), snare(), 0.8f); any = true; }
        if (k % 16 == 7 || k % 16 == 14) { add (c.x, S (t), snare(), 0.1f); any = true; }       // (ghost strokes, 18 dB down)
        if (k % 2 == 0) { add (c.x, S (t), hat(), k % 4 == 0 ? 0.35f : 0.18f); any = true; }
        if (k == 36) { add (c.x, S (t - 0.028), snare(), 0.3f); c.truth.push_back ({ t - 0.028, 0 }); c.truth.push_back ({ t, 0, true }); continue; }      // (a flam is one stroke, where its grace begins; its main stroke is not held against either ear)
        if (any) c.truth.push_back ({ t, 0 });
    }
    level (c.x, 0.9f); hiss (c.x, 0.0002f);
    return c;
}
/* a line sung or bowed: one breath, the notes going from one to the next without a break, a vibrato on the long ones, one
   slide (its note is where it arrives); a swell at the start (a hit, though soft) */
static Case legato()
{
    Case c { "legato line, vibrato and a slide", std::vector<float> (S (7.0), 0.0f), {} };
    struct N { double t, len, midi; bool slide; };
    const std::vector<N> line = { { 0.5, 0.6, 62, false }, { 1.1, 0.4, 64, false }, { 1.5, 0.9, 65, false }, { 2.4, 0.5, 67, false }, { 2.9, 0.4, 69, true }, { 3.3, 1.2, 67, false }, { 4.5, 0.5, 64, false }, { 5.0, 1.2, 62, false } };
    double ph = 0;
    for (size_t i = S (0.5); i < S (6.2); ++i)
    {
        const double t = (double) i / SR;
        size_t k = 0; while (k + 1 < line.size() && t >= line[k + 1].t) ++k;
        double m = line[k].midi;
        if (k + 1 < line.size() && line[k + 1].slide && t > line[k + 1].t - 0.15) m += (line[k + 1].midi - m) * (t - (line[k + 1].t - 0.15)) / 0.15;     // (sliding up into the next)
        else if (k > 0 && t - line[k].t < 0.012) m = line[k - 1].midi + (m - line[k - 1].midi) * (t - line[k].t) / 0.012;
        if (line[k].len > 0.8 && t - line[k].t > 0.25) m += 0.3 * std::sin (2 * M_PI * 5.5 * (t - line[k].t));
        const double f = 440 * std::pow (2.0, (m - 69) / 12);
        ph += 2 * M_PI * f / SR;
        double v = 0; for (int h = 1; h <= 10; ++h) v += std::sin (h * ph) / h * (h % 2 ? 1.0 : 0.6);
        const double a = std::min (1.0, (t - 0.5) / 0.08) * std::min (1.0, (6.2 - t) / 0.1);
        c.x[i] = (float) (0.3 * v * a);
    }
    c.truth.push_back ({ 0.5, 0 });
    for (size_t k = 1; k < line.size(); ++k) c.truth.push_back ({ line[k].t, 1, line[k].slide });      // (where a slide arrives: found or not, it is not held against either ear)
    level (c.x, 0.7f); hiss (c.x, 0.0002f);
    c.slack = 0.012;                                                                     // (its one hit is a swell, 80 ms up from nothing: where it begins is where it is first heard)
    return c;
}
/* a piano-like part: chords struck and let die, some soft, some on top of the last one still sounding */
static Case keys()
{
    Case c { "struck chords, loud and soft", std::vector<float> (S (8.0), 0.0f), {} };
    const std::vector<std::pair<double, float>> at = { { 0.5, 1.0f }, { 1.2, 0.5f }, { 1.6, 0.3f }, { 2.4, 1.0f }, { 3.2, 0.15f }, { 3.5, 0.8f }, { 4.3, 0.4f }, { 5.0, 1.0f }, { 5.25, 0.6f }, { 6.0, 0.2f } };
    for (size_t k = 0; k < at.size(); ++k)
    {
        const double root = 48 + (double) ((k * 5) % 12);
        for (double iv : { 0.0, 4.0, 7.0, 12.0 })
        {
            const double f = 440 * std::pow (2.0, (root + iv - 69) / 12);
            std::vector<float> y (S (2.0));
            for (size_t i = 0; i < y.size(); ++i) { const double t = (double) i / SR; double v = 0; for (int h = 1; h <= 6; ++h) v += std::sin (2 * M_PI * f * h * t) * std::exp (-t * (1.5 + h)) / h; y[i] = (float) v; }
            add (c.x, S (at[k].first), y, 0.2f * at[k].second);
        }
        c.truth.push_back ({ at[k].first, 0 });
    }
    level (c.x, 0.8f); hiss (c.x, 0.0002f);
    return c;
}

/* ── scoring ── */
struct Score { int truths = 0, found = 0, wrong = 0; double err = 0, sign = 0; int placed = 0; };
static Score score (const std::vector<Truth>& truth, const std::vector<double>& got, int kind, double tol)
{
    Score s;
    std::vector<bool> used (got.size(), false);
    for (auto& t : truth)
    {
        if (t.kind != kind) continue;
        int best = -1; double bd = tol;
        for (size_t i = 0; i < got.size(); ++i) if (! used[i] && std::abs (got[i] - t.s) <= bd) { bd = std::abs (got[i] - t.s); best = (int) i; }
        if (! t.optional) ++s.truths;
        if (best >= 0) { used[(size_t) best] = true; if (! t.optional) { ++s.found; s.err += bd; s.sign += got[(size_t) best] - t.s; ++s.placed; } }
    }
    for (size_t i = 0; i < got.size(); ++i)
    {
        if (used[i]) continue;
        bool nearOther = false;                                                          // (a hit found where a note truly is, or the other way round, is no worse than a miss of the right kind)
        for (auto& t : truth) if (t.kind != kind && std::abs (got[i] - t.s) <= tol) nearOther = true;
        if (! nearOther) ++s.wrong;
    }
    return s;
}
static double fOf (const Score& s) { const double p = s.found + s.wrong ? (double) s.found / (s.found + s.wrong) : 1, r = s.truths ? (double) s.found / s.truths : 1; return p + r > 0 ? 2 * p * r / (p + r) : 0; }
static std::vector<double> kindOf (const std::vector<Hit>& h, int kind, float th) { std::vector<double> v; for (auto& x : h) if (x.kind == kind && x.score >= th) v.push_back (x.s); return v; }

static bool readWav (const char* path, std::vector<float>& mono, double& sr)
{
    FILE* f = std::fopen (path, "rb");
    if (! f) return false;
    std::vector<uint8_t> d;
    uint8_t buf[65536]; size_t got;
    while ((got = std::fread (buf, 1, sizeof buf, f)) > 0) d.insert (d.end(), buf, buf + got);
    std::fclose (f);
    if (d.size() < 44 || std::memcmp (d.data(), "RIFF", 4) || std::memcmp (d.data() + 8, "WAVE", 4)) return false;
    int fmt = 0, chans = 0, bits = 0; size_t p = 12;
    while (p + 8 <= d.size())
    {
        const uint32_t len = d[p + 4] | d[p + 5] << 8 | d[p + 6] << 16 | (uint32_t) d[p + 7] << 24;
        if (! std::memcmp (d.data() + p, "fmt ", 4)) { fmt = d[p + 8] | d[p + 9] << 8; chans = d[p + 10] | d[p + 11] << 8; sr = d[p + 12] | d[p + 13] << 8 | d[p + 14] << 16 | (uint32_t) d[p + 15] << 24; bits = d[p + 22] | d[p + 23] << 8; if (fmt == 0xFFFE) fmt = d[p + 32] | d[p + 33] << 8; }
        if (! std::memcmp (d.data() + p, "data", 4))
        {
            const size_t bytes = bits / 8, frames = std::min<size_t> (len, d.size() - p - 8) / (bytes * (size_t) chans);
            mono.assign (frames, 0.0f);
            for (size_t i = 0; i < frames; ++i)
                for (int c = 0; c < chans; ++c)
                {
                    const uint8_t* q = d.data() + p + 8 + (i * (size_t) chans + (size_t) c) * bytes;
                    float v = 0;
                    if (fmt == 3 && bits == 32) std::memcpy (&v, q, 4);
                    else if (bits == 16) v = (int16_t) (q[0] | q[1] << 8) / 32768.0f;
                    else if (bits == 24) v = (int32_t) ((q[0] << 8 | q[1] << 16 | (uint32_t) q[2] << 24)) / 2147483648.0f;
                    else if (bits == 32) v = (int32_t) (q[0] | q[1] << 8 | q[2] << 16 | (uint32_t) q[3] << 24) / 2147483648.0f;
                    mono[i] += v / (float) chans;
                }
            return true;
        }
        p += 8 + len + (len & 1);
    }
    return false;
}

int main (int argc, char** argv)
{
    const float TH = 0.12f;                                                              // (the sensitivity the app begins at)
    int bad = 0;
    std::printf ("%-38s %-4s %22s %22s\n", "", "", "old ear", "new ear");
    for (auto c : { guitar(), drums(), legato(), keys() })
    {
        const float* ch[1] = { c.x.data() };
        const auto h = transients (ch, 1, (int) c.x.size(), SR);
        const auto o = oldOnsets (c.x, SR);
        for (int kind : { 0, 1 })
        {
            bool any = false; for (auto& t : c.truth) if (t.kind == kind) any = true;
            if (! any && kind == 1) { const auto extra = kindOf (h, 1, 0.15f); if (! extra.empty()) { std::printf ("%-38s %-4s new ear found %zu notes where there are none\n", c.name.c_str(), "note", extra.size()); if (extra.size() > 1) ++bad; } continue; }
            if (! any) continue;
            const double tol = kind ? 0.050 : 0.020;
            const auto so = score (c.truth, kind ? std::vector<double>() : o, kind, tol), sn = score (c.truth, kindOf (h, kind, kind ? 0.15f : TH), kind, tol);
            char a[64], b[64];
            std::snprintf (a, sizeof a, "%2d/%-2d +%-2d  %4.1f ms", so.found, so.truths, so.wrong, so.placed ? 1000 * so.err / so.placed : 0.0);
            std::snprintf (b, sizeof b, "%2d/%-2d +%-2d  %4.1f ms", sn.found, sn.truths, sn.wrong, sn.placed ? 1000 * sn.err / sn.placed : 0.0);
            std::printf ("%-38s %-4s %22s %22s   F %.2f -> %.2f   (late by %+.1f ms)\n", c.name.c_str(), kind ? "note" : "hit", kind ? "(none)" : a, b, kind ? 0.0 : fOf (so), fOf (sn), sn.placed ? 1000 * sn.sign / sn.placed : 0.0);
            if (fOf (sn) < 0.9 || (sn.placed && sn.err / sn.placed > (kind ? 0.03 : c.slack))) ++bad;
        }
        if (getenv ("MISS"))
            for (int kind : { 0, 1 })
            {
                const auto got = kindOf (h, kind, kind ? 0.15f : TH);
                for (auto& t : c.truth) if (t.kind == kind && ! t.optional) { bool f = false; for (auto g : got) if (std::abs (g - t.s) <= (kind ? 0.05 : 0.02)) f = true; if (! f) std::printf ("    missed %s %.4f\n", kind ? "note" : "hit ", t.s); }
                for (auto& x : h) if (x.kind == kind && x.score >= (kind ? 0.15f : TH)) { bool f = false; for (auto& t : c.truth) if (std::abs (x.s - t.s) <= (kind ? 0.05 : 0.02)) f = true; if (! f) std::printf ("    not there %s %.4f  %.2f\n", kind ? "note" : "hit ", x.s, x.score); }
            }
        if (getenv ("SAY")) for (auto& x : h) std::printf ("    %s %.4f  %.2f\n", x.kind ? "note" : "hit ", x.s, x.score);
        if (getenv ("SAY")) for (auto& t : c.truth) std::printf ("    truth %s %.4f%s\n", t.kind ? "note" : "hit ", t.s, t.optional ? " (optional)" : "");
    }
    for (int i = 1; i < argc; ++i)
    {
        std::vector<float> x; double sr = 0;
        if (! readWav (argv[i], x, sr)) { std::printf ("%s: not read\n", argv[i]); continue; }
        const float* ch[1] = { x.data() };
        const auto h = transients (ch, 1, (int) x.size(), sr);
        std::vector<double> xd (x.size()); (void) xd;
        const auto o = oldOnsets (x, sr);
        std::printf ("%s: %.1f s, old ear %zu, new ear %zu hits and %zu notes\n", argv[i], x.size() / sr, o.size(), kindOf (h, 0, TH).size(), kindOf (h, 1, 0.15f).size());
        if (getenv ("SAY")) { for (auto& v : h) if (v.score >= (v.kind ? 0.15f : TH)) std::printf ("    %s %.4f  %.2f\n", v.kind ? "note" : "hit ", v.s, v.score); for (auto v : o) std::printf ("    old  %.4f\n", v); }
    }
    std::printf (bad ? "hits: %d WRONG\n" : "hits: 0 wrong\n", bad);
    return bad ? 1 : 0;
}
