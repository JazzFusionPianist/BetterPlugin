#pragma once
#include <juce_audio_basics/juce_audio_basics.h>
#include <array>
#include <atomic>
#include <vector>

/*  Orb one-knob FX engine — the patchable wall.

    Eleven single-parameter effects, each living in its own NodeState, so
    a patch can hold any number of them in any order. A Graph (nodes +
    wires, drawn by the UI) is COMPILED on the message thread into a
    Program: a flat list of buffer ops — process this node in place,
    copy at a fan-out, scale/accumulate into a mix — over a small pool of
    block buffers. The audio thread adopts a pending Program with a
    try-lock (never blocks, never sees a half-written list) and runs it.

    Console model: a node's output can be MULTed to several wires; every
    wire carries a send level; a `mix` node sums whatever lands on it;
    `wet` on a time-based node drops its dry component (Wet Solo).
    Feedback is refused at compile time (v1 rule).                        */

namespace orbfx {

enum Type { kTone = 0, kTape, kSpace, kStereoize, kGlue, kGain, kMod,
            kCut, kAmp, kDoubler, kDelay,
            kMixSlot = 11,          // reserved: the graph-only mix node
            kTremolo = 12, kArp, kRadio, kHarmony,
            kNumFx = 16, kNone = -1 };
/** A graph-only node: sums its inputs (per-wire gain), no DSP state. */
constexpr int kMixType = kMixSlot;
constexpr int kCurveLen = 32;       // a drawn tremolo cycle
inline bool isEffect (int t) noexcept { return t >= 0 && t < kNumFx && t != kMixSlot; }

constexpr int kMaxNodes   = 16;
constexpr int kMaxEdges   = 48;
constexpr int kMaxOps     = 160;
constexpr int kMaxBuffers = 32;    // 0 = the host buffer, 1.. = the pool

/** Wire endpoints that are not nodes. */
constexpr int kPortIn  = -1;
constexpr int kPortOut = -2;

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
    int   delayDiv = 2;      // beat division index: delay time, tremolo/arp rate
    float delayFb  = 0.35f;  // delay: feedback
    bool  wet      = false;  // space/delay/doubler/mod: drop the dry (Wet Solo)
    int   aux[3]   { 0, 0, 0 };   // tremolo: [vol|pan]; arp: [interval st]; harmony: [key, scale, degrees]
    bool  hasCurve = false;  // tremolo: a drawn cycle overrides the shape
    float curve[kCurveLen] {};
    float bpm      = 120.0f;
    double ppq     = 0.0;    // host position at block start (quarter notes)
    bool  playing  = false;  // transport rolling → tempo-synced things lock to ppq
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

/** One effect's complete audio-thread state. Every line is allocated
 *  once in prepare() (for any type), so re-typing a slot is allocation
 *  free and can happen on the audio thread when a Program is adopted. */
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
    // tremolo
    float tremPhase = 0.0f;       // free-running cycle position 0..1
    float tremGainSm[2] { 1.0f, 1.0f };
    // pitch shifter (arp, harmony): two crossfading grains on a ring
    std::vector<float> psBuf[2];
    int   psWrite = 0;
    float psPhase = 0.0f;
    float psRatioSm = 1.0f;
    // arp
    int   arpStep = -1;
    double arpFreeBeat = 0.0;     // beats elapsed while the transport is stopped
    // harmony: pitch tracker
    std::vector<float> pdBuf;
    int   pdWrite = 0;
    int   pdCountdown = 0;
    float pdNote = -1.0f;         // last detected MIDI note (fractional), <0 = none
    float harmShiftSm = 0.0f;     // semitones, glided
    // radio
    Biquad radioBp[2][2];
    float radioBakedA = -1.0f;
    float radioNoiseLp[2] {};
    float radioHum = 0.0f;
    unsigned radioRng = 0x9E3779B9u;

    /** Allocate every line this slot could ever need. Message thread. */
    void prepare (double sampleRate);
    /** Clear tails and glide the amount back up from neutral. Audio thread. */
    void reset();
    /** Run one block in place. `scratch` is a shared stereo work buffer. */
    void process (const NodeParams& p, float sr, int n, float* L, float* R,
                  juce::AudioBuffer<float>& scratch);
};

//==============================================================================
/** The patch as the UI draws it. Node ids double as engine slots. */
struct Graph
{
    struct Node
    {
        int   id       = 0;      // 0..kMaxNodes-1, unique
        int   type     = kNone;  // Type or kMixType
        float amount   = 0.0f;
        int   variant  = 0;
        float decay[3] { 0.5f, 0.5f, 0.5f };
        int   delayDiv = 2;
        float delayFb  = 0.35f;
        bool  wet      = false;
        int   aux[3]   { 0, 0, 0 };
        bool  hasCurve = false;
        float curve[kCurveLen] {};
        float x = 0.0f, y = 0.0f;   // wall position — the engine ignores it
    };
    struct Edge
    {
        int   from = kPortIn;    // node id, or kPortIn
        int   to   = kPortOut;   // node id, or kPortOut
        float gain = 1.0f;       // send level
    };
    std::vector<Node> nodes;
    std::vector<Edge> edges;
};

/** One compiled step. Buffers are pool indices (0 = host). */
struct Op
{
    enum Kind : int { kCopy = 0,   // dst = src
                      kGain,       // dst *= gain
                      kScale,      // dst = gain * src
                      kAccum,      // dst += gain * src
                      kProcess };  // node `slot` (typed `type`) in place on dst
    int   kind = kCopy;
    int   slot = -1;
    int   type = kNone;
    int   dst  = 0;
    int   src  = 0;
    float gain = 1.0f;
};

struct Program
{
    int numOps = 0;
    Op  ops[kMaxOps];
    int bypass = 1;   // 1 = nothing wired to out → audio passes untouched
};

/** Validate + compile. On failure `error` says why (e.g. "cycle") and
 *  `out` is untouched. Message thread. */
bool compile (const Graph& g, Program& out, juce::String& error);

//==============================================================================
class Chain
{
public:
    void prepare (double sampleRate, int blockSize);

    /** Message thread: hand the audio thread a new Program (adopted at
     *  the next block boundary; never blocks audio). */
    void publish (const Program& p);

    /** Audio thread: run the current Program. `params` is indexed by
     *  slot; `grDbOut` reports glue's reduction (max over glue nodes). */
    void process (juce::AudioBuffer<float>& buffer, float sampleRate,
                  const NodeParams* params, float& grDbOut);

    /** UI meters: block peak per slot (0 when the slot isn't running). */
    float nodePeak (int slot) const noexcept
    {
        return slot >= 0 && slot < kMaxNodes ? peaks[(size_t) slot].load (std::memory_order_relaxed) : 0.0f;
    }

private:
    void adoptPending();
    void runOp (const Op& op, int opIndex, float sampleRate, int n, int nc,
                const NodeParams* params);
    float* chan (int buf, int ch, int n);

    std::array<NodeState, kMaxNodes> nodes;
    std::array<std::atomic<float>, kMaxNodes> peaks {};
    juce::AudioBuffer<float> scratch { 2, 2048 };
    std::vector<juce::AudioBuffer<float>> pool;   // indices 1..kMaxBuffers-1
    juce::AudioBuffer<float>* host = nullptr;     // buffer 0, per block
    double srHz = 44100.0;

    // message → audio hand-off
    juce::SpinLock      pendingLock;
    Program             pending;
    std::atomic<bool>   pendingFlag { false };

    // audio-thread state
    Program active;
    float   gainSm[kMaxOps] {};   // smoothed op gains (click-free level drags)
};

} // namespace orbfx
