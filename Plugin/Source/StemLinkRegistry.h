#pragma once

#include <juce_audio_processors/juce_audio_processors.h>
#include <vector>

namespace StemLinkRegistry
{
struct Track
{
    juce::String id;
    juce::String name;
    juce::String colour;
    juce::String host;
    int processId = 0;
    int processGroupId = 0;
    juce::int64 updatedAtMs = 0;
};

class Publisher
{
public:
    Publisher();
    ~Publisher();

    void update (const juce::String& trackName, const juce::String& trackColour);
    void heartbeat();

    const juce::String& getId() const noexcept { return instanceId; }

private:
    void publish();

    juce::String instanceId;
    juce::String name { "Unnamed Track" };
    juce::String colour;
    juce::String host;
    juce::File registryFile;
};

std::vector<Track> getActiveTracks (const juce::String& hostDescription);
int makeTrackIndex (const juce::String& instanceId);
}
