#include "PluginEditor.h"

//==============================================================================
// Helpers
//==============================================================================

juce::File CoOpAudioProcessorEditor::downloadToTemp (const juce::String& url,
                                                      const juce::String& name)
{
    juce::File tmp = juce::File::getSpecialLocation (juce::File::tempDirectory)
                         .getChildFile ("CoOp_" + name);

    auto stream = juce::URL (url).createInputStream (
        juce::URL::InputStreamOptions (juce::URL::ParameterHandling::inAddress)
            .withConnectionTimeoutMs (15000));

    if (stream == nullptr)
        return {};

    juce::FileOutputStream out (tmp);
    if (! out.openedOk())
        return {};

    out.writeFromInputStream (*stream, -1);
    return tmp;
}

//==============================================================================
// Constructor
//==============================================================================

CoOpAudioProcessorEditor::CoOpAudioProcessorEditor (CoOpAudioProcessor& p)
    : AudioProcessorEditor (&p),
      browser (juce::WebBrowserComponent::Options{}
                   .withKeepPageLoadedWhenBrowserIsHidden()
                   .withNativeFunction ("prefetchAudio",
                       [this] (const juce::var& args,
                               juce::WebBrowserComponent::NativeFunctionCompletion completion)
                       {
                           handlePrefetch (args, std::move (completion));
                       })
                   .withNativeFunction ("startAudioDrag",
                       [this] (const juce::var& args,
                               juce::WebBrowserComponent::NativeFunctionCompletion completion)
                       {
                           handleStartDrag (args, std::move (completion));
                       }))
{
    addAndMakeVisible (browser);
    setSize (kWidth, kHeight);
    setResizable (false, false);
    browser.goToURL (COOP_APP_URL);
}

//==============================================================================
// Native function: prefetchAudio(url, name)
// Called on mouseenter — downloads file to temp in background so drag is instant
//==============================================================================

void CoOpAudioProcessorEditor::handlePrefetch (const juce::var& args,
                                                juce::WebBrowserComponent::NativeFunctionCompletion completion)
{
    // JS: window.__JUCE__.backend.prefetchAudio(url, name)
    // args is an Array var: args[0] = url, args[1] = name
    if (! args.isArray() || args.size() < 2)
    {
        completion (juce::var ("error: bad args"));
        return;
    }

    juce::String url  = args[0].toString();
    juce::String name = args[1].toString();

    // Already cached
    if (cacheReady && cachedName == name)
    {
        completion (juce::var ("cached"));
        return;
    }

    cacheReady = false;
    cachedName = name;

    // Download in background thread, update cache on main thread
    auto compPtr = std::make_shared<juce::WebBrowserComponent::NativeFunctionCompletion> (
                       std::move (completion));

    std::thread ([this, url, name, compPtr] {
        auto file = downloadToTemp (url, name);

        juce::MessageManager::callAsync ([this, file, name, compPtr] {
            if (file.existsAsFile() && cachedName == name)
            {
                cachedFile = file;
                cacheReady = true;
                (*compPtr) (juce::var ("ok"));
            }
            else
            {
                (*compPtr) (juce::var ("error: download failed"));
            }
        });
    }).detach();
}

//==============================================================================
// Native function: startAudioDrag(url, name)
// Called on mousedown — uses cached file or downloads then drags
//==============================================================================

void CoOpAudioProcessorEditor::handleStartDrag (const juce::var& args,
                                                 juce::WebBrowserComponent::NativeFunctionCompletion completion)
{
    if (! args.isArray() || args.size() < 2)
    {
        completion (juce::var ("error: bad args"));
        return;
    }

    juce::String url  = args[0].toString();
    juce::String name = args[1].toString();

    // File already prefetched on hover — start drag immediately
    if (cacheReady && cachedName == name)
    {
        doDrag (cachedFile, std::move (completion));
        return;
    }

    // Not cached yet — download then drag
    cacheReady = false;
    cachedName = name;

    auto compPtr = std::make_shared<juce::WebBrowserComponent::NativeFunctionCompletion> (
                       std::move (completion));

    std::thread ([this, url, name, compPtr] {
        auto file = downloadToTemp (url, name);

        juce::MessageManager::callAsync ([this, file, name, compPtr] {
            if (file.existsAsFile())
            {
                cachedFile = file;
                cacheReady = true;
                cachedName = name;
                doDrag (file, std::move (*compPtr));
            }
            else
            {
                (*compPtr) (juce::var ("error: download failed"));
            }
        });
    }).detach();
}

//==============================================================================
// Initiates OS-level file drag — Logic Pro (and any DAW) can receive it
//==============================================================================

void CoOpAudioProcessorEditor::doDrag (const juce::File& file,
                                        juce::WebBrowserComponent::NativeFunctionCompletion completion)
{
    // performExternalDragDropOfFiles uses NSDraggingSession on macOS.
    // The callback fires when the user releases the mouse (drop or cancel).
    auto compPtr = std::make_shared<juce::WebBrowserComponent::NativeFunctionCompletion> (
                       std::move (completion));

    performExternalDragDropOfFiles (
        { file.getFullPathName() },
        /*canMoveFiles=*/ false,
        /*sourceComponent=*/ &browser,
        /*callback=*/ [compPtr] { (*compPtr) (juce::var ("dropped")); });
}

//==============================================================================

void CoOpAudioProcessorEditor::paint (juce::Graphics& g)
{
    g.fillAll (juce::Colour (0xff1a1a1a));
}

void CoOpAudioProcessorEditor::resized()
{
    browser.setBounds (getLocalBounds());
}
