#pragma once
#include <JuceHeader.h>
#include "LibraryManager.h"

class AudioEngine;

//==============================================================================
class VersionListComponent : public juce::Component
{
public:
    VersionListComponent(LibraryManager& library, AudioEngine& engine);
    ~VersionListComponent() override;

    void setTrackIndex(int index);
    void repaintVersionList();
    void refreshLayout(); // call after library data changes (versions added/removed/reordered)

    void paint(juce::Graphics& g) override;
    void resized() override;

private:
    LibraryManager& libraryManager;
    AudioEngine&    audioEngine;

    int currentTrackIndex = -1;

    juce::Viewport viewport;

    struct VersionListInner : public juce::Component,
                              public juce::FileDragAndDropTarget
    {
        VersionListInner(VersionListComponent& owner);
        void paint(juce::Graphics& g) override;
        void mouseDown(const juce::MouseEvent& e) override;
        void mouseDrag(const juce::MouseEvent& e) override;
        void mouseUp(const juce::MouseEvent& e) override;
        void mouseDoubleClick(const juce::MouseEvent& e) override;

        // FileDragAndDropTarget
        bool isInterestedInFileDrag(const juce::StringArray& files) override;
        void fileDragEnter(const juce::StringArray& files, int x, int y) override;
        void fileDragMove(const juce::StringArray& files, int x, int y) override;
        void fileDragExit(const juce::StringArray& files) override;
        void filesDropped(const juce::StringArray& files, int x, int y) override;

        static constexpr int rowHeight = 32;
        VersionListComponent& owner;

        // Inline label editing
        std::unique_ptr<juce::Label> editLabel;
        int editingIndex = -1;

        // File drag-over highlight
        bool dragOver = false;

        // Row reorder drag state
        int reorderDragIndex  = -1;  // which row is being dragged
        int reorderDropTarget = -1;  // insertion line position (0..numVersions)
    };

    std::unique_ptr<VersionListInner> inner;

    JUCE_DECLARE_NON_COPYABLE_WITH_LEAK_DETECTOR(VersionListComponent)
};
