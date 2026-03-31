#include "LUFSMeterComponent.h"
#include "MeteringEngine.h"

LUFSMeterComponent::LUFSMeterComponent(MeteringEngine& engine)
    : meteringEngine(engine)
{
    startTimerHz(30);
    setOpaque(true);
}

LUFSMeterComponent::~LUFSMeterComponent()
{
    stopTimer();
}

float LUFSMeterComponent::lufsToNorm(float lufs) const
{
    if (!std::isfinite(lufs)) return 0.0f;
    return juce::jlimit(0.0f, 1.0f, (lufs - minLUFS) / (maxLUFS - minLUFS));
}

juce::Colour LUFSMeterComponent::getLUFSColour(float lufs) const
{
    if (lufs > -8.0f)  return juce::Colours::red;
    if (lufs > -14.0f) return juce::Colours::orange;
    if (lufs > -23.0f) return juce::Colour(0xff00dd00);
    return juce::Colour(0xff0088ff);
}

void LUFSMeterComponent::timerCallback()
{
    integrated = meteringEngine.lufsIntegrated.load();
    shortTerm  = meteringEngine.lufsShortTerm.load();
    momentary  = meteringEngine.lfusMomentary.load();
    repaint();
}

void LUFSMeterComponent::paint(juce::Graphics& g)
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
    g.drawText("LUFS", bx, by, bw, 20, juce::Justification::centredLeft);

    // Three equal columns: Integrated | Short-term | Momentary
    int colW    = bw / 3;
    int labelH  = 20;  // column label height
    int numH    = 22;  // number readout height
    int topY    = by + 20;  // below header
    int barTop  = topY + labelH + numH + 2;
    int barH    = bh - (barTop - by) - 2;

    if (barH <= 0) return;

    auto formatLUFS = [](float v) -> juce::String {
        if (!std::isfinite(v)) return "-inf";
        return juce::String(v, 1);
    };

    struct ColInfo { const char* label; float value; };
    ColInfo cols[3] = {
        { "I",  integrated },
        { "S",  shortTerm  },
        { "M",  momentary  }
    };

    for (int i = 0; i < 3; ++i)
    {
        int cx  = bx + i * colW;
        int cw  = (i == 2) ? bw - 2 * colW : colW;
        int barX = cx + 3;
        int barW = cw - 6;

        if (barW <= 0) continue;

        float val = cols[i].value;

        // Column label (I / S / M — compact for narrow columns)
        static const char* shortLabels[3] = { "I", "S", "M" };
        g.setColour(juce::Colour(0xff888888));
        g.setFont(juce::Font(juce::FontOptions("SF Pro Display", 16.0f, juce::Font::bold)));
        g.drawText(shortLabels[i], cx, topY, cw, labelH, juce::Justification::centred);

        // Number readout
        juce::Colour numCol = std::isfinite(val) ? getLUFSColour(val) : juce::Colour(0xff555555);
        g.setColour(numCol);
        g.setFont(juce::Font(juce::FontOptions("SF Pro Display", 16.0f, juce::Font::bold)));
        g.drawText(formatLUFS(val), cx, topY + labelH, cw, numH, juce::Justification::centred);

        // Vertical bar
        g.setColour(juce::Colour(0xff141414));
        g.fillRect(barX, barTop, barW, barH);

        float norm = lufsToNorm(val);
        int fillH  = (int)(norm * (float)barH);

        if (fillH > 0)
        {
            g.setGradientFill(juce::ColourGradient(
                juce::Colours::red,          (float)barX, (float)barTop,
                juce::Colour(0xff0088ff),    (float)barX, (float)(barTop + barH),
                false));
            g.fillRect(barX, barTop + barH - fillH, barW, fillH);
        }

        // Scale ticks
        g.setColour(juce::Colour(0xff222222));
        for (float lufs = -36.0f; lufs <= 0.0f; lufs += 6.0f)
        {
            int tickY = barTop + barH - (int)(lufsToNorm(lufs) * (float)barH);
            g.drawHorizontalLine(tickY, (float)barX, (float)(barX + barW));
        }

        // Border
        g.setColour(juce::Colour(0xff2a2a2a));
        g.drawRect(barX, barTop, barW, barH);

        // Vertical divider between columns (except after last)
        if (i < 2)
        {
            g.setColour(juce::Colour(0xff1e1e1e));
            g.drawVerticalLine(cx + colW - 1, (float)by, (float)(by + bh));
        }
    }

    // Scale labels on right edge of last bar
    int lastBarX = bx + 2 * colW + 3;
    int lastBarW = (bw - 2 * colW) - 6;
    g.setFont(juce::Font(juce::FontOptions("SF Pro Display", 16.0f, juce::Font::plain)));
    g.setColour(juce::Colour(0xff444444));
    for (float lufs = -36.0f; lufs <= 0.0f; lufs += 12.0f)
    {
        int tickY = barTop + barH - (int)(lufsToNorm(lufs) * (float)barH);
        g.drawText(juce::String((int)lufs),
                   lastBarX + lastBarW + 1, tickY - 8, 20, 16,
                   juce::Justification::centredLeft);
    }
}

void LUFSMeterComponent::resized() {}
