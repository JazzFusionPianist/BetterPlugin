// What the app needs from Cocoa directly: an Audio Unit's maker (JUCE only
// hands back its name), a picture of the web view for the self-test, whether
// the microphone may be used, an AAC file (JUCE writes none), the menu bar,
// and the look of the window's own bar.
#import <AudioToolbox/AudioToolbox.h>
#import <AVFoundation/AVFoundation.h>
#import <AppKit/AppKit.h>
#import <WebKit/WebKit.h>
#import <objc/runtime.h>
#include <string>
#include <mach/mach.h>
#include <sys/sysctl.h>
#include <sys/time.h>

std::string slurAudioUnitMaker (unsigned int type, unsigned int sub, unsigned int manu)
{
    AudioComponentDescription d = { (OSType) type, (OSType) sub, (OSType) manu, 0, 0 };
    AudioComponent c = AudioComponentFindNext (nullptr, &d);
    if (c == nullptr) return {};
    CFStringRef name = nullptr;
    if (AudioComponentCopyName (c, &name) != noErr || name == nullptr) return {};
    NSString* s = (__bridge_transfer NSString*) name;
    const char* utf8 = [s UTF8String];
    return std::string (utf8 != nullptr ? utf8 : "");
}

static void collectWebs (NSView* v, NSMutableArray<WKWebView*>* into)
{
    if (v == nil) return;
    if ([v isKindOfClass: [WKWebView class]]) { [into addObject: (WKWebView*) v]; return; }
    for (NSView* sub in [v subviews]) collectWebs (sub, into);
}
/** The room's own web view is the largest one; slur's page stands beside it in a smaller view of its own. */
static WKWebView* findWeb (NSView* v, bool slursOwn = false)
{
    NSMutableArray<WKWebView*>* all = [NSMutableArray array];
    collectWebs (v, all);
    WKWebView* best = nil;
    for (WKWebView* w in all)
    {
        const double a = w.bounds.size.width * w.bounds.size.height, b = best != nil ? best.bounds.size.width * best.bounds.size.height : 0.0;
        if (best == nil || (slursOwn ? a < b : a > b)) best = w;
    }
    return slursOwn && all.count < 2 ? nil : best;
}

void slurSnapshotWebView (void* nsView, const char* pngPath, bool slursOwn)
{
    NSView* root = (__bridge NSView*) nsView;
    WKWebView* web = findWeb (root, slursOwn);
    if (web == nil && root.window != nil) web = findWeb (root.window.contentView, slursOwn);
    if (web == nil) return;
    NSString* path = [NSString stringWithUTF8String: pngPath];
    [web takeSnapshotWithConfiguration: nil completionHandler: ^(NSImage* img, NSError* err)
    {
        if (img == nil) return;
        NSBitmapImageRep* rep = [[NSBitmapImageRep alloc] initWithData: [img TIFFRepresentation]];
        NSData* png = [rep representationUsingType: NSBitmapImageFileTypePNG properties: @{}];
        [png writeToFile: path atomically: YES];
    }];
}

/** 0 not asked yet, 1 not allowed (by a rule or by the person), 2 allowed. Asking is left to the first time the input opens. */
int slurMicStatus()
{
    switch ([AVCaptureDevice authorizationStatusForMediaType: AVMediaTypeAudio])
    {
        case AVAuthorizationStatusAuthorized:    return 2;
        case AVAuthorizationStatusNotDetermined: return 0;
        default:                                 return 1;
    }
}

struct SlurAac { ExtAudioFileRef file; int ch; };

void* slurAacOpen (const char* path, double sampleRate, int channels, int kbps)
{
    AudioStreamBasicDescription out = {};
    out.mFormatID = kAudioFormatMPEG4AAC; out.mSampleRate = sampleRate; out.mChannelsPerFrame = (UInt32) channels;
    CFURLRef url = CFURLCreateFromFileSystemRepresentation (nullptr, (const UInt8*) path, (CFIndex) strlen (path), false);
    if (url == nullptr) return nullptr;
    ExtAudioFileRef f = nullptr;
    const OSStatus made = ExtAudioFileCreateWithURL (url, kAudioFileM4AType, &out, nullptr, kAudioFileFlags_EraseFile, &f);
    CFRelease (url);
    if (made != noErr || f == nullptr) return nullptr;
    AudioStreamBasicDescription in = {};
    in.mFormatID = kAudioFormatLinearPCM; in.mFormatFlags = kAudioFormatFlagIsFloat | kAudioFormatFlagIsPacked;
    in.mSampleRate = sampleRate; in.mChannelsPerFrame = (UInt32) channels; in.mBitsPerChannel = 32;
    in.mBytesPerFrame = (UInt32) (4 * channels); in.mFramesPerPacket = 1; in.mBytesPerPacket = in.mBytesPerFrame;
    if (ExtAudioFileSetProperty (f, kExtAudioFileProperty_ClientDataFormat, sizeof (in), &in) != noErr) { ExtAudioFileDispose (f); return nullptr; }
    AudioConverterRef conv = nullptr; UInt32 sz = sizeof (conv);
    if (ExtAudioFileGetProperty (f, kExtAudioFileProperty_AudioConverter, &sz, &conv) == noErr && conv != nullptr)
    {
        UInt32 rate = (UInt32) kbps * 1000;
        if (AudioConverterSetProperty (conv, kAudioConverterEncodeBitRate, sizeof (rate), &rate) == noErr)
        {
            CFArrayRef none = nullptr;                                  // tells the file its converter has changed
            ExtAudioFileSetProperty (f, kExtAudioFileProperty_ConverterConfig, sizeof (none), &none);
        }
    }
    return new SlurAac { f, channels };
}

