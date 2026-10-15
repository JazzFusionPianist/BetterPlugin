/*  Slur Studio — the window a plug-in's own view is shown in, made with the Mac's own calls.

    As the window the app gave a plug-in before: a title bar of the Mac's with a close button only, as large as the
    view, in the middle of the screen, in front. It follows the view when the plug-in changes its size, and where the
    view may be made larger the window may be pulled larger. Pressing close only says so (`closed`): the window goes
    when whoever holds it lets go.

    Compiled with ARC. */

#include "Plug.h"

#import <Cocoa/Cocoa.h>

/* every window of a plug-in's that is up (both kinds), for the self-test to look at */
static NSHashTable<NSWindow*>* slurPlugWindows() { static NSHashTable<NSWindow*>* all = [NSHashTable weakObjectsHashTable]; return all; }

/* over the app's own windows while the app is in front; out of sight with the app when another is */
static void slurKeepOver (NSWindow* w)
{
    if (w == nil) return;
    w.level = NSFloatingWindowLevel;
    w.hidesOnDeactivate = YES;
    w.collectionBehavior = (w.collectionBehavior & ~NSWindowCollectionBehaviorFullScreenPrimary) | NSWindowCollectionBehaviorFullScreenAuxiliary;      // (over the room when the room fills the screen, too)
    [slurPlugWindows() addObject: w];
}

/* a key that came all the way up to the window: nothing of the plug-in's wanted it */
static bool slurPlugKey (NSEvent* e)
{
    const NSEventModifierFlags m = e.modifierFlags & NSEventModifierFlagDeviceIndependentFlagsMask;
    if ((m & (NSEventModifierFlagCommand | NSEventModifierFlagControl | NSEventModifierFlagOption)) != 0 || ! slur::PlugWindow::key) return false;
    const std::string code = e.keyCode == 49 ? "Space" : e.keyCode == 36 ? "Enter" : e.keyCode == 9 && (m & NSEventModifierFlagShift) == 0 ? "KeyV" : "";
    if (code.empty()) return false;
    if (e.isARepeat) return true;                                  // (held down: once)
    return slur::PlugWindow::key (code, (m & NSEventModifierFlagShift) != 0);
}

@interface SlurPlugNSWindow : NSWindow
@end
@implementation SlurPlugNSWindow
- (void) keyDown: (NSEvent*) e { if (! slurPlugKey (e)) [super keyDown: e]; }
@end

@interface SlurPlugWindowEar : NSObject <NSWindowDelegate>
@property (nonatomic, assign) std::function<void()>* closed;
@property (nonatomic, weak) NSWindow* window;
@property (nonatomic, weak) NSView* view;
@end

@implementation SlurPlugWindowEar
- (BOOL) windowShouldClose: (NSWindow*) sender
{
    if (self.closed != nullptr && *self.closed) (*self.closed)();
    return NO;
}
/* the plug-in gave its view another size: the window takes it */
- (void) viewResized: (NSNotification*) note
{
    NSWindow* w = self.window; NSView* v = self.view;
    if (w == nil || v == nil) return;
    const NSSize want = v.frame.size, have = [w contentRectForFrameRect: w.frame].size;
    if (want.width < 1 || want.height < 1 || (std::abs (want.width - have.width) < 0.5 && std::abs (want.height - have.height) < 0.5)) return;
    NSRect frame = [w frameRectForContentRect: NSMakeRect (0, 0, want.width, want.height)];
    frame.origin.x = w.frame.origin.x;
    frame.origin.y = NSMaxY (w.frame) - frame.size.height;         // the title bar stays where it is
    [w setFrame: frame display: YES];
}
@end

namespace
{

struct Window final : slur::PlugWindow
{
    NSWindow* window = nil;
    SlurPlugWindowEar* ear = nil;
    NSView* view = nil;
    std::function<void()> closed;

    ~Window() override
    {
        [[NSNotificationCenter defaultCenter] removeObserver: ear];
        ear.closed = nullptr;
        window.delegate = nil;
        [view removeFromSuperview];                                // the view is the plug-in's: it is given back, not taken down with the window
        [window orderOut: nil];
        [window close];
    }
    void front() override { [window makeKeyAndOrderFront: nil]; }      // (as before: the window comes forward, the app is not pulled in front of other apps)
};

} // namespace

