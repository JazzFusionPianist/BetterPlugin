#include "StemLinkProcessor.h"
#include "StemLinkEditor.h"

StemLinkAudioProcessor::StemLinkAudioProcessor()
    : AudioProcessor (BusesProperties()
        .withInput ("Input", juce::AudioChannelSet::stereo(), true)
        .withOutput ("Output", juce::AudioChannelSet::stereo(), true)),
      hostName (juce::PluginHostType().getHostDescription())
{
    processorStartedAtMs = juce::Time::currentTimeMillis();
    writerThread.startThread();
    startTimer (250);
}

StemLinkAudioProcessor::~StemLinkAudioProcessor()
{
    stopTimer();
    if (captureState.load() == CaptureState::armed
        || captureState.load() == CaptureState::recording)
        captureState.store (CaptureState::finishing);
    finishRecording();
    writerThread.stopThread (5000);
}

void StemLinkAudioProcessor::prepareToPlay (double sampleRate, int)
{
    captureSampleRate = sampleRate > 0.0 ? sampleRate : 44100.0;
    captureChannels = juce::jlimit (1, 2, getTotalNumInputChannels());
}

void StemLinkAudioProcessor::releaseResources()
{
    if (captureState.load() == CaptureState::recording)
        captureState.store (CaptureState::finishing);
}

bool StemLinkAudioProcessor::isBusesLayoutSupported (const BusesLayout& layouts) const
{
    const auto output = layouts.getMainOutputChannelSet();
    return output == layouts.getMainInputChannelSet()
        && (output == juce::AudioChannelSet::mono()
            || output == juce::AudioChannelSet::stereo());
}

void StemLinkAudioProcessor::processBlock (juce::AudioBuffer<float>& buffer,
                                           juce::MidiBuffer&)
{
    bool playing = false;
    juce::int64 playheadSamples = lastPlayheadSamples.load();
    if (auto* playhead = getPlayHead())
    {
        if (const auto position = playhead->getPosition())
        {
            playing = position->getIsPlaying();
            if (const auto samples = position->getTimeInSamples())
                playheadSamples = *samples;
        }
    }

    auto state = captureState.load();
    if (state == CaptureState::armed && playing)
    {
        sourceStartSamples.store (playheadSamples);
        samplesWritten.store (0);
        captureState.store (CaptureState::recording);
        statusDirty.store (true);
        state = CaptureState::recording;
    }

    if (state == CaptureState::recording)
    {
        const auto previous = lastPlayheadSamples.load();
        if (! playing || (samplesWritten.load() > 0 && playheadSamples < previous))
        {
            captureState.store (CaptureState::finishing);
        }
        else
        {
            const juce::SpinLock::ScopedTryLockType lock (writerLock);
            if (lock.isLocked() && threadedWriter != nullptr)
            {
                const int channels = juce::jmin (captureChannels, buffer.getNumChannels());
                const float* channelData[2] { nullptr, nullptr };
                for (int channel = 0; channel < channels; ++channel)
                    channelData[channel] = buffer.getReadPointer (channel);
                if (channels == 1 && captureChannels == 2)
                    channelData[1] = channelData[0];
                if (threadedWriter->write (channelData, buffer.getNumSamples()))
                    samplesWritten.fetch_add (buffer.getNumSamples());
                else
                    captureState.store (CaptureState::error);
            }
        }
    }
    lastPlayheadSamples.store (playheadSamples);
}

juce::AudioProcessorEditor* StemLinkAudioProcessor::createEditor()
{
    return new StemLinkAudioProcessorEditor (*this);
}

void StemLinkAudioProcessor::updateTrackProperties (const TrackProperties& properties)
{
    juce::String publishedName;
    juce::String publishedColour;
    {
        const juce::ScopedLock lock (propertyLock);
        if (properties.name.has_value() && properties.name->trim().isNotEmpty())
            trackName = properties.name->trim();
        if (properties.colourARGB.has_value())
            trackColour = juce::Colour (*properties.colourARGB);
        publishedName = trackName;
        publishedColour = trackColour.toDisplayString (false);
    }
    publisher.update (publishedName, publishedColour);
}

juce::String StemLinkAudioProcessor::getTrackName() const
{
    const juce::ScopedLock lock (propertyLock);
    return trackName;
}

juce::Colour StemLinkAudioProcessor::getTrackColour() const
{
    const juce::ScopedLock lock (propertyLock);
    return trackColour;
}

