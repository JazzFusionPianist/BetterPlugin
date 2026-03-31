#pragma once
#include <JuceHeader.h>

//==============================================================================
// Represents a single version entry within a track
struct VersionEntry
{
    juce::File file;
    juce::String label;

    VersionEntry() = default;
    VersionEntry(const juce::File& f, const juce::String& l) : file(f), label(l) {}
};

//==============================================================================
// Represents a track in the library
struct Track
{
    juce::String displayName;
    juce::File primaryFile;
    std::vector<VersionEntry> versions;
    bool filesMissing = false;

    Track() = default;
    Track(const juce::File& f)
        : displayName(f.getFileName()), primaryFile(f) {}

    bool hasVersions() const { return !versions.empty(); }
};

//==============================================================================
// Manages multiple versions of a single track and handles seamless switching
class AudioEngine;

class VersionManager
{
public:
    VersionManager();
    ~VersionManager();

    // Load versions from a track - creates AudioFormatReaderSources for each
    void loadVersions(const Track& track, juce::AudioFormatManager& formatManager,
                      juce::AudioTransportSource& transportSource);

    // Clear all loaded versions
    void clearVersions();

    // Switch to a specific version while preserving playback position
    void switchToVersion(int index, juce::AudioTransportSource& transportSource);

    int getActiveVersionIndex() const { return activeVersionIndex; }
    int getNumVersions() const { return (int)sources.size(); }

    bool isLoaded() const { return !sources.empty(); }

    // Returns the file for the given version index (stored separately for UI access)
    juce::File getVersionFile(int index) const
    {
        if (index >= 0 && index < (int)versionFiles.size())
            return versionFiles[(size_t)index];
        return {};
    }

private:
    std::vector<std::unique_ptr<juce::AudioFormatReaderSource>> sources;
    std::vector<juce::File> versionFiles;
    int activeVersionIndex = 0;
    juce::CriticalSection sourceLock;

    JUCE_DECLARE_NON_COPYABLE_WITH_LEAK_DETECTOR(VersionManager)
};
