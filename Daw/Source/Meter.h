#pragma once
#include <juce_gui_extra/juce_gui_extra.h>
#include <atomic>
#include <array>
#include <cmath>
#include <vector>

void slurStyleWindow (void* nsView);
void slurWindowOverRoom (void* nsView);

namespace daw
{
/*  The meter: a thing on a wall that changes nothing and measures what passes through it (draft: design/meter draft 1).
    The sound goes by as it came; what is kept is what the meter's face shows:
      the wave as it came    the highest and lowest of the two sides' middle in each hundredth of a second, for half a minute
      how loud               BS.1770 / EBU R128: momentary (0.4 s), short term (3 s), integrated (gated: nothing under -70,
                             nothing more than 10 under what is left), range (EBU 3342: of the short-term values, the
                             10th to the 95th hundredth, gated at -70 and 20 under), true peak (four times the rate)
      each side              rms over 0.3 s, the peak now and the highest since the count began, how often it ran over
      the stereo picture     the last pairs of samples (for lissajous and the polar pictures), correlation, balance, width
    take() is the audio thread's; everything else is the message thread's. What the face reads is kept in atomics and in
    rings that are only ever written by the audio thread (a picture drawn from a ring half written is one frame's flaw).  */
struct Meter
{
    static constexpr int kWave = 3000, kPairs = 1024, kBins = 2000;     // hundredths of a second kept; pairs kept; loudness in twentieths from -70 to +30

    void prepare (double rate)
    {
        sr = rate > 8000.0 ? rate : 48000.0;
        hop = (int) std::lround (sr * 0.1); cell = juce::jmax (1, (int) std::lround (sr * 0.01)); every = juce::jmax (1, (int) std::lround (sr / 6000.0));
        // the K weighting, for this rate (the two filters of BS.1770, made the way libebur128 makes them)
        {
            const double f0 = 1681.974450955533, G = 3.999843853973347, Q = 0.7071752369554196;
            const double K = std::tan (juce::MathConstants<double>::pi * f0 / sr), Vh = std::pow (10.0, G / 20.0), Vb = std::pow (Vh, 0.4996667741545416), a0 = 1.0 + K / Q + K * K;
            sh = { (Vh + Vb * K / Q + K * K) / a0, 2.0 * (K * K - Vh) / a0, (Vh - Vb * K / Q + K * K) / a0, 2.0 * (K * K - 1.0) / a0, (1.0 - K / Q + K * K) / a0 };
        }
        {
            const double f0 = 38.13547087602444, Q = 0.5003270373238773, K = std::tan (juce::MathConstants<double>::pi * f0 / sr), a0 = 1.0 + K / Q + K * K;
            hp = { 1.0, -2.0, 1.0, 2.0 * (K * K - 1.0) / a0, (1.0 - K / Q + K * K) / a0 };
        }
        // four times the rate: a windowed sinc, twelve taps to each of its four phases (the first is the sample itself)
        for (int ph = 0; ph < 4; ++ph) for (int k = 0; k < kTaps; ++k)
        {
            const double x = (double) (k - kTaps / 2 + 1) - ph / 4.0, w = 0.5 + 0.5 * std::cos (juce::MathConstants<double>::pi * x / (kTaps / 2.0 + 0.5));
            fir[ph][k] = (float) ((std::abs (x) < 1.0e-9 ? 1.0 : std::sin (juce::MathConstants<double>::pi * x) / (juce::MathConstants<double>::pi * x)) * juce::jmax (0.0, w));
        }
        for (int ph = 0; ph < 4; ++ph) { float sum = 0.0f; for (float v : fir[ph]) sum += v; if (std::abs (sum) > 1.0e-6f) for (float& v : fir[ph]) v /= sum; }      // (each phase adds up to one: a level sound stays level)
        aRms = (float) (1.0 - std::exp (-1.0 / (sr * 0.3))); aCor = (float) (1.0 - std::exp (-1.0 / (sr * 0.25))); aBal = (float) (1.0 - std::exp (-1.0 / (sr * 1.0)));
        fall = (float) std::pow (10.0, -20.0 / 20.0 / sr);                // the peak now falls twenty db a second
        waveLoud.fill (-120.0f);                                          // (nothing has been heard yet: no loudness to draw over the wave)
        clear();
    }

    /** While a print is made the sound that passes is not what is being listened to: nothing is counted then. */
    static inline std::atomic<bool> still { false };

