#include "VideoCapture.h"

#import <AppKit/AppKit.h>
#import <CoreMedia/CoreMedia.h>
#import <CoreImage/CoreImage.h>
#import <ImageIO/ImageIO.h>
#import <UniformTypeIdentifiers/UniformTypeIdentifiers.h>
#import <ScreenCaptureKit/ScreenCaptureKit.h>

#include <atomic>

// ──────────────────────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────────────────────

/** JPEG-encode a CVPixelBuffer, return standard Base64. */
static juce::String jpegBase64FromPixelBuffer (CVPixelBufferRef pb, CGFloat quality)
{
    static CIContext* ciCtx = nil;
    static dispatch_once_t once;
    dispatch_once (&once, ^{ ciCtx = [CIContext contextWithOptions: @{}]; });

    CIImage* img = [CIImage imageWithCVPixelBuffer: pb];
    if (img == nil) return {};

    CGImageRef cg = [ciCtx createCGImage: img fromRect: img.extent];
    if (cg == NULL) return {};

    CFMutableDataRef data = CFDataCreateMutable (NULL, 0);
    CFStringRef type;
    if (@available (macOS 11.0, *))
        type = (__bridge CFStringRef) UTTypeJPEG.identifier;
    else
        type = CFSTR ("public.jpeg");

    CGImageDestinationRef dest = CGImageDestinationCreateWithData (data, type, 1, NULL);
    if (dest == NULL) { CGImageRelease (cg); CFRelease (data); return {}; }

    NSDictionary* opts = @{ (__bridge NSString*) kCGImageDestinationLossyCompressionQuality: @(quality) };
    CGImageDestinationAddImage (dest, cg, (__bridge CFDictionaryRef) opts);
    const bool ok = CGImageDestinationFinalize (dest);
    CFRelease (dest);
    CGImageRelease (cg);
    if (! ok) { CFRelease (data); return {}; }

    juce::MemoryOutputStream b64;
    juce::Base64::convertToBase64 (b64, CFDataGetBytePtr (data), (size_t) CFDataGetLength (data));
    CFRelease (data);
    return b64.toString();
}

// ──────────────────────────────────────────────────────────────────────────
// ObjC capture class (SCStreamOutput + SCStreamDelegate)
// ──────────────────────────────────────────────────────────────────────────

typedef void (^CompletionBlock)(NSString* _Nullable error);

API_AVAILABLE(macos(12.3))
@interface CoOpSCKCapture : NSObject <SCStreamOutput, SCStreamDelegate>
@property (strong, nullable) SCStream* stream;
@property (strong) dispatch_queue_t outputQueue;
@property (copy, nullable) void (^frameCb)(CVPixelBufferRef, int, int);
- (void) startWithKind: (int) kind completion: (CompletionBlock) completion;
- (void) stop;
@end

API_AVAILABLE(macos(12.3))
@implementation CoOpSCKCapture

- (instancetype) init
{
    if ((self = [super init]))
        _outputQueue = dispatch_queue_create ("com.coop.capture.output", DISPATCH_QUEUE_SERIAL);
    return self;
}

/** Set of bundle IDs we recognise as audio hosts. Order doesn't matter;
 *  we pick the largest window across any matching host. Extend as needed. */
static NSSet<NSString*>* knownDawBundles (void)
{
    static NSSet<NSString*>* s = nil;
    static dispatch_once_t once;
    dispatch_once (&once, ^{
        s = [NSSet setWithArray: @[
            // Apple
            @"com.apple.logic10",
            @"com.apple.logic.pro",
            @"com.apple.garageband10",
            @"com.apple.garageband",
            @"com.apple.mainstage",
            @"com.apple.mainstage3",
            // Ableton
            @"com.ableton.live",
            // Steinberg
            @"com.steinberg.cubase",
            @"com.steinberg.cubase13",
            @"com.steinberg.cubase12",
            @"com.steinberg.cubase11",
            @"com.steinberg.nuendo",
            // Avid
            @"com.avid.ProTools",
            // Image-Line
            @"com.image-line.flstudio",
            // Cockos
            @"com.cockos.reaper",
            // Bitwig
            @"com.bitwig.BitwigStudio",
            // PreSonus
            @"com.presonus.studioone",
            @"com.presonus.studioone7",
            @"com.presonus.studioone6",
            @"com.presonus.studioone5",
            // MOTU
            @"com.motu.digital-performer",
            // Others
            @"com.cakewalk.sonar",
            @"com.tracktion.waveform",
            @"com.apple.GarageBand",
        ]];
    });
    return s;
}

