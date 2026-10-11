#include <juce_gui_extra/juce_gui_extra.h>
#include <map>
#include "Engine.h"

/*  Slur DAW, alpha — the window.

    One web view fills it and shows the page in Daw/ui, which build.sh
    copies into the app (Contents/Resources/ui). The page reaches the engine through one native
    function, `daw (op, data)`; the engine reaches the page with events.

    A second web view is Slur itself: the plug-in's own page, laid over the place the room keeps
    for it at the right (the page says where that is).                    */

// Mac.mm
std::string slurAudioUnitMaker (unsigned int type, unsigned int sub, unsigned int manu);
void slurSnapshotWebView (void* nsView, const char* pngPath, bool slursOwn);
int slurMicStatus();
void slurFakeDrop (void* nsView, const char* path, double x, double y, void (*done) (int, void*), void* context);
bool slurInstallMenus (void (*picked) (const char*, void*), void* context);
std::string slurWindowReport (void* nsView, const char* pngPath);
std::string slurMenuTitles();
void slurStyleWindow (void* nsView);
int slurRunningCopy (bool forward, bool amongChecks);
double slurFootprintMb();
double slurSecondsUp();

#ifndef SLUR_DAW_UI_DIR
 #define SLUR_DAW_UI_DIR ""
#endif
#ifndef SLUR_APP_URL
 #define SLUR_APP_URL "https://better-plugin.vercel.app"
#endif

namespace
{
unsigned int fourCC (const juce::String& s)
{
    unsigned int v = 0;
    for (int i = 0; i < 4; ++i) v = (v << 8) | (unsigned int) (i < s.length() ? (s[i] & 0xff) : ' ');
    return v;
}

juce::String auMaker (const juce::String& ident)
{
    const auto codes = juce::StringArray::fromTokens (ident.fromFirstOccurrenceOf ("/", false, false), ",", "");
    if (codes.size() < 3) return {};
    const juce::String full (juce::CharPointer_UTF8 (slurAudioUnitMaker (fourCC (codes[0]), fourCC (codes[1]), fourCC (codes[2])).c_str()));
    return full.contains (": ") ? full.upToFirstOccurrenceOf (": ", false, false) : juce::String();
}

juce::var okVar (bool ok = true) { auto* o = new juce::DynamicObject(); o->setProperty ("ok", ok); return juce::var (o); }
/** --selftest runs the whole check; --selftest=slur only looks at slur's own page in its place; --selftest=second only
    says whether a copy of the app is already open, and goes; --selftest=bench only measures (see ui/bench.js). Empty
    when the app is just being used. */
juce::String selfTestMode()
{
    const auto args = juce::JUCEApplicationBase::getCommandLineParameters();
    if (! args.contains ("--selftest")) return {};
    if (! args.contains ("--selftest=")) return "all";
    const auto word = args.fromFirstOccurrenceOf ("--selftest=", false, false).upToFirstOccurrenceOf (" ", false, false).unquoted().trim();     // slur, second, or a part of the check by its name (bench…)
    return word.isEmpty() ? juce::String ("all") : word;
}

/*  Where things are kept. Projects live in Music/Slur Studio/Projects/<name>.sls (a folder the Finder shows as one file:
    project.json + audio/), which macOS lets an app use without asking; settings in Application Support. A project
    from before the name was settled (<name>.slur) is read and written where it is. (daw::musicRoot, in Engine.h.) */
juce::File projectsRoot() { return daw::musicRoot().getChildFile ("Projects"); }
juce::File projectDir (const juce::String& name)
{
    const auto n = juce::File::createLegalFileName (name.trim().isEmpty() ? juce::String ("untitled") : name.trim());
    const auto now = projectsRoot().getChildFile (n + ".sls"), old = projectsRoot().getChildFile (n + ".slur");
    return ! now.exists() && old.isDirectory() ? old : now;
}
/** The name of the project a file handed to the app stands for, when it is one of ours and lies where projects are kept. */
juce::String projectNamed (const juce::String& path)
{
    const juce::File f (path.unquoted().trim());
    const auto ext = f.getFileExtension().toLowerCase();
    if ((ext != ".sls" && ext != ".slur") || ! f.isDirectory() || f.getParentDirectory() != projectsRoot()) return {};
    return f.getFileNameWithoutExtension();
}
juce::File prefsFile() { return juce::File::getSpecialLocation (juce::File::userApplicationDataDirectory).getChildFile ("Application Support").getChildFile (daw::folderName()).getChildFile ("settings.json"); }
/** A folder kept under the program's old name comes to lie under its new one, whole and as it is — only when nothing lies
    under the new name yet (two that are both there are left, for a person to look at). -> what was done, in a word. */
juce::String takeOver (const juce::File& old, const juce::File& now)
{
    if (! old.isDirectory()) return "nothing";
    if (now.exists()) return "both";
    return now.getParentDirectory().createDirectory().wasOk() && old.moveFileTo (now) ? "moved" : "failed";
}
/** The settings name the last project, and the projects kept elsewhere, by where they lie: one that lay under the old
    folder is named under the new. -> whether anything was changed. */
bool placesRenamed (const juce::File& settings, const juce::String& oldRoot, const juce::String& newRoot)
{
    auto v = juce::JSON::parse (settings);
    auto* o = v.getDynamicObject();
    if (o == nullptr) return false;
    bool changed = false;
    const auto fix = [&] (const juce::var& x) -> juce::var
    {
        const auto s = x.toString();
        if (! x.isString() || ! s.startsWith (oldRoot + "/")) return x;
        changed = true;
        return newRoot + s.substring (oldRoot.length());
    };
    if (o->hasProperty ("lastProject")) o->setProperty ("lastProject", fix (o->getProperty ("lastProject")));
    if (auto* list = o->getProperty ("elsewhere").getArray()) for (auto& e : *list) e = fix (e);
    return changed && settings.replaceWithText (juce::JSON::toString (v));
}
/** The program was called Slur DAW until 2026-10-11. At a start, with no other copy of it open: the songs (Music), the
    settings and what a run leaves for the next (Application Support) come to lie under the new name; the sound kept
    ready under the old one is thrown away (it is found by where its file lies, and every file has just moved; it is
    made again); and the app itself under its old name goes to the Trash, so that it is never opened on an empty folder. */
void moveToNewName()
{
    const auto music = juce::File::getSpecialLocation (juce::File::userMusicDirectory);
    const auto support = juce::File::getSpecialLocation (juce::File::userApplicationDataDirectory).getChildFile ("Application Support");
    const auto oldMusic = music.getChildFile (daw::oldFolderName()), newMusic = music.getChildFile (daw::folderName());
    const auto songs = takeOver (oldMusic, newMusic);
    const auto kept = takeOver (support.getChildFile (daw::oldFolderName()), support.getChildFile (daw::folderName()));
    const bool places = songs == "moved" && placesRenamed (prefsFile(), oldMusic.getFullPathName(), newMusic.getFullPathName());
    juce::File::getSpecialLocation (juce::File::userHomeDirectory).getChildFile ("Library/Caches").getChildFile (daw::oldFolderName()).deleteRecursively();
    const juce::File oldApp ("/Applications/Slur DAW.app"), self = juce::File::getSpecialLocation (juce::File::currentApplicationFile);
    const bool app = oldApp.isDirectory() && oldApp != self && oldApp.getChildFile ("Contents/Info.plist").loadFileAsString().contains ("com.slurstudio.daw.alpha") && oldApp.moveToTrash();
    if (songs != "nothing" || kept != "nothing" || app)
        daw::logLine ("the old name (slur daw): songs " + songs + ", settings " + kept + (places ? ", places in the settings named anew" : "") + (app ? ", the app under its old name put in the trash" : ""));
}
/** Where the app keeps what it must find again at its next start (the mark that it is running, the plug-ins it has learnt
    not to trust). The check keeps its own, away from his. */
juce::File stateDir() { return selfTestMode().isNotEmpty() ? daw::musicRoot().getChildFile ("State") : prefsFile().getParentDirectory(); }
/** What the run before this one left behind, when it did not end by itself (see Recover.h); void otherwise. */
juce::var& lastRun() { static juce::var v; return v; }
/** A copy of the project as it stands on disk, put aside before it is written over — one every ten minutes of work at most,
    the last two dozen kept. So a song can be taken back to how it was earlier, whatever happened to it since. */
void keepBackup (const juce::File& dir, const juce::File& project, bool always = false)
{
    static std::map<juce::String, juce::int64> lastAt;
    if (! project.existsAsFile()) return;
    const auto now = juce::Time::currentTimeMillis();
    const auto key = dir.getFullPathName();
    const auto backups = dir.getChildFile ("backups");
    if (lastAt.count (key) == 0)
    {
        juce::int64 newest = 0;
        for (auto& f : backups.findChildFiles (juce::File::findFiles, false, "*.json")) newest = juce::jmax (newest, f.getLastModificationTime().toMilliseconds());
        lastAt[key] = newest;
    }
    if (! always && now - lastAt[key] < 10 * 60 * 1000) return;
    lastAt[key] = now;
    if (! backups.createDirectory().wasOk()) return;
    project.copyFileTo (backups.getNonexistentChildFile (juce::Time::getCurrentTime().formatted ("%Y-%m-%d %H%M%S"), ".json", false));      // (two in one second: the later one gets a number, and sorts after it)
    auto all = backups.findChildFiles (juce::File::findFiles, false, "*.json");
    std::sort (all.begin(), all.end(), [] (const juce::File& a, const juce::File& b) { return a.getFileName() > b.getFileName(); });
    for (int i = 24; i < all.size(); ++i) all.getReference (i).deleteFile();
}
juce::var withFile (juce::var decoded, const juce::String& file, const juce::String& name)
{
    if (auto* o = decoded.getDynamicObject()) { o->setProperty ("file", file); o->setProperty ("name", name); }
    return decoded;
}
}

