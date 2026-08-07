#include "OrbControlBridge.h"
#include "StemLinkRegistry.h"
#include <algorithm>

namespace
{
constexpr uint8_t kHeader[] { 0xF0, 0x7D, 0x4F, 0x52, 0x42 };
constexpr juce::int64 kAdapterFreshnessMs = 5000;

juce::String decodePayload (const uint8_t* data, size_t size)
{
    juce::MemoryBlock bytes;
    for (size_t i = 0; i < size; ++i)
        bytes.append (data + i, 1);
    return juce::URL::removeEscapeChars (juce::String::fromUTF8 (
        static_cast<const char*> (bytes.getData()), static_cast<int> (bytes.getSize())));
}

juce::String encodePayload (const juce::String& value)
{
    return juce::URL::addEscapeChars (value, false, false);
}

juce::var propertyValue (const juce::var& response, const juce::String& name)
{
    auto* responseObject = response.getDynamicObject();
    auto* dataObject = responseObject == nullptr
        ? nullptr : responseObject->getProperty ("data").getDynamicObject();
    auto* properties = dataObject == nullptr
        ? nullptr : dataObject->getProperty ("properties").getDynamicObject();
    auto* property = properties == nullptr
        ? nullptr : properties->getProperty (name).getDynamicObject();
    return property == nullptr ? juce::var() : property->getProperty ("value");
}
}

bool OrbControlBridge::isLunaHost() const
{
    return host.containsIgnoreCase ("LUNA");
}

juce::var OrbControlBridge::lunaRequest (const juce::String& method,
                                         const juce::String& path,
                                         const juce::var& body) const
{
    // LUNA's localhost service occasionally cancels the first NSURLSession
    // request while a plug-in window is being opened. Retry the short request
    // instead of silently falling back to the transport-capture workflow.
    for (int attempt = 0; attempt < 3; ++attempt)
    {
        auto url = juce::URL ("http://127.0.0.1:4718" + path);
        if (! body.isVoid()) url = url.withPOSTData (juce::JSON::toString (body, false));
        auto options = juce::URL::InputStreamOptions (juce::URL::ParameterHandling::inAddress)
            .withHttpRequestCmd (method)
            .withConnectionTimeoutMs (2000)
            .withExtraHeaders ("Content-Type: application/json\r\nConnection: close\r\n");
        if (auto stream = url.createInputStream (options))
        {
            const auto parsed = juce::JSON::parse (stream->readEntireStreamAsString());
            if (! parsed.isVoid()) return parsed;
        }
        if (attempt < 2) juce::Thread::sleep (25);
    }
    return {};
}