/** Pick the DAW's main arrange window.
 *
 *  AU v3 plugins run in a sandboxed AUHostingService process separate from
 *  the host DAW, so PID-based filtering matches nothing. We try in order:
 *
 *   1. Any window owned by a bundle ID in our known-DAW list (the reliable
 *      path — covers Logic, Live, Pro Tools, Cubase, Reaper, Bitwig, etc.).
 *   2. The frontmost regular-activation app (good fallback for lesser-known
 *      DAWs when it actually has focus).
 *   3. The largest non-system non-self layer-0 window on screen (last resort).
 *
 *  Each pass skips our own UI, system chrome, and tiny / titleless windows.
 */
- (nullable SCWindow*) pickDawWindow: (NSArray<SCWindow*>*) windows
{
    const pid_t myPid = [NSProcessInfo processInfo].processIdentifier;
    NSString*   myBundle = [NSBundle mainBundle].bundleIdentifier;

    NSArray<NSString*>* excludeBundles = @[
        @"com.apple.dock",
        @"com.apple.WindowManager",
        @"com.apple.systemuiserver",
        @"com.apple.controlcenter",
        @"com.apple.notificationcenterui",
        @"com.apple.finder",
        myBundle ?: @"",
    ];

    auto eligible = ^BOOL(SCWindow* w) {
        if (! w.onScreen) return NO;
        if (w.windowLayer != 0) return NO;
        if (w.title.length == 0) return NO;
        if (CGRectGetWidth (w.frame) * CGRectGetHeight (w.frame) < 200 * 200) return NO;
        if (w.owningApplication.processID == myPid) return NO;
        NSString* bid = w.owningApplication.bundleIdentifier;
        if (bid != nil && [excludeBundles containsObject: bid]) return NO;
        return YES;
    };

    auto largestByPredicate = ^SCWindow*(BOOL(^pred)(SCWindow*)) {
        SCWindow* best = nil; CGFloat bestArea = 0;
        for (SCWindow* w in windows)
        {
            if (! eligible (w)) continue;
            if (! pred (w)) continue;
            const CGFloat a = CGRectGetWidth (w.frame) * CGRectGetHeight (w.frame);
            if (a > bestArea) { bestArea = a; best = w; }
        }
        return best;
    };

    // Pass 1: known DAW bundle match.
    NSSet* daws = knownDawBundles();
    SCWindow* hit = largestByPredicate (^BOOL (SCWindow* w) {
        NSString* bid = w.owningApplication.bundleIdentifier;
        return bid != nil && [daws containsObject: bid];
    });
    if (hit != nil) { NSLog (@"[CoOp VideoCapture] matched DAW bundle: %@", hit.owningApplication.bundleIdentifier); return hit; }

    // Pass 2: frontmost regular-activation app.
    NSRunningApplication* fm = [NSWorkspace sharedWorkspace].frontmostApplication;
    if (fm != nil
        && fm.processIdentifier != myPid
        && ![fm.bundleIdentifier isEqualToString: myBundle])
    {
        hit = largestByPredicate (^BOOL (SCWindow* w) {
            return w.owningApplication.processID == fm.processIdentifier;
        });
        if (hit != nil) { NSLog (@"[CoOp VideoCapture] matched frontmost: %@", fm.bundleIdentifier); return hit; }
    }

    // Pass 3: anything eligible.
    hit = largestByPredicate (^BOOL (SCWindow* /*w*/) { return YES; });
    if (hit != nil) NSLog (@"[CoOp VideoCapture] fallback largest: %@", hit.owningApplication.bundleIdentifier);
    return hit;
}