bool slurAacWrite (void* handle, const float* interleaved, int frames)
{
    auto* a = static_cast<SlurAac*> (handle);
    if (a == nullptr || frames <= 0) return a != nullptr;
    AudioBufferList list;
    list.mNumberBuffers = 1;
    list.mBuffers[0].mNumberChannels = (UInt32) a->ch;
    list.mBuffers[0].mDataByteSize = (UInt32) (frames * a->ch * 4);
    list.mBuffers[0].mData = (void*) interleaved;
    return ExtAudioFileWrite (a->file, (UInt32) frames, &list) == noErr;
}

void slurAacClose (void* handle)
{
    auto* a = static_cast<SlurAac*> (handle);
    if (a == nullptr) return;
    ExtAudioFileDispose (a->file);
    delete a;
}

/*  The self-test's stand-in for a file dragged in from the Finder: the web
    view is told, step by step, exactly what AppKit tells it during a real
    drag — entered, updated, and (if the page said yes) dropped.            */
@interface SlurFakeDrag : NSObject <NSDraggingInfo>
@property (strong) NSPasteboard* board;
@property (assign) NSPoint where;
@property (weak) NSWindow* window;
@end
@implementation SlurFakeDrag
@synthesize draggingFormation, animatesToDestination, numberOfValidItemsForDrop, springLoadingHighlight;
- (NSWindow*) draggingDestinationWindow { return self.window; }
- (NSDragOperation) draggingSourceOperationMask { return NSDragOperationCopy | NSDragOperationGeneric; }
- (NSPoint) draggingLocation { return self.where; }
- (NSPoint) draggedImageLocation { return self.where; }
- (NSImage*) draggedImage { return nil; }
- (NSPasteboard*) draggingPasteboard { return self.board; }
- (id) draggingSource { return nil; }
- (NSInteger) draggingSequenceNumber { return 20261006; }
- (void) slideDraggedImageTo: (NSPoint) p { (void) p; }
- (NSArray<NSString*>*) namesOfPromisedFilesDroppedAtDestination: (NSURL*) d { (void) d; return @[]; }
- (void) enumerateDraggingItemsWithOptions: (NSDraggingItemEnumerationOptions) o forView: (NSView*) v classes: (NSArray<Class>*) c searchOptions: (NSDictionary<NSPasteboardReadingOptionKey, id>*) s usingBlock: (void (NS_NOESCAPE ^)(NSDraggingItem*, NSInteger, BOOL*)) b { (void) o; (void) v; (void) c; (void) s; (void) b; }
- (void) resetSpringLoading {}
@end

/** x and y are fractions of the web view, from its top left. Calls back with 1 if the page took the drop, 0 if it refused, -1 if there was no web view. */
void slurFakeDrop (void* nsView, const char* path, double x, double y, void (*done) (int, void*), void* context)
{
    NSView* root = (__bridge NSView*) nsView;
    WKWebView* web = findWeb (root);
    if (web == nil && root.window != nil) web = findWeb (root.window.contentView);
    if (web == nil) { done (-1, context); return; }
    NSPasteboard* pb = [NSPasteboard pasteboardWithUniqueName];
    [pb clearContents];
    [pb writeObjects: @[ [NSURL fileURLWithPath: [NSString stringWithUTF8String: path]] ]];
    SlurFakeDrag* drag = [[SlurFakeDrag alloc] init];
    drag.board = pb; drag.window = web.window; drag.numberOfValidItemsForDrop = 1;
    const NSRect b = web.bounds;
    const NSPoint local = NSMakePoint (b.origin.x + b.size.width * x, web.isFlipped ? b.origin.y + b.size.height * y : b.origin.y + b.size.height * (1.0 - y));
    drag.where = [web convertPoint: local toView: nil];
    [web draggingEntered: drag];
    dispatch_after (dispatch_time (DISPATCH_TIME_NOW, (int64_t) (0.35 * NSEC_PER_SEC)), dispatch_get_main_queue(), ^{
        [web draggingUpdated: drag];
        dispatch_after (dispatch_time (DISPATCH_TIME_NOW, (int64_t) (0.35 * NSEC_PER_SEC)), dispatch_get_main_queue(), ^{
            const NSDragOperation op = [web draggingUpdated: drag];
            if (op == NSDragOperationNone) { [web draggingExited: drag]; done (0, context); return; }
            BOOL ok = [web prepareForDragOperation: drag] && [web performDragOperation: drag];
            [web concludeDragOperation: drag];
            done (ok ? 1 : 0, context);
        });
    });
}

/*  The menu bar. JUCE gives the app its own menu (hide, quit); the rest is made here, so that the lines of File reach
    the page, and Edit's are the system's own: without them a text box in a web view cannot be pasted into. A key
    pressed while the page has the keys goes to the page first, as before; these lines catch what it leaves.
    Its words are written the Mac's way (File, Save As…), as is everything else the Mac draws for the app — window
    bars, panels, the kind the Finder shows. Only the room's own page is all lowercase.                            */
static bool slurTypingNow();
static bool slurRoomHasKeysNow();
@interface SlurMenuTarget : NSObject
@property (assign) void (*picked) (const char*, void*);
@property (assign) void* context;
- (void) pick: (NSMenuItem*) item;
@end
@implementation SlurMenuTarget
- (void) pick: (NSMenuItem*) item
{
    NSString* sys = objc_getAssociatedObject (item, "slurSys");
    if (sys != nil && (! [@[ @"undo", @"redo", @"cut", @"copy", @"paste", @"selectAll" ] containsObject: sys] || slurTypingNow() || ! slurRoomHasKeysNow()))
    {
        [NSApp sendAction: NSSelectorFromString ([sys stringByAppendingString: @":"]) to: nil from: item];      // the Mac's own (in a box, or a window's line)
        return;
    }
    NSString* ident = (NSString*) item.representedObject;
    if (self.picked != nullptr && ident != nil) self.picked ([ident UTF8String], self.context);
}
@end
static SlurMenuTarget* slurMenuTarget = nil;

