#pragma once
#include <juce_audio_basics/juce_audio_basics.h>
#include <array>
#include <atomic>
#include <vector>

/*  Orb one-knob FX engine.

    Eleven single-parameter effects, each living in its own NodeState so
    a patch can hold any number of them in any order — two delays, two
    spaces, whatever the wall says. Chain runs a Schedule (an ordered
    list of node slots) on the audio thread; the message thread builds a
    new Schedule and publishes it through a seqlock, so editing the patch
    never blocks audio and audio never sees a half-written list.

    Phase 0 (2026-09-11): serial only, slots 0..kNumFx-1 pre-bound one
    per effect (slot == type). The graph (parallel branches, mix nodes,
    free-typed slots) lands on top of this without touching the DSP.  */

namespace orbfx {

enum Type { kTone = 0, kTape, kSpace, kStereoize, kGlue, kGain, kMod,
            kCut, kAmp, kDoubler, kDelay, kNumFx, kNone = -1 };

constexpr int kMaxNodes = 16;

/** Where each effect rests: tone is bipolar around 0.5, gain is a fader
 *  with unity at 0.75, everything else is off at 0. */
inline float neutralAmount (int type) noexcept
{
    return type == kGain ? 0.75f : type == kTone ? 0.5f : 0.0f;
}

/** Per-block parameter snapshot for one node (plain values — the
 *  processor reads its atomics once at the top of the block). */
struct NodeParams
{
    float amount   = 0.0f;
    int   variant  = 0;
    float decay    = 0.5f;   // space: this flavour's decay
    int   delayDiv = 2;      // delay: beat division index
    float delayFb  = 0.35f;  // delay: feedback
    float bpm      = 120.0f;
};

struct Biquad
{
    float b0 = 1, b1 = 0, b2 = 0, a1 = 0, a2 = 0, x1 = 0, x2 = 0, y1 = 0, y2 = 0;
    inline float run (float x) noexcept
    {
        const float y = b0 * x + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2;
        x2 = x1; x1 = x; y2 = y1; y1 = y; return y;
    }
};

/** One effect's complete audio-thread state. */
struct NodeState
{
    int   type    = kNone;
    float amtSm   = 0.0f;   // smoothed amount
    int   lastVar = 0;      // variant seen last block (for light-touch rebakes)
    float grDb    = 0.0f;   // glue: current gain reduction (UI meter)

    // tone
    float tiltApplied = 999.0f;
    Biquad tiltLow[2], tiltHigh[2];
    // tape
    float tapeLpState[2] { 0, 0 };
    float cleanXoState[2] { 0, 0 };
    float cleanXoState2[2] { 0, 0 };
    Biquad cleanShelf[2];
    float cleanShelfBaked = -1.0f;
    // space
    juce::Reverb fxReverb;
    float sendHpState[2] { 0, 0 };
    // stereo
    float apState[4][2] { {0,0},{0,0},{0,0},{0,0} };
    float sideHpState = 0.0f, sideHpState2 = 0.0f;
    float stEnvM = 0.0f, stEnvS = 0.0f;
    // glue
    float glueEnv = 0.0f;
    // gain
    float gainPrev[2] { 1.0f, 1.0f };
    bool  gainPrimed = false;
    // mod
    float modLfoPhase = 0.0f;
    std::vector<float> modDl[2];
    int   modWrite = 0;
    float phX1[6][2] {}, phY1[6][2] {};
    float phFb[2] { 0.0f, 0.0f };
    // cut
    Biquad cutBqHp[2], cutBqLp[2], cutBqHp2[2], cutBqLp2[2];
    bool  cutUseHp = false, cutUseLp = false;
    float cutBakedA = -1.0f;
    int   cutBakedVar = -1;
    // amp
    float ampHpState[2] {}, ampDcState[2] {}, ampLpState[2] {};
    float ampLp2State[2] {}, ampMidLo[2] {}, ampMidHi[2] {}, ampEnv[2] {};
    float ampStageHp[2] {};
    float ampInEnv[2] {}, ampOutEnv[2] {}, ampMakeup[2] { 1.0f, 1.0f };
    // doubler
    std::vector<float> dblDl[2];
    int   dblWrite = 0;
    float dblLfoPhase = 0.0f;
    // delay
    std::vector<float> dlyBuf[2];
    int   dlyWrite = 0;
    float dlySmSamp = -1.0f;
    float dlyFbLp[2] {};

    /** Bind this node to an effect and allocate its lines. Message thread. */
    void prepare (int type, double sampleRate);
    /** Clear tails and glide the amount back up from neutral. Audio thread. */
    void reset();
    /** Run one block in place. `scratch` is a shared stereo work buffer. */
    void process (const NodeParams& p, float sr, int n, float* L, float* R,
                  juce::AudioBuffer<float>& scratch);
};

/** An ordered list of node slots to run, in series. */
struct Schedule
{
    int count = 0;
    int slot[kMaxNodes] {};
};

class Chain
{
public:
    void prepare (double sampleRate, int blockSize);

    /** Message thread: (re)bind a slot to an effect (allocates). */
    void setNodeType (int slot, int type);
    /** Message thread: swap in a new schedule, lock-free for audio. */
    void publish (const Schedule& s);

    /** Audio thread: run the published schedule over the buffer.
     *  `params` is indexed by slot; `grDbOut` reports glue's reduction. */
    void process (juce::AudioBuffer<float>& buffer, float sampleRate,
                  const NodeParams* params, float& grDbOut);

    int nodeType (int slot) const noexcept
    {
        return slot >= 0 && slot < kMaxNodes ? nodes[(size_t) slot].type : kNone;
    }

private:
    Schedule current() const;   // seqlock reader

    std::array<NodeState, kMaxNodes> nodes;
    juce::AudioBuffer<float> scratch { 2, 2048 };
    double sr = 44100.0;

    struct SharedSchedule
    {
        std::atomic<int> count { 0 };
        std::atomic<int> slot[kMaxNodes] {};
    } shared;
    std::atomic<unsigned> seq { 0 };
    juce::SpinLock writeLock;

    Schedule last;   // audio thread: what ran last block (add-detection)
};

} // namespace orbfx
