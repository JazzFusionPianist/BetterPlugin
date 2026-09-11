#include "PluginProcessor.h"
#include "PluginEditor.h"
#include "DragMonitor.h"
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
            .withNativeFunction ("listLocalFonts",
                [this] (const juce::var& args,
                        juce::WebBrowserComponent::NativeFunctionCompletion completion)
                {
                    handleListLocalFonts (args, std::move (completion));
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
                })
            .withNativeFunction ("setKeyboardCapture",
                [] (const juce::var& args,
                    juce::WebBrowserComponent::NativeFunctionCompletion completion)
                {
                    // true = the page wants the keyboard (typing / games);
                    // false = keys pass through to the DAW transport.
                    if (auto* arr = args.getArray(); arr != nullptr && ! arr->isEmpty())
                        DragMonitor::setKeyboardCapture ((bool) arr->getReference (0));
                    completion (juce::var (true));
                })
            .withNativeFunction ("getDawTimeline",
                [this] (const juce::var& args,
                        juce::WebBrowserComponent::NativeFunctionCompletion completion)
                {
                    handleGetDawTimeline (args, std::move (completion));
                })
            .withNativeFunction ("getHostControlStatus",
                [this] (const juce::var& args,
                        juce::WebBrowserComponent::NativeFunctionCompletion completion)
                {
                    handleGetHostControlStatus (args, std::move (completion));
                })
            .withNativeFunction ("getHostTracks",
                [this] (const juce::var& args,
                        juce::WebBrowserComponent::NativeFunctionCompletion completion)
                {
                    handleGetHostTracks (args, std::move (completion));
                })
            .withNativeFunction ("setHostTrackSelected",
                [this] (const juce::var& args,
                        juce::WebBrowserComponent::NativeFunctionCompletion completion)
                {
                    handleSetHostTrackSelected (args, std::move (completion));
                })
            .withNativeFunction ("startHostStemExport",
                [this] (const juce::var& args,
                        juce::WebBrowserComponent::NativeFunctionCompletion completion)
                {
                    handleStartHostStemExport (args, std::move (completion));
                }));

    controlBridge = std::make_unique<OrbControlBridge> (
        juce::PluginHostType().getHostDescription());

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
    // The v= cache-buster defeats WKWebView's disk cache, which otherwise
    // keeps serving a stale index.html (and so a stale bundle) across
    // fresh instances and even host restarts.
    {
        juce::String url (ORB_APP_URL);
        url += (url.contains ("?") ? "&" : "?");
        url += "plugin=1&v=" + juce::String (juce::Time::currentTimeMillis());
       #ifdef ORB_SURFACE
        // Split-out single-purpose builds (Orb Chat, …) tell the web app
        // which surface to boot — it hides the other rooms.
        url += juce::String ("&surface=") + ORB_SURFACE;
       #endif
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

    // The FX engine allocates its lines per node here; the chain itself
    // (which slots run) is published from the message thread.
    fxChain.prepare (sampleRate, samplesPerBlock);
    publishFxChain();
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
            if (auto ppq = pos->getPpqPosition())
            {
                playheadPpq.store (*ppq);
                playheadPpqValid.store (true);
            }
            if (auto bar = pos->getPpqPositionOfLastBarStart())
            {
                playheadBarPpq.store (*bar);
                playheadBarPpqValid.store (true);
            }
            if (auto bpm = pos->getBpm())          playheadBpm.store (*bpm);
            if (auto smp = pos->getTimeInSamples())
            {
                playheadSamples.store (*smp);
                playheadSamplesValid.store (true);
            }
            if (auto bars = pos->getBarCount())
            {
                playheadBarCount.store (*bars);
                playheadBarCountValid.store (true);
            }
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
           << "ppq:"      << (playheadPpqValid.load() ? juce::String (playheadPpq.load(), 6) : "null") << ","
           << "barPpq:"   << (playheadBarPpqValid.load() ? juce::String (playheadBarPpq.load(), 6) : "null") << ","
           << "barCount:" << (playheadBarCountValid.load() ? juce::String (playheadBarCount.load()) : "null") << ","
           << "projectSamples:" << (playheadSamplesValid.load() ? juce::String (playheadSamples.load()) : "null") << ","
           << "bpm:"      << juce::String (playheadBpm.load(), 4) << ","
           << "tnum:"     << playheadTsNum.load() << ","
           << "tden:"     << playheadTsDen.load() << ","
           << "playing:"  << (transportPlaying.load() ? "true" : "false") << ","
           << "gr:"       << juce::String (glueGrDb.load(), 2)
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

// JS-callable: return local typeface family names visible to JUCE. This
// backs the Display font picker in the standalone/plugin WebView, where
// Chromium's browser-only Local Font Access API is not available.
void OrbAudioProcessor::handleListLocalFonts (const juce::var&,
                                               juce::WebBrowserComponent::NativeFunctionCompletion completion)
{
    auto names = juce::Font::findAllTypefaceNames();
    names.removeEmptyStrings();
    names.removeDuplicates (false);
    names.sort (true);

    juce::Array<juce::var> result;
    for (const auto& name : names)
        result.add (name);

    completion (juce::JSON::toString (juce::var (result), false));
}


//==============================================================================
// One-knob FX rack — the engine lives in FxEngine.cpp; this is the
// bridge between the UI's per-effect memories and the chain. Phase 0:
// the chain is [the current mode], published from the message thread.

void OrbAudioProcessor::publishFxChain()
{
    orbfx::Schedule s;
    s.count = 1;
    s.slot[0] = juce::jlimit (0, (int) kNumFx - 1, fxMode.load());
    fxChain.publish (s);
}

void OrbAudioProcessor::processFx (juce::AudioBuffer<float>& buffer)
{
    const int n  = buffer.getNumSamples();
    const int nc = buffer.getNumChannels();
    const float sr = (float) juce::jmax (8000, captureSampleRate.load());
    if (n == 0 || nc == 0) return;

    // Snapshot the UI-owned atomics once per block, one entry per slot
    // (slot == effect in phase 0).
    orbfx::NodeParams params[orbfx::kMaxNodes];
    const float bpm = (float) playheadBpm.load();
    for (int i = 0; i < (int) kNumFx; ++i)
    {
        auto& p = params[i];
        p.amount   = fxAmount[(size_t) i].load (std::memory_order_relaxed);
        p.variant  = fxVariant[(size_t) i].load (std::memory_order_relaxed);
        p.decay    = fxSpaceDecay[(size_t) juce::jlimit (0, 2, p.variant)].load (std::memory_order_relaxed);
        p.delayDiv = fxDelayDiv.load (std::memory_order_relaxed);
        p.delayFb  = fxDelayFb.load (std::memory_order_relaxed);
        p.bpm      = bpm;
    }

    float gr = 0.0f;
    fxChain.process (buffer, sr, params, gr);
    glueGrDb.store (gr, std::memory_order_relaxed);
}

void OrbAudioProcessor::handleSetFx (const juce::var& args,
                                     juce::WebBrowserComponent::NativeFunctionCompletion completion)
{
    // Args arrive as [ { mode?, amount?, variant?, decay?, enabled?,
    // delayDiv?, delayFb? } ]; amount/variant/enabled apply to the given
    // (or current) mode so each effect remembers its own setting.
    if (auto* arr = args.getArray(); arr != nullptr && ! arr->isEmpty())
    {
        const juce::var& v = arr->getReference (0);
        int mode = fxMode.load();
        if (v.hasProperty ("mode"))
        {
            mode = juce::jlimit (0, (int) kNumFx - 1, (int) v["mode"]);
            if (fxMode.exchange (mode) != mode) publishFxChain();
        }
        if (v.hasProperty ("amount"))
            fxAmount[(size_t) mode].store (juce::jlimit (0.0f, 1.0f, (float) (double) v["amount"]));
        if (v.hasProperty ("variant"))
            fxVariant[(size_t) mode].store (juce::jlimit (0, 3, (int) v["variant"]));
        if (v.hasProperty ("decay"))
            fxSpaceDecay[(size_t) juce::jlimit (0, 2, fxVariant[kSpace].load())]
                .store (juce::jlimit (0.0f, 1.0f, (float) (double) v["decay"]));
        if (v.hasProperty ("delayDiv"))
            fxDelayDiv.store (juce::jlimit (0, 6, (int) v["delayDiv"]));
        if (v.hasProperty ("delayFb"))
            fxDelayFb.store (juce::jlimit (0.0f, 1.0f, (float) (double) v["delayFb"]));
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
    juce::Array<juce::var> decays;
    for (auto& dc : fxSpaceDecay) decays.add ((double) dc.load());
    obj->setProperty ("decays", decays);
    obj->setProperty ("delayDiv", fxDelayDiv.load());
    obj->setProperty ("delayFb", (double) fxDelayFb.load());
    completion (juce::var (obj));
}

//==============================================================================
// State — the FX rack is the plugin's persistent state.

void OrbAudioProcessor::getStateInformation (juce::MemoryBlock& dest)
{
    juce::XmlElement xml ("OrbState");
    xml.setAttribute ("fxMode", fxMode.load());
    xml.setAttribute ("fxDelayDiv", fxDelayDiv.load());
    xml.setAttribute ("fxDelayFb", (double) fxDelayFb.load());
    for (int i = 0; i < (int) kNumFx; ++i)
    {
        xml.setAttribute ("fxAmount" + juce::String (i), (double) fxAmount[(size_t) i].load());
        xml.setAttribute ("fxVariant" + juce::String (i), fxVariant[(size_t) i].load());
    }
    for (int i = 0; i < 3; ++i)
        xml.setAttribute ("fxDecay" + juce::String (i), (double) fxSpaceDecay[(size_t) i].load());
    xml.setAttribute ("editorW", editorW.load());
    xml.setAttribute ("editorH", editorH.load());
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
                "fxAmount" + juce::String (i), i == kTone ? 0.5 : i == kGain ? 0.75 : 0.0));
            fxVariant[(size_t) i].store (juce::jlimit (0, 3,
                xml->getIntAttribute ("fxVariant" + juce::String (i), 0)));
        }
        for (int i = 0; i < 3; ++i)
            fxSpaceDecay[(size_t) i].store (juce::jlimit (0.0f, 1.0f,
                (float) xml->getDoubleAttribute ("fxDecay" + juce::String (i), 0.5)));
        fxDelayDiv.store (juce::jlimit (0, 6, xml->getIntAttribute ("fxDelayDiv", 2)));
        fxDelayFb.store (juce::jlimit (0.0f, 1.0f,
            (float) xml->getDoubleAttribute ("fxDelayFb", 0.35)));
        editorW.store (xml->getIntAttribute ("editorW", 0));
        editorH.store (xml->getIntAttribute ("editorH", 0));
        publishFxChain();
    }
}

