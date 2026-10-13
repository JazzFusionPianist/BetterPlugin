/*  Slur Studio — an audio unit, opened with the Mac's own calls (AudioToolbox), with no library in between.

    What this must agree on with the way the app opened audio units before, so that a song made then plays the same:
      settings   the unit's own "class info" property list, written as a binary property list
      controls   in the unit's own order, except that controls the unit puts in a group stand together where the
                 group's first one stands; a value is 0..1 across the control's own least and greatest
      sound      stereo in, stereo out, 32-bit float, one buffer a channel

    Compiled with ARC. */

#include "Plug.h"

#import <AudioToolbox/AudioToolbox.h>
#import <AudioToolbox/AudioUnitUtilities.h>
#import <AudioUnit/AUCocoaUIView.h>
#import <CoreAudioKit/CoreAudioKit.h>
#import <Cocoa/Cocoa.h>

#include <algorithm>
#include <atomic>
#include <cmath>
#include <cstring>

namespace
{

std::string text (CFStringRef s)
{
    if (s == nullptr) return {};
    NSString* n = (__bridge NSString*) s;
    return n.UTF8String != nullptr ? std::string (n.UTF8String) : std::string();
}

AudioStreamBasicDescription floats (double rate, int channels)
{
    AudioStreamBasicDescription f {};
    f.mSampleRate = rate; f.mFormatID = kAudioFormatLinearPCM;
    f.mFormatFlags = kAudioFormatFlagsNativeFloatPacked | kAudioFormatFlagIsNonInterleaved;
    f.mBitsPerChannel = 32; f.mChannelsPerFrame = (UInt32) channels; f.mFramesPerPacket = 1;
    f.mBytesPerFrame = 4; f.mBytesPerPacket = 4;
    return f;
}

struct Au final : slur::Plug
{
    AudioUnit   au = nullptr;
    std::string named;
    bool        plays = false, apart = false, ready = false;
    double      rate = 0.0;
    int         nIn = 2, nOut = 2, nKey = 0;
    Float64     clockSamples = 0.0;
    std::atomic<bool> gone { false };

    /* what the block being played is made of: read by the unit, through `pull`, while it renders */
    const float* inL = nullptr; const float* inR = nullptr; const float* keyL = nullptr; const float* keyR = nullptr;
    slur::Clock  now;
    std::vector<float> silence;

    struct Control { AudioUnitParameterID id = 0; float least = 0.0f, range = 0.0f; std::string name, unit; bool line = true, steps = false, onOff = false, words = false; };
    std::vector<Control> list;
    AUEventListenerRef   ear = nullptr;
    NSView*              shown = nil;

    ~Au() override
    {
        *alive = false;
        shown = nil; held = nil;
        if (ear != nullptr) AUListenerDispose (ear);
        if (au != nullptr) { if (ready) AudioUnitUninitialize (au); AudioComponentInstanceDispose (au); }
    }

    std::string name() const override   { return named; }
    bool instrument() const override    { return plays; }
    int inputs() const override         { return nIn; }
    int outputs() const override        { return nOut; }
    int keyChannels() const override    { return nKey; }
    bool hasKey() const override        { return elements (kAudioUnitScope_Input) > 1; }
    void release() override             { if (ready) { AudioUnitUninitialize (au); ready = false; } }
    void reset() override               { if (ready) AudioUnitReset (au, kAudioUnitScope_Global, 0); }
    bool lost() const override          { return gone.load(); }

    template <typename T> bool set (AudioUnitPropertyID p, AudioUnitScope scope, UInt32 el, const T& v)
    {
        return AudioUnitSetProperty (au, p, scope, el, &v, sizeof (T)) == noErr;
    }
    UInt32 elements (AudioUnitScope scope) const
    {
        UInt32 n = 0, size = sizeof (n);
        return AudioUnitGetProperty (au, kAudioUnitProperty_ElementCount, scope, 0, &n, &size) == noErr ? n : 0;
    }

