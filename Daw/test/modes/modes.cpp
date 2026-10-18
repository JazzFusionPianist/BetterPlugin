// Source/Modes.h by itself: sounds made here, stretched by each mode, and measured.
//   cut    every hit lands where the map puts it, as it was (its first 20 ms the same, sample for sample); where a piece has
//          room left over there is silence; squeezed, the joins do not click
//   beat   the same, but the room left over is filled with the piece's own tail
//   voice  a held note keeps its pitch and its level, stretched longer and shorter
//   all    not stretched at all, each gives back the sound itself
#include "../../Source/Modes.h"
#include <cstdio>
#include <cstdlib>
#include <algorithm>
#include <random>
#include <string>
using namespace slur;
static const double SR = 44100.0;
static int bad = 0;
static void ok (const std::string& what, bool cond, const std::string& more = "") { std::printf ("%s %s%s\n", cond ? "ok  " : "FAIL", what.c_str(), cond || more.empty() ? "" : ("  " + more).c_str()); if (! cond) ++bad; }
static std::string num (double v) { char b[64]; std::snprintf (b, sizeof b, "%.4g", v); return b; }

/* a click every half second from 0.25 s: a burst of noise and a long ring after it (longer than the gap) */
static std::vector<float> clicks (double len, std::vector<double>& at)
{
    std::mt19937 rng (3);
    std::uniform_real_distribution<float> u (-1, 1);
    std::vector<float> x ((size_t) (len * SR), 0.0f);
    for (double t = 0.25; t < len - 0.3; t += 0.5)
    {
        at.push_back (t);
        const size_t s = (size_t) (t * SR);
        for (size_t i = 0; s + i < x.size() && i < (size_t) (1.2 * SR); ++i)
        {
            const double tt = i / SR;
            x[s + i] += (float) ((tt < 0.004 ? u (rng) * 0.8 : 0.0) + 0.4 * std::sin (2 * M_PI * 330 * tt) * std::exp (-tt * 2.5));
        }
    }
    return x;
}
static std::vector<float> render (StretchMode m, const std::vector<float>& x, double k, std::vector<Pin> pins, std::vector<double> cuts)
{
    std::vector<float> y ((size_t) std::llround (x.size() * k));
    const float* in[1] = { x.data() }; float* out[1] = { y.data() };
    renderMode (m, in, 1, (int) x.size(), SR, pins, cuts, out, (int) y.size());
    return y;
}
static double rms (const std::vector<float>& y, double a, double b) { double s = 0; int n = 0; for (size_t i = (size_t) std::max (0.0, a * SR); i < (size_t) (b * SR) && i < y.size(); ++i) { s += y[i] * y[i]; ++n; } return n ? std::sqrt (s / n) : 0; }
static double firstAbove (const std::vector<float>& y, double from, double to, float th) { for (size_t i = (size_t) (from * SR); i < (size_t) (to * SR) && i < y.size(); ++i) if (std::abs (y[i]) >= th) return i / SR; return -1; }
/* the largest jump from one sample to the next, away from the hits (a click at a join shows as a jump) */
static double jump (const std::vector<float>& y, const std::vector<double>& hits, double k)
{
    double m = 0;
    for (size_t i = 1; i < y.size(); ++i)
    {
        const double t = i / SR;
        bool near = false; for (double h : hits) if (t > h * k - 0.002 && t < h * k + 0.008) near = true;
        if (! near) m = std::max (m, (double) std::abs (y[i] - y[i - 1]));
    }
    return m;
}
static double pitchOf (const std::vector<float>& y, double a, double len)
{
    const size_t s = (size_t) (a * SR), n = (size_t) (len * SR);
    std::vector<double> r;
    for (int l = (int) (SR / 500); l < (int) (SR / 80); ++l) { double c = 0, e = 1e-9; for (size_t i = s; i < s + n; ++i) { c += y[i] * y[i + l]; e += y[i] * y[i]; } r.push_back (c / e); }
    const double top = *std::max_element (r.begin(), r.end());
    for (size_t k = 1; k + 1 < r.size(); ++k) if (r[k] >= 0.9 * top && r[k] >= r[k - 1] && r[k] >= r[k + 1]) return SR / ((double) SR / 500 + k);      // (the shortest lag nearly as alike as the best: the period, not twice it)
    return 0;
}

