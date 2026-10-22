#pragma once
#include <juce_audio_utils/juce_audio_utils.h>
#include <juce_audio_processors/juce_audio_processors.h>
#include <set>
#include <thread>
#include <mutex>
#include <condition_variable>
#include "FxEngine.h"
#include "Stretch.h"
#include "Transients.h"
#include "Modes.h"
#include "Pool.h"
#include "Recover.h"
#include "Instruments.h"
#include "host/Plug.h"
#include "Meter.h"
#include "Listen.h"
#include "Probe.h"
#include <sys/sysctl.h>
#include <AudioToolbox/AudioToolbox.h>
#include <mach/mach_time.h>
#include <sys/mman.h>
#include <unistd.h>

/*  The Slur DAW's engine, alpha.

    A sample clock, tracks that play regions of buffers along it, and on
    every track: the Patch engine (the same orbfx::Chain the plug-in runs),
    then any plug-ins from outside, then the fader. A track's sound goes to
    the stereo out or into a bus (an aux, or the sum of a stack), and may be
    sent on the side to other buses. The page (the web view) owns the
    session and tells the engine what it is; the engine owns time.

    Threads: the audio callback try-locks `lock` and plays silence for a
    block when the message thread is rearranging things. Levels and the
    hands of the patch are atomics and never need the lock. A print (an
    export, a bounce) runs on its own thread with the callback standing by.

    A block is worked rank by rank: the tracks that nothing flows into, then
    the buses they play into, and so on to the out. Within a rank no track
    needs another, so when a rank is heavy its tracks are shared out among
    the pool's threads (Pool.h); the sums into buses and the out are then
    made by one thread, in the tracks' own order — so the sound is the same
    to the last bit however many threads worked on it.                      */

// Mac.mm
void* slurAacOpen (const char* path, double sampleRate, int channels, int kbps);
bool  slurAacWrite (void* handle, const float* interleaved, int frames);
void  slurAacClose (void* handle);
void* slurSrcOpen (double fromRate, double toRate, int channels, bool best = true);
int   slurSrcRun (void* handle, const float* interleaved, int frames, bool last, float* out, int cap);
void  slurSrcClose (void* handle);
#ifndef SLUR_BRING_BEST
 #define SLUR_BRING_BEST false                    // a sound brought in at another rate: the converter at its usual best, not its slowest (a print uses that)
#endif

namespace daw
{
using juce::String;

inline void logLine (const String& s)
{
    static juce::CriticalSection cs;
    static juce::File file = []
    {
        auto dir = juce::File::getSpecialLocation (juce::File::userHomeDirectory).getChildFile ("Library/Logs/Slur");
        dir.createDirectory();
        bool check = false;                                            // (the check keeps a log of its own: it must not wipe the one of the app he is working in)
        for (auto& a : juce::JUCEApplicationBase::getCommandLineParameterArray()) if (a.startsWith ("--selftest")) check = true;
        auto f = dir.getChildFile (check ? "daw-selftest.log" : "daw.log");
        f.deleteFile();
        return f;
    }();
    const juce::ScopedLock sl (cs);
    file.appendText (juce::Time::getCurrentTime().toString (false, true, true, true) + "  " + s + "\n");
}

/** The program's name, as the folders it keeps things in are called (in Music, in Application Support, in Caches). It was
    Slur DAW until 2026-10-11: what lies under that name is taken over once, at a start (moveToNewName, in Main.cpp). */
inline const char* folderName()    { return "Slur Studio"; }
inline const char* oldFolderName() { return "Slur DAW"; }

/** Where projects and what is bounced are kept: Music/Slur Studio, which macOS lets an app use without asking. The check
    (--selftest) keeps all it makes in a place of its own, so it can neither see a real project nor leave one of its
    own lying among them. */
inline juce::File musicRoot()
{
    if (juce::JUCEApplicationBase::getCommandLineParameters().contains ("--selftest"))
        return juce::File::getSpecialLocation (juce::File::userHomeDirectory).getChildFile ("Library/Caches/Slur DAW self-test");
    return juce::File::getSpecialLocation (juce::File::userMusicDirectory).getChildFile (folderName());
}

/** Where the sound of files is kept ready: every file is decoded once, at the engine's rate, into bare samples that the
    engine then reads straight off the disk (Engine::decodeFile). It is a cache: any of it may be thrown away, by the
    system or by hand, and is made again the next time its file is opened. */
inline juce::File soundRoot()
{
    if (juce::JUCEApplicationBase::getCommandLineParameters().contains ("--selftest")) return musicRoot().getChildFile ("Sound");
    return juce::File::getSpecialLocation (juce::File::userHomeDirectory).getChildFile ("Library/Caches").getChildFile (folderName()).getChildFile ("Sound");
}
/** The room the disk must still have after a sound is laid in the cache: ten gigabytes — a twentieth of the disk where the
    disk is small, and never less than one. With less room than that nothing new is kept ready on the disk (the sound is
    held in memory instead, as it used to be), and what is there is given back, longest unused first. */
inline juce::int64 soundKeepFree (const juce::File& dir)
{
    const juce::int64 gb = (juce::int64) 1 << 30, total = dir.getVolumeTotalSize();
    if (juce::JUCEApplicationBase::getCommandLineParameters().contains ("--selftest")) return 2 * gb;      // (the check's own sounds are small and are taken away again: it may try the cache on a fuller disk)
    return juce::jmax (gb, juce::jmin (10 * gb, total > 0 ? total / 20 : 10 * gb));
}

/** What a hosted plug-in is told about time. */
struct PlayHead final : juce::AudioPlayHead
{
    std::atomic<double> bpm { 92.0 }, ppq { 0.0 };
    std::atomic<bool> playing { false };
    std::atomic<juce::int64> samples { 0 };
    std::atomic<int> beats { 4 }, unit { 4 };          // the measure: so many beats to a bar, each a 1/unit note

    juce::Optional<PositionInfo> getPosition() const override
    {
        PositionInfo p;
        const double q = ppq.load(), bar = (double) beats.load() * 4.0 / (double) unit.load();      // a bar, in quarter notes
        p.setBpm (bpm.load());
        p.setPpqPosition (q);
        p.setPpqPositionOfLastBarStart (std::floor (q / bar) * bar);
        p.setTimeSignature (TimeSignature { beats.load(), unit.load() });
        p.setTimeInSamples ((int64_t) samples.load());
        p.setIsPlaying (playing.load());
        return p;
    }
};

struct PluginWindow final : juce::DocumentWindow
{
    PluginWindow (const String& title, juce::Component* editor, bool resizable, std::function<void()> onCloseIn)
        : DocumentWindow (title, juce::Colour (0xff151514), DocumentWindow::closeButton), onClose (std::move (onCloseIn))
    {
        setUsingNativeTitleBar (true);
        setContentOwned (editor, true);
        setResizable (resizable, false);
        centreWithSize (getWidth(), getHeight());
        setAlwaysOnTop (true);                                     // over the room: a press on the room does not put the plug-in out of sight …
        setVisible (true);
        if (auto* p = getPeer()) slur::PlugWindow::keepOver (p->getNativeHandle());      // … and away with the app when another app is in front
        toFront (true);
    }
    void closeButtonPressed() override { if (onClose) onClose(); }
    /* the space bar, return and v, comma and period, when nothing of the plug-in's wanted them, are the room's: play and
       stop, to the beginning, the plug-ins' windows away, the playhead a bar back and on (the space bar is caught before
       the plug-in sees it as well: host/Window.mm) */
    bool keyPressed (const juce::KeyPress& k) override
    {
        const auto m = k.getModifiers();
        if (! m.isCommandDown() && ! m.isCtrlDown() && ! m.isAltDown() && slur::PlugWindow::key)
        {
            const int c = k.getKeyCode();
            const bool space = c == juce::KeyPress::spaceKey, ret = c == juce::KeyPress::returnKey, v = ! space && ! ret && ! m.isShiftDown() && (c == 'v' || c == 'V' || slur::PlugWindow::keyCodeNow() == 9);
            const bool comma = slur::PlugWindow::keyCodeNow() == 43, period = slur::PlugWindow::keyCodeNow() == 47;      // (the playhead a bar back, a bar on)
            if (comma || period) return slur::PlugWindow::key (comma ? "Comma" : "Period", m.isShiftDown());
            if (space || ret || v) return slur::PlugWindow::keyRepeats() || slur::PlugWindow::key (space ? "Space" : ret ? "Enter" : "KeyV", m.isShiftDown());
        }
        return DocumentWindow::keyPressed (k);
    }
    std::function<void()> onClose;
};

/** A plug-in from outside, sitting on a track after its patch. */
/** Sound held back on its way from a track into a bus (or to the stereo out), so that it gets there together with what
    took a longer way: a send into a bus whose plug-ins are late, beside the same track's plain way out, say. Where
    one way is as long as the other nothing is held, and no memory kept. */
struct Hold
{
    juce::AudioBuffer<float> ring;
    int len = 0, at = 0;
    /** How long it holds back, in samples. Never while a block is being worked. */
    void set (int samples)
    {
        samples = juce::jlimit (0, 1 << 20, samples);
        if (samples == len) return;
        len = samples; at = 0;
        ring.setSize (len > 0 ? 2 : 0, len, false, true, false);
    }
    void clear() { if (len > 0) { ring.clear(); at = 0; } }
    /** n samples go in, at a level that goes from g0 to g1 over them; what went in `len` samples ago is added to dL, dR. */
    void add (const float* L, const float* R, float* dL, float* dR, int n, float g0, float g1)
    {
        const float step = (g1 - g0) / (float) n;
        float g = g0;
        if (len <= 0) { for (int i = 0; i < n; ++i) { g += step; dL[i] += L[i] * g; dR[i] += R[i] * g; } return; }
        float* hl = ring.getWritePointer (0); float* hr = ring.getWritePointer (1);
        for (int i = 0; i < n; ++i) { g += step; const float l = hl[at], r = hr[at]; hl[at] = L[i] * g; hr[at] = R[i] * g; dL[i] += l; dR[i] += r; if (++at >= len) at = 0; }
    }
};

struct Track;
struct LiveOut;

struct Insert
{
    int uid = 0;
    String name, fmt;
    std::unique_ptr<juce::AudioPluginInstance> inst;   // declared before the window: the window (and the editor in it) dies first
    /*  … or, where the app opens audio units itself (Engine::ownAu, host/Au.mm) and not through the library, this in
        its place: then `inst` is empty. Whatever is asked of a plug-in below is asked of whichever of the two is there. */
    std::unique_ptr<slur::Plug> own;
    const PlayHead* head = nullptr;                    // where the song is, for `own`
    bool printing = false;                             // `own` has been told that a print plays it
    slur::Note notes[256];                             // what is played to `own` within one block
    juce::AudioBuffer<float> buf;
    juce::MidiBuffer midi;
    int ins = 2, outs = 2;
    std::atomic<bool> off { false };                   // stepped past: the sound goes by untouched
    std::atomic<bool> llmSkip { false };               // low latency mode: too late for what is heard live — stepped past, and counted as on time
    int keyFrom = 0;                                   // the track it listens to on its second input (a compressor that ducks to a kick listens to the kick), 0: none
    Track* key = nullptr;                              // … found again whenever the tracks are wired; nullptr while that track is not there
    int keyCh = 0;                                     // how many channels that second input has, while it is open
    Hold keyHold;                                      // what it listens to, held back until this track's own sound is as late
    /** Which of its controls was last moved in its own window (-1: none yet) — the one a line is asked for by moving
        the thing itself, in place of looking through a list of hundreds. */
    struct Heard final : juce::AudioProcessorListener
    {
        std::atomic<int> index { -1 };
        std::atomic<bool> moved { true };              // something of it has changed since its settings were last asked for (a save asks only those: Engine::statesNow)
        void audioProcessorParameterChanged (juce::AudioProcessor*, int i, float) override { index.store (i); moved.store (true); }
        void audioProcessorChanged (juce::AudioProcessor*, const ChangeDetails&) override { moved.store (true); }
    } heard;
    ~Insert() { if (inst != nullptr) inst->removeListener (&heard); if (own != nullptr) own->touched = nullptr; }
    /** A line sets one of its controls (0..1). The thread that plays it, before it plays the block. */
    void setParam (int index, float v, float& told)
    {
        if (own != nullptr)
        {
            if (std::abs (v - told) < 1.0e-5f) return;
            if (index >= 0 && index < own->controls()) { own->setControl (index, juce::jlimit (0.0f, 1.0f, v)); told = v; }
            return;
        }
        if (inst == nullptr || std::abs (v - told) < 1.0e-5f) return;
        const auto& ps = inst->getParameters();
        if (index >= 0 && index < ps.size()) { ps.getUnchecked (index)->setValue (juce::jlimit (0.0f, 1.0f, v)); told = v; }
    }
    std::unique_ptr<PluginWindow> win;
    std::unique_ptr<slur::PlugWindow> ownWin;          // the window of `own` (after it, so that it goes first)

    bool there() const { return inst != nullptr || own != nullptr; }
    /** Its window, if one is open, is closed. */
    void shut() { win.reset(); ownWin.reset(); }
    /** It is no longer ready to play, and gives back what it held for that. */
    void letGo() { if (inst != nullptr) inst->releaseResources(); if (own != nullptr) own->release(); }
    /** All of its settings, as a song keeps them. */
    void stateTo (juce::MemoryBlock& mb)
    {
        if (own != nullptr) { const auto bytes = own->state(); mb.append (bytes.data(), bytes.size()); }
        else if (inst != nullptr) inst->getStateInformation (mb);
    }
    /** Where the song is, in the words `own` is told it in. */
    slur::Clock clock() const
    {
        slur::Clock c;
        if (head == nullptr) return c;
        const double q = head->ppq.load(), bar = (double) head->beats.load() * 4.0 / (double) head->unit.load();
        c.bpm = head->bpm.load(); c.beat = q; c.barBeat = std::floor (q / bar) * bar;
        c.num = head->beats.load(); c.den = head->unit.load();
        c.playing = head->playing.load(); c.sample = (int64_t) head->samples.load();
        return c;
    }

    void prepare (double sr, int block, juce::AudioPlayHead* ph)
    {
        if (own != nullptr)
        {
            head = static_cast<const PlayHead*> (ph);
            const bool ok = own->prepare (sr, block, keyFrom != 0 ? 2 : 0);      // its second input only while a track is given to it: stereo if it takes that, else one channel
            keyCh = ok ? own->keyChannels() : 0;
            ins = ok ? own->inputs() + keyCh : 0;
            outs = ok ? own->outputs() : 0;
            buf.setSize (2, block);
            buf.clear();
            return;
        }
        const auto stereo = juce::AudioChannelSet::stereo();
        auto l = inst->getBusesLayout();
        if (l.inputBuses.size() > 0)  l.inputBuses.getReference (0) = stereo;
        if (l.outputBuses.size() > 0) l.outputBuses.getReference (0) = stereo;
        for (int i = 1; i < l.inputBuses.size(); ++i)  l.inputBuses.getReference (i) = juce::AudioChannelSet::disabled();
        for (int i = 1; i < l.outputBuses.size(); ++i) l.outputBuses.getReference (i) = juce::AudioChannelSet::disabled();
        /* its second input — the key, what a compressor or a gate listens to in place of its own sound — is opened only
           while a track is given to it: in stereo if the plug-in takes that, else as one channel */
        if (keyFrom != 0 && l.inputBuses.size() > 1)
            for (const auto& set : { stereo, juce::AudioChannelSet::mono() })
            {
                auto k = l; k.inputBuses.getReference (1) = set;
                if (inst->checkBusesLayoutSupported (k)) { l = k; break; }
            }
        if (inst->checkBusesLayoutSupported (l)) inst->setBusesLayout (l);
        inst->setPlayHead (ph);
        inst->setRateAndBufferSizeDetails (sr, block);
        inst->prepareToPlay (sr, block);
        keyCh = keyFrom != 0 && inst->getBusCount (true) > 1 ? inst->getChannelCountOfBus (true, 1) : 0;
        ins = inst->getTotalNumInputChannels();
        outs = inst->getTotalNumOutputChannels();
        buf.setSize (juce::jmax (2, ins, outs), block);
        buf.clear();
    }

    /** A print is about to play it, or has played it: the plug-in is told that nothing waits on the clock — one that
        fetches its sound as it goes (a sampler, a reverb's room) then waits for it instead of playing nothing — and is
        told again when the song is back on the device. An audio unit has a property of its own for that, which the
        library does not set. */
    void offline (bool on)
    {
        if (own != nullptr) { const Inside inside (uid); own->offline (on); printing = on; return; }
        if (inst == nullptr) return;
        const Inside inside (uid);
        inst->setNonRealtime (on);
        struct Unit final : juce::ExtensionsVisitor { AudioUnit au = nullptr; void visitAudioUnitClient (const AudioUnitClient& c) override { au = c.getAudioUnitHandle(); } } unit;
        inst->getExtensions (unit);
        if (unit.au != nullptr) { const UInt32 v = on ? 1 : 0; AudioUnitSetProperty (unit.au, kAudioUnitProperty_OfflineRender, kAudioUnitScope_Global, 0, &v, sizeof (v)); }
    }

    /** How late it hands sound over, as it is now. An audio unit is asked itself: the library only hears of a change on
        the main thread's own time, and one told it is offline (see above) may answer otherwise from that moment on. */
    /** How late it makes what goes through it: as late as it is, or nothing while low latency mode steps past it. */
    int latencyHeard() const { return llmSkip.load() || off.load() ? 0 : latencyNow(); }      // (switched off it lets the sound by as it comes: nothing to make up for)
    int latencyNow() const
    {
        if (own != nullptr) return juce::jmax (0, own->latency());
        if (inst == nullptr) return 0;
        struct Unit final : juce::ExtensionsVisitor { AudioUnit au = nullptr; void visitAudioUnitClient (const AudioUnitClient& c) override { au = c.getAudioUnitHandle(); } } unit;
        inst->getExtensions (unit);
        if (unit.au != nullptr)
        {
            Float64 sec = 0.0; UInt32 size = sizeof (sec);
            if (AudioUnitGetProperty (unit.au, kAudioUnitProperty_Latency, kAudioUnitScope_Global, 0, &sec, &size) == noErr && sec >= 0.0 && sec < 60.0)
                return juce::roundToInt (sec * inst->getSampleRate());
        }
        return juce::jmax (0, inst->getLatencySamples());
    }

    /** kL, kR: what it listens to on its second input, when a track is given to it. */
    void process (float* L, float* R, int n, const float* kL = nullptr, const float* kR = nullptr)
    {
        if (own != nullptr)
        {
            if (outs < 1 || ins < 1 || off.load() || llmSkip.load()) return;
            if (ins - keyCh == 1) for (int i = 0; i < n; ++i) L[i] = 0.5f * (L[i] + R[i]);      // one channel in: left and right together, at half
            const float* k0 = nullptr; const float* k1 = nullptr;
            if (keyCh > 0 && kL != nullptr)
            {
                const float g = keyCh > 1 ? 1.0f : 0.5f;
                buf.clear (0, 0, n); buf.clear (1, 0, n);
                keyHold.add (kL, kR, buf.getWritePointer (0), buf.getWritePointer (keyCh > 1 ? 1 : 0), n, g, g);
                k0 = buf.getReadPointer (0); k1 = buf.getReadPointer (keyCh > 1 ? 1 : 0);
            }
            const Inside inside (uid);
            if (uid == crashOnUid.load (std::memory_order_relaxed)) { volatile int* nowhere = nullptr; *nowhere = 1; }
            if (uid == hangOnUid.load (std::memory_order_relaxed) && (printing || hangLive.load (std::memory_order_relaxed))) for (;;) juce::Thread::sleep (50);
            own->process (L, R, n, k0, k1, nullptr, 0, clock());
            return;
        }
        if (inst == nullptr || outs < 1 || ins < 1 || off.load() || llmSkip.load()) return;
        const int ch = buf.getNumChannels(), own = ins - keyCh;                       // own: the channels of its first input
        if (own < 1) return;
        if (own == 1) { auto* d = buf.getWritePointer (0); for (int i = 0; i < n; ++i) d[i] = 0.5f * (L[i] + R[i]); }
        else { juce::FloatVectorOperations::copy (buf.getWritePointer (0), L, n); juce::FloatVectorOperations::copy (buf.getWritePointer (1), R, n); }
        for (int c = (own == 1 ? 1 : 2); c < ch; ++c) buf.clear (c, 0, n);
        if (keyCh > 0 && kL != nullptr && own + keyCh <= ch)
        {
            const float g = keyCh > 1 ? 1.0f : 0.5f;                                  // (one channel: left and right together, at half)
            keyHold.add (kL, kR, buf.getWritePointer (own), buf.getWritePointer (keyCh > 1 ? own + 1 : own), n, g, g);
        }
        juce::AudioBuffer<float> view (buf.getArrayOfWritePointers(), ch, n);
        midi.clear();
        const Inside inside (uid);                                     // should it bring the app down, the next start can say which plug-in it was in
        if (uid == crashOnUid.load (std::memory_order_relaxed)) { volatile int* nowhere = nullptr; *nowhere = 1; }       // (the check asks for exactly this)
        if (uid == hangOnUid.load (std::memory_order_relaxed) && (inst->isNonRealtime() || hangLive.load (std::memory_order_relaxed))) for (;;) juce::Thread::sleep (50);     // (and for this: a print — or, asked so, the device — that never comes back from it)
        inst->processBlock (view, midi);
        juce::FloatVectorOperations::copy (L, buf.getReadPointer (0), n);
        juce::FloatVectorOperations::copy (R, buf.getReadPointer (outs >= 2 ? 1 : 0), n);
    }

    /** As an instrument: what is played goes in, and its sound is added to L/R (stepped past, it is still played — so
        that it is where it should be when it is heard again — and nothing of it is added). */
    void play (float* L, float* R, int n, juce::MidiBuffer& played)
    {
        if (own != nullptr)
        {
            if (outs < 1) return;
            buf.clear (0, 0, n); buf.clear (1, 0, n);
            int count = 0;
            for (const auto m : played)
                if (m.numBytes >= 1 && m.numBytes <= 3 && count < (int) (sizeof (notes) / sizeof (notes[0])))
                {
                    auto& note = notes[count++];
                    note.at = m.samplePosition; note.bytes[0] = m.data[0]; note.bytes[1] = m.numBytes > 1 ? m.data[1] : 0; note.bytes[2] = m.numBytes > 2 ? m.data[2] : 0;
                }
            const Inside inside (uid);
            own->process (buf.getWritePointer (0), buf.getWritePointer (1), n, nullptr, nullptr, notes, count, clock());
            if (off.load() || llmSkip.load()) return;
            juce::FloatVectorOperations::add (L, buf.getReadPointer (0), n);
            juce::FloatVectorOperations::add (R, buf.getReadPointer (1), n);
            return;
        }
        if (inst == nullptr || outs < 1) return;
        const int ch = buf.getNumChannels();
        for (int c = 0; c < ch; ++c) buf.clear (c, 0, n);
        juce::AudioBuffer<float> view (buf.getArrayOfWritePointers(), ch, n);
        const Inside inside (uid);
        inst->processBlock (view, played);
        if (off.load() || llmSkip.load()) return;
        juce::FloatVectorOperations::add (L, buf.getReadPointer (0), n);
        juce::FloatVectorOperations::add (R, buf.getReadPointer (outs >= 2 ? 1 : 0), n);
    }
};

struct Region
{
    double a = 0.0, b = 0.0;      // bars, counted from zero; b is where it ends
    int    buf = -1;
    bool   loop = true;
    double rate = 1.0;
    double loopBars = 1.0;
    double off = 0.0;             // where in its source it starts, bars
    float  gain = 1.0f;
    double fi = 0.0, fo = 0.0;    // fades, bars
    int    fic = 0, foc = 0;      // the curve each fade takes: 0 straight (equal gain), 1 equal power, 2 an s
    float  fib = 0.0f, fob = 0.0f; // how a straight one is bent, −1…1 (the page gives a fade of its own a bend the ear hears as even — his ask, 2026-10-22)
};
/** How far a fade has come (0 at silence, 1 at full), bent to its curve. Two regions that share a stretch — one falling,
    one rising — add up to the same level all the way with the straight curve when they are the same sound, and with the
    equal-power curve when they are different sounds. */
inline float fadeShape (int curve, double x, float bend = 0.0f)
{
    x = juce::jlimit (0.0, 1.0, x);
    if (curve == 1) return (float) std::sin (x * juce::MathConstants<double>::halfPi);
    if (curve == 2) return (float) (x * x * (3.0 - 2.0 * x));
    return bend == 0.0f ? (float) x : (float) std::pow (x, std::pow (2.0, 2.0 * (double) bend));      // (bent: slower or faster to begin, as far as the hand pulled it)
}

/** A line drawn along the song for one thing on a track: bars against a value. Volumes and sends in dB, pan −1..1, the prints 0..1. */
/** As many sends as a track can have (his word, 2026-10-21: ten, no more). The page says it as MAX_SENDS (ui/engine.js). */
static constexpr int kMaxSends = 10;
enum { kAutoVol = 0, kAutoPan, kAutoTape, kAutoSpace, kAutoDelay, kAutoSend0, kAutoCount = kAutoSend0 + kMaxSends, kAutoPlug = 100, kAutoPrint = 101 };      // kAutoPlug: a line for one of a plug-in's own controls; kAutoPrint: one for a hand of a print on the wall (a macro wired to it)
/** A line along the song. One for a plug-in's control says which plug-in (uid) and which of its controls (index), and
    counts from 0 to 1 as the plug-in does; `told` is what the control was last set to, so that it is set only when the
    line has moved on. */
struct Auto { int param = 0; std::vector<std::pair<double, float>> pts; int uid = 0, index = 0; float told = -1.0f; int node = -1, field = 0; std::vector<float> table; };      // a print's hand: node, which part of it (0 amount, 1 flavour, 2 decay, 3 division, 4 feedback, 10 + k aux k), and what the line's 0..1 is along it (table)

inline float dbGain (float db) { return db <= -47.5f ? 0.0f : std::pow (10.0f, db * 0.05f); }

/** A thing a track of notes plays at a place along the song (bars from zero): the three bytes as they travel. Where two
    fall on one place, a key coming up goes first, then what is turned, then a key going down (`order`). */
struct NoteEv { double bar = 0.0; juce::uint8 st = 0, d1 = 0, d2 = 0, order = 0; };

/** A key that was played by hand, and when: where the song stood for whoever played it (`songS`, in samples; only meant
    while the song ran), and where the device's own count of samples stood (`runS`, which never stops). `seg` counts the
    times the song was started or stopped: what was played in one go has one number. */
struct Played { juce::int64 songS = 0, runS = 0; int seg = 0; juce::uint8 st = 0, d1 = 0, d2 = 0, rolling = 0; };

struct Track
{
    int id = 0, kind = 0;                        // kind 0 plays regions; 1 is a bus: an aux, or the sum of a stack
    int outId = 0;
    Track* out = nullptr;                        // nullptr: the stereo out
    struct SendSlot { int to = 0; Track* dst = nullptr; std::atomic<float> gain { 0.0f }; float sm = 0.0f; Hold hold; } sends[kMaxSends];
    Hold outHold;                                // what goes its plain way out, held back when a send of its takes longer to arrive
    std::vector<Region> regs;
    std::vector<Auto> autos;
    std::atomic<float> vol { 1.0f }, gate { 1.0f }, pan { 0.0f }, tape { 0.0f }, space { 0.0f }, delay { 0.0f }, peak { 0.0f }, peakL { 0.0f }, peakR { 0.0f };      // (peakL, peakR: each side on its own, for the mixer's two meters)
    std::atomic<bool> mon { false };
    std::atomic<bool> frozen { false };          // frozen (his ask, 2026-10-21): it plays its print, the one region the page sends it; its instrument, plug-ins and patch rest, and are no later than nothing
    std::atomic<bool> dead { false };            // switched off (his ask, 2026-10-20: for the processor's sake): nothing of it is worked — no region read, no instrument, no plug-in, no patch — and it is silent
    std::atomic<int> ahead { 0 };                // how late its plug-ins hand sound over, and those of the buses on its longest way to the stereo out: its regions are read that much early
    std::atomic<int> early { 0 }, earlyIn { 0 }; // how much earlier than the playhead the sound is where it leaves the track (the lateness of the buses still to come), and where it goes into the track's patch (that, and its own): its lines are read as early, so that a line changes the sound at the bar it is drawn at
    std::atomic<int> input { 0 };                // 0..15: that input alone; 100 + p: inputs 2p+1 and 2p+2 as a pair
    float share = 0.62f, gainSm = 0.0f, panSm = 0.0f;
    std::unique_ptr<orbfx::Chain> chain;         // made the first time the patch is asked for anything (it is a big room)
    orbfx::NodeParams prm[orbfx::kMaxNodes];
    std::vector<std::unique_ptr<Insert>> inserts;
    juce::AudioBuffer<float> work;
    float cost = 0.0f;                           // how long its own part of a block has been taking, in seconds (smoothed): what says whether a rank is worth sharing out
    /* resting (his ask, 2026-10-21: as fast as it can go, without anything being less at hand): see playTrack */
    std::atomic<int> sleepAfter { 0 };           // after how many samples of nothing coming in and nothing going out its plug-ins and patch may rest: their longest tail and two seconds, eight at least, thirty at most; 0: not yet known
    int quiet = 0;                               // audio thread: how many samples in a row it has had nothing coming in and given nothing out
    bool keyFor = false, keyed = false;          // something listens to it (a key, a side) / something of it listens to another track: never rested (set when the tracks are wired)
    std::atomic<int> rested { 0 };               // how many blocks it has rested (for the check)
    std::atomic<float> stillOut { 0.0f };        // the loudest its plug-ins gave out while nothing came in, since the check last asked (for the check)
    int ver = -1;                                // which telling of its regions, lines and wiring it holds (the page numbers them, and sends only what has changed)

    //── its patch as a wall (Patch on Slur's way): prints and plug-ins in one graph, wired as the page drew them ──
    bool wall = false;                           // the page has given it a wall: the patch and the plug-ins are played from the graph, not in a row
    orbfx::Graph wallGraph;                      // as the page drew it (message thread; kept to be compiled again when a plug-in's lateness changes)
    std::array<std::atomic<float>, orbfx::kMaxNodes> amt {};      // each node's amount, as the hand has it
    orbfx::Modulator mod;                        // the hands its control prints play (lfos, macros, scenes…): Patch on Slur's own, from the engine
    orbfx::NodeParams prmNow[orbfx::kMaxNodes];  // audio thread: this block's hands, as the control prints have moved them (prm is where they are set)
    int slotType[orbfx::kMaxNodes] {};           // what stands at each node (changed under the lock, with the program)
    bool fast = false;                           // low latency mode: what is heard live goes this way (message thread)
    std::vector<std::pair<int, int>> wallSkipped;   // …and what its wall steps past for it: node, how late it is (samples)
    Insert* slotIns[orbfx::kMaxNodes] {};        // the plug-in that stands at a node (changed under the lock, with the program that names it)
    std::unique_ptr<Meter> meterOwn[orbfx::kMaxNodes];   // a meter that stands at a node: made when one first stands there, and kept as long as the track is
    Meter* slotMeter[orbfx::kMaxNodes] {};       // … and the one the audio thread hands the sound to as it passes (changed under the lock)
    int sideFrom = 0;                            // the track a `side` on its wall plays (Patch on Slur's sidechain: the host's side bus, here a track), 0: none
    Track* side = nullptr;                       // … found again whenever the tracks are wired; nullptr while that track is not there
    Hold sideHold;                               // what it plays, held back until this track's own sound is as late
    juce::AudioBuffer<float> sideBuf;            // the side, held, for one block
    int slotSrc[orbfx::kMaxNodes] {};            // whose amount a node takes: 0 its own; 1, 2, 3 the track's tape, space, delay (their lines and command words go on working)
    int slotLat[orbfx::kMaxNodes] {};            // how late each plug-in was when the wall was last compiled
    int wallLat = 0;                             // how late the whole wall hands sound over, from in to out
    double barNow = 0.0;                         // where in the song the block being played begins (for a plug-in's lines, asked for from inside the graph)

    //── a track of notes: what it plays along the song, and what plays it ──
    bool notes = false;
    std::vector<NoteEv> evs;                     // in the order they fall
    std::unique_ptr<slurinst::Instrument> built; // one of the DAW's own instruments,
    std::unique_ptr<Insert> plug;                // or one from outside
    std::vector<slurinst::Ev> now;               // what falls in the stretch being played
    juce::MidiBuffer plugMidi;
    juce::uint8 heldSong[128] {}, heldLive[128] {};      // the keys that are down: by the song, by hand
    int liveDown = 0;
    juce::int64 nextS = -1;                      // where the song's notes have been read up to
    bool rolled = false;
    std::atomic<bool> live { false };            // it hears what is played by hand
    std::atomic<bool> stale { false };           // what it plays, or what plays it, has changed under keys that were down
    std::atomic<bool> hush { false };            // everything it sounds is to stop at once (a note that hangs: see Engine::hushAll)
    LiveOut* printLive = nullptr;                // a realtime print keeps its sound (before or after its fader) as the song plays — set under the lock
    //── while a realtime print plays, the room draws what comes out of the track: its peak two hundred times a second, with
    //   the place in the song it belongs to (the audio thread writes; the message thread reads them off — Engine::takeMeters)
    static constexpr int kFine = 4096;
    float fineBar[kFine] {}, finePk[kFine] {};
    std::atomic<int> fineW { 0 };
    int fineR = 0, fineN = 0;
    float fineMax = 0.0f;

    template <typename F> void eachPlug (F&& f) { if (plug != nullptr) f (*plug); for (auto& i : inserts) f (*i); }
    void keysUp() { std::memset (heldSong, 0, sizeof (heldSong)); std::memset (heldLive, 0, sizeof (heldLive)); liveDown = 0; }
};

/** A sound the engine can play: `data` is all of it. It lies in memory of its own (what the page made, what was
    stretched), or in a file on disk that `map` holds open and `data` only looks into — then the system brings in the
    parts that are played and may let go of the rest, so a long file does not have to fit in memory. */
struct Buf
{
    std::unique_ptr<juce::MemoryMappedFile> map;        // declared first: it must outlive the buffer that looks into it
    juce::AudioBuffer<float> data;
};

/** A take being written: the track it is for, and a writer the audio thread can hand samples to. */
struct Rec
{
    int trackId = 0, input = 0;
    juce::File file;
    std::unique_ptr<juce::AudioFormatWriter::ThreadedWriter> tw;
    juce::int64 got = 0;
};

/** A realtime print (a bounce played through as the song plays, not ahead of it): one file being written as it goes —
    the mix, or one track before or after its fader. Its block of sound is kept by playTrack (a track) or the device's
    callback (the mix), and handed to a writer the audio thread can give samples to; a 32-bit file at the device's rate,
    made into what was asked for (kind, rate, depth) once the song has gone by. */
struct LiveOut
{
    Track* t = nullptr;
    bool pre = false;
    juce::int64 from = 0, written = 0;           // where the song stands as its first sample is written (its track's sound is early by Track::early there), how much of it is

    juce::File tmp, file;
    juce::var tv;                                // what the page called it ({id, name})
    std::unique_ptr<juce::AudioFormatWriter::ThreadedWriter> tw;
    juce::AudioBuffer<float> buf;
};

/** Where a print goes: a file of some kind, at some rate and depth. */
class Sink
{
public:
    ~Sink() { close(); }
    const std::atomic<bool>* stop = nullptr;      // looked at while an encoder outside the app runs: set, the encoder is put down

    /** Given up before its end (the app is going): nothing is encoded, and nothing of it stays on the disk. */
    void abandon()
    {
        if (src != nullptr) { slurSrcClose (src); src = nullptr; }
        if (aac != nullptr) { slurAacClose (aac); aac = nullptr; }
        writer.reset();
        file.deleteFile();
        if (tmp != juce::File()) tmp.deleteFile();
        ok = false;
    }

    /** Empty when it opened; otherwise why not. */
    String open (const juce::File& fileIn, const String& fmtIn, double fromRate, double toRate, int bitsIn, const juce::File& lameIn, int kbpsIn = 320)
    {
        file = fileIn; fmt = fmtIn; bits = bitsIn; lame = lameIn;
        kbps = 320; for (int k : { 8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320 }) if (kbpsIn <= k) { kbps = k; break; }      // an mp3's rate: one LAME knows
        rate = toRate;
        if (fmt == "m4a" || fmt == "mp3") { rate = juce::jmin (48000.0, rate); bits = 16; }
        if (fmt == "aiff" || fmt == "flac") bits = juce::jmin (24, bits);
        from = fromRate;
        if (src != nullptr) { slurSrcClose (src); src = nullptr; }
        if (std::abs (fromRate / rate - 1.0) > 1.0e-9 && (src = slurSrcOpen (fromRate, rate, 2, true)) == nullptr) return "that rate would not open";      // another rate: the Mac's own converter (Mac.mm)
        file.deleteFile();
        if (fmt == "m4a")
        {
            aac = slurAacOpen (file.getFullPathName().toRawUTF8(), rate, 2, 256);
            return aac != nullptr ? String() : String ("the m4a would not open");
        }
        auto target = file;
        if (fmt == "mp3")
        {
            if (! lame.existsAsFile()) return "mp3 needs lame";
            target = tmp = file.getSiblingFile (file.getFileNameWithoutExtension() + ".tmp.wav");
            tmp.deleteFile();
        }
        std::unique_ptr<juce::OutputStream> os = target.createOutputStream();
        if (os == nullptr) return "the file would not open";
        auto o = juce::AudioFormatWriterOptions{}.withSampleRate (rate).withNumChannels (2).withBitsPerSample (bits);
        if (bits == 32) o = o.withSampleFormat (juce::AudioFormatWriterOptions::SampleFormat::floatingPoint);
        if (fmt == "aiff")      { juce::AiffAudioFormat f; writer = f.createWriterFor (os, o); }
        else if (fmt == "flac") { juce::FlacAudioFormat f; writer = f.createWriterFor (os, o); }
        else                    { juce::WavAudioFormat f;  writer = f.createWriterFor (os, o); }
        return writer != nullptr ? String() : String ("that kind of file would not open");
    }