bool OrbControlBridge::startLunaExport (const juce::String& requestId)
{
    LunaExport job;
    {
        std::lock_guard<std::mutex> lock (stateMutex);
        const auto found = lunaExports.find (requestId);
        if (found == lunaExports.end()) return false;
        if (found->second.started) return found->second.error.isEmpty();
        job = found->second;
    }

    juce::String sessionUid;
    for (int attempt = 0; attempt < 20 && sessionUid.isEmpty(); ++attempt)
    {
        const auto sessions = lunaRequest ("GET", "/sessions");
        sessionUid = propertyValue (sessions, "focused_session").toString();
        if (sessionUid.isEmpty() && attempt < 19) juce::Thread::sleep (100);
    }
    if (sessionUid.isEmpty()) job.error = "LUNA has no focused session.";

    const auto sessionPath = "/sessions/" + sessionUid;
    const auto session = job.error.isEmpty() ? lunaRequest ("GET", sessionPath) : juce::var();
    if (job.error.isEmpty() && propertyValue (session, "session_id").isVoid())
        job.error = "Orb could not read the active LUNA session.";

    const auto sampleRateResponse = job.error.isEmpty()
        ? lunaRequest ("GET", "/sample_rate") : juce::var();
    if (auto* object = sampleRateResponse.getDynamicObject())
        if (auto* data = object->getProperty ("data").getDynamicObject())
            job.sampleRate = static_cast<double> (data->getProperty ("value"));
    if (job.sampleRate <= 0.0) job.sampleRate = 48000.0;

    auto readFirstMapValue = [this, &sessionPath] (const juce::String& map,
                                                   const juce::String& property,
                                                   double fallback)
    {
        const auto root = lunaRequest ("GET", sessionPath + "/" + map);
        auto* rootObject = root.getDynamicObject();
        auto* data = rootObject == nullptr
            ? nullptr : rootObject->getProperty ("data").getDynamicObject();
        auto* children = data == nullptr ? nullptr : data->getProperty ("children").getArray();
        if (children == nullptr || children->isEmpty()) return fallback;
        auto* child = children->getReference (0).getDynamicObject();
        const auto childPath = child == nullptr ? juce::String()
                                                : child->getProperty ("path").toString();
        if (childPath.isEmpty()) return fallback;
        const auto item = lunaRequest ("GET", sessionPath + "/" + map + "/" + childPath);
        const auto value = propertyValue (item, property);
        return value.isVoid() ? fallback : static_cast<double> (value);
    };
    if (job.error.isEmpty())
    {
        job.bpm = readFirstMapValue ("tempo_map", "tempo", 120.0);
        job.timeSigNumerator = static_cast<int> (
            readFirstMapValue ("time_signatures", "numerator", 4.0));
        job.timeSigDenominator = static_cast<int> (
            readFirstMapValue ("time_signatures", "denominator", 4.0));
    }

    std::vector<std::pair<juce::String, juce::String>> lunaTracks;
    if (job.error.isEmpty())
    {
        const auto trackRoot = lunaRequest ("GET", sessionPath + "/tracks");
        auto* rootObject = trackRoot.getDynamicObject();
        auto* data = rootObject == nullptr
            ? nullptr : rootObject->getProperty ("data").getDynamicObject();
        auto* children = data == nullptr ? nullptr : data->getProperty ("children").getArray();
        if (children != nullptr)
        {
            for (const auto& childValue : *children)
            {
                auto* child = childValue.getDynamicObject();
                const auto uid = child == nullptr ? juce::String()
                                                  : child->getProperty ("path").toString();
                if (uid.isEmpty()) continue;
                const auto track = lunaRequest ("GET", sessionPath + "/tracks/" + uid);
                const auto name = propertyValue (track, "name").toString();
                if (name.isNotEmpty()) lunaTracks.emplace_back (name, uid);
            }
        }
    }

    auto tracksObject = new juce::DynamicObject();
    auto pathsObject = new juce::DynamicObject();
    const auto activeTracks = StemLinkRegistry::getActiveTracks (host);
    if (job.error.isEmpty())
    {
        for (const auto& selected : activeTracks)
        {
            const auto index = StemLinkRegistry::makeTrackIndex (selected.id);
            if (std::find (job.trackIndices.begin(), job.trackIndices.end(), index)
                == job.trackIndices.end())
                continue;
            const auto lunaTrack = std::find_if (lunaTracks.begin(), lunaTracks.end(),
                [&selected] (const auto& candidate)
                {
                    return candidate.first.equalsIgnoreCase (selected.name);
                });
            if (lunaTrack == lunaTracks.end())
            {
                job.error = "LUNA track not found: " + selected.name;
                break;
            }
            LunaOutput output;
            output.instanceId = selected.id;
            output.trackName = selected.name;
            output.fileUid = juce::Uuid().toString().removeCharacters ("-");
            output.file = StemLinkRegistry::getExportAudioFile (
                requestId, selected.id, selected.name);
            output.file.getParentDirectory().createDirectory();
            output.file.deleteFile();
            tracksObject->setProperty (lunaTrack->second, output.fileUid);
            pathsObject->setProperty (output.fileUid, output.file.getFullPathName());
            job.outputs.push_back (std::move (output));
        }
        if (job.outputs.empty() && job.error.isEmpty())
            job.error = "No selected StemLink tracks matched the LUNA session.";
    }

    if (job.error.isEmpty())
    {
        job.renderUid = juce::Uuid().toString().removeCharacters ("-");
        job.sessionUid = sessionUid;
        auto request = new juce::DynamicObject();
        request->setProperty ("uid", job.renderUid);
        request->setProperty ("type", "bounce");
        request->setProperty ("name", "Orb Stem Export");
        request->setProperty ("real_time", false);
        request->setProperty ("add_to_session", false);
        request->setProperty ("record_point", "post_pan");
        request->setProperty ("session_uid", sessionUid);
        request->setProperty ("tracks", juce::var (tracksObject));
        request->setProperty ("buses", juce::var (new juce::DynamicObject()));
        request->setProperty ("outputs", juce::var (new juce::DynamicObject()));
        // LUNA 2.9 advertises this as output_path, but the renderer itself
        // consumes output_paths. Using the engine spelling keeps files out of
        // the project while preserving them at the requested Orb paths.
        request->setProperty ("output_paths", juce::var (pathsObject));

        const auto created = lunaRequest ("POST", "/renders/new", juce::var (request));
        auto* createdObject = created.getDynamicObject();
        auto* createdData = createdObject == nullptr
            ? nullptr : createdObject->getProperty ("data").getDynamicObject();
        if (createdData == nullptr
            || createdData->getProperty ("uid").toString() != job.renderUid)
            job.error = "LUNA rejected the offline stem render.";
        else
        {
            auto start = new juce::DynamicObject();
            start->setProperty ("uid", job.renderUid);
            const auto started = lunaRequest ("POST", "/renders/start", juce::var (start));
            if (started.getDynamicObject() == nullptr)
                job.error = "LUNA could not start the offline stem render.";
        }
    }

    job.started = true;
    {
        std::lock_guard<std::mutex> lock (stateMutex);
        lunaExports[requestId] = job;
    }
    if (job.error.isNotEmpty())
    {
        for (const auto& selected : activeTracks)
        {
            const auto index = StemLinkRegistry::makeTrackIndex (selected.id);
            if (std::find (job.trackIndices.begin(), job.trackIndices.end(), index)
                == job.trackIndices.end())
                continue;
            auto error = new juce::DynamicObject();
            error->setProperty ("status", "error");
            error->setProperty ("message", job.error);
            StemLinkRegistry::writeExportStatus (
                requestId, selected.id, juce::var (error));
        }
    }
    return job.error.isEmpty();
}