    /** The count begins again: integrated, range, the held peaks, how often it ran over, the lowest correlation. */
    void reset() { again.store (true); }

    /** The audio thread: n samples of each side, as they pass. Nothing is changed. */
    void take (const float* L, const float* R, int n) noexcept
    {
        if (again.exchange (false)) clear();
        float pkL = peakNow[0].load (std::memory_order_relaxed), pkR = peakNow[1].load (std::memory_order_relaxed);
        float hdL = peakHeld[0].load (std::memory_order_relaxed), hdR = peakHeld[1].load (std::memory_order_relaxed), tp = truePeak.load (std::memory_order_relaxed);
        for (int i = 0; i < n; ++i)
        {
            const float l = L[i], r = R[i], al = std::abs (l), ar = std::abs (r);
            // each side
            pkL = al > pkL ? al : pkL * fall; pkR = ar > pkR ? ar : pkR * fall;
            if (al > hdL) hdL = al;
            if (ar > hdR) hdR = ar;
            const bool over = al >= 1.0f || ar >= 1.0f;
            if (over && ! wasOver) { ++oversN; cellOver = true; }
            wasOver = over;
            sLL += (l * l - sLL) * aRms; sRR += (r * r - sRR) * aRms;
            // four times the rate
            hist[0][hp_] = l; hist[1][hp_] = r;
            for (int c = 0; c < 2; ++c) for (int ph = 1; ph < 4; ++ph)
            {
                float acc = 0.0f; int at = hp_;
                for (int k = 0; k < kTaps; ++k) { acc += fir[ph][k] * hist[c][at]; at = at == 0 ? kTaps - 1 : at - 1; }
                if (std::abs (acc) > tp) tp = std::abs (acc);
            }
            if (al > tp) tp = al;
            if (ar > tp) tp = ar;
            hp_ = hp_ + 1 == kTaps ? 0 : hp_ + 1;
            // the stereo picture
            cLR += (l * r - cLR) * aCor; cLL += (l * l - cLL) * aCor; cRR += (r * r - cRR) * aCor;
            bLL += (l * l - bLL) * aBal; bRR += (r * r - bRR) * aBal;
            const float m = (l + r) * 0.5f, s = (l - r) * 0.5f;
            wMM += (m * m - wMM) * aBal; wSS += (s * s - wSS) * aBal;
            if (++everyN >= every) { everyN = 0; const int at = pairAt.load (std::memory_order_relaxed); pairs[(size_t) at * 2] = l; pairs[(size_t) at * 2 + 1] = r; pairAt.store ((at + 1) % kPairs, std::memory_order_relaxed); }
            // the wave as it came
            if (m > cellHi) cellHi = m;
            if (m < cellLo) cellLo = m;
            if (++cellN >= cell)
            {
                const int at = waveAt.load (std::memory_order_relaxed);
                waveHi[(size_t) at] = cellHi; waveLo[(size_t) at] = cellLo; waveLoud[(size_t) at] = shortNow; waveOver[(size_t) at] = cellOver ? 1 : 0;
                waveAt.store ((at + 1) % kWave, std::memory_order_relaxed);
                cellN = 0; cellHi = -2.0f; cellLo = 2.0f; cellOver = false;
            }
            // how loud: the two filters, and a tenth of a second's worth at a time
            double kl = l, kr = r;
            for (auto* f : { &sh, &hp })
            {
                auto& zl = f == &sh ? z[0] : z[2]; auto& zr = f == &sh ? z[1] : z[3];
                const double yl = (*f)[0] * kl + zl[0]; zl[0] = (*f)[1] * kl - (*f)[3] * yl + zl[1]; zl[1] = (*f)[2] * kl - (*f)[4] * yl; kl = yl;
                const double yr = (*f)[0] * kr + zr[0]; zr[0] = (*f)[1] * kr - (*f)[3] * yr + zr[1]; zr[1] = (*f)[2] * kr - (*f)[4] * yr; kr = yr;
            }
            hopSum += kl * kl + kr * kr;
            if (++hopN >= hop) tenth();
        }
        peakNow[0].store (pkL, std::memory_order_relaxed); peakNow[1].store (pkR, std::memory_order_relaxed);
        peakHeld[0].store (hdL, std::memory_order_relaxed); peakHeld[1].store (hdR, std::memory_order_relaxed); truePeak.store (tp, std::memory_order_relaxed);
        rms[0].store (std::sqrt (juce::jmax (0.0f, sLL)), std::memory_order_relaxed); rms[1].store (std::sqrt (juce::jmax (0.0f, sRR)), std::memory_order_relaxed);
        const float den = std::sqrt (cLL * cRR), cor = den > 1.0e-9f ? juce::jlimit (-1.0f, 1.0f, cLR / den) : 0.0f;
        correlation.store (cor, std::memory_order_relaxed);
        if (den > 1.0e-7f && cor < corLow.load (std::memory_order_relaxed)) corLow.store (cor, std::memory_order_relaxed);      // (only while something sounds: silence has no picture)
        balance.store (bLL > 1.0e-12f && bRR > 1.0e-12f ? 10.0f * std::log10 (bRR / bLL) : 0.0f, std::memory_order_relaxed);
        { const float a = std::sqrt (juce::jmax (0.0f, wMM)), b = std::sqrt (juce::jmax (0.0f, wSS)); width.store (a + b > 1.0e-7f ? b / (a + b) : 0.0f, std::memory_order_relaxed); }
        overs.store (oversN, std::memory_order_relaxed);
    }

