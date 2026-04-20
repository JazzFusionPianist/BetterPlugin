#include "PluginProcessor.h"
#include "PluginEditor.h"
#include <thread>

//==============================================================================
// Base64 decoder — handles both padded and unpadded input.
// (Same as the former PluginEditor helper.)
static bool decodeBase64 (const juce::String& b64, juce::MemoryBlock& out)
{
    static const int8_t kDec[256] = {
        -1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,
        -1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,
        -1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,62,-1,-1,-1,63,
        52,53,54,55,56,57,58,59,60,61,-1,-1,-1,-1,-1,-1,
        -1, 0, 1, 2, 3, 4, 5, 6, 7, 8, 9,10,11,12,13,14,
        15,16,17,18,19,20,21,22,23,24,25,-1,-1,-1,-1,-1,
        -1,26,27,28,29,30,31,32,33,34,35,36,37,38,39,40,
        41,42,43,44,45,46,47,48,49,50,51,-1,-1,-1,-1,-1,
        -1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,
        -1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,
        -1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,
        -1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,
        -1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,
        -1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,
        -1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,
        -1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,
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
        if (c == '=') break;
        const int8_t v = (c < 128) ? kDec[c] : -1;
        if (v < 0) return false;
        acc  = (acc << 6) | (uint32_t) v;
        bits += 6;
        if (bits >= 8)
        {
            bits -= 8;
            const uint8_t byte = (uint8_t) (acc >> bits);
            acc &= (1u << bits) - 1u;
            out.append (&byte, 1);
        }
    }
    return out.getSize() > 0;
}

//==============================================================================
CoOpAudioProcessor::CoOpAudioProcessor()
    : AudioProcessor (BusesProperties()
          .withInput  ("Input",  juce::AudioChannelSet::stereo(), true)
          .withOutput ("Output", juce::AudioChannelSet::stereo(), true))
{
    // Build the persistent WebView once per plugin instance. Its lifetime is
    // tied to the processor, so closing/reopening the editor never tears down
    // a live WebRTC session.
    browser = std::make_unique<juce::WebBrowserComponent> (
        juce::WebBrowserComponent::Options{}
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
                })
            .withNativeFunction ("writeAudioFiles",
                [this] (const juce::var& args,
                        juce::WebBrowserComponent::NativeFunctionCompletion completion)
                {
                    handleWriteAudioFiles (args, std::move (completion));
                })
            .withNativeFunction ("startVideoCapture",
                [this] (const juce::var& args,
                        juce::WebBrowserComponent::NativeFunctionCompletion completion)
                {
                    handleStartVideoCapture (args, std::move (completion));
                })
            .withNativeFunction ("stopVideoCapture",
                [this] (const juce::var& args,
                        juce::WebBrowserComponent::NativeFunctionCompletion completion)
                {
                    handleStopVideoCapture (args, std::move (completion));
                }));

    // Build the video capture helper. Frames are dispatched as
    // __juceVideoFrame CustomEvents; start/stop results come back through
    // the native-function completion handler (no separate error event).
    videoCapture = std::make_unique<VideoCapture> (
        [this] (const juce::String& b64, int w, int h)
        {
            if (browser == nullptr) return;
            juce::String script;
            script << "window.dispatchEvent(new CustomEvent('__juceVideoFrame',{detail:{"
                   << "jpeg:'" << b64 << "',w:" << w << ",h:" << h << "}}))";
            browser->evaluateJavascript (script,
                [] (juce::WebBrowserComponent::EvaluationResult) {});
        });

    // Append ?plugin=1 so the web app can tailor UX for in-plugin context
    // (e.g. hide camera sources that hang WKWebView inside an Audio Unit).
    {
        juce::String url (COOP_APP_URL);
        url += (url.contains ("?") ? "&" : "?");
        url += "plugin=1";
        browser->goToURL (url);
    }

    // Start polling the capture ring buffer and forwarding samples to JS.
    startTimer (20);
}

CoOpAudioProcessor::~CoOpAudioProcessor()
{
    stopTimer();
}

//==============================================================================
void CoOpAudioProcessor::prepareToPlay (double sampleRate, int /*samplesPerBlock*/)
{
    captureSampleRate.store ((int) sampleRate);
    captureFifo.reset();
    captureBuffer.clear();
}

