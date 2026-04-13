#pragma once
#include <juce_gui_extra/juce_gui_extra.h>
#include "PluginProcessor.h"
#include "DragMonitor.h"
#include <thread>

//==============================================================================
class CoOpAudioProcessorEditor final
    : public juce::AudioProcessorEditor,
      public juce::DragAndDropContainer
{
public:
    explicit CoOpAudioProcessorEditor (CoOpAudioProcessor&);
    ~CoOpAudioProcessorEditor() override;

    void paint                  (juce::Graphics&) override;
    void resized                () override;
    void parentHierarchyChanged () override;   // sets up WKWebView drop handler

private:
    static constexpr int kWidth  = 300;
    static constexpr int kHeight = 500;

    juce::File downloadToTemp (const juce::String& url, const juce::String& name);

    void handlePrefetch      (const juce::var& args, juce::WebBrowserComponent::NativeFunctionCompletion);
    void handleStartDrag     (const juce::var& args, juce::WebBrowserComponent::NativeFunctionCompletion);
    void handleWriteAudioFile(const juce::var& args, juce::WebBrowserComponent::NativeFunctionCompletion);

    // Retries setupDropHandling until WKWebView is available (lazy init).
    void trySetupDropHandling();

    juce::WebBrowserComponent browser;
    DragMonitor               dragMonitor;   // NSEvent-based drag (bypasses WKWebView)

    // Prefetch cache (main-thread only)
    juce::File   cachedFile;
    juce::String cachedName;
    bool         cacheReady     { false };
    bool         isDownloading  { false };

    std::shared_ptr<juce::WebBrowserComponent::NativeFunctionCompletion> pendingDragComp;

    // Legacy members kept for handlePrefetch / handleStartDrag compatibility
    juce::File   pendingDragFile;
    bool         dragArmed      { false };

    // Drop-handler retry counter (incremented by trySetupDropHandling).
    int          dropSetupRetryCount { 0 };

    JUCE_DECLARE_NON_COPYABLE_WITH_LEAK_DETECTOR (CoOpAudioProcessorEditor)
};
