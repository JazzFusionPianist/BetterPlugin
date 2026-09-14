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
            .withNativeFunction ("setGraph",
                [this] (const juce::var& args,
                        juce::WebBrowserComponent::NativeFunctionCompletion completion)
                {
                    handleSetGraph (args, std::move (completion));
                })
            .withNativeFunction ("setScopeInput",
                [this] (const juce::var& args,
                        juce::WebBrowserComponent::NativeFunctionCompletion completion)
                {
                    if (auto* arr = args.getArray(); arr != nullptr && ! arr->isEmpty())
                        scopeInputWanted.store ((bool) arr->getReference (0));
                    completion (juce::var (true));
                })
            .withNativeFunction ("listPresets",
                [this] (const juce::var& a, juce::WebBrowserComponent::NativeFunctionCompletion done) { handleListPresets (a, std::move (done)); })
            .withNativeFunction ("savePreset",
                [this] (const juce::var& a, juce::WebBrowserComponent::NativeFunctionCompletion done) { handleSavePreset (a, std::move (done)); })
            .withNativeFunction ("loadPreset",
                [this] (const juce::var& a, juce::WebBrowserComponent::NativeFunctionCompletion done) { handleLoadPreset (a, std::move (done)); })
            .withNativeFunction ("deletePreset",
                [this] (const juce::var& a, juce::WebBrowserComponent::NativeFunctionCompletion done) { handleDeletePreset (a, std::move (done)); })
            .withNativeFunction ("getGraph",
                [this] (const juce::var& args,
                        juce::WebBrowserComponent::NativeFunctionCompletion completion)
                {
                    handleGetGraph (args, std::move (completion));
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
    inputFifo.reset();
    inputBuffer.clear();

    // The FX engine allocates its lines per node here; the chain itself
    // (which slots run) is published from the message thread.
    fxChain.prepare (sampleRate, samplesPerBlock);
    {
        // Re-publish whatever patch is current (state may have loaded
        // before the engine existed at this sample rate).
        juce::String err;
        const juce::ScopedLock sl (fxGraphLock);
        if (fxGraph.nodes.empty() && fxGraph.edges.empty()) rebuildLegacyGraph();
        else applyGraph (fxGraph, err);
    }
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

    // The scope's input tap: the dry signal as it arrives, before the patch.
    if (scopeInputWanted.load (std::memory_order_relaxed))
    {
        const int n  = buffer.getNumSamples();
        const int nc = juce::jmin (buffer.getNumChannels(), inputBuffer.getNumChannels());
        if (nc > 0 && n > 0)
        {
            if (inputFifo.getFreeSpace() < n)
            {
                int s1, sz1, s2, sz2;
                inputFifo.prepareToRead (n - inputFifo.getFreeSpace(), s1, sz1, s2, sz2);
                inputFifo.finishedRead (sz1 + sz2);
            }
            int a1, n1, a2, n2;
            inputFifo.prepareToWrite (n, a1, n1, a2, n2);
            for (int ch = 0; ch < nc; ++ch)
            {
                if (n1 > 0) inputBuffer.copyFrom (ch, a1, buffer, ch, 0,  n1);
                if (n2 > 0) inputBuffer.copyFrom (ch, a2, buffer, ch, n1, n2);
            }
            inputFifo.finishedWrite (n1 + n2);
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

int OrbAudioProcessor::readInputAudio (float* dest, int maxFrames)
{
    const int numCh = captureNumChannels.load();
    if (numCh <= 0 || dest == nullptr) return 0;
    const int toRead = juce::jmin (inputFifo.getNumReady(), maxFrames);
    if (toRead <= 0) return 0;
    int start1, size1, start2, size2;
    inputFifo.prepareToRead (toRead, start1, size1, start2, size2);
    auto interleave = [&] (int bufferStart, int size, int destFrameOffset)
    {
        for (int i = 0; i < size; ++i)
            for (int ch = 0; ch < numCh; ++ch)
                dest[((destFrameOffset + i) * numCh) + ch] = inputBuffer.getSample (ch, bufferStart + i);
    };
    if (size1 > 0) interleave (start1, size1, 0);
    if (size2 > 0) interleave (start2, size2, size1);
    inputFifo.finishedRead (toRead);
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

    // the input tap rides along, the same number of frames, when wanted
    juce::String inB64;
    if (scopeInputWanted.load())
    {
        inputPollBuffer.resize ((size_t) (maxFrames * ch));
        const int inFrames = readInputAudio (inputPollBuffer.data(), framesRead);
        if (inFrames > 0)
        {
            juce::MemoryOutputStream s;
            juce::Base64::convertToBase64 (s, inputPollBuffer.data(), (size_t) (inFrames * ch * (int) sizeof (float)));
            inB64 = s.toString();
        }
    }

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
           << "gr:"       << juce::String (glueGrDb.load(), 2) << ","
           << "inSamples:'" << inB64 << "',"
           << "peaks:[";
    // per-slot block peaks: the wall's lamps breathe with what passes through
    for (int i = 0; i < orbfx::kMaxNodes; ++i)
        script << (i ? "," : "") << juce::String (fxChain.nodePeak (i), 3);
    script << "]}}))";

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
// bridge between the UI and the patch.

void OrbAudioProcessor::writeSlot (const orbfx::Graph::Node& nd)
{
    if (nd.id < 0 || nd.id >= orbfx::kMaxNodes) return;
    auto& s = fxSlots[(size_t) nd.id];
    s.amount.store (juce::jlimit (0.0f, 1.0f, nd.amount), std::memory_order_relaxed);
    s.variant.store (juce::jlimit (0, 7, nd.variant), std::memory_order_relaxed);
    for (int i = 0; i < 3; ++i)
        s.decay[(size_t) i].store (juce::jlimit (0.0f, 1.0f, nd.decay[i]), std::memory_order_relaxed);
    s.delayDiv.store (juce::jlimit (0, 6, nd.delayDiv), std::memory_order_relaxed);
    s.delayFb.store (juce::jlimit (0.0f, 1.0f, nd.delayFb), std::memory_order_relaxed);
    s.wet.store (nd.wet, std::memory_order_relaxed);
    for (int i = 0; i < 3; ++i) s.aux[(size_t) i].store (nd.aux[i], std::memory_order_relaxed);
    for (int i = 0; i < orbfx::kCurveLen; ++i)
        s.curve[(size_t) i].store (juce::jlimit (0.0f, 1.0f, nd.curve[i]), std::memory_order_relaxed);
    s.hasCurve.store (nd.hasCurve, std::memory_order_relaxed);
}

bool OrbAudioProcessor::applyGraph (const orbfx::Graph& g, juce::String& error)
{
    orbfx::Program prog;
    if (! orbfx::compile (g, prog, error)) return false;
    {
        const juce::ScopedLock sl (fxGraphLock);
        fxGraph = g;
    }
    for (auto& nd : g.nodes) writeSlot (nd);
    fxChain.publish (prog);
    return true;
}

void OrbAudioProcessor::rebuildLegacyGraph()
{
    // The single-print room: one node, wired straight through. Its id is
    // its effect, so the per-effect memories map onto slots 1:1.
    int mode = juce::jlimit (0, (int) kNumFx - 1, fxMode.load());
    if (mode == kMixSlot) mode = kTone;
    orbfx::Graph g;
    orbfx::Graph::Node nd;
    nd.id = mode; nd.type = mode;
    nd.amount   = fxAmount[(size_t) mode].load();
    nd.variant  = fxVariant[(size_t) mode].load();
    for (int i = 0; i < 3; ++i) nd.decay[i] = fxSpaceDecay[(size_t) i].load();
    nd.delayDiv = fxDelayDiv.load();
    nd.delayFb  = fxDelayFb.load();
    nd.wet      = false;
    g.nodes.push_back (nd);
    g.edges.push_back ({ orbfx::kPortIn, mode, 1.0f });
    g.edges.push_back ({ mode, orbfx::kPortOut, 1.0f });
    juce::String err;
    applyGraph (g, err);
    fxGraphMode.store (false);
}

void OrbAudioProcessor::processFx (juce::AudioBuffer<float>& buffer)
{
    const int n  = buffer.getNumSamples();
    const int nc = buffer.getNumChannels();
    const float sr = (float) juce::jmax (8000, captureSampleRate.load());
    if (n == 0 || nc == 0) return;

    // Snapshot the per-slot atomics once per block.
    orbfx::NodeParams params[orbfx::kMaxNodes];
    const float  bpm     = (float) playheadBpm.load();
    const bool   playing = transportPlaying.load() && playheadPpqValid.load();
    const double ppq     = playheadPpq.load();
    for (int i = 0; i < orbfx::kMaxNodes; ++i)
    {
        auto& s = fxSlots[(size_t) i];
        auto& p = params[i];
        p.amount   = s.amount.load (std::memory_order_relaxed);
        p.variant  = s.variant.load (std::memory_order_relaxed);
        p.decay    = s.decay[(size_t) juce::jlimit (0, 2, p.variant)].load (std::memory_order_relaxed);
        p.delayDiv = s.delayDiv.load (std::memory_order_relaxed);
        p.delayFb  = s.delayFb.load (std::memory_order_relaxed);
        p.wet      = s.wet.load (std::memory_order_relaxed);
        for (int k = 0; k < 3; ++k) p.aux[k] = s.aux[(size_t) k].load (std::memory_order_relaxed);
        p.hasCurve = s.hasCurve.load (std::memory_order_relaxed);
        if (p.hasCurve)
            for (int k = 0; k < orbfx::kCurveLen; ++k) p.curve[k] = s.curve[(size_t) k].load (std::memory_order_relaxed);
        p.bpm      = bpm;
        p.ppq      = ppq;
        p.playing  = playing;
    }

    float gr = 0.0f;
    fxChain.process (buffer, sr, params, gr);
    glueGrDb.store (gr, std::memory_order_relaxed);
}

//==============================================================================
// Patch ⇄ JSON. Shape:
//   { nodes: [{ id, type, amount, variant, decay:[3], delayDiv, delayFb, wet, x, y }],
//     edges: [{ from, to, gain }] }          from/to: node id, -1 = in, -2 = out

juce::String OrbAudioProcessor::graphToJson (const orbfx::Graph& g)
{
    juce::Array<juce::var> nodes;
    for (auto& nd : g.nodes)
    {
        auto* o = new juce::DynamicObject();
        o->setProperty ("id", nd.id);
        o->setProperty ("type", nd.type);
        o->setProperty ("amount", (double) nd.amount);
        o->setProperty ("variant", nd.variant);
        juce::Array<juce::var> dec;
        for (int i = 0; i < 3; ++i) dec.add ((double) nd.decay[i]);
        o->setProperty ("decay", dec);
        o->setProperty ("delayDiv", nd.delayDiv);
        o->setProperty ("delayFb", (double) nd.delayFb);
        o->setProperty ("wet", nd.wet);
        juce::Array<juce::var> aux;
        for (int i = 0; i < 3; ++i) aux.add (nd.aux[i]);
        o->setProperty ("aux", aux);
        if (nd.hasCurve)
        {
            juce::Array<juce::var> cv;
            for (int i = 0; i < orbfx::kCurveLen; ++i) cv.add ((double) nd.curve[i]);
            o->setProperty ("curve", cv);
        }
        o->setProperty ("x", (double) nd.x);
        o->setProperty ("y", (double) nd.y);
        nodes.add (juce::var (o));
    }
    juce::Array<juce::var> edges;
    for (auto& e : g.edges)
    {
        auto* o = new juce::DynamicObject();
        o->setProperty ("from", e.from);
        o->setProperty ("to", e.to);
        o->setProperty ("gain", (double) e.gain);
        edges.add (juce::var (o));
    }
    auto* root = new juce::DynamicObject();
    root->setProperty ("nodes", nodes);
    root->setProperty ("edges", edges);
    return juce::JSON::toString (juce::var (root), true);
}

bool OrbAudioProcessor::graphFromJson (const juce::String& json, orbfx::Graph& g, juce::String& error)
{
    juce::var v = juce::JSON::parse (json);
    if (! v.isObject()) { error = "not a patch"; return false; }
    orbfx::Graph out;
    if (auto* nodes = v["nodes"].getArray())
    {
        for (auto& n : *nodes)
        {
            if (! n.isObject()) { error = "bad node"; return false; }
            orbfx::Graph::Node nd;
            nd.id       = (int) n["id"];
            nd.type     = (int) n["type"];
            nd.amount   = n.hasProperty ("amount")   ? (float) (double) n["amount"]  : orbfx::neutralAmount (nd.type);
            nd.variant  = n.hasProperty ("variant")  ? (int) n["variant"] : 0;
            if (auto* dec = n["decay"].getArray())
                for (int i = 0; i < 3 && i < dec->size(); ++i) nd.decay[i] = (float) (double) (*dec)[i];
            nd.delayDiv = n.hasProperty ("delayDiv") ? (int) n["delayDiv"] : 2;
            nd.delayFb  = n.hasProperty ("delayFb")  ? (float) (double) n["delayFb"] : 0.35f;
            nd.wet      = n.hasProperty ("wet")      ? (bool) n["wet"] : false;
            if (auto* ax = n["aux"].getArray())
                for (int i = 0; i < 3 && i < ax->size(); ++i) nd.aux[i] = (int) (*ax)[i];
            if (auto* cv = n["curve"].getArray(); cv != nullptr && cv->size() == orbfx::kCurveLen)
            {
                nd.hasCurve = true;
                for (int i = 0; i < orbfx::kCurveLen; ++i)
                    nd.curve[i] = juce::jlimit (0.0f, 1.0f, (float) (double) (*cv)[i]);
            }
            nd.x        = (float) (double) n["x"];
            nd.y        = (float) (double) n["y"];
            out.nodes.push_back (nd);
        }
    }
    if (auto* edges = v["edges"].getArray())
    {
        for (auto& e : *edges)
        {
            if (! e.isObject()) { error = "bad wire"; return false; }
            orbfx::Graph::Edge ed;
            ed.from = (int) e["from"];
            ed.to   = (int) e["to"];
            ed.gain = e.hasProperty ("gain") ? juce::jlimit (0.0f, 2.0f, (float) (double) e["gain"]) : 1.0f;
            out.edges.push_back (ed);
        }
    }
    g = out;
    return true;
}

void OrbAudioProcessor::handleSetGraph (const juce::var& args,
                                        juce::WebBrowserComponent::NativeFunctionCompletion completion)
{
    auto reply = [&] (bool ok, const juce::String& err)
    {
        auto* o = new juce::DynamicObject();
        o->setProperty ("ok", ok);
        if (! ok) o->setProperty ("error", err);
        completion (juce::var (o));
    };
    auto* arr = args.getArray();
    if (arr == nullptr || arr->isEmpty()) { reply (false, "no patch"); return; }
    const juce::var& v = arr->getReference (0);
    const juce::String json = v.isString() ? v.toString() : juce::JSON::toString (v, true);
    orbfx::Graph g; juce::String err;
    if (! graphFromJson (json, g, err)) { reply (false, err); return; }
    if (! applyGraph (g, err))          { reply (false, err); return; }
    fxGraphMode.store (true);
    reply (true, {});
}

void OrbAudioProcessor::handleGetGraph (const juce::var&,
                                        juce::WebBrowserComponent::NativeFunctionCompletion completion)
{
    juce::String json;
    {
        const juce::ScopedLock sl (fxGraphLock);
        json = graphToJson (fxGraph);
    }
    completion (json);
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
        bool modeChanged = false;
        if (v.hasProperty ("mode"))
        {
            mode = juce::jlimit (0, (int) kNumFx - 1, (int) v["mode"]);
            modeChanged = fxMode.exchange (mode) != mode;
        }
        if (v.hasProperty ("amount"))
            fxAmount[(size_t) mode].store (juce::jlimit (0.0f, 1.0f, (float) (double) v["amount"]));
        if (v.hasProperty ("variant"))
            fxVariant[(size_t) mode].store (juce::jlimit (0, 7, (int) v["variant"]));
        if (v.hasProperty ("decay"))
            fxSpaceDecay[(size_t) juce::jlimit (0, 2, fxVariant[kSpace].load())]
                .store (juce::jlimit (0.0f, 1.0f, (float) (double) v["decay"]));
        if (v.hasProperty ("delayDiv"))
            fxDelayDiv.store (juce::jlimit (0, 6, (int) v["delayDiv"]));
        if (v.hasProperty ("delayFb"))
            fxDelayFb.store (juce::jlimit (0.0f, 1.0f, (float) (double) v["delayFb"]));

        // The single-print room draws the one-node patch. A new print
        // recompiles; a knob move only touches the slot atomics.
        if (modeChanged || fxGraphMode.load())
            rebuildLegacyGraph();
        else
        {
            orbfx::Graph::Node nd;
            nd.id = mode; nd.type = mode;
            nd.amount   = fxAmount[(size_t) mode].load();
            nd.variant  = fxVariant[(size_t) mode].load();
            for (int i = 0; i < 3; ++i) nd.decay[i] = fxSpaceDecay[(size_t) i].load();
            nd.delayDiv = fxDelayDiv.load();
            nd.delayFb  = fxDelayFb.load();
            writeSlot (nd);
            const juce::ScopedLock sl (fxGraphLock);
            for (auto& gn : fxGraph.nodes) if (gn.id == mode) { const float x = gn.x, y = gn.y; gn = nd; gn.x = x; gn.y = y; }
        }
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
// Presets — the wall's patches as files. One JSON file per preset, named
// by the user, in a folder they can open, copy and share.

juce::File OrbAudioProcessor::presetsDir()
{
    return juce::File::getSpecialLocation (juce::File::userApplicationDataDirectory)
             .getChildFile ("Orb").getChildFile ("Sounds").getChildFile ("Presets");
}

static juce::String presetNameArg (const juce::var& args, int index = 0)
{
    if (auto* arr = args.getArray(); arr != nullptr && arr->size() > index)
        return juce::File::createLegalFileName (arr->getReference (index).toString().trim());
    return {};
}

void OrbAudioProcessor::handleListPresets (const juce::var&, juce::WebBrowserComponent::NativeFunctionCompletion completion)
{
    juce::Array<juce::var> names;
    auto dir = presetsDir();
    if (dir.isDirectory())
    {
        juce::Array<juce::File> files;
        dir.findChildFiles (files, juce::File::findFiles, false, "*.orbpatch");
        files.sort();
        for (auto& f : files) names.add (f.getFileNameWithoutExtension());
    }
    completion (juce::var (names));
}

void OrbAudioProcessor::handleSavePreset (const juce::var& args, juce::WebBrowserComponent::NativeFunctionCompletion completion)
{
    const auto name = presetNameArg (args, 0);
    if (name.isEmpty()) { completion (juce::var (false)); return; }
    juce::String json;
    if (auto* arr = args.getArray(); arr != nullptr && arr->size() > 1)
    {
        const auto& v = arr->getReference (1);
        json = v.isString() ? v.toString() : juce::JSON::toString (v, true);
    }
    if (json.isEmpty()) { const juce::ScopedLock sl (fxGraphLock); json = graphToJson (fxGraph); }
    auto dir = presetsDir();
    dir.createDirectory();
    const bool ok = dir.getChildFile (name + ".orbpatch").replaceWithText (json);
    completion (juce::var (ok));
}

void OrbAudioProcessor::handleLoadPreset (const juce::var& args, juce::WebBrowserComponent::NativeFunctionCompletion completion)
{
    const auto name = presetNameArg (args, 0);
    auto f = presetsDir().getChildFile (name + ".orbpatch");
    if (name.isEmpty() || ! f.existsAsFile()) { completion (juce::var()); return; }
    completion (juce::var (f.loadFileAsString()));
}

void OrbAudioProcessor::handleDeletePreset (const juce::var& args, juce::WebBrowserComponent::NativeFunctionCompletion completion)
{
    const auto name = presetNameArg (args, 0);
    auto f = presetsDir().getChildFile (name + ".orbpatch");
    completion (juce::var (name.isNotEmpty() && f.existsAsFile() && f.deleteFile()));
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
    // The patch itself — only once a real one was drawn; the single-print
    // room keeps living in the per-effect attributes above.
    if (fxGraphMode.load())
    {
        const juce::ScopedLock sl (fxGraphLock);
        xml.setAttribute ("fxGraph", graphToJson (fxGraph));
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
                "fxAmount" + juce::String (i), i == kTone ? 0.5 : i == kGain ? 0.75 : 0.0));
            fxVariant[(size_t) i].store (juce::jlimit (0, 7,
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

        bool restored = false;
        if (xml->hasAttribute ("fxGraph"))
        {
            orbfx::Graph g; juce::String err;
            if (graphFromJson (xml->getStringAttribute ("fxGraph"), g, err) && applyGraph (g, err))
            {
                fxGraphMode.store (true);
                restored = true;
            }
        }
        if (! restored) rebuildLegacyGraph();
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
