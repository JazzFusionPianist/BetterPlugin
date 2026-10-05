//==============================================================================
// DragMonitor.mm — ObjC++ implementation (macOS only)
//==============================================================================
#include "DragMonitor.h"

#if defined(__APPLE__)
#import <AppKit/AppKit.h>
#import <objc/runtime.h>
#import <WebKit/WebKit.h>
#import <objc/message.h>
#import <os/log.h>
#include "VstXmlDrop.h"
#include "SlurWebSecurity.h"

#include <atomic>

// Shared with the local key monitor below — see DragMonitor.h.
static std::atomic<bool> gKeyboardCapture { false };

void DragMonitor::setKeyboardCapture (bool wanted)
{
    gKeyboardCapture.store (wanted, std::memory_order_relaxed);
}

// macOS unified logging redacts NSLog's %@ args as <private> by default.
// Use os_log with %{public}@ so pasteboard types are visible to Console.app.
#define ORB_LOG(fmt, ...) os_log(OS_LOG_DEFAULT, "[DragMonitor] " fmt, ##__VA_ARGS__)

static constexpr float kMinDragPx = 4.0f;

// Largest region the bridge will hand to the page. The file is base64-
// encoded into ONE JavaScript string (×1.33) and decoded again on the
// other side; Chromium/WebView2 caps a string near 512 MB and both
// engines run out of process memory not far past that. Mirrors
// DAW_FILE_LIMIT in apps/plugin/src/lib/limits.ts — keep them equal.
static constexpr unsigned long long kMaxDropBytes = 300ULL * 1024 * 1024;

static NSString* jsQuoted (NSString* s)
{
    NSString* out = [s stringByReplacingOccurrencesOfString:@"\\" withString:@"\\\\"];
    out = [out stringByReplacingOccurrencesOfString:@"'" withString:@"\\'"];
    out = [out stringByReplacingOccurrencesOfString:@"\n" withString:@" "];
    return out;
}

// Tell the page a file was skipped for size. It still counts toward the
// __juceDropGroupStart total, so JS decrements its expected count.
static void rejectDropFile (WKWebView* wkv, NSURL* fileURL, unsigned long long size)
{
    ORB_LOG ("drop rejected for size: %{public}@ (%llu bytes)", fileURL.lastPathComponent, size);
    if (!wkv) return;
    NSString* js = [NSString stringWithFormat:
        @"window.dispatchEvent(new CustomEvent('__juceFileDropRejected',"
         "{detail:{name:'%@',size:%llu,limit:%llu}}))",
        jsQuoted (fileURL.lastPathComponent), size, kMaxDropBytes];
    dispatch_async (dispatch_get_main_queue(), ^{
        [wkv evaluateJavaScript:js completionHandler:nil];
    });
}

static unsigned long long fileSizeAt (NSURL* fileURL)
{
    NSNumber* n = nil;
    [fileURL getResourceValue:&n forKey:NSURLFileSizeKey error:nil];
    return n ? n.unsignedLongLongValue : 0ULL;
}

static void failFileDrop (WKWebView* view)
{
    dispatch_async(dispatch_get_main_queue(), ^{
        [view evaluateJavaScript:@"window.dispatchEvent(new CustomEvent('__juceRegionDropError',{detail:{message:'Could not receive the audio files from your DAW. Nothing was sent.'}}))" completionHandler:nil];
    });
}

//==============================================================================
// Forward declarations
//==============================================================================
@class JuceDragHelper;

// Weak global so the C-level swizzle functions can check drag-out state.
static __weak JuceDragHelper* gDragHelper = nil;

// Forward declaration — defined below with the timer globals.
static void stopDragTimer (void);

//==============================================================================
// JuceDragHelper — NSDraggingSource + NSEvent monitor for drag-OUT
//==============================================================================
@interface JuceDragHelper : NSObject <NSDraggingSource>
@property (nonatomic, strong) NSArray<NSString*>* filePaths;  // one or more file paths
@property (nonatomic, copy) NSString* regionXml;
@property (nonatomic, assign) NSPoint    mouseDownPos;
@property (nonatomic, weak) NSWindow* sourceWindow;
@property (nonatomic, assign) BOOL       sessionStarted;
@property (nonatomic, strong) id         monitor;      // NSEvent monitor token
@property (nonatomic, weak)   WKWebView* wkView;       // for JS event dispatch
@property (nonatomic, assign) BOOL       isDragging;   // YES while NSDraggingSession is live
@property (nonatomic, copy) NSString* regionToken;
@property (nonatomic, copy) void (^regionAction)(double, double, bool);
@property (nonatomic, assign) BOOL regionCancelled;
- (void) cancelPendingRegionAction;
@end

@implementation JuceDragHelper

- (void) cancelPendingRegionAction
{
    if (!self.regionAction || self.isDragging) return;
    auto callback = self.regionAction;
    [self disarm];
    callback (0, 0, true);
}

- (NSDragOperation) draggingSession:(NSDraggingSession*)session
    sourceOperationMaskForDraggingContext:(NSDraggingContext)ctx
{
    (void)session; (void)ctx;
    return NSDragOperationCopy | NSDragOperationGeneric | NSDragOperationLink;
}

// Called by the OS when the NSDraggingSession finishes (drop or cancel).
- (void) draggingSession:(NSDraggingSession*)session
         endedAtPoint:(NSPoint)screenPoint
            operation:(NSDragOperation)operation
{
    (void)session;
    auto regionAction = self.regionAction;
    const bool cancelled = self.regionCancelled
        || (NSApp.currentEvent.type == NSEventTypeKeyDown && NSApp.currentEvent.keyCode == 53);
    self.isDragging = NO;
    stopDragTimer();
    if (self.wkView) {
        // Pass whether the drag was accepted by a target ('copy') or cancelled
        // ('none').  React uses this to decide how long to keep outDragActive:
        // when Logic accepts the file it immediately starts its own drag, so
        // we need a 5 s cooldown to catch that returning drag.
        NSString* op = (operation == NSDragOperationNone) ? @"none" : @"copy";
        NSString* js = [NSString stringWithFormat:
            @"window.dispatchEvent(new CustomEvent('__juceOutDragEnd',{detail:{op:'%@'}}))", op];
        [self.wkView evaluateJavaScript:js completionHandler:nil];
    }
    [self disarm];
    if (regionAction)
        regionAction (screenPoint.x, CGDisplayBounds(CGMainDisplayID()).size.height - screenPoint.y, cancelled);
}

