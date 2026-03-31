#include "MainComponent.h"

//==============================================================================
MainComponent::MainComponent()
    : libraryPanel(libraryManager, audioEngine),
      versionList(libraryManager, audioEngine),
      waveform(audioEngine),
      transport(audioEngine),
      lufsMeter(audioEngine.getMeteringEngine()),
      truePeakMeter(audioEngine.getMeteringEngine()),
      spectrumAnalyzer(audioEngine.getMeteringEngine()),
      goniometer(audioEngine.getMeteringEngine())
{
    setSize(1400, 720);
    setWantsKeyboardFocus(true);

    // Subscribe to library events
    libraryManager.addListener(this);

    // Add all components
    addAndMakeVisible(libraryPanel);
    addAndMakeVisible(versionList);
    addAndMakeVisible(waveform);
    addAndMakeVisible(transport);
    addAndMakeVisible(lufsMeter);
    addAndMakeVisible(truePeakMeter);
    addAndMakeVisible(spectrumAnalyzer);
    addAndMakeVisible(goniometer);
    addAndMakeVisible(trackTitleLabel);

    // Master fader
    addAndMakeVisible(masterFader);
    addAndMakeVisible(masterFaderLabel);

    masterFaderLabel.setText("MASTER", juce::dontSendNotification);
    masterFaderLabel.setFont(juce::Font(juce::FontOptions("SF Pro Display", 10.0f, juce::Font::bold)));
    masterFaderLabel.setColour(juce::Label::textColourId, juce::Colour(0xff888888));
    masterFaderLabel.setJustificationType(juce::Justification::centred);

    // Load fader thumb image from app bundle Resources
    {
        juce::File bundleResources = juce::File::getSpecialLocation(juce::File::currentApplicationFile)
                                         .getChildFile("Contents/Resources");
        juce::File faderFile = bundleResources.getChildFile("fader.png");
        if (faderFile.existsAsFile())
            faderLAF.thumbImage = juce::ImageFileFormat::loadFrom(faderFile);
    }
    masterFader.setLookAndFeel(&faderLAF);

    masterFader.setRange(0.0, 1.0, 0.001);
    masterFader.setValue(1.0, juce::dontSendNotification);
    masterFader.setSkewFactorFromMidPoint(0.5);
    masterFader.onValueChange = [this]()
    {
        audioEngine.setMasterGain((float)masterFader.getValue());
    };

    // Track title label
    trackTitleLabel.setFont(juce::Font(juce::FontOptions("SF Pro Display", 16.0f, juce::Font::bold)));
    trackTitleLabel.setColour(juce::Label::textColourId, juce::Colours::white);
    trackTitleLabel.setJustificationType(juce::Justification::centredLeft);
    trackTitleLabel.setText("MasterRef", juce::dontSendNotification);

    // Waveform loop callback — loop points and enabled state are set directly
    // in WaveformComponent; this callback is available for any additional UI sync
    waveform.onLoopPointsChanged = [](double, double) {};

    // Update waveform when version switches
    audioEngine.onVersionChanged = [this](const juce::File& file)
    {
        waveform.loadFile(file);
    };

    // Update version list highlight when version switches (e.g. via keyboard shortcut)
    audioEngine.onVersionIndexChanged = [this](int /*index*/)
    {
        versionList.repaintVersionList();
    };

    // Version list is always visible (fixed right panel)
    versionList.setVisible(true);

    setupLookAndFeel();

    startTimerHz(30);

    // Sync UI with any library state restored from disk
    libraryChanged();
}

MainComponent::~MainComponent()
{
    stopTimer();
    libraryManager.removeListener(this);
    masterFader.setLookAndFeel(nullptr);
}

void MainComponent::setupLookAndFeel()
{
    auto& lf = getLookAndFeel();
    lf.setColour(juce::TextButton::buttonColourId,    juce::Colour(0xff1a1a1a));
    lf.setColour(juce::TextButton::buttonOnColourId,  juce::Colour(0xff252525));
    lf.setColour(juce::TextButton::textColourOffId,   juce::Colours::white);
    lf.setColour(juce::TextButton::textColourOnId,    juce::Colour(0xff00aaff));
    lf.setColour(juce::ToggleButton::textColourId,    juce::Colour(0xff888888));
    lf.setColour(juce::ScrollBar::thumbColourId,      juce::Colour(0xff2a2a2a));
}