//==============================================================================
class MainComponent final : public juce::Component, private juce::Timer, private juce::ChangeListener
{
public:
    MainComponent()
    {
        const bool test = selfTestMode().isNotEmpty();
        {
            // the device as it was left: which one, its rate and block, its channels (the self-test always takes the default)
            std::unique_ptr<juce::XmlElement> saved;
            if (! test) { const auto prefs = juce::JSON::parse (prefsFile()); if (prefs["audio"].isString()) saved = juce::parseXML (prefs["audio"].toString()); }
            engine.start (saved.get());
        }
        if (! test) engine.devices().addChangeListener (this);
        engine.onRateChanged = [this] { auto* o = new juce::DynamicObject(); o->setProperty ("sr", engine.sr); if (web) web->emitEventIfBrowserIsVisible ("dawRate", juce::var (o)); };
        engine.onTakeStalled = [this] (bool rate) { auto* o = new juce::DynamicObject(); o->setProperty ("rate", rate); if (web) web->emitEventIfBrowserIsVisible ("dawTakeStalled", juce::var (o)); };
        engine.onSoundCut = [this] (const juce::String& name, double held, double whole, bool disk) { auto* o = new juce::DynamicObject(); o->setProperty ("name", name); o->setProperty ("held", held); o->setProperty ("whole", whole); o->setProperty ("disk", disk); if (web) web->emitEventIfBrowserIsVisible ("dawCut", juce::var (o)); };
        web = std::make_unique<juce::WebBrowserComponent> (
            juce::WebBrowserComponent::Options{}
                .withNativeIntegrationEnabled()
                .withKeepPageLoadedWhenBrowserIsHidden()
                .withResourceProvider ([] (const juce::String& path) { return serve (path); })
                .withNativeFunction ("daw", [this] (const juce::Array<juce::var>& args, juce::WebBrowserComponent::NativeFunctionCompletion done)
                {
                    handle (args.size() > 0 ? args[0].toString() : juce::String(), args.size() > 1 ? args[1] : juce::var(), std::move (done));
                }));
        addAndMakeVisible (*web);
        web->goToURL (juce::WebBrowserComponent::getResourceProviderRoot());
        setSize (1440, 900);
        startTimerHz (30);
    }

    ~MainComponent() override { engine.devices().removeChangeListener (this); }
    void resized() override { if (web) web->setBounds (getLocalBounds()); }
    void paint (juce::Graphics& g) override { g.fillAll (juce::Colour (0xff151514)); }

