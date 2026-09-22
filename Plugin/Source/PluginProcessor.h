#pragma once
#include "TrackExportBridge.h"
#include <juce_audio_processors/juce_audio_processors.h>
#include <juce_gui_extra/juce_gui_extra.h>
#include "VideoCapture.h"
#include "OrbControlBridge.h"
#include "FxEngine.h"
#include <array>
#include <atomic>
#include <functional>
#include <memory>
#include <vector>

//==============================================================================
/**
 * Orb Plugin Processor
 *
 * Pure pass-through audio plugin. Owns the embedded WKWebView
 * (juce::WebBrowserComponent) so the live broadcast survives plugin-window
 * close/reopen — WKWebView keeps running JS (and its WebRTC peer
 * connections) even while detached from a parent window.
 *
 * The processor also owns:
 *   • The audio capture ring buffer (written from processBlock).
 *   • The timer that polls that buffer and forwards samples to JS.
 *   • All native-function handlers registered on the WebBrowserComponent
 *     (prefetch, drag, write-audio, etc.) — they used to live on the editor.
 */
/** The hands as the host sees them: twelve per slot, named after the
 *  print that sits there ("delay feedback"), or "print N …" while the
 *  slot is empty. Names follow the wall; the host is told when they change. */
class SlotFloatParam final : public juce::AudioParameterFloat
{
public:
    SlotFloatParam (const juce::String& id, const juce::String& name, float def = 0.0f)
        : juce::AudioParameterFloat (juce::ParameterID (id, 1), name, juce::NormalisableRange<float> (0.0f, 1.0f), def), dynName (name) {}
    juce::String getName (int max) const override { return dynName.substring (0, max); }
    juce::String getText (float v, int max) const override { return (text ? text (v) : juce::String (convertFrom0to1 (v), 2)).substring (0, max); }
    juce::String dynName;
    std::function<juce::String (float)> text;   // a normalised value's word (an aux hand shows its own units)
};
class SlotIntParam final : public juce::AudioParameterInt
{
public:
    SlotIntParam (const juce::String& id, const juce::String& name, int lo, int hi, int def)
        : juce::AudioParameterInt (juce::ParameterID (id, 1), name, lo, hi, def), dynName (name) {}
    juce::String getName (int max) const override { return dynName.substring (0, max); }
    juce::String getText (float v, int max) const override { const int i = (int) std::lround (convertFrom0to1 (v)); return (text ? text (i) : juce::String (i)).substring (0, max); }
    juce::String dynName;
    std::function<juce::String (int)> text;
};
class SlotBoolParam final : public juce::AudioParameterBool
{
public:
    SlotBoolParam (const juce::String& id, const juce::String& name)
        : juce::AudioParameterBool (juce::ParameterID (id, 1), name, false), dynName (name) {}
    juce::String getName (int max) const override { return dynName.substring (0, max); }
    juce::String dynName;
};

