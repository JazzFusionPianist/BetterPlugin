#include "MeteringEngine.h"
#include <cmath>
#include <complex>

//==============================================================================
// KWeightingFilter

void KWeightingFilter::reset()
{
    x1_1 = x2_1 = y1_1 = y2_1 = 0.0;
    x1_2 = x2_2 = y1_2 = y2_2 = 0.0;
}

void KWeightingFilter::prepare(double sampleRate)
{
    reset();
    calculateCoefficients(sampleRate);
}

void KWeightingFilter::calculateCoefficients(double sampleRate)
{
    if (std::abs(sampleRate - 48000.0) < 1.0)
    {
        b0_1 =  1.53512485958697;
        b1_1 = -2.69169618940638;
        b2_1 =  1.19839281085285;
        a1_1 = -1.69065929318241;
        a2_1 =  0.73248077421585;

        b0_2 =  1.0;
        b1_2 = -2.0;
        b2_2 =  1.0;
        a1_2 = -1.99004745483398;
        a2_2 =  0.99007225036621;
    }
    else
    {
        // Stage 1: High-shelf pre-filter
        double Fc1 = 1681.974450955533;
        double G1  = 3.99984385397;
        double Q1  = 0.7071752369554193;
        double K   = std::tan(juce::MathConstants<double>::pi * Fc1 / sampleRate);
        double Vh  = std::pow(10.0, G1 / 20.0);
        double Vb  = std::pow(Vh, 0.4996667741545416);
        double a0i = 1.0 / (1.0 + K / Q1 + K * K);

        b0_1 = (Vh + Vb * K / Q1 + K * K) * a0i;
        b1_1 = 2.0 * (K * K - Vh) * a0i;
        b2_1 = (Vh - Vb * K / Q1 + K * K) * a0i;
        a1_1 = 2.0 * (K * K - 1.0) * a0i;
        a2_1 = (1.0 - K / Q1 + K * K) * a0i;

        // Stage 2: High-pass RLB
        double Fc2  = 38.13547087613982;
        double Q2   = 0.5003270373238773;
        double K2   = std::tan(juce::MathConstants<double>::pi * Fc2 / sampleRate);
        double a02i = 1.0 / (1.0 + K2 / Q2 + K2 * K2);

        b0_2 = 1.0 * a02i;
        b1_2 = -2.0 * a02i;
        b2_2 = 1.0 * a02i;
        a1_2 = 2.0 * (K2 * K2 - 1.0) * a02i;
        a2_2 = (1.0 - K2 / Q2 + K2 * K2) * a02i;
    }
}

float KWeightingFilter::processSample(float x)
{
    double in1 = (double)x;
    double out1 = b0_1 * in1 + b1_1 * x1_1 + b2_1 * x2_1 - a1_1 * y1_1 - a2_1 * y2_1;
    x2_1 = x1_1; x1_1 = in1;
    y2_1 = y1_1; y1_1 = out1;

    double out2 = b0_2 * out1 + b1_2 * x1_2 + b2_2 * x2_2 - a1_2 * y1_2 - a2_2 * y2_2;
    x2_2 = x1_2; x1_2 = out1;
    y2_2 = y1_2; y1_2 = out2;

    return (float)out2;
}

//==============================================================================
// MeteringEngine

MeteringEngine::MeteringEngine()
{
    for (auto& m : fftMagnitudes) m.store(-90.0f);
    fftPeakHold.fill(-90.0f);
    goniometerBuffer.fill({0.0f, 0.0f});
}

MeteringEngine::~MeteringEngine() {}

void MeteringEngine::prepare(double sampleRate, int blockSize)
{
    currentSampleRate = sampleRate;
    currentBlockSize  = blockSize;

    kFilterL.prepare(sampleRate);
    kFilterR.prepare(sampleRate);

    msStepSamples = (int)(sampleRate * 0.1);
    msAccumL = msAccumR = 0.0;
    msAccumCount = 0;

    momentaryWindow.clear();
    shortTermWindow.clear();
    integratedBlocks.clear();
    integratedSumL = integratedSumR = 0.0;
    integratedCount = 0;

    // FFT setup
    fftWindow.resize(fftSize);
    // Hann window
    for (int i = 0; i < fftSize; ++i)
        fftWindow[(size_t)i] = 0.5f * (1.0f - std::cos(2.0f * juce::MathConstants<float>::pi * (float)i / (float)(fftSize - 1)));

    fftWorkspace.resize((size_t)fftSize);
    fftFifo.resize((size_t)fftSize, 0.0f);
    fftFifoPos = 0;
    fftPeakHold.fill(-90.0f);

    // Goniometer correlation buffer
    corrCapacity = (int)(sampleRate * 0.3);
    corrBuffer.resize((size_t)corrCapacity, {0.0f, 0.0f});
    corrPos = 0;
}

void MeteringEngine::reset()
{
    kFilterL.reset();
    kFilterR.reset();
    resetIntegrated();

    truePeakL.store(-144.0f);
    truePeakR.store(-144.0f);
    peakHoldL.store(-144.0f);
    peakHoldR.store(-144.0f);
    clipL.store(false);
    clipR.store(false);

    for (auto& m : fftMagnitudes) m.store(-90.0f);
    fftPeakHold.fill(-90.0f);
    goniometerBuffer.fill({0.0f, 0.0f});
    goniometerWritePos.store(0);
    correlation.store(0.0f);
}

