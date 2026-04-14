#include "PluginEditor.h"

//==============================================================================
CoOpAudioProcessorEditor::CoOpAudioProcessorEditor (CoOpAudioProcessor& p)
    : AudioProcessorEditor (&p),
      processorRef (p)
{
    setSize (kWidth, kHeight);
    setResizable (false, false);

    // Adopt the processor-owned browser as our visible child. When this
    // editor is destroyed, JUCE removes the browser from its parent but the
    // WebBrowserComponent itself stays alive (owned by the processor) so
    // WebRTC / JS state survives plugin-window close/reopen.
    if (auto* b = processorRef.getBrowser())
    {
        addAndMakeVisible (*b);
        b->setBounds (getLocalBounds());
    }
}

CoOpAudioProcessorEditor::~CoOpAudioProcessorEditor()
{
    dragMonitor.disarm();

    // IMPORTANT: remove — do NOT delete — the browser. Processor owns it.
    if (auto* b = processorRef.getBrowser())
        removeChildComponent (b);
}

//==============================================================================
void CoOpAudioProcessorEditor::paint (juce::Graphics& g)
{
    g.fillAll (juce::Colour (0xff1a1a1a));
}

void CoOpAudioProcessorEditor::resized()
{
    if (auto* b = processorRef.getBrowser())
        b->setBounds (getLocalBounds());
}

//==============================================================================
void CoOpAudioProcessorEditor::armDragMonitor (const std::string& path)
{
    dragMonitor.arm (path);
}

void CoOpAudioProcessorEditor::armDragMonitorMultiple (const std::vector<std::string>& paths)
{
    dragMonitor.armMultiple (paths);
}

//==============================================================================
void CoOpAudioProcessorEditor::parentHierarchyChanged()
{
    dropSetupRetryCount = 0;
    trySetupDropHandling();
}

void CoOpAudioProcessorEditor::trySetupDropHandling()
{
    if (auto* peer = getPeer())
    {
        juce::Component::SafePointer<CoOpAudioProcessorEditor> safe (this);

        dragMonitor.setupDropHandling (
            peer->getNativeHandle(),
            [safe] (std::string name, std::string base64)
            {
                if (auto* c = safe.getComponent())
                {
                    juce::String jsName   = juce::String (name.c_str()).replace ("'", "\\'");
                    juce::String jsBase64 = juce::String (base64.c_str());

                    juce::String script =
                        "window.dispatchEvent(new CustomEvent('__juceFileDrop',"
                        "{detail:{name:'" + jsName + "',data:'" + jsBase64 + "'}}))";

                    if (auto* b = c->processorRef.getBrowser())
                        b->evaluateJavascript (script, [] (juce::WebBrowserComponent::EvaluationResult) {});
                }
            });
    }

    if (! dragMonitor.isDropSetupDone() && dropSetupRetryCount < 6)
    {
        ++dropSetupRetryCount;
        const int delayMs = 300 * dropSetupRetryCount;

        juce::Component::SafePointer<CoOpAudioProcessorEditor> safe (this);
        juce::Timer::callAfterDelay (delayMs, [safe]
        {
            if (auto* c = safe.getComponent())
                c->trySetupDropHandling();
        });
    }
}
