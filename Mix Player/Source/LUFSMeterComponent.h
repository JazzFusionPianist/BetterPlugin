#pragma once
#include <JuceHeader.h>
#include "MeteringEngine.h"

//==============================================================================
class LUFSMeterComponent : public juce::Component,
                           public juce::Timer
{
public:
    LUFSMeterComponent(MeteringEngine& engine);
    ~LUFSMeterComponent() override;

    void paint(juce::Graphics& g) override;
    void resized() override;
    void timerCallback() override;

private:
    MeteringEngine& meteringEngine;

    float integrated = -std::numeric_limits<float>::infinity();
    float shortTerm  = -std::numeric_limits<float>::infinity();
    float momentary  = -std::numeric_limits<float>::infinity();

    // Bar ranges: -36 LUFS to 0 LUFS
    static constexpr float minLUFS = -36.0f;
    static constexpr float maxLUFS =   0.0f;

    float lufsToNorm(float lufs) const;
    juce::Colour getLUFSColour(float lufs) const;

    JUCE_DECLARE_NON_COPYABLE_WITH_LEAK_DETECTOR(LUFSMeterComponent)
};