void MeteringEngine::resetIntegrated()
{
    momentaryWindow.clear();
    shortTermWindow.clear();
    integratedBlocks.clear();
    integratedSumL = integratedSumR = 0.0;
    integratedCount = 0;
    msAccumL = msAccumR = 0.0;
    msAccumCount = 0;

    lufsIntegrated.store(-144.0f);
    lufsShortTerm.store(-144.0f);
    lfusMomentary.store(-144.0f);
}

double MeteringEngine::computeLoudness(double msL, double msR) const
{
    double sum = msL + msR;
    if (sum <= 1e-20) return -144.0;
    return -0.691 + 10.0 * std::log10(sum);
}

double MeteringEngine::computeWindowLoudness(const std::deque<LufsBlock>& window) const
{
    if (window.empty()) return -144.0;
    double sumL = 0.0, sumR = 0.0;
    for (const auto& b : window) { sumL += b.msL; sumR += b.msR; }
    sumL /= (double)window.size();
    sumR /= (double)window.size();
    return computeLoudness(sumL, sumR);
}

void MeteringEngine::pushLufsBlock(double msL, double msR)
{
    LufsBlock block { msL, msR };

    momentaryWindow.push_back(block);
    while ((int)momentaryWindow.size() > 4)  momentaryWindow.pop_front();

    shortTermWindow.push_back(block);
    while ((int)shortTermWindow.size() > 30) shortTermWindow.pop_front();

    double loudness = computeLoudness(msL, msR);
    if (loudness > -70.0)
    {
        integratedBlocks.push_back(block);
        integratedSumL += msL;
        integratedSumR += msR;
        integratedCount++;
    }

    lfusMomentary.store((float)computeWindowLoudness(momentaryWindow));
    lufsShortTerm.store((float)computeWindowLoudness(shortTermWindow));
    computeIntegratedLUFS();
}

void MeteringEngine::computeIntegratedLUFS()
{
    if (integratedCount == 0)
    {
        lufsIntegrated.store(-144.0f);
        return;
    }

    double ungatedL = integratedSumL / integratedCount;
    double ungatedR = integratedSumR / integratedCount;
    double ungatedLoudness = computeLoudness(ungatedL, ungatedR);
    double relativeGate = ungatedLoudness - 10.0;

    double sumL = 0.0, sumR = 0.0;
    int count = 0;
    for (const auto& b : integratedBlocks)
    {
        if (computeLoudness(b.msL, b.msR) > relativeGate)
        {
            sumL += b.msL; sumR += b.msR;
            count++;
        }
    }

    if (count == 0)
    {
        lufsIntegrated.store((float)ungatedLoudness);
        return;
    }

    lufsIntegrated.store((float)computeLoudness(sumL / count, sumR / count));
}

//==============================================================================
// Cooley-Tukey radix-2 DIT FFT (in-place)
void MeteringEngine::performFFT(std::vector<std::complex<float>>& data)
{
    int n = (int)data.size();
    // Bit-reversal permutation
    for (int i = 1, j = 0; i < n; ++i)
    {
        int bit = n >> 1;
        for (; j & bit; bit >>= 1) j ^= bit;
        j ^= bit;
        if (i < j) std::swap(data[(size_t)i], data[(size_t)j]);
    }

    // FFT butterfly
    for (int len = 2; len <= n; len <<= 1)
    {
        float angle = -2.0f * juce::MathConstants<float>::pi / (float)len;
        std::complex<float> wlen(std::cos(angle), std::sin(angle));

        for (int i = 0; i < n; i += len)
        {
            std::complex<float> w(1.0f, 0.0f);
            for (int j = 0; j < len / 2; ++j)
            {
                std::complex<float> u = data[(size_t)(i + j)];
                std::complex<float> v = data[(size_t)(i + j + len/2)] * w;
                data[(size_t)(i + j)]         = u + v;
                data[(size_t)(i + j + len/2)] = u - v;
                w *= wlen;
            }
        }
    }
}

void MeteringEngine::updateFFT(const juce::AudioBuffer<float>& buffer)
{
    int numSamples  = buffer.getNumSamples();
    int numChannels = buffer.getNumChannels();

    for (int i = 0; i < numSamples; ++i)
    {
        float mono = 0.0f;
        for (int ch = 0; ch < numChannels; ++ch)
            mono += buffer.getSample(ch, i);
        if (numChannels > 0) mono /= (float)numChannels;

        fftFifo[(size_t)fftFifoPos] = mono;
        fftFifoPos++;

        if (fftFifoPos >= fftSize)
        {
            // Prepare workspace
            for (int k = 0; k < fftSize; ++k)
                fftWorkspace[(size_t)k] = { fftFifo[(size_t)k] * fftWindow[(size_t)k], 0.0f };

            performFFT(fftWorkspace);

            float scale = 2.0f / (float)fftSize;
            for (int k = 0; k < fftOutputSize; ++k)
            {
                float re  = fftWorkspace[(size_t)k].real();
                float im  = fftWorkspace[(size_t)k].imag();
                float mag = std::sqrt(re * re + im * im) * scale;
                float db  = mag > 1e-10f ? 20.0f * std::log10(mag) : -90.0f;
                db = juce::jmax(db, -90.0f);

                if (db > fftPeakHold[(size_t)k])
                    fftPeakHold[(size_t)k] = db;
                else
                    fftPeakHold[(size_t)k] = juce::jmax(fftPeakHold[(size_t)k] - 0.15f, db);

                fftMagnitudes[(size_t)k].store(fftPeakHold[(size_t)k]);
            }

            // 50% overlap
            int hop = fftSize / 2;
            std::copy(fftFifo.begin() + hop, fftFifo.end(), fftFifo.begin());
            fftFifoPos = hop;
        }
    }
}

