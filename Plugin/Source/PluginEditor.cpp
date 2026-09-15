#include "PluginEditor.h"

//==============================================================================
OrbAudioProcessorEditor::OrbAudioProcessorEditor (OrbAudioProcessor& p)
    : AudioProcessorEditor (&p),
      processorRef (p)
{
    // Restore the size this instance was last dragged/set to; fall back
    // to the compact default for fresh instances.
    {
        const int w = processorRef.editorW.load();
        const int h = processorRef.editorH.load();
       #ifdef ORB_SURFACE
        if (w >= 900 && h >= 600)        setSize (w, h);   // anything above the workspace floor restores
       #else
        if (w >= kWidth && h >= kHeight) setSize (w, h);
       #endif
        else                             setSize (kWidth, kHeight);
    }
    // Freely resizable from the bottom-right corner (second arg adds the
    // corner grip); programmatic setSize() from JS keeps working too.
    setResizable (true, true);
    #ifdef ORB_SURFACE
    setResizeLimits (900, 600, 2200, 1400);   // wide workspace: roomy ceiling, laptop-friendly floor
   #else
    setResizeLimits (kWidth, kHeight, 1600, 1200);
   #endif

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
    // Whoever asked for this width (a remembered size, the page's shared
    // size, the grip) — it may not exceed the display this window is on,
    // or the host scales the whole view down and leaves a strip below.
    if (auto* peer = getPeer())
    {
        if (const auto* display = juce::Desktop::getInstance().getDisplays().getDisplayForRect (peer->getBounds()))
        {
            const int maxW = juce::jmax (kMinWidth, display->userArea.getWidth() - 80);
            if (getWidth() > maxW)
            {
                auto f = juce::File::getSpecialLocation (juce::File::userHomeDirectory).getChildFile ("Library/Logs/Orb/sounds.log");
                f.appendText (juce::Time::getCurrentTime().toString (true, true) + "  clamp " + juce::String (getWidth()) + " -> " + juce::String (maxW) + "\n");
                setSize (maxW, getHeight());   // re-enters resized() at the clamped width
                return;
            }
        }
    }
    if (auto* b = processorRef.getBrowser())
        b->setBounds (getLocalBounds());

    // The host may simply not follow a growth (Logic keeps its window and
    // scales the view instead). Look again shortly: if the window is still
    // narrower than we are, take the window's width.
    {
        juce::Component::SafePointer<OrbAudioProcessorEditor> safe (this);
        juce::Timer::callAfterDelay (250, [safe]
        {
            auto* c = safe.getComponent();
            if (c == nullptr) return;
            auto* peer = c->getPeer();
            if (peer == nullptr) return;
            const int hostW = peer->getBounds().getWidth();
            const int hostH = peer->getBounds().getHeight();
            auto f = juce::File::getSpecialLocation (juce::File::userHomeDirectory).getChildFile ("Library/Logs/Orb/sounds.log");
            f.appendText (juce::Time::getCurrentTime().toString (true, true) + "  check editor " + c->getLocalBounds().toString()
                          + "  host " + peer->getBounds().toString() + "\n");
            if (hostW >= kMinWidth && (hostW < c->getWidth() - 2 || hostH < c->getHeight() - 2))
                c->setSize (juce::jmin (c->getWidth(), hostW), juce::jmin (c->getHeight(), hostH));
        });
    }

    // Remember the size so reopening the window (and reloading the
    // session) comes back at the user's chosen size.
    processorRef.editorW.store (getWidth());
    processorRef.editorH.store (getHeight());
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
    clampToDisplay();
}

// The width must fit the display the window actually lands on — at
// construction we only knew the mouse's display, and a remembered width
// from a wider monitor made Logic scale the whole view down to fit its
// window, leaving a strip below. Only ever shrinks; height untouched.
void OrbAudioProcessorEditor::clampToDisplay()
{
    auto* peer = getPeer();
    if (peer == nullptr) return;
    const auto* display = juce::Desktop::getInstance().getDisplays().getDisplayForRect (peer->getBounds());
    if (display == nullptr) return;
    const int maxW = juce::jmax (kMinWidth, display->userArea.getWidth() - 80);
    if (getWidth() > maxW)
        setSize (maxW, getHeight());
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