static void slurLine (NSMenu* menu, NSString* title, NSString* ident, NSString* key, NSEventModifierFlags mods)
{
    NSMenuItem* it = [[NSMenuItem alloc] initWithTitle: title action: @selector (pick:) keyEquivalent: key];
    it.keyEquivalentModifierMask = mods; it.target = slurMenuTarget; it.representedObject = ident;
    [menu addItem: it];
}
static void slurSystemLine (NSMenu* menu, NSString* title, SEL action, NSString* key, NSEventModifierFlags mods)
{
    NSMenuItem* it = [[NSMenuItem alloc] initWithTitle: title action: action keyEquivalent: key];
    it.keyEquivalentModifierMask = mods;
    [menu addItem: it];
}
static void slurAddMenu (NSMenu* bar, NSMenu* menu)
{
    NSMenuItem* holder = [[NSMenuItem alloc] initWithTitle: menu.title action: nil keyEquivalent: @""];
    holder.submenu = menu;
    [bar addItem: holder];
}

/** Says whether the menus are in place (they can only be added once the app has its own menu). */
bool slurInstallMenus (void (*picked) (const char*, void*), void* context)
{
    NSMenu* bar = [NSApp mainMenu];
    if (slurMenuTarget != nil) return true;
    if (bar == nil || bar.numberOfItems < 1) return false;
    slurMenuTarget = [[SlurMenuTarget alloc] init];
    slurMenuTarget.picked = picked; slurMenuTarget.context = context;
    const NSEventModifierFlags cmd = NSEventModifierFlagCommand, shift = NSEventModifierFlagShift, ctrl = NSEventModifierFlagControl, opt = NSEventModifierFlagOption;

    if (bar.numberOfItems > 0 && [bar itemAtIndex: 0].submenu != nil)       // the app's own menu: where the device is chosen
    {
        NSMenu* app = [bar itemAtIndex: 0].submenu;
        NSMenuItem* it = [[NSMenuItem alloc] initWithTitle: @"Settings…" action: @selector (pick:) keyEquivalent: @","];       // the Mac's own word and key for it; audio is one of its parts
        it.keyEquivalentModifierMask = cmd; it.target = slurMenuTarget; it.representedObject = @"settings";
        [app insertItem: it atIndex: 0];
        NSMenuItem* keys = [[NSMenuItem alloc] initWithTitle: @"Key Command Assignments…" action: @selector (pick:) keyEquivalent: @"k"];       // where Logic keeps it, and under Logic's key
        keys.keyEquivalentModifierMask = NSEventModifierFlagOption; keys.target = slurMenuTarget; keys.representedObject = @"keys";
        [app insertItem: keys atIndex: 1];
        [app insertItem: [NSMenuItem separatorItem] atIndex: 2];
    }

    NSMenu* file = [[NSMenu alloc] initWithTitle: @"File"];
    slurLine (file, @"New", @"new", @"n", cmd);
    slurLine (file, @"Open…", @"open", @"o", cmd);
    slurLine (file, @"Open Recent…", @"recent", @"", 0);
    [file addItem: [NSMenuItem separatorItem]];
    slurLine (file, @"Save", @"save", @"s", cmd);
    slurLine (file, @"Save As…", @"saveas", @"s", cmd | shift);
    slurLine (file, @"Rename…", @"rename", @"", 0);
    slurLine (file, @"Revert To…", @"revert", @"", 0);
    [file addItem: [NSMenuItem separatorItem]];
    slurLine (file, @"Import Audio…", @"import", @"i", cmd);
    slurLine (file, @"Hand Off…", @"handoff", @"b", cmd);
    slurAddMenu (bar, file);

    NSMenu* edit = [[NSMenu alloc] initWithTitle: @"Edit"];
    slurSystemLine (edit, @"Undo", @selector (undo:), @"z", cmd);
    slurSystemLine (edit, @"Redo", @selector (redo:), @"z", cmd | shift);
    [edit addItem: [NSMenuItem separatorItem]];
    slurSystemLine (edit, @"Cut", @selector (cut:), @"x", cmd);
    slurSystemLine (edit, @"Copy", @selector (copy:), @"c", cmd);
    slurSystemLine (edit, @"Paste", @selector (paste:), @"v", cmd);
    slurSystemLine (edit, @"Select All", @selector (selectAll:), @"a", cmd);
    [edit addItem: [NSMenuItem separatorItem]];
    /*  the song's own time, by the cycle (Logic's names and Logic's keys): none of these keys means anything in a box that is being typed in  */
    slurLine (edit, @"Cut Section Between Locators", @"timecut", @"x", cmd | ctrl);
    slurLine (edit, @"Insert Silence at Locators", @"timeroom", @"z", cmd | ctrl);
    slurLine (edit, @"Insert Section at Playhead", @"timeput", @"v", cmd | ctrl);
    slurLine (edit, @"Repeat Section Between Locators", @"timerepeat", @"r", cmd | ctrl);
    slurAddMenu (bar, edit);

    /*  Region: what is done to the chosen regions. The lines whose key is a bare letter carry none (see Track).  */
    NSMenu* region = [[NSMenu alloc] initWithTitle: @"Region"];
    slurLine (region, @"Fades for Selection", @"fades", @"", 0);
    slurLine (region, @"Strip Silence", @"strip", @"x", ctrl);
    [region addItem: [NSMenuItem separatorItem]];
    slurLine (region, @"Group", @"groupregs", @"g", cmd | opt);
    slurLine (region, @"Ungroup", @"ungroupregs", @"u", cmd | opt);
    [region addItem: [NSMenuItem separatorItem]];
    slurLine (region, @"Set Project Tempo from Region", @"tempofrom", @"t", ctrl | opt);
    slurLine (region, @"Fit Region to Project Tempo", @"fittempo", @"f", ctrl | opt);
    slurAddMenu (bar, region);

    /*  Track: the lines that make a track carry their keys (the page takes them first; here they are caught when the keys
        are somewhere else in the window). The lines that take a track away, copy it or name it carry none: the same
        keys mean other things in a box that is being typed in, and a menu must never answer for those.            */
    NSMenu* track = [[NSMenu alloc] initWithTitle: @"Track"];
    slurLine (track, @"New Tracks…", @"newtracks", @"n", cmd | opt);
    slurLine (track, @"New Audio Track", @"newaudio", @"a", cmd | opt);
    slurLine (track, @"New Bus", @"newbus", @"", 0);
    [track addItem: [NSMenuItem separatorItem]];
    slurLine (track, @"Duplicate", @"duptrack", @"", 0);
    slurLine (track, @"Rename…", @"renametrack", @"", 0);
    slurLine (track, @"Delete", @"deltrack", @"", 0);
    [track addItem: [NSMenuItem separatorItem]];
    slurLine (track, @"Group for Editing", @"grouptracks", @"g", cmd | ctrl);
    slurLine (track, @"Suspend Groups", @"groupsoff", @"", 0);
    slurAddMenu (bar, track);

    NSMenu* window = [[NSMenu alloc] initWithTitle: @"Window"];
    slurSystemLine (window, @"Minimize", @selector (performMiniaturize:), @"m", cmd);
    slurSystemLine (window, @"Zoom", @selector (performZoom:), @"", 0);
    [window addItem: [NSMenuItem separatorItem]];
    slurSystemLine (window, @"Enter Full Screen", @selector (toggleFullScreen:), @"f", cmd | ctrl);
    slurAddMenu (bar, window);
    [NSApp setWindowsMenu: window];
    return true;
}

