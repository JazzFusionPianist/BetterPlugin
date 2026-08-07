#include "StemLinkProcessor.h"
#include "StemLinkEditor.h"

StemLinkAudioProcessor::StemLinkAudioProcessor()
    : AudioProcessor (BusesProperties()
        .withInput ("Input", juce::AudioChannelSet::stereo(), true)
        .withOutput ("Output", juce::AudioChannelSet::stereo(), true)),
      hostName (juce::PluginHostType().getHostDescription())
{
    startTimer (2000);
}

StemLinkAudioProcessor::~StemLinkAudioProcessor()
{
    stopTimer();
}

bool StemLinkAudioProcessor::isBusesLayoutSupported (const BusesLayout& layouts) const
{
    const auto output = layouts.getMainOutputChannelSet();
    return output == layouts.getMainInputChannelSet()
        && (output == juce::AudioChannelSet::mono()
            || output == juce::AudioChannelSet::stereo());
}

void StemLinkAudioProcessor::processBlock (juce::AudioBuffer<float>&,
                                           juce::MidiBuffer&)
{
    // Intentional transparent pass-through. StemLink only publishes the host's
    // track identity; it never changes, captures, or copies audio on this path.
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

void StemLinkAudioProcessor::timerCallback()
{
    publisher.heartbeat();
}

juce::AudioProcessor* JUCE_CALLTYPE createPluginFilter()
{
    return new StemLinkAudioProcessor();
}
