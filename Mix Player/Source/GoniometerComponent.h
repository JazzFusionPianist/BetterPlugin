#pragma once
#include <JuceHeader.h>
#include "MeteringEngine.h"

//==============================================================================
class GoniometerComponent : public juce::Component,
                            public juce::Timer
{
public:
    GoniometerComponent(MeteringEngine& engine);
    ~GoniometerComponent() override;

    void paint(juce::Graphics& g) override;
    void resized() override;
    void timerCallback() override;

private:
    MeteringEngine& meteringEngine;

    // Local snapshot of goniometer data for painting
    std::vector<MeteringEngine::SamplePair> snapshot;
    int snapshotWritePos = 0;
    float correlationValue = 0.0f;

    JUCE_DECLARE_NON_COPYABLE_WITH_LEAK_DETECTOR(GoniometerComponent)
};