    /** What the face shows now. `seconds`: how much of the wave. */
    juce::var read (double seconds) const
    {
        auto* o = new juce::DynamicObject();
        const auto db = [] (float v) { return v > 1.0e-6f ? 20.0 * std::log10 ((double) v) : -120.0; };
        o->setProperty ("m", (double) momentary.load()); o->setProperty ("s", (double) shortTerm.load()); o->setProperty ("i", (double) integrated.load());
        o->setProperty ("range", (double) range.load()); o->setProperty ("tp", db (truePeak.load())); o->setProperty ("sec", (double) tenths.load() / 10.0);
        o->setProperty ("peakL", db (peakNow[0].load())); o->setProperty ("peakR", db (peakNow[1].load()));
        o->setProperty ("heldL", db (peakHeld[0].load())); o->setProperty ("heldR", db (peakHeld[1].load()));
        o->setProperty ("rmsL", db (rms[0].load())); o->setProperty ("rmsR", db (rms[1].load())); o->setProperty ("over", overs.load());
        o->setProperty ("cor", (double) correlation.load()); o->setProperty ("corLow", (double) corLow.load()); o->setProperty ("bal", (double) balance.load()); o->setProperty ("width", (double) width.load());
        // the wave, the short-term loudness over it and where it ran over: a byte for each, as text (a number for each would be a long message twenty times a second)
        const int cells = juce::jlimit (50, kWave, (int) std::lround (seconds * 100.0)), w0 = waveAt.load();
        juce::MemoryBlock wave ((size_t) cells * 4), pr ((size_t) kPairs * 2);
        auto* wb = static_cast<juce::uint8*> (wave.getData());
        for (int k = 0; k < cells; ++k)
        {
            const size_t at = (size_t) ((w0 - cells + k) % kWave + kWave) % kWave;
            wb[k * 4]     = (juce::uint8) juce::jlimit (0, 255, (int) std::lround ((juce::jlimit (-1.0f, 1.0f, waveHi[at]) + 1.0f) * 127.5f));
            wb[k * 4 + 1] = (juce::uint8) juce::jlimit (0, 255, (int) std::lround ((juce::jlimit (-1.0f, 1.0f, waveLo[at]) + 1.0f) * 127.5f));
            wb[k * 4 + 2] = (juce::uint8) juce::jlimit (0, 255, (int) std::lround ((juce::jlimit (-63.75f, 0.0f, waveLoud[at]) + 63.75f) * 4.0f));      // (a quarter of a lu to a step, down to -63.75)
            wb[k * 4 + 3] = waveOver[at];
        }
        const int p0 = pairAt.load();
        auto* pb = static_cast<juce::uint8*> (pr.getData());
        for (int k = 0; k < kPairs; ++k)
        {
            const size_t at = (size_t) ((p0 + k) % kPairs);
            pb[k * 2]     = (juce::uint8) juce::jlimit (0, 255, (int) std::lround ((juce::jlimit (-1.0f, 1.0f, pairs[at * 2]) + 1.0f) * 127.5f));
            pb[k * 2 + 1] = (juce::uint8) juce::jlimit (0, 255, (int) std::lround ((juce::jlimit (-1.0f, 1.0f, pairs[at * 2 + 1]) + 1.0f) * 127.5f));
        }
        o->setProperty ("wave", juce::Base64::toBase64 (wave.getData(), wave.getSize())); o->setProperty ("pairs", juce::Base64::toBase64 (pr.getData(), pr.getSize()));
        return juce::var (o);
    }

