#pragma once
#include <juce_core/juce_core.h>
#include <atomic>
#include <map>
#include <mutex>
#include <vector>

// Disk cache written by Slur Tap: what a track sounded like at each host
// timeline sample. Format: packages/track-export/TAP-CACHE.md.
namespace slurtap
{
class TapCache final : private juce::Thread
{
public:
    static constexpr juce::int64 pageFrames = 65536;
    static constexpr juce::int64 maxBytes = 4LL * 1024 * 1024 * 1024;

    TapCache();
    ~TapCache() override;

    // Not concurrent with push(): call from prepareToPlay or while processing is stopped.
    // Returns the generation in use (a new one when rate/channels changed or none was given).
    juce::String configure (const juce::String& tapId, const juce::String& generation, double sampleRate, int channels);
    void setTrack (const juce::String& name, const juce::String& colour);
    void setHost (const juce::String& hostName);
    // Discards every capture of this tap and starts a fresh generation.
    juce::String clear();

    // Audio thread. Real time: drops (and counts) a block when the writer is behind.
    // waitForSpace (offline render only): blocks until the block is queued.
    void push (juce::int64 start, const float* const* channelData, int numChannels, int frames, bool waitForSpace);

    juce::int64 coveredFrames() const noexcept { return covered.load(); }
    bool recentlyCapturing() const noexcept { return juce::Time::currentTimeMillis() - lastPushMs.load() < 750; }
    bool isFull() const noexcept { return full.load(); }
    juce::String trackName() const { const std::lock_guard<std::mutex> l (infoLock); return track; }

private:
    struct Span { juce::int64 end, time; };
    struct Header { juce::int64 start; int frames; };

    void run() override;
    void drain();
    void writeFrames (juce::int64 start, const float* interleaved, int frames);
    void addSpan (juce::int64 a, juce::int64 b, juce::int64 time);
    void flush (bool force);
    void closeFiles();
    void loadCoverage();
    void removeStaleCaches();
    juce::File generationDir() const;

    // Queue: interleaved samples + block headers.
    static constexpr int queueFrames = 1 << 20;
    std::vector<float> ring;
    juce::AbstractFifo sampleFifo { queueFrames * 2 }, headerFifo { 8192 };
    std::vector<Header> headers = std::vector<Header> (8192);
    std::vector<float> scratch;

    std::atomic<int> channels { 0 };
    std::atomic<bool> ready { false }, full { false };
    std::atomic<juce::int64> covered { 0 }, lastPushMs { 0 }, dropped { 0 };

    mutable std::mutex stateLock, infoLock;   // stateLock: writer state; infoLock: registry text
    juce::String tap, gen, host, track, colour;
    double rate = 0;
    std::map<juce::int64, Span> spans;
    std::map<juce::int64, int> files;          // page → fd
    juce::int64 pagesWritten = 0;
    bool dirty = false;
    std::atomic<bool> registryDirty { true };
    juce::int64 lastFlushMs = 0, lastRegistryMs = 0;
};
}
