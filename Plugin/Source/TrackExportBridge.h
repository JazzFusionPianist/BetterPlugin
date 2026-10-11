#pragma once
#include <juce_gui_extra/juce_gui_extra.h>
#include <atomic>
#include <memory>

class TrackExportBridge
{
public:
    TrackExportBridge() : pool (1) {}
    ~TrackExportBridge() { shutdown(); }
    void shutdown() { alive->store (false); pool.removeAllJobs (true, -1); }
    // trusted: properties set by native code (host, hostKey, projectPath), never by the page.
    void invoke (const juce::var&, juce::WebBrowserComponent::NativeFunctionCompletion, const juce::NamedValueSet& trusted = {});
    static bool isStemOperation (const juce::String& op);
private:
    juce::ThreadPool pool;
    std::shared_ptr<std::atomic_bool> alive = std::make_shared<std::atomic_bool> (true);
};
