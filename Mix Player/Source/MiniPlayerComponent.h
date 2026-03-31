#pragma once
#include <JuceHeader.h>

class AudioEngine;
class LibraryManager;

//==============================================================================
// Compact floating player shown when clicking the menu bar icon.
// Displays: track name, elapsed/total time, progress bar, play/pause, prev/next, "Open Mix Player".
class MiniPlayerComponent : public juce::Component,
                            public juce::Timer
{
public:
    MiniPlayerComponent(AudioEngine& engine, LibraryManager& library);
    ~MiniPlayerComponent() override;

    void paint(juce::Graphics& g) override;
    void resized() override;
    void timerCallback() override;

    // Called when the user clicks outside the popup (from the parent window)
    std::function<void()> onDismiss;

private:
    AudioEngine&    audioEngine;
    LibraryManager& libraryManager;

    juce::TextButton prevButton   { "|<" };
    juce::TextButton playButton   { ">" };
    juce::TextButton nextButton   { ">|" };
    juce::TextButton openButton   { "Open Mix Player" };
    juce::TextButton quitButton   { "Quit" };

    // Progress bar (drawn manually in paint)
    bool isDraggingProgress = false;

    void updatePlayButton();
    void clickPrev();
    void clickNext();
    float getProgressNorm() const;

    void mouseDown(const juce::MouseEvent& e) override;
    void mouseDrag(const juce::MouseEvent& e) override;
    void mouseUp(const juce::MouseEvent& e) override;

    juce::Rectangle<int> progressBarArea() const;

    static juce::String formatTime(double seconds);

    JUCE_DECLARE_NON_COPYABLE_WITH_LEAK_DETECTOR(MiniPlayerComponent)
};
