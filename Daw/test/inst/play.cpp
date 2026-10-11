/*  The instruments, played by themselves into numbers (no app, no device) and measured: is the pitch the key's, does a
    note end, is a block cut anywhere the same sound, does every drum sound and stop.   ./test/inst/run.sh             */
#include "../../Source/Instruments.h"
#include <chrono>
#include <cstdio>
#include <functional>
#include <map>

using namespace slurinst;
static const double SR = 48000.0;
static int failed = 0, passed = 0;
static void ok (const char* what, bool good, const std::string& got = {})
{
    if (good) ++passed; else ++failed;
    std::printf ("%s  %s%s%s\n", good ? "ok  " : "FAIL", what, got.empty() ? "" : "  -> ", got.c_str());
}
static std::string num (double v) { char b[64]; std::snprintf (b, sizeof b, "%.5g", v); return b; }

struct Take { std::vector<float> L, R; };
struct Note { double at; uint8_t st, d1, d2; };

/** Play `inst` for `seconds` with the given events, in blocks of `block` samples (0: blocks of uneven lengths). */
static Take play (Instrument& inst, double seconds, std::vector<Note> notes, int block = 512)
{
    std::stable_sort (notes.begin(), notes.end(), [] (const Note& a, const Note& b) { return a.at < b.at; });
    const int total = (int) (seconds * SR);
    Take t; t.L.assign ((size_t) total, 0.0f); t.R.assign ((size_t) total, 0.0f);
    size_t k = 0; int pos = 0; uint32_t r = 12345u;
    while (pos < total)
    {
        int n = block;
        if (block == 0) { r = r * 1664525u + 1013904223u; n = 1 + (int) ((r >> 16) % 700u); }
        n = std::min (n, total - pos);
        std::vector<Ev> evs;
        while (k < notes.size() && (int) std::llround (notes[k].at * SR) < pos + n) { const int at = std::max (0, (int) std::llround (notes[k].at * SR) - pos); evs.push_back ({ at, notes[k].st, notes[k].d1, notes[k].d2 }); ++k; }
        inst.render (t.L.data() + pos, t.R.data() + pos, n, evs.data(), (int) evs.size());
        pos += n;
    }
    return t;
}
static double rms (const std::vector<float>& x, double a, double b)
{
    const int i0 = (int) (a * SR), i1 = std::min ((int) x.size(), (int) (b * SR)); double s = 0.0;
    for (int i = i0; i < i1; ++i) s += (double) x[(size_t) i] * x[(size_t) i];
    return std::sqrt (s / std::max (1, i1 - i0));
}
static double peak (const Take& t) { double p = 0.0; for (float v : t.L) p = std::max (p, (double) std::abs (v)); for (float v : t.R) p = std::max (p, (double) std::abs (v)); return p; }
static bool finite (const Take& t) { for (float v : t.L) if (! std::isfinite (v)) return false; for (float v : t.R) if (! std::isfinite (v)) return false; return true; }
/** The pitch of a stretch, by how far it must be shifted to lie on itself again. */
static double pitch (const std::vector<float>& x, double a, double b, double lo = 40.0, double hi = 2400.0)
{
    const int i0 = (int) (a * SR), n = (int) ((b - a) * SR), l0 = (int) (SR / hi), l1 = (int) (SR / lo);
    std::vector<double> ac ((size_t) l1 + 2, 0.0);
    double best = -1.0e30; int bl = l0;
    for (int lag = l0; lag <= l1 + 1; ++lag) { double s = 0.0; for (int i = 0; i + lag < n; ++i) s += (double) x[(size_t) (i0 + i)] * x[(size_t) (i0 + i + lag)]; ac[(size_t) lag] = s / (double) (n - lag); }
    for (int lag = l0 + 1; lag <= l1; ++lag) if (ac[(size_t) lag] > ac[(size_t) lag - 1] && ac[(size_t) lag] >= ac[(size_t) lag + 1] && ac[(size_t) lag] > best * 1.02 + 1e-12) { best = ac[(size_t) lag]; bl = lag; }
    const double y0 = ac[(size_t) bl - 1], y1 = ac[(size_t) bl], y2 = ac[(size_t) bl + 1], d = (y0 - y2) / (2.0 * (y0 - 2.0 * y1 + y2));
    return SR / ((double) bl + (std::isfinite (d) ? d : 0.0));
}
static bool near (double a, double b, double part = 0.006) { return std::abs (a - b) <= b * part; }
static Note on (double at, int n, int v = 100) { return { at, 0x90, (uint8_t) n, (uint8_t) v }; }
static Note off (double at, int n) { return { at, 0x80, (uint8_t) n, 0 }; }

