#pragma once
#include <juce_gui_extra/juce_gui_extra.h>
#include <functional>
#include <memory>

/**
 * Native macOS screen/window capture via ScreenCaptureKit (macOS 12.3+).
 *
 * Owns an SCStream that delivers CVPixelBuffer frames on a background queue.
 * Each frame is JPEG-encoded and handed to `onFrame` via the message thread
 * as base64 bytes + dimensions. Errors (TCC denial, missing window, etc.)
 * are reported through `onError`.
 *
 * The web side consumes __juceVideoFrame CustomEvents, decodes via an
 * offscreen canvas, and exposes canvas.captureStream() as a MediaStreamTrack,
 * bypassing getDisplayMedia's system picker.
 */
class VideoCapture
{
public:
    enum class Kind { None, Window, Screen };

    using FrameFn    = std::function<void (const juce::String& jpegBase64, int w, int h)>;
    /** Completion for start operations — "ok" or "error:<message>". Called on
     *  the message thread once SCK has either begun capture or failed. */
    using CompleteFn = std::function<void (const juce::String& result)>;

    explicit VideoCapture (FrameFn onFrame);
    ~VideoCapture();

    /** Async enumerate displays + windows via SCShareableContent. Completion
     *  receives a JSON array string like [{"kind":"display","id":1,...},
     *  {"kind":"window","id":42,"app":"Logic Pro","title":"Arrange","w":…}]. */
    using ListFn = std::function<void (const juce::String& json)>;
    void listSources (ListFn onComplete);

    /** Capture a specific window by windowID (0 = auto-pick heuristic). */
    void startWindow (uint32_t windowId, CompleteFn onComplete);
    void startScreen (uint32_t displayId, CompleteFn onComplete);   // 0 = main
    /** Show Apple's system-wide SCContentSharingPicker (macOS 14+) so the
     *  user can pick any window/display — including the host DAW, which
     *  the in-sandbox SCShareableContent can't see. */
    void startWithPicker (CompleteFn onComplete);
    void stop();

    Kind currentKind() const noexcept;

private:
    struct Impl;
    std::unique_ptr<Impl> impl;
};
