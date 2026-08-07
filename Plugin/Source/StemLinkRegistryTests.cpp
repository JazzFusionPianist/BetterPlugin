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

    std::cout << "Orb StemLink registry integration passed\n";
    return 0;
}