/** For the self-test: the menu bar as it stands, "File: New, Open…, … | Edit: …". */
std::string slurMenuTitles()
{
    NSMutableArray<NSString*>* out = [NSMutableArray array];
    for (NSMenuItem* top in [[NSApp mainMenu] itemArray])
    {
        NSMutableArray<NSString*>* lines = [NSMutableArray array];
        for (NSMenuItem* it in top.submenu.itemArray) if (! it.isSeparatorItem) [lines addObject: it.state == NSControlStateValueOn ? [@"✓" stringByAppendingString: it.title] : it.title];      // (✓: a line that is ticked)
        [out addObject: [NSString stringWithFormat: @"%@: %@", top.submenu.title ?: @"", [lines componentsJoinedByString: @", "]]];
    }
    const char* utf8 = [[out componentsJoinedByString: @" | "] UTF8String];
    return std::string (utf8 != nullptr ? utf8 : "");
}

/** For the check: the Mac's save or open panel that is up, in words (its kind, the name it offers, the folder it stands
    in, the kinds of file it takes), and with `cancel` it is closed as by its Cancel button. Empty when none is up. */
std::string slurPanelUp (bool cancel)
{
    NSMutableArray<NSString*>* out = [NSMutableArray array];
    for (NSWindow* w in [NSApp windows])
    {
        if (! [w isKindOfClass: [NSSavePanel class]] || ! w.isVisible) continue;
        NSSavePanel* p = (NSSavePanel*) w;
        const bool open = [w isKindOfClass: [NSOpenPanel class]];
#pragma clang diagnostic push
#pragma clang diagnostic ignored "-Wdeprecated-declarations"
        [out addObject: [NSString stringWithFormat: @"%@ | %@ | %@ | %@ | %@", open ? @"open" : @"save", p.title ?: @"", open ? @"" : p.nameFieldStringValue, p.directoryURL.path ?: @"", [p.allowedFileTypes componentsJoinedByString: @","] ?: @""]];
#pragma clang diagnostic pop
        if (cancel) [p cancel: nil];
    }
    const char* utf8 = [[out componentsJoinedByString: @" ; "] UTF8String];
    return std::string (utf8 != nullptr ? utf8 : "");
}

/** Another copy of the app that is already open (the same bundle id in another process): its process id, or 0.
    With `forward` it is brought to the front; the copy being opened may ask for that, the click that opened it being his.
    The check's own copies ("… self-test.app", see selftest.sh) are a set apart: the app never counts them, and the
    check counts nothing else. */
int slurRunningCopy (bool forward, bool amongChecks)
{
    NSString* ident = NSBundle.mainBundle.bundleIdentifier;
    if (ident == nil) return 0;
    for (NSRunningApplication* a in [NSRunningApplication runningApplicationsWithBundleIdentifier: ident])
    {
        if (a.processIdentifier == getpid() || a.terminated) continue;
        if ([a.bundleURL.lastPathComponent hasSuffix: @"self-test.app"] != amongChecks) continue;
        if (forward)
        {
            if (@available (macOS 14.0, *))
            {
                [NSApp yieldActivationToApplication: a];
                [a activateFromApplication: NSRunningApplication.currentApplication options: NSApplicationActivateAllWindows];
            }
            else [a activateWithOptions: NSApplicationActivateAllWindows];
        }
        return (int) a.processIdentifier;
    }
    return 0;
}

/** The window's own bar takes the colour of the room's control bar, with its name in light type: one dark surface from the
    top of the window down. In full screen the system puts the bar away, and the name with it. */
/*  A window of the app's own that stays over the room while the app is in front, and goes with the app when another one
    is (the meter's face: as a plug-in's window does, host/Window.mm).  */
void slurWindowOverRoom (void* nsView)
{
    NSView* v = (__bridge NSView*) nsView;
    NSWindow* w = v.window;
    if (w == nil) return;
    w.level = NSFloatingWindowLevel;
    w.hidesOnDeactivate = YES;
}
void slurStyleWindow (void* nsView)
{
    NSView* v = (__bridge NSView*) nsView;
    NSWindow* w = v.window;
    if (w == nil) return;
    w.appearance = [NSAppearance appearanceNamed: NSAppearanceNameDarkAqua];
    w.titlebarAppearsTransparent = YES;
    w.backgroundColor = [NSColor colorWithSRGBRed: 0x1b / 255.0 green: 0x1b / 255.0 blue: 0x1a / 255.0 alpha: 1.0];
    w.titleVisibility = NSWindowTitleVisible;
}