int main()
{
    //── the synth ──
    {
        Synth s; s.prepare (SR);
        auto t = play (s, 3.0, { on (0.0, 69), off (1.0, 69) });
        ok ("synth: a' is 440", near (pitch (t.L, 0.3, 0.8), 440.0), num (pitch (t.L, 0.3, 0.8)));
        ok ("synth: it sounds, and not too loud", rms (t.L, 0.2, 0.9) > 0.02 && peak (t) < 1.0 && finite (t), num (rms (t.L, 0.2, 0.9)) + " peak " + num (peak (t)));
        ok ("synth: let go, it dies away and is silent", rms (t.L, 2.6, 3.0) < 1.0e-5 && ! s.sounding(), num (rms (t.L, 2.6, 3.0)));
        for (int w = 0; w < 4; ++w)
        {
            Synth q; q.prepare (SR); q.set ("wave1", (float) w); q.set ("mix", 0.0f); q.set ("cutoff", 18000.0f); q.set ("envAmt", 0.0f);
            auto u = play (q, 1.0, { on (0.0, 57) });
            ok (("synth: wave " + std::to_string (w) + " at a is 220").c_str(), near (pitch (u.L, 0.3, 0.9), 220.0) && finite (u), num (pitch (u.L, 0.3, 0.9)));
        }
        {
            Synth q; q.prepare (SR); q.set ("mix", 0.0f); q.set ("detune", 0.0f);
            auto u = play (q, 1.5, { on (0.0, 69), { 0.5, 0xE0, 0x7F, 0x7F } });
            ok ("synth: bent all the way up it is two semitones higher", near (pitch (u.L, 0.9, 1.4), 493.88, 0.008), num (pitch (u.L, 0.9, 1.4)));
        }
        {
            Synth q; q.prepare (SR); q.set ("mono", 1.0f); q.set ("glide", 0.08f); q.set ("mix", 0.0f);
            auto u = play (q, 2.0, { on (0.0, 57), on (0.5, 69), off (0.6, 57), off (1.2, 69) });
            ok ("synth: one voice, the second key slides to its pitch", near (pitch (u.L, 0.85, 1.15), 440.0, 0.01), num (pitch (u.L, 0.85, 1.15)));
            auto w = play (q, 2.0, { on (0.0, 57), on (0.4, 69), off (0.7, 69), off (1.4, 57) });
            ok ("synth: one voice, the upper key let go: back to the key still held", near (pitch (w.L, 1.0, 1.35), 220.0, 0.01) && rms (w.L, 1.0, 1.3) > 0.01, num (pitch (w.L, 1.0, 1.35)));
        }
        {
            Synth q; q.prepare (SR);
            auto u = play (q, 4.0, { { 0.0, 0xB0, 64, 127 }, on (0.05, 60), off (0.3, 60), { 1.5, 0xB0, 64, 0 } });
            ok ("synth: the pedal holds a note whose key is up, and lets it go", rms (u.L, 1.0, 1.4) > 0.005 && rms (u.L, 3.5, 4.0) < 1.0e-5, num (rms (u.L, 1.0, 1.4)) + " then " + num (rms (u.L, 3.5, 4.0)));
        }
        {
            std::vector<Note> many; for (int i = 0; i < 28; ++i) many.push_back (on (0.01 * i, 40 + i * 2));
            Synth q; q.prepare (SR);
            auto u = play (q, 1.0, many);
            ok ("synth: more keys than voices: nothing breaks", finite (u) && peak (u) < 4.0, num (peak (u)));
        }
        {
            std::vector<Note> song = { on (0.0, 60), on (0.013, 64, 80), on (0.2501, 67, 60), off (0.5, 60), { 0.55, 0xE0, 0x00, 0x50 }, off (0.61, 64), on (0.7, 72, 127), off (0.9, 67), off (1.1, 72) };
            Synth a, b; a.prepare (SR); b.prepare (SR);
            for (auto* q : { &a, &b }) { q->set ("vib", 0.3f); q->set ("lfoCut", 0.5f); q->set ("fm", 0.2f); }
            auto u = play (a, 2.0, song, 512), w = play (b, 2.0, song, 0);
            double worst = 0.0; for (size_t i = 0; i < u.L.size(); ++i) worst = std::max (worst, (double) std::abs (u.L[i] - w.L[i]));
            ok ("synth: a block cut anywhere gives the very same sound", worst == 0.0, num (worst));
        }
        {
            Synth q; q.prepare (SR); q.set ("wave1", 3.0f); q.set ("fm", 0.5f); q.set ("fmRatio", 1.0f); q.set ("cutoff", 18000.0f); q.set ("envAmt", 0.0f);
            auto u = play (q, 1.0, { on (0.0, 69) });
            ok ("synth: bent by its second oscillator it keeps its pitch", near (pitch (u.L, 0.2, 0.9), 440.0) && finite (u), num (pitch (u.L, 0.2, 0.9)));
        }
        {
            Synth q; q.prepare (SR);
            std::vector<Note> chord; for (int i = 0; i < 16; ++i) chord.push_back (on (0.0, 36 + i * 3));
            const auto t0 = std::chrono::steady_clock::now();
            auto u = play (q, 10.0, chord);
            const double took = std::chrono::duration<double> (std::chrono::steady_clock::now() - t0).count();
            ok ("synth: sixteen notes held take little of a core", took / 10.0 < 0.25, num (100.0 * took / 10.0) + "% of one core");
        }
    }
    //── the drums ──
    {
        bool allSound = true, allEnd = true, allFinite = true; double loudest = 0.0; std::string quiet, endless;
        for (int i = 0; i < Drums::kPads; ++i)
        {
            Drums d; d.prepare (SR);
            auto t = play (d, 9.0, { on (0.0, Drums::pads()[i].note, 110) });
            if (! (rms (t.L, 0.0, 0.05) > 0.003)) { allSound = false; quiet += std::string (Drums::pads()[i].name) + " "; }
            if (d.sounding() || rms (t.L, 8.5, 9.0) > 1.0e-5) { allEnd = false; endless += std::string (Drums::pads()[i].name) + " "; }
            allFinite = allFinite && finite (t); loudest = std::max (loudest, peak (t));
        }
        ok ("drums: every pad sounds", allSound, quiet);
        ok ("drums: every pad ends", allEnd, endless);
        ok ("drums: no pad is louder than full, none breaks", allFinite && loudest < 1.0, num (loudest));
        {
            Drums d; d.prepare (SR);
            auto open = play (d, 1.0, { on (0.0, 46) });
            Drums e; e.prepare (SR);
            auto shut = play (e, 1.0, { on (0.0, 46), on (0.1, 42) });
            ok ("drums: a closed hat stops the open one", rms (open.L, 0.25, 0.4) > 4.0 * rms (shut.L, 0.25, 0.4), num (rms (open.L, 0.25, 0.4)) + " against " + num (rms (shut.L, 0.25, 0.4)));
        }
        {
            Drums d; d.prepare (SR);
            auto t = play (d, 1.0, { on (0.0, 35), on (0.5, 40) });
            ok ("drums: the keys beside a pad's own play it too", rms (t.L, 0.0, 0.1) > 0.01 && rms (t.L, 0.5, 0.6) > 0.01);
            Drums none; none.prepare (SR);
            auto u = play (none, 1.0, { on (0.0, 20) });
            ok ("drums: a key with no pad is silent", peak (u) < 1.0e-9);
        }
        {
            auto buf = std::make_shared<std::vector<float>> ((size_t) 24000);
            for (size_t i = 0; i < buf->size(); ++i) (*buf)[i] = 0.5f * (float) std::sin (2.0 * 3.141592653589793 * 330.0 * (double) i / SR);
            Drums d; d.prepare (SR); d.set ("kick.decay", 3.0f); d.set ("kick.level", 0.0f); d.set ("level", 0.0f);
            Sample s; s.L = buf->data(); s.R = buf->data(); s.n = (int) buf->size(); s.keep = buf;
            d.setSample (0, s);
            auto t = play (d, 1.0, { on (0.0, 36, 127) });
            ok ("drums: a pad given a sound plays that sound", near (pitch (t.L, 0.05, 0.4), 330.0) && rms (t.L, 0.7, 1.0) < 1.0e-6, num (pitch (t.L, 0.05, 0.4)));
        }
        {
            std::vector<Note> beat; for (int i = 0; i < 32; ++i) { beat.push_back (on (0.11 * i, 42, 90)); if (i % 4 == 0) beat.push_back (on (0.11 * i, 36)); if (i % 8 == 4) beat.push_back (on (0.11 * i, 38)); }
            Drums a, b; a.prepare (SR); b.prepare (SR);
            auto u = play (a, 4.0, beat, 512), w = play (b, 4.0, beat, 0);
            double worst = 0.0; for (size_t i = 0; i < u.L.size(); ++i) worst = std::max (worst, (double) std::abs (u.L[i] - w.L[i]));
            ok ("drums: a block cut anywhere gives the very same sound", worst == 0.0, num (worst));
        }
    }
    //── the sampler ──
    {
        auto buf = std::make_shared<std::vector<float>> ((size_t) 48000);
        for (size_t i = 0; i < buf->size(); ++i) (*buf)[i] = 0.5f * (float) std::sin (2.0 * 3.141592653589793 * 440.0 * (double) i / SR);
        Sample s; s.L = buf->data(); s.R = buf->data(); s.n = (int) buf->size(); s.keep = buf;
        {
            Sampler q; q.prepare (SR);
            auto t = play (q, 0.5, { on (0.0, 60) });
            ok ("sampler: with no sound it is silent", peak (t) == 0.0);
        }
        Sampler q; q.prepare (SR); q.set ("root", 69.0f); q.setSample (0, s);
        auto t = play (q, 1.5, { on (0.0, 69), off (0.6, 69) });
        ok ("sampler: its own key plays the sound as it is", near (pitch (t.L, 0.1, 0.5), 440.0, 0.002), num (pitch (t.L, 0.1, 0.5)));
        ok ("sampler: let go, it ends", rms (t.L, 1.2, 1.5) < 1.0e-6 && ! q.sounding());
        auto u = play (q, 1.0, { on (0.0, 81), off (0.3, 81) });
        ok ("sampler: an octave up is twice the pitch", near (pitch (u.L, 0.05, 0.28), 880.0, 0.003), num (pitch (u.L, 0.05, 0.28)));
        auto d = play (q, 1.0, { on (0.0, 57), off (0.9, 57) });
        ok ("sampler: an octave down is half", near (pitch (d.L, 0.1, 0.8), 220.0, 0.003), num (pitch (d.L, 0.1, 0.8)));
        q.set ("loop", 1.0f); q.set ("loopStart", 0.25f); q.set ("loopEnd", 0.75f);
        auto l = play (q, 4.0, { on (0.0, 69), off (3.0, 69) });
        ok ("sampler: held, a loop goes on past the sound's own end", rms (l.L, 2.0, 2.9) > 0.1, num (rms (l.L, 2.0, 2.9)));
        q.set ("loop", 0.0f); q.set ("oneShot", 1.0f);
        auto o = play (q, 2.0, { on (0.0, 69), off (0.05, 69) });
        ok ("sampler: struck once it plays to its end, and no further", rms (o.L, 0.5, 0.9) > 0.1 && rms (o.L, 1.2, 2.0) < 1.0e-6, num (rms (o.L, 0.5, 0.9)));
        q.set ("oneShot", 0.0f); q.set ("end", 0.5f);
        auto c = play (q, 1.0, { on (0.0, 69) });
        double jump = 0.0; for (size_t i = (size_t) (0.49 * SR); i < (size_t) (0.52 * SR); ++i) jump = std::max (jump, (double) std::abs (c.L[i] - c.L[i - 1]));
        ok ("sampler: cut short, it ends without a click", jump < 0.05 && rms (c.L, 0.6, 1.0) == 0.0, num (jump));
        Sampler a, b; a.prepare (SR); b.prepare (SR); a.set ("root", 64.0f); b.set ("root", 64.0f); a.setSample (0, s); b.setSample (0, s);
        std::vector<Note> song = { on (0.0, 60), on (0.1003, 67), off (0.3, 60), { 0.35, 0xE0, 0x00, 0x60 }, off (0.5, 67), on (0.52, 72), off (0.8, 72) };
        auto x = play (a, 1.2, song, 512), y = play (b, 1.2, song, 0);
        double worst = 0.0; for (size_t i = 0; i < x.L.size(); ++i) worst = std::max (worst, (double) std::abs (x.L[i] - y.L[i]));
        ok ("sampler: a block cut anywhere gives the very same sound", worst == 0.0, num (worst));
    }
    ok ("make: the three kinds, and nothing for a name it does not know", make ("synth") && make ("drums") && make ("sampler") && ! make ("piano"));
    std::printf ("\n%d ok, %d failed\n", passed, failed);
    return failed ? 1 : 0;
}