    bool prepare (double r, int block, int keyWanted) override
    {
        if (ready) { AudioUnitUninitialize (au); ready = false; }
        rate = r; nKey = 0;
        silence.assign ((size_t) block, 0.0f);
        const UInt32 ins = elements (kAudioUnitScope_Input);
        /* stereo out; in as the unit takes it — stereo, else one channel */
        if (! set (kAudioUnitProperty_StreamFormat, kAudioUnitScope_Output, 0, floats (rate, 2)))
        {
            if (! set (kAudioUnitProperty_StreamFormat, kAudioUnitScope_Output, 0, floats (rate, 1))) return false;
            nOut = 1;
        }
        else nOut = 2;
        nIn = 0;
        if (ins > 0)
        {
            if (set (kAudioUnitProperty_StreamFormat, kAudioUnitScope_Input, 0, floats (rate, 2))) nIn = 2;
            else if (set (kAudioUnitProperty_StreamFormat, kAudioUnitScope_Input, 0, floats (rate, 1))) nIn = 1;
            else if (! plays) return false;
            if (nIn > 0) set (kAudioUnitProperty_SetRenderCallback, kAudioUnitScope_Input, 0, AURenderCallbackStruct { &Au::pull, this });
        }
        /* the second input, only while something is given to it: in stereo if the unit takes that, else one channel */
        if (ins > 1)
        {
            if (keyWanted > 0)
            {
                if (keyWanted > 1 && set (kAudioUnitProperty_StreamFormat, kAudioUnitScope_Input, 1, floats (rate, 2))) nKey = 2;
                else if (set (kAudioUnitProperty_StreamFormat, kAudioUnitScope_Input, 1, floats (rate, 1))) nKey = 1;
            }
            set (kAudioUnitProperty_SetRenderCallback, kAudioUnitScope_Input, 1,
                 nKey > 0 ? AURenderCallbackStruct { &Au::pull, this } : AURenderCallbackStruct { nullptr, nullptr });
        }
        set (kAudioUnitProperty_MaximumFramesPerSlice, kAudioUnitScope_Global, 0, (UInt32) block);
        HostCallbackInfo host {};
        host.hostUserData = this; host.beatAndTempoProc = &Au::tempo; host.musicalTimeLocationProc = &Au::place; host.transportStateProc = &Au::rolling;
        set (kAudioUnitProperty_HostCallbacks, kAudioUnitScope_Global, 0, host);
        if (AudioUnitInitialize (au) != noErr) return false;
        ready = true; clockSamples = 0.0;
        if (! listed) readControls();                  // (only a unit that named no controls when it was opened is asked again now)
        return true;
    }

    /* the unit asks for its input while it renders: bus 0 is the track's own sound, bus 1 what it listens to */
    static OSStatus pull (void* self, AudioUnitRenderActionFlags*, const AudioTimeStamp*, UInt32 bus, UInt32 n, AudioBufferList* io)
    {
        auto& a = *static_cast<Au*> (self);
        const float* src[2] = { bus == 0 ? a.inL : a.keyL, bus == 0 ? a.inR : a.keyR };
        if (src[1] == nullptr) src[1] = src[0];
        for (UInt32 i = 0; i < io->mNumberBuffers; ++i)
        {
            const float* s = src[i < 2 ? i : 1];
            if (s == nullptr || n > a.silence.size()) s = a.silence.data();
            if (io->mBuffers[i].mData == nullptr) io->mBuffers[i].mData = const_cast<float*> (s);
            else std::memcpy (io->mBuffers[i].mData, s, sizeof (float) * (size_t) std::min<UInt32> (n, (UInt32) a.silence.size()));
        }
        return noErr;
    }
    static OSStatus tempo (void* self, Float64* beat, Float64* bpm)
    {
        auto& a = *static_cast<Au*> (self);
        if (beat != nullptr) *beat = a.now.beat;
        if (bpm != nullptr)  *bpm = a.now.bpm;
        return noErr;
    }
    static OSStatus place (void* self, UInt32* toNextBeat, Float32* num, UInt32* den, Float64* barBeat)
    {
        auto& a = *static_cast<Au*> (self);
        if (toNextBeat != nullptr)
        {
            const double left = std::ceil (a.now.beat) - a.now.beat;
            *toNextBeat = (UInt32) std::llround (left * 60.0 / std::max (1.0, a.now.bpm) * a.rate);
        }
        if (num != nullptr) *num = (Float32) a.now.num;
        if (den != nullptr) *den = (UInt32) a.now.den;
        if (barBeat != nullptr) *barBeat = a.now.barBeat;
        return noErr;
    }
    static OSStatus rolling (void* self, Boolean* playing, Boolean* changed, Float64* sample, Boolean* cycling, Float64* from, Float64* to)
    {
        auto& a = *static_cast<Au*> (self);
        if (playing != nullptr) *playing = a.now.playing;
        if (changed != nullptr) *changed = false;
        if (sample != nullptr)  *sample = (Float64) a.now.sample;
        if (cycling != nullptr) *cycling = false;
        if (from != nullptr) *from = 0.0;
        if (to != nullptr)   *to = 0.0;
        return noErr;
    }

