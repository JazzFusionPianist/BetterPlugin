#include "LibraryPanelComponent.h"
#include "AudioEngine.h"

//==============================================================================
// TrackListComponent

LibraryPanelComponent::TrackListComponent::TrackListComponent(LibraryPanelComponent& o)
    : owner(o)
{
    setOpaque(true);
}

void LibraryPanelComponent::TrackListComponent::paint(juce::Graphics& g)
{
    g.fillAll(juce::Colour(0xff0e0e0e));

    int numTracks = owner.libraryManager.getNumTracks();
    int active    = owner.libraryManager.getActiveTrackIndex();

    for (int i = 0; i < numTracks; ++i)
    {
        int y = i * rowHeight;
        const auto& track = owner.libraryManager.getTrack(i);

        // Row background
        if (i == active)
            g.setColour(juce::Colour(0xff1c1c1c));
        else if (i % 2 == 0)
            g.setColour(juce::Colour(0xff141414));
        else
            g.setColour(juce::Colour(0xff0e0e0e));

        g.fillRect(0, y, getWidth(), rowHeight);

        // Missing file warning
        if (track.filesMissing)
        {
            g.setColour(juce::Colours::red.withAlpha(0.3f));
            g.fillRect(0, y, 4, rowHeight);
        }

        // Display name
        g.setFont(juce::Font(juce::FontOptions("SF Pro Display", 16.0f, juce::Font::plain)));
        g.setColour(track.filesMissing ? juce::Colours::grey : juce::Colours::white);
        g.drawText(track.displayName, 10, y + 4, getWidth() - 60, rowHeight - 8,
                   juce::Justification::centredLeft, true);

        // Active indicator bar
        if (i == active)
        {
            g.setColour(juce::Colour(0xff00aaff));
            g.fillRect(0, y, 3, rowHeight);
        }

        // Version badge
        if (track.hasVersions())
        {
            juce::String badge = "v" + juce::String(track.versions.size());
            g.setColour(juce::Colour(0xff222222));
            g.fillRoundedRectangle((float)(getWidth() - 36), (float)(y + 8), 28.0f, 18.0f, 4.0f);
            g.setColour(juce::Colour(0xff00aaff));
            g.setFont(juce::Font(juce::FontOptions("SF Pro Display", 16.0f, juce::Font::plain)));
            g.drawText(badge, getWidth() - 36, y + 8, 28, 18, juce::Justification::centred);
        }

        // Drag-over highlight
        if (i == dragOverRow)
        {
            g.setColour(juce::Colour(0x3300aaff));
            g.fillRect(0, y, getWidth(), rowHeight);
            g.setColour(juce::Colour(0xff00aaff));
            g.drawRect(0, y, getWidth(), rowHeight, 2);
        }

        // Row separator
        g.setColour(juce::Colour(0xff1a1a1a));
        g.drawHorizontalLine(y + rowHeight - 1, 0.0f, (float)getWidth());
    }

    // Drag-over highlight for empty area (new track)
    if (dragOverRow == -1 && numTracks == 0)
    {
        g.setColour(juce::Colour(0x2200aaff));
        g.fillAll();
        g.setColour(juce::Colour(0xff00aaff));
        g.drawRect(getLocalBounds(), 2);
    }

    // Empty state hint
    if (numTracks == 0)
    {
        g.setColour(juce::Colours::grey);
        g.setFont(juce::Font(juce::FontOptions("SF Pro Display", 16.0f, juce::Font::plain)));
        g.drawText("Drop audio files here or click 'Add Files'",
                   0, getHeight() / 2 - 20, getWidth(), 40,
                   juce::Justification::centred, true);
    }
}

void LibraryPanelComponent::TrackListComponent::resized() {}

void LibraryPanelComponent::TrackListComponent::mouseDown(const juce::MouseEvent& e)
{
    int trackIdx = owner.trackIndexAtY(e.y);

    if (e.mods.isRightButtonDown())
    {
        owner.showContextMenu(trackIdx, e.getPosition());
        return;
    }

    // Single click: select (highlight) only
    if (trackIdx >= 0)
    {
        owner.libraryManager.setActiveTrackIndex(trackIdx);
        repaint();
    }
}

void LibraryPanelComponent::TrackListComponent::mouseDoubleClick(const juce::MouseEvent& e)
{
    int trackIdx = owner.trackIndexAtY(e.y);
    if (trackIdx >= 0)
    {
        owner.libraryManager.loadTrack(trackIdx, owner.audioEngine);
        repaint();
    }
}

bool LibraryPanelComponent::TrackListComponent::isInterestedInFileDrag(const juce::StringArray& files)
{
    return owner.isInterestedInFileDrag(files);
}

void LibraryPanelComponent::TrackListComponent::fileDragEnter(const juce::StringArray& /*files*/, int /*x*/, int y)
{
    dragOverRow = owner.trackIndexAtY(y);
    repaint();
}