/** Command x, c, v and a are keys of the page's, as every other key is. JUCE's web view keeps these four to itself whenever
    the letter that was typed is the Latin one: it sends cut:, copy:, paste: or selectAll: straight to whoever has the keys
    (its way of giving an app the Mac's clipboard in the boxes of a page), and the page never hears the key. So with the
    keyboard set to English a marquee could not be cut or copied and nothing could be pasted; set to Korean, where the
    letter is not the Latin one, they all could.
    The room's own page is asked first now, WebKit's way. A key the page leaves alone (a box in it is being typed in) WebKit
    sends to the app once more, and it comes by here again: that second time it goes JUCE's way, as it always did, and is the
    Mac's cut, copy or paste in the box. The other pages (slur's, the settings') are as they were.
    (Whether a box has the keys cannot be asked of the web view itself: it goes on saying so after a box is gone.) */
static IMP slurWebKitsOwnKeys = nullptr, slurJucesKeys = nullptr;
static __weak WKWebView* slurPageWeb = nil;
static NSEvent* slurKeyAsked = nil;                                              // (the key the page was last asked about: known again when it comes round)
static NSEvent* slurTestKey = nil;                                               // (for the self-test: the key it sent, and whether that one came round)
static bool slurTestKeyCameRound = false;
static BOOL slurKeyToPage (id self, SEL sel, NSEvent* event)
{
    typedef BOOL (*Way) (id, SEL, NSEvent*);
    if (self != slurPageWeb) return ((Way) slurJucesKeys) (self, sel, event);
    if (event == slurKeyAsked) { slurKeyAsked = nil; if (event == slurTestKey) slurTestKeyCameRound = true; return ((Way) slurJucesKeys) (self, sel, event); }
    slurKeyAsked = event;
    return ((Way) slurWebKitsOwnKeys) (self, sel, event);
}
bool slurKeysToPage (void* nsView)
{
    NSView* v = (__bridge NSView*) nsView;
    if (v == nil || v.window == nil) return false;
    WKWebView* web = findWeb (v.window.contentView != nil ? v.window.contentView : v);
    if (web == nil) return false;
    if (slurJucesKeys != nullptr) { slurPageWeb = web; return true; }
    const SEL sel = @selector (performKeyEquivalent:);
    for (Class k = object_getClass (web); k != nil && k != [WKWebView class]; k = class_getSuperclass (k))
    {
        unsigned int n = 0;
        Method* own = class_copyMethodList (k, &n);                              // (what this class itself adds, not what it has from WebKit)
        Method found = nullptr;
        for (unsigned int i = 0; i < n; ++i) if (method_getName (own[i]) == sel) found = own[i];
        free (own);
        if (found == nullptr) continue;
        slurWebKitsOwnKeys = class_getMethodImplementation ([WKWebView class], sel);
        slurPageWeb = web;
        slurJucesKeys = method_setImplementation (found, (IMP) slurKeyToPage);
        return true;
    }
    return false;
}

/** For the self-test: a key with command held, sent the way the Mac sends one to an app — to the window first (its views:
    the page's web view among them, which is given the keys as it has them once the page has been pressed), and to the menu
    bar if nothing there took it. The letter is the Latin one, as it is with the keyboard set to English. Says who took it. */
std::string slurCommandKey (void* nsView, const char* letter, unsigned short keyCode)
{
    NSView* v = (__bridge NSView*) nsView;
    NSWindow* w = v.window;
    if (w == nil) return "no window";
    WKWebView* web = findWeb (w.contentView != nil ? w.contentView : v);
    if (web != nil) [w makeFirstResponder: web];
    NSString* ch = [NSString stringWithUTF8String: letter];
    NSEvent* ev = [NSEvent keyEventWithType: NSEventTypeKeyDown location: NSZeroPoint modifierFlags: NSEventModifierFlagCommand timestamp: NSProcessInfo.processInfo.systemUptime
                               windowNumber: w.windowNumber context: nil characters: ch charactersIgnoringModifiers: ch isARepeat: NO keyCode: keyCode];
    slurTestKey = ev; slurTestKeyCameRound = false;
    if ([w performKeyEquivalent: ev]) return web != nil && w.firstResponder == web ? "the window (the page has the keys)" : "the window";
    if ([NSApp.mainMenu performKeyEquivalent: ev]) return "the menu bar";
    return "nobody";
}
/** For the self-test, a moment after slurCommandKey: what the page did with that key — kept it, or left it alone, so that
    WebKit sent it to the app once more and it came round to the Mac's own cut, copy, paste or select all. */
std::string slurCommandKeyOn()
{
    const bool round = slurTestKeyCameRound;
    slurTestKey = nil; slurTestKeyCameRound = false;
    return round ? "left alone by the page: the Mac's" : "kept by the page";
}

/*  The menu bar as the page writes it (ui/menus.js; design/menu draft 1): every function of the room, so that Help's
    search — the Mac's own, which looks through every line of every menu — finds it. What was built above stands until
    the page has sent its bar. Each line shows the key the room answers to; which keys the menu itself answers is the
    line's tag: 0 none (the key is shown and stays the page's: a bare letter, an arrow, ⌥ or ⇧ alone), 1 only while the
    room's page has the keys and no box in it is being typed in, 2 wherever the keys are (⌘N, ⌘S… mean nothing in a box).
    The Mac's own lines (Edit's undo, cut, copy, paste, select all; Window's) do the Mac's thing in a box being typed in,
    and the room's thing otherwise. */