    /** For the self-test: run a line of the page's own JavaScript. */
    void js (const juce::String& code, std::function<void (juce::String)> then = nullptr)
    {
        web->evaluateJavascript (code, [then] (juce::WebBrowserComponent::EvaluationResult r)
        {
            if (then) then (r.getResult() != nullptr ? juce::JSON::toString (*r.getResult(), true) : (r.getError() != nullptr ? "ERROR " + r.getError()->message : juce::String ("?")));
        });
    }
    /** A line of the menu bar was picked: the page does what its key does. */
    void menuPicked (const juce::String& id) { auto* o = new juce::DynamicObject(); o->setProperty ("id", id); web->emitEventIfBrowserIsVisible ("dawMenu", juce::var (o)); }
    /** A project was handed to the app (opened from the Finder): the page opens it, now or as soon as it is up. */
    void openProject (const juce::String& name)
    {
        if (name.isEmpty()) return;
        if (! pageUp) { pendingOpen = name; return; }
        auto* o = new juce::DynamicObject(); o->setProperty ("name", name);
        web->emitEventIfBrowserIsVisible ("dawOpen", juce::var (o));
    }
    /** Let the page save first; quit anyway after a second and a half. */
    void askToQuit() { if (quitIn > 0) return; quitIn = 45; web->emitEventIfBrowserIsVisible ("dawQuit", juce::var()); }
    void snapshot (const juce::File& f, bool slursOwn = false) { if (auto* p = getPeer()) slurSnapshotWebView (p->getNativeHandle(), f.getFullPathName().toRawUTF8(), slursOwn); }
    daw::Engine engine;
    std::function<void (const juce::String&, const juce::var&)> onTestNote;
    std::function<void()> onTestDone;
    static juce::File logDir() { return juce::File::getSpecialLocation (juce::File::userHomeDirectory).getChildFile ("Library/Logs/Slur"); }

private:
    /** The page lives inside the app (Contents/Resources/ui), so the app never has to ask macOS for a folder.
        `--ui=<folder>` reads it from somewhere else instead, for working on the page without rebuilding. */
    static juce::File uiRoot()
    {
        static const juce::File root = []
        {
            for (auto& a : juce::JUCEApplicationBase::getCommandLineParameterArray())
                if (a.startsWith ("--ui=")) return juce::File (a.fromFirstOccurrenceOf ("=", false, false).unquoted());
            return juce::File::getSpecialLocation (juce::File::currentApplicationFile).getChildFile ("Contents/Resources/ui");
        }();
        return root;
    }
    static std::optional<juce::WebBrowserComponent::Resource> serve (const juce::String& pathIn)
    {
        auto path = pathIn.upToFirstOccurrenceOf ("?", false, false);
        if (path.isEmpty() || path == "/") path = "/index.html";
        if (path.contains ("..")) return std::nullopt;
        const auto file = uiRoot().getChildFile (path.substring (1));
        juce::MemoryBlock mb;
        if (! file.existsAsFile() || ! file.loadFileAsData (mb)) { daw::logLine ("page asked for a file that is not there: " + path); return std::nullopt; }
        const auto ext = file.getFileExtension().toLowerCase();
        const char* mime = ext == ".html" ? "text/html" : ext == ".js" ? "text/javascript" : ext == ".css" ? "text/css" : ext == ".woff2" ? "font/woff2" : ext == ".svg" ? "image/svg+xml" : ext == ".png" ? "image/png" : ext == ".json" ? "application/json" : "application/octet-stream";
        juce::WebBrowserComponent::Resource res;
        res.data.resize (mb.getSize());
        std::memcpy (res.data.data(), mb.getData(), mb.getSize());
        res.mimeType = mime;
        return res;
    }