void LibraryPanelComponent::TrackListComponent::fileDragMove(const juce::StringArray& /*files*/, int /*x*/, int y)
{
    int newRow = owner.trackIndexAtY(y);
    if (newRow != dragOverRow)
    {
        dragOverRow = newRow;
        repaint();
    }
}

void LibraryPanelComponent::TrackListComponent::fileDragExit(const juce::StringArray& /*files*/)
{
    dragOverRow = -1;
    repaint();
}

void LibraryPanelComponent::TrackListComponent::filesDropped(const juce::StringArray& files, int /*x*/, int y)
{
    dragOverRow = -1;
    repaint();

    int trackIdx = owner.trackIndexAtY(y);

    for (const auto& path : files)
    {
        juce::File f(path);
        if (!owner.isAudioFile(f)) continue;

        if (trackIdx >= 0)
            owner.libraryManager.addVersionToTrack(trackIdx, f);
        else
            owner.libraryManager.addTrack(f);
    }
}

//==============================================================================
// LibraryPanelComponent

LibraryPanelComponent::LibraryPanelComponent(LibraryManager& library, AudioEngine& engine)
    : libraryManager(library), audioEngine(engine)
{
    // Load logo from app bundle Resources (added via Xcode Copy Bundle Resources phase).
    // This works on any machine after distribution.
    juce::File bundleResources = juce::File::getSpecialLocation(juce::File::currentApplicationFile)
                                     .getChildFile("Contents/Resources");
    juce::File logoFile = bundleResources.getChildFile("logo_musicat.png");
    if (logoFile.existsAsFile())
        logoImage = juce::ImageFileFormat::loadFrom(logoFile);

    libraryManager.addListener(this);

    addAndMakeVisible(addFilesButton);
    addFilesButton.onClick = [this]() { addFilesButtonClicked(); };

    trackList = std::make_unique<TrackListComponent>(*this);
    viewport.setViewedComponent(trackList.get(), false);
    viewport.setScrollBarsShown(true, false);
    addAndMakeVisible(viewport);

    libraryChanged();
}

LibraryPanelComponent::~LibraryPanelComponent()
{
    libraryManager.removeListener(this);
}

void LibraryPanelComponent::paint(juce::Graphics& g)
{
    g.fillAll(juce::Colour(0xff0a0a0a));

    // Logo area (top 80px)
    static constexpr int logoH = 80;
    g.setColour(juce::Colour(0xff0d0d0d));
    g.fillRect(0, 0, getWidth(), logoH);

    // Draw logo image if loaded, otherwise fall back to text
    if (logoImage.isValid())
    {
        // Scale image to fit within logo area with 6px padding, preserving aspect ratio
        int pad = 6;
        int availW = getWidth() - pad * 2;
        int availH = logoH - pad * 2;
        float imgAspect = (float)logoImage.getWidth() / (float)logoImage.getHeight();
        int drawW = availW;
        int drawH = (int)(drawW / imgAspect);
        if (drawH > availH)
        {
            drawH = availH;
            drawW = (int)(drawH * imgAspect);
        }
        int drawX = (getWidth() - drawW) / 2;
        int drawY = pad + (availH - drawH) / 2;
        g.drawImage(logoImage, drawX, drawY, drawW, drawH,
                    0, 0, logoImage.getWidth(), logoImage.getHeight());
    }
    else
    {
        g.setFont(juce::Font(juce::FontOptions("SF Pro Display", 13.0f, juce::Font::bold)));
        g.setColour(juce::Colour(0xff4499dd));
        g.drawText("MUSICAT", 0, 0, getWidth(), logoH, juce::Justification::centred);
    }

    // Logo / header separator
    g.setColour(juce::Colour(0xff1e1e1e));
    g.drawHorizontalLine(logoH, 0.0f, (float)getWidth());

    // "LIBRARY" header
    g.setColour(juce::Colour(0xff888888));
    g.setFont(juce::Font(juce::FontOptions("SF Pro Display", 16.0f, juce::Font::bold)));
    g.drawText("LIBRARY", 10, logoH + 4, getWidth() - 16, 22, juce::Justification::centredLeft);

    g.setColour(juce::Colour(0xff1e1e1e));
    g.drawHorizontalLine(logoH + 30, 0.0f, (float)getWidth());
}

void LibraryPanelComponent::resized()
{
    static constexpr int logoH = 80;
    static constexpr int headerH = 32;
    int contentY = logoH + headerH;

    addFilesButton.setBounds(getWidth() - 80, logoH + 4, 72, 22);
    viewport.setBounds(0, contentY, getWidth(), getHeight() - contentY);
    libraryChanged(); // re-sync inner size to new viewport dimensions
}

