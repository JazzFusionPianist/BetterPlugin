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
    void invoke (const juce::var&, juce::WebBrowserComponent::NativeFunctionCompletion);
private:
    juce::ThreadPool pool;
    std::shared_ptr<std::atomic_bool> alive = std::make_shared<std::atomic_bool> (true);
};
