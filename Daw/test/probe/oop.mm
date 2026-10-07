// a probe, apart from the app: can a version-2 audio unit be opened in a process of its own, does it still make sound,
// what does a block cost that way, and does this process live on when that one is killed?
#import <AudioToolbox/AudioToolbox.h>
#import <AVFoundation/AVFoundation.h>
#import <Foundation/Foundation.h>
#include <mach/mach_time.h>
#include <vector>
#include <cmath>
#include <cstdio>
#include <unistd.h>
#include <signal.h>
#include <cstring>

static double nowSec() { static mach_timebase_info_data_t tb; if (tb.denom == 0) mach_timebase_info (&tb); return (double) mach_absolute_time() * tb.numer / tb.denom * 1e-9; }
static std::vector<float> inL, inR;
static OSStatus feed (void*, AudioUnitRenderActionFlags*, const AudioTimeStamp*, UInt32, UInt32 n, AudioBufferList* io)
{
    for (UInt32 b = 0; b < io->mNumberBuffers; ++b) { float* d = (float*) io->mBuffers[b].mData; for (UInt32 i = 0; i < n; ++i) d[i] = 0.25f * std::sin ((float) i * 0.05f); }
    return noErr;
}
static pid_t hostingPid() { FILE* p = popen ("pgrep -n -f AUHostingService", "r"); char buf[64] = {0}; if (p) { fgets (buf, 63, p); pclose (p); } return (pid_t) atoi (buf); }

