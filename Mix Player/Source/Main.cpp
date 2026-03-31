/*
  ==============================================================================

    Mix Player - Professional Reference Player for Mixing and Mastering Engineers

  ==============================================================================
*/

#include <JuceHeader.h>
#include "MainComponent.h"
#include "MiniPlayerComponent.h"

//==============================================================================
class MixPlayerApplication : public juce::JUCEApplication
{
public:
    MixPlayerApplication() {}

    const juce::String getApplicationName() override    { return "Mix Player"; }
    const juce::String getApplicationVersion() override { return "1.0.0"; }
    bool moreThanOneInstanceAllowed() override          { return false; }

    //==============================================================================
    // MainWindow must be declared before TrayIcon (which references it)
    class MainWindow : public juce::DocumentWindow
    {
    public:
        MainWindow(juce::String name)
            : DocumentWindow(name,
                             juce::Desktop::getInstance().getDefaultLookAndFeel()
                                                         .findColour(juce::ResizableWindow::backgroundColourId),
                             DocumentWindow::allButtons)
        {
            setUsingNativeTitleBar(true);
            setContentOwned(new MainComponent(), true);

            setResizable(true, true);
            setResizeLimits(1000, 600, 2400, 1600);
            centreWithSize(getWidth(), getHeight());
            setVisible(true);
        }

        void closeButtonPressed() override
        {
            setVisible(false);
        }

    private:
        JUCE_DECLARE_NON_COPYABLE_WITH_LEAK_DETECTOR(MainWindow)
    };

    //==============================================================================
    void initialise(const juce::String& commandLine) override
    {
        mainWindow.reset(new MainWindow(getApplicationName()));
        trayIcon.reset(new TrayIcon(*mainWindow));
        openFileFromCommandLine(commandLine);
    }

    void shutdown() override
    {
        trayIcon = nullptr;
        mainWindow = nullptr;
    }

    //==============================================================================
    void systemRequestedQuit() override
    {
        quit();
    }

    void anotherInstanceStarted(const juce::String& commandLine) override
    {
        // Special internal signal from MiniPlayerComponent's "Open Mix Player" button
        if (commandLine == "__show_main_window__")
        {
            if (mainWindow != nullptr)
            {
                mainWindow->setVisible(true);
                mainWindow->toFront(true);
            }
            return;
        }

        // macOS "Open With" file open
        openFileFromCommandLine(commandLine);
        if (mainWindow != nullptr)
        {
            mainWindow->setVisible(true);
            mainWindow->toFront(true);
        }
    }

private:
    void openFileFromCommandLine(const juce::String& commandLine)
    {
        if (commandLine.isEmpty()) return;

        juce::String path = commandLine.trim();
        if (path.startsWithChar('"') && path.endsWithChar('"'))
            path = path.substring(1, path.length() - 1);

        juce::File file(path);
        if (file.existsAsFile())
        {
            if (mainWindow != nullptr)
                if (auto* mc = dynamic_cast<MainComponent*>(mainWindow->getContentComponent()))
                    mc->openFile(file);
        }
    }

    //==============================================================================
    // Borderless popup window that contains the MiniPlayerComponent.
    // Uses a plain Component added to the desktop with a transparent peer,
    // which allows the rounded rectangle to clip correctly at the corners.
    class MiniPlayerWindow : public juce::Component
    {
    public:
        MiniPlayerWindow(AudioEngine& engine, LibraryManager& library)
        {
            miniPlayer.reset(new MiniPlayerComponent(engine, library));
            miniPlayer->onDismiss = [this]() { hideWindow(); };
            addAndMakeVisible(*miniPlayer);

            setSize(miniPlayer->getWidth(), miniPlayer->getHeight());
            setOpaque(false);
        }

