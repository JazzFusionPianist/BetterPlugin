#include "TruePeakMeterComponent.h"
#include "MeteringEngine.h"

TruePeakMeterComponent::TruePeakMeterComponent(MeteringEngine& engine)
    : meteringEngine(engine)
{
    startTimerHz(30);
    setOpaque(true);
}

TruePeakMeterComponent::~TruePeakMeterComponent()
{
    stopTimer();
}

float TruePeakMeterComponent::dbToNorm(float db) const
{
    if (!std::isfinite(db)) return 0.0f;
    return juce::jlimit(0.0f, 1.0f, (db - minDB) / (maxDB - minDB));
}

void TruePeakMeterComponent::timerCallback()
{
    peakL = meteringEngine.truePeakL.load();
    peakR = meteringEngine.truePeakR.load();
    holdL = meteringEngine.peakHoldL.load();
    holdR = meteringEngine.peakHoldR.load();
    clipL = meteringEngine.clipL.load();
    clipR = meteringEngine.clipR.load();
    repaint();
}

void TruePeakMeterComponent::resetPeakHold()
{
    meteringEngine.peakHoldL.store(-std::numeric_limits<float>::infinity());
    meteringEngine.peakHoldR.store(-std::numeric_limits<float>::infinity());
    meteringEngine.clipL.store(false);
    meteringEngine.clipR.store(false);
}

void TruePeakMeterComponent::drawChannel(juce::Graphics& g, juce::Rectangle<int> area,
                                          float peak, float hold, bool clip)
{
    int x = area.getX();
    int y = area.getY();
    int w = area.getWidth();
    int h = area.getHeight();

    // Clip light (top 12px)
    int clipH = 12;
    juce::Colour clipColour = clip ? juce::Colours::red : juce::Colour(0xff441111);
    g.setColour(clipColour);
    g.fillRect(x, y, w, clipH);
    g.setColour(juce::Colours::darkgrey);
    g.drawRect(x, y, w, clipH);

    int barY = y + clipH + 2;
    int barH = h - clipH - 2;

    if (barH <= 0) return;

    // Background
    g.setColour(juce::Colour(0xff111111));
    g.fillRect(x, barY, w, barH);

    // Level fill
    float norm = dbToNorm(peak);
    int fillH  = (int)(norm * barH);

    if (fillH > 0)
    {
        // Color: green -> yellow -> red
        juce::ColourGradient grad(
            juce::Colours::red,            (float)x, (float)barY,
            juce::Colour(0xff00cc00),       (float)x, (float)(barY + barH),
            false);
        grad.addColour(0.25, juce::Colours::orange);
        g.setGradientFill(grad);
        g.fillRect(x, barY + barH - fillH, w, fillH);
    }

    // Peak hold line
    if (std::isfinite(hold))
    {
        float holdNorm = dbToNorm(hold);
        int holdY = barY + barH - (int)(holdNorm * barH);
        g.setColour(juce::Colours::white);
        g.fillRect(x, holdY - 1, w, 2);
    }

    // Scale ticks
    g.setColour(juce::Colour(0xff222222));
    for (float db = -40.0f; db <= 6.0f; db += 6.0f)
    {
        int tickY = barY + barH - (int)(dbToNorm(db) * barH);
        g.drawHorizontalLine(tickY, (float)x, (float)(x + w));
    }

    g.setColour(juce::Colours::darkgrey);
    g.drawRect(x, barY, w, barH);
}

void TruePeakMeterComponent::paint(juce::Graphics& g)
{
    g.fillAll(juce::Colour(0xff0a0a0a));

    auto bounds = getLocalBounds().reduced(4);
    int bx = bounds.getX();
    int by = bounds.getY();
    int bw = bounds.getWidth();
    int bh = bounds.getHeight();

    // Header
    g.setColour(juce::Colour(0xff888888));
    g.setFont(juce::Font(juce::FontOptions("SF Pro Display", 16.0f, juce::Font::bold)));
    g.drawText("True Peak", bx, by, bw, 20, juce::Justification::centredLeft);

    // Two equal columns for L and R (mirroring LUFS column structure)
    int gap   = 4;
    int halfW = (bw - gap) / 2;

    int lX = bx;
    int rX = bx + halfW + gap;

    // Layout (top to bottom):
    //   header (20px)
    //   channel label L/R (20px)
    //   number readout (22px)
    //   bar graph (remaining)
    int headerH = 20;
    int labelH  = 20;
    int numH    = 22;
    int topY    = by + headerH;
    int barTop  = topY + labelH + numH + 2;
    int barH    = bh - (barTop - by) - 2;

    if (barH <= 0) return;

    auto formatDB = [](float v) -> juce::String {
        if (!std::isfinite(v)) return "-inf";
        return juce::String(v, 1);
    };

    auto peakColour = [](float v) -> juce::Colour {
        if (!std::isfinite(v)) return juce::Colour(0xff555555);
        if (v > 0.0f)   return juce::Colours::red;
        if (v > -6.0f)  return juce::Colours::orange;
        if (v > -18.0f) return juce::Colour(0xff00dd00);
        return juce::Colour(0xff0088ff);
    };

    // Channel labels (L / R) below header
    g.setFont(juce::Font(juce::FontOptions("SF Pro Display", 16.0f, juce::Font::bold)));
    g.setColour(juce::Colour(0xff888888));
    g.drawText("L", lX, topY, halfW, labelH, juce::Justification::centred);
    g.drawText("R", rX, topY, halfW, labelH, juce::Justification::centred);

    // Numeric readout below labels
    g.setFont(juce::Font(juce::FontOptions("SF Pro Display", 16.0f, juce::Font::bold)));
    g.setColour(peakColour(peakL));
    g.drawText(formatDB(peakL), lX, topY + labelH, halfW, numH, juce::Justification::centred);
    g.setColour(peakColour(peakR));
    g.drawText(formatDB(peakR), rX, topY + labelH, halfW, numH, juce::Justification::centred);

    // Bar graphs below numbers
    drawChannel(g, { lX, barTop, halfW, barH }, peakL, holdL, clipL);
    drawChannel(g, { rX, barTop, halfW, barH }, peakR, holdR, clipR);

    // Scale labels (right edge)
    g.setFont(juce::Font(juce::FontOptions("SF Pro Display", 16.0f, juce::Font::plain)));
    g.setColour(juce::Colour(0xff444444));
    for (float db = -36.0f; db <= 6.0f; db += 12.0f)
    {
        int tickY = barTop + barH - (int)(dbToNorm(db) * barH);
        g.drawText(juce::String((int)db),
                   bounds.getRight() - 20, tickY - 8, 20, 16,
                   juce::Justification::centredRight);
    }
}

void TruePeakMeterComponent::resized() {}
