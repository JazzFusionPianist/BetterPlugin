#include "VideoCapture.h"

#import <AppKit/AppKit.h>
#import <CoreGraphics/CoreGraphics.h>
#import <ImageIO/ImageIO.h>
#import <UniformTypeIdentifiers/UniformTypeIdentifiers.h>

// ── Helpers ─────────────────────────────────────────────────────────────────

/** Find the host DAW's main window number. We capture the key or main
 *  window of the host NSApplication, which in a plugin context is the DAW. */
static CGWindowID findHostMainWindow()
{
    NSApplication* app = [NSApplication sharedApplication];
    NSWindow* win = app.mainWindow ?: app.keyWindow;
    if (win == nil)
    {
        // Fall back to the largest visible on-screen window in our process
        for (NSWindow* w in app.windows)
        {
            if (! w.isVisible || w.isMiniaturized) continue;
            if (win == nil || NSWidth(w.frame) * NSHeight(w.frame)
                              > NSWidth(win.frame) * NSHeight(win.frame))
                win = w;
        }
    }
    if (win == nil) return 0;
    return (CGWindowID) [win windowNumber];
}

/** Encode a CGImage as JPEG and return base64 (std Base64, no padding trim). */
static juce::String jpegBase64FromCGImage (CGImageRef image, CGFloat quality = 0.5)
{
    CFMutableDataRef data = CFDataCreateMutable (NULL, 0);
    CFStringRef type;
   #if defined(MAC_OS_VERSION_11_0) && (__MAC_OS_X_VERSION_MAX_ALLOWED >= MAC_OS_VERSION_11_0)
    if (@available (macOS 11.0, *))
        type = (__bridge CFStringRef) UTTypeJPEG.identifier;
    else
   #endif
        type = CFSTR ("public.jpeg");

    CGImageDestinationRef dest = CGImageDestinationCreateWithData (data, type, 1, NULL);
    if (dest == NULL) { CFRelease (data); return {}; }

    NSDictionary* opts = @{ (__bridge NSString*) kCGImageDestinationLossyCompressionQuality: @(quality) };
    CGImageDestinationAddImage (dest, image, (__bridge CFDictionaryRef) opts);
    const bool ok = CGImageDestinationFinalize (dest);
    CFRelease (dest);
    if (! ok) { CFRelease (data); return {}; }

    // Standard Base64 (same encoder path used for DAW audio).
    juce::MemoryOutputStream b64;
    juce::Base64::convertToBase64 (b64, CFDataGetBytePtr (data),
                                         (size_t) CFDataGetLength (data));
    CFRelease (data);
    return b64.toString();
}

// ── API ─────────────────────────────────────────────────────────────────────

void VideoCapture::startWindow (int intervalMs)
{
    kind.store (Kind::Window);
    startTimer (intervalMs);
}

void VideoCapture::startScreen (int intervalMs)
{
    kind.store (Kind::Screen);
    startTimer (intervalMs);
}

void VideoCapture::stop()
{
    kind.store (Kind::None);
    stopTimer();
}

void VideoCapture::timerCallback()
{
    grabAndEmit();
}

bool VideoCapture::grabAndEmit()
{
    CGImageRef image = nil;
    const Kind k = kind.load();

    if (k == Kind::Window)
    {
        const CGWindowID wid = findHostMainWindow();
        if (wid == 0) return false;
        image = CGWindowListCreateImage (CGRectNull,
                                         kCGWindowListOptionIncludingWindow,
                                         wid,
                                         kCGWindowImageBoundsIgnoreFraming
                                         | kCGWindowImageNominalResolution);
    }
    else if (k == Kind::Screen)
    {
        image = CGDisplayCreateImage (CGMainDisplayID());
    }
    else
    {
        return false;
    }

    if (image == nil) return false;

    const int w = (int) CGImageGetWidth  (image);
    const int h = (int) CGImageGetHeight (image);

    const juce::String b64 = jpegBase64FromCGImage (image, 0.5);
    CGImageRelease (image);
    if (b64.isEmpty()) return false;

    if (onFrame) onFrame (b64, w, h);
    return true;
}