    void handle (const juce::String& op, const juce::var& d, juce::WebBrowserComponent::NativeFunctionCompletion done)
    {
        if (op == "track")  { engine.setTrack (d); done (okVar()); return; }
        if (op == "hello")
        {
            auto* o = new juce::DynamicObject();
            o->setProperty ("ok", true); o->setProperty ("sr", engine.sr);
            o->setProperty ("mp3", engine.lame.existsAsFile()); o->setProperty ("mic", slurMicStatus()); o->setProperty ("ins", engine.inputCount());
            o->setProperty ("selftest", selfTestMode());
            o->setProperty ("up", slurSecondsUp());                  // from the press that opened the app to the page asking its first question
            o->setProperty ("diskFree", (double) projectsRoot().getBytesFreeOnVolume());      // the room left on the disk the projects lie on: said once when it is little
            if (lastRun().isObject()) { o->setProperty ("lastRun", lastRun()); lastRun() = juce::var(); }      // told once: the run before this one did not end by itself
            o->setProperty ("open", pendingOpen); pendingOpen.clear(); pageUp = true;
            describeDevice (*o);
            done (juce::var (o)); return;
        }
        if (op == "buffer")
        {
            const int ch = juce::jlimit (1, 2, (int) d["ch"]), frames = (int) d["frames"];
            juce::MemoryBlock mb;
            { juce::MemoryOutputStream os (mb, false); juce::Base64::convertFromBase64 (os, d["pcm"].toString()); }
            if (frames < 2 || mb.getSize() < (size_t) frames * (size_t) ch * 2) { done (okVar (false)); return; }
            juce::AudioBuffer<float> b (ch, frames);
            const auto* p = static_cast<const juce::int16*> (mb.getData());
            for (int c = 0; c < ch; ++c) { auto* w = b.getWritePointer (c); for (int i = 0; i < frames; ++i) w[i] = (float) p[i * ch + c] / 32768.0f; }
            engine.setBuffer (d["key"].toString(), std::move (b));
            done (okVar()); return;
        }
        if (op == "session") { const auto took = engine.setSession (d); if (engine.trackCount() != lastTracks) { lastTracks = engine.trackCount(); daw::logLine ("session: " + juce::String (lastTracks) + " tracks, tempo " + juce::String (engine.tempo.load())); } done (took); return; }
        if (op == "play")    { engine.loopA.store ((double) d["a"]); engine.loopB.store ((double) d["b"]); engine.loop.store ((int) d["loop"] != 0); engine.play ((double) d["bar"]); done (okVar()); return; }
        if (op == "stop")    { engine.stop(); done (okVar()); return; }
        if (op == "seek")    { engine.seek ((double) d["bar"]); done (okVar()); return; }
        if (op == "queue")   { engine.queued.store ((double) d["bar"]); done (okVar()); return; }
        if (op == "loop")    { engine.loopA.store ((double) d["a"]); engine.loopB.store ((double) d["b"]); engine.loop.store ((int) d["on"] != 0); done (okVar()); return; }
        if (op == "audioSettings") { engine.showAudioSettings(); done (okVar()); return; }
        if (op == "click")   { engine.click.store ((int) d["on"] != 0); done (okVar()); return; }
        if (op == "master")  { engine.master.store ((float) (double) d["gain"]); done (okVar()); return; }
        if (op == "inputOn")
        {
            const auto err = engine.enableInput();
            auto* o = new juce::DynamicObject();
            o->setProperty ("ok", err.isEmpty()); o->setProperty ("error", err); o->setProperty ("mic", slurMicStatus()); o->setProperty ("ins", engine.inputCount());
            done (juce::var (o)); return;
        }
        if (op == "recStart")
        {
            auto* o = new juce::DynamicObject();
            o->setProperty ("bar", d["bar"]); o->setProperty ("countIn", d["countIn"]); o->setProperty ("tracks", d["tracks"]);
            o->setProperty ("dir", projectDir (d["project"].toString()).getChildFile ("audio").getFullPathName());
            done (engine.recStart (juce::var (o))); return;
        }
        if (op == "recStop") { done (engine.recStop (! d.hasProperty ("keep") || (int) d["keep"] != 0)); return; }
        if (op == "stretch") { engine.stretch (d, [done] (juce::var r) { done (r); }); return; }
        if (op == "onsets")  { engine.findOnsets (d["key"].toString(), [done] (juce::var r) { done (r); }); return; }
        if (op == "tempo")   { engine.findTempo (d["key"].toString(), [done] (juce::var r) { done (r); }); return; }
        if (op == "soundParts")                                                // where a buffer has sound: {key, floor (dB), gap, pre, post (seconds)}
        {
            engine.findSound (d["key"].toString(), d.hasProperty ("floor") ? (double) d["floor"] : -40.0, d.hasProperty ("gap") ? (double) d["gap"] : 0.3,
                              d.hasProperty ("pre") ? (double) d["pre"] : 0.01, d.hasProperty ("post") ? (double) d["post"] : 0.06, [done] (juce::var r) { done (r); });
            return;
        }
        if (op == "dropBuffer") { engine.dropBuffer (d["key"].toString()); done (okVar()); return; }
        if (op == "wave") { done (engine.wave (d["key"].toString(), (double) d["from"], (double) d["to"], (int) d["n"])); return; }      // a stretch of a sound, close up, for drawing
        if (op == "closeEditors") { engine.closeEditors(); done (okVar()); return; }
        if (op == "plugins") { done (engine.listPlugins ([] (const juce::String& id) { return auMaker (id); })); return; }
        if (op == "insert")  { engine.insertPlugin ((int) d["track"], d["id"].toString(), d["state"].toString(), ! d.hasProperty ("show") || (int) d["show"] != 0, [done] (juce::var r) { done (r); }, d.hasProperty ("at") ? (int) d["at"] : -1); return; }
        if (op == "pluginStates") { done (engine.pluginStates()); return; }
        if (op == "prefGet") { auto v = juce::JSON::parse (prefsFile()); done (v.isObject() ? v : juce::var (new juce::DynamicObject())); return; }
        if (op == "prefSet")
        {
            auto v = juce::JSON::parse (prefsFile());
            if (! v.isObject()) v = juce::var (new juce::DynamicObject());
            v.getDynamicObject()->setProperty (juce::Identifier (d["key"].toString()), d["value"]);
            prefsFile().getParentDirectory().createDirectory();
            done (okVar (prefsFile().replaceWithText (juce::JSON::toString (v)))); return;
        }
        if (op == "projList")
        {
            juce::Array<juce::var> out;
            juce::StringArray seen;
            for (auto* pattern : { "*.sls", "*.slur" })
                for (auto& f : projectsRoot().findChildFiles (juce::File::findDirectories, false, pattern))
                    if (f.getChildFile ("project.json").existsAsFile() && ! seen.contains (f.getFileNameWithoutExtension()))
                    {
                        seen.add (f.getFileNameWithoutExtension());
                        auto* o = new juce::DynamicObject();
                        o->setProperty ("name", f.getFileNameWithoutExtension());
                        o->setProperty ("modified", f.getChildFile ("project.json").getLastModificationTime().toMilliseconds());
                        out.add (juce::var (o));
                    }
            done (out); return;
        }
        if (op == "projSave")
        {
            auto dir = projectDir (d["name"].toString());
            dir.getChildFile ("audio").createDirectory();
            keepBackup (dir, dir.getChildFile ("project.json"), (int) d["backup"] != 0);
            daw::Marker::set ("project", d["name"].toString());
            done (okVar (dir.getChildFile ("project.json").replaceWithText (d["json"].toString()))); return;
        }
        if (op == "projLoad")
        {
            auto f = projectDir (d["name"].toString()).getChildFile ("project.json");
            auto* o = new juce::DynamicObject();
            o->setProperty ("ok", f.existsAsFile());
            if (f.existsAsFile()) { o->setProperty ("json", f.loadFileAsString()); o->setProperty ("saved", f.getLastModificationTime().toMilliseconds()); daw::Marker::set ("project", d["name"].toString()); }
            done (juce::var (o)); return;
        }
        if (op == "projBackups")                                               // the song as it was earlier: the copies put aside, the newest first
        {
            juce::Array<juce::var> out;
            auto all = projectDir (d["name"].toString()).getChildFile ("backups").findChildFiles (juce::File::findFiles, false, "*.json");
            std::sort (all.begin(), all.end(), [] (const juce::File& a, const juce::File& b) { return a.getFileName() > b.getFileName(); });
            for (auto& f : all) { auto* o = new juce::DynamicObject(); o->setProperty ("file", f.getFileName()); o->setProperty ("when", f.getLastModificationTime().toMilliseconds()); out.add (juce::var (o)); }
            done (out); return;
        }
        if (op == "projBackup")
        {
            const auto f = projectDir (d["name"].toString()).getChildFile ("backups").getChildFile (juce::File::createLegalFileName (d["file"].toString()));
            auto* o = new juce::DynamicObject();
            o->setProperty ("ok", f.existsAsFile());
            if (f.existsAsFile()) o->setProperty ("json", f.loadFileAsString());
            done (juce::var (o)); return;
        }
        if (op == "takesLeft") { done (engine.takesLeft (projectDir (d["project"].toString()).getChildFile ("audio"))); return; }
        if (op == "distrust")                                                  // the plug-ins the app has learnt not to open by itself: read, or written
        {
            const auto file = stateDir().getChildFile ("distrust.json");
            if (d.hasProperty ("list")) { stateDir().createDirectory(); done (okVar (file.replaceWithText (juce::JSON::toString (d["list"])))); return; }
            auto v = juce::JSON::parse (file);
            done (v.isArray() ? v : juce::var (juce::Array<juce::var>())); return;
        }
        if (op == "badEnds")                                                   // how many runs in a row ended badly on one song with nothing to name: read, or written (`set`: an object, or nothing — the count begins again)
        {
            const auto file = stateDir().getChildFile ("bad-ends.json");
            if (d.hasProperty ("set")) { if (d["set"].isObject()) { stateDir().createDirectory(); done (okVar (file.replaceWithText (juce::JSON::toString (d["set"])))); } else done (okVar (file.deleteFile())); return; }
            auto v = juce::JSON::parse (file);
            done (v.isObject() ? v : juce::var()); return;
        }
        if (op == "testCrash") { daw::crashOnUid.store ((int) d["uid"]); done (okVar()); return; }
        if (op == "testHang")  { if (selfTestMode().isNotEmpty()) { daw::hangLive.store ((int) d["live"] != 0); daw::hangOnUid.store ((int) d["uid"]); } done (okVar()); return; }      // the check: a print (live: the device) never comes back from this plug-in       // the check: this plug-in brings the app down the next time it plays
        if (op == "projRename") { auto from = projectDir (d["from"].toString()), to = projectDir (d["to"].toString()); done (okVar (from.isDirectory() ? (! to.exists() && from.moveFileTo (to)) : ! to.exists())); return; }      // a new name is always a .sls: projectDir gives the old kind only for a folder that is there
        if (op == "projCopy") { auto from = projectDir (d["from"].toString()), to = projectDir (d["to"].toString()); done (okVar (! to.exists() && (from.isDirectory() ? from.copyDirectoryTo (to) : to.getChildFile ("audio").createDirectory().wasOk()))); return; }
        if (op == "title")    { if (auto* w = dynamic_cast<juce::DocumentWindow*> (getTopLevelComponent())) w->setName (d["text"].toString()); done (okVar()); return; }
        if (op == "slurPanel")                                                 // where slur stands in the room, and whether it shows
        {
            const bool on = (int) d["on"] != 0 && selfTestMode() != "all";             // the whole check runs without the net
            if (on)
            {
                if (slur == nullptr) makeSlur();
                slur->setBounds (juce::roundToInt ((double) d["x"]), juce::roundToInt ((double) d["y"]), juce::jmax (1, juce::roundToInt ((double) d["w"])), juce::jmax (1, juce::roundToInt ((double) d["h"])));
                slur->setVisible (true); slur->toFront (false);
            }
            else if (slur != nullptr) slur->setVisible (false);
            done (okVar()); return;
        }
        if (op == "testMenus") { auto* o = new juce::DynamicObject(); o->setProperty ("titles", juce::String (juce::CharPointer_UTF8 (slurMenuTitles().c_str()))); done (juce::var (o)); return; }
        if (op == "testWindow")                                                // the window as the system has it, and a picture of its own bar
        {
            const auto png = logDir().getChildFile (juce::File::createLegalFileName (d["name"].toString()));
            done (getPeer() != nullptr ? juce::JSON::parse (juce::String (juce::CharPointer_UTF8 (slurWindowReport (getPeer()->getNativeHandle(), png.getFullPathName().toRawUTF8()).c_str()))) : juce::var());
            return;
        }
        if (op == "testMoved")                                                 // the check: folders under an old name taken over under a new one, on stand-ins of its own
        {
            auto* o = new juce::DynamicObject();
            if (selfTestMode().isEmpty()) { done (juce::var (o)); return; }
            const auto base = daw::musicRoot().getChildFile ("Moved");
            base.deleteRecursively();
            const auto old = base.getChildFile ("Old Name"), now = base.getChildFile ("New Name");
            old.getChildFile ("Projects/a song.sls/audio").createDirectory(); old.getChildFile ("Projects/a song.sls/project.json").replaceWithText ("{\"v\":3}");
            o->setProperty ("moved", takeOver (old, now));
            o->setProperty ("there", now.getChildFile ("Projects/a song.sls/project.json").loadFileAsString() == "{\"v\":3}" && now.getChildFile ("Projects/a song.sls/audio").isDirectory() && ! old.exists());
            old.createDirectory();
            o->setProperty ("both", takeOver (old, now));
            o->setProperty ("bothLeft", old.isDirectory() && now.getChildFile ("Projects/a song.sls/project.json").existsAsFile());
            o->setProperty ("nothing", takeOver (base.getChildFile ("Never"), base.getChildFile ("Nowhere")));
            const auto settings = base.getChildFile ("settings.json");
            settings.replaceWithText ("{\"lastProject\":\"" + old.getFullPathName() + "/Other/x.sls\",\"elsewhere\":[\"" + old.getFullPathName() + "/Other/x.sls\",\"/Users/someone/Desktop/y.sls\"],\"audio\":\"kept\"}");
            o->setProperty ("places", placesRenamed (settings, old.getFullPathName(), now.getFullPathName()));
            const auto v = juce::JSON::parse (settings);
            o->setProperty ("last", v["lastProject"].toString().fromFirstOccurrenceOf ("/Moved/", false, false));
            o->setProperty ("elsewhere", v["elsewhere"].size() == 2 ? v["elsewhere"][0].toString().fromFirstOccurrenceOf ("/Moved/", false, false) + " | " + v["elsewhere"][1].toString() : juce::String ("?"));
            o->setProperty ("audio", v["audio"].toString());
            o->setProperty ("again", placesRenamed (settings, old.getFullPathName(), now.getFullPathName()));
            const auto bare = base.getChildFile ("bare.json"); bare.replaceWithText ("{\"lastProject\":\"untitled 2\"}");
            o->setProperty ("bare", placesRenamed (bare, old.getFullPathName(), now.getFullPathName()) ? juce::String ("changed") : bare.loadFileAsString());
            base.deleteRecursively();
            done (juce::var (o)); return;
        }
        if (op == "testMenu")  { menuPicked (d["id"].toString()); done (okVar()); return; }
        if (op == "audioAdd")
        {
            juce::MemoryBlock mb;
            { juce::MemoryOutputStream os (mb, false); juce::Base64::convertFromBase64 (os, d["data"].toString()); }
            const juce::File given (juce::File::createLegalFileName (d["name"].toString()));
            auto dir = projectDir (d["project"].toString()).getChildFile ("audio");
            dir.createDirectory();
            auto file = dir.getNonexistentChildFile (given.getFileNameWithoutExtension(), given.getFileExtension(), false);
            file.replaceWithData (mb.getData(), mb.getSize());
            done (withFile (engine.decodeFile (file), file.getFileName(), given.getFileNameWithoutExtension())); return;
        }
        if (op == "audioPut")                                                  // a file let go on the page comes over in pieces, so a long one is never one enormous message
        {
            const auto id = d["id"].toString();
            juce::File file;
            if (auto it = uploads.find (id); it != uploads.end()) file = it->second;
            else
            {
                const juce::File given (juce::File::createLegalFileName (d["name"].toString()));
                auto dir = projectDir (d["project"].toString()).getChildFile ("audio");
                dir.createDirectory();
                file = dir.getNonexistentChildFile (given.getFileNameWithoutExtension(), given.getFileExtension(), false);
                uploads[id] = file;
            }
            juce::MemoryBlock mb;
            { juce::MemoryOutputStream os (mb, false); juce::Base64::convertFromBase64 (os, d["data"].toString()); }
            const bool wrote = file.appendData (mb.getData(), mb.getSize());
            if ((int) d["last"] == 0) { done (okVar (wrote)); return; }
            uploads.erase (id);
            done (withFile (engine.decodeFile (file), file.getFileName(), juce::File (juce::File::createLegalFileName (d["name"].toString())).getFileNameWithoutExtension())); return;
        }
        if (op == "audioList")
        {
            juce::Array<juce::var> out;
            for (auto& f : projectDir (d["project"].toString()).getChildFile ("audio").findChildFiles (juce::File::findFiles, false))
            {
                const double sec = engine.fileSeconds (f);
                if (sec <= 0.0) continue;
                auto* o = new juce::DynamicObject();
                o->setProperty ("file", f.getFileName()); o->setProperty ("name", f.getFileNameWithoutExtension()); o->setProperty ("sec", sec);
                o->setProperty ("modified", f.getLastModificationTime().toMilliseconds());
                out.add (juce::var (o));
            }
            done (out); return;
        }
        if (op == "audioLoad") { auto file = projectDir (d["project"].toString()).getChildFile ("audio").getChildFile (d["file"].toString()); done (withFile (engine.decodeFile (file), file.getFileName(), file.getFileNameWithoutExtension())); return; }
        if (op == "import")
        {
            const auto project = d["project"].toString();
            chooser = std::make_unique<juce::FileChooser> ("Import Audio", juce::File::getSpecialLocation (juce::File::userMusicDirectory), "*.wav;*.aif;*.aiff;*.mp3;*.m4a;*.flac;*.ogg;*.caf");
            chooser->launchAsync (juce::FileBrowserComponent::openMode | juce::FileBrowserComponent::canSelectFiles | juce::FileBrowserComponent::canSelectMultipleItems, [this, done, project] (const juce::FileChooser& fc)
            {
                juce::Array<juce::var> out;
                auto dir = projectDir (project).getChildFile ("audio");
                dir.createDirectory();
                for (auto& src : fc.getResults())
                {
                    auto file = dir.getNonexistentChildFile (juce::File::createLegalFileName (src.getFileNameWithoutExtension()), src.getFileExtension(), false);
                    if (src.copyFileTo (file)) out.add (withFile (engine.decodeFile (file), file.getFileName(), src.getFileNameWithoutExtension()));
                }
                done (out);
            });
            return;
        }
        if (op == "quit") { done (okVar()); juce::MessageManager::callAsync ([] { juce::JUCEApplication::quit(); }); return; }
        if (op == "bypass")  { engine.bypassPlugin ((int) d["track"], (int) d["uid"], (int) d["off"] != 0); done (okVar()); return; }
        if (op == "editor")  { engine.openEditor ((int) d["track"], (int) d["uid"]); done (okVar()); return; }
        if (op == "remove")  { done (okVar (engine.removePlugin ((int) d["track"], (int) d["uid"]))); return; }
        if (op == "decode")
        {
            juce::MemoryBlock mb;
            { juce::MemoryOutputStream os (mb, false); juce::Base64::convertFromBase64 (os, d["data"].toString()); }
            done (engine.decode (mb)); return;
        }
        if (op == "bounce")
        {
            juce::Component::SafePointer<MainComponent> self (this);
            juce::var opts = d;
            if (d["kind"].toString() == "place")                      // a bounce in place lands in the project's own folder
                if (auto* o = d.getDynamicObject()) { auto c = o->clone(); c->setProperty ("dir", projectDir (d["project"].toString()).getChildFile ("audio").getFullPathName()); opts = juce::var (c.release()); }
            engine.exportAudio (opts, [self] (int n, int total)
            {
                if (self == nullptr) return;
                auto* o = new juce::DynamicObject(); o->setProperty ("done", n); o->setProperty ("total", total);
                self->web->emitEventIfBrowserIsVisible ("dawBounce", juce::var (o));
            }, [done] (juce::var r) { done (r); });
            return;
        }
        if (op == "log") { daw::logLine ("page: " + d["text"].toString()); done (okVar()); return; }
        if (op == "testPerf")  { done (engine.takePerf()); return; }
        if (op == "testSound") { done (engine.testSound (projectDir (d["project"].toString()).getChildFile ("audio").getChildFile (d["file"].toString()))); return; }
        if (op == "testHands") { engine.setHands ((int) d["n"]); auto* o = new juce::DynamicObject(); o->setProperty ("threads", engine.hands() + 1); done (juce::var (o)); return; }       // how many threads share a block (-1: as the machine allows)
        if (op == "testFile")                                                  // a sound of a given length, made here and laid in the project's folder (the same every time: bursts of noise over a low tone)
        {
            const double sec = juce::jlimit (0.5, 3600.0, (double) d["sec"]), rate = d.hasProperty ("rate") ? (double) d["rate"] : engine.sr;
            const int ch = juce::jlimit (1, 2, d.hasProperty ("ch") ? (int) d["ch"] : 2);
            auto dir = projectDir (d["project"].toString()).getChildFile ("audio");
            dir.createDirectory();
            auto file = dir.getChildFile (juce::File::createLegalFileName (d["name"].toString()) + ".wav");
            file.deleteFile();
            bool ok = false;
            if (std::unique_ptr<juce::OutputStream> os = file.createOutputStream())
            {
                juce::WavAudioFormat wav;
                if (auto w = wav.createWriterFor (os, juce::AudioFormatWriterOptions{}.withSampleRate (rate).withNumChannels (ch).withBitsPerSample (24)))
                {
                    const juce::int64 total = (juce::int64) (sec * rate), hit = (juce::int64) (rate * 0.326);
                    juce::AudioBuffer<float> b (ch, 16384);
                    juce::uint32 seed = 20261007u;
                    ok = true;
                    for (juce::int64 p = 0; p < total && ok; p += 16384)
                    {
                        const int n = (int) juce::jmin ((juce::int64) 16384, total - p);
                        for (int i = 0; i < n; ++i)
                        {
                            const juce::int64 k = p + i;
                            seed = seed * 1664525u + 1013904223u;
                            const float noise = (float) (seed >> 8) / 8388608.0f - 1.0f, env = std::exp (-(float) (k % hit) / (float) hit * 7.0f);
                            const float tone = 0.2f * std::sin ((float) k * juce::MathConstants<float>::twoPi * 110.0f / (float) rate);
                            b.setSample (0, i, 0.4f * noise * env + tone);
                            if (ch > 1) b.setSample (1, i, 0.4f * noise * env - tone * 0.5f);
                        }
                        ok = w->writeFromAudioSampleBuffer (b, 0, n);
                    }
                }
            }
            auto* o = new juce::DynamicObject();
            o->setProperty ("ok", ok); o->setProperty ("file", file.getFileName()); o->setProperty ("mb", (double) file.getSize() / 1048576.0);
            done (juce::var (o)); return;
        }
        if (op == "testMeasure") { engine.measure (d, [done] (juce::var r) { done (r); }); return; }
        if (op == "testMemory")                                                // how much of the machine's memory is the app's own, in megabytes; and how long it has been up
        {
            auto* o = new juce::DynamicObject();
            o->setProperty ("mb", slurFootprintMb()); o->setProperty ("up", slurSecondsUp());
            done (juce::var (o)); return;
        }
        if (op == "testMeter") { auto [rms, pk] = engine.takeMeter(); auto* o = new juce::DynamicObject(); o->setProperty ("rms", rms); o->setProperty ("peak", pk); done (juce::var (o)); return; }
        if (op == "testInfo")  { auto* o = new juce::DynamicObject(); o->setProperty ("tracks", engine.trackCount()); o->setProperty ("rooms", engine.chainCount()); done (juce::var (o)); return; }
        if (op == "testSnap")  { snapshot (logDir().getChildFile (juce::File::createLegalFileName (d["name"].toString())), d["which"].toString() == "slur"); done (okVar()); return; }
        if (op == "testSlur")                                                  // what slur's own page says of itself
        {
            if (slur == nullptr) { done (okVar (false)); return; }
            // the check may bring a question of its own (a line of JavaScript that answers with JSON); else the usual one
            const auto asked = d["js"].toString();
            slur->evaluateJavascript (asked.isNotEmpty() ? asked : juce::String ("JSON.stringify({ ready: document.readyState === 'complete', href: location.origin + location.pathname, w: innerWidth, h: innerHeight, juce: !!window.__JUCE__, text: (document.body ? document.body.innerText : '').replace(/\\s+/g, ' ').slice(0, 160), bar: [...document.querySelectorAll('.top-bar .icon-btn')].map(e => [e.getAttribute('title'), getComputedStyle(e).display]), paper: document.querySelector('.plugin') ? getComputedStyle(document.querySelector('.plugin')).backgroundColor : null })"),
                [done] (juce::WebBrowserComponent::EvaluationResult r) { done (r.getResult() != nullptr ? juce::JSON::parse (r.getResult()->toString()) : juce::var()); });
            return;
        }
        if (op == "testNote")  { if (onTestNote) onTestNote (d["key"].toString(), juce::JSON::parse (d["value"].toString())); done (okVar()); return; }
        if (op == "testDrop")                                                  // a file let go over the page, as the Finder would do it
        {
            auto* cb = new juce::WebBrowserComponent::NativeFunctionCompletion (std::move (done));
            const auto file = projectDir (d["project"].toString()).getChildFile ("audio").getChildFile (d["file"].toString());
            if (auto* p = getPeer()) slurFakeDrop (p->getNativeHandle(), file.getFullPathName().toRawUTF8(), (double) d["x"], (double) d["y"],
                                                   [] (int took, void* c) { std::unique_ptr<juce::WebBrowserComponent::NativeFunctionCompletion> f (static_cast<juce::WebBrowserComponent::NativeFunctionCompletion*> (c)); auto* o = new juce::DynamicObject(); o->setProperty ("took", took); (*f) (juce::var (o)); }, cb);
            else { (*cb) (okVar (false)); delete cb; }
            return;
        }
        if (op == "testRate")  { engine.testAdoptRate ((double) d["sr"]); done (okVar()); return; }
        if (op == "testHole")  { engine.testHole(); done (okVar()); return; }                                              // the check: the device gives no block for a while
        if (op == "testBlock") { done (selfTestMode().isNotEmpty() ? engine.testBlock ((int) d["n"]) : okVar (false)); return; }      // the device's block, for the measure (only in the check: the settings in use are never touched)
        if (op == "testDone")  { done (okVar()); if (onTestDone) juce::MessageManager::callAsync (onTestDone); return; }
        done (okVar (false));
    }

