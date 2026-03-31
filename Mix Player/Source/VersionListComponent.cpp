#include "VersionListComponent.h"
#include "AudioEngine.h"

//==============================================================================
// VersionListInner

VersionListComponent::VersionListInner::VersionListInner(VersionListComponent& o)
    : owner(o)
{
    setOpaque(true);
}

void VersionListComponent::VersionListInner::paint(juce::Graphics& g)
{
    g.fillAll(juce::Colour(0xff0e0e0e));

    int trackIdx = owner.currentTrackIndex;
    if (trackIdx < 0 || trackIdx >= owner.libraryManager.getNumTracks())
    {
        // Drag-over highlight for empty state
        if (dragOver)
        {
            g.setColour(juce::Colour(0x2200aaff));
            g.fillAll();
            g.setColour(juce::Colour(0xff00aaff));
            g.drawRect(getLocalBounds(), 2);
        }
        return;
    }

    const auto& track = owner.libraryManager.getTrack(trackIdx);
    int activeVersion = owner.audioEngine.getVersionManager().getActiveVersionIndex();

    // Build display list: if no explicit versions, show the primary file as "Version 1"
    struct DisplayEntry { juce::String label; bool isPrimary; };
    std::vector<DisplayEntry> displayEntries;
    if (track.hasVersions())
    {
        for (const auto& v : track.versions)
            displayEntries.push_back({ v.label, false });
    }
    else if (track.primaryFile.existsAsFile())
    {
        displayEntries.push_back({ track.primaryFile.getFileName(), true });
    }

    int numVersions = (int)displayEntries.size();

    for (int i = 0; i < numVersions; ++i)
    {
        int y = i * rowHeight;
        const auto& version = displayEntries[(size_t)i];

        bool isActive = (i == activeVersion);

        if (isActive)
            g.setColour(juce::Colour(0xff1a1a1a));
        else if (i % 2 == 0)
            g.setColour(juce::Colour(0xff141414));
        else
            g.setColour(juce::Colour(0xff0e0e0e));

        g.fillRect(0, y, getWidth(), rowHeight);

        // Active indicator bar
        if (isActive)
        {
            g.setColour(juce::Colour(0xff00aaff));
            g.fillRect(0, y, 3, rowHeight);
        }

        // Shortcut key badge (1-9 for versions 0-8, 0 for version 9)
        if (i < 10)
        {
            juce::String key = (i < 9) ? juce::String(i + 1) : "0";
            g.setColour(juce::Colour(0xff2a2a2a));
            g.fillRoundedRectangle(5.0f, (float)(y + rowHeight/2 - 9), 18.0f, 18.0f, 3.0f);
            g.setFont(juce::Font(juce::FontOptions("SF Pro Display", 16.0f, juce::Font::bold)));
            g.setColour(isActive ? juce::Colour(0xff00aaff) : juce::Colour(0xff666666));
            g.drawText(key, 5, y + rowHeight/2 - 9, 18, 18, juce::Justification::centred);
        }

        // Version label
        g.setFont(juce::Font(juce::FontOptions("SF Pro Display", 16.0f, juce::Font::plain)));
        g.setColour(isActive ? juce::Colours::white : juce::Colour(0xffcccccc));
        g.drawText(version.label, 28, y + 4, getWidth() - 34, rowHeight - 8,
                   juce::Justification::centredLeft, true);

        // Drag source row: dim it slightly
        if (i == reorderDragIndex && reorderDropTarget >= 0)
        {
            g.setColour(juce::Colour(0x44000000));
            g.fillRect(0, y, getWidth(), rowHeight);
        }

        g.setColour(juce::Colour(0xff1a1a1a));
        g.drawHorizontalLine(y + rowHeight - 1, 0.0f, (float)getWidth());
    }

    // Reorder insertion line
    if (reorderDragIndex >= 0 && reorderDropTarget >= 0)
    {
        int lineY = reorderDropTarget * rowHeight;
        g.setColour(juce::Colour(0xff00aaff));
        g.fillRect(0, lineY - 1, getWidth(), 2);
        // Small arrow nubs at ends
        g.fillRect(0, lineY - 3, 4, 6);
        g.fillRect(getWidth() - 4, lineY - 3, 4, 6);
    }

    // File drag-over highlight overlay
    if (dragOver)
    {
        g.setColour(juce::Colour(0x2200aaff));
        g.fillAll();
        g.setColour(juce::Colour(0xff00aaff));
        g.drawRect(getLocalBounds(), 2);
    }
}