- (BOOL) armWithPaths:(NSArray<NSString*>*)paths
{
    // WebKit bridge calls are asynchronous. A delayed mouse-down callback
    // must not replace the payload or clear the state of an active OS drag.
    if (self.isDragging) return NO;
    [self disarm];

    self.filePaths      = paths;
    self.sessionStarted = NO;
    self.isDragging     = NO;   // explicit reset for a fresh arm
    self.sourceWindow = self.wkView.window ?: (NSApp.keyWindow ?: NSApp.mainWindow);
    NSEvent* initiatingEvent = NSApp.currentEvent;
    BOOL pointerEvent = initiatingEvent.type == NSEventTypeLeftMouseDown
        || initiatingEvent.type == NSEventTypeLeftMouseDragged;
    self.mouseDownPos = pointerEvent && initiatingEvent.window == self.sourceWindow
        ? initiatingEvent.locationInWindow
        : (self.sourceWindow ? [self.sourceWindow convertPointFromScreen:[NSEvent mouseLocation]] : NSZeroPoint);
    self.regionCancelled = NO;

    __weak JuceDragHelper* ws = self;

    NSEventMask mask = NSEventMaskLeftMouseDown
                     | NSEventMaskLeftMouseDragged
                     | NSEventMaskLeftMouseUp | NSEventMaskKeyDown;

    self.monitor = [NSEvent addLocalMonitorForEventsMatchingMask:mask
                                                         handler:^NSEvent*(NSEvent* ev)
    {
        JuceDragHelper* s = ws;
        if (!s) return ev;
        if (s.sourceWindow && ev.window != s.sourceWindow) return ev;
#if defined(SLUR_DRAG_QA)
        NSLog(@"SLUR_QA input type=%lu xml=%lu files=%lu", (unsigned long)ev.type, (unsigned long)s.regionXml.length, (unsigned long)s.filePaths.count);
#endif

        switch (ev.type) {

            case NSEventTypeLeftMouseDown:
                // A prepared region action belongs only to the original press.
                if (s.regionAction && !s.isDragging) {
                    [s cancelPendingRegionAction];
                    break;
                }
                s.mouseDownPos   = ev.locationInWindow;
                s.sessionStarted = NO;
                break;

            case NSEventTypeLeftMouseDragged: {
                if (s.sessionStarted || (s.filePaths.count == 0 && !s.regionAction && !s.regionXml.length)) break;

                // Use the delivered event, not a separately sampled global
                // pointer which can lag tablet, remote or queued input events.
                NSPoint cur = ev.locationInWindow;
                CGFloat dx  = cur.x - s.mouseDownPos.x;
                CGFloat dy  = cur.y - s.mouseDownPos.y;
                if (sqrt(dx*dx + dy*dy) < (CGFloat)kMinDragPx) break;

                NSWindow* win  = ev.window ?: [NSApp keyWindow];
                if (!win) win  = [NSApp mainWindow];
                if (!win) break;

                NSView* view = win.contentView;
                if (!view) break;
                s.sessionStarted = YES;

                NSPoint lp = [view convertPoint:[ev locationInWindow] fromView:nil];

                // Build one NSDraggingItem per file, slightly cascaded.
                NSMutableArray<NSDraggingItem*>* items = [NSMutableArray array];
                if (s.regionAction || s.regionXml.length) {
                    NSPasteboardItem* payload = [[NSPasteboardItem alloc] init];
                    if (s.regionAction) [payload setString:s.regionToken forType:@"com.orb.region-transfer"];
                    else [payload setString:s.regionXml forType:NSPasteboardTypeString];
                    NSDraggingItem* item = [[NSDraggingItem alloc] initWithPasteboardWriter:payload];
                    NSImage* icon = [NSImage imageNamed:NSImageNameMultipleDocuments];
                    [item setDraggingFrame:NSMakeRect(lp.x - 16, lp.y - 16, 32, 32) contents:icon];
                    [items addObject:item];
                }
                for (NSUInteger i = 0; i < s.filePaths.count; i++) {
                    NSString* fp  = s.filePaths[i];
                    NSURL*    url = [NSURL fileURLWithPath:fp];
                    NSImage*  ico = [[NSWorkspace sharedWorkspace] iconForFile:fp];
                    if (!ico) ico = [NSImage imageNamed:NSImageNameMultipleDocuments];
                    if (!ico) ico = [[NSImage alloc] initWithSize:NSMakeSize(32,32)];
                    [ico setSize:NSMakeSize(32, 32)];

                    CGFloat offsetX = (CGFloat)i * 4.0;
                    CGFloat offsetY = (CGFloat)i * (-4.0);
                    NSRect  frame   = NSMakeRect(lp.x - 16.0 + offsetX,
                                                 lp.y - 16.0 + offsetY,
                                                 32.0, 32.0);
                    NSDraggingItem* item = [[NSDraggingItem alloc] initWithPasteboardWriter:url];
                    [item setDraggingFrame:frame contents:ico];
                    [items addObject:item];
                }

                // Mark session live before starting.
                s.isDragging = YES;
                if (s.wkView)
                    [s.wkView evaluateJavaScript:
                        @"window.dispatchEvent(new Event('__juceOutDragStart'))"
                     completionHandler:nil];

                [view beginDraggingSessionWithItems:items event:ev source:s];

                s.filePaths = @[];
                // The native session owns this gesture; do not also ask
                // WebKit to interpret it as text selection/HTML dragging.
                return nil;
            }

            case NSEventTypeLeftMouseUp:
                [s cancelPendingRegionAction];
                [s disarm];
                break;

            case NSEventTypeKeyDown:
                if (ev.keyCode == 53) {
                    s.regionCancelled = YES;
                    [s cancelPendingRegionAction];
                }
                break;

            default:
                break;
        }
        return ev;
    }];
    return YES;
}

- (void) armWithPath:(NSString*)path
{
    [self armWithPaths:path ? @[path] : @[]];
}

