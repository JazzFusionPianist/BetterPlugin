#include "StemLinkRegistry.h"
#include "OrbControlBridge.h"
#include <iostream>
#if ! JUCE_WINDOWS
 #include <unistd.h>
#endif

namespace
{
int fail (const char* message)
{
    std::cerr << message << '\n';
    return 1;
}
}

int main()
{
    const auto host = juce::PluginHostType().getHostDescription();
    StemLinkRegistry::Publisher publisher;
    publisher.update ("Lead Vocal", "#6E8BFF");

    OrbControlBridge bridge (host);
    const auto status = juce::JSON::parse (bridge.getStatusJson());
    auto* statusObject = status.getDynamicObject();
    if (statusObject == nullptr || ! static_cast<bool> (statusObject->getProperty ("connected")))
        return fail ("Master bridge did not connect to StemLink registry");
    if (statusObject->getProperty ("adapter").toString() != "Orb StemLink")
        return fail ("Master bridge reported the wrong adapter");
    if (statusObject->getProperty ("exportMode").toString() != "onepass")
        return fail ("StemLink did not advertise one-pass offline export");

    const auto tracks = juce::JSON::parse (bridge.getTracksJson());
    auto* array = tracks.getArray();
    if (array == nullptr || array->size() != 1)
        return fail ("Master bridge did not return exactly one StemLink track");
    auto* track = array->getReference (0).getDynamicObject();
    if (track == nullptr || track->getProperty ("name").toString() != "Lead Vocal")
        return fail ("StemLink track name was not preserved");
    if (track->getProperty ("color").toString() != "#6E8BFF")
        return fail ("StemLink track colour was not preserved");

    const int index = static_cast<int> (track->getProperty ("index"));
    if (! bridge.setTrackSelected (index, true))
        return fail ("StemLink track selection was rejected");

    const auto selectedTracks = juce::JSON::parse (bridge.getTracksJson());
    auto* selectedArray = selectedTracks.getArray();
    auto* selectedTrack = selectedArray == nullptr || selectedArray->isEmpty()
        ? nullptr : selectedArray->getReference (0).getDynamicObject();
    if (selectedTrack == nullptr
        || ! static_cast<bool> (selectedTrack->getProperty ("selected")))
        return fail ("StemLink track selection was not retained");

    const auto requestId = bridge.requestExport ({ index }, false);
    if (requestId.isEmpty())
        return fail ("StemLink export request was not created");
    const auto request = StemLinkRegistry::getPendingExportRequest (
        host, publisher.getId(), {}, 0);
    if (! request.has_value() || request->id != requestId
        || request->trackName != "Lead Vocal" || request->rangeMode != "session")
        return fail ("StemLink instance did not receive its export request");

    const auto audioFile = StemLinkRegistry::getExportAudioFile (
        requestId, publisher.getId(), request->trackName);
    auto armedObject = new juce::DynamicObject();
    armedObject->setProperty ("status", "armed");
    if (! StemLinkRegistry::writeExportStatus (
            requestId, publisher.getId(), juce::var (armedObject)))
        return fail ("Could not arm the one-pass export");
    const auto readyStatus = juce::JSON::parse (bridge.getExportStatusJson (requestId));
    auto* readyObject = readyStatus.getDynamicObject();
    if (readyObject == nullptr
        || ! static_cast<bool> (readyObject->getProperty ("ready"))
        || readyObject->getProperty ("rangeMode").toString() != "session")
        return fail ("Master bridge did not wait for every StemLink to arm");

    audioFile.getParentDirectory().createDirectory();
    if (! audioFile.replaceWithText ("test wav payload"))
        return fail ("Could not create export test file");
    auto fileObject = new juce::DynamicObject();
    fileObject->setProperty ("path", audioFile.getFullPathName());
    fileObject->setProperty ("name", audioFile.getFileName());
    fileObject->setProperty ("size", audioFile.getSize());
    fileObject->setProperty ("mimeType", "audio/wav");
    fileObject->setProperty ("sampleRate", 48000);
    fileObject->setProperty ("bitDepth", 24);
    auto completeObject = new juce::DynamicObject();
    completeObject->setProperty ("status", "complete");
    completeObject->setProperty ("file", juce::var (fileObject));
    if (! StemLinkRegistry::writeExportStatus (
            requestId, publisher.getId(), juce::var (completeObject)))
        return fail ("Could not publish StemLink export completion");

    const auto exportStatus = juce::JSON::parse (bridge.getExportStatusJson (requestId));
    auto* exportObject = exportStatus.getDynamicObject();
    auto* exportedFiles = exportObject == nullptr
        ? nullptr : exportObject->getProperty ("files").getArray();
    if (exportObject == nullptr || exportObject->getProperty ("status").toString() != "complete"
        || exportedFiles == nullptr || exportedFiles->size() != 1)
        return fail ("Master bridge did not aggregate the completed StemLink WAV");
    if (! bridge.finishExport (requestId) || audioFile.existsAsFile())
        return fail ("StemLink export files were not cleaned up after upload");

    const auto nativeRequestId = StemLinkRegistry::createExportRequest (
        host, { index }, false, "luna");
    if (nativeRequestId.isEmpty())
        return fail ("Host-native export request was not created");
    if (StemLinkRegistry::getPendingExportRequest (
            host, publisher.getId(), {}, 0).has_value())
        return fail ("StemLink incorrectly armed during host-native export");
    const auto nativeStatus = juce::JSON::parse (
        StemLinkRegistry::getExportStatusJson (nativeRequestId));
    auto* nativeObject = nativeStatus.getDynamicObject();
    if (nativeObject == nullptr || ! static_cast<bool> (nativeObject->getProperty ("ready")))
        return fail ("Host-native export did not seed the armed barrier");
    if (! StemLinkRegistry::finishExport (nativeRequestId))
        return fail ("Host-native export request was not cleaned up");

#if ! JUCE_WINDOWS
    if (juce::SystemStats::getEnvironmentVariable ("ORB_TEST_LUNA", {}) == "1")
    {
        const juce::String lunaInstanceId { "11111111111141118111111111111111" };
        const auto registryDirectory = juce::File::getSpecialLocation (
            juce::File::userApplicationDataDirectory).getChildFile ("Orb")
            .getChildFile ("StemLink");
        registryDirectory.createDirectory();
        const auto registryFile = registryDirectory.getChildFile (
            "luna-smoke-" + juce::String (static_cast<int> (::getpid())) + ".json");
        auto registry = new juce::DynamicObject();
        registry->setProperty ("schema", 1);
        registry->setProperty ("id", lunaInstanceId);
        registry->setProperty ("name", "INSTRUMENT");
        registry->setProperty ("color", "#6E8BFF");
        registry->setProperty ("hostName", "LUNA");
        registry->setProperty ("processId", static_cast<int> (::getpid()));
        registry->setProperty ("processGroupId", static_cast<int> (::getpgrp()));
        registry->setProperty ("updatedAtMs", juce::Time::currentTimeMillis());
        if (! registryFile.replaceWithText (
                juce::JSON::toString (juce::var (registry), false)))
            return fail ("Could not seed the LUNA smoke-test registry");

        OrbControlBridge lunaBridge ("LUNA");
        const int lunaIndex = StemLinkRegistry::makeTrackIndex (lunaInstanceId);
        const auto lunaRequestId = lunaBridge.requestExport ({ lunaIndex }, false);
        if (lunaRequestId.isEmpty())
            return fail ("LUNA native export request was not created");

        bool lunaCompleted = false;
        for (int attempt = 0; attempt < 240; ++attempt)
        {
            const auto lunaStatus = juce::JSON::parse (
                lunaBridge.getExportStatusJson (lunaRequestId));
            auto* lunaObject = lunaStatus.getDynamicObject();
            const auto state = lunaObject == nullptr ? juce::String()
                                                     : lunaObject->getProperty ("status").toString();
            if (state == "error")
            {
                std::cerr << lunaObject->getProperty ("message").toString() << '\n';
                return fail ("LUNA native export failed");
            }
            if (state == "complete")
            {
                auto* files = lunaObject->getProperty ("files").getArray();
                if (files == nullptr || files->size() != 1)
                    return fail ("LUNA native export did not publish its WAV");
                lunaCompleted = true;
                break;
            }
            juce::Thread::sleep (250);
        }
        registryFile.deleteFile();
        if (! lunaCompleted)
            return fail ("LUNA native export timed out");
        if (! lunaBridge.finishExport (lunaRequestId))
            return fail ("LUNA native export was not cleaned up");
    }
#endif

    std::cout << "Orb StemLink discovery and export integration passed\n";
    return 0;
}