    void process (float* L, float* R, int n, const float* kL, const float* kR, const slur::Note* notes, int count, const slur::Clock& clock) override
    {
        if (! ready || n <= 0 || gone.load()) return;
        inL = L; inR = R; keyL = kL; keyR = kR; now = clock;
        for (int i = 0; i < count; ++i)
            MusicDeviceMIDIEvent (au, notes[i].bytes[0], notes[i].bytes[1], notes[i].bytes[2], (UInt32) std::max (0, std::min (n - 1, notes[i].at)));
        struct { AudioBufferList list; AudioBuffer second; } out;
        out.list.mNumberBuffers = (UInt32) nOut;
        for (int i = 0; i < nOut; ++i) out.list.mBuffers[i] = AudioBuffer { 1, (UInt32) (sizeof (float) * (size_t) n), nullptr };   // the unit hands over its own
        AudioUnitRenderActionFlags flags = 0;
        AudioTimeStamp when {}; when.mSampleTime = clockSamples; when.mFlags = kAudioTimeStampSampleTimeValid;
        const OSStatus err = AudioUnitRender (au, &flags, &when, 0, (UInt32) n, &out.list);
        clockSamples += n;
        if (err != noErr)
        {
            if (apart) gone.store (true);                  // its process went: what came in goes on as it is
            return;
        }
        const auto* l = static_cast<const float*> (out.list.mBuffers[0].mData);
        const auto* r = static_cast<const float*> (out.list.mBuffers[nOut > 1 ? 1 : 0].mData);
        if (l == nullptr || r == nullptr) return;
        if (l != L) std::memmove (L, l, sizeof (float) * (size_t) n);
        if (r != R) std::memmove (R, r, sizeof (float) * (size_t) n);
    }

    int latency() const override
    {
        Float64 sec = 0.0; UInt32 size = sizeof (sec);
        if (AudioUnitGetProperty (au, kAudioUnitProperty_Latency, kAudioUnitScope_Global, 0, &sec, &size) != noErr || ! (sec >= 0.0 && sec < 60.0)) return 0;
        return (int) std::llround (sec * rate);
    }
    void offline (bool on) override { set (kAudioUnitProperty_OfflineRender, kAudioUnitScope_Global, 0, (UInt32) (on ? 1 : 0)); }