    /** The device was changed (in the audio window, or under us): remember it for next time. */
    void changeListenerCallback (juce::ChangeBroadcaster*) override
    {
        auto v = juce::JSON::parse (prefsFile());
        if (! v.isObject()) v = juce::var (new juce::DynamicObject());
        if (auto xml = engine.deviceState()) v.getDynamicObject()->setProperty ("audio", xml->toString (juce::XmlElement::TextFormat().singleLine()));
        prefsFile().getParentDirectory().createDirectory();
        prefsFile().replaceWithText (juce::JSON::toString (v));
        auto* o = new juce::DynamicObject(); o->setProperty ("ins", engine.inputCount());
        describeDevice (*o);
        web->emitEventIfBrowserIsVisible ("dawDevice", juce::var (o));
    }
    /** The block the device asks for at a time, and how deep its samples are. */
    void describeDevice (juce::DynamicObject& o)
    {
        auto* dev = engine.devices().getCurrentAudioDevice();
        o.setProperty ("block", dev != nullptr ? dev->getCurrentBufferSizeSamples() : engine.block);
        o.setProperty ("bits", dev != nullptr ? dev->getCurrentBitDepth() : 0);
    }
    /** Slur: the plug-in's own page, in a view of its own. Its top bar's fx is left out here, where the patch is the room's;
        so is the mark on its door (nothing in this room carries a logo). */
    void makeSlur()
    {
        slur = std::make_unique<juce::WebBrowserComponent> (
            juce::WebBrowserComponent::Options{}
                .withNativeIntegrationEnabled()
                .withKeepPageLoadedWhenBrowserIsHidden()
                .withUserScript (R"((function () { var s = document.createElement ('style'); s.textContent = '.top-bar .icon-btn[title="FX"]{display:none!important}.sl-door .sl-logo{display:none!important}'; (document.head || document.documentElement).appendChild (s); }) ();)")
                .withNativeFunction ("openExternal", [] (const juce::Array<juce::var>& args, juce::WebBrowserComponent::NativeFunctionCompletion done)
                {
                    const auto url = args.size() > 0 ? args[0].toString() : juce::String();
                    if (! (url.startsWithIgnoreCase ("https://") || url.startsWithIgnoreCase ("http://"))) { done ("error:bad-scheme"); return; }
                    done (juce::URL (url).launchInDefaultBrowser() ? "ok" : "error:launch-failed");
                }));
        addChildComponent (*slur);
        /*  The studio stood on end for this column: ?surface=panel (apps/plugin, pages/panel.css). A build of the
            page from before that surface does not know the word and shows what it always showed here (the small
            plug-in, which plugin=1 asks for), so the app and the page need not change on the same day.
            The check may point the panel at another copy of the page (--slur-url=http://localhost:5173). */
        juce::String base (SLUR_APP_URL);
        if (selfTestMode().isNotEmpty())
        {
            const auto args = juce::JUCEApplicationBase::getCommandLineParameters();
            if (args.contains ("--slur-url=")) base = args.fromFirstOccurrenceOf ("--slur-url=", false, false).upToFirstOccurrenceOf (" ", false, false).unquoted();
        }
        slur->goToURL (base + "/?surface=panel&plugin=1&v=" + juce::String (juce::Time::currentTimeMillis()));
        daw::logLine ("slur: the studio's panel is opening from " + base);
    }

