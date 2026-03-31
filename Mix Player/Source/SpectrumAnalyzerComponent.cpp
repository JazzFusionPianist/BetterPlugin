#include "SpectrumAnalyzerComponent.h"
#include "MeteringEngine.h"

const std::vector<float> SpectrumAnalyzerComponent::freqLabels =
    { 20.0f, 50.0f, 100.0f, 200.0f, 500.0f, 1000.0f, 2000.0f, 5000.0f, 10000.0f, 20000.0f };

SpectrumAnalyzerComponent::SpectrumAnalyzerComponent(MeteringEngine& engine)
    : meteringEngine(engine)
{
    startTimerHz(30);
    setOpaque(true);
}

SpectrumAnalyzerComponent::~SpectrumAnalyzerComponent()
{
    stopTimer();
}

float SpectrumAnalyzerComponent::binToX(int bin, int width) const
{
    if (bin <= 0) return 0.0f;
    double freq = (double)bin * currentSampleRate / (double)(MeteringEngine::fftSize);
    freq = juce::jlimit(20.0, 20000.0, freq);
    float norm = (float)(std::log10(freq / 20.0) / std::log10(20000.0 / 20.0));
    return norm * (float)width;
}

void SpectrumAnalyzerComponent::timerCallback()
{
    repaint();
}

void SpectrumAnalyzerComponent::paint(juce::Graphics& g)
{
    auto bounds = getLocalBounds();
    int w = bounds.getWidth();
    int h = bounds.getHeight();

    // Reserve margins: top for header label, bottom for freq labels, left for dB labels
    static constexpr int topMargin  = 20;  // "Spectrum" header
    static constexpr int botMargin  = 18;  // freq (x-axis) labels
    static constexpr int leftMargin = 36;  // dB (y-axis) labels

    int plotTop = topMargin;
    int plotH   = h - topMargin - botMargin;
    int plotX   = leftMargin;
    int plotW   = w - leftMargin;

    g.fillAll(juce::Colour(0xff0a0a0a));

    // "Spectrum" header label (top-left, above plot)
    g.setFont(juce::Font(juce::FontOptions("SF Pro Display", 16.0f, juce::Font::plain)));
    g.setColour(juce::Colours::grey);
    g.drawText("Spectrum", plotX, 2, 80, 16, juce::Justification::centredLeft);

    if (plotH <= 0 || plotW <= 0) return;

    // Grid lines - dB horizontal (within plot area)
    g.setColour(juce::Colour(0xff1a1a1a));
    for (float db = -90.0f; db <= 0.0f; db += 10.0f)
    {
        float norm = (db + 90.0f) / 90.0f;
        int y = plotTop + plotH - (int)(norm * plotH);
        g.drawHorizontalLine(y, (float)plotX, (float)(plotX + plotW));
    }

    // Grid lines - frequency vertical (within plot area)
    for (float freq : freqLabels)
    {
        double norm = std::log10(freq / 20.0) / std::log10(20000.0 / 20.0);
        int x = plotX + (int)(norm * plotW);
        g.drawVerticalLine(x, (float)plotTop, (float)(plotTop + plotH));
    }

    // Spectrum fill path
    juce::Path spectrumPath;
    bool started = false;

    int numBins = MeteringEngine::fftOutputSize;
    // Only draw up to Nyquist / 20kHz
    int maxBin = (int)((20000.0 / (currentSampleRate / 2.0)) * numBins);
    maxBin = juce::jmin(maxBin, numBins - 1);

    float plotBottom = (float)(plotTop + plotH);

    for (int bin = 1; bin <= maxBin; ++bin)
    {
        float db  = meteringEngine.fftMagnitudes[(size_t)bin].load();
        db = juce::jlimit(-90.0f, 0.0f, db);
        float norm = (db + 90.0f) / 90.0f;
        float x = (float)plotX + binToX(bin, plotW);
        float y = plotBottom - norm * (float)plotH;

        if (!started)
        {
            spectrumPath.startNewSubPath(x, plotBottom);
            spectrumPath.lineTo(x, y);
            started = true;
        }
        else
        {
            spectrumPath.lineTo(x, y);
        }
    }

    if (started)
    {
        spectrumPath.lineTo((float)(plotX + plotW), plotBottom);
        spectrumPath.closeSubPath();

        // Fill with gradient
        g.setGradientFill(juce::ColourGradient(
            juce::Colour(0xff00aaff).withAlpha(0.7f), 0.0f, (float)plotTop,
            juce::Colour(0xff004466).withAlpha(0.2f), 0.0f, plotBottom,
            false));
        g.fillPath(spectrumPath);

        // Outline
        g.setColour(juce::Colour(0xff00aaff).withAlpha(0.9f));
        g.strokePath(spectrumPath, juce::PathStrokeType(1.0f));
    }

    // dB labels (left margin, vertically alongside plot)
    g.setFont(juce::Font(juce::FontOptions("SF Pro Display", 12.0f, juce::Font::plain)));
    g.setColour(juce::Colours::darkgrey);
    for (float db = -80.0f; db <= 0.0f; db += 10.0f)
    {
        float norm = (db + 90.0f) / 90.0f;
        int y = plotTop + plotH - (int)(norm * plotH);
        // Skip labels too close to the bottom (would overlap freq labels)
        if (y > plotTop + plotH - 4) continue;
        g.drawText(juce::String((int)db), 0, y - 8, leftMargin - 2, 16,
                   juce::Justification::centredRight);
    }

    // Frequency labels (bottom margin)
    g.setFont(juce::Font(juce::FontOptions("SF Pro Display", 12.0f, juce::Font::plain)));
    g.setColour(juce::Colours::grey);
    int freqLabelY = plotTop + plotH + 1;
    for (float freq : freqLabels)
    {
        double norm = std::log10(freq / 20.0) / std::log10(20000.0 / 20.0);
        int x = plotX + (int)(norm * plotW);
        juce::String label;
        if (freq >= 1000.0f)
            label = juce::String((int)(freq / 1000.0f)) + "k";
        else
            label = juce::String((int)freq);
        g.drawText(label, x - 18, freqLabelY, 36, botMargin - 2, juce::Justification::centred);
    }
}

void SpectrumAnalyzerComponent::resized() {}
