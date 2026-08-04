#pragma once

#include <juce_core/juce_core.h>
#include <CoreMIDI/CoreMIDI.h>
#include <mutex>
#include <vector>

class OrbControlBridge
{
public:
    struct Track
    {
        int index = 0;
        juce::String name;
        bool selected = false;
        juce::String colour;
    };

    explicit OrbControlBridge (juce::String hostName);
    ~OrbControlBridge();

    juce::String getStatusJson() const;
    juce::String getTracksJson() const;
    bool requestTracks();
    bool setTrackSelected (int index, bool selected);
    bool requestExport (const std::vector<int>& trackIndices, bool editSelection);

private:
    static void readProc (const MIDIPacketList* packets, void* refCon, void*);
    void receive (const uint8_t* data, size_t size);
    void send (uint8_t command, const juce::String& payload = {});
    void sendRaw (const std::vector<uint8_t>& message);
    void receiveMackieControl (const uint8_t* data, size_t size);
    void updateConnected();

    juce::String host;
    MIDIClientRef client = 0;
    MIDIEndpointRef source = 0;       // Orb -> DAW ("Orb Control Out")
    MIDIEndpointRef destination = 0;  // DAW -> Orb ("Orb Control In")

    mutable std::mutex stateMutex;
    std::vector<Track> tracks;
    bool adapterConnected = false;
    juce::String adapterName;
    juce::int64 lastMessageMs = 0;
    juce::StringArray mcuStripNames;

    JUCE_DECLARE_NON_COPYABLE_WITH_LEAK_DETECTOR (OrbControlBridge)
};
