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
OrbAudioProcessor::OrbAudioProcessor()
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
                })
            .withNativeFunction ("listCaptureSources",
                [this] (const juce::var& args,
                        juce::WebBrowserComponent::NativeFunctionCompletion completion)
                {
                    handleListCaptureSources (args, std::move (completion));
                })
            .withNativeFunction ("pickCaptureSource",
                [this] (const juce::var& args,
                        juce::WebBrowserComponent::NativeFunctionCompletion completion)
                {
                    handlePickCaptureSource (args, std::move (completion));
                })
            .withNativeFunction ("setPluginSize",
                [this] (const juce::var& args,
                        juce::WebBrowserComponent::NativeFunctionCompletion completion)
                {
                    handleSetPluginSize (args, std::move (completion));
                })
            .withNativeFunction ("openExternal",
                [this] (const juce::var& args,
                        juce::WebBrowserComponent::NativeFunctionCompletion completion)
                {
                    handleOpenExternal (args, std::move (completion));
                })
            .withNativeFunction ("getClipboardText",
                [this] (const juce::var& args,
                        juce::WebBrowserComponent::NativeFunctionCompletion completion)
                {
                    handleGetClipboardText (args, std::move (completion));
                })
            .withNativeFunction ("setFx",
                [this] (const juce::var& args,
                        juce::WebBrowserComponent::NativeFunctionCompletion completion)
                {
                    handleSetFx (args, std::move (completion));
                })
            .withNativeFunction ("getFx",
                [this] (const juce::var& args,
                        juce::WebBrowserComponent::NativeFunctionCompletion completion)
                {
                    handleGetFx (args, std::move (completion));
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
        juce::String url (ORB_APP_URL);
        url += (url.contains ("?") ? "&" : "?");
        url += "plugin=1";
        browser->goToURL (url);
    }

    // Start polling the capture ring buffer and forwarding samples to JS.
    startTimer (20);
}

OrbAudioProcessor::~OrbAudioProcessor()
{
    stopTimer();
}

//==============================================================================
void OrbAudioProcessor::prepareToPlay (double sampleRate, int samplesPerBlock)
{
    captureSampleRate.store ((int) sampleRate);
    captureFifo.reset();
    captureBuffer.clear();

    fxReverb.setSampleRate (sampleRate);
    fxWetBuf.setSize (2, juce::jmax (64, samplesPerBlock), false, false, true);
    resetFxState();
}

void OrbAudioProcessor::releaseResources()
{
    captureFifo.reset();
}

bool OrbAudioProcessor::isBusesLayoutSupported (const BusesLayout& layouts) const
{
    if (layouts.getMainOutputChannelSet() != layouts.getMainInputChannelSet())
        return false;

    return layouts.getMainOutputChannelSet() == juce::AudioChannelSet::stereo()
        || layouts.getMainOutputChannelSet() == juce::AudioChannelSet::mono();
}

void OrbAudioProcessor::processBlock (juce::AudioBuffer<float>& buffer,
                                       juce::MidiBuffer& /*midi*/)
{
    juce::ScopedNoDenormals noDenormals;

    // ── Playhead snapshot ────────────────────────────────────────────────
    // getPlayHead() is only valid here on the audio thread. We publish the
    // musical position via atomics; the timer attaches it to the audio
    // events so the web side knows which bar each batch of samples belongs
    // to. Guarded field-by-field because some hosts omit individual fields.
    if (auto* ph = getPlayHead())
    {
        if (auto pos = ph->getPosition())
        {
            if (auto ppq = pos->getPpqPosition())  playheadPpq.store (*ppq);
            if (auto bpm = pos->getBpm())          playheadBpm.store (*bpm);
            if (auto ts  = pos->getTimeSignature())
            {
                playheadTsNum.store (ts->numerator);
                playheadTsDen.store (ts->denominator);
            }
            transportPlaying.store (pos->getIsPlaying());
        }
    }

    // One-knob FX — before the capture FIFO, so the shared/streamed audio
    // carries the same sound the DAW hears.
    processFx (buffer);

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

int OrbAudioProcessor::readCapturedAudio (float* dest, int maxFrames)
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
void OrbAudioProcessor::timerCallback()
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

    // Playhead snapshot to accompany this batch — lets the web side gate
    // bar-range capture on musical position. `tnum`/`tden` are the time
    // signature; `ppq` is quarter-notes from project start; `playing`
    // tells JS whether the transport is rolling.
    juce::String script;
    script << "window.dispatchEvent(new CustomEvent('__juceDawAudio',{detail:{"
           << "samples:'" << b64 << "',"
           << "sr:"       << sr << ","
           << "ch:"       << ch << ","
           << "ppq:"      << juce::String (playheadPpq.load(), 6) << ","
           << "bpm:"      << juce::String (playheadBpm.load(), 4) << ","
           << "tnum:"     << playheadTsNum.load() << ","
           << "tden:"     << playheadTsDen.load() << ","
           << "playing:"  << (transportPlaying.load() ? "true" : "false")
           << "}}))";

    browser->evaluateJavascript (script,
        [] (juce::WebBrowserComponent::EvaluationResult) {});
}