    void write (const juce::AudioBuffer<float>& b, int n)
    {
        if (n <= 0 || (writer == nullptr && aac == nullptr)) return;
        totalIn += n;
        if (src == nullptr) { push (b, 0, n); return; }
        srcIn.resize ((size_t) n * 2);
        const float* l = b.getReadPointer (0); const float* r = b.getReadPointer (1);
        for (int i = 0; i < n; ++i) { srcIn[(size_t) i * 2] = l[i]; srcIn[(size_t) i * 2 + 1] = r[i]; }
        convert (srcIn.data(), n, false);
    }

    bool close()
    {
        if (writer == nullptr && aac == nullptr) return ok;
        if (src != nullptr) { convert (nullptr, 0, true); slurSrcClose (src); src = nullptr; }      // what the converter still holds
        if (aac != nullptr) { slurAacClose (aac); aac = nullptr; }
        writer.reset();
        if (fmt == "mp3" && ok)
        {
            juce::ChildProcess cp;
            ok = cp.start (juce::StringArray { lame.getFullPathName(), "--silent", "-b", String (kbps), tmp.getFullPathName(), file.getFullPathName() });
            for (int i = 0; ok && cp.isRunning(); ++i)                       // ten minutes at most; and not a moment longer than the app itself stays
            {
                if (i >= 30000 || (stop != nullptr && stop->load())) { cp.kill(); ok = false; break; }
                juce::Thread::sleep (20);
            }
            ok = ok && file.existsAsFile();
            tmp.deleteFile();
            if (! ok) file.deleteFile();
        }
        return ok;
    }

private:
    /* frames handed to the converter (none: only asked), and what it gives back written, as much as there is; at the end
       no more than the length the sound has at the new rate */
    void convert (const float* in, int n, bool last)
    {
        constexpr int cap = 8192;
        srcOut.resize ((size_t) cap * 2);
        for (int got = slurSrcRun (src, in, n, last, srcOut.data(), cap); ; got = slurSrcRun (src, nullptr, 0, last, srcOut.data(), cap))
        {
            const int keep = last ? (int) juce::jlimit ((juce::int64) 0, (juce::int64) got, (juce::int64) std::llround ((double) totalIn * rate / from) - wrote) : got;
            if (keep > 0)
            {
                rsBuf.setSize (2, keep, false, false, true);
                float* l = rsBuf.getWritePointer (0); float* r = rsBuf.getWritePointer (1);
                for (int i = 0; i < keep; ++i) { l[i] = srcOut[(size_t) i * 2]; r[i] = srcOut[(size_t) i * 2 + 1]; }
                push (rsBuf, 0, keep);
            }
            if (got < cap) break;
        }
    }
    void push (const juce::AudioBuffer<float>& b, int start, int n)
    {
        wrote += n;
        const bool dither = bits == 16;
        if (aac != nullptr)
        {
            inter.resize ((size_t) n * 2);
            const float* l = b.getReadPointer (0) + start; const float* r = b.getReadPointer (1) + start;
            for (int i = 0; i < n; ++i) { inter[(size_t) i * 2] = l[i]; inter[(size_t) i * 2 + 1] = r[i]; }
            ok = slurAacWrite (aac, inter.data(), n) && ok;
            return;
        }
        if (! dither) { ok = writer->writeFromAudioSampleBuffer (b, start, n) && ok; return; }
        dBuf.setSize (2, n, false, false, true);
        for (int c = 0; c < 2; ++c)
        {
            const float* s = b.getReadPointer (c) + start; float* d = dBuf.getWritePointer (c);
            for (int i = 0; i < n; ++i) d[i] = s[i] + (rng.nextFloat() - rng.nextFloat()) / 32768.0f;       // a triangle of noise, one step wide
        }
        ok = writer->writeFromAudioSampleBuffer (dBuf, 0, n) && ok;
    }

    juce::File file, tmp, lame;
    int kbps = 320;
    String fmt;
    int bits = 24;
    double rate = 48000.0, from = 48000.0;
    bool ok = true;
    juce::int64 totalIn = 0, wrote = 0;
    std::unique_ptr<juce::AudioFormatWriter> writer;
    void* aac = nullptr;
    void* src = nullptr;                          // the converter to another rate (none: the song's own rate)
    std::vector<float> inter, srcIn, srcOut;
    juce::AudioBuffer<float> rsBuf, dBuf;
    juce::Random rng { 20261006 };
};

/** One file a print makes: its kind, rate and depth (an mp3: its kbps), and, when it makes several at once (his ask,
    2026-10-21: rates, kinds and depths chosen together, one pass printed and every file made from it), how this one is
    told from the others: `tag` after the mix's name, `sub` the folder of its own that a set of stems goes into. */
struct PrintOut { String fmt { "wav" }; double rate = 0.0; int bits = 24, kbps = 320; String tag, sub; };

/** The files asked for: `outs` [{fmt, rate, bits, kbps, tag, sub}], or the one that fmt, rate, bits and kbps say. A bounce
    in place is one wav at the song's rate. */
static std::vector<PrintOut> printOuts (const juce::var& opts, bool place, double sr)
{
    std::vector<PrintOut> outs;
    auto one = [&] (const juce::var& v)
    {
        PrintOut o;
        o.fmt = place ? String ("wav") : v["fmt"].toString();
        if (o.fmt.isEmpty()) o.fmt = "wav";
        o.rate = place || (double) v["rate"] < 8000.0 ? sr : (double) v["rate"];
        o.bits = place ? 24 : ((int) v["bits"] > 0 ? (int) v["bits"] : 24);
        o.kbps = v.hasProperty ("kbps") ? (int) v["kbps"] : 320;
        if (! place) { o.tag = v["tag"].toString(); o.sub = v["sub"].toString(); }
        outs.push_back (o);
    };
    if (auto* a = opts["outs"].getArray(); a != nullptr && ! a->isEmpty() && ! place) for (auto& v : *a) one (v);
    else one (opts);
    return outs;
}

/** Where one of a print's files goes: the mix's beside the others in `dir`, its tag after its name; a stem under its own
    name, in its kind's folder */
static juce::File printFileOf (const juce::File& dir, const String& name, const PrintOut& o, bool mix)
{
    if (mix) return dir.getChildFile (juce::File::createLegalFileName (name + o.tag) + "." + o.fmt);
    const auto in = o.sub.isNotEmpty() ? dir.getChildFile (juce::File::createLegalFileName (o.sub)) : dir;
    return in.getChildFile (juce::File::createLegalFileName (name) + "." + o.fmt);
}

//==============================================================================
/** For the app's own check: a plug-in with a second input and one control, as plain as one can be. Its sound goes through
    whole while that input is silent and at a quarter while anything sounds there; the control (level) scales it. */
struct DuckTest final : juce::AudioPluginInstance
{
    DuckTest() : AudioPluginInstance (BusesProperties().withInput ("in", juce::AudioChannelSet::stereo()).withOutput ("out", juce::AudioChannelSet::stereo()).withInput ("key", juce::AudioChannelSet::stereo(), false))
    {
        auto p = std::make_unique<Level>();
        level = p.get();
        addHostedParameter (std::move (p));
    }
    /** Its one control: how much of its sound it lets through. */
    struct Level final : HostedParameter
    {
        std::atomic<float> v { 1.0f };
        float getValue() const override { return v.load(); }
        void setValue (float x) override { v.store (x); }
        float getDefaultValue() const override { return 1.0f; }
        String getName (int) const override { return "level"; }
        String getLabel() const override { return {}; }
        float getValueForText (const String& text) const override { return text.getFloatValue(); }
        String getParameterID() const override { return "level"; }
    };
    Level* level = nullptr;
    const String getName() const override { return "duck test"; }
    void prepareToPlay (double, int) override {}
    void releaseResources() override {}
    bool isBusesLayoutSupported (const BusesLayout& l) const override
    {
        const auto stereo = juce::AudioChannelSet::stereo();
        return l.getMainInputChannelSet() == stereo && l.getMainOutputChannelSet() == stereo && (l.inputBuses.size() < 2 || l.inputBuses[1].isDisabled() || l.inputBuses[1] == stereo);
    }
    void processBlock (juce::AudioBuffer<float>& b, juce::MidiBuffer&) override
    {
        const int n = b.getNumSamples();
        float heard = 0.0f;
        for (int c = 2; c < getTotalNumInputChannels() && c < b.getNumChannels(); ++c) heard = juce::jmax (heard, b.getMagnitude (c, 0, n));
        const float g = (heard > 0.001f ? 0.25f : 1.0f) * level->v.load();
        for (int c = 0; c < 2 && c < b.getNumChannels(); ++c) b.applyGain (c, 0, n, g);
    }
    double getTailLengthSeconds() const override { return 0.0; }
    bool acceptsMidi() const override { return false; }
    bool producesMidi() const override { return false; }
    juce::AudioProcessorEditor* createEditor() override { return nullptr; }
    bool hasEditor() const override { return false; }
    int getNumPrograms() override { return 1; }
    int getCurrentProgram() override { return 0; }
    void setCurrentProgram (int) override {}
    const String getProgramName (int) override { return {}; }
    void changeProgramName (int, const String&) override {}
    void getStateInformation (juce::MemoryBlock&) override {}
    void setStateInformation (const void*, int) override {}
    void fillInPluginDescription (juce::PluginDescription& d) const override { d.name = "duck test"; d.pluginFormatName = "test"; }
};

class Engine final : public juce::AudioIODeviceCallback, public juce::MidiInputCallback
{
public:
    Engine()
    {
        fm.addDefaultFormats();
        afm.registerBasicFormats();
        /* an mp3 is made by LAME, a program of its own that travels inside the app (Contents/Helpers: build.sh lays it there);
           a build without it uses one the Mac has, when it has one */
        lame = juce::File::getSpecialLocation (juce::File::currentApplicationFile).getChildFile ("Contents/Helpers/lame");
        if (! lame.existsAsFile()) for (auto* p : { "/opt/homebrew/bin/lame", "/usr/local/bin/lame" }) if (juce::File (p).existsAsFile()) { lame = juce::File (p); break; }
        if (! juce::JUCEApplicationBase::getCommandLineParameters().contains ("--selftest")) tidySound();
    }
    ~Engine() override
    {
        here->store (false);
        { const std::lock_guard<std::mutex> lk (warmMx); warmQuit = true; }   // the read-ahead's thread goes first (it holds sounds of its own while it asks for them)
        warmCv.notify_all();
        if (warmThread.joinable()) warmThread.join();
        leaving.store (true);                                          // a print that is under way gives up at its next block, takes away the file it was writing, and is waited for: nothing is taken from under it
        if (printThread.joinable())
        {
            /*  One that has not come back after twenty seconds, with a thread inside one and the same call of a plug-in all
                that time, is in a plug-in that will not return. Nothing can be taken from under it, and the app is not
                left hanging open for it: the same note a crash leaves says which plug-in it is in (the next start names
                it and leaves it out), the half-made file goes, and the app goes as it stands.                          */
            while (printing.load())
            {
                juce::uint32 calls0[32]; int uid0[32];
                for (int i = 0; i < 32; ++i) { calls0[i] = nowPlaying[i].calls.load(); uid0[i] = nowPlaying[i].uid.load(); }
                for (int i = 0; i < 2000 && printing.load(); ++i) juce::Thread::sleep (10);
                if (! printing.load()) break;
                bool inside = false;                                   // somebody has been in one and the same call of a plug-in all that time
                for (int i = 0; i < 32; ++i) if (uid0[i] != 0 && nowPlaying[i].uid.load() == uid0[i] && nowPlaying[i].calls.load() == calls0[i]) inside = true;
                if (! inside) continue;                                // (nobody: the print is only long at something that cannot be broken off — a great sound being written out — and is waited for)
                logLine ("quit: the print did not come back; the app goes without it");
                {
                    const juce::ScopedLock sl (printFileLock);         // what it was writing is half a file: no file
                    for (auto& f : printFiles) f.deleteFile();
                    for (auto& f : printFiles) f.getParentDirectory().deleteFile();      // (the folder too, if that leaves it empty: an empty one is all that call takes away)
                    for (auto& f : printFiles) f.getParentDirectory().getParentDirectory().deleteFile();      // (and the one around it, for stems in folders of their own)
                }
                stuckNote ((juce::uint64) (size_t) printThread.native_handle());
                ::_exit (1);
            }
            printThread.join();
        }
        keysWatch.reset();
        dm.removeMidiInputDeviceCallback ({}, this);
        dm.removeAudioCallback (this);
        dm.closeAudioDevice();
        recThread.stopThread (2000);
        const juce::ScopedLock sl (lock);
        recs.clear();
        for (auto& t : tracks) t->eachPlug ([] (Insert& i) { i.shut(); i.letGo(); });
        tracks.clear();
        if (learnTrack != nullptr) learnTrack->eachPlug ([] (Insert& i) { i.shut(); i.letGo(); });
        learnTrack.reset();
    }

    /** `saved`: the device setup as it was left last time (see deviceState). */
    String start (const juce::XmlElement* saved = nullptr)
    {
        const auto err = dm.initialise (0, 2, saved, true);
        if (auto* d = dm.getCurrentAudioDevice())
        {
            if (const double r = d->getCurrentSampleRate(); r >= 8000.0) sr = r;      // (one that cannot say its rate: the engine keeps its own until the device says one)
            if (const int b = d->getCurrentBufferSizeSamples(); b > 0) block = b;
        }
        maxBlock = juce::jmax (1024, block);
        mix.setSize (2, maxBlock);
        clk.setSize (1, maxBlock);
        testBuf.assign (16384, 0.0f);
        silence.assign (16384, 0.0f);
        limRel = 1.0f - std::exp (-1.0f / (0.12f * (float) sr));
        recThread.startThread();
        liveLog.assign ((size_t) 1 << 15, Played());
        liveBlock.ensureSize (16384);
        keys.reset (sr);
        dm.addMidiInputDeviceCallback ({}, this);
        pool.start (handsWanted >= 0 ? handsWanted : autoHands(), dm.getCurrentAudioDevice() != nullptr ? dm.getCurrentAudioDevice()->getWorkgroup() : juce::AudioWorkgroup(), block, sr);
        dm.addAudioCallback (this);
        if (auto* d = dm.getCurrentAudioDevice()) inputOn.store (d->getActiveInputChannels().countNumberOfSetBits() > 0);
        logLine ("engine: sr " + String (sr) + " block " + String (block) + ", " + String (pool.size() + 1) + " threads" + (err.isNotEmpty() ? "  device error: " + err : String()));
        return err;
    }

    /** How many threads share a block's work: the device's own and `n` more (-1: as many as the machine's fast cores allow). Message thread. */
    void setHands (int n)
    {
        if (bouncing.load()) return;
        handsWanted = n;
        const juce::ScopedLock sl (lock);                              // no block is being worked while the hands change
        pool.start (n >= 0 ? juce::jmin (n, 15) : autoHands(), dm.getCurrentAudioDevice() != nullptr ? dm.getCurrentAudioDevice()->getWorkgroup() : juce::AudioWorkgroup(), block, sr);
        logLine ("engine: " + String (pool.size() + 1) + " threads");
    }
    int hands() const { return pool.size(); }
    /** One hand for every fast core but the one the device's own thread is on (a Mac with fast and slow cores says how many are fast). */
    static int autoHands()
    {
        int fast = 0; size_t len = sizeof (fast);
        if (sysctlbyname ("hw.perflevel0.physicalcpu", &fast, &len, nullptr, 0) != 0 || fast <= 0) fast = juce::SystemStats::getNumPhysicalCpus();
        return juce::jlimit (0, 7, fast - 1);
    }

    //── the session, as the page tells it ─────────────────────────────────────
    String setBuffer (const String& key, juce::AudioBuffer<float>&& data)
    {
        auto nb = std::make_shared<Buf>();
        nb->data = std::move (data);
        std::shared_ptr<Buf> gone;                                     // (what the key held before is let go of once the lock is: freeing a long sound takes a moment)
        {
            const juce::ScopedLock sl (lock);
            if (auto it = bufIndex.find (key); it != bufIndex.end()) { gone = std::move (bufs[(size_t) it->second]); bufs[(size_t) it->second] = nb; }
            else { bufIndex[key] = (int) bufs.size(); bufs.push_back (nb); }
        }
        return key;
    }
    /** Let go of the sound a key holds (the key stays, empty, so nothing that points at it breaks). */
    void dropBuffer (const String& key)
    {
        auto empty = std::make_shared<Buf>();
        std::shared_ptr<Buf> gone;
        {
            const juce::ScopedLock sl (lock);
            if (auto it = bufIndex.find (key); it != bufIndex.end()) { gone = std::move (bufs[(size_t) it->second]); bufs[(size_t) it->second] = std::move (empty); }
        }
    }
    std::shared_ptr<Buf> buffer (const String& key)
    {
        const juce::ScopedLock sl (lock);
        if (auto it = bufIndex.find (key); it != bufIndex.end()) return bufs[(size_t) it->second];
        return {};
    }
    /** The reference: its sound (a key the page brought in; empty: none), the bar its region begins on (from 0), its level,
        and whether it is the one heard; and, since its regions can be edited as a track's are (his ask, 2026-10-22), the
        pieces it is played as: each [a, b, off, gain, fadeIn, fadeOut, muted] — where it lies (bars from 0), where in the
        file it begins (bars), its gain (as a factor), its fades (bars). None given: the file whole, from `startBar`. */
    struct RefPiece { double a = 0, b = 0, off = 0, fi = 0, fo = 0; float g = 1.0f; bool mute = false; };
    void setRef (const String& key, double startBar, float vol, bool on, const juce::var& pieces = juce::var())
    {
        auto b = key.isNotEmpty() ? buffer (key) : std::shared_ptr<Buf>();
        auto ps = std::make_shared<std::vector<RefPiece>>();
        if (auto* list = pieces.getArray())
            for (auto& v : *list)
                if (auto* q = v.getArray(); q != nullptr && q->size() >= 7)
                {
                    RefPiece p; p.a = (double) (*q)[0]; p.b = (double) (*q)[1]; p.off = (double) (*q)[2]; p.g = (float) (double) (*q)[3]; p.fi = (double) (*q)[4]; p.fo = (double) (*q)[5]; p.mute = (int) (*q)[6] != 0;
                    if (p.b > p.a) ps->push_back (p);
                }
        std::sort (ps->begin(), ps->end(), [] (const RefPiece& x, const RefPiece& y) { return x.a < y.a; });
        std::shared_ptr<Buf> gone; std::shared_ptr<const std::vector<RefPiece>> was;
        { const juce::ScopedLock sl (lock); gone = std::move (refBuf); refBuf = b; refStartBar = startBar; was = std::move (refPieces); refPieces = pieces.isArray() ? ps : nullptr; }
        refVol.store (vol); refOn.store (on && b != nullptr && b->data.getNumSamples() > 0);
    }

    /** The session, as the page tells it. A track the page marks `same` keeps the regions, lines and wiring it was last
        told (they are numbered: `ver`); one the engine does not hold in that telling is asked for again (the answer says
        so). Everything is read out of the message before the lock is taken: under it only pointers change hands, so a
        block is hardly ever played as silence because the song was being edited while it ran.
        -> {ok, again}: ok false = nothing was taken (a print is under way); again = send everything once more */
    juce::var setSession (const juce::var& v)
    {
        auto* res = new juce::DynamicObject();
        juce::var result (res);
        res->setProperty ("ok", false);
        if (bouncing.load()) return result;
        struct Told { int id = 0, ver = -1, kind = 0, outId = 0, sendTo[kMaxSends] {}; float sendGain[kMaxSends] {}; bool same = false, notes = false; std::vector<Region> regs; std::vector<Auto> autos; std::vector<NoteEv> evs; };
        std::vector<Told> told;
        std::map<int, std::unique_ptr<Track>> fresh;
        bool again = false;
        if (auto* arr = v["tracks"].getArray())
        {
            told.reserve ((size_t) arr->size());
            for (auto& tv : *arr)
            {
                Told t;
                t.id = (int) tv["id"]; t.ver = tv.hasProperty ("ver") ? (int) tv["ver"] : -1; t.same = (int) tv["same"] != 0;
                auto* have = find (t.id);
                if (t.same && (have == nullptr || have->ver != t.ver)) { again = true; if (have == nullptr) continue; }     // it is not held in that telling: kept as it is for now, and asked for again
                if (have == nullptr && fresh.count (t.id) == 0)
                {
                    auto nt = std::make_unique<Track>();                     // tracks that are new are made before anything is locked
                    nt->id = t.id; nt->work.setSize (2, maxBlock); nt->sideBuf.setSize (2, maxBlock); nt->share = -1.0f;
                    nt->now.reserve (2048); nt->plugMidi.ensureSize (16384);
                    fresh[t.id] = std::move (nt);
                }
                if (! t.same)
                {
                    t.kind = (int) tv["kind"]; t.outId = (int) tv["out"];
                    if (auto* sd = tv["sends"].getArray())
                        for (int k = 0; k < juce::jmin (kMaxSends, sd->size()); ++k) { t.sendTo[k] = (int) (*sd)[k]["to"]; t.sendGain[k] = (float) (double) (*sd)[k]["gain"]; }
                    if (auto* rg = tv["regs"].getArray())
                    {
                        t.regs.reserve ((size_t) rg->size());
                        for (auto& rv : *rg)
                        {
                            Region r;
                            r.a = (double) rv["a"]; r.b = (double) rv["b"];
                            r.loop = (int) rv["loop"] != 0;
                            r.rate = juce::jlimit (0.25, 4.0, (double) rv["rate"]);
                            r.loopBars = juce::jmax (1.0, (double) rv["bars"]);
                            r.off = (double) rv["off"];
                            r.gain = rv.hasProperty ("gain") ? (float) (double) rv["gain"] : 1.0f;
                            r.fi = juce::jmax (0.0, (double) rv["fi"]); r.fo = juce::jmax (0.0, (double) rv["fo"]);
                            r.fic = juce::jlimit (0, 2, (int) rv["fic"]); r.foc = juce::jlimit (0, 2, (int) rv["foc"]); r.fib = juce::jlimit (-1.0f, 1.0f, (float) (double) rv["fib"]); r.fob = juce::jlimit (-1.0f, 1.0f, (float) (double) rv["fob"]);
                            if (auto it = bufIndex.find (rv["buf"].toString()); it != bufIndex.end()) r.buf = it->second;      // (only this thread ever adds a key while no print runs)
                            if (r.buf >= 0 && r.b > r.a) t.regs.push_back (r);
                        }
                    }
                    if (auto* au = tv["autos"].getArray())
                        for (auto& av : *au)
                        {
                            Auto a;
                            a.param = (int) av["p"];
                            if (a.param == kAutoPlug) { a.uid = (int) av["uid"]; a.index = (int) av["i"]; }
                            if (a.param == kAutoPrint) { a.node = (int) av["node"]; a.field = (int) av["field"]; if (auto* tb = av["table"].getArray()) for (auto& x : *tb) a.table.push_back ((float) (double) x); }
                            if (auto* pts = av["pts"].getArray()) for (auto& p : *pts) a.pts.push_back ({ (double) p[0], (float) (double) p[1] });
                            if (((a.param >= 0 && a.param < kAutoCount) || (a.param == kAutoPlug && a.uid != 0 && a.index >= 0) || (a.param == kAutoPrint && a.node >= 0 && a.node < orbfx::kMaxNodes && a.table.size() >= 2)) && ! a.pts.empty()) t.autos.push_back (std::move (a));
                        }
                    /*  A track of notes: every note as [where it begins, where it ends, its key, how hard] and every
                        other thing played as [where, status, first byte, second byte] — both lists flat, places in bars
                        from zero, already as they sound (the page has worked out regions, repeats and timing).       */
                    t.notes = (int) tv["inst"] != 0;
                    if (auto* nv = tv["notes"].getArray())
                    {
                        t.evs.reserve ((size_t) nv->size() / 2 + 8);
                        for (int k = 0; k + 3 < nv->size(); k += 4)
                        {
                            const double a = (double) (*nv)[k], b = (double) (*nv)[k + 1];
                            if (! (b > a) || b <= 0.0) continue;
                            const auto key = (juce::uint8) juce::jlimit (0, 127, (int) (*nv)[k + 2]), vel = (juce::uint8) juce::jlimit (1, 127, (int) (*nv)[k + 3]);
                            t.evs.push_back ({ juce::jmax (0.0, a), 0x90, key, vel, 2 });
                            t.evs.push_back ({ b, 0x80, key, 0, 0 });
                        }
                    }
                    if (auto* cv = tv["ctl"].getArray())
                        for (int k = 0; k + 3 < cv->size(); k += 4)
                            t.evs.push_back ({ juce::jmax (0.0, (double) (*cv)[k]), (juce::uint8) ((int) (*cv)[k + 1] & 255), (juce::uint8) ((int) (*cv)[k + 2] & 127), (juce::uint8) ((int) (*cv)[k + 3] & 127), 1 });
                    std::stable_sort (t.evs.begin(), t.evs.end(), [] (const NoteEv& x, const NoteEv& y) { return x.bar < y.bar || (x.bar == y.bar && x.order < y.order); });
                }
                told.push_back (std::move (t));
            }
        }
        std::vector<std::unique_ptr<Track>> next, old;
        next.reserve (told.size());
        {
            const juce::ScopedLock sl (lock);
            tempo.store (juce::jlimit (40.0, 240.0, (double) v["tempo"]));
            if (v["meter"].isArray() && v["meter"].size() == 2)
            {
                const int b = juce::jlimit (1, 32, (int) v["meter"][0]), u = (int) v["meter"][1];
                beats.store (b); unit.store (u == 2 || u == 4 || u == 8 || u == 16 ? u : 4);
                playHead.beats.store (beats.load()); playHead.unit.store (unit.load());
            }
            songEnd = (double) v["end"];
            for (auto& in : told)
            {
                std::unique_ptr<Track> t;
                for (auto& have : tracks) if (have != nullptr && have->id == in.id) { t = std::move (have); break; }
                if (t == nullptr) { if (auto it = fresh.find (in.id); it != fresh.end()) t = std::move (it->second); }
                if (t == nullptr) continue;
                if (! in.same)
                {
                    t->kind = in.kind; t->outId = in.outId; t->ver = in.ver;
                    for (int k = 0; k < kMaxSends; ++k)
                    {
                        if (in.sendTo[k] != t->sends[k].to) t->sends[k].sm = 0.0f;
                        t->sends[k].to = in.sendTo[k]; t->sends[k].dst = nullptr;
                        if (in.sendTo[k] != 0) t->sends[k].gain.store (in.sendGain[k]);
                    }
                    t->regs.swap (in.regs); t->autos.swap (in.autos);       // what it held goes back with the message, and is let go of once the lock is
                    t->notes = in.notes; t->evs.swap (in.evs); t->stale.store (true);
                }
                next.push_back (std::move (t));
            }
            old.swap (tracks);
            tracks.swap (next);
            wire();
        }
        if (auto* arr = v["tracks"].getArray()) for (auto& tv : *arr) setTrack (tv);
        if (v.hasProperty ("master")) master.store ((float) (double) v["master"]);
        measureLatency();
        for (auto& t : old) if (t != nullptr) t->eachPlug ([] (Insert& i) { i.shut(); i.letGo(); });
        res->setProperty ("ok", true); res->setProperty ("again", again);
        return result;
    }

    void setTrack (const juce::var& tv)
    {
        auto* t = find ((int) tv["id"]);
        if (t == nullptr) return;
        t->vol.store ((float) (double) tv["vol"]);
        t->gate.store ((int) tv["on"] != 0 ? 1.0f : 0.0f);
        t->pan.store (juce::jlimit (-1.0f, 1.0f, (float) (double) tv["pan"]));
        t->tape.store (juce::jlimit (0.0f, 1.0f, (float) (double) tv["tape"]));
        t->space.store (juce::jlimit (0.0f, 1.0f, (float) (double) tv["space"]));
        t->delay.store (juce::jlimit (0.0f, 1.0f, (float) (double) tv["delay"]));
        t->mon.store ((int) tv["mon"] != 0);
        t->dead.store ((int) tv["dead"] != 0);
        t->frozen.store ((int) tv["frozen"] != 0);
        t->input.store ((int) tv["input"]);
        t->live.store ((int) tv["live"] != 0);
        if (auto* sd = tv["sends"].getArray()) for (int k = 0; k < juce::jmin (kMaxSends, sd->size()); ++k) t->sends[k].gain.store ((float) (double) (*sd)[k]["gain"]);
        const float sh = juce::jlimit (0.0f, 1.0f, (float) (double) tv["share"]);
        const bool wanted = (bool) tv["patched"] || t->tape.load() + t->space.load() + t->delay.load() > 0.0005f;
        if (t->wall || (bool) tv["wall"]) {}                           // (its patch is a wall: setWall makes and compiles its chain)
        else if (t->chain == nullptr && wanted && ! bouncing.load())
        {
            auto c = std::make_unique<orbfx::Chain>();
            c->prepare (sr, maxBlock, kPatchSlots);
            t->share = sh;
            compilePatch (*c, sh);
            const juce::ScopedLock sl (lock);
            t->chain = std::move (c);
        }
        else if (t->chain != nullptr && std::abs (sh - t->share) > 0.004f) { t->share = sh; compilePatch (*t->chain, sh); }
    }

    //── time ──────────────────────────────────────────────────────────────────
    void play (double bar) { if (! bouncing.load()) warmFrom (bar, 0.6, true); seekTo.store (bar); queued.store (-1.0); seg.fetch_add (1); playing.store (true); }
    void stop()            { playing.store (false); queued.store (-1.0); seg.fetch_add (1); }
    void seek (double bar) { if (playing.load() && ! bouncing.load()) warmFrom (bar, 0.6, true); seekTo.store (bar); if (! playing.load()) posBars.store (bar); }

    std::atomic<bool>   playing { false }, loop { false }, mute { false }, click { false }, recording { false };
    std::atomic<double> posBars { 0.0 }, queued { -1.0 }, tempo { 92.0 }, loopA { 0.0 }, loopB { 0.0 };
    std::atomic<int> beats { 4 }, unit { 4 };          // the measure (see PlayHead)
    std::atomic<float>  master { 1.0f };
    std::atomic<float>  printPart { 0.0f };       // how much of the file being printed is done, 0 to 1 (for the page's bar)
    std::atomic<int>    jumps { 0 };
    std::atomic<bool>   bouncing { false }, inputOn { false };
    bool quiet = false;                       // the self-test: no folders popping open
    bool testInput = false;                   // the self-test: a tone stands in for the microphone
    /*  Audio units opened by the app itself (host/Au.mm) and not through the library: off unless asked for (the setting
        `ownAu`, or --own-au), and then `auApart` (--au-apart) opens each in a process of its own. */
    bool ownAu = false, auApart = false;
    double sr = 48000.0;
    int    block = 512, maxBlock = 1024;
    juce::File lame;                          // an mp3 needs this to be on the machine
    std::function<void()> onRateChanged;      // the device moved to another rate and the engine followed: every buffer has to come again
    std::function<void (bool)> onTakeStalled; // nothing more is recorded of the take that is running: the device moved to another rate (true), or stopped under it
    std::function<void (const String&, double, double, bool)> onSoundCut;      // a file was too long to hold in memory and the disk had no room to keep it ready: its name, the seconds held, the seconds it has

    /** Peaks since the last call: the out (left, right), the input, and each track after its fader. */
    juce::var takeMeters()
    {
        auto* o = new juce::DynamicObject();
        juce::Array<juce::var> m, t;
        m.add (meterL.exchange (0.0f)); m.add (meterR.exchange (0.0f));
        if (++latencyTick % 20 == 0 && ! bouncing.load()) measureLatency();
        for (auto& tp : tracks) { t.add (tp->id); t.add (juce::roundToInt (tp->peak.exchange (0.0f) * 1000.0f) / 1000.0); }
        juce::Array<juce::var> st;                                     // each track's two sides on their own: [id, left, right, …] (the mixer's meters)
        for (auto& tp : tracks) { st.add (tp->id); st.add (juce::roundToInt (tp->peakL.exchange (0.0f) * 1000.0f) / 1000.0); st.add (juce::roundToInt (tp->peakR.exchange (0.0f) * 1000.0f) / 1000.0); }
        o->setProperty ("s", st);
        if (fineOn.load())                                             // a realtime print: each track's peaks since the last call, two hundred a second, with their places (bars)
        {
            juce::Array<juce::var> f;
            for (auto& tp : tracks)
            {
                const int w = tp->fineW.load (std::memory_order_acquire);
                juce::Array<juce::var> one; one.add (tp->id);
                for (int k = juce::jmax (tp->fineR, w - Track::kFine + 1); k < w; ++k) { one.add (juce::roundToInt (tp->fineBar[k % Track::kFine] * 10000.0f) / 10000.0); one.add (juce::roundToInt (tp->finePk[k % Track::kFine] * 1000.0f) / 1000.0); }
                tp->fineR = w;
                if (one.size() > 1) f.add (one);
            }
            o->setProperty ("f", f);
        }
        o->setProperty ("m", m); o->setProperty ("i", inPeak.exchange (0.0f)); o->setProperty ("t", t);
        return juce::var (o);
    }
    /** What the engine cost since the last call: how many blocks the device asked for, how much of each block's time the
        work took (mean and worst), how many took longer than the block lasts (the sound broke up), and how many were
        played as silence because the message thread had the session in its hands. */
    juce::var takePerf()
    {
        auto* o = new juce::DynamicObject();
        const int n = perfCalls.exchange (0);
        o->setProperty ("blocks", n);
        o->setProperty ("load", n > 0 ? perfSum.exchange (0.0) / (double) n : 0.0);
        o->setProperty ("worst", (double) perfMax.exchange (0.0f));
        o->setProperty ("over", perfOver.exchange (0));
        o->setProperty ("held", perfHeld.exchange (0));
        o->setProperty ("clicks", clicksBegun.exchange (0)); o->setProperty ("accents", accentsBegun.exchange (0));      // the click's beats begun since the last asking, and how many of them were a bar's first
        if (auto* d = dm.getCurrentAudioDevice()) { const int x = d->getXRunCount(); o->setProperty ("xruns", x < 0 ? -1 : juce::jmax (0, x - lastXruns)); lastXruns = juce::jmax (0, x); }      // what the device itself says it could not keep up with (-1: it does not say)
        o->setProperty ("block", block); o->setProperty ("sr", sr);
        o->setProperty ("threads", pool.size() + 1); o->setProperty ("shared", shared.exchange (0));
        {                                                              // how many tracks are resting now, and how many blocks each has rested since the last asking
            int resting = 0; juce::Array<juce::var> rests;
            for (auto& tp : tracks) { const int r = tp->rested.exchange (0); if (r > 0) ++resting; auto* q = new juce::DynamicObject(); q->setProperty ("id", tp->id); q->setProperty ("rested", r); q->setProperty ("after", tp->sleepAfter.load()); q->setProperty ("key", tp->keyFor || tp->keyed); q->setProperty ("plugs", (int) tp->inserts.size()); q->setProperty ("stillOut", (double) tp->stillOut.exchange (0.0f)); q->setProperty ("quiet", tp->quiet); rests.add (juce::var (q)); }
            o->setProperty ("resting", resting); o->setProperty ("rests", rests); o->setProperty ("restOn", restOn.load());
        }
        if (n == 0) perfSum.store (0.0);
        return juce::var (o);
    }
    /** The check: the device is asked for another block (0: only say what it has). -> {ok, block, sizes: […], name, error?} */
    juce::var testBlock (int n)
    {
        auto* o = new juce::DynamicObject();
        juce::var result (o);
        auto* d = dm.getCurrentAudioDevice();
        if (d == nullptr) { o->setProperty ("ok", false); return result; }
        juce::Array<juce::var> sizes;
        for (auto s : d->getAvailableBufferSizes()) sizes.add (s);
        o->setProperty ("sizes", sizes);
        if (n > 0)
        {
            auto setup = dm.getAudioDeviceSetup();
            setup.bufferSize = n;
            const auto err = dm.setAudioDeviceSetup (setup, true);
            if (err.isNotEmpty()) o->setProperty ("error", err);
        }
        if (auto* now = dm.getCurrentAudioDevice())
        {
            block = now->getCurrentBufferSizeSamples();
            o->setProperty ("block", block); o->setProperty ("name", now->getName()); o->setProperty ("outLatency", now->getOutputLatencyInSamples()); o->setProperty ("inLatency", now->getInputLatencyInSamples());
        }
        o->setProperty ("ok", true);
        return result;
    }
    /** RMS and peak of what went to the speakers since the last call (the self-test's ear). */
    std::pair<float, float> takeMeter()
    {
        const double sq = meterSq.exchange (0.0); const int n = meterN.exchange (0); const float pk = meterPk.exchange (0.0f);
        return { n > 0 ? (float) std::sqrt (sq / (double) n) : 0.0f, pk };
    }

