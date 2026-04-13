//==============================================================================
// DragMonitor.mm — ObjC++ implementation (macOS only)
//==============================================================================
#include "DragMonitor.h"

#if defined(__APPLE__)
#import <AppKit/AppKit.h>
#import <objc/runtime.h>
#import <WebKit/WebKit.h>
#import <objc/message.h>

static constexpr float kMinDragPx = 4.0f;

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
@property (nonatomic, assign) NSPoint    mouseDownPos;
@property (nonatomic, assign) BOOL       sessionStarted;
@property (nonatomic, strong) id         monitor;      // NSEvent monitor token
@property (nonatomic, weak)   WKWebView* wkView;       // for JS event dispatch
@property (nonatomic, assign) BOOL       isDragging;   // YES while NSDraggingSession is live
@end

@implementation JuceDragHelper

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
    (void)session; (void)screenPoint;
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
}

- (void) armWithPaths:(NSArray<NSString*>*)paths
{
    [self disarm];

    self.filePaths      = paths;
    self.sessionStarted = NO;
    self.isDragging     = NO;   // explicit reset for a fresh arm
    self.mouseDownPos   = [NSEvent mouseLocation];

    __weak JuceDragHelper* ws = self;

    NSEventMask mask = NSEventMaskLeftMouseDown
                     | NSEventMaskLeftMouseDragged
                     | NSEventMaskLeftMouseUp;

    self.monitor = [NSEvent addLocalMonitorForEventsMatchingMask:mask
                                                         handler:^NSEvent*(NSEvent* ev)
    {
        JuceDragHelper* s = ws;
        if (!s) return ev;

        switch (ev.type) {

            case NSEventTypeLeftMouseDown:
                s.mouseDownPos   = [NSEvent mouseLocation];
                s.sessionStarted = NO;
                break;

            case NSEventTypeLeftMouseDragged: {
                if (s.sessionStarted || s.filePaths.count == 0) break;

                NSPoint cur = [NSEvent mouseLocation];
                CGFloat dx  = cur.x - s.mouseDownPos.x;
                CGFloat dy  = cur.y - s.mouseDownPos.y;
                if (sqrt(dx*dx + dy*dy) < (CGFloat)kMinDragPx) break;

                s.sessionStarted = YES;

                NSWindow* win  = [NSApp keyWindow];
                if (!win) win  = [NSApp mainWindow];
                if (!win) break;

                NSView* view = win.contentView;
                if (!view) break;

                NSPoint lp = [view convertPoint:[ev locationInWindow] fromView:nil];

                // Build one NSDraggingItem per file, slightly cascaded.
                NSMutableArray<NSDraggingItem*>* items = [NSMutableArray array];
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
                break;
            }

            case NSEventTypeLeftMouseUp:
                [s disarm];
                break;

            default:
                break;
        }
        return ev;
    }];
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
    self.sessionStarted = NO;
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

DragMonitor::~DragMonitor()
{
    JuceDragHelper* h = (__bridge JuceDragHelper*) helper;
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
@interface JuceDropCallbackBox : NSObject
@property (nonatomic, copy) void (^block)(NSString*, NSString*);
@end
@implementation JuceDropCallbackBox @end

static const char kDropCallbackKey = 0;
static const char kWKViewRefKey    = 0;   // ASSIGN ref to the WKWebView

// ── Global swizzle state ──────────────────────────────────────────────────────
static IMP  gOrigPerformDragOp   = nil;
static IMP  gOrigDraggingEntered = nil;
static IMP  gOrigDraggingExited  = nil;
static IMP  gOrigDraggingUpdated = nil;
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

// ── Convenience: is the pasteboard carrying a Logic region (file promise)? ────
static BOOL isLogicRegionDrag (NSPasteboard* pb)
{
    if (!pb) return NO;
    NSArray* rcvs = [pb readObjectsForClasses:@[[NSFilePromiseReceiver class]]
                                      options:nil];
    return rcvs.count > 0;
}

// ── C-level IMP replacements ──────────────────────────────────────────────────

static BOOL coopPerformDragOp (id selfView, SEL _cmd, id<NSDraggingInfo> info)
{
    JuceDropCallbackBox* cb =
        objc_getAssociatedObject (selfView, &kDropCallbackKey);

    if (cb)
    {
        NSPasteboard* pb = info.draggingPasteboard;
        NSLog (@"[DragMonitor] performDragOperation: types=%@", pb.types);

        // ── Our own NSDraggingSession came back to the chat ────────────────
        // Reject the drop so JS 'drop' never fires and the file is NOT
        // re-attached to the chat.  Firing __juceDragComplete dismisses
        // any cancel overlay that coopDraggingEntered put up.
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

        // ── NSFilePromiseReceiver (Logic region drag) ──────────────────────
        NSArray<NSFilePromiseReceiver*>* rcvs =
            [pb readObjectsForClasses:@[[NSFilePromiseReceiver class]] options:nil];
        if (rcvs.count > 0)
        {
            // Dismiss the drag overlay immediately (Logic file promises never
            // fire a JS 'drop' event, so React can't do it itself).
            stopDragTimer();
            WKWebView* wkv = objc_getAssociatedObject (selfView, &kWKViewRefKey);
            if (wkv)
                [wkv evaluateJavaScript:
                    @"window.dispatchEvent(new Event('__juceDragComplete'))"
                 completionHandler:nil];

            NSOperationQueue* bgQueue = [[NSOperationQueue alloc] init];
            bgQueue.qualityOfService  = NSQualityOfServiceUserInitiated;

            [rcvs.firstObject
                receivePromisedFilesAtDestination:
                    [NSURL fileURLWithPath:NSTemporaryDirectory() isDirectory:YES]
                                         options:@{}
                                 operationQueue:bgQueue
                                         reader:^(NSURL* fileURL, NSError* err) {
                if (err) { NSLog (@"[DragMonitor] promise error: %@", err); return; }
                NSData*   raw  = [NSData dataWithContentsOfURL:fileURL];
                if (!raw) return;
                NSString* b64  = [raw base64EncodedStringWithOptions:0];
                NSString* name = fileURL.lastPathComponent;
                dispatch_async (dispatch_get_main_queue(), ^{ cb.block (name, b64); });
            }];
            return YES;
        }

        // ── Regular file URL drop ──────────────────────────────────────────
        NSDictionary* opts = @{ NSPasteboardURLReadingFileURLsOnlyKey : @YES };
        NSArray<NSURL*>* urls =
            [pb readObjectsForClasses:@[[NSURL class]] options:opts];
        if (urls.count > 0 && urls.firstObject.isFileURL)
        {
            NSURL*    fileURL = urls.firstObject;
            NSData*   raw     = [NSData dataWithContentsOfURL:fileURL];
            NSString* b64     = [raw base64EncodedStringWithOptions:0];
            NSString* name    = fileURL.lastPathComponent;
            if (raw) cb.block (name, b64);
            return YES;
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
static NSDragOperation coopDraggingEntered (id selfView, SEL _cmd,
                                             id<NSDraggingInfo> info)
{
    WKWebView* wkv = gDragHelper ? gDragHelper.wkView : nil;
    BOOL ownDrag   = gDragHelper && gDragHelper.isDragging;
    BOOL logicDrag = isLogicRegionDrag (info.draggingPasteboard);

    if ((ownDrag || logicDrag) && wkv)
    {
        // Fire the initial overlay event immediately, then start the position
        // timer which keeps it alive and detects when the drag truly leaves.
        NSString* evt = ownDrag ? @"__juceDragEnterCancel" : @"__juceDragEnter";
        NSString* js  = [NSString stringWithFormat:
            @"window.dispatchEvent(new Event('%@'))", evt];
        [wkv evaluateJavaScript:js completionHandler:nil];
        startDragTimerIfNeeded (wkv);
    }

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
static void coopDraggingExited (id selfView, SEL _cmd, id<NSDraggingInfo> info)
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
static NSDragOperation coopDraggingUpdated (id selfView, SEL _cmd,
                                             id<NSDraggingInfo> info)
{
    // Ensure the timer is running (it may have been stopped if draggingEntered:
    // fired before draggingUpdated: was swizzled, or after a re-entry).
    WKWebView* wkv = gDragHelper ? gDragHelper.wkView : nil;
    if (wkv) startDragTimerIfNeeded (wkv);

    if (gOrigDraggingUpdated)
        return ((NSDragOperation(*)(id,SEL,id<NSDraggingInfo>)) gOrigDraggingUpdated)
                   (selfView, _cmd, info);
    return NSDragOperationCopy;
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
                                     std::function<void(std::string, std::string)> onFileDrop)
{
    if (dropSetupDone) return;

    NSView* rootView = (__bridge NSView*) juceRootNSView;
    if (rootView.window == nil) return;

    WKWebView* wk = findWKWebView (rootView);
    if (!wk) return;

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
    box.block = ^(NSString* name, NSString* b64) {
        onFileDrop (std::string ([name UTF8String]),
                    std::string ([b64  UTF8String]));
    };
    objc_setAssociatedObject (dropView, &kDropCallbackKey, box,
                              OBJC_ASSOCIATION_RETAIN_NONATOMIC);

    // ── Class-level method swizzles (once per process) ────────────────────────
    if (!gSwizzleInstalled)
    {
        Class cls = object_getClass (dropView);
        installSwizzle (cls, @selector(performDragOperation:),
                        (IMP) coopPerformDragOp,    &gOrigPerformDragOp);
        installSwizzle (cls, @selector(draggingEntered:),
                        (IMP) coopDraggingEntered,  &gOrigDraggingEntered);
        installSwizzle (cls, @selector(draggingExited:),
                        (IMP) coopDraggingExited,   &gOrigDraggingExited);
        installSwizzle (cls, @selector(draggingUpdated:),
                        (IMP) coopDraggingUpdated,  &gOrigDraggingUpdated);
        gSwizzleInstalled = YES;
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
void DragMonitor::arm (const std::string&) {}
void DragMonitor::disarm() {}
void DragMonitor::setupDropHandling (void*, std::function<void(std::string, std::string)>) {}
#endif