void CoOpAudioProcessor::releaseResources()
{
    captureFifo.reset();
}

bool CoOpAudioProcessor::isBusesLayoutSupported (const BusesLayout& layouts) const
{
    if (layouts.getMainOutputChannelSet() != layouts.getMainInputChannelSet())
        return false;

    return layouts.getMainOutputChannelSet() == juce::AudioChannelSet::stereo()
        || layouts.getMainOutputChannelSet() == juce::AudioChannelSet::mono();
}

void CoOpAudioProcessor::processBlock (juce::AudioBuffer<float>& buffer,
                                       juce::MidiBuffer& /*midi*/)
{
    juce::ScopedNoDenormals noDenormals;

    const int numSamples  = buffer.getNumSamples();
    const int numChannels = juce::jmin (buffer.getNumChannels(), captureBuffer.getNumChannels());

    captureNumChannels.store (numChannels);

    if (numChannels > 0 && numSamples > 0)
    {
        if (captureFifo.getFreeSpace() < numSamples)
        {
            int toDiscard = numSamples - captureFifo.getFreeSpace();
            int s1, sz1, s2, sz2;
            captureFifo.prepareToRead (toDiscard, s1, sz1, s2, sz2);
            captureFifo.finishedRead  (sz1 + sz2);
        }

        int start1, size1, start2, size2;
        captureFifo.prepareToWrite (numSamples, start1, size1, start2, size2);

        for (int ch = 0; ch < numChannels; ++ch)
        {
            if (size1 > 0) captureBuffer.copyFrom (ch, start1, buffer, ch, 0,     size1);
            if (size2 > 0) captureBuffer.copyFrom (ch, start2, buffer, ch, size1, size2);
        }
        captureFifo.finishedWrite (size1 + size2);
    }
}

int CoOpAudioProcessor::readCapturedAudio (float* dest, int maxFrames)
{
    const int numCh = captureNumChannels.load();
    if (numCh <= 0 || dest == nullptr) return 0;

    const int framesAvailable = captureFifo.getNumReady();
    const int toRead = juce::jmin (framesAvailable, maxFrames);
    if (toRead <= 0) return 0;

    int start1, size1, start2, size2;
    captureFifo.prepareToRead (toRead, start1, size1, start2, size2);

    auto interleave = [&] (int bufferStart, int size, int destFrameOffset)
    {
        for (int i = 0; i < size; ++i)
            for (int ch = 0; ch < numCh; ++ch)
                dest[((destFrameOffset + i) * numCh) + ch]
                    = captureBuffer.getSample (ch, bufferStart + i);
    };

    if (size1 > 0) interleave (start1, size1, 0);
    if (size2 > 0) interleave (start2, size2, size1);

    captureFifo.finishedRead (toRead);
    return toRead;
}

//==============================================================================
void CoOpAudioProcessor::timerCallback()
{
    const int sr = getCaptureSampleRate();
    const int ch = getCaptureNumChannels();
    if (sr <= 0 || ch <= 0 || browser == nullptr) return;

    const int maxFrames = (sr * 30) / 1000;
    audioPollBuffer.resize ((size_t) (maxFrames * ch));
    const int framesRead = readCapturedAudio (audioPollBuffer.data(), maxFrames);
    if (framesRead <= 0) return;

    const int bytes = framesRead * ch * (int) sizeof (float);
    // Use standard Base64 (RFC 4648) so the web side's atob() can decode it.
    // juce::MemoryBlock::toBase64Encoding() is a NON-standard JUCE format
    // ("<size>.<hex-of-base64>") and atob() would reject it.
    juce::MemoryOutputStream b64Stream;
    juce::Base64::convertToBase64 (b64Stream, audioPollBuffer.data(), (size_t) bytes);
    const juce::String b64 = b64Stream.toString();

    juce::String script;
    script << "window.dispatchEvent(new CustomEvent('__juceDawAudio',{detail:{"
           << "samples:'" << b64 << "',"
           << "sr:"       << sr << ","
           << "ch:"       << ch << "}}))";

    browser->evaluateJavascript (script,
        [] (juce::WebBrowserComponent::EvaluationResult) {});
}