- (void) disarm
{
    if (self.monitor) {
        [NSEvent removeMonitor:self.monitor];
        self.monitor = nil;
    }
    self.filePaths      = @[];
    self.regionXml      = nil;
    self.sourceWindow   = nil;
    self.sessionStarted = NO;
    if (!self.isDragging) {
        self.regionAction = nil;
        self.regionToken = nil;
    }
    // NOTE: do NOT clear isDragging here.  disarm() is called from the
    // NSEvent mouseUp handler which can fire during an active NSDraggingSession,
    // prematurely clearing the flag before the session actually ends.
    // isDragging is set NO only in draggingSession:endedAtPoint:operation: and
    // in armWithPaths: (at the start of a fresh arm).
}

@end

//==============================================================================
// C++ DragMonitor — thin bridge to JuceDragHelper
//==============================================================================
DragMonitor::DragMonitor()
{
    JuceDragHelper* h = [[JuceDragHelper alloc] init];
    helper    = (__bridge_retained void*) h;
    gDragHelper = h;   // weak global for swizzle access
}

void DragMonitor::armRegionXml (const std::string& xml)
{
#if defined(SLUR_DRAG_QA)
    NSLog(@"SLUR_QA arm XML bytes=%lu", (unsigned long)xml.size());
#endif
    JuceDragHelper* h = (__bridge JuceDragHelper*) helper;
    if ([h armWithPaths:@[]])
        h.regionXml = [NSString stringWithUTF8String:xml.c_str()];
}

DragMonitor::~DragMonitor()
{
    JuceDragHelper* h = (__bridge JuceDragHelper*) helper;
    h.regionCancelled = YES;
    h.regionAction = nil;
    [h disarm];
    CFRelease (helper);

    if (keyMonitor) {
        [NSEvent removeMonitor:(__bridge id) keyMonitor];
        CFRelease (keyMonitor);
        keyMonitor = nullptr;
    }
    if (clickMonitor) {
        [NSEvent removeMonitor:(__bridge id) clickMonitor];
        CFRelease (clickMonitor);
        clickMonitor = nullptr;
    }
}

void DragMonitor::arm (const std::string& filePath)
{
    NSString* path = [NSString stringWithUTF8String:filePath.c_str()];
    [(__bridge JuceDragHelper*) helper armWithPath:path];
}

void DragMonitor::armMultiple (const std::vector<std::string>& filePaths)
{
    NSMutableArray<NSString*>* paths = [NSMutableArray array];
    for (const auto& p : filePaths)
        [paths addObject:[NSString stringWithUTF8String:p.c_str()]];
    [(__bridge JuceDragHelper*) helper armWithPaths:paths];
}

void DragMonitor::disarm()
{
    [(__bridge JuceDragHelper*) helper disarm];
}

void DragMonitor::armRegionAction (const std::string& token, std::function<void(double, double, bool)> callback)
{
    JuceDragHelper* h = (__bridge JuceDragHelper*) helper;
    // The WebKit request may arrive after mouse-up. Never arm a future gesture.
    if (([NSEvent pressedMouseButtons] & 1) == 0 || h.isDragging) {
        callback (0, 0, true);
        return;
    }
    [h armWithPaths:@[]];
    h.regionToken = [NSString stringWithUTF8String:token.c_str()];
    h.regionAction = ^(double x, double y, bool cancelled) { callback (x, y, cancelled); };
}

void DragMonitor::cancelRegionAction (const std::string& token)
{
    JuceDragHelper* h = (__bridge JuceDragHelper*) helper;
    if ([h.regionToken isEqualToString:[NSString stringWithUTF8String:token.c_str()]]) {
        h.regionCancelled = YES;
        if (!h.isDragging) [h disarm];
    }
}

//==============================================================================
// Drop-IN + Keyboard + Drag-overlay handling
//==============================================================================
//
//  Class-level method swizzle (no isa change) on WKContentView for:
//    • performDragOperation:  — handles Logic NSFilePromise drops
//    • draggingEntered:       — fires __juceDragEnter when Logic region drag enters
//    • draggingExited:        — fires __juceDragExit when it leaves without drop
//
//  Keyboard monitors prevent Logic from consuming key events while the plugin
//  window is key.
//==============================================================================

// ── Callback wrapper ──────────────────────────────────────────────────────────
// The int is the per-drop sequence index — the file's position at drop
// registration (drag order), captured before the concurrent resolution
// scrambles completion order.
@interface JuceDropCallbackBox : NSObject
@property (nonatomic, copy) void (^block)(NSString*, NSString*, int, NSString*);
@end
@implementation JuceDropCallbackBox @end

static const char kDropCallbackKey = 0;
static const char kWKViewRefKey    = 0;   // ASSIGN ref to the WKWebView

// ── Global swizzle state ──────────────────────────────────────────────────────
static IMP  gOrigPerformDragOp   = nil;
static IMP  gOrigDraggingEntered = nil;
static IMP  gOrigDraggingExited  = nil;
static IMP  gOrigDraggingUpdated = nil;
static IMP  gOrigPrepareDragOp   = nil;
static BOOL gSwizzleInstalled    = NO;

// ── Mouse-position overlay timer ─────────────────────────────────────────────
//
// AppKit's draggingExited: fires whenever a drag crosses an internal sub-view
// boundary (not just when it truly leaves the WKWebView).  Nested sub-views
// of different classes also intercept draggingUpdated:, so no swizzle-based
// heartbeat is reliable.
//
// Instead: once a drag enters the WKWebView we start an 80 ms repeating timer
// that checks the actual mouse position against the WKWebView screen frame.
// While the mouse is inside → fire __juceDragEnter / __juceDragEnterCancel.
// When the mouse leaves    → fire __juceDragExit and stop the timer.
// The timer also stops when performDragOperation: or endedAtPoint: fires.
//
static NSTimer*          gDragPositionTimer = nil;
static __weak WKWebView* gDragTimerWkv      = nil;

static void stopDragTimer (void)
{
    [gDragPositionTimer invalidate];
    gDragPositionTimer = nil;
    gDragTimerWkv      = nil;
}