    void timerCallback() override
    {
        if (quitIn > 0 && --quitIn == 0) { juce::JUCEApplication::quit(); return; }
        if (++ticks % 6 == 0) engine.warm();                                   // five times a second: the sound just ahead of the playhead is asked for
        auto* o = new juce::DynamicObject();
        o->setProperty ("p", engine.posBars.load());
        o->setProperty ("on", engine.playing.load());
        o->setProperty ("j", engine.jumps.load());
        o->setProperty ("r", engine.recording.load());
        o->setProperty ("m", engine.takeMeters());
        o->setProperty ("c", engine.devices().getCpuUsage());
        web->emitEventIfBrowserIsVisible ("dawTick", juce::var (o));
    }

    std::unique_ptr<juce::WebBrowserComponent> web, slur;
    juce::String pendingOpen;
    bool pageUp = false;
    std::unique_ptr<juce::FileChooser> chooser;
    std::map<juce::String, juce::File> uploads;
    int quitIn = 0, lastTracks = -1, ticks = 0;
};

//==============================================================================
class MainWindow final : public juce::DocumentWindow, private juce::Timer
{
public:
    MainWindow() : DocumentWindow ("Slur Studio", juce::Colour (0xff1b1b1a), DocumentWindow::allButtons)
    {
        setUsingNativeTitleBar (true);
        setContentOwned (new MainComponent(), true);
        setResizable (true, false);
        setResizeLimits (1100, 640 + 28, 6000, 4000);
        { const auto area = juce::Desktop::getInstance().getDisplays().getPrimaryDisplay()->userArea; setSize (juce::jmin (getWidth(), area.getWidth()), juce::jmin (getHeight(), area.getHeight())); }
        centreWithSize (getWidth(), getHeight());
        setVisible (true);
        if (auto* p = getPeer()) slurStyleWindow (p->getNativeHandle());
        startTimer (120);                                                      // the menu bar is the app's a moment after its first window is
    }
    ~MainWindow() override { stopTimer(); }
    void closeButtonPressed() override { if (auto* m = main()) m->askToQuit(); else juce::JUCEApplication::quit(); }
    MainComponent* main() { return dynamic_cast<MainComponent*> (getContentComponent()); }
private:
    void timerCallback() override
    {
        const bool made = slurInstallMenus ([] (const char* id, void* self) { if (auto* m = static_cast<MainWindow*> (self)->main()) m->menuPicked (juce::String (juce::CharPointer_UTF8 (id))); }, this);
        if (made || ++tries > 50) stopTimer();
    }
    int tries = 0;
};