static NSMutableDictionary<NSString*, NSMenuItem*>* slurLines = nil;        // every line of the page's, by its id (for its tick)
static NSMutableArray<NSMenuItem*>* slurAppLines = nil;                      // what the page put into the app's own menu
static bool slurTyping = false;
static bool slurTypingNow() { return slurTyping; }
static bool slurRoomHasKeys()
{
    WKWebView* web = slurPageWeb;
    NSWindow* w = NSApp.keyWindow;
    if (web == nil || w == nil || web.window != w) return false;
    id fr = w.firstResponder;
    return [fr isKindOfClass: [NSView class]] && [(NSView*) fr isDescendantOf: web];
}
static bool slurRoomHasKeysNow() { return slurRoomHasKeys(); }
static NSString* slurSysOf (NSMenuItem* it) { return objc_getAssociatedObject (it, "slurSys"); }
static bool slurEditSys (NSString* sys) { return [@[ @"undo", @"redo", @"cut", @"copy", @"paste", @"selectAll" ] containsObject: sys]; }
/* the key a key-down is, on the Mac's ANSI keyboard whatever the language it is set to type in (a Korean keyboard gives
   Hangul for the letters, and the menu's keys are Latin) */
static NSString* slurKeyOfCode (unsigned short c)
{
    static NSDictionary<NSNumber*, NSString*>* map = nil;
    if (map == nil)
    {
        NSMutableDictionary* m = [NSMutableDictionary dictionary];
        const char* letters = "asdfhgzxcv?bqweryt123465=97-80]ou[ip?lj'k;\\,/nm.";      // key codes 0…47 (? : none)
        for (int i = 0; letters[i] != 0; ++i) if (letters[i] != '?') m[@(i)] = [NSString stringWithFormat: @"%c", letters[i]];
        m[@50] = @"`"; m[@49] = @" "; m[@36] = @"\r"; m[@76] = @"\r"; m[@48] = @"\t"; m[@51] = @"\b";
        const unichar fk[][2] = { { 123, NSLeftArrowFunctionKey }, { 124, NSRightArrowFunctionKey }, { 125, NSDownArrowFunctionKey }, { 126, NSUpArrowFunctionKey },
                                  { 115, NSHomeFunctionKey }, { 119, NSEndFunctionKey }, { 116, NSPageUpFunctionKey }, { 121, NSPageDownFunctionKey },
                                  { 122, NSF1FunctionKey }, { 120, NSF2FunctionKey }, { 99, NSF3FunctionKey }, { 118, NSF4FunctionKey } };
        for (auto& f : fk) m[@(f[0])] = [NSString stringWithCharacters: &f[1] length: 1];
        const int pad[] = { 82, 83, 84, 85, 86, 87, 88, 89, 91, 92 };
        for (int d = 0; d < 10; ++d) m[@(pad[d])] = [NSString stringWithFormat: @"%d", d];
        map = m;
    }
    return map[@(c)];
}
static NSMenuItem* slurMatch (NSMenu* menu, NSString* key, NSEventModifierFlags mods)
{
    for (NSMenuItem* it in menu.itemArray)
    {
        if (it.submenu != nil) { if (NSMenuItem* got = slurMatch (it.submenu, key, mods)) return got; continue; }
        if (it.target != slurMenuTarget || it.keyEquivalent.length == 0) continue;
        if ((it.keyEquivalentModifierMask & (NSEventModifierFlagCommand | NSEventModifierFlagControl | NSEventModifierFlagOption | NSEventModifierFlagShift)) != mods) continue;
        if ([it.keyEquivalent isEqualToString: key]) return it;
    }
    return nil;
}
@interface SlurMainMenu : NSMenu
@end
@implementation SlurMainMenu
- (BOOL) performKeyEquivalent: (NSEvent*) e
{
    if (e.type == NSEventTypeKeyDown && slurLines != nil)
    {
        const NSEventModifierFlags mods = e.modifierFlags & (NSEventModifierFlagCommand | NSEventModifierFlagControl | NSEventModifierFlagOption | NSEventModifierFlagShift);
        NSString* key = slurKeyOfCode (e.keyCode);
        NSMenuItem* it = key != nil ? slurMatch (self, key, mods) : nil;
        if (it == nil && e.charactersIgnoringModifiers.length > 0) it = slurMatch (self, e.charactersIgnoringModifiers.lowercaseString, mods);
        if (it != nil)
        {
            const NSInteger how = it.tag;
            if (how == 0 || ! it.isEnabled) return NO;                               // shown, and the page's
            if (how == 1 && (slurTyping || ! slurRoomHasKeys())) return NO;
            NSMenu* m = it.menu;
            [m performActionForItemAtIndex: [m indexOfItem: it]];                    // (the menu's title flashes, as the Mac does it)
            return YES;
        }
    }
    return [super performKeyEquivalent: e];
}
@end
static NSMenu* slurBuildMenu (NSString* title, NSArray* lines)
{
    NSMenu* menu = [[NSMenu alloc] initWithTitle: title];
    menu.autoenablesItems = NO;
    for (NSDictionary* l in lines)
    {
        if (l[@"sep"] != nil) { [menu addItem: [NSMenuItem separatorItem]]; continue; }
        NSMenuItem* it = [[NSMenuItem alloc] initWithTitle: l[@"t"] ?: @"" action: nil keyEquivalent: @""];
        if (NSArray* sub = l[@"sub"]) { it.submenu = slurBuildMenu (it.title, sub); [menu addItem: it]; continue; }
        it.action = @selector (pick:); it.target = slurMenuTarget; it.representedObject = l[@"id"];
        if (NSDictionary* k = l[@"k"])
        {
            it.keyEquivalent = k[@"key"] ?: @"";
            NSEventModifierFlags m = 0;
            if ([k[@"cmd"] intValue]) m |= NSEventModifierFlagCommand;
            if ([k[@"ctrl"] intValue]) m |= NSEventModifierFlagControl;
            if ([k[@"opt"] intValue]) m |= NSEventModifierFlagOption;
            if ([k[@"shift"] intValue]) m |= NSEventModifierFlagShift;
            it.keyEquivalentModifierMask = m;
        }
        it.tag = [l[@"answers"] intValue];
        if (l[@"sys"] != nil) objc_setAssociatedObject (it, "slurSys", l[@"sys"], OBJC_ASSOCIATION_RETAIN);
        if ([l[@"dim"] intValue]) it.enabled = NO;
        if (it.representedObject != nil) slurLines[it.representedObject] = it;
        [menu addItem: it];
    }
    return menu;
}
/** The page's bar, put up in place of what stood (the app's own menu keeps its lines and gets the page's first menu
    at its top; Window is the system's windows menu, Help its help menu, where the Mac puts its search). */
