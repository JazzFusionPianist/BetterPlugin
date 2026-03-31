#pragma once
#include <JuceHeader.h>
#include <complex>
#include <array>
#include <deque>

//==============================================================================
// K-weighting biquad filter for BS.1770-4 LUFS measurement
class KWeightingFilter
{
public:
    KWeightingFilter() { reset(); }

    void prepare(double sampleRate);
    void reset();
    float processSample(float x);

private:
    double b0_1, b1_1, b2_1, a1_1, a2_1;
    double b0_2, b1_2, b2_2, a1_2, a2_2;

    double x1_1, x2_1, y1_1, y2_1;
    double x1_2, x2_2, y1_2, y2_2;

    void calculateCoefficients(double sampleRate);
};

//==============================================================================
// Full metering engine - runs on audio thread, results polled by UI at 30fps
class MeteringEngine
{
public:
    MeteringEngine();
    ~MeteringEngine();

    void prepare(double sampleRate, int blockSize);
    void reset();

    // Called from audio thread with stereo buffer
    void processBlock(const juce::AudioBuffer<float>& buffer);

    //--- LUFS outputs ---
    std::atomic<float> lufsIntegrated   { -144.0f };
    std::atomic<float> lufsShortTerm    { -144.0f };
    std::atomic<float> lfusMomentary    { -144.0f };

    //--- True Peak outputs ---
    std::atomic<float> truePeakL  { -144.0f };
    std::atomic<float> truePeakR  { -144.0f };
    std::atomic<float> peakHoldL  { -144.0f };
    std::atomic<float> peakHoldR  { -144.0f };
    std::atomic<bool>  clipL      { false };
    std::atomic<bool>  clipR      { false };

    //--- FFT output ---
    static constexpr int fftOrder  = 11;          // 2^11 = 2048 (smaller for no-DSP)
    static constexpr int fftSize   = 1 << fftOrder;
    static constexpr int fftOutputSize = fftSize / 2 + 1;
    std::array<std::atomic<float>, fftOutputSize> fftMagnitudes;

    //--- Goniometer output ---
    static constexpr int goniometerBufferSize = 2048;
    struct SamplePair { float mid, side; };
    std::array<SamplePair, goniometerBufferSize> goniometerBuffer;
    std::atomic<int>   goniometerWritePos { 0 };
    std::atomic<float> correlation        { 0.0f };

    void resetIntegrated();

private:
    double currentSampleRate = 48000.0;
    int    currentBlockSize  = 512;

    //--- K-weighting filters ---
    KWeightingFilter kFilterL, kFilterR;

    //--- LUFS gating ---
    struct LufsBlock { double msL, msR; };

    int msStepSamples = 4800;  // 100ms
    double msAccumL = 0.0, msAccumR = 0.0;
    int msAccumCount = 0;

    std::deque<LufsBlock> momentaryWindow;  // last 4 blocks (400ms)
    std::deque<LufsBlock> shortTermWindow;  // last 30 blocks (3s)
    std::deque<LufsBlock> integratedBlocks;
    double integratedSumL = 0.0, integratedSumR = 0.0;
    int integratedCount = 0;

    void pushLufsBlock(double msL, double msR);
    double computeLoudness(double msL, double msR) const;
    double computeWindowLoudness(const std::deque<LufsBlock>& window) const;
    void computeIntegratedLUFS();

    //--- True Peak (simple 4x linear interpolation) ---
    void processTruePeak(const juce::AudioBuffer<float>& buffer);

    //--- FFT (Cooley-Tukey radix-2 DIT) ---
    std::vector<float> fftWindow;
    std::vector<std::complex<float>> fftWorkspace;
    std::vector<float> fftFifo;
    int fftFifoPos = 0;
    std::array<float, fftOutputSize> fftPeakHold;

    static void performFFT(std::vector<std::complex<float>>& data);
    void updateFFT(const juce::AudioBuffer<float>& buffer);

    //--- Goniometer correlation ---
    std::vector<std::pair<float,float>> corrBuffer;
    int corrPos = 0;
    int corrCapacity = 0;
    void updateGoniometer(const juce::AudioBuffer<float>& buffer);

    JUCE_DECLARE_NON_COPYABLE_WITH_LEAK_DETECTOR(MeteringEngine)
};