static void startDragTimerIfNeeded (WKWebView* wkv)
{
    gDragTimerWkv = wkv;
    if (gDragPositionTimer) return;   // already running

    gDragPositionTimer = [NSTimer scheduledTimerWithTimeInterval:0.08
                                                         repeats:YES
                                                           block:^(NSTimer* t)
    {
        WKWebView* w = gDragTimerWkv;
        if (!w || !w.window) { stopDragTimer(); return; }

        NSPoint mousePos = [NSEvent mouseLocation];
        NSRect  viewRect = [w.window
                            convertRectToScreen:[w convertRect:w.bounds toView:nil]];

        if (NSPointInRect (mousePos, viewRect))
        {
            // Mouse is still inside WKWebView — fire keep-alive heartbeat.
            BOOL      isCancel = (gDragHelper && gDragHelper.isDragging);
            NSString* evt      = isCancel ? @"__juceDragEnterCancel" : @"__juceDragEnter";
            NSString* js       = [NSString stringWithFormat:
                @"window.dispatchEvent(new Event('%@'))", evt];
            [w evaluateJavaScript:js completionHandler:nil];
        }
        else
        {
            // Mouse left the WKWebView — hide the overlay and stop.
            [w evaluateJavaScript:
                @"window.dispatchEvent(new Event('__juceDragExit'))"
             completionHandler:nil];
            stopDragTimer();
        }
    }];
}

// ── View search helpers ───────────────────────────────────────────────────────
static WKWebView* findWKWebView (NSView* view)
{
    if ([view isKindOfClass:[WKWebView class]]) return (WKWebView*) view;
    for (NSView* sub in view.subviews) {
        WKWebView* found = findWKWebView (sub);
        if (found) return found;
    }
    return nil;
}

static NSView* findViewWithDragTypes (NSView* root)
{
    for (NSView* sub in root.subviews) {
        if (sub.registeredDraggedTypes.count > 0) return sub;
    }
    for (NSView* sub in root.subviews) {
        NSView* found = findViewWithDragTypes (sub);
        if (found) return found;
    }
    return nil;
}

// Extract <filename> tags from Cubase's vst-xml pasteboard payload.
// Cubase doesn't put audio files on the pasteboard — only an XML metadata
// blob whose <filename> child holds the absolute path of the underlying
// audio file in the project's Audio folder. We parse the path out and read
// the file from disk ourselves.
static NSArray<NSURL*>* extractCubaseXmlFileURLs (NSPasteboard* pb)
{
    NSString* xml = [pb stringForType:@"public.utf8-plain-text"];
    if (!xml || ![xml containsString:@"<vst-xml"]) return @[];
    return [slurVstXmlRegions(xml) valueForKey:@"url"] ?: @[];
}

// ── Convenience: does the pasteboard carry something we can attach? ──────────
// Logic Pro          : NSFilePromiseReceiver  (async region export)
// Pro Tools          : NSURL file URL          (already-existing audio file)
// Cubase             : XML metadata with <filename> — we parse the path out
// Reaper / Studio One: Usually file URL after the DAW writes a temp file
// We also accept the deprecated NSFilenamesPboardType for older hosts.
static BOOL isAcceptableAudioDrag (NSPasteboard* pb)
{
    if (!pb) return NO;

    // 1. NSFilePromise (Logic-style async export)
    NSArray* rcvs = [pb readObjectsForClasses:@[[NSFilePromiseReceiver class]]
                                      options:nil];
    if (rcvs.count > 0) return YES;

    // 2. Direct file URLs (Pro Tools, Reaper, Studio One, etc.)
    NSDictionary* opts = @{ NSPasteboardURLReadingFileURLsOnlyKey : @YES };
    NSArray<NSURL*>* urls =
        [pb readObjectsForClasses:@[[NSURL class]] options:opts];
    if (urls.count > 0 && urls.firstObject.isFileURL) return YES;

    // 3. Legacy NSFilenamesPboardType (older hosts still use it)
    NSArray* legacyPaths = [pb propertyListForType:@"NSFilenamesPboardType"];
    if ([legacyPaths isKindOfClass:[NSArray class]] && legacyPaths.count > 0)
        return YES;

    // 4. Cubase vst-xml — embedded <filename> path
    if ([[pb stringForType:NSPasteboardTypeString] containsString:@"<vst-xml"]) return YES;

    return NO;
}

// Backwards-compatible alias — call sites used the old name.
static BOOL isLogicRegionDrag (NSPasteboard* pb)
{
    return isAcceptableAudioDrag (pb);
}

// ── C-level IMP replacements ──────────────────────────────────────────────────

