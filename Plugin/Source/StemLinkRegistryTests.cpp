#include "StemLinkRegistry.h"
#include "OrbControlBridge.h"
#include <iostream>

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
    if (statusObject->getProperty ("exportMode").toString() != "realtime")
        return fail ("StemLink did not advertise realtime export");

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

    if (bridge.requestExport ({ index }, false).isNotEmpty())
        return fail ("StemLink incorrectly accepted an Entire Session realtime capture");

    const auto requestId = bridge.requestExport ({ index }, true);
    if (requestId.isEmpty())
        return fail ("StemLink export request was not created");
    const auto request = StemLinkRegistry::getPendingExportRequest (
        host, publisher.getId(), {}, 0);
    if (! request.has_value() || request->id != requestId
        || request->trackName != "Lead Vocal" || request->rangeMode != "selection")
        return fail ("StemLink instance did not receive its export request");

    const auto audioFile = StemLinkRegistry::getExportAudioFile (
        requestId, publisher.getId(), request->trackName);
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

    std::cout << "Orb StemLink discovery and export integration passed\n";
    return 0;
}
