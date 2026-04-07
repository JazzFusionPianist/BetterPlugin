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

    const juce::int64 total = stream->getTotalLength();
    juce::int64 downloaded  = 0;
    int         lastReported = -1;

    constexpr int chunkSize = 16384;
    juce::HeapBlock<char> buf (chunkSize);

    while (! stream->isExhausted())
    {
        const int bytesRead = stream->read (buf.getData(), chunkSize);
        if (bytesRead <= 0) break;

        out.write (buf.getData(), (size_t) bytesRead);
        downloaded += bytesRead;

        // Report progress regardless of whether total length is known.
        // Pass both downloaded and total; JS shows % when total>0, else KB.
        const int reportVal = total > 0
            ? (int) (downloaded * 100 / total)
            : (int) (downloaded / 1024);
        if (reportVal != lastReported)
        {
            lastReported = reportVal;
            juce::String script = "if(window.__juceProgress)window.__juceProgress("
                                  + juce::String (downloaded) + ","
                                  + juce::String (total) + ")";
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

    cacheReady = false;
    cachedName = name;

    auto compPtr = std::make_shared<juce::WebBrowserComponent::NativeFunctionCompletion> (std::move (completion));

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
                (*compPtr) (juce::var ("error"));
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

    // Not cached — download then arm
    cacheReady = false;
    cachedName = name;
    auto compPtr = std::make_shared<juce::WebBrowserComponent::NativeFunctionCompletion> (std::move (completion));

    std::thread ([this, url, name, compPtr] {
        auto file = downloadToTemp (url, name);
        juce::MessageManager::callAsync ([this, file, name, compPtr] {
            if (file.existsAsFile())
            {
                cachedFile      = file;
                cacheReady      = true;
                cachedName      = name;
                pendingDragFile = file;
                dragArmed       = true;
                (*compPtr) (juce::var ("armed"));
            }
            else
            {
                (*compPtr) (juce::var ("error"));
            }
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
