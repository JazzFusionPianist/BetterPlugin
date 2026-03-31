#include "AudioEngine.h"

AudioEngine::AudioEngine()
{
    formatManager.registerBasicFormats();

    // Request stereo output, no input needed
    setAudioChannels(0, 2);
}

AudioEngine::~AudioEngine()
{
    shutdownAudio();
    transportSource.setSource(nullptr);
}

void AudioEngine::prepareToPlay(int samplesPerBlockExpected, double sampleRate)
{
    currentSampleRate = sampleRate;
    currentBlockSize  = samplesPerBlockExpected;

    transportSource.prepareToPlay(samplesPerBlockExpected, sampleRate);
    meteringEngine.prepare(sampleRate, samplesPerBlockExpected);
}

void AudioEngine::getNextAudioBlock(const juce::AudioSourceChannelInfo& bufferToFill)
{
    if (!playing.load())
    {
        bufferToFill.clearActiveBufferRegion();
        return;
    }

    // Snapshot position BEFORE advancing (so UI shows where audio starts, not ends)
    displayPosition.store(transportSource.getCurrentPosition());

    transportSource.getNextAudioBlock(bufferToFill);

    // Handle loop
    if (loopEnabled && loopOutPoint > loopInPoint)
    {
        double pos = transportSource.getCurrentPosition();
        if (pos >= loopOutPoint)
            transportSource.setPosition(loopInPoint);
    }

    // Check if reached end of file
    if (transportSource.hasStreamFinished())
    {
        if (loopEnabled)
            transportSource.setPosition(loopInPoint > 0.0 ? loopInPoint : 0.0);
        else
        {
            playing.store(false);
            displayPosition.store(0.0);
            transportSource.stop();
            transportSource.setPosition(0.0);
        }
    }

    // Mono downmix
    auto* buffer = bufferToFill.buffer;
    int startSample = bufferToFill.startSample;
    int numSamples  = bufferToFill.numSamples;

    if (monoEnabled.load() && buffer->getNumChannels() >= 2)
    {
        for (int i = 0; i < numSamples; ++i)
        {
            float L = buffer->getSample(0, startSample + i);
            float R = buffer->getSample(1, startSample + i);
            float mid = (L + R) * 0.5f;
            buffer->setSample(0, startSample + i, mid);
            buffer->setSample(1, startSample + i, mid);
        }
    }

    // Apply master gain
    float gain = masterGain.load();
    if (gain != 1.0f)
        buffer->applyGain(startSample, numSamples, gain);

    // Feed metering
    juce::AudioBuffer<float> meteringView(buffer->getArrayOfWritePointers(),
                                          buffer->getNumChannels(),
                                          startSample,
                                          numSamples);
    meteringEngine.processBlock(meteringView);
}

void AudioEngine::releaseResources()
{
    transportSource.releaseResources();
}

//--- Transport ---
void AudioEngine::play()
{
    playing.store(true);
    transportSource.start();
}

void AudioEngine::pause()
{
    // Freeze display position at the current moment, then gate the audio thread immediately.
    // Do NOT call transportSource.stop() — it blocks the main thread up to ~1 second
    // (500 × Thread::sleep(2ms)) waiting for the audio thread to set its internal stopped flag.
    // Our playing=false gate in getNextAudioBlock silences the output in the very next block,
    // and JUCE's audio thread will finish naturally without any blocking wait here.
    displayPosition.store(transportSource.getCurrentPosition());
    playing.store(false);
}

void AudioEngine::stop()
{
    playing.store(false);
    displayPosition.store(0.0);
    transportSource.stop();
    transportSource.setPosition(0.0);
}

void AudioEngine::setPosition(double positionSeconds)
{
    displayPosition.store(positionSeconds);
    transportSource.setPosition(positionSeconds);
}


double AudioEngine::getLengthInSeconds() const
{
    return transportSource.getLengthInSeconds();
}


//--- Loop ---
void AudioEngine::setLoopEnabled(bool enabled)
{
    loopEnabled = enabled;
}

void AudioEngine::setLoopPoints(double inPoint, double outPoint)
{
    loopInPoint  = inPoint;
    loopOutPoint = outPoint;
}

//--- Mono ---
void AudioEngine::setMonoEnabled(bool enabled)
{
    monoEnabled.store(enabled);
}

//--- Master fader ---
void AudioEngine::setMasterGain(float gainLinear)
{
    masterGain.store(gainLinear);
}

//--- Source management ---
void AudioEngine::loadFile(const juce::File& file)
{
    transportSource.stop();
    transportSource.setSource(nullptr);
    versionManager.clearVersions();

    Track t(file);
    versionManager.loadVersions(t, formatManager, transportSource);

    if (currentSampleRate > 0.0 && currentBlockSize > 0)
        transportSource.prepareToPlay(currentBlockSize, currentSampleRate);

    meteringEngine.resetIntegrated();
}

void AudioEngine::loadVersions(const Track& track)
{
    transportSource.stop();
    transportSource.setSource(nullptr);
    versionManager.clearVersions();

    versionManager.loadVersions(track, formatManager, transportSource);

    // Re-prepare transport now that we have a new source
    if (currentSampleRate > 0.0 && currentBlockSize > 0)
        transportSource.prepareToPlay(currentBlockSize, currentSampleRate);

    meteringEngine.resetIntegrated();
}

void AudioEngine::switchToVersion(int index)
{
    versionManager.switchToVersion(index, transportSource);
    meteringEngine.resetIntegrated();

    if (onVersionChanged)
    {
        juce::File f = versionManager.getVersionFile(index);
        if (f.existsAsFile())
            onVersionChanged(f);
    }

    if (onVersionIndexChanged)
        onVersionIndexChanged(index);
}

void AudioEngine::unloadAll()
{
    transportSource.stop();
    transportSource.setSource(nullptr);
    versionManager.clearVersions();
    meteringEngine.reset();
}