    //── the way in ────────────────────────────────────────────────────────────
    std::unique_ptr<juce::XmlElement> deviceState() { return dm.createStateXml(); }
    /** For the settings window: what comes in just now (the room's own meter empties it thirty times a second), how many
        hands were asked for (-1: as many as the machine allows), and whether a take or a print is under way. */
    float inputNow() const { return inPeak.load(); }
    int handsAsked() const { return handsWanted; }
    bool busy() const { return bouncing.load() || recording.load() || livePhase.load() != 0; }
    juce::AudioDeviceManager& devices() { return dm; }
    int inputCount() { if (testInput) return 2; if (auto* d = dm.getCurrentAudioDevice()) return d->getActiveInputChannels().countNumberOfSetBits(); return 0; }

    /** Open the input the first time a track asks to hear or record it. Empty when it is open. */
    String enableInput()
    {
        if (testInput || inputOn.load()) return {};
        auto setup = dm.getAudioDeviceSetup();
        if (setup.inputDeviceName.isEmpty())
            if (auto* type = dm.getCurrentDeviceTypeObject())
            {
                const auto names = type->getDeviceNames (true);
                const int def = type->getDefaultDeviceIndex (true);
                if (def >= 0 && def < names.size()) setup.inputDeviceName = names[def];
            }
        if (setup.inputDeviceName.isEmpty()) return "no input device";
        setup.useDefaultInputChannels = false;
        setup.inputChannels.clear();
        setup.inputChannels.setRange (0, kMaxIn, true);
        setup.sampleRate = sr;
        const auto err = dm.setAudioDeviceSetup (setup, true);
        if (err.isNotEmpty()) { logLine ("input would not open: " + err); return err; }
        int ins = 0;
        if (auto* d = dm.getCurrentAudioDevice()) ins = d->getActiveInputChannels().countNumberOfSetBits();
        inputOn.store (ins > 0);
        logLine ("input: " + setup.inputDeviceName + ", " + String (ins) + " channels");
        return ins > 0 ? String() : String ("the input has no channels");
    }

    /** Begin a take: `bar` is where the recording starts; the clock starts `countIn` bars earlier, with the click. */
    juce::var recStart (const juce::var& o)
    {
        auto* res = new juce::DynamicObject();
        juce::var result (res);
        res->setProperty ("ok", false);
        if (bouncing.load() || recording.load()) return result;
        const double bar = (double) o["bar"], count = juce::jmax (0.0, (double) o["countIn"]);
        const juce::File dir (o["dir"].toString());
        dir.createDirectory();
        bool sound = false;                                            // is anything to be written: a take of notes alone needs no room on the disk
        if (auto* list = o["tracks"].getArray()) for (auto& tv : *list) sound = sound || (int) tv["midi"] == 0;
        if (sound && dir.getBytesFreeOnVolume() < (juce::int64) 300 * 1024 * 1024) { res->setProperty ("error", "the disk is full"); return result; }      // (a take that cannot be written is a take lost: better not begun)
        std::vector<std::unique_ptr<Rec>> fresh;
        std::vector<int> noteTracks;                                   // the tracks of notes among them: nothing is written for those — what is played is kept as it comes (liveLog)
        juce::WavAudioFormat wav;
        if (auto* list = o["tracks"].getArray())
            for (auto& tv : *list)
            {
                auto* t = find ((int) tv["id"]);
                if (t == nullptr || t->kind != 0) continue;
                if ((int) tv["midi"] != 0) { noteTracks.push_back (t->id); continue; }
                auto r = std::make_unique<Rec>();
                r->trackId = t->id; r->input = t->input.load();
                r->file = dir.getNonexistentChildFile (juce::File::createLegalFileName (tv["name"].toString()), ".wav", false);
                std::unique_ptr<juce::OutputStream> os = r->file.createOutputStream();
                if (os == nullptr) continue;
                auto w = wav.createWriterFor (os, juce::AudioFormatWriterOptions{}.withSampleRate (sr).withNumChannels (r->input >= 100 ? 2 : 1).withBitsPerSample (24));
                if (w == nullptr) continue;
                r->tw = std::make_unique<juce::AudioFormatWriter::ThreadedWriter> (w.release(), recThread, 1 << 17);
                r->tw->setFlushInterval (juce::jmax (4096, (int) sr));           // every second the file on disk is whole up to there: a take is not lost with the app
                fresh.push_back (std::move (r));
            }
        if (fresh.empty() && noteTracks.empty()) return result;
        if (! fresh.empty())
        {
            auto* j = new juce::DynamicObject();
            juce::Array<juce::var> files;
            for (auto& r : fresh) { auto* f = new juce::DynamicObject(); f->setProperty ("track", r->trackId); f->setProperty ("file", r->file.getFileName()); files.add (juce::var (f)); }
            j->setProperty ("bar", bar); j->setProperty ("files", files); j->setProperty ("lat", (double) (inLat + outLat) / sr);
            takeNote = dir.getChildFile (".take.json");
            takeNote.replaceWithText (juce::JSON::toString (juce::var (j), true));      // what is being recorded, and where it belongs: for the next start, should this one not get to the end of the take
        }
        {
            const juce::ScopedLock sl (lock);
            recs.swap (fresh);
            recStartS = (juce::int64) std::llround (bar * barSamples());
            recNotes.swap (noteTracks); recLogFrom = logN;
        }
        takeBroken.store (false); takeWriting.store (false); lastBlockTick.store (0);      // (the hole that ends a take is one in the middle of it: whatever the device did before the take does not count)
        recording.store (true);
        play (bar - count);
        res->setProperty ("ok", true);
        logLine ("record: " + String ((int) recs.size()) + " tracks of sound, " + String ((int) recNotes.size()) + " of notes, from bar " + String (bar + 1.0));
        return result;
    }

    /** End the take (or throw it away). Every file comes back decoded, with where it belongs and how late the input runs. */
    juce::var recStop (bool keep)
    {
        juce::Array<juce::var> out;
        if (! recording.exchange (false)) return out;
        takeWriting.store (false);
        playing.store (false);
        takeNote.deleteFile();
        std::vector<std::unique_ptr<Rec>> done;
        std::vector<int> noteTracks;
        std::vector<Played> played;
        juce::int64 startS = 0;
        {
            const juce::ScopedLock sl (lock);
            done.swap (recs);
            startS = recStartS;
            noteTracks.swap (recNotes);
            if (! noteTracks.empty()) played = playedSince (recLogFrom);
        }
        const double barS = barSamples();
        if (keep)
            for (const int id : noteTracks)
            {
                /* what was played on the keys while the take ran, each thing at the place the player heard the song at
                   (a key struck a moment before the take's first bar is its first note) */
                auto* d = new juce::DynamicObject();
                juce::Array<juce::var> ev;
                const juce::int64 early = (juce::int64) (barS / 8.0);
                for (auto& p : played) if (p.rolling != 0 && p.songS >= startS - early) { ev.add ((double) juce::jmax (startS, p.songS) / barS); ev.add ((int) p.st); ev.add ((int) p.d1); ev.add ((int) p.d2); }
                d->setProperty ("ok", true); d->setProperty ("midi", true); d->setProperty ("track", id); d->setProperty ("bar", (double) startS / barS); d->setProperty ("ev", ev);
                out.add (juce::var (d));
            }
        for (auto& r : done)
        {
            r->tw.reset();                                           // writes what is still waiting, and closes the file
            if (! keep || r->got < (juce::int64) (sr * 0.05)) { r->file.deleteFile(); continue; }
            auto v = decodeFile (r->file);
            if (auto* d = v.getDynamicObject())
            {
                d->setProperty ("track", r->trackId);
                d->setProperty ("file", r->file.getFileName());
                d->setProperty ("name", r->file.getFileNameWithoutExtension());
                d->setProperty ("bar", (double) startS / barS);
                d->setProperty ("lat", (double) (inLat + outLat) / sr);
            }
            out.add (v);
        }
        logLine ("record: " + String (out.size()) + " takes kept");
        if (rateOff.load()) juce::MessageManager::callAsync ([this] { followDevice(); });      // the device moved to another rate during the take: it is followed now that the take is in
        return out;
    }

    /** What a run that ended badly was recording into this folder: each file made whole and decoded, with where it belongs
        — as recStop hands takes back. Empty when nothing was left. */
    juce::var takesLeft (const juce::File& dir)
    {
        juce::Array<juce::var> out;
        const auto note = dir.getChildFile (".take.json");
        if (! note.existsAsFile() || recording.load()) return out;
        const auto j = juce::JSON::parse (note);
        note.deleteFile();
        if (auto* files = j["files"].getArray())
            for (auto& fv : *files)
            {
                const auto file = dir.getChildFile (juce::File::createLegalFileName (fv["file"].toString()));       // (a name, never a way to somewhere else: what is not a take in this folder is not touched)
                if (! file.existsAsFile() || file.getParentDirectory() != dir) continue;
                mendWav (file);
                if (fileSeconds (file) < 0.05) { file.deleteFile(); continue; }
                auto v = decodeFile (file);
                if (auto* d = v.getDynamicObject())
                {
                    d->setProperty ("track", fv["track"]); d->setProperty ("file", file.getFileName()); d->setProperty ("name", file.getFileNameWithoutExtension());
                    d->setProperty ("bar", j["bar"]); d->setProperty ("lat", j["lat"]);
                }
                out.add (v);
            }
        logLine ("record: " + String (out.size()) + " takes brought back from a run that did not end");
        return out;
    }
    /** A wav whose writer never closed it: its head says the length it had when it was last made whole (or none at all).
        The lengths are written in from the size of the file itself. */
    static void mendWav (const juce::File& f)
    {
        juce::int64 size = 0, dataAt = -1; juce::uint32 dataLen = 0;
        {
            juce::FileInputStream in (f);
            if (! in.openedOk() || in.getTotalLength() < 44) return;
            size = in.getTotalLength();
            char id[4];
            if (in.read (id, 4) != 4 || std::memcmp (id, "RIFF", 4) != 0 || size > 0xfffffff0ll) return;
            in.setPosition (12);
            while (in.getPosition() + 8 <= size)
            {
                if (in.read (id, 4) != 4) break;
                const auto len = (juce::uint32) in.readInt();
                if (std::memcmp (id, "data", 4) == 0) { dataAt = in.getPosition(); dataLen = len; break; }
                in.setPosition (in.getPosition() + (juce::int64) len + (len & 1));
            }
        }
        if (dataAt < 0 || dataLen == (juce::uint32) (size - dataAt)) return;
        juce::FileOutputStream os (f);
        if (! os.openedOk()) return;
        if (os.setPosition (4)) os.writeInt ((int) (juce::uint32) (size - 8));
        if (os.setPosition (dataAt - 4)) os.writeInt ((int) (juce::uint32) (size - dataAt));
        os.flush();
    }

    //── plug-ins from outside ─────────────────────────────────────────────────
    juce::var listPlugins (std::function<String (const String&)> auMaker)
    {
        juce::Array<juce::var> out;
        juce::StringArray auNames;
        for (auto* f : fm.getFormats())
        {
            if (f->getName() == "AudioUnit")
            {
                for (auto& id : f->searchPathsForPlugins ({}, true, true))
                {
                    const auto type = id.fromFirstOccurrenceOf ("/", false, false).substring (0, 4);
                    if (type != "aufx" && type != "aumf" && type != "aumu") continue;
                    auto* o = new juce::DynamicObject();
                    o->setProperty ("inst", type == "aumu");
                    String name = f->getNameOfPluginFromIdentifier (id), maker = auMaker ? auMaker (id) : String();
                    if (maker.isEmpty() && name.contains (": ")) { maker = name.upToFirstOccurrenceOf (": ", false, false); name = name.fromFirstOccurrenceOf (": ", false, false); }
                    o->setProperty ("id", id); o->setProperty ("name", name); o->setProperty ("maker", maker); o->setProperty ("fmt", "au");
                    auNames.add (name.toLowerCase());
                    out.add (juce::var (o));
                }
            }
        }
        for (auto* f : fm.getFormats())
        {
            if (f->getName() != "VST3") continue;
            for (auto& path : f->searchPathsForPlugins (f->getDefaultLocationsToSearch(), true, false))
            {
                const auto name = juce::File (path).getFileNameWithoutExtension();
                if (auNames.contains (name.toLowerCase())) continue;      // the same plug-in is already listed as an AU
                auto* o = new juce::DynamicObject();
                o->setProperty ("id", path); o->setProperty ("name", name); o->setProperty ("maker", ""); o->setProperty ("fmt", "vst3");
                {
                    /* whether it is an instrument is read from the note of its contents that newer ones carry with them
                       (the plug-in itself is not opened for the list); one without such a note is listed as an effect */
                    juce::File info (juce::File (path).getChildFile ("Contents/Resources/moduleinfo.json"));
                    if (! info.existsAsFile()) info = juce::File (path).getChildFile ("Contents/moduleinfo.json");
                    const auto note = info.existsAsFile() && info.getSize() < (1 << 20) ? info.loadFileAsString() : String();
                    o->setProperty ("inst", note.contains ("\"Instrument\""));
                    /* what it says it is ("Fx", "Reverb"), where the note says: the page lays the list out by kind (ui/cats.js) */
                    const auto said = note.fromFirstOccurrenceOf ("\"Sub Categories\"", false, false).upToFirstOccurrenceOf ("]", false, false).fromFirstOccurrenceOf ("[", false, false).removeCharacters ("\"\r\n\t").trim();
                    if (said.isNotEmpty()) o->setProperty ("sub", said);
                    o->setProperty ("unsure", ! info.existsAsFile());      // (it carries no such note: what it is, is only known once it is opened — the page lets it be looked for by name in either list)
                }
                {
                    /* who made it, for the list by maker (settings > plug-ins): the note of its contents says, where it has one;
                       else the page names it from what its bundle says of itself — its id and its copyright (ui/cats.js plugMakers) */
                    juce::File info (juce::File (path).getChildFile ("Contents/Resources/moduleinfo.json"));
                    if (! info.existsAsFile()) info = juce::File (path).getChildFile ("Contents/moduleinfo.json");
                    const auto note = info.existsAsFile() && info.getSize() < (1 << 20) ? info.loadFileAsString() : String();
                    const auto vendor = note.fromFirstOccurrenceOf ("\"Vendor\"", false, false).fromFirstOccurrenceOf ("\"", false, false).upToFirstOccurrenceOf ("\"", false, false).trim();
                    if (vendor.isNotEmpty()) o->setProperty ("maker", vendor);
                    const juce::File plist (juce::File (path).getChildFile ("Contents/Info.plist"));
                    const auto pl = plist.existsAsFile() && plist.getSize() < (1 << 18) ? plist.loadFileAsString() : String();
                    auto says = [&pl] (const char* key) { return pl.fromFirstOccurrenceOf ("<key>" + String (key) + "</key>", false, false).fromFirstOccurrenceOf ("<string>", false, false).upToFirstOccurrenceOf ("</string>", false, false).replace ("&amp;", "&").trim(); };
                    o->setProperty ("bid", says ("CFBundleIdentifier"));
                    auto by = says ("NSHumanReadableCopyright");
                    if (by.isEmpty()) by = says ("CFBundleGetInfoString");
                    o->setProperty ("by", by);
                }
                out.add (juce::var (o));
            }
        }
        return out;
    }

    /** `at`: where among the track's plug-ins it goes (-1: after the last). */
    /** Where a VST3 lies on this Mac. A project keeps a VST3 by its path; on another Mac the same plug-in may lie in the
        user's own folder instead of the system's (or the other way round), under another user's name, or in a folder of
        its maker's: when the path is not there, it is looked for by its file's name in both plug-in folders. */
    static String vst3Where (const String& ident)
    {
        const juce::File f (ident);
        if (! ident.endsWithIgnoreCase (".vst3") || f.exists()) return ident;
        const auto name = f.getFileName();
        for (auto dir : { juce::File ("/Library/Audio/Plug-Ins/VST3"), juce::File::getSpecialLocation (juce::File::userHomeDirectory).getChildFile ("Library/Audio/Plug-Ins/VST3") })
        {
            if (dir.getChildFile (name).exists()) return dir.getChildFile (name).getFullPathName();
            for (const auto& e : juce::RangedDirectoryIterator (dir, true, "*.vst3", juce::File::findDirectories))      // (in a folder of its maker's, a level or two down)
                if (e.getFile().getFileName() == name) return e.getFile().getFullPathName();
        }
        return ident;
    }
    void insertPlugin (int trackId, const String& ident, const String& state, bool show, std::function<void (juce::var)> done, int at = -1, bool asInst = false)
    {
        auto fail = [done] (const String& why) { auto* o = new juce::DynamicObject(); o->setProperty ("ok", false); o->setProperty ("error", why); logLine ("insert failed: " + why); done (juce::var (o)); };
        if (bouncing.load()) { fail ("busy"); return; }
        if (ident == "test:duck")                                      // the check's own plug-in (it has a second input); nothing outside the check may ask for it
        {
            if (! testInput) { fail ("not here"); return; }
            placeInsert (trackId, done, fail, state, false, ident, at, std::make_unique<DuckTest>(), {}, false);
            return;
        }
        {
            auto* doing = new juce::DynamicObject();                   // should opening it bring the app down, the next start knows what was being opened — from before its file is so much as read: a VST3 is loaded to see what is in it, and that alone can do it
            doing->setProperty ("what", "opening"); doing->setProperty ("id", ident); doing->setProperty ("name", ident.startsWith ("AudioUnit:") ? String() : juce::File (ident).getFileNameWithoutExtension());
            Marker::set ("doing", juce::var (doing));
        }
        juce::PluginDescription d;
        if (ident.startsWith ("AudioUnit:"))
        {
            const bool instrument = ident.fromFirstOccurrenceOf ("/", false, false).substring (0, 4) == "aumu";      // (an audio unit says what it is in its name)
            if (instrument != asInst) { Marker::clear ("doing"); fail (asInst ? "an effect, not an instrument" : "an instrument, not an effect"); return; }
            const auto codes = juce::StringArray::fromTokens (ident.fromFirstOccurrenceOf ("/", false, false), ",", "");
            if (ownAu && codes.size() >= 3)                            // the app opens it itself, with the Mac's own calls (host/Au.mm), and not through the library
            {
                auto four = [] (const String& s) { uint32_t v = 0; for (int i = 0; i < 4; ++i) v = (v << 8) | (uint32_t) (i < s.length() ? (s[i] & 0xff) : ' '); return v; };
                logLine ("insert: " + ident + " on track " + String (trackId) + (auApart ? " (the app's own host, in a process of its own)" : " (the app's own host)"));
                auto alive = here;
                slur::openAudioUnit (four (codes[0]), four (codes[1]), four (codes[2]), auApart,
                                     [this, alive, trackId, done, fail, state, show, ident, at, asInst] (std::unique_ptr<slur::Plug> plug, std::string why)
                {
                    if (! alive->load()) return;                       // (the app has gone meanwhile)
                    placeOwn (trackId, done, fail, state, show, ident, at, std::move (plug), String (juce::CharPointer_UTF8 (why.c_str())), asInst);
                });
                return;
            }
            d.pluginFormatName = "AudioUnit"; d.fileOrIdentifier = ident;
        }
        else
        {
            juce::OwnedArray<juce::PluginDescription> found;
            const auto where = vst3Where (ident);
            if (where != ident) logLine ("insert: " + ident + " is not there; found at " + where);
            for (auto* f : fm.getFormats()) if (f->getName() == "VST3") f->findAllTypesForFile (found, where);
            const juce::PluginDescription* pick = nullptr;
            for (auto* p : found) if (p->isInstrument == asInst) { pick = p; break; }
            if (pick == nullptr) { Marker::clear ("doing"); fail (found.isEmpty() ? "could not be read" : asInst ? "an effect, not an instrument" : "an instrument, not an effect"); return; }
            d = *pick;
        }
        logLine ("insert: " + ident + " on track " + String (trackId));
        fm.createPluginInstanceAsync (d, sr, maxBlock, [this, trackId, done, fail, state, show, ident, at, asInst] (std::unique_ptr<juce::AudioPluginInstance> inst, const String& err)
        {
            /*  For some kinds of plug-in (audio units of the newer kind) the answer comes on a thread of the system's own.
                All of what follows — the mark of what is running, the page's answer, the plug-in's window — belongs on
                the message thread: the plug-in is handed over to it.                                                   */
            auto* mm = juce::MessageManager::getInstanceWithoutCreating();
            if (mm == nullptr) return;                                 // (the app has gone meanwhile: there is no one to hand it to)
            if (! mm->isThisTheMessageThread())
            {
                auto held = std::make_shared<std::unique_ptr<juce::AudioPluginInstance>> (std::move (inst));
                juce::MessageManager::callAsync ([this, trackId, done, fail, state, show, ident, at, asInst, held, err] { placeInsert (trackId, done, fail, state, show, ident, at, std::move (*held), err, asInst); });
                return;
            }
            placeInsert (trackId, done, fail, state, show, ident, at, std::move (inst), err, asInst);
        });
    }
    /** Message thread: a plug-in that has been opened takes its place on its track. */
    void placeInsert (int trackId, std::function<void (juce::var)> done, std::function<void (const String&)> fail, const String& state, bool show, const String& ident, int at,
                      std::unique_ptr<juce::AudioPluginInstance> inst, const String& err, bool asInst = false)
    {
        {
            if (inst == nullptr) { Marker::clear ("doing"); fail (err.isNotEmpty() ? err : "would not open"); return; }
            if (bouncing.load()) { Marker::clear ("doing"); fail ("busy"); return; }
            auto ins = std::make_unique<Insert>();
            ins->uid = ++nextUid;
            ins->name = inst->getName();
            ins->fmt = inst->getPluginDescription().pluginFormatName == "AudioUnit" ? "au" : "vst3";
            ins->inst = std::move (inst);
            ins->inst->addListener (&ins->heard);
            Marker::plugin (ins->uid, ident, ins->name);
            const Inside inside (ins->uid);
            ins->prepare (sr, maxBlock, &playHead);
            if (state.isNotEmpty()) { juce::MemoryOutputStream mo; if (juce::Base64::convertFromBase64 (mo, state) && mo.getDataSize() > 0) ins->inst->setStateInformation (mo.getData(), (int) mo.getDataSize()); }
            Marker::clear ("doing");                                   // (only now: one that hangs while it is made ready, and is put down by hand, is still known as what was being opened)
            if (asInst ? ins->outs < 1 : (ins->ins < 1 || ins->outs < 1)) { ins->inst->releaseResources(); fail (asInst ? "has no audio output" : "has no audio input"); return; }
            auto* o = new juce::DynamicObject();
            o->setProperty ("ok", true); o->setProperty ("uid", ins->uid); o->setProperty ("name", ins->name); o->setProperty ("fmt", ins->fmt);
            o->setProperty ("latency", ins->inst->getLatencySamples());
            o->setProperty ("key", ins->inst->getBusCount (true) > 1);     // it has a second input: a track can be given to it to listen to
            seat (trackId, done, fail, show, at, asInst, std::move (ins), o);
        }
    }
    /** Message thread: the same, for an audio unit the app opened itself (host/Au.mm). */
    void placeOwn (int trackId, std::function<void (juce::var)> done, std::function<void (const String&)> fail, const String& state, bool show, const String& ident, int at,
                   std::unique_ptr<slur::Plug> plug, const String& err, bool asInst)
    {
        if (plug == nullptr) { Marker::clear ("doing"); fail (err.isNotEmpty() ? err : "would not open"); return; }
        if (bouncing.load()) { Marker::clear ("doing"); fail ("busy"); return; }
        auto ins = std::make_unique<Insert>();
        ins->uid = ++nextUid;
        ins->name = String (juce::CharPointer_UTF8 (plug->name().c_str()));
        ins->fmt = "au";
        ins->own = std::move (plug);
        { Insert* raw = ins.get(); ins->own->touched = [raw] (int index) { raw->heard.index.store (index); raw->heard.moved.store (true); }; }      // (the plug-in belongs to this very insert, and goes with it)
        Marker::plugin (ins->uid, ident, ins->name);
        const Inside inside (ins->uid);
        ins->prepare (sr, maxBlock, &playHead);
        if (state.isNotEmpty()) { juce::MemoryOutputStream mo; if (juce::Base64::convertFromBase64 (mo, state) && mo.getDataSize() > 0) ins->own->setState (mo.getData(), mo.getDataSize()); }
        Marker::clear ("doing");
        if (asInst ? ins->outs < 1 : (ins->ins < 1 || ins->outs < 1)) { ins->letGo(); fail (asInst ? "has no audio output" : "has no audio input"); return; }
        auto* o = new juce::DynamicObject();
        o->setProperty ("ok", true); o->setProperty ("uid", ins->uid); o->setProperty ("name", ins->name); o->setProperty ("fmt", ins->fmt);
        o->setProperty ("latency", ins->own->latency());
        o->setProperty ("key", ins->own->hasKey());
        seat (trackId, done, fail, show, at, asInst, std::move (ins), o);
    }
    /** Message thread: a plug-in that is ready takes its place on its track, and the page is answered. */
    void seat (int trackId, std::function<void (juce::var)> done, std::function<void (const String&)> fail, bool show, int at, bool asInst, std::unique_ptr<Insert> ins, juce::DynamicObject* o)
    {
        {
            const int uid = ins->uid;
            bool placed = false;
            std::unique_ptr<Insert> gone; std::unique_ptr<slurinst::Instrument> goneOwn;      // (the instrument the track had, if this is its new one: let go of once the lock is)
            {
                const juce::ScopedLock sl (lock);
                if (auto* t = find (trackId))
                {
                    if (asInst) { gone = std::move (t->plug); goneOwn = std::move (t->built); t->plug = std::move (ins); t->keysUp(); t->stale.store (true); }
                    else t->inserts.insert (at >= 0 && at < (int) t->inserts.size() ? t->inserts.begin() + at : t->inserts.end(), std::move (ins));
                    placed = true;
                }
            }
            if (gone != nullptr) { gone->shut(); gone->letGo(); }
            if (! placed) { fail ("no such track"); return; }
            measureLatency();
            logLine ("inserted: " + o->getProperty ("name").toString() + " uid " + String (uid));
            done (juce::var (o));
            if (show) openEditor (trackId, uid);
        }
    }

    void openEditor (int trackId, int uid)
    {
        auto* t = find (trackId);
        if (t == nullptr) return;
        Insert* i = t->plug != nullptr && t->plug->uid == uid ? t->plug.get() : nullptr;
        for (auto& x : t->inserts) if (x->uid == uid) i = x.get();
        if (i == nullptr) return;
        {
            if (i->own != nullptr)
            {
                if (i->ownWin != nullptr) { i->ownWin->front(); return; }
                Insert* raw = i; const int id = i->uid; auto alive = here;
                const Inside inside (i->uid);
                i->own->view ([this, alive, raw, id, trackId] (void* view, int, int, bool sizes)
                {
                    if (! alive->load() || view == nullptr) return;
                    /* a unit of the newer kind answers in its own time: its plug-in may have been taken off meanwhile */
                    Insert* now = nullptr;
                    if (auto* tr = find (trackId)) tr->eachPlug ([&now, id] (Insert& x) { if (x.uid == id) now = &x; });
                    if (now != raw || now->ownWin != nullptr) return;
                    now->ownWin = slur::PlugWindow::open (now->name.toStdString(), view, sizes, [raw] { juce::MessageManager::callAsync ([raw] { raw->ownWin.reset(); }); });
                });
                return;
            }
            if (i->win != nullptr) { i->win->toFront (true); return; }
            const Inside inside (i->uid);
            juce::Component* ed = i->inst->hasEditor() ? static_cast<juce::Component*> (i->inst->createEditorIfNeeded()) : nullptr;
            bool resizable = false;
            if (auto* ape = dynamic_cast<juce::AudioProcessorEditor*> (ed)) resizable = ape->isResizable();
            if (ed == nullptr) ed = new juce::GenericAudioProcessorEditor (*i->inst);
            Insert* raw = i;
            i->win = std::make_unique<PluginWindow> (i->name, ed, resizable, [raw] { juce::MessageManager::callAsync ([raw] { raw->win.reset(); }); });
            return;
        }
    }

    /** What every plug-in would need to come back as it is: uid -> its state, base64. Message thread. moved: only those
        that have told of a change since they were last asked (the quiet save, about once a minute: asking every plug-in
        for its settings holds the page up, his ask 2026-10-21; a save by hand, and every fifth quiet one, ask them all,
        for a plug-in that changes without telling) */
    juce::var pluginStates (bool moved = false)
    {
        if (bouncing.load()) return printStates;                       // (a print is playing them on its own thread: they are not asked in the middle of it, and what they were when it began is what a save, or the app going, writes down)
        return statesNow (moved);
    }
    juce::var statesNow (bool moved = false, bool taken = true)          // taken: what is asked goes into a save, so each is counted as asked
    {
        auto* o = new juce::DynamicObject();
        for (auto& t : tracks) t->eachPlug ([o, moved, taken] (Insert& i) { if (! (taken ? i.heard.moved.exchange (false) : i.heard.moved.load()) && moved) return; juce::MemoryBlock mb; const Inside inside (i.uid); i.stateTo (mb); o->setProperty (juce::Identifier ("u" + String (i.uid)), juce::Base64::toBase64 (mb.getData(), mb.getSize())); });
        return juce::var (o);
    }

    /*  A control of an audio unit the app opened itself, in the words the library had for it — so that a line, the list
        of controls and an amount typed in the control's own unit read as they always did: a control that moves in steps
        reads as its nearest step; the unit's own words where it has them; "Off" / "On" for a switch; else the number. */
    static String ownName (const slur::Plug& p, int k) { return String (juce::CharPointer_UTF8 (p.controlName (k).c_str())); }
    static String ownText (const slur::Plug& p, int k, float v, int maxLength)
    {
        const int steps = p.controlSteps (k);
        if (steps > 1) { v = (float) juce::roundToInt (juce::jlimit (0.0f, 1.0f, v) * (float) (steps - 1)) / (float) (steps - 1); maxLength = 1024; }
        std::string words;
        if (p.controlWords (k, v, words)) return String (juce::CharPointer_UTF8 (words.c_str())).substring (0, maxLength);
        const float scaled = p.controlScaled (k, v);
        if (p.controlSwitch (k)) return scaled < 0.5f ? TRANS ("Off") : TRANS ("On");
        return String (scaled).substring (0, maxLength);
    }