//==============================================================================
juce::File CoOpAudioProcessor::downloadToTemp (const juce::String& url,
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
    const juce::int64 deadline   = juce::Time::currentTimeMillis() + 45000;

    constexpr int chunkSize = 16384;
    juce::HeapBlock<char> buf (chunkSize);

    while (! stream->isExhausted())
    {
        if (juce::Time::currentTimeMillis() > deadline)
            return juce::File{};

        const int bytesRead = stream->read (buf.getData(), chunkSize);
        if (bytesRead <= 0) break;

        out.write (buf.getData(), (size_t) bytesRead);
        downloaded += bytesRead;

        const int reportVal = total > 0
            ? (int) (downloaded * 10 / total)
            : (int) (downloaded / (512 * 1024));
        if (reportVal != lastReported)
        {
            lastReported = reportVal;
            juce::String script = "window.dispatchEvent(new CustomEvent('__juceProgress',"
                                  "{detail:{dl:" + juce::String (downloaded)
                                  + ",tot:" + juce::String (total) + "}}))";
            juce::MessageManager::callAsync ([this, script] {
                if (browser)
                    browser->evaluateJavascript (script, [] (juce::WebBrowserComponent::EvaluationResult) {});
            });
        }
    }

    return tmp;
}

//==============================================================================
void CoOpAudioProcessor::handlePrefetch (const juce::var& args,
                                          juce::WebBrowserComponent::NativeFunctionCompletion completion)
{
    if (! args.isArray() || args.size() < 2) { completion (juce::var ("error")); return; }

    juce::String url  = args[0].toString();
    juce::String name = args[1].toString();

    if (cacheReady && cachedName == name) { completion (juce::var ("cached")); return; }
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

                if (pendingDragComp)
                {
                    pendingDragFile = file;
                    dragArmed       = true;
                    juce::String script = "if(window.__juceStartDragComplete)"
                                         "window.__juceStartDragComplete('armed')";
                    if (browser)
                        browser->evaluateJavascript (script, [] (juce::WebBrowserComponent::EvaluationResult) {});
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
                    if (browser)
                        browser->evaluateJavascript (script, [] (juce::WebBrowserComponent::EvaluationResult) {});
                    (*pendingDragComp) (juce::var ("error"));
                    pendingDragComp.reset();
                }
            }
        });
    }).detach();
}

//==============================================================================
void CoOpAudioProcessor::handleStartDrag (const juce::var& args,
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

    if (isDownloading && cachedName == name)
    {
        pendingDragComp = std::make_shared<juce::WebBrowserComponent::NativeFunctionCompletion> (std::move (completion));
        return;
    }

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

            (*compPtr) (juce::var (result));

            juce::String script = "if(window.__juceStartDragComplete)"
                                  "window.__juceStartDragComplete('" + result + "')";
            if (browser)
                browser->evaluateJavascript (script, [] (juce::WebBrowserComponent::EvaluationResult) {});
        });
    }).detach();
}

//==============================================================================
void CoOpAudioProcessor::handleWriteAudioFile (const juce::var& args,
                                                juce::WebBrowserComponent::NativeFunctionCompletion completion)
{
    if (! args.isArray() || args.size() < 2)
    {
        completion (juce::var ("error:args"));
        return;
    }

    juce::String base64 = args[0].toString();
    juce::String name   = args[1].toString();

    auto compPtr = std::make_shared<juce::WebBrowserComponent::NativeFunctionCompletion> (std::move (completion));

    std::thread ([this, base64, name, compPtr] {
        juce::MemoryBlock data;
        if (! decodeBase64 (base64, data))
        {
            juce::MessageManager::callAsync ([compPtr] { (*compPtr) (juce::var ("error:decode")); });
            return;
        }

        juce::File tmp = juce::File::getSpecialLocation (juce::File::tempDirectory)
                             .getChildFile ("CoOp_" + name);

        if (! tmp.replaceWithData (data.getData(), data.getSize()))
        {
            juce::MessageManager::callAsync ([compPtr] { (*compPtr) (juce::var ("error:write")); });
            return;
        }

        juce::MessageManager::callAsync ([this, tmp, name, compPtr] {
            cachedFile      = tmp;
            cachedName      = name;
            cacheReady      = true;
            isDownloading   = false;
            pendingDragFile = tmp;
            dragArmed       = true;

            // Arm drag monitor via the editor (if currently visible)
            if (auto* ed = dynamic_cast<CoOpAudioProcessorEditor*> (getActiveEditor()))
                ed->armDragMonitor (tmp.getFullPathName().toStdString());

            (*compPtr) (juce::var ("armed"));
            if (browser)
                browser->evaluateJavascript (
                    "if(window.__juceStartDragComplete)window.__juceStartDragComplete('armed')",
                    [] (juce::WebBrowserComponent::EvaluationResult) {});
        });
    }).detach();
}

