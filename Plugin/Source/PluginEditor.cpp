#include "PluginEditor.h"

//==============================================================================
OrbAudioProcessorEditor::OrbAudioProcessorEditor (OrbAudioProcessor& p)
    : AudioProcessorEditor (&p),
      processorRef (p)
{
    setSize (kWidth, kHeight);
    // Enable resizing so DAWs honor programmatic setSize() (called from
    // the Expand View button on the live viewer). Min/max bounds avoid
    // pathological sizes if the JS calls it with bad args.
    setResizable (true, false);
    setResizeLimits (kWidth, kHeight, 1600, 1200);

    // Register a callback the processor can invoke from the JS-callable
    // setPluginSize native function.
    juce::Component::SafePointer<OrbAudioProcessorEditor> safe (this);
    processorRef.setEditorResizeFn ([safe] (int w, int h)
    {
        if (auto* c = safe.getComponent())
            c->setSize (w, h);
    });

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

OrbAudioProcessorEditor::~OrbAudioProcessorEditor()
{
    dragMonitor.disarm();
    // Clear the resize callback so a future setPluginSize call doesn't
    // dereference our dead self.
    processorRef.setEditorResizeFn ({});

    // IMPORTANT: remove — do NOT delete — the browser. Processor owns it.
    if (auto* b = processorRef.getBrowser())
        removeChildComponent (b);
}

//==============================================================================
void OrbAudioProcessorEditor::paint (juce::Graphics& g)
{
    g.fillAll (juce::Colour (0xff1a1a1a));
}

void OrbAudioProcessorEditor::resized()
{
    if (auto* b = processorRef.getBrowser())
        b->setBounds (getLocalBounds());
}

//==============================================================================
void OrbAudioProcessorEditor::armDragMonitor (const std::string& path)
{
    dragMonitor.arm (path);
}

void OrbAudioProcessorEditor::armDragMonitorMultiple (const std::vector<std::string>& paths)
{
    dragMonitor.armMultiple (paths);
}

//==============================================================================
void OrbAudioProcessorEditor::parentHierarchyChanged()
{
    dropSetupRetryCount = 0;
    trySetupDropHandling();
}

void OrbAudioProcessorEditor::trySetupDropHandling()
{
    if (auto* peer = getPeer())
    {
        juce::Component::SafePointer<OrbAudioProcessorEditor> safe (this);

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

        juce::Component::SafePointer<OrbAudioProcessorEditor> safe (this);
        juce::Timer::callAfterDelay (delayMs, [safe]
        {
            if (auto* c = safe.getComponent())
                c->trySetupDropHandling();
        });
    }
}
