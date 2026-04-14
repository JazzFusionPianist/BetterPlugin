#pragma once
#include <juce_audio_processors/juce_audio_processors.h>
#include <atomic>

//==============================================================================
/**
 * CoOp Plugin Processor
 *
 * This plugin has no audio DSP — it is a pure UI utility plugin.
 * Audio passes through unchanged on all channels.
 *
 * For live streaming, processBlock also writes the incoming audio into a
 * lock-free ring buffer so the editor can poll it on the message thread
 * and forward it to the embedded WKWebView.
 */
class CoOpAudioProcessor final : public juce::AudioProcessor
{
public:
    CoOpAudioProcessor();
    ~CoOpAudioProcessor() override = default;

    //── Playback ──────────────────────────────────────────────────────────────
    void prepareToPlay (double sampleRate, int samplesPerBlock) override;
    void releaseResources() override;
    bool isBusesLayoutSupported (const BusesLayout& layouts) const override;
    void processBlock (juce::AudioBuffer<float>&, juce::MidiBuffer&) override;

    //── Editor ────────────────────────────────────────────────────────────────
    juce::AudioProcessorEditor* createEditor() override;
    bool hasEditor() const override { return true; }

    //── Identity ──────────────────────────────────────────────────────────────
    const juce::String getName() const override { return "CoOp"; }
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
    void getStateInformation (juce::MemoryBlock&) override  {}
    void setStateInformation (const void*, int) override    {}

    //── Live audio capture ────────────────────────────────────────────────────
    /** Reads up to `maxFrames` frames of captured audio, interleaving channels
     *  into `dest`. Caller must provide dest with at least
     *  `maxFrames * getCaptureNumChannels()` floats. Returns frames actually read. */
    int readCapturedAudio (float* dest, int maxFrames);
    int getCaptureSampleRate () const noexcept { return captureSampleRate.load(); }
    int getCaptureNumChannels() const noexcept { return captureNumChannels.load(); }

private:
    //── Audio capture ring buffer (mirrors up to 2 channels × 1 s @ 96 kHz) ─
    static constexpr int kCaptureBufferSize = 96000;
    juce::AbstractFifo    captureFifo { kCaptureBufferSize };
    juce::AudioBuffer<float> captureBuffer { 2, kCaptureBufferSize };
    std::atomic<int>      captureSampleRate  { 0 };
    std::atomic<int>      captureNumChannels { 0 };

    JUCE_DECLARE_NON_COPYABLE_WITH_LEAK_DETECTOR (CoOpAudioProcessor)
};
