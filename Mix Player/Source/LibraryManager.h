#pragma once
#include <JuceHeader.h>
#include "VersionManager.h"

class AudioEngine;

//==============================================================================
class LibraryManager
{
public:
    LibraryManager();
    ~LibraryManager();

    //--- Track management ---
    void addTrack(const juce::File& file);
    void addVersionToTrack(int trackIndex, const juce::File& file);
    void removeTrack(int trackIndex);
    void renameTrack(int trackIndex, const juce::String& newName);
    void renameVersion(int trackIndex, int versionIndex, const juce::String& newLabel);
    void removeVersion(int trackIndex, int versionIndex);
    void reorderVersions(int trackIndex, int fromIndex, int toIndex);

    //--- Loading ---
    void loadTrack(int trackIndex, AudioEngine& engine);
    void setActiveTrackIndex(int trackIndex);

    //--- Library access ---
    int getNumTracks() const { return (int)tracks.size(); }
    const Track& getTrack(int index) const { return tracks[(size_t)index]; }
    Track& getTrack(int index) { return tracks[(size_t)index]; }
    int getActiveTrackIndex() const { return activeTrackIndex; }

    //--- Persistence ---
    void saveLibrary();
    void loadLibrary();

    //--- Listener interface ---
    struct Listener
    {
        virtual ~Listener() = default;
        virtual void libraryChanged() = 0;
    };

    void addListener(Listener* l)    { listeners.push_back(l); }
    void removeListener(Listener* l) { listeners.erase(std::remove(listeners.begin(), listeners.end(), l), listeners.end()); }

private:
    std::vector<Track> tracks;
    int activeTrackIndex = -1;

    std::vector<Listener*> listeners;
    void notifyListeners();

    juce::File getLibraryFile() const;

    JUCE_DECLARE_NON_COPYABLE_WITH_LEAK_DETECTOR(LibraryManager)
};