class OrbAudioProcessor final : public juce::AudioProcessor,
                                  private juce::Timer
{
public:
    OrbAudioProcessor();
    ~OrbAudioProcessor() override;

    //── Playback ──────────────────────────────────────────────────────────────
    void prepareToPlay (double sampleRate, int samplesPerBlock) override;
    void releaseResources() override;
    bool isBusesLayoutSupported (const BusesLayout& layouts) const override;
    void processBlock (juce::AudioBuffer<float>&, juce::MidiBuffer&) override;

    //── Editor ────────────────────────────────────────────────────────────────
    juce::AudioProcessorEditor* createEditor() override;
    bool hasEditor() const override { return true; }

    //── Identity ──────────────────────────────────────────────────────────────
    const juce::String getName() const override { return JucePlugin_Name; }
    bool acceptsMidi() const override  { return false; }
    bool producesMidi() const override { return false; }
    bool isMidiEffect() const override { return false; }
    double getTailLengthSeconds() const override { return 0.0; }

    //── Programs ──────────────────────────────────────────────────────────────
    int  getNumPrograms() override                              { return 1; }
    int  getCurrentProgram() override                           { return 0; }
    void setCurrentProgram (int) override                       {}
    const juce::String getProgramName (int) override            { return {}; }
    void changeProgramName (int, const juce::String&) override  {}

    //── State ─────────────────────────────────────────────────────────────────
    void getStateInformation (juce::MemoryBlock&) override;
    void setStateInformation (const void*, int) override;

    //── Persistent WebView (used by editor when it's alive) ──────────────────
    juce::WebBrowserComponent* getBrowser() noexcept { return browser.get(); }

    //── Drag state accessors (DragMonitor lives in editor) ───────────────────
    juce::File getPendingDragFile() const noexcept { return pendingDragFile; }
    void setPendingDragFile (const juce::File& f)  { pendingDragFile = f; }
    bool isDragArmed() const noexcept { return dragArmed; }
    void setDragArmed (bool a) noexcept { dragArmed = a; }
    std::shared_ptr<juce::WebBrowserComponent::NativeFunctionCompletion>
        takePendingDragCompletion() { auto p = pendingDragComp; pendingDragComp.reset(); return p; }

    //── Editor resize callback ───────────────────────────────────────────────
    // Editor registers a "set me to size W,H" callback at construction. The
    // setPluginSize native function (called from JS Expand View) invokes it.
    using ResizeFn = std::function<void(int /*w*/, int /*h*/)>;
    void setEditorResizeFn (ResizeFn fn) { editorResizeFn = std::move(fn); }

    // Last editor size, persisted with the plugin state so the window
    // reopens where the user dragged it. 0 = never resized.
    std::atomic<int> editorW { 0 }, editorH { 0 };
    void requestEditorResize (int w, int h)
    {
        if (editorResizeFn) editorResizeFn (w, h);
    }

private:
    TrackExportBridge trackExportBridge;
    //── Capture ring buffer ───────────────────────────────────────────────────
    static constexpr int kCaptureBufferSize = 96000;
    juce::AbstractFifo    captureFifo { kCaptureBufferSize };
    juce::AudioBuffer<float> captureBuffer { 2, kCaptureBufferSize };
    std::atomic<int>      captureSampleRate  { 0 };
    std::atomic<int>      captureNumChannels { 0 };
    // The scope's second tap: what the plugin HEARS, before the patch.
    // Only filled while the wall asks for it (setScopeInput).
    juce::AbstractFifo    inputFifo { kCaptureBufferSize };
    juce::AudioBuffer<float> inputBuffer { 2, kCaptureBufferSize };
    std::atomic<bool>     scopeInputWanted { false };
    std::vector<float>    inputPollBuffer;
    int readInputAudio (float* dest, int maxFrames);

    //── Playhead snapshot ─────────────────────────────────────────────────────
    // Read on the audio thread in processBlock (the only place getPlayHead()
    // is valid), published via atomics, and attached to every __juceDawAudio
    // event so the web side can gate bar-range capture on musical position.
    // ppqPosition is reported by virtually every DAW, which keeps the
    // bar-range capture feature cross-DAW (loop/cycle points are NOT, so
    // capture gating deliberately doesn't use them). The loop locators ARE
    // published — guarded — because Logic stamps promise-exported regions
    // relative to the cycle start while the cycle is on: the drop path
    // needs the left locator to recover the absolute project position.
    std::atomic<double> playheadPpq      { 0.0 };
    std::atomic<double> playheadBarPpq   { 0.0 };
    std::atomic<double> playheadBpm      { 120.0 };
    std::atomic<int>    playheadTsNum    { 4 };
    std::atomic<int>    playheadTsDen    { 4 };
    std::atomic<juce::int64> playheadSamples { 0 };
    std::atomic<juce::int64> playheadBarCount { 0 };
    std::atomic<double> playheadLoopStartPpq { 0.0 };
    std::atomic<double> playheadLoopEndPpq   { 0.0 };
    std::atomic<bool>   playheadPpqValid { false };
    std::atomic<bool>   playheadBarPpqValid { false };
    std::atomic<bool>   playheadSamplesValid { false };
    std::atomic<bool>   playheadBarCountValid { false };
    std::atomic<bool>   playheadLoopValid { false };
    std::atomic<bool>   transportPlaying { false };
    std::atomic<bool>   transportLooping { false };

    //── One-knob FX rack ─────────────────────────────────────────────────────
    // Eleven switchable single-parameter effects, applied in processBlock
    // BEFORE the capture FIFO (what you hear is what you share). ONE mode
    // runs at a time; mode and per-mode amounts are set from the web UI
    // via setFx / getFx and persisted in plugin state. amounts[kTone] is
    // bipolar around 0.5.
    // Mirrors orbfx::Type: 11 is the mix slot (no memory), 12..15 the
    // newer prints. kNumFx counts slots, so the memories index by type.
    enum FxMode { kTone = 0, kTape, kSpace, kStereoize, kGlue, kGain, kMod,
                  kCut, kAmp, kDoubler, kDelay, kMixSlot, kTremolo, kArp, kRadio, kHarmony,
                  kPitch, kFormant, kGrain, kVoice, kCrush,
                  kShimmer, kSwell, kStutter, kAir, kRing, kGate, kWow,
                  kNumFx = orbfx::kNumFx };
    std::atomic<int> fxMode { kTone };
    // amounts[kGain] is a fader: 0.75 = unity, 0 = −60 dB, 1 = +12 dB.
    std::array<std::atomic<float>, kNumFx> fxAmount {{ {0.5f}, {0.0f}, {0.0f}, {0.5f}, {0.0f}, {0.75f}, {0.0f}, {0.0f}, {0.0f}, {0.0f}, {0.0f},
                                                        {0.0f}, {0.0f}, {0.0f}, {0.0f}, {0.0f}, {0.5f}, {0.5f}, {0.0f}, {0.0f}, {0.0f},
                                                        {0.0f}, {0.0f}, {0.0f}, {0.0f}, {0.0f}, {0.0f}, {0.0f} }};
    // Sub-flavours: tape 0=hard 1=clean; space 0=hall 1=room 2=plate;
    // gain is a polarity BITMASK (bit0 = invert L, bit1 = invert R);
    // mod 0=chorus 1=flanger 2=phaser; cut 0=low 1=high 2=band;
    // amp 0=crunch 1=lead 2=fuzz; doubler 0=tight 1=wide;
    // delay 0=clean 1=tape 2=pingpong.
    std::array<std::atomic<int>, kNumFx> fxVariant {{ {0}, {0}, {0}, {0}, {0}, {0}, {0}, {0}, {0}, {0}, {0}, {0}, {0}, {0}, {0}, {0}, {0}, {0}, {0}, {0}, {0}, {0}, {0}, {0}, {0}, {0}, {0}, {0} }};
    // Space's second hand: decay per flavour [hall, room, plate], 0.5 = stock.
    std::array<std::atomic<float>, 3> fxSpaceDecay {{ {0.5f}, {0.5f}, {0.5f} }};
    // Delay's two hands: beat division index into {1/16, 1/8T, 1/8, 1/8.,
    // 1/4, 1/4., 1/2} and feedback 0..1. Time follows the host BPM.
    std::atomic<int>   fxDelayDiv { 2 };
    std::atomic<float> fxDelayFb  { 0.35f };

    void handleSetFx (const juce::var& args,
                      juce::WebBrowserComponent::NativeFunctionCompletion completion);
    void handleGetFx (const juce::var& args,
                      juce::WebBrowserComponent::NativeFunctionCompletion completion);

    // The engine: per-node DSP state + the compiled patch (FxEngine.h).
    orbfx::Chain fxChain;
    // UI meter: glue's current gain reduction in dB (positive number),
    // block max, zeroed whenever glue isn't working. Read by timerCallback.
    std::atomic<float> glueGrDb { 0.0f };

    //── The patch ────────────────────────────────────────────────────────────
    // fxGraph is the wall as drawn (message thread, guarded for hosts that
    // restore state off-thread). Two writers: setGraph (the canvas UI) and
    // the legacy setFx bridge, which keeps the single-print room working by
    // drawing the one-node patch in → mode → out. fxSlots are the per-slot
    // parameter atomics the audio thread snapshots each block.
    orbfx::Graph          fxGraph;
    juce::CriticalSection fxGraphLock;
    std::atomic<bool>     fxGraphMode { false };   // true once a real patch was set
    struct SlotParams
    {
        std::atomic<float> amount   { 0.0f };
        std::atomic<int>   variant  { 0 };
        std::array<std::atomic<float>, 3> decay {{ {0.5f}, {0.5f}, {0.5f} }};
        std::atomic<int>   delayDiv { 2 };
        std::atomic<float> delayFb  { 0.35f };
        std::atomic<bool>  wet      { false };
        std::array<std::atomic<int>, orbfx::kAuxCount> aux {};
        std::atomic<bool>  hasCurve { false };
        std::array<std::atomic<float>, orbfx::kCurveLen> curve {};
        std::atomic<bool>  hasLfo { false };
        std::array<std::atomic<float>, orbfx::kLfoLen> lfo {};
        std::array<std::atomic<uint8_t>, orbfx::kLfoLen> lfoCliff {};   // 1 where the shape drops or climbs straight (a vertical line): the hand must jump there, not glide
    };
    std::array<SlotParams, orbfx::kMaxNodes> fxSlots;

    /** The control wires: which rate plays which hand of which print, at
     *  what depth; and which lfo lends each rate its shape. Published
     *  with the program, adopted at a block boundary. */
    struct ModTable
    {
        struct Wire { int from = -1, to = -1, hand = orbfx::kHandNone; float depth = 0.0f; int toType = orbfx::kNone; bool fromMacro = false; int target = -1; bool uni = false; };   // fromMacro: a macro or a follow (its value is 0..1 from rest); uni: the push goes one way from the setting (else both ways round it); target ≥ 0: this wire sets that wire's depth
        int  count = 0;
        Wire wires[orbfx::kMaxEdges];
        bool isRate[orbfx::kMaxNodes] {};
        bool isFollow[orbfx::kMaxNodes] {};
        bool isLfo[orbfx::kMaxNodes] {};      // an lfo print that is its own clock (it has the rate's hands, a depth, and may be random)   // a follow slot: its value is what the engine heard last block
        int  shapeOf[orbfx::kMaxNodes];   // rate slot → lfo slot, or -1 = sine
        int  macroOf[orbfx::kMaxNodes];   // macro slot → macro index 0..7, or -1
        ModTable() { for (auto& x : shapeOf) x = -1; for (auto& x : macroOf) x = -1; }
    };
    juce::SpinLock     modLock;
    ModTable           modPending, modActive;
    std::atomic<bool>  modPendingFlag { false };
    double             ratePhase[orbfx::kMaxNodes] {};        // audio thread
    int64_t            rateCycle[orbfx::kMaxNodes] {};        // audio thread: which turn of the shape this is (free-running: counted; playing: from the song position)
    int                rateLastIdx[orbfx::kMaxNodes] {};      // audio thread: where in the table the last block read
    int64_t            rateLastStep[orbfx::kMaxNodes] {};     // audio thread: the last random step
    int                rateLastDepth[orbfx::kMaxNodes] {};    // audio thread: the lfo's own depth last block (a thrown depth makes its hands jump)
    std::array<std::atomic<float>, orbfx::kMaxNodes> ratePhaseOut {};   // for the wall: where each lfo is in its shape, 0..1
    std::array<std::atomic<int>, orbfx::kMaxNodes> rateCycleOut {};     // …and which turn (the random shape is drawn from it)
    std::array<std::atomic<float>, orbfx::kMaxNodes> rateValue {};   // what each rate is playing now, 0..1, for the wall
    std::array<std::atomic<float>, orbfx::kMaxNodes * 12> liveHands {};   // each slot's hands as played (after the pushes), in the host's order, for the study
    void applyModulation (orbfx::NodeParams* params, int numSamples, float sr, float bpm, bool playing, double ppq);

    /** The host's view of the wall: twelve hands per slot, in a group per slot. */
    struct SlotHost
    {
        SlotFloatParam* amount = nullptr;
        SlotIntParam*   mode   = nullptr;   // variant
        SlotFloatParam* decay  = nullptr;   // the current flavour's decay
        SlotFloatParam* fb     = nullptr;
        SlotIntParam*   div    = nullptr;   // beat division
        SlotBoolParam*  wet    = nullptr;
        SlotFloatParam* aux[6] {};          // normalised over the hand's own range
    };
    SlotHost slotHost[orbfx::kMaxNodes];
    SlotFloatParam* macroParam[orbfx::kNumMacros] {};   // macro 1 … 8, the knobs the host turns
    std::array<std::atomic<int>, orbfx::kMaxNodes> slotTypes {};   // what sits in each slot (kNone = empty), for the audio thread
    void syncHandNames();              // message thread: rename after the graph changes
    void hostParamsToGraph();          // message thread: automation moved a param → the graph copy follows
    juce::AudioProcessorParameter* handParam (int slot, const juce::String& hand) const;
    static const char* variantName (int type, int v);
    static const char* auxName (int type, int k);
    static void auxRange (int type, int k, int& lo, int& hi);

    /** Write a node's params into its slot atomics (no republish). */
    void writeSlot (const orbfx::Graph::Node& nd);
    /** Store `g` as the patch, write every slot, compile + publish.
     *  Returns false (with `error`) if the patch doesn't compile. */
    bool applyGraph (const orbfx::Graph& g, juce::String& error);
    /** Legacy bridge: patch = in → [fxMode] → out from the per-effect memories. */
    void rebuildLegacyGraph();
    void freshGraph();   // nothing restored: the wall surface starts bare, the others with the single print
    static juce::String graphToJson (const orbfx::Graph& g);
    static bool graphFromJson (const juce::String& json, orbfx::Graph& g, juce::String& error);
    void handleSetGraph (const juce::var& args,
                         juce::WebBrowserComponent::NativeFunctionCompletion completion);
    void handleGetGraph (const juce::var& args,
                         juce::WebBrowserComponent::NativeFunctionCompletion completion);
    // Presets: patches saved as files the user owns
    // (~/Library/Application Support/Orb/Sounds/Presets/<name>.orbpatch).
    static juce::File presetsDir();
    void handleListPresets (const juce::var& args, juce::WebBrowserComponent::NativeFunctionCompletion completion);
    void handleSavePreset  (const juce::var& args, juce::WebBrowserComponent::NativeFunctionCompletion completion);
    void handleLoadPreset  (const juce::var& args, juce::WebBrowserComponent::NativeFunctionCompletion completion);
    void handleDeletePreset (const juce::var& args, juce::WebBrowserComponent::NativeFunctionCompletion completion);
    // The native panels: "save as…" and "open…" as the OS draws them.
    std::unique_ptr<juce::FileChooser> presetChooser;
    void handleSavePresetDialog (const juce::var& args, juce::WebBrowserComponent::NativeFunctionCompletion completion);
    void handleOpenPresetDialog (const juce::var& args, juce::WebBrowserComponent::NativeFunctionCompletion completion);
    void processFx (juce::AudioBuffer<float>& buffer, const juce::AudioBuffer<float>* side);

    //── Live audio streaming timer ───────────────────────────────────────────
    void timerCallback() override;
    std::vector<float> audioPollBuffer;

    //── Embedded WKWebView (owned here so it outlives the editor) ────────────
    std::unique_ptr<juce::WebBrowserComponent> browser;

    //── Native function handlers (moved from editor) ─────────────────────────
    juce::File downloadToTemp (const juce::String& url, const juce::String& name);
    void handlePrefetch        (const juce::var&, juce::WebBrowserComponent::NativeFunctionCompletion);
    void handleStartDrag       (const juce::var&, juce::WebBrowserComponent::NativeFunctionCompletion);
    void handleWriteAudioFile  (const juce::var&, juce::WebBrowserComponent::NativeFunctionCompletion);
    void handleWriteAudioFiles (const juce::var&, juce::WebBrowserComponent::NativeFunctionCompletion);
    void handleStartVideoCapture (const juce::var&, juce::WebBrowserComponent::NativeFunctionCompletion);
    void handleStopVideoCapture  (const juce::var&, juce::WebBrowserComponent::NativeFunctionCompletion);
    void handleListCaptureSources(const juce::var&, juce::WebBrowserComponent::NativeFunctionCompletion);
    void handlePickCaptureSource (const juce::var&, juce::WebBrowserComponent::NativeFunctionCompletion);
    void handleSetPluginSize     (const juce::var&, juce::WebBrowserComponent::NativeFunctionCompletion);
    void handleOpenExternal      (const juce::var&, juce::WebBrowserComponent::NativeFunctionCompletion);
    void handleGetClipboardText  (const juce::var&, juce::WebBrowserComponent::NativeFunctionCompletion);
    void handleListLocalFonts    (const juce::var&, juce::WebBrowserComponent::NativeFunctionCompletion);
    void handleGetDawTimeline    (const juce::var&, juce::WebBrowserComponent::NativeFunctionCompletion);
    void handleGetHostControlStatus (const juce::var&, juce::WebBrowserComponent::NativeFunctionCompletion);
    void handleGetHostTracks        (const juce::var&, juce::WebBrowserComponent::NativeFunctionCompletion);
    void handleSetHostTrackSelected (const juce::var&, juce::WebBrowserComponent::NativeFunctionCompletion);
    void handleStartHostStemExport  (const juce::var&, juce::WebBrowserComponent::NativeFunctionCompletion);

    //── Active editor resize callback (registered by editor on construct) ────
    ResizeFn editorResizeFn;

    //── Native window / screen capture ───────────────────────────────────────
    std::unique_ptr<VideoCapture> videoCapture;
    std::unique_ptr<OrbControlBridge> controlBridge;

    //── Prefetch / drag state (used by handlers above) ───────────────────────
    juce::File   cachedFile;
    juce::String cachedName;
    bool         cacheReady     { false };
    bool         isDownloading  { false };

    std::shared_ptr<juce::WebBrowserComponent::NativeFunctionCompletion> pendingDragComp;
    juce::File   pendingDragFile;
    bool         dragArmed      { false };

    //── Live audio capture: called by processBlock and timer ─────────────────
    int readCapturedAudio (float* dest, int maxFrames);
    int getCaptureSampleRate () const noexcept { return captureSampleRate.load(); }
    int getCaptureNumChannels() const noexcept { return captureNumChannels.load(); }

    JUCE_DECLARE_NON_COPYABLE_WITH_LEAK_DETECTOR (OrbAudioProcessor)
};