void VersionListComponent::VersionListInner::mouseDown(const juce::MouseEvent& e)
{
    if (editLabel != nullptr)
    {
        editLabel.reset();
        editingIndex = -1;
    }

    int trackIdx = owner.currentTrackIndex;
    if (trackIdx < 0) return;

    int vIdx = e.y / rowHeight;
    const auto& track = owner.libraryManager.getTrack(trackIdx);
    int numVersions = (int)track.versions.size();
    if (vIdx < 0 || vIdx >= numVersions) return;

    // Right-click: context menu
    if (e.mods.isRightButtonDown())
    {
        juce::PopupMenu menu;
        menu.addItem(1, "Delete version");
        auto screenPos = e.getScreenPosition();
        menu.showMenuAsync(juce::PopupMenu::Options()
                               .withTargetScreenArea(juce::Rectangle<int>(screenPos.x, screenPos.y, 1, 1)),
            [this, trackIdx, vIdx](int result)
            {
                if (result == 1)
                {
                    // If this was the active version, reload the track
                    int activeVer = owner.audioEngine.getVersionManager().getActiveVersionIndex();
                    owner.libraryManager.removeVersion(trackIdx, vIdx);

                    // Reload engine versions after removal
                    if (trackIdx < owner.libraryManager.getNumTracks())
                    {
                        const auto& t = owner.libraryManager.getTrack(trackIdx);
                        if (t.hasVersions())
                        {
                            owner.audioEngine.loadVersions(t);
                            int newActive = juce::jlimit(0, (int)t.versions.size() - 1,
                                                         activeVer > vIdx ? activeVer - 1 : activeVer);
                            owner.audioEngine.switchToVersion(newActive);
                        }
                    }
                    owner.refreshLayout();
                }
            });
        return;
    }

    // Left-click: switch version + begin potential reorder drag
    // If engine has no versions loaded, load first
    if (owner.audioEngine.getVersionManager().getNumVersions() == 0)
        owner.audioEngine.loadVersions(track);

    owner.audioEngine.switchToVersion(vIdx);
    reorderDragIndex  = vIdx;
    reorderDropTarget = -1;
    repaint();
}

void VersionListComponent::VersionListInner::mouseDrag(const juce::MouseEvent& e)
{
    if (reorderDragIndex < 0) return;
    if (std::abs(e.getDistanceFromDragStartY()) < 4) return; // dead zone

    int trackIdx = owner.currentTrackIndex;
    if (trackIdx < 0) return;
    int numVersions = (int)owner.libraryManager.getTrack(trackIdx).versions.size();
    if (numVersions < 2) return;

    // Insertion slot: between rows. Clamp to [0, numVersions].
    int slot = juce::jlimit(0, numVersions, (e.y + rowHeight / 2) / rowHeight);
    if (reorderDropTarget != slot)
    {
        reorderDropTarget = slot;
        repaint();
    }
}

void VersionListComponent::VersionListInner::mouseUp(const juce::MouseEvent& /*e*/)
{
    if (reorderDragIndex >= 0 && reorderDropTarget >= 0)
    {
        int trackIdx = owner.currentTrackIndex;
        if (trackIdx >= 0)
        {
            int numVersions = (int)owner.libraryManager.getTrack(trackIdx).versions.size();
            // Compute destination index (insertion slot → row index)
            int toIdx = reorderDropTarget;
            if (toIdx > reorderDragIndex) toIdx--; // adjust for removal offset
            toIdx = juce::jlimit(0, numVersions - 1, toIdx);

            if (toIdx != reorderDragIndex)
            {
                int activeVer = owner.audioEngine.getVersionManager().getActiveVersionIndex();
                owner.libraryManager.reorderVersions(trackIdx, reorderDragIndex, toIdx);

                // Re-map active version index after reorder
                const auto& t = owner.libraryManager.getTrack(trackIdx);
                owner.audioEngine.loadVersions(t);
                int newActive = (activeVer == reorderDragIndex) ? toIdx
                              : (activeVer > reorderDragIndex && activeVer <= toIdx) ? activeVer - 1
                              : (activeVer < reorderDragIndex && activeVer >= toIdx) ? activeVer + 1
                              : activeVer;
                newActive = juce::jlimit(0, (int)t.versions.size() - 1, newActive);
                owner.audioEngine.switchToVersion(newActive);
            }
            owner.refreshLayout();
        }
    }
    reorderDragIndex  = -1;
    reorderDropTarget = -1;
    repaint();
}

void VersionListComponent::VersionListInner::mouseDoubleClick(const juce::MouseEvent& e)
{
    int trackIdx = owner.currentTrackIndex;
    if (trackIdx < 0) return;

    int vIdx = e.y / rowHeight;
    if (vIdx < 0) return;
    if (vIdx >= (int)owner.libraryManager.getTrack(trackIdx).versions.size()) return;

    // Begin inline edit
    editingIndex = vIdx;
    const auto& version = owner.libraryManager.getTrack(trackIdx).versions[(size_t)vIdx];

    editLabel = std::make_unique<juce::Label>("edit", version.label);
    editLabel->setBounds(8, vIdx * rowHeight + 4, getWidth() - 16, rowHeight - 8);
    editLabel->setEditable(true, true, false);
    editLabel->setColour(juce::Label::backgroundColourId, juce::Colour(0xff1e1e1e));
    editLabel->setColour(juce::Label::textColourId, juce::Colours::white);
    editLabel->setFont(juce::Font(juce::FontOptions("SF Pro Display", 16.0f, juce::Font::plain)));
    addAndMakeVisible(*editLabel);
    editLabel->showEditor();

    editLabel->onEditorHide = [this, trackIdx, vIdx]()
    {
        if (editLabel != nullptr)
        {
            juce::String newText = editLabel->getText();
            if (newText.isNotEmpty())
                owner.libraryManager.renameVersion(trackIdx, vIdx, newText);
            editLabel.reset();
            editingIndex = -1;
        }
    };
}

