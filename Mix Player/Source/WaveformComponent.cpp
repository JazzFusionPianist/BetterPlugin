#include "WaveformComponent.h"
#include "AudioEngine.h"

WaveformComponent::WaveformComponent(AudioEngine& engine)
    : audioEngine(engine),
      thumbnail(512, engine.getFormatManager(), engine.getThumbnailCache())
{
    thumbnail.addChangeListener(this);
    startTimerHz(30);
    setOpaque(true);
}

WaveformComponent::~WaveformComponent()
{
    stopTimer();
    thumbnail.removeChangeListener(this);
}

void WaveformComponent::loadFile(const juce::File& file)
{
    thumbnail.setSource(new juce::FileInputSource(file));
    loopInPoint  = 0.0;
    loopOutPoint = 0.0;
    repaint();
}

void WaveformComponent::clearWaveform()
{
    thumbnail.clear();
    loopInPoint  = 0.0;
    loopOutPoint = 0.0;
    repaint();
}

void WaveformComponent::paint(juce::Graphics& g)
{
    g.fillAll(juce::Colour(0xff0a0a0a));

    int w = getWidth();
    int h = getHeight();

    // Reserve bottom strip for time ruler labels
    static constexpr int rulerH = 18;
    int waveH = h - rulerH;

    if (thumbnail.getTotalLength() <= 0.0)
    {
        g.setColour(juce::Colours::grey);
        g.setFont(juce::Font(juce::FontOptions("SF Pro Display", 16.0f, juce::Font::plain)));
        g.drawText("No file loaded", 0, 0, w, waveH, juce::Justification::centred);
        return;
    }

    // Loop region highlight (waveform area only)
    if (loopOutPoint > loopInPoint)
    {
        float xIn  = (float)secondsToX(loopInPoint);
        float xOut = (float)secondsToX(loopOutPoint);

        // Fill: semi-transparent blue overlay
        g.setColour(juce::Colour(0x6600aaff));
        g.fillRect(xIn, 0.0f, xOut - xIn, (float)waveH);

        // Top highlight strip
        g.setColour(juce::Colour(0xaa00ccff));
        g.fillRect(xIn, 0.0f, xOut - xIn, 2.0f);

        // Edge lines (bright)
        g.setColour(juce::Colour(0xff00ccff));
        g.drawVerticalLine((int)xIn,  0.0f, (float)waveH);
        g.drawVerticalLine((int)xOut, 0.0f, (float)waveH);

        // Small triangular in/out markers at top
        g.setColour(juce::Colour(0xff00ccff));
        juce::Path inMarker, outMarker;
        inMarker.addTriangle(xIn - 5.0f, 0.0f,  xIn + 5.0f, 0.0f,  xIn, 8.0f);
        outMarker.addTriangle(xOut - 5.0f, 0.0f, xOut + 5.0f, 0.0f, xOut, 8.0f);
        g.fillPath(inMarker);
        g.fillPath(outMarker);
    }

    // Waveform (in upper area only)
    g.setColour(juce::Colour(0xff00aaff).withAlpha(0.85f));
    thumbnail.drawChannels(g, juce::Rectangle<int>(0, 0, w, waveH),
                           0.0, thumbnail.getTotalLength(), 0.8f);

    // Playhead (full height including ruler)
    float playX = (float)secondsToX(playheadPosition);
    g.setColour(juce::Colours::white);
    g.drawVerticalLine((int)playX, 0.0f, (float)h);

    // Ruler separator line
    g.setColour(juce::Colour(0xff1e1e1e));
    g.drawHorizontalLine(waveH, 0.0f, (float)w);

    // Time ruler labels in bottom strip
    g.setColour(juce::Colour(0xff666666));
    g.setFont(juce::Font(juce::FontOptions("SF Pro Display", 11.0f, juce::Font::plain)));
    double totalLen = thumbnail.getTotalLength();
    int numLabels = 10;
    for (int i = 0; i <= numLabels; ++i)
    {
        double t = totalLen * i / numLabels;
        int xPos = secondsToX(t);
        int mins = (int)(t / 60.0);
        int secs = (int)(t) % 60;
        juce::String label = juce::String::formatted("%d:%02d", mins, secs);
        // Tick mark
        g.setColour(juce::Colour(0xff333333));
        g.drawVerticalLine(xPos, (float)waveH, (float)(waveH + 4));
        // Label
        g.setColour(juce::Colour(0xff666666));
        g.drawText(label, xPos - 18, waveH + 4, 36, rulerH - 5, juce::Justification::centred);
    }
}

void WaveformComponent::resized() {}

void WaveformComponent::mouseDown(const juce::MouseEvent& e)
{
    if (thumbnail.getTotalLength() <= 0.0) return;

    // Always start a potential loop drag from the click position
    isDraggingLoop = true;
    loopDragStart  = xToSeconds(e.x);
    loopInPoint    = loopDragStart;
    loopOutPoint   = loopDragStart;
    repaint();
}

void WaveformComponent::mouseDrag(const juce::MouseEvent& e)
{
    if (thumbnail.getTotalLength() <= 0.0) return;

    double t = xToSeconds(e.x);
    loopInPoint  = juce::jmax(0.0,                         juce::jmin(loopDragStart, t));
    loopOutPoint = juce::jmin(thumbnail.getTotalLength(),   juce::jmax(loopDragStart, t));
    repaint();
}

void WaveformComponent::mouseUp(const juce::MouseEvent& e)
{
    if (!isDraggingLoop) return;
    isDraggingLoop = false;

    // If barely moved (< 3px), treat as a plain click: seek and clear loop
    if (std::abs(e.x - e.mouseDownPosition.x) < 3)
    {
        loopInPoint  = 0.0;
        loopOutPoint = 0.0;
        audioEngine.setLoopPoints(0.0, 0.0);
        audioEngine.setLoopEnabled(false);
        double seekPos = xToSeconds(e.x);
        playheadPosition = seekPos;  // update immediately, don't wait for timer
        audioEngine.setPosition(seekPos);
        if (onLoopPointsChanged)
            onLoopPointsChanged(0.0, 0.0);
    }
    else
    {
        // Real drag: set loop region, activate loop (seek happens on next play)
        audioEngine.setLoopPoints(loopInPoint, loopOutPoint);
        audioEngine.setLoopEnabled(true);
        if (onLoopPointsChanged)
            onLoopPointsChanged(loopInPoint, loopOutPoint);
    }
    repaint();
}

void WaveformComponent::timerCallback()
{
    double newPos = audioEngine.getCurrentPosition();
    if (std::abs(newPos - playheadPosition) > 0.01)
    {
        playheadPosition = newPos;
        repaint();
    }
}

void WaveformComponent::changeListenerCallback(juce::ChangeBroadcaster*)
{
    repaint();
}

double WaveformComponent::xToSeconds(int x) const
{
    double len = thumbnail.getTotalLength();
    if (len <= 0.0 || getWidth() <= 0) return 0.0;
    return (double)x / (double)getWidth() * len;
}

int WaveformComponent::secondsToX(double t) const
{
    double len = thumbnail.getTotalLength();
    if (len <= 0.0) return 0;
    return (int)((t / len) * (double)getWidth());
}
