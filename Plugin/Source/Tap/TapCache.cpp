#include "TapCache.h"
#include "SlurHostKey.h"
#include <algorithm>
#include <cstdio>
#include <fcntl.h>
#include <sys/stat.h>
#include <unistd.h>

namespace slurtap
{
namespace
{
constexpr juce::int64 mergeWindowMs = 60000;
constexpr juce::int64 staleCacheMs = 30LL * 24 * 3600 * 1000;

void privateDir (const juce::File& dir)
{
    dir.createDirectory();
    ::chmod (dir.getFullPathName().toRawUTF8(), 0700);
}

// tmp + rename: readers never observe a half-written JSON file.
bool writeAtomically (const juce::File& target, const juce::String& text)
{
    const auto tmp = target.getSiblingFile (target.getFileName() + ".tmp");
    if (! tmp.replaceWithText (text, false, false, "\n")) return false;
    ::chmod (tmp.getFullPathName().toRawUTF8(), 0600);
    return ::rename (tmp.getFullPathName().toRawUTF8(), target.getFullPathName().toRawUTF8()) == 0;
}
}

TapCache::TapCache() : juce::Thread ("Slur Tap writer")
{
    ring.resize ((size_t) sampleFifo.getTotalSize());
    startThread (juce::Thread::Priority::normal);
}

TapCache::~TapCache()
{
    stopThread (4000);
}

juce::File TapCache::generationDir() const
{
    return root().getChildFile ("cache").getChildFile (tap).getChildFile (gen);
}

juce::String TapCache::configure (const juce::String& tapId, const juce::String& generation, double sampleRate, int numChannels)
{
    const std::lock_guard<std::mutex> lock (stateLock);
    if (ready.load()) { drain(); flush (true); }
    ready.store (false);
    closeFiles();
    // Safe: the host does not run processBlock during prepareToPlay.
    sampleFifo.reset();
    headerFifo.reset();

    const int ch = juce::jlimit (1, 2, numChannels);
    tap = tapId;
    bool reuse = false;
    if (generation.isNotEmpty() && generation.containsOnly ("0123456789abcdef-"))
    {
        gen = generation;
        const auto meta = juce::JSON::parse (generationDir().getChildFile ("coverage.json").loadFileAsString());
        reuse = meta.isObject() && (double) meta["sampleRate"] == sampleRate && (int) meta["channels"] == ch
             && (int) meta["pageFrames"] == (int) pageFrames;
    }
    if (! reuse) gen = juce::Uuid().toDashedString();
    rate = sampleRate;
    channels.store (ch);
    spans.clear();
    pagesWritten = 0;
    full.store (false);
    if (reuse) loadCoverage();

    privateDir (root());
    privateDir (root().getChildFile ("taps"));
    privateDir (root().getChildFile ("cache"));
    privateDir (generationDir().getParentDirectory());
    privateDir (generationDir());
    // Older generations of this tap can never be read again.
    for (const auto& dir : generationDir().getParentDirectory().findChildFiles (juce::File::findDirectories, false))
        if (dir.getFileName() != gen) dir.deleteRecursively();

    dirty = true;
    registryDirty = true;
    ready.store (true, std::memory_order_release);
    flush (true);
    return gen;
}

juce::String TapCache::clear()
{
    const std::lock_guard<std::mutex> lock (stateLock);
    // Unlike configure(), the audio thread may be pushing: keep the queue, drop its contents.
    drain();
    closeFiles();
    generationDir().deleteRecursively();
    gen = juce::Uuid().toDashedString();
    privateDir (generationDir());
    spans.clear();
    pagesWritten = 0;
    covered.store (0);
    full.store (false);
    dirty = true;
    registryDirty = true;
    flush (true);
    return gen;
}

void TapCache::setTrack (const juce::String& name, const juce::String& colourHex)
{
    { const std::lock_guard<std::mutex> l (infoLock); track = name; colour = colourHex; }
    registryDirty = true;
}

void TapCache::setHost (const juce::String& hostName)
{
    { const std::lock_guard<std::mutex> l (infoLock); host = hostName; }
    registryDirty = true;
}

void TapCache::push (juce::int64 start, const float* const* data, int numChannels, int frames, bool waitForSpace)
{
    if (! ready.load (std::memory_order_acquire) || frames <= 0 || numChannels <= 0) return;
    int offset = 0;
    if (start < 0)
    {
        // Pre-roll before song zero is not stored.
        if (start + frames <= 0) return;
        offset = (int) -start;
        frames -= offset;
        start = 0;
    }
    const int ch = channels.load();
    const int need = frames * ch;
    if (need >= sampleFifo.getTotalSize()) { ++dropped; return; }
    while (sampleFifo.getFreeSpace() < need || headerFifo.getFreeSpace() < 1)
    {
        if (! waitForSpace || threadShouldExit()) { ++dropped; return; }
        juce::Thread::sleep (1);
    }
    int s1, n1, s2, n2;
    sampleFifo.prepareToWrite (need, s1, n1, s2, n2);
    int k = 0;
    for (int f = 0; f < frames; ++f)
        for (int c = 0; c < ch; ++c, ++k)
            ring[(size_t) (k < n1 ? s1 + k : s2 + (k - n1))] = data[juce::jmin (c, numChannels - 1)][offset + f];
    sampleFifo.finishedWrite (n1 + n2);
    // Header after samples: the writer never sees a block whose audio is not queued.
    headerFifo.prepareToWrite (1, s1, n1, s2, n2);
    headers[(size_t) (n1 > 0 ? s1 : s2)] = { start, frames };
    headerFifo.finishedWrite (1);
    lastPushMs.store (juce::Time::currentTimeMillis());
}

void TapCache::run()
{
    removeStaleCaches();
    while (! threadShouldExit())
    {
        {
            const std::lock_guard<std::mutex> lock (stateLock);
            if (ready.load()) { drain(); flush (false); }
        }
        wait (5);
    }
    const std::lock_guard<std::mutex> lock (stateLock);
    if (ready.load()) { drain(); flush (true); }
    closeFiles();
}

void TapCache::drain()
{
    const int ch = channels.load();
    while (headerFifo.getNumReady() > 0)
    {
        int s1, n1, s2, n2;
        headerFifo.prepareToRead (1, s1, n1, s2, n2);
        const Header h = headers[(size_t) (n1 > 0 ? s1 : s2)];
        headerFifo.finishedRead (1);
        const int need = h.frames * ch;
        scratch.resize ((size_t) need);
        sampleFifo.prepareToRead (need, s1, n1, s2, n2);
        if (n1 + n2 != need) { sampleFifo.finishedRead (n1 + n2); continue; }   // never expected
        std::copy_n (ring.data() + s1, n1, scratch.data());
        std::copy_n (ring.data() + s2, n2, scratch.data() + n1);
        sampleFifo.finishedRead (need);
        writeFrames (h.start, scratch.data(), h.frames);
    }
}

void TapCache::writeFrames (juce::int64 start, const float* interleaved, int frames)
{
    if (full.load()) return;
    const int ch = channels.load();
    const auto dir = generationDir();
    int done = 0;
    while (done < frames)
    {
        const juce::int64 s = start + done, page = s / pageFrames, within = s % pageFrames;
        const int n = (int) juce::jmin ((juce::int64) (frames - done), pageFrames - within);
        auto it = files.find (page);
        if (it == files.end())
        {
            if (files.size() >= 32) closeFiles();
            const auto file = dir.getChildFile ("page-" + juce::String (page) + ".f32");
            if (! file.existsAsFile())
            {
                if ((pagesWritten + 1) * pageFrames * ch * (juce::int64) sizeof (float) > maxBytes)
                {
                    full.store (true);
                    registryDirty = true;
                    break;
                }
                ++pagesWritten;
            }
            const int fd = ::open (file.getFullPathName().toRawUTF8(), O_WRONLY | O_CREAT, 0600);
            if (fd < 0) break;
            it = files.emplace (page, fd).first;
        }
        const auto bytes = (size_t) n * (size_t) ch * sizeof (float);
        if (::pwrite (it->second, interleaved + (size_t) done * (size_t) ch, bytes, (off_t) (within * ch * (juce::int64) sizeof (float))) != (ssize_t) bytes)
            break;
        done += n;
    }
    if (done > 0)
    {
        addSpan (start, start + done, juce::Time::currentTimeMillis());
        dirty = true;
    }
}

void TapCache::addSpan (juce::int64 a, juce::int64 b, juce::int64 time)
{
    // Remove [a, b) from existing spans (splitting where needed), then insert and merge.
    auto it = spans.lower_bound (a);
    if (it != spans.begin())
    {
        auto prev = std::prev (it);
        if (prev->second.end > a)
        {
            const Span tail = prev->second;
            prev->second.end = a;
            if (tail.end > b) spans[b] = tail;
        }
    }
    it = spans.lower_bound (a);
    while (it != spans.end() && it->first < b)
    {
        if (it->second.end > b) { const Span rest = it->second; spans.erase (it); spans[b] = rest; break; }
        it = spans.erase (it);
    }
    auto ins = spans.insert_or_assign (a, Span { b, time }).first;
    if (ins != spans.begin())
    {
        auto prev = std::prev (ins);
        if (prev->second.end == a && std::abs (prev->second.time - time) <= mergeWindowMs)
        {
            prev->second.end = b;
            prev->second.time = juce::jmin (prev->second.time, time);
            spans.erase (ins);
            ins = prev;
        }
    }
    auto next = std::next (ins);
    if (next != spans.end() && next->first == ins->second.end && std::abs (next->second.time - ins->second.time) <= mergeWindowMs)
    {
        ins->second.end = next->second.end;
        ins->second.time = juce::jmin (ins->second.time, next->second.time);
        spans.erase (next);
    }
}

void TapCache::flush (bool force)
{
    const auto now = juce::Time::currentTimeMillis();
    if (dirty && (force || now - lastFlushMs >= 500))
    {
        juce::String list;
        juce::int64 total = 0;
        for (const auto& [start, span] : spans)
        {
            list << (list.isEmpty() ? "" : ",") << "[" << start << "," << span.end << "," << span.time << "]";
            total += span.end - start;
        }
        covered.store (total);
        juce::String json;
        json << "{\"version\":1,\"sampleRate\":" << juce::String (rate, 0) << ",\"channels\":" << channels.load()
             << ",\"pageFrames\":" << pageFrames << ",\"spans\":[" << list << "]}";
        if (writeAtomically (generationDir().getChildFile ("coverage.json"), json)) dirty = false;
        lastFlushMs = now;
    }
    if (force || registryDirty || now - lastRegistryMs >= 1000)
    {
        auto* o = new juce::DynamicObject();
        o->setProperty ("version", 1);
        o->setProperty ("tapId", tap);
        o->setProperty ("generation", gen);
        o->setProperty ("hostKey", hostKey());
        {
            const std::lock_guard<std::mutex> l (infoLock);
            o->setProperty ("host", host);
            o->setProperty ("track", track);
            o->setProperty ("colour", colour.isEmpty() ? juce::var() : juce::var (colour));
        }
        o->setProperty ("sampleRate", rate);
        o->setProperty ("channels", channels.load());
        o->setProperty ("heartbeatMs", now);
        o->setProperty ("cacheFull", full.load());
        o->setProperty ("dropped", dropped.load());
        writeAtomically (root().getChildFile ("taps").getChildFile (tap + ".json"), juce::JSON::toString (juce::var (o), true));
        registryDirty = false;
        lastRegistryMs = now;
    }
}

void TapCache::closeFiles()
{
    for (const auto& [page, fd] : files) ::close (fd);
    files.clear();
}

void TapCache::loadCoverage()
{
    const auto meta = juce::JSON::parse (generationDir().getChildFile ("coverage.json").loadFileAsString());
    if (const auto* list = meta["spans"].getArray())
        for (const auto& s : *list)
            if (s.isArray() && s.size() == 3 && (juce::int64) s[1] > (juce::int64) s[0] && (juce::int64) s[0] >= 0)
                spans[(juce::int64) s[0]] = { (juce::int64) s[1], (juce::int64) s[2] };
    pagesWritten = generationDir().getNumberOfChildFiles (juce::File::findFiles, "page-*.f32");
    juce::int64 total = 0;
    for (const auto& [start, span] : spans) total += span.end - start;
    covered.store (total);
}

void TapCache::removeStaleCaches()
{
    const auto now = juce::Time::currentTimeMillis();
    const auto taps = root().getChildFile ("taps"), cache = root().getChildFile ("cache");
    for (const auto& file : taps.findChildFiles (juce::File::findFiles, false, "*.json"))
    {
        const auto v = juce::JSON::parse (file.loadFileAsString());
        const auto beat = v.isObject() ? (juce::int64) v["heartbeatMs"] : file.getLastModificationTime().toMilliseconds();
        if (now - beat > staleCacheMs)
        {
            cache.getChildFile (file.getFileNameWithoutExtension()).deleteRecursively();
            file.deleteFile();
        }
    }
    for (const auto& dir : cache.findChildFiles (juce::File::findDirectories, false))
        if (! taps.getChildFile (dir.getFileName() + ".json").existsAsFile()
            && now - dir.getLastModificationTime().toMilliseconds() > staleCacheMs)
            dir.deleteRecursively();
}
}
