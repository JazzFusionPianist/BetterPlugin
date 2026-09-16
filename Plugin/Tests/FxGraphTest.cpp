// Orb FX engine self-test: the patchable wall's wiring semantics.
// Build: cmake --build build --config Debug --target FxGraphTest
#include "FxEngine.h"
#include <cstdio>
#include <cmath>
#include <set>

using namespace orbfx;

static int failures = 0;
#define CHECK(cond, msg) do { if (!(cond)) { std::printf ("  ✗ %s\n", msg); ++failures; } else std::printf ("  ✓ %s\n", msg); } while (0)

static constexpr double kSr = 48000.0;
static constexpr int    kBlock = 256;
static constexpr int    kBlocks = 40;   // ~213 ms

static juce::AudioBuffer<float> testSignal()
{
    juce::AudioBuffer<float> b (2, kBlock * kBlocks);
    for (int i = 0; i < b.getNumSamples(); ++i)
    {
        const float t = (float) i / (float) kSr;
        const float s = 0.4f * std::sin (2.0f * juce::MathConstants<float>::pi * 440.0f * t)
                      + (i % 4000 == 0 ? 0.5f : 0.0f);           // a click every 4000 samples
        b.setSample (0, i, s);
        b.setSample (1, i, 0.7f * s);
    }
    return b;
}

static void paramsFor (const Graph& g, NodeParams* params)
{
    for (int i = 0; i < kMaxNodes; ++i) params[i] = NodeParams {};
    for (auto& nd : g.nodes)
    {
        if (nd.id < 0 || nd.id >= kMaxNodes) continue;
        auto& p = params[nd.id];
        p.amount = nd.amount; p.variant = nd.variant;
        p.decay = nd.decay[juce::jlimit (0, 2, nd.variant)];
        p.delayDiv = nd.delayDiv; p.delayFb = nd.delayFb; p.wet = nd.wet; p.bpm = 120.0f;
    }
}

/** Run `g` over the test signal; returns the output. `mid` (optional) is
 *  applied after `switchAt` blocks. */
static juce::AudioBuffer<float> run (const Graph& g, const Graph* mid = nullptr, int switchAt = -1, juce::String* err = nullptr)
{
    juce::AudioBuffer<float> out = testSignal();
    Chain chain;
    chain.prepare (kSr, kBlock);
    Program prog; juce::String e;
    if (! compile (g, prog, e)) { if (err) *err = e; out.clear(); return out; }
    chain.publish (prog);
    NodeParams params[kMaxNodes];
    paramsFor (g, params);
    for (int blk = 0; blk < kBlocks; ++blk)
    {
        if (mid != nullptr && blk == switchAt)
        {
            Program p2; juce::String e2;
            if (! compile (*mid, p2, e2)) { if (err) *err = e2; }
            else { chain.publish (p2); paramsFor (*mid, params); }
        }
        float* ptrs[2] = { out.getWritePointer (0, blk * kBlock), out.getWritePointer (1, blk * kBlock) };
        juce::AudioBuffer<float> view (ptrs, 2, kBlock);
        float gr = 0.0f;
        chain.process (view, (float) kSr, params, gr);
    }
    return out;
}

static float maxDiff (const juce::AudioBuffer<float>& a, const juce::AudioBuffer<float>& b, int from = 0, int to = -1)
{
    if (to < 0) to = a.getNumSamples();
    float m = 0.0f;
    for (int ch = 0; ch < 2; ++ch)
        for (int i = from; i < to; ++i)
            m = juce::jmax (m, std::abs (a.getSample (ch, i) - b.getSample (ch, i)));
    return m;
}
static float peakOf (const juce::AudioBuffer<float>& a, int from, int to)
{
    float m = 0.0f;
    for (int ch = 0; ch < 2; ++ch)
        for (int i = from; i < to; ++i) m = juce::jmax (m, std::abs (a.getSample (ch, i)));
    return m;
}

static Graph::Node node (int id, int type, float amount, int variant = 0, bool wet = false)
{
    Graph::Node n; n.id = id; n.type = type; n.amount = amount; n.variant = variant; n.wet = wet; return n;
}

