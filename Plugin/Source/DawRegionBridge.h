#pragma once
#include <juce_gui_extra/juce_gui_extra.h>
#include <atomic>
#include <memory>

// Owns subprocess jobs so closing an editor cannot orphan an active host edit.
class DawRegionBridge
{
public:
    DawRegionBridge() : pool (1) {}
    ~DawRegionBridge() { shutdown(); }
    void shutdown() { alive->store (false); pool.removeAllJobs (true, -1); }
    void invoke (const juce::var&, juce::WebBrowserComponent::NativeFunctionCompletion,
                 juce::Component* dialogParent = nullptr);
private:
    juce::ThreadPool pool;
    std::shared_ptr<std::atomic_bool> alive = std::make_shared<std::atomic_bool> (true);
};
