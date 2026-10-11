#pragma once
#include <juce_audio_processors/juce_audio_processors.h>

// One host name for the page, the helper and Slur Tap registries.
// Same names as packages/core/lib/stemRoutes.ts canonicalHost().
namespace slurtap
{
inline juce::String canonicalHostName()
{
    if (juce::JUCEApplicationBase::isStandaloneApp()) return "Standalone";
    const juce::PluginHostType type;
    const auto app = juce::File::getSpecialLocation (juce::File::hostApplicationPath).getFullPathName();
    if (type.isProTools()) return "Pro Tools";
    if (type.isLogic()) return "Logic Pro";
    if (type.isReaper()) return "REAPER";
    if (type.isAbletonLive()) return "Ableton Live";
    if (type.isStudioOne() || app.containsIgnoreCase ("Studio Pro") || app.containsIgnoreCase ("Studio One")) return "Studio One";
    if (type.isNuendo()) return "Nuendo";
    if (type.isCubase()) return "Cubase";
    if (type.isBitwigStudio()) return "Bitwig Studio";
    if (type.isFruityLoops()) return "FL Studio";
    if (app.containsIgnoreCase ("/LUNA.app/")) return "LUNA";
    return type.getHostDescription();
}
}