juce::String OrbControlBridge::pollLunaExport (const juce::String& requestId)
{
    LunaExport job;
    {
        std::lock_guard<std::mutex> lock (stateMutex);
        const auto found = lunaExports.find (requestId);
        if (found == lunaExports.end()) return {};
        job = found->second;
    }
    if (! job.started || job.error.isNotEmpty()) return {};

    const auto response = lunaRequest ("GET", "/renders/" + job.renderUid);
    const auto state = propertyValue (response, "state").toString().toLowerCase();
    const auto progressValue = propertyValue (response, "percent_complete");
    const double progress = progressValue.isVoid() ? 0.0
        : juce::jlimit (0.0, 1.0, static_cast<double> (progressValue) / 100.0);
    const bool filesReady = std::all_of (job.outputs.begin(), job.outputs.end(),
        [] (const LunaOutput& output) { return output.file.existsAsFile()
            && output.file.getSize() > 44; });

    if ((state == "completed" || (state.isEmpty() && filesReady)) && filesReady)
    {
        if (! job.published)
        {
            for (const auto& output : job.outputs)
            {
                auto file = new juce::DynamicObject();
                file->setProperty ("path", output.file.getFullPathName());
                file->setProperty ("name", output.file.getFileName());
                file->setProperty ("size", output.file.getSize());
                file->setProperty ("mimeType", "audio/wav");
                file->setProperty ("sampleRate", job.sampleRate);
                file->setProperty ("bitDepth", 32);
                file->setProperty ("sourceSamples", 0);
                file->setProperty ("sourcePpq", 0.0);
                file->setProperty ("bpm", job.bpm);
                file->setProperty ("timeSigNumerator", job.timeSigNumerator);
                file->setProperty ("timeSigDenominator", job.timeSigDenominator);
                file->setProperty ("captureMode", "luna-offline-track");
                auto complete = new juce::DynamicObject();
                complete->setProperty ("status", "complete");
                complete->setProperty ("message", "LUNA offline stem export complete");
                complete->setProperty ("file", juce::var (file));
                StemLinkRegistry::writeExportStatus (
                    requestId, output.instanceId, juce::var (complete));
            }
            auto removeRender = new juce::DynamicObject();
            removeRender->setProperty ("uid", job.renderUid);
            lunaRequest ("POST", "/renders/delete", juce::var (removeRender));
            std::lock_guard<std::mutex> lock (stateMutex);
            lunaExports[requestId].published = true;
            lunaExports[requestId].renderUid.clear();
        }
        return {};
    }

    if (state == "error" || state == "aborted" || (state == "completed" && ! filesReady))
    {
        auto message = propertyValue (response, "error").toString();
        if (message.isEmpty()) message = "LUNA did not create the requested stem files.";
        for (const auto& output : job.outputs)
        {
            auto error = new juce::DynamicObject();
            error->setProperty ("status", "error");
            error->setProperty ("message", message);
            StemLinkRegistry::writeExportStatus (
                requestId, output.instanceId, juce::var (error));
        }
        auto removeRender = new juce::DynamicObject();
        removeRender->setProperty ("uid", job.renderUid);
        lunaRequest ("POST", "/renders/delete", juce::var (removeRender));
        return {};
    }

    auto status = new juce::DynamicObject();
    status->setProperty ("id", requestId);
    status->setProperty ("status", "rendering");
    status->setProperty ("ready", true);
    status->setProperty ("progress", progress);
    status->setProperty ("message", "LUNA is exporting the selected tracks offline...");
    return juce::JSON::toString (juce::var (status), false);
}

