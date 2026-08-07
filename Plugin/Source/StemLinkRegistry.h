#pragma once

#include <juce_audio_processors/juce_audio_processors.h>
#include <optional>
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

struct ExportRequest
{
    juce::String id;
    juce::String instanceId;
    juce::String trackName;
    juce::String rangeMode;
    juce::int64 createdAtMs = 0;
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

juce::String createExportRequest (const juce::String& hostDescription,
                                  const std::vector<int>& trackIndices,
                                  bool editSelection);
std::optional<ExportRequest> getPendingExportRequest (const juce::String& hostDescription,
                                                       const juce::String& instanceId,
                                                       const juce::String& lastHandledRequestId,
                                                       juce::int64 minimumCreatedAtMs = 0);
juce::File getExportAudioFile (const juce::String& requestId,
                               const juce::String& instanceId,
                               const juce::String& trackName);
bool writeExportStatus (const juce::String& requestId,
                        const juce::String& instanceId,
                        const juce::var& status);
juce::String getExportStatusJson (const juce::String& requestId);
bool finishExport (const juce::String& requestId);
}
