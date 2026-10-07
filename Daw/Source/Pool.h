#pragma once
#include <juce_audio_devices/juce_audio_devices.h>
#include <atomic>
#include <memory>
#include <vector>
#include <dispatch/dispatch.h>

/*  The engine's other hands.

    A few threads that take tracks off the list when a block holds more work than one core should carry. Whoever
    plays the block (the device's own thread, or a print's) calls run(): it takes pieces itself as well, and comes
    back when every piece is done.

    Nothing is allocated, and no lock is taken, while a block is worked. The pieces are claimed by number through one
    atomic word that also says which round they belong to (round | how many | the next one), so a hand that wakes
    late can never take a piece of another round: the word it read is gone, and its claim fails.

    The hands run at the device's own priority and in its workgroup — the set of threads the system knows must be
    done by the same moment — so on a Mac with fast and slow cores they are kept on the fast ones together with the
    device's thread.                                                                                               */

namespace daw
{
class Pool
{
public:
    using Fn = void (*) (void* context, int index);

    Pool() : sem (dispatch_semaphore_create (0)) {}
    ~Pool() { stop(); }

    /** Message thread. `count` threads besides the caller (0: run() does everything itself). */
    void start (int count, const juce::AudioWorkgroup& group, int blockSamples, double sampleRate)
    {
        stop();
        setGroup (group);
        quitting.store (false);
        for (int i = 0; i < count; ++i)
        {
            auto h = std::make_unique<Hand> (*this);
            /*  The system gives a realtime thread no more than fifty thousandths of a second of work in one go; a long
                block (4096 samples) lasts longer than that, and asking for all of it is refused outright — the hands
                would then be ordinary threads for as long as the app runs. So: at most 49 ms of work, within a block.    */
            const double ms = (double) juce::jmax (16, blockSamples) * 1000.0 / juce::jmax (8000.0, sampleRate);
            if (! h->startRealtimeThread (juce::Thread::RealtimeOptions{}.withProcessingTimeMs (juce::jmin (49.0, ms)).withMaximumProcessingTimeMs (ms)))
            {
                /*  The system would not give it the device's priority. JUCE leaves such a thread looking as if it still
                    ran (its handle is never cleared, though the thread has ended): it can neither be started again nor
                    be let go — letting go waits for it for ever. So it is set aside for good, and a new one is started
                    the ordinary way; if that will not start either, there is one hand fewer.                            */
                (void) h.release();
                h = std::make_unique<Hand> (*this);
                if (! h->startThread (juce::Thread::Priority::highest)) continue;
            }
            hands.push_back (std::move (h));
        }
    }
    void stop()
    {
        if (hands.empty()) return;
        quitting.store (true);
        for (size_t i = 0; i < hands.size(); ++i) dispatch_semaphore_signal (sem);
        for (auto& h : hands) h->stopThread (4000);
        hands.clear();
    }
    /** The device has another workgroup (it was started again, or another device was chosen): the hands move over, each when it next wakes. */
    void setGroup (const juce::AudioWorkgroup& g)
    {
        const juce::SpinLock::ScopedLockType sl (groupLock);
        group = g;
        groupNo.fetch_add (1);
    }
    int size() const noexcept { return (int) hands.size(); }

    /** fn (context, i) for every i in [0, count), on this thread and the others; back when all of it is done. */
    void run (Fn fn, void* context, int count) noexcept
    {
        if (count <= 0) return;
        if (hands.empty() || count == 1 || count > 0xffff) { for (int i = 0; i < count; ++i) fn (context, i); return; }
        job = fn; ctx = context;
        done.store (0, std::memory_order_relaxed);
        const juce::uint64 round = ((word.load (std::memory_order_relaxed) >> 32) + 1) & 0xffffffffu;
        word.store ((round << 32) | ((juce::uint64) juce::jmin (count, 0xffff) << 16), std::memory_order_release);
        const int wake = juce::jmin ((int) hands.size(), count - 1);
        for (int i = 0; i < wake; ++i) dispatch_semaphore_signal (sem);
        work();
        while (done.load (std::memory_order_acquire) < count) relax();
    }

private:
    struct Hand final : juce::Thread
    {
        explicit Hand (Pool& p) : juce::Thread ("slur daw hand"), pool (p) {}
        void run() override
        {
            juce::ScopedNoDenormals noDenormals;
            juce::WorkgroupToken token;
            juce::uint32 joined = 0;
            for (;;)
            {
                dispatch_semaphore_wait (pool.sem, DISPATCH_TIME_FOREVER);
                if (pool.quitting.load() || threadShouldExit()) break;
                if (const auto now = pool.groupNo.load(); now != joined)
                {
                    juce::AudioWorkgroup g;
                    { const juce::SpinLock::ScopedLockType sl (pool.groupLock); g = pool.group; }
                    g.join (token);
                    joined = now;
                }
                pool.work();
            }
        }
        Pool& pool;
    };

    void work() noexcept
    {
        for (;;)
        {
            juce::uint64 w = word.load (std::memory_order_acquire);
            const int next = (int) (w & 0xffff), count = (int) ((w >> 16) & 0xffff);
            if (next >= count) return;
            if (! word.compare_exchange_weak (w, w + 1, std::memory_order_acq_rel)) continue;
            job (ctx, next);
            done.fetch_add (1, std::memory_order_release);
        }
    }
    static void relax() noexcept
    {
       #if defined (__aarch64__)
        __asm__ __volatile__ ("yield");
       #elif defined (__x86_64__)
        __builtin_ia32_pause();
       #endif
    }

    dispatch_semaphore_t sem;
    std::vector<std::unique_ptr<Hand>> hands;
    std::atomic<bool> quitting { false };
    std::atomic<juce::uint64> word { 0 };
    std::atomic<int> done { 0 };
    Fn job = nullptr;
    void* ctx = nullptr;
    juce::SpinLock groupLock;
    juce::AudioWorkgroup group;
    std::atomic<juce::uint32> groupNo { 1 };
};
} // namespace daw