    /** The controls of a plug-in that a line can be drawn for: [index, name, where it stands (0..1), how that reads], the first
        few hundred. Message thread. */
    juce::var pluginParams (int trackId, int uid)
    {
        juce::Array<juce::var> out;
        if (auto* t = find (trackId)) t->eachPlug ([&out, uid] (Insert& i)
        {
            if (i.uid == uid && i.own != nullptr)
            {
                for (int k = 0; k < i.own->controls() && out.size() < 400; ++k)
                {
                    if (! i.own->controlLine (k)) continue;
                    const float v = i.own->control (k);
                    juce::Array<juce::var> row; row.add (k); row.add (ownName (*i.own, k)); row.add ((double) v); row.add (ownText (*i.own, k, v, 1024));
                    out.add (juce::var (row));
                }
                return;
            }
            if (i.uid != uid || i.inst == nullptr) return;
            const auto& ps = i.inst->getParameters();
            for (int k = 0; k < ps.size() && out.size() < 400; ++k)
            {
                auto* p = ps.getUnchecked (k);
                if (! p->isAutomatable()) continue;
                juce::Array<juce::var> row; row.add (k); row.add (p->getName (48)); row.add ((double) p->getValue()); row.add (p->getCurrentValueAsText());
                out.add (juce::var (row));
            }
        });
        return out;
    }
    /** How one of a plug-in's controls reads along its travel: its words at a hundred and one places from 0 to 1, and its
        unit — so that an amount typed in the control's own unit ("3 db") can be found on it (ui/hint.js). */
    /** One control of a plug-in set where it stands, by hand (a macro turned: ui/macro.js). A line drawn for it goes on
        moving it as the song plays. Message thread. */
    bool setPluginParam (int trackId, int uid, int index, float v)
    {
        bool done = false;
        if (auto* t = find (trackId)) t->eachPlug ([&done, uid, index, v] (Insert& i) { if (i.uid == uid && ! done) { float told = -1.0f; i.setParam (index, v, told); done = told >= 0.0f; } });
        return done;
    }
    juce::var pluginScale (int trackId, int uid, int index)
    {
        auto* o = new juce::DynamicObject();
        juce::Array<juce::var> texts;
        if (auto* t = find (trackId)) t->eachPlug ([o, &texts, uid, index] (Insert& i)
        {
            if (i.uid == uid && i.own != nullptr)
            {
                if (index < 0 || index >= i.own->controls()) return;
                for (int k = 0; k <= 100; ++k) texts.add (ownText (*i.own, index, (float) k / 100.0f, 24));
                o->setProperty ("unit", String (juce::CharPointer_UTF8 (i.own->controlUnit (index).c_str()))); o->setProperty ("value", (double) i.own->control (index));
                return;
            }
            if (i.uid != uid || i.inst == nullptr) return;
            const auto& ps = i.inst->getParameters();
            if (index < 0 || index >= ps.size()) return;
            auto* p = ps.getUnchecked (index);
            for (int k = 0; k <= 100; ++k) texts.add (p->getText ((float) k / 100.0f, 24));
            o->setProperty ("unit", p->getLabel()); o->setProperty ("value", (double) p->getValue());
        });
        o->setProperty ("texts", texts);
        return juce::var (o);
    }
    /** The control last moved in the plug-in's own window: its index (-1: none yet), name, where it stands, how that reads. */
    juce::var pluginTouched (int trackId, int uid)
    {
        auto* o = new juce::DynamicObject();
        o->setProperty ("index", -1);
        if (auto* t = find (trackId)) t->eachPlug ([o, uid] (Insert& i)
        {
            if (i.uid == uid && i.own != nullptr)
            {
                const int k = i.heard.index.load();
                if (k < 0 || k >= i.own->controls() || ! i.own->controlLine (k)) return;
                const float v = i.own->control (k);
                o->setProperty ("index", k); o->setProperty ("name", ownName (*i.own, k)); o->setProperty ("value", (double) v); o->setProperty ("text", ownText (*i.own, k, v, 1024));
                return;
            }
            if (i.uid != uid || i.inst == nullptr) return;
            const int k = i.heard.index.load();
            const auto& ps = i.inst->getParameters();
            if (k < 0 || k >= ps.size() || ! ps.getUnchecked (k)->isAutomatable()) return;
            auto* p = ps.getUnchecked (k);
            o->setProperty ("index", k); o->setProperty ("name", p->getName (48)); o->setProperty ("value", (double) p->getValue()); o->setProperty ("text", p->getCurrentValueAsText());
        });
        return juce::var (o);
    }
    /** The check: a control moved the way a hand moves it in the plug-in's window. */
    void testTouch (int trackId, int uid, int index, float v)
    {
        if (auto* t = find (trackId)) t->eachPlug ([uid, index, v] (Insert& i) { if (i.uid == uid && i.own != nullptr && index >= 0 && index < i.own->controls()) { i.own->touch (index, v); i.heard.index.store (index); } });
        if (auto* t = find (trackId)) t->eachPlug ([uid, index, v] (Insert& i) { if (i.uid == uid && i.inst != nullptr && index >= 0 && index < i.inst->getParameters().size()) i.inst->getParameters().getUnchecked (index)->setValueNotifyingHost (v); });
    }
    /** The check: audio units opened both ways at once — through the library, and by the app itself (host/Au.mm) — and laid
        side by side, one after another: what a song made the one way needs in order to open the other way. For each:
        channels, lateness, whether it has a second input; every control's name, whether it takes a line, where it stands,
        its unit and how it reads at five places; the same sound played through both, sample against sample; and settings
        moved on the one and given to the other, both ways round. Nothing outside the check asks for it. */
    struct HostsCheck { juce::StringArray ids; int at = 0; juce::Array<juce::var> out; std::function<void (juce::var)> done; };
    void compareHosts (const juce::StringArray& ids, std::function<void (juce::var)> done)
    {
        auto st = std::make_shared<HostsCheck>();
        st->ids = ids; st->done = std::move (done);
        compareNext (st);
    }
    void compareNext (std::shared_ptr<HostsCheck> st)
    {
        if (st->at >= st->ids.size()) { st->done (juce::var (st->out)); return; }
        const String ident = st->ids[st->at++];
        const auto codes = juce::StringArray::fromTokens (ident.fromFirstOccurrenceOf ("/", false, false), ",", "");
        auto four = [] (const String& s) { uint32_t v = 0; for (int i = 0; i < 4; ++i) v = (v << 8) | (uint32_t) (i < s.length() ? (s[i] & 0xff) : ' '); return v; };
        auto alive = here;
        auto then = [this, alive, st, ident] (std::unique_ptr<slur::Plug> plug, std::string why)
        {
            if (! alive->load()) return;
            compareOne (ident, std::move (plug), String (juce::CharPointer_UTF8 (why.c_str())), [this, alive, st] (juce::var one)
            {
                st->out.add (one);
                juce::MessageManager::callAsync ([this, alive, st] { if (alive->load()) compareNext (st); });
            });
        };
        if (codes.size() < 3) { then (nullptr, "not an audio unit's name"); return; }
        slur::openAudioUnit (four (codes[0]), four (codes[1]), four (codes[2]), false, then);
    }
    struct HostsPair { Insert a, b; };                             // a: the library's; b: the app's own
    void compareOne (const String& ident, std::unique_ptr<slur::Plug> plug, const String& why, std::function<void (juce::var)> finished)
    {
        auto* o = new juce::DynamicObject();
        juce::var res (o);
        o->setProperty ("id", ident);
        juce::PluginDescription d; d.pluginFormatName = "AudioUnit"; d.fileOrIdentifier = ident;
        String err;
        auto lib = fm.createPluginInstance (d, sr, maxBlock, err);
        o->setProperty ("library", lib != nullptr); o->setProperty ("own", plug != nullptr);
        if (lib == nullptr || plug == nullptr) { o->setProperty ("why", lib == nullptr ? err : why); finished (res); return; }
        o->setProperty ("name", lib->getName());
        const bool asInst = ident.fromFirstOccurrenceOf ("/", false, false).startsWith ("aumu");
        auto pair = std::make_shared<HostsPair>();
        auto& a = pair->a; auto& b = pair->b;
        a.uid = -1; b.uid = -2;
        a.inst = std::move (lib); b.own = std::move (plug);
        a.prepare (sr, maxBlock, &playHead); b.prepare (sr, maxBlock, &playHead);
        auto first = std::make_shared<String>();                       // the first thing found to differ, in words
        auto differ = [first] (const String& what) { if (first->isEmpty()) *first = what; };
        if (a.outs != b.outs || (a.ins > 0) != (b.ins > 0)) differ ("channels " + String (a.ins) + "/" + String (a.outs) + " and " + String (b.ins) + "/" + String (b.outs));
        if (a.latencyNow() != b.latencyNow()) differ ("late by " + String (a.latencyNow()) + " and " + String (b.latencyNow()));
        if ((a.inst->getBusCount (true) > 1) != b.own->hasKey()) differ ("second input");
        o->setProperty ("latency", a.latencyNow());
        const auto& ps = a.inst->getParameters();
        const int count = ps.size();
        o->setProperty ("controls", count);
        if (count != b.own->controls()) differ ("controls " + String (count) + " and " + String (b.own->controls()));
        const int both = juce::jmin (count, b.own->controls());
        int texts = 0;
        for (int k = 0; k < both; ++k)
        {
            auto* p = ps.getUnchecked (k);
            const String name = p->getName (48);
            if (name != ownName (*b.own, k)) differ ("control " + String (k) + " is '" + name + "' and '" + ownName (*b.own, k) + "'");
            if (p->isAutomatable() != b.own->controlLine (k)) differ (name + ": takes a line");
            if (std::abs (p->getValue() - b.own->control (k)) > 1.0e-6f) differ (name + ": stands at " + String (p->getValue()) + " and " + String (b.own->control (k)));
            if (p->getLabel() != String (juce::CharPointer_UTF8 (b.own->controlUnit (k).c_str()))) differ (name + ": unit '" + p->getLabel() + "' and '" + String (juce::CharPointer_UTF8 (b.own->controlUnit (k).c_str())) + "'");
            for (const float v : { 0.0f, 0.25f, 0.5f, 0.75f, 1.0f })
            {
                const String one = p->getText (v, 24), two = ownText (*b.own, k, v, 24);
                ++texts;
                if (one != two) differ (name + " at " + String (v) + " reads '" + one + "' and '" + two + "'");
            }
            if (p->getCurrentValueAsText() != ownText (*b.own, k, b.own->control (k), 1024)) differ (name + ": reads '" + p->getCurrentValueAsText() + "' and '" + ownText (*b.own, k, b.own->control (k), 1024) + "'");
        }
        o->setProperty ("texts", texts);
        {
            /* the same second of sound through both (an instrument: the same key held) */
            const int total = (int) sr;
            juce::AudioBuffer<float> x (2, total), y;
            x.clear();
            if (! asInst)
            {
                juce::Random r (7);
                for (int i = 0; i < total / 2; ++i) { const float v = (r.nextFloat() - 0.5f) * 0.5f; x.setSample (0, i, v); x.setSample (1, i, -v * 0.7f); }
                x.setSample (0, total / 2 + 100, 1.0f); x.setSample (1, total / 2 + 100, 1.0f);
            }
            y.makeCopyOf (x);
            for (int at = 0; at < total; at += maxBlock)
            {
                const int n = juce::jmin (maxBlock, total - at);
                if (asInst)
                {
                    juce::MidiBuffer ma, mb;
                    if (at == 0) { ma.addEvent (juce::MidiMessage::noteOn (1, 60, (juce::uint8) 100), 0); mb.addEvent (juce::MidiMessage::noteOn (1, 60, (juce::uint8) 100), 0); }
                    a.play (x.getWritePointer (0) + at, x.getWritePointer (1) + at, n, ma);
                    b.play (y.getWritePointer (0) + at, y.getWritePointer (1) + at, n, mb);
                }
                else
                {
                    a.process (x.getWritePointer (0) + at, x.getWritePointer (1) + at, n);
                    b.process (y.getWritePointer (0) + at, y.getWritePointer (1) + at, n);
                }
            }
            double worst = 0.0;
            for (int c = 0; c < 2; ++c) for (int i = 0; i < total; ++i) worst = juce::jmax (worst, (double) std::abs (x.getSample (c, i) - y.getSample (c, i)));
            o->setProperty ("level", (double) x.getRMSLevel (0, 0, total)); o->setProperty ("apart", worst);
        }
        if (! asInst && a.inst->getBusCount (true) > 1 && b.own->hasKey())
        {
            /* … and once more with something to listen to on the second input: both are made ready anew with it open */
            a.keyFrom = b.keyFrom = 1;
            a.letGo(); b.letGo();
            a.prepare (sr, maxBlock, &playHead); b.prepare (sr, maxBlock, &playHead);
            o->setProperty ("keyChannels", a.keyCh);
            if (a.keyCh != b.keyCh) differ ("the second input has " + String (a.keyCh) + " and " + String (b.keyCh) + " channels");
            const int total = (int) sr / 2;
            juce::AudioBuffer<float> x (2, total), y, key (2, total);
            juce::Random r (11);
            for (int i = 0; i < total; ++i)
            {
                const float v = (r.nextFloat() - 0.5f) * 0.5f, k = 0.8f * (float) std::sin (juce::MathConstants<double>::twoPi * 80.0 * (double) i / sr);
                x.setSample (0, i, v); x.setSample (1, i, v * 0.6f); key.setSample (0, i, k); key.setSample (1, i, k * 0.5f);
            }
            y.makeCopyOf (x);
            for (int at = 0; at < total; at += maxBlock)
            {
                const int n = juce::jmin (maxBlock, total - at);
                a.process (x.getWritePointer (0) + at, x.getWritePointer (1) + at, n, key.getReadPointer (0) + at, key.getReadPointer (1) + at);
                b.process (y.getWritePointer (0) + at, y.getWritePointer (1) + at, n, key.getReadPointer (0) + at, key.getReadPointer (1) + at);
            }
            double worst = 0.0;
            for (int c = 0; c < 2; ++c) for (int i = 0; i < total; ++i) worst = juce::jmax (worst, (double) std::abs (x.getSample (c, i) - y.getSample (c, i)));
            o->setProperty ("keyedApart", worst); o->setProperty ("keyedLevel", (double) x.getRMSLevel (0, 0, total));
        }
        /*  Settings moved on the one and given to the other, both ways round. A plug-in may take a moment to show what it
            was given (one that passes its settings on to its controls on the message thread): each way is looked at a
            third of a second after the giving. */
        auto moved = std::make_shared<std::vector<int>>();
        for (int k = 0; k < both && moved->size() < 3; ++k) if (ps.getUnchecked (k)->isAutomatable() && ! ps.getUnchecked (k)->isDiscrete()) moved->push_back (k);
        auto apart = [pair, both] { float w = 0.0f; const auto& q = pair->a.inst->getParameters(); for (int k = 0; k < both; ++k) w = juce::jmax (w, std::abs (q.getUnchecked (k)->getValue() - pair->b.own->control (k))); return (double) w; };
        juce::MemoryBlock untouched; a.stateTo (untouched);
        for (size_t i = 0; i < moved->size(); ++i) ps.getUnchecked ((*moved)[i])->setValue (0.3f + 0.2f * (float) i);
        juce::MemoryBlock fromLib; a.stateTo (fromLib);
        o->setProperty ("holds", untouched != fromLib);                // (a plug-in whose settings do not hold these controls at all cannot carry them across, whoever opens it)
        const bool took = b.own->setState (fromLib.getData(), fromLib.getSize());
        o->setProperty ("moved", (int) moved->size());
        auto alive = here;
        juce::Timer::callAfterDelay (330, [this, alive, pair, moved, apart, took, res, first, finished]
        {
            if (! alive->load()) return;
            auto* o2 = res.getDynamicObject();
            o2->setProperty ("libraryToOwn", took ? apart() : -1.0);
            for (size_t i = 0; i < moved->size(); ++i) pair->b.own->setControl ((*moved)[i], 0.8f - 0.2f * (float) i);
            juce::MemoryBlock fromOwn; pair->b.stateTo (fromOwn);
            pair->a.inst->setStateInformation (fromOwn.getData(), (int) fromOwn.getSize());
            juce::Timer::callAfterDelay (330, [this, alive, pair, apart, res, first, finished]
            {
                if (! alive->load()) return;
                auto* o3 = res.getDynamicObject();
                o3->setProperty ("ownToLibrary", apart());
                juce::MemoryBlock one, two; pair->a.stateTo (one); pair->b.stateTo (two);
                o3->setProperty ("sameBytes", one == two); o3->setProperty ("bytes", (int) one.getSize());
                if (first->isNotEmpty()) o3->setProperty ("differs", *first);
                pair->a.letGo(); pair->b.letGo();
                finished (res);
            });
        });
    }

    /** A plug-in is given a track to listen to on its second input (0: none any more). Message thread. */
    juce::var setKey (int trackId, int uid, int fromId)
    {
        auto* o = new juce::DynamicObject();
        juce::var res (o);
        o->setProperty ("ok", false);
        if (bouncing.load()) { o->setProperty ("why", "busy"); return res; }
        const juce::ScopedLock sl (lock);                              // no block is worked while the plug-in is made ready anew with its second input open, or shut
        auto* t = find (trackId);
        Insert* ins = nullptr;
        if (t != nullptr) for (auto& i : t->inserts) if (i->uid == uid) ins = i.get();
        if (ins == nullptr || ! ins->there()) { o->setProperty ("why", "gone"); return res; }
        auto ready = [this, ins] (int from) { ins->keyFrom = from; const Inside inside (ins->uid); ins->letGo(); ins->prepare (sr, maxBlock, &playHead); wire(); };
        const int was = ins->keyFrom;
        ready (fromId);
        if (fromId != 0 && (ins->key == nullptr || ins->keyCh == 0))
        {
            o->setProperty ("why", ins->keyCh == 0 ? "no key input" : "ring");
            ready (was);
        }
        else { o->setProperty ("ok", true); o->setProperty ("from", fromId); }
        measureLatency();
        return res;
    }
    /** What a `side` on a track's wall plays: another track (0: nothing). Refused when that track is fed by this one. */
    juce::var setSide (int trackId, int fromId)
    {
        auto* o = new juce::DynamicObject();
        juce::var res (o);
        o->setProperty ("ok", false);
        if (bouncing.load()) { o->setProperty ("why", "busy"); return res; }
        auto* t = find (trackId);
        if (t == nullptr) { o->setProperty ("why", "gone"); return res; }
        const juce::ScopedLock sl (lock);
        if (t->sideBuf.getNumSamples() < maxBlock) t->sideBuf.setSize (2, maxBlock);
        const int was = t->sideFrom;
        t->sideFrom = fromId; wire();
        if (fromId != 0 && t->side == nullptr) { o->setProperty ("why", find (fromId) == nullptr ? "gone" : "ring"); t->sideFrom = was; wire(); }
        else { o->setProperty ("ok", true); o->setProperty ("from", fromId); }
        measureLatency();
        return res;
    }
    void bypassPlugin (int trackId, int uid, bool off) { if (auto* t = find (trackId)) { t->eachPlug ([uid, off] (Insert& i) { if (i.uid == uid) i.off.store (off); }); measureLatency(); } }

    void closeEditors() { for (auto& t : tracks) t->eachPlug ([] (Insert& i) { i.shut(); }); }

    bool removePlugin (int trackId, int uid)
    {
        if (bouncing.load()) return false;
        std::unique_ptr<Insert> gone;
        {
            const juce::ScopedLock sl (lock);
            if (auto* t = find (trackId))
            {
                if (t->plug != nullptr && t->plug->uid == uid) { gone = std::move (t->plug); t->keysUp(); }
                else for (auto it = t->inserts.begin(); it != t->inserts.end(); ++it)
                    if ((*it)->uid == uid) { gone = std::move (*it); t->inserts.erase (it); break; }
                for (auto& at : t->slotIns) if (gone != nullptr && at == gone.get()) at = nullptr;      // (on a wall: its place passes the sound by until the page sends the wall without it)
            }
        }
        if (gone == nullptr) return false;
        measureLatency();
        gone->shut();
        gone->letGo();
        return true;
    }

    //── instruments, and the keys ─────────────────────────────────────────────
    static void applyParams (slurinst::Instrument& i, const juce::var& params)
    {
        if (auto* obj = params.getDynamicObject()) for (auto& nv : obj->getProperties()) i.set (nv.name.toString().toRawUTF8(), (float) (double) nv.value);
    }
    /** Give a track one of the DAW's own instruments (`kind`: synth, drums or sampler; any other word takes away whatever
        instrument it has), set to the numbers in `params`. Message thread. -> {ok, kind} */
    juce::var setInstrument (int trackId, const String& kind, const juce::var& params)
    {
        auto* o = new juce::DynamicObject();
        juce::var res (o);
        o->setProperty ("ok", false);
        if (bouncing.load()) { o->setProperty ("error", "busy"); return res; }
        auto made = slurinst::make (kind.toRawUTF8());
        if (made != nullptr) { made->prepare (sr); applyParams (*made, params); }
        const bool any = made != nullptr;
        std::unique_ptr<slurinst::Instrument> gone; std::unique_ptr<Insert> gonePlug;
        {
            const juce::ScopedLock sl (lock);
            auto* t = find (trackId);
            if (t == nullptr) { o->setProperty ("error", "no such track"); return res; }
            gone = std::move (t->built); gonePlug = std::move (t->plug);
            t->built = std::move (made);
            t->keysUp(); t->stale.store (true);
        }
        if (gonePlug != nullptr) { gonePlug->shut(); gonePlug->letGo(); measureLatency(); }
        o->setProperty ("ok", true); o->setProperty ("kind", any ? kind : String ("none"));
        return res;
    }
    /** Turn what can be turned on a track's own instrument: {name: value, ...}. The numbers are read by the device's thread as they are. */
    bool instrumentParams (int trackId, const juce::var& params)
    {
        auto* t = find (trackId);
        if (t == nullptr || t->built == nullptr) return false;
        applyParams (*t->built, params);
        return true;
    }
    /** A sound for a track's own instrument to play from: the sampler's (slot 0), or one pad's of the drum kit. An empty key takes it away. */
    bool instrumentSample (int trackId, int slot, const String& key)
    {
        if (bouncing.load()) return false;
        auto b = key.isEmpty() ? std::shared_ptr<Buf>() : buffer (key);
        slurinst::Sample s;
        if (b != nullptr && b->data.getNumSamples() > 1 && b->data.getNumChannels() > 0)
        {
            s.L = b->data.getReadPointer (0); s.R = b->data.getReadPointer (b->data.getNumChannels() > 1 ? 1 : 0);
            s.n = b->data.getNumSamples(); s.keep = b;
        }
        else if (key.isNotEmpty()) return false;
        const juce::ScopedLock sl (lock);                              // (no block is being played while the sound changes hands)
        auto* t = find (trackId);
        return t != nullptr && t->built != nullptr && t->built->setSample (slot, std::move (s));
    }

    /** Every keyboard and controller the machine has is listened to (the check listens to none: it plays its own keys). Message thread. */
    void openKeys()
    {
        if (testInput) return;
        for (auto& d : juce::MidiInput::getAvailableDevices()) if (! dm.isMidiInputDeviceEnabled (d.identifier)) dm.setMidiInputDeviceEnabled (d.identifier, true);
        if (keysWatch.get() == nullptr) keysWatch = std::make_unique<juce::MidiDeviceListConnection> (juce::MidiDeviceListConnection::make ([this] { openKeys(); }));      // one that is plugged in later is listened to as well
    }
    juce::var keyInputs()
    {
        auto* o = new juce::DynamicObject();
        juce::Array<juce::var> names;
        if (! testInput) for (auto& d : juce::MidiInput::getAvailableDevices()) names.add (d.name);
        o->setProperty ("names", names); o->setProperty ("seen", keysSeen.load());
        return juce::var (o);
    }
    void handleIncomingMidiMessage (juce::MidiInput*, const juce::MidiMessage& m) override
    {
        if (m.isSysEx() || m.getRawDataSize() > 3 || m.getRawData()[0] >= 0xF0) return;      // (clocks, sensing and long messages are not for the tracks)
        keys.addMessageToQueue (m);
        keysSeen.fetch_add (1, std::memory_order_relaxed);
    }
    /** A key played from the page (the computer's own keys, a note pressed in an editor): it comes in with what the keyboards send. */
    void playKey (int st, int d1, int d2)
    {
        juce::MidiMessage m (juce::jlimit (0x80, 0xEF, st), d1 & 127, d2 & 127);
        m.setTimeStamp (juce::Time::getMillisecondCounterHiRes() * 0.001);
        keys.addMessageToQueue (m);
        keysSeen.fetch_add (1, std::memory_order_relaxed);
    }
    /** A note that hangs: every track of notes lets go of every key and is told to be silent. */
    void hushAll() { for (auto& t : tracks) if (t->notes || t->built != nullptr || t->plug != nullptr) t->hush.store (true); }
    /** What has been played by hand since the `from`th thing (the newest the engine still holds, at most). Call with the lock held. */
    std::vector<Played> playedSince (size_t from) const
    {
        std::vector<Played> got;
        const size_t size = liveLog.size();
        if (size == 0) return got;
        const size_t first = juce::jmax (from, logN > size ? logN - size : (size_t) 0);
        got.reserve (logN - first);
        for (size_t k = first; k < logN; ++k) got.push_back (liveLog[k % size]);
        return got;
    }
    /** What was just played, though nothing was recording: everything of the go the last key belongs to — played while the
        song ran, each thing at its place in the song (`rolling`, places in bars); played with the song standing still,
        each thing by the seconds since the first. -> {ok, rolling, ev: [when, status, byte, byte, ...]} */
    juce::var capture()
    {
        std::vector<Played> got;
        { const juce::ScopedLock sl (lock); got = playedSince (0); }
        auto* o = new juce::DynamicObject();
        juce::var res (o);
        int segOf = -1; bool rolling = false;
        for (auto it = got.rbegin(); it != got.rend(); ++it) if ((it->st & 0xF0) == 0x90 && it->d2 > 0) { segOf = it->seg; rolling = it->rolling != 0; break; }
        o->setProperty ("ok", segOf >= 0); o->setProperty ("rolling", rolling);
        juce::Array<juce::var> ev;
        const double barS = barSamples();
        juce::int64 run0 = -1;
        for (auto& p : got)
        {
            if (p.seg != segOf || (p.rolling != 0) != rolling) continue;
            if (run0 < 0) run0 = p.runS;
            ev.add (rolling ? (double) juce::jmax ((juce::int64) 0, p.songS) / barS : (double) (p.runS - run0) / sr);
            ev.add ((int) p.st); ev.add ((int) p.d1); ev.add ((int) p.d2);
        }
        o->setProperty ("ev", ev);
        return res;
    }

    //── files ─────────────────────────────────────────────────────────────────
    /** Decode a file into a buffer at the engine's rate. Returns {ok, key, sec, peaks}. */
    juce::var decode (const juce::MemoryBlock& bytes) { return decodeFrom (std::unique_ptr<juce::AudioFormatReader> (afm.createReaderFor (std::make_unique<juce::MemoryInputStream> (bytes, true)))); }
    juce::var decodeFile (const juce::File& f)
    {
        auto v = mapped (f);
        const bool onDisk = v.isObject();
        if (! onDisk) v = decodeFrom (std::unique_ptr<juce::AudioFormatReader> (afm.createReaderFor (f)));        // (no room for it on the disk, say: held in memory, as it used to be)
        if ((bool) v["cut"] && onSoundCut)                                                             // not all of it is held (memory holds twenty minutes of a file, the disk two hours): said, not kept quiet
        {
            const String name = f.getFileName(); const double held = (double) v["sec"], whole = (double) v["whole"];
            juce::MessageManager::callAsync ([this, name, held, whole, onDisk] { if (onSoundCut) onSoundCut (name, held, whole, ! onDisk); });
        }
        return v;
    }

    /** A file's sound, kept ready on the disk and looked at where it lies. The first time, the file is decoded a piece at
        a time (and brought to the engine's rate) into the cache; after that, opening it is opening the cache: nothing is
        decoded and nothing is read until it is played. -> {ok, key, sec, peaks, tone}, or nothing when it cannot be done. */
    juce::var mapped (const juce::File& f)
    {
        if (! f.existsAsFile()) return {};
        const auto name = String::toHexString ((f.getFullPathName() + "|" + String (f.getSize()) + "|" + String (f.getLastModificationTime().toMilliseconds()) + "|" + String (juce::roundToInt (sr)) + "|1").hashCode64());
        const auto dir = soundRoot();
        if (! dir.createDirectory().wasOk()) return {};
        const auto snd = dir.getChildFile (name + ".snd"), about = dir.getChildFile (name + ".json");
        juce::var meta;
        if (snd.existsAsFile() && about.existsAsFile()) meta = juce::JSON::parse (about);
        auto fits = [&] { return meta.isObject() && juce::roundToInt ((double) meta["rate"]) == juce::roundToInt (sr) && (int) meta["frames"] > 1 && snd.getSize() == kSoundHead + (juce::int64) (int) meta["channels"] * (juce::int64) (int) meta["frames"] * 4; };
        /* one file made ready by one thread at a time: two asking for the same sound at once (several are made ready together
           when a project opens) wait for each other, and the second finds it made */
        struct Making
        {
            String name;
            static juce::CriticalSection& cs() { static juce::CriticalSection c; return c; }
            static std::set<String>& on() { static std::set<String> s; return s; }
            explicit Making (const String& n) : name (n) { for (;;) { { const juce::ScopedLock sl (cs()); if (on().insert (name).second) return; } juce::Thread::sleep (15); } }
            ~Making() { const juce::ScopedLock sl (cs()); on().erase (name); }
        } making (name);
        if (! fits() && snd.existsAsFile() && about.existsAsFile()) meta = juce::JSON::parse (about);      // (made meanwhile by the one that was waited for)
        if (fits()) about.setLastModificationTime (juce::Time::getCurrentTime());      // (what was last used when: for tidying up)
        else
        {
            std::unique_ptr<juce::AudioFormatReader> rd (afm.createReaderFor (f));
            if (rd == nullptr || rd->lengthInSamples < 2) return {};
            {
                // is there room for it? (as long as the file at the engine's rate, four bytes to a sample)
                const juce::int64 need = (juce::int64) ((double) rd->lengthInSamples * sr / juce::jmax (1.0, rd->sampleRate)) * (juce::int64) juce::jmin (2u, rd->numChannels) * 4 + kSoundHead;
                // a file longer than memory is given (twenty minutes) can only be whole on the disk: for such a one a single gigabyte left over is enough
                const bool tooLongForMemory = (double) rd->lengthInSamples > rd->sampleRate * 60.0 * 20.0;
                const juce::int64 keep = tooLongForMemory ? ((juce::int64) 1 << 30) : soundKeepFree (dir);
                if (dir.getBytesFreeOnVolume() - need < keep) { logLine ("sound: no room on the disk to keep " + f.getFileName() + " ready (held in memory)"); return {}; }
            }
            meta = renderSound (*rd, snd, about);
            if (! fits()) { snd.deleteFile(); about.deleteFile(); return {}; }
        }
        auto nb = std::make_shared<Buf>();
        nb->map = std::make_unique<juce::MemoryMappedFile> (snd, juce::MemoryMappedFile::readOnly);
        const int ch = juce::jlimit (1, 2, (int) meta["channels"]), frames = (int) meta["frames"];
        if (nb->map->getData() == nullptr || (juce::int64) nb->map->getSize() < kSoundHead + (juce::int64) ch * frames * 4) return {};
        auto* base = reinterpret_cast<float*> (static_cast<char*> (nb->map->getData()) + kSoundHead);
        float* chans[2] = { base, ch > 1 ? base + frames : base };
        nb->data.setDataToReferTo (chans, ch, frames);
        const String key = "file:" + String (++nextFile);
        {
            const juce::ScopedLock sl (lock);
            bufIndex[key] = (int) bufs.size(); bufs.push_back (nb);
        }
        auto* o = new juce::DynamicObject();
        o->setProperty ("ok", true); o->setProperty ("key", key); o->setProperty ("sec", (double) frames / sr);
        o->setProperty ("peaks", meta["peaks"]); o->setProperty ("tone", meta["tone"]);
        if ((bool) meta["cut"]) { o->setProperty ("cut", true); o->setProperty ("whole", meta["whole"]); }
        return juce::var (o);
    }

    /** Decode a file into the cache, a piece at a time: `snd` gets the bare samples (one channel after the other, after a
        short head), `about` what the page wants to know of them. Never more than a piece of it is in memory. */
    juce::var renderSound (juce::AudioFormatReader& rd, const juce::File& snd, const juce::File& about)
    {
        const int ch = (int) juce::jmin (2u, rd.numChannels);
        const juce::int64 srcLen = juce::jmin ((juce::int64) (rd.sampleRate * 3600.0 * 2.0), rd.lengthInSamples);        // two hours of one file is where this stops
        const bool same = std::abs (rd.sampleRate - sr) < 1.0;
        const double ratio = rd.sampleRate / sr;
        const juce::int64 frames64 = same ? srcLen : (juce::int64) ((double) srcLen / ratio);
        if (ch < 1 || frames64 < 2 || frames64 > 0x7ffffff0) return {};
        const int frames = (int) frames64;
        const auto part = snd.getSiblingFile (snd.getFileNameWithoutExtension() + ".part");
        part.deleteFile();
        const juce::int64 bytes = kSoundHead + (juce::int64) ch * frames * 4;
        {
            // the room is taken for real before a sample is written: a file that is only promised its length would bring
            // the app down (a fault in the middle of writing through the map) on a disk that fills meanwhile
            const int fd = ::open (part.getFullPathName().toRawUTF8(), O_RDWR | O_CREAT | O_TRUNC, 0644);
            if (fd < 0) return {};
            fstore_t room = { F_ALLOCATEALL, F_PEOFPOSMODE, 0, (off_t) bytes, 0 };
            const bool ok = ::fcntl (fd, F_PREALLOCATE, &room) != -1 && ::ftruncate (fd, (off_t) bytes) == 0;
            ::close (fd);
            if (! ok) { part.deleteFile(); logLine ("sound: the disk would not give " + String (bytes / 1048576) + " MB"); return {}; }
        }
        auto* o = new juce::DynamicObject();
        juce::var out (o);
        const auto t0 = juce::Time::getMillisecondCounterHiRes();
        double tRead = 0.0, tLook = 0.0, tSync = 0.0;
        {
            juce::MemoryMappedFile mm (part, juce::MemoryMappedFile::readWrite);
            if (mm.getData() == nullptr || (juce::int64) mm.getSize() < bytes) { part.deleteFile(); return {}; }
            auto* base = reinterpret_cast<float*> (static_cast<char*> (mm.getData()) + kSoundHead);
            float* dst[2] = { base, ch > 1 ? base + frames : base };
            const int piece = 1 << 16;
            juce::AudioBuffer<float> in (ch, piece);
            if (same)
            {
                for (juce::int64 p = 0; p < srcLen; p += piece)
                {
                    const int n = (int) juce::jmin ((juce::int64) piece, srcLen - p);
                    rd.read (&in, 0, n, p, true, true);
                    for (int c = 0; c < ch; ++c) std::memcpy (dst[c] + p, in.getReadPointer (c), (size_t) n * sizeof (float));
                }
            }
            else if (void* cv = slurSrcOpen (rd.sampleRate, sr, ch, SLUR_BRING_BEST))
            {
                /* another rate: the Mac's own converter (Mac.mm), filtered, in pieces — some twenty times as fast as the
                   interpolator below, which is kept for when it will not open (his ask, 2026-10-21: Logic brings it in at once) */
                constexpr int cap = 1 << 15;
                std::vector<float> inter ((size_t) piece * (size_t) ch), got ((size_t) cap * (size_t) ch);
                juce::int64 at = 0;
                auto take = [&] (int n)
                {
                    for (int i = 0; i < n && at < frames; ++i, ++at) for (int c = 0; c < ch; ++c) dst[c][at] = got[(size_t) i * (size_t) ch + (size_t) c];
                };
                for (juce::int64 p = 0; p < srcLen; p += piece)
                {
                    const int n = (int) juce::jmin ((juce::int64) piece, srcLen - p);
                    rd.read (&in, 0, n, p, true, true);
                    for (int c = 0; c < ch; ++c) { const float* x = in.getReadPointer (c); for (int i = 0; i < n; ++i) inter[(size_t) i * (size_t) ch + (size_t) c] = x[i]; }
                    for (int k = slurSrcRun (cv, inter.data(), n, false, got.data(), cap); ; k = slurSrcRun (cv, nullptr, 0, false, got.data(), cap)) { take (k); if (k < cap) break; }
                }
                for (int k = slurSrcRun (cv, nullptr, 0, true, got.data(), cap); ; k = slurSrcRun (cv, nullptr, 0, true, got.data(), cap)) { take (k); if (k < cap) break; }
                for (int c = 0; c < ch; ++c) if (at < frames) juce::FloatVectorOperations::clear (dst[c] + at, (int) (frames - at));
                slurSrcClose (cv);
            }
            else
            {
                const int late = (int) std::llround ((double) juce::WindowedSincInterpolator::getBaseLatency() / ratio);     // the interpolator hands its sound over a little late
                juce::WindowedSincInterpolator si[2];
                std::vector<float> pend[2], made;
                juce::int64 at[2] = { -(juce::int64) late, -(juce::int64) late };      // where the next sample made lands in the file (before 0: the lateness, dropped)
                auto drain = [&] (bool last)
                {
                    for (int c = 0; c < ch; ++c)
                    {
                        const int avail = (int) pend[c].size();
                        int nOut = (int) std::floor ((double) (avail - 8) / ratio);
                        nOut = (int) juce::jmin ((juce::int64) nOut, (juce::int64) frames - at[c]);
                        juce::ignoreUnused (last);
                        if (nOut <= 0) continue;
                        made.resize ((size_t) nOut);
                        const int used = si[c].process (ratio, pend[c].data(), made.data(), nOut);
                        pend[c].erase (pend[c].begin(), pend[c].begin() + juce::jmin (used, avail));
                        for (int i = 0; i < nOut; ++i, ++at[c]) if (at[c] >= 0 && at[c] < frames) dst[c][at[c]] = made[(size_t) i];
                    }
                };
                for (juce::int64 p = 0; p < srcLen; p += piece)
                {
                    const int n = (int) juce::jmin ((juce::int64) piece, srcLen - p);
                    rd.read (&in, 0, n, p, true, true);
                    for (int c = 0; c < ch; ++c) pend[c].insert (pend[c].end(), in.getReadPointer (c), in.getReadPointer (c) + n);
                    drain (false);
                }
                for (int c = 0; c < ch; ++c) pend[c].insert (pend[c].end(), (size_t) (64 + (int) std::ceil ((double) (late + 16) * ratio)), 0.0f);        // what the interpolator is still holding
                drain (true);
            }
            tRead = juce::Time::getMillisecondCounterHiRes();
            const juce::AudioBuffer<float> view (dst, ch, frames);
            describe (view, *o, true);                                  // how it looks and how it sounds, read back from where it now lies
            tLook = juce::Time::getMillisecondCounterHiRes();
            o->setProperty ("channels", ch); o->setProperty ("frames", frames); o->setProperty ("rate", sr);
            if (rd.lengthInSamples > srcLen) { o->setProperty ("cut", true); o->setProperty ("whole", (double) rd.lengthInSamples / rd.sampleRate); }
            const char head[16] = { 's', 'l', 'u', 'r', ' ', 's', 'o', 'u', 'n', 'd', ' ', '1', 0, 0, 0, 0 };
            std::memcpy (mm.getData(), head, sizeof (head));
            ::msync (mm.getData(), mm.getSize(), MS_SYNC);              tSync = juce::Time::getMillisecondCounterHiRes();      // on the disk for real before it is given its name: after a power cut a file of the right length with holes in it would pass for whole
        }
        snd.deleteFile();
        if (! part.moveFileTo (snd)) { part.deleteFile(); return {}; }
        if (! about.replaceWithText (juce::JSON::toString (out, true))) { snd.deleteFile(); return {}; }
        logLine ("sound: made ready, " + String (bytes / 1048576) + " MB" + (same ? "" : " (from " + String (rd.sampleRate) + ")") + ": read " + String (juce::roundToInt (tRead - t0)) + " ms, looked at " + String (juce::roundToInt (tLook - tRead)) + " ms, written " + String (juce::roundToInt (tSync - tLook)) + " ms");
        return out;
    }
    juce::var decodeFrom (std::unique_ptr<juce::AudioFormatReader> rd)
    {
        auto* o = new juce::DynamicObject();
        juce::var result (o);
        o->setProperty ("ok", false);
        if (rd == nullptr || rd->lengthInSamples < 2) return result;
        const int srcLen = (int) juce::jmin ((juce::int64) (rd->sampleRate * 60.0 * 20.0), rd->lengthInSamples);
        if (rd->lengthInSamples > (juce::int64) srcLen) { o->setProperty ("cut", true); o->setProperty ("whole", (double) rd->lengthInSamples / rd->sampleRate); logLine ("sound: only the first twenty minutes are held in memory"); }
        juce::AudioBuffer<float> src ((int) juce::jmin (2u, rd->numChannels), srcLen);
        rd->read (&src, 0, srcLen, 0, true, true);
        juce::AudioBuffer<float> dst;
        if (std::abs (rd->sampleRate - sr) < 1.0) dst = std::move (src);
        else
        {
            const double ratio = rd->sampleRate / sr;
            const int n = (int) ((double) srcLen / ratio), late = (int) std::llround ((double) juce::WindowedSincInterpolator::getBaseLatency() / ratio);   // the interpolator hands its sound over a little late
            juce::AudioBuffer<float> tmp (1, n + late);
            dst.setSize (src.getNumChannels(), n);
            for (int c = 0; c < src.getNumChannels(); ++c)
            {
                juce::WindowedSincInterpolator si;
                si.process (ratio, src.getReadPointer (c), tmp.getWritePointer (0), n + late, srcLen, 0);
                dst.copyFrom (c, 0, tmp, 0, late, n);
            }
        }
        return store ("file:" + String (++nextFile), std::move (dst), o);
    }
    /** How long a file is, without decoding it (0 when it cannot be read). */
    double fileSeconds (const juce::File& f)
    {
        std::unique_ptr<juce::AudioFormatReader> rd (afm.createReaderFor (f));
        return rd != nullptr && rd->sampleRate > 0.0 ? (double) rd->lengthInSamples / rd->sampleRate : 0.0;
    }
    /** Keep a buffer under a key and describe it: {ok, key, sec, peaks}. */
    juce::var store (const String& key, juce::AudioBuffer<float>&& dst, juce::DynamicObject* o = nullptr)
    {
        if (o == nullptr) o = new juce::DynamicObject();
        juce::var result (o);
        describe (dst, *o, key.startsWith ("file:"));
        o->setProperty ("key", key);
        o->setProperty ("ok", true);
        setBuffer (key, std::move (dst));
        return result;
    }
    /** What the page wants to know of a sound: how long it is, its outline (about a hundred points to the second, so a zoom
        still has something to show), and for a file two rough numbers about how it sounds. */
    void describe (const juce::AudioBuffer<float>& dst, juce::DynamicObject& o, bool withTone) const
    {
        juce::Array<juce::var> peaks;
        const int len = dst.getNumSamples(), bins = juce::jlimit (1200, 24000, len / 480);
        for (int k = 0; k < bins; ++k)
        {
            const int i0 = (int) ((juce::int64) k * len / bins), i1 = juce::jmax (i0 + 1, (int) ((juce::int64) (k + 1) * len / bins));
            float m = 0.0f;
            for (int c = 0; c < dst.getNumChannels(); ++c) m = juce::jmax (m, dst.getMagnitude (c, i0, juce::jmin (i1, len) - i0));
            peaks.add (juce::roundToInt (m * 1000.0f) / 1000.0);
        }
        o.setProperty ("sec", (double) len / sr);
        o.setProperty ("peaks", peaks);
        if (withTone) o.setProperty ("tone", toneOf (dst));
    }