- (void) startWithKind: (int) kind completion: (CompletionBlock) completion
{
    // If a previous capture is still live, stop it before starting a new one.
    if (self.stream != nil)
        [self stop];

    [SCShareableContent getShareableContentWithCompletionHandler:
        ^(SCShareableContent* content, NSError* err)
    {
        if (err != nil || content == nil)
        {
            completion ([NSString stringWithFormat: @"shareable-content: %@",
                         err ? err.localizedDescription : @"unknown"]);
            return;
        }

        SCContentFilter* filter = nil;
        int outW = 1280, outH = 720;

        NSString* diag = nil;
        if (kind == 1)
        {
            SCWindow* target = [self pickDawWindow: content.windows];
            if (target == nil) { completion ([NSString stringWithFormat: @"no-daw-window (total=%lu)", (unsigned long) content.windows.count]); return; }
            filter = [[SCContentFilter alloc] initWithDesktopIndependentWindow: target];
            outW = (int) CGRectGetWidth  (target.frame);
            outH = (int) CGRectGetHeight (target.frame);
            diag = [NSString stringWithFormat: @"window: \"%@\" %dx%d wid=%u",
                    target.title ?: @"(untitled)", outW, outH, (unsigned) target.windowID];
        }
        else if (kind == 2)
        {
            SCDisplay* display = content.displays.firstObject;
            if (display == nil) { completion (@"no-display"); return; }
            filter = [[SCContentFilter alloc] initWithDisplay: display excludingWindows: @[]];
            outW = (int) display.width;
            outH = (int) display.height;
            diag = [NSString stringWithFormat: @"display: %dx%d", outW, outH];
        }
        else
        {
            completion (@"unknown-kind");
            return;
        }
        NSLog (@"[CoOp VideoCapture] picked %@", diag);

        constexpr int MAX_W = 1280;
        if (outW > MAX_W)
        {
            outH = (int) (outH * ((double) MAX_W / outW));
            outW = MAX_W;
        }

        SCStreamConfiguration* cfg = [SCStreamConfiguration new];
        cfg.width  = (size_t) outW;
        cfg.height = (size_t) outH;
        cfg.minimumFrameInterval = CMTimeMake (1, 15);
        cfg.pixelFormat = kCVPixelFormatType_32BGRA;
        cfg.showsCursor = YES;
        cfg.queueDepth = 3;

        SCStream* stream = [[SCStream alloc] initWithFilter: filter configuration: cfg delegate: self];
        NSError* addErr = nil;
        [stream addStreamOutput: self
                           type: SCStreamOutputTypeScreen
             sampleHandlerQueue: self.outputQueue
                          error: &addErr];
        if (addErr != nil)
        {
            completion ([NSString stringWithFormat: @"addStreamOutput: %@", addErr.localizedDescription]);
            return;
        }

        self.stream = stream;

        [stream startCaptureWithCompletionHandler: ^(NSError* startErr)
        {
            if (startErr != nil)
            {
                self.stream = nil;
                completion ([NSString stringWithFormat: @"startCapture: %@", startErr.localizedDescription]);
                return;
            }
            completion (nil);
        }];
    }];
}

- (void) stop
{
    SCStream* s = self.stream;
    if (s == nil) return;
    self.stream = nil;
    [s stopCaptureWithCompletionHandler: ^(NSError* /*err*/) { /* best-effort */ }];
}

