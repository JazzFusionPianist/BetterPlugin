#include "MonoToggleButton.h"

MonoToggleButton::MonoToggleButton()
{
    setClickingTogglesState(true);
}

void MonoToggleButton::paintButton(juce::Graphics& g, bool isMouseOver, bool /*isButtonDown*/)
{
    bool mono = getToggleState();

    auto bounds = getLocalBounds().reduced(2).toFloat();

    // Background: slightly lit when active, dark when inactive
    juce::Colour bg = mono ? juce::Colour(0xff1e1a1a) : juce::Colour(0xff111111);
    if (isMouseOver)
        bg = bg.brighter(0.12f);

    g.setColour(bg);
    g.fillRoundedRectangle(bounds, 4.0f);

    // Border: orange-amber when active (like a warning/active state), subtle dark when off
    g.setColour(mono ? juce::Colour(0xffff8800) : juce::Colour(0xff333333));
    g.drawRoundedRectangle(bounds, 4.0f, 1.5f);

    // Text: always "MONO", bright orange when active, dim grey when inactive
    g.setFont(juce::Font(juce::FontOptions("SF Pro Display", 16.0f, juce::Font::bold)));
    g.setColour(mono ? juce::Colour(0xffff8800) : juce::Colour(0xff555555));
    g.drawText("MONO", bounds, juce::Justification::centred);
}