/*  --selftest: the page checks itself against the real engine (ui/selftest.js),
    with the speakers silent and a tone standing in for the microphone. This
    side keeps what the page reports, writes it down, and quits.            */
class SelfTest final : private juce::Timer
{
public:
    explicit SelfTest (MainWindow& w) : win (w)
    {
        file = MainComponent::logDir().getChildFile ("selftest.json");
        file.deleteFile();
        auto* m = win.main();
        m->engine.mute.store (true); m->engine.quiet = true; m->engine.testInput = true;
        m->onTestNote = [this] (const juce::String& k, const juce::var& v) { out->setProperty (k, v); daw::logLine ("selftest  " + k + " = " + juce::JSON::toString (v, true)); write(); };
        m->onTestDone = [this] { out->setProperty ("finished", true); write(); stopTimer(); juce::JUCEApplication::quit(); };
        startTimer (1000);
    }
private:
    void write() { file.replaceWithText (juce::JSON::toString (juce::var (out.get()))); }
    void timerCallback() override { if (++seconds > 900) { out->setProperty ("fail", "timed out"); write(); stopTimer(); juce::JUCEApplication::quit(); } }
    MainWindow& win;
    juce::File file;
    juce::DynamicObject::Ptr out { new juce::DynamicObject() };
    int seconds = 0;
};

