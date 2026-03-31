#pragma once
#include <JuceHeader.h>
#include "MonoToggleButton.h"

class AudioEngine;

//==============================================================================
class TransportComponent : public juce::Component,
                           public juce::Timer
{
    // LookAndFeel override to set 16pt SF Pro font on all buttons
    struct ButtonLookAndFeel : public juce::LookAndFeel_V4
    {
        juce::Font getTextButtonFont(juce::TextButton&, int) override
        {
            return juce::Font(juce::FontOptions("SF Pro Display", 16.0f, juce::Font::bold));
        }
        juce::Font getLabelFont(juce::Label&) override
        {
            return juce::Font(juce::FontOptions("SF Pro Display", 16.0f, juce::Font::plain));
        }
        void drawToggleButton(juce::Graphics& g, juce::ToggleButton& btn,
                              bool shouldDrawButtonAsHighlighted, bool shouldDrawButtonAsDown) override
        {
            auto bounds = btn.getLocalBounds().toFloat();
            bool on = btn.getToggleState();

            juce::Colour bg = on ? juce::Colour(0xff1a1a2e) : juce::Colour(0xff111111);
            if (shouldDrawButtonAsHighlighted) bg = bg.brighter(0.12f);
            g.setColour(bg);
            g.fillRoundedRectangle(bounds.reduced(2.0f), 4.0f);

            g.setColour(on ? juce::Colour(0xff00aaff) : juce::Colour(0xff333333));
            g.drawRoundedRectangle(bounds.reduced(2.0f), 4.0f, 1.5f);

            g.setFont(juce::Font(juce::FontOptions("SF Pro Display", 16.0f, juce::Font::bold)));
            g.setColour(on ? juce::Colour(0xff00aaff) : juce::Colour(0xff555555));
            g.drawText(btn.getButtonText(), bounds, juce::Justification::centred);
        }
    };
public:
    TransportComponent(AudioEngine& engine);
    ~TransportComponent() override;

    void paint(juce::Graphics& g) override;
    void resized() override;
    void timerCallback() override;

private:
    AudioEngine& audioEngine;
    ButtonLookAndFeel buttonLAF;

    juce::TextButton playPauseButton { "Play" };
    MonoToggleButton monoButton;
    juce::ToggleButton loopButton    { "Loop" };

    juce::Label timecodeLabel;
    juce::Label totalLengthLabel;

    static juce::String formatTime(double seconds);

    JUCE_DECLARE_NON_COPYABLE_WITH_LEAK_DETECTOR(TransportComponent)
};