int main()
{
    std::vector<double> at;
    const auto x = clicks (4.0, at);
    std::vector<double> cuts; for (double t : at) cuts.push_back (t - 0.0005);
    const double baseJump = jump (x, at, 1.0);
    for (StretchMode m : { StretchMode::cut, StretchMode::beat })
    {
        const std::string name = m == StretchMode::cut ? "cut" : "beat";
        /* half as fast again */
        const auto y = render (m, x, 1.5, {}, cuts);
        double worst = 0, shape = 1;
        for (double t : at)
        {
            const double f = firstAbove (y, t * 1.5 - 0.01, t * 1.5 + 0.02, 0.3f);
            worst = std::max (worst, std::abs (f - t * 1.5));
            double c = 0, e1 = 1e-9, e2 = 1e-9;
            for (int i = 0; i < (int) (0.020 * SR); ++i) { const long e = std::lround ((t - 0.0005) * SR); const double p = x[(size_t) (t * SR) + i], q = y[(size_t) (std::llround (e * 1.5) + (long) (t * SR) - e) + i]; c += p * q; e1 += p * p; e2 += q * q; }
            shape = std::min (shape, c / std::sqrt (e1 * e2));
        }
        ok (name + ", 1.5 times as long: every hit where the map puts it, within a millisecond", worst < 0.001, num (worst * 1000) + " ms");
        ok (name + ": …as it was (its first 20 ms, sample for sample)", shape > 0.99, num (shape));
        /* the room left over: the last 0.15 s before each next hit */
        double gap = 0, ring = 0;
        for (size_t i = 0; i + 1 < at.size(); ++i) { gap = std::max (gap, rms (y, at[i + 1] * 1.5 - 0.15, at[i + 1] * 1.5 - 0.01)); ring = std::max (ring, rms (x, at[i + 1] - 0.05, at[i + 1] - 0.01)); }
        if (m == StretchMode::cut) ok ("cut: the room left over is silent", gap < 1e-4, num (gap));
        else ok ("beat: the room left over is filled with the piece's own tail (as loud as it was at the end)", gap > ring * 0.5 && gap < ring * 2.0, num (gap) + " vs " + num (ring));
        ok (name + ": no click anywhere between the hits", jump (y, at, 1.5) < baseJump * 1.6 + 0.01, num (jump (y, at, 1.5)) + " vs " + num (baseJump));
        /* squeezed to three quarters */
        const auto z = render (m, x, 0.75, {}, cuts);
        double worstZ = 0; for (double t : at) worstZ = std::max (worstZ, std::abs (firstAbove (z, t * 0.75 - 0.01, t * 0.75 + 0.02, 0.3f) - t * 0.75));
        ok (name + ", three quarters as long: every hit in its place", worstZ < 0.001, num (worstZ * 1000) + " ms");
        ok (name + ": squeezed, the joins do not click", jump (z, at, 0.75) < baseJump * 1.6 + 0.01, num (jump (z, at, 0.75)) + " vs " + num (baseJump));
        /* a pin: the fourth hit pulled 100 ms later, the rest where they were */
        const double h4 = at[3] - 0.0005;
        const auto p = render (m, x, 1.0, { { at[2] - 0.0005, at[2] - 0.0005 }, { h4, h4 + 0.1 }, { at[4] - 0.0005, at[4] - 0.0005 } }, cuts);      // (the pins either side hold the rest, as the page puts them)
        const double f4 = firstAbove (p, at[3] + 0.09, at[3] + 0.12, 0.3f), f6 = firstAbove (p, at[5] - 0.01, at[5] + 0.02, 0.3f);
        ok (name + ": a pin pulls its hit 100 ms later; one further on stays", std::abs (f4 - (at[3] + 0.1)) < 0.001 && std::abs (f6 - at[5]) < 0.001, num ((f4 - at[3]) * 1000) + " ms, " + num ((f6 - at[5]) * 1000));
    }
    /* voice: a held note, longer and shorter */
    {
        std::vector<float> v ((size_t) (2.0 * SR));
        for (size_t i = 0; i < v.size(); ++i) { const double t = i / SR; double s = 0; for (int h = 1; h <= 8; ++h) s += std::sin (2 * M_PI * 220 * h * t) / h; v[i] = (float) (0.3 * s * std::min (1.0, t / 0.01)); }
        for (double k : { 1.5, 0.7 })
        {
            const auto y = render (StretchMode::voice, v, k, {}, {});
            const double f = pitchOf (y, 0.3 * k, 0.2), r0 = rms (v, 0.5, 1.5);
            if (getenv ("DBG")) std::printf ("   source pitch %.2f\n", pitchOf (v, 0.3, 0.2));
            double lo = 1e9, hi = 0;
            for (double t = 0.2 * k; t < 1.8 * k; t += 0.02) { const double r = rms (y, t, t + 0.02); lo = std::min (lo, r); hi = std::max (hi, r); }
            ok ("voice, " + num (k) + " times as long: the same pitch", std::abs (f / 220 - 1) < 0.01, num (f) + " Hz");
            ok ("voice, " + num (k) + ": its level steady, within 1.5 dB", 20 * std::log10 (hi / r0) < 1.5 && 20 * std::log10 (r0 / lo) < 1.5, num (20 * std::log10 (lo / r0)) + " .. " + num (20 * std::log10 (hi / r0)) + " dB");
        }
    }
    /* not stretched at all: the sound itself */
    for (StretchMode m : { StretchMode::cut, StretchMode::beat, StretchMode::voice })
    {
        const auto y = render (m, x, 1.0, {}, cuts);
        double e = 0, s = 1e-12; for (size_t i = 0; i < x.size(); ++i) { e += (y[i] - x[i]) * (y[i] - x[i]); s += x[i] * x[i]; }
        if (getenv ("DBG")) { int shown = 0; for (size_t i = 0; i < x.size() && shown < 8; ++i) if (std::abs (y[i] - x[i]) > 1e-3) { std::printf ("   %zu (%.4f s): x %.4f y %.4f\n", i, i / SR, x[i], y[i]); shown++; i += 2000; } }
        ok (std::string (m == StretchMode::cut ? "cut" : m == StretchMode::beat ? "beat" : "voice") + ", not stretched: the sound itself", 10 * std::log10 (e / s + 1e-20) < -60, num (10 * std::log10 (e / s + 1e-20)) + " dB");
    }
    std::printf (bad ? "modes: %d WRONG\n" : "modes: 0 wrong\n", bad);
    return bad ? 1 : 0;
}
