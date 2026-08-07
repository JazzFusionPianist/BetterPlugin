#pragma once

#include <atomic>
#include <memory>
#include <juce_audio_formats/juce_audio_formats.h>
#include <juce_audio_processors/juce_audio_processors.h>
#include <juce_events/juce_events.h>
#include "StemLinkRegistry.h"

class StemLinkAudioProcessor final : public juce::AudioProcessor,
                                     private juce::Timer
{
public:
    StemLinkAudioProcessor();
    ~StemLinkAudioProcessor() override;

    void prepareToPlay (double sampleRate, int) override;
    void releaseResources() override;
    bool isBusesLayoutSupported (const BusesLayout&) const override;
    void processBlock (juce::AudioBuffer<float>&, juce::MidiBuffer&) override;

    juce::AudioProcessorEditor* createEditor() override;
    bool hasEditor() const override { return true; }

    const juce::String getName() const override { return "Orb StemLink"; }
    bool acceptsMidi() const override { return false; }
    bool producesMidi() const override { return false; }
    bool isMidiEffect() const override { return false; }
    double getTailLengthSeconds() const override { return 0.0; }

    int getNumPrograms() override { return 1; }
    int getCurrentProgram() override { return 0; }
    void setCurrentProgram (int) override {}
    const juce::String getProgramName (int) override { return {}; }
    void changeProgramName (int, const juce::String&) override {}

    void getStateInformation (juce::MemoryBlock&) override {}
    void setStateInformation (const void*, int) override {}
    void updateTrackProperties (const TrackProperties&) override;

    juce::String getTrackName() const;
    juce::Colour getTrackColour() const;
    juce::String getHostName() const { return hostName; }
    juce::String getCaptureStatus() const;

private:
    enum class CaptureState { idle, armed, recording, finishing, complete, error };
    void timerCallback() override;
    bool armExport (const StemLinkRegistry::ExportRequest&);
    void publishCaptureStatus (const juce::String& status, const juce::String& message = {});
    void finishRecording();

    mutable juce::CriticalSection propertyLock;
    juce::String trackName { "Waiting for track name…" };
    juce::Colour trackColour { 0xff7c6cff };
    juce::String hostName;
    StemLinkRegistry::Publisher publisher;

    juce::TimeSliceThread writerThread { "Orb StemLink WAV writer" };
    juce::SpinLock writerLock;
    std::unique_ptr<juce::AudioFormatWriter::ThreadedWriter> threadedWriter;
    std::unique_ptr<juce::AudioFormatWriter> offlineWriter;
    juce::File captureFile;
    StemLinkRegistry::ExportRequest currentRequest;
    juce::String lastHandledRequestId;
    std::atomic<CaptureState> captureState { CaptureState::idle };
    std::atomic<juce::int64> samplesWritten { 0 };
    std::atomic<juce::int64> sourceStartSamples { 0 };
    std::atomic<juce::int64> lastPlayheadSamples { 0 };
    std::atomic<juce::int64> lastAudioBlockAtMs { 0 };
    std::atomic<bool> statusDirty { false };
    std::atomic<bool> lastBlockWasOffline { false };
    std::atomic<bool> captureEntireSession { false };
    std::atomic<double> sourcePpq { 0.0 };
    std::atomic<double> sourceBpm { 120.0 };
    std::atomic<int> sourceTimeSigNumerator { 4 };
    std::atomic<int> sourceTimeSigDenominator { 4 };
    double captureSampleRate = 44100.0;
    int captureChannels = 2;
    juce::int64 processorStartedAtMs = 0;
    juce::int64 lastHeartbeatMs = 0;

    JUCE_DECLARE_NON_COPYABLE_WITH_LEAK_DETECTOR (StemLinkAudioProcessor)
};
