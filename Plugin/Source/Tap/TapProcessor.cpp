#include "TapProcessor.h"
#include "SlurHostName.h"
#include <map>

namespace
{
// Live instances in this process. A duplicated track restores an identical
// state; the copy must not share (and overwrite) the original's capture.
std::mutex instancesLock;
std::map<juce::String, const void*> instances;

bool claimTapId (const juce::String& id, const void* owner)
{
    const std::lock_guard<std::mutex> l (instancesLock);
    const auto it = instances.find (id);
    if (it != instances.end() && it->second != owner) return false;
    for (auto i = instances.begin(); i != instances.end();)
        i = i->second == owner ? instances.erase (i) : std::next (i);
    instances[id] = owner;
    return true;
}

void releaseTapIds (const void* owner)
{
    const std::lock_guard<std::mutex> l (instancesLock);
    for (auto i = instances.begin(); i != instances.end();)
        i = i->second == owner ? instances.erase (i) : std::next (i);
}

}

SlurTapProcessor::SlurTapProcessor()
    : juce::AudioProcessor (BusesProperties()
                                .withInput ("Input", juce::AudioChannelSet::stereo(), true)
                                .withOutput ("Output", juce::AudioChannelSet::stereo(), true))
{
    claimTapId (tapId, this);
    cache.setHost (slurtap::canonicalHostName());
}

SlurTapProcessor::~SlurTapProcessor()
{
    releaseTapIds (this);
}

bool SlurTapProcessor::isBusesLayoutSupported (const BusesLayout& layouts) const
{
    const auto out = layouts.getMainOutputChannelSet();
    return (out == juce::AudioChannelSet::mono() || out == juce::AudioChannelSet::stereo())
        && layouts.getMainInputChannelSet() == out;
}

void SlurTapProcessor::prepareToPlay (double sampleRate, int)
{
    const std::lock_guard<std::mutex> l (idLock);
    generation = cache.configure (tapId, generation, sampleRate, getTotalNumInputChannels());
    captureRate.store (sampleRate);
}

void SlurTapProcessor::processBlock (juce::AudioBuffer<float>& buffer, juce::MidiBuffer&)
{
    // Pass-through: input and output share the buffer; nothing is written to it.
    const bool offline = isNonRealtime();
    if (auto* head = getPlayHead())
        if (const auto pos = head->getPosition())
            if (pos->getIsPlaying() || pos->getIsRecording() || offline)
                if (const auto samples = pos->getTimeInSamples())
                    cache.push (*samples, buffer.getArrayOfReadPointers(), juce::jmin (2, getTotalNumInputChannels()),
                                buffer.getNumSamples(), offline);
}

void SlurTapProcessor::updateTrackProperties (const TrackProperties& properties)
{
    juce::String colour;
    if (properties.colourARGB.has_value())
        colour = "#" + juce::Colour (*properties.colourARGB).toDisplayString (false).toLowerCase();
    cache.setTrack (properties.name.value_or (juce::String()), colour);
}

void SlurTapProcessor::clearCapture()
{
    const std::lock_guard<std::mutex> l (idLock);
    generation = cache.clear();
}

void SlurTapProcessor::getStateInformation (juce::MemoryBlock& dest)
{
    const std::lock_guard<std::mutex> l (idLock);
    juce::XmlElement xml ("SlurTap");
    xml.setAttribute ("tapId", tapId);
    xml.setAttribute ("generation", generation);
    copyXmlToBinary (xml, dest);
}

void SlurTapProcessor::setStateInformation (const void* data, int size)
{
    if (const auto xml = getXmlFromBinary (data, size); xml != nullptr && xml->hasTagName ("SlurTap"))
    {
        const auto id = xml->getStringAttribute ("tapId");
        // A duplicated track restores the same state: identity must stay unique per instance.
        const std::lock_guard<std::mutex> l (idLock);
        if (id.length() == 36 && id.containsOnly ("0123456789abcdef-") && claimTapId (id, this))
        {
            tapId = id;
            generation = xml->getStringAttribute ("generation");
        }
        if (captureRate.load() > 0)
            generation = cache.configure (tapId, generation, captureRate.load(), getTotalNumInputChannels());
    }
}

//==============================================================================
namespace
{
class TapEditor final : public juce::AudioProcessorEditor, private juce::Timer
{
public:
    explicit TapEditor (SlurTapProcessor& p) : juce::AudioProcessorEditor (p), tap (p)
    {
        clear.setButtonText ("Clear capture");
        clear.onClick = [this]
        {
            const auto choice = juce::MessageBoxOptions().withTitle ("Clear Slur Tap capture?")
                .withMessage ("Captured audio for this track will be deleted. Play or bounce again to capture it.")
                .withButton ("Clear").withButton ("Cancel").withAssociatedComponent (this);
            juce::AlertWindow::showAsync (choice, [safe = juce::Component::SafePointer<TapEditor> (this)] (int result)
            { if (result == 1 && safe != nullptr) safe->tap.clearCapture(); });
        };
        addAndMakeVisible (clear);
        setSize (340, 150);
        startTimerHz (4);
    }

    void paint (juce::Graphics& g) override
    {
        g.fillAll (juce::Colour (0xff15151a));
        auto area = getLocalBounds().reduced (16, 12);
        auto& cache = tap.getCache();
        const bool live = cache.recentlyCapturing();
        g.setColour (live ? juce::Colour (0xffff5a5a) : juce::Colour (0xff5a5a66));
        g.fillEllipse (area.getX() + 0.0f, area.getY() + 6.0f, 9.0f, 9.0f);
        g.setColour (juce::Colours::white);
        g.setFont (juce::FontOptions (17.0f, juce::Font::bold));
        g.drawText ("Slur Tap", area.removeFromTop (22).withTrimmedLeft (16), juce::Justification::centredLeft);
        g.setFont (juce::FontOptions (13.0f));
        g.setColour (juce::Colour (0xffc8c8d2));
        const auto name = cache.trackName();
        g.drawText (name.isNotEmpty() ? name : "This track", area.removeFromTop (20), juce::Justification::centredLeft);
        const auto rate = tap.getCaptureRate();
        const auto seconds = rate > 0 ? (double) cache.coveredFrames() / rate : 0.0;
        juce::String status = cache.isFull() ? "Cache full: clear to capture again"
            : live ? "Capturing"
            : seconds > 0 ? "Captured " + juce::String ((int) seconds / 60) + ":" + juce::String ((int) seconds % 60).paddedLeft ('0', 2)
                          : "Play or bounce the song once to capture this track";
        g.drawText (status, area.removeFromTop (20), juce::Justification::centredLeft);
        g.setColour (juce::Colour (0xff8a8a96));
        g.setFont (juce::FontOptions (11.5f));
        g.drawFittedText ("Send stems from the main Slur window. Place Slur Tap last on the track.",
                          area.removeFromTop (30), juce::Justification::topLeft, 2);
    }

    void resized() override { clear.setBounds (getWidth() - 136, getHeight() - 40, 120, 26); }

private:
    void timerCallback() override { repaint(); }
    SlurTapProcessor& tap;
    juce::TextButton clear;
};
}

juce::AudioProcessorEditor* SlurTapProcessor::createEditor() { return new TapEditor (*this); }

juce::AudioProcessor* JUCE_CALLTYPE createPluginFilter() { return new SlurTapProcessor(); }