    /** Message thread, a few times a second while the song runs: the sound the playhead is coming to is asked for ahead of
        time, so that the device's thread finds it in memory. (Sound that lies in a file is only in memory once it has
        been read; the system reads on along a file by itself, but knows nothing of a jump: the start of the cycle and a
        marker that is waiting are asked for too.) */
    void warm()
    {
        if (bouncing.load() || ! playing.load()) return;
        /*  What it asks for is asked by a thread of its own (his ask, 2026-10-21: the sound never kept waiting on the disk
            while the window is busy): here only where each region's sound lies is laid out for it, and it goes on along
            the song twenty times a second whatever this thread is doing.                                               */
        auto plan = std::make_shared<WarmPlan>();
        plan->barS = barSamples(); plan->sr = sr;
        for (auto& tp : tracks)
            for (auto& r : tp->regs)
            {
                if (r.buf < 0 || r.buf >= (int) bufs.size() || r.loop || tp->dead.load()) continue;
                const auto& b = bufs[(size_t) r.buf];
                if (b == nullptr || b->map == nullptr) continue;
                plan->spans.push_back ({ r.a * plan->barS, r.b * plan->barS, (r.a - r.off) * plan->barS, r.rate, b });
            }
        {
            const std::lock_guard<std::mutex> lk (warmMx);
            warmPlan = plan;
            if (! warmThread.joinable()) warmThread = std::thread ([this] { warmRun(); });
        }
    }
    struct WarmSpan { double a, b, origin, rate; std::shared_ptr<Buf> buf; };      // in the song's samples; origin: where the sound's first sample would stand
    struct WarmPlan { std::vector<WarmSpan> spans; double barS = 1.0, sr = 48000.0; };
    std::mutex warmMx;
    std::condition_variable warmCv;
    std::shared_ptr<const WarmPlan> warmPlan;
    std::thread warmThread;
    bool warmQuit = false;
    /** The read-ahead's own thread: four seconds ahead of the playhead, and two from the start of the cycle and from a
        marker that is waiting, asked of the system (never read here: the system reads them in on its own). */
    void warmRun()
    {
        for (;;)
        {
            std::shared_ptr<const WarmPlan> plan;
            {
                std::unique_lock<std::mutex> lk (warmMx);
                warmCv.wait_for (lk, std::chrono::milliseconds (50), [this] { return warmQuit; });
                if (warmQuit) return;
                plan = warmPlan;
            }
            if (plan == nullptr || ! playing.load() || bouncing.load()) continue;
            const auto ask = [&] (double bar, double seconds)
            {
                const double p0 = bar * plan->barS, p1 = p0 + seconds * plan->sr;
                const auto page = (size_t) ::getpagesize();
                for (auto& s : plan->spans)
                {
                    const double from = juce::jmax (p0, s.a), to = juce::jmin (p1, s.b);
                    if (to <= from) continue;
                    const auto& d = s.buf->data;
                    const juce::int64 len = d.getNumSamples();
                    const juce::int64 i0 = juce::jlimit ((juce::int64) 0, len, (juce::int64) ((from - s.origin) * s.rate)), i1 = juce::jlimit ((juce::int64) 0, len, (juce::int64) ((to - s.origin) * s.rate) + 2);
                    if (i1 <= i0) continue;
                    for (int c = 0; c < d.getNumChannels(); ++c)
                    {
                        const auto a = (size_t) (d.getReadPointer (c) + i0) & ~(page - 1), e = (size_t) (d.getReadPointer (c) + i1);
                        ::madvise ((void*) a, e - a, MADV_WILLNEED);
                    }
                }
            };
            ask (posBars.load(), 4.0);
            if (loop.load()) ask (loopA.load(), 2.0);
            if (const double q = queued.load(); q >= 0.0) ask (q, 2.0);
        }
    }
    /** `now`: read it in before going on (a moment's wait where the song is about to start), not just ask for it. */
    void warmFrom (double bar, double seconds, bool now)
    {
        const double barS = barSamples();
        const juce::int64 p0 = (juce::int64) (bar * barS), p1 = p0 + (juce::int64) (seconds * sr);
        for (auto& tp : tracks)
            for (auto& r : tp->regs)
            {
                if (r.buf < 0 || r.buf >= (int) bufs.size() || r.loop) continue;
                const auto& b = *bufs[(size_t) r.buf];
                if (b.map == nullptr) continue;
                const juce::int64 from = juce::jmax (p0, (juce::int64) std::llround (r.a * barS)), to = juce::jmin (p1, (juce::int64) std::llround (r.b * barS));
                if (to <= from) continue;
                const juce::int64 origin = (juce::int64) std::llround ((r.a - r.off) * barS), len = b.data.getNumSamples();
                const juce::int64 i0 = juce::jlimit ((juce::int64) 0, len, (juce::int64) ((double) (from - origin) * r.rate)), i1 = juce::jlimit ((juce::int64) 0, len, (juce::int64) ((double) (to - origin) * r.rate) + 2);
                if (i1 <= i0) continue;
                for (int c = 0; c < b.data.getNumChannels(); ++c)
                {
                    const auto page = (size_t) ::getpagesize();
                    auto a = (size_t) (b.data.getReadPointer (c) + i0) & ~(page - 1);
                    const auto e = (size_t) (b.data.getReadPointer (c) + i1);
                    if (! now) { ::madvise ((void*) a, e - a, MADV_WILLNEED); continue; }
                    unsigned int seen = 0;
                    for (; a < e; a += page) seen += *reinterpret_cast<const volatile unsigned char*> (a);
                    juce::ignoreUnused (seen);
                }
            }
    }

    /** The cache of decoded sound, kept from growing without end: what has not been opened for six weeks goes; beyond
        thirty gigabytes (a tenth of the disk, where that is less) the longest unused goes first; and when the disk has
        less room left than the cache must leave it (soundKeepFree), the cache gives its own back, longest unused first.
        On a thread of its own, once, a while after the app is up. */
    static void tidySound()
    {
        juce::Thread::launch ([]
        {
            juce::Thread::sleep (20000);
            auto list = soundRoot().findChildFiles (juce::File::findFiles, false, "*.json");
            struct Item { juce::File about, snd; juce::Time used; juce::int64 size; };
            std::vector<Item> items;
            for (auto& a : list) { const auto snd = a.withFileExtension (".snd"); items.push_back ({ a, snd, a.getLastModificationTime(), snd.getSize() }); }
            for (auto& orphan : soundRoot().findChildFiles (juce::File::findFiles, false, "*.part")) if (juce::Time::getCurrentTime() - orphan.getLastModificationTime() > juce::RelativeTime::hours (2)) orphan.deleteFile();
            std::sort (items.begin(), items.end(), [] (const Item& x, const Item& y) { return x.used > y.used; });
            const auto root = soundRoot();
            const juce::int64 gb = (juce::int64) 1 << 30, disk = root.getVolumeTotalSize(), most = juce::jmin (30 * gb, disk > 0 ? disk / 10 : 30 * gb);
            juce::int64 total = 0;
            std::vector<Item*> kept;
            for (auto& it : items)
            {
                total += it.size;
                if (juce::Time::getCurrentTime() - it.used > juce::RelativeTime::days (42) || total > most) { it.snd.deleteFile(); it.about.deleteFile(); }
                else kept.push_back (&it);
            }
            // (the room a deleted file gives back does not always show at once — and never while this very app has it open — so what was given is counted here, not asked for again)
            const juce::int64 free = root.getBytesFreeOnVolume(), keep = soundKeepFree (root);
            juce::int64 given = 0;
            auto longer = [] (const Item& it) { const auto m = juce::JSON::parse (it.about); const double rate = (double) m["rate"]; return rate > 0.0 && (double) m["frames"] / rate > 60.0 * 20.0; };
            for (auto k = kept.rbegin(); k != kept.rend() && free + given < keep; ++k)
            {
                if (free + given >= gb && longer (**k)) continue;      // a file longer than memory is given can only be whole on the disk: it was let in with a single gigabyte to spare (see mapped), and goes only below that
                given += (*k)->size; (*k)->snd.deleteFile(); (*k)->about.deleteFile();
            }
        });
    }
    /** Two rough numbers about how a file sounds, for the page to guess what was played (it has the outline already):
        how much of its energy lies below about 150 Hz, and how often it crosses zero (about its pitch, when it has one). */
    juce::var toneOf (const juce::AudioBuffer<float>& b) const
    {
        const int n = juce::jmin (b.getNumSamples(), (int) (sr * 60.0)), ch = b.getNumChannels();
        const float a = 1.0f - std::exp (-juce::MathConstants<float>::twoPi * 150.0f / (float) sr);
        double all = 0.0, low = 0.0;
        float l1 = 0.0f, l2 = 0.0f, prev = 0.0f;
        int crossings = 0;
        for (int i = 0; i < n; ++i)
        {
            float x = 0.0f;
            for (int c = 0; c < ch; ++c) x += b.getSample (c, i);
            x /= (float) juce::jmax (1, ch);
            l1 += a * (x - l1); l2 += a * (l1 - l2);
            all += (double) x * x; low += (double) l2 * l2;
            if ((x >= 0.0f) != (prev >= 0.0f)) ++crossings;
            prev = x;
        }
        auto* o = new juce::DynamicObject();
        o->setProperty ("low", all > 1e-9 ? juce::roundToInt (low / all * 1000.0) / 1000.0 : 0.0);
        o->setProperty ("zc", n > 0 ? juce::roundToInt ((double) crossings / ((double) n / sr) / 2.0) : 0);
        return juce::var (o);
    }

    /** A new buffer from an old one: transposed, and warped along a time map. Runs on its own thread.
        {src, semis, rate, marks: [[sourceSec, outSec]…], loop, reverse} -> {ok, key, sec, peaks} */
    void stretch (const juce::var& o, std::function<void (juce::var)> done)
    {
        auto src = buffer (o["src"].toString());
        if (src == nullptr || src->data.getNumSamples() < 64) { auto* r = new juce::DynamicObject(); r->setProperty ("ok", false); done (juce::var (r)); return; }
        const String key = "warp:" + String (++nextFile);
        juce::Thread::launch ([this, sr0 = sr, o, src, key, done]         // (the engine's rate as it is now: the thread reads nothing of the engine while it works)
        {
            const double semis = (double) o["semis"], rate = juce::jlimit (0.25, 4.0, o.hasProperty ("rate") ? (double) o["rate"] : 1.0);
            std::vector<WarpPoint> map;
            if (auto* m = o["marks"].getArray()) for (auto& p : *m) map.push_back ({ (double) p[0], (double) p[1] });
            const double outSec = (double) src->data.getNumSamples() / sr0 / rate;
            const auto t0 = juce::Time::getMillisecondCounterHiRes();
            /* how the track is stretched (Modes.h): voice, cut and beat lay the pieces between its pins and its hits (`cuts`,
               seconds of the source, as the page shows them) by themselves; chords — and a loop, or a sound played
               backwards — goes through the phase vocoder. A new pitch is given after, the time as it is. */
            const String how = o["mode"].toString();
            const auto mode = how == "voice" ? slur::StretchMode::voice : how == "cut" ? slur::StretchMode::cut : how == "beat" ? slur::StretchMode::beat : slur::StretchMode::chords;
            const bool loop = (int) o["loop"] != 0, reverse = (int) o["reverse"] != 0;
            juce::AudioBuffer<float> out;
            if (mode != slur::StretchMode::chords && ! loop && ! reverse)
            {
                std::vector<slur::Pin> pins;
                for (auto& w : map) pins.push_back ({ w.s, w.d });
                std::vector<double> cuts;
                if (auto* c = o["cuts"].getArray()) for (auto& v : *c) cuts.push_back ((double) v);
                const int outN = (int) std::llround (outSec * sr0);
                out.setSize (src->data.getNumChannels(), juce::jmax (64, outN));
                slur::renderMode (mode, src->data.getArrayOfReadPointers(), src->data.getNumChannels(), src->data.getNumSamples(), sr0, pins, cuts, out.getArrayOfWritePointers(), out.getNumSamples());
                if (std::abs (semis) > 1.0e-6) out = warp (out, sr0, semis, {}, (double) out.getNumSamples() / sr0, false, false);
            }
            else out = warp (src->data, sr0, semis, map, outSec, loop, reverse);
            logLine ("warp: " + String (outSec, 2) + " s, " + String (semis) + " st, " + String ((int) map.size()) + " pins, by " + (how.isEmpty() ? String ("chords") : how) + ", in " + String (juce::Time::getMillisecondCounterHiRes() - t0, 0) + " ms");
            auto* shared = new juce::AudioBuffer<float> (std::move (out));
            juce::MessageManager::callAsync ([this, shared, key, done]
            {
                std::unique_ptr<juce::AudioBuffer<float>> b (shared);
                auto* r = new juce::DynamicObject();
                if (b->getNumSamples() < 64) { r->setProperty ("ok", false); done (juce::var (r)); return; }
                done (store (key, std::move (*b), r));
            });
        });
    }

    /** Where things begin in a buffer (Transients.h): [{s: seconds, k: 0 a hit | 1 a note, v: how sure}], every place
        that could be wanted — which of them are shown is the page's to choose, by a sensitivity. Runs on its own thread. */
    void findOnsets (const String& key, std::function<void (juce::var)> done)
    {
        auto src = buffer (key);
        if (src == nullptr) { done (juce::Array<juce::var>()); return; }
        juce::Thread::launch ([sr0 = sr, src, done]
        {
            const auto found = slur::transients (src->data.getArrayOfReadPointers(), src->data.getNumChannels(), src->data.getNumSamples(), sr0);
            juce::Array<juce::var> out;
            for (const auto& h : found)
            {
                auto* o = new juce::DynamicObject();
                o->setProperty ("s", juce::roundToInt (h.s * 100000.0) / 100000.0);
                o->setProperty ("k", h.kind);
                o->setProperty ("v", juce::roundToInt (h.score * 1000.0f) / 1000.0);
                out.add (juce::var (o));
            }
            juce::MessageManager::callAsync ([done, out] { done (out); });
        });
    }

    /** A stretch of a buffer for the eye, closer than its outline goes: from sample `from` up to `to`, in `n` steps — the
        lowest and the highest sample of each step on any channel (as the outline is the loudest on any). Where there are
        no more samples than steps, each step is one sample: lo is hi for one channel, and for two they are the two
        channels' samples, lower and higher. -> {ok, from, to, n, rate, lo: […], hi: […]} */
    juce::var wave (const String& key, double from, double to, int n)
    {
        auto* o = new juce::DynamicObject();
        juce::var result (o);
        const auto src = buffer (key);
        if (src == nullptr || src->data.getNumSamples() < 1) { o->setProperty ("ok", false); return result; }
        const auto& b = src->data;
        const int len = b.getNumSamples(), ch = b.getNumChannels();
        const juce::int64 i0 = juce::jlimit ((juce::int64) 0, (juce::int64) len, (juce::int64) std::floor (from)), i1 = juce::jlimit (i0, (juce::int64) len, (juce::int64) std::ceil (to));
        const int count = (int) (i1 - i0), steps = juce::jlimit (1, 4096, juce::jmin (n, juce::jmax (1, count)));
        juce::Array<juce::var> lo, hi;
        lo.ensureStorageAllocated (steps); hi.ensureStorageAllocated (steps);
        for (int k = 0; k < steps && count > 0; ++k)
        {
            const int a = (int) (i0 + (juce::int64) k * count / steps), e = juce::jmax (a + 1, (int) (i0 + (juce::int64) (k + 1) * count / steps));
            const int stride = juce::jmax (1, (e - a) / 2048);                 // (a very long step is read in passing: this is for the eye)
            float mn = 1.0e9f, mx = -1.0e9f;
            for (int c = 0; c < ch; ++c)
            {
                const float* p = b.getReadPointer (c);
                for (int i = a; i < e && i < len; i += stride) { mn = juce::jmin (mn, p[i]); mx = juce::jmax (mx, p[i]); }
            }
            if (mn > mx) mn = mx = 0.0f;
            lo.add (juce::roundToInt (mn * 10000.0f) / 10000.0); hi.add (juce::roundToInt (mx * 10000.0f) / 10000.0);
        }
        o->setProperty ("ok", true); o->setProperty ("from", (double) i0); o->setProperty ("to", (double) i1); o->setProperty ("n", lo.size()); o->setProperty ("rate", sr);
        o->setProperty ("lo", lo); o->setProperty ("hi", hi);
        return result;
    }

    /** How fast a buffer goes, heard from its sound: {bpm, sure, first, loop} (see tempoOf). Runs on its own thread. */
    void findTempo (const String& key, std::function<void (juce::var)> done)
    {
        auto src = buffer (key);
        if (src == nullptr) { done (juce::var()); return; }
        juce::Thread::launch ([sr0 = sr, src, done]
        {
            const auto t = tempoOf (src->data, sr0);
            juce::MessageManager::callAsync ([done, t]
            {
                auto* o = new juce::DynamicObject();
                o->setProperty ("bpm", juce::roundToInt (t.bpm * 100.0) / 100.0); o->setProperty ("sure", juce::roundToInt (t.sure * 1000.0) / 1000.0);
                o->setProperty ("first", juce::roundToInt (t.first * 10000.0) / 10000.0); o->setProperty ("loop", juce::roundToInt (t.loop * 1000.0) / 1000.0);
                done (juce::var (o));
            });
        });
    }

    /** The stretches of a buffer in which there is sound: [[from, to] …] in seconds (see soundParts). Runs on its own thread. */
    void findSound (const String& key, double floorDb, double gap, double pre, double post, std::function<void (juce::var)> done)
    {
        auto src = buffer (key);
        if (src == nullptr) { done (juce::var()); return; }
        juce::Thread::launch ([sr0 = sr, src, floorDb, gap, pre, post, done]
        {
            const auto parts = soundParts (src->data, sr0, floorDb, gap, pre, post);
            juce::MessageManager::callAsync ([done, parts]
            {
                juce::Array<juce::var> out;
                for (const auto& p : parts) { juce::Array<juce::var> one; one.add (juce::roundToInt (p.first * 100000.0) / 100000.0); one.add (juce::roundToInt (p.second * 100000.0) / 100000.0); out.add (one); }
                done (out);
            });
        });
    }

    /** Print to disk, on its own thread, with the speakers standing by.
        kind "stems": each asked-for track after its fader, through its patch and plug-ins ("wet") or bare ("dry").
        kind "mix":   everything, as it goes to the speakers.
        kind "place": each asked-for track before its fader, into the project, decoded and handed back.
        {kind, a0, a1, tracks: [{id, name}], modes, folder | dir, name, fmt, rate, bits} */
    void exportAudio (const juce::var& opts, std::function<void (int, int)> progress, std::function<void (juce::var)> done)
    {
        printCancel.store (false);                                     // (esc, while it prints: printStop)
        if (recording.load() || bouncing.exchange (true)) { auto* o = new juce::DynamicObject(); o->setProperty ("ok", false); done (juce::var (o)); return; }
        playing.store (false);
        startPrint (done, [this, opts, progress] (PrintEnd& end)
        {
            juce::ScopedNoDenormals noDenormals;                       // (as the device's thread and the hands have it: whoever plays a track, its dying tail comes out the same)
            { const juce::ScopedLock sl (lock); printBufs = bufs; }    // let a callback that is mid-block finish (after this it sees `bouncing`), and take the sounds as they are now
            const String kind = opts["kind"].toString();
            const bool place = kind == "place", mixdown = kind == "mix";
            auto halted = [this] { return leaving.load() || printCancel.load(); };
            std::vector<juce::File> written;                           // (what it has finished writing: taken away again if it is stopped)
            const double a0 = (double) opts["a0"], a1 = (double) opts["a1"], barS = barSamples();
            const auto outs = printOuts (opts, place, sr);           // every file the pass is written into (several: each made from the same sound as it goes)
            const String fmt = outs.front().fmt;
            auto dir = opts.hasProperty ("dir") ? juce::File (opts["dir"].toString())
                                                : musicRoot().getChildFile (opts["folder"].toString() + " " + juce::Time::getCurrentTime().formatted ("%H%M%S"));
            dir.createDirectory();
            juce::StringArray modes; if (auto* m = opts["modes"].getArray()) for (auto& x : *m) modes.add (x.toString());
            if (modes.isEmpty() || mixdown || place) { modes.clear(); modes.add ("wet"); }
            const auto* list = opts["tracks"].getArray();
            const int total = mixdown ? 1 : (list != nullptr ? list->size() * modes.size() : 0);
            int doneN = 0; bool ok = total > 0; String why;
            juce::Array<juce::var> placed;
            const juce::int64 s0 = (juce::int64) std::llround (a0 * barS), s1 = (juce::int64) std::llround (a1 * barS);
            const float keepLim = limG;
            for (auto& tp : tracks) tp->eachPlug ([] (Insert& i) { i.offline (true); });
            measureLatency();

            // one pass over the range: the whole graph runs; `tap` says which sound is kept. It is written into every file
            // asked for at once (one a kind, a rate, a depth), each converting it its own way
            auto pass = [&] (Tap* tap, const std::vector<juce::File>& files, double tailSec)
            {
                std::vector<std::unique_ptr<Sink>> sinks;
                for (size_t k = 0; k < outs.size(); ++k)
                {
                    auto sk = std::make_unique<Sink>();
                    sk->stop = &leaving;
                    files[k].getParentDirectory().createDirectory();
                    const auto err = sk->open (files[k], outs[k].fmt, sr, outs[k].rate, outs[k].bits, lame, outs[k].kbps);
                    if (err.isNotEmpty()) { sk->abandon(); for (auto& q : sinks) q->abandon(); ok = false; why = err; return; }
                    sinks.push_back (std::move (sk));
                }
                struct Making { Engine& e; Making (Engine& en, const std::vector<juce::File>& fs) : e (en) { const juce::ScopedLock sl (e.printFileLock); e.printFiles.clear(); for (auto& f : fs) { e.printFiles.add (f); e.printFiles.add (f.getSiblingFile (f.getFileNameWithoutExtension() + ".tmp.wav")); } }
                                ~Making() { const juce::ScopedLock sl (e.printFileLock); e.printFiles.clear(); } } making { *this, files };
                const juce::int64 tail = (juce::int64) (sr * tailSec);
                for (auto& tp : tracks) { tp->gainSm = dbGainOf (*tp, a0); tp->panSm = tp->pan.load(); quietNotes (*tp); }
                /* old tails die away first: a second and a half, and on until nothing at all comes out of any track for a
                   quarter of a second (a delay fed back, a long reverb: what was played before must not ring into the
                   print — a track frozen right after a print had its echoes at its start), thirty seconds at most */
                for (juce::int64 k = 0, still = 0; k < (juce::int64) (sr * 30.0) && ! halted() && (k < (juce::int64) (sr * 1.5) || still < (juce::int64) (sr * 0.25)); k += maxBlock)
                {
                    renderGraph (s0, maxBlock, false, true, nullptr, a1, tap);
                    bool quiet = quietIn (mix.getReadPointer (0), mix.getReadPointer (1), maxBlock);
                    for (auto& tp : tracks) if (quiet && ! quietIn (tp->work.getReadPointer (0), tp->work.getReadPointer (1), maxBlock)) quiet = false;
                    still = quiet ? still + maxBlock : 0;
                }
                measureLatency();                                      // (some only say how late they are offline once they have played a block that way)
                limG = 1.0f; float mSm = master.load();
                juce::AudioBuffer<float> outBuf (2, maxBlock);
                int lead = 0; for (auto& tp : tracks) lead = juce::jmax (lead, tp->ahead.load());
                /* where a track's sound leaves it, it is still early by what the buses on its way to the out will make up
                   for (Track::early; before its own plug-ins, by all it is read ahead): the stretch is played that much
                   sooner, so its file begins on the range's first sample (a print of a track whose send goes to a bus with
                   a latent plug-in came out early by that plug-in's latency: his report, 2026-10-21) */
                const juce::int64 E = tap != nullptr && tap->t != nullptr ? (juce::int64) (tap->dry ? tap->t->ahead.load() : tap->t->early.load()) : 0;
                for (juce::int64 p = s0 - E - lead; p < s0 - E && ! halted(); )
                {
                    const int n = (int) juce::jmin ((juce::int64) maxBlock, s0 - E - p);
                    renderGraph (p, n, true, true, nullptr, a1, tap);
                    p += n;
                }
                printPart.store (0.0f);
                auto partTold = juce::Time::getMillisecondCounter(); float partWas = 0.0f;
                for (juce::int64 p = s0 - E; p < s1 + tail - E && ! halted(); p += maxBlock)
                {
                    const int n = (int) juce::jmin ((juce::int64) maxBlock, s1 + tail - E - p);
                    renderGraph (p, n, true, true, nullptr, a1, tap);
                    /* how far along this file is, told about ten times a second, and at every tenth of the way (progress with -1: no file more is done, only this) */
                    const float part = (float) ((double) (p - (s0 - E) + n) / (double) juce::jmax ((juce::int64) 1, s1 + tail - s0));
                    printPart.store (part);
                    if (const auto nowMs = juce::Time::getMillisecondCounter(); nowMs - partTold > 90 || part - partWas >= 0.1f) { partTold = nowMs; partWas = part; juce::MessageManager::callAsync ([progress, part] { progress (-1, juce::roundToInt (part * 1000.0f)); }); }
                    if (tap != nullptr) for (auto& sk : sinks) sk->write (tap->buf, n);
                    else
                    {
                        const float* mL = mix.getReadPointer (0); const float* mR = mix.getReadPointer (1);
                        float* oL = outBuf.getWritePointer (0); float* oR = outBuf.getWritePointer (1);
                        const float mT = master.load(), ms = (mT - mSm) / (float) n;
                        for (int i = 0; i < n; ++i) { mSm += ms; float l = mL[i] * mSm, r = mR[i] * mSm; limit (l, r); oL[i] = l; oR[i] = r; }
                        for (auto& sk : sinks) sk->write (outBuf, n);
                    }
                }
                if (halted()) { for (auto& sk : sinks) sk->abandon(); ok = false; if (why.isEmpty()) why = leaving.load() ? "the app was closed" : "stopped"; return; }      // the app is going, or esc was pressed: half a file is no file
                for (auto& sk : sinks) if (! sk->close()) { ok = false; if (why.isEmpty()) why = "the file would not close"; }
                for (auto& f : files) written.push_back (f);
            };
            auto filesOf = [&] (const String& name) { std::vector<juce::File> fs; for (auto& o : outs) fs.push_back (printFileOf (dir, name, o, mixdown)); return fs; };
            auto emptySubs = [&] { if (! mixdown) for (auto& o : outs) if (o.sub.isNotEmpty()) { const auto d = dir.getChildFile (juce::File::createLegalFileName (o.sub)); if (d.isDirectory() && d.getNumberOfChildFiles (juce::File::findFilesAndDirectories) == 0) d.deleteFile(); } };

            const String ext = "." + fmt;
            if (mixdown)
            {
                pass (nullptr, filesOf (opts["name"].toString()), 2.5);
                ++doneN;
                juce::MessageManager::callAsync ([progress, doneN, total] { progress (doneN, total); });
            }
            else if (list != nullptr)
                for (auto& tv : *list)
                {
                    if (halted()) break;
                    auto* t = find ((int) tv["id"]);
                    for (auto& mode : modes)
                    {
                        if (halted()) break;
                        if (t != nullptr)
                        {
                            Tap tap;
                            tap.t = t; tap.pre = place; tap.dry = mode == "dry";
                            tap.buf.setSize (2, maxBlock);
                            tap.buf.clear();
                            tap.only = upstream (t);
                            const bool wet = ! tap.dry;
                            const auto files = place ? std::vector<juce::File> { dir.getNonexistentChildFile (juce::File::createLegalFileName (tv["name"].toString()), ext, false) }
                                                     : filesOf (tv["name"].toString() + (modes.size() > 1 ? (wet ? " patch" : " dry") : String()));
                            const auto& file = files.front();
                            pass (&tap, files, place ? (double) opts["tail"] : (wet ? 2.5 : 0.05));
                            if (place && ok)
                            {
                                auto v = decodeFile (file);
                                if (auto* d = v.getDynamicObject()) { d->setProperty ("track", t->id); d->setProperty ("file", file.getFileName()); d->setProperty ("name", file.getFileNameWithoutExtension()); }
                                placed.add (v);
                            }
                        }
                        ++doneN;
                        juce::MessageManager::callAsync ([progress, doneN, total] { progress (doneN, total); });
                    }
                }
            limG = keepLim;
            if (printCancel.load() && ! leaving.load())                    // stopped by hand: nothing of it is kept — what it had written goes, and its folder if that is now empty
            {
                ok = false; why = "stopped";
                for (auto& wf : written) wf.deleteFile();
                placed.clear();
                emptySubs();
                if (! place && dir.isDirectory() && dir.getNumberOfChildFiles (juce::File::findFilesAndDirectories) == 0) dir.deleteFile();
            }
            const bool single = (int) opts["single"] != 0;                 // the mix as one file in a folder that is the person's own (not one made for the print): that folder is never taken away, and the file is what is shown
            if (! ok && ! place) emptySubs();
            if (! ok && ! place && ! single && dir.getNumberOfChildFiles (juce::File::findFilesAndDirectories) == 0) dir.deleteFile();
            end.finish();
            auto* o = new juce::DynamicObject();
            o->setProperty ("ok", ok); o->setProperty ("dir", dir.getFullPathName()); o->setProperty ("count", doneN);
            if (why.isNotEmpty()) o->setProperty ("error", why);
            if (place) o->setProperty ("placed", placed);
            logLine ("print: " + kind + ", " + String (doneN) + " files in " + dir.getFullPathName() + (why.isNotEmpty() ? "  (" + why + ")" : String()));
            const bool show = ok && ! quiet && ! place;
            const auto shown = single ? printFileOf (dir, opts["name"].toString(), outs.front(), true) : dir;
            end.answer (juce::var (o), show ? std::function<void()> ([shown] { shown.revealToUser(); }) : std::function<void()>());
        });
    }

    /** How each asked-for track sounds over a stretch, as numbers (daw::Listen): one offline pass a track, after its fader
        and through its patch and plug-ins — what is heard of it — with only what feeds it sounding, as a stem is printed.
        Nothing is written. {a0, a1 (bars from zero), tracks: [id] (0: the whole mix), band: [lo, hi] hz (asked for: near),
        as: own | solo | rest} → {ok, hop and fast (seconds), centres (hz), tracks: [{id, bands, level, kl, side, corr,
        fast, peak, ltas, mid, sideBands, lr, near}]}. As: `own` the track after its fader (what flows into it sounding);
        `solo` the track as the stereo out has it — through the buses it plays into and what it sends to, alone in them
        (how far back its sends put it); `rest` the stereo out without it (what it has to be heard against). The command
        line's ways are chosen and measured by it (design/choices draft 1, ui/ears.js). */
    void listen (const juce::var& opts, std::function<void (juce::var)> done)
    {
        if (recording.load() || bouncing.exchange (true)) { auto* o = new juce::DynamicObject(); o->setProperty ("ok", false); o->setProperty ("error", "busy"); done (juce::var (o)); return; }
        playing.store (false);
        startPrint (done, [this, opts] (PrintEnd& end)
        {
            juce::ScopedNoDenormals noDenormals;
            { const juce::ScopedLock sl (lock); printBufs = bufs; }
            const double a0 = (double) opts["a0"], a1 = (double) opts["a1"], barS = barSamples();
            const juce::int64 s0 = (juce::int64) std::llround (a0 * barS), s1 = (juce::int64) std::llround (a1 * barS);
            for (auto& tp : tracks) tp->eachPlug ([] (Insert& i) { i.offline (true); });
            measureLatency();
            juce::Array<juce::var> heard;
            bool ok = s1 > s0;
            const auto* band = opts["band"].getArray();
            const String as = opts["as"].toString();
            const double lo = band != nullptr && band->size() == 2 ? (double) (*band)[0] : 0.0, hi = band != nullptr && band->size() == 2 ? (double) (*band)[1] : 0.0;
            if (auto* list = opts["tracks"].getArray())
                for (auto& tv : *list)
                {
                    if (leaving.load()) { ok = false; break; }
                    const int id = (int) tv;                                   // (0: the whole mix, as it goes to the stereo out before its own fader — for levels to be matched by)
                    auto* t = id != 0 ? find (id) : nullptr;
                    if (id != 0 && t == nullptr) continue;
                    Tap tapOne;
                    Tap* tap = nullptr;
                    if (t != nullptr && as == "solo")                          // (no track kept: the stereo out is heard, with only these in it)
                    {
                        tapOne.only = upstream (t);
                        for (auto* d : downstream (t)) tapOne.only.insert (d);
                        tap = &tapOne;
                    }
                    else if (t != nullptr && as == "rest") { for (auto& tp : tracks) if (tp.get() != t) tapOne.only.insert (tp.get()); tap = &tapOne; }
                    else if (t != nullptr) { tapOne.t = t; tapOne.buf.setSize (2, maxBlock); tapOne.buf.clear(); tapOne.only = upstream (t); tap = &tapOne; }
                    daw::Listen ear (sr, lo, hi);
                    for (auto& tp : tracks) { tp->gainSm = dbGainOf (*tp, a0); tp->panSm = tp->pan.load(); quietNotes (*tp); }
                    for (juce::int64 k = 0; k < (juce::int64) (sr * 1.5) && ! leaving.load(); k += maxBlock) renderGraph (s0, maxBlock, false, true, nullptr, a1, tap);      // (old tails die away first, as for a print)
                    measureLatency();
                    int lead = 0; for (auto& tp : tracks) lead = juce::jmax (lead, tp->ahead.load());
                    const juce::int64 E = tap != nullptr && tap->t != nullptr ? (juce::int64) tap->t->early.load() : 0;      // (a track heard where it leaves itself is early by what its way on makes up for: as a print, exportAudio)
                    for (juce::int64 p = s0 - E - lead; p < s0 - E && ! leaving.load(); ) { const int n = (int) juce::jmin ((juce::int64) maxBlock, s0 - E - p); renderGraph (p, n, true, true, nullptr, a1, tap); p += n; }
                    for (juce::int64 p = s0 - E; p < s1 - E && ! leaving.load(); p += maxBlock)
                    {
                        const int n = (int) juce::jmin ((juce::int64) maxBlock, s1 - E - p);
                        renderGraph (p, n, true, true, nullptr, a1, tap);
                        const auto& got = tap != nullptr && tap->t != nullptr ? tap->buf : mix;
                        ear.push (got.getReadPointer (0), got.getReadPointer (1), n);
                    }
                    auto v = ear.result();
                    if (auto* d = v.getDynamicObject()) d->setProperty ("id", id);
                    heard.add (v);
                }
            end.finish();
            auto* o = new juce::DynamicObject();
            juce::Array<juce::var> cs; for (int b = 0; b < daw::Listen::BANDS; ++b) cs.add (daw::Listen::centres()[b]);
            o->setProperty ("ok", ok && ! leaving.load()); o->setProperty ("hop", (double) daw::Listen::HOP / sr); o->setProperty ("fast", (double) daw::Listen::FAST / sr); o->setProperty ("centres", cs); o->setProperty ("tracks", heard);
            logLine ("listen: " + String (heard.size()) + " tracks, bars " + String (a0 + 1.0, 2) + " to " + String (a1 + 1.0, 2));
            end.answer (juce::var (o));
        });
    }

    /** A plug-in learnt by what it does (Source/Probe.h, ui/probe.js): sound of a known kind through one plug-in on a
        track — and nothing else — offline, with some of its controls set for the while; then its controls as they were,
        and its tails let go. {track, uid, sig, set: [[index, v]], hz, db} → {ok, lat (samples), what the signal answers} */
    void probe (const juce::var& opts, std::function<void (juce::var)> done)
    {
        if (recording.load() || bouncing.exchange (true)) { auto* o = new juce::DynamicObject(); o->setProperty ("ok", false); o->setProperty ("error", "busy"); done (juce::var (o)); return; }
        playing.store (false);
        startPrint (done, [this, opts] (PrintEnd& end)
        {
            juce::ScopedNoDenormals noDenormals;
            Insert* ins = nullptr;
            const int uid = (int) opts["uid"];
            if (auto* t = find ((int) opts["track"])) t->eachPlug ([&ins, uid] (Insert& i) { if (i.uid == uid) ins = &i; });
            juce::var res;
            if (ins == nullptr || ! ins->there()) { auto* o = new juce::DynamicObject(); o->setProperty ("ok", false); o->setProperty ("error", "no such plug-in"); res = juce::var (o); }
            else
            {
                ins->offline (true);
                auto valueOf = [ins] (int k) -> float
                {
                    if (ins->own != nullptr) return k >= 0 && k < ins->own->controls() ? ins->own->control (k) : -1.0f;
                    const auto& ps = ins->inst->getParameters();
                    return k >= 0 && k < ps.size() ? ps.getUnchecked (k)->getValue() : -1.0f;
                };
                std::vector<std::pair<int, float>> was;                // (what each control stood at, to be put back)
                if (auto* list = opts["set"].getArray())
                    for (auto& sv : *list)
                    {
                        const int k = (int) sv[0]; const float v = (float) (double) sv[1];
                        was.push_back ({ k, valueOf (k) });
                        float told = -1.0f; ins->setParam (k, v, told);
                    }
                auto clear = [ins] { if (ins->own != nullptr) ins->own->reset(); else if (ins->inst != nullptr) ins->inst->reset(); };
                clear();
                daw::Probe pr (sr, maxBlock, [ins] (float* L, float* R, int n) { ins->process (L, R, n); });
                pr.lat = ins->latencyNow();
                res = pr.measure (opts["sig"].toString(), opts.getProperty ("hz", 1000.0), opts.getProperty ("db", -12.0));
                if (auto* d = res.getDynamicObject()) { if (! d->hasProperty ("error")) d->setProperty ("ok", true); d->setProperty ("lat", ins->latencyNow()); }
                for (auto it = was.rbegin(); it != was.rend(); ++it) if (it->second >= 0.0f) { float told = -1.0f; ins->setParam (it->first, it->second, told); }
                clear();
            }
            end.finish();
            end.answer (res);
        });
    }