void MeteringEngine::processTruePeak(const juce::AudioBuffer<float>& buffer)
{
    int numSamples  = buffer.getNumSamples();
    int numChannels = buffer.getNumChannels();

    // 4x oversampling via linear interpolation
    const int oversample = 4;

    for (int ch = 0; ch < juce::jmin(numChannels, 2); ++ch)
    {
        float peak = 0.0f;
        const float* data = buffer.getReadPointer(ch);

        for (int i = 0; i < numSamples - 1; ++i)
        {
            float s0 = data[i];
            float s1 = data[i + 1];
            for (int k = 0; k < oversample; ++k)
            {
                float t = (float)k / (float)oversample;
                float s = s0 + t * (s1 - s0); // linear interp
                peak = juce::jmax(peak, std::abs(s));
            }
        }
        if (numSamples > 0)
            peak = juce::jmax(peak, std::abs(data[numSamples - 1]));

        float dBTP = peak > 1e-10f ? 20.0f * std::log10(peak) : -144.0f;

        if (ch == 0)
        {
            truePeakL.store(dBTP);
            float hold = peakHoldL.load();
            if (dBTP > hold) peakHoldL.store(dBTP);
            if (dBTP >= 0.0f) clipL.store(true);
        }
        else
        {
            truePeakR.store(dBTP);
            float hold = peakHoldR.load();
            if (dBTP > hold) peakHoldR.store(dBTP);
            if (dBTP >= 0.0f) clipR.store(true);
        }
    }
}

void MeteringEngine::updateGoniometer(const juce::AudioBuffer<float>& buffer)
{
    int numSamples  = buffer.getNumSamples();
    int numChannels = buffer.getNumChannels();

    if (corrBuffer.empty()) return;

    for (int i = 0; i < numSamples; ++i)
    {
        float L = numChannels > 0 ? buffer.getSample(0, i) : 0.0f;
        float R = numChannels > 1 ? buffer.getSample(1, i) : L;

        float mid  = (L + R) * 0.5f;
        float side = (L - R) * 0.5f;

        int wp = goniometerWritePos.load(std::memory_order_relaxed);
        goniometerBuffer[(size_t)wp] = { mid, side };
        goniometerWritePos.store((wp + 1) % goniometerBufferSize, std::memory_order_release);

        corrBuffer[(size_t)corrPos] = { L, R };
        corrPos = (corrPos + 1) % corrCapacity;
    }

    // Pearson correlation (every block)
    double sumL = 0.0, sumR = 0.0;
    for (const auto& p : corrBuffer) { sumL += p.first; sumR += p.second; }
    double meanL = sumL / corrCapacity;
    double meanR = sumR / corrCapacity;

    double num = 0.0, denL = 0.0, denR = 0.0;
    for (const auto& p : corrBuffer)
    {
        double dL = p.first  - meanL;
        double dR = p.second - meanR;
        num  += dL * dR;
        denL += dL * dL;
        denR += dR * dR;
    }

    double denom = std::sqrt(denL * denR);
    float corr = denom > 1e-10 ? (float)(num / denom) : 0.0f;
    correlation.store(juce::jlimit(-1.0f, 1.0f, corr));
}

void MeteringEngine::processBlock(const juce::AudioBuffer<float>& buffer)
{
    int numSamples  = buffer.getNumSamples();
    int numChannels = buffer.getNumChannels();

    //--- LUFS ---
    for (int i = 0; i < numSamples; ++i)
    {
        float L = numChannels > 0 ? buffer.getSample(0, i) : 0.0f;
        float R = numChannels > 1 ? buffer.getSample(1, i) : L;

        float kL = kFilterL.processSample(L);
        float kR = kFilterR.processSample(R);

        msAccumL += (double)kL * kL;
        msAccumR += (double)kR * kR;
        msAccumCount++;

        if (msAccumCount >= msStepSamples)
        {
            pushLufsBlock(msAccumL / msAccumCount, msAccumR / msAccumCount);
            msAccumL = msAccumR = 0.0;
            msAccumCount = 0;
        }
    }

    //--- True Peak ---
    processTruePeak(buffer);

    //--- FFT ---
    updateFFT(buffer);

    //--- Goniometer ---
    updateGoniometer(buffer);
}
