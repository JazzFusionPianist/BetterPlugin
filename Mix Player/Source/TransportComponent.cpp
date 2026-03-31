#include "TransportComponent.h"
#include "AudioEngine.h"

TransportComponent::TransportComponent(AudioEngine& engine)
    : audioEngine(engine)
{
    addAndMakeVisible(playPauseButton);
    addAndMakeVisible(monoButton);
    addAndMakeVisible(loopButton);
    addAndMakeVisible(timecodeLabel);
    addAndMakeVisible(totalLengthLabel);

    timecodeLabel.setFont(juce::Font(juce::FontOptions("SF Pro Display", 16.0f, juce::Font::bold)));
    timecodeLabel.setColour(juce::Label::textColourId, juce::Colours::white);
    timecodeLabel.setJustificationType(juce::Justification::centredRight);
    timecodeLabel.setText("0:00.000", juce::dontSendNotification);

    totalLengthLabel.setFont(juce::Font(juce::FontOptions("SF Pro Display", 16.0f, juce::Font::plain)));
    totalLengthLabel.setColour(juce::Label::textColourId, juce::Colours::grey);
    totalLengthLabel.setJustificationType(juce::Justification::centredLeft);
    totalLengthLabel.setText("/ 0:00.000", juce::dontSendNotification);

    playPauseButton.setLookAndFeel(&buttonLAF);
    loopButton.setLookAndFeel(&buttonLAF);

    playPauseButton.setClickingTogglesState(false);
    playPauseButton.onClick = [this]()
    {
        if (audioEngine.isPlaying())
        {
            audioEngine.pause();
            playPauseButton.setButtonText("Play");
        }
        else
        {
            // If a loop region is set, always seek to loop in point before playing
            if (audioEngine.isLoopEnabled()
                && audioEngine.getLoopOut() > audioEngine.getLoopIn())
            {
                audioEngine.setPosition(audioEngine.getLoopIn());
            }
            audioEngine.play();
            playPauseButton.setButtonText("Pause");
        }
    };

    monoButton.onClick = [this]()
    {
        audioEngine.setMonoEnabled(monoButton.getToggleState());
    };

    loopButton.onClick = [this]()
    {
        audioEngine.setLoopEnabled(loopButton.getToggleState());
    };

    startTimerHz(30);
}

TransportComponent::~TransportComponent()
{
    stopTimer();
    playPauseButton.setLookAndFeel(nullptr);
    loopButton.setLookAndFeel(nullptr);
}

void TransportComponent::paint(juce::Graphics& g)
{
    g.fillAll(juce::Colour(0xff0e0e0e));
    g.setColour(juce::Colour(0xff1e1e1e));
    g.drawRect(getLocalBounds(), 1);
}

void TransportComponent::resized()
{
    auto bounds = getLocalBounds().reduced(3);
    int btnH = bounds.getHeight() - 4;
    int cy   = bounds.getCentreY() - btnH / 2;

    // Buttons on the left
    playPauseButton.setBounds(bounds.getX(),              cy, 64, btnH);
    monoButton.setBounds(playPauseButton.getRight() + 4,  cy, 56, btnH);
    loopButton.setBounds(monoButton.getRight() + 4,       cy, 56, btnH);

    // Timecode centred in the bar
    int tcW  = 90;  // "0:00.000"
    int totW = 96;  // "/ 0:00.000"
    int totalTcW = tcW + 4 + totW;
    int tcX = bounds.getCentreX() - totalTcW / 2;
    timecodeLabel.setBounds(tcX,              cy, tcW,  btnH);
    totalLengthLabel.setBounds(tcX + tcW + 4, cy, totW, btnH);
}

void TransportComponent::timerCallback()
{
    // Sync button text with engine state (handles edge cases like stream end)
    bool playing = audioEngine.isPlaying();
    playPauseButton.setButtonText(playing ? "Pause" : "Play");

    // Keep loop button in sync with engine state (waveform drag can toggle it)
    bool looping = audioEngine.isLoopEnabled();
    if (loopButton.getToggleState() != looping)
        loopButton.setToggleState(looping, juce::dontSendNotification);

    // Update timecode display
    double pos = audioEngine.getCurrentPosition();
    double len = audioEngine.getLengthInSeconds();
    timecodeLabel.setText(formatTime(pos), juce::dontSendNotification);
    totalLengthLabel.setText("/ " + formatTime(len), juce::dontSendNotification);
}

juce::String TransportComponent::formatTime(double seconds)
{
    if (seconds < 0.0) seconds = 0.0;
    int mins = (int)(seconds / 60.0);
    int secs = (int)(seconds) % 60;
    int ms   = (int)((seconds - std::floor(seconds)) * 1000.0);
    return juce::String::formatted("%d:%02d.%03d", mins, secs, ms);
}