static BOOL orbPerformDragOp (id selfView, SEL _cmd, id<NSDraggingInfo> info)
{
    JuceDropCallbackBox* cb =
        objc_getAssociatedObject (selfView, &kDropCallbackKey);

    if (cb)
    {
        NSPasteboard* pb = info.draggingPasteboard;
        ORB_LOG ("performDragOperation: types=%{public}@", pb.types);
#if DEBUG
        // Opt-in local fixture only; never record production audio drags.
        WKWebView* diagnosticView = objc_getAssociatedObject (selfView, &kWKViewRefKey);
        if ([diagnosticView.URL.host isEqualToString:@"127.0.0.1"]
            && [diagnosticView.URL.path isEqualToString:@"/tests/region-bundle.html"])
        {
            NSMutableArray* values = [NSMutableArray array];
            for (NSPasteboardType type in pb.types)
            {
                NSData* data = [pb dataForType:type];
                [values addObject:@{ @"type": type, @"bytes": @(data.length),
                    @"base64": data.length <= 128 * 1024 ? [data base64EncodedStringWithOptions:0] ?: @"" : @"" }];
            }
            NSString* path = [NSTemporaryDirectory() stringByAppendingPathComponent:
                [NSString stringWithFormat:@"orb-logic-drag-%@.json", NSUUID.UUID.UUIDString]];
            NSDictionary* report = @{ @"types": values, @"items": @(pb.pasteboardItems.count),
                @"sourceClass": info.draggingSource ? NSStringFromClass([info.draggingSource class]) : @"external" };
            NSData* json = [NSJSONSerialization dataWithJSONObject:report options:0 error:nil];
            [json writeToFile:path atomically:YES];
            NSString* script = [NSString stringWithFormat:
                @"window.dispatchEvent(new CustomEvent('__orbDropDiagnostic',{detail:'%@'}))", jsQuoted(path)];
            [diagnosticView evaluateJavaScript:script completionHandler:nil];
        }
#endif
#if defined(SLUR_DRAG_QA)
        // Local synthetic-fixture qualification only; never part of a shipped plug-in.
        NSMutableDictionary* report = [NSMutableDictionary dictionary];
        report[@"types"] = pb.types;
        NSString* text = [pb stringForType:NSPasteboardTypeString];
        if (text.length && text.length < 1024 * 1024) report[@"text"] = text;
        NSData* reportData = [NSJSONSerialization dataWithJSONObject:report options:NSJSONWritingPrettyPrinted error:nil];
        [reportData writeToFile:[NSTemporaryDirectory() stringByAppendingPathComponent:@"slur-drag-qa-payload.json"] atomically:YES];
#endif

        // ── Our own NSDraggingSession came back to the chat ────────────────
        // Reject the drop so JS 'drop' never fires and the file is NOT
        // re-attached to the chat.  Firing __juceDragComplete dismisses
        // any cancel overlay that orbDraggingEntered put up.
        if (gDragHelper && gDragHelper.isDragging)
        {
            NSLog (@"[DragMonitor] own drag returning — rejecting drop");
            stopDragTimer();
            WKWebView* wkv = gDragHelper.wkView;
            if (wkv)
                [wkv evaluateJavaScript:
                    @"window.dispatchEvent(new Event('__juceDragComplete'))"
                 completionHandler:nil];
            return NO;
        }

        // Prefer structured regions over file URLs: the URL is the whole source,
        // not necessarily the selected/trimmed event. Never silently fall back.
        NSString* vstText = [pb stringForType:NSPasteboardTypeString];
        if ([vstText containsString:@"<vst-xml"]) {
            WKWebView* wkv = objc_getAssociatedObject(selfView, &kWKViewRefKey);
            stopDragTimer();
            NSArray<NSDictionary*>* regions = slurVstXmlRegions(vstText);
            [wkv evaluateJavaScript:@"window.dispatchEvent(new Event('__juceDragComplete'))" completionHandler:nil];
            if (!regions.count) {
                [wkv evaluateJavaScript:@"window.dispatchEvent(new CustomEvent('__juceRegionDropError',{detail:{message:'This DAW selection contains unsupported region data. Nothing was sent.'}}))" completionHandler:nil];
                return YES;
            }
            NSString* capture = regions[0][@"metadata"][@"captureId"];
            NSData* groupJSON = [NSJSONSerialization dataWithJSONObject:@{@"count": @(regions.count), @"captureId": capture} options:0 error:nil];
            NSString* group = [[NSString alloc] initWithData:groupJSON encoding:NSUTF8StringEncoding];
            [wkv evaluateJavaScript:[NSString stringWithFormat:@"window.dispatchEvent(new CustomEvent('__juceDropGroupStart',{detail:%@}))", group] completionHandler:nil];
            NSOperationQueue* queue = [[NSOperationQueue alloc] init];
            queue.maxConcurrentOperationCount = 1;
            [queue addOperationWithBlock:^{
                unsigned long long total = 0;
                for (NSDictionary* region in regions) {
                    NSURL* url = region[@"url"];
                    NSNumber* regular = nil;
                    [url getResourceValue:&regular forKey:NSURLIsRegularFileKey error:nil];
                    const auto size = fileSizeAt(url); total += size;
                    if (!regular.boolValue || size == 0 || size > kMaxDropBytes || total > 500ULL * 1024 * 1024) {
                        dispatch_async(dispatch_get_main_queue(), ^{
                            [wkv evaluateJavaScript:[NSString stringWithFormat:@"window.dispatchEvent(new CustomEvent('__juceRegionDropError',{detail:{captureId:'%@',message:'Region audio is unavailable or exceeds the transfer limit. Nothing was sent.'}}))", capture] completionHandler:nil];
                        });
                        return;
                    }
                }
                for (NSUInteger index = 0; index < regions.count; ++index) {
                    NSDictionary* region = regions[index]; NSURL* url = region[@"url"];
                    NSData* raw = [NSData dataWithContentsOfURL:url];
                    if (!raw || raw.length > kMaxDropBytes) {
                        dispatch_async(dispatch_get_main_queue(), ^{
                            [wkv evaluateJavaScript:[NSString stringWithFormat:@"window.dispatchEvent(new CustomEvent('__juceRegionDropError',{detail:{captureId:'%@',message:'Could not read the complete region selection. Nothing was sent.'}}))", capture] completionHandler:nil];
                        });
                        return;
                    }
                    NSString* encoded = [raw base64EncodedStringWithOptions:0];
                    NSData* json = [NSJSONSerialization dataWithJSONObject:region[@"metadata"] options:0 error:nil];
                    NSString* metadata = [[NSString alloc] initWithData:json encoding:NSUTF8StringEncoding];
                    dispatch_async(dispatch_get_main_queue(), ^{ cb.block(url.lastPathComponent, encoded, (int)index, metadata); });
                }
            }];
            return YES;
        }

        // ── NSFilePromiseReceiver (Logic region drag) ──────────────────────
        NSArray<NSFilePromiseReceiver*>* rcvs =
            [pb readObjectsForClasses:@[[NSFilePromiseReceiver class]] options:nil];
        if (rcvs.count > 0)
        {
            NSUInteger fileCount = 0;
            for (NSFilePromiseReceiver* receiver in rcvs)
                fileCount += MAX((NSUInteger)1, receiver.fileTypes.count);
            // Dismiss the drag overlay immediately (Logic file promises never
            // fire a JS 'drop' event, so React can't do it itself).
            stopDragTimer();
            WKWebView* wkv = objc_getAssociatedObject (selfView, &kWKViewRefKey);
            if (wkv) {
                // Tell JS how many files to expect so it can group them into
                // one multi-track message instead of separate messages.
                NSString* startJS = [NSString stringWithFormat:
                    @"window.dispatchEvent(new CustomEvent('__juceDropGroupStart',"
                     "{detail:{count:%lu,logicCaptureId:%@}}))", (unsigned long)fileCount,
                    [pb.types containsObject:@"com.apple.musicapps.LGRegionsPboardType"]
                        ? [NSString stringWithFormat:@"'logic-%ld'", (long)info.draggingSequenceNumber] : @"null"];
                [wkv evaluateJavaScript:startJS completionHandler:nil];
                [wkv evaluateJavaScript:
                    @"window.dispatchEvent(new Event('__juceDragComplete'))"
                 completionHandler:nil];
            }

            NSOperationQueue* bgQueue = [[NSOperationQueue alloc] init];
            bgQueue.qualityOfService  = NSQualityOfServiceUserInitiated;
            bgQueue.maxConcurrentOperationCount = 1;

            // Process ALL receivers, not just the first one. Capture each
            // promise's index NOW, at registration — the receivers resolve
            // concurrently, so the readers fire in completion order.
            NSUInteger sequenceBase = 0;
            for (NSUInteger idx = 0; idx < rcvs.count; idx++) {
                NSFilePromiseReceiver* rcv = rcvs[idx];
                __block int seq = (int) sequenceBase;
                sequenceBase += MAX((NSUInteger)1, rcv.fileTypes.count);
                NSURL* destination = [NSURL fileURLWithPath:[NSTemporaryDirectory()
                    stringByAppendingPathComponent:[@"slur-drop-" stringByAppendingString:NSUUID.UUID.UUIDString]] isDirectory:YES];
                if (![[NSFileManager defaultManager] createDirectoryAtURL:destination withIntermediateDirectories:YES
                    attributes:@{NSFilePosixPermissions: @0700} error:nil]) {
                    failFileDrop(wkv);
                    continue;
                }
                [rcv receivePromisedFilesAtDestination:
                        destination
                                             options:@{}
                                     operationQueue:bgQueue
                                             reader:^(NSURL* fileURL, NSError* err) {
                    const int fileSequence = seq++;
                    if (err) { NSLog (@"[DragMonitor] promise error: %@", err); failFileDrop(wkv); return; }
                    const unsigned long long size = fileSizeAt (fileURL);
                    if (size > kMaxDropBytes) {
                        rejectDropFile (wkv, fileURL, size);
                        [[NSFileManager defaultManager] removeItemAtURL:fileURL error:nil];
                        return;
                    }
                    NSData*   raw  = [NSData dataWithContentsOfURL:fileURL];
                    if (!raw.length) { failFileDrop(wkv); return; }
                    NSString* b64  = [raw base64EncodedStringWithOptions:0];
                    NSString* name = fileURL.lastPathComponent;
                    dispatch_async (dispatch_get_main_queue(), ^{ cb.block (name, b64, fileSequence, @""); });
                    [[NSFileManager defaultManager] removeItemAtURL:fileURL error:nil];
                }];
            }
            return YES;
        }

        // ── Regular file URL drop (Pro Tools, Reaper, Studio One) ──────────
        NSDictionary* opts = @{ NSPasteboardURLReadingFileURLsOnlyKey : @YES };
        NSArray<NSURL*>* urls =
            [pb readObjectsForClasses:@[[NSURL class]] options:opts];
        if (urls.count == 0) {
            // Fallback 1: legacy NSFilenamesPboardType (some older hosts)
            NSArray* legacyPaths = [pb propertyListForType:@"NSFilenamesPboardType"];
            if ([legacyPaths isKindOfClass:[NSArray class]]) {
                NSMutableArray* asURLs = [NSMutableArray array];
                for (NSString* p in legacyPaths) {
                    if ([p isKindOfClass:[NSString class]])
                        [asURLs addObject:[NSURL fileURLWithPath:p]];
                }
                urls = asURLs;
            }
        }
        if (urls.count == 0) {
            // Fallback 2: Cubase vst-xml metadata — extract <filename> paths
            NSArray<NSURL*>* xmlUrls = extractCubaseXmlFileURLs (pb);
            if (xmlUrls.count > 0) {
                ORB_LOG ("extracted %lu file URL(s) from Cubase vst-xml",
                          (unsigned long)xmlUrls.count);
                urls = xmlUrls;
            }
        }

        if (urls.count > 0 && urls.firstObject.isFileURL)
        {
            // Stop the position timer so it doesn't re-fire __juceDragEnter
            // while the mouse is still over the WKWebView post-drop.
            stopDragTimer();

            // Tell JS how many files are coming so they group into one message
            WKWebView* wkv = objc_getAssociatedObject (selfView, &kWKViewRefKey);
            if (wkv) {
                NSString* startJS = [NSString stringWithFormat:
                    @"window.dispatchEvent(new CustomEvent('__juceDropGroupStart',"
                     "{detail:{count:%lu}}))", (unsigned long)urls.count];
                [wkv evaluateJavaScript:startJS completionHandler:nil];
                [wkv evaluateJavaScript:
                    @"window.dispatchEvent(new Event('__juceDragComplete'))"
                 completionHandler:nil];
            }

            NSLog (@"[DragMonitor] processing %lu file URL(s) from drop",
                   (unsigned long)urls.count);

            // Read each file off the main thread to avoid stalling the UI
            // for large WAV files.
            NSOperationQueue* bgQueue = [[NSOperationQueue alloc] init];
            bgQueue.qualityOfService  = NSQualityOfServiceUserInitiated;

            // Same registration-order seq as the promise path — the reads
            // run on a concurrent queue and can finish out of drag order.
            for (NSUInteger idx = 0; idx < urls.count; idx++) {
                NSURL* fileURL = urls[idx];
                if (!fileURL.isFileURL) continue;
                const int seq = (int) idx;
                [bgQueue addOperationWithBlock:^{
                    const unsigned long long size = fileSizeAt (fileURL);
                    if (size > kMaxDropBytes) { rejectDropFile (wkv, fileURL, size); return; }
                    NSData*   raw  = [NSData dataWithContentsOfURL:fileURL];
                    if (!raw) {
                        NSLog (@"[DragMonitor] failed to read %@", fileURL);
                        return;
                    }
                    NSString* b64  = [raw base64EncodedStringWithOptions:0];
                    NSString* name = fileURL.lastPathComponent;
                    dispatch_async (dispatch_get_main_queue(), ^{
                        cb.block (name, b64, seq, @"");
                    });
                }];
            }
            return YES;
        }

        // No recognised pasteboard type — log everything for diagnosis
        ORB_LOG ("drop rejected, unrecognised types: %{public}@", pb.types);
        for (NSPasteboardType t in pb.types) {
            NSData* d = [pb dataForType:t];
            NSString* asUtf8 = d ? [[NSString alloc] initWithData:d encoding:NSUTF8StringEncoding] : nil;
            ORB_LOG ("  type=%{public}@ size=%lu utf8=%{public}@",
                      t, (unsigned long)d.length, asUtf8 ?: @"<not utf8>");
        }
    }

    if (gOrigPerformDragOp)
        return ((BOOL(*)(id,SEL,id<NSDraggingInfo>)) gOrigPerformDragOp)
                   (selfView, _cmd, info);
    return NO;
}

