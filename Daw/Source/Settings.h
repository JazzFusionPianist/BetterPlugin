#pragma once
#include <juce_gui_extra/juce_gui_extra.h>

void slurStyleWindow (void* nsView);

/*  Settings: a window of its own (the app menu's "Settings…", command comma), where the app menu's "Audio Settings…"
    stood. Its parts are named down its left and the chosen one is laid out on its right; audio is one of them, and the
    first that is there. The window is a page of the room's (ui/settings.html, drawn with the room's own kit), which
    asks the app through the same one function the room does; what it may ask is in MainComponent (settingsRead,
    settingsSet, settingsTone, settingsClose). A change is taken at once, as the Mac does it: nothing to confirm.
    Draft: design/settings draft 1.  */
class SettingsWindow final : public juce::DocumentWindow
{
public:
    using Done = juce::WebBrowserComponent::NativeFunctionCompletion;
    using Ask = std::function<void (const juce::String&, const juce::var&, Done)>;
    using Serve = std::function<std::optional<juce::WebBrowserComponent::Resource> (const juce::String&)>;

    SettingsWindow (Serve serve, Ask ask, const juce::String& part, const juce::String& lang)
        : DocumentWindow ("Settings", juce::Colour (0xff1b1b1a), DocumentWindow::closeButton | DocumentWindow::minimiseButton)      // named the Mac's way, like the line of the menu that opens it
    {
        setUsingNativeTitleBar (true);
        web = std::make_unique<juce::WebBrowserComponent> (
            juce::WebBrowserComponent::Options{}
                .withNativeIntegrationEnabled()
                .withKeepPageLoadedWhenBrowserIsHidden()
                .withUserScript ("window.__LANG = '" + lang + "';")           // the language the page is written in, known before it is drawn (ui/lang.js)
                .withResourceProvider ([serve] (const juce::String& path) { return serve (path); })
                .withNativeFunction ("daw", [ask] (const juce::Array<juce::var>& args, Done done)
                {
                    ask (args.size() > 0 ? args[0].toString() : juce::String(), args.size() > 1 ? args[1] : juce::var(), std::move (done));
                }));
        web->setSize (kWidth, kHeight);
        setContentNonOwned (web.get(), true);
        setResizable (false, false);
        show (part);
        web->goToURL (juce::WebBrowserComponent::getResourceProviderRoot() + "settings.html" + (part.isNotEmpty() ? "?part=" + juce::URL::addEscapeChars (part, true) : juce::String()));
    }
    ~SettingsWindow() override { clearContentComponent(); }

    /** Brought forward, where it was left; `part`: on that part. */
    void show (const juce::String& part)
    {
        if (! isOnDesktop() || ! isVisible()) { centreWithSize (getWidth(), getHeight()); setVisible (true); }
        if (auto* p = getPeer()) slurStyleWindow (p->getNativeHandle());
        toFront (true);
        asked = part;                                                  // the page asks what is wanted of it as it reads (a window just shown may not hear an event yet)
    }
    /** The part that was asked for and not yet shown, once. */
    juce::String takeAsked() { return std::exchange (asked, {}); }
    /** The page asks for a size of its own (display is larger than the other parts): the window grows or shrinks about
        its middle, and stays on the screen. */
    void sizeTo (int w, int h)
    {
        w = juce::jlimit (400, 1800, w); h = juce::jlimit (300, 1200, h);
        if (web->getWidth() == w && web->getHeight() == h) return;
        const auto mid = getBounds().getCentre();
        web->setSize (w, h);
        setCentrePosition (mid);
        if (auto* d = juce::Desktop::getInstance().getDisplays().getDisplayForRect (getBounds())) setBounds (getBounds().constrainedWithin (d->userArea));
    }
    void closeButtonPressed() override { setVisible (false); }
    juce::WebBrowserComponent& page() { return *web; }

    static constexpr int kWidth = 700, kHeight = 440;                  // the draft's window, less its bar (which is the Mac's)
private:
    std::unique_ptr<juce::WebBrowserComponent> web;
    juce::String asked;
};
