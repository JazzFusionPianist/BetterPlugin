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
constexpr juce::int64 kExportLifetimeMs = 24 * 60 * 60 * 1000;

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

juce::File exportsDirectory()
{
    return registryDirectory().getChildFile ("Exports");
}

bool isSafeId (const juce::String& value)
{
    return value.isNotEmpty() && ! value.containsAnyOf ("/\\.")
        && value.containsOnly ("abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-_");
}

bool sameProcessTree (int processId, int processGroupId)
{
    return processId == currentProcessId()
        || (processGroupId != 0 && processGroupId == currentProcessGroupId());
}

bool replaceJsonFile (const juce::File& target, const juce::var& value)
{
    target.getParentDirectory().createDirectory();
    juce::TemporaryFile temporary (target);
    return temporary.getFile().replaceWithText (juce::JSON::toString (value, false))
        && temporary.overwriteTargetFileWithTemporary();
}

juce::var readJsonFile (const juce::File& file)
{
    return file.existsAsFile() ? juce::JSON::parse (file.loadFileAsString()) : juce::var();
}

void cleanupOldExports()
{
    const auto root = exportsDirectory();
    if (! root.isDirectory()) return;
    juce::Array<juce::File> directories;
    root.findChildFiles (directories, juce::File::findDirectories, false);
    const auto now = juce::Time::currentTimeMillis();
    for (const auto& directory : directories)
        if (now - directory.getLastModificationTime().toMilliseconds() > kExportLifetimeMs)
            directory.deleteRecursively();
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

    replaceJsonFile (registryFile, juce::var (object));
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

juce::String createExportRequest (const juce::String& hostDescription,
                                  const std::vector<int>& trackIndices,
                                  bool editSelection)
{
    cleanupOldExports();
    const auto activeTracks = getActiveTracks (hostDescription);
    juce::Array<juce::var> requestedTracks;
    for (const auto& track : activeTracks)
    {
        const int index = makeTrackIndex (track.id);
        if (std::find (trackIndices.begin(), trackIndices.end(), index) == trackIndices.end())
            continue;
        auto item = new juce::DynamicObject();
        item->setProperty ("id", track.id);
        item->setProperty ("index", index);
        item->setProperty ("name", track.name);
        requestedTracks.add (juce::var (item));
    }
    if (requestedTracks.isEmpty()) return {};

    const auto requestId = juce::Uuid().toString().removeCharacters ("-");
    auto object = new juce::DynamicObject();
    object->setProperty ("schema", 1);
    object->setProperty ("id", requestId);
    object->setProperty ("hostName", hostDescription);
    object->setProperty ("processId", currentProcessId());
    object->setProperty ("processGroupId", currentProcessGroupId());
    object->setProperty ("rangeMode", editSelection ? "selection" : "session");
    object->setProperty ("createdAtMs", juce::Time::currentTimeMillis());
    object->setProperty ("tracks", requestedTracks);

    const auto requestFile = exportsDirectory().getChildFile (requestId).getChildFile ("request.json");
    return replaceJsonFile (requestFile, juce::var (object)) ? requestId : juce::String();
}

std::optional<ExportRequest> getPendingExportRequest (const juce::String& hostDescription,
                                                       const juce::String& instanceId,
                                                       const juce::String& lastHandledRequestId,
                                                       juce::int64 minimumCreatedAtMs)
{
    const auto root = exportsDirectory();
    if (! root.isDirectory()) return std::nullopt;
    juce::Array<juce::File> directories;
    root.findChildFiles (directories, juce::File::findDirectories, false);
    std::sort (directories.begin(), directories.end(), [] (const juce::File& a, const juce::File& b)
    {
        return a.getLastModificationTime() > b.getLastModificationTime();
    });

    const auto now = juce::Time::currentTimeMillis();
    for (const auto& directory : directories)
    {
        const auto parsed = readJsonFile (directory.getChildFile ("request.json"));
        auto* object = parsed.getDynamicObject();
        if (object == nullptr) continue;
        const auto requestId = object->getProperty ("id").toString();
        const auto createdAtMs = static_cast<juce::int64> (object->getProperty ("createdAtMs"));
        const int processId = static_cast<int> (object->getProperty ("processId"));
        const int processGroupId = static_cast<int> (object->getProperty ("processGroupId"));
        if (! isSafeId (requestId)
            || object->getProperty ("hostName").toString() != hostDescription
            || ! sameProcessTree (processId, processGroupId)
            || createdAtMs < minimumCreatedAtMs || now - createdAtMs > kExportLifetimeMs)
            continue;
        if (requestId == lastHandledRequestId) return std::nullopt;

        auto* tracks = object->getProperty ("tracks").getArray();
        if (tracks == nullptr) continue;
        for (const auto& item : *tracks)
        {
            auto* track = item.getDynamicObject();
            if (track == nullptr || track->getProperty ("id").toString() != instanceId)
                continue;
            return ExportRequest { requestId, instanceId,
                track->getProperty ("name").toString(),
                object->getProperty ("rangeMode").toString(), createdAtMs };
        }
    }
    return std::nullopt;
}

juce::File getExportAudioFile (const juce::String& requestId,
                               const juce::String& instanceId,
                               const juce::String& trackName)
{
    if (! isSafeId (requestId) || ! isSafeId (instanceId)) return {};
    auto safeName = juce::File::createLegalFileName (trackName.trim());
    if (safeName.isEmpty()) safeName = "Unnamed Track";
    return exportsDirectory().getChildFile (requestId).getChildFile ("audio")
        .getChildFile (instanceId).getChildFile (safeName + ".wav");
}

bool writeExportStatus (const juce::String& requestId,
                        const juce::String& instanceId,
                        const juce::var& status)
{
    if (! isSafeId (requestId) || ! isSafeId (instanceId)) return false;
    return replaceJsonFile (exportsDirectory().getChildFile (requestId)
        .getChildFile ("status-" + instanceId + ".json"), status);
}

juce::String getExportStatusJson (const juce::String& requestId)
{
    if (! isSafeId (requestId)) return {};
    const auto directory = exportsDirectory().getChildFile (requestId);
    const auto request = readJsonFile (directory.getChildFile ("request.json"));
    auto* requestObject = request.getDynamicObject();
    if (requestObject == nullptr) return {};
    auto* requestedTracks = requestObject->getProperty ("tracks").getArray();
    if (requestedTracks == nullptr || requestedTracks->isEmpty()) return {};

    int armed = 0, recording = 0, complete = 0;
    juce::Array<juce::var> files;
    for (const auto& item : *requestedTracks)
    {
        auto* track = item.getDynamicObject();
        if (track == nullptr) continue;
        const auto instanceId = track->getProperty ("id").toString();
        const auto status = readJsonFile (directory.getChildFile ("status-" + instanceId + ".json"));
        auto* statusObject = status.getDynamicObject();
        if (statusObject == nullptr) continue;
        const auto state = statusObject->getProperty ("status").toString();
        if (state == "error")
        {
            auto error = new juce::DynamicObject();
            error->setProperty ("status", "error");
            error->setProperty ("message", statusObject->getProperty ("message"));
            return juce::JSON::toString (juce::var (error), false);
        }
        if (state == "armed") ++armed;
        else if (state == "recording" || state == "finishing") ++recording;
        else if (state == "complete")
        {
            const auto file = statusObject->getProperty ("file");
            auto* fileObject = file.getDynamicObject();
            if (fileObject != nullptr
                && juce::File (fileObject->getProperty ("path").toString()).existsAsFile())
            {
                files.add (file);
                ++complete;
            }
        }
    }

    const int expected = requestedTracks->size();
    auto result = new juce::DynamicObject();
    result->setProperty ("id", requestId);
    result->setProperty ("ready", armed == expected);
    result->setProperty ("rangeMode", requestObject->getProperty ("rangeMode"));
    if (complete == expected)
    {
        result->setProperty ("status", "complete");
        result->setProperty ("progress", 1.0);
        result->setProperty ("message", "StemLink export complete");
        result->setProperty ("files", files);
    }
    else if (recording > 0)
    {
        result->setProperty ("status", "rendering");
        result->setProperty ("progress", 0.5);
        result->setProperty ("message",
            requestObject->getProperty ("rangeMode").toString() == "session"
                ? "Capturing all selected tracks in one offline pass…"
                : "Recording the edit selection… Stop when the range finishes.");
    }
    else
    {
        result->setProperty ("status", "queued");
        result->setProperty ("progress", 0.0);
        const bool session = requestObject->getProperty ("rangeMode").toString() == "session";
        result->setProperty ("message", armed == expected
            ? (session ? juce::String ("Starting the DAW offline bounce…")
                       : juce::String ("Ready — press Play in the DAW, then Stop when the range finishes."))
            : "Arming Orb StemLink tracks…");
    }
    return juce::JSON::toString (juce::var (result), false);
}

bool finishExport (const juce::String& requestId)
{
    return isSafeId (requestId)
        && exportsDirectory().getChildFile (requestId).deleteRecursively();
}
}
