#import <AppKit/AppKit.h>
#import <WebKit/WebKit.h>
#include "../../../Plugin/Source/DragMonitor.h"

@interface SlurDragQA : NSObject <NSApplicationDelegate, WKScriptMessageHandler>
@property(strong) NSWindow* window;
@property(strong) WKWebView* browser;
@end
@implementation SlurDragQA {
    DragMonitor monitor;
}
- (void)applicationDidFinishLaunching:(NSNotification*)notice {
    (void)notice;
    self.window = [[NSWindow alloc] initWithContentRect:NSMakeRect(70, 200, 460, 420)
        styleMask:NSWindowStyleMaskTitled | NSWindowStyleMaskClosable | NSWindowStyleMaskResizable
        backing:NSBackingStoreBuffered defer:NO];
    self.window.title = @"Slur Region QA — synthetic audio only";
    NSRect screen = NSScreen.mainScreen.visibleFrame;
    [self.window setFrameTopLeftPoint:NSMakePoint(NSMaxX(screen) - 480, NSMaxY(screen) - 40)];
    self.window.level = NSFloatingWindowLevel;
    WKWebViewConfiguration* config = [[WKWebViewConfiguration alloc] init];
    [config.userContentController addScriptMessageHandler:self name:@"qa"];
    self.browser = [[WKWebView alloc] initWithFrame:self.window.contentView.bounds configuration:config];
    self.browser.autoresizingMask = NSViewWidthSizable | NSViewHeightSizable;
    [self.window.contentView addSubview:self.browser];
    NSString* html = @"<html><body style='font:16px system-ui;padding:24px;background:#f8f6f0'>"
      "<h2>Slur Region QA</h2><p>Synthetic audio only. No uploads or chat messages.</p>"
      "<button onmousedown=\"webkit.messageHandlers.qa.postMessage('arm')\">Prepare test region drag</button>"
      "<p id='target' style='border:2px dashed #777;padding:22px'>Drop DAW test regions here</p>"
      "<textarea id='report' readonly style='width:100%;height:160px'>Waiting for a test drop</textarea>"
      "<script>window.report=x=>document.getElementById('report').value=JSON.stringify(x,null,2);"
      "addEventListener('__juceDropGroupStart',e=>report(e.detail));"
      "addEventListener('__juceOutDragStart',()=>report({drag:'started'}));"
      "addEventListener('__juceOutDragEnd',e=>report({drag:'ended',result:e.detail}));"
      "addEventListener('__juceRegionDropError',e=>report(e.detail));</script></body></html>";
    [self.browser loadHTMLString:html baseURL:nil];
    [self.window makeKeyAndOrderFront:nil];
    [NSApp activateIgnoringOtherApps:YES];
    [self performSelector:@selector(installDrop) withObject:nil afterDelay:1];
}
- (void)installDrop {
    __weak SlurDragQA* weakSelf = self;
    monitor.setupDropHandling((__bridge void*)self.window.contentView, [weakSelf](std::string name, std::string encoded, int seq, std::string region) {
        SlurDragQA* s = weakSelf; if (!s) return;
        NSString* metadata = [NSString stringWithUTF8String:region.c_str()];
        id parsed = metadata.length ? [NSJSONSerialization JSONObjectWithData:[metadata dataUsingEncoding:NSUTF8StringEncoding] options:0 error:nil] : NSNull.null;
        NSData* audio = [[NSData alloc] initWithBase64EncodedString:[NSString stringWithUTF8String:encoded.c_str()] options:0];
        NSDictionary* item = @{@"name": [NSString stringWithUTF8String:name.c_str()], @"seq": @(seq), @"bytes": @(audio.length), @"region": parsed ?: NSNull.null};
        NSData* json = [NSJSONSerialization dataWithJSONObject:item options:NSJSONWritingPrettyPrinted error:nil];
        [json writeToFile:[NSTemporaryDirectory() stringByAppendingPathComponent:@"slur-drag-qa-result.json"] atomically:YES];
        // Keep synthetic drop bytes for independent BWF/PCM inspection, never upload them.
        [audio writeToFile:[NSTemporaryDirectory() stringByAppendingPathComponent:@"slur-drag-qa-audio.wav"] atomically:YES];
        NSString* text = [[NSString alloc] initWithData:json encoding:NSUTF8StringEncoding];
        [s.browser evaluateJavaScript:[@"report(" stringByAppendingFormat:@"%@)", text] completionHandler:nil];
    });
    if (!monitor.isDropSetupDone()) [self performSelector:@selector(installDrop) withObject:nil afterDelay:1];
}
- (void)userContentController:(WKUserContentController*)controller didReceiveScriptMessage:(WKScriptMessage*)message {
    (void)controller;
    if (![message.body isEqual:@"arm"]) return;
    NSString* path = [NSBundle.mainBundle pathForResource:@"fixture" ofType:@"xml"];
    NSString* xml = [NSString stringWithContentsOfFile:path encoding:NSUTF8StringEncoding error:nil];
    if (!xml) return;
    monitor.armRegionXml(std::string(xml.UTF8String));
    [self.browser evaluateJavaScript:@"document.querySelector('button').textContent='Drag test regions to the DAW'" completionHandler:nil];
}
- (BOOL)applicationShouldTerminateAfterLastWindowClosed:(NSApplication*)sender { (void)sender; return YES; }
@end
int main() { @autoreleasepool {
    NSApplication* app = NSApplication.sharedApplication;
    [app setActivationPolicy:NSApplicationActivationPolicyRegular];
    SlurDragQA* delegate = [SlurDragQA new]; app.delegate = delegate; [app run];
} }
