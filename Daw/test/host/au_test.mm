/*  Checks Source/host/Au.mm alone — the app's own way of opening an audio unit — against the Mac's own units, with no
    app and no JUCE: ./run.sh. What it asks: the list, sound through an effect, a control moved, settings kept and put
    back, the same unit in a process of its own giving the same samples, an instrument sounding, a second input, a
    view, and being told when a control is moved from outside. */
#include "../../Source/host/Plug.h"
#import <Cocoa/Cocoa.h>
#import <AudioToolbox/AudioToolbox.h>
#include <cmath>
#include <cstdio>

/* opening answers later, on the main thread: the check waits for it there */
static std::unique_ptr<slur::Plug> opened (uint32_t type, uint32_t sub, uint32_t maker, bool apart, std::string& why)
{
    bool answered = false; std::string said;
    auto got = std::make_shared<std::unique_ptr<slur::Plug>>();
    slur::openAudioUnit (type, sub, maker, apart, [&answered, &said, got] (std::unique_ptr<slur::Plug> p, std::string w) { *got = std::move (p); said = w; answered = true; });
    for (int k = 0; k < 600 && ! answered; ++k) CFRunLoopRunInMode (kCFRunLoopDefaultMode, 0.02, true);
    why = answered ? said : "no answer in twelve seconds";
    return std::move (*got);
}
static int bad = 0, asked = 0;
static void check (bool ok, const char* what) { ++asked; if (! ok) { ++bad; std::printf ("  WRONG  %s\n", what); } else std::printf ("  ok     %s\n", what); }
static uint32_t four (const char* s) { return ((uint32_t) (uint8_t) s[0] << 24) | ((uint32_t) (uint8_t) s[1] << 16) | ((uint32_t) (uint8_t) s[2] << 8) | (uint32_t) (uint8_t) s[3]; }
static const double RATE = 48000.0; static const int BLOCK = 512;

/* an impulse through a unit: seconds of stereo, block by block */
static std::vector<float> through (slur::Plug& p, double seconds, bool sine = false, const std::vector<float>* key = nullptr)
{
    const int total = (int) (seconds * RATE);
    std::vector<float> L ((size_t) total, 0.0f), R ((size_t) total, 0.0f);
    if (sine) for (int i = 0; i < total; ++i) L[(size_t) i] = R[(size_t) i] = 0.5f * (float) std::sin (2.0 * M_PI * 220.0 * i / RATE);
    else L[0] = R[0] = 1.0f;
    slur::Clock c; c.playing = true;
    for (int at = 0; at < total; at += BLOCK)
    {
        const int n = std::min (BLOCK, total - at);
        c.sample = at; c.beat = at / RATE * c.bpm / 60.0;
        p.process (L.data() + at, R.data() + at, n, key ? key->data() + at : nullptr, key ? key->data() + at : nullptr, nullptr, 0, c);
    }
    return L;
}
static int loudestAfter (const std::vector<float>& v, int from) { int at = from; for (int i = from; i < (int) v.size(); ++i) if (std::fabs (v[(size_t) i]) > std::fabs (v[(size_t) at])) at = i; return at; }
static double rms (const std::vector<float>& v, int a, int b) { double s = 0; for (int i = a; i < b; ++i) s += (double) v[(size_t) i] * v[(size_t) i]; return std::sqrt (s / std::max (1, b - a)); }
static std::string lower (std::string s) { for (auto& c : s) c = (char) std::tolower ((unsigned char) c); return s; }
static int controlNamed (slur::Plug& p, const char* part) { for (int i = 0; i < p.controls(); ++i) if (lower (p.controlName (i)).find (part) != std::string::npos) return i; return -1; }

