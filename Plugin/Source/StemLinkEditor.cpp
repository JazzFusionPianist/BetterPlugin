#include "StemLinkEditor.h"

StemLinkAudioProcessorEditor::StemLinkAudioProcessorEditor (StemLinkAudioProcessor& p)
    : AudioProcessorEditor (&p), stemLinkProcessor (p)
{
    setSize (340, 150);
    startTimer (500);
}

StemLinkAudioProcessorEditor::~StemLinkAudioProcessorEditor()
{
    stopTimer();
}

void StemLinkAudioProcessorEditor::paint (juce::Graphics& g)
{
    g.fillAll (juce::Colour (0xff171719));
    auto area = getLocalBounds().reduced (20);
    const auto accent = stemLinkProcessor.getTrackColour();

    g.setColour (accent.withAlpha (0.16f));
    g.fillRoundedRectangle (area.toFloat(), 16.0f);
    g.setColour (accent.withAlpha (0.8f));
    g.drawRoundedRectangle (area.toFloat(), 16.0f, 1.0f);

    g.setColour (juce::Colours::white);
    g.setFont (juce::FontOptions (22.0f, juce::Font::bold));
    g.drawText ("Orb StemLink", area.removeFromTop (44), juce::Justification::centredLeft);

    g.setColour (juce::Colours::white.withAlpha (0.9f));
    g.setFont (juce::FontOptions (17.0f));
    g.drawText (stemLinkProcessor.getTrackName(), area.removeFromTop (30), juce::Justification::centredLeft);

    g.setColour (juce::Colours::white.withAlpha (0.48f));
    g.setFont (juce::FontOptions (12.0f));
    g.drawText ("Linked to Orb · " + stemLinkProcessor.getHostName(), area,
                juce::Justification::centredLeft);
}

void StemLinkAudioProcessorEditor::timerCallback()
{
    repaint();
}