- (void) stream: (SCStream*) stream
       didOutputSampleBuffer: (CMSampleBufferRef) sb
                      ofType: (SCStreamOutputType) type
{
    (void) stream;
    if (type != SCStreamOutputTypeScreen) return;
    if (! CMSampleBufferIsValid (sb)) return;
    if (! CMSampleBufferDataIsReady (sb)) return;

    // SCK may deliver status-only frames (idle / blank / suspended) without a
    // usable pixel buffer — skip those. Status 0 (Complete) means there's
    // new content to consume.
    CFArrayRef attachments = CMSampleBufferGetSampleAttachmentsArray (sb, false);
    if (attachments != NULL && CFArrayGetCount (attachments) > 0)
    {
        NSArray* attrs = (__bridge NSArray*) attachments;
        NSDictionary* attr = attrs.firstObject;
        NSNumber* status = attr[SCStreamFrameInfoStatus];
        if (status != nil && [status intValue] != 0) return;
    }

    CVPixelBufferRef pb = CMSampleBufferGetImageBuffer (sb);
    if (pb == NULL) return;
    const int w = (int) CVPixelBufferGetWidth  (pb);
    const int h = (int) CVPixelBufferGetHeight (pb);

    static std::atomic<int> loggedFirst { 0 };
    if (loggedFirst.fetch_add (1) == 0)
        NSLog (@"[CoOp VideoCapture] first sample arrived %dx%d", w, h);

    if (self.frameCb != nil) self.frameCb (pb, w, h);
}

- (void) stream: (SCStream*) stream didStopWithError: (NSError*) error
{
    (void) stream; (void) error;
    // Capture ended for some reason. Not currently surfaced to JS — the
    // viewer will notice frames stopping via its RTC stats.
}

@end

// ──────────────────────────────────────────────────────────────────────────
// C++ wrapper
// ──────────────────────────────────────────────────────────────────────────

struct VideoCapture::Impl
{
    id                  objc;   // CoOpSCKCapture*  (nil on < 12.3)
    std::atomic<Kind>   kind { Kind::None };
};

VideoCapture::VideoCapture (FrameFn onFrame)
    : impl (std::make_unique<Impl>())
{
    if (@available (macOS 12.3, *))
    {
        CoOpSCKCapture* o = [CoOpSCKCapture new];

        FrameFn frame = std::move (onFrame);
        o.frameCb = ^(CVPixelBufferRef pb, int w, int h)
        {
            juce::String payload = jpegBase64FromPixelBuffer (pb, 0.5);
            if (payload.isEmpty()) return;
            juce::MessageManager::callAsync ([frame, payload, w, h]
            {
                frame (payload, w, h);
            });
        };
        impl->objc = o;
    }
}

VideoCapture::~VideoCapture()
{
    stop();
    impl->objc = nil;
}

static void runStart (id objcHandle, int kindNum, VideoCapture::CompleteFn cb)
{
    if (objcHandle == nil)
    {
        juce::MessageManager::callAsync ([cb] { cb ("error:unsupported-os"); });
        return;
    }

    if (@available (macOS 12.3, *))
    {
        CoOpSCKCapture* o = (CoOpSCKCapture*) objcHandle;
        [o startWithKind: kindNum completion: ^(NSString* err)
        {
            juce::String result = (err == nil)
                ? juce::String ("ok")
                : ("error:" + juce::String::fromUTF8 ([err UTF8String]));
            juce::MessageManager::callAsync ([cb, result] { cb (result); });
        }];
    }
    else
    {
        juce::MessageManager::callAsync ([cb] { cb ("error:unsupported-os"); });
    }
}

void VideoCapture::startWindow (CompleteFn onComplete)
{
    impl->kind.store (Kind::Window);
    runStart (impl->objc, 1, std::move (onComplete));
}

void VideoCapture::startScreen (CompleteFn onComplete)
{
    impl->kind.store (Kind::Screen);
    runStart (impl->objc, 2, std::move (onComplete));
}

void VideoCapture::stop()
{
    impl->kind.store (Kind::None);
    if (impl->objc == nil) return;
    if (@available (macOS 12.3, *))
        [(CoOpSCKCapture*) impl->objc stop];
}

VideoCapture::Kind VideoCapture::currentKind() const noexcept
{
    return impl->kind.load();
}