juce::String OrbControlBridge::getFileAdapterId() const
{
    if (host.containsIgnoreCase ("Pro Tools")) return "protools";
    if (host.containsIgnoreCase ("REAPER")) return "reaper";
    if (host.containsIgnoreCase ("Standalone"))
    {
        const auto directory = getControlDirectory();
        const auto proTools = directory.getChildFile ("status-protools.json");
        const auto reaper = directory.getChildFile ("status-reaper.json");
        const auto now = juce::Time::currentTimeMillis();
        const auto proToolsAge = now - proTools.getLastModificationTime().toMilliseconds();
        const auto reaperAge = now - reaper.getLastModificationTime().toMilliseconds();
        if (proTools.existsAsFile() && proToolsAge >= 0 && proToolsAge < kAdapterFreshnessMs)
            return "protools";
        if (reaper.existsAsFile() && reaperAge >= 0 && reaperAge < kAdapterFreshnessMs)
            return "reaper";
    }
    return {};
}

juce::File OrbControlBridge::getControlDirectory() const
{
    return juce::File::getSpecialLocation (juce::File::userApplicationDataDirectory)
        .getChildFile ("Orb").getChildFile ("HostControl");
}

juce::File OrbControlBridge::getAdapterStatusFile() const
{
    const auto id = getFileAdapterId();
    return id.isEmpty() ? juce::File() : getControlDirectory().getChildFile ("status-" + id + ".json");
}

bool OrbControlBridge::readFileAdapterStatus (juce::var& status) const
{
    const auto file = getAdapterStatusFile();
    if (! file.existsAsFile()) return false;
    const auto parsed = juce::JSON::parse (file.loadFileAsString());
    auto* object = parsed.getDynamicObject();
    if (object == nullptr) return false;
    const auto updatedAt = static_cast<juce::int64> (object->getProperty ("updatedAtMs"));
    if (updatedAt <= 0 || juce::Time::currentTimeMillis() - updatedAt > kAdapterFreshnessMs)
        return false;
    status = parsed;
    return true;
}

bool OrbControlBridge::writeFileRequest (const juce::var& request) const
{
    const auto id = getFileAdapterId();
    if (id.isEmpty()) return false;
    const auto directory = getControlDirectory();
    if (! directory.createDirectory()) return false;
    const auto requestFile = directory.getChildFile ("request-" + id + ".json");
    const auto temporary = directory.getNonexistentChildFile ("request-" + id, ".tmp", false);
    if (! temporary.replaceWithText (juce::JSON::toString (request, false))) return false;
    return temporary.replaceFileIn (requestFile);
}

OrbControlBridge::OrbControlBridge (juce::String hostName)
    : host (std::move (hostName))
{
    if (MIDIClientCreate (CFSTR ("Orb Control"), nullptr, nullptr, &client) != noErr)
        return;

    MIDISourceCreate (client, CFSTR ("Orb Control Out"), &source);
    MIDIDestinationCreate (client, CFSTR ("Orb Control In"), readProc, this, &destination);
}

OrbControlBridge::~OrbControlBridge()
{
    if (source != 0) MIDIEndpointDispose (source);
    if (destination != 0) MIDIEndpointDispose (destination);
    if (client != 0) MIDIClientDispose (client);
}

void OrbControlBridge::readProc (const MIDIPacketList* packets, void* refCon, void*)
{
    auto* self = static_cast<OrbControlBridge*> (refCon);
    if (self == nullptr || packets == nullptr) return;

    auto* packet = &packets->packet[0];
    for (UInt32 i = 0; i < packets->numPackets; ++i)
    {
        self->receive (packet->data, packet->length);
        packet = MIDIPacketNext (packet);
    }
}

