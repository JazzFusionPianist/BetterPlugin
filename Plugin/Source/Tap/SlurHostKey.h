#pragma once
#include <juce_core/juce_core.h>
#if JUCE_MAC
 #include <libproc.h>
 #include <unistd.h>
#endif

// Identifies the DAW process so the main Slur instance only lists Slur Taps
// loaded in the same host. Sandboxed plug-in hosts (Bitwig's plug-in host,
// AUHostingService) report their parent DAW instead of themselves.
// Shared by Slur Tap and the main Slur plug-in; see packages/track-export/TAP-CACHE.md.
namespace slurtap
{
inline juce::String hostKey()
{
   #if JUCE_MAC
    pid_t pid = getpid();
    char path[PROC_PIDPATHINFO_MAXSIZE] = {};
    if (proc_pidpath (pid, path, sizeof (path)) > 0)
    {
        const juce::String name = juce::File (juce::String::fromUTF8 (path)).getFileName();
        if ((name.containsIgnoreCase ("plugin host") || name.containsIgnoreCase ("pluginhost")
             || name.containsIgnoreCase ("AUHostingService")) && getppid() > 1)
            pid = getppid();
    }
    return "pid:" + juce::String ((int) pid);
   #else
    return "pid:" + juce::String ((juce::int64) juce::Process::getCurrentProcessId());
   #endif
}

inline juce::File root()
{
    // Tests point both the writer and the reader at a temporary directory.
    const auto overridden = juce::SystemStats::getEnvironmentVariable ("SLUR_TAP_ROOT", {});
    if (overridden.isNotEmpty()) return juce::File (overridden);
    return juce::File::getSpecialLocation (juce::File::userApplicationDataDirectory)
        .getChildFile ("Application Support/Slur/Tap");
}
}