    /*  The controls are read once, when the unit has just been opened and nothing has been set on it yet — as the app
        always read them. It matters: a unit may name more controls once it is made ready (meters), and a control whose
        greatest value follows the sample rate (a filter's frequency) then has another range — and a song keeps a
        control by its place in the list and its 0..1 along the range it had. */
    bool listed = false;
    void readControls()
    {
        list.clear();
        UInt32 size = 0; Boolean writable = false;
        if (AudioUnitGetPropertyInfo (au, kAudioUnitProperty_ParameterList, kAudioUnitScope_Global, 0, &size, &writable) != noErr || size == 0) return;
        std::vector<AudioUnitParameterID> ids (size / sizeof (AudioUnitParameterID));
        if (AudioUnitGetProperty (au, kAudioUnitProperty_ParameterList, kAudioUnitScope_Global, 0, ids.data(), &size) != noErr) return;
        struct Read { Control c; bool grouped = false; UInt32 group = 0; };
        std::vector<Read> all;
        for (auto id : ids)
        {
            AudioUnitParameterInfo info {}; UInt32 s = sizeof (info);
            if (AudioUnitGetProperty (au, kAudioUnitProperty_ParameterInfo, kAudioUnitScope_Global, id, &info, &s) != noErr) continue;
            Read r; r.c.id = id; r.c.least = info.minValue; r.c.range = info.maxValue - info.minValue;
            if ((info.flags & kAudioUnitParameterFlag_HasCFNameString) != 0 && info.cfNameString != nullptr)
            {
                r.c.name = text (info.cfNameString);
                if ((info.flags & kAudioUnitParameterFlag_CFNameRelease) != 0) CFRelease (info.cfNameString);
            }
            else r.c.name = std::string (info.name, strnlen (info.name, sizeof (info.name)));
            r.grouped = (info.flags & kAudioUnitParameterFlag_HasClump) != 0; r.group = info.clumpID;
            r.c.line = (info.flags & kAudioUnitParameterFlag_NonRealTime) == 0;
            r.c.steps = info.unit == kAudioUnitParameterUnit_Indexed || info.unit == kAudioUnitParameterUnit_Boolean;
            r.c.onOff = info.unit == kAudioUnitParameterUnit_Boolean;
            r.c.words = (info.flags & kAudioUnitParameterFlag_ValuesHaveStrings) != 0;
            switch (info.unit)
            {
                case kAudioUnitParameterUnit_CustomUnit:   r.c.unit = text (info.unitName); break;
                case kAudioUnitParameterUnit_Percent:      r.c.unit = "%"; break;
                case kAudioUnitParameterUnit_Seconds:      r.c.unit = "s"; break;
                case kAudioUnitParameterUnit_Hertz:        r.c.unit = "Hz"; break;
                case kAudioUnitParameterUnit_Decibels:     r.c.unit = "dB"; break;
                case kAudioUnitParameterUnit_Milliseconds: r.c.unit = "ms"; break;
                default: break;
            }
            all.push_back (std::move (r));
        }
        /* a group's controls stand together, where its first one stood */
        std::vector<bool> placed (all.size(), false);
        for (size_t i = 0; i < all.size(); ++i)
        {
            if (placed[i]) continue;
            list.push_back (all[i].c); placed[i] = true;
            if (all[i].grouped)
                for (size_t k = i + 1; k < all.size(); ++k)
                    if (! placed[k] && all[k].grouped && all[k].group == all[i].group) { list.push_back (all[k].c); placed[k] = true; }
        }
        listed = ! list.empty();
        /* told on the main thread when one is moved in the unit's own window */
        if (ear == nullptr && AUEventListenerCreate (&Au::heard, this, CFRunLoopGetMain(), kCFRunLoopDefaultMode, 0.05f, 0.05f, &ear) == noErr)
            for (auto& c : list)
            {
                AudioUnitEvent e {}; e.mEventType = kAudioUnitEvent_ParameterValueChange;
                e.mArgument.mParameter.mAudioUnit = au; e.mArgument.mParameter.mParameterID = c.id;
                e.mArgument.mParameter.mScope = kAudioUnitScope_Global; e.mArgument.mParameter.mElement = 0;
                AUEventListenerAddEventType (ear, this, &e);
            }
    }
    static void heard (void* self, void*, const AudioUnitEvent* e, UInt64, AudioUnitParameterValue)
    {
        auto& a = *static_cast<Au*> (self);
        if (e == nullptr || e->mEventType != kAudioUnitEvent_ParameterValueChange || ! a.touched) return;
        for (size_t i = 0; i < a.list.size(); ++i)
            if (a.list[i].id == e->mArgument.mParameter.mParameterID) { a.touched ((int) i); return; }
    }