    std::atomic<float> momentary { -120.0f }, shortTerm { -120.0f }, integrated { -120.0f }, range { 0.0f }, truePeak { 0.0f }, correlation { 0.0f }, corLow { 1.0f }, balance { 0.0f }, width { 0.0f };
    std::atomic<float> peakNow[2] { { 0.0f }, { 0.0f } }, peakHeld[2] { { 0.0f }, { 0.0f } }, rms[2] { { 0.0f }, { 0.0f } };
    std::atomic<int> overs { 0 }, tenths { 0 };

private:
    static constexpr int kTaps = 12;
    static double lufs (double meanSquare) { return meanSquare > 1.0e-12 ? -0.691 + 10.0 * std::log10 (meanSquare) : -120.0; }
    static int binOf (double l) { return juce::jlimit (0, kBins - 1, (int) std::floor ((l + 70.0) * 20.0)); }
    static double binMid (int b) { return std::pow (10.0, ((b + 0.5) / 20.0 - 70.0 + 0.691) / 10.0); }              // the mean square a bin stands for

    /** A tenth of a second is whole: momentary, short term, and what is counted since the count began. */
    void tenth() noexcept
    {
        hops[(size_t) hopAt] = hopSum / (double) hopN; hopAt = (hopAt + 1) % 30; if (hopsIn < 30) ++hopsIn;
        hopSum = 0.0; hopN = 0;
        const auto mean = [this] (int last) { double a = 0.0; const int n = juce::jmin (last, hopsIn); for (int k = 1; k <= n; ++k) a += hops[(size_t) ((hopAt - k + 30) % 30)]; return n > 0 ? a / n : 0.0; };
        const double m = lufs (mean (4)), s = lufs (mean (30));
        momentary.store ((float) m, std::memory_order_relaxed); shortTerm.store ((float) s, std::memory_order_relaxed); shortNow = (float) s;
        if (m > -70.0) tenths.fetch_add (1, std::memory_order_relaxed);        // (how long it has measured: the time something sounded)
        if (hopsIn >= 4 && m > -70.0) ++blocks[(size_t) binOf (m)];
        if (hopsIn >= 30 && s > -70.0) ++shorts[(size_t) binOf (s)];
        // integrated: of the blocks over -70, those no more than 10 under their mean
        {
            double sum = 0.0; juce::int64 cnt = 0;
            for (int b = 0; b < kBins; ++b) if (blocks[(size_t) b] > 0) { sum += binMid (b) * blocks[(size_t) b]; cnt += blocks[(size_t) b]; }
            if (cnt > 0)
            {
                const int gate = binOf (lufs (sum / (double) cnt) - 10.0);
                double s2 = 0.0; juce::int64 c2 = 0;
                for (int b = gate; b < kBins; ++b) if (blocks[(size_t) b] > 0) { s2 += binMid (b) * blocks[(size_t) b]; c2 += blocks[(size_t) b]; }
                integrated.store (c2 > 0 ? (float) lufs (s2 / (double) c2) : -120.0f, std::memory_order_relaxed);
            }
            else integrated.store (-120.0f, std::memory_order_relaxed);
        }
        // range: of the short-term values over -70 and no more than 20 under their mean, from the tenth to the ninety-fifth hundredth
        {
            double sum = 0.0; juce::int64 cnt = 0;
            for (int b = 0; b < kBins; ++b) if (shorts[(size_t) b] > 0) { sum += binMid (b) * shorts[(size_t) b]; cnt += shorts[(size_t) b]; }
            float lra = 0.0f;
            if (cnt > 0)
            {
                const int gate = binOf (lufs (sum / (double) cnt) - 20.0);
                juce::int64 kept = 0; for (int b = gate; b < kBins; ++b) kept += shorts[(size_t) b];
                if (kept > 1)
                {
                    const juce::int64 lowAt = (juce::int64) std::llround ((double) (kept - 1) * 0.10), highAt = (juce::int64) std::llround ((double) (kept - 1) * 0.95);
                    juce::int64 seen = 0; int lo = -1, hi = -1;
                    for (int b = gate; b < kBins && hi < 0; ++b) { seen += shorts[(size_t) b]; if (lo < 0 && seen > lowAt) lo = b; if (seen > highAt) hi = b; }
                    if (lo >= 0 && hi >= lo) lra = (float) (hi - lo) / 20.0f;
                }
            }
            range.store (lra, std::memory_order_relaxed);
        }
    }