namespace slur
{

std::unique_ptr<PlugWindow> PlugWindow::open (const std::string& title, void* nsView, bool sizes, std::function<void()> closed)
{
    NSView* v = (__bridge NSView*) nsView;
    if (v == nil) return nullptr;
    auto w = std::make_unique<Window>();
    w->closed = std::move (closed);
    w->view = v;
    const NSSize size = NSMakeSize (std::max<CGFloat> (40, v.frame.size.width), std::max<CGFloat> (20, v.frame.size.height));
    w->window = [[SlurPlugNSWindow alloc] initWithContentRect: NSMakeRect (0, 0, size.width, size.height)
                                            styleMask: NSWindowStyleMaskTitled | NSWindowStyleMaskClosable | (sizes ? NSWindowStyleMaskResizable : 0)
                                              backing: NSBackingStoreBuffered
                                                defer: NO];
    w->window.releasedWhenClosed = NO;
    w->window.title = [NSString stringWithUTF8String: title.c_str()] ?: @"";
    w->window.backgroundColor = [NSColor colorWithSRGBRed: 0x15 / 255.0 green: 0x15 / 255.0 blue: 0x14 / 255.0 alpha: 1.0];
    [v setFrameOrigin: NSZeroPoint];
    [w->window.contentView addSubview: v];
    w->ear = [[SlurPlugWindowEar alloc] init];
    w->ear.closed = &w->closed; w->ear.window = w->window; w->ear.view = v;
    w->window.delegate = w->ear;
    v.postsFrameChangedNotifications = YES;
    [[NSNotificationCenter defaultCenter] addObserver: w->ear selector: @selector (viewResized:) name: NSViewFrameDidChangeNotification object: v];
    [w->window center];
    slurKeepOver (w->window);
    w->front();
    return w;
}

void PlugWindow::keepOver (void* nsView)
{
    NSView* v = (__bridge NSView*) nsView;
    if (v != nil) slurKeepOver (v.window);
}

bool PlugWindow::keyRepeats()
{
    NSEvent* e = NSApp.currentEvent;
    return e != nil && e.type == NSEventTypeKeyDown && e.isARepeat;
}

int PlugWindow::keyCodeNow()
{
    NSEvent* e = NSApp.currentEvent;
    return e != nil && e.type == NSEventTypeKeyDown ? (int) e.keyCode : -1;
}

std::string PlugWindow::check (bool pressSpace)
{
    NSMutableArray* list = [NSMutableArray array];
    NSWindow* first = nil;
    NSInteger room = NSNormalWindowLevel;
    for (NSWindow* w in NSApp.windows) if (! [slurPlugWindows() containsObject: w] && w.isVisible && w.canBecomeMainWindow) room = std::max (room, w.level);
    for (NSWindow* w in slurPlugWindows())
    {
        if (first == nil) first = w;
        [list addObject: @{ @"title": w.title ?: @"", @"overTheRoom": @(w.level > room), @"goesWithTheApp": @(w.hidesOnDeactivate),
                            @"jucesOwn": @(! [w isKindOfClass: [SlurPlugNSWindow class]]) }];
    }
    bool sent = false;
    if (pressSpace && first != nil)
    {
        NSEvent* ev = [NSEvent keyEventWithType: NSEventTypeKeyDown location: NSZeroPoint modifierFlags: 0 timestamp: NSProcessInfo.processInfo.systemUptime
                                   windowNumber: first.windowNumber context: nil characters: @" " charactersIgnoringModifiers: @" " isARepeat: NO keyCode: 49];
        [first sendEvent: ev];
        sent = true;
    }
    NSData* json = [NSJSONSerialization dataWithJSONObject: @{ @"windows": list, @"sent": @(sent) } options: 0 error: nil];
    NSString* s = json != nil ? [[NSString alloc] initWithData: json encoding: NSUTF8StringEncoding] : @"{}";
    return std::string (s.UTF8String ?: "{}");
}

} // namespace slur
