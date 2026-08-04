#pragma once

#include <juce_core/juce_core.h>
#include <juce_events/juce_events.h>
#include <functional>

namespace HostStemUploader
{
void upload (const juce::File& file, const juce::String& uploadUrl,
             const juce::String& contentType,
             std::function<void (bool, juce::String)> completion);
}