bool VersionListComponent::VersionListInner::isInterestedInFileDrag(const juce::StringArray& files)
{
    static const juce::StringArray exts { ".wav", ".aiff", ".aif", ".flac", ".mp3", ".m4a", ".aac" };
    for (const auto& path : files)
        if (exts.contains(juce::File(path).getFileExtension().toLowerCase()))
            return true;
    return false;
}

void VersionListComponent::VersionListInner::fileDragEnter(const juce::StringArray& /*files*/, int /*x*/, int /*y*/)
{
    dragOver = true;
    repaint();
}

void VersionListComponent::VersionListInner::fileDragMove(const juce::StringArray& /*files*/, int /*x*/, int /*y*/)
{
}

void VersionListComponent::VersionListInner::fileDragExit(const juce::StringArray& /*files*/)
{
    dragOver = false;
    repaint();
}

void VersionListComponent::VersionListInner::filesDropped(const juce::StringArray& files, int /*x*/, int /*y*/)
{
    dragOver = false;
    repaint();

    int trackIdx = owner.currentTrackIndex;
    if (trackIdx < 0) return;

    static const juce::StringArray exts { ".wav", ".aiff", ".aif", ".flac", ".mp3", ".m4a", ".aac" };
    for (const auto& path : files)
    {
        juce::File f(path);
        if (exts.contains(f.getFileExtension().toLowerCase()))
            owner.libraryManager.addVersionToTrack(trackIdx, f);
    }
    owner.refreshLayout();
}

//==============================================================================
// VersionListComponent

VersionListComponent::VersionListComponent(LibraryManager& library, AudioEngine& engine)
    : libraryManager(library), audioEngine(engine)
{
    inner = std::make_unique<VersionListInner>(*this);
    viewport.setViewedComponent(inner.get(), false);
    viewport.setScrollBarsShown(true, false);
    addAndMakeVisible(viewport);
}

VersionListComponent::~VersionListComponent()
{
}

void VersionListComponent::setTrackIndex(int index)
{
    currentTrackIndex = index;
    refreshLayout();
}

void VersionListComponent::repaintVersionList()
{
    inner->repaint();
}

void VersionListComponent::paint(juce::Graphics& g)
{
    g.fillAll(juce::Colour(0xff0a0a0a));

    g.setColour(juce::Colour(0xff999999));
    g.setFont(juce::Font(juce::FontOptions("SF Pro Display", 16.0f, juce::Font::bold)));
    g.drawText("VERSIONS", 8, 2, getWidth() - 16, 22, juce::Justification::centredLeft);

    g.setColour(juce::Colour(0xff1e1e1e));
    g.drawHorizontalLine(24, 0.0f, (float)getWidth());

    // Show hint when no track selected or no versions
    // Show hint only when no track is selected at all
    bool hasContent = (currentTrackIndex >= 0
                       && currentTrackIndex < libraryManager.getNumTracks()
                       && (libraryManager.getTrack(currentTrackIndex).hasVersions()
                           || libraryManager.getTrack(currentTrackIndex).primaryFile.existsAsFile()));
    if (!hasContent)
    {
        g.setColour(juce::Colour(0xff444444));
        g.setFont(juce::Font(juce::FontOptions("SF Pro Display", 16.0f, juce::Font::plain)));
        g.drawText("Right-click track\nto add versions",
                   0, getHeight() / 2 - 20, getWidth(), 40,
                   juce::Justification::centred, true);
    }
}

void VersionListComponent::resized()
{
    viewport.setBounds(0, 26, getWidth(), getHeight() - 26);
    refreshLayout(); // re-sync inner size to new viewport dimensions
}

void VersionListComponent::refreshLayout()
{
    int innerW = juce::jmax(1, viewport.getWidth() > 0 ? viewport.getWidth() : getWidth());

    if (currentTrackIndex < 0 || currentTrackIndex >= libraryManager.getNumTracks())
    {
        inner->setSize(innerW, juce::jmax(1, getHeight() - 26));
        inner->repaint();
        return;
    }

    const auto& track = libraryManager.getTrack(currentTrackIndex);
    int numRows = track.hasVersions() ? (int)track.versions.size() : (track.primaryFile.existsAsFile() ? 1 : 0);
    int h = juce::jmax(numRows * VersionListInner::rowHeight,
                       juce::jmax(1, getHeight() - 26));
    inner->setSize(innerW, h);
    inner->repaint();
}
