#pragma once
#include <JuceHeader.h>

//==============================================================================
// A styled STEREO/MONO toggle button
class MonoToggleButton : public juce::ToggleButton
{
public:
    MonoToggleButton();
    ~MonoToggleButton() override = default;

    void paintButton(juce::Graphics& g, bool isMouseOver, bool isButtonDown) override;

private:
    JUCE_DECLARE_NON_COPYABLE_WITH_LEAK_DETECTOR(MonoToggleButton)
};
