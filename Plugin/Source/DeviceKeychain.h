#pragma once
#include <juce_core/juce_core.h>
#include <optional>

namespace orb::deviceKeychain {
bool store (const juce::String& user, const juce::String& recoveryCode);
std::optional<juce::String> load (const juce::String& user, bool* missing = nullptr);
std::optional<juce::String> create (const juce::String& user, const juce::String& candidate);
bool remove (const juce::String& user);
}