    /** A print played through in real time (his ask, 2026-10-16: "realtime" beside "offline", as Logic has them; drawn for
        him in design/realtime bounce draft 1): the song plays from a0 as it always does — heard, and drawn by the page —
        and what it prints is written as it goes; the files are made into what was asked for once the range and its tail
        have gone by. Same options and the same answer as exportAudio (kind mix | stems | place; stems print with the
        patch: a track cannot be heard both ways at once). `done` is called when it ends, kept or not (liveStop). */
    void liveStart (const juce::var& opts, std::function<void (juce::var)> done)
    {
        auto fail = [&] (const String& why) { auto* o = new juce::DynamicObject(); o->setProperty ("ok", false); o->setProperty ("error", why); done (juce::var (o)); };
        if (bouncing.load() || recording.load() || livePhase.load() != 0) { fail ("busy"); return; }
        const String kind = opts["kind"].toString();
        const bool place = kind == "place", mixdown = kind == "mix";
        const double a0 = (double) opts["a0"], a1 = (double) opts["a1"], barS = barSamples();
        if (! (a1 > a0)) { fail ("nothing to print"); return; }
        String fmt = place ? String ("wav") : opts["fmt"].toString();
        if (fmt.isEmpty()) fmt = "wav";
        auto dir = opts.hasProperty ("dir") ? juce::File (opts["dir"].toString()) : musicRoot().getChildFile (opts["folder"].toString() + " " + juce::Time::getCurrentTime().formatted ("%H%M%S"));
        dir.createDirectory();
        if (dir.getBytesFreeOnVolume() < (juce::int64) 300 * 1024 * 1024) { fail ("the disk is full"); return; }
        std::vector<std::unique_ptr<LiveOut>> outs;
        juce::WavAudioFormat wav;
        const String ext = "." + fmt;
        auto make = [&] (Track* t, bool pre, const juce::File& file, const juce::var& tv) -> bool
        {
            auto lo = std::make_unique<LiveOut>();
            lo->t = t; lo->pre = pre; lo->file = file; lo->tv = tv;
            lo->tmp = dir.getChildFile ("." + file.getFileNameWithoutExtension() + " realtime.wav");
            lo->tmp.deleteFile();
            std::unique_ptr<juce::OutputStream> os = lo->tmp.createOutputStream();
            if (os == nullptr) return false;
            auto w = wav.createWriterFor (os, juce::AudioFormatWriterOptions{}.withSampleRate (sr).withNumChannels (2).withBitsPerSample (32).withSampleFormat (juce::AudioFormatWriterOptions::SampleFormat::floatingPoint));
            if (w == nullptr) return false;
            lo->tw = std::make_unique<juce::AudioFormatWriter::ThreadedWriter> (w.release(), recThread, 1 << 18);
            lo->buf.setSize (2, maxBlock); lo->buf.clear();
            outs.push_back (std::move (lo));
            return true;
        };
        bool made = true;
        if (mixdown) made = make (nullptr, false, dir.getChildFile (juce::File::createLegalFileName (opts["name"].toString()) + ext), juce::var());
        else if (auto* list = opts["tracks"].getArray())
            for (auto& tv : *list)
                if (auto* t = find ((int) tv["id"]))
                    made = make (t, place, place ? dir.getNonexistentChildFile (juce::File::createLegalFileName (tv["name"].toString()), ext, false)
                                                  : dir.getChildFile (juce::File::createLegalFileName (tv["name"].toString()) + ext), tv) && made;
        if (! made || outs.empty()) { for (auto& lo : outs) { lo->tw.reset(); lo->tmp.deleteFile(); } fail ("the file would not open"); return; }
        const double tail = place ? (double) opts["tail"] : 2.5;
        {
            const juce::ScopedLock sl (lock);
            for (auto& lo : outs) { if (lo->t != nullptr) lo->t->printLive = lo.get(); else liveMixOut = lo.get(); }
            lives.swap (outs);
            liveS0 = (juce::int64) std::llround (a0 * barS);
            liveTotal = (juce::int64) std::llround ((a1 - a0) * barS + tail * sr);
            liveWritten = 0;
            for (auto& lo : lives) { lo->from = liveS0 - (lo->t != nullptr ? (juce::int64) lo->t->early.load() : 0); lo->written = 0; }
        }
        juce::int64 first = liveS0; for (auto& lo : lives) first = juce::jmin (first, lo->from);
        liveOpts = opts; liveDir = dir; liveDone = std::move (done); liveFmt = fmt;
        liveLoopWas = loop.load(); loop.store (false);                       // (the range is played once, from its start to its end)
        for (auto& tp : tracks) tp->fineR = tp->fineW.load();
        fineOn.store (true);
        livePhase.store (1);
        play (juce::jmax (0.0, (double) juce::jmin (liveS0 - (juce::int64) (0.25 * sr), first - (juce::int64) (0.05 * sr)) / barS));      // a quarter of a second before it (what is already sounding there has begun), sooner where a file must begin sooner
        logLine ("realtime print: " + kind + ", " + String ((int) lives.size()) + " files, bars " + String (a0 + 1.0) + " to " + String (a1 + 1.0));
    }
    /** Stop a print (offline: printCancel; realtime: liveStop): nothing of it is kept. */
    void printStop() { printCancel.store (true); liveStop(); }
    /** Stop a realtime print before its end: nothing it wrote is kept. */
    void liveStop() { if (livePhase.load() == 1 || livePhase.load() == 2) liveFinish (false); }
    /** Called by the app about thirty times a second: a realtime print whose range and tail have gone by is made into its files. */
    void liveTick() { if (livePhase.load() == 3) liveFinish (true); }
    /** Where a realtime print stands: 0 none, 1 waiting for its first sample, 2 writing, 3 done; and how far along (0…1). */
    juce::var liveNow() const
    {
        auto* o = new juce::DynamicObject();
        o->setProperty ("phase", livePhase.load()); o->setProperty ("part", liveTotal > 0 ? (double) liveWritten / (double) liveTotal : 0.0);
        return juce::var (o);
    }

    /** Regions made one sound. For each stretch asked for — a track's id, a name for the file, bars a0 to a1, and the
        regions that lie in it, written as a session writes them — what those regions sound like is written to a file of
        its own in `dir`: the regions alone, as they lie (their gains, their fades, the stretches two of them share),
        nothing the track does to its sound afterwards, and silence where no region lies. One channel where every sound
        in the stretch has one; 32-bit floating point, so that what was louder than full scale still is.
        {dir, tracks: [{id, name, a0, a1, regs}]} -> {ok, placed: [{track, key, file, name, peaks, sec, …}], error} */
    void joinRegions (const juce::var& opts, std::function<void (juce::var)> done)
    {
        struct Job { int track; String name; double a0, a1; std::vector<Region> regs; };
        auto jobs = std::make_shared<std::vector<Job>>();
        if (const auto* list = opts["tracks"].getArray())
            for (auto& tv : *list)
            {
                Job j { (int) tv["id"], tv["name"].toString(), (double) tv["a0"], (double) tv["a1"], {} };
                if (const auto* rg = tv["regs"].getArray())
                    for (auto& rv : *rg)
                    {
                        Region r;
                        r.a = (double) rv["a"]; r.b = (double) rv["b"];
                        r.loop = (int) rv["loop"] != 0;
                        r.rate = juce::jlimit (0.25, 4.0, (double) rv["rate"]);
                        r.loopBars = juce::jmax (1.0, (double) rv["bars"]);
                        r.off = (double) rv["off"];
                        r.gain = rv.hasProperty ("gain") ? (float) (double) rv["gain"] : 1.0f;
                        r.fi = juce::jmax (0.0, (double) rv["fi"]); r.fo = juce::jmax (0.0, (double) rv["fo"]);
                        r.fic = juce::jlimit (0, 2, (int) rv["fic"]); r.foc = juce::jlimit (0, 2, (int) rv["foc"]); r.fib = juce::jlimit (-1.0f, 1.0f, (float) (double) rv["fib"]); r.fob = juce::jlimit (-1.0f, 1.0f, (float) (double) rv["fob"]);
                        if (auto it = bufIndex.find (rv["buf"].toString()); it != bufIndex.end()) r.buf = it->second;
                        if (r.buf >= 0 && r.b > r.a) j.regs.push_back (r);
                    }
                if (j.a1 > j.a0) jobs->push_back (std::move (j));
            }
        if (jobs->empty() || recording.load() || bouncing.exchange (true)) { auto* o = new juce::DynamicObject(); o->setProperty ("ok", false); done (juce::var (o)); return; }
        playing.store (false);
        const juce::File dir (opts["dir"].toString());
        startPrint (done, [this, jobs, dir] (PrintEnd& end)
        {
            { const juce::ScopedLock sl (lock); printBufs = bufs; }    // (the sounds as they are now, kept alive for as long as this takes)
            const double barS = barSamples();
            const int block = 16384;
            juce::Array<juce::var> placed;
            bool ok = true; String why;
            dir.createDirectory();
            /* is there room for what is to be written — the file, and the copy of it the engine keeps ready to play? (a
               gigabyte is left alone: the song still has to be saved) */
            juce::int64 need = 0;
            for (auto& j : *jobs) need += (juce::int64) ((j.a1 - j.a0) * barS) * 16;
            if (dir.getBytesFreeOnVolume() < need + (juce::int64) 1073741824) { ok = false; why = "not enough room on the disk"; }
            for (auto& j : *jobs)
            {
                if (! ok || leaving.load()) break;
                /* (one sample more than the stretch, a silent one: a sound is played up to the sample before its last, so
                   that the last sample of the stretch is heard, as it was while it lay in its own region) */
                const juce::int64 s0 = (juce::int64) std::llround (j.a0 * barS), s1 = (juce::int64) std::llround (j.a1 * barS) + 1;
                int ch = 1;
                for (auto& r : j.regs) if (r.buf < (int) printBufs.size() && printBufs[(size_t) r.buf] != nullptr && printBufs[(size_t) r.buf]->data.getNumChannels() > 1) ch = 2;
                auto file = dir.getNonexistentChildFile (juce::File::createLegalFileName (j.name), ".wav", false);
                bool wrote = false;
                if (std::unique_ptr<juce::OutputStream> os = file.createOutputStream())
                {
                    juce::WavAudioFormat wav;
                    if (auto w = wav.createWriterFor (os, juce::AudioFormatWriterOptions{}.withSampleRate (sr).withNumChannels (ch).withBitsPerSample (32)))
                    {
                        juce::AudioBuffer<float> b (2, block);
                        wrote = true;
                        for (juce::int64 p = s0; p < s1 && wrote && ! leaving.load(); p += block)
                        {
                            const int n = (int) juce::jmin ((juce::int64) block, s1 - p);
                            b.clear();
                            for (auto& r : j.regs) addRegion (printBufs, r, p, n, barS, b.getWritePointer (0), b.getWritePointer (1), j.a1);
                            wrote = w->writeFromAudioSampleBuffer (b, 0, n);
                        }
                    }
                }
                if (leaving.load() || ! wrote) { file.deleteFile(); ok = false; why = leaving.load() ? "the app was closed" : "the file could not be written"; break; }
                auto v = decodeFile (file);
                if (auto* d = v.getDynamicObject()) { d->setProperty ("track", j.track); d->setProperty ("file", file.getFileName()); d->setProperty ("name", file.getFileNameWithoutExtension()); }
                placed.add (v);
            }
            end.finish();
            auto* o = new juce::DynamicObject();
            o->setProperty ("ok", ok); o->setProperty ("placed", placed);
            if (why.isNotEmpty()) o->setProperty ("error", why);
            logLine ("join: " + String (placed.size()) + " of " + String ((int) jobs->size()) + " in " + dir.getFullPathName() + (why.isNotEmpty() ? "  (" + why + ")" : String()));
            end.answer (juce::var (o));
        });
    }

    /*  A print's thread. One at a time (`bouncing`), and the engine does not go while one runs: it is told to give up
        (`leaving`) and waited for. However the thread ends — by its last line, by something thrown on the way — the
        engine comes back from the print (PrintEnd), and whoever asked gets an answer.                                  */
    struct PrintEnd
    {
        Engine& e;
        std::function<void (juce::var)> done;
        bool over = false, answered = false;
        void finish() noexcept
        {
            if (over) return;
            over = true;
            for (auto& tp : e.tracks) { tp->eachPlug ([] (Insert& i) { i.offline (false); }); tp->stale.store (true); }
            e.measureLatency();                                        // (back on the device: as late as they are there)
            {
                std::vector<std::shared_ptr<Buf>> gone;                                // what the print kept alive is let go of outside the lock (a sound dropped meanwhile is freed, or unmapped, here)
                { const juce::ScopedLock sl (e.lock); gone.swap (e.printBufs); }
            }
            e.bouncing.store (false); Meter::still.store (false);
            e.printOver();
        }
        void answer (const juce::var& res, std::function<void()> then = {})
        {
            finish();
            answered = true;
            juce::MessageManager::callAsync ([d = done, res, then] { d (res); if (then) then(); });
        }
        ~PrintEnd()
        {
            finish();
            if (! answered) { auto* o = new juce::DynamicObject(); o->setProperty ("ok", false); o->setProperty ("error", "the print did not finish"); juce::var res (o); juce::MessageManager::callAsync ([d = done, res] { d (res); }); }
        }
    };
    /** Message thread, `bouncing` already taken. The print's end is made here, before its thread: whatever the work does
        or fails to do, and whether or not there is a thread to be had at all, the engine comes back and `done` is answered. */
    void startPrint (std::function<void (juce::var)> done, std::function<void (PrintEnd&)> work)
    {
        if (printThread.joinable()) printThread.join();                // the one before has ended (or `bouncing` could not have been taken): this only lets go of it
        std::shared_ptr<PrintEnd> end (new PrintEnd { *this, std::move (done) });
        printStates = juce::var (new juce::DynamicObject());           // (should asking the plug-ins fail: nothing, rather than what they were at some earlier print)
        printing.store (true); Meter::still.store (true);              // (the meters count nothing while a print is made)
        try
        {
            printStates = statesNow (false, false);
            printThread = std::thread ([this, work, end] () mutable { try { work (*end); } catch (...) { logLine ("print: something was thrown"); } end.reset(); printing.store (false); });
        }
        catch (...)
        {
            printing.store (false);                                    // no thread to be had
            auto* o = new juce::DynamicObject(); o->setProperty ("ok", false); o->setProperty ("error", "the print could not start"); end->answer (juce::var (o));
        }
    }

    /** The measure: the session as it stands, played from a0 to a1 as fast as the machine will go, in blocks of `block`
        samples, with nothing written anywhere. Says how long the sound lasts and how long the work took (so: how much of
        one core it would take to play), the mean, the 99th-in-a-hundred and the worst block, and a mark of what came out
        (the same session must give the same mark however the work is shared out). Runs on its own thread, like a print.
        {a0, a1, block, fresh} -> {ok, sec, took, load, blocks, mean, p99, worst, mark, sum} */
    void measure (const juce::var& opts, std::function<void (juce::var)> done)
    {
        if (recording.load() || bouncing.exchange (true)) { auto* o = new juce::DynamicObject(); o->setProperty ("ok", false); done (juce::var (o)); return; }
        playing.store (false);
        startPrint (done, [this, opts] (PrintEnd& end)
        {
            juce::ScopedNoDenormals noDenormals;
            { const juce::ScopedLock sl (lock); printBufs = bufs; }
            const double a0 = (double) opts["a0"], a1 = (double) opts["a1"], barS = barSamples();
            const int blk = juce::jlimit (16, maxBlock, opts.hasProperty ("block") ? (int) opts["block"] : block);
            const juce::int64 s0 = (juce::int64) std::llround (a0 * barS), s1 = (juce::int64) std::llround (a1 * barS);
            if ((int) opts["fresh"] != 0) freshen();
            shared.store (0);
            for (auto& tp : tracks) tp->eachPlug ([] (Insert& i) { i.offline (true); });
            measureLatency();
            for (auto& tp : tracks) { tp->gainSm = dbGainOf (*tp, a0); tp->panSm = tp->pan.load(); for (auto& sd : tp->sends) sd.sm = sd.gain.load(); quietNotes (*tp); }
            std::vector<float> times;
            times.reserve ((size_t) juce::jmax ((juce::int64) 0, (s1 - s0) / blk + 2));
            juce::uint64 mark = 1469598103934665603ull; double sum = 0.0;
            const auto w0 = juce::Time::getHighResolutionTicks();
            for (juce::int64 p = s0; p < s1 && ! leaving.load(); p += blk)
            {
                const int n = (int) juce::jmin ((juce::int64) blk, s1 - p);
                const auto b0 = juce::Time::getHighResolutionTicks();
                renderGraph (p, n, true, true, nullptr, a1, nullptr);
                times.push_back ((float) (juce::Time::highResolutionTicksToSeconds (juce::Time::getHighResolutionTicks() - b0) * 1000.0));
                for (int c = 0; c < 2; ++c)
                {
                    const float* m = mix.getReadPointer (c);
                    for (int i = 0; i < n; ++i) { juce::uint32 bits; std::memcpy (&bits, m + i, 4); mark = (mark ^ bits) * 1099511628211ull; sum += std::abs ((double) m[i]); }
                }
            }
            const double took = juce::Time::highResolutionTicksToSeconds (juce::Time::getHighResolutionTicks() - w0), sec = (double) (s1 - s0) / sr;
            std::sort (times.begin(), times.end());
            double mean = 0.0; for (auto t : times) mean += t;
            auto* o = new juce::DynamicObject();
            o->setProperty ("ok", ! times.empty());
            o->setProperty ("sec", sec); o->setProperty ("took", took); o->setProperty ("load", sec > 0.0 ? took / sec : 0.0);
            o->setProperty ("blocks", (int) times.size()); o->setProperty ("block", blk); o->setProperty ("lasts", (double) blk / sr * 1000.0);
            if (! times.empty())
            {
                o->setProperty ("mean", mean / (double) times.size());
                o->setProperty ("p99", (double) times[(size_t) juce::jmin ((int) times.size() - 1, (int) ((double) times.size() * 0.99))]);
                o->setProperty ("worst", (double) times.back());
            }
            o->setProperty ("mark", String::toHexString ((juce::int64) mark)); o->setProperty ("sum", sum);
            o->setProperty ("threads", pool.size() + 1); o->setProperty ("shared", shared.exchange (0));
            end.answer (juce::var (o));
        });
    }
    /** Every patch and plug-in as it is when first switched on, with nothing ringing in it: so that two runs of the same
        stretch begin alike. With the callback standing by (a print or a measure is under way). */
    void freshen()
    {
        for (auto& tp : tracks)
        {
            readyPatch (*tp);
            tp->eachPlug ([] (Insert& i) { if (i.inst != nullptr) i.inst->reset(); if (i.own != nullptr) i.own->reset(); });
            if (tp->built != nullptr) tp->built->prepare (sr);
            tp->work.clear();
        }
        limG = 1.0f;
    }

    /** For the check: a file decoded the old way (all of it in memory) and the new (through the cache on disk, twice: made,
        then found), compared sample for sample. -> {ok, frames, same, worst, mapped} */
    juce::var testSound (const juce::File& f)
    {
        auto* o = new juce::DynamicObject();
        juce::var result (o);
        const auto inMemory = decodeFrom (std::unique_ptr<juce::AudioFormatReader> (afm.createReaderFor (f)));
        const auto first = mapped (f), second = mapped (f);
        o->setProperty ("ok", (bool) inMemory["ok"] && first.isObject() && second.isObject());
        if (! (bool) o->getProperty ("ok")) return result;
        const auto a = buffer (inMemory["key"].toString()), b = buffer (first["key"].toString()), c = buffer (second["key"].toString());
        const int n = juce::jmin (a->data.getNumSamples(), b->data.getNumSamples(), c->data.getNumSamples()), ch = juce::jmin (a->data.getNumChannels(), b->data.getNumChannels());
        float worst = 0.0f; bool same = a->data.getNumSamples() == b->data.getNumSamples() && b->data.getNumSamples() == c->data.getNumSamples() && a->data.getNumChannels() == b->data.getNumChannels();
        for (int k = 0; k < ch; ++k)
        {
            const float* x = a->data.getReadPointer (k); const float* y = b->data.getReadPointer (k); const float* z = c->data.getReadPointer (k);
            for (int i = 0; i < n; ++i) { const float d = juce::jmax (std::abs (x[i] - y[i]), std::abs (y[i] - z[i])); if (d > worst) worst = d; if (std::memcmp (x + i, y + i, 4) != 0 || std::memcmp (y + i, z + i, 4) != 0) same = false; }
        }
        o->setProperty ("frames", n); o->setProperty ("channels", ch); o->setProperty ("same", same); o->setProperty ("worst", worst);
        o->setProperty ("mapped", b->map != nullptr && c->map != nullptr && a->map == nullptr);
        o->setProperty ("samePeaks", juce::JSON::toString (inMemory["peaks"], true) == juce::JSON::toString (first["peaks"], true) && juce::JSON::toString (first["peaks"], true) == juce::JSON::toString (second["peaks"], true));
        for (auto* key : { &inMemory, &first, &second }) dropBuffer ((*key)["key"].toString());
        return result;
    }

    /** The self-test's way to see the engine follow a device to another rate. */
    void testAdoptRate (double r) { if (testInput) adoptRate (r); }
    void testHole() { if (testInput) lastBlockTick.store ((juce::int64) mach_continuous_time() - (juce::int64) (2.0 / tickSeconds)); }      // the check: as if the device had given no block for two seconds

    Track* find (int id)
    {
        if (id == kLearnTrack)                                         // (made the first time a plug-in is opened to be learnt; message thread)
        {
            if (learnTrack == nullptr) { learnTrack = std::make_unique<Track>(); learnTrack->id = kLearnTrack; learnTrack->work.setSize (2, maxBlock); learnTrack->sideBuf.setSize (2, maxBlock); learnTrack->share = -1.0f; }
            return learnTrack.get();
        }
        for (auto& t : tracks) if (t != nullptr && t->id == id) return t.get();
        return nullptr;
    }
    /** Plug-ins opened only to be learnt (ui/probe.js: settings > plug-ins, first choices): they sit on a track of their own
        that is in no song and never played — `tracks` does not hold it — so nothing of the song changes, and nothing is
        heard; Engine::probe plays sound through them, and they are taken off again (op remove) once they are learnt. */
    static constexpr int kLearnTrack = -7;
    std::unique_ptr<Track> learnTrack;
    int trackCount() const { return (int) tracks.size(); }
    int chainCount() const { int n = 0; for (auto& t : tracks) if (t->chain != nullptr) ++n; return n; }

private:
    /** What an offline pass keeps: one track's sound (before or after its fader), with only what feeds it sounding. */
    struct Tap
    {
        Track* t = nullptr;
        bool pre = false, dry = false;
        std::set<const Track*> only;
        juce::AudioBuffer<float> buf;
    };

    /** A bar in samples: its beats, each a 1/unit note, at so many quarter notes a minute. */
    double barSamples() const { return 240.0 / tempo.load() * sr * (double) beats.load() / (double) unit.load(); }
    /** A bar in quarter notes (what a plug-in counts in). */
    double barQuarters() const { return (double) beats.load() * 4.0 / (double) unit.load(); }

    static constexpr int kPatchSlots = 4;      // the nodes of a track's patch (tape, space, delay, their mix): only these slots of the Patch engine are given memory
    /** A track's patch as the Patch engine draws one: tape, then space and delay side by side, the two mixed by `share`. */
    static orbfx::Graph patchGraph (float share)
    {
        using namespace orbfx;
        auto node = [] (int id, int type) { Graph::Node n; n.id = id; n.type = type; n.amount = 0.0f; return n; };
        Graph g;
        g.nodes.push_back (node (0, kTape)); g.nodes.push_back (node (1, kSpace)); g.nodes.push_back (node (2, kDelay)); g.nodes.push_back (node (3, kMixType));
        g.edges.push_back ({ kPortIn, 0, 1.0f }); g.edges.push_back ({ 0, 1, 1.0f }); g.edges.push_back ({ 0, 2, 1.0f });
        g.edges.push_back ({ 1, 3, share }); g.edges.push_back ({ 2, 3, 1.0f - share }); g.edges.push_back ({ 3, kPortOut, 1.0f });
        return g;
    }
    void compilePatch (orbfx::Chain& chain, float share)
    {
        using namespace orbfx;
        Program p; String err;
        if (compile (patchGraph (share), p, err, &Chain::latencyThunk, &chain)) chain.publish (p);
        else logLine ("patch would not compile: " + err);
    }
public:
    /** The same patch with its prints set, written the way Patch on Slur keeps one (an .orbpatch file): handed over with
        the stems, the plug-in opens it on that track and goes on from where the room left off. (Where each print stands
        on the plug-in's wall is given too, so that it opens laid out and not in a heap.) */
    static juce::String patchPreset (float tape, float space, float delay, float share)
    {
        auto g = patchGraph (juce::jlimit (0.0f, 1.0f, share));
        const float amount[] = { tape, space, delay, 0.0f }, x[] = { 180.0f, 380.0f, 380.0f, 560.0f }, y[] = { 280.0f, 156.0f, 404.0f, 280.0f };
        juce::Array<juce::var> nodes, edges;
        for (size_t i = 0; i < g.nodes.size(); ++i)
        {
            const auto& nd = g.nodes[i];
            auto* o = new juce::DynamicObject();
            o->setProperty ("id", nd.id); o->setProperty ("type", nd.type); o->setProperty ("amount", (double) juce::jlimit (0.0f, 1.0f, amount[i])); o->setProperty ("variant", nd.variant);
            juce::Array<juce::var> dec; for (float d : nd.decay) dec.add ((double) d);
            o->setProperty ("decay", dec); o->setProperty ("delayDiv", nd.delayDiv); o->setProperty ("delayFb", (double) nd.delayFb);
            o->setProperty ("x", (double) x[i]); o->setProperty ("y", (double) y[i]);
            nodes.add (juce::var (o));
        }
        for (const auto& e : g.edges) { auto* o = new juce::DynamicObject(); o->setProperty ("from", e.from); o->setProperty ("to", e.to); o->setProperty ("gain", (double) e.gain); edges.add (juce::var (o)); }
        auto* root = new juce::DynamicObject();
        root->setProperty ("nodes", nodes); root->setProperty ("edges", edges);
        return juce::JSON::toString (juce::var (root), true);
    }

    //── a track's patch as a wall ─────────────────────────────────────────────
    /** What the compiler is told about a wall: who plays each node that is a plug-in (for how late it is). */
    struct WallCtx { const orbfx::Chain* chain; Insert* at[orbfx::kMaxNodes]; };
    static int wallLatency (const orbfx::Graph::Node& n, const void* ctx)
    {
        const auto& c = *static_cast<const WallCtx*> (ctx);
        if (n.type == orbfx::kOutside) { auto* i = n.id >= 0 && n.id < orbfx::kMaxNodes ? c.at[n.id] : nullptr; return i != nullptr ? juce::jmax (0, i->latencyHeard()) : 0; }      // (as late as it makes the sound: switched off, or stepped past by low latency mode, not at all)
        return c.chain->nodeLatency (n);
    }
    /** The audio thread, from inside the graph: the plug-in that stands at this node plays its part, in place. */
    static void wallOutside (void* ctx, int slot, float* L, float* R, int n)
    {
        auto& t = *static_cast<Track*> (ctx);
        Insert* i = slot >= 0 && slot < orbfx::kMaxNodes ? t.slotIns[slot] : nullptr;
        if (i == nullptr)                                                      // (a meter: the sound goes by and is measured; a plug-in taken off since: it goes by)
        {
            if (auto* m = slot >= 0 && slot < orbfx::kMaxNodes ? t.slotMeter[slot] : nullptr) if (! Meter::still.load (std::memory_order_relaxed)) m->take (L, R, n);
            return;
        }
        for (auto& a : t.autos) if (a.param == kAutoPlug && a.uid == i->uid) i->setParam (a.index, lineAt (a, t.barNow), a.told);
        const Track* k = i->key;
        i->process (L, R, n, k != nullptr ? k->work.getReadPointer (0) : nullptr, k != nullptr ? k->work.getReadPointer (1) : nullptr);
    }
    static bool wallSlotHasState (int type) { return (orbfx::isEffect (type) && type != orbfx::kOutside) || type == orbfx::kSplitBands; }
    /** Compile a track's wall as it stands and hand it to the audio thread, with everything the program names. */
    bool compileWall (Track& t, orbfx::Chain& chain, const orbfx::Graph& g, Insert* const* at, const orbfx::NodeParams* prm, const float* amt, const int* src, String& err, std::unique_ptr<orbfx::Chain> made = nullptr)
    {
        using namespace orbfx;
        WallCtx ctx { &chain, {} };
        for (int i = 0; i < kMaxNodes; ++i) ctx.at[i] = at[i];
        Program p;
        Graph heard = g;                                                      // (low latency mode: on the way of what is heard live, what is later than the limit is stepped past)
        auto skipped = wallSkips (t, chain, g, at);
        for (auto& nd : heard.nodes) for (auto& sk : skipped) if (sk.first == nd.id) nd.bypass = true;
        if (! compile (heard, p, err, &wallLatency, &ctx)) return false;
        t.wallSkipped = skipped;
        const bool alone = bouncing.load();                                   // (a print plays the graph by itself and holds no lock)
        if (! alone) lock.enter();
        if (made != nullptr) t.chain = std::move (made);
        t.wall = true; t.wallLat = p.bypass ? 0 : p.latency;
        int types[kMaxNodes]; for (auto& x : types) x = kNone;
        for (auto& nd : g.nodes) if (nd.id >= 0 && nd.id < kMaxNodes) types[nd.id] = nd.type;
        for (int i = 0; i < kMaxNodes; ++i)
        {
            t.slotIns[i] = at[i]; t.slotLat[i] = at[i] != nullptr ? at[i]->latencyHeard() : 0; t.slotType[i] = types[i];
            if (prm != nullptr) { t.prm[i] = prm[i]; t.slotSrc[i] = src[i]; t.amt[(size_t) i].store (amt[i]); }
        }
        t.chain->publish (p);                                                 // (under the same lock: no block is played with the new places and the old program)
        if (! alone) lock.exit();
        return true;
    }
    /** The page draws a track's patch as a wall and sends it whole: the nodes (a print by its type, or a plug-in by the
        uid it was opened under) and the wires. From then on the track's patch and plug-ins are played from this graph.
        A wall that cannot be played (a ring of wires) changes nothing and says why. Message thread. -> {ok, latency | error} */
    juce::var setWall (const juce::var& d)
    {
        using namespace orbfx;
        auto* o = new juce::DynamicObject();
        juce::var res (o);
        o->setProperty ("ok", false);
        auto* t = find ((int) d["track"]);
        if (t == nullptr) { o->setProperty ("error", "no such track"); return res; }
        if (bouncing.load()) { o->setProperty ("error", "busy"); return res; }
        /* the wall is read as Patch on Slur reads a patch (orbfx::graphFromVar: its prints, its wires, a control wire's hand
           and depth, an lfo's drawn shape, a scene's snapshots) — and then what only this app stands on a wall: a plug-in
           from outside (its uid), a meter, and a tape, space or delay whose amount is the track's own (line) */
        Graph g; String perr;
        if (! graphFromVar (d, g, perr)) { o->setProperty ("error", perr); return res; }
        Insert* at[kMaxNodes] {}; int src[kMaxNodes] {}; float amt[kMaxNodes] {}; NodeParams prm[kMaxNodes]; bool meterAt[kMaxNodes] {};
        auto* ns = d["nodes"].getArray();
        for (size_t k = 0; k < g.nodes.size(); ++k)
        {
            auto& nd = g.nodes[k];
            const juce::var& nv = (*ns)[(int) k];
            if (nd.id < 0 || nd.id >= kMaxNodes) { o->setProperty ("error", "bad node id"); return res; }
            if (const int uid = (int) nv["uid"]; uid != 0) { nd.type = kOutside; for (auto& i : t->inserts) if (i->uid == uid) at[nd.id] = i.get(); }
            if ((int) nv["meter"] != 0) { nd.type = kOutside; meterAt[nd.id] = true; }        // a meter stands outside the graph too: the sound is handed to it and comes back as it went
            nd.amount = juce::jlimit (0.0f, 1.0f, nd.amount);
            nd.variant = juce::jlimit (0, 7, nd.variant);
            for (auto& dv : nd.decay) dv = juce::jlimit (0.0f, 1.0f, dv);
            nd.delayDiv = juce::jlimit (0, 7, nd.delayDiv);
            nd.delayFb = juce::jlimit (0.0f, 1.0f, nd.delayFb);
            auto& p = prm[nd.id];
            p.amount = nd.amount; p.variant = nd.variant; p.decay = nd.decay[juce::jlimit (0, 2, nd.variant)]; p.delayDiv = nd.delayDiv; p.delayFb = nd.delayFb; p.wet = nd.wet;
            for (int q = 0; q < kAuxCount; ++q) p.aux[q] = nd.aux[q];
            p.hasCurve = nd.hasCurve; for (int q = 0; q < kCurveLen; ++q) p.curve[q] = nd.curve[q];
            amt[nd.id] = nd.amount;
            src[nd.id] = juce::jlimit (0, 3, (int) nv["line"]);
        }
        std::unique_ptr<Chain> made;
        Chain* c = t->chain.get();
        if (c == nullptr) { made = std::make_unique<Chain>(); made->prepare (sr, maxBlock, 1); c = made.get(); }
        c->setOutside (&wallOutside, t);
        for (auto& nd : g.nodes) if (wallSlotHasState (nd.type)) c->prepareSlot (nd.id);     // (a print's memory: a few megabytes, taken when it first stands on the wall)
        String err;
        for (int i = 0; i < kMaxNodes; ++i) if (meterAt[i] && t->meterOwn[i] == nullptr) { t->meterOwn[i] = std::make_unique<Meter>(); t->meterOwn[i]->prepare (sr); }
        if (! compileWall (*t, *c, g, at, prm, amt, src, err, std::move (made))) { o->setProperty ("error", err); return res; }
        { const juce::ScopedLock sl (lock); for (int i = 0; i < kMaxNodes; ++i) t->slotMeter[i] = meterAt[i] ? t->meterOwn[i].get() : nullptr; }
        t->wallGraph = g;
        t->mod.setGraph (g);                                                   // (what its control prints play, and their shapes: taken at the next block)
        measureLatency();
        o->setProperty ("ok", true); o->setProperty ("latency", t->wallLat);
        return res;
    }
    /** What a meter on a track's wall shows now (`seconds` of its wave), and its count begun again (id < 0: every meter of the track; track 0: every meter there is). Message thread. */
    juce::var meterRead (int trackId, int id, double seconds)
    {
        auto* t = find (trackId);
        auto* m = t != nullptr && id >= 0 && id < orbfx::kMaxNodes ? t->slotMeter[id] : nullptr;
        if (m == nullptr) { auto* o = new juce::DynamicObject(); o->setProperty ("ok", false); return juce::var (o); }
        auto v = m->read (seconds);
        v.getDynamicObject()->setProperty ("ok", true);
        return v;
    }
    void meterReset (int trackId, int id)
    {
        for (auto& tp : tracks) if (trackId == 0 || tp->id == trackId) for (int i = 0; i < orbfx::kMaxNodes; ++i) if ((id < 0 || i == id) && tp->meterOwn[i] != nullptr) tp->meterOwn[i]->reset();
    }
    /** A node's amount, while it is being pulled (the whole wall is not sent again for that). */
    void setWallAmount (int trackId, int id, float v) { if (auto* t = find (trackId)) if (id >= 0 && id < orbfx::kMaxNodes) t->amt[(size_t) id].store (juce::jlimit (0.0f, 1.0f, v)); }
    /** What stands on a track's wall, as the engine holds it (for the check). */
    juce::var wallFacts (int trackId)
    {
        auto* o = new juce::DynamicObject();
        juce::var res (o);
        auto* t = find (trackId);
        o->setProperty ("wall", t != nullptr && t->wall);
        if (t == nullptr) return res;
        o->setProperty ("latency", t->wallLat); o->setProperty ("nodes", (int) t->wallGraph.nodes.size()); o->setProperty ("edges", (int) t->wallGraph.edges.size());
        int plugs = 0; for (auto* i : t->slotIns) if (i != nullptr) ++plugs;
        o->setProperty ("plugs", plugs); o->setProperty ("ahead", t->ahead.load());
        return res;
    }
private:
    /** A wall is compiled again when one of its plug-ins has become later or earlier than it was (the ways side by side are
        lined up by how late each is). */
    void checkWalls()
    {
        for (auto& tp : tracks)
        {
            auto& t = *tp;
            if (! t.wall || t.chain == nullptr) continue;
            bool moved = false;
            for (int i = 0; i < orbfx::kMaxNodes; ++i) if (t.slotIns[i] != nullptr && t.slotIns[i]->latencyHeard() != t.slotLat[i]) moved = true;      // (a plug-in switched off or on lays its wall out again)
            if (! moved) continue;
            Insert* at[orbfx::kMaxNodes]; for (int i = 0; i < orbfx::kMaxNodes; ++i) at[i] = t.slotIns[i];
            String err;
            compileWall (t, *t.chain, t.wallGraph, at, nullptr, nullptr, nullptr, err);
        }
    }
    /** A track's chain made ready for the device as it is now (its rate, its block), and its patch compiled again. */
    void readyPatch (Track& t)
    {
        if (t.chain == nullptr) return;
        if (! t.wall) { t.chain->prepare (sr, maxBlock, kPatchSlots); compilePatch (*t.chain, t.share); return; }
        t.chain->prepare (sr, maxBlock, 1);
        for (auto& nd : t.wallGraph.nodes) if (wallSlotHasState (nd.type)) t.chain->prepareSlot (nd.id);
        Insert* at[orbfx::kMaxNodes]; for (int i = 0; i < orbfx::kMaxNodes; ++i) at[i] = t.slotIns[i];
        String err;
        compileWall (t, *t.chain, t.wallGraph, at, nullptr, nullptr, nullptr, err);
    }
public:
private:

