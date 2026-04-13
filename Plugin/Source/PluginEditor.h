#pragma once
#include <juce_gui_extra/juce_gui_extra.h>
#include "PluginProcessor.h"
#include <thread>

class CoOpAudioProcessorEditor;

// Separate MouseListener to avoid ambiguity
// (AudioProcessorEditor already inherits MouseListener via Component)
struct DragMouseListener : public juce::MouseListener
{
    explicit DragMouseListener (CoOpAudioProcessorEditor& o) : owner (o) {}
    void mouseDrag (const juce::MouseEvent&) override;
    void mouseUp   (const juce::MouseEvent&) override;
    CoOpAudioProcessorEditor& owner;
};

//==============================================================================
class CoOpAudioProcessorEditor final
    : public juce::AudioProcessorEditor,
      public juce::DragAndDropContainer
{
public:
    explicit CoOpAudioProcessorEditor (CoOpAudioProcessor&);
    ~CoOpAudioProcessorEditor() override;

    void paint   (juce::Graphics&) override;
    void resized () override;

    // Called by DragMouseListener
    void onMouseDrag (const juce::MouseEvent&);
    void onMouseUp   (const juce::MouseEvent&);

private:
    static constexpr int kWidth  = 300;
    static constexpr int kHeight = 500;

    juce::File downloadToTemp (const juce::String& url, const juce::String& name);

    void handlePrefetch      (const juce::var& args, juce::WebBrowserComponent::NativeFunctionCompletion);
    void handleStartDrag     (const juce::var& args, juce::WebBrowserComponent::NativeFunctionCompletion);
    void handleWriteAudioFile(const juce::var& args, juce::WebBrowserComponent::NativeFunctionCompletion);

    juce::WebBrowserComponent browser;
    DragMouseListener         dragListener { *this };

    // Prefetch cache (main-thread only)
    juce::File   cachedFile;
    juce::String cachedName;
    bool         cacheReady     { false };
    bool         isDownloading  { false };   // true while any download thread runs

    // If startAudioDrag arrives while prefetch is in progress, park the
    // completion here so prefetch can arm the drag when it finishes.
    std::shared_ptr<juce::WebBrowserComponent::NativeFunctionCompletion> pendingDragComp;

    // Set by handleStartDrag, consumed by onMouseDrag
    juce::File   pendingDragFile;
    bool         dragArmed      { false };

    JUCE_DECLARE_NON_COPYABLE_WITH_LEAK_DETECTOR (CoOpAudioProcessorEditor)
};
