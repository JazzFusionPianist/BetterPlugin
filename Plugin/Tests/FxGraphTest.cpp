// Orb FX engine self-test: the patchable wall's wiring semantics.
// Build: cmake --build build --config Debug --target FxGraphTest
#include "FxEngine.h"
#include <cstdio>
#include <cmath>

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

    std::printf (failures == 0 ? "\nall green\n" : "\n%d failure(s)\n", failures);
    return failures == 0 ? 0 : 1;
}