        void showAt(int screenX, int screenY)
        {
            if (!isOnDesktop())
            {
                // windowIsTemporary = borderless panel on macOS (NSPanel, no title bar).
                // Do NOT pass windowHasDropShadow so macOS won't draw a rectangular shadow box.
                addToDesktop(juce::ComponentPeer::windowIsTemporary
                             | juce::ComponentPeer::windowIgnoresKeyPresses, nullptr);
            }

            // For a desktop component, setBounds(x, y, w, h) stores x/y as
            // boundsRelativeToParent which—with no parent—maps directly to
            // screen coordinates.  The peer then calls updateBounds() to move
            // the native window to that position.
            setBounds(screenX, screenY, getWidth(), getHeight());

            setVisible(true);
            toFront(false);  // false = don't steal keyboard focus

            juce::Desktop::getInstance().addGlobalMouseListener(this);
        }

        void hideWindow()
        {
            juce::Desktop::getInstance().removeGlobalMouseListener(this);
            setVisible(false);
        }

        void paint(juce::Graphics&) override {}  // fully transparent container

        void resized() override
        {
            if (miniPlayer != nullptr)
                miniPlayer->setBounds(getLocalBounds());
        }

        // Global mouse listener: dismiss when clicking outside the popup
        void mouseDown(const juce::MouseEvent& e) override
        {
            // getScreenBounds() gives the true screen-space rectangle of this desktop component
            if (isVisible() && !getScreenBounds().contains(e.getScreenPosition()))
                hideWindow();
        }

        MiniPlayerComponent* getMiniPlayer() { return miniPlayer.get(); }

    private:
        std::unique_ptr<MiniPlayerComponent> miniPlayer;
        JUCE_DECLARE_NON_COPYABLE_WITH_LEAK_DETECTOR(MiniPlayerWindow)
    };

    //==============================================================================
    // macOS menu bar icon
    struct TrayIcon : public juce::SystemTrayIconComponent
    {
        TrayIcon(MainWindow& w) : mainWindow(w)
        {
            // Draw a simple music note as a white-on-transparent template image
            juce::Image img(juce::Image::ARGB, 22, 22, true);
            {
                juce::Graphics g(img);
                g.setColour(juce::Colours::white);
                g.fillEllipse(2.0f, 13.0f, 8.0f, 7.0f);
                g.fillRect(9.0f, 3.0f, 2.0f, 14.0f);
                g.fillRect(9.0f, 3.0f, 7.0f, 2.0f);
                g.fillEllipse(14.0f, 3.0f, 6.0f, 5.0f);
            }
            setIconImage(img, img);
            setIconTooltip("Mix Player");
        }

        void mouseDown(const juce::MouseEvent& e) override
        {
            if (auto* mc = dynamic_cast<MainComponent*>(mainWindow.getContentComponent()))
            {
                if (miniPlayerWindow == nullptr)
                    miniPlayerWindow.reset(new MiniPlayerWindow(
                        mc->getAudioEngine(), mc->getLibraryManager()));

                if (miniPlayerWindow->isVisible())
                {
                    miniPlayerWindow->hideWindow();
                    return;
                }

                // Position popup below the tray icon.
                // Note: JUCE passes position={0,0} for tray icon mouseDown events on macOS,
                // so e.getScreenPosition() is unreliable.  Use the actual mouse cursor
                // position at the time of the click instead.
                int popupW = miniPlayerWindow->getWidth();
                int popupH = miniPlayerWindow->getHeight();

                juce::Point<int> screenPos = juce::Desktop::getMousePosition();
                int x = screenPos.getX() - popupW / 2;
                int y = screenPos.getY() + 4;

                // Keep within screen bounds
                auto* display = juce::Desktop::getInstance().getDisplays().getPrimaryDisplay();
                if (display != nullptr)
                {
                    auto screen = display->totalArea;
                    x = juce::jlimit(screen.getX(), screen.getRight() - popupW, x);
                    y = juce::jlimit(screen.getY(), screen.getBottom() - popupH, y);
                }

                miniPlayerWindow->showAt(x, y);
            }
        }

        MainWindow& mainWindow;
        std::unique_ptr<MiniPlayerWindow> miniPlayerWindow;
    };

    std::unique_ptr<MainWindow> mainWindow;
    std::unique_ptr<TrayIcon>   trayIcon;
};

//==============================================================================
START_JUCE_APPLICATION(MixPlayerApplication)