//==============================================================================
// Layout constants for 1080x480 window
// Library: 240px | Main: 839px
// Header: title(24) + transport(40) = 66px
// Waveform: availH/6, Spectrum: availH/3, Bottom row: remainder
// Bottom columns: gonio(square) | lufs(160) | tp(110) | versions(remaining, right-aligned)
static constexpr int kLibraryW   = 240;
static constexpr int kTitleH     = 24;
static constexpr int kTransportH = 40;
static constexpr int kTimecodeH  = 26;  // timecode strip below waveform
static constexpr int kLufsW      = 240;  // was 160, ×1.5
static constexpr int kTpW        = 165;  // was 110, ×1.5
static constexpr int kFaderW     = 60;   // master fader
static constexpr int kVersionW   = 240;
// waveformH = availH/6, spectrumH = availH/3, gonioH = remainder, gonioW fills up to LUFS

void MainComponent::paint(juce::Graphics& g)
{
    g.fillAll(juce::Colour(0xff080808));

    int w = getWidth();
    int h = getHeight();

    int mainX    = kLibraryW + 1;
    int contentY = kTitleH + 1 + kTransportH + 1;

    int availH    = h - contentY;
    int waveformH = availH / 6;
    int spectrumH = availH / 3;

    int timecodeY = contentY + waveformH + 1;
    int spectrumY = timecodeY + kTimecodeH + 1;
    int gonioY    = spectrumY + spectrumH + 1;

    int verX   = w - kVersionW;
    int faderX = verX - kFaderW;
    int tpX    = faderX - kTpW;
    int lufsX  = tpX  - kLufsW;

    g.setColour(juce::Colour(0xff1e1e1e));
    g.drawVerticalLine(kLibraryW, 0.0f, (float)h);
    g.drawHorizontalLine(timecodeY - 1, (float)mainX, (float)w);
    g.drawHorizontalLine(spectrumY - 1, (float)mainX, (float)w);
    g.drawHorizontalLine(gonioY   - 1, (float)mainX, (float)w);
    g.drawVerticalLine(lufsX,   (float)gonioY, (float)h);
    g.drawVerticalLine(tpX,     (float)gonioY, (float)h);
    g.drawVerticalLine(faderX,  (float)gonioY, (float)h);
    g.drawVerticalLine(verX,    (float)gonioY, (float)h);
}

void MainComponent::resized()
{
    int w = getWidth();
    int h = getHeight();

    int mainX    = kLibraryW + 1;
    int contentY = kTitleH + 1 + kTransportH + 1;
    int totalW   = w - mainX;

    int availH    = h - contentY;
    int waveformH = availH / 6;
    int spectrumH = availH / 3;
    int gonioH    = availH - waveformH - kTimecodeH - spectrumH - 3; // bottom row height

    int waveformY  = contentY;
    int timecodeY  = waveformY + waveformH + 1;
    int spectrumY  = timecodeY + kTimecodeH + 1;
    int gonioY     = spectrumY + spectrumH + 1;

    int verX   = w - kVersionW;
    int faderX = verX - kFaderW  - 1;
    int tpX    = faderX - kTpW   - 1;
    int lufsX  = tpX  - kLufsW  - 1;
    int gonioW = lufsX - mainX - 1; // fill all space between library and LUFS

    // --- Library panel ---
    libraryPanel.setBounds(0, 0, kLibraryW, h);

    // --- Title strip ---
    trackTitleLabel.setBounds(mainX + 6, 2, totalW - 12, kTitleH - 2);

    // --- Transport bar ---
    transport.setBounds(mainX, kTitleH + 1, totalW, kTransportH);

    // --- Waveform (full width) ---
    waveform.setBounds(mainX, waveformY, totalW, waveformH);

    // --- Spectrum Analyzer (full width) ---
    spectrumAnalyzer.setBounds(mainX, spectrumY, totalW, spectrumH);

    // --- Bottom row: Goniometer | LUFS | TruePeak | MasterFader | Versions ---
    goniometer.setBounds(mainX,    gonioY, gonioW,    gonioH);
    lufsMeter.setBounds(lufsX,     gonioY, kLufsW,    gonioH);
    truePeakMeter.setBounds(tpX,   gonioY, kTpW,      gonioH);

    // Master fader: label at top, slider fills remaining height
    static constexpr int faderLabelH = 20;
    masterFaderLabel.setBounds(faderX, gonioY, kFaderW, faderLabelH);
    masterFader.setBounds(faderX, gonioY + faderLabelH, kFaderW, gonioH - faderLabelH);

    versionList.setBounds(verX,    gonioY, kVersionW, gonioH);
}

