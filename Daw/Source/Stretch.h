#pragma once
#include <juce_audio_basics/juce_audio_basics.h>
#include <atomic>
#include <utility>
#include <vector>

/*  What is done to a file away from the clock: a new pitch, a warped
    time, and the places where something begins. All of it is offline —
    the engine plays what comes out as an ordinary buffer.              */

namespace daw
{
/** One pin of a time map: `s` seconds into the source lands at `d` seconds of what comes out. */
struct WarpPoint { double s = 0.0, d = 0.0; };

/** Render `src` through a time map and a transposition.
    The map is piecewise linear; its ends are taken as (0, 0) and (srcSec, outSec).
    `loop` treats the source as a cycle, so the result loops without a seam.
    Returns an empty buffer when `cancel` turns true. */
juce::AudioBuffer<float> warp (const juce::AudioBuffer<float>& src, double sr, double semis,
                               std::vector<WarpPoint> map, double outSec, bool loop, bool reverse,
                               const std::atomic<bool>* cancel = nullptr);

/** How fast a sound goes, heard from the sound itself.
    bpm: beats a minute (0 when nothing regular was found). sure: 0…1, how regular it is — how much of what
    happens comes again a beat later. first: seconds to the first beat (roughly: a hundredth of a second late
    rather than early, since a level is taken over three steps; nothing leans on it yet). loop: when the whole file is one, two,
    four, eight … bars at very nearly that speed (a loop cut to length), the speed its length says exactly; else 0. */
struct Tempo { double bpm = 0.0, sure = 0.0, first = 0.0, loop = 0.0; };
Tempo tempoOf (const juce::AudioBuffer<float>& src, double sr);

/** The stretches of a file in which there is sound, in seconds: [from, to] pairs in order.
    Sound is whatever reaches `floorDb` (dB below full scale); a quiet stretch shorter than `gap` seconds is not
    a silence; each stretch begins `pre` seconds early and ends `post` seconds late (a breath in, a tail out). */
std::vector<std::pair<double, double>> soundParts (const juce::AudioBuffer<float>& src, double sr, double floorDb, double gap, double pre, double post);
}
