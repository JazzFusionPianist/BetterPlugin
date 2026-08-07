#pragma once

#include <juce_audio_processors/juce_audio_processors.h>
#include <juce_events/juce_events.h>
#include "StemLinkRegistry.h"

class StemLinkAudioProcessor final : public juce::AudioProcessor,
                                     private juce::Timer
{
public:
    StemLinkAudioProcessor();
    ~StemLinkAudioProcessor() override;

    void prepareToPlay (double, int) override {}
    void releaseResources() override {}
    bool isBusesLayoutSupported (const BusesLayout&) const override;
    void processBlock (juce::AudioBuffer<float>&, juce::MidiBuffer&) override;

    juce::AudioProcessorEditor* createEditor() override;
    bool hasEditor() const override { return true; }

    const juce::String getName() const override { return "Orb StemLink"; }
    bool acceptsMidi() const override { return false; }
    bool producesMidi() const override { return false; }
    bool isMidiEffect() const override { return false; }
    double getTailLengthSeconds() const override { return 0.0; }

    int getNumPrograms() override { return 1; }
    int getCurrentProgram() override { return 0; }
    void setCurrentProgram (int) override {}
    const juce::String getProgramName (int) override { return {}; }
    void changeProgramName (int, const juce::String&) override {}

    void getStateInformation (juce::MemoryBlock&) override {}
    void setStateInformation (const void*, int) override {}
    void updateTrackProperties (const TrackProperties&) override;

    juce::String getTrackName() const;
    juce::Colour getTrackColour() const;
    juce::String getHostName() const { return hostName; }

private:
    void timerCallback() override;

    mutable juce::CriticalSection propertyLock;
    juce::String trackName { "Waiting for track name…" };
    juce::Colour trackColour { 0xff7c6cff };
    juce::String hostName;
    StemLinkRegistry::Publisher publisher;

    JUCE_DECLARE_NON_COPYABLE_WITH_LEAK_DETECTOR (StemLinkAudioProcessor)
};
