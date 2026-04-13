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

//==============================================================================
// JuceDragHelper — NSDraggingSource + NSEvent monitor for drag-OUT
//==============================================================================
@interface JuceDragHelper : NSObject <NSDraggingSource>
@property (nonatomic, strong) NSString*  filePath;
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
    (void)session; (void)screenPoint; (void)operation;
    self.isDragging = NO;
    if (self.wkView)
        [self.wkView evaluateJavaScript:
            @"window.dispatchEvent(new Event('__juceOutDragEnd'))"
         completionHandler:nil];
    [self disarm];
}

- (void) armWithPath:(NSString*)path
{
    [self disarm];

    self.filePath       = path;
    self.sessionStarted = NO;
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
                if (s.sessionStarted || !s.filePath) break;

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

                NSURL*   url  = [NSURL fileURLWithPath:s.filePath];
                NSImage* icon = [[NSWorkspace sharedWorkspace] iconForFile:s.filePath];
                if (!icon) icon = [NSImage imageNamed:NSImageNameMultipleDocuments];
                if (!icon) icon = [[NSImage alloc] initWithSize:NSMakeSize(32,32)];
                [icon setSize:NSMakeSize(32, 32)];

                NSPoint lp    = [view convertPoint:[ev locationInWindow] fromView:nil];
                NSRect  frame = NSMakeRect(lp.x - 16.0, lp.y - 16.0, 32.0, 32.0);

                NSDraggingItem* item = [[NSDraggingItem alloc] initWithPasteboardWriter:url];
                [item setDraggingFrame:frame contents:icon];

                // Mark session live before starting (so JS receives the event
                // before any immediate drop event could fire).
                s.isDragging = YES;
                if (s.wkView)
                    [s.wkView evaluateJavaScript:
                        @"window.dispatchEvent(new Event('__juceOutDragStart'))"
                     completionHandler:nil];

                [view beginDraggingSessionWithItems:@[item] event:ev source:s];

                s.filePath = nil;
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

- (void) disarm
{
    if (self.monitor) {
        [NSEvent removeMonitor:self.monitor];
        self.monitor = nil;
    }
    self.filePath       = nil;
    self.sessionStarted = NO;
    self.isDragging     = NO;
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
static BOOL gSwizzleInstalled    = NO;

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

    if (gDragHelper && gDragHelper.isDragging)
    {
        // Our own audio drag is coming back home — show cancel overlay.
        if (wkv)
            [wkv evaluateJavaScript:
                @"window.dispatchEvent(new Event('__juceDragEnterCancel'))"
             completionHandler:nil];
    }
    else if (isLogicRegionDrag (info.draggingPasteboard))
    {
        // Logic region drag entering — show attach overlay.
        if (wkv)
            [wkv evaluateJavaScript:
                @"window.dispatchEvent(new Event('__juceDragEnter'))"
             completionHandler:nil];
    }

    if (gOrigDraggingEntered)
        return ((NSDragOperation(*)(id,SEL,id<NSDraggingInfo>)) gOrigDraggingEntered)
                   (selfView, _cmd, info);
    return NSDragOperationCopy;
}

// draggingExited: — hides the overlay when any recognised drag leaves.
static void coopDraggingExited (id selfView, SEL _cmd, id<NSDraggingInfo> info)
{
    WKWebView* wkv = gDragHelper ? gDragHelper.wkView : nil;

    BOOL ownDrag   = gDragHelper && gDragHelper.isDragging;
    BOOL logicDrag = info && isLogicRegionDrag (info.draggingPasteboard);

    if ((ownDrag || logicDrag) && wkv)
        [wkv evaluateJavaScript:
            @"window.dispatchEvent(new Event('__juceDragExit'))"
         completionHandler:nil];

    if (gOrigDraggingExited)
        ((void(*)(id,SEL,id<NSDraggingInfo>)) gOrigDraggingExited)
            (selfView, _cmd, info);
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
                        (IMP) coopPerformDragOp,   &gOrigPerformDragOp);
        installSwizzle (cls, @selector(draggingEntered:),
                        (IMP) coopDraggingEntered,  &gOrigDraggingEntered);
        installSwizzle (cls, @selector(draggingExited:),
                        (IMP) coopDraggingExited,   &gOrigDraggingExited);
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
