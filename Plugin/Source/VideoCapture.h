#pragma once
#include <juce_gui_extra/juce_gui_extra.h>
#include <atomic>
#include <functional>
#include <memory>

/**
 * Native macOS capture of the DAW's main window or the whole screen.
 *
 * Runs a timer at ~15fps that grabs a CGImage via CGWindowListCreateImage
 * (window mode) or CGDisplayCreateImage (screen mode), encodes as JPEG,
 * and hands the base64 bytes to `onFrame`.
 *
 * The web side feeds these frames into an offscreen canvas and exposes
 * `canvas.captureStream()` as a MediaStreamTrack, bypassing the
 * getDisplayMedia picker that's hostile UX inside a plugin WebView.
 */
class VideoCapture : private juce::Timer
{
public:
    enum class Kind { None, Window, Screen };

    /** Frame callback: base64 JPEG, width, height. Called on the message thread. */
    using FrameFn = std::function<void (const juce::String& jpegBase64, int w, int h)>;

    explicit VideoCapture (FrameFn cb) : onFrame (std::move (cb)) {}
    ~VideoCapture() override { stop(); }

    void startWindow (int intervalMs = 66);  // ~15fps
    void startScreen (int intervalMs = 66);
    void stop();

    Kind currentKind() const noexcept { return kind.load(); }

private:
    void timerCallback() override;
    bool grabAndEmit();

    FrameFn onFrame;
    std::atomic<Kind> kind { Kind::None };
};