    void clear() noexcept
    {
        for (auto& b : blocks) b = 0;
        for (auto& b : shorts) b = 0;
        for (auto& h : hops) h = 0.0;
        hopAt = 0; hopsIn = 0; hopSum = 0.0; hopN = 0; oversN = 0; wasOver = false; shortNow = -120.0f;
        for (auto& f : z) f = { 0.0, 0.0 };
        momentary.store (-120.0f); shortTerm.store (-120.0f); integrated.store (-120.0f); range.store (0.0f); truePeak.store (0.0f); corLow.store (1.0f);
        peakHeld[0].store (0.0f); peakHeld[1].store (0.0f); overs.store (0); tenths.store (0);
    }

    double sr = 48000.0;
    int hop = 4800, cell = 480, every = 8;
    std::array<double, 5> sh {}, hp {};
    std::array<std::array<double, 2>, 4> z {};                            // the shelf's and the high pass's memory, for each side
    float fir[4][kTaps] {}, hist[2][kTaps] {};
    int hp_ = 0;
    float aRms = 0.0f, aCor = 0.0f, aBal = 0.0f, fall = 1.0f;
    float sLL = 0.0f, sRR = 0.0f, cLR = 0.0f, cLL = 0.0f, cRR = 0.0f, bLL = 0.0f, bRR = 0.0f, wMM = 0.0f, wSS = 0.0f;
    bool wasOver = false, cellOver = false;
    int oversN = 0, everyN = 0, cellN = 0, hopN = 0, hopAt = 0, hopsIn = 0;
    float cellHi = -2.0f, cellLo = 2.0f, shortNow = -120.0f;
    double hopSum = 0.0;
    std::array<double, 30> hops {};
    std::array<juce::uint32, kBins> blocks {}, shorts {};
    std::array<float, kWave> waveHi {}, waveLo {}, waveLoud {};
    std::array<juce::uint8, kWave> waveOver {};
    std::array<float, kPairs * 2> pairs {};
    std::atomic<int> waveAt { 0 }, pairAt { 0 };
    std::atomic<bool> again { false };
};
} // namespace daw

/*  The meter's face: a window of its own that stays over the room, like a plug-in's. It is a page of the room's
    (ui/meter.html), which asks the app through the same one function the room does (meterRead, meterReset).  */
class MeterWindow final : public juce::DocumentWindow
{
public:
    using Done = juce::WebBrowserComponent::NativeFunctionCompletion;
    using Ask = std::function<void (const juce::String&, const juce::var&, Done)>;
    using Serve = std::function<std::optional<juce::WebBrowserComponent::Resource> (const juce::String&)>;

    MeterWindow (Serve serve, Ask ask, const juce::String& query, const juce::String& lang, bool overRoom)
        : DocumentWindow ("meter", juce::Colour (0xff151514), DocumentWindow::closeButton)
    {
        setUsingNativeTitleBar (true);
        web = std::make_unique<juce::WebBrowserComponent> (
            juce::WebBrowserComponent::Options{}
                .withNativeIntegrationEnabled()
                .withUserScript ("window.__LANG = '" + lang + "';")
                .withResourceProvider ([serve] (const juce::String& path) { return serve (path); })
                .withNativeFunction ("daw", [ask] (const juce::Array<juce::var>& args, Done done)
                {
                    ask (args.size() > 0 ? args[0].toString() : juce::String(), args.size() > 1 ? args[1] : juce::var(), std::move (done));
                }));
        web->setSize (kWidth, kHeight);
        setContentNonOwned (web.get(), true);
        setResizable (true, false);
        setResizeLimits (280, 300, 1600, 1100);
        centreWithSize (getWidth(), getHeight());
        setVisible (true);
        if (auto* p = getPeer()) { slurStyleWindow (p->getNativeHandle()); if (overRoom) slurWindowOverRoom (p->getNativeHandle()); }      // (the check runs behind other apps, where a window that goes with the app would not be there to look at)
        toFront (true);
        web->goToURL (juce::WebBrowserComponent::getResourceProviderRoot() + "meter.html?" + query);
    }
    ~MeterWindow() override { clearContentComponent(); }
    void closeButtonPressed() override { setVisible (false); if (onClose) onClose(); }
    juce::WebBrowserComponent& page() { return *web; }
    std::function<void()> onClose;

    static constexpr int kWidth = 900, kHeight = 488;                  // the draft's face a
private:
    std::unique_ptr<juce::WebBrowserComponent> web;
};
