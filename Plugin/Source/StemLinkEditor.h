#pragma once

#include <juce_gui_basics/juce_gui_basics.h>
#include "StemLinkProcessor.h"

class StemLinkAudioProcessorEditor final : public juce::AudioProcessorEditor,
                                           private juce::Timer
{
public:
    explicit StemLinkAudioProcessorEditor (StemLinkAudioProcessor&);
    ~StemLinkAudioProcessorEditor() override;

    void paint (juce::Graphics&) override;

private:
    void timerCallback() override;
    StemLinkAudioProcessor& stemLinkProcessor;

    JUCE_DECLARE_NON_COPYABLE_WITH_LEAK_DETECTOR (StemLinkAudioProcessorEditor)
};
