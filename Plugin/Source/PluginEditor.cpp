#include "PluginEditor.h"

//==============================================================================
// DragMouseListener
//==============================================================================
void DragMouseListener::mouseDrag (const juce::MouseEvent& e) { owner.onMouseDrag (e); }
void DragMouseListener::mouseUp   (const juce::MouseEvent& e) { owner.onMouseUp   (e); }

//==============================================================================
juce::File CoOpAudioProcessorEditor::downloadToTemp (const juce::String& url,
                                                      const juce::String& name)
{
    juce::File tmp = juce::File::getSpecialLocation (juce::File::tempDirectory)
                         .getChildFile ("CoOp_" + name);

    auto stream = juce::URL (url).createInputStream (
        juce::URL::InputStreamOptions (juce::URL::ParameterHandling::inAddress)
            .withConnectionTimeoutMs (15000));

    if (stream == nullptr) return juce::File{};

    juce::FileOutputStream out (tmp);
    if (! out.openedOk()) return juce::File{};

    const juce::int64 total      = stream->getTotalLength();
    juce::int64       downloaded = 0;
    int               lastReported = -1;
    const juce::int64 deadline   = juce::Time::currentTimeMillis() + 45000; // 45s hard limit

    constexpr int chunkSize = 16384;
    juce::HeapBlock<char> buf (chunkSize);

    while (! stream->isExhausted())
    {
        // Abort if total download time exceeds 45 seconds
        if (juce::Time::currentTimeMillis() > deadline)
            return juce::File{};

        const int bytesRead = stream->read (buf.getData(), chunkSize);
        if (bytesRead <= 0) break;

        out.write (buf.getData(), (size_t) bytesRead);
        downloaded += bytesRead;

        // Report at most 10 progress updates to avoid flooding the message
        // thread with synchronous evaluateJavascript round-trips to WKWebView.
        const int reportVal = total > 0
            ? (int) (downloaded * 10 / total)          // 10 steps (0–9)
            : (int) (downloaded / (512 * 1024));        // every 512 KB
        if (reportVal != lastReported)
        {
            lastReported = reportVal;
            juce::String script = "window.dispatchEvent(new CustomEvent('__juceProgress',"
                                  "{detail:{dl:" + juce::String (downloaded)
                                  + ",tot:" + juce::String (total) + "}}))";
            juce::MessageManager::callAsync ([this, script] {
                browser.evaluateJavascript (script, [] (juce::WebBrowserComponent::EvaluationResult) {});
            });
        }
    }

    return tmp;
}

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

    // Global listener captures mouse events from the native WKWebView layer
    juce::Desktop::getInstance().addGlobalMouseListener (&dragListener);

    browser.goToURL (COOP_APP_URL);
}

CoOpAudioProcessorEditor::~CoOpAudioProcessorEditor()
{
    juce::Desktop::getInstance().removeGlobalMouseListener (&dragListener);
}

//==============================================================================
// prefetchAudio — hover → background download
//==============================================================================
void CoOpAudioProcessorEditor::handlePrefetch (const juce::var& args,
                                                juce::WebBrowserComponent::NativeFunctionCompletion completion)
{
    if (! args.isArray() || args.size() < 2) { completion (juce::var ("error")); return; }

    juce::String url  = args[0].toString();
    juce::String name = args[1].toString();

    if (cacheReady && cachedName == name) { completion (juce::var ("cached")); return; }

    // If a download is already running for this file, discard this prefetch request
    // rather than starting a second simultaneous connection (CDN throttles the second one).
    if (isDownloading && cachedName == name) { completion (juce::var ("pending")); return; }

    cacheReady     = false;
    isDownloading  = true;
    cachedName     = name;

    auto compPtr = std::make_shared<juce::WebBrowserComponent::NativeFunctionCompletion> (std::move (completion));

    std::thread ([this, url, name, compPtr] {
        auto file = downloadToTemp (url, name);
        juce::MessageManager::callAsync ([this, file, name, compPtr] {
            isDownloading = false;
            if (file.existsAsFile() && cachedName == name)
            {
                cachedFile = file;
                cacheReady = true;
                (*compPtr) (juce::var ("ok"));

                // If startAudioDrag arrived while we were downloading, arm it now
                if (pendingDragComp)
                {
                    pendingDragFile = file;
                    dragArmed       = true;
                    juce::String script = "if(window.__juceStartDragComplete)"
                                         "window.__juceStartDragComplete('armed')";
                    browser.evaluateJavascript (script, [] (juce::WebBrowserComponent::EvaluationResult) {});
                    (*pendingDragComp) (juce::var ("armed"));
                    pendingDragComp.reset();
                }
            }
            else
            {
                (*compPtr) (juce::var ("error"));
                if (pendingDragComp)
                {
                    juce::String script = "if(window.__juceStartDragComplete)"
                                         "window.__juceStartDragComplete('error')";
                    browser.evaluateJavascript (script, [] (juce::WebBrowserComponent::EvaluationResult) {});
                    (*pendingDragComp) (juce::var ("error"));
                    pendingDragComp.reset();
                }
            }
        });
    }).detach();
}