// draggingEntered: — fires overlay events to JS.
//
//  • Our own NSDraggingSession returning → __juceDragEnterCancel (red cancel overlay)
//  • Logic NSFilePromise drag entering   → __juceDragEnter      (blue attach overlay)
//
// We use gDragHelper.wkView directly rather than an associated-object lookup
// because selfView (WKContentView) and the object we stored the ref on may
// differ across WKWebView rebuilds.
static NSDragOperation orbDraggingEntered (id selfView, SEL _cmd,
                                             id<NSDraggingInfo> info)
{
    WKWebView* wkv = objc_getAssociatedObject(selfView, &kWKViewRefKey);
    BOOL ownDrag   = gDragHelper && gDragHelper.isDragging;
    BOOL logicDrag = objc_getAssociatedObject(selfView, &kDropCallbackKey)
        && isLogicRegionDrag (info.draggingPasteboard);

    ORB_LOG ("draggingEntered: pasteboard types=%{public}@ ownDrag=%d acceptable=%d",
              info.draggingPasteboard.types, (int)ownDrag, (int)logicDrag);

    if ((ownDrag || logicDrag) && wkv)
    {
        if (!ownDrag && [info.draggingPasteboard.types containsObject:@"com.apple.musicapps.LGRegionsPboardType"])
        {
            NSString* captureJS = [NSString stringWithFormat:
                @"window.dispatchEvent(new CustomEvent('__juceLogicRegionEnter',{detail:{captureId:'logic-%ld'}}))",
                (long)info.draggingSequenceNumber];
            [wkv evaluateJavaScript:captureJS completionHandler:nil];
        }
        // Fire the initial overlay event immediately, then start the position
        // timer which keeps it alive and detects when the drag truly leaves.
        NSString* evt = ownDrag ? @"__juceDragEnterCancel" : @"__juceDragEnter";
        NSString* js  = [NSString stringWithFormat:
            @"window.dispatchEvent(new Event('%@'))", evt];
        [wkv evaluateJavaScript:js completionHandler:nil];
        startDragTimerIfNeeded (wkv);
    }

    // WebKit may reject promises that our native receiver can handle.
    if (logicDrag) return NSDragOperationCopy;

    if (gOrigDraggingEntered)
        return ((NSDragOperation(*)(id,SEL,id<NSDraggingInfo>)) gOrigDraggingEntered)
                   (selfView, _cmd, info);
    return NSDragOperationCopy;
}

