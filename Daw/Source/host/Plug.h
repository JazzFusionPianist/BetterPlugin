#pragma once
/*  Slur Studio — a plug-in from another maker, as the engine sees it.

    Nothing in here names the library the app was first built on: these are the app's own words for a plug-in, so that
    what opens one (the Mac's own audio-unit calls in Au.mm today) can be changed without the engine hearing of it.
    Plain C++ only — no JUCE, no Objective-C — so anything may include it.

    What a plug-in is asked, and by whom:
      the main thread      prepare, state, setState, view, latency, offline, the list of controls
      the thread that plays   process, setControl (before the block it is to act on), control
    A plug-in is never asked two things at once from two threads: whoever holds it sees to that (the engine's lock). */

#include <cstddef>
#include <cstdint>
#include <functional>
#include <memory>
#include <string>
#include <vector>

namespace slur
{

/** Where the song is while a block is played: what a delay that follows the tempo, or an instrument's arpeggio, asks. */
struct Clock
{
    double  bpm     = 120.0;
    double  beat    = 0.0;        // quarter notes from the song's beginning, at the block's first sample
    double  barBeat = 0.0;        // … and the quarter note the bar it is in began on
    int     num = 4, den = 4;
    bool    playing = false;
    int64_t sample  = 0;          // samples from the song's beginning
};

/** One thing played to an instrument: a key down or up, a wheel, a pedal — the three bytes as they come off a keyboard. */
struct Note
{
    int     at = 0;               // samples into the block
    uint8_t bytes[3] = { 0, 0, 0 };
};

/** One audio unit on this Mac, as a list shows it. */
struct Found
{
    uint32_t    type = 0, sub = 0, maker = 0;      // the four letters of each
    std::string name, makerName;
    bool        instrument = false;
};

class Plug
{
public:
    virtual ~Plug() = default;

    virtual std::string name() const = 0;
    virtual bool instrument() const = 0;

    /** Made ready to play at this rate, in blocks no longer than this. keyWanted: how many channels its second input —
        what a compressor listens to in place of its own sound — should have (0: closed). False: it would not take
        stereo in and out, and is not ready. */
    virtual bool prepare (double rate, int block, int keyWanted) = 0;
    virtual int inputs() const = 0;
    virtual int outputs() const = 0;
    virtual int keyChannels() const = 0;           // what the second input really opened with
    virtual bool hasKey() const = 0;               // it has a second input at all (asked once it has been made ready)
    virtual void release() = 0;                    // no longer ready to play: what it held for that is given back
    virtual void reset() = 0;                      // tails and held notes are dropped (the song stopped, or jumped)

    /** Plays n samples in place. kL, kR: the second input (either may be null: silence). notes: in order of `at`. */
    virtual void process (float* L, float* R, int n, const float* kL, const float* kR,
                          const Note* notes, int count, const Clock& clock) = 0;

    virtual int  latency() const = 0;              // samples, as it is now
    virtual void offline (bool on) = 0;            // a print plays it: nothing waits on the clock

    virtual int         controls() const = 0;
    virtual std::string controlName (int index) const = 0;
    virtual float       control (int index) const = 0;            // 0..1
    virtual void        setControl (int index, float v) = 0;      // 0..1
    virtual bool        controlLine (int index) const = 0;        // a line may be drawn for it (it may be moved while it plays)
    virtual int         controlSteps (int index) const = 0;       // how many places it has, when it moves in steps; 0: freely
    virtual bool        controlSwitch (int index) const = 0;      // on or off
    virtual std::string controlUnit (int index) const = 0;        // "dB", "Hz", … or nothing
    virtual float       controlScaled (int index, float v) const = 0;      // 0..1 as the control's own number
    /** The plug-in's own words for where the control would stand at v (0..1). False: it has none, the number is the text. */
    virtual bool        controlWords (int index, float v, std::string& words) const = 0;
    /** The check's hand: the control moved the way the plug-in's own window moves it (everyone listening is told). */
    virtual void        touch (int index, float v) = 0;

    /** All of its settings as it would keep them in a song, and put back. */
    virtual std::vector<uint8_t> state() const = 0;
    virtual bool setState (const void* bytes, size_t size) = 0;

    /** Its own window's content: an NSView*, kept by the plug-in until it goes; null if it has none to give. sizes: it
        may be made larger. Answered at once, or — a unit of the newer kind — in its own time, on the main thread. */
    virtual void view (std::function<void (void* nsView, int w, int h, bool sizes)> got) = 0;

    /** It runs in a process of its own and that process is gone: it plays nothing more (the sound goes by untouched). */
    virtual bool lost() const = 0;

    /** A control was moved in its own window (the main thread). */
    std::function<void (int index)> touched;
};

/** Every effect and instrument audio unit this Mac knows, without opening any. */
std::vector<Found> listAudioUnits();

/** Opens one. apart: in a process of its own, so that it cannot take the app down with it. The answer — the plug-in,
    or null and why — comes on the main thread, later (never from inside this call). */
void openAudioUnit (uint32_t type, uint32_t sub, uint32_t maker, bool apart,
                    std::function<void (std::unique_ptr<Plug>, std::string why)> opened);

/** A window of the Mac's own for a plug-in's view: titled, with a close button, as large as the view and following it
    when the plug-in changes its size. closed: the close button was pressed (the window stays until it is let go of). */
class PlugWindow
{
public:
    virtual ~PlugWindow() = default;
    virtual void front() = 0;
    static std::unique_ptr<PlugWindow> open (const std::string& title, void* nsView, bool sizes, std::function<void()> closed);

    /** The space bar, return or v, pressed while a plug-in's window has the keys and wanted by nothing in it: the app's
        (play and stop, to the beginning, the plug-ins' windows away). code: "Space", "Enter" or "KeyV". Answers whether
        it was taken. The main thread. */
    static inline std::function<bool (const std::string& code, bool shift)> key;
    /** A plug-in's window (this kind, or the one JUCE makes: a view in it) stays over the app's own windows — a press on
        the room behind it does not put it out of sight — and goes away with the app when another app is in front. */
    static void keepOver (void* nsView);
    /** Is the key being handled now one that repeats because it is held down. */
    static bool keyRepeats();
    /** Where on the keyboard the key being handled now sits (the Mac's number for it: 9 is v, whatever the keyboard is set to), or -1. */
    static int keyCodeNow();
    /** For the self-test: how the plug-ins' windows stand, as JSON; pressSpace: the space bar is sent to the first, the Mac's way. */
    static std::string check (bool pressSpace, int keyCode = 49, bool posted = false);      // (keyCode: 49 space, 47 period, 43 comma; posted: as the Mac hands a key in — through the app, past its watch)
};

} // namespace slur