bool slurSetMenus (const char* json)
{
    NSMenu* bar = [NSApp mainMenu];
    if (bar == nil || bar.numberOfItems < 1 || slurMenuTarget == nil || json == nullptr) return false;
    id got = [NSJSONSerialization JSONObjectWithData: [NSData dataWithBytes: json length: strlen (json)] options: 0 error: nil];
    NSArray* menus = [got isKindOfClass: [NSDictionary class]] ? got[@"bar"] : got;
    NSDictionary* words = [got isKindOfClass: [NSDictionary class]] && [got[@"words"] isKindOfClass: [NSDictionary class]] ? got[@"words"] : @{};      // the app's own menu, in the program's language
    NSString* (^word) (NSString*) = ^NSString* (NSString* w) { NSString* s = words[w]; return [s isKindOfClass: [NSString class]] ? s : w; };
    if (! [menus isKindOfClass: [NSArray class]] || menus.count < 2) return false;
    if (! [bar isKindOfClass: [SlurMainMenu class]]) object_setClass (bar, [SlurMainMenu class]);      // (the bar answers the keys by the rules above)
    slurLines = [NSMutableDictionary dictionary];
    NSMenu* app = [bar itemAtIndex: 0].submenu;
    if (app != nil)
    {
        for (NSMenuItem* it in slurAppLines ?: @[]) [app removeItem: it];
        for (NSInteger i = app.numberOfItems - 1; i >= 0; --i) { NSMenuItem* it = [app itemAtIndex: i]; if (it.target == slurMenuTarget) [app removeItem: it]; }      // (what slurInstallMenus put there)
        while (app.numberOfItems > 0 && [app itemAtIndex: 0].isSeparatorItem) [app removeItemAtIndex: 0];
        slurAppLines = [NSMutableArray array];
        NSInteger at = 0;
        auto put = [&] (NSMenuItem* it) { [app insertItem: it atIndex: at++]; [slurAppLines addObject: it]; };
        NSMenuItem* about = [[NSMenuItem alloc] initWithTitle: word (@"About Slur Studio") action: @selector (orderFrontStandardAboutPanel:) keyEquivalent: @""];
        put (about); put ([NSMenuItem separatorItem]);
        NSMenuItem* settings = [[NSMenuItem alloc] initWithTitle: word (@"Settings…") action: @selector (pick:) keyEquivalent: @","];
        settings.keyEquivalentModifierMask = NSEventModifierFlagCommand; settings.target = slurMenuTarget; settings.representedObject = @"settings"; settings.tag = 2;
        put (settings);
        NSMenu* first = slurBuildMenu (@"", menus[0][@"sub"]);
        while (first.numberOfItems > 0) { NSMenuItem* it = [first itemAtIndex: 0]; [first removeItemAtIndex: 0]; put (it); }
        put ([NSMenuItem separatorItem]);
        for (NSMenuItem* it in app.itemArray)                                     // the Mac's own lines of it (made in English by the library)
        {
            if (it.action == @selector (hide:)) it.title = word (@"Hide Slur Studio");
            else if (it.action == @selector (hideOtherApplications:)) it.title = word (@"Hide Others");
            else if (it.action == @selector (unhideAllApplications:)) it.title = word (@"Show All");
            else if (it.action == @selector (terminate:)) it.title = word (@"Quit Slur Studio");
            else if (it.submenu != nil && it.submenu == NSApp.servicesMenu) it.title = word (@"Services");
        }
    }
    while (bar.numberOfItems > 1) [bar removeItemAtIndex: 1];
    for (NSUInteger i = 1; i < menus.count; ++i)
    {
        NSString* title = menus[i][@"t"], *en = menus[i][@"en"] ?: title;      // (en: which menu it is, whatever the language)
        NSMenu* m = slurBuildMenu (title, menus[i][@"sub"]);
        slurAddMenu (bar, m);
        if ([title isEqualToString: @"Window"]) [NSApp setWindowsMenu: m];
        if ([title isEqualToString: @"Help"]) [NSApp setHelpMenu: m];
    }
    return true;
}
/** Which of the page's lines are ticked: {"on": {id: 1, …}}; every other line of the page's is not. */
void slurSetMenuState (const char* json)
{
    if (slurLines == nil || json == nullptr) return;
    NSDictionary* d = [NSJSONSerialization JSONObjectWithData: [NSData dataWithBytes: json length: strlen (json)] options: 0 error: nil];
    NSDictionary* on = [d isKindOfClass: [NSDictionary class]] ? d[@"on"] : nil;
    for (NSString* ident in slurLines) slurLines[ident].state = [on isKindOfClass: [NSDictionary class]] && on[ident] != nil ? NSControlStateValueOn : NSControlStateValueOff;
}
/** A box in the room's page is being typed in (or no longer is): the menu answers none of the page's keys meanwhile. */
void slurSetTyping (bool on) { slurTyping = on; }
/** For the self-test: a key sent to the menu bar as the Mac would (the room's page given the keys first, as a press on it
    does): whether the bar took it, and the id of the line it would be. */