static int run (OSType type, OSType sub, OSType manu, bool outOfProcess, int block)
{
    AudioComponentDescription d = { type, sub, manu, 0, 0 };
    AudioComponent c = AudioComponentFindNext (nullptr, &d);
    if (! c) { printf ("  not found\n"); return 1; }
    const pid_t before = hostingPid();
    __block AudioUnit au = nullptr; __block OSStatus ierr = -1;
    dispatch_semaphore_t sem = dispatch_semaphore_create (0);
    const double t0 = nowSec();
    AudioComponentInstantiate (c, outOfProcess ? kAudioComponentInstantiation_LoadOutOfProcess : kAudioComponentInstantiation_LoadInProcess, ^(AudioComponentInstance i, OSStatus e) { au = i; ierr = e; dispatch_semaphore_signal (sem); });
    // the answer may need this thread's run loop: let it turn while waiting
    bool got = false;
    for (int k = 0; k < 400 && ! got; ++k) { CFRunLoopRunInMode (kCFRunLoopDefaultMode, 0.02, true); got = dispatch_semaphore_wait (sem, DISPATCH_TIME_NOW) == 0; }
    printf ("  %s: opened=%d err=%d in %.0f ms\n", outOfProcess ? "asked for a process of its own" : "in this process", au != nullptr, (int) ierr, (nowSec() - t0) * 1000);
    if (! au) return 2;
    usleep (300000);
    const pid_t after = hostingPid();
    printf ("  hosting process: before %d, after %d%s\n", before, after, after != 0 && after != before ? "  (a new one)" : "");
    AudioStreamBasicDescription f = {};
    f.mSampleRate = 44100; f.mFormatID = kAudioFormatLinearPCM; f.mFormatFlags = kAudioFormatFlagsNativeFloatPacked | kAudioFormatFlagIsNonInterleaved;
    f.mChannelsPerFrame = 2; f.mBitsPerChannel = 32; f.mBytesPerFrame = 4; f.mBytesPerPacket = 4; f.mFramesPerPacket = 1;
    OSStatus e1 = AudioUnitSetProperty (au, kAudioUnitProperty_StreamFormat, kAudioUnitScope_Input, 0, &f, sizeof (f));
    OSStatus e2 = AudioUnitSetProperty (au, kAudioUnitProperty_StreamFormat, kAudioUnitScope_Output, 0, &f, sizeof (f));
    UInt32 maxF = 4096; AudioUnitSetProperty (au, kAudioUnitProperty_MaximumFramesPerSlice, kAudioUnitScope_Global, 0, &maxF, sizeof (maxF));
    AURenderCallbackStruct cb = { feed, nullptr };
    OSStatus e3 = AudioUnitSetProperty (au, kAudioUnitProperty_SetRenderCallback, kAudioUnitScope_Input, 0, &cb, sizeof (cb));
    OSStatus e4 = AudioUnitInitialize (au);
    printf ("  formats %d %d, callback %d, initialise %d\n", (int) e1, (int) e2, (int) e3, (int) e4);
    if (e4 != noErr) { AudioComponentInstanceDispose (au); return 3; }
    std::vector<float> L ((size_t) block), R ((size_t) block);
    AudioBufferList* abl = (AudioBufferList*) calloc (1, sizeof (AudioBufferList) + sizeof (AudioBuffer));
    abl->mNumberBuffers = 2;
    AudioTimeStamp ts = {}; ts.mFlags = kAudioTimeStampSampleTimeValid;
    double worst = 0, sum = 0, peak = 0; int n = 0, errs = 0;
    const int blocks = (int) (44100.0 * 3 / block);
    for (int k = 0; k < blocks; ++k)
    {
        abl->mBuffers[0].mData = L.data(); abl->mBuffers[0].mDataByteSize = (UInt32) (block * 4); abl->mBuffers[0].mNumberChannels = 1;
        abl->mBuffers[1].mData = R.data(); abl->mBuffers[1].mDataByteSize = (UInt32) (block * 4); abl->mBuffers[1].mNumberChannels = 1;
        AudioUnitRenderActionFlags fl = 0;
        const double a = nowSec();
        const OSStatus e = AudioUnitRender (au, &fl, &ts, 0, (UInt32) block, abl);
        const double took = nowSec() - a;
        if (e != noErr) ++errs; else { const float* o = (const float*) abl->mBuffers[0].mData; for (int i = 0; i < block; ++i) peak = std::fmax (peak, std::fabs (o[i])); }
        if (k > 8) { sum += took; ++n; worst = std::fmax (worst, took); }
        ts.mSampleTime += block;
    }
    printf ("  %d blocks of %d: mean %.1f us, worst %.1f us, errors %d, loudest sample out %.3f\n", blocks, block, n ? sum / n * 1e6 : 0, worst * 1e6, errs, peak);
    // only a process that began in the last few seconds can be the one just made for this probe: no other is ever touched
    auto ageOf = [] (pid_t pid) { char cmd[96]; snprintf (cmd, sizeof (cmd), "ps -o etime= -p %d", (int) pid); FILE* p = popen (cmd, "r"); char buf[64] = {0}; if (p) { fgets (buf, 63, p); pclose (p); } int m = 0, sec = 0; if (strchr (buf, '-') != nullptr) return 999999; int parts[3] = {0, 0, 0}, n = sscanf (buf, " %d:%d:%d", &parts[0], &parts[1], &parts[2]); if (n == 2) { m = parts[0]; sec = parts[1]; } else if (n == 3) { m = parts[0] * 60 + parts[1]; sec = parts[2]; } else return 999999; return m * 60 + sec; };
    if (outOfProcess && after != 0 && after != before && ageOf (after) <= 8)
    {
        // the process the audio unit lives in is killed: what does the next block say, and are we still here?
        kill (after, SIGKILL);
        usleep (200000);
        int after1 = 0, bad = 0;
        for (int k = 0; k < 20; ++k)
        {
            abl->mBuffers[0].mData = L.data(); abl->mBuffers[0].mDataByteSize = (UInt32) (block * 4);
            abl->mBuffers[1].mData = R.data(); abl->mBuffers[1].mDataByteSize = (UInt32) (block * 4);
            AudioUnitRenderActionFlags fl = 0;
            const OSStatus e = AudioUnitRender (au, &fl, &ts, 0, (UInt32) block, abl);
            if (e != noErr) { ++bad; after1 = (int) e; }
            ts.mSampleTime += block;
        }
        printf ("  its process killed: this one is still here; of 20 blocks after it %d failed (error %d)\n", bad, after1);
    }
    AudioUnitUninitialize (au); AudioComponentInstanceDispose (au);
    free (abl);
    return 0;
}

int main (int argc, char** argv)
{
    @autoreleasepool
    {
        struct { const char* name; OSType t, s, m; } units[] = {
            { "apple AUDelay (version 2)", 'aufx', 'dely', 'appl' },
            { "apple AUMatrixReverb (version 2)", 'aufx', 'mrev', 'appl' },
        };
        for (auto& u : units)
            for (int block : { 512, 64 })
            {
                printf ("%s, block %d\n", u.name, block);
                run (u.t, u.s, u.m, false, block);
                run (u.t, u.s, u.m, true, block);
            }
    }
    return 0;
}