    int controls() const override { return (int) list.size(); }
    std::string controlName (int i) const override { return i >= 0 && i < (int) list.size() ? list[(size_t) i].name : std::string(); }
    float control (int i) const override
    {
        if (i < 0 || i >= (int) list.size()) return 0.0f;
        const auto& c = list[(size_t) i];
        AudioUnitParameterValue v = 0.0f;
        if (AudioUnitGetParameter (au, c.id, kAudioUnitScope_Global, 0, &v) != noErr || c.range == 0.0f) return 0.0f;
        return (v - c.least) / c.range;
    }
    void setControl (int i, float v) override
    {
        if (i < 0 || i >= (int) list.size()) return;
        const auto& c = list[(size_t) i];
        AudioUnitSetParameter (au, c.id, kAudioUnitScope_Global, 0, c.least + c.range * std::max (0.0f, std::min (1.0f, v)), 0);
        /* its own window follows; the app's own ear is left out, so a line that moves a control is not taken for a hand */
        AudioUnitEvent e {}; e.mEventType = kAudioUnitEvent_ParameterValueChange;
        e.mArgument.mParameter.mAudioUnit = au; e.mArgument.mParameter.mParameterID = c.id;
        e.mArgument.mParameter.mScope = kAudioUnitScope_Global; e.mArgument.mParameter.mElement = 0;
        AUEventListenerNotify (ear, nullptr, &e);
    }

    const Control* at (int i) const { return i >= 0 && i < (int) list.size() ? &list[(size_t) i] : nullptr; }
    bool controlLine (int i) const override   { auto* c = at (i); return c != nullptr && c->line; }
    int  controlSteps (int i) const override  { auto* c = at (i); return c != nullptr && c->steps ? (int) (c->range + 1.0f) : 0; }
    bool controlSwitch (int i) const override { auto* c = at (i); return c != nullptr && c->onOff; }
    std::string controlUnit (int i) const override { auto* c = at (i); return c != nullptr ? c->unit : std::string(); }
    float controlScaled (int i, float v) const override { auto* c = at (i); return c != nullptr ? c->least + c->range * v : 0.0f; }
    bool controlWords (int i, float v, std::string& words) const override
    {
        auto* c = at (i);
        if (c == nullptr || ! c->words) return false;
        AudioUnitParameterValue scaled = c->least + c->range * v;
        AudioUnitParameterStringFromValue ask {}; ask.inParamID = c->id; ask.inValue = &scaled; ask.outString = nullptr;
        UInt32 size = sizeof (ask);
        if (AudioUnitGetProperty (au, kAudioUnitProperty_ParameterStringFromValue, kAudioUnitScope_Global, 0, &ask, &size) != noErr || ask.outString == nullptr) return false;
        words = text (ask.outString); CFRelease (ask.outString);
        return true;
    }
    void touch (int i, float v) override
    {
        auto* c = at (i);
        if (c == nullptr) return;
        AudioUnitParameter prm {}; prm.mAudioUnit = au; prm.mParameterID = c->id; prm.mScope = kAudioUnitScope_Global;
        AUParameterSet (nullptr, nullptr, &prm, c->least + c->range * std::max (0.0f, std::min (1.0f, v)), 0);
    }