std::string slurTestMenuKey (void* nsView, const char* chars, unsigned short keyCode, unsigned long mods)
{
    NSView* v = (__bridge NSView*) nsView;
    NSWindow* w = v.window;
    if (w == nil) return "no window";
    WKWebView* web = findWeb (w.contentView != nil ? w.contentView : v);
    if (web != nil) [w makeFirstResponder: web];
    NSString* ch = [NSString stringWithUTF8String: chars];
    NSEvent* ev = [NSEvent keyEventWithType: NSEventTypeKeyDown location: NSZeroPoint modifierFlags: (NSEventModifierFlags) mods timestamp: NSProcessInfo.processInfo.systemUptime
                               windowNumber: w.windowNumber context: nil characters: ch charactersIgnoringModifiers: ch isARepeat: NO keyCode: keyCode];
    const BOOL took = [NSApp.mainMenu performKeyEquivalent: ev];
    return took ? "taken" : NSApp.keyWindow != w ? "left (the room's window is not the key window)" : slurTyping ? "left (a box is being typed in)" : "left";
}

/** For the self-test: a key pressed as the Mac delivers one — put on the app's own queue, so that it goes the whole way
    (the menu bar's keys, then the window, its views, the page). The window is made the key one first. */
std::string slurTestRealKey (void* nsView, const char* chars, unsigned short keyCode, unsigned long mods)
{
    NSView* v = (__bridge NSView*) nsView;
    NSWindow* w = v.window;
    if (w == nil) return "no window";
    if (NSApp.keyWindow != w) { [NSApp activateIgnoringOtherApps: YES]; [w makeKeyAndOrderFront: nil]; }
    NSString* ch = [NSString stringWithUTF8String: chars];
    for (NSEventType t : { NSEventTypeKeyDown, NSEventTypeKeyUp })
        [NSApp postEvent: [NSEvent keyEventWithType: t location: NSZeroPoint modifierFlags: (NSEventModifierFlags) mods timestamp: NSProcessInfo.processInfo.systemUptime
                                       windowNumber: w.windowNumber context: nil characters: ch charactersIgnoringModifiers: ch isARepeat: NO keyCode: keyCode] atStart: NO];
    return NSApp.keyWindow == w ? "sent" : "sent (not the key window)";
}

/** For the self-test: how the system has the window (as JSON), and a picture of the top of its frame, where its bar is. */
std::string slurWindowReport (void* nsView, const char* pngPath)
{
    NSView* v = (__bridge NSView*) nsView;
    NSWindow* w = v.window;
    if (w == nil) return "{}";
    NSView* frame = w.contentView.superview;
    const CGFloat barH = w.frame.size.height - [w contentRectForFrameRect: w.frame].size.height;
    if (frame != nil && pngPath != nullptr)
    {
        const NSRect top = NSMakeRect (0, frame.isFlipped ? 0 : frame.bounds.size.height - (barH + 60), frame.bounds.size.width, barH + 60);
        NSBitmapImageRep* rep = [frame bitmapImageRepForCachingDisplayInRect: top];
        if (rep != nil)
        {
            [frame cacheDisplayInRect: top toBitmapImageRep: rep];
            [[rep representationUsingType: NSBitmapImageFileTypePNG properties: @{}] writeToFile: [NSString stringWithUTF8String: pngPath] atomically: YES];
        }
    }
    NSColor* c = [w.backgroundColor colorUsingColorSpace: [NSColorSpace sRGBColorSpace]];
    NSString* json = [NSString stringWithFormat: @"{\"title\":\"%@\",\"titleShown\":%d,\"clearBar\":%d,\"dark\":%d,\"bar\":%d,\"back\":\"#%02X%02X%02X\",\"fullScreen\":%d,\"min\":[%d,%d],\"content\":[%d,%d]}",
        [w.title stringByReplacingOccurrencesOfString: @"\"" withString: @"'"], w.titleVisibility == NSWindowTitleVisible ? 1 : 0, w.titlebarAppearsTransparent ? 1 : 0,
        [w.effectiveAppearance.name isEqualToString: NSAppearanceNameDarkAqua] ? 1 : 0, (int) lround (barH),
        (int) lround (c.redComponent * 255), (int) lround (c.greenComponent * 255), (int) lround (c.blueComponent * 255),
        (w.styleMask & NSWindowStyleMaskFullScreen) != 0 ? 1 : 0, (int) w.contentMinSize.width, (int) w.contentMinSize.height,
        (int) w.contentView.bounds.size.width, (int) w.contentView.bounds.size.height];
    return std::string ([json UTF8String]);
}


/** How much memory is the app's own (what Activity Monitor shows as Memory), in megabytes. Sound that is only mapped from a
    file and can be read again is not counted: the system may take it back whenever it likes. */
double slurFootprintMb()
{
    task_vm_info_data_t info;
    mach_msg_type_number_t count = TASK_VM_INFO_COUNT;
    if (task_info (mach_task_self(), TASK_VM_INFO, (task_info_t) &info, &count) != KERN_SUCCESS) return 0.0;
    return (double) info.phys_footprint / 1048576.0;
}

/** How long ago the system started this process, in seconds (so: from the press that opened the app). */
double slurSecondsUp()
{
    struct kinfo_proc kp;
    size_t len = sizeof (kp);
    int mib[4] = { CTL_KERN, KERN_PROC, KERN_PROC_PID, getpid() };
    if (sysctl (mib, 4, &kp, &len, nullptr, 0) != 0 || len == 0) return 0.0;
    struct timeval now;
    gettimeofday (&now, nullptr);
    const struct timeval st = kp.kp_proc.p_starttime;
    return (double) (now.tv_sec - st.tv_sec) + (double) (now.tv_usec - st.tv_usec) / 1.0e6;
}

/** A project's own folder gets the project folder's icon in the Finder (project-folder.png in the app's Resources; none there
    yet: the folder looks as a folder does). */
void slurProjectIcon (const char* folder)
{
    NSString* png = [[NSBundle mainBundle] pathForResource: @"project-folder" ofType: @"png"];
    if (png == nil || folder == nullptr) return;
    NSImage* img = [[NSImage alloc] initWithContentsOfFile: png];
    if (img != nil) [[NSWorkspace sharedWorkspace] setIcon: img forFile: [NSString stringWithUTF8String: folder] options: 0];
}
