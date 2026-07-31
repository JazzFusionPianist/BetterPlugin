#pragma once
#include <juce_audio_processors/juce_audio_processors.h>
#include <juce_gui_extra/juce_gui_extra.h>
#include "VideoCapture.h"
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
    const juce::String getName() const override { return "Orb"; }
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
    void requestEditorResize (int w, int h)
    {
        if (editorResizeFn) editorResizeFn (w, h);
    }

private:
    //── Capture ring buffer ───────────────────────────────────────────────────
    static constexpr int kCaptureBufferSize = 96000;
    juce::AbstractFifo    captureFifo { kCaptureBufferSize };
    juce::AudioBuffer<float> captureBuffer { 2, kCaptureBufferSize };
    std::atomic<int>      captureSampleRate  { 0 };
    std::atomic<int>      captureNumChannels { 0 };

    //── Playhead snapshot ─────────────────────────────────────────────────────
    // Read on the audio thread in processBlock (the only place getPlayHead()
    // is valid), published via atomics, and attached to every __juceDawAudio
    // event so the web side can gate bar-range capture on musical position.
    // ppqPosition is reported by virtually every DAW, which keeps the
    // bar-range capture feature cross-DAW (loop/cycle points are NOT, so we
    // deliberately don't use those).
    std::atomic<double> playheadPpq      { 0.0 };
    std::atomic<double> playheadBpm      { 120.0 };
    std::atomic<int>    playheadTsNum    { 4 };
    std::atomic<int>    playheadTsDen    { 4 };
    std::atomic<bool>   transportPlaying { false };

    //── One-knob FX rack ─────────────────────────────────────────────────────
    // Five switchable single-parameter effects, applied in processBlock
    // BEFORE the capture FIFO (what you hear is what you share). Mode and
    // per-mode amounts are set from the web UI via setFx / getFx and
    // persisted in plugin state. amounts[kTone] is bipolar around 0.5.
    enum FxMode { kTone = 0, kTape, kSpace, kStereoize, kGlue, kGain, kMod, kNumFx };
    std::atomic<int> fxMode { kTone };
    // amounts[kGain] is a fader: 0.75 = unity, 0 = −60 dB, 1 = +12 dB.
    std::array<std::atomic<float>, kNumFx> fxAmount {{ {0.5f}, {0.0f}, {0.0f}, {0.0f}, {0.0f}, {0.75f}, {0.0f} }};
    // Sub-flavours: tape 0=hard 1=clean; space 0=hall 1=room 2=plate;
    // gain is a polarity BITMASK (bit0 = invert L, bit1 = invert R);
    // mod 0=chorus 1=flanger 2=phaser.
    std::array<std::atomic<int>, kNumFx> fxVariant {{ {0}, {0}, {0}, {0}, {0}, {0}, {0} }};
    // Space's second hand: decay per flavour [hall, room, plate], 0.5 = stock.
    std::array<std::atomic<float>, 3> fxSpaceDecay {{ {0.5f}, {0.5f}, {0.5f} }};

    void handleSetFx (const juce::var& args,
                      juce::WebBrowserComponent::NativeFunctionCompletion completion);
    void handleGetFx (const juce::var& args,
                      juce::WebBrowserComponent::NativeFunctionCompletion completion);

    // Audio-thread-only FX state.
    struct Biquad { float b0 = 1, b1 = 0, b2 = 0, a1 = 0, a2 = 0, x1 = 0, x2 = 0, y1 = 0, y2 = 0;
                    inline float run (float x) noexcept {
                        const float y = b0 * x + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2;
                        x2 = x1; x1 = x; y2 = y1; y1 = y; return y; } };
    float fxAmtSm = 0.0f;        // smoothed amount for the active mode
    int   fxLastMode = kTone;
    float tiltApplied = 999.0f;  // dB of the currently-baked shelf coeffs
    Biquad tiltLow[2], tiltHigh[2];
    float tapeLpState[2] { 0, 0 };
    float cleanXoState[2] { 0, 0 };     // crossover low state, stage 1
    float cleanXoState2[2] { 0, 0 };    // crossover low state, stage 2 (12 dB/oct)
    Biquad cleanShelf[2];               // clean tape's airy 2.5k shelf
    float cleanShelfBaked = -1.0f;
    juce::Reverb fxReverb;
    juce::AudioBuffer<float> fxWetBuf { 2, 2048 };
    float sendHpState[2] { 0, 0 };      // reverb send low-cut state
    int   fxLastVariant = 0;
    float apState[4][2] { {0,0},{0,0},{0,0},{0,0} };  // allpass x1/y1 per stage
    float sideHpState = 0.0f;
    float glueEnv = 0.0f;        // linear peak envelope
    // UI meter: glue's current gain reduction in dB (positive number),
    // block max, zeroed whenever glue isn't working. Read by timerCallback.
    std::atomic<float> glueGrDb { 0.0f };
    // kGain: per-channel signed gain (sign carries the polarity invert),
    // ramped across each block so fader moves and flips never click.
    float gainPrev[2] { 1.0f, 1.0f };
    bool  gainPrimed = false;
    // kMod: one shared LFO, a modulated delay pair (chorus/flanger) and a
    // six-stage swept allpass ladder with feedback (phaser).
    float modLfoPhase = 0.0f;
    std::vector<float> modDl[2];   // sized in prepareToPlay (~60 ms)
    int   modWrite = 0;
    float phX1[6][2] {}, phY1[6][2] {};
    float phFb[2] { 0.0f, 0.0f };
    void resetFxState();
    void processFx (juce::AudioBuffer<float>& buffer);

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

    //── Active editor resize callback (registered by editor on construct) ────
    ResizeFn editorResizeFn;

    //── Native window / screen capture ───────────────────────────────────────
    std::unique_ptr<VideoCapture> videoCapture;

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
