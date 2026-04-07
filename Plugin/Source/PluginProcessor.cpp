#include "PluginProcessor.h"
#include "PluginEditor.h"

//==============================================================================
CoOpAudioProcessor::CoOpAudioProcessor()
    : AudioProcessor (BusesProperties()
          .withInput  ("Input",  juce::AudioChannelSet::stereo(), true)
          .withOutput ("Output", juce::AudioChannelSet::stereo(), true))
{
}

//==============================================================================
void CoOpAudioProcessor::prepareToPlay (double, int) {}
void CoOpAudioProcessor::releaseResources() {}

bool CoOpAudioProcessor::isBusesLayoutSupported (const BusesLayout& layouts) const
{
    // Accept any layout where in == out (pass-through)
    if (layouts.getMainOutputChannelSet() != layouts.getMainInputChannelSet())
        return false;

    return layouts.getMainOutputChannelSet() == juce::AudioChannelSet::stereo()
        || layouts.getMainOutputChannelSet() == juce::AudioChannelSet::mono();
}

void CoOpAudioProcessor::processBlock (juce::AudioBuffer<float>& buffer,
                                       juce::MidiBuffer& /*midi*/)
{
    // Pure pass-through — no audio processing
    juce::ScopedNoDenormals noDenormals;
    (void) buffer;
}

//==============================================================================
juce::AudioProcessorEditor* CoOpAudioProcessor::createEditor()
{
    return new CoOpAudioProcessorEditor (*this);
}

//==============================================================================
// Plugin entry point
juce::AudioProcessor* JUCE_CALLTYPE createPluginFilter()
{
    return new CoOpAudioProcessor();
}
