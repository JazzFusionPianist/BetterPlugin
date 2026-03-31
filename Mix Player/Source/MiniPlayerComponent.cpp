#include "MiniPlayerComponent.h"
#include "AudioEngine.h"
#include "LibraryManager.h"

static constexpr int kW          = 300;
static constexpr int kH          = 140;
static constexpr int kPad        = 14;
static constexpr int kBtnSize    = 36;
static constexpr int kBarH       = 4;
static constexpr int kCorner     = 10;

//==============================================================================
MiniPlayerComponent::MiniPlayerComponent(AudioEngine& engine, LibraryManager& library)
    : audioEngine(engine), libraryManager(library)
{
    setSize(kW, kH);
    setOpaque(false);  // transparent background for rounded corners

    // --- Play/Pause ---
    playButton.onClick = [this]()
    {
        if (audioEngine.isPlaying())
            audioEngine.pause();
        else
            audioEngine.play();
        updatePlayButton();
    };
    addAndMakeVisible(playButton);

    // --- Prev ---
    prevButton.onClick = [this]() { clickPrev(); };
    addAndMakeVisible(prevButton);

    // --- Next ---
    nextButton.onClick = [this]() { clickNext(); };
    addAndMakeVisible(nextButton);

    // --- Open main window ---
    openButton.onClick = [this]()
    {
        // Handled by the owner (Main.cpp) via the popup window callback
        if (onDismiss) onDismiss();
        // Post a flag picked up by TrayIcon to show the main window
        juce::MessageManager::callAsync([]()
        {
            // The TrayIcon's mouseDown already shows the popup; we need to
            // trigger the main window. We broadcast via a custom flag on the app.
            if (auto* app = juce::JUCEApplication::getInstance())
                app->anotherInstanceStarted("__show_main_window__");
        });
    };
    addAndMakeVisible(openButton);

    // --- Quit ---
    quitButton.onClick = []()
    {
        juce::JUCEApplication::getInstance()->systemRequestedQuit();
    };
    addAndMakeVisible(quitButton);

    // Style all buttons
    for (auto* btn : { &prevButton, &playButton, &nextButton })
    {
        btn->setColour(juce::TextButton::buttonColourId,   juce::Colour(0xff1e1e1e));
        btn->setColour(juce::TextButton::buttonOnColourId, juce::Colour(0xff2a2a2a));
        btn->setColour(juce::TextButton::textColourOffId,  juce::Colours::white);
        btn->setColour(juce::TextButton::textColourOnId,   juce::Colours::white);
        btn->setLookAndFeel(nullptr);
    }

    openButton.setColour(juce::TextButton::buttonColourId,  juce::Colour(0xff1a1a1a));
    openButton.setColour(juce::TextButton::textColourOffId, juce::Colour(0xff888888));

    quitButton.setColour(juce::TextButton::buttonColourId,  juce::Colour(0xff1a1a1a));
    quitButton.setColour(juce::TextButton::textColourOffId, juce::Colour(0xff666666));

    updatePlayButton();
    startTimerHz(15);
}

MiniPlayerComponent::~MiniPlayerComponent()
{
    stopTimer();
}

//==============================================================================
void MiniPlayerComponent::timerCallback()
{
    updatePlayButton();
    repaint();
}

void MiniPlayerComponent::updatePlayButton()
{
    playButton.setButtonText(audioEngine.isPlaying() ? "||" : ">");
}

//==============================================================================
juce::Rectangle<int> MiniPlayerComponent::progressBarArea() const
{
    return { kPad, 88, kW - kPad * 2, kBarH };
}

float MiniPlayerComponent::getProgressNorm() const
{
    double len = audioEngine.getLengthInSeconds();
    if (len <= 0.0) return 0.0f;
    return (float)juce::jlimit(0.0, 1.0, audioEngine.getCurrentPosition() / len);
}

juce::String MiniPlayerComponent::formatTime(double seconds)
{
    if (!std::isfinite(seconds) || seconds < 0.0) return "--:--";
    int m = (int)(seconds / 60.0);
    int s = (int)(seconds) % 60;
    return juce::String::formatted("%d:%02d", m, s);
}