//==============================================================================
void CoOpAudioProcessor::handleWriteAudioFiles (const juce::var& args,
                                                 juce::WebBrowserComponent::NativeFunctionCompletion completion)
{
    if (! args.isArray() || args.size() < 2 || (args.size() % 2) != 0)
    {
        completion (juce::var ("error:args"));
        return;
    }

    struct Entry { juce::String base64; juce::String name; };
    std::vector<Entry> entries;
    for (int i = 0; i + 1 < args.size(); i += 2)
        entries.push_back ({ args[i].toString(), args[i + 1].toString() });

    auto compPtr = std::make_shared<juce::WebBrowserComponent::NativeFunctionCompletion> (std::move (completion));

    std::thread ([this, entries, compPtr]
    {
        std::vector<juce::File> files;

        for (const auto& e : entries)
        {
            juce::MemoryBlock data;
            if (! decodeBase64 (e.base64, data))
            {
                juce::MessageManager::callAsync ([compPtr] { (*compPtr) (juce::var ("error:decode")); });
                return;
            }

            juce::File tmp = juce::File::getSpecialLocation (juce::File::tempDirectory)
                                 .getChildFile ("CoOp_" + e.name);
            if (! tmp.replaceWithData (data.getData(), data.getSize()))
            {
                juce::MessageManager::callAsync ([compPtr] { (*compPtr) (juce::var ("error:write")); });
                return;
            }

            files.push_back (tmp);
        }

        juce::MessageManager::callAsync ([this, files, compPtr]
        {
            std::vector<std::string> paths;
            paths.reserve (files.size());
            for (const auto& f : files)
                paths.push_back (f.getFullPathName().toStdString());

            if (auto* ed = dynamic_cast<CoOpAudioProcessorEditor*> (getActiveEditor()))
                ed->armDragMonitorMultiple (paths);

            (*compPtr) (juce::var ("armed"));
            if (browser)
                browser->evaluateJavascript (
                    "if(window.__juceStartDragComplete)window.__juceStartDragComplete('armed')",
                    [] (juce::WebBrowserComponent::EvaluationResult) {});
        });
    }).detach();
}

//==============================================================================
// Video capture — ScreenCaptureKit bridge
//==============================================================================
void CoOpAudioProcessor::handleStartVideoCapture (const juce::var& args,
                                                   juce::WebBrowserComponent::NativeFunctionCompletion completion)
{
    if (! videoCapture)
    {
        completion (juce::var ("error:no-capture"));
        return;
    }

    const juce::String kind = (args.isArray() && args.size() >= 1) ? args[0].toString() : juce::String();

    // Shared holder for the completion — SCK's callback invokes it once.
    auto compPtr = std::make_shared<juce::WebBrowserComponent::NativeFunctionCompletion> (std::move (completion));
    auto onDone = [compPtr] (const juce::String& result) { (*compPtr) (juce::var (result)); };

    if (kind == "window")      videoCapture->startWindow (onDone);
    else if (kind == "screen") videoCapture->startScreen (onDone);
    else                       (*compPtr) (juce::var ("error:unknown-kind"));
}

void CoOpAudioProcessor::handleStopVideoCapture (const juce::var& /*args*/,
                                                   juce::WebBrowserComponent::NativeFunctionCompletion completion)
{
    if (videoCapture) videoCapture->stop();
    completion (juce::var ("ok"));
}

//==============================================================================
juce::AudioProcessorEditor* CoOpAudioProcessor::createEditor()
{
    return new CoOpAudioProcessorEditor (*this);
}

//==============================================================================
// Plugin entry point
juce::AudioProcessor* JUCE_CALLTYPE createPluginFilter()
{
    return new CoOpAudioProcessor();
}
