#pragma once
#include <juce_audio_processors/juce_audio_processors.h>
#include "TapCache.h"

// Slur Tap: a zero-latency pass-through insert for hosts where the main Slur
// cannot render or read other tracks. It records what its track sounds like at
// each timeline position (playback, recording or offline bounce) so the main
// Slur can send stems/regions without another pass. Audio is never altered.
class SlurTapProcessor final : public juce::AudioProcessor
{
public:
    SlurTapProcessor();
    ~SlurTapProcessor() override;

    void prepareToPlay (double sampleRate, int) override;
    void releaseResources() override {}
    bool isBusesLayoutSupported (const BusesLayout&) const override;
    void processBlock (juce::AudioBuffer<float>&, juce::MidiBuffer&) override;
    using juce::AudioProcessor::processBlock;

    juce::AudioProcessorEditor* createEditor() override;
    bool hasEditor() const override { return true; }
    const juce::String getName() const override { return JucePlugin_Name; }
    bool acceptsMidi() const override { return false; }
    bool producesMidi() const override { return false; }
    bool isMidiEffect() const override { return false; }
    double getTailLengthSeconds() const override { return 0.0; }
    int getNumPrograms() override { return 1; }
    int getCurrentProgram() override { return 0; }
    void setCurrentProgram (int) override {}
    const juce::String getProgramName (int) override { return {}; }
    void changeProgramName (int, const juce::String&) override {}
    void getStateInformation (juce::MemoryBlock&) override;
    void setStateInformation (const void*, int) override;
    void updateTrackProperties (const TrackProperties&) override;

    slurtap::TapCache& getCache() noexcept { return cache; }
    double getCaptureRate() const noexcept { return captureRate.load(); }
    void clearCapture();

private:
    slurtap::TapCache cache;
    juce::String tapId = juce::Uuid().toDashedString(), generation;
    std::atomic<double> captureRate { 0.0 };
    std::mutex idLock;

    JUCE_DECLARE_NON_COPYABLE_WITH_LEAK_DETECTOR (SlurTapProcessor)
};
