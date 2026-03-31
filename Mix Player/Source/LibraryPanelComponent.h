#pragma once
#include <JuceHeader.h>
#include "LibraryManager.h"

class AudioEngine;

//==============================================================================
class LibraryPanelComponent : public juce::Component,
                              public LibraryManager::Listener,
                              public juce::FileDragAndDropTarget
{
public:
    LibraryPanelComponent(LibraryManager& library, AudioEngine& engine);
    ~LibraryPanelComponent() override;

    void paint(juce::Graphics& g) override;
    void resized() override;

    // LibraryManager::Listener
    void libraryChanged() override;

    // FileDragAndDropTarget
    bool isInterestedInFileDrag(const juce::StringArray& files) override;
    void filesDropped(const juce::StringArray& files, int x, int y) override;

private:
    LibraryManager& libraryManager;
    AudioEngine&    audioEngine;

    juce::TextButton addFilesButton { "Add Files" };
    juce::Viewport   viewport;

    // Inner component that holds the actual track rows
    struct TrackListComponent : public juce::Component,
                                public juce::FileDragAndDropTarget
    {
        TrackListComponent(LibraryPanelComponent& owner);
        void paint(juce::Graphics& g) override;
        void resized() override;
        void mouseDown(const juce::MouseEvent& e) override;
        void mouseDoubleClick(const juce::MouseEvent& e) override;

        // FileDragAndDropTarget - delegate to owner
        bool isInterestedInFileDrag(const juce::StringArray& files) override;
        void fileDragEnter(const juce::StringArray& files, int x, int y) override;
        void fileDragMove(const juce::StringArray& files, int x, int y) override;
        void fileDragExit(const juce::StringArray& files) override;
        void filesDropped(const juce::StringArray& files, int x, int y) override;

        static constexpr int rowHeight = 36;
        LibraryPanelComponent& owner;

        // Highlight state for drag-over feedback
        int dragOverRow = -1;
    };

    std::unique_ptr<TrackListComponent> trackList;

    juce::Image logoImage;

    void addFilesButtonClicked();
    void showContextMenu(int trackIndex, juce::Point<int> pos);
    int trackIndexAtY(int y) const;

    bool isAudioFile(const juce::File& f) const;

    JUCE_DECLARE_NON_COPYABLE_WITH_LEAK_DETECTOR(LibraryPanelComponent)
};
