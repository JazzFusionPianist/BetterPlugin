#pragma once
#include <JuceHeader.h>
#include "VersionManager.h"
#include "MeteringEngine.h"

//==============================================================================
class AudioEngine : public juce::AudioAppComponent
{
public:
    AudioEngine();
    ~AudioEngine() override;

    //--- AudioAppComponent ---
    void prepareToPlay(int samplesPerBlockExpected, double sampleRate) override;
    void getNextAudioBlock(const juce::AudioSourceChannelInfo& bufferToFill) override;
    void releaseResources() override;

    //--- Transport ---
    void play();
    void pause();
    void stop();
    void setPosition(double positionSeconds);
    double getCurrentPosition() const { return displayPosition.load(); }
    double getLengthInSeconds() const;
    bool isPlaying() const { return playing.load(); }

    //--- Loop ---
    void setLoopEnabled(bool enabled);
    bool isLoopEnabled() const { return loopEnabled; }
    void setLoopPoints(double inPoint, double outPoint);
    double getLoopIn()  const { return loopInPoint; }
    double getLoopOut() const { return loopOutPoint; }

    //--- Mono toggle ---
    void setMonoEnabled(bool enabled);
    bool isMonoEnabled() const { return monoEnabled; }

    //--- Master fader ---
    void setMasterGain(float gainLinear);
    float getMasterGain() const { return masterGain.load(); }

    //--- Source management ---
    void loadFile(const juce::File& file);
    void loadVersions(const Track& track);
    void switchToVersion(int index);
    void unloadAll();

    //--- Accessors ---
    VersionManager& getVersionManager() { return versionManager; }
    MeteringEngine& getMeteringEngine()  { return meteringEngine; }
    juce::AudioTransportSource& getTransportSource() { return transportSource; }
    juce::AudioFormatManager& getFormatManager() { return formatManager; }
    juce::AudioThumbnailCache& getThumbnailCache() { return thumbnailCache; }

    // Called after version switches so the UI can update the waveform
    std::function<void(const juce::File&)> onVersionChanged;

    // Called after any version switch (index) — for UI highlight updates
    std::function<void(int)> onVersionIndexChanged;

private:
    juce::AudioFormatManager formatManager;
    juce::AudioTransportSource transportSource;
    juce::AudioThumbnailCache thumbnailCache { 5 };

    VersionManager versionManager;
    MeteringEngine meteringEngine;

    std::atomic<bool>   playing         { false };
    std::atomic<double> displayPosition { 0.0 };
    std::atomic<bool>  monoEnabled  { false };
    std::atomic<float> masterGain   { 1.0f };
    bool loopEnabled = false;
    double loopInPoint  = 0.0;
    double loopOutPoint = 0.0;

    double currentSampleRate = 44100.0;
    int currentBlockSize = 512;

    JUCE_DECLARE_NON_COPYABLE_WITH_LEAK_DETECTOR(AudioEngine)
};