bool MainComponent::keyPressed(const juce::KeyPress& key)
{
    if (key == juce::KeyPress::spaceKey)
    {
        if (audioEngine.isPlaying())
        {
            audioEngine.pause();
        }
        else
        {
            if (audioEngine.isLoopEnabled()
                && audioEngine.getLoopOut() > audioEngine.getLoopIn())
            {
                audioEngine.setPosition(audioEngine.getLoopIn());
            }
            audioEngine.play();
        }
        return true;
    }

    if (key == juce::KeyPress::returnKey)
    {
        audioEngine.setPosition(0.0);
        return true;
    }

    if (key == juce::KeyPress::leftKey)
    {
        double pos = juce::jmax(0.0, audioEngine.getCurrentPosition() - 5.0);
        audioEngine.setPosition(pos);
        return true;
    }

    if (key == juce::KeyPress::rightKey)
    {
        double len = audioEngine.getLengthInSeconds();
        double pos = juce::jmin(len, audioEngine.getCurrentPosition() + 5.0);
        audioEngine.setPosition(pos);
        return true;
    }

    // Number keys 1-9 and 0 → switch to version 0-8 and 9
    {
        int vIdx = -1;
        if (key == juce::KeyPress('1')) vIdx = 0;
        else if (key == juce::KeyPress('2')) vIdx = 1;
        else if (key == juce::KeyPress('3')) vIdx = 2;
        else if (key == juce::KeyPress('4')) vIdx = 3;
        else if (key == juce::KeyPress('5')) vIdx = 4;
        else if (key == juce::KeyPress('6')) vIdx = 5;
        else if (key == juce::KeyPress('7')) vIdx = 6;
        else if (key == juce::KeyPress('8')) vIdx = 7;
        else if (key == juce::KeyPress('9')) vIdx = 8;
        else if (key == juce::KeyPress('0')) vIdx = 9;

        if (vIdx >= 0)
        {
            auto& vm = audioEngine.getVersionManager();
            if (vIdx < vm.getNumVersions())
            {
                audioEngine.switchToVersion(vIdx);
                return true;
            }
        }
    }

    return false;
}

void MainComponent::openFile(const juce::File& file)
{
    libraryManager.addTrack(file);
}

void MainComponent::libraryChanged()
{
    int activeIdx = libraryManager.getActiveTrackIndex();

    if (activeIdx >= 0 && activeIdx < libraryManager.getNumTracks())
    {
        const auto& track = libraryManager.getTrack(activeIdx);
        trackTitleLabel.setText(track.displayName, juce::dontSendNotification);

        // Always load versions for the active track so the engine plays the correct file.
        audioEngine.loadVersions(track);

        // Load waveform: use active version if loaded, else first version, else primary file
        juce::File waveFile;
        if (track.hasVersions())
        {
            int activeVer = audioEngine.getVersionManager().getActiveVersionIndex();
            int verIdx = juce::jlimit(0, (int)track.versions.size() - 1, activeVer);
            waveFile = track.versions[(size_t)verIdx].file;
        }
        else
        {
            waveFile = track.primaryFile;
        }

        if (waveFile.existsAsFile())
            waveform.loadFile(waveFile);

        // Always update version list (panel is always visible)
        versionList.setTrackIndex(activeIdx);
    }
    else
    {
        trackTitleLabel.setText("MasterRef", juce::dontSendNotification);
        versionList.setTrackIndex(-1);
        // Ensure the audio engine is also cleared when no track is active
        audioEngine.unloadAll();
    }

    resized();
}

void MainComponent::updateVersionListVisibility()
{
    resized();
}

void MainComponent::timerCallback()
{
}

