#pragma once
#include <juce_gui_extra/juce_gui_extra.h>
#include "PluginProcessor.h"
#include "DragMonitor.h"
#include <string>
#include <vector>

//==============================================================================
/**
 * The editor is now a lightweight view — all heavy state (browser,
 * audio-capture timer, native-function handlers) lives in the processor
 * so the live broadcast keeps running when the DAW closes this window.
 *
 * The editor just:
 *   • Adopts processor->getBrowser() as a visible child component.
 *   • Owns the platform-specific DragMonitor (which needs a live NSWindow).
 */
class CoOpAudioProcessorEditor final
    : public juce::AudioProcessorEditor,
      public juce::DragAndDropContainer
{
public:
    explicit CoOpAudioProcessorEditor (CoOpAudioProcessor&);
    ~CoOpAudioProcessorEditor() override;

    void paint                  (juce::Graphics&) override;
    void resized                () override;
    void parentHierarchyChanged () override;

    // Called from processor when a write-audio handler completes. Editor
    // forwards to its DragMonitor (which is tied to the current NSWindow).
    void armDragMonitor (const std::string& path);
    void armDragMonitorMultiple (const std::vector<std::string>& paths);

private:
    static constexpr int kWidth  = 300;
    static constexpr int kHeight = 500;

    void trySetupDropHandling();

    CoOpAudioProcessor& processorRef;
    DragMonitor         dragMonitor;
    int                 dropSetupRetryCount { 0 };

    JUCE_DECLARE_NON_COPYABLE_WITH_LEAK_DETECTOR (CoOpAudioProcessorEditor)
};
