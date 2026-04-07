#pragma once
#include <juce_audio_processors/juce_audio_processors.h>

//==============================================================================
/**
 * CoOp Plugin Processor
 *
 * This plugin has no audio DSP — it is a pure UI utility plugin.
 * Audio passes through unchanged on all channels.
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

private:
    JUCE_DECLARE_NON_COPYABLE_WITH_LEAK_DETECTOR (CoOpAudioProcessor)
};
