#pragma once
#include <JuceHeader.h>
#include "MeteringEngine.h"

//==============================================================================
class SpectrumAnalyzerComponent : public juce::Component,
                                  public juce::Timer
{
public:
    SpectrumAnalyzerComponent(MeteringEngine& engine);
    ~SpectrumAnalyzerComponent() override;

    void paint(juce::Graphics& g) override;
    void resized() override;
    void timerCallback() override;

private:
    MeteringEngine& meteringEngine;
    double currentSampleRate = 44100.0;

    // Convert FFT bin index to x pixel coordinate (log scale)
    float binToX(int bin, int width) const;

    // Frequency labels to draw
    static const std::vector<float> freqLabels;

    JUCE_DECLARE_NON_COPYABLE_WITH_LEAK_DETECTOR(SpectrumAnalyzerComponent)
};
