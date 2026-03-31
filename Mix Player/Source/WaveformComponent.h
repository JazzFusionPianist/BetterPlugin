#pragma once
#include <JuceHeader.h>

class AudioEngine;

//==============================================================================
class WaveformComponent : public juce::Component,
                          public juce::Timer,
                          public juce::ChangeListener
{
public:
    WaveformComponent(AudioEngine& engine);
    ~WaveformComponent() override;

    void loadFile(const juce::File& file);
    void clearWaveform();

    // Loop points set by dragging
    std::function<void(double, double)> onLoopPointsChanged;

    void paint(juce::Graphics& g) override;
    void resized() override;
    void mouseDown(const juce::MouseEvent& e) override;
    void mouseDrag(const juce::MouseEvent& e) override;
    void mouseUp(const juce::MouseEvent& e) override;

    void timerCallback() override;
    void changeListenerCallback(juce::ChangeBroadcaster* source) override;

private:
    AudioEngine& audioEngine;

    juce::AudioThumbnail thumbnail;

    double playheadPosition = 0.0;  // seconds

    // Loop drag state
    bool isDraggingLoop = false;
    double loopDragStart = 0.0;
    double loopInPoint  = 0.0;
    double loopOutPoint = 0.0;

    double xToSeconds(int x) const;
    int secondsToX(double t) const;

    JUCE_DECLARE_NON_COPYABLE_WITH_LEAK_DETECTOR(WaveformComponent)
};