    /** Work out who feeds whom, and an order in which every track is played after all that flows into it. Call with the lock held. */
    void wire()
    {
        for (auto& tp : tracks)
        {
            auto& t = *tp;
            t.out = nullptr;
            if (t.outId != 0) if (auto* d = find (t.outId)) if (d != &t && d->kind == 1) t.out = d;
            for (auto& s : t.sends) { s.dst = nullptr; if (s.to != 0) if (auto* d = find (s.to)) if (d != &t && d->kind == 1) s.dst = d; }
        }
        /*  A plug-in that listens to another track makes its own track come after that one. It is given the track only if
            nothing of its own track's sound, by any way, gets to that track (that would be a ring: each waiting for the
            other's block).                                                                                             */
        std::map<Track*, std::vector<Track*>> heard;                   // a track, and the tracks with a plug-in that listens to it
        auto reaches = [&] (Track* from, Track* to)
        {
            std::vector<Track*> todo { from }; std::set<Track*> seen;
            while (! todo.empty())
            {
                auto* x = todo.back(); todo.pop_back();
                if (x == to) return true;
                if (! seen.insert (x).second) continue;
                if (x->out != nullptr) todo.push_back (x->out);
                for (auto& s : x->sends) if (s.dst != nullptr) todo.push_back (s.dst);
                if (const auto f = heard.find (x); f != heard.end()) for (auto* d : f->second) todo.push_back (d);
            }
            return false;
        };
        for (auto& tp : tracks)
            for (auto& i : tp->inserts)
            {
                i->key = nullptr;
                if (i->keyFrom == 0) continue;
                if (auto* s = find (i->keyFrom)) if (s != tp.get() && ! reaches (tp.get(), s)) { i->key = s; heard[s].push_back (tp.get()); }
            }
        for (auto& tp : tracks)                                         // a wall's side: the track it plays is worked before it, as a key's is
        {
            tp->side = nullptr;
            if (tp->sideFrom == 0) continue;
            if (auto* s = find (tp->sideFrom)) if (s != tp.get() && ! reaches (tp.get(), s)) { tp->side = s; heard[s].push_back (tp.get()); }
        }
        for (auto& tp : tracks)                                         // (a track something listens to, or that listens to one, is never rested: playTrack)
        {
            tp->keyFor = heard.count (tp.get()) > 0;
            tp->keyed = tp->side != nullptr;
            for (auto& i : tp->inserts) if (i->key != nullptr) tp->keyed = true;
        }
        order.clear(); rankEnds.clear();
        std::map<Track*, int> waiting, rank;
        for (auto& tp : tracks) { waiting[tp.get()] = 0; rank[tp.get()] = 0; }
        for (auto& tp : tracks) { if (tp->out != nullptr) ++waiting[tp->out]; for (auto& s : tp->sends) if (s.dst != nullptr) ++waiting[s.dst]; }
        for (auto& h : heard) for (auto* d : h.second) ++waiting[d];
        std::vector<Track*> ready;
        for (auto& tp : tracks) if (waiting[tp.get()] == 0) ready.push_back (tp.get());
        /*  Taken from the front of one list and added at its back, tracks come out rank by rank: first those nothing
            flows into, then those fed only by them, and so on (a track is added when the last thing that feeds it is
            taken, and by then every track of the rank before it is already on the list).                          */
        for (size_t k = 0; k < ready.size(); ++k)
        {
            auto* t = ready[k];
            if (! order.empty() && rank[t] != rank[order.back()]) rankEnds.push_back (order.size());
            order.push_back (t);
            auto feed = [&] (Track* d) { rank[d] = juce::jmax (rank[d], rank[t] + 1); if (--waiting[d] == 0) ready.push_back (d); };
            if (t->out != nullptr) feed (t->out);
            for (auto& s : t->sends) if (s.dst != nullptr) feed (s.dst);
            if (const auto f = heard.find (t); f != heard.end()) for (auto* d : f->second) feed (d);
        }
        if (! order.empty()) rankEnds.push_back (order.size());
        if (order.size() < tracks.size())                              // a ring of buses: the page does not allow one, but nothing here may feed itself
        {
            for (auto& tp : tracks)
                if (std::find (order.begin(), order.end(), tp.get()) == order.end())
                {
                    tp->out = nullptr; for (auto& s : tp->sends) s.dst = nullptr; for (auto& i : tp->inserts) i->key = nullptr; tp->side = nullptr;
                    order.push_back (tp.get());
                }
            rankEnds.push_back (order.size());                         // cut loose, they are a last rank of their own
        }
    }

    /** How late each track's sound comes out of its plug-ins and the buses after it. Message thread — or a print's own
        thread while it runs (nothing else plays the plug-ins then, and none comes or goes): a plug-in told it is
        offline may be later, or earlier, than it was on the device. */
    /** Low latency mode (the transport's bolt): what is heard live — a track that listens to its input, one played by
        hand — goes its way without what is later than the limit. Every plug-in and print on that track, on the buses it
        flows into and on the stereo out, later than the limit, is stepped past (and counted as on time) until the mode is
        turned off; nothing written in the song changes. Message thread; a print is never made with it (the page turns it
        off for one). Called whenever the lateness is looked at again, so what is armed and listened to is followed. */
    void lowLatency()
    {
        std::set<Track*> heard;
        std::function<void (Track*, int)> along = [&] (Track* t, int depth) { if (t == nullptr || depth > 16 || ! heard.insert (t).second) return; along (t->out, depth + 1); for (auto& s : t->sends) along (s.dst, depth + 1); };
        if (lowLat.load() && ! bouncing.load()) for (auto& tp : tracks) if (tp->mon.load() || tp->live.load()) along (tp.get(), 0);
        const int lim = lowLatLimit();
        for (auto& tp : tracks)
        {
            auto& t = *tp;
            const bool was = t.fast;
            t.fast = heard.count (&t) > 0;
            for (auto& i : t.inserts) i->llmSkip.store (! t.wall && t.fast && i->latencyNow() > lim);
            if (! t.wall || t.chain == nullptr) continue;
            Insert* at[orbfx::kMaxNodes]; for (int i = 0; i < orbfx::kMaxNodes; ++i) at[i] = t.slotIns[i];
            if (was == t.fast && wallSkips (t, *t.chain, t.wallGraph, at) == t.wallSkipped) continue;
            String err;
            compileWall (t, *t.chain, t.wallGraph, at, nullptr, nullptr, nullptr, err);
        }
    }
    /** What a wall steps past in low latency mode: each print or plug-in on it later than the limit (node, samples). */
    std::vector<std::pair<int, int>> wallSkips (const Track& t, const orbfx::Chain& chain, const orbfx::Graph& g, Insert* const* at) const
    {
        std::vector<std::pair<int, int>> out;
        if (! t.fast || ! lowLat.load() || bouncing.load()) return out;
        const int lim = lowLatLimit();
        for (auto& nd : g.nodes)
        {
            if (nd.id < 0 || nd.id >= orbfx::kMaxNodes || nd.bypass) continue;
            const int late = nd.type == orbfx::kOutside ? (at[nd.id] != nullptr ? at[nd.id]->latencyNow() : 0) : chain.nodeLatency (nd);
            if (late > lim) out.push_back ({ nd.id, late });
        }
        return out;
    }
    int lowLatLimit() const { return (int) std::lround (juce::jlimit (1, 100, lowLatMs.load()) * sr / 1000.0); }
public:
    /** The mode turned on or off, or its limit changed: what it steps past now. */
    juce::var setLowLatency (bool on, int ms)
    {
        lowLat.store (on); if (ms > 0) lowLatMs.store (juce::jlimit (1, 100, ms));
        measureLatency();
        return lowLatFacts();
    }
    /** What the page shows: whether it is on, its limit, the tracks what is heard live goes through, and what is stepped past
        (a print or plug-in on a wall: its node; a plug-in in a row: its uid) and how late it is, in milliseconds. */
    juce::var lowLatFacts()
    {
        auto* o = new juce::DynamicObject();
        o->setProperty ("on", lowLat.load()); o->setProperty ("ms", lowLatMs.load());
        juce::Array<juce::var> fastIds, skipped;
        auto msOf = [this] (int samples) { return juce::roundToInt (samples * 1000.0 / sr * 10.0) / 10.0; };
        for (auto& tp : tracks)
        {
            if (! tp->fast) continue;
            fastIds.add (tp->id);
            for (auto& sk : tp->wallSkipped) { auto* k = new juce::DynamicObject(); k->setProperty ("track", tp->id); k->setProperty ("node", sk.first); k->setProperty ("ms", msOf (sk.second)); skipped.add (juce::var (k)); }
            for (auto& i : tp->inserts) if (i->llmSkip.load()) { auto* k = new juce::DynamicObject(); k->setProperty ("track", tp->id); k->setProperty ("uid", i->uid); k->setProperty ("ms", msOf (i->latencyNow())); skipped.add (juce::var (k)); }
        }
        o->setProperty ("fast", fastIds); o->setProperty ("skipped", skipped);
        return juce::var (o);
    }
    std::atomic<bool> lowLat { false };
    std::atomic<int>  lowLatMs { 5 };
private:

    void measureLatency()
    {
        checkWalls();
        lowLatency();
        auto own = [] (const Track& t) { if (t.frozen.load()) return 0; int n = t.plug != nullptr ? t.plug->latencyNow() : 0; if (t.wall) return n + t.wallLat; for (auto& i : t.inserts) n += i->latencyHeard(); return n; };
        /*  How far it still is from where a track's sound leaves it to the stereo out, counted in the lateness of the
            buses on the way — by its longest way, when it has several (its own way out, and each bus it sends into).
            A track's regions are read that much early, and by its own plug-ins' lateness, so what goes the longest way
            arrives on time; what goes a shorter way is held back by the difference where it sets out (Hold).        */
        std::map<const Track*, int> far;
        std::function<int (const Track*, int)> longest = [&] (const Track* t, int depth) -> int
        {
            if (const auto f = far.find (t); f != far.end()) return f->second;
            int m = 0;
            if (depth < 16)
            {
                if (t->out != nullptr) m = juce::jmax (m, own (*t->out) + longest (t->out, depth + 1));
                for (auto& s : t->sends) if (s.dst != nullptr) m = juce::jmax (m, own (*s.dst) + longest (s.dst, depth + 1));
            }
            return far[t] = m;
        };
        struct Want { Hold* hold; int n; };
        std::vector<Want> wants;
        bool changed = false;
        for (auto& tp : tracks)
        {
            auto& t = *tp;
            {                                                          // how long its plug-ins say they ring on after their sound has stopped: it rests no sooner than that, eight seconds at least and thirty at most
                double tail = 0.0;                                     // (one that says it rings for ever — a delay fed back, say — is still heard out: a track only rests once nothing at all has come out of it for that long)
                for (auto& i : t.inserts) if (i->inst != nullptr) { const double sec = i->inst->getTailLengthSeconds(); tail = juce::jmax (tail, std::isfinite (sec) ? sec : 1.0e9); }
                t.sleepAfter.store ((int) (sr * juce::jlimit (8.0, 30.0, tail + 2.0)));
            }
            const int all = longest (&t, 0);
            t.ahead.store (t.kind == 0 ? own (t) + all : 0);
            t.early.store (all); t.earlyIn.store (own (t) + all);
            wants.push_back ({ &t.outHold, all - (t.out != nullptr ? own (*t.out) + longest (t.out, 1) : 0) });
            for (auto& s : t.sends) wants.push_back ({ &s.hold, s.dst != nullptr ? all - (own (*s.dst) + longest (s.dst, 1)) : 0 });
            /* what a plug-in listens to left its track as early as that track's longest way is long; this track's own sound
               is, at that plug-in, earlier by its own lateness and its longest way, less what stands before the plug-in.
               The key waits for the difference (when it is the later one, it stays that much late: nothing here is moved for it) */
            int before = t.plug != nullptr ? t.plug->latencyNow() : 0;
            for (auto& i : t.inserts)
            {
                wants.push_back ({ &i->keyHold, i->key != nullptr && i->keyCh > 0 ? juce::jmax (0, longest (i->key, 1) - own (t) - all + before) : 0 });
                if (! t.wall) before += i->latencyHeard();               // (on a wall the plug-ins are not in a row: what stands before one is not counted — its key is lined up with the wall's way in)
            }
            wants.push_back ({ &t.sideHold, t.side != nullptr ? juce::jmax (0, longest (t.side, 1) - own (t) - all) : 0 });      // (a side is lined up with the wall's way in, as a key on the wall is)
        }
        for (auto& w : wants) if (w.hold->len != juce::jlimit (0, 1 << 20, w.n)) changed = true;
        if (! changed) return;
        const bool alone = bouncing.load();                            // (a print plays the graph by itself; otherwise no block may be worked while a hold changes its length)
        if (! alone) lock.enter();
        for (auto& w : wants) w.hold->set (w.n);
        if (! alone) lock.exit();
    }

    /** The buses a track's sound goes on through, by where it plays into and what it sends to, all the way to the out. */
    std::set<const Track*> downstream (const Track* t) const
    {
        std::set<const Track*> s;
        std::vector<const Track*> todo { t };
        while (! todo.empty())
        {
            const Track* x = todo.back(); todo.pop_back();
            auto go = [&] (const Track* d) { if (d != nullptr && s.insert (d).second) todo.push_back (d); };
            go (x->out);
            for (auto& sd : x->sends) go (sd.dst);
        }
        return s;
    }
    /** A track and everything that flows into it — and whatever a plug-in on one of those listens to, with all that
        flows into that: it has to sound for the plug-in to hear it (a print of one track plays these, and no others). */
    std::set<const Track*> upstream (const Track* t) const
    {
        std::set<const Track*> s { t };
        for (bool grew = true; grew;)
        {
            grew = false;
            for (auto& tp : tracks)
            {
                if (s.count (tp.get())) continue;
                bool feeds = tp->out != nullptr && s.count (tp->out) > 0;
                for (auto& sd : tp->sends) if (sd.dst != nullptr && s.count (sd.dst) > 0) feeds = true;
                for (auto& other : tracks) if (! feeds && s.count (other.get()) > 0) for (auto& i : other->inserts) if (i->key == tp.get()) feeds = true;
                for (auto& other : tracks) if (! feeds && s.count (other.get()) > 0 && other->side == tp.get()) feeds = true;
                if (feeds) { s.insert (tp.get()); grew = true; }
            }
        }
        return s;
    }

    /** A line's value at a place in the song. */
    static float lineAt (const Auto& a, double bar)
    {
        const auto& p = a.pts;
        if (bar <= p.front().first) return p.front().second;
        if (bar >= p.back().first)  return p.back().second;
        size_t lo = 0, hi = p.size() - 1;
        while (hi - lo > 1) { const size_t mid = (lo + hi) / 2; if (p[mid].first <= bar) lo = mid; else hi = mid; }
        const double span = p[hi].first - p[lo].first;
        return span > 1.0e-9 ? p[lo].second + (p[hi].second - p[lo].second) * (float) ((bar - p[lo].first) / span) : p[hi].second;
    }
    static bool evalAuto (const Track& t, int param, double bar, float& v)
    {
        for (auto& a : t.autos) if (a.param == param) { v = lineAt (a, bar); return true; }
        return false;
    }

    /** A line of levels (dB) read as a gain. Between two points it goes evenly in dB, as ever; into silence or out of it
        (a point at the fader's foot, −∞) it goes on to nothing as the ear hears a fade — it used to fall evenly in dB to
        −48 and then drop to nothing at once, heard as a cut (his ear, 2026-10-22). */
    static float lineGainAt (const Auto& a, double bar)
    {
        const auto& p = a.pts;
        if (bar <= p.front().first) return dbGain (p.front().second);
        if (bar >= p.back().first)  return dbGain (p.back().second);
        size_t lo = 0, hi = p.size() - 1;
        while (hi - lo > 1) { const size_t mid = (lo + hi) / 2; if (p[mid].first <= bar) lo = mid; else hi = mid; }
        const double span = p[hi].first - p[lo].first;
        if (span <= 1.0e-9) return dbGain (p[hi].second);
        const float va = p[lo].second, vb = p[hi].second;
        const double x = (bar - p[lo].first) / span;
        const bool qa = va <= -47.5f, qb = vb <= -47.5f;
        if (! qa && ! qb) return dbGain (va + (vb - va) * (float) x);
        if (qa && qb) return 0.0f;
        return qb ? dbGain (va) * (float) std::pow (1.0 - x, 2.5) : dbGain (vb) * (float) std::pow (x, 2.5);
    }
    static bool evalAutoGain (const Track& t, int param, double bar, float& g)
    {
        for (auto& a : t.autos) if (a.param == param) { g = lineGainAt (a, bar); return true; }
        return false;
    }

    float dbGainOf (const Track& t, double bar) const { float g; return (evalAutoGain (t, kAutoVol, bar, g) ? g : t.vol.load()) * t.gate.load(); }

    /** Add what a region sounds like over [pos, pos + n) into L/R. `endBar` cuts it off. */
    void addRegion (const std::vector<std::shared_ptr<Buf>>& held, const Region& r, juce::int64 pos, int n, double barS, float* L, float* R, double endBar) const
    {
        if (n <= 0 || r.buf < 0 || r.buf >= (int) held.size() || held[(size_t) r.buf] == nullptr) return;
        const auto& b = held[(size_t) r.buf]->data;
        const int len = b.getNumSamples();
        if (len < 2) return;
        const juce::int64 rs = (juce::int64) std::llround (r.a * barS), reTrue = (juce::int64) std::llround (r.b * barS);
        const juce::int64 re = juce::jmin (reTrue, (juce::int64) std::llround (endBar * barS));
        const juce::int64 from = juce::jmax (pos, rs), to = juce::jmin (pos + n, re);
        if (to <= from) return;
        const int off = (int) (from - pos), cnt = (int) (to - from);
        const float* s0 = b.getReadPointer (0);
        const float* s1 = b.getReadPointer (b.getNumChannels() > 1 ? 1 : 0);
        const double fiS = r.fi * barS, foS = r.fo * barS;
        const bool flat = fiS <= 0.0 && foS <= 0.0;
        auto level = [&] (int i) -> float          // the region's own gain, shaped by its fades
        {
            float g = r.gain;
            if (fiS > 0.0) { const double t = (double) (from - rs + i); if (t < fiS) g *= fadeShape (r.fic, t / fiS, r.fib); }
            if (foS > 0.0) { const double t = (double) (reTrue - from - i); if (t < foS) g *= fadeShape (r.foc, t / foS, r.fob); }
            return g;
        };
        /*  Where the sound's own beginning lies along the song, to the sample. Every piece cut from one region has the
            same one (its start and its place in the source move together), so pieces stay in step exactly: a plain cut
            changes nothing, and two pieces sharing a stretch — a crossfade — add up to the sound they were cut from.   */
        const juce::int64 origin = (juce::int64) std::llround ((r.a - r.off) * barS);
        if (r.loop)
        {
            int idx = (int) ((((from - origin) % (juce::int64) len) + (juce::int64) len) % (juce::int64) len);
            for (int i = 0; i < cnt; ++i) { const float g = flat ? r.gain : level (i); L[off + i] += s0[idx] * g; R[off + i] += s1[idx] * g; if (++idx >= len) idx = 0; }
        }
        else
        {
            double x = (double) (from - origin) * r.rate;
            for (int i = 0; i < cnt; ++i, x += r.rate)
            {
                if (x < 0.0) continue;
                const int i0 = (int) x;
                if (i0 >= len - 1) break;
                const float f = (float) (x - (double) i0), g = flat ? r.gain : level (i);
                L[off + i] += (s0[i0] + (s0[i0 + 1] - s0[i0]) * f) * g;
                R[off + i] += (s1[i0] + (s1[i0 + 1] - s1[i0]) * f) * g;
            }
        }
    }

    /** The patch and the plug-ins of one track, in place on its first n samples. */
    void renderTrack (Track& t, juce::int64 pos, int n, bool rolling, double barS, double bar)
    {
        if (t.wall)
        {
            /* a wall: one graph of prints and plug-ins. The Patch engine runs it — the fan-outs, the mixes, the ways side by
               side lined up by their lateness — and calls back (wallOutside) where a plug-in stands. */
            if (t.chain == nullptr) return;
            const float bpm = (float) tempo.load(); const double ppq = (double) pos / barS * barQuarters();
            float macros[orbfx::kNumMacros] {};
            for (int i = 0; i < orbfx::kMaxNodes; ++i)
            {
                auto& p = t.prmNow[i];
                p = t.prm[i];                                                  // (where the hands are set; the control prints move them from there, this block only)
                const int src = t.slotSrc[i];
                float v;
                p.amount = src == 0 ? t.amt[(size_t) i].load()
                         : evalAuto (t, src == 1 ? kAutoTape : src == 2 ? kAutoSpace : kAutoDelay, bar, v) ? juce::jlimit (0.0f, 1.0f, v)
                         : (src == 1 ? t.tape : src == 2 ? t.space : t.delay).load();
                p.bpm = bpm; p.ppq = ppq; p.playing = rolling;
                if (t.slotType[i] == orbfx::kMacro) macros[juce::jlimit (0, orbfx::kNumMacros - 1, p.aux[0])] = p.amount;      // a macro print's knob
            }
            for (auto& a : t.autos)                                            // a print's hand with a line (a macro of the track wired to it): where the line is, along the hand
            {
                if (a.param != kAutoPrint || a.node < 0 || a.node >= orbfx::kMaxNodes || a.table.size() < 2) continue;
                const float x = juce::jlimit (0.0f, 1.0f, lineAt (a, bar)) * (float) (a.table.size() - 1);
                const int i0 = juce::jmin ((int) x, (int) a.table.size() - 2);
                const float v = a.table[(size_t) i0] + (a.table[(size_t) i0 + 1] - a.table[(size_t) i0]) * (x - (float) i0);
                auto& p = t.prmNow[a.node];
                switch (a.field)
                {
                    case 0:  p.amount = juce::jlimit (0.0f, 1.0f, v); break;
                    case 1:  p.variant = juce::jlimit (0, 7, (int) std::lround (v)); break;
                    case 2:  p.decay = juce::jlimit (0.0f, 1.0f, v); break;
                    case 3:  p.delayDiv = juce::jlimit (0, 7, (int) std::lround (v)); break;
                    case 4:  p.delayFb = juce::jlimit (0.0f, 1.0f, v); break;
                    default: if (a.field >= 10 && a.field < 10 + orbfx::kAuxCount) p.aux[a.field - 10] = (int) std::lround (v); break;
                }
            }
            if (t.chain != nullptr) t.mod.apply (t.prmNow, n, (float) sr, bpm, rolling, ppq, macros, *t.chain);
            t.barNow = bar;
            juce::AudioBuffer<float> view (t.work.getArrayOfWritePointers(), 2, n);
            float gr = 0.0f;
            const juce::AudioBuffer<float>* sideIn = nullptr;                   // a side on the wall: the track it plays, as it is this block (a track of an earlier rank), lined up
            juce::AudioBuffer<float> sideView;
            if (t.side != nullptr && t.sideBuf.getNumSamples() >= n && t.sideBuf.getNumChannels() >= 2)
            {
                t.sideBuf.clear (0, n);
                t.sideHold.add (t.side->work.getReadPointer (0), t.side->work.getReadPointer (1), t.sideBuf.getWritePointer (0), t.sideBuf.getWritePointer (1), n, 1.0f, 1.0f);
                sideView.setDataToReferTo (t.sideBuf.getArrayOfWritePointers(), 2, n);
                sideIn = &sideView;
            }
            t.chain->process (view, (float) sr, t.prmNow, gr, sideIn);
            return;
        }
        if (t.chain != nullptr)
        {
            const float bpm = (float) tempo.load(); const double ppq = (double) pos / barS * barQuarters();
            float v;
            t.prm[0].amount = evalAuto (t, kAutoTape, bar, v) ? juce::jlimit (0.0f, 1.0f, v) : t.tape.load();
            t.prm[1].amount = evalAuto (t, kAutoSpace, bar, v) ? juce::jlimit (0.0f, 1.0f, v) : t.space.load(); t.prm[1].variant = 0; t.prm[1].decay = 0.5f;
            t.prm[2].amount = evalAuto (t, kAutoDelay, bar, v) ? juce::jlimit (0.0f, 1.0f, v) : t.delay.load(); t.prm[2].delayDiv = 2; t.prm[2].delayFb = 0.35f;
            for (int i = 0; i < 4; ++i) { t.prm[i].bpm = bpm; t.prm[i].ppq = ppq; t.prm[i].playing = rolling; }
            juce::AudioBuffer<float> view (t.work.getArrayOfWritePointers(), 2, n);
            float gr = 0.0f;
            t.chain->process (view, (float) sr, t.prm, gr);
        }
        for (auto& i : t.inserts)
        {
            for (auto& a : t.autos) if (a.param == kAutoPlug && a.uid == i->uid) i->setParam (a.index, lineAt (a, bar), a.told);      // a line drawn for one of its controls
            const Track* k = i->key;                                               // (a track of an earlier rank: its sound of this block is whole by now)
            i->process (t.work.getWritePointer (0), t.work.getWritePointer (1), n, k != nullptr ? k->work.getReadPointer (0) : nullptr, k != nullptr ? k->work.getReadPointer (1) : nullptr);
        }
    }

    /** What one stretch of the song is, for every track of it. */
    struct Stretch
    {
        Engine* e; juce::int64 pos; int n; bool rolling; double barS, bar0, bar1, endBar;
        const float* const* in; Tap* tap; Track* const* list;
        const std::vector<std::shared_ptr<Buf>>* bufs;         // the sounds this stretch reads: the engine's own under its lock, or a print's copy of them
        const juce::MidiBuffer* live; int liveFrom; bool offline;      // what is played by hand in the device's block this stretch is a part of, and where in that block the stretch begins
    };
    static void playThunk (void* context, int index) { auto& st = *static_cast<Stretch*> (context); st.e->playTrack (*st.list[index], st); }

    /** One track's own part of a stretch, in its own buffer: its regions and the input it listens to (on top of whatever
        has already flowed into it), its patch and plug-ins, its fader and balance. It touches nothing of any other
        track, so the tracks of one rank can be played at the same time. */
    void playTrack (Track& t, const Stretch& st)
    {
        Tap* tap = st.tap;
        if (tap != nullptr && tap->only.count (&t) == 0) return;                // a print of one track: what does not flow into it stays out
        const auto t0 = juce::Time::getHighResolutionTicks();
        const int n = st.n;
        float* L = t.work.getWritePointer (0); float* R = t.work.getWritePointer (1);
        const bool kept = tap != nullptr && tap->t == &t;
        const bool dead = t.dead.load (std::memory_order_relaxed);
        if (dead) { juce::FloatVectorOperations::clear (L, n); juce::FloatVectorOperations::clear (R, n); }      // (what flowed into it — sends, a stack's tracks — goes no further)
        /*  Resting (his ask, 2026-10-21: as fast as it can go, and nothing less at hand). A track that is not heard — muted,
            or soloed away, its fader come to rest at nothing — takes no more sound in: no region is read, and what it plays
            and what flows into it go no further than its door. And a track that has had nothing coming in and given nothing
            out for longer than its plug-ins ring on (eight seconds at least) is not worked at all — its plug-ins and its
            patch rest — until sound comes to it again, in the very block it comes. What is heard is the same: only silence
            is not worked out. Never in a print or a measure, never for a track something listens to (a key, a side) or one
            that listens to another; a switched-off track is skipped whole, as before.                                 */
        const bool mayRest = ! st.offline && tap == nullptr && t.printLive == nullptr && ! t.keyFor && ! t.keyed && ! dead && restOn.load (std::memory_order_relaxed);
        const bool unheard = mayRest && t.gate.load (std::memory_order_relaxed) == 0.0f && t.gainSm == 0.0f;
        if (t.kind == 0 && ! dead)
        {
            if (st.rolling && ! unheard) { const juce::int64 early = t.ahead.load(); for (auto& r : t.regs) addRegion (*st.bufs, r, st.pos + early, n, st.barS, L, R, st.endBar); }
            if (st.in != nullptr && t.mon.load() && ! unheard)
            {
                const float* a; const float* b;
                pickInput (st.in, t.input.load(), a, b);
                for (int i = 0; i < n; ++i) { L[i] += a[i]; R[i] += b[i]; }
            }
            if ((t.notes || t.built != nullptr || t.plug != nullptr) && ! t.frozen.load (std::memory_order_relaxed)) playNotes (t, st, L, R);      // (an instrument goes on playing — its keys must still be let go of — unless the track plays its print)
        }
        bool rest = false, stillIn = false;
        if (mayRest)
        {
            if (unheard) { juce::FloatVectorOperations::clear (L, n); juce::FloatVectorOperations::clear (R, n); }
            stillIn = quietIn (L, R, n);
            const int after = t.sleepAfter.load (std::memory_order_relaxed);
            rest = stillIn && after > 0 && t.quiet >= after;
            if (rest) { juce::FloatVectorOperations::clear (L, n); juce::FloatVectorOperations::clear (R, n); t.rested.fetch_add (1, std::memory_order_relaxed); }
        }
        if (! (kept && tap->dry) && ! dead && ! rest && ! t.frozen.load (std::memory_order_relaxed)) renderTrack (t, st.pos, n, st.rolling, st.barS, st.rolling ? st.bar0 + (double) t.earlyIn.load() / st.barS : st.bar0);
        if (mayRest && ! rest)
        {
            const bool stillOut = stillIn && quietIn (L, R, n);
            t.quiet = stillOut ? t.quiet + n : 0;                      // (nothing came in, and nothing came out of its plug-ins either)
            if (stillIn) { const auto l = juce::FloatVectorOperations::findMinAndMax (L, n); const float m = juce::jmax (-l.getStart(), l.getEnd()); if (m > t.stillOut.load (std::memory_order_relaxed)) t.stillOut.store (m, std::memory_order_relaxed); }
        }
        else if (! mayRest) t.quiet = 0;
        if (kept && tap->pre) { tap->buf.copyFrom (0, 0, L, n); tap->buf.copyFrom (1, 0, R, n); }
        if (t.printLive != nullptr && t.printLive->pre && n <= t.printLive->buf.getNumSamples()) { t.printLive->buf.copyFrom (0, 0, L, n); t.printLive->buf.copyFrom (1, 0, R, n); }      // (a realtime print before the fader)

        // the fader and the balance, moving to where they should be by the end of the stretch
        float v;
        const double barOut = st.rolling ? st.bar1 + (double) t.early.load() / st.barS : st.bar1;      // (the sound here is early by what is still to come: see Track::early)
        const float target = dbGainOf (t, barOut), gs = (target - t.gainSm) / (float) n;
        const float pn0 = t.panSm, pn1 = evalAuto (t, kAutoPan, barOut, v) ? juce::jlimit (-1.0f, 1.0f, v) : t.pan.load();
        float pl = pn0 <= 0.0f ? 1.0f : 1.0f - pn0, pr = pn0 >= 0.0f ? 1.0f : 1.0f + pn0;
        const float pls = ((pn1 <= 0.0f ? 1.0f : 1.0f - pn1) - pl) / (float) n, prs = ((pn1 >= 0.0f ? 1.0f : 1.0f + pn1) - pr) / (float) n;
        float g = t.gainSm, pk = 0.0f, pkL = 0.0f, pkR = 0.0f;
        const bool fine = fineOn.load (std::memory_order_relaxed) && st.rolling;      // (a realtime print: what comes out, finely)
        const int fineStep = juce::jmax (1, (int) (sr / 200.0));
        for (int i = 0; i < n; ++i)
        {
            g += gs; pl += pls; pr += prs;
            const float l = L[i] * g * pl, r = R[i] * g * pr;
            L[i] = l; R[i] = r;
            const float al = std::abs (l), ar = std::abs (r), a = al > ar ? al : ar;
            if (a > pk) pk = a;
            if (al > pkL) pkL = al;
            if (ar > pkR) pkR = ar;
            if (fine)
            {
                if (a > t.fineMax) t.fineMax = a;
                if (++t.fineN >= fineStep)
                {
                    const int w = t.fineW.load (std::memory_order_relaxed);
                    t.fineBar[w % Track::kFine] = (float) ((double) (st.pos + i + t.early.load (std::memory_order_relaxed)) / st.barS);
                    t.finePk[w % Track::kFine] = t.fineMax;
                    t.fineW.store (w + 1, std::memory_order_release);
                    t.fineN = 0; t.fineMax = 0.0f;
                }
            }
        }
        t.gainSm = target; t.panSm = pn1;
        if (pk > t.peak.load()) t.peak.store (pk);
        if (pkL > t.peakL.load()) t.peakL.store (pkL);
        if (pkR > t.peakR.load()) t.peakR.store (pkR);
        if (kept && ! tap->pre) { tap->buf.copyFrom (0, 0, L, n); tap->buf.copyFrom (1, 0, R, n); }
        if (t.printLive != nullptr && ! t.printLive->pre && n <= t.printLive->buf.getNumSamples()) { t.printLive->buf.copyFrom (0, 0, L, n); t.printLive->buf.copyFrom (1, 0, R, n); }      // (… after it)
        const float took = (float) juce::Time::highResolutionTicksToSeconds (juce::Time::getHighResolutionTicks() - t0);
        t.cost += (took - t.cost) * 0.2f;
    }

    /** A print or a measure is about to play the song from somewhere: no key is down, and the DAW's own instruments are
        silent at once (one from outside is sent its keys up when the pass begins — see playNotes — and dies away). */
    /** Nothing in this block worth working out: under -120 dB all along. */
    static bool quietIn (const float* L, const float* R, int n)
    {
        const auto l = juce::FloatVectorOperations::findMinAndMax (L, n), r = juce::FloatVectorOperations::findMinAndMax (R, n);
        return juce::jmax (-l.getStart(), l.getEnd(), -r.getStart(), r.getEnd()) < 1.0e-6f;
    }
    static void quietNotes (Track& t)
    {
        if (t.built != nullptr) { t.built->allOff (true); t.keysUp(); }
        t.rolled = false; t.nextS = -1;
    }