//==============================================================================
// startAudioDrag — mousedown → arm the drag (actual drag fires in onMouseDrag)
//==============================================================================
void CoOpAudioProcessorEditor::handleStartDrag (const juce::var& args,
                                                 juce::WebBrowserComponent::NativeFunctionCompletion completion)
{
    if (! args.isArray() || args.size() < 2) { completion (juce::var ("error")); return; }

    juce::String url  = args[0].toString();
    juce::String name = args[1].toString();

    auto armDrag = [this] (juce::File f) {
        pendingDragFile = f;
        dragArmed       = true;
    };

    if (cacheReady && cachedName == name)
    {
        armDrag (cachedFile);
        completion (juce::var ("armed"));
        return;
    }

    // If prefetch is already downloading this file, park the completion and
    // let prefetch arm the drag when it finishes — avoids a second simultaneous
    // connection that CDNs throttle to 0 bps.
    if (isDownloading && cachedName == name)
    {
        pendingDragComp = std::make_shared<juce::WebBrowserComponent::NativeFunctionCompletion> (std::move (completion));
        return;
    }

    // Not cached — download then arm
    cacheReady    = false;
    isDownloading = true;
    cachedName    = name;
    auto compPtr = std::make_shared<juce::WebBrowserComponent::NativeFunctionCompletion> (std::move (completion));

    std::thread ([this, url, name, compPtr] {
        auto file = downloadToTemp (url, name);
        juce::MessageManager::callAsync ([this, file, name, compPtr] {
            isDownloading = false;
            juce::String result;
            if (file.existsAsFile())
            {
                cachedFile      = file;
                cacheReady      = true;
                cachedName      = name;
                pendingDragFile = file;
                dragArmed       = true;
                result          = "armed";
            }
            else
            {
                result = "error";
            }

            // Primary path: call NativeFunctionCompletion to resolve the JS Promise
            (*compPtr) (juce::var (result));

            // Fallback path: directly invoke JS callback in case the Promise
            // resolution is dropped by JUCE internals (observed in some builds)
            juce::String script = "if(window.__juceStartDragComplete)"
                                  "window.__juceStartDragComplete('" + result + "')";
            browser.evaluateJavascript (script, [] (juce::WebBrowserComponent::EvaluationResult) {});
        });
    }).detach();
}

//==============================================================================
// onMouseDrag — fires during real mouse motion → correct moment for OS drag
//==============================================================================
void CoOpAudioProcessorEditor::onMouseDrag (const juce::MouseEvent& e)
{
    if (! dragArmed || ! pendingDragFile.existsAsFile()) return;
    if (e.getDistanceFromDragStart() < 8) return;

    dragArmed = false;
    juce::File file  = pendingDragFile;
    pendingDragFile  = juce::File{};

    performExternalDragDropOfFiles ({ file.getFullPathName() }, /*canMove=*/ false, this);
}

void CoOpAudioProcessorEditor::onMouseUp (const juce::MouseEvent&)
{
    dragArmed       = false;
    pendingDragFile = juce::File{};
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
