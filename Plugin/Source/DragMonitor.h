#pragma once
#include <string>
#include <vector>
#include <functional>

//==============================================================================
// DragMonitor — macOS-only helper for WKWebView drag support:
//
//  arm()              — intercepts NSEvents to initiate OS file drag OUT
//                       (WKWebView consumes mouse-drag NSEvents so the normal
//                        JUCE GlobalMouseListener never fires)
//
//  setupDropHandling()— class-level method swizzle on WKContentView to
//                       intercept file drops IN, resolving NSFilePromise types
//                       that WKWebView doesn't expose to JS (dataTransfer.files
//                       is always empty for Logic region drags).
//                       Also installs keyboard monitors so Logic's key
//                       shortcuts don't eat input typed inside the plugin.
//
// On non-Mac builds every method is a no-op.
//==============================================================================
class DragMonitor
{
public:
    DragMonitor();
    ~DragMonitor();

    // ── drag-out ─────────────────────────────────────────────────────────────
    void arm         (const std::string& filePath);
    void armMultiple (const std::vector<std::string>& filePaths);
    void disarm      ();

    // ── drop-in + keyboard ───────────────────────────────────────────────────
    // Pass the root NSView of the JUCE component peer.
    // onFileDrop is called on the main thread with (fileName, base64Data).
    void setupDropHandling (void* juceRootNSView,
                            std::function<void(std::string /*name*/,
                                               std::string /*base64*/)> onFileDrop);

    bool isDropSetupDone() const { return dropSetupDone; }

private:
    void* helper       = nullptr;   // retained JuceDragHelper*
    void* keyMonitor   = nullptr;   // retained NSEvent monitor token (keyboard)
    void* clickMonitor = nullptr;   // retained NSEvent monitor token (focus)
    bool  dropSetupDone = false;
};