    std::vector<uint8_t> state() const override
    {
        std::vector<uint8_t> out;
        CFPropertyListRef info = nullptr; UInt32 size = sizeof (info);
        if (AudioUnitGetProperty (au, kAudioUnitProperty_ClassInfo, kAudioUnitScope_Global, 0, &info, &size) != noErr || info == nullptr) return out;
        if (CFDataRef d = CFPropertyListCreateData (kCFAllocatorDefault, info, kCFPropertyListBinaryFormat_v1_0, 0, nullptr))
        {
            out.assign (CFDataGetBytePtr (d), CFDataGetBytePtr (d) + CFDataGetLength (d));
            CFRelease (d);
        }
        CFRelease (info);
        return out;
    }
    bool setState (const void* bytes, size_t size) override
    {
        if (bytes == nullptr || size == 0) return false;
        CFDataRef d = CFDataCreate (kCFAllocatorDefault, static_cast<const UInt8*> (bytes), (CFIndex) size);
        if (d == nullptr) return false;
        CFPropertyListRef info = CFPropertyListCreateWithData (kCFAllocatorDefault, d, kCFPropertyListImmutable, nullptr, nullptr);
        CFRelease (d);
        if (info == nullptr) return false;
        const bool ok = AudioUnitSetProperty (au, kAudioUnitProperty_ClassInfo, kAudioUnitScope_Global, 0, &info, sizeof (info)) == noErr;
        CFRelease (info);
        if (ok)
        {
            AudioUnitParameter any {}; any.mAudioUnit = au; any.mParameterID = kAUParameterListener_AnyParameter;
            AUParameterListenerNotify (nullptr, nullptr, &any);
        }
        return ok;
    }

    void view (std::function<void (void*, int, int, bool)> got) override
    {
        if (shown != nil) { answer (got); return; }
        /* its own view, the older way: a class in a bundle the unit names */
        UInt32 size = 0; Boolean writable = false;
        if (AudioUnitGetPropertyInfo (au, kAudioUnitProperty_CocoaUI, kAudioUnitScope_Global, 0, &size, &writable) == noErr && size >= sizeof (AudioUnitCocoaViewInfo))
        {
            std::vector<uint8_t> raw (size);
            auto* info = reinterpret_cast<AudioUnitCocoaViewInfo*> (raw.data());
            if (AudioUnitGetProperty (au, kAudioUnitProperty_CocoaUI, kAudioUnitScope_Global, 0, info, &size) == noErr)
            {
                NSURL* where = (__bridge_transfer NSURL*) info->mCocoaAUViewBundleLocation;
                const UInt32 classes = (size - (UInt32) sizeof (CFURLRef)) / (UInt32) sizeof (CFStringRef);
                NSString* cls = classes > 0 ? (__bridge NSString*) info->mCocoaAUViewClass[0] : nil;
                NSBundle* bundle = where != nil ? [NSBundle bundleWithURL: where] : nil;
                Class made = (bundle != nil && cls != nil) ? [bundle classNamed: cls] : Nil;
                if (made != Nil && [made conformsToProtocol: @protocol (AUCocoaUIBase)])
                {
                    id<AUCocoaUIBase> maker = [[made alloc] init];
                    shown = [maker uiViewForAudioUnit: au withSize: NSMakeSize (0, 0)];
                }
                for (UInt32 i = 0; i < classes; ++i) if (info->mCocoaAUViewClass[i] != nullptr) CFRelease (info->mCocoaAUViewClass[i]);
            }
        }
        if (shown != nil) { answer (got); return; }
        /* the newer way: the unit is asked for a view controller, and answers in its own time. The answer is taken on
           the main thread; should the unit be gone by then, `alive` says so */
        if (AudioUnitGetPropertyInfo (au, kAudioUnitProperty_RequestViewController, kAudioUnitScope_Global, 0, &size, &writable) == noErr && writable)
        {
            std::shared_ptr<bool> here = alive;
            Au* self = this;
            void (^answered) (AUViewControllerBase*) = ^(AUViewControllerBase* c)
            {
                dispatch_async (dispatch_get_main_queue(), ^{
                    if (! *here) return;
                    if (c != nil) { self->held = c; self->shown = c.view; }
                    if (self->shown == nil) self->shown = [[AUGenericView alloc] initWithAudioUnit: self->au];
                    self->answer (got);
                });
            };
            if (AudioUnitSetProperty (au, kAudioUnitProperty_RequestViewController, kAudioUnitScope_Global, 0, &answered, sizeof (answered)) == noErr) return;
        }
        /* none of its own: the Mac's plain list of its controls */
        shown = [[AUGenericView alloc] initWithAudioUnit: au];
        answer (got);
    }
    void answer (const std::function<void (void*, int, int, bool)>& got)
    {
        if (! got) return;
        if (shown == nil) { got (nullptr, 0, 0, false); return; }
        got ((__bridge void*) shown, (int) std::lround (shown.frame.size.width), (int) std::lround (shown.frame.size.height),
             (shown.autoresizingMask & (NSViewWidthSizable | NSViewHeightSizable)) != 0);
    }
    std::shared_ptr<bool> alive = std::make_shared<bool> (true);
    NSViewController* held = nil;
};

} // namespace