// JS-callable: return the most recent host playhead snapshot directly. This
// path is intentionally independent from the live-audio timer: Logic may stop
// delivering audio buffers while a region/file-promise drag is in progress.
void OrbAudioProcessor::handleGetDawTimeline (const juce::var&,
                                              juce::WebBrowserComponent::NativeFunctionCompletion completion)
{
    juce::String json;
    json << "{\"sr\":" << getCaptureSampleRate() << ","
         << "\"ppq\":" << (playheadPpqValid.load() ? juce::String (playheadPpq.load(), 9) : "null") << ","
         << "\"barPpq\":" << (playheadBarPpqValid.load() ? juce::String (playheadBarPpq.load(), 9) : "null") << ","
         << "\"barCount\":" << (playheadBarCountValid.load() ? juce::String (playheadBarCount.load()) : "null") << ","
         << "\"projectSamples\":" << (playheadSamplesValid.load() ? juce::String (playheadSamples.load()) : "null") << ","
         << "\"bpm\":" << juce::String (playheadBpm.load(), 6) << ","
         << "\"tnum\":" << playheadTsNum.load() << ","
         << "\"tden\":" << playheadTsDen.load() << ","
         << "\"playing\":" << (transportPlaying.load() ? "true" : "false") << "}";
    completion (json);
}