    /** What a track of notes plays over a stretch: the song's notes that fall in it, and whatever is played by hand; then
        the instrument's own sound, added to the track's. Touches nothing of any other track. */
    void playNotes (Track& t, const Stretch& st, float* L, float* R)
    {
        auto& now = t.now;
        now.clear();
        const int n = st.n;
        auto put = [&now] (int at, juce::uint8 s, juce::uint8 d1, juce::uint8 d2) { if (now.size() < now.capacity()) now.push_back ({ at, s, d1, d2 }); };
        auto letGo = [&put] (juce::uint8* held, int at) { for (int k = 0; k < 128; ++k) for (; held[k] > 0; --held[k]) put (at, 0x80, (juce::uint8) k, 0); };
        const juce::int64 from = st.pos + t.ahead.load(), to = from + n;
        const bool moved = st.rolling && (! t.rolled || from != t.nextS), changed = t.stale.exchange (false);
        /*  The song is somewhere else than its last notes were read up to, or stands still, or is not what it was: the
            keys it held come up, the pedal with them, and what was bent goes back.                                     */
        if (moved || changed || (! st.rolling && t.rolled)) { letGo (t.heldSong, 0); put (0, 0xB0, 64, 0); put (0, 0xE0, 0, 64); }
        if (t.hush.exchange (false)) { letGo (t.heldSong, 0); letGo (t.heldLive, 0); t.liveDown = 0; put (0, 0xB0, 64, 0); put (0, 0xB0, 123, 0); put (0, 0xB0, 120, 0); }      // every key up, every sound off
        if (st.rolling && t.notes)
        {
            const double barS = st.barS;
            const juce::int64 endS = (juce::int64) std::llround (st.endBar * barS), stop = juce::jmin (to, endS);
            auto it = std::lower_bound (t.evs.cbegin(), t.evs.cend(), ((double) from - 0.5) / barS, [] (const NoteEv& e, double b) { return e.bar < b; });
            if (moved || changed)
            {
                /* what was turned before this place still holds here: the last bend, and the last setting of every controller */
                bool bent = false, seen[128] {};
                int looked = 0;
                for (auto back = it; back != t.evs.cbegin() && looked < 8192; ++looked)
                {
                    --back;
                    const int type = back->st & 0xF0;
                    if (type == 0xE0 && ! bent) { bent = true; put (0, back->st, back->d1, back->d2); }
                    else if (type == 0xB0 && ! seen[back->d1]) { seen[back->d1] = true; put (0, back->st, back->d1, back->d2); }
                }
            }
            for (; it != t.evs.cend(); ++it)
            {
                const juce::int64 s = (juce::int64) std::llround (it->bar * barS);
                if (s < from) continue;
                if (s >= stop) break;
                const int type = it->st & 0xF0;
                if (type == 0x90) { if (t.heldSong[it->d1] < 255) ++t.heldSong[it->d1]; }
                else if (type == 0x80) { if (t.heldSong[it->d1] == 0) continue; --t.heldSong[it->d1]; }      // (a key that is not down — its note began before the place the song was started from — is not lifted)
                put ((int) (s - from), it->st, it->d1, it->d2);
            }
            if (endS >= from && endS < to) letGo (t.heldSong, (int) (endS - from));      // where the song ends (or what is being printed), every key comes up
        }
        if (st.rolling) t.nextS = to;
        t.rolled = st.rolling;

        // what is played by hand
        if (t.live.load() && ! st.offline)
        {
            if (st.live != nullptr)
                for (const auto meta : *st.live)
                {
                    const int at = meta.samplePosition - st.liveFrom;
                    if (at < 0 || at >= n || meta.numBytes < 2 || meta.numBytes > 3) continue;
                    const juce::uint8 s = meta.data[0], d1 = meta.data[1] & 127, d2 = meta.numBytes > 2 ? (juce::uint8) (meta.data[2] & 127) : (juce::uint8) 0;
                    const int type = s & 0xF0;
                    if (type == 0x90 && d2 > 0) { if (t.heldLive[d1] < 255) { ++t.heldLive[d1]; ++t.liveDown; } }
                    else if (type == 0x80 || type == 0x90) { if (t.heldLive[d1] == 0) continue; --t.heldLive[d1]; --t.liveDown; }
                    put (at, s, d1, d2);
                }
        }
        else if (t.liveDown > 0) { letGo (t.heldLive, 0); t.liveDown = 0; }      // it no longer listens: the keys that were down on it come up

        for (size_t i = 1; i < now.size(); ++i)                        // in the order they fall (they are few, and nearly in order)
        {
            const auto e = now[i]; size_t k = i;
            while (k > 0 && now[k - 1].at > e.at) { now[k] = now[k - 1]; --k; }
            now[k] = e;
        }
        if (t.built != nullptr) { if (! now.empty() || t.built->sounding()) t.built->render (L, R, n, now.data(), (int) now.size()); }
        else if (t.plug != nullptr)
        {
            t.plugMidi.clear();
            for (auto& e : now) { const juce::uint8 b[3] = { e.st, e.d1, e.d2 }; const int type = e.st & 0xF0; t.plugMidi.addEvent (b, type == 0xC0 || type == 0xD0 ? 2 : 3, e.at); }
            t.plug->play (L, R, n, t.plugMidi);
        }
    }

    /** A track's sound, once it is made, on to the bus it plays into or the stereo out; and to the side, whatever it sends. */
    void passOn (Track& t, int n, double bar1, bool rolling, double barS, Tap* tap, float* mL, float* mR)
    {
        if (tap != nullptr && tap->only.count (&t) == 0) return;
        const float* L = t.work.getReadPointer (0); const float* R = t.work.getReadPointer (1);
        float* dL = t.out != nullptr ? t.out->work.getWritePointer (0) : mL;
        float* dR = t.out != nullptr ? t.out->work.getWritePointer (1) : mR;
        if (t.outHold.len == 0) { juce::FloatVectorOperations::add (dL, L, n); juce::FloatVectorOperations::add (dR, R, n); }
        else t.outHold.add (L, R, dL, dR, n, 1.0f, 1.0f);
        float v;
        for (int k = 0; k < kMaxSends; ++k)
        {
            auto& s = t.sends[k];
            if (s.dst == nullptr) continue;
            const float st = evalAutoGain (t, kAutoSend0 + k, rolling ? bar1 + (double) t.early.load() / barS : bar1, v) ? v : s.gain.load();      // (read as early as the sound is here, like the fader)
            s.hold.add (L, R, s.dst->work.getWritePointer (0), s.dst->work.getWritePointer (1), n, s.sm, st);
            s.sm = st;
        }
    }

    /** One stretch of every track. Rank by rank: each rank's tracks are played (shared out among the threads when the rank
        is heavy enough to be worth waking them), then their sound is passed on in the tracks' own order by this thread
        alone, so the sums come out the same whoever played what. */
    void renderGraph (juce::int64 pos, int n, bool rolling, bool offline, const float* const* in, double endBar, Tap* tap, const juce::MidiBuffer* live = nullptr, int liveFrom = 0)
    {
        const double barS = barSamples(), bar0 = juce::jmax (0.0, (double) pos / barS), bar1 = rolling ? juce::jmax (0.0, (double) (pos + n) / barS) : bar0;
        if (offline) { playHead.bpm.store (tempo.load()); playHead.ppq.store ((double) pos / barS * barQuarters()); playHead.playing.store (rolling); playHead.samples.store (pos); }
        mix.clear (0, n);
        if (offline && leaving.load (std::memory_order_relaxed)) { if (tap != nullptr) tap->buf.clear (0, juce::jmin (n, tap->buf.getNumSamples())); return; }      // (the app is going: nothing more is played; the print gives up at its next step)
        for (auto& tp : tracks) tp->work.clear (0, n);
        float* mL = mix.getWritePointer (0); float* mR = mix.getWritePointer (1);
        /*  A print does not hold the engine's lock while it runs (it would hold up the page for minutes), so the sounds it
            reads must not be the engine's own list: a sound let go meanwhile, or a new one that makes the list grow,
            would pull the ground from under it. It reads the copy made when it began (printBufs), which keeps every one
            of them alive until it is done.                                                                             */
        Stretch st { this, pos, n, rolling, barS, bar0, bar1, endBar, in, tap, nullptr, offline ? &printBufs : &bufs, live, liveFrom, offline };
        size_t from = 0;
        for (const size_t end : rankEnds)
        {
            const int count = (int) (end - from);
            st.list = order.data() + from;
            float heavy = 0.0f;
            if (pool.size() > 0 && count > 1) for (size_t k = from; k < end; ++k) heavy += order[k]->cost;
            if (heavy > kWorthSharing) { pool.run (&playThunk, &st, count); shared.fetch_add (1, std::memory_order_relaxed); }
            else for (int i = 0; i < count; ++i) playTrack (*st.list[i], st);
            for (size_t k = from; k < end; ++k) passOn (*order[k], n, bar1, rolling, barS, tap, mL, mR);
            from = end;
        }
    }

    /** The last guard before the speakers (and before a mixdown's file): fast down, slow back up. */
    void limit (float& l, float& r)
    {
        const float a = juce::jmax (std::abs (l), std::abs (r)), want = a > 0.98f ? 0.98f / a : 1.0f;
        limG = want < limG ? want : limG + (want - limG) * limRel;
        l *= limG; r *= limG;
    }

    /** A print has ended (called on its thread): a device rate that could not be followed while it ran is followed now. */
    void printOver() { juce::MessageManager::callAsync ([this] { followDevice(); }); }
    /** Message thread: the rate the device has now is the one to follow. It is asked of the device at the moment of acting,
        never carried over from an earlier start — the device may have moved on, or back again, since. */
    void followDevice()
    {
        if (auto* d = dm.getCurrentAudioDevice()) adoptRate (d->getCurrentSampleRate());
    }
    /** The rate under the engine has moved: follow it, and ask for every buffer again. Message thread. */
    void adoptRate (double newRate)
    {
        if (newRate < 8000.0) return;                                  // (a device that cannot say its rate)
        if (std::abs (newRate - sr) < 1.0) { rateOff.store (false); return; }
        if (bouncing.load() || recording.load())                       // in the middle of a take or a print it cannot be followed: when that is over the device is asked again (printOver, recStop)
        {
            rateOff.store (true);
            if (recording.load() && onTakeStalled) onTakeStalled (true);      // (a take cannot go on at another rate: nothing more comes in, and the page is told, so that it ends the take with what it has)
            return;
        }
        {
            const juce::ScopedLock sl (lock);
            sr = newRate;
            limRel = 1.0f - std::exp (-1.0f / (0.12f * (float) sr));
            for (auto& tp : tracks)
            {
                readyPatch (*tp);
                tp->eachPlug ([this] (Insert& i) { const Inside inside (i.uid); i.letGo(); i.prepare (sr, maxBlock, &playHead); });
                if (tp->built != nullptr) tp->built->prepare (sr);      // (the sounds it plays from are at the old rate: the page hands them over again)
                tp->keysUp();
            }
            keys.reset (sr);
            playing.store (false);
        }
        rateOff.store (false);
        logLine ("engine follows the device to " + String (sr));
        if (onRateChanged) onRateChanged();
    }

    void audioDeviceAboutToStart (juce::AudioIODevice* d) override
    {
        if (d == nullptr) return;
        const double r = d->getCurrentSampleRate();
        inLat = d->getInputLatencyInSamples(); outLat = d->getOutputLatencyInSamples();
        inputOn.store (d->getActiveInputChannels().countNumberOfSetBits() > 0);
        pool.setGroup (d->getWorkgroup());
        if (r < 8000.0) return;                                        // (it cannot say its rate: nothing to follow, and nothing is played at a rate of none)
        const bool off = std::abs (r - sr) > 1.0;
        rateOff.store (off);
        if (off) logLine ("device rate is now " + String (r));
        juce::MessageManager::callAsync ([this] { followDevice(); });  // (also when the rate is the engine's own again: whatever was waiting to be followed is settled against the device as it is)
    }
    void audioDeviceStopped() override
    {
        if (recording.load() && takeWriting.load() && ! leaving.load() && ! takeBroken.exchange (true))      // the device stopped under a take that was being written (see the hole in its blocks, in the callback): the take ends with what came in
            juce::MessageManager::callAsync ([this] { if (recording.load() && onTakeStalled) onTakeStalled (false); });
    }

    void audioDeviceIOCallbackWithContext (const float* const* in, int numIn, float* const* out, int numOut, int n, const juce::AudioIODeviceCallbackContext&) override
    {
        juce::ScopedNoDenormals noDenormals;
        const auto t0 = juce::Time::getHighResolutionTicks();
        const int asked = n;
        /*  A take cannot go on across a hole in the device's blocks (the machine slept, the device was taken away and came
            back): what came in before the hole is the take — what came after would lie too early in its file by as long as
            the hole lasted. Half a second without a block is a hole (a block that is merely late is not): nothing more is
            written, and the page is told, so that it ends the take with what it has. (Only once the take is being written:
            before its first sample — in the count-in — nothing can lie too early, and the song does not move in a hole.)  */
        {
            const auto now = (juce::int64) mach_continuous_time();     // (a clock that runs on while the machine sleeps: the one the blocks are timed with stands still then, and a night with the lid shut would be no hole at all)
            const auto was = lastBlockTick.exchange (now, std::memory_order_relaxed);
            if (was != 0 && takeWriting.load (std::memory_order_relaxed) && (double) (now - was) * tickSeconds > juce::jmax (0.5, 3.0 * (double) n / juce::jmax (8000.0, sr)) && ! takeBroken.exchange (true))
                juce::MessageManager::callAsync ([this] { if (recording.load() && onTakeStalled) onTakeStalled (false); });
        }
        struct Timed { Engine& e; juce::int64 t0; int n; ~Timed() { e.timed (t0, n); } } timedBlock { *this, t0, asked };
        for (int c = 0; c < numOut; ++c) if (out[c] != nullptr) juce::FloatVectorOperations::clear (out[c], n);
        /*  The message thread holds the lock for a moment whenever the song changes hands (a few hundredths of a
            thousandth of a second: pointers only). A block that arrives in that moment waits for it — up to a sixth of
            its own length — and only then is given up and played as silence.                                        */
        struct Held
        {
            Held (juce::CriticalSection& c, double waitSeconds) : cs (c)
            {
                got = cs.tryEnter();
                if (got) return;
                const auto until = juce::Time::getHighResolutionTicks() + juce::Time::secondsToHighResolutionTicks (waitSeconds);
                while (! got && juce::Time::getHighResolutionTicks() < until) { for (int k = 0; k < 64; ++k) spin(); got = cs.tryEnter(); }
            }
            ~Held() { if (got) cs.exit(); }
            static void spin() noexcept
            {
               #if defined (__aarch64__)
                __asm__ __volatile__ ("yield");
               #elif defined (__x86_64__)
                __builtin_ia32_pause();
               #endif
            }
            juce::CriticalSection& cs; bool got = false;
        } held (lock, (double) n / sr / 6.0);
        if (! held.got) { if (! bouncing.load()) perfHeld.fetch_add (1); return; }
        if (bouncing.load() || rateOff.load() || numOut < 1 || out[0] == nullptr) return;
        // the inputs of this block: every one the device has open (a tone on all of them in the self-test); a missing one reads as silence
        if ((int) silence.size() < n) return;
        const float* ins[kMaxIn];
        bool any = false;
        if (testInput)
        {
            n = juce::jmin (n, (int) testBuf.size());
            const float w = juce::MathConstants<float>::twoPi * 220.0f / (float) sr;
            for (int i = 0; i < n; ++i) { testBuf[(size_t) i] = 0.25f * std::sin (testPhase); testPhase += w; if (testPhase > juce::MathConstants<float>::twoPi) testPhase -= juce::MathConstants<float>::twoPi; }
            for (auto& p : ins) p = testBuf.data();
            any = true;
        }
        else
        {
            for (int c = 0; c < kMaxIn; ++c) { ins[c] = c < numIn && in[c] != nullptr ? in[c] : silence.data(); any = any || (c < numIn && in[c] != nullptr); }
        }
        if (any)
        {
            float pk = 0.0f;
            for (int c = 0; c < juce::jmin (kMaxIn, testInput ? 1 : numIn); ++c) for (int i = 0; i < n; ++i) { const float a = std::abs (ins[c][i]); if (a > pk) pk = a; }
            if (pk > inPeak.load()) inPeak.store (pk);
        }
        const bool silent = mute.load();
        liveBlock.clear();
        keys.removeNextBlockOfMessages (liveBlock, n);                 // what the keys have sent since the last block, each thing at its sample
        blockLive = liveBlock.isEmpty() ? nullptr : &liveBlock; blockN = n;
        int done = 0;
        while (done < n)
        {
            const float* now[kMaxIn];
            for (int c = 0; c < kMaxIn; ++c) now[c] = ins[c] == silence.data() ? ins[c] : ins[c] + done;
            blockDone = done;
            const juce::int64 was = posS;
            const int got = renderSome (juce::jmin (n - done, maxBlock), any ? now : nullptr);
            if (got <= 0) break;
            const float* mL = mix.getReadPointer (0); const float* mR = mix.getReadPointer (1); const float* ck = clk.getReadPointer (0);
            const Buf* rb = refBuf.get();
            const auto* rps = refPieces.get();
            const bool rolling = posS != was;                                                  // (the song went on: the reference goes on with it; stopped, it is silent)
            const juce::int64 refAt = rb != nullptr ? posS - got - (juce::int64) std::llround (refStartBar * barSamples()) : 0;
            const double refBarS = barSamples();
            size_t refPi = 0;                                                                  // (the piece the stretch is in: found once, gone on from)
            const float rv = refVol.load(), rT = refOn.load() ? 1.0f : 0.0f, rStep = 1.0f / (0.02f * (float) sr);
            const int rLen = rb != nullptr ? rb->data.getNumSamples() : 0, rR = rb != nullptr ? juce::jmin (1, rb->data.getNumChannels() - 1) : 0;
            const float mT = master.load(), ms = (mT - masterSm) / (float) got;
            double sq = 0.0; float pk = 0.0f, pL = 0.0f, pR = 0.0f;
            for (int i = 0; i < got; ++i)
            {
                masterSm += ms;
                float l = mL[i] * masterSm, r = mR[i] * masterSm;
                limit (l, r);
                if (liveMixOut != nullptr) { liveMixOut->buf.setSample (0, i, l); liveMixOut->buf.setSample (1, i, r); }      // (a realtime print of the mix: what goes to the speakers)
                if (rb != nullptr || refX > 0.0f)
                {
                    refX = refX < rT ? juce::jmin (rT, refX + rStep) : juce::jmax (rT, refX - rStep);
                    float a = 0.0f, b = 0.0f;
                    if (rb != nullptr && rolling && rps != nullptr)
                    {
                        /* its pieces: the one the song is in, read where it begins in the file, through its gain and fades */
                        const double at = (double) (posS - got + i) / refBarS;
                        while (refPi < rps->size() && (*rps)[refPi].b <= at) ++refPi;
                        if (refPi < rps->size() && (*rps)[refPi].a <= at && ! (*rps)[refPi].mute)
                        {
                            const auto& p = (*rps)[refPi];
                            const juce::int64 k = (juce::int64) std::llround ((at - p.a + p.off) * refBarS);
                            if (k >= 0 && k < rLen)
                            {
                                float env = p.g;
                                if (p.fi > 0.0 && at - p.a < p.fi) env *= (float) ((at - p.a) / p.fi);
                                if (p.fo > 0.0 && p.b - at < p.fo) env *= (float) ((p.b - at) / p.fo);
                                a = rb->data.getSample (0, (int) k) * rv * env; b = rb->data.getSample (rR, (int) k) * rv * env;
                            }
                        }
                    }
                    else if (rb != nullptr && rolling) { const juce::int64 k = refAt + i; if (k >= 0 && k < rLen) { a = rb->data.getSample (0, (int) k) * rv; b = rb->data.getSample (rR, (int) k) * rv; } }
                    if (refX > 0.0f) { l += (a - l) * refX; r += (b - r) * refX; }
                }
                const float al = std::abs (l), ar = std::abs (r);
                sq += (double) (l * l + r * r) * 0.5; if (al > pL) pL = al; if (ar > pR) pR = ar;
                if (! silent) { out[0][done + i] = l + ck[i]; if (numOut > 1 && out[1] != nullptr) out[1][done + i] = r + ck[i]; }
            }
            masterSm = mT;
            pk = juce::jmax (pL, pR);
            meterSq.store (meterSq.load() + sq); meterN.store (meterN.load() + got); if (pk > meterPk.load()) meterPk.store (pk);
            if (pL > meterL.load()) meterL.store (pL);
            if (pR > meterR.load()) meterR.store (pR);
            liveWrite (got);
            done += got;
        }
    }

    /** One block is done: how long it took, against how long it lasts. */
    void timed (juce::int64 t0, int n)
    {
        const double took = juce::Time::highResolutionTicksToSeconds (juce::Time::getHighResolutionTicks() - t0), lasts = (double) n / sr;
        if (lasts <= 0.0) return;
        const double load = took / lasts;
        perfCalls.fetch_add (1); perfSum.store (perfSum.load() + load);
        if ((float) load > perfMax.load()) perfMax.store ((float) load);
        if (load > 1.0) perfOver.fetch_add (1);
    }

    /** Render up to `want` samples of every track into `mix`, stopping at the next thing on the line (a queued scene, the loop's end, the song's end, where a take begins). */
    int renderSome (int want, const float* const* in)
    {
        const double barS = barSamples();
        bool play = playing.load();
        const bool rec = recording.load();
        const double sk = seekTo.exchange (kNoSeek);
        if (sk > kNoSeek * 0.5) { posS = (juce::int64) std::llround (sk * barS); for (auto& tp : tracks) { tp->outHold.clear(); for (auto& sd : tp->sends) sd.hold.clear(); for (auto& i : tp->inserts) i->keyHold.clear(); tp->sideHold.clear(); } }      // (and nothing held back from before the jump comes out after it)
        if (play)
        {
            for (int guard = 0; guard < 3; ++guard)
            {
                const double posBar = (double) posS / barS, q = queued.load();
                juce::int64 edge = rec ? std::numeric_limits<juce::int64>::max() / 4 : (juce::int64) std::llround (songEnd * barS);
                int kind = 0; double to = 0.0;
                if (q < 0.0) lastQ = -1.0;
                if (rec) { if (posS < recStartS) edge = recStartS; kind = 3; }
                else if (q >= 0.0)
                {
                    if (q != lastQ) { lastQ = q; qEdge = (juce::int64) std::llround ((std::floor (posBar + 1.0e-6) + 1.0) * barS); }     // the bar line it was asked before, once
                    if (qEdge <= edge) { edge = qEdge; kind = 1; to = q; }
                }
                else if (loop.load())
                {
                    const double a = loopA.load(), b = loopB.load();
                    const juce::int64 bS = (juce::int64) std::llround (b * barS);
                    if (b - a > 1.0e-3 && posS <= bS) { edge = juce::jmin (edge, bS); kind = 2; to = a; }
                }
                if (posS < edge) { want = (int) juce::jmin ((juce::int64) want, edge - posS); break; }
                if (kind == 1)      { posS = (juce::int64) std::llround (to * barS); queued.store (-1.0); lastQ = -1.0; jumps.fetch_add (1); }
                else if (kind == 2) { posS = (juce::int64) std::llround (to * barS); jumps.fetch_add (1); }
                else if (kind == 3) { break; }
                else                { playing.store (false); play = false; posS = 0; jumps.fetch_add (1); break; }
            }
        }
        if (want <= 0) return 0;
        playHead.bpm.store (tempo.load()); playHead.ppq.store ((double) posS / barS * barQuarters()); playHead.playing.store (play); playHead.samples.store (posS);
        /*  What is played by hand in this stretch is written down as it comes, whether or not a take is running (a take of
            notes is read back from here, and so is what was played with nothing recording). The player pressed each key
            to the song as it was heard — a block and the way out to the speakers before the sample now being made.     */
        if (blockLive != nullptr && ! liveLog.empty())
            for (const auto meta : *blockLive)
            {
                const int at = meta.samplePosition - blockDone;
                if (at < 0 || at >= want || meta.numBytes < 2 || meta.numBytes > 3) continue;
                auto& p = liveLog[logN % liveLog.size()];
                p.songS = posS + at - blockN - outLat; p.runS = runS + at; p.seg = seg.load (std::memory_order_relaxed); p.rolling = play ? 1 : 0;
                p.st = meta.data[0]; p.d1 = meta.data[1] & 127; p.d2 = meta.numBytes > 2 ? (juce::uint8) (meta.data[2] & 127) : (juce::uint8) 0;
                ++logN;
            }
        runS += want;
        chunkPos = posS; chunkRolling = play;                          // (where this stretch lies in the song: a realtime print begins at its first sample)
        renderGraph (posS, want, play, false, in, rec ? 1.0e9 : songEnd, nullptr, blockLive, blockDone);

        // the click: on every beat while it is on, and through a count-in whether it is on or not
        float* ck = clk.getWritePointer (0);
        juce::FloatVectorOperations::clear (ck, want);
        if (play && (click.load() || (rec && posS < recStartS)))
        {
            const int perBar = juce::jmax (1, beats.load());
            const double beatS = barS / perBar;
            // (begun a beat early: a beat's place is a rounded sample, and one that was rounded up onto the first sample of
            //  this block — the first beat of a count-in at most tempos — lies a hair before posS when counted in beats)
            for (juce::int64 k = (juce::int64) std::floor ((double) posS / beatS) - 1;; ++k)
            {
                const juce::int64 at = (juce::int64) std::llround ((double) k * beatS);
                if (at >= posS + want) break;
                if (at >= posS) { clkAt = 0; clkAccent = ((k % perBar) + perBar) % perBar == 0; clkFrom = (int) (at - posS); clicksBegun.fetch_add (1); if (clkAccent) accentsBegun.fetch_add (1); }
            }
        }
        if (clkAt >= 0)
        {
            const float f = clkAccent ? 1760.0f : 1320.0f, w = juce::MathConstants<float>::twoPi * f / (float) sr, len = 0.045f * (float) sr;
            for (int i = juce::jmax (0, clkFrom); i < want; ++i)
            {
                if ((float) clkAt > len) { clkAt = -1; break; }
                const float e = 1.0f - (float) clkAt / len;
                ck[i] = std::sin (w * (float) clkAt) * e * e * (clkAccent ? 0.36f : 0.24f);
                ++clkAt;
            }
            clkFrom = 0;
        }

        // a take: what comes in goes to each armed track's file, from the bar the recording starts on
        if (play && rec && posS >= recStartS && ! takeBroken.load (std::memory_order_relaxed))
        {
            takeWriting.store (true, std::memory_order_relaxed);
            for (auto& r : recs)
            {
                const float* ch[2] = { silence.data(), silence.data() };
                if (in != nullptr) pickInput (in, r->input, ch[0], ch[1]);
                if (r->tw != nullptr && r->tw->write (ch, want)) r->got += want;
            }
        }

        if (play) posS += want;
        posBars.store ((double) posS / barS);
        return want;
    }
    /** The one or two inputs a track listens to. */
    static void pickInput (const float* const* in, int which, const float*& a, const float*& b)
    {
        if (which >= 100) { const int p = juce::jlimit (0, kMaxIn / 2 - 1, which - 100); a = in[2 * p]; b = in[2 * p + 1]; }
        else { a = b = in[juce::jlimit (0, kMaxIn - 1, which)]; }
    }

    static constexpr double kNoSeek = -1.0e9;
    static constexpr juce::int64 kSoundHead = 4096;       // a cached sound's samples begin this far into its file
    static constexpr int kMaxIn = 16;
    juce::AudioDeviceManager dm;
    juce::AudioPluginFormatManager fm;
    std::shared_ptr<std::atomic<bool>> here = std::make_shared<std::atomic<bool>> (true);      // false once the engine goes: an answer that comes late finds no one
    juce::AudioFormatManager afm;
    /** Audio thread, after each stretch the device has played: what a realtime print keeps of it — from the first sample
        of its range (once the song is rolling there) for as long as the range and its tail last. */
    void liveWrite (int got)
    {
        const int ph = livePhase.load (std::memory_order_relaxed);
        if (ph != 1 && ph != 2) return;
        if (ph == 1 && ! chunkRolling) return;
        /* each file from where its own track's sound for the range's start leaves the track (Track::early): the mix's
           from the range's start itself */
        juce::int64 least = liveTotal;
        for (auto& lo : lives)
        {
            if (lo->written == 0 && chunkPos + got <= lo->from) { least = 0; continue; }
            const int off = lo->written == 0 ? (int) juce::jlimit ((juce::int64) 0, (juce::int64) got, lo->from - chunkPos) : 0;
            const int n = (int) juce::jmin ((juce::int64) (got - off), liveTotal - lo->written);
            if (n > 0)
            {
                const float* ch[2] = { lo->buf.getReadPointer (0) + off, lo->buf.getReadPointer (1) + off };
                lo->tw->write (ch, n);
                lo->written += n;
                if (ph == 1) livePhase.store (2);
            }
            least = juce::jmin (least, lo->written);
        }
        liveWritten = least;
        if (liveWritten >= liveTotal) livePhase.store (3);
    }
    /** A realtime print ends: kept (its files made into what was asked for, on a thread of their own) or not (taken away). */
    void liveFinish (bool keep)
    {
        std::vector<std::unique_ptr<LiveOut>> outs;
        {
            const juce::ScopedLock sl (lock);
            for (auto& tp : tracks) tp->printLive = nullptr;
            liveMixOut = nullptr;
            outs.swap (lives);
            livePhase.store (0);
        }
        fineOn.store (false);
        playing.store (false);
        loop.store (liveLoopWas);
        auto done = std::move (liveDone); liveDone = nullptr;
        const auto opts = liveOpts; const auto dir = liveDir;
        const bool place = opts["kind"].toString() == "place";
        auto shared = std::make_shared<std::vector<std::unique_ptr<LiveOut>>> (std::move (outs));
        juce::Thread::launch ([this, shared, keep, done, opts, dir, place]
        {
            bool ok = keep; String why = keep ? String() : String ("stopped");
            juce::Array<juce::var> placed;
            int count = 0;
            for (auto& lo : *shared)
            {
                lo->tw.reset();                                                   // (what is still in its queue is written, and the file closed)
                if (keep && ok)
                {
                    juce::AudioFormatManager fm; fm.registerBasicFormats();
                    std::unique_ptr<juce::AudioFormatReader> rd (fm.createReaderFor (lo->tmp));
                    const auto outs = printOuts (opts, place, sr);           // every file asked for, each made from what was played
                    std::vector<std::unique_ptr<Sink>> sinks;
                    String err = rd == nullptr ? String ("the print would not read") : String();
                    for (size_t k = 0; k < outs.size() && err.isEmpty(); ++k)
                    {
                        const auto f = place ? lo->file : printFileOf (dir, lo->file.getFileNameWithoutExtension(), outs[k], opts["kind"].toString() == "mix");
                        f.getParentDirectory().createDirectory();
                        auto sk = std::make_unique<Sink>(); sk->stop = &leaving;
                        err = sk->open (f, outs[k].fmt, sr, outs[k].rate, outs[k].bits, lame, outs[k].kbps);
                        if (err.isNotEmpty()) sk->abandon(); else sinks.push_back (std::move (sk));
                    }
                    if (err.isNotEmpty()) { for (auto& sk : sinks) sk->abandon(); ok = false; why = err; }
                    else
                    {
                        juce::AudioBuffer<float> b (2, 1 << 15);
                        for (juce::int64 p = 0; p < rd->lengthInSamples && ! leaving.load(); p += b.getNumSamples())
                        {
                            const int n = (int) juce::jmin ((juce::int64) b.getNumSamples(), rd->lengthInSamples - p);
                            rd->read (&b, 0, n, p, true, true);
                            for (auto& sk : sinks) sk->write (b, n);
                        }
                        bool closed = true;
                        for (auto& sk : sinks) closed = sk->close() && closed;
                        if (! closed) { ok = false; why = "the file would not close"; }
                        else ++count;
                        if (place && ok)
                        {
                            auto v = decodeFile (lo->file);
                            if (auto* d = v.getDynamicObject()) { d->setProperty ("track", lo->t != nullptr ? lo->t->id : 0); d->setProperty ("file", lo->file.getFileName()); d->setProperty ("name", lo->file.getFileNameWithoutExtension()); }
                            placed.add (v);
                        }
                    }
                }
                lo->tmp.deleteFile();
            }
            const bool single = (int) opts["single"] != 0;
            if (! ok && ! place && ! single && dir.getNumberOfChildFiles (juce::File::findFilesAndDirectories) == 0) dir.deleteFile();
            logLine ("realtime print: " + String (keep ? "kept, " : "stopped, ") + String (count) + " files" + (why.isNotEmpty() && keep ? "  (" + why + ")" : String()));
            const auto shown = single ? printFileOf (dir, opts["name"].toString(), printOuts (opts, place, sr).front(), true) : dir;
            const bool show = ok && ! quiet && ! place;
            juce::MessageManager::callAsync ([done, ok, why, dir, count, placed, place, show, shown]
            {
                auto* o = new juce::DynamicObject();
                o->setProperty ("ok", ok); o->setProperty ("dir", dir.getFullPathName()); o->setProperty ("count", count); o->setProperty ("realtime", true);
                if (why.isNotEmpty()) o->setProperty ("error", why);
                if (place) o->setProperty ("placed", placed);
                if (show) shown.revealToUser();
                if (done) done (juce::var (o));
            });
        });
    }
    std::atomic<bool> printCancel { false };                       // an offline print is asked to stop (esc)
    std::atomic<bool> fineOn { false };                            // a realtime print is up: each track's peaks are kept finely (Track::fine…)
    std::vector<std::unique_ptr<LiveOut>> lives;                    // a realtime print's files (changed under the lock)
    LiveOut* liveMixOut = nullptr;                                 // … the one that is the mix (changed under the lock)
    std::atomic<int> livePhase { 0 };                              // 0 none, 1 waiting for its first sample, 2 writing, 3 done
    juce::int64 liveS0 = 0, liveTotal = 0;                         // where it begins, how much it writes (samples)
    std::atomic<juce::int64> liveWritten { 0 };
    juce::int64 chunkPos = 0; bool chunkRolling = false;           // audio thread: the stretch just played, and whether the song was rolling
    std::function<void (juce::var)> liveDone;
    juce::var liveOpts; juce::File liveDir; String liveFmt; bool liveLoopWas = false;
    juce::TimeSliceThread recThread { "takes" };
    juce::CriticalSection lock;
    std::vector<std::unique_ptr<Track>> tracks;
    std::vector<Track*> order;                 // every track after all that flows into it, rank by rank
    std::vector<size_t> rankEnds;              // where each rank ends in `order`
    Pool pool;
    int handsWanted = -1;
    std::atomic<int> shared { 0 };             // how many ranks were shared out among the threads (for the measure)
    static constexpr float kWorthSharing = 0.00012f;      // a rank is shared out when it has been taking longer than this alone (waking the others costs a few hundredths of a thousandth of a second)
    std::vector<std::shared_ptr<Buf>> bufs;
    std::map<String, int> bufIndex;
    std::vector<std::unique_ptr<Rec>> recs;
    double songEnd = 42.0;
    PlayHead playHead;
    juce::AudioBuffer<float> mix, clk;
    std::vector<float> testBuf, silence;
    float testPhase = 0.0f;
    juce::int64 posS = 0, recStartS = 0, qEdge = 0;
    /* the reference song (the page's reference row, his ask 2026-10-20): not a track — not in the mix, not through the
       stereo out's wall, its fader or the limiter. While it is the one chosen it is heard in the mix's place, at the song's
       place, from where its region begins; the two cross over in a fiftieth of a second (refX: how much of it is heard) */
    std::shared_ptr<Buf> refBuf;
    std::shared_ptr<const std::vector<RefPiece>> refPieces;         // (null: the file whole, from refStartBar)
    double refStartBar = 0.0;
    std::atomic<float> refVol { 1.0f };
    std::atomic<bool> refOn { false };
    float refX = 0.0f;
    juce::File takeNote;
    double lastQ = -1.0;
    int clkAt = -1, clkFrom = 0; bool clkAccent = false;
    int inLat = 0, outLat = 0;
    std::atomic<double> seekTo { kNoSeek };
    std::atomic<bool> rateOff { false };
    float limG = 1.0f, limRel = 0.0002f, masterSm = 1.0f;
    std::atomic<double> meterSq { 0.0 }; std::atomic<int> meterN { 0 }; std::atomic<float> meterPk { 0.0f }, meterL { 0.0f }, meterR { 0.0f }, inPeak { 0.0f };
    int nextUid = 0, latencyTick = 0, lastXruns = 0;
    std::atomic<int> nextFile { 0 };                           // (a print that lays its sound in the project numbers it from its own thread)
    std::vector<std::shared_ptr<Buf>> printBufs;               // the sounds as they were when the print that is running began (see renderGraph)
    std::atomic<bool> leaving { false };                       // the app is going
    std::thread printThread;                                   // the print under way, or the last one (message thread: startPrint, ~Engine)
    std::atomic<bool> printing { false };                      // its thread has not come to its end yet
    std::atomic<juce::int64> lastBlockTick { 0 };              // when the device last asked for a block (0: not looked at since a take began)
    std::atomic<bool> takeBroken { false };                    // the take that is running had a hole in it: nothing more of it is written
    std::atomic<bool> takeWriting { false };                   // the take that is running has had its first samples written (the count-in is over)
    const double tickSeconds = [] { mach_timebase_info_data_t tb {}; mach_timebase_info (&tb); return tb.denom != 0 ? (double) tb.numer / (double) tb.denom * 1.0e-9 : 1.0e-9; }();      // one tick of the clock that runs through sleep
    juce::CriticalSection printFileLock;                       // what a print is writing at this moment (its file, and the file an mp3 is made from): half-made, and taken away should the app have to go without the print
    juce::Array<juce::File> printFiles;                        // (an mp3's own wav among them)
public:
    std::atomic<bool> restOn { true };                         // tracks may rest (playTrack); the check turns it off to hear that nothing changes
private:
    juce::var printStates;                                     // every plug-in's state as it was when the print began (message thread)
    std::atomic<int> perfCalls { 0 }, perfOver { 0 }, perfHeld { 0 }, clicksBegun { 0 }, accentsBegun { 0 };
    //── the keys ──
    juce::MidiMessageCollector keys;                           // what keyboards (and the page) send, until the next block takes it
    std::unique_ptr<juce::MidiDeviceListConnection> keysWatch;
    juce::MidiBuffer liveBlock;                                // what was played by hand in the block now being made
    const juce::MidiBuffer* blockLive = nullptr;               // (that, or nothing when nothing was)
    int blockDone = 0, blockN = 0;                             // where in the device's block the stretch being made begins, and how long the block is
    std::vector<Played> liveLog;                               // what has been played by hand, the newest 32768 things; written by the device's thread, read under the lock
    size_t logN = 0, recLogFrom = 0;                           // how many things have been written in all; where the take that is running began
    juce::int64 runS = 0;                                      // every sample the device has asked for since the engine started
    std::vector<int> recNotes;                                 // the tracks of notes the take that is running is for
    std::atomic<int> seg { 0 }, keysSeen { 0 };
    std::atomic<double> perfSum { 0.0 };
    std::atomic<float> perfMax { 0.0f };
};

} // namespace daw
