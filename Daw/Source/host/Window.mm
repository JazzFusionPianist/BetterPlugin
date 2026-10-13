/*  Slur Studio — the window a plug-in's own view is shown in, made with the Mac's own calls.

    As the window the app gave a plug-in before: a title bar of the Mac's with a close button only, as large as the
    view, in the middle of the screen, in front. It follows the view when the plug-in changes its size, and where the
    view may be made larger the window may be pulled larger. Pressing close only says so (`closed`): the window goes
    when whoever holds it lets go.

    Compiled with ARC. */

#include "Plug.h"

#import <Cocoa/Cocoa.h>

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
    w->window = [[NSWindow alloc] initWithContentRect: NSMakeRect (0, 0, size.width, size.height)
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
    w->front();
    return w;
}

} // namespace slur