// draggingExited: — no-op for overlay purposes.
// The position timer (started by draggingEntered:) already fires __juceDragExit
// when the mouse truly leaves the WKWebView bounds.  We no longer rely on
// this delegate for overlay management because it fires spuriously on every
// internal sub-view boundary crossing.
static void orbDraggingExited (id selfView, SEL _cmd, id<NSDraggingInfo> info)
{
    if (gOrigDraggingExited)
        ((void(*)(id,SEL,id<NSDraggingInfo>)) gOrigDraggingExited)
            (selfView, _cmd, info);
}

// draggingUpdated: — keep-alive pulse for the JS overlay.
//
// draggingEntered:/draggingExited: can mis-fire when the drag crosses internal
// WKContentView subview boundaries, causing the overlay to flicker.
// draggingUpdated: fires continuously (every mouse move) while the drag IS over
// the view.  Throttled to 10 Hz, it acts as a heartbeat:  React shows the
// overlay while updates arrive and hides it when they stop (200 ms timeout).
static NSDragOperation orbDraggingUpdated (id selfView, SEL _cmd,
                                             id<NSDraggingInfo> info)
{
    // Ensure the timer is running (it may have been stopped if draggingEntered:
    // fired before draggingUpdated: was swizzled, or after a re-entry).
    WKWebView* wkv = objc_getAssociatedObject(selfView, &kWKViewRefKey);
    if (wkv) startDragTimerIfNeeded (wkv);

    if (objc_getAssociatedObject(selfView, &kDropCallbackKey)
        && isAcceptableAudioDrag(info.draggingPasteboard)) return NSDragOperationCopy;

    if (gOrigDraggingUpdated)
        return ((NSDragOperation(*)(id,SEL,id<NSDraggingInfo>)) gOrigDraggingUpdated)
                   (selfView, _cmd, info);
    return NSDragOperationCopy;
}

static BOOL orbPrepareDragOp (id selfView, SEL _cmd, id<NSDraggingInfo> info)
{
    if (objc_getAssociatedObject(selfView, &kDropCallbackKey)
        && isAcceptableAudioDrag(info.draggingPasteboard)) return YES;
    return gOrigPrepareDragOp ? ((BOOL(*)(id,SEL,id<NSDraggingInfo>))gOrigPrepareDragOp)(selfView, _cmd, info) : NO;
}

// ── Helper: install one swizzle ───────────────────────────────────────────────
static void installSwizzle (Class cls, SEL sel, IMP newIMP, IMP* origOut)
{
    Method m = class_getInstanceMethod (cls, sel);
    if (!m) { NSLog (@"[DragMonitor] method %@ not found", NSStringFromSelector (sel)); return; }
    *origOut = method_getImplementation (m);
    if (! class_addMethod (cls, sel, newIMP, method_getTypeEncoding (m)))
        method_setImplementation (m, newIMP);
    NSLog (@"[DragMonitor] swizzled %@ on %@", NSStringFromSelector (sel),
           NSStringFromClass (cls));
}

