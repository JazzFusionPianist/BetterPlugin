#include "StemLinkRegistry.h"
#include <algorithm>

#if JUCE_WINDOWS
 #include <windows.h>
#else
 #include <unistd.h>
#endif

namespace StemLinkRegistry
{
namespace
{
constexpr juce::int64 kHeartbeatFreshnessMs = 7000;
constexpr juce::int64 kStaleFileCleanupMs = 60000;

int currentProcessId()
{
#if JUCE_WINDOWS
    return static_cast<int> (::GetCurrentProcessId());
#else
    return static_cast<int> (::getpid());
#endif
}

int currentProcessGroupId()
{
#if JUCE_WINDOWS
    return currentProcessId();
#else
    return static_cast<int> (::getpgrp());
#endif
}

juce::File registryDirectory()
{
    return juce::File::getSpecialLocation (juce::File::userApplicationDataDirectory)
        .getChildFile ("Orb").getChildFile ("StemLink");
}
}

Publisher::Publisher()
    : instanceId (juce::Uuid().toString().removeCharacters ("-")),
      host (juce::PluginHostType().getHostDescription())
{
    const auto directory = registryDirectory();
    directory.createDirectory();
    registryFile = directory.getChildFile (
        juce::String (currentProcessId()) + "-" + instanceId + ".json");
    publish();
}

Publisher::~Publisher()
{
    registryFile.deleteFile();
}

void Publisher::update (const juce::String& trackName, const juce::String& trackColour)
{
    const auto cleanedName = trackName.trim();
    name = cleanedName.isNotEmpty() ? cleanedName : "Unnamed Track";
    colour = trackColour;
    publish();
}

void Publisher::heartbeat()
{
    publish();
}

void Publisher::publish()
{
    auto object = new juce::DynamicObject();
    object->setProperty ("schema", 1);
    object->setProperty ("id", instanceId);
    object->setProperty ("name", name);
    object->setProperty ("color", colour);
    object->setProperty ("hostName", host);
    object->setProperty ("processId", currentProcessId());
    object->setProperty ("processGroupId", currentProcessGroupId());
    object->setProperty ("updatedAtMs", juce::Time::currentTimeMillis());

    juce::TemporaryFile temporary (registryFile);
    if (temporary.getFile().replaceWithText (juce::JSON::toString (juce::var (object), false)))
        temporary.overwriteTargetFileWithTemporary();
}

int makeTrackIndex (const juce::String& instanceId)
{
    return 0x40000000 | (instanceId.hashCode() & 0x3fffffff);
}

std::vector<Track> getActiveTracks (const juce::String& hostDescription)
{
    std::vector<Track> result;
    const auto directory = registryDirectory();
    if (! directory.isDirectory()) return result;

    juce::Array<juce::File> files;
    directory.findChildFiles (files, juce::File::findFiles, false, "*.json");
    const auto now = juce::Time::currentTimeMillis();
    const int processId = currentProcessId();
    const int processGroupId = currentProcessGroupId();

    for (const auto& file : files)
    {
        const auto fileAge = now - file.getLastModificationTime().toMilliseconds();
        if (fileAge > kStaleFileCleanupMs)
        {
            file.deleteFile();
            continue;
        }

        const auto parsed = juce::JSON::parse (file.loadFileAsString());
        auto* object = parsed.getDynamicObject();
        if (object == nullptr) continue;

        Track track;
        track.id = object->getProperty ("id").toString();
        track.name = object->getProperty ("name").toString();
        track.colour = object->getProperty ("color").toString();
        track.host = object->getProperty ("hostName").toString();
        track.processId = static_cast<int> (object->getProperty ("processId"));
        track.processGroupId = static_cast<int> (object->getProperty ("processGroupId"));
        track.updatedAtMs = static_cast<juce::int64> (object->getProperty ("updatedAtMs"));

        const bool sameHostProcessTree = track.processId == processId
            || (track.processGroupId != 0 && track.processGroupId == processGroupId);
        if (track.id.isEmpty() || ! sameHostProcessTree
            || track.host != hostDescription || track.updatedAtMs <= 0
            || now - track.updatedAtMs > kHeartbeatFreshnessMs)
            continue;

        if (track.name.isEmpty()) track.name = "Unnamed Track";
        result.push_back (std::move (track));
    }

    std::sort (result.begin(), result.end(), [] (const Track& a, const Track& b)
    {
        const int byName = a.name.compareNatural (b.name);
        return byName == 0 ? a.id < b.id : byName < 0;
    });
    return result;
}
}