void OrbControlBridge::receive (const uint8_t* data, size_t size)
{
    if (size < 7 || data[0] != kHeader[0] || data[1] != kHeader[1]
        || data[2] != kHeader[2] || data[3] != kHeader[3] || data[4] != kHeader[4])
    {
        receiveMackieControl (data, size);
        return;
    }

    const auto command = data[5];
    const auto payloadSize = data[size - 1] == 0xF7 ? size - 7 : size - 6;
    const auto payload = decodePayload (data + 6, payloadSize);
    const auto parts = juce::StringArray::fromTokens (payload, "|", "");

    std::lock_guard<std::mutex> lock (stateMutex);
    adapterConnected = true;
    lastMessageMs = juce::Time::currentTimeMillis();

    if (command == 0x10)
    {
        adapterName = parts.size() > 0 ? parts[0] : "DAW Remote";
        tracks.clear();
    }
    else if (command == 0x11 && parts.size() >= 2)
    {
        Track track;
        track.index = parts[0].getIntValue();
        track.name = parts[1];
        track.selected = parts.size() > 2 && parts[2].getIntValue() != 0;
        track.colour = parts.size() > 3 ? parts[3] : juce::String();

        auto existing = std::find_if (tracks.begin(), tracks.end(), [&] (const Track& t) {
            return t.index == track.index;
        });
        if (existing == tracks.end()) tracks.push_back (std::move (track));
        else *existing = std::move (track);

        std::sort (tracks.begin(), tracks.end(), [] (const Track& a, const Track& b) {
            return a.index < b.index;
        });
    }
    else if (command == 0x12 && parts.size() >= 2)
    {
        const int index = parts[0].getIntValue();
        for (auto& track : tracks)
            if (track.index == index) track.selected = parts[1].getIntValue() != 0;
    }
}

void OrbControlBridge::receiveMackieControl (const uint8_t* data, size_t size)
{
    // Logic, Ableton Live, Studio One, Reaper, FL Studio and many other DAWs
    // expose their mixer through the Mackie Control protocol. Track labels are
    // sent as 7-character scribble-strip blocks.
    if (size >= 9 && data[0] == 0xF0 && data[1] == 0x00 && data[2] == 0x00
        && data[3] == 0x66 && data[5] == 0x12)
    {
        const int offset = data[6];
        std::lock_guard<std::mutex> lock (stateMutex);
        adapterConnected = true;
        adapterName = "Mackie Control";
        lastMessageMs = juce::Time::currentTimeMillis();
        if (mcuStripNames.size() < 8)
            while (mcuStripNames.size() < 8) mcuStripNames.add ({});

        for (size_t i = 7; i + 1 < size && data[i] != 0xF7; ++i)
        {
            const int absolute = offset + static_cast<int> (i - 7);
            const int strip = absolute / 7;
            const int character = absolute % 7;
            if (strip < 0 || strip >= 8) continue;
            auto name = mcuStripNames[strip].paddedRight (' ', 7);
            name = name.replaceSection (character, 1, juce::String::charToString ((juce::juce_wchar) data[i]));
            mcuStripNames.set (strip, name);
        }

        tracks.clear();
        for (int i = 0; i < mcuStripNames.size(); ++i)
        {
            const auto name = mcuStripNames[i].trim();
            if (name.isNotEmpty())
                tracks.push_back ({ i, name, false, {} });
        }
        return;
    }

    // MCU selection LEDs use notes 0x18–0x1f. Packets may contain multiple
    // three-byte MIDI messages, so walk the entire CoreMIDI packet.
    std::lock_guard<std::mutex> lock (stateMutex);
    for (size_t i = 0; i + 2 < size; i += 3)
    {
        if ((data[i] & 0xF0) != 0x90 || data[i + 1] < 0x18 || data[i + 1] > 0x1F)
            continue;
        adapterConnected = true;
        adapterName = "Mackie Control";
        lastMessageMs = juce::Time::currentTimeMillis();
        const int index = data[i + 1] - 0x18;
        for (auto& track : tracks)
            if (track.index == index) track.selected = data[i + 2] > 0;
    }
}

