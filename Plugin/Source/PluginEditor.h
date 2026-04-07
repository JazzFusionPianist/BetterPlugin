#pragma once
#include <juce_gui_extra/juce_gui_extra.h>
#include "PluginProcessor.h"
#include <thread>

//==============================================================================
/**
 * CoOp Plugin Editor
 *
 * Hosts a WKWebView that loads the deployed React + Vite app.
 * Registers native JS functions for audio drag-to-DAW:
 *   window.__JUCE__.backend.prefetchAudio(url, name)  — hover, pre-downloads file
 *   window.__JUCE__.backend.startAudioDrag(url, name) — mousedown, initiates OS drag
 */
class CoOpAudioProcessorEditor final
    : public juce::AudioProcessorEditor,
      public juce::DragAndDropContainer
{
public:
    explicit CoOpAudioProcessorEditor (CoOpAudioProcessor&);
    ~CoOpAudioProcessorEditor() override = default;

    void paint   (juce::Graphics&) override;
    void resized () override;

private:
    static constexpr int kWidth  = 300;
    static constexpr int kHeight = 500;

    // Downloads url to temp dir synchronously, returns the File (empty on failure)
    static juce::File downloadToTemp (const juce::String& url, const juce::String& name);

    // Native function handlers (called on main thread via JUCE message loop)
    void handlePrefetch  (const juce::var& args, juce::WebBrowserComponent::NativeFunctionCompletion);
    void handleStartDrag (const juce::var& args, juce::WebBrowserComponent::NativeFunctionCompletion);

    // Performs the actual OS-level drag after the file is ready
    void doDrag (const juce::File& file, juce::WebBrowserComponent::NativeFunctionCompletion);

    juce::WebBrowserComponent browser;

    // Pre-fetch cache (main-thread only)
    juce::File   cachedFile;
    juce::String cachedName;
    bool         cacheReady { false };

    JUCE_DECLARE_NON_COPYABLE_WITH_LEAK_DETECTOR (CoOpAudioProcessorEditor)
};