void LibraryPanelComponent::libraryChanged()
{
    static constexpr int contentY = 112; // logoH(80) + headerH(32)
    int numTracks = libraryManager.getNumTracks();
    int listH = juce::jmax(numTracks * TrackListComponent::rowHeight, getHeight() - contentY);
    int innerW = juce::jmax(1, viewport.getWidth() > 0 ? viewport.getWidth() : getWidth());
    trackList->setSize(innerW, listH);
    trackList->repaint();
}

bool LibraryPanelComponent::isAudioFile(const juce::File& f) const
{
    static const juce::StringArray extensions { ".wav", ".aiff", ".aif", ".flac", ".mp3", ".m4a", ".aac" };
    return extensions.contains(f.getFileExtension().toLowerCase());
}

bool LibraryPanelComponent::isInterestedInFileDrag(const juce::StringArray& files)
{
    for (const auto& path : files)
        if (isAudioFile(juce::File(path)))
            return true;
    return false;
}

void LibraryPanelComponent::filesDropped(const juce::StringArray& files, int x, int y)
{
    // Adjust y for logo+header offset and viewport scroll offset
    int listY = y - 112 + viewport.getViewPositionY();
    int trackIdx = trackIndexAtY(listY);

    for (const auto& path : files)
    {
        juce::File f(path);
        if (!isAudioFile(f)) continue;

        if (trackIdx >= 0)
            libraryManager.addVersionToTrack(trackIdx, f);
        else
            libraryManager.addTrack(f);
    }
}

int LibraryPanelComponent::trackIndexAtY(int y) const
{
    int idx = y / TrackListComponent::rowHeight;
    if (idx >= 0 && idx < libraryManager.getNumTracks())
        return idx;
    return -1;
}

void LibraryPanelComponent::addFilesButtonClicked()
{
    // Use empty wildcard so macOS native dialog shows all files;
    // we filter to audio formats after selection.
    auto chooser = std::make_shared<juce::FileChooser>(
        "Add Audio Files",
        juce::File::getSpecialLocation(juce::File::userMusicDirectory),
        "*");

    chooser->launchAsync(
        juce::FileBrowserComponent::openMode
            | juce::FileBrowserComponent::canSelectFiles
            | juce::FileBrowserComponent::canSelectMultipleItems,
        [this, chooser](const juce::FileChooser& fc)
        {
            for (const auto& result : fc.getResults())
            {
                if (isAudioFile(result))
                    libraryManager.addTrack(result);
            }
        });
}

void LibraryPanelComponent::showContextMenu(int trackIndex, juce::Point<int> pos)
{
    juce::PopupMenu menu;

    if (trackIndex >= 0)
    {
        menu.addItem(1, "Add Version...");
        menu.addItem(2, "Rename...");
        menu.addSeparator();
        menu.addItem(3, "Remove Track");
    }

    menu.showMenuAsync(juce::PopupMenu::Options().withTargetScreenArea(
        juce::Rectangle<int>(pos.x + getScreenX(), pos.y + getScreenY(), 1, 1)),
        [this, trackIndex](int result)
        {
            if (trackIndex < 0) return;

            if (result == 1)
            {
                // Add version - use "*" so macOS native dialog shows all files
                auto chooser = std::make_shared<juce::FileChooser>(
                    "Add Version",
                    juce::File::getSpecialLocation(juce::File::userMusicDirectory),
                    "*");

                chooser->launchAsync(
                    juce::FileBrowserComponent::openMode
                        | juce::FileBrowserComponent::canSelectFiles
                        | juce::FileBrowserComponent::canSelectMultipleItems,
                    [this, trackIndex, chooser](const juce::FileChooser& fc)
                    {
                        for (const auto& f : fc.getResults())
                            if (isAudioFile(f))
                                libraryManager.addVersionToTrack(trackIndex, f);
                    });
            }
            else if (result == 2)
            {
                // Rename - build AlertWindow manually (no showInputBoxAsync in this JUCE version)
                juce::String currentName = libraryManager.getTrack(trackIndex).displayName;
                auto* aw = new juce::AlertWindow("Rename Track", "Enter new name:",
                                                  juce::MessageBoxIconType::NoIcon);
                aw->addTextEditor("name", currentName, "");
                aw->addButton("OK",     1, juce::KeyPress(juce::KeyPress::returnKey));
                aw->addButton("Cancel", 0, juce::KeyPress(juce::KeyPress::escapeKey));

                aw->enterModalState(true,
                    juce::ModalCallbackFunction::create([this, trackIndex, aw](int r)
                    {
                        if (r == 1)
                        {
                            juce::String text = aw->getTextEditorContents("name");
                            if (text.isNotEmpty())
                                libraryManager.renameTrack(trackIndex, text);
                        }
                    }), true);
            }
            else if (result == 3)
            {
                libraryManager.removeTrack(trackIndex);
            }
        });
}