namespace slur
{

std::vector<Found> listAudioUnits()
{
    std::vector<Found> out;
    for (const OSType type : { kAudioUnitType_Effect, kAudioUnitType_MusicEffect, kAudioUnitType_MusicDevice })
    {
        AudioComponentDescription want {}; want.componentType = type;
        for (AudioComponent c = AudioComponentFindNext (nullptr, &want); c != nullptr; c = AudioComponentFindNext (c, &want))
        {
            AudioComponentDescription d {};
            if (AudioComponentGetDescription (c, &d) != noErr) continue;
            Found f; f.type = d.componentType; f.sub = d.componentSubType; f.maker = d.componentManufacturer;
            f.instrument = d.componentType == kAudioUnitType_MusicDevice;
            CFStringRef full = nullptr;
            if (AudioComponentCopyName (c, &full) == noErr && full != nullptr)
            {
                /* "maker: name", as the Mac keeps it */
                const std::string s = text (full); CFRelease (full);
                const auto cut = s.find (": ");
                if (cut != std::string::npos) { f.makerName = s.substr (0, cut); f.name = s.substr (cut + 2); } else f.name = s;
            }
            out.push_back (std::move (f));
        }
    }
    return out;
}

void openAudioUnit (uint32_t type, uint32_t sub, uint32_t maker, bool apart, std::function<void (std::unique_ptr<Plug>, std::string)> opened)
{
    auto fail = [opened] (std::string why) { dispatch_async (dispatch_get_main_queue(), ^{ opened (nullptr, why); }); };
    AudioComponentDescription want {}; want.componentType = type; want.componentSubType = sub; want.componentManufacturer = maker;
    AudioComponent c = AudioComponentFindNext (nullptr, &want);
    if (c == nullptr) { fail ("this Mac has no such audio unit"); return; }
    std::string named;
    CFStringRef full = nullptr;
    if (AudioComponentCopyName (c, &full) == noErr && full != nullptr)
    {
        const std::string s = text (full); CFRelease (full);
        const auto cut = s.find (": ");
        named = cut != std::string::npos ? s.substr (cut + 2) : s;
    }
    /* the Mac opens it — in the app, or in a process of its own that it starts for it — and answers on a thread of its
       choosing; the unit is handed to the main thread from there */
    AudioComponentInstantiate (c, apart ? kAudioComponentInstantiation_LoadOutOfProcess : kAudioComponentInstantiation_LoadInProcess,
                               ^(AudioComponentInstance got, OSStatus err)
    {
        dispatch_async (dispatch_get_main_queue(), ^{
            if (err != noErr || got == nullptr) { opened (nullptr, std::string (apart ? "it would not open in a process of its own (" : "it would not open (") + std::to_string ((int) err) + ")"); return; }
            auto a = std::make_unique<Au>();
            a->au = got; a->apart = apart; a->plays = type == kAudioUnitType_MusicDevice; a->named = named;
            a->readControls();
            opened (std::move (a), {});
        });
    });
}

} // namespace slur
