#include "../Source/SlurWebSecurity.h"
#include <cassert>
#include <cstdio>
@interface TestFrame : NSObject
@property(getter=isMainFrame) BOOL mainFrame;
@end
@implementation TestFrame @end
@interface TestView : NSObject
@property(strong) NSURL* URL;
@end
@implementation TestView @end
@interface TestNavigation : NSObject
@property(strong) TestFrame* targetFrame;
@property(strong) NSURLRequest* request;
@end
@implementation TestNavigation @end
@interface TestMessage : NSObject
@property(strong) TestFrame* frameInfo;
@property(strong) NSObject* webView;
@end
@implementation TestMessage @end
static int nativeCalls = 0;
static void denyNavigation(id, SEL, id, id, void(^decision)(WKNavigationActionPolicy)) { decision(WKNavigationActionPolicyCancel); }
static void receiveNative(id, SEL, id, id) { nativeCalls++; }
int main() { @autoreleasepool {
    NSObject* delegate = [NSObject new];
    TestView* view = [TestView new];
    view.URL = [NSURL URLWithString:@"juce://juce.backend/index.html"];
    objc_setAssociatedObject(view, &slurGuardedWebView, @YES, OBJC_ASSOCIATION_RETAIN_NONATOMIC);
    slurWebDelegates[object_getClass(delegate)] = {(IMP)denyNavigation, (IMP)receiveNative};
    TestFrame* frame = [TestFrame new];
    TestNavigation* action = [TestNavigation new]; action.targetFrame = frame;
    action.request = [NSURLRequest requestWithURL:[NSURL URLWithString:@"https://challenges.cloudflare.com/turnstile/frame"]];
    __block WKNavigationActionPolicy result = WKNavigationActionPolicyCancel;
    auto decision = ^(WKNavigationActionPolicy policy) { result = policy; };
    slurDecideNavigation(delegate, nullptr, (WKWebView*)view, (WKNavigationAction*)action, decision);
    assert(result == WKNavigationActionPolicyAllow);
    frame.mainFrame = YES;
    slurDecideNavigation(delegate, nullptr, (WKWebView*)view, (WKNavigationAction*)action, decision);
    assert(result == WKNavigationActionPolicyCancel);
    assert(!slurChallengeFrameURL([NSURL URLWithString:@"https://challenges.cloudflare.com.evil.test/"]));
    assert(!slurChallengeFrameURL([NSURL URLWithString:@"http://challenges.cloudflare.com/"]));
    assert(!slurChallengeFrameURL([NSURL URLWithString:@"https://user@challenges.cloudflare.com/"]));
    assert(slurChallengeFrameURL([NSURL URLWithString:@"https://better-plugin.vercel.app/security-check.html"]));
    assert(!slurChallengeFrameURL([NSURL URLWithString:@"https://better-plugin.vercel.app/index.html"]));
    assert(!slurLocalAppURL([NSURL URLWithString:@"https://juce.backend/index.html"]));
    assert(!slurLocalAppURL([NSURL URLWithString:@"juce://juce.backend.evil.test/index.html"]));
    TestMessage* message = [TestMessage new]; message.webView = view; message.frameInfo = frame;
    frame.mainFrame = NO;
    slurReceiveMessage(delegate, nullptr, nil, (WKScriptMessage*)message);
    assert(nativeCalls == 0);
    frame.mainFrame = YES;
    slurReceiveMessage(delegate, nullptr, nil, (WKScriptMessage*)message);
    assert(nativeCalls == 1);
    view.URL = [NSURL URLWithString:@"https://better-plugin.vercel.app/index.html"];
    slurReceiveMessage(delegate, nullptr, nil, (WKScriptMessage*)message);
    assert(nativeCalls == 1);
    puts("web frame isolation checks passed");
} }
