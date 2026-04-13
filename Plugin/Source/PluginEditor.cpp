#include "PluginEditor.h"

//==============================================================================
// Proper base64 decoder — juce::Base64::convertFromBase64 returns false on '='
// padding and also drops the last partial group when padding is absent.
// This streaming decoder handles both cases correctly.
static bool decodeBase64 (const juce::String& b64, juce::MemoryBlock& out)
{
    static const int8_t kDec[256] = {
        -1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,  //   0– 15
        -1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,  //  16– 31
        -1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,62,-1,-1,-1,63,  //  32– 47  '+' '/'
        52,53,54,55,56,57,58,59,60,61,-1,-1,-1,-1,-1,-1,  //  48– 63  '0'–'9'
        -1, 0, 1, 2, 3, 4, 5, 6, 7, 8, 9,10,11,12,13,14, //  64– 79  'A'–'O'
        15,16,17,18,19,20,21,22,23,24,25,-1,-1,-1,-1,-1,  //  80– 95  'P'–'Z'
        -1,26,27,28,29,30,31,32,33,34,35,36,37,38,39,40,  //  96–111  'a'–'o'
        41,42,43,44,45,46,47,48,49,50,51,-1,-1,-1,-1,-1,  // 112–127  'p'–'z'
        -1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,  // 128–143
        -1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,  // 144–159
        -1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,  // 160–175
        -1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,  // 176–191
        -1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,  // 192–207
        -1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,  // 208–223
        -1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,  // 224–239
        -1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,  // 240–255
    };

    out.setSize (0, false);

    const auto  utf8 = b64.toUTF8();
    const char* p    = utf8.getAddress();
    const int   len  = b64.length();

    uint32_t acc  = 0;
    int      bits = 0;

    for (int i = 0; i < len; ++i)
    {
        const uint8_t c = (uint8_t) p[i];
        if (c == '=') break;          // padding — remaining bytes are all zeros

        const int8_t v = (c < 128) ? kDec[c] : -1;
        if (v < 0) return false;      // invalid character

        acc  = (acc << 6) | (uint32_t) v;
        bits += 6;

        if (bits >= 8)
        {
            bits -= 8;
            const uint8_t byte = (uint8_t) (acc >> bits);
            out.append (&byte, 1);
        }
    }

    return out.getSize() > 0;
}

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
                       })
                   .withNativeFunction ("writeAudioFile",
                       [this] (const juce::var& args,
                               juce::WebBrowserComponent::NativeFunctionCompletion completion)
                       {
                           handleWriteAudioFile (args, std::move (completion));
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
// writeAudioFile — JS downloads via fetch(), sends base64, C++ writes to disk
//==============================================================================
void CoOpAudioProcessorEditor::handleWriteAudioFile (const juce::var& args,
                                                      juce::WebBrowserComponent::NativeFunctionCompletion completion)
{
    if (! args.isArray() || args.size() < 2) { completion (juce::var ("error")); return; }

    juce::String base64 = args[0].toString();
    juce::String name   = args[1].toString();

    auto compPtr = std::make_shared<juce::WebBrowserComponent::NativeFunctionCompletion> (std::move (completion));

    std::thread ([this, base64, name, compPtr] {
        juce::MemoryBlock data;
        if (! decodeBase64 (base64, data))
        {
            juce::MessageManager::callAsync ([compPtr] { (*compPtr) (juce::var ("error")); });
            return;
        }

        juce::File tmp = juce::File::getSpecialLocation (juce::File::tempDirectory)
                             .getChildFile ("CoOp_" + name);

        if (! tmp.replaceWithData (data.getData(), data.getSize()))
        {
            juce::MessageManager::callAsync ([compPtr] { (*compPtr) (juce::var ("error")); });
            return;
        }

        juce::MessageManager::callAsync ([this, tmp, name, compPtr] {
            cachedFile      = tmp;
            cachedName      = name;
            cacheReady      = true;
            isDownloading   = false;
            pendingDragFile = tmp;
            dragArmed       = true;

            (*compPtr) (juce::var ("armed"));
            browser.evaluateJavascript (
                "if(window.__juceStartDragComplete)window.__juceStartDragComplete('armed')",
                [] (juce::WebBrowserComponent::EvaluationResult) {});
        });
    }).detach();
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
