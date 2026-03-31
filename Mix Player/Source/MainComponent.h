#pragma once

#include <JuceHeader.h>

#include "AudioEngine.h"
#include "LibraryManager.h"
#include "LibraryPanelComponent.h"
#include "VersionListComponent.h"
#include "WaveformComponent.h"
#include "TransportComponent.h"
#include "LUFSMeterComponent.h"
#include "TruePeakMeterComponent.h"
#include "SpectrumAnalyzerComponent.h"
#include "GoniometerComponent.h"

//==============================================================================
class MainComponent : public juce::Component,
                      public LibraryManager::Listener,
                      public juce::Timer
{
public:
    MainComponent();
    ~MainComponent() override;

    void paint(juce::Graphics& g) override;
    void resized() override;

    bool keyPressed(const juce::KeyPress& key) override;

    // Called by the application when a file is opened via Finder "Open With"
    void openFile(const juce::File& file);

    // Accessors for the mini player popup
    AudioEngine&    getAudioEngine()    { return audioEngine; }
    LibraryManager& getLibraryManager() { return libraryManager; }

    // LibraryManager::Listener
    void libraryChanged() override;

private:
    // Core systems
    AudioEngine      audioEngine;
    LibraryManager   libraryManager;

    // UI Components
    LibraryPanelComponent   libraryPanel;
    VersionListComponent    versionList;
    WaveformComponent       waveform;
    TransportComponent      transport;
    LUFSMeterComponent      lufsMeter;
    TruePeakMeterComponent  truePeakMeter;
    SpectrumAnalyzerComponent spectrumAnalyzer;
    GoniometerComponent     goniometer;

    // Custom LookAndFeel that draws the fader thumb using fader.png
    struct FaderLookAndFeel : public juce::LookAndFeel_V4
    {
        juce::Image thumbImage;

        // Scaled draw size: original / 3
        static constexpr int kThumbW = 21;  // ceil(63 / 3)
        static constexpr int kThumbH = 43;  // ceil(130 / 3)

        // Tell JUCE to shrink the travel range so the image stays clear of the
        // track edges. Half thumb height + 6px extra padding top and bottom.
        int getSliderThumbRadius(juce::Slider&) override
        {
            return kThumbH / 2 + 6;
        }

        void drawLinearSliderThumb(juce::Graphics& g, int x, int y, int width, int height,
                                   float sliderPos, float /*minSliderPos*/, float /*maxSliderPos*/,
                                   juce::Slider::SliderStyle, juce::Slider& /*slider*/) override
        {
            float cx = (float)x + (float)width * 0.5f;
            float cy = sliderPos;

            if (thumbImage.isValid())
            {
                // Draw at 1/3 of original size, centred on sliderPos
                g.drawImage(thumbImage,
                            (int)(cx - kThumbW * 0.5f), (int)(cy - kThumbH * 0.5f),
                            kThumbW, kThumbH,
                            0, 0,
                            thumbImage.getWidth(), thumbImage.getHeight());
            }
            else
            {
                // Fallback: plain rectangle thumb
                float tw = (float)width - 4.0f;
                float th = (float)kThumbH;
                g.setColour(juce::Colour(0xffaaaaaa));
                g.fillRoundedRectangle(cx - tw * 0.5f, cy - th * 0.5f, tw, th, 3.0f);
            }
        }

        void drawLinearSlider(juce::Graphics& g, int x, int y, int width, int height,
                              float sliderPos, float minSliderPos, float maxSliderPos,
                              juce::Slider::SliderStyle style, juce::Slider& slider) override
        {
            // Track background (only between the two extreme thumb positions)
            float trackW = 4.0f;
            float cx = (float)x + (float)width * 0.5f;
            g.setColour(juce::Colour(0xff1e1e1e));
            g.fillRoundedRectangle(cx - trackW * 0.5f, (float)y, trackW, (float)height, 2.0f);

            // Filled portion (from current thumb centre down to bottom of track)
            g.setColour(juce::Colour(0xff00aaff));
            float fillBot = (float)(y + height);
            if (fillBot > sliderPos)
                g.fillRoundedRectangle(cx - trackW * 0.5f, sliderPos, trackW, fillBot - sliderPos, 2.0f);

            // Thumb
            drawLinearSliderThumb(g, x, y, width, height,
                                  sliderPos, minSliderPos, maxSliderPos, style, slider);
        }
    };

    FaderLookAndFeel faderLAF;

    // Master fader
    juce::Slider masterFader { juce::Slider::LinearVertical, juce::Slider::NoTextBox };
    juce::Label  masterFaderLabel;

    // Track title label
    juce::Label trackTitleLabel;

    void timerCallback() override;

    void onLibraryTrackLoaded(int trackIndex);
    void updateVersionListVisibility();
    void setupLookAndFeel();

    JUCE_DECLARE_NON_COPYABLE_WITH_LEAK_DETECTOR(MainComponent)
};