//==============================================================================
void MiniPlayerComponent::paint(juce::Graphics& g)
{
    // Leave a small inset so the rounded corners aren't clipped at the very edge
    auto bounds = getLocalBounds().toFloat().reduced(2.0f);

    // Semi-transparent dark background
    g.setColour(juce::Colour(0xd8111111));  // ~85% opacity
    g.fillRoundedRectangle(bounds, (float)kCorner);

    // Subtle border
    g.setColour(juce::Colour(0x44ffffff));
    g.drawRoundedRectangle(bounds.reduced(0.5f), (float)kCorner, 0.75f);

    // Track name
    juce::String trackName = "No track loaded";
    int activeIdx = libraryManager.getActiveTrackIndex();
    if (activeIdx >= 0 && activeIdx < libraryManager.getNumTracks())
        trackName = libraryManager.getTrack(activeIdx).displayName;

    g.setFont(juce::Font(juce::FontOptions("SF Pro Display", 13.0f, juce::Font::bold)));
    g.setColour(juce::Colours::white);
    g.drawText(trackName, kPad, kPad, kW - kPad * 2, 18, juce::Justification::centredLeft, true);

    // Time labels
    double pos = audioEngine.getCurrentPosition();
    double len = audioEngine.getLengthInSeconds();
    g.setFont(juce::Font(juce::FontOptions("SF Pro Display", 11.0f, juce::Font::plain)));
    g.setColour(juce::Colour(0xff888888));
    g.drawText(formatTime(pos), kPad, 96, 50, 14, juce::Justification::centredLeft);
    g.drawText(formatTime(len), kW - kPad - 50, 96, 50, 14, juce::Justification::centredRight);

    // Progress bar track
    auto bar = progressBarArea();
    g.setColour(juce::Colour(0xff2a2a2a));
    g.fillRoundedRectangle(bar.toFloat(), 2.0f);

    // Progress bar fill
    float norm = getProgressNorm();
    if (norm > 0.0f)
    {
        auto fill = bar.withWidth((int)(norm * bar.getWidth()));
        g.setColour(juce::Colour(0xff00aaff));
        g.fillRoundedRectangle(fill.toFloat(), 2.0f);
    }

    // Progress knob
    if (len > 0.0)
    {
        float kx = (float)bar.getX() + norm * (float)bar.getWidth();
        float ky = (float)bar.getCentreY();
        g.setColour(juce::Colours::white);
        g.fillEllipse(kx - 5.0f, ky - 5.0f, 10.0f, 10.0f);
    }
}

void MiniPlayerComponent::resized()
{
    // Transport buttons centred in a row
    int totalBtns = kBtnSize * 3 + 8 * 2;
    int startX    = (kW - totalBtns) / 2;
    int btnY      = 40;

    prevButton.setBounds(startX,                  btnY, kBtnSize, kBtnSize);
    playButton.setBounds(startX + kBtnSize + 8,   btnY, kBtnSize, kBtnSize);
    nextButton.setBounds(startX + (kBtnSize + 8) * 2, btnY, kBtnSize, kBtnSize);

    // Bottom row: Open + Quit
    int footerY = kH - 28;
    openButton.setBounds(kPad,                  footerY, 160, 20);
    quitButton.setBounds(kW - kPad - 50,        footerY, 50,  20);
}

//==============================================================================
void MiniPlayerComponent::mouseDown(const juce::MouseEvent& e)
{
    auto bar = progressBarArea();
    if (bar.expanded(0, 8).contains(e.getPosition()))
    {
        isDraggingProgress = true;
        double len = audioEngine.getLengthInSeconds();
        if (len > 0.0)
        {
            float norm = juce::jlimit(0.0f, 1.0f,
                (float)(e.x - bar.getX()) / (float)bar.getWidth());
            audioEngine.setPosition(norm * len);
        }
    }
}

void MiniPlayerComponent::mouseDrag(const juce::MouseEvent& e)
{
    if (!isDraggingProgress) return;
    auto bar = progressBarArea();
    double len = audioEngine.getLengthInSeconds();
    if (len > 0.0)
    {
        float norm = juce::jlimit(0.0f, 1.0f,
            (float)(e.x - bar.getX()) / (float)bar.getWidth());
        audioEngine.setPosition(norm * len);
    }
}

void MiniPlayerComponent::mouseUp(const juce::MouseEvent&)
{
    isDraggingProgress = false;
}

//==============================================================================
void MiniPlayerComponent::clickPrev()
{
    int idx = libraryManager.getActiveTrackIndex();
    if (idx > 0)
    {
        libraryManager.setActiveTrackIndex(idx - 1);
        libraryManager.loadTrack(idx - 1, audioEngine);
    }
    else
    {
        // Restart current track
        audioEngine.setPosition(0.0);
    }
}

void MiniPlayerComponent::clickNext()
{
    int idx = libraryManager.getActiveTrackIndex();
    int num = libraryManager.getNumTracks();
    if (idx >= 0 && idx < num - 1)
    {
        libraryManager.setActiveTrackIndex(idx + 1);
        libraryManager.loadTrack(idx + 1, audioEngine);
    }
}
