#include "VersionManager.h"

VersionManager::VersionManager() {}
VersionManager::~VersionManager() { clearVersions(); }

void VersionManager::loadVersions(const Track& track,
                                   juce::AudioFormatManager& formatManager,
                                   juce::AudioTransportSource& transportSource)
{
    juce::ScopedLock sl(sourceLock);

    sources.clear();
    versionFiles.clear();
    activeVersionIndex = 0;

    if (!track.hasVersions())
    {
        // Single-file mode
        if (track.primaryFile.existsAsFile())
        {
            auto* reader = formatManager.createReaderFor(track.primaryFile);
            if (reader != nullptr)
            {
                auto source = std::make_unique<juce::AudioFormatReaderSource>(reader, true);
                transportSource.setSource(source.get(), 0, nullptr, reader->sampleRate);
                sources.push_back(std::move(source));
                versionFiles.push_back(track.primaryFile);
            }
        }
    }
    else
    {
        // Multi-version mode - load all versions
        // Check for mismatched sample rates / channel counts
        double firstSampleRate = 0.0;
        int firstChannels = 0;

        for (const auto& entry : track.versions)
        {
            if (!entry.file.existsAsFile())
                continue;

            auto* reader = formatManager.createReaderFor(entry.file);
            if (reader != nullptr)
            {
                if (firstSampleRate == 0.0)
                {
                    firstSampleRate = reader->sampleRate;
                    firstChannels   = (int)reader->numChannels;
                }
                else
                {
                    if (reader->sampleRate != firstSampleRate || (int)reader->numChannels != firstChannels)
                    {
                        juce::AlertWindow::showMessageBoxAsync(
                            juce::MessageBoxIconType::WarningIcon,
                            "Format Mismatch",
                            "Version '" + entry.label + "' has a different sample rate or channel count. "
                            "Switching to this version may sound incorrect.");
                    }
                }

                auto source = std::make_unique<juce::AudioFormatReaderSource>(reader, true);
                sources.push_back(std::move(source));
                versionFiles.push_back(entry.file);
            }
        }

        if (!sources.empty())
        {
            auto* firstReader = sources[0]->getAudioFormatReader();
            transportSource.setSource(sources[0].get(), 0, nullptr, firstReader->sampleRate);
        }
    }
}

void VersionManager::clearVersions()
{
    juce::ScopedLock sl(sourceLock);
    sources.clear();
    versionFiles.clear();
    activeVersionIndex = 0;
}

void VersionManager::switchToVersion(int index, juce::AudioTransportSource& transportSource)
{
    juce::ScopedLock sl(sourceLock);

    if (index < 0 || index >= (int)sources.size())
        return;

    if (index == activeVersionIndex)
        return;

    // Preserve playback position
    double currentPosition = transportSource.getCurrentPosition();
    bool wasPlaying = transportSource.isPlaying();

    auto* reader = sources[index]->getAudioFormatReader();
    transportSource.setSource(sources[index].get(), 0, nullptr, reader->sampleRate);
    transportSource.setPosition(currentPosition);

    if (wasPlaying)
        transportSource.start();

    activeVersionIndex = index;
}