int main()
{
    @autoreleasepool
    {
        [NSApplication sharedApplication];
        std::string why;

        std::printf ("the list\n");
        const auto all = slur::listAudioUnits();
        bool delay = false, dls = false;
        for (auto& f : all) { if (f.sub == four ("dely") && f.maker == four ("appl")) delay = f.name == "AUDelay" && f.makerName == "Apple"; if (f.sub == four ("dls ")) dls = f.instrument; }
        std::printf ("  %d units\n", (int) all.size());
        check (all.size() > 10, "the Mac's own units are listed"); check (delay, "AUDelay is among them, named and with its maker"); check (dls, "the DLS instrument is listed as an instrument");

        std::printf ("an effect (AUDelay)\n");
        auto d = opened (four ("aufx"), four ("dely"), four ("appl"), false, why);
        check (d != nullptr, "it opens"); if (! d) { std::printf ("%s\n", why.c_str()); return 1; }
        check (d->prepare (RATE, BLOCK, 0), "it is made ready in stereo");
        check (d->inputs() == 2 && d->outputs() == 2 && ! d->instrument(), "two in, two out, not an instrument");
        check (d->controls() >= 3, "it has controls");
        for (int i = 0; i < d->controls(); ++i) std::printf ("    %d %-22s %.3f\n", i, d->controlName (i).c_str(), d->control (i));
        const int time = controlNamed (*d, "delay time"), mix = controlNamed (*d, "dry/wet");
        check (time >= 0 && mix >= 0, "delay time and the mix are found by name");
        if (time < 0 || mix < 0) return 1;
        const auto first = through (*d, 1.5);
        const int echo = loudestAfter (first, 2000);
        std::printf ("    the echo of an impulse is loudest at %.4f s\n", echo / RATE);
        check (std::fabs (first[0]) > 0.1f && std::abs (echo - (int) RATE) < 64, "an impulse comes out at once and again one second later (its own setting)");

        std::printf ("a control moved\n");
        const float was = d->control (time);
        d->setControl (time, was * 0.25f);
        check (std::fabs (d->control (time) - was * 0.25f) < 1.0e-4f, "the control reads what was set");
        auto d2 = opened (four ("aufx"), four ("dely"), four ("appl"), false, why);
        d2->prepare (RATE, BLOCK, 0); d2->setControl (time, was * 0.25f);
        const auto quick = through (*d2, 1.5);
        const int echo2 = loudestAfter (quick, 2000);
        std::printf ("    now at %.4f s\n", echo2 / RATE);
        check (std::abs (echo2 - (int) (RATE / 4)) < 64, "the echo comes a quarter of a second later instead");

        std::printf ("settings kept and put back\n");
        const auto kept = d->state();
        check (kept.size() > 40 && std::memcmp (kept.data(), "bplist", 6) == 0, "settings are a binary property list");
        d->setControl (time, 0.9f); d->setControl (mix, 0.1f);
        check (d->setState (kept.data(), kept.size()), "they are taken back");
        check (std::fabs (d->control (time) - was * 0.25f) < 1.0e-4f, "and the controls stand where they stood");
        auto d3 = opened (four ("aufx"), four ("dely"), four ("appl"), false, why);
        d3->prepare (RATE, BLOCK, 0);
        check (d3->setState (kept.data(), kept.size()) && std::fabs (d3->control (time) - was * 0.25f) < 1.0e-4f, "a new one of the same kind takes them too");

        std::printf ("in a process of its own\n");
        auto far = opened (four ("aufx"), four ("dely"), four ("appl"), true, why);
        check (far != nullptr, "it opens apart"); if (! far) std::printf ("    %s\n", why.c_str());
        if (far)
        {
            check (far->prepare (RATE, BLOCK, 0), "and is made ready");
            far->setControl (time, was * 0.25f);
            const auto same = through (*far, 1.5);
            double worst = 0; for (size_t i = 0; i < same.size(); ++i) worst = std::max (worst, (double) std::fabs (same[i] - quick[i]));
            std::printf ("    greatest difference from the one inside the app: %g\n", worst);
            check (worst == 0.0, "sample for sample what the one inside the app gives");
            check (! far->lost(), "its process is alive");
            {
                /* asking for its settings crosses to that process and back: how long that takes (the app asks every plug-in about once a minute, on the main thread) */
                auto ms = [] (slur::Plug& p) { const auto t0 = CFAbsoluteTimeGetCurrent(); size_t n = 0; for (int k = 0; k < 20; ++k) n += p.state().size(); return std::make_pair ((CFAbsoluteTimeGetCurrent() - t0) * 1000.0 / 20.0, n / 20); };
                const auto in = ms (*d2), out = ms (*far);
                std::printf ("    settings asked for: %.3f ms inside the app, %.3f ms across (%d bytes)\n", in.first, out.first, (int) out.second);
                check (out.first < 20.0, "its settings come back in well under a blink");
            }
        }

        std::printf ("how its controls read\n");
        {
            std::string words;
            for (int i = 0; i < d->controls(); ++i)
            {
                const bool has = d->controlWords (i, 0.5f, words);
                std::printf ("    %d unit '%s' half way %g line %d steps %d switch %d words %s\n", i, d->controlUnit (i).c_str(), d->controlScaled (i, 0.5f), (int) d->controlLine (i), d->controlSteps (i), (int) d->controlSwitch (i), has ? words.c_str() : "(none)");
            }
            check (d->controlUnit (time) == "s", "delay time is in seconds");
            check (std::fabs (d->controlScaled (time, 0.5f) - 1.0f) < 1.0e-3f, "half way along delay time is one second");
            check (d->controlSteps (time) == 0 && ! d->controlSwitch (time), "it moves freely");
            check (! d->hasKey(), "it has no second input");
            d->reset(); d->release();
            check (d->prepare (RATE, BLOCK, 0), "let go and made ready again");
        }

        std::printf ("what it tells\n");
        std::printf ("    AUDelay is late by %d samples; AUPeakLimiter by ", d->latency());
        auto lim = opened (four ("aufx"), four ("lmtr"), four ("appl"), false, why);
        if (lim && lim->prepare (RATE, BLOCK, 0)) { std::printf ("%d\n", lim->latency()); check (lim->latency() >= 0 && lim->latency() < 4800, "a limiter says how late it is"); lim->offline (true); lim->offline (false); }
        else std::printf ("(not opened)\n");

        std::printf ("an instrument (the Mac's DLS synth)\n");
        auto s = opened (four ("aumu"), four ("dls "), four ("appl"), false, why);
        check (s != nullptr && s->instrument(), "it opens as an instrument");
        if (s && s->prepare (RATE, BLOCK, 0))
        {
            std::vector<float> L ((size_t) (RATE / 2), 0.0f), R = L;
            slur::Clock c; c.playing = true;
            for (int at = 0; at < (int) L.size(); at += BLOCK)
            {
                slur::Note key; key.at = 0; key.bytes[0] = 0x90; key.bytes[1] = 60; key.bytes[2] = 100;
                const int n = std::min (BLOCK, (int) L.size() - at);
                s->process (L.data() + at, R.data() + at, n, nullptr, nullptr, &key, at == 0 ? 1 : 0, c);
            }
            std::printf ("    a key held for half a second: %.4f rms\n", rms (L, 2400, (int) L.size()));
            check (rms (L, 2400, (int) L.size()) > 0.001, "a key down makes sound");
        }

        std::printf ("a second input (AUDynamicsProcessor)\n");
        auto comp = opened (four ("aufx"), four ("dcmp"), four ("appl"), false, why);
        if (comp)
        {
            check (comp->prepare (RATE, BLOCK, 2), "it is made ready with something to listen to");
            std::printf ("    its second input opened with %d channels\n", comp->keyChannels());
            std::vector<float> loud ((size_t) (RATE * 1.0), 0.0f);
            for (size_t i = 0; i < loud.size(); ++i) loud[i] = 0.9f * (float) std::sin (2.0 * M_PI * 60.0 * (double) i / RATE);
            const auto alone = through (*comp, 1.0, true);
            check (rms (alone, 24000, 48000) > 0.05, "sound goes through it");
            if (comp->keyChannels() > 0) { const auto ducked = through (*comp, 1.0, true, &loud); std::printf ("    alone %.4f, with a loud key %.4f\n", rms (alone, 24000, 48000), rms (ducked, 24000, 48000)); }
        }

        std::printf ("a view\n");
        int w = 0, h = 0; bool sizes = false, seen = false; void* v = nullptr; void* again = nullptr;
        d->view ([&] (void* view, int vw, int vh, bool vs) { v = view; w = vw; h = vh; sizes = vs; seen = true; });
        for (int k = 0; k < 200 && ! seen; ++k) CFRunLoopRunInMode (kCFRunLoopDefaultMode, 0.02, true);
        std::printf ("    %d x %d%s\n", w, h, sizes ? ", may be made larger" : "");
        check (v != nullptr && w > 50 && h > 20, "the unit gives a view of some size");
        d->view ([&] (void* view, int, int, bool) { again = view; });
        check (again == v, "asked again, it is the same one");
        {
            bool pressed = false;
            auto win = slur::PlugWindow::open ("the check", v, sizes, [&pressed] { pressed = true; });
            NSView* nv = (__bridge NSView*) v;
            check (win != nullptr && nv.window != nil && std::abs ((int) [nv.window contentRectForFrameRect: nv.window.frame].size.width - w) <= 1, "a window of its size holds it");
            [nv.window performClose: nil];
            check (pressed && nv.window != nil, "pressing close only says so");
            win.reset();
            check (nv.window == nil && nv.superview == nil, "let go of, the window is gone and the view is the unit's again");
        }

        std::printf ("told when a control is moved from outside\n");
        int told = -1;
        d->touched = [&told] (int i) { told = i; };
        /* as the unit's own window does it: the value is set and everyone listening is told */
        d->touch (mix, 0.33f);
        for (int k = 0; k < 30 && told < 0; ++k) CFRunLoopRunInMode (kCFRunLoopDefaultMode, 0.02, true);
        check (told == mix, "the app hears which control it was");
        told = -1;
        d->setControl (mix, 0.5f);
        for (int k = 0; k < 15; ++k) CFRunLoopRunInMode (kCFRunLoopDefaultMode, 0.02, true);
        check (told == -1, "a control the app itself moves is not taken for a hand");

        std::printf ("\n%d asked, %d wrong\n", asked, bad);
        return bad ? 1 : 0;
    }
}
