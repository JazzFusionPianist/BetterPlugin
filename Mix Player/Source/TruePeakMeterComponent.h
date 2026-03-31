#pragma once
#include <JuceHeader.h>
#include "MeteringEngine.h"

//==============================================================================
class TruePeakMeterComponent : public juce::Component,
                               public juce::Timer
{
public:
    TruePeakMeterComponent(MeteringEngine& engine);
    ~TruePeakMeterComponent() override;

    void paint(juce::Graphics& g) override;
    void resized() override;
    void timerCallback() override;

    // Reset peak hold
    void resetPeakHold();

private:
    MeteringEngine& meteringEngine;

    float peakL = -std::numeric_limits<float>::infinity();
    float peakR = -std::numeric_limits<float>::infinity();
    float holdL = -std::numeric_limits<float>::infinity();
    float holdR = -std::numeric_limits<float>::infinity();
    bool  clipL = false;
    bool  clipR = false;

    static constexpr float minDB = -40.0f;
    static constexpr float maxDB =  6.0f;

    float dbToNorm(float db) const;
    void drawChannel(juce::Graphics& g, juce::Rectangle<int> area,
                     float peak, float hold, bool clip);

    JUCE_DECLARE_NON_COPYABLE_WITH_LEAK_DETECTOR(TruePeakMeterComponent)
};
