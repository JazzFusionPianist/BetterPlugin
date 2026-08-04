#include "OrbControlBridge.h"
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
}

juce::String OrbControlBridge::getFileAdapterId() const
{
    if (host.containsIgnoreCase ("Pro Tools")) return "protools";
    if (host.containsIgnoreCase ("REAPER")) return "reaper";
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
    juce::StringArray ids;
    for (const int index : trackIndices) ids.add (juce::String (index));
    send (0x04, juce::String (editSelection ? "selection" : "session") + "|" + ids.joinIntoString (","));
    return {};
}

juce::String OrbControlBridge::getStatusJson() const
{
    juce::var fileStatus;
    if (readFileAdapterStatus (fileStatus)) return juce::JSON::toString (fileStatus, false);
    std::lock_guard<std::mutex> lock (stateMutex);
    const bool connected = adapterConnected
        && juce::Time::currentTimeMillis() - lastMessageMs < 15000;

    auto object = new juce::DynamicObject();
    object->setProperty ("hostName", host);
    object->setProperty ("adapter", adapterName.isNotEmpty() ? adapterName : "Orb Control");
    object->setProperty ("connected", connected);
    object->setProperty ("trackListing", connected);
    object->setProperty ("exportMode",
        connected && host.containsIgnoreCase ("Cubase") && adapterName.contains ("Cubase")
            ? "native" : "none");
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
    std::lock_guard<std::mutex> lock (stateMutex);
    juce::Array<juce::var> result;
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

juce::String OrbControlBridge::getExportStatusJson (const juce::String& requestId) const
{
    if (requestId.isEmpty() || requestId.containsAnyOf ("/\\."))
        return "{\"status\":\"error\",\"message\":\"Invalid export request\"}";
    const auto file = getControlDirectory().getChildFile ("export-" + requestId + ".json");
    if (! file.existsAsFile())
        return "{\"status\":\"queued\",\"progress\":0}";
    const auto contents = file.loadFileAsString();
    return juce::JSON::parse (contents).isVoid()
        ? juce::String ("{\"status\":\"queued\",\"progress\":0}") : contents;
}