void OrbControlBridge::send (uint8_t command, const juce::String& payload)
{
    if (source == 0) return;

    std::vector<uint8_t> message (std::begin (kHeader), std::end (kHeader));
    message.push_back (command);
    const auto ascii = encodePayload (payload).toRawUTF8();
    for (const char* p = ascii; *p != 0; ++p)
        message.push_back (static_cast<uint8_t> (*p) & 0x7f);
    message.push_back (0xF7);

    sendRaw (message);
}

void OrbControlBridge::sendRaw (const std::vector<uint8_t>& message)
{
    if (source == 0 || message.empty()) return;
    std::vector<uint8_t> storage (sizeof (MIDIPacketList) + message.size() + 32);
    auto* list = reinterpret_cast<MIDIPacketList*> (storage.data());
    auto* packet = MIDIPacketListInit (list);
    if (MIDIPacketListAdd (list, storage.size(), packet, 0,
                           static_cast<UInt16> (message.size()), message.data()) != nullptr)
        MIDIReceived (source, list);
}

bool OrbControlBridge::requestTracks()
{
    juce::var fileStatus;
    if (readFileAdapterStatus (fileStatus)) return true;
    if (! StemLinkRegistry::getActiveTracks (host).empty()) return true;
    send (0x01);
    // Also announce/query as an MCU device. DAWs configured with their
    // built-in Mackie Control surface respond with scribble-strip labels.
    sendRaw ({ 0xF0, 0x00, 0x00, 0x66, 0x14, 0x00, 0xF7 });
    return source != 0;
}

bool OrbControlBridge::setTrackSelected (int index, bool selected)
{
    juce::var fileStatus;
    if (readFileAdapterStatus (fileStatus))
    {
        auto object = new juce::DynamicObject();
        object->setProperty ("id", juce::Uuid().toString());
        object->setProperty ("action", "select");
        object->setProperty ("trackIndex", index);
        object->setProperty ("selected", selected);
        object->setProperty ("createdAtMs", juce::Time::currentTimeMillis());
        return writeFileRequest (juce::var (object));
    }

    const auto stemLinkTracks = StemLinkRegistry::getActiveTracks (host);
    const auto stemLinkMatch = std::find_if (stemLinkTracks.begin(), stemLinkTracks.end(),
        [index] (const StemLinkRegistry::Track& track)
        {
            return StemLinkRegistry::makeTrackIndex (track.id) == index;
        });
    if (stemLinkMatch != stemLinkTracks.end())
    {
        std::lock_guard<std::mutex> lock (stateMutex);
        if (selected) stemLinkSelections.insert (index);
        else stemLinkSelections.erase (index);
        return true;
    }
    bool isMcu = false;
    {
        std::lock_guard<std::mutex> lock (stateMutex);
        isMcu = adapterName == "Mackie Control";
    }
    if (isMcu && index >= 0 && index < 8)
        sendRaw ({ 0x90, static_cast<uint8_t> (0x18 + index),
                  static_cast<uint8_t> (selected ? 0x7F : 0x00) });
    else
        send (0x03, juce::String (index) + "|" + (selected ? "1" : "0"));
    return source != 0;
}

juce::String OrbControlBridge::requestExport (const std::vector<int>& trackIndices, bool editSelection)
{
    juce::var fileStatus;
    if (readFileAdapterStatus (fileStatus))
    {
        const auto requestId = juce::Uuid().toString().removeCharacters ("-");
        juce::Array<juce::var> indices;
        for (const int index : trackIndices) indices.add (index);
        auto object = new juce::DynamicObject();
        object->setProperty ("id", requestId);
        object->setProperty ("action", "export");
        object->setProperty ("trackIndices", indices);
        object->setProperty ("rangeMode", editSelection ? "selection" : "session");
        object->setProperty ("createdAtMs", juce::Time::currentTimeMillis());
        return writeFileRequest (juce::var (object)) ? requestId : juce::String();
    }

    // Entire-session exports in LUNA must always use its native offline
    // renderer. A transient localhost health-check failure used to classify
    // the request as a StemLink transport capture and leave the UI waiting
    // forever for playback that Orb never intended to request.
    const bool lunaDirect = ! editSelection && isLunaHost();

    // LUNA can render selected tracks straight to Orb paths. Other hosts arm
    // the selected StemLinks first, then ask the DAW control adapter for one
    // ordinary master export.
    if (const auto requestId = StemLinkRegistry::createExportRequest (
            host, trackIndices, editSelection, lunaDirect ? "luna" : "stemlink");
        requestId.isNotEmpty())
    {
        if (lunaDirect)
        {
            LunaExport exportState;
            exportState.trackIndices = trackIndices;
            std::lock_guard<std::mutex> lock (stateMutex);
            lunaExports[requestId] = std::move (exportState);
            return requestId;
        }
        juce::StringArray ids;
        for (const int index : trackIndices) ids.add (juce::String (index));
        const auto payload = juce::String (editSelection ? "selection" : "onepass")
            + "|" + ids.joinIntoString (",");
        // Do not trigger the host yet: StemLink timers still need to observe
        // and arm the request. getExportStatusJson sends this only after every
        // selected instance has published ready=true.
        {
            std::lock_guard<std::mutex> lock (stateMutex);
            if (adapterConnected && adapterName != "Mackie Control"
                && juce::Time::currentTimeMillis() - lastMessageMs < 15000)
                pendingStemLinkTriggers[requestId] = payload;
        }
        return requestId;
    }

    juce::StringArray ids;
    for (const int index : trackIndices) ids.add (juce::String (index));
    send (0x04, juce::String (editSelection ? "selection" : "session") + "|" + ids.joinIntoString (","));
    return {};
}