class SlurDawApp final : public juce::JUCEApplication
{
public:
    const juce::String getApplicationName() override    { return "Slur Studio"; }
    const juce::String getApplicationVersion() override { return "0.1.0"; }
    bool moreThanOneInstanceAllowed() override          { return true; }
    void initialise (const juce::String& args) override
    {
        /* One copy of the app at a time. A second one (the same app, found somewhere else on the disk and opened by
           mistake) would open the same project, and each would write over what the other had saved. It brings the
           copy that is open forward and goes, before it has read or written anything, the log included. The check
           (selftest.sh) runs as an app of another name, which is never taken for a copy of this one. */
        {
            const auto mode = selfTestMode();
            if (mode.isEmpty() || mode == "second")
            {
                const int other = slurRunningCopy (mode.isEmpty(), mode == "second");
                if (mode == "second") MainComponent::logDir().getChildFile ("selftest-second.json").replaceWithText ("{\"other\":" + juce::String (other) + "}");
                if (mode == "second" || other != 0) { quit(); return; }
            }
        }
        if (selfTestMode().isEmpty()) moveToNewName();                         // (before anything is read: the mark of the last run lies in one of the folders)
        lastRun() = daw::Marker::begin (stateDir(), selfTestMode().isNotEmpty());
        daw::logLine ("start  " + juce::File::getSpecialLocation (juce::File::currentApplicationFile).getFullPathName() + (lastRun().isObject() ? "  (the run before this one did not end by itself)" : ""));
        window = std::make_unique<MainWindow>();
        if (args.contains ("--selftest")) test = std::make_unique<SelfTest> (*window);
    }
    void shutdown() override { test.reset(); window.reset(); daw::Marker::end(); }
    void systemRequestedQuit() override { if (window != nullptr && window->main() != nullptr && test == nullptr) window->main()->askToQuit(); else quit(); }
    /** macOS hands a file to the app this way, whether or not the app was already open. */
    void anotherInstanceStarted (const juce::String& commandLine) override
    {
        const auto name = projectNamed (commandLine);
        daw::logLine ("handed: " + commandLine + (name.isEmpty() ? "  (not a project in music, slur daw, projects)" : juce::String()));
        if (window != nullptr && window->main() != nullptr && test == nullptr) window->main()->openProject (name);
    }
private:
    std::unique_ptr<MainWindow> window;
    std::unique_ptr<SelfTest> test;
};

START_JUCE_APPLICATION (SlurDawApp)
