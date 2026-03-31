#include "GoniometerComponent.h"
#include "MeteringEngine.h"

GoniometerComponent::GoniometerComponent(MeteringEngine& engine)
    : meteringEngine(engine)
{
    snapshot.resize(MeteringEngine::goniometerBufferSize);
    startTimerHz(30);
    setOpaque(true);
}

GoniometerComponent::~GoniometerComponent()
{
    stopTimer();
}

void GoniometerComponent::timerCallback()
{
    // Snapshot the circular buffer
    int wp = meteringEngine.goniometerWritePos.load(std::memory_order_acquire);
    for (int i = 0; i < MeteringEngine::goniometerBufferSize; ++i)
        snapshot[(size_t)i] = meteringEngine.goniometerBuffer[(size_t)i];
    snapshotWritePos = wp;
    correlationValue = meteringEngine.correlation.load();
    repaint();
}

void GoniometerComponent::paint(juce::Graphics& g)
{
    auto bounds = getLocalBounds();
    int w = bounds.getWidth();
    int h = bounds.getHeight();

    static constexpr int labelMargin = 16; // left/right margin for L/R labels
    static constexpr int scaleW      = 22; // right margin for +1/0/-1 scale

    int scopeH = h - 14; // available height for the vectorscope (bottom margin for scale labels)

    g.fillAll(juce::Colour(0xff0a0a0a));

    // --- Semicircle vectorscope ---
    // Scope area excludes left/right label margins and the right scale strip
    int scopeAreaW = w - labelMargin - labelMargin - scaleW;
    // Radius: largest semicircle that fits in scopeAreaW width and scopeH height
    // diameter = min(scopeAreaW, scopeH*2), but width takes priority for wide layouts
    int diameter  = juce::jmin(scopeAreaW, scopeH * 2);
    int radius    = diameter / 2;

    // Horizontal center of the scope area (excluding scale strip)
    int scopeAreaX = labelMargin;
    int cx         = scopeAreaX + scopeAreaW / 2;
    int baselineY  = scopeH; // baseline sits at the bottom of the scope area

    // "Vectorscope" header label
    g.setFont(juce::Font(juce::FontOptions("SF Pro Display", 12.0f, juce::Font::plain)));
    g.setColour(juce::Colours::grey);
    g.drawText("Vectorscope", 0, 2, w - scaleW, 14, juce::Justification::centred);

    // Semicircle background fill
    juce::Path semicircle;
    semicircle.addArc((float)(cx - radius), (float)(baselineY - radius),
                      (float)diameter, (float)diameter,
                      juce::MathConstants<float>::pi,
                      juce::MathConstants<float>::twoPi,
                      true);
    semicircle.lineTo((float)(cx - radius), (float)baselineY);
    semicircle.closeSubPath();

    g.setColour(juce::Colour(0xff0e0e0e));
    g.fillPath(semicircle);

    // Semicircle border arc
    juce::Path arcPath;
    arcPath.addArc((float)(cx - radius), (float)(baselineY - radius),
                   (float)diameter, (float)diameter,
                   juce::MathConstants<float>::pi,
                   juce::MathConstants<float>::twoPi,
                   true);
    g.setColour(juce::Colour(0xff1e1e1e));
    g.strokePath(arcPath, juce::PathStrokeType(1.0f));

    // Baseline (horizontal line L to R)
    g.setColour(juce::Colour(0xff1e1e1e));
    g.drawHorizontalLine(baselineY, (float)(cx - radius), (float)(cx + radius));

    // Center vertical axis line (mono = straight up)
    g.setColour(juce::Colour(0xff202020));
    g.drawVerticalLine(cx, (float)(baselineY - radius), (float)baselineY);

    // 45-degree guide lines (pure L and pure R directions)
    float diag = (float)radius * 0.707f; // cos(45°)
    g.setColour(juce::Colour(0xff1a1a1a));
    g.drawLine((float)cx, (float)baselineY,
               (float)cx - diag, (float)(baselineY - diag), 1.0f);
    g.drawLine((float)cx, (float)baselineY,
               (float)cx + diag, (float)(baselineY - diag), 1.0f);

    // Scale arc ring at 50% radius
    {
        float r = (float)radius * 0.5f;
        juce::Path ring;
        ring.addArc((float)cx - r, (float)baselineY - r,
                    r * 2.0f, r * 2.0f,
                    juce::MathConstants<float>::pi,
                    juce::MathConstants<float>::twoPi,
                    true);
        g.setColour(juce::Colour(0xff181818));
        g.strokePath(ring, juce::PathStrokeType(0.5f));
    }

    // L / R labels at ends of baseline
    g.setFont(juce::Font(juce::FontOptions("SF Pro Display", 12.0f, juce::Font::plain)));
    g.setColour(juce::Colour(0xff666666));
    g.drawText("L", cx - radius - labelMargin, baselineY - 8, labelMargin - 1, 16, juce::Justification::centred);
    g.drawText("R", cx + radius + 1,           baselineY - 8, labelMargin - 1, 16, juce::Justification::centred);

    // --- Right-side vertical scale: line + +1 / 0 / -1 labels ---
    {
        int scaleX     = w - scaleW;          // x of the vertical scale line
        int scaleTop   = baselineY - radius;  // top of scale = top of arc (+1)
        int scaleMid   = baselineY - radius / 2; // 50% height = "0"
        int scaleBot   = baselineY;           // bottom = -1

        // Vertical line
        g.setColour(juce::Colour(0xff333333));
        g.drawVerticalLine(scaleX, (float)scaleTop, (float)scaleBot);

        // Tick marks
        for (int ty : { scaleTop, scaleMid, scaleBot })
        {
            g.drawHorizontalLine(ty, (float)(scaleX - 3), (float)(scaleX));
        }

        // Labels: +1, 0, -1
        g.setFont(juce::Font(juce::FontOptions("SF Pro Display", 11.0f, juce::Font::plain)));
        g.setColour(juce::Colour(0xff555555));
        g.drawText("+1", scaleX + 2, scaleTop - 6,  scaleW - 3, 12, juce::Justification::centredLeft);
        g.drawText("0",  scaleX + 2, scaleMid - 6,  scaleW - 3, 12, juce::Justification::centredLeft);
        g.drawText("-1", scaleX + 2, scaleBot - 6,  scaleW - 3, 12, juce::Justification::centredLeft);
    }

    // --- Draw dots ---
    // Polar mapping: angle from straight up, radius = amplitude
    // L channel only → angle = -45° (left), R only → +45° (right), mono → 0° (straight up)
    // Using mid/side: angle = atan2(side, mid), clamped to upper semicircle
    int numDots = MeteringEngine::goniometerBufferSize;

    for (int i = 0; i < numDots; ++i)
    {
        // Age: most recent = 1.0, oldest = 0.0
        int idx = (snapshotWritePos - i + numDots) % numDots;
        int age = (snapshotWritePos - i + numDots) % numDots;
        float alpha = 1.0f - (float)age / (float)numDots;
        alpha = std::sqrt(alpha); // sqrt fade: slower decay = longer afterglow

        if (alpha < 0.01f) continue;

        const auto& p = snapshot[(size_t)idx];

        // Convert mid/side to polar angle (from straight up) and radius
        // mid is the M (sum) channel, side is the S (difference) channel
        float mid  = p.mid;
        float side = p.side;

        float r     = std::sqrt(mid * mid + side * side);
        float angle = std::atan2(side, mid); // angle from mid axis

        // Map to screen: angle=0 → straight up, angle=-π/2 → left, angle=+π/2 → right
        // In screen coords: px = cx + r*radius*sin(angle), py = baselineY - r*radius*cos(angle)
        float scaledR = juce::jlimit(0.0f, (float)radius, r * (float)radius * 0.85f);
        float px = (float)cx      + scaledR * std::sin(angle);
        float py = (float)baselineY - scaledR * std::cos(angle);

        // Only draw if within the upper semicircle (py <= baselineY)
        if (py > (float)baselineY) continue;

        g.setColour(juce::Colour(0xff00ffaa).withAlpha(alpha * 0.85f));
        g.fillRect(px - 0.3f, py - 0.3f, 0.6f, 0.6f);
    }

    // Small center marker at baseline center
    g.setColour(juce::Colour(0xff2255aa));
    g.fillRect((float)cx - 2.0f, (float)baselineY - 2.0f, 4.0f, 4.0f);


}

void GoniometerComponent::resized() {}
