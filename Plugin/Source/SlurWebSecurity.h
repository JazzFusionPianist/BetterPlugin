#pragma once
#import <WebKit/WebKit.h>
#import <objc/runtime.h>
#include <map>

// JUCE's navigation callback has no frame parameter. Permit the challenge only
// in subframes, and prevent those frames from invoking JUCE's native bridge.
static const char slurGuardedWebView = 0;
static std::map<Class, std::pair<IMP, IMP>> slurWebDelegates;

static bool slurLocalAppURL(NSURL* url)
{
    return [url.scheme isEqualToString:@"juce"] && [url.host isEqualToString:@"juce.backend"]
        && !url.port && !url.user && !url.password;
}

static bool slurChallengeFrameURL(NSURL* url)
{
    if ([url.absoluteString isEqualToString:@"about:blank"]
        || [url.absoluteString isEqualToString:@"about:srcdoc"]) return true;
    const bool challenge = [url.host isEqualToString:@"challenges.cloudflare.com"]
        || ([url.host isEqualToString:@"better-plugin.vercel.app"] && [url.path isEqualToString:@"/security-check.html"]);
    return [url.scheme isEqualToString:@"https"] && challenge
        && (!url.port || url.port.intValue == 443) && !url.user && !url.password;
}

static void slurDecideNavigation(id self, SEL selector, WKWebView* view, WKNavigationAction* action,
                                void (^decision)(WKNavigationActionPolicy))
{
    if (objc_getAssociatedObject(view, &slurGuardedWebView) && action.targetFrame.mainFrame
        && !slurLocalAppURL(action.request.URL)) {
        decision(WKNavigationActionPolicyCancel);
        return;
    }
    if (objc_getAssociatedObject(view, &slurGuardedWebView) && action.targetFrame && !action.targetFrame.mainFrame
        && slurChallengeFrameURL(action.request.URL)) {
        decision(WKNavigationActionPolicyAllow);
        return;
    }
    const auto found = slurWebDelegates.find(object_getClass(self));
    if (found == slurWebDelegates.end()) { decision(WKNavigationActionPolicyCancel); return; }
    ((void(*)(id, SEL, WKWebView*, WKNavigationAction*, void(^)(WKNavigationActionPolicy)))found->second.first)
        (self, selector, view, action, decision);
}

static void slurReceiveMessage(id self, SEL selector, WKUserContentController* controller, WKScriptMessage* message)
{
    if (objc_getAssociatedObject(message.webView, &slurGuardedWebView)
        && (!message.frameInfo.mainFrame || !slurLocalAppURL(message.webView.URL))) return;
    const auto found = slurWebDelegates.find(object_getClass(self));
    if (found != slurWebDelegates.end())
        ((void(*)(id, SEL, WKUserContentController*, WKScriptMessage*))found->second.second)(self, selector, controller, message);
}

static void installSlurWebSecurity(WKWebView* view)
{
    Class cls = object_getClass(view.navigationDelegate);
    SEL nav = @selector(webView:decidePolicyForNavigationAction:decisionHandler:);
    SEL message = @selector(userContentController:didReceiveScriptMessage:);
    Method navMethod = class_getInstanceMethod(cls, nav), messageMethod = class_getInstanceMethod(cls, message);
    if (!navMethod || !messageMethod) return;
    if (slurWebDelegates.find(cls) == slurWebDelegates.end()) {
        slurWebDelegates.emplace(cls, std::make_pair(method_getImplementation(navMethod), method_getImplementation(messageMethod)));
        if (!class_addMethod(cls, nav, (IMP)slurDecideNavigation, method_getTypeEncoding(navMethod)))
            method_setImplementation(navMethod, (IMP)slurDecideNavigation);
        if (!class_addMethod(cls, message, (IMP)slurReceiveMessage, method_getTypeEncoding(messageMethod)))
            method_setImplementation(messageMethod, (IMP)slurReceiveMessage);
    }
    objc_setAssociatedObject(view, &slurGuardedWebView, @YES, OBJC_ASSOCIATION_RETAIN_NONATOMIC);
}
