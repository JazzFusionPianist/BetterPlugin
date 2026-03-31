#include "LibraryManager.h"
#include "AudioEngine.h"

LibraryManager::LibraryManager()
{
    loadLibrary();
}

LibraryManager::~LibraryManager()
{
    saveLibrary();
}

void LibraryManager::addTrack(const juce::File& file)
{
    // Avoid duplicates
    for (const auto& t : tracks)
        if (t.primaryFile == file) return;

    tracks.emplace_back(file);
    notifyListeners();
}

void LibraryManager::addVersionToTrack(int trackIndex, const juce::File& file)
{
    if (trackIndex < 0 || trackIndex >= (int)tracks.size()) return;

    auto& track = tracks[(size_t)trackIndex];

    // If no versions yet, the primary file becomes version 0
    if (track.versions.empty() && track.primaryFile.existsAsFile())
    {
        VersionEntry primaryVersion(track.primaryFile,
                                    track.primaryFile.getFileNameWithoutExtension());
        track.versions.push_back(primaryVersion);
    }

    VersionEntry entry(file, file.getFileNameWithoutExtension());
    track.versions.push_back(entry);
    notifyListeners();
}

void LibraryManager::removeTrack(int trackIndex)
{
    if (trackIndex < 0 || trackIndex >= (int)tracks.size()) return;
    tracks.erase(tracks.begin() + trackIndex);
    if (activeTrackIndex >= (int)tracks.size())
        activeTrackIndex = (int)tracks.size() - 1;
    notifyListeners();
}

void LibraryManager::renameTrack(int trackIndex, const juce::String& newName)
{
    if (trackIndex < 0 || trackIndex >= (int)tracks.size()) return;
    tracks[(size_t)trackIndex].displayName = newName;
    notifyListeners();
}

void LibraryManager::renameVersion(int trackIndex, int versionIndex, const juce::String& newLabel)
{
    if (trackIndex < 0 || trackIndex >= (int)tracks.size()) return;
    auto& track = tracks[(size_t)trackIndex];
    if (versionIndex < 0 || versionIndex >= (int)track.versions.size()) return;
    track.versions[(size_t)versionIndex].label = newLabel;
    notifyListeners();
}

void LibraryManager::removeVersion(int trackIndex, int versionIndex)
{
    if (trackIndex < 0 || trackIndex >= (int)tracks.size()) return;
    auto& track = tracks[(size_t)trackIndex];
    if (versionIndex < 0 || versionIndex >= (int)track.versions.size()) return;
    track.versions.erase(track.versions.begin() + versionIndex);
    notifyListeners();
}

void LibraryManager::reorderVersions(int trackIndex, int fromIndex, int toIndex)
{
    if (trackIndex < 0 || trackIndex >= (int)tracks.size()) return;
    auto& versions = tracks[(size_t)trackIndex].versions;
    if (fromIndex < 0 || fromIndex >= (int)versions.size()) return;
    if (toIndex < 0 || toIndex >= (int)versions.size()) return;
    if (fromIndex == toIndex) return;

    auto item = versions[(size_t)fromIndex];
    versions.erase(versions.begin() + fromIndex);
    versions.insert(versions.begin() + toIndex, item);
    notifyListeners();
}

void LibraryManager::setActiveTrackIndex(int trackIndex)
{
    if (trackIndex < 0 || trackIndex >= (int)tracks.size()) return;
    if (trackIndex == activeTrackIndex) return;

    activeTrackIndex = trackIndex;
    notifyListeners();
}

void LibraryManager::loadTrack(int trackIndex, AudioEngine& engine)
{
    if (trackIndex < 0 || trackIndex >= (int)tracks.size()) return;

    activeTrackIndex = trackIndex;
    const Track& track = tracks[(size_t)trackIndex];

    engine.loadVersions(track);
    engine.play();
    notifyListeners();
}

//--- Persistence ---

juce::File LibraryManager::getLibraryFile() const
{
    auto appSupport = juce::File::getSpecialLocation(juce::File::userApplicationDataDirectory);
    auto masterRefDir = appSupport.getChildFile("MasterRef");
    masterRefDir.createDirectory();
    return masterRefDir.getChildFile("library.xml");
}

void LibraryManager::saveLibrary()
{
    auto xml = std::make_unique<juce::XmlElement>("MasterRefLibrary");
    xml->setAttribute("activeTrackIndex", activeTrackIndex);

    for (const auto& track : tracks)
    {
        auto* trackEl = xml->createNewChildElement("Track");
        trackEl->setAttribute("displayName", track.displayName);
        trackEl->setAttribute("primaryFile", track.primaryFile.getFullPathName());

        for (const auto& version : track.versions)
        {
            auto* versionEl = trackEl->createNewChildElement("Version");
            versionEl->setAttribute("file",  version.file.getFullPathName());
            versionEl->setAttribute("label", version.label);
        }
    }

    xml->writeTo(getLibraryFile());
}

void LibraryManager::loadLibrary()
{
    auto file = getLibraryFile();
    if (!file.existsAsFile()) return;

    auto xml = juce::XmlDocument::parse(file);
    if (xml == nullptr) return;

    tracks.clear();
    activeTrackIndex = xml->getIntAttribute("activeTrackIndex", -1);

    for (auto* trackEl : xml->getChildIterator())
    {
        if (trackEl->getTagName() != "Track") continue;

        Track track;
        track.displayName  = trackEl->getStringAttribute("displayName");
        track.primaryFile  = juce::File(trackEl->getStringAttribute("primaryFile"));
        track.filesMissing = !track.primaryFile.existsAsFile();

        for (auto* versionEl : trackEl->getChildIterator())
        {
            if (versionEl->getTagName() != "Version") continue;

            VersionEntry entry;
            entry.file  = juce::File(versionEl->getStringAttribute("file"));
            entry.label = versionEl->getStringAttribute("label");

            if (!entry.file.existsAsFile())
                track.filesMissing = true;

            track.versions.push_back(entry);
        }

        tracks.push_back(track);
    }
}

void LibraryManager::notifyListeners()
{
    saveLibrary();

    for (auto* l : listeners)
        l->libraryChanged();
}
