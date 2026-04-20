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

    void startWindow (CompleteFn onComplete);
    void startScreen (CompleteFn onComplete);
    void stop();

    Kind currentKind() const noexcept;

private:
    struct Impl;
    std::unique_ptr<Impl> impl;
};
