// Writes a deterministic Slur Tap capture into $SLUR_TAP_ROOT for the JS reader test.
//   cmake --build build --target TapCacheTest
//   SLUR_TAP_ROOT=/tmp/x ./build/TapCacheTest_artefacts/Debug/TapCacheTest
// Stereo 48 kHz. Left = frame index × 1e-6, right = −left. Pushes:
//   [1000, 1000+200000)   in uneven blocks crossing page boundaries
//   [-300, 700)           pre-roll: only [0, 700) is stored
//   [500000, 510000)      written twice; the second write (×2 values) wins
// Also covers clear() + reconfigure keeping a generation.
#include <juce_core/juce_core.h>
#include "Tap/TapCache.h"
#include <cmath>
#include <iostream>

static void pushRange (slurtap::TapCache& cache, juce::int64 start, juce::int64 end, float scale, bool offline)
{
    std::vector<float> l, r;
    juce::Random random (7);
    for (juce::int64 s = start; s < end;)
    {
        const int n = (int) juce::jmin<juce::int64> (end - s, 37 + random.nextInt (900));
        l.resize ((size_t) n); r.resize ((size_t) n);
        for (int i = 0; i < n; ++i) { l[(size_t) i] = (float) (s + i) * 1e-6f * scale; r[(size_t) i] = -l[(size_t) i]; }
        const float* ch[] = { l.data(), r.data() };
        cache.push (s, ch, 2, n, offline);
        s += n;
    }
}

int main()
{
    if (juce::SystemStats::getEnvironmentVariable ("SLUR_TAP_ROOT", {}).isEmpty()) { std::cerr << "set SLUR_TAP_ROOT\n"; return 2; }
    const juce::String tapId = "11111111-2222-3333-4444-555555555555";
    juce::String gen;
    {
        slurtap::TapCache cache;
        cache.setHost ("Logic Pro");
        cache.setTrack ("Kick In", "#ff2a2a");
        gen = cache.configure (tapId, {}, 48000.0, 2);
        pushRange (cache, 1000, 201000, 1.0f, true);
        pushRange (cache, -300, 700, 1.0f, true);
        pushRange (cache, 500000, 510000, 1.0f, true);
        juce::Thread::sleep (100);
        pushRange (cache, 500000, 510000, 2.0f, true);
        juce::Thread::sleep (200);
    }   // destructor drains and flushes
    {
        // Reopening the project: same generation, captures kept.
        slurtap::TapCache cache;
        cache.setHost ("Logic Pro");
        cache.setTrack ("Kick In", "#ff2a2a");   // hosts resend the track name after reopening
        const auto again = cache.configure (tapId, gen, 48000.0, 2);
        if (again != gen) { std::cerr << "generation not reused\n"; return 1; }
        // A rate change must start a new generation and delete the old one.
        const auto other = cache.configure ("99999999-2222-3333-4444-555555555555", {}, 44100.0, 1);
        cache.clear();
        juce::ignoreUnused (other);
    }
    std::cout << gen << std::endl;
    return 0;
}
