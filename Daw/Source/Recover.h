#pragma once
#include <juce_core/juce_core.h>
#include <atomic>
#include <csignal>
#include <fcntl.h>
#include <thread>
#include <pthread.h>
#include <unistd.h>

/*  What the app leaves behind for its own next start, in case this one ends badly.

    running.json — written when the app starts and taken away when it ends by itself. Still there at the next start, it
    says the last run stopped on its own (a crash, a forced quit, the power): which project was open, what was just
    being done that could have been the cause (a plug-in being opened), and which plug-in had which number.

    crash.note — written by the signal handler at the very moment of a crash, with the one thing that may be done
    there (a write to a file opened long before): which thread it happened on, and which plug-in each thread was
    inside. So the next start can name the plug-in that was running when the app went down, and leave it out —
    the app dies once of a bad plug-in, not every time the project is opened.

    A take that was being recorded is covered by the engine (its file is made whole on disk every second, and a
    note of what was being recorded lies beside it); the song itself by the page, which saves every few seconds.  */

namespace daw
{
struct NowPlaying { std::atomic<juce::uint64> thread { 0 }; std::atomic<int> uid { 0 }; std::atomic<juce::uint32> calls { 0 }; };      // (calls: how many times this thread has gone into a plug-in — one that stands still while uid is set has not come back)
inline NowPlaying nowPlaying[32];
inline int crashFd = -1;
inline bool crashQuietly = false;                 // the check: end at once, without the system's own report of a crash coming up on the screen
inline std::atomic<int> crashOnUid { 0 };         // the check: the plug-in with this number brings the app down the next time it is played
inline std::atomic<int> hangOnUid { 0 };          // the check: the plug-in with this number never comes back the next time a print plays it
inline std::atomic<bool> hangLive { false };      // the check: … nor the next time the device plays it
inline std::atomic<bool> watching { false };      // the thread that looks for plug-ins that do not come back is at work (see watch)
inline pthread_mutex_t noteLock = PTHREAD_MUTEX_INITIALIZER;      // whoever writes the note outside a signal, or closes its file, has this (a plain one, never taken down: the watcher may still want it while the app's own things go, at the very end)
struct NoteGuard { NoteGuard() noexcept { pthread_mutex_lock (&noteLock); } ~NoteGuard() noexcept { pthread_mutex_unlock (&noteLock); } };

/*  Each thread that ever plays a plug-in has one place in nowPlaying: taken the first time it does, and given back when
    the thread ends (the hands are new threads every time the device, or their number, changes — places never given back
    would run out, and from then on a crash could not be laid at any plug-in's door). Which place a thread has is kept
    in a pthread key's own value — 0 not asked yet, 1…32 a place, 33 none was free — and the giving back hangs on the
    key: neither allocates anything, which a thread-local's first use on a thread does, and this is first met on the
    device's own thread in the middle of a block. */
inline pthread_key_t placeKey;
inline pthread_once_t placeOnce = PTHREAD_ONCE_INIT;
inline void placeFree (void* v) noexcept
{
    const auto i = (int) (intptr_t) v - 1;
    if (i >= 0 && i < 32) { nowPlaying[i].uid.store (0); nowPlaying[i].thread.store (0); }
}
inline int placeOfThisThread() noexcept
{
    pthread_once (&placeOnce, [] { pthread_key_create (&placeKey, &placeFree); });
    if (const auto had = (int) (intptr_t) pthread_getspecific (placeKey)) return had <= 32 ? had - 1 : -1;
    const auto me = (juce::uint64) (size_t) pthread_self();
    for (int i = 0; i < 32; ++i)
    {
        juce::uint64 none = 0;
        if (nowPlaying[i].thread.compare_exchange_strong (none, me)) { nowPlaying[i].uid.store (0); pthread_setspecific (placeKey, (void*) (intptr_t) (i + 1)); return i; }
    }
    pthread_setspecific (placeKey, (void*) (intptr_t) 33);      // every place is some living thread's: this one goes without (and does not look again)
    return -1;
}

/** While one of these lives, the calling thread is inside the plug-in `uid`. */
struct Inside
{
    explicit Inside (int uid) noexcept : slot (placeOfThisThread())
    {
        if (slot >= 0) { nowPlaying[slot].calls.fetch_add (1, std::memory_order_relaxed); nowPlaying[slot].uid.store (uid, std::memory_order_relaxed); }
    }
    ~Inside() noexcept { if (slot >= 0) nowPlaying[slot].uid.store (0, std::memory_order_relaxed); }
    int slot = -1;
};

struct CrashNote { juce::uint64 mark = 0, thread = 0; juce::uint64 threads[32] {}; juce::int32 uids[32] {}; juce::int32 sig = 0, pad = 0; };
static constexpr juce::uint64 kCrashMark = 0x736c7572637261ull;

inline void crashHandler (int sig)
{
    CrashNote n;
    n.mark = kCrashMark; n.thread = (juce::uint64) (size_t) pthread_self(); n.sig = sig;
    for (int i = 0; i < 32; ++i) { n.threads[i] = nowPlaying[i].thread.load (std::memory_order_relaxed); n.uids[i] = nowPlaying[i].uid.load (std::memory_order_relaxed); }
    if (crashFd >= 0) { const auto w = ::pwrite (crashFd, &n, sizeof (n), 0); (void) w; ::fsync (crashFd); }      // (at the file's beginning: over a note of something that only stood still, should one be there)
    if (crashQuietly) ::_exit (70);
    ::signal (sig, SIG_DFL);                      // back to the system's own way: what failed is tried again, and this time the app ends with the usual report
}

/** A thread will not come back from a plug-in, and the app is going without it: the note a crash leaves, written by hand,
    so that the next start reads it the same way. The thread that is named is the one given if it is inside a plug-in —
    otherwise the one that is (the one given may only be waiting for a hand that is stuck in one). */
inline void stuckNote (juce::uint64 thread) noexcept
{
    CrashNote n;
    n.mark = kCrashMark; n.thread = thread; n.sig = 0;
    bool inside = false;
    for (int i = 0; i < 32; ++i) { n.threads[i] = nowPlaying[i].thread.load (std::memory_order_relaxed); n.uids[i] = nowPlaying[i].uid.load (std::memory_order_relaxed); if (n.threads[i] == thread && n.uids[i] != 0) inside = true; }
    if (! inside) for (int i = 0; i < 32; ++i) if (n.uids[i] != 0) { n.thread = n.threads[i]; break; }
    const NoteGuard g;
    if (crashFd >= 0) { const auto w = ::pwrite (crashFd, &n, sizeof (n), 0); (void) w; ::fsync (crashFd); }
}

/*  A plug-in that never comes back takes no signal with it: the app stands still, is put down by hand, and nothing would
    say why. So a thread of its own looks once a second at where every thread is. One that has been inside the same call
    of a plug-in for eight seconds is written down as a crash would be (sig -1) — and the note is taken away again if
    the call returns after all: a plug-in reading a great deal from the disk, or asking something in a window of its own. */
static constexpr int kHeldSeconds = 8;
inline void watch() noexcept
{
    juce::uint32 seen[32] {};
    int same[32] {};
    int noted = -1;                                   // the place the note on the disk names (-1: there is none)
    while (watching.load())
    {
        ::usleep (1000000);
        int held = -1;
        for (int i = 0; i < 32; ++i)
        {
            const auto uid = nowPlaying[i].uid.load (std::memory_order_relaxed);
            const auto calls = nowPlaying[i].calls.load (std::memory_order_relaxed);
            if (uid != 0 && calls == seen[i]) { if (same[i] < kHeldSeconds) ++same[i]; if (same[i] >= kHeldSeconds && held < 0) held = i; }
            else same[i] = 0;
            seen[i] = calls;
        }
        if (held == noted) continue;                  // (as it was: the same one still, or still none — another one, and the note is written anew for it)
        const NoteGuard g;
        if (! watching.load() || crashFd < 0) break;
        if (held >= 0)
        {
            CrashNote n;
            n.mark = kCrashMark; n.thread = nowPlaying[held].thread.load (std::memory_order_relaxed); n.sig = -1;
            for (int i = 0; i < 32; ++i) { n.threads[i] = nowPlaying[i].thread.load (std::memory_order_relaxed); n.uids[i] = nowPlaying[i].uid.load (std::memory_order_relaxed); }
            const auto w = ::pwrite (crashFd, &n, sizeof (n), 0); (void) w; ::fsync (crashFd);
        }
        else { const auto t = ::ftruncate (crashFd, 0); (void) t; }
        noted = held;
    }
}

class Marker
{
public:
    /** Call once, first thing. Returns what the run before left behind — nothing when it ended by itself — and sets this run's own mark. */
    static juce::var begin (const juce::File& dirIn, bool quietly)
    {
        dir() = dirIn; crashQuietly = quietly;
        dir().createDirectory();
        const auto mark = dir().getChildFile ("running.json"), note = dir().getChildFile ("crash.note");
        juce::var last;
        if (mark.existsAsFile())
        {
            last = juce::JSON::parse (mark);
            if (! last.isObject()) last = juce::var (new juce::DynamicObject());
            auto* o = last.getDynamicObject();
            o->setProperty ("ended", mark.getLastModificationTime().toMilliseconds());
            juce::MemoryBlock mb;
            if (note.loadFileAsData (mb) && mb.getSize() >= sizeof (CrashNote))
            {
                CrashNote n;
                std::memcpy (&n, mb.getData(), sizeof (n));
                if (n.mark == kCrashMark)
                {
                    if (n.sig == -1) o->setProperty ("held", true);      // (not a crash: a thread had stood inside a plug-in for a long while when the app was put down — see watch)
                    else o->setProperty ("crashed", true);
                    if (n.sig == 0) o->setProperty ("stuck", true);      // (nor this: the app went by itself, leaving a thread that would not come back — see stuckNote)
                    juce::Array<juce::var> others;
                    for (int i = 0; i < 32; ++i)
                    {
                        if (n.uids[i] == 0) continue;
                        const auto who = last["plugins"][juce::Identifier ("u" + juce::String (n.uids[i]))];
                        if (! who.isObject()) continue;
                        if (n.threads[i] == n.thread) o->setProperty ("inside", who); else others.add (who);
                    }
                    if (! others.isEmpty()) o->setProperty ("alsoPlaying", others);
                }
            }
        }
        note.deleteFile();
        now() = juce::var (new juce::DynamicObject());
        now().getDynamicObject()->setProperty ("started", juce::Time::currentTimeMillis());
        now().getDynamicObject()->setProperty ("plugins", juce::var (new juce::DynamicObject()));
        write();
        crashFd = ::open (note.getFullPathName().toRawUTF8(), O_WRONLY | O_CREAT | O_TRUNC | O_CLOEXEC, 0644);      // (not handed on to an encoder started from here)
        {
            /*  The note is written on a stack of its own: a plug-in that runs its thread's stack out leaves none to write
                it on. (A thread other than this one has no such stack unless it is given one — a hand that overflows
                still goes down without a note; the main thread, where plug-ins are opened and shown, is covered.)       */
            static char altStack[64 * 1024];
            stack_t ss {};
            ss.ss_sp = altStack; ss.ss_size = sizeof (altStack);
            ::sigaltstack (&ss, nullptr);
        }
        for (int sig : { SIGSEGV, SIGBUS, SIGILL, SIGFPE, SIGABRT, SIGTRAP })
        {
            struct sigaction sa {};
            sa.sa_handler = &crashHandler;
            sa.sa_flags = SA_ONSTACK;
            sigemptyset (&sa.sa_mask);
            ::sigaction (sig, &sa, nullptr);
        }
        if (crashFd >= 0 && ! watching.exchange (true)) { try { std::thread (watch).detach(); } catch (...) { watching.store (false); } }
        return last;
    }
    /** The app is ending by itself: nothing is left behind. */
    static void end()
    {
        if (dir() == juce::File()) return;
        dir().getChildFile ("running.json").deleteFile();
        watching.store (false);
        { const NoteGuard g; if (crashFd >= 0) { ::close (crashFd); crashFd = -1; } }
        dir().getChildFile ("crash.note").deleteFile();
    }
    static void set (const juce::Identifier& key, const juce::var& value)
    {
        if (auto* o = now().getDynamicObject()) { if (o->getProperty (key) == value) return; o->setProperty (key, value); write(); }
    }
    static void clear (const juce::Identifier& key) { if (auto* o = now().getDynamicObject()) if (o->hasProperty (key)) { o->removeProperty (key); write(); } }
    /** A plug-in has been given a number: which one it is. */
    static void plugin (int uid, const juce::String& ident, const juce::String& name)
    {
        auto* who = new juce::DynamicObject();
        who->setProperty ("id", ident); who->setProperty ("name", name);
        if (auto* all = now()["plugins"].getDynamicObject()) { all->setProperty (juce::Identifier ("u" + juce::String (uid)), juce::var (who)); write(); }
    }
    static juce::File folder() { return dir(); }

private:
    static juce::File& dir() { static juce::File d; return d; }
    static juce::var& now() { static juce::var v; return v; }
    static void write() { if (dir() != juce::File()) dir().getChildFile ("running.json").replaceWithText (juce::JSON::toString (now(), true)); }
};
} // namespace daw