// ── setupDropHandling ─────────────────────────────────────────────────────────
void DragMonitor::setupDropHandling (void* juceRootNSView,
                                     std::function<void(std::string, std::string, int, std::string)> onFileDrop)
{
    if (dropSetupDone) return;

    NSView* rootView = (__bridge NSView*) juceRootNSView;
    if (rootView.window == nil) return;

    WKWebView* wk = findWKWebView (rootView);
    if (!wk) return;
    installSlurWebSecurity(wk);

    NSView* dropView = findViewWithDragTypes (wk);
    if (!dropView) dropView = wk;

    dropSetupDone = true;

    NSLog (@"[DragMonitor] dropView class = %@",
           NSStringFromClass (object_getClass (dropView)));

    // ── Link WKWebView to helper for out-drag JS events ───────────────────────
    JuceDragHelper* h = (__bridge JuceDragHelper*) helper;
    h.wkView = wk;

    // ── Attach callback + WKWebView ref to the drop target instance ───────────
    objc_setAssociatedObject (dropView, &kWKViewRefKey, wk,
                              OBJC_ASSOCIATION_ASSIGN);

    JuceDropCallbackBox* box = [[JuceDropCallbackBox alloc] init];
    box.block = ^(NSString* name, NSString* b64, int seq, NSString* metadata) {
        onFileDrop (std::string ([name UTF8String]),
                    std::string ([b64  UTF8String]),
                    seq, std::string([metadata UTF8String]));
    };
    objc_setAssociatedObject (dropView, &kDropCallbackKey, box,
                              OBJC_ASSOCIATION_RETAIN_NONATOMIC);

    NSMutableSet* acceptedTypes = [NSMutableSet setWithArray:dropView.registeredDraggedTypes];
    [acceptedTypes addObjectsFromArray:NSFilePromiseReceiver.readableDraggedTypes];
    [acceptedTypes addObjectsFromArray:@[NSPasteboardTypeFileURL, @"NSFilenamesPboardType", NSPasteboardTypeString]];
    [dropView registerForDraggedTypes:acceptedTypes.allObjects];

    // ── Class-level method swizzles (once per process) ────────────────────────
    if (!gSwizzleInstalled)
    {
        Class cls = object_getClass (dropView);
        NSLog (@"[DragMonitor] *** v2 (multi-DAW) swizzle installing on class %@ ***",
               NSStringFromClass(cls));
        installSwizzle (cls, @selector(performDragOperation:),
                        (IMP) orbPerformDragOp,    &gOrigPerformDragOp);
        installSwizzle (cls, @selector(draggingEntered:),
                        (IMP) orbDraggingEntered,  &gOrigDraggingEntered);
        installSwizzle (cls, @selector(draggingExited:),
                        (IMP) orbDraggingExited,   &gOrigDraggingExited);
        installSwizzle (cls, @selector(draggingUpdated:),
                        (IMP) orbDraggingUpdated,  &gOrigDraggingUpdated);
        installSwizzle (cls, @selector(prepareForDragOperation:),
                        (IMP) orbPrepareDragOp, &gOrigPrepareDragOp);
        gSwizzleInstalled = YES;
        NSLog (@"[DragMonitor] swizzle install complete");
    }

    // ── Keyboard fix: Logic eats key events via NSApp.sendEvent: ─────────────
    __weak WKWebView* weakWK = wk;

    if (clickMonitor) {
        [NSEvent removeMonitor:(__bridge id) clickMonitor];
        CFRelease (clickMonitor);
        clickMonitor = nullptr;
    }
    if (keyMonitor) {
        [NSEvent removeMonitor:(__bridge id) keyMonitor];
        CFRelease (keyMonitor);
        keyMonitor = nullptr;
    }

    id rawClick = [NSEvent
        addLocalMonitorForEventsMatchingMask:NSEventMaskLeftMouseDown
        handler:^NSEvent*(NSEvent* ev) {
            WKWebView* wkv = weakWK;
            if (wkv && ev.window == wkv.window && !wkv.window.isKeyWindow)
                [wkv.window makeKeyWindow];
            return ev;
        }];

    id rawKey = [NSEvent
        addLocalMonitorForEventsMatchingMask:
            NSEventMaskKeyDown | NSEventMaskKeyUp | NSEventMaskFlagsChanged
        handler:^NSEvent*(NSEvent* ev) {
            WKWebView* wkv = weakWK;
            if (!wkv) return ev;
            NSWindow* ourWin = wkv.window;
            if (!ourWin || !ourWin.isKeyWindow) return ev;
            // Only capture while the page actually wants the keyboard
            // (typing, or a keyboard game). Otherwise let the event run
            // its normal course so the DAW transport keeps its keys.
            if (!gKeyboardCapture.load (std::memory_order_relaxed)) return ev;
            NSResponder* fr = ourWin.firstResponder;
            if (fr) {
                switch (ev.type) {
                    case NSEventTypeKeyDown:      [fr keyDown:ev];      break;
                    case NSEventTypeKeyUp:        [fr keyUp:ev];        break;
                    case NSEventTypeFlagsChanged: [fr flagsChanged:ev]; break;
                    default: break;
                }
            }
            return nil;
        }];

    clickMonitor = (__bridge_retained void*) rawClick;
    keyMonitor   = (__bridge_retained void*) rawKey;

    NSLog (@"[DragMonitor] setup complete");
}

#else  // Non-Mac stubs
DragMonitor::DragMonitor()  {}
DragMonitor::~DragMonitor() {}
void DragMonitor::armRegionAction (const std::string&, std::function<void(double, double, bool)>) {}
void DragMonitor::cancelRegionAction (const std::string&) {}
void DragMonitor::arm (const std::string&) {}
void DragMonitor::armRegionXml (const std::string&) {}
void DragMonitor::disarm() {}
void DragMonitor::armMultiple (const std::vector<std::string>&) {}
void DragMonitor::setupDropHandling (void*, std::function<void(std::string, std::string, int, std::string)>) {}
void DragMonitor::setKeyboardCapture (bool) {}
#endif