juce::String StemLinkAudioProcessor::getCaptureStatus() const
{
    switch (captureState.load())
    {
        case CaptureState::armed: return "Armed · press Play in the DAW";
        case CaptureState::recording: return "Recording · stop when the range ends";
        case CaptureState::finishing: return "Finishing WAV…";
        case CaptureState::complete: return "Shared capture ready";
        case CaptureState::error: return "Capture failed";
        case CaptureState::idle: break;
    }
    return "Linked to Orb · " + hostName;
}

bool StemLinkAudioProcessor::armExport (const StemLinkRegistry::ExportRequest& request)
{
    captureFile = StemLinkRegistry::getExportAudioFile (request.id, request.instanceId, request.trackName);
    if (captureFile == juce::File()) return false;
    captureFile.getParentDirectory().createDirectory();
    captureFile.deleteFile();

    std::unique_ptr<juce::OutputStream> stream (captureFile.createOutputStream());
    if (stream == nullptr) return false;
    juce::WavAudioFormat format;
    auto options = juce::AudioFormatWriterOptions()
        .withSampleRate (captureSampleRate)
        .withNumChannels (captureChannels)
        .withBitsPerSample (24)
        .withSampleFormat (juce::AudioFormatWriterOptions::SampleFormat::integral);
    auto writer = format.createWriterFor (stream, options);
    if (writer == nullptr) return false;

    {
        const juce::SpinLock::ScopedLockType lock (writerLock);
        threadedWriter = std::make_unique<juce::AudioFormatWriter::ThreadedWriter> (
            writer.release(), writerThread, juce::jmax (32768, (int) captureSampleRate * 2));
    }
    currentRequest = request;
    lastHandledRequestId = request.id;
    samplesWritten.store (0);
    sourceStartSamples.store (0);
    captureState.store (CaptureState::armed);
    publishCaptureStatus ("armed", "Ready — press Play in the DAW.");
    return true;
}

void StemLinkAudioProcessor::publishCaptureStatus (const juce::String& status,
                                                    const juce::String& message)
{
    if (currentRequest.id.isEmpty()) return;
    auto object = new juce::DynamicObject();
    object->setProperty ("status", status);
    object->setProperty ("message", message);
    object->setProperty ("samplesWritten", samplesWritten.load());
    StemLinkRegistry::writeExportStatus (currentRequest.id, currentRequest.instanceId,
                                         juce::var (object));
}

void StemLinkAudioProcessor::finishRecording()
{
    const auto state = captureState.load();
    if (state != CaptureState::finishing && state != CaptureState::error) return;
    {
        const juce::SpinLock::ScopedLockType lock (writerLock);
        threadedWriter.reset();
    }

    if (state == CaptureState::error || samplesWritten.load() <= 0 || ! captureFile.existsAsFile())
    {
        captureState.store (CaptureState::error);
        publishCaptureStatus ("error", "StemLink could not record this track.");
        return;
    }

    auto file = new juce::DynamicObject();
    file->setProperty ("path", captureFile.getFullPathName());
    file->setProperty ("name", captureFile.getFileName());
    file->setProperty ("size", captureFile.getSize());
    file->setProperty ("mimeType", "audio/wav");
    file->setProperty ("sampleRate", captureSampleRate);
    file->setProperty ("bitDepth", 24);
    file->setProperty ("sourceSamples", sourceStartSamples.load());

    auto object = new juce::DynamicObject();
    object->setProperty ("status", "complete");
    object->setProperty ("message", "Stem captured");
    object->setProperty ("samplesWritten", samplesWritten.load());
    object->setProperty ("file", juce::var (file));
    StemLinkRegistry::writeExportStatus (currentRequest.id, currentRequest.instanceId,
                                         juce::var (object));
    captureState.store (CaptureState::complete);
}

void StemLinkAudioProcessor::timerCallback()
{
    const auto now = juce::Time::currentTimeMillis();
    if (now - lastHeartbeatMs >= 2000)
    {
        publisher.heartbeat();
        lastHeartbeatMs = now;
    }

    if (captureState.load() == CaptureState::finishing
        || captureState.load() == CaptureState::error)
        finishRecording();

    if (statusDirty.exchange (false))
        publishCaptureStatus ("recording", "Recording this track…");

    const auto state = captureState.load();
    if (state == CaptureState::idle || state == CaptureState::complete)
    {
        if (const auto request = StemLinkRegistry::getPendingExportRequest (
                hostName, publisher.getId(), lastHandledRequestId, processorStartedAtMs))
        {
            if (! armExport (*request))
            {
                currentRequest = *request;
                lastHandledRequestId = request->id;
                captureState.store (CaptureState::error);
                publishCaptureStatus ("error", "Could not create the WAV file.");
            }
        }
    }
}

juce::AudioProcessor* JUCE_CALLTYPE createPluginFilter()
{
    return new StemLinkAudioProcessor();
}