juce::String OrbControlBridge::getStatusJson() const
{
    juce::var fileStatus;
    if (readFileAdapterStatus (fileStatus)) return juce::JSON::toString (fileStatus, false);

    bool controlConnected = false;
    juce::String currentAdapter;
    {
        std::lock_guard<std::mutex> lock (stateMutex);
        controlConnected = adapterConnected
            && juce::Time::currentTimeMillis() - lastMessageMs < 15000;
        currentAdapter = adapterName;
    }
    const auto stemLinkTracks = StemLinkRegistry::getActiveTracks (host);
    const bool stemLinkConnected = ! stemLinkTracks.empty();
    const bool connected = controlConnected || stemLinkConnected;
    const bool automaticOnePassTrigger = isLunaHost()
        || (controlConnected && currentAdapter != "Mackie Control");
    const auto displayedAdapter = stemLinkConnected ? juce::String ("Orb StemLink")
                             : (currentAdapter.isNotEmpty() ? currentAdapter
                                                            : juce::String ("Orb Control"));

    auto object = new juce::DynamicObject();
    object->setProperty ("hostName", host);
    object->setProperty ("adapter", displayedAdapter);
    object->setProperty ("connected", connected);
    object->setProperty ("trackListing", connected);
    object->setProperty ("exportMode", stemLinkConnected ? "onepass" : "none");
    object->setProperty ("automaticTrigger", automaticOnePassTrigger);
    object->setProperty ("requiresBounceConfirmation", stemLinkConnected && ! automaticOnePassTrigger);
    if (stemLinkConnected)
        object->setProperty ("message", juce::String (stemLinkTracks.size())
            + (stemLinkTracks.size() == 1 ? " linked track" : " linked tracks"));
    object->setProperty ("inputPort", "Orb Control Out");
    object->setProperty ("outputPort", "Orb Control In");
    return juce::JSON::toString (juce::var (object), false);
}

juce::String OrbControlBridge::getTracksJson() const
{
    juce::var fileStatus;
    if (readFileAdapterStatus (fileStatus))
    {
        if (auto* object = fileStatus.getDynamicObject())
            return juce::JSON::toString (object->getProperty ("tracks"), false);
    }
    const auto stemLinkTracks = StemLinkRegistry::getActiveTracks (host);
    juce::Array<juce::var> result;
    {
        std::lock_guard<std::mutex> lock (stateMutex);
        const bool controlConnected = adapterConnected
            && juce::Time::currentTimeMillis() - lastMessageMs < 15000;
        if (stemLinkTracks.empty() && controlConnected && ! tracks.empty())
        {
            for (const auto& track : tracks)
            {
                auto object = new juce::DynamicObject();
                object->setProperty ("id", juce::String (track.index));
                object->setProperty ("index", track.index);
                object->setProperty ("name", track.name);
                object->setProperty ("selected", track.selected);
                object->setProperty ("color", track.colour);
                result.add (juce::var (object));
            }
            return juce::JSON::toString (result, false);
        }
    }

    std::lock_guard<std::mutex> lock (stateMutex);
    for (const auto& track : stemLinkTracks)
    {
        const int index = StemLinkRegistry::makeTrackIndex (track.id);
        auto object = new juce::DynamicObject();
        object->setProperty ("id", "stemlink:" + track.id);
        object->setProperty ("index", index);
        object->setProperty ("name", track.name);
        object->setProperty ("selected", stemLinkSelections.count (index) != 0);
        object->setProperty ("color", track.colour);
        object->setProperty ("source", "stemlink");
        result.add (juce::var (object));
    }
    return juce::JSON::toString (result, false);
}