void OrbAudioProcessor::handleGetHostControlStatus (
    const juce::var&, juce::WebBrowserComponent::NativeFunctionCompletion completion)
{
    completion (controlBridge != nullptr ? controlBridge->getStatusJson()
                                         : juce::String ("{\"connected\":false,\"exportMode\":\"none\"}"));
}

void OrbAudioProcessor::handleGetHostTracks (
    const juce::var&, juce::WebBrowserComponent::NativeFunctionCompletion completion)
{
    if (controlBridge == nullptr)
    {
        completion ("[]");
        return;
    }
    controlBridge->requestTracks();
    // Remote scripts answer asynchronously. The UI polls once more shortly
    // after this request; returning the cached list keeps the call non-blocking.
    completion (controlBridge->getTracksJson());
}

void OrbAudioProcessor::handleSetHostTrackSelected (
    const juce::var& args, juce::WebBrowserComponent::NativeFunctionCompletion completion)
{
    if (controlBridge == nullptr || ! args.isArray() || args.size() < 2)
    {
        completion ("error:bad-args");
        return;
    }
    completion (controlBridge->setTrackSelected ((int) args[0], (bool) args[1]) ? "ok"
                                                                                : "error:no-port");
}

void OrbAudioProcessor::handleStartHostStemExport (
    const juce::var& args, juce::WebBrowserComponent::NativeFunctionCompletion completion)
{
    if (controlBridge == nullptr || ! args.isArray() || args.size() < 2)
    {
        completion ("error:bad-args");
        return;
    }

    std::vector<int> indices;
    const auto tokens = juce::StringArray::fromTokens (args[0].toString(), ",", "");
    for (const auto& token : tokens)
        if (token.trim().isNotEmpty()) indices.push_back (token.getIntValue());

    const bool editSelection = args[1].toString() == "selection";
    completion (controlBridge->requestExport (indices, editSelection) ? "started"
                                                                      : "error:no-port");
}

//==============================================================================
// Plugin entry point
juce::AudioProcessor* JUCE_CALLTYPE createPluginFilter()
{
    return new OrbAudioProcessor();
}