//==============================================================================
juce::File OrbAudioProcessor::downloadToTemp (const juce::String& url,
                                                const juce::String& name)
{
    juce::File tmp = juce::File::getSpecialLocation (juce::File::tempDirectory)
                         .getChildFile ("Orb_" + name);

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
void OrbAudioProcessor::handlePrefetch (const juce::var& args,
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
void OrbAudioProcessor::handleStartDrag (const juce::var& args,
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
void OrbAudioProcessor::handleWriteAudioFile (const juce::var& args,
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
                             .getChildFile ("Orb_" + name);

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
            if (auto* ed = dynamic_cast<OrbAudioProcessorEditor*> (getActiveEditor()))
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
void OrbAudioProcessor::handleWriteAudioFiles (const juce::var& args,
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
                                 .getChildFile ("Orb_" + e.name);
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

            if (auto* ed = dynamic_cast<OrbAudioProcessorEditor*> (getActiveEditor()))
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
void OrbAudioProcessor::handleStartVideoCapture (const juce::var& args,
                                                   juce::WebBrowserComponent::NativeFunctionCompletion completion)
{
    if (! videoCapture)
    {
        completion (juce::var ("error:no-capture"));
        return;
    }

    const juce::String kind = (args.isArray() && args.size() >= 1) ? args[0].toString() : juce::String();
    const uint32_t id = (args.isArray() && args.size() >= 2) ? (uint32_t) (int) args[1] : 0u;

    auto compPtr = std::make_shared<juce::WebBrowserComponent::NativeFunctionCompletion> (std::move (completion));
    auto onDone = [compPtr] (const juce::String& result) { (*compPtr) (juce::var (result)); };

    if (kind == "window")      videoCapture->startWindow (id, onDone);
    else if (kind == "screen") videoCapture->startScreen (id, onDone);
    else                       (*compPtr) (juce::var ("error:unknown-kind"));
}

void OrbAudioProcessor::handleStopVideoCapture (const juce::var& /*args*/,
                                                   juce::WebBrowserComponent::NativeFunctionCompletion completion)
{
    if (videoCapture) videoCapture->stop();
    completion (juce::var ("ok"));
}

void OrbAudioProcessor::handleListCaptureSources (const juce::var& /*args*/,
                                                    juce::WebBrowserComponent::NativeFunctionCompletion completion)
{
    if (! videoCapture) { completion (juce::var ("[]")); return; }
    auto compPtr = std::make_shared<juce::WebBrowserComponent::NativeFunctionCompletion> (std::move (completion));
    videoCapture->listSources ([compPtr] (const juce::String& json) { (*compPtr) (juce::var (json)); });
}

void OrbAudioProcessor::handlePickCaptureSource (const juce::var& /*args*/,
                                                    juce::WebBrowserComponent::NativeFunctionCompletion completion)
{
    if (! videoCapture) { completion (juce::var ("error:no-capture")); return; }
    auto compPtr = std::make_shared<juce::WebBrowserComponent::NativeFunctionCompletion> (std::move (completion));
    videoCapture->startWithPicker ([compPtr] (const juce::String& result) { (*compPtr) (juce::var (result)); });
}

//==============================================================================
juce::AudioProcessorEditor* OrbAudioProcessor::createEditor()
{
    return new OrbAudioProcessorEditor (*this);
}

// JS-callable: resize the plugin window. Args: [width, height].
// Called from the React Expand View button on the live viewer.
void OrbAudioProcessor::handleSetPluginSize (const juce::var& args,
                                              juce::WebBrowserComponent::NativeFunctionCompletion completion)
{
    if (! args.isArray() || args.size() < 2) {
        completion ("error:bad-args");
        return;
    }
    const int w = (int) args[0];
    const int h = (int) args[1];
    if (w < 200 || h < 200 || w > 4000 || h > 4000) {
        completion ("error:size-out-of-range");
        return;
    }
    // Editor lives on the message thread — bounce the call there.
    juce::MessageManager::callAsync ([this, w, h]
    {
        requestEditorResize (w, h);
    });
    completion ("ok");
}

// JS-callable: open a URL in the user's default browser. Used by the
// chat linkify path so message links don't navigate the embedded
// WebView itself (which would unload the plugin UI). Args: [url].
void OrbAudioProcessor::handleOpenExternal (const juce::var& args,
                                             juce::WebBrowserComponent::NativeFunctionCompletion completion)
{
    if (! args.isArray() || args.size() < 1) {
        completion ("error:bad-args");
        return;
    }
    const juce::String urlStr = args[0].toString();
    if (urlStr.isEmpty()) {
        completion ("error:empty-url");
        return;
    }
    // Allow only http/https schemes — keeps file:// and javascript: out
    // of the system handoff. Any link content reaching this point came
    // from a user-typed chat message, so we treat it as untrusted.
    if (! (urlStr.startsWithIgnoreCase ("http://") || urlStr.startsWithIgnoreCase ("https://"))) {
        completion ("error:bad-scheme");
        return;
    }
    juce::URL (urlStr).launchInDefaultBrowser();
    completion ("ok");
}

// JS-callable: read the system clipboard. WKWebView's default paste
// pipeline only fires when the WebView itself receives the keystroke
// event, but DAW hosts typically swallow ⌘V before it reaches the
// plugin window. The JS keydown handler in ChatView calls this to
// pull the clipboard contents and insert them manually.
void OrbAudioProcessor::handleGetClipboardText (const juce::var&,
                                                 juce::WebBrowserComponent::NativeFunctionCompletion completion)
{
    const juce::String text = juce::SystemClipboard::getTextFromClipboard();
    // Result is a plain string — no JSON wrapping. The JS bridge resolves
    // with the raw string so the caller can use it as-is.
    completion (text);
}


//==============================================================================
// One-knob FX rack — five tiny effects, one amount each.

void OrbAudioProcessor::resetFxState()
{
    for (int ch = 0; ch < 2; ++ch)
    {
        tiltLow[ch]  = {};
        tiltHigh[ch] = {};
        tapeLpState[ch] = 0.0f;
    }
    tiltApplied = 999.0f;
    for (auto& st : apState) { st[0] = 0.0f; st[1] = 0.0f; }
    sideHpState = 0.0f;
    glueEnv = 0.0f;
    for (int ch = 0; ch < 2; ++ch)
    {
        cleanXoState[ch] = 0.0f;
        cleanXoState2[ch] = 0.0f;
        cleanShelf[ch] = {};
        sendHpState[ch] = 0.0f;
    }
    cleanShelfBaked = -1.0f;
    fxReverb.reset();
    fxAmtSm = 0.0f;
}

// RBJ shelf (S = 1). type: false = low shelf, true = high shelf.
static void bakeShelf (bool high, float gainDb, float freq, float sr,
                       float& b0, float& b1, float& b2, float& a1, float& a2)
{
    const float A     = std::pow (10.0f, gainDb / 40.0f);
    const float w0    = juce::MathConstants<float>::twoPi * freq / sr;
    const float cosw  = std::cos (w0);
    const float sinw  = std::sin (w0);
    const float alpha = sinw / 2.0f * std::sqrt (2.0f);
    const float sq    = 2.0f * std::sqrt (A) * alpha;

    float bb0, bb1, bb2, aa0, aa1, aa2;
    if (! high)
    {
        bb0 =  A * ((A + 1) - (A - 1) * cosw + sq);
        bb1 =  2 * A * ((A - 1) - (A + 1) * cosw);
        bb2 =  A * ((A + 1) - (A - 1) * cosw - sq);
        aa0 =  (A + 1) + (A - 1) * cosw + sq;
        aa1 = -2 * ((A - 1) + (A + 1) * cosw);
        aa2 =  (A + 1) + (A - 1) * cosw - sq;
    }
    else
    {
        bb0 =  A * ((A + 1) + (A - 1) * cosw + sq);
        bb1 = -2 * A * ((A - 1) + (A + 1) * cosw);
        bb2 =  A * ((A + 1) + (A - 1) * cosw - sq);
        aa0 =  (A + 1) - (A - 1) * cosw + sq;
        aa1 =  2 * ((A - 1) - (A + 1) * cosw);
        aa2 =  (A + 1) - (A - 1) * cosw - sq;
    }
    b0 = bb0 / aa0; b1 = bb1 / aa0; b2 = bb2 / aa0; a1 = aa1 / aa0; a2 = aa2 / aa0;
}

void OrbAudioProcessor::processFx (juce::AudioBuffer<float>& buffer)
{
    const int n  = buffer.getNumSamples();
    const int nc = buffer.getNumChannels();
    const float sr = (float) juce::jmax (8000, captureSampleRate.load());
    if (n == 0 || nc == 0) return;

    const int mode = juce::jlimit (0, (int) kNumFx - 1, fxMode.load (std::memory_order_relaxed));
    const int variant = fxVariant[(size_t) mode].load (std::memory_order_relaxed);
    if (mode != fxLastMode || variant != fxLastVariant)
    {
        // Fresh start for the incoming effect; the amount glides up from
        // zero so switching never clicks (the old tail simply stops).
        resetFxState();
        fxLastMode = mode;
        fxLastVariant = variant;
    }

    const float target = juce::jlimit (0.0f, 1.0f, fxAmount[(size_t) mode].load (std::memory_order_relaxed));
    const float alpha  = 1.0f - std::exp (-(float) n / (0.05f * sr));
    fxAmtSm += (target - fxAmtSm) * alpha;
    const float a = fxAmtSm;

    // Neutral positions cost nothing.
    if (mode == kTone) { if (std::abs (a - 0.5f) < 0.004f) return; }
    else               { if (a < 0.004f && target < 0.004f) return; }

    float* L = buffer.getWritePointer (0);
    float* R = nc > 1 ? buffer.getWritePointer (1) : nullptr;

    switch (mode)
    {
        case kTone:
        {
            // Tilt: dark ⟵ 0.5 ⟶ bright, ±6 dB split across two shelves.
            const float tilt = (a - 0.5f) * 12.0f;
            if (std::abs (tilt - tiltApplied) > 0.05f)
            {
                for (int ch = 0; ch < 2; ++ch)
                {
                    bakeShelf (false, -tilt, 300.0f,  sr, tiltLow[ch].b0,  tiltLow[ch].b1,  tiltLow[ch].b2,  tiltLow[ch].a1,  tiltLow[ch].a2);
                    bakeShelf (true,   tilt, 2800.0f, sr, tiltHigh[ch].b0, tiltHigh[ch].b1, tiltHigh[ch].b2, tiltHigh[ch].a1, tiltHigh[ch].a2);
                }
                tiltApplied = tilt;
            }
            for (int i = 0; i < n; ++i)
            {
                L[i] = tiltHigh[0].run (tiltLow[0].run (L[i]));
                if (R != nullptr) R[i] = tiltHigh[1].run (tiltLow[1].run (R[i]));
            }
            break;
        }

        case kTape:
        {
            if (variant == 0)
            {
                // HARD — full-band tanh drive with loudness compensation and
                // a darkening one-pole (16k pushed toward 8k with drive).
                const float drive = 1.0f + a * 7.0f;
                const float comp  = 1.0f / std::sqrt (drive);
                const float fc    = 16000.0f - a * 8000.0f;
                const float k     = 1.0f - std::exp (-juce::MathConstants<float>::twoPi * fc / sr);
                for (int i = 0; i < n; ++i)
                {
                    {
                        const float shaped = std::tanh (drive * L[i]) * comp;
                        tapeLpState[0] += (shaped - tapeLpState[0]) * k;
                        L[i] = tapeLpState[0];
                    }
                    if (R != nullptr)
                    {
                        const float shaped = std::tanh (drive * R[i]) * comp;
                        tapeLpState[1] += (shaped - tapeLpState[1]) * k;
                        R[i] = tapeLpState[1];
                    }
                }
            }
            else
            {
                // CLEAN — the lows pass untouched; only the band above
                // ~800 Hz saturates, gently, and a small shelf above 2.5k
                // opens the top. Two cascaded one-poles (12 dB/oct) keep
                // the low band genuinely clean. Cool, airy, still glued.
                const float drive = 1.0f + a * 3.0f;
                const float comp  = 1.0f / std::sqrt (drive);
                const float xok   = 1.0f - std::exp (-juce::MathConstants<float>::twoPi * 800.0f / sr);
                const float shelfDb = a * 3.0f;
                if (std::abs (shelfDb - cleanShelfBaked) > 0.05f)
                {
                    for (int ch = 0; ch < 2; ++ch)
                        bakeShelf (true, shelfDb, 2500.0f, sr,
                                   cleanShelf[ch].b0, cleanShelf[ch].b1, cleanShelf[ch].b2,
                                   cleanShelf[ch].a1, cleanShelf[ch].a2);
                    cleanShelfBaked = shelfDb;
                }
                for (int i = 0; i < n; ++i)
                {
                    {
                        cleanXoState[0]  += (L[i] - cleanXoState[0]) * xok;
                        cleanXoState2[0] += (cleanXoState[0] - cleanXoState2[0]) * xok;
                        const float lo = cleanXoState2[0];
                        const float hi = L[i] - lo;
                        L[i] = cleanShelf[0].run (lo + std::tanh (drive * hi) * comp);
                    }
                    if (R != nullptr)
                    {
                        cleanXoState[1]  += (R[i] - cleanXoState[1]) * xok;
                        cleanXoState2[1] += (cleanXoState[1] - cleanXoState2[1]) * xok;
                        const float lo = cleanXoState2[1];
                        const float hi = R[i] - lo;
                        R[i] = cleanShelf[1].run (lo + std::tanh (drive * hi) * comp);
                    }
                }
            }
            break;
        }

        case kSpace:
        {
            // The reverb hears a high-passed send (~170 Hz), so the lows
            // stay bone dry; the dry path is untouched full-band.
            juce::Reverb::Parameters p;
            if (variant == 0)      { p.roomSize = 0.97f; p.damping = 0.22f; p.width = 1.0f;  }  // hall — long, cathedral
            else if (variant == 1) { p.roomSize = 0.32f; p.damping = 0.60f; p.width = 0.85f; }  // room
            else                   { p.roomSize = 0.55f; p.damping = 0.12f; p.width = 1.0f;  }  // plate
            p.wetLevel   = 1.0f;
            p.dryLevel   = 0.0f;
            p.freezeMode = 0.0f;
            fxReverb.setParameters (p);

            if (fxWetBuf.getNumSamples() < n)
                fxWetBuf.setSize (2, n, false, false, true);
            float* wl = fxWetBuf.getWritePointer (0);
            float* wr = fxWetBuf.getWritePointer (1);
            const float hpk = 1.0f - std::exp (-juce::MathConstants<float>::twoPi * 170.0f / sr);
            for (int i = 0; i < n; ++i)
            {
                sendHpState[0] += (L[i] - sendHpState[0]) * hpk;
                wl[i] = L[i] - sendHpState[0];
                if (R != nullptr)
                {
                    sendHpState[1] += (R[i] - sendHpState[1]) * hpk;
                    wr[i] = R[i] - sendHpState[1];
                }
                else wr[i] = wl[i];
            }
            fxReverb.processStereo (wl, wr, n);

            const float wet = a * 0.85f;
            const float dry = 1.0f - a * 0.2f;
            for (int i = 0; i < n; ++i)
            {
                L[i] = L[i] * dry + wl[i] * wet;
                if (R != nullptr) R[i] = R[i] * dry + wr[i] * wet;
            }
            break;
        }

        case kStereoize:
        {
            // Phase-based width: rotate the mid through a small allpass
            // chain and inject the rotated signal ANTISYMMETRICALLY
            // (+ into L, − into R). The mono sum is bit-identical to the
            // input — width for free, no mono penalty. Lows are kept
            // centred by high-passing the side send at ~180 Hz.
            if (R == nullptr) break;   // needs stereo
            static const float apFreqs[4] = { 240.0f, 900.0f, 2800.0f, 7000.0f };
            float c[4];
            for (int st = 0; st < 4; ++st)
            {
                const float t = std::tan (juce::MathConstants<float>::pi * apFreqs[st] / sr);
                c[st] = (t - 1.0f) / (t + 1.0f);
            }
            const float hpK  = 1.0f - std::exp (-juce::MathConstants<float>::twoPi * 180.0f / sr);
            const float gain = a * 0.85f;
            for (int i = 0; i < n; ++i)
            {
                const float mid = 0.5f * (L[i] + R[i]);
                float x = mid;
                for (int st = 0; st < 4; ++st)
                {
                    const float y = c[st] * x + apState[st][0] - c[st] * apState[st][1];
                    apState[st][0] = x;
                    apState[st][1] = y;
                    x = y;
                }
                // remove the correlated part so the send is pure "rotation"
                float side = x - mid;
                sideHpState += (side - sideHpState) * hpK;
                side = (side - sideHpState) * gain;
                L[i] += side;
                R[i] -= side;
            }
            break;
        }

        case kGlue:
        {
            // Stereo-linked 4:1 with programme-friendly times. The knob
            // lowers the threshold and adds matched makeup.
            const float threshDb = -2.0f - a * 20.0f;
            const float makeup   = std::pow (10.0f, (a * 5.0f) / 20.0f);
            const float atkK = 1.0f - std::exp (-1.0f / (0.008f * sr));
            const float relK = 1.0f - std::exp (-1.0f / (0.220f * sr));
            for (int i = 0; i < n; ++i)
            {
                const float inMax = R != nullptr ? juce::jmax (std::abs (L[i]), std::abs (R[i]))
                                                 : std::abs (L[i]);
                glueEnv += (inMax - glueEnv) * (inMax > glueEnv ? atkK : relK);
                const float envDb = juce::Decibels::gainToDecibels (glueEnv, -80.0f);
                const float overDb = envDb - threshDb;
                const float grDb   = overDb > 0.0f ? overDb * 0.75f : 0.0f;   // 4:1
                const float g = std::pow (10.0f, -grDb / 20.0f) * makeup;
                L[i] *= g;
                if (R != nullptr) R[i] *= g;
            }
            break;
        }

        default: break;
    }
}

void OrbAudioProcessor::handleSetFx (const juce::var& args,
                                     juce::WebBrowserComponent::NativeFunctionCompletion completion)
{
    // Args arrive as [ { mode?, amount? } ]; amount applies to the given
    // (or current) mode so each effect remembers its own setting.
    if (auto* arr = args.getArray(); arr != nullptr && ! arr->isEmpty())
    {
        const juce::var& v = arr->getReference (0);
        int mode = fxMode.load();
        if (v.hasProperty ("mode"))
        {
            mode = juce::jlimit (0, (int) kNumFx - 1, (int) v["mode"]);
            fxMode.store (mode);
        }
        if (v.hasProperty ("amount"))
            fxAmount[(size_t) mode].store (juce::jlimit (0.0f, 1.0f, (float) (double) v["amount"]));
        if (v.hasProperty ("variant"))
            fxVariant[(size_t) mode].store (juce::jlimit (0, 2, (int) v["variant"]));
    }
    completion (juce::var (true));
}

void OrbAudioProcessor::handleGetFx (const juce::var&,
                                     juce::WebBrowserComponent::NativeFunctionCompletion completion)
{
    auto* obj = new juce::DynamicObject();
    obj->setProperty ("mode", fxMode.load());
    juce::Array<juce::var> amounts;
    for (auto& amt : fxAmount) amounts.add ((double) amt.load());
    obj->setProperty ("amounts", amounts);
    juce::Array<juce::var> variants;
    for (auto& vr : fxVariant) variants.add (vr.load());
    obj->setProperty ("variants", variants);
    completion (juce::var (obj));
}

//==============================================================================
// State — the FX rack is the plugin's persistent state.

void OrbAudioProcessor::getStateInformation (juce::MemoryBlock& dest)
{
    juce::XmlElement xml ("OrbState");
    xml.setAttribute ("fxMode", fxMode.load());
    for (int i = 0; i < (int) kNumFx; ++i)
    {
        xml.setAttribute ("fxAmount" + juce::String (i), (double) fxAmount[(size_t) i].load());
        xml.setAttribute ("fxVariant" + juce::String (i), fxVariant[(size_t) i].load());
    }
    copyXmlToBinary (xml, dest);
}

void OrbAudioProcessor::setStateInformation (const void* data, int sizeInBytes)
{
    if (auto xml = getXmlFromBinary (data, sizeInBytes); xml != nullptr && xml->hasTagName ("OrbState"))
    {
        fxMode.store (juce::jlimit (0, (int) kNumFx - 1, xml->getIntAttribute ("fxMode", 0)));
        for (int i = 0; i < (int) kNumFx; ++i)
        {
            fxAmount[(size_t) i].store ((float) xml->getDoubleAttribute (
                "fxAmount" + juce::String (i), i == kTone ? 0.5 : 0.0));
            fxVariant[(size_t) i].store (juce::jlimit (0, 2,
                xml->getIntAttribute ("fxVariant" + juce::String (i), 0)));
        }
    }
}

//==============================================================================
// Plugin entry point
juce::AudioProcessor* JUCE_CALLTYPE createPluginFilter()
{
    return new OrbAudioProcessor();
}