juce::String OrbControlBridge::getExportStatusJson (const juce::String& requestId)
{
    if (requestId.isEmpty() || requestId.containsAnyOf ("/\\."))
        return "{\"status\":\"error\",\"message\":\"Invalid export request\"}";
    const auto file = getControlDirectory().getChildFile ("export-" + requestId + ".json");
    if (file.existsAsFile())
    {
        const auto contents = file.loadFileAsString();
        if (! juce::JSON::parse (contents).isVoid()) return contents;
    }
    if (const auto stemLinkStatus = StemLinkRegistry::getExportStatusJson (requestId);
        stemLinkStatus.isNotEmpty())
    {
        const auto parsed = juce::JSON::parse (stemLinkStatus);
        if (auto* object = parsed.getDynamicObject())
        {
            if (static_cast<bool> (object->getProperty ("ready")))
            {
                bool hasLunaExport = false;
                bool startLunaInBackground = false;
                bool lunaStarted = false;
                {
                    std::lock_guard<std::mutex> lock (stateMutex);
                    const auto found = lunaExports.find (requestId);
                    hasLunaExport = found != lunaExports.end();
                    lunaStarted = hasLunaExport && found->second.started;
                    if (hasLunaExport && ! found->second.starting && ! lunaStarted)
                    {
                        found->second.starting = true;
                        startLunaInBackground = true;
                    }
                }
                if (hasLunaExport)
                {
                    // Native-function callbacks run on LUNA's UI thread. Its
                    // localhost API also needs that thread, so synchronous
                    // requests here deadlock until the web bridge times out.
                    if (startLunaInBackground)
                        lunaWorkers.addJob ([this, requestId]
                        {
                            startLunaExport (requestId);
                        });
                    if (const auto lunaStatus = pollLunaExport (requestId);
                        lunaStatus.isNotEmpty())
                        return lunaStatus;
                    if (! lunaStarted)
                    {
                        auto starting = new juce::DynamicObject();
                        starting->setProperty ("id", requestId);
                        starting->setProperty ("status", "rendering");
                        starting->setProperty ("ready", true);
                        starting->setProperty ("progress", 0.0);
                        starting->setProperty ("message", "Starting LUNA offline export...");
                        return juce::JSON::toString (juce::var (starting), false);
                    }
                    return StemLinkRegistry::getExportStatusJson (requestId);
                }

                juce::String payload;
                {
                    std::lock_guard<std::mutex> lock (stateMutex);
                    const auto found = pendingStemLinkTriggers.find (requestId);
                    if (found != pendingStemLinkTriggers.end())
                    {
                        payload = found->second;
                        pendingStemLinkTriggers.erase (found);
                    }
                }
                if (payload.isNotEmpty()) send (0x04, payload);
            }
        }
        return stemLinkStatus;
    }
    return "{\"status\":\"queued\",\"progress\":0}";
}

bool OrbControlBridge::finishExport (const juce::String& requestId)
{
    juce::String lunaRenderUid;
    {
        std::lock_guard<std::mutex> lock (stateMutex);
        pendingStemLinkTriggers.erase (requestId);
        const auto luna = lunaExports.find (requestId);
        if (luna != lunaExports.end())
        {
            lunaRenderUid = luna->second.renderUid;
            lunaExports.erase (luna);
        }
    }
    if (lunaRenderUid.isNotEmpty())
    {
        auto render = new juce::DynamicObject();
        render->setProperty ("uid", lunaRenderUid);
        const juce::var renderRequest (render);
        lunaRequest ("POST", "/renders/abort", renderRequest);
        lunaRequest ("POST", "/renders/delete", renderRequest);
    }
    if (StemLinkRegistry::getExportStatusJson (requestId).isNotEmpty())
        return StemLinkRegistry::finishExport (requestId);
    const auto file = getControlDirectory().getChildFile ("export-" + requestId + ".json");
    return ! file.existsAsFile() || file.deleteFile();
}