int main()
{
    const auto input = testSignal();
    std::printf ("orb fx engine — graph self-test\n");

    { // bare wire in → out
        Graph g; g.edges.push_back ({ kPortIn, kPortOut, 1.0f });
        CHECK (maxDiff (run (g), input) == 0.0f, "in → out is a straight wire");
    }
    { // unity gain node is bit-transparent (neutral early-out)
        Graph g; g.nodes.push_back (node (5, kGain, 0.75f));
        g.edges.push_back ({ kPortIn, 5, 1.0f }); g.edges.push_back ({ 5, kPortOut, 1.0f });
        CHECK (maxDiff (run (g), input) == 0.0f, "in → gain(unity) → out is transparent");
    }
    { // mult + mix: two halves of the same signal sum back to the signal
        Graph g; g.nodes.push_back (node (5, kGain, 0.75f)); g.nodes.push_back (node (8, kMixType, 0.0f));
        g.edges.push_back ({ kPortIn, 8, 0.5f });
        g.edges.push_back ({ kPortIn, 5, 1.0f }); g.edges.push_back ({ 5, 8, 0.5f });
        g.edges.push_back ({ 8, kPortOut, 1.0f });
        CHECK (maxDiff (run (g), input, kBlock) < 1.0e-6f, "mult → (dry ‖ gain) → mix 50/50 == input (after the one-block fade-in)");
    }
    { // three-way mult, thirds
        Graph g;
        g.nodes.push_back (node (1, kGain, 0.75f)); g.nodes.push_back (node (2, kGain, 0.75f)); g.nodes.push_back (node (9, kMixType, 0.0f));
        g.edges.push_back ({ kPortIn, 9, 1.0f / 3.0f });
        g.edges.push_back ({ kPortIn, 1, 1.0f }); g.edges.push_back ({ 1, 9, 1.0f / 3.0f });
        g.edges.push_back ({ kPortIn, 2, 1.0f }); g.edges.push_back ({ 2, 9, 1.0f / 3.0f });
        g.edges.push_back ({ 9, kPortOut, 1.0f });
        CHECK (maxDiff (run (g), input, kBlock) < 1.0e-5f, "three-way mult into a mix of thirds == input");
    }
    { // bus semantics: main at 100 + a send at 50 of the same dry = 1.5×
        Graph g; g.nodes.push_back (node (3, kGain, 0.75f)); g.nodes.push_back (node (9, kMixType, 0.0f));
        g.edges.push_back ({ kPortIn, 9, 1.0f });
        g.edges.push_back ({ kPortIn, 3, 1.0f }); g.edges.push_back ({ 3, 9, 0.5f });
        g.edges.push_back ({ 9, kPortOut, 1.0f });
        auto scaled = input; scaled.applyGain (1.5f);
        CHECK (maxDiff (run (g), scaled, kBlock) < 1.0e-5f, "bus: main 100 + send 50 layers to 1.5×");
    }
    { // wire gain on a serial wire
        Graph g; g.edges.push_back ({ kPortIn, kPortOut, 0.25f });
        auto scaled = input; scaled.applyGain (0.25f);
        CHECK (maxDiff (run (g), scaled, kBlock) < 1.0e-6f, "send level on the out wire scales the output");
        CHECK (std::abs (run (g).getSample (0, 0) - input.getSample (0, 0)) < 0.01f, "…starting from unity (a new wire never jumps)");
    }
    { // level drag: same shape republished → ramps inside one block, lands on target
        Graph g; g.edges.push_back ({ kPortIn, kPortOut, 1.0f });
        Graph g2 = g; g2.edges[0].gain = 0.5f;
        auto out = run (g, &g2, 10);
        const int s0 = 10 * kBlock;
        const float first = out.getSample (0, s0) / input.getSample (0, s0);
        const float lastR = out.getSample (0, s0 + kBlock - 1) / input.getSample (0, s0 + kBlock - 1);
        CHECK (std::abs (out.getSample (0, s0 - 1) - input.getSample (0, s0 - 1)) < 1e-6f, "before the drag: unity");
        CHECK (first > 0.99f && first <= 1.0f + 1e-6f, "drag ramps from the old level…");
        CHECK (std::abs (lastR - 0.5f) < 0.01f, "…and lands on the new one within the block");
        CHECK (std::abs (out.getSample (0, s0 + 2 * kBlock) - 0.5f * input.getSample (0, s0 + 2 * kBlock)) < 1e-6f, "after: exactly half");
    }
    { // wet solo: space at amount 0 with wet → silence (not a dry copy)
        Graph g; g.nodes.push_back (node (2, kSpace, 0.0f, 0, true));
        g.edges.push_back ({ kPortIn, 2, 1.0f }); g.edges.push_back ({ 2, kPortOut, 1.0f });
        CHECK (peakOf (run (g), 0, kBlock * kBlocks) == 0.0f, "wet space at zero is silent");
    }
    { // wet solo: dry gone before the room speaks; without wet the dry is there
        Graph wet; wet.nodes.push_back (node (2, kSpace, 0.6f, 0, true));
        wet.edges.push_back ({ kPortIn, 2, 1.0f }); wet.edges.push_back ({ 2, kPortOut, 1.0f });
        Graph dry = wet; dry.nodes[0].wet = false;
        const auto ow = run (wet), od = run (dry);
        CHECK (peakOf (ow, 0, 300) < 0.02f, "wet: the first 300 samples carry no dry");
        CHECK (peakOf (od, 0, 300) > 0.2f,  "dry: the source is there from sample 0");
        CHECK (peakOf (ow, 6000, kBlock * kBlocks) > 0.01f, "wet: the room does speak later");
    }
    { // serial order matters: tone → delay compiles to two in-place ops on the host buffer
        Graph g; g.nodes.push_back (node (0, kTone, 0.8f)); g.nodes.push_back (node (10, kDelay, 0.5f));
        g.edges.push_back ({ kPortIn, 0, 1.0f }); g.edges.push_back ({ 0, 10, 1.0f }); g.edges.push_back ({ 10, kPortOut, 1.0f });
        Program p; juce::String e; const bool ok = compile (g, p, e);
        CHECK (ok && p.numOps == 2 && p.ops[0].kind == Op::kProcess && p.ops[0].slot == 0 && p.ops[0].dst == 0
               && p.ops[1].kind == Op::kProcess && p.ops[1].slot == 10 && p.ops[1].dst == 0 && p.bypass == 0,
               "serial chain: two in-place process ops, zero copies");
    }
    { // dangling branch is ignored
        Graph g; g.nodes.push_back (node (5, kGain, 0.75f)); g.nodes.push_back (node (2, kSpace, 0.9f));
        g.edges.push_back ({ kPortIn, 5, 1.0f }); g.edges.push_back ({ 5, kPortOut, 1.0f });
        g.edges.push_back ({ kPortIn, 2, 1.0f });   // space goes nowhere
        CHECK (maxDiff (run (g), input) == 0.0f, "a branch that never reaches out is ignored");
    }
    { // nothing wired to out → bypass
        Graph g; g.nodes.push_back (node (5, kGain, 0.0f)); g.edges.push_back ({ kPortIn, 5, 1.0f });
        Program p; juce::String e; const bool ok = compile (g, p, e);
        CHECK (ok && p.bypass == 1, "no path to out compiles to bypass");
        CHECK (maxDiff (run (g), input) == 0.0f, "…and passes audio untouched");
    }
    { // feedback refused
        Graph g; g.nodes.push_back (node (1, kGain, 0.75f)); g.nodes.push_back (node (10, kDelay, 0.5f)); g.nodes.push_back (node (9, kMixType, 0.0f));
        g.edges.push_back ({ kPortIn, 9, 1.0f }); g.edges.push_back ({ 9, 1, 1.0f }); g.edges.push_back ({ 1, 10, 1.0f });
        g.edges.push_back ({ 10, 9, 0.5f });   // back into the mix — a loop
        g.edges.push_back ({ 1, kPortOut, 1.0f });
        Program p; juce::String e; const bool ok = compile (g, p, e);
        CHECK (! ok && e == "cycle", "a feedback loop is refused with 'cycle'");
    }
    { // only a mix takes fan-in
        Graph g; g.nodes.push_back (node (1, kGain, 0.75f)); g.nodes.push_back (node (2, kGain, 0.75f));
        g.edges.push_back ({ kPortIn, 1, 1.0f }); g.edges.push_back ({ kPortIn, 2, 1.0f }); g.edges.push_back ({ 1, 2, 1.0f });
        g.edges.push_back ({ 2, kPortOut, 1.0f });
        Program p; juce::String e; const bool ok = compile (g, p, e);
        CHECK (! ok, "two wires into a plain node are refused");
    }
    { // duplicate effects: two delays with different divisions both run
        Graph g; g.nodes.push_back (node (3, kDelay, 0.7f)); g.nodes.push_back (node (4, kDelay, 0.7f));
        g.nodes[0].delayDiv = 0; g.nodes[1].delayDiv = 6;
        g.edges.push_back ({ kPortIn, 3, 1.0f }); g.edges.push_back ({ 3, 4, 1.0f }); g.edges.push_back ({ 4, kPortOut, 1.0f });
        Graph one = g; one.nodes.pop_back(); one.edges.clear();
        one.edges.push_back ({ kPortIn, 3, 1.0f }); one.edges.push_back ({ 3, kPortOut, 1.0f });
        CHECK (maxDiff (run (g), run (one)) > 0.01f, "two delay nodes are two different delays");
    }
    { // re-typing a slot on adoption: slot 4 delay → slot 4 gain(unity) starts clean
        Graph a; a.nodes.push_back (node (4, kDelay, 0.7f)); a.edges.push_back ({ kPortIn, 4, 1.0f }); a.edges.push_back ({ 4, kPortOut, 1.0f });
        Graph b = a; b.nodes[0].type = kGain; b.nodes[0].amount = 0.75f;
        const auto switched = run (a, &b, 20);
        CHECK (maxDiff (switched, input, 0, 20 * kBlock) > 0.01f, "before the switch the delay is audible");
        CHECK (maxDiff (switched, input, 20 * kBlock) == 0.0f, "after the switch the slot is a fresh unity gain — transparent at once");
    }

    { // tremolo: square at full depth, 1/8 at 120 bpm = 250 ms cycle → the second half is silent
        Graph g; auto n = node (12, kTremolo, 1.0f, 2); n.delayDiv = 2; g.nodes.push_back (n);
        g.edges.push_back ({ kPortIn, 12, 1.0f }); g.edges.push_back ({ 12, kPortOut, 1.0f });
        const auto o = run (g);
        const int cyc = (int) (kSr * 0.25);   // 12000 samples
        // amount glides up over ~50 ms; look at the second cycle
        CHECK (peakOf (o, cyc + 200, cyc + cyc / 2 - 200) > 0.2f, "tremolo square: loud half is loud");
        CHECK (peakOf (o, cyc + cyc / 2 + 400, 2 * cyc - 200) < 0.02f, "tremolo square: quiet half is silent");
    }
    { // tremolo pan: full depth sine swings the balance
        Graph g; auto n = node (12, kTremolo, 1.0f, 0); n.aux[0] = 1; n.delayDiv = 4; g.nodes.push_back (n);
        g.edges.push_back ({ kPortIn, 12, 1.0f }); g.edges.push_back ({ 12, kPortOut, 1.0f });
        const auto o = run (g);
        float lmax = 0, rmax = 0;
        for (int i = 4000; i < 10000; ++i) { lmax = juce::jmax (lmax, std::abs (o.getSample (0, i))); rmax = juce::jmax (rmax, std::abs (o.getSample (1, i))); }
        CHECK (lmax > 0.3f && rmax > 0.2f, "tremolo pan: both sides get their turn");
    }
    { // arp at 1/16 (125 ms steps at 120): step 1 lands +12 st (up) or −12 st (down)
        Graph g; auto n = node (13, kArp, 0.5f, 0); n.aux[0] = 12; n.delayDiv = 0; g.nodes.push_back (n);   // range 12 st, step 12
        g.edges.push_back ({ kPortIn, 13, 1.0f }); g.edges.push_back ({ 13, kPortOut, 1.0f });
        auto zc = [] (const juce::AudioBuffer<float>& b, int from, int to) { int z = 0; for (int i = from + 1; i < to; ++i) if ((b.getSample (0, i) >= 0) != (b.getSample (0, i - 1) >= 0)) ++z; return z; };
        const int a = 7000, b = 10000;   // inside step 1 (6000..12000), past the grain latency
        const int base = zc (input, a, b);   // ≈ 55
        const auto up = run (g);
        Graph g2 = g; g2.nodes[0].variant = 1;
        const auto down = run (g2);
        CHECK (zc (up, a, b) > base * 1.7f && zc (up, a, b) < base * 2.3f,     "arp up: step 1 is an octave up");
        CHECK (zc (down, a, b) > base * 0.35f && zc (down, a, b) < base * 0.65f, "arp down: step 1 is an octave down");
        CHECK (zc (up, 1000, 5000) > base * 1.1f && zc (up, 1000, 5000) < base * 1.6f, "arp: step 0 leaves the pitch alone");
    }
    { // radio: full knob narrows the 440 Hz tone hard
        Graph g; g.nodes.push_back (node (14, kRadio, 1.0f, 0));
        g.edges.push_back ({ kPortIn, 14, 1.0f }); g.edges.push_back ({ 14, kPortOut, 1.0f });
        const auto o = run (g);
        CHECK (peakOf (o, 6000, 10000) < 0.25f && peakOf (o, 6000, 10000) > 0.01f, "radio: 440 Hz survives quietly through the band");
    }
    { // harmony chromatic +12: a second voice an octave up rides the dry
        Graph g; auto n = node (15, kHarmony, 1.0f, 1); n.aux[2] = 12; g.nodes.push_back (n);
        g.edges.push_back ({ kPortIn, 15, 1.0f }); g.edges.push_back ({ 15, kPortOut, 1.0f });
        const auto o = run (g);
        float e = 0; for (int i = 6000; i < 10000; ++i) e += o.getSample (0, i) * o.getSample (0, i);
        float ei = 0; for (int i = 6000; i < 10000; ++i) ei += input.getSample (0, i) * input.getSample (0, i);
        CHECK (e > ei * 1.3f, "harmony: the voice adds energy on top of the dry");
    }
    { // harmony in key: the tracker hears 440 (A) and C major a third above A is C (+3 st)
        Graph g; auto n = node (15, kHarmony, 1.0f, 0); n.aux[0] = 0; n.aux[1] = 0; n.aux[2] = 2; n.wet = true; g.nodes.push_back (n);
        g.edges.push_back ({ kPortIn, 15, 1.0f }); g.edges.push_back ({ 15, kPortOut, 1.0f });
        const auto o = run (g);
        auto zc = [] (const juce::AudioBuffer<float>& b, int from, int to) { int z = 0; for (int i = from + 1; i < to; ++i) if ((b.getSample (0, i) >= 0) != (b.getSample (0, i - 1) >= 0)) ++z; return z; };
        const int z = zc (o, 6000, 10000), zi = zc (input, 6000, 10000);   // 440 → 523 Hz: ×1.19
        CHECK (z > zi * 1.12f && z < zi * 1.27f, "harmony in C major: A gets its C above (+3 st)");
    }

    { // pitch: +12 st doubles the crossings, and stays clean (no wild peaks)
        Graph g; auto pn = node (3, kPitch, 1.0f, 0); pn.aux[1] = 1; g.nodes.push_back (pn);   // raw, +12, live engine (short latency for the window)
        g.edges.push_back ({ kPortIn, 3, 1.0f }); g.edges.push_back ({ 3, kPortOut, 1.0f });
        const auto o = run (g);
        auto zc = [] (const juce::AudioBuffer<float>& b, int from, int to) { int z = 0; for (int i = from + 1; i < to; ++i) if ((b.getSample (0, i) >= 0) != (b.getSample (0, i - 1) >= 0)) ++z; return z; };
        const int a = 6000, b = 10000;
        const int base = zc (input, a, b);
        const int up = zc (o, a, b);
        std::printf ("    [pitch] base %d up %d peak %.3f\n", base, up, peakOf (o, a, b));
        CHECK (up > base * 1.6f && up < base * 2.4f, "pitch +12: an octave up");
        CHECK (peakOf (o, a, b) < 1.0f && peakOf (o, a, b) > 0.15f, "pitch: sane level");
    }
    { // formant at the middle is transparent-ish; shifted it still passes signal
        Graph g; auto fn = node (4, kFormant, 0.85f, 0); fn.aux[0] = 1; g.nodes.push_back (fn);
        g.edges.push_back ({ kPortIn, 4, 1.0f }); g.edges.push_back ({ 4, kPortOut, 1.0f });
        const auto o = run (g);
        CHECK (peakOf (o, 6000, 10000) > 0.1f, "formant: signal passes");
        Graph m = g; m.nodes[0].amount = 0.5f;
        std::printf ("    [formant] mid diff %.4f\n", maxDiff (run (m), input));
        CHECK (maxDiff (run (m), input) == 0.0f, "formant at the middle: untouched");
    }
    { // voice: female raises the pitch
        Graph g; g.nodes.push_back (node (5, kVoice, 1.0f, 0));
        g.edges.push_back ({ kPortIn, 5, 1.0f }); g.edges.push_back ({ 5, kPortOut, 1.0f });
        const auto o = run (g);
        auto zc = [] (const juce::AudioBuffer<float>& b, int from, int to) { int z = 0; for (int i = from + 1; i < to; ++i) if ((b.getSample (0, i) >= 0) != (b.getSample (0, i - 1) >= 0)) ++z; return z; };
        const int base = zc (input, 6000, 10000), up = zc (o, 6000, 10000);
        std::printf ("    [voice] base %d female %d\n", base, up);
        CHECK (up > base * 1.15f && up < base * 1.6f, "voice female: +5 st (≈ ×1.33 crossings)");
    }
    { // grain: adds a cloud on top of the dry, never explodes
        Graph g; auto n = node (6, kGrain, 0.8f, 0); n.aux[0] = 60; n.aux[1] = 200; n.aux[2] = 0; g.nodes.push_back (n);
        g.edges.push_back ({ kPortIn, 6, 1.0f }); g.edges.push_back ({ 6, kPortOut, 1.0f });
        const auto o = run (g);
        CHECK (peakOf (o, 4000, 10000) > 0.1f && peakOf (o, 4000, 10000) < 1.5f, "grain: a cloud, sane level");
        CHECK (maxDiff (o, input, 4000, 10000) > 0.02f, "grain: it did something");
    }

    { // branch alignment: dry ‖ (pitch at rest, raw) into a mix — the compiler delays the dry
        static int lat[kNumFx] {}; lat[kPitch] = 1000;
        auto latFn = [] (const Graph::Node& nd, const void*) { return lat[nd.type]; };
        Graph g; g.nodes.push_back (node (3, kPitch, 0.5f, 1)); g.nodes.push_back (node (9, kMixType, 0.0f));
        g.nodes[0].aux[0] = 1;   // one cent: keeps the shifter running instead of the neutral early-out
        g.edges.push_back ({ kPortIn, 9, 0.5f }); g.edges.push_back ({ kPortIn, 3, 1.0f }); g.edges.push_back ({ 3, 9, 0.5f }); g.edges.push_back ({ 9, kPortOut, 1.0f });
        Program p; juce::String e; const bool ok = compile (g, p, e, latFn, nullptr);
        int delays = 0, delaySamples = 0;
        for (int i = 0; i < p.numOps; ++i) if (p.ops[i].kind == Op::kDelay) { ++delays; delaySamples = p.ops[i].samples; }
        CHECK (ok && delays == 1 && delaySamples == 1000, "a dry branch beside a latent one is held back by its latency");
        CHECK (ok && p.latency == 1000, "the patch reports the path's latency to out");
        Graph s; s.nodes.push_back (node (3, kPitch, 0.5f, 1)); s.nodes.push_back (node (4, kPitch, 0.5f, 1));
        s.edges.push_back ({ kPortIn, 3, 1.0f }); s.edges.push_back ({ 3, 4, 1.0f }); s.edges.push_back ({ 4, kPortOut, 1.0f });
        Program p2; CHECK (compile (s, p2, e, latFn, nullptr) && p2.latency == 2000, "two shifters in series: latencies add");
    }
    { // the delay op really delays: in → mix(50) ‖ in → gain → mix(50) with a fake 100-sample gain latency
        static int lat2[kNumFx] {}; lat2[kGain] = 100;
        auto latFn2 = [] (const Graph::Node& nd, const void*) { return lat2[nd.type]; };
        Graph g; g.nodes.push_back (node (5, kGain, 0.75f)); g.nodes.push_back (node (9, kMixType, 0.0f));
        g.edges.push_back ({ kPortIn, 9, 0.5f }); g.edges.push_back ({ kPortIn, 5, 1.0f }); g.edges.push_back ({ 5, 9, 0.5f }); g.edges.push_back ({ 9, kPortOut, 1.0f });
        // run by hand with the latency table
        juce::AudioBuffer<float> out = testSignal();
        Chain chain; chain.prepare (kSr, kBlock);
        Program p; juce::String e; CHECK (compile (g, p, e, latFn2, nullptr), "compiles with a delayed dry");
        chain.publish (p);
        NodeParams params[kMaxNodes]; paramsFor (g, params);
        for (int blk = 0; blk < kBlocks; ++blk)
        {
            float* ptrs[2] = { out.getWritePointer (0, blk * kBlock), out.getWritePointer (1, blk * kBlock) };
            juce::AudioBuffer<float> view (ptrs, 2, kBlock); float gr = 0; chain.process (view, (float) kSr, params, gr);
        }
        // gain(unity) has no real latency, so the "aligned" dry is 100 samples late: output = 0.5·x[n] + 0.5·x[n−100]
        float err = 0;
        for (int i = 2000; i < 6000; ++i) err = juce::jmax (err, std::abs (out.getSample (0, i) - 0.5f * (input.getSample (0, i) + input.getSample (0, i - 100))));
        CHECK (err < 1e-4f, "the delay op holds the branch back by exactly its samples");
    }

    { // stereo is bipolar: the middle is identity, −100 folds to mono
        const auto src = testSignal();
        Graph g; g.nodes.push_back (node (2, kStereoize, 0.5f));
        g.edges.push_back ({ kPortIn, 2, 1.0f }); g.edges.push_back ({ 2, kPortOut, 1.0f });
        const auto o = run (g);
        float diff = 0.0f;
        for (int i = 0; i < o.getNumSamples(); ++i) diff = std::max (diff, std::abs (o.getSample (0, i) - src.getSample (0, i)));
        std::printf ("    [stereo] mid diff %.5f\n", diff);
        CHECK (diff < 1.0e-4f, "stereo at the middle leaves the signal alone");
        g.nodes[0].amount = 0.0f;
        const auto m = run (g);
        float lr = 0.0f, energy = 0.0f;
        for (int i = m.getNumSamples() * 7 / 8; i < m.getNumSamples(); ++i) { lr = std::max (lr, std::abs (m.getSample (0, i) - m.getSample (1, i))); energy = std::max (energy, std::abs (m.getSample (0, i))); }   // after the 50 ms glide
        std::printf ("    [stereo] mono lr %.5f energy %.3f\n", lr, energy);
        CHECK (lr < 5.0e-3f && energy > 0.01f, "stereo at −100 is mono, not silence");
    }

    { // grain in key: runs, panned, frozen — sane; crush: fewer distinct values
        Graph g; auto n = node (6, kGrain, 0.8f, 0); n.aux[0] = 60; n.aux[1] = 200; n.aux[2] = 7; n.aux[3] = 0; n.aux[4] = 0; n.aux[5] = 80; n.aux[6] = 0; g.nodes.push_back (n);
        g.edges.push_back ({ kPortIn, 6, 1.0f }); g.edges.push_back ({ 6, kPortOut, 1.0f });
        const auto o = run (g);
        CHECK (peakOf (o, 4000, 10000) > 0.1f && peakOf (o, 4000, 10000) < 1.5f, "grain in key with pan spread: sane level");
        Graph fz = g; fz.nodes[0].aux[7] = 1;
        CHECK (peakOf (run (fz), 4000, 10000) < 1.5f, "grain frozen: sane");
        Graph c; c.nodes.push_back (node (7, kCrush, 0.9f, 2));
        c.edges.push_back ({ kPortIn, 7, 1.0f }); c.edges.push_back ({ 7, kPortOut, 1.0f });
        const auto oc = run (c);
        std::set<int> vals; for (int i = 6000; i < 10000; ++i) vals.insert ((int) std::lround (oc.getSample (0, i) * 10000));
        std::set<int> valsIn; for (int i = 6000; i < 10000; ++i) valsIn.insert ((int) std::lround (input.getSample (0, i) * 10000));
        std::printf ("    [crush] distinct in %zu out %zu\n", valsIn.size(), vals.size());
        CHECK (vals.size() < valsIn.size() / 4, "crush: far fewer distinct values");
    }

    { // the seven new prints: each runs sane and does its one thing
        auto one = [&] (int type, float amount, int variant = 0) { Graph g; g.nodes.push_back (node (2, type, amount, variant)); g.edges.push_back ({ kPortIn, 2, 1.0f }); g.edges.push_back ({ 2, kPortOut, 1.0f }); return g; };
        const int N = kBlock * kBlocks;
        auto energy = [] (const juce::AudioBuffer<float>& b, int from, int to) { double s = 0; for (int i = from; i < to; ++i) s += (double) b.getSample (0, i) * b.getSample (0, i); return s; };
        auto hfEnergy = [] (const juce::AudioBuffer<float>& b, int from, int to) { double s = 0; for (int i = from + 1; i < to; ++i) { const double d = b.getSample (0, i) - b.getSample (0, i - 1); s += d * d; } return s; };
        auto finite = [] (const juce::AudioBuffer<float>& b) { for (int c = 0; c < 2; ++c) for (int i = 0; i < b.getNumSamples(); ++i) if (! std::isfinite (b.getSample (c, i))) return false; return true; };

        const auto sh = run (one (kShimmer, 0.8f));
        CHECK (finite (sh) && peakOf (sh, 4000, N) > 0.1f && peakOf (sh, 0, N) < 2.0f, "shimmer: sane, passes signal");
        Graph shw = one (kShimmer, 0.8f); shw.nodes[0].wet = true;
        const auto shwO = run (shw);
        Graph sh0 = one (kShimmer, 0.0f); sh0.nodes[0].wet = true;
        CHECK (finite (shwO) && energy (shwO, 8000, N) > 0.0 && peakOf (run (sh0), 0, N) == 0.0f, "shimmer wet solo: the tail alone, silent at zero");

        const auto sw = run (one (kSwell, 1.0f, 1));
        const double swHead = energy (sw, 0, 3000), inHead = energy (input, 0, 3000);
        std::printf ("    [swell] head energy in %.3f out %.3f\n", inHead, swHead);
        CHECK (finite (sw) && swHead < inHead * 0.3, "swell hard: the first onset is swallowed");

        const auto st = run (one (kStutter, 0.9f));
        const int len = (int) std::lround (0.0625 * 60.0 / 120.0 * kSr);
        float rep = 0.0f;
        for (int i = 7600; i < N; ++i) rep = std::max (rep, std::abs (st.getSample (0, i) - st.getSample (0, i - len)));   // the knob has settled by ~5000 samples
        std::printf ("    [stutter] slice %d repeat err %.5f\n", len, rep);
        CHECK (finite (st) && rep < 1.0e-4f && peakOf (st, 7600, N) > 0.05f, "stutter at 1/64: the slice repeats exactly");

        const auto air = run (one (kAir, 1.0f, 0));
        const double hfIn = hfEnergy (input, 4000, N), hfOut = hfEnergy (air, 4000, N);
        std::printf ("    [air] hf energy in %.4f out %.4f\n", hfIn, hfOut);
        CHECK (finite (air) && hfOut > hfIn * 1.05 && peakOf (air, 4000, N) < 1.5f, "air: more high-frequency energy, sane level");

        const auto ring = run (one (kRing, 0.5f, 0));
        float rdiff = 0.0f; for (int i = 4000; i < N; ++i) rdiff = std::max (rdiff, std::abs (ring.getSample (0, i) - input.getSample (0, i)));
        CHECK (finite (ring) && rdiff > 0.2f && peakOf (ring, 4000, N) < 1.0f, "ring at 320 Hz: a different signal, sane level");

        Graph gg = one (kGate, 1.0f, 0); gg.nodes[0].delayDiv = 0;   // 1/16 note per cycle: open half, shut half
        const auto gt = run (gg);
        const int half = (int) (0.25 * 60.0 / 120.0 * kSr / 2);
        const float shut = peakOf (gt, 3 * half + 300, std::min (N, 4 * half - 100)), open = peakOf (gt, 2 * half + 200, 3 * half - 100);   // second cycle: the depth has settled
        std::printf ("    [gate] open %.3f shut %.4f\n", open, shut);
        CHECK (finite (gt) && shut < 0.05f && open > 0.2f, "gate: shut half is silent, open half passes");

        const auto wow = run (one (kWow, 1.0f, 2));
        float wdiff = 0.0f; for (int i = 4000; i < N; ++i) wdiff = std::max (wdiff, std::abs (wow.getSample (0, i) - input.getSample (0, i)));
        CHECK (finite (wow) && wdiff > 0.05f && peakOf (wow, 4000, N) > 0.2f && peakOf (wow, 4000, N) < 1.0f, "wow: sways the signal, sane level");
    }

    std::printf (failures == 0 ? "\nall green\n" : "\n%d failure(s)\n", failures);
    return failures == 0 ? 0 : 1;
}
